import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/Container";
import { LineIcon, FbIcon } from "@/components/BrandIcons";
import { FbEmbed } from "@/components/FbEmbed";
import { SITE } from "@/lib/site";
import { SAMPLE_GROUPS } from "@/lib/product-images";
import { OFFERS, PROMO } from "@/lib/offers";
import { OfferCard } from "@/components/sale/OfferCard";
import { CATEGORIES } from "@/lib/categories";
import stock from "@/lib/stock-prices.json";
import { ARTICLES } from "@/lib/blog-data";

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

// รูปจริงของโปรปัจจุบัน (หน้า /grade-b/) — โชว์บนส่วนบนสุด
const PROMO_SHOTS = ["dress-02", "tops-05", "skirt-04", "pants-03"].map((k) => `/grade-b/img/${k}-s.webp`);

// ตัวอย่างเรทรายตัวบนหน้าแรก — ดึงจากชีต KAN#0 (stock-prices.json)
const LADDER_ITEMS = ["ชุดเดรสคละแบบ", "เสื้อโค้ทวูล", "กางเกงยีนส์"]
  .map((n) => stock.items.find((i) => i.name === n))
  .filter((i): i is (typeof stock.items)[number] => !!i);

// ตัวอย่างของในก้อน — โชว์บนหน้าแรก 8 รูป (คละหมวด) ที่เหลือดูได้ที่ /catalog#samples
const HOME_SAMPLES = SAMPLE_GROUPS.flatMap((grp) =>
  grp.images.slice(0, grp.key === "jeans" ? 2 : 1).map((src) => ({ src, label: grp.label }))
);
const SAMPLE_TOTAL = SAMPLE_GROUPS.reduce((n, grp) => n + grp.images.length, 0);

const WHY = [
  {
    icon: "🚢",
    img: "/img/whyus-import.jpg",
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
    img: "/img/whyus-grading.jpg",
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
    a: "กระสอบ 45 กก. ขึ้นกับความหนาของผ้า — ผ้าบาง ~250 ตัว (เฉลี่ย ~20฿/ตัว), ผ้าหนา ~100 ตัว (~50฿/ตัว), ผ้าหนามาก ~60 ตัว (~83฿/ตัว) ราคาราว 5,000฿ ต่อกระสอบ",
  },
  {
    q: "เกรด A กับ B ต่างกันยังไง?",
    a: "เกรด A คือสภาพดีพร้อมขาย ตำหนิน้อยมาก เหมาะแขวนร้าน · เกรด B-C มีตำหนิเล็กน้อย ราคาถูกกว่ามาก เหมาะขายเหมา/ตลาดนัด — กระสอบ 45 กก. เป็นเกรด A-B ส่วนกระสอบโปรโมชั่นเป็นเกรด B-C",
  },
  {
    q: "สั่งขั้นต่ำเท่าไหร่?",
    a: "ผ้าสต๊อกคัดเองเริ่มได้ตั้งแต่ 1 ตัว (ยิ่งเยอะยิ่งถูก คิดราคาเองได้ที่หน้า คิดราคา) · ถ้าให้เราเลือกให้ ขั้นต่ำ 100 กก. 1,500฿ รวมส่ง · กระสอบ 45 กก. และก้อน 350 กก. เริ่มที่ 1 กระสอบ/ก้อน",
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

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Store", "LocalBusiness"],
      "@id": `${SITE.url}#store`,
      name: SITE.name,
      description: SITE.description,
      url: SITE.url,
      telephone: SITE.phone,
      image: `${SITE.url}/img/logo-kanhub.png`,
      priceRange: "฿฿",
      areaServed: ["สุราษฎร์ธานี", "นครศรีธรรมราช", "ชุมพร", "ภาคใต้", "ประเทศไทย"],
      sameAs: [SITE.facebook, SITE.lineUrl],
      address: { "@type": "PostalAddress", addressRegion: "ภาคใต้", addressCountry: "TH" },
      openingHours: "Mo-Sa 09:00-18:00",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}#website`,
      url: SITE.url,
      name: SITE.name,
      inLanguage: "th-TH",
      publisher: { "@id": `${SITE.url}#store` },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    /* Google ถือว่า Product ที่ไม่มี image หรือ offers = ใช้ไม่ได้ (critical) — ต้องมีทั้งคู่ทุกตัว */
    ...OFFERS.map((o) => ({
      "@type": "Product",
      name: o.name,
      description: o.tagline,
      image: `${SITE.url}${o.cover}`,
      brand: { "@type": "Brand", name: SITE.name },
      url: `${SITE.url}${o.href}`,
      ...(o.price ? { offers: { "@type": "AggregateOffer", priceCurrency: "THB", lowPrice: o.price.low, highPrice: o.price.high,
        offerCount: o.groups.length, availability: "https://schema.org/InStock", url: `${SITE.url}${o.href}` } } : {}),
    })),
  ],
};

