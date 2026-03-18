import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import {
  getTeamMemberByUserId,
  hasMinRole,
  canDeleteUser,
  canAssignRole,
  isExternalRole,
  deleteUserFully,
  isCompanyAdminRole,
  isSystemRole,
} from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  // 계정관리 접근: MANAGER 이상 (MANAGER는 게스트/협력사만, ADMIN_HR는 전체)
  if (!hasMinRole(tm.role, 'MANAGER')) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGET(tm.teamId, tm.role, session.user.id, res);
      case 'POST':
        return await handlePOST(req, res, tm);
      case 'DELETE':
        return await handleDELETE(req, res, tm, session.user.id);
      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (teamId: string, actorRole: string, actorUserId: string, res: NextApiResponse) => {
  const [members, sites] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            company: true,
            department: true,
            position: true,
            phone: true,
            createdAt: true,
            siteAssignments: {
              where: { site: { teamId } },
              include: {
                site: { select: { id: true, name: true, status: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.site.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, status: true },
    }),
  ]);

  // SUPER_ADMIN/OWNER 계정은 항상 비노출
  const users = members
    .filter((m) => !['SUPER_ADMIN', 'OWNER'].includes(m.role))
    .map((m) => ({
      ...m.user,
      role: m.role,
      teamMembers: [{ role: m.role, team: { name: (m as any).team?.name || teamId } }],
      assignedSites: (m.user.siteAssignments || []).map((a) => a.site),
    }));

  return res.status(200).json({
    data: users,
    meta: {
      sites,
      actorRole,
      // 삭제 가능 여부: ADMIN_HR 또는 SUPER_ADMIN만
      canDelete: isCompanyAdminRole(actorRole) || isSystemRole(actorRole),
      // ADMIN_HR 생성 가능 여부: SUPER_ADMIN 전용
      canCreateAdmin: isSystemRole(actorRole),
    },
  });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, actorTm: any) => {
  const { name, username, email, password, company, department, position, phone, role, siteIds } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: { message: '이름, 아이디, 비밀번호는 필수입니다.' } });
  }

  // username 중복 체크
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) return res.status(400).json({ error: { message: '이미 사용 중인 아이디입니다.' } });

  // 내부 이메일 생성
  const finalEmail = email && email.trim() ? email.trim() : `${username}@internal.lookup9`;

  const targetRole = role || 'USER';

  if (!canAssignRole(actorTm.role, targetRole)) {
    if (targetRole === 'ADMIN_HR' || targetRole === 'ADMIN') {
      return res.status(403).json({ error: { message: 'Company Admin 계정은 시스템 관리자만 생성할 수 있습니다.' } });
    }
    return res.status(403).json({ error: { message: `${targetRole} 역할을 부여할 수 없습니다.` } });
  }

  const normalizedSiteIds = Array.isArray(siteIds)
    ? Array.from(new Set(siteIds.filter((id: unknown) => typeof id === 'string' && id.trim())))
    : [];

  // PARTNER는 협력업체 관리에서 현장 배정 → 현장 필수 아님
  // GUEST/VIEWER만 현장 필수
  if (['GUEST', 'VIEWER'].includes(targetRole) && normalizedSiteIds.length === 0) {
    return res
      .status(400)
      .json({ error: { message: '게스트 계정은 최소 1개 현장을 지정해야 합니다.' } });
  }

  // 현장 회사 스코프 검증
  if (normalizedSiteIds.length > 0) {
    const siteCount = await prisma.site.count({
      where: { teamId: actorTm.teamId, id: { in: normalizedSiteIds } },
    });
    if (siteCount !== normalizedSiteIds.length) {
      return res
        .status(400)
        .json({ error: { message: '선택한 현장 중 다른 회사 현장이 포함되어 있습니다.' } });
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: finalEmail } });
  if (existing) return res.status(400).json({ error: { message: '이미 사용 중인 이메일입니다.' } });

  const hashedPassword = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        username,
        email: finalEmail,
        password: hashedPassword,
        company: company || actorTm.team?.name || null,
        department: department || null,
        position: position || null,
        phone: phone || null,
      },
    });

    await tx.teamMember.create({
      data: { teamId: actorTm.teamId, userId: created.id, role: targetRole },
    });

    if (normalizedSiteIds.length > 0) {
      await tx.siteAssignment.createMany({
        data: normalizedSiteIds.map((siteId: string) => ({
          siteId,
          userId: created.id,
          assignedRole: targetRole,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  return res.status(201).json({ data: user });
};

const handleDELETE = async (
  req: NextApiRequest,
  res: NextApiResponse,
  actorTm: any,
  actorUserId: string
) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });

  const targetTm = await prisma.teamMember.findFirst({
    where: { teamId: actorTm.teamId, userId },
  });
  if (!targetTm) return res.status(404).json({ error: { message: 'User not found in team' } });

  if (!canDeleteUser(actorTm.role, actorUserId, targetTm.role, userId)) {
    return res.status(403).json({ error: { message: '이 사용자를 삭제할 권한이 없습니다.' } });
  }

  const result = await deleteUserFully(userId, actorTm.teamId);
  if (!result.ok) {
    return res.status(500).json({ error: { message: result.message } });
  }

  return res.status(200).json({ data: { message: 'User deleted' } });
};
