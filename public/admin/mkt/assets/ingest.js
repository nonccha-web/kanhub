/* KAN ERP — data ingest.
 *
 * ทำไมต้องมีไฟล์นี้: เดิมข้อมูลทั้งหมดถูกอบมาจาก etl/build_data.py แล้ววางเป็น
 * data/kan-data.js ก้อนเดียว — อัปเดตทีต้องรันสคริปต์ที่เครื่องคนทำ ไฟล์นี้ย้าย
 * ขั้นตอน "อ่านไฟล์ดิบ → สรุปเป็นตัวเลข" มาไว้ในเบราว์เซอร์ ให้ผู้ใช้อัปโหลดเอง
 *
 * ขอบเขต: ไฟล์ใบเสร็จ POS (.csv) ซึ่งเป็นแหล่งข้อมูลของหน้า "ภาพรวมยอดขาย",
 * "กลุ่มลูกค้า" และตัวเลขฝั่งบิลทั้งหมด — ไฟล์ .xlsx (Stock Center / PoS Detail)
 * ยังใช้ชุดตั้งต้นอยู่ ดูหมายเหตุท้ายไฟล์
 *
 * กฎการรวมข้อมูล (เขียนไว้ตายตัว ไม่ตัดสินใจเป็นครั้ง ๆ):
 *   1. สาขาอ่านจากคอลัมน์ "ร้านค้า" (…#N → KST#N) ไม่ใช่จากชื่อไฟล์
 *   2. ไฟล์ที่เปิดใช้ จะ "ทับ" ข้อมูลตั้งต้นเฉพาะ (สาขา × ช่วงวันที่) ที่ไฟล์นั้นครอบคลุม
 *      — สาขาอื่นและวันอื่นยังใช้ของเดิม จึงอัปโหลดทีละสาขา/ทีละเดือนได้
 *   3. ถ้าไฟล์ใหม่ทับช่วงเดียวกับไฟล์เก่า ยึดไฟล์ที่อัปโหลดล่าสุด
 *   4. ทุกการกระทำ (อัปโหลด/เปลี่ยนชื่อ/เปิด-ปิด/ลบ) บันทึกลง log ลบไม่ได้
 */
