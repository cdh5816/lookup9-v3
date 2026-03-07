import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId, hasMinRole } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  try {
    switch (req.method) {
      case 'GET': {
        const { userId } = req.query;
        const targetId = (userId && hasMinRole(tm.role, 'ADMIN_HR')) ? userId as string : session.user.id;
        const year = new Date().getFullYear();

        let balance = await prisma.leaveBalance.findUnique({
          where: { userId_year: { userId: targetId, year } },
        });

        // 없으면 자동 생성 (기본 15일)
        if (!balance) {
          balance = await prisma.leaveBalance.create({
            data: { userId: targetId, teamId: tm.teamId, year, totalDays: 15, usedDays: 0 },
          });
        }

        return res.status(200).json({ data: balance });
      }

      // ADMIN_HR: 직원 연차 부여/수정
      case 'PUT': {
        if (!hasMinRole(tm.role, 'ADMIN_HR')) return res.status(403).json({ error: { message: 'Forbidden' } });

        const { userId, totalDays, resetDate } = req.body;
        if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });

        const year = new Date().getFullYear();
        const balance = await prisma.leaveBalance.upsert({
          where: { userId_year: { userId, year } },
          update: {
            ...(totalDays !== undefined && { totalDays }),
            ...(resetDate && { resetDate: new Date(resetDate) }),
            updatedAt: new Date(),
          },
          create: { userId, teamId: tm.teamId, year, totalDays: totalDays || 15 },
        });

        return res.status(200).json({ data: balance });
      }

      default:
        res.setHeader('Allow', 'GET, PUT');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
