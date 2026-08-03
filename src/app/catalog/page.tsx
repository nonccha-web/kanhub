import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { CtaBand } from "@/components/CtaBand";
import data from "@/lib/kan-prices.json";

export const metadata = {
  title: "แคตตาล็อก & ราคา",
  description:
    "แคตตาล็อกกระสอบเสื้อผ้ามือสองญี่ปุ่น KAN HUB — ราคาส่งยกก้อน/ยกถุง Tier A–D และราคาปลีกต่อตัวแบบขั้นบันได เสื้อผ้า เซรามิก ผ้าอื่นๆ ครบทุกหมวด",
  alternates: { canonical: "/catalog" },
};

type Product = {
  tier: string; name: string; unit: string;
  weight_kg: number | null; qty: number | null;
  price_orig: number | null; price_final: number | null;
};
type Retail = {
  sku: string; zone: string; cat: string; item: string; unit: string;
  tiers: { q1_2: number; q3_5: number; q6_11: number; q12_99: number; q100: number } | null;
};

const products = (data.products as Product[]).filter((p) => ["A", "B", "C", "D"].includes(p.tier));
const retail = data.retail as Retail[];

const TIER_META: Record<string, { accent: string; onGold: boolean; label: string }> = {
  A: { accent: "#c8102e", onGold: false, label: "ก้อนผ้า — ยกก้อน 300–350 กก." },
  B: { accent: "#e0a93b", onGold: true, label: "โค้ท & ไหมพรม — ยกถุง" },
  C: { accent: "#0e7c66", onGold: false, label: "ผ้าเหมา & คัดแยก — ถุง/ลัง" },
  D: { accent: "#6b6360", onGold: false, label: "เบ็ดเตล็ด & งานพิเศษ" },
};

const baht = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("en-US")}฿`);

// จัดกลุ่ม retail ตามโซน (คงลำดับที่เจอครั้งแรก)
const zones: string[] = [];
const byZone: Record<string, Retail[]> = {};
for (const r of retail) {
  if (!byZone[r.zone]) { byZone[r.zone] = []; zones.push(r.zone); }
  byZone[r.zone].push(r);
}

export default function CatalogPage() {
  return (
    <>
      <PageHero
        eyebrow="แคตตาล็อก & ราคา"
        title="กระสอบเสื้อผ้ามือสองญี่ปุ่น — ราคาส่งเคาะจริง"
        subtitle="ขายส่งยกก้อน/ยกถุง Tier A–D และราคาปลีกต่อตัวแบบขั้นบันได ยิ่งรับเยอะยิ่งถูก"
      />

      {/* ---- ขายส่งยกกระสอบ (Tier A–D) ---- */}
      <section className="bg-cream py-16">
        <Container>
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">ขายส่งยกกระสอบ (Tier A–D)</h2>
          <div className="mt-8 space-y-10">
            {["A", "B", "C", "D"].map((t) => {
              const items = products.filter((p) => p.tier === t);
              if (!items.length) return null;
              const m = TIER_META[t];
              return (
                <div key={t}>
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-10 w-10 place-items-center rounded-xl text-base font-extrabold"
                      style={{ background: m.accent, color: m.onGold ? "#1a1413" : "#fff" }}
                    >
                      {t}
                    </span>
                    <h3 className="text-lg font-bold text-ink">Tier {t} · {m.label}</h3>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((p) => (
                      <div key={p.name} className="rounded-2xl border border-hair bg-white p-5">
                        <h4 className="text-[15px] font-semibold text-ink">{p.name}</h4>
                        <p className="mt-0.5 text-[12px] text-muted">
                          ยกเป็น{p.unit}
                          {p.qty != null ? ` · เหลือ ${p.qty} ${p.unit}` : ""}
                        </p>
                        <div className="mt-2 text-xl font-extrabold text-brand">
                          {baht(p.price_final)} <span className="text-[12px] font-medium text-muted">/ {p.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ---- ราคาปลีก ต่อตัว (ขั้นบันได) ---- */}
      <section className="bg-cream-100 py-16">
        <Container>
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">ราคาปลีก — ต่อตัว (ยิ่งรับเยอะยิ่งถูก)</h2>
          <p className="mt-2 text-[15px] text-muted">ราคาบาท/ตัว ตามจำนวนที่รับ — งานบางหมวดคิดตามกิโล/เปอร์เซ็นต์ (ระบุในช่องราคา)</p>

          <div className="mt-8 space-y-10">
            {zones.map((zone) => (
              <div key={zone}>
                <h3 className="text-lg font-bold text-ink">{zone.replace(/^ขายส่ง:\s*/, "")}</h3>
                <div className="mt-3 overflow-x-auto rounded-2xl border border-hair bg-white">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-hair bg-cream-100 text-[13px] text-muted">
                        <th className="px-4 py-3 font-semibold">รายการ</th>
                        <th className="px-3 py-3 text-right font-semibold">1–2 ตัว</th>
                        <th className="px-3 py-3 text-right font-semibold">3–5</th>
                        <th className="px-3 py-3 text-right font-semibold">6–11</th>
                        <th className="px-3 py-3 text-right font-semibold">12–99</th>
                        <th className="px-3 py-3 text-right font-semibold">&gt;100</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byZone[zone].map((r, i) => (
                        <tr key={`${r.item}-${i}`} className="border-b border-hair/60 last:border-0">
                          <td className="px-4 py-2.5 text-ink">
                            {r.item}
                            <span className="ml-2 text-[11px] text-muted">{r.cat}</span>
                          </td>
                          {r.tiers ? (
                            <>
                              <td className="px-3 py-2.5 text-right tabular-nums text-ink/80">{r.tiers.q1_2}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-ink/80">{r.tiers.q3_5}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-ink/80">{r.tiers.q6_11}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-ink/80">{r.tiers.q12_99}</td>
                              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-brand">{r.tiers.q100}</td>
                            </>
                          ) : (
                            <td colSpan={5} className="px-3 py-2.5 text-right text-[13px] text-muted">
                              {r.unit || "สอบถามราคา"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand
        title="สนใจรายการไหน ทักไลน์ขอราคาส่งได้เลย"
        subtitle="แจ้งหมวด/จำนวนที่ต้องการ ทีมงานเคาะราคาส่ง + ค่าจัดส่งให้ทันที"
      />
    </>
  );
}
