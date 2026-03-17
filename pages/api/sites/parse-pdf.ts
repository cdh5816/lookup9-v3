/* eslint-disable i18next/no-literal-string */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@/lib/session';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { fileData } = req.body;
  if (!fileData) return res.status(400).json({ error: { message: 'fileData required' } });

  const tmpDir = os.tmpdir();
  const tmpPdf = path.join(tmpDir, `proc_${Date.now()}.pdf`);
  const tmpPy = path.join(tmpDir, `parse_${Date.now()}.py`);

  try {
    fs.writeFileSync(tmpPdf, Buffer.from(fileData, 'base64'));
    fs.writeFileSync(tmpPy, PYTHON_PARSER);
    const proc = spawnSync('python3', [tmpPy, tmpPdf], { encoding: 'utf-8', timeout: 60000 });
    if (proc.error || proc.status !== 0) {
      console.error('PDF scan error:', proc.stderr?.slice(0, 500));
      return res.status(422).json({ error: { message: '스캔 실패: 조달청 분할납품요구서 형식인지 확인해주세요.' } });
    }
    return res.status(200).json({ data: JSON.parse(proc.stdout.trim()) });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Scan failed' } });
  } finally {
    try { fs.unlinkSync(tmpPdf); } catch {}
    try { fs.unlinkSync(tmpPy); } catch {}
  }
}

