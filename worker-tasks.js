import { notifyReviewSubmitted } from "./worker-lark.js";

// KAN — ระบบมอบหมายงานทีม (Task) · API ที่ /api/t/*
//  - เก็บทุกอย่างใน D1 `kan-erp` (ตารางขึ้นต้น task_* / staff / kpis) — สร้างตารางให้เองครั้งแรกที่ถูกเรียก
//  - ล็อกอิน: สมาชิกกดชื่อตัวเองแล้วเข้าเลย ไม่มีรหัส (นนท์สั่ง 17 ก.ย. 69 — พิซซ่ากับเติ้ลจำ user/รหัสไม่ได้)
//    หัวหน้า (owner) ยังต้องใส่รหัสผ่าน เพราะกดชื่อแล้วได้สิทธิ์ลบทุกอย่าง + เห็นยอดขาย/KPI
//    → cookie เซ็นด้วย HMAC (secret สุ่มเก็บใน D1 ไม่ต้องตั้ง wrangler secret)
//  - รูปแนบเก็บ base64 ใน D1 แบบเดียวกับปฏิทินแคมเปญ (ย่อฝั่งเบราว์เซอร์ก่อน)

const COOKIE = "kan_tsess";
const SESSION_DAYS = 30;
/* review = น้องส่งงานแล้วรอหัวหน้าตรวจ · done = หัวหน้าตรวจผ่านแล้ว
   เวลานับ "ตรงเวลา" ใช้ตอนส่งรอตรวจ (submitted_at) ไม่ใช่ตอนหัวหน้ากดผ่าน
   ไม่งั้นหัวหน้าตรวจช้าแล้วน้องโดนนับว่าส่งช้า */
const STATUSES = ["todo", "doing", "review", "done", "blocked"];
const STATUS_TH = { todo: "รอทำ", doing: "กำลังทำ", review: "รอตรวจ", done: "เสร็จแล้ว", blocked: "ติดปัญหา" };
/* งานรูทีน = ทำซ้ำประจำ · งานตามสั่ง = สั่งเพิ่มเป็นครั้ง ๆ (ค่าเริ่มต้น) */
const TASK_KINDS = ["ondemand", "routine"];
/* ประเภทงาน — คีย์ตายตัว ชื่อไทยอยู่ฝั่งหน้าเว็บ · งานเก่าไม่มีค่า = other */
/* newlot = ล็อตใหม่ — เป็นงานประชาสัมพันธ์ของเข้า ไม่ใช่โปรโมชัน จึงแยกหมวด (นนท์สั่ง 15 ก.ย. 69) */
const TASK_TYPES = ["signage", "content", "campaign", "newlot", "other"];
/* monthly = ทุกเดือน — นนท์ขอเพิ่ม 15 ก.ย. 69 (งานอย่างสรุปยอดรายเดือน คอลเลคชั่นประจำเดือน) */
const REPEATS = ["", "daily", "weekly", "monthly"];

/* ---------- งานป้าย: 6 ขั้นตายตัว (นนท์ยืนยัน 15 ก.ย. 69) ----------
   ทุกขั้นเป็น "งานย่อย" ของงานป้ายหลัก ปิดขั้นต้องแนบรูป · "แบบเสร็จ" ต้องหัวหน้าตรวจผ่าน
   (ซึ่งเป็นกติกาปกติของทุกงานอยู่แล้ว) · lead = จำนวนวันที่ขั้นนั้นใช้ ใช้ถอยหลังจากวันติดตั้ง */
const SIGN_STAGES = [
  { k: "design",    th: "ออกแบบ",      lead: 3 },
  { k: "approved",  th: "แบบเสร็จ",    lead: 1 },
  { k: "sent",      th: "ส่งโรงพิมพ์",  lead: 1 },
  { k: "produced",  th: "ผลิต",        lead: 3 },
  { k: "arrived",   th: "ของถึงสาขา",  lead: 2 },
  { k: "installed", th: "ติดตั้ง",      lead: 1 },
];
const SIGN_STAGE_KEYS = SIGN_STAGES.map((x) => x.k);
/* ขั้นงาน (flow) ตั้งเองได้ต่อประเภทงาน — นนท์ขอ 18 ก.ย. 69: "แก้ไข/เพิ่มลด flow พวกนี้ได้"
   เก็บใน task_settings key 'flows' = { signage:[{k,th,lead,pic}], content:[...], ... }
   ประเภทที่ไม่มี flow → บอร์ดใช้คอลัมน์ตามสถานะเหมือนเดิม · ป้ายมีค่าเริ่มต้น 6 ขั้น (ทุกขั้นต้องแนบรูป) */
const MAX_FLOW_STAGES = 12;
function defaultFlows(leads) {
  const L = leads || {};
  return { signage: SIGN_STAGES.map((x) => ({ k: x.k, th: x.th, lead: Number(L[x.k] != null ? L[x.k] : x.lead) || 0, pic: 1 })) };
}
function cleanFlow(list) {
  if (!Array.isArray(list)) return { error: "รูปแบบขั้นงานไม่ถูกต้อง" };
  const out = [];
  const seen = new Set();
  for (const raw of list.slice(0, MAX_FLOW_STAGES)) {
    const th = String((raw && raw.th) || "").trim().slice(0, 40);
    if (!th) continue;
    let k = String((raw && raw.k) || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
    if (!k) k = "s" + (out.length + 1) + "_" + Math.random().toString(36).slice(2, 6);
    if (seen.has(k)) return { error: "รหัสขั้นซ้ำ: " + k };
    seen.add(k);
    const lead = Math.max(0, Math.min(60, Math.round(Number(raw.lead) || 0)));
    out.push({ k, th, lead, pic: raw.pic ? 1 : 0 });
  }
  return { value: out };
}
export async function loadFlows(db) {
  let flows = null;
  try {
    const row = await db.prepare("SELECT value FROM task_settings WHERE key = 'flows'").first();
    if (row && row.value) flows = JSON.parse(row.value);
  } catch (e) { flows = null; }
  const base = defaultFlows(await signLeads(db));
  if (!flows || typeof flows !== "object") return base;
  /* ป้ายที่ไม่เคยตั้งเอง ใช้ค่าเริ่มต้น */
  for (const k of Object.keys(base)) if (!Array.isArray(flows[k])) flows[k] = base[k];
  for (const k of Object.keys(flows)) if (!Array.isArray(flows[k]) || !flows[k].length) delete flows[k];
  return flows;
}
async function flowFor(db, taskType) {
  const flows = await loadFlows(db);
  return flows[taskType] || [];
}
function stageIdx(flow, k) { for (let i = 0; i < flow.length; i++) if (flow[i].k === k) return i; return -1; }
function stageDef(flow, k) { return flow[stageIdx(flow, k)] || null; }
/* ปิดขั้นนี้ต้องแนบรูปไหม — ขั้นที่ไม่อยู่ใน flow แล้ว (ตั้งชื่อใหม่ไปแล้ว) ถือว่าไม่บังคับ */
async function stageNeedsPic(db, task) {
  if (!task.stage) return false;
  const def = stageDef(await flowFor(db, task.taskType), task.stage);
  return !!(def && def.pic);
}
/* วันคาดว่าเสร็จของแต่ละขั้น = วันติดตั้ง − ผลรวม lead ของขั้นที่ตามหลัง
   ข้ามเสาร์อาทิตย์ (โรงพิมพ์ปิด) แต่ไม่ยุ่งกับวันหยุดรายคน */
function stageDueDates(installIso, leads, flow) {
  const L = leads || {};
  const STAGES = flow && flow.length ? flow : SIGN_STAGES;
  const out = {};
  let cursor = new Date(installIso);
  for (let i = STAGES.length - 1; i >= 0; i--) {
    const st = STAGES[i];
    out[st.k] = cursor.toISOString();
    const days = Number(L[st.k] != null ? L[st.k] : st.lead) || 0;
    /* ถอยหลังทีละวันทำการ */
    let left = days;
    while (left > 0) {
      cursor = new Date(cursor.getTime() - 86400000);
      const dow = new Date(cursor.getTime() + 7 * 3600000).getUTCDay();   /* วันแบบไทย */
      if (dow !== 0 && dow !== 6) left--;
    }
  }
  return out;
}
async function signLeads(db) {
  try {
    const row = await db.prepare("SELECT value FROM task_settings WHERE key = 'sign_leads'").first();
    return row && row.value ? JSON.parse(row.value) : {};
  } catch (e) { return {}; }
}
/* สร้างงานย่อยตามขั้นงาน (flow) ของประเภทนั้นให้งานหลัก — เรียกได้ซ้ำ ถ้ามีอยู่แล้วไม่สร้างซ้อน
   ประเภทที่ไม่มี flow → ไม่สร้างอะไร · วันคาดว่าเสร็จถอยหลังจากกำหนดส่งของงานหลัก */
async function ensureSignStages(db, mainId, meId, now) {
  const main = await db.prepare("SELECT id,title,due_at,task_type FROM tasks WHERE id = ?").bind(mainId).first();
  if (!main) return { created: 0 };
  const flow = await flowFor(db, main.task_type || "other");
  if (!flow.length) return { created: 0 };
  const have = await db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE parent_id = ? AND stage IS NOT NULL").bind(mainId).first();
  if (have && have.n > 0) return { created: 0 };
  const who = await db.prepare("SELECT staff_id FROM task_assignees WHERE task_id = ?").bind(mainId).all();
  const assignees = (who.results || []).map((r) => r.staff_id);
  const dues = main.due_at ? stageDueDates(main.due_at, {}, flow) : {};
  const stmts = [];
  flow.forEach((st, i) => {
    const id = newId("t_");
    stmts.push(db.prepare(
      "INSERT INTO tasks (id,title,detail,kpi_id,status,due_at,repeat,priority,created_by,created_at,updated_at,done_at,parent_id,campaign_id,task_type,task_kind,hours,support,due_original,stage) " +
      "VALUES (?,?,?,NULL,'todo',?,'',0,?,?,?,NULL,?,NULL,?,'ondemand',NULL,1,?,?)"
    ).bind(id, st.th + " · " + String(main.title).slice(0, 200),
           "ขั้นที่ " + (i + 1) + " จาก " + flow.length + (st.pic ? "\nปิดขั้นนี้ต้องแนบรูปยืนยัน" : ""),
           dues[st.k] || null, meId, now, now, mainId, main.task_type || "other", dues[st.k] || null, st.k));
    for (const sid of assignees) {
      stmts.push(db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, staff_id) VALUES (?,?)").bind(id, sid));
    }
    stmts.push(db.prepare(
      "INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)"
    ).bind(newId("u_"), id, meId, "create", "", "todo", now));
  });
  await db.batch(stmts);
  return { created: flow.length };
}
/* D1 เก็บ 1 แถวได้ไม่เกิน 2MB และเราเก็บเป็น base64 (โต 4/3) → ไฟล์จริงจึงได้ราว 1.4MB
   1.35MB คือเพดานที่เหลือที่ว่างให้คอลัมน์อื่น · ไฟล์ใหญ่กว่านี้ (วิดีโอ) ให้แนบเป็นลิงก์แทน */
const MAX_FILE_BYTES = 1350000;
const MAX_FILES_PER_UPDATE = 6;
const MAX_LINKS_PER_UPDATE = 6;
const MAX_BULK_TASKS = 60;

/* ---------- schema ---------- */
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS task_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS staff (" +
    "id TEXT PRIMARY KEY, name TEXT NOT NULL, aliases TEXT NOT NULL DEFAULT '', " +
    "role TEXT NOT NULL DEFAULT 'member', pin_salt TEXT NOT NULL, pin_hash TEXT NOT NULL, " +
    "active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS kpis (" +
    "id TEXT PRIMARY KEY, sort INTEGER NOT NULL, code TEXT NOT NULL, title TEXT NOT NULL, " +
    "weight INTEGER NOT NULL DEFAULT 0, target TEXT NOT NULL DEFAULT '', " +
    "keywords TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#8B8A84')",
  "CREATE TABLE IF NOT EXISTS tasks (" +
    "id TEXT PRIMARY KEY, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', kpi_id TEXT, " +
    "status TEXT NOT NULL DEFAULT 'todo', due_at TEXT, repeat TEXT NOT NULL DEFAULT '', " +
    "priority INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL, " +
    "updated_at TEXT NOT NULL, done_at TEXT)",
  "CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at)",
  "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)",
  "CREATE TABLE IF NOT EXISTS task_assignees (" +
    "task_id TEXT NOT NULL, staff_id TEXT NOT NULL, PRIMARY KEY (task_id, staff_id))",
  "CREATE INDEX IF NOT EXISTS idx_task_assignees_staff ON task_assignees(staff_id)",
  "CREATE TABLE IF NOT EXISTS task_updates (" +
    "id TEXT PRIMARY KEY, task_id TEXT NOT NULL, staff_id TEXT NOT NULL, " +
    "kind TEXT NOT NULL DEFAULT 'note', note TEXT NOT NULL DEFAULT '', status_to TEXT, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_task_updates_task ON task_updates(task_id)",
  "CREATE TABLE IF NOT EXISTS task_files (" +
    "id TEXT PRIMARY KEY, task_id TEXT NOT NULL, update_id TEXT, file_name TEXT NOT NULL, " +
    "mime TEXT NOT NULL, bytes INTEGER NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_task_files_task ON task_files(task_id)",
  /* กันเดารหัสผ่านหัวหน้า — หน้าล็อกอินเปิดสาธารณะ ผิด 5 ครั้งล็อก 10 นาที */
  "CREATE TABLE IF NOT EXISTS task_logins (" +
    "staff_id TEXT PRIMARY KEY, fails INTEGER NOT NULL DEFAULT 0, locked_until TEXT)",
  /* ตารางโพสต์คอนเทนต์รายเพจ — พิซซ่าเป็นคนกรอกแผน หัวหน้าเข้ามาตรวจว่าโพสต์แล้วยังและมีลิงก์ไหม
     ไม่ทำเป็น task รายโพสต์ เพราะเดือนหนึ่งมีเป็นร้อย จะกลบงานจริงในระบบจนหาไม่เจอ */
  "CREATE TABLE IF NOT EXISTS post_pages (" +
    "id TEXT PRIMARY KEY, name TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)",
  "CREATE TABLE IF NOT EXISTS posts (" +
    "id TEXT PRIMARY KEY, page_id TEXT NOT NULL, post_date TEXT NOT NULL, post_time TEXT NOT NULL DEFAULT '', " +
    "channels TEXT NOT NULL DEFAULT '[]', topic TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'content', " +
    "status TEXT NOT NULL DEFAULT 'plan', url TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', " +
    "posted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT)",
  /* บันทึกทุกการเพิ่ม/แก้/ลบโพสต์ — ไว้ให้ย้อนดูว่าใครทำอะไรตอนไหน และกดลบของที่พลาดได้ */
  "CREATE TABLE IF NOT EXISTS post_log (" +
    "id TEXT PRIMARY KEY, post_id TEXT, staff_id TEXT NOT NULL, action TEXT NOT NULL, " +
    "page_id TEXT, post_date TEXT, post_time TEXT, topic TEXT, changes TEXT, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_post_log_time ON post_log(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(post_date)",
  "CREATE INDEX IF NOT EXISTS idx_posts_page ON posts(page_id, post_date)",
  /* แท็กคนในคอมเมนต์ → กระดิ่งแจ้งเตือนของคนนั้น */
  "CREATE TABLE IF NOT EXISTS task_mentions (" +
    "id TEXT PRIMARY KEY, task_id TEXT NOT NULL, update_id TEXT NOT NULL, staff_id TEXT NOT NULL, " +
    "by_staff TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, read_at TEXT)",
  "CREATE INDEX IF NOT EXISTS idx_task_mentions_staff ON task_mentions(staff_id, read_at)",
  /* ── CRM: ลีดที่ทักเข้ามาจากแอด/เพจ (นนท์ 21 ก.ย. 69) ──────────────────
     ทีมการตลาดบันทึกลีด → ทีมขาย "รับลีด" แล้วไล่ปิด → ปิดได้แล้วส่งต่อบัญชี
     สามคนละหน้าที่กัน ตารางจึงแยก created_by (คนบันทึก) กับ owner_id (คนไล่ปิด) คนละช่อง
     ขั้นใช้คำเดียวกับ M CRM เป๊ะ ๆ จะได้ไม่ต้องแปลศัพท์เวลาคุยข้ามสองระบบ */
  "CREATE TABLE IF NOT EXISTS leads (" +
    "id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', line_id TEXT NOT NULL DEFAULT '', " +
    "source TEXT NOT NULL DEFAULT 'other', source_detail TEXT NOT NULL DEFAULT '', " +
    "interest TEXT NOT NULL DEFAULT '', branch TEXT NOT NULL DEFAULT '', " +
    "status TEXT NOT NULL DEFAULT 'new', owner_id TEXT, est_value INTEGER NOT NULL DEFAULT 0, " +
    /* received_at = วันที่ลูกค้าทักเข้ามาจริง ไม่ใช่วันที่พิมพ์เข้าระบบ — นาฬิกา SLA เดินจากตัวนี้
       ลีดที่อิมพอร์ตย้อนหลังถ้านับจาก created_at จะดูเหมือนเพิ่งเข้ามา ของที่ดองอยู่จะหายจากรายงาน */
    "received_at TEXT, fb_name TEXT NOT NULL DEFAULT '', " +
    "bought_before INTEGER NOT NULL DEFAULT 0, lost_reason TEXT NOT NULL DEFAULT '', next_at TEXT, " +
    "handed_at TEXT, handed_by TEXT, " +
    "created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT)",
  "CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id, status)",
  /* ประวัติของลีดแต่ละใบ — โน้ต · เปลี่ยนขั้น · รับลีด · ส่งต่อบัญชี อยู่สายเดียวกัน */
  "CREATE TABLE IF NOT EXISTS lead_activities (" +
    "id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, staff_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'note', " +
    "body TEXT NOT NULL DEFAULT '', from_status TEXT, to_status TEXT, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_lead_act ON lead_activities(lead_id, created_at DESC)",
];

/* คอลัมน์ที่เพิ่มทีหลัง — ตารางมีข้อมูลจริงแล้ว CREATE TABLE IF NOT EXISTS ไม่เติมให้
   รันซ้ำจะได้ error "duplicate column" ซึ่งกลืนทิ้งได้ */
const ALTERS = [
  "ALTER TABLE tasks ADD COLUMN parent_id TEXT",
  "ALTER TABLE leads ADD COLUMN received_at TEXT",
  "ALTER TABLE leads ADD COLUMN fb_name TEXT NOT NULL DEFAULT ''",
  /* ดัชนีที่อ้างคอลัมน์ซึ่งเพิ่มทีหลัง ต้องอยู่ "หลัง" ALTER เสมอ ห้ามย้ายขึ้นไปใน SCHEMA
     SCHEMA รันเป็น batch เดียว ถ้าตารางเก่ายังไม่มีคอลัมน์ ทั้ง batch จะล้ม = ทั้งระบบ 500 */
  "CREATE INDEX IF NOT EXISTS idx_leads_recv ON leads(received_at)",
  /* email/username/pw_* เหลือใช้แค่รหัสผ่านของหัวหน้า — สมาชิกกดชื่อเข้าเลย (17 ก.ย. 69) */
  "ALTER TABLE staff ADD COLUMN email TEXT",
  "ALTER TABLE staff ADD COLUMN pw_salt TEXT",
  "ALTER TABLE staff ADD COLUMN pw_hash TEXT",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_email ON staff(email) WHERE email IS NOT NULL",
  /* ชื่อผู้ใช้สั้น ๆ สำหรับคนที่ไม่มีอีเมลบริษัท — ใช้เข้าระบบแทนอีเมลได้ */
  "ALTER TABLE staff ADD COLUMN username TEXT",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_username ON staff(username) WHERE username IS NOT NULL",
  /* แนบได้ทั้งไฟล์และลิงก์ — ของเดิมรับแต่รูป */
  "ALTER TABLE task_files ADD COLUMN kind TEXT NOT NULL DEFAULT 'file'",
  "ALTER TABLE task_files ADD COLUMN url TEXT",
  "ALTER TABLE task_files ADD COLUMN title TEXT",
  /* เชื่อมโพสต์และงานเข้ากับรายการในปฏิทินการตลาด — "เรื่องเดียวกัน" ต้องชี้ไปที่เดียวกัน */
  "ALTER TABLE staff ADD COLUMN sections TEXT",
  "ALTER TABLE staff ADD COLUMN api_token TEXT",
  "ALTER TABLE posts ADD COLUMN created_by TEXT",
  "ALTER TABLE task_updates ADD COLUMN edited_at TEXT",
  "ALTER TABLE posts ADD COLUMN campaign_id TEXT",
  "ALTER TABLE tasks ADD COLUMN campaign_id TEXT",
  "CREATE INDEX IF NOT EXISTS idx_posts_campaign ON posts(campaign_id)",
  "CREATE INDEX IF NOT EXISTS idx_tasks_campaign ON tasks(campaign_id)",
  /* ประเภทงาน — งานเก่าที่ไม่มีค่าจะถูกอ่านเป็น "อื่น ๆ" */
  "ALTER TABLE tasks ADD COLUMN task_type TEXT",
  /* รอบ ก+ข (ก.ย. 2569) — ตรวจงาน · ชนิดงาน · ชั่วโมง · งบเวลา · สิทธิ์รายคน */
  "ALTER TABLE tasks ADD COLUMN task_kind TEXT",
  "ALTER TABLE tasks ADD COLUMN hours REAL",
  "ALTER TABLE tasks ADD COLUMN support INTEGER NOT NULL DEFAULT 0",
  /* วันเดิมก่อนถูกเลื่อน — ใช้นับตรงเวลา ไม่งั้นเลื่อนแล้วตัวเลขสวยเสมอ */
  "ALTER TABLE tasks ADD COLUMN due_original TEXT",
  "ALTER TABLE tasks ADD COLUMN submitted_at TEXT",
  "ALTER TABLE tasks ADD COLUMN approved_at TEXT",
  "ALTER TABLE tasks ADD COLUMN approved_by TEXT",
  "ALTER TABLE tasks ADD COLUMN postpones INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE staff ADD COLUMN work_days TEXT",
  "ALTER TABLE staff ADD COLUMN hours_per_day REAL",
  /* ติ๊กงานของคนอื่นได้ — พิซซ่าขอไว้ เพื่ออัปเดตงานแทนเติ้ล */
  "ALTER TABLE staff ADD COLUMN can_update_others INTEGER NOT NULL DEFAULT 0",
  /* แก้กำหนดส่งได้ — เดิมมีแค่หัวหน้ากับคนสั่งงาน นนท์ขอเปิดให้พิซซ่าด้วย (15 ก.ย. 69) */
  "ALTER TABLE staff ADD COLUMN can_reschedule INTEGER NOT NULL DEFAULT 0",
  /* บัญชีที่ต้องใส่รหัสผ่านทุกครั้ง (ฝ่ายขาย/คนนอกทีมหลัก) — คนเดิมยังกดชื่อเข้าได้เหมือนเดิม */
  "ALTER TABLE staff ADD COLUMN require_pw INTEGER NOT NULL DEFAULT 0",
  /* งานประจำทำวันไหนบ้าง — "0,1,2,3,4" = จ–ศ · ว่าง = ตามความถี่เดิม (นนท์ 22 ก.ย. 69 ขอลากยาวข้ามวัน) */
  "ALTER TABLE tasks ADD COLUMN repeat_days TEXT",
  "CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at)",
  /* คิวรีรายการงานมี subquery 6 ตัวต่อหนึ่งแถว — ขาด index 3 ตัวนี้แล้วมันสแกนทั้งตารางต่อแถว
     ทำให้เปิดหน้ารายการครั้งเดียวอ่านเป็นแสนแถว จนชนเพดานรายวันของ D1 (เจอ 15 ก.ย. 69) */
  "CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id)",
  "CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id)",
  "CREATE INDEX IF NOT EXISTS idx_task_mentions_task ON task_mentions(task_id)",
  /* ประวัติการแก้ไขทั้งระบบ + ย้อนเวอร์ชันแบบ Google Sheet (นนท์ 20 ก.ย. 69)
     before_json = สภาพก่อนแก้ ใช้กดย้อนกลับ · after_json = หลังแก้ ไว้เทียบ */
  "CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, at TEXT NOT NULL, staff_id TEXT NOT NULL, " +
    "entity TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', " +
    "summary TEXT NOT NULL DEFAULT '', before_json TEXT, after_json TEXT, reverted_at TEXT, reverted_by TEXT)",
  "CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id)",
  /* งานป้าย (18 ก.ย. 69): ขนาด จำนวนใบ สาขา + ขั้นตอนของงานย่อย */
  "ALTER TABLE tasks ADD COLUMN sign_w REAL",
  "ALTER TABLE tasks ADD COLUMN sign_h REAL",
  "ALTER TABLE tasks ADD COLUMN sign_qty INTEGER",
  "ALTER TABLE tasks ADD COLUMN sign_branch TEXT",
  "ALTER TABLE tasks ADD COLUMN stage TEXT",
];

const MAX_PIN_FAILS = 5;
const LOCK_MINUTES = 10;

/* KPI CMO ปี 2570 — จาก Executive Offer CMO KanImport 2027 (8 ก.ย. 2569)
   keywords ใช้เดาหมวดตอนวางข้อความสั่งงาน (แก้ได้ในหน้า KPI ภายหลัง) */
const KPI_SEED = [
  { id: "kpi1", sort: 1, code: "KPI 1", weight: 20, color: "#F2565A",
    title: "Revenue Growth & Branch Demand Support",
    target: "สนับสนุนยอดรวม 102 ล้านบาท/ปี · มี Demand Plan รายสาขา · ทุกสาขาต้องไม่หยุดชะงัก",
    keywords: "ยอดขาย,demand,จอ,signmate,ป้าย,โปรโมชั่น,โปร,แคมเปญ,campaign,บขส,สาขา" },
  { id: "kpi2", sort: 2, code: "KPI 2", weight: 20, color: "#F0943E",
    title: "New Customer Acquisition & Customer Base Growth",
    target: "Unique New Customer >= 18,000 ราย/ปี · ทุกสาขาผ่าน Branch Gate 85%",
    keywords: "สมาชิกใหม่,new user,new customer,ลูกค้าใหม่,สมัคร,member,สมาชิก,acquisition" },
  { id: "kpi3", sort: 3, code: "KPI 3", weight: 15, color: "#7A5CF0",
    title: "CRM / Retention / Repeat Purchase",
    target: "Company Churn <= 35% · Segmentation New/Active/VIP/At-risk · Loyalty / Win-back วัดผลได้",
    keywords: "vip,สะสม,crm,retention,repeat,win-back,loyalty,privilege,ซื้อซ้ำ,ลูกค้าเก่า,หายไป,คูปอง,สมาชิกเดิม,ดึงกลับ" },
  { id: "kpi4", sort: 4, code: "KPI 4", weight: 15, color: "#B8820A",
    title: "Basket Size / Spend per Customer / Customer Value",
    target: "Average Basket · Spend per Visit · Purchase Frequency · Cross-category โตจากฐานปี 2569",
    keywords: "basket,ตะกร้า,cross,upsell,ยอดต่อบิล,ต่อบิล,spend,บิล,ซื้อครบ,มัธยฐาน,ยอดเฉลี่ย,พ่วง,จับคู่" },
  { id: "kpi5", sort: 5, code: "KPI 5", weight: 20, color: "#0E9BA8",
    title: "New Sales Channel & New S-Curve Development",
    target: "Scale >= 3 ช่องทาง/ปี ผ่าน Explore → Business Case → Pilot → Measure → Scale · 1 ช่องทางเป็น New S-Curve >= 20% ของรายได้",
    keywords: "central,บูธ,ontour,on tour,ทัวร์,pop-up,popup,live,marketplace,b2b,wholesale,ช่องทาง,ห้าง,robinson,roadshow,dealer" },
  { id: "kpi6", sort: 6, code: "KPI 6", weight: 10, color: "#1FA968",
    title: "Marketing Efficiency / Data / Forecast / Dashboard",
    target: "Source Attribution >= 90% · Customer Identification >= 85% · CAC/ROI · Forecast · Branch Dashboard · Channel P&L",
    keywords: "dashboard,track,pos,data,รายงาน,งบ,เอกสาร,forecast,วัดผล,attribution,cac,roi" },
];

/* ---------- สิทธิ์ตามหมวดเมนู ----------------------------------------
   นนท์: "ทุกคนเห็นทุกอย่าง ยกเว้นรายงานยอดขายกับ KPI"
     tasks = งานทีม + ตารางโพสต์ + ปฏิทินการตลาด
     docs  = เอกสารแผนงาน B2B รายงานการรับสาย สไลด์แผน ทราฟฟิก
     sales = แอปยอดขาย/การตลาด ทั้งชุด (/admin/mkt/*) — ตัวเลขยอดขายทั้งหมดอยู่ในนี้
     kpi   = KPI 2570 + KPI Dashboard
   หัวหน้า (owner) เห็นทุกหมวดเสมอ ปิดไม่ได้ */
/* crm = หน้าลีดอย่างเดียว (ต้น/ตาล ฝ่ายขาย — นนท์ 21 ก.ย. 69) */
const SECTION_KEYS = ["tasks", "docs", "sales", "kpi", "crm"];
const DEFAULT_SECTIONS = ["tasks", "docs"];
function sectionsOf(row) {
  if (!row) return [];
  if (row.role === "owner") return SECTION_KEYS.slice();
  if (row.sections == null) return DEFAULT_SECTIONS.slice();
  return String(row.sections).split(",").map((x) => x.trim()).filter((x) => SECTION_KEYS.indexOf(x) !== -1);
}
function cleanSections(v) {
  const list = Array.isArray(v) ? v : String(v || "").split(",");
  const out = [];
  list.forEach((x) => {
    const k = String(x).trim();
    if (SECTION_KEYS.indexOf(k) !== -1 && out.indexOf(k) === -1) out.push(k);
  });
  return out.join(",");
}
export function canSee(staffRow, section) {
  if (!staffRow) return false;
  if (!section || section === "login") return true;
  if (section === "admin") return staffRow.role === "owner";
  return sectionsOf(staffRow).indexOf(section) !== -1;
}
/* อ่านคุกกี้แล้วคืนแถว staff — worker.js ใช้กันหน้าเว็บที่เป็นไฟล์นิ่ง */
export async function authFor(request, env) {
  const db = env.KAN_ERP;
  if (!db) return null;
  try {
    await ensureSchema(db, env);
    return await currentStaff(request, db);
  } catch (e) { return null; }
}

const STAFF_SEED = [
  { id: "s_nont", name: "Nont Chawan", aliases: "Nont,นนท์,Chawan", role: "owner" },
  { id: "s_julalak", name: "Julalak Krongkheaw", aliases: "Julalak,Krongkheaw", role: "member" },
  { id: "s_title", name: "Title Thitima S.", aliases: "Title,Thitima", role: "member" },
  { id: "s_pizza", name: "Pizza", aliases: "Pizza,พิซซ่า", role: "member" },
];

/* งานเข้าคิว "รอตรวจ" → เด้งเข้ากลุ่ม Lark "เตือนตรวจงาน" ทันที (นนท์ 21 ก.ย. 69)
   ยิงหลัง db.batch สำเร็จแล้วเท่านั้น จะได้ไม่เตือนงานที่บันทึกไม่ผ่าน
   ใส่ใน waitUntil เพื่อไม่ให้คนกดส่งงานต้องรอ Lark ตอบก่อนถึงจะเห็นหน้าเว็บขยับ */
function pingReview(ctx, env, db, list) {
  if (!ctx || !list || !list.length) return;
  ctx.waitUntil((async () => {
    for (const it of list) await notifyReviewSubmitted(env, db, it);
  })());
}

/* ---------- helpers ---------- */
function json(data, status = 200, extraHeaders) {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (extraHeaders) for (const k of Object.keys(extraHeaders)) headers[k] = extraHeaders[k];
  return new Response(JSON.stringify(data), { status, headers });
}

function hex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randHex(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return hex(a.buffer);
}
async function sha256Hex(str) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)));
}

