import Link from "next/link";
import { Container } from "./Container";
import { Logo } from "./Logo";
import { LineIcon, FbIcon } from "./BrandIcons";
import { FOOTER_COLUMNS, SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="bg-dark text-white/70">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <span className="inline-flex rounded-lg bg-white/95 px-3 py-2">
              <Logo />
            </span>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
              โกดังขายส่งเสื้อผ้ามือสองญี่ปุ่น นำเข้าตรง บริษัทจริง ภาคใต้ — {SITE.branches}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={SITE.lineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-line px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-line-dark"
              >
                <LineIcon /> แอด LINE
              </a>
              <a
                href={SITE.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3.5 py-2 text-sm font-medium text-white/80 transition-colors hover:border-white/40"
              >
                <FbIcon /> Facebook
              </a>
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-white">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l, i) => (
                  <li key={`${l.href}-${i}`}>
                    <Link
                      href={l.href}
                      className="text-sm text-white/60 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-white/45">
          © 2026 KAN HUB · บริษัทจดทะเบียนถูกต้อง · โอนบัญชีบริษัทเท่านั้น
        </div>
      </Container>
    </footer>
  );
}
