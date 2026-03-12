import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { buildPermissionSet, getTeamMemberByUserId } from '@/lib/team-helper';

const APPROVAL_TYPES = ['전자결재', '미팅요청', '변경승인'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, department: true, name: true, position: true },
  });
  const permissions = buildPermissionSet(tm.role, me?.department);

  if (!permissions.canOpenApprovals) {
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
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return res.status(200).json({ data: items });
  }

  if (req.method === 'PUT') {
    const { requestId, action, result } = req.body;
    if (!requestId || !action) return res.status(400).json({ error: { message: 'requestId와 action이 필요합니다.' } });
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: { message: '잘못된 action입니다.' } });

    const target = await prisma.request.findUnique({ where: { id: requestId }, include: { site: true } });
    if (!target || target.site.teamId !== tm.teamId) {
      return res.status(404).json({ error: { message: '요청을 찾을 수 없습니다.' } });
    }

    const updated = await prisma.request.update({
      where: { id: requestId },
      data: {
        status: action === 'approve' ? '승인' : '반려',
        result: result || null,
        handledById: session.user.id,
        updatedAt: new Date(),
      },
      include: {
        site: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        handledBy: { select: { id: true, name: true } },
      },
    });

    await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId: updated.createdBy.id,
        title: `[${updated.type}] ${action === 'approve' ? '승인' : '반려'}`,
        content: `${updated.site.name} / ${updated.title}\n처리결과: ${action === 'approve' ? '승인' : '반려'}${result ? `\n메모: ${result}` : ''}`,
      },
    });

    return res.status(200).json({ data: updated });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
}
