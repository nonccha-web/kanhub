/* ============================================================
   KAN — Kan Bot แชทบอทตอบ LINE (นนท์ 10 ต.ค. 69)
   ย้าย prompt ที่ทดลองใน Dabby (Kan Hub × Dabby V3) มาตอบในกล่องแชทของเราเอง
   - ตั้งค่ารายเพจ: เปิด/ปิด · โมเดล GPT · จำนวนบับเบิล · เวลาที่บอทตอบ · ส่งเบอร์เข้า CRM
   - prompt เก็บเป็นเวอร์ชัน ย้อนกลับได้
   - ตอบผ่าน reply token (ฟรี ไม่กินโควตา LINE) · แยกบับเบิลด้วย [SPLIT] · [IMAGE]url = ส่งรูป
   - แอดมินคนจริงพิมพ์ในแชทนั้นเมื่อไร บอทหยุดตอบแชทนั้น (chat_convos.bot_off = 1)
   - เรียก GPT ผ่าน OpenRouter (secret OPENROUTER_API_KEY) หรือ OpenAI ตรง (OPENAI_API_KEY)
   ============================================================ */
import { lineSend, ensureChatSchema } from "./worker-chat.js";
import { ensureBlastSchema } from "./worker-blast.js";
import { SEED_PROMPT_HUB } from "./bot-prompt-seed.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function nowIso() { return new Date().toISOString(); }
function randKey(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function readBody(request) { try { return await request.json(); } catch (e) { return {}; } }

/* โมเดลที่ให้เลือก — ราคาเป็น ดอลลาร์ ต่อ 1 ล้าน token (OpenRouter 10 ต.ค. 69) ใช้ประมาณค่าใช้จ่ายเมื่อผู้ให้บริการไม่ส่งยอดมา */
export const BOT_MODELS = [
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna", note: "ถูกสุด · แนะนำ", inp: 0.10, out: 0.50, cache: 0.01 },
  { id: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna", note: "รุ่นก่อน", inp: 0.20, out: 1.20, cache: 0.02 },
  { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol", note: "ฉลาดกว่า แพงกว่า ~20 เท่า", inp: 2.00, out: 10.00, cache: 0.10 },
];
const USD_THB = 33;
const DEFAULT_MODEL = BOT_MODELS[0].id;
/* เพจที่ prompt V3 เขียนไว้ให้ (ขายส่ง) */
const DEFAULT_CHANNEL = "ch_hub";

const BOT_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS bot_config (" +
    "channel_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, model TEXT NOT NULL DEFAULT '" + DEFAULT_MODEL + "', " +
    "min_b INTEGER NOT NULL DEFAULT 1, max_b INTEGER NOT NULL DEFAULT 5, " +
    "hours_on INTEGER NOT NULL DEFAULT 0, hours_from TEXT NOT NULL DEFAULT '18:00', hours_to TEXT NOT NULL DEFAULT '09:00', " +
    "lead_on INTEGER NOT NULL DEFAULT 1, history_n INTEGER NOT NULL DEFAULT 16, " +
    "updated_at TEXT, updated_by TEXT)",
  "CREATE TABLE IF NOT EXISTS bot_prompts (" +
    "id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, version INTEGER NOT NULL, text TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', " +
    "active INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_bot_prompts ON bot_prompts(channel_id, version DESC)",
  /* ทุกครั้งที่บอทตอบ (ของจริงและแชทจำลอง) — ไว้ดูค่าใช้จ่ายเป็นบาท */
  "CREATE TABLE IF NOT EXISTS bot_runs (" +
    "id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, convo_id TEXT, model TEXT NOT NULL, sim INTEGER NOT NULL DEFAULT 0, " +
    "in_tok INTEGER NOT NULL DEFAULT 0, cache_tok INTEGER NOT NULL DEFAULT 0, out_tok INTEGER NOT NULL DEFAULT 0, " +
    "cost_usd REAL NOT NULL DEFAULT 0, ms INTEGER NOT NULL DEFAULT 0, bubbles INTEGER NOT NULL DEFAULT 0, " +
    "ok INTEGER NOT NULL DEFAULT 1, error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_bot_runs_time ON bot_runs(created_at)",
];
const BOT_MIGRATIONS = [
  "ALTER TABLE chat_convos ADD COLUMN bot_off INTEGER NOT NULL DEFAULT 0",
];

let botReady = false;
export async function ensureBotSchema(db) {
  if (botReady) return;
  await db.batch(BOT_SCHEMA.map((s) => db.prepare(s)));
  for (const m of BOT_MIGRATIONS) { try { await db.prepare(m).run(); } catch (e) { /* มีแล้ว */ } }
  /* ใส่ prompt จาก Dabby ให้เพจ Kan Hub ครั้งแรก (บอทยังปิดอยู่ ต้องกดเปิดเอง) */
  const has = await db.prepare("SELECT id FROM bot_prompts WHERE channel_id = ? LIMIT 1").bind(DEFAULT_CHANNEL).first();
  if (!has) {
    await db.prepare("INSERT INTO bot_prompts (id,channel_id,version,text,note,active,created_by,created_at) VALUES (?,?,1,?,?,1,'seed',?)")
      .bind("bp_" + randKey(8), DEFAULT_CHANNEL, SEED_PROMPT_HUB, "นำเข้าจาก Dabby V3 · ได้เบอร์เข้า CRM", nowIso()).run();
  }
  botReady = true;
}

async function getConfig(db, chId) {
  const r = await db.prepare("SELECT * FROM bot_config WHERE channel_id = ?").bind(chId).first();
  return r || { channel_id: chId, enabled: 0, model: DEFAULT_MODEL, min_b: 1, max_b: 5, hours_on: 0, hours_from: "18:00", hours_to: "09:00", lead_on: 1, history_n: 16 };
}
async function activePrompt(db, chId) {
  return await db.prepare("SELECT * FROM bot_prompts WHERE channel_id = ? AND active = 1 ORDER BY version DESC LIMIT 1").bind(chId).first();
}
function hasKey(env) { return !!(env.OPENROUTER_API_KEY || env.OPENAI_API_KEY); }

/* เวลาที่บอทตอบ (เวลาไทย) — ช่วงข้ามเที่ยงคืนได้ เช่น 18:00–09:00 */
function inHours(cfg, d) {
  if (!cfg.hours_on) return true;
  const th = new Date(d.getTime() + 7 * 3600000);
  const mins = th.getUTCHours() * 60 + th.getUTCMinutes();
  const toM = (s) => { const m = String(s || "0:0").split(":"); return (+m[0] || 0) * 60 + (+m[1] || 0); };
  const a = toM(cfg.hours_from), b = toM(cfg.hours_to);
  return a <= b ? (mins >= a && mins < b) : (mins >= a || mins < b);
}

/* ---------- เรียก GPT ---------- */
async function callModel(env, cfg, system, turns) {
  const viaOpenRouter = !!env.OPENROUTER_API_KEY;
  const model = viaOpenRouter ? cfg.model : String(cfg.model).replace(/^openai\//, "");
  const url = viaOpenRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const headers = { "content-type": "application/json", authorization: "Bearer " + (viaOpenRouter ? env.OPENROUTER_API_KEY : env.OPENAI_API_KEY) };
  if (viaOpenRouter) { headers["HTTP-Referer"] = "https://admin.kan-hub.com"; headers["X-Title"] = "Kan Bot"; }
  const body = { model, messages: [{ role: "system", content: system }].concat(turns), max_tokens: 900 };
  if (viaOpenRouter) body.usage = { include: true };
  const t0 = Date.now();
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const ms = Date.now() - t0;
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.choices || !j.choices[0]) {
    const err = (j.error && (j.error.message || j.error.code)) || ("HTTP " + r.status);
    return { ok: false, error: String(err).slice(0, 300), ms, model: cfg.model };
  }
  const u = j.usage || {};
  const inTok = u.prompt_tokens || 0, outTok = u.completion_tokens || 0;
  const cacheTok = (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || 0;
  const price = BOT_MODELS.filter((m) => m.id === cfg.model)[0] || BOT_MODELS[0];
  const est = ((inTok - cacheTok) * price.inp + cacheTok * price.cache + outTok * price.out) / 1e6;
  const cost = typeof u.cost === "number" ? u.cost : est;
  return { ok: true, text: String(j.choices[0].message && j.choices[0].message.content || ""), inTok, outTok, cacheTok, cost, ms, model: cfg.model };
}

/* ---------- แปลงคำตอบเป็นบับเบิล LINE ---------- */
const IMG_RE = /^\[IMAGE\](https:\/\/\S+)$/;
export function toBubbles(text, maxB) {
  const parts = String(text || "").replace(/\r/g, "").split(/\n[ \t]*\[SPLIT\][ \t]*\n|^\[SPLIT\]\n|\n\[SPLIT\]$/)
    .map((p) => p.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const lines = p.split("\n"), buf = [];
    for (const ln of lines) {
      const m = ln.trim().match(IMG_RE);
      if (m) {
        if (buf.join("\n").trim()) out.push({ kind: "text", text: buf.join("\n").trim() });
        buf.length = 0;
        out.push({ kind: "image", url: m[1] });
      } else if (ln.trim() !== "[IMAGE]") buf.push(ln);
    }
    /* ตกหล่น [SPLIT] กลางบรรทัด → ไม่ให้ลูกค้าเห็นคำนี้ */
    const t = buf.join("\n").replace(/\s*\[SPLIT\]\s*/g, "\n").trim();
    if (t) out.push({ kind: "text", text: t });
  }
  /* LINE ส่งได้ไม่เกิน 5 ข้อความต่อครั้ง — เกินนั้นรวมข้อความท้าย ๆ เข้าด้วยกัน */
  const cap = Math.max(1, Math.min(5, maxB || 5));
  while (out.length > cap) {
    const i = out.length - 1, prev = out[i - 1], last = out[i];
    if (prev.kind === "text" && last.kind === "text") { prev.text += "\n" + last.text; out.pop(); }
    else { const j = out.map((b) => b.kind).lastIndexOf("text", i - 1); if (j > 0 && out[j - 1].kind === "text") { out[j - 1].text += "\n" + out[j].text; out.splice(j, 1); } else out.splice(i - 1, 1); }
  }
  return out;
}
function lineMsgs(bubbles) {
  return bubbles.map((b) => b.kind === "image"
    ? { type: "image", originalContentUrl: b.url, previewImageUrl: b.url }
    : { type: "text", text: b.text.slice(0, 4900) });
}

/* เบอร์ไทย 9–10 หลัก (มีขีด/เว้นวรรคได้) */
export function findPhone(text) {
  const m = String(text || "").replace(/[๐-๙]/g, (d) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d))).match(/(?:\+66|0)[\s-]?\d(?:[\s-]?\d){7,8}/);
  if (!m) return "";
  let p = m[0].replace(/[\s-]/g, "");
  if (p.indexOf("+66") === 0) p = "0" + p.slice(3);
  return /^0\d{8,9}$/.test(p) ? p : "";
}

async function history(db, convoId, n) {
  const rs = (await db.prepare("SELECT dir, kind, text, created_at FROM chat_msgs WHERE convo_id = ? ORDER BY created_at DESC LIMIT ?").bind(convoId, n).all()).results || [];
  return rs.reverse().map((r) => ({
    role: r.dir === "in" ? "user" : "assistant",
    content: r.kind === "text" ? (r.text || "") : r.kind === "image" ? "[ลูกค้าส่งรูป]" : r.kind === "sticker" ? "[สติกเกอร์]" : "[" + r.kind + "]",
  })).filter((t) => t.content);
}

/* ---------- ตอบแชทจริง (เรียกจาก webhook และแชทจำลองในกล่องแชท) ---------- */
export async function botMaybeReply(env, db, ch, convoId) {
  try {
    await ensureBotSchema(db);
    const c = await db.prepare("SELECT * FROM chat_convos WHERE id = ?").bind(convoId).first();
    if (!c || c.bot_off || c.blocked) return { skipped: "off" };
    const cfg = await getConfig(db, c.channel_id);
    if (!cfg.enabled) return { skipped: "disabled" };
    if (!inHours(cfg, new Date())) return { skipped: "hours" };
    const pr = await activePrompt(db, c.channel_id);
    if (!pr) return { skipped: "no-prompt" };
    if (!hasKey(env)) return { skipped: "no-key" };
    const turns = await history(db, c.id, cfg.history_n || 16);
    if (!turns.length || turns[turns.length - 1].role !== "user") return { skipped: "no-question" };
    const res = await callModel(env, cfg, pr.text, turns);
    const runId = "br_" + randKey(8), at = nowIso();
    if (!res.ok) {
      await db.prepare("INSERT INTO bot_runs (id,channel_id,convo_id,model,ok,error,ms,created_at) VALUES (?,?,?,?,0,?,?,?)").bind(runId, c.channel_id, c.id, res.model, res.error, res.ms, at).run();
      return { ok: false, error: res.error };
    }
    const bubbles = toBubbles(res.text, cfg.max_b);
    if (!bubbles.length) return { skipped: "empty" };
    /* ระหว่างรอ GPT แอดมินอาจตอบไปแล้ว — เช็คอีกรอบก่อนส่ง */
    const fresh = await db.prepare("SELECT * FROM chat_convos WHERE id = ?").bind(c.id).first();
    if (!fresh || fresh.bot_off || fresh.last_from === "staff") return { skipped: "human" };
    const send = fresh.mock ? { via: "mock", ok: true } : await lineSend(ch || {}, fresh, lineMsgs(bubbles));
    const stmts = [];
    let t = Date.now();
    for (const b of bubbles) {
      stmts.push(db.prepare("INSERT INTO chat_msgs (id,convo_id,dir,kind,text,media_key,staff_id,sent_via,status,error,mock,created_at) VALUES (?,?,'out',?,?,'',NULL,'bot',?,?,?,?)")
        .bind("cm_" + randKey(8), c.id, b.kind, b.kind === "image" ? b.url : b.text, send.ok ? "ok" : "fail", send.error || "", fresh.mock ? 1 : 0, new Date(t++).toISOString()));
    }
    const lastB = bubbles[bubbles.length - 1];
    if (send.ok) {
      stmts.push(db.prepare("UPDATE chat_convos SET status = CASE WHEN status = 'closed' THEN status ELSE 'waiting' END, last_msg_at = ?, last_msg_text = ?, last_from = 'bot', " +
        "waiting_since = NULL, reply_token = CASE WHEN ? THEN '' ELSE reply_token END, updated_at = ? WHERE id = ?")
        .bind(at, (lastB.kind === "image" ? "[รูปภาพ]" : lastB.text).slice(0, 200), send.usedReply ? 1 : 0, at, c.id));
    }
    stmts.push(db.prepare("INSERT INTO bot_runs (id,channel_id,convo_id,model,in_tok,cache_tok,out_tok,cost_usd,ms,bubbles,ok,error,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(runId, c.channel_id, c.id, res.model, res.inTok, res.cacheTok, res.outTok, res.cost, res.ms, bubbles.length, send.ok ? 1 : 0, send.error || "", at));
    await db.batch(stmts);
    await captureLead(env, db, ch, fresh, cfg, turns);
    return { ok: send.ok, bubbles: bubbles.length };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

/* ลูกค้าพิมพ์เบอร์มา → เก็บในแชท + สร้างลีดใน CRM (ครั้งเดียวต่อแชท) + แจ้งเตือนทีม */
async function captureLead(env, db, ch, c, cfg, turns) {
  const userTexts = turns.filter((x) => x.role === "user").map((x) => x.content);
  let phone = "";
  for (let i = userTexts.length - 1; i >= 0 && !phone; i--) phone = findPhone(userTexts[i]);
  if (!phone) return;
  const at = nowIso();
  if (!c.phone) await db.prepare("UPDATE chat_convos SET phone = ? WHERE id = ?").bind(phone, c.id).run();
  if (!cfg.lead_on || c.lead_id) return;
  const id = "ld_" + randKey(8);
  const interest = userTexts.filter((x) => !findPhone(x)).slice(-4).join(" · ").slice(0, 300);
  await db.batch([
    db.prepare("INSERT INTO leads (id,name,phone,line_id,source,source_detail,interest,branch,status,owner_id,est_value,bought_before,lost_reason,next_at,received_at,fb_name,created_by,created_at,updated_at,updated_by) " +
      "VALUES (?,?,?,?,'line',?,?,'', 'new', NULL, 0, 0, '', NULL, ?, '', 'bot', ?, ?, 'bot')")
      .bind(id, c.display_name || "ลูกค้า LINE", phone, c.line_user_id, "Kan Bot · แชท LINE " + ((ch && ch.name) || ""), interest, c.first_contact_at || at, at, at),
    db.prepare("UPDATE chat_convos SET lead_id = ? WHERE id = ?").bind(id, c.id),
  ]);
  try {
    const rs = (await db.prepare("SELECT id, role, sections, perms FROM staff WHERE active = 1 AND pending = 0").all()).results || [];
    const to = rs.filter((r) => { let p = null; try { p = r.perms ? JSON.parse(r.perms) : null; } catch (e) { p = null; }
      return r.role !== "owner" && ((p && (p.leads === "edit" || p.chat === "edit")) || String(r.sections || "").split(",").indexOf("crm") !== -1); }).map((r) => r.id);
    if (to.length) await db.batch(to.map((sid) => db.prepare(
      "INSERT OR IGNORE INTO push_outbox (staff_id, kind, ref, title, body, url, created_at) VALUES (?, 'chat', ?, ?, ?, ?, ?)"
    ).bind(sid, "lead:" + id, "Kan Bot ได้เบอร์ลูกค้า · " + (c.display_name || "ลูกค้า"), phone.slice(0, 3) + "-XXX-" + phone.slice(-4) + " · " + interest.slice(0, 80), "/tasks/#/lead/" + id, at)));
  } catch (e) { /* แจ้งเตือนพังไม่ควรทำให้ลีดหาย */ }
}

/* ---------- API หลังบ้าน /api/t/bot/* ---------- */
export async function handleBotApi(env, db, request, url, path, method, me, lvl, isOwner) {
  /* ตารางเพจ (line_channels) กับแชทต้องมีก่อน — ระบบใหม่ที่ยังไม่เคยเปิดหน้าบรอดแคสต์/แชทจะยังไม่มี */
  await ensureBlastSchema(db);
  await ensureChatSchema(db);
  await ensureBotSchema(db);
  if (lvl === "none" && !isOwner) return json({ error: "ไม่มีสิทธิ์ใช้แชทบอท" }, 403);
  const canEdit = isOwner || lvl === "edit";
  const now = nowIso();

  if (path === "/bot/state" && method === "GET") {
    const chs = ((await db.prepare("SELECT id, name, color FROM line_channels WHERE chat = 1 AND active = 1 ORDER BY sort, name").all()).results || []);
    const cfgs = {}, prompts = {};
    for (const c of chs) {
      cfgs[c.id] = await getConfig(db, c.id);
      const p = await activePrompt(db, c.id);
      prompts[c.id] = p ? { id: p.id, version: p.version, text: p.text, note: p.note, at: p.created_at, by: p.created_by } : null;
    }
    const month = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);
    const st = (await db.prepare("SELECT channel_id, sim, COUNT(*) n, SUM(cost_usd) usd, SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) fails FROM bot_runs WHERE created_at >= ? GROUP BY channel_id, sim")
      .bind(month + "-01").all()).results || [];
    const leads = await db.prepare("SELECT COUNT(*) n FROM leads WHERE created_by = 'bot' AND created_at >= ?").bind(month + "-01").first();
    return json({ channels: chs, configs: cfgs, prompts, models: BOT_MODELS, usdThb: USD_THB, hasKey: hasKey(env),
      provider: env.OPENROUTER_API_KEY ? "openrouter" : env.OPENAI_API_KEY ? "openai" : "", canEdit,
      month: { runs: st, leads: (leads && leads.n) || 0 }, defaultChannel: DEFAULT_CHANNEL });
  }
  if (path === "/bot/config" && method === "PUT") {
    if (!canEdit) return json({ error: "ดูได้อย่างเดียว" }, 403);
    const b = await readBody(request);
    const chId = String(b.channelId || "");
    const ch = await db.prepare("SELECT id FROM line_channels WHERE id = ?").bind(chId).first();
    if (!ch) return json({ error: "ไม่พบเพจ" }, 404);
    const cur = await getConfig(db, chId);
    const model = BOT_MODELS.some((m) => m.id === b.model) ? b.model : cur.model;
    const minB = Math.max(1, Math.min(3, +b.minB || cur.min_b)), maxB = Math.max(minB, Math.min(5, +b.maxB || cur.max_b));
    const hm = (s, d) => /^\d{1,2}:\d{2}$/.test(String(s || "")) ? String(s) : d;
    if (b.enabled && !(await activePrompt(db, chId))) return json({ error: "ใส่ prompt ก่อนเปิดบอท" }, 400);
    await db.prepare("INSERT INTO bot_config (channel_id,enabled,model,min_b,max_b,hours_on,hours_from,hours_to,lead_on,history_n,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) " +
      "ON CONFLICT(channel_id) DO UPDATE SET enabled=excluded.enabled, model=excluded.model, min_b=excluded.min_b, max_b=excluded.max_b, hours_on=excluded.hours_on, " +
      "hours_from=excluded.hours_from, hours_to=excluded.hours_to, lead_on=excluded.lead_on, history_n=excluded.history_n, updated_at=excluded.updated_at, updated_by=excluded.updated_by")
      .bind(chId, b.enabled === undefined ? cur.enabled : (b.enabled ? 1 : 0), model, minB, maxB,
        b.hoursOn === undefined ? cur.hours_on : (b.hoursOn ? 1 : 0), hm(b.hoursFrom, cur.hours_from), hm(b.hoursTo, cur.hours_to),
        b.leadOn === undefined ? cur.lead_on : (b.leadOn ? 1 : 0), Math.max(4, Math.min(40, +b.historyN || cur.history_n)), now, me.id).run();
    return json({ ok: true, config: await getConfig(db, chId) });
  }
  if (path === "/bot/prompt" && method === "POST") {
    if (!canEdit) return json({ error: "ดูได้อย่างเดียว" }, 403);
    const b = await readBody(request);
    const chId = String(b.channelId || ""), text = String(b.text || "").trim();
    if (!text) return json({ error: "prompt ว่าง" }, 400);
    if (text.length > 60000) return json({ error: "prompt ยาวเกิน 60,000 ตัวอักษร" }, 400);
    const last = await db.prepare("SELECT MAX(version) v FROM bot_prompts WHERE channel_id = ?").bind(chId).first();
    const v = ((last && last.v) || 0) + 1, id = "bp_" + randKey(8);
    await db.batch([
      db.prepare("UPDATE bot_prompts SET active = 0 WHERE channel_id = ?").bind(chId),
      db.prepare("INSERT INTO bot_prompts (id,channel_id,version,text,note,active,created_by,created_at) VALUES (?,?,?,?,?,1,?,?)").bind(id, chId, v, text, String(b.note || "").slice(0, 200), me.id, now),
    ]);
    return json({ ok: true, id, version: v });
  }
  if (path === "/bot/prompts" && method === "GET") {
    const chId = url.searchParams.get("ch") || "";
    const rs = (await db.prepare("SELECT id, version, note, active, created_by, created_at, LENGTH(text) len FROM bot_prompts WHERE channel_id = ? ORDER BY version DESC LIMIT 30").bind(chId).all()).results || [];
    return json({ versions: rs.map((r) => ({ id: r.id, version: r.version, note: r.note, active: !!r.active, by: r.created_by, at: r.created_at, len: r.len })) });
  }
  const pm = path.match(/^\/bot\/prompts\/(bp_[0-9a-f]{16})(\/activate)?$/);
  if (pm) {
    const row = await db.prepare("SELECT * FROM bot_prompts WHERE id = ?").bind(pm[1]).first();
    if (!row) return json({ error: "ไม่พบเวอร์ชันนี้" }, 404);
    if (!pm[2] && method === "GET") return json({ id: row.id, version: row.version, text: row.text, note: row.note, active: !!row.active, at: row.created_at });
    if (pm[2] && method === "POST") {
      if (!canEdit) return json({ error: "ดูได้อย่างเดียว" }, 403);
      await db.batch([
        db.prepare("UPDATE bot_prompts SET active = 0 WHERE channel_id = ?").bind(row.channel_id),
        db.prepare("UPDATE bot_prompts SET active = 1 WHERE id = ?").bind(row.id),
      ]);
      return json({ ok: true });
    }
  }
  /* แชทจำลอง — ลองคุยกับบอทโดยไม่แตะลูกค้าจริง · ใช้ prompt ที่ยังไม่บันทึกได้ (draft) */
  if (path === "/bot/sim" && method === "POST") {
    const b = await readBody(request);
    const chId = String(b.channelId || "");
    if (!hasKey(env)) return json({ error: "ยังไม่ได้ใส่ API key ของ GPT ที่เซิร์ฟเวอร์ (OPENROUTER_API_KEY)" }, 400);
    const cfg = Object.assign({}, await getConfig(db, chId));
    if (b.model && BOT_MODELS.some((m) => m.id === b.model)) cfg.model = b.model;
    const pr = b.prompt ? { text: String(b.prompt) } : await activePrompt(db, chId);
    if (!pr || !pr.text) return json({ error: "ยังไม่มี prompt" }, 400);
    const turns = (Array.isArray(b.turns) ? b.turns : []).slice(-(cfg.history_n || 16)).map((t) => ({
      role: t.role === "assistant" ? "assistant" : "user", content: String(t.text || "").slice(0, 2000),
    })).filter((t) => t.content);
    if (!turns.length || turns[turns.length - 1].role !== "user") return json({ error: "พิมพ์ข้อความลูกค้าก่อน" }, 400);
    const res = await callModel(env, cfg, pr.text, turns);
    await db.prepare("INSERT INTO bot_runs (id,channel_id,model,sim,in_tok,cache_tok,out_tok,cost_usd,ms,bubbles,ok,error,created_at) VALUES (?,?,?,1,?,?,?,?,?,?,?,?,?)")
      .bind("br_" + randKey(8), chId, res.model, res.inTok || 0, res.cacheTok || 0, res.outTok || 0, res.cost || 0, res.ms || 0, 0, res.ok ? 1 : 0, res.error || "", now).run();
    if (!res.ok) return json({ error: "GPT ตอบไม่สำเร็จ: " + res.error }, 502);
    const bubbles = toBubbles(res.text, cfg.max_b);
    const lastUser = turns[turns.length - 1].content;
    return json({ raw: res.text, bubbles, phone: findPhone(lastUser), usage: { inTok: res.inTok, cacheTok: res.cacheTok, outTok: res.outTok, usd: res.cost, thb: res.cost * USD_THB, ms: res.ms, model: res.model } });
  }
  return json({ error: "ไม่รู้จักคำสั่ง" }, 404);
}
