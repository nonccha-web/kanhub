// KAN — MCP server (Streamable HTTP, JSON-RPC 2.0) ให้ Claude / ChatGPT / Claude Code ต่อเข้าระบบหลังบ้าน
//   URL: https://admin.kan-hub.com/mcp/<token>   (token รายคน สร้างจากหน้า "ทีม + สิทธิ์")
//   หรือ https://admin.kan-hub.com/mcp + header Authorization: Bearer <token>
// ทุกเครื่องมือเรียก API เดิมของระบบผ่าน handleTaskApi/handleApi ในสิทธิ์ของเจ้าของ token
// → ลูกทีมสั่งผ่าน AI ได้เท่าที่ตัวเองเห็นในระบบ ไม่มีทางลัด
import { handleTaskApi } from "./worker-tasks.js";

const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SITE = "https://admin.kan-hub.com";
const TZ_MS = 7 * 3600 * 1000;   // เวลาไทย

function json(data, status = 200, extra) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, extra || {}),
  });
}
function bkkDate(ts) { return new Date(ts + TZ_MS).toISOString().slice(0, 10); }
function bkkWeek(ts) {
  const d = new Date(ts + TZ_MS);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function bkkTime(ts) { return new Date(ts + TZ_MS).toISOString().slice(11, 16); }
const DAY_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
const MON_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function thaiDate(ymd) {
  const d = new Date(ymd + "T00:00:00Z");
  return DAY_TH[d.getUTCDay()] + " " + d.getUTCDate() + " " + MON_TH[d.getUTCMonth()] + " " + (d.getUTCFullYear() + 543);
}
/* กฎเดียวกับหน้าเว็บ (effStatus/isLate): งานประจำที่กดเสร็จรอบก่อน กลับมาค้างในรอบใหม่ */
function effStatus(t, now) {
  if (!t.repeat || t.status !== "done") return t.status;
  if (t.doneAt) {
    const dn = Date.parse(t.doneAt);
    if (t.repeat === "daily" && bkkDate(dn) === bkkDate(now)) return "done";
    if (t.repeat === "weekly" && bkkWeek(dn) === bkkWeek(now)) return "done";
  }
  return "todo";
}
function dueTs(t, now) {
  if (!t.dueAt) return null;
  const d = Date.parse(t.dueAt);
  if (t.repeat === "daily") {
    const hh = new Date(d + TZ_MS), nn = new Date(now + TZ_MS);
    nn.setUTCHours(hh.getUTCHours(), hh.getUTCMinutes(), 0, 0);
    return nn.getTime() - TZ_MS;
  }
  return d;
}
function isLate(t, now) {
  if (effStatus(t, now) === "done" || t.repeat === "weekly") return false;
  const d = dueTs(t, now);
  return d != null && d < now;
}
/* "2026-09-10 17:00" / "2026-09-10T17:00" / "2026-09-10" (→ 18:00) / ISO เต็ม → ISO UTC */
function toIso(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T18:00:00+07:00").toISOString();
  let m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2})[:.](\d{2})$/);
  if (m) return new Date(m[1] + "T" + m[2].padStart(2, "0") + ":" + m[3] + ":00+07:00").toISOString();
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t).toISOString();
}

