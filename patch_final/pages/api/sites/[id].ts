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
        // PARTNER(협력사): 배정된 현장은 전체 수정 가능
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
    name, address, clientId, status, description, statusReason, siteType,
    salesStage, estimatedAmount, salesNote,
    inspectionAgency, inspectionBody, acceptanceAgency, inspectionDone, inspectionDoneAt,
    installerName, installerContact, installerPhone,
    clientDept, clientManager, clientManagerPhone,
    startDocsDone, startDocsDate, completionDocsDone, completionDocsDate, completionDate,
    // 계약 정보 직접 수정 (이력 누적)
    contractQuantity, deliveryDeadline, warrantyPeriod,
  } = req.body;

  if (status) {
    const currentSite = await prisma.site.findUnique({ where: { id }, select: { status: true } });
    if (currentSite && currentSite.status !== status) {
      await prisma.siteStatusHistory.create({
        data: {
          siteId: id,
          fromStatus: currentSite.status,
          toStatus: status,
          reason: statusReason || null,
          changedById: session.user.id,
        },
      });
      await notifySiteMembers(id, session.user.id, 'SITE_STATUS_CHANGED', `현장 상태 변경: ${currentSite.status} → ${status}`);
    }
  }

  // 물량/납품기한 변경 시 ChangeLog 자동 기록
  if (contractQuantity !== undefined || deliveryDeadline !== undefined) {
    const currentSite = await prisma.site.findUnique({
      where: { id },
      select: { contractQuantity: true, deliveryDeadline: true },
    });
    if (currentSite) {
      if (contractQuantity !== undefined && String(currentSite.contractQuantity) !== String(contractQuantity)) {
        await prisma.changeLog.create({
          data: {
            siteId: id,
            type: '물량변경',
            beforeValue: currentSite.contractQuantity ? String(currentSite.contractQuantity) : null,
            afterValue: String(contractQuantity),
            requesterId: session.user.id,
            status: '승인',
            approvedAt: new Date(),
            approverId: session.user.id,
          },
        });
      }
      if (deliveryDeadline !== undefined && currentSite.deliveryDeadline?.toISOString().split('T')[0] !== deliveryDeadline) {
        await prisma.changeLog.create({
          data: {
            siteId: id,
            type: '납품기한변경',
            beforeValue: currentSite.deliveryDeadline ? currentSite.deliveryDeadline.toISOString().split('T')[0] : null,
            afterValue: deliveryDeadline,
            requesterId: session.user.id,
            status: '승인',
            approvedAt: new Date(),
            approverId: session.user.id,
          },
        });
      }
    }
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
      updatedAt: new Date(),
    },
  });

  return res.status(200).json({ data: site });
};

const handleDELETE = async (id: string, res: NextApiResponse) => {
  await prisma.site.delete({ where: { id } });
  return res.status(200).json({ data: { message: 'Deleted' } });
};
