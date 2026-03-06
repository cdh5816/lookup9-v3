import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(req, res, session);
      case 'POST': return await handlePOST(req, res, session);
      case 'PUT': return await handlePUT(req, res, session);
      case 'DELETE': return await handleDELETE(req, res, session);
      default:
        res.setHeader('Allow', 'GET, POST, PUT, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (req: NextApiRequest, res: NextApiResponse, session: any) => {
  const { box } = req.query;
  const userId = session.user.id;

  const where = box === 'sent'
    ? { senderId: userId }
    : { receiverId: userId };

  const messages = await prisma.message.findMany({
    where,
    include: {
      sender: { select: { id: true, name: true, position: true, department: true } },
      receiver: { select: { id: true, name: true, position: true, department: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json({ data: messages });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any) => {
  const { receiverId, title, content } = req.body;
  if (!receiverId || !title || !content) {
    return res.status(400).json({ error: { message: '받는사람, 제목, 내용을 모두 입력해주세요.' } });
  }

  const message = await prisma.message.create({
    data: {
      senderId: session.user.id,
      receiverId,
      title,
      content,
    },
    include: {
      sender: { select: { name: true, position: true } },
      receiver: { select: { name: true, position: true } },
    },
  });

  return res.status(201).json({ data: message });
};

// 읽음 처리
const handlePUT = async (req: NextApiRequest, res: NextApiResponse, session: any) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: { message: 'messageId is required' } });

  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg || msg.receiverId !== session.user.id) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  await prisma.message.update({ where: { id: messageId }, data: { isRead: true } });
  return res.status(200).json({ data: { message: 'Read' } });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, session: any) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: { message: 'messageId is required' } });

  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg || (msg.senderId !== session.user.id && msg.receiverId !== session.user.id)) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  await prisma.message.delete({ where: { id: messageId } });
  return res.status(200).json({ data: { message: 'Deleted' } });
};
