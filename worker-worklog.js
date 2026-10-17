// KAN — บันทึกงานรายวัน (Work Log) · API ที่ /api/t/worklog/*
//  - แทนชีต Lark "งาน RT Marketing" — หนึ่งแถว = หนึ่งช่วงเวลาของวัน (Time · Work · Process · reason · รูป)
//  - เจ้าของแถว = คนที่ล็อกอิน ไม่มีช่องพิมพ์ชื่อ · แก้/ลบได้เฉพาะแถวของตัวเอง
//  - หัวหน้า (owner) กับคนดูแลงาน (task_admin) ดูของทุกคนได้ · ถ้าบัญชีผูกสาขา เห็นเฉพาะคนในสาขาเดียวกัน
//  - Process ใช้คีย์สถานะชุดเดียวกับงาน (todo/doing/review/done/blocked — todo มีเฉพาะบันทึกงาน) แต่ไม่ผ่านกติกา "รอตรวจ" ของงาน
//    เพราะเป็นบันทึกว่าทำอะไรไปแล้ว ไม่ใช่งานที่สั่ง (นนท์เลือกข้อ B 15 ต.ค. 69) — กดเสร็จแล้วได้เลย
//  - ตารางสร้างเองตอนถูกเรียกครั้งแรกเหมือนระบบงานทีม ไม่ต้องรัน migration
//  - helper ที่ใช้ร่วมกับระบบงาน (json, logChange, parseDataUrl …) ส่งเข้ามาจาก worker-tasks.js ทาง `h`

/* ลำดับตามที่ทีมเห็นในเมนู · todo = ยังไม่เริ่ม เป็นค่าเริ่มต้นของแถวใหม่ (นนท์ 16 ต.ค. 69) */
const WL_STATUSES = ["todo", "doing", "review", "done", "blocked"];
const WL_STATUS_TH = { todo: "ยังไม่เริ่ม", doing: "กำลังทำ", review: "รอตรวจ", done: "เสร็จแล้ว", blocked: "ติดปัญหา" };
/* ช่วงเวลาที่ทีมใช้ในชีตจริง — เลือก "อื่นๆ" แล้วพิมพ์เองได้ ระบบเก็บเป็นข้อความ */
const WL_SLOTS = ["10.00-10.30", "10.30-11.00", "11.00-12.00", "12.00-13.00", "13.00-19.00"];
const WL_MAX_WORK = 4000;
const WL_MAX_REASON = 1000;
const WL_MAX_SLOT = 40;
const WL_MAX_RANGE_DAYS = 62;      /* ตารางรายสัปดาห์ใช้ 7 วัน เผื่อดูรายเดือน */
const WL_MAX_SEARCH_DAYS = 366;
const WL_MAX_FILES_PER_ROW = 10;
const WL_MAX_FILES_PER_CALL = 6;
const WL_MAX_THUMB_BYTES = 60000;  /* รูปย่อไว้โชว์ในตาราง — เบราว์เซอร์ย่อให้ ~240px */
const WL_MAX_TEMPLATE = 30;       /* แถวต่อแม่แบบ */
const WL_MAX_TEMPLATE_SETS = 20;  /* แม่แบบต่อคน */
const WL_CARRY_LOOKBACK = 30;      /* ยกงานค้างย้อนหลังไม่เกินกี่วัน — กันของเก่า/ของที่นำเข้ามาไหลมาทั้งก้อน */
const WL_DEFAULT_WORKDAYS = "1,2,3,4,5"; /* ค่าเดียวกับหน้าทีม (tasks.js) ตอนยังไม่ตั้งวันทำงาน */
const WL_REPEAT_AHEAD = 7;         /* งานทำซ้ำโผล่ล่วงหน้ากี่วัน (เห็นสัปดาห์หน้าได้) */
const WL_MAX_REPEATS = 50;         /* งานทำซ้ำต่อคน */

const WORKLOG_SCHEMA = [
  /* carried_from = แถวต้นทางที่ยกมา · carried_to = แถวที่ยกต่อไปแล้ว (ตั้งครั้งเดียว ลบแถวปลายทางทิ้งก็ไม่ยกซ้ำ)
     slot_start = นาทีเริ่มของช่วงเวลา ไว้เรียงแถวในวัน (พิมพ์เวลาเองที่อ่านไม่ออก = ไปท้ายวัน) */
  "CREATE TABLE IF NOT EXISTS worklog (" +
    "id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, work_date TEXT NOT NULL, " +
    "slot TEXT NOT NULL DEFAULT '', slot_start INTEGER NOT NULL DEFAULT 9999, sort INTEGER NOT NULL DEFAULT 0, " +
    "work TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'done', reason TEXT NOT NULL DEFAULT '', " +
    "carried_from TEXT, carried_to TEXT, source TEXT NOT NULL DEFAULT 'manual', " +
    "created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT)",
  "CREATE INDEX IF NOT EXISTS idx_worklog_staff_date ON worklog(staff_id, work_date)",
  "CREATE INDEX IF NOT EXISTS idx_worklog_date ON worklog(work_date)",
  /* แถวหนึ่งยกต่อได้ครั้งเดียว — สองรีเควสต์มาพร้อมกันก็ไม่ได้แถวซ้ำ */
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_worklog_carry ON worklog(carried_from) WHERE carried_from IS NOT NULL",
  /* รูปแนบ — เก็บแบบเดียวกับ task_files (base64 ใน D1) แต่แยกตาราง
     เพราะ task_files ผูกสิทธิ์ดู/ลบกับตาราง tasks ถ้าใส่ปนกัน บัญชีผูกสาขาจะเปิดรูปไม่ได้ และตัวนับรูปของงานจะเพี้ยน */
  "CREATE TABLE IF NOT EXISTS worklog_files (" +
    "id TEXT PRIMARY KEY, log_id TEXT NOT NULL, staff_id TEXT NOT NULL, file_name TEXT NOT NULL, " +
    "mime TEXT NOT NULL, bytes INTEGER NOT NULL, data TEXT NOT NULL, thumb TEXT, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_worklog_files_log ON worklog_files(log_id)",
  /* แถวประจำของแต่ละคน — กด "เติมจากแม่แบบ" ได้ทั้งชุดในทีเดียว */
  "CREATE TABLE IF NOT EXISTS worklog_templates (" +
    "id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, " +
    "slot TEXT NOT NULL DEFAULT '', work TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'done', " +
    "updated_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_worklog_tpl_staff ON worklog_templates(staff_id, sort)",
];
/* คอลัมน์ที่เพิ่มทีหลัง — ใส่ต่อท้ายที่นี่ (ALTER TABLE … ADD COLUMN) ห้ามแก้ CREATE ด้านบนแทน */
const WORKLOG_ALTERS = [
  /* หลายแม่แบบต่อคน (นนท์ขอ 15 ต.ค. 69) — แถวแม่แบบผูกกับชุดใน worklog_template_sets
     แถวเก่าที่ยังไม่มีชุด (set_id ว่าง) ถูกย้ายเข้าชุด "แม่แบบหลัก" ตอนเจ้าของเปิดแม่แบบครั้งแรก (tplSets) */
  "ALTER TABLE worklog_templates ADD COLUMN set_id TEXT",
  "CREATE TABLE IF NOT EXISTS worklog_template_sets (" +
    "id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, name TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, " +
    "created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_worklog_tset_staff ON worklog_template_sets(staff_id, sort)",
  "CREATE INDEX IF NOT EXISTS idx_worklog_tpl_set ON worklog_templates(set_id, sort)",
  /* งานทำซ้ำ (นนท์ขอ 17 ต.ค. 69) — รายสัปดาห์ (days = "1,3,5" แบบ JS 0 = อาทิตย์) หรือรายเดือน (days = "5" = วันที่ 5)
     set_id ว่าง = แถวเดียว (slot/work ในตารางนี้) · มี set_id = ทั้งแม่แบบชุดนั้น
     gen_until = สร้างแถวไปถึงวันไหนแล้ว — วันที่ผ่านไปแล้วไม่สร้างซ้ำ (ลบแถวทิ้งก็ไม่โผล่กลับ)
     worklog.repeat_key = "<repeat>|<วันที่>|<ลำดับ>" กันสองรีเควสต์สร้างแถวเดียวกันซ้ำ */
  "CREATE TABLE IF NOT EXISTS worklog_repeats (" +
    "id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, set_id TEXT, slot TEXT NOT NULL DEFAULT '', work TEXT NOT NULL DEFAULT '', " +
    "freq TEXT NOT NULL, days TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT, gen_until TEXT, " +
    "created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_worklog_rep_staff ON worklog_repeats(staff_id)",
  "ALTER TABLE worklog ADD COLUMN repeat_id TEXT",
  "ALTER TABLE worklog ADD COLUMN repeat_key TEXT",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_worklog_repeat_key ON worklog(repeat_key) WHERE repeat_key IS NOT NULL",
  "CREATE INDEX IF NOT EXISTS idx_worklog_repeat ON worklog(repeat_id) WHERE repeat_id IS NOT NULL",
];

