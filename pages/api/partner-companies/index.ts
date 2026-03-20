/* eslint-disable i18next/no-literal-string */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId, hasMinRole, isCompanyAdminRole } from '@/lib/team-helper';
import { hashPassword } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  if (req.method !== 'GET' && !hasMinRole(tm.role, 'MANAGER')) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  try {
    switch (req.method) {
      case 'GET': return await handleGET(tm, req, res);
      case 'POST': return await handlePOST(req, res, session, tm);
      case 'PUT': return await handlePUT(req, res, tm);
      case 'DELETE': return await handleDELETE(req, res, tm);
      default:
        return res.status(405).json({ error: { message: 'Method not allowed' } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

// 협력사 목록 조회 (+ unlinked 파트너 목록 옵션)
const handleGET = async (tm: any, req: NextApiRequest, res: NextApiResponse) => {
  const { unlinked } = req.query;

  // 협력사에 소속되지 않은 PARTNER 계정 목록 반환 (기존 계정 연결용)
  if (unlinked === 'true') {
    const linkedUserIds = (await prisma.partnerMember.findMany({
      where: { company: { teamId: tm.teamId } },
      select: { userId: true },
    })).map((m) => m.userId);

    const partnerMembers = await prisma.teamMember.findMany({
      where: {
        teamId: tm.teamId,
        role: 'PARTNER',
        ...(linkedUserIds.length > 0 ? { userId: { notIn: linkedUserIds } } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, username: true, position: true, phone: true, company: true },
        },
      },
    });

    return res.status(200).json({
      data: partnerMembers.map((m) => ({ ...m.user })),
    });
  }

  const companies = await prisma.partnerCompany.findMany({
    where: { teamId: tm.teamId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, username: true, position: true, phone: true, createdAt: true },
          },
        },
      },
      sites: {
        include: {
          site: { select: { id: true, name: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const sites = await prisma.site.findMany({
    where: { teamId: tm.teamId, status: { in: ['CONTRACT_ACTIVE', 'COMPLETED', 'WARRANTY'] } },
    select: { id: true, name: true, status: true },
    orderBy: { updatedAt: 'desc' },
  });

  return res.status(200).json({ data: companies, meta: { sites } });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const { action } = req.query;

  // 현장 배정
  if (action === 'assign') {
    const { companyId, siteId, remove } = req.body;
    if (!companyId || !siteId) return res.status(400).json({ error: { message: 'companyId, siteId required' } });

    const company = await prisma.partnerCompany.findFirst({ where: { id: companyId, teamId: tm.teamId } });
    if (!company) return res.status(404).json({ error: { message: 'Company not found' } });

    if (remove) {
      await prisma.partnerSiteAssign.deleteMany({ where: { partnerCompanyId: companyId, siteId } });
      const memberIds = (await prisma.partnerMember.findMany({ where: { partnerCompanyId: companyId }, select: { userId: true } })).map(m => m.userId);
      if (memberIds.length > 0) {
        await prisma.siteAssignment.deleteMany({ where: { siteId, userId: { in: memberIds } } });
      }
    } else {
      await prisma.partnerSiteAssign.upsert({
        where: { partnerCompanyId_siteId: { partnerCompanyId: companyId, siteId } },
        create: { partnerCompanyId: companyId, siteId },
        update: {},
      });
      const memberIds = (await prisma.partnerMember.findMany({ where: { partnerCompanyId: companyId }, select: { userId: true } })).map(m => m.userId);
      if (memberIds.length > 0) {
        await prisma.siteAssignment.createMany({
          data: memberIds.map(userId => ({ siteId, userId, assignedRole: 'PARTNER' })),
          skipDuplicates: true,
        });
      }
    }
    return res.status(200).json({ data: { ok: true } });
  }

  // 기존 PARTNER 계정 → 협력사 연결
  if (action === 'link-existing') {
    const { companyId, userId } = req.body;
    if (!companyId || !userId) return res.status(400).json({ error: { message: 'companyId, userId required' } });

    const company = await prisma.partnerCompany.findFirst({ where: { id: companyId, teamId: tm.teamId } });
    if (!company) return res.status(404).json({ error: { message: 'Company not found' } });

    // 이미 다른 회사에 소속된 경우 제거 후 재소속
    await prisma.partnerMember.deleteMany({ where: { userId } });

    await prisma.partnerMember.create({
      data: { partnerCompanyId: companyId, userId },
    });

    // 회사에 배정된 현장들에도 자동 배정
    const assigns = await prisma.partnerSiteAssign.findMany({
      where: { partnerCompanyId: companyId },
      select: { siteId: true },
    });
    if (assigns.length > 0) {
      await prisma.siteAssignment.createMany({
        data: assigns.map(a => ({ siteId: a.siteId, userId, assignedRole: 'PARTNER' })),
        skipDuplicates: true,
      });
    }

    return res.status(200).json({ data: { ok: true } });
  }

  // 직원 계정 추가 (신규 생성)
  if (action === 'add-member') {
    const { companyId, name, username, password, position, phone } = req.body;
    if (!companyId || !name || !username || !password) {
      return res.status(400).json({ error: { message: '이름, 아이디, 비밀번호는 필수입니다.' } });
    }

    const company = await prisma.partnerCompany.findFirst({ where: { id: companyId, teamId: tm.teamId } });
    if (!company) return res.status(404).json({ error: { message: 'Company not found' } });

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) return res.status(400).json({ error: { message: '이미 사용 중인 아이디입니다.' } });

    const email = `${username}@internal.lookup9`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: { message: '이미 사용 중인 아이디입니다.' } });

    const hashed = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, username, email, password: hashed, company: company.name, position: position || null, phone: phone || null },
      });
      await tx.teamMember.create({ data: { teamId: tm.teamId, userId: user.id, role: 'PARTNER' } });
      await tx.partnerMember.create({ data: { partnerCompanyId: companyId, userId: user.id, position: position || null } });

      const assigns = await tx.partnerSiteAssign.findMany({ where: { partnerCompanyId: companyId }, select: { siteId: true } });
      if (assigns.length > 0) {
        await tx.siteAssignment.createMany({
          data: assigns.map(a => ({ siteId: a.siteId, userId: user.id, assignedRole: 'PARTNER' })),
          skipDuplicates: true,
        });
      }
      return user;
    });

    return res.status(201).json({ data: result });
  }

  // 협력사 회사 신규 생성
  const { name, bizNo, contact, phone, email, address, notes, siteIds } = req.body;
  if (!name) return res.status(400).json({ error: { message: '회사명은 필수입니다.' } });

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.partnerCompany.create({
      data: { name, bizNo: bizNo || null, contact: contact || null, phone: phone || null, email: email || null, address: address || null, notes: notes || null, teamId: tm.teamId },
    });
    if (Array.isArray(siteIds) && siteIds.length > 0) {
      await tx.partnerSiteAssign.createMany({
        data: siteIds.map((siteId: string) => ({ partnerCompanyId: created.id, siteId })),
        skipDuplicates: true,
      });
    }
    return created;
  });

  return res.status(201).json({ data: company });
};

