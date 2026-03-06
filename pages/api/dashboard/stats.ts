import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  if (req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  const teamId = tm.teamId;

  const [activeSites, totalSites, unreadMessages, recentComments] = await Promise.all([
    prisma.site.count({ where: { teamId, status: '진행중' } }),
    prisma.site.count({ where: { teamId } }),
    prisma.message.count({ where: { receiverId: session.user.id, isRead: false } }),
    prisma.comment.findMany({
      take: 5,
      where: { site: { teamId } },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { name: true, position: true } },
        site: { select: { id: true, name: true } },
      },
    }),
  ]);

  const statusCounts = await prisma.site.groupBy({
    by: ['status'],
    where: { teamId },
    _count: { status: true },
  });

  const stats: Record<string, number> = {};
  statusCounts.forEach((s) => { stats[s.status] = s._count.status; });

  return res.status(200).json({
    data: { activeSites, totalSites, unreadMessages, statusCounts: stats, recentComments },
  });
}
