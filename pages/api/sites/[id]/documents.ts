import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(id, res);
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

const handleGET = async (siteId: string, res: NextApiResponse) => {
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
