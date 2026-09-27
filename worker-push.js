/* ============================================================
   KAN — แจ้งเตือนเด้งบนมือถือ/คอม (Web Push) แบบเดียวกับ m-crm (นนท์ 27 ก.ย. 69)

   ทำงานยังไง
   1) ทุกเหตุการณ์ลงตาราง push_outbox แถวละ "คน × เรื่อง" (UNIQUE kind+ref+staff = เด้งครั้งเดียว)
      - ของที่ระบบเขียนลงกล่องแจ้งเตือนในระบบอยู่แล้ว (task_mentions) → แยกหมวดจากคำนำหน้าข้อความ
      - งานใหม่ / ลีดใหม่ / ใกล้ถึงกำหนด / สรุปเลยกำหนด 09:00 → กวาดจากตารางจริง
      ไม่ต้องไปแก้ทุกจุดที่สร้างเหตุการณ์ (มีเป็นสิบจุด) — ลดโอกาสหลุด
   2) pushTick() กวาด + ส่ง · เรียกหลังทุกคำขอที่แก้ข้อมูล (หน่วง 1.5 วิให้ข้อมูลลงก่อน) และ cron ทุก 5 นาที
   3) ส่งจริงด้วย WebCrypto ล้วน (แพ็กเกจ web-push ใช้ Node crypto ไม่ได้บน Worker) — พอร์ตจาก m-crm ที่ตรวจกับ RFC แล้ว
   4) แต่ละคนเลือกได้ว่ารับหมวดไหน (push_prefs เก็บเฉพาะหมวดที่ปิด) · เครื่องที่เลิกรับ (404/410) ลบทิ้งเอง
   ============================================================ */

const TH = 7 * 3600 * 1000;

/* หมวดที่ผู้ใช้เลือกได้ — ลำดับนี้คือลำดับในแผงตั้งค่า */
export const PUSH_KINDS = [
  { k: "assign",  th: "งานใหม่ / มอบงานให้ฉัน",          desc: "มีคนสั่งงานหรือเปลี่ยนให้เรารับผิดชอบ" },
  { k: "mention", th: "มีคนแท็กถึงฉัน",                  desc: "@ชื่อเราในคอมเมนต์" },
  { k: "review",  th: "งานส่งมาให้ตรวจ",                 desc: "ทีมกดส่งงานให้ตรวจ" },
  { k: "result",  th: "ผลตรวจงานของฉัน",                 desc: "ตรวจผ่าน หรือส่งกลับแก้" },
  { k: "update",  th: "ทีมอัปเดตงาน",                    desc: "เปลี่ยนสถานะ · คอมเมนต์ · แนบไฟล์ · ขอเลื่อนกำหนด" },
  { k: "due",     th: "งานใกล้ถึงกำหนด",                 desc: "เตือนก่อนถึงกำหนดส่ง 1 ชั่วโมง" },
  { k: "overdue", th: "สรุปงานเลยกำหนด ทุกเช้า 09:00",   desc: "งานของเราที่เลยกำหนดแล้วยังไม่เสร็จ" },
  { k: "lead",    th: "ลีดใหม่",                          desc: "ลูกค้าทักเข้ามาใหม่ในหน้าลีด", crm: true },
];
const KIND_KEYS = PUSH_KINDS.map((x) => x.k);

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS task_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS push_subs (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE, " +
    "p256dh TEXT NOT NULL, auth TEXT NOT NULL, ua TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, " +
    "last_ok_at TEXT, fails INTEGER NOT NULL DEFAULT 0)",
  "CREATE INDEX IF NOT EXISTS idx_push_subs_staff ON push_subs(staff_id)",
  "CREATE TABLE IF NOT EXISTS push_prefs (staff_id TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY (staff_id, kind))",
  "CREATE TABLE IF NOT EXISTS push_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id TEXT NOT NULL, kind TEXT NOT NULL, " +
    "ref TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', " +
    "created_at TEXT NOT NULL, claim TEXT, claimed_at TEXT, tries INTEGER NOT NULL DEFAULT 0, sent_at TEXT, result TEXT)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_push_outbox_once ON push_outbox(kind, ref, staff_id)",
  "CREATE INDEX IF NOT EXISTS idx_push_outbox_open ON push_outbox(sent_at, claim)",
];

