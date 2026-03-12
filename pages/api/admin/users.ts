import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import {
  getTeamMemberByUserId,
  hasMinRole,
  canDeleteUser,
  canAssignRole,
  isExternalRole,
  isCompanyAdminRole,
} from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  if (!hasMinRole(tm.role, 'MANAGER')) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGET(tm.teamId, res);
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

async function handleGET(teamId: string, res: NextApiResponse) {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
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
          siteAssignments: {
            where: { site: { teamId } },
            select: {
              siteId: true,
              site: { select: { id: true, name: true, status: true } },
            },
          },
        },
      },
    },
    orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
  });

  const users = members.map((m) => ({
    ...m.user,
    teamMembers: [{ role: m.role, team: { name: m.teamId } }],
  }));

  return res.status(200).json({ data: users });
}

async function handlePOST(req: NextApiRequest, res: NextApiResponse, actorTm: any) {
  const {
    name,
    email,
    password,
    company,
    department,
    position,
    phone,
    role,
    assignedSiteIds,
  } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: { message: 'Name, email, password are required' } });
  }

  const targetRole = role || 'USER';
  const normalizedSiteIds: string[] = Array.isArray(assignedSiteIds)
    ? Array.from(new Set(assignedSiteIds.filter((v) => typeof v === 'string' && v.trim())))
    : [];

  if (!canAssignRole(actorTm.role, targetRole)) {
    return res.status(403).json({ error: { message: `${targetRole} 역할을 부여할 수 없습니다.` } });
  }

  if (isCompanyAdminRole(targetRole)) {
    const existingCompanyAdmin = await prisma.teamMember.findFirst({
      where: { teamId: actorTm.teamId, role: 'ADMIN_HR' },
      select: { id: true },
    });
    if (existingCompanyAdmin) {
      return res.status(400).json({ error: { message: 'COMPANY_ADMIN은 회사당 1명만 생성할 수 있습니다.' } });
    }
  }

  if (isExternalRole(targetRole) && normalizedSiteIds.length === 0) {
    return res.status(400).json({ error: { message: '협력사/게스트 계정은 최소 1개 현장을 지정해야 합니다.' } });
  }

  if (normalizedSiteIds.length > 0) {
    const validSitesCount = await prisma.site.count({
      where: { id: { in: normalizedSiteIds }, teamId: actorTm.teamId },
    });
    if (validSitesCount !== normalizedSiteIds.length) {
      return res.status(400).json({ error: { message: '선택한 현장 중 유효하지 않은 항목이 있습니다.' } });
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: { message: 'Email already exists' } });

  const hashedPassword = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        company: company || null,
        department: department || null,
        position: position || null,
        phone: phone || null,
      },
    });

    await tx.teamMember.create({
      data: { teamId: actorTm.teamId, userId: user.id, role: targetRole },
    });

    if (normalizedSiteIds.length > 0) {
      await tx.siteAssignment.createMany({
        data: normalizedSiteIds.map((siteId) => ({
          siteId,
          userId: user.id,
          assignedRole: targetRole,
        })),
      });
    }

    return user;
  });

  return res.status(201).json({ data: result });
}

async function handleDELETE(req: NextApiRequest, res: NextApiResponse, actorTm: any, actorUserId: string) {
  const userId = typeof req.body?.userId === 'string' ? req.body.userId : typeof req.query?.id === 'string' ? req.query.id : '';
  if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });

  const targetTm = await prisma.teamMember.findFirst({
    where: { teamId: actorTm.teamId, userId },
    include: { user: true },
  });
  if (!targetTm) return res.status(404).json({ error: { message: 'User not found in team' } });

  if (!canDeleteUser(actorTm.role, actorUserId, targetTm.role, userId)) {
    return res.status(403).json({ error: { message: '이 사용자를 삭제할 권한이 없습니다.' } });
  }

  const now = Date.now();
  const originalEmail = targetTm.user.email;
  const safeDeletedEmail = `deleted+${now}_${originalEmail}`.slice(0, 190);

  await prisma.$transaction(async (tx) => {
    await tx.siteAssignment.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });

    await tx.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });

    await tx.request.updateMany({ where: { handledById: userId }, data: { handledById: null } });
    await tx.issue.updateMany({ where: { handledById: userId }, data: { handledById: null } });
    await tx.changeLog.updateMany({ where: { approverId: userId }, data: { approverId: null } });
    await tx.schedule.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } });
    await tx.leaveRequest.updateMany({ where: { managerId: userId }, data: { managerId: null } });
    await tx.leaveRequest.updateMany({ where: { adminId: userId }, data: { adminId: null } });
    await tx.paintSpec.updateMany({ where: { confirmedById: userId }, data: { confirmedById: null } });

    await tx.teamMember.deleteMany({ where: { userId, teamId: actorTm.teamId } });

    const remainingMemberships = await tx.teamMember.count({ where: { userId } });
    if (remainingMemberships === 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: safeDeletedEmail,
          password: await hashPassword(`deleted-${now}-${Math.random().toString(36).slice(2)}`),
          name: `[삭제됨] ${targetTm.user.name}`,
          company: null,
          department: null,
          position: null,
          phone: null,
          image: null,
          invalid_login_attempts: 99,
          lockedAt: new Date(),
        },
      });
    }
  });

  return res.status(200).json({ data: { message: 'User deleted' } });
}
