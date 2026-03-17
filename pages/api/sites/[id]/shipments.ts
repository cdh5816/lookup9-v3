import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';

async function notifyShipmentUsers(siteId: string, senderId: string, title: string, content: string) {
  const [site, assignments] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { teamId: true } }),
    prisma.siteAssignment.findMany({
      where: { siteId },
      select: { userId: true },
    }),
  ]);
  if (!site?.teamId) return;

  // 출하 알람: 관련 부서 내부 직원 + 현장 배정된 PARTNER(협력사)
  const deptUsers = await prisma.user.findMany({
    where: {
      teamMembers: { some: { teamId: site.teamId } },
      department: { in: ['출하팀', '생산관리팀', '공사팀', '경영지원부', '생산부', '출하부'] },
      NOT: { id: senderId },
    },
    select: { id: true },
  });

  // 현장에 배정된 협력사(PARTNER) 계정도 알람 대상
  const partnerUsers = await prisma.user.findMany({
    where: {
      id: { in: assignments.map(a => a.userId) },
      teamMembers: { some: { teamId: site.teamId, role: 'PARTNER' } },
      NOT: { id: senderId },
    },
    select: { id: true },
  });

  const userIds = Array.from(new Set(
    [...assignments.map((a) => a.userId), ...deptUsers.map((u) => u.id), ...partnerUsers.map((u) => u.id)]
      .filter((id) => id && id !== senderId)
  ));
  if (!userIds.length) return;

  await prisma.message.createMany({
    data: userIds.map((receiverId) => ({ senderId, receiverId, title, content })),
    skipDuplicates: true,
  });

  // 알림(Notification)도 생성
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: 'SHIPMENT_REGISTERED',
      title,
      message: content,
      link: `/sites/${siteId}?tab=shipping`,
      siteId,
    })),
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

        // ── 출하 등록 시 → 생산 차수에 공급일 자동 기록 ──
        // 같은 차수(sequence)의 생산 발주가 있으면 supplyDate를 shippedAt으로 업데이트
        if (shippedAt) {
          const prodOrder = await prisma.productionOrder.findFirst({
            where: { siteId: id, sequence },
          });
          if (prodOrder && !prodOrder.supplyDate) {
            await prisma.productionOrder.update({
              where: { id: prodOrder.id },
              data: { supplyDate: new Date(shippedAt) },
            });
          } else if (!prodOrder) {
            // 생산 발주 차수가 없으면 자동 생성
            await prisma.productionOrder.create({
              data: {
                siteId: id,
                sequence,
                quantity: quantity ? Number(String(quantity).replace(/,/g, '')) : null,
                supplyDate: new Date(shippedAt),
                notes: `출하 ${sequence}차 자동 연동`,
                createdById: session.user.id,
              },
            });
          }
        }

        await notifyShipmentUsers(
          id,
          session.user.id,
          `[출하등록] ${record.shipmentNo || `${sequence}차`} 출하 등록됨`,
          `수량: ${record.quantity || '-'} / 차량: ${record.vehicleInfo || '-'} / 기사: ${record.driverInfo || '-'} / 출고일: ${shippedAt || '-'}`
        );

        return res.status(201).json({ data: record });
      }

      case 'PUT': {
        const { recordId, status, ...fields } = req.body;
        if (!recordId) return res.status(400).json({ error: { message: 'recordId is required' } });

        const data: any = { ...fields, updatedAt: new Date() };
        if (status) data.status = status;
        if (fields.shippedAt) data.shippedAt = new Date(fields.shippedAt);

        const record = await prisma.shippingRecord.update({
          where: { id: recordId },
          data,
          include: { createdBy: { select: { name: true, position: true } } },
        });

        // 출하 상태가 '인수완료'로 변경될 때 생산 공급일도 업데이트
        if (status === '인수완료' && record.shippedAt) {
          const prodOrder = await prisma.productionOrder.findFirst({
            where: { siteId: id, sequence: record.sequence },
          });
          if (prodOrder) {
            await prisma.productionOrder.update({
              where: { id: prodOrder.id },
              data: { supplyDate: record.shippedAt },
            });
          }
        }

        await notifyShipmentUsers(
          id,
          session.user.id,
          `[출하상태변경] ${record.shipmentNo || `${record.sequence}차`}`,
          `${record.status} 상태로 변경되었습니다.`
        );

        return res.status(200).json({ data: record });
      }

      case 'DELETE': {
        const { recordId } = req.body;
        if (!recordId) return res.status(400).json({ error: { message: 'recordId is required' } });
        await prisma.shippingRecord.delete({ where: { id: recordId } });
        return res.status(200).json({ data: { message: 'Deleted' } });
      }

      default:
        return res.status(405).json({ error: { message: 'Method not allowed' } });
    }
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Internal server error' } });
  }
}
