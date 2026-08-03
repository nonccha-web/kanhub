import { cn } from "@/lib/cn";

/** กล่องจัดความกว้างสูงสุด + ระยะขอบซ้ายขวา (ใช้ทุก section) */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1120px] px-5 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
