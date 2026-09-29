/* ============================================================
   แชทรวม LINE OA (นนท์ 29 ก.ย. 69) — แบบ Zaapi / Pancake
   - webhook รายเพจ: POST /api/line/webhook/<channelId>  (ตรวจลายเซ็นด้วย channel secret)
   - กล่องแชทให้พนักงานตอบ: /api/t/chat/*  (ต้องมีสิทธิ์เมนู "แชทลูกค้า")
   - รูปในแชท: /api/chat/media/<key>  (key สุ่ม 32 ตัว — LINE ต้องดึงรูปที่เราส่งจาก URL สาธารณะได้)
   เพจที่ยังไม่ได้ใส่ token = โหมดจำลอง: บันทึกครบทุกอย่าง แต่ไม่มีข้อความออกไปหาลูกค้าจริง
   รูปเก็บใน R2 (binding CHAT_MEDIA) ถ้ามี · ยังไม่เปิด R2 = เก็บใน D1 ตาราง chat_media ไปก่อน
   ============================================================ */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function nowIso() { return new Date().toISOString(); }
function hex(buf) { return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
function randKey(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); }
function newId(p) { return p + randKey(8); }
async function readBody(request) { try { return await request.json(); } catch (e) { return {}; } }

const CHAT_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS chat_convos (" +
    "id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, line_user_id TEXT NOT NULL, " +
    "display_name TEXT NOT NULL DEFAULT '', picture_url TEXT NOT NULL DEFAULT '', " +
    /* new = ทักมายังไม่มีใครตอบ · open = กำลังคุย ข้อความล่าสุดเป็นของลูกค้า (ค้างตอบ) · waiting = ตอบแล้ว รอลูกค้า · closed = ปิดเคส */
    "status TEXT NOT NULL DEFAULT 'new', assignee TEXT, " +
    "last_msg_at TEXT, last_msg_text TEXT NOT NULL DEFAULT '', last_from TEXT NOT NULL DEFAULT 'cust', " +
    "unread INTEGER NOT NULL DEFAULT 0, waiting_since TEXT, " +
    "reply_token TEXT NOT NULL DEFAULT '', reply_token_at TEXT, " +
    "tags TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', lead_id TEXT, " +
    "first_contact_at TEXT NOT NULL, closed_at TEXT, blocked INTEGER NOT NULL DEFAULT 0, mock INTEGER NOT NULL DEFAULT 0, " +
    "created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_convo_user ON chat_convos(channel_id, line_user_id)",
  "CREATE INDEX IF NOT EXISTS idx_chat_convo_last ON chat_convos(status, last_msg_at DESC)",
  "CREATE TABLE IF NOT EXISTS chat_msgs (" +
    "id TEXT PRIMARY KEY, convo_id TEXT NOT NULL, dir TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'text', " +
    "text TEXT NOT NULL DEFAULT '', media_key TEXT NOT NULL DEFAULT '', sticker TEXT NOT NULL DEFAULT '', " +
    "line_msg_id TEXT NOT NULL DEFAULT '', staff_id TEXT, sent_via TEXT NOT NULL DEFAULT '', " +
    "status TEXT NOT NULL DEFAULT 'ok', error TEXT NOT NULL DEFAULT '', mock INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_chat_msgs_convo ON chat_msgs(convo_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_chat_msgs_time ON chat_msgs(created_at)",
  "CREATE TABLE IF NOT EXISTS chat_media (key TEXT PRIMARY KEY, mime TEXT NOT NULL, data TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS chat_replies (id TEXT PRIMARY KEY, title TEXT NOT NULL, text TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)",
];
const CHAT_MIGRATIONS = [
  /* เพจไหนเข้ากล่องแชท (บรอดแคสต์ใช้ตารางเพจเดียวกัน) */
  "ALTER TABLE line_channels ADD COLUMN chat INTEGER NOT NULL DEFAULT 0",
];

let chatReady = false;
export async function ensureChatSchema(db) {
  if (chatReady) return;
  await db.batch(CHAT_SCHEMA.map((s) => db.prepare(s)));
  for (const m of CHAT_MIGRATIONS) { try { await db.prepare(m).run(); } catch (e) { /* มีแล้ว */ } }
  /* นนท์ 29 ก.ย. 69: ต่อหลัก ๆ 3 LINE — Kan Store · Kan Hub · Kan Fashion (ตั้งครั้งเดียว) */
  const flag = await db.prepare("SELECT value FROM task_settings WHERE key = 'chat_channels_v1'").first().catch(() => null);
  if (!flag) {
    const now = nowIso();
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO line_channels (id,name,basic_id,color,page_id,note,active,sort,created_at,chat) VALUES ('ch_kstore','Kan Store','','#E8412C','pg_kst3','เพจหลักของ Kan Store (แชทรวม)',1,-1,?,1)").bind(now),
      db.prepare("UPDATE line_channels SET chat = 1 WHERE id IN ('ch_kstore','ch_hub','ch_fashion')"),
      db.prepare("INSERT OR REPLACE INTO task_settings (key,value) VALUES ('chat_channels_v1', ?)").bind(now),
    ]);
  }
  chatReady = true;
}

/* ---------- ที่เก็บรูป: R2 ถ้าเปิดแล้ว ไม่งั้น D1 ---------- */
async function saveMedia(env, db, bytes, mime) {
  const key = randKey(16);
  if (env.CHAT_MEDIA) {
    await env.CHAT_MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });
  } else {
    if (bytes.byteLength > 1400000) throw new Error("รูปใหญ่เกิน (ยังไม่ได้เปิด R2 เก็บได้ไม่เกิน ~1.4MB ต่อรูป)");
    let bin = ""; const u8 = new Uint8Array(bytes);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    await db.prepare("INSERT INTO chat_media (key,mime,data,size,created_at) VALUES (?,?,?,?,?)").bind(key, mime, btoa(bin), u8.length, nowIso()).run();
  }
  return key;
}
export async function serveChatMedia(env, key) {
  if (!/^[0-9a-f]{32}$/.test(key)) return new Response("not found", { status: 404 });
  const hdr = { "cache-control": "public, max-age=31536000, immutable" };
  if (env.CHAT_MEDIA) {
    const o = await env.CHAT_MEDIA.get(key);
    if (o) return new Response(o.body, { headers: Object.assign({ "content-type": (o.httpMetadata && o.httpMetadata.contentType) || "image/jpeg" }, hdr) });
  }
  const db = env.KAN_ERP;
  await ensureChatSchema(db);
  const r = await db.prepare("SELECT mime, data FROM chat_media WHERE key = ?").bind(key).first();
  if (!r) return new Response("not found", { status: 404 });
  const bin = atob(r.data), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Response(u8, { headers: Object.assign({ "content-type": r.mime }, hdr) });
}

