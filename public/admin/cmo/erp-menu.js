/* ============================================================
   KAN MKT — เมนูรวมของทั้งระบบ (แหล่งเดียว ใช้ทั้งฝั่งยอดขาย+สต็อก และ CMO)
   sidebar แบบ accordion: หัวข้อใหญ่กดเปิด/ปิด แล้วโชว์หมวดย่อย
   ทำให้ sidebar เหมือนกันเป๊ะทุกหน้า → รู้สึกเป็นระบบเดียว
   แก้เมนู/ลำดับ/ไอคอน ที่ไฟล์นี้ที่เดียว มีผลทั้งสองฝั่ง
   ------------------------------------------------------------
   item.sales = '#/xxx'   → หน้าในแอปยอดขาย+สต็อก (hash route)
   item.cmo   = 'xxx.html' → หน้าในโฟลเดอร์ CMO
   ============================================================ */
(function (global) {
  'use strict';

  /* ── โครง 3 ชั้น: หมวดสถานะ → กลุ่ม → หน้า ──────────────────────────────
     หมวดสถานะบอกว่า "ของชิ้นนี้เอาไปใช้ตัดสินใจได้จริงหรือยัง" จะได้ไม่ต้อง
     เปิดเข้าไปเจอกล่องเตือนเองทีละหน้า
       ready   = ข้อมูลเดินถึงปัจจุบัน เปิดให้ใครดูก็ได้
       pending = ข้อมูลค้าง/ไม่ครบ ยังเชื่อไม่ได้ — เข้าไปดูได้ แต่รู้ตัวก่อน
       ref     = เอกสารแผนงานกับหน้าดูแลระบบ ไม่ใช่ตัวเลขที่เดินตามวัน
     ย้ายกลุ่มข้ามหมวดได้ด้วยการย้ายบล็อกไปมา ไม่ต้องแก้ที่อื่น */
  var SECTIONS = [
    /* ── ทำงาน: ของที่เปิดใช้ทุกวัน อยู่บนสุดเสมอ ───────────────────────────── */
    { id: 'work', label: 'ทำงาน', groups: [

      /* ปฏิทินการตลาด (คอนเทนต์/แคมเปญ/โปรโมชั่น) เป็นแกนที่โพสต์และงานผูกอยู่ จึงอยู่กลุ่มเดียวกับงานทีม */
      { icon: 'clipboard', label: 'งานทีม', items: [
        { icon: 'user',      label: 'งานของฉัน',      tasks: '#/me' },
        { icon: 'bell',      label: 'แจ้งเตือน',       tasks: '#/inbox', badge: 'mentions' },
        { icon: 'clipboard', label: 'งานทั้งหมด',     tasks: '#/all' },
        { icon: 'zap',       label: 'สั่งงาน',         tasks: '#/new' },
        { icon: 'calendar',  label: 'ปฏิทินการตลาด',  cmo: 'campaign-calendar.html' }
      ]},
      { icon: 'megaphone', label: 'ตารางโพสต์', items: [
        { icon: 'calendar',  label: 'โพสต์วันนี้',  tasks: '#/posts' },
        { icon: 'monitor',   label: 'ทั้งเดือน',    tasks: '#/posts?range=month' }
      ]}

    ]},

    /* ── ตัวเลข: ของที่เปิดดูเวลาจะตัดสินใจหรือเอาไปโชว์ ───────────────────── */
    { id: 'ready', label: 'ตัวเลข', groups: [

      { icon: 'trophy', label: 'KPI', sec: 'kpi', items: [
        { icon: 'trophy',   label: 'KPI 2570 (เป้า + งานที่ผูก)', tasks: '#/kpi' },
        { icon: 'chart',    label: 'KPI Dashboard 2026',        cmo: 'kpi.html' },
        { icon: 'filetext', label: 'กรอกผล KPI รายเดือน',        cmo: 'kpi.html?mode=edit' }
      ]},
      { icon: 'chart', label: 'ยอดขาย', sec: 'sales', items: [
        { icon: 'dashboard', label: 'แดชบอร์ดยอดขาย (หลัก)', sales: 'sales/' },
        { icon: 'chart',     label: 'ภาพรวมยอดขาย', sales: '#/overview' },
        { icon: 'zap',       label: 'สินค้าขายดี',    sales: '#/bestsellers' },
        { icon: 'users',     label: 'กลุ่มลูกค้า',     sales: '#/customers' }
      ]},
      { icon: 'megaphone', label: 'การตลาด', items: [
        { icon: 'target',    label: 'ข้อเสนอโปรโมชัน', sales: '#/promo', sec: 'sales' },
        { icon: 'zap',       label: 'โปรรายสาขา (จากฝ่ายขาย)', sales: '#/promo-sales', sec: 'sales' },
        { icon: 'megaphone', label: 'รายงานโฆษณา (Meta)', sales: '#/ads', sec: 'sales' },
        { icon: 'phone',     label: 'รายงานการรับสาย', cmo: 'tele-dashboard.html' },
        { icon: 'monitor',   label: 'สไลด์แผนการตลาด', cmo: 'campaign-deck.html' },
        { icon: 'clipboard', label: 'แผนลงมือ',       sales: '#/plan', sec: 'sales' }
      ]}

    ]},

    /* ── เอกสาร + ระบบ: เปิดนาน ๆ ที · ของที่ข้อมูลยังเชื่อไม่ได้อยู่ในนี้ ──── */
    { id: 'ref', label: 'เอกสาร + ระบบ', groups: [

      { icon: 'folder', label: 'เอกสารแผนงาน', items: [
        { icon: 'compass',   label: 'Phase ทั้งปี',        cmo: '01b-phase.html' },
        { icon: 'linechart', label: 'Dashboard ผลจริง',    cmo: '01a-dashboard.html' },
        { icon: 'calendar',  label: 'แผนรายเดือน',         cmo: '01c-monthly.html' },
        { icon: 'calendar',  label: 'จังหวะรายสัปดาห์',    cmo: '01d-weekly.html' },
        { icon: 'monitor',   label: 'แผนการตลาด (พรีเซนเก่า)', cmo: 'index.html' },
        { icon: 'link',      label: 'ลิงก์ Report & Dashboard', cmo: 'report-links.html' },
        { icon: 'network',   label: 'ผังทีม + JD',          cmo: 'team-structure.html' },
        { icon: 'bookmark',  label: 'MarCom · ภาพรวม + KPI', cmo: '05-promo.html' },
        { icon: 'filetext',  label: 'MarCom · แผนสื่อสารฉบับเต็ม', cmo: '05-comm-plan.html' }
      ]},
      { icon: 'briefcase', label: 'B2B (ขายส่ง + Online)', items: [
        { icon: 'folder',     label: 'Overview',           cmo: '04a-overview.html' },
        { icon: 'globe',      label: 'Market',             cmo: '04b-market.html' },
        { icon: 'target',     label: 'STP',                cmo: '04c-stp.html' },
        { icon: 'tag',        label: 'Product & Pricing',  cmo: '04d-product.html' },
        { icon: 'zap',        label: 'Promotion',          cmo: '04e-promo.html' },
        { icon: 'shield',     label: 'Moat',               cmo: '04f-moat.html' },
        { icon: 'monitor',    label: 'B2B Web',            cmo: '04g-b2b-web.html' },
        { icon: 'smartphone', label: 'Social Post',        cmo: '04h-social.html' },
        { icon: 'radio',      label: 'Live Commerce',      cmo: '04i-live.html' },
        { icon: 'megaphone',  label: 'งบโฆษณา',            cmo: '04j-media.html' },
        { icon: 'calendar',   label: 'Calendar & Budget',  cmo: '04k-calendar.html' },
        { icon: 'alert',      label: 'Actions & Risk',     cmo: '04l-actions-risk.html' }
      ]},
      /* ข้อมูลชุดนี้หยุดอัปเดต/ลงผิด — ยังเปิดดูได้ แต่ต้องรู้ตัวก่อน */
      { icon: 'package', label: 'ข้อมูลที่ยังเชื่อไม่ได้', note: 'สต็อกหยุดอัปเดต · ชีตโซนลงผิดสาขา', pend: true, items: [
        { icon: 'package',   label: 'สินค้าเข้า–ออก',   sales: '#/velocity', sec: 'sales' },
        { icon: 'tag',       label: 'สินค้ารายตัว',     sales: '#/sku', sec: 'sales' },
        { icon: 'store',     label: 'สาขาและแผนก',      sales: '#/branch', sec: 'sales' },
        { icon: 'linechart', label: 'ทราฟฟิกหน้าร้าน',  cmo: 'traffic.html' }
      ]},
      { icon: 'shield', label: 'ระบบ', items: [
        { icon: 'users',       label: 'ทีม + สิทธิ์',    tasks: '#/team', sec: 'admin' },
        { icon: 'shieldcheck', label: 'คุณภาพข้อมูล',    sales: '#/quality', badge: 'quality', sec: 'sales' },
        { icon: 'folder',      label: 'แหล่งข้อมูล + log', sales: '#/data', sec: 'sales' },
        { icon: 'shieldcheck', label: 'กฎ & เกณฑ์',      sales: '#/rules', sec: 'sales' }
      ]}

    ]}
  ];

  /* กลุ่มทั้งหมดเรียงต่อกัน — ของเดิมที่อื่นยังเรียก GROUPS อยู่ */
  var GROUPS = [];
  SECTIONS.forEach(function (sec) {
    sec.groups.forEach(function (g) { g.section = sec.id; GROUPS.push(g); });
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* opts: { ctx:'sales'|'cmo', active, salesBase, cmoBase, badges } */

  /* ไอคอน Lucide (แทน emoji) — แก้/เพิ่มที่นี่ */
  var ICONS = {
    chart:'<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="1"/><rect x="12" y="7" width="3" height="10" rx="1"/><rect x="17" y="14" width="3" height="3" rx="1"/>',
    dashboard:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    store:'<path d="M4 4h16l1 5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/>',
    activity:'<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
    package:'<path d="M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
    tag:'<path d="M20 13.3 13.3 20a1.6 1.6 0 0 1-2.3 0l-7-7V4h9l7 7a1.6 1.6 0 0 1 0 2.3z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5M21.5 20a6 6 0 0 0-4-5.6"/>',
    shieldcheck:'<path d="M12 3 5 6v5c0 5 3.5 8 7 10 3.5-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    trophy:'<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 0-3 3M9 21h6M12 17v4"/>',
    network:'<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4M6 17v-2h12v2"/>',
    clipboard:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h4"/>',
    linechart:'<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/>',
    link:'<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    folder:'<path d="M4 5h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    zap:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    shield:'<path d="M12 3 5 6v5c0 5 3.5 8 7 10 3.5-2 7-5 7-10V6z"/>',
    monitor:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    smartphone:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    radio:'<circle cx="12" cy="12" r="2"/><path d="M8 8a5.5 5.5 0 0 0 0 8M16 8a5.5 5.5 0 0 1 0 8M5 5a9 9 0 0 0 0 14M19 5a9 9 0 0 1 0 14"/>',
    megaphone:'<path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1z"/><path d="M18 8a4 4 0 0 1 0 8"/>',
    bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
    filetext:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    phone:'<path d="M4 4h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 2 6a2 2 0 0 1 2-2z"/>',
    alert:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    compass:'<circle cx="12" cy="12" r="9"/><polygon points="16 8 14 14 8 16 10 10"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    bell:'<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
    panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m15 10-2 2 2 2"/>'
  };
  function svgIco(n){ var p = ICONS[n]; return p ? '<svg class="erp-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>' : esc(n); }

  function href(item, opts) {
    /* item.tasks = '#/xxx' → หน้าในระบบงานทีม (โฟลเดอร์ tasks/) */
    if (item.tasks != null) {
      return opts.ctx === 'tasks' ? item.tasks
        : ((opts.tasksBase != null ? opts.tasksBase : '../tasks/') + item.tasks);
    }
    if (item.sales != null) {
      /* ค่าไม่ขึ้นต้น # = หน้าแยกใต้โฟลเดอร์ mkt (เช่น sales/) ไม่ใช่ hash route */
      if (item.sales.charAt(0) !== '#') {
        return opts.ctx === 'sales'
          ? item.sales
          : opts.salesBase.replace(/index\.html$/, '') + item.sales;
      }
      return opts.ctx === 'sales' ? item.sales : (opts.salesBase + item.sales);
    }
    return opts.ctx === 'cmo' ? item.cmo : (opts.cmoBase + item.cmo);
  }
  /* สิทธิ์: item.sec / group.sec = ต้องมีหมวดนั้นถึงเห็น · 'admin' = เฉพาะหัวหน้า
     opts.sections ไม่ส่งมา = โชว์ทุกอย่าง (หน้าที่ยังไม่ได้ต่อระบบล็อกอิน) */
  function visible(sec, opts) {
    if (!sec) { return true; }
    if (!opts || !opts.sections) { return true; }
    if (sec === 'admin') { return opts.owner === true; }
    return opts.sections.indexOf(sec) !== -1;
  }
  function keyOf(item) {
    if (item.tasks != null) { return 'tasks:' + item.tasks; }
    return item.sales != null ? ('sales:' + item.sales) : ('cmo:' + item.cmo);
  }

  var ERP_MENU = global.ERP_MENU = {
    GROUPS: GROUPS,
    SECTIONS: SECTIONS,
    brandTitle: 'KAN Admin',
    brandSub: 'ยอดขาย · การตลาด · งานทีม',

    /* บรรทัดเล็ก ๆ ท้าย sidebar ทุกหน้า */
    powered: '<div class="erp-powered">Powered by <b>M Creation</b></div>',

    /* รายชื่อไฟล์ CMO เรียงตามเมนู (ใช้ทำ pager ก่อนหน้า/ถัดไป) */
    cmoFiles: (function () {
      var out = [];
      GROUPS.forEach(function (g) {
        g.items.forEach(function (it) { if (it.cmo != null) { out.push({ file: it.cmo, label: it.label }); } });
      });
      return out;
    }()),

    keyOf: keyOf,

    /* คืน HTML ด้านในของ sidebar: แบรนด์ + accordion ทุกกลุ่ม (คลาส .erp-*) */
    render: function (opts) {
      opts = opts || {};
      var badges = opts.badges || {};
      var homeHref = opts.ctx === 'sales' ? '#/overview' : (opts.salesBase + '#/overview');

      /* หากลุ่มที่มีหน้าปัจจุบัน → เปิดค้างไว้ */
      var shownGroups = [];
      SECTIONS.forEach(function (sec) {
        sec.groups.forEach(function (g) {
          if (!visible(g.sec, opts)) { return; }
          if (g.items.some(function (it) { return visible(it.sec || g.sec, opts); })) { shownGroups.push(g); }
        });
      });
      var openIdx = -1;
      shownGroups.forEach(function (g, gi) {
        g.items.forEach(function (it) { if (keyOf(it) === opts.active) { openIdx = gi; } });
      });
      if (openIdx < 0) { openIdx = 0; }

      var h = '<div class="erp-top"><a class="erp-brand" href="' + homeHref + '">' +
        '<img class="erp-k" src="../assets/kan-logo.png" alt="KAN" /><span class="erp-brand-tx"><b>' + esc(this.brandTitle) + '</b>' +
        '<small>' + esc(this.brandSub) + '</small></span></a>' +
        '<button type="button" class="erp-pin" data-erp-collapse title="ย่อ/ขยายเมนู" aria-label="ย่อ/ขยายเมนู">' +
        svgIco('panel') + '</button></div><div class="erp-nav">';

      var gi = -1;
      SECTIONS.forEach(function (sec) {
        /* กลุ่มที่ไม่มีสิทธิ์ตัดทิ้งทั้งกลุ่ม ถ้าหมดทั้งหมวดก็ไม่ต้องขึ้นหัวหมวด */
        var groups = sec.groups.filter(function (g) {
          if (!visible(g.sec, opts)) { return false; }
          return g.items.some(function (it) { return visible(it.sec || g.sec, opts); });
        });
        if (!groups.length) { return; }
        h += '<div class="erp-sec ' + sec.id + '">' + esc(sec.label) + '</div>';
        groups.forEach(function (g) {
          gi++;
          var isOpen = gi === openIdx;
          h += '<div class="erp-acc' + (isOpen ? ' open' : '') +
            (g.pend ? ' pend' : '') + '">' +
            '<button type="button" class="erp-gh">' +
              '<span class="erp-gico">' + svgIco(g.icon) + '</span>' +
              '<span class="erp-glabel">' + esc(g.label) +
                (g.note ? '<small>' + esc(g.note) + '</small>' : '') + '</span>' +
              '<span class="erp-chev">▾</span></button>' +
            '<div class="erp-sub">';
          g.items.filter(function (it) { return visible(it.sec || g.sec, opts); }).forEach(function (it) {
            var on = keyOf(it) === opts.active ? ' on' : '';
            var badge = (it.badge && badges[it.badge])
              ? '<span class="erp-badge">' + badges[it.badge] + '</span>' : '';
            h += '<a class="erp-link' + on + '" href="' + href(it, opts) + '">' +
                 '<span class="erp-ico">' + svgIco(it.icon) + '</span>' + esc(it.label) + badge + '</a>';
          });
          h += '</div></div>';
        });
      });
      h += '</div>';
      return h;
    },

    /* ผูก event เปิด/ปิด accordion หลังใส่ HTML ลง DOM แล้ว */
    wire: function (root) {
      (root || document).querySelectorAll('.erp-gh').forEach(function (btn) {
        btn.addEventListener('click', function () {
          this.parentNode.classList.toggle('open');
        });
      });
      /* ปุ่มย่อเมนูเป็นแถบ 64px — จำค่าไว้ ใช้ร่วมกันทุกหน้า */
      (root || document).querySelectorAll('[data-erp-collapse]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var on = document.documentElement.classList.toggle('erp-collapsed');
          try { localStorage.setItem('kan-erp-collapsed', on ? '1' : '0'); } catch (e) {}
        });
      });
    }
  };

}(typeof window !== 'undefined' ? window : this));
