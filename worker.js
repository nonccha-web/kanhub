// KAN — routing ตาม hostname
//  admin.kan-hub.com      → เสิร์ฟเนื้อหาใน /admin (หลังบ้าน ERP)
//  kan-hub.com / www      → เว็บการตลาด (ซ่อน /admin ไม่ให้เข้าตรง)
//  *.workers.dev          → เข้าได้ทั้งคู่ (ไว้เทสต์)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname;

    // --- หลังบ้าน: admin subdomain → map root ไป /admin/* ---
    if (host.startsWith("admin.")) {
      if (!url.pathname.startsWith("/admin")) {
        url.pathname = url.pathname === "/" ? "/admin/" : "/admin" + url.pathname;
      }
      return env.ASSETS.fetch(new Request(url, request));
    }

    // --- โดเมนหลักสาธารณะ: ซ่อน /admin (กันเข้าตรง) ---
    if (host === "kan-hub.com" || host === "www.kan-hub.com") {
      if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
        return new Response("Not found", { status: 404 });
      }
    }

    // ที่เหลือ (รวม workers.dev) เสิร์ฟตามปกติ
    return env.ASSETS.fetch(request);
  },
};
