import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { StockCalculator } from "@/components/sale/StockCalculator";
import { StockBulk } from "@/components/sale/StockBulk";
import { offerBySlug } from "@/lib/offers";
import data from "@/lib/stock-prices.json";
import Link from "next/link";
import { RelatedArticles } from "@/components/RelatedArticles";
import { OrderSteps } from "@/components/sale/OrderSteps";
import { CATEGORIES } from "@/lib/categories";

const FAQS = [
  { q: "ราคาต่อตัวนับยังไง?", a: "นับแยกต่อรายการ เช่น เดรส 30 ตัวได้ราคาขั้น 25–99 ตัว (35 บาท) ส่วนยีนส์ 5 ตัวได้ราคาขั้น 3–5 ตัว (60 บาท) ไม่ได้นับรวมทั้งออเดอร์" },
  { q: "ขั้นต่ำกี่ตัว?", a: "คัดเองเริ่มได้ตั้งแต่ 1 ตัว ส่วนแบบให้ร้านเลือกให้ ขั้นต่ำ 100 กก." },
  { q: "ราคาในเครื่องคิดราคาเป็นราคาสุดท้ายไหม?", a: "เป็นราคาประเมินตามเรทปัจจุบัน ยังไม่รวมค่าส่ง ทีมงานเช็คของในสต๊อกแล้วโทรยืนยันยอดสุดท้ายก่อนโอน" },
  { q: "เหมา 100 กก. ส่งฟรีที่ไหน?", a: "ส่งฟรีเฉพาะภาคกลางและภาคใต้ ภาคอื่นแจ้งค่าส่งก่อนโอน หรือมารับเองที่โกดัง 1,000 บาท" },
];

const o = offerBySlug("stock")!;

export const metadata = {
  title: o.seoTitle,
  description: o.seoDesc,
  keywords: o.keywords,
  alternates: { canonical: "/catalog/stock" },
  openGraph: { title: o.seoTitle, description: o.seoDesc, url: "/catalog/stock" },
};

export default function StockPage() {
  return (
    <>
      <PageHero
        eyebrow="ผ้าสต๊อก KAN HUB"
        title="คิดราคาเองได้ ยิ่งเยอะยิ่งถูก"
        subtitle="คัดเองรายตัวตามเรทจำนวน หรือให้ทีมงานเลือกให้ เหมา 100 กก. 1,500฿ ส่งฟรี (ภาคกลาง และภาคใต้)"
      />

      <section className="bg-cream py-12">
        <Container className="max-w-3xl">
          <div className="grid gap-3 sm:grid-cols-2">
            <a href="#calc" className="rounded-2xl border-[1.5px] border-ink bg-white p-5 transition-shadow hover:shadow-md">
              <div className="text-[13px] font-bold text-brand">แบบที่ 1</div>
              <div className="mt-1 text-lg font-extrabold text-ink">คัดเองรายตัว</div>
              <div className="text-[14px] text-muted">เริ่ม 1 ตัว · 15–200฿/ตัว ตามจำนวน</div>
              <div className="mt-3 text-[14px] font-semibold text-brand">ลองคิดราคา ↓</div>
            </a>
            <a href="#bulk" className="rounded-2xl border border-hair bg-white p-5 transition-shadow hover:shadow-md">
              <div className="text-[13px] font-bold text-brand">แบบที่ 2</div>
              <div className="mt-1 text-lg font-extrabold text-ink">ให้เราเลือกให้</div>
              <div className="text-[14px] text-muted">เหมา 100 กก. 1,500฿ รวมส่ง · มารับเอง 1,000฿</div>
              <div className="mt-3 text-[14px] font-semibold text-brand">ดูรายละเอียด ↓</div>
            </a>
          </div>
        </Container>
      </section>

      <section id="calc" className="scroll-mt-20 bg-cream pb-14">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-extrabold text-ink">เครื่องคิดราคา · คัดเองรายตัว</h2>
          <p className="mb-5 mt-1 text-[14px] text-muted">
            เลือกหมวด ใส่จำนวน ระบบคิดราคาตามขั้นให้ทันที แล้วกดส่งให้ทีมงานเช็คของในสต๊อกและยืนยันราคา · อัปเดตราคา {data.updated}
          </p>
          <StockCalculator />
        </Container>
      </section>

      <section id="bulk" className="scroll-mt-20 bg-cream-100 py-14">
        <Container className="max-w-3xl">
          <StockBulk />
        </Container>
      </section>

      <section className="bg-cream py-14">
        <Container className="max-w-3xl">
          <h2 className="text-xl font-bold text-ink">ดูราคาแยกตามหมวด</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link key={c.slug} href={`/catalog/${c.slug}`} className="rounded-full border border-hair bg-white px-4 py-2 text-[14px] font-semibold text-ink hover:border-ink">{c.name}</Link>
            ))}
          </div>
          <OrderSteps />
          <h2 className="mt-12 text-xl font-bold text-ink">คำถามที่พบบ่อย</h2>
          <div className="mt-4 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="rounded-2xl border border-hair bg-white p-5 open:shadow-sm">
                <summary className="cursor-pointer list-none text-[15px] font-semibold text-ink">{f.q}</summary>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <RelatedArticles tag="stock" />
        </Container>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }) }} />
      </section>

      <CtaBand title="ไม่แน่ใจว่าจะเลือกแบบไหน?" subtitle="ทักมาบอกงบกับกลุ่มลูกค้าร้านคุณ ทีมงานช่วยจัดชุดที่เหมาะให้" />
    </>
  );
}
