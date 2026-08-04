/* KAN ERP — shared rendering helpers (charts, cards, tables). */
(function (global) {
  'use strict';

  var KAN = global.KAN;
  var fmt = KAN.fmt, esc = KAN.esc;
  var UI = KAN.UI = {};

  if (global.Chart) {
    Chart.defaults.font.family = 'Kanit, sans-serif';
    Chart.defaults.font.size = 11.5;
    Chart.defaults.color = '#5B6172';
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation.duration = 320;
  }

  /* Charts are torn down and rebuilt per render — views are re-entrant. */
  var charts = {};
  UI.chart = function (id, config) {
    var el = document.getElementById(id);
    if (!el) { return null; }
    if (charts[id]) { charts[id].destroy(); }
    charts[id] = new Chart(el.getContext('2d'), config);
    return charts[id];
  };
  UI.destroyCharts = function () {
    Object.keys(charts).forEach(function (k) { charts[k].destroy(); delete charts[k]; });
  };

  UI.bahtAxis = {
    grid: { color: '#F1F2F7', drawTicks: false },
    border: { display: false },
    ticks: {
      padding: 8,
      callback: function (v) { return fmt.bahtK(v); },
    },
  };
  UI.catAxis = {
    grid: { display: false },
    border: { color: '#E8EAF1' },
    ticks: { maxRotation: 0, autoSkipPadding: 14 },
  };
  UI.tooltipBaht = {
    callbacks: {
      label: function (c) { return '  ' + fmt.baht(c.parsed.y != null ? c.parsed.y : c.parsed); },
    },
  };

  /* ── small builders ────────────────────────────────────────────────────── */

  UI.kpi = function (o) {
    var d = '';
    if (o.delta != null && isFinite(o.delta)) {
      d = '<span class="delta ' + fmt.deltaClass(o.delta, o.invert) + '">' +
          fmt.delta(o.delta) + '</span>';
    } else if (o.badge) {
      d = '<span class="delta flat">' + esc(o.badge) + '</span>';
    }
    return '<div class="kpi ' + (o.tone || '') + '">' +
      '<div class="h"><span>' + esc(o.label) + '</span>' + d + '</div>' +
      '<div class="n">' + o.value + '</div>' +
      (o.sub ? '<div class="s">' + o.sub + '</div>' : '') +
      '</div>';
  };

  UI.panel = function (o) {
    return '<div class="panel">' +
      (o.eyebrow ? '<div class="pt">' + esc(o.eyebrow) + '</div>' : '') +
      (o.title ? '<h3>' + esc(o.title) +
        (o.titleSub ? ' <span class="sub">' + esc(o.titleSub) + '</span>' : '') + '</h3>' : '') +
      (o.hint ? '<div class="hint">' + o.hint + '</div>' : '') +
      o.body +
      (o.foot ? '<div class="finept">' + o.foot + '</div>' : '') +
      '</div>';
  };

  UI.banner = function (kind, title, text) {
    var icon = kind === 'err' ? '⛔' : kind === 'warn' ? '⚠' : 'ℹ';
    return '<div class="banner ' + kind + '"><div class="bi">' + icon + '</div><div>' +
      (title ? '<b>' + esc(title) + '</b>' : '') + text + '</div></div>';
  };

  UI.empty = function (text) {
    return '<div class="empty">' + text + '</div>';
  };

  UI.sect = function (o) {
    return '<div class="sect" id="' + (o.id || '') + '">' +
      (o.eyebrow ? '<div class="eyebrow">' + esc(o.eyebrow) + '</div>' : '') +
      '<h2>' + esc(o.title) + '</h2>' +
      (o.lead ? '<div class="lead">' + o.lead + '</div>' : '') +
      o.body + '</div>';
  };

  UI.pill = function (g) {
    return '<span class="pill ' + g.cls + '">' + esc(g.label) + '</span>';
  };

  UI.miniBar = function (frac, tone) {
    var w = Math.max(0, Math.min(1, frac || 0)) * 100;
    return '<span class="minibar"><i style="width:' + w.toFixed(1) + '%' +
      (tone ? ';background:' + tone : '') + '"></i></span>';
  };

  UI.deltaSpan = function (v, invert) {
    if (v == null || !isFinite(v)) { return '<span class="pc" style="color:#9AA0B1">—</span>'; }
    var cls = v < 0 ? 'neg' : 'pos';
    if (invert) { cls = v < 0 ? 'pos' : 'neg'; }
    return '<span class="d ' + cls + ' pc">' + fmt.delta(v) + '</span>';
  };

  /* ── heatmap ───────────────────────────────────────────────────────────── */

  UI.heatmap = function (m, unit) {
    var flat = [];
    m.matrix.forEach(function (row) { row.forEach(function (v) { if (v > 0) { flat.push(v); } }); });
    flat.sort(function (a, b) { return a - b; });
    if (!flat.length) { return UI.empty('ไม่มีข้อมูลในช่วงที่เลือก'); }
    function q(p) { return flat[Math.min(flat.length - 1, Math.floor(flat.length * p))]; }
    var stops = [q(0.2), q(0.45), q(0.68), q(0.86)];
    var colors = ['#E6F1FB', '#B5D4F4', '#85B7EB', '#378ADD', '#185FA5'];

    function col(v) {
      if (v <= 0) { return '#F5F6FA'; }
      for (var i = 0; i < stops.length; i++) { if (v < stops[i]) { return colors[i]; } }
      return colors[4];
    }

    var h = '<div class="hmwrap"><table class="hm"><tr><th class="rowh"></th>';
    m.hours.forEach(function (hr) { h += '<th>' + hr + '</th>'; });
    h += '</tr>';
    m.matrix.forEach(function (row, i) {
      h += '<tr><th class="rowh">' + esc(m.dows[i]) + '</th>';
      row.forEach(function (v) {
        var c = col(v);
        var dark = (c === '#378ADD' || c === '#185FA5') ? ' dark' : '';
        h += '<td><div class="c' + dark + '" style="background:' + c + '" title="' +
             esc(m.dowsLong[i]) + ' ' + '" >' +
             (v > 0 ? fmt.bahtK(v).replace('฿', '') : '') + '</div></td>';
      });
      h += '</tr>';
    });
    h += '</table></div>';
    h += '<div class="finept">ตัวเลขในช่อง = ' + (unit || 'ยอดขายเฉลี่ยต่อชั่วโมงในวันนั้นของสัปดาห์') +
         ' · สีเข้ม = ขายดี</div>';
    return h;
  };

  /* ── sortable table ────────────────────────────────────────────────────── */

  /* cols: [{key, label, num, render(row), sort(row)}] */
  UI.table = function (id, cols, rows, opts) {
    opts = opts || {};
    var state = { key: opts.sortKey || cols[0].key, dir: opts.sortDir || -1 };

    function colByKey(k) {
      for (var i = 0; i < cols.length; i++) { if (cols[i].key === k) { return cols[i]; } }
      return cols[0];
    }
    function draw() {
      var c = colByKey(state.key);
      var sorted = rows.slice().sort(function (a, b) {
        var va = c.sort ? c.sort(a) : a[c.key];
        var vb = c.sort ? c.sort(b) : b[c.key];
        if (va == null) { va = -Infinity; }
        if (vb == null) { vb = -Infinity; }
        if (typeof va === 'string') { return state.dir * va.localeCompare(vb, 'th'); }
        return state.dir * (va - vb);
      });
      var h = '<table><thead><tr>';
      cols.forEach(function (col) {
        var arrow = col.key === state.key ? (state.dir < 0 ? ' ▼' : ' ▲') : ' ⇅';
        h += '<th class="sortable' + (col.num ? ' num' : '') + '" data-k="' + col.key + '">' +
             esc(col.label) + '<span class="arrow">' + arrow + '</span></th>';
      });
      h += '</tr></thead><tbody>';
      if (!sorted.length) {
        h += '<tr><td colspan="' + cols.length + '" style="text-align:center;color:#9AA0B1;padding:26px">' +
             'ไม่มีข้อมูลในช่วงที่เลือก</td></tr>';
      }
      sorted.forEach(function (r) {
        h += '<tr>';
        cols.forEach(function (col) {
          h += '<td' + (col.num ? ' class="num"' : '') + '>' + col.render(r) + '</td>';
        });
        h += '</tr>';
      });
      h += '</tbody></table>';

      var wrap = document.getElementById(id);
      if (!wrap) { return; }
      wrap.innerHTML = h;
      wrap.querySelectorAll('th.sortable').forEach(function (th) {
        th.addEventListener('click', function () {
          var k = th.getAttribute('data-k');
          if (k === state.key) { state.dir = -state.dir; } else { state.key = k; state.dir = -1; }
          draw();
        });
      });
    }
    /* The caller drops <div id> into the DOM first, then calls mount(). */
    return { mount: draw };
  };

  UI.tableShell = function (id) {
    return '<div class="tablewrap" id="' + id + '"></div>';
  };

}(window));
