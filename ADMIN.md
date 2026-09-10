# KAN ERP — ระบบหลังบ้าน (/admin)

เข้าที่ `…workers.dev/admin` (ตอน production ค่อยแยกเป็น `admin.kan-hub.com`)
ตัวระบบเป็น **static (HTML + vanilla JS)** วางใน `public/admin/` แล้ว deploy พร้อมเว็บ
ตั้งแต่ 26 ส.ค. 2569 มี **API + ฐานข้อมูล D1** สำหรับหน้าที่ต้องบันทึกจริง (ตอนนี้ = ปฏิทินการตลาด, ตารางโพสต์, งานทีม)
— API อยู่ใน `worker.js` (`/api/*`, เปิดเฉพาะ admin subdomain) · schema ที่ `d1/schema.sql`
— แก้ schema แล้วต้อง `npx wrangler d1 execute kan-erp --remote --file=d1/schema.sql`
  (ยกเว้นตารางของระบบงานทีม `/api/t/*` ที่ `worker-tasks.js` สร้างให้เองตอนรันครั้งแรก)

## หน้าตา (8 ก.ย. 2569): เปลือกระบบชุดเดียวกับหลังบ้าน M CRM
- โทเคนสี + sidebar ขาว + แถบบน + โหมดย่อเมนู 64px อยู่ที่ **`assets/erp-shell.css`** ไฟล์เดียว
  ทั้ง `cmo/styles.css`, `mkt/assets/app.css`, `tasks/tasks.css` ดึงไปใช้ผ่าน `@import` — แก้หน้าตา sidebar ที่นี่ที่เดียว
- ปุ่มย่อเมนู (มุมขวาของโลโก้) จำค่าใน `localStorage kan-erp-collapsed` · ธีมมืดใช้ `kan-theme` ร่วมกันทุกหน้า
- ท้าย sidebar ทุกหน้ามี "Powered by M Creation" (`ERP_MENU.powered`)

## โครงสร้าง (แก้ง่ายทีละ module)

```
public/admin/
├─ index.html            → หน้า entry (redirect เข้า dashboard)
├─ mkt/                   → แดชบอร์ดยอดขาย+สต็อก (SPA, hash route #/overview …)
│  ├─ index.html         · โหลดฟอนต์ Kanit + เมนูกลาง + สคริปต์
│  ├─ assets/
│  │  ├─ app.css         · ธีม/สไตล์ฝั่ง SPA (ตัวแปรสี + ฟอนต์)
│  │  ├─ views.js        · ★ แต่ละ "หน้า/มุมมอง" อยู่ที่นี่ (overview/branch/velocity…)
│  │  ├─ views-extra.js  · มุมมองเสริม (sku/promo/plan/customers/quality)
│  │  ├─ views-ads.js    · หน้ารายงานโฆษณา Meta (#/ads)
│  │  └─ core/ui/… .js   · เอนจินคำนวณ + UI helper
│  └─ data/
│     ├─ kan-data.js     · ★ ข้อมูลยอดขาย (snapshot ที่ build จาก ETL)
│     └─ ads-data.js     · ★ ข้อมูลโฆษณา Meta (snapshot — สร้างจาก etl-ads/)
├─ tasks/                 → ★ ระบบมอบหมายงานทีม (SPA, hash route) — ล็อกอินชื่อ+PIN · ข้อมูลบน D1 ผ่าน /api/t/*
│  ├─ index.html · tasks.js · tasks.css
│  │   #/me งานของฉัน · #/all งานทั้งหมด (กรองคน/KPI/สถานะ) · #/new สั่งงาน (วางข้อความแชต → แยกเป็นงาน)
│  │   #/task/:id รายละเอียด+อัปเดต+แนบรูป · #/kpi KPI CMO 2570 · #/team ทีม+PIN
│  └─ โค้ดฝั่งเซิร์ฟเวอร์อยู่ `worker-tasks.js` (root repo) — สร้างตาราง + seed ทีม/KPI ให้เองครั้งแรก · PIN เริ่มต้น 1234
└─ cmo/                   → หน้าฝ่ายการตลาด/ทีม (หนึ่ง module = หนึ่งไฟล์ .html)
   ├─ erp-menu.js         · ★★ เมนู sidebar กลาง — แก้เมนู/ลำดับ/ไอคอน "ที่ไฟล์นี้ที่เดียว" มีผลทุกหน้า
   ├─ nav.js              · ตัวฉีด sidebar เข้าหน้า CMO (ใช้ erp-menu.js)
   ├─ styles.css          · ธีม/สไตล์ฝั่ง CMO (ตัวแปรสี + ฟอนต์ Kanit)
   ├─ campaign-calendar.html + .js · ปฏิทินการตลาดรายปี — คอนเทนต์/แคมเปญ/โปรโมชั่น (ธีม Lark) — **ข้อมูลอยู่บน D1 `kan-erp` ผ่าน `/api/campaigns`** แนบรูปได้ (เก็บใน D1) · เปิดจาก file:// จะถอยไป localStorage
   ├─ kpi.html · team-*.html · 01a–01d …   · แต่ละหน้า = 1 module แก้แยกได้เลย
   └─ traffic-data.js · kpi.js · …          · ข้อมูลของแต่ละหน้า
```

