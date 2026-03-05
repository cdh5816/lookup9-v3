import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession(req, res);

  if (!session) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      department: true,
      position: true,
      phone: true,
      createdAt: true,
      teamMembers: {
        select: {
          role: true,
          team: { select: { name: true } },
        },
      },
    },
  });

  return res.status(200).json({ data: user });
}
