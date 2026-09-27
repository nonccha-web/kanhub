import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { OfferInquiry } from "@/components/sale/OfferInquiry";
import { offerBySlug } from "@/lib/offers";
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
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
  const o = offerBySlug(slug);
  if (!o || !(SLUGS as readonly string[]).includes(slug)) notFound();
  const imgs = GALLERY[slug] || [];
  const unit = slug === "bale" ? "ก้อน" : "กระสอบ";

  return (
    <>
      <PageHero eyebrow={o.badge} title={o.name} subtitle={o.tagline} />

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

          <div className="mt-10">
            <Link href="/catalog" className="text-sm font-semibold text-brand hover:text-brand-dark">← ดูสินค้าทั้ง 4 แบบ</Link>
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
