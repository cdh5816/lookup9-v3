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
  const limit = Math.min(Number(req.query.limit || 20), 50);

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

    const comments = await prisma.comment.findMany({
      where: {
        authorId: targetUser.id,
        site: { teamId: myTeamId },
        ...(q
          ? {
              OR: [
                { content: { contains: q, mode: 'insensitive' } },
                { site: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        site: { select: { id: true, name: true, status: true } },
        author: { select: { id: true, name: true, department: true, position: true } },
      },
    });

    return res.status(200).json({
      data: {
        mode: 'detail',
        targetUser,
        items: comments,
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
      _count: { select: { comments: true } },
    },
    orderBy: [{ name: 'asc' }],
    take: 30,
  });

  return res.status(200).json({ data: { mode: 'search', users: teamUsers } });
}
