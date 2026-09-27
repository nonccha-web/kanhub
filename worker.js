// KAN — routing ตาม hostname
//  admin.kan-hub.com      → เสิร์ฟเนื้อหาใน /admin (หลังบ้าน ERP) + API ที่ /api/*
//  kan-hub.com / www      → เว็บการตลาด (ซ่อน /admin และ /api ไม่ให้เข้าตรง)
//  *.workers.dev          → เข้าได้ทั้งคู่ (ไว้เทสต์)

import { handleTaskApi, ensureTaskSchema, authFor, canSee, loadFlows, handleTicketIntake, handleSaleLead } from "./worker-tasks.js";
import { handleMcp } from "./worker-mcp.js";
import { runScheduled, handleLarkApi, handleLarkEvent } from "./worker-lark.js";
import { runDueBlasts, ensureBlastSchema } from "./worker-blast.js";
import { pushTick } from "./worker-push.js";
const PUSH_CRON = "*/5 * * * *";   /* รอบแจ้งเตือนเด้ง (ใกล้ถึงกำหนด/เลยกำหนด/เก็บตก) — แยกจาก cron บอต Lark */

const MAX_ATTACHMENT_BYTES = 1500000; // ~1.5MB ต่อรูป (ย่อฝั่งเบราว์เซอร์มาก่อนแล้ว)
const MAX_ATTACHMENTS_PER_CAMPAIGN = 6;
const MAX_BULK_CAMPAIGNS = 10;   /* แก้หลายรายการทีเดียว — นนท์: 10 ก็พอ */
const SEP = String.fromCharCode(31); // คั่น id กับชื่อไฟล์ใน GROUP_CONCAT
/* ประเภทรายการในปฏิทิน — เดิมมีแต่ "แคมเปญ" นนท์ขอให้ติ๊กได้ว่าเป็นคอนเทนต์/แคมเปญ/โปรโมชั่น */
const CAMPAIGN_KINDS = ["content", "campaign", "promo"];
/* หมวดย่อย + สีผูกตายตัว (นนท์ 27 ก.ย. 69) — kind เดิมกลายเป็นหมวดใหญ่ของหมวดย่อย
   promo = โปรโมชั่น · campaign = Event / กิจกรรม · content = คอนเทนต์ · สีคิดจากหมวดย่อยเสมอ ผู้ใช้เลือกเองไม่ได้แล้ว */
const CAMPAIGN_SUBS = {
  promo:     { kind: "promo",    color: "#1E9BF0" },   // ฟ้า = โปรโมชั่น
  privilege: { kind: "promo",    color: "#F2B705" },   // เหลือง = สิทธิพิเศษ
  newlot:    { kind: "campaign", color: "#2FA84F" },   // เขียว = ล็อตใหม่
  event:     { kind: "campaign", color: "#F28DB8" },   // ชมพูอ่อน = แคมเปญ/อีเว้นท์
  queue:     { kind: "campaign", color: "#FF8A1F" },   // ส้ม = จองคิว
  closed:    { kind: "campaign", color: "#D6246E" },   // ชมพูเข้ม = ปิดร้าน
  content:   { kind: "content",  color: "#8B5CF6" },   // ม่วง = คอนเทนต์ โพสต์/วิดีโอ
};
const SUB_OF_KIND = { promo: "promo", campaign: "event", content: "content" };
const ACC_STAFF_ID = "s_acc";   /* บัญชีฝ่ายบัญชี — งานตั้งค่าโปรฯ/คูปองในระบบวิ่งมาที่นี่ */

/* ตารางปฏิทินมีข้อมูลจริงแล้ว CREATE IF NOT EXISTS ไม่เติมคอลัมน์ให้ → ALTER แล้วกลืน error "duplicate column"
   ทำครั้งเดียวต่อ isolate เหมือน worker-tasks.js */
