import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getPermissions, getTeamMemberByUserId } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  if (req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const userId = session.user.id;
  const tm = await getTeamMemberByUserId(userId);

  const [user, mySites, unreadMessages, unreadNotifications, myComments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        department: true,
        position: true,
        phone: true,
        createdAt: true,
        teamMembers: { select: { role: true, team: { select: { id: true, name: true } } } },
      },
    }),
    tm
      ? prisma.siteAssignment.findMany({
          where: { userId, site: { teamId: tm.teamId } },
          include: { site: { select: { id: true, name: true, status: true, address: true } } },
          orderBy: { assignedAt: 'desc' },
          take: 20,
        })
      : [],
    prisma.message.count({ where: { receiverId: userId, isRead: false } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    tm
      ? prisma.comment.findMany({
          where: { authorId: userId, site: { teamId: tm.teamId } },
          include: { site: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : [],
  ]);

  const role = user?.teamMembers?.[0]?.role || 'USER';
  const companyDisplayName = user?.company || user?.teamMembers?.[0]?.team?.name || 'LOOKUP9';
  const permissions = getPermissions(role, user?.department);

  return res.status(200).json({
    data: {
      ...user,
      role,
      companyDisplayName,
      permissions,
      mySites: Array.isArray(mySites) ? mySites.map((a: any) => a.site) : [],
      unreadMessages,
      unreadNotifications,
      myComments,
    },
  });
}
