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
      case 'GET': return await handleGET(tm.teamId, res);
      case 'POST': return await handlePOST(req, res, tm.teamId);
      case 'DELETE': return await handleDELETE(req, res, tm.teamId);
      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (teamId: string, res: NextApiResponse) => {
  const clients = await prisma.client.findMany({
    where: { teamId },
    include: { _count: { select: { sites: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.status(200).json({ data: clients });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, teamId: string) => {
  const { name, contact, phone, email, address, type, notes } = req.body;
  if (!name) return res.status(400).json({ error: { message: 'Name is required' } });
  const client = await prisma.client.create({
    data: { name, contact: contact || null, phone: phone || null, email: email || null, address: address || null, type: type || '발주처', teamId, notes: notes || null },
  });
  return res.status(201).json({ data: client });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, teamId: string) => {
  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: { message: 'clientId is required' } });
  // 같은 팀 거래처만 삭제 가능
  const client = await prisma.client.findFirst({ where: { id: clientId, teamId } });
  if (!client) return res.status(404).json({ error: { message: 'Client not found' } });
  await prisma.client.delete({ where: { id: clientId } });
  return res.status(200).json({ data: { message: 'Deleted' } });
};
