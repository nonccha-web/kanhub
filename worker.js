// KAN — routing ตาม hostname
//  admin.kan-hub.com      → เสิร์ฟเนื้อหาใน /admin (หลังบ้าน ERP) + API ที่ /api/*
//  kan-hub.com / www      → เว็บการตลาด (ซ่อน /admin และ /api ไม่ให้เข้าตรง)
//  *.workers.dev          → เข้าได้ทั้งคู่ (ไว้เทสต์)

const MAX_ATTACHMENT_BYTES = 1500000; // ~1.5MB ต่อรูป (ย่อฝั่งเบราว์เซอร์มาก่อนแล้ว)
const MAX_ATTACHMENTS_PER_CAMPAIGN = 6;
const SEP = String.fromCharCode(31); // คั่น id กับชื่อไฟล์ใน GROUP_CONCAT

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function safeParse(s) {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function rowToCampaign(r) {
  const attachments = [];
  if (r.attachment_ids) {
    for (const pair of String(r.attachment_ids).split(",")) {
      if (!pair) continue;
      const [id, fileName] = pair.split(SEP);
      if (id) attachments.push({ id, fileName: fileName || "image" });
    }
  }
  return {
    id: r.id,
    name: r.name,
    start: r.start_date,
    end: r.end_date,
    scope: r.scope,
    status: r.status,
    channels: safeParse(r.channels),
    branches: safeParse(r.branches),
    budget: r.budget,
    owner: r.owner,
    note: r.note,
    attachments: attachments,
    updatedAt: r.updated_at,
  };
}

function clean(input) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const name = String(input.name || "").trim().slice(0, 200);
  const start = iso.test(input.start) ? input.start : null;
  const end = iso.test(input.end) ? input.end : start;
  if (!name) return { error: "ต้องมีชื่อแคมเปญ" };
  if (!start) return { error: "วันเริ่มไม่ถูกต้อง" };
  if (end < start) return { error: "วันสิ้นสุดมาก่อนวันเริ่ม" };
  return {
    value: {
      name: name,
      start: start,
      end: end,
      scope: input.scope === "month" ? "month" : "range",
      status: ["plan", "live", "done"].indexOf(input.status) !== -1 ? input.status : "plan",
      channels: JSON.stringify(Array.isArray(input.channels) ? input.channels.slice(0, 20) : []),
      branches: JSON.stringify(Array.isArray(input.branches) ? input.branches.slice(0, 20) : []),
      budget: Math.max(0, Math.round(Number(input.budget) || 0)),
      owner: String(input.owner || "").trim().slice(0, 120),
      note: String(input.note || "").trim().slice(0, 4000),
    },
  };
}

const LIST_SQL =
  "SELECT c.*, GROUP_CONCAT(a.id || char(31) || a.file_name) AS attachment_ids " +
  "FROM campaigns c LEFT JOIN attachments a ON a.campaign_id = c.id " +
  "GROUP BY c.id ORDER BY c.start_date ASC";

