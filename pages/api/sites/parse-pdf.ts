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
  const tmpPy  = path.join(tmpDir, `parse_${Date.now()}.py`);

  try {
    fs.writeFileSync(tmpPdf, Buffer.from(fileData, 'base64'));
    fs.writeFileSync(tmpPy, PYTHON_PARSER);
    const proc = spawnSync('python3', [tmpPy, tmpPdf], { encoding: 'utf-8', timeout: 45000 });
    if (proc.error || proc.status !== 0) {
      console.error('PDF parse stderr:', proc.stderr?.slice(0, 500));
      return res.status(422).json({ error: { message: '파싱 실패: 조달청 분할납품요구서 형식인지 확인해주세요.' } });
    }
    const parsed = JSON.parse(proc.stdout.trim());
    return res.status(200).json({ data: parsed });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Parse failed' } });
  } finally {
    try { fs.unlinkSync(tmpPdf); } catch {}
    try { fs.unlinkSync(tmpPy); } catch {}
  }
}

const PYTHON_PARSER = `
import sys, json, re, subprocess, unicodedata

def ensure_deps():
    for pkg in ['pdfplumber']:
        try:
            __import__(pkg)
        except ImportError:
            subprocess.run([sys.executable, '-m', 'pip', 'install', pkg,
                            '--break-system-packages', '-q'], capture_output=True)

ensure_deps()
import pdfplumber

def normalize(s):
    if not s: return ''
    s = unicodedata.normalize('NFKC', str(s))
    s = s.replace('\\u3000',' ').replace('\\r',' ').replace('\\n',' ')
    return re.sub(r'\\s+',' ',s).strip()

def clean_num(s):
    if not s: return None
    s = re.sub(r'[^\\d.]','', normalize(str(s)))
    return s or None

def parse_date(s):
    if not s: return None
    nums = re.findall(r'\\d+', str(s))
    if len(nums) >= 3 and len(nums[0]) == 4:
        return f'{nums[0]}-{nums[1].zfill(2)}-{nums[2].zfill(2)}'
    return None

def extract_all(pdf):
    """모든 페이지 텍스트와 테이블 추출 (여러 설정 시도)"""
    pages_text = []
    tables_all = []
    for page in pdf.pages:
        # 3가지 설정으로 텍스트 추출 시도
        best = ''
        for settings in [
            {'x_tolerance': 3, 'y_tolerance': 3},
            {'x_tolerance': 5, 'y_tolerance': 5},
            {'x_tolerance': 8, 'y_tolerance': 8},
        ]:
            t = page.extract_text(**settings) or ''
            if len(t.strip()) > len(best.strip()):
                best = t
        pages_text.append(normalize(best))

        # 테이블도 여러 설정
        for tbl_settings in [
            {'vertical_strategy':'lines','horizontal_strategy':'lines','snap_tolerance':4,'join_tolerance':4},
            {'vertical_strategy':'lines','horizontal_strategy':'lines','snap_tolerance':8,'join_tolerance':8},
            {'vertical_strategy':'text','horizontal_strategy':'text','snap_tolerance':3},
        ]:
            tbls = page.extract_tables(tbl_settings) or []
            if tbls:
                tables_all.extend(tbls)
                break

    full_text = ' '.join(pages_text)
    return full_text, tables_all, pages_text

def search(text, pattern, flags=re.IGNORECASE):
    return re.search(pattern, text, flags)

def parse(pdf_path):
    result = {}
    with pdfplumber.open(pdf_path) as pdf:
        text, tables, pages = extract_all(pdf)

    def s(p, flags=re.IGNORECASE): return search(text, p, flags)

    # ────────────────────────────────────────────
    # 납품요구번호
    # ────────────────────────────────────────────
    for pat in [
        r'납\\s*품\\s*요\\s*구\\s*번\\s*호\\s*[:\\uff1a]?\\s*([A-Z][A-Z0-9\\-]{6,25})',
        r'([A-Z]\\d{2}[A-Z]{2}\\d{7,}(?:-\\d+)?)',
        r'(R\\d{2}[A-Z]{2}\\d{8,}(?:-\\d+)?)',
    ]:
        m = s(pat)
        if m:
            result['contractNo'] = m.group(1).strip()
            break

    # ────────────────────────────────────────────
    # 납품요구일자
    # ────────────────────────────────────────────
    for pat in [
        r'납\\s*품\\s*요\\s*구\\s*일\\s*자\\s*[:\\uff1a]?\\s*(\\d{4}[./-년]\\s*\\d{1,2}[./-월]\\s*\\d{1,2})',
        r'납품요구일\\s*[:\\uff1a]?\\s*(\\d{4}[./-]\\d{1,2}[./-]\\d{1,2})',
    ]:
        m = s(pat)
        if m:
            d = parse_date(m.group(1))
            if d: result['contractDate'] = d
            break

    # ────────────────────────────────────────────
    # 계약번호
    # ────────────────────────────────────────────
    m = s(r'계\\s*약\\s*번\\s*호\\s*제?\\s*([0-9]{6,}(?:-[0-9]+)*)\\s*호')
    if not m:
        m = s(r'계\\s*약\\s*번\\s*호\\s*[:\\uff1a]?\\s*([0-9\\-]{8,})')
    if m:
        result['procurementNo'] = m.group(1).strip()

    # ────────────────────────────────────────────
    # 수요기관
    # ────────────────────────────────────────────
    for pat in [
        r'수\\s*요\\s*기\\s*관\\s*[:\\uff1a]\\s*([가-힣][가-힣\\s]{1,20}?)(?=\\s+[가-힣]{2,}|\\s*\\d|납품|계약)',
        r'수요기관\\s+([가-힣]+(?:시|군|구|청|원|원|청|도|면|읍|동))',
    ]:
        m = s(pat)
        if m:
            v = re.sub(r'\\s+','',m.group(1)).strip()
            if 2 <= len(v) <= 20:
                result['clientName'] = v
                break

    # ────────────────────────────────────────────
    # 사업명 (제목) - 가장 중요, 다양한 패턴 시도
    # ────────────────────────────────────────────
    site_name_candidates = []

    # 패턴1: 사업명 레이블 직후
    m = s(r'사\\s*업\\s*명\\s*[:\\uff1a]?\\s*(.{5,120}?)(?=\\s*납품\\s*요\\s*구|\\s*계약\\s*번호|\\s*수요기관|\\n|$)')
    if m:
        v = normalize(m.group(1))
        v = re.sub(r'[\\[\\]\\{\\}]+','',v).strip()
        if 5 < len(v) < 120:
            site_name_candidates.append((3, v))

    # 패턴2: 첫 페이지에서 공사/사업/설치/공급 포함 긴 문장
    for page_text in pages[:2]:
        for pat in [
            r'([가-힣A-Za-z0-9\\s]+(?:공사|사업|설치|납품|공급|리모델링|그린|어린이집|학교|관사)[가-힣A-Za-z0-9\\s()（）]{3,80})',
        ]:
            for m in re.finditer(pat, page_text, re.IGNORECASE):
                v = normalize(m.group(1)).strip()
                if 8 < len(v) < 120 and v not in ['납품설치도','납품하차도']:
                    site_name_candidates.append((1, v))

    # 패턴3: 물품 목록 테이블 "품명" 컬럼 바로 위 또는 상단 헤더
    for page_text in pages[:1]:
        # 제목행 패턴
        m = re.search(r'^(.{10,80}(?:공사|사업|납품|설치))\\s*$', page_text, re.MULTILINE)
        if m:
            site_name_candidates.append((2, normalize(m.group(1))))

    if site_name_candidates:
        site_name_candidates.sort(key=lambda x: (-x[0], -len(x[1])))
        result['name'] = site_name_candidates[0][1][:120]

    # ────────────────────────────────────────────
    # 품명 (물품명)
    # ────────────────────────────────────────────
    product_candidates = []

    for pat in [
        r'물\\s*품\\s*명\\s*[:\\uff1a]?\\s*([가-힣A-Za-z][가-힣A-Za-z0-9\\s\\-+]{2,60}?)(?=\\s*규격|\\s*수량|\\s*단가|\\n)',
        r'품\\s*명\\s*[:\\uff1a]?\\s*([가-힣A-Za-z][가-힣A-Za-z0-9\\s\\-+]{2,60}?)(?=\\s*규격|\\s*수량|\\n)',
        r'([알루미늄복합패널칼라강판샌드위치EPS](?:[가-힣A-Za-z0-9\\s\\-+]{2,50}))',
    ]:
        m = s(pat)
        if m:
            v = normalize(m.group(1)).strip()
            if 2 < len(v) < 80:
                product_candidates.append(v)
                break

    if product_candidates:
        result['productName'] = product_candidates[0]

    # ────────────────────────────────────────────
    # 규격/사양
    # ────────────────────────────────────────────
    spec_candidates = []

    for pat in [
        r'규\\s*격\\s*[:\\uff1a]?\\s*([A-Za-z가-힣0-9][A-Za-z가-힣0-9\\s\\-\\.×xTtmm²㎡,\\/+]{3,100}?)(?=\\s*수량|\\s*단가|\\s*납품|\\n)',
        r'(AL\\s*\\d+T[가-힣A-Za-z0-9\\s\\-,\\.×]{0,50})',
        r'(\\d+mm\\s*[tT][가-힣A-Za-z0-9\\s\\-,\\.]{0,30})',
        r'(스테인레스\\s*\\d+[가-힣A-Za-z0-9\\s\\-,\\.]{0,30})',
    ]:
        m = s(pat)
        if m:
            v = normalize(m.group(1)).strip()
            if 3 < len(v) < 150:
                spec_candidates.append(v)
                break

    if spec_candidates:
        result['specification'] = spec_candidates[0]

    # ────────────────────────────────────────────
    # 하자담보책임기간
    # ────────────────────────────────────────────
    m = s(r'하\\s*자\\s*담\\s*보\\s*(?:책임)?\\s*기\\s*간\\s*[:\\uff1a]?\\s*(\\d+)\\s*년')
    result['warrantyPeriod'] = int(m.group(1)) if m else 2

    # ────────────────────────────────────────────
    # 계약금액 (여러 패턴)
    # ────────────────────────────────────────────
    for pat in [
        r'품\\s*대\\s*계\\s*[:\\uff1a]?\\s*(\\d{1,3}(?:,\\d{3})+)',
        r'합\\s*계\\s*(\\d{1,3}(?:,\\d{3})+)\\s*원',
        r'총\\s*금\\s*액\\s*[:\\uff1a]?\\s*(\\d{1,3}(?:,\\d{3})+)',
        r'계약\\s*금액\\s*[:\\uff1a]?\\s*(\\d{1,3}(?:,\\d{3})+)',
        r'(\\d{1,3}(?:,\\d{3})+)\\s*원\\s*(?=부가|VAT|세)',
    ]:
        m = s(pat)
        if m:
            v = int(m.group(1).replace(',',''))
            if v > 100000:  # 최소 10만원 이상
                result['contractAmount'] = v
                break

    # ────────────────────────────────────────────
    # 검사기관
    # ────────────────────────────────────────────
    m = s(r'\\d{1,3}(?:,\\d{3})+\\s+\\d{1,3}(?:,\\d{3})+\\s+\\d{1,3}(?:,\\d{3})+\\s+가능\\s+([\\S]+)\\s+([\\S]+)')
    if m:
        result['inspectionAgency'] = m.group(1)
        result['acceptanceAgency'] = m.group(2)
    else:
        m = s(r'검\\s*사\\s*기\\s*관\\s*[:\\uff1a]?\\s*([가-힣조달청수요전문기관자체]{2,20})')
        if m: result['inspectionAgency'] = normalize(m.group(1))

    if result.get('inspectionAgency'):
        ag = result['inspectionAgency']
        if '조달청' in ag: result['inspectionAgencyType'] = '조달청'
        elif any(k in ag for k in ['시','군','구','청','수요','자체']): result['inspectionAgencyType'] = '수요기관 자체'
        else:
            result['inspectionAgencyType'] = '전문검사기관'
            result['inspectionBody'] = ag

    # ────────────────────────────────────────────
    # 테이블 파싱: 단가/수량/납기/인도조건/품명/규격
    # ────────────────────────────────────────────
    COL_KEYS = {
        'unit_price': ['단 가','단가','UNIT PRICE'],
        'quantity': ['수 량','수량','QTY','물량'],
        'deadline': ['납품기한','납기','납품일','기한'],
        'delivery_cond': ['인도조건','인도 조건','납품조건'],
        'spec': ['규격','규 격','사양','SPEC'],
        'product_name': ['품명','물품명','품 명','물 품 명'],
    }

    def find_col(header_row, key_variants):
        for ci, cell in enumerate(header_row):
            cs = normalize(str(cell)) if cell else ''
            if any(k in cs for k in key_variants):
                return ci
        return None

    for table in tables:
        if not table or len(table) < 2: continue
        row_str_all = ' '.join([normalize(str(c)) for row in table[:6] for c in (row or []) if c])
        if not any(k in row_str_all for k in ['단가','수량','납품기한','품명','물품명']): continue

        # 헤더 행 찾기
        header_idx = -1
        col_map = {}
        for ri, row in enumerate(table[:6]):
            if not row: continue
            row_str = ' '.join([normalize(str(c)) for c in row if c])
            if any(k in row_str for k in ['단 가','단가','수 량','수량','납품기한']):
                header_idx = ri
                for key, variants in COL_KEYS.items():
                    ci = find_col(row, variants)
                    if ci is not None: col_map[key] = ci
                break

        if header_idx < 0: continue

        for row in table[header_idx + 1:]:
            if not row or not any(row): continue
            c = [normalize(str(x)) if x else '' for x in row]

            is_data_row = (c[0] and re.match(r'^\\d+$', c[0].strip())) if c else False

            if is_data_row or (not c[0] and len(c) > 3 and any(c[1:])):

                # 품명
                if 'product_name' in col_map and not result.get('productName'):
                    pn = c[col_map['product_name']] if col_map['product_name'] < len(c) else ''
                    if pn and len(pn) > 2:
                        result['productName'] = pn[:80]

                # 규격
                if 'spec' in col_map and not result.get('specification'):
                    sp = c[col_map['spec']] if col_map['spec'] < len(c) else ''
                    if sp and len(sp) > 3:
                        result['specification'] = sp[:200]

                if is_data_row:
                    # 단가
                    if 'unit_price' in col_map:
                        n = clean_num(c[col_map['unit_price']] if col_map['unit_price'] < len(c) else '')
                        if n:
                            try: result['unitPrice'] = int(float(n))
                            except: pass
                    elif len(c) > 6:
                        n = clean_num(c[6])
                        if n:
                            try: result['unitPrice'] = int(float(n))
                            except: pass

                    # 수량
                    if 'quantity' in col_map:
                        n = clean_num(c[col_map['quantity']] if col_map['quantity'] < len(c) else '')
                        if n:
                            try: result['contractQuantity'] = float(n)
                            except: pass
                    elif len(c) > 7:
                        n = clean_num(c[7])
                        if n:
                            try: result['contractQuantity'] = float(n)
                            except: pass

                    # 납품기한
                    if 'deadline' in col_map:
                        dl = c[col_map['deadline']] if col_map['deadline'] < len(c) else ''
                    elif len(c) > 8: dl = c[8]
                    else: dl = ''
                    if dl:
                        d = parse_date(dl)
                        if d: result['deliveryDeadline'] = d

                    # 인도조건
                    cond = c[col_map['delivery_cond']] if 'delivery_cond' in col_map and col_map['delivery_cond'] < len(c) else ' '.join(c)
                    if '설치도' in cond: result['siteType'] = '납품설치도'
                    elif '하차도' in cond: result['siteType'] = '납품하차도'

                # 규격 (순번 없는 행)
                elif not c[0] and not result.get('specification'):
                    for ci_val in c[2:6]:
                        if ci_val and len(ci_val) > 5 and any(ch in ci_val for ch in ['T','mm','AL','m²','㎡','t']):
                            result['specification'] = ci_val[:200]
                            break

    result.setdefault('siteType', '납품설치도')

    # ────────────────────────────────────────────
    # 실수요부서 담당자
    # ────────────────────────────────────────────
    m = re.search(
        r'실수요부서\\s*담당자[,，\\s]*전화번호\\s*[:\\uff1a]?\\s*([^\\d]+?)\\s*(0\\d{1,2}[-\\s]?\\d{3,4}[-\\s]?\\d{4})',
        text
    )
    if m:
        raw = m.group(1).strip()
        result['clientManagerPhone'] = re.sub(r'\\s','', m.group(2).strip())
        nm = re.search(r'^(.+?(?:과|팀|부|실|센터|원|처))\\s*([가-힣]{2,5})$', raw)
        if nm:
            result['clientDept'] = nm.group(1).strip()
            result['clientManager'] = nm.group(2).strip()
        else:
            result['clientManager'] = raw.strip()

    # ────────────────────────────────────────────
    # 품명으로 사업명 보완 (사업명 못 찾은 경우)
    # ────────────────────────────────────────────
    if not result.get('name') and result.get('clientName'):
        # 클라이언트명 + 품명으로 사업명 추정
        parts = [result['clientName']]
        if result.get('productName'): parts.append(result['productName'])
        parts.append('납품')
        result['name'] = ' '.join(parts)

    return result

if __name__ == '__main__':
    r = parse(sys.argv[1])
    print(json.dumps(r, ensure_ascii=False))
`;
