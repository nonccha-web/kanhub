import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { OfferInquiry } from "@/components/sale/OfferInquiry";
import { offerBySlug } from "@/lib/offers";
import { CATEGORIES, categoryBySlug } from "@/lib/categories";
import { CategoryView } from "@/components/sale/CategoryView";
import { SITE } from "@/lib/site";
import { imagesFor } from "@/lib/product-images";

/* หน้ารายละเอียดแบบขายที่ต้องสอบถาม/จอง — ก้อนผ้า 350 กก. และกระสอบ 45 กก.
   (ผ้าสต๊อกมีหน้าของตัวเองที่ /catalog/stock เพราะมีเครื่องคิดราคา · โปรอยู่หน้าเดี่ยว /grade-b/) */
const SLUGS = ["bale", "sack-45"] as const;

/* รูปจริงที่มีอยู่แล้วในเครื่อง — ใช้รูปก้อนเดิมของ OSAKA/NAGOYA และรูปผ้าคัดแยกกับโค้ทแทนกระสอบ */
const GALLERY: Record<string, string[]> = {
  bale: [...imagesFor("ก้อนผ้า NAGOYA"), ...imagesFor("ก้อนผ้า OSAKA")],
  /* เลือกรูปเสื้อผ้าล้วน — รูป 1–3 ของชุดคัดแยกมีเข็มขัด/รองเท้า ไม่ตรงกับกระสอบ */
  "sack-45": [7, 6, 10, 11, 12, 9].map((n) => `/img/products/tier-c/khatyaek/${n}.jpg`).concat(imagesFor("โค้ทรวม").slice(0, 2)),
};

export const dynamicParams = false;
export function generateStaticParams() {
  return [...SLUGS, ...CATEGORIES.map((c) => c.slug)].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = categoryBySlug(slug);
  if (c) {
    const t = `${c.h1} ราคาส่งรายตัว`;
    const d = `${c.intro.slice(0, 120)} — KAN HUB โกดังเสื้อผ้ามือสองญี่ปุ่น ส่งทั่วไทย`;
    return { title: t, description: d, keywords: c.keywords, alternates: { canonical: `/catalog/${c.slug}` },
             openGraph: { title: t, description: d, url: `/catalog/${c.slug}`, images: [c.images[0]] } };
  }
  const o = offerBySlug(slug);
  if (!o) return {};
  return {
    title: o.seoTitle,
    description: o.seoDesc,
    keywords: o.keywords,
    alternates: { canonical: `/catalog/${o.slug}` },
    openGraph: { title: o.seoTitle, description: o.seoDesc, url: `/catalog/${o.slug}` },
  };
}

export default async function OfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = categoryBySlug(slug);
  if (cat) return <CategoryView c={cat} />;
  const o = offerBySlug(slug);
  if (!o || !(SLUGS as readonly string[]).includes(slug)) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: o.name,
        description: o.what,
        image: `${SITE.url}${o.cover}`,
        brand: { "@type": "Brand", name: SITE.name },
        ...(o.price ? { offers: { "@type": "AggregateOffer", priceCurrency: "THB", lowPrice: o.price.low, highPrice: o.price.high,
          offerCount: o.groups.length, availability: "https://schema.org/InStock", url: `${SITE.url}${o.href}` } } : {}),
      },
      ...(o.faqs ? [{ "@type": "FAQPage", mainEntity: o.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
    ],
  };
  const imgs = GALLERY[slug] || [];
  const unit = slug === "bale" ? "ก้อน" : "กระสอบ";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero eyebrow={o.badge} title={o.seoTitle} subtitle={o.tagline} />

      <section className="bg-cream py-14">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div>
              <h2 className="text-xl font-bold text-ink">ราคาแยกตามกลุ่ม</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {o.groups.map((g) => (
                  <div key={g.name} className="rounded-2xl border border-hair bg-white p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-extrabold text-ink">{g.name}</h3>
                      {g.note && <span className="rounded-md bg-cream-100 px-2 py-0.5 text-[12px] font-semibold text-muted">{g.note}</span>}
                    </div>
                    <div className="mt-2 text-xl font-extrabold text-brand">{g.price}</div>
                    <div className="mt-0.5 text-[14px] font-semibold text-ink/80">{g.avg}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-muted">ราคาขึ้นกับล็อตที่เข้า ทีมงานยืนยันราคาและส่งรูป/คลิปของจริงให้ดูก่อนโอน</p>

              <h2 className="mt-10 text-xl font-bold text-ink">คืออะไร</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{o.what}</p>
              <h3 className="mt-6 text-[15px] font-semibold text-ink">เหมาะกับใคร</h3>
              <ul className="mt-3 space-y-2">
                {o.whoFor.map((w) => (
                  <li key={w} className="flex items-start gap-2.5 text-[15px] text-ink/80">
                    <span className="mt-0.5 text-line">✓</span>{w}
                  </li>
                ))}
              </ul>
            </div>

            <div className="h-fit rounded-2xl border-[1.5px] border-ink bg-white p-6 lg:sticky lg:top-24">
              <div className="text-[13px] text-muted">{o.unit}</div>
              <div className="mt-1 text-3xl font-extrabold text-brand">{o.headline}</div>
              <div className="text-[14px] text-muted">{o.headlineNote}</div>
              <p className="mt-4 rounded-xl bg-cream-100 px-3.5 py-2.5 text-[13.5px] text-ink/80">🚚 {o.shipping}</p>
              <OfferInquiry
                page={slug as "bale" | "sack-45"}
                title={`${o.name} — สอบถาม / จอง`}
                label={o.cta}
                unit={unit}
                choices={o.groups.map((g) => ({ name: g.name, price: g.price }))}
                className="mt-5 w-full rounded-xl bg-brand px-5 py-4 text-[16px] font-bold text-white shadow-[0_4px_0_#9e0b22] transition-colors hover:bg-brand-dark"
              />
            </div>
          </div>

          {imgs.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xl font-bold text-ink">รูปจริงจากโกดัง</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {imgs.map((src, i) => (
                  <div key={src} className="relative aspect-square overflow-hidden rounded-xl border border-hair bg-cream-100">
                    <Image src={src} alt={`${o.name} ${i + 1}`} fill loading="lazy" sizes="(max-width:640px) 50vw, 260px" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {o.faqs && (
            <div className="mt-12">
              <h2 className="text-xl font-bold text-ink">คำถามที่พบบ่อย</h2>
              <div className="mt-4 space-y-3">
                {o.faqs.map((f) => (
                  <details key={f.q} className="rounded-2xl border border-hair bg-white p-5 open:shadow-sm">
                    <summary className="cursor-pointer list-none text-[15px] font-semibold text-ink">{f.q}</summary>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link key={c.slug} href={`/catalog/${c.slug}`} className="rounded-full border border-hair bg-white px-4 py-2 text-[14px] font-semibold text-ink hover:border-ink">{c.name}</Link>
            ))}
            <Link href="/catalog/pha-hang" className="rounded-full border border-hair bg-white px-4 py-2 text-[14px] font-semibold text-ink hover:border-ink">ผ้าหาง / ผ้าเหมา</Link>
          </div>

          <div className="mt-8">
            <Link href="/catalog" className="text-sm font-semibold text-brand hover:text-brand-dark">← ดูสินค้าทั้ง 4 แบบ</Link>
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
