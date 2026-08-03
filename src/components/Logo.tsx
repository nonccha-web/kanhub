import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";

/** โลโก้ KAN HUB (โลโก้จริง จากแบรนด์) */
export function Logo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="KAN HUB หน้าแรก"
      className={cn("inline-flex items-center", className)}
    >
      <Image
        src="/img/logo-kanhub.png"
        alt="KAN HUB"
        width={885}
        height={418}
        priority={priority}
        className="h-8 w-auto sm:h-9"
      />
    </Link>
  );
}
