import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";

export const metadata = {
  title: "ขายส่งทั่วไทย",
  description:
    "KAN HUB ขายส่งกระสอบเสื้อผ้ามือสองญี่ปุ่นทั่วไทย ยกก้อน–ยกถุง ราคาส่งเคาะจริง ยิ่งรับเยอะยิ่งถูก จัดส่งถึงร้าน เหมาะร้านมือสอง ตลาดนัด และคนเปิดร้านใหม่",
  alternates: { canonical: "/wholesale" },
};

const POINTS = [
  { icon: "🧺", title: "ยกก้อน–ยกถุง ราคาส่งต้นทาง", desc: "ตั้งแต่ก้อนใหญ่ 300–350 กก. ไปจนถึงถุง/ลัง เลือกได้ตามงบและพื้นที่ร้าน" },
  { icon: "📉", title: "ยิ่งรับเยอะ ยิ่งถูก", desc: "ราคาปลีกคิดเป็นขั้นบันไดตามจำนวน — รับ 100 ตัวขึ้นไปได้ราคาส่งสุด เหมาะร้านประจำ" },
  { icon: "🚚", title: "ส่งทั่วไทย ถึงหน้าร้าน", desc: "จัดส่งทุกจังหวัด แจ้งเลขพัสดุติดตามได้ หรือมารับเองที่โกดังทั้ง 4 สาขาภาคใต้" },
  { icon: "🏷️", title: "บริการติดป้าย–พับ พร้อมขาย", desc: "เสริมบริการจัดก้อนสด คัด % หมวด ติดป้ายราคา พับใส่ถุง เปิดร้าน–ลงตลาดนัดได้ทันที" },
];

const SEGMENTS = [
  "ร้านเสื้อผ้ามือสอง / โกดังย่อย",
  "พ่อค้าแม่ค้าตลาดนัด",
  "คนเปิดร้านใหม่ / ทดลองตลาด",
  "ไลฟ์ขายออนไลน์ / เพจมือสอง",
];

export default function WholesalePage() {
  return (
    <>
      <PageHero
        eyebrow="ขายส่งทั่วไทย"
        title="ขายส่งกระสอบเสื้อผ้ามือสองญี่ปุ่น ส่งถึงร้านทั่วประเทศ"
        subtitle="ยกก้อน–ยกถุง ราคาส่งเคาะจริง ยิ่งรับเยอะยิ่งถูก — เหมาะทั้งร้านประจำและคนเริ่มต้น"
      />

      <section className="bg-cream py-16">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2">
            {POINTS.map((p) => (
              <div key={p.title} className="flex gap-4 rounded-2xl border border-hair bg-white p-6">
                <span className="text-2xl leading-none">{p.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold text-ink">{p.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-cream-100 py-14">
        <Container className="text-center">
          <h2 className="text-2xl font-bold text-ink">เหมาะกับใคร</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {SEGMENTS.map((s) => (
              <span key={s} className="rounded-full border border-hair bg-white px-4 py-2 text-sm font-medium text-ink/80">
                {s}
              </span>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand
        title="รับส่งทั่วไทย — ขอราคาส่งได้เลย"
        subtitle="แจ้งจังหวัดและปริมาณที่ต้องการ ทีมงานคำนวณราคาส่ง + ค่าจัดส่งให้ทันที"
      />
    </>
  );
}