let ready = null;
export function ensurePushSchema(db) {
  if (!ready) {
    ready = (async () => {
      await db.batch(SCHEMA.map((s) => db.prepare(s)));
      /* เริ่มนับจากตอนเปิดระบบนี้ — ไม่งั้นแจ้งเตือนเก่าในกล่องเด้งพรวดเดียวหลายร้อยอัน */
      await db.prepare("INSERT OR IGNORE INTO task_settings (key, value) VALUES ('push_since', ?)").bind(new Date().toISOString()).run();
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/* ---------- WebCrypto web push (RFC 8291 aes128gcm + RFC 8292 VAPID) — พอร์ตจาก m-crm src/lib/push/webpush.ts ---------- */
function b64u(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(text) {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
const utf8 = (t) => new TextEncoder().encode(t);
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}
async function encryptPayload(payload, sub) {
  const uaPublic = unb64u(sub.p256dh);
  const authSecret = unb64u(sub.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, serverKeys.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(utf8("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}
async function vapidHeader(endpoint, vapid) {
  const header = b64u(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapid.subject })));
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(header + "." + claims)));
  return "vapid t=" + header + "." + claims + "." + b64u(sig) + ", k=" + vapid.publicKey;
}
async function sendPush(sub, message, vapid) {
  const body = await encryptPayload(utf8(JSON.stringify(message)), sub);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: { authorization: await vapidHeader(sub.endpoint, vapid), "content-encoding": "aes128gcm",
               "content-type": "application/octet-stream", ttl: "86400", urgency: "high" },
    body,
  });
  if (res.ok) return { ok: true };
  const text = await res.text().catch(() => "");
  return { ok: false, status: res.status, gone: res.status === 404 || res.status === 410, error: text.slice(0, 200) };
}

/* คีย์ VAPID สร้างครั้งแรกแล้วเก็บใน D1 (task_settings) — ห้ามเปลี่ยนภายหลัง ไม่งั้นทุกเครื่องต้องสมัครใหม่ */
let vapidCache = null;
async function loadVapid(db) {
  if (vapidCache) return vapidCache;
  const row = await db.prepare("SELECT value FROM task_settings WHERE key = 'push_vapid'").first();
  if (row) return (vapidCache = JSON.parse(row.value));
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const v = {
    publicKey: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey))),
    privateJwk: await crypto.subtle.exportKey("jwk", kp.privateKey),
    subject: "https://admin.kan-hub.com",
  };
  /* สองคำขอพร้อมกัน → ใครเขียนก่อนชนะ แล้วอ่านกลับมาใช้ชุดเดียวกัน */
  await db.prepare("INSERT OR IGNORE INTO task_settings (key, value) VALUES ('push_vapid', ?)").bind(JSON.stringify(v)).run();
  const back = await db.prepare("SELECT value FROM task_settings WHERE key = 'push_vapid'").first();
  return (vapidCache = JSON.parse(back.value));
}

