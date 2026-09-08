// KAN — ระบบมอบหมายงานทีม (Task) · API ที่ /api/t/*
//  - เก็บทุกอย่างใน D1 `kan-erp` (ตารางขึ้นต้น task_* / staff / kpis) — สร้างตารางให้เองครั้งแรกที่ถูกเรียก
//  - ล็อกอินด้วยชื่อ + PIN → cookie เซ็นด้วย HMAC (secret สุ่มเก็บใน D1 ไม่ต้องตั้ง wrangler secret)
//  - รูปแนบเก็บ base64 ใน D1 แบบเดียวกับปฏิทินแคมเปญ (ย่อฝั่งเบราว์เซอร์ก่อน)

const COOKIE = "kan_tsess";
const SESSION_DAYS = 30;
const STATUSES = ["todo", "doing", "done", "blocked"];
const REPEATS = ["", "daily", "weekly"];
const MAX_FILE_BYTES = 1200000; // ~1.2MB ต่อรูป (หลังย่อแล้ว)
const MAX_FILES_PER_UPDATE = 6;
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
  /* กันเดา PIN — หน้า /admin ยังเปิดสาธารณะ PIN 4 หลักเดาหมดได้ใน 10,000 ครั้ง */
  "CREATE TABLE IF NOT EXISTS task_logins (" +
    "staff_id TEXT PRIMARY KEY, fails INTEGER NOT NULL DEFAULT 0, locked_until TEXT)",
  /* แท็กคนในคอมเมนต์ → กระดิ่งแจ้งเตือนของคนนั้น */
  "CREATE TABLE IF NOT EXISTS task_mentions (" +
    "id TEXT PRIMARY KEY, task_id TEXT NOT NULL, update_id TEXT NOT NULL, staff_id TEXT NOT NULL, " +
    "by_staff TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, read_at TEXT)",
  "CREATE INDEX IF NOT EXISTS idx_task_mentions_staff ON task_mentions(staff_id, read_at)",
];

/* คอลัมน์ที่เพิ่มทีหลัง — ตารางมีข้อมูลจริงแล้ว CREATE TABLE IF NOT EXISTS ไม่เติมให้
   รันซ้ำจะได้ error "duplicate column" ซึ่งกลืนทิ้งได้ */
