import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import {
  canManageGuests,
  getRoleDisplayName,
  isSystemRole,
} from '@/lib/team-helper';

async function getSessionTeamMember(userId: string) {
  return prisma.teamMember.findFirst({
    where: { userId },
    include: { team: { select: { id: true, name: true, slug: true } } },
  });
}

async function getAllowedSites(tm: { role: string; teamId: string; userId: string }) {
  if (tm.role === 'PARTNER') {
    return prisma.siteAssignment.findMany({
      where: { userId: tm.userId },
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

async function handleGET(tm: { role: string; teamId: string; userId: string }, res: NextApiResponse) {
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
            siteAssignments: {
              include: { site: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    getAllowedSites(tm),
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
    siteOptions: siteOptions.map((row) => row.site),
  });
}

async function handlePOST(
  req: NextApiRequest,
  res: NextApiResponse,
  tm: { role: string; teamId: string; userId: string }
) {
  const { name, email, password, role, position, department, siteIds } = req.body || {};

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: { message: '필수값이 누락되었습니다.' } });
  }

  if (!['PARTNER', 'GUEST', 'VIEWER'].includes(role)) {
    return res.status(400).json({ error: { message: '외부 계정만 생성할 수 있습니다.' } });
  }

  const normalizedSiteIds = Array.isArray(siteIds)
    ? siteIds.map((id) => String(id)).filter(Boolean)
    : [];

  if (normalizedSiteIds.length === 0) {
    return res.status(400).json({ error: { message: '현장을 1개 이상 지정해야 합니다.' } });
  }

  if (tm.role === 'PARTNER') {
    const allowedAssignments = await prisma.siteAssignment.findMany({
      where: { userId: tm.userId, siteId: { in: normalizedSiteIds } },
      select: { siteId: true },
    });

    const allowedSet = new Set(allowedAssignments.map((a) => a.siteId));
    const hasForbidden = normalizedSiteIds.some((id) => !allowedSet.has(id));
    if (hasForbidden) {
      return res.status(403).json({ error: { message: '협력사는 본인 배정 현장 안에서만 게스트를 생성할 수 있습니다.' } });
    }
  } else {
    const companySites = await prisma.site.findMany({
      where: { id: { in: normalizedSiteIds }, teamId: tm.teamId },
      select: { id: true },
    });
    if (companySites.length !== normalizedSiteIds.length) {
      return res.status(400).json({ error: { message: '다른 회사 현장은 지정할 수 없습니다.' } });
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: { message: '이미 사용 중인 이메일입니다.' } });
  }

  const passwordHash = await hashPassword(password);

  const created = await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      company: tm.teamId,
      department: department || null,
      position: position || null,
      teamMembers: {
        create: {
          teamId: tm.teamId,
          role,
        },
      },
      siteAssignments: {
        create: normalizedSiteIds.map((siteId: string) => ({ siteId })),
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return res.status(201).json({ data: created });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const tm = await getSessionTeamMember(session.user.id);
  if (!tm) {
    return res.status(403).json({ error: { message: 'No team membership' } });
  }

  if (!canManageGuests(tm.role)) {
    return res.status(403).json({ error: { message: '게스트 관리 권한이 없습니다.' } });
  }

  try {
    if (req.method === 'GET') {
      return await handleGET({ role: tm.role, teamId: tm.teamId, userId: tm.userId }, res);
    }
    if (req.method === 'POST') {
      return await handlePOST(req, res, { role: tm.role, teamId: tm.teamId, userId: tm.userId });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
  } catch (error: any) {
    return res.status(500).json({ error: { message: error?.message || 'Internal server error' } });
  }
}