/* ---------- กวาดเหตุการณ์ลงคิว ---------- */
function thNow() { return new Date(Date.now() + TH); }
async function sinceIso(db) {
  const r = await db.prepare("SELECT value FROM task_settings WHERE key = 'push_since'").first();
  const since = r ? r.value : new Date().toISOString();
  /* ดูย้อนไม่เกิน 1 วัน — ระบบล่มนานแล้วกลับมาไม่ควรยิงของเก่า */
  const floor = new Date(Date.now() - 86400000).toISOString();
  return since > floor ? since : floor;
}
function clip(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

async function collect(db) {
  const since = await sinceIso(db);
  const now = new Date().toISOString();
  const st = [];
  /* 1) ของในกล่องแจ้งเตือน → แยกหมวดจากคำนำหน้าที่ worker-tasks เขียนไว้
     ใช้ instr() ไม่ใช่ LIKE — D1 จำกัดแพตเทิร์น LIKE 50 ไบต์ ภาษาไทยตัวละ 3 ไบต์ ยาวเกินแล้วพังทั้งรอบ */
  st.push(db.prepare(
    "INSERT OR IGNORE INTO push_outbox (staff_id, kind, ref, title, body, url, created_at) " +
    "SELECT m.staff_id, " +
    "CASE WHEN instr(m.note, 'มอบหมายงานให้คุณ:') = 1 OR instr(m.note, 'เปลี่ยนคนรับผิดชอบเป็น') = 1 THEN 'assign' " +
    "     WHEN instr(m.note, 'แท็กถึงคุณ:') = 1 THEN 'mention' " +
    "     WHEN instr(m.note, 'ส่งงานให้ตรวจ:') = 1 THEN 'review' " +
    "     WHEN instr(m.note, 'ตรวจผ่านแล้ว:') = 1 OR instr(m.note, 'ส่งกลับแก้:') = 1 THEN 'result' " +
    "     ELSE 'update' END, " +
    "'m:' || m.id, COALESCE(s.name, 'ทีม KAN'), m.note, '/tasks/#/task/' || m.task_id, ? " +
    "FROM task_mentions m LEFT JOIN staff s ON s.id = m.by_staff WHERE m.created_at > ?"
  ).bind(now, since));
  /* 2) งานใหม่ที่สั่งมา — ไม่นับงานย่อยตามขั้นป้าย (งานเดียวแตก 6 ขั้น จะเด้ง 6 ที) และไม่เด้งหาคนที่สั่งเอง */
  st.push(db.prepare(
    "INSERT OR IGNORE INTO push_outbox (staff_id, kind, ref, title, body, url, created_at) " +
    "SELECT a.staff_id, 'assign', 't:' || t.id, 'งานใหม่ถึงคุณ', t.title || CASE WHEN s.name IS NOT NULL THEN ' · สั่งโดย ' || s.name ELSE '' END, " +
    "'/tasks/#/task/' || t.id, ? FROM tasks t JOIN task_assignees a ON a.task_id = t.id LEFT JOIN staff s ON s.id = t.created_by " +
    "WHERE t.created_at > ? AND a.staff_id != t.created_by AND t.stage IS NULL AND t.status != 'done'"
  ).bind(now, since));
  /* 3) ลีดใหม่ → หัวหน้า + คนที่มีสิทธิ์หน้าลีด · ลีดจากหน้าเว็บสาธารณะบันทึก created_by เป็นหัวหน้า
     เลยยกเว้นคนพิมพ์ลีดเองเฉพาะคนที่ไม่ใช่หัวหน้า */
  st.push(db.prepare(
    "INSERT OR IGNORE INTO push_outbox (staff_id, kind, ref, title, body, url, created_at) " +
    "SELECT s.id, 'lead', 'l:' || l.id, 'ลีดใหม่: ' || l.name, " +
    "TRIM(COALESCE(NULLIF(l.interest, ''), '') || CASE WHEN l.branch != '' THEN ' · ' || l.branch ELSE '' END || " +
    "CASE WHEN l.source_detail != '' THEN ' · ' || l.source_detail ELSE '' END), '/tasks/#/lead/' || l.id, ? " +
    "FROM leads l JOIN staff s ON s.active = 1 AND (s.role = 'owner' OR (',' || COALESCE(s.sections, '') || ',') LIKE '%,crm,%') " +
    "WHERE l.created_at > ? AND l.source != 'import' AND (s.id != l.created_by OR s.role = 'owner')"
  ).bind(now, since));
  /* 4) ใกล้ถึงกำหนด 1 ชม. — ref ผูกกับเวลากำหนด เลื่อนกำหนดแล้วจะเตือนใหม่ · งานประจำไม่เตือน (วันละรอบจะรก) */
  const inHour = new Date(Date.now() + 3600000).toISOString();
  st.push(db.prepare(
    "INSERT OR IGNORE INTO push_outbox (staff_id, kind, ref, title, body, url, created_at) " +
    "SELECT a.staff_id, 'due', 'd:' || t.id || '@' || t.due_at, 'ใกล้ถึงกำหนดใน 1 ชม.', t.title, '/tasks/#/task/' || t.id, ? " +
    "FROM tasks t JOIN task_assignees a ON a.task_id = t.id " +
    "WHERE t.due_at > ? AND t.due_at <= ? AND t.status NOT IN ('done', 'review') AND COALESCE(t.repeat, '') = ''"
  ).bind(now, now, inHour));
  await db.batch(st);

  /* 5) สรุปงานเลยกำหนด เช้า 09:00–11:59 (เลยช่วงนี้ไม่ส่งย้อน) คนละ 1 แจ้งเตือนต่อวัน */
  const t = thNow();
  const h = t.getUTCHours();
  if (h >= 9 && h < 12) {
    const day = t.toISOString().slice(0, 10);
    const rows = await db.prepare(
      "SELECT a.staff_id, COUNT(*) AS n, GROUP_CONCAT(t.title, ' · ') AS titles FROM tasks t JOIN task_assignees a ON a.task_id = t.id " +
      "WHERE t.due_at IS NOT NULL AND t.due_at < ? AND t.status NOT IN ('done', 'review') AND COALESCE(t.repeat, '') = '' AND t.stage IS NULL GROUP BY a.staff_id"
    ).bind(now).all();
    const ins = (rows.results || []).map((r) => db.prepare(
      "INSERT OR IGNORE INTO push_outbox (staff_id, kind, ref, title, body, url, created_at) VALUES (?, 'overdue', ?, ?, ?, '/tasks/#/me', ?)"
    ).bind(r.staff_id, "o:" + day, "งานเลยกำหนด " + r.n + " งาน", clip(r.titles, 160), now));
    if (ins.length) await db.batch(ins);
  }
}

/* ---------- ส่ง ---------- */
async function dispatch(db) {
  const summary = { sent: 0, muted: 0, noDevice: 0, failed: 0, removed: 0 };
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  /* คิวที่ค้างเพราะรอบก่อนตายกลางทาง (เกิน 5 นาที) ปล่อยให้ส่งใหม่ */
  await db.prepare("UPDATE push_outbox SET claim = NULL WHERE sent_at IS NULL AND claim IS NOT NULL AND claimed_at < ?")
    .bind(new Date(Date.now() - 300000).toISOString()).run();
  /* จองแถวแบบคำสั่งเดียว — D1 เขียนทีละคำสั่ง สองรอบพร้อมกันจึงไม่ได้แถวเดียวกัน */
  await db.prepare(
    "UPDATE push_outbox SET claim = ?, claimed_at = ?, tries = tries + 1 WHERE id IN " +
    "(SELECT id FROM push_outbox WHERE sent_at IS NULL AND claim IS NULL AND tries < 5 ORDER BY id LIMIT 40)"
  ).bind(token, now).run();
  const rows = (await db.prepare("SELECT * FROM push_outbox WHERE claim = ? ORDER BY id").bind(token).all()).results || [];
  if (!rows.length) return summary;

  const staffIds = [...new Set(rows.map((r) => r.staff_id))];
  const ph = staffIds.map(() => "?").join(",");
  const subs = (await db.prepare("SELECT * FROM push_subs WHERE staff_id IN (" + ph + ")").bind(...staffIds).all()).results || [];
  const off = (await db.prepare("SELECT staff_id, kind FROM push_prefs WHERE staff_id IN (" + ph + ")").bind(...staffIds).all()).results || [];
  const muted = new Set(off.map((x) => x.staff_id + "|" + x.kind));
  const vapid = await loadVapid(db);

  for (const row of rows) {
    const done = (result) => db.prepare("UPDATE push_outbox SET sent_at = ?, result = ?, claim = NULL WHERE id = ?")
      .bind(new Date().toISOString(), result, row.id).run();
    if (row.kind !== "test" && muted.has(row.staff_id + "|" + row.kind)) { await done("muted"); summary.muted++; continue; }
    const devices = subs.filter((s) => s.staff_id === row.staff_id);
    if (!devices.length) { await done("no_device"); summary.noDevice++; continue; }
    const msg = { title: row.title, body: row.body, url: row.url || "/tasks/#/inbox", tag: row.kind + "-" + row.id };
    let ok = 0;
    const errs = [];
    for (const d of devices) {
      const r = await sendPush(d, msg, vapid).catch((e) => ({ ok: false, status: 0, gone: false, error: String(e && e.message || e) }));
      if (r.ok) {
        ok++;
        await db.prepare("UPDATE push_subs SET last_ok_at = ?, fails = 0 WHERE id = ?").bind(new Date().toISOString(), d.id).run();
      } else if (r.gone) {
        /* เครื่องนี้เลิกรับแล้ว (ลบแอป/ปิดสิทธิ์) */
        await db.prepare("DELETE FROM push_subs WHERE id = ?").bind(d.id).run();
        summary.removed++;
      } else {
        errs.push((r.status + " " + r.error).trim());
        /* พังติดกัน 20 ครั้ง = เครื่องนี้ใช้ไม่ได้แล้ว */
        await db.prepare("UPDATE push_subs SET fails = fails + 1 WHERE id = ?").bind(d.id).run();
        await db.prepare("DELETE FROM push_subs WHERE id = ? AND fails >= 20").bind(d.id).run();
      }
    }
    if (ok || !errs.length) { await done(ok ? "delivered:" + ok : "no_device"); if (ok) summary.sent++; else summary.noDevice++; }
    else {
      /* ส่งไม่ออกเลย → ปล่อยคิวให้รอบหน้าลองใหม่ (สูงสุด 5 ครั้ง) */
      await db.prepare("UPDATE push_outbox SET claim = NULL, result = ? WHERE id = ?").bind(errs.join(" | ").slice(0, 400), row.id).run();
      summary.failed++;
    }
  }
  return summary;
}

let lastTick = 0;
/* เรียกได้บ่อย ๆ — ช่วง 1 วิเดียวกันใน isolate เดียวทำรอบเดียวพอ · ห้ามโยน error ออกไปพังคำขอหลัก */
export async function pushTick(env, force) {
  const db = env.KAN_ERP;
  if (!db) return null;
  if (!force && Date.now() - lastTick < 1000) return null;
  lastTick = Date.now();
  try {
    await ensurePushSchema(db);
    await collect(db);
    const s = await dispatch(db);
    /* เก็บประวัติคิว 30 วันพอ */
    if (Math.random() < 0.05) {
      await db.prepare("DELETE FROM push_outbox WHERE sent_at IS NOT NULL AND sent_at < ?")
        .bind(new Date(Date.now() - 30 * 86400000).toISOString()).run();
    }
    return s;
  } catch (e) {
    console.error("pushTick:", e && e.message);
    return null;
  }
}

/* ---------- API /api/t/push/* (ต้องล็อกอิน) ---------- */
function jres(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function kindsFor(me) {
  const secs = String(me.sections || "").split(",");
  return PUSH_KINDS.filter((x) => !x.crm || me.role === "owner" || secs.indexOf("crm") !== -1);
}
export async function handlePushApi(request, env, path, method, me, ctx) {
  const db = env.KAN_ERP;
  await ensurePushSchema(db);
  const body = method === "GET" ? {} : await request.json().catch(() => ({}));

  if (path === "/push" && method === "GET") {
    const v = await loadVapid(db);
    const off = (await db.prepare("SELECT kind FROM push_prefs WHERE staff_id = ?").bind(me.id).all()).results || [];
    const n = await db.prepare("SELECT COUNT(*) AS n FROM push_subs WHERE staff_id = ?").bind(me.id).first();
    const offSet = new Set(off.map((x) => x.kind));
    return jres({
      publicKey: v.publicKey,
      devices: n ? n.n : 0,
      kinds: kindsFor(me).map((x) => ({ k: x.k, th: x.th, desc: x.desc, on: !offSet.has(x.k) })),
    });
  }
  if (path === "/push/prefs" && method === "PUT") {
    const k = String(body.kind || "");
    if (KIND_KEYS.indexOf(k) === -1) return jres({ error: "ไม่รู้จักหมวดนี้" }, 400);
    if (body.on) await db.prepare("DELETE FROM push_prefs WHERE staff_id = ? AND kind = ?").bind(me.id, k).run();
    else await db.prepare("INSERT OR IGNORE INTO push_prefs (staff_id, kind) VALUES (?, ?)").bind(me.id, k).run();
    return jres({ ok: true });
  }
  if (path === "/push/subscribe" && method === "POST") {
    const ep = String(body.endpoint || "");
    const keys = body.keys || {};
    if (!/^https:\/\//.test(ep) || ep.length > 1000 || !keys.p256dh || !keys.auth) return jres({ error: "ข้อมูลเครื่องไม่ครบ" }, 400);
    /* เครื่องเดิมเปลี่ยนคนล็อกอิน → ย้ายไปเป็นของคนใหม่ (endpoint UNIQUE) */
    await db.prepare(
      "INSERT INTO push_subs (id, staff_id, endpoint, p256dh, auth, ua, created_at) VALUES (?,?,?,?,?,?,?) " +
      "ON CONFLICT(endpoint) DO UPDATE SET staff_id = excluded.staff_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, fails = 0"
    ).bind("ps_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16), me.id, ep, String(keys.p256dh).slice(0, 200),
           String(keys.auth).slice(0, 100), String(body.ua || "").slice(0, 160), new Date().toISOString()).run();
    return jres({ ok: true });
  }
  if (path === "/push/unsubscribe" && method === "POST") {
    await db.prepare("DELETE FROM push_subs WHERE endpoint = ? AND staff_id = ?").bind(String(body.endpoint || ""), me.id).run();
    return jres({ ok: true });
  }
  if (path === "/push/test" && method === "POST") {
    const ref = "x:" + crypto.randomUUID();
    await db.prepare("INSERT INTO push_outbox (staff_id, kind, ref, title, body, url, created_at) VALUES (?, 'test', ?, ?, ?, '/tasks/#/inbox', ?)")
      .bind(me.id, ref, "ทดสอบแจ้งเตือน KAN Admin", "ถ้าเห็นข้อความนี้ = เครื่องนี้รับแจ้งเตือนได้แล้ว", new Date().toISOString()).run();
    await dispatch(db);
    const r = await db.prepare("SELECT result FROM push_outbox WHERE ref = ?").bind(ref).first();
    return jres({ ok: true, result: r ? r.result : null });
  }
  return jres({ error: "ไม่พบ" }, 404);
}
