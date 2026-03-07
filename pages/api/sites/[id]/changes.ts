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
        const { type, beforeValue, afterValue, reason, impact } = req.body;
        if (!type) return res.status(400).json({ error: { message: '변경 유형을 입력해주세요.' } });
        const log = await prisma.changeLog.create({
          data: { siteId: id, type, beforeValue: beforeValue || null, afterValue: afterValue || null, reason: reason || null, impact: impact || null, requesterId: session.user.id },
          include: { requester: { select: { name: true, position: true } }, approver: { select: { name: true, position: true } } },
        });
        return res.status(201).json({ data: log });
      }
      case 'PUT': {
        const { changeId, status, approverId } = req.body;
        if (!changeId) return res.status(400).json({ error: { message: 'changeId is required' } });
        const data: any = { updatedAt: new Date() };
        if (status) data.status = status;
        if (status === '승인') { data.approverId = session.user.id; data.approvedAt = new Date(); }
        const log = await prisma.changeLog.update({ where: { id: changeId }, data, include: { requester: { select: { name: true, position: true } }, approver: { select: { name: true, position: true } } } });
        return res.status(200).json({ data: log });
      }
      case 'DELETE': {
        const { changeId } = req.body;
        if (!changeId) return res.status(400).json({ error: { message: 'changeId is required' } });
        await prisma.changeLog.delete({ where: { id: changeId } });
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
