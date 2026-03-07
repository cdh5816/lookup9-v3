import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  if (req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  // 배정 확인
  const assignment = await prisma.siteAssignment.findFirst({
    where: { siteId: id, userId: session.user.id },
  });
  if (!assignment) return res.status(403).json({ error: { message: '배정된 현장이 아닙니다.' } });

  const site = await prisma.site.findUnique({
    where: { id },
    select: {
      id: true, name: true, address: true, status: true, description: true, createdAt: true,
      client: { select: { name: true } },
      // 출하 일정 (납품일정)
      shipments: {
        select: { id: true, shipmentNo: true, sequence: true, shippedAt: true, status: true, quantity: true, destination: true },
        orderBy: { sequence: 'desc' },
      },
      // 문서 (다운로드용)
      documents: {
        select: { id: true, fileName: true, fileSize: true, mimeType: true, type: true, createdAt: true,
          uploadedBy: { select: { name: true, position: true } } },
        orderBy: { createdAt: 'desc' },
      },
      // 내 요청사항
      requests: {
        where: { createdById: session.user.id },
        select: { id: true, title: true, type: true, status: true, priority: true, deadline: true, result: true, createdAt: true,
          handledBy: { select: { name: true, position: true } } },
        orderBy: { createdAt: 'desc' },
      },
      // 진행률 계산용
      _count: { select: { shipments: true } },
    },
  });

  if (!site) return res.status(404).json({ error: { message: 'Site not found' } });

  // 간단한 진행률 계산: 출하 완료 / 전체 출하
  const completedShipments = site.shipments.filter((s) => s.status === '인수완료').length;
  const totalShipments = site.shipments.length;
  const progressPercent = totalShipments > 0 ? Math.round((completedShipments / totalShipments) * 100) : 0;

  return res.status(200).json({
    data: {
      ...site,
      progress: { completedShipments, totalShipments, percent: progressPercent },
    },
  });
}
