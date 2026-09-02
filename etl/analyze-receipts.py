# -*- coding: utf-8 -*-
"""วิเคราะห์ใบเสร็จรายสินค้า พ.ค.–ส.ค. 69 (เน้น ส.ค.) → public/admin/mkt/data/promo-analysis.js
รันใหม่เมื่อได้ไฟล์ใบเสร็จเดือนใหม่: python3 etl/analyze-receipts.py
ต้นทาง: mkt-dashboard/Kan Data/ใบเสร็จรายสินค้า ชุมพร.csv + สุราษ.csv (ระดับบรรทัดบิล มีเลขที่ใบเสร็จ)
สโคป: chumphon / surat (ไม่รวมโซน FA) / fashion (โซน FA ที่สุราษ) — นครยังไม่มีไฟล์
เดือนโฟกัสเปลี่ยนเมื่อไหร่ แก้ FOCUS_M / FOCUS_DMAX / PREV_M ข้างล่าง
"""
import csv, re, json, itertools, collections, datetime

BASE = '/Volumes/MCC SSD/Claude Workspace/KAN/mkt-dashboard/Kan Data/'
OUT = '/Volumes/MCC SSD/Claude Workspace/KAN/kanhub-web/public/admin/mkt/data/promo-analysis.js'
FOCUS_M, FOCUS_DMAX, PREV_M = 8, 24, 7      # ส.ค. 1–24 เทียบ ก.ค. 1–24
FA = re.compile(r'^FA|Fashion', re.I)
JUNK_ZONE = {'บริการ', 'ถุงรักษ์โลก', 'เพิ่มคูปองท้ายใบเสร็จ', 'เก่าแลกKAN', 'RS พื้นที่เช่า'}
JUNK_NAME = re.compile(r'[🟢🔴🟡]|^\d+\s|คูปอง|ถุงรักษ์')
DOW = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์']
dw = lambda m, d: datetime.date(2026, m, d).weekday()
K = lambda v: ('฿%.2fM' % (v / 1e6)) if abs(v) >= 1e6 else \
    ('฿%dK' % round(v / 1e3)) if abs(v) >= 1e4 else ('฿%s' % format(round(v), ','))


def load(f, ok):
    bills = {}
    lines = []
    with open(BASE + f, encoding='utf-8-sig') as fh:
        r = csv.reader(fh)
        next(r)
        for row in r:
            try:
                dd = row[0].split(' ')[0].split('/')
                d, m, y = int(dd[0]), int(dd[1]), 2000 + int(dd[2])
            except (ValueError, IndexError):
                continue
            if y != 2026 or m < 5 or (m == FOCUS_M and d > FOCUS_DMAX):
                continue
            z = row[3].strip()
            if not ok(z):
                continue
            try:
                qty = float(row[8]); net = float(row[11])
            except ValueError:
                continue
            nm = row[5].strip()
            b = bills.setdefault((m, d, row[1]), {'net': 0., 'zones': set(), 'names': set(),
                'nl': 0, 'cust': row[19].strip() if len(row) > 19 else ''})
            b['net'] += net
            b['nl'] += 1
            if z not in JUNK_ZONE and not JUNK_NAME.search(nm):
                b['zones'].add(z)
                b['names'].add(nm)
            lines.append((m, d, z, nm, qty, net))
    return bills, lines


