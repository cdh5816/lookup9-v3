/* eslint-disable i18next/no-literal-string */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';
import { prisma } from '@/lib/prisma';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const PARSER_PY = path.join(process.cwd(), 'lib', 'production-pdf-parser.py');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Site ID required' } });

  const tm = await verifySiteAccess(session.user.id, id);
  if (!tm) return res.status(403).json({ error: { message: 'Forbidden' } });

  const allowed = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'];
  if (!allowed.includes(tm.role)) {
    return res.status(403).json({ error: { message: '업로드 권한이 없습니다.' } });
  }

  const { fileData, action, orders: confirmOrders } = req.body;

  // ── 2단계: 확인 후 DB 저장 ──
  if (action === 'confirm' && Array.isArray(confirmOrders)) {
    let saved = 0;
    for (const order of confirmOrders) {
      if (!order.quantity || Number(order.quantity) <= 0) continue;
      await prisma.productionOrder.create({
        data: {
          siteId: id,
          sequence: saved + 1,
          quantity: Number(order.quantity),
          orderDate: order.orderDate ? new Date(order.orderDate) : null,
          supplyDate: order.supplyDate ? new Date(order.supplyDate) : null,
          notes: order.notes || null,
          createdById: session.user.id,
        },
      });
      saved++;
    }
    return res.status(200).json({ data: { saved, message: `${saved}건 등록 완료` } });
  }

  // ── 1단계: PDF 파싱 ──
  if (!fileData) return res.status(400).json({ error: { message: 'fileData required' } });

  // pdfplumber 자동 설치
  const pipCheck = spawnSync('python3', ['-c', 'import pdfplumber'], { encoding: 'utf-8' });
  if (pipCheck.status !== 0) {
    spawnSync('python3', ['-m', 'pip', 'install', 'pdfplumber', '--break-system-packages', '-q'], { encoding: 'utf-8', timeout: 60000 });
  }

  const tmpDir = os.tmpdir();
  const tmpPdf = path.join(tmpDir, `prod_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);

  try {
    // base64 → PDF 파일
    const base64 = fileData.replace(/^data:application\/pdf;base64,/, '');
    fs.writeFileSync(tmpPdf, Buffer.from(base64, 'base64'));

    const proc = spawnSync('python3', [PARSER_PY, tmpPdf], {
      encoding: 'utf-8',
      timeout: 30000,
    });

    if (proc.error || proc.status !== 0) {
      console.error('Production PDF parse error:', proc.stderr?.slice(0, 500));
      return res.status(422).json({ error: { message: 'PDF 파싱 실패. 엑셀에서 PDF로 저장한 파일인지 확인해주세요.' } });
    }

    const raw = proc.stdout?.trim();
    if (!raw) {
      return res.status(422).json({ error: { message: '파싱 결과가 비어있습니다.' } });
    }

    const parsed = JSON.parse(raw);

    if (parsed.error) {
      return res.status(422).json({ error: { message: parsed.error } });
    }

    return res.status(200).json({ data: parsed });
  } catch (err: any) {
    console.error('Production PDF exception:', err);
    return res.status(500).json({ error: { message: err.message || '파싱 중 오류' } });
  } finally {
    try { fs.unlinkSync(tmpPdf); } catch {}
  }
}
