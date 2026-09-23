/* ============================================================
   KAN — บรอดแคสต์ LINE OA + SMS  (โหมดจำลอง)
   ------------------------------------------------------------
   ตอนนี้ยังไม่ได้ต่อ LINE Messaging API จริง (ยังไม่มี channel access token)
   ทุกอย่างในไฟล์นี้จึง "เดินระบบครบ" แต่ตอนส่งจะบันทึกผลลงฐานข้อมูลแทนการยิงออกไปข้างนอก
   → ทีมใช้งานจริงได้ทั้งขั้นตอน พอได้ token มาค่อยสลับ sendViaLine() อันเดียว ที่เหลือไม่ต้องแก้

   เส้นทางงานที่ออกแบบไว้ (นนท์สั่ง 23 ก.ย. 69):
     คุณออนบรีฟโปร → เปิดงานประเภท "LINE OA" → ทีมแนบรูปในงาน
     → กดปุ่ม "บรอดแคสต์จากงานนี้" ในหน้างาน → เลือกเพจ (เดี่ยว/หลาย/ทั้งหมด)
     → เลือกคนรับ (ทุกคน/กรองกลุ่ม/เลือกรายคน) → ส่ง → ผลกลับไปขึ้นในงานเป็นความคืบหน้า
   ============================================================ */

const LINE_MODE = "mock";   /* mock = ยังไม่ยิงออกจริง · live = ต่อ API แล้ว (ยังไม่เปิด) */

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}
function nowIso() { return new Date().toISOString(); }
function newId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
async function readBody(request) {
  try { return await request.json(); } catch (e) { return {}; }
}
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const arr = (v) => (Array.isArray(v) ? v : []);

/* ---------- ตาราง ---------- */
const BLAST_SCHEMA = [
  /* เพจ LINE OA ที่ยิงได้ — เก็บเป็นแถว ไม่ใช่ค่าคงที่ เพราะ KAN มีหลายเพจและเพิ่มได้เรื่อย ๆ
     token/secret ปล่อยว่างไว้ก่อน (โหมดจำลอง) · ใส่แล้วหน้าเว็บจะเห็นแค่ 4 ตัวท้าย */
  "CREATE TABLE IF NOT EXISTS line_channels (" +
    "id TEXT PRIMARY KEY, name TEXT NOT NULL, basic_id TEXT NOT NULL DEFAULT '', " +
    "color TEXT NOT NULL DEFAULT '#06C755', token TEXT NOT NULL DEFAULT '', secret TEXT NOT NULL DEFAULT '', " +
    "quota_limit INTEGER NOT NULL DEFAULT 0, quota_used INTEGER NOT NULL DEFAULT 0, " +
    "page_id TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', " +
    "active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)",
  /* ผู้ติดตามรายคน — ของจริงจะได้ userId ตอนคนทักเข้ามา (webhook) ตอนนี้เป็นข้อมูลจำลอง
     ต้องมีตารางนี้ถึงจะ "เลือกส่งรายคน/รายกลุ่ม" ได้ ส่งหาทุกคนอย่างเดียวไม่ต้องใช้ */
  "CREATE TABLE IF NOT EXISTS line_users (" +
    "id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, display_name TEXT NOT NULL DEFAULT '', " +
    "tags TEXT NOT NULL DEFAULT '', branch TEXT NOT NULL DEFAULT '', " +
    "bought INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0, " +
    "phone TEXT NOT NULL DEFAULT '', followed_at TEXT NOT NULL, last_active TEXT)",
  "CREATE INDEX IF NOT EXISTS idx_line_users_ch ON line_users(channel_id, blocked)",
  /* ใบบรอดแคสต์ 1 ใบ = 1 ครั้งที่กดส่ง (ยิงได้หลายเพจในใบเดียว) */
  "CREATE TABLE IF NOT EXISTS blasts (" +
    "id TEXT PRIMARY KEY, title TEXT NOT NULL, task_id TEXT, campaign_id TEXT, " +
    "channels TEXT NOT NULL DEFAULT '[]', audience TEXT NOT NULL DEFAULT '{}', " +
    "line_on INTEGER NOT NULL DEFAULT 1, sms_on INTEGER NOT NULL DEFAULT 0, " +
    "messages TEXT NOT NULL DEFAULT '[]', sms_text TEXT NOT NULL DEFAULT '', " +
    "status TEXT NOT NULL DEFAULT 'draft', mode TEXT NOT NULL DEFAULT 'mock', " +
    "scheduled_at TEXT, sent_at TEXT, " +
    "n_target INTEGER NOT NULL DEFAULT 0, n_sent INTEGER NOT NULL DEFAULT 0, n_fail INTEGER NOT NULL DEFAULT 0, " +
    "created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_blasts_status ON blasts(status, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_blasts_task ON blasts(task_id)",
  /* ผลรายคน — ไว้ดูว่าใครไม่ถึง และยิงซ้ำเฉพาะที่พลาดได้ */
  "CREATE TABLE IF NOT EXISTS blast_targets (" +
    "id TEXT PRIMARY KEY, blast_id TEXT NOT NULL, channel_id TEXT NOT NULL DEFAULT '', " +
    "ch TEXT NOT NULL DEFAULT 'line', user_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', " +
    "dest TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'sent', err TEXT NOT NULL DEFAULT '', " +
    "sent_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_blast_targets ON blast_targets(blast_id, status)",
  /* ริชเมนู (แบนเนอร์ปุ่มล่างจอในแชท) — สลับได้ทั้งเพจ หรือตั้งเวลาให้เปลี่ยนเอง */
  "CREATE TABLE IF NOT EXISTS rich_menus (" +
    "id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, name TEXT NOT NULL, " +
    "size TEXT NOT NULL DEFAULT 'full', image TEXT NOT NULL DEFAULT '', image_name TEXT NOT NULL DEFAULT '', " +
    "areas TEXT NOT NULL DEFAULT '[]', is_default INTEGER NOT NULL DEFAULT 0, apply_at TEXT, " +
    "task_id TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_rich_ch ON rich_menus(channel_id, is_default)",
];

let blastReady = false;
export async function ensureBlastSchema(db) {
  if (blastReady) return;
  await db.batch(BLAST_SCHEMA.map((s) => db.prepare(s)));
  blastReady = true;
  await seedMock(db);
}

