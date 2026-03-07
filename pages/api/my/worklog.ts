import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const userId = session.user.id;

  try {
    switch (req.method) {
      case 'GET': {
        const { date, month } = req.query;

        // 특정 날짜 조회
        if (date && typeof date === 'string') {
          const log = await prisma.workLog.findUnique({
            where: { userId_date: { userId, date: new Date(date) } },
          });
          return res.status(200).json({ data: log });
        }

        // 월별 목록 (YYYY-MM 형식)
        if (month && typeof month === 'string') {
          const start = new Date(`${month}-01`);
          const end = new Date(start);
          end.setMonth(end.getMonth() + 1);

          const logs = await prisma.workLog.findMany({
            where: { userId, date: { gte: start, lt: end } },
            orderBy: { date: 'desc' },
          });
          return res.status(200).json({ data: logs });
        }

        // 기본: 최근 30일
        const logs = await prisma.workLog.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
          take: 30,
        });
        return res.status(200).json({ data: logs });
      }

      case 'POST': {
        const { date, content } = req.body;
        if (!date || !content) return res.status(400).json({ error: { message: '날짜와 내용을 입력해주세요.' } });

        // upsert — 같은 날짜면 덮어쓰기
        const log = await prisma.workLog.upsert({
          where: { userId_date: { userId, date: new Date(date) } },
          update: { content, updatedAt: new Date() },
          create: { userId, date: new Date(date), content },
        });
        return res.status(200).json({ data: log });
      }

      case 'DELETE': {
        const { date } = req.body;
        if (!date) return res.status(400).json({ error: { message: 'date is required' } });
        await prisma.workLog.delete({
          where: { userId_date: { userId, date: new Date(date) } },
        });
        return res.status(200).json({ data: { message: 'Deleted' } });
      }

      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
