import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  if (!(await verifySiteAccess(session.user.id, id))) return res.status(403).json({ error: { message: 'Forbidden' } });

  try {
    switch (req.method) {
      case 'POST': {
        const { title, type, priority, targetDept, deadline, description } = req.body;
        if (!title) return res.status(400).json({ error: { message: '제목을 입력해주세요.' } });
        const request = await prisma.request.create({
          data: { siteId: id, title, type: type || '내부 요청', priority: priority || '보통', targetDept: targetDept || null, deadline: deadline ? new Date(deadline) : null, description: description || null, createdById: session.user.id },
          include: { createdBy: { select: { name: true, position: true } }, handledBy: { select: { name: true, position: true } } },
        });
        return res.status(201).json({ data: request });
      }
      case 'PUT': {
        const { requestId, status, handledById, result, ...fields } = req.body;
        if (!requestId) return res.status(400).json({ error: { message: 'requestId is required' } });
        const data: any = { ...fields, updatedAt: new Date() };
        if (status) data.status = status;
        if (handledById) data.handledById = handledById;
        if (result) data.result = result;
        if (fields.deadline) data.deadline = new Date(fields.deadline);
        const request = await prisma.request.update({ where: { id: requestId }, data, include: { createdBy: { select: { name: true, position: true } }, handledBy: { select: { name: true, position: true } } } });
        return res.status(200).json({ data: request });
      }
      case 'DELETE': {
        const { requestId } = req.body;
        if (!requestId) return res.status(400).json({ error: { message: 'requestId is required' } });
        await prisma.request.delete({ where: { id: requestId } });
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
