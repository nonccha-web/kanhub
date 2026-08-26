/* ============================================================
   KAN ERP — ปฏิทินแคมเปญ
   static ล้วน ไม่มี backend → ข้อมูลเก็บใน localStorage ของเบราว์เซอร์
   ย้ายเครื่อง/ส่งต่อ ใช้ปุ่ม "สำรองไฟล์" / "นำเข้า" (JSON)
   ============================================================ */
(function () {
  "use strict";

  var LS_KEY = "kan-campaign-calendar";
  var MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  var MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  var DOW = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  var CHANNELS = ["หน้าร้าน","Facebook","LINE","TikTok","Shopee/Lazada","ขายส่ง"];
  var BRANCHES = ["KAN HUB","ชุมพร","นคร","สุราษฎร์","Kan Fashion"];
  var STATUS_LABEL = { plan:"วางแผน", live:"กำลังทำ", done:"จบแล้ว" };

  var items = load();
  var year = new Date().getFullYear();
  var view = { mode:"year", month:null };
  var editingId = null;
  var toastTimer;

  /* ---------- storage ---------- */
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (raw && Array.isArray(raw.items)) return raw.items;
    } catch (e) {}
    return [];
  }
  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ version:1, savedAt:new Date().toISOString(), items:items }));
      return true;
    } catch (e) { return false; }
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
  function fmtRange(it) {
    var a = parseISO(it.start), txt = a.getDate() + " " + MONTHS_SHORT[a.getMonth()];
    if (it.end && it.end !== it.start) {
      var b = parseISO(it.end);
      txt += " – " + b.getDate() + " " + MONTHS_SHORT[b.getMonth()];
      if (b.getFullYear() !== a.getFullYear()) txt += " " + String(be(b.getFullYear())).slice(2);
    }
    return txt;
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
  function $(id) { return document.getElementById(id); }

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
      var todays = list.filter(function (it) { return covers(it, dISO); });
      var chips = todays.slice(0, 3).map(function (it) {
        return '<button class="cc-chip ' + it.status + '" data-edit="' + it.id + '" title="' + esc(it.name) + '"><b>' + esc(it.name) + "</b></button>";
      }).join("");
      if (todays.length > 3) chips += '<span class="cc-more">+ อีก ' + (todays.length - 3) + "</span>";
      // เซลล์ต้องไม่เป็น <button> เพราะ chip ข้างในก็เป็นปุ่ม — ปุ่มซ้อนปุ่มทำให้เบราว์เซอร์ตัดโครงทิ้ง
      cells += '<div class="cc-cell' + (dow === 0 || dow === 6 ? " we" : "") + (dISO === tISO ? " today" : "") +
               '" data-day="' + dISO + '" role="button" tabindex="0"><span class="cc-dnum">' + d + "</span>" + chips + "</div>";
    }
    var tail = (7 - ((lead + days) % 7)) % 7;
    for (var j = 1; j <= tail; j++) cells += '<div class="cc-cell out"><span class="cc-dnum">' + j + "</span></div>";

    $("ccView").innerHTML =
      '<div class="cc-monthbar">' +
        '<button class="cc-back" id="ccBack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>ทั้งปี ' + be(year) + "</button>" +
        "<h2>" + MONTHS[m] + " " + be(year) + "</h2>" +
        '<span style="font-size:13px;color:var(--text-muted)">' + (list.length ? list.length + " แคมเปญ" : "ยังไม่มีแคมเปญ") + "</span>" +
      "</div>" +
      '<div class="cc-cal"><div class="cc-dow">' + DOW.map(function (x) { return "<div>" + x + "</div>"; }).join("") +
      '</div><div class="cc-grid">' + cells + "</div></div>";
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
      return "<tr>" +
        '<td class="dt">' + fmtRange(it) + "</td>" +
        '<td class="nm">' + esc(it.name) + (it.note ? '<div class="cc-note">' + esc(it.note) + "</div>" : "") + "</td>" +
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

  /* ---------- drawer ---------- */
  function buildChoices() {
    $("cc-channels").innerHTML = CHANNELS.map(function (c) {
      return '<button type="button" class="cc-choice" data-choice="channel" data-v="' + esc(c) + '" aria-pressed="false">' + esc(c) + "</button>";
    }).join("");
    $("cc-branches").innerHTML = BRANCHES.map(function (b) {
      return '<button type="button" class="cc-choice" data-choice="branch" data-v="' + esc(b) + '" aria-pressed="false">' + esc(b) + "</button>";
    }).join("");
  }
  function setSeg(v) {
    Array.prototype.forEach.call(document.querySelectorAll("#cc-status button"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === v));
    });
  }
  function getSeg() {
    var on = document.querySelector('#cc-status button[aria-pressed="true"]');
    return on ? on.dataset.v : "plan";
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
  function openDrawer(item, presetDate) {
    editingId = item ? item.id : null;
    $("ccDrawerTitle").textContent = item ? "แก้ไขแคมเปญ" : "เพิ่มแคมเปญ";
    $("cc-name").value = item ? item.name : "";
    $("cc-start").value = item ? item.start : (presetDate || todayISO());
    $("cc-end").value = item ? (item.end || "") : "";
    $("cc-budget").value = item && item.budget ? item.budget : "";
    $("cc-owner").value = item ? (item.owner || "") : "";
    $("cc-note").value = item ? (item.note || "") : "";
    $("ccErr").textContent = "";
    setSeg(item ? item.status : "plan");
    setChoices("channel", item ? item.channels : []);
    setChoices("branch", item ? item.branches : []);
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
  }

  function submit() {
    var name = $("cc-name").value.trim(), start = $("cc-start").value, end = $("cc-end").value;
    if (!name) { $("ccErr").textContent = "ใส่ชื่อแคมเปญก่อน"; $("cc-name").focus(); return; }
    if (!start) { $("ccErr").textContent = "เลือกวันเริ่ม"; return; }
    if (end && end < start) { $("ccErr").textContent = "วันสิ้นสุดต้องไม่มาก่อนวันเริ่ม"; return; }

    var data = {
      name: name, start: start, end: end || start, status: getSeg(),
      channels: getChoices("channel"), branches: getChoices("branch"),
      budget: Number($("cc-budget").value) || 0,
      owner: $("cc-owner").value.trim(),
      note: $("cc-note").value.trim()
    };

    if (editingId) {
      items = items.map(function (it) { return it.id === editingId ? Object.assign({}, it, data) : it; });
      closeDrawer();
      done("แก้ไขแล้ว");
    } else {
      data.id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      items.push(data);
      year = parseISO(start).getFullYear();
      closeDrawer();
      done("เพิ่มแคมเปญแล้ว");
    }
  }
  function removeItem() {
    var it = byId(editingId);
    if (!it) return;
    if (!confirm('ลบ "' + it.name + '" ออกจากปฏิทิน?')) return;
    items = items.filter(function (x) { return x.id !== editingId; });
    closeDrawer();
    done("ลบแล้ว");
  }
  function done(msg) {
    var ok = persist();
    render();
    toast(ok ? msg : msg + " (เบราว์เซอร์บล็อกการบันทึก — กดสำรองไฟล์ไว้ก่อน)");
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
    var blob = new Blob([JSON.stringify({ version:1, savedAt:new Date().toISOString(), items:items }, null, 2)],
                        { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kan-campaigns-" + todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("ดาวน์โหลดไฟล์สำรองแล้ว");
  }
  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var incoming;
      try {
        var parsed = JSON.parse(String(reader.result));
        incoming = Array.isArray(parsed) ? parsed : parsed.items;
      } catch (e) { toast("ไฟล์นี้อ่านไม่ได้ ต้องเป็นไฟล์สำรองจากหน้านี้"); return; }
      if (!Array.isArray(incoming)) { toast("ไฟล์นี้ไม่มีข้อมูลแคมเปญ"); return; }
      if (items.length && !confirm("นำเข้า " + incoming.length + " แคมเปญ ทับของเดิม " + items.length + " รายการ?")) return;
      items = incoming.filter(function (x) { return x && x.name && x.start; }).map(function (x) {
        return {
          id: x.id || ("c" + Math.random().toString(36).slice(2, 10)),
          name: String(x.name), start: x.start, end: x.end || x.start,
          status: STATUS_LABEL[x.status] ? x.status : "plan",
          channels: Array.isArray(x.channels) ? x.channels : [],
          branches: Array.isArray(x.branches) ? x.branches : [],
          budget: Number(x.budget) || 0, owner: x.owner || "", note: x.note || ""
        };
      });
      done("นำเข้า " + items.length + " แคมเปญแล้ว");
    };
    reader.readAsText(file);
  }

  /* ---------- events ---------- */
  $("ccAdd").addEventListener("click", function () { openDrawer(null, null); });
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
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && $("ccDrawer").classList.contains("open")) submit();
  });
  document.addEventListener("click", function (e) {
    var seg = e.target.closest("#cc-status button");
    if (seg) { setSeg(seg.dataset.v); return; }
    var ch = e.target.closest("[data-choice]");
    if (ch) { ch.setAttribute("aria-pressed", ch.getAttribute("aria-pressed") === "true" ? "false" : "true"); return; }
    var ed = e.target.closest("[data-edit]");
    if (ed) { e.stopPropagation(); var it = byId(ed.dataset.edit); if (it) openDrawer(it, null); return; }
    var mo = e.target.closest("[data-month]");
    if (mo) { view = { mode:"month", month:+mo.dataset.month }; render(); window.scrollTo({ top:0, behavior:"smooth" }); return; }
    if (e.target.closest("#ccBack")) { view = { mode:"year", month:null }; render(); return; }
    var day = e.target.closest("[data-day]");
    if (day) { openDrawer(null, day.dataset.day); return; }
    if (e.target.closest("[data-new]")) { openDrawer(null, view.mode === "month" ? iso(year, view.month, 1) : null); return; }
  });

  buildChoices();
  render();
})();