(function (global) {
  'use strict';

  var DB_NAME = 'kan-erp-ingest', DB_VER = 1;
  var ST_FILES = 'files', ST_LOG = 'log', ST_STATE = 'state';

  var Ingest = global.KAN_INGEST = {};

  /* ── IndexedDB (ไฟล์ใบเสร็จเป็นเมกะไบต์ localStorage ไม่พอ) ─────────────── */

  var dbp = null;
  function db() {
    if (dbp) { return dbp; }
    dbp = new Promise(function (res, rej) {
      var rq = indexedDB.open(DB_NAME, DB_VER);
      rq.onupgradeneeded = function () {
        var d = rq.result;
        if (!d.objectStoreNames.contains(ST_FILES)) { d.createObjectStore(ST_FILES, { keyPath: 'id' }); }
        if (!d.objectStoreNames.contains(ST_LOG)) { d.createObjectStore(ST_LOG, { keyPath: 'id' }); }
        if (!d.objectStoreNames.contains(ST_STATE)) { d.createObjectStore(ST_STATE, { keyPath: 'k' }); }
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), s = t.objectStore(store), out;
        out = fn(s);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error); };
      });
    });
  }
  var all = function (store) { return tx(store, 'readonly', function (s) { return s.getAll(); }); };
  var put = function (store, v) { return tx(store, 'readwrite', function (s) { return s.put(v); }); };
  var del = function (store, k) { return tx(store, 'readwrite', function (s) { return s.delete(k); }); };

  function nowIso() { return new Date().toISOString(); }
  /* log เก็บชื่อสาขาที่คนอ่านรู้เรื่อง ไม่ใช่รหัส KST#N */
  function branchLabel(codes) {
    var D = global.KAN_DATA || global.KAN_BASE_DATA;
    var by = {};
    if (D && D.branches) { D.branches.forEach(function (b) { by[b.code] = b.short || b.name; }); }
    return codes.map(function (c) { return by[c] || c; }).join(', ');
  }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ── log (append-only) ─────────────────────────────────────────────────── */

  var logCache = [];
  function writeLog(action, target, detail) {
    var e = { id: uid('l'), at: nowIso(), action: action, target: target || '', detail: detail || '' };
    logCache.push(e);
    return put(ST_LOG, e).catch(function () {});
  }
  Ingest.log = function () { return logCache.slice().sort(function (a, b) { return b.at.localeCompare(a.at); }); };

  /* ── CSV ───────────────────────────────────────────────────────────────── */

  function splitCSV(text) {
    var rows = [], row = [], cell = '', q = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { q = false; } }
        else { cell += c; }
      } else if (c === '"') { q = true; }
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); cell = ''; rows.push(row); row = []; }
      else if (c !== '\r') { cell += c; }
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* ── กฎการแปลงค่า (ตรงกับ etl/build_data.py) ───────────────────────────── */

  /* ปีในไฟล์ POS เป็น ค.ศ. 2 หลัก (22/7/26) — 26 = 2026 */
  function parseWhen(v) {
    v = String(v || '').trim();
    if (!v) { return null; }
    var m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (m) {
      var y = +m[3];
      if (y < 100) { y += 2000; }
      return { y: y, mo: +m[2], d: +m[1], h: m[4] ? +m[4] : 0 };
    }
    m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (m) { return { y: +m[1], mo: +m[2], d: +m[3], h: m[4] ? +m[4] : 0 }; }
    return null;
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function isoOf(o) { return o.y + '-' + pad2(o.mo) + '-' + pad2(o.d); }
  function num(v) {
    if (v == null || v === '') { return 0; }
    var n = parseFloat(String(v).replace(/[,\s฿]/g, ''));
    return isFinite(n) ? n : 0;
  }
  function r2(x) { return Math.round(x * 100) / 100; }

  /* ช่องขนาดบิล / ช่วงส่วนลด — ต้องตรงกับ billBins/discBins ในชุดข้อมูลตั้งต้น */
  var BILL_EDGES = [0, 100, 150, 200, 300, 400, 600, 800, 1200, 1e9];
  var DISC_EDGES = [0, 0.001, 0.06, 0.11, 0.21, 1.01];
  function binOf(v, edges) {
    for (var i = 0; i < edges.length - 1; i++) { if (v >= edges[i] && v < edges[i + 1]) { return i; } }
    return edges.length - 2;
  }

  var NEED = ['วันที่', 'ยอดขายรวม', 'ส่วนลด', 'ยอดขายสุทธิ', 'ร้านค้า'];

  /* อ่านไฟล์ใบเสร็จ 1 ไฟล์ → ตัวเลขสรุปที่ dashboard ใช้ได้ตรง ๆ
   * คืน { branches, dates:[min,max], counts, agg:{...}, anomalies:[] } */
  function parseReceipts(text) {
    var rows = splitCSV(text);
    if (rows.length < 2) { throw new Error('ไฟล์ว่าง หรือไม่มีข้อมูลในไฟล์'); }
    var head = rows[0].map(function (h) { return String(h || '').replace(/^﻿/, '').trim(); });
    var missing = NEED.filter(function (n) { return head.indexOf(n) < 0; });
    if (missing.length) {
      throw new Error('ไฟล์นี้ไม่ใช่รายงานใบเสร็จ POS — หาคอลัมน์ไม่เจอ: ' + missing.join(', '));
    }
    var ix = {};
    head.forEach(function (h, i) { ix[h] = i; });
    var g = function (r, name) { var i = ix[name]; return i == null ? '' : (r[i] == null ? '' : r[i]); };

    var an = {};
    function flag(code, sev, title, detail, sample) {
      var a = an[code] || (an[code] = { code: code, severity: sev, title: title, detail: detail, count: 0, samples: [] });
      a.count++;
      if (sample && a.samples.length < 5) { a.samples.push(String(sample)); }
    }

    var daily = {}, hour = {}, bill = {}, disc = {}, pay = {}, term = {};
    var cust = {}, custEv = {};
    var branches = {}, dmin = null, dmax = null, kept = 0, skipped = 0;

    function acc(map, key, n, v) { var a = map[key] || (map[key] = [0, 0]); a[0] += n; a[1] += v; }

    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || row.length < 3) { continue; }
      var when = parseWhen(g(row, 'วันที่'));
      if (!when) { skipped++; continue; }

      /* กฎ 1 — สาขาอ่านจาก "ร้านค้า" (KAN Super Store สุราษฎร์#3 → KST#3) */
      var shop = String(g(row, 'ร้านค้า')).trim();
      var bm = shop.match(/#\s*(\d+)\s*$/);
      if (!bm) { flag('unknown_branch', 'error', 'ระบุสาขาไม่ได้', 'คอลัมน์ "ร้านค้า" ไม่มีรหัสสาขาต่อท้าย (…#N)', shop); skipped++; continue; }
      var bcode = 'KST#' + bm[1];

      var iso = isoOf(when);
      var net = num(g(row, 'ยอดขายสุทธิ'));
      var gross = num(g(row, 'ยอดขายรวม'));
      var dc = num(g(row, 'ส่วนลด'));
      var kind = String(g(row, 'ประเภทใบเสร็จ')).trim();
      var recNo = g(row, 'เลขที่ใบเสร็จ');

      /* กฎการคัดออก — ตรงกับ ETL เดิมทุกข้อ */
      if (kind === 'คืนเงิน' || net < 0) {
        flag('refund_receipt', 'info', 'ใบเสร็จคืนเงิน',
             'บิลที่เป็นการคืนเงิน แยกออกจากการคำนวณยอดขายและขนาดบิล', recNo);
        continue;
      }
      if (net === 0) {
        flag('zero_value_bill', 'warn', 'บิลยอด 0 บาท',
             'ใบเสร็จที่ยอดสุทธิเป็นศูนย์ ไม่นับเป็นบิลขายในสถิติขนาดบิล', recNo);
        continue;
      }
      if (gross > 0 && dc / gross > 0.9) {
        flag('extreme_discount', 'warn', 'ส่วนลดสูงผิดปกติ',
             'บิลที่ลดเกิน 90% ของยอดเต็ม ควรตรวจว่าเป็นการคีย์ผิดหรือของแถม',
             recNo + ' ลด ' + Math.round(dc) + ' จาก ' + Math.round(gross));
      }

      kept++;
      branches[bcode] = (branches[bcode] || 0) + 1;
      if (dmin == null || iso < dmin) { dmin = iso; }
      if (dmax == null || iso > dmax) { dmax = iso; }

      var k = bcode + '|' + iso;
      var a = daily[k] || (daily[k] = [0, 0, 0, 0]);
      a[0]++; a[1] += gross; a[2] += dc; a[3] += net;

      acc(hour, k + '|' + when.h, 1, net);
      acc(bill, k + '|' + binOf(net, BILL_EDGES), 1, net);
      acc(disc, k + '|' + binOf(gross > 0 ? dc / gross : 0, DISC_EDGES), 1, net);
      acc(pay, k + '|' + String(g(row, 'ประเภทการชำระเงิน')).trim(), 1, net);

      var tname = String(g(row, 'ระบบขายหน้าร้าน')).trim().replace(/^"|"$/g, '');
      acc(term, k + '|' + tname, 1, net);

      /* ลูกค้า: ตัวตน = (สาขา, เบอร์โทร) — เก็บ 1 แถวต่อคนต่อวัน เพื่อให้
       * ความถี่/ความสดคำนวณใหม่ได้ตามช่วงวันที่ที่ผู้ใช้เลือก */
      var phone = String(g(row, 'รายชื่อติดต่อลูกค้า')).trim();
      if (phone) {
        var ck = bcode + '|' + phone;
        var c = cust[ck] || (cust[ck] = { b: bcode, bills: 0, spend: 0, first: iso, last: iso, terms: {} });
        c.bills++; c.spend += net;
        if (iso < c.first) { c.first = iso; }
        if (iso > c.last) { c.last = iso; }
        c.terms[tname] = (c.terms[tname] || 0) + 1;
        var ek = ck + '|' + iso;
        var e = custEv[ek] || (custEv[ek] = [0, 0]);
        e[0]++; e[1] += net;
      }
    }

    if (!kept) { throw new Error('ไม่พบใบเสร็จที่นับเป็นยอดขายในไฟล์นี้'); }

    return {
      branches: Object.keys(branches).sort(),
      billsPerBranch: branches,
      from: dmin, to: dmax, kept: kept, skipped: skipped,
      anomalies: Object.keys(an).map(function (k) { return an[k]; }),
      agg: { daily: daily, hour: hour, bill: bill, disc: disc, pay: pay, term: term, cust: cust, custEv: custEv },
    };
  }
  Ingest.parseReceipts = parseReceipts;

  /* ── ประกอบชุดข้อมูล: ฐาน + ไฟล์ที่เปิดใช้ ─────────────────────────────── */

  /* กฎ 2/3 — ไฟล์เปิดใช้ทับฐานเฉพาะ (สาขา × ช่วงวันที่) ของตัวเอง,
   * ไฟล์ใหม่กว่าทับไฟล์เก่ากว่าเมื่อขอบเขตชนกัน */
  function applyFiles(base, files) {
    var act = files.filter(function (f) { return f.active; })
      .sort(function (a, b) { return a.uploadedAt.localeCompare(b.uploadedAt); }); // เก่า→ใหม่ ให้ใหม่เขียนทับ
    if (!act.length) { return base; }

    var bIx = {};
    base.branches.forEach(function (b, i) { bIx[b.code] = i; });

    /* ขอบเขตที่ถูกทับ: branchIx → [{from,to}] */
    var covered = {};
    act.forEach(function (f) {
      f.branches.forEach(function (code) {
        var i = bIx[code];
        if (i == null) { return; }
        (covered[i] || (covered[i] = [])).push({ from: f.from, to: f.to });
      });
    });
    function isCovered(bi, iso) {
      var list = covered[bi];
      if (!list) { return false; }
      for (var i = 0; i < list.length; i++) { if (iso >= list[i].from && iso <= list[i].to) { return true; } }
      return false;
    }

    /* 1) รวมรายการวันที่ใหม่ (ฐาน ∪ ไฟล์) แล้ว remap index เดิมทั้งหมด */
    var dateSet = {};
    base.dates.forEach(function (d) { dateSet[d] = 1; });
    act.forEach(function (f) { Object.keys(f.agg.daily).forEach(function (k) { dateSet[k.split('|')[1]] = 1; }); });
    var dates = Object.keys(dateSet).sort();
    var dIx = {};
    dates.forEach(function (d, i) { dIx[d] = i; });
    var remap = base.dates.map(function (d) { return dIx[d]; });
    var rd = function (i) { return (i == null || i < 0) ? -1 : (remap[i] == null ? -1 : remap[i]); };

    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    out.dates = dates;
    out.meta = JSON.parse(JSON.stringify(base.meta));

    function remapCol(rows, cols) {
      return (rows || []).map(function (r) {
        var c = r.slice();
        cols.forEach(function (i) { c[i] = rd(c[i]); });
        return c;
      });
    }
    out.salesOut = remapCol(base.salesOut, [0]);
    out.stockIn = remapCol(base.stockIn, [0, 7]);
    out.transfers = remapCol(base.transfers, [0]);
    out.kfSales = remapCol(base.kfSales, [0]);
    out.kfOrders = remapCol(base.kfOrders, [0]);

    /* 2) dim tables ที่ไฟล์อาจเพิ่มค่าใหม่ */
    var pays = base.pays.slice(), payIx = {};
    pays.forEach(function (v, i) { payIx[v] = i; });
    var terms = base.terminals.slice(), termIx = {};
    terms.forEach(function (v, i) { termIx[v] = i; });
    function dimIx(name, arr, map) { if (map[name] == null) { map[name] = arr.length; arr.push(name); } return map[name]; }

    /* 3) POS: เก็บของฐานเฉพาะแถวที่ไม่ถูกทับ แล้วเติมของไฟล์ */
    function keepBase(rows, dateCol, branchCol) {
      return (rows || []).filter(function (r) {
        var iso = base.dates[r[dateCol]];
        return !(iso && isCovered(r[branchCol], iso));
      }).map(function (r) { var c = r.slice(); c[dateCol] = rd(c[dateCol]); return c; });
    }
    var daily = keepBase(base.posDaily, 0, 1);
    var hour = keepBase(base.posHour, 0, 1);
    var billR = keepBase(base.posBill, 0, 1);
    var discR = keepBase(base.posDisc, 0, 1);
    var payR = keepBase(base.posPay, 0, 1);
    var termR = keepBase(base.posTerm, 0, 1);

    /* ไฟล์ใหม่ทับไฟล์เก่า: key ซ้ำ = ตัวหลังชนะ */
    var accD = {}, accH = {}, accB = {}, accDs = {}, accP = {}, accT = {};
    act.forEach(function (f) {
      var a = f.agg;
      Object.keys(a.daily).forEach(function (k) { accD[k] = a.daily[k]; });
      Object.keys(a.hour).forEach(function (k) { accH[k] = a.hour[k]; });
      Object.keys(a.bill).forEach(function (k) { accB[k] = a.bill[k]; });
      Object.keys(a.disc).forEach(function (k) { accDs[k] = a.disc[k]; });
      Object.keys(a.pay).forEach(function (k) { accP[k] = a.pay[k]; });
      Object.keys(a.term).forEach(function (k) { accT[k] = a.term[k]; });
    });
    function push3(store, target, mapName) {
      Object.keys(store).forEach(function (k) {
        var p = k.split('|'), bi = bIx[p[0]], di = dIx[p[1]], v = store[k];
        if (bi == null || di == null) { return; }
        var third = p[2];
        if (mapName === 'pay') { third = dimIx(third, pays, payIx); }
        else if (mapName === 'term') { third = dimIx(third, terms, termIx); }
        else { third = +third; }
        target.push([di, bi, third, v[0], r2(v[1])]);
      });
    }
    Object.keys(accD).forEach(function (k) {
      var p = k.split('|'), bi = bIx[p[0]], di = dIx[p[1]], v = accD[k];
      if (bi == null || di == null) { return; }
      daily.push([di, bi, v[0], r2(v[1]), r2(v[2]), r2(v[3])]);
    });
    push3(accH, hour, 'hour'); push3(accB, billR, 'bin');
    push3(accDs, discR, 'bin'); push3(accP, payR, 'pay'); push3(accT, termR, 'term');

    var byDate = function (a, b) { return a[0] - b[0] || a[1] - b[1] || (a[2] || 0) - (b[2] || 0); };
    out.posDaily = daily.sort(byDate);
    out.posHour = hour.sort(byDate);
    out.posBill = billR.sort(byDate);
    out.posDisc = discR.sort(byDate);
    out.posPay = payR.sort(byDate);
    out.posTerm = termR.sort(byDate);
    out.pays = pays;
    out.terminals = terms;

    /* 4) ลูกค้า — ตัวตนคือ (สาขา, เบอร์) ซึ่งชุดตั้งต้นไม่ได้เก็บเบอร์ไว้
     * จึงรวมข้ามแหล่งไม่ได้: สาขาที่มีไฟล์อัปโหลด = สร้างใหม่ทั้งสาขา,
     * สาขาที่ไม่มีไฟล์ = ใช้ของเดิม (คนละสาขาไม่ทับกันอยู่แล้ว) */
    var touched = {};
    Object.keys(covered).forEach(function (bi) { touched[bi] = 1; });
    var oldCust = base.customers || [], oldEv = base.custEvents || [];
    var keepIx = {}, customers = [], custEvents = [];
    oldCust.forEach(function (c, i) {
      if (touched[c[0]]) { return; }
      keepIx[i] = customers.length;
      customers.push([c[0], c[1], c[2], rd(c[3]), rd(c[4]), c[5]]);
    });
    oldEv.forEach(function (e) {
      var ni = keepIx[e[0]];
      if (ni == null) { return; }
      custEvents.push([ni, rd(e[1]), e[2], r2(e[3])]);
    });

    var merged = {};
    act.forEach(function (f) {
      Object.keys(f.agg.cust).forEach(function (k) {
        var s = f.agg.cust[k], m = merged[k];
        if (!m) { merged[k] = { b: s.b, bills: s.bills, spend: s.spend, first: s.first, last: s.last, terms: s.terms, ev: {} }; m = merged[k]; }
        else {
          m.bills += s.bills; m.spend += s.spend;
          if (s.first < m.first) { m.first = s.first; }
          if (s.last > m.last) { m.last = s.last; }
          Object.keys(s.terms).forEach(function (t) { m.terms[t] = (m.terms[t] || 0) + s.terms[t]; });
        }
      });
      Object.keys(f.agg.custEv).forEach(function (k) {
        var p = k.lastIndexOf('|'), ck = k.slice(0, p), iso = k.slice(p + 1);
        var m = merged[ck];
        if (m) { m.ev[iso] = f.agg.custEv[k]; }   // ไฟล์ใหม่ทับวันเดียวกัน
      });
    });
    Object.keys(merged).forEach(function (k) {
      var m = merged[k], bi = bIx[m.b];
      if (bi == null) { return; }
      var topTerm = -1, best = 0;
      Object.keys(m.terms).forEach(function (t) { if (m.terms[t] > best) { best = m.terms[t]; topTerm = dimIx(t, terms, termIx); } });
      var ci = customers.length;
      customers.push([bi, m.bills, r2(m.spend), dIx[m.first] == null ? -1 : dIx[m.first],
                      dIx[m.last] == null ? -1 : dIx[m.last], topTerm]);
      Object.keys(m.ev).forEach(function (iso) {
        var di = dIx[iso];
        if (di == null) { return; }
        custEvents.push([ci, di, m.ev[iso][0], r2(m.ev[iso][1])]);
      });
    });
    out.customers = customers;
    out.custEvents = custEvents.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });

    /* 5) meta + ธงว่ามาจากไฟล์ที่อัปโหลด */
    var lastIso = dates[dates.length - 1];
    var maxUp = act.reduce(function (m, f) { return f.to > m ? f.to : m; }, '');
    out.meta.dateMin = dates[0];
    out.meta.dateMax = lastIso;
    if (maxUp > base.meta.dataEnd) { out.meta.dataEnd = maxUp; }
    out.meta.sources = act.map(function (f) {
      return { id: f.id, name: f.name, filename: f.filename, from: f.from, to: f.to,
               branches: f.branches, bills: f.kept, uploadedAt: f.uploadedAt };
    });

    /* ความผิดปกติจากไฟล์ ต่อท้ายของเดิม เพื่อให้หน้า "คุณภาพข้อมูล" เห็นด้วย */
    var anomalies = (base.anomalies || []).slice();
    act.forEach(function (f) {
      (f.anomalies || []).forEach(function (a) {
        anomalies.push({ code: a.code, severity: a.severity, title: a.title, detail: a.detail,
                         source: f.filename, count: a.count, samples: a.samples || [] });
      });
    });
    out.anomalies = anomalies;
    return out;
  }
  Ingest.applyFiles = applyFiles;

  /* ── API ที่ UI เรียกใช้ ───────────────────────────────────────────────── */

  var filesCache = [];
  Ingest.files = function () {
    return filesCache.slice().sort(function (a, b) { return b.uploadedAt.localeCompare(a.uploadedAt); });
  };

  Ingest.add = function (file, name, text) {
    var res = parseReceipts(text);
    var rec = {
      id: uid('f'), name: name, filename: file.name, size: file.size,
      uploadedAt: nowIso(), active: true,
      from: res.from, to: res.to, kept: res.kept, skipped: res.skipped,
      branches: res.branches, billsPerBranch: res.billsPerBranch,
      anomalies: res.anomalies, agg: res.agg, csv: text,
    };
    return put('files', rec).then(function () {
      filesCache.push(rec);
      return writeLog('upload', rec.name,
        'ไฟล์ ' + rec.filename + ' · ' + res.kept.toLocaleString() + ' บิล · ' +
        res.from + ' → ' + res.to + ' · สาขา ' + branchLabel(res.branches) +
        (res.skipped ? ' · ข้ามแถวอ่านไม่ได้ ' + res.skipped : ''));
    }).then(function () { return rec; });
  };

  Ingest.rename = function (id, name) {
    var f = filesCache.filter(function (x) { return x.id === id; })[0];
    if (!f) { return Promise.resolve(); }
    var old = f.name;
    f.name = name;
    return put('files', f).then(function () { return writeLog('rename', name, 'เดิม: ' + old); });
  };

  Ingest.setActive = function (id, on) {
    var f = filesCache.filter(function (x) { return x.id === id; })[0];
    if (!f) { return Promise.resolve(); }
    f.active = !!on;
    return put('files', f).then(function () {
      return writeLog(on ? 'activate' : 'deactivate', f.name,
        f.from + ' → ' + f.to + ' · สาขา ' + branchLabel(f.branches));
    });
  };

  Ingest.remove = function (id) {
    var f = filesCache.filter(function (x) { return x.id === id; })[0];
    if (!f) { return Promise.resolve(); }
    filesCache = filesCache.filter(function (x) { return x.id !== id; });
    return del('files', id).then(function () {
      return writeLog('delete', f.name, 'ไฟล์ ' + f.filename + ' · ' + f.from + ' → ' + f.to);
    });
  };

  Ingest.csvOf = function (id) {
    var f = filesCache.filter(function (x) { return x.id === id; })[0];
    return f ? f.csv : null;
  };

  /* ── boot: โหลดชุดตั้งต้น → ทับด้วยไฟล์ → ค่อยโหลดแอป ─────────────────── */

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = function () { rej(new Error('โหลดไม่ได้: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function seq(list) {
    return list.reduce(function (p, src) { return p.then(function () { return loadScript(src); }); }, Promise.resolve());
  }

  Ingest.boot = function (opts) {
    var v = opts.v || '';
    return loadScript(opts.data + v)
      .then(function () {
        return Promise.all([all('files'), all('log')]).catch(function () { return [[], []]; });
      })
      .then(function (got) {
        filesCache = got[0] || [];
        logCache = got[1] || [];
        global.KAN_BASE_DATA = global.KAN_DATA;
        if (filesCache.some(function (f) { return f.active; })) {
          try {
            global.KAN_DATA = applyFiles(global.KAN_BASE_DATA, filesCache);
          } catch (e) {
            global.KAN_INGEST_ERROR = e.message;
          }
        }
        return seq(opts.scripts.map(function (s) { return s + v; }));
      });
  };

  /* หมายเหตุขอบเขต — Stock Center.xlsx และ PoS Report Detail.xlsx ยังไม่รับ
   * อัปโหลดผ่านหน้าเว็บ (ต้องมีตัวอ่าน .xlsx) หน้าที่ใช้ไฟล์สองตัวนี้ —
   * สินค้าเข้า–ออก / สินค้ารายตัว / ข้อเสนอโปรโมชันฝั่งสต็อก — ยังอ่านจากชุดตั้งต้น */

}(window));
