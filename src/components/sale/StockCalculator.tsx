"use client";

import { useMemo, useState } from "react";
import data from "@/lib/stock-prices.json";
import { SITE } from "@/lib/site";
import { LeadDialog } from "./LeadDialog";

/* เครื่องคิดราคาผ้าสต๊อก "คัดเองรายตัว" — เรทจากชีต KAN#0 (etl/stock-prices.py)
   ขั้นราคานับแยกต่อรายการ (นนท์ 25 ก.ย. 69) ไม่ใช่รวมทั้งออเดอร์ */

type Item = { sku: string; group: string; cat: string; name: string; prices: number[] };
const ITEMS = data.items as Item[];
const STEPS = data.steps as { min: number; max: number | null; label: string }[];
const baht = (n: number) => n.toLocaleString("en-US");

function stepIndex(qty: number) {
  for (let i = STEPS.length - 1; i >= 0; i--) if (qty >= STEPS[i].min) return i;
  return 0;
}
const unitPrice = (it: Item, qty: number) => it.prices[stepIndex(qty)];

export function StockCalculator() {
  const [group, setGroup] = useState<"ผู้ใหญ่" | "เด็ก">("ผู้ใหญ่");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);

  const cats = useMemo(() => {
    const m = new Map<string, Item[]>();
    ITEMS.filter((i) => i.group === group).forEach((i) => m.set(i.cat, [...(m.get(i.cat) || []), i]));
    return [...m.entries()];
  }, [group]);

  const picked = ITEMS.filter((i) => (qty[i.sku] || 0) > 0);
  const pcs = picked.reduce((n, i) => n + qty[i.sku], 0);
  const total = picked.reduce((n, i) => n + unitPrice(i, qty[i.sku]) * qty[i.sku], 0);
  const setQ = (sku: string, v: number) => setQty((q) => ({ ...q, [sku]: Math.max(0, Math.min(5000, Math.round(v) || 0)) }));

  const lineText = [
    "สนใจผ้าสต๊อก (คัดเองรายตัว) จากเว็บ",
    ...picked.map((i) => `• ${i.name} × ${qty[i.sku]} ตัว @${unitPrice(i, qty[i.sku])} = ${baht(unitPrice(i, qty[i.sku]) * qty[i.sku])} บ.`),
    `รวม ${baht(pcs)} ตัว ประมาณ ${baht(total)} บ.`,
  ].join("\n");
  const lineHref = `https://line.me/R/oaMessage/${encodeURIComponent(SITE.lineId)}/?${encodeURIComponent(lineText)}`;

  return (
    <div>
      {/* ขั้นราคา */}
      <div className="grid grid-cols-5 gap-1.5 text-center">
        {STEPS.map((s, i) => (
          <div key={s.label} className="rounded-lg px-1 py-2 text-white" style={{ background: `rgba(200,16,46,${0.35 + i * 0.16})` }}>
            <div className="text-[12px] font-bold leading-tight sm:text-[13px]">{s.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[12.5px] text-muted">ราคาต่อตัวลดตามจำนวน นับแยกทีละรายการ</p>

      <div className="mt-5 inline-flex rounded-xl border-[1.5px] border-hair bg-white p-1">
        {(["ผู้ใหญ่", "เด็ก"] as const).map((g) => (
          <button key={g} type="button" onClick={() => setGroup(g)} className={`rounded-lg px-5 py-2 text-[15px] font-semibold ${group === g ? "bg-ink text-white" : "text-muted"}`}>
            เสื้อผ้า{g}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-6">
        {cats.map(([cat, items]) => (
          <div key={cat}>
            <h3 className="mb-2 text-[15px] font-bold text-ink">{cat}</h3>
            <div className="divide-y divide-hair overflow-hidden rounded-2xl border border-hair bg-white">
              {items.map((it) => {
                const q = qty[it.sku] || 0;
                const si = stepIndex(Math.max(1, q));
                const next = si < STEPS.length - 1 ? STEPS[si + 1] : null;
                return (
                  <div key={it.sku} className={`px-3.5 py-3 sm:px-4 ${q ? "bg-[#fff6f6]" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold leading-snug text-ink">{it.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {it.prices.map((p, i) => (
                            <span key={i} className={`rounded px-1.5 py-0.5 text-[11.5px] tabular-nums ${q && i === si ? "bg-brand font-bold text-white" : "bg-cream-100 text-muted"}`}>
                              {p}฿
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center rounded-xl border-[1.5px] border-hair bg-white">
                        <button type="button" aria-label={`ลด ${it.name}`} onClick={() => setQ(it.sku, q - 1)} className="h-10 w-9 text-lg text-ink">−</button>
                        <input
                          value={q || ""}
                          onChange={(e) => setQ(it.sku, parseInt(e.target.value.replace(/\D/g, ""), 10))}
                          inputMode="numeric"
                          placeholder="0"
                          aria-label={`จำนวน ${it.name}`}
                          className="h-10 w-12 bg-transparent text-center text-[15px] font-bold tabular-nums text-ink outline-none"
                        />
                        <button type="button" aria-label={`เพิ่ม ${it.name}`} onClick={() => setQ(it.sku, q + 1)} className="h-10 w-9 text-lg text-ink">+</button>
                      </div>
                    </div>
                    {q > 0 && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]">
                        <span className="text-ink">
                          {q} ตัว × <b>{unitPrice(it, q)}฿</b> = <b className="text-brand">{baht(unitPrice(it, q) * q)}฿</b>
                        </span>
                        {next && it.prices[si + 1] < it.prices[si] && (
                          <button type="button" onClick={() => setQ(it.sku, next.min)} className="font-semibold text-brand underline-offset-2 hover:underline">
                            เพิ่มอีก {next.min - q} ตัว เหลือ {it.prices[si + 1]}฿/ตัว
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* สรุปติดขอบล่าง */}
      <div className="calc-bar sticky bottom-0 z-30 -mx-5 mt-6 border-t border-hair bg-white/95 px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[12.5px] text-muted">{pcs ? `${picked.length} รายการ · ${baht(pcs)} ตัว` : "ยังไม่ได้เลือกสินค้า"}</div>
            <div className="text-2xl font-extrabold tabular-nums text-ink">{baht(total)}฿</div>
          </div>
          <button
            type="button"
            disabled={!pcs}
            onClick={() => setOpen(true)}
            className="rounded-xl bg-brand px-4 py-3.5 text-[15px] font-bold text-white shadow-[0_4px_0_#9e0b22] disabled:bg-muted/40 disabled:shadow-none sm:px-6"
          >
            ส่งให้ทีมยืนยันราคา
          </button>
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted">ราคาประเมิน ยังไม่รวมค่าส่ง · ทีมงานเช็คของในสต๊อกแล้วโทรยืนยันอีกครั้ง</p>
      </div>

      <LeadDialog
        open={open}
        onClose={() => setOpen(false)}
        page="stock-pick"
        title="ส่งรายการให้ทีมยืนยันราคา"
        payload={{ items: picked.map((i) => ({ sku: i.sku, qty: qty[i.sku] })) }}
        summary={
          <div>
            <ul className="space-y-0.5">
              {picked.map((i) => (
                <li key={i.sku} className="flex justify-between gap-3">
                  <span className="truncate">{i.name} × {qty[i.sku]}</span>
                  <span className="shrink-0 tabular-nums">{baht(unitPrice(i, qty[i.sku]) * qty[i.sku])}฿</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-hair pt-2 font-bold">
              <span>รวม {baht(pcs)} ตัว</span><span className="tabular-nums text-brand">{baht(total)}฿</span>
            </div>
            <a href={lineHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[13px] font-semibold text-line-dark underline">
              หรือส่งรายการนี้ทาง LINE แทน →
            </a>
          </div>
        }
      />
    </div>
  );
}
