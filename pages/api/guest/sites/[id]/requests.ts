import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  // 배정 확인
  const assignment = await prisma.siteAssignment.findFirst({
    where: { siteId: id, userId: session.user.id },
  });
  if (!assignment) return res.status(403).json({ error: { message: '배정된 현장이 아닙니다.' } });

  try {
    switch (req.method) {
      case 'GET': {
        const requests = await prisma.request.findMany({
          where: { siteId: id, createdById: session.user.id },
          include: { handledBy: { select: { name: true, position: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({ data: requests });
      }
      case 'POST': {
        const { title, type, description, deadline } = req.body;
        if (!title) return res.status(400).json({ error: { message: '제목을 입력해주세요.' } });
        const request = await prisma.request.create({
          data: {
            siteId: id,
            title,
            type: type || '고객 요청',
            priority: '보통',
            description: description || null,
            deadline: deadline ? new Date(deadline) : null,
            createdById: session.user.id,
          },
        });
        return res.status(201).json({ data: request });
      }
      default:
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
