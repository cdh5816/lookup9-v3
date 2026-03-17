import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  if (!(await verifySiteAccess(session.user.id, id))) return res.status(403).json({ error: { message: 'Forbidden' } });

  try {
    switch (req.method) {
      case 'POST': {
        const { title, type, startDate, endDate, assigneeId, notes } = req.body;
        if (!title || !startDate) return res.status(400).json({ error: { message: '제목과 시작일을 입력해주세요.' } });

        // 요청자 정보
        const requester = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, position: true, teamMembers: { select: { role: true } } } });
        const requesterRole = requester?.teamMembers?.[0]?.role || 'USER';
        const isExternal = ['PARTNER', 'GUEST', 'VIEWER'].includes(requesterRole);

        const schedule = await prisma.schedule.create({
          data: { siteId: id, title, type: type || '기타', startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null, assigneeId: assigneeId || null, notes: notes || null },
          include: { assignee: { select: { name: true, position: true } } },
        });

        // 외부 계정(게스트/협력사)이 미팅 요청 시 → 내부 관리자에게 알람
        if (isExternal) {
          const site = await prisma.site.findUnique({ where: { id }, select: { teamId: true, name: true } });
          if (site?.teamId) {
            const managers = await prisma.user.findMany({
              where: {
                teamMembers: { some: { teamId: site.teamId, role: { in: ['SUPER_ADMIN','OWNER','ADMIN_HR','ADMIN','MANAGER'] } } },
                NOT: { id: session.user.id },
              },
              select: { id: true },
            });
            const notifTitle = `미팅 요청: ${site.name}`;
            const notifMsg = `${requester?.name || '외부 사용자'}님이 미팅을 요청했습니다. "${title}" (${new Date(startDate).toLocaleDateString('ko-KR')})`;
            if (managers.length > 0) {
              await prisma.notification.createMany({
                data: managers.map(m => ({
                  userId: m.id,
                  type: 'MEETING_REQUEST',
                  title: notifTitle,
                  message: notifMsg,
                  link: \`/sites/\${id}\`,
                  siteId: id,
                })),
                skipDuplicates: true,
              });
            }
          }
        }

        return res.status(201).json({ data: schedule });
      }
      case 'PUT': {
        const { scheduleId, isDone, ...fields } = req.body;
        if (!scheduleId) return res.status(400).json({ error: { message: 'scheduleId is required' } });
        const data: any = { ...fields, updatedAt: new Date() };
        if (isDone !== undefined) data.isDone = isDone;
        if (fields.startDate) data.startDate = new Date(fields.startDate);
        if (fields.endDate) data.endDate = new Date(fields.endDate);
        const schedule = await prisma.schedule.update({ where: { id: scheduleId }, data, include: { assignee: { select: { name: true, position: true } } } });
        return res.status(200).json({ data: schedule });
      }
      case 'DELETE': {
        const { scheduleId } = req.body;
        if (!scheduleId) return res.status(400).json({ error: { message: 'scheduleId is required' } });
        await prisma.schedule.delete({ where: { id: scheduleId } });
        return res.status(200).json({ data: { message: 'Deleted' } });
      }
      default:
        res.setHeader('Allow', 'POST, PUT, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
