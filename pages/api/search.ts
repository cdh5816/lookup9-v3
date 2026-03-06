import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  if (req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.length < 1) {
    return res.status(200).json({ data: { sites: [], users: [], clients: [] } });
  }

  const [sites, users, clients] = await Promise.all([
    prisma.site.findMany({
      where: { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ]},
      select: { id: true, name: true, status: true, address: true },
      take: 5,
    }),
    prisma.user.findMany({
      where: { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ]},
      select: { id: true, name: true, email: true, position: true, department: true },
      take: 5,
    }),
    prisma.client.findMany({
      where: { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { contact: { contains: q, mode: 'insensitive' } },
      ]},
      select: { id: true, name: true, type: true, contact: true },
      take: 5,
    }),
  ]);

  return res.status(200).json({ data: { sites, users, clients } });
}
