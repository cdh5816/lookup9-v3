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

  const [
    activeSites,
    totalSites,
    unreadMessages,
    unreadNotifications,
    openRequests,
    recentComments,
    statusGroups,
    recentSites,
  ] = await Promise.all([
    prisma.site.count({ where: { teamId, status: { in: ['진행중', '부분완료'] } } }),
    prisma.site.count({ where: { teamId } }),
    prisma.message.count({ where: { receiverId: session.user.id, isRead: false } }),
    prisma.notification.count({ where: { userId: session.user.id, isRead: false } }),
    prisma.request.count({
      where: {
        site: { teamId },
        status: { notIn: ['완료', '반려'] },
      },
    }),
    prisma.comment.findMany({
      take: 5,
      where: { site: { teamId } },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { name: true, position: true } },
        site: { select: { id: true, name: true } },
      },
    }),
    prisma.site.groupBy({
      by: ['status'],
      where: { teamId },
      _count: { status: true },
    }),
    prisma.site.findMany({
      where: { teamId, status: { in: ['진행중', '부분완료', '계약완료'] } },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        status: true,
        address: true,
        description: true,
        updatedAt: true,
        _count: { select: { requests: true, assignments: true } },
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  statusGroups.forEach((s) => { statusCounts[s.status] = s._count.status; });

  // 납기임박 현장 계산 (description에서 납품기한 파싱)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allActiveSitesForDeadline = await prisma.site.findMany({
    where: { teamId, status: { in: ['진행중', '부분완료', '계약완료'] } },
    select: { id: true, description: true },
  });
  let deadlineUrgent = 0;
  allActiveSitesForDeadline.forEach((site) => {
    if (!site.description) return;
    const match = site.description.match(/납품기한\s*[:：]\s*(\d{4}-\d{2}-\d{2})/);
    if (!match) return;
    const deadline = new Date(match[1]);
    deadline.setHours(0, 0, 0, 0);
    const diff = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
    if (diff >= 0 && diff <= 7) deadlineUrgent++;
  });

  return res.status(200).json({
    data: {
      activeSites,
      totalSites,
      unreadMessages,
      unreadNotifications,
      openRequests,
      deadlineUrgent,
      statusCounts,
      recentComments,
      recentSites,
    },
  });
}
