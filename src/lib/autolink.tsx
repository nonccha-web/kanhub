import Link from "next/link";
import type { ReactNode } from "react";

/* ลิงก์ภายในอัตโนมัติในเนื้อบทความ — คำแรกที่เจอของแต่ละหน้าปลายทางจะกลายเป็นลิงก์ (หน้าละครั้งเดียว)
   เรียงคำยาวก่อน กัน "ก้อนผ้า" ไปแย่ง "ก้อนผ้า 350 กก." · เพิ่มคำ/หน้าใหม่ที่ LINKS ที่เดียว */
export const LINKS: [string, string][] = [
  ["ก้อนผ้า 350 กก.", "/catalog/bale/"],
  ["กระสอบ 45 กก.", "/catalog/sack-45/"],
  ["กระสอบโปรผ้าปลดราว", "/grade-b/"],
  ["กระสอบโปร", "/grade-b/"],
  ["ผ้าปลดราว", "/grade-b/"],
  ["ผ้าหาง", "/catalog/pha-hang/"],
  ["ผ้าเหมา", "/catalog/pha-hang/"],
  ["เครื่องคิดราคา", "/catalog/stock/"],
  ["คัดเองรายตัว", "/catalog/stock/"],
  ["คัดรายตัว", "/catalog/stock/"],
  ["ราคาส่ง", "/catalog/stock/"],
  ["ชุดเด็ก", "/catalog/kids/"],
  ["เสื้อผ้าเด็ก", "/catalog/kids/"],
  ["เสื้อกันหนาว", "/winter/"],
  ["ไหมพรม", "/catalog/knitwear/"],
  ["เสื้อยืด", "/catalog/tops/"],
  ["เชิ้ต", "/catalog/tops/"],
  ["แจ็คเก็ต", "/catalog/coat-jacket/"],
  ["กางเกง", "/catalog/jeans-pants/"],
  ["กระโปรง", "/catalog/skirt/"],
  ["ยีนส์", "/catalog/jeans-pants/"],
  ["เดรส", "/catalog/dress/"],
  ["โค้ท", "/catalog/coat-jacket/"],
  ["ก้อนผ้า", "/catalog/bale/"],
  ["กระสอบ", "/catalog/sack-45/"],
  ["ขายส่ง", "/wholesale/"],
  ["มาดูของที่โกดัง", "/contact/"],
  ["วิธีสั่งซื้อ", "/how-to-order/"],
  /* ลิงก์บทความ ↔ บทความ (กลุ่มเนื้อหาเดียวกันช่วยกันดันอันดับ) */
  ["เกรด A", "/blog/grade-a-vs-b/"],
  ["ตลาดนัด", "/blog/khai-sua-pha-mue-song-talad-nat/"],
  ["ไลฟ์", "/blog/live-khai-technique/"],
  ["ตั้งราคา", "/blog/tang-rakha-khai-tor/"],
  ["ถ่ายรูป", "/blog/khai-sua-pha-mue-song-online-thai-rup/"],
  ["เปิดร้าน", "/blog/perd-ran-mue-song/"],
  ["ตำหนิ", "/blog/sap-wong-kan-sua-pha-mue-song/"],
  ["ของค้าง", "/blog/stock-sua-pha-mue-song-khang-khai-mai-ok/"],
  ["หน้าหนาว", "/blog/coat-maiphrom-nahnaao/"],
];

const RE = new RegExp(LINKS.map(([w]) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
const HREF = Object.fromEntries(LINKS);

/** ใช้ used ตัวเดียวทั้งบทความ — ลิงก์ไปหน้าเดิมซ้ำไม่ได้ · max = เพดานลิงก์ต่อบทความ */
export function autolink(text: string, used: Set<string>, max = 8, self = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    const href = HREF[m[0]];
    if (!href || href === self || used.has(href) || used.size >= max) continue;
    used.add(href);
    out.push(text.slice(last, m.index));
    const cls = "font-semibold text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand";
    /* /grade-b/ กับ /winter/ เป็นไฟล์ static นอกแอป Next — ใช้ <a> ธรรมดา ไม่งั้น Link ไป prefetch แล้ว 404 */
    out.push(
      /^\/(grade-b|winter)\//.test(href)
        ? <a key={`${href}-${m.index}`} href={href} className={cls}>{m[0]}</a>
        : <Link key={`${href}-${m.index}`} href={href} className={cls}>{m[0]}</Link>
    );
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}