/* ============================================================
   ข้อมูลจำลอง — รันครั้งเดียว (ธง blast_seeded ใน task_settings)
   ตั้งใจให้เหมือนของจริงพอที่จะลองใช้ได้ทุกปุ่ม: เพจตรงกับเพจที่ทีมโพสต์อยู่จริง
   ผู้ติดตามมีแท็ก/สาขา/เคยซื้อ จะได้ลองกรองกลุ่มแล้วเห็นตัวเลขขยับ
   พอต่อ LINE จริง ให้ลบผู้ติดตามจำลองทิ้ง (ปุ่มในหน้า "ตั้งค่า") แล้วให้ webhook เก็บของจริงแทน
   ============================================================ */
const CHANNEL_SEED = [
  { id: "ch_hub",     name: "Kan Hub",        basic: "@kanhub",     color: "#0E9BA8", page: "pg_hub",     quota: 30000, used: 8420,  n: 78 },
  { id: "ch_kst1",    name: "KST#1 ชุมพร",     basic: "@kst.chumphon", color: "#7A5CF0", page: "pg_kst1",  quota: 15000, used: 3110,  n: 54 },
  { id: "ch_kst3",    name: "KST#3 สุราษฎร์",  basic: "@kst.surat",  color: "#F2565A", page: "pg_kst3",    quota: 15000, used: 4980,  n: 61 },
  { id: "ch_fashion", name: "Kan Fashion",    basic: "@kanfashion", color: "#E08A1E", page: "pg_fashion", quota: 8000,  used: 1240,  n: 39 },
];
const FIRST_TH = ["สมชาย", "สุนิสา", "ปรีชา", "อรทัย", "ณัฐพล", "กมลวรรณ", "ธีรยุทธ", "พิมพ์ชนก", "วีระ", "จันทร์เพ็ญ",
  "อนุชา", "ศิริพร", "ทศพล", "นฤมล", "ภานุวัฒน์", "เบญจวรรณ", "สุรชัย", "ปาริชาต", "กิตติศักดิ์", "มณีรัตน์",
  "ชัยวัฒน์", "ดวงใจ", "พงษ์ศักดิ์", "รัตนา", "อภิชาติ", "สุพรรณี", "เอกชัย", "วราภรณ์", "ยุทธนา", "ทิพวรรณ"];
const LAST_TH = ["ใจดี", "แสงทอง", "ศรีสุข", "พรหมมา", "บุญมี", "ทองคำ", "เพชรรัตน์", "ชูเกียรติ", "อินทร์ทอง", "สายสุวรรณ",
  "ดวงแก้ว", "มณีโชติ", "วงศ์คำ", "จันทร์ฉาย", "เรืองศรี", "ขาวสะอาด", "ภู่ระหงษ์", "กล้าหาญ", "นาคสุข", "ปานทอง"];
const NICK_EN = ["Ploy", "Bank", "Nan", "Mos", "Fern", "Gap", "Aom", "Tar", "Beam", "Nut", "Peach", "Boss", "May", "Ton", "Ice"];
const TAG_POOL = ["ลูกค้าประจำ", "สนใจโปร", "ทักจากแอด", "สมาชิกบัตร", "ซื้อล็อตใหม่", "รอของเข้า"];
const BRANCH_POOL = ["Kan Hub", "Kan Fashion", "ชุมพร", "สุราษฎร์", ""];

/* สุ่มแบบมีเมล็ด — รันกี่ครั้งก็ได้ข้อมูลชุดเดิม (จะได้ไม่งงเวลาเทียบตัวเลขกับที่เคยเห็น) */
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
async function seedMock(db) {
  const flag = await db.prepare("SELECT value FROM task_settings WHERE key = 'blast_seeded'").first().catch(() => null);
  if (flag && flag.value) return;
  const now = nowIso();
  const stmts = [];
  CHANNEL_SEED.forEach((c, i) => {
    stmts.push(db.prepare(
      "INSERT OR IGNORE INTO line_channels (id,name,basic_id,color,page_id,quota_limit,quota_used,active,sort,created_at) " +
      "VALUES (?,?,?,?,?,?,?,1,?,?)"
    ).bind(c.id, c.name, c.basic, c.color, c.page, c.quota, c.used, i, now));
  });
  const rnd = mulberry(20690923);
  const today = Date.now();
  CHANNEL_SEED.forEach((c, ci) => {
    for (let i = 0; i < c.n; i++) {
      const useNick = rnd() < 0.35;
      const name = useNick
        ? NICK_EN[Math.floor(rnd() * NICK_EN.length)] + " " + LAST_TH[Math.floor(rnd() * LAST_TH.length)]
        : FIRST_TH[Math.floor(rnd() * FIRST_TH.length)] + " " + LAST_TH[Math.floor(rnd() * LAST_TH.length)];
      const tags = [];
      TAG_POOL.forEach((t) => { if (rnd() < 0.22) tags.push(t); });
      const bought = rnd() < 0.38 ? 1 : 0;
      if (bought && tags.indexOf("ลูกค้าประจำ") === -1 && rnd() < 0.4) tags.push("ลูกค้าประจำ");
      const daysAgo = Math.floor(rnd() * 420);
      const phone = "08" + Math.floor(rnd() * 9 + 1) + String(Math.floor(rnd() * 10000000)).padStart(7, "0");
      stmts.push(db.prepare(
        "INSERT OR IGNORE INTO line_users (id,channel_id,display_name,tags,branch,bought,blocked,phone,followed_at,last_active) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?)"
      ).bind(
        "U" + String(ci) + String(i).padStart(3, "0") + Math.random().toString(36).slice(2, 10),
        c.id, name, tags.join(","),
        BRANCH_POOL[Math.floor(rnd() * BRANCH_POOL.length)],
        bought, rnd() < 0.06 ? 1 : 0, phone,
        new Date(today - daysAgo * 86400000).toISOString(),
        new Date(today - Math.floor(rnd() * daysAgo + 1) * 86400000).toISOString()
      ));
    }
  });
  /* ริชเมนูตั้งต้นของแต่ละเพจ — ยังไม่มีรูป ทีมเข้าไปอัปทับได้ */
  CHANNEL_SEED.forEach((c) => {
    stmts.push(db.prepare(
      "INSERT OR IGNORE INTO rich_menus (id,channel_id,name,size,areas,is_default,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ).bind("rm_" + c.id + "_base", c.id, "เมนูหลัก", "full", JSON.stringify([
      { label: "โปรเดือนนี้", type: "uri", value: "https://kan-hub.com/promo" },
      { label: "สินค้าใหม่", type: "uri", value: "https://kan-hub.com/new" },
      { label: "สาขาใกล้ฉัน", type: "uri", value: "https://kan-hub.com/branch" },
      { label: "ทักแชท", type: "message", value: "สอบถามสินค้า" },
      { label: "สมัครสมาชิก", type: "uri", value: "https://kan-hub.com/member" },
      { label: "ติดตามพัสดุ", type: "message", value: "ติดตามพัสดุ" },
    ]), 1, "system", now, now));
  });
  for (let i = 0; i < stmts.length; i += 40) await db.batch(stmts.slice(i, i + 40));
  await db.prepare("INSERT OR REPLACE INTO task_settings (key,value) VALUES ('blast_seeded', ?)").bind(now).run();
}

