/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

const INTERNAL_ROLES = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'MEMBER'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const session = await getSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
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

  if (!INTERNAL_ROLES.includes(myRole)) {
    return res.status(403).json({ error: { message: '내부 사용자만 업무일지를 열람할 수 있습니다.' } });
  }

  if (!myTeamId) {
    return res.status(400).json({ error: { message: '소속 회사 정보가 없습니다.' } });
  }

  const q = String(req.query.q || '').trim();
  const targetUserId = String(req.query.targetUserId || '').trim();
  const limit = Math.min(Number(req.query.limit || 20), 50);

  if (targetUserId) {
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        teamMembers: { some: { teamId: myTeamId } },
      },
      select: {
        id: true,
        name: true,
        department: true,
        position: true,
        email: true,
      },
    });

    if (!targetUser) {
      return res.status(404).json({ error: { message: '같은 회사 직원만 열람할 수 있습니다.' } });
    }

    await prisma.workLogViewLog.create({
      data: {
        viewerId: me.id,
        targetUserId: targetUser.id,
        keyword: q || null,
      },
    });

    const workLogs = await prisma.workLog.findMany({
      where: {
        userId: targetUser.id,
        ...(q
          ? {
              content: { contains: q, mode: 'insensitive' },
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            department: true,
            position: true,
          },
        },
      },
    });

    return res.status(200).json({
      data: {
        mode: 'detail',
        targetUser,
        items: workLogs,
      },
    });
  }

  const teamUsers = await prisma.user.findMany({
    where: {
      teamMembers: { some: { teamId: myTeamId } },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { department: { contains: q, mode: 'insensitive' } },
              { position: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      department: true,
      position: true,
      email: true,
      _count: {
        select: {
          workLogs: true,
        },
      },
    },
    orderBy: [{ name: 'asc' }],
    take: 30,
  });

  const recentViews = await prisma.workLogViewLog.findMany({
    where: {
      viewerId: me.id,
      targetUser: {
        teamMembers: { some: { teamId: myTeamId } },
      },
    },
    orderBy: { viewedAt: 'desc' },
    take: 20,
    include: {
      targetUser: {
        select: {
          id: true,
          name: true,
          department: true,
          position: true,
        },
      },
    },
  });

  const dedupedRecentViews = Array.from(
    new Map(
      recentViews.map((item) => [
        item.targetUserId,
        {
          targetUserId: item.targetUserId,
          viewedAt: item.viewedAt,
          keyword: item.keyword,
          targetUser: item.targetUser,
        },
      ])
    ).values()
  );

  return res.status(200).json({
    data: {
      mode: 'search',
      users: teamUsers,
      recentViews: dedupedRecentViews,
    },
  });
}
