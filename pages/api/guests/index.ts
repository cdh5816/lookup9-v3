import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId, hasMinRole } from '@/lib/team-helper';
import { hashPassword } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  // 협력사(PARTNER)도 게스트 생성 가능 (자신이 배정된 현장에 한해)
  const canCreate = hasMinRole(tm.role, 'MANAGER') || tm.role === 'PARTNER';
  if (!canCreate && req.method !== 'GET') {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  try {
    switch (req.method) {
      case 'GET': return await handleGET(req, res, tm);
      case 'POST': return await handlePOST(req, res, session, tm);
      default:
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (req: NextApiRequest, res: NextApiResponse, tm: any) => {
  const guests = await prisma.user.findMany({
    where: {
      teamMembers: { some: { teamId: tm.teamId, role: { in: ['GUEST', 'VIEWER'] } } },
    },
    include: {
      teamMembers: { where: { teamId: tm.teamId }, select: { role: true } },
      siteAssignments: { include: { site: { select: { id: true, name: true, status: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 현장 목록 (배정용)
  const siteWhere: any = { teamId: tm.teamId };
  if (tm.role === 'PARTNER') {
    siteWhere.assignments = { some: { userId: tm.userId } };
  }
  const siteOptions = await prisma.site.findMany({
    where: siteWhere,
    select: { id: true, name: true, status: true },
    orderBy: { createdAt: 'desc' },
  });

  const creatableRoles = tm.role === 'PARTNER' ? ['GUEST'] : ['GUEST', 'VIEWER'];

  return res.status(200).json({
    data: guests,
    meta: { siteOptions, creatableRoles },
  });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const { name, username, email, password, company, position, phone, role, assignedSiteIds } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: { message: '이름, 아이디, 비밀번호는 필수입니다.' } });
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) return res.status(400).json({ error: { message: '이미 사용 중인 아이디입니다.' } });

  const finalEmail = email && email.trim() ? email.trim() : `${username}@internal.lookup9`;

  const guestRole = role === 'VIEWER' ? 'VIEWER' : 'GUEST';

  // 협력사는 자신이 배정된 현장에만 게스트 생성 가능
  let allowedSiteIds = assignedSiteIds ?? [];
  if (tm.role === 'PARTNER' && allowedSiteIds.length > 0) {
    const myAssignments = await prisma.siteAssignment.findMany({
      where: { userId: tm.userId, siteId: { in: allowedSiteIds } },
      select: { siteId: true },
    });
    allowedSiteIds = myAssignments.map((a: any) => a.siteId);
  }

  const existing = await prisma.user.findUnique({ where: { email: finalEmail } });
  if (existing) return res.status(400).json({ error: { message: '이미 사용 중인 이메일입니다.' } });

  const hashed = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name, username, email: finalEmail, password: hashed,
        company: company || null,
        position: position || null,
        phone: phone || null,
        department: '게스트',
      },
    });

    await tx.teamMember.create({
      data: { teamId: tm.teamId, userId: newUser.id, role: guestRole },
    });

    for (const siteId of allowedSiteIds) {
      await tx.siteAssignment.upsert({
        where: { siteId_userId: { siteId, userId: newUser.id } },
        update: {},
        create: { siteId, userId: newUser.id, assignedRole: guestRole },
      });
    }

    return newUser;
  });

  return res.status(201).json({ data: user });
};
