import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/Container";
import { Countdown } from "@/components/home/Countdown";
import { SITE } from "@/lib/site";

/* ---------- ข้อมูลหน้า (จาก Figma "home - kan hub") ---------- */

const HERO_CHIPS = [
  "บริษัทจริง จดทะเบียน",
  "ยกกระสอบ นำเข้าตรง",
  "ไม่ผ่านคนกลาง",
  "มาดูของก่อนซื้อได้",
];

const TRUST = [
  { icon: "🏢", title: "บริษัทจริง", desc: "จดทะเบียนถูกต้อง มีโกดัง 4 สาขา" },
  { icon: "🚢", title: "นำเข้าตรงญี่ปุ่น", desc: "ไม่ผ่านคนกลาง ราคาต้นทาง" },
  { icon: "📸", title: "เปิดกระสอบถ่ายก่อนส่ง", desc: "เห็นของจริงทุกครั้ง" },
  { icon: "🚚", title: "ส่งทั่วไทย", desc: "มารับเองที่โกดังก็ได้" },
];

// สินค้าเรือธง (ราคาเคาะจริงจากไฟล์ KAN — sheet "รวมทุกสินค้า")
const PRODUCTS = [
  {
    img: "/img/hero-2.jpg",
    badge: "ขายดีที่สุด",
    name: "ก้อนผ้า TOKYO",
    code: "Tier A · ยกก้อน · ~350 กก.",
    price: "15,750฿",
    original: null,
  },
  {
    img: "/img/hero-3.jpg",
    badge: "งานพรีเมียม",
    name: "ก้อนผ้า NAGOYA",
    code: "Tier A · ยกก้อน · ~350 กก.",
    price: "14,000฿",
    original: null,
  },
  {
    img: "/img/whyus-warehouse.jpg",
    badge: "คุ้มสุด",
    name: "ก้อนผ้า OSAKA",
    code: "Tier A · ยกก้อน · ~300 กก.",
    price: "11,700฿",
    original: null,
  },
];

const WHY = [
  {
    icon: "🚢",
    img: "/img/whyus-import.png",
    title: "นำเข้าตรงจากญี่ปุ่น ไม่ผ่านคนกลาง",
    desc: "ตู้คอนเทนเนอร์เข้าท่าเรือตรงถึงโกดังเรา คุณได้ราคาต้นทาง ของเกรดดีกว่าที่หาได้ทั่วไป",
  },
  {
    icon: "🏢",
    img: "/img/whyus-warehouse.jpg",
    title: "บริษัทจริง มีโกดังให้มาดูของ",
    desc: "ไม่ใช่เพจปลอม จดทะเบียนถูกต้อง มีหน้าร้าน 4 สาขาในภาคใต้ นัดมาคัดเองหน้าโกดังได้",
  },
  {
    icon: "💰",
    img: "/img/whyus-grading.png",
    title: "คัดเกรด A ขายต่อง่าย กำไรดี",
    desc: "งานทุกกระสอบผ่านการคัดเกรด พร้อมบริการติดป้าย-พับให้ เปิดร้าน-ขายตลาดนัดได้ทันที",
  },
];

const REVIEWS = [
  {
    avatar: "น",
    name: "คุณน้อง",
    quote:
      "สั่งกระสอบเสื้อยืดมา เปิดมาของดีจริง เกรด A ตามที่บอก ขายตลาดนัดหมดใน 2 วัน รับซ้ำแน่นอน",
  },
  {
    avatar: "ก",
    name: "คุณกอล์ฟ สุราษฎร์",
    quote:
      "ขับรถไปดูของที่โกดังเอง คัดเองได้เลย ประทับใจมาก ไม่ต้องสั่งไกลถึงกรุงเทพ",
  },
  {
    avatar: "ม",
    name: "ร้านมือสองพี่แมว",
    quote:
      "ใช้บริการจัดก้อนสด เลือก % หมวดเองได้ ติดป้ายมาให้พร้อมขายเลย คุ้มมาก",
  },
  {
    avatar: "ด",
    name: "คุณดาว นครศรี",
    quote:
      "กลัวโดนโกงเลยเลือกที่มีบริษัทจริง โอนบัญชีบริษัท สบายใจ ของส่งไวด้วย",
  },
];

