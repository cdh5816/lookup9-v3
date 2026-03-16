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
      siteAssignments: {
        include: {
          site: { select: { id: true, name: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 삭제되지 않은 활성 현장만 필터링 (FAILED/SALES_PIPELINE 제외)
  const guestsFiltered = guests.map(g => ({
    ...g,
    siteAssignments: g.siteAssignments.filter(a =>
      a.site && ['CONTRACT_ACTIVE', 'COMPLETED', 'WARRANTY', 'SALES_CONFIRMED'].includes(a.site.status)
    ),
  }));

  // 현장 목록 (배정용) - 활성 현장만
  const siteWhere: any = {
    teamId: tm.teamId,
    status: { in: ['CONTRACT_ACTIVE', 'COMPLETED', 'WARRANTY'] },
  };
  if (tm.role === 'PARTNER') {
    siteWhere.assignments = { some: { userId: tm.userId } };
  }

  const siteOptions = await prisma.site.findMany({
    where: siteWhere,
    select: { id: true, name: true, status: true },
    orderBy: { name: 'asc' },
  });

  const creatableRoles = hasMinRole(tm.role, 'MANAGER') ? ['GUEST', 'VIEWER'] : ['GUEST'];

  return res.status(200).json({
    data: guestsFiltered,
    meta: { siteOptions, creatableRoles },
  });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const { name, username, email, password, position, phone, company, role, siteIds } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: { message: '이름, 아이디, 비밀번호는 필수입니다.' } });
  }

  const targetRole = role || 'GUEST';
  if (!['GUEST', 'VIEWER'].includes(targetRole)) {
    return res.status(400).json({ error: { message: '게스트 또는 뷰어 역할만 생성할 수 있습니다.' } });
  }

  if (!Array.isArray(siteIds) || siteIds.length === 0) {
    return res.status(400).json({ error: { message: '최소 1개 현장을 지정해야 합니다.' } });
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) return res.status(400).json({ error: { message: '이미 사용 중인 아이디입니다.' } });

  const finalEmail = email?.trim() || `${username}@internal.lookup9`;
  const existingEmail = await prisma.user.findUnique({ where: { email: finalEmail } });
  if (existingEmail) return res.status(400).json({ error: { message: '이미 사용 중인 아이디입니다.' } });

  // PARTNER는 자신이 배정된 현장에만 게스트 생성 가능
  if (tm.role === 'PARTNER') {
    const myAssignments = await prisma.siteAssignment.findMany({
      where: { userId: tm.userId, siteId: { in: siteIds } },
      select: { siteId: true },
    });
    if (myAssignments.length !== siteIds.length) {
      return res.status(403).json({ error: { message: '배정된 현장에만 게스트를 생성할 수 있습니다.' } });
    }
  }

  const hashed = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name, username, email: finalEmail, password: hashed,
        position: position || null, phone: phone || null, company: company || null,
      },
    });
    await tx.teamMember.create({ data: { teamId: tm.teamId, userId: created.id, role: targetRole } });
    await tx.siteAssignment.createMany({
      data: siteIds.map((siteId: string) => ({ siteId, userId: created.id, assignedRole: targetRole })),
      skipDuplicates: true,
    });
    return created;
  });

  return res.status(201).json({ data: user });
};