/* รหัสผ่านหัวหน้าใช้ PBKDF2 ไม่ใช่ SHA-256 เปล่า — ตัวหลังเดาด้วยการ์ดจอได้เร็วเกินไป */
const PBKDF2_ITER = 100000;
async function pbkdf2Hex(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITER, hash: "SHA-256" },
    key, 256
  );
  return hex(bits);
}
function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}
function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normEmail(v)) && normEmail(v).length <= 160;
}
function normUser(v) {
  return String(v || "").trim().toLowerCase();
}
/* ชื่อผู้ใช้: a-z 0-9 . _ - ยาว 3–32 · ห้ามมี @ จะได้แยกออกจากอีเมลตอนล็อกอิน */
function validUsername(v) {
  return /^[a-z0-9._-]{3,32}$/.test(normUser(v));
}
function validPassword(v) {
  return typeof v === "string" && v.length >= 8 && v.length <= 200;
}
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
function newId(prefix) {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}
/* วันเวลาแบบไทยสำหรับข้อความในไทม์ไลน์ — worker ไม่มี timezone ให้ใช้ บวก 7 ชม.เอง */
function thDate(iso) {
  if (!iso) return "ยังไม่กำหนด";
  const d = new Date(new Date(iso).getTime() + 7 * 3600000);
  if (isNaN(d.getTime())) return "ยังไม่กำหนด";
  const M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const p = (n) => (n < 10 ? "0" : "") + n;
  return d.getUTCDate() + " " + M[d.getUTCMonth()] + " " + String(d.getUTCFullYear() + 543).slice(-2) +
         " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
}
/* กติกาเดียวที่ใช้ทั้งสองทางเข้า (PUT /tasks/:id และ POST /updates)
   คนที่ไม่ใช่หัวหน้าและไม่ใช่คนสั่งงาน กด "เสร็จแล้ว" = ส่งรอตรวจ ไม่ใช่ปิดงานเอง
   รวมงานประจำด้วย — นนท์บอกว่างานของเขาคือตรวจงานน้องทุกงาน (18 ก.ย. 69)
   ตรวจจากหน้ารายการได้ทีละคลิก ไม่ต้องเข้าไปในงาน */
/* "งานสมบูรณ์" ตัดสินโดยหัวหน้าคนเดียว (นนท์สั่ง 21 ก.ย. 69)
   ของเดิมคนสั่งงานกดผ่านงานที่ตัวเองสั่งได้ → เติ้ลสั่งงานตัวเอง ทำเอง แล้วกดปิดเองได้
   งานเลยจบโดยที่หัวหน้าไม่เคยเห็น · ตอนนี้ใครที่ไม่ใช่หัวหน้ากด "เสร็จแล้ว" = ไปเข้าคิว "รอตรวจ" เสมอ
   สิทธิ์อื่น (แก้ ลบ เปลี่ยนวัน) ยังเป็นของคนสั่งงานเหมือนเดิม เปลี่ยนเฉพาะการปิดงาน */
function needsReview(task, isOwner) {
  return !isOwner;
}
function statusFor(want, task, isOwner) {
  return want === "done" && needsReview(task, isOwner) ? "review" : want;
}
/* คอลัมน์เวลาที่ต้องเขียนตามสถานะใหม่ — ส่งรอตรวจจับเวลาไว้ที่ submitted_at
   เพราะ "ตรงเวลา" นับตอนน้องส่ง ไม่ใช่ตอนหัวหน้าตรวจ */
function stampsFor(status, task, now, meId) {
  const submitted = status === "review" ? now : (status === "done" ? (task.submittedAt || now) : null);
  const doneAt = status === "done" ? (task.repeat || task.status !== "done" ? now : task.doneAt) : null;
  const approvedAt = status === "done" ? now : null;
  const approvedBy = status === "done" ? meId : null;
  return { submitted, doneAt, approvedAt, approvedBy };
}
function nowIso() {
  return new Date().toISOString();
}
function isIsoDateTime(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !isNaN(Date.parse(s));
}
function getCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}
async function readBody(request) {
  return request.json().catch(() => ({}));
}

/* ---------- นำเข้าลีดชุดแรก ครั้งเดียวตลอดกาล ----------
   ไฟล์ leads-seed.json มาจากชีตที่นนท์ส่งมา 21 ก.ย. 69 (ลีดทักเพจวันอาทิตย์ 20 ก.ย.)
   ใช้วิธีเดียวกับตารางโพสต์: อ่านผ่าน env.ASSETS + ธงกันซ้ำใน task_settings
   ลบลีดทิ้งทีหลังก็จะไม่กลับมาเอง เพราะธงถูกปักไว้แล้ว */
async function seedLeadsOnce(db, env) {
  const flag = await db.prepare("SELECT value FROM task_settings WHERE key = 'leads_seeded'").first();
  if (flag && flag.value) return;
  if (!env || !env.ASSETS) return;

  let data = null;
  try {
    const res = await env.ASSETS.fetch(new Request("https://kan.local/admin/tasks/leads-seed.json"));
    if (!res.ok) return;
    data = await res.json();
  } catch (e) { return; }
  if (!data || !Array.isArray(data.leads) || !data.leads.length) return;

  /* ลงชื่อหัวหน้าเป็นคนบันทึก — ลีดชุดนี้มาจากไฟล์ ไม่ได้มีใครนั่งพิมพ์ */
  const own = await db.prepare("SELECT id FROM staff WHERE role = 'owner' AND active = 1 ORDER BY id").first();
  const by = (own && own.id) || "s_nont";
  const now = nowIso();
  const recv = data.receivedAt && isIsoDateTime(data.receivedAt) ? new Date(data.receivedAt).toISOString() : now;
  const src = LEAD_SOURCES.indexOf(String(data.source)) !== -1 ? String(data.source) : "fb";

  const stmts = [];
  for (const L of data.leads.slice(0, 500)) {
    const name = String(L.name || "").trim().slice(0, 120);
    if (!name) continue;
    const id = newId("ld_");
    stmts.push(db.prepare(
      "INSERT INTO leads (id,name,phone,line_id,source,source_detail,interest,branch,status,owner_id," +
      "est_value,bought_before,lost_reason,next_at,received_at,fb_name,created_by,created_at,updated_at,updated_by) " +
      "VALUES (?,?,?,?,?,?,?,?,'new',NULL,0,0,'',NULL,?,?,?,?,?,?)"
    ).bind(id, name, String(L.phone || "").slice(0, 40), String(L.lineId || "").slice(0, 80),
           src, String(data.sourceDetail || "").slice(0, 200),
           String(L.interest || "").slice(0, 1000), String(L.branch || "").slice(0, 60),
           recv, String(L.fbName || "").slice(0, 120), by, now, now, by));
    stmts.push(leadAct(db, id, by, "create", "นำเข้าจากไฟล์ลีด", null, "new"));
  }
  if (!stmts.length) return;
  /* ยิงทีละ 100 statement กันก้อนใหญ่เกินที่ D1 รับไหว (เหมือนตอน seed โพสต์) */
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  await db.prepare("INSERT OR REPLACE INTO task_settings (key,value) VALUES ('leads_seeded', ?)")
    .bind(String(data.leads.length)).run();
}

/* ---------- นำเข้าตารางโพสต์ตั้งต้น ครั้งเดียวตลอดกาล ----------
   ไฟล์ posts-seed.json ถูก deploy ไปพร้อมเว็บอยู่แล้ว จึงอ่านผ่าน env.ASSETS ได้เลย
   ทำฝั่งเซิร์ฟเวอร์เพราะ API ต้องใช้สิทธิ์เจ้าของ และเจ้าของตั้งรหัสผ่านของตัวเองไปแล้ว
   กันซ้ำด้วยธงใน task_settings — ลบโพสต์ทิ้งทีหลังก็จะไม่กลับมาเอง */
async function seedPostsOnce(db, env) {
  const flag = await db.prepare("SELECT value FROM task_settings WHERE key = 'posts_seeded'").first();
  if (flag && flag.value) return;
  if (!env || !env.ASSETS) return;

  let data = null;
  try {
    const res = await env.ASSETS.fetch(new Request("https://kan.local/admin/tasks/posts-seed.json"));
    if (!res.ok) return;
    data = await res.json();
  } catch (e) { return; }
  if (!data || !Array.isArray(data.posts)) return;

  const now = nowIso();
  const pageStmts = (data.pages || []).map((p) =>
    db.prepare("INSERT OR IGNORE INTO post_pages (id,name,sort,active) VALUES (?,?,?,?)")
      .bind(String(p.id), String(p.name), Number(p.sort) || 0, p.active === 0 || p.active === false ? 0 : 1));
  if (pageStmts.length) await db.batch(pageStmts);

  /* ยิงทีละ 150 แถว — ก้อนเดียวจะเกินขนาดที่ D1 รับไหว */
  for (let i = 0; i < data.posts.length; i += 150) {
    const chunk = data.posts.slice(i, i + 150).map((p) =>
      db.prepare(
        "INSERT OR IGNORE INTO posts (id,page_id,post_date,post_time,channels,topic,kind,status,url,note,posted_at,created_at,updated_at,updated_by) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(
        String(p.id), String(p.pageId || ""), String(p.date), String(p.time || ""),
        JSON.stringify(Array.isArray(p.channels) ? p.channels : []),
        String(p.topic || ""), String(p.kind || "content"),
        ["plan", "done", "skip"].indexOf(p.status) !== -1 ? p.status : "plan",
        String(p.url || ""), String(p.note || ""),
        p.status === "done" ? now : null, now, now, null
      ));
    await db.batch(chunk);
  }
  await db.prepare("INSERT OR REPLACE INTO task_settings (key,value) VALUES ('posts_seeded', ?)")
    .bind(new Date().toISOString() + " · " + data.posts.length + " แถว").run();
}

/* ---------- schema bootstrap (ครั้งเดียวต่อ isolate) ---------- */
let schemaReady = null;
export function ensureTaskSchema(db, env) { return ensureSchema(db, env); }
async function ensureSchema(db, env) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.batch(SCHEMA.map((s) => db.prepare(s)));
      for (const sql of ALTERS) {
        try { await db.prepare(sql).run(); } catch (e) { /* มีคอลัมน์อยู่แล้ว */ }
      }
      const k = await db.prepare("SELECT COUNT(*) AS n FROM kpis").first();
      if (!k || !k.n) {
        await db.batch(KPI_SEED.map((r) => db.prepare(
          "INSERT OR IGNORE INTO kpis (id,sort,code,title,weight,target,keywords,color) VALUES (?,?,?,?,?,?,?,?)"
        ).bind(r.id, r.sort, r.code, r.title, r.weight, r.target, r.keywords, r.color)));
      }
      await seedPostsOnce(db, env).catch(() => {});
      await seedLeadsOnce(db, env).catch(() => {});
      await mergePizzaOnce(db).catch(() => {});
      /* สาขานคร (KST#2) เลิกดูแลแล้ว 9 ก.ย. 2569 — ปิดเพจทุกครั้งที่ isolate ตื่น จะได้ไม่ต้องพึ่ง owner กดเอง */
      await db.prepare("UPDATE post_pages SET active = 0 WHERE id = 'pg_kst2' AND active = 1").run().catch(() => {});
      const s = await db.prepare("SELECT COUNT(*) AS n FROM staff").first();
      if (!s || !s.n) {
        const stmts = [];
        for (const r of STAFF_SEED) {
          const salt = randHex(8);
          const hash = await sha256Hex(salt + ":" + randHex(16)); /* pin ไม่ได้ใช้แล้ว แค่กันคอลัมน์ NOT NULL */
          stmts.push(db.prepare(
            "INSERT OR IGNORE INTO staff (id,name,aliases,role,pin_salt,pin_hash,active,created_at) VALUES (?,?,?,?,?,?,1,?)"
          ).bind(r.id, r.name, r.aliases, r.role, salt, hash, nowIso()));
        }
        await db.batch(stmts);
      }
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

let cachedSecret = null;
/* จุลาลักษณ์ = พิซซ่า คนเดียวกัน แต่ในระบบเคยแยกเป็น 2 บัญชี (นนท์บอก 9 ก.ย. 2569)
   ย้ายงาน/คอมเมนต์/แท็กของบัญชี "Pizza" มารวมที่ s_julalak แล้วลบบัญชีซ้ำทิ้ง
   ทำครั้งเดียว จำด้วยธงใน task_settings */
async function mergePizzaOnce(db) {
  const flag = await db.prepare("SELECT value FROM task_settings WHERE key = 'merge_pizza_v1'").first();
  if (flag && flag.value) return;
  const keep = await db.prepare("SELECT id FROM staff WHERE id = 's_julalak'").first();
  if (keep) {
    const dups = await db.prepare(
      "SELECT id FROM staff WHERE id != 's_julalak' AND (LOWER(name) LIKE '%pizza%' OR name LIKE '%พิซซ่า%')"
    ).all();
    for (const d of (dups.results || [])) {
      await db.batch([
        db.prepare("UPDATE OR IGNORE task_assignees SET staff_id = 's_julalak' WHERE staff_id = ?").bind(d.id),
        db.prepare("DELETE FROM task_assignees WHERE staff_id = ?").bind(d.id),
        db.prepare("UPDATE task_updates SET staff_id = 's_julalak' WHERE staff_id = ?").bind(d.id),
        db.prepare("UPDATE task_mentions SET staff_id = 's_julalak' WHERE staff_id = ?").bind(d.id),
        db.prepare("UPDATE task_mentions SET by_staff = 's_julalak' WHERE by_staff = ?").bind(d.id),
        db.prepare("UPDATE tasks SET created_by = 's_julalak' WHERE created_by = ?").bind(d.id),
        db.prepare("UPDATE posts SET updated_by = 's_julalak' WHERE updated_by = ?").bind(d.id),
        db.prepare("DELETE FROM staff WHERE id = ?").bind(d.id),
      ]);
    }
    await db.prepare(
      "UPDATE staff SET name = 'Pizza (Julalak Krongkheaw)', " +
      "aliases = 'Pizza,พิซซ่า,Julalak,Krongkheaw,จุลาลักษณ์,จุฬาลักษณ์' WHERE id = 's_julalak'"
    ).run();
  }
  await db.prepare("INSERT OR REPLACE INTO task_settings (key,value) VALUES ('merge_pizza_v1', ?)")
    .bind(nowIso()).run();
}

