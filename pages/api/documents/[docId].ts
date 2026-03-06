import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  if (req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const { docId } = req.query;
  if (!docId || typeof docId !== 'string') return res.status(400).json({ error: { message: 'Invalid docId' } });

  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc || !doc.fileData) return res.status(404).json({ error: { message: 'File not found' } });

  const buffer = Buffer.from(doc.fileData, 'base64');
  res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  res.setHeader('Content-Length', buffer.length.toString());
  return res.send(buffer);
}
