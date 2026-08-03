"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, SITE } from "@/lib/site";
import { Container } from "./Container";
import { Logo } from "./Logo";
import { cn } from "@/lib/cn";

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-hair bg-cream/90 backdrop-blur supports-[backdrop-filter]:bg-cream/75">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />

        {/* เมนูหลัก (จอใหญ่) */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-[15px] font-medium transition-colors",
                  active
                    ? "text-brand"
                    : "text-ink/80 hover:text-brand hover:bg-cream-100"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={SITE.lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-xl bg-line px-4 py-2.5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-line-dark sm:inline-flex"
          >
            💬 แอด LINE
          </a>
          {/* ปุ่มเปิดเมนูมือถือ */}
          <button
            type="button"
            aria-label="เปิดเมนู"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-hair text-ink lg:hidden"
          >
            <span className="sr-only">เมนู</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </Container>

      {/* เมนูมือถือ */}
      {open && (
        <div className="border-t border-hair bg-cream lg:hidden">
          <Container className="flex flex-col py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-ink/85 hover:bg-cream-100"
              >
                {item.label}
              </Link>
            ))}
            <a
              href={SITE.lineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 rounded-xl bg-line px-4 py-3 text-center text-[15px] font-semibold text-white"
            >
              💬 แอด LINE ดูราคา
            </a>
          </Container>
        </div>
      )}
    </header>
  );
}
