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
      case 'PUT': return await handlePUT(req, res, tm);
      case 'DELETE': return await handleDELETE(req, res, tm);
      default: return res.status(405).json({ error: { message: 'Method not allowed' } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message } });
  }
}

// GET /api/calendar?siteId=xxx&month=2025-03
const handleGET = async (req: NextApiRequest, res: NextApiResponse, tm: any) => {
  const { siteId, month, startDate, endDate } = req.query;
  const where: any = { teamId: tm.teamId, isShared: true };

  if (siteId) where.siteId = siteId as string;

  // 월 필터 또는 날짜 범위
  if (month) {
    const [y, m] = (month as string).split('-').map(Number);
    where.startDate = {
      gte: new Date(y, m - 1, 1),
      lt: new Date(y, m, 1),
    };
  } else if (startDate && endDate) {
    where.startDate = {
      gte: new Date(startDate as string),
      lte: new Date(endDate as string),
    };
  }

  // PARTNER/GUEST: 본인 배정 현장만
  if (['PARTNER', 'GUEST', 'VIEWER'].includes(tm.role)) {
    const assigns = await prisma.siteAssignment.findMany({
      where: { userId: tm.userId },
      select: { siteId: true },
    });
    const siteIds = assigns.map(a => a.siteId);
    where.siteId = { in: siteIds };
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      site: { select: { name: true } },
      createdBy: { select: { name: true, position: true } },
    },
    orderBy: { startDate: 'asc' },
  });
  return res.status(200).json({ data: events });
};

// POST /api/calendar
const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const { siteId, title, description, eventType, startDate, endDate, allDay, location, color } = req.body;
  if (!title || !startDate) return res.status(400).json({ error: { message: 'title, startDate 필수' } });

  const event = await prisma.calendarEvent.create({
    data: {
      siteId: siteId || null,
      teamId: tm.teamId,
      title,
      description: description || null,
      eventType: eventType || 'GENERAL',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      allDay: allDay || false,
      location: location || null,
      createdById: session.user.id,
      isShared: true,
      color: color || null,
    },
  });
  return res.status(201).json({ data: event });
};

// PUT /api/calendar
const handlePUT = async (req: NextApiRequest, res: NextApiResponse, tm: any) => {
  const { eventId, title, description, startDate, endDate, allDay, location, color, eventType } = req.body;
  if (!eventId) return res.status(400).json({ error: { message: 'eventId 필수' } });

  const existing = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
  if (!existing || existing.teamId !== tm.teamId) return res.status(404).json({ error: { message: 'Not found' } });

  const updateData: any = { updatedAt: new Date() };
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (startDate) updateData.startDate = new Date(startDate);
  if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
  if (allDay !== undefined) updateData.allDay = allDay;
  if (location !== undefined) updateData.location = location;
  if (color !== undefined) updateData.color = color;
  if (eventType !== undefined) updateData.eventType = eventType;

  const event = await prisma.calendarEvent.update({ where: { id: eventId }, data: updateData });
  return res.status(200).json({ data: event });
};

// DELETE /api/calendar?eventId=xxx
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, tm: any) => {
  const { eventId } = req.query;
  if (!eventId) return res.status(400).json({ error: { message: 'eventId 필수' } });

  const existing = await prisma.calendarEvent.findUnique({ where: { id: eventId as string } });
  if (!existing || existing.teamId !== tm.teamId) return res.status(404).json({ error: { message: 'Not found' } });

  await prisma.calendarEvent.delete({ where: { id: eventId as string } });
  return res.status(200).json({ data: { deleted: true } });
};
