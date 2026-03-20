import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });
  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(req, res, tm);
      case 'POST': return await handlePOST(req, res, session, tm);
      case 'PUT': return await handlePUT(req, res, session, tm);
      default: return res.status(405).json({ error: { message: 'Method not allowed' } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message } });
  }
}

// GET /api/inspections?siteId=xxx
const handleGET = async (req: NextApiRequest, res: NextApiResponse, tm: any) => {
  const { siteId, status } = req.query;
  const where: any = { teamId: tm.teamId };
  if (siteId) where.siteId = siteId as string;
  if (status && status !== 'all') where.status = status as string;

  const inspections = await prisma.inspection.findMany({
    where,
    include: {
      site: { select: { name: true } },
      requestedBy: { select: { name: true, position: true, company: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.status(200).json({ data: inspections });
};

// POST /api/inspections — 검수 요청 생성
const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const { siteId, title, description, inspectionType, scheduledDate, assignedToId } = req.body;
  if (!siteId || !title) return res.status(400).json({ error: { message: 'siteId, title 필수' } });

  const inspection = await prisma.inspection.create({
    data: {
      siteId,
      teamId: tm.teamId,
      title,
      description: description || null,
      inspectionType: inspectionType || 'DELIVERY',
      status: 'REQUESTED',
      requestedById: session.user.id,
      assignedToId: assignedToId || null,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
    },
  });

  // 알림 생성 (검수 요청)
  try {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } });
    const members = await prisma.teamMember.findMany({
      where: { teamId: tm.teamId, role: { in: ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'] } },
      select: { userId: true },
    });
    const notifData = members
      .filter(m => m.userId !== session.user.id)
      .map(m => ({
        userId: m.userId,
        teamId: tm.teamId,
        type: 'INSPECTION_REQUEST',
        title: `검수 요청: ${site?.name || ''}`,
        message: title,
        link: `/sites/${siteId}`,
      }));
    if (notifData.length > 0) {
      await prisma.notification.createMany({ data: notifData });
    }
  } catch (e) { void e; }

  return res.status(201).json({ data: inspection });
};

// PUT /api/inspections — 상태 변경 (승인/반려/완료)
const handlePUT = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const { inspectionId, status, result, resultNote, signatureData } = req.body;
  if (!inspectionId || !status) return res.status(400).json({ error: { message: 'inspectionId, status 필수' } });

  const updateData: any = { status, updatedAt: new Date() };
  if (result) updateData.result = result;
  if (resultNote) updateData.resultNote = resultNote;
  if (signatureData) updateData.signatureData = signatureData;
  if (['PASSED', 'FAILED'].includes(status)) {
    updateData.completedAt = new Date();
  }

  const inspection = await prisma.inspection.update({
    where: { id: inspectionId },
    data: updateData,
  });

  // 알림: 요청자에게 결과 알림
  try {
    const site = await prisma.site.findUnique({ where: { id: inspection.siteId }, select: { name: true } });
    await prisma.notification.create({
      data: {
        userId: inspection.requestedById,
        teamId: tm.teamId,
        type: 'INSPECTION_RESULT',
        title: `검수 ${status === 'PASSED' ? '승인' : status === 'FAILED' ? '반려' : '업데이트'}: ${site?.name || ''}`,
        message: resultNote || inspection.title,
        link: `/sites/${inspection.siteId}`,
      },
    });
  } catch (e) { void e; }

  return res.status(200).json({ data: inspection });
};
