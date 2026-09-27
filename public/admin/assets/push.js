/* ============================================================
   KAN Admin — ปุ่ม "แจ้งเตือนบนเครื่องนี้" + แผงเลือกเรื่องที่อยากรับ (นนท์ 27 ก.ย. 69)
   โหลดจาก erp-menu.js จึงขึ้นทุกหน้า · ปุ่มอยู่ทั้งแถบบนเดสก์ท็อป (.erp-head-r) และแถบบนมือถือ (.erp-topbar)
   แผงเป็น position:fixed ยึดขอบจอเสมอ — กันปัญหาแบบ m-crm ที่กล่องล้นขอบซ้ายบนมือถือ
   ฝั่งเซิร์ฟเวอร์: worker-push.js (/api/t/push/*) · service worker: /sw.js
   ============================================================ */
(function () {
  "use strict";
  if (window.KAN_PUSH) return;
  var BASE = location.pathname.indexOf("/admin/") === 0 ? "/admin" : "";   /* dev เสิร์ฟใต้ /admin */
  var API = "/api/t/push";
  var SUPPORTED = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  var IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var STANDALONE = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;

  /* ---- ให้ "เพิ่มลงหน้าจอโฮม" ได้เป็นแอป (iPhone ต้องทำก่อนถึงจะรับแจ้งเตือนได้) ---- */
  function headTag(tag, attrs) {
    var sel = tag + Object.keys(attrs).filter(function (k) { return k === "rel" || k === "name"; })
      .map(function (k) { return "[" + k + '="' + attrs[k] + '"]'; }).join("");
    if (document.head.querySelector(sel)) return;
    var el = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    document.head.appendChild(el);
  }
  headTag("link", { rel: "manifest", href: BASE + "/manifest.webmanifest" });
  headTag("link", { rel: "apple-touch-icon", href: BASE + "/assets/icons/apple-touch-icon.png" });
  headTag("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
  headTag("meta", { name: "apple-mobile-web-app-title", content: "KAN Admin" });

  var regP = null;
  function swReg() {
    if (!SUPPORTED) return Promise.resolve(null);
    if (!regP) {
      regP = navigator.serviceWorker.register(BASE + "/sw.js", { scope: BASE + "/" })
        .then(function () { return navigator.serviceWorker.ready; })
        .catch(function (e) { regP = null; throw e; });
    }
    return regP;
  }

  function api(path, method, body) {
    return fetch(API + path, {
      method: method || "GET", credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || ("HTTP " + r.status)); e.status = r.status; throw e; }
        return d;
      });
    });
  }
  function keyBytes(b64) {
    var s = b64.replace(/-/g, "+").replace(/_/g, "/");
    s += "===".slice((s.length + 3) % 4);
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var S = { info: null, sub: null, busy: false, msg: "", err: "", loggedOut: false };

  function currentSub() {
    if (!SUPPORTED || Notification.permission !== "granted") return Promise.resolve(null);
    return swReg().then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; }).catch(function () { return null; });
  }
  function load() {
    return api("").then(function (d) {
      S.info = d;
      return currentSub();
    }).then(function (sub) {
      S.sub = sub;
      /* เครื่องนี้สมัครไว้แล้ว → ส่งซ้ำให้เซิร์ฟเวอร์ (เผื่อฝั่งนั้นลบไป หรือเปลี่ยนคนล็อกอิน) */
      if (sub) api("/subscribe", "POST", Object.assign(sub.toJSON(), { ua: navigator.userAgent })).catch(function () {});
      paint();
    }).catch(function (e) {
      if (e.status === 401) { S.loggedOut = true; paint(); }
    });
  }

  function enable() {
    S.busy = true; S.err = ""; S.msg = ""; draw();
    /* ขอสิทธิ์ต้องเกิดจากการกดปุ่มตรง ๆ (iOS บังคับ) — ห้ามมี await อื่นคั่นก่อนหน้านี้ */
    var permP = Notification.requestPermission();
    Promise.resolve(permP).then(function (perm) {
      if (perm !== "granted") throw new Error(perm === "denied" ? "เครื่องนี้บล็อกแจ้งเตือนไว้ — เปิดสิทธิ์ในตั้งค่าเบราว์เซอร์/ตั้งค่าเครื่องก่อน" : "ยังไม่ได้กดอนุญาต");
      return swReg();
    }).then(function (reg) {
      var opts = { userVisibleOnly: true, applicationServerKey: keyBytes(S.info.publicKey) };
      return reg.pushManager.subscribe(opts).catch(function () {
        /* เคยสมัครด้วยคีย์ชุดอื่น → ยกเลิกของเก่าแล้วสมัครใหม่ */
        return reg.pushManager.getSubscription().then(function (old) {
          return (old ? old.unsubscribe() : Promise.resolve()).then(function () { return reg.pushManager.subscribe(opts); });
        });
      });
    }).then(function (sub) {
      S.sub = sub;
      return api("/subscribe", "POST", Object.assign(sub.toJSON(), { ua: navigator.userAgent }));
    }).then(function () {
      S.msg = "เปิดแล้ว — กด “ส่งทดสอบ” เพื่อลองได้เลย";
      return api("").then(function (d) { S.info = d; });
    }).catch(function (e) { S.err = e.message || String(e); })
      .then(function () { S.busy = false; paint(); });
  }
  function disable() {
    S.busy = true; S.err = ""; S.msg = ""; draw();
    var sub = S.sub;
    Promise.resolve(sub ? api("/unsubscribe", "POST", { endpoint: sub.endpoint }) : null)
      .then(function () { return sub ? sub.unsubscribe() : null; })
      .then(function () { S.sub = null; S.msg = "ปิดแจ้งเตือนบนเครื่องนี้แล้ว"; return api("").then(function (d) { S.info = d; }); })
      .catch(function (e) { S.err = e.message || String(e); })
      .then(function () { S.busy = false; paint(); });
  }
  function test() {
    S.busy = true; S.err = ""; S.msg = ""; draw();
    api("/test", "POST", {}).then(function (d) {
      var r = String(d.result || "");
      if (r.indexOf("delivered") === 0) S.msg = "ส่งแล้ว — แจ้งเตือนควรเด้งภายในไม่กี่วินาที";
      else if (r === "no_device") S.err = "ยังไม่มีเครื่องไหนเปิดรับไว้";
      else S.err = "ส่งไม่ออก: " + (r || "ไม่ทราบสาเหตุ");
    }).catch(function (e) { S.err = e.message; })
      .then(function () { S.busy = false; draw(); });
  }
  function setPref(k, on) {
    (S.info.kinds || []).forEach(function (x) { if (x.k === k) x.on = on; });
    draw();
    api("/prefs", "PUT", { kind: k, on: on }).catch(function (e) {
      (S.info.kinds || []).forEach(function (x) { if (x.k === k) x.on = !on; });
      S.err = "บันทึกไม่สำเร็จ: " + e.message; draw();
    });
  }

  /* ---- ปุ่มบนแถบบน ---- */
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/><path d="M2.5 8.5v4M21.5 8.5v4"/></svg>';
  function mount() {
    if (S.loggedOut) return;
    var spots = [];
    document.querySelectorAll(".erp-head-r").forEach(function (h) { spots.push([h, "head"]); });
    document.querySelectorAll(".erp-topbar").forEach(function (t) { spots.push([t, "bar"]); });
    spots.forEach(function (s) {
      var host = s[0];
      if (host.querySelector(".kpush-btn")) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kpush-btn" + (s[1] === "bar" ? " in-bar" : "");
      b.setAttribute("aria-label", "ตั้งค่าแจ้งเตือนบนมือถือ/เครื่องนี้");
      b.title = "แจ้งเตือนบนเครื่องนี้";
      b.innerHTML = ICON + "<i></i>";
      if (s[1] === "head") host.insertBefore(b, host.firstChild);
      else {
        var r = host.querySelector(".erp-topbar-r");
        if (r) host.insertBefore(b, r); else host.appendChild(b);
      }
    });
    paintButtons();
  }
  function paintButtons() {
    document.querySelectorAll(".kpush-btn").forEach(function (b) {
      b.style.display = S.loggedOut ? "none" : "";
      b.classList.toggle("on", !!S.sub);
    });
  }

  /* ---- แผง ---- */
  var panel = null;
  function draw() {
    if (!panel) return;
    var i = S.info, h = '<div class="kpush-hd"><b>แจ้งเตือนบนเครื่องนี้</b><button type="button" class="kpush-x" data-kp="close" aria-label="ปิด">&times;</button></div>';
    if (!i) { panel.innerHTML = h + '<p class="kpush-note">กำลังโหลด…</p>'; return; }
    h += '<div class="kpush-sec">';
    if (!SUPPORTED && IOS && !STANDALONE) {
      h += '<p class="kpush-note"><b>iPhone / iPad ต้องเพิ่มลงหน้าจอโฮมก่อน</b><br>1. กดปุ่มแชร์ของ Safari (สี่เหลี่ยมมีลูกศรชี้ขึ้น)<br>' +
        "2. เลือก “เพิ่มไปยังหน้าจอโฮม”<br>3. เปิด KAN Admin จากไอคอนใหม่ แล้วกดปุ่มนี้อีกครั้ง</p>";
    } else if (!SUPPORTED) {
      h += '<p class="kpush-note">เบราว์เซอร์นี้รับแจ้งเตือนไม่ได้ — ใช้ Chrome, Edge หรือ Safari รุ่นใหม่</p>';
    } else if (Notification.permission === "denied") {
      h += '<p class="kpush-note warn">เครื่องนี้บล็อกแจ้งเตือนของ KAN Admin ไว้ — เปิดสิทธิ์แจ้งเตือนในตั้งค่าเบราว์เซอร์ (หรือตั้งค่าเครื่อง → การแจ้งเตือน) แล้วโหลดหน้าใหม่</p>';
    } else if (S.sub) {
      h += '<p class="kpush-status on"><i></i>เครื่องนี้รับแจ้งเตือนอยู่' + (i.devices > 1 ? " · คุณเปิดไว้ " + i.devices + " เครื่อง" : "") + "</p>" +
        '<div class="kpush-row"><button type="button" class="kpush-b pri" data-kp="test"' + (S.busy ? " disabled" : "") + ">ส่งทดสอบ</button>" +
        '<button type="button" class="kpush-b" data-kp="off"' + (S.busy ? " disabled" : "") + ">ปิดบนเครื่องนี้</button></div>";
    } else {
      h += '<p class="kpush-status"><i></i>เครื่องนี้ยังไม่ได้เปิดรับ' + (i.devices ? " · เปิดไว้แล้วบนเครื่องอื่น " + i.devices + " เครื่อง" : "") + "</p>" +
        '<div class="kpush-row"><button type="button" class="kpush-b pri wide" data-kp="on"' + (S.busy ? " disabled" : "") + ">" +
        (S.busy ? "กำลังเปิด…" : "เปิดแจ้งเตือนบนเครื่องนี้") + "</button></div>";
    }
    if (S.msg) h += '<p class="kpush-msg">' + esc(S.msg) + "</p>";
    if (S.err) h += '<p class="kpush-msg err">' + esc(S.err) + "</p>";
    h += "</div>";
    h += '<div class="kpush-sec"><div class="kpush-sub">เลือกเรื่องที่อยากรับ <small>ใช้กับทุกเครื่องของคุณ</small></div>' +
      (i.kinds || []).map(function (x) {
        return '<label class="kpush-opt"><span><b>' + esc(x.th) + "</b><small>" + esc(x.desc) + "</small></span>" +
          '<input type="checkbox" role="switch" data-kpref="' + x.k + '"' + (x.on ? " checked" : "") + "></label>";
      }).join("") + "</div>";
    h += '<a class="kpush-all" href="' + BASE + '/tasks/#/inbox">ดูแจ้งเตือนทั้งหมดในระบบ →</a>';
    panel.innerHTML = h;
  }
  function paint() { paintButtons(); draw(); }

  function place(btn) {
    if (!panel) return;
    if (window.innerWidth <= 640) { panel.style.left = ""; panel.style.right = ""; panel.style.top = ""; return; }   /* CSS ยึดขอบจอ */
    var r = btn.getBoundingClientRect(), w = panel.offsetWidth || 360;
    var left = Math.min(Math.max(12, r.right - w), window.innerWidth - w - 12);
    panel.style.left = Math.max(12, left) + "px";
    panel.style.right = "auto";
    panel.style.top = Math.round(r.bottom + 8) + "px";
  }
  function open(btn) {
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "kpush-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "ตั้งค่าแจ้งเตือน");
      document.body.appendChild(panel);
    }
    S.msg = ""; S.err = "";
    panel.hidden = false;
    draw();
    place(btn);
    load().then(function () { place(btn); });
  }
  function close() { if (panel) panel.hidden = true; }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".kpush-btn");
    if (b) { e.preventDefault(); if (panel && !panel.hidden) close(); else open(b); return; }
    if (!panel || panel.hidden) return;
    var a = e.target.closest("[data-kp]");
    if (a) {
      var k = a.getAttribute("data-kp");
      if (k === "close") close(); else if (k === "on") enable(); else if (k === "off") disable(); else if (k === "test") test();
      return;
    }
    if (!e.target.closest(".kpush-panel")) close();
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-kpref")) setPref(t.getAttribute("data-kpref"), t.checked);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  window.addEventListener("resize", function () { var b = document.querySelector(".kpush-btn"); if (panel && !panel.hidden && b) place(b); });

  /* ---- สไตล์ (ใช้โทเคนสีของ erp-shell.css มีค่าสำรองเผื่อหน้าไม่ได้โหลด) ---- */
  var css = document.createElement("style");
  css.textContent =
    ".kpush-btn{position:relative;display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:999px;background:transparent;" +
    "color:var(--k-soft,#575652);cursor:pointer;padding:0;flex:none}" +
    ".kpush-btn:hover{background:var(--k-hair,#EFEEE9);color:var(--k-ink,#0B0B0A)}" +
    ".kpush-btn svg{width:18px;height:18px;display:block}" +
    ".kpush-btn i{position:absolute;top:5px;right:5px;width:8px;height:8px;border-radius:50%;background:var(--k-mut,#8B8A84);" +
    "box-shadow:0 0 0 2px var(--k-paper,#fff);display:none}" +
    ".kpush-btn.on i{display:block;background:var(--k-ok,#1FA968)}" +
    ".kpush-btn.in-bar{margin-left:auto}.erp-topbar .kpush-btn.in-bar + .erp-topbar-r{margin-left:6px}" +
    ".kpush-panel{position:fixed;z-index:200;width:360px;max-width:calc(100vw - 24px);max-height:calc(100vh - 90px);overflow:auto;" +
    "background:var(--k-paper,#fff);color:var(--k-ink,#0B0B0A);border:1px solid var(--k-line,#E5E4DF);border-radius:14px;" +
    "box-shadow:0 18px 44px rgba(0,0,0,.18);font-size:13.5px;line-height:1.5;-webkit-overflow-scrolling:touch}" +
    ".kpush-panel[hidden]{display:none}" +
    "@media (max-width:640px){.kpush-panel{left:12px!important;right:12px!important;top:62px!important;width:auto;max-width:none;" +
    "max-height:calc(100dvh - 80px)}}" +
    ".kpush-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;border-bottom:1px solid var(--k-line,#E5E4DF);" +
    "position:sticky;top:0;background:inherit}" +
    ".kpush-hd b{font-size:15px}.kpush-x{border:0;background:none;font-size:22px;line-height:1;color:var(--k-mut,#8B8A84);cursor:pointer;padding:2px 6px}" +
    ".kpush-sec{padding:12px 14px;border-bottom:1px solid var(--k-line,#E5E4DF)}" +
    ".kpush-note{margin:0;color:var(--k-soft,#575652)}.kpush-note.warn{color:var(--k-warn,#C97A00)}" +
    ".kpush-status{margin:0 0 10px;display:flex;align-items:center;gap:8px;font-weight:600}" +
    ".kpush-status i{width:8px;height:8px;border-radius:50%;background:var(--k-mut,#8B8A84)}.kpush-status.on i{background:var(--k-ok,#1FA968)}" +
    ".kpush-row{display:flex;gap:8px;flex-wrap:wrap}" +
    ".kpush-b{font:inherit;font-size:13px;padding:8px 13px;border-radius:8px;border:1px solid var(--k-line,#E5E4DF);background:transparent;" +
    "color:var(--k-ink,#0B0B0A);cursor:pointer}.kpush-b.pri{background:var(--k-ink,#0B0B0A);color:var(--k-paper,#fff);border-color:var(--k-ink,#0B0B0A);font-weight:600}" +
    ".kpush-b.wide{flex:1}.kpush-b:disabled{opacity:.55;cursor:default}" +
    ".kpush-msg{margin:10px 0 0;font-size:12.5px;color:var(--k-ok,#1FA968)}.kpush-msg.err{color:var(--k-bad,#DC3232)}" +
    ".kpush-sub{font-weight:600;margin-bottom:6px}.kpush-sub small{font-weight:400;color:var(--k-mut,#8B8A84);margin-left:6px}" +
    ".kpush-opt{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;cursor:pointer;border-top:1px solid var(--k-hair,#EFEEE9)}" +
    ".kpush-opt:first-of-type{border-top:0}.kpush-opt span{display:flex;flex-direction:column;min-width:0}" +
    ".kpush-opt small{color:var(--k-mut,#8B8A84);font-size:12px}" +
    ".kpush-opt input{appearance:none;-webkit-appearance:none;flex:none;width:38px;height:22px;border-radius:999px;background:var(--k-line,#E5E4DF);" +
    "position:relative;cursor:pointer;transition:background .15s;margin:0}" +
    ".kpush-opt input::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;" +
    "box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}" +
    ".kpush-opt input:checked{background:var(--k-ok,#1FA968)}.kpush-opt input:checked::after{transform:translateX(16px)}" +
    ".kpush-all{display:block;padding:11px 14px;font-size:13px;font-weight:600;color:var(--k-ink,#0B0B0A);text-decoration:none}";
  document.head.appendChild(css);

  /* แถบบนของหน้า CMO/ยอดขาย ถูกสร้างทีหลังโดย nav.js → เฝ้าดูแล้วติดปุ่มตามไป */
  function boot() {
    mount();
    new MutationObserver(function () { mount(); }).observe(document.body, { childList: true, subtree: false });
    load();
    if (SUPPORTED && Notification.permission === "granted") swReg().catch(function () {});
  }
  /* หน้างานทีมล็อกอินในหน้าเดียวกัน (SPA) — ล็อกอินเสร็จแล้วให้ปุ่มโผล่โดยไม่ต้องรีโหลด */
  window.addEventListener("hashchange", function () { if (S.loggedOut) { S.loggedOut = false; load().then(mount); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.KAN_PUSH = { open: function () { var b = document.querySelector(".kpush-btn"); if (b) open(b); } };
})();
