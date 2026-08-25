/* KAN ERP — รายงานโฆษณา Meta (Facebook/Instagram)
 *
 * ข้อมูลมาจาก snapshot `data/ads-data.js` ที่ ETL ดึงจากบัญชีโฆษณา "Kan x MCC"
 * ไม่ใช่ข้อมูลสด — ตัวเลขนิ่งจนกว่าจะรัน ETL รอบใหม่ (ดู scratchpad/ads/ADS-ETL.md)
 *
 * เส้นเชื่อมกับฝั่งยอดขาย: ชื่อแคมเปญทุกตัวขึ้นต้นด้วย #01–#05 ซึ่งเป็นรหัสสาขา
 * ชุดเดียวกับ KST#n ใน kan-data.js → เอาค่าแอดไปหารยอดขายสาขานั้นได้ตรง ๆ
 */
(function (global) {
  'use strict';

  var KAN = global.KAN, UI = KAN.UI, fmt = KAN.fmt, esc = KAN.esc, D = KAN.D;

  function def(v) { KAN.views[v.id] = v; KAN.viewOrder.push(v.id); return v; }

  var A = global.KAN_ADS || null;

  /* ══════════════════════════════════════════════════ เอนจินคำนวณ ══ */

  /* ผูกสาขาฝั่งแอด (key) เข้ากับดัชนีสาขาฝั่งยอดขาย ผ่านรหัส KST#n */
  var codeIx = {};
  D.branches.forEach(function (b, i) { codeIx[b.code] = i; });

  var ADS = KAN.ADS = {
    ok: !!A,
    meta: A ? A.meta : null,
    campaigns: A ? A.campaigns : [],
    branches: A ? A.branches : [],
  };

  /* key สาขาฝั่งแอด → ดัชนีสาขาฝั่งยอดขาย (null = สาขาที่ฝั่งยอดขายไม่มีแล้ว) */
  var brSalesIx = {};
  ADS.branches.forEach(function (b) {
    brSalesIx[b.key] = b.sales != null && codeIx[b.sales] != null ? codeIx[b.sales] : null;
  });
  /* ทางกลับ: ดัชนีสาขาฝั่งยอดขาย → key ฝั่งแอด */
  var salesIxBr = {};
  Object.keys(brSalesIx).forEach(function (k) {
    if (brSalesIx[k] != null) { salesIxBr[brSalesIx[k]] = k; }
  });
  ADS.brName = function (key) {
    for (var i = 0; i < ADS.branches.length; i++) {
      if (ADS.branches[i].key === key) { return ADS.branches[i].name; }
    }
    return 'ไม่ระบุสาขา';
  };

  var GOAL = {
    engage: { label: 'บูสต์โพสต์',   cls: 'b' },
    msg:    { label: 'ให้ทักแชท',    cls: 'g' },
    lead:   { label: 'เก็บรายชื่อ',   cls: 'g' },
    video:  { label: 'ยอดดูวิดีโอ',  cls: 'n' },
    aware:  { label: 'ให้คนรู้จัก',   cls: 'n' },
    live:   { label: 'ไลฟ์',          cls: 'a' },
  };
  ADS.goal = function (g) { return GOAL[g] || { label: g, cls: 'n' }; };

  var EMPTY = { spend: 0, imp: 0, reach: 0, clicks: 0, eng: 0, lc: 0, lead: 0, days: 0 };
  function blank() {
    return { spend: 0, imp: 0, reach: 0, clicks: 0, eng: 0, lc: 0, lead: 0, days: 0 };
  }
  function derive(t) {
    t.ctr  = t.imp ? t.clicks / t.imp : 0;
    t.cpm  = t.imp ? t.spend / t.imp * 1000 : 0;
    t.cpc  = t.clicks ? t.spend / t.clicks : 0;
    t.cpe  = t.eng ? t.spend / t.eng : 0;      /* ราคาต่อ 1 การมีส่วนร่วม */
    t.freq = t.reach ? t.imp / t.reach : 0;
    t.perDay = t.days ? t.spend / t.days : 0;
    return t;
  }

  /* rows: [วันที่, ดัชนีแคมเปญ, ค่าแอด, การมองเห็น, คนที่เห็น, คลิก, มีส่วนร่วม, คลิกลิงก์, รายชื่อ] */
  function walk(from, to, brKey, fn) {
    if (!A) { return; }
    var rows = A.daily;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r[0] < from || r[0] > to) { continue; }
      var c = A.campaigns[r[1]];
      if (brKey && c.br !== brKey) { continue; }
      fn(r, c);
    }
  }

  function add(t, r) {
    t.spend += r[2]; t.imp += r[3]; t.reach += r[4];
    t.clicks += r[5]; t.eng += r[6]; t.lc += r[7]; t.lead += r[8];
  }

  ADS.totals = function (from, to, brKey) {
    var t = blank(), seen = {};
    walk(from, to, brKey, function (r) { add(t, r); seen[r[0]] = 1; });
    t.days = Object.keys(seen).length;
    return derive(t);
  };

  ADS.byBranch = function (from, to) {
    var out = {};
    ADS.branches.forEach(function (b) { out[b.key] = blank(); });
    walk(from, to, null, function (r, c) {
      if (!out[c.br]) { out[c.br] = blank(); }
      add(out[c.br], r);
    });
    Object.keys(out).forEach(function (k) { derive(out[k]); });
    return out;
  };

  ADS.byCampaign = function (from, to, brKey) {
    var m = {};
    walk(from, to, brKey, function (r, c) {
      var t = m[c.id] || (m[c.id] = blank());
      add(t, r);
      t.c = c;
    });
    return Object.keys(m).map(function (k) { return derive(m[k]); })
      .sort(function (a, b) { return b.spend - a.spend; });
  };

  /* ค่าแอดรายวัน เรียงตามชุดวันเดียวกับกราฟฝั่งยอดขาย (เติม 0 ให้วันที่ไม่ยิงแอด) */
  ADS.series = function (dates, brKey) {
    var ix = {}, out = new Array(dates.length).fill(0);
    dates.forEach(function (d, i) { ix[d] = i; });
    walk(dates[0], dates[dates.length - 1], brKey, function (r) {
      var i = ix[r[0]];
      if (i != null) { out[i] += r[2]; }
    });
    return out;
  };

  /* ══════════════════════════════════════════════════ ตัวช่วยวาด ══ */

  /* แถวแท่งเทียบสัดส่วน ใช้กับ breakdown ที่เป็นหมวดสั้น ๆ */
  function barRows(rows, opts) {
    opts = opts || {};
    var max = 0;
    rows.forEach(function (r) { if (r.v > max) { max = r.v; } });
    var total = rows.reduce(function (a, r) { return a + r.v; }, 0);
    if (!total) { return UI.empty('ไม่มีข้อมูล'); }
    var h = '<div class="legend">';
    rows.forEach(function (r) {
      h += '<div class="li"><span class="sw" style="background:' + (r.color || '#4F46E5') + '"></span>' +
        '<span class="nm"><b>' + esc(r.label) + '</b>' +
        (r.sub ? '<small>' + r.sub + '</small>' : '') + '</span>' +
        '<span class="amt">' + (opts.fmt ? opts.fmt(r.v) : fmt.baht(r.v)) +
        ' <span style="color:#9AA0B1;font-weight:400">' + fmt.pct(r.v / total, 0) + '</span></span></div>';
    });
    h += '</div>';
    return h;
  }

  function statMini(label, value, sub) {
    return '<div class="mini"><small>' + esc(label) + '</small><b>' + value + '</b>' +
      (sub ? '<div class="d" style="color:#9AA0B1;font-weight:400">' + sub + '</div>' : '') + '</div>';
  }

  function pctOrDash(a, b) { return b ? fmt.pct(a / b, 1) : '—'; }

  /* ราคาต่อหน่วยฝั่งแอดมักไม่ถึงบาท — fmt.baht ปัดเป็นบาทเต็มแล้วเหลือ ฿0 หมด */
  function bahtFine(v) {
    if (v == null || !isFinite(v)) { return '—'; }
    if (v === 0) { return '฿0'; }
    if (v < 10) { return '฿' + v.toFixed(2); }
    return fmt.baht(v);
  }

  /* ══════════════════════════════════════════════════════ หน้าแอด ══ */

  def({
    id: 'ads',
    group: 'โฆษณา',
    icon: '📣',
    title: 'รายงานโฆษณา (Meta)',
    lead: 'จ่ายค่าแอดไปเท่าไหร่ ได้อะไรกลับมา และคุ้มกับยอดขายในช่วงเดียวกันแค่ไหน',

    render: function (range) {
      if (!ADS.ok) {
        return UI.empty('ยังไม่มีไฟล์ข้อมูลโฆษณา (<b>data/ads-data.js</b>)' +
          '<br><br>รัน ETL ฝั่งแอดก่อน แล้วหน้านี้จะขึ้นเอง');
      }

      var M = A.meta;
      var b = KAN.branchFilter();
      var brKey = b != null ? (salesIxBr[b] || null) : null;
      /* เลือกสาขาที่ไม่มีแคมเปญของตัวเอง (เช่นโกดัง) → ไม่มีอะไรให้ดู */
      var brMissing = b != null && !brKey;

      /* ตัดช่วงให้อยู่ในกรอบที่ข้อมูลแอดมีจริง */
      var from = range.from < M.dateMin ? M.dateMin : range.from;
      var to   = range.to   > M.dateMax ? M.dateMax : range.to;
      var clipped = from !== range.from || to !== range.to;

      /* ช่วงที่เลือกอยู่นอกกรอบข้อมูลแอดทั้งช่วง — หนีบแล้วจะกลับหัว ต้องตัดจบตรงนี้ */
      if (from > to) {
        return UI.empty('ช่วงที่เลือก (' + esc(fmt.thDate(range.from) + ' – ' + fmt.thDate(range.to)) +
          ') อยู่นอกช่วงที่มีข้อมูลโฆษณา' +
          '<br><br>บัญชีนี้เริ่มยิงแอด ' + esc(fmt.thDate(M.dateMin)) +
          ' และข้อมูลมีถึง ' + esc(fmt.thDate(M.dateMax)) +
          '<br>เลือกช่วงที่คาบเกี่ยวกับกรอบนี้เพื่อดูรายงาน');
      }

      var t = ADS.totals(from, to, brKey);

      /* ช่วงก่อนหน้า ยาวเท่ากัน เอาไว้เทียบ */
      var pFrom = KAN.addDays(from, -(KAN.diffDays(from, to) + 1));
      var pTo   = KAN.addDays(from, -1);
      var pOK   = KAN.state.compare && pTo >= M.dateMin;
      var p     = pOK ? ADS.totals(pFrom < M.dateMin ? M.dateMin : pFrom, pTo, brKey) : null;
      function d(cur, prev, key) {
        if (!p || !prev[key]) { return null; }
        return (cur[key] - prev[key]) / prev[key];
      }

      /* ยอดขายช่วงเดียวกัน สาขาเดียวกัน — ตัวหารของ "คุ้มไหม" */
      var i0 = KAN.idxAtOrAfter(from), i1 = KAN.idxAtOrBefore(to);
      var pos = KAN.posTotals(i0, i1, b);

      var h = '';

      h += '<div class="scope"><div>ขอบเขต: <b>' + esc(KAN.scopeLabel()) + '</b> · ' +
           esc(fmt.thDate(from) + ' – ' + fmt.thDate(to)) + '</div>' +
           '<div class="days">' + (KAN.diffDays(from, to) + 1) + ' วัน · ยิงแอดจริง ' +
           fmt.int(t.days) + ' วัน</div></div>';

      h += UI.banner('info', 'ตัวเลขนี้มาจากไหน',
        'ดึงจากบัญชีโฆษณา <b style="display:inline">' + esc(M.account.name) + '</b> ' +
        'เป็น<b style="display:inline">ภาพนิ่ง ณ ' + esc(fmt.thDate(M.generated.slice(0, 10))) + '</b> ' +
        'ไม่ใช่ข้อมูลสด — ตัวเลขจะขยับต่อเมื่อรัน ETL ฝั่งแอดรอบใหม่ · ' +
        'มีข้อมูลตั้งแต่ ' + esc(fmt.thDate(M.dateMin)) + ' ถึง ' + esc(fmt.thDate(M.dateMax)) +
        (clipped ? ' — <b style="display:inline">ช่วงที่เลือกกว้างกว่านั้น หน้านี้จึงตัดเหลือเท่าที่มีข้อมูล</b>' : ''));

      if (brMissing) {
        h += UI.empty('สาขา <b>' + esc(D.branches[b].name) + '</b> ไม่มีแคมเปญของตัวเองในบัญชีโฆษณานี้' +
          '<br><br>เลือก “ทุกสาขา” เพื่อดูภาพรวม');
        return h;
      }
      if (!t.spend) {
        h += UI.empty('ไม่มีการยิงแอดในช่วง ' + esc(fmt.thDate(from) + ' – ' + fmt.thDate(to)));
        return h;
      }

      /* ── 1. จ่ายไปเท่าไหร่ ได้อะไร ─────────────────────────────────── */

      h += '<div class="kpis">';
      h += UI.kpi({ label: 'ค่าแอดที่จ่าย', tone: 'g', value: fmt.baht(t.spend),
        delta: d(t, p, 'spend'), invert: true,
        sub: 'เฉลี่ยวันละ ' + fmt.baht(t.perDay) + ' ในวันที่ยิงจริง' });
      h += UI.kpi({ label: 'แอดถูกเห็น', value: fmt.int(t.imp) + ' ครั้ง',
        delta: d(t, p, 'imp'),
        sub: 'ผู้ชมราว ' + fmt.int(t.reach) + ' คน — คนเดิมที่เห็นหลายวันถูกนับซ้ำ' });
      h += UI.kpi({ label: 'คนกดโต้ตอบ', tone: 'b', value: fmt.int(t.eng),
        delta: d(t, p, 'eng'),
        sub: 'ไลก์ คอมเมนต์ แชร์ กดดูรูป · ราคาต่อครั้ง ' + bahtFine(t.cpe) });
      h += UI.kpi({ label: 'ราคาต่อการเห็น 1,000 ครั้ง', tone: 'a', value: fmt.baht(t.cpm),
        delta: d(t, p, 'cpm'), invert: true,
        sub: 'ยิ่งต่ำยิ่งดี · คลิก ' + fmt.pct(t.ctr, 1) + ' ของที่เห็น' });
      h += '</div>';

      /* ── 2. คุ้มไหม (เทียบยอดขายช่วงเดียวกัน) ────────────────────── */

      var perBaht = t.spend ? pos.net / t.spend : 0;
      var share   = pos.net ? t.spend / pos.net : 0;
      var tone = share === 0 ? '' : share <= 0.05 ? 'g' : share <= 0.10 ? 'a' : 'r';

      h += UI.sect({
        id: 'worth', eyebrow: 'คุ้มไหม', title: 'ค่าแอดเทียบกับยอดขายในช่วงเดียวกัน',
        lead: 'ดูว่าเงินที่จ่ายให้ Meta คิดเป็นสัดส่วนเท่าไหร่ของยอดขายที่เข้ามาจริง',
        body:
          '<div class="kpis">' +
          UI.kpi({ label: 'ค่าแอด 1 บาท คู่กับยอดขาย', tone: tone === 'r' ? 'a' : 'g',
            value: fmt.baht(perBaht),
            sub: 'ยอดขาย ' + fmt.baht(pos.net) + ' ÷ ค่าแอด ' + fmt.baht(t.spend) }) +
          UI.kpi({ label: 'ค่าแอดคิดเป็นกี่ % ของยอดขาย', tone: tone,
            value: fmt.pct(share, 1),
            sub: KAN.pro
               ? (share <= 0.05 ? 'ต่ำ — ยังเพิ่มงบได้ถ้ายอดตามทัน'
                : share <= 0.10 ? 'กลาง ๆ — ปกติของร้านค้าปลีก'
                : 'สูง — ต้องไล่ดูว่าแคมเปญไหนกินงบ')
               : 'เทียบกับยอดขาย ' + fmt.baht(pos.net) + ' ในช่วงเดียวกัน' }) +
          UI.kpi({ label: 'ยอดขายช่วงนี้', value: fmt.baht(pos.net),
            sub: fmt.int(pos.bills) + ' บิล · เฉลี่ยบิลละ ' + fmt.baht(pos.avgBill) }) +
          '</div>' +
          UI.banner('warn', 'อ่านตัวเลขนี้ยังไง',
            'นี่คือการ<b style="display:inline">วางคู่กัน</b> ไม่ใช่การพิสูจน์ว่าแอดทำให้เกิดยอด — ' +
            'ลูกค้าเดินเข้าร้านแล้วจ่ายเงินสด ระบบไม่มีทางรู้ว่าเขาเห็นแอดมาก่อนหรือเปล่า ' +
            'ใช้ดู<b style="display:inline">แนวโน้ม</b> (เดือนนี้เทียบเดือนก่อน สาขานี้เทียบสาขาโน้น) ได้ ' +
            'แต่อย่าใช้สรุปว่า “แอดสร้างยอดได้เท่านี้”'),
      });

      /* ── 3. กราฟรายวัน: ค่าแอด vs ยอดขาย ────────────────────────── */

      h += UI.sect({
        id: 'trend', eyebrow: 'รายวัน', title: 'วันที่จ่ายค่าแอดหนัก ยอดขายขยับตามไหม',
        body: '<div class="chartbox lg"><canvas id="adTrend"></canvas></div>' +
          '<div class="finept">แท่ง = ค่าแอดที่จ่ายวันนั้น (แกนซ้าย) · เส้น = ยอดขายวันนั้น (แกนขวา) · ' +
          'เอาเมาส์ชี้เพื่อดูตัวเลขทั้งสองฝั่ง</div>',
      });

      /* ── 4. แยกสาขา ─────────────────────────────────────────────── */

      if (b == null) {
        var per = ADS.byBranch(from, to);
        var posB = KAN.posByBranch(i0, i1);
        var brRows = ADS.branches.map(function (bb) {
          var a = per[bb.key] || derive(blank());
          var six = brSalesIx[bb.key];
          var net = six != null ? posB[six].net : null;
          var why = null;
          if (six == null) { why = 'ฝั่งยอดขายไม่มีสาขานี้แล้ว'; }
          else if (D.branches[six].kind !== 'store') { why = 'เป็นโกดัง ไม่มีบิลหน้าร้าน'; }
          else if (!net) { why = 'ไม่มีบิลเข้าระบบในช่วงนี้'; }
          return { key: bb.key, name: bb.name, a: a, net: net, six: six, why: why };
        }).filter(function (r) { return r.a.spend > 0; })
          .sort(function (x, y) { return y.a.spend - x.a.spend; });

        var maxSpend = brRows.length ? brRows[0].a.spend : 1;
        var cards = '<div class="branches">';
        brRows.forEach(function (r, i) {
          var sh = r.why ? null : r.a.spend / r.net;
          var itone = sh == null ? '' : sh <= 0.05 ? ' g' : sh <= 0.10 ? ' a' : ' r';
          cards += '<div class="branch">' +
            '<div class="bh" style="display:flex;gap:10px;align-items:center">' +
              '<div class="rank">' + (i + 1) + '</div>' +
              '<div><b>' + esc(r.name) + '</b><small>' +
                (r.why || 'ยอดขาย ' + fmt.baht(r.net)) +
              '</small></div></div>' +
            '<div class="amt">' + fmt.baht(r.a.spend) +
              '<span style="font-size:12px;font-weight:600;color:#9AA0B1">' +
              (sh == null ? '—' : fmt.pct(sh, 1) + ' ของยอด') + '</span></div>' +
            '<div class="bar"><i class="' + itone.trim() + '" style="width:' +
              (r.a.spend / maxSpend * 100).toFixed(1) + '%' +
              (sh == null ? ';background:#C9CCDA' : '') + '"></i></div>' +
            '<div class="bstats">' +
              '<div><small>ครั้งที่ถูกเห็น</small><b>' + fmt.int(r.a.imp) + '</b></div>' +
              '<div><small>คนกดโต้ตอบ</small><b>' + fmt.int(r.a.eng) + '</b></div>' +
              '<div><small>ราคา/โต้ตอบ</small><b>' + bahtFine(r.a.cpe) + '</b></div>' +
            '</div></div>';
        });
        cards += '</div>';

        h += UI.sect({
          id: 'branches', eyebrow: 'แยกสาขา', title: 'งบก้อนนี้ไปลงที่สาขาไหน',
          lead: 'เลข <b>#01–#05</b> ที่อยู่หน้าชื่อแคมเปญคือรหัสสาขาชุดเดียวกับฝั่งยอดขาย จึงจับคู่กันได้ตรง',
          body: cards +
            '<div class="finept">แถบสี: เขียว = ค่าแอดไม่เกิน 5% ของยอดขายสาขานั้น · ' +
            'เหลือง = 5–10% · แดง = เกิน 10% · ' +
            'สาขาที่ฝั่งยอดขายไม่มีบิลในช่วงนี้จะเทียบ % ไม่ได้ ' +
            '(KAN HUB เป็นโกดัง ไม่มีหน้าร้าน · นครศรีฯ ถูกตัดออกจากชุดข้อมูลยอดขายแล้ว)</div>',
        });
      }

      /* ── 5. ตารางแคมเปญ ─────────────────────────────────────────── */

      var camps = ADS.byCampaign(from, to, brKey);
      /* ธงเตือน = จ่ายตั้งแต่ ฿100 แต่ราคาต่อการโต้ตอบแพงกว่าค่ากลางเกินเท่าตัว
       * โผล่เฉพาะโหมดวิเคราะห์ — เป็นคำวินิจฉัยที่ต้องมีคนอธิบายประกอบ
       * ไม่ใช่ตัวเลขที่ควรค้างอยู่บนจอตอนเปิดให้คนอื่นดู */
      var cpes = camps.filter(function (c) { return c.eng > 0; })
                      .map(function (c) { return c.cpe; }).sort(function (a, b) { return a - b; });
      var medCpe = cpes.length ? cpes[Math.floor(cpes.length / 2)] : 0;
      camps.forEach(function (c) {
        c.burn = medCpe > 0 && c.spend >= 100 && c.eng > 0 && c.cpe > medCpe * 2;
      });
      if (!KAN.pro) { camps.forEach(function (c) { c.burn = false; }); }
      var nBurn = camps.filter(function (c) { return c.burn; }).length;
      var burnSpend = camps.reduce(function (a, c) { return a + (c.burn ? c.spend : 0); }, 0);

      this._camps = camps;
      this._medCpe = medCpe;

      h += UI.sect({
        id: 'camp', eyebrow: 'รายแคมเปญ',
        title: KAN.pro ? 'แคมเปญไหนคุ้ม แคมเปญไหนเผาเงิน' : 'รายละเอียดรายแคมเปญ',
        lead: 'กดหัวตารางเพื่อเรียงใหม่ · ค่ากลางของราคาต่อการโต้ตอบช่วงนี้คือ <b>' +
              bahtFine(medCpe) + '</b>',
        body: (nBurn
                ? UI.banner('warn', 'มี ' + nBurn + ' แคมเปญที่ควรดู',
                    'จ่ายรวมกัน <b style="display:inline">' + fmt.baht(burnSpend) + '</b> ' +
                    '(' + fmt.pct(burnSpend / t.spend, 0) + ' ของค่าแอดทั้งช่วง) ' +
                    'แต่ราคาต่อการโต้ตอบแพงกว่าค่ากลางเกินเท่าตัว — ติดป้าย ' +
                    '<span class="tag r">เผาเงิน</span> ในตาราง')
                : '') +
              UI.tableShell('adCampTbl') +
              '<div class="finept">ตัวเลขทุกช่องคิดเฉพาะ<b>ในช่วงวันที่เลือก</b> ไม่ใช่ยอดตลอดอายุแคมเปญ · ' +
              '“คนที่เห็น” รวมจากรายวัน คนเดิมที่เห็นหลายวันจึงถูกนับซ้ำ</div>',
      });

      /* ── 6. คนที่เห็นแอดเป็นใคร / เห็นที่ไหน ───────────────────── */

      var bd = A.breakdowns;
      var bdNote = 'ก้อนนี้เป็นยอดรวมช่วง ' + esc(fmt.thDate(M.bdRange[0])) + ' – ' +
        esc(fmt.thDate(M.bdRange[1])) + ' ทั้งบัญชี — <b style="display:inline">ไม่ขยับตามตัวกรองด้านบน</b>';

      var PAL = KAN.PALETTE;
      var ageRows = bd.age.map(function (r, i) {
        return { label: r[0] + ' ปี', v: r[1], color: PAL[i % PAL.length],
                 sub: 'เห็น ' + fmt.int(r[3]) + ' คน · คลิก ' + pctOrDash(r[4], r[2]) };
      });
      var GENDER = { female: 'ผู้หญิง', male: 'ผู้ชาย', unknown: 'ไม่ระบุ' };
      var genRows = bd.gender.map(function (r, i) {
        return { label: GENDER[r[0]] || r[0], v: r[1], color: ['#F2565A', '#2563EB', '#9AA0B1'][i],
                 sub: 'เห็น ' + fmt.int(r[3]) + ' คน · คลิก ' + pctOrDash(r[4], r[2]) };
      });

      h += UI.sect({
        id: 'who', eyebrow: 'คนที่เห็นแอด', title: 'เงินไปถึงใคร',
        body: '<div class="g2e">' +
          UI.panel({ eyebrow: 'ช่วงอายุ', title: 'ค่าแอดแยกตามอายุ', body: barRows(ageRows) }) +
          UI.panel({ eyebrow: 'เพศ', title: 'ค่าแอดแยกตามเพศ', body: barRows(genRows) }) +
          '</div>' +
          '<div class="finept">' + bdNote + '</div>',
      });

      var PLAT = { facebook: 'Facebook', instagram: 'Instagram', threads: 'Threads' };
      var platRows = bd.platform.map(function (r, i) {
        return { label: PLAT[r[0]] || r[0], v: r[1], color: ['#2563EB', '#F2565A', '#111827'][i],
                 sub: 'เห็น ' + fmt.int(r[3]) + ' คน' };
      });
      var PLACE = {
        feed: 'หน้าฟีด', facebook_reels: 'Reels (FB)', facebook_stories: 'สตอรี่ (FB)',
        instream_video: 'คั่นกลางวิดีโอ', instagram_reels: 'Reels (IG)',
        instagram_stories: 'สตอรี่ (IG)', facebook_profile_feed: 'ฟีดโปรไฟล์',
        marketplace: 'Marketplace', search: 'ช่องค้นหา', facebook_notification: 'การแจ้งเตือน',
        instagram_explore_grid_home: 'Explore (IG)', threads_feed: 'ฟีด Threads',
      };
      var placeRows = bd.placement.slice()
        .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6)
        .map(function (r, i) {
          return { label: PLACE[r[0]] || r[0], v: r[1], color: PAL[i % PAL.length],
                   sub: 'เห็น ' + fmt.int(r[3]) + ' คน · คลิก ' + pctOrDash(r[4], r[2]) };
        });
      var DEV = { android_smartphone: 'มือถือ Android', iphone: 'iPhone', ipad: 'iPad',
                  android_tablet: 'แท็บเล็ต Android', desktop: 'คอมพิวเตอร์', other: 'อื่น ๆ' };
      var devRows = bd.device.slice()
        .sort(function (a, b) { return b[1] - a[1]; })
        .filter(function (r) { return r[1] >= 1; })
        .map(function (r, i) {
          return { label: DEV[r[0]] || r[0], v: r[1], color: PAL[i % PAL.length],
                   sub: 'เห็น ' + fmt.int(r[3]) + ' คน' };
        });

      h += UI.sect({
        id: 'where', eyebrow: 'เห็นแอดที่ไหน', title: 'แอดไปโผล่ตรงไหนบ้าง',
        body: '<div class="g3">' +
          UI.panel({ eyebrow: 'แพลตฟอร์ม', title: 'FB / IG', body: barRows(platRows) }) +
          UI.panel({ eyebrow: 'ตำแหน่ง', title: '6 ตำแหน่งที่ใช้งบสูงสุด', body: barRows(placeRows) }) +
          UI.panel({ eyebrow: 'อุปกรณ์', title: 'ดูจากเครื่องอะไร', body: barRows(devRows) }) +
          '</div>' +
          '<div class="finept">' + bdNote + '</div>',
      });

      /* จังหวัด — ร้านอยู่ภาคใต้ ถ้างบรั่วออกนอกพื้นที่จะเห็นตรงนี้ */
      var PROV = {
        'Surat Thani': 'สุราษฎร์ธานี', 'Nakhon Si Thammarat': 'นครศรีธรรมราช',
        'Chumphon': 'ชุมพร', 'Ranong': 'ระนอง', 'Krabi': 'กระบี่', 'Bangkok': 'กรุงเทพฯ',
        'Phatthalung': 'พัทลุง', 'Songkhla': 'สงขลา', 'Trang': 'ตรัง', 'Phangnga': 'พังงา',
        'Satun': 'สตูล', 'Pattani': 'ปัตตานี', 'Chon Buri': 'ชลบุรี', 'Unknown': 'ไม่ระบุ',
      };
      var HOME = { 'Surat Thani': 1, 'Nakhon Si Thammarat': 1, 'Chumphon': 1, 'Ranong': 1 };
      var regTotal = bd.region.reduce(function (a, r) { return a + r[1]; }, 0);
      var homeSpend = bd.region.reduce(function (a, r) { return a + (HOME[r[0]] ? r[1] : 0); }, 0);
      var regRows = bd.region.slice().sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8)
        .map(function (r) {
          return { label: PROV[r[0]] || r[0], v: r[1],
                   color: HOME[r[0]] ? '#15803D' : '#9AA0B1',
                   sub: 'เห็น ' + fmt.int(r[3]) + ' คน · คลิก ' + pctOrDash(r[4], r[2]) };
        });

      /* ชั่วโมง — ไว้เทียบกับ heatmap เวลาคนเข้าร้านในหน้าโปรโมชัน */
      var hourMax = 0;
      bd.hour.forEach(function (r) { if (r[1] > hourMax) { hourMax = r[1]; } });
      var hourHtml = '<div style="display:flex;gap:3px;align-items:flex-end;height:120px;margin-top:6px">';
      bd.hour.forEach(function (r) {
        hourHtml += '<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%"' +
          ' title="' + r[0] + ':00 น. · ' + fmt.baht(r[1]) + ' · คลิก ' + fmt.int(r[3]) + '">' +
          '<i style="display:block;border-radius:3px 3px 0 0;background:' +
          (r[1] >= hourMax * 0.75 ? '#4F46E5' : '#B9BCF0') + ';height:' +
          (r[1] / hourMax * 100).toFixed(1) + '%"></i></div>';
      });
      hourHtml += '</div><div style="display:flex;justify-content:space-between;font-size:10.5px;' +
        'color:#9AA0B1;margin-top:5px"><span>00 น.</span><span>06</span><span>12</span>' +
        '<span>18</span><span>23 น.</span></div>';

      h += UI.sect({
        id: 'geo', eyebrow: 'พื้นที่และเวลา',
        title: KAN.pro ? 'งบลงตรงพื้นที่ร้านหรือรั่วออกนอกภาค' : 'งบลงพื้นที่ไหน ตอนไหน',
        body: '<div class="g2">' +
          UI.panel({ eyebrow: 'จังหวัด', title: '8 จังหวัดที่ใช้งบสูงสุด',
            hint: 'เขียว = จังหวัดที่มีสาขาหรือติดกัน · เทา = นอกพื้นที่',
            body: barRows(regRows),
            foot: 'ลงในสุราษฎร์ฯ นครศรีฯ ชุมพร ระนอง รวม <b>' + fmt.baht(homeSpend) + '</b> = ' +
                  fmt.pct(homeSpend / regTotal, 1) + ' ของค่าแอดทั้งหมด' }) +
          UI.panel({ eyebrow: 'ชั่วโมง', title: 'ค่าแอดถูกใช้ตอนไหนของวัน',
            body: hourHtml,
            foot: 'เทียบกับหน้า <b>ข้อเสนอโปรโมชัน</b> ที่บอกว่าคนเข้าร้านจริงตอนไหน' +
                  (KAN.pro ? ' — ถ้าสองอันไม่ตรงกัน แปลว่าจ่ายเงินผิดเวลา' : '') }) +
          '</div>' +
          '<div class="finept">' + bdNote + '</div>',
      });

      /* ── 7. ฝั่งเพจ (ยังต่อไม่ได้) ──────────────────────────────── */

      var PAGES = [
        'KAN HUB อาณาจักรค้าส่งเสื้อผ้าญี่ปุ่นมือสองที่ใหญ่ที่สุดในภาคใต้',
        'กาญจน์ สโตร์ อาณาจักรสินค้าญี่ปุ่นมือสอง สุราษฎร์ธานี',
        'KAN Fashion ศูนย์รวมแฟชั่นหมุนเวียนครบวงจร สุราษฎร์ธานี',
        'กาญจน์ ซุปเปอร์ สโตร์ สาขาชุมพร',
        'กาญจน์ ซุปเปอร์ สโตร์ สาขานครศรีธรรมราช',
      ];
      h += UI.sect({
        id: 'page', eyebrow: 'ฝั่งเพจ', title: 'ยอดของเพจที่ไม่ได้ซื้อโฆษณา — ยังต่อไม่ได้',
        lead: 'ทุกอย่างข้างบนคือ<b>เฉพาะโพสต์ที่จ่ายเงิน</b> ยอดฝั่งเพจล้วน ๆ ยังไม่อยู่ในนี้',
        body: UI.panel({
          eyebrow: 'ต้องมีอะไรถึงจะได้', title: 'ช่องทางที่ระบบใช้อยู่ให้ได้แค่ฝั่งแอด',
          body:
            '<div style="font-size:13px;line-height:1.75;color:#5B6172">' +
            'ช่องทางที่ดึงตัวเลขแอดมาให้หน้านี้ เปิดให้เห็นเฉพาะข้อมูล<b>บัญชีโฆษณา</b> ' +
            'ส่วนยอดของเพจ (คนติดตาม คนเห็นโพสต์ธรรมดา ยอดโต้ตอบโพสต์ที่ไม่ได้บูสต์ ' +
            'คนทักแชทเข้ามาเอง) อยู่คนละประตู ต้องใช้กุญแจของเพจแยกอีกดอก' +
            '</div>' +
            '<div class="mini3" style="margin-top:12px">' +
            statMini('เพจที่ผูกกับบัญชีโฆษณา', fmt.int(PAGES.length) + ' เพจ', 'พร้อมดึงทันทีเมื่อมีกุญแจ') +
            statMini('ที่ได้ตอนนี้', 'เฉพาะที่จ่ายเงิน', 'โพสต์บูสต์ + แคมเปญ') +
            statMini('ที่ยังขาด', 'ยอดออร์แกนิก', 'ผู้ติดตาม · โพสต์ธรรมดา · แชท') +
            '</div>' +
            '<div class="legend" style="margin-top:14px">' +
            PAGES.map(function (p) {
              return '<div class="li"><span class="sw" style="background:#D3D6E2"></span>' +
                '<span class="nm"><b>' + esc(p) + '</b></span>' +
                '<span class="amt"><span class="badge-off">รอกุญแจเพจ</span></span></div>';
            }).join('') +
            '</div>',
          foot: 'เมื่อได้กุญแจแล้ว หน้านี้จะเพิ่มได้อีก 4 อย่าง: ผู้ติดตามเพิ่ม/ลดรายวัน · ' +
                'คนเห็นโพสต์ที่ไม่ได้บูสต์ · โพสต์ไหนดีเองโดยไม่ต้องดันเงิน · จำนวนคนทักแชท',
        }),
      });

      return h;
    },

    after: function () {
      if (!ADS.ok) { return; }
      var M = A.meta;
      var b = KAN.branchFilter();
      var brKey = b != null ? (salesIxBr[b] || null) : null;
      var range = KAN.range();
      var from = range.from < M.dateMin ? M.dateMin : range.from;
      var to   = range.to   > M.dateMax ? M.dateMax : range.to;
      if (from > to) { return; }

      /* ── กราฟ ค่าแอด vs ยอดขาย ───────────────────────────────────── */
      var i0 = KAN.idxAtOrAfter(from), i1 = KAN.idxAtOrBefore(to);
      var s = KAN.posSeries(i0, i1, b);
      if (s.dates && s.dates.length) {
        var spend = ADS.series(s.dates, brKey);
        UI.chart('adTrend', {
          type: 'bar',
          data: {
            labels: s.labels,
            datasets: [
              { label: 'ค่าแอด', data: spend, backgroundColor: '#C7C9F7',
                hoverBackgroundColor: '#8B8DF5', borderRadius: 3, yAxisID: 'y', order: 2 },
              { label: 'ยอดขาย', data: s.net, type: 'line', borderColor: '#F2565A',
                borderWidth: 2.2, pointRadius: 0, tension: 0.28, yAxisID: 'y1', order: 1 },
            ],
          },
          options: {
            scales: {
              x: UI.catAxis,
              y: { position: 'left', grid: { color: '#F1F2F7', drawTicks: false },
                   border: { display: false },
                   ticks: { padding: 8, callback: function (v) { return fmt.bahtK(v); } } },
              y1: { position: 'right', grid: { display: false }, border: { display: false },
                    ticks: { padding: 8, callback: function (v) { return fmt.bahtK(v); } } },
            },
            plugins: {
              legend: { display: true, position: 'bottom',
                labels: { usePointStyle: true, boxWidth: 8, padding: 14 } },
              tooltip: UI.tooltipBaht,
            },
          },
        });
      }

      /* ── ตารางแคมเปญ ─────────────────────────────────────────────── */
      var camps = this._camps || [];
      if (!camps.length) { return; }

      UI.table('adCampTbl', [
        { key: 'name', label: 'แคมเปญ',
          sort: function (r) { return r.c.name; },
          render: function (r) {
            var g = ADS.goal(r.c.goal);
            return '<div class="fname">' + esc(r.c.name) + '</div>' +
              '<div class="fmeta">' + esc(ADS.brName(r.c.br)) +
              ' · <span class="tag ' + g.cls + '">' + esc(g.label) + '</span>' +
              (r.c.st === 'ACTIVE' ? ' <span class="badge-on">กำลังยิง</span>' : '') +
              (r.burn ? ' <span class="tag r">เผาเงิน</span>' : '') + '</div>';  /* r.burn ถูกล้างแล้วเมื่อปิดโหมดวิเคราะห์ */
          } },
        { key: 'spend', label: 'ค่าแอด', num: true,
          render: function (r) { return fmt.baht(r.spend); } },
        { key: 'reach', label: 'ผู้ชม (นับซ้ำ)', num: true,
          render: function (r) { return fmt.int(r.reach); } },
        { key: 'imp', label: 'เห็นกี่ครั้ง', num: true,
          render: function (r) { return fmt.int(r.imp); } },
        { key: 'ctr', label: 'คลิก %', num: true,
          render: function (r) { return fmt.pct(r.ctr, 1); } },
        { key: 'cpm', label: 'ราคา/พันครั้ง', num: true,
          render: function (r) { return fmt.baht(r.cpm); } },
        { key: 'eng', label: 'คนกดโต้ตอบ', num: true,
          render: function (r) { return fmt.int(r.eng); } },
        { key: 'cpe', label: 'ราคา/โต้ตอบ', num: true,
          render: function (r) {
            if (!r.eng) { return '<span style="color:#9AA0B1">—</span>'; }
            return '<span' + (r.burn ? ' style="color:#C43D42;font-weight:700"' : '') + '>' +
              bahtFine(r.cpe) + '</span>';
          } },
      ], camps, { sortKey: 'spend', sortDir: -1 }).mount();
    },
  });

}(window));
