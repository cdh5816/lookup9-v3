import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getDepartmentAccessMap, getTeamMemberByUserId, hasMinRole } from '@/lib/team-helper';

async function sendDeptMessages(teamId: string, department: string | null | undefined, title: string, content: string, senderId: string) {
  const where: any = {
    teamMembers: { some: { teamId } },
    id: { not: senderId },
  };
  if (department) {
    where.OR = [
      { department: { contains: department, mode: 'insensitive' } },
      { position: { contains: '부장', mode: 'insensitive' } },
      { position: { contains: '팀장', mode: 'insensitive' } },
    ];
  }

  const receivers = await prisma.user.findMany({ where, select: { id: true } });
  if (!receivers.length) return;

  await prisma.message.createMany({
    data: receivers.map((user) => ({ senderId, receiverId: user.id, title, content })),
    skipDuplicates: true,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  try {
    if (req.method === 'GET') {
      const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true, position: true } });
      const access = getDepartmentAccessMap(tm.role, me?.department);
      if (!access.approvals) {
        return res.status(403).json({ error: { message: '전자결재 열람 권한이 없습니다.' } });
      }

      const where: any = {
        site: { teamId: tm.teamId },
        OR: [{ type: '전자결재' }, { type: '미팅요청' }, { type: '변경승인' }],
      };

      if (!hasMinRole(tm.role, 'ADMIN_HR')) {
        where.AND = [
          {
            OR: [
              { targetDept: me?.department || null },
              { targetDept: null },
              { createdById: session.user.id },
            ],
          },
        ];
      }

      const items = await prisma.request.findMany({
        where,
        include: {
          site: { select: { id: true, name: true, status: true } },
          createdBy: { select: { id: true, name: true, department: true, position: true } },
          handledBy: { select: { id: true, name: true, department: true, position: true } },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 80,
      });

      return res.status(200).json({ data: items });
    }

    if (req.method === 'POST') {
      const { siteId, title, description, targetDept, priority, type } = req.body;
      if (!siteId || !title) return res.status(400).json({ error: { message: 'siteId, title are required' } });

      const item = await prisma.request.create({
        data: {
          siteId,
          title,
          type: type || '전자결재',
          priority: priority || '보통',
          targetDept: targetDept || null,
          description: description || null,
          createdById: session.user.id,
          status: '결재대기',
        },
        include: {
          site: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, department: true, position: true } },
        },
      });

      await sendDeptMessages(
        tm.teamId,
        targetDept,
        `[전자결재] ${title}`,
        `${item.site.name} 현장 결재 요청이 등록되었습니다.`,
        session.user.id
      );

      return res.status(201).json({ data: item });
    }

    if (req.method === 'PUT') {
      const { requestId, status, result } = req.body;
      if (!requestId || !status) return res.status(400).json({ error: { message: 'requestId, status are required' } });

      const item = await prisma.request.update({
        where: { id: requestId },
        data: {
          status,
          result: result || null,
          handledById: session.user.id,
          updatedAt: new Date(),
        },
        include: {
          site: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      await prisma.message.create({
        data: {
          senderId: session.user.id,
          receiverId: item.createdBy.id,
          title: `[전자결재 ${status}] ${item.title}`,
          content: `${item.site.name} 현장 결재 요청이 ${status} 처리되었습니다.${result ? `\n처리내용: ${result}` : ''}`,
        },
      });

      return res.status(200).json({ data: item });
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