async function sessionSecret(db) {
  if (cachedSecret) return cachedSecret;
  const row = await db.prepare("SELECT value FROM task_settings WHERE key = 'session_secret'").first();
  if (row && row.value) { cachedSecret = row.value; return cachedSecret; }
  const secret = randHex(32);
  await db.prepare("INSERT OR IGNORE INTO task_settings (key,value) VALUES ('session_secret', ?)").bind(secret).run();
  const again = await db.prepare("SELECT value FROM task_settings WHERE key = 'session_secret'").first();
  cachedSecret = again && again.value ? again.value : secret;
  return cachedSecret;
}

/* ---------- auth ---------- */
async function makeSession(db, staffId) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const body = staffId + "." + exp;
  const sig = await hmacHex(await sessionSecret(db), body);
  return body + "." + sig;
}
function cookieHeader(value, maxAge) {
  return COOKIE + "=" + value + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge;
}
async function currentStaff(request, db) {
  /* MCP / สคริปต์ภายนอก: Authorization: Bearer <token ประจำคน> — token สร้างจากหน้าทีม */
  const auth = request.headers.get("authorization") || "";
  const bm = auth.match(/^Bearer\s+([A-Za-z0-9]{32,80})$/i);
  if (bm) {
    const r = await db.prepare("SELECT id,name,aliases,role,active,sections,can_update_others,can_reschedule,work_days,hours_per_day,require_pw FROM staff WHERE api_token = ? AND active = 1")
      .bind(bm[1]).first();
    return r || null;
  }
  const tok = getCookie(request, COOKIE);
  if (!tok) return null;
  const parts = tok.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  if (!(Number(exp) > Date.now())) return null;
  const expect = await hmacHex(await sessionSecret(db), id + "." + exp);
  if (expect !== sig) return null;
  const row = await db.prepare("SELECT id,name,aliases,role,active,sections,email,username,pw_hash,can_update_others,can_reschedule,work_days,hours_per_day,require_pw FROM staff WHERE id = ?").bind(id).first();
  if (!row || !row.active) return null;
  return row;
}
function publicStaff(r) {
  return {
    id: r.id, name: r.name, aliases: r.aliases || "", role: r.role, active: !!r.active,
    email: r.email || null, username: r.username || null, hasPassword: !!r.pw_hash, sections: sectionsOf(r),
    needsPassword: r.role === "owner" || !!r.require_pw,
    canUpdateOthers: r.role === "owner" || !!r.can_update_others,
    canReschedule: r.role === "owner" || !!r.can_reschedule,
    workDays: r.work_days == null ? null : String(r.work_days),
    hoursPerDay: r.hours_per_day == null ? null : Number(r.hours_per_day),
  };
}

/* ---------- บันทึกประวัติโพสต์ ---------- */
const LOG_FIELDS = ["date", "time", "pageId", "kind", "channels", "topic", "status", "url", "note"];
function postSnapshot(row) {
  return {
    date: row.post_date || "", time: row.post_time || "", pageId: row.page_id || "",
    kind: row.kind || "content", channels: row.channels || "[]", topic: row.topic || "",
    status: row.status || "plan", url: row.url || "", note: row.note || "",
  };
}
function diffPost(before, after) {
  const out = [];
  LOG_FIELDS.forEach((f) => {
    const a = before ? String(before[f] == null ? "" : before[f]) : "";
    const b = String(after[f] == null ? "" : after[f]);
    if (a !== b) out.push([f, a, b]);
  });
  return out;
}
function logStmt(db, me, action, info, changes) {
  return db.prepare(
    "INSERT INTO post_log (id,post_id,staff_id,action,page_id,post_date,post_time,topic,changes,created_at) " +
    "VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).bind(newId("pl_"), info.id || null, me.id, action, info.pageId || "", info.date || "",
         info.time || "", String(info.topic || "").slice(0, 200),
         changes && changes.length ? JSON.stringify(changes).slice(0, 2000) : null, nowIso());
}

/* ---------- rows → JSON ---------- */
/* ============================================================
   ประวัติการแก้ไข (audit log) — เก็บสภาพก่อน/หลังของทุกการเปลี่ยนแปลง
   เพื่อให้ย้อนเวอร์ชันได้ทีหลัง · เขียนแยกจาก batch หลัก งานหลักล้มเหลวจะไม่มีประวัติค้าง
   ============================================================ */
const AUDIT_ENTITY_TH = { task: "งาน", post: "โพสต์", campaign: "ปฏิทินการตลาด", staff: "ทีม + สิทธิ์", flow: "ขั้นงาน", lead: "ลีด" };
const AUDIT_ACTION_TH = { create: "สร้าง", update: "แก้ไข", delete: "ลบ", revert: "ย้อนเวอร์ชัน" };
/* สภาพของงาน 1 ชิ้น (รวมคนรับ) ไว้ทั้งเทียบและคืนค่า */
async function snapTask(db, id) {
  const r = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  if (!r) return null;
  const a = await db.prepare("SELECT staff_id FROM task_assignees WHERE task_id = ?").bind(id).all();
  const o = {};
  for (const k of Object.keys(r)) o[k] = r[k];
  o.__assignees = (a.results || []).map((x) => x.staff_id);
  return o;
}
async function snapPost(db, id) {
  const r = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
  if (!r) return null;
  const o = {}; for (const k of Object.keys(r)) o[k] = r[k];
  return o;
}
const AUDIT_SKIP = { updated_at: 1, created_at: 1, updated_by: 1, created_by: 1, done_at: 1, submitted_at: 1, approved_at: 1, approved_by: 1, posted_at: 1 };
const FIELD_TH = {
  title: "ชื่องาน", detail: "รายละเอียด", status: "สถานะ", due_at: "กำหนดส่ง", repeat: "ความถี่",
  kpi_id: "KPI", task_type: "ประเภทงาน", task_kind: "ชนิดงาน", hours: "ชั่วโมง", support: "งานซัพพอร์ต",
  priority: "ความสำคัญ", campaign_id: "ปฏิทินการตลาด", parent_id: "งานหลัก", stage: "ขั้นงาน",
  sign_w: "กว้าง", sign_h: "สูง", sign_qty: "จำนวนใบ", sign_branch: "สาขา", __assignees: "คนรับผิดชอบ",
  post_date: "วันที่", post_time: "เวลา", page_id: "เพจ", channels: "ช่องทาง", topic: "หัวข้อ", kind: "ประเภท", url: "ลิงก์", note: "หมายเหตุ",
  /* CRM */
  name: "ชื่อ", phone: "เบอร์", line_id: "LINE", source: "ช่องทางที่ทักมา", source_detail: "ที่มาเพิ่มเติม",
  received_at: "วันที่ได้ลีดมา", fb_name: "ชื่อโปรไฟล์ Facebook",
  interest: "สนใจอะไร", branch: "สาขา", owner_id: "เซลส์ที่ดูแล", est_value: "ยอดที่คาด",
  bought_before: "เคยซื้อแล้ว", lost_reason: "เหตุผลที่ไม่สำเร็จ", next_at: "ตามครั้งถัดไป",
  handed_at: "ส่งต่อบัญชี", handed_by: "คนส่งต่อบัญชี",
};
function diffSnap(before, after) {
  const out = [];
  const keys = new Set(Object.keys(before || {}).concat(Object.keys(after || {})));
  for (const k of keys) {
    if (AUDIT_SKIP[k] || k === "id") continue;
    const a = before ? before[k] : undefined, b = after ? after[k] : undefined;
    const sa = Array.isArray(a) ? a.slice().sort().join(",") : (a == null ? "" : String(a));
    const sb = Array.isArray(b) ? b.slice().sort().join(",") : (b == null ? "" : String(b));
    if (sa !== sb) out.push({ k, th: FIELD_TH[k] || k, from: sa, to: sb });
  }
  return out;
}
async function logChange(db, o) {
  try {
    const fields = o.action === "update" ? diffSnap(o.before, o.after) : [];
    if (o.action === "update" && !fields.length) return null;
    const summary = o.summary || (o.action === "update"
      ? fields.map((f) => f.th).join(", ")
      : (AUDIT_ACTION_TH[o.action] || o.action));
    const id = newId("h_");
    await db.prepare(
      "INSERT INTO audit_log (id,at,staff_id,entity,entity_id,action,title,summary,before_json,after_json) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(id, o.at || nowIso(), o.by, o.entity, String(o.entityId), o.action, String(o.title || "").slice(0, 300),
           String(summary).slice(0, 500), o.before ? JSON.stringify(o.before) : null, o.after ? JSON.stringify(o.after) : null).run();
    return id;
  } catch (e) { return null; }   /* ประวัติพังต้องไม่ทำให้งานหลักพัง */
}

/* ขั้นของลีด — คำเดียวกับ M CRM (นนท์ยืนยัน 21 ก.ย. 69) ห้ามเปลี่ยนคำโดยไม่บอกอีกฝั่ง */
const LEAD_STATUSES = ["new", "contacted", "qualified", "proposal", "won", "lost", "nurture"];
const LEAD_STATUS_TH = {
  new: "ใหม่", contacted: "ติดต่อแล้ว", qualified: "มีแนวโน้ม", proposal: "เสนอราคา",
  won: "ปิดการขาย", lost: "ไม่สำเร็จ", nurture: "ติดตามต่อ",
};
const LEAD_SOURCES = ["fb", "ig", "line", "tiktok", "phone", "walkin", "referral", "other"];
const LEAD_DONE = { won: 1, lost: 1 };   /* ขั้นที่ถือว่าจบเคสแล้ว ไม่ต้องตามต่อ */

