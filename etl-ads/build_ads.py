# -*- coding: utf-8 -*-
"""สร้าง public/admin/mkt/data/ads-data.js จากไฟล์ที่ดึงมาจาก Meta Ads
   (ดู README.md ในโฟลเดอร์นี้ว่าดึงมาด้วยคำสั่งอะไร) — ห้ามแก้ไฟล์ผลลัพธ์ด้วยมือ"""
import json, re, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, '..', 'public', 'admin', 'mkt', 'data', 'ads-data.js')

def money(s):
    if not s: return 0.0
    m = re.sub(r'[^\d.]', '', s.replace(',', ''))
    return float(m) if m else 0.0

def num(s):
    if s in (None, '', 'Not available'): return 0
    return int(float(str(s).replace(',', '')))

# ── สาขา: เลข #0X ในชื่อแคมเปญคือรหัสสาขาเดียวกับฝั่งยอดขาย ─────────────
#   #01 ชุมพร · #02 นคร (ตัดออกจากฝั่งยอดขายแล้ว) · #03 สุราษฎร์
#   #04 Kan Fashion · #05 KAN HUB (โกดัง)  · ไม่มีเลข = HUB (แคมเปญแรกสุด)
BRANCH = {
    '01': {'key': 'chumphon', 'name': 'ชุมพร',            'sales': 'KST#1'},
    '02': {'key': 'nakhon',   'name': 'นครศรีธรรมราช',   'sales': None},
    '03': {'key': 'surat',    'name': 'สุราษฎร์ธานี',      'sales': 'KST#3'},
    '04': {'key': 'fashion',  'name': 'Kan Fashion',      'sales': 'KST#4'},
    '05': {'key': 'hub',      'name': 'KAN HUB',          'sales': 'KST#0'},
}
def branch_of(name):
    m = re.search(r'#\s?0?(\d)', name)
    if m:
        b = BRANCH.get('0' + m.group(1))
        if b: return b['key']
    if 'Kan_Hub' in name or 'Kan Hub' in name: return 'hub'
    if 'Fashion' in name: return 'fashion'
    return 'other'

# ── ประเภทแคมเปญ: อ่านจากชื่อ ให้รู้ว่าจ่ายเงินไปเพื่ออะไร ────────────────
def goal_of(name, objective):
    n = name.lower()
    if 'lead' in n:            return 'lead'      # เก็บรายชื่อ
    if 'msg' in n:             return 'msg'       # ทักแชท
    if 'video view' in n:      return 'video'
    if 'aware' in n:           return 'aware'     # การรับรู้
    if 'live' in n:            return 'live'
    if objective == 'OUTCOME_LEADS':  return 'lead'
    return 'engage'                               # โพสต์/บูสต์ทั่วไป

# ── รายวัน × แคมเปญ ─────────────────────────────────────────────────────
daily = {}   # (date, campaign_id) -> dict
for f in ('may.json', 'jun.json', 'jul.json', 'aug.json'):
    for r in json.load(open(os.path.join(HERE, f))):
        spend = money(r.get('amount_spent'))
        if spend <= 0: continue
        k = (r['date_start'], r['id'])
        d = daily.setdefault(k, {'spend': 0.0, 'imp': 0, 'reach': 0, 'clicks': 0,
                                 'eng': 0, 'lc': 0, 'lead': 0})
        d['spend']  += spend
        d['imp']    += num(r.get('impressions'))
        d['reach']  += num(r.get('reach'))
        d['clicks'] += num(r.get('clicks'))
        d['eng']    += num(r.get('post_engagement'))
        d['lc']     += num(r.get('actions:link_click'))
        d['lead']   += num(r.get('lead'))

