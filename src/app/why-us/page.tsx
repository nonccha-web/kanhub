import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";

export const metadata = {
  title: "ทำไมต้อง KAN HUB",
  description:
    "KAN HUB โกดังขายส่งเสื้อผ้ามือสองญี่ปุ่น นำเข้าตรงไม่ผ่านคนกลาง บริษัทจริงจดทะเบียนถูกต้อง มีโกดัง 4 สาขาในภาคใต้ คัดเกรด A ขายต่อง่าย กำไรดี",
  keywords: ["เสื้อผ้ามือสองญี่ปุ่นแท้", "โกดังเสื้อผ้ามือสอง", "เสื้อผ้ามือสองนำเข้าตรง", "เสื้อผ้ามือสองภาคใต้", "เสื้อผ้ามือสองญี่ปุ่น"],
  alternates: { canonical: "/why-us" },
};

const REASONS = [
  { icon: "🚢", title: "นำเข้าตรงจากญี่ปุ่น ไม่ผ่านคนกลาง", desc: "ตู้คอนเทนเนอร์เข้าท่าเรือตรงถึงโกดังเรา คุณได้ราคาต้นทาง ของเกรดดีกว่าที่หาได้ทั่วไป" },
  { icon: "🏢", title: "บริษัทจริง มีโกดังให้มาดูของ", desc: "ไม่ใช่เพจปลอม จดทะเบียนถูกต้อง มีหน้าร้าน 4 สาขาในภาคใต้ นัดมาคัดเองหน้าโกดังได้" },
  { icon: "💰", title: "คัดเกรด A ขายต่อง่าย กำไรดี", desc: "งานทุกกระสอบผ่านการคัดเกรด พร้อมบริการติดป้าย-พับให้ เปิดร้าน-ขายตลาดนัดได้ทันที" },
  { icon: "📸", title: "เปิดกระสอบถ่ายให้ดูก่อนส่ง", desc: "เห็นของจริงทุกก้อน ทั้งไลฟ์และคลิปบนเพจ ไม่ต้องเสี่ยงซื้อของที่ไม่เห็นหน้า" },
  { icon: "🚚", title: "ส่งทั่วไทย หรือมารับเองที่โกดัง", desc: "จัดส่งทั่วประเทศ หรือนัดเข้ามารับ/คัดเองที่โกดังได้ทั้ง 4 สาขา" },
  { icon: "🛡️", title: "โอนบัญชีบริษัท ปลอดภัยหายห่วง", desc: "ชำระเข้าบัญชีบริษัทเท่านั้น มีเอกสารครบ สบายใจ ไม่ต้องกลัวมิจฉาชีพแอบอ้าง" },
];

const STATS = [
  { n: "4", l: "สาขาโกดังภาคใต้" },
  { n: "100%", l: "นำเข้าตรงญี่ปุ่น" },
  { n: "เกรด A", l: "มาตรฐานการคัด" },
  { n: "ทั่วไทย", l: "จัดส่งถึงร้าน" },
];

export default function WhyUsPage() {
  return (
    <>
      <PageHero
        eyebrow="ทำไมต้อง KAN"
        title="เสื้อผ้ามือสองภาคใต้ ของแท้ญี่ปุ่น ขายง่าย กำไรดี"
        subtitle="KAN HUB คือโกดังขายส่งกระสอบเสื้อผ้ามือสองญี่ปุ่นที่นำเข้าตรง บริษัทจริง มีหน้าร้านให้มาดูของก่อนซื้อ"
      />

      <section className="bg-cream py-16">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {REASONS.map((r) => (
              <div key={r.title} className="rounded-2xl border border-hair bg-white p-6">
                <span className="mb-3 inline-grid h-11 w-11 place-items-center rounded-xl bg-cream-100 text-xl">
                  {r.icon}
                </span>
                <h3 className="text-lg font-semibold text-ink">{r.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{r.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-cream-100 py-14">
        <Container>
          <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.l}>
                <div className="text-3xl font-extrabold text-brand sm:text-4xl">{s.n}</div>
                <div className="mt-1 text-sm text-muted">{s.l}</div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