/* ============================================================
   คนรับ — แปลง "เงื่อนไขที่เลือกบนหน้าจอ" เป็นรายชื่อจริง
   kind: all    = ผู้ติดตามทุกคนของเพจนั้น (ของจริงคือ LINE broadcast ยิงทีเดียวจบ)
         filter = กรองด้วยแท็ก/สาขา/เคยซื้อ/เพิ่งแอด (ของจริงคือ multicast ครั้งละ 500 คน)
         pick   = ติ๊กเลือกรายคนเอง
   ============================================================ */
function cleanAudience(a) {
  a = a && typeof a === "object" ? a : {};
  const kind = ["all", "filter", "pick"].indexOf(a.kind) !== -1 ? a.kind : "all";
  return {
    kind,
    tags: arr(a.tags).map((x) => str(x, 40)).filter(Boolean).slice(0, 10),
    branches: arr(a.branches).map((x) => str(x, 40)).filter(Boolean).slice(0, 10),
    bought: ["any", "yes", "no"].indexOf(a.bought) !== -1 ? a.bought : "any",
    newDays: Math.max(0, Math.min(365, Math.round(Number(a.newDays) || 0))),
    quietDays: Math.max(0, Math.min(365, Math.round(Number(a.quietDays) || 0))),
    ids: arr(a.ids).map((x) => str(x, 60)).filter(Boolean).slice(0, 2000),
  };
}
function cleanSms(s) {
  s = s && typeof s === "object" ? s : {};
  return {
    useLine: !!s.useLine,       /* ใช้เบอร์ของคนที่เลือกไว้ฝั่ง LINE */
    leads: !!s.leads,           /* บวกลีดใน CRM */
    leadStatus: arr(s.leadStatus).map((x) => str(x, 20)).filter(Boolean).slice(0, 12),
    numbers: str(s.numbers, 20000),   /* วางเบอร์เองทีละบรรทัด */
  };
}
function phoneList(text) {
  const out = [];
  const seen = new Set();
  String(text || "").split(/[\s,;]+/).forEach((raw) => {
    const d = String(raw).replace(/[^0-9]/g, "");
    if (d.length < 9 || d.length > 12) return;
    const n = d.startsWith("66") ? "0" + d.slice(2) : d;
    if (seen.has(n)) return;
    seen.add(n);
    out.push(n);
  });
  return out.slice(0, 5000);
}
async function usersFor(db, channelId, aud) {
  const where = ["channel_id = ?"];
  const vals = [channelId];
  if (aud.kind === "pick") {
    if (!aud.ids.length) return [];
    /* ห้ามยัด IN (?,?,…) เกิน ~90 ตัว — D1 รับตัวแปรได้ 100 ตัวต่อคำสั่ง (บทเรียนจากงานป้าย)
       เลือกเยอะ ๆ จึงดึงทั้งเพจมากรองในหน่วยความจำแทน */
    const all = await db.prepare("SELECT * FROM line_users WHERE channel_id = ?").bind(channelId).all();
    const want = new Set(aud.ids);
    return (all.results || []).filter((u) => want.has(u.id));
  }
  if (aud.kind === "filter") {
    if (aud.bought === "yes") where.push("bought = 1");
    if (aud.bought === "no") where.push("bought = 0");
    if (aud.branches.length) where.push("(" + aud.branches.map(() => "branch = ?").join(" OR ") + ")");
    aud.branches.forEach((b) => vals.push(b));
    if (aud.newDays) { where.push("followed_at >= ?"); vals.push(new Date(Date.now() - aud.newDays * 86400000).toISOString()); }
    if (aud.quietDays) { where.push("(last_active IS NULL OR last_active <= ?)"); vals.push(new Date(Date.now() - aud.quietDays * 86400000).toISOString()); }
  }
  const res = await db.prepare("SELECT * FROM line_users WHERE " + where.join(" AND ")).bind(...vals).all();
  let list = res.results || [];
  /* แท็กเก็บเป็นข้อความคั่นคอมมา — กรองในโค้ดจะตรงกว่าใช้ LIKE (แท็กชื่อซ้อนกันได้) */
  if (aud.kind === "filter" && aud.tags.length) {
    list = list.filter((u) => {
      const t = String(u.tags || "").split(",").map((x) => x.trim());
      return aud.tags.some((x) => t.indexOf(x) !== -1);
    });
  }
  return list;
}
/* นับคนรับล่วงหน้า (ยังไม่ส่ง) — หน้าจอเรียกทุกครั้งที่เปลี่ยนเงื่อนไข จะได้เห็นตัวเลขขยับสด ๆ */
async function countFor(db, channelIds, aud) {
  const out = [];
  for (const cid of channelIds) {
    const users = await usersFor(db, cid, aud);
    out.push({
      channelId: cid,
      total: users.length,
      reach: users.filter((u) => !u.blocked).length,
      blocked: users.filter((u) => u.blocked).length,
      phones: users.filter((u) => !u.blocked && u.phone).length,
    });
  }
  return out;
}

/* ---------- ส่งจริง (ตอนนี้ยังเป็นการจำลอง) ----------
   พอได้ channel access token มา ให้เปลี่ยนแค่ฟังก์ชันนี้:
     kind 'all'  → POST https://api.line.me/v2/bot/message/broadcast
     kind อื่น   → POST https://api.line.me/v2/bot/message/multicast  (ครั้งละ 500 userId)
   ที่เหลือ (นับคน บันทึกผล ตัดโควตา เขียนกลับเข้างาน) ใช้ของเดิมได้ทั้งหมด */
async function sendViaLine(channel, users, messages) {
  if (LINE_MODE === "mock" || !channel.token) {
    return { mode: "mock", ok: users.length, fail: 0 };
  }
  return { mode: "live", ok: users.length, fail: 0 };
}

const MAX_TARGET_ROWS = 3000;   /* เก็บผลรายคนได้ถึงเท่านี้ เกินกว่านี้เก็บแค่ยอดรวม */

