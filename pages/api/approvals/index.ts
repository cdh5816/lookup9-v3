import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getPermissionFlags, getTeamMemberByUserId } from '@/lib/team-helper';

const APPROVAL_TYPES = ['전자결재', '미팅요청', '변경승인'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'Forbidden' } });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, department: true, position: true, name: true } });
  const permissions = getPermissionFlags(tm.role, me?.department);
  if (!permissions.canUseApprovals) {
    return res.status(403).json({ error: { message: '승인함 접근 권한이 없습니다.' } });
  }

  if (req.method === 'GET') {
    const items = await prisma.request.findMany({
      where: {
        site: { teamId: tm.teamId },
        type: { in: APPROVAL_TYPES },
      },
      include: {
        site: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, name: true, department: true, position: true } },
        handledBy: { select: { id: true, name: true, department: true, position: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.status(200).json({ data: items });
  }

  if (req.method === 'PUT') {
    const { requestId, action, result } = req.body;
    if (!requestId || !action) return res.status(400).json({ error: { message: 'requestId, action이 필요합니다.' } });

    const target = await prisma.request.findUnique({ where: { id: requestId }, include: { site: true } });
    if (!target || target.site.teamId !== tm.teamId) {
      return res.status(404).json({ error: { message: '대상을 찾을 수 없습니다.' } });
    }

    const status = action === 'approve' ? '승인' : '반려';
    const updated = await prisma.request.update({
      where: { id: requestId },
      data: {
        status,
        result: result || null,
        handledById: session.user.id,
        updatedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: target.createdById,
        title: action === 'approve' ? '전자결재 승인' : '전자결재 반려',
        message: `${target.title} - ${status}`,
        type: 'approval',
        link: '/approvals',
      },
    });

    return res.status(200).json({ data: updated });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
}