const PYTHON_PARSER = `
import sys, json, re, subprocess, unicodedata, traceback

def install(pkg):
    subprocess.run([sys.executable, '-m', 'pip', 'install', pkg, '--break-system-packages', '-q'], capture_output=True)

try:
    import pdfplumber
except ImportError:
    install('pdfplumber')
    import pdfplumber

def N(s):
    if not s: return ''
    s = unicodedata.normalize('NFKC', str(s))
    return re.sub(r'[\\\\s\\\\u3000]+', ' ', s).strip()

def num(s):
    if not s: return None
    v = re.sub(r'[^\\\\d.]', '', N(str(s)))
    return v if v else None

def parse_date(s):
    if not s: return None
    ns = [x for x in re.findall(r'\\\\d+', str(s)) if len(x) >= 2]
    if len(ns) >= 3 and len(ns[0]) == 4:
        return f'{ns[0]}-{ns[1].zfill(2)}-{ns[2].zfill(2)}'
    return None

def get_texts(pdf):
    results = []
    for page in pdf.pages:
        best = ''
        for xt, yt in [(2,2),(4,4),(6,6),(3,5),(8,8)]:
            t = page.extract_text(x_tolerance=xt, y_tolerance=yt) or ''
            if len(t) > len(best): best = t
        results.append(N(best))
    return results

def get_tables(pdf):
    tbls = []
    for page in pdf.pages:
        for cfg in [
            {'vertical_strategy':'lines','horizontal_strategy':'lines','snap_tolerance':4,'join_tolerance':4},
            {'vertical_strategy':'lines','horizontal_strategy':'lines','snap_tolerance':8,'join_tolerance':8},
            {'vertical_strategy':'explicit','horizontal_strategy':'explicit',
             'explicit_vertical_lines':page.curves+page.rects,'explicit_horizontal_lines':page.curves+page.rects},
            {},
        ]:
            try:
                t = page.extract_tables(cfg) or []
                if t: tbls.extend(t); break
            except: pass
    return tbls

def find_col(row, *keywords):
    for ci, cell in enumerate(row or []):
        cs = N(str(cell)) if cell else ''
        if any(k in cs for k in keywords): return ci
    return None

def clean_agency(s):
    if not s: return ''
    s = N(s)
    parts = [p.strip() for p in re.split(r'[\\\\n\\\\r]', s) if p.strip()]
    result = parts[0][:50] if parts else s[:50]
    # 줄바꿈으로 합쳐진 2개 기관명 분리
    m = re.match(r'([가-힣]{3,25}(?:교육청|청|원|처|공단|자체))\\\\s+([가-힣]{3,40}(?:교육청|청|원|처|공단|자체))', result)
    return result

def parse(pdf_path):
    result = {}
    with pdfplumber.open(pdf_path) as pdf:
        texts = get_texts(pdf)
        tables = get_tables(pdf)

    full = ' '.join(texts)
    page1 = texts[0] if texts else ''
    page2 = texts[1] if len(texts) > 1 else ''

    def SA(pat, src=None, flags=re.IGNORECASE):
        return re.search(pat, src if src is not None else full, flags)

    # ── 납품요구번호 ─────────────────────────────────────────
    for pat in [
        r'납\\\\s*품\\\\s*요\\\\s*구\\\\s*번\\\\s*호\\\\s*[:\\\\uff1a]?\\\\s*([A-Z0-9][A-Z0-9\\\\-]{6,28})',
        r'(R\\\\d{2}[A-Z]{2}\\\\d{7,14}(?:-\\\\d{1,3})?)',
        r'([A-Z]\\\\d{2}[A-Z]{2}\\\\d{8,}(?:-\\\\d+)?)',
    ]:
        m = SA(pat)
        if m: result['contractNo'] = m.group(1).strip(); break

    # ── 납품요구일자 ─────────────────────────────────────────
    for pat in [
        r'납\\\\s*품\\\\s*요\\\\s*구\\\\s*일\\\\s*자\\\\s*[:\\\\uff1a]?\\\\s*(\\\\d{4}[./년-]\\\\s*\\\\d{1,2}[./월-]\\\\s*\\\\d{1,2})',
        r'요\\\\s*구\\\\s*일\\\\s*자\\\\s*[:\\\\uff1a]?\\\\s*(\\\\d{4}[./-]\\\\d{1,2}[./-]\\\\d{1,2})',
    ]:
        m = SA(pat)
        if m: d = parse_date(m.group(1)); result['contractDate'] = d if d else None; break

    # ── 계약번호 ─────────────────────────────────────────────
    for pat in [
        r'계\\\\s*약\\\\s*번\\\\s*호\\\\s*제?\\\\s*([0-9]{6,}(?:-[0-9]+)*)\\\\s*호',
        r'계약번호\\\\s*[:\\\\uff1a]?\\\\s*([0-9\\\\-]{8,30})',
    ]:
        m = SA(pat)
        if m: result['procurementNo'] = m.group(1).strip(); break

    # ── 수요기관 ─────────────────────────────────────────────
    for pat in [
        r'수\\\\s*요\\\\s*기\\\\s*관\\\\s*[:\\\\uff1a]\\\\s*([가-힣]{2,30}(?:교육청|시청|군청|구청|도청|청|원|처|부|서|공단|공사|재단)?)',
        r'수\\\\s*요\\\\s*기\\\\s*관\\\\s*번\\\\s*호.*?수\\\\s*요\\\\s*기\\\\s*관\\\\s*[:\\\\uff1a]?\\\\s*([가-힣]{3,30})',
    ]:
        m = SA(pat)
        if m:
            v = re.sub(r'\\\\s+', '', m.group(1))
            if 2 <= len(v) <= 30: result['clientName'] = v; break

    # ── 사업명 (최우선: 사업명 라벨 직후) ───────────────────
    name_found = False

    # 전략1: 테이블에서 "사업명" 레이블 옆 셀
    for table in tables[:5]:
        if not table: continue
        for row in table:
            if not row: continue
            for ci, cell in enumerate(row):
                cs = N(str(cell)) if cell else ''
                if re.search(r'^사\\\\s*업\\\\s*명$', cs.strip()):
                    for nc in row[ci+1:]:
                        nv = N(str(nc)) if nc else ''
                        if nv and len(nv) > 5:
                            result['name'] = nv[:150]
                            name_found = True
                            break
                if name_found: break
            if name_found: break
        if name_found: break

    # 전략2: 텍스트에서 "사 업 명 :" 라벨 뒤
    if not name_found:
        for pat in [
            r'사\\\\s*업\\\\s*명\\\\s*[:\\\\uff1a]\\\\s*([\\\\(（]?[가-힣A-Za-z0-9()（）\\\\s\\\\-_/·,]+?)(?=\\\\s*(?:순\\\\s*번|납품요구번호|계약번호|수요기관|\\\\d{1,2}\\\\s+[가-힣]|$))',
        ]:
            m = re.search(pat, full, re.IGNORECASE | re.DOTALL)
            if m:
                v = N(m.group(1)).strip()
                v = re.sub(r'\\\\s{2,}', ' ', v).strip()
                if 5 < len(v) < 150:
                    result['name'] = v[:150]
                    name_found = True
                    break

    # 전략3: 공사/구매 포함 긴 문장
    if not name_found:
        candidates = []
        for pt in [page1, page2]:
            for pat in [
                r'([\\\\(（][가-힣]+[\\\\)）][가-힣A-Za-z0-9()（）\\\\s\\\\-]{5,100}(?:공사|구매|납품|설치|구축|사업|시설|자재))',
                r'([가-힣A-Za-z0-9()（）\\\\s]{5,80}(?:신축공사|리모델링|직접구매|자재구매|구매자재)[가-힣A-Za-z0-9()（）\\\\s\\\\(\\\\)]{0,50})',
            ]:
                for m in re.finditer(pat, pt, re.IGNORECASE):
                    v = N(m.group(1)).strip()
                    if any(x in v for x in ['납품요구번호','계약번호','수요기관','납품기한','단가','수량','조달청']): continue
                    if 8 < len(v) < 150: candidates.append(v)
        if candidates:
            result['name'] = sorted(candidates, key=len, reverse=True)[0][:150]
            name_found = True

    # ── 품명 ─────────────────────────────────────────────────
    product_items = []
    for pat in [
        r'(?:외벽패널|내벽패널|지붕패널|금속제\\\\s*패널|알루미늄\\\\s*복합\\\\s*패널|칼라\\\\s*강판|샌드위치\\\\s*패널|내진\\\\s*패널)',
    ]:
        for m in re.finditer(pat, full, re.IGNORECASE):
            v = N(m.group(0)).strip()
            if v and v not in product_items: product_items.append(v)
    if product_items:
        result['productName'] = product_items[0][:80]

    # ── 규격/사양 ─────────────────────────────────────────────
    for pat in [
        r'금속제패널[,，\\\\s]*덕인금속[,，\\\\s]*([A-Za-z가-힣0-9\\\\-./×,\\\\s]+?)(?=\\\\n|KS|$)',
        r'((?:MS|AL|SUS|ACP|EPS|PIR|PU|XPS)[-\\\\s]?[A-Za-z0-9\\\\-./×xTt\\\\s,]+(?:mm|t|T|m²|㎡|초내후성|분체|평판|코팅)[A-Za-z가-힣0-9\\\\s,./×-]{0,80})',
        r'KS\\\\s*[A-Z]\\\\s*\\\\d{4}[,，\\\\s]*([A-Za-z가-힣0-9\\\\s,./×-]{3,100})',
    ]:
        m = SA(pat)
        if m:
            v = N(m.group(1) if m.lastindex else m.group(0)).strip()
            if 3 < len(v) < 200:
                result['specification'] = v[:200]
                break

    # ── 하자담보책임기간 ──────────────────────────────────────
    m = SA(r'하\\\\s*자\\\\s*담\\\\s*보\\\\s*(?:책임)?\\\\s*기\\\\s*간\\\\s*[:\\\\uff1a비고]?\\\\s*(\\\\d+)\\\\s*년')
    result['warrantyPeriod'] = int(m.group(1)) if m else 2

    # ── 계약금액: 품대계 우선 ────────────────────────────────
    m = SA(r'품\\\\s*대\\\\s*계?\\\\s*(\\\\d{1,3}(?:,\\\\d{3})+)')
    if m:
        v = int(m.group(1).replace(',',''))
        if v >= 100000: result['contractAmount'] = v

    if not result.get('contractAmount'):
        for pat in [
            r'합\\\\s*계\\\\s*금\\\\s*액\\\\s*(\\\\d{1,3}(?:,\\\\d{3})+)',
            r'(\\\\d{1,3}(?:,\\\\d{3}){3,})(?=\\\\s*(?:원|가능|\\\\d))',
        ]:
            m = SA(pat)
            if m:
                v = int(m.group(1).replace(',',''))
                if v >= 1000000: result['contractAmount'] = v; break

    # ── 검사기관 / 검수기관 ──────────────────────────────────
    insp_found = False

    # 전략1: 테이블에서 검사/검수 열
    for table in tables:
        if not table or len(table) < 2: continue
        insp_ci = None
        accept_ci = None
        for row in table[:8]:
            if not row: continue
            for ci, cell in enumerate(row):
                cs = N(str(cell)) if cell else ''
                if re.search(r'^검\\\\s*사$', cs.strip()) and insp_ci is None: insp_ci = ci
                if re.search(r'^검\\\\s*수$', cs.strip()) and accept_ci is None: accept_ci = ci
            if insp_ci is not None or accept_ci is not None: break

        if insp_ci is not None or accept_ci is not None:
            for row in table[1:]:
                if not row: continue
                if insp_ci is not None and insp_ci < len(row) and row[insp_ci]:
                    v = N(str(row[insp_ci])).strip()
                    if v and len(v) > 2 and v not in ('검사','N','Y'):
                        result['inspectionAgency'] = v[:50]
                        insp_found = True
                if accept_ci is not None and accept_ci < len(row) and row[accept_ci]:
                    v = N(str(row[accept_ci])).strip()
                    if v and len(v) > 2 and v not in ('검수','N','Y'):
                        result['acceptanceAgency'] = v[:50]
                if insp_found: break

    # 전략2: 금액 3개 + "가능" 이후 기관명 텍스트 패턴
    if not insp_found:
        m = re.search(
            r'\\\\d{1,3}(?:,\\\\d{3})+\\\\s+\\\\d{1,3}(?:,\\\\d{3})+\\\\s+\\\\d{1,3}(?:,\\\\d{3})+'
            r'\\\\s+가\\\\s*능\\\\s+'
            r'([가-힣\\\\s]{3,50}?)\\\\s+'
            r'([가-힣\\\\s]{3,50}?)(?=\\\\n|사\\\\s*업|순\\\\s*번|$)',
            full
        )
        if m:
            v1 = N(m.group(1)).strip()
            v2 = N(m.group(2)).strip()
            if len(v1) > 2: result['inspectionAgency'] = v1[:50]; insp_found = True
            if len(v2) > 2: result['acceptanceAgency'] = v2[:50]

    # 전략3: "가능" 직후 두 기관명
    if not insp_found:
        m = re.search(
            r'가\\\\s*능\\\\s+([가-힣]{3,40}(?:교육청|시청|군청|구청|청|원|처|공단|자체)?)'
            r'\\\\s+([가-힣]{3,40}(?:교육청|시청|군청|구청|청|원|처|공단|자체)?)',
            full
        )
        if m:
            result['inspectionAgency'] = m.group(1)[:50]
            result['acceptanceAgency'] = m.group(2)[:50]
            insp_found = True

    if result.get('inspectionAgency'):
        ag = result['inspectionAgency']
        if '조달청' in ag: result['inspectionAgencyType'] = '조달청'
        elif '전문' in ag or any(k in ag for k in ['한국','KCL','KTR','시험원','연구원']):
            result['inspectionAgencyType'] = '전문검사기관'
            result['inspectionBody'] = ag
        else: result['inspectionAgencyType'] = '수요기관 자체'

    # ── 테이블: 단가/수량/납기 (다품목 지원) ────────────────
    COL_MAP = {
        'seq': ['순번','순 번'],
        'unit_price': ['단 가','단가','금 액','금액'],
        'quantity': ['수 량','수량','QTY','물량'],
        'deadline': ['납품기한','납기','납품일','기한'],
        'delivery': ['인도조건','납품조건','인도 조건'],
        'spec': ['규격','규 격','사양'],
        'product': ['품명','물품명','품 명'],
        'unit': ['단위'],
    }

    items = []

    for table in tables:
        if not table or len(table) < 2: continue
        hdri = -1
        cmap = {}
        for ri, row in enumerate(table[:8]):
            if not row: continue
            rs = ' '.join(N(str(c)) for c in row if c)
            if any(k in rs for k in ['단가','수량','단 가','수 량','납품기한','품명','물품명']):
                hdri = ri
                for key, variants in COL_MAP.items():
                    ci = find_col(row, *variants)
                    if ci is not None: cmap[key] = ci
                break

        if hdri < 0: continue

        current_item = {}
        for row in table[hdri+1:]:
            if not row or not any(row): continue
            c = [N(str(x)) if x else '' for x in row]
            seq_val = c[cmap['seq']] if 'seq' in cmap and cmap['seq'] < len(c) else c[0] if c else ''
            is_item_row = bool(seq_val and re.match(r'^\\\\d+$', seq_val.strip()))

            if is_item_row:
                if current_item: items.append(current_item)
                current_item = {'seq': seq_val.strip()}
                if 'product' in cmap and cmap['product'] < len(c) and c[cmap['product']]:
                    current_item['productName'] = c[cmap['product']][:80]
                if 'unit' in cmap and cmap['unit'] < len(c) and c[cmap['unit']]:
                    current_item['unit'] = c[cmap['unit']][:10]
                for ci in ([cmap['unit_price']] if 'unit_price' in cmap else [6,5,7,8]):
                    if ci < len(c) and c[ci]:
                        n = num(c[ci])
                        if n:
                            try: current_item['unitPrice'] = int(float(n)); break
                            except: pass
                for ci in ([cmap['quantity']] if 'quantity' in cmap else [7,6,8,5]):
                    if ci < len(c) and c[ci]:
                        n = num(c[ci])
                        if n:
                            try: current_item['contractQuantity'] = float(n); break
                            except: pass
                dl = ''
                if 'deadline' in cmap and cmap['deadline'] < len(c): dl = c[cmap['deadline']]
                if not dl:
                    for cv in c:
                        if re.search(r'\\\\d{4}[./-]\\\\d{1,2}[./-]\\\\d{1,2}', cv): dl = cv; break
                if dl:
                    d = parse_date(dl)
                    if d: current_item['deliveryDeadline'] = d
                row_text = ' '.join(c)
                if '설치도' in row_text: current_item['siteType'] = '납품설치도'
                elif '하차도' in row_text: current_item['siteType'] = '납품하차도'
            elif current_item:
                for v in c:
                    if v and len(v) > 5 and not current_item.get('specification'):
                        if any(ch in v for ch in ['T','mm','AL','SUS','KS','초내후','분체','평판','덕인','MS-']):
                            current_item['specification'] = v[:200]; break

        if current_item: items.append(current_item)

    if items:
        first = items[0]
        for k in ('unitPrice','contractQuantity','deliveryDeadline','siteType','productName','specification'):
            if first.get(k) and not result.get(k): result[k] = first[k]
        if len(items) > 1: result['productItems'] = items

    result.setdefault('siteType', '납품설치도')

    # 납품기한 보완
    if not result.get('deliveryDeadline'):
        for pat in [
            r'납\\\\s*품\\\\s*기\\\\s*한\\\\s*[:\\\\uff1a]?\\\\s*(\\\\d{4}[./-]\\\\d{1,2}[./-]\\\\d{1,2})',
            r'(\\\\d{4}/\\\\d{2}/\\\\d{2})(?=\\\\s*[NY]\\\\s)',
        ]:
            m = SA(pat)
            if m:
                d = parse_date(m.group(1))
                if d: result['deliveryDeadline'] = d; break

    # 수량 보완
    if not result.get('contractQuantity'):
        m = SA(r'수\\\\s*량\\\\s*합\\\\s*계\\\\s*[:\\\\uff1a]?\\\\s*([\\\\d,]+)')
        if m:
            n = num(m.group(1))
            if n:
                try: result['contractQuantity'] = float(n)
                except: pass

    # 실수요부서 담당자
    m = re.search(
        r'실수요부서\\\\s*담당자[,，\\\\s]*전화번호\\\\s*[:\\\\uff1a]?\\\\s*([^\\\\d]+?)\\\\s*(0\\\\d{1,2}[-\\\\s]?\\\\d{3,4}[-\\\\s]?\\\\d{4})',
        full
    )
    if m:
        raw = m.group(1).strip()
        result['clientManagerPhone'] = re.sub(r'\\\\s','',m.group(2).strip())
        nm = re.search(r'^(.+?(?:과|팀|부|실|센터|원|처))\\\\s*([가-힣]{2,5})$', raw)
        if nm: result['clientDept'] = nm.group(1).strip(); result['clientManager'] = nm.group(2).strip()
        else: result['clientManager'] = raw.strip()

    if not result.get('name'):
        parts = []
        if result.get('clientName'): parts.append(result['clientName'])
        if result.get('productName'): parts.append(result['productName'])
        if parts: result['name'] = ' '.join(parts) + ' 납품'

    return result

if __name__ == '__main__':
    try:
        r = parse(sys.argv[1])
        print(json.dumps(r, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e), 'trace': traceback.format_exc()}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
`;
