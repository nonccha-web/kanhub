import Image from "next/image";
import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { LineIcon, FbIcon } from "@/components/BrandIcons";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "ติดต่อเรา",
  description:
    "ติดต่อ KAN HUB โกดังขายส่งเสื้อผ้ามือสองญี่ปุ่นภาคใต้ — LINE @kanhub, โทร 02-114-3390, Facebook KANHUBB เปิดจันทร์–เสาร์ 9:00–18:00 โอนบัญชีบริษัทเท่านั้น",
  alternates: { canonical: "/contact" },
};

const ROWS = [
  { icon: "line", label: "LINE Official", value: `${SITE.lineId} — ${SITE.lineHours}`, href: SITE.lineUrl },
  { icon: "phone", label: "โทร", value: SITE.phone, href: SITE.phoneHref },
  { icon: "fb", label: "Facebook", value: SITE.facebookName, href: SITE.facebook },
  { icon: "clock", label: "เวลาทำการ", value: SITE.hours, href: null },
];

const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-6 py-3.5 text-[15px] font-semibold transition-colors";

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="ติดต่อเรา"
        title="โกดัง KAN HUB ภาคใต้"
        subtitle={`ทักไลน์ โทร หรือแวะมาดูของที่โกดังได้ — ${SITE.branches}`}
      />

      <section className="bg-cream py-16">
        <Container>
          <div className="mx-auto mb-8 max-w-3xl rounded-xl border border-[#f6c9c9] bg-[#fdecec] px-4 py-3 text-center text-sm text-[#8c1d1d]">
            ⚠️ เพื่อความปลอดภัย — <span className="font-bold">โอนเข้าบัญชีบริษัทเท่านั้น</span> ระวังมิจฉาชีพแอบอ้าง
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
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
                {ROWS.map((c) => (
                  <li key={c.label} className="flex items-start gap-3 rounded-xl border border-hair bg-white px-4 py-3.5">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center">
                      {c.icon === "line" ? <LineIcon /> : c.icon === "fb" ? <FbIcon /> : <span className="text-lg">{c.icon === "phone" ? "📞" : "🕗"}</span>}
                    </span>
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
