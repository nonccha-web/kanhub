import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/Container";
import { CtaBand } from "@/components/CtaBand";
import { CATEGORIES, type Category } from "@/lib/categories";
import { SITE } from "@/lib/site";
import stock from "@/lib/stock-prices.json";

/* หน้าหมวดสินค้า (เดรส / ยีนส์ / กระโปรง / เสื้อ / เด็ก / โค้ท / ไหมพรม)
   ตารางราคาดึงจากชีต KAN#0 ทุกครั้งที่ build — แก้ราคาที่ชีตแล้วรัน etl/stock-prices.py */

const btn = "inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-3.5 text-[15px] font-bold transition-colors";

export function CategoryView({ c }: { c: Category }) {
  const rows = c.items
    .map((n) => stock.items.find((i) => i.name === n))
    .filter((i): i is (typeof stock.items)[number] => !!i);
  const all = rows.flatMap((r) => r.prices);
  const low = Math.min(...all);
  const high = Math.max(...all);
  const others = CATEGORIES.filter((x) => x.slug !== c.slug);
  const url = `${SITE.url}/catalog/${c.slug}/`;

  const faqs = [
    ...c.faqs,
    { q: `ซื้อ${c.name}ขั้นต่ำกี่ตัว?`, a: "คัดเองเริ่มได้ตั้งแต่ 1 ตัว ราคาลด 5 ขั้นตามจำนวนต่อรายการ (1–2 / 3–5 / 6–24 / 25–99 / 100 ตัวขึ้นไป) หรือเหมาผ้าให้ทีมงานเลือกให้ 100 กก. 1,500 บาท รวมส่ง" },
    { q: "ส่งทั่วไทยไหม?", a: "ส่งทั่วประเทศ คิดค่าส่งตามน้ำหนักและปลายทาง แจ้งยอดก่อนโอนทุกครั้ง หรือนัดมาคัดเองที่โกดัง KAN HUB ภาคใต้" },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: `${c.name} ขายส่ง`,
        description: c.intro,
        image: c.images.slice(0, 3).map((s) => `${SITE.url}${s}`),
        brand: { "@type": "Brand", name: SITE.name },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "THB",
          lowPrice: low,
          highPrice: high,
          offerCount: rows.length,
          availability: "https://schema.org/InStock",
          url,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "หน้าแรก", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "สินค้า", item: `${SITE.url}/catalog/` },
          { "@type": "ListItem", position: 3, name: c.name, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="bg-dark py-12 text-white sm:py-14">
        <Container>
          <nav className="mb-3 text-[13px] text-white/55">
            <Link href="/" className="hover:text-white">หน้าแรก</Link> ›{" "}
            <Link href="/catalog" className="hover:text-white">สินค้า</Link> › <span className="text-white/80">{c.name}</span>
          </nav>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
            {c.h1} <span className="text-gold">ตัวละ {low}–{high} บาท</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/75">{c.intro}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/catalog/stock#calc" className={`${btn} bg-brand text-white hover:bg-brand-dark`}>คิดราคา{c.name} →</Link>
            <a href={SITE.lineUrl} target="_blank" rel="noopener noreferrer" className={`${btn} border-[1.5px] border-white/40 text-white hover:bg-white/10`}>ทักไลน์ขอรูปเพิ่ม</a>
          </div>
        </Container>
      </section>

      <section className="bg-cream py-12">
        <Container>
          <h2 className="text-xl font-bold text-ink">ราคาขายส่ง{c.name} (บาท/ตัว)</h2>
          <p className="mt-1 text-[14px] text-muted">ราคาลดตามจำนวน นับแยกต่อรายการ · อัปเดต {stock.updated}</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-hair bg-white">
            <table className="w-full min-w-[520px] text-center text-[14px]">
              <thead className="bg-cream-100 text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">รายการ</th>
                  {stock.steps.map((s) => (
                    <th key={s.label} className="px-2 py-3 font-semibold">{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sku} className="border-t border-hair">
                    <td className="px-4 py-3 text-left font-semibold text-ink">{r.name}</td>
                    {r.prices.map((p, i) => (
                      <td key={i} className={`px-2 py-3 tabular-nums ${i === r.prices.length - 1 ? "font-extrabold text-brand" : "text-ink/80"}`}>{p}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-12 text-xl font-bold text-ink">ซื้อ{c.name}ได้ 3 แบบ</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Link href="/catalog/stock#calc" className="rounded-2xl border-[1.5px] border-ink bg-white p-5 hover:shadow-md">
              <div className="text-[13px] font-bold text-brand">คัดเองรายตัว</div>
              <div className="mt-1 text-lg font-extrabold text-ink">เลือกทีละตัว {low}–{high}฿</div>
              <p className="mt-1 text-[14px] text-muted">ใส่จำนวนในเครื่องคิดราคา ได้ยอดทันที แล้วส่งให้ทีมยืนยัน</p>
            </Link>
            <Link href="/catalog/sack-45" className="rounded-2xl border border-hair bg-white p-5 hover:shadow-md">
              <div className="text-[13px] font-bold text-brand">ยกกระสอบ 45 กก.</div>
              <div className="mt-1 text-lg font-extrabold text-ink">เกรด A-B ราว 5,000฿</div>
              <p className="mt-1 text-[14px] text-muted">ผ้าบาง ~250 ตัว · ผ้าหนา ~100 ตัว · หนามาก ~60 ตัว</p>
            </Link>
            {c.promo ? (
              <a href="/grade-b/" className="rounded-2xl border border-brand bg-white p-5 hover:shadow-md">
                <div className="text-[13px] font-bold text-brand">โปรโมชั่น · ผ้าปลดราว B-C</div>
                <div className="mt-1 text-lg font-extrabold text-ink">250 ตัว 1,500฿ ส่งฟรี*</div>
                <p className="mt-1 text-[14px] text-muted">คละเสื้อ เดรส กางเกง กระโปรง · *ภาคกลางและภาคใต้</p>
              </a>
            ) : (
              <Link href="/catalog/pha-hang" className="rounded-2xl border border-hair bg-white p-5 hover:shadow-md">
                <div className="text-[13px] font-bold text-brand">ผ้าหาง / ผ้าเหมากิโล</div>
                <div className="mt-1 text-lg font-extrabold text-ink">100 กก. 1,500฿ รวมส่ง*</div>
                <p className="mt-1 text-[14px] text-muted">ทีมงานเลือกให้ · มารับเอง 1,000฿</p>
              </Link>
            )}
          </div>

          <h2 className="mt-12 text-xl font-bold text-ink">รูปจริง{c.name}จากโกดัง</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {c.images.map((src, i) => (
              <div key={src} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-hair bg-cream-100">
                <Image src={src} alt={`${c.aka[i % c.aka.length]} ขายส่ง KAN HUB ${i + 1}`} fill loading="lazy" sizes="(max-width:640px) 50vw, 260px" className="object-cover" />
              </div>
            ))}
          </div>

          <h2 className="mt-12 text-xl font-bold text-ink">คำถามที่พบบ่อย</h2>
          <div className="mt-4 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-hair bg-white p-5 open:shadow-sm">
                <summary className="cursor-pointer list-none text-[15px] font-semibold text-ink">{f.q}</summary>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>

          <p className="mt-10 text-[14px] leading-relaxed text-muted">
            ลูกค้าเรียกหมวดนี้หลายแบบ เช่น {c.aka.join(" · ")} — ทั้งหมดคือ{c.name}นำเข้าจากญี่ปุ่นของ KAN HUB โกดังขายส่งเสื้อผ้ามือสองภาคใต้ ส่งทั่วไทย
          </p>

          <h2 className="mt-10 text-lg font-bold text-ink">หมวดอื่น</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {others.map((o) => (
              <Link key={o.slug} href={`/catalog/${o.slug}`} className="rounded-full border border-hair bg-white px-4 py-2 text-[14px] font-semibold text-ink hover:border-ink">
                {o.name}
              </Link>
            ))}
            <Link href="/catalog/pha-hang" className="rounded-full border border-hair bg-white px-4 py-2 text-[14px] font-semibold text-ink hover:border-ink">ผ้าหาง / ผ้าเหมา</Link>
            <Link href="/catalog/bale" className="rounded-full border border-hair bg-white px-4 py-2 text-[14px] font-semibold text-ink hover:border-ink">ก้อนผ้า 350 กก.</Link>
          </div>
        </Container>
      </section>

      <CtaBand title={`สนใจ${c.name}ไปขาย?`} subtitle="ทักมาบอกจำนวนกับงบ ทีมงานส่งรูป/คลิปของจริงให้ดูก่อนโอน" />
    </>
  );
}
