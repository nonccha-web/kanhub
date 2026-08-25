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
      badges: nErr ? { quality: nErr } : {}
    });
    global.ERP_MENU.wire(host);
  }

  /* ── global filter bar ─────────────────────────────────────────────────── */

  function renderFilters() {
    var s = KAN.state;
    var h = '<div class="frow2">';

    h += '<div class="f"><label>สาขา</label><select id="fBranch"><option value="all">ทุกสาขา</option>';
    D.branches.forEach(function (b, i) {
      if (b.kind !== 'store') { return; }
      h += '<option value="' + i + '"' + (String(s.branch) === String(i) ? ' selected' : '') + '>' +
           esc(b.name) + '</option>';
    });
    h += '</select></div>';

    h += '<div class="f"><label>ช่วงเวลา</label><div class="dr-wrap" id="drHost"></div></div>';
    h += '</div>';

    document.getElementById('filterHost').innerHTML = h;

    document.getElementById('fBranch').addEventListener('change', function () {
      KAN.state.branch = this.value === 'all' ? 'all' : +this.value;
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

  function render() {
    var v = KAN.views[current] || KAN.views.overview;
    var range = KAN.range();
    KAN.currentView = v.id;

    document.getElementById('crumb').innerHTML =
      'KAN MKT <span style="color:#D3D6E2">/</span> ' + esc(v.group) +
      ' <span style="color:#D3D6E2">/</span> <b>' + esc(v.title) + '</b>';
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