/* ---------- LINE API ---------- */
async function lineFetch(ch, url, init) {
  const r = await fetch(url, Object.assign({}, init, { headers: Object.assign({ authorization: "Bearer " + ch.token }, (init && init.headers) || {}) }));
  return r;
}
async function lineProfile(ch, userId) {
  if (!ch.token) return null;
  try {
    const r = await lineFetch(ch, "https://api.line.me/v2/bot/profile/" + encodeURIComponent(userId));
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}
/* reply token ใช้ได้ครั้งเดียวและอายุสั้น — ตอบภายใน 50 วิหลังลูกค้าทักใช้ reply (ฟรี) เกินกว่านั้นใช้ push (นับโควตา) */
async function lineSend(ch, convo, messages) {
  if (!ch.token) return { via: "mock", ok: true };
  const fresh = convo.reply_token && convo.reply_token_at && (Date.now() - Date.parse(convo.reply_token_at) < 50000);
  const body = fresh ? { replyToken: convo.reply_token, messages } : { to: convo.line_user_id, messages };
  const r = await lineFetch(ch, "https://api.line.me/v2/bot/message/" + (fresh ? "reply" : "push"), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (r.ok) return { via: fresh ? "reply" : "push", ok: true, usedReply: fresh };
  const t = await r.text().catch(() => "");
  /* reply token หมดอายุระหว่างทาง → ลองใหม่ด้วย push */
  if (fresh && r.status === 400) {
    const r2 = await lineFetch(ch, "https://api.line.me/v2/bot/message/push", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: convo.line_user_id, messages }),
    });
    if (r2.ok) return { via: "push", ok: true, usedReply: true };
    return { via: "push", ok: false, error: (await r2.text().catch(() => "")).slice(0, 300) || ("HTTP " + r2.status), usedReply: true };
  }
  return { via: fresh ? "reply" : "push", ok: false, error: t.slice(0, 300) || ("HTTP " + r.status) };
}
async function verifySig(secret, body, sig) {
  if (!secret || !sig) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  let bin = ""; for (let i = 0; i < mac.length; i++) bin += String.fromCharCode(mac[i]);
  return btoa(bin) === sig;
}

/* ---------- บันทึกข้อความขาเข้า (ใช้ทั้ง webhook จริงและโหมดจำลอง) ---------- */
function preview(kind, text) {
  if (kind === "text") return String(text || "").slice(0, 200);
  return { image: "[รูปภาพ]", sticker: "[สติกเกอร์]", video: "[วิดีโอ]", audio: "[เสียง]", file: "[ไฟล์]", location: "[ตำแหน่ง]" }[kind] || "[ข้อความ]";
}
async function upsertConvo(db, chId, userId, prof, at, mock) {
  let c = await db.prepare("SELECT * FROM chat_convos WHERE channel_id = ? AND line_user_id = ?").bind(chId, userId).first();
  if (c) {
    if (prof && (prof.displayName || prof.pictureUrl)) {
      await db.prepare("UPDATE chat_convos SET display_name = ?, picture_url = ? WHERE id = ?")
        .bind(prof.displayName || c.display_name, prof.pictureUrl || c.picture_url, c.id).run();
    }
    return c;
  }
  const id = newId("cv_");
  await db.prepare("INSERT INTO chat_convos (id,channel_id,line_user_id,display_name,picture_url,status,first_contact_at,last_msg_at,mock,created_at,updated_at) VALUES (?,?,?,?,?,'new',?,?,?,?,?)")
    .bind(id, chId, userId, (prof && prof.displayName) || "ลูกค้า LINE", (prof && prof.pictureUrl) || "", at, at, mock ? 1 : 0, at, at).run();
  return await db.prepare("SELECT * FROM chat_convos WHERE id = ?").bind(id).first();
}
async function recordInbound(env, db, ch, c, m, ctx) {
  const at = m.at || nowIso();
  await db.prepare("INSERT INTO chat_msgs (id,convo_id,dir,kind,text,media_key,sticker,line_msg_id,mock,created_at) VALUES (?,?,'in',?,?,?,?,?,?,?)")
    .bind(newId("cm_"), c.id, m.kind, m.text || "", m.mediaKey || "", m.sticker || "", m.lineMsgId || "", m.mock ? 1 : 0, at).run();
  /* ลูกค้าทักมา: ปิดไปแล้ว → เปิดเคสใหม่ · รอลูกค้าอยู่ → กลับมาค้างตอบ */
  const needs = c.status === "waiting" || c.status === "closed" || c.last_from !== "cust";
  const status = c.status === "closed" ? (c.assignee ? "open" : "new") : (c.status === "waiting" ? "open" : c.status);
  await db.prepare("UPDATE chat_convos SET status = ?, last_msg_at = ?, last_msg_text = ?, last_from = 'cust', unread = unread + 1, " +
    "waiting_since = CASE WHEN last_from = 'cust' AND waiting_since IS NOT NULL AND status != 'closed' THEN waiting_since ELSE ? END, " +
    "reply_token = ?, reply_token_at = ?, closed_at = NULL, updated_at = ? WHERE id = ?")
    .bind(status, at, preview(m.kind, m.text), at, m.replyToken || "", m.replyToken ? at : null, at, c.id).run();
  /* แจ้งเตือนมือถือเฉพาะตอนเคสเพิ่งกลายเป็น "ค้างตอบ" ไม่ใช่ทุกข้อความ (ลูกค้าพิมพ์ 5 บรรทัดจะได้ไม่เด้ง 5 ครั้ง) */
  if (needs) {
    try {
      let to = [];
      if (c.assignee) to = [c.assignee];
      else {
        const rs = (await db.prepare("SELECT id, role, sections, perms FROM staff WHERE active = 1 AND pending = 0").all()).results || [];
        to = rs.filter((r) => r.role === "owner" ? false : canChat(r) === "edit").map((r) => r.id);
      }
      if (to.length) {
        await db.batch(to.map((sid) => db.prepare(
          "INSERT OR IGNORE INTO push_outbox (staff_id, kind, ref, title, body, url, created_at) VALUES (?, 'chat', ?, ?, ?, ?, ?)"
        ).bind(sid, "c:" + c.id + ":" + at, "แชทใหม่ · " + (ch.name || "LINE") + " · " + (c.display_name || "ลูกค้า"), preview(m.kind, m.text).slice(0, 120), "/tasks/#/chat/" + c.id, at)));
      }
    } catch (e) { /* แจ้งเตือนพังไม่ควรทำให้รับข้อความไม่ได้ */ }
  }
}
function canChat(r) {
  let p = null;
  try { p = r.perms ? JSON.parse(r.perms) : null; } catch (e) { p = null; }
  if (p && p.chat) return p.chat;
  return String(r.sections || "").split(",").indexOf("chat") !== -1 ? "edit" : "none";
}