const handlePUT = async (req: NextApiRequest, res: NextApiResponse, tm: any) => {
  const { companyId, name, bizNo, contact, phone, email, address, notes } = req.body;
  if (!companyId) return res.status(400).json({ error: { message: 'companyId required' } });

  const company = await prisma.partnerCompany.findFirst({ where: { id: companyId, teamId: tm.teamId } });
  if (!company) return res.status(404).json({ error: { message: 'Company not found' } });

  const updated = await prisma.partnerCompany.update({
    where: { id: companyId },
    data: { name: name || company.name, bizNo: bizNo ?? company.bizNo, contact: contact ?? company.contact, phone: phone ?? company.phone, email: email ?? company.email, address: address ?? company.address, notes: notes ?? company.notes, updatedAt: new Date() },
  });

  return res.status(200).json({ data: updated });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, tm: any) => {
  const { companyId, memberId } = req.body;

  if (memberId) {
    const member = await prisma.partnerMember.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: { message: 'Member not found' } });
    await prisma.partnerMember.delete({ where: { id: memberId } });
    return res.status(200).json({ data: { ok: true } });
  }

  if (companyId) {
    const company = await prisma.partnerCompany.findFirst({ where: { id: companyId, teamId: tm.teamId } });
    if (!company) return res.status(404).json({ error: { message: 'Company not found' } });
    await prisma.partnerCompany.delete({ where: { id: companyId } });
    return res.status(200).json({ data: { ok: true } });
  }

  return res.status(400).json({ error: { message: 'companyId or memberId required' } });
};
