/* ============================================================
   KAN — Kan Bot แชทบอท (นนท์ 10 ต.ค. 69) · หน้าเดียว 3 ช่องแบบ Dabby
   #/bot          ตั้งค่า | prompt | แชทจำลอง  (เพจเริ่มต้น = Kan Hub)
   #/bot/<chId>   เปิดเพจนั้น
   หลังบ้าน: /api/t/bot/*  (worker-bot.js)
   ============================================================ */
(function (global) {
  'use strict';
  var X = null;
  var B = { state: null, ch: '', draft: '', dirty: false, sim: [], simBusy: false, simCost: 0, versions: null, simModel: '' };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return X.esc(s); }
  function api(p, m, b) { return X.api(p, m, b); }
  function toast(m, bad) { X.toast(m, bad); }
  function fail(e) { toast(e && e.message ? e.message : String(e), true); }
  function baht(n) { return n < 1 ? n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : n.toLocaleString('th-TH', { maximumFractionDigits: 2 }); }
  function cfg() { return B.state.configs[B.ch]; }
  function canEdit() { return B.state && B.state.canEdit; }
  function chOf(id) { return (B.state.channels || []).filter(function (c) { return c.id === id; })[0] || { name: id, color: '#06C755' }; }
  function modelOf(id) { return B.state.models.filter(function (m) { return m.id === id; })[0] || B.state.models[0]; }

  function render(route) {
    var v = $('#view');
    v.className = 'page bot-page';
    if (!B.state) v.innerHTML = '<div class="loading">กำลังโหลด…</div>';
    return api('/bot/state').then(function (j) {
      B.state = j;
      var want = route && route.id;
      if (want && j.configs[want]) B.ch = want;
      if (!B.ch || !j.configs[B.ch]) B.ch = j.configs[j.defaultChannel] ? j.defaultChannel : ((j.channels[0] || {}).id || '');
      var p = j.prompts[B.ch];
      if (!B.dirty) B.draft = p ? p.text : '';
      B.versions = null;
      paint();
    }).catch(function (e) { v.innerHTML = '<div class="err">' + esc(e.message || e) + '</div>'; });
  }

  function paint() {
    var j = B.state, c = cfg(), p = j.prompts[B.ch], ch = chOf(B.ch);
    if (!B.ch) { $('#view').innerHTML = '<div class="err">ยังไม่มีเพจที่เปิดกล่องแชท — ไปที่ ตั้งค่า LINE ก่อน</div>'; return; }
    var runs = (j.month.runs || []);
    var live = runs.filter(function (r) { return !r.sim; }), sim = runs.filter(function (r) { return r.sim; });
    var sum = function (a, k) { return a.reduce(function (s, r) { return s + (r[k] || 0); }, 0); };
    var liveN = sum(live, 'n'), liveUsd = sum(live, 'usd'), simN = sum(sim, 'n'), simUsd = sum(sim, 'usd'), fails = sum(live, 'fails');
    var h = '<div class="top bot-top"><div><span class="kicker">Kan Chat</span><h1>แชทบอท <span class="en">Kan Bot</span></h1>' +
      '<p>บอทตอบแชท LINE แทนแอดมิน ตอบสั้น คัดกรอง แล้วขอเบอร์ให้ทีมโทรกลับ · แอดมินพิมพ์ในแชทไหน บอทหยุดตอบแชทนั้นทันที</p></div>' +
      '<div class="top-r bot-chs">' + j.channels.map(function (x) {
        var on = j.configs[x.id] && j.configs[x.id].enabled;
        return '<a class="bot-ch' + (x.id === B.ch ? ' on' : '') + '" href="#/bot/' + esc(x.id) + '"><i style="background:' + esc(x.color) + '"></i>' + esc(x.name) +
          '<em class="' + (on ? 'live' : '') + '">' + (on ? 'เปิด' : 'ปิด') + '</em></a>';
      }).join('') + '</div></div>';
    if (!j.hasKey) h += '<div class="bot-warn"><b>ยังไม่ได้ใส่ API key ของ GPT ที่เซิร์ฟเวอร์</b> บอทจะยังไม่ตอบ และแชทจำลองใช้ไม่ได้ · ใส่ secret <code>OPENROUTER_API_KEY</code> (หรือ <code>OPENAI_API_KEY</code>) ใน Cloudflare</div>';

    h += '<div class="bot-grid">';
    /* ---- ซ้าย: ตั้งค่า ---- */
    h += '<aside class="bot-col bot-set">' +
      '<section class="bot-card"><div class="bot-row"><div><b>เปิดบอทในเพจ ' + esc(ch.name) + '</b><small>' +
        (c.enabled ? 'กำลังตอบลูกค้าจริง' + (j.hasKey ? '' : ' (แต่ยังไม่มี API key)') : 'ปิดอยู่ ลองในแชทจำลองได้') + '</small></div>' +
        sw('enabled', c.enabled) + '</div>' +
        (c.enabled && ch && !ch.token ? '' : '') + '</section>' +
      '<section class="bot-card"><label class="label" for="botModel">โมเดล GPT</label>' +
        '<select class="select" id="botModel" ' + dis() + '>' + j.models.map(function (m) {
          return '<option value="' + esc(m.id) + '"' + (m.id === c.model ? ' selected' : '') + '>' + esc(m.label) + ' · ' + esc(m.note) + '</option>'; }).join('') + '</select>' +
        '<p class="bot-hint">ราคาต่อ 1 ล้าน token: เข้า $' + modelOf(c.model).inp + ' · ออก $' + modelOf(c.model).out + ' · ส่วนที่แคชไว้ $' + modelOf(c.model).cache +
        (j.provider ? ' · ผ่าน ' + (j.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI') : '') + '</p></section>' +
      '<section class="bot-card"><b class="label">บับเบิลต่อการตอบ</b><div class="bot-2">' +
        '<label>ต่ำสุด<select class="select" id="botMinB" ' + dis() + '>' + [1, 2, 3].map(function (n) { return '<option' + (n === c.min_b ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
        '<label>สูงสุด<select class="select" id="botMaxB" ' + dis() + '>' + [2, 3, 4, 5].map(function (n) { return '<option' + (n === c.max_b ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label></div>' +
        '<p class="bot-hint">แยกบับเบิลด้วย <code>[SPLIT]</code> ใน prompt · LINE ส่งได้ไม่เกิน 5 ข้อความต่อครั้ง</p></section>' +
      '<section class="bot-card"><div class="bot-row"><div><b>ตอบเฉพาะช่วงเวลา</b><small>เวลาไทย · นอกช่วงให้แอดมินตอบเอง</small></div>' + sw('hoursOn', c.hours_on) + '</div>' +
        '<div class="bot-2' + (c.hours_on ? '' : ' off') + '"><label>ตั้งแต่<input class="input" type="time" id="botFrom" value="' + esc(c.hours_from) + '" ' + dis() + '></label>' +
        '<label>ถึง<input class="input" type="time" id="botTo" value="' + esc(c.hours_to) + '" ' + dis() + '></label></div></section>' +
      '<section class="bot-card"><div class="bot-row"><div><b>ได้เบอร์แล้วส่งเข้าลีด (CRM)</b><small>สร้างลีดให้เอง 1 ครั้งต่อแชท + แจ้งเตือนทีมขาย</small></div>' + sw('leadOn', c.lead_on) + '</div></section>' +
      '<section class="bot-card bot-stats"><b class="label">เดือนนี้</b>' +
        '<div class="bot-kpis"><div><span>ตอบลูกค้าจริง</span><b>' + liveN.toLocaleString('th-TH') + '</b><small>' + baht(liveUsd * j.usdThb) + ' บาท</small></div>' +
        '<div><span>ได้เบอร์เข้า CRM</span><b>' + (j.month.leads || 0) + '</b><small>ลีดจาก Kan Bot</small></div>' +
        '<div><span>ลองในแชทจำลอง</span><b>' + simN + '</b><small>' + baht(simUsd * j.usdThb) + ' บาท</small></div></div>' +
        (fails ? '<p class="bot-hint bad">ตอบไม่สำเร็จ ' + fails + ' ครั้ง</p>' : '') +
        '<p class="bot-hint">คิด 1 ดอลลาร์ ≈ ' + j.usdThb + ' บาท</p></section>' +
      '<p class="bot-pw">Powered by M Creation</p>' +
      '</aside>';

    /* ---- กลาง: prompt ---- */
    h += '<section class="bot-col bot-prompt"><div class="bot-ph"><div><b>คำสั่งบอท (prompt)</b><small>' +
        (p ? 'เวอร์ชัน ' + p.version + ' · บันทึก ' + esc(X.fmtAgo ? X.fmtAgo(p.at) : p.at) : 'ยังไม่มี prompt') +
        ' · ' + B.draft.length.toLocaleString('th-TH') + ' ตัวอักษร' + (B.dirty ? ' · <em>ยังไม่บันทึก</em>' : '') + '</small></div>' +
        '<div class="bot-pa"><button type="button" class="btn-text" id="botVers">ประวัติเวอร์ชัน</button>' +
        (canEdit() ? '<button type="button" class="btn sm" id="botSave"' + (B.dirty ? '' : ' disabled') + '>บันทึกเป็นเวอร์ชันใหม่</button>' : '') + '</div></div>' +
      '<div id="botVerList"></div>' +
      '<textarea class="bot-ta" id="botTa" spellcheck="false" ' + dis() + ' placeholder="วาง prompt ที่ใช้ใน Dabby ได้เลย · ใช้ [SPLIT] แยกบับเบิล · [IMAGE]https://… ส่งรูป">' + esc(B.draft) + '</textarea>' +
      '<p class="bot-hint">แชทจำลองทางขวาใช้ข้อความในช่องนี้ทันที แม้ยังไม่กดบันทึก · ลูกค้าจริงเห็นเวอร์ชันที่บันทึกล่าสุด</p></section>';

    /* ---- ขวา: แชทจำลอง ---- */
    h += '<aside class="bot-col bot-sim"><div class="bot-simh"><b>แชทจำลอง</b><span>' +
        '<select class="select sm" id="botSimModel" title="ลองโมเดลอื่นในแชทจำลอง">' + j.models.map(function (m) {
          return '<option value="' + esc(m.id) + '"' + (m.id === (B.simModel || c.model) ? ' selected' : '') + '>' + esc(m.label) + '</option>'; }).join('') + '</select>' +
        '<button type="button" class="btn-text" id="botSimReset">เริ่มใหม่</button></span></div>' +
      '<div class="bot-phone"><div class="bot-lh"><span class="bot-ka">' + esc(ch.name.slice(0, 3).toUpperCase()) + '</span><b>' + esc(ch.name) + '</b></div>' +
        '<div class="bot-chat" id="botChat"></div>' +
        '<form class="bot-in" id="botSimForm"><input id="botSimIn" placeholder="พิมพ์เป็นลูกค้า เช่น กระสอบ 45 โลเท่าไหร่" autocomplete="off"' + (j.hasKey ? '' : ' disabled') + '>' +
        '<button type="submit" class="btn sm"' + (j.hasKey ? '' : ' disabled') + '>ส่ง</button></form></div>' +
      '<p class="bot-hint" id="botSimCost">' + (B.simCost ? 'คุยรอบนี้ใช้ไป ~' + baht(B.simCost) + ' บาท' : 'ลองถามแบบลูกค้าจริง ดูว่าตอบสั้นและขอเบอร์ไหม') + '</p>' +
      '<div class="bot-quick">' + ['สวัสดีครับ', 'กระสอบ 45 โลเท่าไหร่', 'มียีนส์ไหม', 'โกดังอยู่ไหน', 'ขอดูตัวอย่างเกรด A', '0812345678', '2+3 เท่ากับเท่าไหร่']
        .map(function (q) { return '<button type="button" data-q="' + esc(q) + '"' + (j.hasKey ? '' : ' disabled') + '>' + esc(q) + '</button>'; }).join('') + '</div>' +
      '</aside></div>';

    $('#view').innerHTML = h;
    paintChat();
    wire();
  }
  function dis() { return canEdit() ? '' : 'disabled'; }
  function sw(k, on) { return '<button type="button" class="bot-sw' + (on ? ' on' : '') + '" data-sw="' + k + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '"' + (canEdit() ? '' : ' disabled') + '><i></i></button>'; }

  function paintChat() {
    var box = $('#botChat'); if (!box) return;
    if (!B.sim.length) { box.innerHTML = '<div class="bot-empty">พิมพ์ข้อความด้านล่าง<br>เพื่อลองคุยกับ Kan Bot</div>'; return; }
    box.innerHTML = B.sim.map(function (t) {
      if (t.role === 'user') return '<div class="bot-m me"><span>' + esc(t.text) + '</span></div>';
      if (t.err) return '<div class="bot-m err">' + esc(t.err) + '</div>';
      return (t.bubbles || []).map(function (b) {
        return b.kind === 'image' ? '<div class="bot-m bot"><a href="' + esc(b.url) + '" target="_blank" rel="noopener"><img src="' + esc(b.url) + '" alt="รูปจากบอท" loading="lazy"></a></div>'
          : '<div class="bot-m bot"><span>' + esc(b.text).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>') + '</span></div>';
      }).join('') + (t.usage ? '<div class="bot-meta">' + t.bubbles.length + ' บับเบิล · ' + (t.usage.ms / 1000).toFixed(1) + ' วิ · ~' + baht(t.usage.thb) + ' บาท' + (t.phone ? ' · <b>ได้เบอร์</b> → ของจริงจะเข้า CRM' : '') + '</div>' : '');
    }).join('') + (B.simBusy ? '<div class="bot-m bot typing"><span><i></i><i></i><i></i></span></div>' : '');
    box.scrollTop = box.scrollHeight;
  }

  function saveCfg(patch) {
    var c = cfg();
    var body = Object.assign({ channelId: B.ch, enabled: !!c.enabled, model: c.model, minB: c.min_b, maxB: c.max_b, hoursOn: !!c.hours_on,
      hoursFrom: c.hours_from, hoursTo: c.hours_to, leadOn: !!c.lead_on }, patch);
    return api('/bot/config', 'PUT', body).then(function (j) { B.state.configs[B.ch] = j.config; paint(); toast('บันทึกแล้ว'); }).catch(function (e) { fail(e); paint(); });
  }

  function sendSim(text) {
    text = String(text || '').trim();
    if (!text || B.simBusy) return;
    B.sim.push({ role: 'user', text: text });
    B.simBusy = true; paintChat();
    var turns = [];
    B.sim.forEach(function (t) {
      if (t.role === 'user') turns.push({ role: 'user', text: t.text });
      else if (t.bubbles) turns.push({ role: 'assistant', text: t.raw || t.bubbles.map(function (b) { return b.kind === 'image' ? '[IMAGE]' + b.url : b.text; }).join('\n[SPLIT]\n') });
    });
    api('/bot/sim', 'POST', { channelId: B.ch, turns: turns, prompt: B.draft, model: $('#botSimModel') ? $('#botSimModel').value : '' }).then(function (j) {
      B.sim.push({ role: 'assistant', bubbles: j.bubbles, raw: j.raw, usage: j.usage, phone: j.phone });
      B.simCost += j.usage.thb || 0;
    }).catch(function (e) { B.sim.push({ role: 'assistant', err: e.message || String(e) }); })
      .then(function () { B.simBusy = false; paintChat(); var pc = $('#botSimCost'); if (pc && B.simCost) pc.textContent = 'คุยรอบนี้ใช้ไป ~' + baht(B.simCost) + ' บาท'; });
  }

  function wire() {
    $$('[data-sw]').forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.sw, c = cfg(), cur = { enabled: c.enabled, hoursOn: c.hours_on, leadOn: c.lead_on }[k];
        var patch = {}; patch[k] = !cur;
        if (k === 'enabled' && !cur && !B.state.prompts[B.ch]) return toast('บันทึก prompt ก่อนเปิดบอท', true);
        if (k === 'enabled' && !cur && !confirmLive()) return;
        saveCfg(patch);
      };
    });
    var on = function (id, k) { var el = $('#' + id); if (el) el.onchange = function () { var p = {}; p[k] = el.value; saveCfg(p); }; };
    on('botModel', 'model'); on('botMinB', 'minB'); on('botMaxB', 'maxB'); on('botFrom', 'hoursFrom'); on('botTo', 'hoursTo');
    var ta = $('#botTa');
    if (ta) ta.oninput = function () {
      B.draft = ta.value; var p = B.state.prompts[B.ch];
      var was = B.dirty; B.dirty = !p || p.text !== B.draft;
      var sv = $('#botSave'); if (sv) sv.disabled = !B.dirty;
      var sm = $('.bot-ph small'); if (sm && was !== B.dirty) sm.innerHTML = sm.innerHTML.replace(/ · <em>ยังไม่บันทึก<\/em>/, '') + (B.dirty ? ' · <em>ยังไม่บันทึก</em>' : '');
    };
    var sv = $('#botSave');
    if (sv) sv.onclick = function () {
      var note = (global.prompt ? '' : '');
      api('/bot/prompt', 'POST', { channelId: B.ch, text: B.draft, note: note }).then(function (j) {
        toast('บันทึก prompt เวอร์ชัน ' + j.version + ' แล้ว'); B.dirty = false; return render({ id: B.ch });
      }).catch(fail);
    };
    var vb = $('#botVers');
    if (vb) vb.onclick = function () {
      var box = $('#botVerList');
      if (box.innerHTML) { box.innerHTML = ''; return; }
      api('/bot/prompts?ch=' + encodeURIComponent(B.ch)).then(function (j) {
        box.innerHTML = '<div class="bot-vers">' + (j.versions.length ? j.versions.map(function (v) {
          return '<div class="bot-ver' + (v.active ? ' on' : '') + '"><b>v' + v.version + '</b><span>' + esc(X.fmtFull ? X.fmtFull(v.at) : v.at) + ' · ' + v.len.toLocaleString('th-TH') + ' ตัวอักษร' +
            (v.by === 'bot' ? '' : ' · ' + esc((X.staffById && X.staffById(v.by) || {}).name || '')) + '</span>' +
            (v.active ? '<em>ใช้อยู่</em>' : '<button type="button" class="btn-text" data-load="' + esc(v.id) + '">เปิดดู</button>' + (canEdit() ? '<button type="button" class="btn-text" data-act="' + esc(v.id) + '">ใช้เวอร์ชันนี้</button>' : '')) + '</div>';
        }).join('') : '<p class="bot-hint">ยังไม่มีเวอร์ชัน</p>') + '</div>';
        $$('[data-load]', box).forEach(function (b) { b.onclick = function () { api('/bot/prompts/' + b.dataset.load).then(function (r) { B.draft = r.text; B.dirty = true; paint(); toast('เปิด v' + r.version + ' ในช่องแก้แล้ว (ยังไม่บันทึก)'); }).catch(fail); }; });
        $$('[data-act]', box).forEach(function (b) { b.onclick = function () { api('/bot/prompts/' + b.dataset.act + '/activate', 'POST').then(function () { B.dirty = false; toast('สลับเวอร์ชันแล้ว'); return render({ id: B.ch }); }).catch(fail); }; });
      }).catch(fail);
    };
    var f = $('#botSimForm');
    if (f) f.onsubmit = function (e) { e.preventDefault(); var i = $('#botSimIn'); sendSim(i.value); i.value = ''; i.focus(); };
    $$('[data-q]').forEach(function (b) { b.onclick = function () { sendSim(b.dataset.q); }; });
    var rs = $('#botSimReset'); if (rs) rs.onclick = function () { B.sim = []; B.simCost = 0; paintChat(); var pc = $('#botSimCost'); if (pc) pc.textContent = 'เริ่มบทสนทนาใหม่แล้ว'; };
    var smd = $('#botSimModel'); if (smd) smd.onchange = function () { B.simModel = smd.value; };
  }
  function confirmLive() {
    return global.confirm ? global.confirm('เปิดบอทให้ตอบลูกค้าจริงในเพจ ' + chOf(B.ch).name + '?\nแอดมินพิมพ์ในแชทไหน บอทจะหยุดตอบแชทนั้นเอง') : true;
  }

  global.KAN_BOT = {
    init: function (x) { X = x; },
    render: render,
  };
})(window);
