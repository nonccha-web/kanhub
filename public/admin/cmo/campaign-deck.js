/* ============================================================
   KAN ERP — สไลด์แผนแคมเปญ
   ดึงจาก /api/campaigns (ชุดเดียวกับหน้าปฏิทิน) แล้วกรองตามสถานที่
   เปิดตรงได้: campaign-deck.html?place=สหไทย  (หรือ ?place=all)
   ปุ่มลูกศร / เว้นวรรค / คลิก เพื่อเลื่อนสไลด์ · F = เต็มจอ · Esc = ออก
   ============================================================ */
(function () {
  "use strict";

  var API = "/api";
  var MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  var MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  var STATUS_LABEL = { plan:"วางแผน", live:"กำลังทำ", done:"จบแล้ว" };
  var PLACES = ["Kan Hub","Kan Fashion","สุราษฎร์","ชุมพร","นคร","Central","สหไทย"];
  var OUTSIDE = { "Central":1, "สหไทย":1 };
  var DEFAULT_COLOR = "#3370FF";

  var all = [];
  var list = [];
  var place = "";
  var idx = 0;
  var picIdx = {};        // รูปที่กำลังโชว์ของแต่ละสไลด์

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  function parseISO(s) { var p = String(s || "").split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function be(y) { return y + 543; }
  function baht(n) { return Number(n || 0).toLocaleString("th-TH"); }
  function colorOf(it) { return /^#[0-9a-fA-F]{6}$/.test(it.color || "") ? it.color : DEFAULT_COLOR; }
  function isMonthPlan(it) { return it.scope === "month"; }

  function shortName(name) { return String(name).replace(/^[^·]{0,40}#\d+\s*·\s*/, ""); }

  function fullRange(it) {
    var a = parseISO(it.start), b = parseISO(it.end || it.start);
    if (isMonthPlan(it) && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return "ตลอดเดือน" + MONTHS[a.getMonth()] + " " + be(a.getFullYear());
    }
    if (a.getTime() === b.getTime()) return a.getDate() + " " + MONTHS[a.getMonth()] + " " + be(a.getFullYear());
    var sameY = a.getFullYear() === b.getFullYear();
    return a.getDate() + " " + MONTHS[a.getMonth()] + (sameY ? "" : " " + be(a.getFullYear())) +
           " – " + b.getDate() + " " + MONTHS[b.getMonth()] + " " + be(b.getFullYear());
  }
  function shortRange(it) {
    var a = parseISO(it.start), b = parseISO(it.end || it.start);
    if (isMonthPlan(it) && a.getMonth() === b.getMonth()) return "ทั้งเดือน" + MONTHS_SHORT[a.getMonth()];
    if (a.getTime() === b.getTime()) return a.getDate() + " " + MONTHS_SHORT[a.getMonth()];
    return a.getDate() + " " + MONTHS_SHORT[a.getMonth()] + " – " + b.getDate() + " " + MONTHS_SHORT[b.getMonth()];
  }

  /* ---------- โหลดข้อมูล ---------- */
  function load() {
    return fetch(API + "/campaigns").then(function (r) {
      if (!r.ok) throw new Error("โหลดข้อมูลไม่ได้");
      return r.json();
    }).then(function (d) {
      all = (d.campaigns || []).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    });
  }

  function forPlace(p) {
    if (!p || p === "all") return all.slice();
    return all.filter(function (c) { return (c.branches || []).indexOf(p) !== -1; });
  }

  /* ---------- หน้าเลือกสถานที่ ---------- */
  function renderPick() {
    var grid = $("pickGrid");
    var cards = PLACES.map(function (p) {
      var n = forPlace(p).length;
      return '<button class="pick-card" data-place="' + esc(p) + '">' +
             "<b>" + esc(p) + "</b>" +
             "<span>" + (OUTSIDE[p] ? "ห้างข้างนอก" : "สาขาเรา") + "</span>" +
             '<span class="n">' + (n ? n + " แคมเปญ" : "ยังไม่มีแผน") + "</span></button>";
    }).join("");
    cards += '<button class="pick-card all" data-place="all"><b>ดูทั้งหมด</b>' +
             "<span>ทุกสถานที่รวมกัน</span>" +
             '<span class="n">' + all.length + " แคมเปญ</span></button>";
    grid.innerHTML = cards;
    $("pickSub").textContent = all.length
      ? "เลือกว่าจะเปิดให้ใครดู แล้วกดเข้าโหมดสไลด์ได้เลย"
      : "ยังไม่มีแคมเปญในระบบ — ไปเพิ่มที่หน้าปฏิทินก่อน";
  }

  /* ---------- สร้างสไลด์ ---------- */
  function buildSlides() {
    var label = (place === "all" || !place) ? "ทุกสถานที่" : place;
    var total = list.reduce(function (s, c) { return s + (Number(c.budget) || 0); }, 0);
    var first = list[0], last = list[list.length - 1];
    var span = first ? (shortRange(first).split(" – ")[0] + " – " +
      (function () { var b = parseISO(last.end || last.start);
        return b.getDate() + " " + MONTHS_SHORT[b.getMonth()] + " " + be(b.getFullYear()); })()) : "";

    var html = "";

    /* 1) ปก */
    html += '<section class="slide cover on">' +
      '<img class="logo" src="../assets/kan-logo.png" alt="KAN">' +
      '<div class="eyebrow">แผนกิจกรรม KAN</div>' +
      "<h1>" + esc(label) + "</h1>" +
      "<h2>" + esc(span) + "</h2>" +
      '<div class="stats">' +
        '<div class="stat"><b>' + list.length + "</b><span>แคมเปญ</span></div>" +
        '<div class="stat"><b>' + monthsCovered() + "</b><span>เดือนที่มีกิจกรรม</span></div>" +
        (total ? '<div class="stat"><b>฿ ' + baht(total) + "</b><span>งบรวม</span></div>" : "") +
      "</div></section>";

    /* 2) ไทม์ไลน์รวม */
    html += '<section class="slide tl">' +
      "<h2>ภาพรวมทั้งแผน</h2>" +
      '<div class="tl-rows">' + list.map(function (c) {
        return '<div class="tl-row">' +
          '<div class="tl-when">' + esc(shortRange(c)) + "</div>" +
          '<div class="tl-bar" style="background:' + colorOf(c) + '">' +
            "<b>" + esc(shortName(c.name)) + "</b>" +
            "<span>" + esc((c.branches || []).join(" · ")) + "</span>" +
          "</div></div>";
      }).join("") + "</div></section>";

    /* 3..N) รายแคมเปญ */
    list.forEach(function (c, i) {
      var atts = c.attachments || [];
      picIdx[i] = 0;
      var pic = atts.length
        ? '<img src="' + API + "/attachments/" + atts[0].id + '" alt="" data-pic="' + i + '">' +
          (atts.length > 1 ? '<div class="dots" data-dots="' + i + '">' +
            atts.map(function (_, k) { return '<i class="' + (k === 0 ? "on" : "") + '"></i>'; }).join("") + "</div>" : "")
        : '<div class="none">ยังไม่มีรูปสำหรับแคมเปญนี้</div>';

      html += '<section class="slide camp" data-camp="' + i + '">' +
        '<div class="camp-pic" data-picwrap="' + i + '">' + pic + "</div>" +
        '<div class="camp-body">' +
          '<div class="camp-num">แคมเปญที่ ' + (i + 1) + " จาก " + list.length + "</div>" +
          '<div class="camp-tag"><i style="background:' + colorOf(c) + '"></i>' +
            esc((c.branches || []).join(" · ") || "ยังไม่ระบุสถานที่") + "</div>" +
          "<h2>" + esc(shortName(c.name)) + "</h2>" +
          '<div class="camp-when">' + esc(fullRange(c)) + "</div>" +
          '<div class="camp-meta">' +
            '<span class="status ' + c.status + '">' + STATUS_LABEL[c.status] + "</span>" +
            (c.channels || []).map(function (ch) { return '<span class="chip b">' + esc(ch) + "</span>"; }).join("") +
            (c.budget ? '<span class="chip">งบ ฿ ' + baht(c.budget) + "</span>" : "") +
            (c.owner ? '<span class="chip">' + esc(c.owner) + "</span>" : "") +
          "</div>" +
          (c.note ? '<div class="camp-note">' + esc(c.note) + "</div>" : "") +
        "</div></section>";
    });

    $("slides").innerHTML = html;
    idx = 0;
    show(0);
  }

  function monthsCovered() {
    var seen = {};
    list.forEach(function (c) {
      var a = parseISO(c.start), b = parseISO(c.end || c.start);
      var y = a.getFullYear(), m = a.getMonth();
      while (y < b.getFullYear() || (y === b.getFullYear() && m <= b.getMonth())) {
        seen[y + "-" + m] = 1;
        m++; if (m > 11) { m = 0; y++; }
      }
    });
    return Object.keys(seen).length;
  }

  function slides() { return $("slides").querySelectorAll(".slide"); }

  function show(i) {
    var s = slides();
    if (!s.length) return;
    idx = Math.max(0, Math.min(s.length - 1, i));
    for (var k = 0; k < s.length; k++) s[k].classList.toggle("on", k === idx);
    $("deckPos").textContent = (idx + 1) + " / " + s.length;
    $("progress").style.width = ((idx + 1) / s.length * 100) + "%";
    $("btnPrev").disabled = idx === 0;
    $("btnNext").disabled = idx === s.length - 1;
  }
  function next() { show(idx + 1); }
  function prev() { show(idx - 1); }

  /* สลับรูปในสไลด์แคมเปญ (คลิกที่รูป) */
  function cyclePic(i) {
    var c = list[i];
    var atts = (c && c.attachments) || [];
    if (atts.length < 2) return;
    picIdx[i] = (picIdx[i] + 1) % atts.length;
    var img = document.querySelector('[data-pic="' + i + '"]');
    if (img) img.src = API + "/attachments/" + atts[picIdx[i]].id;
    var dots = document.querySelector('[data-dots="' + i + '"]');
    if (dots) {
      var ds = dots.querySelectorAll("i");
      for (var k = 0; k < ds.length; k++) ds[k].classList.toggle("on", k === picIdx[i]);
    }
  }

  function enterDeck(p) {
    place = p;
    list = forPlace(p);
    if (!list.length) {
      alert((p === "all" ? "ยังไม่มีแคมเปญในระบบ" : "ยังไม่มีแผนของ " + p) + " — ไปเพิ่มที่หน้าปฏิทินก่อน");
      return;
    }
    $("pick").style.display = "none";
    $("deck").classList.add("on");
    $("deckWhere").innerHTML = esc(p === "all" ? "ทุกสถานที่" : p) +
      "<em>" + list.length + " แคมเปญ</em>";
    buildSlides();
    try {
      var u = new URL(location.href);
      u.searchParams.set("place", p);
      history.replaceState(null, "", u);
    } catch (e) {}
  }

  function exitDeck() {
    $("deck").classList.remove("on");
    $("pick").style.display = "";
    try {
      var u = new URL(location.href);
      u.searchParams.delete("place");
      history.replaceState(null, "", u);
    } catch (e) {}
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (e) {
    var card = e.target.closest("[data-place]");
    if (card) { enterDeck(card.dataset.place); return; }
    if (e.target.closest("#btnNext")) { next(); return; }
    if (e.target.closest("#btnPrev")) { prev(); return; }
    if (e.target.closest("#btnExit")) { exitDeck(); return; }
    if (e.target.closest("#btnFull")) {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      return;
    }
    var wrap = e.target.closest("[data-picwrap]");
    if (wrap) { cyclePic(+wrap.dataset.picwrap); return; }
    /* คลิกบนเนื้อสไลด์ = ไปต่อ (ยกเว้นคลิกที่รูปซึ่งใช้สลับรูป) */
    if ($("deck").classList.contains("on") && e.target.closest(".slide")) next();
  });

  document.addEventListener("keydown", function (e) {
    if (!$("deck").classList.contains("on")) return;
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
    else if (e.key === "Home") show(0);
    else if (e.key === "End") show(slides().length - 1);
    else if (e.key === "f" || e.key === "F") $("btnFull").click();
    else if (e.key === "Escape" && !document.fullscreenElement) exitDeck();
  });

  /* ---------- start ---------- */
  load().then(function () {
    renderPick();
    var p = new URLSearchParams(location.search).get("place");
    if (p) enterDeck(p);
  }).catch(function (err) {
    $("pickSub").textContent = "โหลดข้อมูลไม่ได้: " + err.message +
      " — หน้านี้ต้องเปิดผ่าน admin.kan-hub.com";
  });
})();
