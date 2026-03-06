import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  const teamMember = await prisma.teamMember.findFirst({
    where: { userId: session.user.id },
  });
  const allowedRoles = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'];
  if (!teamMember || !allowedRoles.includes(teamMember.role)) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  try {
    switch (req.method) {
      case 'POST': {
        const { userId, assignedRole } = req.body;
        if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });
        const existing = await prisma.siteAssignment.findUnique({
          where: { siteId_userId: { siteId: id, userId } },
        });
        if (existing) return res.status(400).json({ error: { message: '이미 배정된 인원입니다.' } });
        const assignment = await prisma.siteAssignment.create({
          data: { siteId: id, userId, assignedRole: assignedRole || 'USER' },
          include: { user: { select: { id: true, name: true, position: true, department: true } } },
        });
        return res.status(201).json({ data: assignment });
      }
      case 'DELETE': {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });
        await prisma.siteAssignment.delete({
          where: { siteId_userId: { siteId: id, userId } },
        });
        return res.status(200).json({ data: { message: 'Removed' } });
      }
      default:
        res.setHeader('Allow', 'POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
