/* ============================================================
   KAN ERP — KPI ฝ่ายการตลาด 2026
   • กรอกผลจริงรายเดือนในตาราง (แบบเดียวกับ Google Sheet)
   • กดบันทึก → ขึ้น Dashboard เป็น %  · กดแก้ไข → กลับไปกรอก
   • ข้อมูลเก็บในเครื่อง (localStorage) แยกตามเดือน
   ต้นทางนิยาม KPI: Google Sheet KAN_KPI_MKT_2026
   ============================================================ */
(function () {
  "use strict";

  var SHEET_URL = "https://docs.google.com/spreadsheets/d/1R6oGsQT5CKLEwr0O_amaMIx6JZjv6cEXohRam_9Qrrg/edit?gid=244265471#gid=244265471";
  var STORE_KEY = "kan-kpi-mkt-2026";

  var MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  /* นิยาม KPI (ดึงจากชีต · เป้า/หน่วย/ทิศทาง/น้ำหนัก/สถานะ)
     dir: hi = สูงดี · lo = ต่ำดี · eq = เท่ากับ · na = ไม่ระบุ
     target = null เมื่อเป็นข้อความ/ยังไม่ตั้งเป้า → ต้องกรอกคะแนนมือ            */
  var KPI = [
    { code: "MKT-01", cat: "Operational Excellence", name: "ความผิดพลาดตั้งค่าสื่อหน้าร้าน (จอ/เสียง)", target: 0, unit: "ครั้ง", dir: "lo", w: 15, status: "ดำเนินการ" },
    { code: "MKT-02", cat: "Operational Excellence", name: "ใช้งบส่วนลดต่อเป้า (Budget Variance)", target: 13, unit: "%", dir: "lo", w: 15, status: "ดำเนินการ" },
    { code: "MKT-03", cat: "Operational Excellence", name: "สรุปรายงานคูปอง/ส่วนลด ส่งผู้บริหารรายสัปดาห์", target: null, unit: "สัปดาห์", dir: "eq", w: 15, status: "ดำเนินการ", note: "เกณฑ์ 'ทุกวันจันทร์' — กรอกเป็น % สัปดาห์ที่ส่งทัน" },
    { code: "MKT-04", cat: "Brand Consistency", name: "ความถูกต้องโพสต์ในเพจสาขา (Compliance)", target: 100, unit: "%", dir: "hi", w: 10, status: "ดำเนินการ" },
    { code: "MKT-05", cat: "Brand Consistency", name: "โพสต์ CSR/แคมเปญตามปฏิทิน (Content)", target: 100, unit: "%", dir: "hi", w: 10, status: "ดำเนินการ" },
    { code: "MKT-06", cat: "Brand Consistency", name: "มาตรฐานจัดบูท/คืนอุปกรณ์ตรงเวลา", target: 95, unit: "%", dir: "hi", w: 5, status: "ดำเนินการ" },
    { code: "MKT-07", cat: "Service Quality", name: "อัตรารับสายโทรศัพท์ (กด 0) + SLA", target: 95, unit: "%", dir: "hi", w: 2, status: "ดำเนินการ" },
    { code: "MKT-08", cat: "Service Quality", name: "ความเร็วรับสาย (ASA)", target: 20, unit: "วินาที", dir: "lo", w: 2, status: "ดำเนินการ" },
    { code: "MKT-09", cat: "Service Quality", name: "จัดทำ Survey ผลตอบรับโปรฯ/บริการ", target: 100, unit: "%", dir: "hi", w: 2, status: "ดำเนินการ" },
    { code: "MKT-10", cat: "Service Quality", name: "ชุดข้อมูล Survey ต่อเดือน", target: 1, unit: "ฉบับ", dir: "hi", w: 2, status: "ดำเนินการ" },
    { code: "MKT-11", cat: "Service Quality", name: "ความพึงพอใจสาขาต่อการสนับสนุนข้อมูล", target: 80, unit: "%", dir: "hi", w: 2, status: "ดำเนินการ" },
    { code: "MKT-12", cat: "การเงิน", name: "ต้นทุนการตลาดต่อรายได้ (Cost to Revenue)", target: 3, unit: "%", dir: "lo", w: 10, status: "ดำเนินการ" },
    { code: "MKT-13", cat: "การเงิน", name: "ความแม่นยำคุมงบรายไตรมาส (Accuracy)", target: 100, unit: "%", dir: "hi", w: 5, status: "ดำเนินการ" },
    { code: "MKT-14", cat: "การเงิน", name: "โตยอดขายจากแคมเปญ (YOY)", target: null, unit: "%", dir: "na", w: 0, status: "เก็บข้อมูล" },
    { code: "MKT-15", cat: "การเงิน", name: "รายได้สื่อโฆษณา (TV ในสาขา/จอ LED)", target: 400000, unit: "บาท", dir: "hi", w: 10, status: "ดำเนินการ", note: "400,000 เป็นเป้าสะสมทั้งปี — กรอกยอดสะสมถึงเดือนนั้น" },
    { code: "MKT-16", cat: "การเงิน", name: "รายได้ใหม่จากขายโฆษณาให้บริษัทนอก", target: null, unit: "บาท", dir: "na", w: 0, status: "เก็บข้อมูล" },
    { code: "MKT-17", cat: "การตลาด", name: "ฐานสมาชิกลูกค้า (คน/เดือน)", target: null, unit: "คน", dir: "hi", w: 0, status: "เก็บข้อมูล" },
    { code: "MKT-18", cat: "การตลาด", name: "ขยายฐานลูกค้าใหม่ (Acquisition/เดือน)", target: 3, unit: "%", dir: "hi", w: 10, status: "ดำเนินการ" },
    { code: "MKT-19", cat: "การตลาด", name: "ทำกิจกรรม/โปรฯ ตาม Marketing Calendar", target: 100, unit: "%", dir: "hi", w: 5, status: "ดำเนินการ" },
    { code: "MKT-20", cat: "การตลาด", name: "ประสิทธิภาพช่องทางโฆษณา (CPA ลดลง)", target: null, unit: "%", dir: "lo", w: 5, status: "ดำเนินการ", note: "ROI ดีขึ้นทุกไตรมาส — กรอกเป็น % ความสำเร็จ" },
    { code: "MKT-21", cat: "การตลาด", name: "Engagement Rate — Facebook", target: 3, unit: "%", dir: "hi", w: 4, status: "ดำเนินการ" },
    { code: "MKT-22", cat: "การตลาด", name: "Engagement Rate — TikTok", target: 3, unit: "%", dir: "hi", w: 4, status: "ดำเนินการ" },
    { code: "MKT-23", cat: "การตลาด", name: "Engagement Rate — Instagram", target: 3, unit: "%", dir: "hi", w: 3, status: "ดำเนินการ" },
    { code: "MKT-24", cat: "การตลาด", name: "Engagement Rate — LINE", target: 1, unit: "%", dir: "hi", w: 4, status: "ดำเนินการ" },
    { code: "MKT-25", cat: "การตลาด", name: "Website Traffic & Conversion", target: 1, unit: "%", dir: "hi", w: 0, status: "ยกเลิก" },
    { code: "MKT-26", cat: "การบริการ", name: "อัตราสายที่ไม่ได้รับ (Abandoned Calls)", target: 3, unit: "%", dir: "lo", w: 10, status: "ดำเนินการ" },
    { code: "MKT-27", cat: "ภาพลักษณ์", name: "ปัญหาลุกลามถึงระดับสีแดง (Crisis)", target: 3, unit: "ครั้ง", dir: "lo", w: 10, status: "ดำเนินการ", note: "3 ครั้ง = เพดานทั้งปี" },
    { code: "MKT-28", cat: "ภาพลักษณ์", name: "ความถูกต้องสื่อ/โพสต์ ตาม Brand Guideline", target: 100, unit: "%", dir: "hi", w: 10, status: "ดำเนินการ" },
    { code: "MKT-29", cat: "ทีมงาน", name: "พัฒนาทักษะพนักงานสำเร็จ (Training/IDP)", target: 100, unit: "%", dir: "hi", w: 5, status: "ดำเนินการ" },
    { code: "MKT-30", cat: "ทีมงาน", name: "เวลาในการค้นหา/ดึงข้อมูลระบบ", target: 30, unit: "วินาที", dir: "lo", w: 5, status: "ดำเนินการ" }
  ];

  // ลำดับหมวด (ตามหัวข้อกลุ่มหลักของ KPI) + สี + ชื่อเต็มสำหรับหัว section
  var CAT_ORDER = ["Operational Excellence", "Brand Consistency", "Service Quality",
                   "การเงิน", "การตลาด", "การบริการ", "ภาพลักษณ์", "ทีมงาน"];
  var CAT_COLOR = {
    "Operational Excellence": "#F2565A", "Brand Consistency": "#2563EB",
    "Service Quality": "#0EA5E9", "การเงิน": "#059669", "การตลาด": "#D97706",
    "การบริการ": "#DB2777", "ภาพลักษณ์": "#7C3AED", "ทีมงาน": "#0E7490"
  };
  var CAT_FULL = {
    "Operational Excellence": "บริหารจัดการระบบโปรโมชั่นและงบประมาณอย่างแม่นยำ (Operational Excellence & Budget Control)",
    "Brand Consistency": "ควบคุมภาพลักษณ์แบรนด์และการสื่อสารของสาขาให้เป็นหนึ่งเดียว (Brand Consistency & Content Monitoring)",
    "Service Quality": "ยกระดับการบริการประสานงานและการรับฟังเสียงลูกค้า (Service Quality & Feedback Loop)",
    "การเงิน": "การเงิน (Financial)",
    "การตลาด": "การตลาด (Marketing)",
    "การบริการ": "การบริการ (Service)",
    "ภาพลักษณ์": "ภาพลักษณ์ (Brand)",
    "ทีมงาน": "ทีมงาน (People)"
  };
  function catFull(c) { return CAT_FULL[c] || c; }

  // รายละเอียดเต็มของแต่ละตัวชี้วัด (ตามชีตต้นทาง) — โชว์ใต้ชื่อย่อ
  var FULLDESC = {
    "MKT-01": "อัตราความผิดพลาดในการตั้งค่าสื่อหน้าร้าน (จอ/เสียง)",
    "MKT-02": "อัตราส่วนการใช้งบประมาณส่วนลดต่อเป้าหมาย (Budget Variance) — ควบคุมการใช้คูปองและส่วนลด",
    "MKT-03": "ระยะเวลาในการตั้งค่าระบบหลังได้รับแคมเปญ (Turnaround Time) — สรุปรายงานยอดการใช้คูปอง/ส่วนลดส่งผู้บริหารได้ทุกสัปดาห์",
    "MKT-04": "อัตราความถูกต้องของโพสต์ในเพจสาขา (Branch Compliance Score) — ตรวจโพสต์ขายของทุกสาขาครบภายในเวลาที่กำหนด",
    "MKT-05": "จำนวนโพสต์ CSR และแคมเปญที่สำเร็จตามแผน (Content Fulfillment) — เนื้อหา CSR/งานบริการ/แคมเปญหลัก ถูกโพสต์ตามปฏิทิน (Content Calendar)",
    "MKT-06": "Event Implementation Standard Compliance — % ของสาขาที่ปฏิบัติตามมาตรฐานการจัดบูทและคืนอุปกรณ์อย่างถูกต้องและตรงเวลา (เป้า >95%)",
    "MKT-07": "อัตราการรับสายโทรศัพท์และโอนสาย (Call Handling Rate) — อัตราการรับสาย (กด 0) และประสานงาน (SLA)",
    "MKT-08": "อัตราการรับสายโทรศัพท์และโอนสาย (Call Handling Rate) — รักษาระดับความเร็วในการรับสาย (ASA) ให้อยู่ในเกณฑ์มาตรฐานสม่ำเสมอทุกช่วงเวลา",
    "MKT-09": "ความแม่นยำในการโอนสายไปยังแผนกที่ถูกต้อง — จัดทำ Survey และรวบรวมผลตอบรับโปรฯ/งานบริการได้ตามจำนวนกลุ่มตัวอย่างที่ตั้งไว้",
    "MKT-10": "จำนวนชุดข้อมูล Survey ที่ได้รับต่อเดือน (Survey Completion) — สรุป Insight จาก Survey เป็นรายงานวิเคราะห์ได้เดือนละ 1 ฉบับ",
    "MKT-11": "ความพึงพอใจของสาขาต่อการสนับสนุนข้อมูล (Internal Service Level) — สรุป Insight จาก Survey เป็นรายงานวิเคราะห์ได้เดือนละ 1 ฉบับ",
    "MKT-12": "อัตราสัดส่วนต้นทุนการตลาดต่อรายได้ (Marketing Cost to Revenue) — บริหารจัดการงบประมาณการตลาดรายเดือน",
    "MKT-13": "ความแม่นยำในการคุมงบประมาณรายไตรมาส (Budget Accuracy) — บริหารจัดการงบประมาณการตลาดรายเดือน",
    "MKT-14": "YOY Sales Growth from Campaigns — % การเติบโตของยอดขายที่มาจากกิจกรรม/โปรฯ โดยตรง (เป้า เช่น +15% จากปีก่อน)",
    "MKT-15": "รายได้จากสื่อโฆษณาภายนอกและภายใน (Proprietary Media Revenue) — ขายสื่อโฆษณา (TV ในสาขา/จอ LED) ให้บรรลุเป้าสะสม 100% รายปี",
    "MKT-16": "New Revenue Stream Generation — มูลค่ารายได้รวมจากการขายบริการโฆษณาให้บริษัทภายนอก (เป้า เช่น รายได้ใหม่ X ล้านบาท/ปี)",
    "MKT-17": "ฐานสมาชิกลูกค้า — จำนวนสมาชิก/คน/เดือน",
    "MKT-18": "อัตราการเข้าถึงกลุ่มเป้าหมายใหม่ (Acquisition Rate) — ขยายฐานลูกค้าใหม่ในพื้นที่ภาคใต้ให้เติบโตเฉลี่ยต่อเดือน",
    "MKT-19": "จำนวนกิจกรรม/โปรโมชั่นที่ลงตาม Marketing Calendar — ทำได้ครบถ้วน โดยไม่มีการเลื่อนกำหนดที่กระทบยอดขาย",
    "MKT-20": "คะแนนประสิทธิภาพของช่องทางโฆษณา (Channel Optimization) — ปรับปรุงทุกช่องทางออนไลน์/ออฟไลน์ ให้ CPA ลดลงต่อเนื่องทุกไตรมาส",
    "MKT-21": "Engagement Rate — Facebook — อัตราการมีส่วนร่วม (Like/Share/Comment) ต่อเนื้อหาทั้งหมด (เป้า สูงกว่าค่าเฉลี่ยอุตสาหกรรม หรือ +X%)",
    "MKT-22": "Engagement Rate — TikTok — อัตราการมีส่วนร่วม (Like/Share/Comment) ต่อเนื้อหาทั้งหมด (เป้า สูงกว่าค่าเฉลี่ยอุตสาหกรรม หรือ +X%)",
    "MKT-23": "Engagement Rate — Instagram — อัตราการมีส่วนร่วม (Like/Share/Comment) ต่อเนื้อหาทั้งหมด (เป้า สูงกว่าค่าเฉลี่ยอุตสาหกรรม หรือ +X%)",
    "MKT-24": "Engagement Rate — LINE — อัตราการมีส่วนร่วม (Like/Share/Comment) ต่อเนื้อหาทั้งหมด (เป้า สูงกว่าค่าเฉลี่ยอุตสาหกรรม หรือ +X%)",
    "MKT-25": "Website Traffic & Conversion Rate — ผู้เข้าชมจาก SEO และอัตรา Conversion (เป้า เพิ่ม Organic Traffic X% และ Conversion Y%)",
    "MKT-26": "อัตราสายที่ไม่ได้รับ (Abandoned Calls) — บริหารกำลังคนและระบบเพื่อลดอัตราสายหลุด",
    "MKT-27": "จำนวนครั้งที่ปัญหาลุกลามถึงระดับสีแดง (Crisis Escalation) — ระงับ/จัดการข้อร้องเรียนหรือประเด็นลบให้จบในระดับสีเหลือง",
    "MKT-28": "อัตราความถูกต้องของสื่อโฆษณาและโพสต์โซเชียลของสาขา — ควบคุมมาตรฐานสื่อ/โพสต์ทุกสาขาให้ตรง Brand Guideline 100%",
    "MKT-29": "อัตราความสำเร็จในการพัฒนาทักษะพนักงาน (Training Completion) — ให้ทีมงานเข้ารับการอบรมพัฒนาทักษะตามแผน IDP ให้สำเร็จ",
    "MKT-30": "Internal Data Retrieval Time — เวลาเฉลี่ยที่ใช้ค้นหา/ดึงข้อมูลที่จัดเก็บในระบบใหม่ (เป้า ลดลง X%)"
  };
  function fullDesc(code) { return FULLDESC[code] || ""; }

  /* ปุ่ม "ที่มา" ข้างช่องกรอก — เปิด popup ดูหน้าต้นทางก่อนยืนยันตัวเลข
     (provenance.js ถือทะเบียนว่า KPI ตัวไหนดึงมาจากหน้าไหน) */
  function provChip(code) {
    if (!window.PROV) return "";
    var ok = window.PROV.has(code);
    return '<button type="button" class="prov-chip' + (ok ? "" : " none") + '" data-prov="' + esc(code) + '" ' +
      'title="' + (ok ? "ดูว่าตัวเลขนี้มาจากไหน" : "ยังไม่มีต้นทางในระบบ — ต้องกรอกมือ") + '">ที่มา</button>';
  }

  // ── โมเดลคะแนน ───────────────────────────────────────────────────────────
  // คืน achievement 0..1 (หรือ null ถ้ากรอกไม่ได้/ยังไม่กรอก)
  function achievement(k, raw) {
    if (raw == null || raw === "") return null;
    var v = parseFloat(String(raw).replace(/[, %]/g, ""));
    if (isNaN(v)) return null;

    // เป้าเป็นข้อความ/ไม่ระบุ → ถือว่าเลขที่กรอกคือ "% ความสำเร็จ" ตรง ๆ
    if (k.target == null || k.dir === "eq" || k.dir === "na") {
      return clamp(v / 100, 0, 1);
    }
    if (k.dir === "hi") {
      if (k.target === 0) return v <= 0 ? 1 : 0;
      return clamp(v / k.target, 0, 1);
    }
    if (k.dir === "lo") {
      if (k.target === 0) return v <= 0 ? 1 : 0;      // เช่น 0 ครั้ง
      if (v <= k.target) return 1;
      return clamp(k.target / v, 0, 1);
    }
    return null;
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function scorable(k) { return k.w > 0 && k.status === "ดำเนินการ"; }

  function fmtTarget(k) {
    if (k.target == null) return "กรอกมือ";
    var t = k.unit === "บาท" ? k.target.toLocaleString("en-US") : k.target;
    var arrow = k.dir === "hi" ? "≥" : k.dir === "lo" ? "≤" : "=";
    return arrow + " " + t + " " + (k.unit || "");
  }
  function fmtPct(x, d) { return (x * 100).toFixed(d == null ? 0 : d) + "%"; }

  // ── สถานะ / localStorage ────────────────────────────────────────────────
  /* SEED — Claude เติมค่าจากไฟล์รายเดือนตรงนี้ ค่าจะขึ้นเป็น "ร่าง" ให้กดยืนยัน
     รูปแบบ: { "m5": { "MKT-01": "0", "MKT-02": "12" }, ... }  (m5 = มิ.ย. · m6 = ก.ค.)
     ที่มาของแต่ละค่า (รอบ มิ.ย.–ก.ค. 2569):
       MKT-02 = ส่วนลดรวม ÷ ยอดขายรวม 3 สาขา (⚠ รวมส่วนลดขายส่ง/เหมาหางด้วย — ยืนยันนิยามก่อน)
       MKT-07/08/26 = จากไฟล์ YALE (มิ.ย. คำนวณจากข้อมูลที่แปลงไว้แล้ว · ก.ค. รอแปลงไฟล์) */
  var SEED = {
    m5: { "MKT-02": "28.1", "MKT-07": "10.5", "MKT-08": "15", "MKT-26": "55" },
    m6: { "MKT-02": "16.2", "MKT-07": "16", "MKT-08": "18", "MKT-26": "43" }
  };

  var state = { month: 5, mode: "dash", data: load() };  // month index (0..11) เริ่มที่ มิ.ย.

  /* เดิมเก็บแต่ localStorage — ข้อมูลหายเวลาเปลี่ยนเครื่อง ล้างเบราว์เซอร์ หรือเปิดคนละโดเมน
     ตอนนี้เก็บบนเซิร์ฟเวอร์ (D1 ผ่าน /api/kpi) และยังเขียน localStorage ไว้เป็นสำเนากันเหนียว */
  var API = "/api";
  var YEAR = 2026;
  var online = false;          // ต่อ API ได้หรือไม่
  var saveTimer = null;

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function load() { return loadLocal(); }

  function saveLocal() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.data)); } catch (e) {}
  }

  function pushServer() {
    if (!online) return Promise.resolve(false);
    return fetch(API + "/kpi", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ year: YEAR, data: state.data })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  /* กดกรอกรัว ๆ ไม่ควรยิง API ทุกครั้ง — รวบให้เหลือครั้งเดียวหลังหยุดพิมพ์ */
  function save() {
    saveLocal();
    if (!online) { setSyncFlag("local"); return; }
    setSyncFlag("saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      pushServer().then(function (ok) { setSyncFlag(ok ? "saved" : "error"); });
    }, 500);
  }

  function setSyncFlag(mode) {
    var el = document.getElementById("kpiSync");
    if (!el) return;
    var map = {
      saving: ["กำลังบันทึก…", "#646A73"],
      saved:  ["บันทึกบนเซิร์ฟเวอร์แล้ว", "#2EA121"],
      error:  ["บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ — ข้อมูลอยู่ในเครื่องนี้", "#F54A45"],
      local:  ["เก็บในเครื่องนี้เท่านั้น (เปิดผ่าน admin.kan-hub.com เพื่อบันทึกให้ทีม)", "#B07D10"]
    };
    var m = map[mode] || map.local;
    el.textContent = m[0];
    el.style.color = m[1];
  }

  /* โหลดจากเซิร์ฟเวอร์ตอนเปิดหน้า — ถ้าเซิร์ฟเวอร์ยังว่างแต่เครื่องนี้มีของเก่า
     ให้ดันของเก่าขึ้นไปแทน (ย้ายข้อมูลที่กรอกไว้ก่อนหน้าโดยไม่ต้องกรอกใหม่) */
  function boot() {
    return fetch(API + "/kpi?year=" + YEAR, { headers: { "accept": "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("no api"); return r.json(); })
      .then(function (res) {
        online = true;
        var server = res.data || {};
        var localData = loadLocal();
        var serverCount = countEntries(server), localCount = countEntries(localData);
        if (serverCount === 0 && localCount > 0) {
          state.data = localData;
          return pushServer().then(function () { setSyncFlag("saved"); });
        }
        state.data = server;
        saveLocal();
        setSyncFlag("saved");
      })
      .catch(function () { online = false; state.data = loadLocal(); setSyncFlag("local"); });
  }

  function countEntries(d) {
    var n = 0;
    for (var k in d) { if (d.hasOwnProperty(k)) { for (var c in d[k]) { if (d[k].hasOwnProperty(c)) n++; } } }
    return n;
  }
  function monthKey(m) { return "m" + (m == null ? state.month : m); }
  function bucket(m) { var k = monthKey(m); return (state.data[k] = state.data[k] || {}); }

  /* entry ปกติเป็น object {v, s} · s='ok'(ยืนยันแล้ว)|'draft'(ร่าง)|'na'(นอกการดำเนินงาน)
     ค่าเก่าที่เป็น string ให้ถือว่า "ยืนยันแล้ว" (backward compatible) */
  function entryOf(m, code) {
    var raw = (state.data[monthKey(m)] || {})[code];
    if (raw == null || raw === "") { return { v: "", ok: false, has: false, na: false }; }
    if (typeof raw === "string") { return { v: raw, ok: true, has: true, na: false }; }
    var v = raw.v == null ? "" : String(raw.v);
    return { v: v, ok: raw.s === "ok", has: v !== "", na: raw.s === "na" };
  }
  function valOf(m, code) { return entryOf(m, code).v; }
  function setEntry(m, code, v, status) {
    var b = bucket(m);
    if (v == null || v === "") { delete b[code]; return; }
    b[code] = { v: String(v), s: status || "draft" };
  }
  function confirmEntry(m, code, ok) {
    var e = entryOf(m, code);
    if (!e.has) return;
    bucket(m)[code] = { v: e.v, s: ok ? "ok" : "draft" };
  }
  /* ทำเครื่องหมาย "นอกการดำเนินงาน" รายเดือน — ถอดน้ำหนักออกจากตัวหาร (ไม่นับ %)
     คืนค่า: ถ้าเคยกรอกไว้กลับเป็น "ร่าง" · ถ้าว่างลบทิ้ง */
  function setNA(m, code, on) {
    var b = bucket(m), e = entryOf(m, code);
    if (on) { b[code] = { v: e.v || "", s: "na" }; }
    else if (e.v) { b[code] = { v: e.v, s: "draft" }; }
    else { delete b[code]; }
  }
  function hasData(m) {
    var d = state.data[monthKey(m)];
    if (!d) return false;
    return Object.keys(d).some(function (c) { return entryOf(m, c).has; });
  }
  function pendingCount(m) {
    var d = state.data[monthKey(m)]; if (!d) return 0;
    var n = 0;
    KPI.forEach(function (k) { if (scorable(k)) { var e = entryOf(m, k.code); if (!e.na && e.has && !e.ok) n++; } });
    return n;
  }
  /* วาง SEED เป็น "ร่าง" โดยไม่ทับของที่กรอก/ยืนยันไว้แล้ว */
  function applySeed() {
    Object.keys(SEED).forEach(function (mk) {
      var mi = +mk.slice(1);
      Object.keys(SEED[mk]).forEach(function (code) {
        if (!entryOf(mi, code).has) { bucket(mi)[code] = { v: String(SEED[mk][code]), s: "draft" }; }
      });
    });
  }

  // ── สรุปคะแนน (นับเฉพาะที่ "ยืนยันแล้ว" · ร่าง = รอยืนยัน) ─────────────────
  function summarize(m) {
    var totW = 0, gotPts = 0, filled = 0, pending = 0, scorableCount = 0;
    var byCat = {};
    KPI.forEach(function (k) {
      if (!scorable(k)) return;
      var e = entryOf(m, k.code);
      if (e.na) return;                 // นอกการดำเนินงาน — ไม่นับในตัวหาร
      scorableCount++;
      totW += k.w;
      var c = byCat[k.cat] || (byCat[k.cat] = { w: 0, pts: 0, filled: 0, pending: 0, n: 0 });
      c.w += k.w; c.n++;
      if (e.has && e.ok) {
        var ach = achievement(k, e.v);
        if (ach != null) { gotPts += ach * k.w; c.pts += ach * k.w; filled++; c.filled++; }
      } else if (e.has && !e.ok) { pending++; c.pending++; }
    });
    return {
      totW: totW, gotPts: gotPts, filled: filled, pending: pending, scorableCount: scorableCount,
      pct: totW ? gotPts / totW : 0, byCat: byCat
    };
  }

  // ── UI ───────────────────────────────────────────────────────────────────
  var host;

  function h(html) { host.innerHTML = html; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function monthPicker() {
    var o = "";
    MONTHS.forEach(function (m, i) {
      o += '<option value="' + i + '"' + (i === state.month ? " selected" : "") + '>' +
           esc(m) + " 2026" + (hasData(i) ? " ✓" : "") + "</option>";
    });
    return '<select id="kpiMonth" class="kpi-msel">' + o + "</select>";
  }

  function achClass(a) {
    if (a == null) return "na";
    if (a >= 0.9) return "good";
    if (a >= 0.6) return "mid";
    return "bad";
  }

  // ---- โหมดกรอก + ยืนยันรายการ ----
  function renderEdit() {
    var s = summarize(state.month);
    var rows = "";
    var lastCat = null;
    KPI.forEach(function (k) {
      if (k.cat !== lastCat) {
        rows += '<tr class="kpi-catrow" data-cat="' + esc(k.cat) + '"><td colspan="8"><span class="kpi-dot" style="background:' +
          (CAT_COLOR[k.cat] || "#888") + '"></span>' + esc(catFull(k.cat)) + "</td></tr>";
        lastCat = k.cat;
      }
      var off = !scorable(k);
      var e = entryOf(state.month, k.code);
      var na = !off && e.na;
      var inactive = off || na;
      var ach = inactive ? null : achievement(k, e.v);
      var manual = (k.target == null || k.dir === "eq" || k.dir === "na");
      var ph = manual ? "% สำเร็จ" : (k.unit === "%" ? "เช่น 91" : "ผลจริง");
      var rowCls = off ? "kpi-off" : na ? "kpi-na" : (e.has && !e.ok ? "kpi-draft" : "");
      rows += '<tr class="' + rowCls + '" data-row="' + k.code + '">' +
        '<td class="kpi-code">' + esc(k.code) + "</td>" +
        '<td><div class="kpi-name">' + esc(k.name) + "</div>" +
          '<div class="kpi-note">' + esc(fullDesc(k.code)) + "</div>" +
          (k.note ? '<div class="kpi-note" style="color:var(--accent-text)">⚑ ' + esc(k.note) + "</div>" : "") + "</td>" +
        '<td class="kpi-num">' + esc(fmtTarget(k)) + "</td>" +
        '<td class="kpi-num">' + k.w + "</td>" +
        '<td>' + (off
          ? '<span class="kpi-tag off">' + esc(k.status) + "</span>"
          : '<div class="kpi-inwrap"><input class="kpi-in" data-code="' + k.code + '" value="' +
            esc(e.v) + '" placeholder="' + esc(ph) + '" inputmode="decimal"' + (na ? " disabled" : "") + ">" +
            '<span class="kpi-unit">' + esc(manual || k.unit === "%" ? "%" : k.unit) + "</span>" +
            provChip(k.code) + "</div>") + "</td>" +
        '<td class="kpi-num"><span class="kpi-score ' + achClass(inactive ? undefined : ach) + '" data-code="' + k.code + '">' +
          (inactive ? "—" : (ach == null ? "—" : fmtPct(ach))) + "</span></td>" +
        '<td class="kpi-confirm-cell" data-code="' + k.code + '">' + (off ? "" : confirmCellHTML(e)) + "</td>" +
        "</tr>";
    });

    var pend = s.pending;
    h(
      headerBar("แก้ไข") +
      '<div class="glass kpi-editwrap">' +
        '<div class="kpi-editbar">' +
          '<div><b>กรอก / ยืนยันผลเดือน ' + esc(MONTHS[state.month]) + " 2026</b>" +
          '<div class="kpi-hint">พิมพ์ค่า → ขึ้นเป็น <span class="kpi-badge-draft">ร่าง</span> · กด <b>ยืนยัน</b> รายตัวถึงจะคิดคะแนน · ' +
          'ค่าที่ผมดึงจากไฟล์จะขึ้นเป็นร่างไว้ให้ตรวจก่อน</div></div>' +
          '<div class="kpi-livepct">คะแนน (เฉพาะที่ยืนยัน) <b id="kpiLive">' + fmtPct(s.pct) + "</b>" +
          (pend ? '<div class="kpi-pendnote" id="kpiPend">รอยืนยัน ' + pend + ' รายการ</div>' : '<div class="kpi-pendnote" id="kpiPend"></div>') + "</div>" +
        "</div>" +
        '<div class="kpi-tablewrap"><table class="kpi-table">' +
          "<thead><tr><th>รหัส</th><th>ตัวชี้วัด</th><th>เป้า</th><th>น้ำหนัก</th>" +
          "<th>ผลจริง / คะแนน</th><th>สำเร็จ</th><th>สถานะ</th></tr></thead>" +
          "<tbody>" + rows + "</tbody></table></div>" +
        '<div class="kpi-actions">' +
          '<button class="kpi-btn ghost" id="kpiClear">ล้างเดือนนี้</button>' +
          '<button class="kpi-btn ghost" id="kpiSync">⇊ ดึงจาก Google Sheet</button>' +
          '<button class="kpi-btn ghost" id="kpiConfirmAll">✓ ยืนยันทั้งหมด</button>' +
          '<span style="flex:1"></span>' +
          '<a class="kpi-btn ghost" href="' + SHEET_URL + '" target="_blank" rel="noopener">เปิด Google Sheet ต้นทาง ↗</a>' +
          '<button class="kpi-btn primary" id="kpiSubmit">ไปหน้า Dashboard →</button>' +
        "</div>" +
      "</div>"
    );

    // ---- events ----
    function refreshRow(code) {
      var k = byCode(code), e = entryOf(state.month, code);
      var na = e.na;
      var ach = na ? null : achievement(k, e.v);
      var sc = host.querySelector('.kpi-score[data-code="' + code + '"]');
      if (sc) { sc.textContent = (na || ach == null) ? "—" : fmtPct(ach); sc.className = "kpi-score " + achClass(na ? undefined : ach); }
      var cell = host.querySelector('.kpi-confirm-cell[data-code="' + code + '"]');
      if (cell) { cell.innerHTML = confirmCellHTML(e); wireConfirmBtn(cell); }
      var inp = host.querySelector('.kpi-in[data-code="' + code + '"]');
      if (inp) { inp.disabled = na; if (na) inp.value = e.v; }
      var tr = host.querySelector('tr[data-row="' + code + '"]');
      if (tr) { tr.classList.toggle("kpi-draft", !na && e.has && !e.ok); tr.classList.toggle("kpi-na", na); }
      var ss = summarize(state.month);
      var live = document.getElementById("kpiLive"); if (live) live.textContent = fmtPct(ss.pct);
      var pn = document.getElementById("kpiPend"); if (pn) pn.textContent = ss.pending ? "รอยืนยัน " + ss.pending + " รายการ" : "";
    }
    function wireConfirmBtn(cell) {
      cell.querySelectorAll(".kpi-cfm").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var code = cell.getAttribute("data-code");
          var act = this.getAttribute("data-act");
          if (act === "na") setNA(state.month, code, true);
          else if (act === "unna") setNA(state.month, code, false);
          else confirmEntry(state.month, code, act === "ok");
          save(); refreshRow(code);
        });
      });
    }
    var inputs = Array.prototype.slice.call(host.querySelectorAll(".kpi-in"));
    inputs.forEach(function (inp, idx) {
      inp.addEventListener("input", function () {
        var code = this.getAttribute("data-code");
        setEntry(state.month, code, this.value, "draft");  // แก้ค่า = กลับเป็นร่าง ต้องยืนยันใหม่
        save(); refreshRow(code);
      });
      // กด Enter = ยืนยันเลย แล้วไปช่องถัดไป (กรอกเร็ว)
      inp.addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        var code = this.getAttribute("data-code");
        if (entryOf(state.month, code).has) { confirmEntry(state.month, code, true); save(); refreshRow(code); }
        for (var j = idx + 1; j < inputs.length; j++) { if (!inputs[j].disabled) { inputs[j].focus(); inputs[j].select(); break; } }
      });
    });
    host.querySelectorAll(".kpi-confirm-cell").forEach(wireConfirmBtn);
    document.getElementById("kpiConfirmAll").addEventListener("click", function () {
      KPI.forEach(function (k) { if (scorable(k) && entryOf(state.month, k.code).has) confirmEntry(state.month, k.code, true); });
      save(); render();
    });
    document.getElementById("kpiSubmit").addEventListener("click", function () {
      save(); state.mode = "dash"; render();
    });
    document.getElementById("kpiClear").addEventListener("click", function () {
      if (!confirm("ล้างข้อมูลที่กรอกของเดือน " + MONTHS[state.month] + " 2026 ?")) return;
      delete state.data[monthKey()]; save(); render();
    });
    document.getElementById("kpiSync").addEventListener("click", syncFromSheet);
    wireProv();
    wireMonth();
    doScroll();   // ถ้ามาจากการคลิกการ์ด ให้เลื่อนไปหมวด/แถวที่ต้องการ
  }

  var provWired = false;
  function wireProv() {
    if (provWired || !host) return;
    provWired = true;
    host.addEventListener("click", function (ev) {
      var b = ev.target && ev.target.closest && ev.target.closest("[data-prov]");
      if (!b || !window.PROV) return;
      var code = b.getAttribute("data-prov"), k = byCode(code);
      window.PROV.open(code, k ? k.name : code);
    });
  }

  /* เลื่อนไป section/แถวที่ตั้งไว้ (จากการคลิกการ์ดในหน้า Dashboard) + ไฮไลต์ชั่วครู่ */
  function doScroll() {
    var t = state.scrollTo; if (!t) return;
    state.scrollTo = null;
    setTimeout(function () {
      var el = t.type === "cat"
        ? host.querySelector('.kpi-catrow[data-cat="' + t.key + '"]')
        : host.querySelector('tr[data-row="' + t.key + '"]');
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("kpi-flash");
      setTimeout(function () { el.classList.remove("kpi-flash"); }, 1600);
    }, 60);
  }

  function confirmCellHTML(e) {
    if (e.na) {
      return '<span class="kpi-st-na">⊘ นอกการดำเนินงาน</span>' +
        '<button class="kpi-cfm undo" data-act="unna">คืนค่า</button>';
    }
    if (!e.has) {
      return '<span class="kpi-st-empty">— ยังไม่กรอก</span>' +
        '<button class="kpi-cfm na" data-act="na">นอกการดำเนินงาน</button>';
    }
    if (e.ok) {
      return '<span class="kpi-st-ok">✓ ยืนยันแล้ว</span>' +
        '<button class="kpi-cfm undo" data-act="draft">แก้</button>';
    }
    return '<span class="kpi-st-draft">● ร่าง</span>' +
      '<button class="kpi-cfm" data-act="ok">ยืนยัน</button>' +
      '<button class="kpi-cfm na" data-act="na">นอกงาน</button>';
  }

  // ---- โหมด dashboard ----
  function renderDash() {
    var s = summarize(state.month);
    var deg = Math.round(s.pct * 360);
    var pctTxt = fmtPct(s.pct);
    var grade = gradeOf(s.pct);

    // การ์ดหมวด
    var catList = CAT_ORDER.filter(function (c) { return s.byCat[c]; });
    var cats = catList.map(function (c) {
      var cc = s.byCat[c], p = cc.w ? cc.pts / cc.w : 0;
      return '<div class="kpi-catcard kpi-clickable" data-cat="' + esc(c) + '">' +
        '<div class="kpi-catcard-h"><span class="kpi-dot" style="background:' + (CAT_COLOR[c] || "#888") + '"></span>' +
          esc(c) + '<span class="kpi-catpct">' + fmtPct(p) + "</span></div>" +
        '<div class="kpi-catfull">' + esc(catFull(c)) + "</div>" +
        '<div class="kpi-bar"><i style="width:' + (p * 100).toFixed(1) + "%;background:" + (CAT_COLOR[c] || "#888") + '"></i></div>' +
        '<div class="kpi-catmeta">' + cc.filled + "/" + cc.n + " ตัวชี้วัดกรอกแล้ว · น้ำหนัก " + cc.w + "</div>" +
        "</div>";
    }).join("");

    // ตารางผล — จัดกลุ่มตามหมวด (section ชัดเจน) ตามลำดับหัวข้อ KPI
    var rows = "";
    CAT_ORDER.forEach(function (c) {
      var members = KPI.filter(function (k) { return k.cat === c; });
      if (!members.length) return;
      var cc = s.byCat[c];
      var cp = cc && cc.w ? cc.pts / cc.w : null;
      rows += '<tr class="kpi-catrow"><td colspan="6">' +
        '<span class="kpi-dot" style="background:' + (CAT_COLOR[c] || "#888") + '"></span>' +
        esc(catFull(c)) +
        (cp != null ? '<span class="kpi-catrow-pct">' + fmtPct(cp) + "</span>" : "") +
        "</td></tr>";
      members.forEach(function (k) {
        var off = !scorable(k);
        var e = entryOf(state.month, k.code);
        var counted = e.has && e.ok;
        var ach = (off || !counted) ? null : achievement(k, e.v);
        var barc = ach == null ? "#C9CCD6" : ach >= 0.9 ? "#16A34A" : ach >= 0.6 ? "#D97706" : "#DC2626";
        var statusTxt = off ? "—"
          : (e.has && !e.ok) ? '<span class="kpi-st-draft">● ร่าง (รอยืนยัน)</span>'
          : ach == null ? "ยังไม่กรอก" : "<b>" + fmtPct(ach) + "</b>";
        rows += '<tr' + (off ? ' class="kpi-off"' : (e.has && !e.ok ? ' class="kpi-draft"' : "")) + '>' +
          '<td class="kpi-code">' + esc(k.code) + "</td>" +
          '<td><div class="kpi-name">' + esc(k.name) + '</div><div class="kpi-note">' + esc(fullDesc(k.code)) + "</div></td>" +
          '<td class="kpi-num">' + esc(fmtTarget(k)) + "</td>" +
          '<td class="kpi-num">' + k.w + "</td>" +
          '<td style="min-width:150px">' + (off
            ? '<span class="kpi-tag off">' + esc(k.status) + "</span>"
            : '<div class="kpi-bar sm"><i style="width:' + (ach == null ? 0 : ach * 100).toFixed(1) + "%;background:" + barc + '"></i></div>') + "</td>" +
          '<td class="kpi-num">' + statusTxt + "</td>" +
          "</tr>";
      });
    });

    h(
      headerBar("dash") +
      '<div class="kpi-dashgrid">' +
        '<div class="glass kpi-gauge-card">' +
          '<div class="kpi-gauge" style="background:conic-gradient(' + gradeColor(s.pct) + " " + deg + "deg,var(--bg-row-divider) " + deg + 'deg)">' +
            '<div class="kpi-gauge-in"><div class="kpi-gauge-pct">' + pctTxt + '</div><div class="kpi-gauge-grade">เกรด ' + grade + "</div></div></div>" +
          '<div class="kpi-gauge-meta">คะแนนรวมถ่วงน้ำหนัก ฝ่ายการตลาด · เดือน ' + esc(MONTHS[state.month]) + " 2026</div>" +
          '<div class="kpi-gauge-sub">คิดจากเฉพาะที่ <b>ยืนยันแล้ว</b> · ได้ ' + s.gotPts.toFixed(1) + " จาก " + s.totW + " คะแนน · ยืนยัน " + s.filled + "/" + s.scorableCount + " ตัวชี้วัด</div>" +
        "</div>" +
        '<div class="kpi-kpirow">' +
          miniStat("ยืนยันแล้ว (คิดคะแนน)", s.filled + " ข้อ", "จาก " + s.scorableCount + " ข้อที่คิดคะแนน", "confirmed") +
          miniStat("รอยืนยัน (ร่าง)", s.pending + " ข้อ", s.pending ? "กดยืนยันในหน้าแก้ไขก่อนถึงจะคิดคะแนน" : "ไม่มีค่าค้างยืนยัน", "pending") +
          miniStat("ผ่านเกณฑ์ (≥90%)", passCount(state.month) + " ข้อ", "ทำได้ตามเป้า", "pass") +
          miniStat("ต้องเร่ง (<60%)", lowCount(state.month) + " ข้อ", "ต่ำกว่าเกณฑ์มาก", "low") +
        "</div>" +
      "</div>" +
      (s.pending ? '<div class="kpi-pendbar">มี <b>' + s.pending + " รายการ</b> ที่ผมดึงมาไว้เป็นร่าง รอให้กดยืนยันในหน้าแก้ไขก่อนถึงจะนับคะแนน " +
        '<button class="kpi-btn primary" id="kpiGoConfirm" style="margin-left:10px">ไปยืนยัน →</button></div>' : "") +

      '<div class="section" style="margin-top:8px"><div class="section-title"><h2>คะแนนแยกตามหมวด</h2>' +
        '<div class="badge">' + catList.length + " หมวด</div></div>" +
        '<div class="kpi-catgrid">' + cats + "</div></div>" +

      '<div class="section"><div class="section-title"><h2>รายตัวชี้วัด</h2>' +
        '<div class="badge">เดือน ' + esc(MONTHS[state.month]) + "</div></div>" +
        '<div class="glass"><div class="kpi-tablewrap"><table class="kpi-table">' +
          "<thead><tr><th>รหัส</th><th>ตัวชี้วัด</th><th>เป้า</th><th>น้ำหนัก</th><th>ความสำเร็จ</th><th>%</th></tr></thead>" +
          "<tbody>" + rows + "</tbody></table></div></div></div>"
    );

    document.getElementById("kpiEdit").addEventListener("click", function () {
      state.mode = "edit"; render();
    });
    var goc = document.getElementById("kpiGoConfirm");
    if (goc) goc.addEventListener("click", function () { state.mode = "edit"; render(); });

    // คลิกการ์ดสรุป → ไปหน้ากรอก แล้วเลื่อนหา KPI ตัวแรกที่เข้าเงื่อนไข
    host.querySelectorAll(".kpi-mini[data-nav]").forEach(function (el) {
      el.addEventListener("click", function () {
        var nav = this.getAttribute("data-nav"), m = state.month, code = null;
        if (nav === "confirmed") code = firstMatch(m, function (k, e) { return e.has && e.ok; });
        else if (nav === "pending") code = firstMatch(m, function (k, e) { return e.has && !e.ok; });
        else if (nav === "pass") code = firstMatch(m, function (k, e) { var a = achievement(k, e.v); return e.has && e.ok && a != null && a >= 0.9; });
        else if (nav === "low") code = firstMatch(m, function (k, e) { var a = achievement(k, e.v); return e.has && e.ok && a != null && a < 0.6; });
        state.scrollTo = code ? { type: "row", key: code } : null;
        state.mode = "edit"; render();
      });
    });
    // คลิกการ์ดหมวด → ไปหน้ากรอก แล้วเลื่อนไปหัว section หมวดนั้น
    host.querySelectorAll(".kpi-catcard[data-cat]").forEach(function (el) {
      el.addEventListener("click", function () {
        state.scrollTo = { type: "cat", key: this.getAttribute("data-cat") };
        state.mode = "edit"; render();
      });
    });
    wireMonth();
  }

  // นับเฉพาะที่ "ยืนยันแล้ว"
  function passCount(m) {
    var n = 0;
    KPI.forEach(function (k) { if (scorable(k)) { var e = entryOf(m, k.code); if (!e.na && e.has && e.ok) { var a = achievement(k, e.v); if (a != null && a >= 0.9) n++; } } });
    return n;
  }
  function lowCount(m) {
    var n = 0;
    KPI.forEach(function (k) { if (scorable(k)) { var e = entryOf(m, k.code); if (!e.na && e.has && e.ok) { var a = achievement(k, e.v); if (a != null && a < 0.6) n++; } } });
    return n;
  }
  /* หา KPI ตัวแรกที่เข้าเงื่อนไข (สำหรับคลิกการ์ดแล้วเลื่อนไปหา) */
  function firstMatch(m, pred) {
    for (var i = 0; i < KPI.length; i++) {
      var k = KPI[i]; if (!scorable(k)) continue;
      var e = entryOf(m, k.code); if (e.na) continue;
      if (pred(k, e)) return k.code;
    }
    return null;
  }
  function gradeOf(p) {
    var s = p * 100;
    return s >= 90 ? "S" : s >= 80 ? "A" : s >= 70 ? "B" : s >= 60 ? "C" : "D";
  }
  function gradeColor(p) {
    var s = p * 100;
    return s >= 90 ? "#16A34A" : s >= 80 ? "#22C55E" : s >= 70 ? "#D97706" : s >= 60 ? "#EA580C" : "#DC2626";
  }
  function miniStat(label, val, sub, nav) {
    return '<div class="kpi-mini' + (nav ? " kpi-clickable" : "") + '"' + (nav ? ' data-nav="' + nav + '"' : "") + '>' +
      '<div class="kpi-mini-l">' + esc(label) + '</div>' +
      '<div class="kpi-mini-v">' + esc(val) + '</div><div class="kpi-mini-s">' + esc(sub) +
      (nav ? '<span class="kpi-goto">ไปกรอก →</span>' : "") + "</div></div>";
  }

  function headerBar(mode) {
    var right = mode === "dash"
      ? '<button class="kpi-btn primary" id="kpiEdit">✎ แก้ไขข้อมูล</button>'
      : "";
    return '<div class="kpi-top">' +
      '<div class="kpi-top-l"><span class="kpi-eyebrow">KAN MKT · KPI</span>' +
      '<h1>KPI ฝ่ายการตลาด 2026</h1>' +
      '<div class="sub">กรอกผลจริงรายเดือน แล้วดูคะแนนรวมถ่วงน้ำหนักเป็นเปอร์เซ็นต์ · ต้นทางนิยามจาก Google Sheet</div></div>' +
      '<div class="kpi-top-r">' + monthPicker() + right + "</div></div>";
  }

  function wireMonth() {
    var sel = document.getElementById("kpiMonth");
    if (sel) sel.addEventListener("change", function () {
      state.month = parseInt(this.value, 10);
      render();
    });
  }

  function byCode(code) {
    for (var i = 0; i < KPI.length; i++) if (KPI[i].code === code) return KPI[i];
    return null;
  }

  // ── ดึงข้อมูลจาก Google Sheet (ต้อง "เผยแพร่ทางเว็บ → CSV" ก่อน) ─────────
  var SYNC_KEY = "kan-kpi-csv-url";

  function parseCSV(text) {
    var rows = [], row = [], cur = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else {
        if (c === '"') q = true;
        else if (c === ",") { row.push(cur); cur = ""; }
        else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
        else if (c === "\r") { /* skip */ }
        else cur += c;
      }
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  function syncFromSheet() {
    var saved = "";
    try { saved = localStorage.getItem(SYNC_KEY) || ""; } catch (e) {}
    var url = prompt(
      "วางลิงก์ CSV ที่เผยแพร่จาก Google Sheet\n\n" +
      "วิธีได้ลิงก์: ในชีต → ไฟล์ → แชร์ → เผยแพร่ทางเว็บ → เลือกชีต KPI → รูปแบบ CSV → คัดลอกลิงก์\n" +
      "(ระบบจะดึงคอลัมน์ 'ผลจริง " + MONTHS[state.month] + "' มาใส่เดือนที่เลือก)", saved);
    if (!url) return;
    try { localStorage.setItem(SYNC_KEY, url.trim()); } catch (e) {}

    fetch(url.trim()).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (text) {
      var rows = parseCSV(text);
      if (!rows.length) throw new Error("ไฟล์ว่าง");
      // หาแถวหัวตาราง (มีคำว่า 'รหัส')
      var hi = -1;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].some(function (c) { return String(c).trim() === "รหัส"; })) { hi = i; break; }
      }
      if (hi < 0) throw new Error("ไม่พบหัวตาราง 'รหัส' — ตรวจว่าเผยแพร่ชีต KPI ถูกแท็บ");
      var header = rows[hi].map(function (c) { return String(c).trim(); });
      var codeCol = header.indexOf("รหัส");
      var actCol = header.indexOf("ผลจริง " + MONTHS[state.month]);
      if (actCol < 0) throw new Error("ไม่พบคอลัมน์ 'ผลจริง " + MONTHS[state.month] + "'");

      var n = 0;
      for (var j = hi + 1; j < rows.length; j++) {
        var code = String(rows[j][codeCol] || "").trim();
        if (!/^MKT-\d+/.test(code)) continue;
        var val = String(rows[j][actCol] == null ? "" : rows[j][actCol]).trim();
        if (val !== "") { setEntry(state.month, code, val, "draft"); n++; }  // ดึงมา = ร่าง ให้ยืนยันก่อน
      }
      save();
      alert("ดึงข้อมูลเดือน " + MONTHS[state.month] + " สำเร็จ — วางเป็นร่าง " + n + " ตัวชี้วัด\nกดยืนยันรายตัวในตารางก่อนถึงจะคิดคะแนน");
      render();
    }).catch(function (err) {
      alert("ดึงข้อมูลไม่สำเร็จ: " + err.message +
        "\n\nสาเหตุที่พบบ่อย:\n• ยังไม่ได้ 'เผยแพร่ทางเว็บ' เป็น CSV (ลิงก์ต้องลงท้าย output=csv)\n" +
        "• วางลิงก์แก้ไขปกติแทนลิงก์เผยแพร่\n\nถ้าไม่สะดวก ใช้วิธีกรอกในตารางนี้ได้เลย");
    });
  }

  function render() {
    if (state.mode === "dash" && !hasData(state.month)) state.mode = "edit";
    if (state.mode === "edit") renderEdit(); else renderDash();
  }

  document.addEventListener("DOMContentLoaded", function () {
    host = document.getElementById("kpiApp");
    if (!host) return;
    // ล้างข้อมูล KPI ทั้งหมดผ่าน kpi.html?reset (เครื่องมือแอดมิน)
    if (/[?&]reset/.test(location.search)) {
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      state.data = {};
      fetch(API + "/kpi", { method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ year: YEAR, data: {} }) })
        .catch(function () {})
        .then(function () { location.replace("kpi.html"); });
      return;
    }
    host.innerHTML = '<div style="padding:40px;color:var(--text-muted);font-size:14px">กำลังโหลดข้อมูล KPI…</div>';
    /* เข้าจากเมนู "กรอกผล KPI" ให้เปิดโหมดกรอกเลย ไม่ต้องกดปุ่มแก้ไขซ้ำ */
    var wantEdit = /[?&]mode=edit/.test(location.search);
    boot().then(function () {
      applySeed();   // วางค่าจากไฟล์ (ถ้ามี) เป็นร่าง
      // เริ่มที่เดือนล่าสุดที่มีข้อมูล ถ้ามี
      for (var m = 11; m >= 0; m--) { if (hasData(m)) { state.month = m; state.mode = "dash"; break; } }
      if (wantEdit) { state.mode = "edit"; }
      render();
      if (online) { save(); }   // เผื่อ applySeed เติมค่าใหม่ ให้ขึ้นเซิร์ฟเวอร์ด้วย
    });
  });

  // เผยแพร่ให้ debug/ทดสอบ
  window.KAN_KPI = { KPI: KPI, achievement: achievement, summarize: summarize, state: state,
    render: render, entryOf: entryOf, setEntry: setEntry, confirmEntry: confirmEntry,
    save: save, isOnline: function () { return online; } };
})();
