import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid id' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(id, res);
      case 'PUT': return await handlePUT(id, req, res);
      case 'DELETE': return await handleDELETE(id, res);
      default:
        res.setHeader('Allow', 'GET, PUT, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (id: string, res: NextApiResponse) => {
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      client: true,
      createdBy: { select: { name: true, position: true, department: true } },
      assignments: { include: { user: { select: { id: true, name: true, position: true, department: true } } } },
      sales: { include: { createdBy: { select: { name: true, position: true } } }, orderBy: { createdAt: 'desc' } },
      contracts: { include: { createdBy: { select: { name: true, position: true } } }, orderBy: { createdAt: 'desc' } },
      comments: {
        where: { parentId: null },
        include: {
          author: { select: { name: true, position: true, department: true } },
          replies: { include: { author: { select: { name: true, position: true } } }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { documents: true } },
    },
  });

  if (!site) return res.status(404).json({ error: { message: 'Site not found' } });
  return res.status(200).json({ data: site });
};

const handlePUT = async (id: string, req: NextApiRequest, res: NextApiResponse) => {
  const { name, address, clientId, status, description } = req.body;
  const site = await prisma.site.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(address !== undefined && { address }),
      ...(clientId !== undefined && { clientId: clientId || null }),
      ...(status && { status }),
      ...(description !== undefined && { description }),
      updatedAt: new Date(),
    },
  });
  return res.status(200).json({ data: site });
};

const handleDELETE = async (id: string, res: NextApiResponse) => {
  await prisma.site.delete({ where: { id } });
  return res.status(200).json({ data: { message: 'Deleted' } });
};
