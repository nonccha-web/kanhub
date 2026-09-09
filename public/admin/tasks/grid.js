/* ============================================================
   KAN — สเปรดชีตแบบ Excel (เขียนเอง ไม่พึ่งไลบรารีนอก)
   ใช้กับ "ตารางโพสต์" ให้ทีมพิมพ์ในระบบแทน Excel ได้เลย
   ------------------------------------------------------------
   ทำไมไม่ใช้ <input> ทุกช่องแบบเดิม: 470 แถว × 9 ช่อง = อินพุตสี่พันตัว
   หน้าหนืดและไม่มีทางทำ selection/ช่วง/undo ให้เหมือน Excel ได้
   ที่นี่ช่องเป็น "ข้อความล้วน" แล้วสร้างตัวแก้ไขเฉพาะช่องที่กำลังพิมพ์ช่องเดียว
   ------------------------------------------------------------
   สิ่งที่รองรับ: เลือกช่อง/ช่วง · ลูกศร 4 ทิศ · พิมพ์ทับทันที · F2/ดับเบิลคลิกแก้
   ก็อป/วางเป็นช่วง (TSV เข้ากับ Excel) · ลากมุมคัดลอกลง (วันที่ +1 วัน)
   Cmd+Z / Cmd+Shift+Z · คลิกขวาแทรก/ลบ/ทำซ้ำแถว · เรียงและกรองแบบ AutoFilter
   ตรึงหัวตารางกับคอลัมน์ซ้าย · ลากขยายคอลัมน์ (จำไว้ใน localStorage)
   ============================================================ */
