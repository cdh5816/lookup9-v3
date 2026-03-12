import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';

async function notifyShipmentUsers(siteId: string, senderId: string, title: string, content: string) {
  const [site, assignments] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { teamId: true } }),
    prisma.siteAssignment.findMany({ where: { siteId }, select: { userId: true } }),
  ]);
  if (!site?.teamId) return;

  const deptUsers = await prisma.user.findMany({
    where: {
      teamMembers: { some: { teamId: site.teamId } },
      department: { in: ['출하팀', '생산관리팀', '공사팀', '경영지원부'] },
      NOT: { id: senderId },
    },
    select: { id: true },
  });

  const userIds = Array.from(new Set([...assignments.map((a) => a.userId), ...deptUsers.map((u) => u.id)].filter((id) => id && id !== senderId)));
  if (!userIds.length) return;

  await prisma.message.createMany({
    data: userIds.map((receiverId) => ({ senderId, receiverId, title, content })),
    skipDuplicates: true,
  });
}

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
        const lastShipment = await prisma.shippingRecord.findFirst({ where: { siteId: id }, orderBy: { sequence: 'desc' } });
        const sequence = (lastShipment?.sequence || 0) + 1;
        const record = await prisma.shippingRecord.create({
          data: {
            siteId: id,
            shipmentNo: shipmentNo || `SH-${sequence}`,
            sequence,
            shippedAt: shippedAt ? new Date(shippedAt) : null,
            shipmentType: shipmentType || null,
            quantity: quantity || null,
            vehicleInfo: vehicleInfo || null,
            driverInfo: driverInfo || null,
            destination: destination || null,
            receivedBy: receivedBy || null,
            notes: notes || null,
            createdById: session.user.id,
          },
          include: { createdBy: { select: { name: true, position: true } } },
        });
        await notifyShipmentUsers(id, session.user.id, `[출하등록] ${record.shipmentNo || `차수 ${record.sequence}`}`, `차량 ${record.vehicleInfo || '-'} / 기사 ${record.driverInfo || '-'} / 수량 ${record.quantity || '-'} 등록`);
        return res.status(201).json({ data: record });
      }
      case 'PUT': {
        const { recordId, status, ...fields } = req.body;
        if (!recordId) return res.status(400).json({ error: { message: 'recordId is required' } });
        const data: any = { ...fields, updatedAt: new Date() };
        if (status) data.status = status;
        if (fields.shippedAt) data.shippedAt = new Date(fields.shippedAt);
        const record = await prisma.shippingRecord.update({ where: { id: recordId }, data, include: { createdBy: { select: { name: true, position: true } } } });
        await notifyShipmentUsers(id, session.user.id, `[출하상태변경] ${record.shipmentNo || `차수 ${record.sequence}`}`, `${record.status} 상태로 변경되었습니다.`);
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
