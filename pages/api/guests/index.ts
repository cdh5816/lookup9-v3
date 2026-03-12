/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

const EXTERNAL_ROLES = ['PARTNER', 'GUEST', 'VIEWER'] as const;
const CREATOR_ROLES = ['ADMIN_HR', 'MANAGER', 'USER', 'PARTNER'] as const;

type CreatorRole = (typeof CREATOR_ROLES)[number] | 'SUPER_ADMIN' | 'OWNER' | 'ADMIN';

function canCreateGuest(role: string) {
  return [...CREATOR_ROLES, 'SUPER_ADMIN', 'OWNER', 'ADMIN'].includes(role as CreatorRole);
}

function isExternalRole(role: string) {
  return EXTERNAL_ROLES.includes(role as (typeof EXTERNAL_ROLES)[number]);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      company: true,
      teamMembers: {
        take: 1,
        select: {
          role: true,
          teamId: true,
        },
      },
    },
  });

  const myTeamMember = me?.teamMembers?.[0];
  const myRole = myTeamMember?.role || 'USER';
  const myTeamId = myTeamMember?.teamId;

  if (!myTeamId) {
    return res.status(400).json({ error: { message: '소속 회사 정보가 없습니다.' } });
  }

  if (!canCreateGuest(myRole)) {
    return res.status(403).json({ error: { message: '게스트를 생성할 권한이 없습니다.' } });
  }

  if (req.method === 'GET') {
    const users = await prisma.user.findMany({
      where: {
        teamMembers: {
          some: {
            teamId: myTeamId,
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
        createdAt: true,
        siteAssignments: {
          select: {
            site: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        teamMembers: {
          take: 1,
          select: {
            role: true,
          },
        },
      },
    });

    return res.status(200).json({ data: users });
  }

  if (req.method === 'POST') {
    const {
      name,
      email,
      password,
      phone,
      role = 'GUEST',
      siteIds = [],
    } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: { message: '이름, 이메일, 비밀번호는 필수입니다.' } });
    }

    if (!isExternalRole(role)) {
      return res.status(400).json({ error: { message: '게스트/협력사 역할만 생성할 수 있습니다.' } });
    }

    if (!Array.isArray(siteIds) || siteIds.length === 0) {
      return res.status(400).json({ error: { message: '최소 1개 이상 현장을 지정해야 합니다.' } });
    }

    const allowedSites = await prisma.site.findMany({
      where: {
        id: { in: siteIds },
        teamId: myTeamId,
      },
      select: { id: true },
    });

    const allowedSiteIds = allowedSites.map((s) => s.id);

    if (allowedSiteIds.length !== siteIds.length) {
      return res.status(400).json({ error: { message: '같은 회사 현장만 지정할 수 있습니다.' } });
    }

    if (myRole === 'PARTNER') {
      const myAssignments = await prisma.siteAssignment.findMany({
        where: { userId: session.user.id },
        select: { siteId: true },
      });
      const mySiteIds = new Set(myAssignments.map((a) => a.siteId));
      const invalid = allowedSiteIds.some((siteId) => !mySiteIds.has(siteId));
      if (invalid) {
        return res.status(403).json({ error: { message: '협력사는 본인 배정 현장 안에서만 게스트를 생성할 수 있습니다.' } });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: { message: '이미 존재하는 이메일입니다.' } });
    }

    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
        company: me?.company || null,
        department: role === 'PARTNER' ? '협력사' : '게스트',
        position: null,
        teamMembers: {
          create: {
            role,
            teamId: myTeamId,
          },
        },
        siteAssignments: {
          create: allowedSiteIds.map((siteId) => ({ siteId })),
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return res.status(200).json({ data: created });
  }

  return res.status(405).json({ error: { message: 'Method not allowed' } });
}
