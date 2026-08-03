import Link from "next/link";
import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { TIERS } from "@/lib/tiers";
import data from "@/lib/kan-prices.json";

export const metadata = {
  title: "แคตตาล็อกสินค้า — แยกตาม Tier A–D",
  description:
    "เลือกกระสอบเสื้อผ้ามือสองญี่ปุ่นตามระดับงาน Tier A–D ของ KAN HUB — ก้อนผ้ายกก้อน โค้ท-ไหมพรม ผ้าเหมา-คัดแยก และงานเบ็ดเตล็ด พร้อมช่วงราคาเริ่มต้น",
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
                  className="group flex flex-col rounded-2xl border border-hair bg-white p-6 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-12 w-12 place-items-center rounded-xl text-xl font-extrabold"
                      style={{ background: t.accent, color: t.onGold ? "#1a1413" : "#fff" }}
                    >
                      {t.key}
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-ink">Tier {t.key} · {t.name}</h2>
                      <p className="text-[13px] text-muted">{t.unitNote}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-[15px] leading-relaxed text-muted">{t.tagline}</p>
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
