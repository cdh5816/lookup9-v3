import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import {
  getTeamMemberByUserId,
  hasMinRole,
  canDeleteUser,
  canAssignRole,
  deleteUserFully,
  isCompanyAdminRole,
  isSystemRole,
} from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  if (!hasMinRole(tm.role, 'MANAGER')) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  try {
    switch (req.method) {
      case 'GET':    return await handleGET(tm.teamId, tm.role, session.user.id, res);
      case 'POST':   return await handlePOST(req, res, tm);
      case 'DELETE': return await handleDELETE(req, res, tm, session.user.id);
      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    console.error('[admin/users]', error);
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (teamId: string, actorRole: string, actorUserId: string, res: NextApiResponse) => {
  // 1. 자기 팀 멤버 전체 조회
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: {
      user: {
        select: {
          id: true, name: true, username: true, email: true,
          company: true, department: true, position: true, phone: true, createdAt: true,
        },
      },
      team: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. SUPER_ADMIN: 다른 팀의 COMPANY_ADMIN도 조회
  let otherAdmins: any[] = [];
  if (isSystemRole(actorRole)) {
    otherAdmins = await prisma.teamMember.findMany({
      where: {
        role: { in: ['ADMIN_HR', 'ADMIN'] },
        teamId: { not: teamId },
      },
      include: {
        user: {
          select: {
            id: true, name: true, username: true, email: true,
            company: true, department: true, position: true, phone: true, createdAt: true,
          },
        },
        team: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. 현장 배정 정보 별도 조회
  const allUserIds = members.map((m) => m.userId);

  const [siteAssignments, partnerMembers] = await Promise.all([
    prisma.siteAssignment.findMany({
      where: { userId: { in: allUserIds }, site: { teamId } },
      select: {
        userId: true,
        siteId: true,
        site: { select: { id: true, name: true, status: true } },
      },
    }),
    prisma.partnerMember.findMany({
      where: { userId: { in: allUserIds } },
      select: {
        userId: true,
        company: { select: { id: true, name: true } },
      },
    }),
  ]);

  const assignmentMap: Record<string, any[]> = {};
  siteAssignments.forEach((a) => {
    if (!assignmentMap[a.userId]) assignmentMap[a.userId] = [];
    assignmentMap[a.userId].push({ siteId: a.siteId, site: a.site });
  });

  const partnerMap: Record<string, any> = {};
  partnerMembers.forEach((pm) => {
    partnerMap[pm.userId] = pm.company;
  });

  // 4. 자기 팀 멤버 (SUPER_ADMIN/OWNER 제외)
  const users = members
    .filter((m) => !['SUPER_ADMIN', 'OWNER'].includes(m.role))
    .map((m) => ({
      ...m.user,
      role: m.role,
      teamName: m.team?.name || null,
      teamId: m.teamId,
      siteAssignments: assignmentMap[m.userId] || [],
      partnerCompany: partnerMap[m.userId] || null,
    }));

  // 5. 다른 팀 COMPANY_ADMIN 추가 (SUPER_ADMIN만)
  const companyAdmins = otherAdmins.map((m) => ({
    ...m.user,
    role: m.role,
    teamName: m.team?.name || null,
    teamId: m.teamId,
    siteAssignments: [],
    partnerCompany: null,
    isOtherTeam: true,
  }));

  const sites = await prisma.site.findMany({
    where: { teamId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, status: true },
  });

  return res.status(200).json({
    data: [...users, ...companyAdmins],
    meta: {
      sites,
      actorRole,
      canDelete: isCompanyAdminRole(actorRole) || isSystemRole(actorRole),
      canCreateAdmin: isSystemRole(actorRole),
    },
  });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, actorTm: any) => {
  const { name, username, email, password, company, department, position, phone, role, siteIds } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: { message: '이름, 아이디, 비밀번호는 필수입니다.' } });
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) return res.status(400).json({ error: { message: '이미 사용 중인 아이디입니다.' } });

  const finalEmail = email && email.trim() ? email.trim() : `${username}@internal.lookup9`;
  const targetRole = role || 'USER';

  if (!canAssignRole(actorTm.role, targetRole)) {
    return res.status(403).json({ error: { message: `${targetRole} 역할을 부여할 수 없습니다.` } });
  }

  const existing = await prisma.user.findUnique({ where: { email: finalEmail } });
  if (existing) return res.status(400).json({ error: { message: '이미 사용 중인 이메일입니다.' } });

  const hashedPassword = await hashPassword(password);

  // ── COMPANY_ADMIN(ADMIN_HR) 생성: 새 팀(회사) 자동 생성 ──
  if (targetRole === 'ADMIN_HR' || targetRole === 'ADMIN') {
    if (!company || !company.trim()) {
      return res.status(400).json({ error: { message: 'COMPANY_ADMIN 생성 시 회사명은 필수입니다.' } });
    }
    const companySlug = company.trim().toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `company-${Date.now()}`;

    // slug 중복 체크
    const existingTeam = await prisma.team.findUnique({ where: { slug: companySlug } });
    const finalSlug = existingTeam ? `${companySlug}-${Date.now().toString(36)}` : companySlug;

    const user = await prisma.$transaction(async (tx) => {
      // 1. 새 팀 생성
      const newTeam = await tx.team.create({
        data: {
          name: company.trim(),
          slug: finalSlug,
          defaultRole: 'USER',
        },
      });
      // 2. 유저 생성
      const created = await tx.user.create({
        data: {
          name, username, email: finalEmail, password: hashedPassword,
          company: company.trim(), department: department || null,
          position: position || null, phone: phone || null,
        },
      });
      // 3. 새 팀의 ADMIN_HR로 등록
      await tx.teamMember.create({ data: { teamId: newTeam.id, userId: created.id, role: targetRole } });
      return { ...created, teamName: newTeam.name, teamSlug: newTeam.slug };
    });

    return res.status(201).json({ data: user });
  }

  // ── 일반 직원/PARTNER/GUEST 생성: 기존 팀에 추가 ──
  const normalizedSiteIds = Array.isArray(siteIds)
    ? Array.from(new Set(siteIds.filter((id: unknown) => typeof id === 'string' && id.trim())))
    : [];

  if (['GUEST', 'VIEWER'].includes(targetRole) && normalizedSiteIds.length === 0) {
    return res.status(400).json({ error: { message: '게스트 계정은 최소 1개 현장을 지정해야 합니다.' } });
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name, username, email: finalEmail, password: hashedPassword,
        company: company || null, department: department || null,
        position: position || null, phone: phone || null,
      },
    });
    await tx.teamMember.create({ data: { teamId: actorTm.teamId, userId: created.id, role: targetRole } });
    if (normalizedSiteIds.length > 0) {
      await tx.siteAssignment.createMany({
        data: normalizedSiteIds.map((siteId: string) => ({ siteId, userId: created.id, assignedRole: targetRole })),
        skipDuplicates: true,
      });
    }

    // ── PARTNER 계정: 소속 협력사 연결 (현장 배정은 수동) ──
    if (targetRole === 'PARTNER' && company) {
      const partnerCompany = await tx.partnerCompany.findFirst({
        where: { teamId: actorTm.teamId, name: { equals: company, mode: 'insensitive' } },
      });
      if (partnerCompany) {
        await tx.partnerMember.upsert({
          where: { partnerCompanyId_userId: { partnerCompanyId: partnerCompany.id, userId: created.id } },
          create: { partnerCompanyId: partnerCompany.id, userId: created.id, position: position || null },
          update: {},
        });
      }
    }

    return created;
  });

  return res.status(201).json({ data: user });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, actorTm: any, actorUserId: string) => {
  const { userId, confirmPassword } = req.body;
  if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });

  const targetTm = await prisma.teamMember.findFirst({ where: { userId }, include: { user: true } });
  if (!targetTm) return res.status(404).json({ error: { message: 'User not found' } });

  // COMPANY_ADMIN 삭제: SUPER_ADMIN만 가능 + 비밀번호 확인 필수
  if (isCompanyAdminRole(targetTm.role)) {
    if (!isSystemRole(actorTm.role)) {
      return res.status(403).json({ error: { message: 'COMPANY_ADMIN은 시스템 관리자만 삭제할 수 있습니다.' } });
    }
    if (!confirmPassword) {
      return res.status(400).json({ error: { message: '비밀번호 확인이 필요합니다.' } });
    }
    // 시스템 관리자 비밀번호 확인
    const { verifyPassword } = await import('@/lib/auth');
    const actor = await prisma.user.findUnique({ where: { id: actorUserId }, select: { password: true } });
    if (!actor?.password) return res.status(403).json({ error: { message: '비밀번호 확인 실패' } });
    const valid = await verifyPassword(confirmPassword, actor.password);
    if (!valid) return res.status(403).json({ error: { message: '비밀번호가 일치하지 않습니다.' } });

    // 해당 COMPANY_ADMIN의 팀 전체 삭제 (현장/협력사/직원 모두)
    const targetTeamId = targetTm.teamId;
    await prisma.$transaction(async (tx) => {
      // 팀 소속 현장의 사진/출하/생산/코멘트 등 cascade 삭제 (Site onDelete: Cascade)
      await tx.site.deleteMany({ where: { teamId: targetTeamId } });
      await tx.partnerCompany.deleteMany({ where: { teamId: targetTeamId } });
      await tx.client.deleteMany({ where: { teamId: targetTeamId } });
      // 팀 멤버 전부 삭제
      const teamMembers = await tx.teamMember.findMany({ where: { teamId: targetTeamId }, select: { userId: true } });
      await tx.teamMember.deleteMany({ where: { teamId: targetTeamId } });
      // 팀 멤버였던 유저들 삭제 (다른 팀에도 속하지 않는 경우만)
      for (const member of teamMembers) {
        const otherTeams = await tx.teamMember.count({ where: { userId: member.userId } });
        if (otherTeams === 0) {
          await tx.siteAssignment.deleteMany({ where: { userId: member.userId } });
          await tx.user.delete({ where: { id: member.userId } }).catch(() => {});
        }
      }
      // 팀 삭제
      await tx.team.delete({ where: { id: targetTeamId } }).catch(() => {});
    });

    return res.status(200).json({ data: { message: '회사 및 모든 하위 데이터가 삭제되었습니다.' } });
  }

  // 일반 직원 삭제
  if (!canDeleteUser(actorTm.role, actorUserId, targetTm.role, userId)) {
    return res.status(403).json({ error: { message: '이 사용자를 삭제할 권한이 없습니다.' } });
  }

  const result = await deleteUserFully(userId, actorTm.teamId);
  if (!result.ok) return res.status(500).json({ error: { message: result.message } });

  return res.status(200).json({ data: { message: 'User deleted' } });
};
