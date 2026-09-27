import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/Container";
import { CtaBand } from "@/components/CtaBand";
import { StockBulk } from "@/components/sale/StockBulk";
import { CATEGORIES } from "@/lib/categories";
import { SITE } from "@/lib/site";

/* ผ้าหาง / ผ้าเหมา / ผ้ากิโล — คำค้นกลุ่มนี้เดิมอยู่ที่ Tier C ซึ่งถูกรวมเข้าหน้าคิดราคาไปแล้ว
   หน้านี้ตอบคำว่า "ผ้าหางคืออะไร" + ขายจริง 2 แบบ: เหมา 100 กก. (ผ้าสต๊อก) และกระสอบโปรผ้าปลดราว */

const TITLE = "ผ้าหาง ผ้าเหมา ขายเป็นกิโล 100 กก. 1,500 บาท ส่งฟรี";
const DESC =
  "ผ้าหาง ผ้าเหมาหาง ผ้าเหมากิโล เสื้อผ้ามือสองญี่ปุ่นราคาถูกที่สุด เหมา 100 กก. 1,500 บาทรวมส่ง (มารับเอง 1,000) หรือผ้าปลดราวเกรด B-C 250 ตัว 1,500 บาท ส่งฟรีภาคกลางและภาคใต้ — KAN HUB";

export const metadata = {
  title: TITLE,
  description: DESC,
  keywords: ["ผ้าหาง", "ผ้าเหมา", "ผ้าเหมาหาง", "หางผ้า", "ผ้าเหมากิโล", "เสื้อผ้ามือสองกิโลละ", "ผ้าโล", "ผ้าชั่งกิโล", "ผ้าปลดราว", "ผ้าเกรด B", "ผ้าเกรด C"],
  alternates: { canonical: "/catalog/pha-hang" },
  openGraph: { title: TITLE, description: DESC, url: "/catalog/pha-hang", images: ["/img/products/tier-c/mao-hang/1.jpg"] },
};

const FAQS = [
  { q: "ผ้าหางคืออะไร?", a: "ผ้าหางคือเสื้อผ้ามือสองส่วนที่เหลือหลังคัด \"หัว\" (ตัวสวยเกรด A) ออกไปแล้ว รวมถึงผ้าปลดราวที่วางขายหน้าร้านมาระยะหนึ่ง สภาพยังใช้ได้ อาจมีตำหนิเล็กน้อย ราคาจึงถูกที่สุดในบรรดาเสื้อผ้ามือสอง" },
  { q: "ผ้าเหมา ผ้าหาง ผ้าโล ต่างกันไหม?", a: "เรียกต่างกันตามพื้นที่แต่หมายถึงผ้ากลุ่มเดียวกัน คือผ้าราคาถูกที่ขายเหมาเป็นกิโลหรือเป็นชุด ไม่ได้เลือกทีละตัว ที่ KAN HUB มี 2 แบบ คือเหมา 100 กก. กับกระสอบผ้าปลดราว 250 ตัว" },
  { q: "ผ้าเหมากิโลละเท่าไหร่?", a: "เหมา 100 กก. 1,500 บาท รวมค่าส่ง (เฉลี่ย 15 บาท/กก.) ถ้ามารับเองที่โกดัง 1,000 บาท (10 บาท/กก.) ขั้นต่ำ 100 กก." },
  { q: "ส่งฟรีที่ไหนบ้าง?", a: "ส่งฟรีเฉพาะภาคกลางและภาคใต้ ภาคอื่นทีมงานแจ้งค่าส่งให้ก่อนโอน" },
  { q: "เลือกหมวดเองได้ไหม?", a: "แบบเหมา ทีมงานเลือกให้ ถ้าอยากเลือกเองทีละตัว ใช้เครื่องคิดราคารายตัว เริ่ม 15 บาท/ตัว ยิ่งเยอะยิ่งถูก" },
  { q: "ผ้าหางเหมาะกับใคร?", a: "ร้านเปิดท้าย ตลาดนัด ร้านตัวละ 10–20 บาท ขายไลฟ์ราคาต่ำ และคนเริ่มขายเสื้อผ้ามือสองที่อยากลงทุนน้อย" },
];