async function doSend(db, row, meId) {
  const chIds = JSON.parse(row.channels || "[]");
  const aud = cleanAudience(JSON.parse(row.audience || "{}"));
  /* เงื่อนไขฝั่ง SMS เก็บรวมไว้ในก้อน audience (audience.sms) จะได้เป็นใบเดียวกัน */
  const smsOpt = cleanSms(JSON.parse(row.audience || "{}").sms);
  const now = nowIso();
  const messages = JSON.parse(row.messages || "[]");
  const stmts = [];
  let nSent = 0, nFail = 0, nSkip = 0, rows = 0;
  const perChannel = [];

  if (row.line_on) {
    for (const cid of chIds) {
      const ch = await db.prepare("SELECT * FROM line_channels WHERE id = ?").bind(cid).first();
      if (!ch) continue;
      const users = await usersFor(db, cid, aud);
      const live = users.filter((u) => !u.blocked);
      const blocked = users.filter((u) => u.blocked);
      /* โควตาข้อความของแพ็กเกจ LINE เดือนนั้น — ของจริงยิงเกินแล้วโดนคิดเงิน/ตีกลับ
         จำลองให้ตัดตรงนี้เลย ทีมจะได้เห็นว่าเพจไหนใกล้เต็มก่อนกดส่ง */
      const left = Math.max(0, (ch.quota_limit || 0) - (ch.quota_used || 0));
      const ok = ch.quota_limit ? Math.min(live.length, left) : live.length;
      const over = live.length - ok;
      await sendViaLine(ch, live, messages);
      live.forEach((u, i) => {
        const good = i < ok;
        if (good) nSent++; else nFail++;
        if (rows++ < MAX_TARGET_ROWS) {
          stmts.push(db.prepare(
            "INSERT INTO blast_targets (id,blast_id,channel_id,ch,user_id,name,dest,status,err,sent_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
          ).bind(newId("bt_"), row.id, cid, "line", u.id, u.display_name || "", u.id,
                 good ? "sent" : "fail", good ? "" : "โควตาข้อความของเพจนี้หมดแล้ว", now));
        }
      });
      blocked.forEach((u) => {
        nSkip++;
        if (rows++ < MAX_TARGET_ROWS) {
          stmts.push(db.prepare(
            "INSERT INTO blast_targets (id,blast_id,channel_id,ch,user_id,name,dest,status,err,sent_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
          ).bind(newId("bt_"), row.id, cid, "line", u.id, u.display_name || "", u.id, "skip", "บล็อกเพจไว้", now));
        }
      });
      if (ok) {
        stmts.push(db.prepare("UPDATE line_channels SET quota_used = quota_used + ? WHERE id = ?").bind(ok, cid));
      }
      perChannel.push({ channelId: cid, name: ch.name, sent: ok, fail: over, skip: blocked.length });
    }
  }

  /* ---- SMS (จำลองเหมือนกัน — ยังไม่ได้เลือกเจ้า) ---- */
  if (row.sms_on) {
    const seen = new Set();
    const push = (num, name) => {
      if (!num || seen.has(num)) return;
      seen.add(num);
      nSent++;
      if (rows++ < MAX_TARGET_ROWS) {
        stmts.push(db.prepare(
          "INSERT INTO blast_targets (id,blast_id,channel_id,ch,user_id,name,dest,status,err,sent_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
        ).bind(newId("bt_"), row.id, "", "sms", "", name || "", num, "sent", "", now));
      }
    };
    if (smsOpt.useLine && row.line_on) {
      for (const cid of chIds) {
        const users = await usersFor(db, cid, aud);
        users.filter((u) => !u.blocked && u.phone).forEach((u) => push(u.phone, u.display_name));
      }
    }
    if (smsOpt.leads) {
      const res = await db.prepare("SELECT name, phone, status FROM leads WHERE phone <> ''").all().catch(() => ({ results: [] }));
      (res.results || []).forEach((l) => {
        if (smsOpt.leadStatus.length && smsOpt.leadStatus.indexOf(l.status) === -1) return;
        push(String(l.phone || "").replace(/[^0-9]/g, ""), l.name);
      });
    }
    phoneList(smsOpt.numbers).forEach((n) => push(n, ""));
  }

  const nTarget = nSent + nFail + nSkip;
  stmts.push(db.prepare(
    "UPDATE blasts SET status = 'sent', sent_at = ?, updated_at = ?, n_target = ?, n_sent = ?, n_fail = ? WHERE id = ?"
  ).bind(now, now, nTarget, nSent, nFail, row.id));

  /* ---- เขียนผลกลับเข้างานต้นทาง ----
     นนท์อยากให้เส้นเดียวจบ: บรีฟ → งาน → ใส่รูป → บรอดแคสต์ → เห็นผลในงานเดิม
     จึงลงเป็น "ความคืบหน้า" ในงานนั้น และติ๊กขั้น "บรอดแคสต์แล้ว" ให้เอง ถ้างานมีขั้นงาน */
  if (row.task_id) {
    const line = perChannel.map((c) => c.name + " " + c.sent.toLocaleString("th-TH") + " คน").join(" · ");
    const note = "📣 บรอดแคสต์แล้ว" + (LINE_MODE === "mock" ? " (โหมดทดสอบ ยังไม่ออกจริง)" : "") + "\n" +
      (row.line_on && line ? "LINE: " + line + "\n" : "") +
      (row.sms_on ? "SMS: ส่ง " + nSent.toLocaleString("th-TH") + " เบอร์\n" : "") +
      "รวมถึงมือผู้รับ " + nSent.toLocaleString("th-TH") + " คน" +
      (nFail ? " · ไม่ถึง " + nFail : "") + (nSkip ? " · ข้าม " + nSkip + " (บล็อกเพจ)" : "");
    stmts.push(db.prepare(
      "INSERT INTO task_updates (id,task_id,staff_id,kind,note,status_to,created_at) VALUES (?,?,?,?,?,NULL,?)"
    ).bind(newId("u_"), row.task_id, meId, "note", note, now));
    stmts.push(db.prepare(
      "UPDATE tasks SET status = 'done', done_at = ?, updated_at = ? WHERE parent_id = ? AND stage = 'blasted' AND status <> 'done'"
    ).bind(now, now, row.task_id));
    stmts.push(db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").bind(now, row.task_id));
  }
  for (let i = 0; i < stmts.length; i += 40) await db.batch(stmts.slice(i, i + 40));
  return { nTarget, nSent, nFail, nSkip, perChannel, mode: LINE_MODE };
}

/* ใบที่ตั้งเวลาไว้แล้วถึงเวลาแล้ว — เรียกตอนเปิดหน้ารายการและตอน cron รายวัน
   (ยังไม่ทำ cron ทุก 10 นาที เพราะยังเป็นโหมดจำลอง ค่อยเพิ่มตอนต่อของจริง) */
export async function runDueBlasts(db) {
  const now = nowIso();
  const due = await db.prepare(
    "SELECT * FROM blasts WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ? LIMIT 5"
  ).bind(now).all().catch(() => ({ results: [] }));
  for (const row of due.results || []) await doSend(db, row, row.created_by);

  /* ริชเมนูที่ตั้งเวลาเปลี่ยนไว้ (เช่น แบนเนอร์เปลี่ยนทุกต้นเดือน) ก็ถึงคิวพร้อมกัน */
  const menus = await db.prepare(
    "SELECT id, channel_id FROM rich_menus WHERE apply_at IS NOT NULL AND apply_at <= ? LIMIT 10"
  ).bind(now).all().catch(() => ({ results: [] }));
  for (const m of menus.results || []) {
    await db.batch([
      db.prepare("UPDATE rich_menus SET is_default = 0 WHERE channel_id = ?").bind(m.channel_id),
      db.prepare("UPDATE rich_menus SET is_default = 1, apply_at = NULL, updated_at = ? WHERE id = ?").bind(now, m.id),
    ]);
  }
  return (due.results || []).length + (menus.results || []).length;
}

/* ============================================================
   เส้นทาง API — ต่อท้าย /api/t/blast/...
   สิทธิ์: หมวด "blast" (ตั้งให้รายคนในหน้า ทีม + สิทธิ์) · หัวหน้าเห็นหมดเสมอ
   ของที่ย้อนกลับไม่ได้ (ลบเพจ / ล้างข้อมูลจำลอง) สงวนไว้ให้หัวหน้า
   ============================================================ */
const BLAST_STATUS = ["draft", "scheduled", "sent", "canceled"];

function chanOut(r, extra) {
  return {
    id: r.id, name: r.name, basicId: r.basic_id, color: r.color, pageId: r.page_id,
    quotaLimit: r.quota_limit, quotaUsed: r.quota_used,
    quotaLeft: Math.max(0, (r.quota_limit || 0) - (r.quota_used || 0)),
    /* ไม่ส่ง token ออกหน้าเว็บ — บอกแค่ว่าใส่แล้วหรือยัง และ 4 ตัวท้ายไว้ยืนยันว่าใส่ถูกอัน */
    hasToken: !!r.token, tokenTail: r.token ? String(r.token).slice(-4) : "",
    note: r.note || "", active: !!r.active, sort: r.sort,
    followers: extra && extra.followers != null ? extra.followers : null,
    ...(extra || {}),
  };
}
function blastOut(r) {
  return {
    id: r.id, title: r.title, taskId: r.task_id || null, campaignId: r.campaign_id || null,
    channels: JSON.parse(r.channels || "[]"), audience: JSON.parse(r.audience || "{}"),
    lineOn: !!r.line_on, smsOn: !!r.sms_on,
    messages: JSON.parse(r.messages || "[]"), smsText: r.sms_text || "",
    status: r.status, mode: r.mode, scheduledAt: r.scheduled_at, sentAt: r.sent_at,
    nTarget: r.n_target, nSent: r.n_sent, nFail: r.n_fail,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function menuOut(r) {
  return {
    id: r.id, channelId: r.channel_id, name: r.name, size: r.size,
    image: r.image || "", imageName: r.image_name || "", areas: JSON.parse(r.areas || "[]"),
    isDefault: !!r.is_default, applyAt: r.apply_at, taskId: r.task_id || null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
/* ข้อความที่จะส่ง — รับ 3 แบบพอ: ข้อความ / รูป / การ์ดมีปุ่ม (ของจริงคือ flex message) */
function cleanMessages(list) {
  const out = [];
  for (const raw of arr(list).slice(0, 5)) {
    const t = raw && raw.type;
    if (t === "text") {
      const text = str(raw.text, 2000);
      if (text) out.push({ type: "text", text });
    } else if (t === "image") {
      const fileId = str(raw.fileId, 40);
      const url = str(raw.url, 500);
      if (fileId || url) out.push({ type: "image", fileId, url, name: str(raw.name, 120) });
    } else if (t === "card") {
      out.push({
        type: "card", title: str(raw.title, 120), text: str(raw.text, 400),
        fileId: str(raw.fileId, 40), url: str(raw.url, 500),
        buttons: arr(raw.buttons).slice(0, 3).map((b) => ({ label: str(b.label, 40), url: str(b.url, 500) }))
          .filter((b) => b.label),
      });
    }
  }
  return out;
}

export async function handleBlastApi(db, request, url, path, method, me, can, ctx) {
  await ensureBlastSchema(db);
  if (!can.blast) return json({ error: "บัญชีนี้ยังไม่ได้เปิดสิทธิ์หมวดบรอดแคสต์ — ให้หัวหน้าเปิดให้ในหน้า ทีม + สิทธิ์" }, 403);
  const body = method === "GET" ? {} : await readBody(request);

  /* ---------- หน้าแรก: เพจ + ใบบรอดแคสต์ + ตัวเลือกกรอง ---------- */
  if (path === "/blast/home" && method === "GET") {
    await runDueBlasts(db);
    const chs = await db.prepare("SELECT * FROM line_channels ORDER BY sort, name").all();
    const counts = await db.prepare(
      "SELECT channel_id, COUNT(*) AS n, SUM(CASE WHEN blocked = 0 THEN 1 ELSE 0 END) AS live FROM line_users GROUP BY channel_id"
    ).all();
    const byCh = {};
    (counts.results || []).forEach((r) => { byCh[r.channel_id] = r; });
    const blasts = await db.prepare("SELECT * FROM blasts ORDER BY COALESCE(sent_at, scheduled_at, created_at) DESC LIMIT 200").all();
    const tags = await db.prepare("SELECT tags FROM line_users WHERE tags <> ''").all();
    const tagSet = new Set();
    (tags.results || []).forEach((r) => String(r.tags).split(",").forEach((t) => { if (t.trim()) tagSet.add(t.trim()); }));
    const branches = await db.prepare("SELECT DISTINCT branch FROM line_users WHERE branch <> ''").all();
    return json({
      mode: LINE_MODE,
      channels: (chs.results || []).map((r) => chanOut(r, {
        followers: (byCh[r.id] && byCh[r.id].n) || 0,
        reach: (byCh[r.id] && byCh[r.id].live) || 0,
      })),
      blasts: (blasts.results || []).map(blastOut),
      tags: Array.from(tagSet).sort(),
      branches: (branches.results || []).map((r) => r.branch).sort(),
    });
  }

  /* ---------- เพจ LINE OA ---------- */
  if (path === "/blast/channels" && method === "POST") {
    const name = str(body.name, 80);
    if (!name) return json({ error: "ต้องใส่ชื่อเพจ" }, 400);
    const id = newId("ch_");
    const last = await db.prepare("SELECT MAX(sort) AS m FROM line_channels").first();
    await db.prepare(
      "INSERT INTO line_channels (id,name,basic_id,color,token,secret,quota_limit,quota_used,page_id,note,active,sort,created_at) " +
      "VALUES (?,?,?,?,?,?,?,0,?,?,1,?,?)"
    ).bind(id, name, str(body.basicId, 40), str(body.color, 20) || "#06C755", str(body.token, 400), str(body.secret, 200),
           Math.max(0, Math.round(Number(body.quotaLimit) || 0)), str(body.pageId, 40), str(body.note, 300),
           ((last && last.m) || 0) + 1, nowIso()).run();
    return json({ id });
  }
  const chMatch = path.match(/^\/blast\/channels\/([A-Za-z0-9_-]{1,40})$/);
  if (chMatch && method === "PUT") {
    const sets = [], vals = [];
    const put = (col, v) => { sets.push(col + " = ?"); vals.push(v); };
    if (body.name != null) put("name", str(body.name, 80));
    if (body.basicId != null) put("basic_id", str(body.basicId, 40));
    if (body.color != null) put("color", str(body.color, 20));
    if (body.note != null) put("note", str(body.note, 300));
    if (body.pageId != null) put("page_id", str(body.pageId, 40));
    if (body.token != null) put("token", str(body.token, 400));
    if (body.secret != null) put("secret", str(body.secret, 200));
    if (body.quotaLimit != null) put("quota_limit", Math.max(0, Math.round(Number(body.quotaLimit) || 0)));
    if (body.quotaUsed != null) put("quota_used", Math.max(0, Math.round(Number(body.quotaUsed) || 0)));
    if (body.active != null) put("active", body.active ? 1 : 0);
    if (!sets.length) return json({ ok: true });
    vals.push(chMatch[1]);
    const r = await db.prepare("UPDATE line_channels SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
    if (!r.meta.changes) return json({ error: "ไม่พบเพจนี้" }, 404);
    return json({ ok: true });
  }
  if (chMatch && method === "DELETE") {
    if (!can.owner) return json({ error: "ลบเพจได้เฉพาะหัวหน้า" }, 403);
    await db.batch([
      db.prepare("DELETE FROM line_users WHERE channel_id = ?").bind(chMatch[1]),
      db.prepare("DELETE FROM rich_menus WHERE channel_id = ?").bind(chMatch[1]),
      db.prepare("DELETE FROM line_channels WHERE id = ?").bind(chMatch[1]),
    ]);
    return json({ ok: true });
  }

  /* ---------- ผู้ติดตาม ---------- */
  if (path === "/blast/users" && method === "GET") {
    const ch = url.searchParams.get("ch") || "";
    const q = (url.searchParams.get("q") || "").trim();
    const where = [], vals = [];
    if (ch) { where.push("channel_id = ?"); vals.push(ch); }
    if (q) { where.push("(display_name LIKE ? OR phone LIKE ? OR tags LIKE ?)"); vals.push("%" + q + "%", "%" + q + "%", "%" + q + "%"); }
    const sql = "SELECT * FROM line_users" + (where.length ? " WHERE " + where.join(" AND ") : "") +
      " ORDER BY followed_at DESC LIMIT 600";
    const res = await db.prepare(sql).bind(...vals).all();
    return json({
      users: (res.results || []).map((r) => ({
        id: r.id, channelId: r.channel_id, name: r.display_name, tags: String(r.tags || "").split(",").filter(Boolean),
        branch: r.branch, bought: !!r.bought, blocked: !!r.blocked, phone: r.phone,
        followedAt: r.followed_at, lastActive: r.last_active,
      })),
    });
  }
  const userMatch = path.match(/^\/blast\/users\/([A-Za-z0-9_-]{1,60})$/);
  if (userMatch && method === "PUT") {
    const sets = [], vals = [];
    if (body.tags != null) { sets.push("tags = ?"); vals.push(arr(body.tags).map((x) => str(x, 40)).filter(Boolean).slice(0, 10).join(",")); }
    if (body.branch != null) { sets.push("branch = ?"); vals.push(str(body.branch, 40)); }
    if (body.bought != null) { sets.push("bought = ?"); vals.push(body.bought ? 1 : 0); }
    if (!sets.length) return json({ ok: true });
    vals.push(userMatch[1]);
    await db.prepare("UPDATE line_users SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
    return json({ ok: true });
  }

  /* ---------- นับคนรับสด ๆ ตอนเปลี่ยนเงื่อนไข ---------- */
  if (path === "/blast/count" && method === "POST") {
    const chIds = arr(body.channels).map((x) => str(x, 40)).filter(Boolean).slice(0, 20);
    const aud = cleanAudience(body.audience);
    const per = await countFor(db, chIds, aud);
    let smsN = 0;
    if (body.smsOn) {
      const opt = cleanSms((body.audience || {}).sms);
      const seen = new Set();
      if (opt.useLine) for (const c of chIds) {
        (await usersFor(db, c, aud)).forEach((u) => { if (!u.blocked && u.phone) seen.add(u.phone); });
      }
      if (opt.leads) {
        const res = await db.prepare("SELECT phone, status FROM leads WHERE phone <> ''").all().catch(() => ({ results: [] }));
        (res.results || []).forEach((l) => {
          if (opt.leadStatus.length && opt.leadStatus.indexOf(l.status) === -1) return;
          const n = String(l.phone).replace(/[^0-9]/g, "");
          if (n) seen.add(n);
        });
      }
      phoneList(opt.numbers).forEach((n) => seen.add(n));
      smsN = seen.size;
    }
    return json({ per, sms: smsN });
  }

  /* ---------- ใบบรอดแคสต์ ---------- */
  if (path === "/blast/new" && method === "POST") {
    const id = newId("b_");
    const now = nowIso();
    const aud = cleanAudience(body.audience);
    aud.sms = cleanSms((body.audience || {}).sms);
    await db.prepare(
      "INSERT INTO blasts (id,title,task_id,campaign_id,channels,audience,line_on,sms_on,messages,sms_text,status,mode,scheduled_at,sent_at,n_target,n_sent,n_fail,created_by,created_at,updated_at) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,'draft',?,NULL,NULL,0,0,0,?,?,?)"
    ).bind(id, str(body.title, 200) || "บรอดแคสต์ใหม่", str(body.taskId, 40) || null, str(body.campaignId, 40) || null,
           JSON.stringify(arr(body.channels).map((x) => str(x, 40)).filter(Boolean).slice(0, 20)),
           JSON.stringify(aud), body.lineOn === false ? 0 : 1, body.smsOn ? 1 : 0,
           JSON.stringify(cleanMessages(body.messages)), str(body.smsText, 500), LINE_MODE, me.id, now, now).run();
    return json({ id });
  }
  const bMatch = path.match(/^\/blast\/item\/([A-Za-z0-9_-]{1,40})(\/send|\/cancel|\/test|\/targets|\/image)?$/);
  if (bMatch) {
    const id = bMatch[1], sub = bMatch[2] || "";
    const row = await db.prepare("SELECT * FROM blasts WHERE id = ?").bind(id).first();
    if (!row) return json({ error: "ไม่พบใบบรอดแคสต์นี้" }, 404);

    if (!sub && method === "GET") {
      const per = await db.prepare(
        "SELECT channel_id, ch, status, COUNT(*) AS n FROM blast_targets WHERE blast_id = ? GROUP BY channel_id, ch, status"
      ).bind(id).all();
      const sample = await db.prepare(
        "SELECT name, dest, ch, channel_id, status, err FROM blast_targets WHERE blast_id = ? ORDER BY status = 'sent', name LIMIT 300"
      ).bind(id).all();
      return json({
        blast: blastOut(row),
        result: (per.results || []),
        sample: (sample.results || []).map((r) => ({
          name: r.name, dest: r.dest, ch: r.ch, channelId: r.channel_id, status: r.status, err: r.err,
        })),
      });
    }
    if (!sub && method === "PUT") {
      if (row.status === "sent") return json({ error: "ใบที่ส่งไปแล้วแก้ไม่ได้ — ก๊อปเป็นใบใหม่แทน" }, 409);
      const sets = [], vals = [];
      const put = (c, v) => { sets.push(c + " = ?"); vals.push(v); };
      if (body.title != null) put("title", str(body.title, 200) || "บรอดแคสต์ใหม่");
      if (body.channels != null) put("channels", JSON.stringify(arr(body.channels).map((x) => str(x, 40)).filter(Boolean).slice(0, 20)));
      if (body.audience != null) {
        const a = cleanAudience(body.audience);
        a.sms = cleanSms(body.audience.sms);
        put("audience", JSON.stringify(a));
      }
      if (body.lineOn != null) put("line_on", body.lineOn ? 1 : 0);
      if (body.smsOn != null) put("sms_on", body.smsOn ? 1 : 0);
      if (body.messages != null) put("messages", JSON.stringify(cleanMessages(body.messages)));
      if (body.smsText != null) put("sms_text", str(body.smsText, 500));
      if (body.taskId !== undefined) put("task_id", str(body.taskId, 40) || null);
      if (body.campaignId !== undefined) put("campaign_id", str(body.campaignId, 40) || null);
      put("updated_at", nowIso());
      vals.push(id);
      await db.prepare("UPDATE blasts SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
      return json({ ok: true });
    }
    if (!sub && method === "DELETE") {
      if (row.status === "sent" && !can.owner) return json({ error: "ใบที่ส่งแล้วลบได้เฉพาะหัวหน้า" }, 403);
      await db.batch([
        db.prepare("DELETE FROM blast_targets WHERE blast_id = ?").bind(id),
        db.prepare("DELETE FROM blasts WHERE id = ?").bind(id),
      ]);
      return json({ ok: true });
    }
    /* อัปรูปเข้าใบบรอดแคสต์ — เก็บใน task_files เหมือนไฟล์แนบของงาน (task_id = id ของใบนี้)
       จะได้ใช้เส้นทางเสิร์ฟรูปเดิม /api/t/files/:id และเปิดดูใน lightbox ได้เหมือนกัน */
    if (sub === "/image" && method === "POST") {
      const data = str(body.data, 2000000);
      const bytes = Math.round(data.length * 3 / 4);
      if (!data) return json({ error: "ไม่มีไฟล์" }, 400);
      if (bytes > 1350000) return json({ error: "รูปใหญ่เกินไป — ไม่เกิน 1.3MB (ย่อรูปก่อนอัป)" }, 413);
      const fid = newId("f_");
      await db.prepare(
        "INSERT INTO task_files (id,task_id,update_id,file_name,mime,bytes,data,created_at,kind) " +
        "VALUES (?,?,NULL,?,?,?,?,?,'file')"
      ).bind(fid, id, str(body.name, 120) || "image.jpg", str(body.mime, 80) || "image/jpeg", bytes, data, nowIso()).run();
      return json({ fileId: fid });
    }
    /* ส่งทดสอบถึงตัวเอง — ไม่นับโควตา ไม่บันทึกผล แค่ยืนยันว่าข้อความหน้าตาถูกแล้ว */
    if (sub === "/test" && method === "POST") {
      return json({ ok: true, mode: LINE_MODE, to: str(body.to, 80) || me.name });
    }
    if (sub === "/send" && method === "POST") {
      if (row.status === "sent") return json({ error: "ใบนี้ส่งไปแล้ว" }, 409);
      const chIds = JSON.parse(row.channels || "[]");
      if (row.line_on && !chIds.length) return json({ error: "ยังไม่ได้เลือกเพจที่จะส่ง" }, 400);
      if (!JSON.parse(row.messages || "[]").length && !(row.sms_on && row.sms_text))
        return json({ error: "ยังไม่มีข้อความที่จะส่ง" }, 400);
      /* เลือกรายคนไว้แต่ไม่ได้ติ๊กใคร = ส่งไปถึง 0 คน — กันไว้ไม่ให้ปิดใบทิ้งโดยเข้าใจว่าส่งแล้ว */
      const audCheck = cleanAudience(JSON.parse(row.audience || "{}"));
      if (row.line_on && audCheck.kind === "pick" && !audCheck.ids.length)
        return json({ error: "เลือก “เลือกรายคน” ไว้แต่ยังไม่ได้ติ๊กใคร" }, 400);
      if (row.line_on) {
        const pre = await countFor(db, chIds, audCheck);
        if (!pre.reduce((a, x) => a + x.reach, 0) && !row.sms_on)
          return json({ error: "เงื่อนไขที่เลือกไม่มีใครเข้าเกณฑ์เลย — ลองผ่อนเงื่อนไขในขั้น “ใครได้รับ”" }, 400);
      }
      /* ตั้งเวลา = เก็บไว้ก่อน ยังไม่ยิง · ถึงเวลาแล้วระบบยิงให้ตอนมีคนเปิดหน้าหรือรอบ cron */
      const at = str(body.at, 40);
      if (at && Date.parse(at) > Date.now()) {
        await db.prepare("UPDATE blasts SET status = 'scheduled', scheduled_at = ?, updated_at = ? WHERE id = ?")
          .bind(new Date(at).toISOString(), nowIso(), id).run();
        return json({ ok: true, scheduled: true, at: new Date(at).toISOString() });
      }
      const out = await doSend(db, row, me.id);
      return json({ ok: true, ...out });
    }
    if (sub === "/cancel" && method === "POST") {
      if (row.status !== "scheduled") return json({ error: "ยกเลิกได้เฉพาะใบที่ตั้งเวลาไว้" }, 409);
      await db.prepare("UPDATE blasts SET status = 'draft', scheduled_at = NULL, updated_at = ? WHERE id = ?")
        .bind(nowIso(), id).run();
      return json({ ok: true });
    }
  }
  /* ใบบรอดแคสต์ของงานหนึ่ง — หน้างานเรียกมาโชว์ในแผง "บรอดแคสต์" */
  const tMatch = path.match(/^\/blast\/task\/([A-Za-z0-9_-]{1,40})$/);
  if (tMatch && method === "GET") {
    const res = await db.prepare("SELECT * FROM blasts WHERE task_id = ? ORDER BY created_at DESC").bind(tMatch[1]).all();
    const chs = await db.prepare("SELECT id,name,color FROM line_channels").all();
    return json({ blasts: (res.results || []).map(blastOut), channels: chs.results || [], mode: LINE_MODE });
  }

  /* ---------- ริชเมนู ---------- */
  if (path === "/blast/richmenus" && method === "GET") {
    const ch = url.searchParams.get("ch") || "";
    const res = ch
      ? await db.prepare("SELECT * FROM rich_menus WHERE channel_id = ? ORDER BY is_default DESC, updated_at DESC").bind(ch).all()
      : await db.prepare("SELECT * FROM rich_menus ORDER BY is_default DESC, updated_at DESC").all();
    return json({ menus: (res.results || []).map(menuOut) });
  }
  if (path === "/blast/richmenus" && method === "POST") {
    const channelId = str(body.channelId, 40);
    if (!channelId) return json({ error: "ต้องเลือกเพจก่อน" }, 400);
    const img = str(body.image, 1400000);
    if (img && img.length > 1400000) return json({ error: "รูปใหญ่เกินไป — LINE รับไม่เกิน 1MB" }, 413);
    const id = newId("rm_"), now = nowIso();
    await db.prepare(
      "INSERT INTO rich_menus (id,channel_id,name,size,image,image_name,areas,is_default,apply_at,task_id,created_by,created_at,updated_at) " +
      "VALUES (?,?,?,?,?,?,?,0,NULL,?,?,?,?)"
    ).bind(id, channelId, str(body.name, 80) || "ริชเมนูใหม่", body.size === "compact" ? "compact" : "full",
           img, str(body.imageName, 120), JSON.stringify(arr(body.areas).slice(0, 20)),
           str(body.taskId, 40) || null, me.id, now, now).run();
    return json({ id });
  }
  const rmMatch = path.match(/^\/blast\/richmenus\/([A-Za-z0-9_-]{1,40})(\/apply)?$/);
  if (rmMatch) {
    const id = rmMatch[1];
    if (rmMatch[2] === "/apply" && method === "POST") {
      const row = await db.prepare("SELECT * FROM rich_menus WHERE id = ?").bind(id).first();
      if (!row) return json({ error: "ไม่พบริชเมนูนี้" }, 404);
      const at = str(body.at, 40);
      const now = nowIso();
      if (at && Date.parse(at) > Date.now()) {
        await db.prepare("UPDATE rich_menus SET apply_at = ?, updated_at = ? WHERE id = ?")
          .bind(new Date(at).toISOString(), now, id).run();
        return json({ ok: true, scheduled: true, at: new Date(at).toISOString() });
      }
      /* ของจริง = POST /v2/bot/user/all/richmenu/{richMenuId} — เปลี่ยนให้ทุกคนที่แอดเพจนี้ */
      await db.batch([
        db.prepare("UPDATE rich_menus SET is_default = 0 WHERE channel_id = ?").bind(row.channel_id),
        db.prepare("UPDATE rich_menus SET is_default = 1, apply_at = NULL, updated_at = ? WHERE id = ?").bind(now, id),
      ]);
      return json({ ok: true, applied: true, mode: LINE_MODE });
    }
    if (method === "PUT") {
      const sets = [], vals = [];
      const put = (c, v) => { sets.push(c + " = ?"); vals.push(v); };
      if (body.name != null) put("name", str(body.name, 80));
      if (body.size != null) put("size", body.size === "compact" ? "compact" : "full");
      if (body.areas != null) put("areas", JSON.stringify(arr(body.areas).slice(0, 20)));
      if (body.image != null) {
        const img = str(body.image, 1400000);
        if (img.length > 1400000) return json({ error: "รูปใหญ่เกินไป — LINE รับไม่เกิน 1MB" }, 413);
        put("image", img);
        put("image_name", str(body.imageName, 120));
      }
      if (body.applyAt !== undefined) put("apply_at", str(body.applyAt, 40) || null);
      put("updated_at", nowIso());
      vals.push(id);
      const r = await db.prepare("UPDATE rich_menus SET " + sets.join(", ") + " WHERE id = ?").bind(...vals).run();
      if (!r.meta.changes) return json({ error: "ไม่พบริชเมนูนี้" }, 404);
      return json({ ok: true });
    }
    if (method === "DELETE") {
      const row = await db.prepare("SELECT is_default FROM rich_menus WHERE id = ?").bind(id).first();
      if (row && row.is_default) return json({ error: "เมนูที่ใช้อยู่ลบไม่ได้ — สลับไปใช้เมนูอื่นก่อน" }, 409);
      await db.prepare("DELETE FROM rich_menus WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
  }

  /* ล้างผู้ติดตามจำลองทิ้ง — ใช้ตอนต่อ LINE จริงแล้ว ไม่อยากให้เลขปลอมปนกับของจริง */
  if (path === "/blast/clear-mock" && method === "POST") {
    if (!can.owner) return json({ error: "ล้างข้อมูลจำลองได้เฉพาะหัวหน้า" }, 403);
    await db.batch([
      db.prepare("DELETE FROM line_users"),
      db.prepare("UPDATE line_channels SET quota_used = 0"),
    ]);
    return json({ ok: true });
  }

  return json({ error: "ไม่พบ endpoint นี้" }, 404);
}
