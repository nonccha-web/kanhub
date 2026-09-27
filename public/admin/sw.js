/*
  KAN Admin service worker — แจ้งเตือนเด้งอย่างเดียว (พอร์ตจาก m-crm)
  ตั้งใจไม่มี fetch handler และไม่ cache อะไรเลย: หน้าหลังบ้านเป็นข้อมูลสด
  หน้าเก่าที่ดูเหมือนปัจจุบันแต่ไม่ใช่ อันตรายกว่าหน้าที่ต้องรอเน็ต
*/
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/* dev (wrangler) เสิร์ฟหน้าใต้ /admin/ · โปรดักชันไม่มี prefix — ดูจากที่อยู่ของ sw เอง */
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: "KAN Admin", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "KAN Admin", {
    body: data.body || "",
    icon: BASE + "/assets/icons/icon-192.png",
    badge: BASE + "/assets/icons/badge-96.png",
    tag: data.tag,
    data: { url: data.url || "/tasks/#/inbox" },
  }));
});

/* กดแจ้งเตือน → เปิดหน้างาน/ลีดนั้น ใช้หน้าต่างที่เปิดอยู่ก่อนถ้ามี */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/tasks/#/inbox";
  const target = new URL(BASE + path, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    for (const c of wins) {
      if (new URL(c.url).origin === self.location.origin && "focus" in c) {
        return c.navigate(target).then((x) => (x || c).focus()).catch(() => self.clients.openWindow(target));
      }
    }
    return self.clients.openWindow(target);
  }));
});
