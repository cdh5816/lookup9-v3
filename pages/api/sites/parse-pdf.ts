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
      console.error('PDF parse error:', proc.stderr?.slice(0, 300));
      return res.status(422).json({ error: { message: '파싱 실패: 조달청 분할납품요구서 형식인지 확인해주세요.' } });
    }
    return res.status(200).json({ data: JSON.parse(proc.stdout.trim()) });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Parse failed' } });
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
    """유니코드 정규화 + 공백 정리"""
    if not s: return ''
    s = unicodedata.normalize('NFKC', str(s))
    return re.sub(r'[\\s\\u3000]+', ' ', s).strip()

def num(s):
    """숫자 추출"""
    if not s: return None
    v = re.sub(r'[^\\d.]', '', N(str(s)))
    return v if v else None

def parse_date(s):
    """날짜 파싱 → YYYY-MM-DD"""
    if not s: return None
    ns = [x for x in re.findall(r'\\d+', str(s)) if len(x) >= 2]
    if len(ns) >= 3 and len(ns[0]) == 4:
        return f'{ns[0]}-{ns[1].zfill(2)}-{ns[2].zfill(2)}'
    return None

def get_texts(pdf):
    """페이지별 텍스트 추출 (여러 tolerance 시도)"""
    results = []
    for page in pdf.pages:
        best = ''
        for xt, yt in [(2,2),(4,4),(6,6),(3,5),(8,8)]:
            t = page.extract_text(x_tolerance=xt, y_tolerance=yt) or ''
            if len(t) > len(best): best = t
        results.append(N(best))
    return results

