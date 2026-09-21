// ============================================================
// KAN — บอตแจ้งงานเข้ากลุ่ม Lark วันละ 3 รอบ (10:00 · 14:30 · 17:30 เวลาไทย)
// ------------------------------------------------------------
// webhook ของกลุ่มเก็บเป็น secret ชื่อ LARK_KAN_WEBHOOK (wrangler secret put)
// ไม่อยู่ในโค้ด — repo นี้อ่านได้สาธารณะ
// ตัว cron ตั้งใน wrangler.jsonc เป็นเวลา UTC (ไทย −7 ชม.)
// ทดสอบด้วยมือ: GET /api/lark/preview (หัวหน้า) ดูข้อความโดยไม่ส่ง
//               POST /api/lark/send    (หัวหน้า) ส่งจริงทันที
// ถาม-ตอบในแชท: พิมพ์ "นักล่า เช็ค" (หรือ @บอต) → ตอบสรุปชุดเดียวกันทันที
//               ใช้ Lark App (ไม่ใช่ webhook) secret: LARK_APP_ID / LARK_APP_SECRET
//               ตัวเลือก: LARK_VERIFY_TOKEN / LARK_ENCRYPT_KEY  · event → POST /api/lark/event
// ============================================================

const TH = 7 * 3600000;
const DAY_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
const MON_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const STATUS_TH = { todo: "รอทำ", doing: "กำลังทำ", review: "รอตรวจ", done: "เสร็จแล้ว", blocked: "ติดปัญหา" };

function thNow() { return new Date(Date.now() + TH); }
function thDate(iso) {
  const d = new Date(new Date(iso).getTime() + TH);
  return d.getUTCDate() + " " + MON_TH[d.getUTCMonth()];
}
function thTime(iso) {
  const d = new Date(new Date(iso).getTime() + TH);
  return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
}
function short(name) { return String(name || "").split(/\s+/)[0]; }
function daysAgo(iso) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }

/* ---------- รวบรวมงาน ---------- */
export async function buildDigest(db) {
  const now = thNow();
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  /* ขอบวันแบบไทย แปลงกลับเป็น UTC */
  const dayStart = new Date(Date.UTC(y, m, d, 0, 0, 0) - TH).toISOString();
  const dayEnd = new Date(Date.UTC(y, m, d + 1, 0, 0, 0) - TH).toISOString();
  const nowIso = new Date().toISOString();

  const rows = await db.prepare(
    "SELECT t.id, t.title, t.status, t.due_at, t.repeat, t.updated_at, t.parent_id, t.stage, " +
    "(SELECT GROUP_CONCAT(s.name, '|') FROM task_assignees a JOIN staff s ON s.id = a.staff_id WHERE a.task_id = t.id) AS who " +
    "FROM tasks t WHERE t.status <> 'done' AND t.task_kind <> 'routine' AND t.repeat = '' " +
    "ORDER BY t.due_at"
  ).all();
  const open = (rows.results || []).map((r) => ({
    id: r.id, title: r.title, status: r.status, dueAt: r.due_at, updatedAt: r.updated_at,
    stage: r.stage, parentId: r.parent_id,
    who: r.who ? String(r.who).split("|").map(short) : [],
  }));

  const dueToday = open.filter((t) => t.dueAt && t.dueAt >= dayStart && t.dueAt < dayEnd);
  const late = open.filter((t) => t.dueAt && t.dueAt < dayStart);
  const review = open.filter((t) => t.status === "review");
  const blocked = open.filter((t) => t.status === "blocked");
  /* ค้างไม่อัปเดต = ยังไม่เสร็จ และไม่มีใครแตะเกิน 3 วัน (ไม่นับที่เพิ่งสั่งวันนี้) */
  /* งานที่เลยกำหนดอยู่แล้วไม่ต้องซ้ำในหมวดนี้ — บอกว่าเงียบกี่วันไว้ในบรรทัดเลยกำหนดแทน */
  const stale = open.filter((t) => t.status !== "review" && daysAgo(t.updatedAt) >= 3 && !dueToday.includes(t) && !late.includes(t));

  /* งานประจำที่ยังไม่ติ๊กวันนี้ */
  const rr = await db.prepare(
    "SELECT t.id, t.title, t.due_at, t.done_at, " +
    "(SELECT GROUP_CONCAT(s.name, '|') FROM task_assignees a JOIN staff s ON s.id = a.staff_id WHERE a.task_id = t.id) AS who " +
    "FROM tasks t WHERE t.repeat = 'daily' AND t.parent_id IS NULL"
  ).all();
  const routineOpen = (rr.results || []).filter((r) => !(r.done_at && r.done_at >= dayStart)).map((r) => ({
    id: r.id, title: r.title, dueAt: r.due_at, who: r.who ? String(r.who).split("|").map(short) : [],
  }));

  return { now, dueToday, late, review, blocked, stale, routineOpen, openCount: open.length };
}