/* ---------- webhook สาธารณะ ---------- */
export async function handleLineWebhook(request, env, ctx, chId) {
  const db = env.KAN_ERP;
  await ensureChatSchema(db);
  if (request.method !== "POST") return new Response("ok");
  const ch = await db.prepare("SELECT * FROM line_channels WHERE id = ?").bind(chId).first();
  if (!ch) return new Response("unknown channel", { status: 404 });
  const raw = await request.text();
  if (!(await verifySig(ch.secret, raw, request.headers.get("x-line-signature") || ""))) return new Response("bad signature", { status: 401 });
  let body = {};
  try { body = JSON.parse(raw); } catch (e) { return new Response("ok"); }
  const work = (async () => {
    for (const ev of body.events || []) {
      const uid = ev.source && ev.source.userId;
      if (!uid || (ev.source.type && ev.source.type !== "user")) continue;
      const at = new Date(ev.timestamp || Date.now()).toISOString();
      if (ev.type === "follow" || ev.type === "unfollow") {
        const prof = ev.type === "follow" ? await lineProfile(ch, uid) : null;
        /* ผู้ติดตามจริง → ตาราง line_users ของระบบบรอดแคสต์ (ยิงรายคนได้) */
        await db.prepare("INSERT INTO line_users (id,channel_id,display_name,followed_at,last_active,blocked) VALUES (?,?,?,?,?,?) " +
          "ON CONFLICT(id) DO UPDATE SET blocked = excluded.blocked, display_name = CASE WHEN excluded.display_name != '' THEN excluded.display_name ELSE line_users.display_name END")
          .bind(uid + ":" + ch.id, ch.id, (prof && prof.displayName) || "", at, at, ev.type === "unfollow" ? 1 : 0).run().catch(() => {});
        if (ev.type === "unfollow") await db.prepare("UPDATE chat_convos SET blocked = 1 WHERE channel_id = ? AND line_user_id = ?").bind(ch.id, uid).run();
        continue;
      }
      if (ev.type !== "message" || !ev.message) continue;
      const msg = ev.message;
      let c = await db.prepare("SELECT * FROM chat_convos WHERE channel_id = ? AND line_user_id = ?").bind(ch.id, uid).first();
      if (!c || !c.picture_url || c.display_name === "ลูกค้า LINE") c = await upsertConvo(db, ch.id, uid, await lineProfile(ch, uid), at, false);
      const m = { kind: msg.type, text: msg.text || "", lineMsgId: msg.id, replyToken: ev.replyToken, at };
      if (msg.type === "sticker") m.sticker = String(msg.stickerId || "");
      if (msg.type === "location") m.text = [msg.title, msg.address].filter(Boolean).join(" · ") + (msg.latitude ? " https://maps.google.com/?q=" + msg.latitude + "," + msg.longitude : "");
      if (msg.type === "image") {
        try {
          const r = await lineFetch(ch, "https://api-data.line.me/v2/bot/message/" + msg.id + "/content");
          if (r.ok) m.mediaKey = await saveMedia(env, db, await r.arrayBuffer(), r.headers.get("content-type") || "image/jpeg");
        } catch (e) { m.text = "(ดึงรูปไม่สำเร็จ)"; }
      }
      await recordInbound(env, db, ch, c, m, ctx);
      await db.prepare("UPDATE line_users SET last_active = ? WHERE id = ?").bind(at, uid + ":" + ch.id).run().catch(() => {});
    }
  })();
  /* LINE รอคำตอบไม่นาน — ตอบ 200 ทันที งานที่เหลือทำต่อเบื้องหลัง */
  if (ctx && ctx.waitUntil) ctx.waitUntil(work.catch(() => {})); else await work;
  return new Response("ok");
}

/* ---------- API หลังบ้าน /api/t/chat/* ---------- */
function convoOut(r) {
  return {
    id: r.id, channelId: r.channel_id, name: r.display_name, picture: r.picture_url, status: r.status, assignee: r.assignee || null,
    lastAt: r.last_msg_at, lastText: r.last_msg_text, lastFrom: r.last_from, unread: r.unread || 0, waitingSince: r.waiting_since,
    tags: r.tags ? r.tags.split(",").filter(Boolean) : [], note: r.note || "", phone: r.phone || "", leadId: r.lead_id || null,
    firstAt: r.first_contact_at, closedAt: r.closed_at, blocked: !!r.blocked, mock: !!r.mock,
  };
}
function msgOut(r) {
  return { id: r.id, dir: r.dir, kind: r.kind, text: r.text, media: r.media_key || "", sticker: r.sticker || "", staffId: r.staff_id || null,
           via: r.sent_via || "", status: r.status, error: r.error || "", mock: !!r.mock, at: r.created_at };
}
async function channelsOut(db, isOwner) {
  const rs = (await db.prepare("SELECT id,name,basic_id,color,token,secret,chat,sort FROM line_channels WHERE active = 1 ORDER BY sort, name").all()).results || [];
  return rs.map((c) => ({ id: c.id, name: c.name, basicId: c.basic_id, color: c.color, chat: !!c.chat, live: !!c.token,
                          hasSecret: !!c.secret, webhook: isOwner ? "/api/line/webhook/" + c.id : undefined }));
}

