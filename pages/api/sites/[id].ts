import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { notifySiteMembers } from '@/lib/notification-helper';
import { verifySiteAccess, hasMinRole } from '@/lib/team-helper';

function normalizeStatus(s: string | undefined): string {
  if (!s) return 'CONTRACT_ACTIVE';
  const MAP: Record<string, string> = {
    '영업중': 'SALES_PIPELINE', '영업파이프라인': 'SALES_PIPELINE',
    'SALES_PIPELINE': 'SALES_PIPELINE', '대기': 'SALES_PIPELINE',
    '수주확정': 'SALES_CONFIRMED', 'SALES_CONFIRMED': 'SALES_CONFIRMED',
    '계약완료': 'CONTRACT_ACTIVE', '진행중': 'CONTRACT_ACTIVE',
    '부분완료': 'CONTRACT_ACTIVE', 'CONTRACT_ACTIVE': 'CONTRACT_ACTIVE',
    '준공완료': 'COMPLETED', '완료': 'COMPLETED', 'COMPLETED': 'COMPLETED',
    '하자기간': 'WARRANTY', 'WARRANTY': 'WARRANTY',
    '영업실패': 'FAILED', '실패': 'FAILED', '보류': 'FAILED', 'FAILED': 'FAILED',
  };
  return MAP[s] ?? s;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid id' } });

  const tm = await verifySiteAccess(session.user.id, id);
  if (!tm) return res.status(403).json({ error: { message: 'Forbidden' } });

  try {
    switch (req.method) {
      case 'GET':
        return await handleGET(id, res);
      case 'PUT': {
        const canEdit = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'MEMBER', 'PARTNER'].includes(tm.role);
        if (!canEdit) return res.status(403).json({ error: { message: 'Forbidden' } });
        return await handlePUT(id, req, res, session, tm);
      }
      case 'DELETE':
        if (!hasMinRole(tm.role, 'ADMIN_HR')) return res.status(403).json({ error: { message: 'Forbidden' } });
        return await handleDELETE(id, res);
      default:
        res.setHeader('Allow', 'GET, PUT, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (id: string, res: NextApiResponse) => {
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      client: true,
      createdBy: { select: { name: true, position: true, department: true } },
      assignments: {
        include: {
          user: { select: { id: true, name: true, position: true, department: true, company: true } },
        },
      },
      sales: {
        include: { createdBy: { select: { name: true, position: true } } },
        orderBy: { createdAt: 'desc' },
      },
      contracts: {
        include: { createdBy: { select: { name: true, position: true } } },
        orderBy: { createdAt: 'asc' },
      },
      paintSpecs: {
        include: { confirmedBy: { select: { name: true, position: true } } },
        orderBy: { createdAt: 'desc' },
      },
      shipments: {
        include: { createdBy: { select: { name: true, position: true } } },
        orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
      },
      requests: {
        include: {
          createdBy: { select: { name: true, position: true } },
          handledBy: { select: { name: true, position: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      issues: {
        include: {
          createdBy: { select: { name: true, position: true } },
          handledBy: { select: { name: true, position: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      changeLogs: {
        include: {
          requester: { select: { name: true, position: true } },
          approver: { select: { name: true, position: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      schedules: {
        include: { assignee: { select: { name: true, position: true } } },
        orderBy: { startDate: 'asc' },
      },
      productionOrders: {
        orderBy: { sequence: 'asc' },
      },
      statusHistory: {
        include: { changedBy: { select: { name: true, position: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
      comments: {
        where: { parentId: null },
        include: {
          author: { select: { name: true, position: true, department: true } },
          replies: {
            include: { author: { select: { name: true, position: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { documents: true, requests: true, issues: true, schedules: true },
      },
    },
  });

  if (!site) return res.status(404).json({ error: { message: 'Site not found' } });
  return res.status(200).json({ data: site });
};

const handlePUT = async (id: string, req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const {
    name, address, clientId, status, description, statusReason, changeReason, siteType,
    salesStage, estimatedAmount, salesNote,
    inspectionAgency, inspectionBody, acceptanceAgency, inspectionDone, inspectionDoneAt,
    installerName, installerContact, installerPhone,
    clientDept, clientManager, clientManagerPhone,
    startDocsDone, startDocsDate, completionDocsDone, completionDocsDate, completionDate,
    contractQuantity, deliveryDeadline, warrantyPeriod, contractAmount,
  } = req.body;

  // 현재 상태 조회 (이력 비교용)
  const currentSite = await prisma.site.findUnique({
    where: { id },
    select: {
      status: true,
      contractQuantity: true,
      deliveryDeadline: true,
      contractAmount: true,
    },
  });

  const changeLogs: any[] = [];
  const reason = changeReason || statusReason || null;
  const normalizedStatus = status ? normalizeStatus(status) : undefined;

  // 상태 변경 이력
  if (status && currentSite && currentSite.status !== status) {
    await prisma.siteStatusHistory.create({
      data: {
        siteId: id,
        fromStatus: currentSite.status,
        toStatus: status,
        reason: reason || null,
        changedById: session.user.id,
      },
    });
    await notifySiteMembers(id, session.user.id, 'SITE_STATUS_CHANGED', `현장 상태 변경: ${currentSite.status} → ${status}`);
  }

  // 납기일 변경 이력
  if (deliveryDeadline !== undefined && currentSite) {
    const prevDeadline = currentSite.deliveryDeadline?.toISOString().split('T')[0] ?? null;
    const newDeadline = deliveryDeadline || null;
    if (prevDeadline !== newDeadline) {
      changeLogs.push({
        siteId: id,
        type: '납기일변경',
        beforeValue: prevDeadline ? new Date(prevDeadline).toLocaleDateString('ko-KR') : '미설정',
        afterValue: newDeadline ? new Date(newDeadline).toLocaleDateString('ko-KR') : '삭제',
        reason: reason,
        requesterId: session.user.id,
        status: '승인',
        approvedAt: new Date(),
        approverId: session.user.id,
      });
    }
  }

  // 계약금액 변경 이력
  if (contractAmount !== undefined && currentSite) {
    const prevAmount = currentSite.contractAmount ? Number(currentSite.contractAmount) : null;
    const newAmount = contractAmount ? Number(String(contractAmount).replace(/,/g, '')) : null;
    if (prevAmount !== newAmount) {
      const fmt = (v: number | null) => v ? `${v.toLocaleString('ko-KR')}원` : '미설정';
      changeLogs.push({
        siteId: id,
        type: '계약금액변경',
        beforeValue: fmt(prevAmount),
        afterValue: fmt(newAmount),
        reason: reason,
        requesterId: session.user.id,
        status: '승인',
        approvedAt: new Date(),
        approverId: session.user.id,
      });
    }
  }

  // 물량 변경 이력
  if (contractQuantity !== undefined && currentSite) {
    const prevQty = currentSite.contractQuantity ? Number(currentSite.contractQuantity) : null;
    const newQty = contractQuantity ? Number(String(contractQuantity).replace(/,/g, '')) : null;
    if (prevQty !== newQty) {
      changeLogs.push({
        siteId: id,
        type: '물량변경',
        beforeValue: prevQty !== null ? `${prevQty}㎡` : '미설정',
        afterValue: newQty !== null ? `${newQty}㎡` : '삭제',
        reason: reason,
        requesterId: session.user.id,
        status: '승인',
        approvedAt: new Date(),
        approverId: session.user.id,
      });
    }
  }

  // 변경 이력 일괄 저장
  if (changeLogs.length > 0) {
    await prisma.changeLog.createMany({ data: changeLogs });
  }

  const site = await prisma.site.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(clientId !== undefined && { clientId: clientId || null }),
      ...(status !== undefined && { status: normalizedStatus }),
      ...(description !== undefined && { description }),
      ...(siteType !== undefined && { siteType }),
      ...(salesStage !== undefined && { salesStage }),
      ...(estimatedAmount !== undefined && { estimatedAmount: estimatedAmount ? Number(String(estimatedAmount).replace(/,/g, '')) : null }),
      ...(salesNote !== undefined && { salesNote }),
      ...(inspectionAgency !== undefined && { inspectionAgency }),
      ...(inspectionBody !== undefined && { inspectionBody }),
      ...(acceptanceAgency !== undefined && { acceptanceAgency }),
      ...(inspectionDone !== undefined && { inspectionDone }),
      ...(inspectionDoneAt !== undefined && { inspectionDoneAt: inspectionDoneAt ? new Date(inspectionDoneAt) : null }),
      ...(installerName !== undefined && { installerName }),
      ...(installerContact !== undefined && { installerContact }),
      ...(installerPhone !== undefined && { installerPhone }),
      ...(clientDept !== undefined && { clientDept }),
      ...(clientManager !== undefined && { clientManager }),
      ...(clientManagerPhone !== undefined && { clientManagerPhone }),
      ...(startDocsDone !== undefined && { startDocsDone }),
      ...(startDocsDate !== undefined && { startDocsDate: startDocsDate ? new Date(startDocsDate) : null }),
      ...(completionDocsDone !== undefined && { completionDocsDone }),
      ...(completionDocsDate !== undefined && { completionDocsDate: completionDocsDate ? new Date(completionDocsDate) : null }),
      ...(completionDate !== undefined && { completionDate: completionDate ? new Date(completionDate) : null }),
      ...(contractQuantity !== undefined && { contractQuantity: contractQuantity ? Number(String(contractQuantity).replace(/,/g, '')) : null }),
      ...(deliveryDeadline !== undefined && { deliveryDeadline: deliveryDeadline ? new Date(deliveryDeadline) : null }),
      ...(warrantyPeriod !== undefined && { warrantyPeriod: warrantyPeriod ? Number(warrantyPeriod) : 2 }),
      ...(contractAmount !== undefined && { contractAmount: contractAmount ? Number(String(contractAmount).replace(/,/g, '')) : null }),
      updatedAt: new Date(),
    },
  });

  // 시공업체는 단순 정보 저장만 (배정은 협력업체 탭에서 별도 관리)
  return res.status(200).json({ data: site });
};

const handleDELETE = async (id: string, res: NextApiResponse) => {
  await prisma.site.delete({ where: { id } });
  return res.status(200).json({ data: { message: 'Deleted' } });
};
