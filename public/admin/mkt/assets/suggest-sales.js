/* KAN ERP — หน้า "โปรรายสาขา (จากฝ่ายขาย)"  (#/promo-sales)
 *
 * หลักการ: ฝ่ายการตลาดเห็นตัวเลขฝ่ายขายแล้วรู้ว่าต้องไปจัดโปรตรงไหน —
 * หน้านี้อ่าน data/sales-insight.js (สกัดจากแดชบอร์ดฝ่ายขาย ม.ค. 67 – ส.ค. 69)
 * เลือกดูได้ทีละสาขา ทุกใบพก "ที่มา ▸" เอาเมาส์ชี้ค้างเห็นหน้าต้นทางจริง
 * (iframe เลื่อนไปจุดนั้น + ไฮไลต์) แบบเดียวกับ provenance หน้า KPI
 * ต้องโหลดหลัง views.js เพราะ register view ลง KAN.views
 */
(function (global) {
  'use strict';

  var KAN = global.KAN, fmt = KAN.fmt, esc = KAN.esc, UI = KAN.UI;
  var SI = global.KAN_SALES_INSIGHT;
  var PAGE_URL = 'sales/';                       /* เปลือกมี sidebar */
  var EMBED_URL = 'sales/dashboard.html';        /* ตัวจริง ใช้ใน popup */

  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
              'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var DOW_LONG = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  function mLab(ym) {
    var p = ym.split('-');
    return TH_M[+p[1] - 1] + ' ' + (+p[0] + 543 - 2500);
  }
  function pctTxt(a, b) { return b ? Math.round((a / b - 1) * 100) + '%' : '—'; }

  /* ── ทะเบียนที่มา ────────────────────────────────────────────────────── */
  var SRC = {
    ztrend: { tab: 'store',   el: 'ch-ztrend', label: 'แนวโน้มยอดขายรายโซน' },
    ztable: { tab: 'store',   el: 't-zone',    label: 'ตารางยอดขายรายโซน' },
    dow:    { tab: 'store',   el: 'ch-dow',    label: 'ยอดขายเฉลี่ยตามวันในสัปดาห์' },
    heat:   { tab: 'store',   el: 'hm',        label: 'ช่วงเวลาขายดี — วัน × ชั่วโมง' },
    hour:   { tab: 'store',   el: 'ch-hour',   label: 'ยอดขายตามชั่วโมง' },
    pb:     { tab: 'store',   el: 'ch-pb',     label: 'ยอดขายตามกรอบราคา' },
    trend:  { tab: 'store',   el: 'ch-trend',  label: 'ยอดขายรายเดือน' },
    growth: { tab: 'store',   el: 'ch-growth', label: 'การเติบโต MoM / YoY' },
    store:  { tab: 'store',   el: 'ch-store',  label: 'ยอดขายแยกสาขา' },
    fmem:   { tab: 'fashion', el: 'kf-mem',    label: 'ลูกค้าระบุตัวได้ — KAN Fashion' },
  };
  var TAB_NAME = { store: 'KAN Store · ยอดขาย', fashion: 'KAN Fashion · ยอดขาย' };

  /* ── กติกา — คิดต่อ scope ('all' หรือ 's<i>') ───────────────────────── */
  function build(scopeKey) {
    if (!SI) { return []; }
    var C = SI.scopes[scopeKey];
    if (!C) { return []; }
    var isAll = scopeKey === 'all';
    var sc = (SI.meta.scopeList || []).filter(function (x) { return x.key === scopeKey; })[0];
    var scopeName = sc ? sc.label : scopeKey;
    var out = [];
    var F = mLab(SI.meta.full);
    var mm = {}; C.monthly.forEach(function (r) { mm[r.ym] = r.net; });

    /* โซนหลุดฟอร์ม — เทียบเฉลี่ย 3 เดือนของตัวเอง + ปีก่อน */
    C.zones
      .filter(function (z) { return z.avg3 >= (isAll ? 30000 : 12000) && z.net < z.avg3 * 0.88 && z.net < z.yoy; })
      .sort(function (a, b) { return (b.avg3 - b.net) - (a.avg3 - a.net); })
      .slice(0, isAll ? 2 : 3)
      .forEach(function (z) {
        var gap = z.avg3 - z.net;
        out.push({
          est: gap * 0.5, tone: 'i', tag: 'โซนอ่อนแรง', tagCls: 'r',
          scope: scopeName + ' · เดือน ' + F,
          title: 'โปรกระตุ้นโซน ' + z.name,
          metrics: [
            { label: 'ยอด ' + F, value: fmt.bahtK(z.net) },
            { label: 'เทียบเฉลี่ย 3 เดือน', value: pctTxt(z.net, z.avg3) },
            { label: 'เทียบปีก่อน', value: pctTxt(z.net, z.yoy) },
          ],
          why: 'โซนนี้' + (isAll ? '' : 'ของ' + scopeName) + 'ทำได้ ' + fmt.bahtK(z.net) +
               ' ต่ำกว่าค่าเฉลี่ย 3 เดือนของตัวเอง (' + fmt.bahtK(z.avg3) +
               ') และต่ำกว่าเดือนเดียวกันปีก่อน — ตกทั้งสองแกน ไม่ใช่แค่ฤดูกาล',
          action: 'จัดโปรเฉพาะโซน: เซ็ตสินค้าขายดีของโซนคู่กับชิ้นที่ค้าง + ป้ายชี้จากหน้าร้าน ' +
                  'และยิงคอนเทนต์หมวดนี้ในสัปดาห์แรกของเดือน',
          expect: 'ดึงยอดกลับครึ่งทางของค่าเฉลี่ย 3 เดือน = +' + fmt.bahtK(gap * 0.5) +
                  '/เดือน (สมมติฐาน: ความต้องการยังอยู่ — ปีก่อนโซนนี้ทำได้ ' + fmt.bahtK(z.yoy) + ')',
          src: ['ztrend', 'ztable'],
        });
      });

    /* วันแผ่วสุดของสัปดาห์ */
    (function () {
      var min = Infinity, mi = 0, sum = 0;
      C.dowAvg.forEach(function (v, i) { sum += v; if (v < min) { min = v; mi = i; } });
      if (!sum) { return; }
      var others = (sum - min) / 6;
      if (min >= others * 0.75) { return; }
      var est = min * 0.15 * 4.3;
      out.push({
        est: est, tone: 'b', tag: 'จังหวะเวลา', tagCls: 'a',
        scope: scopeName + ' · เฉลี่ย 3 เดือนล่าสุด',
        title: 'โปรเฉพาะวัน' + DOW_LONG[mi] + ' — วันที่เงียบสุดของ' + scopeName,
        metrics: [
          { label: 'เฉลี่ยวัน' + DOW_LONG[mi], value: fmt.bahtK(min) },
          { label: 'เฉลี่ยวันอื่น', value: fmt.bahtK(others) },
          { label: 'ส่วนต่าง', value: pctTxt(min, others) },
        ],
        why: 'วัน' + DOW_LONG[mi] + 'ขายเฉลี่ย ' + fmt.bahtK(min) + '/วัน เทียบวันอื่น ' +
             fmt.bahtK(others) + ' — เป็นช่องที่เติมได้โดยไม่กินยอดวันที่แน่นอยู่แล้ว',
        action: 'คูปองท้ายบิลเสาร์–อาทิตย์ให้กลับมาใช้เฉพาะวัน' + DOW_LONG[mi] +
                ' หรือดีลประจำวันนั้นที่สื่อสารซ้ำทุกสัปดาห์ให้คนจำ',
        expect: 'ยกยอดวัน' + DOW_LONG[mi] + 'ขึ้น 15% = +' + fmt.bahtK(est) +
                '/เดือน (สมมติฐาน: ~4.3 วัน/เดือน โปรไม่ดึงยอดจากวันอื่น)',
        src: ['dow', 'heat'],
      });
    }());

    /* ช่วง 3 ชม.ติดกันที่เบาสุดกลางวันทำการ (ตัดชม.แรก + 2 ชม.ท้าย) */
    (function () {
      var hs = C.hours;
      if (hs.length < 7) { return; }
      var lo = hs[0].h + 1, hi = hs[hs.length - 1].h - 2;
      var best = null;
      for (var i = 0; i + 2 < hs.length; i++) {
        if (hs[i].h < lo || hs[i + 2].h > hi) { continue; }
        if (hs[i + 1].h !== hs[i].h + 1 || hs[i + 2].h !== hs[i].h + 2) { continue; }
        var s = hs[i].avg + hs[i + 1].avg + hs[i + 2].avg;
        if (!best || s < best.s) { best = { s: s, from: hs[i].h, to: hs[i + 2].h }; }
      }
      var day = hs.reduce(function (a, x) { return a + x.avg; }, 0);
      if (!best || best.s > day * 0.2) { return; }
      var est = best.s * 0.20 * 30;
      out.push({
        est: est, tone: 'b', tag: 'จังหวะเวลา', tagCls: 'a',
        scope: scopeName + ' · เฉลี่ย 3 เดือนล่าสุด',
        title: 'Happy hour ' + best.from + ':00–' + (best.to + 1) + ':00 ที่' + scopeName,
        metrics: [
          { label: 'ยอดช่วงนี้/วัน', value: fmt.bahtK(best.s) },
          { label: 'สัดส่วนของวัน', value: Math.round(best.s / day * 100) + '%' },
          { label: 'ยอดทั้งวันเฉลี่ย', value: fmt.bahtK(day) },
        ],
        why: 'สามชั่วโมงนี้รวมกันขายแค่ ' + Math.round(best.s / day * 100) +
             '% ของวัน ทั้งที่ร้านเปิดและต้นทุนพนักงานเท่าเดิม',
        action: 'ดีลจำกัดเวลาเฉพาะช่วงนี้ (ลดหมวดเจาะจง / แถมเมื่อครบยอด) ป้ายหน้าร้าน + ' +
                'ไลน์บรอดแคสต์เช้าวันนั้น',
        expect: 'ยกยอดช่วงเงียบขึ้น 20% = +' + fmt.bahtK(est) +
                '/เดือน (สมมติฐาน: 30 วัน/เดือน ลูกค้ามาเพิ่มจริง ไม่ใช่ย้ายเวลา)',
        src: ['hour', 'heat'],
      });
    }());

    /* โครงสร้างราคา — ของชิ้นเล็กครองตะกร้า ใช้ขั้นบันได */
    (function () {
      var b = C.bands; if (!b || !b.rows.length) { return; }
      var mids = b.labels.map(function (l) {
        var n = l.replace(/[^0-9–\-]/g, '').split(/[–\-]/).map(Number).filter(function (x) { return x > 0; });
        if (!n.length) { return 15; }
        return n.length > 1 ? (n[0] + n[1]) / 2 : n[0] * 1.15;
      });
      var qty = b.rows.map(function (r) { return r.qty; });
      var totQ = qty.reduce(function (a, x) { return a + x; }, 0);
      var lowQ = qty[0] + (qty[1] || 0);
      if (!totQ || lowQ / totQ < 0.4) { return; }
      var est = 0.10 * lowQ / 3 * (mids[2] - (mids[0] + mids[1]) / 2);
      out.push({
        est: est, tone: 'i', tag: 'โครงสร้างราคา', tagCls: 'b',
        scope: scopeName + ' · 3 เดือนล่าสุด',
        title: 'ขั้นบันไดดันมูลค่าบิล — ของชิ้นเล็กครองตะกร้า',
        metrics: [
          { label: 'ชิ้นราคา ' + b.labels[0] + '/' + b.labels[1], value: Math.round(lowQ / totQ * 100) + '% ของชิ้น' },
          { label: 'ยอดจากกลุ่มนี้', value: fmt.bahtK(b.rows[0].net + (b.rows[1] ? b.rows[1].net : 0)) },
          { label: 'ชิ้นทั้งหมด', value: fmt.int(totQ) },
        ],
        why: 'ชิ้นที่ขายส่วนใหญ่อยู่กรอบราคาต่ำสุดสองขั้น — ลดราคาตรง ๆ กับกลุ่มนี้คือแจกมาร์จิน ' +
             'กลไกที่ถูกคือให้ "หยิบเพิ่มเพื่อให้ถึงเงื่อนไข"',
        action: 'ซื้อครบยอดแล้วลด/แถม (เช่น ครบ ฿300 ลด ฿30) + วางสินค้าราคาถัดขึ้นไป ' +
                'ใกล้แคชเชียร์ให้หยิบปิดยอดง่าย',
        expect: '10% ของชิ้นกลุ่มนี้ขยับขึ้นหนึ่งขั้นราคา = +' + fmt.bahtK(est) +
                '/เดือน (สมมติฐาน: ใช้ราคากลางของแต่ละกรอบเป็นตัวแทน)',
        src: ['pb'],
      });
    }());

    /* ฤดูกาลเดือนถัดไป — แพตเทิร์น 2 ปี */
    (function () {
      var last = SI.meta.full;
      var p = last.split('-'); var y = +p[0], m = +p[1];
      var nmM = (m + 2 > 12) ? m + 2 - 12 : m + 2;   /* เดือนถัดจากเดือนปัจจุบัน */
      var rs = [];
      [y - 2, y - 1].forEach(function (py) {
        var a = mm[py + '-' + ('0' + nmM).slice(-2)];
        var bse = mm[py + '-' + ('0' + (nmM - 1 || 12)).slice(-2)];
        if (a && bse) { rs.push(a / bse - 1); }
      });
      if (rs.length < 2) { return; }
      var d = (rs[0] + rs[1]) / 2;
      if (d > -0.05) { return; }
      var base = mm[last];
      var est = base * Math.abs(d) / 2;
      out.push({
        est: est, tone: 'a', tag: 'ฤดูกาล', tagCls: 'y',
        scope: scopeName + ' · แพตเทิร์น 2 ปีย้อนหลัง',
        title: 'เตรียมแคมเปญรับเดือน' + TH_M[nmM - 1] + ' — ปีก่อน ๆ ' + scopeName +
               'ตกเฉลี่ย ' + Math.round(Math.abs(d) * 100) + '%',
        metrics: [
          { label: TH_M[nmM - 1] + ' ' + (y - 1 + 543 - 2500), value: pctTxt(1 + rs[1], 1) },
          { label: TH_M[nmM - 1] + ' ' + (y - 2 + 543 - 2500), value: pctTxt(1 + rs[0], 1) },
          { label: 'ฐานเดือนล่าสุด', value: fmt.bahtK(base) },
        ],
        why: 'สองปีติดที่เดือน' + TH_M[nmM - 1] + 'หดจากเดือนก่อนหน้า — เป็นแพตเทิร์นฤดูกาล ' +
             'ที่วางแผนล่วงหน้าได้ ไม่ใช่เรื่องบังเอิญ',
        action: 'ล็อกแคมเปญลงปฏิทินก่อนต้นเดือน เปิดตัวโปรสัปดาห์แรก อย่ารอยอดตกแล้วค่อยแก้ ' +
                'เทงบแอดครึ่งเดือนแรก',
        expect: 'ลดการตกได้ครึ่งหนึ่ง = รักษายอด +' + fmt.bahtK(est) +
                ' (สมมติฐาน: การตกปีนี้ใกล้เคียงค่าเฉลี่ยสองปีก่อน)',
        src: ['trend', 'growth'],
      });
    }());

    /* เฉพาะ scope รวม: สาขาที่ตกทั้ง MoM+YoY และ Fashion CRM */
    if (scopeKey === 'fashion') { pushFashionCRM(out); }

    if (isAll && C.branches) {
      (function () {
        var worst = null;
        C.branches.forEach(function (b) {
          if (b.net < b.prev && b.yoy && b.net < b.yoy) {
            var gap = b.prev - b.net;
            if (!worst || gap > worst.gap) { worst = b; worst.gap = gap; }
          }
        });
        if (!worst || worst.gap < worst.prev * 0.08) { return; }
        var est = worst.gap * 0.5;
        var wname = worst.name === 'Fashion' ? 'KAN Fashion (สุราษฎร์)' : 'สาขา' + worst.name;
        out.push({
          est: est, tone: 'r', tag: 'รายสาขา', tagCls: 'r',
          scope: wname + ' · เดือน ' + F,
          title: 'โปรเฉพาะ' + wname + ' — สลับขอบเขตด้านบนเพื่อเจาะรายละเอียด',
          metrics: [
            { label: 'ยอด ' + F, value: fmt.bahtK(worst.net) },
            { label: 'เทียบเดือนก่อน', value: pctTxt(worst.net, worst.prev) },
            { label: 'เทียบปีก่อน', value: pctTxt(worst.net, worst.yoy) },
          ],
          why: wname + 'ตกทั้งเทียบเดือนก่อนและปีก่อน ขณะที่หน่วยอื่นไม่ตกแรงเท่า — ' +
               'ปัญหาอยู่ที่พื้นที่/หน่วยนั้น ไม่ใช่ภาพรวมตลาด',
          action: 'เลือกขอบเขต ' + wname + ' ด้านบนเพื่อเจาะโซน/วัน/ชั่วโมง ' +
                  'แล้วยิงแอดรัศมีรอบสาขา + ดีลเฉพาะจุด',
          expect: 'ดึงกลับครึ่งหนึ่งของที่หายไป = +' + fmt.bahtK(est) +
                  '/เดือน (สมมติฐาน: กำลังซื้อพื้นที่ยังอยู่ — ปีก่อนทำได้ ' + fmt.bahtK(worst.yoy) + ')',
          src: ['store'],
        });
      }());

      pushFashionCRM(out);
    }

    function pushFashionCRM(out) {
      (function () {
        var f = SI.fashion; if (!f || f.idrate >= 0.6) { return; }
        var buyers = Math.round(f.ncust / f.idrate);
        var plus = Math.round(buyers * 0.15);
        var perCust = f.net / f.ncust;
        var est = plus * perCust * 0.3;
        out.push({
          est: est, tone: 'g', tag: 'KAN Fashion', tagCls: 'g',
          scope: 'KAN Fashion · ' + f.days + ' วันแรกของธุรกิจ',
          title: 'เก็บเบอร์ลูกค้า Fashion ให้ได้ก่อน — ฐาน CRM คือแต้มต่อระยะยาว',
          metrics: [
            { label: 'ระบุตัวได้', value: Math.round(f.idrate * 100) + '%' },
            { label: 'ลูกค้าระบุตัว', value: fmt.int(f.ncust) + ' คน' },
            { label: 'ยอด/คน', value: fmt.baht(perCust) },
          ],
          why: 'Fashion เพิ่งเปิด ' + f.days + ' วัน ระบุตัวลูกค้าได้แค่ ' +
               Math.round(f.idrate * 100) + '% — ทุกบิลที่ไม่ได้เบอร์คือลูกค้าที่ตามกลับมาไม่ได้',
          action: 'โปรผูกสมาชิก: สมัคร LINE/ให้เบอร์รับส่วนลดทันที ณ จุดขาย Fashion ' +
                  'แล้วใช้ฐานนี้บรอดแคสต์คอลเลกชันใหม่',
          expect: 'อัตราระบุตัว +15 จุด ≈ ตามลูกค้าได้อีก ' + fmt.int(plus) + ' คน ถ้า 30% ' +
                  'ซื้อซ้ำ = +' + fmt.bahtK(est) + '/ไตรมาส (สมมติฐาน: ยอด/คนเท่าค่าเฉลี่ย)',
          src: ['fmem'],
        });
      }());
    }

    out.sort(function (a, b) { return b.est - a.est; });
    return out.slice(0, isAll ? 6 : 5);
  }

  /* ── popup "ที่มา" ───────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('sp-css')) { return; }
    var s = document.createElement('style');
    s.id = 'sp-css';
    s.textContent =
      '.srcrow{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:9px;border-top:1px solid #EDF1F4}' +
      '.spchip{font:inherit;font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px;cursor:pointer;' +
        'border:1px solid var(--line);background:#fff;color:var(--sub);display:inline-flex;gap:5px;align-items:center}' +
      '.spchip:hover{background:var(--indigo-soft);color:var(--indigo-deep);border-color:var(--indigo)}' +
      '.sp-pop{position:fixed;z-index:120;width:600px;max-width:94vw;background:var(--card);border:1px solid var(--line);' +
        'border-radius:13px;box-shadow:0 18px 54px rgba(20,26,31,.28);overflow:hidden;display:none;flex-direction:column}' +
      '.sp-pop.on{display:flex}' +
      '.sp-head{padding:11px 14px 9px;border-bottom:1px solid var(--line)}' +
      '.sp-eyebrow{font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--indigo)}' +
      '.sp-title{font-size:13.5px;font-weight:700;margin-top:2px}' +
      '.sp-path{font-size:11.5px;color:var(--muted);margin-top:2px}' +
      '.sp-body{position:relative;height:330px;background:var(--bg)}' +
      '.sp-frame{width:200%;height:200%;border:0;transform:scale(.5);transform-origin:0 0;display:block}' +
      '.sp-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
        'font-size:12.5px;color:var(--muted);pointer-events:none}' +
      '.sp-foot{padding:9px 14px;border-top:1px solid var(--line);display:flex;align-items:center;gap:8px}' +
      '.sp-open{font-size:12px;font-weight:700;color:var(--indigo-deep);text-decoration:none;margin-left:auto}' +
      '.sp-open:hover{text-decoration:underline}' +
      '.sp-note{font-size:11px;color:var(--muted)}';
    document.head.appendChild(s);
  }

  var pop = null, frame = null, hideTimer = null, curKey = null;

  function ensurePop() {
    if (pop) { return; }
    pop = document.createElement('div');
    pop.className = 'sp-pop';
    pop.innerHTML =
      '<div class="sp-head"><div class="sp-eyebrow">ที่มาของตัวเลข</div>' +
      '<div class="sp-title" id="spTitle"></div><div class="sp-path" id="spPath"></div></div>' +
      '<div class="sp-body"><div class="sp-load" id="spLoad">กำลังโหลดหน้าฝ่ายขาย…</div>' +
      '<iframe class="sp-frame" id="spFrame" loading="eager" title="พรีวิวแดชบอร์ดฝ่ายขาย"></iframe></div>' +
      '<div class="sp-foot"><span class="sp-note">พรีวิวสด — จุดที่ใช้ถูกไฮไลต์ไว้ · ตัวเลขในพรีวิวคือทุกสาขารวม</span>' +
      '<a class="sp-open" id="spOpen" target="_blank" rel="noopener">เปิดหน้าเต็ม →</a></div>';
    document.body.appendChild(pop);
    frame = pop.querySelector('#spFrame');
    frame.addEventListener('load', function () {
      var l = pop.querySelector('#spLoad'); if (l) { l.style.display = 'none'; }
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
    pop.querySelector('#spPath').textContent =
      'แดชบอร์ดฝ่ายขาย › แท็บ ' + (TAB_NAME[loc.tab] || loc.tab);
    pop.querySelector('#spOpen').href = PAGE_URL + '#' + peek;
    if (curKey !== key) {
      pop.querySelector('#spLoad').style.display = 'flex';
      /* เปลี่ยนเฉพาะ hash = ไฟล์ 6MB โหลดครั้งเดียว ครั้งถัดไปแค่เลื่อน */
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
    var pw = Math.min(600, window.innerWidth * 0.94);
    var x = Math.max(10, Math.min(r.left, window.innerWidth - pw - 10));
    var below = r.bottom + 420 < window.innerHeight || r.top < 440;
    pop.style.left = x + 'px';
    pop.style.top = below ? (r.bottom + 8) + 'px' : '';
    pop.style.bottom = below ? '' : (window.innerHeight - r.top + 8) + 'px';
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { if (pop) { pop.classList.remove('on'); } }, 260);
  }

  /* ── render ──────────────────────────────────────────────────────────── */
  var curScope = 'all';

  function chipHTML(keys) {
    return '<div class="srcrow">' + keys.map(function (k) {
      return '<button type="button" class="spchip" data-sp="' + k + '">ที่มา ▸ ' +
             esc(SRC[k].label) + '</button>';
    }).join('') + '</div>';
  }

  function cardsHTML(scopeKey) {
    var cards = build(scopeKey);
    if (!cards.length) {
      return UI.empty('ตัวเลขฝ่ายขายของขอบเขตนี้ไม่มีจุดที่เข้าเงื่อนไขพอจะเสนอ — ถือว่าเดือนล่าสุดอยู่ในเกณฑ์ปกติ');
    }
    return '<div class="actions">' + cards.map(function (s, i) {
      return '<div class="act ' + s.tone + '">' +
        '<div class="no"><span>S' + (i + 1) + '</span>' +
        '<span class="tag ' + s.tagCls + '">' + esc(s.tag) + '</span></div>' +
        '<div class="br">' + esc(s.scope) + '</div>' +
        '<h4>' + esc(s.title) + '</h4>' +
        '<div class="mini3">' + s.metrics.map(function (m) {
          return '<div class="mini"><small>' + esc(m.label) + '</small><b>' +
                 esc(m.value) + '</b></div>';
        }).join('') + '</div>' +
        '<div class="prob"><b>เห็นอะไรในข้อมูลฝ่ายขาย</b>' + esc(s.why) + '</div>' +
        '<div class="rec"><b>โปรที่แนะนำ</b>' + esc(s.action) + '</div>' +
        '<div class="prob"><b>ประเมินผลลัพธ์</b>' + esc(s.expect) + '</div>' +
        chipHTML(s.src) +
        '</div>';
    }).join('') + '</div>';
  }

  function wirePops(root) {
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

  function wireScopeChips() {
    document.querySelectorAll('#psScopes .qchip').forEach(function (c) {
      c.addEventListener('click', function () {
        curScope = c.getAttribute('data-scope');
        document.querySelectorAll('#psScopes .qchip').forEach(function (x) {
          x.classList.toggle('on', x === c);
        });
        var host = document.getElementById('psCards');
        host.innerHTML = cardsHTML(curScope);
        wirePops(host);
      });
    });
  }

  /* ── หน้าใหม่ในแอป: #/promo-sales ───────────────────────────────────── */
  if (KAN.views && SI) {
    KAN.views['promo-sales'] = {
      id: 'promo-sales',
      group: 'การตลาด',
      icon: '📣',
      title: 'โปรรายสาขา — จากข้อมูลฝ่ายขาย',
      lead: 'อ่านจากแดชบอร์ดฝ่ายขายทั้งชุด (ม.ค. 67 – ส.ค. 69) ฐาน = เดือนเต็มล่าสุด ' +
            mLab(SI.meta.full) + ' · เลือกสาขาเพื่อดูข้อเสนอเฉพาะพื้นที่ · ' +
            'หน้านี้ไม่ขยับตามตัวกรองช่วงเวลา',
      noFilter: true,
      render: function () {
        var chips = (SI.meta.scopeList || []).map(function (sc, i) {
          return '<button class="qchip' + (i === 0 ? ' on' : '') + '" data-scope="' + sc.key +
                 '"' + (sc.note ? ' title="' + esc(sc.note) + '"' : '') + '>' + esc(sc.label) + '</button>';
        }).join('');
        curScope = 'all';
        return '<div class="scope"><div>เลือกขอบเขต:</div></div>' +
          '<div class="filters" style="margin-top:0"><div class="chiprow" style="margin:0;padding:0;border:0" id="psScopes">' +
          chips + '</div></div>' +
          '<div class="sect" style="margin-top:14px"><div class="eyebrow">เชื่อมข้อมูลฝ่ายขาย</div>' +
          '<h2>ข้อเสนอโปรโมชัน</h2>' +
          '<div class="lead">เอาเมาส์ชี้ “ที่มา ▸” ใต้การ์ดจะเห็นหน้าต้นทางพร้อมไฮไลต์จุดที่ใช้ · ' +
          '<a href="' + PAGE_URL + '" style="color:var(--indigo-deep);font-weight:700">เปิดแดชบอร์ดยอดขาย (หลัก) →</a></div>' +
          '<div id="psCards" style="margin-top:12px">' + cardsHTML('all') + '</div></div>';
      },
      after: function () {
        wireScopeChips();
        wirePops(document.getElementById('psCards'));
      },
    };
    if (KAN.viewOrder) { KAN.viewOrder.push('promo-sales'); }
    KAN.suggestSalesDebug = { build: build, cards: cardsHTML };  /* ไว้ smoke test */
  }
}(window));
