"use client";

import { useEffect, useState } from "react";

const UNITS: { key: keyof Parts; label: string }[] = [
  { key: "days", label: "วัน" },
  { key: "hours", label: "ชม." },
  { key: "mins", label: "นาที" },
  { key: "secs", label: "วิ." },
];

type Parts = { days: number; hours: number; mins: number; secs: number };

function partsFrom(ms: number): Parts {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  };
}

const pad = (n: number) => n.toString().padStart(2, "0");

/** นับถอยหลังโปร — ตั้งเป้าหมาย ~2 วัน 8 ชม. นับจากตอนโหลดหน้า (คำนวณฝั่ง client) */
export function Countdown() {
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    const target = Date.now() + ((2 * 24 + 8) * 3600 + 43 * 60 + 55) * 1000;
    const tick = () => setParts(partsFrom(target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const shown = parts ?? { days: 2, hours: 8, mins: 43, secs: 55 };

  return (
    <div className="flex items-center gap-2.5">
      {UNITS.map((u) => (
        <div key={u.key} className="text-center">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-dark/85 text-2xl font-bold tabular-nums text-white">
            {pad(shown[u.key])}
          </div>
          <div className="mt-1.5 text-xs font-medium text-dark/70">{u.label}</div>
        </div>
      ))}
    </div>
  );
}
