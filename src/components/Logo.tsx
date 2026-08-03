import Link from "next/link";
import { cn } from "@/lib/cn";

/** โลโก้ KAN HUB — ไอคอนถุงช้อปสีแดง + ตัวอักษร */
export function Logo({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-[10px] bg-brand text-white shadow-sm"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 8h12l-.9 11.1a2 2 0 0 1-2 1.9H8.9a2 2 0 0 1-2-1.9L6 8Z"
            fill="currentColor"
            opacity="0.95"
          />
          <path
            d="M9 8V6.5a3 3 0 0 1 6 0V8"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </span>
      <span
        className={cn(
          "text-[19px] font-extrabold tracking-tight leading-none",
          onDark ? "text-white" : "text-ink"
        )}
      >
        KAN<span className="text-brand"> HUB</span>
      </span>
    </Link>
  );
}