async function handleApi(request, env, url) {
  const db = env.KAN_ERP;
  if (!db) return json({ error: "ยังไม่ได้ผูกฐานข้อมูล" }, 503);

  const path = url.pathname.replace(/^\/api/, "");
  const method = request.method;

  // ---- รูปแนบ ----
  const fileMatch = path.match(/^\/attachments\/([A-Za-z0-9_-]{1,40})$/);
  if (fileMatch && method === "GET") {
    const row = await db.prepare("SELECT mime, data, file_name FROM attachments WHERE id = ?")
      .bind(fileMatch[1]).first();
    if (!row) return new Response("ไม่พบรูป", { status: 404 });
    const binary = atob(row.data);
    const bin = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bin[i] = binary.charCodeAt(i);
    return new Response(bin, {
      headers: {
        "content-type": row.mime || "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }
  if (fileMatch && method === "DELETE") {
    await db.prepare("DELETE FROM attachments WHERE id = ?").bind(fileMatch[1]).run();
    return json({ ok: true });
  }

  // ---- แคมเปญ ----
  if (path === "/campaigns" && method === "GET") {
    const res = await db.prepare(LIST_SQL).all();
    return json({ campaigns: (res.results || []).map(rowToCampaign) });
  }

  if (path === "/campaigns" && method === "POST") {
    const body = await request.json().catch(function () { return {}; });
    const parsed = clean(body);
    if (parsed.error) return json({ error: parsed.error }, 400);
    const v = parsed.value;
    const id = "c" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const now = new Date().toISOString();
    await db.prepare(
      "INSERT INTO campaigns (id,name,start_date,end_date,scope,status,channels,branches,budget,owner,note,created_at,updated_at) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id, v.name, v.start, v.end, v.scope, v.status, v.channels, v.branches, v.budget,
           v.owner, v.note, now, now).run();
    return json({ id: id });
  }

  const idMatch = path.match(/^\/campaigns\/([A-Za-z0-9_-]{1,40})$/);
  if (idMatch) {
    const id = idMatch[1];

    if (method === "PUT") {
      const body = await request.json().catch(function () { return {}; });
      const parsed = clean(body);
      if (parsed.error) return json({ error: parsed.error }, 400);
      const v = parsed.value;
      const res = await db.prepare(
        "UPDATE campaigns SET name=?,start_date=?,end_date=?,scope=?,status=?,channels=?,branches=?," +
        "budget=?,owner=?,note=?,updated_at=? WHERE id=?"
      ).bind(v.name, v.start, v.end, v.scope, v.status, v.channels, v.branches, v.budget,
             v.owner, v.note, new Date().toISOString(), id).run();
      if (!res.meta.changes) return json({ error: "ไม่พบแคมเปญนี้" }, 404);
      return json({ ok: true });
    }

    if (method === "DELETE") {
      await db.batch([
        db.prepare("DELETE FROM attachments WHERE campaign_id = ?").bind(id),
        db.prepare("DELETE FROM campaigns WHERE id = ?").bind(id),
      ]);
      return json({ ok: true });
    }

    if (method === "POST" && url.searchParams.get("action") === "attach") {
      const body = await request.json().catch(function () { return {}; });
      const dataUrl = String(body.dataUrl || "");
      const m = dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/);
      if (!m) return json({ error: "ไฟล์ไม่ถูกต้อง" }, 400);
      const mime = m[1];
      const b64 = m[2];
      if (mime.indexOf("image/") !== 0) return json({ error: "รับเฉพาะไฟล์รูป" }, 400);
      const bytes = Math.floor((b64.length * 3) / 4);
      if (bytes > MAX_ATTACHMENT_BYTES) return json({ error: "รูปใหญ่เกินไป" }, 413);

      const exists = await db.prepare("SELECT id FROM campaigns WHERE id = ?").bind(id).first();
      if (!exists) return json({ error: "ไม่พบแคมเปญนี้" }, 404);
      const count = await db.prepare("SELECT COUNT(*) AS n FROM attachments WHERE campaign_id = ?")
        .bind(id).first();
      if ((count && count.n ? count.n : 0) >= MAX_ATTACHMENTS_PER_CAMPAIGN) {
        return json({ error: "แนบได้สูงสุด " + MAX_ATTACHMENTS_PER_CAMPAIGN + " รูปต่อแคมเปญ" }, 409);
      }

      const aid = "a" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      await db.prepare(
        "INSERT INTO attachments (id,campaign_id,file_name,mime,bytes,data,created_at) VALUES (?,?,?,?,?,?,?)"
      ).bind(aid, id, String(body.fileName || "image").slice(0, 160), mime, bytes, b64,
             new Date().toISOString()).run();
      return json({ id: aid });
    }
  }

  return json({ error: "ไม่พบ endpoint นี้" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname;
    const isAdminHost = host.indexOf("admin.") === 0 || host.endsWith(".workers.dev") ||
                        host === "localhost" || host === "127.0.0.1"; // localhost = ตอน wrangler dev

    // --- API หลังบ้าน (เฉพาะ admin subdomain) ---
    if (url.pathname.indexOf("/api/") === 0) {
      if (!isAdminHost) return new Response("Not found", { status: 404 });
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: "เซิร์ฟเวอร์ผิดพลาด: " + (err && err.message ? err.message : String(err)) }, 500);
      }
    }

    // --- หลังบ้าน: admin subdomain → map root ไป /admin/* ---
    if (host.indexOf("admin.") === 0) {
      if (url.pathname.indexOf("/admin") !== 0) {
        url.pathname = url.pathname === "/" ? "/admin/" : "/admin" + url.pathname;
      }
      return env.ASSETS.fetch(new Request(url, request));
    }

    // --- โดเมนหลักสาธารณะ: ซ่อน /admin (กันเข้าตรง) ---
    if (host === "kan-hub.com" || host === "www.kan-hub.com") {
      if (url.pathname === "/admin" || url.pathname.indexOf("/admin/") === 0) {
        return new Response("Not found", { status: 404 });
      }
    }

    // ที่เหลือ (รวม workers.dev) เสิร์ฟตามปกติ
    return env.ASSETS.fetch(request);
  },
};
