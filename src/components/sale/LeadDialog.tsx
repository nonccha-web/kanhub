"use client";

import { useEffect, useRef, useState } from "react";

/* ฟอร์มฝากชื่อ-เบอร์ → POST /api/sale-lead → ลีดใน CRM หลังบ้าน + เด้ง Lark
   ใช้ร่วมทุกแบบขาย (ก้อน / กระสอบ / ผ้าสต๊อก) — ฝั่ง worker คิดราคาซ้ำเอง ไม่เชื่อยอดจากหน้านี้ */

export type LeadPayload = Record<string, unknown>;

export function LeadDialog({
  open,
  onClose,
  page,
  title,
  summary,
  payload,
  submitLabel = "ส่งให้ทีมงานโทรกลับ",
  children,
}: {
  open: boolean;
  onClose: () => void;
  page: string;
  title: string;
  summary?: React.ReactNode;
  payload?: LeadPayload;
  submitLabel?: string;
  children?: React.ReactNode;   // ช่องเลือกเพิ่มเติมของแต่ละแบบ (อยู่ใต้สรุป)
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [hp, setHp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => nameRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) { setDone(false); setErr(""); }
  }, [open]);

  const fmtPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    return d.length > 6 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const digits = phone.replace(/\D/g, "");
    if (!name.trim()) return setErr("ใส่ชื่อด้วยนะคะ");
    if (!/^0\d{8,9}$/.test(digits)) return setErr("เบอร์โทรไม่ถูกต้อง ลองใส่ใหม่อีกครั้ง (เช่น 0812345678)");
    setBusy(true);
    try {
      const r = await fetch("/api/sale-lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, page, name: name.trim(), phone: digits, province, website: hp }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "ส่งไม่สำเร็จ");
      setDone(true);
    } catch (x) {
      const m = x instanceof Error ? x.message : "";
      setErr(m && m !== "Failed to fetch" ? m : "ส่งไม่สำเร็จ เช็กอินเทอร์เน็ตแล้วลองใหม่อีกครั้งนะคะ");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  const input = "w-full rounded-xl border-[1.5px] border-hair bg-white px-3.5 py-3 text-base text-ink outline-none focus:border-ink";

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[92vh] max-w-[560px] overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-6">
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-hair sm:hidden" />
        <button type="button" onClick={onClose} aria-label="ปิด" className="absolute right-4 top-3 grid h-9 w-9 place-items-center rounded-full text-xl text-muted hover:bg-cream-100">×</button>

        {done ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-line text-2xl text-white">✓</div>
            <h3 className="text-xl font-extrabold text-ink">ส่งเรียบร้อยแล้วค่ะ</h3>
            <p className="mt-2 text-[15px] text-muted">
              ทีมงาน KAN HUB จะโทรกลับที่เบอร์ <b className="text-ink">{phone}</b> เพื่อยืนยันราคาและค่าส่ง
            </p>
            <button type="button" onClick={onClose} className="mt-5 rounded-xl border-[1.5px] border-hair px-6 py-3 text-[15px] font-semibold text-ink hover:bg-cream-100">
              ปิด
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h3 className="pr-10 text-xl font-extrabold text-ink">{title}</h3>
            <p className="mt-1 text-[14px] text-muted">ฝากชื่อกับเบอร์ไว้ ทีมงานจะโทรกลับไปยืนยันราคาและค่าส่งค่ะ</p>
            {summary && <div className="mt-4 rounded-xl border-[1.5px] border-ink/80 px-4 py-3 text-[14px] text-ink">{summary}</div>}
            {children && <div className="mt-4">{children}</div>}
            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[14px] font-semibold text-ink">ชื่อ</span>
                <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" placeholder="ชื่อที่ให้เราเรียก" className={input} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[14px] font-semibold text-ink">เบอร์โทร</span>
                <input value={phone} onChange={(e) => setPhone(fmtPhone(e.target.value))} type="tel" inputMode="numeric" autoComplete="tel" placeholder="08x-xxx-xxxx" className={input} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[14px] font-semibold text-ink">จังหวัดที่ส่ง <span className="font-normal text-muted">(ไม่ใส่ก็ได้)</span></span>
                <input value={province} onChange={(e) => setProvince(e.target.value)} maxLength={60} autoComplete="address-level1" placeholder="เช่น สุราษฎร์ธานี" className={input} />
              </label>
              <input value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px]" name="website" />
            </div>
            {err && <p role="alert" className="mt-3 rounded-lg bg-[#fdecec] px-3 py-2.5 text-[14px] text-brand">{err}</p>}
            <button type="submit" disabled={busy} className="mt-4 w-full rounded-xl bg-brand px-5 py-4 text-[16px] font-bold text-white shadow-[0_4px_0_#9e0b22] transition-colors hover:bg-brand-dark disabled:opacity-60">
              {busy ? "กำลังส่ง…" : submitLabel}
            </button>
            <p className="mt-2.5 text-center text-[12px] text-muted">เราใช้เบอร์นี้ติดต่อเรื่องคำสั่งซื้อนี้เท่านั้น</p>
          </form>
        )}
      </div>
    </div>
  );
}