/* ---------- แต่งข้อความ ---------- */
function line(t, withDue) {
  const who = t.who && t.who.length ? " — " + t.who.join(", ") : " — ยังไม่มีคนรับ";
  const due = withDue && t.dueAt ? " (" + thDate(t.dueAt) + ")" : "";
  const quiet = daysAgo(t.updatedAt) >= 3 ? " · เงียบ " + daysAgo(t.updatedAt) + " วัน" : "";
  const tail = t.status === "blocked" ? " ⚠️ติดปัญหา" : "";
  return "• " + t.title + who + due + quiet + tail;
}
function cap(list, n) {
  const out = list.slice(0, n).map((t) => line(t, true));
  if (list.length > n) out.push("  …และอีก " + (list.length - n) + " งาน");
  return out;
}
export function formatDigest(g, slot) {
  const now = g.now;
  const head = "📋 นักล่างาน — " + DAY_TH[now.getUTCDay()] + " " + now.getUTCDate() + " " + MON_TH[now.getUTCMonth()] +
    " · รอบ " + (slot || (String(now.getUTCHours()).padStart(2, "0") + ":" + String(now.getUTCMinutes()).padStart(2, "0")));
  const parts = [head, ""];

  if (g.late.length) {
    parts.push("🔴 เลยกำหนดแล้ว " + g.late.length + " งาน");
    parts.push(...cap(g.late, 8));
    parts.push("");
  }
  if (g.dueToday.length) {
    parts.push("🟠 ต้องเสร็จวันนี้ " + g.dueToday.length + " งาน");
    parts.push(...g.dueToday.map((t) => "• " + t.title + (t.who.length ? " — " + t.who.join(", ") : " — ยังไม่มีคนรับ") + (t.dueAt ? " " + thTime(t.dueAt) : "")));
    parts.push("");
  }
  if (g.stale.length) {
    parts.push("⏳ ค้างไม่มีอัปเดตเกิน 3 วัน " + g.stale.length + " งาน");
    parts.push(...g.stale.slice(0, 8).map((t) => "• " + t.title + (t.who.length ? " — " + t.who.join(", ") : "") + " (เงียบ " + daysAgo(t.updatedAt) + " วัน)"));
    if (g.stale.length > 8) parts.push("  …และอีก " + (g.stale.length - 8) + " งาน");
    parts.push("");
  }
  if (g.routineOpen.length) {
    parts.push("🔁 งานประจำที่ยังไม่ติ๊กวันนี้");
    parts.push(...g.routineOpen.map((t) => "• " + t.title + (t.who.length ? " — " + t.who.join(", ") : "") + (t.dueAt ? " ก่อน " + thTime(t.dueAt) : "")));
    parts.push("");
  }
  if (g.review.length) {
    parts.push("🔵 รอหัวหน้าตรวจ " + g.review.length + " งาน");
    parts.push(...g.review.slice(0, 6).map((t) => "• " + t.title + (t.who.length ? " — " + t.who.join(", ") : "")));
    parts.push("");
  }
  if (!g.late.length && !g.dueToday.length && !g.stale.length && !g.routineOpen.length) {
    parts.push(g.person ? "✅ " + g.person + " ไม่มีงานค้าง เยี่ยม" : "✅ วันนี้ไม่มีอะไรค้าง เยี่ยม");
    parts.push("");
  }
  parts.push("อัปเดตที่ admin.kan-hub.com/tasks");
  return parts.join("\n");
}

/* ---------- ส่งเข้า Lark ---------- */
export async function sendLark(webhook, text) {
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ msg_type: "text", content: { text } }),
  });
  const body = await res.text();
  let j = {};
  try { j = JSON.parse(body); } catch (e) { /* ไม่ใช่ json */ }
  if (!res.ok || (j.code && j.code !== 0)) throw new Error("Lark ตอบ " + res.status + ": " + body.slice(0, 200));
  return j;
}

