/* KAN ERP — two more pages that build on the same engine:
 *   sku  — the only product-level data we have (Kan Fashion)
 *   plan — the promotion suggestions laid out as a week the shop can execute
 */
(function (global) {
  'use strict';

  var KAN = global.KAN, UI = KAN.UI, fmt = KAN.fmt, esc = KAN.esc, D = KAN.D;

  function def(v) { KAN.views[v.id] = v; KAN.viewOrder.push(v.id); return v; }

  /* ══════════════════════════════════════════════ สินค้ารายตัว (SKU) ══ */

  /* ═══════════════════════════════════════════════════ สินค้าขายดี ══ */

  def({
    id: 'bestsellers',
    group: 'สินค้าและสต็อก',
    icon: '⚡',
    title: 'สินค้าขายดี',
    lead: 'ช่วงที่เลือก สินค้าตัวไหนทำเงินให้มากที่สุด เรียงเป็นอันดับ',

    render: function (range) {
      if (!KAN.hasSkuData) {
        return UI.empty('ยังไม่มีข้อมูลระดับสินค้าในไฟล์ต้นทาง');
      }
      var b = KAN.branchFilter();
      var covered = KAN.skuBranches;
      var names = covered.map(function (i) { return D.branches[i].short || D.branches[i].name; });

      if (b != null && covered.indexOf(b) < 0) {
        return UI.empty('สาขา <b>' + esc(D.branches[b].name) + '</b> ยังไม่มีไฟล์ใบเสร็จรายสินค้า' +
          '<br>ตอนนี้มีข้อมูลระดับสินค้าเฉพาะ ' + esc(names.join(' และ ')) +
          '<br><br>เลือก “ทุกสาขา” หรือสาขาที่มีข้อมูล เพื่อดูอันดับสินค้า');
      }

      var rows = KAN.skuRank(range.i0, range.i1, b);
      var total = rows.total || 0;
      var days = range.days;

      var h = '';
      h += '<div class="scope"><div>ขอบเขต: <b>' + esc(KAN.scopeLabel()) + '</b> · ' +
           esc(range.label) + '</div><div class="days">' + days + ' วัน · ' +
           fmt.int(rows.length) + ' รายการที่ขายได้</div></div>';

      h += UI.banner('info', 'ตัวเลขนี้นับจากอะไร',
        'นับจาก<b style="display:inline">ใบเสร็จจริงรายบรรทัดสินค้า</b> ของ ' + esc(names.join(' และ ')) +
        ' — บิลคืนเงินและบิลยอด 0 ถูกตัดออกแล้วเหมือนหน้าอื่น ' +
        'ส่วนถุงรักษ์โลก คูปอง และรายการบริการไม่นับเป็นสินค้า · ' +
        'สาขาที่ยังไม่มีไฟล์รายสินค้า (' +
        esc(D.branches.filter(function (x, i) { return x.kind === 'store' && covered.indexOf(i) < 0; })
             .map(function (x) { return x.short || x.name; }).join(', ') || '—') +
        ') จะไม่อยู่ในอันดับนี้');

      if (!rows.length) {
        h += UI.empty('ไม่มีสินค้าที่ขายได้ในช่วง ' + esc(range.label));
        this._rows = [];
        return h;
      }

      /* กระจุกแค่ไหน — กี่รายการรวมกันได้ 80% ของยอด */
      var run = 0, need = total * 0.8, n80 = 0;
      for (var i = 0; i < rows.length; i++) {
        run += rows[i].net; n80++;
        if (run >= need) { break; }
      }
      var top = rows[0];

      h += '<div class="kpis">';
      h += UI.kpi({ label: 'อันดับ 1', tone: 'g',
        value: '<span class="kpi-name">' + esc(top.name) + '</span>',
        sub: fmt.baht(top.net) + ' · ' + fmt.int(top.qty) + ' ชิ้น · ' +
             fmt.pct(top.share, 1) + ' ของยอดทั้งหมด' });
      h += UI.kpi({ label: 'ยอดขายรวมของสินค้าที่นับได้', value: fmt.baht(total),
        sub: fmt.int(rows.reduce(function (a, r) { return a + r.qty; }, 0)) + ' ชิ้น ใน ' + days + ' วัน' });
      h += UI.kpi({ label: 'กระจุกอยู่ที่กี่ตัว', tone: 'a', value: fmt.int(n80) + ' รายการ',
        sub: 'รวมกันได้ 80% ของยอด (' + fmt.pct(n80 / rows.length, 0) + ' ของรายการที่ขายได้)' });
      h += UI.kpi({ label: 'สินค้าที่ขายได้', tone: 'b', value: fmt.int(rows.length),
        sub: 'จากทั้งหมด ' + fmt.int((D.posSkus || []).length) + ' รายการที่เคยขายได้ทั้งปี' });
      h += '</div>';

      h += UI.panel({ eyebrow: 'อันดับ', title: 'สินค้าที่ทำเงินสูงสุด 15 อันดับแรก',
        hint: 'ตัวบนสุดคือตัวที่ห้ามให้ขาดสต็อก และควรคิดให้หนักก่อนเอาไปลดราคา',
        body: '<div class="chartbox lg"><canvas id="bsTop"></canvas></div>' });

      h += UI.sect({
        eyebrow: 'ตารางเต็ม',
        title: 'ทุกรายการที่ขายได้ในช่วงนี้',
        lead: '“ขายกี่วัน” คือจำนวนวันที่ขายได้อย่างน้อย 1 ชิ้น — ตัวที่ขายเกือบทุกวันคือสินค้าหลักที่ห้ามขาด ' +
              'ส่วนตัวที่ยอดสูงแต่ขายไม่กี่วัน มักเป็นของชิ้นใหญ่หรือลูกค้าเหมา · คลิกหัวตารางเพื่อเรียงใหม่',
        body: UI.panel({
          body: '<div class="bs-tools">' +
                  '<input type="search" id="bsQ" class="bs-search" placeholder="ค้นชื่อสินค้า หรือรหัส SKU">' +
                  '<span class="bs-count" id="bsCount"></span>' +
                '</div>' + UI.tableShell('bsTable'),
        }),
      });

      this._rows = rows;
      this._days = days;
      return h;
    },

    after: function () {
      var rows = this._rows || [];
      if (!rows.length) { return; }
      var days = this._days;
      var maxNet = rows[0].net || 1;

      var top = rows.slice(0, 15);
      UI.chart('bsTop', {
        type: 'bar',
        data: {
          labels: top.map(function (r) {
            return r.name.length > 28 ? r.name.slice(0, 27) + '…' : r.name;
          }),
          datasets: [{
            data: top.map(function (r) { return r.net; }),
            backgroundColor: top.map(function (r, i) { return i < 3 ? '#F2565A' : '#F8ABAB'; }),
            borderRadius: 5, borderSkipped: false,
          }],
        },
        options: {
          indexAxis: 'y',
          scales: { x: UI.bahtAxis, y: { grid: { display: false }, ticks: { autoSkip: false } } },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: function (c) { return top[c[0].dataIndex].name; },
              label: function (c) {
                var r = top[c.dataIndex];
                return ['  ' + fmt.baht(r.net) + ' · ' + fmt.int(r.qty) + ' ชิ้น',
                        '  ' + fmt.pct(r.share, 1) + ' ของยอดทั้งหมด · ขายได้ ' + r.days + '/' + days + ' วัน',
                        '  ' + esc(r.zone || '—')];
              },
            } },
          },
        },
      });

      var cols = [
        { key: 'rank', label: '#', num: true, render: function (r) { return r.rank; } },
        { key: 'name', label: 'สินค้า',
          render: function (r) {
            return '<div class="dept"><b>' + esc(r.name) + '</b><small>' +
              esc(r.zone || '(ไม่ระบุโซน)') + ' · SKU ' + esc(r.code) + '</small></div>';
          } },
        { key: 'net', label: 'ยอดขาย', num: true,
          render: function (r) { return UI.miniBar(r.net / maxNet) + fmt.baht(r.net); } },
        { key: 'share', label: 'สัดส่วน', num: true,
          render: function (r) { return fmt.pct(r.share, 1); } },
        { key: 'qty', label: 'ชิ้น', num: true, render: function (r) { return fmt.int(r.qty); } },
        { key: 'price', label: '฿/ชิ้น', num: true,
          sort: function (r) { return r.qty ? r.net / r.qty : 0; },
          render: function (r) { return fmt.baht(r.qty ? r.net / r.qty : 0); } },
        { key: 'days', label: 'ขายกี่วัน', num: true,
          render: function (r) {
            var cov = days ? r.days / days : 0;
            var tone = cov > 0.7 ? '#16A34A' : cov > 0.3 ? '#B45309' : '#DC2626';
            return UI.miniBar(cov, tone) + r.days + '/' + days;
          } },
      ];

      var q = document.getElementById('bsQ');
      var countEl = document.getElementById('bsCount');

      /* กรองแล้วสร้างตารางใหม่เฉพาะในกล่องตาราง — ช่องค้นหาอยู่นอกกล่อง
         focus จึงไม่หลุดระหว่างพิมพ์ */
      function paint() {
        var term = (q && q.value || '').trim().toLowerCase();
        var list = !term ? rows : rows.filter(function (r) {
          return r.name.toLowerCase().indexOf(term) >= 0 ||
                 String(r.code).toLowerCase().indexOf(term) >= 0;
        });
        UI.table('bsTable', cols, list, { sortKey: 'net', sortDir: -1 }).mount();
        if (countEl) {
          countEl.textContent = term
            ? 'พบ ' + fmt.int(list.length) + ' จาก ' + fmt.int(rows.length) + ' รายการ'
            : fmt.int(rows.length) + ' รายการ';
        }
      }
      paint();
      if (q) { q.addEventListener('input', paint); }
    },
  });

  def({
    id: 'sku',
    group: 'สินค้าและสต็อก',
    icon: '🏷',
    title: 'สินค้ารายตัว',
    lead: 'ระดับ SKU มีข้อมูลเฉพาะ Kan Fashion และช่วงสั้น ๆ — ใช้ดูทิศทางได้ ยังใช้สรุป dead stock ไม่ได้',

    render: function (range) {
      var win = D.meta.skuWindow;
      if (!win || !D.kfSales.length) {
        return UI.empty('ยังไม่มีข้อมูลระดับสินค้าในไฟล์ต้นทาง');
      }
      var wi0 = KAN.idxAtOrAfter(win[0]), wi1 = KAN.idxAtOrBefore(win[1]);
      /* Clip the global filter to the slice of days SKU data actually covers. */
      var i0 = Math.max(range.i0, wi0), i1 = Math.min(range.i1, wi1);
      var overlap = i1 >= i0;

      var h = '';
      h += '<div class="scope"><div>แหล่ง: <b>Kan Fashion</b> · ชีต DATA ขาย KF</div>' +
           '<div class="days">มีข้อมูล ' + fmt.thDate(win[0]) + ' – ' + fmt.thDate(win[1]) + '</div></div>';

      h += UI.banner('warn', 'ข้อมูลชุดนี้ครอบคลุมแค่ไหน',
        'ข้อมูลรายสินค้ามีอยู่ <b style="display:inline">' + (wi1 - wi0 + 1) +
        ' วัน</b> และเฉพาะ Kan Fashion เท่านั้น (' + fmt.int(D.skus.length) + ' รายการ) — ' +
        'สั้นเกินกว่าจะบอกได้ว่าตัวไหน dead stock จริง เพราะสินค้าแฟชั่นบางตัวขายเป็นรอบ ' +
        'หน้านี้จึงบอกได้แค่ว่าช่วงนั้น<b style="display:inline">ตัวไหนขายดี ตัวไหนแทบไม่ขยับ</b> · ' +
        'การวิเคราะห์ dead stock ที่เชื่อได้อยู่ที่หน้า ' +
        '<a href="#/velocity" style="color:inherit;font-weight:700">สินค้าเข้า–ออก</a> ซึ่งทำที่ระดับโซน');

      if (!overlap) {
        h += UI.empty('ช่วงวันที่เลือก (' + esc(range.label) + ') ไม่ทับกับช่วงที่มีข้อมูลรายสินค้า' +
          '<br>ข้อมูลมีเฉพาะ ' + fmt.thDate(win[0]) + ' – ' + fmt.thDate(win[1]) +
          '<br><br><button class="btn" id="skuJump">ดูช่วงที่มีข้อมูล</button>');
        this._rows = [];
        this._win = win;
        return h;
      }

      var days = i1 - i0 + 1;
      var agg = {};
      D.kfSales.forEach(function (r) {          // [dateIx, skuIx, qty, net, disc]
        if (r[0] < i0 || r[0] > i1) { return; }
        var a = agg[r[1]] || (agg[r[1]] = { qty: 0, net: 0, disc: 0, days: {} });
        a.qty += r[2]; a.net += r[3]; a.disc += r[4]; a.days[r[0]] = 1;
      });

      var rows = Object.keys(agg).map(function (k) {
        var a = agg[k], meta = D.skus[k] || {};
        var nDays = Object.keys(a.days).length;
        return {
          name: meta.name || meta.key || '(ไม่ระบุชื่อ)',
          key: meta.key, type: meta.type || '(ไม่ระบุ)',
          qty: a.qty, net: a.net, disc: a.disc,
          nDays: nDays,
          coverage: days ? nDays / days : 0,
          perDay: days ? a.qty / days : 0,
          price: a.qty ? a.net / a.qty : 0,
        };
      }).filter(function (r) { return r.net > 0 || r.qty > 0; });

      var totalNet = rows.reduce(function (a, r) { return a + r.net; }, 0);
      var totalQty = rows.reduce(function (a, r) { return a + r.qty; }, 0);
      rows.forEach(function (r) { r.share = totalNet ? r.net / totalNet : 0; });
      rows.sort(function (a, b) { return b.net - a.net; });

      /* How concentrated is the range — the classic "how few lines carry it". */
      var run = 0, need = totalNet * 0.8, n80 = 0;
      for (var i = 0; i < rows.length; i++) {
        run += rows[i].net; n80++;
        if (run >= need) { break; }
      }
      var rare = rows.filter(function (r) { return r.nDays <= Math.max(1, days * 0.15); });

      /* Order-level file gives the one thing receipts can't: items per bill. */
      var ord = D.kfOrders.filter(function (r) { return r[0] >= range.i0 && r[0] <= range.i1; });
      var ordQty = ord.reduce(function (a, r) { return a + r[3]; }, 0);
      var ordAmt = ord.reduce(function (a, r) { return a + r[4]; }, 0);

      h += '<div class="kpis">';
      h += UI.kpi({ label: 'รายการที่มีการขาย', value: fmt.int(rows.length),
        sub: 'จากทั้งหมด ' + fmt.int(D.skus.length) + ' รายการในไฟล์' });
      h += UI.kpi({ label: 'ยอดขายรวม', tone: 'g', value: fmt.baht(totalNet),
        sub: fmt.int(totalQty) + ' ชิ้น ใน ' + days + ' วัน' });
      h += UI.kpi({ label: 'กระจุกอยู่ที่กี่ตัว', tone: 'a', value: fmt.int(n80) + ' รายการ',
        sub: 'สร้างยอด 80% ของทั้งหมด (' + fmt.pct(n80 / (rows.length || 1), 0) + ' ของรายการที่ขายได้)' });
      h += UI.kpi({ label: 'นาน ๆ ขายที', tone: 'r', value: fmt.int(rare.length) + ' รายการ',
        sub: 'ขายได้ไม่เกิน ' + Math.max(1, Math.round(days * 0.15)) + ' วันจาก ' + days + ' วัน' });
      if (ord.length) {
        h += UI.kpi({ label: 'ชิ้นต่อบิล', tone: 'b', value: fmt.dec(ordQty / ord.length, 2),
          sub: 'จากรายงานออเดอร์ ' + fmt.int(ord.length) + ' บิล · เฉลี่ย ' +
               fmt.baht(ordAmt / ord.length) + '/บิล' });
      }
      h += '</div>';

      if (ord.length) {
        var storeMedian = KAN.medianBill(KAN.billBins(range.i0, range.i1, null));
        h += UI.banner('info', 'Kan Fashion ขายบิลใหญ่กว่าซูเปอร์สโตร์',
          'บิลเฉลี่ยที่ Kan Fashion อยู่ที่ ' + fmt.baht(ordAmt / ord.length) + ' และ ' +
          fmt.dec(ordQty / ord.length, 2) + ' ชิ้นต่อบิล ขณะที่มัธยฐานบิลของซูเปอร์สโตร์ทั้ง 3 สาขา' +
          'อยู่ที่ ' + fmt.baht(storeMedian) + ' — ' +
          'การจัดวางสินค้าและการเสนอขายของฝั่งแฟชั่นเป็นตัวอย่างที่เอาไปใช้กับสาขาอื่นได้');
      }

      h += '<div class="g2">' +
        UI.panel({ eyebrow: 'อันดับ', title: 'สินค้าที่ทำเงินสูงสุด',
          hint: 'ตัวที่อยู่บนสุดคือตัวที่ห้ามให้ขาด และไม่ควรเอาไปลดราคา',
          body: '<div class="chartbox lg"><canvas id="skuTop"></canvas></div>' }) +
        UI.panel({ eyebrow: 'หมวด', title: 'ยอดขายแยกตามประเภท',
          body: '<div class="chartbox lg"><canvas id="skuType"></canvas></div>' }) +
        '</div>';

      h += UI.sect({
        eyebrow: 'ตารางเต็ม', title: 'ทุกรายการที่ขายได้ในช่วงนี้',
        lead: '“ขายกี่วัน” คือจำนวนวันที่มีการขายอย่างน้อย 1 ชิ้น — ตัวที่ขายเกือบทุกวันคือสินค้าหลัก ' +
              'ส่วนตัวที่ขายวันเดียวอาจเป็นของฝากหรือของที่ลูกค้าเจาะจงมาซื้อ ไม่ใช่ของค้าง',
        body: UI.panel({ body: UI.tableShell('skuTable') }),
      });

      this._rows = rows;
      this._days = days;
      this._win = win;
      return h;
    },

    after: function () {
      var self = this;
      var jump = document.getElementById('skuJump');
      if (jump && this._win) {
        jump.addEventListener('click', function () {
          KAN.state.preset = 'custom';
          KAN.state.from = self._win[0];
          KAN.state.to = self._win[1];
          KAN.rerender();
        });
      }

      var rows = this._rows || [];
      if (!rows.length) { return; }

      var top = rows.slice(0, 12);
      UI.chart('skuTop', {
        type: 'bar',
        data: {
          labels: top.map(function (r) { return r.name; }),
          datasets: [{ data: top.map(function (r) { return r.net; }),
                       backgroundColor: '#F2565A', borderRadius: 5, borderSkipped: false }],
        },
        options: {
          indexAxis: 'y',
          scales: {
            x: { grid: { color: '#F1F2F7' }, border: { display: false },
                 ticks: { callback: function (v) { return fmt.bahtK(v); } } },
            y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10.5 } } },
          },
          plugins: { tooltip: { callbacks: { label: function (c) {
            var r = top[c.dataIndex];
            return ['  ' + fmt.baht(r.net), '  ' + fmt.int(r.qty) + ' ชิ้น · เฉลี่ย ' + fmt.baht(r.price),
                    '  ขายได้ ' + r.nDays + ' วัน'];
          } } } },
        },
      });

      var byType = {};
      rows.forEach(function (r) {
        var t = byType[r.type] || (byType[r.type] = { type: r.type, net: 0, qty: 0, n: 0 });
        t.net += r.net; t.qty += r.qty; t.n++;
      });
      var types = Object.keys(byType).map(function (k) { return byType[k]; })
        .sort(function (a, b) { return b.net - a.net; });
      var tTotal = types.reduce(function (a, t) { return a + t.net; }, 0);
      UI.chart('skuType', {
        type: 'doughnut',
        data: {
          labels: types.map(function (t) { return t.type; }),
          datasets: [{ data: types.map(function (t) { return t.net; }),
                       backgroundColor: KAN.PALETTE, borderWidth: 2, borderColor: '#fff' }],
        },
        options: {
          cutout: '55%',
          plugins: {
            legend: { display: true, position: 'right', labels: { boxWidth: 10, padding: 8, font: { size: 11 } } },
            tooltip: { callbacks: { label: function (c) {
              var t = types[c.dataIndex];
              return ['  ' + fmt.baht(t.net) + ' (' + fmt.pct(t.net / (tTotal || 1), 0) + ')',
                      '  ' + fmt.int(t.n) + ' รายการ · ' + fmt.int(t.qty) + ' ชิ้น'];
            } } },
          },
        },
      });

      var days = this._days || 1;
      var maxNet = Math.max.apply(null, rows.map(function (r) { return r.net; }).concat([1]));
      UI.table('skuTable', [
        { key: 'name', label: 'สินค้า',
          render: function (r) {
            return '<div class="dept"><b>' + esc(r.name) + '</b><small>' + esc(r.type) +
              (r.key ? ' · SKU ' + esc(r.key) : '') + '</small></div>';
          } },
        { key: 'net', label: 'ยอดขาย', num: true,
          render: function (r) { return UI.miniBar(r.net / maxNet) + fmt.baht(r.net); } },
        { key: 'share', label: 'สัดส่วน', num: true,
          render: function (r) { return fmt.pct(r.share, 1); } },
        { key: 'qty', label: 'ชิ้น', num: true, render: function (r) { return fmt.int(r.qty); } },
        { key: 'price', label: '฿/ชิ้น', num: true, render: function (r) { return fmt.baht(r.price); } },
        { key: 'nDays', label: 'ขายกี่วัน', num: true,
          render: function (r) {
            var tone = r.coverage > 0.7 ? '#16A34A' : r.coverage > 0.3 ? '#B45309' : '#DC2626';
            return UI.miniBar(r.coverage, tone) + r.nDays + '/' + days;
          } },
        { key: 'disc', label: 'ส่วนลด', num: true,
          render: function (r) { return r.disc ? fmt.baht(r.disc) : '—'; } },
      ], rows, { sortKey: 'net', sortDir: -1 }).mount();
    },
  });

  /* ═══════════════════════════════════════════════════ แผนลงมือ ══ */

  def({
    id: 'plan',
    group: 'การตลาด',
    icon: '🗓',
    title: 'แผนลงมือ',
    lead: 'เอาข้อเสนอทั้งหมดมาวางลงปฏิทิน พร้อมคนรับผิดชอบและตัวชี้วัดที่ต้องดู',

    render: function (range) {
      var b = KAN.branchFilter();
      var totals = KAN.posTotals(range.i0, range.i1, b);
      if (!totals.bills) {
        return UI.empty('ไม่มีใบเสร็จในช่วงที่เลือก จึงยังวางแผนไม่ได้');
      }
      var bins = KAN.billBins(range.i0, range.i1, b);
      var ctx = {
        range: range, branch: b, scopeLabel: KAN.scopeLabel(),
        totals: totals, billBins: bins, median: KAN.medianBill(bins),
        discBins: KAN.discBins(range.i0, range.i1, b),
        heat: KAN.hourDowMatrix(range.i0, range.i1, b),
        velocity: KAN.velocity(range.i0, range.i1, b, 0.30),
        segments: KAN.customerSegments(range.i0, range.i1, b),
      };
      var ideas = KAN.suggest(ctx).filter(function (s) { return s.plan; });
      this._ideas = ideas;

      if (!ideas.length) {
        return UI.empty('ยังไม่มีข้อเสนอที่ต้องลงตารางในช่วงนี้');
      }

      var dows = ctx.heat.dowsLong;
      var maxWeek = Math.max.apply(null, ideas.map(function (s) {
        return s.plan.week + s.plan.span - 1;
      }));

      var h = '';
      h += '<div class="scope"><div>ขอบเขต: <b>' + esc(KAN.scopeLabel()) + '</b> · ' +
           esc(range.label) + '</div><div class="days">' + ideas.length + ' งาน · ' +
           maxWeek + ' สัปดาห์</div></div>';

      h += UI.banner('info', 'อ่านตารางนี้ยังไง',
        'แถวคือหนึ่งงาน · ช่องที่ระบายสีคือวันที่งานนั้นทำงานอยู่ · ' +
        'งานที่ไม่มีช่องระบายเลยคืองานที่ไม่ผูกกับวัน (เช่น สั่งของ) แต่ยังมีกำหนดสัปดาห์ · ' +
        'จงใจไม่ให้ทุกงานเริ่มพร้อมกัน เพราะถ้าปล่อยพร้อมกันหมดจะแยกไม่ออกว่าอันไหนได้ผล');

      /* ── week grid ─────────────────────────────────────────────────── */
      h += UI.sect({
        eyebrow: 'ปฏิทิน', title: 'งานไหนทำวันไหน',
        lead: '',
        body: UI.panel({ body: this.grid(ideas, dows) }),
      });

      /* ── by week ───────────────────────────────────────────────────── */
      var byWeek = {};
      ideas.forEach(function (s) {
        (byWeek[s.plan.week] = byWeek[s.plan.week] || []).push(s);
      });
      h += UI.sect({
        eyebrow: 'ลำดับ', title: 'ทำอะไรก่อนหลัง',
        lead: 'สัปดาห์ที่ 1 คืองานที่ต้องรีบและตั้งค่าครั้งเดียวจบ · ' +
              'สัปดาห์ถัดไปค่อยเพิ่มงานที่ต้องอาศัยพฤติกรรมลูกค้า',
        body: '<div class="g3">' + Object.keys(byWeek).sort().map(function (w) {
          return UI.panel({
            eyebrow: 'สัปดาห์ที่ ' + w,
            title: byWeek[w].length + ' งาน',
            body: '<div class="legend">' + byWeek[w].map(function (s) {
              return '<div class="li"><span class="sw" style="background:' +
                toneColor(s.tone) + '"></span><span class="nm"><b>' + esc(s.title) + '</b>' +
                '<small>' + esc(s.plan.owner) + '</small></span></div>';
            }).join('') + '</div>',
          });
        }).join('') + '</div>',
      });

      /* ── measurement ───────────────────────────────────────────────── */
      h += UI.sect({
        eyebrow: 'วัดผล', title: 'ต้องดูตัวเลขอะไร ถึงจะรู้ว่าได้ผล',
        lead: 'ถ้าไม่ตั้งตัวเลขไว้ก่อน พอจบแคมเปญจะเถียงกันไม่จบว่าที่ยอดขึ้นเป็นเพราะโปรหรือเพราะฤดูกาล',
        body: UI.panel({ body: UI.tableShell('planTable') }),
      });

      return h;
    },

    grid: function (ideas, dows) {
      var h = '<div class="hmwrap"><table class="plan"><thead><tr><th style="min-width:230px">งาน</th>';
      dows.forEach(function (d) { h += '<th class="c">' + esc(d) + '</th>'; });
      h += '<th style="min-width:150px">ใครทำ</th><th style="white-space:nowrap">ช่วงเวลา</th></tr></thead><tbody>';
      ideas.forEach(function (s) {
        h += '<tr><td><div class="dept"><b>' + esc(s.title) + '</b><small>' +
             esc(s.scope) + '</small></div></td>';
        for (var i = 0; i < 7; i++) {
          var on = s.plan.days.indexOf(i) >= 0;
          h += '<td class="c">' + (on
            ? '<span class="cell" style="background:' + toneColor(s.tone) + '"></span>'
            : '<span class="cell off"></span>') + '</td>';
        }
        h += '<td style="font-size:12px;color:#5B6172">' + esc(s.plan.owner) + '</td>' +
             '<td style="font-size:12px;white-space:nowrap">สัปดาห์ ' + s.plan.week +
             (s.plan.span > 1 ? '–' + (s.plan.week + s.plan.span - 1) : '') + '</td></tr>';
      });
      return h + '</tbody></table></div>';
    },

    after: function () {
      var ideas = this._ideas || [];
      if (!ideas.length) { return; }
      UI.table('planTable', [
        { key: 'title', label: 'งาน', render: function (s) {
            return '<div class="dept"><b>' + esc(s.title) + '</b><small>' + esc(s.scope) + '</small></div>';
          } },
        { key: 'measure', label: 'ตัวชี้วัดที่ต้องดู',
          sort: function (s) { return s.plan.measure; },
          render: function (s) { return '<div class="todo">' + esc(s.plan.measure) + '</div>'; } },
        { key: 'expect', label: 'ที่คาดว่าจะได้',
          render: function (s) { return '<div class="todo">' + esc(s.expect) + '</div>'; } },
        { key: 'owner', label: 'ใครรับผิดชอบ',
          sort: function (s) { return s.plan.owner; },
          render: function (s) { return esc(s.plan.owner); } },
        { key: 'week', label: 'สัปดาห์', num: true,
          sort: function (s) { return s.plan.week; },
          render: function (s) { return String(s.plan.week); } },
      ], ideas, { sortKey: 'week', sortDir: 1 }).mount();
    },
  });

  function toneColor(t) {
    return { r: '#EF4444', a: '#F59E0B', g: '#16A34A', b: '#2563EB', i: '#F86D6D' }[t] || '#F86D6D';
  }

  /* Sidebar reads viewOrder directly, so put the two new pages next to the
   * ones they follow on from rather than at the bottom of their group. */
  (function reorder() {
    var o = KAN.viewOrder;
    function move(id, after) {
      var from = o.indexOf(id);
      if (from < 0) { return; }
      o.splice(from, 1);
      var to = o.indexOf(after);
      o.splice(to < 0 ? o.length : to + 1, 0, id);
    }
    move('sku', 'velocity');
    move('plan', 'promo');
  }());

}(window));
