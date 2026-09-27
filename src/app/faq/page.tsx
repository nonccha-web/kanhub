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
  { q: "กระสอบมือสอง 1 กระสอบกี่ตัว?", a: "กระสอบ 45 กก. ขึ้นกับความหนาของผ้า — ผ้าบาง ~250 ตัว (เฉลี่ย ~20฿/ตัว), ผ้าหนา ~100 ตัว (~50฿/ตัว), ผ้าหนามาก ~60 ตัว (~83฿/ตัว) ราคาราว 5,000฿ ต่อกระสอบ" },
  { q: "เกรด A กับ B-C ต่างกันยังไง?", a: "เกรด A คือสภาพดีพร้อมขาย ตำหนิน้อยมาก เหมาะแขวนร้าน · เกรด B-C มีตำหนิเล็กน้อย ราคาถูกกว่ามาก เหมาะขายเหมา/ตลาดนัด — กระสอบ 45 กก. เป็นเกรด A-B ส่วนกระสอบโปรโมชั่นเป็นเกรด B-C" },
  { q: "สั่งขั้นต่ำเท่าไหร่?", a: "ผ้าสต๊อกคัดเองเริ่มได้ตั้งแต่ 1 ตัว ยิ่งเยอะยิ่งถูก (คิดราคาเองได้ที่หน้า คิดราคา) · ถ้าให้เราเลือกให้ ขั้นต่ำ 100 กก. 1,500฿ รวมส่ง · กระสอบ 45 กก. และก้อน 350 กก. เริ่มที่ 1 กระสอบ/ก้อน" },
  { q: "มารับเองที่โกดังได้ไหม?", a: "ได้เลย นัดล่วงหน้าทาง LINE เข้ามาคัด/ดูของเองที่โกดังได้ทั้ง 4 สาขาในภาคใต้" },
  { q: "KAN ขายปลีกแข่งกับร้านเรามั้ย?", a: "ไม่แข่ง เราเน้นขายส่งให้ร้านค้า ไม่ลงไปตัดราคาขายปลีกแข่งกับลูกค้าของเราเอง" },
  { q: "KAN HUB ขายแบบไหนบ้าง?", a: "มี 4 แบบ: ก้อนผ้า 350 กก. (OSAKA 8,000–9,000฿ · NAGOYA 11,000–13,000฿) · กระสอบผ้า 45 กก. เกรด A-B ราว 5,000฿ · กระสอบผ้าโปรโมชั่น (ตอนนี้ผ้าเกรด B-C 250 ตัว 1,500฿ ส่งฟรีภาคกลาง/ใต้) · ผ้าสต๊อกคัดเองรายตัวตามเรทจำนวน หรือเหมา 100 กก. 1,500฿ รวมส่ง" },
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