/* ============================================================
   กลุ่ม "เตือนตรวจงาน" — เด้งเข้ามือถือหัวหน้าทันทีที่มีคนส่งงานมาตรวจ
   ------------------------------------------------------------
   ส่งผ่าน Lark App (บอต "นักล่า Non Assistant" ที่เชิญเข้ากลุ่มแล้ว) ไม่ใช่ webhook
   เพราะ webhook ผูกกลุ่มเดียวและต้องไปก๊อป URL มาใส่ secret ใหม่ทุกครั้งที่เปลี่ยนกลุ่ม
   chat_id ของกลุ่มหาเองจากชื่อกลุ่ม แล้วจำไว้ใน task_settings (ครั้งแรกครั้งเดียว)
   อยากล็อกกลุ่มตายตัว → ตั้ง secret LARK_REVIEW_CHAT_ID · เปลี่ยนชื่อกลุ่ม → LARK_REVIEW_CHAT_NAME
   ============================================================ */

const REVIEW_CHAT_KEY = "lark_review_chat_id";
const REVIEW_CHAT_NAME = "เตือนตรวจงาน";
const REVIEW_LINK = "https://admin.kan-hub.com/tasks/#/review";

function reviewOn(env) { return !!(env.LARK_APP_ID && env.LARK_APP_SECRET); }

export async function reviewChatId(env, db, force) {
  if (env.LARK_REVIEW_CHAT_ID) return env.LARK_REVIEW_CHAT_ID;
  if (!force) {
    const row = await db.prepare("SELECT value FROM task_settings WHERE key = ?").bind(REVIEW_CHAT_KEY).first();
    if (row && row.value) return row.value;
  }
  const want = env.LARK_REVIEW_CHAT_NAME || REVIEW_CHAT_NAME;
  const j = await larkCall(env, "GET", "/im/v1/chats?page_size=100");
  const items = (j.data && j.data.items) || [];
  /* ชื่อตรงเป๊ะก่อน ไม่เจอค่อยเอาที่มีคำนั้นอยู่ (เผื่อมี emoji หรือเว้นวรรคต่อท้าย) */
  const hit = items.find((c) => c.name === want) ||
              items.find((c) => String(c.name || "").indexOf(want) >= 0);
  if (!hit) {
    throw new Error('ไม่เจอกลุ่มชื่อ "' + want + '" ที่บอตอยู่ด้วย (เห็น ' + items.length +
      ' กลุ่ม: ' + items.map((c) => c.name).join(", ").slice(0, 200) + ') — เชิญบอตเข้ากลุ่มแล้วหรือยัง');
  }
  await db.prepare("INSERT OR REPLACE INTO task_settings (key,value) VALUES (?,?)").bind(REVIEW_CHAT_KEY, hit.chat_id).run();
  return hit.chat_id;
}

async function sendToChat(env, chatId, text) {
  return larkCall(env, "POST", "/im/v1/messages?receive_id_type=chat_id",
    { receive_id: chatId, msg_type: "text", content: JSON.stringify({ text }) });
}

/* @ทุกคนในกลุ่ม — กลุ่มนี้มีแค่หัวหน้ากับบอต การ @ จึงเท่ากับเตือนหัวหน้า
   และ Lark จะดัน push ขึ้นมือถือให้ (ข้อความธรรมดาบางทีเงียบถ้าปิดแจ้งเตือนกลุ่มไว้) */
const AT_ALL = '<at user_id="all"></at>';

function waited(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return m + " นาที";
  if (m < 1440) return Math.floor(m / 60) + " ชม.";
  return Math.floor(m / 1440) + " วัน";
}

/* เรียกตอนมีคนกดส่งงานให้ตรวจ — ห้าม throw ออกไป ไม่งั้นการบันทึกงานพังตามไปด้วย */
export async function notifyReviewSubmitted(env, db, item) {
  if (!reviewOn(env)) return;
  try {
    const chat = await reviewChatId(env, db);
    await sendToChat(env, chat, [
      AT_ALL + " มีงานส่งมาให้ตรวจ",
      "• " + item.title + " — " + short(item.by),
      "ปัดตรวจ: " + REVIEW_LINK,
    ].join("\n"));
  } catch (e) {
    console.error("lark review ping:", e && e.message);
  }
}

