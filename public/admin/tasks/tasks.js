/* ============================================================
   KAN Admin — งานทีม (Task) · SPA (hash route) คุยกับ /api/t/* ใน worker.js
   หน้า: #/me งานของฉัน · #/all งานทั้งหมด · #/new สั่งงาน (วางข้อความ) ·
         #/task/:id รายละเอียด+อัปเดต+ไฟล์แนบ · #/kpi KPI 2570 · #/team ทีม+สิทธิ์ · #/inbox กระดิ่ง
   ============================================================ */
(function (global) {
  'use strict';

  var API = '/api/t';
  var S = { me: null, staff: [], kpis: [], tasks: null, leads: null, pages: null, campaigns: null, notif: { unread: 0, items: [] }, route: { name: 'me' }, viewAs: null, seq: [], seqFrom: '#/all' };

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

  var STATUS_TH = { todo: 'รอทำ', doing: 'กำลังทำ', review: 'รอตรวจ', done: 'เสร็จแล้ว', blocked: 'ติดปัญหา' };
  /* งานรูทีน = ทำประจำ · งานตามสั่ง = สั่งเพิ่มเป็นครั้ง ๆ (ค่าเริ่มต้น) */
  var KIND_KEYS = ['ondemand', 'routine'];
  var KIND_TH = { ondemand: 'ตามสั่ง', routine: 'รูทีน' };

  /* ประเภทงาน — คีย์ต้องตรงกับ TASK_TYPES ใน worker-tasks.js
     งานเก่าที่สั่งไว้ก่อนมีช่องนี้จะถูกอ่านเป็น "อื่น ๆ" */
  var TASK_TYPE_KEYS = ['signage', 'content', 'campaign', 'newlot', 'lineoa', 'other'];
  var TASK_TYPE_TH = { signage: 'ป้าย', content: 'คอนเทนต์', campaign: 'แคมเปญ', newlot: 'ล็อตใหม่', lineoa: 'LINE OA', other: 'อื่น ๆ' };
  /* เดาประเภทจากข้อความตอนวางจากแชต — เดาผิดก็แก้ในตารางได้ ไม่ได้บังคับ
     เรียงตามลำดับ: ป้ายมาก่อนแคมเปญ เพราะ "ป้ายโปรโมชัน" เข้าเงื่อนไขทั้งคู่
     (คีย์ในฐานข้อมูลยังเป็น signage เหมือนเดิม เปลี่ยนแค่ชื่อที่โชว์ งานเก่าไม่กระทบ) */
  var TASK_TYPE_HINT = [
    /* LINE OA มาก่อนคอนเทนต์/แคมเปญ เพราะ "บรอดแคสต์โปรทาง LINE" เข้าเงื่อนไขได้ทั้งสามอัน */
    ['lineoa', /line\s*oa|ไลน์\s*โอเอ|บรอดแคสต์|บอร์ดแคส|broadcast|ริชเมนู|rich\s*menu|แบนเนอร์ไลน์|ไลน์แอด(?!ส์)|ยิงไลน์|ส่งไลน์/i],
    ['newlot', /ล็อตใหม่|ลอตใหม่|สินค้าเข้า|ของเข้า|new\s*lot|new\s*arrival|คอลเลคชั่นประจำเดือน/i],
    ['signage', /ป้าย|signage|signmate|บิลบอร์ด|billboard|โปสเตอร์|standee|สแตนดี|แบนเนอร์|banner|บูธ|booth|จอ(?!ง)|ตกแต่งร้าน|วิชวล/i],
    ['content', /คอนเทนต์|content|โพสต์|โพส|post|คลิป|วิดีโอ|video|reel|tiktok|ถ่ายภาพ|ถ่ายรูป|กราฟิก|อาร์ตเวิร์ก|artwork|แคปชัน|เพจ/i],
    ['campaign', /แคมเปญ|campaign|โปรโมชั่น|โปรโมชัน|promotion|promo|ลดราคา|เซล|sale|อีเวนต์|event|ออกบูธ|เปิดตัว|launch|ontour|on tour/i]
  ];
  function guessTaskType(text) {
    var t = String(text || '');
    for (var i = 0; i < TASK_TYPE_HINT.length; i++) if (TASK_TYPE_HINT[i][1].test(t)) return TASK_TYPE_HINT[i][0];
    return '';
  }
  var REPEAT_OPTS = [['', 'ครั้งเดียว'], ['daily', 'ทุกวัน'], ['weekly', 'ทุกสัปดาห์'], ['monthly', 'ทุกเดือน']];
  /* งานป้าย 6 ขั้น — ต้องตรงกับ SIGN_STAGES ใน worker */
  var SIGN_STAGES = [['design', 'ออกแบบ'], ['approved', 'แบบเสร็จ'], ['sent', 'ส่งโรงพิมพ์'], ['produced', 'ผลิต'], ['arrived', 'ของถึงสาขา'], ['installed', 'ติดตั้ง']];
  var SIGN_KEYS = SIGN_STAGES.map(function (x) { return x[0]; });
  var SIGN_TH = {}; SIGN_STAGES.forEach(function (x) { SIGN_TH[x[0]] = x[1]; });
  function signStageIdx(k) { return SIGN_KEYS.indexOf(k); }
  /* ขั้นงาน (flow) ตั้งเองได้ต่อประเภท — โหลดจาก /flows แล้วอัปเดตชุด SIGN_* ให้หน้างานป้ายใช้ต่อได้ */
  S.flows = null;
  function loadFlows(force) {
    if (S.flows && !force) return Promise.resolve(S.flows);
    return api('/flows').then(function (j) { applyFlows(j.flows || {}); return S.flows; })
      .catch(function () { S.flows = S.flows || {}; return S.flows; });
  }
  function applyFlows(flows) {
    S.flows = flows || {};
    var sg = S.flows.signage;
    if (sg && sg.length) {
      SIGN_STAGES = sg.map(function (x) { return [x.k, x.th]; });
      SIGN_KEYS = SIGN_STAGES.map(function (x) { return x[0]; });
      SIGN_TH = {}; SIGN_STAGES.forEach(function (x) { SIGN_TH[x[0]] = x[1]; });
    }
  }
  function flowOf(type) { return (S.flows && S.flows[type]) || []; }
  /* ขั้นปัจจุบันของงานหลัก = ขั้นแรกที่ยังไม่เสร็จ · null = ไม่มีขั้น · 'done' = ครบทุกขั้น */
  function stageSubs(t) { return (S.tasks || []).filter(function (x) { return x.parentId === t.id && x.stage; }); }
  function plainSubs(t) { return (S.tasks || []).filter(function (x) { return x.parentId === t.id && !x.stage; }); }
  function currentStage(t, flow) {
    var subs = stageSubs(t);
    if (!subs.length) return null;
    var byK = {}; subs.forEach(function (x) { byK[x.stage] = x; });
    for (var i = 0; i < flow.length; i++) { var x = byK[flow[i].k]; if (!x || effStatus(x) !== 'done') return flow[i].k; }
    return 'done';
  }
  function repeatLabel(v) {
    for (var i = 0; i < REPEAT_OPTS.length; i++) if (REPEAT_OPTS[i][0] === (v || '')) return REPEAT_OPTS[i][1];
    return '';
  }
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
  /* ตัวตนที่ใช้ตัดสินสิทธิ์ — โหมด "ดูในมุมของ" จะกลายเป็นอ่านอย่างเดียว */
  function amOwner() { return !S.viewAs && S.me && S.me.role === 'owner'; }
  function readOnly() { return !!S.viewAs; }
  /* ตรวจผ่าน = หัวหน้าคนเดียว (นนท์ 21 ก.ย. 69) — คนสั่งงานตรวจงานที่ตัวเองสั่งไม่ได้แล้ว
     ส่วน canEditRow (แก้/ลบ) ยังเป็นของหัวหน้าหรือคนสั่งเหมือนเดิม คนละเรื่องกัน */
  function canApprove() { return !readOnly() && !!S.me && S.me.role === 'owner'; }
  function mineTask(t) { return S.me && t.assignees.indexOf(S.me.id) !== -1; }
  /* แก้/ลบ จากหน้ารายการ: หัวหน้าหรือคนสั่งงาน (เหมือนสิทธิ์แก้ไขในหน้ารายละเอียด) */
  function canEditRow(t) { return !readOnly() && S.me && (S.me.role === 'owner' || t.createdBy === S.me.id); }
  function canTick(t) {
    if (readOnly()) return false;
    return canApprove(t) || mineTask(t) || (S.me && S.me.canUpdateOthers);
  }
  /* แก้กำหนดส่งจากแถว: หัวหน้า/คนสั่งแก้ได้เสมอ · คนรับใส่วันให้งานที่ยังไม่มีวันได้ · เลื่อนวันที่มีแล้วต้องมี can_reschedule */
  /* เปลี่ยนคนรับผิดชอบ — ทุกคนในทีมทำได้ (นนท์ 20 ก.ย. 69) */
  function canAssign() { return !readOnly() && !!S.me; }
  function canDue(t) {
    if (readOnly() || !S.me) return false;
    if (canEditRow(t)) return true;
    if (!(mineTask(t) || S.me.canUpdateOthers)) return false;
    return !t.dueAt || !!S.me.canReschedule;
  }
  function taskById(id) { return (S.tasks || []).filter(function (x) { return x.id === id; })[0] || null; }
  var DOW_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  function workDaysLabel(s2) {
    if (!s2.workDays) return 'ยังไม่ตั้งวันทำงาน';
    var d = String(s2.workDays).split(',').filter(function (x) { return x !== ''; }).map(Number);
    return d.map(function (n) { return DOW_TH[n]; }).join(' ') + (s2.hoursPerDay ? ' · ' + s2.hoursPerDay + ' ชม./วัน' : '');
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
  /* ป้ายประเภทงาน — งานเก่าที่สั่งไว้ก่อนมีช่องนี้เป็น other ไม่ต้องโชว์ ไม่งั้นรกทั้งหน้า */
  function typeChip(v) {
    if (!v || v === 'other') return '';
    return '<span class="ttype" data-t="' + esc(v) + '">' + esc(TASK_TYPE_TH[v] || v) + '</span>';
  }
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function sameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }
  function startOfWeek(d) { var x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function sameWeek(a, b) { return startOfWeek(a).getTime() === startOfWeek(b).getTime(); }
  function sameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }

  /* งานประจำ "เสร็จ" ได้แค่ในรอบของมัน — ขึ้นวันใหม่ (หรือสัปดาห์ใหม่) ต้องกลับมาเป็นรอทำเอง
     ไม่งั้นกดเสร็จวันเดียวแล้วงานประจำหายไปตลอดกาล ทั้งที่ทีมต้องอัปเดตทุกวัน */
  function effStatus(t) {
    if (!t.repeat || t.status !== 'done') return t.status;
    if (t.doneAt) {
      var d = new Date(t.doneAt), now = new Date();
      if (t.repeat === 'daily' && sameDay(d, now)) return 'done';
      if (t.repeat === 'weekly' && sameWeek(d, now)) return 'done';
      if (t.repeat === 'monthly' && sameMonth(d, now)) return 'done';
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
    if (t.repeat === 'weekly' || t.repeat === 'monthly') return false;
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
    if (t.repeat === 'monthly') return 'ทุกเดือน' + (t.dueAt ? ' วันที่ ' + new Date(t.dueAt).getDate() + ' ' + fmtTime(new Date(t.dueAt)) : '');
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
  /* toast ที่มีปุ่ม "เลิกทำ" — นนท์กดปิดงานผิดแล้วหาทางกลับไม่เจอ (18 ก.ย. 69)
     ค้างไว้ 8 วิ ให้ทันกด · กดแล้วเรียก undo() ที่ส่งมา */
  function toastUndo(msg, undo) {
    var el = $('#toast');
    el.innerHTML = esc(msg) + ' <button type="button" class="tundo">เลิกทำ</button>';
    el.className = 'toast';
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 8000);
    var b = el.querySelector('.tundo');
    b.addEventListener('click', function () {
      b.disabled = true;
      clearTimeout(toastTimer);
      Promise.resolve(undo()).then(function () { el.hidden = true; })
        .catch(function (e) { toast(e.message, true); });
    });
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
  var ROUTE_KEY = { routine: '#/routine', history: '#/history', review: '#/review', leads: '#/leads', lead: '#/leads', me: '#/all', all: '#/all', new: '#/all', kpi: '#/kpi', team: '#/team', task: '#/all', inbox: '#/inbox', posts: '#/posts', report: '#/report', campaign: '#/all', signage: '#/signage', blast: '#/blast', richmenu: '#/richmenu', lineusers: '#/lineusers', blastsetup: '#/blastsetup' };
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
    ['kpi',   'KPI 2570 + KPI Dashboard'],
    ['crm',   'ลีด (CRM) — ฝ่ายขายที่ดูแค่ลีด ให้ติ๊กอันนี้อันเดียว'],
    ['blast', 'บรอดแคสต์ LINE OA + SMS — ยิงถึงลูกค้าจริง เปิดให้เฉพาะคนที่ดูแลเพจ']
  ];
  var SECTION_SHORT = { tasks: 'งานทีม', docs: 'เอกสาร', sales: 'ยอดขาย', kpi: 'KPI', crm: 'ลีด', blast: 'บรอดแคสต์' };
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
    el.innerHTML = '<span class="tour-wrap"><button type="button" class="tour-btn" data-tour title="พาทัวร์ระบบ">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg><span>พาทัวร์</span></button>' +
      '<div class="tour-menu" id="tourMenu" hidden></div></span>' +
      '<a class="bell' + (S.notif.unread ? ' on' : '') + '" href="#/inbox" title="คนแท็กถึงคุณ">' +
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
  /* ปุ่ม "พาทัวร์": ให้เลือกทัวร์ของหน้าที่เปิดอยู่ (ถ้ามี) หรือภาพรวมทั้งระบบ — เนื้อหาทัวร์อยู่ใน tour.js */
  var PAGE_TOUR = { me: 'all', all: 'all', new: 'new', task: 'task', posts: 'posts', kpi: 'kpi', team: 'team', review: 'review', leads: 'leads', lead: 'leads',
                    report: 'report', signage: 'signage', history: 'history', campaign: 'calendar', inbox: 'overview' };
  function toggleTourMenu() {
    var m = $('#tourMenu'), T = global.KAN_TOUR;
    if (!m || !T) return;
    if (!m.hidden) { m.hidden = true; return; }
    var ids = [];
    var page = PAGE_TOUR[S.route.name];
    if (page && T.has(page)) ids.push(page);
    ids.push('overview');
    m.innerHTML = ids.map(function (id) {
      var t = T.tours[id];
      return '<button type="button" data-tour-go="' + id + '"><span>' + esc(t.title) + '</span><small>' + esc(t.mins || '') + '</small></button>';
    }).join('');
    m.hidden = false;
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

  /* ---------- ล็อกอิน: กดชื่อตัวเองแล้วเข้าเลย ----------
     นนท์สั่ง 17 ก.ย. 69 — พิซซ่ากับเติ้ลจำ user/รหัสไม่ได้ ตัดอีเมล/รหัสผ่านออกจากสมาชิกทั้งหมด
     หัวหน้า (owner) ยังต้องใส่รหัสผ่าน เพราะกดชื่อแล้วได้สิทธิ์ลบทุกอย่าง + เห็นยอดขาย/KPI */
  var loginPick = null;     // id ของหัวหน้าที่กดแล้วรอใส่รหัส
  var loginStaff = null;    // รายชื่อจาก GET /login (แคชไว้ไม่ต้องโหลดซ้ำตอน re-render)

  /* ?next=/cmo/kpi — worker เด้งมาพร้อมปลายทาง รับเฉพาะ path ในบ้านเรา กัน open redirect */
  function nextParam() {
    var m = location.search.match(/[?&]next=([^&]*)/);
    if (!m) return '';
    var v = decodeURIComponent(m[1]);
    return /^\/[A-Za-z0-9_\-./?=&#]*$/.test(v) && v.indexOf('//') !== 0 ? v : '';
  }
  /* ชื่อบนปุ่ม: "Pizza (Julalak Krongkheaw)" → Pizza · "Title Thitima S." → Title */
  function loginLabel(x) {
    var n = String(x.name || '').replace(/\(.*?\)/g, ' ').trim();
    return n.split(/\s+/)[0] || x.name;
  }
  function afterLogin(me0) {
    loginPick = null;
    /* ฝ่ายขายที่เห็นเฉพาะลีด — เข้าหน้าลีดเลย ไม่ต้องผ่านปฏิทิน (นนท์ 21 ก.ย. 69) */
    var secs = (me0 && me0.sections) || [];
    var crmOnly = secs.indexOf('crm') !== -1 && secs.indexOf('tasks') === -1;
    if (crmOnly) { location.hash = '#/leads'; return boot(); }
    /* ถูกเด้งมาจากหน้าอื่นเพราะยังไม่ได้ล็อกอิน — พากลับไปหน้านั้น */
    var next = nextParam();
    if (next) { location.href = next; return; }
    /* เปิดระบบมาเปล่า ๆ = ไปปฏิทินการตลาดก่อน (นนท์: "เปิดมาปุ๊ปควรเจอหน้านี้เลย" 18 ก.ย. 69)
       ถ้ามี #/… ติดมา (กดจากลิงก์แจ้งเตือน) ไปหน้านั้นตามเดิม */
    if (!location.hash || location.hash === '#' || location.hash === '#/') { location.href = '../cmo/campaign-calendar.html'; return; }
    return boot();
  }
  function renderLogin(err) {
    renderHeaderUser();
    var view = $('#view');
    view.className = 'login';
    var picked = loginPick ? (loginStaff || []).filter(function (x) { return x.id === loginPick; })[0] : null;
    if (!picked) loginPick = null;

    var h = '<div class="login-card"><h1>KAN Admin — งานทีม</h1>' +
      '<p>' + (picked ? (picked.role === 'owner' ? 'บัญชีหัวหน้า ใส่รหัสผ่านก่อนเข้า' : 'ใส่รหัสผ่านก่อนเข้า') : 'กดชื่อตัวเองเพื่อเข้าระบบ') + '</p>' +
      (err ? '<div class="err" style="margin:14px 0 0"><p>' + esc(err) + '</p></div>' : '');

    if (!loginStaff) {
      h += '<div class="who-grid"><p class="hint">กำลังโหลดรายชื่อ…</p></div>';
    } else if (picked) {
      h += '<div class="who-picked">' + avatar(picked, 'lg') + '<div><b>' + esc(loginLabel(picked)) + '</b><small>' + esc(picked.name) + (picked.role === 'owner' ? ' · หัวหน้า' : '') + '</small></div></div>' +
        '<form id="loginForm">' +
        '<div class="field"><label class="label">รหัสผ่าน</label><input class="input" name="password" type="password" autocomplete="current-password" autofocus required></div>' +
        '<button type="submit" class="btn" id="loginBtn">เข้าสู่ระบบ</button>' +
        '<button type="button" class="btn-text" id="loginBack">← เลือกชื่ออื่น</button></form>';
    } else {
      h += '<div class="who-grid">' + loginStaff.map(function (x) {
        return '<button type="button" class="who-btn' + (x.needsPassword ? ' owner' : '') + '" data-login="' + esc(x.id) + '">' +
          avatar(x, 'lg') + '<b>' + esc(loginLabel(x)) + '</b>' +
          '<small>' + (x.needsPassword ? (x.role === 'owner' ? 'หัวหน้า · ใส่รหัสผ่าน' : 'ใส่รหัสผ่าน') : (loginLabel(x) === x.name ? 'สมาชิก' : esc(x.name))) + '</small></button>';
      }).join('') + '</div>' +
        '<p class="foot">ไม่ต้องใส่รหัส กดชื่อแล้วเข้าได้เลย · ไม่มีชื่อคุณในนี้ ให้หัวหน้าเพิ่มในหน้า "ทีม + สิทธิ์"</p>';
    }
    h += '<div class="login-by">Powered by <b>M Creation</b></div></div>';
    view.innerHTML = h;

    if (!loginStaff) {
      fetch(API + '/login', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        loginStaff = j.staff || [];
        if (!S.me) renderLogin(err);
      }).catch(function () {
        var g = $('.who-grid'); if (g) g.innerHTML = '<p class="hint">โหลดรายชื่อไม่ได้ ลองรีเฟรชหน้า</p>';
      });
      return;
    }

    function submit(staffId, password) {
      $$('.who-btn').forEach(function (b) { b.disabled = true; });
      var lb = $('#loginBtn'); if (lb) lb.disabled = true;
      var body = { staffId: staffId };
      if (password != null) body.password = password;
      return fetch(API + '/login', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'เข้าไม่ได้'); return j; }); })
        .then(function (j) { return afterLogin(j && j.me); })
        .catch(function (e) { renderLogin(e.message); });
    }

    $$('[data-login]').forEach(function (b) {
      b.addEventListener('click', function () {
        var x = loginStaff.filter(function (s) { return s.id === b.getAttribute('data-login'); })[0];
        if (!x) return;
        if (x.needsPassword) { loginPick = x.id; renderLogin(); return; }
        submit(x.id);
      });
    });
    var back = $('#loginBack');
    if (back) back.addEventListener('click', function () { loginPick = null; renderLogin(); });
    var form = $('#loginForm');
    if (form) {
      form.addEventListener('submit', function (ev) { ev.preventDefault(); submit(loginPick, this.password.value); });
      try { form.password.focus(); } catch (e) {}
    }
  }

  /* ---------- งานของฉัน ---------- */
  function taskRow(t) {
    var es = effStatus(t), late = isLate(t), st = late ? 'late' : es;
    var dueCls = late ? 'late' : (isToday(t) && es !== 'done' ? 'today' : '');
    var mark = es === 'done' ? '✓' : (es === 'blocked' ? '!' : (es === 'review' ? '?' : ''));
    var sub = t.nUpdates > 1 ? ('อัปเดต ' + fmtAgo(t.lastUpdate)) : (t.nFiles ? t.nFiles + ' รูป' : '');
    var cycle = t.repeat
      ? (es === 'done'
          ? '<span class="pill done">' + ({ daily: 'อัปเดตแล้ววันนี้', weekly: 'อัปเดตแล้วสัปดาห์นี้', monthly: 'อัปเดตแล้วเดือนนี้' }[t.repeat] || 'อัปเดตแล้ว') + '</span>'
          : '<span class="pill ' + (late ? 'late' : 'repeat') + '">' +
            (t.repeat === 'daily' ? (late ? 'ยังไม่อัปเดตวันนี้' : 'ประจำวัน')
              : (t.repeat === 'monthly' ? 'ประจำเดือน' : 'ประจำสัปดาห์')) + '</span>')
      : '';
    /* วงกลมหน้าแถว = ติ๊กเลือก (เลือกหลายงานแล้วสั่งจากแถบล่างทีเดียว — นนท์ขอ 18 ก.ย. 69)
       ปุ่มติ๊กเสร็จ/ตรวจผ่านของงานเดี่ยวย้ายไปอยู่ในเมนู ⋯ ท้ายแถว */
    var sel = !!SEL[t.id];
    var canMenu = canEditRow(t) || canTick(t) || canAssign();
    return '<a class="trow ' + esc(es) + (sel ? ' selected' : '') + '" href="#/task/' + esc(t.id) + '">' +
      selCircle(t, st, mark, sel) +
      '<span class="main"><span class="tline"><span class="t">' + (t.priority ? '★ ' : '') + esc(t.title) + '</span>' +
      (canEditRow(t) ? '<i class="tpen" role="button" tabindex="0" data-tedit="' + esc(t.id) + '" title="แก้ชื่องาน" aria-label="แก้ชื่องาน">✎</i>' : '') + '</span>' +
      '<span class="m">' +
      (canAssign() ? '<span class="edt" role="button" tabindex="0" data-aedit="' + esc(t.id) + '" title="เปลี่ยนคนรับ">' + avatars(t.assignees) + '</span>' : avatars(t.assignees)) +
      typeChip(t.taskType) + kpiChip(t.kpiId) + campaignChip(t.campaignId, false, true) + cycle +
      (es === 'doing' ? '<span class="pill doing">กำลังทำ</span>' : '') +
      (es === 'review' ? '<span class="pill review">รอตรวจ</span>' : '') +
      (es === 'blocked' ? '<span class="pill blocked">ติดปัญหา</span>' : '') +
      (t.taskKind === 'routine' ? '<span class="pill kind">รูทีน</span>' : '') +
      (t.parentId ? '<span class="pill sub">งานย่อย</span>' : '') +
      (t.nSub ? '<span title="งานย่อย">☑ ' + t.nSubDone + '/' + t.nSub + '</span>' : '') +
      (t.nFiles ? '<span>📷 ' + t.nFiles + '</span>' : '') + '</span></span>' +
      '<span class="due ' + dueCls + (canDue(t) ? ' edt' : '') + '"' + (canDue(t) ? ' role="button" tabindex="0" data-dedit="' + esc(t.id) + '" title="แก้กำหนดส่ง"' : '') + '>' +
      esc(fmtDue(t)) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
      /* เมนู ⋯: ติ๊กเสร็จ/ตรวจผ่าน · แก้ไข · เปิดงานเต็ม · ลบ — ปุ่มเป็น <span> เพราะอยู่ใน <a> ซ้อน <button> ไม่ได้ */
      (canMenu ? '<span class="rowmenu" role="button" tabindex="0" data-rowmenu="' + esc(t.id) + '" title="เมนูงานนี้" aria-label="เมนูงานนี้">⋯</span>' : '<span class="rowmenu ghost"></span>') +
      '<svg class="arr" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></a>';
  }
  /* ลำดับงานที่กำลังเห็นอยู่ — ใช้ทำปุ่ม "ก่อนหน้า / ถัดไป" ในหน้ารายละเอียด
     จำว่ามาจากหน้าไหนด้วย จะได้กดย้อนกลับไปที่เดิมพร้อมตัวกรองเดิม */
  function markSeq(list, from) {
    S.seq = list.map(function (t) { return t.id; });
    S.seqFrom = from || location.hash || '#/all';
    return list;
  }
  function seqNav(id) {
    var ids = S.seq || [], i = ids.indexOf(id);
    var back = S.seqFrom || '#/all';
    var lbl = back.indexOf('#/review') === 0 ? 'ปัดตรวจ'
      : (back.indexOf('#/me') === 0 ? 'งานของฉัน' : (back.indexOf('#/campaign') === 0 ? 'แคมเปญ' : (back.indexOf('#/signage') === 0 ? 'งานป้าย' : 'งานทั้งหมด')));
    var btn = function (to, txt, dis) {
      return dis ? '<span class="btn-ghost sm disabled">' + txt + '</span>'
                 : '<a class="btn-ghost sm" href="#/task/' + esc(to) + '">' + txt + '</a>';
    };
    return '<div class="seqnav">' +
      '<a class="btn-ghost sm" href="' + esc(back) + '">← กลับไป' + esc(lbl) + '</a>' +
      (ids.length > 1 && i !== -1
        ? '<span class="seqn">' + (i + 1) + ' / ' + ids.length + '</span>' +
          btn(ids[i - 1], '‹ ก่อนหน้า', i <= 0) + btn(ids[i + 1], 'ถัดไป ›', i >= ids.length - 1)
        : '') + '</div>';
  }
  function gsel() { return '<span class="gsel" role="checkbox" aria-checked="false" tabindex="0" data-gsel title="เลือกทั้งกลุ่ม" aria-label="เลือกทั้งกลุ่ม"></span>'; }
  function groupList(title, list, cls) {
    if (!list.length) return '';
    return '<div class="group"><div class="group-h' + (cls ? ' ' + cls : '') + '"><h3>' + esc(title) + '</h3><span>' + list.length + '</span>' + gsel() + '</div>' +
      '<div class="tlist">' + list.map(taskRow).join('') + '</div></div>';
  }
  /* ---------- บอร์ด (ไปป์ไลน์แบบ monday) ----------
     นนท์ส่ง ref มา 18 ก.ย. 69: หัวคอลัมน์สีเป็นลูกศร + จำนวน · ใต้หัวมีสรุป · การ์ดมีชิป/คนรับ/ตัวนับ
     งานย่อยซ้อนใต้การ์ด + ปุ่มเพิ่มงานย่อยตรงนั้น · กดการ์ดเปิดงาน
     คอลัมน์: เลือกประเภทงานที่มีขั้นงาน (flow) → คอลัมน์ = ขั้น · ไม่มี flow → คอลัมน์ = สถานะ
     ลากการ์ดข้ามคอลัมน์ = เปลี่ยนสถานะ / เลื่อนขั้น (ขั้นที่ต้องแนบรูปยังบังคับที่ worker) */
  var BOARD_COLS = [
    { k: 'todo', label: 'รอทำ' },
    { k: 'doing', label: 'กำลังทำ' },
    { k: 'review', label: 'รอตรวจ' },
    { k: 'blocked', label: 'ติดปัญหา' },
    { k: 'done', label: 'เสร็จแล้ว' }
  ];
  var B = { type: '' };
  try { B.type = localStorage.getItem('kan-board-type') || ''; } catch (e) {}
  /* สีหัวคอลัมน์ — ชุดเดียวกับ ref: คราม ฟ้า เขียวน้ำทะเล เขียว · ติดปัญหา = ชมพูแดง · เสร็จ = เขียวเสมอ */
  var KCOLORS = ['#5b5fc7', '#4f8bf0', '#4fbfc0', '#7c6bd6', '#e39a3b', '#d96a8b', '#6a9bd8'];
  function kcolColor(k, i, n) {
    if (k === 'done') return '#5dbb7a';
    if (k === 'blocked') return '#e0607e';
    if (k === 'review') return '#4fbfc0';
    if (k === 'doing') return '#4f8bf0';
    if (k === 'todo') return '#5b5fc7';
    return KCOLORS[i % KCOLORS.length];
  }
  function boardColumns() {
    var flow = B.type ? flowOf(B.type) : [];
    if (flow.length) {
      return { byStage: true, flow: flow, cols: flow.map(function (st) { return { k: st.k, label: st.th, pic: st.pic }; }).concat([{ k: 'done', label: 'เสร็จแล้ว' }]) };
    }
    return { byStage: false, flow: [], cols: BOARD_COLS };
  }
  function subCard(x) {
    var es = effStatus(x), late = isLate(x);
    var mark = es === 'done' ? '✓' : (es === 'blocked' ? '!' : (es === 'review' ? '?' : ''));
    return '<div class="ksub' + (es === 'done' ? ' done' : '') + (late ? ' late' : '') + '" data-kopen="' + esc(x.id) + '">' +
      selCircle(x, late ? 'late' : es, mark, !!SEL[x.id], 'ksel') +
      '<span class="kst"><b>' + esc(x.title) + '</b>' +
      '<span class="ksm">' + (x.assignees.length ? esc(x.assignees.map(function (id) { return shortName(staffById(id)); }).join(', ')) : 'ยังไม่มอบหมาย') +
      (x.dueAt ? ' · ' + esc(fmtDue(x)) : '') + (es === 'review' ? ' · รอตรวจ' : '') + '</span></span>' +
      (canEditRow(x) || canTick(x) ? '<span class="rowmenu" role="button" tabindex="0" data-rowmenu="' + esc(x.id) + '" title="เมนูงานย่อยนี้">⋯</span>' : '') + '</div>';
  }
  function boardCard(t, model) {
    var late = isLate(t), es = effStatus(t);
    var sel = !!SEL[t.id];
    var mark = es === 'done' ? '✓' : (es === 'blocked' ? '!' : (es === 'review' ? '?' : ''));
    var subs = plainSubs(t), stages = stageSubs(t);
    var stDone = stages.filter(function (x) { return effStatus(x) === 'done'; }).length;
    var canDrag = model.byStage ? (canTick(t) && stages.length > 0) : canTick(t);
    var chips = '';
    if (t.priority) chips += '<span class="kchip pri"><i></i>ด่วน</span>';
    if (!B.type) chips += typeChip(t.taskType);
    chips += kpiChip(t.kpiId);
    if (t.dueAt || t.repeat) chips += '<span class="kchip due' + (late ? ' late' : (isToday(t) && es !== 'done' ? ' today' : '')) + '"><i></i>' + esc(fmtDue(t)) + '</span>';
    if (t.hours) chips += '<span class="kchip"><i></i>' + esc(String(t.hours)) + ' ชม.</span>';
    var flowHas = flowOf(t.taskType).length > 0;
    var h = '<article class="kcard' + (late ? ' late' : '') + (sel ? ' selected' : '') + (es === 'done' ? ' isdone' : '') +
      '" draggable="' + (canDrag ? 'true' : 'false') + '" data-kid="' + esc(t.id) + '" data-kopen="' + esc(t.id) + '">' +
      '<div class="khead">' + selCircle(t, late ? 'late' : es, mark, sel, 'ksel') +
      '<b>' + esc(t.title) + '</b></div>' +
      (chips ? '<div class="kchips">' + chips + '</div>' : '') +
      '<div class="kfoot">' + (t.assignees.length ? '<span class="avs">' + t.assignees.slice(0, 3).map(function (id) { return avatar(staffById(id)); }).join('') + '</span>' +
        '<span class="kwho">' + esc(t.assignees.map(function (id) { return shortName(staffById(id)); }).join(', ')) + '</span>' : '<span class="kwho warn">ยังไม่มอบหมาย</span>') +
      '<span class="kcnt" title="ความคืบหน้า/ความเห็น">' + svgIcon('chat') + (t.nUpdates || 0) + '</span>' +
      (stages.length ? '<span class="kcnt" title="ขั้นงาน">' + svgIcon('flow') + stDone + '/' + stages.length + '</span>' : '') +
      (subs.length ? '<span class="kcnt" title="งานย่อย">' + svgIcon('sub') + subs.filter(function (x) { return effStatus(x) === 'done'; }).length + '/' + subs.length + '</span>' : '') +
      (t.nFiles ? '<span class="kcnt" title="รูป">' + svgIcon('pic') + t.nFiles + '</span>' : '') +
      (canEditRow(t) || canTick(t) || canAssign() ? '<span class="rowmenu" role="button" tabindex="0" data-rowmenu="' + esc(t.id) + '" title="เมนูงานนี้">⋯</span>' : '') +
      '</div>' +
      (model.byStage && !stages.length && flowHas && !readOnly() ? '<div class="knote"><button type="button" class="btn-text" data-mkstages="' + esc(t.id) + '">ยังไม่มีขั้นงาน — สร้าง ' + flowOf(t.taskType).length + ' ขั้น</button></div>' : '') +
      '</article>';
    /* งานย่อย (ที่ไม่ใช่ขั้น) ซ้อนใต้การ์ด + ช่องเพิ่ม */
    var canAdd = !readOnly() && (canEditRow(t) || mineTask(t) || (S.me && S.me.canUpdateOthers));
    if (subs.length || canAdd) {
      h += '<div class="ksubs">' + subs.map(subCard).join('') +
        (canAdd ? '<div class="kadd" data-kadd="' + esc(t.id) + '"><span class="kaddp" role="button" tabindex="0">+ เพิ่มงานย่อย</span></div>' : '') + '</div>';
    }
    return '<div class="kitem">' + h + '</div>';
  }
  function svgIcon(k) {
    if (k === 'chat') return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6a8 8 0 1 1 18-5z"/></svg>';
    if (k === 'flow') return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h6M4 12h10M4 18h14"/></svg>';
    if (k === 'sub') return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4v12a2 2 0 0 0 2 2h12M5 10h8M9 16h10"/></svg>';
    if (k === 'pic') return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-8 7"/></svg>';
    return '';
  }
  function kanban(list, opts) {
    opts = opts || {};
    var model = boardColumns();
    var pool = (B.type && !opts.noFilter) ? list.filter(function (t) { return (t.taskType || 'other') === B.type; }) : list;
    var by = {};
    pool.forEach(function (t) {
      var k;
      if (model.byStage) {
        var cur = currentStage(t, model.flow);
        k = effStatus(t) === 'done' ? 'done' : (cur === null ? model.cols[0].k : cur);
        if (k !== 'done' && !model.cols.some(function (c) { return c.k === k; })) k = model.cols[0].k;   /* ขั้นเก่าที่ถูกลบจาก flow */
      } else k = effStatus(t);
      (by[k] = by[k] || []).push(t);
    });
    var typeTabs = opts.hideTabs ? '' : '<div class="kbar"><div class="seg">' +
      '<button type="button" class="' + (!B.type ? 'on' : '') + '" data-btype="">ทุกงาน · ตามสถานะ</button>' +
      TASK_TYPE_KEYS.map(function (k) {
        var n = flowOf(k).length;
        return '<button type="button" class="' + (B.type === k ? 'on' : '') + '" data-btype="' + k + '" title="' + (n ? n + ' ขั้น' : 'ยังไม่ตั้งขั้นงาน — ใช้สถานะ') + '">' + esc(TASK_TYPE_TH[k]) + (n ? '<i>' + n + '</i>' : '') + '</button>';
      }).join('') + '</div>' +
      (amOwner() ? '<button type="button" class="btn-ghost sm" data-flow-edit>ตั้งค่าขั้นงาน</button>' : '') +
      '<span class="kbar-n">' + pool.length + ' งาน' + (model.byStage ? ' · ' + model.flow.length + ' ขั้น' : '') + '</span></div>';
    if (opts.hideTabs) typeTabs = '';
    var cols = model.cols.map(function (c, i) {
      var items = by[c.k] || [];
      var hrs = items.reduce(function (a, t) { return a + (t.hours || 0); }, 0);
      var lateN = items.filter(isLate).length;
      var color = kcolColor(c.k, i, model.cols.length);
      return '<section class="kcol" data-kcol="' + (model.byStage ? '' : c.k) + '"' + (model.byStage ? ' data-kstage="' + esc(c.k) + '" data-kidx="' + i + '"' : '') + ' style="--kc:' + color + '">' +
        '<header class="khdr"><b>' + esc(c.label) + '</b><span>/ ' + items.length + '</span></header>' +
        '<div class="ksum">' + (hrs ? '<b>' + esc(String(Math.round(hrs * 4) / 4)) + '</b> ชม.' : '<b>' + items.length + '</b> งาน') +
        (lateN ? '<em>เลยกำหนด ' + lateN + '</em>' : '') + (c.pic ? '<small title="ปิดขั้นนี้ต้องแนบรูป">📷 ต้องมีรูป</small>' : '') + '</div>' +
        '<div class="kbody">' + (items.length ? items.map(function (t) { return boardCard(t, model); }).join('')
          : '<p class="kempty">ไม่มีงาน</p>') + '</div></section>';
    }).join('');
    return typeTabs + '<div class="kban">' + cols + '</div>' +
      '<p class="khint">' + (model.byStage ? 'ลากการ์ดไปคอลัมน์ถัดไป = ปิดขั้นปัจจุบัน (ขั้นที่ต้องมีรูปจะไม่ผ่านจนกว่าจะแนบรูปในงาน) · ' : 'ลากการ์ดข้ามคอลัมน์เพื่อเปลี่ยนสถานะ · ') +
      'กดที่การ์ดเพื่อเปิดงาน · วงกลม = เลือกหลายงาน · บน iPad/มือถือ <b>แตะการ์ดค้างแป๊บนึงแล้วลาก</b></p>';
  }
  /* ---------- แตะค้างแล้วลากการ์ดบนบอร์ด (iPad/มือถือ) ----------
     HTML drag-and-drop ใช้กับนิ้วไม่ได้ ต้องทำเอง: แตะค้าง 350ms = จับการ์ดขึ้นมา (สั่นเบา ๆ ถ้าเครื่องรองรับ)
     แล้วลากไปวางคอลัมน์ไหนก็ได้ · เลื่อนนิ้วก่อนครบเวลา = สกรอลล์ตามปกติ ไม่จับการ์ด */
  var TD = null;
  function kcolAt(x, y) {
    var el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest('.kcol') : null;
  }
  function tdDrop(col, id) {
    if (!col || !id) return;
    /* บอร์ดลีดใช้คลาสเดียวกับบอร์ดงาน ตัวลากจึงใช้ร่วมกันได้ แยกทางตรงนี้ที่เดียว */
    if (col.hasAttribute('data-lcol')) { leadDrop(id, col.getAttribute('data-lcol')); return; }
    var t = taskById(id);
    if (!t) { render(); return; }
    if (col.hasAttribute('data-kstage')) { moveToStage(t, col.getAttribute('data-kstage'), Number(col.getAttribute('data-kidx'))); return; }
    var want = col.getAttribute('data-kcol');
    if (!want || effStatus(t) === want) { render(); return; }
    var req = (want === 'done' && effStatus(t) === 'review' && canApprove(t))
      ? api('/tasks/' + t.id + '/review', 'POST', { pass: true })
      : api('/tasks/' + t.id, 'PUT', { status: want });
    req.then(function (j) {
      S.tasks = null;
      toast(j && j.status === 'review' && want === 'done' ? 'ส่งให้หัวหน้าตรวจแล้ว' : 'ย้ายไป “' + (STATUS_TH[want] || want) + '” แล้ว');
      render();
    }).catch(function (e) { toast(e.message, true); render(); });
  }
  function tdEnd(commit) {
    if (!TD) return;
    var col = commit && TD.on ? TD.on : null;
    if (TD.ghost) TD.ghost.remove();
    if (TD.card) TD.card.classList.remove('tdrag');
    $$('.kcol.over').forEach(function (x) { x.classList.remove('over'); });
    document.body.classList.remove('tdragging');
    clearTimeout(TD.timer);
    var had = TD.active, id = TD.id;
    TD = null;
    if (commit && had) tdDrop(col, id);
  }
  document.addEventListener('touchstart', function (ev) {
    if (ev.touches.length !== 1) { tdEnd(false); return; }
    var card = ev.target.closest && ev.target.closest('.kcard[draggable="true"]');
    if (!card) return;
    if (ev.target.closest('[data-sel],[data-rowmenu],[data-mkstages],a,button,input')) return;
    var t0 = ev.touches[0];
    TD = { id: card.getAttribute('data-kid'), card: card, x0: t0.clientX, y0: t0.clientY, active: false, on: null, ghost: null, timer: null };
    TD.timer = setTimeout(function () {
      if (!TD) return;
      TD.active = true;
      var r = card.getBoundingClientRect();
      var g = card.cloneNode(true);
      g.className = 'kcard kghost';
      g.style.width = r.width + 'px';
      g.style.left = r.left + 'px';
      g.style.top = r.top + 'px';
      document.body.appendChild(g);
      TD.ghost = g; TD.dx = TD.x0 - r.left; TD.dy = TD.y0 - r.top;
      card.classList.add('tdrag');
      document.body.classList.add('tdragging');
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
    }, 350);
  }, { passive: true });
  document.addEventListener('touchmove', function (ev) {
    if (!TD) return;
    var t0 = ev.touches[0];
    if (!TD.active) {
      /* ยังไม่ครบเวลา แล้วนิ้วขยับเกิน 10px = ตั้งใจสกรอลล์ ไม่ใช่ลาก */
      if (Math.abs(t0.clientX - TD.x0) > 10 || Math.abs(t0.clientY - TD.y0) > 10) { clearTimeout(TD.timer); TD = null; }
      return;
    }
    ev.preventDefault();   /* จับการ์ดแล้ว ห้ามหน้าเลื่อนตาม */
    TD.ghost.style.transform = 'translate(' + (t0.clientX - TD.x0) + 'px,' + (t0.clientY - TD.y0) + 'px)';
    var col = kcolAt(t0.clientX, t0.clientY);
    if (col !== TD.on) {
      $$('.kcol.over').forEach(function (x) { x.classList.remove('over'); });
      if (col) col.classList.add('over');
      TD.on = col;
    }
    /* ลากไปชิดขอบจอ = เลื่อนบอร์ดตามแนวนอน */
    var wrap = $('.kban');
    if (wrap) {
      if (t0.clientX > window.innerWidth - 60) wrap.scrollLeft += 12;
      else if (t0.clientX < 60) wrap.scrollLeft -= 12;
    }
  }, { passive: false });
  document.addEventListener('touchend', function () { tdEnd(true); }, { passive: true });
  document.addEventListener('touchcancel', function () { tdEnd(false); }, { passive: true });

  /* ผูก drag ครั้งเดียวที่ document — การ์ดถูกวาดใหม่ทุกรอบ ผูกรายตัวจะหลุด */
  var KDRAG = null;
  document.addEventListener('dragstart', function (ev) {
    var c = ev.target.closest && ev.target.closest('.kcard[draggable="true"]');
    if (!c) return;
    KDRAG = c.getAttribute('data-kid');
    c.classList.add('dragging');
    try { ev.dataTransfer.setData('text/plain', KDRAG); ev.dataTransfer.effectAllowed = 'move'; } catch (e) {}
  });
  document.addEventListener('dragend', function () {
    KDRAG = null;
    $$('.kcard.dragging').forEach(function (x) { x.classList.remove('dragging'); });
    $$('.kcol.over').forEach(function (x) { x.classList.remove('over'); });
  });
  document.addEventListener('dragover', function (ev) {
    var col = ev.target.closest && ev.target.closest('.kcol');
    if (!col || !KDRAG) return;
    ev.preventDefault();
    try { ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
    $$('.kcol.over').forEach(function (x) { if (x !== col) x.classList.remove('over'); });
    col.classList.add('over');
  });
  document.addEventListener('drop', function (ev) {
    var col = ev.target.closest && ev.target.closest('.kcol');
    if (!col || !KDRAG) return;
    ev.preventDefault();
    var id = KDRAG;
    KDRAG = null;
    /* บอร์ดลีดใช้คลาสเดียวกับบอร์ดงาน ตัวลากจึงใช้ร่วมกันได้ แยกทางตรงนี้ที่เดียว */
    if (col.hasAttribute('data-lcol')) { leadDrop(id, col.getAttribute('data-lcol')); return; }
    var t = taskById(id);
    if (!t) { render(); return; }
    if (col.hasAttribute('data-kstage')) { moveToStage(t, col.getAttribute('data-kstage'), Number(col.getAttribute('data-kidx'))); return; }
    var want = col.getAttribute('data-kcol');
    if (!want || effStatus(t) === want) { render(); return; }
    /* ลากไปช่อง "เสร็จแล้ว" แต่ไม่มีสิทธิ์ปิดงาน = ส่งรอตรวจแทน เหมือนกดปุ่มในหน้างาน */
    var req = (want === 'done' && effStatus(t) === 'review' && canApprove(t))
      ? api('/tasks/' + id + '/review', 'POST', { pass: true })
      : api('/tasks/' + id, 'PUT', { status: want });
    req.then(function (j) {
      S.tasks = null;
      toast(j && j.status === 'review' && want === 'done' ? 'ส่งให้หัวหน้าตรวจแล้ว' : 'ย้ายไป “' + (STATUS_TH[want] || want) + '” แล้ว');
      render();
    }).catch(function (e) { toast(e.message, true); render(); });
  });
  /* ลากการ์ดไปคอลัมน์ขั้นที่ไกลกว่า = ปิดทุกขั้นก่อนหน้านั้น (ยิง bulk ครั้งเดียว · ขั้นที่ต้องมีรูปจะถูกข้ามพร้อมบอก)
     ลากถอยหลัง = เปิดขั้นนั้นกับขั้นหลังจากนั้นกลับมาเป็นรอทำ */
  function moveToStage(t, stageK, idx) {
    var flow = flowOf(t.taskType);
    var subs = stageSubs(t);
    if (!subs.length) { toast('งานนี้ยังไม่มีขั้นงาน — กด “สร้างขั้น” บนการ์ดก่อน', true); render(); return; }
    var byK = {}; subs.forEach(function (x) { byK[x.stage] = x; });
    var target = stageK === 'done' ? flow.length : idx;
    var toClose = [], toOpen = [];
    flow.forEach(function (st, i) {
      var x = byK[st.k]; if (!x) return;
      if (i < target && effStatus(x) !== 'done') toClose.push(x.id);
      if (i >= target && effStatus(x) === 'done') toOpen.push(x.id);
    });
    if (!toClose.length && !toOpen.length) { render(); return; }
    var reqs = [];
    if (toClose.length) reqs.push(api('/tasks/bulk', 'POST', { ids: toClose, action: 'done' }));
    if (toOpen.length) reqs.push(api('/tasks/bulk', 'POST', { ids: toOpen, action: 'status', status: 'todo' }));
    Promise.all(reqs).then(function (rs) {
      S.tasks = null;
      var skipped = [];
      rs.forEach(function (j) { (j.skipped || []).forEach(function (x) { skipped.push(x); }); });
      if (skipped.length) toast('เลื่อนได้บางส่วน — ' + skipped[0].reason + (skipped.length > 1 ? ' (+' + (skipped.length - 1) + ')' : ''), true);
      else toast(stageK === 'done' ? 'ปิดครบทุกขั้นแล้ว' : 'เลื่อนไปขั้น “' + esc((flow[idx] || {}).th || '') + '” แล้ว');
      render();
    }).catch(function (e) { toast(e.message, true); render(); });
  }
  /* เพิ่มงานย่อยใต้การ์ด: ช่องพิมพ์ชื่อ Enter = สร้าง (คนรับ/กำหนดส่ง/ประเภท/KPI ตามงานหลัก) */
  function kaddOpen(host) {
    if ($('input', host)) return;
    var pid = host.getAttribute('data-kadd'), parent = taskById(pid);
    host.innerHTML = '<input class="input" maxlength="200" placeholder="ชื่องานย่อย แล้วกด Enter" aria-label="ชื่องานย่อย"><span class="teh">Enter สร้าง · Esc ยกเลิก</span>';
    var inp = $('input', host);
    var closed = false;
    function done(save) {
      if (closed) return; closed = true;
      var v = inp.value.trim();
      if (!save || !v || !parent) { render(); return; }
      api('/tasks', 'POST', { tasks: [{ title: v, parentId: parent.id, assignees: parent.assignees, dueAt: parent.dueAt, taskType: parent.taskType, kpiId: parent.kpiId, support: parent.support, campaignId: parent.campaignId }] })
        .then(function () { S.tasks = null; toast('เพิ่มงานย่อยแล้ว'); render(); })
        .catch(function (e) { toast(e.message, true); render(); });
    }
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); done(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); done(false); }
    });
    inp.addEventListener('blur', function () { setTimeout(function () { done(true); }, 0); });
    inp.focus();
  }
  /* ตั้งค่าขั้นงานต่อประเภท (หัวหน้า): เพิ่ม/ลบ/สลับ/เปลี่ยนชื่อ/วันนำ/ต้องมีรูป */
  function flowEditor(type) {
    type = type || B.type || 'signage';
    var host = document.createElement('div');
    host.className = 'modal';
    var rows = (flowOf(type) || []).map(function (x) { return { k: x.k, th: x.th, lead: x.lead || 0, pic: !!x.pic }; });
    function draw() {
      host.innerHTML = '<div class="modal-box qbox"><div class="sec-h"><h2>ตั้งค่าขั้นงาน</h2>' +
        '<p>งานประเภทนี้ที่สั่งใหม่จะได้งานย่อยตามขั้นเหล่านี้อัตโนมัติ · วันนำ = จำนวนวันทำการที่ขั้นนั้นใช้ (ถอยหลังจากกำหนดส่ง) · ลบทุกขั้น = กลับไปใช้คอลัมน์ตามสถานะ</p></div>' +
        '<div class="qbody"><div class="seg" style="margin-bottom:12px">' + TASK_TYPE_KEYS.map(function (k) {
          return '<button type="button" class="' + (type === k ? 'on' : '') + '" data-ft="' + k + '">' + esc(TASK_TYPE_TH[k]) + (flowOf(k).length ? '<i>' + flowOf(k).length + '</i>' : '') + '</button>';
        }).join('') + '</div>' +
        '<div class="flist">' + (rows.length ? rows.map(function (r, i) {
          return '<div class="frow2" data-i="' + i + '"><span class="fn">' + (i + 1) + '</span>' +
            '<input class="input" data-fk="th" value="' + esc(r.th) + '" placeholder="ชื่อขั้น" maxlength="40">' +
            '<label class="fl"><input class="input" type="number" min="0" max="60" data-fk="lead" value="' + esc(String(r.lead)) + '" aria-label="วันนำ"> วัน</label>' +
            '<label class="fl"><input type="checkbox" data-fk="pic"' + (r.pic ? ' checked' : '') + '> ต้องมีรูป</label>' +
            '<span class="fbtns"><button type="button" class="btn-ghost sm" data-fmv="-1" title="เลื่อนขึ้น"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="btn-ghost sm" data-fmv="1" title="เลื่อนลง"' + (i === rows.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button type="button" class="btn-ghost sm danger" data-fdel title="ลบขั้นนี้">✕</button></span></div>';
        }).join('') : '<p class="hint">ยังไม่มีขั้นงานสำหรับประเภทนี้ — บอร์ดใช้คอลัมน์ตามสถานะ</p>') + '</div>' +
        '<button type="button" class="btn-ghost sm" data-fadd' + (rows.length >= 12 ? ' disabled' : '') + '>+ เพิ่มขั้น</button></div>' +
        '<div class="qacts"><button type="button" class="btn-ghost" data-q-close>ยกเลิก</button><button type="button" class="btn" data-fsave>บันทึก</button></div></div>';
    }
    function pull() {
      $$('.frow2', host).forEach(function (el, i) {
        rows[i].th = $('[data-fk="th"]', el).value.trim();
        rows[i].lead = Number($('[data-fk="lead"]', el).value) || 0;
        rows[i].pic = $('[data-fk="pic"]', el).checked;
      });
    }
    draw();
    document.body.appendChild(host);
    host.addEventListener('click', function (ev) {
      var b;
      if (ev.target === host || ev.target.closest('[data-q-close]')) { host.remove(); return; }
      if ((b = ev.target.closest('[data-ft]'))) { pull(); type = b.getAttribute('data-ft'); rows = (flowOf(type) || []).map(function (x) { return { k: x.k, th: x.th, lead: x.lead || 0, pic: !!x.pic }; }); draw(); return; }
      if (ev.target.closest('[data-fadd]')) { pull(); rows.push({ k: '', th: '', lead: 1, pic: false }); draw(); var last = $$('.frow2 [data-fk="th"]', host).pop(); if (last) last.focus(); return; }
      if ((b = ev.target.closest('[data-fmv]'))) { pull(); var i = Number(b.closest('.frow2').getAttribute('data-i')), j = i + Number(b.getAttribute('data-fmv')); var tmp = rows[i]; rows[i] = rows[j]; rows[j] = tmp; draw(); return; }
      if ((b = ev.target.closest('[data-fdel]'))) { pull(); rows.splice(Number(b.closest('.frow2').getAttribute('data-i')), 1); draw(); return; }
      if ((b = ev.target.closest('[data-fsave]'))) {
        pull();
        var clean = rows.filter(function (r) { return r.th; });
        b.disabled = true;
        api('/flows', 'PUT', { type: type, stages: clean.map(function (r) { return { k: r.k, th: r.th, lead: r.lead, pic: r.pic ? 1 : 0 }; }) })
          .then(function (j) { applyFlows(j.flows || {}); host.remove(); toast('บันทึกขั้นงาน ' + TASK_TYPE_TH[type] + ' แล้ว'); B.type = type; try { localStorage.setItem('kan-board-type', B.type); } catch (e) {} render(); })
          .catch(function (e) { b.disabled = false; toast(e.message, true); });
      }
    });
  }

  function bucketize(tasks) {
    var now = new Date(), week = new Date(startOfDay(now).getTime() + 7 * 86400000);
    var b = { review: [], late: [], today: [], week: [], later: [], nodate: [], repeat: [], done: [] };
    tasks.forEach(function (t) {
      if (effStatus(t) === 'done') { b.done.push(t); return; }
      /* รอตรวจอยู่บนสุดเสมอ — ของที่ค้างที่หัวหน้า ไม่ใช่ค้างที่น้อง */
      if (effStatus(t) === 'review') { b.review.push(t); return; }
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
      var who = S.viewAs || S.me.id;
      var mine = all.filter(function (t) { return t.assignees.indexOf(who) !== -1; });
      var b = bucketize(mine);
      /* เรียงตามที่ตาเห็นบนหน้า ปุ่มถัดไปจะได้ไล่ตามลำดับเดียวกัน */
      markSeq([].concat(b.review, b.late, b.today, b.week, b.later, b.nodate, b.repeat, b.done), '#/me');
      var open = mine.length - b.done.length;   /* b.done ใช้ effStatus แล้ว งานประจำของวันใหม่จึงกลับมานับเป็นค้าง */
      var view = $('#view');
      view.className = 'page';
      var whoS = staffById(who) || S.me;
      var h = (S.viewAs ? '<div class="postbar warn">กำลังดูในมุมของ <b>' + esc(whoS.name) + '</b> — อ่านอย่างเดียว ' +
          '<button type="button" class="btn-text" data-viewas-off>เลิกดู</button></div>' : '') +
        '<div class="top"><div><span class="kicker">' + (S.viewAs ? 'งานของ ' + esc(shortName(whoS)) : 'งานของฉัน') + '</span>' +
        '<h1>' + (S.viewAs ? esc(whoS.name) : 'สวัสดี ' + esc(shortName(S.me))) + '</h1>' +
        '<p>' + (open ? 'มีงานค้าง ' + open + ' รายการ' + (b.late.length ? ' · เลยกำหนด ' + b.late.length : '') + (b.today.length ? ' · ครบกำหนดวันนี้ ' + b.today.length : '') : 'ไม่มีงานค้าง เยี่ยม') +
        '</p></div><div class="top-r"><a class="btn-ghost" href="#/all">ดูงานทั้งหมด</a>' +
        (readOnly() ? '' : '<a class="btn" href="#/new">+ สั่งงาน</a>') + '</div></div>';
      h += '<div class="cards">' +
        '<article class="hot"><span class="l">' + (S.viewAs ? 'งานค้างของเขา' : 'งานค้างของฉัน') + '</span><b>' + open + '</b><small>ยังไม่เสร็จ รวมงานประจำ</small></article>' +
        '<article' + (b.late.length ? ' class="bad"' : '') + '><span class="l">เลยกำหนด</span><b>' + b.late.length + '</b><small>ต้องเคลียร์ก่อน</small></article>' +
        '<article' + (b.today.length ? ' class="warn"' : '') + '><span class="l">ครบกำหนดวันนี้</span><b>' + b.today.length + '</b><small>' + esc(DAY_TH[new Date().getDay()] + ' ' + fmtDate(new Date())) + '</small></article>' +
        '<article><span class="l">เสร็จแล้ว</span><b>' + b.done.length + '</b><small>ทั้งหมดที่เคยทำ</small></article></div>';
      /* งานที่คนอื่นส่งมาให้เราตรวจ — ขึ้นก่อนงานของตัวเอง เพราะมันค้างที่เรา ไม่ใช่ค้างที่เขา */
      var toReview = readOnly() ? [] : all.filter(function (t) {
        return effStatus(t) === 'review' && canApprove(t) && t.assignees.indexOf(S.me.id) === -1;
      });
      if (toReview.length) {
        h += '<div class="group"><div class="group-h review"><h3>รอคุณตรวจ</h3><span>' + toReview.length + '</span>' + gsel() +
          '<a class="btn-text" style="margin-left:auto" href="#/review">ปัดตรวจทีเดียว</a>' + '</div>' +
          '<div class="tlist">' + toReview.map(taskRow).join('') + '</div></div>';
      }
      /* แถบตรวจโพสต์ของวันนี้ — งาน routine ที่หัวหน้าทำทุกวัน ไม่ต้องสร้างเป็น task รายโพสต์ */
      h += '<div class="postbar" id="postBar"><span class="pbi">กำลังอ่านตารางโพสต์…</span></div>';

      if (!mine.length) {
        h += '<div class="sec"><div class="empty"><b>' + (S.viewAs ? 'ยังไม่มีงานที่มอบหมายให้ ' + esc(shortName(whoS)) : 'ยังไม่มีงานที่มอบหมายให้คุณ') + '</b>เมื่อหัวหน้าสั่งงาน รายการจะขึ้นที่นี่</div></div>';
      } else {
        h += groupList('ส่งแล้ว รอหัวหน้าตรวจ', b.review) +
          groupList('เลยกำหนด', b.late, 'late') + groupList('วันนี้', b.today) + groupList('ภายใน 7 วัน', b.week) +
          groupList('ถัดไป', b.later) + groupList('ยังไม่กำหนดวัน', b.nodate) + groupList('งานประจำ', b.repeat);
        if (b.done.length) {
          h += '<div class="group"><div class="group-h"><h3>เสร็จแล้ว</h3><span>' + b.done.length + '</span>' + (S.showDone ? gsel() : '') +
            '<button type="button" class="btn-text" style="margin-left:auto" data-toggle-done>' + (S.showDone ? 'ซ่อน' : 'แสดง') + '</button></div>' +
            (S.showDone ? '<div class="tlist">' + b.done.slice(0, 40).map(taskRow).join('') + '</div>' : '') + '</div>';
        }
      }
      view.innerHTML = h;
      syncSel();
      fillPostBar();
    }).catch(function (e) { showError(e); });
  }
  /* แถบ "ค้างที่คุณ" ใต้ตัวเลขสรุป — เดิมนับแต่โพสต์ของวันนี้
     ตั้งแต่ 20 ก.ย. 69 นับทุกอย่างที่ค้างอยู่ที่หัวหน้าจริง ๆ (งานรอตรวจ + โพสต์ + งานที่ปิดไปแล้วแต่ยังไม่ได้ตรวจ)
     แล้วพาเข้าโหมดปัดที่ #/review ทีเดียวจบ ตัวเลขใช้ตัวนับชุดเดียวกับกองการ์ด จะได้ไม่ขัดกันเอง */
  function fillPostBar() {
      api('/posts/today').then(function (t) {
        var bar = $('#postBar');
        if (!bar) return;
        var noLink = t.done - t.withUrl;
        /* กองการ์ดฝั่งงานคิดจาก S.tasks ที่โหลดมาแล้ว ไม่ต้องยิงเพิ่ม · ฝั่งโพสต์ใช้ตัวเลขจาก /posts/today */
        var deck = S.tasks ? buildDeck(S.tasks, []) : [];
        var nRev = 0, nUnseen = 0;
        deck.forEach(function (c) { if (c.lane === 'review') nRev++; else if (c.lane === 'unseen') nUnseen++; });
        var waiting = canApprove() ? nRev + t.left + nUnseen : 0;
        if (!waiting) {
          bar.className = 'postbar' + (t.total ? (noLink > 0 ? ' warn' : ' ok') : ' quiet');
          bar.innerHTML = '<span class="pbi">' + (t.total
              ? '<b>โพสต์วันนี้ ' + t.done + '/' + t.total + ' · ครบแล้ว</b>' + (noLink > 0 ? ' · ไม่มีลิงก์ ' + noLink : '')
              : 'วันนี้ยังไม่มีแผนโพสต์ในตาราง และไม่มีงานรอคุณตรวจ') + '</span>' +
            '<a class="btn-text" href="#/posts">' + (noLink > 0 ? 'ไปใส่ลิงก์' : 'ดูตาราง') + '</a>';
          return;
        }
        bar.className = 'postbar warn';
        bar.innerHTML = '<span class="pbi"><b>ค้างที่คุณ ' + waiting + ' รายการ</b> · ' + [
            nRev ? 'งานรอตรวจ ' + nRev : '',
            t.left ? 'โพสต์วันนี้ยังไม่ได้ติ๊ก ' + t.left : '',
            nUnseen ? 'ปิดไปแล้วยังไม่ได้ตรวจ ' + nUnseen : ''
          ].filter(Boolean).join(' · ') + '</span>' +
          '<a class="btn sm" href="#/review">ปัดตรวจเลย</a>' +
          '<a class="btn-text" href="#/posts">ดูตารางโพสต์</a>';
      }).catch(function () {
        var bar = $('#postBar'); if (bar) bar.remove();
      });
  }

  /* ---------- ตรวจงานแบบปัดการ์ด (#/review) -------------------------------
     นนท์สั่ง 20 ก.ย. 69: "ลูกทีมส่งงานมาให้ตรวจ อยากตัดสินผ่าน/ไม่ผ่านแบบปัด Tinder"
     กองเดียวรวมทุกอย่างที่ค้างอยู่ที่ "เรา" เรียงตามความเร่ง:
       1) งานที่น้องกดส่งตรวจแล้ว (สถานะ review) — ค้างที่เราจริง ๆ ของเก่าสุดขึ้นก่อน
       2) โพสต์ของวันนี้ที่ยังไม่ได้ติ๊ก — งานประจำที่หัวหน้าไล่ทุกวัน (แถบเดิมในหน้าแรก)
       3) งานที่ปิดไปแล้วแต่ "เรา" ไม่เคยเป็นคนกดผ่าน (คนอื่นปิดให้ / ของก่อนมีระบบตรวจ)
     ปัดขวา = ผ่าน · ปัดซ้าย = ตีกลับ (ต้องมีเหตุผล เซิร์ฟเวอร์บังคับ) · ปัดขึ้น = ข้ามไว้ก่อน
     ตัดสินใบไหนยิง API ใบนั้นทันที — ปิดจอกลางคันแล้วของที่ปัดไปแล้วอยู่ครบ ไม่มี "กดบันทึกตอนจบ" */

  var RV = { cards: [], i: 0, busy: false, last: null, det: {}, drag: null, resume: null, nSkip: 0, nPass: 0, nRej: 0 };
  /* กองที่ 3 มองย้อนแค่ 14 วัน ไม่งั้นเปิดครั้งแรกเจอของค้างเป็นร้อยใบจนไม่มีใครปัดจบ */
  var RV_BACK_DAYS = 14;
  var RV_REASONS = ['รูปไม่ชัด ขอรูปใหม่', 'ยังไม่ครบ ขาดของ', 'ผิดสาขา / ผิดข้อมูล',
                    'แคปชันต้องแก้', 'ไม่มีลิงก์ / ลิงก์ผิด', 'ผิดโจทย์ ทำใหม่'];
  var RV_LANE_TH = { review: 'ส่งมาให้ตรวจ', post: 'โพสต์วันนี้', unseen: 'ปิดไปแล้ว คุณยังไม่ได้ตรวจ' };

  /* กองการ์ด — ใช้ร่วมกับแถบ "ตรวจงาน" ในหน้าแรก จะได้นับตรงกันเป๊ะ */
  function buildDeck(all, posts) {
    var lane1 = [], lane3 = [];
    var back = new Date(Date.now() - RV_BACK_DAYS * 86400000);
    all.forEach(function (t) {
      if (mineTask(t) || !canApprove(t)) return;
      var es = effStatus(t);
      if (es === 'review') { lane1.push({ type: 'task', id: t.id, t: t, lane: 'review' }); return; }
      /* งานประจำวนซ้ำทุกวัน ถ้านับด้วยจะมีของใหม่เข้ากองไม่รู้จบ — ตรวจที่ตัวงานเอาเอง */
      if (es !== 'done' || t.repeat) return;
      if (t.approvedBy === S.me.id) return;
      if (!t.doneAt || new Date(t.doneAt) < back) return;
      lane3.push({ type: 'task', id: t.id, t: t, lane: 'unseen' });
    });
    /* ค้างนานสุดขึ้นก่อน — คนที่รอผลตรวจมาสามวันไม่ควรไปอยู่ท้ายกอง */
    lane1.sort(function (a, b) { return (a.t.submittedAt || a.t.updatedAt) < (b.t.submittedAt || b.t.updatedAt) ? -1 : 1; });
    lane3.sort(function (a, b) { return (b.t.doneAt || '') < (a.t.doneAt || '') ? -1 : 1; });
    /* โพสต์ก็เป็นของที่ "ค้างที่หัวหน้า" เหมือนกัน — คนที่ตรวจงานไม่ได้ต้องไม่เห็นกองนี้เลย
       ไม่งั้นเติ้ล/พิซซ่าเปิด #/review แล้วเจอการ์ดโพสต์ ทั้งที่หน้านี้เป็นหน้าของหัวหน้า */
    var lane2 = canApprove() ? (posts || []).filter(function (p) { return p.status === 'plan'; })
      .map(function (p) { return { type: 'post', id: p.id, p: p, lane: 'post' }; }) : [];
    return lane1.concat(lane2, lane3);
  }
  /* ไม่ใช่หัวหน้า = ไม่มีอะไรให้ตรวจ บอกตรง ๆ ว่าหน้านี้ไม่ใช่ของเขา ดีกว่าโชว์กองว่างให้งง */
  function denyReview() {
    var view = $('#view');
    view.className = 'page';
    view.innerHTML = '<div class="top"><div><span class="kicker">ตรวจงาน</span><h1>ปัดตรวจ</h1>' +
      '<p>หน้านี้เป็นของหัวหน้า — งานที่ส่งมาจะไปเข้าคิวให้หัวหน้าตรวจ ไม่ต้องตรวจกันเองแล้ว</p></div>' +
      '<div class="top-r"><a class="btn" href="#/me">ไปงานของฉัน</a></div></div>';
    renderSidebar();
  }
  function rvTodayPosts() {
    var d = todayIso();
    return Promise.all([loadPages(), api('/posts?from=' + d + '&to=' + d)]).then(function (r) {
      var live = {};
      (S.pages || []).forEach(function (pg) { live[pg.id] = 1; });
      /* เพจที่ปิดใช้งานแล้วยังมีแถวค้างในตาราง อย่าเอามาให้ตรวจ */
      return (r[1].posts || []).filter(function (x) { return live[x.pageId]; });
    });
  }

  function renderReview() {
    if (readOnly() || !canApprove()) { denyReview(); return; }
    Promise.all([loadTasks(), rvTodayPosts()]).then(function (r) {
      RV.cards = buildDeck(r[0], r[1]);
      RV.i = 0; RV.last = null; RV.det = {}; RV.busy = false;
      /* กดเปิดงานเต็มแล้วกลับมา ต้องอยู่ใบเดิม ไม่ใช่เด้งกลับไปใบแรกแล้วปัดซ้ำทั้งกอง */
      if (RV.resume) {
        var ri = RV.cards.map(function (c) { return c.id; }).indexOf(RV.resume);
        if (ri !== -1) RV.i = ri;
        RV.resume = null;
      }
      /* ผูกลำดับไว้ให้หน้างานเต็มมีปุ่ม "← กลับไปปัดตรวจ" + ก่อนหน้า/ถัดไป ตามลำดับในกอง */
      markSeq(RV.cards.filter(function (c) { return c.type === 'task'; }), '#/review');
      RV.nSkip = 0; RV.nPass = 0; RV.nRej = 0;
      drawReview();
    }).catch(showError);
  }

  function drawReview() {
    var view = $('#view');
    view.className = 'page rvpage';
    var left = RV.cards.length - RV.i;
    var byLane = { review: 0, post: 0, unseen: 0 };
    RV.cards.slice(RV.i).forEach(function (c) { byLane[c.lane]++; });
    var h = '<div class="top"><div><span class="kicker">ตรวจงาน</span><h1>ปัดตรวจ</h1>' +
      '<p>' + (left
        ? 'เหลือ ' + left + ' ใบ — ' + [
            byLane.review ? 'ส่งมาให้ตรวจ ' + byLane.review : '',
            byLane.post ? 'โพสต์วันนี้ ' + byLane.post : '',
            byLane.unseen ? 'ปิดไปแล้วยังไม่ได้ตรวจ ' + byLane.unseen : ''
          ].filter(Boolean).join(' · ')
        : 'ไม่มีอะไรค้างที่คุณแล้ว') + '</p></div>' +
      '<div class="top-r"><a class="btn-ghost" href="#/all">ไปหน้ารายการ</a></div></div>';

    if (!left) {
      h += '<div class="rvdone"><div class="rvdonei">✓</div><b>' +
        (RV.nPass + RV.nRej ? 'ตรวจครบแล้ว' : 'ไม่มีอะไรรอตรวจ') + '</b>' +
        '<p>' + (RV.nPass + RV.nRej + RV.nSkip
          ? 'รอบนี้ผ่าน ' + RV.nPass + ' · ตีกลับ ' + RV.nRej + (RV.nSkip ? ' · ข้ามไว้ ' + RV.nSkip : '')
          : 'พอน้องกดส่งงานมาตรวจ หรือมีโพสต์ของวันนี้ที่ยังไม่ได้ติ๊ก รายการจะมาโผล่ที่นี่') + '</p>' +
        '<div class="acts">' + (RV.nSkip ? '<button type="button" class="btn" data-rv-again>ปัดของที่ข้ามไว้อีกรอบ</button>' : '') +
        '<a class="btn-ghost" href="#/all">ดูงานทั้งหมด</a></div></div>';
      view.innerHTML = h;
      return;
    }

    /* วาดแค่ 3 ใบบนสุด ใบที่เหลือโผล่มาทีหลัง — DOM เบาและการ์ดซ้อนดูมีความหนา */
    var stack = RV.cards.slice(RV.i, RV.i + 3);
    h += '<div class="rvwrap"><div class="rvdeck" id="rvDeck">' +
      stack.map(function (c, i) { return rvCard(c, i); }).reverse().join('') + '</div>' +
      '<div class="rvbar">' +
      '<button type="button" class="rvb rej" data-rv-act="reject" aria-label="ตีกลับ" title="ตีกลับ (ปัดซ้าย / ←)">✕</button>' +
      '<button type="button" class="rvb skip" data-rv-act="skip" aria-label="ข้ามไว้ก่อน" title="ข้ามไว้ก่อน (ปัดขึ้น / ↑)">↷</button>' +
      '<button type="button" class="rvb undo"' + (RV.last ? '' : ' disabled') + ' data-rv-act="undo" aria-label="ย้อนใบที่แล้ว" title="ย้อนใบที่แล้ว (Z)">↶</button>' +
      '<button type="button" class="rvb pass" data-rv-act="pass" aria-label="ผ่าน" title="ตรวจผ่าน (ปัดขวา / →)">✓</button>' +
      '</div>' +
      '<p class="rvhint">ปัดขวา = ผ่าน · ปัดซ้าย = ตีกลับ · ปัดขึ้น = ข้ามไว้ก่อน — บนคอมใช้ปุ่มลูกศรก็ได้</p>' +
      '</div>';
    view.innerHTML = h;
    wireReview();
    rvPrefetch();
  }

  function rvCard(c, depth) {
    /* ใบบนสุดอยู่ใน flow ปกติ (เป็นตัวกำหนดความสูงของกอง) ใบที่ซ้อนอยู่ข้างหลังเป็นการ์ดเปล่า
       ไม่ใส่เนื้อ เพราะเห็นแค่ขอบอยู่แล้ว และกัน data-rv-work ซ้ำกันหลายใบใน DOM
       ชื่อคลาสใช้ rvtop ไม่ใช่ top — .top เป็นคลาสหัวข้อหน้าที่เป็น flex อยู่แล้ว ชนกันแล้วการ์ดเพี้ยน */
    if (depth) return '<article class="rvcard" data-rv-i="' + (RV.i + depth) + '" style="--d:' + depth + '"></article>';
    return '<article class="rvcard rvtop" data-rv-i="' + (RV.i + depth) + '" style="--d:0">' +
      '<span class="rvstamp pass">ผ่าน</span><span class="rvstamp rej">ตีกลับ</span><span class="rvstamp skip">ข้ามไว้</span>' +
      (c.type === 'post' ? rvPostBody(c.p) : rvTaskBody(c.t, c.lane)) + '</article>';
  }
  function rvTaskBody(t, lane) {
    var k = kpiById(t.kpiId), es = effStatus(t);
    var when = lane === 'review'
      ? 'ส่งเมื่อ ' + fmtAgo(t.submittedAt || t.updatedAt)
      : 'ปิดเมื่อ ' + fmtAgo(t.doneAt || t.updatedAt) + (t.approvedBy ? ' โดย ' + esc(shortName(staffById(t.approvedBy))) : '');
    return '<div class="rvlane ' + lane + '">' + RV_LANE_TH[lane] + '</div>' +
      '<h2>' + esc(t.title) + '</h2>' +
      '<div class="rvmeta">' + avatars(t.assignees) +
        (k ? '<span class="pill">' + esc(k.code) + '</span>' : '') +
        (t.dueAt ? '<span class="pill' + (isLate(t) ? ' late' : '') + '">' + esc(fmtDue(t)) + '</span>' : '') +
        (es === 'review' ? '<span class="pill review">รอตรวจ</span>' : '') +
      '</div>' +
      '<div class="rvsub">' + when + '</div>' +
      (t.detail ? '<div class="rvdetail rich">' + richText(t.detail) + '</div>' : '') +
      '<div class="rvwork" data-rv-work="' + esc(t.id) + '"><span class="rvload">กำลังเปิดงานที่เขาส่งมา…</span></div>' +
      '<div class="rvacts"><a class="btn-text rvopen" href="#/task/' + esc(t.id) + '" data-rv-open="' + esc(t.id) + '">เปิดงานเต็ม ๆ</a>' +
      /* บางใบเป็นงานซ้ำที่สั่งมาสองรอบ — ลบทิ้งจากตรงนี้ได้เลย ไม่ต้องออกไปหน้างาน */
      (S.me && (S.me.role === 'owner' || t.createdBy === S.me.id)
        ? '<button type="button" class="btn-text danger" data-rv-del="' + esc(t.id) + '">ลบงานซ้ำนี้</button>' : '') +
      '</div>';
  }
  function rvPostBody(p) {
    return '<div class="rvlane post">' + RV_LANE_TH.post + '</div>' +
      '<h2>' + esc(p.topic || '(ยังไม่ใส่หัวข้อ)') + '</h2>' +
      '<div class="rvmeta"><span class="pill">' + esc(pageName(p.pageId)) + '</span>' +
        (p.time ? '<span class="pill">' + esc(p.time) + ' น.</span>' : '') +
        (p.channels || []).map(function (ch) { return '<span class="pill">' + esc(ch) + '</span>'; }).join('') +
      '</div>' +
      '<div class="rvsub">วันนี้ยังไม่ได้ติ๊กว่าโพสต์แล้ว</div>' +
      (S.me && S.me.role === 'owner'
        ? '<div class="rvacts"><button type="button" class="btn-text danger" data-rv-delpost="' + esc(p.id) + '">ลบโพสต์ซ้ำนี้</button></div>' : '') +
      (p.note ? '<div class="rvdetail rich">' + richText(p.note) + '</div>' : '') +
      '<div class="rvwork open"><label class="label">วางลิงก์โพสต์ (วางแล้วนับว่าโพสต์แล้วเลย)</label>' +
      '<input class="input" data-rv-url placeholder="https://…" autocomplete="off" inputmode="url"></div>' +
      '<p class="rvsub dim">ปัดขวา = โพสต์แล้ว · ปัดซ้าย = วันนี้ไม่โพสต์</p>';
  }

  /* เนื้องานที่น้องส่งมา (อัปเดตล่าสุด + รูป) โหลดแยกทีละใบ แล้วยัดเข้าการ์ดที่วาดไว้แล้ว
     โหลดล่วงหน้า 3 ใบ พอปัดใบบนออก ใบถัดไปมีของพร้อมอ่านทันที ไม่ต้องรอหมุน */
  function rvPrefetch() {
    RV.cards.slice(RV.i, RV.i + 3).forEach(function (c, depth) {
      if (c.type !== 'task') return;
      if (RV.det[c.id]) { if (!depth && RV.det[c.id] !== 'loading') rvFillWork(c.id); return; }
      RV.det[c.id] = 'loading';
      api('/tasks/' + c.id).then(function (j) {
        RV.det[c.id] = j;
        rvFillWork(c.id);
      }).catch(function () { RV.det[c.id] = null; rvFillWork(c.id); });
    });
  }
  function rvFillWork(id) {
    var box = $('[data-rv-work="' + id + '"]');
    if (!box) return;
    var j = RV.det[id];
    if (!j || j === 'loading') { box.innerHTML = '<span class="rvload dim">เปิดงานไม่ได้ — กด “เปิดงานเต็ม ๆ” ดูแทน</span>'; return; }
    var ups = (j.updates || []).filter(function (u) { return u.note; });
    var last = ups[0];
    var files = j.files || [];
    var h = '';
    if (last) {
      var s = staffById(last.staffId);
      h += '<div class="rvup"><b>' + esc(s ? shortName(s) : '?') + '</b> <time>' + esc(fmtAgo(last.createdAt)) + '</time>' +
        '<div class="rich">' + richText(last.note) + '</div></div>';
    }
    if (files.length) h += thumbsHtml(files.slice(0, 6));
    if (!h) h += '<span class="rvload dim">เขาไม่ได้เขียนอะไรมาและไม่มีไฟล์แนบ</span>';
    box.classList.add('open');
    box.innerHTML = h;
  }

  /* ---- ปัด ---- */
  function rvTop() { return $('.rvcard.rvtop'); }
  function wireReview() {
    var card = rvTop();
    if (!card) return;
    card.addEventListener('pointerdown', rvDown);
  }
  function rvDown(ev) {
    if (RV.busy) return;
    /* กดปุ่ม/ลิงก์/ช่องกรอกในการ์ด = ใช้งานของนั้น ไม่ใช่เริ่มปัด */
    if (ev.target.closest('a, button, input, textarea, .att')) return;
    var card = ev.currentTarget;
    RV.drag = { card: card, x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0, id: ev.pointerId };
    card.setPointerCapture(ev.pointerId);
    card.classList.add('rvdrag');
    card.addEventListener('pointermove', rvMove);
    card.addEventListener('pointerup', rvUp);
    card.addEventListener('pointercancel', rvUp);
  }
  function rvMove(ev) {
    var d = RV.drag;
    if (!d || ev.pointerId !== d.id) return;
    d.dx = ev.clientX - d.x0;
    d.dy = ev.clientY - d.y0;
    d.card.style.transform = 'translate(' + d.dx + 'px,' + d.dy + 'px) rotate(' + (d.dx / 26) + 'deg)';
    var up = d.dy < -60 && Math.abs(d.dx) < 70;
    d.card.classList.toggle('to-pass', !up && d.dx > 40);
    d.card.classList.toggle('to-rej', !up && d.dx < -40);
    d.card.classList.toggle('to-skip', up);
  }
  function rvUp(ev) {
    var d = RV.drag;
    if (!d || ev.pointerId !== d.id) return;
    d.card.removeEventListener('pointermove', rvMove);
    d.card.removeEventListener('pointerup', rvUp);
    d.card.removeEventListener('pointercancel', rvUp);
    d.card.classList.remove('rvdrag', 'to-pass', 'to-rej', 'to-skip');
    RV.drag = null;
    /* เกณฑ์ตัดสิน: 1 ใน 4 ของความกว้างการ์ด หรืออย่างน้อย 80px — จอแคบจะได้ไม่ต้องลากสุดจอ */
    var need = Math.max(80, d.card.offsetWidth * 0.25);
    if (d.dy < -110 && Math.abs(d.dx) < 80) { rvAct('skip'); return; }
    if (d.dx > need) { rvAct('pass'); return; }
    if (d.dx < -need) { rvAct('reject'); return; }
    d.card.style.transform = '';   /* ไม่ถึงเกณฑ์ = เด้งกลับที่เดิม */
  }
  function rvFly(dir, then) {
    var card = rvTop();
    if (!card) { then(); return; }
    var w = window.innerWidth + 260;
    card.style.transition = 'transform .28s ease, opacity .28s ease';
    card.style.transform = dir === 'skip' ? 'translateY(-120vh)'
      : 'translate(' + (dir === 'pass' ? w : -w) + 'px,40px) rotate(' + (dir === 'pass' ? 22 : -22) + 'deg)';
    card.style.opacity = '0';
    setTimeout(then, 240);
  }

  /* เอาการ์ดใบหนึ่งออกจากกอง แล้ววาดใหม่ — ใช้ตอนลบของซ้ำ ไม่ต้องโหลดกองใหม่ให้เสียตำแหน่ง */
  function rvDropCard(id) {
    var i = RV.cards.map(function (c) { return c.id; }).indexOf(id);
    if (i === -1) { render(); return; }
    RV.cards.splice(i, 1);
    if (i < RV.i) RV.i--;
    RV.last = null;
    drawReview();
  }

  function rvAct(act) {
    if (RV.busy) return;
    var c = RV.cards[RV.i];
    if (!c) return;
    if (act === 'skip') {
      RV.nSkip++;
      /* ข้ามไม่ยิง API — ย้ายไปท้ายกองเฉย ๆ ให้วนกลับมาเจออีกรอบตอนท้าย */
      rvFly('skip', function () {
        var moved = RV.cards.splice(RV.i, 1)[0];
        moved.skipped = true;
        RV.cards.push(moved);
        RV.last = null;
        drawReview();
      });
      return;
    }
    if (act === 'reject') { rvAskReason(c); return; }
    rvSend(c, true, '');
  }

  /* ตีกลับต้องมีเหตุผลเสมอ (เซิร์ฟเวอร์ปฏิเสธถ้าไม่มี) — ปุ่มสำเร็จรูปกดแล้วส่งเลย
     พิมพ์เองก็ได้ถ้าเหตุผลไม่ตรงอันไหน · ปิดแผ่นนี้ = การ์ดอยู่ที่เดิม ยังไม่ถูกตีกลับ */
  function rvAskReason(c) {
    /* ปัดซ้ายค้างการ์ดไว้นอกจอตอนเปิดแผ่นเหตุผล ถ้ากดยกเลิกการ์ดจะค้างเบี้ยวอยู่อย่างนั้น
       เด้งกลับที่เดิมก่อนเสมอ แล้วค่อยปล่อยให้บินออกตอนส่งจริง */
    var back = rvTop();
    if (back) { back.style.transition = 'transform .16s ease'; back.style.transform = ''; }
    var wrap = document.createElement('div');
    wrap.className = 'rvsheet';
    wrap.innerHTML = '<div class="rvsheet-b" role="dialog" aria-label="เหตุผลที่ตีกลับ">' +
      '<div class="rvsheet-h"><b>ตีกลับให้แก้ — บอกหน่อยว่าแก้อะไร</b>' +
      '<button type="button" class="x" data-rv-close aria-label="ปิด">✕</button></div>' +
      '<div class="chips">' + RV_REASONS.map(function (r) {
        return '<button type="button" class="chip" data-rv-reason="' + esc(r) + '">' + esc(r) + '</button>';
      }).join('') + '</div>' +
      '<textarea class="textarea" rows="2" data-rv-note placeholder="หรือพิมพ์เอง — เขาจะเห็นข้อความนี้ในกระดิ่ง"></textarea>' +
      '<div class="acts"><button type="button" class="btn" data-rv-send>ส่งกลับให้แก้</button>' +
      '<button type="button" class="btn-ghost" data-rv-close>ยกเลิก</button></div></div>';
    document.body.appendChild(wrap);
    var ta = wrap.querySelector('[data-rv-note]');
    var close = function () { wrap.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap || ev.target.closest('[data-rv-close]')) { close(); return; }
      var chip = ev.target.closest('[data-rv-reason]');
      if (chip) { close(); rvSend(c, false, chip.getAttribute('data-rv-reason')); return; }
      if (ev.target.closest('[data-rv-send]')) {
        var note = (ta.value || '').trim();
        if (!note) { ta.focus(); toast('ตีกลับต้องบอกด้วยว่าให้แก้อะไร', true); return; }
        close(); rvSend(c, false, note);
      }
    });
    setTimeout(function () { ta.focus(); }, 40);
  }

  function rvSend(c, pass, note) {
    RV.busy = true;
    var prev = c.type === 'post' ? c.p.status : effStatus(c.t);
    var req = c.type === 'post'
      ? (function () {
          /* วางลิงก์ไว้ในการ์ด = บันทึกลิงก์ไปด้วยเลย (เซิร์ฟเวอร์ถือว่าโพสต์แล้วอัตโนมัติ) */
          var box = rvTop(), inp = box ? box.querySelector('[data-rv-url]') : null;
          var u = inp && inp.value.trim();
          var body = { status: pass ? 'done' : 'skip' };
          if (pass && u) body.url = u;
          return api('/posts/' + c.id, 'PUT', body);
        }())
      : api('/tasks/' + c.id + '/review', 'POST', pass ? { pass: true } : { pass: false, note: note });
    req.then(function () {
      RV.busy = false;
      if (pass) RV.nPass++; else RV.nRej++;
      S.tasks = null;    /* รายการหน้าอื่นต้องโหลดใหม่ สถานะเปลี่ยนไปแล้ว */
      rvFly(pass ? 'pass' : 'reject', function () {
        RV.last = { card: c, at: RV.i, prev: prev };
        RV.i++;
        drawReview();
      });
    }).catch(function (e) {
      RV.busy = false;
      toast(e.message, true);
      var card = rvTop();
      if (card) { card.style.transition = 'transform .18s ease'; card.style.transform = ''; }
    });
  }

  /* ย้อนใบที่แล้ว — คืนสถานะเดิมให้ตรง ๆ แล้วดึงการ์ดกลับเข้ากอง (ปัดพลาดบนมือถือเกิดบ่อย) */
  function rvUndo() {
    var l = RV.last;
    if (!l || RV.busy) return;
    RV.busy = true;
    var req = l.card.type === 'post'
      ? api('/posts/' + l.card.id, 'PUT', { status: l.prev })
      : api('/tasks/' + l.card.id, 'PUT', { status: l.prev });
    req.then(function () {
      RV.busy = false;
      S.tasks = null;
      RV.i = l.at;
      RV.last = null;
      toast('ย้อนกลับมาแล้ว');
      drawReview();
    }).catch(function (e) { RV.busy = false; toast(e.message, true); });
  }

  function rvKey(ev) {
    if (S.route.name !== 'review' || RV.busy) return;
    if (ev.target.closest('input, textarea, [contenteditable]')) return;
    if ($('.rvsheet')) return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); rvAct('pass'); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); rvAct('reject'); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); rvAct('skip'); }
    else if (ev.key === 'z' || ev.key === 'Z') { ev.preventDefault(); rvUndo(); }
  }

  /* ---------- CRM: ลีด (#/leads · #/lead/:id) ------------------------------
     นนท์สั่ง 21 ก.ย. 69 — ลีดคือคนที่ทักมาจากแอด/เพจแล้วยังไม่ได้ซื้อ (เน้นรายคน ไม่ใช่ร้านค้าส่ง)
     สามทีมคนละหน้าที่: การตลาดบันทึกลีด → ทีมขายกด "รับลีด" แล้วไล่ปิด → ปิดได้ส่งต่อบัญชี
     บอร์ดใช้คลาสชุดเดียวกับงานป้าย (.kban/.kcol/.kcard) หน้าตาจึงเหมือนกันเป๊ะ ลากการ์ดได้เหมือนกัน
     ชื่อขั้นกับสีตรงกับ M CRM ทุกตัว — สองระบบจะได้คุยกันรู้เรื่องโดยไม่ต้องแปลศัพท์ */

  var LEAD_ST = [
    { k: 'new',       th: 'ใหม่',        hint: 'ยังไม่ได้ติดต่อ',      color: '#8B8A84' },
    { k: 'contacted', th: 'ติดต่อแล้ว',  hint: 'โทรหรือทักไปแล้ว',     color: '#8A14B4' },
    { k: 'qualified', th: 'มีแนวโน้ม',   hint: 'สนใจหรือนัดคุยแล้ว',   color: '#DC3232' },
    { k: 'proposal',  th: 'เสนอราคา',    hint: 'ส่งข้อเสนอแล้ว',       color: '#F06400' },
    { k: 'won',       th: 'ปิดการขาย',   hint: 'เป็นลูกค้าแล้ว',       color: '#1FA968' },
    { k: 'lost',      th: 'ไม่สำเร็จ',    hint: 'ปิดเคส',              color: '#B4B3AD' },
    { k: 'nurture',   th: 'ติดตามต่อ',   hint: 'ยังไม่พร้อมตอนนี้',    color: '#C97A00' }
  ];
  var LEAD_ST_TH = {};
  LEAD_ST.forEach(function (x) { LEAD_ST_TH[x.k] = x.th; });
  var LEAD_DONE = { won: 1, lost: 1 };
  var LEAD_SRC = [['fb', 'เพจ Facebook'], ['ig', 'Instagram'], ['line', 'LINE'], ['tiktok', 'TikTok'],
                  ['phone', 'โทรเข้า'], ['walkin', 'เดินเข้าร้าน'], ['referral', 'เพื่อนแนะนำ'], ['other', 'อื่นๆ']];
  var LEAD_SRC_TH = {};
  LEAD_SRC.forEach(function (x) { LEAD_SRC_TH[x[0]] = x[1]; });
  /* สาขาชุดเดียวกับปฏิทินการตลาด (cmo/campaign-calendar.js) — เพิ่มสาขาต้องแก้สองที่ */
  var LEAD_BRANCH = ['Kan Hub', 'Kan Fashion', 'ชุมพร', 'สุราษฎร์', 'Central', 'สหไทย', 'อื่นๆ'];
  var LEAD_ACT_TH = { create: 'บันทึกลีด', claim: 'รับลีด', status: 'เปลี่ยนขั้น', hand: 'ส่งต่อบัญชี',
                      note: 'โน้ต', call: 'โทร', line: 'LINE', meeting: 'นัดเจอ' };

  /* st = กรองเฉพาะขั้นเดียว (กดจากแถบสรุป) · flag = ชุดลัดจากการ์ดตัวเลขด้านบน */
  var LD = { who: '', src: '', branch: '', st: '', flag: '', hideDone: true };
  var LD_FLAG_TH = { untouched: 'ยังไม่ได้ติดต่อ', sla: 'เลยกรอบตอบกลับ', late: 'เลยวันนัดตาม', hand: 'รอส่งบัญชี' };
  function leadFlagged(l, f) {
    if (f === 'untouched') return leadUntouched(l);
    if (f === 'sla') return !!leadSla(l);
    if (f === 'late') return leadOverdue(l);
    if (f === 'hand') return l.status === 'won' && !l.handedAt;
    return true;
  }

  function loadLeads(force) {
    if (S.leads && !force) return Promise.resolve(S.leads);
    return api('/leads').then(function (j) { S.leads = j.leads || []; return S.leads; });
  }
  function leadById(id) { for (var i = 0; i < (S.leads || []).length; i++) if (S.leads[i].id === id) return S.leads[i]; return null; }
  /* ขยับลีดได้: หัวหน้า · เซลส์ที่ถือใบนี้ · หรือใครก็ได้ถ้ายังไม่มีคนรับ (กันลีดกองอยู่ช่องแรก) */
  function canRunLead(l) { return !readOnly() && !!S.me && (S.me.role === 'owner' || l.ownerId === S.me.id || !l.ownerId); }
  function leadOverdue(l) { return !!l.nextAt && !LEAD_DONE[l.status] && new Date(l.nextAt) < new Date(); }
  /* กรอบเวลาที่นนท์ตั้ง (21 ก.ย. 69): ทักมาแล้วควรติดต่อกลับภายใน 1 วัน ไม่เกิน 3 วัน
     นับจาก "วันที่ได้ลีดมา" ไม่ใช่วันที่พิมพ์เข้าระบบ ไม่งั้นของที่อิมพอร์ตย้อนหลังดูเหมือนเพิ่งเข้ามา */
  var LEAD_SLA_WARN = 1, LEAD_SLA_LATE = 3;
  function leadAgeDays(l) {
    var t = Date.parse(l.receivedAt || l.createdAt);
    return isNaN(t) ? 0 : Math.floor((Date.now() - t) / 86400000);
  }
  /* "ยังไม่ได้ติดต่อ" = ยังอยู่ขั้นแรก · ขยับไปขั้นไหนก็ตามถือว่าแตะแล้ว */
  function leadUntouched(l) { return l.status === 'new'; }
  function leadSla(l) {
    if (!leadUntouched(l)) return '';
    var d = leadAgeDays(l);
    if (d >= LEAD_SLA_LATE) return 'late';
    if (d >= LEAD_SLA_WARN) return 'warn';
    return '';
  }
  function leadAgeTh(l) {
    var d = leadAgeDays(l);
    return d <= 0 ? 'วันนี้' : (d === 1 ? 'เมื่อวาน' : d + ' วันก่อน');
  }
  function fmtMoney(n) { return Number(n || 0).toLocaleString('th-TH'); }

  function renderLeads() {
    Promise.all([loadLeads(), refreshStaffIfNeeded()]).then(function () {
      var all = S.leads || [];
      var mine = all.filter(function (l) { return l.ownerId === S.me.id && !LEAD_DONE[l.status]; });
      var free = all.filter(function (l) { return !l.ownerId && !LEAD_DONE[l.status]; });
      var late = all.filter(leadOverdue);
      var toHand = all.filter(function (l) { return l.status === 'won' && !l.handedAt; });

      var shown = all.filter(function (l) {
        if (LD.who === 'me' && l.ownerId !== S.me.id) return false;
        if (LD.who === 'free' && l.ownerId) return false;
        if (LD.src && l.source !== LD.src) return false;
        if (LD.branch && l.branch !== LD.branch) return false;
        if (LD.st && l.status !== LD.st) return false;
        if (LD.flag && !leadFlagged(l, LD.flag)) return false;
        if (LD.hideDone && LEAD_DONE[l.status]) return false;
        return true;
      });

      /* กลุ่มตาม SLA — ของที่ต้องโทรวันนี้กับของที่ปล่อยเกินกรอบไปแล้ว */
      var slaLate = all.filter(function (l) { return leadSla(l) === 'late'; });
      var slaWarn = all.filter(function (l) { return leadSla(l) === 'warn'; });
      var untouched = all.filter(leadUntouched);
      var contacted = all.filter(function (l) { return !leadUntouched(l); });
      var won = all.filter(function (l) { return l.status === 'won'; });
      var lost = all.filter(function (l) { return l.status === 'lost'; });
      var closed = won.length + lost.length;
      var openLeads = all.filter(function (l) { return !LEAD_DONE[l.status]; });
      var pipeline = openLeads.reduce(function (a, l) { return a + (l.estValue || 0); }, 0);
      var pct = function (n, d) { return d ? Math.round(n / d * 100) : 0; };

      var view = $('#view');
      view.className = 'page';
      var h = '<div class="top"><div><span class="kicker">CRM</span><h1>ลีด</h1>' +
        '<p>คนที่ทักมาจากแอด/เพจแล้วยังไม่ได้ซื้อ — การตลาดบันทึกเข้ามา ทีมขายกดรับแล้วไล่ปิด ปิดได้แล้วส่งต่อบัญชี</p></div>' +
        '<div class="top-r">' + (readOnly() ? '' : '<button type="button" class="btn" id="newLead">+ เพิ่มลีด</button>') + '</div></div>';

      /* แถบเตือนบนสุด — ขึ้นเฉพาะตอนมีของต้องโทร ไม่มีก็ไม่ต้องรก */
      if (slaLate.length || slaWarn.length) {
        h += '<div class="postbar ' + (slaLate.length ? 'bad' : 'warn') + '"><span class="pbi">' +
          (slaLate.length ? '<b>' + slaLate.length + ' ราย เลยกรอบ ' + LEAD_SLA_LATE + ' วันแล้ว</b> ยังไม่ได้ติดต่อเลย' : '') +
          (slaLate.length && slaWarn.length ? ' · ' : '') +
          (slaWarn.length ? '<b>' + slaWarn.length + ' ราย ควรติดต่อกลับวันนี้</b>' : '') +
          ' — ทักมาแล้วควรตอบใน ' + LEAD_SLA_WARN + ' วัน ไม่เกิน ' + LEAD_SLA_LATE + ' วัน</span>' +
          '<button type="button" class="btn sm" data-lq="sla">ดูเฉพาะที่ต้องโทร</button></div>';
      }

      var cardCls = function (base, q) {
        var on = (q === 'me' || q === 'free') ? LD.who === q : LD.flag === q;
        var c = (base ? base + ' ' : '') + (on ? 'on' : '');
        return c.trim() ? ' class="' + c.trim() + '"' : '';
      };
      h += '<div class="cards">' +
        '<article' + cardCls('hot', 'untouched') + ' data-lq="untouched"><span class="l">ยังไม่ได้ติดต่อ</span><b>' + untouched.length + '</b><small>' +
          (slaLate.length ? 'เลยกรอบแล้ว ' + slaLate.length + ' ราย' : 'ทั้งหมดยังอยู่ในกรอบ') + '</small></article>' +
        '<article' + cardCls(mine.length ? 'warn' : '', 'me') + ' data-lq="me"><span class="l">ของฉันกำลังไล่</span><b>' + mine.length + '</b><small>ยังไม่จบเคส</small></article>' +
        '<article' + cardCls(late.length ? 'bad' : '', 'late') + ' data-lq="late"><span class="l">เลยวันนัดตาม</span><b>' + late.length + '</b><small>ถึงคิวตามแล้ว</small></article>' +
        '<article' + cardCls('', 'hand') + ' data-lq="hand"><span class="l">รอส่งบัญชี</span><b>' + toHand.length + '</b><small>ปิดการขายแล้ว</small></article></div>';

      /* รายงานสรุป — ตัวเลขที่ CRM ทั่วไปดูกัน: อัตราติดต่อ · อัตราปิด · มูลค่าที่ยังเปิดอยู่ · แยกตามขั้นและช่องทาง */
      var bySrc = {};
      all.forEach(function (l) { bySrc[l.source] = (bySrc[l.source] || 0) + 1; });
      var stCount = {};
      all.forEach(function (l) { stCount[l.status] = (stCount[l.status] || 0) + 1; });

      h += '<div class="sec"><div class="sec-h"><h2>สรุปลีด</h2><p>' + all.length + ' ราย · รอคนรับ ' + free.length + '</p></div><div class="sec-b">' +
        '<div class="lstat">' +
        '<div><span class="k">ติดต่อแล้ว</span><b>' + contacted.length + '<i>/' + all.length + '</i></b><small>' + pct(contacted.length, all.length) + '% ของลีดทั้งหมด</small></div>' +
        '<div><span class="k">ปิดการขาย</span><b>' + won.length + '</b><small>' + (closed ? pct(won.length, closed) + '% ของที่จบเคสแล้ว (' + closed + ' ราย)' : 'ยังไม่มีเคสที่จบ') + '</small></div>' +
        '<div><span class="k">ยังเปิดอยู่</span><b>' + openLeads.length + '</b><small>ยังไล่ปิดได้</small></div>' +
        '<div><span class="k">มูลค่าในไปป์ไลน์</span><b>' + fmtMoney(pipeline) + '<i> บาท</i></b><small>เฉพาะที่ยังไม่จบเคส</small></div>' +
        '</div>' +
        /* แถบขั้น — สัดส่วนจริงตามจำนวน กดแล้วกรองเฉพาะขั้นนั้น */
        '<div class="lbar">' + LEAD_ST.map(function (x) {
          var n = stCount[x.k] || 0;
          if (!n) return '';
          return '<button type="button" class="lbseg' + (LD.st === x.k ? ' on' : '') + '" data-lst-filter="' + x.k + '" title="' + esc(x.th + ' · ' + n + ' ราย') +
            '" style="--kc:' + x.color + ';flex:' + n + '"><i></i><span>' + esc(x.th) + ' ' + n + '</span></button>';
        }).join('') + '</div>' +
        '<div class="lsrc">ช่องทางที่ทักมา: ' + Object.keys(bySrc).sort(function (a, b) { return bySrc[b] - bySrc[a]; })
          .map(function (k) { return '<span>' + esc(LEAD_SRC_TH[k] || k) + ' <b>' + bySrc[k] + '</b></span>'; }).join('') + '</div>' +
        '</div></div>';

      /* แถบกรอง — ชุดเดียวกับหน้างานทั้งหมด (seg + select) จะได้ไม่ต้องเรียนรู้ใหม่ */
      h += '<div class="tbar"><div class="seg">' +
        [['', 'ทั้งทีม'], ['me', 'ของฉัน'], ['free', 'ยังไม่มีคนรับ']].map(function (o) {
          return '<button type="button" class="' + (LD.who === o[0] ? 'on' : '') + '" data-lf="who" data-v="' + o[0] + '">' + esc(o[1]) + '</button>';
        }).join('') + '</div>' +
        '<select class="input sm" data-lf="src"><option value="">ทุกช่องทาง</option>' +
        LEAD_SRC.map(function (o) { return '<option value="' + o[0] + '"' + (LD.src === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
        '<select class="input sm" data-lf="branch"><option value="">ทุกสาขา</option>' +
        LEAD_BRANCH.map(function (b) { return '<option value="' + esc(b) + '"' + (LD.branch === b ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('') + '</select>' +
        '<label class="lchk"><input type="checkbox" data-lf="hideDone"' + (LD.hideDone ? ' checked' : '') + '> ซ่อนที่จบเคสแล้ว</label>' +
        ((LD.st || LD.flag) ? '<button type="button" class="chip on" data-lclear="1">' +
          esc(LD.st ? LEAD_ST_TH[LD.st] : LD_FLAG_TH[LD.flag]) + ' ✕</button>' : '') +
        '<span class="kbar-n">' + shown.length + ' ลีด</span></div>';

      h += leadBoard(shown);
      view.innerHTML = h;
      var nb = $('#newLead');
      if (nb) nb.addEventListener('click', function () { leadSheet(null); });
    }).catch(showError);
  }

  function leadBoard(list) {
    var by = {};
    list.forEach(function (l) { (by[l.status] = by[l.status] || []).push(l); });
    var cols = LEAD_ST.map(function (c) {
      var items = by[c.k] || [];
      var money = items.reduce(function (a, l) { return a + (l.estValue || 0); }, 0);
      var lateN = items.filter(leadOverdue).length;
      return '<section class="kcol" data-lcol="' + c.k + '" style="--kc:' + c.color + '">' +
        '<header class="khdr"><b>' + esc(c.th) + '</b><span>/ ' + items.length + '</span></header>' +
        '<div class="ksum">' + (money ? '<b>' + fmtMoney(money) + '</b> บาท' : '<b>' + items.length + '</b> ลีด') +
        (lateN ? '<em>เลยวันตาม ' + lateN + '</em>' : '') + '<small>' + esc(c.hint) + '</small></div>' +
        '<div class="kbody">' + (items.length ? items.map(leadCard).join('') : '<p class="kempty">ไม่มีลีด</p>') + '</div></section>';
    }).join('');
    return '<div class="kban">' + cols + '</div>' +
      '<p class="khint">ลากการ์ดข้ามคอลัมน์เพื่อเปลี่ยนขั้น — ลากลีดที่ยังไม่มีคนรับ = คุณรับไปดูแลเลย · ' +
      'กดที่การ์ดเพื่อเปิดลีด · บน iPad/มือถือ <b>แตะการ์ดค้างแป๊บนึงแล้วลาก</b></p>';
  }

  function leadCard(l) {
    var late = leadOverdue(l);
    var own = staffById(l.ownerId);
    var sla = leadSla(l);
    /* ชิปแรกคือ "ได้มาเมื่อไหร่" เสมอ — เป็นตัวเลขที่ต้องเห็นก่อนตัดสินใจว่าจะโทรใบไหน */
    var chips = '<span class="kchip age' + (sla ? ' ' + sla : '') + '" title="' +
      esc('ได้ลีดมา ' + fmtDate(new Date(l.receivedAt || l.createdAt), true)) + '"><i></i>' +
      (sla ? 'ค้าง ' + leadAgeDays(l) + ' วัน' : 'ได้มา ' + esc(leadAgeTh(l))) + '</span>' +
      '<span class="kchip"><i></i>' + esc(LEAD_SRC_TH[l.source] || l.source) + '</span>';
    if (l.branch) chips += '<span class="kchip"><i></i>' + esc(l.branch) + '</span>';
    if (l.boughtBefore) chips += '<span class="kchip"><i></i>เคยซื้อแล้ว</span>';
    if (l.estValue) chips += '<span class="kchip"><i></i>' + fmtMoney(l.estValue) + ' บาท</span>';
    if (l.nextAt) chips += '<span class="kchip due' + (late ? ' late' : '') + '"><i></i>ตาม ' + esc(fmtDate(new Date(l.nextAt))) + '</span>';
    if (l.status === 'won') chips += '<span class="kchip' + (l.handedAt ? '' : ' pri') + '"><i></i>' + (l.handedAt ? 'ส่งบัญชีแล้ว' : 'รอส่งบัญชี') + '</span>';
    return '<div class="kitem"><article class="kcard' + (late || sla === 'late' ? ' late' : '') + '" draggable="' + (canRunLead(l) ? 'true' : 'false') +
      '" data-kid="' + esc(l.id) + '" data-lopen="' + esc(l.id) + '">' +
      '<div class="khead"><b>' + esc(l.name) + '</b></div>' +
      '<div class="kchips">' + chips + '</div>' +
      (l.interest ? '<p class="lint">' + esc(l.interest.slice(0, 90)) + (l.interest.length > 90 ? '…' : '') + '</p>' : '') +
      '<div class="kfoot">' +
      (own ? '<span class="avs">' + avatar(own) + '</span><span class="kwho">' + esc(shortName(own)) + '</span>'
           : '<span class="kwho warn">ยังไม่มีคนรับ</span>') +
      (l.nAct ? '<span class="kcnt" title="ประวัติ">' + svgIcon('chat') + l.nAct + '</span>' : '') +
      '</div></article></div>';
  }

  /* ลากการ์ดลีด — ใช้ตัวลากชุดเดียวกับบอร์ดงาน แค่แยกตอนตกลงคอลัมน์ */
  function leadDrop(id, want) {
    var l = leadById(id);
    if (!l) { render(); return; }
    if (!want || l.status === want) { render(); return; }
    if (!canRunLead(l)) { toast('ลีดนี้มีเซลส์ดูแลอยู่แล้ว', true); render(); return; }
    /* ตีตกต้องมีเหตุผล — เซิร์ฟเวอร์ก็กัน ถามตรงนี้ก่อนจะได้ไม่ต้องเด้ง error */
    if (want === 'lost' && !l.lostReason) {
      var why = window.prompt('ปิดเป็น “ไม่สำเร็จ” เพราะอะไร');
      if (why == null || !why.trim()) { render(); return; }
      api('/leads/' + id, 'PUT', { status: 'lost', lostReason: why.trim() })
        .then(function () { S.leads = null; toast('ปิดเคสแล้ว'); render(); })
        .catch(function (e) { toast(e.message, true); render(); });
      return;
    }
    api('/leads/' + id, 'PUT', { status: want }).then(function () {
      S.leads = null;
      toast('ย้ายไป “' + (LEAD_ST_TH[want] || want) + '” แล้ว' + (!l.ownerId ? ' · คุณรับลีดนี้แล้ว' : ''));
      render();
    }).catch(function (e) { toast(e.message, true); render(); });
  }

  /* ---------- หน้าลีดรายใบ ---------- */
  function renderLead(id) {
    Promise.all([api('/leads/' + id), refreshStaffIfNeeded()]).then(function (r) {
      var j = r[0], l = j.lead, acts = j.activities || [];
      var own = staffById(l.ownerId), by = staffById(l.createdBy);
      var st = LEAD_ST.filter(function (x) { return x.k === l.status; })[0] || LEAD_ST[0];
      var may = canRunLead(l);
      var view = $('#view');
      view.className = 'page';
      var h = '<div class="top"><div><div class="crumbs"><a href="#/leads">ลีดทั้งหมด</a><span>›</span>' +
        '<span class="pill" style="--kc:' + st.color + ';border-color:' + st.color + ';color:' + st.color + '">' + esc(st.th) + '</span></div>' +
        '<h1>' + esc(l.name) + '</h1>' +
        '<p>' + esc(LEAD_SRC_TH[l.source] || l.source) + (l.sourceDetail ? ' · ' + esc(l.sourceDetail) : '') +
        ' · บันทึกโดย ' + esc(by ? shortName(by) : '—') + ' ' + esc(fmtAgo(l.createdAt)) + '</p></div>' +
        '<div class="top-r">' +
        (may ? '<button type="button" class="btn-ghost" data-ledit="' + esc(l.id) + '">แก้ไข</button>' : '') +
        (!l.ownerId && !readOnly() ? '<button type="button" class="btn" data-lclaim="' + esc(l.id) + '">รับลีดนี้</button>' : '') +
        (l.status === 'won' && !l.handedAt && may ? '<button type="button" class="btn" data-lhand="' + esc(l.id) + '">ส่งต่อบัญชี</button>' : '') +
        '</div></div>';

      /* ข้อมูลติดต่อ — กดโทร/เปิด LINE ได้เลยจากมือถือ ไม่ต้องก๊อป */
      var rows = [];
      var lsla = leadSla(l);
      rows.push(['ได้ลีดมาเมื่อ', esc(fmtDate(new Date(l.receivedAt || l.createdAt), true)) +
        ' <span class="' + (lsla ? 'warn' : 'mut') + '">(' + esc(leadAgeTh(l)) +
        (lsla === 'late' ? ' · เลยกรอบ ' + LEAD_SLA_LATE + ' วันแล้ว ยังไม่ได้ติดต่อ'
         : lsla === 'warn' ? ' · ควรติดต่อกลับวันนี้' : '') + ')</span>']);
      if (l.fbName) rows.push(['ชื่อที่ทักเข้ามา', esc(l.fbName)]);
      if (l.phone) rows.push(['เบอร์', '<a href="tel:' + esc(l.phone.replace(/[^0-9+]/g, '')) + '">' + esc(l.phone) + '</a>']);
      if (l.lineId) rows.push(['LINE', esc(l.lineId)]);
      if (l.branch) rows.push(['สาขา', esc(l.branch)]);
      rows.push(['เคยซื้อแล้ว', l.boughtBefore ? 'เคย' : 'ยังไม่เคย']);
      if (l.estValue) rows.push(['ยอดที่คาด', fmtMoney(l.estValue) + ' บาท']);
      rows.push(['เซลส์ที่ดูแล', own ? esc(own.name) : '<span class="warn">ยังไม่มีคนรับ</span>']);
      if (l.nextAt) rows.push(['ตามครั้งถัดไป', '<span class="' + (leadOverdue(l) ? 'warn' : '') + '">' + esc(fmtDate(new Date(l.nextAt), true)) + '</span>']);
      if (l.lostReason) rows.push(['เหตุผลที่ไม่สำเร็จ', esc(l.lostReason)]);
      if (l.handedAt) rows.push(['ส่งต่อบัญชี', esc(fmtAgo(l.handedAt)) + ' โดย ' + esc(shortName(staffById(l.handedBy)))]);

      h += '<div class="lgrid"><div>' +
        '<div class="sec"><div class="sec-h"><h2>ข้อมูลลีด</h2></div><div class="sec-b">' +
        '<dl class="ldl">' + rows.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl>' +
        (l.interest ? '<div class="rich" style="margin-top:14px">' + richText(l.interest) + '</div>' : '') + '</div></div>';

      /* เปลี่ยนขั้น — ชิปเรียงตามลำดับจริง กดทีเดียวจบ ไม่ต้องเปิดฟอร์ม */
      if (may) {
        h += '<div class="sec"><div class="sec-h"><h2>ขั้นของลีด</h2><p>กดเพื่อย้ายขั้น</p></div><div class="sec-b">' +
          '<div class="chips">' + LEAD_ST.map(function (x) {
            return '<button type="button" class="chip plain' + (l.status === x.k ? ' on' : '') + '" data-lst="' + x.k + '" title="' + esc(x.hint) + '">' + esc(x.th) + '</button>';
          }).join('') + '</div></div></div>';
      }

      h += '</div><div>';
      /* บันทึกความคืบหน้า */
      if (!readOnly()) {
        h += '<div class="sec"><div class="sec-h"><h2>บันทึกความคืบหน้า</h2><p>ใครก็เขียนได้ ไม่ต้องถือลีด</p></div>' +
          '<div class="sec-b"><form id="lactForm" class="upl">' +
          '<div class="chips" style="margin-bottom:10px">' +
          [['note', 'โน้ต'], ['call', 'โทร'], ['line', 'LINE'], ['meeting', 'นัดเจอ']].map(function (o, i) {
            return '<button type="button" class="chip plain' + (i === 0 ? ' on' : '') + '" data-lkind="' + o[0] + '">' + o[1] + '</button>';
          }).join('') + '</div>' +
          '<textarea class="textarea" name="body" rows="2" placeholder="คุยอะไรไป ลูกค้าว่าไง นัดเมื่อไหร่"></textarea>' +
          '<div class="acts"><button type="submit" class="btn">บันทึก</button></div></form></div></div>';
      }
      h += '<div class="sec"><div class="sec-h"><h2>ประวัติ</h2><p>' + acts.length + ' รายการ</p></div><div class="sec-b"><div class="tl">' +
        (acts.length ? acts.map(function (a) {
          var s = staffById(a.staffId);
          return '<div class="tl-i">' + avatar(s, 'lg') + '<div><div class="h"><b>' + esc(s ? shortName(s) : '?') + '</b>' +
            '<span>' + esc(LEAD_ACT_TH[a.kind] || a.kind) + '</span><time>' + esc(fmtAgo(a.createdAt)) + '</time></div>' +
            (a.body ? '<div class="n rich">' + richText(a.body) + '</div>' : '') + '</div></div>';
        }).join('') : '<div class="empty">ยังไม่มีประวัติ</div>') + '</div></div></div>';

      h += '</div></div>';
      if (S.me.role === 'owner' || l.createdBy === S.me.id) {
        h += '<div class="sec"><div class="sec-b"><button type="button" class="btn-ghost danger" data-ldel="' + esc(l.id) + '">ลบลีดนี้</button></div></div>';
      }
      view.innerHTML = h;
      wireLead(l);
    }).catch(showError);
  }

  function wireLead(l) {
    var kind = 'note';
    $$('[data-lkind]').forEach(function (b) {
      b.addEventListener('click', function () {
        kind = b.getAttribute('data-lkind');
        $$('[data-lkind]').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
    var f = $('#lactForm');
    if (f) f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ta = f.querySelector('[name="body"]');
      var body = (ta.value || '').trim();
      if (!body) { ta.focus(); return; }
      api('/leads/' + l.id + '/activities', 'POST', { kind: kind, body: body })
        .then(function () { S.leads = null; toast('บันทึกแล้ว'); renderLead(l.id); })
        .catch(function (e) { toast(e.message, true); });
    });
    $$('[data-lst]').forEach(function (b) {
      b.addEventListener('click', function () {
        var want = b.getAttribute('data-lst');
        if (want === l.status) return;
        if (want === 'lost' && !l.lostReason) {
          var why = window.prompt('ปิดเป็น “ไม่สำเร็จ” เพราะอะไร');
          if (why == null || !why.trim()) return;
          api('/leads/' + l.id, 'PUT', { status: 'lost', lostReason: why.trim() })
            .then(function () { S.leads = null; renderLead(l.id); }).catch(function (e) { toast(e.message, true); });
          return;
        }
        api('/leads/' + l.id, 'PUT', { status: want })
          .then(function () { S.leads = null; toast('ย้ายไป “' + (LEAD_ST_TH[want] || want) + '” แล้ว'); renderLead(l.id); })
          .catch(function (e) { toast(e.message, true); });
      });
    });
  }

  /* ---------- ฟอร์มเพิ่ม/แก้ลีด ---------- */
  function leadSheet(lead) {
    var host = document.createElement('div');
    host.className = 'modal';
    var v = lead || { name: '', phone: '', lineId: '', source: 'fb', sourceDetail: '', interest: '',
                      branch: '', estValue: 0, boughtBefore: 0, nextAt: null, ownerId: '',
                      fbName: '', receivedAt: new Date().toISOString() };
    host.innerHTML = '<div class="modal-box qbox"><div class="sec-h"><h2>' + (lead ? 'แก้ไขลีด' : 'เพิ่มลีด') + '</h2>' +
      '<p>ช่องที่ต้องมีคือชื่อกับช่องทางที่ทักมา ที่เหลือเติมทีหลังได้</p></div>' +
      '<div class="qbody"><form id="leadForm" class="upl">' +
      '<div class="field"><label class="label">ชื่อลีด <small>ชื่อที่ใช้เรียก ไม่รู้ชื่อจริงใส่ชื่อโปรไฟล์ไปก่อน</small></label>' +
      '<input class="input" name="name" maxlength="120" required value="' + esc(v.name) + '" autocomplete="off"></div>' +
      '<div class="lrow2">' +
      '<div class="field"><label class="label">เบอร์</label><input class="input" name="phone" maxlength="40" inputmode="tel" value="' + esc(v.phone) + '"></div>' +
      '<div class="field"><label class="label">LINE</label><input class="input" name="lineId" maxlength="80" value="' + esc(v.lineId) + '"></div></div>' +
      '<div id="leadDup" class="leaddup" hidden></div>' +
      '<div class="lrow2">' +
      '<div class="field"><label class="label">ทักมาจากไหน</label><select class="input" name="source">' +
      LEAD_SRC.map(function (o) { return '<option value="' + o[0] + '"' + (v.source === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label class="label">สาขาที่ใกล้</label><select class="input" name="branch"><option value="">—</option>' +
      LEAD_BRANCH.map(function (b) { return '<option value="' + esc(b) + '"' + (v.branch === b ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="lrow2">' +
      '<div class="field"><label class="label">ชื่อที่ทักเข้ามา <small>ชื่อโปรไฟล์ในเพจ/LINE</small></label>' +
      '<input class="input" name="fbName" maxlength="120" value="' + esc(v.fbName || '') + '"></div>' +
      '<div class="field"><label class="label">ได้ลีดมาเมื่อ <small>ใช้นับกรอบ ' + LEAD_SLA_WARN + '–' + LEAD_SLA_LATE + ' วัน</small></label>' +
      '<input class="input" name="receivedAt" type="datetime-local" value="' + esc(v.receivedAt ? toLocalInput(v.receivedAt) : '') + '"></div></div>' +
      '<div class="field"><label class="label">ที่มาเพิ่มเติม <small>เช่น ชื่อแคมเปญ หรือโพสต์ที่เขาทักมา</small></label>' +
      '<input class="input" name="sourceDetail" maxlength="200" value="' + esc(v.sourceDetail) + '"></div>' +
      '<div class="field"><label class="label">สนใจอะไร</label>' +
      '<textarea class="textarea" name="interest" rows="2" maxlength="1000">' + esc(v.interest) + '</textarea></div>' +
      '<div class="lrow2">' +
      '<div class="field"><label class="label">ยอดที่คาด (บาท)</label><input class="input" name="estValue" type="number" min="0" inputmode="numeric" value="' + esc(String(v.estValue || '')) + '"></div>' +
      '<div class="field"><label class="label">ตามครั้งถัดไป</label><input class="input" name="nextAt" type="datetime-local" value="' + esc(v.nextAt ? toLocalInput(v.nextAt) : '') + '"></div></div>' +
      '<div class="field"><label class="label">เซลส์ที่ดูแล <small>ว่างไว้ = ปล่อยให้ทีมขายมากดรับเอง</small></label>' +
      '<select class="input" name="ownerId"><option value="">— ยังไม่มีคนรับ —</option>' +
      S.staff.filter(function (x) { return x.active; }).map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (v.ownerId === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>';
      }).join('') + '</select></div>' +
      '<label class="lchk"><input type="checkbox" name="boughtBefore"' + (v.boughtBefore ? ' checked' : '') + '> เคยซื้อของเราแล้ว</label>' +
      '</form></div>' +
      '<div class="qacts"><button type="button" class="btn-ghost" data-q-close>ยกเลิก</button>' +
      '<button type="button" class="btn" id="leadSave">' + (lead ? 'บันทึก' : 'เพิ่มลีด') + '</button></div></div>';
    document.body.appendChild(host);
    var close = function () { host.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey);
    host.addEventListener('click', function (ev) {
      if (ev.target === host || ev.target.closest('[data-q-close]')) close();
    });
    /* เบอร์/LINE ซ้ำกับลีดเดิม — เตือนทันทีพร้อมปุ่มพาไปดูใบเดิม (นนท์ 24 ก.ย. 69) */
    function digits(x) { return String(x || '').replace(/\D/g, ''); }
    function sameLine(a, b) { return a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); }
    function findDup() {
      var f0 = $('#leadForm', host);
      var ph = digits((f0.querySelector('[name="phone"]') || {}).value);
      var li = ((f0.querySelector('[name="lineId"]') || {}).value || '').trim();
      var tail = ph.slice(-9);
      return (S.leads || []).filter(function (x) {
        if (lead && x.id === lead.id) return false;
        if (tail.length >= 9 && digits(x.phone).slice(-9) === tail) return true;
        return li && sameLine(x.lineId, li);
      });
    }
    function paintDup() {
      var box = $('#leadDup', host);
      var hits = findDup();
      if (!hits.length) { box.hidden = true; box.innerHTML = ''; return; }
      box.hidden = false;
      box.innerHTML = '<b>⚠️ ซ้ำกับลีดที่มีอยู่แล้ว ' + hits.length + ' ใบ</b>' +
        hits.slice(0, 3).map(function (x) {
          var own = x.ownerId ? shortName(staffById(x.ownerId)) : 'ยังไม่มีเจ้าของ';
          return '<div class="ld1"><span><b>' + esc(x.name || '(ไม่มีชื่อ)') + '</b> · ' + esc(x.phone || x.lineId || '') +
            ' · ' + esc(LEAD_ST_TH[x.status] || x.status) + ' · ' + esc(own) + ' · ' + esc(fmtAgo(x.createdAt)) + '</span>' +
            '<button type="button" class="btn-ghost sm" data-dupgo="' + esc(x.id) + '">เปิดลีดนี้</button></div>';
        }).join('') + (hits.length > 3 ? '<div class="ld1"><span>…และอีก ' + (hits.length - 3) + ' ใบ</span></div>' : '');
    }
    ['phone', 'lineId'].forEach(function (n) {
      var el = host.querySelector('[name="' + n + '"]');
      if (el) el.addEventListener('input', paintDup);
    });
    paintDup();
    host.addEventListener('click', function (ev) {
      var g = ev.target.closest('[data-dupgo]');
      if (!g) return;
      ev.preventDefault(); ev.stopPropagation();
      close();
      location.hash = '#/lead/' + g.getAttribute('data-dupgo');
    });
    $('#leadSave', host).addEventListener('click', function () {
      var f = $('#leadForm', host);
      var g = function (n) { return (f.querySelector('[name="' + n + '"]') || {}).value || ''; };
      var body = {
        name: g('name').trim(), phone: g('phone').trim(), lineId: g('lineId').trim(),
        source: g('source'), sourceDetail: g('sourceDetail').trim(), interest: g('interest').trim(),
        branch: g('branch'), estValue: Number(g('estValue')) || 0,
        boughtBefore: f.querySelector('[name="boughtBefore"]').checked ? 1 : 0,
        nextAt: g('nextAt') ? new Date(g('nextAt')).toISOString() : '',
        ownerId: g('ownerId'), fbName: g('fbName').trim(),
        receivedAt: g('receivedAt') ? new Date(g('receivedAt')).toISOString() : '',
      };
      if (!body.name) { f.querySelector('[name="name"]').focus(); toast('ใส่ชื่อลีดก่อน', true); return; }
      var req = lead ? api('/leads/' + lead.id, 'PUT', body) : api('/leads', 'POST', body);
      req.then(function (j) {
        S.leads = null;
        close();
        toast(lead ? 'บันทึกแล้ว' : 'เพิ่มลีดแล้ว');
        if (!lead && j && j.id) location.hash = '#/lead/' + j.id; else render();
      }).catch(function (e) { toast(e.message, true); });
    });
    setTimeout(function () { var n = $('[name="name"]', host); if (n) n.focus(); }, 40);
  }

  /* หน้าลีดเปิดตรงจากลิงก์ได้ ต้องมั่นใจว่ามีรายชื่อทีมไว้แปลง id เป็นชื่อคน */
  function refreshStaffIfNeeded() {
    if (S.staff && S.staff.length) return Promise.resolve(S.staff);
    return refreshMe().then(function () { return S.staff; });
  }

  /* ---------- งานทั้งหมด ---------- */
  var F = { who: '', kpi: '', status: 'open', group: 'due', range: 'all', campaign: '', ttype: '', kind: '' };
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
    if (q.ttype !== undefined) { F.ttype = q.ttype; }
    Promise.all([loadTasks(), loadCampaigns()]).then(function (r) {
      var all = r[0];
      var meIdA = S.viewAs || S.me.id;
      /* ทั้งทีม = นับเฉพาะงานหลัก (ไม่งั้นซ้ำกับงานย่อย) · ของฉัน = งานย่อยที่มอบให้ฉันต้องเห็นด้วย */
      all = all.filter(function (t) { return !t.parentId || (F.who === meIdA && t.assignees.indexOf(meIdA) !== -1); });
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
        if (F.ttype && (t.taskType || 'other') !== F.ttype) return false;
        if (F.kind && (t.taskKind || 'ondemand') !== F.kind) return false;
        if (F.status === 'review' && effStatus(t) !== 'review') return false;
        return true;
      }
      var matched = all.filter(passFilters);
      var list = matched.filter(inRange);
      markSeq(list, location.hash || '#/all');
      var hiddenNoDate = F.range === 'all' ? 0
        : matched.filter(function (t) { return !inRange(t) && !dueOf(t); }).length;
      var hiddenOther = F.range === 'all' ? 0
        : matched.filter(function (t) { return !inRange(t) && dueOf(t); }).length;

      var view = $('#view');
      view.className = 'page';
      /* มุมมอง "ของฉัน": ตัวเลขนับเฉพาะงานที่มอบให้ฉัน (รวมงานย่อย) — เหมือนหน้างานของฉันเดิม */
      var meId0 = S.viewAs || S.me.id;
      var mineView = F.who === meId0;
      var scopeList = mineView ? r[0].filter(function (t) { return t.assignees.indexOf(meId0) !== -1; }) : all;
      var openS = scopeList.filter(function (t) { return effStatus(t) !== 'done'; });
      var lateS = openS.filter(isLate), todayS = openS.filter(function (t) { return isToday(t) && !isLate(t); });
      var doneWeekS = scopeList.filter(function (t) { return t.status === 'done' && new Date(t.doneAt || t.updatedAt) > weekAgo; });
      var whoS = staffById(meId0) || S.me;
      var h = (S.viewAs ? '<div class="postbar warn">กำลังดูในมุมของ <b>' + esc(whoS.name) + '</b> — อ่านอย่างเดียว ' +
          '<button type="button" class="btn-text" data-viewas-off>เลิกดู</button></div>' : '') +
        '<div class="top"><div><span class="kicker">' + (mineView ? 'งานของฉัน' : 'งานทั้งหมดของทีม') + '</span>' +
        '<h1>' + (mineView ? (S.viewAs ? esc(whoS.name) : 'สวัสดี ' + esc(shortName(S.me))) : 'ภาพรวมงาน') + '</h1>' +
        '<p>' + (mineView
          ? (openS.length ? 'มีงานค้าง ' + openS.length + ' รายการ' + (lateS.length ? ' · เลยกำหนด ' + lateS.length : '') + (todayS.length ? ' · ครบกำหนดวันนี้ ' + todayS.length : '') : 'ไม่มีงานค้าง เยี่ยม')
          : 'ทุกงานที่สั่งไว้ แยกดูตามคน ตาม KPI หรือตามกำหนดส่ง — กดที่งานเพื่อดูรายละเอียดและรูปที่ทีมอัปเดต') + '</p></div>' +
        '<div class="top-r">' + (amOwner() ? '<a class="btn-ghost" href="#/kpi">KPI 2570</a>' : '') + (readOnly() ? '' : '<a class="btn" href="#/new">+ สั่งงาน</a>') + '</div></div>';
      h += '<div class="cards">' +
        '<article class="hot" data-go="open"><span class="l">' + (mineView ? 'งานค้างของฉัน' : 'งานค้างทั้งทีม') + '</span><b>' + openS.length + '</b><small>รวมงานประจำ</small></article>' +
        '<article' + (lateS.length ? ' class="bad"' : '') + ' data-go="late"><span class="l">เลยกำหนด</span><b>' + lateS.length + '</b><small>กดเพื่อดูเฉพาะที่เลยกำหนด</small></article>' +
        '<article' + (todayS.length ? ' class="warn"' : '') + '><span class="l">ครบกำหนดวันนี้</span><b>' + todayS.length + '</b><small>' + esc(DAY_TH[now.getDay()] + ' ' + fmtDate(now)) + '</small></article>' +
        '<article data-go="done"><span class="l">เสร็จใน 7 วัน</span><b>' + doneWeekS.length + '</b><small>ปิดงานสัปดาห์นี้</small></article></div>';
      /* งานที่คนอื่นส่งมาให้เราตรวจ — ค้างที่เรา ไม่ใช่ค้างที่เขา ขึ้นก่อนเสมอ */
      var toReview = readOnly() ? [] : r[0].filter(function (t) {
        return effStatus(t) === 'review' && canApprove(t) && t.assignees.indexOf(S.me.id) === -1;
      });
      if (toReview.length) {
        h += '<div class="group"><div class="group-h review"><h3>รอคุณตรวจ</h3><span>' + toReview.length + '</span>' + gsel() +
          '<a class="btn-text" style="margin-left:auto" href="#/review">ปัดตรวจทีเดียว</a>' + '</div>' +
          '<div class="tlist">' + toReview.map(taskRow).join('') + '</div></div>';
      }
      /* แถบตรวจโพสต์ของวันนี้ */
      h += '<div class="postbar" id="postBar"><span class="pbi">กำลังอ่านตารางโพสต์…</span></div>';

      /* แถบเดียวจบ: ช่วงเวลา · ปุ่มตัวกรอง (กางเมื่อกด) · จัดกลุ่ม
         ของเดิมเป็นชิป 3 แถวเต็มจอ ทั้งที่ส่วนใหญ่ไม่ได้แตะ */
      /* "ของฉัน" มีสวิตช์ของตัวเองแล้ว ไม่นับเป็นตัวกรอง */
      var nActive = (F.who && F.who !== (S.viewAs || S.me.id) ? 1 : 0) + (F.kpi ? 1 : 0) + (F.status !== 'open' ? 1 : 0) + (F.campaign ? 1 : 0) + (F.ttype ? 1 : 0) + (F.kind ? 1 : 0);
      var seg = function (name, opts) {
        return '<div class="seg">' + opts.map(function (o) {
          return '<button type="button" class="' + (F[name] === o[0] ? 'on' : '') + '" data-f="' + name + '" data-v="' + o[0] + '">' + esc(o[1]) + '</button>';
        }).join('') + '</div>';
      };
      var meId = S.viewAs || S.me.id;
      var mineOn = F.who === meId;
      h += '<div class="tbar"><div class="seg" data-tour-id="mine">' +
        '<button type="button" class="' + (mineOn ? 'on' : '') + '" data-f="who" data-v="' + esc(meId) + '">งานของฉัน</button>' +
        '<button type="button" class="' + (!F.who ? 'on' : '') + '" data-f="who" data-v="">ทั้งทีม</button></div>' + seg('range', RANGES) +
        '<button type="button" class="fbtn' + (S.filterOpen ? ' open' : '') + (nActive ? ' has' : '') + '" data-filter-toggle>' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>' +
        'ตัวกรอง' + (nActive ? '<i>' + nActive + '</i>' : '') + '</button>' +
        '<span class="tbar-lbl">จัดกลุ่ม</span>' + seg('group', [['due', 'กำหนดส่ง'], ['who', 'คน'], ['kpi', 'KPI'], ['board', 'บอร์ด']]) +
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
          '<div class="frow"><span class="lbl">ชนิดงาน</span><div class="chips">' +
          '<button type="button" class="chip plain' + (!F.kind ? ' on' : '') + '" data-f="kind" data-v="">ทั้งหมด</button>' +
          KIND_KEYS.map(function (k) {
            return '<button type="button" class="chip plain' + (F.kind === k ? ' on' : '') + '" data-f="kind" data-v="' + k + '">' + esc(KIND_TH[k]) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="frow"><span class="lbl">ประเภทงาน</span><div class="chips">' +
          '<button type="button" class="chip plain' + (!F.ttype ? ' on' : '') + '" data-f="ttype" data-v="">ทุกประเภท</button>' +
          TASK_TYPE_KEYS.map(function (k) {
            return '<button type="button" class="chip plain' + (F.ttype === k ? ' on' : '') + '" data-f="ttype" data-v="' + k + '">' + esc(TASK_TYPE_TH[k]) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="frow"><span class="lbl">สถานะ</span><div class="chips">' +
          [['open', 'ค้างอยู่'], ['late', 'เลยกำหนด'], ['review', 'รอตรวจ'], ['done', 'เสร็จแล้ว'], ['', 'ทั้งหมด']].map(function (p) {
            return '<button type="button" class="chip plain' + (F.status === p[0] ? ' on' : '') + '" data-f="status" data-v="' + p[0] + '">' + esc(p[1]) + '</button>';
          }).join('') + '</div></div></div>';
      }

      /* สรุปว่ากรองอะไรอยู่ พร้อมปุ่มเอาออกทีละอัน — ไม่ต้องกางแผงเพื่อดู */
      var act = [];
      if (F.who && F.who !== (S.viewAs || S.me.id)) act.push(['who', '', 'คน: ' + shortName(staffById(F.who))]);
      if (F.kpi) act.push(['kpi', '', 'KPI: ' + (F.kpi === 'none' ? 'ไม่ระบุ' : ((kpiById(F.kpi) || {}).code || ''))]);
      if (F.status !== 'open') act.push(['status', 'open', 'สถานะ: ' + ({ '': 'ทั้งหมด', late: 'เลยกำหนด', review: 'รอตรวจ', done: 'เสร็จแล้ว' }[F.status] || F.status)]);
      if (F.campaign) { var cc0 = campaignById(F.campaign); act.push(['campaign', '', 'ปฏิทิน: ' + (cc0 ? cc0.name : F.campaign)]); }
      if (F.ttype) act.push(['ttype', '', 'ประเภท: ' + (TASK_TYPE_TH[F.ttype] || F.ttype)]);
      if (F.kind) act.push(['kind', '', 'ชนิด: ' + (KIND_TH[F.kind] || F.kind)]);
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
      } else if (F.group === 'board') {
        h += kanban(list);
      } else if (F.group === 'kpi') {
        var byKpi = {};
        list.forEach(function (t) { var k = t.kpiId || '_none'; (byKpi[k] = byKpi[k] || []).push(t); });
        S.kpis.forEach(function (k) { if (byKpi[k.id]) h += groupList(k.code + ' · ' + k.title, byKpi[k.id]); });
        if (byKpi['_none']) h += groupList('ยังไม่ผูก KPI', byKpi['_none']);
      } else {
        var b = bucketize(list);
        h += groupList('รอตรวจ', b.review) +
          groupList('เลยกำหนด', b.late, 'late') + groupList('วันนี้', b.today) + groupList('ภายใน 7 วัน', b.week) +
          groupList('ถัดไป', b.later) + groupList('ยังไม่กำหนดวัน', b.nodate) + groupList('งานประจำ', b.repeat) + groupList('เสร็จแล้ว', b.done);
      }
      view.innerHTML = h;
      syncSel();
      fillPostBar();
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
    if (/ทุกเดือน|ทุกๆเดือน|รายเดือน|monthly|every month/i.test(t)) { repeat = 'monthly'; t = t.replace(/ทุกๆ?เดือน|รายเดือน|monthly|every month/gi, ' '); }
    else if (/ทุกวัน|ทุกๆวัน|daily|every day/i.test(t)) { repeat = 'daily'; t = t.replace(/ทุกๆ?วัน|daily|every day/gi, ' '); }
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

  /* ---------- สั่งงาน: ตารางแบบสเปรดชีต ---------- */
  /* ของเดิมเป็นการ์ดทีละใบ — สั่งทีนึงหลายงานเลยกรอกช้าและมองไม่เห็นภาพรวมว่าใครโดนกี่งาน
     ตารางนี้ใช้ตัวเดียวกับ "ตารางโพสต์" (KAN_GRID) จึงได้ก็อป/วางจาก Excel ลากมุมคัดลอกลง
     Cmd+Z คลิกขวาแทรกแถว มาฟรีทั้งชุด
     ต่างกันตรงตารางนี้ไม่บันทึกอัตโนมัติ — เป็นฉบับร่างจนกว่าจะกดบันทึกทั้งหมด */
  var SUPPORT_V = '__support__';
  var drafts = [];
  var dgrid = null;

  function blankDraft(last) {
    return { title: '', taskType: '', taskKind: 'ondemand', assignees: [], date: '', time: '', hours: '',
             detail: '', repeat: '', kpiId: '', support: 0, signW: '', signH: '', signQty: '', signBranch: '',
             campaignId: (last && last.campaignId) || (S.route.query || {}).campaign || '' };
  }
  function draftBlank(r) {
    return !String(r.title || '').trim() && !(r.assignees || []).length && !r.date &&
      !String(r.detail || '').trim() && !r.kpiId && !r.support && r.hours === '';
  }
  /* บังคับ 4 ช่อง — เวลาปล่อยว่างได้ ระบบใส่ 18:00 ให้ (กติกาเดียวกับตอนพิมพ์สั่งในแชต) */
  function draftMissing(r) {
    var m = [];
    if (!String(r.title || '').trim()) m.push('ชื่องาน');
    if (!r.taskType) m.push('ประเภทงาน');
    if (!(r.assignees || []).length) m.push('สั่งใคร');
    if (!r.date) m.push('กำหนดส่ง');
    /* ทุกงานต้องบอกว่าเข้า KPI ไหน หรือเป็นงาน support — คุณออนขอให้ทุกงานมีคำตอบ
       นนท์ขอให้มีทางออกสำหรับงานที่ไม่ควรยัดเข้า KPI */
    if (!r.kpiId && !r.support) m.push('KPI');
    /* งานป้ายต้องรู้ขนาดกับสาขา ไม่งั้นโรงพิมพ์ทำไม่ได้ */
    if (r.taskType === 'signage' && (r.signW === '' || r.signH === '')) m.push('ขนาดป้าย');
    if (r.taskType === 'signage' && !String(r.signBranch || '').trim()) m.push('สาขา');
    return m;
  }
  function draftList() {
    return (dgrid ? dgrid.rows : drafts).filter(function (r) { return !draftBlank(r); });
  }
  function draftDue(r) { return r.date ? fromLocalInput(r.date + 'T' + (r.time || '18:00')) : null; }
  /* เวลาเก็บเป็น HH:MM 24 ชม. แต่โชว์แบบไทย 17.00 */
  function parseDueTime(v) {
    var s = String(v == null ? '' : v).trim().replace(/\s*น\.?$/, '').replace(/\s/g, '');
    if (!s) return '';
    var hh, mm, m = s.match(/^(\d{1,2})[.:](\d{1,2})$/);
    if (m) { hh = Number(m[1]); mm = Number(m[2]); }
    else if (/^\d{1,2}$/.test(s)) { hh = Number(s); mm = 0; }
    else return null;
    if (hh > 23 || mm > 59) return null;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function showDueTime(v) { return v ? String(v).replace(':', '.') : ''; }
  function activeStaff() { return S.staff.filter(function (s) { return s.active; }); }

  function draftColumns() {
    var base = new Date();
    return [
      { key: 'title', label: 'ชื่องาน *', width: 290,
        parse: function (s) { return String(s).trim().slice(0, 300); } },

      { key: 'taskType', label: 'ประเภทงาน *', width: 130, type: 'pick',
        options: function () { return TASK_TYPE_KEYS.map(function (k) { return { v: k, label: TASK_TYPE_TH[k] }; }); },
        text: function (r) { return TASK_TYPE_TH[r.taskType] || ''; },
        parse: function (s) {
          s = String(s).trim();
          if (!s) return '';
          var hit = '';
          TASK_TYPE_KEYS.forEach(function (k) { if (k === s || TASK_TYPE_TH[k] === s) hit = k; });
          return hit || guessTaskType(s) || null;
        },
        filterValues: function (r) { return [TASK_TYPE_TH[r.taskType] || '(ยังไม่เลือก)']; } },

      { key: 'taskKind', label: 'ชนิดงาน', width: 104, type: 'pick',
        options: function () { return KIND_KEYS.map(function (k) { return { v: k, label: KIND_TH[k] }; }); },
        text: function (r) { return KIND_TH[r.taskKind] || KIND_TH.ondemand; },
        parse: function (s2) {
          s2 = String(s2).trim();
          if (!s2) return 'ondemand';
          var hit = '';
          KIND_KEYS.forEach(function (k) { if (k === s2 || KIND_TH[k] === s2) hit = k; });
          if (!hit && /ประจำ|ทุกวัน|routine/i.test(s2)) hit = 'routine';
          return hit || null;
        },
        filterValues: function (r) { return [KIND_TH[r.taskKind] || KIND_TH.ondemand]; } },

      { key: 'assignees', label: 'สั่งใคร *', width: 168, type: 'multi',
        options: function () { return activeStaff().map(function (s) { return { v: s.id, label: shortName(s) }; }); },
        get: function (r) { return r.assignees || []; },
        text: function (r) { return (r.assignees || []).map(function (id) { return shortName(staffById(id)); }).join(', '); },
        parse: function (s) {
          s = String(s).trim();
          if (!s) return [];
          var ids = [];
          s.split(/[,\/·|]+|\s+/).forEach(function (tok) {
            var st = findStaffByToken(String(tok).replace(/^@/, ''));
            if (st && ids.indexOf(st.id) === -1) ids.push(st.id);
          });
          return ids.length ? ids : null;
        },
        copy: function (r) { return (r.assignees || []).map(function (id) { return shortName(staffById(id)); }).join(', '); },
        filterValues: function (r) {
          return (r.assignees || []).length
            ? r.assignees.map(function (id) { return shortName(staffById(id)); })
            : ['(ยังไม่มอบหมาย)'];
        } },

      { key: 'date', label: 'กำหนดส่ง *', width: 110, type: 'date',
        text: function (r) { return r.date ? thaiShort(r.date) : ''; },
        edit: function (r) { return r.date ? thaiShort(r.date) : ''; },
        iso: function (r) { return r.date || ''; },
        fromIso: function (iso) { return thaiShort(iso); },
        parse: function (s) {
          s = String(s).trim();
          if (!s) return '';
          return parsePostDate(s, base.getFullYear(), base.getMonth() + 1) || null;
        },
        copy: function (r) { return r.date || ''; },
        fill: function (src, step) { return src.date ? addDaysIso(src.date, step) : ''; },
        sortKey: function (r) { return r.date || '9999-99-99'; } },

      { key: 'time', label: 'เวลา', width: 76,
        text: function (r) { return showDueTime(r.time); },
        edit: function (r) { return showDueTime(r.time); },
        parse: function (s) { return parseDueTime(s); },
        copy: function (r) { return showDueTime(r.time); },
        sortKey: function (r) { return r.time || '99:99'; } },

      { key: 'hours', label: 'ใช้เวลา (ชม.)', width: 106,
        text: function (r) { return r.hours === '' || r.hours == null ? '' : String(r.hours); },
        edit: function (r) { return r.hours === '' || r.hours == null ? '' : String(r.hours); },
        parse: function (s2) {
          s2 = String(s2).trim().replace(/\s*(ชม\.?|ชั่วโมง|h|hr)$/i, '');
          if (!s2) return '';
          var n = Number(s2);
          if (!isFinite(n) || n < 0 || n > 200) return null;
          return Math.round(n * 4) / 4;
        },
        sortKey: function (r) { return r.hours === '' || r.hours == null ? -1 : Number(r.hours); } },

      { key: 'detail', label: 'รายละเอียด', width: 290,
        parse: function (s) { return String(s).trim().slice(0, 4000); } },

      { key: 'repeat', label: 'ความถี่', width: 100, type: 'pick',
        options: function () { return REPEAT_OPTS.map(function (p) { return { v: p[0], label: p[1] }; }); },
        text: function (r) { return r.repeat ? repeatLabel(r.repeat) : ''; },
        parse: function (s) {
          s = String(s).trim();
          if (!s) return '';
          var hit = null;
          REPEAT_OPTS.forEach(function (p) { if (p[0] === s || p[1] === s) hit = p[0]; });
          if (hit === null && /ทุกวัน|daily/i.test(s)) hit = 'daily';
          if (hit === null && /ทุกสัปดาห์|ทุกอาทิตย์|weekly/i.test(s)) hit = 'weekly';
          if (hit === null && /ทุกเดือน|รายเดือน|monthly/i.test(s)) hit = 'monthly';
          return hit === null ? null : hit;
        } },

      /* เลือกได้ทั้ง KPI จริง และ "งาน support" ซึ่งเก็บเป็น support=1 ไม่ใช่ kpiId
         affects บอก grid ว่าช่องนี้ไปแตะ support ด้วย จะได้ undo ถูก */
      { key: 'kpiId', label: 'KPI *', width: 210, type: 'pick', affects: ['support'],
        options: function () {
          return [{ v: SUPPORT_V, label: 'งาน support — ไม่เข้า KPI' }].concat(S.kpis.map(function (k) {
            return { v: k.id, label: k.code + ' · ' + k.title };
          }));
        },
        get: function (r) { return r.support ? SUPPORT_V : (r.kpiId || ''); },
        set: function (r, v) {
          if (v === SUPPORT_V) { r.support = 1; r.kpiId = ''; }
          else { r.support = 0; r.kpiId = v || ''; }
        },
        text: function (r) {
          if (r.support) return 'งาน support';
          var k = kpiById(r.kpiId);
          return k ? k.code + ' · ' + k.title : '';
        },
        parse: function (s2) {
          s2 = String(s2).trim();
          if (!s2) return '';
          if (s2 === SUPPORT_V || /support|ซัพพอร์ต|ไม่เข้า\s*kpi/i.test(s2)) return SUPPORT_V;
          var low = s2.toLowerCase();
          var hit = S.kpis.filter(function (k) { return (k.code + ' · ' + k.title).toLowerCase() === low; })[0] ||
                    S.kpis.filter(function (k) { return k.code.toLowerCase() === low; })[0] ||
                    S.kpis.filter(function (k) { return (k.code + ' ' + k.title).toLowerCase().indexOf(low) !== -1; })[0];
          return hit ? hit.id : null;
        },
        copy: function (r) { return r.support ? 'งาน support' : ((kpiById(r.kpiId) || {}).code || ''); },
        filterValues: function (r) {
          return [r.support ? 'งาน support' : ((kpiById(r.kpiId) || {}).code || '(ยังไม่เลือก)')];
        } },

      /* เฉพาะงานป้าย — งานอื่นปล่อยว่าง · หน่วยเมตร */
      { key: 'signW', label: 'กว้าง (ม.)', width: 82,
        text: function (r) { return r.signW == null || r.signW === '' ? '' : String(r.signW); },
        parse: function (s2) { s2 = String(s2).trim().replace(/[มm]\.?$/i, ''); if (!s2) return ''; var n = Number(s2); return isFinite(n) && n >= 0 && n <= 100 ? n : null; } },
      { key: 'signH', label: 'สูง (ม.)', width: 76,
        text: function (r) { return r.signH == null || r.signH === '' ? '' : String(r.signH); },
        parse: function (s2) { s2 = String(s2).trim().replace(/[มm]\.?$/i, ''); if (!s2) return ''; var n = Number(s2); return isFinite(n) && n >= 0 && n <= 100 ? n : null; } },
      { key: 'signQty', label: 'จำนวนใบ', width: 76,
        text: function (r) { return r.signQty == null || r.signQty === '' ? '' : String(r.signQty); },
        parse: function (s2) { s2 = String(s2).trim().replace(/ใบ$/, ''); if (!s2) return ''; var n = Math.round(Number(s2)); return isFinite(n) && n >= 1 && n <= 9999 ? n : null; } },
      { key: 'signBranch', label: 'สาขา', width: 110,
        parse: function (s2) { return String(s2).trim().slice(0, 80); } },

      { key: 'campaignId', label: 'ปฏิทินการตลาด', width: 170, type: 'pick',
        options: function () {
          return [{ v: '', label: '— ไม่ผูก —' }].concat((S.campaigns || []).map(function (c) {
            return { v: c.id, label: c.name };
          }));
        },
        text: function (r) { var c = campaignById(r.campaignId); return c ? c.name : ''; },
        parse: function (s) {
          s = String(s).trim().toLowerCase();
          if (!s || s.indexOf('ไม่ผูก') !== -1) return '';
          var hit = (S.campaigns || []).filter(function (c) { return c.name.toLowerCase() === s; })[0] ||
                    (S.campaigns || []).filter(function (c) { return c.name.toLowerCase().indexOf(s) !== -1; })[0];
          return hit ? hit.id : null;
        } }
    ];
  }

  function renderNew() {
    if (!S.campaigns) { loadCampaigns().then(renderNew); return; }
    var view = $('#view');
    view.className = 'page';
    var sample = 'ระบบจอ signmate > kan บขส + fashion : Deadline - พุธ 17.00 น. @Julalak\nออกแบบ บูธขายเสื้อหนาว ที่ Central - อังคาร 16.00 @Title\nขนาดพื้นที่ 8*7 เมตร เลือกได้ 7 / 14 วัน\n\nupdate ontour จังหวัดอื่น @Nont @Title @Julalak ทุกวัน 17.30';
    var pc = campaignById((S.route.query || {}).campaign || '');
    view.innerHTML =
      '<div class="top"><div><span class="kicker">สั่งงาน' + (pc ? ' · สำหรับ ' + esc(pc.name) : '') + '</span>' +
      '<h1>กรอกงานลงตาราง แถวละหนึ่งงาน</h1>' +
      (pc ? '<p>ทุกงานที่บันทึกจากหน้านี้จะผูกกับ ' + campaignChip(pc.id) + ' ในปฏิทินการตลาดให้เอง</p>' : '') +
      '<p>พิมพ์ในตารางได้เลยเหมือน Excel · ก็อปจาก Excel มาวางทั้งก้อนก็ได้ · ' +
      'ช่องที่มี <b class="req-mark">*</b> ต้องกรอกให้ครบก่อนถึงจะบันทึกได้</p></div>' +
      '<div class="top-r"><button type="button" class="btn-ghost" id="pasteToggle">วางจากแชต</button></div></div>' +

      '<div class="sec" id="pasteBox" hidden><div class="sec-h"><h2>วางข้อความสั่งงานจากแชต</h2>' +
      '<span class="hint">ระบบจะอ่าน @ชื่อ เป็นคนรับงาน · วัน+เวลา เป็นกำหนดส่ง · เดาประเภทงานกับ KPI ให้ แล้วเทลงตารางให้ตรวจแก้</span></div>' +
      '<div class="sec-b"><textarea class="textarea big" id="cmdText" data-rich placeholder="' + esc(sample) + '"></textarea>' +
      '<div class="acts" style="margin-top:12px"><button type="button" class="btn" id="parseBtn">แยกเป็นงานลงตาราง</button>' +
      '<button type="button" class="btn-ghost" id="pasteClose">ปิด</button></div></div></div>' +

      '<div class="sec"><div class="sec-b tight"><div id="draftHost"></div></div></div>' +
      '<div id="draftBar"></div>';

    drafts = [];
    dgrid = global.KAN_GRID.create($('#draftHost'), {
      id: 'newtasks',
      columns: draftColumns(),
      rows: drafts,
      freeze: 1,
      isBlank: draftBlank,
      blankRow: blankDraft,
      cloneRow: function (src) {
        return { title: src.title, taskType: src.taskType, taskKind: src.taskKind,
                 assignees: (src.assignees || []).slice(), date: src.date, time: src.time,
                 hours: src.hours, detail: src.detail, repeat: src.repeat,
                 kpiId: src.kpiId, support: src.support, campaignId: src.campaignId,
                 signW: src.signW, signH: src.signH, signQty: src.signQty, signBranch: src.signBranch };
      },
      /* ขีดแดงหน้าแถวที่กรอกไม่ครบ — เห็นตั้งแต่ยังไม่กดบันทึก */
      tone: function (r) { return (!draftBlank(r) && draftMissing(r).length) ? 'miss' : ''; },
      canDelete: function () { return true; },
      onChange: function (rows) {
        (rows || []).forEach(function (r) { if (dgrid) dgrid.markRow(r); });
        renderDraftBar();
      },
      onRemove: function () { renderDraftBar(); },
      onToast: function (m) { toast(m); },
      blankRows: 5
    });
    renderDraftBar();
    wireTyping(view);
  }

  /* แถบล่าง — บอกว่าเหลืออะไรต้องกรอก แล้วค่อยให้กดบันทึก */
  function renderDraftBar() {
    var host = $('#draftBar');
    if (!host) return;
    var list = draftList();
    if (!list.length) {
      host.innerHTML = '<div class="draft-hint">เริ่มพิมพ์ในแถวแรกได้เลย — Tab ไปช่องถัดไป · Enter ลงแถวใหม่ · ' +
        'คลุมทั้งแถวแล้วกด Delete = ลบแถว · Cmd/Ctrl+Z ย้อนกลับ</div>';
      return;
    }
    var bad = list.filter(function (r) { return draftMissing(r).length; });
    var need = {};
    bad.forEach(function (r) { draftMissing(r).forEach(function (k) { need[k] = (need[k] || 0) + 1; }); });
    var needTxt = Object.keys(need).map(function (k) { return k + ' ' + need[k] + ' แถว'; }).join(' · ');
    host.innerHTML = '<div class="sticky-bar' + (bad.length ? ' warn' : '') + '">' +
      '<span>' + list.length + ' งาน' + (bad.length ? ' · <b>ยังกรอกไม่ครบ ' + bad.length + ' แถว</b> — ขาด ' + esc(needTxt) : ' · กรอกครบทุกแถวแล้ว') + '</span>' +
      '<div class="acts"><button type="button" class="btn-ghost" id="clearBtn">ล้างตาราง</button>' +
      '<button type="button" class="btn" id="saveBtn"' + (bad.length ? ' disabled' : '') + '>บันทึกทั้งหมด</button></div></div>';
  }

  /* แปลงงานที่แยกจากข้อความแชต → แถวในตาราง (dueAt ก้อนเดียวถูกผ่าเป็นวัน/เวลา + เดาประเภทให้) */
  function draftFromParsed(t) {
    var d = t.dueAt ? new Date(t.dueAt) : null;
    var ok = d && !isNaN(d.getTime());
    return {
      title: t.title || '',
      taskType: guessTaskType((t.title || '') + ' ' + (t.detail || '')),
      taskKind: t.repeat ? 'routine' : 'ondemand',
      hours: '',
      support: 0,
      signW: '', signH: '', signQty: '', signBranch: '',
      assignees: t.assignees || [],
      date: ok ? ymd(d) : '',
      time: ok ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : '',
      detail: t.detail || '',
      repeat: t.repeat || '',
      kpiId: t.kpiId || '',
      campaignId: (S.route.query || {}).campaign || ''
    };
  }
  /* เทแถวใหม่ลงตาราง — ตัดแถวเปล่าท้ายทิ้งก่อน ไม่งั้นงานใหม่จะไปต่อท้ายแถวว่าง */
  function pushDrafts(rows) {
    if (!dgrid) return;
    var keep = dgrid.rows.filter(function (r) { return !draftBlank(r); }).concat(rows);
    dgrid.rows.length = 0;
    keep.forEach(function (r) { dgrid.rows.push(r); });
    dgrid.ensureBlank();
    dgrid.refresh();
    renderDraftBar();
  }

  function saveDrafts() {
    var list = draftList();
    if (!list.length) { toast('ยังไม่มีงานในตาราง', true); return; }
    var bad = list.filter(function (r) { return draftMissing(r).length; });
    if (bad.length) {
      toast('ยังกรอกไม่ครบ ' + bad.length + ' แถว — ขาด ' + draftMissing(bad[0]).join(', '), true);
      return;
    }
    var btn = $('#saveBtn');
    if (btn) btn.disabled = true;
    var payload = list.map(function (r) {
      return { title: r.title, detail: r.detail || '', assignees: r.assignees, dueAt: draftDue(r),
               repeat: r.repeat || '', kpiId: r.kpiId || null, taskType: r.taskType,
               taskKind: r.taskKind || 'ondemand', support: r.support ? 1 : 0,
               hours: r.hours === '' ? null : r.hours, priority: 0,
               campaignId: r.campaignId || null,
               signW: r.signW === '' ? null : r.signW, signH: r.signH === '' ? null : r.signH,
               signQty: r.signQty === '' ? null : r.signQty, signBranch: r.signBranch || null };
    });
    api('/tasks', 'POST', { tasks: payload }).then(function (j) {
      var n = (j.ids || []).length;
      S.tasks = null;
      drafts = [];
      dgrid = null;
      var byType = {};
      payload.forEach(function (d) { byType[d.taskType] = (byType[d.taskType] || 0) + 1; });
      okDialog({
        title: 'บันทึกเข้าระบบแล้ว ' + n + ' งาน',
        lines: payload.slice(0, 6).map(function (d) {
          return d.title + ' → ' + d.assignees.map(function (id) { return shortName(staffById(id)); }).join(', ');
        }).concat(n > 6 ? ['และอีก ' + (n - 6) + ' งาน'] : []),
        note: TASK_TYPE_KEYS.filter(function (k) { return byType[k]; })
          .map(function (k) { return TASK_TYPE_TH[k] + ' ' + byType[k]; }).join(' · '),
        link: { href: '#/all', label: 'ดูงานทั้งหมด' },
        onClose: function () { location.hash = '#/all'; }
      });
    }).catch(function (e) { if (btn) btn.disabled = false; toast(e.message, true); });
  }
  /* ติ๊กจากหน้ารายการ — ปุ่มถูกกดซ้ำระหว่างรอไม่ได้ กัน request ซ้อน */
  function tickTask(btn) {
    if (btn.dataset.busy) return;
    var id = btn.getAttribute('data-tick'), act = btn.getAttribute('data-act');
    btn.dataset.busy = '1';
    btn.classList.add('busy');
    var req = act === 'approve'
      ? api('/tasks/' + id + '/review', 'POST', { pass: true })
      : api('/tasks/' + id, 'PUT', { status: act === 'undone' ? 'todo' : 'done' });
    var prev = ((S.tasks || []).filter(function (x) { return x.id === id; })[0] || {}).status || 'todo';
    req.then(function (j) {
      S.tasks = null;
      var msg = act === 'approve' ? 'ตรวจผ่านแล้ว'
        : (act === 'undone' ? 'เอากลับมาเป็นรอทำแล้ว'
        : (j && j.status === 'review' ? 'ส่งให้หัวหน้าตรวจแล้ว' : 'ปิดงานแล้ว'));
      /* กดผิดกดคืนได้ทันที — เอากลับไปสถานะก่อนหน้า ไม่ใช่รอทำเสมอไป */
      toastUndo(msg, function () {
        return api('/tasks/' + id, 'PUT', { status: prev }).then(function () {
          S.tasks = null; toast('เอากลับมาแล้ว'); render();
        });
      });
      render();
    }).catch(function (e) {
      btn.dataset.busy = '';
      btn.classList.remove('busy');
      toast(e.message, true);
    });
  }

  /* ---------- funnel งานป้าย: 6 ขั้นเรียงซ้ายไปขวา ----------
     stages = งานย่อยที่มี stage · ขั้นผ่านแล้ว = สถานะ done · ขั้นปัจจุบัน = ขั้นแรกที่ยังไม่ done
     ช่องรูป: ขั้นไหนมีรูปคือผ่านจริง ไม่ใช่แค่กดว่าเสร็จ — ขั้นที่ปิดโดยไม่มีรูปทำไม่ได้ตั้งแต่ฝั่ง worker */
  function signFunnel(main, stages, compact, flowDefs) {
    var byK = {};
    (stages || []).forEach(function (x) { byK[x.stage] = x; });
    /* ประเภทอื่นที่มีขั้นงาน (เช่น LINE OA) ส่ง flow ของตัวเองเข้ามา — ไม่ส่ง = ใช้ของงานป้าย
       ขั้นที่ไม่บังคับแนบรูป (pic = 0) จะไม่ขึ้นช่องรูป แต่ยังกดเข้าไปทำงานในขั้นได้ */
    var DEFS = (flowDefs && flowDefs.length) ? flowDefs
      : SIGN_STAGES.map(function (x) { return { k: x[0], th: x[1], pic: 1 }; });
    var KEYS = DEFS.map(function (x) { return x.k; });
    var now = new Date();
    var cur = null;
    for (var i = 0; i < KEYS.length; i++) { var st0 = byK[KEYS[i]]; if (!st0 || effStatus(st0) !== 'done') { cur = KEYS[i]; break; } }
    return '<div class="sfun' + (compact ? ' compact' : '') + '" style="--sn:' + DEFS.length + '">' + DEFS.map(function (def, i) {
      var k = def.k, x = byK[k];
      var done = x && effStatus(x) === 'done', isCur = k === cur, rev = x && effStatus(x) === 'review';
      var late = x && !done && x.dueAt && new Date(x.dueAt) < now;
      var cls = 'sst' + (done ? ' on' : '') + (isCur ? ' now' : '') + (rev ? ' rev' : '') + (late ? ' late' : '');
      var when = x ? (done ? (x.doneAt ? fmtDate(new Date(x.doneAt)) + ' ✓' : 'เสร็จ')
                          : (x.dueAt ? 'คาด ' + fmtDate(new Date(x.dueAt)) : '')) : '';
      var needPic = def.pic !== 0;
      var pic = x && x.picId
        ? '<a class="sshot has" href="#/task/' + esc(x.id) + '"><img src="' + API + '/files/' + esc(x.picId) + '" alt="" loading="lazy"></a>'
        : (x ? '<a class="sshot' + (needPic ? (isCur ? ' need' : '') : ' nopic') + '" href="#/task/' + esc(x.id) + '">' +
               (rev ? 'รอตรวจ'
                    : needPic ? (isCur ? 'ยังไม่ส่งรูป' : (done ? (x.nFiles ? 'มีรูป ' + x.nFiles : 'ไม่มีรูป') : 'รอถึงคิว'))
                    : (done ? 'ผ่านแล้ว' : (isCur ? 'เปิดขั้นนี้' : 'รอถึงคิว'))) + '</a>'
             : '<span class="sshot off">ยังไม่ตั้งขั้น</span>');
      return '<div class="' + cls + '" data-k="' + k + '">' +
        (x ? '<a class="slbl" href="#/task/' + esc(x.id) + '"><i></i>' + (i + 1) + '. ' + esc(def.th) + '</a>'
           : '<span class="slbl"><i></i>' + (i + 1) + '. ' + esc(def.th) + '</span>') +
        '<span class="swhen' + (late ? ' late' : '') + '">' + esc(when) + '</span>' +
        (compact ? '' : pic) + '</div>';
    }).join('') + '</div>';
  }
  function signMeta(t) {
    var parts = [];
    if (t.signW != null && t.signH != null) parts.push(t.signW + ' × ' + t.signH + ' ม. · ' + (Math.round(t.signW * t.signH * 100) / 100) + ' ตร.ม.');
    if (t.signQty) parts.push(t.signQty + ' ใบ');
    if (t.signBranch) parts.push(t.signBranch);
    return parts.join(' · ');
  }

  /* ============================================================
     เลือกหลายงาน + สั่งทีเดียว · แก้ชื่อ/คนรับ/กำหนดส่งในแถว (นนท์ขอ 18 ก.ย. 69)
     SEL = { id: 1 } ของที่ติ๊กไว้ · ล้างเมื่อเปลี่ยนหน้า · ตัดที่หายจากจอออกทุกครั้งที่วาดใหม่
     ============================================================ */
  var SEL = {};
  var SEL_LAST = null;
  function selIds() { return Object.keys(SEL); }
  function selTasks() { return selIds().map(taskById).filter(Boolean); }
  function selCircle(t, st, mark, on, extra) {
    return '<span class="st ' + esc(st) + ' sel' + (on ? ' on' : '') + (extra ? ' ' + extra : '') + '" role="checkbox" tabindex="0" aria-checked="' + (on ? 'true' : 'false') +
      '" data-sel="' + esc(t.id) + '" data-mark="' + esc(mark) + '" title="เลือกงานนี้ (Shift = เลือกเป็นช่วง)" aria-label="เลือกงานนี้">' + (on ? '✓' : mark) + '</span>';
  }
  function toggleSel(id, range) {
    if (range && SEL_LAST && SEL_LAST !== id) {
      /* Shift+คลิก = เลือกทุกแถวระหว่างอันก่อนกับอันนี้ ตามลำดับที่เห็นบนจอ */
      var all = $$('[data-sel]').map(function (el) { return el.getAttribute('data-sel'); });
      var a = all.indexOf(SEL_LAST), b = all.indexOf(id);
      if (a !== -1 && b !== -1) {
        var lo = Math.min(a, b), hi = Math.max(a, b);
        for (var i = lo; i <= hi; i++) SEL[all[i]] = 1;
        SEL_LAST = id; paintSel(); return;
      }
    }
    if (SEL[id]) delete SEL[id]; else SEL[id] = 1;
    SEL_LAST = id;
    paintSel();
  }
  function syncSel() {
    var onScreen = {};
    $$('[data-sel]').forEach(function (el) { onScreen[el.getAttribute('data-sel')] = 1; });
    selIds().forEach(function (id) { if (!onScreen[id]) delete SEL[id]; });
    paintSel();
  }
  function paintSel() {
    $$('[data-sel]').forEach(function (el) {
      var on = !!SEL[el.getAttribute('data-sel')];
      el.classList.toggle('on', on);
      el.setAttribute('aria-checked', on ? 'true' : 'false');
      el.textContent = on ? '✓' : (el.getAttribute('data-mark') || '');
      var row = el.closest('.trow, .kcard');
      if (row) row.classList.toggle('selected', on);
    });
    $$('.group').forEach(function (g) {
      var gs = $('[data-gsel]', g); if (!gs) return;
      var all = $$('[data-sel]', g);
      var n = all.filter(function (el) { return SEL[el.getAttribute('data-sel')]; }).length;
      gs.classList.toggle('on', all.length > 0 && n === all.length);
      gs.classList.toggle('some', n > 0 && n < all.length);
      gs.setAttribute('aria-checked', n === 0 ? 'false' : (n === all.length ? 'true' : 'mixed'));
    });
    renderBulk();
  }
  /* แถบคำสั่งล่าง — ปุ่มขึ้นตามสิทธิ์ของงานที่เลือก */
  function renderBulk() {
    var bar = $('#bulkbar');
    var ts = selTasks();
    if (!ts.length) { if (bar) bar.remove(); document.body.classList.remove('has-bulk'); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'bulkbar'; bar.className = 'bulkbar'; bar.setAttribute('role', 'toolbar'); document.body.appendChild(bar); }
    document.body.classList.add('has-bulk');
    var anyApprove = ts.some(function (t) { return effStatus(t) === 'review' && canApprove(t); });
    var allApprove = ts.every(canApprove);
    var allEdit = ts.every(canEditRow);
    var anyTick = ts.some(canTick);
    var anyDue = ts.some(canDue);
    var h = '<span class="bn"><b>' + ts.length + '</b> งานที่เลือก</span>';
    if (anyApprove) h += '<button type="button" class="btn sm" data-bulk="approve">ตรวจผ่าน</button>';
    if (anyTick) h += '<button type="button" class="btn-ghost sm" data-bulk="done">' + (allApprove ? 'เสร็จแล้ว' : 'เสร็จแล้ว → ส่งตรวจ') + '</button>';
    if (anyTick) h += '<select class="select" data-bulk-status aria-label="เปลี่ยนสถานะ"><option value="">เปลี่ยนสถานะ…</option>' +
      ['todo', 'doing', 'blocked'].map(function (k) { return '<option value="' + k + '">' + STATUS_TH[k] + '</option>'; }).join('') + '</select>';
    if (canAssign()) h += '<button type="button" class="btn-ghost sm" data-bulk="assign">คนรับ</button>';
    if (anyDue) h += '<button type="button" class="btn-ghost sm" data-bulk="due">เลื่อนส่ง</button>';
    if (ts.some(canEditRow)) h += '<button type="button" class="btn-ghost sm danger" data-bulk="delete">ลบ</button>';
    h += '<button type="button" class="bx" data-bulk="clear" title="ยกเลิกการเลือก" aria-label="ยกเลิกการเลือก">✕</button>';
    bar.innerHTML = h;
    var sel = $('[data-bulk-status]', bar);
    if (sel) sel.addEventListener('change', function () { if (this.value) bulkRun('status', { status: this.value }, 'เปลี่ยนเป็น ' + STATUS_TH[this.value]); });
  }
  function bulkClick(k, btn) {
    if (k === 'clear') { SEL = {}; paintSel(); return; }
    if (k === 'approve') return bulkRun('approve', {}, 'ตรวจผ่าน');
    if (k === 'done') return bulkRun('done', {}, 'ปิดงาน');
    if (k === 'assign') return assignPop(btn, selIds());
    if (k === 'due') return duePop(btn, selIds());
    if (k === 'delete') {
      var n = selIds().length;
      if (!confirm('ลบ ' + n + ' งานที่เลือกออกจากระบบ? งานย่อย รูป และประวัติจะหายไปด้วย ย้อนกลับไม่ได้')) return;
      return bulkRun('delete', {}, 'ลบแล้ว');
    }
  }
  function bulkRun(action, payload, label) {
    var ids = selIds();
    if (!ids.length) return Promise.resolve();
    var bar = $('#bulkbar'); if (bar) bar.classList.add('busy');
    popClose();
    return api('/tasks/bulk', 'POST', Object.assign({ ids: ids, action: action }, payload || {})).then(function (j) {
      S.tasks = null; SEL = {};
      var msg = label + ' ' + (j.done || 0) + ' งาน';
      if (j.skipped && j.skipped.length) {
        var why = [];
        j.skipped.forEach(function (x) { if (why.indexOf(x.reason) === -1) why.push(x.reason); });
        msg += ' · ข้าม ' + j.skipped.length + ' งาน (' + why.slice(0, 2).join(' / ') + ')';
      }
      var undoable = (action === 'approve' || action === 'done' || action === 'status') && j.changed && j.changed.length;
      if (undoable) toastUndo(msg, function () { return bulkRevert(j.changed); });
      else toast(msg, !j.done);
      render();
    }).catch(function (e) { if (bar) bar.classList.remove('busy'); toast(e.message, true); });
  }
  /* เลิกทำ: คืนสถานะเดิมของแต่ละงาน — จัดกลุ่มตามสถานะเดิม ยิงทีละกลุ่ม */
  function bulkRevert(changed) {
    var by = {};
    changed.forEach(function (c) { var k = c.prev || 'todo'; (by[k] = by[k] || []).push(c.id); });
    return Promise.all(Object.keys(by).map(function (st) {
      return api('/tasks/bulk', 'POST', { ids: by[st], action: 'status', status: st });
    })).then(function () { S.tasks = null; toast('เอากลับมาแล้ว'); render(); });
  }

  /* ---------- ป๊อปอัปเล็กใต้ปุ่ม: คนรับ · กำหนดส่ง · เมนู ⋯ ---------- */
  var POP = null;
  function popClose() { if (POP) { POP.remove(); POP = null; } }
  function popOpen(anchor, html) {
    popClose();
    var el = document.createElement('div');
    el.className = 'pop';
    el.innerHTML = html;
    document.body.appendChild(el);
    var r = anchor.getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var top = r.bottom + 6;
    if (top + hh > window.innerHeight - 8) top = Math.max(8, r.top - hh - 6);
    el.style.left = left + 'px'; el.style.top = top + 'px';
    POP = el;
    $$('[data-pop-cancel]', el).forEach(function (b) { b.addEventListener('click', popClose); });
    return el;
  }
  document.addEventListener('click', function (ev) {
    if (POP && !POP.contains(ev.target)) popClose();
  }, true);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && POP) { popClose(); return; }
    /* วงกลมเลือก/ปุ่มในแถวกดด้วยคีย์บอร์ดได้ (แถวเป็นลิงก์ Enter ปกติจะพาไปหน้างาน) */
    var el = ev.target;
    if ((ev.key === ' ' || ev.key === 'Enter') && el.matches && el.matches('[data-sel],[data-gsel],[data-tedit],[data-aedit],[data-dedit],[data-rowmenu],.kaddp')) {
      ev.preventDefault(); el.click();
    }
  });
  function assignPop(anchor, ids) {
    var one = ids.length === 1 ? taskById(ids[0]) : null;
    var cur = one ? one.assignees : [];
    var el = popOpen(anchor, '<div class="ph">' + (one ? 'มอบหมาย “' + esc(one.title) + '” ให้' : 'มอบหมาย ' + ids.length + ' งานให้') + '</div>' +
      '<div class="chips" id="popAs">' + activeStaff().map(function (x) {
        return '<button type="button" class="chip' + (cur.indexOf(x.id) !== -1 ? ' on' : '') + '" data-as="' + esc(x.id) + '">' + avatar(x) + esc(shortName(x)) + '</button>';
      }).join('') + '</div>' +
      (one ? '' : '<div class="pqn">คนที่เลือกจะแทนคนรับเดิมของทุกงาน</div>') +
      '<div class="pf"><button type="button" class="btn-ghost sm" data-pop-cancel>ยกเลิก</button><button type="button" class="btn sm" data-pop-ok>บันทึก</button></div>');
    $('#popAs', el).addEventListener('click', function (ev) { var b = ev.target.closest('[data-as]'); if (b) b.classList.toggle('on'); });
    $('[data-pop-ok]', el).addEventListener('click', function () {
      var who = $$('.chip.on[data-as]', el).map(function (b) { return b.getAttribute('data-as'); });
      this.disabled = true;
      if (one) {
        api('/tasks/' + one.id, 'PUT', { assignees: who }).then(function () { S.tasks = null; popClose(); toast(who.length ? 'เปลี่ยนคนรับแล้ว' : 'เอาคนรับออกแล้ว'); render(); })
          .catch(function (e) { toast(e.message, true); });
      } else bulkRun('assign', { assignees: who }, 'เปลี่ยนคนรับ');
    });
  }
  /* วันลัดจากวันเดิม (หรือวันนี้ถ้ายังไม่มี) เวลาเดิมคงไว้ */
  function shiftFrom(base, days) {
    var d = base ? new Date(base) : new Date(); if (!base) d.setHours(18, 0, 0, 0);
    d.setDate(d.getDate() + days); return d;
  }
  function duePop(anchor, ids) {
    var one = ids.length === 1 ? taskById(ids[0]) : null;
    var quick = [['พรุ่งนี้', 'tmr'], ['+1 วัน', 1], ['+3 วัน', 3], ['ศุกร์นี้', 'fri'], ['+7 วัน', 7]];
    var el = popOpen(anchor, '<div class="ph">' + (one ? 'กำหนดส่ง “' + esc(one.title) + '”' + (one.dueAt ? ' · ตอนนี้ ' + esc(fmtDue(one)) : '') : 'กำหนดส่ง ' + ids.length + ' งาน') + '</div>' +
      '<input class="input" type="datetime-local" data-due-in value="' + esc(one ? toLocalInput(one.dueAt) : '') + '" aria-label="วันและเวลา">' +
      '<div class="pq"><span class="pqn">' + (one ? 'ทางลัด' : 'เลื่อนจากวันเดิมของแต่ละงาน') + '</span>' +
      quick.map(function (q) { return '<button type="button" class="chip plain" data-dq="' + q[1] + '">' + q[0] + '</button>'; }).join('') + '</div>' +
      '<input class="input" data-due-why placeholder="เหตุผลที่เลื่อน (ถ้ามี)" maxlength="300">' +
      '<div class="pf"><button type="button" class="btn-ghost sm" data-pop-cancel>ยกเลิก</button><button type="button" class="btn sm" data-pop-ok>' + (one ? 'บันทึก' : 'ตั้งวันนี้ให้ทุกงาน') + '</button></div>');
    var inp = $('[data-due-in]', el), why = $('[data-due-why]', el);
    function quickDate(q) {
      var base = one ? one.dueAt : null;
      if (q === 'tmr') return shiftFrom(startOfDay(new Date()).toISOString(), 1);
      if (q === 'fri') { var d = nextWeekday(5, 18, 0); if (base) { var b0 = new Date(base); d.setHours(b0.getHours(), b0.getMinutes(), 0, 0); } return d; }
      return shiftFrom(base, Number(q));
    }
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-dq]'); if (!b) return;
      var q = b.getAttribute('data-dq');
      if (one || q === 'tmr' || q === 'fri') { inp.value = toLocalInput(quickDate(q).toISOString()); if (one) return; }
      if (!one && (q === '1' || q === '3' || q === '7')) { bulkRun('due', { shiftDays: Number(q), reason: why.value.trim() }, 'เลื่อนส่ง'); return; }
      if (!one) $('[data-pop-ok]', el).click();
    });
    $('[data-pop-ok]', el).addEventListener('click', function () {
      var iso = fromLocalInput(inp.value);
      if (!iso) { toast('ยังไม่ได้เลือกวัน', true); return; }
      this.disabled = true;
      if (one) {
        api('/tasks/' + one.id, 'PUT', { dueAt: iso, reason: why.value.trim() })
          .then(function () { S.tasks = null; popClose(); toast(one.dueAt ? 'เลื่อนกำหนดส่งแล้ว' : 'ใส่กำหนดส่งแล้ว'); render(); })
          .catch(function (e) { toast(e.message, true); });
      } else bulkRun('due', { dueAt: iso, reason: why.value.trim() }, 'ตั้งกำหนดส่ง');
    });
    inp.focus();
  }
  /* แก้ชื่อในแถว: Enter/คลิกที่อื่น = บันทึก · Esc = ยกเลิก */
  function titleEdit(id) {
    var t = taskById(id); if (!t) return;
    var pen = $('[data-tedit="' + id + '"]'); if (!pen) return;
    var main = pen.closest('.main'); if (!main || $('.tedit', main)) return;
    var line = $('.tline', main);
    line.innerHTML = '<span class="tedit"><input class="input" maxlength="200" aria-label="ชื่องาน"><span class="teh">Enter บันทึก · Esc ยกเลิก</span></span>';
    var inp = $('input', line);
    inp.value = t.title;
    var closed = false;
    function finish(save) {
      if (closed) return; closed = true;
      var v = inp.value.trim();
      if (!save || !v || v === t.title) { render(); return; }
      api('/tasks/' + id, 'PUT', { title: v }).then(function () { S.tasks = null; toast('แก้ชื่องานแล้ว'); render(); })
        .catch(function (e) { toast(e.message, true); render(); });
    }
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    });
    inp.addEventListener('blur', function () { setTimeout(function () { finish(true); }, 0); });
    inp.focus(); inp.select();
  }
  /* เมนู ⋯ ท้ายแถว */
  function rowMenu(anchor, id) {
    var t = taskById(id); if (!t) return;
    var es = effStatus(t);
    var act = es === 'review' ? (canApprove(t) ? 'approve' : '') : (es === 'done' ? 'undone' : 'done');
    var tickLbl = act === 'approve' ? 'ตรวจผ่าน' : (act === 'undone' ? 'เอากลับมาเป็นยังไม่เสร็จ'
      : (canApprove(t) ? 'ปิดงาน — เสร็จแล้ว' : 'เสร็จแล้ว — ส่งให้หัวหน้าตรวจ'));
    var h = '<div class="pmenu">';
    if (canTick(t) && act) h += '<button type="button" data-tick="' + esc(id) + '" data-act="' + act + '">' + esc(tickLbl) + '</button>';
    if (canAssign()) h += '<button type="button" data-pm="assign">เปลี่ยนคนรับผิดชอบ…</button>';
    if (canDue(t)) h += '<button type="button" data-pm="due">แก้กำหนดส่ง…</button>';
    if (canEditRow(t)) h += '<button type="button" data-pm="edit">แก้ไขรายละเอียด…</button>';
    h += '<button type="button" data-pm="open">เปิดงานเต็ม</button>';
    if (canEditRow(t)) h += '<button type="button" class="danger" data-pm="del">' + (t.parentId ? 'ลบงานย่อยนี้' : 'ลบงานนี้') + '</button>';
    h += '</div>';
    var el = popOpen(anchor, h);
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-pm]'); if (!b) return;
      var k = b.getAttribute('data-pm');
      popClose();
      if (k === 'assign') assignPop(anchor, [id]);
      else if (k === 'due') duePop(anchor, [id]);
      else if (k === 'edit') quickEdit(id);
      else if (k === 'open') location.hash = '#/task/' + id;
      else if (k === 'del') delTask(t);
    });
  }
  function delTask(t, btn) {
    if (!confirm('ลบ “' + t.title + '” ออกจากระบบ? งานย่อย รูป และประวัติจะหายไปด้วย ย้อนกลับไม่ได้')) return;
    if (btn) btn.disabled = true;
    api('/tasks/' + t.id, 'DELETE')
      .then(function () { S.tasks = null; toast('ลบงานแล้ว'); render(); })
      .catch(function (e) { if (btn) btn.disabled = false; toast(e.message, true); });
  }

  /* ============================================================
     ตารางงานประจำของทีม (Routine) — ดูทีละคนหรือเทียบพร้อมกัน เห็นช่องที่ยังว่าง
     นนท์ 22 ก.ย. 69: "จะได้รู้ว่าตรงไหนฟันหลอ ต้องเติมงาน" · หน้านี้หัวหน้าเห็นคนเดียว
     ============================================================ */
  var RT = { who: [], band: 'all' };
  var DOW_FULL = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  var BANDS = [
    { k: 'morning', th: 'เช้า', sub: '06–12', from: 6, to: 12 },
    { k: 'afternoon', th: 'บ่าย', sub: '12–16', from: 12, to: 16 },
    { k: 'evening', th: 'เย็น', sub: '16–23', from: 16, to: 23 }
  ];
  function rtHour(t) { return t.dueAt ? new Date(t.dueAt).getHours() + new Date(t.dueAt).getMinutes() / 60 : 9; }
  /* งานกินเวลาจากเวลาเริ่ม + จำนวนชั่วโมง → คืนช่วง band ที่ทับ (เช้า=0 บ่าย=1 เย็น=2) */
  function rtSpan(t) {
    var st = rtHour(t), en = st + (t.hours || 0.5);
    var b0 = 0, b1 = 0;
    for (var i = 0; i < BANDS.length; i++) {
      if (st >= BANDS[i].from) b0 = i;
      if (en > BANDS[i].from) b1 = i;
    }
    if (b1 < b0) b1 = b0;
    return { a: b0, b: b1, start: st, end: en };
  }
  function rtFmtRange(t) {
    var sp = rtSpan(t);
    var f = function (h) { var hh = Math.floor(h), mm = Math.round((h - hh) * 60); return pad(hh) + ':' + pad(mm); };
    return f(sp.start) + '–' + f(Math.min(23.99, sp.end));
  }
  function rtBand(t) {
    var h = rtHour(t);
    for (var i = 0; i < BANDS.length; i++) if (h >= BANDS[i].from && h < BANDS[i].to) return BANDS[i].k;
    return 'evening';
  }
  /* งานประจำนี้ตกวันไหนบ้าง (0=จันทร์..6=อาทิตย์) · รายเดือนแยกไปอยู่ใต้ตาราง */
  function rtDays(t) {
    if (t.repeat === 'daily') return [0, 1, 2, 3, 4, 5, 6];
    if (t.repeat === 'weekly') { var d = t.dueAt ? new Date(t.dueAt).getDay() : 1; return [(d + 6) % 7]; }
    return [];
  }
  /* ทีมที่อยู่ในตารางนี้ = คนที่มีงานประจำจริงเท่านั้น (นนท์ 22 ก.ย. 69: เอาแค่พิซซ่า เติ้ล แตง ไอซ์)
     ใครได้งานประจำเพิ่มก็โผล่เองอัตโนมัติ ไม่ต้องมาแก้โค้ด */
  function rtTeam(routines) {
    return activeStaff().filter(function (x) {
      return x.role !== 'owner' && (routines || []).some(function (t) { return t.assignees.indexOf(x.id) !== -1; });
    });
  }
  /* วันทำงานของแต่ละคน (work_days เก็บเป็นเลขวันแบบ JS 0=อาทิตย์) → แปลงเป็นดัชนีตาราง 0=จันทร์ */
  function rtOff(p, di) {
    if (!p || p.workDays == null || p.workDays === '') return false;
    var set = String(p.workDays).split(',').filter(function (x) { return x !== ''; }).map(Number);
    if (!set.length) return false;
    var js = (di + 1) % 7;   /* 0=จันทร์ → 1 ; 6=อาทิตย์ → 0 */
    return set.indexOf(js) === -1;
  }
  function rtPeople(routines) {
    var team = rtTeam(routines);
    if (RT.who.length) {
      var pick = team.filter(function (x) { return RT.who.indexOf(x.id) !== -1; });
      if (pick.length) return pick;
    }
    return team.slice(0, 4);
  }
  /* ---------- ลากโยกงานประจำ (นนท์ 22 ก.ย. 69) ----------
     ลากชิปไปทับชิปของอีกคน = สลับเจ้าของกัน · ลากลงช่องว่าง = ย้ายคน/วัน/เวลาไปช่องนั้น
     เปลี่ยนจริงที่ฐานข้อมูล: assignees + due_at (วันในสัปดาห์ + ชั่วโมงของช่วงนั้น) */
  var RDRAG = null;
  function rtBandStart(k) { for (var i = 0; i < BANDS.length; i++) if (BANDS[i].k === k) return BANDS[i].from + (k === 'morning' ? 4 : (k === 'afternoon' ? 2 : 1)); return 9; }
  /* ย้ายวัน/เวลาโดยคงรูปแบบเดิม: งานรายวันไม่ย้ายวัน (มันทุกวันอยู่แล้ว) ย้ายแค่เวลา */
  function rtNewDue(t, day, band) {
    var d = t.dueAt ? new Date(t.dueAt) : new Date();
    var hh = rtHour(t);
    var b = BANDS.filter(function (x) { return x.k === band; })[0];
    if (!b) return null;
    if (hh < b.from || hh >= b.to) { d.setHours(rtBandStart(band), 0, 0, 0); }
    if (t.repeat === 'weekly' && day != null) {
      var cur = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() + (day - cur));
    }
    return d.toISOString();
  }
  /* อัปเดตหน้าจอทันทีจากข้อมูลในเครื่อง แล้วค่อยบันทึกเบื้องหลัง — ไม่ต้องโหลดหน้าใหม่
     ถ้าเซิร์ฟเวอร์ไม่รับ ค่อยดึงของจริงมาวาดทับ (นนท์ 22 ก.ย. 69) */
  function rtApply(reqs, msg, local) {
    if (!reqs.length) return;
    if (local) local();
    renderRoutine(true);
    Promise.all(reqs).then(function () { toast(msg); })
      .catch(function (e) {
        toast(e.message, true);
        loadTasks(true).then(function () { renderRoutine(true); });
      });
  }
  document.addEventListener('dragstart', function (ev) {
    var g = ev.target.closest && ev.target.closest('[data-rtgrip]');
    if (g) {
      ev.stopPropagation();
      RDRAG = { id: g.getAttribute('data-rtgrip'), resize: true };
      try { ev.dataTransfer.setData('text/plain', RDRAG.id); ev.dataTransfer.effectAllowed = 'move'; } catch (e) {}
      return;
    }
    var c = ev.target.closest && ev.target.closest('.rtchip[draggable="true"]');
    if (!c) return;
    RDRAG = { id: c.getAttribute('data-rt'), who: c.getAttribute('data-rtwho') };
    c.classList.add('dragging');
    try { ev.dataTransfer.setData('text/plain', RDRAG.id); ev.dataTransfer.effectAllowed = 'move'; } catch (e) {}
  });
  document.addEventListener('dragend', function () {
    RDRAG = null;
    $$('.rtchip.dragging').forEach(function (x) { x.classList.remove('dragging'); });
    $$('.rtover').forEach(function (x) { x.classList.remove('rtover'); });
  });
  document.addEventListener('dragover', function (ev) {
    if (!RDRAG) return;
    var target = ev.target.closest && (ev.target.closest('.rtchip') || ev.target.closest('[data-rtcell]'));
    if (!target) return;
    ev.preventDefault();
    try { ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
    $$('.rtover').forEach(function (x) { if (x !== target) x.classList.remove('rtover'); });
    target.classList.add('rtover');
  });
  document.addEventListener('drop', function (ev) {
    if (!RDRAG) return;
    var onChip = ev.target.closest && ev.target.closest('.rtchip');
    var cell = ev.target.closest && ev.target.closest('[data-rtcell]');
    if (!onChip && !cell) return;
    ev.preventDefault();
    var drag = RDRAG; RDRAG = null;
    $$('.rtover').forEach(function (x) { x.classList.remove('rtover'); });
    var a = taskById(drag.id);
    if (!a) { renderRoutine(); return; }

    /* ลากมือจับ = ยืดเวลาให้จบที่ช่วงที่ปล่อย (เช้า→บ่าย ก็ยืดถึงบ่าย) */
    if (drag.resize) {
      var cell2 = cell || (onChip && onChip.closest('[data-rtcell]'));
      if (!cell2) { renderRoutine(); return; }
      var bk = cell2.getAttribute('data-rtband');
      var bd = BANDS.filter(function (x) { return x.k === bk; })[0];
      if (!bd) { renderRoutine(); return; }
      /* ยืดให้ "ถึง" ช่วงที่ปล่อย ไม่ใช่กินยาวจนจบวัน — เข้าไปในช่วงนั้น 1 ชม. ก็พอ */
      var st0 = rtHour(a);
      var hrs = Math.round((Math.max(bd.from + 1, st0 + 0.5) - st0) * 4) / 4;
      if (hrs < 0.5) hrs = 0.5;
      if (hrs > 12) hrs = 12;
      if (hrs === a.hours) { toast('เท่าเดิม'); return; }
      rtApply([api('/tasks/' + a.id, 'PUT', { hours: hrs })], 'ปรับเป็น ' + hrs + ' ชม. (ถึงช่วง' + bd.th + ')',
        function () { a.hours = hrs; });
      return;
    }

    if (onChip && onChip.getAttribute('data-rt') !== drag.id) {
      /* ทับชิปอีกอัน = สลับเจ้าของกันทั้งคู่ */
      var b2 = taskById(onChip.getAttribute('data-rt'));
      if (!b2) return;
      var whoA = drag.who, whoB = onChip.getAttribute('data-rtwho');
      if (whoA === whoB) { toast('คนเดียวกัน ไม่ต้องสลับ'); return; }
      var newA = a.assignees.filter(function (x) { return x !== whoA; }).concat([whoB]);
      var newB = b2.assignees.filter(function (x) { return x !== whoB; }).concat([whoA]);
      rtApply([api('/tasks/' + a.id, 'PUT', { assignees: newA }), api('/tasks/' + b2.id, 'PUT', { assignees: newB })],
        'สลับงานระหว่าง ' + shortName(staffById(whoA)) + ' กับ ' + shortName(staffById(whoB)) + ' แล้ว',
        function () { a.assignees = newA; b2.assignees = newB; });
      return;
    }
    if (cell) {
      /* ลงช่องว่าง/ช่องของคนอื่น = ย้ายคน + วัน + ช่วงเวลา */
      var toWho = cell.getAttribute('data-rtwho');
      var day = Number(cell.getAttribute('data-rtday'));
      var band = cell.getAttribute('data-rtband');
      var body = {};
      if (toWho !== drag.who) body.assignees = a.assignees.filter(function (x) { return x !== drag.who; }).concat([toWho]);
      var due = rtNewDue(a, day, band);
      if (due && due !== a.dueAt) body.dueAt = due;
      if (!body.assignees && !body.dueAt) { toast('อยู่ที่เดิมอยู่แล้ว'); return; }
      var names = (body.assignees ? 'ย้ายให้ ' + shortName(staffById(toWho)) : 'ย้ายเวลา') +
        (body.dueAt ? ' · ' + (a.repeat === 'weekly' ? DOW_FULL[day] + ' ' : '') + fmtTime(new Date(body.dueAt)) : '');
      rtApply([api('/tasks/' + a.id, 'PUT', body)], names + ' แล้ว', function () {
        if (body.assignees) a.assignees = body.assignees;
        if (body.dueAt) a.dueAt = body.dueAt;
      });
    }
  });

  /* แก้ชื่อ/ลบงานได้จากการ์ดเลย — ลบต้องยืนยันซ้ำในการ์ดก่อนถึงจะลบจริง (นนท์ 22 ก.ย. 69) */
  function rtRename(id) {
    var t = taskById(id); if (!t) return;
    var chip = document.querySelector('.rtchip[data-rt="' + id + '"]');
    if (!chip) return;
    var host = chip.querySelector('.rttitle'); if (!host || chip.querySelector('input')) return;
    var w = Math.max(120, chip.clientWidth - 16);
    host.innerHTML = '<input class="input rtin" style="width:' + w + 'px" maxlength="200">';
    var inp = host.querySelector('input');
    inp.value = t.title;
    var done = false;
    function finish(save) {
      if (done) return; done = true;
      var v = inp.value.trim();
      if (!save || !v || v === t.title) { renderRoutine(); return; }
      t.title = v;
      renderRoutine(true);
      api('/tasks/' + id, 'PUT', { title: v }).then(function () { toast('แก้ชื่องานแล้ว'); })
        .catch(function (e) { toast(e.message, true); loadTasks(true).then(function () { renderRoutine(true); }); });
    }
    inp.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
    inp.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    });
    inp.addEventListener('blur', function () { setTimeout(function () { finish(true); }, 0); });
    inp.focus(); inp.select();
  }
  function rtAskDelete(id) {
    var t = taskById(id); if (!t) return;
    var chip = document.querySelector('.rtchip[data-rt="' + id + '"]');
    if (!chip || chip.querySelector('.rtconfirm')) return;
    var box = document.createElement('div');
    box.className = 'rtconfirm';
    box.innerHTML = '<b>ลบ “' + esc(t.title) + '” ?</b><span>งานประจำนี้จะหายจากทุกวัน ย้อนได้ที่ประวัติการแก้ไข</span>' +
      '<span class="rtcacts"><button type="button" class="btn sm danger" data-rtdel-yes="' + esc(id) + '">ลบจริง</button>' +
      '<button type="button" class="btn-ghost sm" data-rtdel-no>ยกเลิก</button></span>';
    chip.appendChild(box);
    /* กันไม่ให้ลิงก์ของการ์ดพาไปหน้างาน แต่ยังต้องให้คลิกไหลไปถึงตัวจัดการปุ่มยืนยัน */
    box.addEventListener('click', function (ev) { ev.preventDefault(); });
  }
  function renderRoutine(quiet) {
    var view = $('#view');
    view.className = 'page';
    var keepY = quiet ? (window.pageYOffset || document.documentElement.scrollTop || 0) : null;
    if (!quiet) view.innerHTML = '<div class="loading">กำลังโหลด…</div>';
    loadTasks().then(function (all) {
      var routines = all.filter(function (t) { return t.repeat && !t.parentId; });
      var people = rtPeople(routines);
      var byPerson = {};
      people.forEach(function (p) { byPerson[p.id] = routines.filter(function (t) { return t.assignees.indexOf(p.id) !== -1; }); });

      var h = '<div class="top"><div><span class="kicker">โครงสร้างงานทีม</span><h1>งานประจำของแต่ละคน</h1>' +
        '<p>ใครทำอะไรซ้ำ ๆ ทุกวัน/ทุกสัปดาห์ · ช่องว่างคือเวลาที่ยังไม่มีงานประจำ กดเติมได้เลย · เลือกดูทีละคนหรือเทียบพร้อมกันได้ถึง 4 คน</p></div>' +
        '<div class="top-r"><a class="btn" href="#/new">+ สั่งงานประจำ</a></div></div>';

      h += '<div class="cards">' + people.map(function (p) {
        var list = byPerson[p.id] || [];
        var perWeek = list.reduce(function (a, t) { return a + (t.repeat === 'daily' ? 7 : (t.repeat === 'weekly' ? 1 : 0.25)); }, 0);
        var hrs = list.reduce(function (a, t) { return a + (t.hours || 0) * (t.repeat === 'daily' ? 7 : (t.repeat === 'weekly' ? 1 : 0.25)); }, 0);
        var gaps = 0, offDays = 0;
        DOW_FULL.forEach(function (_, di) {
          if (rtOff(p, di)) { offDays++; return; }   /* วันหยุดไม่นับเป็นช่องว่าง */
          BANDS.forEach(function (b) {
            if (!list.some(function (t) { return rtDays(t).indexOf(di) !== -1 && rtBand(t) === b.k; })) gaps++;
          });
        });
        var slots = (7 - offDays) * BANDS.length;
        return '<article class="rtp' + (people.indexOf(p) + 1) + (!list.length ? ' bad' : (gaps > 14 ? ' warn' : '')) + '">' +
          '<span class="l">' + esc(shortName(p)) + '</span><b>' + Math.round(perWeek) + '</b>' +
          '<small>ครั้ง/สัปดาห์ · ' + (Math.round(hrs * 10) / 10) + ' ชม. · ช่องว่าง ' + gaps + '/' + slots +
          (offDays ? ' · หยุด ' + DOW_FULL.filter(function (_, i) { return rtOff(p, i); }).join('/') : '') + '</small></article>';
      }).join('') + '</div>';

      h += '<div class="tbar"><span class="tbar-lbl">ดูของ</span><div class="seg">' +
        '<button type="button" class="' + (!RT.who.length ? 'on' : '') + '" data-rt-who="">ทั้งทีม</button>' +
        rtTeam(routines).map(function (x) {
          return '<button type="button" class="' + (RT.who.indexOf(x.id) !== -1 ? 'on' : '') + '" data-rt-who="' + esc(x.id) + '">' + esc(shortName(x)) + '</button>';
        }).join('') + '</div>' +
        '<span class="tbar-lbl">ช่วงเวลา</span><div class="seg">' +
        [['all', 'ทั้งวัน']].concat(BANDS.map(function (b) { return [b.k, b.th]; })).map(function (p) {
          return '<button type="button" class="' + (RT.band === p[0] ? 'on' : '') + '" data-rt-band="' + p[0] + '">' + p[1] + '</button>';
        }).join('') + '</div>' +
        '<span class="tbar-n">' + routines.length + ' งานประจำ</span></div>';

      h += '<div class="rtlegend">' + TASK_TYPE_KEYS.map(function (k) {
        return '<span class="rtlg" data-t="' + k + '">' + esc(TASK_TYPE_TH[k]) + '</span>';
      }).join('') + '<span class="rtlg gap">ช่องว่าง = ยังไม่มีงานประจำ</span></div>';
      var bands = RT.band === 'all' ? BANDS : BANDS.filter(function (b) { return b.k === RT.band; });
      h += '<div class="scrollx"><table class="rtab"><thead><tr><th class="rtd">วัน</th><th class="rtb">ช่วง</th>' +
        people.map(function (p, pi) { return '<th class="rtp' + (pi + 1) + '">' + avatar(p) + '<span>' + esc(shortName(p)) + '</span></th>'; }).join('') + '</tr></thead><tbody>';
      DOW_FULL.forEach(function (dname, di) {
        bands.forEach(function (b, bi) {
          var bandIdx = BANDS.indexOf(b);
          h += '<tr' + (di >= 5 ? ' class="we"' : '') + (bi === 0 ? ' class="dstart' + (di >= 5 ? ' we' : '') + '"' : '') + '>' +
            (bi === 0 ? '<td class="rtd" rowspan="' + bands.length + '"><b>' + dname + '</b></td>' : '') +
            '<td class="rtb">' + b.th + '<small>' + b.sub + '</small></td>' +
            people.map(function (p, pi) {
              /* งานที่ "อยู่ในช่วงนี้" = ช่วงเวลาของงานคาบเกี่ยวแถบนี้ (เริ่มที่นี่ หรือยืดมาจากช่วงก่อน) */
              var items = rtOff(p, di) ? [] : (byPerson[p.id] || []).filter(function (t) {
                if (rtDays(t).indexOf(di) === -1) return false;
                var sp = rtSpan(t);
                return bandIdx >= sp.a && bandIdx <= sp.b;
              }).sort(function (x, y) { return rtHour(x) - rtHour(y); });
              var cellAttr = ' data-rtcell="1" data-rtwho="' + esc(p.id) + '" data-rtday="' + di + '" data-rtband="' + b.k + '"';
              if (rtOff(p, di)) {
                return '<td class="rtoff rtp' + (pi + 1) + '" title="' + esc(shortName(p)) + ' หยุดวัน' + DOW_FULL[di] + '">' +
                  (bi === 0 ? '<span>หยุด</span>' : '') + '</td>';
              }
              if (!items.length) return '<td class="rtempty rtp' + (pi + 1) + '"' + cellAttr + '><a href="#/new" title="ยังไม่มีงานประจำช่วงนี้">+ เติมงาน</a></td>';
              return '<td class="rtp' + (pi + 1) + '"' + cellAttr + '>' + items.map(function (t) {
                var sp = rtSpan(t);
                var head = sp.a === bandIdx, tail = sp.b === bandIdx, cont = !head;
                var grip = tail ? '<em class="rtgrip" draggable="true" data-rtgrip="' + esc(t.id) + '" title="ลากลง/ขึ้นเพื่อยืด–ย่อเวลา"></em>' : '';
                if (cont) {
                  /* งานเดียวกันที่ยืดมาจากช่วงก่อนหน้า — แสดงเป็นแถบต่อเนื่อง ไม่ใช่งานใหม่ */
                  return '<a class="rtchip cont' + (tail ? ' end' : '') + '" data-rt="' + esc(t.id) + '" data-rtwho="' + esc(p.id) + '" data-t="' + esc(t.taskType || 'other') +
                    '" href="#/task/' + esc(t.id) + '" title="' + esc(t.title) + ' · ' + rtFmtRange(t) + ' (งานเดียวกัน ต่อจากช่วงก่อน)">' +
                    '<span>↳ ' + esc(t.title) + '</span>' + grip + '</a>';
                }
                return '<a class="rtchip' + (sp.b > sp.a ? ' long' : '') + '" draggable="true" data-rt="' + esc(t.id) + '" data-rtwho="' + esc(p.id) + '" data-t="' + esc(t.taskType || 'other') +
                  '" href="#/task/' + esc(t.id) + '" title="' + esc(t.title) + ' · ' + esc(TASK_TYPE_TH[t.taskType || 'other'] || '') + ' · ' + rtFmtRange(t) + '">' +
                  '<b>' + esc(rtFmtRange(t)) + '</b><span class="rttitle">' + esc(t.title) + '</span>' +
                  (t.hours ? '<i>' + t.hours + ' ชม.' + (sp.b > sp.a ? ' · ถึงช่วง' + BANDS[sp.b].th : '') + '</i>' : '') +
                  '<span class="rtacts"><i class="rtact" role="button" tabindex="0" data-rtedit="' + esc(t.id) + '" title="แก้ชื่องาน">✎</i>' +
                  '<i class="rtact del" role="button" tabindex="0" data-rtdel="' + esc(t.id) + '" title="ลบงานนี้">✕</i></span>' + grip + '</a>';
              }).join('') + '</td>';
            }).join('') + '</tr>';
        });
      });
      h += '</tbody></table></div>' +
        '<p class="rthint">ลากงาน<b>ไปทับงานของอีกคน</b> = สลับกันทั้งคู่ · ลากลง<b>ช่องว่าง</b> = ย้ายคน/วัน/ช่วงเวลา · ลาก<b>ขอบล่างของแถบ</b> = ยืดเวลา เช่นยืดจากเช้าถึงบ่าย</p>';

      var monthly = routines.filter(function (t) { return t.repeat === 'monthly'; });
      if (monthly.length) {
        h += '<div class="group"><div class="group-h"><h3>งานประจำเดือน</h3><span>' + monthly.length + '</span>' + gsel() + '</div>' +
          '<div class="tlist">' + monthly.map(taskRow).join('') + '</div></div>';
      }
      view.innerHTML = h;
      syncSel();
      if (keepY != null) window.scrollTo(0, keepY);   /* ลากแล้วอย่ากระโดดขึ้นบน */
    }).catch(function (e) { showError(e); });
  }

  /* ============================================================
     ประวัติการแก้ไข — ใครแก้อะไรเมื่อไหร่ · ค้นหา · ย้อนเวอร์ชันเหมือน Google Sheet
     ============================================================ */
  var H = { q: '', who: '', entity: '', days: 30, items: [], more: false, next: null, busy: false };
  var ENTITY_TH = { task: 'งาน', post: 'โพสต์', campaign: 'ปฏิทินการตลาด', staff: 'ทีม + สิทธิ์', flow: 'ขั้นงาน' };
  var ACTION_TH = { create: 'สร้างใหม่', update: 'แก้ไข', delete: 'ลบ', revert: 'ย้อนเวอร์ชัน' };
  function histUrl(more) {
    var p = ['limit=60'];
    if (H.q) p.push('q=' + encodeURIComponent(H.q));
    if (H.who) p.push('who=' + encodeURIComponent(H.who));
    if (H.entity) p.push('entity=' + encodeURIComponent(H.entity));
    if (H.days) p.push('days=' + H.days);
    if (more && H.next) p.push('before=' + encodeURIComponent(H.next));
    return '/history?' + p.join('&');
  }
  function histLoad(more) {
    H.busy = true;
    return api(histUrl(more)).then(function (j) {
      H.items = more ? H.items.concat(j.items || []) : (j.items || []);
      H.more = !!j.more; H.next = j.nextBefore; H.busy = false;
      return j;
    }).catch(function (e) { H.busy = false; throw e; });
  }
  /* ค่าดิบในฐานข้อมูล → ข้อความที่คนอ่านรู้เรื่อง */
  function histVal(k, v) {
    if (v === '' || v == null) return '—';
    if (k === 'status') return STATUS_TH[v] || v;
    if (k === 'task_type') return TASK_TYPE_TH[v] || v;
    if (k === 'task_kind') return KIND_TH[v] || v;
    if (k === 'repeat') { var m = { daily: 'ทุกวัน', weekly: 'ทุกสัปดาห์', monthly: 'ทุกเดือน' }; return m[v] || 'ครั้งเดียว'; }
    if (k === 'support') return v === '1' ? 'ใช่' : 'ไม่ใช่';
    if (k === 'priority') return v === '1' ? 'ด่วน' : 'ปกติ';
    if (k === 'kpi_id') { var kp = kpiById(v); return kp ? kp.code : v; }
    if (k === 'campaign_id') { var c = campaignById(v); return c ? c.name : v; }
    if (k === '__assignees') return String(v).split(',').filter(Boolean).map(function (id) { var st2 = staffById(id); return st2 ? shortName(st2) : id; }).join(', ') || '—';
    if (k === 'due_at' || k === 'posted_at') { var d = new Date(v); return isNaN(d) ? v : fmtFull(v); }
    if (k === 'post_date') { return thaiShort(v); }
    if (k === 'page_id') return pageName(v) || v;
    if (k === 'channels') { try { return JSON.parse(v).join(', ') || '—'; } catch (e) { return v; } }
    return String(v).length > 90 ? String(v).slice(0, 90) + '…' : String(v);
  }
  function histLink(x) {
    if (x.entity === 'task') return '#/task/' + x.entityId;
    if (x.entity === 'post') return '#/posts';
    if (x.entity === 'campaign') return null;
    return null;
  }
  function histRow(x) {
    var st = staffById(x.by);
    var link = histLink(x);
    var fields = (x.fields || []).map(function (f) {
      return '<div class="hf"><span class="hfk">' + esc(f.th) + '</span>' +
        '<span class="hfv from">' + esc(histVal(f.k, f.from)) + '</span><span class="harr">→</span>' +
        '<span class="hfv to">' + esc(histVal(f.k, f.to)) + '</span></div>';
    }).join('');
    return '<div class="hrow' + (x.revertedAt ? ' undone' : '') + '" data-h="' + esc(x.id) + '">' +
      '<span class="hwhen"><b>' + esc(fmtAgo(x.at)) + '</b><small>' + esc(fmtFull(x.at)) + '</small></span>' +
      '<span class="hmain">' +
        '<span class="hhead">' + avatar(st) + '<b>' + esc(st ? shortName(st) : x.by) + '</b>' +
        '<span class="hact ' + esc(x.action) + '">' + esc(ACTION_TH[x.action] || x.action) + '</span>' +
        '<span class="hent">' + esc(ENTITY_TH[x.entity] || x.entity) + '</span></span>' +
        (link ? '<a class="htitle" href="' + link + '">' + esc(x.title || '(ไม่มีชื่อ)') + '</a>'
              : '<span class="htitle">' + esc(x.title || '(ไม่มีชื่อ)') + '</span>') +
        (fields ? '<span class="hfields">' + fields + '</span>'
                : (x.summary ? '<span class="hsum">' + esc(x.summary) + '</span>' : '')) +
        (x.revertedAt ? '<span class="hsum undone">ย้อนไปแล้วเมื่อ ' + esc(fmtAgo(x.revertedAt)) + '</span>' : '') +
      '</span>' +
      (x.canRevert && !readOnly() ? '<button type="button" class="btn-ghost sm hundo" data-hundo="' + esc(x.id) + '">ย้อนเวอร์ชันนี้</button>' : '<span></span>') +
      '</div>';
  }
  function renderHistory() {
    var view = $('#view');
    view.className = 'page';
    if (!H.items.length && !H.busy) { view.innerHTML = '<div class="loading">กำลังโหลด…</div>'; }
    histLoad(false).then(function () { paintHistory(); }).catch(function (e) { showError(e); });
  }
  function paintHistory() {
    var view = $('#view');
    var h = '<div class="top"><div><span class="kicker">ประวัติการแก้ไข</span><h1>ใครแก้อะไรไว้บ้าง</h1>' +
      '<p>ทุกการเปลี่ยนแปลงของงานและตารางโพสต์ · ค้นหาด้วยชื่องาน/หัวข้อโพสต์ · กด “ย้อนเวอร์ชันนี้” เพื่อคืนค่าก่อนการแก้ครั้งนั้น</p></div></div>';
    h += '<div class="tbar">' +
      '<input class="input hsearch" id="hq" placeholder="ค้นหาชื่องาน หัวข้อโพสต์ หรือสิ่งที่แก้…" value="' + esc(H.q) + '">' +
      '<div class="seg">' + [['', 'ทุกอย่าง'], ['task', 'งาน'], ['post', 'โพสต์']].map(function (p) {
        return '<button type="button" class="' + (H.entity === p[0] ? 'on' : '') + '" data-h-f="entity" data-v="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="seg">' + [[7, '7 วัน'], [30, '30 วัน'], [90, '3 เดือน'], [0, 'ทั้งหมด']].map(function (p) {
        return '<button type="button" class="' + (H.days === p[0] ? 'on' : '') + '" data-h-f="days" data-v="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="seg">' + [['', 'ทุกคน']].concat(activeStaff().map(function (x) { return [x.id, shortName(x)]; })).map(function (p) {
        return '<button type="button" class="' + (H.who === p[0] ? 'on' : '') + '" data-h-f="who" data-v="' + esc(p[0]) + '">' + esc(p[1]) + '</button>';
      }).join('') + '</div>' +
      '<span class="tbar-n">' + H.items.length + ' รายการ</span></div>';
    h += H.items.length
      ? '<div class="hlist">' + H.items.map(histRow).join('') + '</div>' +
        (H.more ? '<div class="hmore"><button type="button" class="btn-ghost" data-h-more>โหลดเพิ่ม</button></div>' : '')
      : '<div class="sec"><div class="empty"><b>ไม่พบประวัติในเงื่อนไขนี้</b>ลองขยายช่วงเวลา หรือล้างคำค้น</div></div>';
    view.innerHTML = h;
    var q = $('#hq');
    if (q) {
      q.addEventListener('input', function () {
        H.q = this.value.trim();
        clearTimeout(H._t);
        H._t = setTimeout(function () { histLoad(false).then(paintHistory).catch(function (e) { toast(e.message, true); }); }, 350);
      });
      if (H._focus) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); H._focus = false; }
    }
  }
  function histUndo(id, btn) {
    var x = H.items.filter(function (y) { return y.id === id; })[0];
    if (!confirm('ย้อน “' + ((x && x.title) || 'รายการนี้') + '” กลับไปเป็นค่าก่อนการแก้ครั้งนี้?' +
      (x && x.action === 'create' ? '\n(รายการนี้คือการสร้างใหม่ — ย้อน = ลบออกจากระบบ)' : ''))) return;
    btn.disabled = true;
    api('/history/' + id + '/revert', 'POST', {}).then(function (j) {
      S.tasks = null;
      toast(j.note || 'ย้อนเวอร์ชันแล้ว');
      histLoad(false).then(paintHistory);
    }).catch(function (e) { btn.disabled = false; toast(e.message, true); });
  }

  /* ---------- แก้ไขงานเร็วจากหน้ารายการ ---------- */
  function quickEdit(id) {
    var t = (S.tasks || []).filter(function (x) { return x.id === id; })[0];
    if (!t) { toast('ไม่พบงานนี้', true); return; }
    var host = document.createElement('div');
    host.className = 'modal';
    host.innerHTML = '<div class="modal-box qbox"><form id="qForm">' +
      '<div class="sec-h"><h2>แก้ไขงาน</h2><p>แก้จากหน้ารายการได้เลย · กด “เปิดงานเต็ม” ถ้าจะแนบรูปหรือดูไทม์ไลน์</p></div>' +
      '<div class="qbody">' +
      '<div class="field"><label class="label">ชื่องาน</label><input class="input" name="title" value="' + esc(t.title) + '" required></div>' +
      '<div class="field"><label class="label">มอบหมายให้</label><div class="chips" id="qAs">' +
      activeStaff().map(function (x) {
        return '<button type="button" class="chip' + (t.assignees.indexOf(x.id) !== -1 ? ' on' : '') + '" data-as="' + esc(x.id) + '">' + avatar(x) + esc(shortName(x)) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="grid3">' +
      '<div class="field"><label class="label">กำหนดส่ง</label><input class="input" type="datetime-local" name="dueAt" value="' + esc(toLocalInput(t.dueAt)) + '"></div>' +
      '<div class="field"><label class="label">สถานะ</label><select class="select" name="status">' +
      ['todo', 'doing', 'review', 'blocked', 'done'].map(function (k) {
        return '<option value="' + k + '"' + (t.status === k ? ' selected' : '') + '>' + STATUS_TH[k] + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><label class="label">ความถี่</label><select class="select" name="repeat">' +
      REPEAT_OPTS.map(function (pp) { return '<option value="' + pp[0] + '"' + ((t.repeat || '') === pp[0] ? ' selected' : '') + '>' + pp[1] + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<div class="grid3">' +
      '<div class="field"><label class="label">ประเภทงาน</label><select class="select" name="taskType">' +
      TASK_TYPE_KEYS.map(function (k) { return '<option value="' + k + '"' + ((t.taskType || 'other') === k ? ' selected' : '') + '>' + esc(TASK_TYPE_TH[k]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label class="label">ชนิดงาน</label><select class="select" name="taskKind">' +
      KIND_KEYS.map(function (k) { return '<option value="' + k + '"' + ((t.taskKind || 'ondemand') === k ? ' selected' : '') + '>' + esc(KIND_TH[k]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label class="label">ใช้เวลา (ชม.)</label><input class="input" type="number" step="0.25" min="0" max="200" name="hours" value="' + (t.hours == null ? '' : esc(String(t.hours))) + '"></div>' +
      '</div>' +
      '<div class="field"><label class="label">รายละเอียด</label><textarea class="textarea" name="detail" data-rich rows="3">' + esc(t.detail) + '</textarea></div>' +
      '</div>' +
      '<div class="qacts">' +
      (canEditRow(t) ? '<button type="button" class="btn-ghost danger" id="qDel">ลบงานนี้</button>' : '') +
      '<a class="btn-ghost" href="#/task/' + esc(t.id) + '" data-q-close>เปิดงานเต็ม</a>' +
      '<button type="button" class="btn-ghost" data-q-close>ยกเลิก</button>' +
      '<button type="submit" class="btn">บันทึก</button></div></form></div>';
    document.body.appendChild(host);
    var close = function () { host.remove(); };
    host._close = close;
    $$('[data-q-close]', host).forEach(function (b) { b.addEventListener('click', close); });
    host.addEventListener('click', function (ev) { if (ev.target === host) close(); });
    $('#qAs', host).addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-as]'); if (b) b.classList.toggle('on');
    });
    wireTyping(host);
    var del = $('#qDel', host);
    if (del) del.addEventListener('click', function () {
      if (!confirm('ลบ “' + t.title + '” ออกจากระบบ? งานย่อย รูป และประวัติจะหายไปด้วย ย้อนกลับไม่ได้')) return;
      del.disabled = true;
      api('/tasks/' + t.id, 'DELETE')
        .then(function () { S.tasks = null; close(); toast('ลบงานแล้ว'); render(); })
        .catch(function (e) { del.disabled = false; toast(e.message, true); });
    });
    $('#qForm', host).addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this;
      var btn = f.querySelector('button[type="submit"]');
      btn.disabled = true;
      api('/tasks/' + t.id, 'PUT', {
        title: f.title.value, detail: f.detail.value,
        dueAt: fromLocalInput(f.dueAt.value), status: f.status.value, repeat: f.repeat.value,
        taskType: f.taskType.value, taskKind: f.taskKind.value,
        hours: f.hours.value === '' ? null : Number(f.hours.value),
        assignees: $$('.chip.on[data-as]', $('#qAs', host)).map(function (b) { return b.getAttribute('data-as'); })
      }).then(function () { S.tasks = null; close(); toast('บันทึกแล้ว'); render(); })
        .catch(function (e) { btn.disabled = false; toast(e.message, true); });
    });
    var ti = $('input[name="title"]', host);
    if (ti) ti.focus();
  }

  /* ---------- ดูรูป: ย่อ–ขยาย–ลากได้ ----------
     ของเดิมพึ่ง max-height:100% ใน grid ซึ่งไม่ทำงาน รูปสูง ๆ เลยทะลุจอ เลื่อนลงไม่ได้ ย่อไม่ได้
     รอบนี้คำนวณสเกลเองแล้วสั่งผ่าน transform: พอดีจอเสมอตอนเปิด แล้วซูมต่อได้ถึง 8 เท่า */
  var LB = { on:false, scale:1, fit:1, x:0, y:0, pts:{}, pinch:null, moved:false, sx:0, sy:0, list:[], i:0 };

  function lbEls() {
    return { box:$('#lightbox'), img:$('#lightbox img'), stage:$('#lbStage'),
             zoom:$('#lbZoom'), link:$('#lbOpen'), hint:$('#lbHint'),
             prev:$('#lbPrev'), next:$('#lbNext'), count:$('#lbCount') };
  }
  function lbApply() {
    var e = lbEls();
    if (!e.img) return;
    var w = (e.img.naturalWidth || 1) * LB.scale, h = (e.img.naturalHeight || 1) * LB.scale;
    /* left/top 50% แล้วถอยครึ่งภาพ — จุดหมุนอยู่มุมบนซ้าย เลยคุมตำแหน่งได้ตรงไปตรงมา */
    e.img.style.transform = 'translate(' + (LB.x - w / 2) + 'px,' + (LB.y - h / 2) + 'px) scale(' + LB.scale + ')';
    if (e.zoom) e.zoom.textContent = Math.round(LB.scale * 100) + '%';
    var st = e.stage.getBoundingClientRect();
    var fits = w <= st.width + 1 && h <= st.height + 1;
    e.stage.style.cursor = fits ? 'default' : 'grab';
    $$('[data-lb="out"]').forEach(function (b) { b.disabled = LB.scale <= LB.fit * 0.5 + 0.001; });
    $$('[data-lb="in"]').forEach(function (b) { b.disabled = LB.scale >= 7.999; });
    if (e.hint) e.hint.textContent = fits
      ? 'สกรอลล์หรือบีบนิ้วเพื่อขยาย · ดับเบิลคลิกดูขนาดจริง · Esc ปิด'
      : 'ลากเพื่อเลื่อนดูส่วนที่เหลือ · สกรอลล์เพื่อย่อ–ขยาย · ดับเบิลคลิกกลับพอดีจอ';
  }
  /* กันภาพหลุดออกนอกจอ — ถ้าเล็กกว่าเวทีให้อยู่กลางเป๊ะ */
  function lbClamp() {
    var e = lbEls(), st = e.stage.getBoundingClientRect();
    var w = (e.img.naturalWidth || 1) * LB.scale, h = (e.img.naturalHeight || 1) * LB.scale;
    var mx = Math.max(0, (w - st.width) / 2), my = Math.max(0, (h - st.height) / 2);
    LB.x = Math.min(mx, Math.max(-mx, LB.x));
    LB.y = Math.min(my, Math.max(-my, LB.y));
  }
  function lbSet(scale, x, y) {
    LB.scale = Math.min(8, Math.max(LB.fit * 0.5, scale));
    if (x !== undefined) LB.x = x;
    if (y !== undefined) LB.y = y;
    lbClamp();
    lbApply();
  }
  /* ซูมโดยตรึงจุดใต้เมาส์/นิ้วไว้กับที่ ไม่งั้นภาพจะวิ่งหนีตอนซูม */
  function lbZoomAt(next, cx, cy) {
    var e = lbEls(), st = e.stage.getBoundingClientRect();
    next = Math.min(8, Math.max(LB.fit * 0.5, next));
    var ox = cx - st.left - st.width / 2 - LB.x;
    var oy = cy - st.top - st.height / 2 - LB.y;
    var k = next / LB.scale;
    LB.scale = next;
    LB.x -= ox * (k - 1);
    LB.y -= oy * (k - 1);
    lbClamp();
    lbApply();
  }
  function lbFit() {
    var e = lbEls(), st = e.stage.getBoundingClientRect();
    var nw = e.img.naturalWidth || 1, nh = e.img.naturalHeight || 1;
    /* ไม่ขยายรูปเล็กให้เบลอ — เต็มที่ที่ 1 เท่า */
    LB.fit = Math.min(st.width / nw, st.height / nh, 1);
    lbSet(LB.fit, 0, 0);
  }
  /* รูปทุกใบที่อยู่บนหน้าตอนนั้น เรียงตามที่ตาเห็น — ตัดตัวซ้ำออก (รูปเดียวกันโผล่ทั้งในอัปเดตและในไฟล์แนบทั้งหมด) */
  function lbCollect() {
    var out = [], seen = {};
    $$('.att.img[data-src]').forEach(function (el) {
      var u = el.getAttribute('data-src');
      if (u && !seen[u]) { seen[u] = 1; out.push(u); }
    });
    return out;
  }
  function lbShow(src) {
    var e = lbEls();
    if (e.link) e.link.href = src;
    e.img.removeAttribute('style');
    e.img.src = src;
    if (e.img.complete && e.img.naturalWidth) lbFit();
    else e.img.onload = function () { lbFit(); };
    lbNav();
  }
  /* ปุ่มซ้าย/ขวา + ตัวนับ — มีรูปเดียวก็ซ่อนไปเลย ไม่ต้องมีปุ่มกดแล้วไม่เกิดอะไร */
  function lbNav() {
    var e = lbEls(), many = LB.list.length > 1;
    if (e.prev) e.prev.hidden = !many;
    if (e.next) e.next.hidden = !many;
    if (e.count) {
      e.count.hidden = !many;
      e.count.textContent = (LB.i + 1) + ' / ' + LB.list.length;
    }
  }
  /* วนรอบ — รูปสุดท้ายกดถัดไปแล้วกลับไปใบแรก ไล่ดูรัว ๆ ได้ไม่ต้องหยุด */
  function lbGo(d) {
    if (LB.list.length < 2) return;
    LB.i = (LB.i + d + LB.list.length) % LB.list.length;
    lbShow(LB.list[LB.i]);
  }
  function lbOpen(src) {
    var e = lbEls();
    if (!e.box || !e.img) return;
    LB.on = true;
    LB.pts = {}; LB.pinch = null;
    LB.list = lbCollect();
    LB.i = Math.max(0, LB.list.indexOf(src));
    if (!LB.list.length) LB.list = [src];
    e.box.hidden = false;
    lbShow(src);
  }
  function lbClose() {
    var e = lbEls();
    if (!e.box) return;
    LB.on = false;
    e.box.hidden = true;
    e.img.removeAttribute('src');
  }
  function wireLightbox() {
    var e = lbEls();
    if (!e.box || e.box.dataset.wired) return;
    e.box.dataset.wired = '1';

    e.box.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-lb]');
      if (b) {
        var a = b.getAttribute('data-lb'), st = e.stage.getBoundingClientRect();
        if (a === 'close') lbClose();
        else if (a === 'prev') lbGo(-1);
        else if (a === 'next') lbGo(1);
        else if (a === 'fit') lbFit();
        else if (a === 'full') lbSet(1, 0, 0);
        else lbZoomAt(LB.scale * (a === 'in' ? 1.4 : 1 / 1.4), st.left + st.width / 2, st.top + st.height / 2);
        return;
      }
      /* คลิกพื้นหลังแล้วปิด แต่ต้องไม่ใช่ตอนเพิ่งลากเสร็จ ไม่งั้นลากทีปิดที */
      if (!LB.moved && !ev.target.closest('.lb-bar') && ev.target.tagName !== 'IMG') lbClose();
    });

    /* สกรอลล์ = ซูม (กันหน้าเว็บข้างหลังเลื่อนตาม) */
    e.stage.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      lbZoomAt(LB.scale * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), ev.clientX, ev.clientY);
    }, { passive: false });

    e.stage.addEventListener('dblclick', function (ev) {
      ev.preventDefault();
      if (LB.scale > LB.fit + 0.001) lbFit();
      else lbZoomAt(Math.max(1, LB.fit * 2.5), ev.clientX, ev.clientY);
    });

    /* ลาก + บีบนิ้ว ใช้ pointer event ตัวเดียวคุมทั้งเมาส์และจอสัมผัส */
    e.stage.addEventListener('pointerdown', function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      e.stage.setPointerCapture(ev.pointerId);
      LB.pts[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      LB.moved = false;
      LB.sx = ev.clientX; LB.sy = ev.clientY;
      var ids = Object.keys(LB.pts);
      if (ids.length === 2) {
        var a = LB.pts[ids[0]], b2 = LB.pts[ids[1]];
        LB.pinch = { d: Math.hypot(a.x - b2.x, a.y - b2.y), s: LB.scale };
      }
      e.stage.classList.add('pan');
    });
    e.stage.addEventListener('pointermove', function (ev) {
      var p = LB.pts[ev.pointerId];
      if (!p) return;
      var dx = ev.clientX - p.x, dy = ev.clientY - p.y;
      p.x = ev.clientX; p.y = ev.clientY;
      if (Math.abs(ev.clientX - LB.sx) > 3 || Math.abs(ev.clientY - LB.sy) > 3) LB.moved = true;
      var ids = Object.keys(LB.pts);
      if (ids.length === 2 && LB.pinch) {
        var a = LB.pts[ids[0]], b2 = LB.pts[ids[1]];
        var d = Math.hypot(a.x - b2.x, a.y - b2.y);
        if (LB.pinch.d > 0) lbZoomAt(LB.pinch.s * (d / LB.pinch.d), (a.x + b2.x) / 2, (a.y + b2.y) / 2);
        return;
      }
      lbSet(LB.scale, LB.x + dx, LB.y + dy);
    });
    var up = function (ev) {
      var alone = Object.keys(LB.pts).length === 1;
      delete LB.pts[ev.pointerId];
      if (Object.keys(LB.pts).length < 2) LB.pinch = null;
      if (!Object.keys(LB.pts).length) e.stage.classList.remove('pan');
      /* ยังไม่ซูม = ปัดแนวนอนเพื่อเปลี่ยนรูป · ซูมอยู่ = ลากเพื่อเลื่อนดูในรูปเหมือนเดิม
         เทียบกับแนวตั้งด้วย ไม่งั้นสะบัดนิ้วขึ้นลงนิดเดียวรูปก็เปลี่ยน */
      var dx = ev.clientX - LB.sx, dy = ev.clientY - LB.sy;
      if (alone && LB.list.length > 1 && LB.scale <= LB.fit + 0.01 &&
          Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        lbGo(dx < 0 ? 1 : -1);
      }
      setTimeout(function () { LB.moved = false; }, 0);
    };
    e.stage.addEventListener('pointerup', up);
    e.stage.addEventListener('pointercancel', up);

    window.addEventListener('resize', function () { if (LB.on) lbFit(); });
    window.addEventListener('keydown', function (ev) {
      if (!LB.on) return;
      if (ev.key === 'Escape') { ev.preventDefault(); lbClose(); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); lbGo(-1); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); lbGo(1); }
      else if (ev.key === '0') { ev.preventDefault(); lbFit(); }
      else if (ev.key === '1') { ev.preventDefault(); lbSet(1, 0, 0); }
      else if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); lbSet(LB.scale * 1.4); }
      else if (ev.key === '-' || ev.key === '_') { ev.preventDefault(); lbSet(LB.scale / 1.4); }
    });
  }

  /* ---------- หน้างานป้าย: funnel รวม + funnel รายป้าย + ตาราง ----------
     เปิดมาเห็นก่อนว่าของกองอยู่ขั้นไหน แล้วค่อยไล่ทีละป้าย · ป้ายเยอะสลับเป็นตารางได้ */
  /* มุมมองเริ่มต้นของหน้างานป้าย = ไปป์ไลน์ (การ์ดชุดเดียวกับหน้างานทั้งหมด — นนท์ 20 ก.ย. 69) */
  var SG = { view: 'board', stage: '', branch: '', showDone: false };
  function renderSignage() {
    var view = $('#view');
    view.className = 'page';
    view.innerHTML = '<div class="loading">กำลังโหลดงานป้าย…</div>';
    Promise.all([api('/signage'), loadTasks(), loadFlows(), loadCampaigns()]).then(function (rr) {
      var j = rr[0];
      var all = j.tasks || [], stByParent = {};
      (j.stages || []).forEach(function (x) { (stByParent[x.parentId] = stByParent[x.parentId] || []).push(x); });
      /* ขั้นปัจจุบันของแต่ละป้าย = ขั้นแรกที่ยังไม่ผ่าน · ป้ายไม่มีขั้น = 'none' · ปิดแล้ว = 'done' */
      function curStage(t) {
        if (effStatus(t) === 'done') return 'done';
        var ss = stByParent[t.id] || [];
        if (!ss.length) return 'none';
        for (var i = 0; i < SIGN_KEYS.length; i++) {
          var x = ss.filter(function (y) { return y.stage === SIGN_KEYS[i]; })[0];
          if (!x || effStatus(x) !== 'done') return SIGN_KEYS[i];
        }
        return 'done';
      }
      function area(t) { return t.signW != null && t.signH != null ? t.signW * t.signH * (t.signQty || 1) : 0; }
      all.forEach(function (t) { t._cur = curStage(t); t._area = area(t); });
      var open = all.filter(function (t) { return t._cur !== 'done'; });
      var branches = {};
      all.forEach(function (t) { if (t.signBranch) branches[t.signBranch] = (branches[t.signBranch] || 0) + 1; });

      var counts = {}, areas = {}, lateN = {};
      SIGN_KEYS.concat(['none']).forEach(function (k) { counts[k] = 0; areas[k] = 0; lateN[k] = 0; });
      open.forEach(function (t) {
        counts[t._cur]++; areas[t._cur] += t._area;
        var ss = stByParent[t.id] || [], x = ss.filter(function (y) { return y.stage === t._cur; })[0];
        if (x && x.dueAt && new Date(x.dueAt) < new Date()) lateN[t._cur]++;
      });
      var doneN = all.length - open.length;
      var maxC = Math.max(1, Math.max.apply(null, SIGN_KEYS.map(function (k) { return counts[k]; })));

      var list = all.filter(function (t) {
        if (!SG.showDone && t._cur === 'done') return false;
        if (SG.stage && t._cur !== SG.stage) return false;
        if (SG.branch && t.signBranch !== SG.branch) return false;
        return true;
      });
      /* เรียง: เลยกำหนดก่อน แล้วตามวันติดตั้ง */
      list.sort(function (a, b) { return (a.dueAt || '9') < (b.dueAt || '9') ? -1 : 1; });
      markSeq(list, '#/signage');

      var h = '<div class="top"><div><span class="kicker">งานป้าย</span><h1>ป้ายทุกอัน ค้างอยู่ขั้นไหน</h1>' +
        '<p>ทุกป้ายมี 6 ขั้นตายตัว ผ่านขั้นไหนต้องมีรูปยืนยัน · แถบซ้ายบวมตรงไหนคือคอขวด</p></div>' +
        '<div class="top-r"><a class="btn-ghost" href="#/all?ttype=signage">ดูในรายการงาน</a><a class="btn" href="#/new">+ สั่งป้าย</a></div></div>';

      /* funnel รวม — แถบยาวตามจำนวน ไม่ใช่รูปกรวยแข็ง ๆ เพราะขั้นกลางบวมได้ */
      h += '<div class="sec"><div class="sec-h"><h2>ค้างอยู่ขั้นไหน</h2><p>' + open.length + ' ป้ายค้าง · เสร็จแล้ว ' + doneN + '</p></div>' +
        '<div class="sec-b"><div class="sfbig">' + SIGN_STAGES.map(function (d, i) {
          var k = d[0], n = counts[k], w = Math.max(6, Math.round(n / maxC * 100));
          return '<button type="button" class="sfrow' + (SG.stage === k ? ' on' : '') + '" data-sg-stage="' + k + '">' +
            '<span class="sfl">' + (i + 1) + '. ' + esc(d[1]) + '</span>' +
            '<span class="sfb"><i class="s' + (i + 1) + '" style="width:' + w + '%"></i><b>' + n + '</b></span>' +
            '<span class="sfm">' + (areas[k] ? Math.round(areas[k] * 10) / 10 + ' ตร.ม.' : '') +
            (lateN[k] ? ' · <em>' + lateN[k] + ' เลยกำหนด</em>' : '') + '</span></button>';
        }).join('') +
        (counts.none ? '<button type="button" class="sfrow off' + (SG.stage === 'none' ? ' on' : '') + '" data-sg-stage="none"><span class="sfl">ยังไม่ตั้งขั้น</span><span class="sfb"><b>' + counts.none + '</b></span><span class="sfm">งานเก่าก่อนมีระบบนี้ — เข้าไปกด “สร้าง 6 ขั้น”</span></button>' : '') +
        '</div></div></div>';

      /* แถบกรอง + สลับมุมมอง */
      h += '<div class="tbar"><div class="seg">' +
        '<button type="button" class="' + (SG.view === 'board' ? 'on' : '') + '" data-sg-view="board">ไปป์ไลน์</button>' +
        '<button type="button" class="' + (SG.view === 'cards' ? 'on' : '') + '" data-sg-view="cards">การ์ด</button>' +
        '<button type="button" class="' + (SG.view === 'table' ? 'on' : '') + '" data-sg-view="table">ตาราง</button></div>' +
        (Object.keys(branches).length ? '<span class="tbar-lbl">สาขา</span><div class="seg">' +
          '<button type="button" class="' + (!SG.branch ? 'on' : '') + '" data-sg-branch="">ทุกสาขา</button>' +
          Object.keys(branches).sort().map(function (b) {
            return '<button type="button" class="' + (SG.branch === b ? 'on' : '') + '" data-sg-branch="' + esc(b) + '">' + esc(b) + ' <i>' + branches[b] + '</i></button>';
          }).join('') + '</div>' : '') +
        '<label class="tbar-lbl" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="sgDone"' + (SG.showDone ? ' checked' : '') + '> รวมที่เสร็จแล้ว</label>' +
        (SG.stage ? '<button type="button" class="btn-text" data-sg-stage="">✕ เลิกกรองขั้น</button>' : '') +
        '<span class="tbar-n">' + list.length + ' ป้าย</span></div>';

      if (!list.length) {
        h += '<div class="sec"><div class="empty"><b>ไม่มีป้ายตามเงื่อนไขนี้</b>ลองเลิกกรอง หรือกด “+ สั่งป้าย”</div></div>';
      } else if (SG.view === 'board') {
        /* การ์ด/คอลัมน์ชุดเดียวกับหน้างานทั้งหมด — ต่างกันแค่กรองเฉพาะงานป้ายไว้แล้ว */
        var ids0 = {}; list.forEach(function (t) { ids0[t.id] = 1; });
        var mine0 = (S.tasks || []).filter(function (t) { return ids0[t.id]; });
        var keep0 = B.type; B.type = 'signage';
        h += kanban(mine0.length ? mine0 : list, { hideTabs: true, noFilter: true });
        B.type = keep0;
      } else if (SG.view === 'table') {
        h += '<div class="sec"><div class="sec-b tight"><div class="scrollx"><table class="rpt sgt"><thead><tr>' +
          '<th>ป้าย</th><th>สาขา</th><th class="n">กว้าง × สูง</th><th class="n">ใบ</th><th class="n">ตร.ม.</th><th>ขั้นตอน</th><th>ค้างที่</th><th>ติดตั้ง</th><th>คนทำ</th></tr></thead><tbody>' +
          list.map(function (t) {
            var ss = stByParent[t.id] || [];
            var dots = SIGN_KEYS.map(function (k, i) {
              var x = ss.filter(function (y) { return y.stage === k; })[0];
              return '<i class="' + (x && effStatus(x) === 'done' ? 'd' + (i + 1) : '') + '" title="' + esc(SIGN_TH[k]) + '"></i>';
            }).join('');
            var cur = ss.filter(function (y) { return y.stage === t._cur; })[0];
            var late = cur && cur.dueAt && new Date(cur.dueAt) < new Date();
            return '<tr><td><a href="#/task/' + esc(t.id) + '">' + esc(t.title) + '</a></td><td>' + esc(t.signBranch || '—') + '</td>' +
              '<td class="n">' + (t.signW != null && t.signH != null ? t.signW + ' × ' + t.signH : '—') + '</td>' +
              '<td class="n">' + (t.signQty || 1) + '</td><td class="n">' + (t._area ? Math.round(t._area * 10) / 10 : '—') + '</td>' +
              '<td><span class="dots">' + dots + '</span></td>' +
              '<td' + (late ? ' style="color:var(--k-bad)"' : '') + '>' + (t._cur === 'done' ? 'เสร็จแล้ว' : (t._cur === 'none' ? 'ยังไม่ตั้งขั้น' : esc(SIGN_TH[t._cur]) + (late ? ' · เลย' : ''))) + '</td>' +
              '<td>' + (t.dueAt ? esc(fmtDate(new Date(t.dueAt))) : '—') + '</td>' +
              '<td>' + esc(t.assignees.map(function (id) { return shortName(staffById(id)); }).join(', ') || '—') + '</td></tr>';
          }).join('') + '</tbody></table></div></div></div>';
      } else {
        h += '<div class="sgcards">' + list.map(function (t) {
          var ss = stByParent[t.id] || [];
          var cur = ss.filter(function (y) { return y.stage === t._cur; })[0];
          var late = cur && cur.dueAt && new Date(cur.dueAt) < new Date();
          return '<article class="sgcard' + (late ? ' late' : '') + '">' +
            '<div class="sgh"><div><a href="#/task/' + esc(t.id) + '"><b>' + esc(t.title) + '</b></a>' +
            '<div class="sgm">' + (signMeta(t) ? '<span class="size">' + esc(signMeta(t)) + '</span>' : '') +
            avatars(t.assignees) + campaignChip(t.campaignId, false, true) + '</div></div>' +
            '<div class="sgdue' + (late ? ' late' : '') + '"><b>' + (t.dueAt ? esc(fmtDate(new Date(t.dueAt))) : 'ไม่กำหนด') + '</b>' +
            (t.dueAt ? '<small>' + esc(fmtDue(t)) + '</small>' : '') + '</div></div>' +
            (ss.length ? signFunnel(t, ss, false)
              : '<div class="postbar warn" style="margin:0 18px 16px">ยังไม่มี 6 ขั้น — <a href="#/task/' + esc(t.id) + '">เข้าไปสร้าง</a></div>') +
            '</article>';
        }).join('') + '</div>';
      }
      view.innerHTML = h;
      syncSel();
      var cb = $('#sgDone'); if (cb) cb.addEventListener('change', function () { SG.showDone = this.checked; renderSignage(); });
    }).catch(function (e) { showError(e); });
  }

  /* ---------- สรุปผลงานรายเดือน (ข้อ 03 ของคุณออน) ---------- */
  /* ตรงเวลานับตอน "ส่งรอตรวจ" เทียบ "วันเดิมก่อนถูกเลื่อน" — หัวหน้าตรวจช้าน้องไม่โดน
     โชว์ 2 ตัวเลข: ถึงเวลาเป๊ะ กับ ภายในวันนั้น (ตัวหลังคือตัวที่เอาไปเข้า KPI) */
  function pctNum(v) {
    if (v == null) return '<span style="color:var(--k-mut)">—</span>';
    var tone = v >= 90 ? 'ok' : (v >= 70 ? 'warn' : 'bad');
    return '<span class="pctnum ' + tone + '">' + v + '%</span>';
  }
  function renderReport() {
    var view = $('#view');
    view.className = 'page';
    var m = (S.route.query || {}).month || '';
    view.innerHTML = '<div class="loading">กำลังรวมตัวเลข…</div>';
    api('/report/monthly' + (m ? '?month=' + encodeURIComponent(m) : '')).then(function (j) {
      var mm = j.month.split('-'), y = Number(mm[0]), mo = Number(mm[1]);
      var prev = new Date(Date.UTC(y, mo - 2, 1)), next = new Date(Date.UTC(y, mo, 1));
      var fmtM = function (d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); };
      var label = MON_TH[mo - 1] + ' ' + (y + 543);
      var T = j.team;
      var h = '<div class="top"><div><span class="kicker">สรุปผลงาน</span><h1>' + esc(label) + '</h1>' +
        '<p>นับจากงานที่<b>ครบกำหนดในเดือนนี้</b> · “ตรงเวลา” วัดตอนส่งให้ตรวจ เทียบกับวันเดิมก่อนถูกเลื่อน ' +
        'หัวหน้าตรวจช้าไม่ทำให้น้องเสียคะแนน</p></div>' +
        '<div class="top-r"><a class="btn-ghost" href="#/report?month=' + fmtM(prev) + '">◀ เดือนก่อน</a>' +
        '<a class="btn-ghost" href="#/report?month=' + fmtM(next) + '">เดือนถัดไป ▶</a></div></div>';

      h += '<div class="cards">' +
        '<article class="hot"><span class="l">งานครบกำหนดเดือนนี้</span><b>' + T.assigned + '</b><small>ทั้งทีม</small></article>' +
        '<article><span class="l">ส่งแล้ว</span><b>' + T.finished + '</b><small>ยังค้าง ' + T.open + ' งาน</small></article>' +
        '<article' + (T.ontimeDayPct != null && T.ontimeDayPct < 80 ? ' class="warn"' : '') + '><span class="l">ตรงเวลา (ในวันนั้น)</span><b>' +
        (T.ontimeDayPct == null ? '—' : T.ontimeDayPct + '%') + '</b><small>ตัวที่ใช้กับ KPI</small></article>' +
        '<article><span class="l">ตรงเวลา (ถึงเวลาเป๊ะ)</span><b>' +
        (T.ontimePct == null ? '—' : T.ontimePct + '%') + '</b><small>เกณฑ์เข้ม</small></article></div>';

      if (!T.assigned) {
        h += '<div class="sec"><div class="empty"><b>ยังไม่มีงานที่ครบกำหนดในเดือนนี้</b>ลองเปลี่ยนเดือน</div></div>';
        view.innerHTML = h;
        return;
      }

      var rowsOf = function (map, nameOf, keys) {
        return (keys || Object.keys(map)).filter(function (k) { return map[k]; }).map(function (k) {
          var b = map[k];
          return '<tr><td>' + esc(nameOf(k)) + '</td>' +
            '<td class="n">' + b.assigned + '</td><td class="n">' + b.finished + '</td>' +
            '<td class="n">' + b.ontimeDay + '</td><td class="n">' + (b.finished - b.ontimeDay) + '</td>' +
            '<td class="n">' + pctNum(b.ontimeDayPct) + '</td>' +
            '<td class="n">' + (b.hours ? b.hours + ' ชม.' : '<span style="color:var(--k-mut)">—</span>') + '</td>' +
            '<td class="n">' + (b.kpiSharePct == null ? '<span style="color:var(--k-mut)">—</span>' : b.kpiSharePct + '%') + '</td>' +
            '<td class="n">' + (b.postpones || '') + '</td></tr>';
        }).join('');
      };
      var head = '<thead><tr><th></th><th class="n">ครบกำหนด</th><th class="n">ส่งแล้ว</th><th class="n">ตรงเวลา</th>' +
        '<th class="n">เลย</th><th class="n">% ตรงเวลา</th><th class="n">ชั่วโมง</th><th class="n">% เข้า KPI</th><th class="n">เลื่อน</th></tr></thead>';

      h += '<div class="sec"><div class="sec-h"><h2>รายคน</h2><p>งานที่มีหลายคนรับ นับให้ทุกคนเต็มจำนวน ไม่หาร</p></div>' +
        '<div class="sec-b tight"><div class="scrollx"><table class="rpt">' + head + '<tbody>' +
        rowsOf(j.byStaff, function (k) { return (staffById(k) || {}).name || k; }) + '</tbody></table></div></div></div>';

      h += '<div class="sec"><div class="sec-h"><h2>ตามประเภทงาน</h2></div><div class="sec-b tight"><div class="scrollx">' +
        '<table class="rpt">' + head + '<tbody>' +
        rowsOf(j.byType, function (k) { return TASK_TYPE_TH[k] || k; }, TASK_TYPE_KEYS) + '</tbody></table></div></div></div>';

      h += '<div class="sec"><div class="sec-h"><h2>รูทีน เทียบ ตามสั่ง</h2>' +
        '<p>ถ้ารูทีนกินเวลาเกินครึ่ง แปลว่าทีมไม่เหลือแรงทำงานที่สั่งเพิ่ม</p></div>' +
        '<div class="sec-b tight"><div class="scrollx"><table class="rpt">' + head + '<tbody>' +
        rowsOf(j.byKind, function (k) { return KIND_TH[k] || k; }, KIND_KEYS) + '</tbody></table></div></div></div>';

      h += '<div class="postbar">ทั้งทีมลงเวลากับงานที่ผูก KPI <b>' +
        (T.kpiSharePct == null ? '—' : T.kpiSharePct + '%') + '</b> (' + T.kpiHours + ' ชม.) · งาน support ' +
        T.supportHours + ' ชม. — ตัวเลขนี้แม่นเมื่อทุกงานใส่ชั่วโมงไว้</div>';

      view.innerHTML = h;
    }).catch(function (e) { showError(e); });
  }

  /* ---------- หน้าแคมเปญ: งาน + โพสต์ ที่ผูกไว้ (ข้อ 05 ของคุณออน) ---------- */
  function renderCampaign(cid) {
    var view = $('#view');
    view.className = 'page';
    view.innerHTML = '<div class="loading">กำลังโหลด…</div>';
    /* หน้าสถานะของโปรฯ/แคมเปญ — กดจากปฏิทินมาที่นี่ (นนท์ 19 ก.ย. 69: "ต้องเห็นว่ามีงานป้าย งานโพสต์ ทำยัง สถานะเป็นไง")
       โหลด S.tasks ด้วยเพื่อเอาขั้นของงานป้ายมาวาด funnel */
    Promise.all([loadCampaigns(), api('/campaigns/' + cid + '/related'), loadPages(), loadTasks()]).then(function (r) {
      var c = campaignById(cid), j = r[1];
      var tasks = (j.tasks || []).filter(function (t) { return !t.parentId; }), posts = j.posts || [];
      markSeq(tasks, '#/campaign/' + cid);
      var signs = tasks.filter(function (t) { return t.taskType === 'signage'; });
      var others = tasks.filter(function (t) { return t.taskType !== 'signage'; });
      var doneT = tasks.filter(function (t) { return effStatus(t) === 'done'; }).length;
      var doneP = posts.filter(function (x) { return x.status === 'done'; }).length;
      var lateT = tasks.filter(isLate).length;
      var kindTh = { content: 'คอนเทนต์', campaign: 'แคมเปญ', promo: 'โปรโมชั่น' };
      var h = '<div class="top"><div><span class="kicker">' + esc(kindTh[c && c.kind] || 'ปฏิทินการตลาด') + '</span><h1>' + esc(c ? c.name : 'แคมเปญ') + '</h1>' +
        (c && c.start ? '<p>' + esc(thaiShort(c.start)) + (c.end && c.end !== c.start ? ' – ' + esc(thaiShort(c.end)) : '') +
          (c.status ? ' · ' + ({ plan: 'วางแผน', live: 'กำลังจัด', done: 'จบแล้ว' }[c.status] || c.status) : '') + '</p>' : '') +
        '</div><div class="top-r"><a class="btn-ghost" href="' + CAL_URL + '#c=' + esc(cid) + '">แก้ไขรายละเอียดในปฏิทิน</a>' +
        '<a class="btn" href="#/new?campaign=' + esc(cid) + '">+ สั่งงานให้โปรฯ นี้</a></div></div>';

      h += '<div class="cards">' +
        '<article class="hot"><span class="l">งานป้าย</span><b>' + signs.length + '</b><small>' + (signs.length ? 'ติดตั้งแล้ว ' + signs.filter(function (t) { return effStatus(t) === 'done'; }).length : 'ยังไม่มี') + '</small></article>' +
        '<article' + (posts.length - doneP > 0 ? ' class="warn"' : '') + '><span class="l">โพสต์</span><b>' + posts.length + '</b><small>' + (posts.length ? 'ลงแล้ว ' + doneP + ' · ค้าง ' + (posts.length - doneP) : 'ยังไม่มี') + '</small></article>' +
        '<article><span class="l">งานอื่น</span><b>' + others.length + '</b><small>' + (others.length ? 'เสร็จ ' + others.filter(function (t) { return effStatus(t) === 'done'; }).length : 'ยังไม่มี') + '</small></article>' +
        '<article' + (lateT ? ' class="bad"' : '') + '><span class="l">เลยกำหนด</span><b>' + lateT + '</b><small>' + (lateT ? 'ต้องเคลียร์ก่อน' : 'ไม่มี') + '</small></article></div>';

      /* งานป้าย: แถว + funnel ย่อใต้แถว เห็นเลยว่าถึงขั้นไหน */
      h += '<div class="group"><div class="group-h"><h3>งานป้าย</h3><span>' + signs.length + '</span>' + (signs.length ? gsel() : '') + '</div>';
      if (signs.length) {
        h += '<div class="tlist">' + signs.map(function (t) {
          var st = stageSubs(t);
          return taskRow(t) + (st.length ? '<div class="cfun">' + signFunnel(t, st, true) + '</div>' : '');
        }).join('') + '</div>';
      } else {
        h += '<div class="empty small">ยังไม่มีงานป้ายสำหรับโปรฯ นี้ — <a href="#/new?campaign=' + esc(cid) + '&ttype=signage">สั่งงานป้าย</a></div>';
      }
      h += '</div>';

      h += '<div class="group"><div class="group-h"><h3>โพสต์</h3><span>' + posts.length + '</span></div>';
      if (posts.length) {
        h += '<div class="scrollx"><table class="rpt"><thead><tr>' +
          '<th>วันที่</th><th>เพจ</th><th>หัวข้อ</th><th>ช่องทาง</th><th>สถานะ</th></tr></thead><tbody>' +
          posts.map(function (x) {
            var late = x.status !== 'done' && x.date < todayIso();
            return '<tr' + (late ? ' class="late"' : '') + '><td>' + esc(thaiShort(x.date)) + (x.time ? ' ' + esc(x.time) : '') + '</td>' +
              '<td>' + esc(pageName(x.pageId)) + '</td>' +
              '<td>' + (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.topic || '(ไม่มีหัวข้อ)') + '</a>' : esc(x.topic || '(ไม่มีหัวข้อ)')) + '</td>' +
              '<td>' + esc((x.channels || []).join(', ')) + '</td>' +
              '<td>' + (x.status === 'done' ? '<span class="pill done">โพสต์แล้ว</span>' : (late ? '<span class="pill late">ยังไม่โพสต์ · เลยวัน</span>' : '<span class="pill">' + esc(POST_STATUS_TH[x.status] || x.status || '') + '</span>')) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        h += '<div class="empty small">ยังไม่มีโพสต์ผูกกับโปรฯ นี้ — <a href="#/posts">ไปตารางโพสต์</a> แล้วเลือกปฏิทินการตลาดในแถว</div>';
      }
      h += '</div>';

      h += '<div class="group"><div class="group-h"><h3>งานอื่น ๆ</h3><span>' + others.length + '</span>' + (others.length ? gsel() : '') + '</div>' +
        (others.length ? '<div class="tlist">' + others.map(taskRow).join('') + '</div>'
          : '<div class="empty small">ยังไม่มี — กด “+ สั่งงานให้โปรฯ นี้”</div>') + '</div>';
      view.innerHTML = h;
      syncSel();
    }).catch(function (e) { showError(e); });
  }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

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
      var es = effStatus(t), late = isLate(t);
      var canEdit = !readOnly() && (S.me.role === 'owner' || t.createdBy === S.me.id);
      var mine = t.assignees.indexOf(S.me.id) !== -1;
      var canStatus = !readOnly() && (canEdit || mine || S.me.canUpdateOthers);
      /* งานที่ยังไม่เคยมีกำหนดส่ง — คนรับงานใส่วันเองได้ (พิซซ่าขอ)
         ส่วนการ "เลื่อน" วันที่มีอยู่แล้ว ต้องมีสิทธิ์แก้วัน ไม่งั้นได้แค่กดขอเลื่อน */
      var canMoveDue = !readOnly() && (canEdit || (S.me.canReschedule && (mine || S.me.canUpdateOthers)));
      var canBackfill = (canStatus && !t.dueAt) || (canMoveDue && !canEdit);
      var by = staffById(t.createdBy);
      var view = $('#view');
      view.className = 'page';
      var h = seqNav(t.id) +
        '<div class="task-hero"><div class="crumbs"><a href="#/all">งานทั้งหมด</a><span>›</span>' +
        (parent ? '<a href="#/task/' + esc(parent.id) + '">' + esc(parent.title) + '</a><span>›</span><span class="pill repeat">งานย่อย</span><span>›</span>' : '') +
        (t.kpiId ? '<a href="#/all?kpi=' + esc(t.kpiId) + '">' + esc((kpiById(t.kpiId) || {}).code || '') + '</a><span>›</span>' : '') +
        (t.campaignId && campaignById(t.campaignId) ? campaignChip(t.campaignId) + '<span>›</span>' : '') +
        '<span class="pill ' + (late ? 'late' : esc(es)) + '">' + (late ? 'เลยกำหนด' : STATUS_TH[es]) + '</span>' +
        (t.repeat ? '<span class="pill ' + (es === 'done' ? 'done' : 'repeat') + '">' +
          (t.repeat === 'daily'
            ? (es === 'done' ? 'อัปเดตแล้ววันนี้' : 'งานประจำวัน · ยังไม่อัปเดตวันนี้')
            : (es === 'done' ? 'อัปเดตแล้วสัปดาห์นี้' : 'งานประจำสัปดาห์')) + '</span>' : '') + '</div>' +
        (canEdit ? '<div class="hero-acts"><button type="button" class="btn-ghost sm" id="editBtn">แก้ไขงาน</button></div>' : '') +
        '<h1>' + (t.priority ? '★ ' : '') + esc(t.title) + '</h1>' +
        '<div class="meta"><div><span class="k">ผู้รับผิดชอบ</span><div class="v">' + avatars(t.assignees) + '</div></div>' +
        '<div><span class="k">กำหนดส่ง</span><div class="v' + (late ? ' late' : '') + '">' + esc(fmtDue(t)) +
          (t.dueAt && !t.repeat ? ' <small style="color:var(--k-mut);font-weight:400">(' + esc(fmtFull(t.dueAt)) + ')</small>' : '') +
          (t.postpones ? ' <span class="pill late" title="เลื่อนมาแล้ว ' + t.postpones + ' ครั้ง">เลื่อน ' + t.postpones + '</span>' : '') +
          /* น้องเลื่อนเองไม่ได้ ขอได้อย่างเดียว — ตามที่คุณออนสั่ง */
          (t.dueAt && !canEdit && !canMoveDue && canStatus && es !== 'done'
            ? ' <button type="button" class="btn-text" id="postponeBtn">ขอเลื่อน</button>' : '') +
          '</div></div>' +
        '<div><span class="k">ชนิด / ใช้เวลา</span><div class="v">' + esc(KIND_TH[t.taskKind] || KIND_TH.ondemand) +
          (t.hours ? ' · ' + esc(String(t.hours)) + ' ชม.' : ' <small style="color:var(--k-warn);font-weight:400">ยังไม่ใส่ชั่วโมง</small>') + '</div></div>' +
        '<div><span class="k">KPI</span><div class="v">' + (t.kpiId ? '<span class="kpi-chip" style="font-size:13px;color:var(--k-ink)"><i style="background:' + esc((kpiById(t.kpiId) || {}).color) + '"></i>' + esc((kpiById(t.kpiId) || {}).code + ' · ' + (kpiById(t.kpiId) || {}).title) + '</span>' : (t.support ? '<span style="color:var(--k-soft)">งาน support — ไม่เข้า KPI</span>' : '<span style="color:var(--k-warn)">ยังไม่เลือก</span>')) + '</div></div>' +
        '<div><span class="k">สั่งโดย</span><div class="v">' + (by ? avatar(by) + ' ' + esc(shortName(by)) : '—') + ' <small style="color:var(--k-mut);font-weight:400">' + esc(fmtAgo(t.createdAt)) + '</small></div></div></div></div>';

      h += '<div class="two"><div>';
      h += '<div class="sec"><div class="sec-h"><h2>รายละเอียด</h2></div>' +
        '<div class="sec-b"><div class="task-detail" id="detailText">' + richText(t.detail) + '</div>' +
        (canEdit ? '<form id="editForm" hidden style="display:grid;gap:12px;margin-top:12px">' +
          '<div class="field"><label class="label">ชื่องาน</label><input class="input" name="title" value="' + esc(t.title) + '"></div>' +
          '<div class="field"><label class="label">รายละเอียด</label><textarea class="textarea" name="detail" data-rich>' + esc(t.detail) + '</textarea></div>' +
          '<div class="field"><label class="label">มอบหมายให้</label><div class="chips" id="editAs">' + S.staff.filter(function (s) { return s.active; }).map(function (s) {
            return '<button type="button" class="chip' + (t.assignees.indexOf(s.id) !== -1 ? ' on' : '') + '" data-as="' + esc(s.id) + '">' + avatar(s) + esc(shortName(s)) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="grid3"><div class="field"><label class="label">ประเภทงาน</label><select class="select" name="taskType">' +
          TASK_TYPE_KEYS.map(function (k) { return '<option value="' + k + '"' + ((t.taskType || 'other') === k ? ' selected' : '') + '>' + esc(TASK_TYPE_TH[k]) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label class="label">ชนิดงาน</label><select class="select" name="taskKind">' +
          KIND_KEYS.map(function (k) { return '<option value="' + k + '"' + ((t.taskKind || 'ondemand') === k ? ' selected' : '') + '>' + esc(KIND_TH[k]) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label class="label">ใช้เวลา (ชม.)</label><input class="input" type="number" step="0.25" min="0" max="200" name="hours" value="' + (t.hours == null ? '' : esc(String(t.hours))) + '"></div></div>' +
          '<div class="grid3 signfields"' + ((t.taskType || 'other') === 'signage' ? '' : ' hidden') + '>' +
          '<div class="field"><label class="label">กว้าง (ม.)</label><input class="input" type="number" step="0.01" min="0" max="100" name="signW" value="' + (t.signW == null ? '' : esc(String(t.signW))) + '"></div>' +
          '<div class="field"><label class="label">สูง (ม.)</label><input class="input" type="number" step="0.01" min="0" max="100" name="signH" value="' + (t.signH == null ? '' : esc(String(t.signH))) + '"></div>' +
          '<div class="field"><label class="label">จำนวนใบ</label><input class="input" type="number" step="1" min="1" max="9999" name="signQty" value="' + (t.signQty == null ? '' : esc(String(t.signQty))) + '"></div>' +
          '<div class="field" style="grid-column:1/-1"><label class="label">สาขา</label><input class="input" name="signBranch" value="' + esc(t.signBranch || '') + '" placeholder="สุราษฎร์ธานี / ชุมพร / ภูเก็ต / KAN Fashion"></div></div>' +
          '<div class="grid3"><div class="field"><label class="label">กำหนดส่ง</label><input class="input" type="datetime-local" name="dueAt" value="' + esc(toLocalInput(t.dueAt)) + '"></div>' +
          '<div class="field"><label class="label">ความถี่</label><select class="select" name="repeat">' + REPEAT_OPTS.map(function (p) { return '<option value="' + p[0] + '"' + (t.repeat === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label class="label">KPI <small>ทุกงานต้องมีคำตอบ</small></label><select class="select" name="kpiId">' +
          '<option value="' + SUPPORT_V + '"' + (t.support ? ' selected' : '') + '>งาน support — ไม่เข้า KPI</option>' +
          S.kpis.map(function (k) { return '<option value="' + esc(k.id) + '"' + (t.kpiId === k.id ? ' selected' : '') + '>' + esc(k.code + ' · ' + k.title) + '</option>'; }).join('') + '</select></div></div>' +
          '<div class="field"><label class="label">เชื่อมกับปฏิทินการตลาด <small>คอนเทนต์ / แคมเปญ / โปรโมชั่นที่งานนี้ทำให้</small></label>' + campaignSelect('name="campaignId"', t.campaignId) + '</div>' +
          '<label class="label" style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" name="priority"' + (t.priority ? ' checked' : '') + '> งานด่วน (★)</label>' +
          '<div class="acts"><button type="submit" class="btn">บันทึกการแก้ไข</button><button type="button" class="btn-ghost" id="cancelEdit">ยกเลิก</button>' +
          (S.me.role === 'owner' ? '<button type="button" class="btn-ghost danger" id="delBtn" style="margin-left:auto">ลบงานนี้</button>' : '') + '</div></form>' : '') +
        '</div></div>';

      /* งานป้ายหลัก: 6 ขั้นเป็น funnel — งานย่อยธรรมดาซ่อนไว้ใต้นั้น */
      var stageSubs = subs.filter(function (x) { return x.stage; });
      var plainSubs = subs.filter(function (x) { return !x.stage; });
      /* แถบขั้นตอน — ใช้ได้กับทุกประเภทที่ตั้ง flow ไว้ (ป้าย · LINE OA · ประเภทที่หัวหน้าเพิ่มเอง)
         เดิมล็อกไว้กับงานป้ายอย่างเดียว ขั้นของประเภทอื่นเลยถูกสร้างแล้วแต่ไม่โผล่ให้เห็น */
      var tFlow = flowOf(t.taskType);
      if (!t.parentId && tFlow.length) {
        var passed = stageSubs.filter(function (x) { return effStatus(x) === 'done'; }).length;
        var isSign = t.taskType === 'signage';
        h += '<div class="sec signsec"><div class="sec-h"><h2>ขั้นตอน' + esc(isSign ? 'งานป้าย' : ('งาน ' + (TASK_TYPE_TH[t.taskType] || ''))) + '</h2>' +
          '<p>' + (stageSubs.length ? 'ผ่านแล้ว ' + passed + ' จาก ' + tFlow.length + (isSign && signMeta(t) ? ' · ' + esc(signMeta(t)) : '') : 'ยังไม่ได้ตั้งขั้นตอน') + '</p></div>' +
          '<div class="sec-b">' +
          (stageSubs.length
            ? signFunnel(t, stageSubs, false, tFlow) +
              '<p class="hint" style="margin-top:12px">' +
              (isSign
                ? 'กดที่ขั้นเพื่อเข้าไปแนบรูปแล้วส่ง · วันคาดว่าเสร็จถอยหลังมาจากวันติดตั้ง ' +
                  (t.dueAt ? esc(fmtDate(new Date(t.dueAt))) : '') + ' ข้ามเสาร์อาทิตย์ · เลื่อนวันติดตั้งแล้วทุกขั้นขยับตาม'
                : 'กดที่ขั้นเพื่อเข้าไปทำงานในขั้นนั้น' +
                  (t.taskType === 'lineoa' ? ' · ขั้น “บรอดแคสต์แล้ว” ระบบติ๊กให้เองตอนกดส่งสำเร็จ' : '')) + '</p>'
            : '<p class="hint">งานนี้ยังไม่มีขั้นตอน (สั่งไว้ก่อนมีระบบนี้)</p>' +
              (canEdit || mine ? '<div class="acts" style="margin-top:10px"><button type="button" class="btn" id="mkStages">สร้าง ' + tFlow.length + ' ขั้นให้เลย</button></div>' : '')) +
          '</div></div>';
      }
      /* งานย่อยที่เป็น "ขั้น": บอกว่าเป็นขั้นที่เท่าไหร่ และต้องแนบรูปไหม */
      if (t.parentId && t.stage) {
        var pFlow = flowOf(t.taskType);
        var sIdx = 0, sDef = null;
        pFlow.forEach(function (x, i) { if (x.k === t.stage) { sIdx = i; sDef = x; } });
        h += '<div class="postbar">ขั้นที่ <b>' + (sIdx + 1) + ' จาก ' + (pFlow.length || 6) + '</b> · ' +
          esc((sDef && sDef.th) || SIGN_TH[t.stage] || t.stage) +
          (!sDef || sDef.pic ? ' — <b>ปิดขั้นนี้ต้องแนบรูปยืนยันในรอบเดียวกับที่กดส่ง</b>' : '') +
          (t.stage === 'approved' ? ' · ขั้นนี้หัวหน้าเป็นคนกดผ่าน' : '') + '</div>';
      }
      /* ฟอร์มอัปเดตงานย้ายมาอยู่เหนือ "ความคืบหน้า" (นนท์ 21 ก.ย. 69)
         เขียนอัปเดตแล้วเห็นเส้นเวลาต่อท้ายทันที ไม่ต้องกวาดตาข้ามคอลัมน์ */
      /* โหมดดูมุมคนอื่น = อ่านอย่างเดียว ไม่ให้เผลอโพสต์อัปเดตในชื่อคนอื่น */
      h += readOnly()
        ? '<div class="sec"><div class="sec-h"><h2>อัปเดตงาน</h2></div>' +
          '<div class="sec-b"><p class="hint">กำลังดูในมุมของคนอื่น — อัปเดตงานจากโหมดนี้ไม่ได้ กด “เลิกดู” ด้านบนก่อน</p></div></div>'
        : '<div class="sec"><div class="sec-h"><h2>อัปเดตงาน</h2></div><div class="sec-b"><form id="updForm" class="upl">' +
        (canStatus ? '<div><label class="label">สถานะ</label><div class="chips" id="stChips">' +
          (canApprove(t) ? ['todo', 'doing', 'blocked', 'done'] : ['todo', 'doing', 'blocked', 'review'])
            .map(function (s2) {
              /* น้องเห็นปุ่ม "ส่งให้ตรวจ" แทน "เสร็จแล้ว" จะได้ไม่งงว่าทำไมกดเสร็จแล้วไม่เสร็จ */
              var lbl = (s2 === 'review' && !canApprove(t)) ? 'ส่งให้ตรวจ' : STATUS_TH[s2];
              return '<button type="button" class="chip plain' + (es === s2 ? ' on' : '') + '" data-st="' + s2 + '">' + lbl + '</button>';
            }).join('') + '</div></div>' : '') +
        (canBackfill ? '<div class="field"><label class="label">กำหนดส่ง <small>' +
          (t.dueAt ? 'คุณมีสิทธิ์เลื่อนวันได้ — ระบบจะบันทึกว่าเลื่อนจากวันไหน' : 'งานนี้ยังไม่มีวัน ใส่ย้อนหลังได้') + '</small></label>' +
          '<div class="linkrow"><input class="input" type="datetime-local" id="backfillDue" value="' + esc(toLocalInput(t.dueAt)) + '">' +
          '<button type="button" class="btn-ghost sm" id="backfillBtn">' + (t.dueAt ? 'เลื่อนวัน' : 'บันทึกวัน') + '</button></div></div>' : '') +
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

      /* งานรอตรวจ: หัวหน้าเห็นกล่องตรวจก่อนอย่างอื่น — นนท์ขอให้เด้งเข้ามาที่ตัวเอง */
      if (es === 'review' && canApprove(t)) {
        h += '<div class="sec reviewbox"><div class="sec-h"><h2>งานนี้ส่งมาให้คุณตรวจ</h2>' +
          '<p>' + esc(t.assignees.map(function (x) { return shortName(staffById(x)); }).join(', ')) +
          ' ส่งเมื่อ ' + esc(fmtAgo(t.submittedAt || t.updatedAt)) + '</p></div>' +
          '<div class="sec-b"><form id="reviewForm" style="display:grid;gap:10px">' +
          '<textarea class="textarea" name="note" data-rich rows="2" placeholder="ผ่านเลยก็ไม่ต้องพิมพ์ · ถ้าส่งกลับแก้ ต้องบอกว่าให้แก้อะไร"></textarea>' +
          '<div class="acts"><button type="submit" class="btn" data-pass="1">ตรวจผ่าน</button>' +
          '<button type="button" class="btn-ghost" id="rejectBtn">ส่งกลับแก้</button></div>' +
          '</form></div></div>';
      }
      if (es === 'review' && !canApprove(t)) {
        h += '<div class="postbar warn">ส่งให้หัวหน้าตรวจแล้ว รอผลตรวจอยู่ — ถ้าต้องแก้จะมีแจ้งเตือนกลับมา</div>';
      }

      /* งานย่อยย้ายมาคอลัมน์ขวา แทนที่ฟอร์มอัปเดตงานที่ย้ายไปซ้าย */
      /* งานย่อย — เฉพาะงานหลัก (งานย่อยไม่ซ้อนอีกชั้น จะได้ไม่กลายเป็นต้นไม้ที่ตามไม่ทัน) */
      subs = plainSubs;
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

      if (files.length) {
        h += '<div class="sec"><div class="sec-h"><h2>ไฟล์แนบทั้งหมด</h2><p>' + files.length + ' รายการ</p></div><div class="sec-b">' + thumbsHtml(files) + '</div></div>';
      }
      /* แผงบรอดแคสต์ LINE — blast.js เติมให้เองถ้างานนี้เป็นประเภท LINE OA หรือเคยยิงไปแล้ว */
      h += '<div id="blastPanel"></div>';
      h += '</div></div>';
      view.innerHTML = h;
      pendingFiles = [];
      pendingLinks = [];
      wireTask(t);
      wireTyping(view);
      if (global.KAN_BLAST) global.KAN_BLAST.mountTaskPanel(t);
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

    /* ---- ตรวจงาน: ผ่าน / ส่งกลับแก้ ---- */
    var rf = $('#reviewForm');
    if (rf) {
      var sendReview = function (pass) {
        var note = rf.note.value.trim();
        if (!pass && !note) { toast('ส่งกลับแก้ต้องบอกด้วยว่าให้แก้อะไร', true); rf.note.focus(); return; }
        $$('button', rf).forEach(function (x) { x.disabled = true; });
        api('/tasks/' + t.id + '/review', 'POST', { pass: pass, note: note })
          .then(function () {
            S.tasks = null;
            toastUndo(pass ? 'ตรวจผ่านแล้ว' : 'ส่งกลับให้แก้แล้ว', function () {
              return api('/tasks/' + t.id, 'PUT', { status: 'review' }).then(function () {
                S.tasks = null; toast('เอากลับมาเป็นรอตรวจแล้ว'); renderTask(t.id);
              });
            });
            renderTask(t.id);
          })
          .catch(function (e) { $$('button', rf).forEach(function (x) { x.disabled = false; }); toast(e.message, true); });
      };
      rf.addEventListener('submit', function (ev) { ev.preventDefault(); sendReview(true); });
      $('#rejectBtn').addEventListener('click', function () { sendReview(false); });
    }

    /* ---- สร้าง 6 ขั้นให้งานป้ายเก่า ---- */
    var mk = $('#mkStages');
    if (mk) mk.addEventListener('click', function () {
      mk.disabled = true;
      api('/tasks/' + t.id + '/stages', 'POST', {})
        .then(function (j) { S.tasks = null; toast('สร้าง ' + (j.created || 0) + ' ขั้นแล้ว'); renderTask(t.id); })
        .catch(function (e) { mk.disabled = false; toast(e.message, true); });
    });

    /* ---- ใส่กำหนดส่งย้อนหลังให้งานที่ยังไม่มีวัน ---- */
    var bfBtn = $('#backfillBtn');
    if (bfBtn) bfBtn.addEventListener('click', function () {
      var v = fromLocalInput($('#backfillDue').value);
      if (!v) { toast('เลือกวันกับเวลาก่อน', true); return; }
      bfBtn.disabled = true;
      api('/tasks/' + t.id, 'PUT', { dueAt: v })
        .then(function () { S.tasks = null; toast('ใส่กำหนดส่งแล้ว'); renderTask(t.id); })
        .catch(function (e) { bfBtn.disabled = false; toast(e.message, true); });
    });

    /* ---- ขอเลื่อนกำหนดส่ง (น้องขอ หัวหน้าเป็นคนเลื่อนจริง) ---- */
    var pbBtn = $('#postponeBtn');
    if (pbBtn) pbBtn.addEventListener('click', function () {
      var reason = prompt('ขอเลื่อนเพราะอะไร — ข้อความนี้จะเด้งไปหาหัวหน้า');
      if (reason == null) return;
      reason = reason.trim();
      if (!reason) { toast('ต้องบอกเหตุผล', true); return; }
      pbBtn.disabled = true;
      api('/tasks/' + t.id + '/postpone-request', 'POST', { reason: reason })
        .then(function () { toast('ส่งคำขอเลื่อนให้หัวหน้าแล้ว'); renderTask(t.id); })
        .catch(function (e) { pbBtn.disabled = false; toast(e.message, true); });
    });

    /* โหมดอ่านอย่างเดียวไม่มีฟอร์มอัปเดต — จบตรงนี้ ไม่งั้นโค้ดข้างล่างล้วง element ที่ไม่มี */
    if (!$('#updForm')) return;

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
      /* ช่องขนาดป้ายโผล่เฉพาะตอนเลือกประเภท "ป้าย" */
      $('#editForm').taskType.addEventListener('change', function () {
        var sf = $('#editForm .signfields'); if (sf) sf.hidden = this.value !== 'signage';
      });
      $('#editAs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-as]'); if (b) b.classList.toggle('on'); });
      $('#editForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var f = this;
        api('/tasks/' + t.id, 'PUT', {
          title: f.title.value, detail: f.detail.value, dueAt: fromLocalInput(f.dueAt.value), repeat: f.repeat.value,
          kpiId: f.kpiId.value === SUPPORT_V ? null : (f.kpiId.value || null),
          support: f.kpiId.value === SUPPORT_V ? 1 : 0,
          priority: f.priority.checked ? 1 : 0,
          taskType: f.taskType.value,
          taskKind: f.taskKind.value,
          hours: f.hours.value === '' ? null : Number(f.hours.value),
          signW: f.signW.value === '' ? null : Number(f.signW.value),
          signH: f.signH.value === '' ? null : Number(f.signH.value),
          signQty: f.signQty.value === '' ? null : Number(f.signQty.value),
          signBranch: f.signBranch.value || null,
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
            '<span class="gsel" role="checkbox" tabindex="0" data-pgsel title="เลือกทั้งวัน"></span>' +
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
            (isToday ? 'วันนี้ · ' : '') + esc(DAY_TH[dd.getDay()] + ' ' + fmtDate(dd, true)) + '</h3><span>' + byDate[dt].length + '</span>' +
            '<span class="gsel" role="checkbox" tabindex="0" data-pgsel title="เลือกทั้งวัน"></span></div>' +
            '<div class="tlist">' + byDate[dt].map(postRow).join('') + '</div></div>';
        });
      }
      /* ประวัติการแก้ + ปุ่มล้างโพสต์เปล่า อยู่ใต้ปฏิทินเลย
         (นนท์: ต้องเห็นและลบของที่ค้างได้จากหน้าหลัก ไม่ต้องเปิดหน้าต่างเพิ่มโพสต์ก่อน) */
      h += '<div class="sheet-log page-log" id="postLog"><div class="lg-empty">กำลังอ่านประวัติ…</div></div>';

      view.innerHTML = h;
      syncPsel();

      $('#newPost').addEventListener('click', function () { openPostSheet(); });

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

      /* ผูกกับปฏิทินการตลาด — ให้ปฏิทินเป็นจุดเริ่มต้น โพสต์ทุกอันรู้ว่าทำให้รายการไหน */
      { key: 'campaignId', label: 'ปฏิทินการตลาด', width: 170, type: 'pick',
        options: function () {
          return [{ v: '', label: '— ไม่ผูก —' }].concat((S.campaigns || []).map(function (c) { return { v: c.id, label: c.name }; }));
        },
        text: function (r) { var c = campaignById(r.campaignId); return c ? c.name : ''; },
        parse: function (s) {
          s = String(s).trim().toLowerCase();
          if (!s || s.indexOf('ไม่ผูก') === 0) return '';
          var hit = (S.campaigns || []).filter(function (c) { return c.name.toLowerCase() === s; })[0] ||
                    (S.campaigns || []).filter(function (c) { return c.name.toLowerCase().indexOf(s) !== -1; })[0];
          return hit ? hit.id : null;
        },
        filterValues: function (r) { var c = campaignById(r.campaignId); return [c ? c.name : '(ไม่ผูก)']; } },

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
      row.url || '', row.note || '', row.campaignId || '']);
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
      url: row.url || '', note: row.note || '', campaignId: row.campaignId || null,
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
    var firstCamp = opts.campaignId || '';
    G.grid = global.KAN_GRID.create(host, {
      id: 'posts',
      columns: postColumns(),
      rows: rows,
      freeze: 1,
      isBlank: postRowBlank,
      blankRow: function (last) {
        return { pageId: (last && last.pageId) || firstPage, date: (last && last.date) || firstDate,
                 time: '', channels: (last && last.channels ? last.channels.slice() : []),
                 topic: '', kind: 'content', status: 'plan', url: '', note: '',
                 campaignId: (last && last.campaignId) || firstCamp };
      },
      cloneRow: function (src) {
        return { pageId: src.pageId, date: src.date, time: src.time, channels: (src.channels || []).slice(),
                 topic: src.topic, kind: src.kind, status: 'plan', url: '', note: src.note, campaignId: src.campaignId || '' };
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
    var sel = !!PSEL[x.id];
    /* ช่องติ๊กเลือกหน้าแถว (เลือกหลายโพสต์แล้วสั่งทีเดียว — นนท์ 20 ก.ย. 69: บางอัน auto มา อยากลบเป็นชุด)
       ปุ่มกลมตัวเดิมยังใช้ติ๊ก "โพสต์แล้ว" เหมือนเดิม */
    return '<div class="postrow ' + esc(st) + ' t-' + tone + (sel ? ' selected' : '') + '" data-post="' + esc(x.id) + '" title="' + esc(TONE_TH[tone]) + '">' +
      '<span class="psel' + (sel ? ' on' : '') + '" role="checkbox" tabindex="0" aria-checked="' + (sel ? 'true' : 'false') + '" data-psel="' + esc(x.id) + '" title="เลือกโพสต์นี้ (Shift = เลือกเป็นช่วง)"></span>' +
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

  /* ---------- ประวัติการแก้ตารางโพสต์ (ใต้ตารางในหน้าต่างเพิ่มโพสต์) ----------
     นนท์: "ถ้าผมบันทึกผิด ผมจะได้รู้ว่าผมแก้อะไรไปเมื่อไหร่ แล้วจะลบยังไง" */
  /* ---------- เลือกหลายโพสต์ ---------- */
  var PSEL = {}, PSEL_LAST = null;
  function pselIds() { return Object.keys(PSEL); }
  function pselToggle(id, range) {
    if (range && PSEL_LAST && PSEL_LAST !== id) {
      var all = $$('[data-psel]').map(function (el) { return el.getAttribute('data-psel'); });
      var a = all.indexOf(PSEL_LAST), b = all.indexOf(id);
      if (a !== -1 && b !== -1) {
        for (var i = Math.min(a, b); i <= Math.max(a, b); i++) PSEL[all[i]] = 1;
        PSEL_LAST = id; paintPsel(); return;
      }
    }
    if (PSEL[id]) delete PSEL[id]; else PSEL[id] = 1;
    PSEL_LAST = id; paintPsel();
  }
  function syncPsel() {
    var on = {};
    $$('[data-psel]').forEach(function (el) { on[el.getAttribute('data-psel')] = 1; });
    pselIds().forEach(function (id) { if (!on[id]) delete PSEL[id]; });
    paintPsel();
  }
  function paintPsel() {
    $$('[data-psel]').forEach(function (el) {
      var o = !!PSEL[el.getAttribute('data-psel')];
      el.classList.toggle('on', o);
      el.setAttribute('aria-checked', o ? 'true' : 'false');
      var row = el.closest('.postrow'); if (row) row.classList.toggle('selected', o);
    });
    $$('[data-pgsel]').forEach(function (g) {
      var grp = g.closest('.group');
      var all = $$('[data-psel]', grp), n = all.filter(function (el) { return PSEL[el.getAttribute('data-psel')]; }).length;
      g.classList.toggle('on', all.length > 0 && n === all.length);
      g.classList.toggle('some', n > 0 && n < all.length);
    });
    renderPBulk();
  }
  function renderPBulk() {
    var bar = $('#pbulk'), ids = pselIds();
    if (!ids.length) { if (bar) bar.remove(); document.body.classList.remove('has-bulk'); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'pbulk'; bar.className = 'bulkbar'; bar.setAttribute('role', 'toolbar'); document.body.appendChild(bar); }
    document.body.classList.add('has-bulk');
    bar.innerHTML = '<span class="bn"><b>' + ids.length + '</b> โพสต์ที่เลือก</span>' +
      '<button type="button" class="btn sm" data-pb="done">โพสต์แล้ว</button>' +
      '<button type="button" class="btn-ghost sm" data-pb="plan">ยังไม่โพสต์</button>' +
      '<button type="button" class="btn-ghost sm" data-pb="skip">ไม่โพสต์</button>' +
      '<button type="button" class="btn-ghost sm" data-pb="move">ย้ายวัน</button>' +
      '<button type="button" class="btn-ghost sm danger" data-pb="del">ลบ</button>' +
      '<button type="button" class="bx" data-pb="clear" title="ยกเลิกการเลือก" aria-label="ยกเลิกการเลือก">✕</button>';
  }
  function pbulkRun(fn, label) {
    var ids = pselIds();
    var bar = $('#pbulk'); if (bar) bar.classList.add('busy');
    var okN = 0, errs = [];
    /* ยิงทีละ 6 ตัวพร้อมกัน ไม่ให้ worker แน่น */
    var queue = ids.slice();
    function next() {
      if (!queue.length) return Promise.resolve();
      var batch = queue.splice(0, 6);
      return Promise.all(batch.map(function (id) {
        return fn(id).then(function () { okN++; }).catch(function (e) { errs.push(e.message); });
      })).then(next);
    }
    return next().then(function () {
      PSEL = {};
      toast(label + ' ' + okN + ' โพสต์' + (errs.length ? ' · ไม่สำเร็จ ' + errs.length + ' (' + errs[0] + ')' : ''), !!errs.length && !okN);
      renderPosts();
    });
  }
  function pbulkClick(k) {
    if (k === 'clear') { PSEL = {}; paintPsel(); return; }
    if (k === 'del') {
      if (!confirm('ลบ ' + pselIds().length + ' โพสต์ที่เลือกออกจากตาราง? ย้อนได้ที่หน้าประวัติการแก้ไข')) return;
      return pbulkRun(function (id) { return api('/posts/' + id, 'DELETE'); }, 'ลบแล้ว');
    }
    if (k === 'move') {
      var d = prompt('ย้ายโพสต์ที่เลือกไปวันไหน (รูปแบบ ปปปป-ดด-วว)', P.day || todayIso());
      if (!d) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { toast('รูปแบบวันไม่ถูกต้อง', true); return; }
      return pbulkRun(function (id) { return api('/posts/' + id, 'PUT', { date: d }); }, 'ย้ายไป ' + thaiShort(d) + ' แล้ว');
    }
    var th = { done: 'ทำเป็นโพสต์แล้ว', plan: 'ทำเป็นยังไม่โพสต์', skip: 'ทำเป็นไม่โพสต์' }[k];
    return pbulkRun(function (id) { return api('/posts/' + id, 'PUT', { status: k }); }, th);
  }

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
  function openPostSheet(o) {
    o = o || {};
    var host = document.createElement('div');
    host.className = 'modal';
    var today = o.date || P.day || ymd(new Date());
    var pageId = P.page || ((S.pages || [])[0] || {}).id || '';
    host.innerHTML = '<div class="modal-box sheet"><div class="sec-h"><h2>เพิ่มโพสต์</h2>' +
      '<p>พิมพ์ในตารางได้เลยเหมือน Excel · ก็อปจาก Excel มาวางก็ได้ · ระบบบันทึกให้เองทีละแถว</p>' +
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
    mountPostGrid($('#sheetHost', host), [], { date: today, pageId: pageId, blankRows: 10, campaignId: o.campaignId || (P.campaign || '') });
    /* เปิดมาเพื่อแก้โพสต์เดิม: ดึงขึ้นแถวบนสุดแล้วจ่อเคอร์เซอร์ที่หัวข้อ */
    if (o.postId) {
      api('/posts?from=1900-01-01&to=2999-12-31').then(function (j) {
        var pst = (j.posts || []).filter(function (x) { return x.id === o.postId; })[0], g0 = G.grid;
        if (!pst || !g0) { toast('ไม่พบโพสต์นี้แล้ว', true); return; }
        pst._saved = gridSnap(pst);
        g0.rows.unshift(pst);
        g0.refresh(true);
        selectSheetRow(g0, pst);
      }).catch(function (e) { toast(e.message, true); });
    }
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
                 topic: '', kind: 'content', status: 'plan', url: '', note: '',
                 campaignId: (last && last.campaignId) || o.campaignId || '' };
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
      if (g && !o.postId) { g.setSel(0, g.colIdx('topic'), false); }
    }, 60);
  }
  function selectSheetRow(g, row) {
    var ri = g.rows.indexOf(row), vr = g.view.indexOf(ri);
    if (vr < 0) { g.refresh(true); vr = g.view.indexOf(ri); }
    if (vr >= 0) g.setSel(vr, g.colIdx('topic'), false);
  }

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

  /* "แก้" จากปฏิทิน/รายการ/ประวัติ = เปิดตารางแล้วดึงโพสต์นั้นขึ้นแถวบนสุด (ทางแก้มีทางเดียว) */
  function openPostFormById(id) {
    openPostSheet({ postId: id });
  }

  /* ---------- กระดิ่ง: คนแท็กถึงเรา ---------- */
  /* แจ้งเตือนมี 2 มุมมอง — ของเดิมกดแล้วหายเลย ตามไม่ได้ว่าอันไหนดูแล้ว (นนท์แจ้ง 15 ก.ย. 69)
     ตอนนี้ "ยังไม่ได้ดู" คือคิวที่ต้องเคลียร์ · "ทั้งหมด" ย้อนดูของเก่าได้ · กดกลับเป็นยังไม่ได้ดูได้ */
  function renderInbox() {
    loadNotif().then(function (j) {
      renderHeaderUser();
      renderSidebar();
      var view = $('#view');
      view.className = 'page';
      var tab = (S.route.query || {}).tab === 'all' ? 'all' : 'new';
      var items = tab === 'all' ? j.items : j.items.filter(function (n) { return !n.read; });
      var seg = function (k, label, n) {
        return '<a class="' + (tab === k ? 'on' : '') + '" href="#/inbox' + (k === 'all' ? '?tab=all' : '') + '">' +
          esc(label) + (n ? '<i>' + n + '</i>' : '') + '</a>';
      };
      var h = '<div class="top"><div><span class="kicker">แจ้งเตือน</span><h1>คนแท็กถึงคุณ</h1>' +
        '<p>ทุกครั้งที่มีคนพิมพ์ <b>@' + esc(shortName(S.me)) + '</b> ในคอมเมนต์ของงาน จะมาโผล่ที่นี่ · ' +
        'กดเข้าไปดูแล้วจะย้ายไปแท็บ “ทั้งหมด” ไม่หายไปไหน ย้อนดูได้</p></div>' +
        (j.unread ? '<div class="top-r"><button type="button" class="btn-ghost" id="readAll">ทำเครื่องหมายว่าดูแล้วทั้งหมด</button></div>' : '') + '</div>';

      h += '<div class="tbar"><div class="seg nseg">' +
        seg('new', 'ยังไม่ได้ดู', j.unread) + seg('all', 'ทั้งหมด', j.items.length) +
        '</div><span class="tbar-n">' + items.length + ' รายการ</span></div>';

      if (!items.length) {
        h += '<div class="sec"><div class="empty">' + (tab === 'new'
          ? '<b>ดูครบแล้ว ไม่มีอะไรค้าง</b>ของที่ดูไปแล้วอยู่ในแท็บ “ทั้งหมด”'
          : '<b>ยังไม่มีใครแท็กถึงคุณ</b>เวลาทีมพิมพ์ @ชื่อคุณ ในช่องบันทึกของงาน จะเด้งมาที่นี่') + '</div></div>';
      } else {
        h += '<div class="sec"><div class="sec-b tight"><div class="tl">' + items.map(function (n) {
          var by = staffById(n.byStaff);
          return '<div class="tl-i notif' + (n.read ? '' : ' new') + '">' +
            avatar(by, 'lg') +
            '<div><a class="nlink" href="#/task/' + esc(n.taskId) + '" data-notif="' + esc(n.id) + '">' +
            '<div class="h"><b>' + esc(by ? shortName(by) : '?') + '</b><span>แท็กคุณใน</span>' +
            '<b style="font-weight:500">' + esc(n.taskTitle) + '</b><time>' + esc(fmtAgo(n.createdAt)) + '</time></div>' +
            '<div class="n">' + withMentions(n.note) + '</div></a>' +
            '<div class="nact">' + (n.read
              ? '<button type="button" class="btn-text" data-unread="' + esc(n.id) + '">กลับเป็นยังไม่ได้ดู</button>'
              : '<button type="button" class="btn-text" data-read="' + esc(n.id) + '">ทำเครื่องหมายว่าดูแล้ว</button>') +
            '</div></div></div>';
        }).join('') + '</div></div></div>';
      }
      view.innerHTML = h;

      var ra = $('#readAll');
      if (ra) ra.addEventListener('click', function () {
        ra.disabled = true;
        api('/notifications/read', 'POST', {}).then(function () { toast('ทำเครื่องหมายว่าดูแล้วทั้งหมด'); renderInbox(); })
          .catch(function (e) { ra.disabled = false; toast(e.message, true); });
      });
      /* กดที่ตัวข้อความ = เปิดงาน แล้วนับว่าดูแล้ว (ยิงไปเงียบ ๆ ไม่ต้องรอ) */
      $$('[data-notif]').forEach(function (a) {
        a.addEventListener('click', function () {
          api('/notifications/read', 'POST', { id: a.getAttribute('data-notif') }).catch(function () {});
        });
      });
      view.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-read],[data-unread]');
        if (!b) return;
        ev.preventDefault();
        var mark = b.hasAttribute('data-read');
        b.disabled = true;
        api('/notifications/' + (mark ? 'read' : 'unread'), 'POST', { id: b.getAttribute(mark ? 'data-read' : 'data-unread') })
          .then(function () { renderInbox(); })
          .catch(function (e) { b.disabled = false; toast(e.message, true); });
      });
    }).catch(function (e) { showError(e); });
  }

  /* ---------- ทีม ---------- */
  function renderTeam() {
    var view = $('#view');
    view.className = 'page';
    var owner = S.me.role === 'owner';
    var h = '<div class="top"><div><span class="kicker">ทีม + สิทธิ์</span><h1>ทีมงานและสิทธิ์เข้าถึง</h1>' +
      '<p>สมาชิกเข้าระบบด้วยการกดชื่อตัวเองที่หน้าแรก ไม่ต้องใช้รหัส · หัวหน้าใส่รหัสผ่าน ' + (owner ? '· ติ๊กได้ว่าใครเห็นหมวดไหน · หัวหน้าเห็นทุกหมวดเสมอ · "ชื่อเรียกใน @" คือคำที่ใช้พิมพ์ตอนสั่งงาน เช่น @Title' : '') + '</p></div>' +
      (owner ? '<div class="top-r"><label class="label" style="margin:0 8px 0 0">ดูระบบในมุมของ</label>' +
        '<select class="select" id="viewAsSel" style="width:auto;min-width:180px"><option value="">— ตัวเอง (หัวหน้า) —</option>' +
        S.staff.filter(function (x) { return x.active && x.id !== S.me.id; }).map(function (x) {
          return '<option value="' + esc(x.id) + '"' + (S.viewAs === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>';
        }).join('') + '</select></div>' : '') + '</div>' +
      (S.viewAs ? '<div class="postbar warn">กำลังดูทั้งระบบในมุมของ <b>' + esc((staffById(S.viewAs) || {}).name || '') +
        '</b> — เห็นเมนู งาน และกระดิ่งเหมือนที่เขาเห็น · แก้อะไรไม่ได้ในโหมดนี้ ' +
        '<button type="button" class="btn-text" data-viewas-off>เลิกดู</button></div>' : '');
    h += '<div class="two"><div class="sec"><div class="sec-h"><h2>สมาชิก</h2><p>' + S.staff.filter(function (s) { return s.active; }).length + ' คนใช้งานอยู่</p></div><div class="sec-b tight">' +
      S.staff.map(function (s) {
        return '<div class="team-row' + (s.active ? '' : ' off') + '">' + avatar(s, 'lg') + '<div class="n"><b>' + esc(s.name) + (s.role === 'owner' ? ' <span class="pill doing" style="margin-left:6px">หัวหน้า</span>' : '') + (s.active ? '' : ' <span class="pill todo">ปิดใช้งาน</span>') +
          (s.role === 'owner' && !s.hasPassword ? ' <span class="pill late">ยังไม่ตั้งรหัสผ่าน</span>' : '') + '</b>' +
          '<small>' + (s.role === 'owner' ? 'เข้าด้วยรหัสผ่าน' : 'กดชื่อเข้าได้เลย') + ' · @' + esc(s.aliases || shortName(s)) + '</small>' +
          '<div class="secchips">' + (s.role === 'owner'
            ? '<span class="pill doing">เห็นทุกหมวด</span>'
            : SECTION_LIST.map(function (sc) {
                var on = (s.sections || []).indexOf(sc[0]) !== -1;
                return '<button type="button" class="chip plain' + (on ? ' on' : '') + '"' +
                  (owner ? ' data-sec-staff="' + esc(s.id) + '" data-sec="' + sc[0] + '" data-to="' + (on ? '0' : '1') + '"' : ' disabled') +
                  ' title="' + esc(sc[1]) + '">' + esc(SECTION_SHORT[sc[0]]) + '</button>';
              }).join('')) + '</div>' +
          /* สิทธิ์เพิ่ม + เวลาทำงาน — พิซซ่าขอสิทธิ์ติ๊กงานแทนเติ้ล
             วันทำงานเก็บไว้ใช้กับหน้า Workload รอบหน้า แต่ตั้งไว้ก่อนได้เลย */
          (s.role === 'owner' ? '' :
            '<div class="secchips"><button type="button" class="chip plain' + (s.canUpdateOthers ? ' on' : '') + '"' +
            (owner ? ' data-upd-staff="' + esc(s.id) + '" data-to="' + (s.canUpdateOthers ? '0' : '1') + '"' : ' disabled') +
            ' title="ติ๊กงานและอัปเดตงานของคนอื่นได้">ติ๊กงานแทนคนอื่นได้</button>' +
            '<button type="button" class="chip plain' + (s.canReschedule ? ' on' : '') + '"' +
            (owner ? ' data-resch-staff="' + esc(s.id) + '" data-to="' + (s.canReschedule ? '0' : '1') + '"' : ' disabled') +
            ' title="เลื่อนกำหนดส่งของงานได้เอง ไม่ต้องขออนุมัติ">แก้วันกำหนดส่งได้</button>' +
            '<span class="wdays">' + esc(workDaysLabel(s)) + '</span></div>') + '</div>' +
          (owner ? '<div class="acts"><button type="button" class="btn-ghost sm" data-edit-staff="' + esc(s.id) + '">แก้ไข</button>' +
            '<button type="button" class="btn-ghost sm" data-days-staff="' + esc(s.id) + '">วันทำงาน</button>' +
            (s.role === 'owner' && s.id !== S.me.id ? '<button type="button" class="btn-ghost sm" data-pw-staff="' + esc(s.id) + '">ตั้งรหัสผ่านให้</button>' : '') +
            (s.id !== S.me.id ? '<button type="button" class="btn-ghost sm' + (s.active ? ' danger' : '') + '" data-active-staff="' + esc(s.id) + '" data-to="' + (s.active ? '0' : '1') + '">' + (s.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน') + '</button>' : '') + '</div>' : '') + '</div>';
      }).join('') + '</div></div><div>';
    if (owner) {
      h += '<div class="sec"><div class="sec-h"><h2>เพิ่มคนในทีม</h2></div><div class="sec-b"><form id="addStaff" style="display:grid;gap:12px">' +
        '<div class="field"><label class="label">ชื่อ-นามสกุล</label><input class="input" name="name" required placeholder="เช่น Somchai Dee"></div>' +
        '<div class="field"><label class="label">ชื่อเรียกใน @ <small>(คั่นด้วยจุลภาค)</small></label><input class="input" name="aliases" placeholder="เช่น Somchai,สมชาย"></div>' +
        '<div class="grid2"><div class="field"><label class="label">ระดับ</label><select class="select" name="role" id="newRole"><option value="member">สมาชิก</option><option value="owner">หัวหน้า</option></select></div>' +
        '<div class="field" id="newPwField" hidden><label class="label">รหัสผ่านหัวหน้า <small>อย่างน้อย 8 ตัว</small></label><input class="input" name="password" type="password" autocomplete="new-password" minlength="8" placeholder="เฉพาะหัวหน้า"></div></div>' +
        '<p class="hint" style="margin:0">สมาชิกไม่ต้องมีรหัส เพิ่มแล้วกดชื่อตัวเองที่หน้าแรกได้เลย</p>' +
        '<div class="field"><label class="label">เห็นหมวดไหนได้บ้าง <small>หัวหน้าเห็นทุกหมวดอยู่แล้ว</small></label>' +
        '<div class="chips" id="newSecs">' + SECTION_LIST.map(function (sc) {
          var on = sc[0] === 'tasks' || sc[0] === 'docs';
          return '<button type="button" class="chip plain' + (on ? ' on' : '') + '" data-newsec="' + sc[0] + '" title="' + esc(sc[1]) + '">' + esc(SECTION_SHORT[sc[0]]) + '</button>';
        }).join('') + '</div></div>' +
        '<div class="acts"><button type="submit" class="btn">เพิ่มคน</button></div></form></div></div>';
    }
    if (owner) {
      h += '<div class="sec"><div class="sec-h"><h2>รหัสผ่านของฉัน</h2><p>ใช้เฉพาะบัญชีหัวหน้า</p></div><div class="sec-b"><form id="myPw" style="display:grid;gap:12px">' +
        '<div class="grid2"><div class="field"><label class="label">รหัสผ่านปัจจุบัน</label><input class="input" name="password" type="password" autocomplete="current-password"' + (S.me.hasPassword ? ' required' : ' placeholder="ยังไม่มี เว้นว่างได้"') + '></div>' +
        '<div class="field"><label class="label">รหัสผ่านใหม่ <small>อย่างน้อย 8 ตัว</small></label><input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="8" required></div></div>' +
        '<div class="acts"><button type="submit" class="btn-ghost">บันทึก</button></div></form></div></div>';
    }
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
    if (owner) {
      h += '<div class="sec" id="backupBox"><div class="sec-h"><h2>สำรองข้อมูล</h2>' +
        '<p>ดาวน์โหลดข้อมูลทั้งระบบเก็บไว้เอง · ทำก่อนแก้อะไรใหญ่ ๆ ทุกครั้ง</p></div><div class="sec-b">' +
        '<div class="acts" style="margin-bottom:12px"><button type="button" class="btn" id="bkRun">ดาวน์โหลดไฟล์สำรอง</button>' +
        '<span class="hint" id="bkMsg" style="margin:0 0 0 12px">ได้ไฟล์ .json เก็บไว้ในเครื่องหรือ Google Drive</span></div>' +
        '<div class="subbar" id="bkBar" hidden><i style="width:0%"></i></div>' +
        '<p class="hint" style="margin-top:12px">ข้อมูลชุดนี้กู้คืนได้ 3 ทาง: ไฟล์ที่ดาวน์โหลดนี้ · สำเนารายวันในเครื่องของนนท์ (~/kanhub-backups) · ' +
        'และ Time Travel ของ Cloudflare ที่ย้อนได้ 30 วันโดยไม่ต้องมีไฟล์ · วิธีกู้อยู่ใน ADMIN.md</p></div></div>';
    }
    h += '<div class="sec" id="storageBox"><div class="sec-h"><h2>พื้นที่เก็บรูป</h2></div><div class="sec-b"><p class="hint">กำลังอ่าน…</p></div></div>';
    h += '</div></div>';
    view.innerHTML = h;

    var bkBtn = $('#bkRun');
    if (bkBtn) bkBtn.addEventListener('click', function () {
      var msg = $('#bkMsg'), bar = $('#bkBar'), fill = bar.querySelector('i');
      bkBtn.disabled = true;
      bar.hidden = false;
      msg.textContent = 'กำลังอ่านข้อมูล…';
      api('/backup/manifest').then(function (man) {
        var out = { app: 'kan-admin', db: man.db, at: man.at, tables: {} };
        var total = man.total || 1, done = 0;
        var seq = man.tables.filter(function (t) { return !t.missing; });
        var step = function (i) {
          if (i >= seq.length) return Promise.resolve();
          var t = seq[i].table;
          out.tables[t] = [];
          var page = function (off) {
            return api('/backup/table?table=' + t + '&offset=' + off + '&limit=200').then(function (r) {
              out.tables[t] = out.tables[t].concat(r.rows);
              done += r.rows.length;
              fill.style.width = Math.min(100, Math.round(done / total * 100)) + '%';
              msg.textContent = 'อ่าน ' + t + ' · ' + done.toLocaleString('th-TH') + ' แถว';
              return r.done ? null : page(off + r.limit);
            });
          };
          return page(0).then(function () { return step(i + 1); });
        };
        return step(0).then(function () { return out; });
      }).then(function (out) {
        var blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'kan-backup-' + ymd(new Date()) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        var mb = (blob.size / 1048576).toFixed(1);
        bkBtn.disabled = false;
        bar.hidden = true;
        msg.textContent = 'ได้ไฟล์แล้ว ' + mb + ' MB · เก็บไว้ให้ดี';
        okDialog({
          title: 'สำรองข้อมูลเรียบร้อย',
          lines: ['ไฟล์ kan-backup-' + ymd(new Date()) + '.json · ' + mb + ' MB',
                  Object.keys(out.tables).length + ' ตาราง · ' + Object.keys(out.tables).reduce(function (a, k) { return a + out.tables[k].length; }, 0).toLocaleString('th-TH') + ' แถว'],
          note: 'เอาไปเก็บใน Google Drive หรือที่อื่นนอกเครื่องด้วย จะปลอดภัยที่สุด',
        });
      }).catch(function (e) {
        bkBtn.disabled = false; bar.hidden = true;
        msg.textContent = '';
        toast('สำรองไม่สำเร็จ: ' + e.message, true);
      });
    });

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

    var myPw = $('#myPw');
    if (myPw) myPw.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this;
      var body = { password: f.password.value, newPassword: f.newPassword.value };
      api('/me/password', 'PUT', body)
        .then(function () { f.reset(); return refreshMe(); })
        .then(function () {
          okDialog({
            title: 'เปลี่ยนรหัสผ่านแล้ว',
            lines: ['ครั้งหน้ากดชื่อ ' + shortName(S.me) + ' ที่หน้าแรกแล้วใส่รหัสผ่านใหม่'],
            onClose: renderTeam,
          });
        })
        .catch(function (e) { toast(e.message, true); });
    });
    var add = $('#addStaff');
    if (add) add.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this;
      var who = f.name.value, isOwnerNew = f.role.value === 'owner';
      var secs = $$('#newSecs .chip.on').map(function (b) { return b.getAttribute('data-newsec'); });
      var body = { name: who, aliases: f.aliases.value, role: f.role.value, sections: secs };
      if (isOwnerNew) body.password = f.password.value;
      api('/staff', 'POST', body)
        .then(function () { return refreshMe(); })
        .then(function () {
          okDialog({
            title: 'เพิ่ม ' + who + ' เข้าทีมแล้ว',
            lines: ['เห็นได้: ' + (isOwnerNew ? 'ทุกหมวด (หัวหน้า)' : (secs.map(function (k) { return SECTION_SHORT[k]; }).join(' · ') || 'ยังไม่เปิดหมวดไหนเลย')),
                    isOwnerNew ? 'เข้าระบบ: กดชื่อที่หน้าแรกแล้วใส่รหัสผ่านที่ตั้งไว้'
                               : 'เข้าระบบ: เปิด admin.kan-hub.com/tasks/ แล้วกดชื่อตัวเองได้เลย ไม่ต้องใช้รหัส'],
            onClose: renderTeam,
          });
        }).catch(function (e) { toast(e.message, true); });
    });
    /* ช่องรหัสผ่านโผล่เฉพาะตอนเลือกระดับ "หัวหน้า" */
    var roleSel = $('#newRole');
    if (roleSel) roleSel.addEventListener('change', function () {
      var pf = $('#newPwField'); if (!pf) return;
      pf.hidden = this.value !== 'owner';
      pf.querySelector('input').required = this.value === 'owner';
    });
    var vsel = $('#viewAsSel');
    if (vsel) vsel.addEventListener('change', function () {
      S.viewAs = this.value || null;
      S.tasks = null;
      /* เข้าโหมดดูมุมคนอื่น → พาไปหน้า "งานของฉัน" ของเขาเลย จะได้เห็นของจริง
         ไม่ใช่แค่เมนูเปลี่ยน · ออกจากโหมดค่อยกลับมาหน้าทีม */
      if (S.viewAs) location.hash = '#/me'; else render();
    });
    view.addEventListener('click', function (ev) {
      var b;
      /* สิทธิ์ติ๊กงานแทนคนอื่น */
      if ((b = ev.target.closest('[data-resch-staff]'))) {
        var rid2 = b.getAttribute('data-resch-staff'), rto = b.getAttribute('data-to') === '1';
        b.disabled = true;
        api('/staff/' + rid2, 'PUT', { canReschedule: rto })
          .then(refreshMe)
          .then(function () {
            toast((rto ? 'เปิด' : 'ปิด') + 'สิทธิ์แก้วันกำหนดส่งให้ ' + shortName(staffById(rid2)) + ' แล้ว');
            renderTeam();
          })
          .catch(function (e) { b.disabled = false; toast(e.message, true); });
        return;
      }
      if ((b = ev.target.closest('[data-upd-staff]'))) {
        var uid2 = b.getAttribute('data-upd-staff'), to = b.getAttribute('data-to') === '1';
        b.disabled = true;
        api('/staff/' + uid2, 'PUT', { canUpdateOthers: to })
          .then(refreshMe)
          .then(function () {
            toast((to ? 'เปิด' : 'ปิด') + 'สิทธิ์ติ๊กงานแทนคนอื่นให้ ' + shortName(staffById(uid2)) + ' แล้ว');
            renderTeam();
          })
          .catch(function (e) { b.disabled = false; toast(e.message, true); });
        return;
      }
      /* วันทำงาน + ชั่วโมงต่อวัน — ใช้กับหน้า Workload รอบหน้า */
      if ((b = ev.target.closest('[data-days-staff]'))) {
        var did = b.getAttribute('data-days-staff'), ds = staffById(did);
        var cur = ds.workDays == null ? '1,2,3,4,5' : String(ds.workDays);
        var ans = prompt('วันทำงานของ ' + shortName(ds) + ' — ใส่เลขวันคั่นด้วยจุลภาค\n0=อาทิตย์ 1=จันทร์ 2=อังคาร 3=พุธ 4=พฤหัส 5=ศุกร์ 6=เสาร์\n\nเช่น พิซซ่าหยุดพฤหัส = 0,1,2,3,5,6', cur);
        if (ans == null) return;
        var hrs = prompt('ชั่วโมงที่รับงานได้จริงต่อวัน (อยู่ร้าน 8 ชม. แต่รับงานได้ราว 6)', ds.hoursPerDay == null ? '6' : String(ds.hoursPerDay));
        if (hrs == null) return;
        api('/staff/' + did, 'PUT', { workDays: ans, hoursPerDay: Number(hrs) || 0 })
          .then(refreshMe)
          .then(function () { toast('บันทึกวันทำงานของ ' + shortName(ds) + ' แล้ว'); renderTeam(); })
          .catch(function (e) { toast(e.message, true); });
        return;
      }
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
      if ((b = ev.target.closest('[data-pw-staff]'))) {
        var st2 = staffById(b.getAttribute('data-pw-staff'));
        var pw = prompt('ตั้งรหัสผ่านใหม่ให้ ' + st2.name + ' (อย่างน้อย 8 ตัว)\nเขากดชื่อตัวเองที่หน้าแรกแล้วใส่รหัสนี้');
        if (pw == null) return;
        api('/staff/' + st2.id, 'PUT', { password: pw })
          .then(refreshMe)
          .then(function () {
            okDialog({
              title: 'ตั้งรหัสผ่านให้ ' + st2.name + ' แล้ว',
              lines: ['รหัสผ่าน: ' + pw, 'กดชื่อ ' + shortName(st2) + ' ที่หน้าแรกแล้วใส่รหัสนี้'],
              note: 'ส่งให้เขาแล้วบอกให้เปลี่ยนเองในหน้า "ทีม + สิทธิ์"',
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
        api('/staff/' + st.id, 'PUT', { name: name, aliases: aliases })
          .then(refreshMe)
          .then(function () {
            okDialog({ title: 'บันทึกข้อมูล ' + name + ' แล้ว',
              lines: ['ชื่อ: ' + name, 'ชื่อเรียกใน @: ' + (aliases || '—')],
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
  /* วาดหน้าเดิมซ้ำ (ลบงาน · กดเสร็จ · ติ๊กโพสต์ · รับลีด) ต้องอยู่ตรงที่เดิม
     เนื้อหาถูกเขียนทับทีหลังเพราะต้องรอ API ตอบก่อน พอของใหม่สั้นกว่าเดิม
     เบราว์เซอร์จะหนีบ scroll ลงมาเอง — จับตาดู #view แล้วดันกลับที่เดิมให้
     ผู้ใช้ขยับจอเองเมื่อไหร่ (ปัด/สกรอลล์/กดปุ่ม) เลิกยุ่งทันที ไม่แย่งจอกับคน */
  function keepScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (!y || typeof MutationObserver !== 'function') return;
    var view = $('#view');
    if (!view) return;
    if (S.keepStop) S.keepStop();
    var moves = ['wheel', 'touchmove', 'keydown'];
    var timer, obs;
    var stop = function () {
      if (S.keepStop !== stop) return;
      S.keepStop = null;
      obs.disconnect();
      clearTimeout(timer);
      moves.forEach(function (e) { window.removeEventListener(e, stop); });
    };
    var back = function () {
      var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, Math.min(y, max));
    };
    obs = new MutationObserver(back);
    obs.observe(view, { childList: true });
    timer = setTimeout(stop, 1200);
    moves.forEach(function (e) { window.addEventListener(e, stop, { passive: true }); });
    S.keepStop = stop;
    back();
  }

  function render() {
    S.route = parseRoute();
    popClose();
    /* คนที่มีเฉพาะหมวดลีด ให้อยู่แต่หน้าลีด (กันซ้ำกับด่านฝั่งเซิร์ฟเวอร์) */
    if (S.me && !canSee('tasks') && canSee('crm') && ['leads', 'lead'].indexOf(S.route.name) === -1) {
      location.hash = '#/leads';
      S.route = parseRoute();
    }
    if (S.lastRoute !== S.route.name) { SEL = {}; PSEL = {}; S.lastRoute = S.route.name; renderBulk(); renderPBulk(); }
    if (!S.me) { renderLogin(); return; }
    renderSidebar();
    renderHeaderUser();
    /* เด้งขึ้นบนเฉพาะตอนเปลี่ยนหน้าจริงๆ ไม่ใช่ทุกครั้งที่วาดใหม่
       (นนท์ 24 ก.ย. 69: "เวลาผมลบ มันชอบเด้งกลับไปข้างบน") */
    var sameView = S.lastHash === location.hash;
    S.lastHash = location.hash;
    if (sameView) keepScroll(); else window.scrollTo(0, 0);
    if (S.route.name !== 'inbox') {
      loadNotif().then(function () { renderSidebar(); renderHeaderUser(); });
    }
    switch (S.route.name) {
      case 'all': return renderAll();
      case 'new': return renderNew();
      case 'report': return renderReport();
      case 'signage': return renderSignage();
      case 'campaign': return S.route.id ? renderCampaign(S.route.id) : renderAll();
      case 'task': return S.route.id ? renderTask(S.route.id) : renderAll();
      case 'kpi': return canSee('kpi') ? renderKpi() : denyView('KPI 2570');
      case 'routine': return amOwner() ? renderRoutine() : denyView('ตารางงานประจำของทีม');
      case 'history': return renderHistory();
      case 'review': return renderReview();
      /* บัญชีที่เห็นเฉพาะ CRM (ต้น/ตาล) — หน้าอื่นเด้งกลับไปลีด */
      case 'leads': return renderLeads();
      case 'lead': return S.route.id ? renderLead(S.route.id) : renderLeads();
      /* บรอดแคสต์ LINE OA + SMS — หน้าอยู่ในไฟล์ blast.js
         ถ้าไฟล์โหลดไม่ขึ้น (deploy ไม่ครบ / เน็ตหลุด) ต้องบอกให้รู้ ไม่ใช่ปล่อยจอขาว */
      case 'blast': case 'richmenu': case 'lineusers': case 'blastsetup':
        if (!global.KAN_BLAST) {
          $('#view').className = 'page';
          $('#view').innerHTML = '<div class="err"><b>หน้าบรอดแคสต์โหลดไม่ขึ้น</b>' +
            '<p>ไฟล์ blast.js ยังไม่ได้ขึ้นเซิร์ฟเวอร์ — กดรีเฟรชอีกครั้ง ถ้ายังไม่ได้แปลว่า deploy ไม่ครบ</p></div>';
          return;
        }
        return global.KAN_BLAST.render(S.route);
      case 'inbox': return renderInbox();
      case 'posts': return renderPosts();
      case 'team': return S.me.role === 'owner' || S.me.sections ? renderTeam() : denyView('ทีม + สิทธิ์');
      /* งานของฉันรวมอยู่ในหน้างานทั้งหมดแล้ว (นนท์ 19 ก.ย. 69) — #/me = งานทั้งหมดที่กรองเป็นของฉัน */
      case 'me': F.who = S.viewAs || S.me.id; F.status = 'open'; return renderAll();
      default: F.who = S.viewAs || S.me.id; F.status = 'open'; return renderAll();
    }
  }
  function refreshMe() {
    return api('/me').then(function (j) { S.me = j.me; S.staff = j.staff || []; S.kpis = j.kpis || []; return j; });
  }
  function boot() {
    wireLightbox();
    /* ส่งเครื่องมือที่ใช้ร่วมกันให้หน้าบรอดแคสต์ (blast.js) — จะได้ไม่ต้องก๊อปฟังก์ชันซ้ำ */
    if (global.KAN_BLAST) global.KAN_BLAST.init({
      API: API, api: api, esc: esc, toast: toast, okDialog: okDialog,
      fmtAgo: fmtAgo, fmtFull: fmtFull, toLocalInput: toLocalInput, fromLocalInput: fromLocalInput,
      canSee: canSee, denyView: denyView, isOwner: function () { return S.me && S.me.role === 'owner'; },
    });
    return fetch(API + '/me', { credentials: 'same-origin' }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) { S.me = null; renderSidebar(); renderLogin(); return; }
        S.me = x.j.me; S.staff = x.j.staff || []; S.kpis = x.j.kpis || [];
        if (!location.hash) location.hash = (!canSee('tasks') && canSee('crm')) ? '#/leads'
          : (S.me.role === 'owner' ? '#/all' : '#/me');
        Promise.all([loadCampaigns(), loadFlows()]).then(render).then(function () {
          var T = global.KAN_TOUR;
          /* เปิดลิงก์ตรงมาที่งานใดงานหนึ่ง (คนกดจากกระดิ่ง) ไม่ต้องพาทัวร์ตอนนั้น */
          if (T && !T.seen() && location.hash.indexOf('#/task/') !== 0) setTimeout(function () { if (S.me && !T.active()) T.start('overview'); }, 900);
        });
      }).catch(function (e) { renderSidebar(); renderLogin(e.message); });
  }

  /* ---------- global events ---------- */
  document.addEventListener('click', function (ev) {
    var b;
    /* ชิปแคมเปญ → หน้าแคมเปญในระบบ (เห็นงาน+โพสต์ที่ผูกไว้) แทนกระโดดออกไปปฏิทิน */
    if ((b = ev.target.closest('.cchip[data-cc]'))) { ev.preventDefault(); location.hash = '#/campaign/' + b.getAttribute('data-cc'); return; }
    /* ---- CRM: ลีด ---- */
    if ((b = ev.target.closest('[data-lopen]'))) {
      if (ev.target.closest('a, button, .rowmenu')) return;
      location.hash = '#/lead/' + b.getAttribute('data-lopen');
      return;
    }
    if ((b = ev.target.closest('[data-lq]'))) {
      var lq = b.getAttribute('data-lq');
      /* การ์ดตัวเลขด้านบนเป็นทางลัดไปยังชุดที่กรองไว้แล้ว — กดใบเดิมซ้ำ = ล้างกรอง */
      var wasOn = (lq === 'me' || lq === 'free') ? LD.who === lq : LD.flag === lq;
      LD.who = (!wasOn && (lq === 'me' || lq === 'free')) ? lq : '';
      LD.flag = (!wasOn && lq !== 'me' && lq !== 'free') ? lq : '';
      LD.st = '';
      /* "รอส่งบัญชี" อยู่ขั้นปิดการขายแล้ว ถ้ายังซ่อนที่จบเคสอยู่จะไม่เห็นอะไรเลย */
      LD.hideDone = LD.flag !== 'hand';
      renderLeads();
      return;
    }
    /* แถบสัดส่วนขั้นในรายงาน — กดเพื่อดูเฉพาะขั้นนั้น กดซ้ำเพื่อเลิกกรอง */
    if ((b = ev.target.closest('[data-lst-filter]'))) {
      var lsf = b.getAttribute('data-lst-filter');
      LD.st = LD.st === lsf ? '' : lsf;
      LD.flag = '';
      if (LEAD_DONE[LD.st]) LD.hideDone = false;
      renderLeads();
      return;
    }
    if ((b = ev.target.closest('[data-lclear]'))) { LD.st = ''; LD.flag = ''; renderLeads(); return; }
    if ((b = ev.target.closest('[data-lclaim]'))) {
      b.disabled = true;
      api('/leads/' + b.getAttribute('data-lclaim') + '/claim', 'POST', {})
        .then(function () { S.leads = null; toast('รับลีดแล้ว'); render(); })
        .catch(function (e) { b.disabled = false; toast(e.message, true); });
      return;
    }
    if ((b = ev.target.closest('[data-lhand]'))) {
      b.disabled = true;
      api('/leads/' + b.getAttribute('data-lhand') + '/hand', 'POST', {})
        .then(function () { S.leads = null; toast('ส่งต่อให้บัญชีแล้ว'); render(); })
        .catch(function (e) { b.disabled = false; toast(e.message, true); });
      return;
    }
    if ((b = ev.target.closest('button[data-lf]'))) { LD[b.getAttribute('data-lf')] = b.getAttribute('data-v'); renderLeads(); return; }
    if ((b = ev.target.closest('[data-ledit]'))) { leadSheet(leadById(b.getAttribute('data-ledit')) || null); return; }
    if ((b = ev.target.closest('[data-ldel]'))) {
      if (!window.confirm('ลบลีดนี้ทิ้ง? ประวัติทั้งหมดของลีดจะหายไปด้วย')) return;
      api('/leads/' + b.getAttribute('data-ldel'), 'DELETE')
        .then(function () { S.leads = null; toast('ลบแล้ว'); location.hash = '#/leads'; })
        .catch(function (e) { toast(e.message, true); });
      return;
    }
    /* เปิดงานเต็มจากการ์ด — จำไว้ว่าเปิดใบไหน กลับมาแล้วจะได้อยู่ที่เดิม */
    if ((b = ev.target.closest('[data-rv-open]'))) { RV.resume = b.getAttribute('data-rv-open'); return; }
    /* ลบงาน/โพสต์ซ้ำจากกองปัดตรวจ — ถามยืนยันก่อนเสมอ ลบแล้วเอาคืนไม่ได้ */
    if ((b = ev.target.closest('[data-rv-del]'))) {
      var rvd = b.getAttribute('data-rv-del');
      var rvc = RV.cards.filter(function (c) { return c.id === rvd; })[0];
      if (!window.confirm('ลบ “' + ((rvc && rvc.t && rvc.t.title) || 'งานนี้') + '” ออกจากระบบ?\n\nงานย่อย รูป และประวัติจะหายไปด้วย ย้อนกลับไม่ได้')) return;
      b.disabled = true;
      api('/tasks/' + rvd, 'DELETE').then(function () {
        S.tasks = null;
        rvDropCard(rvd);
        toast('ลบงานซ้ำแล้ว');
      }).catch(function (e) { b.disabled = false; toast(e.message, true); });
      return;
    }
    if ((b = ev.target.closest('[data-rv-delpost]'))) {
      var rvp = b.getAttribute('data-rv-delpost');
      var rvpc = RV.cards.filter(function (c) { return c.id === rvp; })[0];
      if (!window.confirm('ลบโพสต์ “' + ((rvpc && rvpc.p && rvpc.p.topic) || 'นี้') + '” ออกจากตาราง?\n\nย้อนกลับไม่ได้')) return;
      b.disabled = true;
      api('/posts/' + rvp, 'DELETE').then(function () {
        rvDropCard(rvp);
        toast('ลบโพสต์ซ้ำแล้ว');
      }).catch(function (e) { b.disabled = false; toast(e.message, true); });
      return;
    }
    if ((b = ev.target.closest('[data-rv-act]'))) {
      var rva = b.getAttribute('data-rv-act');
      if (rva === 'undo') rvUndo(); else rvAct(rva);
      return;
    }
    if (ev.target.closest('[data-rv-again]')) { RV.i = 0; RV.nSkip = 0; RV.last = null; drawReview(); return; }
    if ((b = ev.target.closest('[data-tour-go]'))) { $('#tourMenu').hidden = true; global.KAN_TOUR.start(b.getAttribute('data-tour-go')); return; }
    if ((b = ev.target.closest('[data-sg-stage]'))) { SG.stage = SG.stage === b.getAttribute('data-sg-stage') ? '' : b.getAttribute('data-sg-stage'); renderSignage(); return; }
    if ((b = ev.target.closest('[data-sg-view]'))) { SG.view = b.getAttribute('data-sg-view'); renderSignage(); return; }
    if ((b = ev.target.closest('[data-sg-branch]'))) { SG.branch = b.getAttribute('data-sg-branch'); renderSignage(); return; }
    /* กำลังพิมพ์ชื่องานในแถว — แถวเป็นลิงก์ ห้ามพาไปหน้างาน */
    if (ev.target.closest('.tedit')) { ev.preventDefault(); return; }
    if ((b = ev.target.closest('[data-sel]'))) {
      ev.preventDefault(); ev.stopPropagation();
      toggleSel(b.getAttribute('data-sel'), ev.shiftKey);
      return;
    }
    if ((b = ev.target.closest('[data-gsel]'))) {
      ev.preventDefault(); ev.stopPropagation();
      var grp = b.closest('.group');
      var ids0 = $$('[data-sel]', grp).map(function (el) { return el.getAttribute('data-sel'); });
      var allOn = ids0.length && ids0.every(function (id) { return SEL[id]; });
      ids0.forEach(function (id) { if (allOn) delete SEL[id]; else SEL[id] = 1; });
      paintSel();
      return;
    }
    if ((b = ev.target.closest('[data-tedit]'))) { ev.preventDefault(); ev.stopPropagation(); titleEdit(b.getAttribute('data-tedit')); return; }
    if ((b = ev.target.closest('[data-aedit]'))) { ev.preventDefault(); ev.stopPropagation(); assignPop(b, [b.getAttribute('data-aedit')]); return; }
    if ((b = ev.target.closest('[data-dedit]'))) { ev.preventDefault(); ev.stopPropagation(); duePop(b, [b.getAttribute('data-dedit')]); return; }
    if ((b = ev.target.closest('[data-bulk]'))) { bulkClick(b.getAttribute('data-bulk'), b); return; }
    if ((b = ev.target.closest('[data-rtedit]'))) { ev.preventDefault(); ev.stopPropagation(); rtRename(b.getAttribute('data-rtedit')); return; }
    if ((b = ev.target.closest('[data-rtdel]'))) { ev.preventDefault(); ev.stopPropagation(); rtAskDelete(b.getAttribute('data-rtdel')); return; }
    if ((b = ev.target.closest('[data-rtdel-no]'))) { ev.preventDefault(); ev.stopPropagation(); var bx = b.closest('.rtconfirm'); if (bx) bx.remove(); return; }
    if ((b = ev.target.closest('[data-rtdel-yes]'))) {
      ev.preventDefault(); ev.stopPropagation();
      var did = b.getAttribute('data-rtdel-yes');
      b.disabled = true;
      if (S.tasks) S.tasks = S.tasks.filter(function (x) { return x.id !== did; });
      renderRoutine(true);
      api('/tasks/' + did, 'DELETE').then(function () { toast('ลบงานประจำแล้ว · ย้อนได้ที่ประวัติการแก้ไข'); })
        .catch(function (e) { toast(e.message, true); loadTasks(true).then(function () { renderRoutine(true); }); });
      return;
    }
    if ((b = ev.target.closest('[data-rt-who]'))) {
      var rid = b.getAttribute('data-rt-who');
      if (!rid) RT.who = [];
      else { var i0 = RT.who.indexOf(rid); if (i0 === -1) { if (RT.who.length < 4) RT.who.push(rid); else toast('เทียบได้ทีละไม่เกิน 4 คน', true); } else RT.who.splice(i0, 1); }
      renderRoutine(); return;
    }
    if ((b = ev.target.closest('[data-rt-band]'))) { RT.band = b.getAttribute('data-rt-band'); renderRoutine(); return; }
    if ((b = ev.target.closest('[data-h-f]'))) {
      var hk = b.getAttribute('data-h-f'), hv = b.getAttribute('data-v');
      H[hk] = hk === 'days' ? Number(hv) : hv;
      histLoad(false).then(paintHistory).catch(function (e) { toast(e.message, true); });
      return;
    }
    if (ev.target.closest('[data-h-more]')) { histLoad(true).then(paintHistory).catch(function (e) { toast(e.message, true); }); return; }
    if ((b = ev.target.closest('[data-hundo]'))) { histUndo(b.getAttribute('data-hundo'), b); return; }
    if ((b = ev.target.closest('[data-btype]'))) { B.type = b.getAttribute('data-btype'); try { localStorage.setItem('kan-board-type', B.type); } catch (e) {} renderAll(); return; }
    if (ev.target.closest('[data-flow-edit]')) { flowEditor(B.type); return; }
    if ((b = ev.target.closest('[data-mkstages]'))) {
      ev.preventDefault(); ev.stopPropagation();
      b.disabled = true;
      api('/tasks/' + b.getAttribute('data-mkstages') + '/stages', 'POST', {}).then(function (j) { S.tasks = null; toast('สร้าง ' + (j.created || 0) + ' ขั้นแล้ว'); render(); })
        .catch(function (e) { b.disabled = false; toast(e.message, true); });
      return;
    }
    if ((b = ev.target.closest('[data-kadd]'))) { ev.preventDefault(); ev.stopPropagation(); if (!ev.target.closest('input')) kaddOpen(b); return; }
    /* กดที่ตัวการ์ด/งานย่อย = เปิดงาน (ยกเว้นปุ่มในการ์ด) */
    if (document.body.classList.contains('tdragging')) { ev.preventDefault(); return; }
    if ((b = ev.target.closest('[data-kopen]')) && !ev.target.closest('[data-sel],[data-rowmenu],[data-mkstages],a,button,input')) {
      location.hash = '#/task/' + b.getAttribute('data-kopen'); return;
    }
    if ((b = ev.target.closest('[data-rowmenu]'))) {
      ev.preventDefault(); ev.stopPropagation();
      rowMenu(b, b.getAttribute('data-rowmenu'));
      return;
    }
    if ((b = ev.target.closest('[data-tick]'))) {
      ev.preventDefault(); ev.stopPropagation();
      tickTask(b);
      return;
    }
    if (ev.target.closest('[data-tour]')) { toggleTourMenu(); return; }
    if (!ev.target.closest('#tourMenu')) { var tmenu = $('#tourMenu'); if (tmenu && !tmenu.hidden) tmenu.hidden = true; }
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
      fetch(API + '/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { S.me = null; S.tasks = null; loginPick = null; renderSidebar(); renderLogin(); });
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
    if ((b = ev.target.closest('[data-psel]'))) { ev.preventDefault(); ev.stopPropagation(); pselToggle(b.getAttribute('data-psel'), ev.shiftKey); return; }
    if ((b = ev.target.closest('[data-pgsel]'))) {
      ev.preventDefault(); ev.stopPropagation();
      var grp0 = b.closest('.group');
      var ids0 = $$('[data-psel]', grp0).map(function (el) { return el.getAttribute('data-psel'); });
      var allOn0 = ids0.length && ids0.every(function (id) { return PSEL[id]; });
      ids0.forEach(function (id) { if (allOn0) delete PSEL[id]; else PSEL[id] = 1; });
      paintPsel(); return;
    }
    if ((b = ev.target.closest('[data-pb]'))) { pbulkClick(b.getAttribute('data-pb')); return; }
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
    if (ev.target.closest('[data-f-clear]')) { F.who = ''; F.kpi = ''; F.status = 'open'; F.campaign = ''; F.ttype = ''; F.kind = ''; renderAll(); return; }
    if ((b = ev.target.closest('.tbar [data-f], .fpanel [data-f], .factive [data-f], .hidden-note [data-f]'))) {
      F[b.getAttribute('data-f')] = b.getAttribute('data-v'); renderAll(); return;
    }
    if (ev.target.id === 'pasteToggle' || ev.target.id === 'pasteClose') {
      var box = $('#pasteBox');
      if (!box) return;
      box.hidden = ev.target.id === 'pasteClose' ? true : !box.hidden;
      if (!box.hidden) $('#cmdText').focus();
      return;
    }
    if (ev.target.id === 'parseBtn') {
      var parsed = parseCommand($('#cmdText').value);
      if (!parsed.length) { toast('ยังไม่มีข้อความ หรืออ่านไม่ออก — ลองใส่ @ชื่อ', true); return; }
      pushDrafts(parsed.map(draftFromParsed));
      $('#cmdText').value = '';
      $('#pasteBox').hidden = true;
      var miss = parsed.map(draftFromParsed).filter(function (r) { return draftMissing(r).length; }).length;
      toast('เทลงตาราง ' + parsed.length + ' งาน' + (miss ? ' — ' + miss + ' แถวยังกรอกไม่ครบ' : ' — ตรวจแล้วกดบันทึกได้เลย'));
      return;
    }
    if (ev.target.id === 'clearBtn') {
      if (!confirm('ล้างทุกแถวในตาราง? งานที่ยังไม่บันทึกจะหายหมด')) return;
      drafts = [];
      renderNew();
      return;
    }
    if (ev.target.id === 'saveBtn') { saveDrafts(); return; }
    if ((b = ev.target.closest('.att.img')) && !ev.target.closest('button')) {
      lbOpen(b.getAttribute('data-src'));
      return;
    }
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
  document.addEventListener('change', function (ev) {
    var f = ev.target.closest && ev.target.closest('[data-lf]');
    if (!f) return;
    var k = f.getAttribute('data-lf');
    LD[k] = f.type === 'checkbox' ? f.checked : f.value;
    renderLeads();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      document.documentElement.classList.remove('erp-open');
      lbClose();
      var m = $('.modal'); if (m) { if (m._close) m._close(); else m.remove(); }
    }
    if (ev.key === 'Enter' && ev.target.matches && ev.target.matches('[data-post-url]')) {
      ev.preventDefault(); savePostUrl(ev.target);
    }
    rvKey(ev);
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
