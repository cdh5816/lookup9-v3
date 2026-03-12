import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getPermissionFlags, getTeamMemberByUserId } from '@/lib/team-helper';

const APPROVAL_TYPES = ['전자결재', '미팅요청', '변경승인'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  const permissions = getPermissionFlags(tm.role, tm.user?.department);
  if (!permissions.canApprove) {
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

    const myDept = tm.user?.department || '';
    const visible = items.filter((item) => {
      if (permissions.isCompanyAdmin || permissions.isManager) return true;
      if (!item.targetDept) return true;
      return myDept.includes(item.targetDept) || item.targetDept.includes(myDept);
    });

    return res.status(200).json({ data: visible });
  }

  if (req.method === 'PUT') {
    const { requestId, action, result } = req.body;
    if (!requestId || !action) return res.status(400).json({ error: { message: 'requestId, action is required' } });
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: { message: 'Invalid action' } });

    const current = await prisma.request.findUnique({ where: { id: requestId }, include: { site: { select: { teamId: true, name: true } }, createdBy: true } });
    if (!current || current.site.teamId !== tm.teamId) return res.status(404).json({ error: { message: 'Request not found' } });

    const updated = await prisma.request.update({
      where: { id: requestId },
      data: {
        status: action === 'approve' ? '승인완료' : '반려',
        handledById: session.user.id,
        result: result || (action === 'approve' ? '승인 처리되었습니다.' : '반려 처리되었습니다.'),
        updatedAt: new Date(),
      },
      include: {
        site: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, name: true, department: true, position: true } },
        handledBy: { select: { id: true, name: true, department: true, position: true } },
      },
    });

    await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId: current.createdById,
        title: `[${updated.type}] ${action === 'approve' ? '승인' : '반려'}`,
        content: `${updated.site.name} / ${updated.title}\n${updated.result || ''}`,
      },
    });

    return res.status(200).json({ data: updated });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
}