(function (global) {
  'use strict';

  var LS_W = 'kan-xl-w:';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function isMac() { return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent); }
  function modKey(e) { return isMac() ? e.metaKey : e.ctrlKey; }

  /* ---------- ชั้นลอย (เมนู/ดรอปดาวน์/ปฏิทิน) — ต้องอยู่นอกตาราง ไม่งั้นโดน overflow ตัด ---------- */
  function killPop(except) {
    var list = document.querySelectorAll('.xl-pop');
    for (var i = 0; i < list.length; i++) if (list[i] !== except) list[i].remove();
  }
  function popAt(html, x, y, cls) {
    var d = document.createElement('div');
    d.className = 'xl-pop' + (cls ? ' ' + cls : '');
    d.innerHTML = html;
    document.body.appendChild(d);
    var w = d.offsetWidth, h = d.offsetHeight;
    d.style.left = Math.max(6, Math.min(x, window.innerWidth - w - 8)) + 'px';
    d.style.top = (y + h > window.innerHeight - 8 ? Math.max(8, y - h) : y) + 'px';
    return d;
  }
  document.addEventListener('mousedown', function (ev) {
    if (!ev.target.closest || !ev.target.closest('.xl-pop')) killPop();
  }, true);

  /* ---------- ตัวตาราง ---------- */
  function Grid(host, opt) {
    this.host = host;
    this.opt = opt || {};
    this.id = this.opt.id || 'grid';
    this.cols = this.opt.columns || [];
    this.rows = this.opt.rows || [];
    this.freeze = this.opt.freeze == null ? 1 : this.opt.freeze;
    this.sortBy = null;
    this.filters = {};
    this.view = [];
    this.sel = { r: 0, c: 0, r2: 0, c2: 0 };
    this.ed = null;
    this.drag = null;
    this.undoStack = [];
    this.redoStack = [];
    this.widths = {};
    try { this.widths = JSON.parse(localStorage.getItem(LS_W + this.id) || '{}'); } catch (e) {}
    this.build();
    this.ensureBlank();
    this.refresh();
  }

  Grid.prototype.colLeft = function (ci) {
    /* ตำแหน่งซ้ายของคอลัมน์ที่ตรึง = ความกว้างสะสมของคอลัมน์ก่อนหน้า + คอลัมน์เลขแถว */
    var x = 46;
    for (var i = 0; i < ci; i++) x += this.w(i);
    return x;
  };
  Grid.prototype.w = function (ci) {
    var c = this.cols[ci];
    return this.widths[c.key] || c.width || 120;
  };

  Grid.prototype.build = function () {
    var self = this;
    this.host.innerHTML =
      '<div class="xl">' +
        '<div class="xl-bar">' +
          '<div class="xl-bar-l"></div>' +
          '<div class="xl-bar-r"><span class="xl-save"></span></div>' +
        '</div>' +
        '<div class="xl-scroll"><table class="xl-tb"><colgroup></colgroup>' +
          '<thead><tr></tr></thead><tbody></tbody></table></div>' +
        '<textarea class="xl-catch" spellcheck="false" aria-hidden="true"></textarea>' +
      '</div>';
    this.el = this.host.querySelector('.xl');
    this.scroll = this.host.querySelector('.xl-scroll');
    this.table = this.host.querySelector('.xl-tb');
    this.cg = this.table.querySelector('colgroup');
    this.headRow = this.table.querySelector('thead tr');
    this.tbody = this.table.querySelector('tbody');
    this.catch_ = this.host.querySelector('.xl-catch');
    this.barL = this.host.querySelector('.xl-bar-l');
    this.saveEl = this.host.querySelector('.xl-save');

    /* คีย์บอร์ดทั้งหมดวิ่งผ่าน textarea ที่ซ่อนไว้ — ได้ทั้ง keydown, copy, paste แบบเนทีฟ */
    this.catch_.addEventListener('keydown', function (e) { self.onKey(e); });
    this.catch_.addEventListener('copy', function (e) { self.onCopy(e, false); });
    this.catch_.addEventListener('cut', function (e) { self.onCopy(e, true); });
    this.catch_.addEventListener('paste', function (e) { self.onPaste(e); });
    this.catch_.addEventListener('blur', function () { self.el.classList.remove('on'); });
    this.catch_.addEventListener('focus', function () { self.el.classList.add('on'); });

    this.tbody.addEventListener('mousedown', function (e) { self.onCellDown(e); });
    this.tbody.addEventListener('dblclick', function (e) {
      var td = e.target.closest('td'); if (!td) return;
      self.startEdit(null, true);
    });
    this.tbody.addEventListener('contextmenu', function (e) { self.rowMenu(e); });
    this.headRow.addEventListener('mousedown', function (e) { self.onHeadDown(e); });
    this.headRow.addEventListener('click', function (e) { self.onHeadClick(e); });
    this.headRow.addEventListener('contextmenu', function (e) { self.colMenu(e); });
    document.addEventListener('mousemove', function (e) { self.onMove(e); });
    document.addEventListener('mouseup', function (e) { self.onUp(e); });
    this.scroll.addEventListener('scroll', function () { if (self.ed) self.placeEditor(); });
  };

  /* ---------- แถวที่จะแสดง (กรอง + เรียง) ---------- */
  Grid.prototype.computeView = function () {
    var self = this;
    var blanks = [], keep = [];
    this.rows.forEach(function (r, i) {
      if (self.opt.isBlank && self.opt.isBlank(r)) { blanks.push(i); return; }
      var pass = true;
      Object.keys(self.filters).forEach(function (k) {
        var f = self.filters[k];
        if (!f || !pass) return;
        var col = self.col(k);
        var vals = self.filterValues(col, r);
        pass = vals.some(function (v) { return f[v]; });
      });
      if (pass) keep.push(i);
    });
    if (this.sortBy) {
      var col = this.col(this.sortBy.key), dir = this.sortBy.dir;
      keep.sort(function (a, b) {
        var x = self.sortKey(col, self.rows[a]), y = self.sortKey(col, self.rows[b]);
        if (x === y) return a - b;
        return (x < y ? -1 : 1) * dir;
      });
    }
    /* แถวว่างอยู่ท้ายเสมอ ไม่ว่าจะเรียงยังไง — ไว้พิมพ์ต่อ */
    this.view = keep.concat(blanks);
  };
  Grid.prototype.sortKey = function (col, row) {
    var v = col.sortKey ? col.sortKey(row) : this.text(col, row);
    return typeof v === 'string' ? v.toLowerCase() : v;
  };
  Grid.prototype.filterValues = function (col, row) {
    if (col.filterValues) return col.filterValues(row);
    var t = this.text(col, row);
    return [t === '' ? '(ว่าง)' : t];
  };
  Grid.prototype.col = function (key) {
    for (var i = 0; i < this.cols.length; i++) if (this.cols[i].key === key) return this.cols[i];
    return null;
  };
  Grid.prototype.colIdx = function (key) {
    for (var i = 0; i < this.cols.length; i++) if (this.cols[i].key === key) return i;
    return -1;
  };
  Grid.prototype.text = function (col, row) {
    return col.text ? (col.text(row) || '') : String(row[col.key] == null ? '' : row[col.key]);
  };
  Grid.prototype.rowAt = function (vr) { return this.rows[this.view[vr]]; };

  /* ---------- วาด ---------- */
  Grid.prototype.refresh = function (keepSel) {
    this.computeView();
    this.renderHead();
    this.renderBody();
    if (!keepSel) this.clampSel();
    this.paint();
  };
  Grid.prototype.renderHead = function () {
    var self = this;
    var cg = '<col style="width:46px">' + this.cols.map(function (c, i) {
      return '<col style="width:' + self.w(i) + 'px">';
    }).join('');
    this.cg.innerHTML = cg;
    this.headRow.innerHTML = '<th class="xl-rh xl-fz" style="left:0"></th>' +
      this.cols.map(function (c, i) {
        var st = i < self.freeze ? ' xl-fz' : '';
        var left = i < self.freeze ? ' style="left:' + self.colLeft(i) + 'px"' : '';
        var srt = self.sortBy && self.sortBy.key === c.key ? (self.sortBy.dir > 0 ? ' ▲' : ' ▼') : '';
        var on = self.filters[c.key] ? ' on' : '';
        return '<th class="xl-h' + st + '" data-c="' + i + '"' + left + '>' +
          '<span class="xl-hl">' + esc(c.label) + srt + '</span>' +
          (c.filter === false ? '' : '<button type="button" class="xl-fb' + on + '" data-filter="' + i + '" title="กรอง">▾</button>') +
          '<i class="xl-rz" data-rz="' + i + '"></i></th>';
      }).join('');
  };
  Grid.prototype.renderBody = function () {
    var self = this;
    var html = new Array(this.view.length);
    for (var vr = 0; vr < this.view.length; vr++) html[vr] = this.rowHtml(vr);
    this.tbody.innerHTML = html.join('');
  };
  Grid.prototype.rowHtml = function (vr) {
    var self = this, row = this.rowAt(vr);
    var blank = this.opt.isBlank && this.opt.isBlank(row);
    var tone = this.opt.tone ? this.opt.tone(row) : '';
    return '<tr' + (blank ? ' class="xl-new"' : '') + '>' +
      '<th class="xl-rh xl-fz" style="left:0" data-tone="' + esc(tone) + '"><span>' + (vr + 1) + '</span>' +
      '<i class="xl-st ' + esc(row._st || '') + '" title="' + esc(row._msg || '') + '"></i></th>' +
      this.cols.map(function (c, i) {
        var fz = i < self.freeze ? ' xl-fz' : '';
        var left = i < self.freeze ? ' style="left:' + self.colLeft(i) + 'px"' : '';
        return '<td class="xl-c' + fz + (c.cls ? ' ' + c.cls : '') + '" data-c="' + i + '"' + left + '>' +
          self.cellHtml(c, row) + '</td>';
      }).join('') + '</tr>';
  };
  Grid.prototype.cellHtml = function (col, row) {
    if (col.html) return col.html(row);
    return '<span class="xl-v">' + esc(this.text(col, row)) + '</span>';
  };
  Grid.prototype.cellAt = function (vr, c) {
    var tr = this.tbody.rows[vr];
    return tr ? tr.cells[c + 1] : null;
  };
  Grid.prototype.redrawRow = function (vr) {
    var tr = this.tbody.rows[vr];
    if (!tr) return;
    var tmp = document.createElement('tbody');
    tmp.innerHTML = this.rowHtml(vr);
    tr.parentNode.replaceChild(tmp.firstElementChild, tr);
    this.paint();
  };
  Grid.prototype.redrawRowByIndex = function (ri) {
    var vr = this.view.indexOf(ri);
    if (vr >= 0) this.redrawRow(vr);
  };

  /* ---------- การเลือกช่อง ---------- */
  Grid.prototype.clampSel = function () {
    var maxR = Math.max(0, this.view.length - 1), maxC = this.cols.length - 1;
    this.sel.r = clamp(this.sel.r, 0, maxR); this.sel.r2 = clamp(this.sel.r2, 0, maxR);
    this.sel.c = clamp(this.sel.c, 0, maxC); this.sel.c2 = clamp(this.sel.c2, 0, maxC);
  };
  Grid.prototype.range = function () {
    var s = this.sel;
    return { r1: Math.min(s.r, s.r2), r2: Math.max(s.r, s.r2), c1: Math.min(s.c, s.c2), c2: Math.max(s.c, s.c2) };
  };
  Grid.prototype.paint = function () {
    var old = this.el.querySelectorAll('.xl-sel, .xl-act, .xl-fh');
    for (var i = 0; i < old.length; i++) {
      if (old[i].classList.contains('xl-fh')) old[i].remove();
      else old[i].classList.remove('xl-sel', 'xl-act');
    }
    var g = this.range();
    for (var r = g.r1; r <= g.r2; r++) {
      var tr = this.tbody.rows[r];
      if (!tr) continue;
      for (var c = g.c1; c <= g.c2; c++) {
        var td = tr.cells[c + 1];
        if (td) td.classList.add('xl-sel');
      }
    }
    var act = this.cellAt(this.sel.r, this.sel.c);
    if (act) act.classList.add('xl-act');
    /* หมุดลากคัดลอกลง อยู่มุมขวาล่างของช่วงที่เลือก เหมือน Excel */
    var last = this.cellAt(g.r2, g.c2);
    if (last && !this.ed) {
      var fh = document.createElement('i');
      fh.className = 'xl-fh';
      last.appendChild(fh);
    }
    this.updateBar();
  };
  Grid.prototype.updateBar = function () {
    var g = this.range();
    var n = (g.r2 - g.r1 + 1) * (g.c2 - g.c1 + 1);
    var fkeys = Object.keys(this.filters);
    this.barL.innerHTML =
      '<button type="button" class="xl-btn" data-add="1">+ แถว</button>' +
      '<button type="button" class="xl-btn" data-add="10">+ 10 แถว</button>' +
      '<span class="xl-info">' + this.view.length + ' แถว' +
        (n > 1 ? ' · เลือก ' + n + ' ช่อง' : '') + '</span>' +
      (fkeys.length ? '<button type="button" class="xl-btn warn" data-clearf="1">ล้างตัวกรอง (' + fkeys.length + ')</button>' : '') +
      (this.sortBy ? '<button type="button" class="xl-btn warn" data-clears="1">เลิกเรียง</button>' : '');
  };
  Grid.prototype.setSel = function (r, c, extend) {
    this.clampSelTo(r, c, extend);
    this.paint();
    this.scrollTo(this.sel.r, this.sel.c);
    this.focus();
  };
  Grid.prototype.clampSelTo = function (r, c, extend) {
    var maxR = Math.max(0, this.view.length - 1), maxC = this.cols.length - 1;
    r = clamp(r, 0, maxR); c = clamp(c, 0, maxC);
    if (extend) { this.sel.r2 = r; this.sel.c2 = c; }
    else { this.sel.r = this.sel.r2 = r; this.sel.c = this.sel.c2 = c; }
  };
  Grid.prototype.scrollTo = function (r, c) {
    var td = this.cellAt(r, c);
    if (!td) return;
    var box = this.scroll.getBoundingClientRect(), cell = td.getBoundingClientRect();
    var headH = this.headRow.getBoundingClientRect().height;
    var frozenW = this.colLeft(this.freeze);
    if (cell.top < box.top + headH) this.scroll.scrollTop -= (box.top + headH - cell.top);
    else if (cell.bottom > box.bottom) this.scroll.scrollTop += (cell.bottom - box.bottom);
    if (cell.left < box.left + frozenW) this.scroll.scrollLeft -= (box.left + frozenW - cell.left);
    else if (cell.right > box.right) this.scroll.scrollLeft += (cell.right - box.right);
  };
  Grid.prototype.focus = function () {
    if (this.ed) return;
    var y = this.scroll.scrollTop, x = this.scroll.scrollLeft;
    try { this.catch_.focus({ preventScroll: true }); } catch (e) { this.catch_.focus(); }
    this.scroll.scrollTop = y; this.scroll.scrollLeft = x;
  };

  /* ---------- เมาส์ ---------- */
  Grid.prototype.onCellDown = function (e) {
    if (e.button === 2) return;                    /* คลิกขวาไปที่เมนู */
    var fh = e.target.closest('.xl-fh');
    var td = e.target.closest('td, th.xl-rh');
    if (!td) return;
    var tr = td.parentNode, vr = tr.rowIndex - 1;
    if (fh) {                                       /* เริ่มลากหมุดคัดลอก */
      e.preventDefault();
      this.commitEdit();
      this.drag = { type: 'fill', from: this.range(), to: this.range().r2 };
      return;
    }
    if (td.classList.contains('xl-rh')) {           /* คลิกเลขแถว = เลือกทั้งแถว */
      e.preventDefault();
      this.commitEdit();
      this.sel = { r: vr, c: 0, r2: vr, c2: this.cols.length - 1 };
      this.drag = { type: 'row', anchor: vr };
      this.paint(); this.focus();
      return;
    }
    var ci = +td.getAttribute('data-c');
    if (this.ed && this.ed.vr === vr && this.ed.c === ci) return;   /* คลิกในตัวแก้ไขเดิม */
    e.preventDefault();
    this.commitEdit();
    if (e.shiftKey) this.clampSelTo(vr, ci, true);
    else this.clampSelTo(vr, ci, false);
    this.drag = { type: 'cell' };
    this.paint(); this.focus();
    /* มือถือ/แท็บเล็ต: แตะแล้วพิมพ์ได้เลย ไม่ต้องแตะสองที */
    if (this.isTouch) this.startEdit(null, true);
  };
  Grid.prototype.onMove = function (e) {
    if (!this.drag) return;
    var td = document.elementFromPoint(e.clientX, e.clientY);
    td = td && td.closest ? td.closest('td, th.xl-rh') : null;
    if (!td || !this.tbody.contains(td)) return;
    var vr = td.parentNode.rowIndex - 1;
    if (this.drag.type === 'fill') {
      this.drag.to = vr;
      this.paintFill();
    } else if (this.drag.type === 'row') {
      this.sel.r2 = vr; this.sel.c = 0; this.sel.c2 = this.cols.length - 1;
      this.paint();
    } else if (this.drag.type === 'cell' && td.hasAttribute('data-c')) {
      this.clampSelTo(vr, +td.getAttribute('data-c'), true);
      this.paint();
    }
  };
  Grid.prototype.onUp = function () {
    if (!this.drag) return;
    var d = this.drag; this.drag = null;
    if (d.type === 'fill') {
      var marks = this.el.querySelectorAll('.xl-fillmark');
      for (var i = 0; i < marks.length; i++) marks[i].classList.remove('xl-fillmark');
      if (d.to !== d.from.r2) this.fillTo(d.from, d.to);
    }
  };
  Grid.prototype.paintFill = function () {
    var marks = this.el.querySelectorAll('.xl-fillmark');
    for (var i = 0; i < marks.length; i++) marks[i].classList.remove('xl-fillmark');
    var g = this.drag.from, to = this.drag.to;
    var a = Math.min(g.r2 + 1, to), b = Math.max(g.r2, to);
    if (to > g.r2) { a = g.r2 + 1; b = to; } else if (to < g.r1) { a = to; b = g.r1 - 1; } else return;
    for (var r = a; r <= b; r++) {
      for (var c = g.c1; c <= g.c2; c++) {
        var td = this.cellAt(r, c);
        if (td) td.classList.add('xl-fillmark');
      }
    }
  };

  /* ---------- คีย์บอร์ด ---------- */
  var NAV = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  Grid.prototype.onKey = function (e) {
    var k = e.key;
    if (this.ed) return;                       /* ตอนแก้ไข ตัวแก้ไขจัดการเอง */
    if (NAV[k]) {
      e.preventDefault();
      var d = NAV[k];
      if (modKey(e)) {                          /* Cmd+ลูกศร = ไปสุดทาง เหมือน Excel */
        var r = d[0] ? (d[0] > 0 ? this.view.length - 1 : 0) : this.sel.r2;
        var c = d[1] ? (d[1] > 0 ? this.cols.length - 1 : 0) : this.sel.c2;
        this.setSel(r, c, e.shiftKey);
      } else {
        this.setSel(this.sel.r2 + d[0], this.sel.c2 + d[1], e.shiftKey);
      }
      return;
    }
    if (k === 'Tab') {
      e.preventDefault();
      this.setSel(this.sel.r, this.sel.c + (e.shiftKey ? -1 : 1), false);
      return;
    }
    if (k === 'Enter' || k === 'F2') { e.preventDefault(); this.startEdit(null, true); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); this.clearRange(); return; }
    if (k === 'Escape') { e.preventDefault(); this.clampSelTo(this.sel.r, this.sel.c, false); this.paint(); return; }
    if (k === 'Home') { e.preventDefault(); this.setSel(modKey(e) ? 0 : this.sel.r2, 0, e.shiftKey); return; }
    if (k === 'End') { e.preventDefault(); this.setSel(modKey(e) ? this.view.length - 1 : this.sel.r2, this.cols.length - 1, e.shiftKey); return; }
    if (k === 'PageDown' || k === 'PageUp') {
      e.preventDefault();
      var step = Math.max(1, Math.floor(this.scroll.clientHeight / 33) - 1);
      this.setSel(this.sel.r2 + (k === 'PageDown' ? step : -step), this.sel.c2, e.shiftKey);
      return;
    }
    if (modKey(e) && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) this.doRedo(); else this.doUndo(); return; }
    if (modKey(e) && (k === 'y' || k === 'Y')) { e.preventDefault(); this.doRedo(); return; }
    if (modKey(e) && (k === 'a' || k === 'A')) {
      e.preventDefault();
      this.sel = { r: 0, c: 0, r2: this.view.length - 1, c2: this.cols.length - 1 };
      this.paint();
      return;
    }
    if (modKey(e) || e.altKey || e.ctrlKey) return;               /* ปล่อยให้ copy/paste ทำงาน */
    if (k && k.length === 1) { e.preventDefault(); this.startEdit(k, false); }
  };

  /* ---------- แก้ไขช่อง ---------- */
  Grid.prototype.startEdit = function (initial, keepValue) {
    var vr = this.sel.r, ci = this.sel.c;
    var row = this.rowAt(vr), col = this.cols[ci];
    if (!row || !col || col.readOnly) return;
    if (this.opt.canEdit && !this.opt.canEdit(row, col)) return;
    this.commitEdit();
    var td = this.cellAt(vr, ci);
    if (!td) return;
    var start = keepValue ? (col.edit ? col.edit(row) : this.text(col, row)) : (initial || '');
    td.classList.add('xl-editing');
    td.innerHTML = '<input class="xl-ed" value="' + esc(start) + '" spellcheck="false" autocomplete="off">';
    var input = td.querySelector('.xl-ed');
    this.ed = { vr: vr, c: ci, row: row, col: col, td: td, input: input, opened: !!keepValue };
    var self = this;
    input.addEventListener('keydown', function (e) { self.onEditKey(e); });
    input.addEventListener('input', function () { if (self.ed && self.ed.list) self.filterList(); });
    input.addEventListener('blur', function () { setTimeout(function () { if (self.ed && document.activeElement !== self.ed.input) self.commitEdit(); }, 120); });
    input.focus();
    if (keepValue) input.select(); else input.setSelectionRange(input.value.length, input.value.length);
    if (col.type === 'pick' || col.type === 'multi') this.openList();
    else if (col.type === 'date' && keepValue) this.openCal();
    this.paint();
  };
  Grid.prototype.placeEditor = function () { /* ตัวแก้ไขอยู่ในช่องอยู่แล้ว เลื่อนตามเอง */ };
  Grid.prototype.onEditKey = function (e) {
    var k = e.key, self = this;
    if (this.ed && this.ed.list && (k === 'ArrowDown' || k === 'ArrowUp')) {
      e.preventDefault(); this.moveList(k === 'ArrowDown' ? 1 : -1); return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      /* ช่องหลายค่าใช้ Space ติ๊ก · Enter = จบแล้วลงแถวถัดไป เหมือนช่องอื่น */
      if (this.ed && this.ed.list && this.ed.col.type !== 'multi') { this.pickList(); }
      this.commitEdit(); this.setSel(this.sel.r + 1, this.sel.c, false); return;
    }
    if (k === 'Tab') {
      e.preventDefault();
      if (this.ed && this.ed.list && this.ed.col.type !== 'multi') this.pickList();
      this.commitEdit(); this.setSel(this.sel.r, this.sel.c + (e.shiftKey ? -1 : 1), false); return;
    }
    if (k === 'Escape') { e.preventDefault(); this.cancelEdit(); this.focus(); return; }
    if (k === ' ' && this.ed && this.ed.list && this.ed.col.type === 'multi') { e.preventDefault(); this.toggleListItem(); return; }
    if ((k === 'ArrowUp' || k === 'ArrowDown') && !this.ed.opened) {
      /* พิมพ์ทับแล้วกดลูกศรขึ้นลง = ยืนยันแล้วเลื่อน เหมือน Excel */
      e.preventDefault();
      this.commitEdit();
      this.setSel(this.sel.r + (k === 'ArrowDown' ? 1 : -1), this.sel.c, false);
    }
  };
  Grid.prototype.cancelEdit = function () {
    if (!this.ed) return;
    var ed = this.ed; this.ed = null;
    killPop();
    ed.td.classList.remove('xl-editing');
    ed.td.innerHTML = this.cellHtml(ed.col, ed.row);
    this.paint();
  };
  Grid.prototype.commitEdit = function () {
    if (!this.ed) return;
    var ed = this.ed; this.ed = null;
    killPop();
    var raw = ed.input.value;
    ed.td.classList.remove('xl-editing');
    var wasBlank = this.blankSet([ed.row]);
    var res = this.applyCell(ed.row, ed.col, raw);
    ed.td.innerHTML = this.cellHtml(ed.col, ed.row);
    if (res.ok && res.cells.length) {
      this.pushUndo({ type: 'set', cells: res.cells, became: this.becameFilled(wasBlank) });
      var wasBlank = this.opt.isBlank && this.opt.isBlank(ed.row);
      this.ensureBlank();
      if (ed.col.affects || !wasBlank) this.redrawRowFor(ed.row);
      if (this.view.length !== this.tbody.rows.length) this.refresh(true);
      this.changed([ed.row]);
    } else if (!res.ok) {
      this.flash(ed.td);
    }
    this.paint();
  };
  Grid.prototype.snap = function (row, col) { return JSON.stringify(row[col.key] == null ? '' : row[col.key]); };
  /* ใส่ค่าจากข้อความ แล้วคืนรายการ before/after ของทุกช่องที่ขยับ (col.affects = ช่องพ่วง เช่น url → status)
     ต้องเก็บช่องพ่วงด้วย ไม่งั้น Cmd+Z คืนลิงก์แต่สถานะค้างเป็น "โพสต์แล้ว" */
  Grid.prototype.applyCell = function (row, col, text, asValue) {
    var self = this;
    var keys = [col.key].concat(col.affects || []);
    var before = {};
    keys.forEach(function (k) { before[k] = JSON.stringify(row[k] == null ? '' : row[k]); });
    var ok = true;
    if (asValue) {
      if (col.set) col.set(row, text); else row[col.key] = (text && text.slice ? text.slice() : text);
      if (col.after) col.after(row, text);
    } else {
      ok = this.applyText(row, col, text);
    }
    var cells = [];
    keys.forEach(function (k) {
      var after = JSON.stringify(row[k] == null ? '' : row[k]);
      if (before[k] !== after) cells.push({ ri: self.rows.indexOf(row), key: k, before: JSON.parse(before[k]), after: JSON.parse(after) });
    });
    return { ok: ok, cells: cells };
  };
  /* คืน true ถ้ารับค่าได้ · false ถ้ารูปแบบผิด (ช่องจะกระพริบแดงและคงค่าเดิม) */
  Grid.prototype.applyText = function (row, col, raw) {
    var v = col.parse ? col.parse(raw, row) : String(raw).trim();
    if (v === null || v === undefined) return String(raw).trim() === '' ? true : false;
    if (col.set) col.set(row, v); else row[col.key] = v;
    if (col.after) col.after(row, v);
    return true;
  };
  Grid.prototype.flash = function (td) {
    td.classList.add('xl-bad');
    setTimeout(function () { td.classList.remove('xl-bad'); }, 700);
  };

  /* ---------- ดรอปดาวน์ (data validation แบบ Excel) ---------- */
  Grid.prototype.openList = function () {
    var self = this, ed = this.ed;
    var opts = ed.col.options ? ed.col.options(ed.row) : [];
    var cur = ed.col.type === 'multi' ? (ed.col.get ? ed.col.get(ed.row) : (ed.row[ed.col.key] || [])) : null;
    ed.opts = opts;
    ed.picked = cur ? cur.slice() : null;
    var r = ed.td.getBoundingClientRect();
    var html = '<div class="xl-list">' + opts.map(function (o, i) {
      var on = ed.picked ? ed.picked.indexOf(o.v) !== -1 : false;
      return '<div class="xl-li' + (i === 0 ? ' on' : '') + '" data-i="' + i + '">' +
        (ed.col.type === 'multi' ? '<i class="xl-ck' + (on ? ' on' : '') + '"></i>' : '') + esc(o.label) + '</div>';
    }).join('') + '</div>';
    ed.list = popAt(html, r.left, r.bottom + 1, 'xl-listpop');
    ed.list.style.minWidth = r.width + 'px';
    ed.list.addEventListener('mousedown', function (e) {
      var li = e.target.closest('.xl-li');
      if (!li) return;
      e.preventDefault();
      var items = ed.list.querySelectorAll('.xl-li');
      for (var i = 0; i < items.length; i++) items[i].classList.toggle('on', items[i] === li);
      if (ed.col.type === 'multi') self.toggleListItem();
      else { self.pickList(); self.commitEdit(); self.setSel(self.sel.r + 1, self.sel.c, false); }
    });
    this.filterList();
  };
  Grid.prototype.filterList = function () {
    var ed = this.ed;
    if (!ed || !ed.list) return;
    if (ed.col.type === 'multi') return;
    var q = ed.input.value.trim().toLowerCase();
    var items = ed.list.querySelectorAll('.xl-li'), first = null;
    for (var i = 0; i < items.length; i++) {
      var show = !q || ed.opts[+items[i].getAttribute('data-i')].label.toLowerCase().indexOf(q) !== -1;
      items[i].style.display = show ? '' : 'none';
      items[i].classList.remove('on');
      if (show && !first) first = items[i];
    }
    if (first) first.classList.add('on');
  };
  Grid.prototype.moveList = function (d) {
    var ed = this.ed;
    var items = [];
    var all = ed.list.querySelectorAll('.xl-li');
    for (var i = 0; i < all.length; i++) if (all[i].style.display !== 'none') items.push(all[i]);
    if (!items.length) return;
    var cur = 0;
    for (var j = 0; j < items.length; j++) if (items[j].classList.contains('on')) cur = j;
    items[cur].classList.remove('on');
    var next = clamp(cur + d, 0, items.length - 1);
    items[next].classList.add('on');
    items[next].scrollIntoView({ block: 'nearest' });
  };
  Grid.prototype.listCurrent = function () {
    var ed = this.ed;
    var on = ed.list.querySelector('.xl-li.on');
    return on ? ed.opts[+on.getAttribute('data-i')] : null;
  };
  Grid.prototype.pickList = function () {
    var ed = this.ed, o = this.listCurrent();
    if (o) ed.input.value = o.label;
  };
  Grid.prototype.toggleListItem = function () {
    var ed = this.ed, o = this.listCurrent();
    if (!o) return;
    var i = ed.picked.indexOf(o.v);
    if (i === -1) ed.picked.push(o.v); else ed.picked.splice(i, 1);
    var on = ed.list.querySelector('.xl-li.on .xl-ck');
    if (on) on.classList.toggle('on', i === -1);
    ed.input.value = ed.picked.map(function (v) {
      for (var k = 0; k < ed.opts.length; k++) if (ed.opts[k].v === v) return ed.opts[k].label;
      return v;
    }).join(', ');
  };

  /* ---------- ปฏิทินเล็กสำหรับช่องวันที่ ---------- */
  Grid.prototype.openCal = function () {
    var self = this, ed = this.ed;
    var iso = ed.col.iso ? ed.col.iso(ed.row) : '';
    var base = iso ? new Date(iso + 'T00:00:00') : new Date();
    var draw = function (y, m) {
      var MON = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
      var first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
      var lead = (first.getDay() + 6) % 7;
      var h = '<div class="xl-cal"><div class="xl-calh"><button type="button" data-mv="-1">‹</button>' +
        '<b>' + MON[m] + ' ' + (y + 543) + '</b><button type="button" data-mv="1">›</button></div>' +
        '<div class="xl-calg">' + ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map(function (d) { return '<i>' + d + '</i>'; }).join('');
      for (var i = 0; i < lead; i++) h += '<span></span>';
      for (var d = 1; d <= last.getDate(); d++) {
        var ds = y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + d).slice(-2);
        h += '<button type="button" class="' + (ds === iso ? 'on' : '') + '" data-d="' + ds + '">' + d + '</button>';
      }
      return h + '</div></div>';
    };
    var r = ed.td.getBoundingClientRect();
    var y = base.getFullYear(), m = base.getMonth();
    var pop = popAt(draw(y, m), r.left, r.bottom + 1, 'xl-calpop');
    ed.cal = pop;
    pop.addEventListener('mousedown', function (e) {
      var mv = e.target.closest('[data-mv]'), day = e.target.closest('[data-d]');
      e.preventDefault();
      if (mv) { m += +mv.getAttribute('data-mv'); if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } pop.innerHTML = draw(y, m); return; }
      if (day) {
        ed.input.value = ed.col.fromIso ? ed.col.fromIso(day.getAttribute('data-d')) : day.getAttribute('data-d');
        self.commitEdit();
        self.setSel(self.sel.r + 1, self.sel.c, false);
      }
    });
  };

  /* ---------- ก็อป / วาง / ล้าง ---------- */
  Grid.prototype.rangeText = function () {
    var g = this.range(), self = this, out = [];
    for (var r = g.r1; r <= g.r2; r++) {
      var row = this.rowAt(r), line = [];
      if (!row) continue;
      for (var c = g.c1; c <= g.c2; c++) {
        var col = this.cols[c];
        line.push((col.copy ? col.copy(row) : this.text(col, row)).replace(/[\t\n\r]/g, ' '));
      }
      out.push(line.join('\t'));
    }
    return out.join('\n');
  };
  Grid.prototype.onCopy = function (e, cut) {
    if (this.ed) return;
    e.preventDefault();
    var txt = this.rangeText();
    e.clipboardData.setData('text/plain', txt);
    if (cut) this.clearRange();
    else this.toast('ก็อป ' + (this.range().r2 - this.range().r1 + 1) + ' แถวแล้ว');
  };
  Grid.prototype.onPaste = function (e) {
    if (this.ed) return;
    var cd = e.clipboardData;
    if (!cd) return;
    e.preventDefault();
    var grid = this.opt.parsePaste
      ? this.opt.parsePaste(cd.getData('text/html'), cd.getData('text/plain'))
      : null;
    if (!grid) grid = String(cd.getData('text/plain') || '').split(/\r\n|\r|\n/).map(function (l) { return l.split('\t'); });
    if (!grid || !grid.length) return;
    this.pasteGrid(grid);
  };
  Grid.prototype.pasteGrid = function (grid) {
    var g = this.range(), self = this;
    var cells = [], touched = [], added = [];
    var wasBlank = this.blankSet();
    /* คลุมหลายแถวไว้แล้ววางของแถวเดียว = ใส่ให้ครบทุกแถวที่คลุม (พฤติกรรมเดียวกับ Excel) */
    var selRows = g.r2 - g.r1 + 1;
    if (grid.length === 1 && selRows > 1) {
      var one = grid[0], rep = [];
      for (var q = 0; q < selRows; q++) rep.push(one.slice());
      grid = rep;
    }
    /* ขยายแถวให้พอ ถ้าวางเกินท้ายตาราง */
    var need = g.r1 + grid.length - this.view.length;
    for (var n = 0; n < need; n++) added.push(this.appendRow(true));
    if (need > 0) { this.computeView(); }
    grid.forEach(function (line, i) {
      var vr = g.r1 + i;
      var ri = self.view[vr];
      if (ri == null) return;
      var row = self.rows[ri];
      line.forEach(function (txt, j) {
        var ci = g.c1 + j;
        var col = self.cols[ci];
        if (!col || col.readOnly) return;
        var res = self.applyCell(row, col, txt);
        if (res.ok) cells = cells.concat(res.cells);
      });
      if (touched.indexOf(row) === -1) touched.push(row);
    });
    this.pushUndo({ type: 'set', cells: cells, added: added, became: this.becameFilled(wasBlank) });
    this.ensureBlank();
    this.refresh(true);
    this.changed(touched);
    this.toast('วาง ' + grid.length + ' แถว');
  };
  Grid.prototype.clearRange = function () {
    var g = this.range(), cells = [], touched = [], self = this;
    /* คลุมครบทั้งแถว (ซ้ายสุดถึงขวาสุด) แล้วกด Delete = ตั้งใจลบทั้งแถว ไม่ใช่แค่ล้างค่า */
    var fullRows = g.c1 === 0 && g.c2 === this.cols.length - 1;
    if (fullRows) {
      var vrs = [];
      for (var vr = g.r1; vr <= g.r2; vr++) vrs.push(vr);
      var rows = vrs.map(function (v) { return self.rowAt(v); }).filter(Boolean);
      var real = this.opt.isBlank ? rows.filter(function (r) { return !self.opt.isBlank(r); }) : rows;
      var mayDelete = !this.opt.canDelete || this.opt.canDelete();
      if (!real.length || mayDelete) {
        if (real.length && this.opt.confirmDelete && !this.opt.confirmDelete(real.length)) return;
        this.removeRows(vrs);
        this.toast(real.length ? 'ลบ ' + real.length + ' แถวแล้ว' : 'ล้างแถวว่างแล้ว');
        return;
      }
      this.toast('ลบทั้งแถวได้เฉพาะหัวหน้าทีม — ล้างเฉพาะข้อความให้แทน');
    }
    for (var r = g.r1; r <= g.r2; r++) {
      var row = this.rowAt(r);
      if (!row) continue;
      for (var c = g.c1; c <= g.c2; c++) {
        var col = this.cols[c];
        if (col.readOnly || col.noClear) continue;
        cells = cells.concat(this.applyCell(row, col, '').cells);
      }
      if (touched.indexOf(row) === -1) touched.push(row);
    }
    if (!cells.length) return;
    this.pushUndo({ type: 'set', cells: cells });
    this.refresh(true);
    this.changed(touched);
  };
  Grid.prototype.fillTo = function (g, to) {
    var cells = [], touched = [], self = this;
    var wasBlank = this.blankSet();
    var down = to > g.r2;
    var srcRows = [];
    for (var r = g.r1; r <= g.r2; r++) srcRows.push(this.rowAt(r));
    var a = down ? g.r2 + 1 : to, b = down ? to : g.r1 - 1;
    var step = 0;
    for (var vr = (down ? a : b); down ? vr <= b : vr >= a; vr += (down ? 1 : -1)) {
      step++;
      var row = this.rowAt(vr);
      if (!row) continue;
      var src = srcRows[(down ? (step - 1) : (step - 1)) % srcRows.length];
      for (var c = g.c1; c <= g.c2; c++) {
        var col = this.cols[c];
        if (col.readOnly) continue;
        var v = col.fill ? col.fill(src, down ? step : -step) : (src[col.key] != null ? src[col.key] : '');
        cells = cells.concat(this.applyCell(row, col, v, true).cells);
      }
      if (touched.indexOf(row) === -1) touched.push(row);
    }
    if (!cells.length) return;
    this.pushUndo({ type: 'set', cells: cells, became: this.becameFilled(wasBlank) });
    this.sel = { r: Math.min(g.r1, to), c: g.c1, r2: Math.max(g.r2, to), c2: g.c2 };
    this.ensureBlank();
    this.refresh(true);
    this.changed(touched);
  };

  /* ---------- undo / redo ---------- */
  Grid.prototype.blankSet = function (rows) {
    var self = this;
    if (!this.opt.isBlank) return [];
    return (rows || this.rows).filter(function (r) { return self.opt.isBlank(r); });
  };
  Grid.prototype.becameFilled = function (wasBlank) {
    var self = this;
    return (wasBlank || []).filter(function (r) { return !self.opt.isBlank(r); });
  };
  Grid.prototype.pushUndo = function (cmd) {
    if (cmd.type === 'set' && !cmd.cells.length && !(cmd.added && cmd.added.length)) return;
    this.undoStack.push(cmd);
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack.length = 0;
  };
  Grid.prototype.applyCmd = function (cmd, back) {
    var self = this, touched = [];
    if (cmd.type === 'set') {
      (cmd.cells || []).forEach(function (c) {
        var row = self.rows[c.ri], col = self.col(c.key);
        if (!row || !col) return;
        var v = back ? c.before : c.after;
        if (col.set) col.set(row, v); else row[col.key] = v;
        if (touched.indexOf(row) === -1) touched.push(row);
      });
      if (cmd.added && cmd.added.length) {
        if (back) {
          cmd.added.forEach(function (row) {
            var i = self.rows.indexOf(row);
            if (i >= 0) self.rows.splice(i, 1);
            if (touched.indexOf(row) === -1) touched.push(row);
          });
          if (self.opt.onRemove) self.opt.onRemove(cmd.added);
        } else {
          cmd.added.forEach(function (row) { if (self.rows.indexOf(row) === -1) self.rows.push(row); });
        }
      }
    } else if (cmd.type === 'rows') {
      if (back === !cmd.removed) {                 /* ย้อนการเพิ่ม = เอาออก · ย้อนการลบ = ใส่คืน */
        cmd.rows.forEach(function (row) {
          var i = self.rows.indexOf(row);
          if (i >= 0) self.rows.splice(i, 1);
        });
        if (self.opt.onRemove) self.opt.onRemove(cmd.rows);
      } else {
        cmd.rows.forEach(function (row, i) { self.rows.splice(cmd.at + i, 0, row); });
        cmd.rows.forEach(function (row) { touched.push(row); });
      }
    }
    /* ย้อนกลับแล้วแถวว่างเหมือนเดิม แต่ตอนนั้นบันทึกขึ้นเซิร์ฟเวอร์ไปแล้ว → ต้องลบทิ้งด้วย
       ไม่งั้นกด Cmd+Z แล้วของยังค้างอยู่ในฐานข้อมูล */
    if (back && cmd.became && cmd.became.length && this.opt.isBlank) {
      var gone = cmd.became.filter(function (r) { return self.opt.isBlank(r); });
      if (gone.length && this.opt.onRemove) this.opt.onRemove(gone);
      touched = touched.filter(function (r) { return gone.indexOf(r) === -1; });
    }
    this.ensureBlank();
    this.refresh(true);
    if (touched.length) this.changed(touched);
  };
  Grid.prototype.doUndo = function () {
    this.commitEdit();
    var cmd = this.undoStack.pop();
    if (!cmd) { this.toast('ไม่มีอะไรให้ย้อน'); return; }
    this.applyCmd(cmd, true);
    this.redoStack.push(cmd);
    this.toast('ย้อนกลับแล้ว');
  };
  Grid.prototype.doRedo = function () {
    this.commitEdit();
    var cmd = this.redoStack.pop();
    if (!cmd) return;
    this.applyCmd(cmd, false);
    this.undoStack.push(cmd);
    this.toast('ทำซ้ำแล้ว');
  };

  /* ---------- แถว ---------- */
  Grid.prototype.appendRow = function (silent) {
    var row = this.opt.blankRow ? this.opt.blankRow(this.rows[this.rows.length - 1]) : {};
    this.rows.push(row);
    if (!silent) { this.ensureBlank(); this.refresh(true); }
    return row;
  };
  Grid.prototype.ensureBlank = function () {
    if (!this.opt.isBlank) return;
    var n = 0, self = this;
    for (var i = this.rows.length - 1; i >= 0 && this.opt.isBlank(this.rows[i]); i--) n++;
    var want = this.opt.blankRows == null ? 5 : this.opt.blankRows;
    for (var k = n; k < want; k++) this.rows.push(this.opt.blankRow ? this.opt.blankRow(this.rows[this.rows.length - 1]) : {});
  };
  Grid.prototype.insertRow = function (vr, where) {
    var at = this.view[vr] + (where === 'below' ? 1 : 0);
    var row = this.opt.blankRow ? this.opt.blankRow(this.rowAt(vr)) : {};
    this.rows.splice(at, 0, row);
    this.pushUndo({ type: 'rows', at: at, rows: [row], removed: false });
    this.ensureBlank();
    this.refresh(true);
  };
  Grid.prototype.dupRow = function (vr) {
    var src = this.rowAt(vr);
    var at = this.view[vr] + 1;
    var row = this.opt.cloneRow ? this.opt.cloneRow(src) : JSON.parse(JSON.stringify(src));
    this.rows.splice(at, 0, row);
    this.pushUndo({ type: 'rows', at: at, rows: [row], removed: false });
    this.ensureBlank();
    this.refresh(true);
    this.changed([row]);
  };
  Grid.prototype.removeRows = function (vrs) {
    var self = this;
    var rows = vrs.map(function (vr) { return self.rowAt(vr); }).filter(Boolean);
    if (!rows.length) return;
    if (this.opt.onRemove) this.opt.onRemove(rows);
    var at = this.rows.indexOf(rows[0]);
    rows.forEach(function (row) {
      var i = self.rows.indexOf(row);
      if (i >= 0) self.rows.splice(i, 1);
    });
    this.pushUndo({ type: 'rows', at: at, rows: rows, removed: true });
    this.ensureBlank();
    this.refresh();
  };

  /* ---------- เมนูคลิกขวา ---------- */
  Grid.prototype.rowMenu = function (e) {
    var td = e.target.closest('td, th.xl-rh');
    if (!td) return;
    e.preventDefault();
    this.commitEdit();
    var vr = td.parentNode.rowIndex - 1;
    var g = this.range();
    if (vr < g.r1 || vr > g.r2) { this.clampSelTo(vr, td.hasAttribute('data-c') ? +td.getAttribute('data-c') : 0, false); this.paint(); g = this.range(); }
    var self = this;
    var n = g.r2 - g.r1 + 1;
    var canDel = !this.opt.canDelete || this.opt.canDelete();
    var pop = popAt('<div class="xl-menu">' +
      '<button type="button" data-m="copy">ก็อป</button>' +
      '<button type="button" data-m="clear">ล้างช่องที่เลือก</button>' +
      '<hr>' +
      '<button type="button" data-m="above">แทรกแถวด้านบน</button>' +
      '<button type="button" data-m="below">แทรกแถวด้านล่าง</button>' +
      '<button type="button" data-m="dup">ทำซ้ำแถวนี้</button>' +
      (canDel ? '<hr><button type="button" class="danger" data-m="del">ลบ ' + n + ' แถว</button>' : '') +
      '</div>', e.clientX, e.clientY);
    pop.addEventListener('mousedown', function (ev) {
      var b = ev.target.closest('[data-m]');
      if (!b) return;
      ev.preventDefault();
      var m = b.getAttribute('data-m');
      killPop();
      if (m === 'copy') { navigator.clipboard && navigator.clipboard.writeText(self.rangeText()); self.toast('ก็อปแล้ว'); }
      else if (m === 'clear') self.clearRange();
      else if (m === 'above') self.insertRow(g.r1, 'above');
      else if (m === 'below') self.insertRow(g.r2, 'below');
      else if (m === 'dup') self.dupRow(g.r1);
      else if (m === 'del') {
        var list = [];
        for (var r = g.r1; r <= g.r2; r++) list.push(r);
        if (self.opt.confirmDelete && !self.opt.confirmDelete(list.length)) return;
        self.removeRows(list);
      }
    });
  };
  Grid.prototype.colMenu = function (e) {
    var th = e.target.closest('th.xl-h');
    if (!th) return;
    e.preventDefault();
    var ci = +th.getAttribute('data-c'), col = this.cols[ci], self = this;
    var pop = popAt('<div class="xl-menu">' +
      '<button type="button" data-m="asc">เรียง ก → ฮ</button>' +
      '<button type="button" data-m="desc">เรียง ฮ → ก</button>' +
      '<button type="button" data-m="none">เลิกเรียง</button>' +
      '<hr><button type="button" data-m="filter">กรองคอลัมน์นี้…</button>' +
      '<button type="button" data-m="fit">ความกว้างเดิม</button>' +
      '</div>', e.clientX, e.clientY);
    pop.addEventListener('mousedown', function (ev) {
      var b = ev.target.closest('[data-m]');
      if (!b) return;
      ev.preventDefault();
      var m = b.getAttribute('data-m');
      killPop();
      if (m === 'asc') self.sortBy = { key: col.key, dir: 1 };
      else if (m === 'desc') self.sortBy = { key: col.key, dir: -1 };
      else if (m === 'none') self.sortBy = null;
      else if (m === 'fit') { delete self.widths[col.key]; self.saveWidths(); }
      else if (m === 'filter') { self.filterPop(ci, th); return; }
      self.refresh();
    });
  };

  /* ---------- ตัวกรองแบบ AutoFilter ---------- */
  Grid.prototype.filterPop = function (ci, th) {
    var self = this, col = this.cols[ci];
    var seen = {}, vals = [];
    this.rows.forEach(function (r) {
      if (self.opt.isBlank && self.opt.isBlank(r)) return;
      self.filterValues(col, r).forEach(function (v) { if (!seen[v]) { seen[v] = 1; vals.push(v); } });
    });
    vals.sort();
    var cur = this.filters[col.key];
    var r = th.getBoundingClientRect();
    var html = '<div class="xl-filter"><input class="xl-fq" placeholder="ค้นหา…">' +
      '<div class="xl-fl">' + vals.map(function (v, i) {
        var on = !cur || cur[v];
        return '<label class="xl-fi"><input type="checkbox" data-v="' + esc(v) + '"' + (on ? ' checked' : '') + '><span>' + esc(v) + '</span></label>';
      }).join('') + '</div>' +
      '<div class="xl-fa"><button type="button" data-f="all">ทั้งหมด</button>' +
      '<button type="button" data-f="none">ไม่เลือกเลย</button>' +
      '<button type="button" class="pri" data-f="ok">ใช้</button></div></div>';
    var pop = popAt(html, r.left, r.bottom + 2, 'xl-filterpop');
    var q = pop.querySelector('.xl-fq');
    q.addEventListener('input', function () {
      var s = this.value.toLowerCase();
      var items = pop.querySelectorAll('.xl-fi');
      for (var i = 0; i < items.length; i++) {
        items[i].style.display = items[i].textContent.toLowerCase().indexOf(s) !== -1 ? '' : 'none';
      }
    });
    setTimeout(function () { q.focus(); }, 30);
    pop.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-f]');
      if (!b) return;
      var boxes = pop.querySelectorAll('input[type=checkbox]');
      var f = b.getAttribute('data-f');
      if (f === 'all' || f === 'none') {
        for (var i = 0; i < boxes.length; i++) if (boxes[i].parentNode.style.display !== 'none') boxes[i].checked = f === 'all';
        return;
      }
      var set = {}, n = 0, total = boxes.length;
      for (var j = 0; j < boxes.length; j++) if (boxes[j].checked) { set[boxes[j].getAttribute('data-v')] = 1; n++; }
      if (n === total || n === 0) delete self.filters[col.key];
      else self.filters[col.key] = set;
      killPop();
      self.refresh();
    });
  };

  /* ---------- หัวตาราง: กรอง / ลากขยาย ---------- */
  Grid.prototype.onHeadClick = function (e) {
    var fb = e.target.closest('[data-filter]');
    if (fb) { this.filterPop(+fb.getAttribute('data-filter'), fb.closest('th')); return; }
  };
  Grid.prototype.onHeadDown = function (e) {
    var rz = e.target.closest('[data-rz]');
    if (!rz) return;
    e.preventDefault();
    var ci = +rz.getAttribute('data-rz'), self = this;
    var startX = e.clientX, startW = this.w(ci);
    var move = function (ev) {
      self.widths[self.cols[ci].key] = Math.max(52, startW + ev.clientX - startX);
      self.cg.children[ci + 1].style.width = self.widths[self.cols[ci].key] + 'px';
      if (ci < self.freeze) self.refreshFrozen();
    };
    var up = function () {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      self.saveWidths();
      self.refresh(true);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };
  Grid.prototype.refreshFrozen = function () {
    var self = this;
    for (var i = 0; i < this.freeze; i++) {
      var left = this.colLeft(i) + 'px';
      var cells = this.table.querySelectorAll('[data-c="' + i + '"]');
      for (var k = 0; k < cells.length; k++) cells[k].style.left = left;
    }
  };
  Grid.prototype.saveWidths = function () {
    try { localStorage.setItem(LS_W + this.id, JSON.stringify(this.widths)); } catch (e) {}
  };

  /* ---------- ตัวช่วยอื่น ---------- */
  Grid.prototype.changed = function (rows) { if (this.opt.onChange) this.opt.onChange(rows); };
  Grid.prototype.toast = function (msg) { if (this.opt.onToast) this.opt.onToast(msg); };
  Grid.prototype.setSaveText = function (html, cls) {
    this.saveEl.className = 'xl-save' + (cls ? ' ' + cls : '');
    this.saveEl.innerHTML = html;
  };
  Grid.prototype.markRow = function (row) {
    var ri = this.rows.indexOf(row);
    if (ri < 0) return;
    var vr = this.view.indexOf(ri);
    if (vr < 0) return;
    var th = this.tbody.rows[vr] && this.tbody.rows[vr].cells[0];
    if (!th) return;
    var st = th.querySelector('.xl-st');
    if (st) { st.className = 'xl-st ' + (row._st || ''); st.title = row._msg || ''; }
    th.setAttribute('data-tone', this.opt.tone ? this.opt.tone(row) : '');
    var tr = this.tbody.rows[vr];
    if (tr) tr.classList.toggle('xl-new', !!(this.opt.isBlank && this.opt.isBlank(row)));
  };
  Grid.prototype.redrawRowFor = function (row) {
    var ri = this.rows.indexOf(row);
    if (ri < 0) return;
    var vr = this.view.indexOf(ri);
    if (vr >= 0) this.redrawRow(vr);
  };
  Grid.prototype.destroy = function () { killPop(); this.host.innerHTML = ''; };

  /* ปุ่มบนแถบเครื่องมือของตาราง */
  function wireBar(g) {
    g.host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-add], [data-clearf], [data-clears]');
      if (!b) return;
      if (b.hasAttribute('data-add')) {
        var n = +b.getAttribute('data-add');
        for (var i = 0; i < n; i++) g.appendRow(true);
        g.ensureBlank();
        g.refresh(true);
        g.setSel(g.view.length - 1 - (g.opt.blankRows == null ? 5 : g.opt.blankRows) + n, 0, false);
      } else if (b.hasAttribute('data-clearf')) { g.filters = {}; g.refresh(); }
      else if (b.hasAttribute('data-clears')) { g.sortBy = null; g.refresh(); }
    });
  }

  global.KAN_GRID = {
    create: function (host, opt) {
      var g = new Grid(host, opt);
      g.isTouch = ('ontouchstart' in window) && window.matchMedia('(max-width:760px)').matches;
      wireBar(g);
      global.KAN_GRID.last = g;   /* ตัวล่าสุดบนหน้า — ไว้ตรวจสอบ/ทดสอบ */
      return g;
    },
    last: null,
  };
}(window));
