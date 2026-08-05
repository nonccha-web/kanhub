import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/Container";
import { LineIcon } from "@/components/BrandIcons";
import { TIERS } from "@/lib/tiers";
import { SITE } from "@/lib/site";
import data from "@/lib/kan-prices.json";

export const metadata = {
  title: "ซื้อผ้ากระสอบ & ก้อนผ้ามือสองญี่ปุ่น — เลือกตาม Tier A–D",
  description:
    "เลือกซื้อกระสอบ/ก้อนผ้าเสื้อผ้ามือสองญี่ปุ่นตามระดับงาน Tier A–D ของ KAN HUB — นำเข้าตรง คัดเกรด A ราคาส่งต้นทาง เริ่ม 1 กระสอบ ส่งทั่วไทย เปิดกระสอบถ่ายให้ดูก่อนส่ง",
  keywords: ["ผ้ากระสอบ", "ซื้อผ้ากระสอบ", "กระสอบเสื้อผ้ามือสอง", "ก้อนผ้า", "เสื้อผ้ามือสองยกกระสอบ", "ขายส่งเสื้อผ้ามือสองญี่ปุ่น"],
  alternates: { canonical: "/catalog" },
};

type P = { tier: string; price_final: number | null };
const products = data.products as P[];
const baht = (n: number) => `${n.toLocaleString("en-US")}฿`;
function range(key: string) {
  const p = products.filter((x) => x.tier === key && x.price_final != null).map((x) => x.price_final as number);
  return p.length ? { min: Math.min(...p), max: Math.max(...p) } : null;
}

const btn = "inline-flex items-center justify-center gap-1.5 rounded-xl px-6 py-3.5 text-[15px] font-semibold transition-colors";

const PAINS = [
  "กลัวโดนโกง เจอเพจปลอม โอนแล้วเงียบหาย",
  "สั่งมาของไม่ตรงปก เกรดไม่ตามที่บอก",
  "ซื้อผ่านคนกลาง ต้นทุนแพง กำไรบางเฉียบ",
  "อยากเริ่มขาย แต่ไม่รู้จะรับงานแบบไหน งบเท่าไหร่",
  "รับของมาแล้วขายไม่ออก ค้างสต๊อกเต็มบ้าน",
];

const PROMISES = [
  { icon: "🚢", t: "นำเข้าตรงญี่ปุ่น ไม่ผ่านคนกลาง", d: "ตู้เข้าท่าเรือตรงถึงโกดัง คุณได้ราคาต้นทาง กำไรเต็มไม้เต็มมือ" },
  { icon: "📸", t: "เปิดกระสอบถ่ายให้ดูก่อนส่ง", d: "บริษัทจริง มีโกดัง 4 สาขาให้มาดูของ เห็นของจริงทุกก้อน ไม่ต้องเสี่ยง" },
  { icon: "🎯", t: "เลือกได้ 4 ระดับตามงบ", d: "Tier A–D เริ่มที่กระสอบเดียวก็ได้ เลือกงานให้ตรงกลุ่มลูกค้าหน้าร้าน" },
];

const STATS = [
  { n: "4", l: "สาขาโกดังภาคใต้" },
  { n: "100%", l: "นำเข้าตรงญี่ปุ่น" },
  { n: "1", l: "กระสอบก็เริ่มได้" },
  { n: "เกรด A", l: "มาตรฐานการคัด" },
];

const REVIEWS = [
  { a: "น", name: "คุณน้อง", q: "เปิดมาของดีจริง เกรด A ตามที่บอก ขายตลาดนัดหมดใน 2 วัน" },
  { a: "ก", name: "คุณกอล์ฟ สุราษฎร์", q: "ขับรถไปดูของที่โกดังเอง คัดเองได้เลย ประทับใจมาก" },
  { a: "ด", name: "คุณดาว นครศรี", q: "กลัวโดนโกงเลยเลือกที่มีบริษัทจริง โอนบัญชีบริษัท สบายใจ ของส่งไว" },
];