export async function handleChatApi(env, db, request, url, path, method, me, lvl, isOwner) {
  await ensureChatSchema(db);
  if (lvl === "none" && !isOwner) return json({ error: "ไม่มีสิทธิ์เมนูแชทลูกค้า" }, 403);
  const canEdit = isOwner || lvl === "edit";
  const now = nowIso();

  if (path === "/chat/convos" && method === "GET") {
    const tab = url.searchParams.get("tab") || "pending";
    const ch = url.searchParams.get("ch") || "";
    const q = (url.searchParams.get("q") || "").trim();
    const where = ["c.channel_id IN (SELECT id FROM line_channels WHERE chat = 1 AND active = 1)"], binds = [];
    if (tab === "pending") where.push("c.status IN ('new','open')");
    else if (tab === "new") where.push("c.status = 'new'");
    else if (tab === "waiting") where.push("c.status = 'waiting'");
    else if (tab === "closed") where.push("c.status = 'closed'");
    else if (tab === "mine") { where.push("c.assignee = ? AND c.status != 'closed'"); binds.push(me.id); }
    if (ch) { where.push("c.channel_id = ?"); binds.push(ch); }
    if (q) { where.push("(instr(lower(c.display_name), lower(?)) > 0 OR instr(c.phone, ?) > 0 OR instr(lower(c.tags), lower(?)) > 0)"); binds.push(q, q, q); }
    const order = tab === "pending" || tab === "new" ? "COALESCE(c.waiting_since, c.last_msg_at) ASC" : "c.last_msg_at DESC";
    const rs = (await db.prepare("SELECT c.* FROM chat_convos c WHERE " + where.join(" AND ") + " ORDER BY " + order + " LIMIT 300").bind(...binds).all()).results || [];
    const cnt = await db.prepare("SELECT " +
      "SUM(CASE WHEN status IN ('new','open') THEN 1 ELSE 0 END) pending, SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) nw, " +
      "SUM(CASE WHEN status='waiting' THEN 1 ELSE 0 END) waiting, SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) closed, " +
      "SUM(CASE WHEN assignee = ? AND status != 'closed' THEN 1 ELSE 0 END) mine, COUNT(*) total, SUM(mock) mock " +
      "FROM chat_convos WHERE channel_id IN (SELECT id FROM line_channels WHERE chat = 1 AND active = 1)").bind(me.id).first();
    return json({ convos: rs.map(convoOut), counts: { pending: cnt.pending || 0, new: cnt.nw || 0, waiting: cnt.waiting || 0, closed: cnt.closed || 0, mine: cnt.mine || 0, all: cnt.total || 0 },
                  mockCount: cnt.mock || 0, channels: await channelsOut(db, isOwner), canEdit, r2: !!env.CHAT_MEDIA });
  }

  const cm = path.match(/^\/chat\/convos\/([A-Za-z0-9_-]{1,40})(\/[a-z]+)?$/);
  if (cm) {
    const c = await db.prepare("SELECT * FROM chat_convos WHERE id = ?").bind(cm[1]).first();
    if (!c) return json({ error: "ไม่พบแชทนี้" }, 404);
    const sub = cm[2] || "";
    if (!sub && method === "GET") {
      const after = url.searchParams.get("after");
      const rs = after
        ? (await db.prepare("SELECT * FROM chat_msgs WHERE convo_id = ? AND created_at > ? ORDER BY created_at LIMIT 500").bind(c.id, after).all()).results || []
        : ((await db.prepare("SELECT * FROM chat_msgs WHERE convo_id = ? ORDER BY created_at DESC LIMIT 400").bind(c.id).all()).results || []).reverse();
      if (c.unread && canEdit) await db.prepare("UPDATE chat_convos SET unread = 0 WHERE id = ?").bind(c.id).run();
      const nMsg = await db.prepare("SELECT COUNT(*) n FROM chat_msgs WHERE convo_id = ?").bind(c.id).first();
      return json({ convo: convoOut(Object.assign({}, c, { unread: 0 })), msgs: rs.map(msgOut), total: nMsg ? nMsg.n : 0 });
    }
    if (!canEdit) return json({ error: "สิทธิ์ของคุณในแชทเป็นแบบดูอย่างเดียว" }, 403);

    if (sub === "/send" && method === "POST") {
      const body = await readBody(request);
      const text = String(body.text || "").trim().slice(0, 4900);
      let mediaKey = "";
      if (body.image) {
        const m = String(body.image).match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
        if (!m) return json({ error: "รูปต้องเป็น JPG หรือ PNG" }, 400);
        const bin = atob(m[2]), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        try { mediaKey = await saveMedia(env, db, u8.buffer, m[1]); } catch (e) { return json({ error: e.message }, 400); }
      }
      if (!text && !mediaKey) return json({ error: "ยังไม่ได้พิมพ์ข้อความ" }, 400);
      const ch = await db.prepare("SELECT * FROM line_channels WHERE id = ?").bind(c.channel_id).first();
      const origin = new URL(request.url).origin;
      const messages = [];
      if (mediaKey) messages.push({ type: "image", originalContentUrl: origin + "/api/chat/media/" + mediaKey, previewImageUrl: origin + "/api/chat/media/" + mediaKey });
      if (text) messages.push({ type: "text", text });
      const res = c.mock ? { via: "mock", ok: true } : await lineSend(ch || {}, c, messages);
      const stmts = [];
      const rows = [];
      if (mediaKey) rows.push({ kind: "image", text: "", media: mediaKey });
      if (text) rows.push({ kind: "text", text, media: "" });
      let t = Date.now();
      for (const r of rows) {
        const at = new Date(t++).toISOString();
        stmts.push(db.prepare("INSERT INTO chat_msgs (id,convo_id,dir,kind,text,media_key,staff_id,sent_via,status,error,mock,created_at) VALUES (?,?,'out',?,?,?,?,?,?,?,?,?)")
          .bind(newId("cm_"), c.id, r.kind, r.text, r.media, me.id, res.via, res.ok ? "ok" : "fail", res.error || "", res.via === "mock" ? 1 : 0, at));
      }
      if (res.ok) {
        /* ตอบแล้ว = รอลูกค้า · ยังไม่มีคนรับเคส → คนตอบรับไปเลย */
        stmts.push(db.prepare("UPDATE chat_convos SET status = 'waiting', last_msg_at = ?, last_msg_text = ?, last_from = 'staff', waiting_since = NULL, unread = 0, " +
          "assignee = COALESCE(assignee, ?), reply_token = CASE WHEN ? THEN '' ELSE reply_token END, updated_at = ? WHERE id = ?")
          .bind(now, preview(rows[rows.length - 1].kind, rows[rows.length - 1].text), me.id, res.usedReply ? 1 : 0, now, c.id));
      }
      await db.batch(stmts);
      if (!res.ok) return json({ error: "LINE ไม่รับข้อความ: " + (res.error || ""), failed: true }, 502);
      return json({ ok: true, via: res.via });
    }
    if (!sub && method === "PUT") {
      const body = await readBody(request);
      const sets = ["updated_at = ?"], vals = [now];
      if (body.assignee !== undefined) { sets.push("assignee = ?"); vals.push(body.assignee || null); if (body.assignee && c.status === "new") { sets.push("status = 'open'"); } }
      if (body.status !== undefined) {
        const st = String(body.status);
        if (["new", "open", "waiting", "closed"].indexOf(st) === -1) return json({ error: "สถานะไม่ถูกต้อง" }, 400);
        sets.push("status = ?", "closed_at = ?"); vals.push(st, st === "closed" ? now : null);
        if (st === "closed") sets.push("unread = 0");
      }
      if (body.tags !== undefined) { sets.push("tags = ?"); vals.push((Array.isArray(body.tags) ? body.tags : String(body.tags).split(",")).map((x) => String(x).trim().slice(0, 30)).filter(Boolean).slice(0, 12).join(",")); }
      if (body.note !== undefined) { sets.push("note = ?"); vals.push(String(body.note).slice(0, 2000)); }
      if (body.phone !== undefined) { sets.push("phone = ?"); vals.push(String(body.phone).replace(/[^0-9+\- ]/g, "").slice(0, 20)); }
      if (body.name !== undefined && String(body.name).trim()) { sets.push("display_name = ?"); vals.push(String(body.name).trim().slice(0, 80)); }
      await db.prepare("UPDATE chat_convos SET " + sets.join(", ") + " WHERE id = ?").bind(...vals, c.id).run();
      return json({ ok: true });
    }
    /* ส่งเข้าลีด (CRM) — สร้างลีดจากแชทนี้ ผูกกลับไว้ไม่ให้สร้างซ้ำ */
    if (sub === "/lead" && method === "POST") {
      if (c.lead_id) return json({ ok: true, id: c.lead_id, existed: true });
      const ch = await db.prepare("SELECT name FROM line_channels WHERE id = ?").bind(c.channel_id).first();
      const id = "ld_" + randKey(8);
      await db.batch([
        db.prepare("INSERT INTO leads (id,name,phone,line_id,source,source_detail,interest,branch,status,owner_id,est_value,bought_before,lost_reason,next_at,received_at,fb_name,created_by,created_at,updated_at,updated_by) " +
          "VALUES (?,?,?,?,'line',?,?,'', 'new', ?, 0, 0, '', NULL, ?, '', ?, ?, ?, ?)")
          .bind(id, c.display_name || "ลูกค้า LINE", c.phone || "", c.line_user_id, "แชท LINE · " + ((ch && ch.name) || ""), (c.note || "").slice(0, 300), me.id, c.first_contact_at, me.id, now, now, me.id),
        db.prepare("UPDATE chat_convos SET lead_id = ? WHERE id = ?").bind(id, c.id),
      ]);
      return json({ ok: true, id });
    }
    return json({ error: "ไม่รู้จักคำสั่ง" }, 404);
  }

  /* ข้อความสำเร็จรูป */
  if (path === "/chat/replies" && method === "GET") {
    const rs = (await db.prepare("SELECT * FROM chat_replies ORDER BY sort, created_at").all()).results || [];
    return json({ replies: rs.map((r) => ({ id: r.id, title: r.title, text: r.text })) });
  }
  if (path === "/chat/replies" && method === "PUT") {
    if (!canEdit) return json({ error: "ดูอย่างเดียว" }, 403);
    const body = await readBody(request);
    const list = (Array.isArray(body.replies) ? body.replies : []).slice(0, 60)
      .map((r, i) => ({ id: /^[A-Za-z0-9_-]{1,40}$/.test(String(r.id || "")) ? String(r.id) : newId("qr_"), title: String(r.title || "").trim().slice(0, 40), text: String(r.text || "").trim().slice(0, 2000), sort: i }))
      .filter((r) => r.title && r.text);
    await db.batch([db.prepare("DELETE FROM chat_replies")].concat(list.map((r) => db.prepare("INSERT INTO chat_replies (id,title,text,sort,created_at) VALUES (?,?,?,?,?)").bind(r.id, r.title, r.text, r.sort, now))));
    return json({ ok: true, replies: list });
  }

  /* ตั้งค่าเพจ (หัวหน้า): เปิด/ปิดเพจในกล่องแชท */
  if (path === "/chat/channels" && method === "PUT") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้า" }, 403);
    const body = await readBody(request);
    const on = Array.isArray(body.chat) ? body.chat.map(String) : [];
    await db.batch([db.prepare("UPDATE line_channels SET chat = 0")].concat(on.map((id) => db.prepare("UPDATE line_channels SET chat = 1 WHERE id = ?").bind(id))));
    return json({ ok: true, channels: await channelsOut(db, isOwner) });
  }

  if (path === "/chat/stats" && method === "GET") return json(await chatStats(db, url));

  /* ---- ตั้งค่า LINE Messaging API (หัวหน้า) — หน้า #/linesetup ใน Kan Chat ---- */
  if (path.indexOf("/chat/setup") === 0) {
    if (!isOwner) return json({ error: "ตั้งค่า LINE ได้เฉพาะหัวหน้า" }, 403);
    const origin = new URL(request.url).origin;
    const out = (c, extra) => Object.assign({
      id: c.id, name: c.name, basicId: c.basic_id, color: c.color, chat: !!c.chat, active: !!c.active,
      hasToken: !!c.token, tokenTail: c.token ? c.token.slice(-4) : "", hasSecret: !!c.secret,
      quotaLimit: c.quota_limit || 0, note: c.note || "", webhook: origin + "/api/line/webhook/" + c.id,
    }, extra || {});
    if (path === "/chat/setup" && method === "GET") {
      const rs = (await db.prepare("SELECT * FROM line_channels ORDER BY sort, name").all()).results || [];
      const cnt = (await db.prepare("SELECT channel_id, COUNT(*) n, MAX(last_msg_at) last FROM chat_convos WHERE mock = 0 GROUP BY channel_id").all()).results || [];
      const by = {}; cnt.forEach((r) => { by[r.channel_id] = r; });
      return json({ channels: rs.map((c) => out(c, { convos: by[c.id] ? by[c.id].n : 0, lastMsg: by[c.id] ? by[c.id].last : null })), r2: !!env.CHAT_MEDIA });
    }
    if (path === "/chat/setup" && method === "POST") {
      const body = await readBody(request);
      const name = String(body.name || "").trim().slice(0, 80);
      if (!name) return json({ error: "ต้องใส่ชื่อเพจ" }, 400);
      const id = "ch_" + randKey(6);
      const last = await db.prepare("SELECT MAX(sort) m FROM line_channels").first();
      await db.prepare("INSERT INTO line_channels (id,name,basic_id,color,active,sort,created_at,chat) VALUES (?,?,?,?,1,?,?,1)")
        .bind(id, name, String(body.basicId || "").slice(0, 40), String(body.color || "#06C755").slice(0, 20), ((last && last.m) || 0) + 1, now).run();
      return json({ ok: true, id });
    }
    const sm = path.match(/^\/chat\/setup\/([A-Za-z0-9_-]{1,40})(\/[a-z]+)?$/);
    if (!sm) return json({ error: "ไม่รู้จักคำสั่ง" }, 404);
    const ch = await db.prepare("SELECT * FROM line_channels WHERE id = ?").bind(sm[1]).first();
    if (!ch) return json({ error: "ไม่พบเพจนี้" }, 404);
    const act = sm[2] || "";
    if (!act && method === "PUT") {
      const body = await readBody(request);
      const sets = [], vals = [];
      const put = (col, v) => { sets.push(col + " = ?"); vals.push(v); };
      if (body.name != null && String(body.name).trim()) put("name", String(body.name).trim().slice(0, 80));
      if (body.basicId != null) put("basic_id", String(body.basicId).trim().slice(0, 40));
      if (body.color != null) put("color", String(body.color).slice(0, 20));
      if (body.token) put("token", String(body.token).trim().slice(0, 400));
      if (body.secret) put("secret", String(body.secret).trim().slice(0, 200));
      if (body.clearToken) { put("token", ""); put("secret", ""); }
      if (body.chat != null) put("chat", body.chat ? 1 : 0);
      if (body.active != null) put("active", body.active ? 1 : 0);
      if (body.quotaLimit != null) put("quota_limit", Math.max(0, Math.round(Number(body.quotaLimit) || 0)));
      if (sets.length) await db.prepare("UPDATE line_channels SET " + sets.join(", ") + " WHERE id = ?").bind(...vals, ch.id).run();
      return json({ ok: true });
    }
    if (!act && method === "DELETE") {
      const n = await db.prepare("SELECT COUNT(*) n FROM chat_convos WHERE channel_id = ? AND mock = 0").bind(ch.id).first();
      if (n && n.n) return json({ error: "เพจนี้มีแชทจริงอยู่ " + n.n + " ห้อง — ปิดการใช้งานแทนการลบ" }, 400);
      await db.batch([
        db.prepare("DELETE FROM chat_msgs WHERE convo_id IN (SELECT id FROM chat_convos WHERE channel_id = ?)").bind(ch.id),
        db.prepare("DELETE FROM chat_convos WHERE channel_id = ?").bind(ch.id),
        db.prepare("DELETE FROM line_users WHERE channel_id = ?").bind(ch.id),
        db.prepare("DELETE FROM rich_menus WHERE channel_id = ?").bind(ch.id),
        db.prepare("DELETE FROM line_channels WHERE id = ?").bind(ch.id),
      ]);
      return json({ ok: true });
    }
    if (!ch.token) return json({ error: "ยังไม่ได้ใส่ Channel access token" }, 400);
    const call = async (url2, init) => {
      const r = await lineFetch(ch, url2, init);
      let j = null; try { j = await r.json(); } catch (e) { j = null; }
      return { ok: r.ok, status: r.status, j };
    };
    /* ทดสอบ: token ใช้ได้ไหม · ชื่อ/ID เพจจริง · webhook ตั้งไว้ที่ไหน เปิดใช้อยู่ไหม · โควตาเดือนนี้ */
    if (act === "/test" && method === "POST") {
      const info = await call("https://api.line.me/v2/bot/info");
      if (!info.ok) return json({ ok: false, error: info.status === 401 ? "token ไม่ถูกต้อง หรือหมดอายุ" : "LINE ตอบกลับ " + info.status + " " + JSON.stringify(info.j || {}).slice(0, 200) });
      const wh = await call("https://api.line.me/v2/bot/channel/webhook/endpoint");
      const quota = await call("https://api.line.me/v2/bot/message/quota");
      const used = await call("https://api.line.me/v2/bot/message/quota/consumption");
      const mine = origin + "/api/line/webhook/" + ch.id;
      /* เก็บ LINE ID กับรูปจริงไว้ ไม่ต้องพิมพ์เอง */
      if (info.j && info.j.basicId && !ch.basic_id) await db.prepare("UPDATE line_channels SET basic_id = ? WHERE id = ?").bind(info.j.basicId, ch.id).run();
      if (quota.ok && quota.j && quota.j.type === "limited") await db.prepare("UPDATE line_channels SET quota_limit = ? WHERE id = ?").bind(quota.j.value || 0, ch.id).run();
      if (used.ok && used.j) await db.prepare("UPDATE line_channels SET quota_used = ? WHERE id = ?").bind(used.j.totalUsage || 0, ch.id).run();
      return json({ ok: true,
        bot: info.j ? { name: info.j.displayName, basicId: info.j.basicId, picture: info.j.pictureUrl || "", chatMode: info.j.chatMode || "", markAsRead: info.j.markAsReadMode || "" } : null,
        webhook: wh.ok && wh.j ? { endpoint: wh.j.endpoint || "", active: !!wh.j.active, isOurs: (wh.j.endpoint || "") === mine } : null,
        quota: quota.ok && quota.j ? { type: quota.j.type, value: quota.j.value || 0 } : null,
        used: used.ok && used.j ? used.j.totalUsage || 0 : null, hasSecret: !!ch.secret });
    }
    /* ตั้ง Webhook URL ให้เพจนี้ชี้มาที่ระบบเรา แล้วให้ LINE ยิงทดสอบ (ปุ่ม Use webhook ต้องเปิดเองใน LINE Developers) */
    if (act === "/webhook" && method === "POST") {
      if (!ch.secret) return json({ error: "ใส่ Channel secret ก่อน ไม่งั้นระบบตรวจลายเซ็นข้อความจาก LINE ไม่ได้" }, 400);
      const mine = origin + "/api/line/webhook/" + ch.id;
      const set = await call("https://api.line.me/v2/bot/channel/webhook/endpoint", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: mine }) });
      if (!set.ok) return json({ ok: false, error: "ตั้ง webhook ไม่สำเร็จ: " + set.status + " " + JSON.stringify(set.j || {}).slice(0, 200) });
      const test = await call("https://api.line.me/v2/bot/channel/webhook/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: mine }) });
      const wh = await call("https://api.line.me/v2/bot/channel/webhook/endpoint");
      return json({ ok: true, endpoint: mine, test: test.j || null, active: !!(wh.j && wh.j.active) });
    }
    return json({ error: "ไม่รู้จักคำสั่ง" }, 404);
  }

  /* ---- โหมดจำลอง (หัวหน้า): สร้าง/ล้างแชทตัวอย่าง · จำลองลูกค้าพิมพ์เข้ามา ---- */
  if (path === "/chat/mock/seed" && method === "POST") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้า" }, 403);
    return json(await seedMock(env, db, me));
  }
  if (path === "/chat/mock/clear" && method === "POST") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้า" }, 403);
    await db.batch([
      db.prepare("DELETE FROM chat_msgs WHERE convo_id IN (SELECT id FROM chat_convos WHERE mock = 1)"),
      db.prepare("DELETE FROM chat_convos WHERE mock = 1"),
    ]);
    return json({ ok: true });
  }
  if (path === "/chat/mock/incoming" && method === "POST") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้า" }, 403);
    const body = await readBody(request);
    const c = await db.prepare("SELECT * FROM chat_convos WHERE id = ? AND mock = 1").bind(String(body.id || "")).first();
    if (!c) return json({ error: "จำลองได้เฉพาะแชทจำลอง" }, 400);
    const ch = await db.prepare("SELECT * FROM line_channels WHERE id = ?").bind(c.channel_id).first();
    await recordInbound(env, db, ch || {}, c, { kind: "text", text: String(body.text || "สวัสดีค่ะ").slice(0, 1000), mock: true, at: now });
    return json({ ok: true });
  }
  return json({ error: "ไม่รู้จักคำสั่ง" }, 404);
}

