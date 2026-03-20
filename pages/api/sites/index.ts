import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId } from '@/lib/team-helper';

export function normalizeStatus(s: string | undefined): string {
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
  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });
  try {
    switch (req.method) {
      case 'GET':  return await handleGET(req, res, tm);
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
  const { status, search, salesOnly, includeCompleted, excludeSales } = req.query;
  const where: any = { teamId: tm.teamId };

  if (salesOnly === 'true') {
    where.status = { in: ['SALES_PIPELINE', 'SALES_CONFIRMED', 'FAILED'] }; // 영업관리: 영업중+수주확정+실패 모두 표시
  } else if (status && status !== 'all') {
    where.status = normalizeStatus(status as string);
  } else if (includeCompleted === 'true') {
    if (excludeSales === 'true') {
      // 현장관리: SALES_PIPELINE만 제외, 수주확정은 투입전으로 현장관리에 포함
      where.status = { in: ['SALES_CONFIRMED', 'CONTRACT_ACTIVE', 'COMPLETED', 'WARRANTY', 'FAILED'] };
    } else {
      // 전체 (FAILED 포함)
      where.status = { in: ['SALES_PIPELINE', 'SALES_CONFIRMED', 'CONTRACT_ACTIVE', 'COMPLETED', 'WARRANTY', 'FAILED'] };
    }
  } else {
    // 기본: 계약 이후 활성 현장
    where.status = { in: ['CONTRACT_ACTIVE', 'COMPLETED', 'WARRANTY'] };
  }

  if (search) {
    where.OR = [
      { name:          { contains: search as string, mode: 'insensitive' } },
      { address:       { contains: search as string, mode: 'insensitive' } },
      { client:        { name: { contains: search as string, mode: 'insensitive' } } },
      { salesOwner:    { contains: search as string, mode: 'insensitive' } },
      { salesPm:       { contains: search as string, mode: 'insensitive' } },
      { createdBy:     { name: { contains: search as string, mode: 'insensitive' } } },
      { clientManager: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (tm.role === 'PARTNER') {
    const partnerMember = await prisma.partnerMember.findFirst({
      where: { userId: tm.userId },
      select: { partnerCompanyId: true },
    });
    let companyIds: string[] = [];
    if (partnerMember) {
      const assigns = await prisma.partnerSiteAssign.findMany({
        where: { partnerCompanyId: partnerMember.partnerCompanyId },
        select: { siteId: true },
      });
      companyIds = assigns.map((a) => a.siteId);
    }
    const directAssigns = await prisma.siteAssignment.findMany({
      where: { userId: tm.userId },
      select: { siteId: true },
    });
    const directIds = directAssigns.map((a) => a.siteId);
    const allIds = Array.from(new Set([...companyIds, ...directIds]));
    if (allIds.length === 0) return res.status(200).json({ data: [] });
    where.id = { in: allIds };
  } else if (['GUEST', 'VIEWER'].includes(tm.role)) {
    where.assignments = { some: { userId: tm.userId } };
  }

  const sites = await prisma.site.findMany({
    where,
    include: {
      client: { select: { name: true } },
      createdBy: { select: { name: true, position: true } },
      shipments: { select: { quantity: true, status: true, sequence: true } },
      productionOrders: { select: { quantity: true, supplyDate: true, sequence: true } },
      sales: {
        orderBy: { createdAt: 'desc' }, take: 1,
        select: { status: true, estimateAmount: true, meetingNotes: true, createdAt: true },
      },
      _count: { select: { issues: true, documents: true, requests: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return res.status(200).json({ data: sites });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const {
    name, address, clientId, clientName, status, description,
    siteType, salesStage, estimatedAmount, salesNote,
    designOffice, salesPm, materialSpec, sectorType, salesOwner, clientContact,
    clientDept, clientManager, clientManagerPhone,
    contractNo, procurementNo, contractDate, contractAmount,
    contractQuantity, quantity, unitPrice, specification, productName,
    deliveryDeadline, warrantyPeriod, inspectionAgency, inspectionBody, acceptanceAgency,
    productItems,
  } = req.body;

  if (!name) return res.status(400).json({ error: { message: 'Name is required' } });
  const normalizedStatus = normalizeStatus(status);

  const site = await prisma.$transaction(async (tx) => {
    let resolvedClientId = clientId || null;
    if (clientName && !clientId) {
      const existing = await tx.client.findFirst({ where: { name: clientName, teamId: tm.teamId } });
      resolvedClientId = existing?.id ?? (await tx.client.create({ data: { name: clientName, teamId: tm.teamId } })).id;
    }
    const resolvedQty = contractQuantity ?? quantity ?? null;
    return await tx.site.create({
      data: {
        name, address: address || null, clientId: resolvedClientId,
        teamId: tm.teamId, status: normalizedStatus,
        siteType: siteType === '현장설치도' ? '납품설치도' : (siteType || '납품설치도'),
        salesStage: salesStage || null,
        estimatedAmount: estimatedAmount ? Number(String(estimatedAmount).replace(/,/g, '')) : null,
        salesNote: salesNote || null,
        designOffice: designOffice || null, salesPm: salesPm || null,
        materialSpec: materialSpec || null, sectorType: sectorType || null,
        salesOwner: salesOwner || null, clientContact: clientContact || null,
        description: description || null,
        clientDept: clientDept || null, clientManager: clientManager || null,
        clientManagerPhone: clientManagerPhone || null,
        contractNo: contractNo || null, procurementNo: procurementNo || null,
        contractDate: contractDate ? new Date(contractDate) : null,
        contractAmount: contractAmount ? Number(String(contractAmount).replace(/,/g, '')) : null,
        contractQuantity: resolvedQty ? Number(String(resolvedQty).replace(/,/g, '')) : null,
        unitPrice: unitPrice ? Number(String(unitPrice).replace(/,/g, '')) : null,
        specification: specification || null, productName: productName || null,
        deliveryDeadline: deliveryDeadline ? new Date(deliveryDeadline) : null,
        warrantyPeriod: warrantyPeriod ? Number(warrantyPeriod) : 2,
        inspectionAgency: inspectionAgency || null, inspectionBody: inspectionBody || null,
        acceptanceAgency: acceptanceAgency || null,
        productItems: (Array.isArray(productItems) && productItems.length > 0) ? productItems : undefined,
        createdById: session.user.id,
      },
    });
  });
  return res.status(201).json({ data: site });
};
