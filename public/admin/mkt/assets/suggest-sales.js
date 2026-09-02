/* KAN ERP — หน้า "โปรรายสาขา (จากฝ่ายขาย)"  (#/promo-sales) · v3
 *
 * วิเคราะห์จากใบเสร็จรายสินค้าระดับบรรทัดบิล พ.ค.–ส.ค. 69 (น้ำหนักที่ ส.ค.)
 * ผ่าน etl/analyze-receipts.py → data/promo-analysis.js
 * แต่ละสาขา = คนละโมเดล วิเคราะห์แยก ไม่เอาวิธีคิดมาปนกัน:
 *   สุราษฎร์ = superstore ตะกร้าครอบครัว · Fashion = ร้านเสื้อผ้า ซื้อเป็นชุด ·
 *   ชุมพร = ร้านเหมา/กิโล รอบเทต้นเดือน · นคร = ยังไม่มีไฟล์ใบเสร็จ (ระดับโซนเท่านั้น)
 * หน้านี้เล่า: สรุป ส.ค. → โปรที่เสนอ → Top 5 → ซื้อร่วมกัน → วันดี/แย่ → หมวดลึก
 * ต้องโหลดหลัง views.js (register view ลง KAN.views)
 */
(function (global) {
  'use strict';

  var KAN = global.KAN, fmt = KAN.fmt, esc = KAN.esc, UI = KAN.UI;
  var PA = global.KAN_PROMO_ANALYSIS;
  var SI = global.KAN_SALES_INSIGHT;
  var PAGE_URL = 'sales/';
  var EMBED_URL = 'sales/dashboard.html';

  var SCOPES = [
    { key: 'surat',    label: 'สุราษฎร์#3', model: 'Superstore — ตะกร้าครอบครัว (ไม่รวมโซน Fashion)' },
    { key: 'fashion',  label: 'KAN Fashion', model: 'ร้านเสื้อผ้า — ซื้อเป็นชุดบน-ล่าง (โซน FA ที่สุราษฎร์)' },
    { key: 'chumphon', label: 'ชุมพร#1',    model: 'ร้านเหมา/กิโล — ยอดกระจุกรอบเทเสาร์ต้นเดือน' },
    { key: 'nakhon',   label: 'นคร#2',      model: 'ยังไม่มีไฟล์ใบเสร็จ — วิเคราะห์ได้แค่ระดับโซน' },
  ];
  var DOW_S = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

  /* ── popup "ที่มา ▸" (แดชบอร์ดฝ่ายขาย) — กลไกเดิม ─────────────────────── */
  var SRC = {
    heat: { tab: 'store', el: 'hm',        label: 'ช่วงเวลาขายดี — วัน × ชั่วโมง' },
    dow:  { tab: 'store', el: 'ch-dow',    label: 'ยอดขายเฉลี่ยตามวันในสัปดาห์' },
    zt:   { tab: 'store', el: 'ch-ztrend', label: 'แนวโน้มยอดขายรายโซน' },
  };
  var pop = null, frame = null, hideTimer = null, curKey = null;

  function injectCSS() {
    if (document.getElementById('sp-css')) { return; }
    var s = document.createElement('style');
    s.id = 'sp-css';
    s.textContent =
      '.spchip{font:inherit;font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px;cursor:pointer;' +
        'border:1px solid var(--line);background:#fff;color:var(--sub);display:inline-flex;gap:5px;align-items:center}' +
      '.spchip:hover{background:var(--indigo-soft);color:var(--indigo-deep);border-color:var(--indigo)}' +
      '.sp-pop{position:fixed;z-index:120;width:600px;max-width:94vw;background:var(--card);border:1px solid var(--line);' +
        'border-radius:13px;box-shadow:0 18px 54px rgba(20,26,31,.28);overflow:hidden;display:none;flex-direction:column}' +
      '.sp-pop.on{display:flex}' +
      '.sp-head{padding:11px 14px 9px;border-bottom:1px solid var(--line)}' +
      '.sp-eyebrow{font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--indigo)}' +
      '.sp-title{font-size:13.5px;font-weight:700;margin-top:2px}' +
      '.sp-body{position:relative;height:330px;background:var(--bg)}' +
      '.sp-frame{width:200%;height:200%;border:0;transform:scale(.5);transform-origin:0 0;display:block}' +
      '.sp-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
        'font-size:12.5px;color:var(--muted);pointer-events:none}' +
      '.sp-foot{padding:9px 14px;border-top:1px solid var(--line);display:flex;gap:8px}' +
      '.sp-open{font-size:12px;font-weight:700;color:var(--indigo-deep);text-decoration:none;margin-left:auto}' +
      /* ของหน้านี้ */
      '.act .src2{font-size:10.5px;color:var(--muted);margin-top:9px;padding-top:8px;border-top:1px solid #EDF1F4}' +
      '.dowbars{display:flex;gap:6px;align-items:flex-end;height:110px;margin-top:8px}' +
      '.dowbars .db{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;height:100%}' +
      '.dowbars .db i{display:block;width:100%;max-width:44px;background:var(--indigo);border-radius:4px 4px 0 0;min-height:2px}' +
      '.dowbars .db.max i{background:var(--green)}.dowbars .db.min i{background:var(--red)}' +
      '.dowbars .db small{font-size:10.5px;color:var(--sub)}' +
      '.dowbars .db b{font-size:10px;color:var(--muted);font-weight:600}';
    document.head.appendChild(s);
  }
  function ensurePop() {
    if (pop) { return; }
    pop = document.createElement('div');
    pop.className = 'sp-pop';
    pop.innerHTML =
      '<div class="sp-head"><div class="sp-eyebrow">ที่มาของตัวเลข</div>' +
      '<div class="sp-title" id="spTitle"></div></div>' +
      '<div class="sp-body"><div class="sp-load" id="spLoad">กำลังโหลดหน้าฝ่ายขาย…</div>' +
      '<iframe class="sp-frame" id="spFrame" title="พรีวิวแดชบอร์ดฝ่ายขาย"></iframe></div>' +
      '<div class="sp-foot"><span style="font-size:11px;color:var(--muted)">พรีวิวสด · ตัวเลขคือทุกสาขารวม</span>' +
      '<a class="sp-open" id="spOpen" target="_blank" rel="noopener">เปิดหน้าเต็ม →</a></div>';
    document.body.appendChild(pop);
    frame = pop.querySelector('#spFrame');
    frame.addEventListener('load', function () {
      pop.querySelector('#spLoad').style.display = 'none';
    });
    pop.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
    pop.addEventListener('mouseleave', scheduleHide);
  }
  function showPop(chip, key) {
    var loc = SRC[key]; if (!loc) { return; }
    ensurePop();
    clearTimeout(hideTimer);
    var peek = 'peek=' + loc.tab + ':' + loc.el;
    pop.querySelector('#spTitle').textContent = loc.label;
    pop.querySelector('#spOpen').href = PAGE_URL + '#' + peek;
    if (curKey !== key) {
      pop.querySelector('#spLoad').style.display = 'flex';
      /* เปลี่ยนเฉพาะ hash = ไฟล์ 6MB โหลดครั้งเดียว */
      if (frame.src && frame.src.indexOf('dashboard.html') >= 0) {
        frame.contentWindow.location.hash = '#embed&' + peek;
        pop.querySelector('#spLoad').style.display = 'none';
      } else {
        frame.src = EMBED_URL + '#embed&' + peek;
      }
      curKey = key;
    }
    var r = chip.getBoundingClientRect();
    pop.classList.add('on');
    var x = Math.max(10, Math.min(r.left, window.innerWidth - 610));
    var below = r.bottom + 420 < window.innerHeight || r.top < 440;
    pop.style.left = x + 'px';
    pop.style.top = below ? (r.bottom + 8) + 'px' : '';
    pop.style.bottom = below ? '' : (window.innerHeight - r.top + 8) + 'px';
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { if (pop) { pop.classList.remove('on'); } }, 260);
  }
  function chipHTML(key) {
    return '<button type="button" class="spchip" data-sp="' + key + '">ที่มา ▸ ' +
           esc(SRC[key].label) + '</button>';
  }

  /* ── ชิ้นส่วนรายงาน ──────────────────────────────────────────────────── */
  function pctTxt(a, b) { return b ? Math.round((a / b - 1) * 100) + '%' : '—'; }

  function kpiRow(A, key) {
    var d = A.aug.net && A.jul24.net ? (A.aug.net - A.jul24.net) / A.jul24.net : null;
    var h = '<div class="kpis">';
    h += UI.kpi({ label: 'ยอดขาย ส.ค. (1–24)', value: fmt.bahtK(A.aug.net),
      delta: d, sub: 'ก.ค. วันเท่ากันทำได้ ' + fmt.bahtK(A.jul24.net) });
    h += UI.kpi({ label: 'จำนวนบิล', value: fmt.int(A.aug.bills),
      sub: 'ก.ค. (1–24): ' + fmt.int(A.jul24.bills) + ' บิล' });
    h += UI.kpi({ label: 'บิลเฉลี่ย', value: fmt.baht(A.aug.avgBill),
      sub: 'ก.ค.: ' + fmt.baht(A.jul24.avgBill) });
    h += UI.kpi({ label: 'ชิ้น/บิล', value: A.aug.linesPerBill.toFixed(2),
      sub: 'ก.ค.: ' + A.jul24.linesPerBill.toFixed(2) });
    if (key === 'fashion' || key === 'surat') {
      h += UI.kpi({ label: 'บิลระบุตัวลูกค้าได้', value: Math.round(A.custRate * 100) + '%',
        sub: key === 'fashion' ? 'ฐาน broadcast ที่ใช้ได้จริง' : 'ลูกค้าให้ชื่อ/เบอร์ตอนจ่าย' });
    }
    return h + '</div>';
  }

  function promoCards(A) {
    if (!A.promos || !A.promos.length) {
      return UI.empty('เดือนนี้ไม่มีจุดที่เข้าเงื่อนไขพอจะเสนอโปร');
    }
    return '<div class="actions">' + A.promos.map(function (s, i) {
      return '<div class="act ' + s.tone + '">' +
        '<div class="no"><span>P' + (i + 1) + '</span>' +
        '<span class="tag ' + s.tagCls + '">' + esc(s.tag) + '</span></div>' +
        '<h4>' + esc(s.title) + '</h4>' +
        '<div class="mini3">' + s.metrics.map(function (m) {
          return '<div class="mini"><small>' + esc(m.label) + '</small><b>' + esc(m.value) + '</b></div>';
        }).join('') + '</div>' +
        '<div class="prob"><b>เห็นอะไรในใบเสร็จ</b>' + esc(s.why) + '</div>' +
        '<div class="rec"><b>โปรที่แนะนำ</b>' + esc(s.action) + '</div>' +
        '<div class="prob"><b>ประเมินผลลัพธ์</b>' + esc(s.expect) + '</div>' +
        '<div class="src2">ที่มา: ' + esc(s.src) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function top5Table(A) {
    if (!A.top5.length) { return UI.empty('ไม่มีข้อมูลสินค้า'); }
    return '<div class="tablewrap"><table><thead><tr>' +
      '<th>#</th><th>กลุ่มสินค้า</th><th class="num">ยอด ส.ค.</th><th class="num">ชิ้น</th>' +
      '<th class="num">ยอด ก.ค.</th><th class="num">อันดับ ก.ค.</th><th class="num">โมเมนตัม</th>' +
      '</tr></thead><tbody>' +
      A.top5.map(function (t, i) {
        var mom = t.julNet ? (t.net - t.julNet) / t.julNet : null;
        var momTxt = mom == null ? '<span class="pc" style="color:var(--muted)">ใหม่</span>'
          : '<span class="pc" style="color:' + (mom >= 0 ? 'var(--green)' : 'var(--red)') + '">' +
            (mom >= 0 ? '▲' : '▼') + Math.abs(Math.round(mom * 100)) + '%</span>';
        return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(t.name) + '</b></td>' +
          '<td class="num">' + fmt.bahtK(t.net) + '</td><td class="num">' + fmt.int(t.qty) + '</td>' +
          '<td class="num">' + fmt.bahtK(t.julNet) + '</td>' +
          '<td class="num">' + (t.julRank ? '#' + t.julRank : '—') + '</td>' +
          '<td class="num">' + momTxt + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function pairsTable(A) {
    if (!A.pairs.length) { return UI.empty('บิลคู่ยังน้อยเกินกว่าจะสรุปคู่ซื้อร่วมได้'); }
    var h = '<div class="tablewrap"><table><thead><tr>' +
      '<th>ซื้อคู่กัน</th><th class="num">บิลที่เจอคู่</th><th class="num">โอกาสคู่ (lift)</th>' +
      '<th class="num">มีแต่ตัวแรก</th><th>อ่านว่า</th></tr></thead><tbody>' +
      A.pairs.map(function (p) {
        return '<tr><td><b>' + esc(p.a) + '</b> × <b>' + esc(p.b) + '</b></td>' +
          '<td class="num">' + p.together + '</td>' +
          '<td class="num" style="font-weight:700;color:' + (p.lift >= 2 ? 'var(--green)' : 'var(--ink)') +
          '">×' + p.lift.toFixed(1) + '</td>' +
          '<td class="num">' + (p.aBills - p.together) + ' บิล</td>' +
          '<td style="font-size:12px;color:var(--sub)">คนหยิบ "' + esc(p.a) + '" มีโอกาสหยิบ "' +
          esc(p.b) + '" มากกว่าปกติ ' + p.lift.toFixed(1) + ' เท่า</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (A.zonePairs.length) {
      h += '<div class="finept">ระดับโซน: ' + A.zonePairs.map(function (z) {
        return esc(z.a) + ' × ' + esc(z.b) + ' (' + z.together + ' บิล ×' + z.lift.toFixed(1) + ')';
      }).join(' · ') + '</div>';
    }
    h += '<div class="finept">คำนวณจากบิลช่วง' + esc(A.pairWindow) + ' ' + fmt.int(A.pairBills) +
         ' บิล · lift = เจอคู่กันบ่อยกว่าที่ความบังเอิญอธิบายได้กี่เท่า</div>';
    return h;
  }

  function daysBlock(A) {
    var mx = Math.max.apply(null, A.dowAvg.concat([1]));
    var mxi = A.dowAvg.indexOf(Math.max.apply(null, A.dowAvg));
    var pos = A.dowAvg.filter(function (v) { return v > 0; });
    var mni = A.dowAvg.indexOf(Math.min.apply(null, pos));
    var bars = '<div class="dowbars">' + A.dowAvg.map(function (v, i) {
      var cls = i === mxi ? ' max' : i === mni ? ' min' : '';
      return '<div class="db' + cls + '"><b>' + fmt.bahtK(v) + '</b>' +
        '<i style="height:' + Math.max(2, Math.round(v / mx * 78)) + 'px"></i>' +
        '<small>' + DOW_S[i] + '</small></div>';
    }).join('') + '</div>';
    function dtable(list, title, color) {
      return '<div style="flex:1;min-width:220px"><div class="pt" style="color:' + color + '">' + title + '</div>' +
        '<table style="min-width:0;margin-top:4px">' + list.map(function (x) {
          return '<tr><td>' + x.d + ' ส.ค. (' + esc(x.dow) + ')</td>' +
            '<td class="num">' + fmt.bahtK(x.net) + '</td></tr>';
        }).join('') + '</table></div>';
    }
    return '<div class="g2e">' +
      UI.panel({ eyebrow: 'เฉลี่ย/วัน มิ.ย.–ส.ค.', title: 'วันไหนขาย วันไหนเงียบ',
        body: bars + '<div class="finept" style="margin-top:6px">' + chipHTML('dow') + ' ' + chipHTML('heat') + '</div>' }) +
      UI.panel({ eyebrow: 'ส.ค. 1–24 วันจริง', title: 'วันดีสุด / แย่สุด',
        body: '<div style="display:flex;gap:18px;flex-wrap:wrap">' +
          dtable(A.bestDays, 'ดีสุด 3 วัน', 'var(--green)') +
          dtable(A.worstDays, 'แย่สุด 3 วัน', 'var(--red)') + '</div>' }) +
      '</div>';
  }

  function deepTable(A) {
    if (!A.deepCats.length) { return ''; }
    return '<div class="tablewrap"><table><thead><tr>' +
      '<th>หมวด (โซน)</th><th class="num">ชิ้น/บิลของหมวด</th><th class="num">แบบสินค้า</th>' +
      '<th class="num">บิล ส.ค.</th><th class="num">ยอด ส.ค.</th></tr></thead><tbody>' +
      A.deepCats.map(function (d) {
        return '<tr><td><b>' + esc(d.zone) + '</b></td>' +
          '<td class="num" style="font-weight:700">' + d.linesPerBill.toFixed(1) + '</td>' +
          '<td class="num">' + d.products + '</td><td class="num">' + fmt.int(d.bills) + '</td>' +
          '<td class="num">' + fmt.bahtK(d.net) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="finept">เรียงจากหมวดที่ลูกค้า "เลือกหลายชิ้น + หลายแบบ" — เหมาะกับกลไกขั้นบันไดมากกว่าลดชิ้นเดี่ยว</div>';
  }

  function nakhonBlock() {
    var h = UI.banner('warn', 'นคร#2 ยังวิเคราะห์ระดับใบเสร็จไม่ได้', esc(PA.meta.nakhonNote));
    if (SI && SI.scopes && SI.scopes.s2) {
      var C = SI.scopes.s2;
      var weak = C.zones.filter(function (z) { return z.avg3 >= 12000 && z.net < z.avg3 * 0.9; })
        .sort(function (a, b) { return (b.avg3 - b.net) - (a.avg3 - a.net); }).slice(0, 5);
      h += UI.sect({ id: 'nkZones', eyebrow: 'เท่าที่ข้อมูลมี', title: 'โซนที่หลุดฟอร์ม (ก.ค. เทียบเฉลี่ย 3 เดือน)',
        body: weak.length ? '<div class="tablewrap"><table><thead><tr><th>โซน</th>' +
          '<th class="num">ก.ค. 69</th><th class="num">เฉลี่ย 3 เดือน</th><th class="num">ส่วนต่าง</th></tr></thead><tbody>' +
          weak.map(function (z) {
            return '<tr><td><b>' + esc(z.name) + '</b></td><td class="num">' + fmt.bahtK(z.net) + '</td>' +
              '<td class="num">' + fmt.bahtK(z.avg3) + '</td>' +
              '<td class="num" style="color:var(--red)">' + pctTxt(z.net, z.avg3) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="finept">' + chipHTML('zt') + '</div>'
          : UI.empty('โซนหลัก ๆ ของนครยังอยู่ในฟอร์มปกติ') });
    }
    return h;
  }

  /* ── render ──────────────────────────────────────────────────────────── */
  var curScope = 'surat';

  function scopeHTML(key) {
    var sc = SCOPES.filter(function (s) { return s.key === key; })[0];
    var head = '<div class="scope"><div>โมเดลธุรกิจ: <b>' + esc(sc.model) + '</b></div>' +
      '<div class="days">' + esc(PA.meta.focus) + '</div></div>';
    if (key === 'nakhon') { return head + nakhonBlock(); }
    var A = PA.scopes[key];
    if (!A) { return head + UI.empty('ไม่มีข้อมูล'); }
    return head +
      kpiRow(A, key) +
      UI.sect({ id: 'psPromo', eyebrow: 'ข้อเสนอ', title: 'โปรที่เสนอ — คิดจากใบเสร็จของสาขานี้เท่านั้น',
        lead: 'ทุกใบอ้างตัวเลขจริงจากรายงานด้านล่าง ใบไหนเงื่อนไขไม่ถึง ระบบไม่สร้าง',
        body: promoCards(A) }) +
      UI.sect({ id: 'psTop5', eyebrow: 'ขายดี', title: 'Top 5 กลุ่มสินค้า — ส.ค. 69',
        lead: 'เทียบ ก.ค. ช่วงวันเดียวกัน (1–24) เพื่อดูโมเมนตัม', body: top5Table(A) }) +
      UI.sect({ id: 'psPairs', eyebrow: 'ตะกร้าจริง', title: 'อะไรถูกซื้อร่วมกัน',
        lead: 'นับจากสินค้าที่อยู่บนใบเสร็จเดียวกันจริง ไม่ใช่การเดา', body: pairsTable(A) }) +
      UI.sect({ id: 'psDays', eyebrow: 'จังหวะเวลา', title: 'วันขายดี / วันเงียบ', body: daysBlock(A) }) +
      UI.sect({ id: 'psDeep', eyebrow: 'พฤติกรรมเลือกซื้อ', title: 'หมวดที่ลูกค้าเลือกเยอะที่สุด',
        body: deepTable(A) });
  }

  function wire(root) {
    injectCSS();
    (root || document).querySelectorAll('.spchip').forEach(function (chip) {
      var k = chip.getAttribute('data-sp');
      chip.addEventListener('mouseenter', function () { showPop(chip, k); });
      chip.addEventListener('mouseleave', scheduleHide);
      chip.addEventListener('click', function () {
        var loc = SRC[k];
        window.open(PAGE_URL + '#peek=' + loc.tab + ':' + loc.el, '_blank');
      });
    });
  }

  if (KAN.views && PA) {
    KAN.views['promo-sales'] = {
      id: 'promo-sales',
      group: 'การตลาด',
      icon: '📣',
      title: 'โปรรายสาขา — จากใบเสร็จจริง',
      lead: 'อ่านใบเสร็จรายสินค้า พ.ค.–ส.ค. 69 ระดับบรรทัดบิล น้ำหนักอยู่ที่ ส.ค. (ถึง 24 ส.ค.) · ' +
            'แต่ละสาขาเป็นคนละโมเดล วิเคราะห์แยกขาด · หน้านี้ไม่ขยับตามตัวกรองช่วงเวลา',
      noFilter: true,
      render: function () {
        curScope = 'surat';
        var chips = SCOPES.map(function (sc, i) {
          return '<button class="qchip' + (i === 0 ? ' on' : '') + '" data-scope="' + sc.key + '">' +
            esc(sc.label) + '</button>';
        }).join('');
        return '<div class="filters" style="margin-top:0"><div class="chiprow" style="margin:0;padding:0;border:0" id="psScopes">' +
          chips + '</div></div>' +
          '<div id="psBody" style="margin-top:14px">' + scopeHTML('surat') + '</div>' +
          '<div class="finept" style="margin-top:16px">แหล่งข้อมูล: ' + esc(PA.meta.src) +
          ' · หน้าต่างวิเคราะห์ ' + esc(PA.meta.from) + ' → ' + esc(PA.meta.to) +
          ' · อัปเดตด้วย etl/analyze-receipts.py เมื่อได้ไฟล์เดือนใหม่</div>';
      },
      after: function () {
        wire(document.getElementById('psBody'));
        document.querySelectorAll('#psScopes .qchip').forEach(function (c) {
          c.addEventListener('click', function () {
            curScope = c.getAttribute('data-scope');
            document.querySelectorAll('#psScopes .qchip').forEach(function (x) {
              x.classList.toggle('on', x === c);
            });
            var host = document.getElementById('psBody');
            host.innerHTML = scopeHTML(curScope);
            wire(host);
          });
        });
      },
    };
    if (KAN.viewOrder) { KAN.viewOrder.push('promo-sales'); }
    KAN.suggestSalesDebug = { scopeHTML: scopeHTML };  /* ไว้ smoke test */
  }
}(window));
