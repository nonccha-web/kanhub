import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "วิธีสั่งซื้อ",
  description:
    "วิธีสั่งกระสอบเสื้อผ้ามือสองญี่ปุ่นกับ KAN HUB — ทักไลน์เลือกก้อน โอนเข้าบัญชีบริษัท แล้วรอรับของ ส่งทั่วไทยหรือมารับเองที่โกดัง",
  alternates: { canonical: "/how-to-order" },
};

const STEPS = [
  { n: 1, title: "ทักไลน์ / เลือกก้อน", desc: "แอด LINE @kanhub บอกงบและประเภทที่สนใจ ทีมงานแนะนำก้อนที่เหมาะกับร้านคุณ พร้อมส่งรูป/คลิปของจริง" },
  { n: 2, title: "ยืนยันออเดอร์ + ค่าส่ง", desc: "สรุปรายการ ราคา และค่าจัดส่ง (หรือเลือกมารับเองที่โกดัง) ก่อนชำระเงินทุกครั้ง" },
  { n: 3, title: "โอนเข้าบัญชีบริษัทเท่านั้น", desc: "ชำระเข้าบัญชีบริษัท KAN HUB เพื่อความปลอดภัย ส่งสลิปยืนยันในไลน์ (ระวังมิจฉาชีพแอบอ้าง)" },
  { n: 4, title: "แพ็ก & จัดส่ง / นัดรับ", desc: "เราแพ็กและจัดส่งทั่วไทย แจ้งเลขพัสดุให้ติดตาม หรือนัดวันเข้ามารับ/คัดเองที่โกดัง" },
];

export default function HowToOrderPage() {
  return (
    <>
      <PageHero
        eyebrow="วิธีสั่งซื้อ"
        title="สั่งกระสอบกับ KAN HUB ง่ายใน 4 ขั้นตอน"
        subtitle="เริ่มได้ที่ 1 กระสอบ ไม่มีขั้นต่ำสูง — ทักไลน์ เลือกก้อน โอนบัญชีบริษัท แล้วรอรับของ"
      />

      <section className="bg-cream py-16">
        <Container>
          <div className="grid gap-5 md:grid-cols-2">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4 rounded-2xl border border-hair bg-white p-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold text-white">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-[#f6c9c9] bg-[#fdecec] px-4 py-3 text-center text-sm text-[#8c1d1d]">
            ⚠️ เพื่อความปลอดภัย — <span className="font-bold">โอนเข้าบัญชีบริษัทเท่านั้น</span> ระวังมิจฉาชีพแอบอ้างชื่อ KAN HUB
          </div>
        </Container>
      </section>

      <CtaBand
        title="พร้อมสั่งกระสอบแรกแล้วใช่ไหม?"
        subtitle={`ทักไลน์ ${SITE.lineId} ทีมงานช่วยเลือกก้อนที่ใช่ให้เลย`}
      />
    </>
  );
}
