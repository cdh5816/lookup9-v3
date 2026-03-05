import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(req, res, session);
      case 'POST': return await handlePOST(req, res, session);
      default:
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (req: NextApiRequest, res: NextApiResponse, session: any) => {
  const { status, search } = req.query;

  const where: any = {};
  if (status && status !== 'all') where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { address: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  // PARTNER는 배정된 현장만
  const teamMember = await prisma.teamMember.findFirst({
    where: { userId: session.user.id },
  });

  if (teamMember?.role === 'PARTNER' || teamMember?.role === 'GUEST') {
    where.assignments = { some: { userId: session.user.id } };
  }

  const sites = await prisma.site.findMany({
    where,
    include: {
      client: { select: { name: true } },
      createdBy: { select: { name: true, position: true } },
      _count: { select: { assignments: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json({ data: sites });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any) => {
  const { name, address, clientId, status, description } = req.body;

  if (!name) return res.status(400).json({ error: { message: 'Name is required' } });

  const site = await prisma.site.create({
    data: {
      name,
      address: address || null,
      clientId: clientId || null,
      status: status || '대기',
      description: description || null,
      createdById: session.user.id,
    },
  });

  return res.status(201).json({ data: site });
};
