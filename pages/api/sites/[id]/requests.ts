import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';

async function notifyTargetUsers(siteId: string, senderId: string, title: string, content: string, targetDept?: string | null) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { teamId: true, name: true } });
  if (!site?.teamId) return;

  // 내부 직원에게만 알람 (PARTNER/GUEST 제외)
  const users = await prisma.user.findMany({
    where: {
      teamMembers: { some: { teamId: site.teamId, role: { notIn: ['PARTNER', 'GUEST', 'VIEWER'] } } },
      ...(targetDept ? { department: targetDept } : {}),
      NOT: { id: senderId },
    },
    select: { id: true },
    take: 50,
  });

  if (!users.length) return;

  await prisma.message.createMany({
    data: users.map((user) => ({
      senderId,
      receiverId: user.id,
      title,
      content,
    })),
    skipDuplicates: true,
  });

  await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      type: 'REQUEST',
      title,
      message: content,
      link: `/sites/${siteId}`,
      siteId,
      entityType: 'Request',
    })),
    skipDuplicates: true,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  if (!(await verifySiteAccess(session.user.id, id))) return res.status(403).json({ error: { message: 'Forbidden' } });

  try {
    switch (req.method) {
      case 'POST': {
        const { title, type, priority, targetDept, deadline, description } = req.body;
        if (!title) return res.status(400).json({ error: { message: '제목을 입력해주세요.' } });
        const request = await prisma.request.create({
          data: {
            siteId: id,
            title,
            type: type || '내부 요청',
            priority: priority || '보통',
            targetDept: targetDept || null,
            deadline: deadline ? new Date(deadline) : null,
            description: description || null,
            createdById: session.user.id,
          },
          include: { createdBy: { select: { name: true, position: true } }, handledBy: { select: { name: true, position: true } } },
        });

        await notifyTargetUsers(
          id,
          session.user.id,
          `[요청사항] ${request.title}`,
          `${request.type} / 우선순위 ${request.priority}${request.targetDept ? ` / 대상부서 ${request.targetDept}` : ''}`,
          request.targetDept
        );

        return res.status(201).json({ data: request });
      }
      case 'PUT': {
        const { requestId, status, handledById, result, ...fields } = req.body;
        if (!requestId) return res.status(400).json({ error: { message: 'requestId is required' } });
        const before = await prisma.request.findUnique({ where: { id: requestId }, select: { title: true, createdById: true, type: true } });
        const data: any = { ...fields, updatedAt: new Date() };
        if (status) data.status = status;
        if (handledById) data.handledById = handledById;
        if (result) data.result = result;
        if (fields.deadline) data.deadline = new Date(fields.deadline);
        const request = await prisma.request.update({ where: { id: requestId }, data, include: { createdBy: { select: { name: true, position: true } }, handledBy: { select: { name: true, position: true } } } });

        if (before?.createdById && before.createdById !== session.user.id && status) {
          await prisma.message.create({
            data: {
              senderId: session.user.id,
              receiverId: before.createdById,
              title: `[처리완료] ${before.title}`,
              content: `${before.type} 요청이 ${status} 상태로 변경되었습니다.${result ? `\n결과: ${result}` : ''}`,
            },
          });
        }

        return res.status(200).json({ data: request });
      }
      case 'DELETE': {
        const { requestId } = req.body;
        if (!requestId) return res.status(400).json({ error: { message: 'requestId is required' } });
        await prisma.request.delete({ where: { id: requestId } });
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
