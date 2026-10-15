/* ============================================================
   KAN — บันทึกงานรายวัน (Work Log) · แทนชีต Lark "งาน RT Marketing" (15 ต.ค. 69)
   #/log            ตารางรายสัปดาห์ของฉัน   (?d=YYYY-MM-DD = สัปดาห์ที่มีวันนั้น)
   #/log/all        ทั้งทีม — หัวหน้า (owner + คนดูแลงาน) · กรองคน/สาขา/Process ได้ (?s= &b= &p=)
   #/log/search     ค้นหาใน Work + reason ช่วงวันที่ไหนก็ได้ (?q= &f= &t= &s=)
   หน้าตาให้เหมือนชีตมากที่สุด: คอลัมน์ M/D/Y · Day · Time · Work · Process · reason · แนบรูปงาน
   ช่องวันที่ "รวมเซลล์" ทั้งวัน · เส้นหนาคั่นวัน · หัวตารางชมพู · เส้นประ · Process เป็นปุ่มสีกดเลือก
   แก้ในช่องได้เลย (คลิกช่อง → พิมพ์ → Enter/คลิกที่อื่น = บันทึก · Esc = ยกเลิก) เฉพาะแถวของตัวเอง
   จอมือถือ (กว้าง ≤ 760px) สลับเป็น "ทีละวัน" — การ์ดต่อแถว + ฟอร์มเพิ่ม/แก้แบบเต็มจอ · ข้อมูลชุดเดียวกัน
     ?d= บนมือถือ = วันที่ดู · บนจอใหญ่ = สัปดาห์ที่มีวันนั้น
   หลังบ้าน: /api/t/worklog*  (worker-worklog.js)
   ============================================================ */
