"use client";

import { useState } from "react";
import { LeadDialog } from "./LeadDialog";

/* ผ้าสต๊อก "ให้ร้านเลือกให้" — เหมาทีละ 100 กก. 1,500฿ รวมส่ง (ฟรีภาคกลาง/ใต้) หรือมารับเอง 1,000฿ */
export function StockBulk() {
  const [lots, setLots] = useState(1);
  const [pickup, setPickup] = useState(false);
  const [open, setOpen] = useState(false);
  const price = lots * (pickup ? 1000 : 1500);
  const opt = (on: boolean) =>
    `flex-1 rounded-xl border-[1.5px] px-3 py-3 text-left transition-colors ${on ? "border-ink bg-ink text-white" : "border-hair bg-white text-ink"}`;

  return (
    <div className="rounded-3xl border-[1.5px] border-ink bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-brand">ไม่อยากคัดเอง? ให้เราเลือกให้</p>
          <h3 className="mt-1 text-2xl font-extrabold text-ink">เหมา 100 กก. 1,500฿</h3>
          <p className="mt-1 text-[14px] text-muted">รวมค่าส่งแล้ว (ส่งฟรีเฉพาะภาคกลางและภาคใต้) · ขั้นต่ำ 100 กก.</p>
        </div>
        <div className="text-right">
          <div className="text-[12.5px] text-muted">เฉลี่ย</div>
          <div className="text-xl font-extrabold text-ink">{pickup ? 10 : 15}฿/กก.</div>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => setPickup(false)} className={opt(!pickup)} aria-pressed={!pickup}>
          <b className="block text-[15px]">ส่งถึงที่</b>
          <span className={`text-[12.5px] ${!pickup ? "text-white/75" : "text-muted"}`}>1,500฿ / 100 กก.</span>
        </button>
        <button type="button" onClick={() => setPickup(true)} className={opt(pickup)} aria-pressed={pickup}>
          <b className="block text-[15px]">มารับเองที่โกดัง</b>
          <span className={`text-[12.5px] ${pickup ? "text-white/75" : "text-muted"}`}>1,000฿ / 100 กก.</span>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-xl border-[1.5px] border-hair bg-white">
          <button type="button" aria-label="ลด" onClick={() => setLots((n) => Math.max(1, n - 1))} className="h-11 w-11 text-xl text-ink">−</button>
          <span className="min-w-20 text-center text-[16px] font-bold text-ink">{lots * 100} กก.</span>
          <button type="button" aria-label="เพิ่ม" onClick={() => setLots((n) => Math.min(50, n + 1))} className="h-11 w-11 text-xl text-ink">+</button>
        </div>
        <div className="text-right">
          <div className="text-[12.5px] text-muted">ยอดรวม</div>
          <div className="text-3xl font-extrabold tabular-nums text-brand">{price.toLocaleString("en-US")}฿</div>
        </div>
      </div>

      <button type="button" onClick={() => setOpen(true)} className="mt-5 w-full rounded-xl bg-brand px-5 py-4 text-[16px] font-bold text-white shadow-[0_4px_0_#9e0b22] hover:bg-brand-dark">
        สั่งเหมา {lots * 100} กก.
      </button>

      <LeadDialog
        open={open}
        onClose={() => setOpen(false)}
        page="stock-bulk"
        title={`เหมาผ้าสต๊อก ${lots * 100} กก.`}
        payload={{ qty: lots, pickup }}
        summary={
          <div className="flex justify-between gap-3">
            <span>{lots * 100} กก. · {pickup ? "มารับเองที่โกดัง" : "ส่งถึงที่"}</span>
            <b className="tabular-nums text-brand">{price.toLocaleString("en-US")}฿</b>
          </div>
        }
      />
    </div>
  );
}
