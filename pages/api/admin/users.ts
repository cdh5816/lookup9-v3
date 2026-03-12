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
        return await handleGET(tm.teamId, tm.role, res);
      case 'POST':
        return await handlePOST(req, res, tm);
      case 'DELETE':
        return await handleDELETE(req, res, tm);
      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (teamId: string, actorRole: string, res: NextApiResponse) => {
  const [members, sites, companyAdminCount] = await Promise.all([
    prisma.teamMember.findMany({
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
              include: {
                site: { select: { id: true, name: true, status: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.site.findMany({ where: { teamId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, status: true } }),
    prisma.teamMember.count({ where: { teamId, role: 'ADMIN_HR' } }),
  ]);

  const users = members
    .filter((m) => !['SUPER_ADMIN', 'OWNER'].includes(m.role))
    .map((m) => ({
      ...m.user,
      teamMembers: [{ role: m.role, team: { name: m.teamId } }],
      assignedSites: (m.user.siteAssignments || []).map((a) => a.site),
    }));

  return res.status(200).json({
    data: users,
    meta: {
      sites,
      companyAdminExists: companyAdminCount > 0,
      actorRole,
    },
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

  if (targetRole === 'ADMIN_HR') {
    const adminExists = await prisma.teamMember.findFirst({
      where: { teamId: actorTm.teamId, role: 'ADMIN_HR' },
      select: { id: true },
    });
    if (adminExists) {
      return res.status(400).json({ error: { message: 'COMPANY_ADMIN 계정은 회사당 1개만 생성할 수 있습니다.' } });
    }
  }

  const normalizedSiteIds = Array.isArray(siteIds)
    ? Array.from(new Set(siteIds.filter((id) => typeof id === 'string' && id.trim())))
    : [];

  if (isExternalRole(targetRole) && normalizedSiteIds.length === 0) {
    return res.status(400).json({ error: { message: '외부 계정은 최소 1개 현장을 지정해야 합니다.' } });
  }

  if (normalizedSiteIds.length > 0) {
    const siteCount = await prisma.site.count({
      where: { teamId: actorTm.teamId, id: { in: normalizedSiteIds } },
    });
    if (siteCount !== normalizedSiteIds.length) {
      return res.status(400).json({ error: { message: '선택한 현장 중 다른 회사 현장이 포함되어 있습니다.' } });
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: { message: 'Email already exists' } });

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
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

  await prisma.teamMember.create({
    data: { teamId: actorTm.teamId, userId: user.id, role: targetRole },
  });

  if (normalizedSiteIds.length > 0) {
    await prisma.siteAssignment.createMany({
      data: normalizedSiteIds.map((siteId: string) => ({
        siteId,
        userId: user.id,
        assignedRole: targetRole,
      })),
      skipDuplicates: true,
    });
  }

  return res.status(201).json({ data: user });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, actorTm: any) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });

  const targetTm = await prisma.teamMember.findFirst({ where: { teamId: actorTm.teamId, userId } });
  if (!targetTm) return res.status(404).json({ error: { message: 'User not found in team' } });

  if (!canDeleteUser(actorTm.role, actorTm.userId, targetTm.role, userId)) {
    return res.status(403).json({ error: { message: '이 사용자를 삭제할 권한이 없습니다.' } });
  }

  await prisma.teamMember.delete({ where: { id: targetTm.id } });

  const otherMemberships = await prisma.teamMember.count({ where: { userId } });
  if (otherMemberships === 0) {
    await prisma.user.delete({ where: { id: userId } });
  }

  return res.status(200).json({ data: { message: 'User deleted' } });
};
