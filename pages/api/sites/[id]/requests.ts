import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess, findUsersByTargetDept, getPermissionProfile } from '@/lib/team-helper';

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
          include: { createdBy: { select: { name: true, position: true } }, handledBy: { select: { name: true, position: true } } },
        });

        const site = await prisma.site.findUnique({ where: { id }, select: { name: true, teamId: true } });
        if (site) {
          const deptUsers = await findUsersByTargetDept(site.teamId || tm.teamId, targetDept || null);
          const receivers = deptUsers.filter((user) => user.id !== session.user.id);
          if (receivers.length > 0) {
            await prisma.message.createMany({
              data: receivers.map((user) => ({
                senderId: session.user.id,
                receiverId: user.id,
                title: `[요청사항] ${title}`,
                content: `${site.name}\n유형: ${type || '내부 요청'}\n${description || ''}`,
              })),
            });
          }
        }

        return res.status(201).json({ data: request });
      }
      case 'PUT': {
        const { requestId, status, handledById, result, ...fields } = req.body;
        if (!requestId) return res.status(400).json({ error: { message: 'requestId is required' } });
        const data: any = { ...fields, updatedAt: new Date() };
        if (status) data.status = status;
        if (handledById) data.handledById = handledById;
        if (result !== undefined) data.result = result;
        if (fields.deadline) data.deadline = new Date(fields.deadline);

        const request = await prisma.request.update({
          where: { id: requestId },
          data,
          include: { createdBy: { select: { id: true, name: true, position: true } }, handledBy: { select: { name: true, position: true } } },
        });

        if (status && request.createdBy?.id && request.createdBy.id !== session.user.id) {
          await prisma.message.create({
            data: {
              senderId: session.user.id,
              receiverId: request.createdBy.id,
              title: `[요청사항 ${status}] ${request.title}`,
              content: result || `${request.title} 요청 상태가 ${status}로 변경되었습니다.`,
            },
          });
        }

        return res.status(200).json({ data: request });
      }
      case 'DELETE': {
        const permission = getPermissionProfile(tm.role, tm.user?.department);
        const { requestId } = req.body;
        if (!requestId) return res.status(400).json({ error: { message: 'requestId is required' } });
        if (!permission.canManageApprovals && tm.userId !== session.user.id) {
          return res.status(403).json({ error: { message: '삭제 권한이 없습니다.' } });
        }
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
