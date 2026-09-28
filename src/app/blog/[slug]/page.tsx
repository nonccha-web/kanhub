import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { CtaBand } from "@/components/CtaBand";
import { ARTICLES, articleBySlug, CAT_COLOR } from "@/lib/blog-data";
import { SITE } from "@/lib/site";
import { autolink } from "@/lib/autolink";
import { OFFERS } from "@/lib/offers";
import { CATEGORIES } from "@/lib/categories";

/* tag → หน้าขาย (ขากลับของ internal link: บทความ → สินค้า) */
const PAGES: Record<string, { name: string; href: string }> = {
  ...Object.fromEntries(OFFERS.map((o) => [o.key === "promo" ? "promo" : o.slug, { name: o.name, href: o.href }])),
  ...Object.fromEntries(CATEGORIES.map((c) => [c.slug, { name: c.name, href: `/catalog/${c.slug}/` }])),
  "pha-hang": { name: "ผ้าหาง / ผ้าเหมา", href: "/catalog/pha-hang/" },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) return {};
  /* description ต้องมี keyword หลัก — ถ้าเขียนไม่ได้ใส่ไว้ เติมไว้หน้าประโยคให้เอง */
  const pk = a.primaryKw ?? a.keywords[0];
  const desc = a.seoDesc.replace(/\s/g, "").includes(pk.replace(/\s/g, "")) ? a.seoDesc : `${pk}: ${a.seoDesc}`;
  return {
    title: a.title,
    description: desc,
    keywords: [a.primaryKw ?? a.keywords[0], ...a.keywords.filter((k) => k !== a.primaryKw)],
    alternates: { canonical: `/blog/${a.slug}` },
    openGraph: { type: "article", title: a.title, description: desc, url: `/blog/${a.slug}`, images: [a.cover] },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.seoDesc,
    image: `${SITE.url}${a.cover}`,
    datePublished: a.date,
    author: { "@type": "Organization", name: SITE.name },
    publisher: { "@type": "Organization", name: SITE.name },
    mainEntityOfPage: `${SITE.url}/blog/${a.slug}`,
  };

  /* บทความอื่นที่ใช้หน้าขายเดียวกันขึ้นก่อน แล้วค่อยเติมเรื่องล่าสุด */
  const tags = a.tags ?? [];
  const sameTopic = ARTICLES.filter((x) => x.slug !== a.slug && x.tags?.some((t) => tags.includes(t)));
  const related = [...sameTopic, ...ARTICLES.filter((x) => x.slug !== a.slug && !sameTopic.includes(x))].slice(0, 3);
  const used = new Set<string>();   // ลิงก์ในเนื้อหา: หน้าละครั้ง ทั้งบทความ
  const products = tags.map((t) => PAGES[t]).filter(Boolean);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="bg-cream pb-16">
        {/* cover */}
        <div className="relative h-[280px] w-full sm:h-[380px]">
          <Image src={a.cover} alt={a.coverAlt} fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
          <Container className="absolute inset-x-0 bottom-0 pb-8">
            <span className="inline-block rounded-md px-2.5 py-1 text-xs font-bold text-white" style={{ background: CAT_COLOR[a.category] }}>
              {a.category}
            </span>
            <h1 className="mt-3 max-w-3xl text-2xl font-extrabold leading-tight text-white sm:text-4xl">{a.title}</h1>
            <div className="mt-3 text-sm text-white/75">อ่าน {a.readMin} นาที · {a.date}</div>
          </Container>
        </div>

        <Container className="max-w-3xl pt-10">
          <p className="text-[17px] font-medium leading-relaxed text-ink">{autolink(a.intro, used, 8, `/blog/${a.slug}/`)}</p>

          {a.sections.map((s) => (
            <section key={s.heading} className="mt-8">
              <h2 className="text-xl font-bold text-ink">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-3 text-[16px] leading-relaxed text-ink/85">{autolink(p, used, 8, `/blog/${a.slug}/`)}</p>
              ))}
            </section>
          ))}

          {products.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-bold text-ink">สินค้าที่เกี่ยวข้องกับบทความนี้</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {products.map((p) => (
                  <a key={p.href} href={p.href} className="rounded-full border-[1.5px] border-ink bg-white px-4 py-2 text-[14px] font-semibold text-ink hover:bg-ink hover:text-white">{p.name} →</a>
                ))}
              </div>
            </div>
          )}

          {/* CTA ในบทความ */}
          <div className="mt-10 rounded-2xl border border-hair bg-white p-6 text-center">
            <h3 className="text-lg font-bold text-ink">สนใจรับกระสอบไปขาย?</h3>
            <p className="mx-auto mt-1.5 max-w-md text-[15px] text-muted">ทักไลน์ KAN HUB ทีมงานช่วยเลือกก้อนที่เหมาะกับร้านคุณ ส่งทั่วไทย</p>
            {a.links && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {a.links.map((l) => (
                  <a key={l.href} href={l.href} className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-[15px] font-semibold text-white hover:bg-brand-dark">{l.label} →</a>
                ))}
              </div>
            )}
            <a href={SITE.lineUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center justify-center rounded-xl bg-line px-6 py-3 text-[15px] font-semibold text-white hover:bg-line-dark">
              💬 ทักไลน์ดูราคา
            </a>
          </div>

          {/* related */}
          <div className="mt-12">
            <h2 className="text-lg font-bold text-ink">บทความอื่นๆ</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link key={r.slug} href={`/blog/${r.slug}`} className="group overflow-hidden rounded-xl border border-hair bg-white">
                  <div className="relative h-28">
                    <Image src={r.cover} alt={r.coverAlt} fill sizes="240px" className="object-cover" />
                  </div>
                  <p className="p-3 text-[14px] font-semibold leading-snug text-ink group-hover:text-brand">{r.title}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <Link href="/blog" className="text-sm font-semibold text-brand hover:text-brand-dark">← กลับไปหน้าบทความ</Link>
          </div>
        </Container>
      </article>

      <CtaBand />
    </>
  );
}
