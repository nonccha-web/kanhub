"use client";

import { useEffect, useRef, useState } from "react";

/* ดูเพิ่มเติม / ย่อลง — เนื้อหาอยู่ใน HTML ครบตั้งแต่แรก (Google อ่านได้) แค่ซ่อนส่วนเกินด้วยความสูง
   ถ้าเนื้อหาไม่ยาวเกิน ปุ่มจะไม่โผล่ */
export function SeeMore({
  children,
  height = 320,
  more = "ดูเพิ่มเติม",
  less = "ย่อลง",
  fade = "from-cream",
}: {
  children: React.ReactNode;
  height?: number;
  more?: string;
  less?: string;
  fade?: string;   // สีพื้นหลังที่ไล่จาง ให้ตรงกับ section
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(true);   // ตอน SSR ถือว่ายาวไว้ก่อน กันเนื้อหากระโดด

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setLong(el.scrollHeight > height + 40);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const clipped = long && !open;
  return (
    <div>
      <div className="relative">
        <div ref={ref} style={clipped ? { maxHeight: height, overflow: "hidden" } : undefined}>
          {children}
        </div>
        {clipped && <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t ${fade} to-transparent`} />}
      </div>
      {long && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => {
              if (open && ref.current) ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
              setOpen((v) => !v);
            }}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink px-5 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:bg-ink hover:text-white"
          >
            {open ? less : more} <span aria-hidden>{open ? "▲" : "▼"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
