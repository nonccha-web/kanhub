/* ============================================================
   KAN — แชทรวม LINE OA (นนท์ 29 ก.ย. 69) แบบ Zaapi / Pancake
   #/chat        กล่องแชท 3 ช่อง: รายการแชท | ห้องแชท | ข้อมูลลูกค้า
   #/chat/<id>   เปิดแชทนั้นเลย
   #/chatstats   สถิติ: ทักเข้ามากี่คน ค้างกี่คน ตอบเร็วแค่ไหน รายพนักงาน/รายเพจ/รายชั่วโมง
   ดึงของใหม่เองทุก 4 วิ ตอนเปิดหน้าอยู่ (ไม่ต้องกดรีเฟรช)
   ============================================================ */
(function (global) {
  'use strict';
  var X = null;
  var C = { tab: 'pending', ch: '', q: '', list: null, counts: {}, channels: [], canEdit: false, r2: false, mockCount: 0,
            open: null, msgs: [], lastAt: null, replies: null, timer: null, busy: false, sending: false, img: null };
  var ST = { days: 7, ch: '' };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return X.esc(s); }
  function api(p, m, b) { return X.api(p, m, b); }
  function toast(m, bad) { X.toast(m, bad); }
  function fail(e) { toast(e && e.message ? e.message : String(e), true); }
  function num(n) { return Number(n || 0).toLocaleString('th-TH'); }
  function chOf(id) { return C.channels.filter(function (c) { return c.id === id; })[0] || { name: id, color: '#06C755' }; }
  function staffName(id) { var s = X.staffById(id); return s ? String(s.name).split(/\s+/)[0] : '—'; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function hm(iso) { var d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dayLabel(iso) {
    var d = new Date(iso), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'วันนี้';
    if (d.toDateString() === y.toDateString()) return 'เมื่อวาน';
    return d.getDate() + ' ' + ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][d.getMonth()];
  }
  function waitMin(iso) { return iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)) : 0; }
  function waitTxt(m) { return m < 60 ? m + ' นาที' : (m < 1440 ? Math.floor(m / 60) + ' ชม. ' + (m % 60) + ' น.' : Math.floor(m / 1440) + ' วัน'); }
  function initial(n) { return String(n || '?').trim().charAt(0).toUpperCase(); }
  function avatar(cv, size) {
    return cv.picture ? '<img class="ch-av" src="' + esc(cv.picture) + '" alt="" style="width:' + size + 'px;height:' + size + 'px">'
      : '<span class="ch-av" style="width:' + size + 'px;height:' + size + 'px;background:' + esc(chOf(cv.channelId).color) + '22;color:' + esc(chOf(cv.channelId).color) + '">' + esc(initial(cv.name)) + '</span>';
  }
  var ST_TH = { new: 'ใหม่', open: 'ค้างตอบ', waiting: 'รอลูกค้า', closed: 'ปิดแล้ว' };

  /* ---------------- กล่องแชท ---------------- */
  function renderChat(route) {
    var v = $('#view');
    v.className = 'page chat-page';
    if (!$('#chWrap')) {
      v.innerHTML = '<div class="ch-wrap" id="chWrap">' +
        '<aside class="ch-list"><div class="ch-lh"><div class="ch-title"><b>แชทลูกค้า</b><a class="btn-text" href="#/chatstats">สถิติ →</a></div>' +
          '<input class="ch-search" id="chQ" placeholder="ค้นชื่อ / เบอร์ / แท็ก" value="' + esc(C.q) + '">' +
          '<div class="ch-tabs" id="chTabs"></div><div class="ch-chs" id="chChs"></div></div>' +
          '<div class="ch-items" id="chItems"><div class="loading">กำลังโหลด…</div></div></aside>' +
        '<section class="ch-room" id="chRoom"></section>' +
        '<aside class="ch-side" id="chSide"></aside></div>';
    }
    var want = route.id || null;
    if (want !== (C.open && C.open.id)) { C.open = want ? { id: want } : null; C.msgs = []; C.lastAt = null; C.img = null; paintRoom(); paintSide(); }
    else if (!$('#chRoom').innerHTML) paintRoom();
    loadList().then(function () { if (C.open) return loadMsgs(true); });
    startPoll();
  }
  function loadList() {
    var qs = '?tab=' + C.tab + (C.ch ? '&ch=' + encodeURIComponent(C.ch) : '') + (C.q ? '&q=' + encodeURIComponent(C.q) : '');
    return api('/chat/convos' + qs).then(function (j) {
      C.list = j.convos; C.counts = j.counts; C.channels = j.channels; C.canEdit = j.canEdit; C.r2 = j.r2; C.mockCount = j.mockCount;
      paintList();
      if (!C.open) paintSide();
    }).catch(fail);
  }
  function paintList() {
    var tabs = [['pending', 'ค้างตอบ'], ['mine', 'ของฉัน'], ['waiting', 'รอลูกค้า'], ['closed', 'ปิดแล้ว'], ['all', 'ทั้งหมด']];
    $('#chTabs').innerHTML = tabs.map(function (t) {
      var n = C.counts[t[0]] || 0;
      return '<button type="button" data-chtab="' + t[0] + '" class="' + (C.tab === t[0] ? 'on' : '') + '">' + t[1] + (n ? ' <i class="' + (t[0] === 'pending' ? 'hot' : '') + '">' + n + '</i>' : '') + '</button>';
    }).join('');
    var chs = C.channels.filter(function (c) { return c.chat; });
    $('#chChs').innerHTML = '<button type="button" data-chch="" class="' + (!C.ch ? 'on' : '') + '">ทุกเพจ</button>' + chs.map(function (c) {
      return '<button type="button" data-chch="' + esc(c.id) + '" class="' + (C.ch === c.id ? 'on' : '') + '"><span class="ch-dot" style="background:' + esc(c.color) + '"></span>' + esc(c.name) + '</button>';
    }).join('');
    var box = $('#chItems');
    if (!C.list.length) {
      box.innerHTML = '<div class="ch-empty">' + (C.counts.all ? 'ไม่มีแชทในแท็บนี้' : 'ยังไม่มีแชทเข้ามา' +
        (X.isOwner() ? '<br><button type="button" class="btn-ghost sm" data-chmock="seed">สร้างแชทจำลองไว้ดูหน้าตา</button>' : '')) + '</div>';
      return;
    }
    box.innerHTML = C.list.map(function (cv) {
      var pend = cv.status === 'new' || cv.status === 'open', w = pend ? waitMin(cv.waitingSince || cv.lastAt) : 0;
      var ch = chOf(cv.channelId);
      return '<a class="ch-item' + (C.open && C.open.id === cv.id ? ' on' : '') + (cv.unread ? ' unread' : '') + '" href="#/chat/' + esc(cv.id) + '">' +
        avatar(cv, 40) +
        '<span class="ch-it-m"><span class="ch-it-t"><b>' + esc(cv.name) + '</b><time>' + esc(dayLabel(cv.lastAt) === 'วันนี้' ? hm(cv.lastAt) : dayLabel(cv.lastAt)) + '</time></span>' +
        '<span class="ch-it-p">' + (cv.lastFrom === 'staff' ? '<em>คุณ: </em>' : '') + esc(cv.lastText || '') + '</span>' +
        '<span class="ch-it-f"><span class="ch-pg" style="color:' + esc(ch.color) + '"><span class="ch-dot" style="background:' + esc(ch.color) + '"></span>' + esc(ch.name) + '</span>' +
          (pend ? '<span class="ch-wait' + (w >= 15 ? ' late' : '') + '">รอ ' + waitTxt(w) + '</span>' : '<span class="ch-st">' + ST_TH[cv.status] + '</span>') +
          (cv.assignee ? '<span class="ch-as">' + esc(staffName(cv.assignee)) + '</span>' : (pend ? '<span class="ch-as none">ยังไม่มีคนรับ</span>' : '')) +
          (cv.mock ? '<span class="ch-mock">จำลอง</span>' : '') +
        '</span></span>' + (cv.unread ? '<span class="ch-badge">' + cv.unread + '</span>' : '') + '</a>';
    }).join('');
  }
  function loadMsgs(full) {
    if (!C.open) return Promise.resolve();
    var id = C.open.id;
    return api('/chat/convos/' + id + (full || !C.lastAt ? '' : '?after=' + encodeURIComponent(C.lastAt))).then(function (j) {
      if (!C.open || C.open.id !== id) return;
      var fresh = !C.open.name || full;
      C.open = j.convo;
      if (full || !C.lastAt) C.msgs = j.msgs; else C.msgs = C.msgs.concat(j.msgs.filter(function (m) { return !C.msgs.some(function (x) { return x.id === m.id; }); }));
      if (C.msgs.length) C.lastAt = C.msgs[C.msgs.length - 1].at;
      if (fresh || j.msgs.length) { paintRoom(); paintSide(); }
      else { paintHead(); }
    }).catch(function (e) { if (C.open && !C.open.name) { $('#chRoom').innerHTML = '<div class="ch-empty">' + esc(e.message) + '</div>'; } });
  }
  function paintHead() {
    var cv = C.open, h = $('#chHead');
    if (!h || !cv || !cv.name) return;
    var ch = chOf(cv.channelId), staff = X.activeStaff();
    h.innerHTML = avatar(cv, 36) + '<div class="ch-hd-m"><b>' + esc(cv.name) + '</b><small><span class="ch-dot" style="background:' + esc(ch.color) + '"></span>' + esc(ch.name) +
        (ch.live ? '' : ' · <span class="ch-mock">โหมดจำลอง</span>') + (cv.blocked ? ' · <span class="bad">บล็อกเพจแล้ว</span>' : '') + '</small></div>' +
      '<div class="ch-hd-r">' +
        (C.canEdit ? '<select id="chAssign" title="คนดูแลแชทนี้"><option value="">— ยังไม่มีคนรับ —</option>' + staff.map(function (s) {
          return '<option value="' + esc(s.id) + '"' + (cv.assignee === s.id ? ' selected' : '') + '>' + esc(String(s.name).split(/\s+/)[0]) + '</option>'; }).join('') + '</select>' +
          (cv.status === 'closed' ? '<button type="button" class="btn-ghost sm" data-chst="open">เปิดเคสอีกครั้ง</button>'
            : '<button type="button" class="btn-ghost sm" data-chst="closed">ปิดเคส</button>') : '<span class="pill">ดูอย่างเดียว</span>') +
      '</div>';
  }
  function bubble(m, prevDay) {
    var d = dayLabel(m.at), sep = d !== prevDay ? '<div class="ch-day"><span>' + esc(d) + '</span></div>' : '';
    var body;
    if (m.kind === 'image') body = m.media ? '<a href="' + X.API.replace(/\/t$/, '') + '/chat/media/' + esc(m.media) + '" target="_blank" rel="noopener"><img class="ch-img" src="' + X.API.replace(/\/t$/, '') + '/chat/media/' + esc(m.media) + '" alt="รูป" loading="lazy"></a>' : '<span class="ch-sys">[รูปภาพ]</span>';
    else if (m.kind === 'sticker') body = m.sticker ? '<img class="ch-stk" src="https://stickershop.line-scdn.net/stickershop/v1/sticker/' + esc(m.sticker) + '/android/sticker.png" alt="สติกเกอร์">' : '[สติกเกอร์]';
    else if (m.kind === 'text' || m.kind === 'location') body = esc(m.text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
    else body = '<span class="ch-sys">[' + esc(m.kind) + ']</span>';
    return sep + '<div class="ch-msg ' + m.dir + (m.kind === 'image' || m.kind === 'sticker' ? ' media' : '') + (m.status === 'fail' ? ' fail' : '') + '"><div class="ch-bub">' + body + '</div>' +
      '<div class="ch-meta">' + (m.dir === 'out' ? esc(staffName(m.staffId)) + ' · ' : '') + hm(m.at) +
      (m.dir === 'out' && m.via === 'push' ? ' · push' : '') + (m.dir === 'out' && m.via === 'mock' ? ' · จำลอง' : '') +
      (m.status === 'fail' ? ' · <b class="bad">ส่งไม่สำเร็จ ' + esc(m.error || '') + '</b>' : '') + '</div></div>';
  }
  function paintRoom() {
    var r = $('#chRoom');
    if (!r) return;
    if (!C.open) { r.innerHTML = '<div class="ch-empty big">เลือกแชททางซ้ายเพื่อเริ่มตอบ<small>แชทที่ค้างตอบนานสุดอยู่บนสุดของแท็บ "ค้างตอบ"</small></div>'; return; }
    if (!C.open.name) { r.innerHTML = '<div class="loading">กำลังโหลด…</div>'; return; }
    var keep = $('#chText') ? $('#chText').value : '';
    var prev = '';
    r.innerHTML = '<div class="ch-head" id="chHead"></div>' +
      '<div class="ch-msgs" id="chMsgs">' + C.msgs.map(function (m) { var h = bubble(m, prev); prev = dayLabel(m.at); return h; }).join('') + '</div>' +
      (C.canEdit ? '<div class="ch-comp">' +
        (C.img ? '<div class="ch-pv"><img src="' + C.img + '" alt=""><button type="button" data-chimg="x" title="เอารูปออก">✕</button></div>' : '') +
        '<div class="ch-qr" id="chQr" hidden></div>' +
        '<div class="ch-comp-row"><button type="button" class="ch-ib" data-chqr="1" title="ข้อความสำเร็จรูป">⚡</button>' +
        '<label class="ch-ib" title="ส่งรูป">📷<input type="file" accept="image/jpeg,image/png" id="chFile" hidden></label>' +
        '<textarea id="chText" rows="1" placeholder="พิมพ์ตอบลูกค้า… (Enter ส่ง · Shift+Enter ขึ้นบรรทัด)"></textarea>' +
        '<button type="button" class="btn" id="chSend">ส่ง</button></div></div>' : '');
    paintHead();
    var t = $('#chText'); if (t) { t.value = keep; autoGrow(t); }
    var ms = $('#chMsgs'); if (ms) ms.scrollTop = ms.scrollHeight;
  }
  function autoGrow(t) { t.style.height = 'auto'; t.style.height = Math.min(160, t.scrollHeight) + 'px'; }
  function paintSide() {
    var s = $('#chSide');
    if (!s) return;
    var cv = C.open;
    if (!cv || !cv.name) {
      var h0 = '';
      if (X.isOwner()) {
        /* ต่อ LINE จริง: ใส่ token/secret ที่หน้าตั้งค่าบรอดแคสต์ แล้วเอา Webhook URL ไปวางใน LINE Developers */
        h0 += '<div class="ch-card"><b>ต่อ LINE จริง</b><p class="hint">1) ใส่ Channel access token + Channel secret ของแต่ละเพจที่ <a href="#/blastsetup">ตั้งค่าเพจ</a> · 2) คัดลอก Webhook URL ไปวางใน LINE Developers แล้วเปิด Use webhook</p>' +
          C.channels.filter(function (c) { return c.chat; }).map(function (c) {
            var u = location.origin + c.webhook;
            return '<div class="ch-wh"><span><span class="ch-dot" style="background:' + esc(c.color) + '"></span> <b>' + esc(c.name) + '</b> ' +
              (c.live && c.hasSecret ? '<em class="ok">ต่อแล้ว</em>' : '<em>' + (c.live ? 'ยังไม่มี secret' : 'จำลอง') + '</em>') + '</span><code>' + esc(u) + '</code></div>';
          }).join('') + '</div>';
      }
      if (C.mockCount && X.isOwner()) h0 += '<div class="ch-card"><b>โหมดจำลอง</b><p class="hint">มีแชทจำลอง ' + C.mockCount + ' ห้อง ไว้ดูหน้าตาก่อนต่อ LINE จริง</p><button type="button" class="btn-text danger" data-chmock="clear">ล้างแชทจำลองทั้งหมด</button></div>';
      s.innerHTML = h0; return;
    }
    var ch = chOf(cv.channelId), ro = C.canEdit ? '' : ' disabled';
    s.innerHTML = '<div class="ch-card ch-prof">' + avatar(cv, 64) + '<b>' + esc(cv.name) + '</b><small>' + esc(ch.name) + (ch.basicId ? ' · ' + esc(ch.basicId) : '') + '</small>' +
        '<dl><dt>ทักครั้งแรก</dt><dd>' + esc(dayLabel(cv.firstAt)) + ' ' + hm(cv.firstAt) + '</dd><dt>สถานะ</dt><dd>' + ST_TH[cv.status] + '</dd>' +
        '<dt>คนดูแล</dt><dd>' + (cv.assignee ? esc(staffName(cv.assignee)) : '—') + '</dd></dl></div>' +
      '<div class="ch-card"><label class="ch-f"><span>เบอร์โทร</span><input id="chPhone" value="' + esc(cv.phone) + '" placeholder="ยังไม่มี"' + ro + '></label>' +
        '<label class="ch-f"><span>แท็ก <small>คั่นด้วย ,</small></span><input id="chTags" value="' + esc(cv.tags.join(', ')) + '" placeholder="เช่น สนใจเฟอร์, VIP"' + ro + '></label>' +
        '<label class="ch-f"><span>โน้ตของทีม <small>ลูกค้าไม่เห็น</small></span><textarea id="chNote" rows="4"' + ro + '>' + esc(cv.note) + '</textarea></label>' +
        (C.canEdit ? '<button type="button" class="btn-ghost sm" data-chsave="1">บันทึกข้อมูลลูกค้า</button>' : '') + '</div>' +
      '<div class="ch-card">' + (cv.leadId ? '<a class="btn-ghost sm" href="#/lead/' + esc(cv.leadId) + '">เปิดในลีด (CRM) →</a>'
        : (C.canEdit ? '<button type="button" class="btn-ghost sm" data-chlead="1">ส่งเข้าลีด (CRM)</button><p class="hint">สร้างลีดจากแชทนี้ ให้ฝ่ายขายไล่ปิดต่อ</p>' : '')) + '</div>' +
      (cv.mock && X.isOwner() ? '<div class="ch-card"><b>ทดสอบ</b><p class="hint">จำลองว่าลูกค้าพิมพ์เข้ามา</p><div class="ch-sim"><input id="chSim" placeholder="ข้อความลูกค้า"><button type="button" class="btn-ghost sm" data-chmock="in">ส่ง</button></div></div>' : '');
  }
  function sendNow() {
    if (C.sending || !C.open) return;
    var t = $('#chText'), text = t ? t.value.trim() : '';
    if (!text && !C.img) return;
    C.sending = true; $('#chSend').disabled = true;
    api('/chat/convos/' + C.open.id + '/send', 'POST', { text: text, image: C.img || undefined }).then(function () {
      if (t) t.value = ''; C.img = null;
      return loadMsgs(false).then(loadList);
    }).catch(function (e) { fail(e); loadMsgs(false); })
      .then(function () { C.sending = false; var b = $('#chSend'); if (b) b.disabled = false; var tt = $('#chText'); if (tt) tt.focus(); });
  }
  function shrink(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var k = Math.min(1, 1600 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
          cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          res(cv.toDataURL('image/jpeg', 0.85));
        };
        im.onerror = rej; im.src = fr.result;
      };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  function toggleQr() {
    var box = $('#chQr');
    if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    (C.replies ? Promise.resolve(C.replies) : api('/chat/replies').then(function (j) { C.replies = j.replies; return C.replies; })).then(function (list) {
      box.innerHTML = (list.length ? list.map(function (r, i) { return '<button type="button" data-chqri="' + i + '"><b>' + esc(r.title) + '</b><span>' + esc(r.text) + '</span></button>'; }).join('') : '<p class="hint">ยังไม่มีข้อความสำเร็จรูป</p>') +
        '<button type="button" class="btn-text" data-chqredit="1">แก้รายการข้อความสำเร็จรูป</button>';
      box.hidden = false;
    }).catch(fail);
  }
  function editReplies() {
    var list = (C.replies || []).map(function (r) { return r.title + ' | ' + r.text; }).join('\n');
    var v = prompt('ข้อความสำเร็จรูป — บรรทัดละ 1 อัน รูปแบบ "ชื่อสั้น | ข้อความ"', list);
    if (v == null) return;
    var rows = v.split('\n').map(function (l) { var i = l.indexOf('|'); return i > 0 ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : null; }).filter(Boolean);
    api('/chat/replies', 'PUT', { replies: rows }).then(function (j) { C.replies = j.replies; toast('บันทึกข้อความสำเร็จรูป ' + rows.length + ' อัน'); $('#chQr').hidden = true; }).catch(fail);
  }
  function startPoll() {
    if (C.timer) return;
    C.timer = setInterval(function () {
      if (!/^#\/chat(\/|$)/.test(location.hash)) { clearInterval(C.timer); C.timer = null; return; }
      if (document.hidden || C.busy) return;
      C.busy = true;
      var p = C.open && C.open.name ? loadMsgs(false) : Promise.resolve();
      p.then(loadList).then(function () { C.busy = false; }, function () { C.busy = false; });
    }, 4000);
  }

  document.addEventListener('click', function (ev) {
    if (!$('#chWrap') && !$('#csWrap')) return;
    var b = ev.target.closest('[data-chtab],[data-chch],[data-chst],[data-chsave],[data-chlead],[data-chmock],[data-chqr],[data-chqri],[data-chqredit],[data-chimg],#chSend,[data-csdays],[data-csch]');
    if (!b) return;
    if (b.id === 'chSend') { sendNow(); return; }
    if (b.hasAttribute('data-chtab')) { C.tab = b.getAttribute('data-chtab'); loadList(); return; }
    if (b.hasAttribute('data-chch')) { C.ch = b.getAttribute('data-chch'); loadList(); return; }
    if (b.hasAttribute('data-chst')) {
      api('/chat/convos/' + C.open.id, 'PUT', { status: b.getAttribute('data-chst') === 'open' ? 'open' : 'closed' })
        .then(function () { toast(b.getAttribute('data-chst') === 'closed' ? 'ปิดเคสแล้ว' : 'เปิดเคสอีกครั้ง'); return loadMsgs(true).then(loadList); }).catch(fail);
      return;
    }
    if (b.hasAttribute('data-chsave')) {
      api('/chat/convos/' + C.open.id, 'PUT', { phone: $('#chPhone').value, tags: $('#chTags').value, note: $('#chNote').value })
        .then(function () { toast('บันทึกข้อมูลลูกค้าแล้ว'); return loadMsgs(true); }).catch(fail);
      return;
    }
    if (b.hasAttribute('data-chlead')) {
      api('/chat/convos/' + C.open.id + '/lead', 'POST', {}).then(function (j) { toast('ส่งเข้าลีดแล้ว'); C.open.leadId = j.id; paintSide(); }).catch(fail);
      return;
    }
    if (b.hasAttribute('data-chmock')) {
      var a = b.getAttribute('data-chmock');
      if (a === 'clear' && !confirm('ล้างแชทจำลองทั้งหมด? (แชทจริงไม่หาย)')) return;
      var p = a === 'in' ? api('/chat/mock/incoming', 'POST', { id: C.open.id, text: $('#chSim').value || 'สวัสดีค่ะ' }) : api('/chat/mock/' + a, 'POST', {});
      p.then(function (j) {
        if (j && j.error) throw new Error(j.error);
        toast(a === 'seed' ? 'สร้างแชทจำลอง ' + (j.created || 0) + ' ห้องแล้ว' : (a === 'clear' ? 'ล้างแชทจำลองแล้ว' : 'ลูกค้า (จำลอง) พิมพ์เข้ามาแล้ว'));
        if (a === 'clear') { C.open = null; location.hash = '#/chat'; }
        return (C.open ? loadMsgs(false) : Promise.resolve()).then(loadList).then(paintSide);
      }).catch(fail);
      return;
    }
    if (b.hasAttribute('data-chqr')) { toggleQr(); return; }
    if (b.hasAttribute('data-chqri')) {
      var r = C.replies[+b.getAttribute('data-chqri')], t = $('#chText');
      if (r && t) { t.value = (t.value ? t.value + '\n' : '') + r.text; autoGrow(t); t.focus(); }
      $('#chQr').hidden = true; return;
    }
    if (b.hasAttribute('data-chqredit')) { editReplies(); return; }
    if (b.hasAttribute('data-chimg')) { C.img = null; paintRoom(); return; }
    if (b.hasAttribute('data-csdays')) { ST.days = +b.getAttribute('data-csdays'); renderStats(); return; }
    if (b.hasAttribute('data-csch')) { ST.ch = b.getAttribute('data-csch'); renderStats(); return; }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.target && ev.target.id === 'chText' && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); sendNow(); }
  });
  document.addEventListener('input', function (ev) {
    if (ev.target && ev.target.id === 'chText') autoGrow(ev.target);
    if (ev.target && ev.target.id === 'chQ') { clearTimeout(C.qt); C.q = ev.target.value.trim(); C.qt = setTimeout(loadList, 300); }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t && t.id === 'chAssign' && C.open) {
      api('/chat/convos/' + C.open.id, 'PUT', { assignee: t.value || null }).then(function () { toast(t.value ? 'มอบแชทให้ ' + staffName(t.value) + ' แล้ว' : 'ปล่อยแชทนี้ให้คนอื่นรับ'); return loadMsgs(true).then(loadList); }).catch(fail);
    }
    if (t && t.id === 'chFile' && t.files && t.files[0]) {
      shrink(t.files[0]).then(function (d) { C.img = d; var keep = $('#chText') ? $('#chText').value : ''; paintRoom(); $('#chText').value = keep; }).catch(function () { toast('อ่านรูปไม่ได้', true); });
    }
  });

  /* ---------------- สถิติ ---------------- */
  function renderStats() {
    var v = $('#view');
    v.className = 'page chat-stats';
    if (!$('#csWrap')) v.innerHTML = '<div id="csWrap"><div class="loading">กำลังโหลด…</div></div>';
    Promise.all([api('/chat/stats?days=' + ST.days + (ST.ch ? '&ch=' + encodeURIComponent(ST.ch) : '')), C.channels.length ? null : api('/chat/convos?tab=pending')]).then(function (r) {
      if (r[1]) { C.channels = r[1].channels; }
      paintStats(r[0]);
    }).catch(function (e) { $('#csWrap').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }
  function paintStats(s) {
    var k = s.cards, chs = C.channels.filter(function (c) { return c.chat; });
    var mx = Math.max.apply(null, s.daily.map(function (d) { return Math.max(d.custs, d.replies); }).concat([1]));
    var hmx = Math.max.apply(null, s.heat.map(function (r) { return Math.max.apply(null, r); }).concat([1]));
    var DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    var h = '<div class="top"><div><span class="kicker">แชทลูกค้า</span><h1>สถิติแชท LINE</h1><p>ลูกค้าทักเข้ามากี่คน ตอบไปแล้วกี่คน ค้างอยู่กี่คน และทีมตอบเร็วแค่ไหน · นับตามเวลาไทย</p></div>' +
      '<div class="top-r"><a class="btn-ghost" href="#/chat">← กล่องแชท</a></div></div>' +
      '<div class="tbar"><div class="seg">' + [[1, 'วันนี้'], [7, '7 วัน'], [30, '30 วัน'], [90, '90 วัน']].map(function (x) {
        return '<button type="button" data-csdays="' + x[0] + '" class="' + (ST.days === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="seg"><button type="button" data-csch="" class="' + (!ST.ch ? 'on' : '') + '">ทุกเพจ</button>' + chs.map(function (c) {
        return '<button type="button" data-csch="' + esc(c.id) + '" class="' + (ST.ch === c.id ? 'on' : '') + '">' + esc(c.name) + '</button>'; }).join('') + '</div></div>';
    h += '<div class="cards">' +
      '<article class="hot"><span class="l">ลูกค้าทักเข้ามา</span><b>' + num(k.custs) + '</b><small>คน · ลูกค้าใหม่ ' + num(k.newCusts) + ' คน · ' + num(k.msgsIn) + ' ข้อความ</small></article>' +
      '<article><span class="l">ตอบแล้ว</span><b>' + num(k.replied) + '</b><small>คน · ส่งไป ' + num(k.replies) + ' ข้อความ · ปิดเคส ' + num(k.closed) + '</small></article>' +
      '<article' + (k.pendingNow ? ' class="bad"' : '') + '><span class="l">ค้างตอบตอนนี้</span><b>' + num(k.pendingNow) + '</b><small>' +
        (k.pendingNow ? 'ยังไม่มีคนรับ ' + num(k.unassignedNow) + ' · นานสุด ' + waitTxt(k.oldestWaitMin || 0) : 'ไม่มีค้าง') + '</small></article>' +
      '<article><span class="l">ตอบครั้งแรกเฉลี่ย</span><b>' + (k.avgFirstReplyMin == null ? '—' : waitTxt(Math.round(k.avgFirstReplyMin))) + '</b><small>' +
        (k.answeredCount ? 'ตอบภายใน 5 นาที ' + Math.round(k.within5 / k.answeredCount * 100) + '% · กลาง ' + waitTxt(Math.round(k.medianReplyMin || 0)) : 'ยังไม่มีข้อมูล') + '</small></article></div>';
    h += '<div class="sec"><div class="sec-h"><div><h2>รายวัน</h2><p>แท่งเข้ม = ลูกค้าที่ทักเข้ามา · แท่งอ่อน = ข้อความที่ทีมตอบ</p></div></div><div class="sec-b"><div class="cs-bars">' +
      s.daily.map(function (d) {
        var dt = new Date(d.day + 'T00:00:00');
        return '<div class="cs-bar" title="' + d.day + ' · ลูกค้า ' + d.custs + ' (ใหม่ ' + d.newCusts + ') · ตอบ ' + d.replies + '">' +
          '<div class="cs-col"><i class="a" style="height:' + Math.round(d.custs / mx * 100) + '%"></i><i class="b" style="height:' + Math.round(d.replies / mx * 100) + '%"></i></div>' +
          '<span>' + (s.days <= 31 ? dt.getDate() : (dt.getDate() === 1 ? dt.getDate() + '/' + (dt.getMonth() + 1) : '')) + '</span><em>' + (d.custs || '') + '</em></div>';
      }).join('') + '</div></div></div>';
    h += '<div class="cs-two"><div class="sec"><div class="sec-h"><div><h2>รายพนักงาน</h2><p>ใครตอบไปกี่แชท และตอบเร็วแค่ไหน</p></div></div><div class="sec-b tight"><table class="pp-table"><thead><tr><th>พนักงาน</th><th>แชทที่ดูแล</th><th>ข้อความที่ส่ง</th><th>ตอบครั้งแรกเฉลี่ย</th></tr></thead><tbody>' +
      (s.staff.length ? s.staff.map(function (x) { return '<tr><td><b>' + esc(staffName(x.id)) + '</b></td><td>' + num(x.convos) + '</td><td>' + num(x.replies) + '</td><td>' + (x.avgMin == null ? '—' : waitTxt(Math.round(x.avgMin))) + '</td></tr>'; }).join('')
        : '<tr><td colspan="4" class="tkmut">ยังไม่มีใครตอบในช่วงนี้</td></tr>') + '</tbody></table></div></div>' +
      '<div class="sec"><div class="sec-h"><div><h2>รายเพจ</h2><p>push = ข้อความที่นับโควตาแพ็กเกจ LINE (ตอบช้ากว่า ~1 นาทีหลังลูกค้าทัก)</p></div></div><div class="sec-b tight"><table class="pp-table"><thead><tr><th>เพจ</th><th>ลูกค้า</th><th>ค้างตอบ</th><th>ตอบเฉลี่ย</th><th>push</th></tr></thead><tbody>' +
      (s.channels.length ? s.channels.map(function (x) { var c = chOf(x.id); return '<tr><td><span class="ch-dot" style="background:' + esc(c.color) + '"></span> <b>' + esc(c.name) + '</b></td><td>' + num(x.custs) + '</td><td>' + (x.pending ? '<b class="bad">' + x.pending + '</b>' : '0') + '</td><td>' + (x.avgMin == null ? '—' : waitTxt(Math.round(x.avgMin))) + '</td><td>' + num(x.push) + '</td></tr>'; }).join('')
        : '<tr><td colspan="5" class="tkmut">ยังไม่มีข้อมูล</td></tr>') + '</tbody></table><p class="hint" style="padding:10px 14px 0">push เดือนนี้รวม ' + num(k.pushThisMonth) + ' ข้อความ</p></div></div></div>';
    h += '<div class="sec"><div class="sec-h"><div><h2>ลูกค้าทักช่วงไหนเยอะ</h2><p>เข้ม = ข้อความเข้ามาเยอะ · ใช้จัดคนเข้ากะตอบแชท</p></div></div><div class="sec-b"><div class="cs-heat">' +
      '<div class="cs-hr"><span></span>' + Array.from({ length: 24 }, function (_, i) { return '<b>' + (i % 3 === 0 ? i : '') + '</b>'; }).join('') + '</div>' +
      [1, 2, 3, 4, 5, 6, 0].map(function (d) {
        return '<div class="cs-hr"><span>' + DOW[d] + '</span>' + s.heat[d].map(function (n, hr) {
          return '<i title="' + DOW[d] + ' ' + hr + ':00 · ' + n + ' ข้อความ" style="opacity:' + (n ? (0.15 + 0.85 * n / hmx).toFixed(2) : 0.05) + '"></i>'; }).join('') + '</div>';
      }).join('') + '</div></div></div>';
    $('#csWrap').innerHTML = h;
  }

  global.KAN_CHAT = {
    init: function (x) { X = x; },
    render: function (route) { if (route.name === 'chatstats') { if (C.timer) { clearInterval(C.timer); C.timer = null; } return renderStats(); } return renderChat(route); },
  };
})(window);
