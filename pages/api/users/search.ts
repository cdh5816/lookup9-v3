import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  if (req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.length < 1) {
    return res.status(200).json({ data: [] });
  }

  const members = await prisma.teamMember.findMany({
    where: {
      teamId: tm.teamId,
      user: { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ]},
    },
    select: { user: { select: { id: true, name: true, email: true, position: true, department: true, company: true } } },
    take: 10,
  });

  return res.status(200).json({ data: members.map((m) => m.user) });
}
