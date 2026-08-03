import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";

export const metadata = {
  title: "บริการ",
  description:
    "บริการของ KAN HUB — จัดก้อนสดเลือก % หมวดเอง, ชุด 100 ชิ้นพร้อมขาย, บริการติดป้าย–พับ, และให้คำปรึกษาเปิดร้าน–เปิดโกดังเสื้อผ้ามือสอง",
  alternates: { canonical: "/service" },
};

const SERVICES = [
  { icon: "🎯", title: "จัดก้อนสด เลือก % หมวดเอง", desc: "กำหนดสัดส่วนหมวดที่อยากได้ (เสื้อยืด/ยีนส์/เดรส/แบรนด์ ฯลฯ) เราคัดจัดก้อนสดให้ตรงกลุ่มลูกค้าหน้าร้านคุณ", tag: "ยอดนิยม" },
  { icon: "📦", title: "ชุด 100 ชิ้นพร้อมขาย", desc: "งานคัดพร้อมขาย 100 ชิ้น ติดป้าย–พับเรียบร้อย เหมาะคนเริ่มต้น ทดลองตลาดก่อนรับยกกระสอบ", tag: "เริ่มต้นง่าย" },
  { icon: "🏷️", title: "บริการติดป้าย–พับ", desc: "เสริมบริการติดป้ายราคา พับใส่ถุง จัดเซ็ต ให้พร้อมวางขายหน้าร้าน–ลงตลาดนัดได้ทันที", tag: null },
  { icon: "🏪", title: "ปรึกษาเปิดร้าน–เปิดโกดัง", desc: "แนะนำการเลือกงาน ตั้งราคา และจัดร้านสำหรับคนอยากเปิดร้าน/โกดังเสื้อผ้ามือสองของตัวเอง", tag: null },
];

export default function ServicePage() {
  return (
    <>
      <PageHero
        eyebrow="บริการของเรา"
        title="ไม่ใช่แค่ขายกระสอบ — เราช่วยให้คุณขายง่ายขึ้น"
        subtitle="ตั้งแต่จัดก้อนสดตามใจ ไปจนถึงงานพร้อมขายและคำปรึกษาเปิดร้าน"
      />

      <section className="bg-cream py-16">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2">
            {SERVICES.map((s) => (
              <div key={s.title} className="rounded-2xl border border-hair bg-white p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-cream-100 text-xl">{s.icon}</span>
                  {s.tag && (
                    <span className="rounded-md bg-brand px-2.5 py-1 text-xs font-bold text-white">{s.tag}</span>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand
        title="อยากได้บริการแบบไหน ทักมาคุยได้เลย"
        subtitle="บอกความต้องการของร้านคุณ เดี๋ยวทีมงานจัดบริการให้เหมาะที่สุด"
      />
    </>
  );
}
