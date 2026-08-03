# KAN HUB — เว็บการตลาด

เว็บโกดังขายส่งเสื้อผ้ามือสองญี่ปุ่น นำเข้าตรง (ภาคใต้) สร้างจากดีไซน์ Figma "Kan Hub"

## Stack
- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4** (design tokens ใน `src/app/globals.css`)
- ฟอนต์ **Prompt** (ไทย/ละติน) ผ่าน `next/font`
- **Static export** (`output: "export"` → โฟลเดอร์ `out/`) สำหรับ Cloudflare Pages / GitHub Pages

## พัฒนา
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # สร้าง static site ใน out/
```

## Deploy (Cloudflare Pages — เหมือน legaone-web)
- Framework preset: **Next.js (Static HTML Export)** หรือ None
- Build command: `npm run build`
- Build output directory: `out`

## โครงสร้าง
- `src/lib/site.ts` — ข้อมูลเว็บ (ชื่อ, ติดต่อ, เมนู, footer) แก้ที่เดียว
- `src/app/globals.css` — design tokens (สี/ฟอนต์)
- `src/components/` — Header, Footer, SiteChrome, Logo, ContactWidget
- `src/app/page.tsx` — หน้าแรก (home) แปลงจาก Figma ครบทุก section
- `public/img/` — รูปจาก Figma

## หน้าที่ทำแล้ว
- [x] หน้าแรก (home)
- [ ] แคตตาล็อก, บริการ, ทำไมต้อง KAN, ขายส่ง, วิธีสั่งซื้อ, FAQ, บทความ, ติดต่อ (รอทำต่อ)
