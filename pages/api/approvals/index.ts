import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createNotification } from '@/lib/notification-helper';
import { canApproveRequest, getTeamMemberByUserId, verifySiteAccess } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  try {
    switch (req.method) {
      case 'GET':
        return await handleGET(req, res, tm, session.user.id);
      case 'POST':
        return await handlePOST(req, res, tm, session.user.id);
      case 'PUT':
        return await handlePUT(req, res, tm, session.user.id);
      default:
        res.setHeader('Allow', 'GET, POST, PUT');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

async function handleGET(req: NextApiRequest, res: NextApiResponse, tm: any, userId: string) {
  const box = typeof req.query.box === 'string' ? req.query.box : 'inbox';
  const department = tm.user?.department || null;
  const canApprove = canApproveRequest(tm.role, department, null);

  const where: any = {
    site: { teamId: tm.teamId },
    type: { in: ['전자결재', '미팅요청', '변경승인'] },
  };

  if (box === 'mine') {
    where.createdById = userId;
  } else if (!canApprove) {
    where.OR = [{ createdById: userId }, { targetDept: department || undefined }];
  } else if (box === 'dept' && department) {
    where.targetDept = department;
  }

  const approvals = await prisma.request.findMany({
    where,
    include: {
      site: { select: { id: true, name: true, status: true } },
      createdBy: { select: { id: true, name: true, position: true, department: true } },
      handledBy: { select: { id: true, name: true, position: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });

  return res.status(200).json({ data: approvals });
}

async function handlePOST(req: NextApiRequest, res: NextApiResponse, tm: any, userId: string) {
  const { siteId, title, description, targetDept, priority, type } = req.body;
  if (!siteId || !title) {
    return res.status(400).json({ error: { message: 'siteId와 title이 필요합니다.' } });
  }

  const access = await verifySiteAccess(userId, siteId);
  if (!access) return res.status(403).json({ error: { message: 'Forbidden' } });

  const request = await prisma.request.create({
    data: {
      siteId,
      title,
      description: description || null,
      targetDept: targetDept || null,
      priority: priority || '보통',
      type: type || '전자결재',
      status: '등록',
      createdById: userId,
    },
    include: {
      site: { select: { id: true, name: true, status: true } },
      createdBy: { select: { id: true, name: true, position: true, department: true } },
      handledBy: { select: { id: true, name: true, position: true } },
    },
  });

  const receivers = await prisma.teamMember.findMany({
    where: {
      teamId: tm.teamId,
      ...(targetDept
        ? { user: { department: targetDept } }
        : { role: { in: ['ADMIN_HR', 'MANAGER'] } }),
    },
    select: { userId: true },
  });

  await Promise.all(
    receivers
      .filter((r) => r.userId !== userId)
      .map((receiver) =>
        createNotification({
          userId: receiver.userId,
          type: 'APPROVAL_CREATED',
          title: `[${type || '전자결재'}] ${title}`,
          message: description || '새 승인 요청이 등록되었습니다.',
          link: `/approvals`,
          siteId,
          entityType: 'Request',
          entityId: request.id,
        })
      )
  );

  return res.status(201).json({ data: request });
}

async function handlePUT(req: NextApiRequest, res: NextApiResponse, tm: any, userId: string) {
  const { requestId, status, result } = req.body;
  if (!requestId || !status) {
    return res.status(400).json({ error: { message: 'requestId와 status가 필요합니다.' } });
  }

  const current = await prisma.request.findUnique({
    where: { id: requestId },
    include: { site: { select: { teamId: true, id: true, name: true } }, createdBy: { select: { id: true } } },
  });
  if (!current || current.site.teamId !== tm.teamId) {
    return res.status(404).json({ error: { message: '승인 요청을 찾을 수 없습니다.' } });
  }

  if (!canApproveRequest(tm.role, tm.user?.department, current.targetDept)) {
    return res.status(403).json({ error: { message: '이 승인 요청을 처리할 권한이 없습니다.' } });
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      status,
      result: result || null,
      handledById: userId,
      updatedAt: new Date(),
    },
    include: {
      site: { select: { id: true, name: true, status: true } },
      createdBy: { select: { id: true, name: true, position: true, department: true } },
      handledBy: { select: { id: true, name: true, position: true } },
    },
  });

  if (current.createdBy.id !== userId) {
    await createNotification({
      userId: current.createdBy.id,
      type: 'APPROVAL_UPDATED',
      title: `[${status}] ${updated.title}`,
      message: result || `${tm.user?.name || '담당자'}님이 승인 요청을 처리했습니다.`,
      link: `/approvals`,
      siteId: current.site.id,
      entityType: 'Request',
      entityId: updated.id,
    });
  }

  return res.status(200).json({ data: updated });
}
