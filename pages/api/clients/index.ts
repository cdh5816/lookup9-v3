import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(req, res);
      case 'POST': return await handlePOST(req, res);
      case 'DELETE': return await handleDELETE(req, res);
      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const { type, search } = req.query;
  const where: any = {};
  if (type && type !== 'all') where.type = type;
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { contact: { contains: search as string, mode: 'insensitive' } },
    ];
  }
  const clients = await prisma.client.findMany({
    where,
    include: { _count: { select: { sites: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.status(200).json({ data: clients });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const { name, contact, phone, email, address, type, notes } = req.body;
  if (!name) return res.status(400).json({ error: { message: 'Name is required' } });
  const client = await prisma.client.create({
    data: { name, contact: contact || null, phone: phone || null, email: email || null, address: address || null, type: type || '발주처', notes: notes || null },
  });
  return res.status(201).json({ data: client });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: { message: 'clientId is required' } });
  await prisma.client.delete({ where: { id: clientId } });
  return res.status(200).json({ data: { message: 'Deleted' } });
};
