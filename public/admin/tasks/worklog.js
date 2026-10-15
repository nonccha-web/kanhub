/* ============================================================
   KAN — บันทึกงานรายวัน (Work Log) · แทนชีต Lark "งาน RT Marketing" (15 ต.ค. 69)
   #/log            ตารางรายสัปดาห์ของฉัน   (?d=YYYY-MM-DD = สัปดาห์ที่มีวันนั้น)
   #/log/all        ทั้งทีม — หัวหน้า (owner + คนดูแลงาน) · กรองคน/สาขา/Process ได้ (?s= &b= &p=)
   หน้าตาให้เหมือนชีตมากที่สุด: คอลัมน์ M/D/Y · Day · Time · Work · Process · reason · แนบรูปงาน
   ช่องวันที่ "รวมเซลล์" ทั้งวัน · เส้นหนาคั่นวัน · หัวตารางชมพู · เส้นประ · Process เป็นปุ่มสีกดเลือก
   แก้ในช่องได้เลย (คลิกช่อง → พิมพ์ → Enter/คลิกที่อื่น = บันทึก · Esc = ยกเลิก) เฉพาะแถวของตัวเอง
   หลังบ้าน: /api/t/worklog*  (worker-worklog.js)
   ============================================================ */
(function (global) {
  'use strict';
  var X = null;
  var W = { data: null, key: '', edit: null, drafts: [], busy: false };

  var STATUS = [
    { k: 'done', th: 'เสร็จแล้ว' }, { k: 'doing', th: 'กำลังทำ' },
    { k: 'review', th: 'รอตรวจ' }, { k: 'blocked', th: 'ติดปัญหา' },
  ];
  var STATUS_TH = {}; STATUS.forEach(function (s) { STATUS_TH[s.k] = s.th; });
  var DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  /* ลำดับช่องที่กด Tab ไล่ไปในแถวเดียวกัน */
  var FIELDS = ['slot', 'work', 'reason'];

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return X.esc(s); }
  function api(p, m, b) { return X.api(p, m, b); }
  function toast(m, bad) { X.toast(m, bad); }
  function fail(e) { toast(e && e.message ? e.message : String(e), true); }

  /* ---------- วันที่ (สตริง YYYY-MM-DD คิดแบบ UTC ล้วน กันเขตเวลาเพี้ยน) ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function localToday() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T00:00:00Z')); }
  function addDays(d, n) { var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function wd(d) { return new Date(d + 'T00:00:00Z').getUTCDay(); }
  /* สัปดาห์เริ่มวันจันทร์ ตามชีต (ปฏิทินการตลาดเริ่มอาทิตย์ — คนละหน้า ไม่เกี่ยวกัน) */
  function mondayOf(d) { return addDays(d, -((wd(d) + 6) % 7)); }
  function mdy(d) { var p = d.split('-'); return Number(p[1]) + '/' + Number(p[2]) + '/' + p[0]; }
  function thShort(d) { var p = d.split('-'); return Number(p[2]) + ' ' + MON_TH[Number(p[1]) - 1]; }
  function thRange(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    var y = ' ' + (Number(pb[0]) + 543);
    if (pa[1] === pb[1]) return Number(pa[2]) + '–' + Number(pb[2]) + ' ' + MON_TH[Number(pb[1]) - 1] + y;
    return thShort(a) + ' – ' + thShort(b) + y;
  }

  /* ---------- สถานะหน้า (อ่านจาก hash) ---------- */
  function opts(route) {
    var q = (route && route.query) || {};
    var all = route && route.id === 'all';
    var day = isDate(q.d) ? q.d : localToday();
    return { all: all, from: mondayOf(day), staff: all ? (q.s || 'all') : 'me', branch: all ? (q.b || '') : '', status: all ? (q.p || '') : '' };
  }
  function hashFor(o) {
    var q = ['d=' + o.from];
    if (o.all) {
      if (o.staff && o.staff !== 'all') q.push('s=' + encodeURIComponent(o.staff));
      if (o.branch) q.push('b=' + encodeURIComponent(o.branch));
      if (o.status) q.push('p=' + encodeURIComponent(o.status));
    }
    return '#/log' + (o.all ? '/all' : '') + '?' + q.join('&');
  }
  function meId() { var m = X.me(); return m ? m.id : ''; }
  function canEditRow(r) { return !X.readOnly() && r.staffId === meId(); }
  function staffFull(id) {
    var s = (W.data && W.data.staff || []).filter(function (x) { return x.id === id; })[0] || X.staffById(id);
    return s ? String(s.name) : '—';
  }
  function staffName(id) { return staffFull(id).split(/\s+/)[0]; }

  /* ---------- โหลด ---------- */
  function render(route) {
    var v = $('#view');
    var o = opts(route);
    v.className = 'page wl-page';
    var key = JSON.stringify(o);
    if (key !== W.key) { W.edit = null; W.drafts = []; }
    W.o = o;
    if (!W.data || key !== W.key) v.innerHTML = '<div class="loading">กำลังโหลด…</div>';
    W.key = key;
    var q = '/worklog?from=' + o.from + '&to=' + addDays(o.from, 6) + '&staff=' + encodeURIComponent(o.staff) +
      (o.branch ? '&branch=' + encodeURIComponent(o.branch) : '') + (o.status ? '&status=' + o.status : '');
    return api(q).then(function (j) {
      if (W.key !== key) return;   /* กดเปลี่ยนสัปดาห์รัว ๆ — ทิ้งคำตอบเก่า */
      W.data = j;
      paint();
    }).catch(function (e) {
      v.innerHTML = '<div class="err"><b>เปิดบันทึกงานไม่ได้</b><p>' + esc(e.message || e) + '</p></div>' +
        (o.all ? '<a class="btn-ghost" href="#/log">กลับไปบันทึกของฉัน</a>' : '');
    });
  }

  /* ---------- วาด ---------- */
  function paint() {
    var j = W.data, o = W.o;
    var to = addDays(o.from, 6);
    var today = j.today || localToday();
    var ro = X.readOnly();
    var h = '<div class="top wl-top"><div><span class="kicker">งานทีม</span>' +
      '<h1>บันทึกงานรายวัน <span class="en">Work Log</span></h1>' +
      '<p>' + (o.all ? 'บันทึกของทั้งทีม — ดูอย่างเดียว แต่ละคนแก้ได้เฉพาะของตัวเอง'
        : 'คลิกช่องแล้วพิมพ์ได้เลย · Enter หรือคลิกที่อื่น = บันทึก · Esc = ยกเลิก · ช่อง Work ขึ้นบรรทัดใหม่ด้วย Enter, บันทึกด้วย Ctrl+Enter') + '</p></div>' +
      '<div class="top-r">' +
      (j.isLead ? '<div class="seg wl-seg"><a href="' + hashFor({ all: false, from: o.from }) + '"' + (o.all ? '' : ' class="on"') + '>ของฉัน</a>' +
        '<a href="' + hashFor({ all: true, from: o.from, staff: 'all' }) + '"' + (o.all ? ' class="on"' : '') + '>ทั้งทีม</a></div>' : '') +
      (!o.all && !ro ? '<button type="button" class="btn" data-wl="add">+ Add row</button>' : '') +
      '</div></div>';

    /* แถบสัปดาห์ + ตัวกรองของหัวหน้า */
    var thisWeek = mondayOf(today);
    h += '<div class="wl-bar"><div class="wl-week">' +
      '<a class="btn-ghost sm" href="' + hashFor(Object.assign({}, o, { from: addDays(o.from, -7) })) + '" aria-label="สัปดาห์ก่อน">‹ สัปดาห์ก่อน</a>' +
      '<b>' + esc(thRange(o.from, to)) + '</b>' +
      '<a class="btn-ghost sm" href="' + hashFor(Object.assign({}, o, { from: addDays(o.from, 7) })) + '" aria-label="สัปดาห์ถัดไป">สัปดาห์ถัดไป ›</a>' +
      (o.from !== thisWeek ? '<a class="btn-ghost sm" href="' + hashFor(Object.assign({}, o, { from: thisWeek })) + '">สัปดาห์นี้</a>' : '') +
      '</div>';
    if (o.all) {
      h += '<div class="wl-filters">' +
        '<label>คน<select class="select" data-wlf="staff"><option value="all">ทุกคน</option>' +
          j.staff.filter(function (s) { return s.active; }).map(function (s) {
            return '<option value="' + esc(s.id) + '"' + (o.staff === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
          }).join('') + '</select></label>' +
        '<label>สาขา<select class="select" data-wlf="branch"><option value="">ทุกสาขา</option>' +
          (j.branches || []).map(function (b) { return '<option' + (o.branch === b ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('') +
          '<option value="none"' + (o.branch === 'none' ? ' selected' : '') + '>ไม่ระบุสาขา</option></select></label>' +
        '<label>Process<select class="select" data-wlf="status"><option value="">ทั้งหมด</option>' +
          STATUS.map(function (s) { return '<option value="' + s.k + '"' + (o.status === s.k ? ' selected' : '') + '>' + s.th + '</option>'; }).join('') +
          '</select></label></div>';
    }
    h += '</div>';

    /* จัดแถวเป็นรายวัน (ตารางของฉันโชว์ครบ 7 วัน วันว่างเป็นแถวบาง ๆ ให้กดเพิ่มได้) */
    var rows = j.rows.concat(W.drafts);
    var byDay = {};
    rows.forEach(function (r) { (byDay[r.date] = byDay[r.date] || []).push(r); });
    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = addDays(o.from, i);
      if (byDay[d] || !o.all) days.push(d);
    }
    var cols = o.all ? 9 : 8;
    h += '<div class="wl-wrap"><table class="wl-tab' + (o.all ? ' all' : '') + '"><colgroup>' +
      '<col class="c-date"><col class="c-day">' + (o.all ? '<col class="c-who">' : '') +
      '<col class="c-time"><col class="c-work"><col class="c-proc"><col class="c-reason"><col class="c-pic"><col class="c-act">' +
      '</colgroup><thead><tr><th>M/D/Y</th><th>Day</th>' + (o.all ? '<th>ชื่อ</th>' : '') +
      '<th>Time</th><th>Work</th><th>Process</th><th>reason</th><th>แนบรูปงาน</th><th aria-label="จัดการ"></th></tr></thead>';
    if (!days.length) {
      h += '<tbody><tr><td colspan="' + cols + '" class="wl-empty">ไม่มีบันทึกในสัปดาห์นี้' +
        (o.staff !== 'all' || o.branch || o.status ? ' ตามตัวกรองที่เลือก' : '') + '</td></tr></tbody>';
    }
    days.forEach(function (d) {
      var list = (byDay[d] || []).slice().sort(function (a, b) {
        return (a.staffId === b.staffId ? 0 : (staffFull(a.staffId).localeCompare(staffFull(b.staffId)) || (a.staffId < b.staffId ? -1 : 1))) ||
          (slotKey(a.slot) - slotKey(b.slot)) || ((a.sort || 0) - (b.sort || 0));
      });
      var cls = 'wl-day' + (d === today ? ' today' : '') + (wd(d) === 0 || wd(d) === 6 ? ' wkend' : '');
      var span = Math.max(1, list.length) + (!o.all && !ro ? 1 : 0);
      var head = '<td class="wl-date" rowspan="' + span + '">' + mdy(d) + (d === today ? '<small>วันนี้</small>' : '') + '</td>' +
        '<td class="wl-dname" rowspan="' + span + '">' + DAY_EN[wd(d)] + '</td>';
      h += '<tbody class="' + cls + '" data-date="' + d + '">';
      if (!list.length) {
        h += '<tr class="wl-none">' + head + '<td colspan="' + (cols - 2) + '" class="wl-muted">—</td></tr>';
      }
      /* มุมมองทั้งทีม: ชื่อขึ้นแถวแรกของแต่ละคนในวันนั้น แถวต่อ ๆ ไปเว้นว่าง (อ่านง่ายแบบเซลล์รวม) */
      list.forEach(function (r, k) { h += rowHtml(r, k === 0 ? head : '', o, k === 0 || list[k - 1].staffId !== r.staffId); });
      if (!o.all && !ro) {
        h += '<tr class="wl-addrow"><td colspan="' + (cols - 2) + '"><button type="button" class="wl-add" data-wl="add" data-date="' + d + '">+ เพิ่มแถว</button></td></tr>';
      }
      h += '</tbody>';
    });
    h += '</table></div>';
    $('#view').innerHTML = h;
    if (W.edit) openEditor(W.edit.id, W.edit.field, true);
  }
  /* "10.00-10.30" → นาทีเริ่ม (อ่านไม่ออก = ท้ายวัน) — ชุดเดียวกับฝั่งเซิร์ฟเวอร์ */
  function slotKey(s) {
    var m = String(s || '').match(/^\s*(\d{1,2})[.:](\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 9999;
  }
  function rowHtml(r, head, o, firstOfPerson) {
    var mine = canEditRow(r) || r.draft;
    var e = mine ? ' wl-ed' : '';
    var work = String(r.work || '');
    var tags = '';
    if (r.carriedFromDate) tags += '<span class="wl-tag">↪ ยกมาจาก ' + esc(thShort(r.carriedFromDate)) + '</span>';
    if (r.carriedToDate) tags += '<span class="wl-tag mut">ยกไป ' + esc(thShort(r.carriedToDate)) + ' →</span>';
    return '<tr class="wl-row' + (r.draft ? ' draft' : '') + '" data-id="' + esc(r.id) + '">' + head +
      (o.all ? '<td class="wl-who' + (firstOfPerson ? '' : ' cont') + '" title="' + esc(staffFull(r.staffId)) + '">' + (firstOfPerson ? esc(staffName(r.staffId)) : '') + '</td>' : '') +
      '<td class="wl-c' + e + '" data-f="slot">' + (r.slot ? esc(r.slot) : (mine ? '<span class="wl-ph">เวลา</span>' : '')) + '</td>' +
      '<td class="wl-c wl-work' + e + '" data-f="work">' + (tags ? '<div class="wl-tags">' + tags + '</div>' : '') +
        (work.trim() ? '<div class="wl-txt">' + esc(work) + '</div>' : (mine ? '<span class="wl-ph">พิมพ์งาน…</span>' : '')) + '</td>' +
      '<td class="wl-proc">' + pill(r, mine && !r.draft) + '</td>' +
      '<td class="wl-c wl-reason' + e + (r.status === 'blocked' && !r.reason ? ' need' : '') + '" data-f="reason">' +
        (r.reason ? '<div class="wl-txt">' + esc(r.reason) + '</div>' : '') + '</td>' +
      '<td class="wl-pics">' + pics(r) + '</td>' +
      '<td class="wl-act">' + (mine && !r.draft ? '<button type="button" class="wl-x" data-wl="del" title="ลบแถวนี้" aria-label="ลบแถวนี้">×</button>' : '') + '</td>' +
      '</tr>';
  }
  function pill(r, can) {
    var st = r.status || 'done';
    var inner = esc(STATUS_TH[st] || st) + (can ? '<i aria-hidden="true">▾</i>' : '');
    return can
      ? '<button type="button" class="wl-pill ' + st + '" data-wl="proc" aria-haspopup="listbox">' + inner + '</button>'
      : '<span class="wl-pill ' + st + '">' + inner + '</span>';
  }
  /* รูปย่อในตาราง — กดแล้วเปิดตัวดูรูปของระบบ (.att.img = ตัวเดียวกับรูปในงาน เลื่อนดูรูปถัดไปได้) */
  function pics(r) {
    if (!r.files || !r.files.length) return '';
    return '<div class="wl-thumbs">' + r.files.map(function (f) {
      var full = X.API + '/worklog/files/' + encodeURIComponent(f.id);
      return '<span class="att img wl-thumb" role="button" tabindex="0" data-src="' + esc(full) + '" title="' + esc(f.name) + '" ' +
        'style="background-image:url(\'' + esc(full + (f.thumb ? '?thumb=1' : '')) + '\')"></span>';
    }).join('') + '</div>';
  }

  /* ---------- หาแถว ---------- */
  function rowById(id) {
    var all = (W.data ? W.data.rows : []).concat(W.drafts);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function putRow(row) {
    var rs = W.data.rows;
    for (var i = 0; i < rs.length; i++) if (rs[i].id === row.id) { rs[i] = row; return; }
    rs.push(row);
  }

  /* ---------- แก้ในช่อง ---------- */
  function openEditor(id, field, again) {
    var r = rowById(id);
    if (!r || !(canEditRow(r) || r.draft)) return;
    var tr = $('.wl-row[data-id="' + cssEsc(id) + '"]');
    var td = tr && tr.querySelector('[data-f="' + field + '"]');
    if (!td) return;
    if (!again) closeEditor(true);
    var cur = W.edit && W.edit.id === id && W.edit.field === field && W.edit.value != null ? W.edit.value : (r[field] || '');
    if (field === 'work' && !cur) cur = '- ';
    W.edit = { id: id, field: field, value: cur, pendingStatus: W.edit && W.edit.id === id ? W.edit.pendingStatus : null };
    td.classList.add('editing');
    if (field === 'slot') {
      td.innerHTML = '<input class="wl-in" list="wlSlots" value="' + esc(cur) + '" placeholder="10.00-10.30" maxlength="40">' +
        '<datalist id="wlSlots">' + ((W.data && W.data.slots) || []).map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>';
    } else {
      td.innerHTML = '<textarea class="wl-in" rows="' + (field === 'work' ? 3 : 2) + '"' +
        (field === 'reason' ? ' placeholder="' + (W.edit.pendingStatus === 'blocked' || r.status === 'blocked' ? 'ติดอะไร / จะเสร็จเมื่อไหร่ (ต้องใส่)' : 'เช่น ทำไมช้า / จะเสร็จเมื่อไหร่') + '"' : '') +
        '>' + esc(cur) + '</textarea>' +
        '<small class="wl-hint">' + (field === 'work' ? 'Enter = ขึ้นบรรทัด · Ctrl+Enter = บันทึก · Esc = ยกเลิก' : 'Enter = บันทึก · Shift+Enter = ขึ้นบรรทัด · Esc = ยกเลิก') + '</small>';
    }
    var inp = td.querySelector('.wl-in');
    if (inp.tagName === 'TEXTAREA') autoSize(inp);
    inp.focus();
    var n = inp.value.length;
    try { inp.setSelectionRange(n, n); } catch (e) {}
  }
  function autoSize(t) { t.style.height = 'auto'; t.style.height = Math.min(420, t.scrollHeight + 2) + 'px'; }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  /* ปิดตัวแก้ — save = บันทึกค่าที่พิมพ์ · ไม่ save = ทิ้ง */
  function closeEditor(save, next) {
    var ed = W.edit;
    if (!ed) return Promise.resolve();
    var inp = $('.wl-row[data-id="' + cssEsc(ed.id) + '"] .wl-in');
    if (inp) ed.value = inp.value;
    W.edit = null;
    var r = rowById(ed.id);
    if (!r) { paint(); return Promise.resolve(); }
    if (!save) {
      if (r.draft) dropDraft(r.id);
      paint();
      return Promise.resolve();
    }
    var val = ed.field === 'slot' ? String(ed.value || '').trim() : String(ed.value || '').replace(/\s+$/, '');
    if (ed.field === 'work' && /^-?\s*$/.test(val)) val = '';
    /* แถวร่าง (ยังไม่เคยบันทึก) — ช่องงานว่าง = ทิ้งแถว ไม่สร้างแถวเปล่าค้างในระบบ */
    if (r.draft) {
      r[ed.field] = val;
      if (ed.field === 'work' && !val) { dropDraft(r.id); paint(); return Promise.resolve(); }
      if (ed.field !== 'work' && !String(r.work || '').trim()) { paint(); openEditor(r.id, 'work'); return Promise.resolve(); }
      return create(r, next);
    }
    var body = {};
    body[ed.field] = val;
    if (ed.pendingStatus) body.status = ed.pendingStatus;
    if (val === (r[ed.field] || '') && !ed.pendingStatus) { paint(); if (next) openEditor(r.id, next); return Promise.resolve(); }
    if (ed.pendingStatus === 'blocked' && ed.field === 'reason' && !val.trim()) {
      toast('ยังไม่ได้เปลี่ยนเป็น “ติดปัญหา” — ต้องใส่ reason ก่อน', true);
      paint();
      return Promise.resolve();
    }
    return save1(r, body).then(function (ok) {
      if (!ok) { W.edit = ed; paint(); return; }
      paint();
      if (next) openEditor(r.id, next);
    });
  }
  function save1(r, body) {
    return api('/worklog/' + encodeURIComponent(r.id), 'PUT', body).then(function (j) {
      putRow(j.row);
      return true;
    }).catch(function (e) { fail(e); return false; });
  }
  function create(r, next) {
    if (W.busy) return Promise.resolve();
    W.busy = true;
    return api('/worklog', 'POST', { date: r.date, slot: r.slot || '', work: r.work || '', status: r.status || 'done', reason: r.reason || '' })
      .then(function (j) {
        dropDraft(r.id);
        putRow(j.row);
        paint();
        if (next) openEditor(j.row.id, next);
      }).catch(function (e) { fail(e); paint(); })
      .then(function () { W.busy = false; });
  }
  function dropDraft(id) { W.drafts = W.drafts.filter(function (x) { return x.id !== id; }); }

  /* ---------- เพิ่มแถว: ร่างในเครื่องก่อน บันทึกจริงตอนพิมพ์งานเสร็จ ---------- */
  function addRow(date) {
    var o = W.o, today = (W.data && W.data.today) || localToday();
    if (!date) date = today >= o.from && today <= addDays(o.from, 6) ? today : o.from;
    closeEditor(true).then(function () {
      var mine = W.data.rows.filter(function (r) { return r.date === date && r.staffId === meId(); });
      var id = 'draft' + Date.now();
      W.drafts.push({ id: id, draft: true, date: date, staffId: meId(), slot: nextSlot(mine), work: '', status: 'done', reason: '', files: [] });
      paint();
      openEditor(id, 'work');
    });
  }
  /* เวลาถัดจากแถวล่าสุดของวัน ตามช่วงมาตรฐาน (10.00-10.30 → 10.30-11.00 …) */
  function nextSlot(list) {
    var slots = (W.data && W.data.slots) || [];
    if (!list.length) return slots[0] || '';
    var last = list.slice().sort(function (a, b) { return slotKey(a.slot) - slotKey(b.slot); })[list.length - 1];
    var i = slots.indexOf(last.slot);
    return i !== -1 && i + 1 < slots.length ? slots[i + 1] : '';
  }

  /* ---------- Process: เมนูเลือก 4 ค่า ---------- */
  function procMenu(btn, id) {
    closeMenu();
    var r = rowById(id);
    if (!r) return;
    var m = document.createElement('div');
    m.className = 'wl-menu';
    m.setAttribute('role', 'listbox');
    m.innerHTML = STATUS.map(function (s) {
      return '<button type="button" role="option" class="' + (s.k === r.status ? 'on' : '') + '" data-st="' + s.k + '">' +
        '<span class="wl-pill ' + s.k + '">' + s.th + '</span></button>';
    }).join('');
    document.body.appendChild(m);
    var b = btn.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(b.left, window.innerWidth - m.offsetWidth - 8)) + 'px';
    m.style.top = (b.bottom + 4 + m.offsetHeight > window.innerHeight ? b.top - m.offsetHeight - 4 : b.bottom + 4) + 'px';
    m.dataset.id = id;
    var first = m.querySelector('.on') || m.querySelector('button');
    if (first) first.focus();
  }
  function closeMenu() { var m = $('.wl-menu'); if (m) m.remove(); }
  function pickStatus(id, st) {
    closeMenu();
    var r = rowById(id);
    if (!r || st === r.status) return;
    /* ติดปัญหา ต้องมี reason — ถ้ายังไม่มี เปิดช่อง reason ให้พิมพ์ก่อน แล้วค่อยบันทึกทั้งสองอย่างพร้อมกัน */
    if (st === 'blocked' && !String(r.reason || '').trim()) {
      closeEditor(true).then(function () {
        W.edit = { id: id, field: 'reason', value: '', pendingStatus: 'blocked' };
        openEditor(id, 'reason', true);
        toast('“ติดปัญหา” ต้องใส่ reason — พิมพ์แล้วกด Enter');
      });
      return;
    }
    closeEditor(true).then(function () {
      return save1(r, { status: st });
    }).then(function () { paint(); });
  }

  function delRow(id) {
    var r = rowById(id);
    if (!r) return;
    var first = String(r.work || '').split('\n')[0].slice(0, 60);
    if (!confirm('ลบแถวนี้?\n' + (r.slot ? r.slot + '  ' : '') + first)) return;
    api('/worklog/' + encodeURIComponent(id), 'DELETE').then(function () {
      W.data.rows = W.data.rows.filter(function (x) { return x.id !== id; });
      paint();
      toast('ลบแล้ว');
    }).catch(fail);
  }

  /* ---------- เหตุการณ์ (ผูกครั้งเดียวตอน init — #view ถูกเขียนทับทุกครั้งที่วาด) ---------- */
  function inPage(el) { return !!(el && el.closest && el.closest('.wl-page')); }
  function wire() {
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      var menu = t.closest && t.closest('.wl-menu');
      if (menu) {
        var b = t.closest('[data-st]');
        if (b) pickStatus(menu.dataset.id, b.getAttribute('data-st'));
        return;
      }
      closeMenu();
      if (!inPage(t)) return;
      var act = t.closest('[data-wl]');
      if (act) {
        var a = act.getAttribute('data-wl');
        var tr = act.closest('.wl-row');
        if (a === 'add') { addRow(act.getAttribute('data-date')); return; }
        if (a === 'proc' && tr) { procMenu(act, tr.getAttribute('data-id')); return; }
        if (a === 'del' && tr) { delRow(tr.getAttribute('data-id')); return; }
      }
      var cell = t.closest('.wl-ed[data-f]');
      if (cell && !cell.classList.contains('editing')) {
        var row = cell.closest('.wl-row');
        var id = row.getAttribute('data-id'), f = cell.getAttribute('data-f');
        closeEditor(true).then(function () { openEditor(id, f); });
        return;
      }
      /* คลิกที่อื่นในหน้า = บันทึกช่องที่เปิดอยู่ */
      if (W.edit && !t.closest('.editing')) closeEditor(true);
    });
    document.addEventListener('change', function (ev) {
      var f = ev.target.getAttribute && ev.target.getAttribute('data-wlf');
      if (!f || !inPage(ev.target)) return;
      var o = Object.assign({}, W.o);
      o[f] = ev.target.value;
      location.hash = hashFor(o);
    });
    document.addEventListener('input', function (ev) {
      if (ev.target.classList && ev.target.classList.contains('wl-in') && ev.target.tagName === 'TEXTAREA') autoSize(ev.target);
    });
    document.addEventListener('keydown', function (ev) {
      var menu = $('.wl-menu');
      if (menu && (ev.key === 'Escape')) { closeMenu(); return; }
      if (menu && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
        ev.preventDefault();
        var bs = Array.prototype.slice.call(menu.querySelectorAll('button'));
        var i = bs.indexOf(document.activeElement);
        bs[(i + (ev.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus();
        return;
      }
      var t = ev.target;
      if (t.classList && t.classList.contains('wl-thumb') && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); t.click(); return; }
      if (!W.edit || !(t.classList && t.classList.contains('wl-in'))) return;
      var f = W.edit.field;
      if (ev.key === 'Escape') { ev.preventDefault(); closeEditor(false); return; }
      if (ev.key === 'Tab') {
        ev.preventDefault();
        var i2 = FIELDS.indexOf(f) + (ev.shiftKey ? -1 : 1);
        closeEditor(true, FIELDS[i2] || null);
        return;
      }
      if (ev.key === 'Enter') {
        var multi = f === 'work';
        if ((multi && (ev.ctrlKey || ev.metaKey)) || (!multi && !ev.shiftKey && !ev.isComposing)) {
          ev.preventDefault();
          closeEditor(true);
        }
      }
    });
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, { passive: true });
  }

  global.KAN_WORKLOG = {
    init: function (x) { X = x; if (!W.wired) { W.wired = true; wire(); } },
    render: render,
  };
})(window);
