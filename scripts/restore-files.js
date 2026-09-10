#!/usr/bin/env node
/* คืนรูปและไฟล์แนบจากไฟล์สำรอง kan-files-*.json(.gz) กลับเข้าระบบ
   ใช้ตอนกู้ฐานข้อมูลจากไฟล์ .sql แล้วรูปหาย (แถวรูปยาวเกินกว่าจะ import ด้วย .sql ได้)

   วิธีใช้
     node scripts/restore-files.js ~/kanhub-backups/kan-files-2026-09-10-1030.json.gz \
       --url https://admin.kan-hub.com --token <token ของหัวหน้าจากหน้า "ทีม + สิทธิ์">

   ตรวจก่อนโดยไม่เขียนจริง: เติม --dry
*/
'use strict';
const fs = require('fs');
const zlib = require('zlib');

const args = process.argv.slice(2);
const file = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i === -1 ? d : args[i + 1]; };
const dry = args.includes('--dry');
const base = (opt('url', 'https://admin.kan-hub.com') || '').replace(/\/$/, '');
const token = opt('token', process.env.KAN_TOKEN || '');

if (!file || (!token && !dry)) {
  console.error('ใช้: node scripts/restore-files.js <ไฟล์ kan-files-*.json[.gz]> --url <เว็บ> --token <token หัวหน้า> [--dry]');
  process.exit(1);
}
const raw = fs.readFileSync(file);
const json = JSON.parse(file.endsWith('.gz') ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8'));
const tables = json.tables || {};

(async () => {
  for (const table of ['task_files', 'attachments']) {
    const rows = tables[table] || [];
    if (!rows.length) { console.log(table + ': ไม่มีข้อมูลในไฟล์สำรอง'); continue; }
    const mb = (JSON.stringify(rows).length / 1048576).toFixed(1);
    console.log(table + ': ' + rows.length + ' แถว (' + mb + ' MB)' + (dry ? ' — โหมดตรวจอย่างเดียว' : ''));
    if (dry) continue;
    let done = 0;
    for (let i = 0; i < rows.length; i += 5) {
      const chunk = rows.slice(i, i + 5);
      const res = await fetch(base + '/api/t/backup/restore-files', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ table, rows: chunk }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { console.error('  ล้มเหลวที่แถว ' + i + ': ' + (j.error || res.status)); process.exit(1); }
      done += j.restored || 0;
      process.stdout.write('\r  คืนแล้ว ' + done + '/' + rows.length + ' แถว');
    }
    console.log('\r  คืนแล้ว ' + done + '/' + rows.length + ' แถว ✓          ');
  }
  console.log('เสร็จ · เปิดเว็บดูว่ารูปกลับมาครบไหม');
})().catch((e) => { console.error('ผิดพลาด:', e.message); process.exit(1); });
