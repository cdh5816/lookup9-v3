import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';

type SessionUser = {
  id: string;
  email?: string | null;
};

const EXTERNAL_ROLES = ['PARTNER', 'GUEST', 'VIEWER'] as const;
const INTERNAL_MANAGER_ROLES = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER'] as const;

function canManageGuests(role?: string | null): boolean {
  return !!role && INTERNAL_MANAGER_ROLES.includes(role as (typeof INTERNAL_MANAGER_ROLES)[number]);
}

function isCompanyAdminRole(role?: string | null): boolean {
  return role === 'ADMIN_HR';
}

async function getActor(req: NextApiRequest, res: NextApiResponse): Promise<{
  user: SessionUser;
  role: string;
  teamId: string;
  assignedSiteIds: string[];
} | null> {
  const session = await getSession(req, res);
  const sessionUser = session?.user as SessionUser | undefined;
  if (!sessionUser?.id) return null;

  const teamMember = await prisma.teamMember.findFirst({
    where: { userId: sessionUser.id },
    select: { role: true, teamId: true },
  });

  if (!teamMember?.teamId) return null;

  const assignments = await prisma.siteAssignment.findMany({
    where: { userId: sessionUser.id, site: { teamId: teamMember.teamId } },
    select: { siteId: true },
  });

  return {
    user: sessionUser,
    role: teamMember.role,
    teamId: teamMember.teamId,
    assignedSiteIds: assignments.map((a) => a.siteId),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getActor(req, res);
  if (!actor) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  if (!canManageGuests(actor.role)) {
    return res.status(403).json({ error: { message: '게스트를 관리할 권한이 없습니다.' } });
  }

  if (req.method === 'GET') {
    const whereForVisibleSites = isCompanyAdminRole(actor.role)
      ? { teamId: actor.teamId }
      : { teamId: actor.teamId, id: { in: actor.assignedSiteIds.length ? actor.assignedSiteIds : ['__never__'] } };

    const [sites, users] = await Promise.all([
      prisma.site.findMany({
        where: whereForVisibleSites,
        select: { id: true, name: true, status: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          teamMembers: {
            some: {
              teamId: actor.teamId,
              role: { in: ['PARTNER', 'GUEST', 'VIEWER'] },
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          department: true,
          position: true,
          siteAssignments: {
            where: { site: { teamId: actor.teamId } },
            select: { siteId: true, site: { select: { id: true, name: true } } },
          },
          teamMembers: {
            where: { teamId: actor.teamId },
            select: { role: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return res.status(200).json({ data: { sites, users } });
  }

  if (req.method === 'POST') {
    const {
      name,
      email,
      password,
      phone,
      company,
      department,
      position,
      role,
      siteIds,
    } = req.body ?? {};

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: { message: '필수값이 없습니다.' } });
    }

    if (!EXTERNAL_ROLES.includes(role)) {
      return res.status(400).json({ error: { message: '외부 계정만 생성할 수 있습니다.' } });
    }

    const normalizedSiteIds = Array.isArray(siteIds)
      ? [...new Set(siteIds.filter((v: unknown) => typeof v === 'string' && v))]
      : [];

    if (normalizedSiteIds.length === 0) {
      return res.status(400).json({ error: { message: '최소 1개 현장을 지정해야 합니다.' } });
    }

    const visibleSiteWhere = isCompanyAdminRole(actor.role)
      ? { teamId: actor.teamId, id: { in: normalizedSiteIds } }
      : {
          teamId: actor.teamId,
          id: { in: normalizedSiteIds.filter((id) => actor.assignedSiteIds.includes(id)) },
        };

    const visibleSites = await prisma.site.findMany({
      where: visibleSiteWhere,
      select: { id: true },
    });

    if (visibleSites.length !== normalizedSiteIds.length) {
      return res.status(403).json({ error: { message: '지정할 수 없는 현장이 포함되어 있습니다.' } });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: { message: '이미 사용 중인 이메일입니다.' } });
    }

    const hashedPassword = await hashPassword(password);

    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
        company: company || null,
        department: department || '외부',
        position: position || null,
        teamMembers: {
          create: {
            teamId: actor.teamId,
            role,
          },
        },
        siteAssignments: {
          create: normalizedSiteIds.map((siteId: string) => ({ siteId })),
        },
      },
      select: { id: true, name: true, email: true },
    });

    return res.status(200).json({ data: created });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    const userId = typeof id === 'string' ? id : '';
    if (!userId) {
      return res.status(400).json({ error: { message: '삭제할 계정이 없습니다.' } });
    }

    const target = await prisma.user.findFirst({
      where: {
        id: userId,
        teamMembers: {
          some: {
            teamId: actor.teamId,
            role: { in: ['PARTNER', 'GUEST', 'VIEWER'] },
          },
        },
      },
      select: { id: true },
    });

    if (!target) {
      return res.status(404).json({ error: { message: '대상 계정을 찾을 수 없습니다.' } });
    }

    await prisma.$transaction(async (tx) => {
      await tx.siteAssignment.deleteMany({ where: { userId } });
      await tx.teamMember.deleteMany({ where: { userId, teamId: actor.teamId } });
      try {
        await tx.session.deleteMany({ where: { userId } });
      } catch {}
      const remainTeams = await tx.teamMember.count({ where: { userId } });
      if (remainTeams === 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            email: `deleted_${userId}@lookup9.local`,
            name: '삭제된 계정',
            company: null,
            department: null,
            position: null,
            phone: null,
            password: await hashPassword(`${userId}_disabled`),
          },
        });
      }
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: { message: 'Method not allowed' } });
}
