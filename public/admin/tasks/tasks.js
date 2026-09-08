/* ============================================================
   KAN Admin — งานทีม (Task) · SPA (hash route) คุยกับ /api/t/* ใน worker.js
   หน้า: #/me งานของฉัน · #/all งานทั้งหมด · #/new สั่งงาน (วางข้อความ) ·
         #/task/:id รายละเอียด+อัปเดต+ไฟล์แนบ · #/kpi KPI 2570 · #/team ทีม+รหัสผ่าน · #/inbox กระดิ่ง
   ============================================================ */
(function (global) {
  'use strict';

  var API = '/api/t';
  var S = { me: null, staff: [], kpis: [], tasks: null, pages: null, notif: { unread: 0, items: [] }, route: { name: 'me' } };

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
  /* ทำ @ชื่อ ในคอมเมนต์ให้เด่น — ต้อง escape ก่อนแล้วค่อยแทรก markup ไม่งั้นเปิดช่อง XSS */
  function withMentions(text) {
    var h = esc(text);
    S.staff.forEach(function (st) {
      var keys = [st.name].concat(String(st.aliases || '').split(',')).map(function (x) { return String(x).trim(); }).filter(Boolean);
      keys.sort(function (a, b) { return b.length - a.length; });
      keys.forEach(function (k) {
        var safe = esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        h = h.replace(new RegExp('@' + safe + '(?![^\\s])', 'g'), '<span class="mention">@' + esc(shortName(st)) + '</span>');
      });
    });
    return h;
  }
  function kpiChip(id) {
    var k = kpiById(id);
    if (!k) return '';
    return '<span class="kpi-chip" title="' + esc(k.title) + '"><i style="background:' + esc(k.color) + '"></i>' + esc(k.code) + '</span>';
  }
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function sameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }
  function startOfWeek(d) { var x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function sameWeek(a, b) { return startOfWeek(a).getTime() === startOfWeek(b).getTime(); }

  /* งานประจำ "เสร็จ" ได้แค่ในรอบของมัน — ขึ้นวันใหม่ (หรือสัปดาห์ใหม่) ต้องกลับมาเป็นรอทำเอง
     ไม่งั้นกดเสร็จวันเดียวแล้วงานประจำหายไปตลอดกาล ทั้งที่ทีมต้องอัปเดตทุกวัน */
  function effStatus(t) {
    if (!t.repeat || t.status !== 'done') return t.status;
    if (t.doneAt) {
      var d = new Date(t.doneAt), now = new Date();
      if (t.repeat === 'daily' && sameDay(d, now)) return 'done';
      if (t.repeat === 'weekly' && sameWeek(d, now)) return 'done';
    }
    return 'todo';
  }
  /* กำหนดส่งของงานประจำ = เวลานั้นของ "วันนี้" */
  function dueOf(t) {
    if (!t.dueAt) return null;
    var d = new Date(t.dueAt);
    if (t.repeat === 'daily') { var x = new Date(); x.setHours(d.getHours(), d.getMinutes(), 0, 0); return x; }
    return d;
  }
  function isLate(t) {
    if (effStatus(t) === 'done') return false;
    if (t.repeat === 'weekly') return false;
    var d = dueOf(t);
    return !!d && d < new Date();
  }
  function isToday(t) { var d = dueOf(t); return !!d && sameDay(d, new Date()); }
  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fmtDate(d, withYear) {
    return d.getDate() + ' ' + MON_TH[d.getMonth()] + (withYear ? ' ' + String(d.getFullYear() + 543).slice(-2) : '');
  }
  function fmtDue(t) {
    if (t.repeat === 'daily') return 'ทุกวัน ' + (t.dueAt ? fmtTime(new Date(t.dueAt)) : '');
    /* eslint-disable-next-line no-unreachable */
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

  /* กล่องยืนยันหลังกดบันทึก — toast มุมล่างเล็กเกินไป กรอกเสร็จแล้วไม่ชัวร์ว่าเข้าระบบจริงไหม
     ใช้กับ "ฟอร์ม" เท่านั้น ส่วนการติ๊กทีละช่องยังใช้ toast เพราะผลเห็นได้ทันทีบนหน้าจอ */
  function okDialog(opt) {
    opt = opt || {};
    var host = document.createElement('div');
    host.className = 'modal okmodal';
    host.innerHTML = '<div class="modal-box okbox">' +
      '<div class="okmark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 6 6L20 6"/></svg></div>' +
      '<h2>' + esc(opt.title || 'บันทึกแล้ว') + '</h2>' +
      (opt.lines && opt.lines.length
        ? '<ul class="oklist">' + opt.lines.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
        : '') +
      (opt.note ? '<p class="oknote">' + esc(opt.note) + '</p>' : '') +
      '<div class="okacts">' +
      (opt.link ? '<a class="btn-ghost" href="' + esc(opt.link.href) + '" data-ok-close>' + esc(opt.link.label) + '</a>' : '') +
      '<button type="button" class="btn" data-ok-close autofocus>ตกลง</button></div></div>';
    document.body.appendChild(host);
    var close = function () {
      host.remove();
      if (typeof opt.onClose === 'function') opt.onClose();
    };
    $$('[data-ok-close]', host).forEach(function (b) { b.addEventListener('click', close); });
    host.addEventListener('click', function (ev) { if (ev.target === host) close(); });
    var btn = host.querySelector('.btn');
    if (btn) btn.focus();
    host._close = close;
    return host;
  }

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
  function loadNotif() {
    return api('/notifications').then(function (j) { S.notif = j; return j; }).catch(function () { return S.notif; });
  }
  function loadTasks(force) {
    if (S.tasks && !force) return Promise.resolve(S.tasks);
    /* ดึงมาทั้งงานหลักและงานย่อย แล้วค่อยกรองตามหน้า:
       "งานทั้งหมด"/KPI นับเฉพาะงานหลัก (ไม่งั้นนับซ้ำกับงานย่อยของตัวเอง)
       "งานของฉัน" ต้องเห็นงานย่อยที่มอบให้เราด้วย ไม่งั้นงานหาย */
    return api('/tasks?scope=all&sub=1').then(function (j) { S.tasks = j.tasks || []; return S.tasks; });
  }

  /* ---------- sidebar / header ---------- */
  var ROUTE_KEY = { me: '#/me', all: '#/all', new: '#/new', kpi: '#/kpi', team: '#/team', task: '#/all', inbox: '#/inbox', posts: '#/posts' };
  function renderSidebar() {
    var host = $('#sideHost');
    if (!host || !global.ERP_MENU) return;
    var h = global.ERP_MENU.render({ ctx: 'tasks', active: 'tasks:' + (ROUTE_KEY[S.route.name] || '#/me'),
      salesBase: '../mkt/index.html', cmoBase: '../cmo/', tasksBase: '',
      badges: S.notif.unread ? { mentions: S.notif.unread } : {} });
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
    el.innerHTML = '<a class="bell' + (S.notif.unread ? ' on' : '') + '" href="#/inbox" title="คนแท็กถึงคุณ">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/></svg>' +
      (S.notif.unread ? '<i>' + (S.notif.unread > 9 ? '9+' : S.notif.unread) + '</i>' : '') + '</a>' +
      '<span class="erp-user"><i>' + esc(initials(S.me.name)) + '</i><b>' + esc(S.me.name) + '</b>' +
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

  /* ---------- ล็อกอิน: อีเมล + รหัสผ่านที่ทีมตั้งเอง ---------- */
  var loginMode = 'in';   // 'in' = เข้าสู่ระบบ · 'setup' = ตั้งรหัสครั้งแรก

  function renderLogin(err) {
    renderHeaderUser();
    var view = $('#view');
    view.className = 'login';
    var tab = function (k, label) {
      return '<button type="button" class="ltab' + (loginMode === k ? ' on' : '') + '" data-lmode="' + k + '">' + label + '</button>';
    };
    var h = '<div class="login-card"><h1>KAN Admin — งานทีม</h1>' +
      '<p>' + (loginMode === 'in' ? 'เข้าด้วยอีเมลกับรหัสผ่านของคุณ' : 'เลือกชื่อตัวเอง ใส่รหัสตั้งค่าที่หัวหน้าให้ แล้วตั้งอีเมลกับรหัสผ่าน') + '</p>' +
      '<div class="ltabs">' + tab('in', 'เข้าสู่ระบบ') + tab('setup', 'ตั้งรหัสครั้งแรก') + '</div>' +
      (err ? '<div class="err" style="margin:14px 0 0"><p>' + esc(err) + '</p></div>' : '');

    if (loginMode === 'in') {
      h += '<form id="loginForm">' +
        '<div class="field"><label class="label">อีเมล</label><input class="input" name="email" type="email" autocomplete="username" placeholder="you@example.com" required></div>' +
        '<div class="field"><label class="label">รหัสผ่าน</label><input class="input" name="password" type="password" autocomplete="current-password" required></div>' +
        '<button type="submit" class="btn" id="loginBtn">เข้าสู่ระบบ</button></form>' +
        '<p class="foot">ยังไม่เคยตั้งรหัส กดแท็บ “ตั้งรหัสครั้งแรก” · ลืมรหัสผ่านให้หัวหน้าตั้งใหม่ให้ในหน้า “ทีม”</p>';
    } else {
      h += '<form id="setupForm">' +
        '<div class="field"><label class="label">ชื่อของคุณ</label><select class="select" name="staffId" id="setupStaff"><option value="">กำลังโหลดรายชื่อ…</option></select></div>' +
        '<div class="field"><label class="label">รหัสตั้งค่า <small>ตัวเลขที่หัวหน้าให้มา</small></label>' +
        '<input class="input pin" name="setupCode" type="password" inputmode="numeric" maxlength="8" placeholder="••••" required></div>' +
        '<div class="field"><label class="label">อีเมลของคุณ</label><input class="input" name="email" type="email" autocomplete="username" placeholder="you@example.com" required></div>' +
        '<div class="field"><label class="label">ตั้งรหัสผ่าน <small>อย่างน้อย 8 ตัว</small></label><input class="input" name="password" type="password" autocomplete="new-password" minlength="8" required></div>' +
        '<div class="field"><label class="label">พิมพ์รหัสผ่านอีกครั้ง</label><input class="input" name="password2" type="password" autocomplete="new-password" minlength="8" required></div>' +
        '<button type="submit" class="btn" id="setupBtn">ตั้งรหัสแล้วเข้าใช้งาน</button></form>' +
        '<p class="foot">ตั้งเสร็จแล้วครั้งต่อไปเข้าด้วยอีเมลกับรหัสผ่านนี้ได้เลย · ' +
        'รหัสตั้งค่าใช้ได้ครั้งเดียว ถ้าใส่แล้วไม่ผ่านให้ขอรหัสล่าสุดจากหัวหน้าทีม</p>';
    }
    h += '<div class="login-by">Powered by <b>M Creation</b></div></div>';
    view.innerHTML = h;

    $$('[data-lmode]').forEach(function (b) {
      b.addEventListener('click', function () { loginMode = b.getAttribute('data-lmode'); renderLogin(); });
    });

    if (loginMode === 'setup') {
      fetch(API + '/login', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        var sel = $('#setupStaff');
        if (!sel) return;
        sel.innerHTML = '<option value="">— เลือกชื่อ —</option>' + (j.staff || []).map(function (x) {
          return '<option value="' + esc(x.id) + '">' + esc(x.name) + (x.hasPassword ? ' (ตั้งรหัสแล้ว)' : '') + '</option>';
        }).join('');
      }).catch(function () {});

      $('#setupForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var f = this;
        if (f.password.value !== f.password2.value) { toast('รหัสผ่านสองช่องไม่ตรงกัน', true); return; }
        if (!f.staffId.value) { toast('เลือกชื่อก่อน', true); return; }
        $('#setupBtn').disabled = true;
        fetch(API + '/setup', {
          method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ staffId: f.staffId.value, setupCode: f.setupCode.value, email: f.email.value, password: f.password.value }),
        }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'ตั้งรหัสไม่สำเร็จ'); return j; }); })
          .then(function (j) {
            loginMode = 'in';
            return boot().then(function () {
              okDialog({
                title: 'ตั้งรหัสเรียบร้อย ยินดีต้อนรับ',
                lines: ['อีเมล: ' + f.email.value.trim(), 'ครั้งต่อไปเข้าด้วยอีเมลกับรหัสผ่านนี้ได้เลย'],
                note: 'ลืมรหัสผ่านเมื่อไหร่ ให้หัวหน้าทีมตั้งใหม่ให้ในหน้า "ทีม + รหัสผ่าน"',
              });
            });
          })
          .catch(function (e) { renderLogin(e.message); });
      });
      return;
    }

    $('#loginForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this;
      $('#loginBtn').disabled = true;
      fetch(API + '/login', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: f.email.value, password: f.password.value }),
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'เข้าไม่ได้'); return j; }); })
        .then(function () {
          try { localStorage.setItem('kan-task-last-email', f.email.value); } catch (e) {}
          return boot();
        })
        .catch(function (e) { renderLogin(e.message); });
    });
    try {
      var last = localStorage.getItem('kan-task-last-email');
      if (last) $('#loginForm').email.value = last;
    } catch (e) {}
  }

  /* ---------- งานของฉัน ---------- */
  function taskRow(t) {
    var es = effStatus(t), late = isLate(t), st = late ? 'late' : es;
    var dueCls = late ? 'late' : (isToday(t) && es !== 'done' ? 'today' : '');
    var mark = es === 'done' ? '✓' : (es === 'blocked' ? '!' : '');
    var sub = t.nUpdates > 1 ? ('อัปเดต ' + fmtAgo(t.lastUpdate)) : (t.nFiles ? t.nFiles + ' รูป' : '');
    var cycle = t.repeat
      ? (es === 'done'
          ? '<span class="pill done">' + (t.repeat === 'daily' ? 'อัปเดตแล้ววันนี้' : 'อัปเดตแล้วสัปดาห์นี้') + '</span>'
          : '<span class="pill ' + (late ? 'late' : 'repeat') + '">' +
            (t.repeat === 'daily' ? (late ? 'ยังไม่อัปเดตวันนี้' : 'ประจำวัน') : 'ประจำสัปดาห์') + '</span>')
      : '';
    return '<a class="trow ' + esc(es) + '" href="#/task/' + esc(t.id) + '">' +
      '<span class="st ' + esc(st) + '">' + mark + '</span>' +
      '<span class="main"><span class="t">' + (t.priority ? '★ ' : '') + esc(t.title) + '</span>' +
      '<span class="m">' + avatars(t.assignees) + kpiChip(t.kpiId) + cycle +
      (es === 'doing' ? '<span class="pill doing">กำลังทำ</span>' : '') +
      (es === 'blocked' ? '<span class="pill blocked">ติดปัญหา</span>' : '') +
      (t.parentId ? '<span class="pill sub">งานย่อย</span>' : '') +
      (t.nSub ? '<span title="งานย่อย">☑ ' + t.nSubDone + '/' + t.nSub + '</span>' : '') +
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
      if (effStatus(t) === 'done') { b.done.push(t); return; }
      /* งานประจำที่เลยเวลาของวันนี้แล้วยังไม่อัปเดต ขึ้นกลุ่ม "เลยกำหนด" เหมือนงานอื่น
         ตัวเลขบนการ์ดกับกลุ่มข้างล่างจะได้ตรงกัน */
      if (isLate(t)) { b.late.push(t); return; }
      if (t.repeat) { b.repeat.push(t); return; }
      if (!t.dueAt) { b.nodate.push(t); return; }
      var d = new Date(t.dueAt);
      if (isToday(t)) b.today.push(t);
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
      var open = mine.length - b.done.length;   /* b.done ใช้ effStatus แล้ว งานประจำของวันใหม่จึงกลับมานับเป็นค้าง */
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
      /* แถบตรวจโพสต์ของวันนี้ — งาน routine ที่หัวหน้าทำทุกวัน ไม่ต้องสร้างเป็น task รายโพสต์ */
      h += '<div class="postbar" id="postBar"><span class="pbi">กำลังอ่านตารางโพสต์…</span></div>';

      if (!mine.length) {
        h += '<div class="sec"><div class="empty"><b>ยังไม่มีงานที่มอบหมายให้คุณ</b>เมื่อหัวหน้าสั่งงาน รายการจะขึ้นที่นี่</div></div>';
      } else {
        h += groupList('เลยกำหนด', b.late, 'late') + groupList('วันนี้', b.today) + groupList('ภายใน 7 วัน', b.week) +
          groupList('ถัดไป', b.later) + groupList('ยังไม่กำหนดวัน', b.nodate) + groupList('งานประจำ', b.repeat);
        if (b.done.length) {
          h += '<div class="group"><div class="group-h"><h3>เสร็จแล้ว</h3><span>' + b.done.length + '</span>' +
            '<button type="button" class="btn-text" style="margin-left:auto" data-toggle-done>' + (S.showDone ? 'ซ่อน' : 'แสดง') + '</button></div>' +
            (S.showDone ? '<div class="tlist">' + b.done.slice(0, 40).map(taskRow).join('') + '</div>' : '') + '</div>';
        }
      }
      view.innerHTML = h;

      api('/posts/today').then(function (t) {
        var bar = $('#postBar');
        if (!bar) return;
        if (!t.total) {
          bar.className = 'postbar quiet';
          bar.innerHTML = '<span class="pbi">วันนี้ยังไม่มีแผนโพสต์ในตาราง</span><a class="btn-text" href="#/posts">เปิดตารางโพสต์</a>';
          return;
        }
        var noLink = t.done - t.withUrl;
        bar.className = 'postbar' + (t.left ? ' warn' : (noLink > 0 ? ' warn' : ' ok'));
        bar.innerHTML = '<span class="pbi"><b>โพสต์วันนี้ ' + t.done + '/' + t.total + '</b>' +
          (t.left ? ' · ยังไม่ได้โพสต์ ' + t.left + ' รายการ' : ' · ครบแล้ว') +
          (noLink > 0 ? ' · ไม่มีลิงก์ ' + noLink : '') + '</span>' +
          '<a class="btn-text" href="#/posts">' + (t.left || noLink > 0 ? 'ไปตรวจ' : 'ดูตาราง') + '</a>';
      }).catch(function () {
        var bar = $('#postBar'); if (bar) bar.remove();
      });
    }).catch(function (e) { showError(e); });
  }

  /* ---------- งานทั้งหมด ---------- */
  var F = { who: '', kpi: '', status: 'open', group: 'due', range: 'all' };
  var RANGES = [['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้'], ['all', 'ทั้งหมด']];

  /* ช่วงเวลาที่เลือกครอบงานนี้ไหม
     - งานเลยกำหนดกับงานประจำ ติดมาทุกช่วงเสมอ (ไม่งั้นของที่ต้องรีบหายไปจากจอ)
     - งานที่ยังไม่กำหนดวัน โผล่เฉพาะ "ทั้งหมด" แต่จะมีบรรทัดบอกจำนวนไว้ให้กดดู */
  function inRange(t) {
    if (F.range === 'all') return true;
    if (t.repeat || isLate(t)) return true;
    var d = dueOf(t);
    if (!d) return false;
    var now = new Date();
    if (F.range === 'today') return sameDay(d, now);
    if (F.range === 'week') {
      var a = startOfWeek(now), b = new Date(a); b.setDate(b.getDate() + 7);
      return d >= a && d < b;
    }
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  function renderAll() {
    var q = S.route.query || {};
    if (q.kpi) { F.kpi = q.kpi; }
    if (q.who) { F.who = q.who; }
    if (q.status) { F.status = q.status; }
    loadTasks().then(function (all) {
      all = all.filter(function (t) { return !t.parentId; });
      var now = new Date(), weekAgo = new Date(now.getTime() - 7 * 86400000);
      var open = all.filter(function (t) { return effStatus(t) !== 'done'; });
      var late = open.filter(isLate), today = open.filter(function (t) { return isToday(t) && !isLate(t); });
      var doneWeek = all.filter(function (t) { return t.status === 'done' && new Date(t.doneAt || t.updatedAt) > weekAgo; });

      function passFilters(t) {
        if (F.status === 'open' && effStatus(t) === 'done') return false;
        if (F.status === 'done' && effStatus(t) !== 'done') return false;
        if (F.status === 'late' && !isLate(t)) return false;
        if (F.who && t.assignees.indexOf(F.who) === -1) return false;
        if (F.kpi === 'none' && t.kpiId) return false;
        if (F.kpi && F.kpi !== 'none' && t.kpiId !== F.kpi) return false;
        return true;
      }
      var matched = all.filter(passFilters);
      var list = matched.filter(inRange);
      var hiddenNoDate = F.range === 'all' ? 0
        : matched.filter(function (t) { return !inRange(t) && !dueOf(t); }).length;
      var hiddenOther = F.range === 'all' ? 0
        : matched.filter(function (t) { return !inRange(t) && dueOf(t); }).length;

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

      /* แถบเดียวจบ: ช่วงเวลา · ปุ่มตัวกรอง (กางเมื่อกด) · จัดกลุ่ม
         ของเดิมเป็นชิป 3 แถวเต็มจอ ทั้งที่ส่วนใหญ่ไม่ได้แตะ */
      var nActive = (F.who ? 1 : 0) + (F.kpi ? 1 : 0) + (F.status !== 'open' ? 1 : 0);
      var seg = function (name, opts) {
        return '<div class="seg">' + opts.map(function (o) {
          return '<button type="button" class="' + (F[name] === o[0] ? 'on' : '') + '" data-f="' + name + '" data-v="' + o[0] + '">' + esc(o[1]) + '</button>';
        }).join('') + '</div>';
      };
      h += '<div class="tbar">' + seg('range', RANGES) +
        '<button type="button" class="fbtn' + (S.filterOpen ? ' open' : '') + (nActive ? ' has' : '') + '" data-filter-toggle>' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>' +
        'ตัวกรอง' + (nActive ? '<i>' + nActive + '</i>' : '') + '</button>' +
        '<span class="tbar-lbl">จัดกลุ่ม</span>' + seg('group', [['due', 'กำหนดส่ง'], ['who', 'คน'], ['kpi', 'KPI']]) +
        '<span class="tbar-n">' + list.length + ' งาน</span></div>';

      if (S.filterOpen) {
        h += '<div class="fpanel"><div class="frow"><span class="lbl">คน</span><div class="chips">' +
          '<button type="button" class="chip plain' + (!F.who ? ' on' : '') + '" data-f="who" data-v="">ทุกคน</button>' +
          S.staff.filter(function (s) { return s.active; }).map(function (s) {
            return '<button type="button" class="chip' + (F.who === s.id ? ' on' : '') + '" data-f="who" data-v="' + esc(s.id) + '">' + avatar(s) + esc(shortName(s)) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="frow"><span class="lbl">KPI</span><div class="chips">' +
          '<button type="button" class="chip plain' + (!F.kpi ? ' on' : '') + '" data-f="kpi" data-v="">ทุก KPI</button>' +
          S.kpis.map(function (k) {
            return '<button type="button" class="chip plain' + (F.kpi === k.id ? ' on' : '') + '" data-f="kpi" data-v="' + esc(k.id) + '" title="' + esc(k.title) + '"><span class="dot" style="background:' + esc(k.color) + '"></span>' + esc(k.code) + '</button>';
          }).join('') + '<button type="button" class="chip plain' + (F.kpi === 'none' ? ' on' : '') + '" data-f="kpi" data-v="none">ไม่ระบุ</button></div></div>' +
          '<div class="frow"><span class="lbl">สถานะ</span><div class="chips">' +
          [['open', 'ค้างอยู่'], ['late', 'เลยกำหนด'], ['done', 'เสร็จแล้ว'], ['', 'ทั้งหมด']].map(function (p) {
            return '<button type="button" class="chip plain' + (F.status === p[0] ? ' on' : '') + '" data-f="status" data-v="' + p[0] + '">' + esc(p[1]) + '</button>';
          }).join('') + '</div></div></div>';
      }

      /* สรุปว่ากรองอะไรอยู่ พร้อมปุ่มเอาออกทีละอัน — ไม่ต้องกางแผงเพื่อดู */
      var act = [];
      if (F.who) act.push(['who', '', 'คน: ' + shortName(staffById(F.who))]);
      if (F.kpi) act.push(['kpi', '', 'KPI: ' + (F.kpi === 'none' ? 'ไม่ระบุ' : ((kpiById(F.kpi) || {}).code || ''))]);
      if (F.status !== 'open') act.push(['status', 'open', 'สถานะ: ' + ({ '': 'ทั้งหมด', late: 'เลยกำหนด', done: 'เสร็จแล้ว' }[F.status] || F.status)]);
      if (act.length) {
        h += '<div class="factive">' + act.map(function (a) {
          return '<button type="button" class="fchip" data-f="' + a[0] + '" data-v="' + a[1] + '">' + esc(a[2]) + ' <span>✕</span></button>';
        }).join('') + '<button type="button" class="btn-text" data-f-clear>ล้างทั้งหมด</button></div>';
      }

      if (hiddenNoDate || hiddenOther) {
        h += '<div class="hidden-note">' +
          (hiddenNoDate ? '<span><b>' + hiddenNoDate + '</b> งานยังไม่กำหนดวัน</span>' : '') +
          (hiddenOther ? '<span><b>' + hiddenOther + '</b> งานอยู่นอกช่วงนี้</span>' : '') +
          '<button type="button" class="btn-text" data-f="range" data-v="all">ดูทั้งหมด</button></div>';
      }
      if (!list.length) {
        h += '<div class="sec"><div class="empty"><b>ไม่มีงานในช่วงนี้</b>ลองเปลี่ยนช่วงเวลาเป็น “ทั้งหมด” หรือปรับตัวกรอง</div></div>';
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
    var payload = drafts.map(function (d) {
      return { title: d.title, detail: d.detail, assignees: d.assignees, dueAt: d.dueAt, repeat: d.repeat, kpiId: d.kpiId, priority: d.priority ? 1 : 0 };
    });
    api('/tasks', 'POST', { tasks: payload }).then(function (j) {
      var n = (j.ids || []).length;
      var noOwner = payload.filter(function (d) { return !d.assignees.length; }).length;
      var noDate = payload.filter(function (d) { return !d.dueAt; }).length;
      S.tasks = null;
      drafts = [];
      okDialog({
        title: 'บันทึกเข้าระบบแล้ว ' + n + ' งาน',
        lines: payload.slice(0, 6).map(function (d) {
          return d.title + (d.assignees.length ? ' → ' + d.assignees.map(function (id) { return shortName(staffById(id)); }).join(', ') : ' → ยังไม่มอบหมาย');
        }).concat(n > 6 ? ['และอีก ' + (n - 6) + ' งาน'] : []),
        note: (noOwner ? noOwner + ' งานยังไม่มีคนรับ · ' : '') + (noDate ? noDate + ' งานยังไม่กำหนดวัน' : '') || 'มอบหมายและกำหนดวันครบทุกงาน',
        link: { href: '#/all', label: 'ดูงานทั้งหมด' },
        onClose: function () { location.hash = '#/all'; },
      });
    }).catch(function (e) { btn.disabled = false; toast(e.message, true); });
  }

  /* ---------- รายละเอียดงาน ---------- */
  var pendingFiles = [];
  var pendingLinks = [];

  function fmtBytes(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return Math.round(b / 1024) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }
  function fileIcon(mime) {
    var m = String(mime || '');
    if (m.indexOf('video/') === 0) return '<path d="M4 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="m16 10 5-3v10l-5-3z"/>';
    if (m.indexOf('audio/') === 0) return '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>';
    if (m === 'application/pdf') return '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 15h6"/>';
    if (m.indexOf('zip') !== -1 || m.indexOf('compressed') !== -1) return '<path d="M4 4h16v16H4z"/><path d="M10 4v4M14 8v4M10 12v4M14 16v4"/>';
    if (m.indexOf('sheet') !== -1 || m.indexOf('excel') !== -1 || m.indexOf('csv') !== -1) return '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16"/>';
    return '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>';
  }
  function isImg(f) { return String(f.mime || '').indexOf('image/') === 0; }

  /* การ์ดไฟล์แนบ — รูปโชว์ภาพ · วิดีโอเล่นได้ · ไฟล์อื่นเป็นการ์ดกดโหลด · ลิงก์เป็นการ์ดเปิดเว็บ */
  function thumbsHtml(files, removable) {
    return '<div class="atts">' + files.map(function (f, i) {
      var rm = removable ? '<button type="button" class="attrm" data-rmfile="' + i + '" aria-label="เอาออก">✕</button>' : '';
      if (f.kind === 'link') {
        return '<a class="att link" href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="atti"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg></span>' +
          '<span class="attx"><b>' + esc(f.title || f.url) + '</b><small>' + esc(f.fileName || '') + '</small></span>' + rm + '</a>';
      }
      var src = f.dataUrl || (API + '/files/' + f.id);
      if (isImg(f)) {
        return '<div class="att img" data-src="' + esc(src) + '"><img src="' + esc(src) + '" alt="" loading="lazy">' +
          '<small>' + esc(f.fileName || '') + '</small>' + rm + '</div>';
      }
      if (String(f.mime || '').indexOf('video/') === 0 && !f.dataUrl) {
        return '<div class="att vid"><video src="' + esc(src) + '" controls preload="metadata"></video>' +
          '<small>' + esc(f.fileName || '') + ' · ' + fmtBytes(f.bytes) + '</small>' + rm + '</div>';
      }
      return '<a class="att file" href="' + esc(src) + '"' + (f.dataUrl ? '' : ' download') + '>' +
        '<span class="atti"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        fileIcon(f.mime) + '</svg></span>' +
        '<span class="attx"><b>' + esc(f.fileName || 'ไฟล์') + '</b><small>' + esc(fmtBytes(f.bytes)) + '</small></span>' + rm + '</a>';
    }).join('') + '</div>';
  }
  function renderTask(id) {
    api('/tasks/' + id).then(function (j) {
      var t = j.task, ups = j.updates, files = j.files, subs = j.subtasks || [], parent = j.parent;
      var filesByUpdate = {};
      files.forEach(function (f) { (filesByUpdate[f.updateId || '_'] = filesByUpdate[f.updateId || '_'] || []).push(f); });
      var es = effStatus(t), late = isLate(t), canEdit = S.me.role === 'owner' || t.createdBy === S.me.id;
      var mine = t.assignees.indexOf(S.me.id) !== -1;
      var canStatus = canEdit || mine;
      var by = staffById(t.createdBy);
      var view = $('#view');
      view.className = 'page';
      var h = '<div class="task-hero"><div class="crumbs"><a href="#/all">งานทั้งหมด</a><span>›</span>' +
        (parent ? '<a href="#/task/' + esc(parent.id) + '">' + esc(parent.title) + '</a><span>›</span><span class="pill repeat">งานย่อย</span><span>›</span>' : '') +
        (t.kpiId ? '<a href="#/all?kpi=' + esc(t.kpiId) + '">' + esc((kpiById(t.kpiId) || {}).code || '') + '</a><span>›</span>' : '') +
        '<span class="pill ' + (late ? 'late' : esc(es)) + '">' + (late ? 'เลยกำหนด' : STATUS_TH[es]) + '</span>' +
        (t.repeat ? '<span class="pill ' + (es === 'done' ? 'done' : 'repeat') + '">' +
          (t.repeat === 'daily'
            ? (es === 'done' ? 'อัปเดตแล้ววันนี้' : 'งานประจำวัน · ยังไม่อัปเดตวันนี้')
            : (es === 'done' ? 'อัปเดตแล้วสัปดาห์นี้' : 'งานประจำสัปดาห์')) + '</span>' : '') + '</div>' +
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

      /* งานย่อย — เฉพาะงานหลัก (งานย่อยไม่ซ้อนอีกชั้น จะได้ไม่กลายเป็นต้นไม้ที่ตามไม่ทัน) */
      if (!t.parentId) {
        var doneSub = subs.filter(function (x) { return effStatus(x) === 'done'; }).length;
        h += '<div class="sec"><div class="sec-h"><h2>งานย่อย</h2>' +
          (subs.length ? '<p>เสร็จ ' + doneSub + ' จาก ' + subs.length + '</p>' : '<p>ซอยงานใหญ่เป็นขั้น ๆ ให้ทีมเก็บทีละอัน</p>') + '</div>';
        if (subs.length) {
          h += '<div class="sec-b tight"><div class="subbar"><i style="width:' + Math.round(doneSub / subs.length * 100) + '%"></i></div>' +
            '<div class="tlist sublist">' + subs.map(function (x) {
              var xs = effStatus(x);
              return '<div class="subrow' + (xs === 'done' ? ' done' : '') + '">' +
                (canStatus ? '<button type="button" class="subcheck ' + esc(xs) + '" data-subtoggle="' + esc(x.id) + '" aria-label="สลับสถานะ">' + (xs === 'done' ? '✓' : '') + '</button>'
                           : '<span class="subcheck ' + esc(xs) + '">' + (xs === 'done' ? '✓' : '') + '</span>') +
                '<a class="subt" href="#/task/' + esc(x.id) + '">' + esc(x.title) + '</a>' +
                '<span class="subm">' + avatars(x.assignees) + (x.dueAt ? '<span>' + esc(fmtDue(x)) + '</span>' : '') +
                (x.nFiles ? '<span>📷 ' + x.nFiles + '</span>' : '') + '</span></div>';
            }).join('') + '</div></div>';
        }
        h += '<div class="sec-b' + (subs.length ? ' subadd' : '') + '"><form id="subForm" class="subnew">' +
          '<input class="input" name="title" placeholder="เพิ่มงานย่อย แล้วกด Enter" autocomplete="off">' +
          '<button type="submit" class="btn-ghost sm">เพิ่ม</button></form>' +
          '<p class="hint">งานย่อยมอบหมายคนและกำหนดวันแยกได้ กดที่ชื่อเพื่อเปิดรายละเอียด</p></div></div>';
      }

      h += '<div class="sec"><div class="sec-h"><h2>ความคืบหน้า</h2><p>' + ups.length + ' รายการ · ' + files.length + ' รูป</p></div><div class="sec-b tight"><div class="tl">' +
        (ups.length ? ups.map(function (u) {
          var s = staffById(u.staffId), fl = filesByUpdate[u.id] || [];
          var what = u.kind === 'create' ? 'สร้างงาน' : (u.statusTo && u.kind !== 'create' ? 'เปลี่ยนสถานะเป็น <span class="pill ' + esc(u.statusTo) + '">' + STATUS_TH[u.statusTo] + '</span>' : (fl.length ? 'แนบไฟล์' : 'บันทึก'));
          return '<div class="tl-i">' + avatar(s, 'lg') + '<div><div class="h"><b>' + esc(s ? shortName(s) : '?') + '</b><span>' + what + '</span><time>' + esc(fmtAgo(u.createdAt)) + '</time></div>' +
            (u.note ? '<div class="n">' + withMentions(u.note) + '</div>' : '') + (fl.length ? thumbsHtml(fl) : '') + '</div></div>';
        }).join('') : '<div class="empty">ยังไม่มีความคืบหน้า</div>') + '</div></div></div>';
      h += '</div><div>';

      h += '<div class="sec"><div class="sec-h"><h2>อัปเดตงาน</h2></div><div class="sec-b"><form id="updForm" class="upl">' +
        (canStatus ? '<div><label class="label">สถานะ</label><div class="chips" id="stChips">' +
          ['todo', 'doing', 'blocked', 'done'].map(function (s) { return '<button type="button" class="chip plain' + (es === s ? ' on' : '') + '" data-st="' + s + '">' + STATUS_TH[s] + '</button>'; }).join('') + '</div></div>' : '') +
        '<div class="field"><label class="label">บันทึก / รายงานผล <small>พิมพ์ @ชื่อ เพื่อแท็กให้เขาเห็นในกระดิ่ง</small></label>' +
        '<textarea class="textarea" name="note" placeholder="ทำอะไรไปแล้ว ติดอะไร ส่งอะไรให้ใคร"></textarea>' +
        '<div class="chips" style="margin-top:8px">' + S.staff.filter(function (x) { return x.active && x.id !== S.me.id; }).map(function (x) {
          return '<button type="button" class="chip" data-tag="' + esc(shortName(x)) + '">' + avatar(x) + '@' + esc(shortName(x)) + '</button>';
        }).join('') + '</div></div>' +
        '<div class="drop" id="drop"><input type="file" multiple id="fileIn">' +
        '<svg class="dropi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>' +
        '<span><b>ลากไฟล์มาวางตรงนี้</b> หรือกดเพื่อเลือก — รูป วิดีโอ PDF ไฟล์อะไรก็ได้<br>' +
        '<small>รูปย่อให้อัตโนมัติ · ไฟล์อื่นไม่เกิน 1.3 MB ต่อไฟล์ · ไฟล์ใหญ่/วิดีโอยาว ให้วางลิงก์แทน</small></span></div>' +
        '<div class="linkrow"><input class="input" id="linkIn" placeholder="หรือวางลิงก์ Drive / YouTube / Figma แล้วกด Enter" autocomplete="off">' +
        '<button type="button" class="btn-ghost sm" id="linkAdd">แนบลิงก์</button></div>' +
        '<div id="pendThumbs"></div>' +
        '<div class="acts"><button type="submit" class="btn" id="updBtn">บันทึกอัปเดต</button>' +
        (canStatus && es !== 'done'
          ? '<button type="button" class="btn-ghost" id="doneBtn">✓ ' + (t.repeat ? (t.repeat === 'daily' ? 'อัปเดตครบวันนี้' : 'อัปเดตครบสัปดาห์นี้') : 'เสร็จแล้ว') + '</button>'
          : '') + '</div></form></div></div>';
      if (files.length) {
        h += '<div class="sec"><div class="sec-h"><h2>ไฟล์แนบทั้งหมด</h2><p>' + files.length + ' รายการ</p></div><div class="sec-b">' + thumbsHtml(files) + '</div></div>';
      }
      h += '</div></div>';
      view.innerHTML = h;
      pendingFiles = [];
      pendingLinks = [];
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
    function drawPending() {
      var all = pendingLinks.concat(pendingFiles);
      $('#pendThumbs').innerHTML = all.length ? thumbsHtml(all, true) : '';
    }
    /* รูปย่อก่อนส่ง · ไฟล์อื่นส่งตามจริงแต่ต้องไม่เกินเพดานของ D1 */
    function readFile(f) {
      if (f.type.indexOf('image/') === 0) {
        return resizeImage(f, 1600, 0.82).then(function (d) { return { fileName: f.name, mime: 'image/jpeg', dataUrl: d, bytes: Math.floor(d.length * 3 / 4) }; });
      }
      if (f.size > 1350000) {
        return Promise.reject(new Error('“' + f.name + '” ใหญ่ ' + fmtBytes(f.size) + ' — เกิน 1.3 MB ให้อัปขึ้น Drive แล้ววางลิงก์แทน'));
      }
      return new Promise(function (res, rej) {
        var r = new FileReader();
        r.onload = function () { res({ fileName: f.name, mime: f.type || 'application/octet-stream', dataUrl: r.result, bytes: f.size }); };
        r.onerror = function () { rej(new Error('อ่านไฟล์ไม่ได้: ' + f.name)); };
        r.readAsDataURL(f);
      });
    }
    function takeFiles(list) {
      list = Array.prototype.slice.call(list || []);
      if (!list.length) return;
      if (pendingFiles.length + list.length > 6) {
        toast('แนบได้สูงสุด 6 ไฟล์ต่อครั้ง', true);
        list = list.slice(0, 6 - pendingFiles.length);
      }
      Promise.all(list.map(function (f) { return readFile(f).catch(function (e) { toast(e.message, true); return null; }); }))
        .then(function (arr) {
          pendingFiles = pendingFiles.concat(arr.filter(Boolean));
          drawPending();
        });
    }
    var fileIn = $('#fileIn');
    fileIn.addEventListener('change', function () { takeFiles(fileIn.files); fileIn.value = ''; });

    /* ลากวาง — ต้องกัน dragover ไม่งั้นเบราว์เซอร์เปิดไฟล์ทับหน้าเว็บ */
    var drop = $('#drop');
    drop.addEventListener('click', function (ev) { if (ev.target !== fileIn) fileIn.click(); });
    ['dragenter', 'dragover'].forEach(function (t) {
      drop.addEventListener(t, function (ev) { ev.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      drop.addEventListener(t, function (ev) { ev.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (ev) {
      var dt = ev.dataTransfer;
      if (dt.files && dt.files.length) { takeFiles(dt.files); return; }
      var url = dt.getData('text/uri-list') || dt.getData('text/plain');
      if (url) addLink(url);
    });
    /* วางไฟล์/ลิงก์จากคลิปบอร์ดลงช่องบันทึกได้ตรง ๆ */
    $('#updForm').note.addEventListener('paste', function (ev) {
      var items = (ev.clipboardData || {}).items || [];
      var files = [];
      for (var i = 0; i < items.length; i++) if (items[i].kind === 'file') { var f = items[i].getAsFile(); if (f) files.push(f); }
      if (files.length) { ev.preventDefault(); takeFiles(files); }
    });

    function addLink(url) {
      url = String(url || '').trim();
      if (!/^https?:\/\//i.test(url)) { toast('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://', true); return; }
      if (pendingLinks.length >= 6) { toast('แนบลิงก์ได้สูงสุด 6 อันต่อครั้ง', true); return; }
      var host = url;
      try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
      pendingLinks.push({ kind: 'link', url: url, title: url.length > 70 ? url.slice(0, 70) + '…' : url, fileName: host });
      $('#linkIn').value = '';
      drawPending();
    }
    $('#linkAdd').addEventListener('click', function () { addLink($('#linkIn').value); });
    $('#linkIn').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); addLink(this.value); }
    });

    $('#pendThumbs').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-rmfile]'); if (!b) return;
      ev.preventDefault(); ev.stopPropagation();
      var i = Number(b.getAttribute('data-rmfile'));
      if (i < pendingLinks.length) pendingLinks.splice(i, 1);
      else pendingFiles.splice(i - pendingLinks.length, 1);
      drawPending();
    });
    function submitUpdate(statusOverride) {
      var note = $('#updForm').note.value.trim();
      /* งานประจำ: กด "เสร็จ" ซ้ำในรอบใหม่ต้องส่งขึ้นไป แม้ค่าใน DB ยังเป็น done ของเมื่อวาน */
      var cur = effStatus(t);
      var status = statusOverride || (chosenStatus && (chosenStatus !== cur || t.repeat) ? chosenStatus : null);
      if (!note && !status && !pendingFiles.length && !pendingLinks.length) { toast('ใส่บันทึก เลือกสถานะ หรือแนบไฟล์ก่อน', true); return; }
      $('#updBtn').disabled = true;
      var nFile = pendingFiles.length, nLink = pendingLinks.length;
      api('/tasks/' + t.id + '/updates', 'POST', {
        note: note, status: status,
        files: pendingFiles.map(function (f) { return { fileName: f.fileName, dataUrl: f.dataUrl }; }),
        links: pendingLinks.map(function (l) { return { url: l.url, title: l.title }; }),
      })
        .then(function () {
          var lines = [];
          if (status) lines.push('เปลี่ยนสถานะเป็น "' + STATUS_TH[status] + '"');
          if (note) lines.push('บันทึก: ' + (note.length > 60 ? note.slice(0, 60) + '…' : note));
          if (nFile) lines.push('แนบไฟล์ ' + nFile + ' ไฟล์');
          if (nLink) lines.push('แนบลิงก์ ' + nLink + ' อัน');
          var tagged = note ? S.staff.filter(function (x) {
            return x.id !== S.me.id && new RegExp('@' + shortName(x), 'i').test(note);
          }).map(shortName) : [];
          S.tasks = null;
          okDialog({
            title: 'อัปเดตงานแล้ว',
            lines: lines,
            note: tagged.length ? 'แจ้งเตือนไปที่ ' + tagged.join(', ') + ' แล้ว' : 'ทีมเห็นในไทม์ไลน์ของงานนี้ทันที',
            onClose: function () { renderTask(t.id); },
          });
        })
        .catch(function (e) { $('#updBtn').disabled = false; toast(e.message, true); });
    }
    $('#updForm').addEventListener('submit', function (ev) { ev.preventDefault(); submitUpdate(null); });
    /* ปุ่มชื่อคน = แทรก @ชื่อ ลงในช่องบันทึก ไม่ต้องจำว่าสะกดยังไง */
    $('#updForm').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-tag]'); if (!b) return;
      var ta = $('#updForm').note, tag = '@' + b.getAttribute('data-tag') + ' ';
      if (ta.value.indexOf(tag) === -1) ta.value = (ta.value ? ta.value.replace(/\s*$/, ' ') : '') + tag;
      ta.focus();
    });

    var subForm = $('#subForm');
    if (subForm) subForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var title = this.title.value.trim();
      if (!title) return;
      var btn = this.querySelector('button');
      btn.disabled = true;
      api('/tasks', 'POST', { tasks: [{ title: title, parentId: t.id, kpiId: t.kpiId }] })
        .then(function () { S.tasks = null; toast('เพิ่มงานย่อย “' + title + '” แล้ว'); renderTask(t.id); })
        .catch(function (e) { btn.disabled = false; toast(e.message, true); });
    });
    $$('[data-subtoggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var sid = b.getAttribute('data-subtoggle');
        var cur = b.className.indexOf('done') !== -1 ? 'todo' : 'done';
        b.disabled = true;
        api('/tasks/' + sid + '/updates', 'POST', { status: cur })
          .then(function () { S.tasks = null; renderTask(t.id); })
          .catch(function (e) { b.disabled = false; toast(e.message, true); });
      });
    });
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
        }).then(function () {
          S.tasks = null;
          okDialog({ title: 'แก้ไขงานแล้ว', lines: ['ชื่องาน: ' + f.title.value], onClose: function () { renderTask(t.id); } });
        }).catch(function (e) { toast(e.message, true); });
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
        var ts = all.filter(function (t) { return t.kpiId === k.id && !t.parentId; });
        var open = ts.filter(function (t) { return effStatus(t) !== 'done'; }), late = open.filter(isLate), done = ts.length - open.length;
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

  /* ---------- ตารางโพสต์ ----------
     พิซซ่ากรอกแผน · หัวหน้าเข้ามาดูว่า "วันนี้โพสต์ครบยัง มีลิงก์ไหม" แล้วติ๊กจบ
     เก็บแยกจาก task เพราะเดือนหนึ่งมีเป็นร้อยโพสต์ ถ้ายัดเป็น task งานจริงจะถูกกลบ */
  var P = { page: '', range: 'today', status: '' };
  var POST_KIND = { content: 'คอนเทนต์', promo: 'โปรโมชัน', video: 'วิดีโอ', live: 'ไลฟ์' };

  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function postRangeDates() {
    var now = new Date();
    if (P.range === 'today') return [ymd(now), ymd(now)];
    if (P.range === 'week') {
      var a = startOfWeek(now), b = new Date(a); b.setDate(b.getDate() + 6);
      return [ymd(a), ymd(b)];
    }
    if (P.range === 'month') {
      return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
    }
    return ['', ''];
  }
  function pageName(id) {
    var p = (S.pages || []).filter(function (x) { return x.id === id; })[0];
    return p ? p.name : (id || '—');
  }
  function loadPages() {
    if (S.pages) return Promise.resolve(S.pages);
    return api('/pages').then(function (j) { S.pages = j.pages || []; return S.pages; });
  }

  function renderPosts() {
    var q = S.route.query || {};
    if (q.range) P.range = q.range;
    if (q.page) P.page = q.page;
    var d = postRangeDates();
    var qs = '?' + (d[0] ? 'from=' + d[0] + '&to=' + d[1] : '') + (P.page ? '&page=' + encodeURIComponent(P.page) : '');
    Promise.all([loadPages(), api('/posts' + qs)]).then(function (r) {
      var posts = r[1].posts || [];
      var shown = posts.filter(function (x) {
        if (P.status === 'left') return x.status !== 'done';
        if (P.status === 'nolink') return x.status === 'done' && !x.url;
        if (P.status === 'done') return x.status === 'done';
        return true;
      });
      var done = posts.filter(function (x) { return x.status === 'done'; });
      var noLink = done.filter(function (x) { return !x.url; });
      var left = posts.filter(function (x) { return x.status === 'plan'; });
      var skip = posts.filter(function (x) { return x.status === 'skip'; });

      var view = $('#view');
      view.className = 'page';
      var label = { today: 'วันนี้', week: 'สัปดาห์นี้', month: 'เดือนนี้', all: 'ทั้งหมด' }[P.range];
      var h = '<div class="top"><div><span class="kicker">ตารางโพสต์</span><h1>คอนเทนต์ ' + esc(label) + '</h1>' +
        '<p>ดูว่าโพสต์ไปหรือยังและมีลิงก์ไหม — ติ๊กช่องหน้าแถวเพื่อปิดงาน หรือวางลิงก์โพสต์ลงช่องแล้วระบบติ๊กให้เอง</p></div>' +
        '<div class="top-r"><button type="button" class="btn" id="newPost">+ เพิ่มโพสต์</button></div></div>';

      h += '<div class="cards">' +
        '<article class="hot"><span class="l">โพสต์ในช่วงนี้</span><b>' + posts.length + '</b><small>' + esc(d[0] ? d[0] + ' → ' + d[1] : 'ทุกวัน') + '</small></article>' +
        '<article' + (left.length ? ' class="warn"' : '') + ' data-p="left"><span class="l">ยังไม่ได้โพสต์</span><b>' + left.length + '</b><small>กดเพื่อดูเฉพาะที่ค้าง</small></article>' +
        '<article' + (noLink.length ? ' class="bad"' : '') + ' data-p="nolink"><span class="l">โพสต์แล้วแต่ไม่มีลิงก์</span><b>' + noLink.length + '</b><small>ตรวจไม่ได้ว่าขึ้นจริง</small></article>' +
        '<article data-p="done"><span class="l">โพสต์แล้ว</span><b>' + done.length + '</b><small>' + (skip.length ? skip.length + ' รายการไม่ได้ตั้งโพสต์' : 'ครบตามแผน') + '</small></article></div>';

      var seg = function (name, opts, obj) {
        return '<div class="seg">' + opts.map(function (o) {
          return '<button type="button" class="' + (obj[name] === o[0] ? 'on' : '') + '" data-p="' + name + '" data-v="' + o[0] + '">' + esc(o[1]) + '</button>';
        }).join('') + '</div>';
      };
      h += '<div class="tbar">' +
        seg('range', [['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้'], ['all', 'ทั้งหมด']], P) +
        '<select class="select" id="pageSel" style="width:auto;min-width:170px"><option value="">ทุกเพจ</option>' +
        (S.pages || []).map(function (pg) {
          return '<option value="' + esc(pg.id) + '"' + (P.page === pg.id ? ' selected' : '') + '>' + esc(pg.name) + '</option>';
        }).join('') + '</select>' +
        (P.status ? '<button type="button" class="fchip" data-p="status" data-v="">' +
          ({ left: 'ยังไม่ได้โพสต์', nolink: 'ไม่มีลิงก์', done: 'โพสต์แล้ว' }[P.status] || '') + ' <span>✕</span></button>' : '') +
        '<span class="tbar-n">' + shown.length + ' โพสต์</span></div>';

      if (!shown.length) {
        /* ตารางว่างทั้งใบ + เป็นหัวหน้า = เสนอให้ดึงไฟล์เดิมของพิซซ่าเข้ามาให้เลย
           (ยิงจากเบราว์เซอร์ของหัวหน้า เพราะ API ต้องใช้สิทธิ์เจ้าของ) */
        var emptyAll = !posts.length && !P.page && P.range === 'all' && !P.status;
        h += '<div class="sec"><div class="empty"><b>ไม่มีโพสต์ในช่วงนี้</b>' +
          (P.range === 'today' ? 'วันนี้ยังไม่มีแผนโพสต์ หรือพิซซ่ายังไม่ได้กรอก' : 'ลองเปลี่ยนช่วงเวลาหรือเพจ') +
          (S.me.role === 'owner'
            ? '<div style="margin-top:18px"><button type="button" class="btn" id="seedPosts">นำเข้าตารางโพสต์เดิม 469 แถว</button>' +
              '<p class="hint" style="margin-top:10px">จากไฟล์ ตารางโพสต์.xlsx ของพิซซ่า (ก.ค.–ก.ย. 69) · กดซ้ำได้ ข้อมูลไม่ซ้ำเพราะใช้รหัสแถวเดิม</p></div>'
            : '') + '</div></div>';
      } else {
        var byDate = {};
        shown.forEach(function (x) { (byDate[x.date] = byDate[x.date] || []).push(x); });
        Object.keys(byDate).sort().forEach(function (dt) {
          var dd = new Date(dt + 'T00:00:00');
          var isToday = sameDay(dd, new Date());
          h += '<div class="group"><div class="group-h' + (isToday ? ' late' : '') + '"><h3>' +
            (isToday ? 'วันนี้ · ' : '') + esc(DAY_TH[dd.getDay()] + ' ' + fmtDate(dd, true)) + '</h3><span>' + byDate[dt].length + '</span></div>' +
            '<div class="tlist">' + byDate[dt].map(postRow).join('') + '</div></div>';
        });
      }
      view.innerHTML = h;

      $('#pageSel').addEventListener('change', function () { P.page = this.value; renderPosts(); });
      $('#newPost').addEventListener('click', function () { openPostForm(null); });
      var sb = $('#seedPosts');
      if (sb) sb.addEventListener('click', function () { seedPosts(sb); });
    }).catch(function (e) { showError(e); });
  }

  function postRow(x) {
    var st = x.status;
    var mark = st === 'done' ? '✓' : (st === 'skip' ? '–' : '');
    return '<div class="postrow ' + esc(st) + '" data-post="' + esc(x.id) + '">' +
      '<button type="button" class="subcheck ' + (st === 'done' ? 'done' : (st === 'skip' ? 'blocked' : '')) + '" data-post-toggle="' + esc(x.id) + '" aria-label="ติ๊กว่าโพสต์แล้ว">' + mark + '</button>' +
      '<span class="ptime">' + esc(x.time || '—') + '</span>' +
      '<span class="pmain"><span class="pt">' + esc(x.topic || '(ยังไม่ใส่หัวข้อ)') + '</span>' +
      '<span class="pm"><span class="pill ' + (x.kind === 'live' ? 'blocked' : (x.kind === 'promo' ? 'repeat' : 'todo')) + '">' + esc(POST_KIND[x.kind] || x.kind) + '</span>' +
      '<span>' + esc(pageName(x.pageId)) + '</span>' +
      (x.channels || []).map(function (c) { return '<span class="ch">' + esc(c) + '</span>'; }).join('') +
      (x.note ? '<span class="pnote" title="' + esc(x.note) + '">' + esc(x.note.slice(0, 40)) + '</span>' : '') + '</span></span>' +
      (x.url
        ? '<a class="plink" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">เปิดโพสต์ ↗</a>'
        : '<input class="input purl" data-post-url="' + esc(x.id) + '" placeholder="วางลิงก์โพสต์" autocomplete="off">') +
      '<button type="button" class="btn-text pedit" data-post-edit="' + esc(x.id) + '">แก้</button></div>';
  }

  /* ฟอร์มเพิ่ม/แก้โพสต์ — พิซซ่าใช้กรอกแผน */
  function openPostForm(post) {
    var isNew = !post;
    var host = document.createElement('div');
    host.className = 'modal';
    var chAll = ['Facebook', 'Line OA', 'TikTok', 'Instagram'];
    host.innerHTML = '<div class="modal-box"><div class="sec-h"><h2>' + (isNew ? 'เพิ่มโพสต์' : 'แก้โพสต์') + '</h2>' +
      '<button type="button" class="btn-text" data-close>ปิด</button></div><div class="sec-b"><form id="postForm" style="display:grid;gap:12px">' +
      '<div class="grid2"><div class="field"><label class="label">เพจ</label><select class="select" name="pageId">' +
      (S.pages || []).map(function (pg) { return '<option value="' + esc(pg.id) + '"' + (post && post.pageId === pg.id ? ' selected' : '') + '>' + esc(pg.name) + '</option>'; }).join('') +
      '</select></div><div class="field"><label class="label">ชนิด</label><select class="select" name="kind">' +
      Object.keys(POST_KIND).map(function (k) { return '<option value="' + k + '"' + (post && post.kind === k ? ' selected' : '') + '>' + POST_KIND[k] + '</option>'; }).join('') +
      '</select></div></div>' +
      '<div class="grid2"><div class="field"><label class="label">วันที่</label><input class="input" type="date" name="date" value="' + esc(post ? post.date : ymd(new Date())) + '" required></div>' +
      '<div class="field"><label class="label">เวลาโพสต์</label><input class="input" name="time" value="' + esc(post ? post.time : '') + '" placeholder="เช่น 17.00"></div></div>' +
      '<div class="field"><label class="label">ช่องทาง</label><div class="chips" id="chSel">' +
      chAll.map(function (c) {
        var on = post && (post.channels || []).indexOf(c) !== -1;
        return '<button type="button" class="chip plain' + (on ? ' on' : '') + '" data-ch="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="field"><label class="label">หัวข้อ / เนื้อหา</label><textarea class="textarea" name="topic" placeholder="เช่น aw โปร 10 20 30 + โซนที่ร่วมรายการ">' + esc(post ? post.topic : '') + '</textarea></div>' +
      '<div class="grid2"><div class="field"><label class="label">ลิงก์โพสต์ <small>ใส่แล้วนับว่าโพสต์แล้ว</small></label><input class="input" name="url" value="' + esc(post ? post.url : '') + '" placeholder="https://..."></div>' +
      '<div class="field"><label class="label">หมายเหตุ</label><input class="input" name="note" value="' + esc(post ? post.note : '') + '"></div></div>' +
      '<div class="acts"><button type="submit" class="btn">' + (isNew ? 'เพิ่มโพสต์' : 'บันทึก') + '</button>' +
      '<button type="button" class="btn-ghost" data-close>ยกเลิก</button>' +
      (!isNew && S.me.role === 'owner' ? '<button type="button" class="btn-ghost danger" id="delPost" style="margin-left:auto">ลบ</button>' : '') +
      '</div></form></div></div>';
    document.body.appendChild(host);
    var close = function () { host.remove(); };
    $$('[data-close]', host).forEach(function (b) { b.addEventListener('click', close); });
    host.addEventListener('click', function (ev) { if (ev.target === host) close(); });
    $('#chSel', host).addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ch]'); if (b) b.classList.toggle('on');
    });
    var del = $('#delPost', host);
    if (del) del.addEventListener('click', function () {
      if (!confirm('ลบโพสต์นี้?')) return;
      api('/posts/' + post.id, 'DELETE').then(function () { close(); renderPosts(); }).catch(function (e) { toast(e.message, true); });
    });
    $('#postForm', host).addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this;
      var body = {
        pageId: f.pageId.value, kind: f.kind.value, date: f.date.value, time: f.time.value,
        topic: f.topic.value, url: f.url.value.trim(), note: f.note.value,
        channels: $$('.chip.on[data-ch]', host).map(function (b) { return b.getAttribute('data-ch'); }),
      };
      var req = isNew ? api('/posts', 'POST', { posts: [body] }) : api('/posts/' + post.id, 'PUT', body);
      req.then(function () {
        close();
        var pg = (S.pages || []).filter(function (x) { return x.id === body.pageId; })[0];
        okDialog({
          title: isNew ? 'เพิ่มโพสต์เข้าตารางแล้ว' : 'บันทึกโพสต์แล้ว',
          lines: [
            (pg ? pg.name : '') + ' · ' + body.date + (body.time ? ' ' + body.time : ''),
            body.topic ? (body.topic.length > 70 ? body.topic.slice(0, 70) + '…' : body.topic) : '(ยังไม่ใส่หัวข้อ)',
            body.channels.length ? 'ช่องทาง: ' + body.channels.join(', ') : 'ยังไม่เลือกช่องทาง',
          ],
          note: body.url ? 'มีลิงก์แล้ว ระบบนับว่าโพสต์เรียบร้อย' : 'ยังไม่มีลิงก์ — พอโพสต์จริงแล้ววางลิงก์ในตารางได้เลย',
          onClose: renderPosts,
        });
      }).catch(function (e) { toast(e.message, true); });
    });
  }

  /* ดึงไฟล์ตั้งต้นแล้วยิงเข้า API ทีละ 150 แถว — ยิงทีเดียวทั้งก้อนจะเกินขนาดที่ D1 รับไหว */
  function seedPosts(btn) {
    btn.disabled = true;
    var was = btn.textContent;
    btn.textContent = 'กำลังนำเข้า…';
    fetch('posts-seed.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('อ่านไฟล์ตั้งต้นไม่ได้');
      return r.json();
    }).then(function (data) {
      return api('/pages', 'POST', { pages: data.pages }).then(function () {
        var chunks = [];
        for (var i = 0; i < data.posts.length; i += 150) chunks.push(data.posts.slice(i, i + 150));
        var n = 0;
        return chunks.reduce(function (chain, c, idx) {
          return chain.then(function () {
            btn.textContent = 'กำลังนำเข้า ' + Math.round((idx / chunks.length) * 100) + '%';
            return api('/posts', 'POST', { posts: c }).then(function (j) { n += (j.ids || []).length; });
          });
        }, Promise.resolve()).then(function () { return { n: n, pages: data.pages.length }; });
      });
    }).then(function (r) {
      P.range = 'month';
      okDialog({
        title: 'นำเข้าตารางโพสต์แล้ว',
        lines: [r.n + ' โพสต์ · ' + r.pages + ' เพจ', 'ช่วง ก.ค. – ก.ย. 2569 จากไฟล์ของพิซซ่า'],
        note: 'จากนี้พิซซ่ากรอกต่อในระบบได้เลย ไม่ต้องกลับไปแก้ในไฟล์',
        onClose: renderPosts,
      });
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = was;
      toast(e.message, true);
    });
  }

  function openPostFormById(id) {
    var d = postRangeDates();
    var qs = '?' + (d[0] ? 'from=' + d[0] + '&to=' + d[1] : '') + (P.page ? '&page=' + encodeURIComponent(P.page) : '');
    api('/posts' + qs).then(function (j) {
      var post = (j.posts || []).filter(function (x) { return x.id === id; })[0];
      if (!post) { toast('ไม่พบโพสต์นี้แล้ว', true); renderPosts(); return; }
      openPostForm(post);
    }).catch(function (e) { toast(e.message, true); });
  }

  /* ---------- กระดิ่ง: คนแท็กถึงเรา ---------- */
  function renderInbox() {
    loadNotif().then(function (j) {
      renderHeaderUser();
      renderSidebar();
      var view = $('#view');
      view.className = 'page';
      var h = '<div class="top"><div><span class="kicker">แจ้งเตือน</span><h1>คนแท็กถึงคุณ</h1>' +
        '<p>ทุกครั้งที่มีคนพิมพ์ <b>@' + esc(shortName(S.me)) + '</b> ในคอมเมนต์ของงาน จะมาโผล่ที่นี่</p></div>' +
        (j.unread ? '<div class="top-r"><button type="button" class="btn-ghost" id="readAll">อ่านทั้งหมดแล้ว</button></div>' : '') + '</div>';
      if (!j.items.length) {
        h += '<div class="sec"><div class="empty"><b>ยังไม่มีใครแท็กถึงคุณ</b>เวลาทีมพิมพ์ @ชื่อคุณ ในช่องบันทึกของงาน จะเด้งมาที่นี่</div></div>';
      } else {
        h += '<div class="sec"><div class="sec-b tight"><div class="tl">' + j.items.map(function (n) {
          var by = staffById(n.byStaff);
          return '<a class="tl-i notif' + (n.read ? '' : ' new') + '" href="#/task/' + esc(n.taskId) + '" data-notif="' + esc(n.id) + '">' +
            avatar(by, 'lg') + '<div><div class="h"><b>' + esc(by ? shortName(by) : '?') + '</b><span>แท็กคุณใน</span>' +
            '<b style="font-weight:500">' + esc(n.taskTitle) + '</b><time>' + esc(fmtAgo(n.createdAt)) + '</time></div>' +
            '<div class="n">' + withMentions(n.note) + '</div></div></a>';
        }).join('') + '</div></div></div>';
      }
      view.innerHTML = h;
      var ra = $('#readAll');
      if (ra) ra.addEventListener('click', function () {
        api('/notifications/read', 'POST', {}).then(function () { renderInbox(); });
      });
      $$('[data-notif]').forEach(function (a) {
        a.addEventListener('click', function () { api('/notifications/read', 'POST', { id: a.getAttribute('data-notif') }); });
      });
    }).catch(function (e) { showError(e); });
  }

  /* ---------- ทีม ---------- */
  function renderTeam() {
    var view = $('#view');
    view.className = 'page';
    var owner = S.me.role === 'owner';
    var h = '<div class="top"><div><span class="kicker">ทีม + รหัสผ่าน</span><h1>ทีมงาน</h1>' +
      '<p>ทุกคนเข้าระบบด้วยอีเมลกับรหัสผ่านของตัวเอง ' + (owner ? 'หัวหน้าเพิ่มคน ตั้งรหัสผ่านให้ และปิดบัญชีได้ที่นี่ · "ชื่อเรียกใน @" คือคำที่ใช้พิมพ์ตอนสั่งงาน เช่น @Title' : 'เปลี่ยนอีเมลกับรหัสผ่านของคุณได้ด้านล่าง') + '</p></div></div>';
    h += '<div class="two"><div class="sec"><div class="sec-h"><h2>สมาชิก</h2><p>' + S.staff.filter(function (s) { return s.active; }).length + ' คนใช้งานอยู่</p></div><div class="sec-b tight">' +
      S.staff.map(function (s) {
        return '<div class="team-row' + (s.active ? '' : ' off') + '">' + avatar(s, 'lg') + '<div class="n"><b>' + esc(s.name) + (s.role === 'owner' ? ' <span class="pill doing" style="margin-left:6px">หัวหน้า</span>' : '') + (s.active ? '' : ' <span class="pill todo">ปิดใช้งาน</span>') +
          (s.hasPassword ? '' : ' <span class="pill late">ยังไม่ตั้งรหัส</span>') + '</b>' +
          '<small>' + (s.email ? esc(s.email) : 'ยังไม่มีอีเมล') + ' · @' + esc(s.aliases || shortName(s)) + '</small></div>' +
          (owner ? '<div class="acts"><button type="button" class="btn-ghost sm" data-edit-staff="' + esc(s.id) + '">แก้ไข</button>' +
            '<button type="button" class="btn-ghost sm" data-pw-staff="' + esc(s.id) + '">ตั้งรหัสผ่านให้</button>' +
            '<button type="button" class="btn-ghost sm" data-pin-staff="' + esc(s.id) + '">รหัสตั้งค่าใหม่</button>' +
            (s.id !== S.me.id ? '<button type="button" class="btn-ghost sm' + (s.active ? ' danger' : '') + '" data-active-staff="' + esc(s.id) + '" data-to="' + (s.active ? '0' : '1') + '">' + (s.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน') + '</button>' : '') + '</div>' : '') + '</div>';
      }).join('') + '</div></div><div>';
    if (owner) {
      h += '<div class="sec"><div class="sec-h"><h2>เพิ่มคนในทีม</h2></div><div class="sec-b"><form id="addStaff" style="display:grid;gap:12px">' +
        '<div class="field"><label class="label">ชื่อ-นามสกุล</label><input class="input" name="name" required placeholder="เช่น Somchai Dee"></div>' +
        '<div class="field"><label class="label">ชื่อเรียกใน @ <small>(คั่นด้วยจุลภาค)</small></label><input class="input" name="aliases" placeholder="เช่น Somchai,สมชาย"></div>' +
        '<div class="field"><label class="label">อีเมล <small>(เว้นไว้ให้เจ้าตัวตั้งเองก็ได้)</small></label><input class="input" name="email" type="email" placeholder="you@example.com"></div>' +
        '<div class="grid2"><div class="field"><label class="label">รหัสตั้งค่า <small>ให้เจ้าตัวใช้ครั้งแรก</small></label><input class="input" name="pin" inputmode="numeric" pattern="[0-9]{4,8}" required placeholder="4–8 หลัก"></div>' +
        '<div class="field"><label class="label">สิทธิ์</label><select class="select" name="role"><option value="member">สมาชิก</option><option value="owner">หัวหน้า</option></select></div></div>' +
        '<div class="acts"><button type="submit" class="btn">เพิ่มคน</button></div></form></div></div>';
    }
    h += '<div class="sec"><div class="sec-h"><h2>อีเมลและรหัสผ่านของฉัน</h2></div><div class="sec-b"><form id="myPw" style="display:grid;gap:12px">' +
      '<div class="field"><label class="label">รหัสผ่านปัจจุบัน</label><input class="input" name="password" type="password" autocomplete="current-password" required></div>' +
      '<div class="grid2"><div class="field"><label class="label">อีเมล <small>เว้นว่างถ้าไม่เปลี่ยน</small></label><input class="input" name="email" type="email" placeholder="' + esc(S.me.email || 'you@example.com') + '"></div>' +
      '<div class="field"><label class="label">รหัสผ่านใหม่ <small>เว้นว่างถ้าไม่เปลี่ยน</small></label><input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="8"></div></div>' +
      '<div class="acts"><button type="submit" class="btn-ghost">บันทึก</button></div></form></div></div>';
    h += '<div class="sec" id="storageBox"><div class="sec-h"><h2>พื้นที่เก็บรูป</h2></div><div class="sec-b"><p class="hint">กำลังอ่าน…</p></div></div>';
    h += '</div></div>';
    view.innerHTML = h;

    api('/storage').then(function (st) {
      var used = st.storedBytes, lim = st.limitFreeBytes;
      var mb = function (b) { return (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB'; };
      var pct = Math.min(100, used / lim * 100);
      var perPhoto = st.taskFiles ? st.rawBytes / st.taskFiles : 0;
      var left = perPhoto > 0 ? Math.floor((lim - used) / (perPhoto * 4 / 3)) : null;
      $('#storageBox .sec-b').innerHTML =
        '<div class="cards" style="margin:0 0 14px"><article><span class="l">รูปในระบบงาน</span><b>' + st.taskFiles + '</b><small>รูปที่ทีมอัปเดตเข้ามา</small></article>' +
        '<article><span class="l">รูปในปฏิทินแคมเปญ</span><b>' + st.campaignFiles + '</b><small>ของเดิมในฐานข้อมูลเดียวกัน</small></article>' +
        '<article' + (pct > 70 ? ' class="warn"' : '') + '><span class="l">ใช้ไปแล้ว</span><b>' + mb(used) + '</b><small>จาก ' + mb(lim) + ' ของแพ็กฟรี</small></article>' +
        '<article><span class="l">เติมได้อีกราว</span><b>' + (left === null ? '—' : left.toLocaleString('th-TH')) + '</b><small>รูป ถ้าขนาดเฉลี่ยเท่าเดิม</small></article></div>' +
        '<div class="subbar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<p class="hint" style="margin-top:10px">รูปเก็บใน Cloudflare D1 ฐานเดียวกับปฏิทินแคมเปญ ไม่ได้ฝากไว้ที่อื่น · ' +
        'เบราว์เซอร์ย่อรูปให้ก่อนส่ง ด้านยาวไม่เกิน 1400px และไม่เกิน ' + (st.maxPerFileBytes / 1048576).toFixed(1) + ' MB ต่อรูป · ' +
        'แพ็กฟรีของ D1 จำกัด ' + mb(lim) + ' ต่อฐานข้อมูล ถ้าอัปเกรดเป็น Workers Paid จะได้ ' + (st.limitPaidBytes / 1073741824) + ' GB</p>';
    }).catch(function () {
      var b = $('#storageBox .sec-b'); if (b) b.innerHTML = '<p class="hint">อ่านพื้นที่ไม่ได้</p>';
    });

    $('#myPw').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this;
      var body = { password: f.password.value };
      if (f.email.value.trim()) body.email = f.email.value.trim();
      if (f.newPassword.value) body.newPassword = f.newPassword.value;
      if (!body.email && !body.newPassword) { toast('ยังไม่ได้กรอกอีเมลหรือรหัสผ่านใหม่', true); return; }
      api('/me/password', 'PUT', body)
        .then(function () { f.reset(); return refreshMe(); })
        .then(function () {
          var lines = [];
          if (body.email) lines.push('อีเมลใหม่: ' + body.email);
          if (body.newPassword) lines.push('เปลี่ยนรหัสผ่านแล้ว');
          okDialog({
            title: 'บันทึกแล้ว',
            lines: lines,
            note: body.newPassword ? 'ครั้งหน้าใช้รหัสผ่านใหม่เข้าระบบ' : '',
            onClose: renderTeam,
          });
        })
        .catch(function (e) { toast(e.message, true); });
    });
    var add = $('#addStaff');
    if (add) add.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this;
      var who = f.name.value, code = f.pin.value;
      api('/staff', 'POST', { name: who, aliases: f.aliases.value, pin: code, role: f.role.value, email: f.email.value.trim() || null })
        .then(function () { return refreshMe(); })
        .then(function () {
          okDialog({
            title: 'เพิ่ม ' + who + ' เข้าทีมแล้ว',
            lines: ['รหัสตั้งค่าของเขาคือ ' + code, 'ให้เขาเข้า admin.kan-hub.com/tasks/ แล้วกดแท็บ "ตั้งรหัสครั้งแรก"'],
            note: 'รหัสนี้ใช้ได้ครั้งเดียว พอเขาตั้งรหัสผ่านเองแล้วจะใช้ไม่ได้อีก',
            onClose: renderTeam,
          });
        }).catch(function (e) { toast(e.message, true); });
    });
    view.addEventListener('click', function (ev) {
      var b;
      if ((b = ev.target.closest('[data-pin-staff]'))) {
        var s = staffById(b.getAttribute('data-pin-staff'));
        var pin = prompt('รหัสตั้งค่าใหม่ของ ' + s.name + ' (ตัวเลข 4–8 หลัก)\nให้เจ้าตัวเอาไปใช้ที่แท็บ "ตั้งรหัสครั้งแรก"');
        if (pin == null) return;
        api('/staff/' + s.id, 'PUT', { pin: pin, resetSetup: true })
          .then(refreshMe)
          .then(function () {
            okDialog({
              title: 'ตั้งรหัสตั้งค่าใหม่ให้ ' + s.name + ' แล้ว',
              lines: ['รหัสตั้งค่า: ' + pin, 'รหัสผ่านเดิมถูกล้าง เขาต้องไปตั้งใหม่ที่แท็บ "ตั้งรหัสครั้งแรก"'],
              note: 'ส่งรหัสนี้ให้เขาทางไลน์ได้เลย ใช้ได้ครั้งเดียว',
              onClose: renderTeam,
            });
          })
          .catch(function (e) { toast(e.message, true); });
      } else if ((b = ev.target.closest('[data-pw-staff]'))) {
        var st2 = staffById(b.getAttribute('data-pw-staff'));
        if (!st2.email) { toast('คนนี้ยังไม่มีอีเมล กด "แก้ไข" ใส่อีเมลก่อน', true); return; }
        var pw = prompt('ตั้งรหัสผ่านใหม่ให้ ' + st2.name + ' (อย่างน้อย 8 ตัว)\nเข้าระบบด้วยอีเมล ' + st2.email);
        if (pw == null) return;
        api('/staff/' + st2.id, 'PUT', { password: pw })
          .then(refreshMe)
          .then(function () {
            okDialog({
              title: 'ตั้งรหัสผ่านให้ ' + st2.name + ' แล้ว',
              lines: ['อีเมล: ' + st2.email, 'รหัสผ่าน: ' + pw],
              note: 'ส่งให้เขาแล้วบอกให้เปลี่ยนเองในหน้า "ทีม + รหัสผ่าน"',
              onClose: renderTeam,
            });
          })
          .catch(function (e) { toast(e.message, true); });
      } else if ((b = ev.target.closest('[data-active-staff]'))) {
        api('/staff/' + b.getAttribute('data-active-staff'), 'PUT', { active: b.getAttribute('data-to') === '1' })
          .then(refreshMe).then(renderTeam).catch(function (e) { toast(e.message, true); });
      } else if ((b = ev.target.closest('[data-edit-staff]'))) {
        var st = staffById(b.getAttribute('data-edit-staff'));
        var name = prompt('ชื่อ', st.name); if (name == null) return;
        var aliases = prompt('ชื่อเรียกใน @ (คั่นด้วยจุลภาค)', st.aliases || ''); if (aliases == null) return;
        var email = prompt('อีเมลสำหรับเข้าระบบ (เว้นว่างได้)', st.email || ''); if (email == null) return;
        api('/staff/' + st.id, 'PUT', { name: name, aliases: aliases, email: email.trim() })
          .then(refreshMe)
          .then(function () {
            okDialog({ title: 'บันทึกข้อมูล ' + name + ' แล้ว',
              lines: ['อีเมล: ' + (email.trim() || 'ยังไม่มี'), 'ชื่อเรียกใน @: ' + (aliases || '—')],
              onClose: renderTeam });
          }).catch(function (e) { toast(e.message, true); });
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
    if (S.route.name !== 'inbox') {
      loadNotif().then(function () { renderSidebar(); renderHeaderUser(); });
    }
    switch (S.route.name) {
      case 'all': return renderAll();
      case 'new': return renderNew();
      case 'task': return S.route.id ? renderTask(S.route.id) : renderAll();
      case 'kpi': return renderKpi();
      case 'inbox': return renderInbox();
      case 'posts': return renderPosts();
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
    if ((b = ev.target.closest('.cards article[data-p]'))) { P.status = b.getAttribute('data-p'); renderPosts(); return; }
    if ((b = ev.target.closest('.tbar [data-p], .fchip[data-p]'))) { P[b.getAttribute('data-p')] = b.getAttribute('data-v'); renderPosts(); return; }
    if ((b = ev.target.closest('[data-post-toggle]'))) {
      var pid = b.getAttribute('data-post-toggle');
      var next = b.className.indexOf('done') !== -1 ? 'plan' : 'done';
      b.disabled = true;
      api('/posts/' + pid, 'PUT', { status: next }).then(renderPosts).catch(function (e) { b.disabled = false; toast(e.message, true); });
      return;
    }
    if ((b = ev.target.closest('[data-post-edit]'))) {
      /* ดึงตัวจริงจากเซิร์ฟเวอร์ก่อนแก้ จะได้ไม่ทับข้อมูลที่คนอื่นเพิ่งเปลี่ยน */
      openPostFormById(b.getAttribute('data-post-edit'));
      return;
    }
    if ((b = ev.target.closest('.cards article[data-go]'))) { F.status = b.getAttribute('data-go'); renderAll(); return; }
    if (ev.target.closest('[data-filter-toggle]')) { S.filterOpen = !S.filterOpen; renderAll(); return; }
    if (ev.target.closest('[data-f-clear]')) { F.who = ''; F.kpi = ''; F.status = 'open'; renderAll(); return; }
    if ((b = ev.target.closest('.tbar [data-f], .fpanel [data-f], .factive [data-f], .hidden-note [data-f]'))) {
      F[b.getAttribute('data-f')] = b.getAttribute('data-v'); renderAll(); return;
    }
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
    if ((b = ev.target.closest('.att.img')) && !ev.target.closest('button')) {
      var lb = $('#lightbox'); lb.querySelector('img').src = b.getAttribute('data-src'); lb.hidden = false; return;
    }
    if (ev.target.closest('#lightbox')) { $('#lightbox').hidden = true; return; }
  });
  /* วางลิงก์ในแถวตารางโพสต์ แล้วกด Enter หรือคลิกที่อื่น = บันทึกทันที */
  function savePostUrl(input) {
    var pid = input.getAttribute('data-post-url');
    var v = input.value.trim();
    if (!v || input.dataset.saving) return;
    input.dataset.saving = '1';
    api('/posts/' + pid, 'PUT', { url: v })
      .then(function () { toast('บันทึกลิงก์แล้ว'); renderPosts(); })
      .catch(function (e) { input.dataset.saving = ''; toast(e.message, true); });
  }
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      document.documentElement.classList.remove('erp-open');
      $('#lightbox').hidden = true;
      var m = $('.modal'); if (m) { if (m._close) m._close(); else m.remove(); }
    }
    if (ev.key === 'Enter' && ev.target.matches && ev.target.matches('[data-post-url]')) {
      ev.preventDefault(); savePostUrl(ev.target);
    }
  });
  document.addEventListener('blur', function (ev) {
    if (ev.target.matches && ev.target.matches('[data-post-url]')) savePostUrl(ev.target);
  }, true);
  document.addEventListener('paste', function (ev) {
    if (!ev.target.matches || !ev.target.matches('[data-post-url]')) return;
    setTimeout(function () { savePostUrl(ev.target); }, 30);
  });
  window.addEventListener('hashchange', render);

  global.KAN_TASKS = { parseCommand: parseCommand, extractWhen: extractWhen, extractMentions: extractMentions, S: S };
  boot();
})(window);
