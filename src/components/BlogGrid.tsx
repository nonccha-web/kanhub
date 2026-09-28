"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

/* กริดบทความหน้า /blog — กรองหมวด + ดูเพิ่ม/ย่อลง
   ทุกบทความอยู่ใน HTML ตั้งแต่แรก (ซ่อนด้วย class) Google จึงเห็นลิงก์ครบทุกเรื่อง */
type Item = { slug: string; title: string; cover: string; coverAlt: string; category: string; excerpt: string; readMin: number };
const STEP = 9;

export function BlogGrid({ items, cats, colors }: { items: Item[]; cats: string[]; colors: Record<string, string> }) {
  const [cat, setCat] = useState<string>("");
  const [shown, setShown] = useState(STEP);
  const list = items.filter((a) => !cat || a.category === cat);
  const chip = (on: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${on ? "bg-brand text-white" : "border border-hair bg-white text-ink/80 hover:border-ink"}`;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(!cat)} onClick={() => { setCat(""); setShown(STEP); }}>ทั้งหมด ({items.length})</button>
        {cats.map((c) => (
          <button key={c} type="button" className={chip(cat === c)} onClick={() => { setCat(c); setShown(STEP); }}>
            {c} ({items.filter((a) => a.category === c).length})
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => {
          const idx = list.indexOf(a);
          const visible = idx !== -1 && idx < shown;
          return (
            <Link key={a.slug} href={`/blog/${a.slug}`} className={`group flex-col overflow-hidden rounded-2xl border border-hair bg-white transition-shadow hover:shadow-md ${visible ? "flex" : "hidden"}`}>
              <div className="relative h-40">
                <Image src={a.cover} alt={a.coverAlt} fill loading="lazy" sizes="(max-width:640px) 100vw, 360px" className="object-cover" />
                <span className="absolute left-3 top-3 inline-block rounded-md px-2.5 py-1 text-xs font-bold text-white" style={{ background: colors[a.category] }}>{a.category}</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-[16px] font-semibold leading-snug text-ink group-hover:text-brand">{a.title}</h3>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted">{a.excerpt}</p>
                <div className="mt-4 text-xs text-muted">อ่าน {a.readMin} นาที</div>
              </div>
            </Link>
          );
        })}
      </div>

      {list.length > STEP && (
        <div className="mt-8 text-center">
          {shown < list.length ? (
            <button type="button" onClick={() => setShown((n) => n + STEP)} className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink px-6 py-3 text-[15px] font-semibold text-ink hover:bg-ink hover:text-white">
              ดูบทความเพิ่ม ({list.length - shown} เรื่อง) ▼
            </button>
          ) : (
            <button type="button" onClick={() => setShown(STEP)} className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink px-6 py-3 text-[15px] font-semibold text-ink hover:bg-ink hover:text-white">
              ย่อลง ▲
            </button>
          )}
        </div>
      )}
    </div>
  );
}
