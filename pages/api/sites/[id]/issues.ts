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
        const { title, type, occurredAt, location, description, responsibility } = req.body;
        if (!title) return res.status(400).json({ error: { message: '제목을 입력해주세요.' } });
        const issue = await prisma.issue.create({
          data: { siteId: id, title, type: type || '기타', occurredAt: occurredAt ? new Date(occurredAt) : null, location: location || null, description: description || null, responsibility: responsibility || null, createdById: session.user.id },
          include: { createdBy: { select: { name: true, position: true } }, handledBy: { select: { name: true, position: true } } },
        });
        return res.status(201).json({ data: issue });
      }
      case 'PUT': {
        const { issueId, status, handledById, resolution, prevention, ...fields } = req.body;
        if (!issueId) return res.status(400).json({ error: { message: 'issueId is required' } });
        const data: any = { ...fields, updatedAt: new Date() };
        if (status) data.status = status;
        if (handledById) data.handledById = handledById;
        if (resolution) data.resolution = resolution;
        if (prevention) data.prevention = prevention;
        const issue = await prisma.issue.update({ where: { id: issueId }, data, include: { createdBy: { select: { name: true, position: true } }, handledBy: { select: { name: true, position: true } } } });
        return res.status(200).json({ data: issue });
      }
      case 'DELETE': {
        const { issueId } = req.body;
        if (!issueId) return res.status(400).json({ error: { message: 'issueId is required' } });
        await prisma.issue.delete({ where: { id: issueId } });
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
