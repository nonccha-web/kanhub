/* ============================================================
   ส่ง SMS (แยกจากบรอดแคสต์ LINE — นนท์ 29 ก.ย. 69) อยู่ในหมวด Kan Chat
   /api/t/sms/*  ต้องมีสิทธิ์เมนู "ส่ง SMS"
   ผู้ให้บริการ: mock (ค่าเริ่มต้น — บันทึกครบ ไม่มีข้อความออกจริง) · thaibulksms (API v2)
   ============================================================ */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function nowIso() { return new Date().toISOString(); }
function newId(p) { const a = new Uint8Array(8); crypto.getRandomValues(a); return p + Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function readBody(request) { try { return await request.json(); } catch (e) { return {}; } }

const SMS_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS sms_sends (" +
    "id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', text TEXT NOT NULL, " +
    "n_target INTEGER NOT NULL DEFAULT 0, n_sent INTEGER NOT NULL DEFAULT 0, n_fail INTEGER NOT NULL DEFAULT 0, " +
    "credits_per INTEGER NOT NULL DEFAULT 1, credits_total INTEGER NOT NULL DEFAULT 0, cost_baht REAL NOT NULL DEFAULT 0, " +
    "provider TEXT NOT NULL DEFAULT 'mock', status TEXT NOT NULL DEFAULT 'mock', error TEXT NOT NULL DEFAULT '', " +
    "sources TEXT NOT NULL DEFAULT '{}', created_by TEXT NOT NULL, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_sms_sends_time ON sms_sends(created_at DESC)",
  "CREATE TABLE IF NOT EXISTS sms_targets (" +
    "id TEXT PRIMARY KEY, send_id TEXT NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', " +
    "source TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'sent', err TEXT NOT NULL DEFAULT '')",
  "CREATE INDEX IF NOT EXISTS idx_sms_targets_send ON sms_targets(send_id)",
];
let smsReady = false;
async function ensureSmsSchema(db) {
  if (smsReady) return;
  await db.batch(SMS_SCHEMA.map((s) => db.prepare(s)));
  smsReady = true;
}

const PROVIDERS = { mock: "โหมดจำลอง (ยังไม่ส่งจริง)", thaibulksms: "ThaiBulkSMS" };
async function loadCfg(db) {
  const r = await db.prepare("SELECT value FROM task_settings WHERE key = 'sms_cfg'").first().catch(() => null);
  let c = {};
  try { c = r && r.value ? JSON.parse(r.value) : {}; } catch (e) { c = {}; }
  return { provider: PROVIDERS[c.provider] ? c.provider : "mock", sender: c.sender || "", apiKey: c.apiKey || "", apiSecret: c.apiSecret || "", rate: Number(c.rate) || 0.35 };
}
function cfgOut(c) {
  return { provider: c.provider, providers: PROVIDERS, sender: c.sender, hasKey: !!c.apiKey, keyTail: c.apiKey ? c.apiKey.slice(-4) : "", hasSecret: !!c.apiSecret, rate: c.rate, live: c.provider !== "mock" && !!c.apiKey };
}

/* SMS ไทย: มีตัวอักษรนอก GSM (เช่นภาษาไทย) = UCS-2 ข้อความละ 70 ตัว ยาวกว่านั้นตัดท่อนละ 67 · อังกฤษล้วน 160 / 153 */
export function smsCredits(text) {
  const t = String(text || "");
  const uni = /[^\x00-\x7F]/.test(t);
  const n = Array.from(t).length;
  if (!n) return 0;
  if (uni) return n <= 70 ? 1 : Math.ceil(n / 67);
  return n <= 160 ? 1 : Math.ceil(n / 153);
}
export function normPhone(p) {
  let d = String(p || "").replace(/[^0-9+]/g, "");
  if (d.indexOf("+66") === 0) d = "0" + d.slice(3);
  else if (d.indexOf("66") === 0 && d.length === 11) d = "0" + d.slice(2);
  return /^0[689]\d{8}$/.test(d) ? d : "";
}

async function collect(db, src) {
  const out = new Map();
  const add = (phone, name, source) => { const p = normPhone(phone); if (p && !out.has(p)) out.set(p, { phone: p, name: name || "", source }); };
  if (src.leads) {
    const st = Array.isArray(src.leadStatus) ? src.leadStatus.filter((x) => /^[a-z]{2,12}$/.test(x)) : [];
    const rs = (await db.prepare("SELECT name, phone, status FROM leads WHERE phone != ''").all()).results || [];
    rs.filter((r) => !st.length || st.indexOf(r.status) !== -1).forEach((r) => add(r.phone, r.name, "ลีด"));
  }
  if (src.chat) {
    const rs = (await db.prepare("SELECT display_name, phone FROM chat_convos WHERE phone != '' AND mock = 0").all().catch(() => ({ results: [] }))).results || [];
    rs.forEach((r) => add(r.phone, r.display_name, "แชท LINE"));
  }
  let bad = 0;
  String(src.numbers || "").split(/[\s,;]+/).filter(Boolean).forEach((x) => { if (normPhone(x)) add(x, "", "เพิ่มเอง"); else bad++; });
  return { list: Array.from(out.values()), bad };
}

async function sendThaiBulk(cfg, phones, text) {
  const body = new URLSearchParams({ msisdn: phones.join(","), message: text, sender: cfg.sender || "" });
  const r = await fetch("https://api-v2.thaibulksms.com/sms", {
    method: "POST",
    headers: { authorization: "Basic " + btoa(cfg.apiKey + ":" + cfg.apiSecret), "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: body.toString(),
  });
  let j = null; try { j = await r.json(); } catch (e) { j = null; }
  if (!r.ok) return { ok: false, error: ((j && j.error && (j.error.description || j.error.name)) || ("HTTP " + r.status)).toString().slice(0, 300) };
  const bad = new Set(((j && j.bad_phone_number_list) || []).map((x) => normPhone(x.number || x)));
  return { ok: true, bad };
}

export async function handleSmsApi(env, db, request, url, path, method, me, lvl, isOwner) {
  await ensureSmsSchema(db);
  if (lvl === "none" && !isOwner) return json({ error: "ไม่มีสิทธิ์เมนูส่ง SMS" }, 403);
  const canEdit = isOwner || lvl === "edit";
  const cfg = await loadCfg(db);

  if (path === "/sms/home" && method === "GET") {
    const sends = (await db.prepare("SELECT * FROM sms_sends ORDER BY created_at DESC LIMIT 50").all()).results || [];
    const leads = (await db.prepare("SELECT status, COUNT(*) n FROM leads WHERE phone != '' GROUP BY status").all()).results || [];
    const chat = await db.prepare("SELECT COUNT(*) n FROM chat_convos WHERE phone != '' AND mock = 0").first().catch(() => ({ n: 0 }));
    return json({ cfg: cfgOut(cfg), canEdit, sends: sends.map(sendOut), leadCounts: leads, chatPhones: chat ? chat.n : 0 });
  }
  if (path === "/sms/count" && method === "POST") {
    const body = await readBody(request);
    const c = await collect(db, body.sources || {});
    const per = smsCredits(body.text);
    return json({ n: c.list.length, bad: c.bad, credits: per * c.list.length, per, cost: Math.round(per * c.list.length * cfg.rate * 100) / 100,
                  sample: c.list.slice(0, 8) });
  }
  if (path === "/sms/send" && method === "POST") {
    if (!canEdit) return json({ error: "สิทธิ์ของคุณเป็นแบบดูอย่างเดียว" }, 403);
    const body = await readBody(request);
    const text = String(body.text || "").trim();
    if (!text) return json({ error: "ยังไม่ได้พิมพ์ข้อความ" }, 400);
    if (Array.from(text).length > 670) return json({ error: "ข้อความยาวเกินไป (สูงสุด ~10 ข้อความต่อเบอร์)" }, 400);
    const c = await collect(db, body.sources || {});
    if (!c.list.length) return json({ error: "ยังไม่มีเบอร์ผู้รับที่ใช้ได้" }, 400);
    if (c.list.length > 5000) return json({ error: "ส่งได้ครั้งละไม่เกิน 5,000 เบอร์" }, 400);
    const per = smsCredits(text), now = nowIso(), id = newId("sms_");
    let status = "mock", error = "", bad = new Set();
    if (cfg.provider !== "mock") {
      if (!cfg.apiKey || !cfg.apiSecret) return json({ error: "ยังไม่ได้ใส่ API key/secret ของผู้ให้บริการ" }, 400);
      if (!cfg.sender) return json({ error: "ยังไม่ได้ใส่ชื่อผู้ส่ง (Sender name) ที่จดทะเบียนไว้" }, 400);
      /* ยิงทีละ 500 เบอร์ */
      let fails = 0;
      for (let i = 0; i < c.list.length; i += 500) {
        const chunk = c.list.slice(i, i + 500).map((x) => x.phone);
        const r = await sendThaiBulk(cfg, chunk, text);
        if (!r.ok) { error = r.error; chunk.forEach((p) => bad.add(p)); fails++; } else r.bad.forEach((p) => bad.add(p));
      }
      status = bad.size === 0 ? "sent" : (bad.size === c.list.length ? "fail" : "partial");
    }
    const nFail = bad.size, nSent = c.list.length - nFail;
    const stmts = [db.prepare("INSERT INTO sms_sends (id,title,text,n_target,n_sent,n_fail,credits_per,credits_total,cost_baht,provider,status,error,sources,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, String(body.title || "").trim().slice(0, 120) || text.slice(0, 40), text, c.list.length, nSent, nFail, per, per * nSent,
            Math.round(per * nSent * cfg.rate * 100) / 100, cfg.provider, status, error, JSON.stringify(body.sources || {}).slice(0, 4000), me.id, now)];
    c.list.slice(0, 5000).forEach((x) => stmts.push(db.prepare("INSERT INTO sms_targets (id,send_id,phone,name,source,status,err) VALUES (?,?,?,?,?,?,?)")
      .bind(newId("st_"), id, x.phone, x.name.slice(0, 80), x.source, bad.has(x.phone) ? "fail" : (status === "mock" ? "mock" : "sent"), bad.has(x.phone) ? (error || "เบอร์ไม่ถูกต้อง") : "")));
    for (let i = 0; i < stmts.length; i += 90) await db.batch(stmts.slice(i, i + 90));
    return json({ ok: true, id, status, sent: nSent, fail: nFail, error });
  }
  const sm = path.match(/^\/sms\/send\/([A-Za-z0-9_-]{1,40})$/);
  if (sm && method === "GET") {
    const s = await db.prepare("SELECT * FROM sms_sends WHERE id = ?").bind(sm[1]).first();
    if (!s) return json({ error: "ไม่พบรายการนี้" }, 404);
    const t = (await db.prepare("SELECT phone, name, source, status, err FROM sms_targets WHERE send_id = ? LIMIT 5000").bind(s.id).all()).results || [];
    return json({ send: sendOut(s), targets: t });
  }
  if (path === "/sms/settings" && method === "PUT") {
    if (!isOwner) return json({ error: "ตั้งค่า SMS ได้เฉพาะหัวหน้า" }, 403);
    const body = await readBody(request);
    const next = Object.assign({}, cfg);
    if (body.provider != null && PROVIDERS[body.provider]) next.provider = body.provider;
    if (body.sender != null) next.sender = String(body.sender).trim().slice(0, 11);
    if (body.apiKey) next.apiKey = String(body.apiKey).trim().slice(0, 200);
    if (body.apiSecret) next.apiSecret = String(body.apiSecret).trim().slice(0, 200);
    if (body.clearKey) { next.apiKey = ""; next.apiSecret = ""; }
    if (body.rate != null) next.rate = Math.max(0, Math.min(10, Number(body.rate) || 0));
    await db.prepare("INSERT INTO task_settings (key,value) VALUES ('sms_cfg', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(next)).run();
    return json({ ok: true, cfg: cfgOut(next) });
  }
  if (path === "/sms/stats" && method === "GET") {
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 7));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const r = await db.prepare("SELECT COUNT(*) sends, COALESCE(SUM(n_target),0) targets, COALESCE(SUM(n_sent),0) sent, COALESCE(SUM(n_fail),0) fail, " +
      "COALESCE(SUM(credits_total),0) credits, COALESCE(SUM(cost_baht),0) cost, COALESCE(SUM(CASE WHEN provider = 'mock' THEN 1 ELSE 0 END),0) mock FROM sms_sends WHERE created_at >= ?").bind(since).first();
    return json({ days, sends: r.sends, targets: r.targets, sent: r.sent, fail: r.fail, credits: r.credits, cost: Math.round(r.cost * 100) / 100, mock: r.mock, live: cfgOut(cfg).live, rate: cfg.rate });
  }
  return json({ error: "ไม่รู้จักคำสั่ง" }, 404);
}
function sendOut(r) {
  let src = {}; try { src = JSON.parse(r.sources || "{}"); } catch (e) { src = {}; }
  return { id: r.id, title: r.title, text: r.text, target: r.n_target, sent: r.n_sent, fail: r.n_fail, per: r.credits_per, credits: r.credits_total,
           cost: r.cost_baht, provider: r.provider, status: r.status, error: r.error, sources: src, by: r.created_by, at: r.created_at };
}
