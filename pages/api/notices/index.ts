import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(req, res);
      case 'POST': return await handlePOST(req, res, session);
      case 'DELETE': return await handleDELETE(req, res, session);
      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const { limit } = req.query;
  const take = limit ? parseInt(limit as string, 10) : 20;

  const notices = await prisma.notice.findMany({
    include: { author: { select: { name: true, position: true } } },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    take,
  });

  return res.status(200).json({ data: notices });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any) => {
  const adminRoles = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'];
  const tm = await prisma.teamMember.findFirst({ where: { userId: session.user.id } });
  if (!tm || !adminRoles.includes(tm.role)) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  const { title, content, isPinned } = req.body;
  if (!title || !content) return res.status(400).json({ error: { message: '제목과 내용을 입력해주세요.' } });

  const notice = await prisma.notice.create({
    data: {
      title,
      content,
      isPinned: isPinned || false,
      authorId: session.user.id,
    },
    include: { author: { select: { name: true, position: true } } },
  });

  return res.status(201).json({ data: notice });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, session: any) => {
  const adminRoles = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'];
  const tm = await prisma.teamMember.findFirst({ where: { userId: session.user.id } });
  if (!tm || !adminRoles.includes(tm.role)) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  const { noticeId } = req.body;
  if (!noticeId) return res.status(400).json({ error: { message: 'noticeId is required' } });

  await prisma.notice.delete({ where: { id: noticeId } });
  return res.status(200).json({ data: { message: 'Deleted' } });
};
