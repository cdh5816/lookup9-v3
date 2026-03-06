import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  try {
    switch (req.method) {
      case 'POST': {
        const { contractAmount, specialNotes, status } = req.body;
        const record = await prisma.contract.create({
          data: {
            siteId: id,
            status: status || '수주등록',
            contractAmount: contractAmount || null,
            specialNotes: specialNotes || null,
            createdById: session.user.id,
          },
          include: { createdBy: { select: { name: true, position: true } } },
        });
        return res.status(201).json({ data: record });
      }
      case 'DELETE': {
        const { contractId } = req.body;
        if (!contractId) return res.status(400).json({ error: { message: 'contractId is required' } });
        await prisma.contract.delete({ where: { id: contractId } });
        return res.status(200).json({ data: { message: 'Deleted' } });
      }
      default:
        res.setHeader('Allow', 'POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