/* ---------- เรียก API ภายในด้วย token ---------- */
async function tApi(env, token, method, path, body) {
  const u = new URL("https://internal.kan/api/t" + path);
  const req = new Request(u, {
    method, headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await handleTaskApi(req, env, u, u.pathname.replace(/^\/api\/t/, "") || "/", method);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || ("HTTP " + res.status));
  return j;
}
async function cApi(env, token, handleApi, method, path, body) {
  const u = new URL("https://internal.kan/api" + path);
  const req = new Request(u, {
    method, headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await handleApi(req, env, u);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || ("HTTP " + res.status));
  return j;
}

/* ---------- แปลงชื่อ → id (ทีม / KPI / เพจ / ปฏิทิน) ---------- */
function norm(s) { return String(s == null ? "" : s).trim().toLowerCase(); }
function findStaff(list, q) {
  const s = norm(q);
  if (!s) return null;
  return list.find((x) => x.id === q) ||
    list.find((x) => norm(x.name) === s) ||
    list.find((x) => String(x.aliases || "").split(",").some((a) => norm(a) === s)) ||
    list.find((x) => norm(x.name).indexOf(s) === 0) ||
    list.find((x) => norm(x.name).indexOf(s) !== -1 || String(x.aliases || "").toLowerCase().indexOf(s) !== -1) || null;
}
function findKpi(list, q) {
  const s = norm(q);
  if (!s) return null;
  return list.find((k) => k.id === q) ||
    list.find((k) => norm(k.code) === s) ||
    list.find((k) => norm(k.code).replace(/\s/g, "") === s.replace(/\s/g, "")) ||
    list.find((k) => /^\d+$/.test(s) && norm(k.code).replace(/\D/g, "") === s) ||
    list.find((k) => norm(k.title).indexOf(s) !== -1) || null;
}
function findPage(list, q) {
  const s = norm(q);
  if (!s) return null;
  return list.find((p) => p.id === q) || list.find((p) => norm(p.name) === s) ||
    list.find((p) => norm(p.name).indexOf(s) !== -1 || s.indexOf(norm(p.name)) !== -1) || null;
}
function findCampaign(list, q) {
  const s = norm(q);
  if (!s) return null;
  return list.find((c) => c.id === q) || list.find((c) => norm(c.name) === s) ||
    list.find((c) => norm(c.name).indexOf(s) !== -1) || null;
}
function taskLink(id) { return SITE + "/tasks/#/task/" + id; }

/* ---------- เครื่องมือ ---------- */
const TOOLS = [
  {
    name: "get_context",
    description: "เรียกก่อนเสมอ: วันนี้วันที่เท่าไร ใครอยู่ในทีม (ชื่อ/ชื่อเล่นที่ใช้ @) รายการ KPI เพจโพสต์ และรายการในปฏิทินการตลาด — ใช้แปลงชื่อคนหรือ KPI ให้ถูกก่อนสร้างงาน",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "today_summary",
    description: "สรุปงานของทีมวันนี้: งานเลยกำหนด งานครบกำหนดวันนี้ งานประจำที่ยังไม่อัปเดต แยกรายคน + โพสต์วันนี้ของแต่ละเพจ (โพสต์แล้ว/ยังไม่โพสต์/ไม่มีลิงก์) + รายการในปฏิทินการตลาดที่กำลังวิ่ง",
    inputSchema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD (เวลาไทย) ไม่ใส่ = วันนี้" } },
      additionalProperties: false,
    },
  },
  {
    name: "list_tasks",
    description: "ดูรายการงาน กรองตามคน/สถานะ/ช่วงวันครบกำหนด",
    inputSchema: {
      type: "object",
      properties: {
        who: { type: "string", description: "ชื่อคนหรือชื่อเล่น เช่น Pizza, Title, นนท์ · ไม่ใส่ = ทุกคน" },
        status: { type: "string", enum: ["open", "late", "today", "done", "all"], description: "open = ยังไม่เสร็จ (ค่าเริ่มต้น)" },
        from: { type: "string", description: "YYYY-MM-DD กรองวันครบกำหนดตั้งแต่" },
        to: { type: "string", description: "YYYY-MM-DD ถึง" },
        includeSubtasks: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 200 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_task",
    description: "รายละเอียดงาน 1 งาน พร้อมคอมเมนต์/อัปเดตล่าสุด ไฟล์แนบ และงานย่อย",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
  },
  {
    name: "create_tasks",
    description: "สร้างงานใหม่ (หลายงานพร้อมกันได้) จากโน้ต/ข้อความสั่งงาน — แปลงข้อความให้เป็นงานที่มีชื่อชัด คนรับ วันครบกำหนด ก่อนเรียก · ระบุคนด้วยชื่อหรือชื่อเล่นได้ · ถ้าไม่รู้วันให้เว้น dueAt ไว้",
    inputSchema: {
      type: "object",
      properties: {
        tasks: {
          type: "array", minItems: 1, maxItems: 50,
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "ชื่องานสั้น ๆ ชัดเจน" },
              detail: { type: "string", description: "รายละเอียด/บริบท/ที่มา (ใส่ได้หลายบรรทัด)" },
              assignees: { type: "array", items: { type: "string" }, description: "ชื่อคนรับงาน เช่น [\"Pizza\"]" },
              dueAt: { type: "string", description: "YYYY-MM-DD HH:mm เวลาไทย หรือ YYYY-MM-DD (จะตั้ง 18:00 ให้)" },
              repeat: { type: "string", enum: ["", "daily", "weekly"], description: "งานประจำ: daily ทุกวัน / weekly ทุกสัปดาห์" },
              priority: { type: "boolean", description: "งานด่วน/สำคัญ" },
              kpi: { type: "string", description: "รหัสหรือชื่อ KPI ที่งานนี้ผูก (ดูจาก get_context) ไม่ใส่ = ให้ระบบเดา" },
              campaign: { type: "string", description: "ชื่อรายการในปฏิทินการตลาดที่งานนี้ทำให้" },
              parentId: { type: "string", description: "id งานหลัก ถ้าอันนี้เป็นงานย่อย" },
            },
            required: ["title"],
            additionalProperties: false,
          },
        },
      },
      required: ["tasks"],
      additionalProperties: false,
    },
  },
  {
    name: "update_task",
    description: "แก้งาน: เปลี่ยนสถานะ (todo/doing/blocked/done) ชื่อ รายละเอียด วันครบกำหนด คนรับ หรือเพิ่มคอมเมนต์/อัปเดตความคืบหน้า (พิมพ์ @ชื่อ ในคอมเมนต์เพื่อแท็ก)",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["todo", "doing", "blocked", "done"] },
        title: { type: "string" },
        detail: { type: "string" },
        dueAt: { type: "string", description: "YYYY-MM-DD HH:mm เวลาไทย · ส่ง \"\" เพื่อล้าง" },
        assignees: { type: "array", items: { type: "string" } },
        priority: { type: "boolean" },
        kpi: { type: "string" },
        note: { type: "string", description: "คอมเมนต์/ความคืบหน้าที่จะเพิ่มลงในงาน" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_posts",
    description: "ตารางโพสต์ (คอนเทนต์รายวันของแต่ละเพจ): ดูว่าวันไหนมีอะไร โพสต์แล้วยัง มีลิงก์ไหม",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD ไม่ใส่ = วันนี้" },
        to: { type: "string", description: "YYYY-MM-DD ไม่ใส่ = เท่ากับ from" },
        page: { type: "string", description: "ชื่อเพจ/สาขา เช่น ชุมพร, สุราษฎร์, Kan Fashion, Kan Hub" },
        status: { type: "string", enum: ["all", "plan", "done", "nolink", "skip"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "upsert_posts",
    description: "เพิ่มหรือแก้โพสต์ในตารางโพสต์หลายแถว — แถวที่เพจ+วัน+เวลาตรงกับของเดิมจะทับของเดิม · ใส่ url = นับว่าโพสต์แล้ว",
    inputSchema: {
      type: "object",
      properties: {
        posts: {
          type: "array", minItems: 1, maxItems: 200,
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "ใส่ถ้าต้องการแก้โพสต์เดิมที่รู้ id" },
              date: { type: "string", description: "YYYY-MM-DD" },
              time: { type: "string", description: "เช่น 17.00 หรือ 15.00-20.00" },
              page: { type: "string", description: "ชื่อเพจ/สาขา" },
              topic: { type: "string" },
              kind: { type: "string", enum: ["content", "promo", "video", "live"] },
              channels: { type: "array", items: { type: "string" }, description: "Facebook, Line OA, TikTok, Instagram" },
              status: { type: "string", enum: ["plan", "done", "skip"] },
              url: { type: "string" },
              note: { type: "string" },
              campaign: { type: "string", description: "ชื่อรายการในปฏิทินการตลาด" },
            },
            required: ["date"],
            additionalProperties: false,
          },
        },
      },
      required: ["posts"],
      additionalProperties: false,
    },
  },
  {
    name: "list_campaigns",
    description: "ปฏิทินการตลาด: คอนเทนต์/แคมเปญ/โปรโมชั่น ช่วงวัน สาขา สถานะ พร้อมจำนวนโพสต์และงานที่ผูก",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD แสดงรายการที่ทับช่วงนี้ ไม่ใส่ = ทั้งหมด" },
        to: { type: "string" },
        kind: { type: "string", enum: ["content", "campaign", "promo"] },
      },
      additionalProperties: false,
    },
  },
];

