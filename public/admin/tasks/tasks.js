/* ============================================================
   KAN Admin — งานทีม (Task) · SPA (hash route) คุยกับ /api/t/* ใน worker.js
   หน้า: #/me งานของฉัน · #/all งานทั้งหมด · #/new สั่งงาน (วางข้อความ) ·
         #/task/:id รายละเอียด+อัปเดต+รูป · #/kpi KPI 2570 · #/team ทีม+PIN
   ============================================================ */
(function (global) {
  'use strict';

  var API = '/api/t';
  var S = { me: null, staff: [], kpis: [], tasks: null, route: { name: 'me' } };

  /* ---------- KPI 2570 (จากเอกสาร Executive Offer CMO 2027 — ข้อความอ้างอิงในหน้า KPI) ---------- */
  var KPI_DOC = {
    branches: [
      { name: 'KAN Superstore สุราษฎร์ธานี', month: 4000000, year: 48000000, share: '47.1%', newCust: 4500, gate: 3825, goal: 'รักษาฐานเดิม ลด Churn เพิ่ม Customer Value' },
      { name: 'KAN Superstore ชุมพร', month: 1000000, year: 12000000, share: '11.8%', newCust: 3600, gate: 3060, goal: 'ฟื้น Customer Base + Data Capture + Repeat' },
      { name: 'KAN Fashion สุราษฎร์ธานี', month: 1000000, year: 12000000, share: '11.8%', newCust: 3600, gate: 3060, goal: 'เร่งฐานลูกค้า + Repeat + Cross-category' },
      { name: 'KAN Superstore ภูเก็ต', month: 2500000, year: 30000000, share: '29.4%', newCust: 6300, gate: 5355, goal: 'สร้างฐานลูกค้าใหม่ + Omnichannel ตั้งแต่เปิด' }
    ],
    okr: [
      { o: 'Objective 1 — สร้าง Customer Growth Engine ให้ครบทุกสาขา', kr: [
        'Unique New Customer ระดับบริษัท >= 18,000 ราย/ปี พร้อมเป้ารายสาขา',
        'ทุกสาขาผ่าน Minimum Branch Gate และไม่มีสาขาใดหยุดการเติบโตโดยไม่มี Corrective Action Plan',
        'Source Attribution >= 90% และ Customer Identification >= 85%' ] },
      { o: 'Objective 2 — รักษาลูกค้าเดิมและเพิ่ม Customer Value', kr: [
        'Company Churn <= 35% และติดตาม Retention / Repeat / VIP Retention แยกสาขา',
        'CRM, Membership, Privilege และ Win-back ใช้งานจริง',
        'Average Basket / Spend per Visit / Purchase Frequency และ Cross-category เติบโตจากฐานปี 2569' ] },
      { o: 'Objective 3 — สร้าง New Sales Channel และ New S-Curve', kr: [
        'ทุกช่องทางใช้ Process Explore → Business Case → Pilot → Measure → Scale',
        'Scale สำเร็จ >= 3 ช่องทาง/ปี',
        'อย่างน้อย 1 ช่องทางสร้าง New S-Curve Revenue >= เป้าหมายรายได้รวมบริษัท' ] },
      { o: 'Objective 4 — สนับสนุน Revenue 102 ล้านบาทด้วย Growth Plan รายสาขา', kr: [
        'ทุกสาขามี Monthly Demand Plan และ Campaign Calendar เชื่อมกับ Branch Revenue Target',
        'มี Qualified Customer / Revenue Opportunity Pipeline ส่งต่อ COO ตามเป้ารายสาขา',
        'มี Monthly Review CMO–COO เพื่อแก้ Funnel Leakage, Basket, Retention และ Channel Performance' ] }
    ],
    cadence: [
      ['Weekly Growth Review', 'Revenue by branch/day/category · Campaign · Customer Growth · Basket · CRM Issue · Channel Action · Bottleneck'],
      ['Monthly Business Review', 'P&L / Revenue / New & Returning Customer / Basket / Retention / CAC / Channel P&L / KPI Scorecard + Corrective Action'],
      ['Quarterly OKR Review', 'ประเมิน KR · New Channel Scale · New S-Curve Progress · Retention · ยืนยัน Milestone ถัดไปกับ CEO'],
      ['Rolling 6 เดือน', 'Company Revenue Run Rate + KPI Gate เพื่อพิจารณา Step-up Salary'],
      ['Annual Review', 'สรุป KPI เต็มปี · Net Profit · Revenue Milestone · Profit Sharing Eligibility']
    ]
  };

  var STATUS_TH = { todo: 'รอทำ', doing: 'กำลังทำ', done: 'เสร็จแล้ว', blocked: 'ติดปัญหา' };
  var DAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  var MON_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  /* ---------- utils ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  function staffById(id) { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].id === id) return S.staff[i]; return null; }
  function kpiById(id) { for (var i = 0; i < S.kpis.length; i++) if (S.kpis[i].id === id) return S.kpis[i]; return null; }
  function shortName(st) { return st ? String(st.name).split(/\s+/)[0] : '—'; }
  function avatar(st, cls) { return '<span class="av' + (cls ? ' ' + cls : '') + '" title="' + esc(st ? st.name : '') + '">' + esc(initials(st ? st.name : '?')) + '</span>'; }
  function avatars(ids) {
    if (!ids || !ids.length) return '<span class="who" style="color:var(--k-warn)">ยังไม่มอบหมาย</span>';
    var h = '<span class="who"><span class="avs">';
    ids.slice(0, 4).forEach(function (id) { h += avatar(staffById(id)); });
    h += '</span>' + esc(ids.map(function (id) { return shortName(staffById(id)); }).join(', ')) + '</span>';
    return h;
  }
  function kpiChip(id) {
    var k = kpiById(id);
    if (!k) return '';
    return '<span class="kpi-chip" title="' + esc(k.title) + '"><i style="background:' + esc(k.color) + '"></i>' + esc(k.code) + '</span>';
  }
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function sameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }
  function isLate(t) { return t.status !== 'done' && !t.repeat && t.dueAt && new Date(t.dueAt) < new Date(); }
  function isToday(t) { return t.dueAt && sameDay(new Date(t.dueAt), new Date()); }
  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fmtDate(d, withYear) {
    return d.getDate() + ' ' + MON_TH[d.getMonth()] + (withYear ? ' ' + String(d.getFullYear() + 543).slice(-2) : '');
  }
  function fmtDue(t) {
    if (t.repeat === 'daily') return 'ทุกวัน ' + (t.dueAt ? fmtTime(new Date(t.dueAt)) : '');
    if (t.repeat === 'weekly') return 'ทุก' + (t.dueAt ? DAY_TH[new Date(t.dueAt).getDay()] + ' ' + fmtTime(new Date(t.dueAt)) : 'สัปดาห์');
    if (!t.dueAt) return 'ไม่กำหนด';
    var d = new Date(t.dueAt), now = new Date();
    var diff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
    var day;
    if (diff === 0) day = 'วันนี้';
    else if (diff === 1) day = 'พรุ่งนี้';
    else if (diff === -1) day = 'เมื่อวาน';
    else if (diff > 1 && diff < 7) day = DAY_TH[d.getDay()] + ' ' + fmtDate(d);
    else day = fmtDate(d, d.getFullYear() !== now.getFullYear());
    return day + ' ' + fmtTime(d);
  }
  function fmtAgo(iso) {
    if (!iso) return '';
    var d = new Date(iso), now = new Date();
    var m = Math.round((now - d) / 60000);
    if (m < 1) return 'เมื่อกี้';
    if (m < 60) return m + ' นาทีที่แล้ว';
    var h = Math.round(m / 60);
    if (h < 24 && sameDay(d, now)) return h + ' ชม.ที่แล้ว';
    var diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
    if (diff === 1) return 'เมื่อวาน ' + fmtTime(d);
    return fmtDate(d, d.getFullYear() !== now.getFullYear()) + ' ' + fmtTime(d);
  }
  function fmtFull(iso) { if (!iso) return '—'; var d = new Date(iso); return DAY_TH[d.getDay()] + ' ' + fmtDate(d, true) + ' ' + fmtTime(d); }
  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + fmtTime(d);
  }
  function fromLocalInput(v) { if (!v) return null; var d = new Date(v); return isNaN(d) ? null : d.toISOString(); }
  function fmtBaht(n) { return Number(n).toLocaleString('th-TH'); }

  var toastTimer = null;
  function toast(msg, bad) {
    var el = $('#toast');
    el.textContent = msg;
    el.className = 'toast' + (bad ? ' bad' : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, bad ? 4200 : 2600);
  }

  /* ---------- API ---------- */
  function api(path, method, body) {
    var opt = { method: method || 'GET', credentials: 'same-origin', headers: {} };
    if (body !== undefined) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(API + path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { S.me = null; renderLogin(); throw new Error(j.error || 'กรุณาเข้าสู่ระบบ'); }
        if (!r.ok) throw new Error(j.error || ('ผิดพลาด ' + r.status));
        return j;
      });
    });
  }
  function loadTasks(force) {
    if (S.tasks && !force) return Promise.resolve(S.tasks);
    return api('/tasks?scope=all').then(function (j) { S.tasks = j.tasks || []; return S.tasks; });
  }

  /* ---------- sidebar / header ---------- */
  var ROUTE_KEY = { me: '#/me', all: '#/all', new: '#/new', kpi: '#/kpi', team: '#/team', task: '#/all' };
  function renderSidebar() {
    var host = $('#sideHost');
    if (!host || !global.ERP_MENU) return;
    var h = global.ERP_MENU.render({ ctx: 'tasks', active: 'tasks:' + (ROUTE_KEY[S.route.name] || '#/me'),
      salesBase: '../mkt/index.html', cmoBase: '../cmo/', tasksBase: '' });
    h += '<div class="erp-foot">' +
      '<button type="button" class="erp-theme" data-theme-toggle><span id="theme-icon"></span> <span id="theme-label"></span></button>' +
      (global.ERP_MENU.powered || '') + '</div>';
    host.innerHTML = h;
    global.ERP_MENU.wire(host);
    syncTheme();
  }
  function renderHeaderUser() {
    var el = $('#headUser'), tb = $('#topbarUser');
    if (!S.me) { el.innerHTML = ''; tb.textContent = ''; return; }
    el.innerHTML = '<span class="erp-user"><i>' + esc(initials(S.me.name)) + '</i><b>' + esc(S.me.name) + '</b>' +
      '<button type="button" data-logout title="ออกจากระบบ">ออก</button></span>';
    tb.textContent = shortName(S.me);
  }
  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  function setTheme(next) {
    if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('kan-theme', next); } catch (e) {}
    syncTheme();
  }
  function syncTheme() {
    var dark = isDark();
    $$('[data-theme-pick]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-pick') === (dark ? 'dark' : 'light') ? 'true' : 'false'); });
    var ic = $('#theme-icon'), lb = $('#theme-label');
    if (ic) ic.textContent = dark ? '☀️' : '🌙';
    if (lb) lb.textContent = dark ? 'โหมดสว่าง' : 'โหมดมืด';
  }

  /* ---------- ล็อกอิน ---------- */
  function renderLogin(err) {
    renderHeaderUser();
    var view = $('#view');
    view.className = 'login';
    view.innerHTML = '<div class="login-card"><h1>KAN Admin — งานทีม</h1><p>เลือกชื่อแล้วใส่ PIN เพื่อเข้าทำงานของคุณ</p>' +
      (err ? '<div class="err" style="margin:16px 0 0"><p>' + esc(err) + '</p></div>' : '') +
      '<form id="loginForm"><div class="field"><label class="label">ชื่อ</label><select class="select" name="staffId" id="loginStaff"><option value="">กำลังโหลดรายชื่อ…</option></select></div>' +
      '<div class="field"><label class="label">PIN</label><input class="input pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="current-password" placeholder="••••"></div>' +
      '<button type="submit" class="btn" id="loginBtn">เข้าสู่ระบบ</button></form>' +
      '<p class="foot">ยังไม่มีชื่อในรายการ หรือลืม PIN — ให้หัวหน้าทีมเพิ่ม/รีเซ็ตให้ในหน้า "ทีม + PIN"</p></div>';
    fetch(API + '/login', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      var sel = $('#loginStaff');
      if (!sel) return;
      var last = '';
      try { last = localStorage.getItem('kan-task-last-staff') || ''; } catch (e) {}
      sel.innerHTML = '<option value="">— เลือกชื่อ —</option>' + (j.staff || []).map(function (s) {
        return '<option value="' + esc(s.id) + '"' + (s.id === last ? ' selected' : '') + '>' + esc(s.name) + (s.role === 'owner' ? ' (หัวหน้า)' : '') + '</option>';
      }).join('');
    }).catch(function () {});
    $('#loginForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var staffId = $('#loginStaff').value, pin = this.pin.value;
      if (!staffId) { toast('เลือกชื่อก่อน', true); return; }
      $('#loginBtn').disabled = true;
      fetch(API + '/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ staffId: staffId, pin: pin }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'เข้าไม่ได้'); return j; }); })
        .then(function () {
          try { localStorage.setItem('kan-task-last-staff', staffId); } catch (e) {}
          return boot();
        })
        .catch(function (e) { renderLogin(e.message); });
    });
  }

  /* ---------- งานของฉัน ---------- */
  function taskRow(t) {
    var late = isLate(t), st = late ? 'late' : t.status;
    var dueCls = late ? 'late' : (isToday(t) && t.status !== 'done' ? 'today' : '');
    var mark = t.status === 'done' ? '✓' : (t.status === 'blocked' ? '!' : '');
    var sub = t.nUpdates > 1 ? ('อัปเดต ' + fmtAgo(t.lastUpdate)) : (t.nFiles ? t.nFiles + ' รูป' : '');
    return '<a class="trow ' + esc(t.status) + '" href="#/task/' + esc(t.id) + '">' +
      '<span class="st ' + esc(st) + '">' + mark + '</span>' +
      '<span class="main"><span class="t">' + (t.priority ? '★ ' : '') + esc(t.title) + '</span>' +
      '<span class="m">' + avatars(t.assignees) + kpiChip(t.kpiId) +
      (t.repeat ? '<span class="pill repeat">' + (t.repeat === 'daily' ? 'ประจำวัน' : 'ประจำสัปดาห์') + '</span>' : '') +
      (t.status === 'doing' ? '<span class="pill doing">กำลังทำ</span>' : '') +
      (t.status === 'blocked' ? '<span class="pill blocked">ติดปัญหา</span>' : '') +
      (t.nFiles ? '<span>📷 ' + t.nFiles + '</span>' : '') + '</span></span>' +
      '<span class="due ' + dueCls + '">' + esc(fmtDue(t)) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
      '<svg class="arr" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></a>';
  }
  function groupList(title, list, cls) {
    if (!list.length) return '';
    return '<div class="group"><div class="group-h' + (cls ? ' ' + cls : '') + '"><h3>' + esc(title) + '</h3><span>' + list.length + '</span></div>' +
      '<div class="tlist">' + list.map(taskRow).join('') + '</div></div>';
  }
  function bucketize(tasks) {
    var now = new Date(), week = new Date(startOfDay(now).getTime() + 7 * 86400000);
    var b = { late: [], today: [], week: [], later: [], nodate: [], repeat: [], done: [] };
    tasks.forEach(function (t) {
      if (t.status === 'done') { b.done.push(t); return; }
      if (t.repeat) { b.repeat.push(t); return; }
      if (!t.dueAt) { b.nodate.push(t); return; }
      var d = new Date(t.dueAt);
      if (d < now && !isToday(t)) b.late.push(t);
      else if (isToday(t)) b.today.push(t);
      else if (d < week) b.week.push(t);
      else b.later.push(t);
    });
    b.done.sort(function (x, y) { return (y.doneAt || y.updatedAt) < (x.doneAt || x.updatedAt) ? -1 : 1; });
    return b;
  }
  function renderMe() {
    loadTasks().then(function (all) {
      var mine = all.filter(function (t) { return t.assignees.indexOf(S.me.id) !== -1; });
      var b = bucketize(mine);
      var open = mine.length - b.done.length;
      var view = $('#view');
      view.className = 'page';
      var h = '<div class="top"><div><span class="kicker">งานของฉัน</span><h1>สวัสดี ' + esc(shortName(S.me)) + '</h1>' +
        '<p>' + (open ? 'มีงานค้าง ' + open + ' รายการ' + (b.late.length ? ' · เลยกำหนด ' + b.late.length : '') + (b.today.length ? ' · ครบกำหนดวันนี้ ' + b.today.length : '') : 'ไม่มีงานค้าง เยี่ยม') +
        '</p></div><div class="top-r"><a class="btn-ghost" href="#/all">ดูงานทั้งหมด</a><a class="btn" href="#/new">+ สั่งงาน</a></div></div>';
      h += '<div class="cards">' +
        '<article class="hot"><span class="l">งานค้างของฉัน</span><b>' + open + '</b><small>ยังไม่เสร็จ รวมงานประจำ</small></article>' +
        '<article' + (b.late.length ? ' class="bad"' : '') + '><span class="l">เลยกำหนด</span><b>' + b.late.length + '</b><small>ต้องเคลียร์ก่อน</small></article>' +
        '<article' + (b.today.length ? ' class="warn"' : '') + '><span class="l">ครบกำหนดวันนี้</span><b>' + b.today.length + '</b><small>' + esc(DAY_TH[new Date().getDay()] + ' ' + fmtDate(new Date())) + '</small></article>' +
        '<article><span class="l">เสร็จแล้ว</span><b>' + b.done.length + '</b><small>ทั้งหมดที่เคยทำ</small></article></div>';
      if (!mine.length) {
        h += '<div class="sec"><div class="empty"><b>ยังไม่มีงานที่มอบหมายให้คุณ</b>เมื่อหัวหน้าสั่งงาน รายการจะขึ้นที่นี่</div></div>';
      } else {
        h += groupList('เลยกำหนด', b.late, 'late') + groupList('วันนี้', b.today) + groupList('ภายใน 7 วัน', b.week) +
          groupList('ถัดไป', b.later) + groupList('ยังไม่กำหนดวัน', b.nodate) + groupList('งานประจำ (อัปเดตทุกวัน)', b.repeat);
        if (b.done.length) {
          h += '<div class="group"><div class="group-h"><h3>เสร็จแล้ว</h3><span>' + b.done.length + '</span>' +
            '<button type="button" class="btn-text" style="margin-left:auto" data-toggle-done>' + (S.showDone ? 'ซ่อน' : 'แสดง') + '</button></div>' +
            (S.showDone ? '<div class="tlist">' + b.done.slice(0, 40).map(taskRow).join('') + '</div>' : '') + '</div>';
        }
      }
      view.innerHTML = h;
    }).catch(function (e) { showError(e); });
  }

  /* ---------- งานทั้งหมด ---------- */
  var F = { who: '', kpi: '', status: 'open', group: 'due' };
  function renderAll() {
    var q = S.route.query || {};
    if (q.kpi) { F.kpi = q.kpi; }
    if (q.who) { F.who = q.who; }
    if (q.status) { F.status = q.status; }
    loadTasks().then(function (all) {
      var now = new Date(), weekAgo = new Date(now.getTime() - 7 * 86400000);
      var open = all.filter(function (t) { return t.status !== 'done'; });
      var late = open.filter(isLate), today = open.filter(function (t) { return isToday(t) && !t.repeat; });
      var doneWeek = all.filter(function (t) { return t.status === 'done' && new Date(t.doneAt || t.updatedAt) > weekAgo; });

      var list = all.filter(function (t) {
        if (F.status === 'open' && t.status === 'done') return false;
        if (F.status === 'done' && t.status !== 'done') return false;
        if (F.status === 'late' && !isLate(t)) return false;
        if (F.who && t.assignees.indexOf(F.who) === -1) return false;
        if (F.kpi === 'none' && t.kpiId) return false;
        if (F.kpi && F.kpi !== 'none' && t.kpiId !== F.kpi) return false;
        return true;
      });

      var view = $('#view');
      view.className = 'page';
      var h = '<div class="top"><div><span class="kicker">งานทั้งหมดของทีม</span><h1>ภาพรวมงาน</h1>' +
        '<p>ทุกงานที่สั่งไว้ แยกดูตามคน ตาม KPI หรือตามกำหนดส่ง — กดที่งานเพื่อดูรายละเอียดและรูปที่ทีมอัปเดต</p></div>' +
        '<div class="top-r"><a class="btn-ghost" href="#/kpi">KPI 2570</a><a class="btn" href="#/new">+ สั่งงาน</a></div></div>';
      h += '<div class="cards">' +
        '<article class="hot" data-go="open"><span class="l">งานค้างทั้งทีม</span><b>' + open.length + '</b><small>รวมงานประจำ</small></article>' +
        '<article' + (late.length ? ' class="bad"' : '') + ' data-go="late"><span class="l">เลยกำหนด</span><b>' + late.length + '</b><small>กดเพื่อดูเฉพาะที่เลยกำหนด</small></article>' +
        '<article' + (today.length ? ' class="warn"' : '') + '><span class="l">ครบกำหนดวันนี้</span><b>' + today.length + '</b><small>' + esc(DAY_TH[now.getDay()] + ' ' + fmtDate(now)) + '</small></article>' +
        '<article data-go="done"><span class="l">เสร็จใน 7 วัน</span><b>' + doneWeek.length + '</b><small>ปิดงานสัปดาห์นี้</small></article></div>';

      h += '<div class="filters"><span class="lbl">คน</span><div class="chips">' +
        '<button type="button" class="chip plain' + (!F.who ? ' on' : '') + '" data-f="who" data-v="">ทุกคน</button>' +
        S.staff.filter(function (s) { return s.active; }).map(function (s) {
          return '<button type="button" class="chip' + (F.who === s.id ? ' on' : '') + '" data-f="who" data-v="' + esc(s.id) + '">' + avatar(s) + esc(shortName(s)) + '</button>';
        }).join('') + '</div></div>';
      h += '<div class="filters"><span class="lbl">KPI</span><div class="chips">' +
        '<button type="button" class="chip plain' + (!F.kpi ? ' on' : '') + '" data-f="kpi" data-v="">ทุก KPI</button>' +
        S.kpis.map(function (k) {
          return '<button type="button" class="chip plain' + (F.kpi === k.id ? ' on' : '') + '" data-f="kpi" data-v="' + esc(k.id) + '" title="' + esc(k.title) + '"><span class="dot" style="background:' + esc(k.color) + '"></span>' + esc(k.code) + '</button>';
        }).join('') + '<button type="button" class="chip plain' + (F.kpi === 'none' ? ' on' : '') + '" data-f="kpi" data-v="none">ไม่ระบุ</button></div>' +
        '<span class="sep"></span><span class="lbl">สถานะ</span><div class="chips">' +
        [['open', 'ค้างอยู่'], ['late', 'เลยกำหนด'], ['done', 'เสร็จแล้ว'], ['', 'ทั้งหมด']].map(function (p) {
          return '<button type="button" class="chip plain' + (F.status === p[0] ? ' on' : '') + '" data-f="status" data-v="' + p[0] + '">' + p[1] + '</button>';
        }).join('') + '</div>' +
        '<span class="sep"></span><span class="lbl">จัดกลุ่ม</span><div class="chips">' +
        [['due', 'กำหนดส่ง'], ['who', 'คน'], ['kpi', 'KPI']].map(function (p) {
          return '<button type="button" class="chip plain' + (F.group === p[0] ? ' on' : '') + '" data-f="group" data-v="' + p[0] + '">' + p[1] + '</button>';
        }).join('') + '</div></div>';

      if (!list.length) {
        h += '<div class="sec"><div class="empty"><b>ไม่มีงานตามตัวกรองนี้</b>ลองเปลี่ยนคน / KPI / สถานะ หรือสั่งงานใหม่</div></div>';
      } else if (F.group === 'who') {
        var byWho = {};
        list.forEach(function (t) {
          if (!t.assignees.length) (byWho['_none'] = byWho['_none'] || []).push(t);
          t.assignees.forEach(function (id) { (byWho[id] = byWho[id] || []).push(t); });
        });
        S.staff.forEach(function (s) { if (byWho[s.id]) h += groupList(s.name, byWho[s.id]); });
        if (byWho['_none']) h += groupList('ยังไม่มอบหมาย', byWho['_none'], 'late');
      } else if (F.group === 'kpi') {
        var byKpi = {};
        list.forEach(function (t) { var k = t.kpiId || '_none'; (byKpi[k] = byKpi[k] || []).push(t); });
        S.kpis.forEach(function (k) { if (byKpi[k.id]) h += groupList(k.code + ' · ' + k.title, byKpi[k.id]); });
        if (byKpi['_none']) h += groupList('ยังไม่ผูก KPI', byKpi['_none']);
      } else {
        var b = bucketize(list);
        h += groupList('เลยกำหนด', b.late, 'late') + groupList('วันนี้', b.today) + groupList('ภายใน 7 วัน', b.week) +
          groupList('ถัดไป', b.later) + groupList('ยังไม่กำหนดวัน', b.nodate) + groupList('งานประจำ', b.repeat) + groupList('เสร็จแล้ว', b.done);
      }
      view.innerHTML = h;
    }).catch(function (e) { showError(e); });
  }

  /* ---------- สั่งงาน: parser ---------- */
  var DAY_WORDS = [
    ['อาทิตย์', 0], ['จันทร์', 1], ['อังคาร', 2], ['พุธ', 3], ['พฤหัสบดี', 4], ['พฤหัส', 4], ['ศุกร์', 5], ['เสาร์', 6],
    ['sunday', 0], ['monday', 1], ['tuesday', 2], ['wednesday', 3], ['thursday', 4], ['friday', 5], ['saturday', 6],
    ['sun', 0], ['mon', 1], ['tue', 2], ['wed', 3], ['thu', 4], ['fri', 5], ['sat', 6]
  ];
  var RE_TIME = /(\d{1,2})[.:](\d{2})(?:\s*น\.?)?/;
  var RE_DMY = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;

  function norm(s) { return String(s || '').toLowerCase().replace(/[.,:;()\[\]"'“”]/g, '').trim(); }
  function staffTokens(s) {
    var set = {};
    String(s.name).split(/\s+/).forEach(function (p) { var n = norm(p); if (n) set[n] = 1; });
    String(s.aliases || '').split(',').forEach(function (p) { var n = norm(p); if (n) set[n] = 1; });
    return set;
  }
  function findStaffByToken(tok) {
    var n = norm(tok);
    if (!n) return null;
    for (var i = 0; i < S.staff.length; i++) {
      if (!S.staff[i].active) continue;
      var set = staffTokens(S.staff[i]);
      if (set[n]) return S.staff[i];
    }
    for (var j = 0; j < S.staff.length; j++) {
      if (!S.staff[j].active) continue;
      var set2 = staffTokens(S.staff[j]);
      for (var k in set2) if (k.length >= 3 && (n.indexOf(k) === 0 || k.indexOf(n) === 0)) return S.staff[j];
    }
    return null;
  }
  /* ดึง @ชื่อ ออกจากบรรทัด — คืน { text (ไม่มีชื่อ), assignees[] } */
  function extractMentions(line) {
    var toks = line.split(/\s+/), out = [], ids = [];
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t.charAt(0) !== '@') { out.push(t); continue; }
      var key = t.slice(1), j = i;
      if (!key && toks[i + 1]) { key = toks[i + 1]; j = i + 1; }
      var st = findStaffByToken(key);
      if (!st) { out.push(t); continue; }
      var set = staffTokens(st);
      while (toks[j + 1] && set[norm(toks[j + 1])]) j++;
      if (ids.indexOf(st.id) === -1) ids.push(st.id);
      i = j;
    }
    return { text: out.join(' '), assignees: ids };
  }
  function nextWeekday(dow, hh, mm) {
    var now = new Date(), d = startOfDay(now);
    var diff = (dow - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    d.setHours(hh, mm, 0, 0);
    if (d < now) d.setDate(d.getDate() + 7);
    return d;
  }
  /* หาเวลา/วัน/ความถี่ในข้อความ — คืน { text (ตัดคำเวลาออก), dueAt, repeat } */
  function extractWhen(text) {
    var repeat = '', dow = -1, hh = 18, mm = 0, hasTime = false, date = null;
    var t = ' ' + text + ' ';
    if (/ทุกวัน|ทุกๆวัน|daily|every day/i.test(t)) { repeat = 'daily'; t = t.replace(/ทุกๆ?วัน|daily|every day/gi, ' '); }
    var m = t.match(RE_TIME);
    if (m) { hh = Number(m[1]); mm = Number(m[2]); if (hh <= 23 && mm <= 59) { hasTime = true; t = t.replace(m[0], ' '); } }
    for (var i = 0; i < DAY_WORDS.length && repeat !== 'daily'; i++) {
      var re = new RegExp('(ทุก\\s*)?(วัน)?' + DAY_WORDS[i][0] + '(?![ก-๙a-z])', 'i');
      var dm = t.match(re);
      if (dm) {
        dow = DAY_WORDS[i][1];
        if (dm[1]) repeat = repeat || 'weekly';
        t = t.replace(dm[0], ' ');
        break;
      }
    }
    var dmy = t.match(RE_DMY);
    if (dmy && Number(dmy[1]) <= 31 && Number(dmy[2]) <= 12) {
      var y = new Date().getFullYear();
      if (dmy[3]) { y = Number(dmy[3]); if (y > 2400) y -= 543; else if (y < 100) y += 2000; }
      date = new Date(y, Number(dmy[2]) - 1, Number(dmy[1]), hh, mm, 0, 0);
      if (!dmy[3] && date < new Date() && !hasTime) date.setFullYear(y + 1);
      t = t.replace(dmy[0], ' ');
    }
    if (/พรุ่งนี้|tomorrow/i.test(t)) { date = startOfDay(new Date()); date.setDate(date.getDate() + 1); date.setHours(hh, mm, 0, 0); t = t.replace(/พรุ่งนี้|tomorrow/gi, ' '); }
    else if (/มะรืน/.test(t)) { date = startOfDay(new Date()); date.setDate(date.getDate() + 2); date.setHours(hh, mm, 0, 0); t = t.replace(/มะรืน/g, ' '); }
    else if (/วันนี้|today/i.test(t)) { date = new Date(); date.setHours(hh, mm, 0, 0); t = t.replace(/วันนี้|today/gi, ' '); }

    var dueAt = null;
    if (repeat === 'daily') { var d0 = new Date(); d0.setHours(hh, mm, 0, 0); dueAt = d0.toISOString(); }
    else if (date) dueAt = date.toISOString();
    else if (dow >= 0) dueAt = nextWeekday(dow, hh, mm).toISOString();
    else if (hasTime) { var d1 = new Date(); d1.setHours(hh, mm, 0, 0); if (d1 < new Date()) d1.setDate(d1.getDate() + 1); dueAt = d1.toISOString(); }

    t = t.replace(/\b(deadline|due|ส่งภายใน|ภายใน|กำหนดส่ง)\b\s*[:\-–]?/gi, ' ').replace(/\s+น\.\s+/g, ' ');
    return { text: t, dueAt: dueAt, repeat: repeat };
  }
  function cleanTitle(s) {
    return s.replace(/^\s*(>>|>|[-–•*]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').replace(/[\s\-–:,.]+$/, '').replace(/^[\s\-–:]+/, '').trim();
  }
  function guessKpi(text) {
    var low = String(text || '').toLowerCase(), best = null, bestN = 0;
    S.kpis.forEach(function (k) {
      var n = 0;
      String(k.keywords || '').split(',').forEach(function (w) {
        w = w.trim().toLowerCase();
        if (w && low.indexOf(w) !== -1) n += w.length > 3 ? 2 : 1;
      });
      if (n > bestN) { bestN = n; best = k.id; }
    });
    return best;
  }
  function parseCommand(text) {
    /* กติกา: บล็อก = ข้อความที่คั่นด้วยบรรทัดว่าง · บรรทัดที่มี @ชื่อ = งานใหม่
       บรรทัด/บล็อกที่ไม่มี @ ต่อจากงาน → รายละเอียดของงานนั้น
       บรรทัดขึ้นต้น >> → ดึงรายละเอียดที่พิมพ์ไว้ "ก่อนหน้า" (ทั้งท้ายงานก่อนและบล็อกลอย) มาเป็นของงานนี้ */
    var blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n/);
    var tasks = [], carry = [];
    function mk(line, men, when) {
      return { title: cleanTitle(when.text), ctx: [], tail: [], assignees: men.assignees, dueAt: when.dueAt, repeat: when.repeat, kpiId: null, priority: 0, raw: line };
    }
    blocks.forEach(function (block) {
      var lines = block.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) return;
      var hasTask = lines.some(function (l) { return l.indexOf('@') !== -1 && extractMentions(l).assignees.length; });
      if (!hasTask) { carry = carry.concat(lines); return; }
      var cur = null, before = [];
      lines.forEach(function (line) {
        var men = extractMentions(line);
        if (men.assignees.length) {
          var t = mk(line, men, extractWhen(men.text));
          var prev = tasks.length ? tasks[tasks.length - 1] : null;
          if (line.indexOf('>>') === 0 && prev) {
            t.ctx = prev.tail.splice(0, prev.tail.length).concat(carry, before);
          } else if (prev) {
            prev.tail = prev.tail.concat(carry, before);
          } else {
            t.ctx = carry.concat(before);
          }
          carry = []; before = [];
          tasks.push(t);
          cur = t;
        } else if (cur) {
          cur.tail.push(line);
        } else {
          before.push(line);
        }
      });
    });
    if (carry.length) {
      if (tasks.length) tasks[tasks.length - 1].tail = tasks[tasks.length - 1].tail.concat(carry);
      else {
        var when = extractWhen(carry[0]);
        var t0 = { title: cleanTitle(when.text), ctx: [], tail: carry.slice(1), assignees: [], dueAt: when.dueAt, repeat: when.repeat, kpiId: null, priority: 0, raw: carry[0] };
        tasks.push(t0);
      }
    }
    tasks.forEach(function (t) {
      t.detail = t.ctx.concat(t.tail).join('\n');
      delete t.ctx; delete t.tail;
      if (!t.title) t.title = (t.detail.split('\n')[0] || 'งานใหม่').slice(0, 120);
      t.kpiId = guessKpi(t.title + ' ' + t.detail);
    });
    return tasks;
  }

  /* ---------- สั่งงาน: หน้า ---------- */
  var drafts = [];
  function draftCard(t, i) {
    var h = '<div class="draft" data-i="' + i + '"><div class="draft-h"><span class="n">' + (i + 1) + '</span>' +
      '<input class="input" data-k="title" value="' + esc(t.title) + '" placeholder="ชื่องาน">' +
      '<button type="button" class="btn-text rm" data-rm="' + i + '">ลบ</button></div><div class="draft-b">' +
      '<div><label class="label">มอบหมายให้ <small>(กดเลือกได้หลายคน)</small></label><div class="chips">' +
      S.staff.filter(function (s) { return s.active; }).map(function (s) {
        return '<button type="button" class="chip' + (t.assignees.indexOf(s.id) !== -1 ? ' on' : '') + '" data-as="' + esc(s.id) + '">' + avatar(s) + esc(shortName(s)) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="row"><div class="field"><label class="label">กำหนดส่ง</label><input class="input" type="datetime-local" data-k="dueAt" value="' + esc(toLocalInput(t.dueAt)) + '"></div>' +
      '<div class="field"><label class="label">ความถี่</label><select class="select" data-k="repeat">' +
      [['', 'ครั้งเดียว'], ['daily', 'ทุกวัน'], ['weekly', 'ทุกสัปดาห์']].map(function (p) { return '<option value="' + p[0] + '"' + (t.repeat === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label class="label">KPI ที่เกี่ยวข้อง</label><select class="select" data-k="kpiId"><option value="">— ไม่ระบุ —</option>' +
      S.kpis.map(function (k) { return '<option value="' + esc(k.id) + '"' + (t.kpiId === k.id ? ' selected' : '') + '>' + esc(k.code + ' · ' + k.title) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label class="label">รายละเอียด / เงื่อนไข</label><textarea class="textarea" data-k="detail" placeholder="ข้อความประกอบ เงื่อนไข ขนาด งบ ฯลฯ">' + esc(t.detail) + '</textarea></div>' +
      '</div></div>';
    return h;
  }
  function renderNew() {
    var view = $('#view');
    view.className = 'page';
    var sample = 'ระบบจอ signmate > kan บขส + fashion : Deadline - พุธ 17.00 น. @Julalak\nออกแบบ บูธขายเสื้อหนาว ที่ Central - อังคาร 16.00 @Title\nขนาดพื้นที่ 8*7 เมตร เลือกได้ 7 / 14 วัน\n\nupdate ontour จังหวัดอื่น @Nont @Title @Julalak ทุกวัน 17.30';
    var h = '<div class="top"><div><span class="kicker">สั่งงาน</span><h1>วางข้อความสั่งงาน แล้วให้ระบบแยกเป็นงาน</h1>' +
      '<p>พิมพ์หรือวางแบบที่สั่งในแชตได้เลย — ระบบจะอ่าน <b>@ชื่อ</b> เป็นคนรับงาน อ่าน <b>วัน + เวลา</b> เป็นกำหนดส่ง และเดา KPI ให้ ตรวจแก้ในการ์ดก่อนกดบันทึก</p></div></div>';
    h += '<div class="compose"><div>' +
      '<div class="sec"><div class="sec-b"><label class="label">ข้อความสั่งงาน</label>' +
      '<textarea class="textarea big" id="cmdText" placeholder="' + esc(sample) + '"></textarea>' +
      '<div class="acts" style="margin-top:12px"><button type="button" class="btn" id="parseBtn">แยกเป็นงาน</button>' +
      '<button type="button" class="btn-ghost" id="blankBtn">+ เพิ่มงานเปล่า</button></div></div></div>' +
      '<div id="draftHost"></div></div>' +
      '<div class="sec help-sec"><div class="sec-h"><h2>วิธีเขียนให้ระบบอ่านออก</h2></div><div class="sec-b help">' +
      '<ul><li><b>@ชื่อ</b> = คนรับงาน ใส่ได้หลายคนในบรรทัดเดียว (' + S.staff.filter(function (s) { return s.active; }).map(function (s) { return '@' + shortName(s); }).join(' · ') + ')</li>' +
      '<li><b>วัน + เวลา</b> เช่น <i>พุธ 17.00</i> · <i>พรุ่งนี้ 16.30</i> · <i>12/10 18.00</i> — ไม่ใส่เวลา = 18:00</li>' +
      '<li><b>ทุกวัน 17.30</b> = งานประจำ อัปเดตทุกวัน · <b>ทุกศุกร์</b> = ทุกสัปดาห์</li>' +
      '<li>บรรทัดถัดไปที่ไม่มี @ = รายละเอียดของงานก่อนหน้า · เว้นบรรทัดว่างเพื่อขึ้นเรื่องใหม่</li>' +
      '<li>ขึ้นต้น <b>&gt;&gt;</b> = งานนี้ใช้ข้อความก่อนหน้าเป็นรายละเอียด</li></ul>' +
      '<code>' + esc(sample) + '</code></div></div></div>';
    view.innerHTML = h;
    drafts = [];
    renderDrafts();
  }
  function renderDrafts() {
    var host = $('#draftHost');
    if (!host) return;
    if (!drafts.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="group-h"><h3>ตรวจก่อนบันทึก</h3><span>' + drafts.length + ' งาน</span></div>' +
      drafts.map(draftCard).join('') +
      '<div class="sticky-bar"><span>' + drafts.length + ' งาน · ' + drafts.filter(function (d) { return !d.assignees.length; }).length + ' งานยังไม่มีคนรับ</span>' +
      '<div class="acts"><button type="button" class="btn-ghost" id="clearBtn">ล้าง</button><button type="button" class="btn" id="saveBtn">บันทึกทั้งหมด</button></div></div>';
  }
  function syncDraftsFromDom() {
    $$('.draft').forEach(function (card) {
      var i = Number(card.getAttribute('data-i')), d = drafts[i];
      if (!d) return;
      $$('[data-k]', card).forEach(function (el) {
        var k = el.getAttribute('data-k');
        if (k === 'dueAt') d.dueAt = fromLocalInput(el.value);
        else if (k === 'kpiId') d.kpiId = el.value || null;
        else d[k] = el.value;
      });
      d.assignees = $$('.chip.on[data-as]', card).map(function (b) { return b.getAttribute('data-as'); });
    });
  }
  function saveDrafts() {
    syncDraftsFromDom();
    var bad = drafts.filter(function (d) { return !String(d.title).trim(); });
    if (bad.length) { toast('มีงานที่ยังไม่มีชื่อ', true); return; }
    var btn = $('#saveBtn');
    btn.disabled = true;
    api('/tasks', 'POST', { tasks: drafts.map(function (d) {
      return { title: d.title, detail: d.detail, assignees: d.assignees, dueAt: d.dueAt, repeat: d.repeat, kpiId: d.kpiId, priority: d.priority ? 1 : 0 };
    }) }).then(function (j) {
      toast('บันทึกแล้ว ' + (j.ids || []).length + ' งาน');
      S.tasks = null;
      drafts = [];
      location.hash = '#/all';
    }).catch(function (e) { btn.disabled = false; toast(e.message, true); });
  }

  /* ---------- รายละเอียดงาน ---------- */
  var pendingFiles = [];
  function thumbsHtml(files, removable) {
    return '<div class="thumbs">' + files.map(function (f, i) {
      var src = f.dataUrl || (API + '/files/' + f.id);
      return '<div class="th" data-src="' + esc(src) + '"><img src="' + esc(src) + '" alt="" loading="lazy">' +
        (removable ? '<button type="button" data-rmfile="' + i + '" aria-label="เอาออก">✕</button>' : '') +
        (f.fileName ? '<small>' + esc(f.fileName) + '</small>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function renderTask(id) {
    api('/tasks/' + id).then(function (j) {
      var t = j.task, ups = j.updates, files = j.files;
      var filesByUpdate = {};
      files.forEach(function (f) { (filesByUpdate[f.updateId || '_'] = filesByUpdate[f.updateId || '_'] || []).push(f); });
      var late = isLate(t), canEdit = S.me.role === 'owner' || t.createdBy === S.me.id;
      var mine = t.assignees.indexOf(S.me.id) !== -1;
      var canStatus = canEdit || mine;
      var by = staffById(t.createdBy);
      var view = $('#view');
      view.className = 'page';
      var h = '<div class="task-hero"><div class="crumbs"><a href="#/all">งานทั้งหมด</a><span>›</span>' +
        (t.kpiId ? '<a href="#/all?kpi=' + esc(t.kpiId) + '">' + esc((kpiById(t.kpiId) || {}).code || '') + '</a><span>›</span>' : '') +
        '<span class="pill ' + (late ? 'late' : esc(t.status)) + '">' + (late ? 'เลยกำหนด' : STATUS_TH[t.status]) + '</span>' +
        (t.repeat ? '<span class="pill repeat">' + (t.repeat === 'daily' ? 'งานประจำวัน' : 'งานประจำสัปดาห์') + '</span>' : '') + '</div>' +
        '<h1>' + (t.priority ? '★ ' : '') + esc(t.title) + '</h1>' +
        '<div class="meta"><div><span class="k">ผู้รับผิดชอบ</span><div class="v">' + avatars(t.assignees) + '</div></div>' +
        '<div><span class="k">กำหนดส่ง</span><div class="v' + (late ? ' late' : '') + '">' + esc(fmtDue(t)) + (t.dueAt && !t.repeat ? ' <small style="color:var(--k-mut);font-weight:400">(' + esc(fmtFull(t.dueAt)) + ')</small>' : '') + '</div></div>' +
        '<div><span class="k">KPI</span><div class="v">' + (t.kpiId ? '<span class="kpi-chip" style="font-size:13px;color:var(--k-ink)"><i style="background:' + esc((kpiById(t.kpiId) || {}).color) + '"></i>' + esc((kpiById(t.kpiId) || {}).code + ' · ' + (kpiById(t.kpiId) || {}).title) + '</span>' : '<span style="color:var(--k-mut)">ไม่ระบุ</span>') + '</div></div>' +
        '<div><span class="k">สั่งโดย</span><div class="v">' + (by ? avatar(by) + ' ' + esc(shortName(by)) : '—') + ' <small style="color:var(--k-mut);font-weight:400">' + esc(fmtAgo(t.createdAt)) + '</small></div></div></div></div>';

      h += '<div class="two"><div>';
      h += '<div class="sec"><div class="sec-h"><h2>รายละเอียด</h2>' + (canEdit ? '<button type="button" class="btn-text" id="editBtn">แก้ไขงาน</button>' : '') + '</div>' +
        '<div class="sec-b"><div class="task-detail" id="detailText">' + esc(t.detail) + '</div>' +
        (canEdit ? '<form id="editForm" hidden style="display:grid;gap:12px;margin-top:12px">' +
          '<div class="field"><label class="label">ชื่องาน</label><input class="input" name="title" value="' + esc(t.title) + '"></div>' +
          '<div class="field"><label class="label">รายละเอียด</label><textarea class="textarea" name="detail">' + esc(t.detail) + '</textarea></div>' +
          '<div class="field"><label class="label">มอบหมายให้</label><div class="chips" id="editAs">' + S.staff.filter(function (s) { return s.active; }).map(function (s) {
            return '<button type="button" class="chip' + (t.assignees.indexOf(s.id) !== -1 ? ' on' : '') + '" data-as="' + esc(s.id) + '">' + avatar(s) + esc(shortName(s)) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="grid3"><div class="field"><label class="label">กำหนดส่ง</label><input class="input" type="datetime-local" name="dueAt" value="' + esc(toLocalInput(t.dueAt)) + '"></div>' +
          '<div class="field"><label class="label">ความถี่</label><select class="select" name="repeat">' + [['', 'ครั้งเดียว'], ['daily', 'ทุกวัน'], ['weekly', 'ทุกสัปดาห์']].map(function (p) { return '<option value="' + p[0] + '"' + (t.repeat === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label class="label">KPI</label><select class="select" name="kpiId"><option value="">— ไม่ระบุ —</option>' + S.kpis.map(function (k) { return '<option value="' + esc(k.id) + '"' + (t.kpiId === k.id ? ' selected' : '') + '>' + esc(k.code + ' · ' + k.title) + '</option>'; }).join('') + '</select></div></div>' +
          '<label class="label" style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" name="priority"' + (t.priority ? ' checked' : '') + '> งานด่วน (★)</label>' +
          '<div class="acts"><button type="submit" class="btn">บันทึกการแก้ไข</button><button type="button" class="btn-ghost" id="cancelEdit">ยกเลิก</button>' +
          (S.me.role === 'owner' ? '<button type="button" class="btn-ghost danger" id="delBtn" style="margin-left:auto">ลบงานนี้</button>' : '') + '</div></form>' : '') +
        '</div></div>';

      h += '<div class="sec"><div class="sec-h"><h2>ความคืบหน้า</h2><p>' + ups.length + ' รายการ · ' + files.length + ' รูป</p></div><div class="sec-b tight"><div class="tl">' +
        (ups.length ? ups.map(function (u) {
          var s = staffById(u.staffId), fl = filesByUpdate[u.id] || [];
          var what = u.kind === 'create' ? 'สร้างงาน' : (u.statusTo && u.kind !== 'create' ? 'เปลี่ยนสถานะเป็น <span class="pill ' + esc(u.statusTo) + '">' + STATUS_TH[u.statusTo] + '</span>' : (fl.length ? 'แนบรูป' : 'บันทึก'));
          return '<div class="tl-i">' + avatar(s, 'lg') + '<div><div class="h"><b>' + esc(s ? shortName(s) : '?') + '</b><span>' + what + '</span><time>' + esc(fmtAgo(u.createdAt)) + '</time></div>' +
            (u.note ? '<div class="n">' + esc(u.note) + '</div>' : '') + (fl.length ? thumbsHtml(fl) : '') + '</div></div>';
        }).join('') : '<div class="empty">ยังไม่มีความคืบหน้า</div>') + '</div></div></div>';
      h += '</div><div>';

      h += '<div class="sec"><div class="sec-h"><h2>อัปเดตงาน</h2></div><div class="sec-b"><form id="updForm" class="upl">' +
        (canStatus ? '<div><label class="label">สถานะ</label><div class="chips" id="stChips">' +
          ['todo', 'doing', 'blocked', 'done'].map(function (s) { return '<button type="button" class="chip plain' + (t.status === s ? ' on' : '') + '" data-st="' + s + '">' + STATUS_TH[s] + '</button>'; }).join('') + '</div></div>' : '') +
        '<div class="field"><label class="label">บันทึก / รายงานผล</label><textarea class="textarea" name="note" placeholder="ทำอะไรไปแล้ว ติดอะไร ส่งอะไรให้ใคร"></textarea></div>' +
        '<label class="drop"><input type="file" accept="image/*" multiple id="fileIn"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3.2"/><path d="M8 5l1.2-2h5.6L16 5"/></svg><span><b>แนบรูปงาน</b> — ถ่ายจากมือถือได้เลย (สูงสุด 6 รูป/ครั้ง ย่อให้อัตโนมัติ)</span></label>' +
        '<div id="pendThumbs"></div>' +
        '<div class="acts"><button type="submit" class="btn" id="updBtn">บันทึกอัปเดต</button>' +
        (canStatus && t.status !== 'done' ? '<button type="button" class="btn-ghost" id="doneBtn">✓ เสร็จแล้ว</button>' : '') + '</div></form></div></div>';
      if (files.length) {
        h += '<div class="sec"><div class="sec-h"><h2>รูปทั้งหมด</h2><p>' + files.length + ' รูป</p></div><div class="sec-b">' + thumbsHtml(files) + '</div></div>';
      }
      h += '</div></div>';
      view.innerHTML = h;
      pendingFiles = [];
      wireTask(t);
    }).catch(function (e) { showError(e); });
  }
  function resizeImage(file, max, q) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, hgt = img.naturalHeight, sc = Math.min(1, max / Math.max(w, hgt));
        var c = document.createElement('canvas');
        c.width = Math.round(w * sc); c.height = Math.round(hgt * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var out = c.toDataURL('image/jpeg', q);
        if (out.length > 1500000) out = c.toDataURL('image/jpeg', 0.6);
        resolve(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('อ่านรูปไม่ได้: ' + file.name)); };
      img.src = url;
    });
  }
  function wireTask(t) {
    var chosenStatus = null;
    var stChips = $('#stChips');
    if (stChips) stChips.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-st]'); if (!b) return;
      $$('[data-st]', stChips).forEach(function (x) { x.classList.toggle('on', x === b); });
      chosenStatus = b.getAttribute('data-st');
    });
    var fileIn = $('#fileIn');
    fileIn.addEventListener('change', function () {
      var list = Array.prototype.slice.call(fileIn.files || []);
      fileIn.value = '';
      if (pendingFiles.length + list.length > 6) { toast('แนบได้สูงสุด 6 รูปต่อครั้ง', true); list = list.slice(0, 6 - pendingFiles.length); }
      Promise.all(list.map(function (f) { return resizeImage(f, 1400, 0.82).then(function (d) { return { fileName: f.name, dataUrl: d }; }); }))
        .then(function (arr) { pendingFiles = pendingFiles.concat(arr); $('#pendThumbs').innerHTML = pendingFiles.length ? thumbsHtml(pendingFiles, true) : ''; })
        .catch(function (e) { toast(e.message, true); });
    });
    $('#pendThumbs').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-rmfile]'); if (!b) return;
      ev.stopPropagation();
      pendingFiles.splice(Number(b.getAttribute('data-rmfile')), 1);
      $('#pendThumbs').innerHTML = pendingFiles.length ? thumbsHtml(pendingFiles, true) : '';
    });
    function submitUpdate(statusOverride) {
      var note = $('#updForm').note.value.trim();
      var status = statusOverride || (chosenStatus && chosenStatus !== t.status ? chosenStatus : null);
      if (!note && !status && !pendingFiles.length) { toast('ใส่บันทึก เลือกสถานะ หรือแนบรูปก่อน', true); return; }
      $('#updBtn').disabled = true;
      api('/tasks/' + t.id + '/updates', 'POST', { note: note, status: status, files: pendingFiles })
        .then(function () { toast('บันทึกแล้ว'); S.tasks = null; renderTask(t.id); })
        .catch(function (e) { $('#updBtn').disabled = false; toast(e.message, true); });
    }
    $('#updForm').addEventListener('submit', function (ev) { ev.preventDefault(); submitUpdate(null); });
    var doneBtn = $('#doneBtn');
    if (doneBtn) doneBtn.addEventListener('click', function () { submitUpdate('done'); });

    var editBtn = $('#editBtn');
    if (editBtn) {
      editBtn.addEventListener('click', function () { $('#editForm').hidden = false; $('#detailText').hidden = true; editBtn.hidden = true; });
      $('#cancelEdit').addEventListener('click', function () { $('#editForm').hidden = true; $('#detailText').hidden = false; editBtn.hidden = false; });
      $('#editAs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-as]'); if (b) b.classList.toggle('on'); });
      $('#editForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var f = this;
        api('/tasks/' + t.id, 'PUT', {
          title: f.title.value, detail: f.detail.value, dueAt: fromLocalInput(f.dueAt.value), repeat: f.repeat.value,
          kpiId: f.kpiId.value || null, priority: f.priority.checked ? 1 : 0,
          assignees: $$('.chip.on[data-as]', $('#editAs')).map(function (b) { return b.getAttribute('data-as'); })
        }).then(function () { toast('แก้ไขแล้ว'); S.tasks = null; renderTask(t.id); }).catch(function (e) { toast(e.message, true); });
      });
      var delBtn = $('#delBtn');
      if (delBtn) delBtn.addEventListener('click', function () {
        if (!confirm('ลบงาน "' + t.title + '" พร้อมรูปและประวัติทั้งหมด?')) return;
        api('/tasks/' + t.id, 'DELETE').then(function () { toast('ลบแล้ว'); S.tasks = null; location.hash = '#/all'; }).catch(function (e) { toast(e.message, true); });
      });
    }
  }

  /* ---------- KPI ---------- */
  function renderKpi() {
    loadTasks().then(function (all) {
      var view = $('#view');
      view.className = 'page';
      var totalW = S.kpis.reduce(function (a, k) { return a + (k.weight || 0); }, 0);
      var h = '<div class="kpi-hero"><div><span class="kicker">อิงจาก Executive Offer CMO · KAN Importation · 8 ก.ย. 2569</span>' +
        '<h1>KPI ฝ่ายการตลาด ปี 2570 <span class="en">(2027)</span></h1>' +
        '<p>ทุกงานที่สั่งในระบบผูกกับ KPI 1 ใน 6 หัวข้อนี้ กดที่การ์ดเพื่อดูงานที่ค้างอยู่ของหัวข้อนั้น — Revenue เป็น Shared Outcome ระหว่าง CMO และ COO: CMO รับผิดชอบ Demand, Customer Growth, Customer Value, CRM, Campaign, Pipeline และ New Channel</p></div>' +
        '<div class="big"><b>102M</b><small>เป้ายอดขายรวมบริษัท / ปี (บาท) · น้ำหนัก KPI รวม ' + totalW + '%</small></div></div>';
      h += '<div class="kpi-grid">' + S.kpis.map(function (k) {
        var ts = all.filter(function (t) { return t.kpiId === k.id; });
        var open = ts.filter(function (t) { return t.status !== 'done'; }), late = open.filter(isLate), done = ts.length - open.length;
        return '<a class="kpi-card" href="#/all?kpi=' + esc(k.id) + '" style="--kc:' + esc(k.color) + '"><div class="code"><span>' + esc(k.code) + '</span><b>' + k.weight + '%</b></div>' +
          '<h3>' + esc(k.title) + '</h3><p>' + esc(k.target) + '</p>' +
          '<div class="nums"><div><b>' + open.length + '</b>งานค้าง</div><div class="late"><b>' + late.length + '</b>เลยกำหนด</div><div><b>' + done + '</b>เสร็จแล้ว</div></div></a>';
      }).join('') + '</div>';

      h += '<div class="two"><div class="sec"><div class="sec-h"><h2>เป้ารายสาขา ปี 2570</h2><p>ยอดขาย + ลูกค้าใหม่ · Branch Gate = ขั้นต่ำ 85% ของเป้าลูกค้าใหม่</p></div><div class="sec-b tight" style="overflow-x:auto"><table class="table"><thead><tr><th>สาขา</th><th class="num">ยอด/เดือน</th><th class="num">ยอด/ปี</th><th class="num">ลูกค้าใหม่/ปี</th><th class="num">Gate 85%</th></tr></thead><tbody>' +
        KPI_DOC.branches.map(function (b) { return '<tr><td>' + esc(b.name) + '<br><small style="color:var(--k-mut)">' + esc(b.goal) + '</small></td><td class="num">' + fmtBaht(b.month) + '</td><td class="num">' + fmtBaht(b.year) + '</td><td class="num">' + fmtBaht(b.newCust) + '</td><td class="num">' + fmtBaht(b.gate) + '</td></tr>'; }).join('') +
        '<tr class="total"><td>รวมบริษัท</td><td class="num">8,500,000</td><td class="num">102,000,000</td><td class="num">18,000</td><td class="num">—</td></tr></tbody></table></div></div>' +
        '<div class="sec"><div class="sec-h"><h2>รอบทบทวน</h2></div><div class="sec-b tight"><table class="table"><tbody>' +
        KPI_DOC.cadence.map(function (c) { return '<tr><td style="white-space:nowrap;font-weight:500">' + esc(c[0]) + '</td><td style="color:var(--k-soft);font-size:12.5px">' + esc(c[1]) + '</td></tr>'; }).join('') + '</tbody></table></div></div></div>';

      h += '<div class="sec"><div class="sec-h"><h2>OKR ของ CMO ปี 2570</h2></div><div class="sec-b tight"><div class="okr">' +
        KPI_DOC.okr.map(function (o) { return '<div><h3>' + esc(o.o) + '</h3><ul>' + o.kr.map(function (k, i) { return '<li><b>KR' + (i + 1) + '</b> ' + esc(k) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div></div></div>';
      view.innerHTML = h;
    }).catch(function (e) { showError(e); });
  }

  /* ---------- ทีม ---------- */
  function renderTeam() {
    var view = $('#view');
    view.className = 'page';
    var owner = S.me.role === 'owner';
    var h = '<div class="top"><div><span class="kicker">ทีม + PIN</span><h1>ทีมงาน</h1>' +
      '<p>ทุกคนเข้าระบบด้วยชื่อ + PIN ของตัวเอง ' + (owner ? 'หัวหน้าเพิ่มคน รีเซ็ต PIN และปิดบัญชีได้ที่นี่ · "ชื่อเรียกใน @" คือคำที่ใช้พิมพ์ตอนสั่งงาน เช่น @Title' : 'เปลี่ยน PIN ของคุณได้ด้านล่าง') + '</p></div></div>';
    h += '<div class="two"><div class="sec"><div class="sec-h"><h2>สมาชิก</h2><p>' + S.staff.filter(function (s) { return s.active; }).length + ' คนใช้งานอยู่</p></div><div class="sec-b tight">' +
      S.staff.map(function (s) {
        return '<div class="team-row' + (s.active ? '' : ' off') + '">' + avatar(s, 'lg') + '<div class="n"><b>' + esc(s.name) + (s.role === 'owner' ? ' <span class="pill doing" style="margin-left:6px">หัวหน้า</span>' : '') + (s.active ? '' : ' <span class="pill todo">ปิดใช้งาน</span>') + '</b>' +
          '<small>ชื่อเรียกใน @: ' + esc(s.aliases || '—') + '</small></div>' +
          (owner ? '<div class="acts"><button type="button" class="btn-ghost sm" data-edit-staff="' + esc(s.id) + '">แก้ไข</button><button type="button" class="btn-ghost sm" data-pin-staff="' + esc(s.id) + '">รีเซ็ต PIN</button>' +
            (s.id !== S.me.id ? '<button type="button" class="btn-ghost sm' + (s.active ? ' danger' : '') + '" data-active-staff="' + esc(s.id) + '" data-to="' + (s.active ? '0' : '1') + '">' + (s.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน') + '</button>' : '') + '</div>' : '') + '</div>';
      }).join('') + '</div></div><div>';
    if (owner) {
      h += '<div class="sec"><div class="sec-h"><h2>เพิ่มคนในทีม</h2></div><div class="sec-b"><form id="addStaff" style="display:grid;gap:12px">' +
        '<div class="field"><label class="label">ชื่อ-นามสกุล</label><input class="input" name="name" required placeholder="เช่น Somchai Dee"></div>' +
        '<div class="field"><label class="label">ชื่อเรียกใน @ <small>(คั่นด้วยจุลภาค)</small></label><input class="input" name="aliases" placeholder="เช่น Somchai,สมชาย"></div>' +
        '<div class="grid2"><div class="field"><label class="label">PIN เริ่มต้น</label><input class="input" name="pin" inputmode="numeric" pattern="[0-9]{4,8}" required placeholder="4–8 หลัก"></div>' +
        '<div class="field"><label class="label">สิทธิ์</label><select class="select" name="role"><option value="member">สมาชิก</option><option value="owner">หัวหน้า</option></select></div></div>' +
        '<div class="acts"><button type="submit" class="btn">เพิ่มคน</button></div></form></div></div>';
    }
    h += '<div class="sec"><div class="sec-h"><h2>เปลี่ยน PIN ของฉัน</h2></div><div class="sec-b"><form id="myPin" style="display:grid;gap:12px">' +
      '<div class="grid2"><div class="field"><label class="label">PIN เดิม</label><input class="input" name="pin" type="password" inputmode="numeric" required></div>' +
      '<div class="field"><label class="label">PIN ใหม่</label><input class="input" name="newPin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" required placeholder="4–8 หลัก"></div></div>' +
      '<div class="acts"><button type="submit" class="btn-ghost">เปลี่ยน PIN</button></div></form></div></div>';
    h += '</div></div>';
    view.innerHTML = h;

    $('#myPin').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this;
      api('/me/pin', 'PUT', { pin: f.pin.value, newPin: f.newPin.value }).then(function () { toast('เปลี่ยน PIN แล้ว'); f.reset(); }).catch(function (e) { toast(e.message, true); });
    });
    var add = $('#addStaff');
    if (add) add.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this;
      api('/staff', 'POST', { name: f.name.value, aliases: f.aliases.value, pin: f.pin.value, role: f.role.value })
        .then(function () { toast('เพิ่มแล้ว'); return refreshMe(); }).then(renderTeam).catch(function (e) { toast(e.message, true); });
    });
    view.addEventListener('click', function (ev) {
      var b;
      if ((b = ev.target.closest('[data-pin-staff]'))) {
        var s = staffById(b.getAttribute('data-pin-staff'));
        var pin = prompt('PIN ใหม่ของ ' + s.name + ' (ตัวเลข 4–8 หลัก)');
        if (pin == null) return;
        api('/staff/' + s.id, 'PUT', { pin: pin }).then(function () { toast('รีเซ็ต PIN แล้ว'); }).catch(function (e) { toast(e.message, true); });
      } else if ((b = ev.target.closest('[data-active-staff]'))) {
        api('/staff/' + b.getAttribute('data-active-staff'), 'PUT', { active: b.getAttribute('data-to') === '1' })
          .then(refreshMe).then(renderTeam).catch(function (e) { toast(e.message, true); });
      } else if ((b = ev.target.closest('[data-edit-staff]'))) {
        var st = staffById(b.getAttribute('data-edit-staff'));
        var name = prompt('ชื่อ', st.name); if (name == null) return;
        var aliases = prompt('ชื่อเรียกใน @ (คั่นด้วยจุลภาค)', st.aliases || ''); if (aliases == null) return;
        api('/staff/' + st.id, 'PUT', { name: name, aliases: aliases }).then(refreshMe).then(renderTeam).then(function () { toast('บันทึกแล้ว'); }).catch(function (e) { toast(e.message, true); });
      }
    });
  }

  /* ---------- router ---------- */
  function showError(e) {
    if (!S.me) return;
    var view = $('#view');
    view.className = 'page';
    view.innerHTML = '<div class="err"><b>โหลดไม่สำเร็จ</b><p>' + esc(e && e.message ? e.message : e) + '</p></div><a class="btn-ghost" href="#/me">กลับหน้างานของฉัน</a>';
  }
  function parseRoute() {
    var hsh = location.hash || '#/me';
    var m = hsh.match(/^#\/([a-z]+)(?:\/([A-Za-z0-9_-]+))?(?:\?(.*))?$/);
    var r = { name: 'me', id: null, query: {} };
    if (m) {
      r.name = m[1]; r.id = m[2] || null;
      if (m[3]) m[3].split('&').forEach(function (p) { var kv = p.split('='); r.query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
    }
    return r;
  }
  function render() {
    S.route = parseRoute();
    if (!S.me) { renderLogin(); return; }
    renderSidebar();
    renderHeaderUser();
    window.scrollTo(0, 0);
    switch (S.route.name) {
      case 'all': return renderAll();
      case 'new': return renderNew();
      case 'task': return S.route.id ? renderTask(S.route.id) : renderAll();
      case 'kpi': return renderKpi();
      case 'team': return renderTeam();
      default: return renderMe();
    }
  }
  function refreshMe() {
    return api('/me').then(function (j) { S.me = j.me; S.staff = j.staff || []; S.kpis = j.kpis || []; return j; });
  }
  function boot() {
    return fetch(API + '/me', { credentials: 'same-origin' }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) { S.me = null; renderSidebar(); renderLogin(); return; }
        S.me = x.j.me; S.staff = x.j.staff || []; S.kpis = x.j.kpis || [];
        if (!location.hash) location.hash = S.me.role === 'owner' ? '#/all' : '#/me';
        render();
      }).catch(function (e) { renderSidebar(); renderLogin(e.message); });
  }

  /* ---------- global events ---------- */
  document.addEventListener('click', function (ev) {
    var b;
    if (ev.target.closest('[data-erp-toggle]')) { document.documentElement.classList.toggle('erp-open'); return; }
    if (ev.target.closest('[data-erp-close]')) { document.documentElement.classList.remove('erp-open'); return; }
    if (document.documentElement.classList.contains('erp-open') && ev.target.closest('.erp-sidebar a')) document.documentElement.classList.remove('erp-open');
    if ((b = ev.target.closest('[data-theme-pick]'))) { setTheme(b.getAttribute('data-theme-pick')); return; }
    if (ev.target.closest('[data-theme-toggle]')) { setTheme(isDark() ? 'light' : 'dark'); return; }
    if (ev.target.closest('[data-logout]')) {
      fetch(API + '/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { S.me = null; S.tasks = null; renderSidebar(); renderLogin(); });
      return;
    }
    if (ev.target.closest('[data-toggle-done]')) { S.showDone = !S.showDone; renderMe(); return; }
    if ((b = ev.target.closest('.cards article[data-go]'))) { F.status = b.getAttribute('data-go'); renderAll(); return; }
    if ((b = ev.target.closest('.filters [data-f]'))) { F[b.getAttribute('data-f')] = b.getAttribute('data-v'); renderAll(); return; }
    if (ev.target.id === 'parseBtn') {
      syncDraftsFromDom();
      var parsed = parseCommand($('#cmdText').value);
      if (!parsed.length) { toast('ยังไม่มีข้อความ หรืออ่านไม่ออก — ลองใส่ @ชื่อ', true); return; }
      drafts = drafts.concat(parsed);
      $('#cmdText').value = '';
      renderDrafts();
      toast('แยกได้ ' + parsed.length + ' งาน ตรวจแล้วกดบันทึก');
      return;
    }
    if (ev.target.id === 'blankBtn') { syncDraftsFromDom(); drafts.push({ title: '', detail: '', assignees: [], dueAt: null, repeat: '', kpiId: null, priority: 0 }); renderDrafts(); return; }
    if (ev.target.id === 'clearBtn') { drafts = []; renderDrafts(); return; }
    if (ev.target.id === 'saveBtn') { saveDrafts(); return; }
    if ((b = ev.target.closest('.draft [data-rm]'))) { syncDraftsFromDom(); drafts.splice(Number(b.getAttribute('data-rm')), 1); renderDrafts(); return; }
    if ((b = ev.target.closest('.draft [data-as]'))) { b.classList.toggle('on'); return; }
    if ((b = ev.target.closest('.thumbs .th')) && !ev.target.closest('button')) {
      var lb = $('#lightbox'); lb.querySelector('img').src = b.getAttribute('data-src'); lb.hidden = false; return;
    }
    if (ev.target.closest('#lightbox')) { $('#lightbox').hidden = true; return; }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { document.documentElement.classList.remove('erp-open'); $('#lightbox').hidden = true; }
  });
  window.addEventListener('hashchange', render);

  global.KAN_TASKS = { parseCommand: parseCommand, extractWhen: extractWhen, extractMentions: extractMentions, S: S };
  boot();
})(window);
