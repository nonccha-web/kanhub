/* ============================================================
   KAN HUB — ค่าตั้งต้นทั้งเว็บ (แก้ตรงนี้ที่เดียว)
   ============================================================ */

export const SITE = {
  name: "KAN HUB",
  tagline: "โกดังขายส่งเสื้อผ้ามือสองญี่ปุ่น นำเข้าตรง — เจ้าแรกภาคใต้",
  description:
    "KAN HUB โกดังขายส่งกระสอบเสื้อผ้ามือสองญี่ปุ่น นำเข้าตรงไม่ผ่านคนกลาง คัดเกรด A ราคาส่งต้นทาง มีบริษัทจริง จดทะเบียนถูกต้อง มีโกดังให้มาดูของ 4 สาขาในภาคใต้ ส่งทั่วไทย",
  url: "https://kanhub.co.th",
  lineId: "@kanhub",
  lineUrl: "https://line.me/R/ti/p/@kanhub",
  phone: "02-114-3390",
  phoneHref: "tel:021143390",
  facebook: "https://www.facebook.com/KANHUBB",
  facebookName: "KAN HUB อาณาจักรค้าส่งเสื้อผ้าญี่ปุ่นมือสองที่ใหญ่ที่สุดในภาคใต้",
  hours: "จันทร์-เสาร์ 9:00–18:00 (โกดัง)",
  lineHours: "ตอบไว ทุกวัน 9:00–21:00",
  address: "โกดัง KAN HUB ภาคใต้",
  branches: "สุราษฎร์ธานี · นครศรีธรรมราช · ชุมพร",
  // Google Analytics 4 measurement ID (เว้นว่าง "" เพื่อปิด)
  gaId: "",
} as const;

export type NavItem = {
  label: string;
  href: string;
};

/** เมนูหลัก (ตาม Figma header) */
export const NAV: NavItem[] = [
  { label: "หน้าแรก", href: "/" },
  { label: "สินค้า", href: "/catalog" },
  { label: "บริการ", href: "/service" },
  { label: "ทำไมต้อง KAN", href: "/why-us" },
  { label: "ขายส่งทั่วไทย", href: "/wholesale" },
  { label: "วิธีสั่งซื้อ", href: "/how-to-order" },
  { label: "FAQ", href: "/faq" },
  { label: "บทความ", href: "/blog" },
  { label: "ติดต่อ", href: "/contact" },
];

/** คอลัมน์ลิงก์ใน footer (ตาม Figma) */
export const FOOTER_COLUMNS: { title: string; links: NavItem[] }[] = [
  {
    title: "สินค้า",
    links: [
      { label: "กระสอบเสื้อยืด", href: "/catalog" },
      { label: "กระสอบกางเกงยีนส์", href: "/catalog" },
      { label: "กระสอบเดรส", href: "/catalog" },
      { label: "งานคัดแบรนด์ญี่ปุ่น", href: "/catalog" },
    ],
  },
  {
    title: "บริการ",
    links: [
      { label: "จัดก้อนสด", href: "/service" },
      { label: "100 ชิ้นพร้อมขาย", href: "/service" },
      { label: "เปิดร้าน-เปิดโกดัง", href: "/service" },
      { label: "วิธีสั่งซื้อ", href: "/how-to-order" },
    ],
  },
  {
    title: "บริษัท",
    links: [
      { label: "ทำไมต้อง KAN", href: "/why-us" },
      { label: "ขายส่งทั่วไทย", href: "/wholesale" },
      { label: "บทความ", href: "/blog" },
      { label: "ติดต่อ", href: "/contact" },
    ],
  },
];
