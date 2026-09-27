"""ราคาผ้าสต๊อกขายรายตัว (คัดเอง) — ดึงจากชีต "เสื้อผ้า KAN Hub" แถว KAN#0
ใช้:  python3 etl/stock-prices.py "<ไฟล์ตารางราคาสินค้า ส่ง.xlsx>"
ได้:  src/lib/stock-prices.json  (หน้า /catalog/stock + worker ใช้คิดราคาซ้ำฝั่งเซิร์ฟเวอร์)

ไม่ commit ไฟล์ Excel ขึ้น repo — ในไฟล์มีชีตสาขาอื่นและต้นทุน
เอาเฉพาะเสื้อผ้าที่มีราคาครบ 5 ขั้น หน่วย "ตัว" (ตัดเครื่องประดับ/กระเป๋า/ก้อน ตามที่นนท์สั่ง 25 ก.ย. 69)"""
import json, re, sys, datetime
import openpyxl

SRC = sys.argv[1]
OUT = "src/lib/stock-prices.json"
STEPS = [{"min": 1, "max": 2, "label": "1–2 ตัว"}, {"min": 3, "max": 5, "label": "3–5 ตัว"},
         {"min": 6, "max": 24, "label": "6–24 ตัว"}, {"min": 25, "max": 99, "label": "25–99 ตัว"},
         {"min": 100, "max": None, "label": "100 ตัวขึ้นไป"}]

def clean(s):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    s = s.replace("เสื้อเสื้อโค้ท", "เสื้อโค้ท").replace("แขวนสั้น", "แขนสั้น")
    return s

wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb["เสื้อผ้า KAN Hub"]
items = []
for r in ws.iter_rows(min_row=3, values_only=True):
    if str(r[0] or "").strip() != "KAN#0":
        continue
    unit = clean(r[5])
    prices = r[6:11]
    if unit != "ตัว" or any(not isinstance(p, (int, float)) for p in prices):
        continue
    zone = clean(r[2]).replace("ขายส่ง:", "").strip()
    items.append({
        "sku": str(int(r[1])),
        "group": "เด็ก" if ("เด็ก" in zone or "เด็ก" in clean(r[3])) else "ผู้ใหญ่",
        "cat": clean(r[3]),
        "name": clean(r[4]),
        "prices": [int(p) for p in prices],
    })
items.sort(key=lambda x: (x["group"] != "ผู้ใหญ่", x["sku"]))
json.dump({"updated": datetime.date.today().isoformat(), "steps": STEPS, "items": items},
          open(OUT, "w"), ensure_ascii=False, indent=1)
print(len(items), "รายการ →", OUT)
