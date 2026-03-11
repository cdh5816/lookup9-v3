/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { canViewAllCompanySites } from '@/lib/team-helper';
import { getCompanyDisplayName } from '@/lib/lookup9-role';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  if (req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
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
      teamMembers: { select: { role: true, teamId: true, team: { select: { id: true, name: true } } } },
    },
  });

  if (!user) return res.status(404).json({ error: { message: 'User not found' } });

  const tm = user.teamMembers?.[0];
  const teamId = tm?.teamId;
  const role = tm?.role || 'USER';
  const canViewAll = canViewAllCompanySites(role);

  const [mySites, unreadCount, myComments] = await Promise.all([
    !teamId
      ? []
      : canViewAll
        ? prisma.site.findMany({
            where: { teamId },
            select: { id: true, name: true, status: true, address: true, updatedAt: true },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            take: 30,
          })
        : prisma.siteAssignment.findMany({
            where: { userId, site: { teamId } },
            include: { site: { select: { id: true, name: true, status: true, address: true, updatedAt: true } } },
            orderBy: { assignedAt: 'desc' },
            take: 30,
          }),
    prisma.message.count({ where: { receiverId: userId, isRead: false } }),
    teamId
      ? prisma.comment.findMany({
          where: { authorId: userId, site: { teamId } },
          include: { site: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : [],
  ]);

  const normalizedSites = Array.isArray(mySites)
    ? mySites.map((item: any) => ('site' in item ? item.site : item))
    : [];

  return res.status(200).json({
    data: {
      ...user,
      companyDisplayName: getCompanyDisplayName(user as any),
      internalAccessAllSites: canViewAll,
      mySites: normalizedSites,
      unreadMessages: unreadCount,
      myComments,
    },
  });
}