/* รอบเตือนซ้ำ (20:00 ไทย) — ส่งเฉพาะตอนมีของดองจริง ไม่มีของค้างก็เงียบ ไม่ต้องรายงานว่าว่าง */
export async function reviewReminder(env) {
  if (!reviewOn(env)) return { sent: false, why: "ยังไม่ได้ตั้ง LARK_APP_ID/LARK_APP_SECRET" };
  const db = env.KAN_ERP;
  if (!db) return { sent: false, why: "ยังไม่ได้ผูกฐานข้อมูล" };
  const rows = await db.prepare(
    "SELECT t.id, t.title, t.submitted_at, t.updated_at, " +
    "(SELECT GROUP_CONCAT(s.name, '|') FROM task_assignees a JOIN staff s ON s.id = a.staff_id WHERE a.task_id = t.id) AS who " +
    "FROM tasks t WHERE t.status = 'review' ORDER BY COALESCE(t.submitted_at, t.updated_at)"
  ).all();
  const list = rows.results || [];
  if (!list.length) return { sent: false, why: "ไม่มีงานรอตรวจ" };
  const text = [
    AT_ALL + " ยังไม่ได้ตรวจ " + list.length + " งาน",
    ...list.slice(0, 15).map((r) => {
      const who = r.who ? String(r.who).split("|").map(short).join(", ") : "ไม่มีคนรับ";
      return "• " + r.title + " — " + who + " · ค้างมา " + waited(r.submitted_at || r.updated_at);
    }),
    list.length > 15 ? "…และอีก " + (list.length - 15) + " งาน" : "",
    "งานพวกนี้จะยังไม่สมบูรณ์จนกว่าจะตรวจ",
    "ปัดตรวจ: " + REVIEW_LINK,
  ].filter(Boolean).join("\n");
  const chat = await reviewChatId(env, db);
  await sendToChat(env, chat, text);
  return { sent: true, count: list.length, text };
}

/* ---------- ตัวจับเวลา: 03:00 / 07:30 / 10:30 UTC = 10:00 / 14:30 / 17:30 ไทย ---------- */
export async function runScheduled(event, env) {
  const h = new Date(event.scheduledTime + TH).getUTCHours();
  /* 20:00 ไทย = รอบเตือนงานที่ดองรอตรวจ เข้ากลุ่ม "เตือนตรวจงาน" คนละช่องกับ digest ทีม */
  if (h === 20) {
    try { await reviewReminder(env); } catch (e) { console.error("lark review reminder:", e && e.message); }
    return;
  }
  if (!env.LARK_KAN_WEBHOOK) return;
  const db = env.KAN_ERP;
  const g = await buildDigest(db);
  const slot = h === 10 ? "เช้า 10:00" : (h === 14 ? "บ่าย 14:30" : (h === 17 ? "เย็น 17:30" : null));
  /* เสาร์อาทิตย์ส่งเฉพาะรอบเช้า พอให้รู้ว่ามีอะไรค้าง */
  const dow = g.now.getUTCDay();
  if ((dow === 0 || dow === 6) && h !== 10) return;
  await sendLark(env.LARK_KAN_WEBHOOK, formatDigest(g, slot));
}

const jsonRes = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { "content-type": "application/json; charset=utf-8" } });

