/* KAN ERP — shared data engine.
 *
 * Everything downstream reads from KAN.*: the raw bundle is normalised once
 * here into date-indexed series, then each view just asks for a window.
 */
(function (global) {
  'use strict';

  var D = global.KAN_DATA;
  if (!D) { throw new Error('kan-data.js must load before core.js'); }

  var KAN = global.KAN = {
    D: D,
    dates: D.dates,
    nDates: D.dates.length,
    branches: D.branches,
    zones: D.zones,
  };

  /* ── date helpers ──────────────────────────────────────────────────────── */

  var dateIx = {};
  D.dates.forEach(function (iso, i) { dateIx[iso] = i; });
  KAN.dateIx = dateIx;

  var TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var TH_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  var TH_DOW_LONG = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  KAN.TH_DOW = TH_DOW;
  KAN.TH_DOW_LONG = TH_DOW_LONG;

  function parseISO(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function toISO(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function addDays(iso, n) {
    var d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function diffDays(a, b) {
    return Math.round((parseISO(b) - parseISO(a)) / 86400000);
  }
  KAN.parseISO = parseISO;
  KAN.toISO = toISO;
  KAN.addDays = addDays;
  KAN.diffDays = diffDays;

  /* ── formatting ────────────────────────────────────────────────────────── */

  function thDate(iso, opts) {
    if (!iso) { return '—'; }
    var d = parseISO(iso);
    var y = d.getFullYear() + 543;
    if (opts === 'short') { return d.getDate() + ' ' + TH_MONTH[d.getMonth()]; }
    if (opts === 'my') { return TH_MONTH[d.getMonth()] + ' ' + y; }
    return d.getDate() + ' ' + TH_MONTH[d.getMonth()] + ' ' + y;
  }

  var fmt = KAN.fmt = {
    thDate: thDate,
    /* Money is always whole baht — decimals here are noise, not precision. */
    baht: function (v) {
      if (v == null || isNaN(v)) { return '—'; }
      return '฿' + Math.round(v).toLocaleString('en-US');
    },
    bahtK: function (v) {
      if (v == null || isNaN(v)) { return '—'; }
      var a = Math.abs(v);
      if (a >= 1e6) { return '฿' + (v / 1e6).toFixed(2) + 'M'; }
      if (a >= 1e4) { return '฿' + Math.round(v / 1e3) + 'K'; }
      return '฿' + Math.round(v).toLocaleString('en-US');
    },
    int: function (v) {
      if (v == null || isNaN(v)) { return '—'; }
      return Math.round(v).toLocaleString('en-US');
    },
    dec: function (v, n) {
      if (v == null || isNaN(v)) { return '—'; }
      return v.toFixed(n == null ? 1 : n);
    },
    pct: function (v, n) {
      if (v == null || isNaN(v) || !isFinite(v)) { return '—'; }
      return (v * 100).toFixed(n == null ? 1 : n) + '%';
    },
    /* Signed delta with the arrow the eye expects. */
    delta: function (v, n) {
      if (v == null || isNaN(v) || !isFinite(v)) { return '—'; }
      var s = (v * 100).toFixed(n == null ? 1 : n);
      return (v < 0 ? '↓' : '↑') + Math.abs(s) + '%';
    },
    deltaClass: function (v, invert) {
      if (v == null || isNaN(v) || !isFinite(v) || Math.abs(v) < 0.005) { return 'flat'; }
      var good = invert ? v < 0 : v > 0;
      return good ? 'up' : 'dn';
    },
    days: function (v) {
      if (v == null || !isFinite(v)) { return '—'; }
      if (v >= 999) { return '999+'; }
      return Math.round(v).toLocaleString('en-US');
    },
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  KAN.esc = esc;

  /* ── global filter state ───────────────────────────────────────────────── */

  var DATA_END = D.meta.dataEnd;
  var DATA_START = D.meta.dateMin;
  KAN.DATA_END = DATA_END;
  KAN.DATA_START = DATA_START;

  /* โหมดวิเคราะห์ — เปิดเฉพาะตอนดูเอง จะโชว์คำวินิจฉัยตรง ๆ (เช่นป้าย "เผาเงิน")
   * ที่ไม่เหมาะจะค้างอยู่บนจอตอนเปิดให้คนอื่นดู · ปิดไว้เป็นค่าเริ่มต้นเสมอ */
  KAN.pro = (function () {
    try { return localStorage.getItem('kan.pro') === '1'; } catch (e) { return false; }
  }());
  KAN.setPro = function (on) {
    KAN.pro = !!on;
    try { localStorage.setItem('kan.pro', KAN.pro ? '1' : '0'); } catch (e) { /* โหมดส่วนตัว */ }
  };

  KAN.state = {
    branch: 'all',       // 'all' | branch index
    preset: '30',        // 7 | 14 | 21 | 30 | 90 | mtd | lastmonth | ytd | custom
    from: addDays(DATA_END, -29),
    to: DATA_END,
    compare: true,
  };

  var PRESETS = KAN.PRESETS = [
    { id: '7', label: '7 วัน' },
    { id: '14', label: '14 วัน' },
    { id: '21', label: '21 วัน' },
    { id: '30', label: '30 วัน' },
    { id: '90', label: '90 วัน' },
    { id: 'mtd', label: 'เดือนนี้' },
    { id: 'lastmonth', label: 'เดือนก่อน' },
    { id: 'ytd', label: 'ทั้งปี' },
    { id: 'custom', label: 'กำหนดเอง' },
  ];

  function monthBounds(iso) {
    var d = parseISO(iso);
    var first = new Date(d.getFullYear(), d.getMonth(), 1);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: toISO(first), to: toISO(last) };
  }

  /* Resolve state.preset into concrete from/to, then derive the comparison
   * window. Month presets compare against the previous calendar month so the
   * "same length" rule doesn't straddle a month boundary. */
  KAN.applyPreset = function (preset) {
    var s = KAN.state;
    s.preset = preset;
    if (preset === 'custom') { return; }
    if (preset === 'mtd') {
      var m = monthBounds(DATA_END);
      s.from = m.from;
      s.to = DATA_END < m.to ? DATA_END : m.to;
    } else if (preset === 'lastmonth') {
      var prevMonth = addDays(monthBounds(DATA_END).from, -1);
      var pm = monthBounds(prevMonth);
      s.from = pm.from;
      s.to = pm.to;
    } else if (preset === 'ytd') {
      s.from = DATA_START;
      s.to = DATA_END;
    } else {
      var n = parseInt(preset, 10);
      s.to = DATA_END;
      s.from = addDays(DATA_END, -(n - 1));
    }
    if (s.from < DATA_START) { s.from = DATA_START; }
  };

  KAN.range = function () {
    var s = KAN.state;
    var from = s.from < DATA_START ? DATA_START : s.from;
    var to = s.to > DATA_END ? DATA_END : s.to;
    if (to < from) { to = from; }
    var days = diffDays(from, to) + 1;

    var prevFrom, prevTo;
    if (s.preset === 'lastmonth' || s.preset === 'mtd') {
      var pm = monthBounds(addDays(monthBounds(from).from, -1));
      prevFrom = pm.from;
      prevTo = s.preset === 'mtd'
        ? (function () {
            var cand = addDays(pm.from, days - 1);
            return cand > pm.to ? pm.to : cand;
          }())
        : pm.to;
    } else {
      prevTo = addDays(from, -1);
      prevFrom = addDays(prevTo, -(days - 1));
    }
    var prevValid = prevFrom >= DATA_START;

    return {
      from: from, to: to, days: days,
      i0: idxAtOrAfter(from), i1: idxAtOrBefore(to),
      prev: {
        from: prevFrom, to: prevTo,
        days: diffDays(prevFrom, prevTo) + 1,
        i0: idxAtOrAfter(prevFrom), i1: idxAtOrBefore(prevTo),
        valid: prevValid && KAN.state.compare,
      },
      label: thDate(from) + ' – ' + thDate(to),
    };
  };

  function idxAtOrAfter(iso) {
    if (dateIx[iso] != null) { return dateIx[iso]; }
    for (var i = 0; i < D.dates.length; i++) { if (D.dates[i] >= iso) { return i; } }
    return D.dates.length;
  }
  function idxAtOrBefore(iso) {
    if (dateIx[iso] != null) { return dateIx[iso]; }
    for (var i = D.dates.length - 1; i >= 0; i--) { if (D.dates[i] <= iso) { return i; } }
    return -1;
  }
  KAN.idxAtOrAfter = idxAtOrAfter;
  KAN.idxAtOrBefore = idxAtOrBefore;

  KAN.branchFilter = function () {
    var b = KAN.state.branch;
    return b === 'all' ? null : +b;
  };

  /* The export was taken mid-day, so the last date is a stub. It is real data
   * and stays in every total — it just must not drag down per-day averages. */
  KAN.partialDay = (function () {
    var a = (D.anomalies || []).filter(function (x) { return x.code === 'partial_last_day'; })[0];
    return a && a.samples.length ? a.samples[0] : null;
  }());
  var partialIx = KAN.partialDay != null ? dateIx[KAN.partialDay] : -1;

  /* ── POS receipts: the authoritative revenue source ────────────────────── */

  /* posDaily rows: [dateIx, branch, bills, gross, disc, net] */
  KAN.posTotals = function (i0, i1, branch) {
    var t = { bills: 0, gross: 0, disc: 0, net: 0, days: 0, fullDays: 0, fullNet: 0, fullBills: 0 };
    var seen = {}, seenFull = {};
    var rows = D.posDaily;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r[0] < i0 || r[0] > i1) { continue; }
      if (branch != null && r[1] !== branch) { continue; }
      t.bills += r[2]; t.gross += r[3]; t.disc += r[4]; t.net += r[5];
      if (!seen[r[0]]) { seen[r[0]] = 1; t.days++; }
      if (r[0] !== partialIx) {
        t.fullNet += r[5]; t.fullBills += r[2];
        if (!seenFull[r[0]]) { seenFull[r[0]] = 1; t.fullDays++; }
      }
    }
    t.avgBill = t.bills ? t.net / t.bills : 0;
    t.perDay = t.fullDays ? t.fullNet / t.fullDays : 0;
    t.billsPerDay = t.fullDays ? t.fullBills / t.fullDays : 0;
    t.discRate = t.gross ? t.disc / t.gross : 0;
    t.hasPartial = partialIx >= i0 && partialIx <= i1;
    return t;
  };

  KAN.posSeries = function (i0, i1, branch) {
    var n = i1 - i0 + 1;
    if (n <= 0) { return { labels: [], net: [], bills: [] }; }
    var net = new Array(n).fill(0), bills = new Array(n).fill(0), labels = [];
    for (var i = 0; i < n; i++) { labels.push(thDate(D.dates[i0 + i], 'short')); }
    var rows = D.posDaily;
    for (var k = 0; k < rows.length; k++) {
      var r = rows[k];
      if (r[0] < i0 || r[0] > i1) { continue; }
      if (branch != null && r[1] !== branch) { continue; }
      net[r[0] - i0] += r[5];
      bills[r[0] - i0] += r[2];
    }
    return { labels: labels, net: net, bills: bills, dates: D.dates.slice(i0, i1 + 1) };
  };

  KAN.posByBranch = function (i0, i1) {
    var out = D.branches.map(function () {
      return { bills: 0, net: 0, gross: 0, disc: 0, days: {} };
    });
    D.posDaily.forEach(function (r) {
      if (r[0] < i0 || r[0] > i1) { return; }
      var o = out[r[1]];
      o.bills += r[2]; o.gross += r[3]; o.disc += r[4]; o.net += r[5];
      o.days[r[0]] = 1;
    });
    out.forEach(function (o) {
      o.nDays = Object.keys(o.days).length;
      o.avgBill = o.bills ? o.net / o.bills : 0;
      var full = o.nDays - (o.days[partialIx] ? 1 : 0);
      o.perDay = full > 0 ? o.net / full : 0;
    });
    return out;
  };

  /* Bin arrays share the shape [dateIx, branch, binIx, bills, net]. */
  function binAgg(rows, i0, i1, branch, nBins) {
    var out = [];
    for (var i = 0; i < nBins; i++) { out.push({ bills: 0, net: 0 }); }
    for (var k = 0; k < rows.length; k++) {
      var r = rows[k];
      if (r[0] < i0 || r[0] > i1) { continue; }
      if (branch != null && r[1] !== branch) { continue; }
      out[r[2]].bills += r[3];
      out[r[2]].net += r[4];
    }
    return out;
  }
  /* ── สินค้าขายดี ────────────────────────────────────────────────────────
   * D.skuDaily = [dateIx, branchIx, skuIx, qty, net] เรียงตามวันอยู่แล้ว
   * ทุกฟังก์ชันในบล็อกนี้ทำงานบนช่วงวันที่ผู้ใช้เลือก ไม่ใช่ยอดทั้งปีสำเร็จรูป
   */

  var SKU = D.skuDaily || [];
  var POS_SKUS = D.posSkus || [];

  KAN.hasSkuData = SKU.length > 0;

  /* สาขาที่มีข้อมูลระดับสินค้าจริง — ไม่ใช่ทุกสาขาที่ส่งไฟล์ใบเสร็จรายสินค้ามา */
  KAN.skuBranches = (function () {
    var seen = {}, out = [];
    for (var i = 0; i < SKU.length; i++) {
      if (!seen[SKU[i][1]]) { seen[SKU[i][1]] = 1; out.push(SKU[i][1]); }
    }
    return out.sort(function (a, b) { return a - b; });
  }());

  function skuInfo(si) {
    var m = POS_SKUS[si];
    return m || { code: '?', name: '(ไม่ทราบชื่อ)', zone: '' };
  }
  KAN.skuInfo = skuInfo;

  /* จัดอันดับสินค้าในช่วงที่เลือก · จำผลไว้เพราะหน้าเดียวเรียกซ้ำหลายรอบ */
  var rankCache = {};
  KAN.skuRank = function (i0, i1, branch) {
    var key = i0 + '|' + i1 + '|' + (branch == null ? 'a' : branch);
    if (rankCache[key]) { return rankCache[key]; }

    var agg = {}, grand = 0;
    for (var i = 0; i < SKU.length; i++) {
      var r = SKU[i];
      if (r[0] < i0) { continue; }
      if (r[0] > i1) { break; }                 /* เรียงตามวัน — เลยช่วงแล้วหยุดได้ */
      if (branch != null && r[1] !== branch) { continue; }
      var a = agg[r[2]] || (agg[r[2]] = { si: r[2], qty: 0, net: 0, days: 0, _d: -1 });
      a.qty += r[3];
      a.net += r[4];
      if (a._d !== r[0]) { a.days++; a._d = r[0]; }
      grand += r[4];
    }

    var out = [];
    Object.keys(agg).forEach(function (k) {
      var a = agg[k], info = skuInfo(a.si);
      a.code = info.code; a.name = info.name || info.code; a.zone = info.zone;
      a.share = grand ? a.net / grand : 0;
      a.perDay = a.days ? a.net / a.days : 0;
      delete a._d;
      out.push(a);
    });
    out.sort(function (x, y) { return y.net - x.net || y.qty - x.qty; });
    out.forEach(function (a, i) { a.rank = i + 1; });
    out.total = grand;
    rankCache[key] = out;
    return out;
  };

  /* สินค้าที่ทำยอดสูงสุดของแต่ละวัน — ใช้ตอนเอาเมาส์ชี้กราฟรายวัน
   * คิดครั้งเดียวต่อ 1 ตัวเลือกสาขา แล้วเก็บไว้ (ไล่ทีละวัน ไม่กินหน่วยความจำ) */
  var topDayCache = {};
  function buildTopDay(branch) {
    var key = branch == null ? 'a' : branch;
    if (topDayCache[key]) { return topDayCache[key]; }
    var out = {}, curDate = -1, bucket = null;

    function flush() {
      if (curDate < 0 || !bucket) { return; }
      var bestSi = -1, best = null, sum = 0;
      Object.keys(bucket).forEach(function (k) {
        var v = bucket[k];
        sum += v[1];
        if (!best || v[1] > best[1]) { best = v; bestSi = +k; }
      });
      if (best && bestSi >= 0) {
        var info = skuInfo(bestSi);
        out[curDate] = { name: info.name || info.code, zone: info.zone,
                         qty: best[0], net: best[1], dayNet: sum };
      }
    }

    for (var i = 0; i < SKU.length; i++) {
      var r = SKU[i];
      if (branch != null && r[1] !== branch) { continue; }
      if (r[0] !== curDate) { flush(); curDate = r[0]; bucket = {}; }
      var b = bucket[r[2]] || (bucket[r[2]] = [0, 0]);
      b[0] += r[3]; b[1] += r[4];
    }
    flush();
    topDayCache[key] = out;
    return out;
  }
  KAN.topSkuOfDay = function (dateIx, branch) {
    return buildTopDay(branch)[dateIx] || null;
  };

  KAN.billBins = function (i0, i1, branch) {
    return binAgg(D.posBill, i0, i1, branch, D.billBins.length);
  };
  KAN.discBins = function (i0, i1, branch) {
    return binAgg(D.posDisc, i0, i1, branch, D.discBins.length);
  };
  KAN.payMix = function (i0, i1, branch) {
    return binAgg(D.posPay, i0, i1, branch, D.pays.length);
  };
  KAN.termMix = function (i0, i1, branch) {
    return binAgg(D.posTerm, i0, i1, branch, D.terminals.length);
  };

  /* Median bill, estimated from the bin histogram — we do not ship 89k raw
   * bills to the browser, so interpolate inside the bin that straddles p50. */
  var BIN_EDGES = [0, 100, 150, 200, 300, 400, 600, 800, 1200, 2500];
  KAN.medianBill = function (bins) {
    var total = bins.reduce(function (a, b) { return a + b.bills; }, 0);
    if (!total) { return 0; }
    var half = total / 2, run = 0;
    for (var i = 0; i < bins.length; i++) {
      if (run + bins[i].bills >= half) {
        var lo = BIN_EDGES[i], hi = BIN_EDGES[i + 1];
        var within = bins[i].bills ? (half - run) / bins[i].bills : 0;
        return lo + (hi - lo) * within;
      }
      run += bins[i].bills;
    }
    return BIN_EDGES[BIN_EDGES.length - 1];
  };

  /* posHour rows: [dateIx, branch, hour, bills, net] */
  KAN.hourDowMatrix = function (i0, i1, branch) {
    var hours = [], hourSet = {};
    var grid = {};      // dow -> hour -> {bills,net}
    var dowDays = {};   // dow -> set of dates (for per-day averaging)
    for (var k = 0; k < D.posHour.length; k++) {
      var r = D.posHour[k];
      if (r[0] < i0 || r[0] > i1) { continue; }
      if (branch != null && r[1] !== branch) { continue; }
      var dow = parseISO(D.dates[r[0]]).getDay();
      hourSet[r[2]] = 1;
      grid[dow] = grid[dow] || {};
      var cell = grid[dow][r[2]] = grid[dow][r[2]] || { bills: 0, net: 0 };
      cell.bills += r[3];
      cell.net += r[4];
      dowDays[dow] = dowDays[dow] || {};
      dowDays[dow][r[0]] = 1;
    }
    hours = Object.keys(hourSet).map(Number).sort(function (a, b) { return a - b; });
    /* Monday-first, matching how the shop reads its own week. */
    var order = [1, 2, 3, 4, 5, 6, 0];
    var matrix = order.map(function (dow) {
      var nd = Object.keys(dowDays[dow] || {}).length || 1;
      return hours.map(function (h) {
        var c = (grid[dow] || {})[h];
        return c ? c.net / nd : 0;
      });
    });
    var dowTotals = order.map(function (dow) {
      var sum = 0;
      Object.keys(grid[dow] || {}).forEach(function (h) { sum += grid[dow][h].net; });
      return sum;
    });
    /* A 30-day window holds 4 of some weekdays and 5 of others — comparing raw
     * sums would hand the extra day a 25% head start. */
    var dowCounts = order.map(function (dow) {
      return Object.keys(dowDays[dow] || {}).length;
    });
    var dowPerDay = dowTotals.map(function (v, i) {
      return dowCounts[i] ? v / dowCounts[i] : 0;
    });
    return {
      hours: hours,
      dows: order.map(function (d) { return TH_DOW[d]; }),
      dowsLong: order.map(function (d) { return TH_DOW_LONG[d]; }),
      matrix: matrix,
      dowTotals: dowTotals,
      dowCounts: dowCounts,
      dowPerDay: dowPerDay,
    };
  };

  /* ── zone-level sales (from the summary sheet) ─────────────────────────── */

  /* salesOut rows:
   * [dateIx, branch, zone, type, qty, gross, ret, refund, disc, net, cost] */
  KAN.zoneTotals = function (i0, i1, branch) {
    var by = {};
    for (var k = 0; k < D.salesOut.length; k++) {
      var r = D.salesOut[k];
      if (r[0] < i0 || r[0] > i1) { continue; }
      if (branch != null && r[1] !== branch) { continue; }
      var o = by[r[2]] || (by[r[2]] = { zone: r[2], qty: 0, net: 0, gross: 0, disc: 0, cost: 0, days: {} });
      o.qty += r[4]; o.gross += r[5]; o.disc += r[8]; o.net += r[9]; o.cost += r[10];
      o.days[r[0]] = 1;
    }
    return Object.keys(by).map(function (z) {
      var o = by[z];
      o.name = D.zones[o.zone] || '(ไม่ระบุโซน)';
      o.nDays = Object.keys(o.days).length;
      o.perDay = o.nDays ? o.net / o.nDays : 0;
      o.margin = o.net ? (o.net - o.cost) / o.net : null;
      delete o.days;
      return o;
    }).sort(function (a, b) { return b.net - a.net; });
  };

  /* ── how much of a branch's real sales the zone sheet actually captured ── */

  /* Outflow in the velocity engine comes from the summary sheet. Where that
   * sheet stopped tracking a branch, outflow reads as near-zero and every zone
   * there looks like dead stock. Comparing the sheet against POS receipts for
   * the same window tells us which branches we can trust. */
  /* Both directions matter. Under-reporting hides sales (zones look dead);
   * over-reporting means another branch's sales landed here (zones look
   * healthier than they are). Neither is safe to grade on. */
  var COVERAGE_MIN = 0.85, COVERAGE_MAX = 1.15;
  KAN.COVERAGE_MIN = COVERAGE_MIN;
  KAN.COVERAGE_MAX = COVERAGE_MAX;

  /* Prefix sums so a coverage check is O(branches), not O(rows) — the trusted
   * window search below runs it once per candidate day. */
  var cumSheet = D.branches.map(function () { return new Float64Array(KAN.nDates + 1); });
  var cumPos = D.branches.map(function () { return new Float64Array(KAN.nDates + 1); });
  D.salesOut.forEach(function (r) { if (r[0] >= 0) { cumSheet[r[1]][r[0] + 1] += r[9]; } });
  D.posDaily.forEach(function (r) { if (r[0] >= 0) { cumPos[r[1]][r[0] + 1] += r[5]; } });
  cumSheet.forEach(function (a) { for (var i = 1; i <= KAN.nDates; i++) { a[i] += a[i - 1]; } });
  cumPos.forEach(function (a) { for (var i = 1; i <= KAN.nDates; i++) { a[i] += a[i - 1]; } });

  KAN.branchCoverage = function (i0, i1) {
    var lo = Math.max(0, i0), hi = Math.min(KAN.nDates - 1, i1);
    return D.branches.map(function (b, i) {
      var s = hi >= lo ? cumSheet[i][hi + 1] - cumSheet[i][lo] : 0;
      var p = hi >= lo ? cumPos[i][hi + 1] - cumPos[i][lo] : 0;
      var ratio = p > 0 ? s / p : null;
      return {
        branch: i, name: b.name, kind: b.kind,
        posNet: p, sheetNet: s, ratio: ratio,
        /* A warehouse has no till, so there is nothing to reconcile against. */
        trusted: b.kind !== 'store' ? true
          : (ratio != null && ratio >= COVERAGE_MIN && ratio <= COVERAGE_MAX),
        direction: ratio == null ? null : (ratio < COVERAGE_MIN ? 'under' :
                   ratio > COVERAGE_MAX ? 'over' : 'ok'),
      };
    });
  };

  /* Latest window of `days` where every store's zone sheet still reconciles.
   * Used to offer the user a range where the stock analysis actually holds. */
  var trustedCache = {};
  KAN.lastTrustedWindow = function (days) {
    if (trustedCache[days] !== undefined) { return trustedCache[days]; }
    var result = null;
    for (var i1 = KAN.nDates - 1; i1 >= days - 1; i1--) {
      var cov = KAN.branchCoverage(i1 - days + 1, i1);
      var ok = cov.every(function (c) {
        return c.kind !== 'store' || c.posNet <= 0 || c.trusted;
      });
      if (ok) {
        result = { from: D.dates[i1 - days + 1], to: D.dates[i1], days: days };
        break;
      }
    }
    trustedCache[days] = result;
    return result;
  };

  /* ── zone classification ───────────────────────────────────────────────── */

  /* Not every "zone" is a shelf. Back-room bulk stock is held by weight and
   * never sold as-is; bag fees and coupon lines aren't merchandise at all.
   * Mixing them into velocity or promotion maths produces nonsense. */
  var zoneKinds = D.zoneKinds || D.zones.map(function () { return 'sales'; });
  KAN.zoneKind = function (z) { return zoneKinds[z] || 'unknown'; };
  KAN.isSalesZone = function (z) { return KAN.zoneKind(z) === 'sales'; };
  KAN.ZONE_KIND_LABEL = {
    sales: 'โซนขายหน้าร้าน',
    backroom: 'สต๊อกหลังร้าน (ชั่งกิโล)',
    nonsale: 'ไม่ใช่สินค้า (ค่าถุง/บริการ/คูปอง)',
    unknown: 'ไม่ระบุ',
  };

  /* ── stock movement engine ─────────────────────────────────────────────── */

  /* Per (branch, zone): cumulative inflow / outflow series across all dates.
   * Built once at load; every velocity question is a window read on top. */
  var stockKeys = [];
  var stockMap = {};

  function stockCell(b, z) {
    var key = b + '|' + z;
    var c = stockMap[key];
    if (!c) {
      c = stockMap[key] = {
        branch: b, zone: z, name: D.zones[z] || '(ไม่ระบุโซน)',
        opening: 0, openingValue: 0,
        inQty: new Float64Array(KAN.nDates), inVal: new Float64Array(KAN.nDates),
        outQty: new Float64Array(KAN.nDates), outVal: new Float64Array(KAN.nDates),
      };
      stockKeys.push(key);
    }
    return c;
  }

  D.opening.forEach(function (r) {           // [branch, zone, qty, value]
    var c = stockCell(r[0], r[1]);
    c.opening += r[2];
    c.openingValue += r[3];
  });
  D.stockIn.forEach(function (r) {           // [dateIx, branch, zone, type, qty, value, price, lotIx]
    if (r[0] < 0) { return; }
    var c = stockCell(r[1], r[2]);
    c.inQty[r[0]] += r[4];
    c.inVal[r[0]] += r[5];
  });
  D.salesOut.forEach(function (r) {
    if (r[0] < 0) { return; }
    var c = stockCell(r[1], r[2]);
    c.outQty[r[0]] += r[4];
    c.outVal[r[0]] += r[9];
  });
  D.transfers.forEach(function (r) {         // [dateIx, src, dest, zone, type, qty, value, sink]
    if (r[0] < 0) { return; }
    var src = stockCell(r[1], r[3]);
    src.outQty[r[0]] += r[5];
    src.outVal[r[0]] += r[6];
    if (r[2] >= 0) {
      var dst = stockCell(r[2], r[3]);
      dst.inQty[r[0]] += r[5];
      dst.inVal[r[0]] += r[6];
    }
  });

  KAN.stockCells = stockKeys.map(function (k) { return stockMap[k]; });

  function sumRange(arr, i0, i1) {
    var s = 0;
    for (var i = i0; i <= i1; i++) { s += arr[i]; }
    return s;
  }

  /* On-hand at the *start* of the window: opening balance plus everything that
   * moved before it. Clamped at zero — a negative balance means the sources
   * disagree, which the data-quality page reports separately. */
  function onHandBefore(c, i0) {
    var q = c.opening;
    for (var i = 0; i < i0; i++) { q += c.inQty[i] - c.outQty[i]; }
    return q;
  }

  /* The heart of the velocity view.
   *
   *   base        = stock you could have sold in the window
   *   sellThrough = how much of it actually left
   *   daysToPct   = how long it took to clear `pct` of that base
   */
  KAN.velocity = function (i0, i1, branch, pct, opts) {
    var days = i1 - i0 + 1;
    var target = pct == null ? 0.30 : pct;
    var o = opts || {};
    var out = [];
    var coverage = KAN.branchCoverage(i0, i1);

    KAN.stockCells.forEach(function (c) {
      if (branch != null && c.branch !== branch) { return; }
      /* The HUB is a warehouse with no till, and its opening balance is the
       * one corrupted by the duplicated sheet — it would top every "dead
       * stock" list for reasons that have nothing to do with selling. */
      if (!o.includeWarehouse && D.branches[c.branch].kind !== 'store') { return; }
      if (!o.includeBackroom && KAN.zoneKind(c.zone) !== 'sales') { return; }
      var openQty = Math.max(0, onHandBefore(c, i0));
      var inQty = sumRange(c.inQty, i0, i1);
      var outQty = sumRange(c.outQty, i0, i1);
      var outVal = sumRange(c.outVal, i0, i1);
      var inVal = sumRange(c.inVal, i0, i1);
      var base = openQty + inQty;
      if (base <= 0 && outQty <= 0) { return; }

      var closing = Math.max(0, base - outQty);
      var perDay = outQty / days;
      var sellThrough = base > 0 ? outQty / base : null;

      /* Walk the window forward until cumulative outflow crosses the target. */
      var need = base * target, run = 0, dayHit = null;
      if (base > 0) {
        for (var i = i0; i <= i1; i++) {
          run += c.outQty[i];
          if (run >= need) { dayHit = i - i0 + 1; break; }
        }
      }
      /* Not reached inside the window — project at the observed daily rate. */
      var projected = false;
      if (dayHit == null && perDay > 0 && base > 0) {
        dayHit = Math.ceil(need / perDay);
        projected = true;
      }

      var dsi = perDay > 0 ? closing / perDay : null;   // days of supply left
      var avgPrice = outQty > 0 ? outVal / outQty : (c.openingValue && c.opening ? c.openingValue / c.opening : 0);

      out.push({
        branch: c.branch, zone: c.zone, name: c.name, kind: KAN.zoneKind(c.zone),
        openQty: openQty, inQty: inQty, outQty: outQty, closing: closing,
        inVal: inVal, outVal: outVal,
        base: base, sellThrough: sellThrough, perDay: perDay,
        daysToPct: dayHit, projected: projected,
        dsi: dsi, closingValue: closing * avgPrice, avgPrice: avgPrice,
        /* An untrusted row is not graded — a missing outflow feed would show up
         * as "dead stock" and send someone to discount perfectly healthy goods. */
        trusted: coverage[c.branch].trusted,
        coverage: coverage[c.branch].ratio,
        grade: coverage[c.branch].trusted ? grade(sellThrough, dsi, outQty) : GRADES.na,
      });
    });

    return out.sort(function (a, b) { return b.closingValue - a.closingValue; });
  };

  /* Movement grade.
   *
   * Days-of-supply is the honest signal here, not sell-through: a 30-day
   * window against months of standing stock always yields a small percentage,
   * so grading on sell-through alone would paint almost every zone "dead".
   * Thresholds are calibrated against this business — the middle of the pack
   * sits around 150 days of supply. */
  var DSI_FAST = 60, DSI_OK = 150, DSI_SLOW = 365;
  var GRADES = KAN.GRADES = {
    dead: { key: 'dead', label: 'ค้างสต็อก', cls: 'dead',
            hint: 'ของพอขายเกิน 1 ปี หรือไม่ขยับเลย' },
    slow: { key: 'slow', label: 'ออกช้า', cls: 'slow',
            hint: 'ของพอขาย 150–365 วัน ควรกระตุ้น' },
    ok: { key: 'ok', label: 'ปกติ', cls: 'ok', hint: 'ของพอขาย 60–150 วัน' },
    fast: { key: 'fast', label: 'ออกเร็ว', cls: 'fast', hint: 'ของพอขายไม่ถึง 60 วัน' },
    na: { key: 'na', label: 'สรุปไม่ได้', cls: 'na',
          hint: 'ข้อมูลยอดขายของสาขานี้ไม่ครบ จึงยังตัดสินไม่ได้' },
  };
  KAN.DSI_THRESHOLDS = { fast: DSI_FAST, ok: DSI_OK, slow: DSI_SLOW };

  function grade(sellThrough, dsi, outQty) {
    if (sellThrough == null) { return GRADES.na; }
    if (outQty <= 0) { return GRADES.dead; }      // stock on hand, nothing sold
    if (dsi == null || !isFinite(dsi)) { return GRADES.dead; }
    if (dsi > DSI_SLOW) { return GRADES.dead; }
    if (dsi > DSI_OK) { return GRADES.slow; }
    if (dsi < DSI_FAST) { return GRADES.fast; }
    return GRADES.ok;
  }

  /* ── customer segmentation ─────────────────────────────────────────────── */

  /* customers rows: [branch, bills, spend, firstIx, lastIx, topTerminal] */

  /* "Regular" has to mean something relative to the window on screen: four
   * visits in a week is a very different customer from four in a year. */
  function loyaltyDefs(days) {
    var vipMin = Math.max(3, Math.ceil(days / 15));
    return [
      { key: 'vip', label: 'ขาประจำ', color: '#F2565A', min: vipMin,
        hint: 'ซื้อ ' + vipMin + ' บิลขึ้นไปในช่วงนี้' },
      { key: 'repeat', label: 'กลับมาซื้อ', color: '#2563EB', min: 2,
        hint: 'ซื้อ 2–' + (vipMin - 1) + ' บิลในช่วงนี้' },
      { key: 'once', label: 'ซื้อครั้งเดียว', color: '#9AA0B1', min: 1,
        hint: 'ซื้อครั้งเดียวในช่วงนี้' },
    ];
  }
  KAN.loyaltyDefs = loyaltyDefs;

  var RECENCY = KAN.RECENCY = [
    { key: 'active', label: 'ยังซื้ออยู่', color: '#16A34A', max: 30, hint: 'ซื้อภายใน 30 วัน' },
    { key: 'cooling', label: 'เริ่มห่าง', color: '#B45309', max: 60, hint: 'ห่างไป 31–60 วัน' },
    { key: 'sleeping', label: 'หลับ', color: '#DC2626', max: 90, hint: 'ห่างไป 61–90 วัน' },
    { key: 'lost', label: 'หายไป', color: '#6B7280', max: Infinity, hint: 'ห่างเกิน 90 วัน' },
  ];
  var SPEND = KAN.SPEND = [
    { key: 's', label: 'บิลเล็ก', color: '#9AA0B1', max: 300, hint: 'เฉลี่ยต่ำกว่า ฿300/บิล' },
    { key: 'm', label: 'บิลกลาง', color: '#2563EB', max: 800, hint: '฿300–799 ต่อบิล' },
    { key: 'l', label: 'บิลใหญ่', color: '#F2565A', max: Infinity, hint: '฿800 ขึ้นไปต่อบิล' },
  ];

  /* custEvents rows: [customerIx, dateIx, bills, net] — one per customer-day.
   * Rebuilding from these means frequency and recency are exact for whatever
   * window is on screen, instead of leaking purchases from outside it. */
  KAN.customerSegments = function (i0, i1, branch) {
    var endIso = D.dates[i1] || DATA_END;
    var days = i1 - i0 + 1;
    var LOYALTY = loyaltyDefs(days);

    /* Two populations, deliberately different:
     *   window  — who bought inside the range (frequency, basket size)
     *   base    — everyone who has ever bought up to the range end (recency)
     * Measuring recency on window buyers only would report "everyone active",
     * because by construction they all bought inside the window. */
    var win = {}, lastSeen = {};
    for (var k = 0; k < D.custEvents.length; k++) {
      var e = D.custEvents[k];
      if (e[1] > i1) { continue; }
      if (lastSeen[e[0]] == null || e[1] > lastSeen[e[0]]) { lastSeen[e[0]] = e[1]; }
      if (e[1] < i0) { continue; }
      var a = win[e[0]];
      if (!a) { a = win[e[0]] = { bills: 0, spend: 0, first: e[1], last: e[1] }; }
      a.bills += e[2];
      a.spend += e[3];
      if (e[1] < a.first) { a.first = e[1]; }
      if (e[1] > a.last) { a.last = e[1]; }
    }

    var rows = [];
    Object.keys(win).forEach(function (ix) {
      var c = D.customers[ix];
      if (!c) { return; }
      if (branch != null && c[0] !== branch) { return; }
      var a = win[ix];
      rows.push({
        ix: +ix, branch: c[0], term: c[5],
        bills: a.bills, spend: a.spend,
        firstIx: a.first, lastIx: a.last,
        /* Lifetime first purchase separates genuinely new customers from
         * existing ones who happened to return inside the window. */
        isNew: c[3] >= i0,
        avgBill: a.bills ? a.spend / a.bills : 0,
      });
    });

    var base = [];
    Object.keys(lastSeen).forEach(function (ix) {
      var c = D.customers[ix];
      if (!c) { return; }
      if (branch != null && c[0] !== branch) { return; }
      base.push({
        ix: +ix,
        lastIx: lastSeen[ix],
        recencyDays: diffDays(D.dates[lastSeen[ix]], endIso),
        spend: c[2],
      });
    });

    function bucket(defs, list, pick) {
      var out = defs.map(function (d) { return { def: d, n: 0, spend: 0, bills: 0 }; });
      list.forEach(function (c) {
        var i = pick(c);
        out[i].n++; out[i].spend += c.spend || 0; out[i].bills += c.bills || 0;
      });
      return out;
    }

    return {
      rows: rows,
      loyaltyDefs: LOYALTY,
      total: rows.length,
      newCount: rows.filter(function (c) { return c.isNew; }).length,
      totalSpend: rows.reduce(function (a, c) { return a + c.spend; }, 0),
      baseTotal: base.length,
      loyalty: bucket(LOYALTY, rows, function (c) {
        for (var i = 0; i < LOYALTY.length; i++) { if (c.bills >= LOYALTY[i].min) { return i; } }
        return LOYALTY.length - 1;
      }),
      spend: bucket(SPEND, rows, function (c) {
        for (var i = 0; i < SPEND.length; i++) { if (c.avgBill < SPEND[i].max) { return i; } }
        return SPEND.length - 1;
      }),
      recency: bucket(RECENCY, base, function (c) {
        for (var i = 0; i < RECENCY.length; i++) { if (c.recencyDays <= RECENCY[i].max) { return i; } }
        return RECENCY.length - 1;
      }),
      byTerminal: (function () {
        var by = {};
        rows.forEach(function (c) {
          if (c.term < 0) { return; }
          var o = by[c.term] || (by[c.term] = { term: c.term, name: D.terminals[c.term] || '—', n: 0, spend: 0 });
          o.n++; o.spend += c.spend;
        });
        return Object.keys(by).map(function (k) { return by[k]; })
          .sort(function (a, b) { return b.spend - a.spend; });
      }()),
    };
  };

  /* ── data-quality helpers ──────────────────────────────────────────────── */

  var SEV_RANK = { error: 3, warn: 2, info: 1 };
  KAN.anomalies = (D.anomalies || []).slice().sort(function (a, b) {
    return (SEV_RANK[b.severity] - SEV_RANK[a.severity]) || (b.count - a.count);
  });
  KAN.anomalyCount = function (sev) {
    return KAN.anomalies.filter(function (a) { return a.severity === sev; }).length;
  };

  /* The zone breakdown comes from a manually-kept sheet. Where that sheet has
   * drifted from POS, per-branch zone numbers are not safe to quote. */
  KAN.zoneTrustFrom = (function () {
    var months = KAN.anomalies
      .filter(function (a) { return a.code === 'branch_attribution_broken'; })
      .map(function (a) { return (a.samples[0] || '').slice(0, 7); })
      .filter(Boolean)
      .sort();
    return months.length ? months[0] : null;
  }());
  KAN.zoneTrustWarning = function (range) {
    if (!KAN.zoneTrustFrom) { return null; }
    var breakIso = KAN.zoneTrustFrom + '-01';
    if (range.to < breakIso) { return null; }
    return {
      from: KAN.zoneTrustFrom,
      overlaps: range.from < breakIso,
      text: 'ตัวเลขแยกตามโซนมาจากชีตสรุปที่ลงยอดผิดสาขาตั้งแต่ ' +
            thDate(breakIso, 'my') + ' เป็นต้นมา ' +
            'ยอดรวมทั้งบริษัทยังถูกต้อง แต่การแยก “โซน × สาขา” ในช่วงนี้เชื่อไม่ได้',
    };
  };

  /* ── misc ──────────────────────────────────────────────────────────────── */

  KAN.PALETTE = ['#F2565A', '#7A5CF0', '#F86D6D', '#2563EB', '#0EA5E9', '#14B8A6',
                 '#16A34A', '#84CC16', '#EAB308', '#F59E0B', '#EF4444', '#EC4899',
                 '#A855F7', '#64748B'];

  KAN.branchName = function (i) {
    var b = D.branches[i];
    return b ? b.name : '—';
  };
  KAN.scopeLabel = function () {
    var b = KAN.branchFilter();
    return b == null ? 'ทุกสาขา' : KAN.branchName(b);
  };

  /* Only stores sell; the HUB is a warehouse and would skew every average. */
  KAN.storeIndexes = D.branches
    .map(function (b, i) { return b.kind === 'store' ? i : -1; })
    .filter(function (i) { return i >= 0; });

}(window));