function rowToLead(r) {
  return {
    id: r.id, name: r.name, phone: r.phone || "", lineId: r.line_id || "",
    source: r.source || "other", sourceDetail: r.source_detail || "",
    fbName: r.fb_name || "",
    /* ลีดเก่าที่ยังไม่มี received_at ให้ถือว่าได้มาวันที่บันทึก จะได้ไม่หลุดจากรายงาน SLA */
    receivedAt: r.received_at || r.created_at,
    interest: r.interest || "", branch: r.branch || "",
    status: LEAD_STATUSES.indexOf(r.status) !== -1 ? r.status : "new",
    ownerId: r.owner_id || null,
    estValue: Number(r.est_value) || 0,
    boughtBefore: r.bought_before ? 1 : 0,
    lostReason: r.lost_reason || "", nextAt: r.next_at || null,
    handedAt: r.handed_at || null, handedBy: r.handed_by || null,
    createdBy: r.created_by, createdAt: r.created_at,
    updatedAt: r.updated_at, updatedBy: r.updated_by || null,
    nAct: r.n_act == null ? 0 : Number(r.n_act),
    lastAct: r.last_act || null,
  };
}
async function snapLead(db, id) {
  const r = await db.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first();
  if (!r) return null;
  const o = {}; for (const k of Object.keys(r)) o[k] = r[k];
  return o;
}
/* เขียนบรรทัดประวัติของลีด — เป็น statement ให้เอาไปใส่ batch รวมกับ UPDATE ได้ */
function leadAct(db, leadId, meId, kind, body, from, to) {
  return db.prepare(
    "INSERT INTO lead_activities (id,lead_id,staff_id,kind,body,from_status,to_status,created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(newId("la_"), leadId, meId, kind, String(body || "").slice(0, 2000), from || null, to || null, nowIso());
}

function rowToPost(r) {
  let channels = [];
  try { channels = JSON.parse(r.channels || "[]"); } catch (e) { channels = []; }
  return {
    id: r.id, pageId: r.page_id, date: r.post_date, time: r.post_time,
    channels, topic: r.topic, kind: r.kind,
    status: r.status, url: r.url, note: r.note, postedAt: r.posted_at,
    updatedAt: r.updated_at, updatedBy: r.updated_by, campaignId: r.campaign_id || null,
  };
}
function rowToTask(r) {
  return {
    id: r.id,
    title: r.title,
    detail: r.detail || "",
    kpiId: r.kpi_id || null,
    status: r.status,
    dueAt: r.due_at || null,
    repeat: r.repeat || "",
    repeatDays: r.repeat_days || null,
    taskType: r.task_type || "other",
    taskKind: r.task_kind || (r.repeat ? "routine" : "ondemand"),
    hours: r.hours == null ? null : Number(r.hours),
    support: r.support ? 1 : 0,
    dueOriginal: r.due_original || r.due_at || null,
    submittedAt: r.submitted_at || null,
    approvedAt: r.approved_at || null,
    approvedBy: r.approved_by || null,
    postpones: r.postpones || 0,
    signW: r.sign_w == null ? null : Number(r.sign_w),
    signH: r.sign_h == null ? null : Number(r.sign_h),
    signQty: r.sign_qty == null ? null : Number(r.sign_qty),
    signBranch: r.sign_branch || null,
    stage: r.stage || null,
    priority: r.priority || 0,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    doneAt: r.done_at || null,
    assignees: r.assignee_ids ? String(r.assignee_ids).split(",").filter(Boolean) : [],
    nFiles: r.n_files || 0,
    nUpdates: r.n_updates || 0,
    lastUpdate: r.last_update || null,
    parentId: r.parent_id || null,
    campaignId: r.campaign_id || null,
    nSub: r.n_sub || 0,
    nSubDone: r.n_sub_done || 0,
  };
}

const TASK_SELECT =
  "SELECT t.*, " +
  "(SELECT GROUP_CONCAT(staff_id) FROM task_assignees a WHERE a.task_id = t.id) AS assignee_ids, " +
  "(SELECT COUNT(*) FROM task_files f WHERE f.task_id = t.id) AS n_files, " +
  "(SELECT COUNT(*) FROM task_updates u WHERE u.task_id = t.id) AS n_updates, " +
  "(SELECT MAX(created_at) FROM task_updates u WHERE u.task_id = t.id) AS last_update, " +
  "(SELECT COUNT(*) FROM tasks c WHERE c.parent_id = t.id) AS n_sub, " +
  "(SELECT COUNT(*) FROM tasks c WHERE c.parent_id = t.id AND c.status = 'done') AS n_sub_done " +
  "FROM tasks t ";

const TASK_ORDER =
  " ORDER BY CASE WHEN t.status = 'done' THEN 1 ELSE 0 END, " +
  "CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END, t.due_at ASC, t.created_at DESC";

/* ตรวจข้อมูลงาน 1 ชิ้น (ใช้ทั้งสร้างและแก้) */
function cleanTask(input, kpiIds, staffIds, campaignIds) {
  const title = String(input.title || "").trim().slice(0, 300);
  if (!title) return { error: "ต้องมีชื่องาน" };
  const detail = String(input.detail || "").trim().slice(0, 4000);
  const kpiId = input.kpiId && kpiIds.has(input.kpiId) ? input.kpiId : null;
  const status = STATUSES.indexOf(input.status) !== -1 ? input.status : "todo";
  let dueAt = null;
  if (input.dueAt) {
    if (!isIsoDateTime(input.dueAt)) return { error: "กำหนดส่งไม่ถูกต้อง: " + title };
    dueAt = new Date(input.dueAt).toISOString();
  }
  const repeat = REPEATS.indexOf(input.repeat) !== -1 ? input.repeat : "";
  /* วันที่ทำของงานประจำ — เก็บเป็น "0,1,2" เรียงและไม่ซ้ำ · ไม่ส่งมา = null (ใช้ตามความถี่) */
  let repeatDays = null;
  if (input.repeatDays !== undefined && input.repeatDays !== null) {
    const ds = String(input.repeatDays).split(",").map((x) => Number(String(x).trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    repeatDays = ds.length ? Array.from(new Set(ds)).sort((a, b) => a - b).join(",") : null;
  }
  const taskType = TASK_TYPES.indexOf(input.taskType) !== -1 ? input.taskType : "other";
  /* ไม่ได้เลือกชนิดงาน: มีความถี่ = รูทีน ไม่มี = ตามสั่ง */
  const taskKind = TASK_KINDS.indexOf(input.taskKind) !== -1 ? input.taskKind : (repeat ? "routine" : "ondemand");
  const support = input.support ? 1 : 0;
  const num = (x, max) => { if (x == null || x === "") return null; const n = Number(x); return isFinite(n) && n >= 0 && n <= max ? n : null; };
  const signW = num(input.signW, 100), signH = num(input.signH, 100);
  const signQty = input.signQty == null || input.signQty === "" ? null : Math.max(1, Math.min(9999, Math.round(Number(input.signQty) || 1)));
  const signBranch = input.signBranch ? String(input.signBranch).trim().slice(0, 80) : null;
  let hours = null;
  if (input.hours != null && input.hours !== "") {
    const h = Number(input.hours);
    if (!isFinite(h) || h < 0 || h > 200) return { error: "ชั่วโมงที่ใช้ต้องเป็นตัวเลข 0–200: " + title };
    hours = Math.round(h * 4) / 4;   /* ปัดเป็นทีละ 15 นาที */
  }
  const priority = input.priority ? 1 : 0;
  const assignees = Array.isArray(input.assignees)
    ? Array.from(new Set(input.assignees.filter((id) => staffIds.has(id)))).slice(0, 20)
    : [];
  const parentId = input.parentId ? String(input.parentId).slice(0, 40) : null;
  const campaignId = input.campaignId && campaignIds && campaignIds.has(input.campaignId) ? input.campaignId : null;
  return { value: { title, detail, kpiId, status, dueAt, repeat, repeatDays, priority, assignees, parentId, campaignId, taskType, taskKind, support, hours, signW, signH, signQty, signBranch } };
}

async function loadIdSets(db) {
  const k = await db.prepare("SELECT id FROM kpis").all();
  const s = await db.prepare("SELECT id FROM staff WHERE active = 1").all();
  let c = { results: [] };
  try { c = await db.prepare("SELECT id FROM campaigns").all(); } catch (e) { /* ตารางปฏิทินยังไม่มี */ }
  return {
    kpiIds: new Set((k.results || []).map((r) => r.id)),
    staffIds: new Set((s.results || []).map((r) => r.id)),
    campaignIds: new Set((c.results || []).map((r) => r.id)),
  };
}

/* หา @ชื่อ ในคอมเมนต์ — เทียบกับชื่อจริงและ aliases เหมือนฝั่งหน้าเว็บ
   คืนรายการ staff_id ที่ถูกแท็ก (ไม่ซ้ำ, ไม่รวมตัวเอง) */
function findMentions(text, staffRows, meId) {
  const norm = (x) => String(x || "").toLowerCase().replace(/[.,:;()[\]"'“”]/g, "").trim();
  const tokensOf = (r) => {
    const set = new Set();
    String(r.name).split(/\s+/).forEach((x) => { const n = norm(x); if (n) set.add(n); });
    String(r.aliases || "").split(",").forEach((x) => { const n = norm(x); if (n) set.add(n); });
    return set;
  };
  const table = staffRows.map((r) => ({ id: r.id, set: tokensOf(r) }));
  const out = [];
  const words = String(text || "").split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i].charAt(0) !== "@") continue;
    let key = norm(words[i].slice(1));
    if (!key && words[i + 1]) { key = norm(words[i + 1]); i++; }
    if (!key) continue;
    let hit = table.find((r) => r.set.has(key));
    if (!hit) hit = table.find((r) => Array.from(r.set).some((k) => k.length >= 3 && (k.startsWith(key) || key.startsWith(k))));
    if (hit && hit.id !== meId && out.indexOf(hit.id) === -1) out.push(hit.id);
  }
  return out;
}

function parseDataUrl(dataUrl, fileName) {
  const m = String(dataUrl || "").match(/^data:([\w/+.-]*);base64,(.+)$/);
  if (!m) return { error: "ไฟล์ไม่ถูกต้อง" };
  const mime = m[1] || "application/octet-stream";
  const b64 = m[2];
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > MAX_FILE_BYTES) {
    return { error: "ไฟล์ “" + String(fileName || "").slice(0, 40) + "” ใหญ่เกิน " +
      (MAX_FILE_BYTES / 1048576).toFixed(1) + " MB — ถ้าเป็นวิดีโอหรือไฟล์ใหญ่ ให้อัปขึ้น Drive แล้ววางลิงก์แทน" };
  }
  return { mime, b64, bytes };
}

/* ลิงก์: รับเฉพาะ http/https กัน javascript: กับ data: ที่เอาไปทำ XSS ต่อได้ */
function cleanLink(input) {
  const url = String((input && input.url) || "").trim();
  if (!/^https?:\/\//i.test(url) || url.length > 2000) return { error: "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://" };
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return { error: "ลิงก์ไม่ถูกต้อง" }; }
  const title = String((input && input.title) || "").trim().slice(0, 200) || host;
  return { url, title, host };
}

/* ---------- main router ---------- */
export async function handleTaskApi(request, env, url, path, method, ctx) {
  const db = env.KAN_ERP;
  if (!db) return json({ error: "ยังไม่ได้ผูกฐานข้อมูล" }, 503);
  await ensureSchema(db, env);

  /* --- public: รายชื่อสำหรับหน้าล็อกอิน — needsPassword = หัวหน้าเท่านั้น --- */
  if (path === "/login" && method === "GET") {
    const res = await db.prepare("SELECT id,name,aliases,role,pw_hash,require_pw FROM staff WHERE active = 1 ORDER BY role = 'owner' DESC, name").all();
    return json({
      staff: (res.results || []).map((r) => ({
        id: r.id, name: r.name, aliases: r.aliases || "", role: r.role,
        needsPassword: r.role === "owner" || !!r.require_pw, hasPassword: !!r.pw_hash,
      })),
    });
  }

  /* ล็อกอิน: เลือกชื่อแล้วเข้าเลย — ยกเว้นหัวหน้าต้องใส่รหัสผ่าน
     (ตัดอีเมล/ชื่อผู้ใช้/รหัสตั้งค่าออกทั้งหมด 17 ก.ย. 69 — ทีมจำไม่ได้ เข้าไม่เป็น) */
  if (path === "/login" && method === "POST") {
    const body = await readBody(request);
    const staffId = String(body.staffId || "");
    const row = await db.prepare("SELECT * FROM staff WHERE id = ? AND active = 1").bind(staffId).first();
    if (!row) return json({ error: "ไม่พบชื่อนี้ในทีม" }, 401);

    if (row.role === "owner" || row.require_pw) {
      /* หัวหน้ากดชื่อแล้วได้สิทธิ์ทุกอย่าง — เว็บนี้ใครก็เปิด URL ได้ จึงต้องมีรหัสผ่านกัน
         บัญชีที่ตั้ง require_pw ไว้ (เช่น ฝ่ายขายที่ดูแต่ลีด) ก็ต้องใส่รหัสเหมือนกัน */
      if (!row.pw_hash) return json({ error: "บัญชีนี้ยังไม่มีรหัสผ่าน ให้หัวหน้าตั้งให้ในหน้า ทีม + สิทธิ์" }, 409);
      if (body.password == null) return json({ error: "บัญชีนี้ต้องใส่รหัสผ่าน", needPassword: true }, 401);

      /* ล็อกรายคน ไม่ใช่ราย IP เพราะทีมอยู่หลังเน็ตร้านเดียวกัน */
      const gate = await db.prepare("SELECT fails, locked_until FROM task_logins WHERE staff_id = ?").bind(row.id).first();
      if (gate && gate.locked_until && Date.parse(gate.locked_until) > Date.now()) {
        const wait = Math.ceil((Date.parse(gate.locked_until) - Date.now()) / 60000);
        return json({ error: "ใส่รหัสผิดหลายครั้ง ลองใหม่ในอีก " + wait + " นาที" }, 429);
      }
      const hash = await pbkdf2Hex(String(body.password || ""), row.pw_salt);
      if (hash !== row.pw_hash) {
        const fails = ((gate && gate.fails) || 0) + 1;
        const lockedUntil = fails >= MAX_PIN_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null;
        await db.prepare(
          "INSERT INTO task_logins (staff_id, fails, locked_until) VALUES (?,?,?) " +
          "ON CONFLICT(staff_id) DO UPDATE SET fails = excluded.fails, locked_until = excluded.locked_until"
        ).bind(row.id, lockedUntil ? 0 : fails, lockedUntil).run();
        return json({
          error: lockedUntil
            ? "ใส่รหัสผิด " + MAX_PIN_FAILS + " ครั้ง ล็อก " + LOCK_MINUTES + " นาที"
            : "รหัสผ่านไม่ถูกต้อง (เหลืออีก " + (MAX_PIN_FAILS - fails) + " ครั้ง)",
          needPassword: true,
        }, lockedUntil ? 429 : 401);
      }
      if (gate) await db.prepare("DELETE FROM task_logins WHERE staff_id = ?").bind(row.id).run();
    }

    const tok = await makeSession(db, row.id);
    return json({ ok: true, me: publicStaff(row) }, 200, { "set-cookie": cookieHeader(tok, SESSION_DAYS * 86400) });
  }

  if (path === "/logout" && method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": cookieHeader("", 0) });
  }

  /* --- ต้องล็อกอินตั้งแต่ตรงนี้ --- */
  const me = await currentStaff(request, db);
  if (!me) return json({ error: "กรุณาเข้าสู่ระบบ", auth: false }, 401);
  const isOwner = me.role === "owner";
  /* พิซซ่าขอสิทธิ์ติ๊กงานแทนเติ้ล — หัวหน้าเปิดให้รายคนในหน้า "ทีม + สิทธิ์" */
  const canUpdateOthers = isOwner || !!me.can_update_others;
  /* เลื่อนกำหนดส่งได้เอง — ปกติสงวนไว้ให้หัวหน้ากับคนสั่งงาน เปิดรายคนได้ */
  const canReschedule = isOwner || !!me.can_reschedule;
  /* คนที่ได้เฉพาะหมวด CRM (ฝ่ายขาย) — แตะได้แค่ลีดกับของที่หน้าเว็บต้องใช้ตอนเปิดระบบ
     กันที่เซิร์ฟเวอร์ด้วย ไม่ใช่แค่ซ่อนเมนู */
  if (!canSee(me, "tasks")) {
    const allowed = /^\/(leads|me$|me\/|logout|notifications|staff$|files\/)/.test(path);
    if (!allowed) return json({ error: "บัญชีนี้เห็นได้เฉพาะหน้าลีด (CRM)" }, 403);
  }

  if (path === "/me" && method === "GET") {
    const staff = await db.prepare("SELECT id,name,aliases,role,active,email,username,pw_hash,sections,api_token,can_update_others,can_reschedule,work_days,hours_per_day,require_pw FROM staff ORDER BY role = 'owner' DESC, name").all();
    const kpis = await db.prepare("SELECT * FROM kpis ORDER BY sort").all();
    /* ชิป KPI บนงานต้องเห็นทุกคน (มันคือหมวดงาน) แต่ "เป้า/น้ำหนัก" เป็นตัวเลขลับ
       คนที่ไม่มีสิทธิ์หมวด KPI จะได้แค่รหัสกับชื่อไปแสดงชิป */
    const seeKpi = canSee(me, "kpi");
    const kpiRows = (kpis.results || []).map((k) => (seeKpi ? k : {
      id: k.id, sort: k.sort, code: k.code, title: k.title, color: k.color, keywords: k.keywords,
    }));
    return json({
      me: publicStaff(me),
      staff: (staff.results || []).map((r) => {
        const o = publicStaff(r);
        o.hasToken = !!r.api_token;
        if (isOwner || r.id === me.id) o.mcpToken = r.api_token || null;
        return o;
      }),
      kpis: kpiRows,
      sections: sectionsOf(me),
    });
  }

  /* กระดิ่ง — คอมเมนต์ที่แท็กเรา */
  if (path === "/notifications" && method === "GET") {
    const res = await db.prepare(
      "SELECT m.id, m.task_id, m.note, m.created_at, m.read_at, m.by_staff, t.title " +
      "FROM task_mentions m LEFT JOIN tasks t ON t.id = m.task_id " +
      "WHERE m.staff_id = ? ORDER BY m.created_at DESC LIMIT 200"
    ).bind(me.id).all();
    const rows = res.results || [];
    return json({
      unread: rows.filter((r) => !r.read_at).length,
      items: rows.map((r) => ({
        id: r.id, taskId: r.task_id, taskTitle: r.title || "(งานถูกลบแล้ว)", note: r.note,
        byStaff: r.by_staff, createdAt: r.created_at, read: !!r.read_at,
      })),
    });
  }

  /* กดกลับเป็น "ยังไม่ได้ดู" — เผลอกดผ่านแล้วต้องเอากลับมาตามได้ */
  if (path === "/notifications/unread" && method === "POST") {
    const body = await readBody(request);
    if (!body.id) return json({ error: "ต้องระบุรายการ" }, 400);
    await db.prepare("UPDATE task_mentions SET read_at = NULL WHERE id = ? AND staff_id = ?")
      .bind(String(body.id), me.id).run();
    return json({ ok: true });
  }

  if (path === "/notifications/read" && method === "POST") {
    const body = await readBody(request);
    const now = nowIso();
    if (body.id) {
      await db.prepare("UPDATE task_mentions SET read_at = ? WHERE id = ? AND staff_id = ? AND read_at IS NULL")
        .bind(now, String(body.id), me.id).run();
    } else {
      await db.prepare("UPDATE task_mentions SET read_at = ? WHERE staff_id = ? AND read_at IS NULL").bind(now, me.id).run();
    }
    return json({ ok: true });
  }

  /* ---------- ตารางโพสต์ ---------- */
  const POST_STATUS = ["plan", "done", "skip"];

  if (path === "/pages" && method === "GET") {
    const res = await db.prepare("SELECT * FROM post_pages WHERE active = 1 ORDER BY sort, name").all();
    return json({ pages: res.results || [] });
  }
  if (path === "/pages" && method === "POST") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
    const body = await readBody(request);
    const list = Array.isArray(body.pages) ? body.pages : [body];
    const stmts = [];
    for (const p of list) {
      const name = String((p && p.name) || "").trim().slice(0, 120);
      if (!name) continue;
      stmts.push(db.prepare("INSERT OR IGNORE INTO post_pages (id,name,sort,active) VALUES (?,?,?,1)")
        .bind(String(p.id || newId("pg_")).slice(0, 40), name, Number(p.sort) || 0));
    }
    if (!stmts.length) return json({ error: "ไม่มีเพจให้เพิ่ม" }, 400);
    await db.batch(stmts);
    return json({ ok: true, n: stmts.length });
  }

  const pageMatch = path.match(/^\/pages\/([A-Za-z0-9_-]{1,40})$/);
  if (pageMatch && method === "PUT") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
    const body = await readBody(request);
    const sets = [], vals = [];
    if (body.name != null) { sets.push("name = ?"); vals.push(String(body.name).trim().slice(0, 120)); }
    if (body.sort != null) { sets.push("sort = ?"); vals.push(Number(body.sort) || 0); }
    if (body.active != null) { sets.push("active = ?"); vals.push(body.active ? 1 : 0); }
    if (!sets.length) return json({ error: "ไม่มีอะไรให้แก้" }, 400);
    vals.push(pageMatch[1]);
    const res = await db.prepare("UPDATE post_pages SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
    if (!res.meta.changes) return json({ error: "ไม่พบเพจนี้" }, 404);
    return json({ ok: true });
  }

  if (path === "/posts" && method === "GET") {
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const page = url.searchParams.get("page") || "";
    const camp = url.searchParams.get("campaign") || "";
    const where = [], binds = [];
    if (camp) { where.push("campaign_id = ?"); binds.push(camp); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { where.push("post_date >= ?"); binds.push(from); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { where.push("post_date <= ?"); binds.push(to); }
    if (page) { where.push("page_id = ?"); binds.push(page); }
    const sql = "SELECT * FROM posts " + (where.length ? "WHERE " + where.join(" AND ") : "") +
      " ORDER BY post_date ASC, post_time ASC LIMIT 1000";
    const res = await db.prepare(sql).bind(...binds).all();
    return json({
      posts: (res.results || []).map(rowToPost),
    });
  }

  if (path === "/posts" && method === "POST") {
    const body = await readBody(request);
    const list = Array.isArray(body.posts) ? body.posts : [body];
    if (!list.length) return json({ error: "ไม่มีโพสต์ให้บันทึก" }, 400);
    if (list.length > 500) return json({ error: "ครั้งละไม่เกิน 500 แถว" }, 413);
    const now = nowIso();
    const stmts = [];
    const ids = [];
    /* ดูก่อนว่าแถวไหนมีอยู่แล้ว จะได้แยกได้ว่า "เพิ่มใหม่" หรือ "ทับของเดิม" ตอนเขียนประวัติ */
    const given = list.map((p) => (p && p.id ? String(p.id).slice(0, 40) : null)).filter(Boolean);
    const before = {};
    if (given.length) {
      const q = await db.prepare(
        "SELECT * FROM posts WHERE id IN (" + given.map(() => "?").join(",") + ")"
      ).bind(...given).all();
      (q.results || []).forEach((r) => { before[r.id] = r; });
    }
    let blank = 0;
    for (const p of list) {
      /* ไม่มีหัวข้อและไม่มีลิงก์ = แถวเปล่า ข้ามไป ไม่รับเข้าระบบ (นิยามเดียวกับ /posts/blank) */
      if (!String((p && p.topic) || "").trim() && !String((p && p.url) || "").trim()) { blank++; continue; }
      const date = String((p && p.date) || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "วันที่ไม่ถูกต้อง: " + date }, 400);
      const id = String((p && p.id) || newId("po_")).slice(0, 40);
      ids.push(id);
      const old = before[id] || null;
      const after = {
        date, time: String(p.time || "").slice(0, 40), pageId: String(p.pageId || "").slice(0, 40),
        kind: String(p.kind || "content").slice(0, 40),
        channels: JSON.stringify(Array.isArray(p.channels) ? p.channels.slice(0, 10) : []),
        topic: String(p.topic || "").slice(0, 1000),
        status: POST_STATUS.indexOf(p.status) !== -1 ? p.status : "plan",
        url: String(p.url || "").slice(0, 1000), note: String(p.note || "").slice(0, 500),
      };
      stmts.push(db.prepare(
        "INSERT OR REPLACE INTO posts (id,page_id,post_date,post_time,channels,topic,kind,status,url,note,posted_at,created_at,updated_at,updated_by,campaign_id,created_by) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(
        id, after.pageId, date, after.time, after.channels, after.topic, after.kind, after.status,
        after.url, after.note, p.postedAt || null, old ? old.created_at : now, now, me.id,
        p.campaignId ? String(p.campaignId).slice(0, 40) : null,
        old ? (old.created_by || me.id) : me.id
      ));
      const changes = diffPost(old ? postSnapshot(old) : null, after);
      if (!old || changes.length) {
        stmts.push(logStmt(db, me, old ? "update" : "create",
          { id, pageId: after.pageId, date, time: after.time, topic: after.topic }, old ? changes : null));
      }
    }
    if (stmts.length) await db.batch(stmts);
    /* ประวัติ: บันทึกเฉพาะตอนแก้จริง (สร้างใหม่/เปลี่ยนค่า) — วางทับ 500 แถวจากสเปรดชีตจะได้ไม่บวมเกินจำเป็น */
    for (const pid of ids.slice(0, 120)) {
      const now2 = await snapPost(db, pid);
      if (!now2) continue;
      const old2 = before[pid] || null;
      await logChange(db, { by: me.id, entity: "post", entityId: pid, action: old2 ? "update" : "create",
        title: now2.topic || now2.post_date, before: old2, after: now2, at: now });
    }
    return json({ ids, blank });
  }

  /* ---------- สำรองข้อมูล (หัวหน้าเท่านั้น) ----------------------------------
     ดึงทีละตารางทีละหน้า แล้วให้เบราว์เซอร์ประกอบเป็นไฟล์เดียว
     ทำแบบนี้เพราะฐานข้อมูลมีรูปฝังอยู่ ถ้ายัดทั้งก้อนในรีเควสต์เดียวจะหนักเกินขีดของ Worker */
  const BACKUP_TABLES = [
    "staff", "kpis", "tasks", "task_assignees", "task_updates", "task_files", "task_mentions",
    "task_settings", "post_pages", "posts", "post_log", "campaigns", "attachments", "kpi_entries",
  ];
  if (path === "/backup/manifest" && method === "GET") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
    const out = [];
    for (const t of BACKUP_TABLES) {
      try {
        const r = await db.prepare("SELECT COUNT(*) AS n FROM " + t).first();
        out.push({ table: t, rows: (r && r.n) || 0 });
      } catch (e) { out.push({ table: t, rows: 0, missing: true }); }
    }
    return json({ at: nowIso(), db: "kan-erp", tables: out, total: out.reduce((a, b) => a + b.rows, 0) });
  }
  const bkTable = path === "/backup/table" && method === "GET";
  if (bkTable) {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
    const name = url.searchParams.get("table") || "";
    if (BACKUP_TABLES.indexOf(name) === -1) return json({ error: "ไม่รู้จักตาราง " + name }, 400);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 200));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    /* ตารางที่มีรูป base64 ดึงทีละน้อยกว่า ไม่งั้นก้อนใหญ่เกิน */
    const heavy = name === "task_files" || name === "attachments";
    const lim = heavy ? Math.min(limit, 5) : limit;
    const res = await db.prepare("SELECT * FROM " + name + " LIMIT ? OFFSET ?").bind(lim, offset).all();
    const rows = res.results || [];
    return json({ table: name, offset, limit: lim, rows, done: rows.length < lim });
  }

  /* คืนรูป/ไฟล์แนบจากไฟล์สำรอง — ทำได้เฉพาะหัวหน้า และแตะได้แค่ 2 ตารางนี้
     ต้องมีเส้นทางนี้เพราะแถวรูปเป็น base64 ยาวเกินกว่าจะ import กลับด้วยไฟล์ .sql ได้
     ใส่ค่าแบบ bound parameter จึงไม่ติดเพดานความยาวคำสั่ง */
  if (path === "/backup/restore-files" && method === "POST") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
    const body = await readBody(request);
    const table = body.table === "attachments" ? "attachments" : (body.table === "task_files" ? "task_files" : "");
    if (!table) return json({ error: "ระบุ table เป็น task_files หรือ attachments" }, 400);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return json({ error: "ไม่มีแถวให้คืน" }, 400);
    if (rows.length > 10) return json({ error: "ครั้งละไม่เกิน 10 แถว" }, 413);
    const cols = table === "task_files"
      ? ["id", "task_id", "update_id", "file_name", "mime", "bytes", "data", "created_at", "kind", "url", "title"]
      : ["id", "campaign_id", "file_name", "mime", "bytes", "data", "created_at"];
    const stmts = [];
    for (const r of rows) {
      if (!r || !r.id) return json({ error: "ทุกแถวต้องมี id" }, 400);
      stmts.push(db.prepare(
        "INSERT OR REPLACE INTO " + table + " (" + cols.join(",") + ") VALUES (" + cols.map(() => "?").join(",") + ")"
      ).bind(...cols.map((c) => (r[c] === undefined ? null : r[c]))));
    }
    await db.batch(stmts);
    return json({ ok: true, restored: rows.length, table });
  }

  /* ความเคลื่อนไหวของทีมในช่วงวัน (เวลาไทย): ใครอัปเดตงานไหน คอมเมนต์ว่าอะไร เปลี่ยนสถานะเป็นอะไร + แก้ตารางโพสต์อะไร
     ใช้ตอบคำถาม "วันนี้ใครทำอะไรไปบ้าง" ผ่าน MCP และหน้าเว็บ */
  if (path === "/activity" && method === "GET") {
    const from = url.searchParams.get("from") || "", to = url.searchParams.get("to") || from;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return json({ error: "ต้องระบุ from/to เป็น YYYY-MM-DD" }, 400);
    /* เก็บเป็น UTC → ช่วงวันไทย = ลบ 7 ชม. */
    const a = new Date(from + "T00:00:00+07:00").toISOString(), b = new Date(to + "T23:59:59.999+07:00").toISOString();
    const ups = await db.prepare(
      "SELECT u.id, u.task_id, u.staff_id, u.kind, u.note, u.status_to, u.created_at, t.title, t.status AS task_status " +
      "FROM task_updates u LEFT JOIN tasks t ON t.id = u.task_id WHERE u.created_at BETWEEN ? AND ? ORDER BY u.created_at DESC LIMIT 400"
    ).bind(a, b).all();
    const pl = await db.prepare(
      "SELECT * FROM post_log WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC LIMIT 400"
    ).bind(a, b).all();
    return json({
      from, to,
      updates: (ups.results || []).map((u) => ({
        id: u.id, taskId: u.task_id, taskTitle: u.title || "(งานถูกลบแล้ว)", staffId: u.staff_id, kind: u.kind,
        note: u.note || "", statusTo: u.status_to || null, createdAt: u.created_at,
      })),
      posts: (pl.results || []).map((r) => ({
        id: r.id, postId: r.post_id, staffId: r.staff_id, action: r.action, pageId: r.page_id, date: r.post_date,
        time: r.post_time, topic: r.topic || "", changes: r.changes ? JSON.parse(r.changes) : null, createdAt: r.created_at,
      })),
    });
  }

  /* ประวัติการแก้ตารางโพสต์ — ล่าสุดอยู่บนสุด */
  if (path === "/posts/log" && method === "GET") {
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 40));
    const res = await db.prepare(
      "SELECT l.*, (SELECT 1 FROM posts p WHERE p.id = l.post_id) AS alive, " +
      "(SELECT p.created_by FROM posts p WHERE p.id = l.post_id) AS post_owner " +
      "FROM post_log l ORDER BY l.created_at DESC LIMIT ?"
    ).bind(limit).all();
    return json({
      log: (res.results || []).map((r) => ({
        id: r.id, postId: r.post_id, staffId: r.staff_id, action: r.action, pageId: r.page_id,
        date: r.post_date, time: r.post_time, topic: r.topic || "", createdAt: r.created_at,
        changes: r.changes ? JSON.parse(r.changes) : null,
        alive: !!r.alive, canEdit: !!r.alive && (isOwner || r.post_owner === me.id),
      })),
    });
  }

  /* ลบโพสต์ที่ยังไม่ได้ใส่หัวข้อ (เผลอกด Enter รัวจนได้แถวเปล่า) */
  if (path === "/posts/blank" && (method === "GET" || method === "DELETE")) {
    const where = "(topic IS NULL OR TRIM(topic) = '') AND (url IS NULL OR url = '')" +
      (isOwner ? "" : " AND created_by = ?");
    const binds = isOwner ? [] : [me.id];
    if (method === "GET") {
      const c = await db.prepare("SELECT COUNT(*) AS n FROM posts WHERE " + where).bind(...binds).first();
      return json({ count: (c && c.n) || 0 });
    }
    const rows = await db.prepare("SELECT * FROM posts WHERE " + where).bind(...binds).all();
    const list = rows.results || [];
    if (list.length) {
      const stmts = [db.prepare("DELETE FROM posts WHERE " + where).bind(...binds)];
      list.slice(0, 100).forEach((r) => stmts.push(logStmt(db, me, "delete", {
        id: r.id, pageId: r.page_id, date: r.post_date, time: r.post_time, topic: r.topic,
      }, null)));
      await db.batch(stmts);
    }
    return json({ ok: true, deleted: list.length });
  }

  const postMatch = path.match(/^\/posts\/([A-Za-z0-9_-]{1,40})$/);
  if (postMatch && method === "PUT") {
    const body = await readBody(request);
    const row = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(postMatch[1]).first();
    if (!row) return json({ error: "ไม่พบโพสต์นี้" }, 404);
    const now = nowIso();
    const sets = ["updated_at = ?", "updated_by = ?"], vals = [now, me.id];
    if (body.status != null) {
      if (POST_STATUS.indexOf(body.status) === -1) return json({ error: "สถานะไม่ถูกต้อง" }, 400);
      sets.push("status = ?"); vals.push(body.status);
      /* ติ๊กว่าโพสต์แล้ว = จดเวลาที่ติ๊กไว้ด้วย จะได้รู้ว่าโพสต์ตรงเวลาหรือช้า */
      sets.push("posted_at = ?"); vals.push(body.status === "done" ? (row.posted_at || now) : null);
    }
    if (body.url != null) {
      const u = String(body.url).trim();
      if (u && !/^https?:\/\//i.test(u)) return json({ error: "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://" }, 400);
      sets.push("url = ?"); vals.push(u.slice(0, 1000));
      /* วางลิงก์มาแล้ว = ถือว่าโพสต์แล้ว ไม่ต้องกดสองที */
      if (u && row.status !== "done") {
        sets.push("status = ?"); vals.push("done");
        sets.push("posted_at = ?"); vals.push(row.posted_at || now);
      }
    }
    ["time", "topic", "note", "kind"].forEach((k) => {
      if (body[k] != null) {
        sets.push((k === "time" ? "post_time" : k) + " = ?");
        vals.push(String(body[k]).slice(0, k === "topic" ? 1000 : 500));
      }
    });
    if (body.date != null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return json({ error: "วันที่ไม่ถูกต้อง" }, 400);
      sets.push("post_date = ?"); vals.push(body.date);
    }
    if (body.channels != null) { sets.push("channels = ?"); vals.push(JSON.stringify(Array.isArray(body.channels) ? body.channels.slice(0, 10) : [])); }
    if (body.pageId != null) { sets.push("page_id = ?"); vals.push(String(body.pageId).slice(0, 40)); }
    if (body.campaignId !== undefined) { sets.push("campaign_id = ?"); vals.push(body.campaignId ? String(body.campaignId).slice(0, 40) : null); }
    vals.push(row.id);
    await db.prepare("UPDATE posts SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
    const after = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(row.id).first();
    const changes = diffPost(postSnapshot(row), postSnapshot(after || row));
    if (changes.length) {
      await logStmt(db, me, "update", {
        id: row.id, pageId: (after || row).page_id, date: (after || row).post_date,
        time: (after || row).post_time, topic: (after || row).topic,
      }, changes).run();
    }
    await logChange(db, { by: me.id, entity: "post", entityId: row.id, action: "update",
      title: (after || row).topic || (after || row).post_date, before: row, after: after || row, at: now });
    return json({ ok: true });
  }
  if (postMatch && method === "DELETE") {
    const row = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(postMatch[1]).first();
    if (!row) return json({ ok: true });
    /* หัวหน้าลบได้ทุกอัน · คนอื่นลบได้เฉพาะโพสต์ที่ตัวเองสร้าง (ของเก่าที่ยังไม่มีคนสร้าง = หัวหน้าเท่านั้น) */
    if (!isOwner && row.created_by !== me.id) return json({ error: "ลบได้เฉพาะโพสต์ที่ตัวเองเพิ่มไว้" }, 403);
    await logChange(db, { by: me.id, entity: "post", entityId: row.id, action: "delete", title: row.topic || row.post_date, before: row, summary: "ลบโพสต์" });
    await db.batch([
      db.prepare("DELETE FROM posts WHERE id = ?").bind(row.id),
      logStmt(db, me, "delete", {
        id: row.id, pageId: row.page_id, date: row.post_date, time: row.post_time, topic: row.topic,
      }, null),
    ]);
    return json({ ok: true });
  }

  /* รายการในปฏิทินการตลาด สำหรับช่องเลือก "เชื่อมกับ…" ในโพสต์และงาน */
  /* ---- สรุปผลงานรายเดือน (ข้อ 03 ของคุณออน) ----
     "ตรงเวลา" นับจาก submitted_at เทียบ due_original — คือตอนน้อง "ส่งรอตรวจ"
     เทียบกับ "วันเดิมก่อนถูกเลื่อน" ตามที่นนท์ตัดสิน 11 ก.ย. 69
     ให้ 2 ตัวเลข: ontime = ถึงเวลาเป๊ะ · ontimeDay = ขอแค่ภายในวันนั้น (ตัวที่ใช้กับ KPI) */
  if (path === "/report/monthly" && method === "GET") {
    const m = String(url.searchParams.get("month") || "").match(/^(\d{4})-(\d{2})$/);
    const now = new Date();
    const y = m ? Number(m[1]) : now.getUTCFullYear();
    const mo = m ? Number(m[2]) : now.getUTCMonth() + 1;
    /* ขอบเดือนแบบเวลาไทย: 1 ของเดือน 00:00 +07 = วันก่อนหน้า 17:00 UTC */
    const from = new Date(Date.UTC(y, mo - 1, 1, -7, 0, 0)).toISOString();
    const to = new Date(Date.UTC(y, mo, 1, -7, 0, 0)).toISOString();

    const res = await db.prepare(
      TASK_SELECT + "WHERE t.due_at IS NOT NULL AND t.due_at >= ? AND t.due_at < ?" + TASK_ORDER
    ).bind(from, to).all();
    const tasks = (res.results || []).map(rowToTask);

    const dayOf = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10);
    const blank = () => ({ assigned: 0, finished: 0, ontime: 0, ontimeDay: 0, late: 0, open: 0,
                           hours: 0, kpiHours: 0, supportHours: 0, postpones: 0 });
    const byStaff = {}, byType = {}, byKind = {};
    const team = blank();
    const bucket = (map, key) => (map[key] = map[key] || blank());

    for (const t of tasks) {
      /* งานถือว่า "ส่งแล้ว" เมื่อส่งรอตรวจหรือปิดงาน — ไม่รอหัวหน้าตรวจ */
      const sent = t.submittedAt || (t.status === "done" ? t.doneAt : null);
      const due = t.dueOriginal || t.dueAt;
      const onTime = sent && due ? new Date(sent) <= new Date(due) : false;
      const onTimeDay = sent && due ? dayOf(sent) <= dayOf(due) : false;
      const rows = [team, bucket(byType, t.taskType || "other"), bucket(byKind, t.taskKind || "ondemand")]
        .concat(t.assignees.map((sid) => bucket(byStaff, sid)));
      for (const b of rows) {
        b.assigned++;
        b.postpones += t.postpones || 0;
        if (t.hours) {
          b.hours += t.hours;
          if (t.support) b.supportHours += t.hours; else b.kpiHours += t.hours;
        }
        if (sent) { b.finished++; if (onTime) b.ontime++; if (onTimeDay) b.ontimeDay++; if (!onTime) b.late++; }
        else b.open++;
      }
    }
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
    const shape = (b) => Object.assign({}, b, {
      hours: Math.round(b.hours * 100) / 100,
      kpiHours: Math.round(b.kpiHours * 100) / 100,
      supportHours: Math.round(b.supportHours * 100) / 100,
      ontimePct: pct(b.ontime, b.finished),
      ontimeDayPct: pct(b.ontimeDay, b.finished),
      kpiSharePct: pct(b.kpiHours, b.hours),
    });
    const mapOut = (m2) => Object.keys(m2).reduce((o, k) => { o[k] = shape(m2[k]); return o; }, {});
    return json({
      month: y + "-" + String(mo).padStart(2, "0"),
      team: shape(team), byStaff: mapOut(byStaff), byType: mapOut(byType), byKind: mapOut(byKind),
      note: "ตรงเวลา = ตอนส่งรอตรวจ เทียบกับวันเดิมก่อนถูกเลื่อน",
    });
  }

  /* ---- หน้างานป้าย: งานหลัก + 6 ขั้น + รูปของแต่ละขั้น ในคำขอเดียว ---- */
  if (path === "/signage" && method === "GET") {
    const mains = await db.prepare(TASK_SELECT + "WHERE t.task_type = 'signage' AND t.parent_id IS NULL" + TASK_ORDER).all();
    const list = (mains.results || []).map(rowToTask);
    const ids = list.map((t) => t.id);
    let stages = [];
    if (ids.length) {
      const q = "SELECT t.id,t.parent_id,t.stage,t.status,t.due_at,t.done_at,t.submitted_at," +
        "(SELECT COUNT(*) FROM task_files f WHERE f.task_id = t.id AND f.kind='file') AS n_pic," +
        "(SELECT id FROM task_files f WHERE f.task_id = t.id AND f.kind='file' ORDER BY created_at DESC LIMIT 1) AS pic_id " +
        /* ไม่ยัด id เป็น ?,?,? — D1 รับตัวแปรได้ 100 ตัว งานป้ายเกินร้อยแล้วหน้าพัง (18 ก.ย. 69) */
        "FROM tasks t WHERE t.stage IS NOT NULL AND t.parent_id IN (SELECT id FROM tasks WHERE task_type = 'signage' AND parent_id IS NULL)";
      const sr = await db.prepare(q).all();
      stages = (sr.results || []).map((r) => ({
        id: r.id, parentId: r.parent_id, stage: r.stage, status: r.status, dueAt: r.due_at,
        doneAt: r.done_at, submittedAt: r.submitted_at, nPic: r.n_pic || 0, picId: r.pic_id || null,
      }));
    }
    const sflow = await flowFor(db, "signage");
    return json({ tasks: list, stages, stageDefs: sflow.map((x) => ({ k: x.k, th: x.th, lead: x.lead, pic: x.pic })), leads: await signLeads(db) });
  }

  /* ---- ขั้นงานต่อประเภท: ดู/แก้ (หัวหน้าแก้ได้) ---- */
  if (path === "/flows" && method === "GET") {
    return json({ flows: await loadFlows(db), types: TASK_TYPES, max: MAX_FLOW_STAGES });
  }
  if (path === "/flows" && method === "PUT") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
    const body = await readBody(request);
    const type = String(body.type || "");
    if (TASK_TYPES.indexOf(type) === -1) return json({ error: "ประเภทงานไม่ถูกต้อง" }, 400);
    const parsed = cleanFlow(body.stages || []);
    if (parsed.error) return json({ error: parsed.error }, 400);
    const flows = await loadFlows(db);
    if (parsed.value.length) flows[type] = parsed.value; else delete flows[type];
    await db.prepare("INSERT OR REPLACE INTO task_settings (key,value) VALUES ('flows', ?)").bind(JSON.stringify(flows)).run();
    return json({ ok: true, flows });
  }

  /* ---- หน้าแคมเปญ: งานกับโพสต์ที่ผูกไว้ในที่เดียว (ข้อ 05 ของคุณออน) ---- */
  const campRel = path.match(/^\/campaigns\/([A-Za-z0-9_-]{1,40})\/related$/);
  if (campRel && method === "GET") {
    const cid = campRel[1];
    const tr = await db.prepare(TASK_SELECT + "WHERE t.campaign_id = ?" + TASK_ORDER).bind(cid).all();
    let posts = [];
    try {
      const pr = await db.prepare(
        "SELECT * FROM posts WHERE campaign_id = ? ORDER BY post_date, post_time LIMIT 400"
      ).bind(cid).all();
      posts = (pr.results || []).map(rowToPost);
    } catch (e) { posts = []; }
    return json({ tasks: (tr.results || []).map(rowToTask), posts });
  }

  if (path === "/campaigns" && method === "GET") {
    let rows = [];
    try {
      const res = await db.prepare(
        "SELECT id,name,kind,start_date,end_date,status,color FROM campaigns ORDER BY start_date DESC LIMIT 400"
      ).all();
      rows = res.results || [];
    } catch (e) { rows = []; }
    return json({ campaigns: rows.map((r) => ({
      id: r.id, name: r.name, kind: r.kind || "campaign", start: r.start_date, end: r.end_date,
      status: r.status, color: r.color || "#3370FF",
    })) });
  }

  /* สรุปให้หน้าแรก: วันนี้โพสต์ครบยัง */
  if (path === "/posts/today" && method === "GET") {
    const d = url.searchParams.get("date") || "";
    const day = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : nowIso().slice(0, 10);
    const res = await db.prepare(
      "SELECT status, COUNT(*) AS n, SUM(CASE WHEN url != '' THEN 1 ELSE 0 END) AS withUrl " +
      "FROM posts WHERE post_date = ? GROUP BY status"
    ).bind(day).all();
    let total = 0, done = 0, withUrl = 0;
    for (const r of (res.results || [])) {
      total += r.n;
      if (r.status === "done") done += r.n;
      withUrl += r.withUrl || 0;
    }
    return json({ date: day, total, done, withUrl, left: total - done });
  }

  /* ============================================================
     CRM — ลีดที่ทักเข้ามาจากแอด/เพจ  (/leads*)
     ------------------------------------------------------------
     สามทีมคนละหน้าที่ (นนท์ 21 ก.ย. 69):
       ทีมการตลาด  บันทึกลีดเข้ามา            → created_by
       ทีมขาย      "รับลีด" แล้วไล่ปิดการขาย   → owner_id
       บัญชี        รับช่วงตอนปิดได้แล้ว        → handed_at / handed_by
     ลีดที่ยังไม่มีเจ้าของ ใครขยับขั้นก็ได้ แล้วระบบถือว่าคนนั้นรับลีดไปเลย
     (ไม่งั้นของกองอยู่ช่อง "ใหม่" เพราะทุกคนรอให้คนอื่นกดรับก่อน)
     ============================================================ */

  const leadFields = async (body, cur) => {
    const pick = (k, max) => body[k] === undefined ? undefined : String(body[k] == null ? "" : body[k]).trim().slice(0, max);
    const out = {};
    const name = pick("name", 120);
    if (name !== undefined) {
      if (!name) return { error: "ต้องมีชื่อลีด" };
      out.name = name;
    } else if (!cur) return { error: "ต้องมีชื่อลีด" };
    const simple = { phone: 40, lineId: 80, sourceDetail: 200, interest: 1000, branch: 60, lostReason: 300, fbName: 120 };
    const col = { phone: "phone", lineId: "line_id", sourceDetail: "source_detail", interest: "interest", branch: "branch", lostReason: "lost_reason", fbName: "fb_name" };
    for (const k of Object.keys(simple)) { const v = pick(k, simple[k]); if (v !== undefined) out[col[k]] = v; }
    if (body.source !== undefined) {
      if (LEAD_SOURCES.indexOf(String(body.source)) === -1) return { error: "ช่องทางไม่ถูกต้อง" };
      out.source = String(body.source);
    }
    if (body.status !== undefined) {
      if (LEAD_STATUSES.indexOf(String(body.status)) === -1) return { error: "ขั้นไม่ถูกต้อง" };
      out.status = String(body.status);
    }
    if (body.estValue !== undefined) out.est_value = Math.max(0, Math.min(99999999, Math.round(Number(body.estValue) || 0)));
    if (body.boughtBefore !== undefined) out.bought_before = body.boughtBefore ? 1 : 0;
    if (body.receivedAt !== undefined) {
      const v = String(body.receivedAt || "").trim();
      if (v && !isIsoDateTime(v)) return { error: "วันที่ได้ลีดมาไม่ถูกต้อง" };
      out.received_at = v ? new Date(v).toISOString() : null;
    }
    if (body.nextAt !== undefined) {
      const v = String(body.nextAt || "").trim();
      if (v && !isIsoDateTime(v)) return { error: "วันที่ตามครั้งถัดไปไม่ถูกต้อง" };
      out.next_at = v ? new Date(v).toISOString() : null;
    }
    if (body.ownerId !== undefined) {
      const v = String(body.ownerId || "").trim();
      if (v && !(await db.prepare("SELECT 1 AS ok FROM staff WHERE id = ? AND active = 1").bind(v).first())) {
        return { error: "ไม่พบคนที่เลือกเป็นเซลส์" };
      }
      out.owner_id = v || null;
    }
    return { value: out };
  };

  if (path === "/leads" && method === "GET") {
    const res = await db.prepare(
      "SELECT l.*, " +
      "(SELECT COUNT(*) FROM lead_activities a WHERE a.lead_id = l.id) AS n_act, " +
      "(SELECT MAX(created_at) FROM lead_activities a WHERE a.lead_id = l.id) AS last_act " +
      "FROM leads l ORDER BY l.created_at DESC LIMIT 2000"
    ).all();
    return json({ leads: (res.results || []).map(rowToLead) });
  }

  if (path === "/leads" && method === "POST") {
    const body = await readBody(request);
    const f = await leadFields(body, null);
    if (f.error) return json({ error: f.error }, 400);
    const v = f.value;
    const now = nowIso();
    const id = newId("ld_");
    /* คนบันทึกจะรับเป็นเจ้าของเองเลยก็ได้ (เซลส์หาลีดมาเอง) ไม่ใส่มา = ปล่อยว่างให้ทีมขายมากดรับ */
    const owner = v.owner_id !== undefined ? v.owner_id : null;
    await db.batch([
      db.prepare(
        "INSERT INTO leads (id,name,phone,line_id,source,source_detail,interest,branch,status,owner_id," +
        "est_value,bought_before,lost_reason,next_at,received_at,fb_name,created_by,created_at,updated_at,updated_by) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(id, v.name, v.phone || "", v.line_id || "", v.source || "other", v.source_detail || "",
             v.interest || "", v.branch || "", v.status || "new", owner,
             v.est_value || 0, v.bought_before || 0, v.lost_reason || "", v.next_at || null,
             /* ไม่ระบุวันที่ได้ลีดมา = ถือว่าทักเข้ามาตอนที่บันทึก */
             v.received_at !== undefined ? v.received_at : now, v.fb_name || "",
             me.id, now, now, me.id),
      leadAct(db, id, me.id, "create", "บันทึกลีดเข้าระบบ", null, v.status || "new"),
    ]);
    await logChange(db, { by: me.id, entity: "lead", entityId: id, action: "create", title: v.name, after: await snapLead(db, id), at: now });
    return json({ ok: true, id });
  }

  const leadMatch = path.match(/^\/leads\/([A-Za-z0-9_-]{1,40})(\/activities|\/claim|\/hand)?$/);
  if (leadMatch) {
    const id = leadMatch[1];
    const sub = leadMatch[2] || "";
    const row = await db.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first();
    if (!row) return json({ error: "ไม่พบลีดนี้" }, 404);
    const lead = rowToLead(row);
    /* ขยับลีดได้: หัวหน้า · เซลส์ที่ถือลีดใบนี้ · หรือใครก็ได้ถ้ายังไม่มีใครรับ */
    const mayRun = isOwner || lead.ownerId === me.id || !lead.ownerId;

    if (!sub && method === "GET") {
      const acts = await db.prepare(
        "SELECT id,staff_id,kind,body,from_status,to_status,created_at FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC LIMIT 200"
      ).bind(id).all();
      return json({
        lead,
        activities: (acts.results || []).map((a) => ({
          id: a.id, staffId: a.staff_id, kind: a.kind, body: a.body || "",
          fromStatus: a.from_status || null, toStatus: a.to_status || null, createdAt: a.created_at,
        })),
      });
    }

    if (!sub && method === "PUT") {
      if (!mayRun) return json({ error: "ลีดนี้มีเซลส์ดูแลอยู่แล้ว — ให้เขาแก้ หรือให้หัวหน้าเปลี่ยนคนดูแลก่อน" }, 403);
      const body = await readBody(request);
      const f = await leadFields(body, row);
      if (f.error) return json({ error: f.error }, 400);
      const v = f.value;
      if (!Object.keys(v).length) return json({ error: "ไม่มีข้อมูลที่จะแก้" }, 400);
      /* ตีตกต้องบอกเหตุผล ไม่งั้นเดือนหน้าไม่มีใครรู้ว่าทำไมหลุด */
      const wantLost = v.status === "lost" && row.status !== "lost";
      if (wantLost && !String(v.lost_reason || row.lost_reason || "").trim()) {
        return json({ error: "ปิดเป็น “ไม่สำเร็จ” ต้องบอกเหตุผลด้วย" }, 400);
      }
      const now = nowIso();
      const sets = [], vals = [];
      for (const k of Object.keys(v)) { sets.push(k + " = ?"); vals.push(v[k]); }
      /* ขยับขั้นลีดที่ยังไม่มีเจ้าของ = คนที่ขยับรับไปเลย */
      const claiming = v.status && v.status !== row.status && !row.owner_id && v.owner_id === undefined;
      if (claiming) { sets.push("owner_id = ?"); vals.push(me.id); }
      sets.push("updated_at = ?"); vals.push(now);
      sets.push("updated_by = ?"); vals.push(me.id);
      vals.push(id);
      const stmts = [db.prepare("UPDATE leads SET " + sets.join(", ") + " WHERE id = ?").bind(...vals)];
      if (claiming) stmts.push(leadAct(db, id, me.id, "claim", "รับลีดไปดูแล", null, null));
      if (v.status && v.status !== row.status) {
        stmts.push(leadAct(db, id, me.id, "status",
          (LEAD_STATUS_TH[row.status] || row.status) + " → " + (LEAD_STATUS_TH[v.status] || v.status) +
          (v.status === "lost" ? " · " + String(v.lost_reason || row.lost_reason || "") : ""),
          row.status, v.status));
      }
      await db.batch(stmts);
      await logChange(db, { by: me.id, entity: "lead", entityId: id, action: "update", title: row.name, before: row, after: await snapLead(db, id), at: now });
      return json({ ok: true, status: v.status || row.status });
    }

    if (!sub && method === "DELETE") {
      if (!(isOwner || row.created_by === me.id)) return json({ error: "ลบได้เฉพาะหัวหน้าหรือคนที่บันทึกลีดนี้" }, 403);
      await logChange(db, { by: me.id, entity: "lead", entityId: id, action: "delete", title: row.name, before: row, summary: "ลบลีด" });
      await db.batch([
        db.prepare("DELETE FROM lead_activities WHERE lead_id = ?").bind(id),
        db.prepare("DELETE FROM leads WHERE id = ?").bind(id),
      ]);
      return json({ ok: true });
    }

    /* รับลีด — กดได้เฉพาะตอนยังว่าง ป้องกันสองคนแย่งกันโทรหาคนเดียวกัน */
    if (sub === "/claim" && method === "POST") {
      const body = await readBody(request);
      const give = String(body.staffId || me.id);
      if (give !== me.id && !isOwner) return json({ error: "มอบลีดให้คนอื่นได้เฉพาะหัวหน้า" }, 403);
      if (row.owner_id && row.owner_id !== me.id && !isOwner) {
        return json({ error: "ลีดนี้ " + (row.owner_id === me.id ? "คุณ" : "คนอื่น") + "รับไปแล้ว" }, 409);
      }
      const now = nowIso();
      await db.batch([
        db.prepare("UPDATE leads SET owner_id = ?, updated_at = ?, updated_by = ? WHERE id = ?").bind(give, now, me.id, id),
        leadAct(db, id, me.id, "claim", give === me.id ? "รับลีดไปดูแล" : "มอบลีดให้ทีมขาย", null, null),
      ]);
      return json({ ok: true, ownerId: give });
    }

    /* ส่งต่อบัญชี — ทำได้เฉพาะลีดที่ปิดการขายแล้ว ไม่งั้นบัญชีได้ของที่ยังไม่จบ */
    if (sub === "/hand" && method === "POST") {
      if (row.status !== "won") return json({ error: "ส่งต่อบัญชีได้เฉพาะลีดที่ปิดการขายแล้ว" }, 400);
      if (!mayRun) return json({ error: "ส่งต่อได้เฉพาะเซลส์ที่ดูแลลีดนี้หรือหัวหน้า" }, 403);
      if (row.handed_at) return json({ ok: true, handedAt: row.handed_at });
      const now = nowIso();
      await db.batch([
        db.prepare("UPDATE leads SET handed_at = ?, handed_by = ?, updated_at = ?, updated_by = ? WHERE id = ?").bind(now, me.id, now, me.id, id),
        leadAct(db, id, me.id, "hand", "ส่งต่อให้บัญชีแล้ว", null, null),
      ]);
      return json({ ok: true, handedAt: now });
    }

    if (sub === "/activities" && method === "POST") {
      const body = await readBody(request);
      const note = String(body.body || "").trim().slice(0, 2000);
      const kind = ["note", "call", "line", "meeting"].indexOf(String(body.kind)) !== -1 ? String(body.kind) : "note";
      if (!note) return json({ error: "ยังไม่ได้พิมพ์อะไรเลย" }, 400);
      /* เขียนโน้ตได้ทุกคน — ทีมการตลาดต้องแปะข้อมูลเพิ่มให้เซลส์ได้แม้ไม่ได้ถือลีด */
      const now = nowIso();
      await db.batch([
        leadAct(db, id, me.id, kind, note, null, null),
        db.prepare("UPDATE leads SET updated_at = ?, updated_by = ? WHERE id = ?").bind(now, me.id, id),
      ]);
      return json({ ok: true });
    }
  }

  /* พื้นที่ที่รูปกินไปจริง — D1 เก็บ base64 ขนาดบนดิสก์จึงมากกว่าไฟล์ต้นฉบับราว 1.33 เท่า */
  if (path === "/storage" && method === "GET") {
    const f = await db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(bytes),0) AS b FROM task_files WHERE kind != 'link'").first();
    let camp = { n: 0, b: 0 };
    try { camp = await db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(bytes),0) AS b FROM attachments").first(); } catch (e) {}
    const raw = (f.b || 0) + (camp.b || 0);
    return json({
      taskFiles: f.n || 0,
      campaignFiles: camp.n || 0,
      rawBytes: raw,
      storedBytes: Math.round(raw * 4 / 3),   // base64
      limitFreeBytes: 500 * 1024 * 1024,      // D1 ฟรี: 500MB ต่อฐานข้อมูล
      limitPaidBytes: 10 * 1024 * 1024 * 1024, // D1 เสียเงิน: 10GB ต่อฐานข้อมูล
      maxPerFileBytes: MAX_FILE_BYTES,
    });
  }

  /* เปลี่ยนรหัสผ่านของตัวเอง — มีแต่หัวหน้าที่ใช้รหัสผ่าน สมาชิกกดชื่อเข้าเลย */
  if (path === "/me/password" && method === "PUT") {
    if (!isOwner) return json({ error: "สมาชิกไม่ต้องใช้รหัสผ่าน กดชื่อตัวเองเข้าระบบได้เลย" }, 403);
    const body = await readBody(request);
    const row = await db.prepare("SELECT * FROM staff WHERE id = ?").bind(me.id).first();
    /* หัวหน้าที่ยังไม่มีรหัส (บัญชีเก่า) ตั้งได้เลยโดยไม่ต้องใส่รหัสเดิม */
    if (row.pw_hash) {
      const cur = await pbkdf2Hex(String(body.password || ""), row.pw_salt);
      if (cur !== row.pw_hash) return json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }, 400);
    }

    const sets = [], vals = [];
    if (body.email != null) {
      const email = normEmail(body.email);
      if (!validEmail(email)) return json({ error: "อีเมลไม่ถูกต้อง" }, 400);
      const taken = await db.prepare("SELECT id FROM staff WHERE email = ? AND id != ?").bind(email, me.id).first();
      if (taken) return json({ error: "อีเมลนี้มีคนใช้แล้ว" }, 409);
      sets.push("email = ?"); vals.push(email);
    }
    if (body.newPassword != null) {
      if (!validPassword(body.newPassword)) return json({ error: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว" }, 400);
      const salt = randHex(16);
      sets.push("pw_salt = ?"); vals.push(salt);
      sets.push("pw_hash = ?"); vals.push(await pbkdf2Hex(body.newPassword, salt));
    }
    if (!sets.length) return json({ error: "ไม่มีอะไรให้แก้" }, 400);
    vals.push(me.id);
    await db.prepare("UPDATE staff SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
    return json({ ok: true });
  }

  /* --- ทีม --- */
  if (path === "/staff" && method === "POST") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
    const body = await readBody(request);
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) return json({ error: "ต้องมีชื่อ" }, 400);
    const role = body.role === "owner" ? "owner" : "member";
    /* หัวหน้าคนใหม่ต้องมีรหัสผ่านตั้งแต่สร้าง ไม่งั้นเข้าไม่ได้เลย */
    if (role === "owner" && !validPassword(body.password)) return json({ error: "หัวหน้าต้องตั้งรหัสผ่านอย่างน้อย 8 ตัว" }, 400);
    const aliases = String(body.aliases || "").trim().slice(0, 200);
    const email = body.email ? normEmail(body.email) : null;
    if (email && !validEmail(email)) return json({ error: "อีเมลไม่ถูกต้อง" }, 400);
    if (email) {
      const taken = await db.prepare("SELECT id FROM staff WHERE email = ?").bind(email).first();
      if (taken) return json({ error: "อีเมลนี้มีคนใช้แล้ว" }, 409);
    }
    const username = body.username ? normUser(body.username) : null;
    if (username) {
      if (!validUsername(username)) return json({ error: "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–32 ตัว" }, 400);
      const takenU = await db.prepare("SELECT id FROM staff WHERE username = ?").bind(username).first();
      if (takenU) return json({ error: "ชื่อผู้ใช้นี้มีคนใช้แล้ว" }, 409);
    }
    const id = newId("s_");
    /* pin_salt/pin_hash เป็น NOT NULL จากยุค PIN — ไม่ได้ใช้แล้ว ใส่ค่าสุ่มที่ไม่มีใครรู้ */
    const salt = randHex(8);
    const hash = await sha256Hex(salt + ":" + randHex(16));
    const secs = body.sections != null ? cleanSections(body.sections) : DEFAULT_SECTIONS.join(",");
    await db.prepare(
      "INSERT INTO staff (id,name,aliases,role,pin_salt,pin_hash,active,created_at,email,username,sections) VALUES (?,?,?,?,?,?,1,?,?,?,?)"
    ).bind(id, name, aliases, role, salt, hash, nowIso(), email, username, secs).run();
    if (role === "owner") {
      const psalt = randHex(16);
      await db.prepare("UPDATE staff SET pw_salt = ?, pw_hash = ? WHERE id = ?")
        .bind(psalt, await pbkdf2Hex(body.password, psalt), id).run();
    }
    return json({ id, sections: secs.split(",").filter(Boolean) });
  }

  /* token สำหรับต่อ MCP (Claude / ChatGPT) — หัวหน้าสร้างให้รายคน หรือสร้างของตัวเอง
     token ผูกกับสิทธิ์ของคนนั้น: หัวหน้าได้ทุกอย่าง ลูกทีมได้เท่าที่เห็นในระบบ */
  const tokMatch = path.match(/^\/staff\/([A-Za-z0-9_-]{1,40})\/token$/);
  if (tokMatch && (method === "POST" || method === "DELETE")) {
    const sid = tokMatch[1];
    if (!isOwner && sid !== me.id) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
    const row = await db.prepare("SELECT id, active FROM staff WHERE id = ?").bind(sid).first();
    if (!row || !row.active) return json({ error: "ไม่พบคนนี้" }, 404);
    const token = method === "POST" ? randHex(24) : null;
    await db.prepare("UPDATE staff SET api_token = ? WHERE id = ?").bind(token, sid).run();
    return json({ ok: true, token });
  }

  /* ลบความคืบหน้าทีละรายการ — หัวหน้าลบได้ทุกอัน สมาชิกลบได้เฉพาะของตัวเอง
     ลบแล้วรูปที่แนบมากับอัปเดตนั้นหายตามไปด้วย (ไม่งั้นรูปลอยค้างในฐานข้อมูล)
     ไม่ลบ "สร้างงาน" เพราะเป็นจุดตั้งต้นของไทม์ไลน์ */
  const updMatch = path.match(/^\/updates\/([A-Za-z0-9_-]{1,40})$/);
  if (updMatch && method === "PUT") {
    if (!isOwner) return json({ error: "แก้ข้อความได้เฉพาะหัวหน้าทีม — ถ้าพิมพ์ผิดให้ลบแล้วเขียนใหม่" }, 403);
    const row = await db.prepare("SELECT id, kind FROM task_updates WHERE id = ?").bind(updMatch[1]).first();
    if (!row) return json({ error: "ไม่พบรายการนี้" }, 404);
    if (row.kind === "create") return json({ error: "แก้รายการ 'สร้างงาน' ไม่ได้" }, 400);
    const body = await readBody(request);
    const note = String(body.note == null ? "" : body.note).slice(0, 4000);
    await db.prepare("UPDATE task_updates SET note = ?, edited_at = ? WHERE id = ?")
      .bind(note, nowIso(), row.id).run();
    return json({ ok: true });
  }
  if (updMatch && method === "DELETE") {
    const row = await db.prepare("SELECT id, task_id, staff_id, kind FROM task_updates WHERE id = ?").bind(updMatch[1]).first();
    if (!row) return json({ error: "ไม่พบรายการนี้" }, 404);
    if (!isOwner && row.staff_id !== me.id) return json({ error: "ลบได้เฉพาะที่ตัวเองบันทึกไว้" }, 403);
    if (row.kind === "create") return json({ error: "ลบรายการ 'สร้างงาน' ไม่ได้" }, 400);
    await db.batch([
      db.prepare("DELETE FROM task_files WHERE update_id = ?").bind(row.id),
      db.prepare("DELETE FROM task_updates WHERE id = ?").bind(row.id),
    ]);
    return json({ ok: true });
  }

  const staffMatch = path.match(/^\/staff\/([A-Za-z0-9_-]{1,40})$/);
  if (staffMatch && method === "PUT") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
    const id = staffMatch[1];
    const body = await readBody(request);
    const row = await db.prepare("SELECT * FROM staff WHERE id = ?").bind(id).first();
    if (!row) return json({ error: "ไม่พบคนนี้" }, 404);
    const sets = [];
    const vals = [];
    if (body.name != null) {
      const name = String(body.name).trim().slice(0, 120);
      if (!name) return json({ error: "ต้องมีชื่อ" }, 400);
      sets.push("name = ?"); vals.push(name);
    }
    if (body.aliases != null) { sets.push("aliases = ?"); vals.push(String(body.aliases).trim().slice(0, 200)); }
    if (body.sections != null) { sets.push("sections = ?"); vals.push(cleanSections(body.sections)); }
    /* ติ๊กงานของคนอื่นได้ — พิซซ่าขอไว้เพื่ออัปเดตงานแทนเติ้ล */
    if (body.canUpdateOthers != null) { sets.push("can_update_others = ?"); vals.push(body.canUpdateOthers ? 1 : 0); }
    if (body.canReschedule != null) { sets.push("can_reschedule = ?"); vals.push(body.canReschedule ? 1 : 0); }
    /* วันทำงานรายคน "0,1,2,..." (0 = อาทิตย์) — พิซซ่าหยุดพฤหัส เติ้ลหยุดเสาร์อาทิตย์ */
    if (body.workDays != null) {
      const wd = String(body.workDays).split(",").map((x) => Number(String(x).trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
      sets.push("work_days = ?"); vals.push(wd.length ? Array.from(new Set(wd)).sort().join(",") : null);
    }
    if (body.hoursPerDay != null) {
      const h = Number(body.hoursPerDay);
      if (!isFinite(h) || h < 0 || h > 24) return json({ error: "ชั่วโมงต่อวันต้องอยู่ระหว่าง 0–24" }, 400);
      sets.push("hours_per_day = ?"); vals.push(h || null);
    }
    if (body.role != null) {
      if (id === me.id && body.role !== "owner") return json({ error: "ลดสิทธิ์ตัวเองไม่ได้" }, 400);
      sets.push("role = ?"); vals.push(body.role === "owner" ? "owner" : "member");
    }
    if (body.active != null) {
      if (id === me.id && !body.active) return json({ error: "ปิดบัญชีตัวเองไม่ได้" }, 400);
      sets.push("active = ?"); vals.push(body.active ? 1 : 0);
    }
    if (body.email != null) {
      const email = normEmail(body.email);
      if (email && !validEmail(email)) return json({ error: "อีเมลไม่ถูกต้อง" }, 400);
      if (email) {
        const taken = await db.prepare("SELECT id FROM staff WHERE email = ? AND id != ?").bind(email, id).first();
        if (taken) return json({ error: "อีเมลนี้มีคนใช้แล้ว" }, 409);
      }
      sets.push("email = ?"); vals.push(email || null);
    }
    if (body.username != null) {
      const username = normUser(body.username);
      if (username && !validUsername(username)) return json({ error: "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–32 ตัว" }, 400);
      if (username) {
        const takenU = await db.prepare("SELECT id FROM staff WHERE username = ? AND id != ?").bind(username, id).first();
        if (takenU) return json({ error: "ชื่อผู้ใช้นี้มีคนใช้แล้ว" }, 409);
      }
      sets.push("username = ?"); vals.push(username || null);
    }
    /* ตั้งรหัสผ่านให้ — มีความหมายเฉพาะบัญชีหัวหน้า (สมาชิกกดชื่อเข้าเลย ไม่มีรหัส) */
    if (body.password != null) {
      const target = await db.prepare("SELECT role FROM staff WHERE id = ?").bind(id).first();
      const willBeOwner = body.role != null ? body.role === "owner" : (target && target.role === "owner");
      if (!willBeOwner) return json({ error: "สมาชิกไม่ใช้รหัสผ่าน กดชื่อตัวเองเข้าระบบได้เลย" }, 400);
      if (!validPassword(body.password)) return json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัว" }, 400);
      const salt = randHex(16);
      sets.push("pw_salt = ?"); vals.push(salt);
      sets.push("pw_hash = ?"); vals.push(await pbkdf2Hex(body.password, salt));
    }
    if (!sets.length) return json({ error: "ไม่มีอะไรให้แก้" }, 400);
    vals.push(id);
    await db.batch([
      db.prepare("UPDATE staff SET " + sets.join(", ") + " WHERE id = ?").bind(...vals),
      /* หัวหน้าตั้งรหัสใหม่ให้ = ปลดล็อกที่ค้างจากการใส่ผิดด้วย */
      db.prepare("DELETE FROM task_logins WHERE staff_id = ?").bind(id),
    ]);
    return json({ ok: true });
  }

  /* --- KPI (หัวหน้าแก้ keyword/เป้าได้) --- */
  const kpiMatch = path.match(/^\/kpis\/([A-Za-z0-9_-]{1,40})$/);
  if (kpiMatch && method === "PUT") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
    const body = await readBody(request);
    const sets = [];
    const vals = [];
    if (body.title != null) { sets.push("title = ?"); vals.push(String(body.title).trim().slice(0, 200)); }
    if (body.target != null) { sets.push("target = ?"); vals.push(String(body.target).trim().slice(0, 1000)); }
    if (body.keywords != null) { sets.push("keywords = ?"); vals.push(String(body.keywords).trim().slice(0, 1000)); }
    if (body.weight != null) { sets.push("weight = ?"); vals.push(Math.max(0, Math.min(100, Math.round(Number(body.weight) || 0)))); }
    if (!sets.length) return json({ error: "ไม่มีอะไรให้แก้" }, 400);
    vals.push(kpiMatch[1]);
    const res = await db.prepare("UPDATE kpis SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
    if (!res.meta.changes) return json({ error: "ไม่พบ KPI นี้" }, 404);
    return json({ ok: true });
  }

  /* --- รายการงาน --- */
  if (path === "/tasks" && method === "GET") {
    const scope = url.searchParams.get("scope") === "me" ? "me" : "all";
    const where = [];
    const binds = [];
    if (scope === "me") {
      where.push("t.id IN (SELECT task_id FROM task_assignees WHERE staff_id = ?)");
      binds.push(me.id);
    }
    const status = url.searchParams.get("status");
    if (status === "open") where.push("t.status != 'done'");
    else if (status === "done") where.push("t.status = 'done'");
    const camp = url.searchParams.get("campaign");
    if (camp) { where.push("t.campaign_id = ?"); binds.push(camp); }
    /* หน้ารายการโชว์เฉพาะงานหลัก งานย่อยไปโผล่ในหน้ารายละเอียดของพ่อแม่แทน
       เว้นแต่ขอ sub=1 (เช่นหน้า "งานของฉัน" ที่ต้องเห็นงานย่อยที่มอบให้ตัวเอง) */
    if (url.searchParams.get("sub") !== "1") where.push("t.parent_id IS NULL");
    const sql = TASK_SELECT + (where.length ? "WHERE " + where.join(" AND ") : "") + TASK_ORDER;
    const res = await db.prepare(sql).bind(...binds).all();
    return json({ tasks: (res.results || []).map(rowToTask) });
  }

  if (path === "/tasks" && method === "POST") {
    const body = await readBody(request);
    const list = Array.isArray(body.tasks) ? body.tasks : [body];
    if (!list.length) return json({ error: "ไม่มีงานให้บันทึก" }, 400);
    if (list.length > MAX_BULK_TASKS) return json({ error: "บันทึกได้ครั้งละไม่เกิน " + MAX_BULK_TASKS + " งาน" }, 413);
    const sets = await loadIdSets(db);
    const stmts = [];
    const ids = [];
    const signMains = [];
    const now = nowIso();
    for (const input of list) {
      const parsed = cleanTask(input, sets.kpiIds, sets.staffIds, sets.campaignIds);
      if (parsed.error) return json({ error: parsed.error }, 400);
      const v = parsed.value;
      const id = newId("t_");
      ids.push(id);
      stmts.push(db.prepare(
        "INSERT INTO tasks (id,title,detail,kpi_id,status,due_at,repeat,repeat_days,priority,created_by,created_at,updated_at,done_at,parent_id,campaign_id,task_type,task_kind,hours,support,due_original,sign_w,sign_h,sign_qty,sign_branch) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(id, v.title, v.detail, v.kpiId, v.status, v.dueAt, v.repeat, v.repeatDays, v.priority, me.id, now, now,
             v.status === "done" ? now : null, v.parentId, v.campaignId, v.taskType, v.taskKind, v.hours, v.support, v.dueAt,
             v.signW, v.signH, v.signQty, v.signBranch));
      if (!v.parentId) signMains.push(id);   /* ensureSignStages เช็คเองว่าประเภทนี้มี flow ไหม */
      for (const sid of v.assignees) {
        stmts.push(db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, staff_id) VALUES (?,?)").bind(id, sid));
      }
      stmts.push(db.prepare(
        "INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)"
      ).bind(newId("u_"), id, me.id, "create", "", v.status, now));
    }
    await db.batch(stmts);
    /* ประวัติ: สร้างงาน (งานย่อยของขั้นไม่ต้องบันทึก จะได้ไม่รก) */
    for (let i = 0; i < ids.length; i++) {
      const snap = await snapTask(db, ids[i]);
      if (snap) await logChange(db, { by: me.id, entity: "task", entityId: ids[i], action: "create", title: snap.title, after: snap, at: now });
    }
    /* ประเภทที่มีขั้นงาน (ป้ายเป็นค่าเริ่มต้น) ได้งานย่อยตามขั้นทันที วันคาดว่าเสร็จถอยหลังจากกำหนดส่ง */
    const flowsNow = await loadFlows(db);
    const stagesFor = [];
    for (const mid of signMains) {
      const t0 = list[ids.indexOf(mid)];
      const tt = t0 && TASK_TYPES.indexOf(t0.taskType) !== -1 ? t0.taskType : "other";
      if (flowsNow[tt]) { await ensureSignStages(db, mid, me.id, now); stagesFor.push(mid); }
    }
    return json({ ids, stagesFor });
  }

  /* ============================================================
     ประวัติการแก้ไข — ใครแก้อะไรเมื่อไหร่ · ค้นหา/กรองได้ · กดย้อนเวอร์ชันได้ (นนท์ 20 ก.ย. 69)
     GET  /history?q=&who=&entity=&days=&limit=&before=
     POST /history/:id/revert   → คืนค่าตามสภาพก่อนการแก้ครั้งนั้น
     ============================================================ */
  if (path === "/history" && method === "GET") {
    const q = String(url.searchParams.get("q") || "").trim().slice(0, 80);
    const who = String(url.searchParams.get("who") || "").slice(0, 40);
    const ent = String(url.searchParams.get("entity") || "").slice(0, 20);
    const days = Math.max(0, Math.min(365, Number(url.searchParams.get("days") || 0)));
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 60)));
    const before = String(url.searchParams.get("before") || "");
    const where = [], bind = [];
    if (q) { where.push("(title LIKE ? OR summary LIKE ?)"); bind.push("%" + q + "%", "%" + q + "%"); }
    if (who) { where.push("staff_id = ?"); bind.push(who); }
    if (ent) { where.push("entity = ?"); bind.push(ent); }
    if (days) { where.push("at >= ?"); bind.push(new Date(Date.now() - days * 86400000).toISOString()); }
    if (before) { where.push("at < ?"); bind.push(before); }
    const sql = "SELECT id,at,staff_id,entity,entity_id,action,title,summary,before_json,after_json,reverted_at,reverted_by FROM audit_log" +
      (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY at DESC LIMIT " + (limit + 1);
    const r = await db.prepare(sql).bind(...bind).all();
    const rows = (r.results || []);
    const more = rows.length > limit;
    const items = rows.slice(0, limit).map((x) => {
      let fields = [];
      if (x.action === "update" && x.before_json && x.after_json) {
        try { fields = diffSnap(JSON.parse(x.before_json), JSON.parse(x.after_json)).slice(0, 12); } catch (e) { fields = []; }
      }
      return { id: x.id, at: x.at, by: x.staff_id, entity: x.entity, entityId: x.entity_id, action: x.action,
        title: x.title, summary: x.summary, fields,
        canRevert: !x.reverted_at && (x.entity === "task" || x.entity === "post") && !!(x.before_json || x.action === "create"),
        revertedAt: x.reverted_at || null, revertedBy: x.reverted_by || null };
    });
    return json({ items, more, nextBefore: more ? rows[limit - 1].at : null,
      entities: Object.keys(AUDIT_ENTITY_TH).map((k) => ({ k, th: AUDIT_ENTITY_TH[k] })) });
  }

  const revMatch = path.match(/^\/history\/([A-Za-z0-9_-]{1,40})\/revert$/);
  if (revMatch && method === "POST") {
    const row = await db.prepare("SELECT * FROM audit_log WHERE id = ?").bind(revMatch[1]).first();
    if (!row) return json({ error: "ไม่พบประวัติรายการนี้" }, 404);
    if (row.reverted_at) return json({ error: "รายการนี้ถูกย้อนไปแล้ว" }, 409);
    if (row.entity !== "task" && row.entity !== "post") return json({ error: "ย้อนได้เฉพาะงานกับโพสต์" }, 400);
    /* สิทธิ์: หัวหน้าย้อนได้ทุกอัน · คนอื่นย้อนได้เฉพาะสิ่งที่ตัวเองแก้ */
    if (!isOwner && row.staff_id !== me.id) return json({ error: "ย้อนได้เฉพาะรายการที่ตัวเองแก้ หรือให้หัวหน้าย้อนให้" }, 403);
    const before = row.before_json ? JSON.parse(row.before_json) : null;
    const now = nowIso();
    const stmts = [];
    let note = "";

    if (row.entity === "task") {
      const cur = await snapTask(db, row.entity_id);
      if (row.action === "create") {
        if (!cur) return json({ error: "งานนี้ถูกลบไปแล้ว" }, 409);
        const kids = await db.prepare("SELECT id FROM tasks WHERE parent_id = ?").bind(row.entity_id).all();
        for (const tid of [row.entity_id].concat((kids.results || []).map((k) => k.id))) {
          stmts.push(db.prepare("DELETE FROM task_files WHERE task_id = ?").bind(tid));
          stmts.push(db.prepare("DELETE FROM task_updates WHERE task_id = ?").bind(tid));
          stmts.push(db.prepare("DELETE FROM task_assignees WHERE task_id = ?").bind(tid));
          stmts.push(db.prepare("DELETE FROM task_mentions WHERE task_id = ?").bind(tid));
          stmts.push(db.prepare("DELETE FROM tasks WHERE id = ?").bind(tid));
        }
        note = "ย้อน: ลบงานที่เพิ่งสร้าง";
      } else {
        if (!before) return json({ error: "ไม่มีข้อมูลก่อนแก้ ย้อนไม่ได้" }, 400);
        const rows0 = [before].concat(Array.isArray(before.__kids) ? before.__kids : []);
        for (const b of rows0) {
          const cols = Object.keys(b).filter((k) => k !== "__assignees" && k !== "__kids");
          stmts.push(db.prepare(
            "INSERT OR REPLACE INTO tasks (" + cols.join(",") + ") VALUES (" + cols.map(() => "?").join(",") + ")"
          ).bind(...cols.map((k) => b[k])));
          stmts.push(db.prepare("DELETE FROM task_assignees WHERE task_id = ?").bind(b.id));
          for (const sid of (b.__assignees || [])) {
            stmts.push(db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, staff_id) VALUES (?,?)").bind(b.id, sid));
          }
        }
        stmts.push(db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").bind(now, before.id));
        note = row.action === "delete" ? "ย้อน: กู้งานที่ลบไป" : "ย้อนกลับเป็นค่าก่อนแก้";
        stmts.push(db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(newId("u_"), before.id, me.id, "note", note + " (" + (row.summary || "") + ")", null, now));
      }
    } else {
      const cur = await snapPost(db, row.entity_id);
      if (row.action === "create") {
        if (!cur) return json({ error: "โพสต์นี้ถูกลบไปแล้ว" }, 409);
        stmts.push(db.prepare("DELETE FROM posts WHERE id = ?").bind(row.entity_id));
        note = "ย้อน: ลบโพสต์ที่เพิ่งเพิ่ม";
      } else {
        if (!before) return json({ error: "ไม่มีข้อมูลก่อนแก้ ย้อนไม่ได้" }, 400);
        const cols = Object.keys(before);
        stmts.push(db.prepare(
          "INSERT OR REPLACE INTO posts (" + cols.join(",") + ") VALUES (" + cols.map(() => "?").join(",") + ")"
        ).bind(...cols.map((k) => before[k])));
        note = row.action === "delete" ? "ย้อน: กู้โพสต์ที่ลบไป" : "ย้อนกลับเป็นค่าก่อนแก้";
      }
    }
    await db.batch(stmts);
    await db.prepare("UPDATE audit_log SET reverted_at = ?, reverted_by = ? WHERE id = ?").bind(now, me.id, row.id).run();
    /* บันทึกการย้อนเป็นประวัติอีกชั้น จะได้เห็นว่าใครกดย้อนตอนไหน */
    await logChange(db, { by: me.id, entity: row.entity, entityId: row.entity_id, action: "revert",
      title: row.title, summary: note, before: row.after_json ? JSON.parse(row.after_json) : null, after: before, at: now });
    return json({ ok: true, note });
  }

  /* ---- ทำหลายงานพร้อมกันจากหน้ารายการ (ติ๊กเลือกแล้วสั่งครั้งเดียว) ----
     action: approve | done | status | assign | due | delete
     สิทธิ์ตรวจรายงานเหมือนยิงทีละงาน — งานที่ทำไม่ได้จะถูกข้ามพร้อมบอกเหตุผล ไม่ล้มทั้งชุด
     ยิงเป็น batch เดียว ไม่กิน D1 ทีละงาน · จำกัด 60 งาน/ครั้ง (ตัวแปร SQL ของ D1 ได้ 100) */
  if (path === "/tasks/bulk" && method === "POST") {
    const body = await readBody(request);
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter((x) => /^[A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, MAX_BULK_TASKS) : [];
    const action = String(body.action || "");
    if (!ids.length) return json({ error: "ยังไม่ได้เลือกงาน" }, 400);
    if (["approve", "done", "status", "assign", "due", "delete"].indexOf(action) === -1) return json({ error: "คำสั่งไม่ถูกต้อง" }, 400);
    const qs = ids.map(() => "?").join(",");
    const rows = await db.prepare(TASK_SELECT + "WHERE t.id IN (" + qs + ")").bind(...ids).all();
    const tasks = (rows.results || []).map(rowToTask);
    const now = nowIso();
    const stmts = [];
    const skipped = [];
    const changed = [];
    const skip = (t, why) => skipped.push({ id: t.id, title: t.title, reason: why });
    const canApproveT = (t) => isOwner || t.createdBy === me.id;
    const mineT = (t) => t.assignees.indexOf(me.id) !== -1;
    const canTickT = (t) => canApproveT(t) || mineT(t) || canUpdateOthers;

    /* ขั้นของงานป้ายปิดโดยไม่มีรูปไม่ได้ — เช็คทีเดียวทั้งชุด */
    let picCount = {};
    if (action === "approve" || action === "done" || action === "status") {
      const stageIds = tasks.filter((t) => t.stage).map((t) => t.id);
      if (stageIds.length) {
        const pr = await db.prepare("SELECT task_id, COUNT(*) AS n FROM task_files WHERE task_id IN (" + stageIds.map(() => "?").join(",") + ") GROUP BY task_id").bind(...stageIds).all();
        for (const r of (pr.results || [])) picCount[r.task_id] = r.n;
      }
    }
    let owners = null;
    const ownerIds = async () => {
      if (!owners) { const o = await db.prepare("SELECT id FROM staff WHERE role = 'owner' AND active = 1").all(); owners = (o.results || []).map((x) => x.id); }
      return owners;
    };
    const pings = [];
    const setStatus = async (t, status, note) => {
      if (status === "review" && status !== t.status) pings.push({ title: t.title, by: me.name, id: t.id });
      const st = stampsFor(status, t, now, me.id);
      stmts.push(db.prepare("UPDATE tasks SET status=?, updated_at=?, done_at=?, submitted_at=?, approved_at=?, approved_by=? WHERE id=?")
        .bind(status, now, st.doneAt, st.submitted, st.approvedAt, st.approvedBy, t.id));
      stmts.push(db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(newId("u_"), t.id, me.id, "status", note || (mineT(t) || canApproveT(t) ? "" : "อัปเดตแทน"), status, now));
      if (status === t.status) return;
      if (canApproveT(t)) {
        /* หัวหน้าเปลี่ยนสถานะ → บอกคนรับงาน (เหมือนตรวจผ่านทีละงาน) */
        if (status === "done") for (const sid of t.assignees) {
          if (sid === me.id) continue;
          stmts.push(db.prepare("INSERT INTO task_mentions (id,task_id,update_id,staff_id,by_staff,note,created_at) VALUES (?,?,?,?,?,?,?)")
            .bind(newId("m_"), t.id, "", sid, me.id, ("ตรวจผ่านแล้ว: " + String(t.title)).slice(0, 300), now));
        }
      } else {
        /* น้องเปลี่ยน → เด้งหาหัวหน้า + คนสั่ง */
        const tell = new Set(await ownerIds()); if (t.createdBy) tell.add(t.createdBy); tell.delete(me.id);
        const what = status === "review" ? "ส่งงานให้ตรวจ" : "เปลี่ยนเป็น " + (STATUS_TH[status] || status);
        for (const sid of tell) stmts.push(db.prepare("INSERT INTO task_mentions (id,task_id,update_id,staff_id,by_staff,note,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(newId("m_"), t.id, "", sid, me.id, (what + ": " + String(t.title)).slice(0, 300), now));
      }
      /* ขั้นป้ายผ่าน → จดขั้นล่าสุดไว้ที่งานหลัก (เหมือนตรวจทีละงาน) */
      if (status === "done" && t.stage && t.parentId) {
        const par = await db.prepare("SELECT stage FROM tasks WHERE id = ?").bind(t.parentId).first();
        const fl = await flowFor(db, t.taskType);
        if (stageIdx(fl, t.stage) > (par ? stageIdx(fl, par.stage) : -1)) {
          stmts.push(db.prepare("UPDATE tasks SET stage=?, updated_at=? WHERE id=?").bind(t.stage, now, t.parentId));
        }
      }
    };
    let sets = null;

    for (const t of tasks) {
      if (action === "delete") {
        if (!canApproveT(t)) { skip(t, "ลบได้เฉพาะหัวหน้าหรือคนสร้าง"); continue; }
        changed.push({ id: t.id, prev: t.status });
        continue;
      }
      if (action === "assign") {
        /* เปลี่ยนคนรับผิดชอบ = ทุกคนในทีมทำได้ */
        if (!sets) sets = await loadIdSets(db);
        const want = Array.from(new Set((Array.isArray(body.assignees) ? body.assignees : []).map(String).filter((x) => sets.staffIds.has(x)))).slice(0, 20);
        stmts.push(db.prepare("DELETE FROM task_assignees WHERE task_id = ?").bind(t.id));
        for (const sid of want) stmts.push(db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, staff_id) VALUES (?,?)").bind(t.id, sid));
        stmts.push(db.prepare("UPDATE tasks SET updated_at=? WHERE id=?").bind(now, t.id));
        /* คนที่เพิ่งได้รับงาน → แจ้ง */
        for (const sid of want) if (t.assignees.indexOf(sid) === -1 && sid !== me.id) {
          stmts.push(db.prepare("INSERT INTO task_mentions (id,task_id,update_id,staff_id,by_staff,note,created_at) VALUES (?,?,?,?,?,?,?)")
            .bind(newId("m_"), t.id, "", sid, me.id, ("มอบหมายงานให้คุณ: " + String(t.title)).slice(0, 300), now));
        }
        changed.push({ id: t.id, prev: t.assignees });
        continue;
      }
      if (action === "due") {
        /* dueAt = ตั้งวันเดียวกันทุกงาน · shiftDays = เลื่อนจากวันเดิมของแต่ละงาน */
        let iso = null;
        if (body.dueAt) { if (!isIsoDateTime(body.dueAt)) return json({ error: "กำหนดส่งไม่ถูกต้อง" }, 400); iso = new Date(body.dueAt).toISOString(); }
        else if (body.shiftDays != null) {
          if (!t.dueAt) { skip(t, "ยังไม่มีวันให้เลื่อน"); continue; }
          iso = new Date(new Date(t.dueAt).getTime() + Number(body.shiftDays) * 86400000).toISOString();
        } else return json({ error: "ต้องส่ง dueAt หรือ shiftDays" }, 400);
        const editor = canApproveT(t);
        if (!editor) {
          if (!mineT(t) && !canUpdateOthers) { skip(t, "ไม่ใช่งานของคุณ"); continue; }
          if (t.dueAt && !canReschedule) { skip(t, "เลื่อนเองไม่ได้ ต้องให้หัวหน้าเลื่อน"); continue; }
        }
        const same = t.dueAt && new Date(t.dueAt).getTime() === new Date(iso).getTime();
        const moved = !!(t.dueAt && !same);
        stmts.push(db.prepare("UPDATE tasks SET due_at=?, due_original=?, postpones=?, updated_at=? WHERE id=?")
          .bind(iso, t.dueOriginal || iso, (t.postpones || 0) + (moved ? 1 : 0), now, t.id));
        if (!same) stmts.push(db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(newId("u_"), t.id, me.id, "note",
                (moved ? "เลื่อนกำหนดส่ง " + thDate(t.dueAt) + " → " + thDate(iso) : "ใส่กำหนดส่ง " + thDate(iso)) +
                (body.reason ? " · " + String(body.reason).trim().slice(0, 300) : ""), null, now));
        changed.push({ id: t.id, prev: t.dueAt });
        continue;
      }
      /* approve / done / status */
      let want = action === "approve" ? "done" : (action === "done" ? "done" : String(body.status || ""));
      if (STATUSES.indexOf(want) === -1) return json({ error: "สถานะไม่ถูกต้อง" }, 400);
      if (action === "approve") {
        if (!isOwner) { skip(t, "ตรวจผ่านได้เฉพาะหัวหน้า"); continue; }
        if (t.status !== "review") { skip(t, "ยังไม่ได้ส่งตรวจ"); continue; }
      } else if (!canTickT(t)) { skip(t, "ไม่ใช่งานของคุณ"); continue; }
      const status = statusFor(want, t, isOwner);
      if ((status === "done" || status === "review") && t.stage && !picCount[t.id] && await stageNeedsPic(db, t)) { skip(t, "ขั้นนี้ต้องแนบรูปก่อนปิด"); continue; }
      if (status === t.status && !(t.repeat && status === "done")) { skip(t, "เป็น " + (STATUS_TH[status] || status) + " อยู่แล้ว"); continue; }
      await setStatus(t, status, action === "approve" ? "ตรวจผ่านแล้ว" : "");
      changed.push({ id: t.id, prev: t.status, status });
    }

    if (action === "delete" && changed.length) {
      const delIds = changed.map((c) => c.id);
      const kids = await db.prepare("SELECT id FROM tasks WHERE parent_id IN (" + delIds.map(() => "?").join(",") + ")").bind(...delIds).all();
      const all = delIds.concat((kids.results || []).map((r) => r.id));
      for (const tid of all) {
        stmts.push(db.prepare("DELETE FROM task_files WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM task_updates WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM task_assignees WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM task_mentions WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM tasks WHERE id = ?").bind(tid));
      }
    }
    /* ประวัติ: เก็บสภาพก่อนไว้แล้วค่อยเทียบหลังยิง batch */
    const auditPre = {};
    if (changed.length) for (const c of changed) auditPre[c.id] = await snapTask(db, c.id);
    if (stmts.length) await db.batch(stmts);
    for (const c of changed) {
      const b0 = auditPre[c.id];
      if (!b0) continue;
      if (action === "delete") await logChange(db, { by: me.id, entity: "task", entityId: c.id, action: "delete", title: b0.title, before: b0, summary: "ลบงาน (เลือกหลายงาน)" });
      else await logChange(db, { by: me.id, entity: "task", entityId: c.id, action: "update", title: b0.title, before: b0, after: await snapTask(db, c.id), at: now });
    }
    pingReview(ctx, env, db, pings);
    const missing = ids.filter((id) => !tasks.some((t) => t.id === id)).length;
    return json({ ok: true, done: changed.length, changed, skipped, missing });
  }

  const taskMatch = path.match(/^\/tasks\/([A-Za-z0-9_-]{1,40})(\/updates|\/review|\/postpone-request|\/stages)?$/);
  if (taskMatch) {
    const id = taskMatch[1];
    const sub = taskMatch[2] || "";
    const row = await db.prepare(TASK_SELECT + "WHERE t.id = ?").bind(id).first();
    if (!row) return json({ error: "ไม่พบงานนี้" }, 404);
    const task = rowToTask(row);
    const mine = task.assignees.indexOf(me.id) !== -1;

    if (!sub && method === "GET") {
      const ups = await db.prepare(
        "SELECT id,staff_id,kind,note,status_to,created_at,edited_at FROM task_updates WHERE task_id = ? ORDER BY created_at DESC"
      ).bind(id).all();
      const files = await db.prepare(
        "SELECT id,update_id,file_name,mime,bytes,created_at,kind,url,title FROM task_files WHERE task_id = ? ORDER BY created_at ASC"
      ).bind(id).all();
      const subs = await db.prepare(TASK_SELECT + "WHERE t.parent_id = ?" + TASK_ORDER).bind(id).all();
      /* งานป้าย: รูปล่าสุดของแต่ละขั้น เอาไปโชว์ใน funnel โดยไม่ต้องเปิดทีละขั้น */
      const subRows = (subs.results || []).map(rowToTask);
      const stageIds = subRows.filter((x) => x.stage && x.nFiles).map((x) => x.id);
      if (stageIds.length) {
        const pr = await db.prepare(
          "SELECT task_id, MAX(created_at) AS at, id FROM task_files WHERE kind = 'file' AND task_id IN (" +
          stageIds.map(() => "?").join(",") + ") GROUP BY task_id"
        ).bind(...stageIds).all();
        const pic = {};
        for (const r of (pr.results || [])) pic[r.task_id] = r.id;
        subRows.forEach((x) => { if (pic[x.id]) x.picId = pic[x.id]; });
      }
      let parent = null;
      if (task.parentId) {
        const pr = await db.prepare("SELECT id, title FROM tasks WHERE id = ?").bind(task.parentId).first();
        if (pr) parent = { id: pr.id, title: pr.title };
      }
      return json({
        task,
        parent,
        subtasks: subRows,
        updates: (ups.results || []).map((u) => ({
          id: u.id, staffId: u.staff_id, kind: u.kind, note: u.note || "", statusTo: u.status_to || null,
          createdAt: u.created_at, editedAt: u.edited_at || null,
        })),
        files: (files.results || []).map((f) => ({
          id: f.id, updateId: f.update_id || null, fileName: f.file_name, mime: f.mime, bytes: f.bytes,
          createdAt: f.created_at, kind: f.kind || "file", url: f.url || null, title: f.title || null,
        })),
      });
    }

    if (!sub && method === "PUT") {
      const body = await readBody(request);
      const now = nowIso();
      const auditBefore = await snapTask(db, id);
      if (isOwner || task.createdBy === me.id) {
        const sets = await loadIdSets(db);
        const merged = {
          title: body.title != null ? body.title : task.title,
          detail: body.detail != null ? body.detail : task.detail,
          kpiId: body.kpiId !== undefined ? body.kpiId : task.kpiId,
          status: body.status != null ? body.status : task.status,
          dueAt: body.dueAt !== undefined ? body.dueAt : task.dueAt,
          repeat: body.repeat != null ? body.repeat : task.repeat,
          repeatDays: body.repeatDays !== undefined ? body.repeatDays : task.repeatDays,
          priority: body.priority != null ? body.priority : task.priority,
          assignees: body.assignees != null ? body.assignees : task.assignees,
          parentId: task.parentId,
          campaignId: body.campaignId !== undefined ? body.campaignId : task.campaignId,
          taskType: body.taskType != null ? body.taskType : task.taskType,
          taskKind: body.taskKind != null ? body.taskKind : task.taskKind,
          hours: body.hours !== undefined ? body.hours : task.hours,
          support: body.support != null ? body.support : task.support,
          signW: body.signW !== undefined ? body.signW : task.signW,
          signH: body.signH !== undefined ? body.signH : task.signH,
          signQty: body.signQty !== undefined ? body.signQty : task.signQty,
          signBranch: body.signBranch !== undefined ? body.signBranch : task.signBranch,
        };
        const parsed = cleanTask(merged, sets.kpiIds, sets.staffIds, sets.campaignIds);
        if (parsed.error) return json({ error: parsed.error }, 400);
        const v = parsed.value;
        /* เลื่อนกำหนดส่ง = เรื่องใหญ่ ต้องมีร่องรอยว่าใครเลื่อน จากวันไหนไปวันไหน เพราะอะไร
           (งานที่ยังไม่เคยมีวันแล้วเพิ่งใส่ ไม่นับว่าเลื่อน) */
        const moved = !!(task.dueAt && v.dueAt && new Date(task.dueAt).getTime() !== new Date(v.dueAt).getTime());
        const stmts = [
          db.prepare(
            "UPDATE tasks SET title=?,detail=?,kpi_id=?,status=?,due_at=?,repeat=?,repeat_days=?,priority=?,updated_at=?,done_at=?,campaign_id=?,task_type=?,task_kind=?,hours=?,support=?,due_original=?,postpones=?,sign_w=?,sign_h=?,sign_qty=?,sign_branch=? WHERE id=?"
          ).bind(v.title, v.detail, v.kpiId, v.status, v.dueAt, v.repeat, v.repeatDays, v.priority, now,
                 v.status === "done" ? (task.doneAt || now) : null, v.campaignId, v.taskType,
                 v.taskKind, v.hours, v.support, task.dueOriginal || v.dueAt, moved ? (task.postpones || 0) + 1 : (task.postpones || 0),
                 v.signW, v.signH, v.signQty, v.signBranch, id),
          db.prepare("DELETE FROM task_assignees WHERE task_id = ?").bind(id),
        ];
        if (moved) {
          stmts.push(db.prepare(
            "INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)"
          ).bind(newId("u_"), id, me.id, "note",
                 "เลื่อนกำหนดส่ง " + thDate(task.dueAt) + " → " + thDate(v.dueAt) +
                 (body.reason ? " · " + String(body.reason).trim().slice(0, 300) : ""), null, now));
        }
        for (const sid of v.assignees) {
          stmts.push(db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, staff_id) VALUES (?,?)").bind(id, sid));
        }
        if (v.status !== task.status) {
          stmts.push(db.prepare(
            "INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)"
          ).bind(newId("u_"), id, me.id, "status", "", v.status, now));
          /* หัวหน้ากดเสร็จเอง = ตรวจผ่านในตัว · ส่งรอตรวจก็จับเวลาไว้ */
          const st = stampsFor(v.status, task, now, me.id);
          stmts.push(db.prepare("UPDATE tasks SET submitted_at=?, approved_at=?, approved_by=? WHERE id=?")
            .bind(st.submitted, st.approvedAt, st.approvedBy, id));
        }
        await db.batch(stmts);
        /* งานป้ายหลักเลื่อนวันติดตั้ง → คำนวณวันคาดว่าเสร็จของทุกขั้นใหม่ (เฉพาะขั้นที่ยังไม่ปิด)
           กลายเป็นป้ายทีหลัง → สร้าง 6 ขั้นให้ */
        if (!task.parentId) {
          const fl2 = await flowFor(db, v.taskType);
          if (fl2.length && v.taskType !== task.taskType) await ensureSignStages(db, id, me.id, now);
          else if (fl2.length && moved && v.dueAt) {
            const dues = stageDueDates(v.dueAt, {}, fl2);
            const kids = await db.prepare("SELECT id, stage, status FROM tasks WHERE parent_id = ? AND stage IS NOT NULL").bind(id).all();
            const fix = [];
            for (const k of (kids.results || [])) {
              if (k.status === "done" || !dues[k.stage]) continue;
              fix.push(db.prepare("UPDATE tasks SET due_at=?, updated_at=? WHERE id=?").bind(dues[k.stage], now, k.id));
            }
            if (fix.length) await db.batch(fix);
          }
        }
        await logChange(db, { by: me.id, entity: "task", entityId: id, action: "update", title: v.title, before: auditBefore, after: await snapTask(db, id), at: now });
        return json({ ok: true });
      }
      /* ผู้รับงาน (หรือคนที่ได้สิทธิ์ติ๊กแทนคนอื่น): เปลี่ยนได้แค่สถานะ
         กับ "ใส่กำหนดส่งให้งานที่ยังไม่เคยมีวัน" ซึ่งพิซซ่าขอไว้ —
         งานที่มีวันแล้วยังเลื่อนเองไม่ได้ ต้องให้หัวหน้าเลื่อน */
      /* เปลี่ยนคนรับอย่างเดียว ทำได้ทุกคนในทีม (นนท์ 20 ก.ย. 69) · แตะสถานะ/วัน ต้องเป็นคนรับงานหรือมีสิทธิ์อัปเดตแทน */
      const onlyAssign = Array.isArray(body.assignees) && body.status === undefined && body.dueAt === undefined;
      if (!mine && !canUpdateOthers && !onlyAssign) return json({ error: "งานนี้ไม่ได้มอบหมายให้คุณ" }, 403);
      /* เปลี่ยนคนรับผิดชอบ — ทุกคนในทีมทำได้ บันทึกไว้ในไทม์ไลน์ว่าใครเปลี่ยนจากใครเป็นใคร */
      let assignStmts = null;
      if (Array.isArray(body.assignees)) {
        const sets0 = await loadIdSets(db);
        const want0 = Array.from(new Set(body.assignees.map(String).filter((x) => sets0.staffIds.has(x)))).slice(0, 20);
        const same0 = want0.length === task.assignees.length && want0.every((x) => task.assignees.indexOf(x) !== -1);
        if (!same0) {
          const nameOf = async (ids) => {
            if (!ids.length) return "ยังไม่มอบหมาย";
            const r = await db.prepare("SELECT name FROM staff WHERE id IN (" + ids.map(() => "?").join(",") + ")").bind(...ids).all();
            return (r.results || []).map((x) => String(x.name).split(/\s+/)[0]).join(", ");
          };
          const before0 = await nameOf(task.assignees), after0 = await nameOf(want0);
          assignStmts = [db.prepare("DELETE FROM task_assignees WHERE task_id = ?").bind(id)];
          for (const sid of want0) assignStmts.push(db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, staff_id) VALUES (?,?)").bind(id, sid));
          assignStmts.push(db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
            .bind(newId("u_"), id, me.id, "note", "เปลี่ยนคนรับผิดชอบ: " + before0 + " → " + after0, null, now));
          const tell0 = new Set(want0.filter((x) => task.assignees.indexOf(x) === -1));
          const ow0 = await db.prepare("SELECT id FROM staff WHERE role = 'owner' AND active = 1").all();
          for (const o of (ow0.results || [])) tell0.add(o.id);
          if (task.createdBy) tell0.add(task.createdBy);
          tell0.delete(me.id);
          for (const sid of tell0) {
            assignStmts.push(db.prepare("INSERT INTO task_mentions (id,task_id,update_id,staff_id,by_staff,note,created_at) VALUES (?,?,?,?,?,?,?)")
              .bind(newId("m_"), id, "", sid, me.id, ("เปลี่ยนคนรับผิดชอบเป็น " + after0 + ": " + String(task.title)).slice(0, 300), now));
          }
          assignStmts.push(db.prepare("UPDATE tasks SET updated_at=? WHERE id=?").bind(now, id));
        }
      }
      /* ใส่วันให้งานที่ยังไม่เคยมี = ทำได้ทุกคนที่แตะงานนี้ได้
         เลื่อนวันที่มีอยู่แล้ว = ต้องมีสิทธิ์ can_reschedule และถูกบันทึกว่าเลื่อนจากวันไหน */
      const wantDue = body.dueAt !== undefined && body.dueAt;
      const backfill = wantDue && !task.dueAt;
      const moveIt = wantDue && !!task.dueAt && canReschedule;
      if (wantDue && !isIsoDateTime(body.dueAt)) return json({ error: "กำหนดส่งไม่ถูกต้อง" }, 400);
      if (wantDue && task.dueAt && !canReschedule) {
        return json({ error: "เลื่อนกำหนดส่งเองไม่ได้ — กด “ขอเลื่อน” เพื่อส่งให้หัวหน้าอนุมัติ" }, 403);
      }
      const want = STATUSES.indexOf(body.status) !== -1 ? body.status : null;
      if (!want && !backfill && !moveIt && !assignStmts) return json({ error: "สถานะไม่ถูกต้อง" }, 400);
      if (want && (want === "done" || want === "review") && task.stage && await stageNeedsPic(db, task)) {
        const pic = await db.prepare("SELECT COUNT(*) AS n FROM task_files WHERE task_id = ?").bind(id).first();
        if (!pic || !pic.n) return json({ error: "ปิดขั้น “" + ((stageDef(await flowFor(db, task.taskType), task.stage) || {}).th || task.stage) + "” ต้องแนบรูปยืนยันก่อน — เข้าไปในงานแล้วแนบรูปพร้อมกดส่ง" }, 400);
      }
      const stmts2 = [];
      if (assignStmts) stmts2.push(...assignStmts);
      if (backfill || moveIt) {
        const iso = new Date(body.dueAt).toISOString();
        const same = task.dueAt && new Date(task.dueAt).getTime() === new Date(iso).getTime();
        stmts2.push(db.prepare(
          "UPDATE tasks SET due_at=?, due_original=?, postpones=?, updated_at=? WHERE id=?"
        ).bind(iso, task.dueOriginal || iso, (task.postpones || 0) + (moveIt && !same ? 1 : 0), now, id));
        if (!same) {
          stmts2.push(db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
            .bind(newId("u_"), id, me.id, "note",
                  moveIt ? ("เลื่อนกำหนดส่ง " + thDate(task.dueAt) + " → " + thDate(iso) +
                            (body.reason ? " · " + String(body.reason).trim().slice(0, 300) : ""))
                         : ("ใส่กำหนดส่ง " + thDate(iso)), null, now));
        }
      }
      if (want) {
        /* ต้องใช้ isOwner ชุดเดียวกับที่ตอบกลับหน้าเว็บด้านล่าง ไม่งั้น DB เก็บ "รอตรวจ"
           แต่หน้าเว็บโชว์ "เสร็จแล้ว" (ของเดิมฮาร์ดโค้ด false ไว้ หัวหน้าลากการ์ดไปช่องเสร็จก็ยังเด้งเป็นรอตรวจ) */
        const status = statusFor(want, task, isOwner);
        const st = stampsFor(status, task, now, me.id);
        stmts2.push(db.prepare("UPDATE tasks SET status=?, updated_at=?, done_at=?, submitted_at=?, approved_at=?, approved_by=? WHERE id=?")
          .bind(status, now, st.doneAt, st.submitted, st.approvedAt, st.approvedBy, id));
        stmts2.push(db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(newId("u_"), id, me.id, "status", mine ? "" : "อัปเดตแทน", status, now));
        /* น้องเปลี่ยนสถานะอะไรก็ตาม → เด้งหาหัวหน้าทุกคน + คนสั่งงาน (นนท์ต้องเห็นทุกอัปเดต) */
        if (status !== task.status) {
          const owners = await db.prepare("SELECT id FROM staff WHERE role = 'owner' AND active = 1").all();
          const tell2 = new Set((owners.results || []).map((o) => o.id));
          if (task.createdBy) tell2.add(task.createdBy);
          tell2.delete(me.id);
          const what2 = status === "review" ? "ส่งงานให้ตรวจ" : "เปลี่ยนเป็น " + (STATUS_TH[status] || status);
          for (const sid of tell2) {
            stmts2.push(db.prepare(
              "INSERT INTO task_mentions (id,task_id,update_id,staff_id,by_staff,note,created_at) VALUES (?,?,?,?,?,?,?)"
            ).bind(newId("m_"), id, "", sid, me.id, (what2 + ": " + String(task.title)).slice(0, 300), now));
          }
        }
      }
      await db.batch(stmts2);
      if (want && statusFor(want, task, isOwner) === "review" && task.status !== "review") {
        pingReview(ctx, env, db, [{ title: task.title, by: me.name, id }]);
      }
      await logChange(db, { by: me.id, entity: "task", entityId: id, action: "update", title: task.title, before: auditBefore, after: await snapTask(db, id), at: now });
      return json({ ok: true, status: want ? statusFor(want, task, isOwner) : task.status });
    }

    if (!sub && method === "DELETE") {
      /* หัวหน้า หรือคนที่สร้างงานนั้นเอง (น้องเพิ่มงานย่อยเองแล้วต้องลบเองได้) */
      if (!(isOwner || task.createdBy === me.id)) return json({ error: "ลบได้เฉพาะหัวหน้าหรือคนที่สร้างงานนี้" }, 403);
      /* ลบงานหลัก = ลบงานย่อยของมันด้วย ไม่งั้นงานย่อยลอยหาพ่อแม่ไม่เจอ */
      const kids = await db.prepare("SELECT id FROM tasks WHERE parent_id = ?").bind(id).all();
      const ids = [id].concat((kids.results || []).map((r) => r.id));
      const auditDel = await snapTask(db, id);
      const auditKids = [];
      for (const kid of ids.slice(1)) { const k = await snapTask(db, kid); if (k) auditKids.push(k); }
      const stmts = [];
      for (const tid of ids) {
        stmts.push(db.prepare("DELETE FROM task_files WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM task_updates WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM task_assignees WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM task_mentions WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM tasks WHERE id = ?").bind(tid));
      }
      await db.batch(stmts);
      if (auditDel) { auditDel.__kids = auditKids; await logChange(db, { by: me.id, entity: "task", entityId: id, action: "delete", title: auditDel.title, before: auditDel, summary: "ลบงาน" + (auditKids.length ? " + งานย่อย " + auditKids.length : "") }); }
      return json({ ok: true, deleted: ids.length });
    }

    if (sub === "/updates" && method === "POST") {
      const body = await readBody(request);
      const note = String(body.note || "").trim().slice(0, 4000);
      const status = STATUSES.indexOf(body.status) !== -1 ? body.status : null;
      const files = Array.isArray(body.files) ? body.files.slice(0, MAX_FILES_PER_UPDATE) : [];
      const links = Array.isArray(body.links) ? body.links.slice(0, MAX_LINKS_PER_UPDATE) : [];
      if (!note && !status && !files.length && !links.length) return json({ error: "ยังไม่ได้ใส่อะไรเลย" }, 400);
      const canApprove = isOwner || task.createdBy === me.id;
      if (status && !(canApprove || mine || canUpdateOthers)) {
        return json({ error: "เปลี่ยนสถานะได้เฉพาะคนที่รับงานหรือหัวหน้า" }, 403);
      }
      /* น้องกด "เสร็จแล้ว" = ส่งรอตรวจ ทุกงานรวมงานประจำ */
      const newStatus = status ? statusFor(status, task, isOwner) : null;
      /* ขั้นของงานป้าย: ปิดโดยไม่มีรูปไม่ได้ (นับรูปที่แนบมารอบนี้ + ที่มีอยู่แล้ว) */
      if (newStatus && (newStatus === "done" || newStatus === "review") && task.stage && !files.length && await stageNeedsPic(db, task)) {
        const pic = await db.prepare("SELECT COUNT(*) AS n FROM task_files WHERE task_id = ? AND kind = 'file'").bind(id).first();
        if (!pic || !pic.n) return json({ error: "ปิดขั้น “" + ((stageDef(await flowFor(db, task.taskType), task.stage) || {}).th || task.stage) + "” ต้องแนบรูปยืนยันในรอบเดียวกัน" }, 400);
      }
      const now = nowIso();
      const uid = newId("u_");
      const stmts = [
        db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(uid, id, me.id, (files.length || links.length) ? "photo" : (status ? "status" : "note"), note, newStatus, now),
      ];
      const fileIds = [];
      for (const f of files) {
        const parsed = parseDataUrl(f && f.dataUrl, f && f.fileName);
        if (parsed.error) return json({ error: parsed.error }, 400);
        const fid = newId("f_");
        fileIds.push(fid);
        stmts.push(db.prepare(
          "INSERT INTO task_files (id,task_id,update_id,file_name,mime,bytes,data,created_at,kind) VALUES (?,?,?,?,?,?,?,?,'file')"
        ).bind(fid, id, uid, String((f && f.fileName) || "file").slice(0, 160), parsed.mime, parsed.bytes, parsed.b64, now));
      }
      for (const l of links) {
        const parsed = cleanLink(l);
        if (parsed.error) return json({ error: parsed.error }, 400);
        const fid = newId("l_");
        fileIds.push(fid);
        stmts.push(db.prepare(
          "INSERT INTO task_files (id,task_id,update_id,file_name,mime,bytes,data,created_at,kind,url,title) " +
          "VALUES (?,?,?,?,?,?,?,?,'link',?,?)"
        ).bind(fid, id, uid, parsed.host, "text/uri-list", 0, "", now, parsed.url, parsed.title));
      }
      /* ใครต้องรู้: คนที่ถูก @ชื่อ + หัวหน้าทุกคน + คนสั่งงาน (ถ้าคนอัปเดตไม่ใช่หัวหน้า)
         นนท์ต้องเห็นทุกอัปเดตของน้อง ไม่ใช่รอให้น้องนึกได้ว่าต้อง @ (18 ก.ย. 69) */
      const tell = new Set();
      if (note) {
        const all = await db.prepare("SELECT id,name,aliases FROM staff WHERE active = 1").all();
        for (const sid of findMentions(note, all.results || [], me.id)) tell.add(sid);
      }
      /* ใครก็ตามที่ไม่ใช่หัวหน้าแตะงาน → หัวหน้าต้องรู้ (เดิมคนสั่งงานอัปเดตเองแล้วเงียบ) */
      if (!isOwner) {
        const owners = await db.prepare("SELECT id FROM staff WHERE role = 'owner' AND active = 1").all();
        for (const o of (owners.results || [])) tell.add(o.id);
        if (task.createdBy) tell.add(task.createdBy);
      }
      tell.delete(me.id);
      const what = newStatus === "review" ? "ส่งงานให้ตรวจ"
        : (newStatus && newStatus !== task.status ? "เปลี่ยนเป็น " + (STATUS_TH[newStatus] || newStatus)
        : ((files.length || links.length) ? "แนบไฟล์" : "อัปเดต"));
      for (const sid of tell) {
        stmts.push(db.prepare(
          "INSERT INTO task_mentions (id,task_id,update_id,staff_id,by_staff,note,created_at) VALUES (?,?,?,?,?,?,?)"
        ).bind(newId("m_"), id, uid, sid, me.id, (what + ": " + (note || task.title)).slice(0, 300), now));
      }

      /* งานประจำกดเสร็จซ้ำได้ทุกวัน — ต้องเขียน done_at ใหม่ ไม่งั้นหน้าเว็บนึกว่ายังเป็นรอบเก่า */
      if (newStatus && (newStatus !== task.status || (task.repeat && newStatus === "done"))) {
        const st = stampsFor(newStatus, task, now, me.id);
        stmts.push(db.prepare("UPDATE tasks SET status=?, updated_at=?, done_at=?, submitted_at=?, approved_at=?, approved_by=? WHERE id=?")
          .bind(newStatus, now, st.doneAt, st.submitted, st.approvedAt, st.approvedBy, id));
      } else {
        stmts.push(db.prepare("UPDATE tasks SET updated_at=? WHERE id=?").bind(now, id));
      }
      await db.batch(stmts);
      if (newStatus === "review" && task.status !== "review") {
        pingReview(ctx, env, db, [{ title: task.title, by: me.name, id }]);
      }
      return json({ id: uid, fileIds, status: newStatus || task.status });
    }

    /* ---- ตรวจงาน: หัวหน้ากดผ่าน / ส่งกลับแก้ (คนสั่งงานตรวจแทนไม่ได้แล้ว) ---- */
    if (sub === "/review" && method === "POST") {
      if (!isOwner) return json({ error: "ตรวจผ่านได้เฉพาะหัวหน้า" }, 403);
      const body = await readBody(request);
      const pass = body.pass !== false;
      const note = String(body.note || "").trim().slice(0, 2000);
      if (!pass && !note) return json({ error: "ส่งกลับแก้ต้องบอกด้วยว่าให้แก้อะไร" }, 400);
      const now = nowIso();
      const uid = newId("u_");
      const status = pass ? "done" : "doing";
      const stmts = [
        db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(uid, id, me.id, "status", note || (pass ? "ตรวจผ่านแล้ว" : ""), status, now),
        /* งานที่ "ปิดไปแล้วแต่ยังไม่มีใครตรวจ" ถูกกดผ่านย้อนหลังได้ (โหมดปัดตรวจ #/review)
           เวลาที่ปิดงานต้องเป็นของเดิม ไม่ใช่เวลาที่หัวหน้าเพิ่งมากดผ่าน ไม่งั้นรายงานรายเดือนเพี้ยน
           งานที่ส่งมาตามปกติ (สถานะ review) done_at ยังว่าง ค่าที่ได้จึงเท่ากับ now เหมือนเดิม */
        db.prepare("UPDATE tasks SET status=?, updated_at=?, done_at=?, approved_at=?, approved_by=? WHERE id=?")
          .bind(status, now, pass ? (task.doneAt || now) : null, pass ? now : null, pass ? me.id : null, id),
      ];
      /* ขั้นของงานป้ายผ่านแล้ว → บันทึกขั้นล่าสุดไว้ที่งานหลัก จะได้เห็นในหน้ารายการโดยไม่ต้องโหลดงานย่อย */
      if (pass && task.stage && task.parentId) {
        const par = await db.prepare("SELECT stage FROM tasks WHERE id = ?").bind(task.parentId).first();
        const fl3 = await flowFor(db, task.taskType);
        const cur = par ? stageIdx(fl3, par.stage) : -1;
        if (stageIdx(fl3, task.stage) > cur) {
          stmts.push(db.prepare("UPDATE tasks SET stage=?, updated_at=? WHERE id=?").bind(task.stage, now, task.parentId));
        }
      }
      /* บอกคนรับงานทุกคนว่าผ่านแล้วหรือต้องแก้ */
      for (const sid of task.assignees) {
        if (sid === me.id) continue;
        stmts.push(db.prepare(
          "INSERT INTO task_mentions (id,task_id,update_id,staff_id,by_staff,note,created_at) VALUES (?,?,?,?,?,?,?)"
        ).bind(newId("m_"), id, uid, sid, me.id,
               (pass ? "ตรวจผ่านแล้ว: " : "ส่งกลับแก้: ") + (note || String(task.title)).slice(0, 200), now));
      }
      await db.batch(stmts);
      return json({ ok: true, status });
    }

    /* ---- สร้าง 6 ขั้นให้งานป้ายที่ยังไม่มี (งานเก่าก่อนมีระบบนี้) ---- */
    if (sub === "/stages" && method === "POST") {
      if (!(isOwner || task.createdBy === me.id || mine)) return json({ error: "ไม่มีสิทธิ์" }, 403);
      if (task.parentId) return json({ error: "งานย่อยไม่มีขั้นงานของตัวเอง" }, 400);
      if (!(await flowFor(db, task.taskType)).length) return json({ error: "ประเภทนี้ยังไม่ได้ตั้งขั้นงาน — ตั้งได้ที่บอร์ด › ตั้งค่าขั้นงาน" }, 400);
      const r = await ensureSignStages(db, id, me.id, nowIso());
      return json({ ok: true, created: r.created });
    }

    /* ---- ขอเลื่อนกำหนดส่ง: น้องขอ → เด้งหาหัวหน้า (เลื่อนจริงได้เฉพาะหัวหน้า) ---- */
    if (sub === "/postpone-request" && method === "POST") {
      if (!mine && !canUpdateOthers) return json({ error: "งานนี้ไม่ได้มอบหมายให้คุณ" }, 403);
      const body = await readBody(request);
      const reason = String(body.reason || "").trim().slice(0, 1000);
      if (!reason) return json({ error: "บอกเหตุผลที่ขอเลื่อนด้วย" }, 400);
      const want = body.wantDate && isIsoDateTime(body.wantDate) ? new Date(body.wantDate).toISOString() : null;
      const now = nowIso();
      const uid = newId("u_");
      const msg = "ขอเลื่อนกำหนดส่ง" + (want ? " เป็น " + thDate(want) : "") + " · " + reason;
      const stmts = [
        db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(uid, id, me.id, "note", msg, null, now),
        db.prepare("UPDATE tasks SET updated_at=? WHERE id=?").bind(now, id),
      ];
      const owners = await db.prepare("SELECT id FROM staff WHERE role = 'owner' AND active = 1").all();
      const tell = new Set((owners.results || []).map((o) => o.id));
      if (task.createdBy) tell.add(task.createdBy);
      for (const sid of tell) {
        if (sid === me.id) continue;
        stmts.push(db.prepare(
          "INSERT INTO task_mentions (id,task_id,update_id,staff_id,by_staff,note,created_at) VALUES (?,?,?,?,?,?,?)"
        ).bind(newId("m_"), id, uid, sid, me.id, msg.slice(0, 300), now));
      }
      await db.batch(stmts);
      return json({ ok: true });
    }
  }

  /* --- รูปแนบ --- */
  const fileMatch = path.match(/^\/files\/([A-Za-z0-9_-]{1,40})$/);
  if (fileMatch && method === "GET") {
    const row = await db.prepare("SELECT mime, data, file_name, kind, url FROM task_files WHERE id = ?").bind(fileMatch[1]).first();
    if (!row) return new Response("ไม่พบไฟล์", { status: 404 });
    if (row.kind === "link") return Response.redirect(row.url, 302);
    const binary = atob(row.data);
    const bin = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bin[i] = binary.charCodeAt(i);
    const mime = row.mime || "application/octet-stream";
    /* รูปกับวิดีโอเปิดดูในเบราว์เซอร์ได้เลย · อย่างอื่นให้เซฟลง โดยคงชื่อไฟล์เดิม
       ไฟล์ที่ทีมอัปมาไม่ควรถูกเบราว์เซอร์รันเป็น HTML — บังคับ inline เฉพาะชนิดที่ปลอดภัย */
    const viewable = /^(image|video|audio)\//.test(mime) || mime === "application/pdf";
    const safeName = String(row.file_name || "file").replace(/[^\w.\-ก-๙ ]+/g, "_").slice(0, 120);
    return new Response(bin, {
      headers: {
        "content-type": viewable ? mime : "application/octet-stream",
        "content-disposition": (viewable ? "inline" : "attachment") + '; filename="' + safeName + '"',
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (fileMatch && method === "DELETE") {
    const row = await db.prepare("SELECT id, update_id FROM task_files WHERE id = ?").bind(fileMatch[1]).first();
    if (!row) return json({ error: "ไม่พบรูป" }, 404);
    if (!isOwner) {
      const up = await db.prepare("SELECT staff_id FROM task_updates WHERE id = ?").bind(row.update_id || "").first();
      if (!up || up.staff_id !== me.id) return json({ error: "ลบได้เฉพาะรูปที่ตัวเองอัปโหลด" }, 403);
    }
    await db.prepare("DELETE FROM task_files WHERE id = ?").bind(row.id).run();
    return json({ ok: true });
  }

  return json({ error: "ไม่พบ endpoint นี้" }, 404);
}
