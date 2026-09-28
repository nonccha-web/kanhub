/* ============================================================
   KAN Admin — พาทัวร์ระบบ (กล่องลอยชี้ทีละจุด)
   ------------------------------------------------------------
   ทำไมเขียนเอง: ไลบรารีทัวร์ข้างนอกลากของมาเป็นร้อย KB เพื่อทำสิ่งที่
   ต้องการแค่ 3 อย่าง — เจาะช่องสว่างบนของที่ชี้ · วางการ์ดข้าง ๆ · ถัดไป/ย้อน
   ------------------------------------------------------------
   ใช้: KAN_TOUR.define('ชื่อ', { title, steps:[ { route, sel, title, text, pos } ] })
        KAN_TOUR.start('ชื่อ')  · KAN_TOUR.stop()  · KAN_TOUR.has('ชื่อ')
   step ที่ไม่มี sel = การ์ดกลางจอ (เปิด/ปิดทัวร์) · step ที่มี route = เปลี่ยนหน้าให้
   แล้วรอจนของโผล่ (หน้าเป็น SPA วาดทีหลัง) ถ้ารอ 4 วิไม่มา ก็โชว์การ์ดกลางจอแทน
   ============================================================ */
(function (global) {
  'use strict';

  var SEEN = 'kan-tour-seen';
  var T = { tours: {}, name: null, i: 0, ui: null, raf: 0, dead: true };

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function narrow() { return window.innerWidth < 700; }

  /* ---------- โครง DOM สร้างครั้งเดียวต่อรอบทัวร์ ---------- */
  function build() {
    var hole = document.createElement('div');
    hole.className = 'tour-hole';
    var card = document.createElement('div');
    card.className = 'tour-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-live', 'polite');
    document.body.appendChild(hole);
    document.body.appendChild(card);
    document.documentElement.classList.add('tour-on');
    T.ui = { hole: hole, card: card, target: null };
    card.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-t]');
      if (!b) return;
      var a = b.getAttribute('data-t');
      if (a === 'next') T.next();
      else if (a === 'prev') T.prev();
      else if (a === 'stop') T.stop();
    });
  }
  function teardown() {
    if (!T.ui) return;
    T.ui.hole.remove();
    T.ui.card.remove();
    document.documentElement.classList.remove('tour-on');
    if (T.ui.openedDrawer) document.documentElement.classList.remove('erp-open');
    T.ui = null;
  }

  /* ---------- ตำแหน่ง: ช่องสว่างทับของที่ชี้ การ์ดวางด้านที่มีที่ว่างสุด ---------- */
  function place() {
    if (!T.ui) return;
    var ui = T.ui, el = ui.target, card = ui.card, hole = ui.hole;
    var vw = window.innerWidth, vh = window.innerHeight;
    card.classList.toggle('tour-center', !el);
    if (!el) {
      hole.style.display = 'none';
      card.style.left = card.style.top = '';
      return;
    }
    var r = el.getBoundingClientRect(), pad = 8;
    hole.style.display = '';
    hole.style.left = (r.left - pad) + 'px';
    hole.style.top = (r.top - pad) + 'px';
    hole.style.width = (r.width + pad * 2) + 'px';
    hole.style.height = (r.height + pad * 2) + 'px';

    if (narrow()) { card.style.left = card.style.top = ''; card.classList.add('tour-sheet'); return; }
    card.classList.remove('tour-sheet');
    var cw = card.offsetWidth, ch = card.offsetHeight, gap = 14;
    var want = ui.pos || 'auto';
    var room = { bottom: vh - r.bottom, top: r.top, right: vw - r.right, left: r.left };
    var side = want;
    if (side === 'auto' || room[side] < (side === 'left' || side === 'right' ? cw : ch) + gap) {
      side = 'bottom';
      ['bottom', 'right', 'top', 'left'].some(function (s) {
        var need = (s === 'left' || s === 'right' ? cw : ch) + gap;
        if (room[s] >= need) { side = s; return true; }
        return false;
      });
    }
    var x, y;
    if (side === 'bottom') { x = r.left; y = r.bottom + gap; }
    else if (side === 'top') { x = r.left; y = r.top - ch - gap; }
    else if (side === 'right') { x = r.right + gap; y = r.top; }
    else { x = r.left - cw - gap; y = r.top; }
    x = Math.max(12, Math.min(x, vw - cw - 12));
    y = Math.max(12, Math.min(y, vh - ch - 12));
    card.style.left = x + 'px';
    card.style.top = y + 'px';
    card.setAttribute('data-side', side);
  }
  function schedulePlace() {
    if (T.raf) return;
    T.raf = requestAnimationFrame(function () { T.raf = 0; place(); });
  }

  /* ---------- รอให้ของโผล่ (หน้า SPA วาดทีหลัง) ---------- */
  function waitFor(sel, ms) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function tick() {
        var el = sel ? $(sel) : null;
        if (el || !sel || Date.now() - t0 > ms) return resolve(el);
        setTimeout(tick, 80);
      }());
    });
  }

  /* ---------- วาด step ---------- */
  function render(step, el) {
    var ui = T.ui, def = T.tours[T.name], n = def.steps.length, i = T.i;
    ui.target = el;
    ui.pos = step.pos;
    var missing = step.sel && !el;
    ui.card.innerHTML =
      '<div class="tour-h"><span class="tour-n">' + (i + 1) + ' / ' + n + '</span>' +
      '<span class="tour-name">' + esc(def.title) + '</span>' +
      '<button type="button" class="tour-x" data-t="stop" aria-label="ปิดทัวร์">✕</button></div>' +
      '<h3>' + esc(step.title) + '</h3>' +
      '<p>' + step.text + (missing ? '<br><small class="tour-miss">จุดนี้ยังไม่แสดงในหน้านี้ตอนนี้ — ข้ามไปก่อนได้</small>' : '') + '</p>' +
      '<div class="tour-f">' +
      '<span class="tour-dots">' + def.steps.map(function (_, k) { return '<i' + (k === i ? ' class="on"' : '') + '></i>'; }).join('') + '</span>' +
      '<span class="tour-btns">' +
      (i > 0 ? '<button type="button" class="tour-b ghost" data-t="prev">ย้อนกลับ</button>' : '') +
      '<button type="button" class="tour-b" data-t="next">' + (i === n - 1 ? 'จบทัวร์' : 'ถัดไป') + '</button>' +
      '</span></div>';
    if (el) {
      /* ของในเมนูซ้ายบนมือถือซ่อนอยู่ในลิ้นชัก ต้องเปิดก่อนถึงจะชี้ได้ */
      var inSide = el.closest('.erp-sidebar');
      if (inSide && narrow()) { document.documentElement.classList.add('erp-open'); ui.openedDrawer = true; }
      else if (ui.openedDrawer) { document.documentElement.classList.remove('erp-open'); ui.openedDrawer = false; }
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    }
    place();
    setTimeout(place, 60);       /* ฟอนต์/รูปโหลดช้าทำให้ขนาดขยับ วางซ้ำอีกที */
    /* ไม่ย้ายโฟกัสไปที่ปุ่ม — คีย์บอร์ดฟังที่ window อยู่แล้ว และการโฟกัสจะทำให้ขึ้นวงแดงเหมือน error */
  }

  function show(i) {
    var def = T.tours[T.name];
    if (!def) return;
    T.i = Math.max(0, Math.min(i, def.steps.length - 1));
    var step = def.steps[T.i];
    var token = ++T.seq;
    if (step.route && location.hash !== step.route) location.hash = step.route;
    waitFor(step.sel, step.route ? 4000 : 1200).then(function (el) {
      if (T.dead || token !== T.seq) return;   /* ผู้ใช้กดต่อ/ปิดไปแล้วระหว่างรอ */
      render(step, el);
    });
  }

  /* ---------- คีย์บอร์ด / ขยับจอ ---------- */
  function onKey(e) {
    if (T.dead) return;
    if (e.key === 'Escape') { e.preventDefault(); T.stop(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { if (e.target.closest && e.target.closest('input,textarea')) return; e.preventDefault(); T.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); T.prev(); }
  }

  /* ---------- API ---------- */
  T.seq = 0;
  T.define = function (name, def) { T.tours[name] = def; };
  T.has = function (name) { return !!T.tours[name]; };
  T.list = function () {
    return Object.keys(T.tours).map(function (k) { return { id: k, title: T.tours[k].title, mins: T.tours[k].mins || '' }; });
  };
  T.start = function (name) {
    if (!T.tours[name]) return false;
    T.stop();
    T.dead = false;
    T.name = name;
    build();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', schedulePlace);
    window.addEventListener('scroll', schedulePlace, true);
    show(0);
    return true;
  };
  T.stop = function (finished) {
    if (T.dead && !T.ui) return;
    if (finished && typeof T.onFinish === 'function') { try { T.onFinish(T.name); } catch (e) {} }
    T.dead = true;
    T.seq++;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', schedulePlace);
    window.removeEventListener('scroll', schedulePlace, true);
    teardown();
    try { localStorage.setItem(SEEN, '1'); } catch (e) {}
  };
  T.next = function () {
    var def = T.tours[T.name];
    if (!def) return;
    if (T.i >= def.steps.length - 1) { T.stop(true); return; }
    show(T.i + 1);
  };
  T.prev = function () { if (T.i > 0) show(T.i - 1); };
  T.seen = function () { try { return localStorage.getItem(SEEN) === '1'; } catch (e) { return true; } };
  T.active = function () { return !T.dead; };

  global.KAN_TOUR = T;
}(window));