def get_tables(pdf):
    """테이블 추출"""
    tbls = []
    for page in pdf.pages:
        for cfg in [
            {'vertical_strategy':'lines','horizontal_strategy':'lines','snap_tolerance':4,'join_tolerance':4},
            {'vertical_strategy':'lines','horizontal_strategy':'lines','snap_tolerance':8,'join_tolerance':8},
            {'vertical_strategy':'explicit','horizontal_strategy':'explicit','explicit_vertical_lines':page.curves+page.rects,'explicit_horizontal_lines':page.curves+page.rects},
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

def parse(pdf_path):
    result = {}
    with pdfplumber.open(pdf_path) as pdf:
        texts = get_texts(pdf)
        tables = get_tables(pdf)

    full = ' '.join(texts)
    page1 = texts[0] if texts else ''
    page2 = texts[1] if len(texts) > 1 else ''

    def S(pat, flags=re.IGNORECASE|re.DOTALL): return re.search(pat, full, flags)
    def SA(pat, flags=re.IGNORECASE): return re.search(pat, full, flags)

    # ── 납품요구번호 ─────────────────────────────────────────
    for pat in [
        r'납\\s*품\\s*요\\s*구\\s*번\\s*호\\s*[:\\uff1a]?\\s*([A-Z][A-Z0-9\\-]{6,28})',
        r'(R\\d{2}[A-Z]{2}\\d{7,14}(?:-\\d{1,3})?)',
        r'([A-Z]\\d{2}[A-Z]{2}\\d{8,}(?:-\\d+)?)',
    ]:
        m = SA(pat)
        if m: result['contractNo'] = m.group(1).strip(); break

    # ── 납품요구일자 ─────────────────────────────────────────
    for pat in [
        r'납\\s*품\\s*요\\s*구\\s*일\\s*자\\s*[:\\uff1a]?\\s*(\\d{4}[./-년]\\s*\\d{1,2}[./-월]\\s*\\d{1,2})',
        r'요\\s*구\\s*일\\s*자\\s*[:\\uff1a]?\\s*(\\d{4}[./-]\\d{1,2}[./-]\\d{1,2})',
    ]:
        m = SA(pat)
        if m: d = parse_date(m.group(1)); result['contractDate'] = d if d else None; break

    # ── 계약번호 ─────────────────────────────────────────────
    for pat in [
        r'계\\s*약\\s*번\\s*호\\s*제?\\s*([0-9]{6,}(?:-[0-9]+)*)\\s*호',
        r'계약번호\\s*[:\\uff1a]?\\s*([0-9\\-]{8,30})',
    ]:
        m = SA(pat)
        if m: result['procurementNo'] = m.group(1).strip(); break

    # ── 수요기관 ─────────────────────────────────────────────
    for pat in [
        r'수\\s*요\\s*기\\s*관\\s*[:\\uff1a]\\s*([가-힣]{2,20}?)(?=\\s|납품|계약|사업|\\d)',
        r'수요기관\\s+([가-힣]+(?:시|군|구|청|원|도|처|부|서))',
        r'기\\s*관\\s*명\\s*[:\\uff1a]?\\s*([가-힣]{2,20})',
    ]:
        m = SA(pat)
        if m:
            v = re.sub(r'\\s+','',m.group(1))
            if 2 <= len(v) <= 25: result['clientName'] = v; break

    # ── 사업명 (제목) - 최우선 파싱 항목 ────────────────────
    name_candidates = []

    # 패턴1: 사업명 레이블
    for pat in [
        r'사\\s*업\\s*명\\s*[:\\uff1a]?\\s*(.{5,120}?)(?=\\s*(?:납품요구|계약번호|수요기관|기관명|\\d{4}[./-]))',
        r'사\\s*업\\s*명\\s*[:\\uff1a]?\\s*(.{5,120}?)(?=\\n)',
    ]:
        m = re.search(pat, full, re.IGNORECASE)
        if m:
            v = N(m.group(1)).strip()
            v = re.sub(r'[\\[\\]\\{\\}（）()]+', '', v).strip()
            if 5 < len(v) < 120: name_candidates.append((4, v)); break

    # 패턴2: 페이지1,2에서 공사/납품/설치/공급 포함 문장
    for pt in [page1, page2]:
        for pat in [
            r'([가-힣A-Za-z0-9()（）\\s]+(?:공사|납품|구매|설치|구축|사업|리모델링|공급)[가-힣A-Za-z0-9()（）\\s]{2,80})',
        ]:
            for m in re.finditer(pat, pt, re.IGNORECASE):
                v = N(m.group(1)).strip()
                # 불필요한 패턴 제거
                if any(x in v for x in ['납품요구번호','계약번호','수요기관','납품기한','단가','수량']): continue
                if 8 < len(v) < 120: name_candidates.append((2, v))

    # 패턴3: 물품 목록 테이블 상단에서 긴 설명
    for table in tables[:3]:
        if not table: continue
        for row in table[:5]:
            if not row: continue
            for cell in row:
                v = N(str(cell)) if cell else ''
                if 10 < len(v) < 120 and any(k in v for k in ['공사','납품','구매','설치','사업','공급']):
                    name_candidates.append((1, v))

    if name_candidates:
        name_candidates.sort(key=lambda x: (-x[0], -len(x[1])))
        result['name'] = name_candidates[0][1][:120]

    # ── 품명 ─────────────────────────────────────────────────
    for pat in [
        r'(?:물\\s*품\\s*명|품\\s*명)\\s*[:\\uff1a]?\\s*([가-힣A-Za-z][가-힣A-Za-z0-9\\s\\-+/]{2,60}?)(?=\\s*(?:규격|수량|단가|\\n))',
        r'(알루미늄\\s*복합\\s*패널[가-힣A-Za-z0-9\\s\\-]{0,30})',
        r'(칼라\\s*강판[가-힣A-Za-z0-9\\s\\-]{0,30})',
        r'(샌드위치\\s*패널[가-힣A-Za-z0-9\\s\\-]{0,30})',
        r'(금속\\s*제\\s*패널[가-힣A-Za-z0-9\\s\\-]{0,30})',
        r'(내진\\s*패널[가-힣A-Za-z0-9\\s\\-]{0,30})',
    ]:
        m = SA(pat)
        if m:
            v = N(m.group(1)).strip()
            if 2 < len(v) < 80: result['productName'] = v; break

    # ── 규격/사양 ─────────────────────────────────────────────
    for pat in [
        r'규\\s*격\\s*[:\\uff1a]?\\s*([A-Za-z가-힣0-9][A-Za-z가-힣0-9\\s\\-\\.×xTtmm²㎡,/+]{3,100}?)(?=\\s*(?:수량|단가|납품|\\n))',
        r'(AL[-\\s]?\\d+T[가-힣A-Za-z0-9\\s\\-,×.]{0,60})',
        r'(\\d+[Tt]\\s*(?:알루미늄|AL|SUS|강판)[가-힣A-Za-z0-9\\s\\-,]{0,40})',
        r'사\\s*양\\s*[:\\uff1a]?\\s*([A-Za-z가-힣0-9][A-Za-z가-힣0-9\\s\\-\\.×,/+T]{3,80}?)(?=\\s*(?:수량|단가|납품|\\n))',
    ]:
        m = SA(pat)
        if m:
            v = N(m.group(1)).strip()
            if 3 < len(v) < 150: result['specification'] = v; break

    # ── 하자담보책임기간 ──────────────────────────────────────
    m = SA(r'하\\s*자\\s*담\\s*보\\s*(?:책임)?\\s*기\\s*간\\s*[:\\uff1a]?\\s*(\\d+)\\s*년')
    result['warrantyPeriod'] = int(m.group(1)) if m else 2

    # ── 계약금액 ─────────────────────────────────────────────
    for pat in [
        r'품\\s*대\\s*계\\s*[:\\uff1a]?\\s*(\\d{1,3}(?:,\\d{3})+)',
        r'합\\s*계\\s*(\\d{1,3}(?:,\\d{3})+)\\s*원',
        r'총\\s*(?:계약)?금\\s*액\\s*[:\\uff1a]?\\s*(\\d{1,3}(?:,\\d{3})+)',
        r'계약\\s*금\\s*액\\s*[:\\uff1a]?\\s*(\\d{1,3}(?:,\\d{3})+)',
        r'(\\d{1,3}(?:,\\d{3})+)원(?=\\s*(?:부가|VAT|\\())',
    ]:
        m = SA(pat)
        if m:
            v = int(m.group(1).replace(',',''))
            if v >= 100000: result['contractAmount'] = v; break

    # ── 검사기관 ─────────────────────────────────────────────
    m = SA(r'(\\d{1,3}(?:,\\d{3})+)\\s+(\\d{1,3}(?:,\\d{3})+)\\s+(\\d{1,3}(?:,\\d{3})+)\\s+가능\\s+([\\S]+)\\s+([\\S]+)')
    if m:
        result['inspectionAgency'] = m.group(4)
        result['acceptanceAgency'] = m.group(5)
    else:
        m = SA(r'검\\s*사\\s*기\\s*관\\s*[:\\uff1a]?\\s*([가-힣조달청수요전문기관자체\\s]{2,20}?)(?=\\s|납|계|$)')
        if m: result['inspectionAgency'] = N(m.group(1))

    if result.get('inspectionAgency'):
        ag = result['inspectionAgency']
        if '조달청' in ag: result['inspectionAgencyType'] = '조달청'
        elif any(k in ag for k in ['시청','군청','구청','수요','자체']): result['inspectionAgencyType'] = '수요기관 자체'
        else: result['inspectionAgencyType'] = '전문검사기관'; result['inspectionBody'] = ag

    # ── 테이블 파싱: 단가/수량/납기/인도조건 ────────────────
    COL_MAP = {
        'unit_price': ['단 가','단가','UNIT'],
        'quantity': ['수 량','수량','QTY','물량'],
        'deadline': ['납품기한','납기','납품일','기한'],
        'delivery': ['인도조건','납품조건','인도 조건'],
        'spec': ['규격','규 격','사양','SPEC'],
        'product': ['품명','물품명','품 명','물 품'],
    }

    for table in tables:
        if not table or len(table) < 2: continue

        # 헤더 행 탐색
        hdri = -1
        cmap = {}
        for ri, row in enumerate(table[:7]):
            if not row: continue
            rs = ' '.join(N(str(c)) for c in row if c)
            if any(k in rs for k in ['단가','수량','단 가','수 량','납품기한','품명','물품명']):
                hdri = ri
                for key, variants in COL_MAP.items():
                    ci = find_col(row, *variants)
                    if ci is not None: cmap[key] = ci
                break

        if hdri < 0: continue

        for row in table[hdri+1:]:
            if not row or not any(row): continue
            c = [N(str(x)) if x else '' for x in row]
            is_data = bool(c[0] and re.match(r'^\\d+$', c[0].strip()))

            if is_data or (not c[0] and len(c) > 2 and any(c)):
                # 품명
                if 'product' in cmap and not result.get('productName'):
                    v = c[cmap['product']] if cmap['product'] < len(c) else ''
                    if v and len(v) > 2: result['productName'] = v[:80]

                # 규격
                if 'spec' in cmap and not result.get('specification'):
                    v = c[cmap['spec']] if cmap['spec'] < len(c) else ''
                    if v and len(v) > 3: result['specification'] = v[:200]

            if is_data:
                # 단가
                for ci in ([cmap['unit_price']] if 'unit_price' in cmap else [6,5,7]):
                    if ci < len(c) and c[ci]:
                        n = num(c[ci])
                        if n:
                            try: result['unitPrice'] = int(float(n)); break
                            except: pass

                # 수량
                for ci in ([cmap['quantity']] if 'quantity' in cmap else [7,6,8]):
                    if ci < len(c) and c[ci]:
                        n = num(c[ci])
                        if n:
                            try: result['contractQuantity'] = float(n); break
                            except: pass

                # 납품기한
                dl = c[cmap['deadline']] if 'deadline' in cmap and cmap['deadline'] < len(c) else (c[8] if len(c) > 8 else '')
                if dl:
                    d = parse_date(dl)
                    if d: result['deliveryDeadline'] = d

                # 인도조건
                cond = ' '.join(c)
                if '설치도' in cond: result['siteType'] = '납품설치도'
                elif '하차도' in cond: result['siteType'] = '납품하차도'

            # 규격 (순번 없는 행)
            elif not c[0] and not result.get('specification'):
                for v in c[2:8]:
                    if v and len(v) > 5 and any(ch in v for ch in ['T','mm','AL','m²','㎡','t','SUS']):
                        result['specification'] = v[:200]; break

    result.setdefault('siteType', '납품설치도')

    # ── 실수요부서 담당자 ─────────────────────────────────────
    m = re.search(
        r'실수요부서\\s*담당자[,，\\s]*전화번호\\s*[:\\uff1a]?\\s*([^\\d]+?)\\s*(0\\d{1,2}[-\\s]?\\d{3,4}[-\\s]?\\d{4})',
        full
    )
    if m:
        raw = m.group(1).strip()
        result['clientManagerPhone'] = re.sub(r'\\s','',m.group(2).strip())
        nm = re.search(r'^(.+?(?:과|팀|부|실|센터|원|처))\\s*([가-힣]{2,5})$', raw)
        if nm: result['clientDept'] = nm.group(1).strip(); result['clientManager'] = nm.group(2).strip()
        else: result['clientManager'] = raw.strip()

    # ── 사업명 보완 ───────────────────────────────────────────
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
