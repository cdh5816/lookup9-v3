import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId, getPermissionProfile, findUsersByTargetDept } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'Forbidden' } });

  const permission = getPermissionProfile(tm.role, tm.user?.department);
  if (!permission.canManageApprovals) {
    return res.status(403).json({ error: { message: '전자결재 접근 권한이 없습니다.' } });
  }

  try {
    if (req.method === 'GET') {
      const status = String(req.query.status || '').trim();
      const targetDept = String(req.query.targetDept || '').trim();

      const items = await prisma.request.findMany({
        where: {
          site: { teamId: tm.teamId },
          type: { in: ['전자결재', '변경승인', '미팅요청'] },
          ...(status ? { status } : {}),
          ...(targetDept ? { targetDept } : {}),
        },
        include: {
          site: { select: { id: true, name: true, status: true } },
          createdBy: { select: { id: true, name: true, position: true, department: true } },
          handledBy: { select: { id: true, name: true, position: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      });

      return res.status(200).json({ data: items });
    }

    if (req.method === 'PUT') {
      const { requestId, action, result } = req.body;
      if (!requestId || !action) {
        return res.status(400).json({ error: { message: 'requestId와 action이 필요합니다.' } });
      }

      const target = await prisma.request.findUnique({
        where: { id: requestId },
        include: { site: { select: { id: true, name: true, teamId: true } }, createdBy: true },
      });
      if (!target || target.site.teamId !== tm.teamId) {
        return res.status(404).json({ error: { message: '결재 문서를 찾을 수 없습니다.' } });
      }

      const nextStatus = action === 'approve' ? '승인완료' : action === 'reject' ? '반려' : '처리중';

      const updated = await prisma.request.update({
        where: { id: requestId },
        data: {
          status: nextStatus,
          handledById: session.user.id,
          result: result || null,
          updatedAt: new Date(),
        },
        include: {
          site: { select: { id: true, name: true, status: true } },
          createdBy: { select: { id: true, name: true, position: true, department: true } },
          handledBy: { select: { id: true, name: true, position: true } },
        },
      });

      await prisma.message.create({
        data: {
          senderId: session.user.id,
          receiverId: target.createdById,
          title: `[전자결재] ${target.title}`,
          content: `${target.site.name} / ${nextStatus}${result ? `\n${result}` : ''}`,
        },
      });

      return res.status(200).json({ data: updated });
    }

    if (req.method === 'POST') {
      const { siteId, title, targetDept, description, deadline } = req.body;
      if (!siteId || !title) {
        return res.status(400).json({ error: { message: 'siteId와 title이 필요합니다.' } });
      }

      const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, name: true, teamId: true } });
      if (!site || site.teamId !== tm.teamId) {
        return res.status(404).json({ error: { message: '현장을 찾을 수 없습니다.' } });
      }

      const created = await prisma.request.create({
        data: {
          siteId,
          title,
          type: '전자결재',
          targetDept: targetDept || '경영지원부',
          description: description || null,
          deadline: deadline ? new Date(deadline) : null,
          status: '결재대기',
          createdById: session.user.id,
        },
      });

      const receivers = await findUsersByTargetDept(tm.teamId, targetDept || '경영지원부');
      if (receivers.length > 0) {
        await prisma.message.createMany({
          data: receivers
            .filter((user) => user.id !== session.user.id)
            .map((user) => ({
              senderId: session.user.id,
              receiverId: user.id,
              title: `[전자결재 요청] ${title}`,
              content: `${site.name} / ${description || '결재 요청이 등록되었습니다.'}`,
            })),
        });
      }

      return res.status(201).json({ data: created });
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
