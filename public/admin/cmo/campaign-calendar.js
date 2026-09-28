/* ============================================================
   KAN ERP — ปฏิทินการตลาด (คอนเทนต์ / แคมเปญ / โปรโมชั่น)
   ข้อมูลเก็บที่ D1 ผ่าน /api/campaigns (ทีมเห็นชุดเดียวกัน)
   แนบรูปได้ ย่อฝั่งเบราว์เซอร์ก่อนส่ง เก็บใน D1 เสิร์ฟที่ /api/attachments/<id>
   เปิดแบบ file:// (ไม่มี API) จะถอยไปใช้ localStorage อัตโนมัติ + ขึ้นป้ายบอก
   ============================================================ */
(function () {
  "use strict";

  var API = "/api";
  var LS_KEY = "kan-campaign-calendar";
  var MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  var MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  var DOW = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  var DOW_FULL = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  var CHANNELS = ["หน้าร้าน","Facebook","LINE","TikTok","Shopee/Lazada","ขายส่ง"];
  /* นคร ตัดออก 9 ก.ย. 69 — เลิกดูแลแล้ว รายการเก่าที่เคยติดสาขานี้ยังเปิดดูได้ แค่เลือกใหม่ไม่ได้ */
  /* "อื่นๆ" = งานที่ไม่ได้อยู่ในสาขา เช่น on tour / ออกบูธ / ออนไลน์ล้วน — ต้องมีให้เลือก ไม่งั้นงานพวกนี้ตกหล่น */
  /* เหลือ 4 สาขา (นนท์ 27 ก.ย. 69) — ชื่อเก่า สุราษฎร์/ชุมพร ย้ายในฐานข้อมูลเป็น Kan Store แล้ว
     Kan Fashion / Central / สหไทย ตัดออก: รายการเก่าที่ติดไว้ยังโชว์และบันทึกทับได้ แค่เลือกใหม่ไม่ได้ */
  var BRANCHES = ["Kan Hub","Kan Store สุราษฎร์","Kan Store ชุมพร","อื่นๆ"];
  var NO_BRANCH = "-";   /* ค่าพิเศษของตัวกรอง = รายการที่ยังไม่ระบุสาขา */
  // Central / สหไทย = ห้างข้างนอกที่เราไปลงของ ไม่ใช่สาขาเรา
  var STATUS_LABEL = { plan:"วางแผน", live:"กำลังทำ", done:"จบแล้ว" };
  /* ประเภทรายการ — สีของประเภทคงที่ (ไม่ใช่สีที่ผู้ใช้เลือกให้แต่ละรายการ) จะได้กวาดตาแล้วรู้ทันที */
  /* หมวดใหญ่ (kind) → หมวดย่อย (sub) · สีผูกกับหมวดย่อยตายตัว (นนท์ 27 ก.ย. 69) — ชุดเดียวกับ CAMPAIGN_SUBS ใน worker.js
     ค่า kind "campaign" ยังเป็นชื่อในฐานข้อมูล แต่หน้าเว็บเรียกว่า "Event / กิจกรรม" แล้ว */
  var KINDS = ["promo", "campaign", "content"];
  var KIND_LABEL = { promo:"โปรโมชั่น", campaign:"Event / กิจกรรม", content:"คอนเทนต์" };
  var SUBS = [
    { k:"promo",     kind:"promo",    th:"โปรโมชั่น",          c:"#1E9BF0" },
    { k:"privilege", kind:"promo",    th:"สิทธิพิเศษ",          c:"#F2B705" },
    { k:"newlot",    kind:"campaign", th:"ล็อตใหม่",            c:"#2FA84F" },
    { k:"event",     kind:"campaign", th:"แคมเปญ / อีเว้นท์",   c:"#F28DB8" },
    { k:"queue",     kind:"campaign", th:"จองคิว",              c:"#FF8A1F" },
    { k:"closed",    kind:"campaign", th:"ปิดร้าน",             c:"#D6246E" },
    { k:"content",   kind:"content",  th:"คอนเทนต์ โพสต์/วิดีโอ", c:"#8B5CF6" }
  ];
  var SUB = {}; SUBS.forEach(function (x) { SUB[x.k] = x; });
  var SUB_OF_KIND = { promo:"promo", campaign:"event", content:"content" };
  var KIND_COLOR = { promo:"#1E9BF0", campaign:"#F28DB8", content:"#8B5CF6" };
  function kindOf(it) { return KINDS.indexOf(it && it.kind) !== -1 ? it.kind : "campaign"; }
  function subOf(it) { return SUB[it && it.sub] || SUB[SUB_OF_KIND[kindOf(it)]]; }
  function kindDot(it) { var x = subOf(it); return '<i class="cc-kdot" style="background:' + x.c + '" title="' + x.th + '"></i>'; }
  /* ตัวหนังสือบนพื้นสีอ่อน — สีเหลือง/ชมพูอ่อนอ่านไม่ออกถ้าใช้สีเดิมเป็นตัวหนังสือ เลยทำให้เข้มขึ้นก่อน */
  function ink(hex) {
    var h = String(hex).replace("#", ""), f = 0.58;
    return "rgb(" + Math.round(parseInt(h.slice(0,2),16) * f) + "," + Math.round(parseInt(h.slice(2,4),16) * f) + "," + Math.round(parseInt(h.slice(4,6),16) * f) + ")";
  }
  /* ลิงก์ไปหน้าที่ผูกกับรายการนี้ — ระบบงานทีมอยู่คนละโฟลเดอร์ */
  var TASKS_BASE = "../tasks/";
  function linkLine(it) {
    var p = it.posts || { total:0, done:0 }, t = it.tasks || { total:0, open:0 };
    if (!p.total && !t.total) return "";
    return '<span class="cc-linkline">' +
      (p.total ? '<span>โพสต์ <b>' + p.done + "/" + p.total + "</b></span>" : "") +
      (t.total ? '<span>งาน <b>' + (t.open ? t.open + " ค้าง" : "ครบ") + "</b></span>" : "") + "</span>";
  }
  function kindPill(it) { var x = subOf(it); return '<span class="cc-kpill" style="color:' + ink(x.c) + ';border-color:' + x.c + '">' + x.th + "</span>"; }
  var MAX_IMAGE_PX = 1400;
  var MAX_IMAGE_BYTES = 1400000;

  var items = [];
  var year = new Date().getFullYear();
  /* เปิดมาเห็นเดือนนี้ก่อน (นนท์: "เอามาแค่โปรโมชั่นของเดือนนี้ก็พอ" 18 ก.ย. 69) — ปุ่มย้อนกลับพาไปดูทั้งปี */
  /* layout = ปฏิทิน หรือ ตาราง (แบบ Lark Base) · group = ตารางจัดกลุ่มตามอะไร
     ตัวกรองประเภท/สาขาใช้ร่วมกันทั้งสองมุมมอง จะได้ไม่ต้องตั้งใหม่ตอนสลับ */
  /* ค่าเริ่มต้น = วันที่ (คุณออนทัก 27 ก.ย. 69: จัดตาม Week แล้วดูเหมือนจับวันผิด ขอเรียงตามวันแทน) */
  var GROUPS = [["day", "วันที่"], ["week", "สัปดาห์"], ["month", "เดือน"], ["kind", "ประเภท"], ["branch", "สาขา"], ["status", "สถานะ"]];
  var GROUP_KEYS = GROUPS.map(function (g) { return g[0]; });
  var view = { mode:"month", month:new Date().getMonth(), kind:"", branch:"", layout:"cal", group:"day" };
  try { view.kind = KINDS.indexOf(localStorage.getItem("kan-cc-kind")) !== -1 ? localStorage.getItem("kan-cc-kind") : ""; } catch (e) {}
  try { var _b = localStorage.getItem("kan-cc-branch"); view.branch = (_b === NO_BRANCH || BRANCHES.indexOf(_b) !== -1) ? _b : ""; } catch (e) {}   /* ค่าที่จำไว้เป็นสาขาเก่า = กลับไปทุกสาขา */
  try { view.layout = localStorage.getItem("kan-cc-layout") === "grid" ? "grid" : "cal"; } catch (e) {}
  try { var _g = localStorage.getItem("kan-cc-group"); view.group = GROUP_KEYS.indexOf(_g) !== -1 ? _g : "day"; } catch (e) {}
  /* กลุ่มที่พับไว้ — จำแค่ในหน้านี้ ปิดแท็บแล้วกลับมากางใหม่หมด */
  var collapsed = {};
  /* สาขาปัจจุบัน + สาขาเก่าที่ยังติดอยู่กับรายการ (จะได้ยังกรองดูของเก่าได้) */
  function allBranches() {
    var out = BRANCHES.slice();
    items.forEach(function (it) { (it.branches || []).forEach(function (b) { if (out.indexOf(b) === -1) out.push(b); }); });
    return out;
  }
  function inBranch(it, b) {
    if (!b) return true;
    if (b === NO_BRANCH) return !it.branches || !it.branches.length;
    return (it.branches || []).indexOf(b) !== -1;
  }
  /* รายการที่ผ่านตัวกรองประเภท + สาขา — ทุกมุมมองดึงจากตรงนี้ จะได้กรองพร้อมกันหมด */
  function pool() {
    return items.filter(function (it) { return (!view.kind || kindOf(it) === view.kind) && inBranch(it, view.branch); });
  }
  function branchLabel() { return view.branch === NO_BRANCH ? "ยังไม่ระบุสาขา" : view.branch; }
  var editingId = null;
  var pendingFiles = [];   // รูปที่เลือกไว้ตอนแคมเปญยังไม่ถูกบันทึก
  var online = true;       // ต่อ API ได้หรือไม่
  var toastTimer;

  function $(id) { return document.getElementById(id); }

  /* ---------- API / storage ---------- */
  async function api(path, options) {
    var res = await fetch(API + path, Object.assign(
      { headers: { "content-type": "application/json" } }, options || {}));
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((data && data.error) || ("HTTP " + res.status));
    return data;
  }

  /* สถานะงานต่อโปรฯ (ป้าย/โพสต์/งานอื่น) — โชว์บนแถบและการ์ด ไม่ต้องเปิดหน้าอื่น */
  var STATUS = {};
  async function loadStatus() {
    try { var d = await api("/campaigns/status"); STATUS = d.status || {}; } catch (e) { STATUS = {}; }
  }
  function stOf(it) { return STATUS[it.id] || null; }
  /* ข้อความสั้นบนแถบ: "ป้าย ผลิต 3/6 · โพสต์ 2/5 · งาน 1/3" — ว่าง = ยังไม่มีงานผูก */
  var TASK_STATUS_TH = { todo: "รอทำ", doing: "กำลังทำ", review: "รอตรวจ", done: "เสร็จแล้ว", blocked: "ติดปัญหา" };
  var CHAN_TH = { line: "LINE", fb: "Facebook", tiktok: "TikTok", ig: "Instagram", other: "ช่องอื่น" };
  function hasMedia(st) { return !!(st && (st.signs.length || st.others.length || st.posts.total)); }
  function statusBrief(it) {
    var st = stOf(it);
    /* โปรฯ ทุกอันต้องมีสื่ออย่างน้อย LINE — ไม่มีอะไรผูกเลย = เตือนบนแถบ */
    if (!hasMedia(st)) return '<span class="cc-st warn" data-tip="ยังไม่มีโพสต์ งานป้าย หรืองานอื่นผูกกับโปรฯ นี้เลย — โปรฯ ทุกอันต้องมีอย่างน้อยโพสต์ LINE">ยังไม่มีสื่อ</span>';
    var parts = [];
    var line = st.chan && st.chan.line;
    if (!line) parts.push('<span class="cc-st warn" data-tip="ยังไม่มีโพสต์ช่องทาง LINE สำหรับโปรฯ นี้ (มีเฉพาะช่องอื่น)">LINE ✗</span>');
    if (st.signs.length) {
      var worst = st.signs.slice().sort(function (a, b) { return a.stageIdx - b.stageIdx; })[0];
      var doneN = st.signs.filter(function (x) { return x.status === "done"; }).length;
      var lateS = st.signs.filter(function (x) { return x.late; }).length;
      var tipS = "งานป้าย " + st.signs.length + " งาน · ติดตั้งเสร็จ " + doneN +
        (doneN === st.signs.length ? "" : " · งานที่ช้าสุดอยู่ขั้น “" + worst.stageTh + "” (ผ่านแล้ว " + Math.max(0, worst.stageIdx) + " จาก " + worst.nStages + " ขั้น)") +
        (lateS ? " · เลยกำหนด " + lateS + " งาน" : "");
      parts.push('<span class="cc-st' + (lateS ? " late" : (doneN === st.signs.length ? " ok" : "")) + '" data-tip="' + esc(tipS) + '">ป้าย ' +
        (st.signs.length > 1 ? st.signs.length + " · " : "") + (doneN === st.signs.length ? "ติดตั้งครบ" : esc(worst.stageTh) + (worst.nStages ? " " + Math.max(0, worst.stageIdx) + "/" + worst.nStages : "")) + "</span>");
    }
    if (st.posts.total) {
      var tipP = "โพสต์ที่ผูกกับโปรฯ นี้ " + st.posts.total + " โพสต์ · ลงแล้ว " + st.posts.done + " · ยังไม่ลง " + (st.posts.total - st.posts.done) +
        (st.posts.late ? " (เลยวันที่ต้องลง " + st.posts.late + ")" : "") +
        (st.chan ? " · " + Object.keys(st.chan).map(function (k) { return CHAN_TH[k] + " " + st.chan[k].done + "/" + st.chan[k].total; }).join(", ") : "");
      parts.push('<span class="cc-st' + (st.posts.late ? " late" : (st.posts.done === st.posts.total ? " ok" : "")) + '" data-tip="' + esc(tipP) + '">โพสต์ ' + st.posts.done + "/" + st.posts.total + "</span>");
    }
    if (st.others.length) {
      var od = st.others.filter(function (x) { return x.status === "done"; }).length;
      var lateO = st.others.filter(function (x) { return x.late; }).length;
      var tipO = "งานอื่น (คลิป/คอนเทนต์/จัดร้าน) " + st.others.length + " งาน · เสร็จ " + od + (lateO ? " · เลยกำหนด " + lateO : "") + " — " + st.others.map(function (x) { return x.title + " (" + (TASK_STATUS_TH[x.status] || x.status) + ")"; }).join(", ");
      parts.push('<span class="cc-st' + (lateO ? " late" : (od === st.others.length ? " ok" : "")) + '" data-tip="' + esc(tipO) + '">งาน ' + od + "/" + st.others.length + "</span>");
    }
    return parts.join("");
  }
  /* สร้างสื่อที่ขาดจากการ์ดทันที (นนท์ 19 ก.ย. 69: "ไม่มี LINE/ป้าย ควรมีปุ่มเพิ่ม task ให้เลย")
     LINE → แถวโพสต์ในตารางโพสต์ ช่องทาง Line OA เพจตามสาขา วันก่อนเริ่มโปรฯ (ถ้าเลยแล้วใช้วันนี้)
     ป้าย → งานป้าย 1 งานต่อสาขา มอบพิซซ่า กำหนดส่ง 18:00 วันก่อนเริ่มโปรฯ · ขั้นงาน 6 ขั้นสร้างเองที่ worker */
  var PAGE_OF = { "Kan Store ชุมพร": "pg_kst1", "Kan Store สุราษฎร์": "pg_kst3", "Kan Fashion": "pg_fashion", "Kan Hub": "pg_hub" };
  var SIGN_OWNER = "s_julalak";
  function dayBefore(startISO) { var d = parseISO(startISO); d.setDate(d.getDate() - 1); var t = todayISO(); var r = iso(d.getFullYear(), d.getMonth(), d.getDate()); return r < t ? t : r; }
  async function makeMedia(kind, it, btn) {
    var brs = (it.branches || []).filter(function (b) { return PAGE_OF[b]; });
    if (!brs.length) brs = ["Kan Store สุราษฎร์"];
    btn.disabled = true; btn.textContent = "กำลังสร้าง…";
    try {
      var when = dayBefore(it.start);
      if (kind === "line") {
        var posts = brs.map(function (b) {
          return { date: when, time: "10.00", pageId: PAGE_OF[b], kind: "promo", status: "plan", channels: ["Line OA"],
                   topic: "แจ้งโปรฯ " + it.name + " (LINE)", campaignId: it.id, note: "สร้างจากปฏิทินการตลาด" };
        });
        await api("/t/posts", { method: "POST", body: JSON.stringify({ posts: posts }) });
        toast("สร้างโพสต์ LINE " + posts.length + " แถว (" + brs.join(", ") + ") ในตารางโพสต์แล้ว");
      } else {
        var due = new Date(parseISO(when)); due.setHours(18, 0, 0, 0);
        var tasks = brs.map(function (b) {
          return { title: "ป้ายโปรฯ " + it.name + " — " + b, taskType: "signage", assignees: [SIGN_OWNER], dueAt: due.toISOString(),
                   campaignId: it.id, signBranch: b, detail: "สร้างจากปฏิทินการตลาด · โปรฯ " + fmtRange(it) };
        });
        await api("/t/tasks", { method: "POST", body: JSON.stringify({ tasks: tasks }) });
        toast("สร้างงานป้าย " + tasks.length + " งาน (" + brs.join(", ") + ") มอบพิซซ่าแล้ว");
      }
      await loadStatus();
      render();
      /* วาดการ์ดใหม่ให้เห็นสถานะที่เพิ่งสร้าง */
      var anchor = document.querySelector('[data-open="' + it.id + '"]');
      if (anchor) { pinned = false; showHover([it], anchor, null); pinned = true; }
    } catch (e) {
      btn.disabled = false; btn.textContent = "สร้างไม่สำเร็จ — ลองใหม่";
      toast("สร้างไม่สำเร็จ: " + e.message);
    }
  }
  /* บล็อกสถานะเต็มในการ์ด: funnel จุดต่องานป้าย · โพสต์ · งานอื่น — กดแต่ละบรรทัดไปงานนั้น */
  function statusBlock(it) {
    var st = stOf(it) || { signs: [], others: [], posts: { total: 0, done: 0, late: 0 }, chan: {} };
    var h = '<div class="cc-stblk">';
    /* เช็คลิสต์สื่อ: LINE ต้องมีเสมอ · ช่องอื่นโชว์เมื่อมี · ป้ายโชว์เสมอ (บางโปรฯ ต้องมี) */
    var chan = st.chan || {};
    var line = chan.line;
    h += '<div class="cc-media">' +
      (line
        ? '<a class="cc-mchip' + (line.late ? " late" : (line.done === line.total ? " ok" : " some")) + '" href="' + TASKS_BASE + '#/posts?campaign=' + it.id + '" title="โพสต์ LINE">LINE ลงแล้ว ' + line.done + "/" + line.total + (line.late ? " · เลยวัน " + line.late : "") + "</a>"
        : '<button type="button" class="cc-mchip miss" data-mk="line" data-mkid="' + it.id + '" title="สร้างแถวโพสต์ LINE ในตารางโพสต์ให้ทุกสาขาของโปรฯ นี้ทันที">LINE ✗ — + สร้างโพสต์ LINE</button>') +
      Object.keys(chan).filter(function (k) { return k !== "line"; }).map(function (k) {
        var c = chan[k];
        return '<a class="cc-mchip' + (c.late ? " late" : (c.done === c.total ? " ok" : " some")) + '" href="' + TASKS_BASE + '#/posts?campaign=' + it.id + '">' + CHAN_TH[k] + " ลงแล้ว " + c.done + "/" + c.total + (c.late ? " · เลยวัน " + c.late : "") + "</a>";
      }).join("") +
      (st.signs.length ? "" : '<button type="button" class="cc-mchip miss" data-mk="sign" data-mkid="' + it.id + '" title="สร้างงานป้าย 6 ขั้นให้ทุกสาขาของโปรฯ นี้ทันที (มอบพิซซ่า เปลี่ยนได้)">ป้าย ✗ — + สร้างงานป้าย</button>') +
      "</div>";
    if (!hasMedia(st)) {
      return h + '<div class="cc-stnote">ยังไม่มีสื่อผูกกับโปรฯ นี้เลย — กดปุ่มด้านบนสร้างได้ทันที หรือ <a href="' + TASKS_BASE + '#/new?campaign=' + it.id + '">สั่งงานอื่น</a></div></div>';
    }
    st.signs.forEach(function (x) {
      h += '<a class="cc-strow" href="' + TASKS_BASE + '#/task/' + x.id + '"><span class="cc-stname">' + esc(x.title) + "</span>" +
        '<span class="cc-fun">' + x.stages.map(function (sg, i) {
          return '<i class="' + (sg.done ? "on" : (i === x.stageIdx ? "now" : "")) + (sg.review ? " rev" : "") + '" title="' + esc(sg.th) + '"></i>';
        }).join("") + "</span>" +
        '<span class="cc-stlbl' + (x.late ? " late" : (x.status === "done" ? " ok" : "")) + '">' + esc(x.stageTh) + (x.late ? " · เลยกำหนด" : "") + "</span></a>";
    });
    if (st.posts.total) h += '<a class="cc-strow" href="' + TASKS_BASE + '#/posts?campaign=' + it.id + '"><span class="cc-stname">โพสต์</span><span></span>' +
      '<span class="cc-stlbl' + (st.posts.late ? " late" : (st.posts.done === st.posts.total ? " ok" : "")) + '">ลงแล้ว ' + st.posts.done + "/" + st.posts.total + (st.posts.late ? " · เลยวัน " + st.posts.late : "") + "</span></a>";
    st.others.forEach(function (x) {
      h += '<a class="cc-strow" href="' + TASKS_BASE + '#/task/' + x.id + '"><span class="cc-stname">' + esc(x.title) + "</span><span></span>" +
        '<span class="cc-stlbl' + (x.late ? " late" : (x.status === "done" ? " ok" : "")) + '">' + (TASK_STATUS_TH[x.status] || x.status) + (x.late ? " · เลยกำหนด" : "") + "</span></a>";
    });
    return h + "</div>";
  }

  async function loadAll() {
    try {
      var data = await api("/campaigns");
      items = data.campaigns || [];
      online = true;
      await loadStatus();
    } catch (e) {
      online = false;
      try {
        var raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
        items = raw && Array.isArray(raw.items) ? raw.items : [];
      } catch (e2) { items = []; }
    }
    var flag = $("ccOffline");
    if (flag) flag.style.display = online ? "none" : "";
  }

  function cacheLocal() {
    if (online) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify({ version:2, items:items })); } catch (e) {}
  }

  /* ---------- helpers ---------- */
  function iso(y, m, d) {
    return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }
  function parseISO(s) { var p = String(s || "").split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function todayISO() { var t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); }
  function daysIn(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function be(y) { return y + 543; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  function baht(n) { return Number(n || 0).toLocaleString("th-TH"); }
  /* ---- สัปดาห์: เริ่มวันอาทิตย์ ชุดเดียวกับหัวตารางปฏิทิน (DOW เริ่ม "อา")
     นับเป็นจำนวนวันเต็ม ไม่ใช่ลบมิลลิวินาที — ข้ามเส้นเวลาออมแสงแล้วเพี้ยนได้ ---- */
  function dayNum(d) { return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
  function weekStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()); }
  function weekNo(d) {
    var w = weekStart(d), y = w.getFullYear();
    /* สัปดาห์ที่ 1 = สัปดาห์ที่มี 1 ม.ค. อยู่ — ปลายธันวาบางปีจึงตกไปเป็นสัปดาห์ที่ 1 ของปีถัดไป */
    var base = weekStart(new Date(y, 0, 1));
    var n = Math.floor((dayNum(w) - dayNum(base)) / 7) + 1;
    if (n > 52) {
      var nextBase = weekStart(new Date(y + 1, 0, 1));
      if (dayNum(w) >= dayNum(nextBase)) return 1;
    }
    return n;
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function isoOf(d) { return iso(d.getFullYear(), d.getMonth(), d.getDate()); }
  function shortDay(d) { return d.getDate() + " " + MONTHS_SHORT[d.getMonth()]; }
  /* ---- ตารางวันของรายการ: หลายช่วง / ทุกสัปดาห์เลือกวัน / ทุกเดือนช่วงวันเดิม (นนท์ 27 ก.ย. 69)
     occ(it) คืนช่วงวันที่ "มีผลจริง" [[เริ่ม, จบ], ...] — ปฏิทินวาดแถบเฉพาะช่วงพวกนี้ ไม่ลากยาวทั้งกรอบ ---- */
  var occMemo = {};
  function shiftMonth(d, n) {
    var m = d.getMonth() + n, y = d.getFullYear() + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return new Date(y, m, Math.min(d.getDate(), daysIn(y, m)));
  }
  function occ(it) {
    var sc = it && it.schedule;
    /* แผนทั้งเดือน + ทำซ้ำทุกเดือน → เต็มเดือนทุกเดือนจนถึงเดือนสุดท้าย (เลื่อนวันสิ้นเดือนตรง ๆ ไม่ได้ ก.ย. 30 → ต.ค. 30 จะขาดวันที่ 31) */
    if (sc && isMonthPlan(it) && sc.rep && sc.rep.type === "monthly" && sc.rep.until) {
      var mk = it.id + "|m|" + JSON.stringify(sc);
      if (occMemo[mk]) return occMemo[mk];
      var outM = [], d0 = parseISO(it.start);
      for (var k = 0; k < 25; k++) {
        var y1 = d0.getFullYear(), m1 = d0.getMonth() + k;
        var a1 = isoOf(new Date(y1, m1, 1)), b1 = isoOf(new Date(y1, m1 + 1, 0));
        if (a1 > sc.rep.until) break;
        outM.push([a1, b1]);
      }
      return (occMemo[mk] = outM.length ? outM : [[it.start, it.end || it.start]]);
    }
    if (!sc || !sc.ranges || !sc.ranges.length || isMonthPlan(it)) return [[it.start, it.end || it.start]];
    var key = it.id + "|" + JSON.stringify(sc);
    if (occMemo[key]) return occMemo[key];
    var rep = sc.rep || { type: "none" }, out = [];
    if (rep.type === "weekly") {
      var run = null, prev = "";
      for (var d = parseISO(sc.ranges[0].s), n = 0; isoOf(d) <= rep.until && n < 800; d = addDays(d, 1), n++) {
        var s = isoOf(d);
        if ((rep.days || []).indexOf(d.getDay()) !== -1) {
          if (run && run[1] === prev) run[1] = s; else { run = [s, s]; out.push(run); }
        }
        prev = s;
      }
    } else if (rep.type === "monthly") {
      for (var mi = 0; mi < 25; mi++) {
        sc.ranges.forEach(function (r) {
          var a = isoOf(shiftMonth(parseISO(r.s), mi)), b = isoOf(shiftMonth(parseISO(r.e || r.s), mi));
          if (a > rep.until) return;
          out.push([a, b > rep.until ? rep.until : b]);
        });
      }
    } else {
      out = sc.ranges.map(function (r) { return [r.s, r.e || r.s]; });
    }
    if (!out.length) out = [[it.start, it.start]];
    return (occMemo[key] = out);
  }
  function covers(it, dayISO) { return occ(it).some(function (g) { return g[0] <= dayISO && dayISO <= g[1]; }); }
  /* W1–W4 ของเดือน: 1–9 · 10–16 · 17–23 · 24–สิ้นเดือน (นนท์กำหนด — ใช้ทุกที่ที่เลือกวัน) */
  /* สัปดาห์ที่คาบ 2 เดือน (เช่น อา 27 ก.ย. – ส 3 ต.ค.) นับเป็น W4 ของเดือนเก่าทั้งสัปดาห์ (นนท์ 27 ก.ย. 69)
     → วันต้นเดือนก่อนวันอาทิตย์แรกยกไป W4 เดือนก่อน · W1 เริ่มวันอาทิตย์แรก–9 · W4 = 24 ถึงเสาร์แรกของเดือนถัดไป */
  var W_START = [1, 10, 17, 24];
  function carryDays(y, m) { var dw = new Date(y, m, 1).getDay(); return dw === 0 ? 0 : 7 - dw; }  /* วันต้นเดือนที่ยกไปเดือนก่อน */
  function wRange(y, m, w) {
    if (w === 1) return [iso(y, m, carryDays(y, m) + 1), iso(y, m, 9)];
    if (w === 4) return [iso(y, m, 24), isoOf(addDays(new Date(y, m, daysIn(y, m)), carryDays(y, m + 1)))];
    return [iso(y, m, W_START[w - 1]), iso(y, m, W_START[w] - 1)];
  }
  /* W ของวันนี้ + เดือนที่ W นั้นสังกัด */
  function wInfo(dISO) {
    var d = parseISO(dISO), y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    if (day <= carryDays(y, m)) { var p = new Date(y, m, 0); y = p.getFullYear(); m = p.getMonth(); return { w: 4, y: y, m: m, carried: true }; }
    return { w: day <= 9 ? 1 : day <= 16 ? 2 : day <= 23 ? 3 : 4, y: y, m: m, carried: false };
  }
  function wTag(dISO) { var x = wInfo(dISO); return "W" + x.w + (x.carried ? " " + MONTHS_SHORT[x.m] : ""); }
  function dayTag(dISO) { var d = parseISO(dISO); return wTag(dISO) + " · วัน" + DOW_FULL[d.getDay()]; }
  function hhmm(t) { return String(t || "").replace(":", "."); }
  function timeText(sc) {
    if (!sc || (!sc.t1 && !sc.t2)) return "";
    return sc.t1 && sc.t2 ? hhmm(sc.t1) + "–" + hhmm(sc.t2) + " น." : (sc.t1 ? "เริ่ม " + hhmm(sc.t1) + " น." : "ถึง " + hhmm(sc.t2) + " น.");
  }
  function segText(a, b) {
    var x = parseISO(a), y = parseISO(b || a);
    if (a === (b || a)) return x.getDate() + " " + MONTHS_SHORT[x.getMonth()];
    if (x.getMonth() === y.getMonth()) return x.getDate() + "–" + y.getDate() + " " + MONTHS_SHORT[x.getMonth()];
    return x.getDate() + " " + MONTHS_SHORT[x.getMonth()] + " – " + y.getDate() + " " + MONTHS_SHORT[y.getMonth()];
  }
  /* วัน จ อ พ ติดกันย่อเป็น "จ–พ" · อา นับเป็นวันสุดท้ายของสัปดาห์ จะได้อ่าน "ศ–อา" ได้ */
  function daysText(days) {
    var order = [1, 2, 3, 4, 5, 6, 0], on = order.filter(function (d) { return days.indexOf(d) !== -1; });
    if (on.length === 7) return "ทุกวัน";
    var parts = [], i = 0;
    while (i < on.length) {
      var j = i;
      while (j + 1 < on.length && order.indexOf(on[j + 1]) === order.indexOf(on[j]) + 1) j++;
      parts.push(j - i >= 2 ? DOW[on[i]] + "–" + DOW[on[j]] : on.slice(i, j + 1).map(function (d) { return DOW[d]; }).join(", "));
      i = j + 1;
    }
    return "ทุก " + parts.join(", ");
  }
  /* ข้อความช่วงวันของรายการที่มีตารางวัน — ว่าง = รายการแบบช่วงเดียวธรรมดา */
  function schedText(it) {
    var sc = it.schedule;
    if (sc && isMonthPlan(it)) {
      var mA = parseISO(it.start), tm = timeText(sc);
      var head = sc.rep && sc.rep.type === "monthly" && sc.rep.until
        ? "ทั้งเดือน ทุกเดือน · " + MONTHS_SHORT[mA.getMonth()] + " – " + MONTHS_SHORT[parseISO(sc.rep.until).getMonth()] + " " + String(be(parseISO(sc.rep.until).getFullYear())).slice(2)
        : "ทั้งเดือน" + MONTHS[mA.getMonth()];
      return head + (tm ? " · " + tm : "");
    }
    if (!sc || !sc.ranges || isMonthPlan(it)) return "";
    var rep = sc.rep || { type: "none" }, t = timeText(sc), txt;
    if (rep.type === "weekly") txt = daysText(rep.days || []) + " · " + segText(sc.ranges[0].s, rep.until);
    else if (rep.type === "monthly") txt = "ทุกเดือน วันที่ " + sc.ranges.map(function (r) {
        var a = parseISO(r.s).getDate(), b = parseISO(r.e || r.s).getDate();
        return a === b ? a : a + "–" + b;
      }).join(", ") + " · ถึง " + segText(rep.until);
    else txt = sc.ranges.map(function (r) { return segText(r.s, r.e); }).join(", ");
    return txt + (t ? " · " + t : "");
  }
  function isMonthPlan(it) { return it.scope === "month"; }
  function fmtRange(it) {
    var st = schedText(it);
    if (st) return esc(st);
    var a = parseISO(it.start);
    if (isMonthPlan(it)) {
      var b0 = parseISO(it.end);
      if (a.getMonth() === b0.getMonth() && a.getFullYear() === b0.getFullYear()) {
        return "ทั้งเดือน" + MONTHS[a.getMonth()];
      }
    }
    /* ใส่ชื่อวันย่อด้วย ทีมนัดงานกันเป็น "จันทร์นี้/ศุกร์หน้า" ไม่ใช่เป็นวันที่ */
    var txt = DOW[a.getDay()] + ". " + a.getDate() + " " + MONTHS_SHORT[a.getMonth()];
    if (it.end && it.end !== it.start) {
      var b = parseISO(it.end);
      txt += " – " + DOW[b.getDay()] + ". " + b.getDate() + " " + MONTHS_SHORT[b.getMonth()];
      if (b.getFullYear() !== a.getFullYear()) txt += " " + String(be(b.getFullYear())).slice(2);
    }
    return txt;
  }
  function colorOf(it) { return subOf(it).c; }
  /* พื้นอ่อนของสีแคมเปญ — คำนวณเป็น rgba เอง จะได้ไม่ต้องพึ่ง color-mix */
  function tint(hex, alpha) {
    var h = hex.replace("#", "");
    return "rgba(" + parseInt(h.slice(0,2),16) + "," + parseInt(h.slice(2,4),16) + "," +
           parseInt(h.slice(4,6),16) + "," + alpha + ")";
  }
  function chipStyle(it) {
    var c = colorOf(it);
    return ' style="background:' + tint(c, .16) + ';color:' + ink(c) + ';border-left-color:' + c + '"';
  }

  /* ชื่อสั้นสำหรับช่องปฏิทินแคบๆ — ตัดคำนำหน้าแบบ "Category Bomb #3 · " ออก */
  function shortName(name) {
    return String(name).replace(/^[^·]{0,40}#\d+\s*·\s*/, "");
  }

  function ofYear() {
    var y = String(year);
    return pool().filter(function (it) {
      return it.start.slice(0, 4) === y || (it.end || it.start).slice(0, 4) === y;
    }).sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  }
  function ofMonth(m) {
    var a = iso(year, m, 1), b = iso(year, m, daysIn(year, m));
    return ofYear().filter(function (it) { return overlaps(it, a, b); });
  }
  function byId(id) { return items.filter(function (x) { return x.id === id; })[0]; }

  /* ---------- render ---------- */
  function render() {
    sel = sel.filter(function (id) { return byId(id); });   /* รายการที่ถูกลบไปแล้วหลุดจากที่เลือก */
    renderBulkBar();
    renderKindBar();
    renderBranchBar();
    renderViewBar();
    renderSoon();
    $("ccYear").innerHTML = be(year) + "<small>ค.ศ. " + year + "</small>";
    renderStats();
    if (view.layout === "grid") {
      renderGrid();
      /* ตารางด้านล่างซ้ำกับตารางหลักแล้ว ซ่อนไปเลยจะได้ไม่ต้องเลื่อนผ่านของเดิมสองรอบ */
      $("ccList").innerHTML = "";
      return;
    }
    if (view.mode === "year") renderYear(); else renderMonth();
    renderList();
  }

  /* ---------- แถบสลับมุมมอง: ปฏิทิน / ตาราง (+ จัดกลุ่มตามอะไร) ---------- */
  function renderViewBar() {
    /* ปุ่มสลับ ปฏิทิน/ตาราง/สไลด์ อยู่แถบบนสุดคู่กับปุ่มอื่น — ที่นี่แค่ทาสีว่าอันไหนเปิดอยู่ */
    var sw = $("ccModeSw");
    if (sw) {
      var bs = sw.querySelectorAll("[data-layout]");
      for (var i = 0; i < bs.length; i++) bs[i].classList.toggle("on", bs[i].dataset.layout === view.layout);
    }
    var el = $("ccViewBar");
    if (!el) return;
    el.innerHTML = view.layout !== "grid" ? "" :
      '<span class="cc-kindlbl">จัดกลุ่มตาม</span>' + GROUPS.filter(function (g) {
        /* จัดกลุ่มตามเดือนในมุมมองเดือนเดียวไม่มีประโยชน์ — ได้กลุ่มเดียวเสมอ */
        return !(g[0] === "month" && view.mode === "month");
      }).map(function (g) {
        return '<button type="button" class="cc-kind' + (groupMode() === g[0] ? " on" : "") + '" data-group="' + g[0] + '">' + g[1] + "</button>";
      }).join("");
  }
  function groupMode() {
    return (view.group === "month" && view.mode === "month") ? "day" : view.group;
  }

  function renderStats() {
    var list = ofYear(), t = todayISO();
    var running = list.filter(function (i) { return covers(i, t); }).length;
    var plan = list.filter(function (i) { return i.status === "plan"; }).length;
    var budget = list.reduce(function (s, i) { return s + (Number(i.budget) || 0); }, 0);
    $("ccStats").innerHTML =
      card("รายการทั้งปี", list.length, "รายการ") +
      card("กำลังทำอยู่วันนี้", running, "รายการ", running > 0) +
      card("ยังไม่เริ่ม", plan, "รายการ") +
      card("งบรวมทั้งปี", '<span class="cur">฿</span>' + baht(budget), "");
  }
  function card(k, v, u, hot) {
    return '<div class="cc-stat' + (hot ? " live" : "") + '"><div class="k">' + k + "</div>" +
           '<div class="v">' + v + (u ? '<span class="u">' + u + "</span>" : "") + "</div></div>";
  }

  function renderYear() {
    var now = new Date(), tISO = todayISO(), out = '<div class="cc-months">';
    for (var m = 0; m < 12; m++) {
      var list = ofMonth(m), days = daysIn(year, m), lead = new Date(year, m, 1).getDay();
      var cur = now.getFullYear() === year && now.getMonth() === m;
      var cells = "";
      for (var i = 0; i < lead; i++) cells += '<i class="pad">0</i>';
      for (var d = 1; d <= days; d++) {
        var dISO = iso(year, m, d), dow = new Date(year, m, d).getDay();
        var hits = list.filter(function (it) { return covers(it, dISO); });
        var cls = hits.length ? "on" : (dow === 0 || dow === 6 ? "we" : "");
        if (dISO === tISO) cls += " today";
        var st = "";
        if (hits.length) {
          var c = colorOf(hits[0]);
          st = ' style="background:' + tint(c, .2) + ';color:' + c + '"';
        }
        // วันที่มีแคมเปญต้อง hover ได้ในมุมมองปีด้วย ไม่ใช่แค่มุมมองเดือน
        cells += '<i class="' + cls + '"' + st + (hits.length ? ' data-daypeek="' + dISO + '"' : "") + ">" + d + "</i>";
      }
      out += '<button class="cc-month' + (cur ? " cur" : "") + '" data-month="' + m + '">' +
             "<h3>" + MONTHS[m] + '<span class="cnt' + (list.length ? " has" : "") + '">' +
             (list.length ? list.length + " รายการ" : "—") + "</span></h3>" +
             '<div class="cc-mini">' + DOW.map(function (x) { return "<span>" + x + "</span>"; }).join("") + cells + "</div></button>";
    }
    $("ccView").innerHTML = out + "</div>";
  }

  /* ปุ่มเลื่อนเดือนก่อน/ถัดไป ข้างชื่อเดือน (นนท์ 28 ก.ย. 69: ดู ก.ย. แล้วไม่มีปุ่มไป ต.ค.) — ข้ามปีให้เอง */
  function monthNav(h2) {
    var arrow = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>'; };
    var prevM = (view.month + 11) % 12, nextM = (view.month + 1) % 12;
    return '<div class="cc-mnav"><button type="button" class="cc-mstep" data-mstep="-1" title="' + MONTHS[prevM] + '" aria-label="เดือนก่อน (' + MONTHS[prevM] + ')">' + arrow("M15 18l-6-6 6-6") + "</button>" +
      h2 + '<button type="button" class="cc-mstep" data-mstep="1" title="' + MONTHS[nextM] + '" aria-label="เดือนถัดไป (' + MONTHS[nextM] + ')">' + arrow("M9 18l6-6-6-6") + "</button></div>";
  }
  function renderMonth() {
    var m = view.month, days = daysIn(year, m), lead = new Date(year, m, 1).getDay();
    var tISO = todayISO(), list = ofMonth(m);
    /* รายการที่มีหลายช่วง/ทำซ้ำ แตกเป็นแถบย่อยตามวันที่มีผลจริง */
    var events = [];
    list.filter(function (it) { return !isMonthPlan(it); }).forEach(function (it) {
      occ(it).forEach(function (g) { events.push({ it: it, s: g[0], e: g[1] }); });
    });
    events.sort(function (a, b) {
      if (a.s !== b.s) return a.s < b.s ? -1 : 1;
      return a.e > b.e ? -1 : a.e < b.e ? 1 : 0;   /* เริ่มพร้อมกัน เอาอันยาวขึ้นก่อน */
    });
    /* วันในกริด (รวมวันเกินขอบเดือน) — เรียงเป็นสัปดาห์ละ 7 ช่อง
       โปรฯ หลายวันวาดเป็นแถบยาวลากข้ามช่อง ไม่ต้องอ่านทีละวัน (นนท์ขอ 19 ก.ย. 69) */
    var first = new Date(year, m, 1 - lead);
    var tail = (7 - ((lead + days) % 7)) % 7;
    var total = lead + days + tail;
    var MAX_LANES = 6;
    var weeks = "";
    for (var w = 0; w < total / 7; w++) {
      var dayISO = [];
      for (var c = 0; c < 7; c++) {
        var dt = new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7 + c);
        dayISO.push(iso(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      }
      var wStart = dayISO[0], wEnd = dayISO[6];
      /* จัดเลน: แถบที่คาบสัปดาห์นี้ ใส่เลนแรกที่ว่างในช่วงคอลัมน์ของมัน */
      var lanes = [], bars = [], hidden = [0, 0, 0, 0, 0, 0, 0];
      events.forEach(function (ev) {
        var it = ev.it, e = ev.e;
        if (ev.s > wEnd || e < wStart) return;
        var c0 = ev.s <= wStart ? 0 : dayISO.indexOf(ev.s);
        var c1 = e >= wEnd ? 6 : dayISO.indexOf(e);
        var lane = -1;
        for (var L = 0; L < lanes.length; L++) {
          var busy = false;
          for (var k = c0; k <= c1; k++) if (lanes[L][k]) { busy = true; break; }
          if (!busy) { lane = L; break; }
        }
        if (lane === -1) { lane = lanes.length; lanes.push([0, 0, 0, 0, 0, 0, 0]); }
        if (lane >= MAX_LANES) { for (var q = c0; q <= c1; q++) hidden[q]++; return; }
        for (var k2 = c0; k2 <= c1; k2++) lanes[lane][k2] = 1;
        bars.push({ it: it, c0: c0, c1: c1, lane: lane, contL: ev.s < wStart, contR: e > wEnd });
      });
      var nLanes = Math.min(MAX_LANES, lanes.length);
      var cells = "", nums = "", mores = "";
      for (var d = 0; d < 7; d++) {
        var dISO = dayISO[d], dt2 = new Date(dISO.slice(0, 4), +dISO.slice(5, 7) - 1, +dISO.slice(8, 10));
        var inMonth = dt2.getMonth() === m;
        var dow = dt2.getDay();
        // เซลล์ = พื้นหลังกินทุกแถวของสัปดาห์ (กดเพิ่มรายการ) · เลขวันอยู่แถว 1 · แถบอยู่แถว 2.. · "+ อีก" แถวสุดท้าย
        // เซลล์ต้องไม่เป็น <button> เพราะแถบข้างในก็เป็นปุ่ม — ปุ่มซ้อนปุ่มทำให้เบราว์เซอร์ตัดโครงทิ้ง
        cells += '<div class="cc-cell' + (inMonth ? "" : " out") + (dow === 0 || dow === 6 ? " we" : "") + (dISO === tISO ? " today" : "") +
          '" style="grid-column:' + (d + 1) + ';grid-row:1 / span ' + (nLanes + 2) + '"' +
          (inMonth ? ' data-day="' + dISO + '" role="button" tabindex="0" aria-label="เพิ่มรายการวันที่ ' + dt2.getDate() + '"' : "") + "></div>";
        nums += '<span class="cc-dnum' + (dISO === tISO ? " today" : "") + (inMonth ? "" : " out") + '" style="grid-column:' + (d + 1) + ';grid-row:1">' + dt2.getDate() +
          (inMonth && [carryDays(dt2.getFullYear(), dt2.getMonth()) + 1, 10, 17, 24].indexOf(dt2.getDate()) !== -1 ? '<i class="cc-wtag" title="' + wTag(dISO) + ' เริ่มวันนี้">' + wTag(dISO) + "</i>" : "") + "</span>";
        if (hidden[d]) mores += '<button type="button" class="cc-more" style="grid-column:' + (d + 1) + ';grid-row:' + (nLanes + 2) + '" data-daypeek="' + dISO + '" data-dayopen="' + dISO + '">+ อีก ' + hidden[d] + "</button>";
      }
      var barsH = bars.map(function (b) {
        var it = b.it, col = colorOf(it);
        /* กดแถบ = ไปหน้าสถานะ (งานป้าย/โพสต์ที่ผูก) · แก้รายละเอียดจากการ์ด hover หรือหน้าสถานะ */
        return '<button class="cc-bar' + (b.contL ? " contl" : "") + (b.contR ? " contr" : "") + (sel.indexOf(it.id) !== -1 ? " sel" : "") + '" data-open="' + it.id +
          '" style="grid-column:' + (b.c0 + 1) + ' / ' + (b.c1 + 2) + ';grid-row:' + (b.lane + 2) + ';background:' + tint(col, .2) + ';color:' + ink(col) + ';border-left-color:' + col + '"' +
          ' title="' + esc(it.name) + " · " + fullRange(it) + '">' + kindDot(it) + "<b>" + esc(shortName(it.name)) + "</b>" +
          (b.c1 - b.c0 >= 1 ? statusBrief(it) : (hasMedia(stOf(it)) ? "" : '<span class="cc-st warn" title="ยังไม่มีสื่อ">!</span>')) +
          (it.branches && it.branches.length && b.c1 - b.c0 >= 3 ? '<small>' + esc(it.branches.join(" · ")) + "</small>" : "") + "</button>";
      }).join("");
      weeks += '<div class="cc-week" style="grid-template-rows:auto repeat(' + nLanes + ', auto) minmax(18px, 1fr)">' + cells + nums + barsH + mores + "</div>";
    }
    var cells = weeks;

    var monthPlans = list.filter(isMonthPlan);
    var banner = monthPlans.length
      ? '<div class="cc-monthplans">' + monthPlans.map(function (it) {
          return '<button class="cc-mplan" data-edit="' + it.id + '" style="border-left-color:' + colorOf(it) + '">' +
                 kindPill(it) + '<span class="cc-pill ' + it.status + '">' + STATUS_LABEL[it.status] + "</span>" +
                 "<b>" + esc(shortName(it.name)) + "</b>" +
                 (it.branches && it.branches.length ? '<span class="cc-mplan-br">' + it.branches.map(esc).join(" · ") + "</span>" : "") +
                 "</button>";
        }).join("") + "</div>"
      : "";

    $("ccView").innerHTML =
      '<div class="cc-monthbar">' +
        '<button class="cc-back" id="ccBack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>ทั้งปี ' + be(year) + "</button>" +
        monthNav("<h2>" + MONTHS[m] + " " + be(year) + "</h2>") +
        '<span class="cc-mbtns"><button class="cc-btn' + (selMode ? " on" : "") + '" data-selmode="1" title="คลิกแถบในปฏิทินเพื่อเลือก แล้วแก้ทีเดียวจากแถบด้านล่าง">' +
          (selMode ? "เสร็จ (ปิดโหมดเลือก)" : "เลือกหลายรายการ") + "</button>" +
        '<button class="cc-btn" data-newmonth="1">+ แผนทั้งเดือนนี้</button></span>' +
      "</div>" + banner +
      '<div class="cc-cal' + (selMode ? " cc-selmode" : "") + '"><div class="cc-dow">' + DOW.map(function (x) { return "<div>" + x + "</div>"; }).join("") +
      '</div><div class="cc-weeks">' + cells + "</div></div>" +
      renderBranchBoard(list);
  }


  /* ============================================================
     มุมมองตาราง (แบบ Lark Base) — จัดกลุ่มได้ พับได้ พิมพ์เพิ่มในกลุ่มได้เลย
     ต่างจากตารางเดิมด้านล่างหน้าตรงที่ตารางนี้ "แก้ได้" ไม่ใช่แค่อ่าน
     ============================================================ */

  /* ช่วงวันตั้งต้นของรายการที่เพิ่มจากกลุ่มนี้ — อยู่ในช่วงที่มองอยู่เสมอ
     ไม่งั้นพิมพ์เพิ่มเสร็จแล้วแถวหายไปจากจอ เพราะตกนอกเดือนที่เปิดอยู่ */
  function defaultStart() {
    var t = todayISO();
    if (view.mode === "month") {
      var a = iso(year, view.month, 1), b = iso(year, view.month, daysIn(year, view.month));
      return (t >= a && t <= b) ? t : a;
    }
    return t.slice(0, 4) === String(year) ? t : iso(year, 0, 1);
  }

  /* กลุ่มของตาราง: {key, label, sub, items, preset}
     preset = ค่าที่เติมให้อัตโนมัติเวลาเพิ่มรายการในกลุ่มนั้น (นี่คือหัวใจของ Lark Base) */
  function gridGroups(list) {
    var mode = groupMode(), out = [], map = {};
    function bucket(key, label, sub, preset, sort) {
      if (!map[key]) { map[key] = { key: key, label: label, sub: sub || "", items: [], preset: preset || {}, sort: sort }; out.push(map[key]); }
      return map[key];
    }
    /* วันแรกที่รายการมีผลในช่วงที่เปิดดู (เดือนที่เปิด หรือทั้งปี) */
    var mA = view.mode === "month" ? iso(year, view.month, 1) : iso(year, 0, 1);
    var mB = view.mode === "month" ? iso(year, view.month, daysIn(year, view.month)) : iso(year, 11, 31);
    function firstIn(it) {
      var hit = occ(it).filter(function (g) { return g[0] <= mB && g[1] >= mA; })[0];
      return hit ? (hit[0] < mA ? mA : hit[0]) : it.start;
    }
    if (mode === "day") {
      var plansD = list.filter(isMonthPlan);
      if (plansD.length) bucket("d:month", "แผนทั้งเดือน", "ไม่ผูกกับวันไหน", { scope: "month" }, "0").items = plansD;
      list.filter(function (it) { return !isMonthPlan(it); }).forEach(function (it) {
        var d = firstIn(it), dd = parseISO(d);
        bucket("d:" + d, DOW[dd.getDay()] + ". " + dd.getDate() + " " + MONTHS_SHORT[dd.getMonth()], "",
               { start: d, end: d }, d).items.push(it);
      });
      /* วันนี้ต้องมีช่องให้พิมพ์เสมอ */
      var tD = todayISO();
      if (tD >= mA && tD <= mB) { var td0 = parseISO(tD); bucket("d:" + tD, "วันนี้ · " + DOW[td0.getDay()] + ". " + td0.getDate() + " " + MONTHS_SHORT[td0.getMonth()], "", { start: tD, end: tD }, tD); }
      out.sort(function (a, b) { return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0; });
    } else if (mode === "week") {
      /* แผนทั้งเดือนไม่มี W แยกไว้กลุ่มบนสุด ไม่ปนกับรายการรายสัปดาห์ */
      var plans = list.filter(isMonthPlan);
      if (plans.length) {
        var g0 = bucket("w:month", "แผนทั้งเดือน", "ไม่ผูกกับสัปดาห์ไหน", { scope: "month" }, "0");
        g0.items = plans;
      }
      /* สัปดาห์ = W1–W4 ของเดือน (1–9 · 10–16 · 17–23 · 24–สิ้นเดือน) · ใช้วันแรกที่มีผลในเดือนที่เปิดอยู่ */
      function wBucket(dISO) {
        var x = wInfo(dISO), r = wRange(x.y, x.m, x.w);
        /* สัปดาห์ที่คาบเดือน: เปิดดูเดือนถัดไปอยู่แล้วเจอหัว "W4 กันยายน" จะดูเหมือนจับวันผิด → บอกให้ชัดว่าเป็นวันต้นเดือนนี้ที่นับรวมกับ W4 เดือนก่อน */
        var carry = view.mode === "month" && x.m !== view.month;
        var lbl = carry ? "W4 " + MONTHS_SHORT[x.m] + " (ต่อถึง " + segText(mA, r[1] < mB ? r[1] : mB) + ")" : "W" + x.w + " · " + MONTHS[x.m];
        var sub = carry ? "สัปดาห์ที่คาบเดือน นับรวมกับ W4 ของ" + MONTHS[x.m] + " · " + segText(r[0], r[1]) : segText(r[0], r[1]);
        return bucket("w:" + r[0], lbl, sub, { start: r[0], end: r[1] }, r[0]);
      }
      list.filter(function (it) { return !isMonthPlan(it); }).forEach(function (it) { wBucket(firstIn(it)).items.push(it); });
      /* W นี้ต้องมีช่องให้พิมพ์เสมอ ถึงยังไม่มีรายการสักอัน */
      var tNow = todayISO();
      if (tNow.slice(0, 4) === String(year) && (view.mode !== "month" || parseISO(tNow).getMonth() === view.month)) wBucket(tNow);
      out.sort(function (a, b) { return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0; });
    } else if (mode === "month") {
      for (var m = 0; m < 12; m++) {
        var mine = list.filter(function (it) {
          return parseISO(it.start) <= new Date(year, m, daysIn(year, m)) && parseISO(it.end || it.start) >= new Date(year, m, 1);
        });
        if (!mine.length && m !== new Date().getMonth()) continue;
        var g = bucket("m:" + m, MONTHS[m], "", { start: iso(year, m, 1) });
        g.items = mine;
      }
    } else if (mode === "kind") {
      /* จัดกลุ่มตามหมวดย่อย (หัวกลุ่มบอกหมวดใหญ่) */
      SUBS.filter(function (x) { return !view.kind || x.kind === view.kind; }).forEach(function (x) {
        bucket("k:" + x.k, x.th, KIND_LABEL[x.kind], { kind: x.kind, sub: x.k });
      });
      list.forEach(function (it) { var g = map["k:" + subOf(it).k]; if (g) g.items.push(it); });
    } else if (mode === "branch") {
      (view.branch && view.branch !== NO_BRANCH ? [view.branch] : BRANCHES).forEach(function (b) { bucket("b:" + b, b, "", { branch: b }); });
      var loose = [];
      list.forEach(function (it) {
        var brs = (it.branches || []).filter(function (b) { return map["b:" + b]; });
        /* งานข้ามสาขาโผล่ในทุกสาขาที่เกี่ยว — ตรงกับที่ทีมถามว่า "สาขาฉันเดือนนี้มีอะไร" */
        if (brs.length) brs.forEach(function (b) { map["b:" + b].items.push(it); });
        else loose.push(it);
      });
      if (loose.length || view.branch === NO_BRANCH) bucket("b:none", "ยังไม่ระบุสาขา", "", {}).items = loose;
    } else {
      ["plan", "live", "done"].forEach(function (st) { bucket("s:" + st, STATUS_LABEL[st], "", { status: st }); });
      list.forEach(function (it) { var g = map["s:" + (it.status || "plan")]; if (g) g.items.push(it); });
    }
    return out;
  }

  var GRID_COLS = 10;
  function gridRow(it) {
    var brs = (it.branches || []), chs = (it.channels || []);
    return '<tr data-gid="' + it.id + '" class="' + (sel.indexOf(it.id) !== -1 ? "sel" : "") + '" style="border-left:3px solid ' + colorOf(it) + '">' +
      '<td class="cc-gsel"><input type="checkbox" data-sel="' + it.id + '"' + (sel.indexOf(it.id) !== -1 ? " checked" : "") + ' aria-label="เลือก ' + esc(it.name) + '"></td>' +
      '<td class="nm" data-cell="name" title="กดเพื่อแก้ชื่อ">' + kindDot(it) + '<span class="cc-gname">' + esc(it.name) + "</span>" +
        linkLine(it) + (it.note ? '<div class="cc-note">' + esc(it.note) + "</div>" : "") + "</td>" +
      '<td data-cell="kind" title="กดเพื่อเปลี่ยนประเภท">' + kindPill(it) + "</td>" +
      '<td class="dt" data-cell="range" title="กดเพื่อแก้ช่วงวัน">' + fmtRange(it) + "</td>" +
      '<td data-cell="status" title="กดเพื่อเปลี่ยนสถานะ"><span class="cc-pill ' + it.status + '">' + STATUS_LABEL[it.status] + "</span></td>" +
      '<td data-cell="branches" title="กดเพื่อแก้สาขา"><div class="cc-tags">' +
        (brs.length ? brs.map(function (b) { return '<span class="cc-tag">' + esc(b) + "</span>"; }).join("") : '<span class="cc-gmute">—</span>') + "</div></td>" +
      '<td data-cell="channels" title="กดเพื่อแก้ช่องทาง"><div class="cc-tags">' +
        (chs.length ? chs.map(function (c) { return '<span class="cc-tag">' + esc(c) + "</span>"; }).join("") : '<span class="cc-gmute">—</span>') + "</div></td>" +
      '<td class="dt" data-cell="budget" title="กดเพื่อแก้งบ">' + (it.budget ? "฿ " + baht(it.budget) : '<span class="cc-gmute">—</span>') + "</td>" +
      '<td data-cell="owner" title="กดเพื่อแก้ผู้รับผิดชอบ">' + (it.owner ? esc(it.owner) : '<span class="cc-gmute">—</span>') + "</td>" +
      '<td class="cc-gend"><span class="cc-gst">' + statusBrief(it) + "</span>" +
        '<button type="button" class="cc-icon" data-dup="' + it.id + '" aria-label="ทำสำเนา" title="ก๊อปอันนี้เป็นรายการใหม่ (รวมรูป) แล้วค่อยแก้วันที่">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
        '<button type="button" class="cc-icon" data-edit="' + it.id + '" aria-label="เปิดรายละเอียด" title="เปิดรายละเอียดทั้งหมด">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></button></td>' +
      "</tr>";
  }

  function renderGrid() {
    var list = view.mode === "month" ? ofMonth(view.month) : ofYear();
    var groups = gridGroups(list);
    var what = "รายการ";
    var body = groups.map(function (g) {
      var off = !!collapsed[g.key];
      var money = g.items.reduce(function (a, it) { return a + (Number(it.budget) || 0); }, 0);
      var allOn = g.items.length && g.items.every(function (it) { return sel.indexOf(it.id) !== -1; });
      var head = '<tr class="cc-grp' + (off ? " off" : "") + '"><td class="cc-gsel">' +
        (g.items.length ? '<input type="checkbox" data-selgrp="' + esc(g.key) + '"' + (allOn ? " checked" : "") + ' aria-label="เลือกทั้งกลุ่ม ' + esc(g.label) + '" title="เลือกทั้งกลุ่ม">' : "") +
        '</td><td colspan="' + (GRID_COLS - 1) + '">' +
        '<button type="button" class="cc-grpb" data-grpkey="' + esc(g.key) + '">' +
        '<svg class="cc-grpcar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>' +
        "<b>" + esc(g.label) + "</b>" + (g.sub ? '<span class="cc-grpsub">' + esc(g.sub) + "</span>" : "") +
        '<span class="cc-kn">' + g.items.length + "</span>" +
        (money ? '<span class="cc-grpsum">฿ ' + baht(money) + "</span>" : "") + "</button></td></tr>";
      if (off) return "<tbody>" + head + "</tbody>";
      var rows = g.items.map(gridRow).join("");
      /* แถวพิมพ์เพิ่ม — ค่าของกลุ่มถูกเติมให้เอง (สัปดาห์ไหน ประเภทอะไร สาขาไหน) */
      var add = '<tr class="cc-gadd"><td colspan="' + GRID_COLS + '">' +
        '<button type="button" class="cc-gaddb" data-gadd="' + esc(g.key) + '">+ เพิ่ม' + esc(what) + "ใน" + esc(g.label) + "</button></td></tr>";
      return "<tbody>" + head + rows + add + "</tbody>";
    }).join("");

    var title = (view.mode === "month" ? MONTHS[view.month] + " " + be(year) : "ทั้งปี " + be(year)) +
      (view.branch ? " · " + branchLabel() : "");
    var bar = '<div class="cc-monthbar">' +
      (view.mode === "month"
        ? '<button class="cc-back" id="ccBack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>ทั้งปี ' + be(year) + "</button>"
        : '<span class="cc-gallmo">เลือกเดือนเพื่อดูเฉพาะเดือนนั้น</span>') +
      (view.mode === "month" ? monthNav("<h2>" + esc(title) + "</h2>") : "<h2>" + esc(title) + "</h2>") +
      '<button class="cc-btn" data-new="1">+ เพิ่มรายการ</button></div>';

    var months = view.mode === "month" ? "" :
      '<div class="cc-gmonths">' + MONTHS_SHORT.map(function (mn, m) {
        var n = ofMonth(m).length;
        return '<button type="button" class="cc-kind" data-month="' + m + '">' + mn +
          '<span class="cc-kn">' + n + "</span></button>";
      }).join("") + "</div>";

    $("ccView").innerHTML = bar + months +
      (list.length || groups.length
        ? '<div class="cc-tablewrap cc-gridwrap"><table class="cc-table cc-gtab"><thead><tr>' +
          '<th class="cc-gsel"></th>' + "<th>ชื่อ</th><th>ประเภท</th><th>ช่วงวัน</th><th>สถานะ</th><th>สาขา</th><th>ช่องทาง</th><th>งบ</th><th>ผู้รับผิดชอบ</th><th>สื่อที่ผูกไว้</th>" +
          "</tr></thead>" + body + "</table></div>" +
          '<p class="cc-ghint">ติ๊กช่องหน้าแถวเพื่อแก้หลายรายการทีเดียว (Shift = เลือกเป็นช่วง · สูงสุด ' + MAX_SEL + ' รายการ) · กดที่ช่องเพื่อแก้ได้เลย · กดหัวกลุ่มเพื่อพับ · ปุ่ม + ท้ายกลุ่มจะเติม W/ประเภท/สาขาให้เอง · W1 = อาทิตย์แรก–9 · W2 = 10–16 · W3 = 17–23 · W4 = 24–สิ้นเดือน (สัปดาห์ที่คาบไปเดือนหน้านับเป็น W4 ของเดือนนี้ทั้งสัปดาห์)</p>'
        : '<div class="cc-empty"><p>ยังไม่มี' + esc(what) + "ในช่วงนี้</p>" +
          '<button class="cc-btn primary" data-new="1">เพิ่ม' + esc(what) + "</button></div>");
  }

  /* ============================================================
     เลือกหลายรายการแล้วแก้ทีเดียว (นนท์ 27 ก.ย. 69) — ครั้งละไม่เกิน 10 รายการ
     ตาราง: ติ๊กหน้าแถว / หัวกลุ่ม / Shift = ช่วง · ปฏิทิน: ปุ่ม "เลือกหลายรายการ" แล้วคลิกแถบ
     แถบด้านล่างจอ → เลื่อนวัน · ตั้งวันใหม่ · ผู้รับผิดชอบ · สถานะ · ประเภท · สาขา · ลบ → POST /api/campaigns/bulk
     ============================================================ */
  var MAX_SEL = 10;
  var sel = [], selMode = false, lastSel = null, bulkAct = "", bulkNames = [];
  function toggleSel(id, on) {
    var i = sel.indexOf(id);
    if (on == null) on = i === -1;
    if (on && i === -1) {
      if (sel.length >= MAX_SEL) { toast("เลือกได้ครั้งละไม่เกิน " + MAX_SEL + " รายการ"); return false; }
      sel.push(id);
    } else if (!on && i !== -1) sel.splice(i, 1);
    return true;
  }
  function clearSel() { sel = []; bulkAct = ""; lastSel = null; }
  function selNames() { return sel.map(function (id) { var it = byId(id); return it ? it.name : ""; }).filter(Boolean); }

  var BULK_ACTS = [["shift", "เลื่อนวัน"], ["dates", "ตั้งวันใหม่"], ["owner", "ผู้รับผิดชอบ"], ["status", "สถานะ"],
                   ["sub", "ประเภท"], ["branches", "สาขา"], ["delete", "ลบ"]];
  function bulkEl() {
    var el = $("ccBulk");
    if (!el) {
      el = document.createElement("div");
      el.id = "ccBulk";
      el.className = "cc-bulk";
      document.body.appendChild(el);
    }
    return el;
  }
  function modeSeg(cur) {
    return '<div class="cc-bseg" data-bmode-grp>' + [["add", "เพิ่มเข้าไป"], ["replace", "แทนที่ทั้งหมด"], ["remove", "เอาออก"]].map(function (m) {
      return '<button type="button" data-bmode="' + m[0] + '" aria-pressed="' + (cur === m[0]) + '">' + m[1] + "</button>";
    }).join("") + "</div>";
  }
  var bulkMode = "add";
  function bulkPanel() {
    var n = sel.length, go = '<button type="button" class="cc-btn primary" data-bgo="1">ใช้กับ ' + n + " รายการ</button>";
    if (bulkAct === "shift") return '<label>เลื่อนทุกรายการ</label><div class="cc-brow">' +
      '<button type="button" class="cc-btn" data-bstep="-7">−7</button><button type="button" class="cc-btn" data-bstep="-1">−1</button>' +
      '<input type="number" id="ccBDays" value="7" step="1" style="width:80px"> <span>วัน</span>' +
      '<button type="button" class="cc-btn" data-bstep="1">+1</button><button type="button" class="cc-btn" data-bstep="7">+7</button>' + go + "</div>" +
      '<div class="cc-hint">บวก = เลื่อนไปข้างหน้า · ลบ = ถอยหลัง · รายการที่มีหลายช่วง/ทำซ้ำ เลื่อนทั้งชุดเท่ากัน</div>';
    if (bulkAct === "dates") return '<label>ตั้งช่วงวันใหม่ให้ทุกรายการ</label><div class="cc-brow">' +
      '<input type="date" id="ccBStart"> <span>ถึง</span> <input type="date" id="ccBEnd">' + go + "</div>" +
      '<div class="cc-hint" id="ccBDateHint">วันสิ้นสุดว่างไว้ = วันเดียว · รายการที่ตั้งหลายช่วง/ทำซ้ำไว้ จะเหลือช่วงนี้ช่วงเดียว</div>';
    if (bulkAct === "owner") return '<label>ผู้รับผิดชอบ</label>' + modeSeg(bulkMode) +
      '<div class="cc-brow"><div class="cc-tagbox" id="ccBOwners" style="flex:1">' + bulkNames.map(function (nm, i) {
        return '<span class="cc-otag">' + esc(nm) + '<button type="button" data-bodel="' + i + '">&times;</button></span>';
      }).join("") + '<input type="text" id="ccBOwnerIn" placeholder="พิมพ์ชื่อแล้วเลือก" autocomplete="off"></div>' + go + "</div>" +
      '<div class="cc-hint">' + (bulkMode === "replace" ? "ทุกรายการจะเหลือแค่คนที่เลือก (ว่างไว้ = ล้างผู้รับผิดชอบ)" : bulkMode === "remove" ? "เอาคนที่เลือกออกจากทุกรายการ" : "เพิ่มคนที่เลือกเข้าไป คนเดิมยังอยู่") + "</div>";
    if (bulkAct === "branches") return '<label>สาขา</label>' + modeSeg(bulkMode) +
      '<div class="cc-brow"><div class="cc-choices" style="flex:1">' + BRANCHES.map(function (b) {
        return '<button type="button" class="cc-choice" data-bbr="' + esc(b) + '" aria-pressed="' + (bulkNames.indexOf(b) !== -1) + '">' + esc(b) + "</button>";
      }).join("") + "</div>" + go + "</div>";
    if (bulkAct === "status") return '<label>เปลี่ยนสถานะเป็น</label><div class="cc-brow">' + ["plan", "live", "done"].map(function (st) {
      return '<button type="button" class="cc-btn" data-bgo="1" data-bval="' + st + '">' + STATUS_LABEL[st] + "</button>";
    }).join("") + "</div>";
    if (bulkAct === "sub") return '<label>เปลี่ยนประเภทเป็น</label><div class="cc-brow cc-bsubs">' + SUBS.map(function (x) {
      return '<button type="button" class="cc-subb" data-bgo="1" data-bval="' + x.k + '"><i style="background:' + x.c + '"></i>' + x.th + "</button>";
    }).join("") + "</div>";
    if (bulkAct === "delete") return '<label>ลบ ' + n + ' รายการนี้ออกจากปฏิทิน?</label><div class="cc-bnames">' + selNames().map(esc).join(" · ") + "</div>" +
      '<div class="cc-brow"><button type="button" class="cc-btn danger" data-bgo="1">ยืนยันลบ ' + n + " รายการ</button>" +
      '<span class="cc-hint" style="margin:0">โพสต์และงานที่ผูกไว้ไม่ถูกลบ แค่ปลดลิงก์</span></div>';
    return "";
  }
  function renderBulkBar() {
    var el = bulkEl();
    document.body.classList.toggle("cc-hasbulk", sel.length > 0);
    if (!sel.length) { el.classList.remove("show"); el.innerHTML = ""; return; }
    el.innerHTML = (bulkAct ? '<div class="cc-bpanel">' + bulkPanel() + "</div>" : "") +
      '<div class="cc-bmain"><b>เลือกอยู่ ' + sel.length + "/" + MAX_SEL + "</b>" +
      BULK_ACTS.map(function (a) {
        return '<button type="button" class="cc-bbtn' + (bulkAct === a[0] ? " on" : "") + (a[0] === "delete" ? " danger" : "") + '" data-bact="' + a[0] + '">' + a[1] + "</button>";
      }).join("") +
      '<button type="button" class="cc-bbtn ghost" data-bclear="1">ยกเลิกเลือก</button></div>';
    el.classList.add("show");
    var oi = $("ccBOwnerIn");
    if (oi) {
      attachPeople(oi, function (name) {
        if (bulkNames.indexOf(name) === -1) bulkNames.push(name);
        renderBulkBar();
        setTimeout(function () { var x = $("ccBOwnerIn"); if (x) x.focus(); }, 0);
      }, function (name) { return bulkNames.indexOf(name) !== -1; });
      oi.addEventListener("keydown", function (e) {
        if (e.key === "Enter") e.preventDefault();
        if (e.key === "Backspace" && !this.value && bulkNames.length) { bulkNames.pop(); renderBulkBar(); }
      });
    }
    var bs = $("ccBStart");
    if (bs) {
      var hint = function () {
        var a = $("ccBStart").value, b = $("ccBEnd").value;
        $("ccBDateHint").textContent = a ? dayTag(a) + (b ? " → " + dayTag(b) : " · วันเดียว") : "วันสิ้นสุดว่างไว้ = วันเดียว · รายการที่ตั้งหลายช่วง/ทำซ้ำไว้ จะเหลือช่วงนี้ช่วงเดียว";
      };
      bs.addEventListener("input", hint); $("ccBEnd").addEventListener("input", hint);
    }
  }
  /* กล่องยืนยันหลังแก้ — บอกชัดว่าแก้อะไรไปกี่รายการ (toast เล็กไป ไม่ชัวร์ว่าเข้าระบบ) */
  function okDialog(title, lines) {
    var d = document.createElement("div");
    d.className = "cc-okdlg";
    d.innerHTML = '<div class="cc-okbox" role="dialog" aria-modal="true"><h3>' + esc(title) + "</h3><ul>" +
      lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + '</ul><button type="button" class="cc-btn primary">ตกลง</button></div>';
    document.body.appendChild(d);
    function close() { d.remove(); document.removeEventListener("keydown", onKey, true); }
    function onKey(e) { if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); close(); } }
    d.addEventListener("click", function (e) { if (e.target === d || e.target.closest("button")) close(); });
    document.addEventListener("keydown", onKey, true);
    d.querySelector("button").focus();
  }
  async function runBulk(val) {
    var body = { ids: sel.slice(), action: bulkAct }, what = "";
    if (bulkAct === "shift") {
      body.days = Math.round(Number($("ccBDays").value) || 0);
      if (!body.days) { toast("ใส่จำนวนวันก่อน"); return; }
      what = (body.days > 0 ? "เลื่อนไปข้างหน้า " : "ถอยหลัง ") + Math.abs(body.days) + " วัน";
    } else if (bulkAct === "dates") {
      body.start = $("ccBStart").value; body.end = $("ccBEnd").value || body.start;
      if (!body.start) { toast("เลือกวันเริ่มก่อน"); return; }
      what = "ตั้งช่วงวันใหม่เป็น " + segText(body.start, body.end);
    } else if (bulkAct === "owner" || bulkAct === "branches") {
      body.mode = bulkMode; body.names = bulkNames.slice();
      if (!body.names.length && bulkMode !== "replace") { toast(bulkAct === "owner" ? "เลือกชื่อก่อน" : "เลือกสาขาก่อน"); return; }
      var lbl = bulkAct === "owner" ? "ผู้รับผิดชอบ" : "สาขา";
      what = bulkMode === "replace" ? lbl + " → " + (body.names.join(", ") || "(ว่าง)") : (bulkMode === "remove" ? "เอา " + body.names.join(", ") + " ออกจาก" + lbl : "เพิ่ม" + lbl + " " + body.names.join(", "));
    } else if (bulkAct === "status") { body.status = val; what = "สถานะ → " + STATUS_LABEL[val]; }
    else if (bulkAct === "sub") { body.sub = val; what = "ประเภท → " + SUB[val].th; }
    else if (bulkAct === "delete") { what = "ลบออกจากปฏิทิน"; }
    var names = selNames();
    try {
      var r = await api("/campaigns/bulk", { method: "POST", body: JSON.stringify(body) });
      clearSel();
      await loadAll();
      render();
      okDialog("แก้ " + r.changed + " รายการแล้ว", [what].concat(names.map(function (n) { return "• " + n; })));
    } catch (e) { toast("แก้ไม่สำเร็จ: " + e.message); }
  }
  document.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest("#ccBulk")) return;
    var t;
    if ((t = e.target.closest("[data-bact]"))) {
      bulkAct = bulkAct === t.dataset.bact ? "" : t.dataset.bact; bulkNames = []; bulkMode = "add";
      renderBulkBar();
      var f = document.querySelector("#ccBulk input"); if (f) f.focus();
      return;
    }
    if (e.target.closest("[data-bclear]")) { clearSel(); render(); return; }
    if ((t = e.target.closest("[data-bmode]"))) { bulkMode = t.dataset.bmode; renderBulkBar(); return; }
    if ((t = e.target.closest("[data-bstep]"))) { var inp = $("ccBDays"); inp.value = (Number(inp.value) || 0) + Number(t.dataset.bstep); return; }
    if ((t = e.target.closest("[data-bbr]"))) {
      var b = t.dataset.bbr, i = bulkNames.indexOf(b);
      if (i === -1) bulkNames.push(b); else bulkNames.splice(i, 1);
      renderBulkBar(); return;
    }
    if ((t = e.target.closest("[data-bodel]"))) { bulkNames.splice(+t.dataset.bodel, 1); renderBulkBar(); return; }
    if ((t = e.target.closest("#ccBOwners"))) { $("ccBOwnerIn").focus(); return; }
    if ((t = e.target.closest("[data-bgo]"))) { runBulk(t.dataset.bval); return; }
  });

  /* บันทึกการแก้ทีละช่อง — API รับก้อนเต็ม เลยรวมของเดิมกับของใหม่ก่อนส่ง */
  async function patchItem(id, fields) {
    var it = byId(id);
    if (!it) return;
    var next = Object.assign({}, it, fields);
    var data = { kind: kindOf(next), sub: subOf(next).k, name: next.name, start: next.start, end: next.end || next.start,
                 scope: next.scope || "range", status: next.status || "plan",
                 channels: next.channels || [], branches: next.branches || [],
                 budget: Number(next.budget) || 0, owner: next.owner || "", note: next.note || "",
                 schedule: next.schedule || null, acc: next.acc || null };
    try {
      if (online) { await api("/campaigns/" + id, { method: "PUT", body: JSON.stringify(data) }); await loadAll(); }
      else { items = items.map(function (x) { return x.id === id ? Object.assign({}, x, data, { id: id }) : x; }); cacheLocal(); }
      render();
    } catch (e) { toast("บันทึกไม่สำเร็จ: " + e.message); render(); }
  }

  /* พิมพ์ชื่อในแถวแล้ว Enter = ได้รายการใหม่ทันที ไม่ต้องเปิดฟอร์ม (แบบ Lark Base) */
  async function quickAdd(name, preset) {
    var start = preset.start || defaultStart();
    var k1 = preset.kind || view.kind || "campaign";
    var data = { kind: k1, sub: preset.sub || SUB_OF_KIND[k1], name: name, start: start,
                 end: preset.end || start, scope: preset.scope === "month" ? "month" : "range",
                 status: preset.status || "plan", channels: [],
                 branches: preset.branch ? [preset.branch] : (view.branch && view.branch !== NO_BRANCH ? [view.branch] : []),
                 budget: 0, owner: "", note: "" };
    if (data.scope === "month") {
      var d0 = parseISO(start);
      data.start = iso(d0.getFullYear(), d0.getMonth(), 1);
      data.end = iso(d0.getFullYear(), d0.getMonth(), daysIn(d0.getFullYear(), d0.getMonth()));
    }
    try {
      if (online) { await api("/campaigns", { method: "POST", body: JSON.stringify(data) }); await loadAll(); }
      else {
        data.id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        data.attachments = [];
        items.push(data);
        cacheLocal();
      }
      render();
      toast(online ? "เพิ่ม “" + name + "” แล้ว — กดที่ช่องเพื่อใส่รายละเอียดต่อ" : "เพิ่มในเครื่องนี้ (ยังไม่ขึ้นเซิร์ฟเวอร์)");
    } catch (e) { toast("เพิ่มไม่สำเร็จ: " + e.message); }
  }

  /* ---- แก้ในช่องตาราง ---- */
  var GRID_EDITABLE = { name: 1, budget: 1 };   /* ผู้รับผิดชอบเลือกจากรายชื่อในฟอร์มเต็ม */
  function editCell(td) {
    if (td.querySelector("input")) return;
    var tr = td.closest("tr"), it = byId(tr.dataset.gid);
    if (!it) return;
    var field = td.dataset.cell;
    var cur = field === "budget" ? (it.budget || "") : (it[field] || "");
    var old = td.innerHTML;
    td.innerHTML = '<input class="cc-gin" type="' + (field === "budget" ? "number" : "text") + '" value="' + esc(String(cur)) + '">';
    var inp = td.querySelector("input");
    inp.focus();
    inp.select();
    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      var v = inp.value;
      if (!save) { td.innerHTML = old; return; }
      if (field === "name" && !String(v).trim()) { td.innerHTML = old; toast("ชื่อว่างไม่ได้"); return; }
      td.innerHTML = old;
      patchItem(it.id, field === "budget" ? { budget: Number(v) || 0 } : (field === "name" ? { name: String(v).trim() } : { owner: String(v).trim() }));
    }
    /* เลือกชื่อจากรายการ = บันทึกเลย ไม่ต้องกด Enter ซ้ำ */
    if (field === "owner") { attachPeople(inp, function () { finish(true); }); inp.dispatchEvent(new Event("focus")); }
    inp.addEventListener("blur", function () { finish(true); });
    inp.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); finish(true); }
      else if (ev.key === "Escape") { ev.preventDefault(); finish(false); }
    });
  }
  /* เมนูเล็กในช่อง (สถานะ / ประเภท) — ใช้ชั้นลอยเดียวกับที่อื่นไม่ได้ เลยทำเองแบบง่าย */
  function pickCell(td, opts, cur, onPick) {
    closePick();
    var r = td.getBoundingClientRect();
    var d = document.createElement("div");
    d.className = "cc-gpick";
    d.innerHTML = opts.map(function (o) {
      return '<button type="button"' + (o[0] === cur ? ' class="on"' : "") + ' data-pv="' + esc(o[0]) + '">' + o[1] + "</button>";
    }).join("");
    document.body.appendChild(d);
    d.style.left = Math.max(6, Math.min(r.left, window.innerWidth - d.offsetWidth - 8)) + "px";
    d.style.top = (r.bottom + d.offsetHeight > window.innerHeight - 8 ? Math.max(8, r.top - d.offsetHeight) : r.bottom + 2) + "px";
    d.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-pv]");
      if (!b) return;
      ev.stopPropagation();
      closePick();
      onPick(b.dataset.pv);
    });
  }
  function closePick() {
    var old = document.querySelector(".cc-gpick");
    if (old) old.remove();
  }
  document.addEventListener("mousedown", function (ev) {
    if (!ev.target.closest || !ev.target.closest(".cc-gpick")) closePick();
  }, true);
  /* ปุ่ม + ท้ายกลุ่ม → กลายเป็นช่องพิมพ์ชื่อตรงนั้น Enter = ได้แถวใหม่ Esc = ยกเลิก
     กด Tab หรือปุ่ม "รายละเอียด" = เปิดฟอร์มเต็มโดยยังเติมค่าของกลุ่มให้ */
  function startQuickAdd(btn, preset) {
    var host = btn.parentNode;
    if (host.querySelector(".cc-gin")) return;
    var old = host.innerHTML;
    host.innerHTML = '<span class="cc-gaddrow"><input class="cc-gin" placeholder="พิมพ์ชื่อแล้วกด Enter" maxlength="200">' +
      '<button type="button" class="cc-gaddmore">รายละเอียดเพิ่ม…</button></span>';
    var inp = host.querySelector("input");
    inp.focus();
    var done = false;
    function close() { if (!done) { done = true; host.innerHTML = old; } }
    host.querySelector(".cc-gaddmore").addEventListener("mousedown", function (ev) {
      ev.preventDefault();
      done = true;
      var nm = inp.value.trim();
      host.innerHTML = old;
      openDrawer(null, preset.start || defaultStart(), preset.scope === "month" ? "month" : "range", preset);
      if (nm) $("cc-name").value = nm;
    });
    inp.addEventListener("blur", function () { setTimeout(close, 120); });
    inp.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        var nm = inp.value.trim();
        if (!nm) { close(); return; }
        done = true;
        quickAdd(nm, preset);
      } else if (ev.key === "Escape") { ev.preventDefault(); close(); }
    });
  }

  /* เดือนนี้ "สาขาไหนทำอะไร" */
  function renderBranchBoard(list) {
    if (!list.length) return "";
    var cols = (view.branch && view.branch !== NO_BRANCH ? [view.branch] : BRANCHES).map(function (b) {
      var mine = list.filter(function (it) { return (it.branches || []).indexOf(b) !== -1; });
      var body = mine.length
        ? mine.map(function (it) {
            return '<button class="cc-bitem" data-edit="' + it.id + '"' + chipStyle(it) + ">" +
                   "<b>" + esc(shortName(it.name)) + "</b>" +
                   '<span class="cc-bmeta">' + fmtRange(it) + (it.budget ? " · ฿ " + baht(it.budget) : "") + "</span>" +
                   "</button>";
          }).join("")
        : '<div class="cc-bempty">ยังไม่มีแผน</div>';
      return '<div class="cc-bcol"><h4>' + esc(b) + "<span>" + (mine.length || "") + "</span></h4>" + body + "</div>";
    }).join("");
    var noBranch = list.filter(function (it) { return !it.branches || !it.branches.length; });
    var extra = noBranch.length
      ? '<div class="cc-bcol"><h4>ยังไม่ระบุสาขา<span>' + noBranch.length + "</span></h4>" +
        noBranch.map(function (it) {
          return '<button class="cc-bitem" data-edit="' + it.id + '"' + chipStyle(it) + "><b>" + esc(shortName(it.name)) + "</b>" +
                 '<span class="cc-bmeta">' + fmtRange(it) + "</span></button>";
        }).join("") + "</div>"
      : "";
    return '<div class="cc-board"><h3>เดือนนี้ แต่ละสาขาทำอะไร</h3><div class="cc-bgrid">' + cols + extra + "</div></div>";
  }

  function renderList() {
    var list = view.mode === "month" ? ofMonth(view.month) : ofYear();
    var what = view.kind ? KIND_LABEL[view.kind] : "รายการ";
    var title = (view.mode === "month" ? what + "เดือน" + MONTHS[view.month] : what + "ทั้งปี " + be(year)) +
      (view.branch ? " · " + branchLabel() : "");
    if (!list.length) {
      $("ccList").innerHTML = "<h3>" + title + "</h3>" +
        '<div class="cc-empty"><p>ยังไม่มี' + what + 'ในช่วงนี้</p>' +
        '<button class="cc-btn primary" data-new="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>เพิ่ม' + what + "</button></div>";
      return;
    }
    var rows = list.map(function (it) {
      var atts = it.attachments || [];
      var thumbs = atts.length
        ? '<div class="cc-thumbs">' + atts.slice(0, 4).map(function (a) {
            return '<img src="' + API + "/attachments/" + a.id + '?s=thumb" alt="' + esc(a.fileName) + '" loading="lazy" decoding="async">';
          }).join("") + (atts.length > 4 ? '<span class="cc-more">+' + (atts.length - 4) + "</span>" : "") + "</div>"
        : "";
      return '<tr style="border-left:3px solid ' + colorOf(it) + '">' +
        '<td class="dt">' + fmtRange(it) + "</td>" +
        '<td>' + kindPill(it) + "</td>" +
        '<td class="nm">' + esc(it.name) + linkLine(it) +
          (it.note ? '<div class="cc-note">' + esc(it.note) + "</div>" : "") + thumbs + "</td>" +
        '<td><span class="cc-pill ' + it.status + '">' + STATUS_LABEL[it.status] + "</span></td>" +
        '<td><div class="cc-tags">' + (it.channels || []).map(function (c) { return '<span class="cc-tag">' + esc(c) + "</span>"; }).join("") + "</div></td>" +
        '<td><div class="cc-tags">' + (it.branches || []).map(function (b) { return '<span class="cc-tag">' + esc(b) + "</span>"; }).join("") + "</div></td>" +
        '<td class="dt">' + (it.budget ? "฿ " + baht(it.budget) : "—") + "</td>" +
        "<td>" + (it.owner ? esc(it.owner) : "—") + "</td>" +
        '<td style="text-align:right"><button class="cc-icon" data-edit="' + it.id + '" aria-label="แก้ไข">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></button></td>' +
        "</tr>";
    }).join("");
    $("ccList").innerHTML = "<h3>" + title + "</h3>" +
      '<div class="cc-tablewrap"><table class="cc-table"><thead><tr>' +
      "<th>ช่วงวัน</th><th>ประเภท</th><th>ชื่อ</th><th>สถานะ</th><th>ช่องทาง</th><th>สาขา</th><th>งบ</th><th>ผู้รับผิดชอบ</th><th></th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>";
  }


  /* ---------- แถบเลือกประเภท (กรองทุกมุมมองพร้อมกัน) ---------- */
  function renderKindBar() {
    var el = $("ccKindBar");
    if (!el) return;
    var counts = { "": items.length };
    KINDS.forEach(function (k) { counts[k] = items.filter(function (it) { return kindOf(it) === k; }).length; });
    el.innerHTML = '<span class="cc-kindlbl">ดูเฉพาะ</span>' +
      [["", "ทั้งหมด"]].concat(KINDS.map(function (k) { return [k, KIND_LABEL[k]]; })).map(function (p) {
        var on = view.kind === p[0];
        var c = p[0] ? KIND_COLOR[p[0]] : "";
        return '<button type="button" class="cc-kind' + (on ? " on" : "") + '" data-kind="' + p[0] + '"' +
          (c ? ' style="--kc:' + c + '"' : "") + ">" + (c ? '<i class="cc-kdot" style="background:' + c + '"></i>' : "") +
          p[1] + '<span class="cc-kn">' + (counts[p[0]] || 0) + "</span></button>";
      }).join("");
  }

  /* แถวเลือกสาขา — บางงานอยู่ในสาขา บางงานไม่อยู่สาขาไหนเลย (on tour) เลยต้องแยกดูได้ */
  function renderBranchBar() {
    var el = $("ccBranchBar");
    if (!el) return;
    var base = view.kind ? items.filter(function (it) { return kindOf(it) === view.kind; }) : items;
    var opts = [["", "ทุกสาขา", base.length]].concat(allBranches().map(function (b) {
      return [b, b, base.filter(function (it) { return inBranch(it, b); }).length];
    }));
    var none = base.filter(function (it) { return inBranch(it, NO_BRANCH); }).length;
    if (none || view.branch === NO_BRANCH) opts.push([NO_BRANCH, "ยังไม่ระบุสาขา", none]);
    el.innerHTML = '<span class="cc-kindlbl">สาขา</span>' + opts.map(function (p) {
      return '<button type="button" class="cc-kind' + (view.branch === p[0] ? " on" : "") + '" data-branch="' + esc(p[0]) + '">' +
        esc(p[1]) + '<span class="cc-kn">' + p[2] + "</span></button>";
    }).join("");
  }

  /* ---------- ใต้ช่องวันที่ทุกช่องบอก W กับชื่อวัน — "W2 · วันพุธ" (นนท์: เลือกวันแล้วต้องเห็น W เสมอ) ---------- */
  function hintFor(inp) {
    var h = inp.parentNode.querySelector(".cc-dayhint");
    if (!h) return;
    var v = inp.value;
    h.classList.remove("bad");
    if (inp.classList.contains("cc-re")) {
      var row = inp.closest(".cc-range"), s0 = row.querySelector(".cc-rs").value;
      if (!v) { h.textContent = s0 ? "ว่างไว้ = วันเดียว" : ""; return; }
      var n = s0 ? Math.round((parseISO(v) - parseISO(s0)) / 864e5) + 1 : 0;
      h.textContent = dayTag(v) + (n > 1 ? " · รวม " + n + " วัน" : "") + (s0 && n < 1 ? " · ก่อนวันเริ่ม" : "");
      h.classList.toggle("bad", !!s0 && n < 1);
      return;
    }
    h.textContent = v ? dayTag(v) : "";
  }
  function allHints() {
    Array.prototype.forEach.call(document.querySelectorAll("#ccDrawer input[type=date]"), hintFor);
    repHint();
  }
  ["input", "change"].forEach(function (evt) {
    $("ccForm").addEventListener(evt, function (e) {
      if (e.target.matches && e.target.matches("input[type=date]")) {
        hintFor(e.target);
        var row = e.target.closest(".cc-range");
        if (row) hintFor(row.querySelector(".cc-re"));
        repHint();
      }
      if (e.target.id === "cc-acc") applyAccUI();
      if (e.target.id === "cc-untilm" || e.target.id === "cc-month") repHint();
    });
  });

  /* ---------- ช่วงวันหลายช่วง ---------- */
  function rangeRow(s0, e0) {
    return '<div class="cc-range">' +
      '<div class="cc-field"><label>วันเริ่ม</label><input type="date" class="cc-rs" value="' + esc(s0 || "") + '"><div class="cc-dayhint"></div></div>' +
      '<div class="cc-field cc-re-f"><label>วันสิ้นสุด</label><input type="date" class="cc-re" value="' + esc(e0 && e0 !== s0 ? e0 : "") + '"><div class="cc-dayhint"></div></div>' +
      '<button type="button" class="cc-icon cc-rdel" aria-label="ลบช่วงนี้" title="ลบช่วงนี้">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>';
  }
  function setRanges(list) {
    $("ccRanges").innerHTML = list.map(function (r) { return rangeRow(r.s, r.e); }).join("");
  }
  function getRanges() {
    return Array.prototype.map.call(document.querySelectorAll("#ccRanges .cc-range"), function (row) {
      var s0 = row.querySelector(".cc-rs").value, e0 = row.querySelector(".cc-re").value;
      return { s: s0, e: e0 || s0 };
    }).filter(function (r) { return r.s; });
  }
  var DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
  $("cc-dows").innerHTML = DOW_ORDER.map(function (d) {
    return '<button type="button" data-dow="' + d + '" aria-pressed="false">' + DOW[d] + "</button>";
  }).join("");
  function setDows(days) {
    Array.prototype.forEach.call(document.querySelectorAll("#cc-dows [data-dow]"), function (b) {
      b.setAttribute("aria-pressed", String((days || []).indexOf(+b.dataset.dow) !== -1));
    });
  }
  function getDows() {
    return Array.prototype.filter.call(document.querySelectorAll("#cc-dows [data-dow]"), function (b) {
      return b.getAttribute("aria-pressed") === "true";
    }).map(function (b) { return +b.dataset.dow; });
  }
  function applyRepUI() {
    var t = getSeg("#cc-rep", "none"), isM = getSeg("#cc-scope", "range") === "month";
    $("ccRangeFields").classList.toggle("weekly", t === "weekly");
    $("ccRepWeekly").style.display = t === "weekly" ? "" : "none";
    $("ccRepUntil").style.display = t === "none" || isM ? "none" : "";
    $("ccRepUntilM").style.display = t === "monthly" && isM ? "" : "none";
    if (isM && t === "monthly" && !$("cc-untilm").value) {
      /* ตั้งต้น: ทำซ้ำถึงธันวาคมของปีนั้น */
      var mv0 = $("cc-month").value;
      if (mv0) $("cc-untilm").value = mv0.slice(0, 4) + "-12";
    }
    var lbl = document.querySelector("#ccRanges .cc-range .cc-field label");
    if (lbl) lbl.textContent = t === "weekly" ? "เริ่มตั้งแต่วันที่" : "วันเริ่ม";
    if (t !== "none" && !$("cc-until").value) {
      /* ตั้งต้นให้ทำซ้ำถึงสิ้นปีของวันเริ่ม */
      var r0 = getRanges()[0];
      if (r0) $("cc-until").value = r0.s.slice(0, 4) + "-12-31";
    }
    allHints();
  }
  function repHint() {
    var el = $("ccRepHint");
    if (!el) return;
    if (getSeg("#cc-scope", "range") === "month") {
      var mv1 = $("cc-month").value, um = $("cc-untilm").value;
      if (getSeg("#cc-rep", "none") !== "monthly" || !mv1 || !um) { el.textContent = ""; return; }
      var n1 = (+um.slice(0, 4) - +mv1.slice(0, 4)) * 12 + (+um.slice(5, 7) - +mv1.slice(5, 7)) + 1;
      el.textContent = n1 < 1 ? "เดือนสุดท้ายต้องไม่มาก่อนเดือนเริ่ม"
        : "ทำซ้ำ: ทั้งเดือน ทุกเดือน · " + MONTHS_SHORT[+mv1.slice(5, 7) - 1] + " – " + MONTHS_SHORT[+um.slice(5, 7) - 1] + " · รวม " + n1 + " เดือน";
      return;
    }
    var t = getSeg("#cc-rep", "none"), r = getRanges();
    if (t === "none") { el.textContent = r.length > 1 ? "ปฏิทินจะแสดงเฉพาะวันที่เลือก " + r.length + " ช่วง ไม่ลากยาวทั้งเดือน" : ""; return; }
    var fake = { id: "_", start: r[0] ? r[0].s : "", scope: "range",
                 schedule: { ranges: r, rep: { type: t, days: getDows(), until: $("cc-until").value } } };
    if (!r.length || !$("cc-until").value) { el.textContent = ""; return; }
    if (t === "weekly" && !getDows().length) { el.textContent = "เลือกวันในสัปดาห์ก่อน"; return; }
    var n = occ(fake).length;
    el.textContent = "ทำซ้ำ: " + schedText(fake) + " · รวม " + n + " รอบ";
  }

  /* ---------- ผู้รับผิดชอบ: พิมพ์แล้วขึ้นชื่อทีมให้เลือก ----------
     รายชื่อชุดเดียวกับหน้าล็อกอินระบบงานทีม (GET /api/t/login) · ยังพิมพ์ชื่อนอกรายชื่อได้ (ทีมภายนอก/เอเจนซี) */
  var peopleP = null;
  function loadPeople() {
    if (!peopleP) {
      peopleP = fetch("/api/t/login", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : { staff: [] }; })
        .then(function (d) {
          return (d.staff || []).map(function (p) { return { name: p.name, alias: p.aliases || "" }; });
        })
        .catch(function () { peopleP = null; return []; });
    }
    return peopleP;
  }
  var peopleBox = null;
  function attachPeople(inp, onPick, exclude) {
    if (!inp || inp.dataset.people) return;
    inp.dataset.people = "1";
    inp.setAttribute("autocomplete", "off");
    var list = [], hi = 0;
    function box() {
      if (!peopleBox) {
        peopleBox = document.createElement("div");
        peopleBox.className = "cc-people";
        peopleBox.setAttribute("role", "listbox");
        /* mousedown แทน click — ไม่งั้นช่องโดน blur ก่อน (ช่องในตารางจะบันทึกแล้วปิดไปเลย) */
        peopleBox.addEventListener("mousedown", function (e) {
          var btn = e.target.closest("[data-i]");
          if (!btn || !peopleBox.pick) return;
          e.preventDefault();
          peopleBox.pick(+btn.dataset.i);
        });
        document.body.appendChild(peopleBox);
        /* กล่องลอยแบบ fixed — ลิ้นชักฟอร์มเลื่อนแล้วกล่องจะค้างผิดที่ ปิดไปเลยดีกว่า */
        document.addEventListener("scroll", function (e) {
          if (peopleBox.style.display !== "none" && !peopleBox.contains(e.target)) peopleBox.style.display = "none";
        }, true);
      }
      return peopleBox;
    }
    function close() { if (peopleBox) peopleBox.style.display = "none"; list = []; }
    function pick(name) {
      inp.value = name;
      close();
      if (onPick) onPick(name);
    }
    function show() {
      loadPeople().then(function (all) {
        if (document.activeElement !== inp) return;
        var q = inp.value.trim().toLowerCase();
        list = all.filter(function (p) {
          if (exclude && exclude(p.name)) return false;
          return !q || p.name.toLowerCase().indexOf(q) !== -1 || p.alias.toLowerCase().indexOf(q) !== -1;
        }).slice(0, 8);
        if (!list.length || (list.length === 1 && list[0].name === inp.value.trim())) { close(); return; }
        hi = Math.min(hi, list.length - 1);
        var b = box(), r = inp.getBoundingClientRect();
        b.innerHTML = list.map(function (p, i) {
          return '<button type="button" role="option" class="cc-people-i' + (i === hi ? " on" : "") + '" data-i="' + i + '">' +
            '<span class="cc-people-av">' + esc(p.name.charAt(0)) + "</span>" + esc(p.name) +
            (p.alias ? "<small>" + esc(p.alias) + "</small>" : "") + "</button>";
        }).join("");
        b.pick = function (i) { if (list[i]) pick(list[i].name); };
        b.style.display = "block";
        b.style.left = Math.round(r.left) + "px";
        b.style.width = Math.max(r.width, 200) + "px";
        var below = window.innerHeight - r.bottom;
        b.style.top = (below < 240 && r.top > below ? Math.round(r.top - b.offsetHeight - 4) : Math.round(r.bottom + 4)) + "px";
      });
    }
    inp.addEventListener("focus", function () { hi = 0; show(); });
    inp.addEventListener("input", function () { hi = 0; show(); });
    inp.addEventListener("blur", function () { setTimeout(close, 120); });
    inp.addEventListener("keydown", function (e) {
      if (!list.length || !peopleBox || peopleBox.style.display === "none") return;
      if (e.key === "ArrowDown") { e.preventDefault(); hi = (hi + 1) % list.length; show(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); hi = (hi - 1 + list.length) % list.length; show(); }
      else if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); pick(list[hi].name); }
      else if (e.key === "Escape") { e.stopImmediatePropagation(); close(); }
    }, true);
  }
  /* ผู้รับผิดชอบ = ติ๊กจากรายชื่อคนที่ลงทะเบียนในระบบ เลือกได้หลายคน (เดิมพิมพ์ชื่อเอง)
     ชื่อเก่าที่ไม่อยู่ในรายชื่อ (เอเจนซี/คนนอก) ยังโชว์เป็นตัวเลือกที่ติ๊กไว้ ไม่หายไปเอง */
  var owners = [];
  function splitOwners(s0) { return String(s0 || "").split(/\s*,\s*/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function drawOwners() {
    $("cc-owner-tags").innerHTML = owners.map(function (n, i) {
      return '<span class="cc-otag">' + esc(n) + '<button type="button" data-odel="' + i + '" aria-label="เอา ' + esc(n) + ' ออก">&times;</button></span>';
    }).join("");
    $("cc-owner-in").placeholder = owners.length ? "เพิ่มอีกคน…" : "พิมพ์ชื่อแล้วเลือก";
  }
  function renderOwners(current) { owners = splitOwners(current); $("cc-owner-in").value = ""; drawOwners(); }
  /* เลือกได้เฉพาะชื่อที่มีบัญชีในระบบ — พิมพ์แล้วขึ้นรายชื่อให้กด (ชื่อที่เลือกไปแล้วไม่ขึ้นซ้ำ) */
  attachPeople($("cc-owner-in"), function (name) {
    if (owners.indexOf(name) === -1) owners.push(name);
    $("cc-owner-in").value = "";
    drawOwners();
    setTimeout(function () { $("cc-owner-in").focus(); }, 0);
  }, function (name) { return owners.indexOf(name) !== -1; });
  $("cc-owner-in").addEventListener("keydown", function (e) {
    /* Enter ในช่องนี้ห้ามไปกดบันทึกทั้งฟอร์ม · Backspace ในช่องว่าง = ลบคนสุดท้าย */
    if (e.key === "Enter") e.preventDefault();
    if (e.key === "Backspace" && !this.value && owners.length) { owners.pop(); drawOwners(); }
  });
  $("cc-owners").addEventListener("click", function (e) {
    var d = e.target.closest("[data-odel]");
    if (d) { owners.splice(+d.dataset.odel, 1); drawOwners(); return; }
    $("cc-owner-in").focus();
  });

  /* ---------- วันนี้ / สัปดาห์นี้ ใต้ปฏิทิน — ตอบคำถาม "วันนี้ต้องทำอะไร" โดยไม่ต้องไล่ทั้งปี ---------- */
  /* "สัปดาห์นี้" = W ของวันนี้ (1–9 · 10–16 · 17–23 · 24–สิ้นเดือน) ไม่ใช่ จันทร์–อาทิตย์ */
  function weekRange() {
    var t = new Date();
    var x = wInfo(isoOf(t));
    return wRange(x.y, x.m, x.w);
  }
  function overlaps(it, a, b) { return occ(it).some(function (g) { return g[0] <= b && g[1] >= a; }); }
  function soonRow(it, inBr) {
    var others = (it.branches || []).filter(function (b) { return b !== inBr; });
    var a0 = (it.attachments || [])[0];
    return '<button type="button" class="cc-soon-item" data-edit="' + it.id + '" style="border-left-color:' + colorOf(it) + '">' +
      (a0 ? '<img src="' + API + "/attachments/" + a0.id + '?s=thumb" alt="" loading="lazy" decoding="async">' : '<span class="cc-soon-noimg" style="background:' + tint(colorOf(it), 0.18) + '"></span>') +
      '<span class="cc-soon-text"><span class="cc-soon-top">' + kindPill(it) + '<span class="cc-pill ' + it.status + '">' + STATUS_LABEL[it.status] + "</span></span>" +
      "<b>" + esc(it.name) + "</b>" + linkLine(it) +
      '<span class="cc-soon-meta">' + fmtRange(it) +
      (others.length ? " · " + (inBr ? "+ " : "") + others.map(esc).join(", ") : "") +
      (it.channels && it.channels.length ? " · " + it.channels.map(esc).join(", ") : "") + "</span></span></button>";
  }
  /* แยกตามสาขา — หน้าร้านแต่ละสาขาอยากรู้แค่ "สาขาฉันวันนี้มีอะไร" · งานหลายสาขาโผล่ทุกสาขาที่เกี่ยว
     ตัวเลขบนหัวกล่องยังนับรายการไม่ซ้ำ ส่วนตัวเลขหัวสาขานับเฉพาะสาขานั้น */
  function soonByBranch(arr) {
    var order = (view.branch && view.branch !== NO_BRANCH) ? [view.branch] : BRANCHES.slice();
    arr.forEach(function (it) {   /* สาขาเก่าที่ตัดออกแล้ว (เช่น นคร) ยังต้องมีที่อยู่ ไม่งั้นรายการหาย */
      (it.branches || []).forEach(function (b) { if (!view.branch && order.indexOf(b) === -1) order.push(b); });
    });
    var groups = order.map(function (b) {
      return [b, arr.filter(function (it) { return (it.branches || []).indexOf(b) !== -1; })];
    });
    groups.push(["ยังไม่ระบุสาขา", arr.filter(function (it) { return !it.branches || !it.branches.length; })]);
    return groups.filter(function (g) { return g[1].length; }).map(function (g) {
      return '<div class="cc-soon-br"><div class="cc-soon-brh">' + esc(g[0]) + "<span>" + g[1].length + "</span></div>" +
        '<div class="cc-soon-list">' + g[1].map(function (it) { return soonRow(it, g[0]); }).join("") + "</div></div>";
    }).join("");
  }
  function renderSoon() {
    var el = $("ccSoon");
    if (!el) return;
    var t = todayISO(), wk = weekRange(), list = pool();
    var today = list.filter(function (it) { return covers(it, t); });
    var week = list.filter(function (it) { return overlaps(it, wk[0], wk[1]) && !covers(it, t); });
    var what = view.kind ? KIND_LABEL[view.kind] : "รายการ";
    var block = function (title, sub, arr, emptyMsg) {
      return '<div class="cc-soon-block"><div class="cc-soon-head"><h3>' + title + "</h3><span>" + sub + "</span>" +
        '<b class="cc-soon-n">' + arr.length + "</b></div>" +
        (arr.length ? soonByBranch(arr) : '<div class="cc-soon-empty">' + emptyMsg + "</div>") + "</div>";
    };
    var td = parseISO(t), wa = parseISO(wk[0]), wb = parseISO(wk[1]);
    el.innerHTML = '<div class="cc-soon-grid">' +
      block("วันนี้", td.getDate() + " " + MONTHS[td.getMonth()], today, "ไม่มี" + what + "ที่วิ่งอยู่วันนี้") +
      block("สัปดาห์นี้ (" + wTag(wk[0]) + ")", wa.getDate() + " – " + wb.getDate() + " " + MONTHS[wb.getMonth()], week, "ไม่มี" + what + "อื่นในสัปดาห์นี้") +
      "</div>";
  }

  /* ---------- การ์ดลอยตอนเอาเมาส์ค้าง ---------- */
  var hoverEl = null, hoverTimer = null, touchTimer = null;

  function hoverCard() {
    if (!hoverEl) {
      hoverEl = document.createElement("div");
      hoverEl.className = "cc-hover";
      /* เมาส์อยู่ในการ์ด = อ่านอยู่ ห้ามหาย (เลื่อนดูในการ์ดก็ได้) · ออกจากการ์ดค่อยปิดช้า ๆ */
      hoverEl.addEventListener("mouseenter", function () { overCard = true; keepHover(); });
      hoverEl.addEventListener("mouseleave", function () { overCard = false; if (!pinned) hideHover(500); });
      document.body.appendChild(hoverEl);
    }
    return hoverEl;
  }

  function showHover(list, anchor, dayISO) {
    hoverCard().classList.toggle("list", list.length > 1);
    var el = hoverCard();
    var head = "";
    if (dayISO) {
      var dt = parseISO(dayISO);
      head = '<div class="cc-hover-day">' + dt.getDate() + " " + MONTHS[dt.getMonth()] + " " + be(dt.getFullYear()) +
             (list.length > 1 ? '<span>' + list.length + " รายการ</span>" : "") + "</div>";
    }

    var body;
    if (list.length === 1) {
      var it = list[0];
      var atts = it.attachments || [];
      var pics = atts.length
        ? '<div class="cc-hover-pics">' + atts.slice(0, 3).map(function (a) {
            return '<img src="' + API + "/attachments/" + a.id + '?s=thumb" alt="" decoding="async">';
          }).join("") + "</div>"
        : "";
      body = '<div class="cc-hover-bar" style="background:' + colorOf(it) + '"></div>' + pics +
        '<div class="cc-hover-body">' + head +
          '<div class="cc-hover-top"><span class="cc-pill ' + it.status + '">' + STATUS_LABEL[it.status] + "</span>" +
          (it.budget ? '<span class="cc-hover-budget">฿ ' + baht(it.budget) + "</span>" : "") + "</div>" +
          "<b>" + esc(it.name) + "</b>" +
          '<div class="cc-hover-date">' + fullRange(it) + "</div>" +
          (it.branches && it.branches.length ? '<div class="cc-hover-meta">' + it.branches.map(esc).join(" · ") + "</div>" : "") +
          (it.owner ? '<div class="cc-hover-meta">ผู้รับผิดชอบ: ' + esc(it.owner) + "</div>" : "") +
          (it.acc && it.acc.need ? '<div class="cc-hover-meta">ฝ่ายบัญชี: ตั้งค่า' + (it.acc.type === "coupon" ? "คูปอง" : "โปรโมชั่น") + "ในระบบ" +
            (it.acc.taskId ? ' · <a href="' + TASKS_BASE + '#/task/' + esc(it.acc.taskId) + '">เปิดงาน</a>' : "") + "</div>" : "") +
          /* สถานะงานขึ้นก่อน รายละเอียดย่อไว้ 2 บรรทัด (นนท์: รายละเอียดไม่จำเป็น อยากเห็นสถานะ) */
          statusBlock(it) +
          (it.note ? '<div class="cc-hover-note clamp">' + esc(it.note.replace(/^\[[^\]]*\]\s*/, "")) + "</div>" : "") +
          (linkLine(it) ? '<div class="cc-hover-meta">' + linkLine(it) + "</div>" : "") +
          '<div class="cc-hover-acts"><button type="button" class="cc-hover-btn" data-detail="' + it.id + '">ดูรายละเอียด</button>' +
          '<button type="button" class="cc-hover-btn ghost" data-edit="' + it.id + '">แก้ไขรายละเอียด</button>' +
          '<button type="button" class="cc-hover-btn ghost" data-dup="' + it.id + '" title="ก๊อปอันนี้เป็นรายการใหม่">ทำสำเนา</button></div>' +
        "</div>";
    } else {
      // หลายแคมเปญในวันเดียว — โชว์เป็นรายการ กดเลือกได้
      body = '<div class="cc-hover-body">' + head +
        list.map(function (it) {
          var a0 = (it.attachments || [])[0];
          return '<button type="button" class="cc-hover-item" data-open="' + it.id + '">' +
                 '<span class="cc-hover-dot" style="background:' + colorOf(it) + '"></span>' +
                 (a0 ? '<img src="' + API + "/attachments/" + a0.id + '?s=thumb" alt="" decoding="async">' : "") +
                 '<span class="cc-hover-itemtext"><b>' + esc(shortName(it.name)) + "</b>" +
                 '<span class="cc-hover-meta">' + fmtRange(it) +
                 (it.branches && it.branches.length ? " · " + it.branches.map(esc).join(" · ") : "") + "</span>" +
                 (statusBrief(it) ? '<span class="cc-hover-meta">' + statusBrief(it) + "</span>" : "") + "</span>" +
                 '<span class="cc-pill ' + it.status + '">' + STATUS_LABEL[it.status] + "</span>" +
                 "</button>";
        }).join("") + "</div>";
    }
    el.innerHTML = body;
    el.classList.add("show");

    var r = anchor.getBoundingClientRect();
    el.style.visibility = "hidden";
    el.style.left = "0px";
    el.style.top = "0px";
    var w = el.offsetWidth, h = el.offsetHeight;
    var left = Math.min(Math.max(8, r.left - 8), window.innerWidth - w - 8);
    /* วางใต้แถบก่อน (เมาส์เลื่อนลงไปอ่านต่อได้เลย) ถ้าล่างไม่พอค่อยขึ้นบน · ชิดแถบ 4px ไม่ให้เมาส์หลุดกลางทาง */
    var top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = r.top - h - 4;
    if (top < 8) top = Math.max(8, window.innerHeight - h - 8);
    el.style.left = left + "px";
    el.style.top = Math.max(8, top) + "px";
    el.style.visibility = "";
  }

  var closeTimer = null;
  var overCard = false;
  var pinned = false;   /* กดแถบ = การ์ดค้างไว้จนกว่าจะกดที่อื่น (นนท์: เมาส์ค้างแล้วยังไม่ทันกดมันหาย) */
  function hideHover(delay, force) {
    clearTimeout(hoverTimer);
    clearTimeout(closeTimer);
    if (!hoverEl) return;
    if ((pinned || overCard) && !force) return;
    if (force) pinned = false;
    if (delay) closeTimer = setTimeout(function () { hoverEl.classList.remove("show"); }, delay);
    else hoverEl.classList.remove("show");
  }
  function keepHover() { clearTimeout(closeTimer); }

  function peekTargets(el) {
    if (el.dataset.daypeek) {
      var day = el.dataset.daypeek;
      var list = items.filter(function (it) { return covers(it, day); });
      return list.length ? { list: list, day: day } : null;
    }
    if (el.dataset.edit || el.dataset.open) {
      var it = byId(el.dataset.edit || el.dataset.open);
      return it ? { list: [it], day: null } : null;
    }
    return null;
  }

  /* กล่องขยายความของป้ายเล็ก ๆ บนแถบ (data-tip) — ขึ้นทันทีเมื่อเมาส์ค้าง */
  var tipEl = null;
  function showTip(el) {
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "cc-tip"; document.body.appendChild(tipEl); }
    tipEl.textContent = el.getAttribute("data-tip");
    tipEl.classList.add("show");
    var r = el.getBoundingClientRect();
    tipEl.style.left = "0px"; tipEl.style.top = "0px";
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var top = r.bottom + 6; if (top + h > window.innerHeight - 8) top = r.top - h - 6;
    tipEl.style.left = left + "px"; tipEl.style.top = top + "px";
  }
  function hideTip() { if (tipEl) tipEl.classList.remove("show"); }
  document.addEventListener("mouseover", function (e) {
    var tp = e.target.closest("[data-tip]");
    if (tp) showTip(tp); else hideTip();
  });
  document.addEventListener("mouseover", function (e) {
    var t = e.target.closest("[data-edit],[data-open],[data-daypeek]");
    if (!t) return;
    if (t.closest(".cc-hover")) { keepHover(); return; }   // อยู่ในการ์ดเอง อย่าปิด
    if (pinned) return;                                     // ปักไว้ ไม่สลับตามเมาส์
    if (selMode && t.closest(".cc-bar")) return;           // โหมดเลือกหลายรายการ ไม่เด้งการ์ด
    var found = peekTargets(t);
    if (!found) return;
    clearTimeout(hoverTimer);
    keepHover();
    hoverTimer = setTimeout(function () { showHover(found.list, t, found.day); }, 220);
  });
  document.addEventListener("mouseout", function (e) {
    if (e.target.closest(".cc-hover")) return;
    if (e.target.closest("[data-edit],[data-open],[data-daypeek]")) hideHover(700);
  });
  /* เลื่อนในการ์ดเอง หรือเลื่อนหน้าขณะเมาส์อยู่บนการ์ด ไม่ปิด · เลื่อนหน้าตอนอื่นค่อยปิด */
  document.addEventListener("scroll", function (e) {
    if (pinned || overCard) return;
    if (e.target && e.target.closest && e.target.closest(".cc-hover")) return;
    hideHover();
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && pinned) hideHover(0, true); });

  /* มือถือ: แตะค้าง 450ms = ดูรายละเอียด (ไม่เปิดฟอร์ม) */
  document.addEventListener("touchstart", function (e) {
    var t = e.target.closest("[data-edit],[data-daypeek]");
    if (!t || t.closest(".cc-hover")) return;
    var found = peekTargets(t);
    if (!found) return;
    touchTimer = setTimeout(function () { showHover(found.list, t, found.day); touchTimer = null; }, 450);
  }, { passive: true });
  document.addEventListener("touchend", function () {
    if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
  }, { passive: true });

  function fullRange(it) {
    var st = schedText(it);
    if (st) return esc(st);
    var a = parseISO(it.start), b = parseISO(it.end || it.start);
    if (isMonthPlan(it) && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return "ทั้งเดือน" + MONTHS[a.getMonth()] + " " + be(a.getFullYear());
    }
    var same = a.getFullYear() === b.getFullYear();
    var one = a.getTime() === b.getTime();
    if (one) return a.getDate() + " " + MONTHS[a.getMonth()] + " " + be(a.getFullYear());
    return a.getDate() + " " + MONTHS[a.getMonth()] + (same ? "" : " " + be(a.getFullYear())) +
           " – " + b.getDate() + " " + MONTHS[b.getMonth()] + " " + be(b.getFullYear());
  }

  /* ============================================================
     หน้าต่างรายละเอียด (นนท์ 28 ก.ย. 69: เปิดรายละเอียดแล้วไม่อยากให้ย้ายไปหน้างาน
     อยากเปิดโชว์อธิบายกิจกรรมให้คนอื่นดู) — ซ้อนบนปฏิทิน อ่านอย่างเดียว ‹ › ไล่ทีละรายการในเดือนที่เปิดอยู่
     ============================================================ */
  var detailId = null;
  function detailSeq() {
    var list = view.mode === "month" && view.month != null ? ofMonth(view.month) : ofYear();
    var key = function (it) {
      if (view.mode === "month" && view.month != null) {
        var a = iso(year, view.month, 1), b = iso(year, view.month, daysIn(year, view.month));
        var g = occ(it).filter(function (x) { return x[0] <= b && x[1] >= a; })[0];
        if (g) return g[0] < a ? a : g[0];
      }
      return it.start;
    };
    return list.slice().sort(function (x, y) { var p = key(x), q = key(y); return p < q ? -1 : p > q ? 1 : (x.name < y.name ? -1 : 1); });
  }
  function fact(label, html) {
    return '<div class="cc-dt-f"><span>' + label + "</span><div>" + html + "</div></div>";
  }
  function detailHtml(it) {
    var x = subOf(it), c = x.c, atts = it.attachments || [];
    var seq = detailSeq(), pos = seq.map(function (y) { return y.id; }).indexOf(it.id);
    var chips = function (arr) { return arr && arr.length ? arr.map(function (v) { return '<span class="cc-tag">' + esc(v) + "</span>"; }).join("") : '<span class="cc-gmute">—</span>'; };
    var acc = it.acc && it.acc.need
      ? "ตั้งค่า" + (it.acc.type === "coupon" ? "คูปอง" : "โปรโมชั่น") + "ในระบบ" + (it.acc.detail ? " — " + esc(it.acc.detail) : "")
      : '<span class="cc-gmute">ไม่ต้อง</span>';
    return '<div class="cc-dt-bar" style="background:' + c + '"></div>' +
      '<div class="cc-dt-hd"><div class="cc-dt-tags">' + kindPill(it) + '<span class="cc-pill ' + it.status + '">' + STATUS_LABEL[it.status] + "</span></div>" +
        '<button type="button" class="cc-icon cc-dt-x" data-dtclose="1" aria-label="ปิด"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>' +
      '<div class="cc-dt-body">' +
        "<h2>" + esc(it.name) + "</h2>" +
        /* ไม่ใส่ป้าย W — หน้าต่างนี้ไว้อธิบายให้คนนอกทีมฟัง วันต้นเดือนที่ขึ้น "W4 เดือนก่อน" ทำให้งง (คุณออนเคยทัก) */
        '<div class="cc-dt-when">' + fullRange(it) + "</div>" +
        (atts.length ? '<div class="cc-dt-pics n' + Math.min(atts.length, 3) + '">' + atts.map(function (a) {
          return '<button type="button" class="cc-dt-pic" data-zoom="' + a.id + '"><img src="' + API + "/attachments/" + a.id + '" alt="' + esc(a.fileName) + '" loading="lazy" decoding="async"></button>';
        }).join("") + "</div>" : "") +
        (it.note ? '<div class="cc-dt-note">' + esc(it.note) + "</div>" : "") +
        '<div class="cc-dt-facts">' +
          fact("สาขา", chips(it.branches)) + fact("ช่องทาง", chips(it.channels)) +
          fact("ผู้รับผิดชอบ", it.owner ? esc(it.owner) : '<span class="cc-gmute">—</span>') +
          fact("งบ", it.budget ? "฿ " + baht(it.budget) : '<span class="cc-gmute">—</span>') +
          fact("ฝ่ายบัญชี", acc) +
        "</div>" +
        '<div class="cc-dt-st"><h3>สื่อและงานที่ผูกไว้</h3>' + statusBlock(it) + "</div>" +
      "</div>" +
      '<div class="cc-dt-ft">' +
        '<div class="cc-dt-nav"><button type="button" class="cc-btn" data-dtstep="-1"' + (pos <= 0 ? " disabled" : "") + '>‹ ก่อนหน้า</button>' +
        '<span>' + (pos + 1) + " / " + seq.length + '</span>' +
        '<button type="button" class="cc-btn" data-dtstep="1"' + (pos < 0 || pos >= seq.length - 1 ? " disabled" : "") + ">ถัดไป ›</button></div>" +
        '<div class="cc-dt-acts"><a class="cc-dt-link" href="' + TASKS_BASE + "#/campaign/" + encodeURIComponent(it.id) + '">เปิดในหน้างานทีม</a>' +
        '<button type="button" class="cc-btn" data-dtedit="' + it.id + '">แก้ไข</button>' +
        '<button type="button" class="cc-btn primary" data-dtclose="1">ปิด</button></div>' +
      "</div>";
  }
  function openDetail(id) {
    var it = byId(id);
    if (!it) return;
    hideHover(0, true);
    detailId = id;
    var ov = $("ccDetail");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "ccDetail";
      ov.className = "cc-dt";
      ov.innerHTML = '<div class="cc-dt-box" role="dialog" aria-modal="true" aria-label="รายละเอียดรายการ"></div>';
      document.body.appendChild(ov);
      ov.addEventListener("click", function (e) {
        if (e.target === ov || e.target.closest("[data-dtclose]")) { closeDetail(); return; }
        var st = e.target.closest("[data-dtstep]");
        if (st) { stepDetail(Number(st.dataset.dtstep)); return; }
        var ed = e.target.closest("[data-dtedit]");
        if (ed) { var eit = byId(ed.dataset.dtedit); closeDetail(); if (eit) openDrawer(eit, null, null); return; }
        var z = e.target.closest("[data-zoom]");
        if (z) { zoomPic(z.dataset.zoom); return; }
      });
    }
    ov.querySelector(".cc-dt-box").innerHTML = detailHtml(it);
    ov.querySelector(".cc-dt-box").scrollTop = 0;
    ov.classList.add("open");
    document.documentElement.classList.add("cc-dt-on");
  }
  function closeDetail() {
    var ov = $("ccDetail");
    if (ov) ov.classList.remove("open");
    document.documentElement.classList.remove("cc-dt-on");
    detailId = null;
  }
  function stepDetail(d) {
    var seq = detailSeq(), i = seq.map(function (y) { return y.id; }).indexOf(detailId);
    var nx = seq[i + d];
    if (nx) openDetail(nx.id);
  }
  function zoomPic(aid) {
    var z = document.createElement("div");
    z.className = "cc-dt-zoom";
    z.innerHTML = '<img src="' + API + "/attachments/" + aid + '" alt="">';
    z.addEventListener("click", function () { z.remove(); });
    document.body.appendChild(z);
  }
  /* คีย์บอร์ดตอนพรีเซนต์: ← → รายการก่อน/ถัดไป · Esc ปิด (ดักก่อนตัวอื่น) */
  document.addEventListener("keydown", function (e) {
    if (!detailId) return;
    var zoom = document.querySelector(".cc-dt-zoom");
    if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); if (zoom) zoom.remove(); else closeDetail(); }
    else if (zoom) return;
    else if (e.key === "ArrowRight") { e.preventDefault(); stepDetail(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); stepDetail(-1); }
  }, true);

  /* ---------- drawer ---------- */
  /* ปุ่มประเภท 2 ชั้น: หัว = หมวดใหญ่ · ปุ่ม = หมวดย่อยพร้อมจุดสี */
  function buildSubs() {
    $("cc-sub").innerHTML = KINDS.map(function (k) {
      return '<div class="cc-subg"><span>' + KIND_LABEL[k] + "</span>" + SUBS.filter(function (x) { return x.kind === k; }).map(function (x) {
        return '<button type="button" class="cc-subb" data-sub="' + x.k + '" aria-pressed="false"><i style="background:' + x.c + '"></i>' + x.th + "</button>";
      }).join("") + "</div>";
    }).join("");
  }
  function setSub(k) {
    Array.prototype.forEach.call(document.querySelectorAll("#cc-sub [data-sub]"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.sub === k));
    });
  }
  function getSub() {
    var on = document.querySelector('#cc-sub [data-sub][aria-pressed="true"]');
    return on ? on.dataset.sub : "event";
  }

  /* ---------- ฝ่ายบัญชี ---------- */
  var accTaskId = null;
  function applyAccUI() {
    var on = $("cc-acc").checked;
    $("ccAccFields").style.display = on ? "" : "none";
    $("ccAccHint").innerHTML = accTaskId
      ? 'สร้างงานให้ฝ่ายบัญชีแล้ว — <a href="' + TASKS_BASE + '#/task/' + esc(accTaskId) + '">เปิดงาน</a> · แก้รายละเอียดแล้วบันทึก งานจะอัปเดตตาม'
      : "กดบันทึกแล้ว ระบบสร้างงานให้ฝ่ายบัญชีใน “งานทีม” ให้เอง (กำหนดส่งวันก่อนเริ่มรายการ)";
  }

  function buildChoices() {
    $("cc-channels").innerHTML = CHANNELS.map(function (c) {
      return '<button type="button" class="cc-choice" data-choice="channel" data-v="' + esc(c) + '" aria-pressed="false">' + esc(c) + "</button>";
    }).join("");
    buildBranchChoices([]);
  }
  function buildBranchChoices(extra) {
    $("cc-branches").innerHTML = BRANCHES.concat((extra || []).filter(function (b) { return BRANCHES.indexOf(b) === -1; })).map(function (b) {
      return '<button type="button" class="cc-choice" data-choice="branch" data-v="' + esc(b) + '" aria-pressed="false">' + esc(b) + "</button>";
    }).join("");
  }
  function setSeg(sel, v) {
    Array.prototype.forEach.call(document.querySelectorAll(sel + " button"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === v));
    });
  }
  function getSeg(sel, fallback) {
    var on = document.querySelector(sel + ' button[aria-pressed="true"]');
    return on ? on.dataset.v : fallback;
  }
  function setChoices(kind, vals) {
    var v = vals || [];
    Array.prototype.forEach.call(document.querySelectorAll('[data-choice="' + kind + '"]'), function (b) {
      b.setAttribute("aria-pressed", String(v.indexOf(b.dataset.v) !== -1));
    });
  }
  function getChoices(kind) {
    return Array.prototype.filter.call(document.querySelectorAll('[data-choice="' + kind + '"]'), function (b) {
      return b.getAttribute("aria-pressed") === "true";
    }).map(function (b) { return b.dataset.v; });
  }
  function applyScopeUI() {
    var scope = getSeg("#cc-scope", "range");
    $("ccRangeFields").style.display = scope === "month" ? "none" : "";
    $("ccMonthFields").style.display = scope === "month" ? "" : "none";
    /* ทั้งเดือน: ทำซ้ำได้แค่ ครั้งเดียว / ทุกเดือน (ทุกสัปดาห์ไม่มีความหมาย) */
    var wk = document.querySelector('#cc-rep [data-v="weekly"]');
    wk.style.display = scope === "month" ? "none" : "";
    $("cc-rep").style.gridTemplateColumns = scope === "month" ? "repeat(2,1fr)" : "";
    if (scope === "month" && getSeg("#cc-rep", "none") === "weekly") setSeg("#cc-rep", "none");
    applyRepUI();
  }

  /* ทำสำเนา = เปิดฟอร์มของ "รายการใหม่" โดยยกค่าจากใบเก่ามาให้ครบ แล้วให้แก้วันก่อนกดบันทึก
     ตั้งใจไม่บันทึกทันที — ก๊อปโปรฯ เก่ามาทั้งดุ้นโดยไม่เปลี่ยนวันแทบไม่มีประโยชน์ */
  var dupFrom = null;
  function openDrawer(item, presetDate, presetScope, preset) {
    editingId = item ? item.id : null;
    pendingFiles = [];
    preset = preset || {};
    /* ใบต้นฉบับตอนทำสำเนา: ไม่มี id (= เป็นรายการใหม่) แต่มีค่าทุกช่องเหมือนใบเก่า */
    if (!item && preset.copyOf) { item = preset.copyOf; editingId = null; }
    var s0 = item ? subOf(item).k : (preset.sub || SUB_OF_KIND[preset.kind || view.kind || "campaign"]);
    setSub(s0);
    $("ccDrawerTitle").textContent = preset.copyOf ? "ทำสำเนา" + SUB[s0].th : (item ? "แก้ไข" + SUB[s0].th : "เพิ่มรายการใหม่");
    $("cc-name").value = preset.copyOf ? dupName(item.name) : (item ? item.name : "");

    var scope = item ? (item.scope || "range") : (presetScope || "range");
    setSeg("#cc-scope", scope);

    var base = item ? parseISO(item.start) : (presetDate ? parseISO(presetDate) : new Date());
    $("cc-month").value = base.getFullYear() + "-" + String(base.getMonth() + 1).padStart(2, "0");
    var sc = item && item.schedule && item.schedule.ranges ? item.schedule : null;
    if (sc) setRanges(sc.ranges);
    else if (item) setRanges([{ s: item.start, e: item.end }]);
    else setRanges([{ s: presetDate || todayISO(), e: preset.end || "" }]);
    $("cc-t1").value = sc && sc.t1 || "";
    $("cc-t2").value = sc && sc.t2 || "";
    var rp = (sc && sc.rep) || { type: "none" };
    setSeg("#cc-rep", rp.type || "none");
    setDows(rp.days || []);
    $("cc-until").value = rp.until || "";
    $("cc-untilm").value = rp.until ? rp.until.slice(0, 7) : "";
    applyScopeUI();
    applyRepUI();

    $("cc-budget").value = item && item.budget ? item.budget : "";
    renderOwners(item ? item.owner : "");
    var acc = item && item.acc && item.acc.need ? item.acc : null;
    $("cc-acc").checked = !!acc;
    setSeg("#cc-acctype", acc && acc.type === "coupon" ? "coupon" : "promo");
    $("cc-accdetail").value = acc ? (acc.detail || "") : "";
    accTaskId = acc && !preset.copyOf ? (acc.taskId || null) : null;   /* สำเนา = ต้องได้งานบัญชีใหม่ของตัวเอง */
    applyAccUI();
    $("cc-note").value = item ? (item.note || "") : "";
    $("ccErr").textContent = "";
    /* สำเนาเริ่มที่ "วางแผน" เสมอ ก๊อปโปรฯ ที่จบแล้วมาแล้วขึ้นว่าจบแล้วตั้งแต่ยังไม่ทำ = อ่านผิด */
    setSeg("#cc-status", preset.copyOf ? "plan" : (item ? item.status : (preset.status || "plan")));
    setChoices("channel", item ? item.channels : []);
    /* เพิ่มรายการตอนกรองสาขาอยู่ → ติ๊กสาขานั้นให้เลย */
    buildBranchChoices(item ? item.branches : []);
    setChoices("branch", item ? item.branches : (preset.branch ? [preset.branch] : (view.branch && view.branch !== NO_BRANCH ? [view.branch] : [])));
    renderAttachments(preset.copyOf ? null : item);
    renderLinks(preset.copyOf ? null : item);
    $("ccDelete").style.visibility = (item && !preset.copyOf) ? "visible" : "hidden";
    $("ccDup").style.display = (item && !preset.copyOf) ? "" : "none";
    dupFrom = preset.copyOf || null;
    $("ccDupNote").innerHTML = preset.copyOf
      ? 'ก๊อปมาจาก <b>' + esc(preset.copyOf.name) + "</b> — แก้ชื่อกับวันให้เรียบร้อยแล้วกดบันทึก จะได้รายการใหม่ (ของเดิมไม่ถูกแตะ)"
      : "";
    $("ccDupNote").style.display = preset.copyOf ? "" : "none";
    $("ccDrawer").classList.add("open");
    $("ccDrawer").setAttribute("aria-hidden", "false");
    $("ccScrim").classList.add("open");
    setTimeout(function () { $("cc-name").focus(); }, 60);
  }
  /* ชื่อสำเนา: มี (สำเนา) อยู่แล้วก็นับต่อ ไม่ต่อท้ายซ้อนไปเรื่อยๆ */
  function dupName(name) {
    var m = String(name).match(/^(.*) \(สำเนา(?: (\d+))?\)$/);
    if (m) return m[1] + " (สำเนา " + ((+m[2] || 1) + 1) + ")";
    return name + " (สำเนา)";
  }
  /* ดึงรูปของใบเก่ามาเป็นไฟล์ที่ "ยังไม่บันทึก" ของใบใหม่ — พอกดบันทึกถึงอัปขึ้นจริง
     โหลดช้าหน่อยก็ไม่บล็อกฟอร์ม ระหว่างรอยังกรอกชื่อ/วันได้ */
  async function copyAttachments(src) {
    var atts = (src.attachments || []).slice(0, 6);
    if (!atts.length || !online) return;
    for (var i = 0; i < atts.length; i++) {
      if (dupFrom !== src) return;   /* ผู้ใช้ปิดฟอร์มหรือเปิดใบอื่นไปแล้ว ทิ้งงานนี้ */
      try {
        var full = await toDataUrl(API + "/attachments/" + atts[i].id);
        var thumb = await toDataUrl(API + "/attachments/" + atts[i].id + "?s=thumb");
        if (dupFrom !== src) return;
        pendingFiles.push({ dataUrl: full, fileName: atts[i].fileName || "image", thumb: thumb });
        renderAttachments(null);
      } catch (e) { /* รูปไหนโหลดไม่ได้ก็ข้าม ไม่ต้องล้มทั้งสำเนา */ }
    }
  }
  function toDataUrl(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("โหลดรูปไม่ได้");
      return r.blob();
    }).then(function (b) {
      return new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(String(fr.result)); };
        fr.onerror = function () { rej(new Error("อ่านรูปไม่ได้")); };
        fr.readAsDataURL(b);
      });
    });
  }
  function duplicateItem(id) {
    var it = byId(id);
    if (!it) return;
    hideHover();
    openDrawer(null, null, it.scope || "range", { copyOf: it });
    copyAttachments(it);
    toast((it.attachments || []).length ? "ก๊อปมาแล้ว รวมรูป " + it.attachments.length + " รูป — แก้วันแล้วกดบันทึก" : "ก๊อปมาแล้ว — แก้วันแล้วกดบันทึก");
  }

  function closeDrawer() {
    dupFrom = null;
    $("ccDrawer").classList.remove("open");
    $("ccDrawer").setAttribute("aria-hidden", "true");
    $("ccScrim").classList.remove("open");
    editingId = null;
    pendingFiles = [];
  }

  /* โพสต์และงานที่ผูกกับรายการนี้ — กดไปดู/สั่งงานต่อได้เลย (มีเฉพาะตอนแก้ไข เพราะต้องมี id ก่อน) */
  function renderLinks(item) {
    var el = $("ccLinks");
    if (!item) { el.className = "cc-links"; el.innerHTML = ""; return; }
    var p = item.posts || { total:0, done:0 }, t = item.tasks || { total:0, open:0 };
    var q = encodeURIComponent(item.id);
    el.className = "cc-links show";
    el.innerHTML = "<h4>เชื่อมโยงกับรายการนี้</h4><div class=\"cc-linkrow\">" +
      '<a class="cc-linkbtn' + (p.total && p.done < p.total ? " warn" : "") + '" href="' + TASKS_BASE + "#/posts?campaign=" + q + '&range=all&view=list">' +
        "โพสต์ <b>" + p.done + "/" + p.total + "</b></a>" +
      '<a class="cc-linkbtn' + (t.open ? " warn" : "") + '" href="' + TASKS_BASE + "#/all?campaign=" + q + '&status=">' +
        "งาน <b>" + (t.total ? (t.open ? t.open + " ค้าง" : "ครบ " + t.total) : "0") + "</b></a>" +
      '<a class="cc-linkbtn" href="' + TASKS_BASE + "#/new?campaign=" + q + '">+ สั่งงานสำหรับรายการนี้</a>' +
      "</div>";
  }

  function renderAttachments(item) {
    var saved = (item && item.attachments) || [];
    var total = saved.length + pendingFiles.length;
    var n = 0;
    var html = saved.map(function (a) {
      n++;
      return '<div class="cc-shot"><img src="' + API + "/attachments/" + a.id + '" alt="' + esc(a.fileName) + '">' +
             '<span class="cc-shot-num">' + n + "/" + total + "</span>" +
             '<button type="button" class="cc-filedel" data-delfile="' + a.id + '" aria-label="ลบรูป">&times;</button></div>';
    }).join("");
    html += pendingFiles.map(function (f, i) {
      n++;
      return '<div class="cc-shot pending"><img src="' + f.dataUrl + '" alt="' + esc(f.fileName) + '">' +
             '<span class="cc-shot-num">' + n + "/" + total + " · ยังไม่บันทึก</span>" +
             '<button type="button" class="cc-filedel" data-pending="' + i + '" aria-label="เอาออก">&times;</button></div>';
    }).join("");

    var addBtn = '<button type="button" class="cc-addshot' + (total ? "" : " wide") + '" id="ccAddFile">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5L5 20"/></svg>' +
      (total ? "เพิ่มรูป" : "เพิ่มรูปแรก") + "</button>";

    $("ccFiles").innerHTML = html + (total < 6 ? addBtn : "");
    $("ccFileHint").textContent = !online
      ? "โหมดออฟไลน์: แนบรูปไม่ได้ ต้องเปิดผ่าน admin.kan-hub.com"
      : (total ? "เลื่อนดูรูปได้ · สูงสุด 6 รูปต่อแคมเปญ (เก็บบนเซิร์ฟเวอร์ ทีมเห็นเหมือนกัน)"
               : "ใส่รูปไว้จะได้เห็นทันทีว่ารายการนี้คืออะไร");
  }

  /* ย่อรูปก่อนส่ง ไม่งั้นไฟล์จากกล้องมือถือใหญ่เกินลิมิต */
  function shrinkImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("อ่านไฟล์ไม่ได้")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("ไฟล์นี้ไม่ใช่รูป")); };
        img.onload = function () {
          var w = img.width, h = img.height, scale = Math.min(1, MAX_IMAGE_PX / Math.max(w, h));
          var cv = document.createElement("canvas");
          cv.width = Math.round(w * scale);
          cv.height = Math.round(h * scale);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          var q = 0.82, out = cv.toDataURL("image/jpeg", q);
          while (out.length * 0.75 > MAX_IMAGE_BYTES && q > 0.4) {
            q -= 0.12;
            out = cv.toDataURL("image/jpeg", q);
          }
          /* รูปย่อ 320px ไว้โชว์ในปฏิทิน — รูปเต็มโหลดเฉพาะตอนกดเปิด */
          var ts = Math.min(1, 320 / Math.max(w, h));
          var tc = document.createElement("canvas");
          tc.width = Math.max(1, Math.round(w * ts)); tc.height = Math.max(1, Math.round(h * ts));
          tc.getContext("2d").drawImage(img, 0, 0, tc.width, tc.height);
          resolve({ dataUrl: out, fileName: file.name, thumb: tc.toDataURL("image/jpeg", 0.72) });
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  async function pickFiles(fileList) {
    if (!online) { toast("ต้องเปิดผ่าน admin.kan-hub.com ถึงจะแนบรูปได้"); return; }
    var files = Array.prototype.slice.call(fileList).filter(function (f) { return f.type.indexOf("image/") === 0; });
    if (!files.length) { toast("เลือกได้เฉพาะไฟล์รูป"); return; }
    for (var i = 0; i < files.length; i++) {
      try {
        var shrunk = await shrinkImage(files[i]);
        if (editingId) {
          await api("/campaigns/" + editingId + "?action=attach", { method:"POST", body: JSON.stringify(shrunk) });
          await loadAll();
          renderAttachments(byId(editingId));
          render();
          toast("แนบรูปแล้ว");
        } else {
          pendingFiles.push(shrunk);
          renderAttachments(null);
        }
      } catch (e) {
        toast("แนบรูปไม่สำเร็จ: " + e.message);
      }
    }
  }

  /* ---------- save ---------- */
  function collect() {
    var scope = getSeg("#cc-scope", "range");
    var name = $("cc-name").value.trim();
    var start, end, schedule = null;

    if (scope === "month") {
      var mv = $("cc-month").value; // YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(mv)) return { error: "เลือกเดือนก่อน" };
      var y = +mv.slice(0, 4), mo = +mv.slice(5, 7) - 1;
      start = iso(y, mo, 1);
      end = iso(y, mo, daysIn(y, mo));
      var mt1 = $("cc-t1").value, mt2 = $("cc-t2").value, mrt = getSeg("#cc-rep", "none");
      if (mt1 && mt2 && mt2 < mt1) return { error: "เวลาจบต้องไม่มาก่อนเวลาเริ่ม" };
      var mrep = { type: mrt === "monthly" ? "monthly" : "none" };
      if (mrep.type === "monthly") {
        var um0 = $("cc-untilm").value;
        if (!/^\d{4}-\d{2}$/.test(um0)) return { error: "ทำซ้ำ: เลือกเดือนสุดท้าย" };
        if (um0 < mv) return { error: "ทำซ้ำ: เดือนสุดท้ายต้องไม่มาก่อนเดือนเริ่ม" };
        mrep.until = iso(+um0.slice(0, 4), +um0.slice(5, 7) - 1, daysIn(+um0.slice(0, 4), +um0.slice(5, 7) - 1));
        end = mrep.until;
      }
      schedule = (!mt1 && !mt2 && mrep.type === "none") ? null : { ranges: [{ s: start, e: iso(y, mo, daysIn(y, mo)) }], t1: mt1, t2: mt2, rep: mrep };
    } else {
      var ranges = getRanges();
      if (!ranges.length) return { error: "เลือกวันเริ่ม" };
      for (var i = 0; i < ranges.length; i++) {
        if (ranges[i].e < ranges[i].s) return { error: "ช่วงที่ " + (i + 1) + ": วันสิ้นสุดต้องไม่มาก่อนวันเริ่ม" };
      }
      ranges.sort(function (a, b) { return a.s < b.s ? -1 : a.s > b.s ? 1 : 0; });
      var rt = getSeg("#cc-rep", "none");
      if (rt === "weekly") ranges = [{ s: ranges[0].s, e: ranges[0].s }];
      var t1 = $("cc-t1").value, t2 = $("cc-t2").value;
      if (t1 && t2 && t2 < t1) return { error: "เวลาจบต้องไม่มาก่อนเวลาเริ่ม" };
      var rep = { type: rt };
      start = ranges[0].s;
      end = ranges.reduce(function (m, r) { return r.e > m ? r.e : m; }, ranges[0].e);
      if (rt !== "none") {
        rep.until = $("cc-until").value;
        if (!rep.until) return { error: "ทำซ้ำ: เลือกวันที่ทำซ้ำไปจนถึง" };
        if (rep.until < start) return { error: "ทำซ้ำ: วันสุดท้ายต้องไม่มาก่อนวันเริ่ม" };
        end = rep.until;
        if (rt === "weekly") {
          rep.days = getDows();
          if (!rep.days.length) return { error: "ทำซ้ำทุกสัปดาห์: เลือกวันก่อน (เช่น จ – พฤ)" };
        }
      }
      var plain = ranges.length === 1 && !t1 && !t2 && rt === "none";
      schedule = plain ? null : { ranges: ranges, t1: t1, t2: t2, rep: rep };
    }
    if (!name) return { error: "ใส่ชื่อก่อน" };
    var accOn = $("cc-acc").checked;
    if (accOn && !$("cc-accdetail").value.trim()) return { error: "ฝ่ายบัญชี: ใส่รายละเอียดว่าต้องตั้งค่าอะไร" };
    var sub = getSub();

    return { value: {
      kind: SUB[sub].kind, sub: sub,
      name: name, start: start, end: end, scope: scope, schedule: schedule,
      status: getSeg("#cc-status", "plan"),
      channels: getChoices("channel"), branches: getChoices("branch"),
      budget: Number($("cc-budget").value) || 0,
      owner: owners.join(", "),
      note: $("cc-note").value.trim(),
      acc: accOn ? { need: true, type: getSeg("#cc-acctype", "promo"), detail: $("cc-accdetail").value.trim(), taskId: accTaskId || undefined } : null
    } };
  }

  async function submit() {
    var parsed = collect();
    if (parsed.error) { $("ccErr").textContent = parsed.error; return; }
    var data = parsed.value;
    $("ccSave").disabled = true;
    try {
      if (online) {
        var hadAcc = !!accTaskId, res;
        if (editingId) {
          res = await api("/campaigns/" + editingId, { method:"PUT", body: JSON.stringify(data) });
        } else {
          var created = res = await api("/campaigns", { method:"POST", body: JSON.stringify(data) });
          for (var i = 0; i < pendingFiles.length; i++) {
            await api("/campaigns/" + created.id + "?action=attach", { method:"POST", body: JSON.stringify(pendingFiles[i]) });
          }
        }
        await loadAll();
      } else {
        if (editingId) {
          items = items.map(function (it) { return it.id === editingId ? Object.assign({}, it, data) : it; });
        } else {
          data.id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          data.attachments = [];
          items.push(data);
        }
        cacheLocal();
      }
      year = parseISO(data.start).getFullYear();
      closeDrawer();
      render();
      toast(!online ? "บันทึกในเครื่องนี้ (ยังไม่ขึ้นเซิร์ฟเวอร์)"
        : (res && res.accTaskId && !hadAcc ? "บันทึกแล้ว · สร้างงาน “ตั้งค่า" + (data.acc.type === "coupon" ? "คูปอง" : "โปรโมชั่น") + "ในระบบ” ให้ฝ่ายบัญชีแล้ว" : "บันทึกแล้ว"));
    } catch (e) {
      $("ccErr").textContent = "บันทึกไม่สำเร็จ: " + e.message;
    } finally {
      $("ccSave").disabled = false;
    }
  }

  async function removeItem() {
    var it = byId(editingId);
    if (!it) return;
    if (!confirm('ลบ "' + it.name + '" ออกจากปฏิทิน?')) return;
    try {
      if (online) { await api("/campaigns/" + editingId, { method:"DELETE" }); await loadAll(); }
      else { items = items.filter(function (x) { return x.id !== editingId; }); cacheLocal(); }
      closeDrawer();
      render();
      toast("ลบแล้ว");
    } catch (e) { toast("ลบไม่สำเร็จ: " + e.message); }
  }

  function toast(msg) {
    var el = $("ccToast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2800);
  }

  /* ---------- backup ---------- */
  function exportFile() {
    var blob = new Blob([JSON.stringify({ version:2, savedAt:new Date().toISOString(), items:items }, null, 2)],
                        { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kan-campaigns-" + todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("ดาวน์โหลดไฟล์สำรองแล้ว (ไม่รวมรูป)");
  }
  function importFile(file) {
    var reader = new FileReader();
    reader.onload = async function () {
      var incoming;
      try {
        var parsed = JSON.parse(String(reader.result));
        incoming = Array.isArray(parsed) ? parsed : parsed.items;
      } catch (e) { toast("ไฟล์นี้อ่านไม่ได้"); return; }
      if (!Array.isArray(incoming)) { toast("ไฟล์นี้ไม่มีข้อมูลแคมเปญ"); return; }
      var valid = incoming.filter(function (x) { return x && x.name && x.start; });
      if (!valid.length) { toast("ไม่พบแคมเปญในไฟล์"); return; }
      if (!confirm("นำเข้า " + valid.length + " แคมเปญ เพิ่มเข้าไปในระบบ?")) return;
      try {
        if (online) {
          for (var i = 0; i < valid.length; i++) {
            /* ไม่ยกงานฝ่ายบัญชีจากไฟล์มาด้วย — กันงานซ้ำ */
            await api("/campaigns", { method:"POST", body: JSON.stringify({
              name: valid[i].name, start: valid[i].start, end: valid[i].end || valid[i].start,
              scope: valid[i].scope || "range", status: valid[i].status || "plan",
              channels: valid[i].channels || [], branches: valid[i].branches || [],
              budget: valid[i].budget || 0, owner: valid[i].owner || "", note: valid[i].note || "",
              kind: valid[i].kind || "campaign", sub: valid[i].sub, schedule: valid[i].schedule || null
            }) });
          }
          await loadAll();
        } else {
          items = items.concat(valid);
          cacheLocal();
        }
        render();
        toast("นำเข้า " + valid.length + " แคมเปญแล้ว");
      } catch (e) { toast("นำเข้าไม่สำเร็จ: " + e.message); }
    };
    reader.readAsText(file);
  }

  /* ---------- events ---------- */
  $("ccAdd").addEventListener("click", function () { openDrawer(null, null, null); });
  $("ccPrev").addEventListener("click", function () { year--; view = { mode:"year", month:null }; render(); });
  $("ccNext").addEventListener("click", function () { year++; view = { mode:"year", month:null }; render(); });
  $("ccClose").addEventListener("click", closeDrawer);
  $("ccCancel").addEventListener("click", closeDrawer);
  $("ccSave").addEventListener("click", submit);
  $("ccDelete").addEventListener("click", removeItem);
  $("ccScrim").addEventListener("click", closeDrawer);
  $("ccForm").addEventListener("submit", function (e) { e.preventDefault(); submit(); });
  function toggleMenu(open) {
    var m = $("ccMenu"), on = open == null ? m.hidden : open;
    m.hidden = !on;
    $("ccMore").setAttribute("aria-expanded", String(on));
  }
  $("ccMore").addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(); });
  document.addEventListener("mousedown", function (e) { if (!e.target.closest(".cc-more-wrap")) toggleMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") toggleMenu(false); });
  $("ccExport").addEventListener("click", function () { toggleMenu(false); exportFile(); });
  $("ccImport").addEventListener("click", function () { toggleMenu(false); $("ccFile").click(); });
  $("ccFile").addEventListener("change", function (e) {
    if (e.target.files && e.target.files[0]) importFile(e.target.files[0]);
    e.target.value = "";
  });
  $("ccImageInput").addEventListener("change", function (e) {
    if (e.target.files && e.target.files.length) pickFiles(e.target.files);
    e.target.value = "";
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !$("ccDrawer").classList.contains("open") && (sel.length || selMode) && !document.querySelector(".cc-okdlg")) {
      if (bulkAct) { bulkAct = ""; renderBulkBar(); } else { clearSel(); selMode = false; render(); }
      return;
    }
    if (e.key === "Escape") closeDrawer();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && $("ccDrawer").classList.contains("open")) submit();
  });

  document.addEventListener("click", async function (e) {
    if (e.target.closest && e.target.closest("#ccBulk")) return;
    /* ---- เลือกหลายรายการ ---- */
    var sm = e.target.closest("[data-selmode]");
    if (sm) { selMode = !selMode; if (!selMode) clearSel(); hideHover(0, true); render(); return; }
    var sb = e.target.closest("input[data-sel]");
    if (sb) {
      var id0 = sb.dataset.sel, want = sb.checked;
      if (e.shiftKey && lastSel && lastSel !== id0) {
        /* Shift = เลือกทุกแถวระหว่างอันล่าสุดกับอันนี้ ตามลำดับที่เห็นบนจอ */
        var order = Array.prototype.map.call(document.querySelectorAll("input[data-sel]"), function (x) { return x.dataset.sel; });
        var i1 = order.indexOf(lastSel), i2 = order.indexOf(id0);
        if (i1 !== -1 && i2 !== -1) {
          order.slice(Math.min(i1, i2), Math.max(i1, i2) + 1).some(function (x) { return !toggleSel(x, want); });
        }
      } else toggleSel(id0, want);
      lastSel = id0;
      render();
      return;
    }
    var sg = e.target.closest("input[data-selgrp]");
    if (sg) {
      var grp = gridGroups(view.mode === "month" ? ofMonth(view.month) : ofYear()).filter(function (x) { return x.key === sg.dataset.selgrp; })[0];
      if (grp) {
        var on = sg.checked;
        grp.items.some(function (it) { return !toggleSel(it.id, on); });
      }
      render();
      return;
    }
    if (selMode) {
      var bar0 = e.target.closest(".cc-bar[data-open]");
      if (bar0) { toggleSel(bar0.dataset.open); render(); return; }
      if (e.target.closest("[data-day]") && !e.target.closest(".cc-bar")) return;   /* โหมดเลือก: คลิกช่องว่างไม่เปิดฟอร์ม */
    }
    var scopeBtn = e.target.closest("#cc-scope button");
    if (scopeBtn) { setSeg("#cc-scope", scopeBtn.dataset.v); applyScopeUI(); return; }
    var seg = e.target.closest("#cc-status button");
    if (seg) { setSeg("#cc-status", seg.dataset.v); return; }
    var kseg = e.target.closest("#cc-sub [data-sub]");
    if (kseg) {
      setSub(kseg.dataset.sub);
      if (!editingId && !dupFrom) $("ccDrawerTitle").textContent = "เพิ่ม" + SUB[kseg.dataset.sub].th;
      return;
    }
    var repb = e.target.closest("#cc-rep button");
    if (repb) { setSeg("#cc-rep", repb.dataset.v); applyRepUI(); return; }
    var dw = e.target.closest("#cc-dows [data-dow]");
    if (dw) { dw.setAttribute("aria-pressed", dw.getAttribute("aria-pressed") === "true" ? "false" : "true"); repHint(); return; }
    var dq = e.target.closest("[data-dq]");
    if (dq) { setDows(dq.dataset.dq.split(",").map(Number)); repHint(); return; }
    var acct = e.target.closest("#cc-acctype button");
    if (acct) { setSeg("#cc-acctype", acct.dataset.v); return; }
    if (e.target.closest("#ccAddRange")) {
      var last = getRanges().slice(-1)[0];
      /* ช่วงใหม่ตั้งต้นที่วันถัดจากช่วงล่าสุด 1 สัปดาห์ — ส่วนใหญ่ทีมทำซ้ำแบบนี้ */
      var nd = last ? isoOf(addDays(parseISO(last.e || last.s), 7)) : todayISO();
      $("ccRanges").insertAdjacentHTML("beforeend", rangeRow(nd, ""));
      allHints();
      var ins = $("ccRanges").querySelectorAll(".cc-rs");
      ins[ins.length - 1].focus();
      return;
    }
    var rdel = e.target.closest(".cc-rdel");
    if (rdel) { var rr = rdel.closest(".cc-range"); if (rr && $("ccRanges").children.length > 1) rr.remove(); allHints(); return; }
    var bf = e.target.closest("[data-branch]");
    if (bf) {
      view.branch = bf.dataset.branch;
      try { localStorage.setItem("kan-cc-branch", view.branch); } catch (err) {}
      render();
      return;
    }
    /* ---- มุมมองตาราง ---- */
    var lay = e.target.closest("[data-layout]");
    if (lay) {
      view.layout = lay.dataset.layout === "grid" ? "grid" : "cal";
      try { localStorage.setItem("kan-cc-layout", view.layout); } catch (err) {}
      render();
      return;
    }
    var gp = e.target.closest("[data-group]");
    if (gp) {
      view.group = gp.dataset.group;
      try { localStorage.setItem("kan-cc-group", view.group); } catch (err) {}
      render();
      return;
    }
    var gk = e.target.closest("[data-grpkey]");
    if (gk) { var k0 = gk.dataset.grpkey; collapsed[k0] = !collapsed[k0]; renderGrid(); return; }
    var ga = e.target.closest("[data-gadd]");
    if (ga) {
      var gg = gridGroups(view.mode === "month" ? ofMonth(view.month) : ofYear())
        .filter(function (x) { return x.key === ga.dataset.gadd; })[0];
      startQuickAdd(ga, gg ? gg.preset : {});
      return;
    }
    var cell = e.target.closest("td[data-cell]");
    if (cell && cell.closest(".cc-gtab")) {
      var row = cell.closest("tr"), it0 = byId(row.dataset.gid);
      var f = cell.dataset.cell;
      if (!it0) return;
      if (GRID_EDITABLE[f]) { editCell(cell); return; }
      if (f === "status") {
        pickCell(cell, [["plan", STATUS_LABEL.plan], ["live", STATUS_LABEL.live], ["done", STATUS_LABEL.done]], it0.status,
          function (v) { patchItem(it0.id, { status: v }); });
        return;
      }
      if (f === "kind") {
        pickCell(cell, SUBS.map(function (x) { return [x.k, '<i class="cc-kdot" style="background:' + x.c + '"></i>' + x.th]; }), subOf(it0).k,
          function (v) { patchItem(it0.id, { sub: v, kind: SUB[v].kind }); });
        return;
      }
      /* ช่วงวัน / สาขา / ช่องทาง แก้ในช่องเดียวไม่ไหว เปิดฟอร์มเต็มให้เลย */
      openDrawer(it0, null, null);
      return;
    }
    var kf = e.target.closest("[data-kind]");
    if (kf) {
      view.kind = kf.dataset.kind;
      try { localStorage.setItem("kan-cc-kind", view.kind); } catch (err) {}
      render();
      return;
    }
    if (e.target.closest("#ccAddFile")) { $("ccImageInput").click(); return; }
    var ch = e.target.closest("[data-choice]");
    if (ch) { ch.setAttribute("aria-pressed", ch.getAttribute("aria-pressed") === "true" ? "false" : "true"); return; }

    var delFile = e.target.closest("[data-delfile]");
    if (delFile) {
      try {
        await api("/attachments/" + delFile.dataset.delfile, { method:"DELETE" });
        await loadAll();
        renderAttachments(byId(editingId));
        render();
      } catch (err) { toast("ลบรูปไม่สำเร็จ"); }
      return;
    }
    var delPending = e.target.closest("[data-pending]");
    if (delPending) { pendingFiles.splice(+delPending.dataset.pending, 1); renderAttachments(null); return; }

    var dup = e.target.closest("[data-dup]");
    if (dup) { e.stopPropagation(); duplicateItem(dup.dataset.dup); return; }
    if (e.target.closest("#ccDup")) { duplicateItem(editingId); return; }
    var ed = e.target.closest("[data-edit]");
    if (ed) { e.stopPropagation(); hideHover(); var it = byId(ed.dataset.edit); if (it) openDrawer(it, null, null); return; }
    var ms = e.target.closest("[data-mstep]");
    if (ms) {
      var nm = view.month + Number(ms.dataset.mstep);
      if (nm < 0) { year--; nm = 11; } else if (nm > 11) { year++; nm = 0; }
      view.mode = "month"; view.month = nm;
      if (typeof clearSel === "function" && !selMode) clearSel();
      render();
      return;
    }
    var mo = e.target.closest("[data-month]");
    /* สลับปี/เดือนต้องไม่ล้างตัวกรองประเภทกับสาขา — เดิม view = {...} ทับทิ้งหมด ทำให้กรองสาขาหลุดพอกดเข้าเดือน */
    if (mo) { view.mode = "month"; view.month = +mo.dataset.month; render(); window.scrollTo({ top:0, behavior:"smooth" }); return; }
    if (e.target.closest("#ccBack")) { view.mode = "year"; view.month = null; render(); return; }
    if (e.target.closest("[data-newmonth]")) { openDrawer(null, iso(year, view.month, 1), "month"); return; }
    var mk = e.target.closest("[data-mk]");
    if (mk) { var itm = byId(mk.dataset.mkid); if (itm) makeMedia(mk.dataset.mk, itm, mk); return; }
    var dt = e.target.closest("[data-detail]");
    if (dt) { openDetail(dt.dataset.detail); return; }
    var op = e.target.closest("[data-open]");
    if (op) {
      /* กดแถบ/รายการในปฏิทิน → ปักการ์ดสถานะไว้ตรงนี้ (ปุ่ม "ดูรายละเอียด" ในการ์ดเปิดหน้าต่างบนปฏิทิน ไม่ย้ายหน้า) */
      var f1 = peekTargets(op);
      if (f1) { clearTimeout(hoverTimer); pinned = false; showHover(f1.list, op, f1.day); pinned = true; }
      return;
    }
    if (pinned && !e.target.closest(".cc-hover")) { hideHover(0, true); }
    var dop = e.target.closest("[data-dayopen]");
    if (dop) { var f0 = peekTargets(dop); if (f0) { clearTimeout(hoverTimer); pinned = false; showHover(f0.list, dop, f0.day); pinned = true; } return; }
    var day = e.target.closest("[data-day]");
    if (day) { openDrawer(null, day.dataset.day, "range"); return; }
    if (e.target.closest("[data-new]")) {
      openDrawer(null, view.mode === "month" ? iso(year, view.month, 1) : null, null);
      return;
    }
  });

  buildChoices();
  buildSubs();
  render();
  loadAll().then(function () {
    render();
    var m = String(location.hash || "").match(/^#c=([A-Za-z0-9_-]+)/);
    if (m) {
      var it = byId(m[1]);
      if (it) {
        year = parseISO(it.start).getFullYear();
        view = { mode:"month", month: parseISO(it.start).getMonth(), kind: view.kind };
        render();
        openDrawer(it, null, null);
      }
    }
  });
})();
