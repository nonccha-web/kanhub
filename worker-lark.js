// ============================================================
// KAN — บอตแจ้งงานเข้ากลุ่ม Lark วันละ 3 รอบ (10:00 · 14:30 · 17:30 เวลาไทย)
// ------------------------------------------------------------
// webhook ของกลุ่มเก็บเป็น secret ชื่อ LARK_KAN_WEBHOOK (wrangler secret put)
// ไม่อยู่ในโค้ด — repo นี้อ่านได้สาธารณะ
// ตัว cron ตั้งใน wrangler.jsonc เป็นเวลา UTC (ไทย −7 ชม.)
// ทดสอบด้วยมือ: GET /api/lark/preview (หัวหน้า) ดูข้อความโดยไม่ส่ง
//               POST /api/lark/send    (หัวหน้า) ส่งจริงทันที
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
    parts.push("✅ วันนี้ไม่มีอะไรค้าง เยี่ยม");
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

/* ---------- ตัวจับเวลา: 03:00 / 07:30 / 10:30 UTC = 10:00 / 14:30 / 17:30 ไทย ---------- */
export async function runScheduled(event, env) {
  if (!env.LARK_KAN_WEBHOOK) return;
  const db = env.KAN_ERP;
  const g = await buildDigest(db);
  const h = new Date(event.scheduledTime + TH).getUTCHours();
  const slot = h === 10 ? "เช้า 10:00" : (h === 14 ? "บ่าย 14:30" : (h === 17 ? "เย็น 17:30" : null));
  /* เสาร์อาทิตย์ส่งเฉพาะรอบเช้า พอให้รู้ว่ามีอะไรค้าง */
  const dow = g.now.getUTCDay();
  if ((dow === 0 || dow === 6) && h !== 10) return;
  await sendLark(env.LARK_KAN_WEBHOOK, formatDigest(g, slot));
}

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
  return new Response("Not found", { status: 404 });
}