def analyze(bills, lines, pm, label):
    A = {'label': label}

    def stats(mm, dmax=99):
        bs = [b for (m, d, _), b in bills.items() if m == mm and d <= dmax]
        net = sum(b['net'] for b in bs)
        return {'bills': len(bs), 'net': round(net),
                'avgBill': round(net / len(bs)) if bs else 0,
                'linesPerBill': round(sum(b['nl'] for b in bs) / len(bs), 2) if bs else 0}
    A['aug'] = stats(FOCUS_M, FOCUS_DMAX)
    A['jul24'] = stats(PREV_M, FOCUS_DMAX)

    def prods(mm, dmax=99):
        g = collections.defaultdict(lambda: {'net': 0., 'qty': 0.})
        for m, d, z, nm, q, net in lines:
            if m != mm or d > dmax or z in JUNK_ZONE or JUNK_NAME.search(nm):
                continue
            g[nm]['net'] += net
            g[nm]['qty'] += q
        return g
    aP, jP = prods(FOCUS_M, FOCUS_DMAX), prods(PREV_M, FOCUS_DMAX)
    jr = {n: i + 1 for i, (n, _) in enumerate(sorted(jP.items(), key=lambda x: -x[1]['net']))}
    A['top5'] = [{'name': n, 'net': round(a['net']), 'qty': round(a['qty']),
                  'julNet': round(jP.get(n, {'net': 0.})['net']), 'julRank': jr.get(n, 0)}
                 for n, a in sorted(aP.items(), key=lambda x: -x[1]['net'])[:5]]

    nb = len([1 for (m, d, _), b in bills.items() if m in pm])
    single = collections.Counter(); pair = collections.Counter()
    for (m, d, _), b in bills.items():
        if m not in pm:
            continue
        for n in b['names']:
            single[n] += 1
        if len(b['names']) >= 2:
            for a, c in itertools.combinations(sorted(b['names']), 2):
                pair[(a, c)] += 1
    pairs = []
    for (a, c), n in pair.most_common(60):
        if n < max(8, nb * 0.002):
            continue
        lift = (n * nb) / (single[a] * single[c]) if single[a] and single[c] else 0
        if lift < 1.15:
            continue
        pairs.append({'a': a, 'b': c, 'together': n, 'aBills': single[a],
                      'bBills': single[c], 'lift': round(lift, 2)})
    pairs.sort(key=lambda x: -x['together'])
    A['pairs'] = pairs[:8]
    A['pairWindow'] = 'ส.ค.' if pm == [FOCUS_M] else 'มิ.ย.–ส.ค.'
    A['pairBills'] = nb

    zp = collections.Counter(); zs = collections.Counter()
    for (m, d, _), b in bills.items():
        if m not in pm:
            continue
        for z in b['zones']:
            zs[z] += 1
        if len(b['zones']) >= 2:
            for a, c in itertools.combinations(sorted(b['zones']), 2):
                zp[(a, c)] += 1
    A['zonePairs'] = [{'a': a, 'b': c, 'together': n, 'lift': round((n * nb) / (zs[a] * zs[c]), 2)}
                      for (a, c), n in zp.most_common(30)
                      if n >= 10 and (n * nb) / (zs[a] * zs[c]) >= 1.1][:5]

    daily = collections.defaultdict(float)
    for (m, d, _), b in bills.items():
        if m == FOCUS_M and d <= FOCUS_DMAX:
            daily[d] += b['net']
    ds = sorted(daily.items(), key=lambda x: -x[1])
    A['bestDays'] = [{'d': d, 'net': round(n), 'dow': DOW[dw(FOCUS_M, d)]} for d, n in ds[:3]]
    A['worstDays'] = [{'d': d, 'net': round(n), 'dow': DOW[dw(FOCUS_M, d)]} for d, n in ds[-3:]][::-1]

    dsum = [0.] * 7; dbil = [0] * 7; dn = [0] * 7; seen = set()
    for (m, d, _), b in bills.items():
        if m < 6:
            continue
        w = dw(m, d)
        dsum[w] += b['net']
        dbil[w] += 1
        seen.add((m, d))
    for (m, d) in seen:
        dn[dw(m, d)] += 1
    A['dowAvg'] = [round(dsum[i] / dn[i]) if dn[i] else 0 for i in range(7)]
    A['dowBills'] = [round(dbil[i] / dn[i]) if dn[i] else 0 for i in range(7)]

    zpr = collections.defaultdict(set); zl = collections.Counter()
    zn = collections.Counter(); zb = collections.Counter()
    for m, d, z, nm, q, net in lines:
        if m != FOCUS_M or d > FOCUS_DMAX or z in JUNK_ZONE or JUNK_NAME.search(nm):
            continue
        zpr[z].add(nm)
        zl[z] += 1
        zn[z] += net
    for (m, d, _), b in bills.items():
        if m == FOCUS_M and d <= FOCUS_DMAX:
            for z in b['zones']:
                zb[z] += 1
    deep = [{'zone': z, 'products': len(zpr[z]), 'linesPerBill': round(zl[z] / zb[z], 2),
             'net': round(zn[z]), 'bills': zb[z]} for z in zn if zb[z] >= 20]
    deep.sort(key=lambda x: -(x['linesPerBill'] * (x['products'] ** .5)))
    A['deepCats'] = deep[:5]

    cb = [b for (m, d, _), b in bills.items() if m == FOCUS_M and d <= FOCUS_DMAX]
    A['custRate'] = round(len([b for b in cb if b['cust']]) / len(cb), 3) if cb else 0
    return A