const COMPARE = [
  { t: "ผ้าหาง / ผ้าเหมา", g: "คละ ทีมเลือกให้", p: "100 กก. 1,500฿ รวมส่ง", w: "ร้านตัวละ 10–20 บาท ตลาดนัด ขายไลฟ์", href: "#buy" },
  { t: "กระสอบผ้า 45 กก.", g: "A-B", p: "ราว 5,000฿ / กระสอบ", w: "ร้านมือสองที่อยากได้ของพร้อมแขวน", href: "/catalog/sack-45" },
  { t: "ก้อนผ้า 350 กก.", g: "ยังไม่คัด", p: "8,000–13,000฿ / ก้อน", w: "โกดัง ร้านใหญ่ที่คัดเอง", href: "/catalog/bale" },
];

const IMGS = ["/img/products/tier-c/mao-hang/1.jpg", "/img/products/tier-c/mao-hang/2.jpg", "/img/products/tier-c/mao-hang/3.jpg", "/img/products/tier-c/mao-hang/4.jpg",
  "/img/products/tier-c/mao-hang-nakhon/1.jpg", "/img/products/tier-c/mao-hang-nakhon/2.jpg", "/grade-b/img/tops-05-l.webp", "/grade-b/img/pants-03-l.webp"];

export default function PhaHangPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: "ผ้าหาง ผ้าเหมา 100 กก.",
        description: DESC,
        image: `${SITE.url}${IMGS[0]}`,
        brand: { "@type": "Brand", name: SITE.name },
        offers: { "@type": "AggregateOffer", priceCurrency: "THB", lowPrice: 1000, highPrice: 1500, offerCount: 2,
                  availability: "https://schema.org/InStock", url: `${SITE.url}/catalog/pha-hang/` },
      },
      { "@type": "FAQPage", mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="bg-dark py-12 text-white sm:py-14">
        <Container>
          <nav className="mb-3 text-[13px] text-white/55">
            <Link href="/" className="hover:text-white">หน้าแรก</Link> › <Link href="/catalog" className="hover:text-white">สินค้า</Link> › <span className="text-white/80">ผ้าหาง / ผ้าเหมา</span>
          </nav>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
            ผ้าหาง ผ้าเหมา ขายเป็นกิโล <span className="text-gold">100 กก. 1,500 บาท ส่งฟรี*</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/75">
            ผ้าสต๊อกมือสองญี่ปุ่นราคาถูกที่สุดของ KAN HUB ทีมงานเลือกให้ ขายเหมาเป็นกิโล เหมาะร้านตัวละ 10–20 บาท ตลาดนัด และขายไลฟ์ · *ส่งฟรีภาคกลางและภาคใต้
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#buy" className="inline-flex items-center rounded-xl bg-brand px-6 py-3.5 text-[15px] font-bold text-white hover:bg-brand-dark">สั่งเหมา 100 กก. →</a>
            <a href="/grade-b/" className="inline-flex items-center rounded-xl border-[1.5px] border-white/40 px-6 py-3.5 text-[15px] font-bold text-white hover:bg-white/10">ดูผ้าปลดราว 250 ตัว</a>
          </div>
        </Container>
      </section>

      <section className="bg-cream py-12">
        <Container className="max-w-3xl">
          <h2 className="text-xl font-bold text-ink">ผ้าหางคืออะไร?</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-ink/85">
            ผ้าหาง คือเสื้อผ้ามือสองส่วนที่เหลือหลังจากคัด &quot;หัว&quot; หรือตัวสวยเกรด A ออกไปแล้ว รวมถึงผ้าปลดราวที่วางขายหน้าร้านมาระยะหนึ่ง
            สภาพยังใช้ได้ อาจมีตำหนิเล็กน้อย เช่น รอยเปื้อนจาง ด้ายหลุด หรือกระดุมหาย ราคาจึงถูกกว่าผ้าคัดหลายเท่า
          </p>
          <p className="mt-3 text-[16px] leading-relaxed text-ink/85">
            แต่ละที่เรียกต่างกัน ทั้ง ผ้าหาง หางผ้า ผ้าเหมา ผ้าเหมาหาง ผ้าโล ผ้าชั่งกิโล หรือผ้าปลดราว ความหมายเดียวกัน คือผ้าราคาถูกที่ซื้อเหมาเป็นกิโลหรือเป็นชุด ไม่ได้เลือกทีละตัว
          </p>

          <h2 className="mt-10 text-xl font-bold text-ink">ผ้าหางกับผ้าแบบอื่น ต่างกันยังไง</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-hair bg-white">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead className="bg-cream-100 text-muted">
                <tr><th className="px-4 py-3">แบบ</th><th className="px-3 py-3">เกรด</th><th className="px-3 py-3">ราคา</th><th className="px-3 py-3">เหมาะกับ</th></tr>
              </thead>
              <tbody>
                {COMPARE.map((c, i) => (
                  <tr key={c.t} className={`border-t border-hair ${i === 0 ? "bg-[#fff6f6]" : ""}`}>
                    <td className="px-4 py-3 font-semibold"><a href={c.href} className="text-ink underline-offset-2 hover:underline">{c.t}</a></td>
                    <td className="px-3 py-3">{c.g}</td>
                    <td className="px-3 py-3 font-semibold text-brand">{c.p}</td>
                    <td className="px-3 py-3 text-muted">{c.w}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <section id="buy" className="scroll-mt-20 bg-cream-100 py-12">
        <Container className="max-w-3xl">
          <h2 className="mb-4 text-xl font-bold text-ink">ซื้อผ้าหางที่ KAN HUB ได้ 2 แบบ</h2>
          <StockBulk />
          <a href="/grade-b/" className="mt-4 flex items-center justify-between gap-4 rounded-2xl border-[1.5px] border-brand bg-white p-5 hover:shadow-md">
            <div>
              <div className="text-[13px] font-bold text-brand">โปรโมชั่น · ผ้าปลดราวเกรด B-C</div>
              <div className="mt-1 text-lg font-extrabold text-ink">นับเป็นตัว 250 ตัว 1,500฿ ส่งฟรี*</div>
              <p className="mt-1 text-[14px] text-muted">คละเสื้อ เดรส กางเกง กระโปรง ดูรูปจริงได้ทุกตัว</p>
            </div>
            <span className="shrink-0 text-[15px] font-bold text-brand">ดูรูป →</span>
          </a>
        </Container>
      </section>

      <section className="bg-cream py-12">
        <Container className="max-w-3xl">
          <h2 className="text-xl font-bold text-ink">รูปจริงผ้าเหมาจากโกดัง</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {IMGS.map((src, i) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-xl border border-hair bg-cream-100">
                <Image src={src} alt={`ผ้าหาง ผ้าเหมา มือสอง KAN HUB ${i + 1}`} fill loading="lazy" sizes="(max-width:640px) 50vw, 180px" className="object-cover" />
              </div>
            ))}
          </div>

          <h2 className="mt-12 text-xl font-bold text-ink">คำถามที่พบบ่อยเรื่องผ้าหาง</h2>
          <div className="mt-4 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="rounded-2xl border border-hair bg-white p-5 open:shadow-sm">
                <summary className="cursor-pointer list-none text-[15px] font-semibold text-ink">{f.q}</summary>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>

          <h2 className="mt-10 text-lg font-bold text-ink">อยากเลือกเองทีละหมวด</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link key={c.slug} href={`/catalog/${c.slug}`} className="rounded-full border border-hair bg-white px-4 py-2 text-[14px] font-semibold text-ink hover:border-ink">{c.name}</Link>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand title="ถามเรื่องผ้าหางเพิ่มเติม?" subtitle="ทักไลน์ขอคลิปผ้าเหมาล็อตล่าสุด ทีมงานส่งให้ดูก่อนโอน" />
    </>
  );
}
