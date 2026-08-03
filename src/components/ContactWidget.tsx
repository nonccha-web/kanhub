import { SITE } from "@/lib/site";

/** ปุ่มลอยมุมขวาล่าง — แอด LINE ด่วน */
export function ContactWidget() {
  return (
    <a
      href={SITE.lineUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="แอด LINE KAN HUB"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-line px-5 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-line/30 transition-transform hover:scale-105"
    >
      <span aria-hidden className="text-lg">💬</span>
      <span className="hidden sm:inline">ทักไลน์ดูราคา</span>
    </a>
  );
}
