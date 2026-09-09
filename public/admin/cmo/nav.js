/* ============================================================
   KAN — ERP unified navigation (CMO side)
   ทำ sidebar เข้ม ๆ แบบเดียวกับระบบยอดขาย+สต็อก (KAN ERP)
   เพื่อให้ทั้งสองระบบดูเป็น ERP เดียวกัน
   แก้เมนู/ลำดับที่ PAGES + ERP_SALES ที่เดียว มีผลทุกหน้า
   ============================================================ */
(function (global) {
  // path เทียบจากโฟลเดอร์ CMO ไปยังระบบยอดขาย+สต็อก (คนละโฟลเดอร์)
  var ERP_BASE = "../mkt/index.html";
  // เมนู/ลำดับทั้งหมดอยู่ที่ erp-menu.js (แหล่งเดียว ใช้ร่วมกับฝั่งยอดขาย+สต็อก)

  // ── ธีม (คงพฤติกรรมเดิม) ────────────────────────────────────────────────
  var saved = null;
  try { saved = localStorage.getItem("kan-theme"); } catch (e) {}
  if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");
  /* สถานะย่อเมนู (แถบ 64px) — ใช้ค่าเดียวกันทุกหน้า */
  try { if (localStorage.getItem("kan-erp-collapsed") === "1") document.documentElement.classList.add("erp-collapsed"); } catch (e) {}

  function setTheme(next) {
    var h = document.documentElement;
    if (next === "dark") h.setAttribute("data-theme", "dark");
    else h.removeAttribute("data-theme");
    try { localStorage.setItem("kan-theme", next); } catch (e) {}
    syncToggle();
  }
  window.toggleTheme = function () {
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  };
  function syncToggle() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var icon = document.getElementById("theme-icon");
    var label = document.getElementById("theme-label");
    if (icon) icon.textContent = dark ? "☀️" : "🌙";
    if (label) label.textContent = dark ? "โหมดสว่าง" : "โหมดมืด";
    document.querySelectorAll("[data-theme-pick]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-theme-pick") === (dark ? "dark" : "light") ? "true" : "false");
    });
  }

  function currentFile() {
    var p = location.pathname.split("/").pop();
    p = p && p.length ? decodeURIComponent(p) : "index.html";
    /* โฮสต์จริงตัด .html ทิ้ง (/cmo/kpi) แต่เมนูจดชื่อไฟล์เต็ม — เติมกลับให้ตรงกัน ไม่งั้นไม่ไฮไลต์หน้าปัจจุบัน */
    if (!/\.html$/.test(p)) p += ".html";
    return p;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function initials(name) {
    var p = String(name || "").replace(/[()[\]{}"'.,]/g, " ").trim().split(/\s+/).filter(Boolean);
    return ((p[0] || "").charAt(0) + (p[1] || "").charAt(0)).toUpperCase() || "?";
  }

  // ── สร้าง sidebar จากเมนูรวม (erp-menu.js) ──────────────────────────────
  /* me = ผู้ใช้ที่ล็อกอินอยู่ (จาก /api/t/me) — เมนูโชว์เฉพาะหมวดที่มีสิทธิ์ */
  function buildSidebar(here, me) {
    var menuHTML = global.ERP_MENU
      ? global.ERP_MENU.render({ ctx: "cmo", active: "cmo:" + here,
          salesBase: ERP_BASE, cmoBase: "", tasksBase: "../tasks/",
          sections: me ? me.sections : [], owner: !!me && me.role === "owner" })
      : "";
    var h = menuHTML +
      '<div class="erp-foot">' +
        '<button class="erp-theme" onclick="toggleTheme()"><span id="theme-icon">🌙</span> ' +
        '<span id="theme-label">โหมดมืด</span></button>' +
        (global.ERP_MENU ? global.ERP_MENU.powered : '') + '</div>';

    var aside = document.createElement("aside");
    aside.className = "erp-sidebar";
    aside.innerHTML = h;
    document.body.insertBefore(aside, document.body.firstChild);
    document.documentElement.classList.add("has-erp-side");
    if (global.ERP_MENU) { global.ERP_MENU.wire(aside); }

    /* แถบบนแบบ M CRM: ชื่อระบบ + ชื่อหน้า + สลับธีม (เดสก์ท็อป — มือถือใช้ .erp-topbar) */
    var head = document.createElement("header");
    head.className = "erp-head";
    var pageName = (document.title || "").replace(/\s*[—–-]\s*KAN.*$/, "").trim() || "ระบบหลังบ้าน";
    head.innerHTML =
      '<div class="erp-head-t"><b>KAN Admin</b><small>' + esc(pageName) + ' · Internal operations</small></div>' +
      '<div class="erp-head-r">' +
      (me ? '<span class="erp-user"><i>' + esc(initials(me.name)) + '</i><b>' + esc(me.name) + '</b>' +
            '<button type="button" data-logout title="ออกจากระบบ">ออก</button></span>' : '') +
      '<div class="erp-seg" aria-label="ธีมของระบบ">' +
        '<button type="button" data-theme-pick="light" title="โหมดสว่าง" aria-label="โหมดสว่าง">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>' +
        '<button type="button" data-theme-pick="dark" title="โหมดมืด" aria-label="โหมดมืด">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button></div></div>';
    document.body.insertBefore(head, aside.nextSibling);

    /* มือถือ: เมนูเป็นลิ้นชัก ต้องมีปุ่มเปิดและฉากหลังกดปิด */
    var bar = document.createElement("div");
    bar.className = "erp-topbar";
    bar.innerHTML =
      '<button type="button" aria-label="เปิดเมนู" data-erp-toggle>' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>' +
      '<img src="../assets/kan-logo.png" alt=""><b>KAN Admin</b>';
    document.body.insertBefore(bar, document.body.firstChild);

    var scrim = document.createElement("div");
    scrim.className = "erp-scrim";
    scrim.setAttribute("data-erp-close", "1");
    document.body.insertBefore(scrim, document.body.firstChild);

    document.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-logout]")) {
        fetch("/api/t/logout", { method: "POST", credentials: "same-origin" })
          .then(function () { location.href = "/tasks/"; })
          .catch(function () { location.href = "/tasks/"; });
        return;
      }
      var pick = ev.target.closest("[data-theme-pick]");
      if (pick) { setTheme(pick.getAttribute("data-theme-pick")); return; }
      if (ev.target.closest("[data-erp-toggle]")) {
        document.documentElement.classList.toggle("erp-open");
      } else if (ev.target.closest("[data-erp-close]")) {
        document.documentElement.classList.remove("erp-open");
      } else if (document.documentElement.classList.contains("erp-open") &&
                 ev.target.closest(".erp-sidebar a")) {
        document.documentElement.classList.remove("erp-open");   /* เลือกเมนูแล้วปิดเอง */
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") document.documentElement.classList.remove("erp-open");
    });
  }

  // pager (ก่อนหน้า/ถัดไป) ไล่ตามลำดับหน้า CMO ในเมนูรวม
  function buildPager(here) {
    var pager = document.querySelector(".pager");
    if (!pager || !global.ERP_MENU) { if (pager) pager.style.display = "none"; return; }
    var files = global.ERP_MENU.cmoFiles;
    var idx = -1;
    for (var i = 0; i < files.length; i++) if (files[i].file === here) { idx = i; break; }
    if (idx === -1) { pager.style.display = "none"; return; }
    var prev = idx > 0 ? files[idx - 1] : null;
    var next = idx < files.length - 1 ? files[idx + 1] : null;
    var html = "";
    if (prev) html += '<a class="prev" href="' + prev.file + '"><div class="dir">← ก่อนหน้า</div><div class="pg-label">' + esc(prev.label) + "</div></a>";
    if (next) html += '<a class="next" href="' + next.file + '"><div class="dir">ถัดไป →</div><div class="pg-label">' + esc(next.label) + "</div></a>";
    pager.innerHTML = html;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var here = currentFile();
    /* รอรู้ก่อนว่าใครเข้ามา แล้วค่อยวาดเมนู — จะได้ไม่โชว์เมนูที่กดแล้วเจอ "ไม่มีสิทธิ์"
       (ตัวจริงกันที่เซิร์ฟเวอร์อยู่แล้ว อันนี้แค่ให้เมนูตรงกับสิทธิ์) */
    fetch("/api/t/me", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (j) {
        var me = j && j.me ? j.me : null;
        if (me && j.sections) { me.sections = j.sections; }
        buildSidebar(here, me);
        buildPager(here);
        syncToggle();
      });
  });
})(window);