/* ---------- สถิติ ---------- */
const TH = 7 * 3600000;
async function chatStats(db, url) {
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 7));
  const ch = url.searchParams.get("ch") || "";
  const endTh = new Date(Date.now() + TH); endTh.setUTCHours(23, 59, 59, 999);
  const startTh = new Date(endTh.getTime() - days * 86400000 + 1);
  const from = new Date(startTh.getTime() - TH).toISOString(), to = new Date(endTh.getTime() - TH).toISOString();
  const chWhere = ch ? " AND c.channel_id = ?" : "";
  const chB = ch ? [ch] : [];
  const scope = " AND c.channel_id IN (SELECT id FROM line_channels WHERE chat = 1)";

  const inb = (await db.prepare("SELECT m.convo_id, m.created_at, c.channel_id, c.first_contact_at FROM chat_msgs m JOIN chat_convos c ON c.id = m.convo_id WHERE m.dir = 'in' AND m.created_at BETWEEN ? AND ?" + scope + chWhere)
    .bind(from, to, ...chB).all()).results || [];
  const outb = (await db.prepare("SELECT m.convo_id, m.created_at, m.staff_id, c.channel_id, m.sent_via FROM chat_msgs m JOIN chat_convos c ON c.id = m.convo_id WHERE m.dir = 'out' AND m.created_at BETWEEN ? AND ?" + scope + chWhere)
    .bind(from, to, ...chB).all()).results || [];
  const custs = {}, newCusts = {}, replied = {};
  inb.forEach((r) => { custs[r.convo_id] = 1; if (r.first_contact_at >= from) newCusts[r.convo_id] = 1; });
  outb.forEach((r) => { replied[r.convo_id] = 1; });

  /* เวลาตอบ: ข้อความลูกค้าที่เริ่มรอบรอ (ก่อนหน้าเป็นของร้านหรือไม่มี) → ข้อความร้านถัดไป */
  const rt = (await db.prepare(
    "WITH m AS (SELECT m.convo_id, m.dir, m.created_at, m.staff_id, c.channel_id, LAG(m.dir) OVER (PARTITION BY m.convo_id ORDER BY m.created_at) pd " +
    "  FROM chat_msgs m JOIN chat_convos c ON c.id = m.convo_id WHERE 1=1" + scope + chWhere + ") " +
    "SELECT s.convo_id, s.channel_id, s.created_at t0, " +
    " (SELECT MIN(x.created_at) FROM chat_msgs x WHERE x.convo_id = s.convo_id AND x.dir = 'out' AND x.created_at > s.created_at) t1, " +
    " (SELECT x.staff_id FROM chat_msgs x WHERE x.convo_id = s.convo_id AND x.dir = 'out' AND x.created_at > s.created_at ORDER BY x.created_at LIMIT 1) who " +
    "FROM m s WHERE s.dir = 'in' AND (s.pd IS NULL OR s.pd = 'out') AND s.created_at BETWEEN ? AND ?")
    .bind(...chB, from, to).all()).results || [];
  const mins = (a, b) => (Date.parse(b) - Date.parse(a)) / 60000;
  const answered = rt.filter((r) => r.t1);
  const avg = (arr) => arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length * 10) / 10 : null;
  const median = (arr) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return Math.round(s[Math.floor(s.length / 2)] * 10) / 10; };
  const rtAll = answered.map((r) => mins(r.t0, r.t1));

  const pendNow = (await db.prepare("SELECT c.id, c.channel_id, c.assignee, c.waiting_since, c.status FROM chat_convos c WHERE c.status IN ('new','open')" + scope + chWhere).bind(...chB).all()).results || [];
  const oldest = pendNow.reduce((m, r) => r.waiting_since && (!m || r.waiting_since < m) ? r.waiting_since : m, null);
  const closed = await db.prepare("SELECT COUNT(*) n FROM chat_convos c WHERE c.closed_at BETWEEN ? AND ?" + scope + chWhere).bind(from, to, ...chB).first();

  /* รายวัน (เวลาไทย) */
  const dayKey = (iso) => new Date(Date.parse(iso) + TH).toISOString().slice(0, 10);
  const daily = [];
  for (let i = 0; i < days; i++) {
    const k = new Date(startTh.getTime() + i * 86400000).toISOString().slice(0, 10);
    daily.push({ day: k, custs: 0, newCusts: 0, msgsIn: 0, replies: 0 });
  }
  const dIdx = {}; daily.forEach((d, i) => { dIdx[d.day] = i; });
  const seenDay = {};
  inb.forEach((r) => {
    const k = dayKey(r.created_at), i = dIdx[k]; if (i == null) return;
    daily[i].msgsIn++;
    if (!seenDay[k + r.convo_id]) { seenDay[k + r.convo_id] = 1; daily[i].custs++; if (dayKey(r.first_contact_at) === k) daily[i].newCusts++; }
  });
  outb.forEach((r) => { const i = dIdx[dayKey(r.created_at)]; if (i != null) daily[i].replies++; });

  /* วัน × ชั่วโมง ที่ลูกค้าทัก */
  const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
  inb.forEach((r) => { const d = new Date(Date.parse(r.created_at) + TH); heat[d.getUTCDay()][d.getUTCHours()]++; });

  /* รายพนักงาน */
  const staff = {};
  outb.forEach((r) => { if (!r.staff_id) return; const s = staff[r.staff_id] || (staff[r.staff_id] = { id: r.staff_id, replies: 0, convos: {}, rt: [] }); s.replies++; s.convos[r.convo_id] = 1; });
  answered.forEach((r) => { if (r.who && staff[r.who]) staff[r.who].rt.push(mins(r.t0, r.t1)); });
  /* รายเพจ */
  const chans = {};
  const chOf = (id) => chans[id] || (chans[id] = { id, custs: {}, msgsIn: 0, replies: 0, rt: [], pending: 0, push: 0 });
  inb.forEach((r) => { const c = chOf(r.channel_id); c.custs[r.convo_id] = 1; c.msgsIn++; });
  outb.forEach((r) => { const c = chOf(r.channel_id); c.replies++; if (r.sent_via === "push") c.push++; });
  answered.forEach((r) => chOf(r.channel_id).rt.push(mins(r.t0, r.t1)));
  pendNow.forEach((r) => chOf(r.channel_id).pending++);

  /* ข้อความ push เดือนนี้ (นับโควตา LINE) */
  const monthStart = new Date(Date.now() + TH); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const pushM = await db.prepare("SELECT COUNT(*) n FROM chat_msgs m JOIN chat_convos c ON c.id = m.convo_id WHERE m.dir = 'out' AND m.sent_via = 'push' AND m.created_at >= ?" + scope + chWhere)
    .bind(new Date(monthStart.getTime() - TH).toISOString(), ...chB).first();

  return {
    days, from, to,
    cards: {
      custs: Object.keys(custs).length, newCusts: Object.keys(newCusts).length, replied: Object.keys(replied).length,
      msgsIn: inb.length, replies: outb.length, pendingNow: pendNow.length, unassignedNow: pendNow.filter((r) => !r.assignee).length,
      oldestWaitMin: oldest ? Math.round(mins(oldest, nowIso())) : null, closed: closed ? closed.n : 0,
      avgFirstReplyMin: avg(rtAll), medianReplyMin: median(rtAll), unanswered: rt.length - answered.length,
      within5: rtAll.filter((x) => x <= 5).length, answeredCount: rtAll.length, pushThisMonth: pushM ? pushM.n : 0,
    },
    daily, heat,
    staff: Object.values(staff).map((s) => ({ id: s.id, replies: s.replies, convos: Object.keys(s.convos).length, avgMin: avg(s.rt), median: median(s.rt) })).sort((a, b) => b.replies - a.replies),
    channels: Object.values(chans).map((c) => ({ id: c.id, custs: Object.keys(c.custs).length, msgsIn: c.msgsIn, replies: c.replies, avgMin: avg(c.rt), pending: c.pending, push: c.push })),
  };
}

