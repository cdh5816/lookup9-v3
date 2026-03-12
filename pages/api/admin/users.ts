import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import {
  getTeamMemberByUserId,
  hasMinRole,
  canDeleteUser,
  canAssignRole,
  hasCompanyAdmin,
} from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });
  if (!hasMinRole(tm.role, 'ADMIN_HR') && tm.role !== 'MANAGER') {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  const teamId = tm.teamId;

  try {
    switch (req.method) {
      case 'GET':
        return await handleGET(teamId, res);
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

const handleGET = async (teamId: string, res: NextApiResponse) => {
  const [members, sites, hasAdmin] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: { id: true, name: true, email: true, company: true, department: true, position: true, phone: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.site.findMany({
      where: { teamId },
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: 'desc' },
    }),
    hasCompanyAdmin(teamId),
  ]);

  const users = await Promise.all(
    members.map(async (m) => {
      const siteAssignments = await prisma.siteAssignment.findMany({
        where: { userId: m.userId },
        include: { site: { select: { id: true, name: true } } },
      });

      return {
        ...m.user,
        siteAssignments,
        teamMembers: [{ role: m.role, team: { name: m.teamId } }],
      };
    })
  );

  return res.status(200).json({ data: users, meta: { hasCompanyAdmin: hasAdmin, sites } });
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
    const exists = await hasCompanyAdmin(actorTm.teamId);
    if (exists) {
      return res.status(400).json({ error: { message: 'COMPANY_ADMIN은 회사당 1명만 생성할 수 있습니다.' } });
    }
  }

  const isExternal = ['PARTNER', 'GUEST', 'VIEWER'].includes(targetRole);
  if (isExternal && (!Array.isArray(siteIds) || siteIds.length === 0)) {
    return res.status(400).json({ error: { message: '외부 계정은 최소 1개 이상 현장을 지정해야 합니다.' } });
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

  if (isExternal) {
    const validSites = await prisma.site.findMany({
      where: { id: { in: siteIds || [] }, teamId: actorTm.teamId },
      select: { id: true },
    });

    if (validSites.length > 0) {
      await prisma.siteAssignment.createMany({
        data: validSites.map((site) => ({
          siteId: site.id,
          userId: user.id,
          assignedRole: targetRole,
        })),
        skipDuplicates: true,
      });
    }
  }

  return res.status(201).json({ data: user });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, actorTm: any) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });

  const targetTm = await prisma.teamMember.findFirst({
    where: { teamId: actorTm.teamId, userId },
  });
  if (!targetTm) return res.status(404).json({ error: { message: 'User not found in team' } });

  if (!canDeleteUser(actorTm.role, actorTm.userId, targetTm.role, userId)) {
    return res.status(403).json({ error: { message: '이 사용자를 삭제할 권한이 없습니다.' } });
  }

  await prisma.siteAssignment.deleteMany({ where: { userId } });
  await prisma.teamMember.delete({ where: { id: targetTm.id } });

  const otherMemberships = await prisma.teamMember.count({ where: { userId } });
  if (otherMemberships === 0) {
    await prisma.user.delete({ where: { id: userId } });
  }

  return res.status(200).json({ data: { message: 'User deleted' } });
};
