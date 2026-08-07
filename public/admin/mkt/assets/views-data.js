/* KAN ERP — สองหน้าเสริม
 *   data  — แหล่งข้อมูล: อัปโหลดไฟล์ใบเสร็จ, ตั้งชื่อ, เปิด/ปิด, ดาวน์โหลด, ลบ + log
 *   rules — กฎ & เกณฑ์: กางเงื่อนไขทุกข้อที่ระบบใช้ตัดสินใจ (ดึงค่าจริงจากโค้ด)
 */
(function (global) {
  'use strict';

  var KAN = global.KAN, UI = KAN.UI, fmt = KAN.fmt, esc = KAN.esc;
  var IN = global.KAN_INGEST;

  function def(v) { KAN.views[v.id] = v; KAN.viewOrder.push(v.id); return v; }

  function fmtSize(n) {
    return n < 1024 ? n + ' B' : (n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB');
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d)) { return '—'; }
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() +
           ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function branchNames(codes) {
    var by = {};
    KAN.D.branches.forEach(function (b) { by[b.code] = b.short || b.name; });
    return codes.map(function (c) { return by[c] || c; }).join(', ');
  }

  /* ══════════════════════════════════════════════════ แหล่งข้อมูล ══ */

  var pending = null, msg = null;

  function showMsg(text, kind) {
    msg = { text: text, kind: kind || 'ok' };
    KAN.rerender();
  }

  def({
    id: 'data',
    group: 'ระบบ',
    noFilter: true,
    icon: '📥',
    title: 'แหล่งข้อมูล',
    lead: 'อัปโหลดไฟล์ใบเสร็จ POS เองได้ — ตัวเลขทุกหน้าคำนวณใหม่ทันที และทุกการเปลี่ยนแปลงถูกบันทึกไว้ใน log',

    render: function () {
      var files = IN.files();
      var log = IN.log();
      var h = '';

      if (global.KAN_INGEST_ERROR) {
        h += UI.banner('err', 'รวมข้อมูลจากไฟล์ไม่สำเร็จ',
          esc(global.KAN_INGEST_ERROR) + ' — ระบบกลับไปใช้ชุดข้อมูลตั้งต้นแทน');
      }
      if (msg) {
        h += UI.banner(msg.kind === 'err' ? 'err' : 'info', '', esc(msg.text));
      }

      /* — กล่องอัปโหลด — */
      var dropTxt = pending
        ? '<b>' + esc(pending.name) + '</b> · ' + fmtSize(pending.size) + ' — ตั้งชื่อแล้วกด “อัปโหลด”'
        : '<b>เลือกไฟล์ .csv</b> หรือลากไฟล์มาวางตรงนี้ · รายงานใบเสร็จจาก POS (ไฟล์เดียวรวมหลายสาขาก็ได้)';
      h += UI.panel({
        title: 'อัปโหลดไฟล์ใบเสร็จ',
        hint: 'ระบบอ่านสาขาจากคอลัมน์ “ร้านค้า” ให้เอง · ไฟล์ที่อัปโหลดจะทับข้อมูลตั้งต้นเฉพาะสาขาและช่วงวันที่ที่ไฟล์นั้นครอบคลุม ' +
              '<a href="#/rules">ดูกฎทั้งหมด</a>',
        body:
          '<div class="up-row">' +
            '<div class="up-drop" id="upDrop"><input type="file" id="upFile" accept=".csv,text/csv" hidden>' + dropTxt + '</div>' +
            '<input type="text" class="up-name" id="upName" maxlength="60" placeholder="ตั้งชื่อชุดข้อมูล (เช่น ก.ค. 2026 นคร)">' +
            '<button class="btn primary" id="upBtn"' + (pending ? '' : ' disabled') + '>อัปโหลด</button>' +
          '</div>',
      });

      /* — ตารางไฟล์ — */
      var rows = '';
      files.forEach(function (f) {
        rows += '<tr>' +
          '<td><div class="fname">' + esc(f.name) + '</div>' +
            '<div class="fmeta">' + fmt.int(f.kept) + ' บิล · ' + esc(branchNames(f.branches)) + '</div></td>' +
          '<td class="fmeta">' + esc(f.filename) + '</td>' +
          '<td class="num fmeta">' + fmtSize(f.size) + '</td>' +
          '<td class="fmeta">' + fmtWhen(f.uploadedAt) + '</td>' +
          '<td class="fmeta">' + f.from + ' → ' + f.to + '</td>' +
          '<td><span class="' + (f.active ? 'badge-on' : 'badge-off') + '">' +
            (f.active ? 'ใช้อยู่' : 'ไม่ได้ใช้') + '</span></td>' +
          '<td><div class="fops">' +
            '<button class="btn s" data-act="toggle" data-id="' + f.id + '">' + (f.active ? 'เลิกใช้' : 'ใช้ไฟล์นี้') + '</button>' +
            '<button class="btn s" data-act="rename" data-id="' + f.id + '">เปลี่ยนชื่อ</button>' +
            '<button class="btn s" data-act="dl" data-id="' + f.id + '">ดาวน์โหลด</button>' +
            '<button class="btn s danger" data-act="del" data-id="' + f.id + '">ลบ</button>' +
          '</div></td></tr>';
      });
      var baseMeta = global.KAN_BASE_DATA ? global.KAN_BASE_DATA.meta : KAN.D.meta;
      rows += '<tr>' +
        '<td><div class="fname">ชุดข้อมูลตั้งต้น</div><div class="fmeta">อบมาจาก etl/build_data.py · ทุกสาขา</div></td>' +
        '<td class="fmeta">kan-data.js</td><td class="num fmeta">—</td>' +
        '<td class="fmeta">' + (baseMeta.generated || '—').replace('T', ' ').slice(0, 16) + '</td>' +
        '<td class="fmeta">' + baseMeta.dateMin + ' → ' + baseMeta.dateMax + '</td>' +
        '<td><span class="badge-on">ใช้เป็นฐานเสมอ</span></td>' +
        '<td class="fmeta">ลบไม่ได้</td></tr>';

      h += UI.panel({
        title: 'ไฟล์ข้อมูล',
        hint: 'เลือกใช้พร้อมกันได้หลายไฟล์ เช่นอัปโหลดแยกสาขา/แยกเดือน — ถ้าขอบเขตชนกัน ระบบยึดไฟล์ที่อัปโหลดล่าสุด',
        body: '<div class="tblwrap"><table class="ftbl"><thead><tr>' +
          '<th>ชุดข้อมูล</th><th>ไฟล์</th><th class="num">ขนาด</th><th>อัปโหลดเมื่อ</th>' +
          '<th>ช่วงข้อมูล</th><th>ใช้อยู่?</th><th>จัดการ</th></tr></thead>' +
          '<tbody id="fbody">' + rows + '</tbody></table></div>',
      });

      /* — log — */
      var lrows = log.map(function (e) {
        var lbl = { upload: 'อัปโหลด', rename: 'เปลี่ยนชื่อ', activate: 'เปิดใช้',
                    deactivate: 'ปิดใช้', delete: 'ลบ' }[e.action] || e.action;
        var cls = e.action === 'delete' ? 'lg-del' : (e.action === 'upload' ? 'lg-up' : 'lg-n');
        return '<tr><td class="fmeta">' + fmtWhen(e.at) + '</td>' +
               '<td><span class="lgtag ' + cls + '">' + lbl + '</span></td>' +
               '<td>' + esc(e.target) + '</td>' +
               '<td class="fmeta">' + esc(e.detail) + '</td></tr>';
      }).join('');
      h += UI.panel({
        title: 'ประวัติการเปลี่ยนแปลง (log)',
        hint: 'บันทึกทุกการอัปโหลด เปลี่ยนชื่อ เปิด/ปิด และลบ — เพิ่มอย่างเดียว แก้ย้อนหลังไม่ได้ · ' + log.length + ' รายการ',
        body: log.length
          ? '<div class="tblwrap"><table class="ftbl"><thead><tr><th>เมื่อ</th><th>ทำอะไร</th><th>ชุดข้อมูล</th><th>รายละเอียด</th></tr></thead><tbody>' + lrows + '</tbody></table></div>'
          : UI.empty('ยังไม่มีการเปลี่ยนแปลง'),
      });

      h += UI.banner('info', 'ไฟล์เก็บในเครื่องนี้',
        'ไฟล์และ log อยู่ใน IndexedDB ของเบราว์เซอร์เครื่องนี้ ไม่ได้ส่งขึ้นเซิร์ฟเวอร์ — ' +
        'เปิดจากเครื่องอื่นจะเห็นเฉพาะชุดข้อมูลตั้งต้น');
      return h;
    },

    after: function () {
      var drop = document.getElementById('upDrop');
      var input = document.getElementById('upFile');
      var nameEl = document.getElementById('upName');
      var btn = document.getElementById('upBtn');
      if (!drop) { return; }
      msg = null;   /* แสดงครั้งเดียว */

      function defaultName(fn) { return fn.replace(/\.csv$/i, '').replace(/[_]+/g, ' ').trim() || fn; }
      function uniqName(n, skipId) {
        var base = n, i = 2, files = IN.files();
        while (files.some(function (f) { return f.id !== skipId && f.name.toLowerCase() === n.toLowerCase(); })) {
          n = base + ' (' + (i++) + ')';
        }
        return n;
      }
      function setPending(f) {
        pending = f || null;
        if (pending && !nameEl.value.trim()) { nameEl.value = defaultName(pending.name); }
        KAN.rerender();
      }

      drop.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function (e) { setPending(e.target.files[0]); });
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
      });
      drop.addEventListener('drop', function (e) {
        var f = e.dataTransfer.files[0];
        if (f) { setPending(f); }
      });

      if (btn) {
        btn.addEventListener('click', function () {
          if (!pending) { return; }
          var file = pending, nm = uniqName((nameEl.value || '').trim() || defaultName(file.name));
          btn.disabled = true;
          btn.textContent = 'กำลังอ่านไฟล์…';
          var rd = new FileReader();
          rd.onerror = function () { showMsg('อ่านไฟล์ไม่สำเร็จ', 'err'); };
          rd.onload = function () {
            IN.add(file, nm, String(rd.result)).then(function (rec) {
              pending = null;
              global.KAN_INGEST_ERROR = null;
              reload('อัปโหลด “' + rec.name + '” สำเร็จ · ' + fmt.int(rec.kept) + ' บิล · ' +
                     rec.from + ' → ' + rec.to + ' · ' + branchNames(rec.branches));
            }).catch(function (e) {
              btn.disabled = false;
              showMsg(e && e.message ? e.message : String(e), 'err');
            });
          };
          rd.readAsText(file, 'utf-8');
        });
      }

      var body = document.getElementById('fbody');
      if (body) {
        body.addEventListener('click', function (e) {
          var b = e.target.closest('button[data-act]');
          if (!b) { return; }
          var id = b.dataset.id, act = b.dataset.act;
          var f = IN.files().filter(function (x) { return x.id === id; })[0];
          if (!f) { return; }
          if (act === 'toggle') { IN.setActive(id, !f.active).then(function () { reload(); }); return; }
          if (act === 'rename') {
            var t = prompt('ตั้งชื่อชุดข้อมูลนี้', f.name);
            if (t === null) { return; }
            if (!t.trim()) { showMsg('ชื่อว่างไม่ได้', 'err'); return; }
            IN.rename(id, uniqName(t.trim(), id)).then(function () { KAN.rerender(); });
            return;
          }
          if (act === 'dl') {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([IN.csvOf(id)], { type: 'text/csv;charset=utf-8' }));
            a.download = f.filename;
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
            return;
          }
          if (act === 'del') {
            if (!confirm('ลบ “' + f.name + '” ออกจากระบบ?\nข้อมูลจะกลับไปใช้ชุดตั้งต้นสำหรับช่วงที่ไฟล์นี้ครอบคลุม')) { return; }
            IN.remove(id).then(function () { reload('ลบ “' + f.name + '” แล้ว'); });
          }
        });
      }

      /* รวมข้อมูลใหม่แล้ววาดทั้งหน้า — ง่ายและถูกต้องกว่าการ patch ทีละส่วน
       * เพราะ core.js สร้าง index จาก KAN_DATA ตอนโหลด */
      function reload(text) {
        if (text) { try { sessionStorage.setItem('kan.data.msg', text); } catch (e) {} }
        location.reload();
      }
      try {
        var m = sessionStorage.getItem('kan.data.msg');
        if (m) { sessionStorage.removeItem('kan.data.msg'); showMsg(m, 'ok'); }
      } catch (e) {}
    },
  });

  /* ═════════════════════════════════════════════════════ กฎ & เกณฑ์ ══ */

  def({
    id: 'rules',
    group: 'ระบบ',
    noFilter: true,
    icon: '⚖',
    title: 'กฎ & เกณฑ์',
    lead: 'ทุกคำแนะนำในระบบมาจากเงื่อนไขที่เขียนไว้ตายตัวข้างล่างนี้ ไม่ใช่การตีความใหม่ทุกครั้ง — ตัวเลขในหน้านี้ดึงจากค่าที่โค้ดใช้จริง',

    render: function (range) {
      var R = KAN.RULES;
      var h = '';

      h += UI.banner('info', 'อ่านหน้านี้ยังไง',
        'กฎแต่ละข้อมี 3 ส่วน — “เมื่อไหร่ถึงขึ้น” คือเงื่อนไขทริกเกอร์ · “ทำอะไร” คือข้อเสนอ · ' +
        '“คิดผลยังไง” คือสมมติฐานที่ใช้ประเมินตัวเลข · ถ้าเงื่อนไขไม่เข้า การ์ดนั้นจะไม่ขึ้นเลย ไม่มีข้อความสำเร็จรูป');

      function simple(o) {
        var b = '<div class="tblwrap"><table class="ftbl"><thead><tr>' +
          o.head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          o.rows.map(function (r) {
            return '<tr>' + r.map(function (c, i) {
              return '<td' + (i ? ' class="fmeta"' : '') + '>' + esc(c) + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>';
        return UI.panel({
          title: o.title,
          hint: o.why + (o.inputs ? '<br><b>ใช้ข้อมูลจาก:</b> ' + o.inputs.map(esc).join(' · ') : ''),
          body: b,
        });
      }

      h += UI.sect({
        title: 'กฎแนะนำโปรโมชัน',
        lead: 'เรียงตามลำดับความสำคัญ (rank) — การ์ดที่ rank สูงกว่าจะขึ้นก่อนเสมอ',
        body: R.suggest().map(function (r) {
          return '<div class="rulecard">' +
            '<div class="rh"><span class="rtag">' + esc(r.tag) + '</span>' +
            '<span class="rrank">rank ' + esc(r.rank) + '</span></div>' +
            '<div class="rrow"><span class="rk">เมื่อไหร่ถึงขึ้น</span><span>' + esc(r.when) + '</span></div>' +
            '<div class="rrow"><span class="rk">ทำอะไร</span><span>' + esc(r.how) + '</span></div>' +
            '<div class="rrow"><span class="rk">คิดผลยังไง</span><span>' + esc(r.split) + '</span></div>' +
            '</div>';
        }).join(''),
      });

      h += UI.sect({
        title: 'เกณฑ์ที่กฎข้างบนอ้างถึง',
        lead: 'ค่าพวกนี้ถูกอ่านมาจากโค้ดตัวจริง แก้ที่โค้ดแล้วหน้านี้เปลี่ยนตาม',
        body: simple(R.grade()) +
              simple(R.customer(range ? range.days : 30)) +
              simple(R.ingest),
      });

      h += UI.panel({
        title: 'เป้าหมายกลางที่ระบบยึด',
        hint: 'ค่าเดียวที่กฎหลายข้อใช้ร่วมกัน — เปลี่ยนตรงนี้ที่เดียวมีผลทั้งระบบ (assets/suggest.js)',
        body: '<div class="tblwrap"><table class="ftbl"><tbody>' +
          '<tr><td>ยอดต่อบิลที่ตั้งเป้า</td><td class="num"><b>' + fmt.baht(KAN.TARGET_BILL) + '</b></td>' +
          '<td class="fmeta">ต่ำกว่านี้ → ใช้กลไก “ซื้อครบ…ลด” · สูงกว่านี้ → การลดราคาคือการทิ้งกำไรเปล่า</td></tr>' +
          '<tr><td>DSI ออกเร็ว / ปกติ / ออกช้า</td><td class="num"><b>' +
            KAN.DSI_THRESHOLDS.fast + ' / ' + KAN.DSI_THRESHOLDS.ok + ' / ' + KAN.DSI_THRESHOLDS.slow +
            '</b> วัน</td><td class="fmeta">ปรับเทียบกับธุรกิจนี้ — กลางกลุ่มอยู่ราว 150 วัน</td></tr>' +
          '</tbody></table></div>',
      });
      return h;
    },
  });

}(window));