## จะแก้อะไร แก้ที่ไหน

| อยากแก้ | ไฟล์ |
|---|---|
| เมนู sidebar (เพิ่ม/ลบ/ลำดับ/ไอคอน) | `cmo/erp-menu.js` (แหล่งเดียว) |
| ฟอนต์/สีทั้งระบบ | `mkt/assets/app.css` + `cmo/styles.css` (ตัวแปร `--…` ด้านบน) |
| หน้าใน dashboard ยอดขาย | `mkt/assets/views.js` / `views-extra.js` |
| หน้า CMO (KPI, ทีม, B2B, MarCom …) | ไฟล์ `.html` ของหน้านั้นใน `cmo/` |
| ช่องทาง/สาขา ในปฏิทินการตลาด | `cmo/campaign-calendar.js` (ตัวแปร `CHANNELS` / `BRANCHES` ด้านบนไฟล์) |
| ข้อมูลยอดขาย | `mkt/data/kan-data.js` (สร้างจาก `etl/` ในโฟลเดอร์ต้นฉบับ) |
| หน้ารายงานโฆษณา | `mkt/assets/views-ads.js` |
| ข้อมูลโฆษณา | `mkt/data/ads-data.js` (รัน `etl-ads/build_ads.py` — ดู `etl-ads/README.md`) |

## กฎที่ห้ามพัง
- **แก้ไฟล์ใน `mkt/` หรือ `cmo/` แล้วต้อง bump `?v=` ทุกครั้ง** (cmo = v22 · mkt = v24 · tasks = v1 · erp-shell = v1) ไม่งั้นเบราว์เซอร์กินไฟล์เก่า
- ระบบงานทีม: ห้ามลบตาราง `staff` / `tasks` / `task_files` บน D1 — มีข้อมูลจริงของทีมและรูปที่ทีมอัปโหลด
- **ชื่อแคมเปญฝั่งแอดต้องมี `#01`–`#05` นำหน้า** — เป็นรหัสสาขาชุดเดียวกับ `KST#n`
  ที่หน้ารายงานโฆษณาใช้จับคู่ค่าแอดกับยอดขาย ถ้าทีมแอดเลิกใส่ การจับคู่พังเงียบ ๆ

## หลักการที่ทำให้ "เป็นระบบเดียวกัน"
- **เมนูเดียว**: ทุกหน้าดึง sidebar จาก `erp-menu.js` → เมนูตรงกันเป๊ะ
- **ฟอนต์เดียว (Kanit)**: ทั้ง SPA และ CMO โหลด Kanit ด้วย URL แบบเดียวกัน (`wght@…`)

## TODO ก่อนใช้จริง / ขึ้น admin.kan-hub.com
- [ ] ครอบ **Cloudflare Access** ที่ path `/admin/*` (ล็อกอินอีเมล/Google) — ตอนนี้เข้าได้สาธารณะ + มีข้อมูลจริง
      (ระบบงานทีม `/tasks/` มี PIN ของตัวเองแล้ว แต่หน้าอื่นยังเปิด)
- [ ] ระบบงานทีม: แจ้งเตือน LINE/Discord เมื่อสั่งงานใหม่ / ใกล้ถึงกำหนด · ย้ายรูปไป R2 ถ้าเริ่มเยอะ
- [ ] (ทางเลือก) รวมตัวแปรธีมของ `app.css` กับ `styles.css` ให้ชุดเดียว เพื่อให้ SPA กับ CMO หน้าตา 100% เหมือนกัน
- [ ] วางระบบ sync ข้อมูล (ETL → kan-data.js) ให้อัปเดตอัตโนมัติ
- [ ] ฝั่งโฆษณา: ต่อ **Page Access Token** เพื่อดึงยอดออร์แกนิกของ 5 เพจ
      (ผู้ติดตาม · คนเห็นโพสต์ที่ไม่ได้บูสต์ · คนทักแชทเอง) — ตอนนี้ `#/ads` มีแต่ฝั่งที่จ่ายเงิน

---

## สำรองข้อมูลและกู้คืน (สำคัญที่สุด อ่านก่อนแก้อะไรใหญ่)

ข้อมูลทั้งระบบอยู่ใน D1 ฐานเดียวชื่อ `kan-erp` (งาน โพสต์ ปฏิทิน ทีม รูปแนบ)
**ทดสอบกู้จริงแล้ว 10 ก.ย. 2569** — กู้เข้าฐานทดสอบได้ครบ 469 โพสต์ / 60 งาน / 125 อัปเดต / 9 แคมเปญ
และซ้อมลบรูปทั้งหมดแล้วคืนกลับมาเปิดดูได้ปกติ

### ชั้นที่ 1 — Time Travel ของ Cloudflare (ย้อนได้ 30 วัน ไม่ต้องมีไฟล์)
ใช้ตอน "เผลอลบ" หรือ "migration พัง" ย้อนทั้งฐานกลับไปเวลาใดก็ได้ใน 30 วัน