/* ---------- ตัวทำงานของแต่ละเครื่องมือ ---------- */
async function loadCtx(env, token, handleApi) {
  const me = await tApi(env, token, "GET", "/me");
  const pages = await tApi(env, token, "GET", "/pages").catch(() => ({ pages: [] }));
  const camps = await tApi(env, token, "GET", "/campaigns").catch(() => ({ campaigns: [] }));
  return { me: me.me, staff: (me.staff || []).filter((s) => s.active), kpis: me.kpis || [], sections: me.sections || [],
           pages: pages.pages || [], campaigns: camps.campaigns || [] };
}
function fmtTask(t, ctx, now) {
  const names = (t.assignees || []).map((id) => { const s = ctx.staff.find((x) => x.id === id); return s ? s.name : id; });
  const k = ctx.kpis.find((x) => x.id === t.kpiId);
  const c = ctx.campaigns.find((x) => x.id === t.campaignId);
  const eff = effStatus(t, now);
  const d = dueTs(t, now);
  return {
    id: t.id, title: t.title, detail: t.detail || "", status: eff, late: isLate(t, now),
    assignees: names, due: d != null ? bkkDate(d) + " " + bkkTime(d) : null, repeat: t.repeat || "",
    priority: !!t.priority, kpi: k ? k.code : null, campaign: c ? c.name : null,
    subtasks: t.nSub ? (t.nSubDone + "/" + t.nSub) : null, updates: t.nUpdates || 0, files: t.nFiles || 0,
    link: taskLink(t.id),
  };
}