const FAQ = [
  {
    q: "กระสอบมือสอง 1 กระสอบกี่ตัว?",
    a: "ขึ้นกับหมวด — เสื้อยืด ~180–220 ตัว, ยีนส์ ~90–110 ตัว, เดรส ~160–200 ตัว ต่อกระสอบ 45 กก. เราระบุจำนวนโดยประมาณไว้ทุกการ์ดสินค้า",
  },
  {
    q: "เกรด A กับ B ต่างกันยังไง?",
    a: "เกรด A คือสภาพดีพร้อมขาย ตำหนิน้อยมาก เหมาะแขวนร้าน · เกรด B มีตำหนิเล็กน้อย ราคาถูกกว่า เหมาะขายเหมา/ตลาดนัด",
  },
  {
    q: "สั่งกระสอบ ขั้นต่ำเท่าไหร่?",
    a: "เริ่มได้ที่ 1 กระสอบ ไม่มีขั้นต่ำสูง เหมาะทั้งมือใหม่ทดลองตลาดและร้านประจำที่รับซ้ำ",
  },
  {
    q: "มารับเองที่โกดังได้ไหม?",
    a: "ได้เลย นัดล่วงหน้าทาง LINE เข้ามาคัด/ดูของเองที่โกดังได้ทั้ง 4 สาขาในภาคใต้",
  },
  {
    q: "KAN ขายปลีกแข่งกับร้านเรามั้ย?",
    a: "ไม่แข่ง เราเน้นขายส่งให้ร้านค้า ไม่ลงไปตัดราคาขายปลีกแข่งกับลูกค้าของเราเอง",
  },
];

const CONTACT_ROWS = [
  { icon: "💬", label: "LINE Official", value: `${SITE.lineId} — ${SITE.lineHours}`, href: SITE.lineUrl },
  { icon: "📞", label: "โทร", value: SITE.phone, href: SITE.phoneHref },
  { icon: "📘", label: "Facebook", value: SITE.facebookName, href: SITE.facebook },
  { icon: "🕗", label: "เวลาทำการ", value: SITE.hours, href: null },
];

/* ---------- primitives ---------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow mb-2.5">{children}</p>;
}

const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-6 py-3.5 text-[15px] font-semibold transition-colors";

/* ============================================================ */

