/* KAN ERP — shell: sidebar, global filter bar, hash router. */
(function (global) {
  'use strict';

  var KAN = global.KAN, UI = KAN.UI, fmt = KAN.fmt, esc = KAN.esc, D = KAN.D;

  var current = 'overview';

  /* ── sidebar ───────────────────────────────────────────────────────────── */

  function renderNav() {
    var host = document.getElementById('sideHost');
    if (!host || !global.ERP_MENU) { return; }
    var nErr = KAN.anomalyCount('error');
    host.innerHTML = global.ERP_MENU.render({
      ctx: 'sales',
      active: 'sales:#/' + current,
      salesBase: '',
      cmoBase: '../cmo/',
      tasksBase: '../tasks/',
      sections: global.KAN_ME ? global.KAN_ME.sections : null,
      owner: !!(global.KAN_ME && global.KAN_ME.owner),
      badges: nErr ? { quality: nErr } : {}
    });
    global.ERP_MENU.wire(host);
  }

  /* ลิ้นชักเมนูบนมือถือ — ชุดเดียวกับ tasks.js / nav.js (หน้านี้เคยไม่มีเลย เมนูเลยโผล่แบบพังตอนจอแคบ) */
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-erp-toggle]')) { document.documentElement.classList.toggle('erp-open'); return; }
    if (ev.target.closest('[data-erp-close]')) { document.documentElement.classList.remove('erp-open'); return; }
    if (document.documentElement.classList.contains('erp-open') && ev.target.closest('.erp-sidebar a')) document.documentElement.classList.remove('erp-open');
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') document.documentElement.classList.remove('erp-open'); });

  /* รู้ว่าใครล็อกอินอยู่ → เมนูโชว์เฉพาะหมวดที่มีสิทธิ์ (ตัวจริงกันที่ worker) */
  function loadMe() {
    fetch('/api/t/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (j) {
        if (!j || !j.me) { return; }
        global.KAN_ME = { sections: j.sections || j.me.sections || [], owner: j.me.role === 'owner', name: j.me.name };
        renderNav();
      });
  }

  /* ── global filter bar ─────────────────────────────────────────────────── */

  function renderFilters() {
    var s = KAN.state;
    var h = '<div class="frow2">';

    h += '<div class="f"><label>สาขา</label><select id="fBranch"><option value="all">ทุกสาขา</option>';
    var ADS = KAN.ADS;
    if (KAN.currentView === 'ads' && ADS && ADS.ok) {
      /* หน้ารายงานแอด: สาขาตามบัญชีโฆษณา — รวม KAN HUB (โกดัง ไม่มีบิลหน้าร้าน แต่ยิงแอดเอง)
         และสาขาที่ฝั่งยอดขายไม่มี (นคร) — นนท์ทัก 18 ก.ย. 69 ว่าไม่มีตัวกรอง KAN HUB */
      ADS.branches.forEach(function (b) {
        var v = ADS.salesIx(b.key) != null ? String(ADS.salesIx(b.key)) : 'ads:' + b.key;
        h += '<option value="' + esc(v) + '"' + (String(s.branch) === v ? ' selected' : '') + '>' + esc(b.name) + '</option>';
      });
    } else {
      D.branches.forEach(function (b, i) {
        if (b.kind !== 'store') { return; }
        h += '<option value="' + i + '"' + (String(s.branch) === String(i) ? ' selected' : '') + '>' +
             esc(b.name) + '</option>';
      });
    }
    h += '</select></div>';

    h += '<div class="f"><label>ช่วงเวลา</label><div class="dr-wrap" id="drHost"></div></div>';
    h += '</div>';

    document.getElementById('filterHost').innerHTML = h;

    document.getElementById('fBranch').addEventListener('change', function () {
      KAN.state.branch = this.value === 'all' ? 'all' : (this.value.indexOf('ads:') === 0 ? this.value : +this.value);
      render();
    });

    KAN.DateRange.mount(document.getElementById('drHost'), {
      from: s.from, to: s.to, compare: s.compare,
      min: KAN.DATA_START, max: KAN.DATA_END,
      onApply: function (from, to, compare, presetId) {
        KAN.state.from = from;
        KAN.state.to = to;
        KAN.state.compare = compare;
        KAN.state.preset = presetId;
        render();
      }
    });
  }

  /* ── render ────────────────────────────────────────────────────────────── */

  /* พาทัวร์ของหน้านี้ — ใช้ tour.js ชุดเดียวกับระบบงาน (โหลดตอนกดครั้งแรก) */
  var TOUR_OF = { ads: 'adsreport' };
  function startTour() {
    var name = TOUR_OF[KAN.currentView] || 'overview';
    var go = function () {
      if (window.KAN_TOUR && window.KAN_TOUR.has(name)) window.KAN_TOUR.start(name);
      else window.location.href = '../tasks/#/all';
    };
    if (window.KAN_TOUR) return go();
    var sc = document.createElement('script');
    sc.src = '../tasks/tour.js?v=6';
    sc.onload = go;
    sc.onerror = function () { window.location.href = '../tasks/#/all'; };
    document.head.appendChild(sc);
  }
  function render() {
    var v = KAN.views[current] || KAN.views.overview;
    var range = KAN.range();
    KAN.currentView = v.id;
    if (v.id !== 'ads') {
      var sb = KAN.state.branch;
      if (typeof sb === 'string' && sb.indexOf('ads:') === 0) { KAN.state.branch = 'all'; }
      else if (sb !== 'all' && D.branches[sb] && D.branches[sb].kind !== 'store') { KAN.state.branch = 'all'; }
    }

    document.getElementById('crumb').innerHTML =
      'KAN Admin <span style="color:var(--muted)">/</span> ' + esc(v.group) +
      ' <span style="color:var(--muted)">/</span> <b>' + esc(v.title) + '</b>';
    document.getElementById('pageTitle').textContent = v.title;
    document.getElementById('pageLead').textContent = v.lead || '';

    UI.destroyCharts();
    var host = document.getElementById('view');
    host.innerHTML = v.render(range);
    if (v.after) { v.after(range); }

    renderNav();
    /* หน้าในกลุ่ม "ระบบ" ไม่ได้อ่านตัวกรองสาขา/ช่วงเวลา — ซ่อนไปเลยกันเข้าใจผิด */
    var fh = document.getElementById('filterHost');
    if (v.noFilter) { fh.innerHTML = ''; fh.style.display = 'none'; }
    else { fh.style.display = ''; renderFilters(); }
    var tb = document.getElementById('tourBtn');
    if (tb && !tb._wired) { tb._wired = 1; tb.addEventListener('click', startTour); }
    document.getElementById('lastUpdated').innerHTML =
      '<span class="dot"></span>ข้อมูลพร้อมใช้<br>ถึง ' + fmt.thDate(D.meta.dataEnd);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* Views call this when their own controls change state. */
  KAN.rerender = render;

  function paintPro() {
    var btn = document.getElementById('proBtn');
    if (!btn) { return; }
    btn.className = 'btn pro' + (KAN.pro ? ' on' : '');
    btn.setAttribute('aria-pressed', KAN.pro ? 'true' : 'false');
    btn.innerHTML = '<span class="pro-dot"></span>โหมดวิเคราะห์';
    btn.title = KAN.pro
      ? 'เปิดอยู่ — หน้าจอจะแสดงคำวินิจฉัยตรง ๆ เช่นแคมเปญที่ควรปิด กดเพื่อปิดโหมดก่อนเปิดให้คนอื่นดู'
      : 'ปิดอยู่ — แสดงเฉพาะตัวเลข ไม่มีคำวินิจฉัย กดเพื่อเปิดตอนดูเอง';
  }

  function routeFromHash() {
    var id = (location.hash || '').replace(/^#\/?/, '');
    if (KAN.views[id]) { current = id; }
    /* Links inside the guide jump between pages; leaving the overlay up would
     * hide the page the user just asked for. */
    if (KAN.closeGuide) { KAN.closeGuide(); }
    render();
  }

  window.addEventListener('hashchange', routeFromHash);

  function boot() {
    KAN.applyPreset('30');
    routeFromHash();
    loadMe();
    var gb = document.getElementById('guideBtn');
    if (gb) { gb.addEventListener('click', KAN.openGuide); }
    var pb = document.getElementById('proBtn');
    if (pb) {
      pb.addEventListener('click', function () { KAN.setPro(!KAN.pro); paintPro(); render(); });
    }
    paintPro();
    /* Deliberately no auto-open: the page is served over file://, where
     * localStorage does not persist reliably, so "show once" would end up
     * showing every single time. The button carries the discovery instead. */
  }

  /* สคริปต์ถูกฉีดเข้ามาหลัง ingest.boot() ซึ่งอาจเลย DOMContentLoaded ไปแล้ว —
   * ถ้ารอ event เดียวหน้าจะว่างเปล่า */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

}(window));
