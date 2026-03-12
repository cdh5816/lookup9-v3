import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId } from '@/lib/team-helper';

const SALES_DEPTS = ['영업부', '경영진', '경영지원부'];
const CONTRACT_DEPTS = ['영업부', '수주팀', '경영진', '경영지원부'];
const PRODUCTION_DEPTS = ['생산관리팀', '경영진', '경영지원부'];
const PAINT_DEPTS = ['도장팀', '생산관리팀', '경영진', '경영지원부'];
const SHIPPING_DEPTS = ['출하팀', '생산관리팀', '공사팀', '경영진', '경영지원부'];
const APPROVAL_DEPTS = ['경영지원부', '경영진', '영업부', '수주팀'];

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
        teamMembers: { select: { role: true, team: { select: { id: true, name: true } } } },
      },
    }),
    tm
      ? prisma.siteAssignment.findMany({
          where: { userId, site: { teamId: tm.teamId } },
          include: { site: { select: { id: true, name: true, status: true, address: true, updatedAt: true } } },
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
  const department = user?.department || '';
  const companyDisplayName = user?.company || user?.teamMembers?.[0]?.team?.name || 'LOOKUP9';
  const isExternal = ['PARTNER', 'GUEST', 'VIEWER'].includes(role);
  const isManagerUp = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(role);

  const permissions = {
    canSeeSales: isManagerUp || SALES_DEPTS.includes(department),
    canSeeContract: isManagerUp || CONTRACT_DEPTS.includes(department),
    canSeeProduction: isManagerUp || PRODUCTION_DEPTS.includes(department),
    canSeePainting: isManagerUp || PAINT_DEPTS.includes(department),
    canSeeShipping: isManagerUp || SHIPPING_DEPTS.includes(department),
    canSeeApprovals: isManagerUp || APPROVAL_DEPTS.includes(department),
    canManageProgress: isManagerUp || PRODUCTION_DEPTS.includes(department) || PAINT_DEPTS.includes(department),
    canCreateGuest: isManagerUp || ['영업부', '수주팀', '생산관리팀'].includes(department),
    canManageUsers: isManagerUp,
  };

  return res.status(200).json({
    data: {
      ...user,
      role,
      department,
      isExternal,
      companyDisplayName,
      permissions,
      mySites: Array.isArray(mySites) ? mySites.map((a: any) => a.site) : [],
      unreadMessages: unreadCount,
      myComments,
    },
  });
}