(function (global) {
  'use strict';
  var X = null;
  var W = { data: null, key: '', edit: null, drafts: [], busy: false, route: null };
  var PHONE_MQ = '(max-width: 760px)';
  function isPhone() { return !!(global.matchMedia && global.matchMedia(PHONE_MQ).matches); }
  var MAX_PICS = 10;
  var ICON_CLOCK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

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
    if (route && route.id === 'search') {
      return { search: true, phone: isPhone(), q: q.q || '', f: isDate(q.f) ? q.f : '', t: isDate(q.t) ? q.t : '', staff: q.s || '' };
    }
    return { all: all, phone: isPhone(), day: day, from: mondayOf(day), staff: all ? (q.s || 'all') : 'me', branch: all ? (q.b || '') : '', status: all ? (q.p || '') : '' };
  }
  /* d = วันที่จะใส่ใน ?d= · ไม่ส่งมา = วันที่ดูอยู่ (มือถือ) หรือวันจันทร์ของสัปดาห์ (จอใหญ่) */
  function hashFor(o, d) {
    var q = ['d=' + (d || (o.phone ? o.day : o.from))];
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
    if (key !== W.key) { W.edit = null; W.drafts = []; W.pick = null; }
    W.o = o;
    W.route = route;
    if (o.search) return renderSearch(o, v, key);
    if (!W.data || key !== W.key) v.innerHTML = '<div class="loading">กำลังโหลด…</div>';
    W.key = key;
    var q = '/worklog?from=' + (o.phone ? o.day : o.from) + '&to=' + (o.phone ? o.day : addDays(o.from, 6)) + '&staff=' + encodeURIComponent(o.staff) +
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
    if (W.o.phone) return paintPhone();
    var j = W.data, o = W.o;
    var to = addDays(o.from, 6);
    var today = j.today || localToday();
    var ro = X.readOnly();
    var h = '<div class="top wl-top"><div><span class="kicker">งานทีม</span>' +
      '<h1>บันทึกงานรายวัน <span class="en">Work Log</span></h1>' +
      '<p>' + (o.all ? 'บันทึกของทั้งทีม — ดูอย่างเดียว แต่ละคนแก้ได้เฉพาะของตัวเอง'
        : 'คลิกช่องแล้วพิมพ์ได้เลย · Enter หรือคลิกที่อื่น = บันทึก · Esc = ยกเลิก · ช่อง Work ขึ้นบรรทัดใหม่ด้วย Enter, บันทึกด้วย Ctrl+Enter') + '</p></div>' +
      '<div class="top-r">' +
      segHtml(o) +
      '<a class="btn-ghost" href="#/log/search">ค้นหา</a>' +
      (!o.all && !ro ? '<button type="button" class="btn-ghost" data-wl="tpl">แม่แบบของฉัน</button>' : '') +
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
    if (o.all) h += filtersHtml(o);
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
        h += '<tr class="wl-addrow"><td colspan="' + (cols - 2) + '"><button type="button" class="wl-add" data-wl="add" data-date="' + d + '">+ เพิ่มแถว</button>' +
          '<button type="button" class="wl-add" data-wl="copy" data-date="' + d + '">คัดลอกวันก่อน</button>' +
          '<button type="button" class="wl-add" data-wl="fill" data-date="' + d + '">เติมจากแม่แบบ</button></td></tr>';
      }
      h += '</tbody>';
    });
    h += '</table></div>';
    $('#view').innerHTML = h;
    if (W.edit) openEditor(W.edit.id, W.edit.field, true);
  }
  function segHtml(o) {
    if (!W.data.isLead) return '';
    return '<div class="seg wl-seg"><a href="' + hashFor({ all: false, phone: o.phone, day: o.day, from: o.from }) + '"' + (o.all ? '' : ' class="on"') + '>ของฉัน</a>' +
      '<a href="' + hashFor({ all: true, phone: o.phone, day: o.day, from: o.from, staff: 'all' }) + '"' + (o.all ? ' class="on"' : '') + '>ทั้งทีม</a></div>';
  }
  function filtersHtml(o) {
    var j = W.data;
    return '<div class="wl-filters">' +
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
      '<td class="wl-pics">' + pics(r, mine && !r.draft) + '</td>' +
      '<td class="wl-act">' + (r.draft ? '' : '<button type="button" class="wl-x wl-h" data-wl="hist" title="ประวัติการแก้ไข" aria-label="ประวัติการแก้ไข">' + ICON_CLOCK + '</button>') +
        (mine && !r.draft ? '<button type="button" class="wl-x" data-wl="del" title="ลบแถวนี้" aria-label="ลบแถวนี้">×</button>' : '') + '</td>' +
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
  /* can = แถวของตัวเองบนจอใหญ่ — มีปุ่ม + รูป และ × ลบรูป */
  function pics(r, can) {
    var list = r.files || [];
    if (!list.length && !can) return '';
    return '<div class="wl-thumbs' + (list.length ? '' : ' empty') + '">' + list.map(function (f) {
      var full = X.API + '/worklog/files/' + encodeURIComponent(f.id);
      return '<span class="wl-tw"><span class="att img wl-thumb" role="button" tabindex="0" data-src="' + esc(full) + '" title="' + esc(f.name) + '" ' +
        'style="background-image:url(\'' + esc(full + (f.thumb ? '?thumb=1' : '')) + '\')"></span>' +
        (can ? '<button type="button" class="wl-tx" data-wl="picdel" data-fid="' + esc(f.id) + '" aria-label="ลบรูปนี้" title="ลบรูปนี้">×</button>' : '') + '</span>';
    }).join('') +
      (can && list.length < MAX_PICS ? '<label class="wl-addpic" title="แนบรูป (ย่อให้อัตโนมัติ)"><input type="file" accept="image/*" multiple data-wl-pic hidden>+ รูป</label>' : '') +
      '</div>';
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
    if (field === 'work' && X.listEdit) X.listEdit(inp);
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
    if (o.phone) { openForm(null, date || o.day); return; }
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
    W.menuAt = Date.now();
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

  function delRow(id, fromForm) {
    var r = rowById(id);
    if (!r) return;
    var first = String(r.work || '').split('\n')[0].slice(0, 60);
    if (!confirm('ลบแถวนี้?\n' + (r.slot ? r.slot + '  ' : '') + first)) return;
    api('/worklog/' + encodeURIComponent(id), 'DELETE').then(function () {
      W.data.rows = W.data.rows.filter(function (x) { return x.id !== id; });
      if (fromForm) closeForm(true);
      paint();
      toast('ลบแล้ว');
    }).catch(fail);
  }

  /* ============================================================
     มือถือ: ทีละวัน — การ์ดต่อแถว (ชิปเวลาชมพู · งาน · ปุ่ม Process) · reason/รูปโชว์เฉพาะตอนมี
     ปุ่มล่าง: คัดลอกวันก่อน · เพิ่มแถว · แตะการ์ด = เปิดฟอร์มแก้
     ============================================================ */
  function paintPhone() {
    var j = W.data, o = W.o, d = o.day;
    var today = j.today || localToday();
    var ro = X.readOnly();
    var h = '<div class="wl-mtop"><div><span class="kicker">งานทีม</span><h1>บันทึกงานรายวัน</h1></div>' + segHtml(o) + '</div>' +
      '<div class="wl-mtools"><a class="btn-ghost" href="#/log/search">ค้นหา</a>' +
      (!o.all && !ro ? '<button type="button" class="btn-ghost" data-wl="tpl">แม่แบบของฉัน</button>' : '') + '</div>';
    h += '<div class="wl-mday">' +
      '<a class="wl-mnav" href="' + hashFor(o, addDays(d, -1)) + '" aria-label="วันก่อน">‹</a>' +
      '<label class="wl-mdate"><span><b>' + DAY_EN[wd(d)] + '</b> ' + esc(thShort(d)) + ' ' + (Number(d.slice(0, 4)) + 543) +
        (d === today ? ' <em>วันนี้</em>' : '') + '</span>' +
        '<input type="date" data-wl-day value="' + d + '" aria-label="เลือกวันที่"></label>' +
      '<a class="wl-mnav" href="' + hashFor(o, addDays(d, 1)) + '" aria-label="วันถัดไป">›</a></div>';
    if (d !== today) h += '<a class="wl-mtoday" href="' + hashFor(o, today) + '">กลับไปวันนี้</a>';
    if (o.all) {
      var nf = (o.staff !== 'all' ? 1 : 0) + (o.branch ? 1 : 0) + (o.status ? 1 : 0);
      h += '<details class="wl-mfilter"' + (nf ? ' open' : '') + '><summary>ตัวกรอง' + (nf ? ' (' + nf + ')' : '') + '</summary>' + filtersHtml(o) + '</details>';
    }
    var rows = j.rows.slice().sort(function (a, b) {
      return (a.staffId === b.staffId ? 0 : (staffFull(a.staffId).localeCompare(staffFull(b.staffId)) || (a.staffId < b.staffId ? -1 : 1))) ||
        (slotKey(a.slot) - slotKey(b.slot)) || ((a.sort || 0) - (b.sort || 0));
    });
    h += '<div class="wl-cards">';
    if (!rows.length) {
      h += '<div class="wl-mempty">' + (o.all ? 'ไม่มีบันทึกของวันนี้' + (o.staff !== 'all' || o.branch || o.status ? ' ตามตัวกรอง' : '')
        : 'ยังไม่มีบันทึกของวันนี้' + (!ro ? '<small>กด “คัดลอกวันก่อน” “เติมจากแม่แบบ” หรือ “เพิ่มแถว” ด้านล่าง</small>' : '')) + '</div>';
    }
    rows.forEach(function (r, k) {
      if (o.all && (k === 0 || rows[k - 1].staffId !== r.staffId)) h += '<h3 class="wl-mwho">' + esc(staffFull(r.staffId)) + '</h3>';
      h += cardHtml(r);
    });
    h += '</div>';
    if (!o.all && !ro) {
      h += '<div class="wl-mbar"><button type="button" class="btn-ghost" data-wl="copy" data-date="' + d + '">คัดลอกวันก่อน</button>' +
        '<button type="button" class="btn-ghost" data-wl="fill" data-date="' + d + '">เติมจากแม่แบบ</button>' +
        '<button type="button" class="btn" data-wl="add" data-date="' + d + '">+ เพิ่มแถว</button></div>';
    }
    $('#view').innerHTML = h;
  }
  function cardHtml(r) {
    var mine = canEditRow(r);
    var tags = '';
    if (r.carriedFromDate) tags += '<span class="wl-tag">↪ ยกมาจาก ' + esc(thShort(r.carriedFromDate)) + '</span>';
    if (r.carriedToDate) tags += '<span class="wl-tag mut">ยกไป ' + esc(thShort(r.carriedToDate)) + ' →</span>';
    var picking = W.pick === r.id;
    return '<article class="wl-card' + (mine ? ' mine' : '') + '" data-id="' + esc(r.id) + '"' + (mine ? ' tabindex="0" aria-label="แก้แถวนี้"' : '') + '>' +
      '<div class="wl-chead"><span class="wl-chip">' + esc(r.slot || 'ไม่ระบุเวลา') + '</span>' + tags + '</div>' +
      (String(r.work || '').trim() ? '<div class="wl-cwork">' + esc(r.work) + '</div>' : '<div class="wl-cwork wl-ph">(ยังไม่ได้พิมพ์งาน)</div>') +
      (r.reason ? '<div class="wl-creason"><b>reason</b> ' + esc(r.reason) + '</div>' : '') +
      (r.files && r.files.length ? pics(r) : '') +
      '<div class="wl-cfoot">' + (mine
        ? '<button type="button" class="wl-pill big ' + r.status + '" data-wl="mpick" aria-expanded="' + picking + '">' + esc(STATUS_TH[r.status] || r.status) + '<i aria-hidden="true">▾</i></button>'
        : '<span class="wl-pill big ' + r.status + '">' + esc(STATUS_TH[r.status] || r.status) + '</span>') +
        (mine ? '<span class="wl-cedit" aria-hidden="true">แก้ไข ›</span>'
          : '<button type="button" class="wl-chist" data-wl="hist">' + ICON_CLOCK + ' ประวัติ</button>') + '</div>' +
      (picking ? '<div class="wl-picks" role="listbox">' + STATUS.map(function (s2) {
        return '<button type="button" role="option" class="wl-pill big ' + s2.k + (s2.k === r.status ? ' on' : '') + '" data-wl="mset" data-st="' + s2.k + '">' + s2.th + '</button>';
      }).join('') + '</div>' : '') +
      '</article>';
  }
  function mSetStatus(id, st) {
    var r = rowById(id);
    W.pick = null;
    if (!r) return;
    if (st === r.status) { paint(); return; }
    if (st === 'blocked' && !String(r.reason || '').trim()) {
      paint();
      openForm(r, null, { status: 'blocked', focus: 'reason' });
      toast('“ติดปัญหา” ต้องใส่ reason ก่อนบันทึก');
      return;
    }
    save1(r, { status: st }).then(function () { paint(); });
  }
  function haveOn(d) { return W.data.rows.filter(function (r) { return r.staffId === meId() && r.date === d; }).length; }
  /* คัดลอกวันก่อน — ก๊อปเฉพาะแถวที่ "เสร็จแล้ว" ของวันล่าสุดที่มีบันทึก (ที่ค้างอยู่ระบบยกมาให้เองแล้ว) */
  function copyDay(d) {
    var have = haveOn(d);
    if (have && !confirm(thShort(d) + ' มีอยู่แล้ว ' + have + ' แถว — คัดลอกแถวของวันก่อนมาต่อท้ายอีกไหม?')) return;
    api('/worklog/copy', 'POST', { to: d }).then(function (j) {
      toast('คัดลอกมาแล้ว ' + j.count + ' แถว');
      render(W.route);
    }).catch(fail);
  }

  /* ============================================================
     ฟอร์มเพิ่ม/แก้แถว (มือถือ) — เต็มจอ · ปุ่มบันทึกใหญ่ปุ่มเดียว
     รูป: ถ่ายรูป / เลือกจากคลัง → ย่อในเครื่องก่อนส่ง (ภาพใหญ่ ~1600px + รูปย่อ 240px)
     ============================================================ */
  var F = null;
  function openForm(row, date, preset) {
    closeForm(true);
    preset = preset || {};
    var slots = (W.data && W.data.slots) || [];
    var mine = W.data ? W.data.rows.filter(function (r) { return r.staffId === meId() && r.date === (row ? row.date : date); }) : [];
    var v = row ? { date: row.date, slot: row.slot || '', work: row.work || '', status: preset.status || row.status, reason: row.reason || '' }
      : { date: date || W.o.day, slot: nextSlot(mine), work: '- ', status: 'done', reason: '' };
    F = { row: row, pending: [], removed: [], busy: false, start: null };
    var custom = v.slot && slots.indexOf(v.slot) === -1;
    var host = document.createElement('div');
    host.className = 'wl-sheet';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-label', row ? 'แก้ไขแถว' : 'เพิ่มแถว');
    host.innerHTML = '<form class="wl-form" novalidate>' +
      '<header class="wl-fhead"><button type="button" class="wl-fx" data-f-close aria-label="ปิด">✕</button>' +
        '<b>' + (row ? 'แก้ไขแถว' : 'เพิ่มแถว') + '</b><span></span></header>' +
      '<div class="wl-fbody">' +
      '<div class="wl-frow2"><label class="wl-field"><span>วันที่ (M/D/Y)</span><input class="input" type="date" name="date" value="' + esc(v.date) + '" required></label>' +
        '<div class="wl-field"><span>Day</span><output class="wl-fday" name="day">' + DAY_EN[wd(v.date)] + '</output></div></div>' +
      '<label class="wl-field"><span>Time</span><select class="select" name="slotSel">' +
        slots.map(function (x) { return '<option' + (x === v.slot ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') +
        '<option value="__other"' + (custom || !v.slot && !slots.length ? ' selected' : '') + '>อื่นๆ (พิมพ์เอง)</option></select>' +
        '<input class="input wl-fother" name="slotOther" placeholder="เช่น 09.00-10.00" maxlength="40" value="' + esc(custom ? v.slot : '') + '"' + (custom ? '' : ' hidden') + '></label>' +
      '<label class="wl-field"><span>Work <small>หนึ่งบรรทัดต่องาน — กด Enter ขึ้นบรรทัดใหม่ได้ “- ” ให้เอง</small></span>' +
        '<textarea class="textarea" name="work" rows="5">' + esc(v.work) + '</textarea></label>' +
      '<div class="wl-field"><span>Process</span><div class="wl-fst" role="radiogroup">' + STATUS.map(function (s2) {
        return '<button type="button" role="radio" aria-checked="' + (s2.k === v.status) + '" class="wl-pill big ' + s2.k + (s2.k === v.status ? ' on' : '') + '" data-f-st="' + s2.k + '">' + s2.th + '</button>';
      }).join('') + '</div></div>' +
      '<label class="wl-field"><span>reason <small class="wl-freq"' + (v.status === 'blocked' ? '' : ' hidden') + '>ต้องใส่ เพราะเลือก “ติดปัญหา”</small></span>' +
        '<textarea class="textarea" name="reason" rows="2" placeholder="เช่น ทำไมช้า / จะเสร็จเมื่อไหร่">' + esc(v.reason) + '</textarea></label>' +
      '<div class="wl-field"><span>แนบรูปงาน</span><div class="wl-fpics"></div>' +
        '<div class="wl-fpicbtns"><label class="btn-ghost"><input type="file" accept="image/*" capture="environment" data-f-file hidden>ถ่ายรูป</label>' +
        '<label class="btn-ghost"><input type="file" accept="image/*" multiple data-f-file hidden>เลือกจากคลังรูป</label></div></div>' +
      (row ? '<div class="wl-flinks"><button type="button" class="wl-fdel" data-f-del>ลบแถวนี้</button>' +
        '<button type="button" class="wl-fhist" data-f-hist>' + ICON_CLOCK + ' ประวัติการแก้ไข</button></div>' : '') +
      '</div>' +
      '<footer class="wl-ffoot"><button type="submit" class="btn wl-fsave">บันทึก</button></footer>' +
      '</form>';
    document.body.appendChild(host);
    document.documentElement.classList.add('wl-lock');
    F.host = host;
    F.status = v.status;
    var form = host.querySelector('form');
    if (X.listEdit) X.listEdit(form.work);
    drawPics();
    F.start = snapshot();

    form.addEventListener('submit', function (ev) { ev.preventDefault(); saveForm(); });
    form.date.addEventListener('change', function () { if (isDate(form.date.value)) form.day.value = DAY_EN[wd(form.date.value)]; });
    form.slotSel.addEventListener('change', function () {
      var other = form.slotSel.value === '__other';
      form.slotOther.hidden = !other;
      if (other) form.slotOther.focus();
    });
    host.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t.closest('[data-f-close]')) { closeForm(false); return; }
      var st = t.closest('[data-f-st]');
      if (st) { setFormStatus(st.getAttribute('data-f-st')); return; }
      if (t.closest('[data-f-del]')) { delRow(F.row.id, true); return; }
      if (t.closest('[data-f-hist]')) { openHistory(F.row.id); return; }
      var rm = t.closest('[data-f-rm]');
      if (rm) {
        var k = rm.getAttribute('data-f-rm');
        if (k.indexOf('new:') === 0) F.pending.splice(Number(k.slice(4)), 1);
        else F.removed.push(k);
        drawPics();
        return;
      }
    });
    host.addEventListener('change', function (ev) {
      if (!ev.target.hasAttribute('data-f-file')) return;
      addPics(ev.target.files);
      ev.target.value = '';
    });
    host.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeForm(false); });
    var focus = preset.focus === 'reason' ? form.reason : (row ? null : form.work);
    if (focus) {
      focus.focus();
      var n = focus.value.length;
      try { focus.setSelectionRange(n, n); } catch (e) {}
    }
  }
  function snapshot() {
    var f = F.host.querySelector('form');
    return JSON.stringify([f.date.value, slotOf(f), f.work.value, F.status, f.reason.value, F.pending.length, F.removed.length]);
  }
  function slotOf(f) { return f.slotSel.value === '__other' ? f.slotOther.value.trim() : f.slotSel.value; }
  function setFormStatus(k) {
    F.status = k;
    var host = F.host;
    Array.prototype.forEach.call(host.querySelectorAll('[data-f-st]'), function (b) {
      var on = b.getAttribute('data-f-st') === k;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on);
    });
    host.querySelector('.wl-freq').hidden = k !== 'blocked';
    if (k === 'blocked' && !host.querySelector('form').reason.value.trim()) host.querySelector('form').reason.focus();
  }
  function existingPics() {
    var r = F.row ? rowById(F.row.id) : null;
    return (r && r.files ? r.files : []).filter(function (f) { return F.removed.indexOf(f.id) === -1; });
  }
  function drawPics() {
    var box = F.host.querySelector('.wl-fpics');
    var h = existingPics().map(function (f) {
      var u = X.API + '/worklog/files/' + encodeURIComponent(f.id);
      return '<span class="wl-fpic"><img src="' + esc(u + (f.thumb ? '?thumb=1' : '')) + '" alt="">' +
        '<button type="button" data-f-rm="' + esc(f.id) + '" aria-label="เอารูปนี้ออก">✕</button></span>';
    }).concat(F.pending.map(function (p, i) {
      return '<span class="wl-fpic new"><img src="' + p.thumbDataUrl + '" alt="">' +
        '<button type="button" data-f-rm="new:' + i + '" aria-label="เอารูปนี้ออก">✕</button></span>';
    })).join('');
    box.innerHTML = h;
    box.hidden = !h;
  }
  function addPics(list) {
    var files = Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name); });
    var room = MAX_PICS - existingPics().length - F.pending.length;
    if (files.length > room) { toast('หนึ่งแถวแนบรูปได้ไม่เกิน ' + MAX_PICS + ' รูป', true); files = files.slice(0, Math.max(0, room)); }
    if (!files.length) return;
    var btn = F.host.querySelector('.wl-fsave');
    btn.disabled = true; btn.textContent = 'กำลังย่อรูป…';
    files.reduce(function (p, file) {
      return p.then(function () {
        return shrinkPhoto(file).then(function (ph) { if (F) F.pending.push(ph); }).catch(function (e) { fail(e); });
      });
    }, Promise.resolve()).then(function () {
      if (!F) return;
      btn.disabled = false; btn.textContent = 'บันทึก';
      drawPics();
    });
  }
  function closeForm(force) {
    if (!F) return true;
    if (!force && !F.busy && snapshot() !== F.start && !confirm('ทิ้งสิ่งที่แก้ไว้?')) return false;
    F.host.remove();
    document.documentElement.classList.remove('wl-lock');
    F = null;
    return true;
  }
  function saveForm() {
    if (!F || F.busy) return;
    var f = F.host.querySelector('form');
    var work = f.work.value.replace(/\s+$/, '');
    if (/^-?\s*$/.test(work)) { toast('พิมพ์งานก่อนนะ', true); f.work.focus(); return; }
    if (!isDate(f.date.value)) { toast('เลือกวันที่ก่อน', true); f.date.focus(); return; }
    if (F.status === 'blocked' && !f.reason.value.trim()) { toast('“ติดปัญหา” ต้องใส่ reason', true); f.reason.focus(); return; }
    var body = { date: f.date.value, slot: slotOf(f), work: work, status: F.status, reason: f.reason.value.trim() };
    var btn = F.host.querySelector('.wl-fsave');
    F.busy = true; btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    var cur = F;
    var step = cur.row ? api('/worklog/' + encodeURIComponent(cur.row.id), 'PUT', body) : api('/worklog', 'POST', body);
    step.then(function (j) {
      /* บันทึกแถวแล้ว — ถ้ารูปพังทีหลัง ฟอร์มกลายเป็น "แก้ไข" แถวนี้ กดบันทึกซ้ำจะไม่สร้างแถวซ้ำ */
      cur.row = j.row;
      putRow(j.row);
      var chain = Promise.resolve();
      cur.removed.slice().forEach(function (id) {
        chain = chain.then(function () { return api('/worklog/files/' + encodeURIComponent(id), 'DELETE'); })
          .then(function () { cur.removed.splice(cur.removed.indexOf(id), 1); });
      });
      return chain.then(function () {
        return uploadPhotos(j.row.id, cur.pending.slice(), function (n) { cur.pending.splice(0, n); });
      });
    }).then(function () {
      cur.busy = false;
      closeForm(true);
      toast('บันทึกแล้ว');
      render(W.route);
    }).catch(function (e) {
      cur.busy = false;
      if (F === cur) { btn.disabled = false; btn.textContent = 'บันทึก'; drawPics(); F.start = null; }
      fail(e);
    });
  }

  /* ============================================================
     รูป — ย่อในเครื่องก่อนส่ง (ภาพใหญ่ ~1600px + รูปย่อ 240px ไว้โชว์ในตาราง) · ใช้ทั้งฟอร์มมือถือและตารางจอใหญ่
     ============================================================ */
  function shrinkPhoto(file) {
    return Promise.all([X.resizeImage(file, 1600, 0.82), X.resizeImage(file, 240, 0.7)]).then(function (out) {
      return { fileName: (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', dataUrl: out[0], thumbDataUrl: out[1] };
    });
  }
  /* ส่งทีละ 6 รูป (เพดานต่อครั้งของเซิร์ฟเวอร์) · done(n) = บอกว่าส่งผ่านไปแล้วกี่รูป */
  function uploadPhotos(rowId, list, done) {
    var chain = Promise.resolve();
    for (var i = 0; i < list.length; i += 6) (function (part) {
      chain = chain.then(function () { return api('/worklog/' + encodeURIComponent(rowId) + '/files', 'POST', { files: part }); })
        .then(function () { if (done) done(part.length); });
    })(list.slice(i, i + 6));
    return chain;
  }
  function onlyImages(list) {
    return Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name); });
  }
  /* จอใหญ่: ปุ่ม + รูป ในช่องแนบรูปงาน */
  function deskPics(id, fileList) {
    var r = rowById(id);
    if (!r) return;
    var files = onlyImages(fileList);
    var room = MAX_PICS - (r.files || []).length;
    if (files.length > room) { toast('หนึ่งแถวแนบรูปได้ไม่เกิน ' + MAX_PICS + ' รูป', true); files = files.slice(0, Math.max(0, room)); }
    if (!files.length) return;
    toast('กำลังย่อและอัปโหลด ' + files.length + ' รูป…');
    var out = [];
    files.reduce(function (p, f) { return p.then(function () { return shrinkPhoto(f).then(function (ph) { out.push(ph); }); }); }, Promise.resolve())
      .then(function () { return uploadPhotos(id, out); })
      .then(function () { return api('/worklog/' + encodeURIComponent(id)); })
      .then(function (j) { putRow(j.row); paint(); toast('แนบรูปแล้ว'); })
      .catch(function (e) { fail(e); render(W.route); });
  }
  function delPic(rowId, fid) {
    if (!confirm('ลบรูปนี้?')) return;
    api('/worklog/files/' + encodeURIComponent(fid), 'DELETE').then(function () {
      var r = rowById(rowId);
      if (r) r.files = (r.files || []).filter(function (f) { return f.id !== fid; });
      paint();
      toast('ลบรูปแล้ว');
    }).catch(fail);
  }

  /* ============================================================
     หน้าต่างลอยทั่วไป (แม่แบบ / ประวัติ) — หน้าตาชุดเดียวกับฟอร์ม · มือถือเต็มจอ
     ============================================================ */
  var SH = null;
  function openSheet(title, body, foot, opt) {
    closeSheet(true);
    opt = opt || {};
    var host = document.createElement('div');
    host.className = 'wl-sheet' + (opt.wide ? ' wide' : '');
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-label', title);
    host.innerHTML = '<div class="wl-form">' +
      '<header class="wl-fhead"><button type="button" class="wl-fx" data-s-close aria-label="ปิด">✕</button><b>' + esc(title) + '</b><span></span></header>' +
      '<div class="wl-fbody">' + body + '</div>' + (foot ? '<footer class="wl-ffoot">' + foot + '</footer>' : '') + '</div>';
    document.body.appendChild(host);
    document.documentElement.classList.add('wl-lock');
    SH = { host: host, canClose: opt.canClose };
    host.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-s-close]') || ev.target === host) closeSheet(false);
    });
    host.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); closeSheet(false); } });
    var f = host.querySelector('[data-s-close]');
    if (f) f.focus();
    return host;
  }
  function closeSheet(force) {
    if (!SH) return;
    if (!force && SH.canClose && !SH.canClose()) return;
    SH.host.remove();
    SH = null;
    if (!F) document.documentElement.classList.remove('wl-lock');
  }

  /* ============================================================
     แม่แบบประจำวัน — แถวที่ทำทุกวัน (เช็คสื่อ · ตอบแชท · พัก …) ตั้งไว้ครั้งเดียว กด "เติมจากแม่แบบ" ได้ทั้งชุด
     ============================================================ */
  function tplRowHtml(t) {
    return '<div class="wl-trow">' +
      '<input class="input wl-tslot" list="wlTplSlots" value="' + esc(t.slot || '') + '" placeholder="เวลา เช่น 10.00-10.30" maxlength="40" aria-label="Time">' +
      '<textarea class="textarea wl-twork" rows="2" placeholder="- งาน /" aria-label="Work">' + esc(t.work || '') + '</textarea>' +
      '<select class="select wl-tst" aria-label="Process">' + STATUS.filter(function (x) { return x.k !== 'blocked'; }).map(function (x) {
        return '<option value="' + x.k + '"' + (x.k === (t.status || 'done') ? ' selected' : '') + '>' + x.th + '</option>';
      }).join('') + '</select>' +
      '<div class="wl-tbtns"><button type="button" class="wl-tb" data-t="up" aria-label="เลื่อนขึ้น">↑</button>' +
      '<button type="button" class="wl-tb" data-t="down" aria-label="เลื่อนลง">↓</button>' +
      '<button type="button" class="wl-tb del" data-t="rm" aria-label="ลบแถวนี้">×</button></div></div>';
  }
  function readTpl(host) {
    return Array.prototype.map.call(host.querySelectorAll('.wl-trow'), function (el) {
      return { slot: el.querySelector('.wl-tslot').value.trim(), work: el.querySelector('.wl-twork').value.replace(/\s+$/, ''), status: el.querySelector('.wl-tst').value };
    }).filter(function (x) { return x.slot || x.work.replace(/^-\s*$/, ''); });
  }
  function openTemplate(fillDate) {
    api('/worklog/template').then(function (j) {
      var rows = j.rows || [];
      var start = JSON.stringify(rows.map(function (x) { return { slot: x.slot, work: x.work, status: x.status }; }));
      /* วันที่จะดึงแถวมาเป็นแม่แบบ = วันที่ดูอยู่ (มือถือ) หรือวันล่าสุดที่มีแถวของฉันในสัปดาห์นี้ */
      var src = W.o.phone ? W.o.day : (W.data.rows.filter(function (r) { return r.staffId === meId(); }).map(function (r) { return r.date; }).sort().pop() || '');
      var body = '<p class="wl-note">แถวที่ทำทุกวัน ตั้งไว้ครั้งเดียว แล้วกด “เติมจากแม่แบบ” ในวันไหนก็ได้ ระบบใส่ให้ทั้งชุด</p>' +
        (src && haveOn(src) ? '<button type="button" class="btn-ghost wl-tfrom" data-t="from">ใช้แถวของ ' + esc(thShort(src)) + ' เป็นแม่แบบ</button>' : '') +
        '<datalist id="wlTplSlots">' + ((W.data && W.data.slots) || []).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
        '<div class="wl-tlist">' + rows.map(tplRowHtml).join('') + '</div>' +
        '<button type="button" class="btn-ghost wl-tadd" data-t="add">+ เพิ่มแถวแม่แบบ</button>';
      var host = openSheet('แม่แบบของฉัน', body, '<button type="button" class="btn wl-fsave" data-t="save">บันทึกแม่แบบ</button>', {
        wide: true,
        canClose: function () { return JSON.stringify(readTpl(host)) === start || confirm('ทิ้งแม่แบบที่แก้ไว้?'); },
      });
      var list = host.querySelector('.wl-tlist');
      if (!rows.length) list.innerHTML = tplRowHtml({ slot: ((W.data && W.data.slots) || [])[0] || '', work: '- ', status: 'done' });
      host.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-t]');
        if (!b) return;
        var k = b.getAttribute('data-t'), row = b.closest('.wl-trow');
        if (k === 'add') {
          list.insertAdjacentHTML('beforeend', tplRowHtml({ slot: '', work: '- ', status: 'done' }));
          list.lastElementChild.querySelector('.wl-tslot').focus();
        } else if (k === 'rm' && row) row.remove();
        else if (k === 'up' && row && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling);
        else if (k === 'down' && row && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row);
        else if (k === 'from') {
          var mine = W.data.rows.filter(function (r) { return r.staffId === meId() && r.date === src; })
            .sort(function (a, c) { return slotKey(a.slot) - slotKey(c.slot) || (a.sort || 0) - (c.sort || 0); });
          if (readTpl(host).length && !confirm('แทนที่แม่แบบเดิมด้วยแถวของ ' + thShort(src) + '?')) return;
          list.innerHTML = mine.map(function (r) { return tplRowHtml({ slot: r.slot, work: r.work, status: r.status === 'blocked' ? 'doing' : r.status }); }).join('');
        } else if (k === 'save') {
          var data = readTpl(host);
          b.disabled = true;
          api('/worklog/template', 'PUT', { rows: data }).then(function () {
            start = JSON.stringify(data);
            closeSheet(true);
            toast('บันทึกแม่แบบแล้ว (' + data.length + ' แถว)');
            if (fillDate && data.length && confirm('เติมแม่แบบลงวันที่ ' + thShort(fillDate) + ' เลยไหม?')) fillTemplate(fillDate);
          }).catch(function (e) { b.disabled = false; fail(e); });
        }
      });
      Array.prototype.forEach.call(host.querySelectorAll('.wl-twork'), function (t) { if (X.listEdit) X.listEdit(t); });
      host.addEventListener('focusin', function (ev) { if (ev.target.classList.contains('wl-twork') && X.listEdit) X.listEdit(ev.target); });
    }).catch(fail);
  }
  function fillTemplate(d) {
    var have = haveOn(d);
    if (have && !confirm(thShort(d) + ' มีอยู่แล้ว ' + have + ' แถว — เติมแม่แบบต่อท้ายอีกไหม?')) return;
    api('/worklog/template/fill', 'POST', { date: d }).then(function (j) {
      toast('เติมจากแม่แบบแล้ว ' + j.count + ' แถว');
      render(W.route);
    }).catch(function (e) {
      if (/แม่แบบ/.test(e.message || '')) { toast('ยังไม่มีแม่แบบ — ตั้งแถวประจำก่อน'); openTemplate(d); return; }
      fail(e);
    });
  }

  /* ============================================================
     ประวัติการแก้ไขรายแถว — ใคร แก้อะไร เมื่อไหร่ (จาก audit_log ชุดเดียวกับหน้า "ประวัติการแก้ไข" รวม)
     ============================================================ */
  function fmtWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getDate() + ' ' + MON_TH[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function histVal(k, v) {
    if (v === '' || v == null) return '<i class="wl-mut">(ว่าง)</i>';
    if (k === 'status') return '<span class="wl-pill ' + esc(v) + '">' + esc(STATUS_TH[v] || v) + '</span>';
    if (k === 'work_date' && isDate(v)) return esc(DAY_EN[wd(v)] + ' ' + mdy(v));
    if (k === '__files') return esc(v) + ' รูป';
    return '<span class="wl-hv">' + esc(v) + '</span>';
  }
  var HIST_ACT = { create: 'สร้างแถว', update: 'แก้ไข', delete: 'ลบ' };
  function openHistory(id) {
    var r = rowById(id);
    api('/worklog/' + encodeURIComponent(id) + '/history').then(function (j) {
      var items = j.items || [];
      var h = items.map(function (it) {
        var who = X.staffById(it.by);
        var showSum = it.action !== 'update' || !it.fields.length || /รูป/.test(it.summary);
        return '<li class="wl-hi"><div class="wl-hh"><b>' + esc(who ? who.name : it.by) + '</b> · ' + esc(HIST_ACT[it.action] || it.action) +
          (showSum && it.summary && it.summary !== 'สร้าง' ? ' — ' + esc(it.summary) : '') +
          '<time>' + esc(fmtWhen(it.at)) + '</time></div>' +
          (it.fields.length ? '<table class="wl-hf">' + it.fields.map(function (f) {
            return '<tr><th>' + esc(f.th) + '</th><td>' + histVal(f.k, f.from) + '</td><td class="wl-harr">→</td><td>' + histVal(f.k, f.to) + '</td></tr>';
          }).join('') + '</table>' : '') + '</li>';
      }).join('');
      /* แถวที่ระบบยกมาเอง ไม่มีคนสร้าง — บอกที่มาไว้ล่างสุด (= เหตุการณ์แรก) */
      if (j.source === 'carry') h += '<li class="wl-hi"><div class="wl-hh"><b>ระบบ</b> · ยกงานค้างมาจาก ' + esc(r && r.carriedFromDate ? thShort(r.carriedFromDate) : 'วันก่อน') + '</div></li>';
      if (!h) h = '<li class="wl-hi wl-mut">ยังไม่มีประวัติ</li>';
      var title = r ? ((r.slot ? r.slot + ' · ' : '') + thShort(r.date)) : '';
      openSheet('ประวัติการแก้ไข', (title ? '<p class="wl-note">' + esc(title) + (r && r.staffId !== meId() ? ' · ' + esc(staffFull(r.staffId)) : '') + '</p>' : '') +
        '<ol class="wl-hlist">' + h + '</ol>', '');
    }).catch(fail);
  }

  /* ============================================================
     ค้นหา — Work + reason ทุกช่วงวันที่ (ค่าเริ่มต้น 90 วันล่าสุด) · กดผลลัพธ์ = ไปวัน/สัปดาห์นั้น
     ============================================================ */
  function renderSearch(o, v, key) {
    var today = localToday();
    var to = o.t || today, from = o.f || addDays(to, -90);
    var isLead = W.data ? W.data.isLead : false;
    var form = function (res) {
      var lead = res ? res.isLead : isLead;
      return '<div class="top wl-top"><div><span class="kicker">บันทึกงานรายวัน</span><h1>ค้นหาบันทึก <span class="en">Search</span></h1>' +
        '<p>ค้นในช่อง Work และ reason · ไม่ใส่ช่วงวันที่ = 90 วันล่าสุด</p></div>' +
        '<div class="top-r"><a class="btn-ghost" href="#/log">กลับไปบันทึกงาน</a></div></div>' +
        '<form class="wl-sform" data-wl-search><input class="input" name="q" type="search" value="' + esc(o.q) + '" placeholder="พิมพ์คำที่จะค้น เช่น โรงพิมพ์, ป้าย, 11.11" maxlength="100" aria-label="คำค้น">' +
        '<label>ตั้งแต่<input class="input" type="date" name="f" value="' + esc(from) + '"></label>' +
        '<label>ถึง<input class="input" type="date" name="t" value="' + esc(to) + '"></label>' +
        (lead ? '<label>คน<select class="select" name="s"><option value="">ทั้งทีม</option>' +
          ((res && res.staff) || (W.data && W.data.staff) || []).filter(function (x) { return x.active; }).map(function (x) {
            return '<option value="' + esc(x.id) + '"' + (o.staff === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>';
          }).join('') + '</select></label>' : '') +
        '<button type="submit" class="btn">ค้นหา</button></form>';
    };
    v.innerHTML = form(null) + (o.q ? '<div class="loading">กำลังค้นหา…</div>' : '<p class="wl-note">พิมพ์คำแล้วกดค้นหา</p>');
    if (!o.q) { W.key = key; return Promise.resolve(); }
    W.key = key;
    var staffQ = o.staff ? '&staff=' + encodeURIComponent(o.staff) : '';
    /* ต้องรู้ชื่อทีมกับสิทธิ์หัวหน้า — ใช้คำตอบของหน้าบันทึกวันนี้ (เบา: วันเดียว) */
    return Promise.all([api('/worklog/search?q=' + encodeURIComponent(o.q) + '&from=' + from + '&to=' + to + staffQ),
                        W.data ? Promise.resolve(W.data) : api('/worklog')]).then(function (out) {
      if (W.key !== key) return;
      var res = out[0], base = out[1];
      if (!W.data) W.data = base;
      var rows = res.rows || [];
      var h = form(base) + '<p class="wl-scount">เจอ ' + rows.length + (res.more ? '+ ' : ' ') + 'แถว' + (res.more ? ' — แสดง 200 แถวแรก ลองจำกัดช่วงวันที่ให้แคบลง' : '') + '</p>';
      var last = '';
      h += '<div class="wl-sres">';
      rows.forEach(function (r) {
        if (r.date !== last) { h += '<h3 class="wl-sday">' + DAY_EN[wd(r.date)] + ' ' + mdy(r.date) + ' <small>' + esc(thShort(r.date)) + '</small></h3>'; last = r.date; }
        var mine = r.staffId === meId();
        var href = mine ? '#/log?d=' + r.date : '#/log/all?d=' + r.date + '&s=' + encodeURIComponent(r.staffId);
        h += '<a class="wl-sitem" href="' + href + '"><span class="wl-chip">' + esc(r.slot || '—') + '</span>' +
          (base.isLead ? '<b class="wl-swho">' + esc(staffFull(r.staffId)) + '</b>' : '') +
          '<span class="wl-pill ' + r.status + '">' + esc(STATUS_TH[r.status] || r.status) + '</span>' +
          '<div class="wl-swork">' + mark(r.work, o.q) + '</div>' +
          (r.reason ? '<div class="wl-sreason"><b>reason</b> ' + mark(r.reason, o.q) + '</div>' : '') + '</a>';
      });
      h += '</div>';
      v.innerHTML = h;
    }).catch(function (e) {
      v.innerHTML = form(null) + '<div class="err"><b>ค้นหาไม่สำเร็จ</b><p>' + esc(e.message || e) + '</p></div>';
    });
  }
  /* ไฮไลต์คำที่ค้นเจอ — escape ทุกส่วนก่อนห่อ <mark> */
  function mark(text, q) {
    text = String(text || '');
    if (!q) return esc(text);
    var low = text.toLowerCase(), ql = q.toLowerCase(), out = '', i = 0, k;
    while ((k = low.indexOf(ql, i)) !== -1) {
      out += esc(text.slice(i, k)) + '<mark>' + esc(text.slice(k, k + q.length)) + '</mark>';
      i = k + q.length;
    }
    return out + esc(text.slice(i));
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
        var card = act.closest('.wl-card');
        if (a === 'mpick' && card) { W.pick = W.pick === card.getAttribute('data-id') ? null : card.getAttribute('data-id'); paint(); return; }
        if (a === 'mset' && card) { mSetStatus(card.getAttribute('data-id'), act.getAttribute('data-st')); return; }
        if (a === 'copy') { copyDay(act.getAttribute('data-date') || W.o.day); return; }
        if (a === 'fill') { fillTemplate(act.getAttribute('data-date') || W.o.day); return; }
        if (a === 'tpl') { openTemplate(); return; }
        var hr = act.closest('[data-id]');
        if (a === 'hist' && hr) { openHistory(hr.getAttribute('data-id')); return; }
        if (a === 'picdel' && tr) { delPic(tr.getAttribute('data-id'), act.getAttribute('data-fid')); return; }
      }
      /* แตะการ์ดของตัวเอง (ไม่ใช่ปุ่ม/รูป) = เปิดฟอร์มแก้ */
      var mc = t.closest('.wl-card.mine');
      if (mc && !t.closest('button, .wl-thumb, a')) { openForm(rowById(mc.getAttribute('data-id'))); return; }
      if (t.closest('.wl-addpic')) return;   /* ปุ่ม + รูป = label ของ input ไฟล์ ปล่อยให้เบราว์เซอร์เปิดตัวเลือกไฟล์ */
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
      if (ev.target.hasAttribute && ev.target.hasAttribute('data-wl-pic') && inPage(ev.target)) {
        var prow = ev.target.closest('.wl-row');
        if (prow) deskPics(prow.getAttribute('data-id'), ev.target.files);
        ev.target.value = '';
        return;
      }
      if (ev.target.hasAttribute && ev.target.hasAttribute('data-wl-day') && inPage(ev.target)) {
        if (isDate(ev.target.value)) location.hash = hashFor(W.o, ev.target.value);
        return;
      }
      var f = ev.target.getAttribute && ev.target.getAttribute('data-wlf');
      if (!f || !inPage(ev.target)) return;
      var o = Object.assign({}, W.o);
      o[f] = ev.target.value;
      location.hash = hashFor(o);
    });
    document.addEventListener('submit', function (ev) {
      var f = ev.target;
      if (!f.hasAttribute || !f.hasAttribute('data-wl-search')) return;
      ev.preventDefault();
      var q = ['q=' + encodeURIComponent(f.q.value.trim())];
      if (isDate(f.f.value)) q.push('f=' + f.f.value);
      if (isDate(f.t.value)) q.push('t=' + f.t.value);
      if (f.s && f.s.value) q.push('s=' + encodeURIComponent(f.s.value));
      location.hash = '#/log/search?' + q.join('&');
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
      if (t.classList && t.classList.contains('wl-card') && t.classList.contains('mine') && ev.key === 'Enter') { openForm(rowById(t.getAttribute('data-id'))); return; }
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
    /* หมุนจอ / ย่อหน้าต่างข้ามเส้น 760px → สลับตาราง ↔ การ์ด (ข้อมูลโหลดใหม่ตามช่วงวันของมุมมองนั้น) */
    if (global.matchMedia) {
      var mq = global.matchMedia(PHONE_MQ);
      var flip = function () { if (W.route && W.o && W.o.phone !== mq.matches && /^#\/log/.test(location.hash)) render(W.route); };
      if (mq.addEventListener) mq.addEventListener('change', flip); else if (mq.addListener) mq.addListener(flip);
    }
    /* เลื่อนจอแล้วเมนูลอยค้างผิดที่ → ปิด · แต่เว้นช่วงแรกหลังเปิด (หน้านี้เลื่อนแบบ smooth คลิกแล้วยังเลื่อนต่ออีกนิด) */
    window.addEventListener('scroll', function () { if (Date.now() - (W.menuAt || 0) > 400) closeMenu(); }, { passive: true });
  }

  global.KAN_WORKLOG = {
    init: function (x) { X = x; if (!W.wired) { W.wired = true; wire(); } },
    render: render,
  };
})(window);