```
cd ~/kanhub-web
npx -y wrangler@4.129.0 d1 time-travel info kan-erp
npx -y wrangler@4.129.0 d1 time-travel restore kan-erp --timestamp=2026-09-10T02:00:00Z
```

`--timestamp` เป็นเวลา UTC (เวลาไทย ลบ 7 ชั่วโมง) · ของที่ทำหลังจุดนั้นจะหาย ให้สำรองก่อนเสมอ

### ชั้นที่ 2 — ไฟล์สำรองในเครื่อง (อัตโนมัติทุกวัน 03:00)
อยู่ที่ `~/kanhub-backups/` เก็บ 30 ชุดล่าสุด รอบละ 2 ไฟล์

| ไฟล์ | มีอะไร | ใช้ตอนไหน |
|---|---|---|
| `kan-erp-<เวลา>.sql.gz` | ทั้งฐาน **ยกเว้นรูป** | กู้งาน โพสต์ ปฏิทิน ทีม |
| `kan-files-<เวลา>.json.gz` | เฉพาะรูปและไฟล์แนบ | กู้รูปคืนหลังกู้ฐาน |

> ทำไมต้องแยก: แถวรูปเก็บเป็น base64 ยาว 500–700 KB ต่อแถว เกินเพดานความยาวคำสั่งของ D1
> ถ้า import ไฟล์ .sql ตรง ๆ จะขึ้น `SQLITE_TOOBIG` เลยต้องคืนรูปด้วยสคริปต์ที่ส่งค่าแบบ parameter

```
~/kanhub-backups/backup-kan.sh          # สำรองเดี๋ยวนี้
tail -6 ~/kanhub-backups/backup.log     # ดูว่ารอบล่าสุดสำเร็จไหม
ls -lht ~/kanhub-backups/*.gz | head    # ไฟล์ที่มี
```

**ขั้นตอนกู้คืนจากไฟล์ (ทดสอบแล้ว)**

```
cd ~/kanhub-backups
gunzip -k kan-erp-2026-09-10-1030.sql.gz

# 1) ตัดแถวรูปที่ยาวเกินออกก่อน (ไม่งั้น import ไม่ผ่าน)
python3 -c "import io;src='kan-erp-2026-09-10-1030.sql';io.open('restore.sql','w',encoding='utf-8').writelines([l for l in io.open(src,encoding='utf-8',errors='replace') if len(l)<90000])"

# 2) ลองกับฐานทดสอบก่อนเสมอ
cd ~/kanhub-web
npx -y wrangler@4.129.0 d1 create kan-erp-restore-test
npx -y wrangler@4.129.0 d1 execute kan-erp-restore-test --remote --file=~/kanhub-backups/restore.sql --yes
npx -y wrangler@4.129.0 d1 execute kan-erp-restore-test --remote --command "SELECT COUNT(*) FROM posts"

# 3) พอใจแล้วค่อยลงของจริง (เปลี่ยนชื่อฐานเป็น kan-erp)
npx -y wrangler@4.129.0 d1 execute kan-erp --remote --file=~/kanhub-backups/restore.sql --yes

# 4) คืนรูป (ต้องมี token ของหัวหน้าจากหน้า "ทีม + สิทธิ์")
node ~/kanhub-web/scripts/restore-files.js ~/kanhub-backups/kan-files-2026-09-10-1030.json.gz \
  --url https://admin.kan-hub.com --token <token>
```

ปิดสำรองอัตโนมัติ: `launchctl unload ~/Library/LaunchAgents/com.kan.backup.plist`

### ชั้นที่ 3 — ปุ่มในเว็บ (ทำได้จากทุกที่ ไม่ต้องมีเครื่องนี้)
หน้า **ทีม + สิทธิ์** → กล่อง **สำรองข้อมูล** → ปุ่ม "ดาวน์โหลดไฟล์สำรอง"
ได้ไฟล์ `kan-backup-YYYY-MM-DD.json` ครบทุกตารางรวมรูป เอาไปเก็บใน Google Drive ได้
กดก่อนทุกครั้งที่จะแก้อะไรเสี่ยง ๆ · ไฟล์นี้ใช้กับ `scripts/restore-files.js` ได้เหมือนกัน

### ยังขาดอยู่ (งานถัดไป)
- สำรองอัตโนมัติแบบไม่ต้องเปิดเครื่อง Mac — เปิด R2 ในแดชบอร์ด Cloudflare (ฟรี 10 GB ต้องผูกบัตร)
  แล้วให้ Worker cron เขียนขึ้น R2 ทุกคืน หรือทำ GitHub Action รายวันโดยใส่ `CLOUDFLARE_API_TOKEN` เป็น secret
- ย้ายรูปออกจาก D1 ไปเก็บที่ R2 จะทำให้ backup เล็กลงมากและ import กลับได้ตรง ๆ
- ฐานทดสอบ (staging) แยกจากของจริง
