import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  try {
    switch (req.method) {
      case 'POST': {
        const { title, type, startDate, endDate, assigneeId, notes } = req.body;
        if (!title || !startDate) return res.status(400).json({ error: { message: '제목과 시작일을 입력해주세요.' } });
        const schedule = await prisma.schedule.create({
          data: { siteId: id, title, type: type || '기타', startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null, assigneeId: assigneeId || null, notes: notes || null },
          include: { assignee: { select: { name: true, position: true } } },
        });
        return res.status(201).json({ data: schedule });
      }
      case 'PUT': {
        const { scheduleId, isDone, ...fields } = req.body;
        if (!scheduleId) return res.status(400).json({ error: { message: 'scheduleId is required' } });
        const data: any = { ...fields, updatedAt: new Date() };
        if (isDone !== undefined) data.isDone = isDone;
        if (fields.startDate) data.startDate = new Date(fields.startDate);
        if (fields.endDate) data.endDate = new Date(fields.endDate);
        const schedule = await prisma.schedule.update({ where: { id: scheduleId }, data, include: { assignee: { select: { name: true, position: true } } } });
        return res.status(200).json({ data: schedule });
      }
      case 'DELETE': {
        const { scheduleId } = req.body;
        if (!scheduleId) return res.status(400).json({ error: { message: 'scheduleId is required' } });
        await prisma.schedule.delete({ where: { id: scheduleId } });
        return res.status(200).json({ data: { message: 'Deleted' } });
      }
      default:
        res.setHeader('Allow', 'POST, PUT, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