const GUARANTEES = [
  "มาดูของที่โกดังก่อนซื้อได้ นัดผ่านไลน์",
  "เปิดกระสอบถ่าย/ไลฟ์ให้ดูก่อนส่งทุกก้อน",
  "โอนเข้าบัญชีบริษัทเท่านั้น มีเอกสารครบ",
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow mb-2.5">{children}</p>;
}

export default function CatalogPage() {
  return (
    <>
      {/* 1. HERO — Picture + Promise */}
      <section className="bg-dark py-16 text-white sm:py-20">
        <Container>
          <div className="max-w-3xl">
            <Eyebrow>แคตตาล็อกขายส่ง · เริ่มที่ 1 กระสอบ</Eyebrow>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-[42px] sm:leading-[1.15]">
              เปิดร้านเสื้อผ้ามือสองให้กำไรดี<br />เริ่มที่ “ก้อนผ้า” ญี่ปุ่นนำเข้าตรง
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/70">
              เลือกกระสอบ/ก้อนผ้าคัดเกรด A ตามงบและกลุ่มลูกค้าของคุณ — บริษัทจริง เปิดกระสอบถ่ายให้ดูก่อนส่ง ส่งทั่วไทย
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={SITE.lineUrl} target="_blank" rel="noopener noreferrer" className={`${btn} bg-line text-white shadow-lg shadow-line/30 hover:bg-line-dark`}>
                <LineIcon /> ทักไลน์ให้แนะนำก้อนที่ใช่
              </a>
              <a href="#tiers" className={`${btn} border-[1.5px] border-white/40 text-white hover:bg-white/10`}>
                ดูสินค้าทั้ง 4 ระดับ ↓
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/60">
              <span>✓ บริษัทจริง จดทะเบียน</span>
              <span>✓ นำเข้าตรง ไม่ผ่านคนกลาง</span>
              <span>✓ มาดูของก่อนซื้อได้</span>
            </div>
          </div>
        </Container>
      </section>

      {/* 2. PROBLEM — Picture (pain) */}
      <section className="bg-cream py-16">
        <Container className="max-w-3xl text-center">
          <Eyebrow>แบบนี้ใช่คุณไหม?</Eyebrow>
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">รับเสื้อผ้ามือสองมาขาย… แต่เจอปัญหาซ้ำๆ</h2>
          <ul className="mt-8 space-y-3 text-left">
            {PAINS.map((p) => (
              <li key={p} className="flex items-start gap-3 rounded-xl border border-hair bg-white px-4 py-3.5 text-[15px] text-ink/85">
                <span className="mt-0.5 text-brand">✕</span>
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[15px] text-muted">ถ้าพยักหน้าให้ข้อไหน — KAN HUB ตั้งใจแก้ปัญหาพวกนี้ให้คุณ</p>
        </Container>
      </section>

      {/* 3. PROMISE — solution */}
      <section className="bg-cream-100 py-16">
        <Container>
          <div className="text-center">
            <Eyebrow>ทำไมร้านค้าเลือก KAN HUB</Eyebrow>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">ซื้อของอย่างมั่นใจ ขายต่อได้กำไร</h2>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {PROMISES.map((p) => (
              <div key={p.t} className="rounded-2xl border border-hair bg-white p-6">
                <span className="mb-3 inline-grid h-11 w-11 place-items-center rounded-xl bg-cream-100 text-xl">{p.icon}</span>
                <h3 className="text-lg font-semibold text-ink">{p.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{p.d}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* 4. TIERS — the product menu */}
      <section id="tiers" className="scroll-mt-20 bg-cream py-16">
        <Container>
          <div className="text-center">
            <Eyebrow>เลือกแบบที่ใช่</Eyebrow>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">สินค้าทั้ง 4 ระดับ — เลือกตามงบ & กลุ่มลูกค้า</h2>
            <p className="mx-auto mt-2 max-w-xl text-[15px] text-muted">กดเข้าไปดูรายละเอียด + ราคาของแต่ละ Tier ได้เลย</p>
          </div>
          <div className="mt-9 grid gap-6 sm:grid-cols-2">
            {TIERS.map((t) => {
              const r = range(t.key);
              return (
                <Link key={t.slug} href={`/catalog/${t.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-hair bg-white transition-shadow hover:shadow-md">
                  <div className="relative flex aspect-[16/7] items-end justify-between overflow-hidden p-4 text-white" style={{ background: `linear-gradient(135deg, ${t.accent}, #1a1413)` }}>
                    {t.cover ? (
                      <>
                        <Image src={t.cover} alt={t.name} fill sizes="(max-width:640px) 100vw, 540px" className="object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                        <span className="relative rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: t.accent, color: t.onGold ? "#1a1413" : "#fff" }}>Tier {t.key}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-6xl font-black leading-none opacity-25">{t.key}</span>
                        <span className="text-[11px] opacity-80">รูปสินค้าเร็วๆ นี้</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-lg font-bold text-ink">Tier {t.key} · {t.name}</h3>
                    <p className="text-[13px] text-muted">{t.unitNote}</p>
                    <p className="mt-3 flex-1 text-[15px] leading-relaxed text-muted">{t.tagline}</p>
                    {r && (
                      <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-[13px] text-muted">เริ่มต้น</span>
                        <span className="text-xl font-extrabold text-brand">{baht(r.min)}</span>
                        {r.max !== r.min && <span className="text-[13px] text-muted">– สูงสุด {baht(r.max)}</span>}
                      </div>
                    )}
                    <span className="mt-4 text-sm font-semibold text-brand group-hover:text-brand-dark">ดู Tier {t.key} →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* 5. PROVE — stats + reviews */}
      <section className="bg-dark py-16 text-white">
        <Container>
          <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.l}>
                <div className="text-3xl font-extrabold text-gold sm:text-4xl">{s.n}</div>
                <div className="mt-1 text-sm text-white/60">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {REVIEWS.map((r) => (
              <div key={r.name} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-soft text-sm font-bold text-dark">{r.a}</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{r.name}</div>
                    <div className="text-xs text-gold">★★★★★</div>
                  </div>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-white/75">“{r.q}”</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* 6. VALUE — ยิ่งรับเยอะยิ่งถูก */}
      <section className="bg-cream py-16">
        <Container className="text-center">
          <Eyebrow>คุ้มกว่าเมื่อรับเยอะ</Eyebrow>
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">ยิ่งรับเยอะ ยิ่งถูก + บริการพร้อมขาย</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
            ราคาคิดเป็นขั้นบันไดตามจำนวน — รับ 100 ตัวขึ้นไปได้ราคาส่งสุด เสริมบริการจัดก้อนสด คัด % หมวด ติดป้าย–พับให้พร้อมวางขายหน้าร้าน/ตลาดนัดได้ทันที
          </p>
        </Container>
      </section>

      {/* 7. PUSH — risk reversal + final CTA */}
      <section className="bg-dark-2 py-16 text-white">
        <Container className="max-w-3xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">พร้อมเริ่มต้นแล้วใช่ไหม? ทักมาเลือกก้อนแรกกัน</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-white/65">บอกงบและกลุ่มลูกค้าร้านคุณ ทีมงานแนะนำ Tier ที่เหมาะที่สุดให้ พร้อมส่งรูป/คลิปของจริง</p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href={SITE.lineUrl} target="_blank" rel="noopener noreferrer" className={`${btn} bg-line text-white hover:bg-line-dark`}>
              <LineIcon /> ทักไลน์ดูราคา
            </a>
            <a href={SITE.phoneHref} className={`${btn} bg-gold text-dark hover:bg-gold-dark`}>📞 โทรเลย</a>
          </div>

          <div className="mx-auto mt-8 grid max-w-xl gap-2 text-left">
            {GUARANTEES.map((g) => (
              <div key={g} className="flex items-start gap-2.5 text-[14px] text-white/80">
                <span className="mt-0.5 text-line">✓</span>{g}
              </div>
            ))}
          </div>

          <p className="mt-8 text-[13px] text-white/45">
            มีคำถามก่อนสั่ง? <Link href="/faq" className="font-semibold text-white/70 underline hover:text-white">ดูคำถามพบบ่อย</Link>
          </p>
        </Container>
      </section>
    </>
  );
}
