import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId, hasMinRole } from '@/lib/team-helper';
import { createNotification } from '@/lib/notification-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(req, res, session, tm);
      case 'POST': return await handlePOST(req, res, session, tm);
      case 'PUT': return await handlePUT(req, res, session, tm);
      default:
        res.setHeader('Allow', 'GET, POST, PUT');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

// 조회: 본인 것 + MANAGER는 부서원 것 + ADMIN_HR는 전체
const handleGET = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const { filter } = req.query;
  let where: any = {};

  if (filter === 'pending-manager' && hasMinRole(tm.role, 'MANAGER')) {
    // 부서장: 같은 부서 신청 중 부서장승인대기
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true } });
    where = {
      currentStep: '부서장승인대기',
      user: { department: user?.department, teamMembers: { some: { teamId: tm.teamId } } },
    };
  } else if (filter === 'pending-admin' && hasMinRole(tm.role, 'ADMIN_HR')) {
    // ADMIN_HR: 최종승인대기
    where = { currentStep: '최종승인대기', user: { teamMembers: { some: { teamId: tm.teamId } } } };
  } else if (filter === 'all' && hasMinRole(tm.role, 'ADMIN_HR')) {
    // ADMIN_HR: 전체
    where = { user: { teamMembers: { some: { teamId: tm.teamId } } } };
  } else {
    // 본인 것
    where = { userId: session.user.id };
  }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: { select: { name: true, position: true, department: true } },
      manager: { select: { name: true, position: true } },
      admin: { select: { name: true, position: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json({ data: requests });
};

// 신청
const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const { type, startDate, endDate, days, reason } = req.body;
  if (!startDate || !endDate || !days) {
    return res.status(400).json({ error: { message: '시작일, 종료일, 일수를 입력해주세요.' } });
  }

  // 잔여 연차 확인
  const year = new Date().getFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_year: { userId: session.user.id, year } },
  });
  const remaining = balance ? Number(balance.totalDays) - Number(balance.usedDays) : 15;
  if (Number(days) > remaining) {
    return res.status(400).json({ error: { message: `잔여 연차가 부족합니다. (잔여: ${remaining}일)` } });
  }

  const request = await prisma.leaveRequest.create({
    data: {
      userId: session.user.id,
      teamId: tm.teamId,
      type: type || '연차',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      days,
      reason: reason || null,
      status: '신청',
      currentStep: '부서장승인대기',
    },
    include: { user: { select: { name: true, position: true, department: true } } },
  });

  // 같은 부서 MANAGER에게 알림
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true, name: true } });
  if (user?.department) {
    const managers = await prisma.teamMember.findMany({
      where: { teamId: tm.teamId, role: 'MANAGER', user: { department: user.department } },
      select: { userId: true },
    });
    for (const m of managers) {
      await createNotification({
        userId: m.userId, type: 'LEAVE_REQUESTED',
        title: `연차 승인 요청: ${user.name}`,
        message: `${type || '연차'} ${days}일 (${startDate} ~ ${endDate})`,
        link: '/admin-hr',
      });
    }
  }

  return res.status(201).json({ data: request });
};

// 승인/반려 (2단계)
const handlePUT = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const { requestId, action, note } = req.body;
  if (!requestId || !action) return res.status(400).json({ error: { message: 'requestId, action은 필수입니다.' } });
  if (!['승인', '반려'].includes(action)) return res.status(400).json({ error: { message: '승인 또는 반려만 가능합니다.' } });

  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { user: { select: { name: true } } },
  });
  if (!request) return res.status(404).json({ error: { message: 'Not found' } });

  const now = new Date();

  // 1단계: 부서장 승인
  if (request.currentStep === '부서장승인대기' && hasMinRole(tm.role, 'MANAGER')) {
    if (action === '승인') {
      await prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          managerId: session.user.id, managerAction: '승인', managerAt: now, managerNote: note || null,
          currentStep: '최종승인대기', updatedAt: now,
        },
      });
      // ADMIN_HR에게 알림
      const admins = await prisma.teamMember.findMany({
        where: { teamId: tm.teamId, role: { in: ['ADMIN_HR', 'ADMIN', 'SUPER_ADMIN', 'OWNER'] } },
        select: { userId: true },
      });
      for (const a of admins) {
        await createNotification({
          userId: a.userId, type: 'LEAVE_MANAGER_APPROVED',
          title: `연차 최종승인 요청: ${request.user?.name}`,
          message: `부서장 승인 완료. 최종 승인이 필요합니다.`,
          link: '/admin-hr',
        });
      }
    } else {
      await prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          managerId: session.user.id, managerAction: '반려', managerAt: now, managerNote: note || null,
          status: '반려', currentStep: '완료', updatedAt: now,
        },
      });
      await createNotification({
        userId: request.userId, type: 'LEAVE_REJECTED',
        title: '연차 신청이 반려되었습니다.',
        message: note || '부서장에 의해 반려됨',
      });
    }
    return res.status(200).json({ data: { message: action } });
  }

  // 2단계: ADMIN_HR 최종 승인
  if (request.currentStep === '최종승인대기' && hasMinRole(tm.role, 'ADMIN_HR')) {
    if (action === '승인') {
      // 사용 일수 차감
      const year = new Date(request.startDate).getFullYear();
      await prisma.leaveBalance.upsert({
        where: { userId_year: { userId: request.userId, year } },
        update: { usedDays: { increment: request.days } },
        create: { userId: request.userId, teamId: tm.teamId, year, totalDays: 15, usedDays: request.days },
      });

      await prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          adminId: session.user.id, adminAction: '승인', adminAt: now, adminNote: note || null,
          status: '승인', currentStep: '완료', updatedAt: now,
        },
      });
      await createNotification({
        userId: request.userId, type: 'LEAVE_APPROVED',
        title: '연차가 승인되었습니다.',
        message: `${request.type} ${request.days}일 확정`,
      });
    } else {
      await prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          adminId: session.user.id, adminAction: '반려', adminAt: now, adminNote: note || null,
          status: '반려', currentStep: '완료', updatedAt: now,
        },
      });
      await createNotification({
        userId: request.userId, type: 'LEAVE_REJECTED',
        title: '연차 신청이 반려되었습니다.',
        message: note || '경영지원부에 의해 반려됨',
      });
    }
    return res.status(200).json({ data: { message: action } });
  }

  return res.status(400).json({ error: { message: '현재 단계에서 처리할 수 없습니다.' } });
};
