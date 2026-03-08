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
        const { shipmentNo, shippedAt, shipmentType, quantity, vehicleInfo, driverInfo, destination, receivedBy, notes } = req.body;
        // 자동 차수 계산
        const lastShipment = await prisma.shippingRecord.findFirst({ where: { siteId: id }, orderBy: { sequence: 'desc' } });
        const sequence = (lastShipment?.sequence || 0) + 1;
        const record = await prisma.shippingRecord.create({
          data: { siteId: id, shipmentNo: shipmentNo || `SH-${sequence}`, sequence, shippedAt: shippedAt ? new Date(shippedAt) : null, shipmentType: shipmentType || null, quantity: quantity || null, vehicleInfo: vehicleInfo || null, driverInfo: driverInfo || null, destination: destination || null, receivedBy: receivedBy || null, notes: notes || null, createdById: session.user.id },
          include: { createdBy: { select: { name: true, position: true } } },
        });
        return res.status(201).json({ data: record });
      }
      case 'PUT': {
        const { recordId, status, ...fields } = req.body;
        if (!recordId) return res.status(400).json({ error: { message: 'recordId is required' } });
        const data: any = { ...fields, updatedAt: new Date() };
        if (status) data.status = status;
        if (fields.shippedAt) data.shippedAt = new Date(fields.shippedAt);
        const record = await prisma.shippingRecord.update({ where: { id: recordId }, data, include: { createdBy: { select: { name: true, position: true } } } });
        return res.status(200).json({ data: record });
      }
      case 'DELETE': {
        const { recordId } = req.body;
        if (!recordId) return res.status(400).json({ error: { message: 'recordId is required' } });
        await prisma.shippingRecord.delete({ where: { id: recordId } });
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
