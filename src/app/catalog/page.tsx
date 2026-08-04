import Link from "next/link";
import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { TIERS } from "@/lib/tiers";
import data from "@/lib/kan-prices.json";

export const metadata = {
  title: "ซื้อผ้ากระสอบ & ก้อนผ้ามือสองญี่ปุ่น — แยกตาม Tier A–D",
  description:
    "เลือกซื้อกระสอบ/ก้อนผ้าเสื้อผ้ามือสองญี่ปุ่นตามระดับงาน Tier A–D ของ KAN HUB — ก้อนผ้ายกก้อน โค้ท-ไหมพรม ผ้าเหมา-คัดแยก และงานเบ็ดเตล็ด พร้อมราคาส่งเริ่มต้น",
  keywords: ["ผ้ากระสอบ", "ซื้อผ้ากระสอบ", "กระสอบเสื้อผ้ามือสอง", "ก้อนผ้า", "เสื้อผ้ามือสองยกกระสอบ", "ขายส่งเสื้อผ้ามือสองญี่ปุ่น"],
  alternates: { canonical: "/catalog" },
};

type P = { tier: string; price_final: number | null };
const products = data.products as P[];
const baht = (n: number) => `${n.toLocaleString("en-US")}฿`;

function range(key: string) {
  const prices = products.filter((p) => p.tier === key && p.price_final != null).map((p) => p.price_final as number);
  if (!prices.length) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export default function CatalogPage() {
  return (
    <>
      <PageHero
        eyebrow="แคตตาล็อกสินค้า"
        title="เลือกงานตามระดับ — Tier A ถึง D"
        subtitle="เราแบ่งสินค้าเป็น 4 ระดับ เพื่อให้เลือกง่ายตามงบและกลุ่มลูกค้าหน้าร้าน กดเข้าไปดูรายละเอียด + ราคาของแต่ละ Tier ได้เลย"
      />

      <section className="bg-cream py-16">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2">
            {TIERS.map((t) => {
              const r = range(t.key);
              return (
                <Link
                  key={t.slug}
                  href={`/catalog/${t.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-hair bg-white transition-shadow hover:shadow-md"
                >
                  {/* กรอบรูป (placeholder รอรูปจริง) */}
                  <div
                    className="relative flex aspect-[16/7] items-end justify-between overflow-hidden p-4 text-white"
                    style={{ background: `linear-gradient(135deg, ${t.accent}, #1a1413)` }}
                  >
                    <span className="text-6xl font-black leading-none opacity-25">{t.key}</span>
                    <span className="text-[11px] opacity-80">รูปสินค้าเร็วๆ นี้</span>
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-3">
                      <span
                        className="grid h-10 w-10 place-items-center rounded-xl text-base font-extrabold"
                        style={{ background: t.accent, color: t.onGold ? "#1a1413" : "#fff" }}
                      >
                        {t.key}
                      </span>
                      <div>
                        <h2 className="text-lg font-bold text-ink">Tier {t.key} · {t.name}</h2>
                        <p className="text-[13px] text-muted">{t.unitNote}</p>
                      </div>
                    </div>
                    <p className="mt-4 flex-1 text-[15px] leading-relaxed text-muted">{t.tagline}</p>
                    {r && (
                      <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-[13px] text-muted">เริ่มต้น</span>
                        <span className="text-xl font-extrabold text-brand">{baht(r.min)}</span>
                        {r.max !== r.min && (
                          <span className="text-[13px] text-muted">– สูงสุด {baht(r.max)}</span>
                        )}
                      </div>
                    )}
                    <span className="mt-4 text-sm font-semibold text-brand group-hover:text-brand-dark">
                      ดู Tier {t.key} →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      <CtaBand
        title="ไม่แน่ใจว่าเริ่ม Tier ไหนดี?"
        subtitle="บอกงบและกลุ่มลูกค้าร้านคุณ ทีมงานแนะนำระดับที่เหมาะที่สุดให้"
      />
    </>
  );
}
