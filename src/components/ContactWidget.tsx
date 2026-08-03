import { SITE } from "@/lib/site";
import { LineIcon } from "./BrandIcons";

/** ปุ่มลอยมุมขวาล่าง — แอด LINE ด่วน (ทั้งปุ่มกระดุกกระดิกเรียกความสนใจ) */
export function ContactWidget() {
  return (
    <div className="attn-glow fixed bottom-5 right-5 z-40 rounded-full">
      <a
        href={SITE.lineUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="แอด LINE KAN HUB"
        className="attn-wiggle inline-flex items-center gap-2 rounded-full bg-line px-5 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-line/30"
      >
        <LineIcon className="h-6 w-6" />
        <span className="hidden sm:inline">ทักไลน์ดูราคา</span>
      </a>
    </div>
  );
}
