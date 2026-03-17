import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  // PARTNER 또는 MANAGER 이상만
  const allowed = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'PARTNER'];
  if (!allowed.includes(tm.role)) return res.status(403).json({ error: { message: 'Forbidden' } });

  try {
    switch (req.method) {
      case 'GET': {
        // PARTNER가 만든 게스트 목록 (같은 팀, GUEST 역할만)
        const guests = await prisma.teamMember.findMany({
          where: { teamId: tm.teamId, role: 'GUEST' },
          include: { user: { select: { id: true, name: true, email: true, phone: true, company: true, createdAt: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({ data: guests.map((g) => ({ ...g.user, role: g.role })) });
      }

      case 'POST': {
        const { name, username, email, password, phone, company } = req.body;
        if (!name || !username || !password) return res.status(400).json({ error: { message: '이름, 아이디, 비밀번호는 필수입니다.' } });

        const existingUsername = await prisma.user.findUnique({ where: { username } });
        if (existingUsername) return res.status(400).json({ error: { message: '이미 등록된 아이디입니다.' } });

        const finalEmail = email && email.trim() ? email.trim() : `${username}@internal.lookup9`;
        const existingEmail = await prisma.user.findUnique({ where: { email: finalEmail } });
        if (existingEmail) return res.status(400).json({ error: { message: '이미 등록된 이메일입니다.' } });

        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
          data: { name, username, email: finalEmail, password: hashedPassword, phone: phone || null, company: company || null },
        });

        await prisma.teamMember.create({
          data: { teamId: tm.teamId, userId: user.id, role: 'GUEST' },
        });

        return res.status(201).json({ data: user });
      }

      case 'DELETE': {
        const { guestId } = req.body;
        if (!guestId) return res.status(400).json({ error: { message: 'guestId required' } });

        // 해당 팀의 GUEST인지 확인
        const guestMember = await prisma.teamMember.findFirst({
          where: { teamId: tm.teamId, userId: guestId, role: 'GUEST' },
        });
        if (!guestMember) return res.status(404).json({ error: { message: 'Guest not found' } });

        await prisma.teamMember.deleteMany({ where: { teamId: tm.teamId, userId: guestId } });
        return res.status(200).json({ data: { ok: true } });
      }

      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
