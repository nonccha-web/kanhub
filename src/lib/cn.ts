/** รวม className แบบง่าย (กรองค่า falsy ออก) */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
