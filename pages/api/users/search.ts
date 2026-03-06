import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
  }

  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.length < 1) {
    return res.status(200).json({ data: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true, position: true, department: true, company: true },
    take: 10,
    orderBy: { name: 'asc' },
  });

  return res.status(200).json({ data: users });
}
