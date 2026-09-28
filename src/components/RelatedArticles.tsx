import Image from "next/image";
import Link from "next/link";
import { articlesFor } from "@/lib/blog-data";

/* บทความที่เกี่ยวข้องกับหน้าขาย — ลิงก์ภายในจากหน้าสินค้าไปบทความ (ขาไปของ internal link) */
export function RelatedArticles({ tag, title = "อ่านก่อนตัดสินใจ" }: { tag: string; title?: string }) {
  const list = articlesFor(tag, 4);
  if (!list.length) return null;
  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((a) => (
          <Link key={a.slug} href={`/blog/${a.slug}`} className="group overflow-hidden rounded-2xl border border-hair bg-white hover:shadow-md">
            <div className="relative aspect-[16/9] bg-cream-100">
              <Image src={a.cover} alt={a.coverAlt} fill loading="lazy" sizes="(max-width:640px) 100vw, 260px" className="object-cover" />
            </div>
            <div className="p-4">
              <h3 className="text-[15px] font-semibold leading-snug text-ink group-hover:text-brand">{a.title}</h3>
              <p className="mt-1 text-[13px] text-muted">อ่าน {a.readMin} นาที</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
