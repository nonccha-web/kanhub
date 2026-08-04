import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "คำถามพบบ่อย (FAQ)",
  description:
    "รวมคำถามที่พบบ่อยเกี่ยวกับการสั่งกระสอบเสื้อผ้ามือสองญี่ปุ่นกับ KAN HUB — จำนวนต่อกระสอบ เกรด A/B ขั้นต่ำ การรับของ การชำระเงิน และการจัดส่ง",
  keywords: ["กระสอบเสื้อผ้ามือสองกี่ตัว", "เกรด a b เสื้อผ้ามือสอง", "สั่งกระสอบขั้นต่ำ", "ก้อนผ้ากี่กิโล", "เสื้อผ้ามือสองยกกระสอบ"],
  alternates: { canonical: "/faq" },
};

const FAQ = [
  { q: "กระสอบมือสอง 1 กระสอบกี่ตัว?", a: "ขึ้นกับหมวด — เสื้อยืด ~180–220 ตัว, ยีนส์ ~90–110 ตัว, เดรส ~160–200 ตัว ต่อกระสอบ 45 กก. เราระบุจำนวนโดยประมาณไว้ทุกการ์ดสินค้า" },
  { q: "เกรด A กับ B ต่างกันยังไง?", a: "เกรด A คือสภาพดีพร้อมขาย ตำหนิน้อยมาก เหมาะแขวนร้าน · เกรด B มีตำหนิเล็กน้อย ราคาถูกกว่า เหมาะขายเหมา/ตลาดนัด" },
  { q: "สั่งกระสอบ ขั้นต่ำเท่าไหร่?", a: "เริ่มได้ที่ 1 กระสอบ ไม่มีขั้นต่ำสูง เหมาะทั้งมือใหม่ทดลองตลาดและร้านประจำที่รับซ้ำ" },
  { q: "มารับเองที่โกดังได้ไหม?", a: "ได้เลย นัดล่วงหน้าทาง LINE เข้ามาคัด/ดูของเองที่โกดังได้ทั้ง 4 สาขาในภาคใต้" },
  { q: "KAN ขายปลีกแข่งกับร้านเรามั้ย?", a: "ไม่แข่ง เราเน้นขายส่งให้ร้านค้า ไม่ลงไปตัดราคาขายปลีกแข่งกับลูกค้าของเราเอง" },
  { q: "ราคา Tier A / B / C / D คิดยังไง?", a: "Tier A คือก้อนผ้ายกก้อน (300–350 กก.) · Tier B โค้ท-ไหมพรมคิดเป็นถุง · Tier C ผ้าเหมา/คัดแยกเป็นถุง/ลัง · Tier D งานเบ็ดเตล็ดเป็นพาเลท/ลัง/แบ็ก — ราคาส่งเคาะจริงแจ้งในไลน์" },
  { q: "ชำระเงินยังไงให้ปลอดภัย?", a: "โอนเข้าบัญชีบริษัท KAN HUB เท่านั้น มีเอกสารครบ ส่งสลิปยืนยันในไลน์ — โปรดระวังมิจฉาชีพแอบอ้างชื่อร้าน" },
  { q: "จัดส่งทั่วไทยไหม ค่าส่งเท่าไหร่?", a: "ส่งทั่วประเทศ ค่าส่งขึ้นกับน้ำหนัก/ปลายทาง แจ้งยอดให้ก่อนโอนทุกครั้ง หรือมารับเองที่โกดังก็ได้" },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function FaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <PageHero
        eyebrow="คำถามพบบ่อย"
        title="เรื่องที่ลูกค้าถามบ่อย"
        subtitle="รวมคำตอบเรื่องกระสอบ เกรดสินค้า การสั่งซื้อ การชำระเงิน และการจัดส่ง"
      />

      <section className="bg-cream py-16">
        <Container className="max-w-3xl">
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-xl border border-hair bg-white px-5 py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-xl text-brand transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand
        title="ยังไม่เจอคำตอบ?"
        subtitle={`ทักไลน์ ${SITE.lineId} ถามได้เลย ตอบไวทุกวัน 9:00–21:00`}
      />
    </>
  );
}
