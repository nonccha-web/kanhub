/* KAN ERP — Google-Ads-style date range picker.
 *
 * ปุ่มเดียวแสดงช่วงที่เลือก · กดแล้วเปิด popover: preset ซ้าย + ปฏิทิน 2 เดือนขวา
 * + สลับ "เทียบช่วงก่อนหน้า" + ปุ่ม ยกเลิก/ใช้เลย
 *
 * ใช้ผ่าน KAN.DateRange.mount(hostEl, opts) — opts.onApply(from,to,compare,presetId)
 */
(function (global) {
  'use strict';

  /* self-contained — ใช้ helper ของ KAN ถ้ามี ไม่งั้นนิยามเอง(ใช้บนหน้าอื่นได้) */
  var KAN = global.KAN || {};
  var TH_MON_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                     'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _parseISO(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function _toISO(d) { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }
  function _addDays(iso, n) { var d = _parseISO(iso); d.setDate(d.getDate() + n); return _toISO(d); }
  function _diffDays(a, b) { return Math.round((_parseISO(b) - _parseISO(a)) / 86400000); }
  function _thDate(iso) {
    if (!iso) { return '—'; }
    var d = _parseISO(iso);
    return d.getDate() + ' ' + TH_MON_ABBR[d.getMonth()] + ' ' + (d.getFullYear() + 543);
  }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var addDays = KAN.addDays || _addDays,
      toISO = KAN.toISO || _toISO,
      parseISO = KAN.parseISO || _parseISO,
      diffDays = KAN.diffDays || _diffDays,
      thDate = (KAN.fmt && KAN.fmt.thDate) || _thDate,
      esc = KAN.esc || _esc;

  var TH_MONTH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                       'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  function monthOf(iso) { var d = parseISO(iso); return { y: d.getFullYear(), m: d.getMonth() }; }
  function firstOfMonth(y, m) { return toISO(new Date(y, m, 1)); }
  function lastOfMonth(y, m) { return toISO(new Date(y, m + 1, 0)); }
  function shiftMonth(mo, n) {
    var d = new Date(mo.y, mo.m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  /* preset ทั้งหมด อ้างอิงจาก "วันสุดท้ายของข้อมูล" เป็น today */
  function presets(min, max) {
    var mo = monthOf(max);
    var prev = shiftMonth(mo, -1);
    return [
      { id: 'today',      label: 'วันนี้',        from: max, to: max },
      { id: 'yesterday',  label: 'เมื่อวาน',      from: clampLo(addDays(max, -1), min), to: addDays(max, -1) },
      { id: '7',          label: '7 วันล่าสุด',   from: clampLo(addDays(max, -6), min), to: max },
      { id: '14',         label: '14 วันล่าสุด',  from: clampLo(addDays(max, -13), min), to: max },
      { id: '21',         label: '21 วันล่าสุด',  from: clampLo(addDays(max, -20), min), to: max },
      { id: '30',         label: '30 วันล่าสุด',  from: clampLo(addDays(max, -29), min), to: max },
      { id: '90',         label: '90 วันล่าสุด',  from: clampLo(addDays(max, -89), min), to: max },
      { id: 'mtd',        label: 'เดือนนี้',      from: firstOfMonth(mo.y, mo.m), to: max },
      { id: 'lastmonth',  label: 'เดือนก่อน',     from: firstOfMonth(prev.y, prev.m), to: lastOfMonth(prev.y, prev.m) },
      { id: 'ytd',        label: 'ทั้งหมด',       from: min, to: max }
    ];
  }
  function clampLo(iso, min) { return iso < min ? min : iso; }

  function detectPreset(from, to, min, max) {
    var ps = presets(min, max);
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].from === from && ps[i].to === to) { return ps[i].id; }
    }
    return 'custom';
  }

  KAN.DateRange = {
    mount: function (host, opts) {
      var min = opts.min, max = opts.max;
      var cur = { from: opts.from, to: opts.to, compare: !!opts.compare };
      var open = false, pop = null;
      var draft;   // working copy while popover open

      function label() {
        return thDate(cur.from) + ' – ' + thDate(cur.to);
      }
      function renderButton() {
        var pid = detectPreset(cur.from, cur.to, min, max);
        var pname = pid === 'custom' ? 'กำหนดเอง'
          : (presets(min, max).filter(function (p) { return p.id === pid; })[0] || {}).label;
        host.innerHTML =
          '<button type="button" class="dr-btn' + (open ? ' open' : '') + '" id="drBtn">' +
            '<span class="dr-cal">🗓</span>' +
            '<span class="dr-txt"><b>' + esc(pname) + '</b><small>' + esc(label()) +
            (cur.compare ? ' · เทียบช่วงก่อน' : '') + '</small></span>' +
            '<span class="dr-caret">▾</span>' +
          '</button>';
        document.getElementById('drBtn').addEventListener('click', toggle);
      }

      function toggle() { open ? close() : openPop(); }

      function openPop() {
        open = true;
        draft = { from: cur.from, to: cur.to, compare: cur.compare, sel: 'from',
                  view: shiftMonth(monthOf(cur.to), -1) };
        /* กันปฏิทินขวาหลุดเกินขอบข้อมูล */
        if (firstOfMonth(draft.view.y, draft.view.m) < firstOfMonth(monthOf(min).y, monthOf(min).m)) {
          draft.view = monthOf(min);
        }
        pop = document.createElement('div');
        pop.className = 'dr-pop';
        /* ต่อ popover เป็นลูกของ host โดยไม่ re-render ปุ่ม (จะได้ไม่ลบ popover ทิ้ง) */
        host.appendChild(pop);
        var btn = host.querySelector('.dr-btn');
        if (btn) { btn.classList.add('open'); }
        drawPop();
        setTimeout(function () { document.addEventListener('mousedown', onOutside); }, 0);
      }
      function close() {
        open = false;
        if (pop && pop.parentNode) { pop.parentNode.removeChild(pop); }
        pop = null;
        document.removeEventListener('mousedown', onOutside);
        var btn = host.querySelector('.dr-btn');
        if (btn) { btn.classList.remove('open'); }
      }
      function onOutside(e) {
        var btn = host.querySelector('.dr-btn');
        if (pop && !pop.contains(e.target) && (!btn || !btn.contains(e.target))) {
          close();
        }
      }

      function drawPop() {
        var ps = presets(min, max);
        var activePid = detectPreset(draft.from, draft.to, min, max);
        var left = '<div class="dr-presets">' + ps.map(function (p) {
          return '<button type="button" class="dr-preset' + (p.id === activePid ? ' on' : '') +
            '" data-id="' + p.id + '">' + esc(p.label) + '</button>';
        }).join('') +
          '<button type="button" class="dr-preset' + (activePid === 'custom' ? ' on' : '') +
          '" data-id="custom">กำหนดเอง</button></div>';

        var m0 = draft.view, m1 = shiftMonth(m0, 1);
        var right =
          '<div class="dr-right">' +
            '<div class="dr-fields">' +
              '<div class="dr-field"><label>ตั้งแต่</label>' +
                '<input type="date" id="drFrom" value="' + draft.from + '" min="' + min + '" max="' + max + '"></div>' +
              '<span class="dr-dash">–</span>' +
              '<div class="dr-field"><label>ถึง</label>' +
                '<input type="date" id="drTo" value="' + draft.to + '" min="' + min + '" max="' + max + '"></div>' +
            '</div>' +
            '<div class="dr-cals">' +
              calendarHTML(m0, 'prev', canPrev(m0)) +
              calendarHTML(m1, 'next', canNext(m1)) +
            '</div>' +
            '<div class="dr-foot">' +
              (opts.hideCompare ? ''
                : '<label class="dr-compare"><input type="checkbox" id="drCmp"' + (draft.compare ? ' checked' : '') +
                  '><span class="dr-switch"></span> เทียบกับช่วงก่อนหน้า</label>') +
              '<span style="flex:1"></span>' +
              '<button type="button" class="dr-cancel" id="drCancel">ยกเลิก</button>' +
              '<button type="button" class="dr-apply" id="drApply">ใช้เลย</button>' +
            '</div>' +
          '</div>';

        pop.innerHTML = left + right;
        wirePop();
      }

      function canPrev(m0) { return firstOfMonth(m0.y, m0.m) > firstOfMonth(monthOf(min).y, monthOf(min).m); }
      function canNext(m1) { return firstOfMonth(m1.y, m1.m) < firstOfMonth(monthOf(max).y, monthOf(max).m); }

      function calendarHTML(mo, navSide, navEnabled) {
        var first = new Date(mo.y, mo.m, 1);
        var lead = first.getDay();
        var dim = new Date(mo.y, mo.m + 1, 0).getDate();
        var prevBtn = navSide === 'prev'
          ? '<button type="button" class="dr-nav" id="drPrev"' + (navEnabled ? '' : ' disabled') + '>‹</button>'
          : '<span class="dr-nav-sp"></span>';
        var nextBtn = navSide === 'next'
          ? '<button type="button" class="dr-nav" id="drNext"' + (navEnabled ? '' : ' disabled') + '>›</button>'
          : '<span class="dr-nav-sp"></span>';
        var h = '<div class="dr-cal-m"><div class="dr-cal-h">' + prevBtn +
          '<span class="dr-cal-title">' + esc(TH_MONTH_FULL[mo.m]) + ' ' + (mo.y + 543) + '</span>' +
          nextBtn + '</div><div class="dr-grid">';
        DOW.forEach(function (d) { h += '<div class="dr-dow">' + d + '</div>'; });
        for (var i = 0; i < lead; i++) { h += '<div class="dr-day empty"></div>'; }
        for (var day = 1; day <= dim; day++) {
          var iso = toISO(new Date(mo.y, mo.m, day));
          var cls = 'dr-day';
          var disabled = iso < min || iso > max;
          if (disabled) { cls += ' disabled'; }
          else {
            if (iso === draft.from) { cls += ' start'; }
            if (iso === draft.to) { cls += ' end'; }
            if (draft.from && draft.to && iso > draft.from && iso < draft.to) { cls += ' inrange'; }
            if (iso === draft.from && iso === draft.to) { cls += ' single'; }
            if (iso === max) { cls += ' today'; }
          }
          h += '<div class="' + cls + '"' + (disabled ? '' : ' data-iso="' + iso + '"') + '>' + day + '</div>';
        }
        h += '</div></div>';
        return h;
      }

      function pickDay(iso) {
        if (draft.sel === 'from' || (draft.from && draft.to)) {
          draft.from = iso; draft.to = iso; draft.sel = 'to';
        } else {
          if (iso >= draft.from) { draft.to = iso; }
          else { draft.to = draft.from; draft.from = iso; }
          draft.sel = 'from';
        }
        drawPop();
      }

      function wirePop() {
        pop.querySelectorAll('.dr-preset').forEach(function (b) {
          b.addEventListener('click', function () {
            var id = this.getAttribute('data-id');
            if (id === 'custom') { return; }
            var p = presets(min, max).filter(function (x) { return x.id === id; })[0];
            draft.from = p.from; draft.to = p.to;
            draft.view = shiftMonth(monthOf(draft.to), -1);
            if (!canPrev(shiftMonth(draft.view, 1)) && draft.view.m !== monthOf(min).m) { /* keep */ }
            if (firstOfMonth(draft.view.y, draft.view.m) < firstOfMonth(monthOf(min).y, monthOf(min).m)) {
              draft.view = monthOf(min);
            }
            drawPop();
          });
        });
        pop.querySelectorAll('.dr-day[data-iso]').forEach(function (d) {
          d.addEventListener('click', function () { pickDay(this.getAttribute('data-iso')); });
        });
        var prev = document.getElementById('drPrev'), next = document.getElementById('drNext');
        if (prev) prev.addEventListener('click', function () { draft.view = shiftMonth(draft.view, -1); drawPop(); });
        if (next) next.addEventListener('click', function () { draft.view = shiftMonth(draft.view, 1); drawPop(); });
        document.getElementById('drFrom').addEventListener('change', function () {
          if (!this.value) return;
          draft.from = this.value;
          if (draft.to < draft.from) { draft.to = draft.from; }
          draft.view = shiftMonth(monthOf(draft.from), 0); drawPop();
        });
        document.getElementById('drTo').addEventListener('change', function () {
          if (!this.value) return;
          draft.to = this.value;
          if (draft.to < draft.from) { draft.from = draft.to; }
          drawPop();
        });
        var cmpEl = document.getElementById('drCmp');
        if (cmpEl) { cmpEl.addEventListener('change', function () { draft.compare = this.checked; }); }
        document.getElementById('drCancel').addEventListener('click', close);
        document.getElementById('drApply').addEventListener('click', function () {
          cur.from = draft.from; cur.to = draft.to; cur.compare = draft.compare;
          close();
          renderButton();   /* อัปเดตป้ายบนปุ่มหลังปิด popover */
          opts.onApply(cur.from, cur.to, cur.compare, detectPreset(cur.from, cur.to, min, max));
        });
      }

      renderButton();
      return {
        set: function (o) { cur.from = o.from; cur.to = o.to; cur.compare = o.compare; renderButton(); }
      };
    }
  };

  /* เผยแพร่ให้หน้าอื่น ๆ ที่ไม่มี KAN เรียกใช้ได้ (เช่น รายงานการรับสาย) */
  global.KANDateRange = KAN.DateRange;

}(window));
