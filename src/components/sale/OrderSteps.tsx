import { SITE } from "@/lib/site";

/* ขั้นตอนสั่งซื้อ 3 ขั้น — ใช้ร่วมทุกหน้าขาย (ตรงกับ /how-to-order) */
export function OrderSteps() {
  const steps = [
    { t: "เลือกของ + จำนวน", d: "คิดราคาเองในเว็บ หรือกดสอบถาม/จอง ฝากชื่อกับเบอร์ไว้" },
    { t: "ทีมงานยืนยันราคา + ค่าส่ง", d: "ส่งรูป/คลิปของจริงให้ดูก่อน แจ้งยอดรวมก่อนโอนทุกครั้ง" },
    { t: "โอนบัญชีบริษัท แล้วจัดส่ง", d: "ส่งทั่วไทยพร้อมเลขพัสดุ หรือนัดมารับเองที่โกดังภาคใต้" },
  ];
  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold text-ink">สั่งซื้อยังไง</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.t} className="rounded-2xl border border-hair bg-white p-5">
            <div className="text-[13px] font-bold text-brand">ขั้นที่ {i + 1}</div>
            <div className="mt-1 text-[16px] font-bold text-ink">{s.t}</div>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">{s.d}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-muted">
        สอบถามเพิ่มทาง LINE {SITE.lineId} หรือโทร {SITE.phone} · <a href="/how-to-order/" className="font-semibold text-brand underline-offset-2 hover:underline">อ่านวิธีสั่งซื้อแบบละเอียด</a>
      </p>
    </div>
  );
}
