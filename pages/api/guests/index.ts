import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import {
  canAssignRole,
  canManageGuests,
  getTeamMemberByUserId,
  isSystemRole,
} from '@/lib/team-helper';

const ALLOWED_GUEST_ROLES = ['PARTNER', 'GUEST', 'VIEWER'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const actor = await getTeamMemberByUserId(session.user.id);
  if (!actor) {
    return res.status(403).json({ error: { message: '팀 정보가 없습니다.' } });
  }

  if (!canManageGuests(actor.role)) {
    return res.status(403).json({ error: { message: '게스트를 관리할 권한이 없습니다.' } });
  }

  if (req.method === 'GET') {
    const sites = await prisma.site.findMany({
      where: {
        teamId: actor.teamId,
        ...(actor.role === 'PARTNER'
          ? {
              assignments: {
                some: { userId: session.user.id },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const users = await prisma.user.findMany({
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
          select: {
            siteId: true,
            site: { select: { id: true, name: true } },
          },
        },
        teamMembers: {
          where: { teamId: actor.teamId },
          select: { role: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ data: { sites, users } });
  }

  if (req.method === 'POST') {
    const {
      name,
      email,
      password,
      role = 'GUEST',
      siteIds = [],
      company,
      department,
      position,
      phone,
    } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: { message: '이름, 이메일, 비밀번호는 필수입니다.' } });
    }

    if (!ALLOWED_GUEST_ROLES.includes(role)) {
      return res.status(400).json({ error: { message: '외부 계정 역할만 생성할 수 있습니다.' } });
    }

    if (!canAssignRole(actor.role, role)) {
      return res.status(403).json({ error: { message: '해당 역할을 생성할 권한이 없습니다.' } });
    }

    if (!Array.isArray(siteIds) || siteIds.length === 0) {
      return res.status(400).json({ error: { message: '현장을 1개 이상 지정해야 합니다.' } });
    }

    const allowedSites = await prisma.site.findMany({
      where: {
        id: { in: siteIds },
        teamId: actor.teamId,
        ...(actor.role === 'PARTNER'
          ? {
              assignments: {
                some: { userId: session.user.id },
              },
            }
          : {}),
      },
      select: { id: true },
    });

    if (allowedSites.length !== siteIds.length) {
      return res.status(403).json({ error: { message: '지정할 수 없는 현장이 포함되어 있습니다.' } });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: { message: '이미 사용 중인 이메일입니다.' } });
    }

    const hashed = await hashPassword(password);

    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        company: company || actor.user?.company || actor.team.name,
        department: department || (role === 'PARTNER' ? '협력사' : '게스트'),
        position: position || null,
        phone: phone || null,
        teamMembers: {
          create: {
            teamId: actor.teamId,
            role,
          },
        },
      },
      select: { id: true, name: true, email: true },
    });

    if (siteIds.length > 0) {
      await prisma.siteAssignment.createMany({
        data: siteIds.map((siteId: string) => ({
          siteId,
          userId: created.id,
          assignedRole: role,
        })),
        skipDuplicates: true,
      });
    }

    const notifyUsers = await prisma.siteAssignment.findMany({
      where: { siteId: { in: siteIds } },
      select: { userId: true },
      distinct: ['userId'],
    });

    const notifyIds = notifyUsers
      .map((x) => x.userId)
      .filter((uid) => uid !== created.id && uid !== session.user.id);

    if (notifyIds.length > 0) {
      await prisma.notification.createMany({
        data: notifyIds.map((userId) => ({
          userId,
          type: 'guest-created',
          title: '외부 계정이 생성되었습니다.',
          message: `${name} 계정이 생성되고 현장에 배정되었습니다.`,
          entityType: 'user',
          entityId: created.id,
        })),
        skipDuplicates: true,
      });
    }

    return res.status(201).json({ data: created });
  }

  return res.status(405).json({ error: { message: 'Method not allowed' } });
}
