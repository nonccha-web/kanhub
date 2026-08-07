/* รูปสินค้าจริง แม็พตามชื่อสินค้า (ตรงกับ name ใน kan-prices.json)
   เพิ่มกลุ่มใหม่: วางรูปใน public/img/products/<tier>/<slug>/ แล้วเพิ่ม entry ที่นี่
   สินค้าที่ยังไม่มีรูป = ไม่ต้องใส่ (การ์ดจะขึ้น placeholder "รูปเร็วๆ นี้") */

const imgs = (tier: string, slug: string, n: number) =>
  Array.from({ length: n }, (_, i) => `/img/products/${tier}/${slug}/${i + 1}.jpg`);

export const PRODUCT_IMAGES: Record<string, string[]> = {
  // Tier A — ก้อนผ้า
  "ก้อนผ้า TOKYO": imgs("tier-a", "tokyo", 1),
  "ก้อนผ้า NAGOYA": imgs("tier-a", "nagoya", 2),
  "ก้อนผ้า OSAKA": imgs("tier-a", "osaka", 2),
  // Tier B — โค้ท & ไหมพรม
  "โค้ทรวม": imgs("tier-b", "coat-ruam", 5),
  "โค้ทผ้าบาง": imgs("tier-b", "coat-bang", 4),
  "โค้ทขนเป็ด": imgs("tier-b", "coat-pet", 5),
  "ไหมพรม": imgs("tier-b", "maiphrom", 12),
  // Tier C — ผ้าเหมา & คัดแยก
  "ผ้าคัดแยกจากก้อน": imgs("tier-c", "khatyaek", 12),
  "ผ้าเหมาหาง": imgs("tier-c", "mao-hang", 4),
  "เหมาหางนคร": imgs("tier-c", "mao-hang-nakhon", 3),
  "เหมาหางนคร (ถุง)": imgs("tier-c", "mao-hang-nakhon", 3),
  "เหมาหางนคร (ลัง)": imgs("tier-c", "mao-hang-nakhon", 3),
};

export const imagesFor = (name: string) => PRODUCT_IMAGES[name] || [];

/* ตัวอย่างของที่ได้จากก้อน — ใช้ในแกลเลอรี "ตัวอย่างสินค้าในก้อน" (public/img/gallery/) */
const g = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `/img/gallery/${prefix}-${String(i + 1).padStart(2, "0")}.jpg`);

export type SampleGroup = { key: string; label: string; images: string[] };

export const SAMPLE_GROUPS: SampleGroup[] = [
  { key: "jeans", label: "ผ้ายีนส์", images: g("jeans", 20) },
  { key: "tshirt", label: "เสื้อยืด", images: g("tshirt", 5) },
  { key: "hoodie", label: "เสื้อหนาว แจ็คเก็ต ฮู้ด", images: g("hoodie", 3) },
  { key: "kids", label: "ผ้าเด็ก", images: g("kids", 5) },
  { key: "dress", label: "เดรส", images: g("dress", 1) },
  { key: "bale-kids", label: "ก้อนผ้าเด็ก", images: g("bale-kids", 2) },
  { key: "warehouse", label: "โกดังก้อนผ้า", images: g("warehouse", 1) },
];

export const SAMPLE_IMAGES: { src: string; label: string }[] = SAMPLE_GROUPS.flatMap((grp) =>
  grp.images.map((src) => ({ src, label: grp.label }))
);
