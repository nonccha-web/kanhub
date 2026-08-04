/* KAN ERP — promotion suggestion engine.
 *
 * Every suggestion is derived from numbers already on screen elsewhere, and
 * carries the evidence that triggered it. Nothing here is a fixed template:
 * if the trigger condition isn't met the card doesn't appear.
 */
(function (global) {
  'use strict';

  var KAN = global.KAN;
  var fmt = KAN.fmt;

  /* Median bill the business is steering toward. Below this, threshold-style
   * mechanics pay; above it, discounting just gives away margin. */
  var TARGET_BILL = 400;

  function pct(a, b) { return b ? a / b : 0; }

  KAN.suggest = function (ctx) {
    var out = [];
    var scope = ctx.scopeLabel;

    /* The same zone name exists at several branches. When the user is looking
     * at all of them, a bare zone name is ambiguous. */
    function zl(v) {
      return ctx.branch == null
        ? v.name + ' (' + KAN.D.branches[v.branch].short + ')'
        : v.name;
    }

    /* ── stock-driven ─────────────────────────────────────────────────── */

    var dead = ctx.velocity.filter(function (v) {
      return v.grade.key === 'dead' && v.closingValue > 0;
    }).sort(function (a, b) { return b.closingValue - a.closingValue; });

    var fast = ctx.velocity.filter(function (v) { return v.grade.key === 'fast'; })
      .sort(function (a, b) { return b.outVal - a.outVal; });

    var slow = ctx.velocity.filter(function (v) { return v.grade.key === 'slow'; })
      .sort(function (a, b) { return b.closingValue - a.closingValue; });

    /* The hero of any bundle has to be something the shop can still put in a
     * customer's hand — a zone that sold out is useless as an anchor. */
    var stocked = fast.filter(function (v) { return v.closing > 0; });
    var deadValue = dead.reduce(function (a, v) { return a + v.closingValue; }, 0);

    dead.slice(0, 3).forEach(function (v) {
      var branchName = ctx.branch == null ? KAN.branchName(v.branch) : ctx.scopeLabel;
      var deep = v.closingValue > 200000;
      /* Half the pile in three weeks sounds decisive, but for a zone moving a
       * handful of pieces a day it means selling ten times faster than it ever
       * has. Size the goal off the observed rate, and say plainly when a
       * discount alone cannot get there. */
      var perWeek = v.perDay * 7;
      var halfPile = v.closing * 0.5;
      var weeksAtRate = perWeek > 0 ? halfPile / perWeek : Infinity;
      var hopeless = !(weeksAtRate <= 8);
      var goalQty = hopeless ? Math.round(perWeek * 3 * 4) : Math.round(halfPile);
      var goalWeeks = hopeless ? 4 : Math.max(3, Math.ceil(weeksAtRate));
      var goalValue = goalQty * v.avgPrice;
      var multiple = perWeek > 0 ? (goalQty / goalWeeks) / perWeek : null;
      out.push({
        rank: 100 + v.closingValue / 1000,
        tone: 'r', tag: 'ระบายสต็อก', tagCls: 'r',
        scope: branchName + ' · ' + v.name,
        title: deep ? 'ล้างสต็อก ' + v.name + ' แบบขั้นบันได' : 'จับคู่ระบาย ' + v.name,
        metrics: [
          { label: 'มูลค่าค้าง', value: fmt.bahtK(v.closingValue) },
          { label: 'ออกไปแล้ว', value: v.sellThrough == null ? '—' : fmt.pct(v.sellThrough, 0) },
          { label: 'ของพอขายอีก', value: v.dsi == null ? 'ไม่ขยับ' : fmt.days(v.dsi) + ' วัน' },
        ],
        why: 'ช่วง ' + ctx.range.days + ' วันที่ผ่านมา โซนนี้ขายออกเพียง ' +
             fmt.int(v.outQty) + ' ชิ้น จากของที่มีให้ขาย ' + fmt.int(v.base) + ' ชิ้น' +
             (v.dsi != null && isFinite(v.dsi)
               ? ' ถ้าขายด้วยความเร็วเท่านี้ต่อไป ของที่เหลือจะหมดในอีก ' + fmt.days(v.dsi) + ' วัน'
               : ' และแทบไม่มีการเคลื่อนไหวเลย'),
        action: (deep
          ? 'สัปดาห์ที่ 1 ลด 20% · สัปดาห์ที่ 2 ลด 35% · สัปดาห์ที่ 3 เหมา 3 ชิ้น ฿199 — ' +
            'ตั้งเพดานไว้ว่าห้ามต่ำกว่าทุน และหยุดทันทีเมื่อระบายได้ 70%'
          : 'จับคู่กับ' + (stocked[0] ? 'สินค้าในโซน ' + stocked[0].name : 'สินค้าที่ขายดี') +
            ' เป็นชุด “ซื้อคู่ลด 15%” วางไว้จุดชำระเงิน ไม่ต้องลดราคาป้าย') +
          (hopeless
            ? ' · สำคัญ: กองนี้ใหญ่เกินกว่าจะระบายด้วยการลดราคาอย่างเดียว ' +
              'ต้องหยุดสั่งเข้าโซนนี้ก่อน และโอนบางส่วนไปสาขาที่ขายตัวนี้ได้เร็วกว่าควบคู่ไปด้วย'
            : ''),
        expect: 'เป้าที่ทำได้จริง: ระบาย ' + fmt.int(goalQty) + ' ชิ้น (' +
                fmt.bahtK(goalValue) + ') ภายใน ' + goalWeeks + ' สัปดาห์' +
                (multiple != null && isFinite(multiple)
                  ? ' — คิดเป็น ' + fmt.dec(multiple, 1) + ' เท่าของอัตราขายปัจจุบัน (' +
                    fmt.dec(perWeek, 0) + ' ชิ้น/สัปดาห์)'
                  : '') +
                (hopeless
                  ? ' · ถ้าจะระบายครึ่งกอง (' + fmt.int(halfPile) +
                    ' ชิ้น) ด้วยความเร็วปัจจุบันต้องใช้เวลาถึง ' +
                    fmt.days(weeksAtRate) + ' สัปดาห์ ซึ่งไม่คุ้มที่จะรอ'
                  : ''),
        plan: { days: [0, 1, 2, 3, 4, 5, 6], week: 1, span: goalWeeks,
                owner: 'ผู้จัดการสาขา ' + KAN.branchName(v.branch),
                measure: 'ชิ้นที่ระบายได้ต่อสัปดาห์ เทียบเป้า ' +
                         fmt.int(goalQty / goalWeeks) + ' ชิ้น/สัปดาห์ (ปัจจุบัน ' +
                         fmt.dec(perWeek, 0) + ')' },
      });
    });

    if (slow.length >= 2 && fast.some(function (v) { return v.closing > 0; })) {
      var top = slow.slice(0, 3);
      var hero = stocked[0] || fast[0];
      out.push({
        rank: 70,
        tone: 'a', tag: 'กระตุ้นการหมุน', tagCls: 'a',
        scope: scope + ' · ' + slow.length + ' โซนที่ออกช้า',
        title: 'พ่วงสินค้าโซน ' + zl(top[0]) + ' เข้ากับโซนที่ขายดี',
        metrics: [
          { label: 'โซนที่ออกช้า', value: fmt.int(slow.length) + ' โซน' },
          { label: 'มูลค่าที่ค้างรวม', value: fmt.bahtK(slow.reduce(function (a, v) { return a + v.closingValue; }, 0)) },
          { label: 'โซนที่ใช้ดึง', value: zl(hero) },
        ],
        why: 'สามโซนที่ค้างมูลค่าสูงสุด: ' + top.map(function (v) {
          return zl(v) + ' ออกไป ' + (v.sellThrough == null ? '—' : fmt.pct(v.sellThrough, 0));
        }).join(' · ') + ' — ยังพอขายได้แต่ช้ากว่าที่ควร ยังไม่ถึงขั้นต้องลดราคาป้าย',
        action: 'ทำข้อเสนอที่จุดชำระเงิน: “ซื้อสินค้าในโซน ' + hero.name +
                ' แล้วเพิ่มอีก ฿99 รับสินค้าจากโซน ' + top[0].name + '” ' +
                (ctx.branch == null ? '(เริ่มที่สาขา' + KAN.branchName(hero.branch) + ') ' : '') +
                'ให้แคชเชียร์เสนอทุกบิล วัดผลจากจำนวนบิลที่รับข้อเสนอ',
        expect: 'ถ้า 1 ใน 5 บิลรับข้อเสนอ จะเพิ่มยอดต่อบิลราว ฿20 โดยไม่กระทบราคาป้าย',
        plan: { days: [0, 1, 2, 3, 4, 5, 6], week: 2, span: 2, owner: 'หัวหน้าแคชเชียร์',
                measure: 'สัดส่วนบิลที่รับข้อเสนอ (เป้า 20%)' },
      });
    }

    if (fast.length) {
      /* Out of stock is the urgent end of "fast" — nothing left to sell. */
      var starved = fast.filter(function (v) {
        return v.closing <= 0 || (v.dsi != null && v.dsi < 21);
      }).sort(function (a, b) { return (a.dsi || 0) - (b.dsi || 0); });
      if (starved.length) {
        var gone = starved.filter(function (v) { return v.closing <= 0; });
        out.push({
          rank: 85,
          tone: 'g', tag: 'อย่าเพิ่งลดราคา', tagCls: 'g',
          scope: scope + ' · ' + starved.length + ' โซน',
          title: gone.length
            ? 'ของหมดแล้วที่โซน ' + zl(gone[0]) + ' — รีบเติม'
            : 'เติมของโซน ' + zl(starved[0]) + ' ก่อนของขาด',
          metrics: starved.slice(0, 3).map(function (v) {
            return {
              label: zl(v),
              value: v.closing <= 0 ? 'หมดแล้ว' : fmt.days(v.dsi) + ' วัน',
            };
          }),
          why: (gone.length
            ? fmt.int(gone.length) + ' โซนขายจนของหมดเกลี้ยงในช่วงนี้ ทุกวันที่ชั้นว่างคือยอดที่หายไปเลย · '
            : '') +
            'โซนที่เหลือหมุนเร็วจนของที่มีพอขายได้ไม่ถึง 3 สัปดาห์ — ' +
            'การจัดโปรลดราคาให้โซนพวกนี้คือการขายของที่ยังไงก็ขายได้ ในราคาที่ถูกลง',
          action: 'ใส่โซนเหล่านี้ไว้หัวรายการสั่งของรอบถัดไป และกันออกจากทุกแคมเปญลดราคาในเดือนนี้',
          expect: 'ป้องกันยอดที่หายจากของขาด ประเมินจากอัตราขายปัจจุบัน ' +
                  fmt.dec(starved[0].perDay, 1) + ' ชิ้นต่อวัน',
          plan: { days: [], week: 1, span: 1, owner: 'ฝ่ายจัดซื้อ',
                  measure: 'จำนวนวันที่ชั้นว่าง (เป้า 0 วัน)' },
        });
      }
    }

    /* ── bill-size driven ─────────────────────────────────────────────── */

    var median = ctx.median;
    /* Weakest weekdays, measured per-day so an extra Monday in the window
     * doesn't make Monday look strong. Reused by two suggestions below. */
    var weakDays = null, strongDay = null, dowShare = null;
    if (ctx.heat.dowPerDay && ctx.heat.dowPerDay.length === 7) {
      var ranked = ctx.heat.dowPerDay
        .map(function (v, i) { return { i: i, v: v }; })
        .sort(function (a, b) { return a.v - b.v; })
        .filter(function (o) { return o.v > 0; });
      if (ranked.length >= 5) {
        weakDays = ranked.slice(0, 3);
        strongDay = ranked[ranked.length - 1];
        var allPerDay = ctx.heat.dowPerDay.reduce(function (a, v) { return a + v; }, 0);
        dowShare = allPerDay
          ? weakDays.reduce(function (a, o) { return a + o.v; }, 0) / allPerDay : null;
      }
    }
    function weakLabel(sep) {
      return weakDays ? weakDays.map(function (o) { return ctx.heat.dowsLong[o.i]; }).join(sep) : '';
    }

    if (median > 0 && median < TARGET_BILL) {
      var bins = ctx.billBins;
      /* Bills already close to the threshold are the ones a nudge can move. */
      var nearIx = [2, 3, 4];   // ฿150–199, ฿200–299, ฿300–399
      var near = nearIx.reduce(function (a, i) { return a + (bins[i] ? bins[i].bills : 0); }, 0);
      var nearNet = nearIx.reduce(function (a, i) { return a + (bins[i] ? bins[i].net : 0); }, 0);
      var totalBills = bins.reduce(function (a, b) { return a + b.bills; }, 0);
      var avgNear = near ? nearNet / near : 0;
      var lift = near * 0.15 * Math.max(0, TARGET_BILL - avgNear);
      out.push({
        rank: 95,
        tone: 'i', tag: 'ยกยอดต่อบิล', tagCls: 'b',
        scope: scope,
        title: 'ซื้อครบ ฿' + TARGET_BILL + ' ลด 5%' +
               (weakDays ? ' — เฉพาะวัน' + weakLabel('/') : ''),
        metrics: [
          { label: 'มัธยฐานบิล', value: fmt.baht(median) },
          { label: 'บิลที่ใกล้เส้น', value: fmt.int(near) + ' บิล' },
          { label: 'สัดส่วน', value: fmt.pct(pct(near, totalBills), 0) },
        ],
        why: 'ครึ่งหนึ่งของบิลอยู่ต่ำกว่า ' + fmt.baht(median) + ' ซึ่งห่างจากเป้า ฿' +
             TARGET_BILL + ' อยู่ ' + fmt.baht(TARGET_BILL - median) + ' และมี ' +
             fmt.int(near) + ' บิล (' + fmt.pct(pct(near, totalBills), 0) +
             ' ของทั้งหมด) ที่อยู่ในช่วง ฿150–399 คือใกล้เส้นพอที่จะดันข้ามได้',
        action: 'ตั้งเงื่อนไขที่ POS: ยอดถึง ฿' + TARGET_BILL + ' ลดทันที 5% ' +
                'ติดป้ายที่ชั้นวางและให้แคชเชียร์บอกยอดที่ยังขาดตอนสแกนใกล้จบ' +
                (weakDays ? ' — จำกัดเฉพาะวัน' + weakLabel('/') +
                  ' ซึ่งเป็นวันที่เงียบที่สุด จะได้ไม่ไปลดราคาในวัน' +
                  ctx.heat.dowsLong[strongDay.i] + 'ที่ขายดีอยู่แล้ว' : ''),
        expect: 'ถ้าดันบิลกลุ่มนี้ข้ามเส้นได้ 15% จะได้ยอดเพิ่มราว ' + fmt.bahtK(lift) +
                ' ต่อ ' + ctx.range.days + ' วัน (สมมติฐาน: อัตราแปลง 15%)',
        plan: { days: weakDays ? weakDays.map(function (o) { return o.i; }) : [0, 1, 2, 3],
                week: 1, span: 4, owner: 'ผู้จัดการฝ่ายขาย',
                measure: 'มัธยฐานยอดต่อบิล (จาก ' + fmt.baht(median) + ' → ฿' + TARGET_BILL + ')' },
      });
    }

    /* ── discount hygiene ─────────────────────────────────────────────── */

    var dbins = ctx.discBins;
    var dTotalNet = dbins.reduce(function (a, b) { return a + b.net; }, 0);
    var shallow = dbins[1] ? dbins[1].net : 0;       // ลด ≤5%
    if (dTotalNet > 0 && pct(shallow, dTotalNet) > 0.35) {
      out.push({
        rank: 90,
        tone: 'r', tag: 'หยุดส่วนลดเปล่า', tagCls: 'r',
        scope: scope,
        title: 'เลิกลด 5% แบบไม่มีเงื่อนไข',
        metrics: [
          { label: 'ยอดที่ถูกลด ≤5%', value: fmt.bahtK(shallow) },
          { label: 'สัดส่วนยอดขาย', value: fmt.pct(pct(shallow, dTotalNet), 0) },
          { label: 'ส่วนลดที่จ่ายไป', value: fmt.bahtK(ctx.totals.disc) },
        ],
        why: fmt.pct(pct(shallow, dTotalNet), 0) + ' ของยอดขายถูกลดราคาราว 5% ' +
             'โดยลูกค้าไม่ต้องทำอะไรเพิ่มเลย ส่วนลดแบบนี้ไม่เปลี่ยนพฤติกรรมการซื้อ ' +
             'แค่ลดกำไรลงตรง ๆ',
        action: 'ย้ายส่วนลดก้อนเดิมไปผูกกับเงื่อนไข — ให้ 5% เฉพาะเมื่อยอดถึง ฿' +
                TARGET_BILL + ' หรือซื้อครบ 3 ชิ้น งบส่วนลดเท่าเดิมแต่ได้ยอดต่อบิลกลับมา',
        expect: 'ถ้าย้ายได้ครึ่งหนึ่ง จะได้กำไรคืนราว ' + fmt.bahtK(ctx.totals.disc * 0.5) +
                ' ต่อ ' + ctx.range.days + ' วัน โดยยอดขายไม่ลด',
        plan: { days: [0, 1, 2, 3, 4, 5, 6], week: 1, span: 4, owner: 'ผู้จัดการฝ่ายขาย + IT (ตั้งค่า POS)',
                measure: 'สัดส่วนยอดที่ถูกลด ≤5% (จาก ' + fmt.pct(pct(shallow, dTotalNet), 0) + ' → ต่ำกว่า 15%)' },
      });
    }

    /* ── timing driven ────────────────────────────────────────────────── */

    var hm = ctx.heat;
    if (weakDays && dowShare != null && dowShare < 0.34) {
      /* Scale the per-day gap back up to the whole window so the money figure
       * matches the period the user is looking at. */
      var weeks = ctx.range.days / 7;
      var weakPerWeek = weakDays.reduce(function (a, o) { return a + o.v; }, 0);
      var weakWindow = weakPerWeek * weeks;
      out.push({
        rank: 80,
        tone: 'a', tag: 'เติมวันที่เงียบ', tagCls: 'a',
        scope: scope,
        title: 'ดันยอดวัน' + weakLabel(' / '),
        metrics: [
          { label: 'วันที่ดีที่สุด', value: hm.dowsLong[strongDay.i] +
            ' (' + fmt.bahtK(strongDay.v) + '/วัน)' },
          { label: 'วันที่เงียบสุด', value: hm.dowsLong[weakDays[0].i] +
            ' (' + fmt.bahtK(weakDays[0].v) + '/วัน)' },
          { label: 'ต่างกัน', value: weakDays[0].v ? (strongDay.v / weakDays[0].v).toFixed(1) + ' เท่า' : '—' },
        ],
        why: 'เทียบกันแบบต่อวัน วัน' + hm.dowsLong[strongDay.i] + 'ทำได้ ' +
             fmt.bahtK(strongDay.v) + ' ต่อวัน ขณะที่วัน' + hm.dowsLong[weakDays[0].i] +
             'ได้แค่ ' + fmt.bahtK(weakDays[0].v) + ' — สามวันที่เงียบที่สุดรวมกันคิดเป็น ' +
             fmt.pct(dowShare, 0) + ' ของยอดทั้งสัปดาห์ ทั้งที่ถ้ากระจายเท่ากันควรได้ราว 43%',
        action: 'จัดโปรเฉพาะวัน' + weakLabel('/') +
                ' เท่านั้น (เช่น สะสมแต้ม 2 เท่า หรือลดเพิ่มเมื่อครบยอด) ' +
                'ห้ามให้โปรตัวเดียวกันในวัน' + hm.dowsLong[strongDay.i] +
                ' เพราะวันนั้นขายได้อยู่แล้ว จะกลายเป็นลดราคาให้คนที่จะมาอยู่แล้ว',
        expect: 'ถ้าวันเงียบเพิ่มได้ 20% จะได้ยอดเพิ่มราว ' + fmt.bahtK(weakWindow * 0.2) +
                ' ต่อ ' + ctx.range.days + ' วัน',
        plan: { days: weakDays.map(function (o) { return o.i; }), week: 2, span: 4,
                owner: 'ฝ่ายการตลาด',
                measure: 'ยอดขายเฉลี่ยต่อวันของวัน' + weakLabel('/') + ' (เป้า +20%)' },
      });
    }

    /* ── customer driven ──────────────────────────────────────────────── */

    var seg = ctx.segments;
    if (seg.total > 0) {
      var once = seg.loyalty[2];
      if (pct(once.n, seg.total) > 0.45) {
        out.push({
          rank: 75,
          tone: 'b', tag: 'ลูกค้าใหม่', tagCls: 'b',
          scope: scope + ' · ขาจร',
          title: 'คูปองใบที่สอง สำหรับคนที่เพิ่งซื้อครั้งแรก',
          metrics: [
            { label: 'ซื้อครั้งเดียว', value: fmt.int(once.n) + ' คน' },
            { label: 'สัดส่วน', value: fmt.pct(pct(once.n, seg.total), 0) },
            { label: 'ในนั้นเป็นลูกค้าใหม่', value: fmt.int(seg.newCount) + ' คน' },
          ],
          why: fmt.pct(pct(once.n, seg.total), 0) + ' ของลูกค้าที่มีเบอร์โทรซื้อแค่ครั้งเดียว' +
               'ใน ' + ctx.range.days + ' วันนี้ และ ' + fmt.int(seg.newCount) +
               ' คนในนั้นเพิ่งซื้อกับร้านเป็นครั้งแรก — ' +
               'คนกลุ่มนี้รู้จักร้านแล้วจึงมีต้นทุนดึงกลับต่ำที่สุด',
          action: 'ท้ายใบเสร็จของลูกค้าใหม่ พิมพ์คูปองใช้ได้ภายใน 14 วัน ' +
                  '(ลด ฿50 เมื่อซื้อครบ ฿300) แล้ววัดว่ากี่ % กลับมาใช้',
          expect: 'ถ้าดึงกลับได้ 10% = ' + fmt.int(Math.round(once.n * 0.1)) +
                  ' คน จะได้ยอดเพิ่มราว ' + fmt.bahtK(once.n * 0.1 * 300),
          plan: { days: [0, 1, 2, 3, 4, 5, 6], week: 2, span: 4, owner: 'หัวหน้าแคชเชียร์',
                  measure: 'อัตราคูปองที่ถูกใช้กลับมา (เป้า 10%)' },
        });
      }

      var sleeping = seg.recency[2].n + seg.recency[3].n;
      var sleepSpend = seg.recency[2].spend + seg.recency[3].spend;
      if (seg.baseTotal && pct(sleeping, seg.baseTotal) > 0.25) {
        out.push({
          rank: 65,
          tone: 'i', tag: 'ดึงกลับ', tagCls: 'n',
          scope: scope + ' · หลับ/หายไป',
          title: 'ส่งข้อความหาลูกค้าที่หายไปเกิน 2 เดือน',
          metrics: [
            { label: 'ลูกค้าที่หายไป', value: fmt.int(sleeping) + ' คน' },
            { label: 'จากฐานทั้งหมด', value: fmt.pct(pct(sleeping, seg.baseTotal), 0) },
            { label: 'เคยใช้จ่ายรวม', value: fmt.bahtK(sleepSpend) },
          ],
          why: 'มี ' + fmt.int(sleeping) + ' คนที่เคยซื้อแล้วเงียบไปเกิน 60 วัน ' +
               'รวมยอดที่เคยใช้จ่าย ' + fmt.bahtK(sleepSpend) + ' — ' +
               'ถ้าไม่ทำอะไรกลุ่มนี้จะกลายเป็นลูกค้าที่หายถาวร',
          action: 'ส่ง SMS/LINE ชุดเดียว ระบุชื่อและของที่เคยซื้อ พร้อมส่วนลดใช้ได้ 7 วัน ' +
                  'แบ่งทดสอบสองข้อความเพื่อดูว่าแบบไหนได้ผล',
          expect: 'อัตราตอบกลับปกติของแคมเปญลักษณะนี้อยู่ที่ 3–8% = ' +
                  fmt.int(Math.round(sleeping * 0.05)) + ' คนโดยประมาณ',
          plan: { days: [1], week: 3, span: 1, owner: 'ฝ่ายการตลาด',
                  measure: 'จำนวนคนที่กลับมาซื้อภายใน 14 วันหลังส่ง' },
        });
      }

      var vip = seg.loyalty[0];
      if (vip.n > 0 && pct(vip.spend, seg.totalSpend) > 0.2) {
        out.push({
          rank: 55,
          tone: 'g', tag: 'รักษาฐาน', tagCls: 'g',
          scope: scope + ' · ขาประจำ',
          title: 'สิทธิพิเศษสำหรับ ' + fmt.int(vip.n) + ' คนที่สร้างยอดจริง',
          metrics: [
            { label: 'ขาประจำ', value: fmt.int(vip.n) + ' คน' },
            { label: 'คิดเป็น', value: fmt.pct(pct(vip.n, seg.total), 0) + ' ของลูกค้า' },
            { label: 'แต่สร้างยอด', value: fmt.pct(pct(vip.spend, seg.totalSpend), 0) },
          ],
          why: 'ลูกค้ากลุ่มนี้เป็นเพียง ' + fmt.pct(pct(vip.n, seg.total), 0) +
               ' ของฐาน แต่สร้างยอด ' + fmt.pct(pct(vip.spend, seg.totalSpend), 0) +
               ' — ความเสี่ยงที่ใหญ่กว่าคือเสียคนกลุ่มนี้ ไม่ใช่หาลูกค้าใหม่ไม่ได้',
          action: 'ให้สิทธิที่ไม่ใช่ส่วนลด เช่น เข้าก่อนวันลดราคา ส่งของฟรี หรือกันของรุ่นใหม่ไว้ให้ ' +
                  'รักษากำไรต่อบิลไว้ได้เต็ม',
          expect: 'ตัวชี้วัด: สัดส่วนยอดจากขาประจำต้องไม่ลดลงในเดือนถัดไป',
          plan: { days: [], week: 3, span: 4, owner: 'ผู้จัดการฝ่ายขาย',
                  measure: 'สัดส่วนยอดจากขาประจำ (ปัจจุบัน ' +
                           fmt.pct(pct(vip.spend, seg.totalSpend), 0) + ')' },
        });
      }
    }

    return out.sort(function (a, b) { return b.rank - a.rank; });
  };

  KAN.TARGET_BILL = TARGET_BILL;

}(window));
