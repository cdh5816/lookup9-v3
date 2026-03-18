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

  // GET은 팀 소속이면 누구나 (현장 상세 시공업체 검색용)
  // POST/PUT/DELETE는 MANAGER 이상만
  if (req.method !== 'GET' && !hasMinRole(tm.role, 'MANAGER')) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  try {
    switch (req.method) {
      case 'GET': return await handleGET(tm, res);
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

// 협력사 목록 조회
const handleGET = async (tm: any, res: NextApiResponse) => {
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

  // 전체 현장 목록 (배정용)
  const sites = await prisma.site.findMany({
    where: { teamId: tm.teamId, status: { in: ['CONTRACT_ACTIVE', 'COMPLETED', 'WARRANTY'] } },
    select: { id: true, name: true, status: true },
    orderBy: { updatedAt: 'desc' },
  });

  return res.status(200).json({ data: companies, meta: { sites } });
};

// 협력사 회사 생성 (+ 직원 계정 생성 + 현장 배정)
const handlePOST = async (req: NextApiRequest, res: NextApiResponse, session: any, tm: any) => {
  const { action } = req.query;

  // 현장 배정 추가/제거
  if (action === 'assign') {
    const { companyId, siteId, remove } = req.body;
    if (!companyId || !siteId) return res.status(400).json({ error: { message: 'companyId, siteId required' } });

    // 회사 소속 확인
    const company = await prisma.partnerCompany.findFirst({ where: { id: companyId, teamId: tm.teamId } });
    if (!company) return res.status(404).json({ error: { message: 'Company not found' } });

    if (remove) {
      await prisma.partnerSiteAssign.deleteMany({ where: { partnerCompanyId: companyId, siteId } });
      // 해당 회사 직원들의 현장 배정도 제거
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
      // 해당 회사 직원들 현장 자동 배정
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

  // 직원 계정 추가
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

      // 이미 배정된 현장들에 자동 배정
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
    // 현장 배정
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

// 협력사 회사 정보 수정
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

// 협력사 삭제 또는 직원 제거
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, tm: any) => {
  const { companyId, memberId } = req.body;

  if (memberId) {
    // 직원 제거
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
