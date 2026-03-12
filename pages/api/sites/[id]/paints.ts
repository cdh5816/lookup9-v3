import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';

async function notifyPaintUsers(siteId: string, senderId: string, title: string, content: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { teamId: true } });
  if (!site?.teamId) return;
  const users = await prisma.user.findMany({
    where: {
      teamMembers: { some: { teamId: site.teamId } },
      department: { in: ['도장팀', '생산관리팀', '경영지원부'] },
      NOT: { id: senderId },
    },
    select: { id: true },
  });
  if (!users.length) return;
  await prisma.notification.createMany({
    data: users.map((user) => ({ userId: user.id, type: 'PAINT', title, message: content, link: `/sites/${siteId}`, siteId, entityType: 'PaintSpec' })),
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
            notes: notes || null,
            status: '도료발주대기',
          },
          include: { confirmedBy: { select: { name: true, position: true } } },
        });
        await notifyPaintUsers(id, session.user.id, `[도장] ${colorName}`, `도료 발주대기 항목이 등록되었습니다. 코드 ${colorCode}`);
        return res.status(201).json({ data: spec });
      }
      case 'PUT': {
        const { specId, status, ...fields } = req.body;
        if (!specId) return res.status(400).json({ error: { message: 'specId is required' } });
        const data: any = { ...fields, updatedAt: new Date() };
        if (status) {
          data.status = status;
          if (status === '확정') {
            data.confirmedById = session.user.id;
            data.confirmedAt = new Date();
          }
        }
        const spec = await prisma.paintSpec.update({ where: { id: specId }, data, include: { confirmedBy: { select: { name: true, position: true } } } });
        await notifyPaintUsers(id, session.user.id, `[도장상태변경] ${spec.colorName}`, `${spec.colorCode} 항목이 ${spec.status} 상태로 변경되었습니다.`);
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
