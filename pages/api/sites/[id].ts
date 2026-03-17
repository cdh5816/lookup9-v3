import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { notifySiteMembers } from '@/lib/notification-helper';
import { verifySiteAccess, hasMinRole } from '@/lib/team-helper';

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
    designOffice, salesPm, materialSpec, sectorType, salesOwner, clientContact,
    inspectionAgency, inspectionBody, acceptanceAgency, inspectionDone, inspectionDoneAt,
    installerName, installerContact, installerPhone,
    clientDept, clientManager, clientManagerPhone,
    startDocsDone, startDocsDate, completionDocsDone, completionDocsDate, completionDate,
    contractQuantity, deliveryDeadline, warrantyPeriod, contractAmount,
  } = req.body;

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

  if (deliveryDeadline !== undefined && currentSite) {
    const prevDeadline = currentSite.deliveryDeadline?.toISOString().split('T')[0] ?? null;
    const newDeadline = deliveryDeadline || null;
    if (prevDeadline !== newDeadline) {
      changeLogs.push({
        siteId: id, type: '납기일변경',
        beforeValue: prevDeadline ? new Date(prevDeadline).toLocaleDateString('ko-KR') : '미설정',
        afterValue: newDeadline ? new Date(newDeadline).toLocaleDateString('ko-KR') : '삭제',
        reason, requesterId: session.user.id, status: '승인',
        approvedAt: new Date(), approverId: session.user.id,
      });
    }
  }

  if (contractAmount !== undefined && currentSite) {
    const prevAmount = currentSite.contractAmount ? Number(currentSite.contractAmount) : null;
    const newAmount = contractAmount ? Number(String(contractAmount).replace(/,/g, '')) : null;
    if (prevAmount !== newAmount) {
      const fmt = (v: number | null) => v ? `${v.toLocaleString('ko-KR')}원` : '미설정';
      changeLogs.push({
        siteId: id, type: '계약금액변경',
        beforeValue: fmt(prevAmount), afterValue: fmt(newAmount),
        reason, requesterId: session.user.id, status: '승인',
        approvedAt: new Date(), approverId: session.user.id,
      });
    }
  }

  if (contractQuantity !== undefined && currentSite) {
    const prevQty = currentSite.contractQuantity ? Number(currentSite.contractQuantity) : null;
    const newQty = contractQuantity ? Number(String(contractQuantity).replace(/,/g, '')) : null;
    if (prevQty !== newQty) {
      changeLogs.push({
        siteId: id, type: '물량변경',
        beforeValue: prevQty !== null ? `${prevQty}㎡` : '미설정',
        afterValue: newQty !== null ? `${newQty}㎡` : '삭제',
        reason, requesterId: session.user.id, status: '승인',
        approvedAt: new Date(), approverId: session.user.id,
      });
    }
  }

  if (changeLogs.length > 0) {
    await prisma.changeLog.createMany({ data: changeLogs });
  }

  const site = await prisma.site.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(clientId !== undefined && { clientId: clientId || null }),
      ...(status !== undefined && { status }),
      ...(description !== undefined && { description }),
      ...(siteType !== undefined && { siteType }),
      ...(salesStage !== undefined && { salesStage }),
      ...(estimatedAmount !== undefined && { estimatedAmount: estimatedAmount ? Number(String(estimatedAmount).replace(/,/g, '')) : null }),
      ...(salesNote !== undefined && { salesNote }),
      ...(designOffice !== undefined && { designOffice }),
      ...(salesPm !== undefined && { salesPm }),
      ...(materialSpec !== undefined && { materialSpec }),
      ...(sectorType !== undefined && { sectorType }),
      ...(salesOwner !== undefined && { salesOwner }),
      ...(clientContact !== undefined && { clientContact }),
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

  return res.status(200).json({ data: site });
};

const handleDELETE = async (id: string, res: NextApiResponse) => {
  await prisma.site.delete({ where: { id } });
  return res.status(200).json({ data: { message: 'Deleted' } });
};
