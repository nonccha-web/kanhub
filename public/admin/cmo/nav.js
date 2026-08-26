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

  window.toggleTheme = function () {
    var h = document.documentElement;
    var next = h.getAttribute("data-theme") === "dark" ? "light" : "dark";
    if (next === "dark") h.setAttribute("data-theme", "dark");
    else h.removeAttribute("data-theme");
    try { localStorage.setItem("kan-theme", next); } catch (e) {}
    syncToggle();
  };
  function syncToggle() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var icon = document.getElementById("theme-icon");
    var label = document.getElementById("theme-label");
    if (icon) icon.textContent = dark ? "☀️" : "🌙";
    if (label) label.textContent = dark ? "Light" : "Dark";
  }

  function currentFile() {
    var p = location.pathname.split("/").pop();
    return p && p.length ? decodeURIComponent(p) : "index.html";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── สร้าง sidebar จากเมนูรวม (erp-menu.js) ──────────────────────────────
  function buildSidebar(here) {
    var menuHTML = global.ERP_MENU
      ? global.ERP_MENU.render({ ctx: "cmo", active: "cmo:" + here,
          salesBase: ERP_BASE, cmoBase: "" })
      : "";
    var h = menuHTML +
      '<div class="erp-foot">' +
        '<button class="erp-theme" onclick="toggleTheme()"><span id="theme-icon">🌙</span> ' +
        '<span id="theme-label">Dark</span></button>' +
        '<div class="erp-foot-note">KAN MKT · รวมทุกระบบ</div></div>';

    var aside = document.createElement("aside");
    aside.className = "erp-sidebar";
    aside.innerHTML = h;
    document.body.insertBefore(aside, document.body.firstChild);
    document.documentElement.classList.add("has-erp-side");
    if (global.ERP_MENU) { global.ERP_MENU.wire(aside); }

    /* มือถือ: เมนูเป็นลิ้นชัก ต้องมีปุ่มเปิดและฉากหลังกดปิด */
    var bar = document.createElement("div");
    bar.className = "erp-topbar";
    bar.innerHTML =
      '<button type="button" aria-label="เปิดเมนู" data-erp-toggle>' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>' +
      '<img src="../assets/kan-logo.png" alt=""><b>KAN MKT</b>';
    document.body.insertBefore(bar, document.body.firstChild);

    var scrim = document.createElement("div");
    scrim.className = "erp-scrim";
    scrim.setAttribute("data-erp-close", "1");
    document.body.insertBefore(scrim, document.body.firstChild);

    document.addEventListener("click", function (ev) {
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
    buildSidebar(here);
    buildPager(here);
    syncToggle();
  });
})(window);