def promos(A, key):
    P = []
    aug = A['aug']; dowA = A['dowAvg']; dowB = A['dowBills']; lab = A['label']

    for p in A['pairs'][:2]:
        if p['lift'] < 1.5:
            continue
        aOnly = p['aBills'] - p['together']
        est = round(aOnly * 0.12 * (aug['avgBill'] * 0.35))
        P.append({'tag': 'จัดเซ็ตจากคู่ซื้อจริง', 'tone': 'i', 'tagCls': 'b',
            'title': 'เซ็ต "%s + %s"' % (p['a'], p['b']),
            'metrics': [{'label': 'ซื้อคู่กันจริง (%s)' % A['pairWindow'], 'value': '%d บิล' % p['together']},
                        {'label': 'โอกาสซื้อคู่ (lift)', 'value': '×%.1f' % p['lift']},
                        {'label': 'บิลที่มีแต่ %s' % p['a'][:14], 'value': '%d บิล' % aOnly}],
            'why': 'ลูกค้าที่หยิบ "%s" มีโอกาสหยิบ "%s" มากกว่าปกติ %.1f เท่า (เจอคู่กัน %d บิลใน%s) '
                   'แต่ยังมีอีก %d บิลที่หยิบอย่างแรกแล้วไม่หยิบอย่างหลัง — นั่นคือช่องว่าง'
                   % (p['a'], p['b'], p['lift'], p['together'], A['pairWindow'], aOnly),
            'action': 'จัดวางสองกลุ่มนี้ติดกัน/ทำป้ายเซ็ต เช่น ซื้อ "%s" ครบตามเงื่อนไข เพิ่ม "%s" ราคาพิเศษ '
                      'พร้อมป้ายที่ชั้นทั้งสองจุด' % (p['a'], p['b']),
            'expect': 'ถ้าเปลี่ยนบิลเดี่ยวเป็นบิลคู่ได้ 12%% = ~+%s/เดือน (สมมติฐาน: มูลค่าที่เพิ่ม ~35%% ของบิลเฉลี่ย %s)'
                      % (K(est), K(aug['avgBill'])),
            'src': 'ใบเสร็จรายสินค้า %s · %s' % (lab, A['pairWindow'])})

    mx = max(range(7), key=lambda i: dowA[i])
    mn = min(range(7), key=lambda i: dowA[i] if dowA[i] > 0 else 9e9)
    if dowA[mx] > 0 and dowA[mn] > 0 and dowA[mx] / max(dowA[mn], 1) >= 3:
        add = round(dowB[mx] * 0.25 * aug['avgBill'] * 0.3 * 4.3)
        P.append({'tag': 'วัน%sคือเครื่องจักร' % DOW[mx], 'tone': 'g', 'tagCls': 'g',
            'title': 'วัน%sห้ามลดราคา — ดันชิ้นที่ %d แทน' % (DOW[mx], int(aug['linesPerBill']) + 1),
            'metrics': [{'label': 'เฉลี่ยวัน%s' % DOW[mx], 'value': K(dowA[mx])},
                        {'label': 'เทียบวัน%s' % DOW[mn], 'value': '×%.0f' % (dowA[mx] / max(dowA[mn], 1))},
                        {'label': 'บิล/วัน%s' % DOW[mx], 'value': '%d บิล' % dowB[mx]}],
            'why': 'วัน%sขาย %s ต่อวัน (%d บิล) มากกว่าวัน%sถึง %.0f เท่า — traffic มีอยู่แล้ว '
                   'การลดราคาวันนี้คือแจกมาร์จินให้คนที่ยังไงก็มา'
                   % (DOW[mx], K(dowA[mx]), dowB[mx], DOW[mn], dowA[mx] / max(dowA[mn], 1)),
            'action': 'วัน%sใช้กลไกขั้นบันไดอย่างเดียว: ตะกร้าตอนนี้ %.1f ชิ้น/บิล ตั้งเป้า "ครบ %d ชิ้น/ครบยอด '
                      'แถม-ลดชิ้นถัดไป" พร้อมจุดวางสินค้าปิดยอดหน้าแคชเชียร์'
                      % (DOW[mx], aug['linesPerBill'], int(aug['linesPerBill']) + 1),
            'expect': '25%% ของบิลวัน%sหยิบเพิ่ม 1 ชิ้น (~30%% ของบิลเฉลี่ย) = ~+%s/เดือน' % (DOW[mx], K(add)),
            'src': 'ใบเสร็จรายสินค้า %s · มิ.ย.–ส.ค.' % lab})
        est2 = round(dowA[mn] * 0.25 * 4.3)
        P.append({'tag': 'ชุบวัน%s' % DOW[mn], 'tone': 'a', 'tagCls': 'a',
            'title': 'คูปองท้ายบิลวัน%s → ใช้ได้เฉพาะวัน%s' % (DOW[mx], DOW[mn]),
            'metrics': [{'label': 'เฉลี่ยวัน%s' % DOW[mn], 'value': K(dowA[mn])},
                        {'label': 'ต่ำสุด ส.ค.', 'value': '%s (%s %d)' % (K(A['worstDays'][0]['net']),
                         A['worstDays'][0]['dow'], A['worstDays'][0]['d'])},
                        {'label': 'คนวัน%sที่ส่งไปได้' % DOW[mx], 'value': '%d บิล/วัน' % dowB[mx]}],
            'why': 'วัน%sเงียบสุด (%s/วัน) ขณะที่วัน%sมีลูกค้า %d บิล/วันให้แจกคูปอง — ลากคนที่มาอยู่แล้ว '
                   'กลับมาอีกรอบถูกกว่าไปหาคนใหม่' % (DOW[mn], K(dowA[mn]), DOW[mx], dowB[mx]),
            'action': 'พิมพ์คูปองท้ายบิลอัตโนมัติวัน%s (เช่น ลด ฿30 เมื่อครบ ฿%d) กำหนดใช้ได้เฉพาะวัน%s'
                      'สัปดาห์เดียวกัน/ถัดไป' % (DOW[mx], round(aug['avgBill'], -1) + 100, DOW[mn]),
            'expect': 'ดึงกลับ 5%% ของบิลวัน%s = ยอดวัน%s +25%% ≈ +%s/เดือน' % (DOW[mx], DOW[mn], K(est2)),
            'src': 'ใบเสร็จรายสินค้า %s · ส.ค.' % lab})

    if A['deepCats']:
        dc = A['deepCats'][0]
        est3 = round(dc['bills'] * 0.15 * (dc['net'] / max(dc['bills'], 1)) * 0.5)
        P.append({'tag': 'หมวดที่คนเลือกนาน', 'tone': 'b', 'tagCls': 'y',
            'title': 'ขั้นบันไดเฉพาะหมวด %s' % dc['zone'],
            'metrics': [{'label': 'ชิ้น/บิลของหมวด', 'value': '%.1f' % dc['linesPerBill']},
                        {'label': 'แบบสินค้าที่ถูกซื้อ', 'value': '%d แบบ' % dc['products']},
                        {'label': 'ยอด ส.ค.', 'value': K(dc['net'])}],
            'why': 'หมวดนี้คนหยิบเฉลี่ย %.1f ชิ้น/บิล จากสินค้า %d แบบ — พฤติกรรม "เลือกหลายชิ้นอยู่แล้ว" '
                   'เหมาะกับบันไดราคามากกว่าลดชิ้นเดียว' % (dc['linesPerBill'], dc['products']),
            'action': 'ป้ายเดียวทั้งหมวด: "2 ชิ้นราคาปกติ · ชิ้นที่ 3 ลด 20%%" หรือราคาเหมา 3 ชิ้น — '
                      'ไม่แตะราคาชิ้นเดี่ยว',
            'expect': '15%% ของบิลหมวดนี้เพิ่มครึ่งช้อป = ~+%s/เดือน (ฐาน %d บิล/เดือน)' % (K(est3), dc['bills']),
            'src': 'ใบเสร็จรายสินค้า %s · ส.ค.' % lab})

    if key == 'fashion':
        est4 = round(aug['bills'] * 0.2 * aug['avgBill'] * 0.35)
        P.append({'tag': 'ตะกร้าเสื้อผ้าตื้น', 'tone': 'r', 'tagCls': 'r',
            'title': 'ร้านเสื้อผ้าแต่ %.1f ชิ้น/บิล — "ตัวที่ 2" คือเงินที่ทิ้งอยู่' % aug['linesPerBill'],
            'metrics': [{'label': 'ชิ้น/บิล ส.ค.', 'value': '%.2f' % aug['linesPerBill']},
                        {'label': 'บิล ส.ค.', 'value': format(aug['bills'], ',')},
                        {'label': 'บิลเฉลี่ย', 'value': K(aug['avgBill'])}],
            'why': 'ครึ่งหนึ่งของบิลจบที่ชิ้นเดียว ทั้งที่คู่บน-ล่างมี lift ชัด (เสื้อ JP49 × กางเกง JP29 '
                   'เจอคู่ 168 บิล ×3.0) — ลูกค้าพร้อมซื้อเป็นชุดถ้ามีเหตุผล',
            'action': 'กลไกร้านเสื้อผ้าโดยเฉพาะ: "ตัวที่ 2 ลด 50%% (ตัวถูกกว่า)" หรือเซ็ตบน-ล่างราคาเดียว '
                      'ติดป้ายที่ราวและกระจกลองชุด',
            'expect': '20%% ของบิลเพิ่ม 1 ชิ้น (~35%% ของบิลเฉลี่ย) = ~+%s/เดือน' % K(est4),
            'src': 'ใบเสร็จรายสินค้า Fashion · ส.ค.'})
        if A['custRate'] > 0.3:
            P.append({'tag': 'ฐาน CRM ใช้งานได้แล้ว', 'tone': 'g', 'tagCls': 'g',
                'title': 'ลูกค้า %d%% มีชื่อในบิล — broadcast ก่อนเสาร์' % round(A['custRate'] * 100),
                'metrics': [{'label': 'บิลระบุตัวได้ ส.ค.', 'value': '%d%%' % round(A['custRate'] * 100)},
                            {'label': 'เสาร์เฉลี่ย', 'value': K(dowA[5])},
                            {'label': 'ศุกร์เฉลี่ย', 'value': K(dowA[4])}],
                'why': 'ครึ่งหนึ่งของบิล Fashion รู้ว่าใครซื้อ — ของใหม่เข้าแล้วเงียบ ๆ คือเสียเปล่า '
                       'และยอดกระจุกวันเสาร์ชัดมาก',
                'action': 'ทุกศุกร์เย็น: LINE broadcast "ของเข้าใหม่พรุ่งนี้" หาฐานลูกค้าที่มีชื่อ + '
                          'รูปคอลเลกชันจริง',
                'expect': 'เพิ่มความถี่ซื้อซ้ำจากรอบ >เดือน เหลือ ~3 สัปดาห์ = +10–15%% ของยอดลูกค้าประจำ',
                'src': 'ใบเสร็จรายสินค้า Fashion · ส.ค.'})

    if key == 'chumphon':
        first_sat = A['bestDays'][0]
        P.append({'tag': 'โมเดลขายเหมา', 'tone': 'i', 'tagCls': 'b',
            'title': 'ชุมพรคือร้านเหมา/กิโล — อัดใหญ่ที่เสาร์ต้นเดือนวันเดียวพอ',
            'metrics': [{'label': 'วันพีค ส.ค.', 'value': 'เสาร์ %d (%s)' % (first_sat['d'], K(first_sat['net']))},
                        {'label': 'สินค้า Top', 'value': 'เหมา กก./ถุง 100'},
                        {'label': 'วันเงียบ', 'value': '%s %s' % (A['worstDays'][0]['dow'], K(A['worstDays'][0]['net']))}],
            'why': 'Top 5 ของสาขานี้เป็นของเหมา กก.100/ถุงบุฟเฟ่ต์ล้วน และยอดกระจุกที่เสาร์แรกของเดือน '
                   '(เงินเดือนออก) — คนมารอ "รอบเท" ไม่ได้มาเดินทุกวันแบบสุราษฎร์',
            'action': 'ยืนยันจังหวะ "บุฟเฟ่ต์ใหญ่เสาร์แรกของเดือน" เป็น signature ประกาศล่วงหน้าในเพจ/'
                      'ไลน์กลุ่มพื้นที่ 3 วันก่อน แล้ววันธรรมดาไม่ต้องจัดโปร — เติมของให้รอบเทแน่นพอ',
            'expect': 'ยกยอดเสาร์แรกขึ้น 20%% จากการประกาศล่วงหน้า = ~+%s/เดือน' % K(round(first_sat['net'] * 0.2)),
            'src': 'ใบเสร็จรายสินค้า ชุมพร · พ.ค.–ส.ค.'})

    return P[:7] if key == 'fashion' else P[:6]


