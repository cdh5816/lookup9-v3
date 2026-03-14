/* eslint-disable i18next/no-literal-string */
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
      // 차수 목록 조회
      case 'GET': {
        const orders = await prisma.productionOrder.findMany({
          where: { siteId: id },
          orderBy: { sequence: 'asc' },
          include: { createdBy: { select: { name: true, position: true } } },
        });
        return res.status(200).json({ data: orders });
      }

      // 차수 추가
      case 'POST': {
        const { quantity, orderDate, supplyDate, notes } = req.body;
        const last = await prisma.productionOrder.findFirst({ where: { siteId: id }, orderBy: { sequence: 'desc' } });
        const sequence = (last?.sequence || 0) + 1;
        const order = await prisma.productionOrder.create({
          data: {
            siteId: id,
            sequence,
            quantity: quantity ? Number(String(quantity).replace(/,/g, '')) : null,
            orderDate: orderDate ? new Date(orderDate) : null,
            supplyDate: supplyDate ? new Date(supplyDate) : null,
            notes,
            createdById: session.user.id,
          },
        });
        return res.status(201).json({ data: order });
      }

      // 차수 수정 (공급일 등)
      case 'PUT': {
        const { orderId, quantity, orderDate, supplyDate, notes } = req.body;
        if (!orderId) return res.status(400).json({ error: { message: 'orderId required' } });
        const updated = await prisma.productionOrder.update({
          where: { id: orderId },
          data: {
            quantity: quantity !== undefined ? (quantity ? Number(String(quantity).replace(/,/g, '')) : null) : undefined,
            orderDate: orderDate !== undefined ? (orderDate ? new Date(orderDate) : null) : undefined,
            supplyDate: supplyDate !== undefined ? (supplyDate ? new Date(supplyDate) : null) : undefined,
            notes: notes !== undefined ? notes : undefined,
            updatedAt: new Date(),
          },
        });
        return res.status(200).json({ data: updated });
      }

      // 차수 삭제
      case 'DELETE': {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ error: { message: 'orderId required' } });
        await prisma.productionOrder.delete({ where: { id: orderId } });
        return res.status(200).json({ data: { success: true } });
      }

      default:
        return res.status(405).json({ error: { message: 'Method not allowed' } });
    }
  } catch (err: any) {
    console.error('production API error:', err);
    return res.status(500).json({ error: { message: err.message || 'Internal server error' } });
  }
}
