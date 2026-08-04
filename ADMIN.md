# KAN ERP — ระบบหลังบ้าน (/admin)

เข้าที่ `…workers.dev/admin` (ตอน production ค่อยแยกเป็น `admin.kan-hub.com`)
ตัวระบบเป็น **static (HTML + vanilla JS)** ไม่มี backend — วางใน `public/admin/` แล้ว deploy พร้อมเว็บ

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
│  │  └─ core/ui/… .js   · เอนจินคำนวณ + UI helper
│  └─ data/kan-data.js   · ★ ข้อมูลยอดขาย (snapshot ที่ build จาก ETL)
└─ cmo/                   → หน้าฝ่ายการตลาด/ทีม (หนึ่ง module = หนึ่งไฟล์ .html)
   ├─ erp-menu.js         · ★★ เมนู sidebar กลาง — แก้เมนู/ลำดับ/ไอคอน "ที่ไฟล์นี้ที่เดียว" มีผลทุกหน้า
   ├─ nav.js              · ตัวฉีด sidebar เข้าหน้า CMO (ใช้ erp-menu.js)
   ├─ styles.css          · ธีม/สไตล์ฝั่ง CMO (ตัวแปรสี + ฟอนต์ Kanit)
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
| ข้อมูลยอดขาย | `mkt/data/kan-data.js` (สร้างจาก `etl/` ในโฟลเดอร์ต้นฉบับ) |

## หลักการที่ทำให้ "เป็นระบบเดียวกัน"
- **เมนูเดียว**: ทุกหน้าดึง sidebar จาก `erp-menu.js` → เมนูตรงกันเป๊ะ
- **ฟอนต์เดียว (Kanit)**: ทั้ง SPA และ CMO โหลด Kanit ด้วย URL แบบเดียวกัน (`wght@…`)

## TODO ก่อนใช้จริง / ขึ้น admin.kan-hub.com
- [ ] ครอบ **Cloudflare Access** ที่ path `/admin/*` (ล็อกอินอีเมล/Google) — ตอนนี้เข้าได้สาธารณะ + มีข้อมูลจริง
- [ ] (ทางเลือก) รวมตัวแปรธีมของ `app.css` กับ `styles.css` ให้ชุดเดียว เพื่อให้ SPA กับ CMO หน้าตา 100% เหมือนกัน
- [ ] วางระบบ sync ข้อมูล (ETL → kan-data.js) ให้อัปเดตอัตโนมัติ
