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
