import Link from "next/link";
import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";

export const metadata = {
  title: "ขายส่งทั่วไทย",
  description:
    "KAN HUB ขายส่งกระสอบเสื้อผ้ามือสองญี่ปุ่นทั่วไทย ยกก้อน–ยกถุง ราคาส่งเคาะจริง ยิ่งรับเยอะยิ่งถูก จัดส่งถึงร้าน เหมาะร้านมือสอง ตลาดนัด และคนเปิดร้านใหม่",
  keywords: ["ขายส่งเสื้อผ้ามือสอง", "แหล่งรับเสื้อผ้ามือสองมาขาย", "รับเสื้อผ้ามือสองมาขาย", "เสื้อผ้ามือสองยกกระสอบ", "ขายส่งเสื้อผ้ามือสองทั่วไทย"],
  alternates: { canonical: "/wholesale" },
};

const POINTS = [
  { icon: "🧺", title: "ยกก้อน–ยกถุง ราคาส่งต้นทาง", desc: "ตั้งแต่ก้อนใหญ่ 300–350 กก. ไปจนถึงถุง/ลัง เลือกได้ตามงบและพื้นที่ร้าน" },
  { icon: "📉", title: "ยิ่งรับเยอะ ยิ่งถูก", desc: "ราคาคิดเป็นขั้นบันไดตามจำนวน — รับมากได้ราคาส่งสุด เหมาะร้านประจำ" },
  { icon: "🚚", title: "ส่งทั่วไทย ถึงหน้าร้าน", desc: "จัดส่งทุกจังหวัด แจ้งเลขพัสดุติดตามได้ หรือมารับเองที่โกดัง 4 สาขา" },
  { icon: "🏷️", title: "ติดป้าย–พับ พร้อมขาย", desc: "เสริมบริการจัดก้อนสด คัด % หมวด ติดป้ายราคา พับใส่ถุง เปิดร้านได้ทันที" },
];

const QTY_TIERS = [
  { range: "1–2 ตัว", note: "ราคาปลีก" },
  { range: "3–5 ตัว", note: "ถูกลง" },
  { range: "6–11 ตัว", note: "ถูกลงอีก" },
  { range: "12–99 ตัว", note: "ราคาส่ง" },
  { range: "100 ตัว+", note: "ส่งสุด 🔥" },
];

const STATS = [
  { n: "77", l: "จังหวัดจัดส่ง" },
  { n: "4", l: "สาขาให้มารับเอง" },
  { n: "1", l: "กระสอบก็เริ่มได้" },
  { n: "100%", l: "นำเข้าตรงญี่ปุ่น" },
];

const SEGMENTS = [
  { icon: "🏪", t: "ร้านเสื้อผ้ามือสอง / โกดังย่อย" },
  { icon: "🛒", t: "พ่อค้าแม่ค้าตลาดนัด" },
  { icon: "🌱", t: "คนเปิดร้านใหม่ / ทดลองตลาด" },
  { icon: "📱", t: "ไลฟ์ขายออนไลน์ / เพจมือสอง" },
];

const STEPS = [
  { n: 1, t: "เลือกงาน + จำนวน", d: "บอกงบ ประเภท และจังหวัดปลายทาง" },
  { n: 2, t: "เคาะราคาส่ง + ค่าส่ง", d: "สรุปยอดชัดเจนก่อนโอนบัญชีบริษัท" },
  { n: 3, t: "จัดส่ง / นัดรับเอง", d: "ส่งทั่วไทยพร้อมเลขพัสดุ หรือมารับที่โกดัง" },
];

export default function WholesalePage() {
  return (
    <>
      <PageHero
        eyebrow="ขายส่งทั่วไทย"
        title="ขายส่งกระสอบเสื้อผ้ามือสองญี่ปุ่น ส่งถึงร้านทั่วประเทศ"
        subtitle="ยกก้อน–ยกถุง ราคาส่งเคาะจริง ยิ่งรับเยอะยิ่งถูก — เหมาะทั้งร้านประจำและคนเริ่มต้น"
      />

      {/* stat row */}
      <section className="border-b border-hair bg-cream">
        <Container>
          <div className="grid grid-cols-2 gap-6 py-10 text-center md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.l}>
                <div className="text-3xl font-extrabold text-brand sm:text-4xl">{s.n}</div>
                <div className="mt-1 text-sm text-muted">{s.l}</div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* value props */}
      <section className="bg-cream py-16">
        <Container>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">ทำไมร้านค้าเลือกรับส่งกับ KAN HUB</h2>
            <p className="mx-auto mt-2 max-w-xl text-[15px] text-muted">นำเข้าตรง ราคาต้นทาง พร้อมบริการที่ทำให้คุณขายง่ายขึ้น</p>
          </div>
          <div className="mt-9 grid gap-5 sm:grid-cols-2">
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

      {/* bulk pricing ladder */}
      <section className="bg-dark py-16 text-white">
        <Container>
          <div className="text-center">
            <p className="eyebrow mb-2.5">ยิ่งรับเยอะ ยิ่งถูก</p>
            <h2 className="text-2xl font-bold sm:text-3xl">ราคาต่อตัวลดลงตามจำนวนที่รับ</h2>
            <p className="mx-auto mt-2 max-w-xl text-[15px] text-white/65">
              ราคาปลีกคิดเป็นขั้นบันได — รับ 100 ตัวขึ้นไปได้ราคาส่งสุด (ราคาจริงต่อรายการแจ้งในไลน์)
            </p>
          </div>
          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {QTY_TIERS.map((q, i) => (
              <div
                key={q.range}
                className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
                style={{ background: `rgba(200,16,46,${0.08 + i * 0.14})` }}
              >
                <div className="text-[15px] font-bold text-white">{q.range}</div>
                <div className="mt-1 text-xs text-white/70">{q.note}</div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-[13px] text-white/50">ตัวอย่าง: เสื้อโค้ทเริ่ม 100฿/ตัว → เหลือ 45฿/ตัว เมื่อรับ 100 ตัวขึ้นไป</p>
        </Container>
      </section>

      {/* segments */}
      <section className="bg-cream py-16">
        <Container>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">เหมาะกับใคร</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SEGMENTS.map((s) => (
              <div key={s.t} className="rounded-2xl border border-hair bg-white p-6 text-center">
                <div className="text-3xl">{s.icon}</div>
                <p className="mt-3 text-[15px] font-medium text-ink">{s.t}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* process */}
      <section className="bg-cream-100 py-16">
        <Container>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">รับส่งง่ายใน 3 ขั้นตอน</h2>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-hair bg-white p-6">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand text-lg font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">{s.t}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/how-to-order" className="text-sm font-semibold text-brand hover:text-brand-dark">
              ดูวิธีสั่งซื้อแบบละเอียด →
            </Link>
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