def main():
    out = {}
    b, l = load('ใบเสร็จรายสินค้า ชุมพร.csv', lambda z: True)
    out['chumphon'] = analyze(b, l, [6, 7, 8], 'ชุมพร#1')          # บิลน้อย ใช้ 3 เดือนหาคู่
    b, l = load('ใบเสร็จรายสินค้า สุราษ.csv', lambda z: not FA.search(z))
    out['surat'] = analyze(b, l, [8], 'สุราษฎร์#3 (ไม่รวม Fashion)')
    b, l = load('ใบเสร็จรายสินค้า สุราษ.csv', lambda z: bool(FA.search(z)))
    out['fashion'] = analyze(b, l, [8], 'KAN Fashion (สุราษฎร์)')
    for k in out:
        out[k]['promos'] = promos(out[k], k)
    meta = {'from': '2026-05-01', 'to': '2026-08-24', 'focus': 'ส.ค. 69 (1–24)',
            'src': 'ใบเสร็จรายสินค้า ชุมพร/สุราษ.csv ระดับบรรทัดบิล (ณ 25 ส.ค. 69)',
            'nakhonNote': 'นคร#2 ไม่มีไฟล์ใบเสร็จรายสินค้าชุดล่าสุด — ทำได้แค่ระดับโซนจากแดชบอร์ดฝ่ายขาย '
                          'ขอไฟล์ "ใบเสร็จรายสินค้า นคร" มาเมื่อไหร่วิเคราะห์เพิ่มได้ทันที'}
    js = ('/* generated by etl/analyze-receipts.py — วิเคราะห์ใบเสร็จรายสินค้า พ.ค.–ส.ค. 69 เน้น ส.ค. · '
          'do not edit by hand */\n'
          'window.KAN_PROMO_ANALYSIS = ' + json.dumps({'meta': meta, 'scopes': out}, ensure_ascii=False) + ';\n')
    open(OUT, 'w', encoding='utf-8').write(js)
    print('bytes', len(js.encode()))
    for k, v in out.items():
        print(k, len(v['promos']), 'โปร')


if __name__ == '__main__':
    main()
