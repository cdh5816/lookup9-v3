import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(req, res, tm);
      case 'POST': return await handlePOST(req, res, session, tm);
      default:
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (req: NextApiRequest, res: NextApiResponse, tm: any) => {
  const { status, search } = req.query;

  const where: any = { teamId: tm.teamId };
  if (status && status !== 'all') where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { address: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  // PARTNER/GUEST는 배정된 현장만
  if (tm.role === 'PARTNER' || tm.role === 'GUEST' || tm.role === 'VIEWER') {
    where.assignments = { some: { userId: tm.userId } };
  }

  const sites = await prisma.site.findMany({
    where,
    include: {
      client: { select: { name: true } },
      createdBy: { select: { name: true, position: true } },
      shipments: {
        select: { quantity: true, shippedAt: true, status: true },
        orderBy: [{ sequence: 'desc' }, { createdAt: 'desc' }],
      },
      _count: { select: { assignments: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json({ data: sites });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const { name, address, clientId, status, description } = req.body;
  if (!name) return res.status(400).json({ error: { message: 'Name is required' } });

  const site = await prisma.site.create({
    data: {
      name,
      address: address || null,
      clientId: clientId || null,
      teamId: tm.teamId,
      status: status || '대기',
      description: description || null,
      createdById: session.user.id,
    },
  });

  return res.status(201).json({ data: site });
};
