/* ============================================================
   KAN — ส่ง SMS (แยกจากบรอดแคสต์ LINE · หมวด Kan Chat · นนท์ 29 ก.ย. 69)
   #/sms          เขียน + เลือกผู้รับ + ประวัติการส่ง
   #/sms/<id>     ผลการส่งรายเบอร์
   #/smssetup     ผู้ให้บริการ · ชื่อผู้ส่ง · API key · เรทบาทต่อเครดิต (หัวหน้า)
   ============================================================ */
(function (global) {
  'use strict';
  var X = null;
  var F = { title: '', text: '', leads: false, leadStatus: [], chat: false, numbers: '' };
  var H = null, CNT = null, cntTimer = null;
  var LS_TH = { new: 'ใหม่', contacted: 'ติดต่อแล้ว', qualified: 'มีแนวโน้ม', proposal: 'เสนอราคา', won: 'ปิดการขาย', lost: 'ไม่สำเร็จ', nurture: 'ติดตามต่อ' };
  var ST_TH = { mock: 'จำลอง', sent: 'ส่งแล้ว', partial: 'ส่งได้บางส่วน', fail: 'ส่งไม่สำเร็จ' };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return X.esc(s); }
  function api(p, m, b) { return X.api(p, m, b); }
  function toast(m, bad) { X.toast(m, bad); }
  function fail(e) { toast(e && e.message ? e.message : String(e), true); }
  function num(n) { return Number(n || 0).toLocaleString('th-TH'); }
  function baht(n) { return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function credits(t) {
    t = String(t || ''); var n = Array.from(t).length, uni = /[^\x00-\x7F]/.test(t);
    if (!n) return { n: 0, per: 0, uni: uni, limit: uni ? 70 : 160 };
    return { n: n, uni: uni, per: uni ? (n <= 70 ? 1 : Math.ceil(n / 67)) : (n <= 160 ? 1 : Math.ceil(n / 153)), limit: uni ? 70 : 160 };
  }
  function staffName(id) { var s = X.staffById(id); return s ? String(s.name).split(/\s+/)[0] : '—'; }
  function sources() { return { leads: F.leads, leadStatus: F.leadStatus, chat: F.chat, numbers: F.numbers }; }

  function modeBar(cfg) {
    if (cfg.live) return '';
    return '<div class="bl-mode"><b>โหมดจำลอง</b> — ยังไม่ได้ต่อผู้ให้บริการ SMS กดส่งแล้วระบบบันทึกผลให้ดูครบ แต่ไม่มีข้อความออกไปหาลูกค้า' +
      (X.isOwner() ? ' · <a href="#/smssetup">ตั้งค่า SMS</a>' : '') + '</div>';
  }

  function pageHome() {
    var v = $('#view');
    v.className = 'page sms-page';
    if (!H) v.innerHTML = '<div class="loading">กำลังโหลด…</div>';
    api('/sms/home').then(function (j) { H = j; paintHome(); recount(); }).catch(function (e) { v.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }
  function paintHome() {
    var j = H, c = credits(F.text);
    var lc = {}; (j.leadCounts || []).forEach(function (r) { lc[r.status] = r.n; });
    var leadTotal = (j.leadCounts || []).reduce(function (s, r) { return s + r.n; }, 0);
    var h = '<div class="top"><div><span class="kicker">Kan Chat</span><h1>ส่ง SMS</h1><p>ส่งข้อความเข้าเบอร์โทรลูกค้าโดยตรง (ไม่ต้องแอด LINE) · แยกจากบรอดแคสต์ LINE · คิดค่าส่งตามจำนวนเครดิต</p></div>' +
      (X.isOwner() ? '<div class="top-r"><a class="btn-ghost" href="#/smssetup">ตั้งค่า SMS</a></div>' : '') + '</div>' + modeBar(j.cfg);
    h += '<div class="sms-grid"><div class="sms-main">' +
      '<div class="sec"><div class="sec-h"><h2><i class="bl-step">1</i>ข้อความ</h2><p>ภาษาไทย 70 ตัวอักษร = 1 เครดิต · ยาวกว่านั้นคิดท่อนละ 67 ตัว</p></div><div class="sec-b">' +
        '<label class="pp-f"><span>ชื่อรายการ <small>ไว้ดูในประวัติ ลูกค้าไม่เห็น</small></span><input id="smsTitle" value="' + esc(F.title) + '" placeholder="เช่น แจ้งโปรเฟอร์ 50% ลูกค้าเก่า"></label>' +
        '<label class="pp-f" style="margin-top:12px"><span>ข้อความ SMS</span><textarea id="smsBody" rows="4" placeholder="KAN Store ลดเฟอร์ 50% ถึง 31 ต.ค. ดูโปร kan-hub.com/promo">' + esc(F.text) + '</textarea></label>' +
        '<div class="sms-cnt" id="smsCnt">' + cntText(c) + '</div></div></div>' +
      '<div class="sec"><div class="sec-h"><h2><i class="bl-step">2</i>ส่งถึงใคร</h2><p>เบอร์ซ้ำกันนับครั้งเดียว · เบอร์ที่ไม่ใช่มือถือไทยจะถูกตัดออก</p></div><div class="sec-b">' +
        '<label class="bl-check"><input type="checkbox" id="smsLeads"' + (F.leads ? ' checked' : '') + '> ลีดใน CRM ที่มีเบอร์ <small>(' + num(leadTotal) + ' เบอร์)</small></label>' +
        (F.leads ? '<div class="sms-sts">' + Object.keys(LS_TH).map(function (k) {
          return '<label class="bl-check sm"><input type="checkbox" data-lst="' + k + '"' + (F.leadStatus.indexOf(k) !== -1 ? ' checked' : '') + '> ' + LS_TH[k] + ' <small>' + num(lc[k] || 0) + '</small></label>'; }).join('') +
          '<span class="hint">ไม่ติ๊กสถานะ = ทุกสถานะ</span></div>' : '') +
        '<label class="bl-check"><input type="checkbox" id="smsChat"' + (F.chat ? ' checked' : '') + '> ลูกค้าในแชท LINE ที่ทีมบันทึกเบอร์ไว้ <small>(' + num(j.chatPhones) + ' เบอร์)</small></label>' +
        '<label class="pp-f" style="margin-top:10px"><span>เบอร์เพิ่มเอง <small>วางทีละบรรทัด หรือคั่นด้วยคอมมา · ก็อปจาก Excel ได้</small></span><textarea id="smsNums" rows="3" placeholder="0812345678&#10;0899999999">' + esc(F.numbers) + '</textarea></label>' +
      '</div></div></div>' +
      '<div class="sms-side"><div class="sec sms-sum"><div class="sec-h"><h2>สรุปก่อนส่ง</h2></div><div class="sec-b" id="smsSum">' + sumHtml() + '</div></div>' +
        '<div class="sec"><div class="sec-h"><h2>พรีวิว</h2></div><div class="sec-b"><div class="sms-phone"><div class="sms-bub">' + (F.text ? esc(F.text).replace(/\n/g, '<br>') : '<span class="tkmut">ข้อความจะขึ้นตรงนี้</span>') + '</div>' +
          '<small>ผู้ส่ง: ' + esc(j.cfg.sender || '(ยังไม่ได้ตั้งชื่อผู้ส่ง)') + '</small></div></div></div></div></div>';
    h += '<div class="sec"><div class="sec-h"><div><h2>ประวัติการส่ง</h2><p>' + (j.sends.length ? j.sends.length + ' รายการล่าสุด' : 'ยังไม่เคยส่ง') + '</p></div></div><div class="sec-b tight">' +
      (j.sends.length ? '<table class="pp-table"><thead><tr><th>เมื่อ</th><th>รายการ</th><th>ผู้รับ</th><th>ส่งถึง</th><th>เครดิต</th><th>ค่าส่ง (บาท)</th><th>สถานะ</th><th>โดย</th></tr></thead><tbody>' +
        j.sends.map(function (s) {
          return '<tr class="sms-row" data-go="#/sms/' + esc(s.id) + '"><td>' + esc(X.fmtAgo(s.at)) + '</td><td><b>' + esc(s.title) + '</b><br><small class="tkmut">' + esc(s.text.slice(0, 60)) + '</small></td>' +
            '<td>' + num(s.target) + '</td><td>' + num(s.sent) + (s.fail ? ' <small class="bad">พลาด ' + num(s.fail) + '</small>' : '') + '</td><td>' + num(s.credits) + '</td><td>' + baht(s.cost) + '</td>' +
            '<td><span class="pill' + (s.status === 'fail' ? ' blocked' : '') + '">' + (ST_TH[s.status] || s.status) + '</span></td><td>' + esc(staffName(s.by)) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="hint" style="padding:14px 18px">ส่งครั้งแรกแล้วประวัติจะขึ้นตรงนี้</p>') + '</div></div>';
    $('#view').innerHTML = h;
  }
  function cntText(c) {
    if (!c.n) return 'ยังไม่ได้พิมพ์';
    return c.n + ' ตัวอักษร · <b>' + c.per + ' เครดิต/เบอร์</b> · ' + (c.uni ? 'มีภาษาไทย (70 ตัว/เครดิต)' : 'อังกฤษล้วน (160 ตัว/เครดิต)') +
      (c.n > c.limit ? ' · <span class="warn">ยาวเกิน 1 ข้อความ ลูกค้าจะได้รับเป็นหลายท่อนต่อกัน</span>' : '');
  }
  function sumHtml() {
    var cfg = H.cfg, c = credits(F.text);
    if (!CNT) return '<p class="hint">เลือกผู้รับทางซ้าย</p>';
    var cost = CNT.n * c.per * (cfg.rate || 0);
    return '<dl class="sms-dl"><dt>ผู้รับ</dt><dd><b>' + num(CNT.n) + '</b> เบอร์' + (CNT.bad ? ' <small class="bad">ตัดเบอร์ผิดรูปแบบ ' + CNT.bad + '</small>' : '') + '</dd>' +
      '<dt>เครดิตรวม</dt><dd>' + num(CNT.n * c.per) + '</dd>' +
      '<dt>ค่าส่งประมาณ</dt><dd><b>' + baht(cost) + ' บาท</b><small> (' + baht(cfg.rate) + ' บาท/เครดิต)</small></dd>' +
      '<dt>ผู้ให้บริการ</dt><dd>' + esc(cfg.providers[cfg.provider] || cfg.provider) + '</dd></dl>' +
      (CNT.sample && CNT.sample.length ? '<div class="sms-sample">' + CNT.sample.map(function (x) { return '<span>' + esc(x.phone) + (x.name ? ' · ' + esc(x.name) : '') + ' <i>' + esc(x.source) + '</i></span>'; }).join('') + (CNT.n > CNT.sample.length ? '<span class="tkmut">… อีก ' + num(CNT.n - CNT.sample.length) + ' เบอร์</span>' : '') + '</div>' : '') +
      (H.canEdit ? '<button type="button" class="btn sms-go" id="smsSend"' + (CNT.n && F.text.trim() ? '' : ' disabled') + '>' + (cfg.live ? 'ส่ง SMS ' + num(CNT.n) + ' เบอร์' : 'ส่ง (จำลอง) ' + num(CNT.n) + ' เบอร์') + '</button>' : '<p class="hint">สิทธิ์ของคุณเป็นแบบดูอย่างเดียว</p>');
  }
  function recount() {
    clearTimeout(cntTimer);
    cntTimer = setTimeout(function () {
      if (!F.leads && !F.chat && !F.numbers.trim()) { CNT = { n: 0, bad: 0, sample: [] }; var el0 = $('#smsSum'); if (el0) el0.innerHTML = sumHtml(); return; }
      api('/sms/count', 'POST', { sources: sources(), text: F.text }).then(function (j) { CNT = j; var el = $('#smsSum'); if (el) el.innerHTML = sumHtml(); }).catch(fail);
    }, 250);
  }
  function pageDetail(id) {
    var v = $('#view');
    v.className = 'page sms-page';
    v.innerHTML = '<div class="loading">กำลังโหลด…</div>';
    api('/sms/send/' + id).then(function (j) {
      var s = j.send;
      v.innerHTML = '<div class="top"><div><span class="kicker">ส่ง SMS</span><h1>' + esc(s.title) + '</h1><p>' + esc(X.fmtFull ? X.fmtFull(s.at) : s.at) + ' · โดย ' + esc(staffName(s.by)) + '</p></div>' +
        '<div class="top-r"><a class="btn-ghost" href="#/sms">← กลับ</a></div></div>' +
        '<div class="cards"><article class="hot"><span class="l">ผู้รับ</span><b>' + num(s.target) + '</b><small>เบอร์</small></article>' +
        '<article><span class="l">ส่งถึง</span><b>' + num(s.sent) + '</b><small>' + (ST_TH[s.status] || s.status) + '</small></article>' +
        '<article' + (s.fail ? ' class="bad"' : '') + '><span class="l">ไม่สำเร็จ</span><b>' + num(s.fail) + '</b><small>' + esc(s.error || '—') + '</small></article>' +
        '<article><span class="l">ค่าส่ง</span><b>' + baht(s.cost) + '</b><small>บาท · ' + num(s.credits) + ' เครดิต</small></article></div>' +
        '<div class="sec"><div class="sec-h"><h2>ข้อความ</h2></div><div class="sec-b"><div class="sms-phone"><div class="sms-bub">' + esc(s.text).replace(/\n/g, '<br>') + '</div></div></div></div>' +
        '<div class="sec"><div class="sec-h"><h2>รายเบอร์</h2><p>' + j.targets.length + ' เบอร์</p></div><div class="sec-b tight"><table class="pp-table"><thead><tr><th>เบอร์</th><th>ชื่อ</th><th>มาจาก</th><th>ผล</th></tr></thead><tbody>' +
        j.targets.map(function (t) { return '<tr><td>' + esc(t.phone) + '</td><td>' + esc(t.name || '—') + '</td><td>' + esc(t.source) + '</td><td>' + (t.status === 'fail' ? '<span class="bad">' + esc(t.err || 'ไม่สำเร็จ') + '</span>' : (ST_TH[t.status] || t.status)) + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>';
    }).catch(function (e) { v.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }
  function pageSetup() {
    var v = $('#view');
    v.className = 'page sms-page';
    if (!X.isOwner()) { v.innerHTML = '<div class="top"><div><span class="kicker">Kan Chat</span><h1>ตั้งค่า SMS</h1><p>หน้านี้สำหรับหัวหน้าเท่านั้น</p></div></div>'; return; }
    api('/sms/home').then(function (j) {
      var c = j.cfg;
      v.innerHTML = '<div class="top"><div><span class="kicker">Kan Chat</span><h1>ตั้งค่า SMS</h1><p>ผู้ให้บริการส่ง SMS ในไทย · ต้องมีบัญชีและจดทะเบียนชื่อผู้ส่งกับเจ้านั้นก่อน</p></div>' +
        '<div class="top-r"><a class="btn-ghost" href="#/sms">← ส่ง SMS</a></div></div>' +
        '<div class="sec"><div class="sec-b"><div class="ls-grid">' +
          '<label class="pp-f"><span>ผู้ให้บริการ</span><select id="ssProv">' + Object.keys(c.providers).map(function (k) { return '<option value="' + k + '"' + (c.provider === k ? ' selected' : '') + '>' + esc(c.providers[k]) + '</option>'; }).join('') + '</select></label>' +
          '<label class="pp-f"><span>ชื่อผู้ส่ง (Sender) <small>ที่จดทะเบียนไว้ ไม่เกิน 11 ตัว</small></span><input id="ssSender" value="' + esc(c.sender) + '" placeholder="เช่น KANHUB" maxlength="11"></label>' +
          '<label class="pp-f"><span>ค่าส่ง บาท/เครดิต <small>ใช้คำนวณค่าใช้จ่าย</small></span><input id="ssRate" type="number" step="0.01" min="0" value="' + (c.rate || 0) + '"></label>' +
          '<label class="pp-f"><span>API key ' + (c.hasKey ? '<small>ใส่แล้ว ••••' + esc(c.keyTail) + '</small>' : '<small>ยังไม่ได้ใส่</small>') + '</span><input id="ssKey" type="password" autocomplete="off" placeholder="' + (c.hasKey ? '••••••••' : 'วาง API key') + '"></label>' +
          '<label class="pp-f"><span>API secret ' + (c.hasSecret ? '<small>ใส่แล้ว</small>' : '<small>ยังไม่ได้ใส่</small>') + '</span><input id="ssSecret" type="password" autocomplete="off" placeholder="' + (c.hasSecret ? '••••••••' : 'วาง API secret') + '"></label>' +
        '</div>' +
        '<p class="hint" style="margin-top:12px">ThaiBulkSMS: เข้า account.thaibulksms.com → API Key · ยังเป็น "โหมดจำลอง" = บันทึกผลอย่างเดียว ไม่มีข้อความออกจริง</p>' +
        '<div class="ls-acts"><button type="button" class="btn" id="ssSave">บันทึก</button>' + (c.hasKey ? '<span class="ls-sp"></span><button type="button" class="btn-text danger" id="ssClear">ลบ API key</button>' : '') + '</div>' +
        '</div></div>';
    }).catch(function (e) { v.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t || !$('.sms-page')) return;
    if (t.id === 'smsTitle') F.title = t.value;
    if (t.id === 'smsBody') {
      F.text = t.value; $('#smsCnt').innerHTML = cntText(credits(F.text));
      var b = $('.sms-bub'); if (b) b.innerHTML = F.text ? esc(F.text).replace(/\n/g, '<br>') : '<span class="tkmut">ข้อความจะขึ้นตรงนี้</span>';
      recount();
    }
    if (t.id === 'smsNums') { F.numbers = t.value; recount(); }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t || !$('.sms-page')) return;
    if (t.id === 'smsLeads') { F.leads = t.checked; paintHome(); recount(); }
    if (t.id === 'smsChat') { F.chat = t.checked; recount(); }
    if (t.hasAttribute && t.hasAttribute('data-lst')) {
      var k = t.getAttribute('data-lst'), i = F.leadStatus.indexOf(k);
      if (t.checked && i === -1) F.leadStatus.push(k); if (!t.checked && i !== -1) F.leadStatus.splice(i, 1);
      recount();
    }
  });
  document.addEventListener('click', function (ev) {
    if (!$('.sms-page')) return;
    var r = ev.target.closest('.sms-row[data-go]');
    if (r) { location.hash = r.getAttribute('data-go'); return; }
    if (ev.target.closest('#smsSend')) {
      var c = credits(F.text), cost = CNT.n * c.per * (H.cfg.rate || 0);
      if (!confirm((H.cfg.live ? 'ส่ง SMS จริง' : 'ส่งแบบจำลอง') + ' ถึง ' + num(CNT.n) + ' เบอร์\n' + num(CNT.n * c.per) + ' เครดิต · ประมาณ ' + baht(cost) + ' บาท\n\nยืนยันส่ง?')) return;
      var btn = $('#smsSend'); btn.disabled = true; btn.textContent = 'กำลังส่ง…';
      api('/sms/send', 'POST', { title: F.title, text: F.text, sources: sources() }).then(function (j) {
        X.okDialog({ title: j.status === 'mock' ? 'บันทึกการส่ง (จำลอง) แล้ว' : (j.fail ? 'ส่งได้บางส่วน' : 'ส่ง SMS แล้ว'),
          lines: ['ส่งถึง ' + num(j.sent) + ' เบอร์' + (j.fail ? ' · ไม่สำเร็จ ' + num(j.fail) : '')].concat(j.error ? ['ผู้ให้บริการแจ้ง: ' + j.error] : []),
          note: j.status === 'mock' ? 'ยังเป็นโหมดจำลอง ไม่มีข้อความออกไปถึงลูกค้า' : '' });
        F = { title: '', text: '', leads: false, leadStatus: [], chat: false, numbers: '' }; CNT = null;
        location.hash = '#/sms/' + j.id;
      }).catch(function (e) { fail(e); btn.disabled = false; btn.textContent = 'ส่ง'; });
      return;
    }
    if (ev.target.closest('#ssSave')) {
      api('/sms/settings', 'PUT', { provider: $('#ssProv').value, sender: $('#ssSender').value, rate: $('#ssRate').value, apiKey: $('#ssKey').value || undefined, apiSecret: $('#ssSecret').value || undefined })
        .then(function () { toast('บันทึกการตั้งค่า SMS แล้ว'); H = null; pageSetup(); }).catch(fail);
      return;
    }
    if (ev.target.closest('#ssClear')) {
      if (!confirm('ลบ API key/secret? ระบบจะกลับไปส่งแบบจำลอง')) return;
      api('/sms/settings', 'PUT', { clearKey: true, provider: 'mock' }).then(function () { H = null; pageSetup(); }).catch(fail);
    }
  });

  global.KAN_SMS = {
    init: function (x) { X = x; },
    render: function (route) {
      if (route.name === 'smssetup') return pageSetup();
      if (route.id) return pageDetail(route.id);
      return pageHome();
    },
  };
})(window);
