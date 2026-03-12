import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import {
  canAssignRole,
  canDeleteUser,
  getTeamMemberByUserId,
  hasMinRole,
  isCompanyAdminRole,
  isExternalRole,
  isSystemRole,
} from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });
  if (!hasMinRole(tm.role, 'MANAGER')) return res.status(403).json({ error: { message: 'Forbidden' } });

  try {
    switch (req.method) {
      case 'GET':
        return await handleGET(tm, res);
      case 'POST':
        return await handlePOST(req, res, tm);
      case 'DELETE':
        return await handleDELETE(req, res, tm, session.user.id);
      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (actorTm: any, res: NextApiResponse) => {
  const members = await prisma.teamMember.findMany({
    where: { teamId: actorTm.teamId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          department: true,
          position: true,
          phone: true,
          createdAt: true,
          siteAssignments: { include: { site: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const users = members
    .filter((m) => !isSystemRole(m.role) || isSystemRole(actorTm.role))
    .map((m) => ({
      ...m.user,
      teamMembers: [{ role: m.role, team: { name: m.teamId } }],
      assignedSites: m.user.siteAssignments.filter((a) => a.site).map((a) => ({ id: a.site.id, name: a.site.name })),
    }));

  return res.status(200).json({
    data: users,
    meta: { hasCompanyAdmin: members.some((m) => isCompanyAdminRole(m.role)) },
  });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, actorTm: any) => {
  const { name, email, password, company, department, position, phone, role, siteIds } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: { message: 'Name, email, password are required' } });
  }

  const targetRole = role || 'USER';
  if (!canAssignRole(actorTm.role, targetRole)) {
    return res.status(403).json({ error: { message: `${targetRole} 역할을 부여할 수 없습니다.` } });
  }

  if (isCompanyAdminRole(targetRole)) {
    const existingCompanyAdmin = await prisma.teamMember.findFirst({
      where: { teamId: actorTm.teamId, role: { in: ['ADMIN_HR', 'ADMIN'] } },
    });
    if (existingCompanyAdmin) {
      return res.status(400).json({ error: { message: 'COMPANY_ADMIN은 회사당 1명만 생성할 수 있습니다.' } });
    }
  }

  if (isExternalRole(targetRole) && (!Array.isArray(siteIds) || siteIds.length === 0)) {
    return res.status(400).json({ error: { message: '협력사/게스트 계정은 최소 1개 현장을 지정해야 합니다.' } });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: { message: 'Email already exists' } });

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: await hashPassword(password),
      company: company || null,
      department: department || null,
      position: position || null,
      phone: phone || null,
    },
  });

  await prisma.teamMember.create({ data: { teamId: actorTm.teamId, userId: user.id, role: targetRole } });

  if (Array.isArray(siteIds) && siteIds.length > 0) {
    const validSites = await prisma.site.findMany({
      where: { teamId: actorTm.teamId, id: { in: siteIds } },
      select: { id: true },
    });
    if (validSites.length > 0) {
      await prisma.siteAssignment.createMany({
        data: validSites.map((site) => ({ siteId: site.id, userId: user.id, assignedRole: targetRole })),
        skipDuplicates: true,
      });
    }
  }

  return res.status(201).json({ data: user });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, actorTm: any, actorUserId: string) => {
  const userId = String(req.body?.userId || '');
  if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });

  const targetTm = await prisma.teamMember.findFirst({ where: { teamId: actorTm.teamId, userId } });
  if (!targetTm) return res.status(404).json({ error: { message: 'User not found in team' } });
  if (!canDeleteUser(actorTm.role, actorUserId, targetTm.role, userId)) {
    return res.status(403).json({ error: { message: '이 사용자를 삭제할 권한이 없습니다.' } });
  }

  await prisma.siteAssignment.deleteMany({ where: { userId, site: { teamId: actorTm.teamId } } });
  await prisma.teamMember.delete({ where: { id: targetTm.id } });

  const membershipCount = await prisma.teamMember.count({ where: { userId } });
  if (membershipCount === 0) {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });

    const dependencyCount = await Promise.all([
      prisma.site.count({ where: { createdById: userId } }),
      prisma.salesRecord.count({ where: { createdById: userId } }),
      prisma.contract.count({ where: { createdById: userId } }),
      prisma.shippingRecord.count({ where: { createdById: userId } }),
      prisma.request.count({ where: { OR: [{ createdById: userId }, { handledById: userId }] } }),
      prisma.comment.count({ where: { authorId: userId } }),
    ]);

    if (dependencyCount.some((count) => count > 0)) {
      const suffix = `deleted_${Date.now()}`;
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: `${suffix}_${userId}@deleted.local`,
          password: await hashPassword(`${suffix}_${userId}`),
          lockedAt: new Date(),
          company: null,
          department: null,
          position: null,
          phone: null,
        },
      });
    } else {
      await prisma.user.delete({ where: { id: userId } });
    }
  }

  return res.status(200).json({ data: { message: 'User deleted' } });
};