# ── แคมเปญ (ยอดรวมทั้งช่วง — reach/frequency ที่ถูกต้องอยู่ตรงนี้เท่านั้น) ──
camps = {}
for r in json.load(open(os.path.join(HERE, 'tot.json'))):
    spend = money(r.get('amount_spent'))
    if spend <= 0: continue
    res = r.get('results') or {}
    rv  = res.get('values')
    cpr = (r.get('cost_per_result') or {}).get('value') or ''
    camps[r['id']] = {
        'id':    r['id'],
        'name':  r['name'],
        'br':    branch_of(r['name']),
        'goal':  goal_of(r['name'], r.get('objective')),
        'obj':   r.get('objective'),
        'st':    r.get('effective_status'),
        'start': (r.get('start_time') or '')[:10],
        'stop':  (r.get('stop_time') or '')[:10],
        'spend': round(spend, 2),
        'imp':   num(r.get('impressions')),
        'reach': num(r.get('reach')),
        'freq':  round(float(r.get('frequency') or 0), 2),
        'clicks':num(r.get('clicks')),
        'res':   num(rv[0]['value']) if rv else 0,
        'resKind': (res.get('indicator') or '').replace('actions:', ''),
        'cpr':   money(cpr),
        'eng':   num(r.get('post_engagement')),
        'lc':    num(r.get('actions:link_click')),
        'react': num(r.get('actions:post_reaction')),
        'cmt':   num(r.get('actions:comment')),
        'shr':   num(r.get('post_shares')),
        'lead':  num(r.get('lead')),
        'play':  num(r.get('video_thruplay_watched_actions')),
    }

# แคมเปญที่โผล่ในรายวันแต่ไม่อยู่ในตารางรวม (ไม่ควรมี — กันพลาด)
for (dt, cid), d in daily.items():
    if cid not in camps:
        camps[cid] = {'id': cid, 'name': '(ไม่พบชื่อแคมเปญ) ' + cid, 'br': 'other',
                      'goal': 'engage', 'obj': None, 'st': 'UNKNOWN', 'start': dt,
                      'stop': '', 'spend': 0, 'imp': 0, 'reach': 0, 'freq': 0,
                      'clicks': 0, 'res': 0, 'resKind': '', 'cpr': 0, 'eng': 0,
                      'lc': 0, 'react': 0, 'cmt': 0, 'shr': 0, 'lead': 0, 'play': 0}

order = sorted(camps.keys())
idx   = {cid: i for i, cid in enumerate(order)}

dates = sorted(set(dt for dt, _ in daily))
rows  = sorted(([dt, idx[cid],
                 round(d['spend'], 2), d['imp'], d['reach'], d['clicks'],
                 d['eng'], d['lc'], d['lead']]
                for (dt, cid), d in daily.items()),
               key=lambda r: (r[0], r[1]))

bd = json.load(open(os.path.join(HERE, 'breakdowns.json')))

data = {
    'meta': {
        'generated': datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
        'account':   {'id': '1687146548953347', 'name': 'Kan x MCC'},
        'dateMin':   dates[0],
        'dateMax':   dates[-1],
        'currency':  'THB',
        # ช่วงที่ breakdown (อายุ/เพศ/แพลตฟอร์ม/จังหวัด/ชั่วโมง) ครอบคลุม
        # — ก้อนนี้เป็นยอดรวมช่วงเดียว ไม่ขยับตามตัวกรองวันที่
        'bdRange':   ['2026-05-27', '2026-08-25'],
    },
    'branches': [{'key': v['key'], 'name': v['name'], 'sales': v['sales']}
                 for k, v in sorted(BRANCH.items())],
    'campaigns': [camps[cid] for cid in order],
    # [วันที่, ดัชนีแคมเปญ, ค่าแอด, การมองเห็น, คนที่เห็น, คลิก, มีส่วนร่วม, คลิกลิงก์, รายชื่อ]
    'daily': rows,
    'breakdowns': bd,
}

js = ('/* generated by etl-ads/build_ads.py — do not edit by hand */\n'
      'window.KAN_ADS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(OUT, 'w').write(js)

tot = sum(r[2] for r in rows)
print('campaigns', len(order), '· daily rows', len(rows),
      '·', dates[0], '→', dates[-1], '· spend ฿%.2f' % tot)
print('out', OUT, os.path.getsize(OUT), 'bytes')
by = {}
for c in camps.values(): by[c['br']] = by.get(c['br'], 0) + c['spend']
print('by branch', {k: round(v) for k, v in sorted(by.items(), key=lambda x: -x[1])})
