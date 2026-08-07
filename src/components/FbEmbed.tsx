"use client";

import { useState } from "react";

/** ฝัง Facebook แบบ "โหลดตอนคลิก" (facade) — กัน FB iframe บล็อกการโหลดรูป/หน้าเว็บ
    แสดง poster ก่อน กดแล้วค่อยโหลด iframe จริง */
export function FbEmbed({
  src,
  title,
  poster,
}: {
  src: string;
  title: string;
  poster: React.ReactNode;
}) {
  const [on, setOn] = useState(false);

  if (on) {
    return (
      <iframe
        src={src}
        title={title}
        className="block h-full w-full"
        style={{ border: "none", overflow: "hidden" }}
        scrolling="no"
        allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOn(true)}
      aria-label={title}
      className="group block h-full w-full cursor-pointer"
    >
      {poster}
    </button>
  );
}
