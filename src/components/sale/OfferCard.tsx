import Image from "next/image";
import type { Offer } from "@/lib/offers";

/* การ์ด 1 แบบขาย — ใช้ทั้งหน้าแรกและ /catalog
   โปรลิงก์ไปหน้าเดี่ยว (/grade-b/) ด้วย <a> เพราะเป็นไฟล์ static นอกแอป Next */
export function OfferCard({ o, featured = false }: { o: Offer; featured?: boolean }) {
  return (
    <a
      href={o.href}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-lg ${featured ? "border-brand ring-2 ring-brand/20" : "border-hair"}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-cream-100">
        <Image src={o.cover} alt={o.name} fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 270px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-xs font-bold ${featured ? "bg-brand text-white" : "bg-white text-ink"}`}>{o.badge}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-ink">{o.name}</h3>
        <p className="text-[13px] text-muted">{o.unit}</p>
        <div className="mt-3 text-2xl font-extrabold text-brand">{o.headline}</div>
        <p className="text-[13px] text-muted">{o.headlineNote}</p>
        <ul className="mt-3 flex-1 space-y-1 border-t border-hair pt-3">
          {o.groups.map((g) => (
            <li key={g.name} className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="font-semibold text-ink">{g.name}</span>
              <span className="text-right text-muted">{g.avg}</span>
            </li>
          ))}
        </ul>
        <span className={`mt-4 inline-flex items-center justify-center rounded-xl px-4 py-3 text-[15px] font-bold transition-colors ${featured ? "bg-brand text-white group-hover:bg-brand-dark" : "border-[1.5px] border-ink text-ink group-hover:bg-ink group-hover:text-white"}`}>
          {o.cta} →
        </span>
      </div>
    </a>
  );
}
