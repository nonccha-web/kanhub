"use client";

import { useState } from "react";
import { LeadDialog } from "./LeadDialog";

/* ปุ่ม "สอบถาม / จอง" ของก้อนผ้า และกระสอบ 45 กก. — เลือกแบบ + จำนวน แล้วฝากเบอร์ */
export function OfferInquiry({
  page,
  title,
  label,
  unit,
  choices,
  className,
}: {
  page: "bale" | "sack-45";
  title: string;
  label: string;
  unit: string;
  choices: { name: string; price: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(choices[0]?.name || "");
  const [qty, setQty] = useState(1);
  const chip = (on: boolean) =>
    `rounded-xl border-[1.5px] px-3 py-2.5 text-left text-[14px] transition-colors ${on ? "border-ink bg-ink text-white" : "border-hair bg-white text-ink hover:border-ink/40"}`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <LeadDialog
        open={open}
        onClose={() => setOpen(false)}
        page={page}
        title={title}
        payload={{ choice, qty }}
        submitLabel="ส่งให้ทีมงานเช็คของ + โทรกลับ"
      >
        <span className="mb-1.5 block text-[14px] font-semibold text-ink">เลือกแบบ</span>
        <div className="grid grid-cols-2 gap-2">
          {choices.map((c) => (
            <button key={c.name} type="button" onClick={() => setChoice(c.name)} className={chip(choice === c.name)} aria-pressed={choice === c.name}>
              <b className="block">{c.name}</b>
              <span className={`text-[12px] ${choice === c.name ? "text-white/75" : "text-muted"}`}>{c.price}</span>
            </button>
          ))}
        </div>
        <span className="mb-1.5 mt-4 block text-[14px] font-semibold text-ink">จำนวน</span>
        <div className="inline-flex items-center rounded-xl border-[1.5px] border-hair bg-white">
          <button type="button" aria-label="ลด" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 text-xl text-ink">−</button>
          <span className="min-w-16 text-center text-[16px] font-bold text-ink">{qty} {unit}</span>
          <button type="button" aria-label="เพิ่ม" onClick={() => setQty((q) => Math.min(20, q + 1))} className="h-11 w-11 text-xl text-ink">+</button>
        </div>
      </LeadDialog>
    </>
  );
}
