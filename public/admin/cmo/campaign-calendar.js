/* ============================================================
   KAN ERP — ปฏิทินแคมเปญ
   ข้อมูลเก็บที่ D1 ผ่าน /api/campaigns (ทีมเห็นชุดเดียวกัน)
   แนบรูปได้ ย่อฝั่งเบราว์เซอร์ก่อนส่ง เก็บใน D1 เสิร์ฟที่ /api/attachments/<id>
   เปิดแบบ file:// (ไม่มี API) จะถอยไปใช้ localStorage อัตโนมัติ + ขึ้นป้ายบอก
   ============================================================ */
(function () {
  "use strict";

  var API = "/api";
  var LS_KEY = "kan-campaign-calendar";
  var MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  var MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  var DOW = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  var CHANNELS = ["หน้าร้าน","Facebook","LINE","TikTok","Shopee/Lazada","ขายส่ง"];
  var BRANCHES = ["Kan Hub","Kan Fashion","ชุมพร","นคร","สุราษฎร์","Central","สหไทย"];
  // Central / สหไทย = ห้างข้างนอกที่เราไปลงของ ไม่ใช่สาขาเรา
  var STATUS_LABEL = { plan:"วางแผน", live:"กำลังทำ", done:"จบแล้ว" };
  var MAX_IMAGE_PX = 1400;
  var MAX_IMAGE_BYTES = 1400000;

  var items = [];
  var year = new Date().getFullYear();
  var view = { mode:"year", month:null };
  var editingId = null;
  var pendingFiles = [];   // รูปที่เลือกไว้ตอนแคมเปญยังไม่ถูกบันทึก
  var online = true;       // ต่อ API ได้หรือไม่
  var toastTimer;

  function $(id) { return document.getElementById(id); }

  /* ---------- API / storage ---------- */
  async function api(path, options) {
    var res = await fetch(API + path, Object.assign(
      { headers: { "content-type": "application/json" } }, options || {}));
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((data && data.error) || ("HTTP " + res.status));
    return data;
  }

  async function loadAll() {
    try {
      var data = await api("/campaigns");
      items = data.campaigns || [];
      online = true;
    } catch (e) {
      online = false;
      try {
        var raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
        items = raw && Array.isArray(raw.items) ? raw.items : [];
      } catch (e2) { items = []; }
    }
    var flag = $("ccOffline");
    if (flag) flag.style.display = online ? "none" : "";
  }

  function cacheLocal() {
    if (online) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify({ version:2, items:items })); } catch (e) {}
  }

  /* ---------- helpers ---------- */
  function iso(y, m, d) {
    return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }
  function parseISO(s) { var p = String(s || "").split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function todayISO() { var t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); }
  function daysIn(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function be(y) { return y + 543; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  function baht(n) { return Number(n || 0).toLocaleString("th-TH"); }
  function covers(it, dayISO) { return it.start <= dayISO && dayISO <= (it.end || it.start); }
  function isMonthPlan(it) { return it.scope === "month"; }
  function fmtRange(it) {
    var a = parseISO(it.start);
    if (isMonthPlan(it)) {
      var b0 = parseISO(it.end);
      if (a.getMonth() === b0.getMonth() && a.getFullYear() === b0.getFullYear()) {
        return "ทั้งเดือน" + MONTHS[a.getMonth()];
      }
    }
    var txt = a.getDate() + " " + MONTHS_SHORT[a.getMonth()];
    if (it.end && it.end !== it.start) {
      var b = parseISO(it.end);
      txt += " – " + b.getDate() + " " + MONTHS_SHORT[b.getMonth()];
      if (b.getFullYear() !== a.getFullYear()) txt += " " + String(be(b.getFullYear())).slice(2);
    }
    return txt;
  }
  /* ชื่อสั้นสำหรับช่องปฏิทินแคบๆ — ตัดคำนำหน้าแบบ "Category Bomb #3 · " ออก */
  function shortName(name) {
    return String(name).replace(/^[^·]{0,40}#\d+\s*·\s*/, "");
  }

  function ofYear() {
    var y = String(year);
    return items.filter(function (it) {
      return it.start.slice(0, 4) === y || (it.end || it.start).slice(0, 4) === y;
    }).sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  }
  function ofMonth(m) {
    var first = new Date(year, m, 1), last = new Date(year, m, daysIn(year, m));
    return ofYear().filter(function (it) {
      return parseISO(it.start) <= last && parseISO(it.end || it.start) >= first;
    });
  }
  function byId(id) { return items.filter(function (x) { return x.id === id; })[0]; }

  /* ---------- render ---------- */
  function render() {
    $("ccYear").innerHTML = be(year) + "<small>ค.ศ. " + year + "</small>";
    renderStats();
    if (view.mode === "year") renderYear(); else renderMonth();
    renderList();
  }

  function renderStats() {
    var list = ofYear(), t = todayISO();
    var running = list.filter(function (i) { return covers(i, t); }).length;
    var plan = list.filter(function (i) { return i.status === "plan"; }).length;
    var budget = list.reduce(function (s, i) { return s + (Number(i.budget) || 0); }, 0);
    $("ccStats").innerHTML =
      card("แคมเปญทั้งปี", list.length, "รายการ") +
      card("กำลังทำอยู่วันนี้", running, "รายการ", running > 0) +
      card("ยังไม่เริ่ม", plan, "รายการ") +
      card("งบรวมทั้งปี", '<span class="cur">฿</span>' + baht(budget), "");
  }
  function card(k, v, u, hot) {
    return '<div class="cc-stat' + (hot ? " live" : "") + '"><div class="k">' + k + "</div>" +
           '<div class="v">' + v + (u ? '<span class="u">' + u + "</span>" : "") + "</div></div>";
  }

  function renderYear() {
    var now = new Date(), tISO = todayISO(), out = '<div class="cc-months">';
    for (var m = 0; m < 12; m++) {
      var list = ofMonth(m), days = daysIn(year, m), lead = new Date(year, m, 1).getDay();
      var cur = now.getFullYear() === year && now.getMonth() === m;
      var cells = "";
      for (var i = 0; i < lead; i++) cells += '<i class="pad">0</i>';
      for (var d = 1; d <= days; d++) {
        var dISO = iso(year, m, d), dow = new Date(year, m, d).getDay();
        var on = list.some(function (it) { return covers(it, dISO); });
        var cls = on ? "on" : (dow === 0 || dow === 6 ? "we" : "");
        if (dISO === tISO) cls += " today";
        cells += '<i class="' + cls + '">' + d + "</i>";
      }
      out += '<button class="cc-month' + (cur ? " cur" : "") + '" data-month="' + m + '">' +
             "<h3>" + MONTHS[m] + '<span class="cnt' + (list.length ? " has" : "") + '">' +
             (list.length ? list.length + " แคมเปญ" : "—") + "</span></h3>" +
             '<div class="cc-mini">' + DOW.map(function (x) { return "<span>" + x + "</span>"; }).join("") + cells + "</div></button>";
    }
    $("ccView").innerHTML = out + "</div>";
  }

  function renderMonth() {
    var m = view.month, days = daysIn(year, m), lead = new Date(year, m, 1).getDay();
    var tISO = todayISO(), list = ofMonth(m), cells = "";
    var prevDays = daysIn(m === 0 ? year - 1 : year, m === 0 ? 11 : m - 1);

    for (var i = lead; i > 0; i--) cells += '<div class="cc-cell out"><span class="cc-dnum">' + (prevDays - i + 1) + "</span></div>";
    for (var d = 1; d <= days; d++) {
      var dISO = iso(year, m, d), dow = new Date(year, m, d).getDay();
      var todays = list.filter(function (it) { return covers(it, dISO) && !isMonthPlan(it); });
      var chips = todays.slice(0, 3).map(function (it) {
        return '<button class="cc-chip ' + it.status + '" data-edit="' + it.id + '" title="' + esc(it.name) + '"><b>' + esc(shortName(it.name)) + "</b></button>";
      }).join("");
      if (todays.length > 3) chips += '<span class="cc-more">+ อีก ' + (todays.length - 3) + "</span>";
      // เซลล์ต้องไม่เป็น <button> เพราะ chip ข้างในก็เป็นปุ่ม — ปุ่มซ้อนปุ่มทำให้เบราว์เซอร์ตัดโครงทิ้ง
      cells += '<div class="cc-cell' + (dow === 0 || dow === 6 ? " we" : "") + (dISO === tISO ? " today" : "") +
               '" data-day="' + dISO + '" role="button" tabindex="0"><span class="cc-dnum">' + d + "</span>" + chips + "</div>";
    }
    var tail = (7 - ((lead + days) % 7)) % 7;
    for (var j = 1; j <= tail; j++) cells += '<div class="cc-cell out"><span class="cc-dnum">' + j + "</span></div>";

    var monthPlans = list.filter(isMonthPlan);
    var banner = monthPlans.length
      ? '<div class="cc-monthplans">' + monthPlans.map(function (it) {
          return '<button class="cc-mplan ' + it.status + '" data-edit="' + it.id + '">' +
                 '<span class="cc-pill ' + it.status + '">' + STATUS_LABEL[it.status] + "</span>" +
                 "<b>" + esc(shortName(it.name)) + "</b>" +
                 (it.branches && it.branches.length ? '<span class="cc-mplan-br">' + it.branches.map(esc).join(" · ") + "</span>" : "") +
                 "</button>";
        }).join("") + "</div>"
      : "";

    $("ccView").innerHTML =
      '<div class="cc-monthbar">' +
        '<button class="cc-back" id="ccBack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>ทั้งปี ' + be(year) + "</button>" +
        "<h2>" + MONTHS[m] + " " + be(year) + "</h2>" +
        '<button class="cc-btn" data-newmonth="1">+ แผนทั้งเดือนนี้</button>' +
      "</div>" + banner +
      '<div class="cc-cal"><div class="cc-dow">' + DOW.map(function (x) { return "<div>" + x + "</div>"; }).join("") +
      '</div><div class="cc-grid">' + cells + "</div></div>" +
      renderBranchBoard(list);
  }

  /* เดือนนี้ "สาขาไหนทำอะไร" */
  function renderBranchBoard(list) {
    if (!list.length) return "";
    var cols = BRANCHES.map(function (b) {
      var mine = list.filter(function (it) { return (it.branches || []).indexOf(b) !== -1; });
      var body = mine.length
        ? mine.map(function (it) {
            return '<button class="cc-bitem ' + it.status + '" data-edit="' + it.id + '">' +
                   "<b>" + esc(shortName(it.name)) + "</b>" +
                   '<span class="cc-bmeta">' + fmtRange(it) + (it.budget ? " · ฿ " + baht(it.budget) : "") + "</span>" +
                   "</button>";
          }).join("")
        : '<div class="cc-bempty">ยังไม่มีแผน</div>';
      return '<div class="cc-bcol"><h4>' + esc(b) + "<span>" + (mine.length || "") + "</span></h4>" + body + "</div>";
    }).join("");
    var noBranch = list.filter(function (it) { return !it.branches || !it.branches.length; });
    var extra = noBranch.length
      ? '<div class="cc-bcol"><h4>ยังไม่ระบุสาขา<span>' + noBranch.length + "</span></h4>" +
        noBranch.map(function (it) {
          return '<button class="cc-bitem ' + it.status + '" data-edit="' + it.id + '"><b>' + esc(it.name) + "</b>" +
                 '<span class="cc-bmeta">' + fmtRange(it) + "</span></button>";
        }).join("") + "</div>"
      : "";
    return '<div class="cc-board"><h3>เดือนนี้ แต่ละสาขาทำอะไร</h3><div class="cc-bgrid">' + cols + extra + "</div></div>";
  }

  function renderList() {
    var list = view.mode === "month" ? ofMonth(view.month) : ofYear();
    var title = view.mode === "month" ? "แคมเปญเดือน" + MONTHS[view.month] : "แคมเปญทั้งปี " + be(year);
    if (!list.length) {
      $("ccList").innerHTML = "<h3>" + title + "</h3>" +
        '<div class="cc-empty"><p>ยังไม่มีแคมเปญในช่วงนี้</p>' +
        '<button class="cc-btn primary" data-new="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>เพิ่มแคมเปญแรก</button></div>';
      return;
    }
    var rows = list.map(function (it) {
      var atts = it.attachments || [];
      var thumbs = atts.length
        ? '<div class="cc-thumbs">' + atts.slice(0, 4).map(function (a) {
            return '<img src="' + API + "/attachments/" + a.id + '" alt="' + esc(a.fileName) + '" loading="lazy">';
          }).join("") + (atts.length > 4 ? '<span class="cc-more">+' + (atts.length - 4) + "</span>" : "") + "</div>"
        : "";
      return "<tr>" +
        '<td class="dt">' + fmtRange(it) + "</td>" +
        '<td class="nm">' + esc(it.name) +
          (it.note ? '<div class="cc-note">' + esc(it.note) + "</div>" : "") + thumbs + "</td>" +
        '<td><span class="cc-pill ' + it.status + '">' + STATUS_LABEL[it.status] + "</span></td>" +
        '<td><div class="cc-tags">' + (it.channels || []).map(function (c) { return '<span class="cc-tag">' + esc(c) + "</span>"; }).join("") + "</div></td>" +
        '<td><div class="cc-tags">' + (it.branches || []).map(function (b) { return '<span class="cc-tag">' + esc(b) + "</span>"; }).join("") + "</div></td>" +
        '<td class="dt">' + (it.budget ? "฿ " + baht(it.budget) : "—") + "</td>" +
        "<td>" + (it.owner ? esc(it.owner) : "—") + "</td>" +
        '<td style="text-align:right"><button class="cc-icon" data-edit="' + it.id + '" aria-label="แก้ไข">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></button></td>' +
        "</tr>";
    }).join("");
    $("ccList").innerHTML = "<h3>" + title + "</h3>" +
      '<div class="cc-tablewrap"><table class="cc-table"><thead><tr>' +
      "<th>ช่วงวัน</th><th>แคมเปญ</th><th>สถานะ</th><th>ช่องทาง</th><th>สาขา</th><th>งบ</th><th>ผู้รับผิดชอบ</th><th></th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>";
  }


  /* ---------- การ์ดลอยตอนเอาเมาส์ค้าง ---------- */
  var hoverEl = null, hoverTimer = null, touchTimer = null;

  function hoverCard() {
    if (!hoverEl) {
      hoverEl = document.createElement("div");
      hoverEl.className = "cc-hover";
      document.body.appendChild(hoverEl);
    }
    return hoverEl;
  }

  function showHover(it, anchor) {
    var el = hoverCard();
    var atts = it.attachments || [];
    var pics = atts.length
      ? '<div class="cc-hover-pics">' + atts.slice(0, 3).map(function (a) {
          return '<img src="' + API + "/attachments/" + a.id + '" alt="">';
        }).join("") + "</div>"
      : "";
    el.innerHTML = pics +
      '<div class="cc-hover-body">' +
        '<div class="cc-hover-top"><span class="cc-pill ' + it.status + '">' + STATUS_LABEL[it.status] + "</span>" +
        (it.budget ? '<span class="cc-hover-budget">฿ ' + baht(it.budget) + "</span>" : "") + "</div>" +
        "<b>" + esc(it.name) + "</b>" +
        '<div class="cc-hover-date">' + fullRange(it) + "</div>" +
        (it.branches && it.branches.length ? '<div class="cc-hover-meta">' + it.branches.map(esc).join(" · ") + "</div>" : "") +
        (it.channels && it.channels.length ? '<div class="cc-hover-meta">ช่องทาง: ' + it.channels.map(esc).join(" · ") + "</div>" : "") +
        (it.owner ? '<div class="cc-hover-meta">ผู้รับผิดชอบ: ' + esc(it.owner) + "</div>" : "") +
        (it.note ? '<div class="cc-hover-note">' + esc(it.note) + "</div>" : "") +
      "</div>";
    el.classList.add("show");

    var r = anchor.getBoundingClientRect();
    el.style.visibility = "hidden";
    el.style.left = "0px";
    el.style.top = "0px";
    var w = el.offsetWidth, h = el.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var top = r.top - h - 10;
    if (top < 8) top = Math.min(r.bottom + 10, window.innerHeight - h - 8);
    el.style.left = left + "px";
    el.style.top = top + "px";
    el.style.visibility = "";
  }

  function hideHover() {
    clearTimeout(hoverTimer);
    if (hoverEl) hoverEl.classList.remove("show");
  }

  document.addEventListener("mouseover", function (e) {
    var t = e.target.closest("[data-edit]");
    if (!t) return;
    var it = byId(t.dataset.edit);
    if (!it) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () { showHover(it, t); }, 260);
  });
  document.addEventListener("mouseout", function (e) {
    if (e.target.closest("[data-edit]")) hideHover();
  });
  document.addEventListener("scroll", hideHover, true);

  /* มือถือ: แตะค้าง 450ms = ดูรายละเอียด (ไม่เปิดฟอร์ม) */
  document.addEventListener("touchstart", function (e) {
    var t = e.target.closest("[data-edit]");
    if (!t) return;
    var it = byId(t.dataset.edit);
    if (!it) return;
    touchTimer = setTimeout(function () { showHover(it, t); touchTimer = null; }, 450);
  }, { passive: true });
  document.addEventListener("touchend", function () {
    if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
    else setTimeout(hideHover, 2600);
  }, { passive: true });

  function fullRange(it) {
    var a = parseISO(it.start), b = parseISO(it.end || it.start);
    if (isMonthPlan(it) && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return "ทั้งเดือน" + MONTHS[a.getMonth()] + " " + be(a.getFullYear());
    }
    var same = a.getFullYear() === b.getFullYear();
    var one = a.getTime() === b.getTime();
    if (one) return a.getDate() + " " + MONTHS[a.getMonth()] + " " + be(a.getFullYear());
    return a.getDate() + " " + MONTHS[a.getMonth()] + (same ? "" : " " + be(a.getFullYear())) +
           " – " + b.getDate() + " " + MONTHS[b.getMonth()] + " " + be(b.getFullYear());
  }

  /* ---------- drawer ---------- */
  function buildChoices() {
    $("cc-channels").innerHTML = CHANNELS.map(function (c) {
      return '<button type="button" class="cc-choice" data-choice="channel" data-v="' + esc(c) + '" aria-pressed="false">' + esc(c) + "</button>";
    }).join("");
    $("cc-branches").innerHTML = BRANCHES.map(function (b) {
      return '<button type="button" class="cc-choice" data-choice="branch" data-v="' + esc(b) + '" aria-pressed="false">' + esc(b) + "</button>";
    }).join("");
  }
  function setSeg(sel, v) {
    Array.prototype.forEach.call(document.querySelectorAll(sel + " button"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === v));
    });
  }
  function getSeg(sel, fallback) {
    var on = document.querySelector(sel + ' button[aria-pressed="true"]');
    return on ? on.dataset.v : fallback;
  }
  function setChoices(kind, vals) {
    var v = vals || [];
    Array.prototype.forEach.call(document.querySelectorAll('[data-choice="' + kind + '"]'), function (b) {
      b.setAttribute("aria-pressed", String(v.indexOf(b.dataset.v) !== -1));
    });
  }
  function getChoices(kind) {
    return Array.prototype.filter.call(document.querySelectorAll('[data-choice="' + kind + '"]'), function (b) {
      return b.getAttribute("aria-pressed") === "true";
    }).map(function (b) { return b.dataset.v; });
  }
  function applyScopeUI() {
    var scope = getSeg("#cc-scope", "range");
    $("ccRangeFields").style.display = scope === "month" ? "none" : "";
    $("ccMonthFields").style.display = scope === "month" ? "" : "none";
  }

  function openDrawer(item, presetDate, presetScope) {
    editingId = item ? item.id : null;
    pendingFiles = [];
    $("ccDrawerTitle").textContent = item ? "แก้ไขแคมเปญ" : "เพิ่มแคมเปญ";
    $("cc-name").value = item ? item.name : "";

    var scope = item ? (item.scope || "range") : (presetScope || "range");
    setSeg("#cc-scope", scope);

    var base = item ? parseISO(item.start) : (presetDate ? parseISO(presetDate) : new Date());
    $("cc-month").value = base.getFullYear() + "-" + String(base.getMonth() + 1).padStart(2, "0");
    $("cc-start").value = item ? item.start : (presetDate || todayISO());
    $("cc-end").value = item && item.end !== item.start ? item.end : "";
    applyScopeUI();

    $("cc-budget").value = item && item.budget ? item.budget : "";
    $("cc-owner").value = item ? (item.owner || "") : "";
    $("cc-note").value = item ? (item.note || "") : "";
    $("ccErr").textContent = "";
    setSeg("#cc-status", item ? item.status : "plan");
    setChoices("channel", item ? item.channels : []);
    setChoices("branch", item ? item.branches : []);
    renderAttachments(item);
    $("ccDelete").style.visibility = item ? "visible" : "hidden";
    $("ccDrawer").classList.add("open");
    $("ccDrawer").setAttribute("aria-hidden", "false");
    $("ccScrim").classList.add("open");
    setTimeout(function () { $("cc-name").focus(); }, 60);
  }
  function closeDrawer() {
    $("ccDrawer").classList.remove("open");
    $("ccDrawer").setAttribute("aria-hidden", "true");
    $("ccScrim").classList.remove("open");
    editingId = null;
    pendingFiles = [];
  }

  function renderAttachments(item) {
    var saved = (item && item.attachments) || [];
    var html = saved.map(function (a) {
      return '<div class="cc-file"><img src="' + API + "/attachments/" + a.id + '" alt="' + esc(a.fileName) + '">' +
             '<button type="button" class="cc-filedel" data-delfile="' + a.id + '" aria-label="ลบรูป">&times;</button></div>';
    }).join("");
    html += pendingFiles.map(function (f, i) {
      return '<div class="cc-file pending"><img src="' + f.dataUrl + '" alt="' + esc(f.fileName) + '">' +
             '<button type="button" class="cc-filedel" data-pending="' + i + '" aria-label="เอาออก">&times;</button></div>';
    }).join("");
    $("ccFiles").innerHTML = html || '<div class="cc-nofile">ยังไม่มีรูป</div>';
    $("ccFileHint").textContent = online
      ? "รูปเก็บบนเซิร์ฟเวอร์ ทีมเห็นเหมือนกัน (สูงสุด 6 รูปต่อแคมเปญ)"
      : "โหมดออฟไลน์: แนบรูปไม่ได้ ต้องเปิดผ่าน admin.kan-hub.com";
  }

  /* ย่อรูปก่อนส่ง ไม่งั้นไฟล์จากกล้องมือถือใหญ่เกินลิมิต */
  function shrinkImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("อ่านไฟล์ไม่ได้")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("ไฟล์นี้ไม่ใช่รูป")); };
        img.onload = function () {
          var w = img.width, h = img.height, scale = Math.min(1, MAX_IMAGE_PX / Math.max(w, h));
          var cv = document.createElement("canvas");
          cv.width = Math.round(w * scale);
          cv.height = Math.round(h * scale);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          var q = 0.82, out = cv.toDataURL("image/jpeg", q);
          while (out.length * 0.75 > MAX_IMAGE_BYTES && q > 0.4) {
            q -= 0.12;
            out = cv.toDataURL("image/jpeg", q);
          }
          resolve({ dataUrl: out, fileName: file.name });
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  async function pickFiles(fileList) {
    if (!online) { toast("ต้องเปิดผ่าน admin.kan-hub.com ถึงจะแนบรูปได้"); return; }
    var files = Array.prototype.slice.call(fileList).filter(function (f) { return f.type.indexOf("image/") === 0; });
    if (!files.length) { toast("เลือกได้เฉพาะไฟล์รูป"); return; }
    for (var i = 0; i < files.length; i++) {
      try {
        var shrunk = await shrinkImage(files[i]);
        if (editingId) {
          await api("/campaigns/" + editingId + "?action=attach", { method:"POST", body: JSON.stringify(shrunk) });
          await loadAll();
          renderAttachments(byId(editingId));
          render();
          toast("แนบรูปแล้ว");
        } else {
          pendingFiles.push(shrunk);
          renderAttachments(null);
        }
      } catch (e) {
        toast("แนบรูปไม่สำเร็จ: " + e.message);
      }
    }
  }

  /* ---------- save ---------- */
  function collect() {
    var scope = getSeg("#cc-scope", "range");
    var name = $("cc-name").value.trim();
    var start, end;

    if (scope === "month") {
      var mv = $("cc-month").value; // YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(mv)) return { error: "เลือกเดือนก่อน" };
      var y = +mv.slice(0, 4), mo = +mv.slice(5, 7) - 1;
      start = iso(y, mo, 1);
      end = iso(y, mo, daysIn(y, mo));
    } else {
      start = $("cc-start").value;
      end = $("cc-end").value || start;
      if (!start) return { error: "เลือกวันเริ่ม" };
      if (end < start) return { error: "วันสิ้นสุดต้องไม่มาก่อนวันเริ่ม" };
    }
    if (!name) return { error: "ใส่ชื่อแคมเปญก่อน" };

    return { value: {
      name: name, start: start, end: end, scope: scope,
      status: getSeg("#cc-status", "plan"),
      channels: getChoices("channel"), branches: getChoices("branch"),
      budget: Number($("cc-budget").value) || 0,
      owner: $("cc-owner").value.trim(),
      note: $("cc-note").value.trim()
    } };
  }

  async function submit() {
    var parsed = collect();
    if (parsed.error) { $("ccErr").textContent = parsed.error; return; }
    var data = parsed.value;
    $("ccSave").disabled = true;
    try {
      if (online) {
        if (editingId) {
          await api("/campaigns/" + editingId, { method:"PUT", body: JSON.stringify(data) });
        } else {
          var created = await api("/campaigns", { method:"POST", body: JSON.stringify(data) });
          for (var i = 0; i < pendingFiles.length; i++) {
            await api("/campaigns/" + created.id + "?action=attach", { method:"POST", body: JSON.stringify(pendingFiles[i]) });
          }
        }
        await loadAll();
      } else {
        if (editingId) {
          items = items.map(function (it) { return it.id === editingId ? Object.assign({}, it, data) : it; });
        } else {
          data.id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          data.attachments = [];
          items.push(data);
        }
        cacheLocal();
      }
      year = parseISO(data.start).getFullYear();
      closeDrawer();
      render();
      toast(online ? "บันทึกแล้ว" : "บันทึกในเครื่องนี้ (ยังไม่ขึ้นเซิร์ฟเวอร์)");
    } catch (e) {
      $("ccErr").textContent = "บันทึกไม่สำเร็จ: " + e.message;
    } finally {
      $("ccSave").disabled = false;
    }
  }

  async function removeItem() {
    var it = byId(editingId);
    if (!it) return;
    if (!confirm('ลบ "' + it.name + '" ออกจากปฏิทิน?')) return;
    try {
      if (online) { await api("/campaigns/" + editingId, { method:"DELETE" }); await loadAll(); }
      else { items = items.filter(function (x) { return x.id !== editingId; }); cacheLocal(); }
      closeDrawer();
      render();
      toast("ลบแล้ว");
    } catch (e) { toast("ลบไม่สำเร็จ: " + e.message); }
  }

  function toast(msg) {
    var el = $("ccToast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2800);
  }

  /* ---------- backup ---------- */
  function exportFile() {
    var blob = new Blob([JSON.stringify({ version:2, savedAt:new Date().toISOString(), items:items }, null, 2)],
                        { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kan-campaigns-" + todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("ดาวน์โหลดไฟล์สำรองแล้ว (ไม่รวมรูป)");
  }
  function importFile(file) {
    var reader = new FileReader();
    reader.onload = async function () {
      var incoming;
      try {
        var parsed = JSON.parse(String(reader.result));
        incoming = Array.isArray(parsed) ? parsed : parsed.items;
      } catch (e) { toast("ไฟล์นี้อ่านไม่ได้"); return; }
      if (!Array.isArray(incoming)) { toast("ไฟล์นี้ไม่มีข้อมูลแคมเปญ"); return; }
      var valid = incoming.filter(function (x) { return x && x.name && x.start; });
      if (!valid.length) { toast("ไม่พบแคมเปญในไฟล์"); return; }
      if (!confirm("นำเข้า " + valid.length + " แคมเปญ เพิ่มเข้าไปในระบบ?")) return;
      try {
        if (online) {
          for (var i = 0; i < valid.length; i++) {
            await api("/campaigns", { method:"POST", body: JSON.stringify({
              name: valid[i].name, start: valid[i].start, end: valid[i].end || valid[i].start,
              scope: valid[i].scope || "range", status: valid[i].status || "plan",
              channels: valid[i].channels || [], branches: valid[i].branches || [],
              budget: valid[i].budget || 0, owner: valid[i].owner || "", note: valid[i].note || ""
            }) });
          }
          await loadAll();
        } else {
          items = items.concat(valid);
          cacheLocal();
        }
        render();
        toast("นำเข้า " + valid.length + " แคมเปญแล้ว");
      } catch (e) { toast("นำเข้าไม่สำเร็จ: " + e.message); }
    };
    reader.readAsText(file);
  }

  /* ---------- events ---------- */
  $("ccAdd").addEventListener("click", function () { openDrawer(null, null, null); });
  $("ccPrev").addEventListener("click", function () { year--; view = { mode:"year", month:null }; render(); });
  $("ccNext").addEventListener("click", function () { year++; view = { mode:"year", month:null }; render(); });
  $("ccClose").addEventListener("click", closeDrawer);
  $("ccCancel").addEventListener("click", closeDrawer);
  $("ccSave").addEventListener("click", submit);
  $("ccDelete").addEventListener("click", removeItem);
  $("ccScrim").addEventListener("click", closeDrawer);
  $("ccForm").addEventListener("submit", function (e) { e.preventDefault(); submit(); });
  $("ccExport").addEventListener("click", exportFile);
  $("ccImport").addEventListener("click", function () { $("ccFile").click(); });
  $("ccFile").addEventListener("change", function (e) {
    if (e.target.files && e.target.files[0]) importFile(e.target.files[0]);
    e.target.value = "";
  });
  $("ccAddFile").addEventListener("click", function () { $("ccImageInput").click(); });
  $("ccImageInput").addEventListener("change", function (e) {
    if (e.target.files && e.target.files.length) pickFiles(e.target.files);
    e.target.value = "";
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && $("ccDrawer").classList.contains("open")) submit();
  });

  document.addEventListener("click", async function (e) {
    var scopeBtn = e.target.closest("#cc-scope button");
    if (scopeBtn) { setSeg("#cc-scope", scopeBtn.dataset.v); applyScopeUI(); return; }
    var seg = e.target.closest("#cc-status button");
    if (seg) { setSeg("#cc-status", seg.dataset.v); return; }
    var ch = e.target.closest("[data-choice]");
    if (ch) { ch.setAttribute("aria-pressed", ch.getAttribute("aria-pressed") === "true" ? "false" : "true"); return; }

    var delFile = e.target.closest("[data-delfile]");
    if (delFile) {
      try {
        await api("/attachments/" + delFile.dataset.delfile, { method:"DELETE" });
        await loadAll();
        renderAttachments(byId(editingId));
        render();
      } catch (err) { toast("ลบรูปไม่สำเร็จ"); }
      return;
    }
    var delPending = e.target.closest("[data-pending]");
    if (delPending) { pendingFiles.splice(+delPending.dataset.pending, 1); renderAttachments(null); return; }

    var ed = e.target.closest("[data-edit]");
    if (ed) { e.stopPropagation(); var it = byId(ed.dataset.edit); if (it) openDrawer(it, null, null); return; }
    var mo = e.target.closest("[data-month]");
    if (mo) { view = { mode:"month", month:+mo.dataset.month }; render(); window.scrollTo({ top:0, behavior:"smooth" }); return; }
    if (e.target.closest("#ccBack")) { view = { mode:"year", month:null }; render(); return; }
    if (e.target.closest("[data-newmonth]")) { openDrawer(null, iso(year, view.month, 1), "month"); return; }
    var day = e.target.closest("[data-day]");
    if (day) { openDrawer(null, day.dataset.day, "range"); return; }
    if (e.target.closest("[data-new]")) {
      openDrawer(null, view.mode === "month" ? iso(year, view.month, 1) : null, null);
      return;
    }
  });

  buildChoices();
  render();
  loadAll().then(render);
})();