const ALTERS = [
  "ALTER TABLE tasks ADD COLUMN parent_id TEXT",
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

/* ทีมเริ่มต้น — PIN แรกคือ 1234 ทุกคน เปลี่ยนได้ในหน้า "ทีม + PIN" */
const STAFF_SEED = [
  { id: "s_nont", name: "Nont Chawan", aliases: "Nont,นนท์,Chawan", role: "owner" },
  { id: "s_julalak", name: "Julalak Krongkheaw", aliases: "Julalak,Krongkheaw", role: "member" },
  { id: "s_title", name: "Title Thitima S.", aliases: "Title,Thitima", role: "member" },
];
const SEED_PIN = "1234";

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
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
function newId(prefix) {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
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
function validPin(pin) {
  return typeof pin === "string" && /^\d{4,8}$/.test(pin);
}
async function readBody(request) {
  return request.json().catch(() => ({}));
}

/* ---------- schema bootstrap (ครั้งเดียวต่อ isolate) ---------- */
let schemaReady = null;
async function ensureSchema(db) {
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
      const s = await db.prepare("SELECT COUNT(*) AS n FROM staff").first();
      if (!s || !s.n) {
        const stmts = [];
        for (const r of STAFF_SEED) {
          const salt = randHex(8);
          const hash = await sha256Hex(salt + ":" + SEED_PIN);
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
  const tok = getCookie(request, COOKIE);
  if (!tok) return null;
  const parts = tok.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  if (!(Number(exp) > Date.now())) return null;
  const expect = await hmacHex(await sessionSecret(db), id + "." + exp);
  if (expect !== sig) return null;
  const row = await db.prepare("SELECT id,name,aliases,role,active FROM staff WHERE id = ?").bind(id).first();
  if (!row || !row.active) return null;
  return row;
}
function publicStaff(r) {
  return { id: r.id, name: r.name, aliases: r.aliases || "", role: r.role, active: !!r.active };
}

/* ---------- rows → JSON ---------- */
function rowToTask(r) {
  return {
    id: r.id,
    title: r.title,
    detail: r.detail || "",
    kpiId: r.kpi_id || null,
    status: r.status,
    dueAt: r.due_at || null,
    repeat: r.repeat || "",
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
function cleanTask(input, kpiIds, staffIds) {
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
  const priority = input.priority ? 1 : 0;
  const assignees = Array.isArray(input.assignees)
    ? Array.from(new Set(input.assignees.filter((id) => staffIds.has(id)))).slice(0, 20)
    : [];
  const parentId = input.parentId ? String(input.parentId).slice(0, 40) : null;
  return { value: { title, detail, kpiId, status, dueAt, repeat, priority, assignees, parentId } };
}

async function loadIdSets(db) {
  const k = await db.prepare("SELECT id FROM kpis").all();
  const s = await db.prepare("SELECT id FROM staff WHERE active = 1").all();
  return {
    kpiIds: new Set((k.results || []).map((r) => r.id)),
    staffIds: new Set((s.results || []).map((r) => r.id)),
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

function parseDataUrl(dataUrl) {
  const m = String(dataUrl || "").match(/^data:([\w/+.-]+);base64,(.+)$/);
  if (!m) return { error: "ไฟล์ไม่ถูกต้อง" };
  const mime = m[1];
  const b64 = m[2];
  if (mime.indexOf("image/") !== 0) return { error: "รับเฉพาะไฟล์รูป" };
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > MAX_FILE_BYTES) return { error: "รูปใหญ่เกินไป (เกิน 1.2MB หลังย่อ)" };
  return { mime, b64, bytes };
}

/* ---------- main router ---------- */
export async function handleTaskApi(request, env, url, path, method) {
  const db = env.KAN_ERP;
  if (!db) return json({ error: "ยังไม่ได้ผูกฐานข้อมูล" }, 503);
  await ensureSchema(db);

  /* --- public: รายชื่อสำหรับหน้าล็อกอิน --- */
  if (path === "/login" && method === "GET") {
    const res = await db.prepare("SELECT id,name,role FROM staff WHERE active = 1 ORDER BY role = 'owner' DESC, name").all();
    return json({ staff: (res.results || []).map((r) => ({ id: r.id, name: r.name, role: r.role })) });
  }

  if (path === "/login" && method === "POST") {
    const body = await readBody(request);
    const staffId = String(body.staffId || "");
    const pin = String(body.pin || "");
    const row = await db.prepare("SELECT * FROM staff WHERE id = ? AND active = 1").bind(staffId).first();
    if (!row) return json({ error: "ไม่พบชื่อนี้ในทีม" }, 401);

    /* ถูกล็อกอยู่หรือเปล่า — ล็อกรายคน ไม่ใช่ราย IP เพราะทีมอยู่หลังเน็ตร้านเดียวกัน */
    const gate = await db.prepare("SELECT fails, locked_until FROM task_logins WHERE staff_id = ?").bind(row.id).first();
    if (gate && gate.locked_until && Date.parse(gate.locked_until) > Date.now()) {
      const wait = Math.ceil((Date.parse(gate.locked_until) - Date.now()) / 60000);
      return json({ error: "ใส่ PIN ผิดหลายครั้ง ลองใหม่ในอีก " + wait + " นาที" }, 429);
    }

    const hash = await sha256Hex(row.pin_salt + ":" + pin);
    if (hash !== row.pin_hash) {
      const fails = ((gate && gate.fails) || 0) + 1;
      const lockedUntil = fails >= MAX_PIN_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null;
      await db.prepare(
        "INSERT INTO task_logins (staff_id, fails, locked_until) VALUES (?,?,?) " +
        "ON CONFLICT(staff_id) DO UPDATE SET fails = excluded.fails, locked_until = excluded.locked_until"
      ).bind(row.id, lockedUntil ? 0 : fails, lockedUntil).run();
      return json({
        error: lockedUntil
          ? "ใส่ PIN ผิด " + MAX_PIN_FAILS + " ครั้ง ล็อก " + LOCK_MINUTES + " นาที"
          : "PIN ไม่ถูกต้อง (เหลืออีก " + (MAX_PIN_FAILS - fails) + " ครั้ง)",
      }, lockedUntil ? 429 : 401);
    }

    if (gate) await db.prepare("DELETE FROM task_logins WHERE staff_id = ?").bind(row.id).run();
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

  if (path === "/me" && method === "GET") {
    const staff = await db.prepare("SELECT id,name,aliases,role,active FROM staff ORDER BY role = 'owner' DESC, name").all();
    const kpis = await db.prepare("SELECT * FROM kpis ORDER BY sort").all();
    return json({
      me: publicStaff(me),
      staff: (staff.results || []).map(publicStaff),
      kpis: (kpis.results || []),
    });
  }

  /* กระดิ่ง — คอมเมนต์ที่แท็กเรา */
  if (path === "/notifications" && method === "GET") {
    const res = await db.prepare(
      "SELECT m.id, m.task_id, m.note, m.created_at, m.read_at, m.by_staff, t.title " +
      "FROM task_mentions m LEFT JOIN tasks t ON t.id = m.task_id " +
      "WHERE m.staff_id = ? ORDER BY m.created_at DESC LIMIT 60"
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

  /* พื้นที่ที่รูปกินไปจริง — D1 เก็บ base64 ขนาดบนดิสก์จึงมากกว่าไฟล์ต้นฉบับราว 1.33 เท่า */
  if (path === "/storage" && method === "GET") {
    const f = await db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(bytes),0) AS b FROM task_files").first();
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

  if (path === "/me/pin" && method === "PUT") {
    const body = await readBody(request);
    if (!validPin(body.newPin)) return json({ error: "PIN ใหม่ต้องเป็นตัวเลข 4–8 หลัก" }, 400);
    const row = await db.prepare("SELECT pin_salt,pin_hash FROM staff WHERE id = ?").bind(me.id).first();
    const oldHash = await sha256Hex(row.pin_salt + ":" + String(body.pin || ""));
    if (oldHash !== row.pin_hash) return json({ error: "PIN เดิมไม่ถูกต้อง" }, 400);
    const salt = randHex(8);
    const hash = await sha256Hex(salt + ":" + body.newPin);
    await db.batch([
      db.prepare("UPDATE staff SET pin_salt = ?, pin_hash = ? WHERE id = ?").bind(salt, hash, me.id),
      db.prepare("DELETE FROM task_logins WHERE staff_id = ?").bind(me.id),
    ]);
    return json({ ok: true });
  }

  /* --- ทีม --- */
  if (path === "/staff" && method === "POST") {
    if (!isOwner) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
    const body = await readBody(request);
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) return json({ error: "ต้องมีชื่อ" }, 400);
    if (!validPin(body.pin)) return json({ error: "PIN ต้องเป็นตัวเลข 4–8 หลัก" }, 400);
    const role = body.role === "owner" ? "owner" : "member";
    const aliases = String(body.aliases || "").trim().slice(0, 200);
    const id = newId("s_");
    const salt = randHex(8);
    const hash = await sha256Hex(salt + ":" + body.pin);
    await db.prepare(
      "INSERT INTO staff (id,name,aliases,role,pin_salt,pin_hash,active,created_at) VALUES (?,?,?,?,?,?,1,?)"
    ).bind(id, name, aliases, role, salt, hash, nowIso()).run();
    return json({ id });
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
    if (body.role != null) {
      if (id === me.id && body.role !== "owner") return json({ error: "ลดสิทธิ์ตัวเองไม่ได้" }, 400);
      sets.push("role = ?"); vals.push(body.role === "owner" ? "owner" : "member");
    }
    if (body.active != null) {
      if (id === me.id && !body.active) return json({ error: "ปิดบัญชีตัวเองไม่ได้" }, 400);
      sets.push("active = ?"); vals.push(body.active ? 1 : 0);
    }
    if (body.pin != null) {
      if (!validPin(body.pin)) return json({ error: "PIN ต้องเป็นตัวเลข 4–8 หลัก" }, 400);
      const salt = randHex(8);
      sets.push("pin_salt = ?"); vals.push(salt);
      sets.push("pin_hash = ?"); vals.push(await sha256Hex(salt + ":" + body.pin));
    }
    if (!sets.length) return json({ error: "ไม่มีอะไรให้แก้" }, 400);
    vals.push(id);
    await db.batch([
      db.prepare("UPDATE staff SET " + sets.join(", ") + " WHERE id = ?").bind(...vals),
      /* หัวหน้าตั้ง PIN ใหม่ให้ = ปลดล็อกที่ค้างจากการใส่ผิดด้วย */
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
    const now = nowIso();
    for (const input of list) {
      const parsed = cleanTask(input, sets.kpiIds, sets.staffIds);
      if (parsed.error) return json({ error: parsed.error }, 400);
      const v = parsed.value;
      const id = newId("t_");
      ids.push(id);
      stmts.push(db.prepare(
        "INSERT INTO tasks (id,title,detail,kpi_id,status,due_at,repeat,priority,created_by,created_at,updated_at,done_at,parent_id) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(id, v.title, v.detail, v.kpiId, v.status, v.dueAt, v.repeat, v.priority, me.id, now, now,
             v.status === "done" ? now : null, v.parentId));
      for (const sid of v.assignees) {
        stmts.push(db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, staff_id) VALUES (?,?)").bind(id, sid));
      }
      stmts.push(db.prepare(
        "INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)"
      ).bind(newId("u_"), id, me.id, "create", "", v.status, now));
    }
    await db.batch(stmts);
    return json({ ids });
  }

  const taskMatch = path.match(/^\/tasks\/([A-Za-z0-9_-]{1,40})(\/updates)?$/);
  if (taskMatch) {
    const id = taskMatch[1];
    const sub = taskMatch[2] || "";
    const row = await db.prepare(TASK_SELECT + "WHERE t.id = ?").bind(id).first();
    if (!row) return json({ error: "ไม่พบงานนี้" }, 404);
    const task = rowToTask(row);
    const mine = task.assignees.indexOf(me.id) !== -1;

    if (!sub && method === "GET") {
      const ups = await db.prepare(
        "SELECT id,staff_id,kind,note,status_to,created_at FROM task_updates WHERE task_id = ? ORDER BY created_at DESC"
      ).bind(id).all();
      const files = await db.prepare(
        "SELECT id,update_id,file_name,mime,bytes,created_at FROM task_files WHERE task_id = ? ORDER BY created_at ASC"
      ).bind(id).all();
      const subs = await db.prepare(TASK_SELECT + "WHERE t.parent_id = ?" + TASK_ORDER).bind(id).all();
      let parent = null;
      if (task.parentId) {
        const pr = await db.prepare("SELECT id, title FROM tasks WHERE id = ?").bind(task.parentId).first();
        if (pr) parent = { id: pr.id, title: pr.title };
      }
      return json({
        task,
        parent,
        subtasks: (subs.results || []).map(rowToTask),
        updates: (ups.results || []).map((u) => ({
          id: u.id, staffId: u.staff_id, kind: u.kind, note: u.note || "", statusTo: u.status_to || null, createdAt: u.created_at,
        })),
        files: (files.results || []).map((f) => ({
          id: f.id, updateId: f.update_id || null, fileName: f.file_name, mime: f.mime, bytes: f.bytes, createdAt: f.created_at,
        })),
      });
    }

    if (!sub && method === "PUT") {
      const body = await readBody(request);
      const now = nowIso();
      if (isOwner || task.createdBy === me.id) {
        const sets = await loadIdSets(db);
        const merged = {
          title: body.title != null ? body.title : task.title,
          detail: body.detail != null ? body.detail : task.detail,
          kpiId: body.kpiId !== undefined ? body.kpiId : task.kpiId,
          status: body.status != null ? body.status : task.status,
          dueAt: body.dueAt !== undefined ? body.dueAt : task.dueAt,
          repeat: body.repeat != null ? body.repeat : task.repeat,
          priority: body.priority != null ? body.priority : task.priority,
          assignees: body.assignees != null ? body.assignees : task.assignees,
        };
        const parsed = cleanTask(merged, sets.kpiIds, sets.staffIds);
        if (parsed.error) return json({ error: parsed.error }, 400);
        const v = parsed.value;
        const stmts = [
          db.prepare(
            "UPDATE tasks SET title=?,detail=?,kpi_id=?,status=?,due_at=?,repeat=?,priority=?,updated_at=?,done_at=? WHERE id=?"
          ).bind(v.title, v.detail, v.kpiId, v.status, v.dueAt, v.repeat, v.priority, now,
                 v.status === "done" ? (task.doneAt || now) : null, id),
          db.prepare("DELETE FROM task_assignees WHERE task_id = ?").bind(id),
        ];
        for (const sid of v.assignees) {
          stmts.push(db.prepare("INSERT OR IGNORE INTO task_assignees (task_id, staff_id) VALUES (?,?)").bind(id, sid));
        }
        if (v.status !== task.status) {
          stmts.push(db.prepare(
            "INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)"
          ).bind(newId("u_"), id, me.id, "status", "", v.status, now));
        }
        await db.batch(stmts);
        return json({ ok: true });
      }
      /* ผู้รับงาน: เปลี่ยนได้แค่สถานะ */
      if (!mine) return json({ error: "งานนี้ไม่ได้มอบหมายให้คุณ" }, 403);
      const status = STATUSES.indexOf(body.status) !== -1 ? body.status : null;
      if (!status) return json({ error: "สถานะไม่ถูกต้อง" }, 400);
      await db.batch([
        db.prepare("UPDATE tasks SET status=?, updated_at=?, done_at=? WHERE id=?")
          .bind(status, now, status === "done" ? (task.repeat || task.status !== "done" ? now : task.doneAt) : null, id),
        db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(newId("u_"), id, me.id, "status", "", status, now),
      ]);
      return json({ ok: true });
    }

    if (!sub && method === "DELETE") {
      if (!isOwner) return json({ error: "เฉพาะหัวหน้าทีม" }, 403);
      /* ลบงานหลัก = ลบงานย่อยของมันด้วย ไม่งั้นงานย่อยลอยหาพ่อแม่ไม่เจอ */
      const kids = await db.prepare("SELECT id FROM tasks WHERE parent_id = ?").bind(id).all();
      const ids = [id].concat((kids.results || []).map((r) => r.id));
      const stmts = [];
      for (const tid of ids) {
        stmts.push(db.prepare("DELETE FROM task_files WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM task_updates WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM task_assignees WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM task_mentions WHERE task_id = ?").bind(tid));
        stmts.push(db.prepare("DELETE FROM tasks WHERE id = ?").bind(tid));
      }
      await db.batch(stmts);
      return json({ ok: true, deleted: ids.length });
    }

    if (sub === "/updates" && method === "POST") {
      const body = await readBody(request);
      const note = String(body.note || "").trim().slice(0, 4000);
      const status = STATUSES.indexOf(body.status) !== -1 ? body.status : null;
      const files = Array.isArray(body.files) ? body.files.slice(0, MAX_FILES_PER_UPDATE) : [];
      if (!note && !status && !files.length) return json({ error: "ยังไม่ได้ใส่อะไรเลย" }, 400);
      if (status && !(isOwner || mine || task.createdBy === me.id)) {
        return json({ error: "เปลี่ยนสถานะได้เฉพาะคนที่รับงานหรือหัวหน้า" }, 403);
      }
      const now = nowIso();
      const uid = newId("u_");
      const stmts = [
        db.prepare("INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(uid, id, me.id, files.length ? "photo" : (status ? "status" : "note"), note, status, now),
      ];
      const fileIds = [];
      for (const f of files) {
        const parsed = parseDataUrl(f && f.dataUrl);
        if (parsed.error) return json({ error: parsed.error }, 400);
        const fid = newId("f_");
        fileIds.push(fid);
        stmts.push(db.prepare(
          "INSERT INTO task_files (id,task_id,update_id,file_name,mime,bytes,data,created_at) VALUES (?,?,?,?,?,?,?,?)"
        ).bind(fid, id, uid, String((f && f.fileName) || "photo.jpg").slice(0, 160), parsed.mime, parsed.bytes, parsed.b64, now));
      }
      /* @ชื่อ ในคอมเมนต์ → เข้ากระดิ่งของคนนั้น */
      if (note) {
        const all = await db.prepare("SELECT id,name,aliases FROM staff WHERE active = 1").all();
        for (const sid of findMentions(note, all.results || [], me.id)) {
          stmts.push(db.prepare(
            "INSERT INTO task_mentions (id,task_id,update_id,staff_id,by_staff,note,created_at) VALUES (?,?,?,?,?,?,?)"
          ).bind(newId("m_"), id, uid, sid, me.id, note.slice(0, 300), now));
        }
      }

      /* งานประจำกดเสร็จซ้ำได้ทุกวัน — ต้องเขียน done_at ใหม่ ไม่งั้นหน้าเว็บนึกว่ายังเป็นรอบเก่า */
      if (status && (status !== task.status || (task.repeat && status === "done"))) {
        stmts.push(db.prepare("UPDATE tasks SET status=?, updated_at=?, done_at=? WHERE id=?")
          .bind(status, now, status === "done" ? (task.repeat || task.status !== "done" ? now : task.doneAt) : null, id));
      } else {
        stmts.push(db.prepare("UPDATE tasks SET updated_at=? WHERE id=?").bind(now, id));
      }
      await db.batch(stmts);
      return json({ id: uid, fileIds });
    }
  }

  /* --- รูปแนบ --- */
  const fileMatch = path.match(/^\/files\/([A-Za-z0-9_-]{1,40})$/);
  if (fileMatch && method === "GET") {
    const row = await db.prepare("SELECT mime, data FROM task_files WHERE id = ?").bind(fileMatch[1]).first();
    if (!row) return new Response("ไม่พบรูป", { status: 404 });
    const binary = atob(row.data);
    const bin = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bin[i] = binary.charCodeAt(i);
    return new Response(bin, {
      headers: { "content-type": row.mime || "application/octet-stream", "cache-control": "private, max-age=86400" },
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
