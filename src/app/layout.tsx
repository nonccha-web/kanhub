import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";
import { SiteChrome } from "@/components/SiteChrome";

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.tagline} | ${SITE.name}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "กระสอบเสื้อผ้ามือสอง",
    "เสื้อผ้ามือสองญี่ปุ่น",
    "ขายส่งเสื้อผ้ามือสอง",
    "ก้อนผ้าญี่ปุ่น",
    "เสื้อผ้ามือสองยกกระสอบ",
    "โกดังเสื้อผ้ามือสองภาคใต้",
    "นำเข้าเสื้อผ้ามือสอง",
    "KAN HUB",
  ],
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: SITE.name,
    title: `${SITE.tagline} | ${SITE.name}`,
    description: SITE.description,
    url: SITE.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.tagline} | ${SITE.name}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#c8102e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${prompt.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
