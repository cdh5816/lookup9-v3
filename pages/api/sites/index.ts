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
  const { status, search } = req.query;

  const where: any = { teamId: tm.teamId };
  if (status && status !== 'all') where.status = status;
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
      contracts: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, contractAmount: true, quantity: true,
          unitPrice: true, specification: true, isAdditional: true, contractDate: true,
        },
      },
      shipments: {
        select: { quantity: true, status: true },
      },
      requests: {
        select: { status: true },
      },
      _count: {
        select: { issues: true, documents: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json({ data: sites });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const {
    name, address, clientId, status, description,
    specification, quantity, unitPrice, contractAmount,
    contractDate, deliveryDeadline, installer, siteType,
  } = req.body;

  if (!name) return res.status(400).json({ error: { message: 'Name is required' } });

  const descLines = [
    siteType ? `현장구분: ${siteType}` : '',
    installer ? `전문시공사: ${installer}` : '',
    deliveryDeadline ? `납품기한: ${deliveryDeadline}` : '',
    description || '',
  ].filter(Boolean);

  const site = await prisma.$transaction(async (tx) => {
    const newSite = await tx.site.create({
      data: {
        name, address: address || null,
        clientId: clientId || null,
        teamId: tm.teamId,
        status: status || '대기',
        siteType: siteType || '납품설치도',
        description: descLines.join('\n') || null,
        createdById: session.user.id,
      },
    });

    const hasContractInfo = quantity || unitPrice || contractAmount || specification;
    if (hasContractInfo) {
      const parsedQty = quantity ? parseFloat(String(quantity).replace(/,/g, '')) : null;
      const parsedUnit = unitPrice ? parseFloat(String(unitPrice).replace(/,/g, '')) : null;
      const parsedAmt = contractAmount
        ? parseFloat(String(contractAmount).replace(/,/g, ''))
        : parsedQty && parsedUnit ? Math.round(parsedQty * parsedUnit) : null;

      await tx.contract.create({
        data: {
          siteId: newSite.id, status: '수주등록',
          contractAmount: parsedAmt, quantity: parsedQty, unitPrice: parsedUnit,
          specification: specification || null,
          contractDate: contractDate ? new Date(contractDate) : null,
          isAdditional: false, createdById: session.user.id,
        },
      });
    }

    return newSite;
  });

  return res.status(201).json({ data: site });
};