async function runTool(name, args, env, token, handleApi) {
  args = args || {};
  const now = Date.now();
  const ctx = await loadCtx(env, token, handleApi);

  if (name === "get_context") {
    return {
      today: bkkDate(now), todayThai: thaiDate(bkkDate(now)), timeNow: bkkTime(now),
      me: { id: ctx.me.id, name: ctx.me.name, role: ctx.me.role, sections: ctx.sections },
      staff: ctx.staff.map((s) => ({ id: s.id, name: s.name, aliases: s.aliases, role: s.role })),
      kpis: ctx.kpis.map((k) => ({ id: k.id, code: k.code, title: k.title, target: k.target, weight: k.weight })),
      pages: ctx.pages.map((p) => ({ id: p.id, name: p.name })),
      campaigns: ctx.campaigns.map((c) => ({ id: c.id, name: c.name, kind: c.kind, start: c.start, end: c.end, status: c.status })),
      site: SITE,
    };
  }

  if (name === "today_summary") {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(args.date || "") ? args.date : bkkDate(now);
    const ref = day === bkkDate(now) ? now : Date.parse(day + "T12:00:00+07:00");
    const all = (await tApi(env, token, "GET", "/tasks?scope=all&sub=1")).tasks || [];
    const open = all.filter((t) => effStatus(t, ref) !== "done");
    const per = {};
    const bucket = (t) => {
      const d = dueTs(t, ref);
      if (isLate(t, ref)) return "late";
      if (d != null && bkkDate(d) === day) return "today";
      if (t.repeat) return "repeat";
      if (d == null) return "nodate";
      return "later";
    };
    open.forEach((t) => {
      const names = t.assignees.length ? t.assignees : ["(ยังไม่มอบหมาย)"];
      names.forEach((id) => {
        const s = ctx.staff.find((x) => x.id === id);
        const key = s ? s.name : id;
        per[key] = per[key] || { late: [], today: [], repeat: [], nodate: [], later: 0 };
        const b = bucket(t);
        if (b === "later") per[key].later++; else per[key][b].push(fmtTask(t, ctx, ref));
      });
    });
    const posts = (await tApi(env, token, "GET", "/posts?from=" + day + "&to=" + day)).posts || [];
    const byPage = {};
    posts.forEach((p) => {
      const pg = ctx.pages.find((x) => x.id === p.pageId);
      const key = pg ? pg.name : p.pageId;
      byPage[key] = byPage[key] || { total: 0, done: 0, left: 0, nolink: 0, items: [] };
      const b = byPage[key];
      b.total++;
      if (p.status === "done") { b.done++; if (!p.url) b.nolink++; }
      else if (p.status === "plan") b.left++;
      b.items.push({ time: p.time, topic: p.topic, kind: p.kind, status: p.status, url: p.url || null });
    });
    const running = ctx.campaigns.filter((c) => c.start <= day && (c.end || c.start) >= day)
      .map((c) => ({ name: c.name, kind: c.kind, status: c.status, start: c.start, end: c.end }));
    const done = all.filter((t) => t.status === "done" && t.doneAt && bkkDate(Date.parse(t.doneAt)) === day)
      .map((t) => ({ title: t.title, by: t.assignees.map((id) => (ctx.staff.find((x) => x.id === id) || { name: id }).name) }));
    return {
      date: day, dateThai: thaiDate(day),
      totals: { open: open.length, late: open.filter((t) => isLate(t, ref)).length,
                dueToday: open.filter((t) => bucket(t) === "today").length, doneToday: done.length },
      byPerson: per, doneToday: done, postsToday: byPage, campaignsRunning: running,
      links: { tasks: SITE + "/tasks/#/all", posts: SITE + "/tasks/#/posts", calendar: SITE + "/cmo/campaign-calendar" },
    };
  }

  if (name === "list_tasks") {
    const who = args.who ? findStaff(ctx.staff, args.who) : null;
    if (args.who && !who) throw new Error("ไม่พบคนชื่อ \"" + args.who + "\" ในทีม (ดูรายชื่อจาก get_context)");
    const all = (await tApi(env, token, "GET", "/tasks?scope=all" + (args.includeSubtasks ? "&sub=1" : ""))).tasks || [];
    const st = args.status || "open";
    let list = all.filter((t) => {
      const eff = effStatus(t, now);
      if (who && t.assignees.indexOf(who.id) === -1) return false;
      if (st === "open" && eff === "done") return false;
      if (st === "done" && eff !== "done") return false;
      if (st === "late" && !isLate(t, now)) return false;
      if (st === "today") { const d = dueTs(t, now); if (d == null || bkkDate(d) !== bkkDate(now)) return false; }
      const d = dueTs(t, now);
      if (args.from && (d == null || bkkDate(d) < args.from)) return false;
      if (args.to && (d == null || bkkDate(d) > args.to)) return false;
      return true;
    });
    list = list.slice(0, args.limit || 100);
    return { count: list.length, tasks: list.map((t) => fmtTask(t, ctx, now)) };
  }

  if (name === "get_task") {
    const j = await tApi(env, token, "GET", "/tasks/" + encodeURIComponent(args.id));
    const t = j.task || j;
    const out = fmtTask(t, ctx, now);
    out.updates = (j.updates || []).map((u) => ({
      at: u.createdAt, by: (ctx.staff.find((x) => x.id === u.staffId) || { name: u.staffId }).name,
      note: u.note, status: u.status || null,
    }));
    out.files = (j.files || []).map((f) => ({ name: f.name || f.title, kind: f.kind, url: f.kind === "link" ? f.url : SITE + "/api/t/files/" + f.id }));
    out.subtasks = (j.subtasks || []).map((s) => fmtTask(s, ctx, now));
    return out;
  }

  if (name === "create_tasks") {
    const items = [];
    const problems = [];
    (args.tasks || []).forEach((it, i) => {
      const ids = [];
      (it.assignees || []).forEach((n) => {
        const s = findStaff(ctx.staff, n);
        if (s) { if (ids.indexOf(s.id) === -1) ids.push(s.id); }
        else problems.push("งานที่ " + (i + 1) + ": ไม่พบคน \"" + n + "\"");
      });
      const kpi = it.kpi ? findKpi(ctx.kpis, it.kpi) : null;
      if (it.kpi && !kpi) problems.push("งานที่ " + (i + 1) + ": ไม่พบ KPI \"" + it.kpi + "\"");
      const camp = it.campaign ? findCampaign(ctx.campaigns, it.campaign) : null;
      if (it.campaign && !camp) problems.push("งานที่ " + (i + 1) + ": ไม่พบรายการปฏิทิน \"" + it.campaign + "\"");
      const due = toIso(it.dueAt);
      if (it.dueAt && !due) problems.push("งานที่ " + (i + 1) + ": อ่านวันครบกำหนดไม่ออก \"" + it.dueAt + "\"");
      items.push({
        title: String(it.title || "").trim(), detail: it.detail || "", assignees: ids, dueAt: due,
        repeat: it.repeat === "daily" || it.repeat === "weekly" ? it.repeat : "", priority: !!it.priority,
        kpiId: kpi ? kpi.id : (guessKpi(ctx.kpis, (it.title || "") + " " + (it.detail || "")) || null),
        campaignId: camp ? camp.id : null, parentId: it.parentId || null,
      });
    });
    if (problems.length) throw new Error(problems.join(" · ") + " — แก้แล้วเรียกใหม่ (ยังไม่ได้บันทึกอะไร)");
    const j = await tApi(env, token, "POST", "/tasks", { tasks: items });
    const ids = j.ids || [];
    return {
      created: ids.length,
      tasks: items.map((it, i) => ({
        id: ids[i], title: it.title, assignees: it.assignees.map((id) => (ctx.staff.find((x) => x.id === id) || { name: id }).name),
        due: it.dueAt ? bkkDate(Date.parse(it.dueAt)) + " " + bkkTime(Date.parse(it.dueAt)) : null,
        kpi: (ctx.kpis.find((k) => k.id === it.kpiId) || {}).code || null, link: ids[i] ? taskLink(ids[i]) : null,
      })),
    };
  }

  if (name === "update_task") {
    const body = {};
    if (args.status) body.status = args.status;
    if (args.title != null) body.title = args.title;
    if (args.detail != null) body.detail = args.detail;
    if (args.priority != null) body.priority = !!args.priority;
    if (args.dueAt !== undefined) {
      if (args.dueAt === "" || args.dueAt === null) body.dueAt = null;
      else { const d = toIso(args.dueAt); if (!d) throw new Error("อ่านวันครบกำหนดไม่ออก: " + args.dueAt); body.dueAt = d; }
    }
    if (args.assignees) {
      body.assignees = [];
      args.assignees.forEach((n) => { const s = findStaff(ctx.staff, n); if (!s) throw new Error("ไม่พบคน \"" + n + "\""); if (body.assignees.indexOf(s.id) === -1) body.assignees.push(s.id); });
    }
    if (args.kpi) { const k = findKpi(ctx.kpis, args.kpi); if (!k) throw new Error("ไม่พบ KPI \"" + args.kpi + "\""); body.kpiId = k.id; }
    let changed = false;
    if (Object.keys(body).length) { await tApi(env, token, "PUT", "/tasks/" + encodeURIComponent(args.id), body); changed = true; }
    if (args.note) { await tApi(env, token, "POST", "/tasks/" + encodeURIComponent(args.id) + "/updates", { note: args.note }); changed = true; }
    if (!changed) throw new Error("ไม่มีอะไรให้แก้ — ระบุ status/title/detail/dueAt/assignees/note อย่างน้อยหนึ่งอย่าง");
    const j = await tApi(env, token, "GET", "/tasks/" + encodeURIComponent(args.id));
    return { ok: true, task: fmtTask(j.task || j, ctx, now) };
  }

  if (name === "list_posts") {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(args.from || "") ? args.from : bkkDate(now);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(args.to || "") ? args.to : from;
    const pg = args.page ? findPage(ctx.pages, args.page) : null;
    if (args.page && !pg) throw new Error("ไม่พบเพจ \"" + args.page + "\" (ดูรายชื่อจาก get_context)");
    let posts = (await tApi(env, token, "GET", "/posts?from=" + from + "&to=" + to + (pg ? "&page=" + pg.id : ""))).posts || [];
    if (pg) posts = posts.filter((p) => p.pageId === pg.id);
    const st = args.status || "all";
    posts = posts.filter((p) => st === "all" || (st === "nolink" ? (p.status === "done" && !p.url) : p.status === st));
    return {
      from, to, count: posts.length,
      posts: posts.map((p) => ({
        id: p.id, date: p.date, time: p.time, page: (ctx.pages.find((x) => x.id === p.pageId) || { name: p.pageId }).name,
        topic: p.topic, kind: p.kind, channels: p.channels, status: p.status, url: p.url || null, note: p.note || "",
        campaign: (ctx.campaigns.find((c) => c.id === p.campaignId) || {}).name || null,
      })),
    };
  }

  if (name === "upsert_posts") {
    const list = args.posts || [];
    const dates = list.map((p) => p.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if (!dates.length) throw new Error("ต้องมี date รูปแบบ YYYY-MM-DD อย่างน้อยหนึ่งแถว");
    const existing = (await tApi(env, token, "GET", "/posts?from=" + dates[0] + "&to=" + dates[dates.length - 1])).posts || [];
    /* จับคู่ของเดิมแบบเดียวกับกล่องวาง Excel: เพจ+วัน+เวลา+หัวข้อ ก่อน → แล้วค่อย เพจ+วัน+เวลา (ถ้ามีอันเดียว)
       ในชุดเดียวกันถ้าส่งช่องเดิมซ้ำ เอาแถวหลังทับแถวหน้า ไม่สร้างสองอัน */
    const topicKey = (t) => String(t || "").toLowerCase().replace(/[\s\-_.·,"'()]/g, "").slice(0, 40);
    const byKey = {}, slot = {};
    existing.forEach((p) => {
      byKey[p.pageId + "|" + p.date + "|" + (p.time || "") + "|" + topicKey(p.topic)] = p.id;
      const k = p.pageId + "|" + p.date + "|" + (p.time || "");
      slot[k] = slot[k] ? "many" : p.id;
    });
    const defaultPage = ctx.pages[0] ? ctx.pages[0].id : "";
    const payload = [];
    const seen = {};
    list.forEach((p, i) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "")) throw new Error("แถวที่ " + (i + 1) + ": date ต้องเป็น YYYY-MM-DD");
      const pg = p.page ? findPage(ctx.pages, p.page) : null;
      if (p.page && !pg) throw new Error("แถวที่ " + (i + 1) + ": ไม่พบเพจ \"" + p.page + "\"");
      const camp = p.campaign ? findCampaign(ctx.campaigns, p.campaign) : null;
      const pageId = pg ? pg.id : defaultPage;
      const time = String(p.time || "").replace(":", ".");
      const k = pageId + "|" + p.date + "|" + time;
      let id = p.id || byKey[k + "|" + topicKey(p.topic)] || (slot[k] && slot[k] !== "many" ? slot[k] : null) || null;
      const row = {
        id: id || undefined, pageId, date: p.date, time, channels: p.channels || [], topic: p.topic || "",
        kind: p.kind || "content", status: p.url ? "done" : (p.status || "plan"), url: p.url || "", note: p.note || "",
        campaignId: camp ? camp.id : null, postedAt: p.url || p.status === "done" ? new Date(now).toISOString() : null,
        _up: !!id,
      };
      if (seen[k] != null) payload[seen[k]] = Object.assign(row, { id: payload[seen[k]].id, _up: payload[seen[k]]._up });
      else { seen[k] = payload.length; payload.push(row); }
    });
    const nUp = payload.filter((r) => r._up).length;
    payload.forEach((r) => { delete r._up; });
    const j = await tApi(env, token, "POST", "/posts", { posts: payload });
    return { saved: payload.length, updated: nUp, created: payload.length - nUp, ids: j.ids || [], link: SITE + "/tasks/#/posts?view=grid&range=all" };
  }

  if (name === "list_campaigns") {
    let list = ctx.campaigns.slice();
    if (args.kind) list = list.filter((c) => c.kind === args.kind);
    if (args.from) list = list.filter((c) => (c.end || c.start) >= args.from);
    if (args.to) list = list.filter((c) => c.start <= args.to);
    const full = await cApi(env, token, handleApi, "GET", "/campaigns").catch(() => null);
    const detail = full && Array.isArray(full.campaigns) ? full.campaigns : (Array.isArray(full) ? full : []);
    return {
      count: list.length,
      campaigns: list.map((c) => {
        const d = detail.find((x) => x.id === c.id) || {};
        return { id: c.id, name: c.name, kind: c.kind, start: c.start, end: c.end, status: c.status,
                 branches: d.branches || [], channels: d.channels || [], budget: d.budget || 0, owner: d.owner || "",
                 note: d.note || "", posts: d.posts || null, tasks: d.tasks || null,
                 link: SITE + "/cmo/campaign-calendar#c=" + c.id };
      }),
    };
  }
  throw new Error("ไม่รู้จักเครื่องมือ " + name);
}
function guessKpi(kpis, text) {
  const low = String(text || "").toLowerCase();
  let best = null, bestN = 0;
  kpis.forEach((k) => {
    let n = 0;
    String(k.keywords || "").split(",").forEach((w) => { w = w.trim().toLowerCase(); if (w && low.indexOf(w) !== -1) n += w.length > 3 ? 2 : 1; });
    if (n > bestN) { bestN = n; best = k.id; }
  });
  return best;
}

