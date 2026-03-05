import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const teamMember = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, role: { in: ['SUPER_ADMIN', 'ADMIN_HR', 'OWNER', 'ADMIN'] } },
  });
  if (!teamMember) return res.status(403).json({ error: { message: 'Forbidden' } });

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
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, company: true, department: true, position: true, phone: true, createdAt: true,
      teamMembers: { select: { role: true, team: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.status(200).json({ data: users });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const { name, email, password, company, department, position, phone, role, teamId } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: { message: 'Name, email, password are required' } });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: { message: 'Email already exists' } });
  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, company: company || null, department: department || null, position: position || null, phone: phone || null },
  });
  if (teamId) { await prisma.teamMember.create({ data: { teamId, userId: user.id, role: role || 'USER' } }); }
  return res.status(201).json({ data: user });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });
  await prisma.user.delete({ where: { id: userId } });
  return res.status(200).json({ data: { message: 'User deleted' } });
};
