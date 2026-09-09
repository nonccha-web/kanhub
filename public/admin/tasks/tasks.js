/* ============================================================
   KAN Admin — งานทีม (Task) · SPA (hash route) คุยกับ /api/t/* ใน worker.js
   หน้า: #/me งานของฉัน · #/all งานทั้งหมด · #/new สั่งงาน (วางข้อความ) ·
         #/task/:id รายละเอียด+อัปเดต+ไฟล์แนบ · #/kpi KPI 2570 · #/team ทีม+รหัสผ่าน · #/inbox กระดิ่ง
   ============================================================ */
(function (global) {
  'use strict';

  var API = '/api/t';
  var S = { me: null, staff: [], kpis: [], tasks: null, pages: null, campaigns: null, notif: { unread: 0, items: [] }, route: { name: 'me' }, viewAs: null };

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
    /* ตัดวงเล็บ/เครื่องหมายออกก่อน ไม่งั้นชื่อแบบ "Pizza (Julalak)" จะได้ตัวย่อ "P(" */
    var p = String(name || '').replace(/[()[\]{}"'.,]/g, ' ').trim().split(/\s+/).filter(Boolean);
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
  /* ข้อความยาว ๆ ให้อ่านง่ายขึ้น: บรรทัดที่ขึ้นต้นด้วยเลขข้อหรือขีด แสดงเป็นรายการ · @ชื่อ เป็นบับเบิล */
  function richText(text) {
    var lines = String(text || '').split('\n');
    var out = '', mode = '';
    var closeList = function () { if (mode) { out += mode === 'ol' ? '</ol>' : '</ul>'; mode = ''; } };
    lines.forEach(function (line) {
      var num = line.match(/^\s*(\d+)\.\s+(.*)$/);
      var bul = line.match(/^\s*[-•]\s+(.*)$/);
      if (num) {
        if (mode !== 'ol') { closeList(); out += '<ol class="rlist">'; mode = 'ol'; }
        out += '<li>' + withMentions(num[2]) + '</li>';
      } else if (bul) {
        if (mode !== 'ul') { closeList(); out += '<ul class="rlist">'; mode = 'ul'; }
        out += '<li>' + withMentions(bul[1]) + '</li>';
      } else {
        closeList();
        out += line.trim() ? '<p>' + withMentions(line) + '</p>' : '<p class="rgap"></p>';
      }
    });
    closeList();
    return out;
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
  /* รายการในปฏิทินการตลาด (คอนเทนต์/แคมเปญ/โปรโมชั่น) — โพสต์และงานผูกกับตัวนี้ */
  var CAMP_KIND = { content: 'คอนเทนต์', campaign: 'แคมเปญ', promo: 'โปรโมชั่น' };
  var CAMP_COLOR = { content: '#0E9BA8', campaign: '#7A5CF0', promo: '#F2565A' };
  var CAL_URL = '../cmo/campaign-calendar.html';
  function loadCampaigns() {
    if (S.campaigns) return Promise.resolve(S.campaigns);
    return api('/campaigns').then(function (j) { S.campaigns = j.campaigns || []; return S.campaigns; })
      .catch(function () { S.campaigns = []; return S.campaigns; });
  }
  function campaignById(id) {
    return (S.campaigns || []).filter(function (c) { return c.id === id; })[0] || null;
  }
  /* plain = ใช้ในแถวงานที่ตัวแถวเป็น <a> อยู่แล้ว — <a> ซ้อน <a> ไม่ได้ เบราว์เซอร์จะดันชิปหลุดออกจากแถว
     เลยวาดเป็น span แล้วให้ click handler กลางพาไปปฏิทินแทน */
  function campaignChip(id, big, plain) {
    var c = campaignById(id);
    if (!c) return '';
    var col = CAMP_COLOR[c.kind] || '#8B8A84';
    var title = esc((CAMP_KIND[c.kind] || '') + ' · เปิดในปฏิทินการตลาด');
    if (plain) {
      return '<span class="cchip" data-cc="' + esc(c.id) + '" title="' + title + '" style="--cc:' + col + '">' +
        '<i></i>' + esc(c.name) + '</span>';
    }
    return '<a class="cchip' + (big ? ' big' : '') + '" href="' + CAL_URL + '#c=' + esc(c.id) + '" title="' + title +
      '" style="--cc:' + col + '"><i></i>' + esc(c.name) + '</a>';
  }
  function campaignLabel(c) {
    var a = new Date(c.start + 'T00:00:00'), b = new Date((c.end || c.start) + 'T00:00:00');
    var when = a.getTime() === b.getTime() ? fmtDate(a) : fmtDate(a) + ' – ' + fmtDate(b);
    return (CAMP_KIND[c.kind] || '') + ' · ' + c.name + ' (' + when + ')';
  }
  /* ช่องเลือกรายการในปฏิทิน ใช้ทั้งฟอร์มโพสต์ ฟอร์มงาน และการ์ดร่าง */
  function campaignSelect(attrs, selected) {
    var list = (S.campaigns || []).slice();
    return '<select class="select" ' + attrs + '><option value="">— ไม่ผูกกับปฏิทิน —</option>' +
      list.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (selected === c.id ? ' selected' : '') + '>' + esc(campaignLabel(c)) + '</option>';
      }).join('') + '</select>';
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

  /* ============================================================
     ตัวช่วยพิมพ์ในช่องข้อความ: แท็บคน (@) และรายการอัตโนมัติ (1. / -)
     ============================================================ */

  /* หาพิกัดของเคอร์เซอร์ในช่องข้อความ ด้วยการทำ div เงาที่หน้าตาเหมือนกันเป๊ะ
     แล้ววัดตำแหน่งตัวอักษรตัวสุดท้าย — textarea ไม่มี API บอกพิกัดเคอร์เซอร์ */
  function caretXY(ta) {
    var cs = getComputedStyle(ta);
    var div = document.createElement('div');
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
     'textTransform', 'wordSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
     'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].forEach(function (k) {
      div.style[k] = cs[k];
    });
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.overflowWrap = 'break-word';
    div.style.width = ta.clientWidth + 'px';
    div.style.boxSizing = 'border-box';
    div.style.top = '0';
    div.style.left = '-9999px';
    div.textContent = ta.value.slice(0, ta.selectionStart);
    var mark = document.createElement('span');
    mark.textContent = '​';
    div.appendChild(mark);
    document.body.appendChild(div);
    var r = ta.getBoundingClientRect();
    var out = {
      x: r.left + mark.offsetLeft - ta.scrollLeft,
      y: r.top + mark.offsetTop - ta.scrollTop,
      h: parseFloat(cs.lineHeight) || 20,
    };
    div.remove();
    return out;
  }

  /* กล่องเลือกชื่อตอนพิมพ์ @ — เลื่อนด้วยลูกศร เลือกด้วย Enter/Tab หรือคลิก */
  function attachMentions(ta) {
    if (!ta || ta._mentionOn) return;
    ta._mentionOn = true;
    var box = null, items = [], sel = 0, start = -1;

    function close() {
      if (box) { box.remove(); box = null; }
      items = []; start = -1;
    }
    function pick(i) {
      var st = items[i];
      if (!st) return;
      var tag = '@' + shortName(st) + ' ';
      var before = ta.value.slice(0, start);
      var after = ta.value.slice(ta.selectionStart);
      ta.value = before + tag + after;
      var pos = before.length + tag.length;
      ta.setSelectionRange(pos, pos);
      close();
      ta.focus();
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function draw() {
      if (!box) {
        box = document.createElement('div');
        box.className = 'mbox';
        document.body.appendChild(box);
        box.addEventListener('mousedown', function (ev) {
          var b = ev.target.closest('[data-mi]');
          if (b) { ev.preventDefault(); pick(Number(b.getAttribute('data-mi'))); }
        });
        box.addEventListener('mousemove', function (ev) {
          var b = ev.target.closest('[data-mi]');
          if (b) { sel = Number(b.getAttribute('data-mi')); paint(); }
        });
      }
      box.innerHTML = items.map(function (st, i) {
        return '<button type="button" class="mrow' + (i === sel ? ' on' : '') + '" data-mi="' + i + '">' +
          avatar(st) + '<span class="mn"><b>' + esc(shortName(st)) + '</b><small>' + esc(st.name) + '</small></span>' +
          '<span class="mtick">✓</span></button>';
      }).join('') + '<div class="mhint">↑↓ เลือก · Enter ใส่ชื่อ · Esc ปิด</div>';
      var c = caretXY(ta);
      var top = c.y + c.h + 4;
      box.style.left = Math.min(c.x, window.innerWidth - 250) + 'px';
      box.style.top = top + 'px';
      /* ถ้าล้นขอบล่าง ให้พลิกขึ้นไปอยู่เหนือเคอร์เซอร์ */
      var bh = box.offsetHeight;
      if (top + bh > window.innerHeight - 8) box.style.top = Math.max(8, c.y - bh - 4) + 'px';
      paint();
    }
    function paint() {
      $$('[data-mi]', box).forEach(function (b, i) { b.classList.toggle('on', i === sel); });
      var on = box.querySelector('.mrow.on');
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
    }
    function scan() {
      var pos = ta.selectionStart;
      var text = ta.value.slice(0, pos);
      var m = text.match(/@([^\s@]*)$/);
      if (!m) { close(); return; }
      start = pos - m[0].length;
      var q = m[1].toLowerCase();
      items = S.staff.filter(function (st) {
        if (!st.active) return false;
        if (!q) return true;
        var keys = [st.name].concat(String(st.aliases || '').split(','));
        return keys.some(function (k) { return String(k).trim().toLowerCase().indexOf(q) === 0; });
      }).slice(0, 8);
      if (!items.length) { close(); return; }
      sel = 0;
      draw();
    }

    ta.addEventListener('input', scan);
    ta.addEventListener('click', scan);
    ta.addEventListener('blur', function () { setTimeout(close, 120); });
    ta.addEventListener('keydown', function (ev) {
      if (!box) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = (sel + 1) % items.length; paint(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = (sel - 1 + items.length) % items.length; paint(); }
      else if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); pick(sel); }
      else if (ev.key === 'Escape') { ev.preventDefault(); close(); }
    });
  }

  /* พิมพ์รายการแบบ Lark: ขึ้นบรรทัดใหม่ต่อเลข/ขีดให้เอง แล้วไล่เลขใหม่เมื่อแทรกกลาง */
  function renumber(ta) {
    var lines = ta.value.split('\n');
    var pos = ta.selectionStart;
    var n = 0;
    var out = lines.map(function (line) {
      var m = line.match(/^(\s*)(\d+)\.\s(.*)$/);
      if (m) { n++; return m[1] + n + '. ' + m[3]; }
      if (!line.trim()) { n = 0; }        /* บรรทัดว่างคั่น = เริ่มนับใหม่ */
      else if (!/^\s*[-•]\s/.test(line)) { n = 0; }
      return line;
    });
    var next = out.join('\n');
    if (next !== ta.value) {
      var delta = next.length - ta.value.length;
      ta.value = next;
      ta.setSelectionRange(pos + delta, pos + delta);
    }
  }
  function attachListEditing(ta) {
    if (!ta || ta._listOn) return;
    ta._listOn = true;
    ta.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing) return;
      if (ta._mentionOn && document.querySelector('.mbox')) return;   /* กล่องแท็บคนกำลังเปิด ปล่อยให้มันจัดการ */
      var pos = ta.selectionStart;
      if (pos !== ta.selectionEnd) return;
      var before = ta.value.slice(0, pos);
      var line = before.slice(before.lastIndexOf('\n') + 1);
      var num = line.match(/^(\s*)(\d+)\.\s(.*)$/);
      var bul = line.match(/^(\s*)([-•])\s(.*)$/);
      if (!num && !bul) return;

      /* กด Enter บนหัวข้อว่าง = เลิกทำรายการ */
      if ((num && !num[3].trim()) || (bul && !bul[3].trim())) {
        ev.preventDefault();
        var cut = pos - line.length;
        ta.value = ta.value.slice(0, cut) + ta.value.slice(pos);
        ta.setSelectionRange(cut, cut);
        return;
      }
      ev.preventDefault();
      var lead = num ? (num[1] + (Number(num[2]) + 1) + '. ') : (bul[1] + bul[2] + ' ');
      var ins = '\n' + lead;
      ta.value = ta.value.slice(0, pos) + ins + ta.value.slice(pos);
      var np = pos + ins.length;
      ta.setSelectionRange(np, np);
      if (num) renumber(ta);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  /* เรียกครั้งเดียวหลังวาดหน้า — ผูกให้ทุกช่องที่ควรมี */
  function wireTyping(root) {
    $$('[data-rich]', root || document).forEach(function (ta) {
      attachMentions(ta);
      attachListEditing(ta);
    });
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
  /* สิทธิ์ที่ใช้จริงตอนนี้ — หัวหน้ากด "ดูในมุมของ…" ได้ เพื่อเช็คว่าน้องเห็นอะไรบ้าง
     เป็นแค่การพรีวิวฝั่งหน้าเว็บ ตัวจริงยังกันที่เซิร์ฟเวอร์เหมือนเดิม */
  function effRights() {
    if (!S.me) return { sections: [], owner: false, as: null };
    if (S.viewAs) {
      var v = staffById(S.viewAs);
      if (v) return { sections: v.sections || [], owner: v.role === 'owner', as: v };
    }
    return { sections: S.me.sections || [], owner: S.me.role === 'owner', as: null };
  }
  function canSee(sec) {
    var e = effRights();
    if (!sec) return true;
    if (sec === 'admin') return e.owner;
    return (e.sections || []).indexOf(sec) !== -1;
  }
  function denyView(what) {
    var view = $('#view');
    view.className = 'page';
    view.innerHTML = '<div class="top"><div><span class="kicker">ไม่มีสิทธิ์</span><h1>' + esc(what) + '</h1>' +
      '<p>บัญชีของคุณยังไม่ได้เปิดสิทธิ์หมวดนี้ ถ้าต้องใช้ให้บอกหัวหน้าทีมเปิดให้ในหน้า “ทีม + สิทธิ์”</p></div>' +
      '<div class="top-r"><a class="btn" href="#/me">ไปงานของฉัน</a></div></div>';
    renderSidebar();
  }
  var SECTION_LIST = [
    ['tasks', 'งานทีม + ตารางโพสต์ + ปฏิทินการตลาด'],
    ['docs',  'เอกสารแผนงาน · B2B · รายงานการรับสาย'],
    ['sales', 'ยอดขาย + การตลาด (ตัวเลขยอดขายทั้งหมด)'],
    ['kpi',   'KPI 2570 + KPI Dashboard']
  ];
  var SECTION_SHORT = { tasks: 'งานทีม', docs: 'เอกสาร', sales: 'ยอดขาย', kpi: 'KPI' };
  function renderSidebar() {
    var host = $('#sideHost');
    if (!host || !global.ERP_MENU) return;
    var eff = effRights();
    var h = global.ERP_MENU.render({ ctx: 'tasks', active: 'tasks:' + (ROUTE_KEY[S.route.name] || '#/me'),
      salesBase: '../mkt/index.html', cmoBase: '../cmo/', tasksBase: '',
      sections: eff.sections, owner: eff.owner,
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
      (S.viewAs && staffById(S.viewAs)
        ? '<span class="asview">ดูในมุมของ <b>' + esc(shortName(staffById(S.viewAs))) + '</b>' +
          '<button type="button" data-viewas-off>เลิกดู</button></span>' : '') +
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

  /* ?next=/cmo/kpi — worker เด้งมาพร้อมปลายทาง รับเฉพาะ path ในบ้านเรา กัน open redirect */
  function nextParam() {
    var m = location.search.match(/[?&]next=([^&]*)/);
    if (!m) return '';
    var v = decodeURIComponent(m[1]);
    return /^\/[A-Za-z0-9_\-./?=&#]*$/.test(v) && v.indexOf('//') !== 0 ? v : '';
  }
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
          /* ถูกเด้งมาจากหน้าอื่นเพราะยังไม่ได้ล็อกอิน — พากลับไปหน้านั้น */
          var next = nextParam();
          if (next) { location.href = next; return; }
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
      '<span class="m">' + avatars(t.assignees) + kpiChip(t.kpiId) + campaignChip(t.campaignId, false, true) + cycle +
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
    Promise.all([loadTasks(), loadCampaigns()]).then(function (r) {
      var all = r[0];
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
  var F = { who: '', kpi: '', status: 'open', group: 'due', range: 'all', campaign: '' };
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
    if (q.status !== undefined) { F.status = q.status; }
    if (q.campaign !== undefined) { F.campaign = q.campaign; }
    Promise.all([loadTasks(), loadCampaigns()]).then(function (r) {
      var all = r[0];
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
        if (F.campaign && t.campaignId !== F.campaign) return false;
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
      var nActive = (F.who ? 1 : 0) + (F.kpi ? 1 : 0) + (F.status !== 'open' ? 1 : 0) + (F.campaign ? 1 : 0);
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
      if (F.campaign) { var cc0 = campaignById(F.campaign); act.push(['campaign', '', 'ปฏิทิน: ' + (cc0 ? cc0.name : F.campaign)]); }
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
      '<div class="field"><label class="label">รายละเอียด / เงื่อนไข</label><textarea class="textarea" data-rich data-k="detail" placeholder="ข้อความประกอบ เงื่อนไข ขนาด งบ ฯลฯ">' + esc(t.detail) + '</textarea></div>' +
      '<div class="field"><label class="label">เชื่อมกับปฏิทินการตลาด</label>' + campaignSelect('data-k="campaignId"', t.campaignId || null) + '</div>' +
      '</div></div>';
    return h;
  }
  function renderNew() {
    if (!S.campaigns) { loadCampaigns().then(renderNew); return; }
    var view = $('#view');
    view.className = 'page';
    var sample = 'ระบบจอ signmate > kan บขส + fashion : Deadline - พุธ 17.00 น. @Julalak\nออกแบบ บูธขายเสื้อหนาว ที่ Central - อังคาร 16.00 @Title\nขนาดพื้นที่ 8*7 เมตร เลือกได้ 7 / 14 วัน\n\nupdate ontour จังหวัดอื่น @Nont @Title @Julalak ทุกวัน 17.30';
    var pc = campaignById((S.route.query || {}).campaign || '');
    var h = '<div class="top"><div><span class="kicker">สั่งงาน' + (pc ? ' · สำหรับ ' + esc(pc.name) : '') + '</span><h1>วางข้อความสั่งงาน แล้วให้ระบบแยกเป็นงาน</h1>' +
      (pc ? '<p>ทุกงานที่บันทึกจากหน้านี้จะผูกกับ ' + campaignChip(pc.id) + ' ในปฏิทินการตลาดให้เอง</p>' : '') +
      '<p>พิมพ์หรือวางแบบที่สั่งในแชตได้เลย — ระบบจะอ่าน <b>@ชื่อ</b> เป็นคนรับงาน อ่าน <b>วัน + เวลา</b> เป็นกำหนดส่ง และเดา KPI ให้ ตรวจแก้ในการ์ดก่อนกดบันทึก</p></div></div>';
    h += '<div class="compose"><div>' +
      '<div class="sec"><div class="sec-b"><label class="label">ข้อความสั่งงาน</label>' +
      '<textarea class="textarea big" id="cmdText" data-rich placeholder="' + esc(sample) + '"></textarea>' +
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
    wireTyping(view);
  }
  function renderDrafts() {
    var host = $('#draftHost');
    if (!host) return;
    if (!drafts.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="group-h"><h3>ตรวจก่อนบันทึก</h3><span>' + drafts.length + ' งาน</span></div>' +
      drafts.map(draftCard).join('') +
      '<div class="sticky-bar"><span>' + drafts.length + ' งาน · ' + drafts.filter(function (d) { return !d.assignees.length; }).length + ' งานยังไม่มีคนรับ</span>' +
      '<div class="acts"><button type="button" class="btn-ghost" id="clearBtn">ล้าง</button><button type="button" class="btn" id="saveBtn">บันทึกทั้งหมด</button></div></div>';
    wireTyping(host);
  }
  function syncDraftsFromDom() {
    $$('.draft').forEach(function (card) {
      var i = Number(card.getAttribute('data-i')), d = drafts[i];
      if (!d) return;
      $$('[data-k]', card).forEach(function (el) {
        var k = el.getAttribute('data-k');
        if (k === 'dueAt') d.dueAt = fromLocalInput(el.value);
        else if (k === 'kpiId') d.kpiId = el.value || null;
        else if (k === 'campaignId') d.campaignId = el.value || null;
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
      return { title: d.title, detail: d.detail, assignees: d.assignees, dueAt: d.dueAt, repeat: d.repeat, kpiId: d.kpiId, priority: d.priority ? 1 : 0, campaignId: d.campaignId || null };
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
    Promise.all([api('/tasks/' + id), loadCampaigns()]).then(function (r) {
      var j = r[0];
      var t = j.task, ups = j.updates, files = j.files, subs = j.subtasks || [], parent = j.parent;
      /* เก็บข้อความดิบไว้ให้ตอนกดแก้ (ที่แสดงผลผ่าน richText แล้วเอากลับมาแก้ไม่ได้) */
      S.taskUpdRaw = {};
      ups.forEach(function (u) { S.taskUpdRaw[u.id] = u.note || ''; });
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
        (t.campaignId && campaignById(t.campaignId) ? campaignChip(t.campaignId) + '<span>›</span>' : '') +
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
        '<div class="sec-b"><div class="task-detail" id="detailText">' + richText(t.detail) + '</div>' +
        (canEdit ? '<form id="editForm" hidden style="display:grid;gap:12px;margin-top:12px">' +
          '<div class="field"><label class="label">ชื่องาน</label><input class="input" name="title" value="' + esc(t.title) + '"></div>' +
          '<div class="field"><label class="label">รายละเอียด</label><textarea class="textarea" name="detail" data-rich>' + esc(t.detail) + '</textarea></div>' +
          '<div class="field"><label class="label">มอบหมายให้</label><div class="chips" id="editAs">' + S.staff.filter(function (s) { return s.active; }).map(function (s) {
            return '<button type="button" class="chip' + (t.assignees.indexOf(s.id) !== -1 ? ' on' : '') + '" data-as="' + esc(s.id) + '">' + avatar(s) + esc(shortName(s)) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="grid3"><div class="field"><label class="label">กำหนดส่ง</label><input class="input" type="datetime-local" name="dueAt" value="' + esc(toLocalInput(t.dueAt)) + '"></div>' +
          '<div class="field"><label class="label">ความถี่</label><select class="select" name="repeat">' + [['', 'ครั้งเดียว'], ['daily', 'ทุกวัน'], ['weekly', 'ทุกสัปดาห์']].map(function (p) { return '<option value="' + p[0] + '"' + (t.repeat === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label class="label">KPI</label><select class="select" name="kpiId"><option value="">— ไม่ระบุ —</option>' + S.kpis.map(function (k) { return '<option value="' + esc(k.id) + '"' + (t.kpiId === k.id ? ' selected' : '') + '>' + esc(k.code + ' · ' + k.title) + '</option>'; }).join('') + '</select></div></div>' +
          '<div class="field"><label class="label">เชื่อมกับปฏิทินการตลาด <small>คอนเทนต์ / แคมเปญ / โปรโมชั่นที่งานนี้ทำให้</small></label>' + campaignSelect('name="campaignId"', t.campaignId) + '</div>' +
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
          /* ลบได้: หัวหน้าลบได้ทุกอัน · สมาชิกลบเฉพาะของตัวเอง · ยกเว้นรายการ "สร้างงาน" */
          var canDelUp = u.kind !== 'create' && (S.me.role === 'owner' || u.staffId === S.me.id);
          /* แก้ข้อความได้เฉพาะหัวหน้า (นนท์สั่ง) · คนอื่นถ้าพิมพ์ผิดให้ลบแล้วเขียนใหม่ */
          var canEditUp = u.kind !== 'create' && S.me.role === 'owner' && u.note;
          return '<div class="tl-i" data-upd="' + esc(u.id) + '">' + avatar(s, 'lg') + '<div><div class="h"><b>' + esc(s ? shortName(s) : '?') + '</b><span>' + what + '</span><time>' + esc(fmtAgo(u.createdAt)) +
            (u.editedAt ? ' · แก้ไขแล้ว' : '') + '</time>' +
            (canEditUp ? '<button type="button" class="tl-edit" data-edit-upd="' + esc(u.id) + '" title="แก้ข้อความ">แก้</button>' : '') +
            (canDelUp ? '<button type="button" class="tl-del" data-del-upd="' + esc(u.id) + '" title="ลบรายการนี้" aria-label="ลบความคืบหน้า">✕</button>' : '') + '</div>' +
            (u.note ? '<div class="n rich" data-note>' + richText(u.note) + '</div>' : '') + (fl.length ? thumbsHtml(fl) : '') + '</div></div>';
        }).join('') : '<div class="empty">ยังไม่มีความคืบหน้า</div>') + '</div></div></div>';
      h += '</div><div>';

      h += '<div class="sec"><div class="sec-h"><h2>อัปเดตงาน</h2></div><div class="sec-b"><form id="updForm" class="upl">' +
        (canStatus ? '<div><label class="label">สถานะ</label><div class="chips" id="stChips">' +
          ['todo', 'doing', 'blocked', 'done'].map(function (s) { return '<button type="button" class="chip plain' + (es === s ? ' on' : '') + '" data-st="' + s + '">' + STATUS_TH[s] + '</button>'; }).join('') + '</div></div>' : '') +
        '<div class="field"><label class="label">บันทึก / รายงานผล <small>พิมพ์ @ชื่อ เพื่อแท็กให้เขาเห็นในกระดิ่ง</small></label>' +
        '<textarea class="textarea" name="note" data-rich placeholder="ทำอะไรไปแล้ว ติดอะไร ส่งอะไรให้ใคร"></textarea>' +
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
      wireTyping(view);
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
      editBtn.addEventListener('click', function () {
        $('#editForm').hidden = false; $('#detailText').hidden = true; editBtn.hidden = true;
        wireTyping($('#editForm'));
      });
      $('#cancelEdit').addEventListener('click', function () { $('#editForm').hidden = true; $('#detailText').hidden = false; editBtn.hidden = false; });
      $('#editAs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-as]'); if (b) b.classList.toggle('on'); });
      $('#editForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var f = this;
        api('/tasks/' + t.id, 'PUT', {
          title: f.title.value, detail: f.detail.value, dueAt: fromLocalInput(f.dueAt.value), repeat: f.repeat.value,
          kpiId: f.kpiId.value || null, priority: f.priority.checked ? 1 : 0,
          campaignId: f.campaignId.value || null,
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
  var P = { page: '', range: 'month', status: '', view: 'cal', month: null, day: '', campaign: '' };
  /* จำมุมมองล่าสุดไว้ (ปฏิทิน/รายการ) — ส่วนตารางแบบ Excel อยู่ในหน้าต่าง "เพิ่มโพสต์" */
  try { var _pv = localStorage.getItem('kan-posts-view'); if (['cal', 'list'].indexOf(_pv) !== -1) P.view = _pv; } catch (e) {}
  var POST_KIND = { content: 'คอนเทนต์', promo: 'โปรโมชัน', video: 'วิดีโอ', live: 'ไลฟ์' };

  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function curMonth() { return P.month ? new Date(P.month + '-01T00:00:00') : new Date(); }
  function postRangeDates() {
    /* โหมดปฏิทินยึดเดือนที่เปิดอยู่ ไม่ใช่ปุ่มช่วงเวลา */
    if (P.view === 'cal') {
      var m = curMonth();
      return [ymd(new Date(m.getFullYear(), m.getMonth(), 1)), ymd(new Date(m.getFullYear(), m.getMonth() + 1, 0))];
    }
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
    if (q.view) P.view = q.view;
    if (q.campaign !== undefined) P.campaign = q.campaign;
    var d = postRangeDates();
    /* ดึงทั้งช่วงโดยไม่กรองเพจที่เซิร์ฟเวอร์ เพื่อให้นับแยกรายเพจได้ในคราวเดียว */
    var qs = '?' + (d[0] ? 'from=' + d[0] + '&to=' + d[1] : '');
    Promise.all([loadPages(), api('/posts' + qs), loadCampaigns()]).then(function (r) {
      var activePages = {};
      (S.pages || []).forEach(function (pg) { activePages[pg.id] = 1; });
      var all = (r[1].posts || []).filter(function (x) { return activePages[x.pageId]; });
      if (P.campaign) all = all.filter(function (x) { return x.campaignId === P.campaign; });
      var posts = P.page ? all.filter(function (x) { return x.pageId === P.page; }) : all;
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
      var m = curMonth();
      var monthLabel = MON_TH[m.getMonth()] + ' ' + String(m.getFullYear() + 543).slice(-2);
      var label = P.view === 'cal' ? monthLabel : { today: 'วันนี้', week: 'สัปดาห์นี้', month: 'เดือนนี้', all: 'ทั้งหมด' }[P.range];
      var h = '<div class="top"><div><span class="kicker">ตารางโพสต์' + (P.page ? ' · ' + esc(pageName(P.page)) : '') + '</span>' +
        '<h1>คอนเทนต์ ' + esc(label) + '</h1>' +
        '<p>เขียวคือโพสต์แล้ว แดงคือเลยวันแล้วยังไม่โพสต์ เหลืองคือโพสต์แล้วแต่ยังไม่มีลิงก์ — กดวันในปฏิทินเพื่อดูและอัปเดตโพสต์ของวันนั้น</p></div>' +
        '<div class="top-r"><button type="button" class="btn-ghost" id="pastePosts">วางจาก Excel</button>' +
        '<button type="button" class="btn" id="newPost">+ เพิ่มโพสต์</button></div></div>';

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
      h += '<div class="tbar">' + seg('view', [['cal', 'ปฏิทิน'], ['list', 'รายการ']], P) +
        (P.view === 'cal'
          ? '<div class="mnav"><button type="button" data-mon="-1" aria-label="เดือนก่อน">‹</button>' +
            '<b>' + esc(monthLabel) + '</b>' +
            '<button type="button" data-mon="1" aria-label="เดือนถัดไป">›</button>' +
            '<button type="button" class="btn-text" data-mon="0">เดือนนี้</button></div>'
          : seg('range', [['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้'], ['all', 'ทั้งหมด']], P)) +
        (P.status ? '<button type="button" class="fchip" data-p="status" data-v="">' +
          ({ left: 'ยังไม่ได้โพสต์', nolink: 'ไม่มีลิงก์', done: 'โพสต์แล้ว' }[P.status] || '') + ' <span>✕</span></button>' : '') +
        (P.campaign ? '<button type="button" class="fchip" data-p="campaign" data-v="">ปฏิทิน: ' +
          esc((campaignById(P.campaign) || { name: P.campaign }).name) + ' <span>✕</span></button>' : '') +
        '<span class="tbar-n">' + shown.length + ' โพสต์</span></div>';

      /* แท็บเพจรายสาขา — ตัวเลขบนแท็บคือ "ยังไม่ได้โพสต์" ของเพจนั้นในช่วงที่เลือก */
      var statOf = function (list) {
        var dn = list.filter(function (x) { return x.status === 'done'; });
        return { n: list.length, done: dn.length, left: list.filter(function (x) { return x.status === 'plan'; }).length,
                 nolink: dn.filter(function (x) { return !x.url; }).length };
      };
      h += '<div class="ptabs"><button type="button" class="ptab' + (!P.page ? ' on' : '') + '" data-p="page" data-v="">' +
        'ทุกเพจ<i>' + all.length + '</i></button>' +
        (S.pages || []).map(function (pg) {
          var st = statOf(all.filter(function (x) { return x.pageId === pg.id; }));
          return '<button type="button" class="ptab' + (P.page === pg.id ? ' on' : '') + (st.left ? ' has' : '') +
            '" data-p="page" data-v="' + esc(pg.id) + '">' + esc(pg.name) +
            '<i' + (st.left ? ' class="warn"' : '') + '>' + (st.left || st.n) + '</i></button>';
        }).join('') + '</div>';

      /* เกจ: ของเพจที่เลือก หรือแยกทุกสาขาเมื่อดูรวม */
      if (all.length) {
        h += '<div class="gauges">' +
          (P.page
            ? gaugeHtml(posts, pageName(P.page))
            : (S.pages || []).map(function (pg) {
                var l = all.filter(function (x) { return x.pageId === pg.id; });
                return l.length ? gaugeHtml(l, pg.name) : '';
              }).join('')) + '</div>';
      }

      if (P.view === 'cal') {
        h += calendarHtml(posts);
        if (P.day) {
          var dayItems = shown.filter(function (x) { return x.date === P.day; });
          var dd = new Date(P.day + 'T00:00:00');
          h += '<div class="group"><div class="group-h' + (sameDay(dd, new Date()) ? ' late' : '') + '"><h3>' +
            esc(DAY_TH[dd.getDay()] + ' ' + fmtDate(dd, true)) + '</h3><span>' + dayItems.length + '</span>' +
            '<button type="button" class="btn-text" style="margin-left:auto" data-day="">ดูทั้งเดือน</button></div>' +
            (dayItems.length
              ? '<div class="tlist">' + dayItems.map(postRow).join('') + '</div>'
              : '<div class="sec"><div class="empty">วันนี้ไม่มีโพสต์ในแผน</div></div>') + '</div>';
        }
      }

      /* ดูรวมทุกเพจ = ต้องรู้ว่าสาขาไหนตามหลัง ตารางสรุปตอบตรงนั้น */
      if (P.view === 'list' && !P.page && all.length) {
        h += '<div class="sec"><div class="sec-h"><h2>แยกตามเพจ</h2><p>กดชื่อเพจเพื่อดูเฉพาะเพจนั้น</p></div>' +
          '<div class="sec-b tight" style="overflow-x:auto"><table class="table"><thead><tr><th>เพจ</th>' +
          '<th class="num">ทั้งหมด</th><th class="num">โพสต์แล้ว</th><th class="num">ยังไม่ได้โพสต์</th><th class="num">ไม่มีลิงก์</th></tr></thead><tbody>' +
          (S.pages || []).map(function (pg) {
            var st = statOf(all.filter(function (x) { return x.pageId === pg.id; }));
            if (!st.n) return '';
            return '<tr class="prow" data-p="page" data-v="' + esc(pg.id) + '"><td><b>' + esc(pg.name) + '</b></td>' +
              '<td class="num">' + st.n + '</td><td class="num">' + st.done + '</td>' +
              '<td class="num"' + (st.left ? ' style="color:var(--k-warn);font-weight:600"' : '') + '>' + st.left + '</td>' +
              '<td class="num"' + (st.nolink ? ' style="color:var(--k-bad);font-weight:600"' : '') + '>' + st.nolink + '</td></tr>';
          }).join('') +
          '<tr class="total"><td>รวม</td><td class="num">' + all.length + '</td>' +
          '<td class="num">' + statOf(all).done + '</td><td class="num">' + statOf(all).left + '</td>' +
          '<td class="num">' + statOf(all).nolink + '</td></tr></tbody></table></div></div>';
      }

      if (P.view === 'cal') {
        /* โหมดปฏิทินจบที่ปฏิทิน + รายการของวันที่กด */
      } else if (!shown.length) {
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
      /* ประวัติการแก้ + ปุ่มล้างโพสต์เปล่า อยู่ใต้ปฏิทินเลย
         (นนท์: ต้องเห็นและลบของที่ค้างได้จากหน้าหลัก ไม่ต้องเปิดหน้าต่างเพิ่มโพสต์ก่อน) */
      h += '<div class="sheet-log page-log" id="postLog"><div class="lg-empty">กำลังอ่านประวัติ…</div></div>';

      view.innerHTML = h;

      $('#newPost').addEventListener('click', function () { openPostSheet(); });
      $('#pastePosts').addEventListener('click', function () { openPasteImport(); });

      renderSheetLog($('#postLog'), {
        editLabel: 'แก้โพสต์',
        onEdit: function (pid) { openPostFormById(pid); },
        afterDelete: function () { renderPosts(); return true; },
      });

      var sb = $('#seedPosts');
      if (sb) sb.addEventListener('click', function () { seedPosts(sb); });
    }).catch(function (e) { showError(e); });
  }

  /* ---------- ตารางโพสต์แบบสเปรดชีต (ตัวตารางอยู่ใน grid.js) ------------------
     นนท์: ทีมถนัด Excel ให้พิมพ์ในนี้แทนไปเลย
     หน้าที่ของไฟล์นี้คือ "นิยามคอลัมน์" กับ "บันทึกอัตโนมัติ" ส่วนพฤติกรรมแบบ Excel
     (เลือกช่อง ช่วง ก็อป/วาง fill handle undo คลิกขวา กรอง) อยู่ใน grid.js */
  var POST_STATUS_TH = { plan: 'ยังไม่โพสต์', done: 'โพสต์แล้ว', skip: 'ไม่โพสต์' };
  var CHAN_ALL = ['Facebook', 'Line OA', 'TikTok', 'Instagram'];
  var G = { grid: null, timers: {}, pending: {}, seq: 0, lastOk: '' };

  function thaiShort(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso || '';
    return d.getDate() + ' ' + MON_TH[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2);
  }
  function addDaysIso(iso, n) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return ymd(d);
  }
  function shortUrl(u) {
    return String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 34);
  }
  function postColumns() {
    return [
      { key: 'date', label: 'วันที่', width: 106, type: 'date',
        text: function (r) { return r.date ? thaiShort(r.date) : ''; },
        edit: function (r) { return r.date ? thaiShort(r.date) : ''; },
        iso: function (r) { return r.date || ''; },
        fromIso: function (iso) { return thaiShort(iso); },
        parse: function (s) {
          s = String(s).trim();
          if (!s) return '';
          var b = curMonth();
          return parsePostDate(s, b.getFullYear(), b.getMonth() + 1) || null;
        },
        copy: function (r) { return r.date || ''; },
        fill: function (src, step) { return src.date ? addDaysIso(src.date, step) : ''; },
        sortKey: function (r) { return r.date || '9999-99-99'; } },

      { key: 'time', label: 'เวลา', width: 78,
        parse: function (s) { s = String(s).trim(); return s ? (parsePasteTime(s) || null) : ''; },
        sortKey: function (r) { return r.time || '99'; } },

      { key: 'pageId', label: 'เพจ', width: 132, type: 'pick',
        options: function () { return (S.pages || []).map(function (p) { return { v: p.id, label: p.name }; }); },
        text: function (r) { return r.pageId ? pageName(r.pageId) : ''; },
        parse: function (s) { s = String(s).trim(); return s ? (pageIdByText(s) || null) : ''; } },

      { key: 'kind', label: 'ชนิด', width: 92, type: 'pick',
        options: function () {
          return Object.keys(POST_KIND).map(function (k) { return { v: k, label: POST_KIND[k] }; });
        },
        text: function (r) { return POST_KIND[r.kind] || ''; },
        parse: function (s) {
          s = String(s).trim();
          if (!s) return 'content';
          var hit = null;
          Object.keys(POST_KIND).forEach(function (k) { if (k === s || POST_KIND[k] === s) hit = k; });
          return hit || parsePasteKind(s, '');
        } },

      { key: 'channels', label: 'ช่องทาง', width: 152, type: 'multi',
        options: function () { return CHAN_ALL.map(function (c) { return { v: c, label: c }; }); },
        get: function (r) { return r.channels || []; },
        text: function (r) { return (r.channels || []).join(', '); },
        parse: function (s) { return parsePasteChannels(s); },
        filterValues: function (r) { return (r.channels || []).length ? r.channels : ['(ว่าง)']; } },

      { key: 'topic', label: 'หัวข้อ / เนื้อหา', width: 330,
        parse: function (s) { return String(s).trim(); } },

      { key: 'status', label: 'สถานะ', width: 108, type: 'pick',
        options: function () {
          return Object.keys(POST_STATUS_TH).map(function (k) { return { v: k, label: POST_STATUS_TH[k] }; });
        },
        text: function (r) { return POST_STATUS_TH[r.status] || POST_STATUS_TH.plan; },
        parse: function (s) {
          s = String(s).trim();
          if (!s) return 'plan';
          var hit = null;
          Object.keys(POST_STATUS_TH).forEach(function (k) { if (k === s || POST_STATUS_TH[k] === s) hit = k; });
          return hit || parsePasteStatus(s, '');
        } },

      /* ใส่ลิงก์ = นับว่าโพสต์แล้ว (เซิร์ฟเวอร์ก็คิดแบบนี้) — affects บอก grid ให้เก็บสถานะไว้ใน undo ด้วย */
      { key: 'url', label: 'ลิงก์โพสต์', width: 186, affects: ['status'],
        html: function (r) {
          return r.url
            ? '<a class="xl-link" href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(r.url) + ' — Cmd/Ctrl+คลิกเพื่อเปิด">' + esc(shortUrl(r.url)) + '</a>'
            : '<span class="xl-v"></span>';
        },
        text: function (r) { return r.url || ''; },
        parse: function (s) {
          s = String(s).trim();
          if (!s) return '';
          var m = s.match(/https?:\/\/\S+/);
          return m ? m[0] : null;
        },
        after: function (r, v) { if (v) r.status = 'done'; } },

      { key: 'note', label: 'หมายเหตุ', width: 150,
        parse: function (s) { return String(s).trim(); } },
    ];
  }

  /* ---------- บันทึกอัตโนมัติรายแถว ---------- */
  function postRowBlank(r) {
    return !r.id && !r.topic && !r.time && !r.url && !r.note;
  }
  function gridKey(row) {
    if (row.id) return row.id;
    if (!row._k) row._k = 'n' + (++G.seq);
    return row._k;
  }
  function gridSnap(row) {
    return JSON.stringify([row.date || '', row.time || '', row.pageId || '', row.kind || 'content',
      (row.channels || []).join('|'), row.topic || '', row.url ? 'done' : (row.status || 'plan'),
      row.url || '', row.note || '']);
  }
  function gridMark(row, st, msg) {
    row._st = st; row._msg = msg || '';
    if (G.grid) G.grid.markRow(row);
  }
  function gridSchedule(rows) {
    (rows || []).forEach(function (row) {
      if (!row || gridSnap(row) === row._saved) return;
      var k = gridKey(row);
      G.pending[k] = row;
      gridMark(row, 'saving', 'กำลังบันทึก…');
      clearTimeout(G.timers[k]);
      G.timers[k] = setTimeout(function () { gridSave(row); }, 700);
    });
    gridStatus();
  }
  function gridFlush() {
    Object.keys(G.timers).forEach(function (k) {
      if (G.pending[k]) { clearTimeout(G.timers[k]); gridSave(G.pending[k]); }
    });
  }
  function gridSave(row) {
    var k = gridKey(row);
    clearTimeout(G.timers[k]);
    if (postRowBlank(row)) {               /* ยังไม่ได้พิมพ์อะไร (มีแต่วันที่ที่เติมให้) ไม่ต้องบันทึก */
      delete G.pending[k];
      gridMark(row, '', '');
      gridStatus();
      return;
    }
    if (!row.date) {                       /* ยังไม่มีวันที่ = ยังไม่ใช่โพสต์ ไม่บันทึก */
      delete G.pending[k];
      gridMark(row, row.id ? 'err' : '', row.id ? 'ต้องมีวันที่' : 'ใส่วันที่ก่อนถึงจะบันทึก');
      gridStatus();
      return;
    }
    if (!String(row.topic || '').trim() && !row.url) {   /* ไม่มีหัวข้อและไม่มีลิงก์ = ไม่รับเข้าระบบ จะได้ไม่มีแถวเปล่าค้าง */
      delete G.pending[k];
      gridMark(row, row.id ? 'err' : '', row.id ? 'ต้องมีหัวข้อ' : 'ใส่หัวข้อก่อนถึงจะบันทึก');
      gridStatus();
      return;
    }
    if (row._busy) { G.timers[k] = setTimeout(function () { gridSave(row); }, 400); return; }
    var snap = gridSnap(row);
    var body = {
      pageId: row.pageId || ((S.pages || [])[0] || {}).id || '',
      date: row.date, time: row.time || '', channels: row.channels || [],
      topic: row.topic || '', kind: row.kind || 'content',
      status: row.url ? 'done' : (row.status || 'plan'),
      url: row.url || '', note: row.note || '',
    };
    row._busy = 1;
    var req = row.id ? api('/posts/' + row.id, 'PUT', body) : api('/posts', 'POST', { posts: [body] });
    req.then(function (j) {
      row._busy = 0;
      var wasNew = !row.id;
      if (wasNew && j && j.ids && j.ids[0]) row.id = j.ids[0];
      row._saved = snap;
      delete G.pending[k];
      delete G.timers[k];
      if (row.url) row.status = 'done';
      G.lastOk = new Date();
      gridMark(row, 'ok', 'บันทึกแล้ว');
      if (G.onSaved) { clearTimeout(G.logTimer); G.logTimer = setTimeout(G.onSaved, 900); }
      if (gridSnap(row) !== snap) gridSchedule([row]);      /* พิมพ์ต่อระหว่างกำลังบันทึก */
      gridStatus();
    }).catch(function (e) {
      row._busy = 0;
      var msg = (e && e.message) || 'บันทึกไม่สำเร็จ';
      var offline = !navigator.onLine || /failed to fetch|networkerror|load failed/i.test(msg);
      if (offline) {                                        /* เน็ตหลุด: คิวไว้ ลองใหม่เอง ห้ามให้ข้อมูลหาย */
        gridMark(row, 'saving', 'ยังไม่มีเน็ต — จะบันทึกให้เองเมื่อกลับมา');
        G.timers[k] = setTimeout(function () { gridSave(row); }, 5000);
      } else {
        delete G.pending[k];
        gridMark(row, 'err', msg);
      }
      gridStatus();
    });
  }
  function gridRemove(rows) {
    (rows || []).forEach(function (row) {
      var k = gridKey(row);
      clearTimeout(G.timers[k]);
      delete G.pending[k];
      delete G.timers[k];
      var id = row.id;
      /* เคลียร์ทันที ไม่รอผลลบ — ถ้าไม่เคลียร์ ตัวบันทึกอัตโนมัติจะไปแก้แถวที่กำลังจะหาย */
      row.id = null; row._saved = undefined; row._st = ''; row._msg = '';
      if (!id) return;
      api('/posts/' + id, 'DELETE').catch(function (e) {
        toast('ลบไม่สำเร็จ: ' + e.message, true);
      });
    });
    gridStatus();
  }
  function gridStatus() {
    if (!G.grid) return;
    var n = Object.keys(G.pending).length;
    var bad = 0;
    G.grid.rows.forEach(function (r) { if (r._st === 'err') bad++; });
    if (n) G.grid.setSaveText('<i class="xl-dot saving"></i>กำลังบันทึก ' + n + ' แถว', 'saving');
    else if (bad) G.grid.setSaveText('<i class="xl-dot err"></i>บันทึกไม่สำเร็จ ' + bad + ' แถว', 'err');
    else if (G.lastOk) G.grid.setSaveText('<i class="xl-dot ok"></i>บันทึกแล้ว ' + fmtTime(new Date(G.lastOk)), 'ok');
    else G.grid.setSaveText('<i class="xl-dot"></i>พิมพ์ได้เลย ระบบบันทึกให้เอง', '');
  }
  global.addEventListener('online', function () {
    Object.keys(G.pending).forEach(function (k) { gridSave(G.pending[k]); });
  });
  global.addEventListener('beforeunload', function (e) {
    if (Object.keys(G.pending).length) { e.preventDefault(); e.returnValue = ''; }
  });

  function mountPostGrid(host, list, opts) {
    if (!host || !global.KAN_GRID) return null;
    opts = opts || {};
    var rows = list.slice().sort(function (a, b) {
      var x = (a.date || '') + ' ' + (a.time || '99'), y = (b.date || '') + ' ' + (b.time || '99');
      return x < y ? -1 : (x > y ? 1 : 0);
    });
    rows.forEach(function (r) { r._saved = gridSnap(r); r._st = ''; r._msg = ''; });
    var firstPage = opts.pageId || P.page || ((S.pages || [])[0] || {}).id || '';
    var firstDate = opts.date || '';
    G.grid = global.KAN_GRID.create(host, {
      id: 'posts',
      columns: postColumns(),
      rows: rows,
      freeze: 1,
      isBlank: postRowBlank,
      blankRow: function (last) {
        return { pageId: (last && last.pageId) || firstPage, date: (last && last.date) || firstDate,
                 time: '', channels: (last && last.channels ? last.channels.slice() : []),
                 topic: '', kind: 'content', status: 'plan', url: '', note: '' };
      },
      cloneRow: function (src) {
        return { pageId: src.pageId, date: src.date, time: src.time, channels: (src.channels || []).slice(),
                 topic: src.topic, kind: src.kind, status: 'plan', url: '', note: src.note };
      },
      tone: function (r) { return (!postRowBlank(r) && r.date) ? postTone(r) : ''; },
      canDelete: function () { return S.me.role === 'owner'; },
      confirmDelete: function (n) { return confirm('ลบ ' + n + ' แถวออกจากตารางโพสต์? ย้อนกลับไม่ได้'); },
      onChange: gridSchedule,
      onRemove: gridRemove,
      onToast: function (m) { toast(m); },
      parsePaste: function (html, text) {
        var g = tableFromHtml(html) || tableFromText(text);
        if (!g) return null;
        /* ถ้าก็อปหัวตารางมาด้วย ตัดทิ้ง ไม่งั้นแถวแรกจะกลายเป็นข้อมูลผิด */
        if (g.length > 1 && g[0].map(headerFieldOf).filter(Boolean).length >= 2) g = g.slice(1);
        return g;
      },
      blankRows: opts.blankRows == null ? 5 : opts.blankRows,
    });
    gridStatus();
    return G.grid;
  }

  /* สีเดียวใช้ทั้งปฏิทินและรายการ
     เขียว = โพสต์แล้วมีลิงก์ · เหลือง = โพสต์แล้วแต่ยังไม่มีลิงก์ (ตรวจไม่ได้ว่าขึ้นจริง)
     แดง = เลยวันแล้วยังไม่โพสต์ · เทา = ยังไม่ถึงวัน · จาง = ตั้งใจไม่โพสต์ */
  function postTone(x) {
    if (x.status === 'skip') return 'skip';
    if (x.status === 'done') return x.url ? 'ok' : 'nolink';
    var d = new Date(x.date + 'T23:59:59');
    return d < new Date() ? 'miss' : 'plan';
  }
  var TONE_TH = { ok: 'โพสต์แล้ว', nolink: 'โพสต์แล้ว ไม่มีลิงก์', miss: 'เลยวันแล้วยังไม่โพสต์', plan: 'รอถึงวัน', skip: 'ไม่ตั้งโพสต์' };

  /* ปฏิทินรายเดือน — เปิดมาเห็นทั้งเดือนว่าวันไหนเขียววันไหนแดง */
  function calendarHtml(list) {
    var m = curMonth();
    var y = m.getFullYear(), mo = m.getMonth();
    var first = new Date(y, mo, 1), last = new Date(y, mo + 1, 0);
    var start = (first.getDay() + 6) % 7;            /* ให้สัปดาห์เริ่มวันจันทร์ */
    var byDay = {};
    list.forEach(function (x) { (byDay[x.date] = byDay[x.date] || []).push(x); });

    var h = '<div class="cal"><div class="calhead">' +
      ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div><div class="calgrid">';
    for (var i = 0; i < start; i++) h += '<div class="celloff"></div>';
    for (var day = 1; day <= last.getDate(); day++) {
      var dt = ymd(new Date(y, mo, day));
      var items = byDay[dt] || [];
      var tones = items.map(postTone);
      var n = { ok: 0, nolink: 0, miss: 0, plan: 0, skip: 0 };
      tones.forEach(function (t) { n[t]++; });
      var isToday = dt === ymd(new Date());
      var cls = 'cell' + (isToday ? ' today' : '') + (P.day === dt ? ' pick' : '') + (items.length ? '' : ' empty') +
        (n.miss ? ' bad' : (n.nolink ? ' warn' : (items.length && n.ok === items.length - n.skip ? ' good' : '')));
      h += '<button type="button" class="' + cls + '" data-day="' + dt + '">' +
        '<span class="cd">' + day + '</span>' +
        (items.length
          ? '<span class="cdots">' + tones.slice(0, 8).map(function (t) { return '<i class="' + t + '"></i>'; }).join('') +
            (items.length > 8 ? '<b>+' + (items.length - 8) + '</b>' : '') + '</span>' +
            '<span class="cn">' + (n.ok + n.nolink) + '/' + (items.length - n.skip) + '</span>'
          : '') + '</button>';
    }
    h += '</div></div>';
    return h;
  }

  /* เกจความคืบหน้า — ของเพจที่เลือก หรือรวมทุกเพจ */
  function gaugeHtml(list, label) {
    var live = list.filter(function (x) { return x.status !== 'skip'; });
    var ok = live.filter(function (x) { return postTone(x) === 'ok'; }).length;
    var nolink = live.filter(function (x) { return postTone(x) === 'nolink'; }).length;
    var miss = live.filter(function (x) { return postTone(x) === 'miss'; }).length;
    var plan = live.filter(function (x) { return postTone(x) === 'plan'; }).length;
    var total = live.length || 1;
    var pct = Math.round((ok / total) * 100);
    var seg = function (n, cls) { return n ? '<i class="' + cls + '" style="width:' + (n / total * 100) + '%" title="' + n + '"></i>' : ''; };
    return '<div class="gauge"><div class="gtop"><b>' + esc(label) + '</b>' +
      '<span class="gpct">' + pct + '%</span></div>' +
      '<div class="gbar">' + seg(ok, 'ok') + seg(nolink, 'nolink') + seg(miss, 'miss') + seg(plan, 'plan') + '</div>' +
      '<div class="gleg">' +
      '<span class="ok">โพสต์แล้ว ' + ok + '</span>' +
      (nolink ? '<span class="nolink">ไม่มีลิงก์ ' + nolink + '</span>' : '') +
      (miss ? '<span class="miss">ยังไม่โพสต์ ' + miss + '</span>' : '') +
      (plan ? '<span class="plan">รอถึงวัน ' + plan + '</span>' : '') +
      '</div></div>';
  }

  function postRow(x) {
    var st = x.status, tone = postTone(x);
    var mark = st === 'done' ? '✓' : (st === 'skip' ? '–' : '');
    return '<div class="postrow ' + esc(st) + ' t-' + tone + '" data-post="' + esc(x.id) + '" title="' + esc(TONE_TH[tone]) + '">' +
      '<button type="button" class="subcheck tone-' + tone + '" data-post-toggle="' + esc(x.id) + '" aria-label="ติ๊กว่าโพสต์แล้ว">' + mark + '</button>' +
      '<button type="button" class="ptime" data-post-edit="' + esc(x.id) + '" title="กดเพื่อแก้เวลา">' + esc(x.time || 'ใส่เวลา') + '</button>' +
      '<span class="pmain"><span class="pt">' + esc(x.topic || '(ยังไม่ใส่หัวข้อ)') + '</span>' +
      '<span class="pm"><span class="pill ' + (x.kind === 'live' ? 'blocked' : (x.kind === 'promo' ? 'repeat' : 'todo')) + '">' + esc(POST_KIND[x.kind] || x.kind) + '</span>' +
      '<span>' + esc(pageName(x.pageId)) + '</span>' + campaignChip(x.campaignId) +
      (x.channels || []).map(function (c) { return '<span class="ch">' + esc(c) + '</span>'; }).join('') +
      (x.note ? '<span class="pnote" title="' + esc(x.note) + '">' + esc(x.note.slice(0, 40)) + '</span>' : '') + '</span></span>' +
      (x.url
        ? '<a class="plink" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">เปิดโพสต์ ↗</a>'
        : '<input class="input purl" data-post-url="' + esc(x.id) + '" placeholder="วางลิงก์โพสต์" autocomplete="off">') +
      '<button type="button" class="btn-text pedit" data-post-edit="' + esc(x.id) + '">แก้</button></div>';
  }

  /* เวลาโพสต์เก็บเป็นข้อความอย่าง "17.00" หรือช่วง "15.00-20.00" (ตามที่ทีมเขียนกันมาแต่เดิม)
     แต่ตอนกรอกให้เลือกจากนาฬิกาจริง จะได้ไม่ต้องพิมพ์เองให้ผิดรูปแบบ */
  var TIME_QUICK = ['10.00', '12.00', '14.00', '15.00', '17.00', '18.00', '19.00', '20.00'];
  function timeToInput(t) {
    var m = String(t || '').match(/^(\d{1,2})[.:](\d{2})$/);
    return m ? pad(Number(m[1])) + ':' + m[2] : '';
  }
  function parseTimeValue(v) {
    var parts = String(v || '').split('-');
    return { a: timeToInput(parts[0]), b: timeToInput(parts[1]) };
  }
  function inputToTime(v) {
    var m = String(v || '').match(/^(\d{2}):(\d{2})$/);
    return m ? Number(m[1]) + '.' + m[2] : '';
  }
  function buildTimeValue(a, b) {
    var x = inputToTime(a), y = inputToTime(b);
    if (!x) return '';
    return y ? x + '-' + y : x;
  }

  /* ---------- ประวัติการแก้ตารางโพสต์ (ใต้ตารางในหน้าต่างเพิ่มโพสต์) ----------
     นนท์: "ถ้าผมบันทึกผิด ผมจะได้รู้ว่าผมแก้อะไรไปเมื่อไหร่ แล้วจะลบยังไง" */
  var LOG_ACT = { create: 'เพิ่ม', update: 'แก้', delete: 'ลบ' };
  var LOG_FIELD_TH = { date: 'วันที่', time: 'เวลา', pageId: 'เพจ', kind: 'ชนิด', channels: 'ช่องทาง',
                       topic: 'หัวข้อ', status: 'สถานะ', url: 'ลิงก์', note: 'หมายเหตุ' };
  function logValue(field, v) {
    if (!v) return '(ว่าง)';
    if (field === 'date') return thaiShort(v);
    if (field === 'pageId') return pageName(v);
    if (field === 'kind') return POST_KIND[v] || v;
    if (field === 'status') return POST_STATUS_TH[v] || v;
    if (field === 'channels') { try { return (JSON.parse(v) || []).join(', ') || '(ว่าง)'; } catch (e) { return v; } }
    return String(v).length > 26 ? String(v).slice(0, 26) + '…' : String(v);
  }
  function logRowHtml(e, editLabel) {
    var who = staffById(e.staffId);
    var d = new Date(e.createdAt);
    var when = sameDay(d, new Date()) ? fmtTime(d) : (fmtDate(d) + ' ' + fmtTime(d));
    var head = (e.date ? thaiShort(e.date) : '—') + (e.time ? ' ' + e.time : '') + ' · ' + esc(pageName(e.pageId));
    var topic = e.topic ? esc(e.topic.slice(0, 46)) : '<i class="mut">(ยังไม่มีหัวข้อ)</i>';
    var detail = e.changes && e.changes.length
      ? e.changes.map(function (c) {
          return esc(LOG_FIELD_TH[c[0]] || c[0]) + ': ' + esc(logValue(c[0], c[1])) + ' → <b>' + esc(logValue(c[0], c[2])) + '</b>';
        }).join(' · ')
      : '';
    return '<div class="lg-i ' + esc(e.action) + '">' +
      '<span class="lg-t">' + esc(when) + '</span>' +
      '<span class="lg-w">' + esc(who ? shortName(who) : '?') + '</span>' +
      '<span class="lg-a">' + esc(LOG_ACT[e.action] || e.action) + '</span>' +
      '<span class="lg-m"><b>' + topic + '</b><small>' + head + (detail ? ' · ' + detail : '') + '</small></span>' +
      '<span class="lg-b">' + (e.canEdit
        ? '<button type="button" class="btn-ghost sm" data-log-edit="' + esc(e.postId) + '">' + esc(editLabel || 'แก้ในตาราง') + '</button>' +
          '<button type="button" class="btn-ghost sm danger" data-log-del="' + esc(e.postId) + '">ลบโพสต์</button>'
        : (e.alive ? '<span class="mut">ของคนอื่น</span>' : '<span class="mut">ลบไปแล้ว</span>')) + '</span></div>';
  }
  /* แผงเดียวใช้ได้สองที่: ในหน้าต่างเพิ่มโพสต์ และใต้ปฏิทินหน้าหลัก
     ต่างกันแค่ปุ่ม "แก้" — ในตารางเลื่อนไปที่แถวนั้น ส่วนหน้าหลักเปิดฟอร์มแก้ทีละอัน
     opts: { editLabel, onEdit(postId), afterDelete(postId) → true ถ้าวาดหน้าใหม่เองแล้ว } */
  function renderSheetLog(host, opts) {
    if (!host) return;
    if (opts) host._logOpts = opts;
    var o = host._logOpts || {};
    if (!host._logBound) {                 /* ผูกครั้งเดียว เนื้อในถูกวาดใหม่ทุกรอบ */
      host._logBound = 1;
      host.addEventListener('click', function (ev) {
        var op = host._logOpts || {}, b;
        if ((b = ev.target.closest('[data-log-del]'))) {
          var pid = b.getAttribute('data-log-del');
          if (!confirm('ลบโพสต์นี้ออกจากตารางโพสต์?')) return;
          b.disabled = true;
          api('/posts/' + pid, 'DELETE').then(function () {
            toast('ลบโพสต์แล้ว');
            if (!(op.afterDelete && op.afterDelete(pid))) renderSheetLog(host);
          }).catch(function (e) { b.disabled = false; toast(e.message, true); });
          return;
        }
        if ((b = ev.target.closest('[data-log-edit]')) && op.onEdit) op.onEdit(b.getAttribute('data-log-edit'), b);
      });
    }
    Promise.all([api('/posts/log?limit=40'), api('/posts/blank').catch(function () { return { count: 0 }; })])
      .then(function (r) {
        var list = r[0].log || [], nBlank = r[1].count || 0;
        host.innerHTML = '<div class="lg-h"><h3>ประวัติการแก้ล่าสุด</h3>' +
          '<span class="hint">กดดูได้ว่าใครแก้อะไรตอนไหน · ของที่ตัวเองเพิ่มไว้ลบเองได้</span>' +
          (nBlank ? '<button type="button" class="btn-ghost sm danger" id="purgeBlank">ลบโพสต์ที่ไม่มีหัวข้อ (' + nBlank + ')</button>' : '') +
          '</div>' +
          (list.length ? '<div class="lg-list">' + list.map(function (e) { return logRowHtml(e, o.editLabel); }).join('') + '</div>'
                       : '<div class="lg-empty">ยังไม่มีการแก้ในตารางนี้</div>');
        var pb = $('#purgeBlank', host);
        if (pb) pb.addEventListener('click', function () {
          if (!confirm('ลบโพสต์ที่ยังไม่มีหัวข้อทั้งหมด ' + nBlank + ' รายการ?')) return;
          pb.disabled = true;
          api('/posts/blank', 'DELETE').then(function (j) {
            toast('ลบโพสต์เปล่า ' + j.deleted + ' รายการแล้ว');
            if (!(o.afterDelete && o.afterDelete(null))) renderSheetLog(host);
          }).catch(function (e) { pb.disabled = false; toast(e.message, true); });
        });
      })
      .catch(function (e) { host.innerHTML = '<div class="lg-empty">อ่านประวัติไม่ได้: ' + esc(e.message) + '</div>'; });
  }

  /* หน้าต่าง "เพิ่มโพสต์" = ตารางแบบ Excel กรอกทีเดียวหลายโพสต์
     (นนท์: หน้าหลักให้เป็นปฏิทิน/รายการเหมือนเดิม ส่วนตารางเอามาไว้ตรงนี้) */
  function openPostSheet() {
    var host = document.createElement('div');
    host.className = 'modal';
    var today = P.day || ymd(new Date());
    var pageId = P.page || ((S.pages || [])[0] || {}).id || '';
    host.innerHTML = '<div class="modal-box sheet"><div class="sec-h"><h2>เพิ่มโพสต์</h2>' +
      '<p>พิมพ์ในตารางได้เลยเหมือน Excel · วางจาก Excel ก็ได้ · ระบบบันทึกให้เองทีละแถว</p>' +
      '<button type="button" class="btn-text" data-close>ปิด</button></div>' +
      '<div class="sheet-bar"><label class="label" for="sheetPage">ตารางนี้อัปเดตของเพจ</label>' +
      '<select class="select" id="sheetPage">' + (S.pages || []).map(function (pg) {
        return '<option value="' + esc(pg.id) + '"' + (pg.id === pageId ? ' selected' : '') + '>' + esc(pg.name) + '</option>';
      }).join('') + '</select>' +
      '<span class="hint">ทุกแถวจะลงเพจนี้ · ถ้าแถวไหนต่างเพจ แก้ในคอลัมน์ “เพจ” ได้</span></div>' +
      '<div class="sec-b tight"><div id="sheetHost"></div></div>' +
      '<div class="sheet-log" id="sheetLog"><div class="lg-empty">กำลังอ่านประวัติ…</div></div>' +
      '<div class="sheet-foot"><span class="hint">คลุมทั้งแถวแล้วกด Delete = ลบแถว · Enter ลงแถวถัดไป · Tab ช่องถัดไป · Cmd/Ctrl+Z ย้อนกลับ</span>' +
      '<button type="button" class="btn" data-close>เสร็จแล้ว</button></div></div>';
    document.body.appendChild(host);
    var close = function () {
      gridFlush();
      G.grid = null;
      G.onSaved = null;
      clearTimeout(G.logTimer);
      host.remove();
      renderPosts();
    };
    $$('[data-close]', host).forEach(function (b) { b.addEventListener('click', close); });
    host.addEventListener('click', function (ev) { if (ev.target === host) close(); });
    mountPostGrid($('#sheetHost', host), [], { date: today, pageId: pageId, blankRows: 10 });
    /* เปลี่ยนเพจด้านบน = เปลี่ยนให้ทุกแถวในตารางนี้ (แถวที่บันทึกไปแล้วก็ย้ายเพจตาม) */
    $('#sheetPage', host).addEventListener('change', function () {
      var pid = this.value, g = G.grid;
      if (!g) return;
      var moved = [];
      g.rows.forEach(function (r) {
        if (r.pageId === pid) return;
        r.pageId = pid;
        if (!postRowBlank(r)) moved.push(r);
      });
      g.opt.blankRow = function (last) {
        return { pageId: pid, date: (last && last.date) || today, time: '',
                 channels: (last && last.channels ? last.channels.slice() : []),
                 topic: '', kind: 'content', status: 'plan', url: '', note: '' };
      };
      g.refresh(true);
      if (moved.length) { gridSchedule(moved); toast('ย้าย ' + moved.length + ' แถวไปเพจ ' + pageName(pid) + ' แล้ว'); }
    });
    var logHost = $('#sheetLog', host);
    renderSheetLog(logHost, {
      /* ลบจากประวัติแล้ว เอาแถวออกจากตารางที่เปิดค้างอยู่ด้วย จะได้ไม่ค้างบนจอ */
      afterDelete: function (pid) {
        var g = G.grid;
        if (g && pid) {
          var hit = g.rows.filter(function (r) { return r.id === pid; })[0];
          if (hit) { g.rows.splice(g.rows.indexOf(hit), 1); g.ensureBlank(); g.refresh(true); }
        }
        return false;
      },
      onEdit: function (eid, b) {
        var g2 = G.grid;
        if (!g2) return;
        var found = g2.rows.filter(function (r) { return r.id === eid; })[0];
        if (found) { selectSheetRow(g2, found); return; }
        b.disabled = true;
        api('/posts?from=1900-01-01&to=2999-12-31').then(function (j) {
          var pst = (j.posts || []).filter(function (x) { return x.id === eid; })[0];
          b.disabled = false;
          if (!pst) { toast('ไม่พบโพสต์นี้แล้ว', true); return; }
          pst._saved = gridSnap(pst);
          g2.rows.unshift(pst);
          g2.refresh(true);
          selectSheetRow(g2, pst);
          toast('ดึงโพสต์ขึ้นมาแก้ในตารางแล้ว (แถวบนสุด)');
        }).catch(function (e) { b.disabled = false; toast(e.message, true); });
      },
    });
    G.onSaved = function () { renderSheetLog(logHost); };
    setTimeout(function () {
      var g = G.grid;
      if (g) { g.setSel(0, g.colIdx('topic'), false); }
    }, 60);
  }
  function selectSheetRow(g, row) {
    var ri = g.rows.indexOf(row), vr = g.view.indexOf(ri);
    if (vr < 0) { g.refresh(true); vr = g.view.indexOf(ri); }
    if (vr >= 0) g.setSel(vr, g.colIdx('topic'), false);
  }

  /* ฟอร์มแก้โพสต์ทีละอัน — ใช้ตอนกด "แก้" จากปฏิทิน/รายการ */
  function openPostForm(post) {
    var isNew = !post;
    var tv = parseTimeValue(post ? post.time : '');
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
      '<div class="field"><label class="label">เวลาโพสต์</label>' +
      '<div class="timepick"><input class="input" type="time" name="t1" value="' + esc(tv.a) + '">' +
      '<label class="tspan"><input type="checkbox" name="hasEnd"' + (tv.b ? ' checked' : '') + '> ถึง</label>' +
      '<input class="input" type="time" name="t2" value="' + esc(tv.b) + '"' + (tv.b ? '' : ' disabled') + '></div>' +
      '<div class="chips tquick">' + TIME_QUICK.map(function (q) {
        return '<button type="button" class="chip plain" data-qt="' + q + '">' + q + '</button>';
      }).join('') + '<button type="button" class="chip plain" data-qt="">ไม่ระบุ</button></div></div></div>' +
      '<div class="field"><label class="label">ช่องทาง</label><div class="chips" id="chSel">' +
      chAll.map(function (c) {
        var on = post && (post.channels || []).indexOf(c) !== -1;
        return '<button type="button" class="chip plain' + (on ? ' on' : '') + '" data-ch="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="field"><label class="label">หัวข้อ / เนื้อหา</label><textarea class="textarea" name="topic" data-rich placeholder="เช่น aw โปร 10 20 30 + โซนที่ร่วมรายการ">' + esc(post ? post.topic : '') + '</textarea></div>' +
      '<div class="field"><label class="label">เชื่อมกับปฏิทินการตลาด <small>โพสต์นี้ทำให้คอนเทนต์/แคมเปญ/โปรโมชั่นไหน</small></label>' +
      campaignSelect('name="campaignId"', post ? post.campaignId : (P.campaign || null)) + '</div>' +
      '<div class="grid2"><div class="field"><label class="label">ลิงก์โพสต์ <small>ใส่แล้วนับว่าโพสต์แล้ว</small></label><input class="input" name="url" value="' + esc(post ? post.url : '') + '" placeholder="https://..."></div>' +
      '<div class="field"><label class="label">หมายเหตุ</label><input class="input" name="note" value="' + esc(post ? post.note : '') + '"></div></div>' +
      '<div class="acts"><button type="submit" class="btn">' + (isNew ? 'เพิ่มโพสต์' : 'บันทึก') + '</button>' +
      '<button type="button" class="btn-ghost" data-close>ยกเลิก</button>' +
      (!isNew && S.me.role === 'owner' ? '<button type="button" class="btn-ghost danger" id="delPost" style="margin-left:auto">ลบ</button>' : '') +
      '</div></form></div></div>';
    document.body.appendChild(host);
    wireTyping(host);
    var close = function () { host.remove(); };
    $$('[data-close]', host).forEach(function (b) { b.addEventListener('click', close); });
    host.addEventListener('click', function (ev) { if (ev.target === host) close(); });
    $('#chSel', host).addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ch]'); if (b) b.classList.toggle('on');
    });
    var f0 = $('#postForm', host);
    /* ติ๊ก "ถึง" = เปิดช่องเวลาสิ้นสุด · ไม่ติ๊ก = เวลาเดียว */
    f0.hasEnd.addEventListener('change', function () {
      f0.t2.disabled = !this.checked;
      if (this.checked && !f0.t2.value && f0.t1.value) {
        var h = Number(f0.t1.value.slice(0, 2)) + 3;
        f0.t2.value = pad(Math.min(h, 23)) + f0.t1.value.slice(2);
      }
      if (!this.checked) f0.t2.value = '';
    });
    $('.tquick', host).addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-qt]'); if (!b) return;
      var q = b.getAttribute('data-qt');
      f0.t1.value = timeToInput(q);
      if (!q) { f0.hasEnd.checked = false; f0.t2.value = ''; f0.t2.disabled = true; }
      $$('[data-qt]', host).forEach(function (x) { x.classList.toggle('on', x === b); });
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
        pageId: f.pageId.value, kind: f.kind.value, date: f.date.value,
        time: buildTimeValue(f.t1.value, f.hasEnd.checked ? f.t2.value : ''),
        topic: f.topic.value, url: f.url.value.trim(), note: f.note.value,
        campaignId: f.campaignId.value || null,
        channels: $$('.chip.on[data-ch]', host).map(function (b) { return b.getAttribute('data-ch'); }),
      };
      if (!body.topic.trim() && !body.url) {   /* กันโพสต์เปล่าตั้งแต่ตอนกรอก ไม่ให้ไปค้างในตาราง */
        toast('ใส่หัวข้อก่อนถึงจะบันทึกได้', true);
        f.topic.focus();
        return;
      }
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

  /* ---------- วางตารางจาก Excel ----------------------------------------
     ทีมทำแผนโพสต์ใน Excel อยู่แล้ว ให้ก็อปทั้งบล็อกมาวางในนี้ทีเดียว
     ระบบอ่านเป็นตาราง → ให้เลือกว่าคอลัมน์ไหนคืออะไร → พรีวิว → บันทึก
     แถวที่ตรงกับของเดิม (เพจ + วัน + เวลา) จะทับของเดิม ไม่สร้างซ้ำ */
  var PASTE_COLS = [
    ['skip', '— ไม่ใช้ —'], ['date', 'วันที่ (เต็ม)'], ['day', 'วันที่ (เลขวัน)'], ['month', 'เดือน'],
    ['time', 'เวลา'], ['channels', 'ช่องทาง'], ['topic', 'หัวข้อ / เนื้อหา'], ['kind', 'ชนิด'],
    ['status', 'สถานะ'], ['url', 'ลิงก์โพสต์'], ['note', 'หมายเหตุ'], ['page', 'เพจ']
  ];
  var PASTE_LABEL = {};
  PASTE_COLS.forEach(function (p) { PASTE_LABEL[p[0]] = p[1]; });
  var MON_FULL_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                     'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var MON_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function normTxt(s) { return String(s == null ? '' : s).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
  function monthIdx(v) {
    var s = normTxt(v).toLowerCase().replace(/[.\s]/g, '');
    if (!s) return null;
    if (/^\d{1,2}$/.test(s)) { var n = Number(s); return n >= 1 && n <= 12 ? n - 1 : null; }
    for (var i = 0; i < 12; i++) {
      if (s === MON_TH[i].replace(/\./g, '') || s === MON_FULL_TH[i]) return i;
      if (s.indexOf(MON_EN[i]) === 0) return i;
      if (MON_FULL_TH[i].indexOf(s) === 0 && s.length >= 3) return i;
    }
    return null;
  }
  /* ปี: 2569 (พ.ศ.) → 2026 · 69 → 2569 → 2026 · 26 → 2026 */
  function fixYear(y) {
    y = Number(y);
    if (y < 100) y = y >= 50 ? 2500 + y : 2000 + y;
    if (y > 2400) y -= 543;
    return y;
  }
  function isoOf(y, mo, d) {
    y = fixYear(y); mo = Number(mo); d = Number(d);
    if (!(mo >= 1 && mo <= 12) || !(d >= 1 && d <= 31) || !(y >= 2000 && y <= 2100)) return '';
    var dt = new Date(y, mo - 1, d);
    if (dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
    return y + '-' + pad(mo) + '-' + pad(d);
  }
  function parsePostDate(v, baseY, baseM) {
    var s = normTxt(v);
    if (!s) return '';
    var m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return isoOf(m[1], m[2], m[3]);
    m = s.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})/);
    if (m) return isoOf(m[3], m[2], m[1]);
    m = s.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?!\d)/);
    if (m) return isoOf(baseY, m[2], m[1]);
    m = s.match(/(\d{1,2})\s*([ก-ฮ][ก-ฮะ-๎.]*|[A-Za-z]{3,9})\.?\s*(\d{2,4})?/);
    if (m && monthIdx(m[2]) !== null) return isoOf(m[3] || baseY, monthIdx(m[2]) + 1, m[1]);
    m = s.match(/^(?:[ก-ฮ]{1,4}\.?\s*)?(\d{1,2})$/);
    if (m) return isoOf(baseY, baseM, m[1]);
    return '';
  }
  function parsePasteTime(v) {
    var s = normTxt(v).replace(/น\.?$/, '').replace(/\s/g, '');
    if (!s || /^[-–—]$/.test(s)) return '';
    var m = s.match(/^(\d{1,2})[.:](\d{2})[-–—](\d{1,2})[.:](\d{2})$/);
    if (m) return Number(m[1]) + '.' + m[2] + '-' + Number(m[3]) + '.' + m[4];
    m = s.match(/^(\d{1,2})[.:](\d{2})/);
    if (m) return Number(m[1]) + '.' + m[2];
    m = s.match(/^(\d{1,2})$/);
    if (m && Number(m[1]) <= 23) return Number(m[1]) + '.00';
    return '';
  }
  var CH_MAP = [[/face|fb|เฟส/i, 'Facebook'], [/line|ไลน์/i, 'Line OA'],
                [/tik|ติ๊ก|tt\b/i, 'TikTok'], [/insta|\big\b|ไอจี/i, 'Instagram']];
  function parsePasteChannels(v) {
    var s = normTxt(v);
    if (!s) return [];
    var out = [];
    s.split(/[,\/&+·|]|และ|\s{2,}/).forEach(function (part) {
      CH_MAP.forEach(function (p) {
        if (p[0].test(part) && out.indexOf(p[1]) === -1) out.push(p[1]);
      });
    });
    if (!out.length) CH_MAP.forEach(function (p) { if (p[0].test(s) && out.indexOf(p[1]) === -1) out.push(p[1]); });
    return out;
  }
  function parsePasteKind(v, topic) {
    var s = normTxt(v) + ' ' + normTxt(topic);
    if (/live|ไลฟ์|ไลv/i.test(s)) return 'live';
    if (/vdo|video|วิดี|วีดี|reel|รีล|คลิป/i.test(s)) return 'video';
    if (/promo|โปรโม|^โปร|\sโปร|ส่วนลด|ลดราคา|ลด\s?\d|\d+\s?%|แจกฟรี|แถม|sale/i.test(s)) return 'promo';
    return 'content';
  }
  function parsePasteStatus(v, url) {
    var s = normTxt(v);
    if (/skip|ข้าม|ไม่โพส|ยกเลิก|งด/i.test(s)) return 'skip';
    if (url) return 'done';
    if (/done|โพสแล้ว|โพสต์แล้ว|เสร็จ|ลงแล้ว|เรียบร้อย|✓|✔|yes|y\b/i.test(s)) return 'done';
    return 'plan';
  }
  function pageIdByText(v) {
    var s = normTxt(v).toLowerCase();
    if (!s) return '';
    var hit = (S.pages || []).filter(function (pg) {
      var n = pg.name.toLowerCase();
      return n === s || n.indexOf(s) !== -1 || s.indexOf(n) !== -1;
    })[0];
    return hit ? hit.id : '';
  }

  function tableFromHtml(html) {
    if (!html || html.toLowerCase().indexOf('<t') === -1) return null;
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch (e) { return null; }
    var tb = doc.querySelector('table');
    if (!tb) return null;
    var out = [];
    Array.prototype.forEach.call(tb.rows, function (tr) {
      out.push(Array.prototype.map.call(tr.cells, function (td) {
        return normTxt((td.innerText || td.textContent || '').replace(/\n+/g, ' '));
      }));
    });
    return out.length ? out : null;
  }
  function tableFromText(text) {
    var s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!s.trim()) return null;
    var sep = s.indexOf('\t') !== -1 ? '\t' : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (q) {
        if (c === '"') { if (s.charAt(i + 1) === '"') { cell += '"'; i++; } else { q = false; } }
        else { cell += c; }
      } else if (c === '"') { q = true; }
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else { cell += c; }
    }
    row.push(cell); rows.push(row);
    rows = rows.map(function (r) { return r.map(normTxt); })
      .filter(function (r) { return r.join('') !== ''; });
    return rows.length ? rows : null;
  }
  var HEAD_HINT = [
    [/^วัน(ที่)?$/i, 'day'], [/วันที่|^date$/i, 'date'], [/เดือน|^month$/i, 'month'],
    [/เวลา|time/i, 'time'], [/ช่องทาง|chan|แพลตฟอร์ม|platform|ลงที่/i, 'channels'],
    [/ชนิด|ประเภท|รูปแบบ|type|kind/i, 'kind'], [/สถานะ|status/i, 'status'],
    [/ลิงก์|ลิงค์|link|url/i, 'url'], [/หมายเหตุ|note|remark|comment/i, 'note'],
    [/เพจ|page|สาขา|ร้าน/i, 'page'],
    [/หัวข้อ|เนื้อหา|คอนเทนต์|content|angle|แองเกิ|สินค้า|รายละเอียด|topic|caption|โปรโมชั่น|โปรโมชัน|งาน/i, 'topic']
  ];
  function headerFieldOf(cell) {
    var s = normTxt(cell);
    if (!s) return null;
    for (var i = 0; i < HEAD_HINT.length; i++) { if (HEAD_HINT[i][0].test(s)) return HEAD_HINT[i][1]; }
    return null;
  }
  /* เดาจากเนื้อในถ้าไม่มีหัวตาราง — ดูทีละคอลัมน์ว่าหน้าตาเป็นวัน เวลา ลิงก์ ฯลฯ */
  function autoMapByContent(rows, baseY, baseM) {
    var n = 0;
    rows.forEach(function (r) { n = Math.max(n, r.length); });
    var map = [], used = {};
    for (var c = 0; c < n; c++) {
      var vals = rows.map(function (r) { return normTxt(r[c] || ''); }).filter(Boolean);
      var f = 'skip';
      var hit = function (fn) { return vals.length && vals.filter(fn).length >= Math.ceil(vals.length * 0.6); };
      if (!vals.length) { map.push('skip'); continue; }
      if (hit(function (v) { return /^https?:\/\//i.test(v); })) f = 'url';
      /* คอลัมน์วันที่: ต้องอ่านเป็นวันได้ และหน้าตาเป็นวันจริง ๆ (มีขีด ทับ หรือชื่อเดือนไทย) ไม่ใช่ประโยคยาว */
      else if (!used.date && hit(function (v) {
        return v.length <= 24 && !!parsePostDate(v, baseY, baseM) && /[\/\-]|[ก-ฮ]/.test(v);
      })) f = 'date';
      else if (!used.time && hit(function (v) { return !!parsePasteTime(v); })) f = 'time';
      else if (!used.channels && hit(function (v) { return parsePasteChannels(v).length > 0; })) f = 'channels';
      else if (!used.day && hit(function (v) { return /^\d{1,2}$/.test(v); })) f = 'day';
      else if (!used.topic) f = 'topic';
      else if (!used.note) f = 'note';
      used[f] = 1;
      map.push(f);
    }
    return map;
  }

  function buildPasteRows(rows, map, opt) {
    var out = [];
    rows.forEach(function (r, i) {
      var g = {};
      map.forEach(function (f, c) {
        if (f === 'skip') return;
        var v = normTxt(r[c] || '');
        if (!v) return;
        g[f] = g[f] ? g[f] + ' ' + v : v;
      });
      if (!Object.keys(g).length) return;
      var mo = g.month ? monthIdx(g.month) : null;
      var baseM = mo !== null ? mo + 1 : opt.baseM;
      var date = g.date ? parsePostDate(g.date, opt.baseY, baseM) : '';
      if (!date && g.day) date = parsePostDate(g.day, opt.baseY, baseM);
      if (!date && g.date) date = parsePostDate(g.date, opt.baseY, opt.baseM);
      var url = (g.url || '').match(/https?:\/\/\S+/);
      url = url ? url[0] : '';
      var topic = g.topic || '';
      var rec = {
        n: i + 1,
        pageId: (g.page ? pageIdByText(g.page) : '') || opt.pageId,
        date: date,
        time: parsePasteTime(g.time || ''),
        channels: parsePasteChannels(g.channels || ''),
        topic: topic,
        kind: parsePasteKind(g.kind || '', topic),
        status: parsePasteStatus(g.status || '', url),
        url: url,
        note: g.note || '',
        raw: r
      };
      if (!rec.date) rec.err = 'อ่านวันที่ไม่ได้';
      else if (!rec.topic && !rec.time && !rec.channels.length) rec.err = 'แถวว่าง';
      out.push(rec);
    });
    return out;
  }
  function topicKey(s) { return normTxt(s).toLowerCase().replace(/[\s\-_.·,"'"'()]/g, '').slice(0, 40); }

  function openPasteImport() {
    var host = document.createElement('div');
    host.className = 'modal';
    host.innerHTML = '<div class="modal-box wide"><div class="sec-h"><h2>วางตารางจาก Excel</h2>' +
      '<button type="button" class="btn-text" data-close>ปิด</button></div>' +
      '<div class="sec-b" id="pasteBody"></div></div>';
    document.body.appendChild(host);
    var close = function () { host.remove(); };
    host.addEventListener('click', function (ev) {
      if (ev.target === host || ev.target.closest('[data-close]')) close();
    });
    var body = $('#pasteBody', host);
    var now = new Date();
    var st = {
      pageId: P.page || ((S.pages || [])[0] || {}).id || '',
      month: (P.month || (now.getFullYear() + '-' + pad(now.getMonth() + 1))),
      rows: null, map: null
    };
    function baseYM() {
      var p = st.month.split('-');
      return { baseY: Number(p[0]), baseM: Number(p[1]), pageId: st.pageId };
    }
    function pageOptions(sel) {
      return (S.pages || []).map(function (pg) {
        return '<option value="' + esc(pg.id) + '"' + (pg.id === sel ? ' selected' : '') + '>' + esc(pg.name) + '</option>';
      }).join('');
    }

    function stepPaste(msg) {
      body.innerHTML =
        '<div class="grid2"><div class="field"><label class="label">เพจ <small>ใช้กับแถวที่ไม่ได้ระบุเพจเอง</small></label>' +
        '<select class="select" id="pgSel">' + pageOptions(st.pageId) + '</select></div>' +
        '<div class="field"><label class="label">เดือนของตาราง <small>ใช้ตอนในไฟล์มีแต่เลขวัน</small></label>' +
        '<input class="input" type="month" id="moSel" value="' + esc(st.month) + '"></div></div>' +
        (msg ? '<p class="hint bad" style="margin-top:10px">' + esc(msg) + '</p>' : '') +
        '<div class="field" style="margin-top:14px"><label class="label">วางตารางตรงนี้ <small>ก็อปจาก Excel / Google Sheet ทั้งบล็อก แล้ว Ctrl+V (Mac: ⌘V)</small></label>' +
        '<div class="pastebox" id="pasteBox" contenteditable="true" spellcheck="false" data-ph="คลิกตรงนี้แล้ววางตารางได้เลย — เอาหัวตารางมาด้วยจะเดาคอลัมน์ให้ถูกขึ้น"></div></div>' +
        '<div class="acts" style="margin-top:14px"><button type="button" class="btn" id="readBtn">อ่านตาราง</button>' +
        '<button type="button" class="btn-ghost" data-close>ยกเลิก</button></div>' +
        '<p class="hint" style="margin-top:10px">อ่านคอลัมน์ วัน · เดือน · เวลา · ช่องทาง · หัวข้อ · ชนิด · สถานะ · ลิงก์ · หมายเหตุ ได้เอง ' +
        'แถวที่ตรงกับของเดิม (เพจ + วัน + เวลา) จะทับของเดิมให้ ไม่เพิ่มซ้ำ</p>';
      var box = $('#pasteBox', body);
      $('#pgSel', body).addEventListener('change', function () { st.pageId = this.value; });
      $('#moSel', body).addEventListener('change', function () { st.month = this.value || st.month; });
      box.addEventListener('paste', function (ev) {
        var cd = ev.clipboardData;
        if (!cd) return;
        var html = cd.getData('text/html'), text = cd.getData('text/plain');
        var rows = tableFromHtml(html) || tableFromText(text);
        if (rows) { ev.preventDefault(); stepMap(rows); }
      });
      $('#readBtn', body).addEventListener('click', function () {
        var rows = tableFromText(box.innerText);
        if (!rows) { toast('ยังไม่มีตารางให้อ่าน — วางข้อมูลก่อน', true); return; }
        stepMap(rows);
      });
      setTimeout(function () { box.focus(); }, 60);
    }

    function stepMap(rows) {
      var b = baseYM();
      var head = rows[0].map(headerFieldOf);
      var hasHead = head.filter(Boolean).length >= 2;
      var data = hasHead ? rows.slice(1) : rows;
      if (!data.length) { stepPaste('มีแต่หัวตาราง ไม่มีข้อมูล'); return; }
      var map = hasHead
        ? head.map(function (f) { return f || 'skip'; })
        : autoMapByContent(data, b.baseY, b.baseM);
      while (map.length < rows[0].length) map.push('skip');
      st.rows = data; st.map = map; st.head = hasHead ? rows[0] : null;
      drawPreview();
    }

    function drawPreview() {
      var b = baseYM();
      var recs = buildPasteRows(st.rows, st.map, b);
      var ok = recs.filter(function (r) { return !r.err; });
      var bad = recs.filter(function (r) { return r.err; });
      var cols = st.map.map(function (f, i) {
        return '<div class="mapcol"><span>' + esc(st.head ? (st.head[i] || ('คอลัมน์ ' + (i + 1))) : ('คอลัมน์ ' + (i + 1))) + '</span>' +
          '<select class="select" data-mapc="' + i + '">' +
          PASTE_COLS.map(function (p) {
            return '<option value="' + p[0] + '"' + (p[0] === f ? ' selected' : '') + '>' + esc(p[1]) + '</option>';
          }).join('') + '</select></div>';
      }).join('');
      var rowsHtml = recs.slice(0, 60).map(function (r) {
        if (r.err) {
          return '<tr class="skiprow"><td>' + r.n + '</td><td colspan="6">' + esc(r.err) + ' — ' +
            esc(r.raw.join(' · ').slice(0, 90)) + '</td></tr>';
        }
        return '<tr><td>' + r.n + '</td><td>' + esc(r.date) + (r.time ? ' <b>' + esc(r.time) + '</b>' : '') + '</td>' +
          '<td>' + esc(pageName(r.pageId)) + '</td>' +
          '<td>' + esc(POST_KIND[r.kind] || r.kind) + '</td>' +
          '<td>' + esc(r.channels.join(', ') || '—') + '</td>' +
          '<td class="tp">' + esc(r.topic.slice(0, 80) || '—') + '</td>' +
          '<td>' + (r.status === 'done' ? 'โพสต์แล้ว' : (r.status === 'skip' ? 'ไม่โพสต์' : 'ยังไม่โพสต์')) +
          (r.url ? ' · มีลิงก์' : '') + '</td></tr>';
      }).join('');
      body.innerHTML =
        '<div class="grid2"><div class="field"><label class="label">เพจ</label>' +
        '<select class="select" id="pgSel">' + pageOptions(st.pageId) + '</select></div>' +
        '<div class="field"><label class="label">เดือนของตาราง</label>' +
        '<input class="input" type="month" id="moSel" value="' + esc(st.month) + '"></div></div>' +
        '<div class="field" style="margin-top:14px"><label class="label">คอลัมน์ในไฟล์คืออะไร <small>แก้ได้ถ้าเดาผิด</small></label>' +
        '<div class="mapgrid">' + cols + '</div></div>' +
        '<div class="pv-sum"><b>' + ok.length + '</b> แถวพร้อมบันทึก' +
        (bad.length ? ' · <span class="bad">' + bad.length + ' แถวข้าม</span>' : '') +
        (recs.length > 60 ? ' · แสดง 60 แถวแรก' : '') + '</div>' +
        '<div class="pvwrap"><table class="pvtable"><thead><tr><th>#</th><th>วัน/เวลา</th><th>เพจ</th><th>ชนิด</th>' +
        '<th>ช่องทาง</th><th>หัวข้อ</th><th>สถานะ</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' +
        '<div class="acts" style="margin-top:14px"><button type="button" class="btn" id="saveBtn"' +
        (ok.length ? '' : ' disabled') + '>บันทึกเข้าตาราง ' + ok.length + ' แถว</button>' +
        '<button type="button" class="btn-ghost" id="backBtn">วางใหม่</button>' +
        '<button type="button" class="btn-ghost" data-close>ยกเลิก</button></div>';
      $('#pgSel', body).addEventListener('change', function () { st.pageId = this.value; drawPreview(); });
      $('#moSel', body).addEventListener('change', function () { st.month = this.value || st.month; drawPreview(); });
      $('#backBtn', body).addEventListener('click', function () { stepPaste(); });
      $$('[data-mapc]', body).forEach(function (sel) {
        sel.addEventListener('change', function () {
          st.map[Number(this.getAttribute('data-mapc'))] = this.value;
          drawPreview();
        });
      });
      var save = $('#saveBtn', body);
      if (save) save.addEventListener('click', function () { doSave(ok, this); });
    }

    /* เทียบกับของเดิมในช่วงวันเดียวกันก่อน แถวไหนซ้ำ (เพจ+วัน+เวลา) ให้ทับ ไม่เพิ่มใหม่ */
    function doSave(recs, btn) {
      btn.disabled = true;
      var was = btn.textContent;
      btn.textContent = 'กำลังบันทึก…';
      var dates = recs.map(function (r) { return r.date; }).sort();
      api('/posts?from=' + dates[0] + '&to=' + dates[dates.length - 1]).then(function (j) {
        var byKey = {}, bySlot = {};
        (j.posts || []).forEach(function (p) {
          byKey[p.pageId + '|' + p.date + '|' + (p.time || '') + '|' + topicKey(p.topic)] = p.id;
          var slot = p.pageId + '|' + p.date + '|' + (p.time || '');
          bySlot[slot] = bySlot[slot] ? 'many' : p.id;
        });
        var taken = {}, nUp = 0;
        var payload = recs.map(function (r) {
          var k = r.pageId + '|' + r.date + '|' + (r.time || '') + '|' + topicKey(r.topic);
          var slot = r.pageId + '|' + r.date + '|' + (r.time || '');
          var id = byKey[k] || (bySlot[slot] && bySlot[slot] !== 'many' ? bySlot[slot] : null);
          if (id && taken[id]) id = null;
          if (id) { taken[id] = 1; nUp++; }
          return {
            id: id || undefined, pageId: r.pageId, date: r.date, time: r.time, channels: r.channels,
            topic: r.topic, kind: r.kind, status: r.status, url: r.url, note: r.note,
            postedAt: r.status === 'done' ? nowIsoLocal() : null
          };
        });
        var chunks = [], nBlank = 0;
        for (var i = 0; i < payload.length; i += 150) chunks.push(payload.slice(i, i + 150));
        return chunks.reduce(function (pr, c) {
          return pr.then(function () {
            return api('/posts', 'POST', { posts: c }).then(function (j) { nBlank += (j && j.blank) || 0; });
          });
        }, Promise.resolve()).then(function () { return { nUp: nUp, n: payload.length, nBlank: nBlank }; });
      }).then(function (res) {
        close();
        S.posts = null;
        okDialog({
          title: 'อัปเดตตารางโพสต์แล้ว',
          lines: [
            'รับเข้า ' + (res.n - res.nBlank) + ' แถว',
            res.nUp ? 'ทับของเดิม ' + res.nUp + ' แถว · เพิ่มใหม่ ' + Math.max(0, res.n - res.nBlank - res.nUp) + ' แถว' : 'เพิ่มใหม่ทั้งหมด',
            'เพจ ' + pageName(st.pageId) + ' · เดือน ' + st.month
          ].concat(res.nBlank ? ['ข้ามแถวที่ไม่มีหัวข้อ ' + res.nBlank + ' แถว'] : []),
          note: 'แถวที่มีลิงก์ ระบบนับว่าโพสต์แล้วให้เลย',
          onClose: renderPosts
        });
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = was;
        toast(e.message, true);
      });
    }

    stepPaste();
  }
  function nowIsoLocal() { return new Date().toISOString(); }

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
    var pick = function (j) { return (j.posts || []).filter(function (x) { return x.id === id; })[0]; };
    api('/posts' + qs).then(function (j) {
      var post = pick(j);
      if (post) { openPostForm(post); return; }
      /* กดมาจากประวัติ โพสต์อาจอยู่นอกเดือนหรือนอกเพจที่กำลังดูอยู่ — หาทั้งระบบอีกรอบ */
      return api('/posts?from=1900-01-01&to=2999-12-31').then(function (j2) {
        var p2 = pick(j2);
        if (!p2) { toast('ไม่พบโพสต์นี้แล้ว', true); renderPosts(); return; }
        openPostForm(p2);
      });
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
    var h = '<div class="top"><div><span class="kicker">ทีม + สิทธิ์</span><h1>ทีมงานและสิทธิ์เข้าถึง</h1>' +
      '<p>ทุกคนเข้าระบบด้วยอีเมลกับรหัสผ่านของตัวเอง ' + (owner ? 'ติ๊กได้ว่าใครเห็นหมวดไหน · หัวหน้าเห็นทุกหมวดเสมอ · "ชื่อเรียกใน @" คือคำที่ใช้พิมพ์ตอนสั่งงาน เช่น @Title' : 'เปลี่ยนอีเมลกับรหัสผ่านของคุณได้ด้านล่าง') + '</p></div>' +
      (owner ? '<div class="top-r"><label class="label" style="margin:0 8px 0 0">ดูระบบในมุมของ</label>' +
        '<select class="select" id="viewAsSel" style="width:auto;min-width:180px"><option value="">— ตัวเอง (หัวหน้า) —</option>' +
        S.staff.filter(function (x) { return x.active && x.id !== S.me.id; }).map(function (x) {
          return '<option value="' + esc(x.id) + '"' + (S.viewAs === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>';
        }).join('') + '</select></div>' : '') + '</div>' +
      (S.viewAs ? '<div class="postbar warn">กำลังดูเมนูในมุมของ <b>' + esc((staffById(S.viewAs) || {}).name || '') +
        '</b> — เห็นเฉพาะหมวดที่เขามีสิทธิ์ <button type="button" class="btn-text" data-viewas-off>เลิกดู</button></div>' : '');
    h += '<div class="two"><div class="sec"><div class="sec-h"><h2>สมาชิก</h2><p>' + S.staff.filter(function (s) { return s.active; }).length + ' คนใช้งานอยู่</p></div><div class="sec-b tight">' +
      S.staff.map(function (s) {
        return '<div class="team-row' + (s.active ? '' : ' off') + '">' + avatar(s, 'lg') + '<div class="n"><b>' + esc(s.name) + (s.role === 'owner' ? ' <span class="pill doing" style="margin-left:6px">หัวหน้า</span>' : '') + (s.active ? '' : ' <span class="pill todo">ปิดใช้งาน</span>') +
          (s.hasPassword ? '' : ' <span class="pill late">ยังไม่ตั้งรหัส</span>') + '</b>' +
          '<small>' + (s.email ? esc(s.email) : 'ยังไม่มีอีเมล') + ' · @' + esc(s.aliases || shortName(s)) + '</small>' +
          '<div class="secchips">' + (s.role === 'owner'
            ? '<span class="pill doing">เห็นทุกหมวด</span>'
            : SECTION_LIST.map(function (sc) {
                var on = (s.sections || []).indexOf(sc[0]) !== -1;
                return '<button type="button" class="chip plain' + (on ? ' on' : '') + '"' +
                  (owner ? ' data-sec-staff="' + esc(s.id) + '" data-sec="' + sc[0] + '" data-to="' + (on ? '0' : '1') + '"' : ' disabled') +
                  ' title="' + esc(sc[1]) + '">' + esc(SECTION_SHORT[sc[0]]) + '</button>';
              }).join('')) + '</div></div>' +
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
        '<div class="field"><label class="label">ระดับ</label><select class="select" name="role"><option value="member">สมาชิก</option><option value="owner">หัวหน้า</option></select></div></div>' +
        '<div class="field"><label class="label">เห็นหมวดไหนได้บ้าง <small>หัวหน้าเห็นทุกหมวดอยู่แล้ว</small></label>' +
        '<div class="chips" id="newSecs">' + SECTION_LIST.map(function (sc) {
          var on = sc[0] === 'tasks' || sc[0] === 'docs';
          return '<button type="button" class="chip plain' + (on ? ' on' : '') + '" data-newsec="' + sc[0] + '" title="' + esc(sc[1]) + '">' + esc(SECTION_SHORT[sc[0]]) + '</button>';
        }).join('') + '</div></div>' +
        '<div class="acts"><button type="submit" class="btn">เพิ่มคน</button></div></form></div></div>';
    }
    h += '<div class="sec"><div class="sec-h"><h2>อีเมลและรหัสผ่านของฉัน</h2></div><div class="sec-b"><form id="myPw" style="display:grid;gap:12px">' +
      '<div class="field"><label class="label">รหัสผ่านปัจจุบัน</label><input class="input" name="password" type="password" autocomplete="current-password" required></div>' +
      '<div class="grid2"><div class="field"><label class="label">อีเมล <small>เว้นว่างถ้าไม่เปลี่ยน</small></label><input class="input" name="email" type="email" placeholder="' + esc(S.me.email || 'you@example.com') + '"></div>' +
      '<div class="field"><label class="label">รหัสผ่านใหม่ <small>เว้นว่างถ้าไม่เปลี่ยน</small></label><input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="8"></div></div>' +
      '<div class="acts"><button type="submit" class="btn-ghost">บันทึก</button></div></form></div></div>';
    /* MCP: ให้ AI (Claude / ChatGPT) สั่งงาน-สรุปงานผ่านระบบนี้ได้ · token รายคน ผูกกับสิทธิ์ของคนนั้น */
    var tokenRows = S.staff.filter(function (x) { return x.active && (owner || x.id === S.me.id); });
    h += '<div class="sec" id="mcpBox"><div class="sec-h"><h2>ต่อกับ Claude / ChatGPT (MCP)</h2><p>ให้ AI สรุปงานวันนี้ สั่งงานจากโน้ต หรืออัปเดตตารางโพสต์แทนได้</p></div><div class="sec-b">' +
      '<p class="hint" style="margin:0 0 12px">สร้าง token แล้วก็อป URL ไปใส่ใน Claude (Settings → Connectors → Add custom connector) หรือ ChatGPT (Settings → Connectors → Create) · ' +
      'ใครใช้ token ของใคร AI ก็ทำได้เท่าที่คนนั้นเห็นในระบบ · token ใช้ได้จนกว่าจะกดยกเลิก</p>' +
      tokenRows.map(function (x) {
        var url = x.mcpToken ? (location.origin + '/mcp/' + x.mcpToken) : '';
        return '<div class="mcprow"><div class="n"><b>' + esc(x.name) + '</b>' +
          (url ? '<code class="mcpurl" title="กดเพื่อก็อป" data-copy="' + esc(url) + '">' + esc(url) + '</code>' : '<small>ยังไม่มี token</small>') + '</div>' +
          '<div class="acts">' + (url
            ? '<button type="button" class="btn-ghost sm" data-copy="' + esc(url) + '">ก็อป URL</button>' +
              '<button type="button" class="btn-ghost sm" data-token-new="' + esc(x.id) + '">ออกใหม่</button>' +
              '<button type="button" class="btn-ghost sm danger" data-token-del="' + esc(x.id) + '">ยกเลิก</button>'
            : '<button type="button" class="btn-ghost sm" data-token-new="' + esc(x.id) + '">สร้าง token</button>') + '</div></div>';
      }).join('') +
      '<details class="mcphelp"><summary>วิธีเอาไปใส่</summary><ol>' +
      '<li><b>Claude (claude.ai)</b> Settings → Connectors → Add custom connector → วาง URL → Add · ไม่ต้องใส่ OAuth</li>' +
      '<li><b>ChatGPT</b> Settings → Connectors → Create → วาง URL → Authentication เลือก No authentication</li>' +
      '<li><b>Claude Code</b> พิมพ์ในเทอร์มินัล <code>claude mcp add --transport http kan URL</code></li>' +
      '</ol><p class="hint">ลองพิมพ์ว่า "สรุปงานวันนี้ของทีม" หรือวางโน้ตแล้วบอกว่า "แตกเป็นงานให้ทีม" AI จะเรียก get_context ก่อนแล้วค่อยสร้างงาน</p></details>' +
      '</div></div>';
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
        '<article><span class="l">รูปในปฏิทินการตลาด</span><b>' + st.campaignFiles + '</b><small>ของเดิมในฐานข้อมูลเดียวกัน</small></article>' +
        '<article' + (pct > 70 ? ' class="warn"' : '') + '><span class="l">ใช้ไปแล้ว</span><b>' + mb(used) + '</b><small>จาก ' + mb(lim) + ' ของแพ็กฟรี</small></article>' +
        '<article><span class="l">เติมได้อีกราว</span><b>' + (left === null ? '—' : left.toLocaleString('th-TH')) + '</b><small>รูป ถ้าขนาดเฉลี่ยเท่าเดิม</small></article></div>' +
        '<div class="subbar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<p class="hint" style="margin-top:10px">รูปเก็บใน Cloudflare D1 ฐานเดียวกับปฏิทินการตลาด ไม่ได้ฝากไว้ที่อื่น · ' +
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
      var secs = $$('#newSecs .chip.on').map(function (b) { return b.getAttribute('data-newsec'); });
      api('/staff', 'POST', { name: who, aliases: f.aliases.value, pin: code, role: f.role.value, email: f.email.value.trim() || null, sections: secs })
        .then(function () { return refreshMe(); })
        .then(function () {
          okDialog({
            title: 'เพิ่ม ' + who + ' เข้าทีมแล้ว',
            lines: ['รหัสตั้งค่าของเขาคือ ' + code,
                    'เห็นได้: ' + (f.role.value === 'owner' ? 'ทุกหมวด (หัวหน้า)' : (secs.map(function (k) { return SECTION_SHORT[k]; }).join(' · ') || 'ยังไม่เปิดหมวดไหนเลย')),
                    'ให้เขาเข้า admin.kan-hub.com/tasks/ แล้วกดแท็บ "ตั้งรหัสครั้งแรก"'],
            note: 'รหัสนี้ใช้ได้ครั้งเดียว พอเขาตั้งรหัสผ่านเองแล้วจะใช้ไม่ได้อีก',
            onClose: renderTeam,
          });
        }).catch(function (e) { toast(e.message, true); });
    });
    var vsel = $('#viewAsSel');
    if (vsel) vsel.addEventListener('change', function () {
      S.viewAs = this.value || null;
      renderSidebar(); renderHeaderUser(); renderTeam();
    });
    view.addEventListener('click', function (ev) {
      var b;
      if ((b = ev.target.closest('[data-sec-staff]'))) {
        var sid = b.getAttribute('data-sec-staff'), key = b.getAttribute('data-sec');
        var who2 = staffById(sid);
        var cur = (who2.sections || []).slice();
        var idx = cur.indexOf(key);
        if (idx === -1) cur.push(key); else cur.splice(idx, 1);
        b.disabled = true;
        api('/staff/' + sid, 'PUT', { sections: cur })
          .then(refreshMe)
          .then(function () {
            toast((idx === -1 ? 'เปิด' : 'ปิด') + 'สิทธิ์ ' + SECTION_SHORT[key] + ' ให้ ' + shortName(who2) + ' แล้ว');
            renderTeam();
          })
          .catch(function (e) { b.disabled = false; toast(e.message, true); });
        return;
      }
      if (ev.target.closest('[data-viewas-off]')) { S.viewAs = null; renderSidebar(); renderHeaderUser(); renderTeam(); return; }
      if ((b = ev.target.closest('[data-copy]'))) {
        var txt = b.getAttribute('data-copy');
        var done = function () { toast('ก็อป URL แล้ว เอาไปวางใน Claude / ChatGPT ได้เลย'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { prompt('ก็อป URL นี้', txt); });
        else prompt('ก็อป URL นี้', txt);
        return;
      }
      if ((b = ev.target.closest('[data-token-new]'))) {
        var tsid = b.getAttribute('data-token-new'), tst = staffById(tsid);
        if (tst.mcpToken && !confirm('ออก token ใหม่ให้ ' + tst.name + '? URL เดิมจะใช้ไม่ได้ทันที')) return;
        api('/staff/' + tsid + '/token', 'POST').then(function (j) {
          return refreshMe().then(function () {
            okDialog({
              title: 'สร้าง token ให้ ' + tst.name + ' แล้ว',
              lines: [location.origin + '/mcp/' + j.token],
              note: 'ก็อป URL นี้ไปใส่ใน Claude หรือ ChatGPT · AI จะทำได้เท่าที่ ' + shortName(tst) + ' เห็นในระบบ',
              onClose: renderTeam,
            });
          });
        }).catch(function (e) { toast(e.message, true); });
        return;
      }
      if ((b = ev.target.closest('[data-token-del]'))) {
        var dsid = b.getAttribute('data-token-del'), dst = staffById(dsid);
        if (!confirm('ยกเลิก token ของ ' + dst.name + '? Claude/ChatGPT ที่ต่ออยู่จะใช้ไม่ได้ทันที')) return;
        api('/staff/' + dsid + '/token', 'DELETE').then(refreshMe).then(function () { toast('ยกเลิก token ของ ' + shortName(dst) + ' แล้ว'); renderTeam(); })
          .catch(function (e) { toast(e.message, true); });
        return;
      }
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
      case 'kpi': return canSee('kpi') ? renderKpi() : denyView('KPI 2570');
      case 'inbox': return renderInbox();
      case 'posts': return renderPosts();
      case 'team': return S.me.role === 'owner' || S.me.sections ? renderTeam() : denyView('ทีม + สิทธิ์');
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
        loadCampaigns().then(render);
      }).catch(function (e) { renderSidebar(); renderLogin(e.message); });
  }

  /* ---------- global events ---------- */
  document.addEventListener('click', function (ev) {
    var b;
    if ((b = ev.target.closest('.cchip[data-cc]'))) { ev.preventDefault(); location.href = CAL_URL + '#c=' + b.getAttribute('data-cc'); return; }
    if (ev.target.closest('[data-erp-toggle]')) { document.documentElement.classList.toggle('erp-open'); return; }
    if (ev.target.closest('[data-erp-close]')) { document.documentElement.classList.remove('erp-open'); return; }
    if (document.documentElement.classList.contains('erp-open') && ev.target.closest('.erp-sidebar a')) document.documentElement.classList.remove('erp-open');
    if ((b = ev.target.closest('[data-theme-pick]'))) { setTheme(b.getAttribute('data-theme-pick')); return; }
    if (ev.target.closest('[data-theme-toggle]')) { setTheme(isDark() ? 'light' : 'dark'); return; }
    if ((b = ev.target.closest('[data-edit-upd]'))) {
      var eu = b.getAttribute('data-edit-upd');
      var box = document.querySelector('.tl-i[data-upd="' + eu + '"]');
      if (!box || box.querySelector('.tl-ed')) return;
      var noteEl = box.querySelector('[data-note]');
      var raw = (S.taskUpdRaw && S.taskUpdRaw[eu]) || (noteEl ? noteEl.textContent : '');
      var ed = document.createElement('div');
      ed.className = 'tl-ed';
      ed.innerHTML = '<textarea class="textarea" data-rich rows="3"></textarea>' +
        '<div class="acts"><button type="button" class="btn sm" data-upd-save>บันทึก</button>' +
        '<button type="button" class="btn-ghost sm" data-upd-cancel>ยกเลิก</button></div>';
      if (noteEl) { noteEl.style.display = 'none'; noteEl.parentNode.insertBefore(ed, noteEl.nextSibling); }
      else { box.querySelector('div:last-child').appendChild(ed); }
      var ta = ed.querySelector('textarea');
      ta.value = raw;
      wireTyping(ed);
      ta.focus();
      ed.querySelector('[data-upd-cancel]').addEventListener('click', function () {
        ed.remove(); if (noteEl) noteEl.style.display = '';
      });
      ed.querySelector('[data-upd-save]').addEventListener('click', function () {
        var btn = this; btn.disabled = true;
        api('/updates/' + eu, 'PUT', { note: ta.value })
          .then(function () { toast('แก้ข้อความแล้ว'); S.tasks = null; render(); })
          .catch(function (e) { btn.disabled = false; toast(e.message, true); });
      });
      return;
    }
    if ((b = ev.target.closest('[data-del-upd]'))) {
      var uid = b.getAttribute('data-del-upd');
      if (!confirm('ลบความคืบหน้ารายการนี้? รูปที่แนบมาด้วยจะหายไปด้วย')) return;
      b.disabled = true;
      api('/updates/' + uid, 'DELETE')
        .then(function () { toast('ลบความคืบหน้าแล้ว'); S.tasks = null; render(); })
        .catch(function (e) { b.disabled = false; toast(e.message, true); });
      return;
    }
    if (ev.target.closest('[data-viewas-off]')) { S.viewAs = null; render(); return; }
    if (ev.target.closest('[data-logout]')) {
      fetch(API + '/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { S.me = null; S.tasks = null; renderSidebar(); renderLogin(); });
      return;
    }
    if (ev.target.closest('[data-toggle-done]')) { S.showDone = !S.showDone; renderMe(); return; }
    if ((b = ev.target.closest('.cards article[data-p]'))) { P.status = b.getAttribute('data-p'); renderPosts(); return; }
    if ((b = ev.target.closest('.tbar [data-p], .fchip[data-p], .ptab[data-p], tr.prow[data-p]'))) {
      var pk = b.getAttribute('data-p');
      /* กำลังพิมพ์ในตารางอยู่แล้วสลับตัวกรอง — ต้องยิงที่ค้างให้เสร็จก่อน ไม่งั้นที่พิมพ์หาย */
      if (typeof gridFlush === 'function') gridFlush();
      P[pk] = b.getAttribute('data-v');
      if (pk === 'view') {
        P.day = '';
        try { localStorage.setItem('kan-posts-view', P.view); } catch (e) {}
      }
      renderPosts(); return;
    }
    if ((b = ev.target.closest('[data-mon]'))) {
      var step = Number(b.getAttribute('data-mon'));
      var m0 = curMonth();
      P.month = step === 0 ? null : (function () {
        var x = new Date(m0.getFullYear(), m0.getMonth() + step, 1);
        return x.getFullYear() + '-' + pad(x.getMonth() + 1);
      }());
      P.day = '';
      renderPosts(); return;
    }
    if ((b = ev.target.closest('[data-day]'))) {
      var dv = b.getAttribute('data-day');
      P.day = (P.day === dv) ? '' : dv;
      renderPosts(); return;
    }
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
    if (ev.target.closest('[data-f-clear]')) { F.who = ''; F.kpi = ''; F.status = 'open'; F.campaign = ''; renderAll(); return; }
    if ((b = ev.target.closest('.tbar [data-f], .fpanel [data-f], .factive [data-f], .hidden-note [data-f]'))) {
      F[b.getAttribute('data-f')] = b.getAttribute('data-v'); renderAll(); return;
    }
    if (ev.target.id === 'parseBtn') {
      syncDraftsFromDom();
      var parsed = parseCommand($('#cmdText').value);
      if (!parsed.length) { toast('ยังไม่มีข้อความ หรืออ่านไม่ออก — ลองใส่ @ชื่อ', true); return; }
      var preset = (S.route.query || {}).campaign || '';
      if (preset) parsed.forEach(function (d) { d.campaignId = preset; });
      drafts = drafts.concat(parsed);
      $('#cmdText').value = '';
      renderDrafts();
      toast('แยกได้ ' + parsed.length + ' งาน ตรวจแล้วกดบันทึก');
      return;
    }
    if (ev.target.id === 'blankBtn') { syncDraftsFromDom(); drafts.push({ title: '', detail: '', assignees: [], dueAt: null, repeat: '', kpiId: null, priority: 0, campaignId: (S.route.query || {}).campaign || null }); renderDrafts(); return; }
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
