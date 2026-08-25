/* ============================================================
   KAN ERP — ที่มาของตัวเลข (Provenance)
   • บนหน้า KPI: กดปุ่ม "ที่มา" ข้างช่องกรอก → เด้ง popup โชว์ส่วนหนึ่ง
     ของหน้าต้นทางแบบสด (iframe) พร้อมไฮไลต์จุดที่ดึงตัวเลขมา
   • กด "เปิดหน้าเต็ม →" → พาไปหน้านั้นจริง แล้วเลื่อนไปจุดเดิม + ไฮไลต์
   • บนหน้าต้นทาง: สคริปต์ตัวเดียวกันอ่าน #peek=<key> แล้วเลื่อน/ไฮไลต์ให้
   ใช้กลไกเดียวกันทั้ง preview และหน้าเต็ม — แก้ที่เดียวจบ
   ============================================================ */
(function () {
  "use strict";

  var SHEET_URL = "https://docs.google.com/spreadsheets/d/1R6oGsQT5CKLEwr0O_amaMIx6JZjv6cEXohRam_9Qrrg/edit?gid=244265471#gid=244265471";

  /* ── ทะเบียนจุดข้อมูล ───────────────────────────────────────────────────
     key → หน้าไหน + หาเจอยังไง
       sel : CSS selector ตรง ๆ
       h   : ข้อความในหัวข้อ h1/h2/h3 (ใช้เมื่อหน้านั้นไม่มี id)
       up  : เจอแล้วให้ถอยขึ้นไปหากล่องแม่ (ให้พรีวิวเห็นทั้งการ์ด ไม่ใช่แค่กราฟ)
       live: true = ตัวเลขวาดด้วย JS ต้องรอโหลด                              */
  var LOC = {
    "tele.kpis":    { page: "tele-dashboard.html", sel: "#kpis",     live: true,
                      label: "สรุปสายเข้า / รับได้ / สายหลุด", src: "Tele Dashboard" },
    "tele.speed":   { page: "tele-dashboard.html", sel: "#speedBox", up: ".card", live: true,
                      label: "รับสายเร็วกว่า 20 วินาทีไหม (ASA)", src: "Tele Dashboard" },
    "tele.bars":    { page: "tele-dashboard.html", sel: "#bars",     up: ".card", live: true,
                      label: "ปริมาณสายเข้า vs รับได้ รายวัน", src: "Tele Dashboard" },
    "tele.src":     { page: "tele-dashboard.html", sel: "#dsrc",
                      label: "ไฟล์ CSV ต้นทางของรายงานสาย", src: "Tele Dashboard" },

    "sales.cards":  { page: "01a-dashboard.html", sel: "#cards",  live: true,
                      label: "การ์ดสรุปยอดขาย", src: "Sales Dashboard" },
    "sales.net":    { page: "01a-dashboard.html", sel: "#c0", up: ".glass", live: true,
                      label: "ยอดขายรวมแต่ละเดือน (NetSales)", src: "Sales Dashboard" },
    "sales.traffic":{ page: "01a-dashboard.html", sel: "#c5", up: ".glass", live: true,
                      label: "เฉลี่ยคนเข้าร้าน/วัน รายเดือน", src: "Sales Dashboard" },
    "sales.conv":   { page: "01a-dashboard.html", sel: "#c6", up: ".glass", live: true,
                      label: "Conversion Rate รายเดือน", src: "Sales Dashboard" },
    "sales.tbl":    { page: "01a-dashboard.html", sel: "#tbl", up: ".glass", live: true,
                      label: "ตัวเลขดิบรายเดือน", src: "Sales Dashboard" },

    "cal.timeline": { page: "04k-calendar.html", h: "Timeline รายเดือน", up: ".glass",
                      label: "Marketing Calendar — Timeline รายเดือน", src: "Calendar & Budget" },
    "cal.budget":   { page: "04k-calendar.html", h: "งบรวม 220K", up: ".glass",
                      label: "งบรวม — แตกราย Channel", src: "Calendar & Budget" },

    "soc.pillars":  { page: "04h-social.html", h: "4 เสา Content", up: ".glass",
                      label: "4 เสา Content", src: "Social Post Plan" },
    "soc.freq":     { page: "04h-social.html", h: "ความถี่", up: ".glass",
                      label: "แผนความถี่การโพสต์", src: "Social Post Plan" }
  };

  /* ── KPI ไหนดึงมาจากจุดไหน ─────────────────────────────────────────────
     why  : ใช้ตัวเลขนั้นทำอะไรในสูตร
     weak : ต้นทางเป็น "แผน" ไม่ใช่ผลจริง → เตือนไว้ ไม่ให้เข้าใจผิดว่าตรวจสอบได้ */
  var SRC = {
    "MKT-02": [{ k: "cal.budget",  why: "งบส่วนลดที่อนุมัติ = ตัวหาร เทียบกับที่ใช้จริง" }],
    "MKT-05": [{ k: "soc.pillars", why: "แผนโพสต์ CSR/แคมเปญ = ตัวหาร", weak: true },
               { k: "cal.timeline", why: "กำหนดการโพสต์ตามปฏิทิน" }],
    "MKT-07": [{ k: "tele.kpis",   why: "อัตรารับสายรวมของเดือน" },
               { k: "tele.src",    why: "ไฟล์ CSV ที่รายงานสายใช้ — ต้นทางจริงชั้นสุดท้าย" }],
    "MKT-08": [{ k: "tele.speed",  why: "สัดส่วนสายที่ยกหูภายใน 20 วินาที" }],
    "MKT-12": [{ k: "sales.net",   why: "รายได้ = ตัวหาร" },
               { k: "cal.budget",  why: "งบการตลาดที่ใช้ = ตัวตั้ง" }],
    "MKT-13": [{ k: "cal.budget",  why: "งบที่ตั้งไว้รายไตรมาส เทียบกับที่ใช้จริง" }],
    "MKT-14": [{ k: "sales.net",   why: "ยอดขายเดือนนี้เทียบปีก่อน" },
               { k: "sales.tbl",   why: "ตัวเลขดิบไว้ตรวจย้อน" }],
    "MKT-18": [{ k: "sales.traffic", why: "คนเข้าร้าน — ใช้ดูการขยายฐาน" },
               { k: "sales.conv",  why: "อัตราแปลงเป็นลูกค้า" }],
    "MKT-19": [{ k: "cal.timeline", why: "กิจกรรมที่ต้องลงตามปฏิทิน = ตัวหาร" }],
    "MKT-20": [{ k: "cal.budget",  why: "งบต่อ Channel — ใช้คิด CPA" }],
    "MKT-21": [{ k: "soc.freq",    why: "แผนโพสต์ Facebook", weak: true }],
    "MKT-22": [{ k: "soc.freq",    why: "แผนโพสต์ TikTok", weak: true }],
    "MKT-23": [{ k: "soc.freq",    why: "แผนโพสต์ Instagram", weak: true }],
    "MKT-24": [{ k: "soc.freq",    why: "แผนโพสต์ LINE OA", weak: true }],
    "MKT-25": [{ k: "sales.conv",  why: "Conversion Rate" }],
    "MKT-26": [{ k: "tele.kpis",   why: "จำนวนสายที่ไม่ได้รับ" },
               { k: "tele.bars",   why: "ดูรายวันว่าหลุดวันไหน" }]
    /* ที่เหลือ = ยังไม่มีต้นทางในระบบ → popup จะบอกตรง ๆ ว่าต้องกรอกมือ */
  };

  var IN_FRAME = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();

  // ── CSS (ฉีดเองทั้งหมด ไม่ต้องแก้ styles.css) ───────────────────────────
  function injectCSS() {
    if (document.getElementById("prov-css")) return;
    var s = document.createElement("style");
    s.id = "prov-css";
    s.textContent =
      /* ปุ่มเล็กข้างช่องกรอก */
      ".prov-chip{font:inherit;font-size:10.5px;font-weight:700;line-height:1;padding:4px 7px;border-radius:99px;" +
        "border:1px solid var(--bg-row-divider);background:var(--bg-input);color:var(--text-tertiary);" +
        "cursor:pointer;white-space:nowrap;margin-left:2px;}" +
      ".prov-chip:hover{background:var(--accent-faint);color:var(--accent-text-dark);border-color:transparent;}" +
      ".prov-chip.none{opacity:.4;}" +
      /* popup */
      ".prov-back{position:fixed;inset:0;z-index:9999;background:rgba(15,18,24,.55);backdrop-filter:blur(3px);" +
        "display:flex;align-items:center;justify-content:center;padding:24px;}" +
      ".prov-modal{background:var(--bg-page,#fff);color:var(--text-primary);border-radius:16px;width:min(980px,100%);" +
        "max-height:min(88vh,860px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.35);}" +
      ".prov-head{padding:16px 18px 12px;border-bottom:1px solid var(--bg-row-divider);}" +
      ".prov-eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--accent-text);}" +
      ".prov-title{font-size:15px;font-weight:700;margin-top:3px;line-height:1.4;}" +
      ".prov-x{position:absolute;top:14px;right:16px;border:0;background:transparent;font-size:22px;line-height:1;" +
        "cursor:pointer;color:var(--text-muted);}" +
      ".prov-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px;}" +
      ".prov-tab{font:inherit;font-size:12px;font-weight:600;padding:6px 11px;border-radius:99px;cursor:pointer;" +
        "border:1px solid var(--bg-row-divider);background:var(--bg-input);color:var(--text-secondary);}" +
      ".prov-tab.on{background:#F2565A;color:#fff;border-color:transparent;}" +
      ".prov-why{font-size:12px;color:var(--text-muted);margin-top:10px;line-height:1.55;}" +
      ".prov-warn{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px;" +
        "background:#FEF3C7;color:#92400E;margin-left:6px;}" +
      ".prov-body{flex:1;min-height:0;background:var(--bg-card-subtle);position:relative;}" +
      ".prov-frame{width:100%;height:100%;min-height:380px;border:0;display:block;}" +
      ".prov-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
        "font-size:13px;color:var(--text-muted);pointer-events:none;}" +
      ".prov-empty{padding:34px 24px;text-align:center;font-size:13.5px;color:var(--text-secondary);line-height:1.8;}" +
      ".prov-foot{padding:12px 18px;border-top:1px solid var(--bg-row-divider);display:flex;gap:9px;" +
        "align-items:center;flex-wrap:wrap;}" +
      ".prov-btn{font:inherit;font-size:13px;font-weight:700;padding:8px 15px;border-radius:10px;cursor:pointer;" +
        "text-decoration:none;display:inline-flex;align-items:center;gap:6px;" +
        "border:1px solid var(--bg-row-divider);background:var(--bg-input);color:var(--text-primary);}" +
      ".prov-btn.primary{background:#F2565A;color:#fff;border-color:transparent;}" +
      /* ไฮไลต์จุดที่ถูกดึงมา */
      "@keyframes prov-pulse{0%,100%{box-shadow:0 0 0 3px rgba(242,86,90,.85),0 0 0 12px rgba(242,86,90,.16);}" +
        "50%{box-shadow:0 0 0 3px rgba(242,86,90,.5),0 0 0 20px rgba(242,86,90,0);}}" +
      ".prov-hit{animation:prov-pulse 1.5s ease-in-out 2;border-radius:14px;scroll-margin:24px;}" +
      /* โหมดฝังใน popup — ซ่อนเมนูให้เห็นแต่เนื้อ */
      "html.prov-embed .erp-nav,html.prov-embed nav.nav,html.prov-embed .subnav{display:none!important;}" +
      "html.prov-embed body{padding-top:14px!important;}";
    document.head.appendChild(s);
  }

  // ── หา element ตาม locator ────────────────────────────────────────────
  function locate(loc) {
    var el = null;
    if (loc.sel) {
      el = document.querySelector(loc.sel);
    } else if (loc.h) {
      var hs = document.querySelectorAll("h1,h2,h3");
      for (var i = 0; i < hs.length; i++) {
        if (hs[i].textContent.replace(/\s+/g, " ").indexOf(loc.h) >= 0) { el = hs[i]; break; }
      }
    }
    if (el && loc.up && el.closest) el = el.closest(loc.up) || el;
    return el;
  }

  function flash(el) {
    try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { el.scrollIntoView(); }
    el.classList.add("prov-hit");
    setTimeout(function () { el.classList.remove("prov-hit"); }, 3400);
  }

  /* หน้าปลายทางหลายหน้าวาดตัวเลขด้วย JS — รอจนกว่าจะมีของจริงค่อยไฮไลต์ */
  function gotoPeek() {
    var m = /(?:^|[#&])peek=([^&]+)/.exec(location.hash || "");
    if (!m) return;
    var loc = LOC[decodeURIComponent(m[1])];
    if (!loc) return;
    if (IN_FRAME) document.documentElement.classList.add("prov-embed");

    var tries = 0;
    (function wait() {
      var el = locate(loc);
      var ready = el && (!loc.live || el.offsetHeight > 4);
      if (ready) return flash(el);
      if (++tries < 50) return setTimeout(wait, 120);
      if (el) flash(el);
    })();
  }

  // ── popup ─────────────────────────────────────────────────────────────
  var back = null;

  function close() {
    if (!back) return;
    back.remove(); back = null;
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /**
   * เปิด popup ที่มา
   * @param {string} code  รหัส KPI เช่น "MKT-07"
   * @param {string} name  ชื่อตัวชี้วัด (โชว์บนหัว popup)
   */
  function open(code, name) {
    injectCSS();
    close();

    var list = SRC[code] || [];
    back = document.createElement("div");
    back.className = "prov-back";
    back.innerHTML =
      '<div class="prov-modal" style="position:relative">' +
        '<button class="prov-x" aria-label="ปิด">&times;</button>' +
        '<div class="prov-head">' +
          '<div class="prov-eyebrow">ที่มาของตัวเลข · ' + esc(code) + "</div>" +
          '<div class="prov-title">' + esc(name || "") + "</div>" +
          '<div class="prov-tabs"></div>' +
          '<div class="prov-why"></div>' +
        "</div>" +
        '<div class="prov-body"></div>' +
        '<div class="prov-foot"></div>' +
      "</div>";
    document.body.appendChild(back);
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    back.querySelector(".prov-x").addEventListener("click", close);

    var tabs = back.querySelector(".prov-tabs");
    var why  = back.querySelector(".prov-why");
    var body = back.querySelector(".prov-body");
    var foot = back.querySelector(".prov-foot");

    // ไม่มีต้นทางในระบบ — บอกตรง ๆ ดีกว่าเดา
    if (!list.length) {
      tabs.remove();
      why.remove();
      body.innerHTML =
        '<div class="prov-empty"><b>ตัวนี้ยังไม่มีต้นทางในระบบ</b><br>' +
        "ต้องกรอกมือจากเอกสารภายนอก (รายงานทีม / อีเมล / ไฟล์แนบ)<br>" +
        "ถ้าอยากให้กดตรวจย้อนได้ ต้องมีหน้าที่เก็บตัวเลขนี้ก่อน</div>";
      foot.innerHTML =
        '<span style="flex:1"></span>' +
        '<a class="prov-btn" target="_blank" rel="noopener" href="' + SHEET_URL + '">เปิดชีตนิยาม KPI ↗</a>';
      return;
    }

    var cur = 0;

    function paint() {
      var item = list[cur], loc = LOC[item.k];
      var url = loc.page + "#peek=" + encodeURIComponent(item.k);

      tabs.innerHTML = list.map(function (it, i) {
        return '<button class="prov-tab' + (i === cur ? " on" : "") + '" data-i="' + i + '">' +
               esc(LOC[it.k].label) + "</button>";
      }).join("");
      Array.prototype.forEach.call(tabs.querySelectorAll(".prov-tab"), function (b) {
        b.addEventListener("click", function () { cur = +b.getAttribute("data-i"); paint(); });
      });

      why.innerHTML = "จาก <b>" + esc(loc.src) + "</b> — " + esc(item.why || "") +
        (item.weak ? '<span class="prov-warn">แผน ไม่ใช่ผลจริง</span>' : "");

      body.innerHTML = '<div class="prov-load">กำลังโหลดหน้าต้นทาง…</div>' +
                       '<iframe class="prov-frame" src="' + esc(url) + '"></iframe>';
      var fr = body.querySelector(".prov-frame");
      fr.addEventListener("load", function () {
        var ld = body.querySelector(".prov-load");
        if (ld) ld.remove();
      });

      foot.innerHTML =
        '<a class="prov-btn primary" href="' + esc(url) + '">เปิดหน้าเต็ม แล้วเลื่อนไปจุดนี้ →</a>' +
        '<a class="prov-btn" target="_blank" rel="noopener" href="' + esc(url) + '">แท็บใหม่ ↗</a>' +
        '<span style="flex:1"></span>' +
        '<a class="prov-btn" target="_blank" rel="noopener" href="' + SHEET_URL + '">ชีตนิยาม KPI ↗</a>';
    }

    paint();
  }

  function has(code) { return !!(SRC[code] && SRC[code].length); }

  // ── เริ่มทำงาน ────────────────────────────────────────────────────────
  injectCSS();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", gotoPeek);
  } else {
    gotoPeek();
  }
  window.addEventListener("hashchange", gotoPeek);

  window.PROV = { open: open, has: has, LOC: LOC, SRC: SRC, close: close };
})();
