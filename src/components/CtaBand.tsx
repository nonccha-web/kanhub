import Link from "next/link";
import { Container } from "./Container";
import { LineIcon } from "./BrandIcons";
import { SITE } from "@/lib/site";

const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-6 py-3.5 text-[15px] font-semibold transition-colors";

/** แถบ CTA ปิดท้ายเพจ (ใช้ซ้ำได้ทุกหน้า) */
export function CtaBand({
  title = "พร้อมเริ่มต้นธุรกิจเสื้อผ้ามือสองแล้วใช่ไหม?",
  subtitle = "ทักมาคุยได้เลย ทีมงานช่วยเลือกกระสอบที่เหมาะกับร้านคุณ",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="bg-dark-2 py-16 text-white">
      <Container className="text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] text-white/65">{subtitle}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href={SITE.lineUrl} target="_blank" rel="noopener noreferrer" className={`${btn} bg-line text-white hover:bg-line-dark`}>
            <LineIcon /> แอด LINE
          </a>
          <a href={SITE.phoneHref} className={`${btn} bg-gold text-dark hover:bg-gold-dark`}>
            📞 โทรเลย
          </a>
          <Link href="/contact" className={`${btn} border-[1.5px] border-white/40 text-white hover:bg-white/10`}>
            📍 นัดดูของที่โกดัง
          </Link>
        </div>
      </Container>
    </section>
  );
}