export const metadata = {
  title: "ขายส่งเสื้อผ้ามือสองญี่ปุ่น ยกกระสอบ · ก้อนผ้านำเข้าตรง",
  description:
    "KAN HUB โกดังขายส่งเสื้อผ้ามือสองญี่ปุ่น นำเข้าตรง — ก้อนผ้า 350 กก. · กระสอบ 45 กก. เกรด A-B · โปร 250 ตัว 1,500฿ ส่งฟรี · คัดเองรายตัวคิดราคาได้ ส่งทั่วไทย — เจ้าแรกภาคใต้",
  /* primary ของหน้าแรก = โกดังขายส่งมือสองญี่ปุ่น (ไม่ใช้ "ก้อนผ้า" ซ้ำกับ /catalog/bale) */
  keywords: [
    "ขายส่งเสื้อผ้ามือสองญี่ปุ่น", "โกดังเสื้อผ้ามือสอง", "เสื้อผ้ามือสองญี่ปุ่น",
    "ก้อนผ้า", "กระสอบเสื้อผ้ามือสอง", "ผ้าหาง", "เสื้อผ้ามือสองราคาถูก",
  ],
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ---------- HERO = โปรตามซีซั่น (PROMO ใน offers.ts) ---------- */}
      <section className="border-b border-hair bg-white">
        <Container className="grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-brand px-3.5 py-1 text-[13px] font-bold text-brand">
              <span className="live-dot h-2 w-2 rounded-full bg-brand" /> ราคาพิเศษ จนกว่าของจะหมด
            </span>
            <h1 className="mt-4 font-extrabold leading-[1.05] text-ink">
              <span className="block text-xl font-semibold text-muted sm:text-2xl">กระสอบผ้าโปรโมชั่น · เกรด B-C คละแบบ</span>
              <span className="mt-1 block text-[64px] text-brand sm:text-[88px]">1,500<span className="ml-1 text-[0.4em] font-bold">บาท</span></span>
              <span className="block text-4xl text-brand-dark sm:text-5xl">ได้ 250 ตัว</span>
              <span className="mt-3 inline-flex items-baseline gap-2 text-3xl sm:text-4xl">ส่งฟรี<small className="text-[13px] font-semibold text-muted">*ภาคกลาง และภาคใต้</small></span>
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              ผ้าปลดราวคละ <b className="text-ink">เสื้อแฟชั่น · เดรส · กางเกง · กระโปรง</b> เหมาะร้านเปิดท้าย ตลาดนัด ขายไลฟ์ ดูรูปจริงทุกตัวได้ในหน้าโปร
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={PROMO.href} className={`${btn} bg-brand px-8 text-[17px] text-white shadow-[0_5px_0_#9e0b22] hover:bg-brand-dark`}>
                {PROMO.cta} · ดูรูปจริง
              </a>
              <Link href="/catalog" className={`${btn} border-[1.5px] border-ink text-ink hover:bg-cream-100`}>
                ดูสินค้าทั้ง 4 แบบ
              </Link>
            </div>
          </div>
          <a href={PROMO.href} className="grid grid-cols-2 gap-2.5" aria-label="ดูรูปผ้าโปรโมชั่นทั้งหมด">
            {PROMO_SHOTS.map((src, i) => (
              <span key={src} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-cream-100">
                <Image src={src} alt="" fill priority={i < 2} sizes="(max-width:1024px) 50vw, 250px" className="object-cover" />
              </span>
            ))}
          </a>
        </Container>
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

      {/* ---------- 4 แบบขาย (แทนก้อนเรือธง + โปร TOKYO + Tier A–D เดิม) ---------- */}
      <section className="bg-cream-100 py-16">
        <Container>
          <div className="text-center">
            <Eyebrow>เลือกแบบที่ใช่</Eyebrow>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">ขายส่งเสื้อผ้ามือสองญี่ปุ่น 4 แบบ</h2>
            <p className="mx-auto mt-2 max-w-2xl text-[15px] text-muted">
              ตั้งแต่ยกก้อน 350 กก. ไปจนถึงคัดเองทีละตัว — ราคาเฉลี่ยแยกทุกกลุ่ม เลือกตามงบได้เลย
            </p>
          </div>
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {OFFERS.map((o, i) => (
              <OfferCard key={o.key} o={o} featured={i === 0} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <p className="text-[14px] font-semibold text-muted">หรือเลือกดูตามหมวด</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((c) => (
                <Link key={c.slug} href={`/catalog/${c.slug}`} className="rounded-full border border-hair bg-white px-4 py-2 text-[14px] font-semibold text-ink hover:border-ink">{c.name}</Link>
              ))}
              <Link href="/catalog/pha-hang" className="rounded-full border border-brand bg-white px-4 py-2 text-[14px] font-semibold text-brand hover:bg-brand hover:text-white">ผ้าหาง / ผ้าเหมา</Link>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------- คัดเองรายตัว: ตัวอย่างเรทจากชีต KAN#0 ---------- */}
      <section className="bg-dark py-16 text-white">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <Eyebrow>คัดเองรายตัว</Eyebrow>
              <h2 className="text-2xl font-bold sm:text-3xl">ยิ่งเยอะ ยิ่งถูก — คิดราคาเองได้ทันที</h2>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/70">
                เลือกหมวด ใส่จำนวน ระบบคิดราคาตามขั้นให้เลย แล้วกดส่งให้ทีมงานยืนยันราคาและค่าส่ง หรือให้เราเลือกให้ เหมา 100 กก. 1,500฿ รวมส่ง
              </p>
              <Link href="/catalog/stock" className={`${btn} mt-6 bg-brand px-8 text-white hover:bg-brand-dark`}>
                เปิดเครื่องคิดราคา →
              </Link>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
              <table className="w-full min-w-[440px] text-center text-[13px]">
                <thead>
                  <tr className="text-white/60">
                    <th className="px-3 py-3 text-left font-medium">บาท/ตัว</th>
                    {stock.steps.map((st) => (
                      <th key={st.label} className="px-2 py-3 font-medium">{st.label.replace(" ตัวขึ้นไป", "+").replace(" ตัว", "")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LADDER_ITEMS.map((it) => (
                    <tr key={it.sku} className="border-t border-white/10">
                      <td className="px-3 py-3 text-left font-semibold">{it.name}</td>
                      {it.prices.map((p, i) => (
                        <td key={i} className={`px-2 py-3 tabular-nums ${i === it.prices.length - 1 ? "font-extrabold text-gold" : "text-white/85"}`}>{p}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Container>
      </section>


      {/* ---------- VIDEO SHOWCASE (คลิปจากเพจ) + SEO ---------- */}
      <section className="bg-cream py-16">
        <Container>
          <div className="grid items-center gap-8 lg:grid-cols-[300px_1fr]">
            {/* คลิปตัวอย่างสินค้าจากเพจ KAN HUB */}
            <div className="mx-auto w-full max-w-[300px]">
              <div className="relative aspect-[300/476] overflow-hidden rounded-2xl border border-hair bg-dark shadow-sm">
                <FbEmbed
                  src="https://www.facebook.com/plugins/video.php?height=476&href=https%3A%2F%2Fwww.facebook.com%2Freel%2F1028697343201063%2F&show_text=false&width=300&t=0"
                  title="คลิปเปิดกระสอบเสื้อผ้ามือสองญี่ปุ่น KAN HUB"
                  poster={
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#2a1115] to-[#120b0a] text-white">
                      <span className="grid h-16 w-16 place-items-center rounded-full bg-white/15 text-2xl backdrop-blur-sm transition-transform group-hover:scale-110">▶</span>
                      <span className="text-sm font-semibold">ดูคลิปเปิดกระสอบ</span>
                      <span className="text-[11px] text-white/55">กดเพื่อเล่นจาก Facebook</span>
                    </div>
                  }
                />
              </div>
            </div>

            {/* copy กระตุ้นซื้อ (SEO) */}
            <div>
              <Eyebrow>เห็นของจริงก่อนตัดสินใจ</Eyebrow>
              <h2 className="text-2xl font-bold text-ink sm:text-3xl">
                เปิดกระสอบให้ดูทุกก้อน — เห็นของจริงก่อนโอน
              </h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
                ที่ KAN HUB เราถ่ายเปิดกระสอบเสื้อผ้ามือสองญี่ปุ่นให้ดูของจริงทุกก้อน
                ทั้งในไลฟ์และคลิปบนเพจ คุณเห็นสภาพงานเกรด A ก่อนตัดสินใจ — ไม่ต้องเสี่ยงซื้อของที่ไม่เห็นหน้า
                เลือกก้อนที่ใช่แล้วทักไลน์สั่งได้ทันที ส่งทั่วไทย
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "ถ่ายเปิดกระสอบทุกก้อนก่อนส่ง — เห็นของตรงปก ไม่มีสลับ",
                  "คัดเกรด A นำเข้าตรงจากญี่ปุ่น ไม่ผ่านคนกลาง ราคาต้นทาง",
                  "ขายง่าย กำไรดี พร้อมเปิดร้าน–ขายตลาดนัดได้ทันที",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[15px] text-ink/80">
                    <span className="mt-0.5 text-line">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={SITE.lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${btn} bg-line text-white hover:bg-line-dark`}
                >
                  <LineIcon /> ทักไลน์เลือกก้อน
                </a>
                <a
                  href={SITE.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${btn} border-[1.5px] border-hair bg-white text-ink hover:bg-cream-100`}
                >
                  <FbIcon /> ดูคลิปทั้งหมดบนเพจ
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------- FACEBOOK PAGE FEED ---------- */}
      <section className="bg-cream-100 py-16">
        <Container>
          <div className="text-center">
            <Eyebrow>อัปเดตทุกวัน</Eyebrow>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">
              คอนเทนต์ล่าสุดจากเพจ KAN HUB
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-[15px] text-muted">
              ตามดูกระสอบใหม่ รอบไลฟ์ และโปรโมชั่นล่าสุด — อัปเดตทุกวันบนเฟซบุ๊ก
            </p>
          </div>
          <div className="mt-8 flex justify-center">
            <div className="relative h-[640px] w-full max-w-[500px] overflow-hidden rounded-2xl border border-hair bg-white shadow-sm">
              <FbEmbed
                src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2FKANHUBB&tabs=timeline&width=500&height=640&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true"
                title="เพจ Facebook KAN HUB"
                poster={
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-cream-100 text-center">
                    <FbIcon className="h-12 w-12" />
                    <span className="text-[15px] font-semibold text-ink">ดูโพสต์ล่าสุดจากเพจ KAN HUB</span>
                    <span className="text-[13px] text-muted">กดเพื่อโหลดฟีดเฟซบุ๊ก</span>
                  </div>
                }
              />
            </div>
          </div>
        </Container>
      </section>

      {/* ---------- ตัวอย่างของในก้อน (แกลเลอรีรูปจริงจากโกดัง) ---------- */}
      <section className="bg-white py-16">
        <Container>
          <div className="text-center">
            <Eyebrow>รูปจริงจากโกดัง</Eyebrow>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">ตัวอย่างของที่ได้จากก้อน</h2>
            <p className="mx-auto mt-2 max-w-2xl text-[15px] text-muted">
              ยีนส์ เสื้อยืด เสื้อหนาว ผ้าเด็ก งานติดป้ายแบรนด์ — ถ่ายจากของจริงหน้าโกดัง ไม่ใช่รูปสต๊อก
            </p>
          </div>

          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {HOME_SAMPLES.map((s) => (
              <div
                key={s.src}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-hair bg-cream-100"
              >
                <Image
                  src={s.src}
                  alt={`ตัวอย่าง${s.label} เสื้อผ้ามือสองญี่ปุ่น KAN HUB`}
                  fill
                  loading="lazy"
                  sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 260px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/catalog#samples"
              className={`${btn} border-[1.5px] border-hair bg-white text-ink hover:bg-cream-100`}
            >
              ดูตัวอย่างทั้งหมด {SAMPLE_TOTAL} รูป
            </Link>
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
                    loading="eager"
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
              <LineIcon /> แอด LINE
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

      {/* ---------- บทความล่าสุด (ลิงก์ภายใน หน้าแรก → บทความ) ---------- */}
      <section className="bg-cream py-16">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>ความรู้คนขายมือสอง</Eyebrow>
              <h2 className="text-2xl font-bold text-ink sm:text-3xl">บทความล่าสุด</h2>
            </div>
            <Link href="/blog" className="text-[15px] font-semibold text-brand hover:text-brand-dark">ดูบทความทั้งหมด {ARTICLES.length} เรื่อง →</Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ARTICLES.slice(0, 6).map((a) => (
              <Link key={a.slug} href={`/blog/${a.slug}`} className="group overflow-hidden rounded-2xl border border-hair bg-white hover:shadow-md">
                <div className="relative aspect-[16/9] bg-cream-100">
                  <Image src={a.cover} alt={a.coverAlt} fill loading="lazy" sizes="(max-width:640px) 100vw, 360px" className="object-cover" />
                </div>
                <div className="p-5">
                  <h3 className="text-[16px] font-semibold leading-snug text-ink group-hover:text-brand">{a.title}</h3>
                  <p className="mt-2 text-[14px] text-muted">{a.excerpt}</p>
                </div>
              </Link>
            ))}
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
                loading="eager"
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
                <LineIcon /> ทักไลน์ขอใบเสนอราคา
              </a>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
