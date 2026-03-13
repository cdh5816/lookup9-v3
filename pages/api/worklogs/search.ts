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
      teamMembers: { select: { role: true, teamId: true }, take: 1 },
    },
  });

  const myTeamMember = me?.teamMembers?.[0];
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
  const month = String(req.query.month || '').trim(); // YYYY-MM
  const limit = Math.min(Number(req.query.limit || 30), 100);

  // ── 특정 직원 업무일지 상세 조회 ──
  if (targetUserId) {
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        teamMembers: { some: { teamId: myTeamId } },
      },
      select: { id: true, name: true, department: true, position: true, email: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: { message: '같은 회사 직원만 열람할 수 있습니다.' } });
    }

    // 열람 로그 기록 (비동기, 실패해도 무시)
    prisma.workLogViewLog.create({
      data: {
        viewerId: session.user.id,
        targetUserId,
        keyword: q || null,
      },
    }).catch(() => {});

    // 날짜 범위 계산
    let dateFilter: any = {};
    if (month) {
      const start = new Date(`${month}-01`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      dateFilter = { gte: start, lt: end };
    }

    const logs = await prisma.workLog.findMany({
      where: {
        userId: targetUser.id,
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
        ...(q ? { content: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    return res.status(200).json({
      data: {
        mode: 'detail',
        targetUser,
        items: logs,
      },
    });
  }

  // ── 직원 검색 ──
  const teamUsers = await prisma.user.findMany({
    where: {
      teamMembers: { some: { teamId: myTeamId } },
      id: { not: session.user.id }, // 자기 자신 제외
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { department: { contains: q, mode: 'insensitive' as const } },
              { position: { contains: q, mode: 'insensitive' as const } },
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
      _count: { select: { workLogs: true } },
    },
    orderBy: [{ name: 'asc' }],
    take: 30,
  });

  return res.status(200).json({ data: { mode: 'search', users: teamUsers } });
}
