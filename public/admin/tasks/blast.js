/* ============================================================
   KAN — หน้าบรอดแคสต์ LINE OA + SMS
   ------------------------------------------------------------
   แยกไฟล์ออกจาก tasks.js (ที่โตมาก) แต่ยังอยู่ในหน้าเดียวกัน —
   tasks.js ส่งเครื่องมือที่ใช้ร่วมกัน (api/esc/toast/okDialog/…) เข้ามาทาง init()
   จะได้ไม่ต้องก๊อปฟังก์ชันซ้ำสองที่

   4 หน้าในนี้:
     #/blast       รายการใบบรอดแคสต์ + เพจทั้งหมด
     #/blast/<id>  หน้าเขียน/ส่ง (ถ้าส่งไปแล้ว = หน้ารายงานผล)
     #/richmenu    ริชเมนูของแต่ละเพจ (สลับ/ตั้งเวลาเปลี่ยน)
     #/lineusers   ผู้ติดตามรายคน
     #/blastsetup  ตั้งค่าเพจ + SMS

   ตอนนี้เป็นโหมดจำลอง — ยังไม่ได้ต่อ LINE Messaging API จริง
   ============================================================ */
(function (global) {
  'use strict';

  var X = null;                 /* เครื่องมือจาก tasks.js */
  var HOME = null;              /* ผลจาก /blast/home (แคชไว้ระหว่างสลับหน้า) */
  var E = null;                 /* สถานะหน้าเขียนบรอดแคสต์ที่กำลังแก้อยู่ */
  var RM = { ch: '', menus: null, edit: null };
  var LU = { ch: '', q: '' };
  var RP = { f: 'all' };   /* ตัวกรองรายชื่อผู้รับในหน้ารายงาน */

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return X.esc(s); }
  function api(p, m, b) { return X.api(p, m, b); }
  function toast(m, bad) { X.toast(m, bad); }
  function num(n) { return Number(n || 0).toLocaleString('th-TH'); }
  function view() { return $('#view'); }
  function fail(e) { toast(e && e.message ? e.message : String(e), true); }

  /* แถบบอกว่ายังเป็นของจำลอง — ต้องเห็นทุกหน้า ไม่งั้นทีมเข้าใจผิดว่าส่งออกไปจริงแล้ว */
  function modeBar(extra) {
    return '<div class="bl-mode"><b>โหมดทดสอบ</b> — ยังไม่ได้ต่อ LINE ของจริง ' +
      'กดส่งแล้วระบบจะบันทึกผลไว้ให้ดูครบทุกขั้น แต่ไม่มีข้อความออกไปถึงลูกค้า' +
      (extra ? ' ' + extra : '') +
      ' <a href="#/blastsetup">ใส่ Channel access token</a></div>';
  }
  function chanById(id) {
    var list = (HOME && HOME.channels) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function chDot(c, small) {
    if (!c) return '';
    return '<i class="bl-dot' + (small ? ' sm' : '') + '" style="background:' + esc(c.color || '#06C755') + '"></i>';
  }
  function statusPill(b) {
    if (b.status === 'sent') return '<span class="pill done">ส่งแล้ว</span>';
    if (b.status === 'scheduled') return '<span class="pill repeat">ตั้งเวลา ' + esc(X.fmtFull(b.scheduledAt)) + '</span>';
    if (b.status === 'canceled') return '<span class="pill">ยกเลิก</span>';
    return '<span class="pill todo">ร่าง</span>';
  }
  function loadHome(force) {
    if (HOME && !force) return Promise.resolve(HOME);
    return api('/blast/home').then(function (j) { HOME = j; return j; });
  }

  /* ============================================================
     #/blast — รายการ
     ============================================================ */
  function pageList() {
    loadHome(true).then(function (j) {
      var chs = j.channels, bs = j.blasts;
      var reach = chs.reduce(function (a, c) { return a + (c.reach || 0); }, 0);
      var mth = new Date(); mth.setDate(1); mth.setHours(0, 0, 0, 0);
      var sentThisMonth = bs.filter(function (b) { return b.sentAt && new Date(b.sentAt) >= mth; });
      var msgs = sentThisMonth.reduce(function (a, b) { return a + (b.nSent || 0); }, 0);
      var queued = bs.filter(function (b) { return b.status === 'scheduled'; });
      var drafts = bs.filter(function (b) { return b.status === 'draft'; });

      var v = view();
      v.className = 'page';
      var h = '<div class="top"><div><span class="kicker">LINE OA + SMS</span><h1>บรอดแคสต์</h1>' +
        '<p>ส่งข้อความถึงคนที่แอดเพจ LINE ของเรา เลือกได้ว่าจะยิงเพจไหน ทุกคนหรือเฉพาะกลุ่ม — ' +
        'และพ่วง SMS ไปพร้อมกันในใบเดียวได้</p></div>' +
        '<div class="top-r"><a class="btn-ghost" href="#/richmenu">ริชเมนู</a>' +
        '<button type="button" class="btn" id="blNew">+ สร้างบรอดแคสต์</button></div></div>';
      h += modeBar();

      h += '<div class="cards">' +
        '<article><span class="l">เพจที่ยิงได้</span><b>' + chs.filter(function (c) { return c.active; }).length + '</b><small>จากทั้งหมด ' + chs.length + ' เพจ</small></article>' +
        '<article><span class="l">คนที่ส่งถึงได้</span><b>' + num(reach) + '</b><small>ผู้ติดตามที่ยังไม่บล็อกเพจ</small></article>' +
        '<article' + (msgs ? ' class="warn"' : '') + '><span class="l">ส่งไปเดือนนี้</span><b>' + num(msgs) + '</b><small>' + sentThisMonth.length + ' ครั้ง</small></article>' +
        '<article><span class="l">รอส่งตามเวลา</span><b>' + queued.length + '</b><small>' + (drafts.length ? 'ร่างค้างอีก ' + drafts.length + ' ใบ' : 'ไม่มีร่างค้าง') + '</small></article></div>';

      /* ---- เพจ ---- */
      h += '<div class="sec"><div class="sec-h"><h2>เพจ LINE OA</h2><p>โควตา = จำนวนข้อความที่แพ็กเกจเดือนนี้ยังส่งได้</p></div><div class="sec-b tight">' +
        '<div class="bl-chgrid">' + chs.map(function (c) {
          var pctUsed = c.quotaLimit ? Math.min(100, Math.round(c.quotaUsed / c.quotaLimit * 100)) : 0;
          return '<div class="bl-ch' + (c.active ? '' : ' off') + '">' +
            '<div class="bl-ch-h">' + chDot(c) + '<b>' + esc(c.name) + '</b><span>' + esc(c.basicId || '') + '</span></div>' +
            '<div class="bl-ch-n"><b>' + num(c.reach) + '</b> คนที่ส่งถึงได้' +
              (c.followers > c.reach ? ' <small>· บล็อก ' + num(c.followers - c.reach) + '</small>' : '') + '</div>' +
            (c.quotaLimit
              ? '<div class="bl-quota"><i style="width:' + pctUsed + '%"></i></div>' +
                '<small class="bl-ch-q">เหลือ ' + num(c.quotaLeft) + ' จาก ' + num(c.quotaLimit) + ' ข้อความ</small>'
              : '<small class="bl-ch-q">ยังไม่ได้ตั้งโควตา</small>') +
            '<div class="bl-ch-f">' + (c.hasToken
              ? '<span class="bl-ok">ต่อ LINE แล้ว ••••' + esc(c.tokenTail) + '</span>'
              : '<span class="bl-warn">ยังไม่ได้ใส่ token</span>') +
              '<a class="btn-text" href="#/blastsetup">ตั้งค่า</a></div></div>';
        }).join('') + '</div></div></div>';

      /* ---- ใบบรอดแคสต์ ---- */
      h += '<div class="sec"><div class="sec-h"><h2>ใบบรอดแคสต์</h2><p>' + bs.length + ' ใบ</p></div>';
      if (!bs.length) {
        h += '<div class="sec-b"><div class="empty">ยังไม่มีใบบรอดแคสต์ — กด “+ สร้างบรอดแคสต์” หรือเปิดจากงานประเภท LINE OA ได้เลย</div></div>';
      } else {
        h += '<div class="sec-b tight"><div class="tlist">' + bs.map(function (b) {
          var cs = b.channels.map(chanById).filter(Boolean);
          return '<a class="bl-row" href="#/blast/' + esc(b.id) + '">' +
            '<span class="bl-row-m">' + statusPill(b) + '</span>' +
            '<span class="bl-row-t"><b>' + esc(b.title) + '</b>' +
              '<small>' + cs.map(function (c) { return chDot(c, 1) + esc(c.name); }).join(' · ') +
              (b.smsOn ? ' <i class="bl-tag">SMS</i>' : '') +
              (b.taskId ? ' <i class="bl-tag">จากงาน</i>' : '') + '</small></span>' +
            '<span class="bl-row-n">' + (b.status === 'sent'
              ? '<b>' + num(b.nSent) + '</b><small>ถึงมือผู้รับ' + (b.nFail ? ' · ไม่ถึง ' + num(b.nFail) : '') + '</small>'
              : '<small>' + (b.status === 'scheduled' ? 'รอถึงเวลา' : 'ยังไม่ได้ส่ง') + '</small>') + '</span>' +
            '<span class="bl-row-d">' + esc(X.fmtAgo(b.sentAt || b.scheduledAt || b.updatedAt)) + '</span></a>';
        }).join('') + '</div></div>';
      }
      h += '</div>';
      v.innerHTML = h;
      var nb = $('#blNew');
      if (nb) nb.addEventListener('click', function () { createBlast({}); });
    }).catch(function (e) { fail(e); view().innerHTML = '<div class="err"><b>โหลดไม่สำเร็จ</b><p>' + esc(e.message) + '</p></div>'; });
  }

  function createBlast(seed) {
    return api('/blast/new', 'POST', {
      title: seed.title || 'บรอดแคสต์ ' + X.fmtFull(new Date().toISOString()),
      taskId: seed.taskId || null, campaignId: seed.campaignId || null,
      channels: seed.channels || [], messages: seed.messages || [],
      audience: { kind: 'all' },
    }).then(function (j) { location.hash = '#/blast/' + j.id; return j.id; }).catch(fail);
  }

  /* ============================================================
     #/blast/<id> — หน้าเขียน + ส่ง
     ซ้าย = ตั้งค่าทีละขั้น (เพจ → คนรับ → ข้อความ → SMS)
     ขวา = พรีวิวหน้าจอมือถือ + สรุปว่าจะถึงกี่คน + ปุ่มส่ง (ติดหนึบไว้ให้เห็นตลอด)
     ============================================================ */
  function pageItem(id) {
    Promise.all([loadHome(), api('/blast/item/' + id)]).then(function (r) {
      var j = r[1];
      E = { id: id, b: j.blast, result: j.result || [], sample: j.sample || [], task: null, taskFiles: [], counts: null, users: {}, saving: 0 };
      if (!E.b.audience || !E.b.audience.kind) E.b.audience = { kind: 'all' };
      if (!E.b.audience.sms) E.b.audience.sms = { useLine: true, leads: false, leadStatus: [], numbers: '' };
      if (E.b.status === 'sent') { renderReport(); return; }
      var p = E.b.taskId ? api('/tasks/' + E.b.taskId).catch(function () { return null; }) : Promise.resolve(null);
      return p.then(function (tj) {
        if (tj && tj.task) {
          E.task = tj.task;
          E.taskFiles = (tj.files || []).filter(function (f) { return f.kind !== 'link' && /^image\//.test(f.mime || ''); });
        }
        renderComposer();
      });
    }).catch(function (e) { fail(e); location.hash = '#/blast'; });
  }

  function audienceLabel(a) {
    if (a.kind === 'all') return 'ทุกคนที่แอดเพจ';
    if (a.kind === 'pick') return 'เลือกรายคน ' + ((a.ids || []).length) + ' คน';
    var bits = [];
    if ((a.tags || []).length) bits.push('แท็ก ' + a.tags.join('/'));
    if ((a.branches || []).length) bits.push('สาขา ' + a.branches.join('/'));
    if (a.bought === 'yes') bits.push('เคยซื้อแล้ว');
    if (a.bought === 'no') bits.push('ยังไม่เคยซื้อ');
    if (a.newDays) bits.push('เพิ่งแอดใน ' + a.newDays + ' วัน');
    if (a.quietDays) bits.push('เงียบเกิน ' + a.quietDays + ' วัน');
    return bits.length ? bits.join(' · ') : 'กรองกลุ่ม (ยังไม่ได้เลือกเงื่อนไข = ทุกคน)';
  }
  function imgSrc(m) {
    if (m.fileId) return X.API + '/files/' + m.fileId;
    return m.url || '';
  }

  function renderComposer() {
    var b = E.b, a = b.audience;
    var chs = HOME.channels;
    var v = view();
    v.className = 'page';

    var h = '<div class="bl-crumbs"><a href="#/blast">บรอดแคสต์</a><span>›</span>' +
      (E.task ? '<a href="#/task/' + esc(E.task.id) + '">' + esc(E.task.title) + '</a><span>›</span>' : '') +
      statusPill(b) + '</div>';

    h += '<div class="bl-head"><input class="bl-title" id="blTitle" value="' + esc(b.title) + '" placeholder="ชื่อใบบรอดแคสต์ (ไว้ให้ทีมหาเจอทีหลัง)">' +
      '<div class="bl-head-r"><button type="button" class="btn-ghost sm danger" id="blDel">ลบใบนี้</button></div></div>';
    h += modeBar();

    h += '<div class="bl-wrap"><div class="bl-main">';

    /* ---- ขั้น 1: เพจ ---- */
    h += '<div class="sec"><div class="sec-h"><h2><i class="bl-step">1</i>เลือกเพจที่จะส่ง</h2>' +
      '<p>ติ๊กได้หลายเพจ ระบบยิงให้ทีละเพจแล้วรายงานผลแยกกัน</p></div><div class="sec-b">' +
      '<div class="bl-pick-all"><button type="button" class="btn-text" data-chall="1">เลือกทั้งหมด</button>' +
      '<button type="button" class="btn-text" data-chall="0">ล้างที่เลือก</button></div>' +
      '<div class="bl-chpick">' + chs.map(function (c) {
        var on = b.channels.indexOf(c.id) !== -1;
        return '<button type="button" class="bl-chbox' + (on ? ' on' : '') + (c.active ? '' : ' off') + '" data-ch="' + esc(c.id) + '">' +
          '<span class="bl-tick">' + (on ? '✓' : '') + '</span>' + chDot(c) +
          '<span class="bl-chbox-t"><b>' + esc(c.name) + '</b><small>' + esc(c.basicId || '') + ' · ' + num(c.reach) + ' คน</small></span>' +
          (c.quotaLimit && c.quotaLeft < c.reach ? '<span class="bl-chbox-w">โควตาเหลือ ' + num(c.quotaLeft) + '</span>' : '') +
          '</button>';
      }).join('') + '</div></div></div>';

    /* ---- ขั้น 2: คนรับ ---- */
    h += '<div class="sec"><div class="sec-h"><h2><i class="bl-step">2</i>ใครได้รับ</h2>' +
      '<p>' + esc(audienceLabel(a)) + '</p></div><div class="sec-b">' +
      '<div class="bl-seg">' +
      ['all|ทุกคนที่แอดเพจ|ยิงทีเดียวถึงทุกคน',
       'filter|กรองกลุ่ม|แท็ก · สาขา · เคยซื้อ · เพิ่งแอด',
       'pick|เลือกรายคน|ติ๊กทีละชื่อ'].map(function (x) {
        var p = x.split('|');
        return '<button type="button" class="bl-segb' + (a.kind === p[0] ? ' on' : '') + '" data-aud="' + p[0] + '">' +
          '<b>' + p[1] + '</b><small>' + p[2] + '</small></button>';
      }).join('') + '</div>';

    if (a.kind === 'filter') {
      var tags = HOME.tags || [], brs = HOME.branches || [];
      h += '<div class="bl-filt">' +
        '<div class="field"><label class="label">แท็ก <small>เลือกหลายอันได้ = ใครมีแท็กใดแท็กหนึ่งก็ได้รับ</small></label><div class="chips">' +
        (tags.length ? tags.map(function (t) {
          return '<button type="button" class="chip' + ((a.tags || []).indexOf(t) !== -1 ? ' on' : '') + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') : '<span class="hint">ยังไม่มีแท็กในระบบ</span>') + '</div></div>' +
        '<div class="field"><label class="label">สาขาที่ผูกไว้</label><div class="chips">' +
        brs.map(function (t) {
          return '<button type="button" class="chip' + ((a.branches || []).indexOf(t) !== -1 ? ' on' : '') + '" data-br="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') + '</div></div>' +
        '<div class="grid3">' +
        '<div class="field"><label class="label">เคยซื้อหรือยัง</label><select class="select" id="audBought">' +
          [['any', 'ไม่สนใจ'], ['yes', 'เคยซื้อแล้ว'], ['no', 'ยังไม่เคยซื้อ']].map(function (o) {
            return '<option value="' + o[0] + '"' + ((a.bought || 'any') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label class="label">เพิ่งแอดภายใน (วัน)</label><input class="input" type="number" min="0" max="365" id="audNew" value="' + (a.newDays || '') + '" placeholder="เว้นว่าง = ไม่จำกัด"></div>' +
        '<div class="field"><label class="label">เงียบมาเกิน (วัน)</label><input class="input" type="number" min="0" max="365" id="audQuiet" value="' + (a.quietDays || '') + '" placeholder="ไว้ตามคนที่หายไป"></div>' +
        '</div></div>';
    }
    if (a.kind === 'pick') {
      h += '<div class="bl-pickbox"><div class="bl-pickbar">' +
        '<input class="input" id="pickQ" placeholder="ค้นหาชื่อ / เบอร์ / แท็ก">' +
        '<span class="hint" id="pickN">' + num((a.ids || []).length) + ' คนที่เลือกไว้</span></div>' +
        '<div id="pickList" class="bl-picklist"><div class="loading">กำลังโหลดรายชื่อ…</div></div></div>';
    }
    h += '</div></div>';

    /* ---- ขั้น 3: ข้อความ ---- */
    h += '<div class="sec"><div class="sec-h"><h2><i class="bl-step">3</i>ข้อความ</h2>' +
      '<p>LINE ส่งได้สูงสุด 5 ก้อนต่อครั้ง</p></div><div class="sec-b">' +
      '<div id="msgList">' + (b.messages.length ? b.messages.map(msgBlock).join('') :
        '<div class="empty">ยังไม่มีข้อความ — เพิ่มข้อความ รูป หรือการ์ดมีปุ่มด้านล่าง</div>') + '</div>' +
      '<div class="acts bl-addrow">' +
      '<button type="button" class="btn-ghost sm" data-add="text">+ ข้อความ</button>' +
      '<button type="button" class="btn-ghost sm" data-add="image">+ รูป</button>' +
      '<button type="button" class="btn-ghost sm" data-add="card">+ การ์ดมีปุ่ม</button>' +
      (E.taskFiles.length ? '<span class="hint">รูปในงานนี้มี ' + E.taskFiles.length + ' รูป เลือกใช้ได้เลย</span>' : '') +
      '</div></div></div>';

    /* ---- ขั้น 4: SMS ---- */
    var sms = a.sms || {};
    h += '<div class="sec"><div class="sec-h"><h2><i class="bl-step">4</i>ส่ง SMS ด้วยไหม</h2>' +
      '<p>ยังไม่ได้เลือกผู้ให้บริการ SMS — นับจำนวนให้ดูก่อนได้</p></div><div class="sec-b">' +
      '<label class="bl-switch"><input type="checkbox" id="smsOn"' + (b.smsOn ? ' checked' : '') + '>' +
      '<span>ส่ง SMS พร้อมกับ LINE ในใบเดียวกัน</span></label>' +
      '<div id="smsBox"' + (b.smsOn ? '' : ' hidden') + ' class="bl-smsbox">' +
      '<div class="field"><label class="label">ข้อความ SMS <small>ภาษาไทย 70 ตัวอักษร = 1 ข้อความ</small></label>' +
      '<textarea class="textarea" id="smsText" rows="3" placeholder="สั้น ๆ ตรงประเด็น + ลิงก์">' + esc(b.smsText || '') + '</textarea>' +
      '<div class="hint" id="smsCount"></div></div>' +
      '<div class="field"><label class="label">ส่งถึงใคร</label>' +
      '<label class="bl-check"><input type="checkbox" id="smsUseLine"' + (sms.useLine ? ' checked' : '') + '> เบอร์ของคนที่เลือกไว้ข้างบน</label>' +
      '<label class="bl-check"><input type="checkbox" id="smsLeads"' + (sms.leads ? ' checked' : '') + '> ลีดใน CRM ที่มีเบอร์</label>' +
      '</div>' +
      '<div class="field"><label class="label">เบอร์เพิ่มเอง <small>วางทีละบรรทัดหรือคั่นด้วยคอมมา</small></label>' +
      '<textarea class="textarea" id="smsNums" rows="2" placeholder="0812345678&#10;0899999999">' + esc(sms.numbers || '') + '</textarea></div>' +
      '</div></div></div>';

    h += '</div>';   /* /bl-main */

    /* ---- คอลัมน์ขวา ---- */
    h += '<div class="bl-side"><div class="bl-sticky">' +
      '<div class="sec"><div class="sec-h"><h2>พรีวิว</h2><p>หน้าตาในแชท</p></div>' +
      '<div class="sec-b bl-phone-wrap"><div class="bl-phone" id="blPhone"></div></div></div>' +
      '<div class="sec"><div class="sec-h"><h2>จะถึงกี่คน</h2></div><div class="sec-b tight">' +
      '<div id="blCount"><div class="loading">กำลังนับ…</div></div></div></div>' +
      '<div class="bl-sendbox">' +
      '<button type="button" class="btn-ghost" id="blTest">ส่งทดสอบถึงตัวเอง</button>' +
      '<button type="button" class="btn-ghost" id="blSched">ตั้งเวลาส่ง</button>' +
      '<button type="button" class="btn" id="blSend">ส่งเลย</button>' +
      (b.status === 'scheduled' ? '<button type="button" class="btn-text" id="blCancel">ยกเลิกเวลาที่ตั้งไว้</button>' : '') +
      '</div></div></div>';

    h += '</div>';
    v.innerHTML = h;
    wireComposer();
    drawPhone();
    recount();
    if (a.kind === 'pick') loadPickList();
  }

  /* ---------- ก้อนข้อความหนึ่งก้อน ---------- */
  function msgBlock(m, i) {
    var head = '<div class="bl-mb-h"><b>' +
      (m.type === 'text' ? 'ข้อความ' : m.type === 'image' ? 'รูป' : 'การ์ดมีปุ่ม') + ' ' + (i + 1) + '</b>' +
      '<span class="bl-mb-acts">' +
      (i > 0 ? '<button type="button" class="btn-text" data-mv="' + i + ':-1">↑</button>' : '') +
      '<button type="button" class="btn-text" data-mv="' + i + ':1">↓</button>' +
      '<button type="button" class="btn-text" data-mrm="' + i + '">เอาออก</button></span></div>';
    if (m.type === 'text') {
      return '<div class="bl-mb">' + head +
        '<textarea class="textarea" rows="3" data-mtext="' + i + '" placeholder="พิมพ์ข้อความที่จะส่ง">' + esc(m.text || '') + '</textarea>' +
        '<div class="hint">' + (m.text || '').length + ' / 2,000 ตัวอักษร</div></div>';
    }
    if (m.type === 'image') {
      var src = imgSrc(m);
      return '<div class="bl-mb">' + head +
        (src ? '<div class="bl-mimg"><img src="' + esc(src) + '" alt=""></div>' : '<div class="bl-mimg empty">ยังไม่ได้เลือกรูป</div>') +
        '<div class="acts"><button type="button" class="btn-ghost sm" data-mpic="' + i + '">' + (src ? 'เปลี่ยนรูป' : 'เลือกรูป') + '</button></div></div>';
    }
    var src2 = imgSrc(m);
    return '<div class="bl-mb">' + head +
      (src2 ? '<div class="bl-mimg"><img src="' + esc(src2) + '" alt=""></div>' : '') +
      '<div class="field"><label class="label">หัวการ์ด</label><input class="input" data-mtitle="' + i + '" value="' + esc(m.title || '') + '"></div>' +
      '<div class="field"><label class="label">รายละเอียด</label><textarea class="textarea" rows="2" data-mtext="' + i + '">' + esc(m.text || '') + '</textarea></div>' +
      '<div class="field"><label class="label">ปุ่ม <small>ไม่เกิน 3 ปุ่ม</small></label>' +
      (m.buttons || []).map(function (bt, bi) {
        return '<div class="bl-btnrow"><input class="input" placeholder="ข้อความบนปุ่ม" data-mbl="' + i + ':' + bi + '" value="' + esc(bt.label || '') + '">' +
          '<input class="input" placeholder="https://…" data-mbu="' + i + ':' + bi + '" value="' + esc(bt.url || '') + '">' +
          '<button type="button" class="btn-text" data-mbrm="' + i + ':' + bi + '">ลบ</button></div>';
      }).join('') +
      ((m.buttons || []).length < 3 ? '<button type="button" class="btn-text" data-mbadd="' + i + '">+ เพิ่มปุ่ม</button>' : '') +
      '</div>' +
      '<div class="acts"><button type="button" class="btn-ghost sm" data-mpic="' + i + '">' + (src2 ? 'เปลี่ยนรูป' : 'ใส่รูปบนการ์ด') + '</button></div></div>';
  }
  function redrawMsgs() {
    var host = $('#msgList');
    if (!host) return;
    host.innerHTML = E.b.messages.length ? E.b.messages.map(msgBlock).join('')
      : '<div class="empty">ยังไม่มีข้อความ — เพิ่มข้อความ รูป หรือการ์ดมีปุ่มด้านล่าง</div>';
    drawPhone();
  }

  /* ---------- พรีวิวจอมือถือ ---------- */
  function drawPhone() {
    var host = $('#blPhone');
    if (!host) return;
    var b = E.b;
    var first = b.channels.length ? chanById(b.channels[0]) : null;
    var msgs = b.messages.filter(function (m) {
      return (m.type === 'text' && m.text) || ((m.type === 'image' || m.type === 'card') && (imgSrc(m) || m.title || m.text));
    });
    var h = '<div class="bl-ph-top">' + (first ? chDot(first) + esc(first.name) : 'ยังไม่ได้เลือกเพจ') +
      (b.channels.length > 1 ? ' <small>+อีก ' + (b.channels.length - 1) + ' เพจ</small>' : '') + '</div>' +
      '<div class="bl-ph-body">';
    if (!msgs.length) h += '<div class="bl-ph-empty">ข้อความที่พิมพ์จะขึ้นตรงนี้</div>';
    msgs.forEach(function (m) {
      if (m.type === 'text') {
        h += '<div class="bl-bub">' + esc(m.text).replace(/\n/g, '<br>') + '</div>';
      } else if (m.type === 'image') {
        h += '<div class="bl-bub img"><img src="' + esc(imgSrc(m)) + '" alt=""></div>';
      } else {
        h += '<div class="bl-bub card">' + (imgSrc(m) ? '<img src="' + esc(imgSrc(m)) + '" alt="">' : '') +
          '<div class="bl-cardtx">' + (m.title ? '<b>' + esc(m.title) + '</b>' : '') +
          (m.text ? '<p>' + esc(m.text).replace(/\n/g, '<br>') + '</p>' : '') + '</div>' +
          (m.buttons || []).filter(function (x) { return x.label; })
            .map(function (x) { return '<span class="bl-cardbtn">' + esc(x.label) + '</span>'; }).join('') + '</div>';
      }
    });
    if (b.smsOn && b.smsText) {
      h += '<div class="bl-smsprev"><span>SMS</span>' + esc(b.smsText).replace(/\n/g, '<br>') + '</div>';
    }
    h += '</div>';
    host.innerHTML = h;
  }

  /* ---------- นับคนรับ ---------- */
  var countTimer = null;
  function recount() {
    clearTimeout(countTimer);
    countTimer = setTimeout(function () {
      var host = $('#blCount');
      if (!host) return;
      api('/blast/count', 'POST', { channels: E.b.channels, audience: E.b.audience, smsOn: E.b.smsOn })
        .then(function (j) {
          E.counts = j;
          var total = j.per.reduce(function (a, x) { return a + x.reach; }, 0);
          var h = '';
          if (!E.b.channels.length) {
            h = '<div class="empty">ยังไม่ได้เลือกเพจ</div>';
          } else {
            h = '<div class="bl-cnt">' + j.per.map(function (x) {
              var c = chanById(x.channelId) || { name: x.channelId };
              var over = c.quotaLimit && x.reach > c.quotaLeft;
              return '<div class="bl-cntrow' + (over ? ' over' : '') + '">' + chDot(c, 1) +
                '<span class="bl-cntn">' + esc(c.name) + '</span><b>' + num(x.reach) + '</b>' +
                (x.blocked ? '<small>ข้าม ' + num(x.blocked) + '</small>' : '') +
                (over ? '<small class="bl-over">โควตาพอแค่ ' + num(c.quotaLeft) + '</small>' : '') + '</div>';
            }).join('') + '</div>' +
            '<div class="bl-cnttot"><span>รวม LINE</span><b>' + num(total) + ' คน</b></div>';
            if (E.b.smsOn) h += '<div class="bl-cnttot"><span>รวม SMS</span><b>' + num(j.sms) + ' เบอร์</b></div>';
          }
          host.innerHTML = h;
        }).catch(function () { host.innerHTML = '<div class="empty">นับไม่ได้ ลองใหม่อีกครั้ง</div>'; });
    }, 260);
  }

  /* ---------- บันทึกอัตโนมัติ ---------- */
  var saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    var go = function () {
      var b = E.b;
      return api('/blast/item/' + E.id, 'PUT', {
        title: b.title, channels: b.channels, audience: b.audience,
        lineOn: b.lineOn, smsOn: b.smsOn, messages: b.messages, smsText: b.smsText,
      }).catch(function (e) { toast('บันทึกไม่สำเร็จ: ' + e.message, true); });
    };
    if (now) return go();
    saveTimer = setTimeout(go, 700);
    return Promise.resolve();
  }

  /* ---------- ต่อปุ่มทั้งหมดในหน้าเขียน ---------- */
  function wireComposer() {
    var v = view();
    var ti = $('#blTitle');
    if (ti) ti.addEventListener('input', function () { E.b.title = ti.value; save(); });

    v.addEventListener('click', function (ev) {
      var t = ev.target, el;

      if ((el = t.closest('[data-ch]'))) {
        var cid = el.getAttribute('data-ch');
        var i = E.b.channels.indexOf(cid);
        if (i === -1) E.b.channels.push(cid); else E.b.channels.splice(i, 1);
        save(); renderComposer(); return;
      }
      if ((el = t.closest('[data-chall]'))) {
        E.b.channels = el.getAttribute('data-chall') === '1'
          ? HOME.channels.filter(function (c) { return c.active; }).map(function (c) { return c.id; }) : [];
        save(); renderComposer(); return;
      }
      if ((el = t.closest('[data-aud]'))) {
        E.b.audience.kind = el.getAttribute('data-aud');
        save(); renderComposer(); return;
      }
      if ((el = t.closest('[data-tag]'))) {
        var tg = el.getAttribute('data-tag');
        E.b.audience.tags = E.b.audience.tags || [];
        var ti2 = E.b.audience.tags.indexOf(tg);
        if (ti2 === -1) E.b.audience.tags.push(tg); else E.b.audience.tags.splice(ti2, 1);
        el.classList.toggle('on');
        save(); recount(); return;
      }
      if ((el = t.closest('[data-br]'))) {
        var br = el.getAttribute('data-br');
        E.b.audience.branches = E.b.audience.branches || [];
        var bi = E.b.audience.branches.indexOf(br);
        if (bi === -1) E.b.audience.branches.push(br); else E.b.audience.branches.splice(bi, 1);
        el.classList.toggle('on');
        save(); recount(); return;
      }
      if ((el = t.closest('[data-add]'))) {
        var kind = el.getAttribute('data-add');
        if (E.b.messages.length >= 5) { toast('LINE ส่งได้ไม่เกิน 5 ก้อนต่อครั้ง', true); return; }
        E.b.messages.push(kind === 'text' ? { type: 'text', text: '' }
          : kind === 'image' ? { type: 'image', fileId: '', url: '' }
          : { type: 'card', title: '', text: '', fileId: '', buttons: [] });
        save(); redrawMsgs();
        if (kind === 'image') pickImage(E.b.messages.length - 1);
        return;
      }
      if ((el = t.closest('[data-mrm]'))) {
        E.b.messages.splice(Number(el.getAttribute('data-mrm')), 1);
        save(); redrawMsgs(); return;
      }
      if ((el = t.closest('[data-mv]'))) {
        var p = el.getAttribute('data-mv').split(':'), from = Number(p[0]), to = from + Number(p[1]);
        if (to < 0 || to >= E.b.messages.length) return;
        var m = E.b.messages.splice(from, 1)[0];
        E.b.messages.splice(to, 0, m);
        save(); redrawMsgs(); return;
      }
      if ((el = t.closest('[data-mpic]'))) { pickImage(Number(el.getAttribute('data-mpic'))); return; }
      if ((el = t.closest('[data-mbadd]'))) {
        var mi = Number(el.getAttribute('data-mbadd'));
        E.b.messages[mi].buttons = E.b.messages[mi].buttons || [];
        E.b.messages[mi].buttons.push({ label: '', url: '' });
        save(); redrawMsgs(); return;
      }
      if ((el = t.closest('[data-mbrm]'))) {
        var q = el.getAttribute('data-mbrm').split(':');
        E.b.messages[Number(q[0])].buttons.splice(Number(q[1]), 1);
        save(); redrawMsgs(); return;
      }
      if ((el = t.closest('[data-pu]'))) {
        var uid = el.getAttribute('data-pu');
        E.b.audience.ids = E.b.audience.ids || [];
        var ui = E.b.audience.ids.indexOf(uid);
        if (ui === -1) E.b.audience.ids.push(uid); else E.b.audience.ids.splice(ui, 1);
        el.classList.toggle('on');
        var pn = $('#pickN');
        if (pn) pn.textContent = num(E.b.audience.ids.length) + ' คนที่เลือกไว้';
        save(); recount(); return;
      }
      if ((el = t.closest('[data-pall]'))) {
        var want = el.getAttribute('data-pall') === '1';
        var ids = $$('#pickList [data-pu]').map(function (x) { return x.getAttribute('data-pu'); });
        E.b.audience.ids = want ? ids.slice() : [];
        save(); loadPickList(); recount(); return;
      }
      if (t.closest('#blDel')) {
        if (!confirm('ลบใบบรอดแคสต์นี้? ย้อนกลับไม่ได้')) return;
        api('/blast/item/' + E.id, 'DELETE').then(function () { toast('ลบแล้ว'); location.hash = '#/blast'; }).catch(fail);
        return;
      }
      if (t.closest('#blTest')) { doTest(); return; }
      if (t.closest('#blSched')) { doSchedule(); return; }
      if (t.closest('#blSend')) { doSend(); return; }
      if (t.closest('#blCancel')) {
        api('/blast/item/' + E.id + '/cancel', 'POST').then(function () { toast('ยกเลิกเวลาที่ตั้งไว้แล้ว'); pageItem(E.id); }).catch(fail);
        return;
      }
    });

    v.addEventListener('input', function (ev) {
      var t = ev.target, k;
      if ((k = t.getAttribute('data-mtext')) != null) { E.b.messages[Number(k)].text = t.value; save(); drawPhone(); return; }
      if ((k = t.getAttribute('data-mtitle')) != null) { E.b.messages[Number(k)].title = t.value; save(); drawPhone(); return; }
      if ((k = t.getAttribute('data-mbl')) != null) {
        var a = k.split(':'); E.b.messages[Number(a[0])].buttons[Number(a[1])].label = t.value; save(); drawPhone(); return;
      }
      if ((k = t.getAttribute('data-mbu')) != null) {
        var c = k.split(':'); E.b.messages[Number(c[0])].buttons[Number(c[1])].url = t.value; save(); return;
      }
      if (t.id === 'audNew') { E.b.audience.newDays = Number(t.value) || 0; save(); recount(); return; }
      if (t.id === 'audQuiet') { E.b.audience.quietDays = Number(t.value) || 0; save(); recount(); return; }
      if (t.id === 'smsText') { E.b.smsText = t.value; save(); smsCount(); drawPhone(); return; }
      if (t.id === 'smsNums') { E.b.audience.sms.numbers = t.value; save(); recount(); return; }
      if (t.id === 'pickQ') { LU.q = t.value; loadPickList(); return; }
    });
    v.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.id === 'audBought') { E.b.audience.bought = t.value; save(); recount(); return; }
      if (t.id === 'smsOn') {
        E.b.smsOn = t.checked;
        var bx = $('#smsBox'); if (bx) bx.hidden = !t.checked;
        save(); recount(); drawPhone(); return;
      }
      if (t.id === 'smsUseLine') { E.b.audience.sms.useLine = t.checked; save(); recount(); return; }
      if (t.id === 'smsLeads') { E.b.audience.sms.leads = t.checked; save(); recount(); return; }
    });
    smsCount();
  }
  function smsCount() {
    var el = $('#smsCount');
    if (!el) return;
    var n = (E.b.smsText || '').length;
    var per = /[^\x00-\x7F]/.test(E.b.smsText || '') ? 70 : 160;
    el.textContent = n + ' ตัวอักษร · นับเป็น ' + Math.max(1, Math.ceil(n / per)) + ' ข้อความต่อเบอร์' +
      (per === 70 ? ' (มีภาษาไทย)' : ' (อังกฤษล้วน)');
  }

  /* ---------- เลือกรายคน ---------- */
  function loadPickList() {
    var host = $('#pickList');
    if (!host) return;
    var chIds = E.b.channels.length ? E.b.channels : HOME.channels.map(function (c) { return c.id; });
    Promise.all(chIds.map(function (c) {
      return api('/blast/users?ch=' + encodeURIComponent(c) + '&q=' + encodeURIComponent(LU.q || ''));
    })).then(function (rs) {
      var users = [];
      rs.forEach(function (r) { users = users.concat(r.users || []); });
      users = users.filter(function (u) { return !u.blocked; }).slice(0, 400);
      var ids = E.b.audience.ids || [];
      host.innerHTML = '<div class="bl-pickacts"><button type="button" class="btn-text" data-pall="1">เลือกทุกคนที่เห็น</button>' +
        '<button type="button" class="btn-text" data-pall="0">ล้าง</button></div>' +
        (users.length ? users.map(function (u) {
          var c = chanById(u.channelId);
          return '<button type="button" class="bl-pu' + (ids.indexOf(u.id) !== -1 ? ' on' : '') + '" data-pu="' + esc(u.id) + '">' +
            '<span class="bl-tick">' + (ids.indexOf(u.id) !== -1 ? '✓' : '') + '</span>' + chDot(c, 1) +
            '<span class="bl-pu-t"><b>' + esc(u.name || 'ไม่ทราบชื่อ') + '</b>' +
            '<small>' + (u.tags.length ? esc(u.tags.join(' · ')) : 'ไม่มีแท็ก') +
            (u.branch ? ' · ' + esc(u.branch) : '') + (u.bought ? ' · เคยซื้อ' : '') + '</small></span></button>';
        }).join('') : '<div class="empty">ไม่พบใครตามที่ค้นหา</div>');
    }).catch(function () { host.innerHTML = '<div class="empty">โหลดรายชื่อไม่สำเร็จ</div>'; });
  }

  /* ---------- เลือก/อัปรูป ----------
     รูปที่แนบไว้ในงานต้นทางมาก่อน เพราะเส้นทางที่นนท์วางไว้คือทีมใส่รูปในงานแล้วเอามายิงต่อ */
  function pickImage(idx) {
    var host = document.createElement('div');
    host.className = 'modal';
    var files = E.taskFiles || [];
    host.innerHTML = '<div class="modal-box bl-picker"><div class="modal-h"><h2>เลือกรูป</h2>' +
      '<button type="button" class="modal-x" data-x>✕</button></div><div class="modal-b">' +
      (files.length
        ? '<div class="label">รูปที่แนบไว้ในงาน “' + esc(E.task ? E.task.title : '') + '”</div><div class="bl-pgrid">' +
          files.map(function (f) {
            return '<button type="button" class="bl-pimg" data-fid="' + esc(f.id) + '">' +
              '<img src="' + esc(X.API + '/files/' + f.id) + '" alt=""><small>' + esc(f.fileName || '') + '</small></button>';
          }).join('') + '</div>'
        : '<div class="hint">งานต้นทางยังไม่มีรูปแนบ — อัปจากเครื่องได้เลย</div>') +
      '<div class="bl-pupload"><label class="label">อัปจากเครื่อง <small>ไม่เกิน 1.3MB · แนะนำ 1040×1040 ขึ้นไป</small></label>' +
      '<input type="file" accept="image/*" id="blFile"></div>' +
      '<div class="bl-pupload"><label class="label">หรือวางลิงก์รูป</label>' +
      '<input class="input" id="blUrl" placeholder="https://…"></div>' +
      '</div><div class="modal-f"><button type="button" class="btn-ghost" data-x>ปิด</button></div></div>';
    document.body.appendChild(host);
    var close = function () { host.remove(); };
    $$('[data-x]', host).forEach(function (b) { b.addEventListener('click', close); });
    host.addEventListener('click', function (ev) { if (ev.target === host) close(); });
    $$('[data-fid]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        E.b.messages[idx].fileId = b.getAttribute('data-fid');
        E.b.messages[idx].url = '';
        save(); redrawMsgs(); close();
      });
    });
    var url = $('#blUrl', host);
    url.addEventListener('change', function () {
      if (!url.value.trim()) return;
      E.b.messages[idx].url = url.value.trim();
      E.b.messages[idx].fileId = '';
      save(); redrawMsgs(); close();
    });
    $('#blFile', host).addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      if (f.size > 1350000) { toast('รูปใหญ่เกิน 1.3MB — ย่อก่อนแล้วลองใหม่', true); return; }
      var fr = new FileReader();
      fr.onload = function () {
        var b64 = String(fr.result).split(',')[1] || '';
        api('/blast/item/' + E.id + '/image', 'POST', { name: f.name, mime: f.type, data: b64 })
          .then(function (j) {
            E.b.messages[idx].fileId = j.fileId;
            E.b.messages[idx].url = '';
            save(); redrawMsgs(); close();
          }).catch(fail);
      };
      fr.readAsDataURL(f);
    });
  }

  /* ---------- ส่ง ---------- */
  function sendSummary() {
    var lines = [];
    var per = (E.counts && E.counts.per) || [];
    per.forEach(function (x) {
      var c = chanById(x.channelId);
      lines.push((c ? c.name : x.channelId) + ' — ' + num(x.reach) + ' คน');
    });
    if (E.b.smsOn && E.counts) lines.push('SMS — ' + num(E.counts.sms) + ' เบอร์');
    return lines;
  }
  function doTest() {
    api('/blast/item/' + E.id + '/test', 'POST', {}).then(function (j) {
      X.okDialog({
        title: 'ส่งทดสอบแล้ว',
        lines: ['ผู้รับทดสอบ: ' + (j.to || ''), 'ข้อความ ' + E.b.messages.length + ' ก้อน'],
        note: 'ตอนนี้เป็นโหมดทดสอบ ยังไม่มีข้อความออกไปจริง — พอใส่ token ของเพจแล้ว ปุ่มนี้จะยิงเข้า LINE ของคุณจริง ๆ',
      });
    }).catch(fail);
  }
  function doSchedule() {
    var d = new Date(Date.now() + 3600000);
    var def = X.toLocalInput(d.toISOString());
    var host = document.createElement('div');
    host.className = 'modal';
    host.innerHTML = '<div class="modal-box"><div class="modal-h"><h2>ตั้งเวลาส่ง</h2>' +
      '<button type="button" class="modal-x" data-x>✕</button></div><div class="modal-b">' +
      '<div class="field"><label class="label">ส่งเมื่อ</label>' +
      '<input class="input" type="datetime-local" id="schAt" value="' + esc(def) + '"></div>' +
      '<div class="hint">ระบบจะยิงให้เองเมื่อถึงเวลา · ยกเลิกได้ก่อนถึงเวลา</div>' +
      '</div><div class="modal-f"><button type="button" class="btn-ghost" data-x>ยกเลิก</button>' +
      '<button type="button" class="btn" id="schGo">ตั้งเวลา</button></div></div>';
    document.body.appendChild(host);
    var close = function () { host.remove(); };
    $$('[data-x]', host).forEach(function (b) { b.addEventListener('click', close); });
    $('#schGo', host).addEventListener('click', function () {
      var at = X.fromLocalInput($('#schAt', host).value);
      if (!at) { toast('ใส่วันเวลาก่อน', true); return; }
      save(true).then(function () {
        return api('/blast/item/' + E.id + '/send', 'POST', { at: at });
      }).then(function (j) {
        close();
        X.okDialog({ title: 'ตั้งเวลาแล้ว', lines: ['ส่ง ' + X.fmtFull(j.at)].concat(sendSummary()),
          onClose: function () { pageItem(E.id); } });
      }).catch(fail);
    });
  }
  function doSend() {
    if (!E.b.channels.length && E.b.lineOn) { toast('เลือกเพจที่จะส่งก่อน', true); return; }
    if (!E.b.messages.length && !(E.b.smsOn && E.b.smsText)) { toast('ยังไม่มีข้อความที่จะส่ง', true); return; }
    if (E.b.audience.kind === 'pick' && !(E.b.audience.ids || []).length) {
      toast('เลือก “เลือกรายคน” ไว้แต่ยังไม่ได้ติ๊กใคร — ติ๊กชื่อก่อน หรือเปลี่ยนเป็นทุกคน/กรองกลุ่ม', true); return;
    }
    var lines = sendSummary();
    var tot = ((E.counts && E.counts.per) || []).reduce(function (a, x) { return a + x.reach; }, 0);
    if (!confirm('ส่งบรอดแคสต์ “' + E.b.title + '” ถึง ' + num(tot) + ' คน?\n\n' + lines.join('\n') +
                 '\n\n(โหมดทดสอบ — ยังไม่มีข้อความออกไปจริง)')) return;
    var btn = $('#blSend');
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังส่ง…'; }
    save(true).then(function () {
      return api('/blast/item/' + E.id + '/send', 'POST', {});
    }).then(function (j) {
      X.okDialog({
        title: 'ส่งเรียบร้อย',
        lines: ['ถึงมือผู้รับ ' + num(j.nSent) + ' คน']
          .concat((j.perChannel || []).map(function (c) { return c.name + ' — ' + num(c.sent) + ' คน' + (c.skip ? ' (ข้าม ' + c.skip + ')' : ''); }))
          .concat(j.nFail ? ['ส่งไม่ถึง ' + num(j.nFail) + ' คน (โควตาเพจหมด)'] : []),
        note: 'โหมดทดสอบ — ผลข้างบนคือสิ่งที่จะเกิดขึ้นจริงเมื่อใส่ token แล้ว' +
              (E.b.taskId ? ' · บันทึกกลับเข้างานต้นทางให้แล้ว' : ''),
        onClose: function () { HOME = null; pageItem(E.id); },
      });
    }).catch(function (e) {
      fail(e);
      if (btn) { btn.disabled = false; btn.textContent = 'ส่งเลย'; }
    });
  }

  /* ============================================================
     หน้ารายงานผล (ใบที่ส่งไปแล้ว)
     ============================================================ */
  function renderReport() {
    var b = E.b;
    var v = view();
    v.className = 'page';
    var byCh = {};
    E.result.forEach(function (r) {
      var k = r.ch === 'sms' ? 'sms' : r.channel_id;
      byCh[k] = byCh[k] || { sent: 0, fail: 0, skip: 0 };
      byCh[k][r.status] = (byCh[k][r.status] || 0) + r.n;
    });
    var h = '<div class="bl-crumbs"><a href="#/blast">บรอดแคสต์</a><span>›</span>' +
      (b.taskId ? '<a href="#/task/' + esc(b.taskId) + '">งานต้นทาง</a><span>›</span>' : '') +
      statusPill(b) + '</div>';
    h += '<div class="top"><div><span class="kicker">รายงานผล</span><h1>' + esc(b.title) + '</h1>' +
      '<p>ส่งเมื่อ ' + esc(X.fmtFull(b.sentAt)) + '</p></div>' +
      '<div class="top-r"><button type="button" class="btn-ghost" id="blCopy">ก๊อปเป็นใบใหม่</button></div></div>';
    h += modeBar('ตัวเลขข้างล่างคือผลจำลองจากรายชื่อจริงในระบบ');

    h += '<div class="cards">' +
      '<article class="hot"><span class="l">ถึงมือผู้รับ</span><b>' + num(b.nSent) + '</b><small>จากเป้า ' + num(b.nTarget) + '</small></article>' +
      '<article' + (b.nFail ? ' class="bad"' : '') + '><span class="l">ส่งไม่ถึง</span><b>' + num(b.nFail) + '</b><small>' + (b.nFail ? 'โควตาเพจหมด' : 'ไม่มีที่ตกหล่น') + '</small></article>' +
      '<article><span class="l">ข้ามไป</span><b>' + num(Math.max(0, b.nTarget - b.nSent - b.nFail)) + '</b><small>บล็อกเพจไว้</small></article>' +
      '<article><span class="l">เพจที่ยิง</span><b>' + b.channels.length + '</b><small>' + (b.smsOn ? 'มี SMS ด้วย' : 'LINE อย่างเดียว') + '</small></article></div>';

    h += '<div class="sec"><div class="sec-h"><h2>แยกตามเพจ</h2></div><div class="sec-b tight"><div class="tlist">' +
      b.channels.map(function (cid) {
        var c = chanById(cid) || { name: cid };
        var r = byCh[cid] || {};
        return '<div class="bl-row static">' + '<span class="bl-row-m">' + chDot(c) + '</span>' +
          '<span class="bl-row-t"><b>' + esc(c.name) + '</b><small>' + esc(c.basicId || '') + '</small></span>' +
          '<span class="bl-row-n"><b>' + num(r.sent || 0) + '</b><small>ถึงมือผู้รับ' +
          ((r.fail || 0) ? ' · ไม่ถึง ' + num(r.fail) : '') + ((r.skip || 0) ? ' · ข้าม ' + num(r.skip) : '') + '</small></span></div>';
      }).join('') +
      (b.smsOn ? '<div class="bl-row static"><span class="bl-row-m"><span class="pill">SMS</span></span>' +
        '<span class="bl-row-t"><b>SMS</b><small>' + esc((b.smsText || '').slice(0, 60)) + '</small></span>' +
        '<span class="bl-row-n"><b>' + num((byCh.sms && byCh.sms.sent) || 0) + '</b><small>เบอร์</small></span></div>' : '') +
      '</div></div></div>';

    h += '<div class="sec"><div class="sec-h"><h2>ข้อความที่ส่งไป</h2></div><div class="sec-b bl-phone-wrap">' +
      '<div class="bl-phone" id="blPhone"></div></div></div>';

    /* รายชื่อผู้รับอาจมีหลักร้อย — ใส่กล่องเลื่อนไม่ให้ยืดหน้าจนหารายงานข้างบนไม่เจอ
       และเปิดมาที่ "ที่ไม่ถึง" ก่อนถ้ามี เพราะนั่นคือสิ่งที่ต้องตามต่อ */
    var bad = E.sample.filter(function (r) { return r.status !== 'sent'; });
    RP.f = bad.length ? 'bad' : 'all';
    h += '<div class="sec"><div class="sec-h"><h2>รายชื่อผู้รับ</h2>' +
      '<p>เก็บผลรายคนไว้ ' + E.sample.length + ' รายแรก</p></div>' +
      '<div class="sec-b"><div class="bl-tabs" id="rpTabs">' +
      [['bad', 'ที่ต้องตามต่อ (' + bad.length + ')'], ['sent', 'ถึงแล้ว'], ['all', 'ทั้งหมด']].map(function (x) {
        return '<button type="button" class="bl-tab' + (RP.f === x[0] ? ' on' : '') + '" data-rpf="' + x[0] + '">' + esc(x[1]) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="sec-b tight"><div class="bl-tbl scroll" id="rpTbl"></div></div></div>';

    v.innerHTML = h;
    drawReportTable();
    v.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-rpf]');
      if (!el) return;
      RP.f = el.getAttribute('data-rpf');
      $$('#rpTabs .bl-tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-rpf') === RP.f); });
      drawReportTable();
    });
    drawPhone();
    $('#blCopy').addEventListener('click', function () {
      createBlast({ title: b.title + ' (ก๊อป)', taskId: b.taskId, campaignId: b.campaignId, channels: b.channels, messages: b.messages });
    });
  }

  function drawReportTable() {
    var host = $('#rpTbl');
    if (!host) return;
    var rows = E.sample.filter(function (r) {
      return RP.f === 'all' ? true : RP.f === 'sent' ? r.status === 'sent' : r.status !== 'sent';
    });
    host.innerHTML = '<table><thead><tr><th>ชื่อ</th><th>ช่องทาง</th><th>ผล</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) {
        var c = chanById(r.channelId);
        return '<tr><td>' + esc(r.name || r.dest || '—') + '</td>' +
          '<td>' + (r.ch === 'sms' ? 'SMS ' + esc(r.dest) : (c ? chDot(c, 1) + esc(c.name) : 'LINE')) + '</td>' +
          '<td>' + (r.status === 'sent' ? '<span class="bl-ok">ถึงแล้ว</span>'
            : r.status === 'skip' ? '<span class="bl-mut">ข้าม — ' + esc(r.err) + '</span>'
            : '<span class="bl-warn">ไม่ถึง — ' + esc(r.err) + '</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="3"><div class="empty">ไม่มีใครในกลุ่มนี้</div></td></tr>') +
      '</tbody></table>';
  }

  /* ============================================================
     #/richmenu — ริชเมนูของแต่ละเพจ
     ============================================================ */
  function pageRichMenu() {
    loadHome().then(function () {
      if (!RM.ch) RM.ch = (HOME.channels[0] || {}).id || '';
      return api('/blast/richmenus?ch=' + encodeURIComponent(RM.ch));
    }).then(function (j) {
      RM.menus = j.menus || [];
      var v = view();
      v.className = 'page';
      var cur = chanById(RM.ch);
      var h = '<div class="top"><div><span class="kicker">LINE OA</span><h1>ริชเมนู</h1>' +
        '<p>แถบปุ่มที่ค้างอยู่ล่างจอในแชทของลูกค้า — เปลี่ยนทั้งเพจได้ในคลิกเดียว หรือตั้งเวลาให้เปลี่ยนเองตอนขึ้นโปรใหม่</p></div>' +
        '<div class="top-r"><a class="btn-ghost" href="#/blast">บรอดแคสต์</a>' +
        '<button type="button" class="btn" id="rmNew">+ สร้างริชเมนู</button></div></div>';
      h += modeBar();
      h += '<div class="bl-tabs">' + HOME.channels.map(function (c) {
        return '<button type="button" class="bl-tab' + (c.id === RM.ch ? ' on' : '') + '" data-rmch="' + esc(c.id) + '">' +
          chDot(c, 1) + esc(c.name) + '</button>';
      }).join('') + '</div>';

      h += '<div class="sec"><div class="sec-h"><h2>เมนูของ ' + esc(cur ? cur.name : '') + '</h2>' +
        '<p>' + RM.menus.length + ' ชุด · ใช้อยู่ 1 ชุด</p></div><div class="sec-b">' +
        (RM.menus.length ? '<div class="bl-rmgrid">' + RM.menus.map(rmCard).join('') + '</div>'
          : '<div class="empty">ยังไม่มีริชเมนูของเพจนี้</div>') + '</div></div>';
      v.innerHTML = h;
      wireRichMenu();
    }).catch(fail);
  }
  function rmCard(m) {
    var areas = m.areas || [];
    return '<div class="bl-rm' + (m.isDefault ? ' on' : '') + '">' +
      '<div class="bl-rm-img' + (m.size === 'compact' ? ' compact' : '') + '">' +
      (m.image ? '<img src="' + esc(m.image) + '" alt="">' : '<div class="bl-rm-grid">' +
        areas.map(function (a) { return '<span>' + esc(a.label || '') + '</span>'; }).join('') + '</div>') +
      '</div>' +
      '<div class="bl-rm-b"><b>' + esc(m.name) + '</b>' +
      (m.isDefault ? '<span class="pill done">ใช้อยู่</span>' : '') +
      (m.applyAt ? '<span class="pill repeat">เปลี่ยน ' + esc(X.fmtFull(m.applyAt)) + '</span>' : '') +
      '<small>' + areas.length + ' ปุ่ม · ' + (m.size === 'compact' ? '2500×843' : '2500×1686') + '</small>' +
      '<div class="acts">' +
      (m.isDefault ? '' : '<button type="button" class="btn-ghost sm" data-rmuse="' + esc(m.id) + '">ใช้เมนูนี้</button>') +
      '<button type="button" class="btn-text" data-rmsched="' + esc(m.id) + '">ตั้งเวลา</button>' +
      '<button type="button" class="btn-text" data-rmedit="' + esc(m.id) + '">แก้</button>' +
      (m.isDefault ? '' : '<button type="button" class="btn-text" data-rmdel="' + esc(m.id) + '">ลบ</button>') +
      '</div></div></div>';
  }

  function wireRichMenu() {
    var v = view();
    v.addEventListener('click', function (ev) {
      var el;
      if ((el = ev.target.closest('[data-rmch]'))) { RM.ch = el.getAttribute('data-rmch'); pageRichMenu(); return; }
      if (ev.target.closest('#rmNew')) { rmEditor(null); return; }
      if ((el = ev.target.closest('[data-rmedit]'))) {
        var id = el.getAttribute('data-rmedit');
        rmEditor(RM.menus.filter(function (m) { return m.id === id; })[0]);
        return;
      }
      if ((el = ev.target.closest('[data-rmuse]'))) {
        var uid = el.getAttribute('data-rmuse');
        var m = RM.menus.filter(function (x) { return x.id === uid; })[0];
        if (!confirm('เปลี่ยนริชเมนูของเพจนี้เป็น “' + (m ? m.name : '') + '” ทันที?\nทุกคนที่แอดเพจจะเห็นเมนูใหม่')) return;
        api('/blast/richmenus/' + uid + '/apply', 'POST', {}).then(function () {
          X.okDialog({ title: 'เปลี่ยนเมนูแล้ว', lines: [(m ? m.name : '') + ' กลายเป็นเมนูหลักของเพจนี้'],
            note: 'โหมดทดสอบ — ของจริงจะยิง POST /v2/bot/user/all/richmenu ให้ทันที',
            onClose: pageRichMenu });
        }).catch(fail);
        return;
      }
      if ((el = ev.target.closest('[data-rmsched]'))) { rmSchedule(el.getAttribute('data-rmsched')); return; }
      if ((el = ev.target.closest('[data-rmdel]'))) {
        if (!confirm('ลบริชเมนูนี้?')) return;
        api('/blast/richmenus/' + el.getAttribute('data-rmdel'), 'DELETE')
          .then(function () { toast('ลบแล้ว'); pageRichMenu(); }).catch(fail);
        return;
      }
    });
  }
  function rmSchedule(id) {
    var def = X.toLocalInput(new Date(Date.now() + 86400000).toISOString());
    var host = document.createElement('div');
    host.className = 'modal';
    host.innerHTML = '<div class="modal-box"><div class="modal-h"><h2>ตั้งเวลาเปลี่ยนเมนู</h2>' +
      '<button type="button" class="modal-x" data-x>✕</button></div><div class="modal-b">' +
      '<div class="field"><label class="label">เปลี่ยนเมื่อ</label><input class="input" type="datetime-local" id="rmAt" value="' + esc(def) + '"></div>' +
      '<div class="hint">ใช้กับแบนเนอร์ที่เปลี่ยนทุกต้นเดือน — ตั้งไว้ล่วงหน้าทีเดียวทั้งปีก็ได้</div>' +
      '</div><div class="modal-f"><button type="button" class="btn-ghost" data-x>ยกเลิก</button>' +
      '<button type="button" class="btn" id="rmGo">ตั้งเวลา</button></div></div>';
    document.body.appendChild(host);
    var close = function () { host.remove(); };
    $$('[data-x]', host).forEach(function (b) { b.addEventListener('click', close); });
    $('#rmGo', host).addEventListener('click', function () {
      var at = X.fromLocalInput($('#rmAt', host).value);
      if (!at) { toast('ใส่วันเวลาก่อน', true); return; }
      api('/blast/richmenus/' + id + '/apply', 'POST', { at: at }).then(function (j) {
        close();
        X.okDialog({ title: 'ตั้งเวลาแล้ว', lines: ['เปลี่ยนเมนูวันที่ ' + X.fmtFull(j.at)], onClose: pageRichMenu });
      }).catch(fail);
    });
  }
  /* ตัวแก้ริชเมนู — รูป 1 ใบ + ช่องปุ่ม (เต็มจอ 6 ช่อง / เตี้ย 3 ช่อง) ตามที่ LINE รองรับ */
  function rmEditor(m) {
    var isNew = !m;
    var draft = m ? JSON.parse(JSON.stringify(m)) : { name: '', size: 'full', image: '', areas: [], channelId: RM.ch };
    if (!draft.areas.length) draft.areas = [{ label: '', type: 'uri', value: '' }, { label: '', type: 'uri', value: '' }, { label: '', type: 'uri', value: '' }];
    var host = document.createElement('div');
    host.className = 'modal';
    document.body.appendChild(host);
    var close = function () { host.remove(); };

    function draw() {
      host.innerHTML = '<div class="modal-box bl-rmedit"><div class="modal-h"><h2>' + (isNew ? 'สร้างริชเมนู' : 'แก้ริชเมนู') + '</h2>' +
        '<button type="button" class="modal-x" data-x>✕</button></div><div class="modal-b">' +
        '<div class="grid3"><div class="field"><label class="label">ชื่อเมนู <small>ไว้ให้ทีมเรียกกัน</small></label>' +
        '<input class="input" id="rmName" value="' + esc(draft.name) + '" placeholder="เช่น เมนูโปรเดือนตุลาคม"></div>' +
        '<div class="field"><label class="label">ขนาด</label><select class="select" id="rmSize">' +
        '<option value="full"' + (draft.size === 'full' ? ' selected' : '') + '>เต็ม 2500×1686 (6 ช่อง)</option>' +
        '<option value="compact"' + (draft.size === 'compact' ? ' selected' : '') + '>เตี้ย 2500×843 (3 ช่อง)</option>' +
        '</select></div>' +
        '<div class="field"><label class="label">รูปเมนู <small>ไม่เกิน 1MB</small></label><input type="file" accept="image/*" id="rmImg"></div></div>' +
        (draft.image ? '<div class="bl-rm-prev"><img src="' + esc(draft.image) + '" alt=""></div>' : '') +
        '<div class="label">ปุ่มในเมนู</div>' +
        '<div class="bl-areas">' + draft.areas.map(function (a, i) {
          return '<div class="bl-arearow"><span class="bl-areai">' + (i + 1) + '</span>' +
            '<input class="input" placeholder="ข้อความบนปุ่ม" data-al="' + i + '" value="' + esc(a.label || '') + '">' +
            '<select class="select" data-at="' + i + '">' +
            '<option value="uri"' + (a.type === 'uri' ? ' selected' : '') + '>เปิดลิงก์</option>' +
            '<option value="message"' + (a.type === 'message' ? ' selected' : '') + '>ส่งข้อความ</option>' +
            '</select>' +
            '<input class="input" placeholder="' + (a.type === 'message' ? 'ข้อความที่จะถูกส่ง' : 'https://…') + '" data-av="' + i + '" value="' + esc(a.value || '') + '">' +
            '<button type="button" class="btn-text" data-arm="' + i + '">ลบ</button></div>';
        }).join('') + '</div>' +
        (draft.areas.length < (draft.size === 'compact' ? 3 : 6) ? '<button type="button" class="btn-text" id="rmAdd">+ เพิ่มปุ่ม</button>' : '') +
        '</div><div class="modal-f"><button type="button" class="btn-ghost" data-x>ยกเลิก</button>' +
        '<button type="button" class="btn" id="rmSave">บันทึก</button></div></div>';

      $$('[data-x]', host).forEach(function (b) { b.addEventListener('click', close); });
      $('#rmName', host).addEventListener('input', function (e) { draft.name = e.target.value; });
      $('#rmSize', host).addEventListener('change', function (e) {
        draft.size = e.target.value;
        var max = draft.size === 'compact' ? 3 : 6;
        if (draft.areas.length > max) draft.areas = draft.areas.slice(0, max);
        draw();
      });
      var add = $('#rmAdd', host);
      if (add) add.addEventListener('click', function () { draft.areas.push({ label: '', type: 'uri', value: '' }); draw(); });
      $$('[data-arm]', host).forEach(function (b) {
        b.addEventListener('click', function () { draft.areas.splice(Number(b.getAttribute('data-arm')), 1); draw(); });
      });
      host.addEventListener('input', function (ev) {
        var t = ev.target, k;
        if ((k = t.getAttribute('data-al')) != null) draft.areas[Number(k)].label = t.value;
        if ((k = t.getAttribute('data-av')) != null) draft.areas[Number(k)].value = t.value;
      });
      host.addEventListener('change', function (ev) {
        var t = ev.target, k;
        if ((k = t.getAttribute('data-at')) != null) { draft.areas[Number(k)].type = t.value; draw(); }
      });
      $('#rmImg', host).addEventListener('change', function (ev) {
        var f = ev.target.files && ev.target.files[0];
        if (!f) return;
        if (f.size > 1000000) { toast('LINE รับรูปริชเมนูไม่เกิน 1MB', true); return; }
        var fr = new FileReader();
        fr.onload = function () { draft.image = String(fr.result); draft.imageName = f.name; draw(); };
        fr.readAsDataURL(f);
      });
      $('#rmSave', host).addEventListener('click', function () {
        if (!draft.name.trim()) { toast('ตั้งชื่อเมนูก่อน', true); return; }
        var p = isNew
          ? api('/blast/richmenus', 'POST', { channelId: RM.ch, name: draft.name, size: draft.size, image: draft.image, imageName: draft.imageName, areas: draft.areas })
          : api('/blast/richmenus/' + draft.id, 'PUT', { name: draft.name, size: draft.size, image: draft.image, imageName: draft.imageName, areas: draft.areas });
        p.then(function () { close(); toast('บันทึกแล้ว'); pageRichMenu(); }).catch(fail);
      });
    }
    draw();
    host.addEventListener('click', function (ev) { if (ev.target === host) close(); });
  }

  /* ============================================================
     #/lineusers — ผู้ติดตามรายคน
     ============================================================ */
  function pageUsers() {
    loadHome().then(function () {
      return api('/blast/users?ch=' + encodeURIComponent(LU.ch) + '&q=' + encodeURIComponent(LU.q));
    }).then(function (j) {
      var us = j.users || [];
      var v = view();
      v.className = 'page';
      var h = '<div class="top"><div><span class="kicker">LINE OA</span><h1>ผู้ติดตาม</h1>' +
        '<p>คนที่แอดเพจเราไว้ — ใส่แท็กไว้แล้วค่อยยิงบรอดแคสต์เฉพาะกลุ่มได้</p></div>' +
        '<div class="top-r"><a class="btn-ghost" href="#/blast">บรอดแคสต์</a></div></div>';
      h += '<div class="bl-note">ตอนนี้เป็น<b>รายชื่อจำลอง</b> — ของจริง LINE จะให้ userId ก็ต่อเมื่อลูกค้าแอดเพจหรือทักเข้ามา ' +
        'เราจึงต้องต่อ webhook เก็บไว้ก่อน ถึงจะเลือกส่งรายคนได้ ส่วน “ส่งหาทุกคนที่แอดเพจ” ทำได้เลยไม่ต้องรอ</div>';
      h += '<div class="bl-tabs"><button type="button" class="bl-tab' + (LU.ch ? '' : ' on') + '" data-luch="">ทุกเพจ</button>' +
        HOME.channels.map(function (c) {
          return '<button type="button" class="bl-tab' + (c.id === LU.ch ? ' on' : '') + '" data-luch="' + esc(c.id) + '">' +
            chDot(c, 1) + esc(c.name) + '</button>';
        }).join('') + '</div>';
      h += '<div class="sec"><div class="sec-h"><h2>รายชื่อ</h2><p>' + us.length + ' คน</p></div>' +
        '<div class="sec-b"><input class="input" id="luq" placeholder="ค้นหาชื่อ / เบอร์ / แท็ก" value="' + esc(LU.q) + '"></div>' +
        '<div class="sec-b tight"><div class="bl-tbl"><table><thead><tr><th>ชื่อ</th><th>เพจ</th><th>แท็ก</th>' +
        '<th>สาขา</th><th>เคยซื้อ</th><th>แอดเมื่อ</th></tr></thead><tbody>' +
        (us.length ? us.map(function (u) {
          var c = chanById(u.channelId);
          return '<tr' + (u.blocked ? ' class="off"' : '') + '><td><b>' + esc(u.name) + '</b>' +
            (u.blocked ? ' <span class="bl-mut">บล็อกเพจ</span>' : '') + '</td>' +
            '<td>' + (c ? chDot(c, 1) + esc(c.name) : '—') + '</td>' +
            '<td>' + (u.tags.length ? u.tags.map(function (t) { return '<span class="bl-tag">' + esc(t) + '</span>'; }).join(' ') : '<span class="bl-mut">—</span>') + '</td>' +
            '<td>' + esc(u.branch || '—') + '</td>' +
            '<td>' + (u.bought ? 'เคยซื้อ' : '<span class="bl-mut">ยัง</span>') + '</td>' +
            '<td>' + esc(X.fmtAgo(u.followedAt)) + '</td></tr>';
        }).join('') : '<tr><td colspan="6"><div class="empty">ไม่พบใคร</div></td></tr>') +
        '</tbody></table></div></div></div>';
      v.innerHTML = h;
      v.addEventListener('click', function (ev) {
        var el = ev.target.closest('[data-luch]');
        if (el) { LU.ch = el.getAttribute('data-luch'); pageUsers(); }
      });
      var q = $('#luq');
      var t = null;
      q.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { LU.q = q.value; pageUsers(); }, 350);
      });
    }).catch(fail);
  }

  /* ============================================================
     #/blastsetup — ตั้งค่าเพจ + SMS
     ============================================================ */
  function pageSetup() {
    loadHome(true).then(function (j) {
      var v = view();
      v.className = 'page';
      var h = '<div class="top"><div><span class="kicker">ตั้งค่า</span><h1>เพจ LINE OA + SMS</h1>' +
        '<p>ใส่ Channel access token ของแต่ละเพจตรงนี้ ใส่แล้วระบบจะยิงของจริงให้ทันที ไม่ต้องแก้โค้ด</p></div>' +
        '<div class="top-r"><button type="button" class="btn" id="chAdd">+ เพิ่มเพจ</button></div></div>';
      h += '<div class="bl-note"><b>ยังไม่ต้องใส่ตอนนี้ก็ได้</b> — ระบบเดินครบทุกขั้นในโหมดทดสอบอยู่แล้ว ' +
        'token หาได้ที่ LINE Developers → เลือก Channel → แท็บ Messaging API → Channel access token (long-lived)</div>';

      h += '<div class="sec"><div class="sec-h"><h2>เพจทั้งหมด</h2><p>' + j.channels.length + ' เพจ</p></div><div class="sec-b">' +
        j.channels.map(function (c) {
          return '<div class="bl-setrow" data-setch="' + esc(c.id) + '">' +
            '<div class="grid3">' +
            '<div class="field"><label class="label">ชื่อเพจ</label><input class="input" data-f="name" value="' + esc(c.name) + '"></div>' +
            '<div class="field"><label class="label">LINE ID</label><input class="input" data-f="basicId" value="' + esc(c.basicId) + '" placeholder="@xxxx"></div>' +
            '<div class="field"><label class="label">โควตาข้อความ/เดือน</label><input class="input" type="number" data-f="quotaLimit" value="' + (c.quotaLimit || 0) + '"></div>' +
            '</div><div class="grid3">' +
            '<div class="field" style="grid-column:span 2"><label class="label">Channel access token <small>' +
              (c.hasToken ? 'ใส่แล้ว ••••' + esc(c.tokenTail) + ' — พิมพ์ทับเพื่อเปลี่ยน' : 'ยังไม่ได้ใส่') + '</small></label>' +
            '<input class="input" data-f="token" type="password" placeholder="' + (c.hasToken ? '••••••••••••' : 'วาง token ที่นี่') + '"></div>' +
            '<div class="field"><label class="label">สีประจำเพจ</label><input class="input" type="color" data-f="color" value="' + esc(c.color || '#06C755') + '"></div>' +
            '</div>' +
            '<div class="acts"><button type="button" class="btn-ghost sm" data-chsave="' + esc(c.id) + '">บันทึกเพจนี้</button>' +
            '<button type="button" class="btn-text" data-chdel="' + esc(c.id) + '">ลบเพจ</button>' +
            '<span class="hint">' + num(c.followers) + ' ผู้ติดตาม · ใช้โควตาไปแล้ว ' + num(c.quotaUsed) + '</span></div></div>';
        }).join('') + '</div></div>';

      h += '<div class="sec"><div class="sec-h"><h2>SMS</h2><p>ยังไม่ได้เลือกผู้ให้บริการ</p></div><div class="sec-b">' +
        '<div class="bl-note">ส่ง SMS จริงต้องมีบัญชีกับผู้ให้บริการในไทยก่อน (ThaiBulkSMS · SMSMKT · 8x8 หรือเจ้าอื่น) ' +
        'และต้องจดทะเบียน “ชื่อผู้ส่ง” กับเจ้านั้นไว้ล่วงหน้า บอกมาว่าใช้เจ้าไหนแล้วจะต่อให้ — ' +
        'ระหว่างนี้ใบบรอดแคสต์นับจำนวนเบอร์ให้ดูได้ตามปกติ</div>' +
        '<div class="grid3">' +
        '<div class="field"><label class="label">ผู้ให้บริการ</label><select class="select" disabled><option>ยังไม่ได้เลือก</option></select></div>' +
        '<div class="field"><label class="label">ชื่อผู้ส่ง</label><input class="input" disabled placeholder="เช่น KANHUB"></div>' +
        '<div class="field"><label class="label">API key</label><input class="input" disabled placeholder="รอเลือกเจ้าก่อน"></div>' +
        '</div></div></div>';

      if (X.isOwner()) {
        h += '<div class="sec"><div class="sec-h"><h2>ข้อมูลจำลอง</h2></div><div class="sec-b">' +
          '<p class="hint">ตอนต่อ LINE ของจริงแล้ว ให้กดล้างรายชื่อผู้ติดตามจำลองทิ้ง จะได้ไม่ปนกับของจริง ' +
          '(เพจกับริชเมนูยังอยู่)</p>' +
          '<div class="acts"><button type="button" class="btn-ghost danger" id="clearMock">ล้างผู้ติดตามจำลอง</button></div></div></div>';
      }
      v.innerHTML = h;

      v.addEventListener('click', function (ev) {
        var el;
        if ((el = ev.target.closest('[data-chsave]'))) {
          var row = el.closest('[data-setch]');
          var body = {};
          $$('[data-f]', row).forEach(function (inp) {
            var f = inp.getAttribute('data-f');
            if (f === 'token' && !inp.value) return;      /* เว้นว่าง = ไม่เปลี่ยน token เดิม */
            body[f] = f === 'quotaLimit' ? Number(inp.value) || 0 : inp.value;
          });
          api('/blast/channels/' + el.getAttribute('data-chsave'), 'PUT', body)
            .then(function () { toast('บันทึกแล้ว'); HOME = null; pageSetup(); }).catch(fail);
          return;
        }
        if ((el = ev.target.closest('[data-chdel]'))) {
          if (!confirm('ลบเพจนี้พร้อมผู้ติดตามและริชเมนูทั้งหมด? ย้อนกลับไม่ได้')) return;
          api('/blast/channels/' + el.getAttribute('data-chdel'), 'DELETE')
            .then(function () { toast('ลบแล้ว'); HOME = null; pageSetup(); }).catch(fail);
          return;
        }
        if (ev.target.closest('#chAdd')) {
          var name = prompt('ชื่อเพจใหม่');
          if (!name) return;
          api('/blast/channels', 'POST', { name: name })
            .then(function () { toast('เพิ่มแล้ว'); HOME = null; pageSetup(); }).catch(fail);
          return;
        }
        if (ev.target.closest('#clearMock')) {
          if (!confirm('ล้างผู้ติดตามจำลองทั้งหมด?')) return;
          api('/blast/clear-mock', 'POST', {})
            .then(function () { toast('ล้างแล้ว'); HOME = null; pageSetup(); }).catch(fail);
          return;
        }
      });
    }).catch(fail);
  }

  /* ============================================================
     แผงในหน้างาน — จุดเชื่อมกับระบบงานเดิม
     คุณออนบรีฟโปร → เปิดงานประเภท "LINE OA" → ทีมแนบรูปในงาน → กดปุ่มนี้ยิงได้เลย
     งานประเภทอื่นจะเห็นแผงนี้ก็ต่อเมื่อเคยมีใบบรอดแคสต์ผูกไว้แล้ว
     ============================================================ */
  function mountTaskPanel(task) {
    var host = $('#blastPanel');
    if (!host || !X.canSee('blast')) return;
    var isLine = task.taskType === 'lineoa';
    api('/blast/task/' + task.id).then(function (j) {
      var bs = j.blasts || [];
      if (!isLine && !bs.length) return;
      var chs = j.channels || [];
      var chName = function (id) {
        for (var i = 0; i < chs.length; i++) if (chs[i].id === id) return chs[i];
        return null;
      };
      var pics = 0;
      var h = '<div class="sec blastbox"><div class="sec-h"><h2>บรอดแคสต์ LINE</h2>' +
        '<p>' + (bs.length ? bs.length + ' ใบ' : 'ยังไม่เคยส่ง') + '</p></div><div class="sec-b">';
      if (bs.length) {
        h += '<div class="tlist">' + bs.map(function (b) {
          var cs = b.channels.map(chName).filter(Boolean);
          return '<a class="bl-row sm" href="#/blast/' + esc(b.id) + '">' +
            '<span class="bl-row-m">' + statusPill(b) + '</span>' +
            '<span class="bl-row-t"><b>' + esc(b.title) + '</b><small>' +
            (cs.length ? cs.map(function (c) { return esc(c.name); }).join(' · ') : 'ยังไม่ได้เลือกเพจ') +
            (b.smsOn ? ' · SMS' : '') + '</small></span>' +
            '<span class="bl-row-n">' + (b.status === 'sent' ? '<b>' + num(b.nSent) + '</b><small>คน</small>' : '<small>ร่าง</small>') + '</span></a>';
        }).join('') + '</div>';
      }
      h += '<div class="acts"><button type="button" class="btn' + (bs.length ? '-ghost' : '') + '" id="blFromTask">' +
        (bs.length ? '+ สร้างใบใหม่จากงานนี้' : 'สร้างบรอดแคสต์จากงานนี้') + '</button>' +
        '<span class="hint">รูปที่แนบไว้ในงานนี้จะถูกหยิบมาให้เลือกใช้เลย</span></div>';
      h += '</div></div>';
      host.innerHTML = h;
      $('#blFromTask').addEventListener('click', function () {
        createBlast({
          title: task.title,
          taskId: task.id,
          campaignId: task.campaignId || null,
          messages: task.detail ? [{ type: 'text', text: String(task.detail).replace(/<[^>]*>/g, '').slice(0, 900) }] : [],
        });
      });
    }).catch(function () {});
  }

  /* ---------- ทางเข้า ---------- */
  function render(route) {
    if (!X.canSee('blast')) { X.denyView('บรอดแคสต์ LINE OA'); return; }
    if (route.name === 'blast') { if (route.id) pageItem(route.id); else pageList(); return; }
    if (route.name === 'richmenu') { pageRichMenu(); return; }
    if (route.name === 'lineusers') { pageUsers(); return; }
    if (route.name === 'blastsetup') { pageSetup(); return; }
  }
  function has(name) { return ['blast', 'richmenu', 'lineusers', 'blastsetup'].indexOf(name) !== -1; }

  global.KAN_BLAST = {
    init: function (ctx) { X = ctx; },
    render: render,
    has: has,
    mountTaskPanel: mountTaskPanel,
    reset: function () { HOME = null; E = null; },
  };
})(window);
