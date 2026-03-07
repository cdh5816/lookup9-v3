import { prisma } from '@/lib/prisma';

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  siteId?: string;
  entityType?: string;
  entityId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({ data: params });
}

/** 현장 배정된 모든 유저에게 알림 */
export async function notifySiteMembers(siteId: string, excludeUserId: string, type: string, title: string, message?: string) {
  const assignments = await prisma.siteAssignment.findMany({
    where: { siteId },
    select: { userId: true },
  });

  const notifications = assignments
    .filter((a) => a.userId !== excludeUserId)
    .map((a) => ({
      userId: a.userId,
      type,
      title,
      message: message || null,
      link: `/sites/${siteId}`,
      siteId,
    }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }
}