let worklogReady = null;
export function ensureWorklogSchema(db) {
  if (!worklogReady) {
    worklogReady = (async () => {
      await db.batch(WORKLOG_SCHEMA.map((s) => db.prepare(s)));
      for (const sql of WORKLOG_ALTERS) {
        try { await db.prepare(sql).run(); } catch (e) { /* มีคอลัมน์อยู่แล้ว */ }
      }
    })().catch((e) => { worklogReady = null; throw e; });
  }
  return worklogReady;
}

/* ---------- วันที่ (เวลาไทย) ---------- */
function isDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
}
function thToday() {
  return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
}
function addDays(d, n) {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}
function weekday(d) {
  return new Date(d + "T00:00:00Z").getUTCDay();
}
/* วันทำงานของคนนั้น (work_days = "1,2,3,4,5" แบบ JS 0 = อาทิตย์) — ไม่ตั้งไว้ = จันทร์–ศุกร์ */
function workSet(workDays) {
  const raw = workDays == null || String(workDays).trim() === "" ? WL_DEFAULT_WORKDAYS : String(workDays);
  return raw.split(",").map((x) => Number(x)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}
function isWorkDay(d, workDays) {
  const set = workSet(workDays);
  return !set.length || set.indexOf(weekday(d)) !== -1;
}
/* วันทำงานถัดไปของคนนั้น */
function nextWorkDay(d, workDays) {
  const set = workSet(workDays);
  let x = addDays(d, 1);
  if (!set.length) return x;
  for (let i = 0; i < 7 && set.indexOf(weekday(x)) === -1; i++) x = addDays(x, 1);
  return x;
}
/* ---------- งานทำซ้ำ ---------- */
/* วันที่ dom ของเดือนที่ d อยู่ (เดือนสั้นกว่า = วันสุดท้ายของเดือน) · back = ย้อนไปกี่เดือน */
function monthDay(d, dom, back) {
  let y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)) - (back || 0);
  if (m < 1) { m += 12; y -= 1; }
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return y + "-" + String(m).padStart(2, "0") + "-" + String(Math.min(dom, last)).padStart(2, "0");
}
/* วันนี้ต้องมีแถวของงานทำซ้ำนี้ไหม
   รายสัปดาห์ = ตามวันที่ติ๊ก (คนติ๊กเองแล้ว ไม่ข้ามวันหยุด)
   รายเดือน = วันที่นั้นของเดือน · ตรงวันหยุดของคนนั้น → เลื่อนไปวันทำงานถัดไป */
function repeatHits(rep, d, workDays) {
  if (rep.freq === "weekly") return String(rep.days).split(",").map(Number).indexOf(weekday(d)) !== -1;
  const dom = Number(rep.days);
  for (let back = 0; back < 2; back++) {
    const t = monthDay(d, dom, back);
    if (isWorkDay(t, workDays) ? t === d : (t < d && nextWorkDay(t, workDays) === d)) return true;
  }
  return false;
}
/* วันถัดไปที่จะมีแถว (ตั้งแต่ from) — ไว้โชว์ในรายการงานทำซ้ำ */
function repeatNext(rep, from, workDays) {
  let d = rep.start_date > from ? rep.start_date : from;
  for (let i = 0; i < 400; i++, d = addDays(d, 1)) {
    if (rep.end_date && d > rep.end_date) return null;
    if (repeatHits(rep, d, workDays)) return d;
  }
  return null;
}
/* ตรวจค่าทำซ้ำที่ส่งมา { freq, days, endDate } → { value } หรือ { error } */
function cleanRepeat(r) {
  if (!r || typeof r !== "object") return { error: "ตั้งค่าการทำซ้ำไม่ถูกต้อง" };
  const freq = r.freq === "weekly" || r.freq === "monthly" ? r.freq : "";
  if (!freq) return { error: "เลือกว่าจะทำซ้ำรายสัปดาห์หรือรายเดือน" };
  let days;
  if (freq === "weekly") {
    const list = (Array.isArray(r.days) ? r.days : String(r.days == null ? "" : r.days).split(","))
      .map((x) => (x === "" || x == null ? NaN : Number(x))).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    const uniq = list.filter((n, i) => list.indexOf(n) === i).sort((a, b) => a - b);
    if (!uniq.length) return { error: "เลือกวันที่จะทำซ้ำอย่างน้อย 1 วัน" };
    days = uniq.join(",");
  } else {
    const n = Number(Array.isArray(r.days) ? r.days[0] : r.days);
    if (!Number.isInteger(n) || n < 1 || n > 31) return { error: "เลือกวันที่ของเดือน (1–31)" };
    days = String(n);
  }
  let end = null;
  if (r.endDate) {
    if (!isDate(r.endDate)) return { error: "วันสิ้นสุดไม่ถูกต้อง" };
    end = r.endDate;
  }
  return { value: { freq, days, end_date: end } };
}

