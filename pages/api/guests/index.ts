/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import {
  canManageGuests,
  getTeamMemberByUserId,
  getRoleDisplayName,
} from '@/lib/team-helper';

const EXTERNAL_ROLES = ['PARTNER', 'GUEST', 'VIEWER'];
const ALLOWED_CREATE_ROLES = ['PARTNER', 'GUEST', 'VIEWER'];

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
        select: { role: true, teamId: true },
        take: 1,
      },
    },
  });

  if (!me) {
    return res.status(404).json({ error: { message: 'User not found' } });
  }

  const myTeamMember = me.teamMembers?.[0];
  const myRole = myTeamMember?.role || 'USER';
  const myTeamId = myTeamMember?.teamId;

  if (!myTeamId) {
    return res.status(400).json({ error: { message: '소속 회사 정보가 없습니다.' } });
  }

  if (req.method === 'GET') {
    if (!canManageGuests(myRole)) {
      return res.status(403).json({ error: { message: '게스트를 관리할 권한이 없습니다.' } });
    }

    const manageableSiteIds = await getManageableSiteIds(session.user.id, myRole, myTeamId);

    const users = await prisma.user.findMany({
      where: {
        teamMembers: { some: { teamId: myTeamId, role: { in: EXTERNAL_ROLES } } },
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
        siteAssignments: {
          where: {
            site: myRole === 'PARTNER' ? { id: { in: manageableSiteIds } } : { teamId: myTeamId },
          },
          select: {
            siteId: true,
            site: { select: { id: true, name: true } },
          },
        },
        teamMembers: {
          select: { role: true },
          take: 1,
        },
      },
    });

    const sites = await prisma.site.findMany({
      where: myRole === 'PARTNER' ? { id: { in: manageableSiteIds } } : { teamId: myTeamId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, status: true },
    });

    return res.status(200).json({ data: { users, sites } });
  }

  if (req.method === 'POST') {
    if (!canManageGuests(myRole)) {
      return res.status(403).json({ error: { message: '게스트를 생성할 권한이 없습니다.' } });
    }

    const { name, email, password, role, phone, siteIds } = req.body || {};

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: { message: '이름, 이메일, 비밀번호, 권한은 필수입니다.' } });
    }

    if (!ALLOWED_CREATE_ROLES.includes(role)) {
      return res.status(400).json({ error: { message: '게스트/협력사 계정만 생성할 수 있습니다.' } });
    }

    const normalizedSiteIds = Array.isArray(siteIds)
      ? Array.from(new Set(siteIds.filter(Boolean)))
      : [];

    if (normalizedSiteIds.length === 0) {
      return res.status(400).json({ error: { message: '현장을 1개 이상 지정해야 합니다.' } });
    }

    const manageableSiteIds = await getManageableSiteIds(session.user.id, myRole, myTeamId);
    const creatableSiteIds = myRole === 'PARTNER' ? manageableSiteIds : normalizedSiteIds;

    const invalidSiteIds = normalizedSiteIds.filter((id: string) => !creatableSiteIds.includes(id));
    if (invalidSiteIds.length > 0) {
      return res.status(403).json({ error: { message: '권한이 없는 현장이 포함되어 있습니다.' } });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: { message: '이미 존재하는 이메일입니다.' } });
    }

    const passwordHash = await hashPassword(password);

    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        company: me.company,
        department: role === 'PARTNER' ? '협력사' : '게스트',
        position: getRoleDisplayName(role),
        phone: phone || null,
        teamMembers: {
          create: {
            role,
            teamId: myTeamId,
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

  if (req.method === 'DELETE') {
    if (!canManageGuests(myRole)) {
      return res.status(403).json({ error: { message: '게스트를 삭제할 권한이 없습니다.' } });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: { message: '삭제할 계정 ID가 필요합니다.' } });
    }

    const target = await prisma.user.findFirst({
      where: {
        id,
        teamMembers: { some: { teamId: myTeamId, role: { in: EXTERNAL_ROLES } } },
      },
      select: { id: true },
    });

    if (!target) {
      return res.status(404).json({ error: { message: '삭제할 계정을 찾을 수 없습니다.' } });
    }

    await prisma.siteAssignment.deleteMany({ where: { userId: id } });
    await prisma.teamMember.deleteMany({ where: { userId: id } });
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.message.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } });
    await prisma.notification.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: { message: 'Method not allowed' } });
}

async function getManageableSiteIds(userId: string, role: string, teamId: string) {
  if (role !== 'PARTNER') {
    const sites = await prisma.site.findMany({
      where: { teamId },
      select: { id: true },
    });
    return sites.map((site) => site.id);
  }

  const assignments = await prisma.siteAssignment.findMany({
    where: { userId, site: { teamId } },
    select: { siteId: true },
  });
  return assignments.map((a) => a.siteId);
}
