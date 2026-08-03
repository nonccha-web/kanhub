import Image from "next/image";
import { cn } from "@/lib/cn";

/** ไอคอน LINE (โลโก้จริง) */
export function LineIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/img/line-logo.png"
      alt=""
      width={24}
      height={24}
      aria-hidden
      className={cn("h-5 w-5 shrink-0", className)}
    />
  );
}

/** ไอคอน Facebook (โลโก้จริง) */
export function FbIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/img/fb-logo.png"
      alt=""
      width={24}
      height={24}
      aria-hidden
      className={cn("h-5 w-5 shrink-0", className)}
    />
  );
}
