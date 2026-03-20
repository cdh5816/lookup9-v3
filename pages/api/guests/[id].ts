import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  // MANAGER 이상만 삭제 가능
  const allowedRoles = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'];
  if (!allowedRoles.includes(tm.role)) {
    return res.status(403).json({ error: { message: '게스트 삭제 권한이 없습니다.' } });
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: { message: 'Guest ID is required' } });
  }

  try {
    // 대상 유저가 같은 팀의 GUEST/VIEWER인지 확인
    const targetMember = await prisma.teamMember.findFirst({
      where: {
        userId: id,
        teamId: tm.teamId,
        role: { in: ['GUEST', 'VIEWER'] },
      },
    });

    if (!targetMember) {
      return res.status(404).json({ error: { message: '해당 게스트를 찾을 수 없습니다.' } });
    }

    // 트랜잭션: 배정 해제 → 팀멤버 삭제 → 유저 삭제
    await prisma.$transaction(async (tx) => {
      // 현장 배정 해제
      await tx.siteAssignment.deleteMany({ where: { userId: id } });
      // 팀 멤버 삭제
      await tx.teamMember.deleteMany({ where: { userId: id, teamId: tm.teamId } });
      // 유저 삭제
      await tx.user.delete({ where: { id } });
    });

    return res.status(200).json({ data: { deleted: true } });
  } catch (error: any) {
    console.error('Guest delete error:', error);
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
