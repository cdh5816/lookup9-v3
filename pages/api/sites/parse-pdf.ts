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

// Python 파싱 스크립트 (인라인)
const PYTHON_PARSER = `
import sys, json, re, subprocess

def ensure_pdfplumber():
    try:
        import pdfplumber
        return pdfplumber
    except ImportError:
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'pdfplumber',
                        '--break-system-packages', '-q'], capture_output=True)
        import pdfplumber
        return pdfplumber

def parse(pdf_path):
    pdfplumber = ensure_pdfplumber()
    result = {}

    with pdfplumber.open(pdf_path) as pdf:
        text = ""
        tables = []
        for page in pdf.pages:
            text += page.extract_text() or ""
            tables.extend(page.extract_tables() or [])

    def search(pattern, flags=0):
        return re.search(pattern, text, flags)

    # 납품요구번호
    m = search(r'납\\s*품\\s*요\\s*구\\s*번\\s*호\\s*[::]\\s*([A-Z0-9\\-]+)')
    result['contractNo'] = m.group(1).strip() if m else None

    # 납품요구일자
    m = search(r'납\\s*품\\s*요\\s*구\\s*일\\s*자\\s*[::]\\s*(\\d{4}/\\d{2}/\\d{2})')
    result['contractDate'] = m.group(1).replace('/', '-') if m else None

    # 계약번호
    m = search(r'계약번호\\s*제?\\s*([0-9\\-]+)\\s*호')
    result['procurementNo'] = m.group(1).strip() if m else None

    # 수요기관 (한글만 추출)
    m = search(r'수\\s*요\\s*기\\s*관\\s*[::]\\s*([가-힣]+)')
    result['clientName'] = m.group(1).strip() if m else None

    # 사업명
    m = search(r'사\\s*업\\s*명\\s*[::]?\\s*:?\\s*(.+?)(?:\\n|순\\s*번)', re.DOTALL)
    if m:
        result['name'] = re.sub(r'\\s+', ' ', m.group(1)).strip()[:100]

    # 하자담보책임기간
    m = search(r'하자담보책임기간\\s*[::]?\\s*(\\d+)\\s*년')
    result['warrantyPeriod'] = int(m.group(1)) if m else 2

    # 계약금액 (품대계)
    m = search(r'품\\s*대\\s*계[^\\d]*(\\d{1,3}(?:,\\d{3})+)')
    result['contractAmount'] = int(m.group(1).replace(',', '')) if m else None

    # 검사/검수기관 - 정규식 직접 추출 (가장 안정적)
    m = search(r'\\d{1,3}(?:,\\d{3})+\\s+\\d{1,3}(?:,\\d{3})+\\s+\\d{1,3}(?:,\\d{3})+\\s+가능\\s+([\\S]+)\\s+([\\S]+)')
    if m:
        result['inspectionAgency'] = m.group(1)
        result['acceptanceAgency'] = m.group(2)

    # 검사기관 유형 판별
    if result.get('inspectionAgency'):
        ag = result['inspectionAgency']
        if ag == '조달청':
            result['inspectionAgencyType'] = '조달청'
        elif any(k in ag for k in ['군', '시', '구', '도청', '시청', '군청']):
            result['inspectionAgencyType'] = '수요기관 자체'
        else:
            result['inspectionAgencyType'] = '전문검사기관'
            result['inspectionBody'] = ag

    # 품목 테이블: 단가/수량/납품기한/규격/인도조건
    for table in tables:
        if not table: continue
        h = ' '.join([str(c) for c in table[0] if c])
        if '단 가' not in h and '수 량' not in h: continue

        for row in table[1:]:
            if not row or not any(row): continue
            c = [str(x).replace('\\n', ' ').strip() if x else '' for x in row]

            if c[0] and re.match(r'^\\d+$', c[0]):
                # 단가
                if len(c) > 6 and c[6]:
                    try: result['unitPrice'] = int(float(c[6].replace(',', '')))
                    except: pass
                # 수량
                if len(c) > 7 and c[7]:
                    try: result['contractQuantity'] = float(c[7].replace(',', ''))
                    except: pass
                # 납품기한
                if len(c) > 8 and c[8]:
                    m2 = re.search(r'(\\d{4}/\\d{2}/\\d{2})', c[8])
                    if m2: result['deliveryDeadline'] = m2.group(1).replace('/', '-')
                # 인도조건
                for cell in c:
                    if '설치도' in cell: result['siteType'] = '납품설치도'
                    elif '하차도' in cell: result['siteType'] = '납품하차도'

            elif not c[0] and len(c) > 4 and c[4] and len(c[4]) > 5:
                result['specification'] = c[4].replace('  ', ' ').strip()[:200]

    result.setdefault('siteType', '납품설치도')

    # ── 실수요부서 담당자 + 전화번호 (기타사항 하단) ──
    # 패턴: "실수요부서 담당자, 전화번호 : 인구정책과 김지혜 041-950-4344"
    m = re.search(r'실수요부서\\s*담당자[,，]\\s*전화번호\\s*[::]?\\s*([^\\d]+?)\\s*(0\\d{1,2}-\\d{3,4}-\\d{4})', text)
    if m:
        raw_name = m.group(1).strip()
        result['clientManagerPhone'] = m.group(2).strip()
        # 부서명 + 이름 분리 (과/팀/부/실/센터 접미사 기준)
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
