/* รูปสินค้าจริง แม็พตามชื่อสินค้า (ตรงกับ name ใน kan-prices.json)
   เพิ่มกลุ่มใหม่: วางรูปใน public/img/products/<tier>/<slug>/ แล้วเพิ่ม entry ที่นี่
   สินค้าที่ยังไม่มีรูป = ไม่ต้องใส่ (การ์ดจะขึ้น placeholder "รูปเร็วๆ นี้") */

const imgs = (tier: string, slug: string, n: number) =>
  Array.from({ length: n }, (_, i) => `/img/products/${tier}/${slug}/${i + 1}.jpg`);

export const PRODUCT_IMAGES: Record<string, string[]> = {
  // Tier A — ก้อนผ้า
  "ก้อนผ้า TOKYO": imgs("tier-a", "tokyo", 1),
  "ก้อนผ้า NAGOYA": imgs("tier-a", "nagoya", 2),
  // Tier B — โค้ท & ไหมพรม
  "โค้ทรวม": imgs("tier-b", "coat-ruam", 2),
  "โค้ทผ้าบาง": imgs("tier-b", "coat-bang", 3),
  "โค้ทขนเป็ด": imgs("tier-b", "coat-pet", 3),
  "ไหมพรม": imgs("tier-b", "maiphrom", 6),
  // Tier C — ผ้าเหมา & คัดแยก
  "ผ้าคัดแยกจากก้อน": imgs("tier-c", "khatyaek", 5),
};

export const imagesFor = (name: string) => PRODUCT_IMAGES[name] || [];