/* ---------- ทดสอบด้วยมือ (หัวหน้าเท่านั้น) ---------- */
export async function handleLarkApi(request, env, url, me) {
  if (!me || me.role !== "owner") return new Response(JSON.stringify({ error: "เฉพาะหัวหน้าทีม" }), { status: 403, headers: { "content-type": "application/json; charset=utf-8" } });
  const g = await buildDigest(env.KAN_ERP);
  const text = formatDigest(g, null);
  if (url.pathname === "/api/lark/preview") {
    return new Response(JSON.stringify({ text, counts: { late: g.late.length, dueToday: g.dueToday.length, stale: g.stale.length, review: g.review.length, routineOpen: g.routineOpen.length }, configured: !!env.LARK_KAN_WEBHOOK }), { headers: { "content-type": "application/json; charset=utf-8" } });
  }
  if (url.pathname === "/api/lark/send" && request.method === "POST") {
    if (!env.LARK_KAN_WEBHOOK) return new Response(JSON.stringify({ error: "ยังไม่ได้ตั้ง LARK_KAN_WEBHOOK" }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
    await sendLark(env.LARK_KAN_WEBHOOK, text);
    return new Response(JSON.stringify({ ok: true, sent: text.length }), { headers: { "content-type": "application/json; charset=utf-8" } });
  }
  /* ตั้งค่ากลุ่ม "เตือนตรวจงาน": ดูว่าบอตเห็นกลุ่มไหนบ้าง / จับ chat_id ใหม่ / ยิงเตือนทดสอบ */
  if (url.pathname === "/api/lark/chats") {
    if (!env.LARK_APP_ID || !env.LARK_APP_SECRET) return jsonRes({ error: "ยังไม่ได้ตั้ง LARK_APP_ID/LARK_APP_SECRET" }, 500);
    try {
      const j = await larkCall(env, "GET", "/im/v1/chats?page_size=100");
      const items = ((j.data && j.data.items) || []).map((c) => ({ chatId: c.chat_id, name: c.name }));
      let picked = null, err = null;
      try { picked = await reviewChatId(env, env.KAN_ERP, url.searchParams.get("refresh") === "1"); } catch (e) { err = e.message; }
      return jsonRes({ chats: items, reviewChatId: picked, error: err });
    } catch (e) { return jsonRes({ error: e.message }, 500); }
  }
  if (url.pathname === "/api/lark/review" && request.method === "POST") {
    try { return jsonRes(await reviewReminder(env)); } catch (e) { return jsonRes({ error: e.message }, 500); }
  }
  return new Response("Not found", { status: 404 });
}

/* ============================================================
   โหมดถาม-ตอบ — "นักล่า เช็ค" ในกลุ่ม / @บอต / ทักบอตตรง
   Lark ยิง event im.message.receive_v1 มาที่ POST /api/lark/event
   ต้องตอบ 200 ใน 3 วิ ไม่งั้นยิงซ้ำ → ตอบก่อน แล้วค่อยส่งข้อความผ่าน ctx.waitUntil
   ============================================================ */
const LARK_API = "https://open.larksuite.com/open-apis";

/* ชื่อเล่นที่คนพิมพ์ → คำแรกของชื่อใน staff (ที่ digest ใช้) */
const NICK = {
  "พิซซ่า": "Pizza", "pizza": "Pizza", "จุฬาลักษณ์": "Pizza",
  "เติ้ล": "Title", "title": "Title", "ฐิติมา": "Title",
  "ต้น": "Ton", "ton": "Ton",
  "ออน": "Aon", "aon": "Aon",
  "นนท์": "Nont", "nont": "Nont",
};
function personFrom(text) {
  const t = text.toLowerCase();
  for (const k of Object.keys(NICK)) if (t.indexOf(k) >= 0) return NICK[k];
  return null;
}
function filterPerson(g, name) {
  const has = (t) => t.who && t.who.indexOf(name) >= 0;
  return Object.assign({}, g, {
    person: name,
    late: g.late.filter(has), dueToday: g.dueToday.filter(has), stale: g.stale.filter(has),
    review: g.review.filter(has), blocked: g.blocked.filter(has), routineOpen: g.routineOpen.filter(has),
  });
}

/* Lark เข้ารหัส payload ถ้าตั้ง Encrypt Key: AES-256-CBC, key = sha256(encryptKey), iv = 16 ไบต์แรก */
async function decryptLark(encryptKey, b64) {
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(encryptKey));
  const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv: data.slice(0, 16) }, key, data.slice(16));
  return new TextDecoder().decode(plain);
}

