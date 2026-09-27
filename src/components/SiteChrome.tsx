import { Header } from "./Header";
import { Footer } from "./Footer";
import { ContactWidget } from "./ContactWidget";
import { PromoBar } from "./PromoBar";

/** โครงหลักของทุกหน้า: Header + เนื้อหา + Footer + ปุ่มลอย */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PromoBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ContactWidget />
    </>
  );
}