export default function Home() {
  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="relative isolate overflow-hidden bg-dark">
        <Image
          src="/img/hero-warehouse.jpg"
          alt="โกดังกระสอบเสื้อผ้ามือสองญี่ปุ่น KAN HUB"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/45" />
        <Container className="relative flex min-h-[560px] flex-col justify-end pb-12 pt-24">
          <h1 className="fade-rise fade-rise-1 max-w-3xl text-4xl font-extrabold leading-[1.15] text-white sm:text-5xl">
            โกดังขายส่งเสื้อผ้ามือสอง
            <br />
            ญี่ปุ่น นำเข้าตรง — เจ้าแรกภาคใต้
          </h1>
          <div className="fade-rise fade-rise-2 mt-5 flex flex-wrap gap-2">
            {HERO_CHIPS.map((c) => (
              <span
                key={c}
                className="rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm"
              >
                ✓ {c}
              </span>
            ))}
          </div>
          <div className="fade-rise fade-rise-3 mt-6 flex flex-wrap gap-3">
            <a href={SITE.lineUrl} target="_blank" rel="noopener noreferrer" className={`${btn} bg-line text-white shadow-lg shadow-line/30 hover:bg-line-dark`}>
              💬 ทักไลน์ดูราคา
            </a>
            <Link href="/catalog" className={`${btn} border-[1.5px] border-white/40 text-white hover:bg-white/10`}>
              ดูกระสอบทั้งหมด
            </Link>
          </div>
        </Container>
        {/* จุด carousel */}
        <div className="absolute bottom-5 right-5 flex gap-1.5">
          <span className="h-2 w-6 rounded-full bg-white" />
          <span className="h-2 w-2 rounded-full bg-white/45" />
          <span className="h-2 w-2 rounded-full bg-white/45" />
        </div>
      </section>

      {/* ---------- TRUST BAR ---------- */}
      <section className="border-b border-hair bg-cream">
        <Container className="grid grid-cols-2 gap-x-6 gap-y-5 py-6 md:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-start gap-3">
              <span className="text-2xl leading-none">{t.icon}</span>
              <div>
                <div className="text-[15px] font-semibold text-ink">{t.title}</div>
                <div className="text-[13px] text-muted">{t.desc}</div>
              </div>
            </div>
          ))}
        </Container>
      </section>

      {/* ---------- LIVE / VIDEO ---------- */}
      <section className="bg-cream py-16">
        <Container>
          <div className="text-center">
            <Eyebrow>ไลฟ์สดทุกวัน</Eyebrow>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">
              เปิดกระสอบสด — เห็นของจริงก่อนตัดสินใจ
            </h2>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            {/* จอไลฟ์ */}
            <div className="relative grid aspect-video place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#2a1115] to-[#120b0a]">
              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-bold text-white">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
                LIVE
              </span>
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm">
                ▶
              </span>
            </div>
            {/* กล่องข้อมูลไลฟ์ */}
            <div className="flex flex-col rounded-2xl border border-hair bg-white p-6">
              <h3 className="text-lg font-semibold text-ink">
                กำลังไลฟ์: เปิดกระสอบเสื้อยืดญี่ปุ่น เกรด A
              </h3>
              <p className="mt-1.5 text-sm text-muted">
                พิมพ์รหัสในไลฟ์เพื่อจอง แอดมินทักกลับทันที
              </p>
              <div className="mt-5 text-sm font-semibold text-ink">รอบไลฟ์ถัดไป</div>
              <div className="mt-2 space-y-2">
                <div className="rounded-lg bg-cream-100 px-3.5 py-2 text-[13px] text-ink/80">
                  📅 พรุ่งนี้ 20:00 · ยีนส์
                </div>
                <div className="rounded-lg bg-cream-100 px-3.5 py-2 text-[13px] text-ink/80">
                  📅 เสาร์ 14:00 · งานคัดแบรนด์
                </div>
              </div>
              <a href={SITE.lineUrl} target="_blank" rel="noopener noreferrer" className="mt-5 text-sm font-semibold text-brand hover:text-brand-dark">
                ดูตารางไลฟ์ทั้งหมด →
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------- PRODUCTS ---------- */}
      <section className="bg-cream-100 py-16">
        <Container>
          <div className="text-center">
            <Eyebrow>เลือกแบบที่ใช่</Eyebrow>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">
              ก้อนผ้านำเข้าตรงจากญี่ปุ่น คัดเกรด A
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-[15px] text-muted">
              เลือกก้อนตามเมืองต้นทาง — TOKYO · NAGOYA · OSAKA ราคาส่งเคาะจริงจากโกดัง
            </p>
          </div>
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p) => (
              <div key={p.name} className="group overflow-hidden rounded-2xl border border-hair bg-white shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#2a2120]">
                  <Image
                    src={p.img}
                    alt={p.name}
                    fill
                    sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 360px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-md bg-brand px-2.5 py-1 text-xs font-bold text-white">
                    {p.badge}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-ink">{p.name}</h3>
                  <p className="mt-1 text-[13px] text-muted">{p.code}</p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-brand">{p.price}</span>
                    {p.original && (
                      <span className="text-sm text-muted line-through">{p.original}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-9 text-center">
            <Link href="/catalog" className={`${btn} bg-brand text-white hover:bg-brand-dark`}>
              ดูแคตตาล็อกทั้งหมด
            </Link>
          </div>
        </Container>
      </section>

      {/* ---------- PROMO BANNER ---------- */}
      <section className="bg-cream py-16">
        <Container>
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-gold to-gold-dark px-6 py-10 sm:px-12">
            <div className="flex flex-col items-center gap-8 text-center md:flex-row md:justify-between md:text-left">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-dark/70">
                  ⚡ โปรเดือนนี้เท่านั้น
                </p>
                <h2 className="mt-2 text-2xl font-extrabold text-dark sm:text-3xl">
                  ก้อนเด็ด — ก้อนผ้า TOKYO
                </h2>
                <div className="mt-2 flex flex-col items-center gap-1 md:items-start">
                  <span className="text-4xl font-black text-brand sm:text-5xl">15,750฿ <span className="text-xl font-bold text-dark/70">/ ก้อน</span></span>
                  <span className="text-sm font-medium text-dark/70">ยกก้อน ~350 กก. · Tier A · เหลือ 105 ก้อนในสต๊อก</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-5">
                <Countdown />
                <a href={SITE.lineUrl} target="_blank" rel="noopener noreferrer" className={`${btn} w-full bg-brand text-white hover:bg-brand-dark`}>
                  💬 จองก้อนเด็ดเลย
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------- WHY US ---------- */}
      <section className="bg-dark py-20 text-white">
        <Container>
          <div className="max-w-2xl">
            <Eyebrow>ทำไมต้อง KAN</Eyebrow>
            <h2 className="text-2xl font-bold sm:text-3xl">
              เสื้อผ้ามือสองภาคใต้
              <br />
              ของแท้ญี่ปุ่น ขายง่าย กำไรดี
            </h2>
          </div>
          <div className="mt-12 space-y-8">
            {WHY.map((w, i) => (
              <div
                key={w.title}
                className={`grid items-center gap-6 md:grid-cols-2 ${i % 2 === 1 ? "md:[&>figure]:order-first" : ""}`}
              >
                <div>
                  <span className="mb-3 inline-grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-xl">
                    {w.icon}
                  </span>
                  <h3 className="text-xl font-semibold">{w.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/65">{w.desc}</p>
                </div>
                <figure className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-white/5">
                  <Image
                    src={w.img}
                    alt={w.title}
                    fill
                    sizes="(max-width:768px) 100vw, 520px"
                    className="object-cover"
                  />
                </figure>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link href="/why-us" className="text-[15px] font-semibold text-gold hover:text-gold-dark">
              อ่านเรื่องราว KAN HUB →
            </Link>
          </div>
        </Container>
      </section>

      {/* ---------- TESTIMONIALS ---------- */}
      <section className="bg-cream py-16">
        <Container>
          <div className="text-center">
            <Eyebrow>รีวิวลูกค้าจริง</Eyebrow>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">
              ลูกค้ามารับของเองที่โกดัง
            </h2>
          </div>
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {REVIEWS.map((r) => (
              <div key={r.name} className="flex flex-col rounded-2xl border border-hair bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-soft text-sm font-bold text-dark">
                    {r.avatar}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-ink">{r.name}</div>
                    <div className="text-xs text-gold-dark">★★★★★</div>
                  </div>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-ink/75">“{r.quote}”</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ---------- CTA BAND ---------- */}
      <section className="bg-dark-2 py-16 text-white">
        <Container className="text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            พร้อมเริ่มต้นธุรกิจเสื้อผ้ามือสองแล้วใช่ไหม?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-white/65">
            ทักมาคุยได้เลย ทีมงานช่วยเลือกกระสอบที่เหมาะกับร้านคุณ
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href={SITE.lineUrl} target="_blank" rel="noopener noreferrer" className={`${btn} bg-line text-white hover:bg-line-dark`}>
              💬 แอด LINE
            </a>
            <a href={SITE.phoneHref} className={`${btn} bg-gold text-dark hover:bg-gold-dark`}>
              📞 โทรเลย
            </a>
            <Link href="/contact" className={`${btn} border-[1.5px] border-white/40 text-white hover:bg-white/10`}>
              📍 นัดดูของที่โกดัง
            </Link>
          </div>
        </Container>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="bg-cream py-16">
        <Container className="max-w-3xl">
          <div className="text-center">
            <Eyebrow>คำถามพบบ่อย</Eyebrow>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">เรื่องที่ลูกค้าถามบ่อย</h2>
          </div>
          <div className="mt-8 space-y-3">
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
          <div className="mt-7 text-center">
            <Link href="/faq" className="text-sm font-semibold text-brand hover:text-brand-dark">
              ดูคำถามทั้งหมด →
            </Link>
          </div>
        </Container>
      </section>

      {/* ---------- LOCATION / CONTACT ---------- */}
      <section className="bg-cream-100 py-16">
        <Container>
          <div className="text-center">
            <Eyebrow>ติดต่อเรา</Eyebrow>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">โกดัง KAN HUB ภาคใต้</h2>
          </div>

          <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-[#f6c9c9] bg-[#fdecec] px-4 py-3 text-center text-sm text-[#8c1d1d]">
            ⚠️ เพื่อความปลอดภัย — <span className="font-bold">โอนเข้าบัญชีบริษัทเท่านั้น</span> ระวังมิจฉาชีพแอบอ้าง
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <figure className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-hair bg-white">
              <Image
                src="/img/location-map.png"
                alt="แผนที่โกดัง KAN HUB ภาคใต้"
                fill
                sizes="(max-width:1024px) 100vw, 540px"
                className="object-cover"
              />
            </figure>
            <div className="flex flex-col">
              <ul className="space-y-3">
                {CONTACT_ROWS.map((c) => (
                  <li key={c.label} className="flex items-start gap-3 rounded-xl border border-hair bg-white px-4 py-3.5">
                    <span className="text-xl leading-none">{c.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink">{c.label}</div>
                      {c.href ? (
                        <a
                          href={c.href}
                          target={c.href.startsWith("http") ? "_blank" : undefined}
                          rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="text-[13px] text-muted hover:text-brand"
                        >
                          {c.value}
                        </a>
                      ) : (
                        <div className="text-[13px] text-muted">{c.value}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <a href={SITE.lineUrl} target="_blank" rel="noopener noreferrer" className={`${btn} mt-4 bg-line text-white hover:bg-line-dark`}>
                💬 ทักไลน์ขอใบเสนอราคา
              </a>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
