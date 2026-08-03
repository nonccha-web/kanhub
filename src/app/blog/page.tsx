import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";

export const metadata = {
  title: "บทความ & เคล็ดลับ",
  description:
    "บทความและเคล็ดลับจาก KAN HUB — วิธีเลือกกระสอบเสื้อผ้ามือสองญี่ปุ่น เปิดร้านมือสอง ตั้งราคาขายต่อ และเทคนิคขายดีสำหรับร้านและตลาดนัด",
  alternates: { canonical: "/blog" },
};

// ยังไม่มีบทความจริง — วางหัวข้อที่กำลังจะลงไว้ก่อน (จะเปลี่ยนเป็นลิงก์บทความจริงทีหลัง)
const UPCOMING = [
  { tag: "มือใหม่", title: "เปิดร้านเสื้อผ้ามือสองต้องเริ่มยังไง? ฉบับจับมือทำ", desc: "ตั้งแต่เลือกกระสอบแรก ตั้งราคา ไปจนถึงจัดร้านให้ขายดี" },
  { tag: "เลือกของ", title: "กระสอบเกรด A vs B ต่างกันยังไง เลือกแบบไหนคุ้มกว่า", desc: "อ่านก่อนสั่ง จะได้เลือกงานให้ตรงกลุ่มลูกค้าหน้าร้าน" },
  { tag: "ขายดี", title: "ตั้งราคาขายต่อเสื้อผ้ามือสองยังไงให้กำไรดี", desc: "สูตรคิดต้นทุนต่อตัว + เทคนิคตั้งราคาหน้าร้านและตลาดนัด" },
  { tag: "หน้าหนาว", title: "โค้ท-ไหมพรมญี่ปุ่น ทำไมขายดีช่วงปลายปี", desc: "จับจังหวะสต๊อกงานหน้าหนาวก่อนใคร ทำยอดช่วงไฮซีซั่น" },
];

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="บทความ & เคล็ดลับ"
        title="ความรู้สำหรับคนขายเสื้อผ้ามือสอง"
        subtitle="เคล็ดลับเลือกของ เปิดร้าน และขายให้กำไรดี — กำลังทยอยลง เร็วๆ นี้"
      />

      <section className="bg-cream py-16">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2">
            {UPCOMING.map((a) => (
              <div key={a.title} className="rounded-2xl border border-hair bg-white p-6">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-cream-100 px-2.5 py-1 text-xs font-semibold text-brand">{a.tag}</span>
                  <span className="text-xs text-muted">เร็วๆ นี้</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-ink">{a.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{a.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand
        title="อยากได้เคล็ดลับก่อนใคร?"
        subtitle="ติดตามเพจ KAN HUB หรือทักไลน์ ทีมงานพร้อมให้คำปรึกษาการเปิดร้าน"
      />
    </>
  );
}
