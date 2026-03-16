import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  if (!(await verifySiteAccess(session.user.id, id))) return res.status(403).json({ error: { message: 'Forbidden' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(id, req, res);
      case 'POST': return await handlePOST(id, req, res, session);
      case 'DELETE': return await handleDELETE(req, res);
      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (siteId: string, req: NextApiRequest, res: NextApiResponse) => {
  const { download, docId } = req.query;

  // 단일 문서 다운로드 모드
  if (download === '1' && docId) {
    const doc = await prisma.document.findFirst({
      where: { id: String(docId), siteId },
      select: { fileName: true, fileData: true, mimeType: true },
    });
    if (!doc || !doc.fileData) {
      return res.status(404).json({ error: { message: '파일을 찾을 수 없습니다.' } });
    }
    const buffer = Buffer.from(doc.fileData, 'base64');
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }

  // 목록 조회 (fileData 제외 - 목록에서는 불필요)
  const docs = await prisma.document.findMany({
    where: { siteId },
    select: {
      id: true, fileName: true, type: true, fileSize: true, mimeType: true, createdAt: true,
      uploadedBy: { select: { name: true, position: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.status(200).json({ data: docs });
};

const handlePOST = async (siteId: string, req: NextApiRequest, res: NextApiResponse, session: any) => {
  const { fileName, fileData, mimeType, type } = req.body;
  if (!fileName || !fileData) {
    return res.status(400).json({ error: { message: '파일명과 파일 데이터가 필요합니다.' } });
  }

  const fileSize = Math.round((fileData.length * 3) / 4);

  const doc = await prisma.document.create({
    data: {
      siteId,
      fileName,
      fileData,
      mimeType: mimeType || 'application/octet-stream',
      fileSize,
      type: type || null,
      uploadedById: session.user.id,
    },
    select: {
      id: true, fileName: true, type: true, fileSize: true, mimeType: true, createdAt: true,
      uploadedBy: { select: { name: true, position: true } },
    },
  });

  return res.status(201).json({ data: doc });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const { documentId } = req.body;
  if (!documentId) return res.status(400).json({ error: { message: 'documentId is required' } });
  await prisma.document.delete({ where: { id: documentId } });
  return res.status(200).json({ data: { message: 'Deleted' } });
};
