import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { LineIcon, FbIcon } from "@/components/BrandIcons";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "บทความ & เคล็ดลับเปิดร้านเสื้อผ้ามือสอง",
  description:
    "รวมบทความและเคล็ดลับขายเสื้อผ้ามือสองญี่ปุ่นจาก KAN HUB — วิธีเปิดร้านมือสอง เลือกกระสอบ/ก้อนผ้า ตั้งราคาขายต่อ และเทคนิคขายดีสำหรับร้านและตลาดนัด",
  keywords: ["เปิดร้านเสื้อผ้ามือสอง", "ขายเสื้อผ้ามือสอง", "ธุรกิจเสื้อผ้ามือสอง", "อยากขายเสื้อผ้ามือสองเริ่มยังไง"],
  alternates: { canonical: "/blog" },
};

const CATS: Record<string, string> = {
  "มือใหม่": "#0e7c66",
  "เลือกของ": "#e0a93b",
  "ขายดี": "#c8102e",
  "หน้าหนาว": "#1a1413",
};

const FEATURED = {
  cat: "มือใหม่",
  title: "เปิดร้านเสื้อผ้ามือสองต้องเริ่มยังไง? ฉบับจับมือทำ",
  desc: "ตั้งแต่เลือกกระสอบแรก คำนวณต้นทุนต่อตัว ตั้งราคา ไปจนถึงจัดร้านให้ขายดี — คู่มือครบสำหรับคนอยากเริ่มธุรกิจเสื้อผ้ามือสอง",
  read: "อ่าน 8 นาที",
};

const POSTS = [
  { cat: "เลือกของ", title: "กระสอบเกรด A vs B ต่างกันยังไง เลือกแบบไหนคุ้มกว่า", desc: "อ่านก่อนสั่ง จะได้เลือกงานให้ตรงกลุ่มลูกค้าหน้าร้าน", read: "5 นาที" },
  { cat: "ขายดี", title: "ตั้งราคาขายต่อเสื้อผ้ามือสองยังไงให้กำไรดี", desc: "สูตรคิดต้นทุนต่อตัว + เทคนิคตั้งราคาหน้าร้านและตลาดนัด", read: "6 นาที" },
  { cat: "หน้าหนาว", title: "โค้ท-ไหมพรมญี่ปุ่น ทำไมขายดีช่วงปลายปี", desc: "จับจังหวะสต๊อกงานหน้าหนาวก่อนใคร ทำยอดช่วงไฮซีซั่น", read: "4 นาที" },
  { cat: "มือใหม่", title: "5 หมวดเสื้อผ้ามือสองที่ขายง่ายสุดสำหรับมือใหม่", desc: "เริ่มจากหมวดที่หมุนเร็ว ขายง่าย คืนทุนไว", read: "5 นาที" },
  { cat: "เลือกของ", title: "Tier A–D ของ KAN HUB เลือกยังไงให้เหมาะกับร้าน", desc: "ไกด์เลือกระดับงานตามงบและกลุ่มลูกค้า", read: "4 นาที" },
  { cat: "ขายดี", title: "ไลฟ์ขายเสื้อผ้ามือสองให้ปัง เทคนิคเปิดกระสอบสด", desc: "จัดไลฟ์ให้คนดูจองรัว ๆ ตั้งแต่เปิดกระสอบแรก", read: "6 นาที" },
];

function Chip({ cat }: { cat: string }) {
  return (
    <span
      className="inline-block rounded-md px-2.5 py-1 text-xs font-bold text-white"
      style={{ background: CATS[cat] }}
    >
      {cat}
    </span>
  );
}

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="บทความ & เคล็ดลับ"
        title="ความรู้สำหรับคนขายเสื้อผ้ามือสอง"
        subtitle="เคล็ดลับเลือกของ เปิดร้าน และขายให้กำไรดี — จากทีมงาน KAN HUB"
      />

      <section className="bg-cream py-16">
        <Container>
          {/* หมวดหมู่ */}
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">ทั้งหมด</span>
            {Object.keys(CATS).map((c) => (
              <span key={c} className="rounded-full border border-hair bg-white px-4 py-2 text-sm font-medium text-ink/80">
                {c}
              </span>
            ))}
          </div>

          {/* บทความเด่น */}
          <article className="mt-8 overflow-hidden rounded-2xl border border-hair bg-white">
            <div className="grid md:grid-cols-2">
              <div
                className="flex min-h-[220px] items-end p-7"
                style={{ background: `linear-gradient(135deg, ${CATS[FEATURED.cat]}, #1a1413)` }}
              >
                <Chip cat={FEATURED.cat} />
              </div>
              <div className="p-7">
                <span className="text-xs font-semibold text-brand">บทความแนะนำ</span>
                <h2 className="mt-2 text-xl font-bold text-ink sm:text-2xl">{FEATURED.title}</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{FEATURED.desc}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                  <span className="rounded bg-cream-100 px-2 py-1 font-medium">เร็วๆ นี้</span>
                  <span>· {FEATURED.read}</span>
                </div>
              </div>
            </div>
          </article>

          {/* กริดบทความ */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {POSTS.map((a) => (
              <article key={a.title} className="flex flex-col overflow-hidden rounded-2xl border border-hair bg-white">
                <div
                  className="flex h-32 items-end p-5"
                  style={{ background: `linear-gradient(135deg, ${CATS[a.cat]}, #1a1413)` }}
                >
                  <Chip cat={a.cat} />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-[16px] font-semibold leading-snug text-ink">{a.title}</h3>
                  <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted">{a.desc}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                    <span className="rounded bg-cream-100 px-2 py-1 font-medium">เร็วๆ นี้</span>
                    <span>· อ่าน {a.read}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* ติดตาม */}
          <div className="mt-12 rounded-2xl border border-hair bg-cream-100 px-6 py-8 text-center">
            <h2 className="text-xl font-bold text-ink">อยากได้เคล็ดลับก่อนใคร?</h2>
            <p className="mx-auto mt-2 max-w-lg text-[15px] text-muted">
              ติดตามเพจ KAN HUB หรือแอดไลน์ รับข่าวกระสอบใหม่ โปรโมชั่น และเทคนิคขายก่อนใคร
            </p>
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
