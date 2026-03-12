import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess, findUsersByTargetDept } from '@/lib/team-helper';

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
            notes: notes || null,
            status: '도료발주대기',
          },
          include: { confirmedBy: { select: { name: true, position: true } } },
        });

        const site = await prisma.site.findUnique({ where: { id }, select: { name: true, teamId: true } });
        if (site) {
          const receivers = await findUsersByTargetDept(site.teamId || tm.teamId, '도장팀');
          if (receivers.length > 0) {
            await prisma.message.createMany({
              data: receivers
                .filter((user) => user.id !== session.user.id)
                .map((user) => ({
                  senderId: session.user.id,
                  receiverId: user.id,
                  title: `[도료발주] ${colorName}`,
                  content: `${site.name}\n코드: ${colorCode}\n수량: ${quantity || '-'}\n상태: 도료발주대기`,
                })),
            });
          }
        }

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
