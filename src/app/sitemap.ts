import type { MetadataRoute } from "next";
import { SITE, NAV } from "@/lib/site";
import { CATEGORIES } from "@/lib/categories";
import { ARTICLES } from "@/lib/blog-data";

export const dynamic = "force-static";

/* ทุกหน้าที่อยากให้ Google เก็บ — หน้าเพิ่มใหม่ต้องมาเติมที่นี่ (หน้า static ใน public/ ไม่ถูกเก็บอัตโนมัติ) */
export default function sitemap(): MetadataRoute.Sitemap {
  const sale = ["/catalog/bale", "/catalog/sack-45", "/catalog/pha-hang", "/grade-b/", "/winter/"];
  const routes = Array.from(new Set([
    "/",
    ...NAV.map((n) => n.href),
    ...sale,
    ...CATEGORIES.map((c) => `/catalog/${c.slug}`),
    ...ARTICLES.map((a) => `/blog/${a.slug}`),
  ]));
  return routes.map((path) => ({
    url: `${SITE.url}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || sale.includes(path) ? "weekly" : "monthly",
    priority: path === "/" ? 1 : sale.includes(path) || path.startsWith("/catalog") ? 0.8 : 0.6,
  }));
}
