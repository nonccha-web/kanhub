import type { MetadataRoute } from "next";
import { SITE, NAV } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  // หน้าแรกสำคัญสุด + หน้าอื่นๆ ตามเมนู (จะเปิดใช้เมื่อทำหน้าเสร็จ)
  const routes = Array.from(new Set(["/", ...NAV.map((n) => n.href)]));
  return routes.map((path) => ({
    url: `${SITE.url}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
