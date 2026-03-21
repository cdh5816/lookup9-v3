import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getPermissionFlags, getTeamMemberByUserId, isExternalRole } from '@/lib/team-helper';

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
        teamMembers: {
          select: {
            role: true,
            team: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
    tm
      ? prisma.siteAssignment.findMany({
          where: { userId, site: { teamId: tm.teamId } },
          include: {
            site: {
              select: { id: true, name: true, status: true, address: true, updatedAt: true },
            },
          },
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
  const teamName = user?.teamMembers?.[0]?.team?.name || null;

  // 좌측 상단 회사명 결정:
  // PARTNER/GUEST → user.company (협력사/게스트 소속 회사명)
  // COMPANY_ADMIN/내부직원 → team.name (본사명)
  const isExtRole = ['PARTNER', 'GUEST', 'VIEWER'].includes(role);
  const companyDisplayName = isExtRole
    ? (user?.company || teamName || 'LOOKUP9')
    : (teamName || user?.company || 'LOOKUP9');

  const permissions = getPermissionFlags(role, user?.department);

  return res.status(200).json({
    data: {
      ...user,
      role,
      isExternal: isExternalRole(role),
      companyDisplayName,
      permissions,
      mySites: Array.isArray(mySites) ? mySites.map((a: any) => a.site) : [],
      unreadMessages,
      unreadNotifications,
      myComments,
    },
  });
}