/* ============================================================
   เนื้อหาทัวร์ของระบบงานทีม — แก้ข้อความที่นี่ที่เดียว
   sel = ของจริงในหน้า · route = หน้าที่ต้องไปก่อน
   ============================================================ */
(function (T) {
  'use strict';
  if (!T) return;

  T.define('overview', {
    title: 'ภาพรวมทั้งระบบ', mins: '2 นาที',
    steps: [
      { title: 'ยินดีต้อนรับสู่ระบบงานทีม KAN',
        text: 'ทัวร์นี้พาดูว่าอะไรอยู่ตรงไหนใน 2 นาที — กด <b>ถัดไป</b> หรือปุ่มลูกศร → บนคีย์บอร์ด กด <b>✕</b> ออกได้ตลอด แล้วกลับมาดูใหม่ได้จากปุ่ม “พาทัวร์” มุมขวาบน' },
      { sel: '.erp-sidebar .erp-link[href$="#/all"]', pos: 'right',
        title: 'เมนูซ้าย — ทางเข้าทุกหน้า',
        text: '<b>งานทั้งหมด</b> คือหน้าที่คุณจะเปิดบ่อยสุด — กดสวิตช์ <b>งานของฉัน</b> ในหน้านั้นเพื่อดูเฉพาะงานที่มอบหมายให้คุณ เรียงตามกำหนดส่ง' },
      { route: '#/all', sel: '.cards',
        title: 'ตัวเลข 4 ช่อง บอกสถานะวันนี้',
        text: 'งานค้าง · เลยกำหนด · ครบกำหนดวันนี้ · เสร็จใน 7 วัน — ถ้าช่อง “เลยกำหนด” เป็นสีแดง ให้ไล่ดูตรงนั้นก่อน' },
      { route: '#/all', sel: '.trow',
        title: 'แต่ละแถวคือ 1 งาน — กดเข้าไปได้',
        text: 'เห็นชื่องาน คนรับ ประเภทงาน KPI ที่ผูก และกำหนดส่ง · กดที่แถวเพื่อดูรายละเอียด เปลี่ยนสถานะ และแนบรูปงาน' },
      { route: '#/all', sel: '.tbar',
        title: 'งานทั้งหมด — มองทั้งทีม',
        text: 'เลือกช่วงเวลา (วันนี้ · สัปดาห์นี้ · เดือนนี้) · กด <b>ตัวกรอง</b> เพื่อดูเฉพาะคน ประเภทงาน หรือ KPI · <b>จัดกลุ่ม</b> ตามคนหรือตาม KPI ได้' },
      { route: '#/new', sel: '#draftHost .xl',
        title: 'สั่งงาน — กรอกเป็นตารางเหมือน Excel',
        text: 'แถวละ 1 งาน ช่องที่มี <b>*</b> ต้องกรอกให้ครบ (ชื่องาน ประเภท สั่งใคร กำหนดส่ง) แถวไหนไม่ครบขึ้นขีดแดง กดบันทึกไม่ได้จนกว่าจะครบ · ก็อปจาก Excel มาวางทั้งก้อนได้' },
      { route: '#/new', sel: '#pasteToggle', pos: 'bottom',
        title: 'วางจากแชตก็ได้',
        text: 'ก็อปข้อความสั่งงานจากไลน์มาวาง ระบบอ่าน @ชื่อ เป็นคนรับ อ่านวันเวลาเป็นกำหนดส่ง แล้วเทลงตารางให้ตรวจก่อนบันทึก' },
      { sel: '.erp-sidebar .erp-link[href$="#/posts"]', pos: 'right',
        title: 'ตารางโพสต์',
        text: 'แผนโพสต์ทุกเพจ ดูเป็นปฏิทินหรือรายการ พิมพ์ในตารางได้เหมือน Excel เหมือนกัน · โพสต์แล้ววางลิงก์ = นับว่าลงจริง' },
      { sel: '#headUser .bell', pos: 'bottom',
        title: 'กระดิ่ง — มีคนแท็กถึงคุณ',
        text: 'เวลามีคนพิมพ์ @ชื่อคุณในงานไหน จะมาเด้งที่นี่ · ในหน้าแจ้งเตือนมี 2 แท็บ ' +
          '<b>ยังไม่ได้ดู</b> คือคิวที่ต้องเคลียร์ · <b>ทั้งหมด</b> ย้อนดูของเก่าได้ กดพลาดก็ดึงกลับมาได้' },
      { sel: '[data-tour]', pos: 'bottom',
        title: 'กลับมาดูทัวร์ได้ตลอด',
        text: 'ปุ่มนี้มีทัวร์เฉพาะของหน้าที่เปิดอยู่ด้วย — อยู่หน้าไหนกดแล้วจะอธิบายหน้านั้น' },
      { title: 'พร้อมใช้แล้ว',
        text: 'เริ่มจาก <b>งานของฉัน</b> ดูว่าวันนี้มีอะไร · ทำเสร็จเข้าไปกดสถานะ + แนบรูป · ติดอะไรพิมพ์ @ชื่อหัวหน้าในงานนั้นได้เลย' }
    ]
  });

  T.define('me', {
    title: 'หน้างานของฉัน', mins: '1 นาที',
    steps: [
      { sel: '.cards', title: 'สถานะวันนี้ของคุณ',
        text: 'ค้าง · เลยกำหนด · วันนี้ · เสร็จใน 7 วัน — กดที่ช่องได้ จะเลื่อนไปกลุ่มนั้น' },
      { sel: '.group', title: 'งานถูกจัดกลุ่มตามความเร่ง',
        text: 'เลยกำหนด อยู่บนสุดเสมอ · ตามด้วยวันนี้ · ภายใน 7 วัน · ถัดไป · งานประจำอยู่ล่างสุด' },
      { sel: '.trow', title: 'กดที่แถวเพื่อทำงาน',
        text: 'เข้าไปเปลี่ยนสถานะ (รอทำ → กำลังทำ → เสร็จ) พิมพ์รายงาน แนบรูป หรือแท็กถามหัวหน้า' }
    ]
  });

  T.define('all', {
    title: 'หน้างานทั้งหมด', mins: '2 นาที',
    steps: [
      { sel: '#view .top-r', pos: 'bottom', title: 'สั่งงาน + ปัดตรวจ',
        text: '<b>+ สั่งงาน</b> เปิดตารางสั่งงานแบบ Excel · หัวหน้ามีปุ่ม <b>ปัดตรวจเลย</b> ไว้ไล่งานที่ส่งมาให้ตรวจทีละใบ' },
      { sel: '.cards', title: 'ตัวเลขบอกสถานะ',
        text: 'งานค้าง · เลยกำหนด · ครบกำหนดวันนี้ · เสร็จใน 7 วัน — กดที่ช่องเพื่อดูเฉพาะกลุ่มนั้น ช่อง “เลยกำหนด” เป็นสีแดงให้ไล่ตรงนั้นก่อน' },
      { sel: '.tbar .seg', pos: 'bottom', title: 'งานของฉัน / ทั้งทีม + ช่วงเวลา',
        text: 'สลับดูเฉพาะงานที่มอบให้คุณ หรือทั้งทีม · เลือกช่วง วันนี้ · สัปดาห์นี้ · เดือนนี้ · ทั้งหมด — งานเลยกำหนดกับงานประจำติดมาทุกช่วงเสมอ' },
      { sel: '[data-filter-toggle]', pos: 'bottom', title: 'ตัวกรอง + จัดกลุ่ม',
        text: '<b>ตัวกรอง</b> เลือกคน · ประเภทงาน · KPI · สถานะ (ตัวเลขบนปุ่ม = เปิดกรองอยู่กี่อย่าง) · ปุ่มถัดไปจัดกลุ่มตาม <b>กำหนดส่ง · คน · KPI</b> หรือดูเป็น <b>บอร์ด</b> ลากการ์ดข้ามขั้นได้' },
      { sel: '.trow [data-sel]', pos: 'right', title: 'เลือกหลายงาน แก้ทีเดียว',
        text: 'กดวงกลมหน้าแถวเพื่อเลือก (กด Shift ค้าง = เลือกเป็นช่วง · วงกลมท้ายหัวกลุ่ม = ทั้งกลุ่ม) แถบด้านล่างจะขึ้นให้ ตรวจผ่าน · เสร็จ · เปลี่ยนสถานะ · คนรับ · กำหนดส่ง · ลบ ได้ทีเดียว' },
      { sel: '.tlist', title: 'แต่ละแถว = 1 งาน',
        text: 'ป้ายใต้ชื่อบอกประเภทงาน KPI และรายการในปฏิทินที่ผูก · กดแถวเพื่อเข้าไปอัปเดต แนบรูป แท็กคน · ดินสอข้างชื่อ/คนรับ/กำหนดส่ง แก้ตรงแถวได้เลย · เมนู ⋯ ท้ายแถวมีติ๊กเสร็จและตรวจผ่าน' }
    ]
  });

  T.define('new', {
    title: 'หน้าสั่งงาน', mins: '1 นาที',
    steps: [
      { sel: '#draftHost .xl-tb thead', pos: 'bottom', title: 'คอลัมน์ที่มี * ต้องกรอก',
        text: 'ชื่องาน · ประเภทงาน · สั่งใคร · กำหนดส่ง · <b>KPI</b> — เวลาไม่ใส่ระบบตั้ง 18:00 ให้ · ' +
          'ช่อง KPI เลือก “งาน support — ไม่เข้า KPI” ได้ถ้างานนั้นไม่ควรนับเข้า KPI' },
      { sel: '#draftHost .xl-tb thead', pos: 'bottom', title: 'ชนิดงาน กับ ใช้เวลา',
        text: '<b>ชนิดงาน</b> แยกงานรูทีน (ทำประจำ) ออกจากงานตามสั่ง · <b>ใช้เวลา</b> ใส่ว่ากี่ชั่วโมง ' +
          'ไม่บังคับ แต่ถ้าใส่ไว้ หน้าสรุปผลงานจะบอกได้ว่าเวลาทีมไปลงกับอะไร' },
      { sel: '#draftHost .xl-bar', pos: 'bottom', title: 'พิมพ์ได้เหมือน Excel',
        text: 'Tab ไปช่องถัดไป · Enter ลงแถวใหม่ · ช่องประเภท/สั่งใคร/กำหนดส่ง กดแล้วเลือกจากรายการ · คลุมหลายช่องแล้ว Cmd+C / Cmd+V ได้ · Cmd+Z ย้อนกลับ' },
      { sel: '#pasteToggle', pos: 'bottom', title: 'วางจากแชต',
        text: 'มีข้อความสั่งงานจากไลน์อยู่แล้ว วางตรงนี้ ระบบแยกเป็นแถวให้ พร้อมเดาประเภทงานกับคนรับ' },
      { sel: '#draftBar', pos: 'top', title: 'บันทึกเมื่อครบ',
        text: 'แถบล่างบอกว่ามีกี่งาน กี่แถวยังกรอกไม่ครบ ขาดอะไร — ครบแล้วปุ่ม <b>บันทึกทั้งหมด</b> ถึงจะกดได้' }
    ]
  });

  T.define('task', {
    title: 'หน้ารายละเอียดงาน', mins: '1 นาที',
    steps: [
      { sel: '.top', title: 'หัวงาน', text: 'ชื่องาน คนรับ กำหนดส่ง ประเภท และใครสั่ง — หัวหน้ากด <b>แก้ไขงาน</b> เพื่อเปลี่ยนได้' },
      { sel: '#stChips', pos: 'bottom', title: 'เปลี่ยนสถานะที่นี่',
        text: 'รอทำ → กำลังทำ → เสร็จแล้ว · ถ้าติดอะไรกด <b>ติดปัญหา</b> แล้วพิมพ์บอกว่าติดตรงไหน' },
      { sel: '#updForm textarea', pos: 'top', title: 'พิมพ์รายงาน + แท็กคน',
        text: 'พิมพ์ @ชื่อ เพื่อแท็ก คนนั้นจะได้กระดิ่ง · เช่น “@Nont แบบเสร็จแล้วครับ ขอเคาะ”' },
      { sel: '#drop', pos: 'top', title: 'แนบรูป / ไฟล์ / ลิงก์',
        text: 'ลากรูปมาวาง หรือกดเลือก · รูปย่อให้เอง · วางลิงก์ Drive/YouTube ก็ได้' },
      { sel: '#updBtn', pos: 'top', title: 'กดบันทึกอัปเดต',
        text: 'ทุกอย่างที่ทำจะขึ้นเป็นไทม์ไลน์ด้านล่าง ย้อนดูได้ว่าใครทำอะไรเมื่อไหร่' },
      { sel: '#reviewForm', pos: 'top', title: 'ตรวจงาน (เห็นเฉพาะหัวหน้า)',
        text: 'พอน้องกด <b>ส่งให้ตรวจ</b> งานจะเด้งมาที่หัวหน้า — กด <b>ตรวจผ่าน</b> เพื่อปิดงาน หรือ <b>ส่งกลับแก้</b> พร้อมบอกว่าให้แก้อะไร งานจะกลับไปเป็น “กำลังทำ” และน้องได้กระดิ่ง' }
    ]
  });

  T.define('posts', {
    title: 'ตารางโพสต์', mins: '1 นาที',
    steps: [
      { sel: '#newPost', pos: 'bottom', title: 'เพิ่ม/แก้โพสต์ — ทางเดียว',
        text: 'กดแล้วเปิดตารางแบบ Excel พิมพ์ได้ทีละหลายโพสต์ ก็อปวางกับ Excel ได้ · กด “แก้” ที่โพสต์ไหนก็เปิดตารางนี้พร้อมดึงแถวนั้นขึ้นบนสุด' },
      { sel: '.cards', title: 'ค้างอะไรอยู่',
        text: '<b>ยังไม่ได้โพสต์</b> · <b>โพสต์แล้วแต่ไม่มีลิงก์</b> (ตรวจไม่ได้ว่าขึ้นจริง) — กดการ์ดเพื่อดูเฉพาะกลุ่มนั้น · วางลิงก์โพสต์เมื่อไหร่ ระบบนับว่าโพสต์แล้วให้เอง' },
      { sel: '.tbar', pos: 'bottom', title: 'ปฏิทิน / รายการ + เลื่อนเดือน',
        text: 'สลับดูเป็นปฏิทินเดือนหรือรายการยาว · ‹ › เลื่อนเดือน · “เดือนนี้” กลับมาเดือนปัจจุบัน' },
      { sel: '.ptabs', pos: 'bottom', title: 'เลือกทีละเพจ',
        text: 'ตัวเลขข้างชื่อเพจคือจำนวนโพสต์ สีเหลือง = ยังมีโพสต์ค้างในเพจนั้น' },
      { sel: '.cal, .plist, .tlist', title: 'สีบอกสถานะ',
        text: 'เขียว = โพสต์แล้วมีลิงก์ · เหลือง = โพสต์แล้วแต่ไม่มีลิงก์ · แดง = เลยวันแล้วยังไม่โพสต์ · เทา = ยังไม่ถึงวัน — กดวันไหนเพื่อดูและอัปเดตโพสต์ของวันนั้น' },
      { sel: '#postLog', pos: 'top', title: 'ประวัติการแก้ล่าสุด',
        text: 'ใครเพิ่ม/แก้/ลบโพสต์ไหน เมื่อไหร่ อยู่ตรงนี้ · ย้อนดูละเอียดหรือกู้คืนได้ที่หน้า “ประวัติการแก้ไข”' }
    ]
  });

  T.define('kpi', {
    title: 'หน้า KPI 2570', mins: '1 นาที',
    steps: [
      { sel: '.kpi-hero', title: 'เป้าปี 2570',
        text: 'ยอดขายรายสาขา ลูกค้าใหม่ และ KR ทั้ง 4 Objective — งานทุกงานที่ผูก KPI จะมานับรวมตรงนี้' },
      { sel: '.okr', title: 'OKR ของ CMO',
        text: 'กดที่ KR เพื่อดูว่ามีงานอะไรผูกอยู่บ้าง เสร็จไปกี่งาน' }
    ]
  });

  T.define('report', {
    title: 'หน้าสรุปผลงาน', mins: '1 นาที',
    steps: [
      { sel: '.cards', title: 'ตัวเลขรวมของเดือน',
        text: '“ตรงเวลา (ในวันนั้น)” คือตัวที่เอาไปเข้า KPI · อีกตัวเข้มกว่า นับถึงเวลาเป๊ะ' },
      { sel: '.rpt', title: 'รายคน',
        text: 'นับตอน<b>ส่งให้ตรวจ</b> เทียบกับ<b>วันเดิมก่อนถูกเลื่อน</b> — หัวหน้าตรวจช้าไม่ทำให้น้องเสียคะแนน และเลื่อนวันแล้วตัวเลขไม่สวยขึ้นเอง' },
      { sel: '.postbar', pos: 'top', title: 'เวลาไปลงกับอะไร',
        text: 'สัดส่วนเวลาที่ทีมใช้กับงานที่ผูก KPI เทียบกับงาน support — จะแม่นก็ต่อเมื่อทุกงานใส่ชั่วโมงไว้' }
    ]
  });

  T.define('team', {
    title: 'หน้าทีม + สิทธิ์', mins: '1 นาที',
    steps: [
      { sel: '.team-row', title: 'คนในทีม',
        text: 'เปิดหมวดที่แต่ละคนเห็นได้ (งาน · เอกสาร · ยอดขาย · KPI) หรือปิดใช้งาน · สมาชิกกดชื่อตัวเองเข้าระบบ ไม่ต้องใช้รหัส' },
      { sel: '#addStaff', pos: 'top', title: 'เพิ่มคนใหม่',
        text: 'ใส่ชื่อ + เลือกหมวดที่เห็นได้ · เพิ่มแล้วเขากดชื่อตัวเองที่หน้าแรกได้เลย (เฉพาะหัวหน้าที่ต้องตั้งรหัสผ่าน)' }
    ]
  });

  /* ---- ทัวร์ของหน้าที่เพิ่มมาใหม่ (นนท์ 20 ก.ย. 69: ให้กดทัวร์ได้ทุกหน้าในเมนู) ---- */
  T.define('signage', {
    title: 'หน้างานป้าย', mins: '1 นาที',
    steps: [
      { route: '#/signage', sel: '.sfbig', title: 'ป้ายทั้งหมดค้างอยู่ขั้นไหน',
        text: 'ทุกป้ายมี 6 ขั้น — ออกแบบ → แบบเสร็จ → ส่งโรงพิมพ์ → ผลิต → ของถึงสาขา → ติดตั้ง · แถบไหนยาวคือคอขวด · กดที่ขั้นไหนเพื่อดูเฉพาะป้ายที่ค้างขั้นนั้น' },
      { sel: '#view .top-r', pos: 'bottom', title: 'สั่งป้ายใหม่',
        text: '<b>+ สั่งป้าย</b> ได้งานพร้อม 6 ขั้นอัตโนมัติ · <b>ดูในรายการงาน</b> = เห็นป้ายปนกับงานอื่นในหน้างานทั้งหมด · สั่งจากการ์ดในปฏิทินการตลาดก็ได้ (ปุ่ม “+ สร้างงานป้าย”)' },
      { sel: '.tbar .seg', pos: 'bottom', title: 'สามมุมมอง',
        text: '<b>ไปป์ไลน์</b> = คอลัมน์ตามขั้น ลากการ์ดข้ามขั้นได้ · <b>การ์ด</b> = ดูทีละป้ายพร้อมรูป · <b>ตาราง</b> = ขนาด จำนวนใบ ตร.ม. ครบทุกป้ายในจอเดียว' },
      { sel: '.kban, .sgcards, .sgt, #view .empty', title: 'แต่ละใบถึงไหนแล้ว',
        text: 'จุดเขียวคือขั้นที่ผ่านแล้ว · ปิดแต่ละขั้นต้องแนบรูปยืนยัน ระบบถึงจะให้ผ่าน · เลยกำหนดขึ้นสีแดง' }
    ]
  });

  T.define('history', {
    title: 'ประวัติการแก้ไข', mins: '1 นาที',
    steps: [
      { route: '#/history', sel: '.hsearch', title: 'ค้นหาว่าใครแก้อะไร',
        text: 'พิมพ์ชื่องานหรือหัวข้อโพสต์ · ทุกการเปลี่ยนแปลงของงานและตารางโพสต์ถูกบันทึกไว้หมด ว่าใครแก้ ตอนไหน จากค่าอะไรเป็นอะไร' },
      { sel: '.hrow', title: 'อ่านทีละรายการ',
        text: 'แต่ละบรรทัดบอกคน เวลา และช่องที่ถูกแก้ — เช่น “กำหนดส่ง 25 ก.ย. → 28 ก.ย.”' },
      { sel: '.hundo', pos: 'left', title: 'ย้อนเวอร์ชันได้เหมือน Google Sheet',
        text: 'กดแล้วค่าจะกลับไปเป็นก่อนการแก้ครั้งนั้น (รวมคนรับผิดชอบ) · ของที่เผลอลบก็กู้คืนได้ · การย้อนถูกบันทึกไว้เป็นประวัติอีกชั้น' }
    ]
  });

  T.define('tickets', {
    title: 'แจ้งปัญหา', mins: '1 นาที',
    steps: [
      { route: '#/tickets', sel: '.tklink', title: 'ลิงก์ฟอร์มที่ให้ลูกค้ากรอก',
        text: 'เอาลิงก์นี้ไปแปะในริชเมนูไลน์หรือส่งให้ลูกค้าได้เลย · หน้าฟอร์มถามแค่ว่าเป็นลูกค้าหรือคนในทีม เรื่องอะไร รายละเอียด และติดต่อกลับทางไหน' },
      { sel: '.tbar .seg', title: 'กรองให้เหลือเฉพาะที่ต้องทำ',
        text: 'เปิดมาจะเห็นเฉพาะเรื่องที่ยังไม่ปิด · กด “ทั้งหมด” ถ้าอยากย้อนดูของเก่า หรือแยกดูเฉพาะเรื่องจากลูกค้า/จากทีม' },
      { sel: '.tkrow', title: 'ปิดทีละเรื่อง',
        text: 'กดแถบสถานะเพื่อขยับ เรื่องใหม่ → กำลังดูแล → เรียบร้อย · เลือกคนดูแล แล้วพิมพ์บันทึกไว้ว่าทำอะไรไปแล้ว ทุกการแก้เก็บอยู่ในหน้าประวัติการแก้ไข' },
      { sel: '.tkopen', pos: 'left', title: 'มีเรื่องใหม่ รู้ทันที',
        text: 'ทุกครั้งที่มีคนกรอกฟอร์ม ระบบจะเด้งข้อความเข้ากลุ่ม Lark ทันที พร้อมเลขที่เรื่องกับช่องทางติดต่อกลับ ไม่ต้องมานั่งเฝ้าหน้านี้' }
    ]
  });

  T.define('review', {
    title: 'ปัดตรวจงาน', mins: '1 นาที',
    steps: [
      { route: '#/review', sel: '.rvcard.top', title: 'หนึ่งใบ หนึ่งคำตัดสิน',
        text: 'กองนี้รวมทุกอย่างที่ค้างอยู่ที่คุณ — งานที่น้องกดส่งตรวจ · โพสต์ของวันนี้ที่ยังไม่ได้ติ๊ก · งานที่ปิดไปแล้วแต่คุณยังไม่ได้ตรวจ (ย้อนหลัง 14 วัน)' },
      { sel: '.rvbar', pos: 'top', title: 'ปัดหรือกดปุ่มก็ได้',
        text: '<b>ปัดขวา / →</b> ตรวจผ่าน · <b>ปัดซ้าย / ←</b> ตีกลับให้แก้ · <b>ปัดขึ้น / ↑</b> ข้ามไว้ก่อน (ไปต่อท้ายกอง) · ปุ่ม ↶ หรือกด Z ย้อนใบที่เพิ่งปัดไป' },
      { sel: '.rvopen', pos: 'top', title: 'อยากดูละเอียดกว่านี้',
        text: 'การ์ดโชว์อัปเดตล่าสุดกับรูปที่เขาแนบมาพอให้ตัดสินได้ · ถ้าต้องอ่านทั้งหมดกด “เปิดงานเต็ม ๆ” แล้วค่อยกดกลับมาปัดต่อ' }
    ]
  });

  T.define('leads', {
    title: 'ลีด (CRM)', mins: '1 นาที',
    steps: [
      { route: '#/leads', sel: '.cards', title: 'ของที่ค้างอยู่ตรงไหน',
        text: '<b>รอคนรับ</b> = การตลาดบันทึกมาแล้วยังไม่มีเซลส์ไล่ · <b>เลยวันตาม</b> = ถึงคิวตามแล้วยังไม่ได้ตาม · <b>รอส่งบัญชี</b> = ปิดการขายแล้วแต่ยังไม่ได้ส่งต่อ — กดการ์ดเพื่อกรองเฉพาะกลุ่มนั้น' },
      { sel: '.kban', title: 'เจ็ดขั้นเหมือน M CRM',
        text: 'ใหม่ → ติดต่อแล้ว → มีแนวโน้ม → เสนอราคา → ปิดการขาย · อีกสองช่องคือ ไม่สำเร็จ กับ ติดตามต่อ · ลากการ์ดข้ามคอลัมน์เพื่อเปลี่ยนขั้น ลากลีดที่ยังไม่มีคนรับ = คุณรับไปดูแลเลย' },
      { sel: '#newLead', pos: 'left', title: 'เพิ่มลีด',
        text: 'ช่องที่ต้องมีคือชื่อกับช่องทางที่ทักมา ที่เหลือเติมทีหลังได้ · เว้น "เซลส์ที่ดูแล" ไว้ = ปล่อยให้ทีมขายมากดรับเอง' }
    ]
  });

  T.define('calendar', {
    title: 'ปฏิทินการตลาด', mins: '2 นาที',
    steps: [
      { sel: '#ccKindBar', pos: 'bottom', title: 'ดูเฉพาะประเภท — สีบอกประเภทย่อย',
        text: 'กรองหมวดใหญ่ <b>โปรโมชั่น · Event / กิจกรรม · คอนเทนต์</b> · สีของแต่ละรายการขึ้นเองตามประเภทย่อย: ฟ้า = โปรโมชั่น · เหลือง = สิทธิพิเศษ · เขียว = ล็อตใหม่ · ชมพูอ่อน = แคมเปญ/อีเว้นท์ · ส้ม = จองคิว · ชมพูเข้ม = ปิดร้าน · ม่วง = คอนเทนต์' },
      { sel: '#ccBranchBar', pos: 'bottom', title: 'กรองรายสาขา',
        text: 'Kan Hub · Kan Store สุราษฎร์ · Kan Store ชุมพร · อื่นๆ (on tour / ออกบูธ) — ตัวกรองนี้มีผลทุกส่วนของหน้า จำไว้ให้ตอนเปิดครั้งหน้า' },
      { sel: '.cc-mnav, .cc-months', pos: 'bottom', title: 'เลื่อนเดือน',
        text: 'กด ‹ › ข้างชื่อเดือนเพื่อไปเดือนก่อน/ถัดไป (ข้ามปีให้เอง) · “ทั้งปี” ด้านซ้ายพาไปดูภาพรวม 12 เดือน' },
      { sel: '.cc-weeks, .cc-gridwrap, .cc-months', title: 'แถบบนปฏิทิน',
        text: 'รายการหลายวันเป็นแถบยาว · ตั้งหลายช่วงหรือทำซ้ำไว้ แถบขึ้นเฉพาะวันที่มีผล · ป้าย W1–W4 บนเลขวันบอกสัปดาห์ของเดือน · <b>กดแถบ</b> = การ์ดสถานะ (งานป้าย · โพสต์ · งานอื่น) และปุ่ม “เปิดหน้าเต็ม”' },
      { sel: '#ccModeSw', pos: 'bottom', title: 'ปฏิทิน / ตาราง',
        text: '<b>ตาราง</b> เรียงตามวันที่ เปลี่ยนเป็นจัดกลุ่มตามสัปดาห์ ประเภท สาขา หรือสถานะได้ · กดช่องในตารางแก้ได้เลย · ปุ่ม + ท้ายกลุ่มพิมพ์ชื่อแล้ว Enter ได้รายการใหม่ทันที' },
      { sel: '[data-selmode], .cc-gtab .cc-gsel', pos: 'bottom', title: 'เลือกหลายรายการ แก้ทีเดียว',
        text: 'ในปฏิทินกด <b>เลือกหลายรายการ</b> แล้วคลิกแถบ · ในตารางติ๊กหน้าแถว — แถบด้านล่างขึ้นให้ เลื่อนวัน · ตั้งวันใหม่ · ผู้รับผิดชอบ · สถานะ · ประเภท · สาขา · ลบ (ครั้งละไม่เกิน 10 รายการ)' },
      { sel: '#ccAdd', pos: 'bottom', title: 'เพิ่มรายการ',
        text: 'เลือกประเภท → ชื่อ → วัน · ใส่ได้หลายช่วงวัน + เวลา · <b>ทำซ้ำ</b> ครั้งเดียว / ทุกสัปดาห์ (เลือกวัน เช่น จ–พฤ) / ทุกเดือน — แบบทั้งเดือนก็ทำซ้ำทุกเดือนได้ · ผู้รับผิดชอบพิมพ์แล้วเลือกจากคนในระบบ · ติ๊ก <b>ให้ฝ่ายบัญชีตั้งค่าในระบบ</b> = ระบบสร้างงานให้ฝ่ายบัญชีเอง' },
      { sel: '#ccMore', pos: 'left', title: 'เมนูเพิ่มเติม',
        text: 'สไลด์สำหรับพรีเซนต์ · สำรองไฟล์ · นำเข้าไฟล์สำรอง' },
      { sel: '.cc-soon-grid', pos: 'top', title: 'วันนี้ / สัปดาห์นี้',
        text: 'สรุปว่าวันนี้และสัปดาห์นี้ (W ปัจจุบัน) มีอะไรวิ่งอยู่ แยกตามสาขา — หน้าร้านเปิดดูตรงนี้ตรงเดียวพอ' }
    ]
  });

  T.define('adsreport', {
    title: 'รายงานโฆษณา Meta', mins: '1 นาที',
    steps: [
      { sel: '#filterHost', title: 'เลือกสาขาและช่วงเวลา',
        text: 'สาขาในหน้านี้มาจากบัญชีโฆษณา — มี KAN HUB และนครศรีฯ ด้วย (สองอันนี้ไม่มีบิลหน้าร้าน ระบบจะข้ามส่วนเทียบยอดขายให้)' },
      { sel: '.sect', title: 'จ่ายไปเท่าไหร่ ได้อะไรกลับมา',
        text: 'ค่าแอด · คนเห็น · คนทัก · ราคาต่อผลลัพธ์ เทียบกับช่วงก่อนหน้าให้อัตโนมัติ' }
    ]
  });
}(window.KAN_TOUR));
