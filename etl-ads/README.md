# ETL ฝั่งโฆษณา — สร้าง `public/admin/mkt/data/ads-data.js`

หน้า **รายงานโฆษณา (Meta)** ใน `/admin/mkt/#/ads` อ่านจากไฟล์ `ads-data.js` ตัวเดียว
ไฟล์นั้นเป็น **ภาพนิ่ง** ไม่ใช่ข้อมูลสด — จะขยับต่อเมื่อทำ 2 ขั้นตอนนี้ใหม่

บัญชีโฆษณา: **Kan x MCC** · `1687146548953347` · สกุลเงิน THB

---

## ขั้นที่ 1 — ดึงข้อมูลจาก Meta

ใช้ Meta Ads connector (ผูกกับบัญชี Facebook ของนนท์อยู่แล้ว ไม่ต้องมี token)
สั่งผ่าน Claude ว่าให้ดึงตามรายการนี้แล้วเซฟทับไฟล์เดิมในโฟลเดอร์นี้

| ไฟล์ | ระดับ | ช่วง | หมายเหตุ |
|---|---|---|---|
| `may/jun/jul/aug.json` | `campaign` + `time_increment: 1` | เดือนละไฟล์ | ต้องมี filter `campaign.amount_spent > 0` ไม่งั้นได้แถวศูนย์เป็นพัน |
| `tot.json` | `campaign` (ไม่แบ่งวัน) | ทั้งช่วง | ยอดรวมทั้งแคมเปญ — **reach / frequency / cost_per_result ที่ถูกต้องอยู่ที่ไฟล์นี้เท่านั้น** |
| `breakdowns.json` | `ad_account` | ทั้งช่วง | เขียนมือจากผล 6 ครั้ง: `age` `gender` `publisher_platform` `platform_position` `impression_device` `region` `hourly_stats_aggregated_by_advertiser_time_zone` (ยิงได้ทีละ breakdown เท่านั้น) |

ฟิลด์รายวันที่ต้องขอ:
`id, name, amount_spent, impressions, reach, clicks, results, post_engagement, actions:link_click, lead`

ฟิลด์ของ `tot.json` เพิ่ม:
`objective, effective_status, frequency, ctr, cpm, cpc, cost_per_result, actions:post_reaction, actions:comment, post_shares, video_thruplay_watched_actions, start_time, stop_time`

> เพิ่มเดือนใหม่ = เพิ่มไฟล์ `sep.json` แล้วเติมชื่อลงในลิสต์ใน `build_ads.py`

## ขั้นที่ 2 — รัน

```
cd etl-ads && python3 build_ads.py
```

เขียนทับ `../public/admin/mkt/data/ads-data.js` แล้วพิมพ์สรุปออกมาให้ตรวจ
(จำนวนแคมเปญ · แถวรายวัน · ช่วงวันที่ · ค่าแอดรวม · ค่าแอดแยกสาขา)

เสร็จแล้ว **bump `?v=` ใน `public/admin/mkt/index.html`** ไม่งั้นเบราว์เซอร์ยังกินไฟล์เก่า

---

## เส้นเชื่อมกับฝั่งยอดขาย

ชื่อแคมเปญทุกตัวขึ้นต้นด้วย `#01`–`#05` ซึ่งเป็น **รหัสสาขาชุดเดียวกับ `KST#n`** ใน `kan-data.js`

| ในชื่อแคมเปญ | สาขา | ฝั่งยอดขาย |
|---|---|---|
| `#01` | ชุมพร | `KST#1` |
| `#02` | นครศรีธรรมราช | — (ตัดออกจากชุดข้อมูลยอดขายแล้ว) |
| `#03` | สุราษฎร์ธานี | `KST#3` |
| `#04` | Kan Fashion | `KST#4` |
| `#05` | KAN HUB (โกดัง) | `KST#0` — ไม่มีบิลหน้าร้าน |

**ถ้าทีมแอดเลิกใส่ `#0X` หน้าชื่อแคมเปญ การจับคู่สาขาจะพังทันที** แคมเปญจะตกไปอยู่กลุ่ม
`other` และหายจากการ์ดแยกสาขา — กฎการตั้งชื่อนี้จึงสำคัญกว่าที่เห็น

## ข้อจำกัดที่ต้องรู้

- **reach รวมข้ามวันไม่ได้** — `daily` เก็บ reach รายวันไว้ก็จริง แต่คนเดิมที่เห็นหลายวันถูกนับซ้ำ
  หน้าเว็บจึงพาดหัวด้วย impressions และกำกับคำว่า "นับซ้ำ" ทุกจุดที่โชว์ reach
- **`breakdowns` ไม่ขยับตามตัวกรองวันที่** เป็นยอดรวมช่วงเดียว (`meta.bdRange`) ทั้งบัญชี
  ถ้าจะให้ขยับตามต้องดึง breakdown แบบรายวันซึ่งข้อมูลบานมาก
- **ฝั่งเพจ (organic) ยังไม่มี** — connector ตัวนี้เปิดเฉพาะข้อมูลบัญชีโฆษณา
  ผู้ติดตาม / คนเห็นโพสต์ที่ไม่ได้บูสต์ / คนทักแชทเอง ต้องใช้ Page Access Token ยิง Graph API แยก