async function tenantToken(env) {
  const r = await fetch(LARK_API + "/auth/v3/tenant_access_token/internal", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error("Lark token: " + JSON.stringify(j).slice(0, 200));
  return j.tenant_access_token;
}
async function larkCall(env, method, path, body) {
  const tok = await tenantToken(env);
  const r = await fetch(LARK_API + path, {
    method, headers: { "content-type": "application/json", authorization: "Bearer " + tok },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error("Lark " + path + ": " + JSON.stringify(j).slice(0, 200));
  return j;
}
/* ตอบเป็น reply ใต้ข้อความที่ถาม */
function replyLark(env, messageId, text) {
  return larkCall(env, "POST", "/im/v1/messages/" + messageId + "/reply", { msg_type: "text", content: JSON.stringify({ text }) });
}
/* open_id ของบอตเอง ไว้เช็คว่าโดน @ หรือเปล่า (เรียกเฉพาะตอนข้อความมี @ ใครสักคน) */
async function botOpenId(env) {
  try { const j = await larkCall(env, "GET", "/bot/v3/info"); return (j.bot && j.bot.open_id) || null; } catch (e) { return null; }
}

const HELP = [
  "พิมพ์ได้แบบนี้ครับ",
  "• นักล่า เช็ค — งานค้างทั้งทีม",
  "• นักล่า เช็ค พิซซ่า — เฉพาะของคนนั้น (พิซซ่า / เติ้ล / ต้น / ออน / นนท์)",
  "• ทักบอตตรง ๆ แล้วพิมพ์ เช็ค ก็ได้",
].join("\n");

async function answerLark(env, msg, clean) {
  try {
    if (/ช่วย|help|วิธี/i.test(clean) && !/เช็ค|เช็ก|check/i.test(clean)) return await replyLark(env, msg.message_id, HELP);
    let g = await buildDigest(env.KAN_ERP);
    const who = personFrom(clean.replace(/นักล่า/g, ""));
    if (who) g = filterPerson(g, who);
    const now = g.now;
    const slot = "เช็ค " + String(now.getUTCHours()).padStart(2, "0") + ":" + String(now.getUTCMinutes()).padStart(2, "0") + (who ? " · " + who : "");
    await replyLark(env, msg.message_id, formatDigest(g, slot));
  } catch (e) {
    console.error("lark answer", e && e.message);
  }
}

export async function handleLarkEvent(request, env, ctx) {
  if (request.method !== "POST") return jsonRes({ error: "POST only" }, 405);
  if (!env.LARK_APP_ID || !env.LARK_APP_SECRET) return jsonRes({ error: "ยังไม่ได้ตั้ง LARK_APP_ID/LARK_APP_SECRET" }, 500);
  let body = await request.json().catch(() => null);
  if (!body) return jsonRes({ error: "bad json" }, 400);
  if (body.encrypt) {
    if (!env.LARK_ENCRYPT_KEY) return jsonRes({ error: "Lark ส่งแบบเข้ารหัส แต่ worker ไม่มี LARK_ENCRYPT_KEY" }, 400);
    try { body = JSON.parse(await decryptLark(env.LARK_ENCRYPT_KEY, body.encrypt)); } catch (e) { return jsonRes({ error: "decrypt fail" }, 400); }
  }
  const token = body.token || (body.header && body.header.token) || "";
  if (env.LARK_VERIFY_TOKEN && token !== env.LARK_VERIFY_TOKEN) return jsonRes({ error: "token ไม่ตรง" }, 403);

  /* ตอนกด save Request URL ใน Lark — ต้องส่ง challenge กลับ */
  if (body.type === "url_verification") return jsonRes({ challenge: body.challenge });

  const h = body.header || {};
  if (h.event_type !== "im.message.receive_v1") return jsonRes({ ok: true, skip: h.event_type || "no-event" });
  const msg = (body.event && body.event.message) || {};
  if (msg.message_type !== "text") return jsonRes({ ok: true, skip: "not-text" });

  /* กันยิงซ้ำ (Lark ส่งซ้ำถ้าไม่ได้ 200 ทันเวลา) */
  const db = env.KAN_ERP;
  await db.prepare("CREATE TABLE IF NOT EXISTS lark_events (id TEXT PRIMARY KEY, at TEXT NOT NULL)").run();
  const ins = await db.prepare("INSERT OR IGNORE INTO lark_events (id, at) VALUES (?, ?)").bind(h.event_id || msg.message_id, new Date().toISOString()).run();
  if (ins.meta && ins.meta.changes === 0) return jsonRes({ ok: true, dup: true });

  let text = "";
  try { text = JSON.parse(msg.content || "{}").text || ""; } catch (e) { /* ว่าง */ }
  const clean = text.replace(/@_user_\d+/g, " ").replace(/\s+/g, " ").trim();
  const mentions = msg.mentions || [];

  let ask = msg.chat_type === "p2p";                                     /* ทักบอตตรง — ตอบทุกข้อความ */
  if (!ask && /นักล่า/.test(clean) && /เช็ค|เช็ก|check|สรุป|ช่วย|help/i.test(clean)) ask = true;   /* "นักล่า เช็ค" */
  if (!ask && mentions.length) {                                          /* @บอต … */
    const me = await botOpenId(env);
    ask = !!me && mentions.some((m) => m.id && m.id.open_id === me);
  }
  if (!ask) return jsonRes({ ok: true, skip: "not-for-me" });

  ctx.waitUntil(answerLark(env, msg, clean));
  return jsonRes({ ok: true });
}
