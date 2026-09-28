import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { LineIcon, FbIcon } from "@/components/BrandIcons";
import { SITE } from "@/lib/site";
import { ARTICLES, CAT_COLOR } from "@/lib/blog-data";
import { BlogGrid } from "@/components/BlogGrid";

export const metadata = {
  title: "บทความ & เคล็ดลับเปิดร้านเสื้อผ้ามือสอง",
  description:
    "รวมบทความและเคล็ดลับขายเสื้อผ้ามือสองญี่ปุ่นจาก KAN HUB — วิธีเปิดร้านมือสอง เลือกกระสอบ/ก้อนผ้า ตั้งราคาขายต่อ และเทคนิคขายดีสำหรับร้านและตลาดนัด",
  keywords: ["เปิดร้านเสื้อผ้ามือสอง", "ขายเสื้อผ้ามือสอง", "ธุรกิจเสื้อผ้ามือสอง", "อยากขายเสื้อผ้ามือสองเริ่มยังไง"],
  alternates: { canonical: "/blog" },
};

const cats = Array.from(new Set(ARTICLES.map((a) => a.category)));

function Chip({ cat }: { cat: string }) {
  return (
    <span className="inline-block rounded-md px-2.5 py-1 text-xs font-bold text-white" style={{ background: CAT_COLOR[cat] }}>
      {cat}
    </span>
  );
}

export default function BlogPage() {
  const [featured, ...rest] = ARTICLES;
  return (
    <>
      <PageHero
        eyebrow="บทความ & เคล็ดลับ"
        title="ความรู้สำหรับคนขายเสื้อผ้ามือสอง"
        subtitle="เคล็ดลับเลือกของ เปิดร้าน และขายให้กำไรดี — จากทีมงาน KAN HUB"
      />

      <section className="bg-cream py-16">
        <Container>
          {/* บทความเด่น */}
          <Link href={`/blog/${featured.slug}`} className="group mt-8 block overflow-hidden rounded-2xl border border-hair bg-white transition-shadow hover:shadow-md">
            <div className="grid md:grid-cols-2">
              <div className="relative min-h-[220px]">
                <Image src={featured.cover} alt={featured.coverAlt} fill sizes="(max-width:768px) 100vw, 560px" className="object-cover" />
                <span className="absolute left-4 top-4"><Chip cat={featured.category} /></span>
              </div>
              <div className="p-7">
                <span className="text-xs font-semibold text-brand">บทความแนะนำ</span>
                <h2 className="mt-2 text-xl font-bold text-ink group-hover:text-brand sm:text-2xl">{featured.title}</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{featured.excerpt}</p>
                <div className="mt-4 text-xs text-muted">อ่าน {featured.readMin} นาที</div>
              </div>
            </div>
          </Link>

          {/* กริดบทความ — กรองหมวด + ดูเพิ่ม */}
          <div className="mt-10">
            <BlogGrid
              items={rest.map((a) => ({ slug: a.slug, title: a.title, cover: a.cover, coverAlt: a.coverAlt, category: a.category, excerpt: a.excerpt, readMin: a.readMin }))}
              cats={cats}
              colors={CAT_COLOR}
            />
          </div>

          <div className="mt-12 rounded-2xl border border-hair bg-cream-100 px-6 py-8 text-center">
            <h2 className="text-xl font-bold text-ink">อยากได้เคล็ดลับก่อนใคร?</h2>
            <p className="mx-auto mt-2 max-w-lg text-[15px] text-muted">ติดตามเพจ KAN HUB หรือแอดไลน์ รับข่าวกระสอบใหม่ โปรโมชั่น และเทคนิคขายก่อนใคร</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a href={SITE.lineUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-line px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-line-dark">
                <LineIcon /> แอด LINE
              </a>
              <a href={SITE.facebook} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-hair bg-white px-6 py-3.5 text-[15px] font-semibold text-ink hover:bg-cream">
                <FbIcon /> ติดตามเพจ
              </a>
            </div>
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
