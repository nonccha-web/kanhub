/* ============================================================
   KAN — ปุ่ม "เพิ่มเป็นงาน" บนการ์ดข้อเสนอโปรโมชัน
   กดครั้งเดียวได้งานในระบบงานทีม (/admin/tasks/) โดยไม่ต้องพิมพ์ใหม่
   - งานที่ได้ยังไม่มีคนรับและไม่มีกำหนดส่ง (ไปเลือกในระบบงานทีม)
   - เดา KPI จาก keywords ที่ตั้งไว้ในตาราง kpis ฝั่งเซิร์ฟเวอร์
   ============================================================ */
(function (global) {
  'use strict';

  var API = '/api/t';
  var store = {};          // key → payload ของการ์ดที่เรนเดอร์อยู่
  var seq = 0;
  var meta = null;         // { me, staff, kpis } โหลดครั้งเดียวตอนกดปุ่มแรก
  var made = {};           // key → taskId ที่สร้างไปแล้ว กันกดซ้ำ

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind, href, linkText) {
    var el = document.getElementById('taskAddToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'taskAddToast';
      el.className = 'ta-toast';
      document.body.appendChild(el);
    }
    el.className = 'ta-toast show' + (kind ? ' ' + kind : '');
    el.innerHTML = esc(msg) + (href ? ' <a href="' + esc(href) + '">' + esc(linkText || 'เปิดงาน') + ' →</a>' : '');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.className = 'ta-toast'; }, href ? 7000 : 4000);
  }

  /* เรียกตอนเริ่มเรนเดอร์หน้าใหม่ — ล้างของเก่าทิ้ง */
  function reset() { store = {}; seq = 0; }

  /* คืน HTML ของปุ่ม · payload = { title, detail, guess }
     guess = ข้อความที่ใช้เดา KPI — ต้องไม่รวมบรรทัด "ที่มา" ที่เราต่อท้าย ไม่งั้นคำว่า "โปรโมชัน" จะดึงไปผิดหมวด */
  function btn(payload) {
    var key = 'ta' + (++seq);
    store[key] = payload;
    return '<button type="button" class="ta-btn" data-taskadd="' + key + '">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> เพิ่มเป็นงาน</button>';
  }

  function guessKpi(text) {
    if (!meta || !meta.kpis) { return null; }
    var low = String(text || '').toLowerCase(), best = null, bestN = 0;
    meta.kpis.forEach(function (k) {
      var n = 0;
      String(k.keywords || '').split(',').forEach(function (w) {
        w = w.trim().toLowerCase();
        if (w && low.indexOf(w) !== -1) { n += w.length > 3 ? 2 : 1; }
      });
      if (n > bestN) { bestN = n; best = k.id; }
    });
    return best;
  }

  function loadMeta() {
    if (meta) { return Promise.resolve(meta); }
    return fetch(API + '/me', { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { var e = new Error('ยังไม่ได้เข้าสู่ระบบงานทีม'); e.auth = true; throw e; }
      if (!r.ok) { throw new Error('ต่อระบบงานทีมไม่ได้'); }
      return r.json();
    }).then(function (j) { meta = j; return meta; });
  }

  function add(key, el) {
    var p = store[key];
    if (!p) { return; }
    if (made[key]) { toast('งานนี้เพิ่มไปแล้ว', 'ok', '/tasks/#/task/' + made[key]); return; }
    el.disabled = true;
    el.classList.add('busy');
    loadMeta().then(function () {
      var detail = p.detail || '';
      return fetch(API + '/tasks', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tasks: [{
          title: p.title,
          detail: detail,
          assignees: [],
          dueAt: null,
          kpiId: guessKpi(p.guess || (p.title + ' ' + detail)),
        }] }),
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) { throw new Error(j.error || 'บันทึกไม่สำเร็จ'); }
          return j;
        });
      });
    }).then(function (j) {
      var id = (j.ids || [])[0];
      made[key] = id;
      el.classList.remove('busy');
      el.classList.add('done');
      el.innerHTML = '✓ เพิ่มแล้ว';
      toast('เพิ่มเข้าระบบงานทีมแล้ว — ยังไม่ได้เลือกคนและวัน', 'ok', '/tasks/#/task/' + id);
    }).catch(function (e) {
      el.disabled = false;
      el.classList.remove('busy');
      if (e && e.auth) {
        toast('ต้องเข้าสู่ระบบงานทีมก่อน', 'bad', '/tasks/', 'ไปเข้าสู่ระบบ');
      } else {
        toast(e && e.message ? e.message : 'บันทึกไม่สำเร็จ', 'bad');
      }
    });
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-taskadd]');
    if (!b) { return; }
    ev.preventDefault();
    add(b.getAttribute('data-taskadd'), b);
  });

  global.KAN_TASKADD = { reset: reset, btn: btn };
}(window));
