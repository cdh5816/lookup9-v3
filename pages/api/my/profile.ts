import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  if (req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const userId = session.user.id;

  const [user, mySites, unreadCount, myComments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, company: true, department: true,
        position: true, phone: true, createdAt: true,
        teamMembers: { select: { role: true, team: { select: { name: true } } } },
      },
    }),
    prisma.siteAssignment.findMany({
      where: { userId },
      include: { site: { select: { id: true, name: true, status: true, address: true } } },
      orderBy: { assignedAt: 'desc' },
      take: 10,
    }),
    prisma.message.count({ where: { receiverId: userId, isRead: false } }),
    prisma.comment.findMany({
      where: { authorId: userId },
      include: { site: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return res.status(200).json({
    data: {
      ...user,
      mySites: mySites.map((a) => a.site),
      unreadMessages: unreadCount,
      myComments,
    },
  });
}
