import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';

async function notifyByDepartment(teamId: string, senderId: string, targetDept: string | null | undefined, title: string, content: string) {
  const users = await prisma.user.findMany({
    where: {
      id: { not: senderId },
      teamMembers: { some: { teamId } },
      ...(targetDept
        ? { OR: [{ department: { contains: targetDept, mode: 'insensitive' } }, { position: { contains: '팀장', mode: 'insensitive' } }, { position: { contains: '부장', mode: 'insensitive' } }] }
        : {}),
    },
    select: { id: true },
  });
  if (!users.length) return;
  await prisma.message.createMany({
    data: users.map((user) => ({ senderId, receiverId: user.id, title, content })),
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  const tm = await verifySiteAccess(session.user.id, id);
  if (!tm) return res.status(403).json({ error: { message: 'Forbidden' } });

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
          include: { createdBy: { select: { name: true, position: true } }, handledBy: { select: { name: true, position: true } }, site: { select: { name: true } } },
        });

        const messageTitle = `[${type || '요청사항'}] ${title}`;
        const messageContent = `${request.site.name} 현장 요청이 등록되었습니다.${targetDept ? `\n대상부서: ${targetDept}` : ''}`;
        await notifyByDepartment(tm.teamId, session.user.id, targetDept, messageTitle, messageContent);

        return res.status(201).json({ data: request });
      }
      case 'PUT': {
        const { requestId, status, handledById, result, ...fields } = req.body;
        if (!requestId) return res.status(400).json({ error: { message: 'requestId is required' } });
        const existing = await prisma.request.findUnique({ where: { id: requestId }, include: { site: { select: { name: true } }, createdBy: { select: { id: true } } } });
        if (!existing) return res.status(404).json({ error: { message: 'Request not found' } });
        const data: any = { ...fields, updatedAt: new Date() };
        if (status) data.status = status;
        if (handledById) data.handledById = handledById;
        if (result) data.result = result;
        if (fields.deadline) data.deadline = new Date(fields.deadline);
        const request = await prisma.request.update({ where: { id: requestId }, data, include: { createdBy: { select: { name: true, position: true } }, handledBy: { select: { name: true, position: true } } } });

        await prisma.message.create({
          data: {
            senderId: session.user.id,
            receiverId: existing.createdBy.id,
            title: `[요청사항 ${status || '수정'}] ${existing.title}`,
            content: `${existing.site.name} 현장 요청사항이 ${status || '수정'} 처리되었습니다.${result ? `\n처리내용: ${result}` : ''}`,
          },
        });
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
