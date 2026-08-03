import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — สร้างไฟล์ HTML ล้วนใน out/ สำหรับ Cloudflare Pages (ฟรี, ไม่ต้องมี server)
  output: "export",
  // static export ไม่รองรับ image optimizer ของ Next — ใช้รูปตามต้นฉบับ (เราย่อขนาดไว้แล้ว)
  images: { unoptimized: true },
  // ให้แต่ละหน้าเป็นโฟลเดอร์ /path/index.html — เข้ากันได้ดีกับ static host
  trailingSlash: true,
};

export default nextConfig;
