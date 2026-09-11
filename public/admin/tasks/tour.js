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
  T.stop = function () {
    if (T.dead && !T.ui) return;
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
    if (T.i >= def.steps.length - 1) { T.stop(); return; }
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
      { sel: '.erp-sidebar .erp-link[href$="#/me"]', pos: 'right',
        title: 'เมนูซ้าย — ทางเข้าทุกหน้า',
        text: '<b>งานของฉัน</b> คือหน้าที่คุณจะเปิดบ่อยสุด — งานทั้งหมดที่มอบหมายให้คุณ เรียงตามกำหนดส่ง' },
      { route: '#/me', sel: '.cards',
        title: 'ตัวเลข 4 ช่อง บอกสถานะวันนี้',
        text: 'งานค้าง · เลยกำหนด · ครบกำหนดวันนี้ · เสร็จใน 7 วัน — ถ้าช่อง “เลยกำหนด” เป็นสีแดง ให้ไล่ดูตรงนั้นก่อน' },
      { route: '#/me', sel: '.trow',
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
        text: 'เวลามีคนพิมพ์ @ชื่อคุณในงานไหน จะมาเด้งที่นี่ กดเข้าไปตอบได้เลย' },
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
    title: 'หน้างานทั้งหมด', mins: '1 นาที',
    steps: [
      { sel: '.cards', title: 'ตัวเลขทั้งทีม', text: 'รวมทุกคน — กด “เลยกำหนด” เพื่อดูเฉพาะที่เลย' },
      { sel: '.tbar .seg', title: 'ช่วงเวลา', text: 'วันนี้ · สัปดาห์นี้ · เดือนนี้ · ทั้งหมด — งานที่อยู่นอกช่วงจะซ่อน แต่บอกจำนวนไว้ข้างล่าง' },
      { sel: '[data-filter-toggle]', pos: 'bottom', title: 'ตัวกรอง',
        text: 'กรองตามคน · KPI · <b>ประเภทงาน</b> (ป้าย คอนเทนต์ แคมเปญ) · สถานะ — ตัวเลขบนปุ่มบอกว่าเปิดกรองอยู่กี่อย่าง' },
      { sel: '.tlist', title: 'รายการงาน',
        text: 'ป้ายเล็กใต้ชื่องานบอกประเภทงาน KPI และแคมเปญที่ผูก · งานประจำมีป้ายว่าอัปเดตวันนี้แล้วหรือยัง' }
    ]
  });

  T.define('new', {
    title: 'หน้าสั่งงาน', mins: '1 นาที',
    steps: [
      { sel: '#draftHost .xl-tb thead', pos: 'bottom', title: 'คอลัมน์ที่มี * ต้องกรอก',
        text: 'ชื่องาน · ประเภทงาน · สั่งใคร · กำหนดส่ง — เวลาไม่ใส่ระบบตั้ง 18:00 ให้ · รายละเอียด KPI แคมเปญ ใส่ก็ได้ไม่ใส่ก็ได้' },
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
        text: 'ทุกอย่างที่ทำจะขึ้นเป็นไทม์ไลน์ด้านล่าง ย้อนดูได้ว่าใครทำอะไรเมื่อไหร่' }
    ]
  });

  T.define('posts', {
    title: 'ตารางโพสต์', mins: '1 นาที',
    steps: [
      { sel: '#newPost', pos: 'bottom', title: 'เพิ่ม/แก้โพสต์ — ทางเดียว',
        text: 'กดแล้วเปิดตารางแบบ Excel พิมพ์ได้ทีละหลายโพสต์ · แก้โพสต์เดิมก็เปิดจากตรงนี้เหมือนกัน' },
      { sel: '.cal', title: 'ปฏิทินเดือน',
        text: 'เขียว = โพสต์แล้วมีลิงก์ · เหลือง = โพสต์แล้วแต่ไม่มีลิงก์ · แดง = เลยวันแล้วยังไม่โพสต์ · เทา = ยังไม่ถึงวัน' }
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

  T.define('team', {
    title: 'หน้าทีม + สิทธิ์', mins: '1 นาที',
    steps: [
      { sel: '.team-row', title: 'คนในทีม',
        text: 'เปิดหมวดที่แต่ละคนเห็นได้ (งาน · เอกสาร · ยอดขาย · KPI) ตั้งรหัสผ่านให้ หรือปิดใช้งาน' },
      { sel: '#addStaff', pos: 'top', title: 'เพิ่มคนใหม่',
        text: 'ใส่ชื่อ + รหัสตั้งค่า 4 หลัก · คนใหม่เข้าครั้งแรกที่แท็บ “ตั้งรหัสครั้งแรก” แล้วตั้งรหัสผ่านเอง' }
    ]
  });
}(window.KAN_TOUR));
