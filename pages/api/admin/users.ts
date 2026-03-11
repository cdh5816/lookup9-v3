/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId, hasMinRole, canDeleteUser, canAssignRole } from '@/lib/team-helper';
import { isSuperRole, getRoleDisplayName } from '@/lib/lookup9-role';

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
  const members = await prisma.teamMember.findMany({
    where: { teamId, role: { notIn: ['SUPER_ADMIN', 'OWNER'] } },
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
          siteAssignments: { select: { siteId: true } },
        },
      },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
  });

  const users = members.map((m) => ({
    ...m.user,
    teamMembers: [{ role: m.role, roleLabel: getRoleDisplayName(m.role), team: { name: '' } }],
  }));

  return res.status(200).json({ data: users });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, actorTm: any) => {
  const { name, email, password, company, department, position, phone, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: { message: 'Name, email, password are required' } });

  const targetRole = role || 'USER';
  if (!canAssignRole(actorTm.role, targetRole)) {
    return res.status(403).json({ error: { message: `${targetRole} 역할을 부여할 수 없습니다.` } });
  }

  if (targetRole === 'ADMIN_HR') {
    const existingCompanyAdmin = await prisma.teamMember.findFirst({
      where: { teamId: actorTm.teamId, role: 'ADMIN_HR' },
      select: { id: true },
    });
    if (existingCompanyAdmin) {
      return res.status(400).json({ error: { message: '한 회사에는 COMPANY_ADMIN 계정 1개만 생성할 수 있습니다.' } });
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
      company: company || actorTm.team?.name || null,
      department: department || null,
      position: position || null,
      phone: phone || null,
    },
  });

  await prisma.teamMember.create({
    data: { teamId: actorTm.teamId, userId: user.id, role: targetRole },
  });

  return res.status(201).json({ data: user });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, actorTm: any) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });

  const targetTm = await prisma.teamMember.findFirst({ where: { teamId: actorTm.teamId, userId } });
  if (!targetTm) return res.status(404).json({ error: { message: 'User not found in team' } });
  if (isSuperRole(targetTm.role)) return res.status(403).json({ error: { message: 'SUPER_ADMIN 계정은 접근할 수 없습니다.' } });

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