/* ---------- JSON-RPC ---------- */
const INSTRUCTIONS =
  "นี่คือระบบหลังบ้านของ KAN (admin.kan-hub.com): งานทีม ตารางโพสต์ ปฏิทินการตลาด KPI\n" +
  "ลำดับที่ควรทำ: เรียก get_context ก่อนเพื่อรู้วันที่วันนี้ รายชื่อทีม (ใช้ชื่อเล่นได้ เช่น Pizza, Title) รายการ KPI และเพจ\n" +
  "สรุปงานประจำวัน → today_summary · สั่งงานจากโน้ต → แตกเป็นงานละหนึ่งเรื่อง ชื่อสั้นชัด แล้ว create_tasks ทีเดียว\n" +
  "เวลาทั้งหมดเป็นเวลาไทย (UTC+7) รูปแบบ YYYY-MM-DD HH:mm · ตอบผู้ใช้เป็นภาษาไทย แนบลิงก์ที่ได้จากเครื่องมือ";

function rpcError(id, code, message) { return { jsonrpc: "2.0", id: id == null ? null : id, error: { code, message } }; }

async function handleOne(msg, env, token, handleApi) {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(msg && msg.id, -32600, "Invalid Request");
  }
  const id = msg.id;
  const isNotif = id === undefined;
  const m = msg.method, p = msg.params || {};
  if (m === "initialize") {
    const want = String(p.protocolVersion || "");
    return { jsonrpc: "2.0", id, result: {
      protocolVersion: PROTOCOLS.indexOf(want) !== -1 ? want : PROTOCOLS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "kan-admin", title: "KAN Admin (งานทีม · ตารางโพสต์ · ปฏิทินการตลาด)", version: "1.0.0" },
      instructions: INSTRUCTIONS,
    } };
  }
  if (m === "notifications/initialized" || m === "notifications/cancelled" || m.indexOf("notifications/") === 0) return null;
  if (m === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (m === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  if (m === "resources/list") return { jsonrpc: "2.0", id, result: { resources: [] } };
  if (m === "resources/templates/list") return { jsonrpc: "2.0", id, result: { resourceTemplates: [] } };
  if (m === "prompts/list") return { jsonrpc: "2.0", id, result: { prompts: [] } };
  if (m === "tools/call") {
    const name = String(p.name || "");
    if (!TOOLS.some((t) => t.name === name)) return rpcError(id, -32602, "Unknown tool: " + name);
    try {
      const out = await runTool(name, p.arguments || {}, env, token, handleApi);
      return { jsonrpc: "2.0", id, result: {
        content: [{ type: "text", text: JSON.stringify(out, null, 1) }],
        structuredContent: out, isError: false,
      } };
    } catch (e) {
      return { jsonrpc: "2.0", id, result: {
        content: [{ type: "text", text: "ผิดพลาด: " + (e && e.message ? e.message : String(e)) }], isError: true,
      } };
    }
  }
  if (isNotif) return null;
  return rpcError(id, -32601, "Method not found: " + m);
}

export async function handleMcp(request, env, url, pathToken, handleApi) {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, mcp-session-id, mcp-protocol-version, accept",
    "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const auth = request.headers.get("authorization") || "";
  const bm = auth.match(/^Bearer\s+([A-Za-z0-9]{32,80})$/i);
  const token = pathToken || (bm ? bm[1] : "");
  if (!token) return json({ error: "ต้องมี token: ใช้ URL /mcp/<token> หรือ header Authorization: Bearer <token>" }, 401, cors);

  /* ตรวจ token ก่อนทำอะไร — ผ่าน /me ในสิทธิ์ของ token นั้น */
  let me = null;
  try { me = (await tApi(env, token, "GET", "/me")).me; } catch (e) { me = null; }
  if (!me) return json({ error: "token ไม่ถูกต้องหรือถูกยกเลิกแล้ว" }, 401, cors);

  if (request.method === "GET") {
    /* ไม่มี stream ฝั่งเซิร์ฟเวอร์ — บอกลูกค้าให้ใช้ POST อย่างเดียว */
    return new Response("Method Not Allowed (POST JSON-RPC only)", { status: 405, headers: Object.assign({ allow: "POST, DELETE, OPTIONS" }, cors) });
  }
  if (request.method === "DELETE") return new Response(null, { status: 200, headers: cors });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

  let body;
  try { body = await request.json(); } catch (e) { return json(rpcError(null, -32700, "Parse error"), 400, cors); }
  const batch = Array.isArray(body);
  const msgs = batch ? body : [body];
  const out = [];
  for (const msg of msgs) {
    const r = await handleOne(msg, env, token, handleApi);
    if (r) out.push(r);
  }
  if (!out.length) return new Response(null, { status: 202, headers: cors });
  return json(batch ? out : out[0], 200, Object.assign({ "mcp-protocol-version": PROTOCOLS[0] }, cors));
}
