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

  var GROUPS = [
    { icon: '📊', label: 'ยอดขาย + สต็อก', items: [
      { icon: '▦',  label: 'ภาพรวมยอดขาย',    sales: '#/overview' },
      { icon: '🏬', label: 'สาขาและแผนก',      sales: '#/branch' },
      { icon: '🚶', label: 'ทราฟฟิกหน้าร้าน',   cmo: 'traffic.html' },
      { icon: '📦', label: 'สินค้าเข้า–ออก',    sales: '#/velocity' },
      { icon: '🏷', label: 'สินค้ารายตัว',      sales: '#/sku' },
      { icon: '🎯', label: 'ข้อเสนอโปรโมชัน',   sales: '#/promo' },
      { icon: '🗓', label: 'แผนลงมือ',          sales: '#/plan' },
      { icon: '👥', label: 'กลุ่มลูกค้า',        sales: '#/customers' },
      { icon: '✓',  label: 'คุณภาพข้อมูล',      sales: '#/quality', badge: 'quality' }
    ]},
    { icon: '🎯', label: 'ทีม + KPI', items: [
      { icon: '🏆', label: 'KPI Dashboard 2026', cmo: 'kpi.html' },
      { icon: '🧩', label: 'ผังทีม',             cmo: 'team-structure.html' },
      { icon: '📋', label: 'JD รายตำแหน่ง',       cmo: 'team-jd.html' },
      { icon: '📊', label: 'KPI รายตำแหน่ง (เดิม)', cmo: 'team-kpi.html' }
    ]},
    { icon: '🗓', label: 'แผนปี + Dashboard', items: [
      { icon: '🧭', label: 'Phase ทั้งปี',        cmo: '01b-phase.html' },
      { icon: '📈', label: 'Dashboard ผลจริง',    cmo: '01a-dashboard.html' },
      { icon: '🗒', label: 'แผนรายเดือน',         cmo: '01c-monthly.html' },
      { icon: '📆', label: 'จังหวะรายสัปดาห์',    cmo: '01d-weekly.html' },
      { icon: '🔗', label: 'ลิงก์ Report & Dashboard', cmo: 'report-links.html' }
    ]},
    { icon: '🤝', label: 'B2B (ขายส่ง + Online)', items: [
      { icon: '🗂', label: 'Overview',           cmo: '04a-overview.html' },
      { icon: '🌐', label: 'Market',             cmo: '04b-market.html' },
      { icon: '🎯', label: 'STP',                cmo: '04c-stp.html' },
      { icon: '🏷', label: 'Product & Pricing',  cmo: '04d-product.html' },
      { icon: '💥', label: 'Promotion',          cmo: '04e-promo.html' },
      { icon: '🛡', label: 'Moat',               cmo: '04f-moat.html' },
      { icon: '🖥', label: 'B2B Web',            cmo: '04g-b2b-web.html' },
      { icon: '📱', label: 'Social Post',        cmo: '04h-social.html' },
      { icon: '🔴', label: 'Live Commerce',      cmo: '04i-live.html' },
      { icon: '📣', label: 'งบโฆษณา',            cmo: '04j-media.html' },
      { icon: '🗓', label: 'Calendar & Budget',  cmo: '04k-calendar.html' },
      { icon: '⚠', label: 'Actions & Risk',      cmo: '04l-actions-risk.html' },
      { icon: '🌍', label: 'ตัวอย่างเว็บ (Kan Hub)', cmo: 'b2b-web-demo.html' }
    ]},
    { icon: '📣', label: 'MarCom', items: [
      { icon: '📌', label: 'ภาพรวม + KPI',        cmo: '05-promo.html' },
      { icon: '📝', label: 'แผนสื่อสารฉบับเต็ม',  cmo: '05-comm-plan.html' }
    ]},
    { icon: '☎', label: 'รายงานการรับสาย', items: [
      { icon: '📞', label: 'รายงานการรับสาย',     cmo: 'tele-dashboard.html' }
    ]}
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* opts: { ctx:'sales'|'cmo', active, salesBase, cmoBase, badges } */
  function href(item, opts) {
    if (item.sales != null) {
      return opts.ctx === 'sales' ? item.sales : (opts.salesBase + item.sales);
    }
    return opts.ctx === 'cmo' ? item.cmo : (opts.cmoBase + item.cmo);
  }
  function keyOf(item) {
    return item.sales != null ? ('sales:' + item.sales) : ('cmo:' + item.cmo);
  }

  var ERP_MENU = global.ERP_MENU = {
    GROUPS: GROUPS,
    brandTitle: 'KAN MKT',
    brandSub: 'ยอดขาย · การตลาด · ทีม',

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
      var openIdx = -1;
      GROUPS.forEach(function (g, gi) {
        g.items.forEach(function (it) { if (keyOf(it) === opts.active) { openIdx = gi; } });
      });
      if (openIdx < 0) { openIdx = 0; }

      var h = '<a class="erp-brand" href="' + homeHref + '">' +
        '<span class="erp-k">K</span><span class="erp-brand-tx"><b>' + esc(this.brandTitle) + '</b>' +
        '<small>' + esc(this.brandSub) + '</small></span></a><div class="erp-nav">';

      GROUPS.forEach(function (g, gi) {
        var isOpen = gi === openIdx;
        h += '<div class="erp-acc' + (isOpen ? ' open' : '') + '">' +
          '<button type="button" class="erp-gh">' +
            '<span class="erp-gico">' + g.icon + '</span>' +
            '<span class="erp-glabel">' + esc(g.label) + '</span>' +
            '<span class="erp-chev">▾</span></button>' +
          '<div class="erp-sub">';
        g.items.forEach(function (it) {
          var on = keyOf(it) === opts.active ? ' on' : '';
          var badge = (it.badge && badges[it.badge])
            ? '<span class="erp-badge">' + badges[it.badge] + '</span>' : '';
          h += '<a class="erp-link' + on + '" href="' + href(it, opts) + '">' +
               '<span class="erp-ico">' + it.icon + '</span>' + esc(it.label) + badge + '</a>';
        });
        h += '</div></div>';
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
    }
  };

}(typeof window !== 'undefined' ? window : this));
