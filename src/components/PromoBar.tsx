import { PROMO } from "@/lib/offers";

/* แถบโปรบนสุดทุกหน้า — ปิดได้ที่ PROMO.on ใน offers.ts */
export function PromoBar() {
  if (!PROMO.on) return null;
  return (
    <a href={PROMO.href} className="block bg-brand text-white transition-colors hover:bg-brand-dark">
      <div className="mx-auto flex max-w-[1120px] items-center justify-center gap-2 px-4 py-2 text-center text-[13px] font-semibold sm:text-[14px]">
        <span className="truncate">{PROMO.bar}</span>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold text-brand">{PROMO.cta} →</span>
      </div>
    </a>
  );
}
