/* KAN ERP — page definitions. Each view returns HTML from render(), then gets
 * an after() call once that HTML is in the DOM to attach charts and tables. */
(function (global) {
  'use strict';

  var KAN = global.KAN, UI = KAN.UI, fmt = KAN.fmt, esc = KAN.esc, D = KAN.D;
  var V = KAN.views = {};
  var order = KAN.viewOrder = [];

  function def(v) { V[v.id] = v; order.push(v.id); return v; }

  function safeDelta(cur, prev) {
    if (prev == null || !prev) { return null; }
    return (cur - prev) / prev;
  }

  function zoneTrustBanner(range) {
    var w = KAN.zoneTrustWarning(range);
    if (!w) { return ''; }
    return UI.banner('warn', 'ตัวเลขระดับโซนในช่วงนี้เชื่อได้บางส่วน', w.text +
      ' <a href="#/quality" style="color:inherit;font-weight:700">ดูรายละเอียด →</a>');
  }

  /* ════════════════════════════════════════════════════════════ ภาพรวม ══ */

  def({
    id: 'overview',
    group: 'ภาพรวมธุรกิจ',
    icon: '▦',
    title: 'ภาพรวมยอดขาย',
    lead: 'ยอดขายจริงจากใบเสร็จ POS ทุกใบ เทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน',

    render: function (range) {
      var b = KAN.branchFilter();
      var cur = KAN.posTotals(range.i0, range.i1, b);
      var prev = range.prev.valid ? KAN.posTotals(range.prev.i0, range.prev.i1, b) : null;
      var bins = KAN.billBins(range.i0, range.i1, b);
      var median = KAN.medianBill(bins);
      var prevMedian = range.prev.valid
        ? KAN.medianBill(KAN.billBins(range.prev.i0, range.prev.i1, b)) : null;

      if (!cur.bills) {
        return UI.empty('ไม่มีใบเสร็จในช่วง ' + range.label + '<br>ลองขยายช่วงวันที่หรือเปลี่ยนสาขา');
      }

      var h = '';
      h += '<div class="scope"><div>ขอบเขต: <b>' + esc(KAN.scopeLabel()) + '</b> · ' +
           esc(range.label) + '</div>' +
           '<div class="days">' + range.days + ' วัน' +
           (range.prev.valid ? ' · เทียบกับ ' + fmt.thDate(range.prev.from) + ' – ' +
             fmt.thDate(range.prev.to) : ' · ไม่เทียบ') + '</div></div>';

      if (cur.hasPartial) {
        h += UI.banner('info', 'วันสุดท้ายยังไม่เต็มวัน',
          'ข้อมูลของวันที่ ' + fmt.thDate(KAN.partialDay) +
          ' ถูกดึงออกมากลางวัน จึงมีบิลไม่ครบทั้งวัน ยอดรวมยังนับวันนี้ตามจริง ' +
          'แต่ค่าเฉลี่ย “ต่อวัน” ทุกตัวในหน้านี้ตัดวันนี้ออกไปแล้ว เพื่อไม่ให้ค่าเฉลี่ยต่ำเกินจริง');
      }

      h += '<div class="kpis">';
      h += UI.kpi({
        label: 'ยอดขายสุทธิ', tone: '', value: fmt.baht(cur.net),
        delta: prev ? safeDelta(cur.net, prev.net) : null,
        sub: fmt.bahtK(cur.perDay) + ' ต่อวัน · ' + cur.days + ' วันที่มีการขาย',
      });
      h += UI.kpi({
        label: 'จำนวนบิล', tone: 'b', value: fmt.int(cur.bills),
        delta: prev ? safeDelta(cur.bills, prev.bills) : null,
        sub: fmt.dec(cur.billsPerDay, 0) + ' บิลต่อวัน',
      });
      h += UI.kpi({
        label: 'ยอดเฉลี่ยต่อบิล', tone: 'g', value: fmt.baht(cur.avgBill),
        delta: prev ? safeDelta(cur.avgBill, prev.avgBill) : null,
        sub: 'ค่าเฉลี่ยถูกดึงสูงโดยบิลใหญ่ ดูมัธยฐานคู่กัน',
      });
      h += UI.kpi({
        label: 'มัธยฐานต่อบิล', tone: 'a', value: fmt.baht(median),
        delta: prevMedian ? safeDelta(median, prevMedian) : null,
        sub: 'ครึ่งหนึ่งของบิลต่ำกว่าค่านี้ · เป้า ฿' + KAN.TARGET_BILL,
      });
      h += UI.kpi({
        label: 'ส่วนลดที่จ่ายไป', tone: 'r', value: fmt.baht(cur.disc),
        delta: prev ? safeDelta(cur.discRate, prev.discRate) : null, invert: true,
        sub: fmt.pct(cur.discRate) + ' ของยอดเต็ม',
      });
      h += '</div>';

      h += '<div class="g2">';
      h += UI.panel({
        eyebrow: 'แนวโน้มรายวัน', title: 'ยอดขายสุทธิต่อวัน',
        titleSub: range.prev.valid ? '(เส้นจาง = ช่วงก่อนหน้า)' : '',
        body: '<div class="chartbox"><canvas id="ovTrend"></canvas></div>',
        foot: 'เส้นทึบคือช่วงที่เลือก เส้นประคือช่วงเปรียบเทียบที่ยาวเท่ากัน — ' +
              'จุดที่สองเส้นห่างกันมากคือวันที่ควรหาสาเหตุ',
      });
      h += UI.panel({
        eyebrow: 'ขนาดบิล', title: 'บิลกระจุกอยู่ตรงไหน',
        body: '<div class="chartbox"><canvas id="ovBins"></canvas></div>',
        foot: 'แท่งสูงทางซ้าย = ลูกค้าซื้อทีละน้อย ซึ่งเป็นโจทย์ของโปรโมชันแบบตั้งเกณฑ์ยอด',
      });
      h += '</div>';

      if (KAN.branchFilter() == null) {
        h += UI.sect({
          id: 'branches', eyebrow: 'เทียบสาขา', title: 'สาขาไหนพาไปข้างหน้า สาขาไหนถ่วงอยู่',
          lead: 'เรียงตามยอดขายในช่วงที่เลือก ตัวเลข % คือการเปลี่ยนแปลงเทียบช่วงก่อนหน้า',
          body: this.branchCards(range),
        });
      }

      h += UI.sect({
        id: 'zones', eyebrow: 'แผนกสินค้า', title: 'ยอดขายแยกตามโซน',
        lead: 'มาจากชีตสรุปรายวัน ซึ่งเป็นแหล่งเดียวที่แยกโซนได้',
        body: zoneTrustBanner(range) +
          '<div class="g2">' +
          UI.panel({
            eyebrow: 'สัดส่วน', title: 'โซนที่ทำเงินสูงสุด',
            body: '<div class="chartbox"><canvas id="ovZones"></canvas></div>',
          }) +
          UI.panel({
            eyebrow: 'รายละเอียด', title: 'อันดับโซน',
            body: '<div id="ovZoneLegend" class="legend"></div>',
          }) +
          '</div>',
      });

      return h;
    },

    branchCards: function (range) {
      var cur = KAN.posByBranch(range.i0, range.i1);
      var prev = range.prev.valid ? KAN.posByBranch(range.prev.i0, range.prev.i1) : null;
      var stores = KAN.storeIndexes.filter(function (i) { return cur[i].net > 0; });
      var max = Math.max.apply(null, stores.map(function (i) { return cur[i].net; }).concat([1]));
      var total = stores.reduce(function (a, i) { return a + cur[i].net; }, 0);

      stores.sort(function (a, b) { return cur[b].net - cur[a].net; });

      var h = '<div class="branches">';
      stores.forEach(function (bi, n) {
        var c = cur[bi], p = prev ? prev[bi] : null;
        var d = p ? safeDelta(c.net, p.net) : null;
        var db = p ? safeDelta(c.bills, p.bills) : null;
        var da = p ? safeDelta(c.avgBill, p.avgBill) : null;
        var tone = d == null ? '' : (d > 0.02 ? 'g' : d < -0.05 ? 'r' : 'a');
        h += '<div class="branch">' +
          '<div class="bh"><div class="rank">' + (n + 1) + '</div><div><b>' +
            esc(KAN.branchName(bi)) + '</b><small>' + fmt.pct(c.net / (total || 1), 0) +
            ' ของยอดรวม · ' + c.nDays + ' วันที่ขาย</small></div></div>' +
          '<div class="amt">' + fmt.bahtK(c.net) +
            (d == null ? '' : '<span class="delta ' + fmt.deltaClass(d) + '">' + fmt.delta(d) + '</span>') +
          '</div>' +
          '<div class="bar"><i class="' + tone + '" style="width:' +
            (c.net / max * 100).toFixed(1) + '%"></i></div>' +
          '<div class="bstats">' +
            '<div><small>บิล</small><b>' + fmt.int(c.bills) + '</b>' + UI.deltaSpan(db) + '</div>' +
            '<div><small>฿/บิล</small><b>' + fmt.baht(c.avgBill) + '</b>' + UI.deltaSpan(da) + '</div>' +
            '<div><small>฿/วัน</small><b>' + fmt.bahtK(c.perDay) + '</b></div>' +
          '</div></div>';
      });
      return h + '</div>';
    },

    after: function (range) {
      var b = KAN.branchFilter();
      var s = KAN.posSeries(range.i0, range.i1, b);
      var ds = [{
        label: 'ช่วงที่เลือก', data: s.net, borderColor: '#F2565A', borderWidth: 2.4,
        pointRadius: 0, pointHoverRadius: 4, tension: 0.28, fill: true,
        backgroundColor: 'rgba(242,86,90,.10)',
      }];
      if (range.prev.valid) {
        var p = KAN.posSeries(range.prev.i0, range.prev.i1, b);
        ds.push({
          label: 'ช่วงก่อนหน้า', data: p.net, borderColor: '#C9CCDA', borderWidth: 1.8,
          borderDash: [5, 4], pointRadius: 0, tension: 0.28, fill: false,
        });
      }
      /* ชี้วันไหน บอกด้วยว่าวันนั้นสินค้าตัวไหนทำยอดสูงสุด — ตัวเลขรวมอย่างเดียว
         บอกแค่ว่า "วันนี้ดี" แต่ไม่บอกว่าดีเพราะอะไร */
      var baseTip = range.prev.valid ? UI.tooltipCompare : UI.tooltipBaht;
      var trendTip = {
        callbacks: {
          label: baseTip.callbacks.label,
          footer: baseTip.callbacks.footer,
          afterBody: function (items) {
            if (!KAN.hasSkuData || !items || !items.length) { return ''; }
            var t = KAN.topSkuOfDay(range.i0 + items[0].dataIndex, b);
            if (!t) { return ''; }
            var share = t.dayNet ? ' · ' + fmt.pct(t.net / t.dayNet, 0) + ' ของวันนั้น' : '';
            return ['', 'ขายดีสุด: ' + t.name,
                    '        ' + fmt.baht(t.net) + ' · ' + fmt.int(t.qty) + ' ชิ้น' + share];
          },
        },
      };
      UI.chart('ovTrend', {
        type: 'line',
        data: { labels: s.labels, datasets: ds },
        options: {
          scales: { y: UI.bahtAxis, x: UI.catAxis },
          plugins: {
            tooltip: trendTip,
            legend: { display: range.prev.valid, position: 'bottom' },
          },
        },
      });

      var bins = KAN.billBins(range.i0, range.i1, b);
      UI.chart('ovBins', {
        type: 'bar',
        data: {
          labels: D.billBins,
          datasets: [{
            data: bins.map(function (x) { return x.bills; }),
            backgroundColor: bins.map(function (x, i) { return i <= 4 ? '#F8ABAB' : '#F2565A'; }),
            borderRadius: 5, borderSkipped: false,
          }],
        },
        options: {
          scales: {
            y: { grid: { color: '#F1F2F7' }, border: { display: false },
                 ticks: { callback: function (v) { return fmt.int(v); } } },
            x: UI.catAxis,
          },
          plugins: {
            tooltip: { callbacks: { label: function (c) {
              var row = bins[c.dataIndex];
              return ['  ' + fmt.int(row.bills) + ' บิล', '  ยอดรวม ' + fmt.baht(row.net)];
            } } },
          },
        },
      });

      var zones = KAN.zoneTotals(range.i0, range.i1, b).filter(function (z) { return z.net > 0; });
      var top = zones.slice(0, 9);
      var rest = zones.slice(9);
      if (rest.length) {
        top.push({ name: 'อื่น ๆ (' + rest.length + ' โซน)',
                   net: rest.reduce(function (a, z) { return a + z.net; }, 0), qty: 0 });
      }
      var totalZone = zones.reduce(function (a, z) { return a + z.net; }, 0);
      UI.chart('ovZones', {
        type: 'doughnut',
        data: {
          labels: top.map(function (z) { return z.name; }),
          datasets: [{
            data: top.map(function (z) { return z.net; }),
            backgroundColor: KAN.PALETTE, borderWidth: 2, borderColor: '#fff',
          }],
        },
        options: {
          cutout: '58%',
          plugins: { tooltip: { callbacks: { label: function (c) {
            return '  ' + fmt.baht(c.parsed) + ' (' + fmt.pct(c.parsed / (totalZone || 1), 1) + ')';
          } } } },
        },
      });

      var lg = document.getElementById('ovZoneLegend');
      if (lg) {
        lg.innerHTML = top.length ? top.map(function (z, i) {
          return '<div class="li"><span class="sw" style="background:' +
            KAN.PALETTE[i % KAN.PALETTE.length] + '"></span>' +
            '<span class="nm"><b>' + esc(z.name) + '</b><small>' +
            (z.qty ? fmt.int(z.qty) + ' ชิ้น' : 'รวมหลายโซน') + '</small></span>' +
            '<span class="amt">' + fmt.bahtK(z.net) + '<br><small style="color:#9AA0B1;font-weight:400">' +
            fmt.pct(z.net / (totalZone || 1), 1) + '</small></span></div>';
        }).join('') : '<div style="color:#9AA0B1;padding:20px 0">ไม่มีข้อมูลโซนในช่วงนี้</div>';
      }
    },
  });

  /* ══════════════════════════════════════════════════ สาขาและแผนก ══ */

  def({
    id: 'branch',
    group: 'ภาพรวมธุรกิจ',
    icon: '🏬',
    title: 'สาขาและแผนก',
    lead: 'สุขภาพของทุกโซนสินค้าในแต่ละสาขา เรียงจากตัวที่ต้องรีบดูก่อน',

    render: function (range) {
      var b = KAN.branchFilter();
      var cur = KAN.zoneTotals(range.i0, range.i1, b);
      var prevMap = {};
      if (range.prev.valid) {
        KAN.zoneTotals(range.prev.i0, range.prev.i1, b).forEach(function (z) {
          prevMap[z.zone] = z;
        });
      }

      if (!cur.length) {
        return zoneTrustBanner(range) +
          UI.empty('ชีตสรุปไม่มีข้อมูลโซนในช่วง ' + range.label +
            '<br>ลองเลือกช่วงก่อนกลางเดือนมิถุนายน 2569 ซึ่งข้อมูลยังครบ');
      }

      var rows = cur.map(function (z) {
        var p = prevMap[z.zone];
        return {
          name: z.name, zone: z.zone,
          net: z.net, perDay: z.perDay, qty: z.qty, disc: z.disc,
          dNet: p ? safeDelta(z.net, p.net) : null,
          dQty: p ? safeDelta(z.qty, p.qty) : null,
          discRate: z.gross ? z.disc / z.gross : 0,
          share: 0,
        };
      });
      var total = rows.reduce(function (a, r) { return a + r.net; }, 0);
      rows.forEach(function (r) { r.share = total ? r.net / total : 0; });

      var falling = rows.filter(function (r) { return r.dNet != null && r.dNet < -0.15 && r.net > 0; })
        .sort(function (a, b2) { return (a.dNet * a.net) - (b2.dNet * b2.net); });
      var rising = rows.filter(function (r) { return r.dNet != null && r.dNet > 0.15; })
        .sort(function (a, b2) { return b2.dNet * b2.net - a.dNet * a.net; });

      var h = '';
      h += '<div class="scope"><div>ขอบเขต: <b>' + esc(KAN.scopeLabel()) + '</b> · ' +
           esc(range.label) + '</div><div class="days">' + rows.length + ' โซน</div></div>';
      h += zoneTrustBanner(range);

      h += '<div class="kpis">';
      h += UI.kpi({ label: 'ยอดขายรวมทุกโซน', value: fmt.baht(total),
        sub: 'จากชีตสรุปรายวัน (ไม่ใช่ตัวเลขใบเสร็จ)' });
      h += UI.kpi({ label: 'โซนที่ยอดตก', tone: 'r', value: fmt.int(falling.length),
        sub: falling.length ? 'ตกเกิน 15% เทียบช่วงก่อน' : 'ไม่มีโซนที่ตกแรง' });
      h += UI.kpi({ label: 'โซนที่ยอดขึ้น', tone: 'g', value: fmt.int(rising.length),
        sub: rising.length ? 'ขึ้นเกิน 15% เทียบช่วงก่อน' : 'ยังไม่มีโซนที่โตชัด' });
      h += UI.kpi({ label: 'ส่วนลดรวม', tone: 'a',
        value: fmt.baht(rows.reduce(function (a, r) { return a + r.disc; }, 0)),
        sub: 'เฉลี่ย ' + fmt.pct(rows.reduce(function (a, r) { return a + r.discRate * r.net; }, 0) / (total || 1)) + ' ของยอด' });
      h += '</div>';

      if (falling.length) {
        h += UI.sect({
          id: 'attention', eyebrow: 'ต้องดูก่อน', title: 'โซนที่เสียยอดมากที่สุด',
          lead: 'เรียงตามจำนวนเงินที่หายไปจริง ไม่ใช่แค่ % ที่ตก — ' +
                'โซนเล็กที่ตก 50% เสียเงินน้อยกว่าโซนใหญ่ที่ตก 15%',
          body: '<div class="actions">' + falling.slice(0, 3).map(function (r, i) {
            var lost = r.dNet * r.net / (1 + r.dNet);
            return '<div class="act">' +
              '<div class="no"><span>#' + (i + 1) + '</span>' +
              '<span class="tag r">ยอดตก ' + fmt.delta(r.dNet) + '</span></div>' +
              '<div class="br">' + esc(KAN.scopeLabel()) + '</div>' +
              '<h4>' + esc(r.name) + '</h4>' +
              '<div class="mini3">' +
                '<div class="mini"><small>ยอดช่วงนี้</small><b>' + fmt.bahtK(r.net) + '</b></div>' +
                '<div class="mini"><small>ต่อวัน</small><b>' + fmt.bahtK(r.perDay) + '</b></div>' +
                '<div class="mini"><small>ชิ้นที่ขาย</small><b>' + fmt.int(r.qty) + '</b>' +
                  UI.deltaSpan(r.dQty) + '</div>' +
              '</div>' +
              '<div class="prob"><b>เกิดอะไรขึ้น</b>ยอดหายไปราว ' + fmt.bahtK(Math.abs(lost)) +
                ' เทียบกับช่วงก่อนหน้า' +
                (r.dQty != null && r.dQty < r.dNet - 0.03
                  ? ' โดยจำนวนชิ้นตกน้อยกว่ายอดเงิน แปลว่าราคาขายเฉลี่ยลดลง — ตรวจว่าลดราคาลึกเกินไปหรือเปล่า'
                  : r.dQty != null && r.dQty > r.dNet + 0.03
                    ? ' โดยยอดเงินตกแรงกว่าจำนวนชิ้น แปลว่าขายของถูกลงแทนของแพง'
                    : ' ทั้งจำนวนชิ้นและยอดเงินตกไปพร้อมกัน คือคนซื้อน้อยลงจริง') +
              '</div>' +
              '<div class="rec"><b>ทำอะไรต่อ</b>เช็กก่อนว่าเป็นเพราะของขาดหรือคนซื้อน้อยลง ' +
                'ที่หน้า “สินค้าเข้า–ออก” ดูว่าโซนนี้ของยังเหลือพอขายกี่วัน ' +
                'ถ้าของเหลือเยอะแต่ขายไม่ออก ค่อยไปหน้าโปรโมชัน</div>' +
              '</div>';
          }).join('') + '</div>',
        });
      }

      h += UI.sect({
        id: 'diag', eyebrow: 'ตารางเต็ม', title: 'สุขภาพทุกโซน',
        lead: 'คลิกหัวคอลัมน์เพื่อเรียงใหม่',
        body: UI.panel({ body: UI.tableShell('brTable') }),
      });
      this._rows = rows;
      return h;
    },

    after: function () {
      var rows = this._rows || [];
      var maxNet = Math.max.apply(null, rows.map(function (r) { return r.net; }).concat([1]));
      UI.table('brTable', [
        { key: 'name', label: 'โซนสินค้า',
          render: function (r) {
            return '<div class="dept"><b>' + esc(r.name) + '</b><small>' +
              fmt.pct(r.share, 1) + ' ของยอดรวม</small></div>';
          } },
        { key: 'net', label: 'ยอดขาย', num: true,
          render: function (r) {
            return UI.miniBar(r.net / maxNet) + fmt.bahtK(r.net);
          } },
        { key: 'perDay', label: '฿ ต่อวัน', num: true,
          render: function (r) { return fmt.bahtK(r.perDay); } },
        { key: 'dNet', label: 'เทียบช่วงก่อน', num: true,
          render: function (r) { return UI.deltaSpan(r.dNet); } },
        { key: 'qty', label: 'ชิ้นที่ขาย', num: true,
          render: function (r) { return fmt.int(r.qty); } },
        { key: 'dQty', label: 'ชิ้น เทียบช่วงก่อน', num: true,
          render: function (r) { return UI.deltaSpan(r.dQty); } },
        { key: 'discRate', label: 'ส่วนลด', num: true,
          render: function (r) { return fmt.pct(r.discRate); } },
      ], rows, { sortKey: 'net', sortDir: -1 }).mount();
    },
  });

  /* ═════════════════════════════════════════════ สินค้าเข้า–ออก ══ */

  def({
    id: 'velocity',
    group: 'สินค้าและสต็อก',
    icon: '📦',
    title: 'สินค้าเข้า–ออก',
    lead: 'ของเข้ามาเท่าไร ออกไปเท่าไร เหลือเท่าไร และตัวไหนค้าง',

    /* Page-local controls, kept outside the global filter bar. */
    ctl: { pct: 0.30, grade: 'all', scope: 'sales' },

    render: function (range) {
      var b = KAN.branchFilter();
      var self = this;
      var wide = this.ctl.scope === 'all';
      var rows = KAN.velocity(range.i0, range.i1, b, this.ctl.pct,
        { includeWarehouse: wide, includeBackroom: wide });
      this._rows = rows;

      var totalClosingValue = rows.reduce(function (a, r) { return a + r.closingValue; }, 0);
      var totalIn = rows.reduce(function (a, r) { return a + r.inQty; }, 0);
      var totalOut = rows.reduce(function (a, r) { return a + r.outQty; }, 0);
      var totalBase = rows.reduce(function (a, r) { return a + r.base; }, 0);
      var overallST = totalBase ? totalOut / totalBase : 0;
      /* Only rows from branches whose sales feed reconciles can be graded — a
       * "0 dead zones" headline built on unreadable data reads as good news. */
      var gradable = rows.filter(function (r) { return r.trusted; });
      var deadRows = gradable.filter(function (r) { return r.grade.key === 'dead'; });
      var deadValue = deadRows.reduce(function (a, r) { return a + r.closingValue; }, 0);
      var blind = rows.length - gradable.length;
      /* Median over every zone that has an answer — including the projected
       * ones. Restricting it to zones that hit the target inside the window
       * would quietly report only the fastest movers. */
      var answered = gradable.filter(function (r) { return r.daysToPct != null; });
      var reached = answered.filter(function (r) { return !r.projected; });
      var medDays = answered.length
        ? answered.map(function (r) { return r.daysToPct; })
            .sort(function (x, y) { return x - y; })[Math.floor(answered.length / 2)]
        : null;

      var h = '';
      h += '<div class="scope"><div>ขอบเขต: <b>' + esc(KAN.scopeLabel()) + '</b> · ' +
           esc(range.label) + '</div><div class="days">' + range.days + ' วัน · ' +
           rows.length + ' โซน</div></div>';

      /* ตัวเลขสต็อกหยุดเดินตั้งแต่ 25 ส.ค. 69 — ระบบสต็อกจริงย้ายไป Odoo แล้ว
       * หน้านี้จึงเป็นภาพนิ่ง ณ วันนั้น ต้องบอกให้ชัดก่อนอย่างอื่น ไม่ใช่ปล่อยให้
       * คนอ่านเข้าใจว่าเป็นของวันนี้ */
      if (D.meta && D.meta.stockEnd) {
        h += UI.banner('warn', 'ข้อมูลสต็อกหยุดอัปเดตแล้ว',
          'ตัวเลขของเข้า–ออกและของค้างในหน้านี้เป็นภาพ ณ <b>' +
          esc(fmt.thDate(D.meta.stockEnd)) + '</b> ระบบสต็อกจริงย้ายไปทำที่ Odoo แล้ว ' +
          'ไม่ได้อัปเดตต่อที่นี่ · ยอดขายรายวันในหน้าอื่นยังเดินถึง <b>' +
          esc(fmt.thDate(D.meta.dataEnd)) + '</b> ตามปกติ — ' +
          'เวลาเลือกช่วงเวลาหลัง ' + esc(fmt.thDate(D.meta.stockEnd)) +
          ' หน้านี้จะดูเหมือนของไม่เข้าไม่ออก เพราะไม่มีข้อมูล ไม่ใช่เพราะของนิ่ง');
      }

      h += UI.banner('info', 'วิธีอ่านหน้านี้',
        '<b style="display:inline">ของที่มีให้ขาย</b> = สต็อกต้นงวด + ของที่เข้ามาระหว่างงวด · ' +
        '<b style="display:inline">% ที่ออก</b> = ขายออกไปกี่ % ของก้อนนั้น · ' +
        '<b style="display:inline">วันถึง ' + fmt.pct(this.ctl.pct, 0) + '</b> = ' +
        'ใช้เวลากี่วันกว่าจะระบายได้ตามสัดส่วนที่ตั้งไว้ — ' +
        'ถ้าขึ้นเครื่องหมาย ~ แปลว่ายังไปไม่ถึงในช่วงที่เลือก ตัวเลขเป็นการประมาณจากอัตราขายปัจจุบัน · ' +
        'การจัดกลุ่มความเร็วตัดสินจาก “ของพอขายอีกกี่วัน” ไม่ใช่ % ที่ออก เพราะสต็อกร้านนี้ปกติหมุน ' +
        'เป็นหลักเดือน การดูแค่ 30 วันจะทำให้ทุกโซนดูเหมือนขายไม่ออกไปหมด');

      var coverage = KAN.branchCoverage(range.i0, range.i1);
      var untrusted = coverage.filter(function (c) {
        return c.kind === 'store' && !c.trusted && c.posNet > 0 &&
               (b == null || c.branch === b);
      });
      if (untrusted.length) {
        var safe = KAN.lastTrustedWindow(range.days) || KAN.lastTrustedWindow(30);
        h += UI.banner('err', 'บางสาขายังสรุปความเร็วสินค้าไม่ได้ในช่วงนี้',
          untrusted.map(function (c) {
            return '<b style="display:inline">' + esc(c.name) + '</b> — ใบเสร็จจริง ' +
              fmt.bahtK(c.posNet) + ' แต่ชีตสรุปลงไว้ ' + fmt.bahtK(c.sheetNet) +
              ' คิดเป็น ' + fmt.pct(c.ratio || 0, 0) + ' ' +
              (c.direction === 'under' ? '(ลงไม่ครบ)' : '(ลงเกิน เพราะรับยอดของสาขาอื่นมาด้วย)');
          }).join('<br>') +
          '<br><br>ยอด “ของออก” ของสาขาเหล่านี้จึงไม่ตรงความจริง ถ้าปล่อยให้ระบบตัดสิน ' +
          'โซนที่ลงไม่ครบจะถูกตีว่า “ค้างสต็อก” ทั้งที่อาจขายดี ส่วนโซนที่ลงเกินจะดูหมุนเร็วกว่าจริง — ' +
          'ระบบจึงพักการให้เกรดของสาขาเหล่านี้ไว้ก่อน และไม่นำไปออกข้อเสนอโปรโมชัน' +
          (safe
            ? '<br><br><button class="btn" id="vSafeRange" style="margin-top:4px">' +
              'ดูช่วงที่ข้อมูลครบ: ' + fmt.thDate(safe.from) + ' – ' + fmt.thDate(safe.to) +
              '</button>'
            : ''));
        this._safeRange = safe;
      } else {
        this._safeRange = null;
      }

      if (!wide) {
        h += UI.banner('warn', 'ตัวเลขนี้ตัดอะไรออกไปบ้าง',
          'ตารางนี้นับเฉพาะ<b style="display:inline">โซนขายหน้าร้านของ 3 สาขา</b>เท่านั้น — ' +
          'ตัด KAN HUB (เป็นคลัง ไม่มีหน้าร้าน และสต็อกตั้งต้นในไฟล์ยังผิดอยู่) ' +
          'กับสต๊อกหลังร้านที่ชั่งเป็นกิโล รวมถึงรายการที่ไม่ใช่สินค้าอย่างค่าถุงและคูปองออก ' +
          'ถ้าไม่ตัด รายการพวกนี้จะขึ้นเป็น “ค้างสต็อก” อันดับต้น ๆ ทั้งที่ไม่ได้ตั้งขายจริง · ' +
          'สลับเป็น “รวมคลังและสต๊อกหลังร้าน” ด้านล่างได้ถ้าต้องการดูทั้งหมด');
      }

      h += '<div class="kpis">';
      h += UI.kpi({ label: 'มูลค่าสต็อกคงเหลือ', value: fmt.bahtK(totalClosingValue),
        sub: 'คิดที่<b>ราคาขาย</b> ไม่ใช่ราคาทุน จึงสูงกว่าตัวเลขมูลค่าสต๊อกในไฟล์ Excel ราวเท่าตัว' });
      h += UI.kpi({ label: 'ของออกไปแล้ว', tone: 'g', value: fmt.pct(overallST, 0),
        sub: fmt.int(totalOut) + ' จาก ' + fmt.int(totalBase) + ' ชิ้นที่มีให้ขาย' +
          (blind ? ' · รวมสาขาที่ข้อมูลไม่ครบด้วย ตัวเลขจริงน่าจะสูงกว่านี้' : '') });
      h += UI.kpi({ label: 'ของเข้าใหม่', tone: 'b', value: fmt.int(totalIn),
        sub: 'ชิ้น ในช่วง ' + range.days + ' วัน' });
      h += UI.kpi({ label: 'โซนที่ค้างสต็อก', tone: 'r',
        value: gradable.length ? fmt.int(deadRows.length) : 'ประเมินไม่ได้',
        sub: !gradable.length
          ? 'ทุกสาขาในช่วงนี้ข้อมูลยอดขายไม่ครบ จึงยังตัดสินไม่ได้ว่าโซนไหนค้าง'
          : (deadValue > 0 ? 'จมอยู่ ' + fmt.bahtK(deadValue) : 'ไม่มีโซนที่ค้าง') +
            (blind ? ' · อีก ' + blind + ' โซนประเมินไม่ได้' : '') });
      h += UI.kpi({ label: 'ค่ากลาง วันถึง ' + fmt.pct(this.ctl.pct, 0), tone: 'a',
        value: medDays == null ? 'ประเมินไม่ได้' : fmt.days(medDays) + ' วัน',
        sub: medDays == null
          ? (gradable.length ? 'ยังไม่มีโซนไหนคำนวณได้ในช่วงนี้'
                             : 'ต้องมีข้อมูลยอดขายที่ครบก่อนถึงจะตอบได้')
          : 'ครึ่งหนึ่งของ ' + answered.length + ' โซนใช้เวลาน้อยกว่านี้ · ในนั้น ' +
            reached.length + ' โซนถึงเป้าจริงในช่วงที่เลือก ที่เหลือเป็นค่าประมาณ' });
      h += '</div>';

      /* controls */
      h += '<div class="panel" style="margin-top:12px">' +
        '<div class="controls">' +
        '<div class="ctl range"><label>ตั้งเป้า % ที่อยากให้ของออก ' +
          '<span class="rv" id="vPctLbl">' + fmt.pct(this.ctl.pct, 0) + '</span></label>' +
          '<input type="range" id="vPct" min="5" max="95" step="5" value="' +
          Math.round(this.ctl.pct * 100) + '"></div>' +
        '<div class="ctl"><label>กรองตามความเร็ว</label><select id="vGrade">' +
          '<option value="all">ทุกกลุ่ม</option>' +
          '<option value="dead">ค้างสต็อก</option>' +
          '<option value="slow">ออกช้า</option>' +
          '<option value="ok">ปกติ</option>' +
          '<option value="fast">ออกเร็ว</option>' +
        '</select></div>' +
        '<div class="ctl"><label>ขอบเขต</label><select id="vScope">' +
          '<option value="sales">เฉพาะโซนขายหน้าร้าน</option>' +
          '<option value="all">รวมคลังและสต๊อกหลังร้าน</option>' +
        '</select></div>' +
        '<div class="ctl" style="flex:1;min-width:220px"><label>&nbsp;</label>' +
          '<div style="font-size:12px;color:#5B6172;line-height:1.5;padding-bottom:8px">' +
          'เลื่อนแถบเพื่อถามกลับด้าน: “ของกลุ่มนี้ออก ' + fmt.pct(this.ctl.pct, 0) +
          ' ภายในกี่วัน” คำตอบอยู่คอลัมน์สุดท้ายของตาราง</div></div>' +
        '</div>' +
        '<div class="chartbox lg"><canvas id="vChart"></canvas></div>' +
        '<div class="finept">แท่งคือ % ที่ออกไปในช่วงที่เลือก · เส้นประคือเป้าที่ตั้งไว้ที่ ' +
          fmt.pct(this.ctl.pct, 0) + '</div>' +
        '</div>';

      var grades = ['dead', 'slow', 'ok', 'fast'];
      h += '<div class="segs">' + grades.map(function (g) {
        var set = gradable.filter(function (r) { return r.grade.key === g; });
        var val = set.reduce(function (a, r) { return a + r.closingValue; }, 0);
        var G = KAN.GRADES[g];
        var color = g === 'dead' ? '#DC2626' : g === 'slow' ? '#B45309' : g === 'ok' ? '#16A34A' : '#2563EB';
        return '<div class="seg"><div class="st"><span class="dotc" style="background:' + color +
          '"></span>' + esc(G.label) + '</div>' +
          '<div class="sn">' + fmt.int(set.length) + ' <span style="font-size:13px;color:#9AA0B1">โซน</span></div>' +
          '<div class="ss">' + esc(G.hint) + '<br>มูลค่าคงเหลือ ' + fmt.bahtK(val) + '</div></div>';
      }).join('') + '</div>';

      h += UI.sect({
        id: 'vtable', eyebrow: 'ตารางเต็ม', title: 'ทุกโซน เรียงตามมูลค่าที่ค้างอยู่',
        lead: 'คลิกหัวคอลัมน์เพื่อเรียงใหม่ · แถวที่ติดป้ายแดงคือของที่ควรรีบระบาย',
        body: UI.panel({ body: UI.tableShell('vTable') }),
      });

      return h;
    },

    after: function (range) {
      var self = this;
      var rows = this._rows || [];

      var pctEl = document.getElementById('vPct');
      if (pctEl) {
        pctEl.addEventListener('input', function () {
          document.getElementById('vPctLbl').textContent = this.value + '%';
        });
        pctEl.addEventListener('change', function () {
          self.ctl.pct = +this.value / 100;
          KAN.rerender();
        });
      }
      var safeBtn = document.getElementById('vSafeRange');
      if (safeBtn && this._safeRange) {
        var sr = this._safeRange;
        safeBtn.addEventListener('click', function () {
          KAN.state.preset = 'custom';
          KAN.state.from = sr.from;
          KAN.state.to = sr.to;
          KAN.rerender();
        });
      }

      [['vGrade', 'grade'], ['vScope', 'scope']].forEach(function (pair) {
        var el = document.getElementById(pair[0]);
        if (!el) { return; }
        el.value = self.ctl[pair[1]];
        el.addEventListener('change', function () {
          self.ctl[pair[1]] = this.value;
          KAN.rerender();
        });
      });

      var shown = this.ctl.grade === 'all'
        ? rows
        : rows.filter(function (r) { return r.grade.key === self.ctl.grade; });

      var chartRows = shown.slice()
        .filter(function (r) { return r.sellThrough != null; })
        .sort(function (a, b) { return b.base - a.base; })
        .slice(0, 14);

      UI.chart('vChart', {
        type: 'bar',
        data: {
          labels: chartRows.map(function (r) {
            return r.name + (KAN.branchFilter() == null ? ' · ' + KAN.D.branches[r.branch].short : '');
          }),
          datasets: [{
            data: chartRows.map(function (r) { return r.sellThrough * 100; }),
            backgroundColor: chartRows.map(function (r) {
              return r.grade.key === 'dead' ? '#EF4444'
                : r.grade.key === 'slow' ? '#F59E0B'
                : r.grade.key === 'fast' ? '#2563EB' : '#16A34A';
            }),
            borderRadius: 5, borderSkipped: false,
          }],
        },
        options: {
          indexAxis: 'y',
          scales: {
            x: { grid: { color: '#F1F2F7' }, border: { display: false }, max: 100,
                 ticks: { callback: function (v) { return v + '%'; } } },
            y: { grid: { display: false }, border: { display: false },
                 ticks: { font: { size: 11 } } },
          },
          plugins: {
            tooltip: { callbacks: { label: function (c) {
              var r = chartRows[c.dataIndex];
              return ['  ออกไป ' + fmt.pct(r.sellThrough, 1),
                      '  ขาย ' + fmt.int(r.outQty) + ' / มีให้ขาย ' + fmt.int(r.base) + ' ชิ้น',
                      '  เหลือ ' + fmt.int(r.closing) + ' ชิ้น (' + fmt.bahtK(r.closingValue) + ')'];
            } } },
            annotation: false,
          },
        },
      });

      var maxVal = Math.max.apply(null, rows.map(function (r) { return r.closingValue; }).concat([1]));
      UI.table('vTable', [
        { key: 'name', label: 'โซนสินค้า',
          render: function (r) {
            return '<div class="dept"><b>' + esc(r.name) + '</b><small>' +
              esc(KAN.branchName(r.branch)) +
              (r.trusted ? '' : ' · <span style="color:#DC2626">ข้อมูลขายไม่ครบ</span>') +
              '</small></div>';
          } },
        { key: 'grade', label: 'ความเร็ว', sort: function (r) {
            return { dead: 0, slow: 1, ok: 2, fast: 3, na: -1 }[r.grade.key];
          },
          render: function (r) { return UI.pill(r.grade); } },
        { key: 'openQty', label: 'ต้นงวด', num: true,
          render: function (r) { return fmt.int(r.openQty); } },
        { key: 'inQty', label: 'เข้า', num: true,
          render: function (r) { return r.inQty ? '+' + fmt.int(r.inQty) : '—'; } },
        { key: 'outQty', label: 'ออก', num: true,
          render: function (r) { return r.outQty ? '−' + fmt.int(r.outQty) : '—'; } },
        { key: 'closing', label: 'คงเหลือ', num: true,
          render: function (r) { return fmt.int(r.closing); } },
        { key: 'sellThrough', label: '% ที่ออก', num: true,
          render: function (r) {
            if (r.sellThrough == null) { return '—'; }
            return UI.miniBar(r.sellThrough,
              r.grade.key === 'dead' ? '#EF4444' : r.grade.key === 'slow' ? '#F59E0B' : '#16A34A') +
              fmt.pct(r.sellThrough, 0);
          } },
        { key: 'daysToPct', label: 'วันถึงเป้า', num: true,
          render: function (r) {
            if (r.daysToPct == null) { return '<span style="color:#DC2626">ไม่ถึง</span>'; }
            return (r.projected ? '~' : '') + fmt.days(r.daysToPct) + ' วัน';
          } },
        { key: 'dsi', label: 'ของพอขายอีก', num: true,
          render: function (r) {
            if (r.dsi == null || !isFinite(r.dsi)) { return '<span style="color:#DC2626">ไม่ขยับ</span>'; }
            return fmt.days(r.dsi) + ' วัน';
          } },
        { key: 'closingValue', label: 'มูลค่าค้าง', num: true,
          render: function (r) {
            return UI.miniBar(r.closingValue / maxVal, '#F2565A') + fmt.bahtK(r.closingValue);
          } },
      ], shown, { sortKey: 'closingValue', sortDir: -1 }).mount();
    },
  });

  /* ═══════════════════════════════════════════════════ โปรโมชัน ══ */

  def({
    id: 'promo',
    group: 'การตลาด',
    icon: '🎯',
    title: 'ข้อเสนอโปรโมชัน',
    lead: 'ข้อเสนอที่คำนวณจากข้อมูลจริง แยกตามสาขา แผนก และกลุ่มลูกค้า',

    render: function (range) {
      var b = KAN.branchFilter();
      var totals = KAN.posTotals(range.i0, range.i1, b);
      if (!totals.bills) {
        return UI.empty('ไม่มีใบเสร็จในช่วงที่เลือก จึงยังแนะนำโปรโมชันไม่ได้');
      }
      var bins = KAN.billBins(range.i0, range.i1, b);
      var ctx = {
        range: range, branch: b, scopeLabel: KAN.scopeLabel(),
        totals: totals,
        billBins: bins,
        median: KAN.medianBill(bins),
        discBins: KAN.discBins(range.i0, range.i1, b),
        heat: KAN.hourDowMatrix(range.i0, range.i1, b),
        velocity: KAN.velocity(range.i0, range.i1, b, 0.30),
        segments: KAN.customerSegments(range.i0, range.i1, b),
      };
      this._ctx = ctx;
      var ideas = KAN.suggest(ctx);

      var h = '';
      h += '<div class="scope"><div>ขอบเขต: <b>' + esc(KAN.scopeLabel()) + '</b> · ' +
           esc(range.label) + '</div><div class="days">' + ideas.length + ' ข้อเสนอ</div></div>';

      h += '<div class="kpis">';
      h += UI.kpi({ label: 'มัธยฐานต่อบิล', tone: 'a', value: fmt.baht(ctx.median),
        sub: 'เป้าที่ตั้งไว้ ฿' + KAN.TARGET_BILL });
      h += UI.kpi({ label: 'ส่วนลดที่จ่ายไป', tone: 'r', value: fmt.bahtK(totals.disc),
        sub: fmt.pct(totals.discRate) + ' ของยอดเต็ม' });
      h += UI.kpi({ label: 'ลูกค้าที่มีเบอร์', tone: 'b', value: fmt.int(ctx.segments.total),
        sub: 'ติดตามซ้ำได้ · ยอดรวม ' + fmt.bahtK(ctx.segments.totalSpend) });
      h += UI.kpi({ label: 'โซนที่ค้างสต็อก', tone: 'r',
        value: fmt.int(ctx.velocity.filter(function (v) { return v.grade.key === 'dead'; }).length),
        sub: 'ต้องระบายก่อนจะเสียมูลค่าไปมากกว่านี้' });
      h += '</div>';

      h += UI.sect({
        id: 'ideas', eyebrow: 'ข้อเสนอ', title: 'ทำอะไรก่อน',
        lead: 'เรียงตามผลกระทบที่ประเมินได้ ทุกใบบอกที่มาของตัวเลขและสมมติฐานไว้ครบ',
        body: ideas.length ? '<div class="actions">' + ideas.map(function (s, i) {
          return '<div class="act ' + s.tone + '">' +
            '<div class="no"><span>#' + (i + 1) + '</span>' +
            '<span class="tag ' + s.tagCls + '">' + esc(s.tag) + '</span></div>' +
            '<div class="br">' + esc(s.scope) + '</div>' +
            '<h4>' + esc(s.title) + '</h4>' +
            '<div class="mini3">' + s.metrics.map(function (m) {
              return '<div class="mini"><small>' + esc(m.label) + '</small><b>' +
                     esc(m.value) + '</b></div>';
            }).join('') + '</div>' +
            '<div class="prob"><b>ทำไมถึงเสนอแบบนี้</b>' + esc(s.why) + '</div>' +
            '<div class="rec"><b>ลงมือยังไง</b>' + esc(s.action) + '</div>' +
            '<div class="prob"><b>คาดว่าจะได้อะไร</b>' + esc(s.expect) + '</div>' +
            '</div>';
        }).join('') + '</div>'
          : UI.empty('ยังไม่พบจุดที่คุ้มจะจัดโปรในช่วงนี้ — ตัวเลขทุกด้านอยู่ในเกณฑ์ปกติ'),
      });

      h += UI.sect({
        id: 'timing', eyebrow: 'จังหวะเวลา', title: 'ช่วงไหนคนเข้าร้าน',
        lead: 'ใช้เลือกวันและเวลาที่จะปล่อยโปร — เติมช่องที่ว่าง อย่าลดราคาในช่องที่เต็มอยู่แล้ว',
        body: '<div class="g2">' +
          UI.panel({ eyebrow: 'ชั่วโมง × วัน', title: 'ยอดขายเฉลี่ยต่อชั่วโมง',
            body: UI.heatmap(ctx.heat) }) +
          UI.panel({ eyebrow: 'รายวัน', title: 'ยอดขายเฉลี่ยต่อวัน แยกตามวันในสัปดาห์',
            hint: 'เป็นค่าเฉลี่ย<b>ต่อหนึ่งวัน</b> ไม่ใช่ยอดรวม — ช่วง ' + range.days +
                  ' วันมีบางวันของสัปดาห์ปรากฏถี่กว่าวันอื่น การดูยอดรวมจะทำให้วันนั้นดูดีเกินจริง',
            body: '<div class="chartbox"><canvas id="pmDow"></canvas></div>' }) +
          '</div>',
      });

      h += UI.sect({
        id: 'discount', eyebrow: 'ส่วนลด', title: 'ตอนนี้ลดราคาไปกับอะไรบ้าง',
        lead: 'ถ้ายอดส่วนใหญ่ตกอยู่ในกลุ่ม “ลด ≤5%” แปลว่ากำลังแจกส่วนลดโดยไม่ได้อะไรกลับมา',
        body: '<div class="g2e">' +
          UI.panel({ eyebrow: 'สัดส่วนยอดขาย', title: 'ตามระดับส่วนลด',
            body: '<div class="chartbox sm"><canvas id="pmDisc"></canvas></div>' }) +
          UI.panel({ eyebrow: 'ขนาดบิล', title: 'ยอดขายมาจากบิลขนาดไหน',
            body: '<div class="chartbox sm"><canvas id="pmBins"></canvas></div>' }) +
          '</div>',
      });

      return h;
    },

    after: function () {
      var ctx = this._ctx;
      if (!ctx) { return; }

      var perDay = ctx.heat.dowPerDay || ctx.heat.dowTotals;
      UI.chart('pmDow', {
        type: 'bar',
        data: {
          labels: ctx.heat.dowsLong,
          datasets: [{
            data: perDay,
            backgroundColor: (function () {
              var max = Math.max.apply(null, perDay.concat([1]));
              return perDay.map(function (v) {
                return v / max > 0.8 ? '#F2565A' : v / max > 0.55 ? '#F8A0A0' : '#FBD4D4';
              });
            }()),
            borderRadius: 5, borderSkipped: false,
          }],
        },
        options: {
          scales: { y: UI.bahtAxis, x: UI.catAxis },
          plugins: { tooltip: { callbacks: { label: function (c) {
            return ['  ' + fmt.baht(c.parsed.y) + ' ต่อวัน',
                    '  รวม ' + fmt.bahtK(ctx.heat.dowTotals[c.dataIndex]) +
                    ' จาก ' + ctx.heat.dowCounts[c.dataIndex] + ' วัน'];
          } } } },
        },
      });

      var dTotal = ctx.discBins.reduce(function (a, x) { return a + x.net; }, 0);
      UI.chart('pmDisc', {
        type: 'doughnut',
        data: {
          labels: D.discBins,
          datasets: [{
            data: ctx.discBins.map(function (x) { return x.net; }),
            backgroundColor: ['#16A34A', '#F59E0B', '#F97316', '#EF4444', '#991B1B'],
            borderWidth: 2, borderColor: '#fff',
          }],
        },
        options: {
          cutout: '55%',
          plugins: {
            legend: { display: true, position: 'right', labels: { boxWidth: 10, padding: 9 } },
            tooltip: { callbacks: { label: function (c) {
              return '  ' + fmt.bahtK(c.parsed) + ' (' + fmt.pct(c.parsed / (dTotal || 1), 0) + ')';
            } } },
          },
        },
      });

      var binTotal = ctx.billBins.reduce(function (a, x) { return a + x.net; }, 0);
      UI.chart('pmBins', {
        type: 'bar',
        data: {
          labels: D.billBins,
          datasets: [{
            data: ctx.billBins.map(function (x) { return x.net; }),
            backgroundColor: ctx.billBins.map(function (x, i) { return i >= 6 ? '#16A34A' : '#F8ABAB'; }),
            borderRadius: 5, borderSkipped: false,
          }],
        },
        options: {
          scales: { y: UI.bahtAxis, x: UI.catAxis },
          plugins: { tooltip: { callbacks: { label: function (c) {
            return ['  ' + fmt.baht(c.parsed.y),
                    '  ' + fmt.pct(c.parsed.y / (binTotal || 1), 0) + ' ของยอดขาย',
                    '  ' + fmt.int(ctx.billBins[c.dataIndex].bills) + ' บิล'];
          } } } },
        },
      });
    },
  });

  /* ═══════════════════════════════════════════════════════ ลูกค้า ══ */

  def({
    id: 'customers',
    group: 'การตลาด',
    icon: '👥',
    title: 'กลุ่มลูกค้า',
    lead: 'แบ่งลูกค้าที่ให้เบอร์โทรไว้ 4 มุม เพื่อเลือกว่าจะคุยกับใครด้วยข้อเสนอแบบไหน',

    render: function (range) {
      var b = KAN.branchFilter();
      var seg = KAN.customerSegments(range.i0, range.i1, b);
      this._seg = seg;

      if (!seg.total) {
        return UI.empty('ไม่มีลูกค้าที่ระบุตัวตนได้ในช่วงนี้');
      }

      var posTotal = KAN.posTotals(range.i0, range.i1, b);
      var identified = posTotal.net ? seg.totalSpend / posTotal.net : 0;

      var h = '';
      h += '<div class="scope"><div>ขอบเขต: <b>' + esc(KAN.scopeLabel()) + '</b> · ' +
           esc(range.label) + '</div><div class="days">' + fmt.int(seg.total) + ' คน</div></div>';

      h += UI.banner('info', 'ข้อมูลนี้ครอบคลุมแค่ไหน',
        'นับเฉพาะบิลที่ลูกค้าให้เบอร์โทรไว้ คิดเป็น ' + fmt.pct(identified, 0) +
        ' ของยอดขายทั้งหมดในช่วงนี้ ส่วนที่เหลือเป็นลูกค้าที่ระบุตัวตนไม่ได้ ' +
        'สัดส่วนในหน้านี้จึงใช้เปรียบเทียบกันเองได้ แต่ยังไม่ใช่ภาพลูกค้าทั้งร้าน');

      function segBlock(title, lead, buckets, extra, unitNote) {
        var total = buckets.reduce(function (a, x) { return a + x.n; }, 0);
        var spend = buckets.reduce(function (a, x) { return a + x.spend; }, 0);
        return UI.sect({
          eyebrow: 'มุมมอง', title: title, lead: lead,
          body: '<div class="segs">' + buckets.map(function (x) {
            return '<div class="seg">' +
              '<div class="st"><span class="dotc" style="background:' + x.def.color + '"></span>' +
              esc(x.def.label) + '</div>' +
              '<div class="sn">' + fmt.int(x.n) +
              ' <span style="font-size:13px;color:#9AA0B1">คน · ' +
              fmt.pct(total ? x.n / total : 0, 0) + '</span></div>' +
              '<div class="ss">' + esc(x.def.hint) + '<br>' +
              'ยอดรวม ' + fmt.bahtK(x.spend) + ' (' + fmt.pct(spend ? x.spend / spend : 0, 0) + ' ของยอด)' +
              '<br>เฉลี่ย ' + fmt.baht(x.n ? x.spend / x.n : 0) + ' ต่อคน</div></div>';
          }).join('') + '</div>' + (extra || ''),
        });
      }

      var vipShare = seg.totalSpend ? seg.loyalty[0].spend / seg.totalSpend : 0;
      h += segBlock('ซื้อบ่อยแค่ไหน (ในช่วงที่เลือก)',
        'นับเฉพาะบิลที่เกิดในช่วง ' + range.days + ' วันนี้ เกณฑ์ “ขาประจำ” จึงปรับตามความยาวช่วง — ' +
        'ตอนนี้ขาประจำคิดเป็น ' + fmt.pct(seg.total ? seg.loyalty[0].n / seg.total : 0, 0) +
        ' ของคนที่มาซื้อ แต่สร้างยอด ' + fmt.pct(vipShare, 0),
        seg.loyalty);

      h += segBlock('ซื้อครั้งละเท่าไร',
        'ใช้เลือกว่าจะตั้งเกณฑ์โปรที่ยอดเท่าไร — เกณฑ์ควรอยู่เหนือกลุ่มที่ใหญ่ที่สุดเล็กน้อย',
        seg.spend);

      h += segBlock('หายไปนานแค่ไหนแล้ว',
        'มุมนี้ดู<b>ฐานลูกค้าทั้งหมด ' + fmt.int(seg.baseTotal) + ' คน</b> ที่เคยซื้อจนถึงวันสุดท้ายของช่วง ' +
        'ไม่ใช่แค่คนที่มาซื้อในช่วงนี้ — ถ้านับเฉพาะคนที่เพิ่งมาซื้อ ทุกคนก็จะอยู่ในกลุ่ม “ยังซื้ออยู่” หมด ' +
        'ซึ่งไม่บอกอะไรเลย · กลุ่ม “หลับ” ยังดึงกลับทัน ส่วน “หายไป” ต้นทุนดึงกลับสูงกว่ามาก',
        seg.recency);

      h += UI.sect({
        eyebrow: 'มุมมอง', title: 'ซื้อที่จุดขายไหนเป็นหลัก',
        lead: 'อ้างอิงจากจุดชำระเงินที่ลูกค้าใช้บ่อยที่สุด ใช้เป็นตัวแทนหมวดสินค้าที่ซื้อประจำ',
        body: '<div class="g2">' +
          UI.panel({ eyebrow: 'สัดส่วน', title: 'ยอดใช้จ่ายตามจุดขาย',
            body: '<div class="chartbox"><canvas id="cuTerm"></canvas></div>' }) +
          UI.panel({ eyebrow: 'อันดับ', title: 'จุดขายที่มีลูกค้าประจำมากที่สุด',
            body: '<div class="legend" id="cuTermList"></div>' }) +
          '</div>',
      });

      h += UI.sect({
        eyebrow: 'ตารางเต็ม', title: 'ไขว้สองมุม: ความถี่ × ยอดต่อบิล',
        lead: 'ช่องที่มีคนเยอะแต่ยอดต่อคนต่ำ คือช่องที่โปรแบบตั้งเกณฑ์ยอดจะได้ผลที่สุด',
        body: UI.panel({ body: UI.tableShell('cuCross') }),
      });

      return h;
    },

    after: function () {
      var seg = this._seg;
      if (!seg) { return; }

      var top = seg.byTerminal.slice(0, 10);
      var rest = seg.byTerminal.slice(10);
      var data = top.slice();
      if (rest.length) {
        data.push({ name: 'อื่น ๆ (' + rest.length + ')',
                    n: rest.reduce(function (a, x) { return a + x.n; }, 0),
                    spend: rest.reduce(function (a, x) { return a + x.spend; }, 0) });
      }
      var tot = data.reduce(function (a, x) { return a + x.spend; }, 0);

      UI.chart('cuTerm', {
        type: 'doughnut',
        data: {
          labels: data.map(function (x) { return x.name; }),
          datasets: [{ data: data.map(function (x) { return x.spend; }),
                       backgroundColor: KAN.PALETTE, borderWidth: 2, borderColor: '#fff' }],
        },
        options: {
          cutout: '58%',
          plugins: { tooltip: { callbacks: { label: function (c) {
            return '  ' + fmt.bahtK(c.parsed) + ' (' + fmt.pct(c.parsed / (tot || 1), 0) + ')';
          } } } },
        },
      });

      var list = document.getElementById('cuTermList');
      if (list) {
        list.innerHTML = data.map(function (x, i) {
          return '<div class="li"><span class="sw" style="background:' +
            KAN.PALETTE[i % KAN.PALETTE.length] + '"></span>' +
            '<span class="nm"><b>' + esc(x.name) + '</b><small>' + fmt.int(x.n) + ' คน · เฉลี่ย ' +
            fmt.baht(x.n ? x.spend / x.n : 0) + '/คน</small></span>' +
            '<span class="amt">' + fmt.bahtK(x.spend) + '</span></div>';
        }).join('');
      }

      /* Loyalty × spend-band crosstab. */
      var LOY = seg.loyaltyDefs;
      var cells = {};
      seg.rows.forEach(function (c) {
        var li = LOY.length - 1;
        for (var i = 0; i < LOY.length; i++) { if (c.bills >= LOY[i].min) { li = i; break; } }
        var si = KAN.SPEND.length - 1;
        for (var j = 0; j < KAN.SPEND.length; j++) { if (c.avgBill < KAN.SPEND[j].max) { si = j; break; } }
        var k = li + '|' + si;
        var cell = cells[k] || (cells[k] = { loyalty: LOY[li].label, spend: KAN.SPEND[si].label,
                                             li: li, si: si, n: 0, total: 0, bills: 0 });
        cell.n++; cell.total += c.spend; cell.bills += c.bills;
      });
      var rows = Object.keys(cells).map(function (k) {
        var c = cells[k];
        c.perHead = c.n ? c.total / c.n : 0;
        c.share = seg.total ? c.n / seg.total : 0;
        return c;
      });

      UI.table('cuCross', [
        { key: 'loyalty', label: 'ความถี่', render: function (r) { return esc(r.loyalty); },
          sort: function (r) { return -r.li; } },
        { key: 'spend', label: 'ระดับบิล', render: function (r) { return esc(r.spend); },
          sort: function (r) { return r.si; } },
        { key: 'n', label: 'จำนวนคน', num: true,
          render: function (r) { return UI.miniBar(r.share) + fmt.int(r.n); } },
        { key: 'share', label: 'สัดส่วน', num: true,
          render: function (r) { return fmt.pct(r.share, 1); } },
        { key: 'bills', label: 'บิลรวม', num: true, render: function (r) { return fmt.int(r.bills); } },
        { key: 'total', label: 'ยอดรวม', num: true, render: function (r) { return fmt.bahtK(r.total); } },
        { key: 'perHead', label: 'ยอดต่อคน', num: true, render: function (r) { return fmt.baht(r.perHead); } },
      ], rows, { sortKey: 'total', sortDir: -1 }).mount();
    },
  });

  /* ═════════════════════════════════════════════════ คุณภาพข้อมูล ══ */

  def({
    id: 'quality',
    group: 'ระบบ',
    icon: '✓',
    title: 'คุณภาพข้อมูล',
    lead: 'สิ่งที่ระบบตรวจเจอเองตอนนำเข้าข้อมูล เรียงจากที่กระทบการตัดสินใจมากที่สุด',

    render: function () {
      var A = KAN.anomalies;
      var nErr = KAN.anomalyCount('error');
      var nWarn = KAN.anomalyCount('warn');
      var totalRows = A.reduce(function (a, x) { return a + x.count; }, 0);

      var h = '';
      h += '<div class="dq">' +
        '<div class="ic">✓</div>' +
        '<div class="tx"><small>ตรวจอัตโนมัติทุกครั้งที่นำเข้าข้อมูล</small>' +
        '<b>ตรวจแล้ว ' + fmt.int(D.salesOut.length + D.stockIn.length + D.transfers.length) +
        ' แถวจากไฟล์ต้นทาง</b>' +
        '<p>ระบบไม่ทิ้งแถวที่ผิดปกติเงียบ ๆ ทุกแถวที่ถูกกันออกจะถูกนับและรายงานไว้ที่นี่ ' +
        'พร้อมบอกว่ามาจากไฟล์ไหนและกระทบตัวเลขหน้าไหน</p></div>' +
        '<div class="stats">' +
          '<div><b>' + fmt.int(nErr) + '</b><small>ต้องแก้ที่ต้นทาง</small></div>' +
          '<div><b>' + fmt.int(nWarn) + '</b><small>ควรตรวจสอบ</small></div>' +
          '<div><b>' + fmt.int(totalRows) + '</b><small>แถวที่พบปัญหา</small></div>' +
          '<div><b>' + fmt.thDate(D.meta.dataEnd) + '</b><small>ข้อมูลถึงวันที่</small></div>' +
        '</div></div>';

      h += UI.sect({
        eyebrow: 'ผลกระทบ', title: 'สิ่งที่ทำได้และยังทำไม่ได้ตอนนี้',
        lead: '',
        body: '<div class="g3">' +
          UI.panel({ eyebrow: 'ใช้ได้เต็มที่', title: 'ยอดขายระดับบิล',
            body: '<div class="hint">ใบเสร็จจาก POS ทั้ง 3 สาขา ครบทุกวันตั้งแต่ ' +
              fmt.thDate(D.meta.dateMin) + ' ถึง ' + fmt.thDate(D.meta.dateMax) +
              ' — ยอดขาย จำนวนบิล ขนาดบิล ช่วงเวลา ส่วนลด และกลุ่มลูกค้า เชื่อถือได้ทั้งหมด</div>' }) +
          UI.panel({ eyebrow: 'ใช้ได้บางส่วน', title: 'ยอดแยกตามโซน',
            body: '<div class="hint">มาจากชีตสรุปที่กรอกมือ ตรงกับ POS สนิทถึงราว ' +
              (KAN.zoneTrustFrom ? fmt.thDate(KAN.zoneTrustFrom + '-01', 'my') : 'กลางปี') +
              ' หลังจากนั้นยอดถูกลงผิดสาขา จึงใช้ดูภาพรวมทั้งบริษัทได้ แต่แยกรายสาขาไม่ได้</div>' }) +
          UI.panel({ eyebrow: 'ยังทำไม่ได้', title: 'ระดับรายสินค้า (SKU)',
            body: '<div class="hint">มีข้อมูล SKU เฉพาะ Kan Fashion ช่วง ' +
              (D.meta.skuWindow
                ? fmt.thDate(D.meta.skuWindow[0]) + ' – ' + fmt.thDate(D.meta.skuWindow[1])
                : '—') +
              ' เท่านั้น (' + fmt.int(D.kfSales.length) + ' แถว) สั้นเกินกว่าจะคำนวณ ' +
              'dead stock รายตัวได้ ตอนนี้จึงวิเคราะห์ที่ระดับโซนแทน</div>' }) +
          '</div>',
      });

      h += UI.sect({
        eyebrow: 'รายการที่ตรวจพบ', title: 'ปัญหาทั้งหมด ' + A.length + ' ประเภท',
        lead: 'สีแดงคือเรื่องที่ต้องไปแก้ที่ไฟล์ต้นทาง ไม่ใช่แก้ที่ dashboard',
        body: '<div class="alerts">' + A.map(function (a) {
          var label = a.severity === 'error' ? 'ต้องแก้ที่ต้นทาง'
            : a.severity === 'warn' ? 'ควรตรวจสอบ' : 'บันทึกไว้เฉย ๆ';
          var tagCls = a.severity === 'error' ? 'r' : a.severity === 'warn' ? 'a' : 'n';
          return '<div class="alert ' + a.severity + '">' +
            '<div class="ah"><b>' + esc(a.title) + '</b>' +
            '<span class="tag ' + tagCls + '">' + label + '</span>' +
            '<span class="cnt">พบ ' + fmt.int(a.count) + ' ครั้ง</span></div>' +
            '<p>' + esc(a.detail) + '</p>' +
            '<div class="src">แหล่ง: ' + esc(a.source) + '</div>' +
            (a.samples && a.samples.length
              ? '<div class="eg">ตัวอย่าง: ' + a.samples.map(function (s) {
                  return '<code>' + esc(s) + '</code>';
                }).join('') + '</div>'
              : '') +
            '</div>';
        }).join('') + '</div>',
      });

      return h;
    },

    after: function () {},
  });

}(window));
