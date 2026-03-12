import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { canManageGuests, getTeamMemberByUserId, getRoleDisplayName, isSystemRole } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });
  if (!canManageGuests(tm.role)) return res.status(403).json({ error: { message: '게스트 관리 권한이 없습니다.' } });

  try {
    switch (req.method) {
      case 'GET':
        return await handleGET(tm, res);
      case 'POST':
        return await handlePOST(req, res, tm);
      default:
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

async function getAllowedSites(tm: any, userId?: string) {
  if (tm.role === 'PARTNER') {
    return prisma.siteAssignment.findMany({
      where: { userId: userId || tm.userId || undefined },
      include: { site: { select: { id: true, name: true, status: true } } },
      orderBy: { assignedAt: 'desc' },
    });
  }

  const sites = await prisma.site.findMany({
    where: { teamId: tm.teamId },
    select: { id: true, name: true, status: true },
    orderBy: { updatedAt: 'desc' },
  });
  return sites.map((site) => ({ site }));
}

const handleGET = async (tm: any, res: NextApiResponse) => {
  const [members, siteOptions] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId: tm.teamId, role: { in: ['GUEST', 'VIEWER', 'PARTNER'] } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            position: true,
            department: true,
            company: true,
            createdAt: true,
            siteAssignments: { include: { site: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    getAllowedSites(tm, tm.userId),
  ]);

  const data = members
    .filter((m) => !isSystemRole(m.role))
    .map((m) => ({
      ...m.user,
      role: m.role,
      roleLabel: getRoleDisplayName(m.role),
      assignedSites: m.user.siteAssignments
        .map((a) => ({ id: a.site?.id, name: a.site?.name }))
        .filter((a) => a.id),
    }));

  return res.status(200).json({
    data,
    meta: {
      siteOptions: siteOptions.map((row: any) => row.site),
      creatableRoles: tm.role === 'PARTNER' ? ['GUEST', 'VIEWER'] : ['PARTNER', 'GUEST', 'VIEWER'],
    },
  });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, tm: any) => {
  const { name, email, password, position, phone, company, role, siteIds } = req.body;
  const targetRole = String(role || 'GUEST');

  if (!name || !email || !password) {
    return res.status(400).json({ error: { message: '이름, 이메일, 비밀번호는 필수입니다.' } });
  }
  if (!Array.isArray(siteIds) || siteIds.length === 0) {
    return res.status(400).json({ error: { message: '최소 1개 현장을 지정해야 합니다.' } });
  }
  if (tm.role === 'PARTNER' && targetRole === 'PARTNER') {
    return res.status(403).json({ error: { message: '협력사는 다른 협력사 계정을 만들 수 없습니다.' } });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ error: { message: '이미 존재하는 이메일입니다.' } });
  }

  const allowedSiteRows = await getAllowedSites(tm, tm.userId);
  const allowedSiteIds = new Set(allowedSiteRows.map((row: any) => row.site?.id).filter(Boolean));
  const normalizedSiteIds = siteIds.filter((id: string) => allowedSiteIds.has(id));
  if (normalizedSiteIds.length === 0) {
    return res.status(400).json({ error: { message: '지정 가능한 현장이 없습니다.' } });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: await hashPassword(password),
      position: position || null,
      phone: phone || null,
      company: company || null,
      department: targetRole === 'PARTNER' ? '협력사' : '외부열람',
    },
  });

  await prisma.teamMember.create({ data: { teamId: tm.teamId, userId: user.id, role: targetRole } });
  await prisma.siteAssignment.createMany({
    data: normalizedSiteIds.map((siteId: string) => ({ siteId, userId: user.id, assignedRole: targetRole })),
    skipDuplicates: true,
  });

  return res.status(201).json({ data: user });
};
