import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  if (!(await verifySiteAccess(session.user.id, id))) return res.status(403).json({ error: { message: 'Forbidden' } });

  try {
    switch (req.method) {
      case 'POST': {
        const { contractAmount, quantity, unitPrice, specification, contractDate, isAdditional, specialNotes, status } = req.body;

        const parsedQty = quantity ? parseFloat(String(quantity).replace(/,/g, '')) : null;
        const parsedUnit = unitPrice ? parseFloat(String(unitPrice).replace(/,/g, '')) : null;
        // 금액 자동계산: 직접 입력 > 물량*단가
        const parsedAmt = contractAmount
          ? parseFloat(String(contractAmount).replace(/,/g, ''))
          : parsedQty && parsedUnit
            ? Math.round(parsedQty * parsedUnit)
            : null;

        const record = await prisma.contract.create({
          data: {
            siteId: id,
            status: status || '수주등록',
            contractAmount: parsedAmt,
            quantity: parsedQty,
            unitPrice: parsedUnit,
            specification: specification || null,
            contractDate: contractDate ? new Date(contractDate) : null,
            isAdditional: isAdditional === true || isAdditional === 'true',
            specialNotes: specialNotes || null,
            createdById: session.user.id,
          },
          include: { createdBy: { select: { name: true, position: true } } },
        });
        return res.status(201).json({ data: record });
      }

      case 'PUT': {
        const { contractId, contractAmount, quantity, unitPrice, specification, contractDate, isAdditional, specialNotes, status } = req.body;
        if (!contractId) return res.status(400).json({ error: { message: 'contractId is required' } });

        const parsedQty = quantity !== undefined ? (quantity ? parseFloat(String(quantity).replace(/,/g, '')) : null) : undefined;
        const parsedUnit = unitPrice !== undefined ? (unitPrice ? parseFloat(String(unitPrice).replace(/,/g, '')) : null) : undefined;
        const parsedAmt = contractAmount !== undefined
          ? (contractAmount ? parseFloat(String(contractAmount).replace(/,/g, '')) : null)
          : parsedQty && parsedUnit
            ? Math.round(parsedQty * parsedUnit)
            : undefined;

        const updateData: any = {};
        if (status !== undefined) updateData.status = status;
        if (specification !== undefined) updateData.specification = specification || null;
        if (contractDate !== undefined) updateData.contractDate = contractDate ? new Date(contractDate) : null;
        if (isAdditional !== undefined) updateData.isAdditional = isAdditional === true || isAdditional === 'true';
        if (specialNotes !== undefined) updateData.specialNotes = specialNotes || null;
        if (parsedQty !== undefined) updateData.quantity = parsedQty;
        if (parsedUnit !== undefined) updateData.unitPrice = parsedUnit;
        if (parsedAmt !== undefined) updateData.contractAmount = parsedAmt;
        updateData.updatedAt = new Date();

        const updated = await prisma.contract.update({
          where: { id: contractId },
          data: updateData,
          include: { createdBy: { select: { name: true, position: true } } },
        });
        return res.status(200).json({ data: updated });
      }

      case 'DELETE': {
        const { contractId } = req.body;
        if (!contractId) return res.status(400).json({ error: { message: 'contractId is required' } });
        await prisma.contract.delete({ where: { id: contractId } });
        return res.status(200).json({ data: { message: 'Deleted' } });
      }

      default:
        res.setHeader('Allow', 'POST, PUT, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
