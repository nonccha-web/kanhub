import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { TIERS, tierBySlug } from "@/lib/tiers";
import data from "@/lib/kan-prices.json";

type P = {
  tier: string; name: string; unit: string;
  weight_kg: number | null; qty: number | null; price_final: number | null;
};
const products = data.products as P[];
const baht = (n: number) => `${n.toLocaleString("en-US")}฿`;

export const dynamicParams = false;

export function generateStaticParams() {
  return TIERS.map((t) => ({ tier: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ tier: string }> }) {
  const { tier } = await params;
  const t = tierBySlug(tier);
  if (!t) return {};
  return {
    title: `Tier ${t.key} · ${t.name}`,
    description: t.what,
    alternates: { canonical: `/catalog/${t.slug}` },
  };
}

export default async function TierPage({ params }: { params: Promise<{ tier: string }> }) {
  const { tier } = await params;
  const t = tierBySlug(tier);
  if (!t) notFound();

  const items = products.filter((p) => p.tier === t.key && p.price_final != null);
  const prices = items.map((p) => p.price_final as number);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;

  return (
    <>
      <PageHero eyebrow={`Tier ${t.key}`} title={`Tier ${t.key} · ${t.name}`} subtitle={t.tagline} />

      <section className="bg-cream py-16">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            {/* อธิบาย Tier */}
            <div>
              <h2 className="text-xl font-bold text-ink">Tier {t.key} คืออะไร?</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{t.what}</p>

              <h3 className="mt-6 text-[15px] font-semibold text-ink">เหมาะกับใคร</h3>
              <ul className="mt-3 space-y-2">
                {t.whoFor.map((w) => (
                  <li key={w} className="flex items-start gap-2.5 text-[15px] text-ink/80">
                    <span className="mt-0.5 text-line">✓</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>

            {/* สรุปราคา */}
            <div className="h-fit rounded-2xl border border-hair bg-white p-6">
              <div
                className="inline-grid h-10 w-10 place-items-center rounded-xl text-base font-extrabold"
                style={{ background: t.accent, color: t.onGold ? "#1a1413" : "#fff" }}
              >
                {t.key}
              </div>
              <p className="mt-3 text-[13px] text-muted">{t.unitNote}</p>
              {min != null && max != null && (
                <div className="mt-3">
                  <div className="text-[13px] text-muted">ราคาเริ่มต้น</div>
                  <div className="text-3xl font-extrabold text-brand">{baht(min)}</div>
                  {max !== min && (
                    <div className="mt-1 text-sm text-muted">สูงสุด {baht(max)} ต่อหน่วย</div>
                  )}
                </div>
              )}
              <a
                href="https://line.me/R/ti/p/@kanhub"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-line px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-line-dark"
              >
                💬 ทักไลน์ขอราคา Tier {t.key}
              </a>
            </div>
          </div>

          {/* รายการสินค้าใน Tier นี้ */}
          {items.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xl font-bold text-ink">รายการใน Tier {t.key}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <div key={p.name} className="overflow-hidden rounded-2xl border border-hair bg-white shadow-sm">
                    <div className="relative grid aspect-[4/3] place-items-center border-b border-hair bg-cream-100">
                      <span className="text-[11px] text-muted/70">รูปสินค้าเร็วๆ นี้</span>
                      <span
                        className="absolute left-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-md text-xs font-bold"
                        style={{ background: t.accent, color: t.onGold ? "#1a1413" : "#fff" }}
                      >
                        {t.key}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="text-[15px] font-semibold text-ink">{p.name}</h3>
                      <p className="mt-0.5 text-[12px] text-muted">ยกเป็น{p.unit}</p>
                      <div className="mt-2 text-xl font-extrabold text-brand">
                        {baht(p.price_final as number)}{" "}
                        <span className="text-[12px] font-medium text-muted">/ {p.unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10">
            <Link href="/catalog" className="text-sm font-semibold text-brand hover:text-brand-dark">
              ← ดู Tier อื่นๆ ทั้งหมด
            </Link>
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
