import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';

const CREATABLE_ROLES = ['PARTNER', 'GUEST', 'VIEWER'] as const;
const MANAGEABLE_ACTOR_ROLES = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'PARTNER'] as const;

type CreatableRole = (typeof CREATABLE_ROLES)[number];

function isCreatableRole(role: string): role is CreatableRole {
  return (CREATABLE_ROLES as readonly string[]).includes(role);
}

function canActorManageGuests(role: string) {
  return (MANAGEABLE_ACTOR_ROLES as readonly string[]).includes(role);
}

function getCreatableRolesForActor(role: string): string[] {
  if (['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER'].includes(role)) {
    return ['PARTNER', 'GUEST', 'VIEWER'];
  }
  if (role === 'PARTNER') {
    return ['GUEST', 'VIEWER'];
  }
  return [];
}

async function getActorContext(userId: string) {
  return prisma.teamMember.findFirst({
    where: { userId },
    include: { team: { select: { id: true, name: true, slug: true } } },
  });
}

async function getVisibleSiteIds(userId: string, role: string, teamId: string) {
  if (['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER'].includes(role)) {
    const sites = await prisma.site.findMany({ where: { teamId }, select: { id: true } });
    return sites.map((s) => s.id);
  }
  if (role === 'PARTNER') {
    const assignments = await prisma.siteAssignment.findMany({
      where: { userId, site: { teamId } },
      select: { siteId: true },
    });
    return assignments.map((a) => a.siteId);
  }
  return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const actor = await getActorContext(session.user.id);
  if (!actor?.teamId || !actor?.role) {
    return res.status(403).json({ error: { message: '소속 회사 정보가 없습니다.' } });
  }

  if (!canActorManageGuests(actor.role)) {
    return res.status(403).json({ error: { message: '게스트를 관리할 권한이 없습니다.' } });
  }

  const teamId = actor.teamId;
  const actorRole = actor.role;
  const visibleSiteIds = await getVisibleSiteIds(session.user.id, actorRole, teamId);

  // ── GET ──
  if (req.method === 'GET') {
    const users = await prisma.user.findMany({
      where: {
        teamMembers: {
          some: {
            teamId,
            role: { in: ['PARTNER', 'GUEST', 'VIEWER'] },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        department: true,
        position: true,
        phone: true,
        createdAt: true,
        teamMembers: {
          where: { teamId },
          select: { role: true },
          take: 1,
        },
        siteAssignments: {
          where: { site: { teamId } },
          select: {
            siteId: true,
            site: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });

    // 현장 목록 (현장 지정용)
    const siteOptions = await prisma.site.findMany({
      where: { id: { in: visibleSiteIds } },
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });

    const creatableRoles = getCreatableRolesForActor(actorRole);

    const formatted = users.map((u) => ({
      ...u,
      role: u.teamMembers[0]?.role || 'GUEST',
      assignedSites: u.siteAssignments.map((a) => a.site),
    }));

    return res.status(200).json({
      data: formatted,
      meta: { siteOptions, creatableRoles },
    });
  }

  // ── POST ──
  if (req.method === 'POST') {
    const { name, email, password, company, department, position, phone, role, siteIds } = req.body || {};

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: { message: '필수값이 비어 있습니다.' } });
    }

    if (!isCreatableRole(role)) {
      return res.status(400).json({ error: { message: '생성 가능한 외부 역할이 아닙니다.' } });
    }

    // 역할 생성 권한 확인
    const creatableForActor = getCreatableRolesForActor(actorRole);
    if (!creatableForActor.includes(role)) {
      return res.status(403).json({ error: { message: `${actorRole}는 ${role} 역할을 생성할 수 없습니다.` } });
    }

    const normalizedSiteIds = Array.isArray(siteIds)
      ? Array.from(new Set(siteIds.filter((v: unknown) => typeof v === 'string' && v)))
      : [];

    if (normalizedSiteIds.length === 0) {
      return res.status(400).json({ error: { message: '현장을 1개 이상 지정해야 합니다.' } });
    }

    const disallowedSiteIds = normalizedSiteIds.filter((id) => !visibleSiteIds.includes(id));
    if (disallowedSiteIds.length > 0) {
      return res.status(403).json({ error: { message: '지정할 수 없는 현장이 포함되어 있습니다.' } });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: { message: '이미 사용 중인 이메일입니다.' } });
    }

    const hashedPassword = await hashPassword(password);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          company: company || actor.team?.name || null,
          department: department || (role === 'PARTNER' ? '협력사' : '게스트'),
          position: position || null,
          phone: phone || null,
        },
      });

      await tx.teamMember.create({
        data: { teamId, userId: user.id, role },
      });

      await tx.siteAssignment.createMany({
        data: normalizedSiteIds.map((siteId: string) => ({
          siteId,
          userId: user.id,
          assignedRole: role,
        })),
      });

      return user;
    });

    return res.status(201).json({ data: created });
  }

  // ── DELETE ──
  if (req.method === 'DELETE') {
    const id = String(req.query.id || '').trim();
    if (!id) return res.status(400).json({ error: { message: '삭제할 계정 ID가 없습니다.' } });

    const target = await prisma.user.findFirst({
      where: {
        id,
        teamMembers: { some: { teamId, role: { in: ['PARTNER', 'GUEST', 'VIEWER'] } } },
      },
      select: { id: true, email: true, name: true },
    });

    if (!target) return res.status(404).json({ error: { message: '대상 계정을 찾을 수 없습니다.' } });

    try {
      await prisma.$transaction(async (tx) => {
        await tx.siteAssignment.deleteMany({ where: { userId: target.id } });
        await tx.teamMember.deleteMany({ where: { userId: target.id, teamId } });
        await tx.account.deleteMany({ where: { userId: target.id } });
        await tx.session.deleteMany({ where: { userId: target.id } });

        const remainTeams = await tx.teamMember.count({ where: { userId: target.id } });
        if (remainTeams === 0) {
          try {
            await tx.user.delete({ where: { id: target.id } });
          } catch {
            await tx.user.update({
              where: { id: target.id },
              data: {
                email: `deleted_${Date.now()}_${target.email}`,
                name: `[삭제됨] ${target.name}`,
                password: null,
              },
            });
          }
        }
      });
      return res.status(200).json({ ok: true });
    } catch (error: any) {
      return res.status(500).json({ error: { message: error.message || '삭제에 실패했습니다.' } });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: { message: 'Method not allowed' } });
}