let campaignSchemaReady = null;
function ensureCampaignSchema(db, env) {
  if (!campaignSchemaReady) {
    campaignSchemaReady = (async () => {
      await db.batch([
        db.prepare("CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, " +
          "end_date TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'range', status TEXT NOT NULL DEFAULT 'plan', " +
          "channels TEXT NOT NULL DEFAULT '[]', branches TEXT NOT NULL DEFAULT '[]', budget INTEGER NOT NULL DEFAULT 0, " +
          "owner TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, " +
          "color TEXT NOT NULL DEFAULT '#3370FF')"),
        db.prepare("CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, file_name TEXT NOT NULL, " +
          "mime TEXT NOT NULL, bytes INTEGER NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL)"),
        db.prepare("CREATE TABLE IF NOT EXISTS kpi_entries (year INTEGER NOT NULL, month INTEGER NOT NULL, code TEXT NOT NULL, " +
          "value TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', updated_at TEXT NOT NULL, PRIMARY KEY (year, month, code))"),
      ]);
      try { await db.prepare("ALTER TABLE campaigns ADD COLUMN kind TEXT NOT NULL DEFAULT 'campaign'").run(); } catch (e) { /* มีแล้ว */ }
      /* หมวดย่อย · ตารางวัน (หลายช่วง/เวลา/ทำซ้ำ) · งานฝ่ายบัญชี — 27 ก.ย. 69 */
      for (const col of ["sub TEXT NOT NULL DEFAULT ''", "schedule TEXT NOT NULL DEFAULT ''", "acc TEXT NOT NULL DEFAULT ''"]) {
        try { await db.prepare("ALTER TABLE campaigns ADD COLUMN " + col).run(); } catch (e) { /* มีแล้ว */ }
      }
      /* รายการเก่า: ยกเข้าหมวดย่อยตั้งต้นของหมวดใหญ่ + เปลี่ยนสีเป็นสีของหมวด (ทำครั้งเดียว เพราะ sub ถูกเติมแล้ว) */
      await db.batch(Object.keys(SUB_OF_KIND).map((k) =>
        db.prepare("UPDATE campaigns SET sub = ?, color = ? WHERE sub = '' AND kind = ?")
          .bind(SUB_OF_KIND[k], CAMPAIGN_SUBS[SUB_OF_KIND[k]].color, k)));
      /* รูปย่อ ~320px สำหรับปฏิทิน — รูปเต็ม 9 รูป = 3.5MB โหลดครั้งแรกช้า (นนท์ทัก 18 ก.ย. 69) */
      try { await db.prepare("ALTER TABLE attachments ADD COLUMN thumb TEXT").run(); } catch (e) { /* มีแล้ว */ }
      /* ตาราง posts/tasks ต้องมีก่อน เพราะ LIST_SQL นับโพสต์และงานที่ผูกกับแต่ละรายการ */
      await ensureTaskSchema(db, env);
    })().catch((e) => { campaignSchemaReady = null; throw e; });
  }
  return campaignSchemaReady;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function safeParse(s) {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function safeObj(s) {
  try { const v = JSON.parse(s || "null"); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch (e) { return null; }
}
function subOfRow(r) {
  if (CAMPAIGN_SUBS[r.sub]) return r.sub;
  return SUB_OF_KIND[r.kind] || "event";
}

function rowToCampaign(r) {
  const attachments = [];
  if (r.attachment_ids) {
    for (const pair of String(r.attachment_ids).split(",")) {
      if (!pair) continue;
      const [id, fileName] = pair.split(SEP);
      if (id) attachments.push({ id, fileName: fileName || "image" });
    }
  }
  return {
    id: r.id,
    name: r.name,
    start: r.start_date,
    end: r.end_date,
    scope: r.scope,
    status: r.status,
    channels: safeParse(r.channels),
    branches: safeParse(r.branches),
    budget: r.budget,
    owner: r.owner,
    note: r.note,
    color: CAMPAIGN_SUBS[subOfRow(r)].color,
    kind: CAMPAIGN_SUBS[subOfRow(r)].kind,
    sub: subOfRow(r),
    schedule: safeObj(r.schedule),
    acc: safeObj(r.acc),
    posts: { total: r.n_posts || 0, done: r.n_posts_done || 0 },
    tasks: { total: r.n_tasks || 0, open: r.n_tasks_open || 0 },
    attachments: attachments,
    updatedAt: r.updated_at,
  };
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function isoAdd(isoDay, days) {
  const d = new Date(isoDay + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/* ตารางวันของรายการ: หลายช่วงวัน + เวลา + ทำซ้ำ (ครั้งเดียว / ทุกสัปดาห์เลือกวัน / ทุกเดือนช่วงวันเดิม)
   start/end ในตารางหลักยังเก็บ "กรอบนอก" ไว้ (ช่วงแรกสุด → วันสุดท้ายที่มีผล) ให้ของเดิมที่กรองด้วยช่วงวันยังใช้ได้ */
function cleanSchedule(raw) {
  if (!raw || typeof raw !== "object") return { value: null };
  const ranges = (Array.isArray(raw.ranges) ? raw.ranges : []).slice(0, 12)
    .map((x) => ({ s: ISO_RE.test(x && x.s) ? x.s : null, e: ISO_RE.test(x && x.e) ? x.e : null }))
    .filter((x) => x.s)
    .map((x) => ({ s: x.s, e: x.e && x.e >= x.s ? x.e : x.s }))
    .sort((p, q) => (p.s < q.s ? -1 : p.s > q.s ? 1 : 0));
  if (!ranges.length) return { error: "ต้องมีอย่างน้อย 1 ช่วงวัน" };
  const t1 = TIME_RE.test(raw.t1) ? raw.t1 : "";
  const t2 = TIME_RE.test(raw.t2) ? raw.t2 : "";
  const r0 = raw.rep && typeof raw.rep === "object" ? raw.rep : {};
  const type = ["weekly", "monthly"].indexOf(r0.type) !== -1 ? r0.type : "none";
  const rep = { type };
  let end = ranges.reduce((m, x) => (x.e > m ? x.e : m), ranges[0].e);
  if (type !== "none") {
    if (!ISO_RE.test(r0.until) || r0.until < ranges[0].s) return { error: "ทำซ้ำต้องมีวันสิ้นสุด (ถึงวันที่) ที่ไม่มาก่อนวันเริ่ม" };
    if (r0.until > isoAdd(ranges[0].s, 731)) return { error: "ทำซ้ำได้ไม่เกิน 2 ปี" };
    rep.until = r0.until;
    end = r0.until;
    if (type === "weekly") {
      rep.days = (Array.isArray(r0.days) ? r0.days : []).map(Number)
        .filter((d, i, a) => d >= 0 && d <= 6 && Number.isInteger(d) && a.indexOf(d) === i).sort();
      if (!rep.days.length) return { error: "ทำซ้ำทุกสัปดาห์ ต้องเลือกวันอย่างน้อย 1 วัน" };
      ranges.length = 1;   /* ทุกสัปดาห์ใช้แค่วันเริ่ม ช่วงอื่นไม่มีความหมาย */
      ranges[0].e = ranges[0].s;
    }
  }
  /* ช่วงเดียว ไม่มีเวลา ไม่ทำซ้ำ = รายการแบบเดิม ไม่ต้องเก็บตาราง */
  const plain = ranges.length === 1 && !t1 && !t2 && type === "none";
  return { value: plain ? null : { ranges, t1, t2, rep }, start: ranges[0].s, end };
}
function cleanAcc(raw) {
  if (!raw || typeof raw !== "object" || !raw.need) return null;
  return {
    need: true,
    type: raw.type === "coupon" ? "coupon" : "promo",
    detail: String(raw.detail || "").trim().slice(0, 2000),
    taskId: /^[A-Za-z0-9_-]{1,40}$/.test(String(raw.taskId || "")) ? raw.taskId : undefined,
  };
}

function clean(input) {
  const name = String(input.name || "").trim().slice(0, 200);
  let start = ISO_RE.test(input.start) ? input.start : null;
  let end = ISO_RE.test(input.end) ? input.end : start;
  if (!name) return { error: "ต้องมีชื่อแคมเปญ" };
  const sc = input.scope !== "month" && input.schedule ? cleanSchedule(input.schedule) : { value: null };
  if (sc.error) return { error: sc.error };
  if (sc.value) { start = sc.start; end = sc.end; }
  if (!start) return { error: "วันเริ่มไม่ถูกต้อง" };
  if (end < start) return { error: "วันสิ้นสุดมาก่อนวันเริ่ม" };
  /* หมวดย่อยชี้หมวดใหญ่และสี · client เก่า/MCP ที่ส่งมาแค่ kind → ใช้หมวดย่อยตั้งต้นของหมวดนั้น */
  const kind0 = CAMPAIGN_KINDS.indexOf(input.kind) !== -1 ? input.kind : "campaign";
  const sub = CAMPAIGN_SUBS[input.sub] ? input.sub : SUB_OF_KIND[kind0];
  return {
    value: {
      name: name,
      start: start,
      end: end,
      scope: input.scope === "month" ? "month" : "range",
      status: ["plan", "live", "done"].indexOf(input.status) !== -1 ? input.status : "plan",
      channels: JSON.stringify(Array.isArray(input.channels) ? input.channels.slice(0, 20) : []),
      branches: JSON.stringify(Array.isArray(input.branches) ? input.branches.slice(0, 20) : []),
      budget: Math.max(0, Math.round(Number(input.budget) || 0)),
      owner: String(input.owner || "").trim().slice(0, 300),
      note: String(input.note || "").trim().slice(0, 4000),
      color: CAMPAIGN_SUBS[sub].color,
      kind: CAMPAIGN_SUBS[sub].kind,
      sub: sub,
      schedule: sc.value ? JSON.stringify(sc.value) : "",
      acc: cleanAcc(input.acc),
    },
    has: { sub: CAMPAIGN_SUBS[input.sub] ? 1 : 0, schedule: "schedule" in input, acc: "acc" in input },
  };
}

/* ติ๊ก "ให้ฝ่ายบัญชีตั้งค่าในระบบ" → สร้างงานให้ฝ่ายบัญชีครั้งเดียวต่อรายการ ผูกกับรายการในปฏิทิน
   กำหนดส่ง 18:00 วันก่อนเริ่ม (เลยแล้วใช้วันนี้) · งานเดิมยังอยู่ = ไม่สร้างซ้ำ แค่ต่อรายละเอียดใหม่ถ้าแก้ */
async function syncAccTask(db, campId, v, staffId) {
  const acc = v.acc;
  if (!acc || !acc.need) return acc;
  const what = acc.type === "coupon" ? "คูปอง" : "โปรโมชั่น";
  const title = "ตั้งค่า" + what + "ในระบบ — " + v.name;
  const detail = "ฝ่ายการตลาดขอให้ตั้งค่า" + what + "ในระบบ\n" +
    (acc.detail ? acc.detail + "\n" : "") + "ช่วงรายการ: " + v.start + (v.end !== v.start ? " ถึง " + v.end : "") +
    "\n(สร้างอัตโนมัติจากปฏิทินการตลาด)";
  if (acc.taskId) {
    const t = await db.prepare("SELECT id, title, detail FROM tasks WHERE id = ?").bind(acc.taskId).first();
    if (t) {
      if (t.title !== title || t.detail !== detail) {
        await db.prepare("UPDATE tasks SET title = ?, detail = ?, updated_at = ? WHERE id = ? AND status != 'done'")
          .bind(title, detail, new Date().toISOString(), t.id).run();
      }
      return acc;
    }
  }
  const now = new Date().toISOString();
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  let dueDay = isoAdd(v.start, -1);
  if (dueDay < today) dueDay = today;
  const dueAt = new Date(dueDay + "T18:00:00+07:00").toISOString();
  const id = "t_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const accStaff = await db.prepare("SELECT id FROM staff WHERE id = ? AND active = 1").bind(ACC_STAFF_ID).first();
  const stmts = [
    db.prepare(
      "INSERT INTO tasks (id,title,detail,kpi_id,status,due_at,repeat,priority,created_by,created_at,updated_at,done_at,parent_id,campaign_id,task_type,task_kind,hours,support,due_original) " +
      "VALUES (?,?,?,NULL,'todo',?,'',1,?,?,?,NULL,NULL,?,'other','ondemand',NULL,0,?)"
    ).bind(id, title, detail, dueAt, staffId || "system", now, now, campId, dueAt),
    db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind("u_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16), id, staffId || "system", "create", "", "todo", now),
  ];
  if (accStaff) stmts.push(db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, staff_id) VALUES (?,?)").bind(id, ACC_STAFF_ID));
  await db.batch(stmts);
  acc.taskId = id;
  await db.prepare("UPDATE campaigns SET acc = ? WHERE id = ?").bind(JSON.stringify(acc), campId).run();
  return acc;
}

const LIST_SQL =
  "SELECT c.*, GROUP_CONCAT(a.id || char(31) || a.file_name) AS attachment_ids, " +
  "(SELECT COUNT(*) FROM posts p WHERE p.campaign_id = c.id) AS n_posts, " +
  "(SELECT COUNT(*) FROM posts p WHERE p.campaign_id = c.id AND p.status = 'done') AS n_posts_done, " +
  "(SELECT COUNT(*) FROM tasks t WHERE t.campaign_id = c.id AND t.parent_id IS NULL) AS n_tasks, " +
  "(SELECT COUNT(*) FROM tasks t WHERE t.campaign_id = c.id AND t.parent_id IS NULL AND t.status != 'done') AS n_tasks_open " +
  "FROM campaigns c LEFT JOIN attachments a ON a.campaign_id = c.id " +
  "GROUP BY c.id ORDER BY c.start_date ASC";

async function handleApi(request, env, url, ctx) {
  const db = env.KAN_ERP;
  if (!db) return json({ error: "ยังไม่ได้ผูกฐานข้อมูล" }, 503);

  const path = url.pathname.replace(/^\/api/, "");
  const method = request.method;

  // ---- ระบบมอบหมายงานทีม (/api/t/*) — โค้ดอยู่ worker-tasks.js ----
  if (path === "/t" || path.indexOf("/t/") === 0) {
    return handleTaskApi(request, env, url, path.slice(2) || "/", method, ctx);
  }
  // ---- บอต Lark: ดูตัวอย่าง/ส่งด้วยมือ (หัวหน้า) — ตัวจริงยิงตาม cron ใน wrangler.jsonc ----
  if (path === "/lark/preview" || path === "/lark/send" || path === "/lark/chats" || path === "/lark/review" ||
      path === "/lark/tickets") {
    await ensureTaskSchema(db);
    return handleLarkApi(request, env, url, await authFor(request, env));
  }
  await ensureCampaignSchema(db, env);

  /* API ที่เหลือ (ปฏิทิน รูปแนบ KPI) ต้องเข้าสู่ระบบก่อน — เดิมเปิดให้ยิงตรงได้ */
  const who = await authFor(request, env);
  if (!who) return json({ error: "กรุณาเข้าสู่ระบบ", auth: false }, 401);
  if (path === "/kpi" && !canSee(who, "kpi")) return json({ error: "ไม่มีสิทธิ์ดูข้อมูล KPI" }, 403);

  // ---- รูปแนบ ----
  const fileMatch = path.match(/^\/attachments\/([A-Za-z0-9_-]{1,40})$/);
  if (fileMatch && method === "GET") {
    const wantThumb = url.searchParams.get("s") === "thumb";
    const row = await db.prepare("SELECT mime, " + (wantThumb ? "COALESCE(thumb, data) AS data, thumb IS NOT NULL AS is_thumb" : "data, 0 AS is_thumb") + ", file_name FROM attachments WHERE id = ?")
      .bind(fileMatch[1]).first();
    if (!row) return new Response("ไม่พบรูป", { status: 404 });
    const binary = atob(row.data);
    const bin = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bin[i] = binary.charCodeAt(i);
    return new Response(bin, {
      headers: {
        "content-type": row.is_thumb ? "image/jpeg" : (row.mime || "application/octet-stream"),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }
  /* ใส่รูปย่อให้รูปเก่า (สคริปต์ฝั่งเครื่องนนท์ย่อแล้วส่งมา) */
  if (fileMatch && method === "PUT") {
    const body = await request.json().catch(function () { return {}; });
    const m2 = String(body.thumb || "").match(/^data:image\/jpeg;base64,(.+)$/);
    if (!m2 || m2[1].length > 120000) return json({ error: "รูปย่อไม่ถูกต้อง (ต้องเป็น jpeg ≤ 90KB)" }, 400);
    await db.prepare("UPDATE attachments SET thumb = ? WHERE id = ?").bind(m2[1], fileMatch[1]).run();
    return json({ ok: true });
  }
  if (fileMatch && method === "DELETE") {
    await db.prepare("DELETE FROM attachments WHERE id = ?").bind(fileMatch[1]).run();
    return json({ ok: true });
  }


  // ---- KPI ฝ่ายการตลาด ----
  // เก็บบนเซิร์ฟเวอร์แทน localStorage — ทีมเห็นชุดเดียวกัน ล้างเบราว์เซอร์แล้วไม่หาย
  if (path === "/kpi" && method === "GET") {
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
    const res = await db.prepare(
      "SELECT month, code, value, status FROM kpi_entries WHERE year = ? ORDER BY month, code"
    ).bind(year).all();
    // คืนรูปเดียวกับที่หน้าเว็บใช้อยู่: { m5: { "MKT-01": {v,s} }, ... }
    const data = {};
    for (const r of (res.results || [])) {
      const key = "m" + r.month;
      (data[key] = data[key] || {})[r.code] = { v: r.value, s: r.status };
    }
    return json({ year: year, data: data });
  }

  if (path === "/kpi" && method === "PUT") {
    const body = await request.json().catch(function () { return {}; });
    const year = Number(body.year) || new Date().getFullYear();
    const data = body.data && typeof body.data === "object" ? body.data : null;
    if (!data) return json({ error: "ไม่มีข้อมูลให้บันทึก" }, 400);

    const now = new Date().toISOString();
    const stmts = [db.prepare("DELETE FROM kpi_entries WHERE year = ?").bind(year)];
    let n = 0;
    for (const mk of Object.keys(data)) {
      const m = Number(String(mk).replace(/^m/, ""));
      if (!(m >= 0 && m <= 11)) continue;
      const bucket = data[mk] || {};
      for (const code of Object.keys(bucket)) {
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(code)) continue;
        const raw = bucket[code];
        const v = typeof raw === "string" ? raw : (raw && raw.v != null ? String(raw.v) : "");
        const s = typeof raw === "string" ? "ok" : (raw && raw.s ? String(raw.s) : "draft");
        if (["ok", "draft", "na"].indexOf(s) === -1) continue;
        stmts.push(db.prepare(
          "INSERT INTO kpi_entries (year,month,code,value,status,updated_at) VALUES (?,?,?,?,?,?)"
        ).bind(year, m, code, v.slice(0, 200), s, now));
        n++;
        if (stmts.length > 400) return json({ error: "ข้อมูลเยอะเกินไปในครั้งเดียว" }, 413);
      }
    }
    await db.batch(stmts);
    return json({ ok: true, saved: n });
  }

  // ---- แคมเปญ ----
  if (path === "/campaigns" && method === "GET") {
    const res = await db.prepare(LIST_SQL).all();
    return json({ campaigns: (res.results || []).map(rowToCampaign) });
  }

  /* สถานะงานของทุกโปรฯ ในครั้งเดียว — ปฏิทินเอาไปโชว์บนแถบ/การ์ด ไม่ต้องเปิดหน้ากลับไปกลับมา (นนท์ 19 ก.ย. 69)
     ต่อโปรฯ: งานป้าย (ถึงขั้นไหน จากกี่ขั้น เลยกำหนดไหม) · งานอื่น · โพสต์ (ลงแล้ว/ทั้งหมด/เลยวัน) */
  if (path === "/campaigns/status" && method === "GET") {
    const nowIso = new Date().toISOString();
    const todayTh = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const flows = await loadFlows(db);
    const mains = await db.prepare(
      "SELECT id, campaign_id, title, task_type, status, due_at, stage FROM tasks WHERE campaign_id IS NOT NULL AND parent_id IS NULL"
    ).all();
    const subs = await db.prepare(
      "SELECT parent_id, stage, status FROM tasks WHERE stage IS NOT NULL AND parent_id IN (SELECT id FROM tasks WHERE campaign_id IS NOT NULL AND parent_id IS NULL)"
    ).all();
    /* โพสต์แยกช่องทาง — โปรฯ ทุกอันต้องมีสื่ออย่างน้อย LINE (นนท์ 19 ก.ย. 69) */
    const posts = await db.prepare(
      "SELECT campaign_id, status, post_date, channels FROM posts WHERE campaign_id IS NOT NULL"
    ).all();
    const subBy = {};
    for (const r of (subs.results || [])) (subBy[r.parent_id] = subBy[r.parent_id] || []).push(r);
    const out = {};
    const bucket = (cid) => (out[cid] = out[cid] || { signs: [], others: [], posts: { total: 0, done: 0, late: 0 }, chan: {} });
    for (const t of (mains.results || [])) {
      const b = bucket(t.campaign_id);
      const late = t.status !== "done" && !!t.due_at && t.due_at < nowIso;
      const flow = flows[t.task_type] || [];
      if (t.task_type === "signage" || flow.length) {
        const st = subBy[t.id] || [];
        const byK = {}; for (const x of st) byK[x.stage] = x;
        let idx = -1; let cur = null;
        if (st.length) {
          idx = flow.length;   /* ครบทุกขั้น */
          for (let i = 0; i < flow.length; i++) { const x = byK[flow[i].k]; if (!x || x.status !== "done") { idx = i; cur = flow[i]; break; } }
        }
        b.signs.push({ id: t.id, title: t.title, type: t.task_type, status: t.status, late, dueAt: t.due_at,
          nStages: flow.length, stageIdx: t.status === "done" ? flow.length : idx, stageTh: t.status === "done" ? "เสร็จ" : (cur ? cur.th : (st.length ? "เสร็จทุกขั้น" : "ยังไม่ตั้งขั้น")),
          stages: flow.map((f) => ({ k: f.k, th: f.th, done: !!(byK[f.k] && byK[f.k].status === "done"), review: !!(byK[f.k] && byK[f.k].status === "review") })) });
      } else {
        b.others.push({ id: t.id, title: t.title, type: t.task_type, status: t.status, late, dueAt: t.due_at });
      }
    }
    for (const r of (posts.results || [])) {
      const b = bucket(r.campaign_id);
      const done = r.status === "done", late = r.status !== "done" && r.status !== "skip" && r.post_date < todayTh;
      if (r.status === "skip") continue;
      b.posts.total++; if (done) b.posts.done++; if (late) b.posts.late++;
      let chans = [];
      try { chans = JSON.parse(r.channels || "[]"); } catch (e) { chans = []; }
      if (!chans.length) chans = ["อื่น ๆ"];
      for (const c0 of chans) {
        const k = /line/i.test(c0) ? "line" : (/facebook|fb/i.test(c0) ? "fb" : (/tiktok/i.test(c0) ? "tiktok" : (/instagram|ig/i.test(c0) ? "ig" : "other")));
        const c = (b.chan[k] = b.chan[k] || { total: 0, done: 0, late: 0 });
        c.total++; if (done) c.done++; if (late) c.late++;
      }
    }
    return json({ status: out, generated: nowIso });
  }

  if (path === "/campaigns" && method === "POST") {
    const body = await request.json().catch(function () { return {}; });
    const parsed = clean(body);
    if (parsed.error) return json({ error: parsed.error }, 400);
    const v = parsed.value;
    const id = "c" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const now = new Date().toISOString();
    const acc0 = v.acc ? Object.assign({}, v.acc, { taskId: undefined }) : null;
    await db.prepare(
      "INSERT INTO campaigns (id,name,start_date,end_date,scope,status,channels,branches,budget,owner,note,color,created_at,updated_at,kind,sub,schedule,acc) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id, v.name, v.start, v.end, v.scope, v.status, v.channels, v.branches, v.budget,
           v.owner, v.note, v.color, now, now, v.kind, v.sub, v.schedule, acc0 ? JSON.stringify(acc0) : "").run();
    v.acc = acc0;
    const acc = await syncAccTask(db, id, v, who.id);
    return json({ id: id, accTaskId: acc && acc.taskId || null });
  }

  /* ---- แก้หลายรายการทีเดียว (นนท์ 27 ก.ย. 69) — ครั้งละไม่เกิน 10 รายการ ----
     body: { ids, action, ... }
       shift     {days}                       เลื่อนทั้งชุด (รวมหลายช่วง/ทำซ้ำ) ไปข้างหน้า/ถอยหลัง
       dates     {start, end}                 ตั้งช่วงวันใหม่ช่วงเดียว (ล้างหลายช่วง/ทำซ้ำ)
       owner     {mode add|replace|remove, names[]}
       branches  {mode add|replace|remove, names[]}
       status    {status}  ·  sub {sub}  ·  delete */
  if (path === "/campaigns/bulk" && method === "POST") {
    const body = await request.json().catch(function () { return {}; });
    const ids = Array.isArray(body.ids) ? body.ids.filter((x) => /^[A-Za-z0-9_-]{1,40}$/.test(String(x))) : [];
    if (!ids.length) return json({ error: "ยังไม่ได้เลือกรายการ" }, 400);
    if (ids.length > MAX_BULK_CAMPAIGNS) return json({ error: "แก้ได้ครั้งละไม่เกิน " + MAX_BULK_CAMPAIGNS + " รายการ" }, 413);
    const act = String(body.action || "");
    const ph = ids.map(() => "?").join(",");
    const rows = ((await db.prepare("SELECT * FROM campaigns WHERE id IN (" + ph + ")").bind(...ids).all()).results) || [];
    if (!rows.length) return json({ error: "ไม่พบรายการที่เลือก" }, 404);
    const now = new Date().toISOString();

    if (act === "delete") {
      const st = [];
      for (const r of rows) {
        st.push(db.prepare("DELETE FROM attachments WHERE campaign_id = ?").bind(r.id),
          db.prepare("UPDATE posts SET campaign_id = NULL WHERE campaign_id = ?").bind(r.id),
          db.prepare("UPDATE tasks SET campaign_id = NULL WHERE campaign_id = ?").bind(r.id),
          db.prepare("DELETE FROM campaigns WHERE id = ?").bind(r.id));
      }
      await db.batch(st);
      return json({ ok: true, changed: rows.length });
    }

    const names = (Array.isArray(body.names) ? body.names : []).map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 20);
    const mode = ["add", "replace", "remove"].indexOf(body.mode) !== -1 ? body.mode : "add";
    function mergeList(cur) {
      if (mode === "replace") return names.slice();
      if (mode === "remove") return cur.filter((x) => names.indexOf(x) === -1);
      return cur.concat(names.filter((x) => cur.indexOf(x) === -1));
    }
    let err = null;
    const updates = [];
    for (const r of rows) {
      const v = { name: r.name, start: r.start_date, end: r.end_date, scope: r.scope, status: r.status, owner: r.owner || "",
        branches: safeParse(r.branches), kind: r.kind, sub: subOfRow(r), color: r.color, schedule: safeObj(r.schedule), acc: safeObj(r.acc) };
      if (act === "shift") {
        const n = Math.round(Number(body.days) || 0);
        if (!n || Math.abs(n) > 366) { err = "จำนวนวันที่เลื่อนต้องอยู่ระหว่าง 1–366"; break; }
        v.start = isoAdd(v.start, n); v.end = isoAdd(v.end, n);
        if (v.schedule) {
          v.schedule.ranges = (v.schedule.ranges || []).map((x) => ({ s: isoAdd(x.s, n), e: isoAdd(x.e || x.s, n) }));
          if (v.schedule.rep && v.schedule.rep.until) v.schedule.rep.until = isoAdd(v.schedule.rep.until, n);
        }
      } else if (act === "dates") {
        if (!ISO_RE.test(body.start)) { err = "เลือกวันเริ่ม"; break; }
        const e = ISO_RE.test(body.end) ? body.end : body.start;
        if (e < body.start) { err = "วันสิ้นสุดมาก่อนวันเริ่ม"; break; }
        v.start = body.start; v.end = e; v.scope = "range"; v.schedule = null;
      } else if (act === "owner") {
        if (!names.length && mode !== "replace") { err = "เลือกชื่อก่อน"; break; }
        v.owner = mergeList(String(v.owner).split(/\s*,\s*/).filter(Boolean)).join(", ").slice(0, 300);
      } else if (act === "branches") {
        if (!names.length && mode !== "replace") { err = "เลือกสาขาก่อน"; break; }
        v.branches = mergeList(v.branches);
      } else if (act === "status") {
        if (["plan", "live", "done"].indexOf(body.status) === -1) { err = "สถานะไม่ถูกต้อง"; break; }
        v.status = body.status;
      } else if (act === "sub") {
        if (!CAMPAIGN_SUBS[body.sub]) { err = "ประเภทไม่ถูกต้อง"; break; }
        v.sub = body.sub; v.kind = CAMPAIGN_SUBS[body.sub].kind; v.color = CAMPAIGN_SUBS[body.sub].color;
      } else { err = "ไม่รู้จักคำสั่งนี้"; break; }
      updates.push({ id: r.id, v });
    }
    if (err) return json({ error: err }, 400);
    await db.batch(updates.map(({ id, v }) => db.prepare(
      "UPDATE campaigns SET start_date=?, end_date=?, scope=?, status=?, owner=?, branches=?, kind=?, sub=?, color=?, schedule=?, updated_at=? WHERE id=?"
    ).bind(v.start, v.end, v.scope, v.status, v.owner, JSON.stringify(v.branches), v.kind, v.sub, v.color,
           v.schedule ? JSON.stringify(v.schedule) : "", now, id)));
    /* วันเปลี่ยน → งานฝ่ายบัญชีที่ผูกอยู่อัปเดตช่วงวันในรายละเอียดตาม */
    if (act === "shift" || act === "dates") {
      for (const u of updates) if (u.v.acc && u.v.acc.need) await syncAccTask(db, u.id, u.v, who.id);
    }
    return json({ ok: true, changed: updates.length });
  }

  const idMatch = path.match(/^\/campaigns\/([A-Za-z0-9_-]{1,40})$/);
  if (idMatch) {
    const id = idMatch[1];

    if (method === "PUT") {
      const body = await request.json().catch(function () { return {}; });
      const parsed = clean(body);
      if (parsed.error) return json({ error: parsed.error }, 400);
      const v = parsed.value;
      const old = await db.prepare("SELECT kind, sub, schedule, acc, start_date, end_date FROM campaigns WHERE id = ?").bind(id).first();
      if (!old) return json({ error: "ไม่พบแคมเปญนี้" }, 404);
      /* client ที่ไม่รู้จักช่องใหม่ (MCP / หน้าเก่าที่ค้าง cache) ต้องไม่ล้างของเดิมทิ้ง */
      if (!parsed.has.sub && v.kind === CAMPAIGN_SUBS[subOfRow(old)].kind) {
        v.sub = subOfRow(old); v.color = CAMPAIGN_SUBS[v.sub].color;
      }
      if (!parsed.has.schedule && old.schedule && v.scope === "range" && v.start === old.start_date) {
        v.schedule = old.schedule; v.end = old.end_date;
      }
      const oldAcc = safeObj(old.acc);
      if (!parsed.has.acc) v.acc = oldAcc;
      else if (v.acc && oldAcc && oldAcc.taskId && !v.acc.taskId) v.acc.taskId = oldAcc.taskId;
      await db.prepare(
        "UPDATE campaigns SET name=?,start_date=?,end_date=?,scope=?,status=?,channels=?,branches=?," +
        "budget=?,owner=?,note=?,color=?,updated_at=?,kind=?,sub=?,schedule=?,acc=? WHERE id=?"
      ).bind(v.name, v.start, v.end, v.scope, v.status, v.channels, v.branches, v.budget,
             v.owner, v.note, v.color, new Date().toISOString(), v.kind, v.sub, v.schedule,
             v.acc ? JSON.stringify(v.acc) : "", id).run();
      const acc = await syncAccTask(db, id, v, who.id);
      return json({ ok: true, accTaskId: acc && acc.taskId || null });
    }

    if (method === "DELETE") {
      await db.batch([
        db.prepare("DELETE FROM attachments WHERE campaign_id = ?").bind(id),
        /* โพสต์และงานที่เคยผูกไว้ไม่ถูกลบตาม — แค่ปลดลิงก์ */
        db.prepare("UPDATE posts SET campaign_id = NULL WHERE campaign_id = ?").bind(id),
        db.prepare("UPDATE tasks SET campaign_id = NULL WHERE campaign_id = ?").bind(id),
        db.prepare("DELETE FROM campaigns WHERE id = ?").bind(id),
      ]);
      return json({ ok: true });
    }

    if (method === "POST" && url.searchParams.get("action") === "attach") {
      const body = await request.json().catch(function () { return {}; });
      const dataUrl = String(body.dataUrl || "");
      const m = dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/);
      if (!m) return json({ error: "ไฟล์ไม่ถูกต้อง" }, 400);
      const mime = m[1];
      const b64 = m[2];
      if (mime.indexOf("image/") !== 0) return json({ error: "รับเฉพาะไฟล์รูป" }, 400);
      const bytes = Math.floor((b64.length * 3) / 4);
      if (bytes > MAX_ATTACHMENT_BYTES) return json({ error: "รูปใหญ่เกินไป" }, 413);

      const exists = await db.prepare("SELECT id FROM campaigns WHERE id = ?").bind(id).first();
      if (!exists) return json({ error: "ไม่พบแคมเปญนี้" }, 404);
      const count = await db.prepare("SELECT COUNT(*) AS n FROM attachments WHERE campaign_id = ?")
        .bind(id).first();
      if ((count && count.n ? count.n : 0) >= MAX_ATTACHMENTS_PER_CAMPAIGN) {
        return json({ error: "แนบได้สูงสุด " + MAX_ATTACHMENTS_PER_CAMPAIGN + " รูปต่อแคมเปญ" }, 409);
      }

      const aid = "a" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const tm = String(body.thumb || "").match(/^data:image\/jpeg;base64,(.+)$/);
      const thumb = tm && tm[1].length <= 120000 ? tm[1] : null;
      await db.prepare(
        "INSERT INTO attachments (id,campaign_id,file_name,mime,bytes,data,created_at,thumb) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(aid, id, String(body.fileName || "image").slice(0, 160), mime, bytes, b64,
             new Date().toISOString(), thumb).run();
      return json({ id: aid });
    }
  }

  return json({ error: "ไม่พบ endpoint นี้" }, 404);
}

/* ---------- ล็อกหน้าหลังบ้านตามสิทธิ์ --------------------------------
   ทุกหน้าใต้ admin.kan-hub.com ต้องเข้าสู่ระบบก่อน (เดิมเปิดสาธารณะหมด ใครมีลิงก์ก็เข้าได้)
   ยกเว้นหน้าเข้าสู่ระบบเองกับไฟล์ที่หน้านั้นต้องใช้ ไม่งั้นจะวนลูป
   คืนค่า: null = เปิดได้เลย · "login" = แค่ต้องล็อกอิน · ชื่อหมวด = ต้องมีสิทธิ์หมวดนั้น */
function pathGate(p) {
  if (p.indexOf("/admin/tasks") === 0) return null;           // SPA งานทีม = หน้าเข้าสู่ระบบ
  if (p.indexOf("/admin/assets/") === 0) return null;          // โลโก้ ฟอนต์ เปลือกหน้าตา
  if (/^\/admin\/cmo\/(erp-menu|nav)\.js$/.test(p)) return null;
  if (/^\/admin\/cmo\/styles\.css$/.test(p)) return null;
  /* แจ้งเตือนเด้ง: service worker + manifest ต้องโหลดได้โดยไม่ติดด่านล็อกอิน (เบราว์เซอร์ดึงเองเบื้องหลัง) */
  if (p === "/admin/sw.js" || p === "/admin/manifest.webmanifest") return null;
  if (p.indexOf("/admin/mkt") === 0) return "sales";           // แอปยอดขาย/การตลาดทั้งชุด
  if (/^\/admin\/cmo\/kpi(\.html|\.js)?$/.test(p)) return "kpi";
  /* หน้าเอกสาร/แผนงานฝั่ง CMO — ฝ่ายขายที่ได้เฉพาะหมวด CRM ไม่ต้องเห็น (21 ก.ย. 69) */
  if (p.indexOf("/admin/cmo/") === 0) return "docs";
  if (p.indexOf("/admin") === 0) return "login";
  return null;
}
const NO_STORE = { "cache-control": "no-store", "content-type": "text/html; charset=utf-8" };
function denyPage(title, msg, linkLabel, href) {
  return new Response(
    '<!doctype html><html lang="th"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + ' — KAN Admin</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F3EF;color:#1A1917;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans Thai",sans-serif}' +
    '.b{max-width:420px;padding:34px 30px;background:#fff;border:1px solid #E3E1DA;text-align:center}' +
    'h1{margin:0 0 10px;font-size:19px}p{margin:0 0 20px;font-size:14px;line-height:1.7;color:#6B6A63}' +
    'a{display:inline-block;padding:10px 20px;background:#1A1917;color:#fff;text-decoration:none;font-size:14px}' +
    'small{display:block;margin-top:22px;font-size:11px;color:#9A988F}</style></head><body><div class="b">' +
    '<h1>' + title + '</h1><p>' + msg + '</p><a href="' + href + '">' + linkLabel + '</a>' +
    '<small>Powered by <b>M Creation</b></small></div></body></html>',
    { status: title === "ไม่มีสิทธิ์เข้าหน้านี้" ? 403 : 401, headers: NO_STORE }
  );
}
async function serveAdmin(request, env, url) {
  const need = pathGate(url.pathname);
  if (!need) return env.ASSETS.fetch(new Request(url, request));
  const wantsHtml = (request.headers.get("accept") || "").indexOf("text/html") !== -1;
  const me = await authFor(request, env);
  if (!me) {
    if (!wantsHtml) return new Response("ต้องเข้าสู่ระบบ", { status: 401, headers: { "cache-control": "no-store" } });
    /* โฮสต์จริง (admin.kan-hub.com) ตัด /admin ออกจาก URL ให้แล้ว แต่ตอน dev/workers.dev ยังมีติดมา
       ต้องเด้งกลับด้วยรูปแบบเดียวกับที่ผู้ใช้เห็น ไม่งั้นไปโผล่หน้าไม่มีอยู่จริง */
    const origPath = new URL(request.url).pathname;
    const prefix = origPath.indexOf("/admin") === 0 ? "/admin" : "";
    const back = prefix + url.pathname.replace(/^\/admin/, "") + url.search;
    return new Response(null, {
      status: 302,
      headers: { location: prefix + "/tasks/?next=" + encodeURIComponent(back), "cache-control": "no-store" },
    });
  }
  if (!canSee(me, need)) {
    if (!wantsHtml) return new Response("ไม่มีสิทธิ์", { status: 403, headers: { "cache-control": "no-store" } });
    /* ฝ่ายขายที่ดูแต่ลีด — พาไปหน้าลีดเลย ไม่ต้องเจอหน้า "ไม่มีสิทธิ์" */
    if (canSee(me, "crm") && !canSee(me, "tasks")) {
      const pre = new URL(request.url).pathname.indexOf("/admin") === 0 ? "/admin" : "";
      return new Response(null, { status: 302, headers: { location: pre + "/tasks/#/leads", "cache-control": "no-store" } });
    }
    const home = (new URL(request.url).pathname.indexOf("/admin") === 0 ? "/admin" : "") + "/tasks/";
    return denyPage("ไม่มีสิทธิ์เข้าหน้านี้",
      "บัญชีของคุณยังไม่ได้เปิดสิทธิ์หมวดนี้ ถ้าต้องใช้ให้บอกหัวหน้าทีมเปิดให้ในหน้า “ทีม + สิทธิ์”",
      "กลับไปหน้างานของฉัน", home);
  }
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  /* cron จาก wrangler.jsonc — แจ้งงานเข้ากลุ่ม Lark 3 รอบ/วัน */
  async scheduled(event, env, ctx) {
    await ensureTaskSchema(env.KAN_ERP);
    if (event.cron === PUSH_CRON) { ctx.waitUntil(pushTick(env, true)); return; }
    /* ใบบรอดแคสต์ที่ตั้งเวลาไว้แล้วถึงเวลา — ยิงตอนรอบ cron ที่มีอยู่แล้ว
       (โหมดจำลองยังไม่ต้องละเอียดถึงนาที · ต่อของจริงแล้วค่อยเพิ่ม cron ทุก 10 นาที) */
    ctx.waitUntil((async () => {
      try { await ensureBlastSchema(env.KAN_ERP); await runDueBlasts(env.KAN_ERP); } catch (e) {}
      await runScheduled(event, env);
    })());
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;
    /* มีการแก้ข้อมูล → กวาดแจ้งเตือนหลังคำขอนี้เสร็จ (หน่วงให้ข้อมูลลง D1 ก่อน) · cron ทุก 5 นาทีเก็บตกอีกชั้น */
    if (url.pathname.indexOf("/api/") === 0 && request.method !== "GET" && request.method !== "HEAD" &&
        url.pathname.indexOf("/api/t/push") !== 0 && env.KAN_ERP) {
      ctx.waitUntil(new Promise((r) => setTimeout(r, 1500)).then(() => pushTick(env)));
    }
    /* Lark ยิง event มาที่นี่ตอนมีคนพิมพ์ในแชท — ไม่ผ่านล็อกอิน ตรวจ verification token ของ Lark แทน */
    if (url.pathname === "/api/lark/event") {
      await ensureTaskSchema(env.KAN_ERP);
      return handleLarkEvent(request, env, ctx);
    }
    /* ฟอร์มแจ้งปัญหาหน้าเว็บสาธารณะ (kan-hub.com/help — แปะไว้ใน rich menu ไลน์)
       ต้องยิงได้โดยไม่ต้องล็อกอินและไม่ใช่ admin host จึงดักไว้ก่อนด่านโฮสต์ */
    if (url.pathname === "/api/tickets") return handleTicketIntake(request, env, ctx);
    /* ปุ่ม "สนใจสั่งซื้อ" หน้าขายสาธารณะ (kan-hub.com/grade-b) → ลีดใน CRM */
    if (url.pathname === "/api/sale-lead") return handleSaleLead(request, env, ctx);
    const isAdminHost = host.indexOf("admin.") === 0 || host.endsWith(".workers.dev") ||
                        host === "localhost" || host === "127.0.0.1"; // localhost = ตอน wrangler dev

    // --- MCP ให้ Claude / ChatGPT ต่อเข้าระบบ: /mcp/<token> หรือ /mcp + Bearer ---
    const mcp = url.pathname.match(/^\/mcp(?:\/([A-Za-z0-9]{32,80}))?\/?$/);
    if (mcp) {
      if (!isAdminHost) return new Response("Not found", { status: 404 });
      try {
        return await handleMcp(request, env, url, mcp[1] || "", handleApi);
      } catch (err) {
        return json({ error: "เซิร์ฟเวอร์ผิดพลาด: " + (err && err.message ? err.message : String(err)) }, 500);
      }
    }

    // --- API หลังบ้าน (เฉพาะ admin subdomain) ---
    if (url.pathname.indexOf("/api/") === 0) {
      if (!isAdminHost) return new Response("Not found", { status: 404 });
      try {
        return await handleApi(request, env, url, ctx);
      } catch (err) {
        return json({ error: "เซิร์ฟเวอร์ผิดพลาด: " + (err && err.message ? err.message : String(err)) }, 500);
      }
    }

    // --- หลังบ้าน: admin subdomain → map root ไป /admin/* ---
    if (host.indexOf("admin.") === 0) {
      if (url.pathname.indexOf("/admin") !== 0) {
        url.pathname = url.pathname === "/" ? "/admin/" : "/admin" + url.pathname;
      }
      return await serveAdmin(request, env, url);
    }

    /* หน้า Tier A–D เดิมถูกแทนด้วย 4 แบบขาย (25 ก.ย. 69) — 301 ไปหน้าใหม่ อันดับ Google ไม่หาย */
    const oldTier = url.pathname.match(/^\/catalog\/tier-([a-d])\/?$/);
    if (oldTier) {
      const to = { a: "/catalog/bale/", b: "/catalog/stock/", c: "/catalog/stock/", d: "/catalog/" }[oldTier[1]];
      return Response.redirect(url.origin + to, 301);
    }

    // --- โดเมนหลักสาธารณะ: ซ่อน /admin (กันเข้าตรง) ---
    if (host === "kan-hub.com" || host === "www.kan-hub.com") {
      if (url.pathname === "/admin" || url.pathname.indexOf("/admin/") === 0) {
        return new Response("Not found", { status: 404 });
      }
    }

    // ที่เหลือ (รวม workers.dev + localhost ตอน dev) — /admin ต้องผ่านด่านสิทธิ์เหมือนกัน
    if (url.pathname.indexOf("/admin") === 0) return await serveAdmin(request, env, url);
    /* รูปอัลบั้มหน้าขาย (/grade-b/img/*) ไม่เปลี่ยนแล้ว — ให้มือถือเก็บไว้ 7 วัน เปิดลิงก์ซ้ำไม่ต้องถามเซิร์ฟเวอร์ทีละรูป */
    if (/^\/grade-b\/img\//.test(url.pathname)) {
      const res = await env.ASSETS.fetch(request);
      if (res.status !== 200) return res;
      const out = new Response(res.body, res);
      out.headers.set("cache-control", "public, max-age=604800");
      return out;
    }
    return env.ASSETS.fetch(request);
  },
};
