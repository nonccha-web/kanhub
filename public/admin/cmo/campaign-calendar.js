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
  var BRANCHES = ["Kan Hub","Kan Fashion","ชุมพร","สุราษฎร์","Central","สหไทย","อื่นๆ"];
  var NO_BRANCH = "-";   /* ค่าพิเศษของตัวกรอง = รายการที่ยังไม่ระบุสาขา */
  // Central / สหไทย = ห้างข้างนอกที่เราไปลงของ ไม่ใช่สาขาเรา
  var STATUS_LABEL = { plan:"วางแผน", live:"กำลังทำ", done:"จบแล้ว" };
  /* ประเภทรายการ — สีของประเภทคงที่ (ไม่ใช่สีที่ผู้ใช้เลือกให้แต่ละรายการ) จะได้กวาดตาแล้วรู้ทันที */
  var KINDS = ["content", "campaign", "promo"];
  var KIND_LABEL = { content:"คอนเทนต์", campaign:"แคมเปญ", promo:"โปรโมชั่น" };
  var KIND_COLOR = { content:"#0E9BA8", campaign:"#7A5CF0", promo:"#F2565A" };
  function kindOf(it) { return KINDS.indexOf(it && it.kind) !== -1 ? it.kind : "campaign"; }
  function kindDot(it) { return '<i class="cc-kdot" style="background:' + KIND_COLOR[kindOf(it)] + '" title="' + KIND_LABEL[kindOf(it)] + '"></i>'; }
  /* ลิงก์ไปหน้าที่ผูกกับรายการนี้ — ระบบงานทีมอยู่คนละโฟลเดอร์ */
  var TASKS_BASE = "../tasks/";
  function linkLine(it) {
    var p = it.posts || { total:0, done:0 }, t = it.tasks || { total:0, open:0 };
    if (!p.total && !t.total) return "";
    return '<span class="cc-linkline">' +
      (p.total ? '<span>โพสต์ <b>' + p.done + "/" + p.total + "</b></span>" : "") +
      (t.total ? '<span>งาน <b>' + (t.open ? t.open + " ค้าง" : "ครบ") + "</b></span>" : "") + "</span>";
  }
  function kindPill(it) { var k = kindOf(it); return '<span class="cc-kpill" style="color:' + KIND_COLOR[k] + ';border-color:' + KIND_COLOR[k] + '">' + KIND_LABEL[k] + "</span>"; }
  var COLORS = [
    { v:"#3370FF", n:"น้ำเงิน" }, { v:"#14C0FF", n:"ฟ้า" },   { v:"#00C7C7", n:"เขียวน้ำทะเล" },
    { v:"#34C724", n:"เขียว" },   { v:"#8FC31F", n:"เขียวมะนาว" }, { v:"#FFC60A", n:"เหลือง" },
    { v:"#FF8800", n:"ส้ม" },     { v:"#F54A45", n:"แดง" },   { v:"#F5319D", n:"ชมพู" },
    { v:"#7F3BF5", n:"ม่วง" }
  ];
  var DEFAULT_COLOR = "#3370FF";
  var MAX_IMAGE_PX = 1400;
  var MAX_IMAGE_BYTES = 1400000;

  var items = [];
  var year = new Date().getFullYear();
  /* เปิดมาเห็นเดือนนี้ก่อน (นนท์: "เอามาแค่โปรโมชั่นของเดือนนี้ก็พอ" 18 ก.ย. 69) — ปุ่มย้อนกลับพาไปดูทั้งปี */
  /* layout = ปฏิทิน หรือ ตาราง (แบบ Lark Base) · group = ตารางจัดกลุ่มตามอะไร
     ตัวกรองประเภท/สาขาใช้ร่วมกันทั้งสองมุมมอง จะได้ไม่ต้องตั้งใหม่ตอนสลับ */
  var GROUPS = [["week", "สัปดาห์"], ["month", "เดือน"], ["kind", "ประเภท"], ["branch", "สาขา"], ["status", "สถานะ"]];
  var GROUP_KEYS = GROUPS.map(function (g) { return g[0]; });
  var view = { mode:"month", month:new Date().getMonth(), kind:"", branch:"", layout:"cal", group:"week" };
  try { view.kind = KINDS.indexOf(localStorage.getItem("kan-cc-kind")) !== -1 ? localStorage.getItem("kan-cc-kind") : ""; } catch (e) {}
  try { var _b = localStorage.getItem("kan-cc-branch"); view.branch = (_b === NO_BRANCH || BRANCHES.indexOf(_b) !== -1) ? _b : ""; } catch (e) {}
  try { view.layout = localStorage.getItem("kan-cc-layout") === "grid" ? "grid" : "cal"; } catch (e) {}
  try { var _g = localStorage.getItem("kan-cc-group"); view.group = GROUP_KEYS.indexOf(_g) !== -1 ? _g : "week"; } catch (e) {}
  /* กลุ่มที่พับไว้ — จำแค่ในหน้านี้ ปิดแท็บแล้วกลับมากางใหม่หมด */
  var collapsed = {};
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
  var PAGE_OF = { "ชุมพร": "pg_kst1", "สุราษฎร์": "pg_kst3", "Kan Fashion": "pg_fashion", "Kan Hub": "pg_hub" };
  var SIGN_OWNER = "s_julalak";
  function dayBefore(startISO) { var d = parseISO(startISO); d.setDate(d.getDate() - 1); var t = todayISO(); var r = iso(d.getFullYear(), d.getMonth(), d.getDate()); return r < t ? t : r; }
  async function makeMedia(kind, it, btn) {
    var brs = (it.branches || []).filter(function (b) { return PAGE_OF[b]; });
    if (!brs.length) brs = ["สุราษฎร์"];
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
  function covers(it, dayISO) { return it.start <= dayISO && dayISO <= (it.end || it.start); }
  function isMonthPlan(it) { return it.scope === "month"; }
  function fmtRange(it) {
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
  function colorOf(it) { return (it && /^#[0-9a-fA-F]{6}$/.test(it.color || "")) ? it.color : DEFAULT_COLOR; }
  /* พื้นอ่อนของสีแคมเปญ — คำนวณเป็น rgba เอง จะได้ไม่ต้องพึ่ง color-mix */
  function tint(hex, alpha) {
    var h = hex.replace("#", "");
    return "rgba(" + parseInt(h.slice(0,2),16) + "," + parseInt(h.slice(2,4),16) + "," +
           parseInt(h.slice(4,6),16) + "," + alpha + ")";
  }
  function chipStyle(it) {
    var c = colorOf(it);
    return ' style="background:' + tint(c, .14) + ';color:' + c + ';border-left-color:' + c + '"';
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
    var first = new Date(year, m, 1), last = new Date(year, m, daysIn(year, m));
    return ofYear().filter(function (it) {
      return parseISO(it.start) <= last && parseISO(it.end || it.start) >= first;
    });
  }
  function byId(id) { return items.filter(function (x) { return x.id === id; })[0]; }

  /* ---------- render ---------- */
  function render() {
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
    return (view.group === "month" && view.mode === "month") ? "week" : view.group;
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

  function renderMonth() {
    var m = view.month, days = daysIn(year, m), lead = new Date(year, m, 1).getDay();
    var tISO = todayISO(), list = ofMonth(m);
    var events = list.filter(function (it) { return !isMonthPlan(it); })
      .sort(function (a, b) {
        if (a.start !== b.start) return a.start < b.start ? -1 : 1;
        var la = (a.end || a.start), lb = (b.end || b.start);
        return la > lb ? -1 : la < lb ? 1 : 0;   /* เริ่มพร้อมกัน เอาอันยาวขึ้นก่อน */
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
      events.forEach(function (it) {
        var e = it.end || it.start;
        if (it.start > wEnd || e < wStart) return;
        var c0 = it.start <= wStart ? 0 : dayISO.indexOf(it.start);
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
        bars.push({ it: it, c0: c0, c1: c1, lane: lane, contL: it.start < wStart, contR: e > wEnd });
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
        nums += '<span class="cc-dnum' + (dISO === tISO ? " today" : "") + (inMonth ? "" : " out") + '" style="grid-column:' + (d + 1) + ';grid-row:1">' + dt2.getDate() + "</span>";
        if (hidden[d]) mores += '<button type="button" class="cc-more" style="grid-column:' + (d + 1) + ';grid-row:' + (nLanes + 2) + '" data-daypeek="' + dISO + '" data-dayopen="' + dISO + '">+ อีก ' + hidden[d] + "</button>";
      }
      var barsH = bars.map(function (b) {
        var it = b.it, col = colorOf(it);
        /* กดแถบ = ไปหน้าสถานะ (งานป้าย/โพสต์ที่ผูก) · แก้รายละเอียดจากการ์ด hover หรือหน้าสถานะ */
        return '<button class="cc-bar' + (b.contL ? " contl" : "") + (b.contR ? " contr" : "") + '" data-open="' + it.id +
          '" style="grid-column:' + (b.c0 + 1) + ' / ' + (b.c1 + 2) + ';grid-row:' + (b.lane + 2) + ';background:' + tint(col, .16) + ';color:' + col + ';border-left-color:' + col + '"' +
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
        "<h2>" + MONTHS[m] + " " + be(year) + "</h2>" +
        '<button class="cc-btn" data-newmonth="1">+ แผนทั้งเดือนนี้</button>' +
      "</div>" + banner +
      '<div class="cc-cal"><div class="cc-dow">' + DOW.map(function (x) { return "<div>" + x + "</div>"; }).join("") +
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
    if (mode === "week") {
      /* แผนทั้งเดือนไม่มี "สัปดาห์ที่เท่าไหร่" แยกไว้กลุ่มบนสุด ไม่ปนกับโปรฯ รายสัปดาห์ */
      var plans = list.filter(isMonthPlan);
      if (plans.length) {
        var g0 = bucket("w:month", "แผนทั้งเดือน", "ไม่ผูกกับสัปดาห์ไหน", { scope: "month" }, "0");
        g0.items = plans;
      }
      list.filter(function (it) { return !isMonthPlan(it); }).forEach(function (it) {
        var ws = weekStart(parseISO(it.start)), we = addDays(ws, 6);
        var key = "w:" + isoOf(ws);
        bucket(key, "สัปดาห์ที่ " + weekNo(ws), shortDay(ws) + " – " + shortDay(we),
               { start: isoOf(ws), end: isoOf(we) }, isoOf(ws)).items.push(it);
      });
      /* สัปดาห์นี้ต้องมีช่องให้พิมพ์เสมอ ถึงยังไม่มีโปรฯ สักอัน */
      var nw = weekStart(new Date());
      if (String(nw.getFullYear()) === String(year) && (view.mode !== "month" || nw.getMonth() === view.month || addDays(nw, 6).getMonth() === view.month)) {
        bucket("w:" + isoOf(nw), "สัปดาห์ที่ " + weekNo(nw), shortDay(nw) + " – " + shortDay(addDays(nw, 6)),
               { start: isoOf(nw), end: isoOf(addDays(nw, 6)) }, isoOf(nw));
      }
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
      (view.kind ? [view.kind] : KINDS).forEach(function (k) { bucket("k:" + k, KIND_LABEL[k], "", { kind: k }); });
      list.forEach(function (it) { var g = map["k:" + kindOf(it)]; if (g) g.items.push(it); });
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

  var GRID_COLS = 9;
  function gridRow(it) {
    var brs = (it.branches || []), chs = (it.channels || []);
    return '<tr data-gid="' + it.id + '" style="border-left:3px solid ' + colorOf(it) + '">' +
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
    var what = view.kind ? KIND_LABEL[view.kind] : "รายการ";
    var body = groups.map(function (g) {
      var off = !!collapsed[g.key];
      var money = g.items.reduce(function (a, it) { return a + (Number(it.budget) || 0); }, 0);
      var head = '<tr class="cc-grp' + (off ? " off" : "") + '"><td colspan="' + GRID_COLS + '">' +
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
      "<h2>" + esc(title) + "</h2>" +
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
          "<th>ชื่อ</th><th>ประเภท</th><th>ช่วงวัน</th><th>สถานะ</th><th>สาขา</th><th>ช่องทาง</th><th>งบ</th><th>ผู้รับผิดชอบ</th><th>สื่อที่ผูกไว้</th>" +
          "</tr></thead>" + body + "</table></div>" +
          '<p class="cc-ghint">กดที่ช่องเพื่อแก้ได้เลย · กดหัวกลุ่มเพื่อพับ · ปุ่ม + ท้ายกลุ่มจะเติมสัปดาห์/ประเภท/สาขาให้เอง</p>'
        : '<div class="cc-empty"><p>ยังไม่มี' + esc(what) + "ในช่วงนี้</p>" +
          '<button class="cc-btn primary" data-new="1">เพิ่ม' + esc(what) + "</button></div>");
  }

  /* บันทึกการแก้ทีละช่อง — API รับก้อนเต็ม เลยรวมของเดิมกับของใหม่ก่อนส่ง */
  async function patchItem(id, fields) {
    var it = byId(id);
    if (!it) return;
    var next = Object.assign({}, it, fields);
    var data = { kind: kindOf(next), name: next.name, start: next.start, end: next.end || next.start,
                 scope: next.scope || "range", status: next.status || "plan",
                 channels: next.channels || [], branches: next.branches || [],
                 budget: Number(next.budget) || 0, owner: next.owner || "", note: next.note || "", color: colorOf(next) };
    try {
      if (online) { await api("/campaigns/" + id, { method: "PUT", body: JSON.stringify(data) }); await loadAll(); }
      else { items = items.map(function (x) { return x.id === id ? Object.assign({}, x, data, { id: id }) : x; }); cacheLocal(); }
      render();
    } catch (e) { toast("บันทึกไม่สำเร็จ: " + e.message); render(); }
  }

  /* พิมพ์ชื่อในแถวแล้ว Enter = ได้รายการใหม่ทันที ไม่ต้องเปิดฟอร์ม (แบบ Lark Base) */
  async function quickAdd(name, preset) {
    var start = preset.start || defaultStart();
    var data = { kind: preset.kind || view.kind || "campaign", name: name, start: start,
                 end: preset.end || start, scope: preset.scope === "month" ? "month" : "range",
                 status: preset.status || "plan", channels: [],
                 branches: preset.branch ? [preset.branch] : (view.branch && view.branch !== NO_BRANCH ? [view.branch] : []),
                 budget: 0, owner: "", note: "", color: COLORS[items.length % COLORS.length].v };
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
  var GRID_EDITABLE = { name: 1, budget: 1, owner: 1 };
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
    var opts = [["", "ทุกสาขา", base.length]].concat(BRANCHES.map(function (b) {
      return [b, b, base.filter(function (it) { return inBranch(it, b); }).length];
    }));
    var none = base.filter(function (it) { return inBranch(it, NO_BRANCH); }).length;
    if (none || view.branch === NO_BRANCH) opts.push([NO_BRANCH, "ยังไม่ระบุสาขา", none]);
    el.innerHTML = '<span class="cc-kindlbl">สาขา</span>' + opts.map(function (p) {
      return '<button type="button" class="cc-kind' + (view.branch === p[0] ? " on" : "") + '" data-branch="' + esc(p[0]) + '">' +
        esc(p[1]) + '<span class="cc-kn">' + p[2] + "</span></button>";
    }).join("");
  }

  /* ---------- ชื่อวันใต้ช่องวันที่ — เลือกวันแล้วเห็นเลยว่าตรงจันทร์หรือศุกร์ ---------- */
  function dayHints() {
    var s = $("cc-start").value, e = $("cc-end").value;
    var hs = $("cc-start-day"), he = $("cc-end-day");
    if (!hs || !he) return;
    hs.textContent = s ? "วัน" + DOW_FULL[parseISO(s).getDay()] : "";
    if (!e || !s) { he.textContent = e ? "วัน" + DOW_FULL[parseISO(e).getDay()] : (s ? "ว่างไว้ = วันเดียว" : ""); he.classList.remove("bad"); return; }
    var n = Math.round((parseISO(e) - parseISO(s)) / 864e5) + 1;
    he.textContent = "วัน" + DOW_FULL[parseISO(e).getDay()] + (n > 1 ? " · รวม " + n + " วัน" : "") + (n < 1 ? " · ก่อนวันเริ่ม" : "");
    he.classList.toggle("bad", n < 1);
  }
  ["cc-start", "cc-end"].forEach(function (id) {
    var el = $(id);
    if (el) { el.addEventListener("input", dayHints); el.addEventListener("change", dayHints); }
  });

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
  function attachPeople(inp, onPick) {
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
  attachPeople($("cc-owner"));

  /* ---------- วันนี้ / สัปดาห์นี้ ใต้ปฏิทิน — ตอบคำถาม "วันนี้ต้องทำอะไร" โดยไม่ต้องไล่ทั้งปี ---------- */
  function weekRange() {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return [iso(mon.getFullYear(), mon.getMonth(), mon.getDate()), iso(sun.getFullYear(), sun.getMonth(), sun.getDate())];
  }
  function overlaps(it, a, b) { return it.start <= b && (it.end || it.start) >= a; }
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
      block("สัปดาห์นี้", wa.getDate() + " – " + wb.getDate() + " " + MONTHS[wb.getMonth()], week, "ไม่มี" + what + "อื่นในสัปดาห์นี้") +
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
          /* สถานะงานขึ้นก่อน รายละเอียดย่อไว้ 2 บรรทัด (นนท์: รายละเอียดไม่จำเป็น อยากเห็นสถานะ) */
          statusBlock(it) +
          (it.note ? '<div class="cc-hover-note clamp">' + esc(it.note.replace(/^\[[^\]]*\]\s*/, "")) + "</div>" : "") +
          (linkLine(it) ? '<div class="cc-hover-meta">' + linkLine(it) + "</div>" : "") +
          '<div class="cc-hover-acts"><button type="button" class="cc-hover-btn ghost" data-open="' + it.id + '">เปิดหน้าเต็ม</button>' +
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

  /* ---------- drawer ---------- */
  function buildColors() {
    $("cc-colors").innerHTML = COLORS.map(function (c) {
      return '<button type="button" class="cc-swatch" data-color="' + c.v + '" title="' + c.n +
             '" style="background:' + c.v + '" aria-pressed="false"></button>';
    }).join("");
  }
  function setColor(v) {
    var found = false;
    Array.prototype.forEach.call(document.querySelectorAll("[data-color]"), function (b) {
      var on = b.dataset.color.toLowerCase() === String(v || "").toLowerCase();
      if (on) found = true;
      b.setAttribute("aria-pressed", String(on));
    });
    if (!found) document.querySelector('[data-color="' + DEFAULT_COLOR + '"]').setAttribute("aria-pressed", "true");
  }
  function getColor() {
    var on = document.querySelector('[data-color][aria-pressed="true"]');
    return on ? on.dataset.color : DEFAULT_COLOR;
  }

  function buildChoices() {
    $("cc-channels").innerHTML = CHANNELS.map(function (c) {
      return '<button type="button" class="cc-choice" data-choice="channel" data-v="' + esc(c) + '" aria-pressed="false">' + esc(c) + "</button>";
    }).join("");
    $("cc-branches").innerHTML = BRANCHES.map(function (b) {
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
    var k0 = item ? kindOf(item) : (preset.kind || view.kind || "campaign");
    setSeg("#cc-kind", k0);
    $("ccDrawerTitle").textContent = preset.copyOf ? "ทำสำเนา" + KIND_LABEL[k0] : (item ? "แก้ไข" + KIND_LABEL[k0] : "เพิ่มรายการใหม่");
    $("cc-name").value = preset.copyOf ? dupName(item.name) : (item ? item.name : "");

    var scope = item ? (item.scope || "range") : (presetScope || "range");
    setSeg("#cc-scope", scope);

    var base = item ? parseISO(item.start) : (presetDate ? parseISO(presetDate) : new Date());
    $("cc-month").value = base.getFullYear() + "-" + String(base.getMonth() + 1).padStart(2, "0");
    $("cc-start").value = item ? item.start : (presetDate || todayISO());
    $("cc-end").value = item ? (item.end !== item.start ? item.end : "") : (preset.end || "");
    dayHints();
    applyScopeUI();

    $("cc-budget").value = item && item.budget ? item.budget : "";
    $("cc-owner").value = item ? (item.owner || "") : "";
    $("cc-note").value = item ? (item.note || "") : "";
    $("ccErr").textContent = "";
    /* สำเนาเริ่มที่ "วางแผน" เสมอ ก๊อปโปรฯ ที่จบแล้วมาแล้วขึ้นว่าจบแล้วตั้งแต่ยังไม่ทำ = อ่านผิด */
    setSeg("#cc-status", preset.copyOf ? "plan" : (item ? item.status : (preset.status || "plan")));
    setChoices("channel", item ? item.channels : []);
    /* เพิ่มรายการตอนกรองสาขาอยู่ → ติ๊กสาขานั้นให้เลย */
    setChoices("branch", item ? item.branches : (preset.branch ? [preset.branch] : (view.branch && view.branch !== NO_BRANCH ? [view.branch] : [])));
    setColor(item ? colorOf(item) : COLORS[items.length % COLORS.length].v);
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
    var start, end;

    if (scope === "month") {
      var mv = $("cc-month").value; // YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(mv)) return { error: "เลือกเดือนก่อน" };
      var y = +mv.slice(0, 4), mo = +mv.slice(5, 7) - 1;
      start = iso(y, mo, 1);
      end = iso(y, mo, daysIn(y, mo));
    } else {
      start = $("cc-start").value;
      end = $("cc-end").value || start;
      if (!start) return { error: "เลือกวันเริ่ม" };
      if (end < start) return { error: "วันสิ้นสุดต้องไม่มาก่อนวันเริ่ม" };
    }
    if (!name) return { error: "ใส่ชื่อก่อน" };

    return { value: {
      kind: getSeg("#cc-kind", "campaign"),
      name: name, start: start, end: end, scope: scope,
      status: getSeg("#cc-status", "plan"),
      channels: getChoices("channel"), branches: getChoices("branch"),
      budget: Number($("cc-budget").value) || 0,
      owner: $("cc-owner").value.trim(),
      note: $("cc-note").value.trim(),
      color: getColor()
    } };
  }

  async function submit() {
    var parsed = collect();
    if (parsed.error) { $("ccErr").textContent = parsed.error; return; }
    var data = parsed.value;
    $("ccSave").disabled = true;
    try {
      if (online) {
        if (editingId) {
          await api("/campaigns/" + editingId, { method:"PUT", body: JSON.stringify(data) });
        } else {
          var created = await api("/campaigns", { method:"POST", body: JSON.stringify(data) });
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
      toast(online ? "บันทึกแล้ว" : "บันทึกในเครื่องนี้ (ยังไม่ขึ้นเซิร์ฟเวอร์)");
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
            await api("/campaigns", { method:"POST", body: JSON.stringify({
              name: valid[i].name, start: valid[i].start, end: valid[i].end || valid[i].start,
              scope: valid[i].scope || "range", status: valid[i].status || "plan",
              channels: valid[i].channels || [], branches: valid[i].branches || [],
              budget: valid[i].budget || 0, owner: valid[i].owner || "", note: valid[i].note || "",
              kind: valid[i].kind || "campaign"
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
  $("ccExport").addEventListener("click", exportFile);
  $("ccImport").addEventListener("click", function () { $("ccFile").click(); });
  $("ccFile").addEventListener("change", function (e) {
    if (e.target.files && e.target.files[0]) importFile(e.target.files[0]);
    e.target.value = "";
  });
  $("ccImageInput").addEventListener("change", function (e) {
    if (e.target.files && e.target.files.length) pickFiles(e.target.files);
    e.target.value = "";
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && $("ccDrawer").classList.contains("open")) submit();
  });

  document.addEventListener("click", async function (e) {
    var scopeBtn = e.target.closest("#cc-scope button");
    if (scopeBtn) { setSeg("#cc-scope", scopeBtn.dataset.v); applyScopeUI(); return; }
    var seg = e.target.closest("#cc-status button");
    if (seg) { setSeg("#cc-status", seg.dataset.v); return; }
    var kseg = e.target.closest("#cc-kind button");
    if (kseg) {
      setSeg("#cc-kind", kseg.dataset.v);
      if (!editingId) $("ccDrawerTitle").textContent = "เพิ่ม" + KIND_LABEL[kseg.dataset.v];
      return;
    }
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
        pickCell(cell, KINDS.map(function (k) { return [k, KIND_LABEL[k]]; }), kindOf(it0),
          function (v) { patchItem(it0.id, { kind: v }); });
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
    var sw = e.target.closest("[data-color]");
    if (sw) { setColor(sw.dataset.color); return; }
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
    var mo = e.target.closest("[data-month]");
    /* สลับปี/เดือนต้องไม่ล้างตัวกรองประเภทกับสาขา — เดิม view = {...} ทับทิ้งหมด ทำให้กรองสาขาหลุดพอกดเข้าเดือน */
    if (mo) { view.mode = "month"; view.month = +mo.dataset.month; render(); window.scrollTo({ top:0, behavior:"smooth" }); return; }
    if (e.target.closest("#ccBack")) { view.mode = "year"; view.month = null; render(); return; }
    if (e.target.closest("[data-newmonth]")) { openDrawer(null, iso(year, view.month, 1), "month"); return; }
    var mk = e.target.closest("[data-mk]");
    if (mk) { var itm = byId(mk.dataset.mkid); if (itm) makeMedia(mk.dataset.mk, itm, mk); return; }
    var op = e.target.closest("[data-open]");
    if (op) {
      /* ปุ่ม "เปิดหน้าเต็ม" ในการ์ด → หน้าสถานะเต็ม · กดแถบ/รายการในปฏิทิน → ปักการ์ดสถานะไว้ตรงนี้ */
      if (op.classList.contains("cc-hover-btn")) { location.href = TASKS_BASE + "#/campaign/" + encodeURIComponent(op.dataset.open); return; }
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
  buildColors();
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
