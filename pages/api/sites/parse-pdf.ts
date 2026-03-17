/* eslint-disable i18next/no-literal-string */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@/lib/session';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

// Python 파서 위치 (lib/pdf-parser.py)
const PARSER_PY = path.join(process.cwd(), 'lib', 'pdf-parser.py');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { fileData } = req.body;
  if (!fileData) return res.status(400).json({ error: { message: 'fileData required' } });

  // pdfplumber 자동 설치 (첫 실행 시)
  const pipCheck = spawnSync('python3', ['-c', 'import pdfplumber'], { encoding: 'utf-8' });
  if (pipCheck.status !== 0) {
    spawnSync('python3', ['-m', 'pip', 'install', 'pdfplumber', '--break-system-packages', '-q'], { encoding: 'utf-8', timeout: 60000 });
  }

  const tmpDir = os.tmpdir();
  const tmpPdf = path.join(tmpDir, `pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);

  try {
    fs.writeFileSync(tmpPdf, Buffer.from(fileData, 'base64'));

    const proc = spawnSync('python3', [PARSER_PY, tmpPdf], {
      encoding: 'utf-8',
      timeout: 90000,
    });

    if (proc.error) {
      console.error('PDF scan proc error:', proc.error);
      return res.status(422).json({ error: { message: '스캔 실패: python3 실행 오류' } });
    }

    if (proc.status !== 0) {
      console.error('PDF scan stderr:', proc.stderr?.slice(0, 500));
      return res.status(422).json({ error: { message: '스캔 실패: 조달청 분할납품요구서 형식인지 확인해주세요.' } });
    }

    const raw = proc.stdout?.trim();
    if (!raw) {
      return res.status(422).json({ error: { message: '스캔 결과가 비어있습니다.' } });
    }

    const parsed = JSON.parse(raw);
    return res.status(200).json({ data: parsed });

  } catch (err: any) {
    console.error('PDF scan exception:', err);
    return res.status(500).json({ error: { message: err.message || '스캔 중 오류가 발생했습니다.' } });
  } finally {
    try { fs.unlinkSync(tmpPdf); } catch {}
  }
}