/* ---------- แชทจำลอง (ดูหน้าตา + ทดสอบสถิติ ก่อนต่อ LINE จริง) ---------- */
async function seedMock(env, db, me) {
  const chs = ((await db.prepare("SELECT id FROM line_channels WHERE chat = 1 AND active = 1 ORDER BY sort").all()).results || []).map((r) => r.id);
  if (!chs.length) return { error: "ยังไม่มีเพจที่เปิดกล่องแชท" };
  const staffRs = ((await db.prepare("SELECT id, name FROM staff WHERE active = 1 AND pending = 0 AND (instr(lower(name),'tang') > 0 OR instr(lower(name),'ice') > 0)").all()).results || []).map((r) => r.id);
  const reps = staffRs.length ? staffRs : [me.id];
  const names = ["น้องมายด์", "Pim Pim", "คุณแอน สุราษฎร์", "Kittipong", "ป้าศรี", "Nong Fah", "Beam", "พี่ต้น ชุมพร", "Jariya", "มะปราง", "Toey", "คุณวิภา",
                 "Oat", "นุ่น", "Mint", "พี่โอ๋", "Fern", "คุณเล็ก", "Game", "ส้มโอ", "Nan", "ครูแป้ง", "Big", "ออม"];
  const Q = [
    ["สวัสดีค่ะ โปรเฟอร์นิเจอร์ลด 50% ยังมีอยู่ไหมคะ", "มีค่ะ ถึงสิ้นเดือนนี้เลยค่ะ ลดทุกชิ้นในโซนเฟอร์นิเจอร์นะคะ"],
    ["ร้านเปิดกี่โมงครับ", "เปิด 10.00–20.00 น. ทุกวันค่ะ"],
    ["เสื้อผ้าชั่งกิโลวันนี้มีตัดก้อนไหมคะ", "วันศุกร์–อาทิตย์ตัดก้อนสด 10 โมงค่ะ มาเช้าได้เลือกก่อนนะคะ"],
    ["กระเป๋ากิโลละ 100 ใช่ไหมคะ", "ใช่ค่ะ กิโลกรัมละ 100 บาท คละแบบได้เลยค่ะ"],
    ["ส่งต่างจังหวัดได้ไหมครับ", "ได้ค่ะ ขอชื่อที่อยู่และเบอร์โทรไว้ให้ทีมติดต่อกลับนะคะ"],
    ["มีโต๊ะกินข้าวไม้สักไหมคะ ขอรูปหน่อย", "มีค่ะ เดี๋ยวส่งรูปให้นะคะ"],
    ["ขอแผนที่ร้านสาขาสุราษฎร์หน่อยค่ะ", "นี่ค่ะ https://maps.google.com/?q=Kan+Store+Surat"],
    ["ตุ๊กตาขีดละ 10 บาทยังมีไหม", "มีค่ะ อยู่โซนหน้าแคชเชียร์นะคะ"],
  ];
  const now = Date.now(), stmts = [];
  let n = 0;
  for (let i = 0; i < names.length; i++) {
    const chId = chs[i % chs.length], cid = newId("cv_"), uid = "Umock" + randKey(12);
    const start = now - Math.floor(Math.random() * 6.5 * 86400000) - 3600000;
    const qa = Q[i % Q.length];
    const pend = i % 5 === 0 || i % 7 === 3;                 /* ค้างตอบ */
    const closed = !pend && i % 3 === 0;
    const rep = reps[i % reps.length];
    const replyMin = 2 + Math.floor(Math.random() * (i % 4 === 0 ? 90 : 18));
    const msgs = [{ dir: "in", text: qa[0], at: start }];
    if (!pend) {
      msgs.push({ dir: "out", text: qa[1], at: start + replyMin * 60000, staff: rep });
      if (i % 2 === 0) msgs.push({ dir: "in", text: "ขอบคุณค่ะ", at: start + (replyMin + 3) * 60000 });
      if (i % 2 === 0 && !closed) msgs.push({ dir: "out", text: "ยินดีค่ะ แวะมาได้เลยนะคะ", at: start + (replyMin + 6) * 60000, staff: rep });
    } else if (i % 2 === 1) {
      msgs.push({ dir: "in", text: "รบกวนตอบด้วยค่ะ", at: start + 20 * 60000 });
    }
    const last = msgs[msgs.length - 1];
    const lastFrom = last.dir === "in" ? "cust" : "staff";
    const status = closed ? "closed" : (pend ? (i % 2 ? "open" : "new") : (lastFrom === "cust" ? "open" : "waiting"));
    const firstWait = pend ? new Date(msgs.filter((m) => m.dir === "in")[0].at).toISOString() : (lastFrom === "cust" ? new Date(last.at).toISOString() : null);
    stmts.push(db.prepare("INSERT INTO chat_convos (id,channel_id,line_user_id,display_name,picture_url,status,assignee,last_msg_at,last_msg_text,last_from,unread,waiting_since,tags,first_contact_at,closed_at,mock,created_at,updated_at) " +
      "VALUES (?,?,?,?,'',?,?,?,?,?,?,?,?,?,?,1,?,?)")
      .bind(cid, chId, uid, names[i], status, pend && i % 2 === 0 ? null : rep, new Date(last.at).toISOString(), last.text, lastFrom,
            lastFrom === "cust" && !closed ? msgs.filter((m) => m.dir === "in").length : 0, status === "new" || status === "open" ? firstWait : null,
            i % 4 === 0 ? "สนใจเฟอร์" : (i % 4 === 1 ? "ถามเวลา" : ""), new Date(start).toISOString(), closed ? new Date(last.at + 3600000).toISOString() : null,
            new Date(start).toISOString(), new Date(last.at).toISOString()));
    msgs.forEach((m) => {
      stmts.push(db.prepare("INSERT INTO chat_msgs (id,convo_id,dir,kind,text,staff_id,sent_via,mock,created_at) VALUES (?,?,?,'text',?,?,?,1,?)")
        .bind(newId("cm_"), cid, m.dir, m.text, m.staff || null, m.dir === "out" ? "mock" : "", new Date(m.at).toISOString()));
    });
    n++;
  }
  await db.batch(stmts);
  const hasQr = await db.prepare("SELECT COUNT(*) n FROM chat_replies").first();
  if (!hasQr || !hasQr.n) {
    const qr = [["ทักทาย", "สวัสดีค่ะ ยินดีต้อนรับสู่ KAN ค่ะ สอบถามได้เลยนะคะ"], ["เวลาเปิดร้าน", "ร้านเปิด 10.00–20.00 น. ทุกวันค่ะ"],
                ["ขอเบอร์", "รบกวนขอเบอร์โทรไว้ให้ทีมติดต่อกลับได้ไหมคะ"], ["ขอบคุณ", "ขอบคุณที่สนใจสินค้าของ KAN นะคะ แวะมาได้เลยค่ะ"]];
    await db.batch(qr.map((x, i) => db.prepare("INSERT INTO chat_replies (id,title,text,sort,created_at) VALUES (?,?,?,?,?)").bind(newId("qr_"), x[0], x[1], i, nowIso())));
  }
  return { ok: true, created: n };
}
