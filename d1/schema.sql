-- KAN ERP — ฐานข้อมูลกลาง (D1)
-- ตอนนี้ใช้เก็บปฏิทินแคมเปญ + รูปแนบ

CREATE TABLE IF NOT EXISTS campaigns (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  start_date   TEXT NOT NULL,           -- ISO YYYY-MM-DD
  end_date     TEXT NOT NULL,
  scope        TEXT NOT NULL DEFAULT 'range',  -- 'range' = ช่วงวัน · 'month' = ทั้งเดือน
  status       TEXT NOT NULL DEFAULT 'plan',   -- plan | live | done
  channels     TEXT NOT NULL DEFAULT '[]',     -- JSON array
  branches     TEXT NOT NULL DEFAULT '[]',     -- JSON array
  budget       INTEGER NOT NULL DEFAULT 0,
  owner        TEXT NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_start ON campaigns(start_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_end   ON campaigns(end_date);

-- รูปแนบ เก็บเป็น base64 ใน D1 (ย่อฝั่งเบราว์เซอร์ก่อนส่ง)
-- ถ้าวันหลังเปิด R2 ค่อยย้าย data → key ของ bucket
CREATE TABLE IF NOT EXISTS attachments (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  mime         TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  data         TEXT NOT NULL,           -- base64 (ไม่มี prefix data:)
  created_at   TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_campaign ON attachments(campaign_id);

-- 26 ส.ค. 2569: สีประจำแคมเปญ (เลือกเองได้ในฟอร์ม)
-- ใช้ ALTER แยก เพราะตารางมีข้อมูลจริงแล้ว — รันซ้ำจะ error "duplicate column" ซึ่งไม่เป็นไร
-- ALTER TABLE campaigns ADD COLUMN color TEXT NOT NULL DEFAULT '#3370FF';

-- KPI ฝ่ายการตลาด — เก็บบนเซิร์ฟเวอร์แทน localStorage (26 ส.ค. 2569)
-- 1 แถว = 1 ตัวชี้วัด ต่อ 1 เดือน ต่อ 1 ปี
CREATE TABLE IF NOT EXISTS kpi_entries (
  year       INTEGER NOT NULL,
  month      INTEGER NOT NULL,        -- 0..11 ตรงกับ state.month เดิม
  code       TEXT    NOT NULL,        -- MKT-01 ...
  value      TEXT    NOT NULL DEFAULT '',
  status     TEXT    NOT NULL DEFAULT 'draft',   -- ok | draft | na
  updated_at TEXT    NOT NULL,
  PRIMARY KEY (year, month, code)
);


-- ============================================================
-- ระบบมอบหมายงานทีม (Task) — 8 ก.ย. 2569
-- ตารางชุดนี้ worker-tasks.js สร้างให้เอง (CREATE TABLE IF NOT EXISTS) ตอนมีคนเรียก /api/t/* ครั้งแรก
-- จึง "ไม่ต้อง" รัน wrangler d1 execute — ที่เขียนไว้ตรงนี้เพื่อให้อ่านโครงได้ที่เดียว
-- ============================================================
-- task_settings (key, value)                    : session_secret สุ่มครั้งแรก ใช้เซ็น cookie
-- staff (id, name, aliases, role, pin_salt, pin_hash, active, created_at)
--                                               : ทีม — role owner|member · aliases = คำที่พิมพ์หลัง @ ตอนสั่งงาน
-- kpis (id, sort, code, title, weight, target, keywords, color)
--                                               : KPI CMO 2570 จาก Executive Offer (6 ข้อ) · keywords ใช้เดาหมวด
-- tasks (id, title, detail, kpi_id, status, due_at, repeat, priority, created_by, created_at, updated_at, done_at)
--                                               : status todo|doing|done|blocked · repeat ''|daily|weekly · due_at ISO UTC
-- task_assignees (task_id, staff_id)            : งาน 1 ชิ้นมีคนรับได้หลายคน
-- task_updates (id, task_id, staff_id, kind, note, status_to, created_at)
--                                               : ไทม์ไลน์ — kind create|status|note|photo
-- task_files (id, task_id, update_id, file_name, mime, bytes, data, created_at)
--                                               : รูปแนบ base64 (ย่อฝั่งเบราว์เซอร์ ≤1.2MB) แบบเดียวกับ attachments
