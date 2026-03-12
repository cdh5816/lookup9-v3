import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';

async function notifyPaintDept(teamId: string, senderId: string, title: string, content: string) {
  const users = await prisma.user.findMany({
    where: {
      id: { not: senderId },
      teamMembers: { some: { teamId } },
      OR: [
        { department: { contains: '도장', mode: 'insensitive' } },
        { department: { contains: '생산', mode: 'insensitive' } },
        { position: { contains: '팀장', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  if (!users.length) return;
  await prisma.message.createMany({
    data: users.map((user) => ({ senderId, receiverId: user.id, title, content })),
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Invalid site id' } });

  const tm = await verifySiteAccess(session.user.id, id);
  if (!tm) return res.status(403).json({ error: { message: 'Forbidden' } });

  try {
    switch (req.method) {
      case 'POST': {
        const { colorCode, colorName, manufacturer, finishType, area, quantity, isPrimary, notes } = req.body;
        if (!colorCode || !colorName) return res.status(400).json({ error: { message: '색상 코드와 색상명은 필수입니다.' } });
        const spec = await prisma.paintSpec.create({
          data: {
            siteId: id,
            colorCode,
            colorName,
            manufacturer: manufacturer || null,
            finishType: finishType || null,
            area: area || null,
            quantity: quantity || null,
            isPrimary: isPrimary || false,
            status: '발주대기',
            notes: notes || null,
          },
          include: { confirmedBy: { select: { name: true, position: true } }, site: { select: { name: true } } },
        });
        await notifyPaintDept(tm.teamId, session.user.id, `[도료발주대기] ${spec.site.name}`, `${colorName} (${colorCode}) / 수량 ${quantity || '-'} 등록됨`);
        return res.status(201).json({ data: spec });
      }
      case 'PUT': {
        const { specId, status, ...fields } = req.body;
        if (!specId) return res.status(400).json({ error: { message: 'specId is required' } });
        const data: any = { ...fields, updatedAt: new Date() };
        if (status) {
          data.status = status;
          if (status === '확정' || status === '발주완료') {
            data.confirmedById = session.user.id;
            data.confirmedAt = new Date();
          }
        }
        const spec = await prisma.paintSpec.update({ where: { id: specId }, data, include: { confirmedBy: { select: { name: true, position: true } } } });
        return res.status(200).json({ data: spec });
      }
      case 'DELETE': {
        const { specId } = req.body;
        if (!specId) return res.status(400).json({ error: { message: 'specId is required' } });
        await prisma.paintSpec.delete({ where: { id: specId } });
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
