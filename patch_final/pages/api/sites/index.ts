import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(req, res, tm);
      case 'POST': return await handlePOST(req, res, session, tm);
      default:
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (req: NextApiRequest, res: NextApiResponse, tm: any) => {
  const { status, search, salesOnly } = req.query;

  const where: any = { teamId: tm.teamId };

  // salesOnly=true: 영업관리 페이지용 (영업중/수주확정/실패)
  if (salesOnly === 'true') {
    where.status = { in: ['SALES_PIPELINE', 'SALES_CONFIRMED', 'FAILED'] };
  } else if (status && status !== 'all') {
    where.status = status;
  } else if (!salesOnly) {
    // 기본 현장관리: 영업중/실패 제외
    where.status = { in: ['CONTRACT_ACTIVE', 'COMPLETED', 'WARRANTY'] };
  }

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { address: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (['PARTNER', 'GUEST', 'VIEWER'].includes(tm.role)) {
    where.assignments = { some: { userId: tm.userId } };
  }

  const sites = await prisma.site.findMany({
    where,
    include: {
      client: { select: { name: true } },
      createdBy: { select: { name: true, position: true } },
      productionOrders: {
        select: { quantity: true, supplyDate: true },
      },
      sales: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { status: true, estimateAmount: true, meetingNotes: true, createdAt: true },
      },
      _count: {
        select: { issues: true, documents: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return res.status(200).json({ data: sites });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const {
    name, address, clientId, clientName, status, description,
    siteType, salesStage, estimatedAmount, salesNote,
    clientDept, clientManager, clientManagerPhone,
    // 계약 정보 (분할납품요구서)
    contractNo, procurementNo, contractDate, contractAmount,
    contractQuantity, unitPrice, specification, deliveryDeadline, warrantyPeriod,
  } = req.body;

  if (!name) return res.status(400).json({ error: { message: 'Name is required' } });

  const site = await prisma.$transaction(async (tx) => {
    // clientName으로 Client 자동 생성
    let resolvedClientId = clientId || null;
    if (clientName && !clientId) {
      const existing = await tx.client.findFirst({ where: { name: clientName, teamId: tm.teamId } });
      if (existing) {
        resolvedClientId = existing.id;
      } else {
        const newClient = await tx.client.create({ data: { name: clientName, teamId: tm.teamId } });
        resolvedClientId = newClient.id;
      }
    }

    const newSite = await tx.site.create({
      data: {
        name,
        address: address || null,
        clientId: resolvedClientId,
        teamId: tm.teamId,
        status: status || 'SALES_PIPELINE',
        siteType: siteType || '납품설치도',
        salesStage: salesStage || null,
        estimatedAmount: estimatedAmount ? Number(String(estimatedAmount).replace(/,/g, '')) : null,
        salesNote: salesNote || null,
        description: description || null,
        clientDept: clientDept || null,
        clientManager: clientManager || null,
        clientManagerPhone: clientManagerPhone || null,
        // 계약 정보
        contractNo: contractNo || null,
        procurementNo: procurementNo || null,
        contractDate: contractDate ? new Date(contractDate) : null,
        contractAmount: contractAmount ? Number(String(contractAmount).replace(/,/g, '')) : null,
        contractQuantity: contractQuantity ? Number(String(contractQuantity).replace(/,/g, '')) : null,
        unitPrice: unitPrice ? Number(String(unitPrice).replace(/,/g, '')) : null,
        specification: specification || null,
        deliveryDeadline: deliveryDeadline ? new Date(deliveryDeadline) : null,
        warrantyPeriod: warrantyPeriod ? Number(warrantyPeriod) : 2,
        createdById: session.user.id,
      },
    });

    return newSite;
  });

  return res.status(201).json({ data: site });
};
