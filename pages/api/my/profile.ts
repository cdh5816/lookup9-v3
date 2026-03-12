import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getPermissionFlags, getTeamMemberByUserId } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  if (req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const userId = session.user.id;
  const tm = await getTeamMemberByUserId(userId);

  const [user, mySites, unreadCount, myComments] = await Promise.all([
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
        teamMembers: { select: { role: true, team: { select: { id: true, name: true, slug: true } } } },
      },
    }),
    tm
      ? prisma.siteAssignment.findMany({
          where: { userId, site: { teamId: tm.teamId } },
          include: { site: { select: { id: true, name: true, status: true, address: true } } },
          orderBy: { assignedAt: 'desc' },
          take: 10,
        })
      : [],
    prisma.message.count({ where: { receiverId: userId, isRead: false } }),
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
  const permissions = getPermissionFlags(role, user?.department);
  const companyDisplayName = user?.company || user?.teamMembers?.[0]?.team?.name || 'LOOKUP9';

  return res.status(200).json({
    data: {
      ...user,
      role,
      permissions,
      isExternal: permissions.isExternal,
      companyDisplayName,
      mySites: Array.isArray(mySites) ? mySites.map((a: any) => a.site) : [],
      unreadMessages: unreadCount,
      myComments,
    },
  });
}
