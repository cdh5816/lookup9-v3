import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  try {
    switch (req.method) {
      case 'GET': {
        const notifications = await prisma.notification.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        const unreadCount = await prisma.notification.count({
          where: { userId: session.user.id, isRead: false },
        });
        return res.status(200).json({ data: { notifications, unreadCount } });
      }
      case 'PUT': {
        const { notificationId, markAll } = req.body;
        if (markAll) {
          await prisma.notification.updateMany({
            where: { userId: session.user.id, isRead: false },
            data: { isRead: true, readAt: new Date() },
          });
        } else if (notificationId) {
          await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true, readAt: new Date() },
          });
        }
        return res.status(200).json({ data: { message: 'Updated' } });
      }
      default:
        res.setHeader('Allow', 'GET, PUT');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