/* "10.00-10.30" / "13:00 - 19:00" / "9.30" → นาทีเริ่ม */
function slotStart(slot) {
  const m = String(slot || "").match(/^\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return 9999;
  const hh = Number(m[1]), mm = Number(m[2]);
  return hh < 24 && mm < 60 ? hh * 60 + mm : 9999;
}

/* ---------- แถว → JSON ---------- */
function rowOut(r, files, dates) {
  return {
    id: r.id, staffId: r.staff_id, date: r.work_date, slot: r.slot || "", sort: r.sort || 0,
    work: r.work || "", status: WL_STATUSES.indexOf(r.status) !== -1 ? r.status : "done", reason: r.reason || "",
    carriedFrom: r.carried_from || null, carriedFromDate: (r.carried_from && dates[r.carried_from]) || null,
    carriedTo: r.carried_to || null, carriedToDate: (r.carried_to && dates[r.carried_to]) || null,
    repeatId: r.repeat_id || null,
    source: r.source || "manual", createdAt: r.created_at, updatedAt: r.updated_at, updatedBy: r.updated_by || null,
    files: files[r.id] || [],
  };
}
/* สภาพของแถวไว้เก็บใน audit_log — เฉพาะช่องที่คนแก้ได้ */
/* __files = จำนวนรูป ใส่เฉพาะตอนแนบ/ลบรูป — ไม่งั้น logChange เห็นว่าไม่มีอะไรเปลี่ยนแล้วไม่บันทึก */
function snapRow(r, nFiles) {
  if (!r) return null;
  const o = { work_date: r.work_date, slot: r.slot || "", work: r.work || "", status: r.status, reason: r.reason || "" };
  if (nFiles != null) o.__files = nFiles;
  return o;
}
function titleOf(r) {
  const first = String(r.work || "").split("\n").map((x) => x.replace(/^[\s\-–•]+|[\s/]+$/g, "")).filter(Boolean)[0] || "";
  return (r.work_date + " " + (r.slot || "") + " " + first).trim().slice(0, 200);
}

/* ตรวจค่าที่ส่งมา — partial = แก้บางช่อง (PUT) · คืน { value } หรือ { error } */
function cleanInput(body, partial) {
  const v = {};
  if (!partial || body.date !== undefined) {
    if (!isDate(body.date)) return { error: "วันที่ไม่ถูกต้อง" };
    const off = daysBetween(thToday(), body.date);
    if (off > 366 || off < -3660) return { error: "วันที่ห่างจากวันนี้เกินไป" };
    v.work_date = body.date;
  }
  if (!partial || body.slot !== undefined) v.slot = String(body.slot == null ? "" : body.slot).trim().slice(0, WL_MAX_SLOT);
  if (!partial || body.work !== undefined) {
    const w = String(body.work == null ? "" : body.work).replace(/\r\n?/g, "\n");
    if (w.length > WL_MAX_WORK) return { error: "ช่อง Work ยาวเกิน " + WL_MAX_WORK + " ตัวอักษร" };
    v.work = w.replace(/\s+$/, "");
  }
  if (!partial || body.status !== undefined) {
    const st = body.status == null || body.status === "" ? "todo" : String(body.status);
    if (WL_STATUSES.indexOf(st) === -1) return { error: "Process ไม่ถูกต้อง" };
    v.status = st;
  }
  if (!partial || body.reason !== undefined) {
    const rs = String(body.reason == null ? "" : body.reason).trim();
    if (rs.length > WL_MAX_REASON) return { error: "ช่อง reason ยาวเกิน " + WL_MAX_REASON + " ตัวอักษร" };
    v.reason = rs;
  }
  return { value: v };
}
const REASON_REQUIRED = "เลือก “ติดปัญหา” ต้องใส่ reason ด้วยว่าติดอะไร / จะเสร็จเมื่อไหร่";

/* ============================================================ */
export async function handleWorklogApi(db, request, url, path, method, me, perm, h) {
  await ensureWorklogSchema(db);
  const { json, newId, nowIso, logChange, diffSnap, parseDataUrl, readBody, TASK_BRANCHES } = h;
  if (perm === "none") return json({ error: "ไม่มีสิทธิ์เข้าเมนูบันทึกงานรายวัน" }, 403);

  const isOwner = me.role === "owner";
  /* หัวหน้า = owner + คนดูแลงาน (task_admin) ชุดเดียวกับที่ดูแลงานทุกคนในระบบงานทีม */
  const isLead = isOwner || !!me.task_admin;
  const myScope = !isOwner && TASK_BRANCHES.indexOf(me.branch_scope) !== -1 ? me.branch_scope : null;
  const today = thToday();

  /* คนที่บัญชีนี้ดูได้ — ตัวเองเสมอ · หัวหน้าดูทุกคน (หรือเฉพาะสาขาตัวเองถ้าบัญชีผูกสาขา) */
  async function visibleStaff() {
    const all = (await db.prepare("SELECT id,name,role,active,pending,branch_scope,work_days FROM staff ORDER BY role = 'owner' DESC, name").all()).results || [];
    return all.filter((s) => {
      if (s.id === me.id) return true;
      if (!isLead || s.pending) return false;
      if (myScope) return s.branch_scope === myScope;
      return true;
    });
  }
  function staffBranch(s) {
    return TASK_BRANCHES.indexOf(s.branch_scope) !== -1 ? s.branch_scope : "";
  }
  async function canSeeStaffId(sid) {
    if (sid === me.id) return true;
    if (!isLead) return false;
    return (await visibleStaff()).some((s) => s.id === sid);
  }
  async function loadRow(id) {
    return db.prepare("SELECT * FROM worklog WHERE id = ?").bind(id).first();
  }
  async function filesFor(ids) {
    const out = {};
    if (!ids.length) return out;
    for (let i = 0; i < ids.length; i += 90) {
      const part = ids.slice(i, i + 90);
      const r = await db.prepare("SELECT id, log_id, file_name, bytes, created_at, (thumb IS NOT NULL) AS has_thumb FROM worklog_files WHERE log_id IN (" +
        part.map(() => "?").join(",") + ") ORDER BY created_at").bind(...part).all();
      for (const f of (r.results || [])) {
        (out[f.log_id] = out[f.log_id] || []).push({ id: f.id, name: f.file_name, bytes: f.bytes, thumb: !!f.has_thumb });
      }
    }
    return out;
  }
  /* วันที่ของแถวต้นทาง/ปลายทางที่ยก — ไว้เขียนป้าย "ยกมาจาก 14 ต.ค." */
  async function linkDates(rows) {
    const ids = [];
    rows.forEach((r) => { if (r.carried_from) ids.push(r.carried_from); if (r.carried_to) ids.push(r.carried_to); });
    const out = {};
    for (let i = 0; i < ids.length; i += 90) {
      const part = ids.slice(i, i + 90);
      const r = await db.prepare("SELECT id, work_date FROM worklog WHERE id IN (" + part.map(() => "?").join(",") + ")").bind(...part).all();
      (r.results || []).forEach((x) => { out[x.id] = x.work_date; });
    }
    return out;
  }
  async function nextSort(staffId, date) {
    const r = await db.prepare("SELECT COALESCE(MAX(sort), 0) AS m FROM worklog WHERE staff_id = ? AND work_date = ?").bind(staffId, date).first();
    return ((r && r.m) || 0) + 1;
  }
  async function outRows(rows) {
    const files = await filesFor(rows.map((r) => r.id));
    const dates = await linkDates(rows);
    return rows.map((r) => rowOut(r, files, dates));
  }

  /* ---- ยกงานค้างไปวันทำงานถัดไป ----
     ไม่ใช้ cron: ทำตอนมีคนเปิดดู (แถวที่วันจบไปแล้วและยังไม่ "เสร็จแล้ว")
     ยกได้ครั้งเดียวต่อแถว (carried_to) — ยกแล้วลบแถวปลายทางทิ้ง ก็ไม่โผล่กลับมาอีก
     วนซ้ำเผื่อหายไปหลายวัน: แถวที่ยกมาแล้วยังไม่เสร็จก็ยกต่ออีกทอด จนถึงวันนี้ */
  async function carryOver(staffRows) {
    if (!staffRows.length) return 0;
    const byId = {};
    staffRows.forEach((s) => { byId[s.id] = s; });
    const ids = staffRows.filter((s) => s.active).map((s) => s.id);
    if (!ids.length) return 0;
    const since = addDays(today, -WL_CARRY_LOOKBACK);
    let made = 0;
    for (let round = 0; round < 10; round++) {
      const ph = ids.map(() => "?").join(",");
      const cand = (await db.prepare(
        "SELECT * FROM worklog WHERE staff_id IN (" + ph + ") AND status != 'done' AND carried_to IS NULL " +
        "AND work_date < ? AND work_date >= ? ORDER BY work_date LIMIT 200"
      ).bind(...ids, today, since).all()).results || [];
      if (!cand.length) break;
      const now = nowIso();
      const stmts = [];
      for (const r of cand) {
        const to = nextWorkDay(r.work_date, byId[r.staff_id] && byId[r.staff_id].work_days);
        /* งานทำซ้ำที่มีแถวของตัวเองในวันถัดไปอยู่แล้ว (เช่น ทำทุกวัน) — ไม่ยก ไม่งั้นได้สองแถว
           carried_to = '' = "ไม่ต้องยก" (ไม่ใช่ NULL จะได้ไม่ถูกหยิบมาเช็คทุกรอบ) */
        if (r.repeat_id && await db.prepare("SELECT id FROM worklog WHERE repeat_id = ? AND work_date = ? LIMIT 1").bind(r.repeat_id, to).first()) {
          stmts.push(db.prepare("UPDATE worklog SET carried_to = '' WHERE id = ? AND carried_to IS NULL").bind(r.id));
          continue;
        }
        const nid = newId("wl_");
        stmts.push(db.prepare(
          "INSERT OR IGNORE INTO worklog (id,staff_id,work_date,slot,slot_start,sort,work,status,reason,carried_from,source,created_at,updated_at,updated_by) " +
          "VALUES (?,?,?,?,?,?,?,?,?,?,'carry',?,?,NULL)"
        ).bind(nid, r.staff_id, to, r.slot, r.slot_start, r.sort, r.work, r.status, r.reason, r.id, now, now));
        /* ชี้ไปแถวที่ยกจริง (ถ้าอีกรีเควสต์ชิงสร้างไปก่อน ก็ได้ id ของแถวนั้น) */
        stmts.push(db.prepare(
          "UPDATE worklog SET carried_to = (SELECT id FROM worklog WHERE carried_from = ?) WHERE id = ? AND carried_to IS NULL"
        ).bind(r.id, r.id));
      }
      await db.batch(stmts);
      made += cand.length;
    }
    return made;
  }

  /* ---- งานทำซ้ำ: สร้างแถวตามรอบ ----
     ไม่ใช้ cron เหมือนยกงานค้าง: ทำตอนมีคนเปิดดู · สร้างถึงวันนี้ + 7 วัน (เห็นสัปดาห์หน้า)
     วันที่เลยมาแล้วก่อนตั้ง/แก้งานทำซ้ำไม่สร้างย้อนหลัง · หายไปนานย้อนได้ไม่เกิน 30 วัน (เท่ายกงานค้าง)
     แถวที่สร้าง updated_by = NULL (= ยังไม่มีใครแตะ) — แก้/เปลี่ยนสถานะ/แนบรูปแล้วถือว่าแตะ */
  async function genRepeats(staffRows) {
    const act = staffRows.filter((s) => s.active);
    if (!act.length) return;
    const byId = {};
    act.forEach((s) => { byId[s.id] = s; });
    const horizon = addDays(today, WL_REPEAT_AHEAD);
    const floor = addDays(today, -WL_CARRY_LOOKBACK);
    const ids = act.map((s) => s.id);
    let reps = [];
    for (let i = 0; i < ids.length; i += 80) {
      const part = ids.slice(i, i + 80);
      const r = await db.prepare("SELECT * FROM worklog_repeats WHERE staff_id IN (" + part.map(() => "?").join(",") +
        ") AND (gen_until IS NULL OR gen_until < ?)").bind(...part, horizon).all();
      reps = reps.concat(r.results || []);
    }
    for (const rep of reps) {
      const wdays = byId[rep.staff_id] && byId[rep.staff_id].work_days;
      let from = rep.gen_until ? addDays(rep.gen_until, 1) : rep.start_date;
      if (from < rep.start_date) from = rep.start_date;
      if (from < floor) from = floor;
      const to = rep.end_date && rep.end_date < horizon ? rep.end_date : horizon;
      let items = [];
      if (rep.set_id) {
        items = ((await db.prepare("SELECT slot, work, status FROM worklog_templates WHERE set_id = ? AND staff_id = ? ORDER BY sort")
          .bind(rep.set_id, rep.staff_id).all()).results || []);
      } else items = [{ slot: rep.slot, work: rep.work, status: "todo" }];
      const now = nowIso();
      const stmts = [];
      for (let d = from; d <= to && items.length; d = addDays(d, 1)) {
        if (!repeatHits(rep, d, wdays)) continue;
        let sort = await nextSort(rep.staff_id, d);
        items.forEach((x, k) => {
          const st = WL_STATUSES.indexOf(x.status) !== -1 && x.status !== "blocked" ? x.status : "todo";
          stmts.push(db.prepare(
            "INSERT OR IGNORE INTO worklog (id,staff_id,work_date,slot,slot_start,sort,work,status,reason,source,repeat_id,repeat_key,created_at,updated_at,updated_by) " +
            "VALUES (?,?,?,?,?,?,?,?,'','repeat',?,?,?,?,NULL)"
          ).bind(newId("wl_"), rep.staff_id, d, x.slot || "", slotStart(x.slot), sort++, x.work || "", st, rep.id, rep.id + "|" + d + "|" + k, now, now));
        });
      }
      stmts.push(db.prepare("UPDATE worklog_repeats SET gen_until = ? WHERE id = ? AND (gen_until IS NULL OR gen_until < ?)").bind(horizon, rep.id, horizon));
      await db.batch(stmts);
    }
  }
  /* แก้/หยุดงานทำซ้ำ: ลบแถวหลังวันนี้ที่ยังไม่มีใครแตะ (ไม่แก้ ไม่มีรูป) แล้วให้สร้างใหม่ตั้งแต่พรุ่งนี้ตามค่าใหม่
     แถววันนี้และวันก่อน ๆ อยู่เหมือนเดิม */
  function dropFutureStmts(repId) {
    return [
      db.prepare("DELETE FROM worklog WHERE repeat_id = ? AND work_date > ? AND updated_by IS NULL " +
        "AND id NOT IN (SELECT log_id FROM worklog_files)").bind(repId, today),
      db.prepare("UPDATE worklog_repeats SET gen_until = CASE WHEN gen_until IS NULL OR gen_until > ? THEN ? ELSE gen_until END WHERE id = ?")
        .bind(today, today, repId),
    ];
  }
  async function myStaff() {
    return db.prepare("SELECT id, active, work_days FROM staff WHERE id = ?").bind(me.id).first();
  }
  async function repOuts(reps, withNext) {
    const setIds = reps.filter((r) => r.set_id).map((r) => r.set_id);
    const names = {};
    for (let i = 0; i < setIds.length; i += 90) {
      const part = setIds.slice(i, i + 90);
      const r = await db.prepare("SELECT id, name FROM worklog_template_sets WHERE id IN (" + part.map(() => "?").join(",") + ")").bind(...part).all();
      (r.results || []).forEach((x) => { names[x.id] = x.name; });
    }
    const wdays = withNext ? ((await myStaff()) || {}).work_days : null;
    return reps.map((r) => ({
      id: r.id, staffId: r.staff_id, kind: r.set_id ? "template" : "row", setId: r.set_id || null, setName: r.set_id ? (names[r.set_id] || "") : "",
      slot: r.slot || "", work: r.work || "", freq: r.freq, days: String(r.days).split(",").map(Number),
      startDate: r.start_date, endDate: r.end_date || null,
      next: withNext ? repeatNext(r, today, wdays) : undefined,
    }));
  }
  async function repeatCount() {
    const r = await db.prepare("SELECT COUNT(*) AS n FROM worklog_repeats WHERE staff_id = ?").bind(me.id).first();
    return (r && r.n) || 0;
  }
  /* ผูกแถวที่มีอยู่ให้เป็นงานทำซ้ำ — แถวนั้นเป็นรอบแรก · สร้างต่อตั้งแต่วันถัดไป (ไม่ย้อนวันที่ผ่านมาแล้ว) */
  async function repeatFromRow(row, rv) {
    if (row.repeat_id) return { error: "แถวนี้เป็นงานทำซ้ำอยู่แล้ว" };
    if (!String(row.work || "").trim()) return { error: "พิมพ์ Work ก่อนตั้งทำซ้ำ" };
    if (rv.end_date && rv.end_date < row.work_date) return { error: "วันสิ้นสุดต้องไม่ก่อนวันที่ของแถวนี้" };
    if ((await repeatCount()) >= WL_MAX_REPEATS) return { error: "มีงานทำซ้ำได้ไม่เกิน " + WL_MAX_REPEATS + " รายการ" };
    const rid = newId("wr_"), now = nowIso();
    const gen = row.work_date > addDays(today, -1) ? row.work_date : addDays(today, -1);
    await db.batch([
      db.prepare("INSERT INTO worklog_repeats (id,staff_id,set_id,slot,work,freq,days,start_date,end_date,gen_until,created_at,updated_at) VALUES (?,?,NULL,?,?,?,?,?,?,?,?,?)")
        .bind(rid, me.id, row.slot || "", row.work || "", rv.freq, rv.days, row.work_date, rv.end_date, gen, now, now),
      db.prepare("UPDATE worklog SET repeat_id = ?, repeat_key = ? WHERE id = ?").bind(rid, rid + "|" + row.work_date + "|0", row.id),
    ]);
    return { id: rid };
  }

  /* ---------- GET /worklog — แถวช่วงวันที่ (สัปดาห์/วัน) ----------
     ?from=&to= (ค่าเริ่มต้น = วันนี้) · ?staff=me|all|<id> · ?branch=<สาขา>|none · ?status=<คีย์> */
  if (path === "/worklog" && method === "GET") {
    const from = url.searchParams.get("from") || today;
    const to = url.searchParams.get("to") || from;
    if (!isDate(from) || !isDate(to) || to < from) return json({ error: "ช่วงวันที่ไม่ถูกต้อง" }, 400);
    if (daysBetween(from, to) > WL_MAX_RANGE_DAYS) return json({ error: "ดูได้ครั้งละไม่เกิน " + WL_MAX_RANGE_DAYS + " วัน" }, 400);
    const who = url.searchParams.get("staff") || "me";
    const branch = url.searchParams.get("branch") || "";
    const status = url.searchParams.get("status") || "";
    if (status && WL_STATUSES.indexOf(status) === -1) return json({ error: "Process ไม่ถูกต้อง" }, 400);

    const vis = await visibleStaff();
    let target;
    if (who === "me") target = vis.filter((s) => s.id === me.id);
    else if (who === "all") {
      if (!isLead) return json({ error: "ดูของทุกคนได้เฉพาะหัวหน้า" }, 403);
      target = vis;
    } else {
      target = vis.filter((s) => s.id === who);
      if (!target.length) return json({ error: "ไม่มีสิทธิ์ดูบันทึกของคนนี้" }, 403);
    }
    if (branch) target = target.filter((s) => (branch === "none" ? !staffBranch(s) : staffBranch(s) === branch));

    await genRepeats(target);
    await carryOver(target);

    let rows = [];
    const ids = target.map((s) => s.id);
    for (let i = 0; i < ids.length; i += 80) {
      const part = ids.slice(i, i + 80);
      const r = await db.prepare(
        "SELECT * FROM worklog WHERE staff_id IN (" + part.map(() => "?").join(",") + ") AND work_date >= ? AND work_date <= ?" +
        (status ? " AND status = ?" : "") + " ORDER BY work_date, staff_id, slot_start, sort, created_at"
      ).bind(...part, from, to, ...(status ? [status] : [])).all();
      rows = rows.concat(r.results || []);
    }
    if (ids.length > 80) rows.sort((a, b) => (a.work_date + a.staff_id).localeCompare(b.work_date + b.staff_id) || a.slot_start - b.slot_start || a.sort - b.sort);

    /* งานทำซ้ำที่แถวในช่วงนี้อ้างถึง — ไว้เขียนป้าย "🔁 ทุกวันจันทร์" */
    const repIds = rows.map((r) => r.repeat_id).filter((x, i, a) => x && a.indexOf(x) === i);
    let reps = [];
    for (let i = 0; i < repIds.length; i += 90) {
      const part = repIds.slice(i, i + 90);
      reps = reps.concat((await db.prepare("SELECT * FROM worklog_repeats WHERE id IN (" + part.map(() => "?").join(",") + ")").bind(...part).all()).results || []);
    }
    return json({
      today, from, to, isLead,
      rows: await outRows(rows),
      repeats: await repOuts(reps, false),
      staff: vis.map((s) => ({ id: s.id, name: s.name, branch: staffBranch(s), active: !!s.active })),
      branches: TASK_BRANCHES, slots: WL_SLOTS,
      statuses: WL_STATUSES.map((k) => ({ k, th: WL_STATUS_TH[k] })),
    });
  }

  /* ---------- POST /worklog — เพิ่มแถวของตัวเอง ---------- */
  if (path === "/worklog" && method === "POST") {
    const body = await readBody(request);
    const c = cleanInput(body, false);
    if (c.error) return json({ error: c.error }, 400);
    const v = c.value;
    if (v.status === "blocked" && !v.reason) return json({ error: REASON_REQUIRED }, 400);
    /* ติ๊ก "ทำซ้ำ" มาพร้อมแถวใหม่ (ฟอร์มมือถือ) — ตรวจก่อนสร้างแถว จะได้ไม่มีแถวค้างครึ่ง ๆ */
    let rv = null;
    if (body.repeat) {
      const cr = cleanRepeat(body.repeat);
      if (cr.error) return json({ error: cr.error }, 400);
      rv = cr.value;
      if (!v.work.trim()) return json({ error: "พิมพ์ Work ก่อนตั้งทำซ้ำ" }, 400);
      if (rv.end_date && rv.end_date < v.work_date) return json({ error: "วันสิ้นสุดต้องไม่ก่อนวันที่ของแถวนี้" }, 400);
      if ((await repeatCount()) >= WL_MAX_REPEATS) return json({ error: "มีงานทำซ้ำได้ไม่เกิน " + WL_MAX_REPEATS + " รายการ" }, 400);
    }
    const now = nowIso();
    const id = newId("wl_");
    const sort = await nextSort(me.id, v.work_date);
    await db.prepare(
      "INSERT INTO worklog (id,staff_id,work_date,slot,slot_start,sort,work,status,reason,source,created_at,updated_at,updated_by) " +
      "VALUES (?,?,?,?,?,?,?,?,?,'manual',?,?,?)"
    ).bind(id, me.id, v.work_date, v.slot, slotStart(v.slot), sort, v.work, v.status, v.reason, now, now, me.id).run();
    let row = await loadRow(id);
    await logChange(db, { by: me.id, entity: "worklog", entityId: id, action: "create", title: titleOf(row), after: snapRow(row), at: now });
    if (rv) {
      const r2 = await repeatFromRow(row, rv);
      if (r2.error) return json({ error: r2.error }, 400);
      await genRepeats([await myStaff()]);
      row = await loadRow(id);
    }
    return json({ ok: true, row: (await outRows([row]))[0] });
  }

  /* ---------- งานทำซ้ำของฉัน: ดู / ตั้งจากแถว / แก้ / หยุด ---------- */
  if (path === "/worklog/repeats" && method === "GET") {
    const reps = (await db.prepare("SELECT * FROM worklog_repeats WHERE staff_id = ? ORDER BY created_at").bind(me.id).all()).results || [];
    return json({ repeats: await repOuts(reps, true), max: WL_MAX_REPEATS });
  }
  if (path === "/worklog/repeats" && method === "POST") {
    const body = await readBody(request);
    const row = body.rowId ? await loadRow(String(body.rowId)) : null;
    if (!row || row.staff_id !== me.id) return json({ error: "ไม่พบแถวนี้" }, 404);
    const cr = cleanRepeat(body.repeat);
    if (cr.error) return json({ error: cr.error }, 400);
    const r = await repeatFromRow(row, cr.value);
    if (r.error) return json({ error: r.error }, 400);
    await genRepeats([await myStaff()]);
    const one = await db.prepare("SELECT * FROM worklog_repeats WHERE id = ?").bind(r.id).first();
    return json({ ok: true, repeat: (await repOuts([one], true))[0] });
  }
  const repMatch = path.match(/^\/worklog\/repeats\/([A-Za-z0-9_-]{1,40})$/);
  if (repMatch) {
    const rep = await db.prepare("SELECT * FROM worklog_repeats WHERE id = ? AND staff_id = ?").bind(repMatch[1], me.id).first();
    if (!rep) return json({ error: "ไม่พบงานทำซ้ำนี้" }, 404);
    if (method === "PUT") {
      const body = await readBody(request);
      const cr = cleanRepeat(body.repeat);
      if (cr.error) return json({ error: cr.error }, 400);
      const v = cr.value;
      if (v.end_date && v.end_date < rep.start_date) return json({ error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" }, 400);
      let slot = rep.slot, work = rep.work;
      if (!rep.set_id) {
        const ci = cleanInput({ slot: body.slot !== undefined ? body.slot : rep.slot, work: body.work !== undefined ? body.work : rep.work }, true);
        if (ci.error) return json({ error: ci.error }, 400);
        slot = ci.value.slot; work = ci.value.work;
        if (!work.trim()) return json({ error: "พิมพ์ Work ก่อนนะ" }, 400);
      }
      await db.batch([
        db.prepare("UPDATE worklog_repeats SET freq = ?, days = ?, end_date = ?, slot = ?, work = ?, updated_at = ? WHERE id = ?")
          .bind(v.freq, v.days, v.end_date, slot, work, nowIso(), rep.id),
      ].concat(dropFutureStmts(rep.id)));
      await genRepeats([await myStaff()]);
      const one = await db.prepare("SELECT * FROM worklog_repeats WHERE id = ?").bind(rep.id).first();
      return json({ ok: true, repeat: (await repOuts([one], true))[0] });
    }
    if (method === "DELETE") {
      const del = dropFutureStmts(rep.id).slice(0, 1);
      const left = await db.prepare("SELECT COUNT(*) AS n FROM worklog WHERE repeat_id = ? AND work_date > ? AND (updated_by IS NOT NULL OR id IN (SELECT log_id FROM worklog_files))")
        .bind(rep.id, today).first();
      await db.batch(del.concat([
        db.prepare("UPDATE worklog SET repeat_id = NULL WHERE repeat_id = ?").bind(rep.id),
        db.prepare("DELETE FROM worklog_repeats WHERE id = ?").bind(rep.id),
      ]));
      return json({ ok: true, kept: (left && left.n) || 0 });
    }
  }

  /* ---------- ค้นหา Work + reason ทุกช่วงวันที่ ----------
     ใช้ instr() ไม่ใช้ LIKE — LIKE ภาษาไทยยาว ๆ ชนเพดานของ D1 (ดู BRANCH_WORD ใน worker-tasks.js) */
  if (path === "/worklog/search" && method === "GET") {
    const q = String(url.searchParams.get("q") || "").trim().slice(0, 100);
    if (!q) return json({ error: "พิมพ์คำที่จะค้นก่อน" }, 400);
    const to = url.searchParams.get("to") || today;
    const from = url.searchParams.get("from") || addDays(to, -90);
    if (!isDate(from) || !isDate(to) || to < from) return json({ error: "ช่วงวันที่ไม่ถูกต้อง" }, 400);
    if (daysBetween(from, to) > WL_MAX_SEARCH_DAYS) return json({ error: "ค้นได้ครั้งละไม่เกิน 1 ปี" }, 400);
    const who = url.searchParams.get("staff") || (isLead ? "all" : "me");
    const vis = await visibleStaff();
    let ids;
    if (who === "me") ids = [me.id];
    else if (who === "all") ids = isLead ? vis.map((s) => s.id) : [me.id];
    else {
      if (!vis.some((s) => s.id === who)) return json({ error: "ไม่มีสิทธิ์ดูบันทึกของคนนี้" }, 403);
      ids = [who];
    }
    let rows = [];
    for (let i = 0; i < ids.length && rows.length < 200; i += 80) {
      const part = ids.slice(i, i + 80);
      const r = await db.prepare(
        "SELECT * FROM worklog WHERE staff_id IN (" + part.map(() => "?").join(",") + ") AND work_date >= ? AND work_date <= ? " +
        "AND (instr(lower(work), lower(?)) > 0 OR instr(lower(reason), lower(?)) > 0) ORDER BY work_date DESC, slot_start LIMIT 201"
      ).bind(...part, from, to, q, q).all();
      rows = rows.concat(r.results || []);
    }
    rows.sort((a, b) => b.work_date.localeCompare(a.work_date) || a.slot_start - b.slot_start);
    const more = rows.length > 200;
    return json({ q, from, to, more, rows: await outRows(rows.slice(0, 200)) });
  }

  /* ---------- "คัดลอกวันก่อน" — ก๊อปแถวของวันล่าสุดที่มีบันทึก (ก่อนวันปลายทาง) ----------
     ก๊อปเฉพาะแถวที่ "เสร็จแล้ว" — แถวที่ยังไม่เสร็จระบบยกไปวันถัดไปให้เองอยู่แล้ว ก๊อปด้วยจะได้สองแถว
     Process เริ่มที่ "เสร็จแล้ว" · reason/รูปไม่ตามมา */
  /* หาวันต้นทาง: ระบุมา (ต้องก่อนวันปลายทาง) หรือวันล่าสุดที่มีบันทึกย้อนไม่เกิน 30 วัน */
  async function copyFrom(to, want) {
    if (!isDate(to)) return { error: "วันที่ไม่ถูกต้อง", status: 400 };
    if (want) {
      if (!isDate(want) || want >= to) return { error: "วันต้นทางต้องอยู่ก่อนวันปลายทาง", status: 400 };
      return { from: want };
    }
    const r = await db.prepare("SELECT MAX(work_date) AS d FROM worklog WHERE staff_id = ? AND work_date < ? AND work_date >= ?")
      .bind(me.id, to, addDays(to, -30)).first();
    if (!r || !r.d) return { error: "ไม่เจอบันทึกของวันก่อนหน้า (ย้อนดู 30 วัน)", status: 404 };
    return { from: r.d };
  }
  /* แถวของวันต้นทางให้เลือกติ๊ก — ?to=วันปลายทาง &from=วันต้นทาง (ไม่ใส่ = วันล่าสุดที่มีบันทึก)
     ส่งมาทุกแถว แต่ copyable = เฉพาะ "เสร็จแล้ว" (ที่ยังไม่เสร็จระบบยกไปให้เอง ก๊อปซ้ำจะได้สองแถว) */
  if (path === "/worklog/copy-source" && method === "GET") {
    const f = await copyFrom(url.searchParams.get("to") || today, url.searchParams.get("from") || "");
    if (f.error) return json({ error: f.error, notFound: f.status === 404 }, f.status);
    const src = (await db.prepare("SELECT * FROM worklog WHERE staff_id = ? AND work_date = ? ORDER BY slot_start, sort, created_at")
      .bind(me.id, f.from).all()).results || [];
    const rows = await outRows(src);
    rows.forEach((r) => { r.copyable = r.status === "done"; });
    return json({ from: f.from, rows });
  }
  /* ---------- "คัดลอกวันก่อน" — ก๊อปแถวของวันต้นทางมาต่อท้ายวันปลายทาง ----------
     ids = แถวที่ติ๊กเลือก (ไม่ส่ง = ทุกแถวที่ "เสร็จแล้ว" แบบเดิม) · ก๊อปเฉพาะแถว "เสร็จแล้ว" ของตัวเองในวันต้นทางเท่านั้น
     แถวที่ยังไม่เสร็จระบบยกไปวันถัดไปให้เองอยู่แล้ว ก๊อปด้วยจะได้สองแถว · Process เริ่มที่ "เสร็จแล้ว" · reason/รูปไม่ตามมา */
  if (path === "/worklog/copy" && method === "POST") {
    const body = await readBody(request);
    const to = body.to || today;
    const f = await copyFrom(to, body.from || "");
    if (f.error) return json({ error: f.error }, f.status);
    const from = f.from;
    let src = (await db.prepare("SELECT * FROM worklog WHERE staff_id = ? AND work_date = ? AND status = 'done' ORDER BY slot_start, sort")
      .bind(me.id, from).all()).results || [];
    if (Array.isArray(body.ids)) {
      const want = body.ids.map(String);
      src = src.filter((r) => want.indexOf(r.id) !== -1);
      if (!src.length) return json({ error: "ยังไม่ได้เลือกแถวที่จะคัดลอก" }, 400);
    }
    if (!src.length) return json({ error: "วันนั้นไม่มีแถวที่ก๊อปได้" }, 404);
    return insertJson(await insertMany(src.map((r) => ({ slot: r.slot, work: r.work, status: "done" })), to, "copy", "คัดลอกจาก " + from));
  }

  /* ---------- แม่แบบประจำวัน — ตั้งได้หลายชุดต่อคน (ชื่อ + แถว) ---------- */
  /* ชุดแม่แบบของตัวเอง (เรียงตาม sort) พร้อมแถว · แถวเก่าจากตอนมีแม่แบบเดียว ย้ายเข้าชุด "แม่แบบหลัก" ครั้งแรกที่เรียก */
  async function tplSets() {
    const orphan = await db.prepare("SELECT COUNT(*) AS n FROM worklog_templates WHERE staff_id = ? AND set_id IS NULL").bind(me.id).first();
    if (orphan && orphan.n) {
      const now = nowIso(), sid = newId("ts_");
      const top = await db.prepare("SELECT COALESCE(MIN(sort), 1) - 1 AS s FROM worklog_template_sets WHERE staff_id = ?").bind(me.id).first();
      await db.batch([
        db.prepare("INSERT INTO worklog_template_sets (id,staff_id,name,sort,created_at,updated_at) VALUES (?,?,?,?,?,?)")
          .bind(sid, me.id, "แม่แบบหลัก", (top && top.s) || 0, now, now),
        db.prepare("UPDATE worklog_templates SET set_id = ? WHERE staff_id = ? AND set_id IS NULL").bind(sid, me.id),
      ]);
    }
    const sets = (await db.prepare("SELECT id,name,sort FROM worklog_template_sets WHERE staff_id = ? ORDER BY sort, created_at").bind(me.id).all()).results || [];
    const rows = (await db.prepare("SELECT id,set_id,sort,slot,work,status FROM worklog_templates WHERE staff_id = ? ORDER BY sort").bind(me.id).all()).results || [];
    const reps = (await db.prepare("SELECT * FROM worklog_repeats WHERE staff_id = ? AND set_id IS NOT NULL").bind(me.id).all()).results || [];
    const repOut = await repOuts(reps, true);
    return sets.map((x) => ({
      id: x.id, name: x.name,
      rows: rows.filter((r) => r.set_id === x.id).map((r) => ({ id: r.id, slot: r.slot, work: r.work, status: r.status })),
      repeat: repOut.filter((r) => r.setId === x.id)[0] || null,
    }));
  }
  /* ตรวจแถวแม่แบบที่ส่งมา → { stmts(สร้างแถวใหม่), error } */
  function tplRowStmts(setId, list, now) {
    if (!Array.isArray(list)) return { error: "ต้องส่ง rows มาเป็นรายการ" };
    if (list.length > WL_MAX_TEMPLATE) return { error: "แม่แบบมีได้ไม่เกิน " + WL_MAX_TEMPLATE + " แถว" };
    const stmts = [];
    for (let i = 0; i < list.length; i++) {
      const it = list[i] || {};
      const c = cleanInput({ slot: it.slot || "", work: it.work || "", status: it.status || "todo", reason: "" }, true);
      if (c.error) return { error: "แถวที่ " + (i + 1) + ": " + c.error };
      if (c.value.status === "blocked") return { error: "แถวที่ " + (i + 1) + ": แม่แบบตั้งเป็น “ติดปัญหา” ไม่ได้" };
      stmts.push(db.prepare("INSERT INTO worklog_templates (id,staff_id,sort,slot,work,status,updated_at,set_id) VALUES (?,?,?,?,?,?,?,?)")
        .bind(newId("wt_"), me.id, i + 1, c.value.slot, c.value.work, c.value.status, now, setId));
    }
    return { stmts };
  }
  /* ทำซ้ำทั้งแม่แบบ — repeat = { freq, days, endDate } ตั้ง/แก้ · null = เลิกทำซ้ำ · ไม่ส่ง = เหมือนเดิม
     rowsChanged = แก้แถวแม่แบบ → แถวล่วงหน้าที่ยังไม่มีใครแตะสร้างใหม่ตามแถวชุดใหม่ */
  async function tplRepeatStmts(setId, repeat, rowsChanged) {
    const cur = await db.prepare("SELECT * FROM worklog_repeats WHERE set_id = ? AND staff_id = ?").bind(setId, me.id).first();
    if (repeat === undefined) return { stmts: cur && rowsChanged ? dropFutureStmts(cur.id) : [] };
    if (repeat === null) {
      if (!cur) return { stmts: [] };
      return { stmts: dropFutureStmts(cur.id).slice(0, 1).concat([
        db.prepare("UPDATE worklog SET repeat_id = NULL WHERE repeat_id = ?").bind(cur.id),
        db.prepare("DELETE FROM worklog_repeats WHERE id = ?").bind(cur.id),
      ]) };
    }
    const cr = cleanRepeat(repeat);
    if (cr.error) return { error: "ทำซ้ำ: " + cr.error };
    const v = cr.value, now = nowIso();
    if (cur) {
      if (v.end_date && v.end_date < cur.start_date) return { error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" };
      return { stmts: [db.prepare("UPDATE worklog_repeats SET freq = ?, days = ?, end_date = ?, updated_at = ? WHERE id = ?")
        .bind(v.freq, v.days, v.end_date, now, cur.id)].concat(dropFutureStmts(cur.id)) };
    }
    if (v.end_date && v.end_date < today) return { error: "วันสิ้นสุดต้องไม่ก่อนวันนี้" };
    if ((await repeatCount()) >= WL_MAX_REPEATS) return { error: "มีงานทำซ้ำได้ไม่เกิน " + WL_MAX_REPEATS + " รายการ" };
    /* เริ่มวันนี้ — วันนี้ตรงรอบก็เติมให้เลย */
    return { stmts: [db.prepare("INSERT INTO worklog_repeats (id,staff_id,set_id,slot,work,freq,days,start_date,end_date,gen_until,created_at,updated_at) VALUES (?,?,?,'','',?,?,?,?,?,?,?)")
      .bind(newId("wr_"), me.id, setId, v.freq, v.days, today, v.end_date, addDays(today, -1), now, now)] };
  }
  function cleanSetName(v) {
    const n = String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, 60);
    return n || null;
  }
  if (path === "/worklog/templates" && method === "GET") {
    return json({ sets: await tplSets(), maxSets: WL_MAX_TEMPLATE_SETS, maxRows: WL_MAX_TEMPLATE });
  }
  if (path === "/worklog/templates" && method === "POST") {
    const body = await readBody(request);
    const name = cleanSetName(body.name);
    if (!name) return json({ error: "ตั้งชื่อแม่แบบก่อน" }, 400);
    const have = await tplSets();
    if (have.length >= WL_MAX_TEMPLATE_SETS) return json({ error: "มีแม่แบบได้ไม่เกิน " + WL_MAX_TEMPLATE_SETS + " ชุด" }, 400);
    const now = nowIso(), sid = newId("ts_");
    const r = tplRowStmts(sid, body.rows || [], now);
    if (r.error) return json({ error: r.error }, 400);
    const rp = body.repeat ? await tplRepeatStmts(sid, body.repeat, true) : { stmts: [] };
    if (rp.error) return json({ error: rp.error }, 400);
    const last = await db.prepare("SELECT COALESCE(MAX(sort), 0) AS s FROM worklog_template_sets WHERE staff_id = ?").bind(me.id).first();
    await db.batch([db.prepare("INSERT INTO worklog_template_sets (id,staff_id,name,sort,created_at,updated_at) VALUES (?,?,?,?,?,?)")
      .bind(sid, me.id, name, ((last && last.s) || 0) + 1, now, now)].concat(r.stmts, rp.stmts));
    if (rp.stmts.length) await genRepeats([await myStaff()]);
    return json({ ok: true, id: sid, sets: await tplSets() });
  }
  const setMatch = path.match(/^\/worklog\/templates\/([A-Za-z0-9_-]{1,40})$/);
  if (setMatch) {
    const set = await db.prepare("SELECT * FROM worklog_template_sets WHERE id = ? AND staff_id = ?").bind(setMatch[1], me.id).first();
    if (!set) return json({ error: "ไม่พบแม่แบบนี้" }, 404);
    if (method === "PUT") {
      const body = await readBody(request);
      const name = body.name !== undefined ? cleanSetName(body.name) : set.name;
      if (!name) return json({ error: "ตั้งชื่อแม่แบบก่อน" }, 400);
      const now = nowIso();
      const stmts = [db.prepare("UPDATE worklog_template_sets SET name = ?, updated_at = ? WHERE id = ?").bind(name, now, set.id)];
      if (body.rows !== undefined) {
        const r = tplRowStmts(set.id, body.rows, now);
        if (r.error) return json({ error: r.error }, 400);
        stmts.push(db.prepare("DELETE FROM worklog_templates WHERE set_id = ? AND staff_id = ?").bind(set.id, me.id));
        stmts.push(...r.stmts);
      }
      const rp = await tplRepeatStmts(set.id, body.repeat, body.rows !== undefined);
      if (rp.error) return json({ error: rp.error }, 400);
      await db.batch(stmts.concat(rp.stmts));
      if (rp.stmts.length) await genRepeats([await myStaff()]);
      return json({ ok: true, sets: await tplSets() });
    }
    if (method === "DELETE") {
      const rp = await tplRepeatStmts(set.id, null, false);
      await db.batch([
        db.prepare("DELETE FROM worklog_templates WHERE set_id = ? AND staff_id = ?").bind(set.id, me.id),
        db.prepare("DELETE FROM worklog_template_sets WHERE id = ?").bind(set.id),
      ].concat(rp.stmts));
      return json({ ok: true, sets: await tplSets() });
    }
  }
  /* แบบเดิม (แม่แบบเดียว) — หน้าเว็บรุ่นก่อนที่ยังค้างในเบราว์เซอร์ยังเรียกอยู่: ใช้กับชุดแรก */
  if (path === "/worklog/template" && method === "GET") {
    const sets = await tplSets();
    return json({ rows: sets.length ? sets[0].rows : [] });
  }
  if (path === "/worklog/template" && method === "PUT") {
    const body = await readBody(request);
    const sets = await tplSets();
    const now = nowIso();
    const sid = sets.length ? sets[0].id : newId("ts_");
    const r = tplRowStmts(sid, body.rows, now);
    if (r.error) return json({ error: r.error }, 400);
    const stmts = sets.length ? [db.prepare("DELETE FROM worklog_templates WHERE set_id = ? AND staff_id = ?").bind(sid, me.id)]
      : [db.prepare("INSERT INTO worklog_template_sets (id,staff_id,name,sort,created_at,updated_at) VALUES (?,?,?,1,?,?)").bind(sid, me.id, "แม่แบบหลัก", now, now)];
    await db.batch(stmts.concat(r.stmts));
    return json({ ok: true, count: r.stmts.length });
  }
  /* เติมจากแม่แบบ — sets = ชุดที่ติ๊ก (เรียงตามลำดับที่ส่งมา) · ไม่ส่ง = ทุกชุด (แบบเดิม) */
  if (path === "/worklog/template/fill" && method === "POST") {
    const body = await readBody(request);
    const to = body.date || today;
    if (!isDate(to)) return json({ error: "วันที่ไม่ถูกต้อง" }, 400);
    const sets = await tplSets();
    let pick = sets;
    if (Array.isArray(body.sets)) {
      const want = body.sets.map(String);
      pick = want.map((id) => sets.filter((x) => x.id === id)[0]).filter(Boolean);
      if (!pick.length) return json({ error: "ยังไม่ได้เลือกแม่แบบ" }, 400);
    }
    const tpl = [].concat.apply([], pick.map((x) => x.rows));
    if (!tpl.length) return json({ error: sets.length ? "แม่แบบที่เลือกยังไม่มีแถว" : "ยังไม่มีแม่แบบ — ตั้งแถวประจำก่อน" }, 404);
    return insertJson(await insertMany(tpl, to, "template", "เติมจากแม่แบบ " + pick.map((x) => x.name).join(", ")));
  }
  function insertJson(res) { return json(res, res.error ? 400 : 200); }

  /* เพิ่มหลายแถวทีเดียว (ก๊อปวันก่อน / แม่แบบ) — เรียงต่อท้ายแถวที่มีอยู่แล้วของวันนั้น */
  async function insertMany(list, date, source, why) {
    if (daysBetween(today, date) > 366) return { error: "วันที่ห่างจากวันนี้เกินไป" };
    const now = nowIso();
    let sort = await nextSort(me.id, date);
    const ids = [];
    const stmts = list.map((x) => {
      const id = newId("wl_");
      ids.push(id);
      const st = WL_STATUSES.indexOf(x.status) !== -1 && x.status !== "blocked" ? x.status : "todo";
      return db.prepare(
        "INSERT INTO worklog (id,staff_id,work_date,slot,slot_start,sort,work,status,reason,source,created_at,updated_at,updated_by) " +
        "VALUES (?,?,?,?,?,?,?,?,'',?,?,?,?)"
      ).bind(id, me.id, date, x.slot || "", slotStart(x.slot), sort++, x.work || "", st, source, now, now, me.id);
    });
    await db.batch(stmts);
    const rows = (await db.prepare("SELECT * FROM worklog WHERE id IN (" + ids.map(() => "?").join(",") + ") ORDER BY sort").bind(...ids).all()).results || [];
    for (const r of rows) {
      await logChange(db, { by: me.id, entity: "worklog", entityId: r.id, action: "create", title: titleOf(r), after: snapRow(r), summary: why, at: now });
    }
    return { ok: true, count: rows.length, rows: await outRows(rows) };
  }

  /* ---------- รูปแนบ ---------- */
  const fileMatch = path.match(/^\/worklog\/files\/([A-Za-z0-9_-]{1,40})$/);
  if (fileMatch && method === "GET") {
    const wantThumb = url.searchParams.get("thumb") === "1";
    const f = await db.prepare("SELECT f.id, f.mime, f.file_name, " + (wantThumb ? "COALESCE(f.thumb, f.data)" : "f.data") +
      " AS data, (f.thumb IS NOT NULL) AS is_thumb, w.staff_id FROM worklog_files f JOIN worklog w ON w.id = f.log_id WHERE f.id = ?")
      .bind(fileMatch[1]).first();
    if (!f || !(await canSeeStaffId(f.staff_id))) return new Response("ไม่พบไฟล์", { status: 404 });
    const binary = atob(f.data);
    const bin = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bin[i] = binary.charCodeAt(i);
    const mime = wantThumb && f.is_thumb ? "image/jpeg" : (/^image\//.test(f.mime) ? f.mime : "application/octet-stream");
    const safeName = String(f.file_name || "photo").replace(/[^\w.\-ก-๙ ]+/g, "_").slice(0, 120);
    return new Response(bin, {
      headers: {
        "content-type": mime,
        "content-disposition": (/^image\//.test(mime) ? "inline" : "attachment") + '; filename="' + safeName + '"',
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (fileMatch && method === "DELETE") {
    const f = await db.prepare("SELECT f.id, f.file_name, f.log_id, w.staff_id FROM worklog_files f JOIN worklog w ON w.id = f.log_id WHERE f.id = ?")
      .bind(fileMatch[1]).first();
    if (!f) return json({ error: "ไม่พบรูป" }, 404);
    if (f.staff_id !== me.id) return json({ error: "ลบได้เฉพาะรูปในบันทึกของตัวเอง" }, 403);
    const left = await db.prepare("SELECT COUNT(*) AS n FROM worklog_files WHERE log_id = ?").bind(f.log_id).first();
    const n = (left && left.n) || 0;
    await db.prepare("DELETE FROM worklog_files WHERE id = ?").bind(f.id).run();
    const row = await loadRow(f.log_id);
    if (row) await logChange(db, { by: me.id, entity: "worklog", entityId: row.id, action: "update", title: titleOf(row),
      before: snapRow(row, n), after: snapRow(row, n - 1), summary: "ลบรูป " + f.file_name, at: nowIso() });
    return json({ ok: true });
  }

  /* ---------- แถวเดียว: แก้ / ลบ / แนบรูป / ประวัติ ---------- */
  const rowMatch = path.match(/^\/worklog\/([A-Za-z0-9_-]{1,40})(\/files|\/history)?$/);
  if (rowMatch && ["template", "templates", "search", "copy", "copy-source", "files", "repeats"].indexOf(rowMatch[1]) === -1) {
    const id = rowMatch[1], sub = rowMatch[2] || "";
    const row = await loadRow(id);
    if (!row || !(await canSeeStaffId(row.staff_id))) return json({ error: "ไม่พบแถวนี้" }, 404);
    const mine = row.staff_id === me.id;

    if (!sub && method === "GET") return json({ row: (await outRows([row]))[0] });

    if (sub === "/history" && method === "GET") {
      const r = await db.prepare("SELECT id,at,staff_id,action,summary,before_json,after_json FROM audit_log WHERE entity = 'worklog' AND entity_id = ? ORDER BY at DESC LIMIT 100")
        .bind(id).all();
      const items = (r.results || []).map((x) => {
        let fields = [];
        if (x.action === "update" && x.before_json && x.after_json) {
          try { fields = diffSnap(JSON.parse(x.before_json), JSON.parse(x.after_json)); } catch (e) { fields = []; }
        }
        return { id: x.id, at: x.at, by: x.staff_id, action: x.action, summary: x.summary, fields };
      });
      return json({ items, carriedFrom: row.carried_from || null, source: row.source });
    }

    /* เขียนได้เฉพาะแถวของตัวเอง — หัวหน้าดูได้ แต่ไม่แก้บันทึกของน้องแทน */
    if (!mine) return json({ error: "แก้ได้เฉพาะบันทึกของตัวเอง" }, 403);

    if (!sub && method === "PUT") {
      const body = await readBody(request);
      const c = cleanInput(body, true);
      if (c.error) return json({ error: c.error }, 400);
      const v = c.value;
      const next = {
        work_date: v.work_date !== undefined ? v.work_date : row.work_date,
        slot: v.slot !== undefined ? v.slot : row.slot,
        work: v.work !== undefined ? v.work : row.work,
        status: v.status !== undefined ? v.status : row.status,
        reason: v.reason !== undefined ? v.reason : row.reason,
      };
      if (next.status === "blocked" && !next.reason) return json({ error: REASON_REQUIRED }, 400);
      const sort = next.work_date !== row.work_date ? await nextSort(me.id, next.work_date) : row.sort;
      const now = nowIso();
      await db.prepare("UPDATE worklog SET work_date=?, slot=?, slot_start=?, sort=?, work=?, status=?, reason=?, updated_at=?, updated_by=? WHERE id=?")
        .bind(next.work_date, next.slot, slotStart(next.slot), sort, next.work, next.status, next.reason, now, me.id, id).run();
      const after = await loadRow(id);
      await logChange(db, { by: me.id, entity: "worklog", entityId: id, action: "update", title: titleOf(after),
        before: snapRow(row), after: snapRow(after), at: now });
      /* กด "เสร็จแล้ว" ที่แถวต้นทาง → แถวที่ระบบยกต่อไปวันหลัง ๆ (ทั้งสาย) เป็น "เสร็จแล้ว" ตาม (นนท์ 16 ต.ค. 69)
         งานเดียวกัน เสร็จแล้วก็ไม่ควรค้างอยู่ในวันถัดไป · แถวต้นทางไม่ถูกแตะตอนกดเสร็จที่แถวที่ยกมา
         (วันนั้นยังไม่เสร็จจริง ๆ) · เปลี่ยนเป็นสถานะอื่นไม่ส่งต่อ — แถวล่าสุดคือสถานะปัจจุบัน */
      const linked = [];
      if (next.status === "done" && row.status !== "done" && row.carried_to) {
        let cid = row.carried_to;
        for (let hop = 0; cid && hop < 60; hop++) {
          const c = await loadRow(cid);
          if (!c || c.staff_id !== me.id) break;
          if (c.status !== "done") {
            await db.prepare("UPDATE worklog SET status = 'done', updated_at = ?, updated_by = ? WHERE id = ?").bind(now, me.id, c.id).run();
            const ca = await loadRow(c.id);
            await logChange(db, { by: me.id, entity: "worklog", entityId: c.id, action: "update", title: titleOf(ca),
              before: snapRow(c), after: snapRow(ca), summary: "เสร็จแล้วตามแถวต้นทาง " + row.work_date, at: now });
            linked.push(ca);
          }
          cid = c.carried_to;
        }
      }
      return json({ ok: true, row: (await outRows([after]))[0], linked: linked.length ? await outRows(linked) : [] });
    }

    if (!sub && method === "DELETE") {
      const now = nowIso();
      await db.batch([
        db.prepare("DELETE FROM worklog_files WHERE log_id = ?").bind(id),
        db.prepare("DELETE FROM worklog WHERE id = ?").bind(id),
      ]);
      await logChange(db, { by: me.id, entity: "worklog", entityId: id, action: "delete", title: titleOf(row), before: snapRow(row), at: now });
      return json({ ok: true });
    }

    /* แนบรูป — เบราว์เซอร์ย่อรูปมาแล้ว (dataUrl) + รูปย่อเล็ก (thumbDataUrl) ไว้โชว์ในตาราง */
    if (sub === "/files" && method === "POST") {
      const body = await readBody(request);
      const files = Array.isArray(body.files) ? body.files : [];
      if (!files.length) return json({ error: "ยังไม่ได้เลือกรูป" }, 400);
      if (files.length > WL_MAX_FILES_PER_CALL) return json({ error: "แนบได้ครั้งละไม่เกิน " + WL_MAX_FILES_PER_CALL + " รูป" }, 400);
      const have = await db.prepare("SELECT COUNT(*) AS n FROM worklog_files WHERE log_id = ?").bind(id).first();
      const nHave = (have && have.n) || 0;
      if (nHave + files.length > WL_MAX_FILES_PER_ROW) return json({ error: "หนึ่งแถวแนบรูปได้ไม่เกิน " + WL_MAX_FILES_PER_ROW + " รูป" }, 400);
      const now = nowIso();
      const stmts = [], out = [];
      for (const f of files) {
        const p = parseDataUrl(f && f.dataUrl, f && f.fileName);
        if (p.error) return json({ error: p.error }, 400);
        if (!/^image\//.test(p.mime)) return json({ error: "แนบได้เฉพาะรูปภาพ" }, 400);
        let thumb = null;
        if (f.thumbDataUrl) {
          const t = parseDataUrl(f.thumbDataUrl, "thumb");
          if (!t.error && /^image\//.test(t.mime) && t.bytes <= WL_MAX_THUMB_BYTES) thumb = t.b64;
        }
        const fid = newId("wf_");
        const name = String((f && f.fileName) || "photo.jpg").slice(0, 160);
        stmts.push(db.prepare("INSERT INTO worklog_files (id,log_id,staff_id,file_name,mime,bytes,data,thumb,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
          .bind(fid, id, me.id, name, p.mime, p.bytes, p.b64, thumb, now));
        out.push({ id: fid, name, bytes: p.bytes, thumb: !!thumb });
      }
      stmts.push(db.prepare("UPDATE worklog SET updated_at = ?, updated_by = ? WHERE id = ?").bind(now, me.id, id));
      await db.batch(stmts);
      await logChange(db, { by: me.id, entity: "worklog", entityId: id, action: "update", title: titleOf(row),
        before: snapRow(row, nHave), after: snapRow(row, nHave + out.length), summary: "แนบรูป " + out.length + " รูป", at: now });
      return json({ ok: true, files: out });
    }
  }

  return json({ error: "ไม่พบ endpoint นี้" }, 404);
}
