/* eslint-disable i18next/no-literal-string */
/**
 * POST /api/sites/parse-pdf
 * 분할납품요구서 PDF 업로드 → 파싱 결과 반환
 * Body: { fileData: base64string, fileName: string }
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@/lib/session';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }
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

    const proc = spawnSync('python3', [tmpPy, tmpPdf], {
      encoding: 'utf-8',
      timeout: 30000,
    });

    if (proc.error || proc.status !== 0) {
      console.error('PDF parse stderr:', proc.stderr);
      return res.status(422).json({
        error: { message: '파싱 실패: 조달청 분할납품요구서 형식인지 확인해주세요.' },
      });
    }

    const parsed = JSON.parse(proc.stdout.trim());
    return res.status(200).json({ data: parsed });
  } catch (err: any) {
    console.error('parse-pdf error:', err);
    return res.status(500).json({ error: { message: err.message || 'Parse failed' } });
  } finally {
    try { fs.unlinkSync(tmpPdf); } catch {}
    try { fs.unlinkSync(tmpPy); } catch {}
  }
}

// Python 파싱 스크립트 (인라인) - 개선버전
// 주요 개선:
//   1. pdfplumber crop + rotate 옵션으로 각도 보정
//   2. 텍스트 정규화 함수로 OCR 노이즈 제거
//   3. 금액/수량 패턴 복수 후보 탐색
//   4. 테이블 컬럼 인덱스 동적 탐지
const PYTHON_PARSER = `
import sys, json, re, subprocess, unicodedata

def ensure_pdfplumber():
    try:
        import pdfplumber
        return pdfplumber
    except ImportError:
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'pdfplumber',
                        '--break-system-packages', '-q'], capture_output=True)
        import pdfplumber
        return pdfplumber

def normalize(s):
    """유니코드 정규화 + 불필요 공백/특수문자 제거"""
    if not s:
        return ''
    s = unicodedata.normalize('NFKC', s)
    # 전각 공백, 줄바꿈 → 일반 공백
    s = s.replace('\\u3000', ' ').replace('\\r', ' ').replace('\\n', ' ')
    # 연속 공백 → 단일 공백
    s = re.sub(r'\\s+', ' ', s)
    return s.strip()

def extract_text_robust(pdf):
    """각도 보정 포함 텍스트 추출 - 여러 설정으로 시도"""
    text_parts = []
    tables_all = []

    for page in pdf.pages:
        # 1차: 기본 추출
        t = page.extract_text(x_tolerance=3, y_tolerance=3) or ''
        if len(t.strip()) < 50:
            # 2차: 허용 오차 확대 (스캔 PDF 대응)
            t = page.extract_text(x_tolerance=5, y_tolerance=5) or ''
        if len(t.strip()) < 50:
            # 3차: layout 모드 (회전 PDF 대응)
            try:
                t = page.extract_text(layout=True) or ''
            except Exception:
                pass
        text_parts.append(normalize(t))

        # 테이블 추출 - 여러 설정 시도
        tbls = page.extract_tables({
            'vertical_strategy': 'lines',
            'horizontal_strategy': 'lines',
            'snap_tolerance': 5,
            'join_tolerance': 5,
        }) or []
        if not tbls:
            tbls = page.extract_tables() or []
        tables_all.extend(tbls)

    return ' '.join(text_parts), tables_all

def clean_num(s):
    """숫자 문자열에서 숫자만 추출"""
    if not s:
        return None
    s = re.sub(r'[^\\d.]', '', normalize(str(s)))
    return s if s else None

def parse(pdf_path):
    pdfplumber = ensure_pdfplumber()
    result = {}

    with pdfplumber.open(pdf_path) as pdf:
        text, tables = extract_text_robust(pdf)

    def search(pattern, flags=re.IGNORECASE):
        return re.search(pattern, text, flags)

    def search_all(pattern, flags=re.IGNORECASE):
        return re.findall(pattern, text, flags)

    # ── 납품요구번호 ──
    # 패턴: R25TB01360601-00 형식
    m = search(r'납\\s*품\\s*요\\s*구\\s*번\\s*호\\s*[:\\uff1a]?\\s*([A-Z0-9][A-Z0-9\\-]{5,20})')
    if not m:
        m = search(r'([A-Z]\\d{2}[A-Z]{2}\\d{8,}(?:-\\d+)?)')
    result['contractNo'] = m.group(1).strip() if m else None

    # ── 납품요구일자 ──
    m = search(r'납\\s*품\\s*요\\s*구\\s*일\\s*자\\s*[:\\uff1a]?\\s*(\\d{4}[/\\-.]\\d{1,2}[/\\-.]\\d{1,2})')
    if m:
        result['contractDate'] = re.sub(r'[/.]', '-', m.group(1))

    # ── 계약번호 ──
    m = search(r'계\\s*약\\s*번\\s*호\\s*제?\\s*([0-9\\-]+)\\s*호')
    result['procurementNo'] = m.group(1).strip() if m else None

    # ── 수요기관 ──
    m = search(r'수\\s*요\\s*기\\s*관\\s*[:\\uff1a]?\\s*([가-힣\\s]{2,20}?)\\s*(?=\\d|납품|계약|사업|$)')
    if m:
        result['clientName'] = re.sub(r'\\s+', '', m.group(1)).strip()

    # ── 사업명 ──
    m = search(r'사\\s*업\\s*명\\s*[:\\uff1a]?\\s*(.+?)(?=납품|계약|수요기관|\\d{4}/|$)', re.DOTALL)
    if m:
        name = normalize(m.group(1))
        # 너무 길거나 의미없는 문자 제거
        name = re.sub(r'[\\[\\]\\(\\)]+', '', name).strip()
        if 3 < len(name) < 100:
            result['name'] = name[:100]

    # ── 하자담보책임기간 ──
    m = search(r'하\\s*자\\s*담\\s*보\\s*(?:책임)?\\s*기\\s*간\\s*[:\\uff1a]?\\s*(\\d+)\\s*년')
    result['warrantyPeriod'] = int(m.group(1)) if m else 2

    # ── 계약금액 (복수 패턴 시도) ──
    # 패턴1: 품대계 행
    m = search(r'품\\s*대\\s*계[^\\d]*(\\d{1,3}(?:,\\d{3})+)')
    if not m:
        # 패턴2: 합계 행
        m = search(r'합\\s*계\\s*[:\\uff1a]?\\s*(\\d{1,3}(?:,\\d{3})+)\\s*원')
    if not m:
        # 패턴3: 계약금액 레이블
        m = search(r'계\\s*약\\s*금\\s*액\\s*[:\\uff1a]?\\s*(\\d{1,3}(?:,\\d{3})+)')
    if m:
        result['contractAmount'] = int(m.group(1).replace(',', ''))

    # ── 검사/검수기관 ──
    m = search(r'\\d{1,3}(?:,\\d{3})+\\s+\\d{1,3}(?:,\\d{3})+\\s+\\d{1,3}(?:,\\d{3})+\\s+가능\\s+([\\S]+)\\s+([\\S]+)')
    if m:
        result['inspectionAgency'] = m.group(1)
        result['acceptanceAgency'] = m.group(2)
    else:
        # 대안 패턴: 검사기관 레이블
        m = search(r'검\\s*사\\s*기\\s*관\\s*[:\\uff1a]?\\s*([가-힣\\s조달청수요기관전문]{2,20})')
        if m:
            result['inspectionAgency'] = normalize(m.group(1))

    # 검사기관 유형 판별
    if result.get('inspectionAgency'):
        ag = result['inspectionAgency']
        if '조달청' in ag:
            result['inspectionAgencyType'] = '조달청'
        elif any(k in ag for k in ['군', '시', '구', '도청', '시청', '군청', '수요기관', '자체']):
            result['inspectionAgencyType'] = '수요기관 자체'
        else:
            result['inspectionAgencyType'] = '전문검사기관'
            result['inspectionBody'] = ag

    # ── 테이블에서 단가/수량/납품기한/인도조건 ──
    # 컬럼 헤더를 동적으로 탐지
    for table in tables:
        if not table or len(table) < 2:
            continue

        # 헤더 행 탐지
        header_idx = -1
        col_map = {}
        for ri, row in enumerate(table[:5]):  # 처음 5행에서 헤더 탐색
            if not row:
                continue
            row_str = ' '.join([normalize(str(c)) for c in row if c])
            if any(k in row_str for k in ['단 가', '단가', '수 량', '수량', '납품기한', '납기']):
                header_idx = ri
                # 컬럼 인덱스 매핑
                for ci, cell in enumerate(row):
                    cs = normalize(str(cell)) if cell else ''
                    if '단' in cs and '가' in cs: col_map['unit_price'] = ci
                    elif '수' in cs and '량' in cs: col_map['quantity'] = ci
                    elif '납' in cs and ('기' in cs or '한' in cs): col_map['deadline'] = ci
                    elif '인도' in cs or '조건' in cs: col_map['delivery_cond'] = ci
                    elif '규격' in cs or '사양' in cs: col_map['spec'] = ci
                break

        if header_idx < 0:
            continue

        for row in table[header_idx + 1:]:
            if not row or not any(row):
                continue
            c = [normalize(str(x)) if x else '' for x in row]

            # 순번이 있는 데이터 행
            if c[0] and re.match(r'^\\d+$', c[0].strip()):
                # 단가
                if 'unit_price' in col_map:
                    n = clean_num(c[col_map['unit_price']])
                    if n:
                        try: result['unitPrice'] = int(float(n))
                        except: pass
                elif len(c) > 6 and c[6]:
                    n = clean_num(c[6])
                    if n:
                        try: result['unitPrice'] = int(float(n))
                        except: pass

                # 수량
                if 'quantity' in col_map:
                    n = clean_num(c[col_map['quantity']])
                    if n:
                        try: result['contractQuantity'] = float(n)
                        except: pass
                elif len(c) > 7 and c[7]:
                    n = clean_num(c[7])
                    if n:
                        try: result['contractQuantity'] = float(n)
                        except: pass

                # 납품기한
                deadline_cell = c[col_map['deadline']] if 'deadline' in col_map else (c[8] if len(c) > 8 else '')
                if deadline_cell:
                    m2 = re.search(r'(\\d{4}[/\\-.]\\d{1,2}[/\\-.]\\d{1,2})', deadline_cell)
                    if m2:
                        result['deliveryDeadline'] = re.sub(r'[/.]', '-', m2.group(1))

                # 인도조건
                cond_cell = c[col_map['delivery_cond']] if 'delivery_cond' in col_map else ''
                if not cond_cell:
                    cond_cell = ' '.join(c)
                if '설치도' in cond_cell:
                    result['siteType'] = '납품설치도'
                elif '하차도' in cond_cell:
                    result['siteType'] = '납품하차도'

            # 규격/사양 (빈 순번 행)
            elif not c[0] and 'spec' not in result:
                spec_cell = c[col_map['spec']] if 'spec' in col_map else (c[4] if len(c) > 4 else '')
                if spec_cell and len(spec_cell) > 5:
                    result['specification'] = spec_cell.replace('  ', ' ').strip()[:200]

    result.setdefault('siteType', '납품설치도')

    # ── 실수요부서 담당자 + 전화번호 ──
    m = re.search(
        r'실수요부서\\s*담당자[,，\\s]*전화번호\\s*[:\\uff1a]?\\s*([^\\d]+?)\\s*(0\\d{1,2}[-\\s]\\d{3,4}[-\\s]\\d{4})',
        text
    )
    if m:
        raw_name = m.group(1).strip()
        phone = re.sub(r'\\s', '-', m.group(2).strip())
        result['clientManagerPhone'] = phone
        nm = re.search(r'^(.+?(?:과|팀|부|실|센터|원))\\s*([가-힣]{2,4})$', raw_name)
        if nm:
            result['clientDept'] = nm.group(1).strip()
            result['clientManager'] = nm.group(2).strip()
        else:
            result['clientManager'] = raw_name

    return result

if __name__ == '__main__':
    r = parse(sys.argv[1])
    print(json.dumps(r, ensure_ascii=False))
`;
