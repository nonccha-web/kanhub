/* รูปสินค้าจริง แม็พตามชื่อสินค้า (ตรงกับ name ใน kan-prices.json)
   เพิ่มกลุ่มใหม่: วางรูปใน public/img/products/<tier>/<slug>/ แล้วเพิ่ม entry ที่นี่ */

const b = (slug: string, n: number) =>
  Array.from({ length: n }, (_, i) => `/img/products/tier-b/${slug}/${i + 1}.jpg`);

export const PRODUCT_IMAGES: Record<string, string[]> = {
  // Tier B — โค้ท & ไหมพรม (ลูกค้าส่งรูปมา)
  "โค้ทรวม": b("coat-ruam", 2),
  "โค้ทผ้าบาง": b("coat-bang", 3),
  "โค้ทขนเป็ด": b("coat-pet", 3),
  "ไหมพรม": b("maiphrom", 6),
};

export const imagesFor = (name: string) => PRODUCT_IMAGES[name] || [];
