import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId, hasMinRole, canDeleteUser, canAssignRole } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  // 계정관리: ADMIN_HR 이상만 접근
  if (!hasMinRole(tm.role, 'ADMIN_HR')) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  const teamId = tm.teamId;

  try {
    switch (req.method) {
      case 'GET': return await handleGET(teamId, res);
      case 'POST': return await handlePOST(req, res, tm);
      case 'DELETE': return await handleDELETE(req, res, tm);
      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

// 같은 팀 소속 유저만 조회
const handleGET = async (teamId: string, res: NextApiResponse) => {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: {
      user: {
        select: { id: true, name: true, email: true, company: true, department: true, position: true, phone: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const users = members.map((m) => ({
    ...m.user,
    teamMembers: [{ role: m.role, team: { name: '' } }],
  }));

  return res.status(200).json({ data: users });
};

// 계정 생성: 역할 부여 제한
const handlePOST = async (req: NextApiRequest, res: NextApiResponse, actorTm: any) => {
  const { name, email, password, company, department, position, phone, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: { message: 'Name, email, password are required' } });

  const targetRole = role || 'USER';

  // 부여 가능한 역할인지 체크
  if (!canAssignRole(actorTm.role, targetRole)) {
    return res.status(403).json({ error: { message: `${targetRole} 역할을 부여할 수 없습니다.` } });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: { message: 'Email already exists' } });

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, company: company || null, department: department || null, position: position || null, phone: phone || null },
  });

  await prisma.teamMember.create({
    data: { teamId: actorTm.teamId, userId: user.id, role: targetRole },
  });

  return res.status(201).json({ data: user });
};

// 삭제: 상위 역할 삭제 불가 + 자기 자신 삭제 불가
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, actorTm: any) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });

  // 대상 유저의 같은 팀 멤버십 확인
  const targetTm = await prisma.teamMember.findFirst({
    where: { teamId: actorTm.teamId, userId },
  });
  if (!targetTm) return res.status(404).json({ error: { message: 'User not found in team' } });

  // 삭제 가능 여부 체크
  if (!canDeleteUser(actorTm.role, actorTm.userId, targetTm.role, userId)) {
    return res.status(403).json({ error: { message: '이 사용자를 삭제할 권한이 없습니다.' } });
  }

  // 팀 멤버십 삭제 + 유저 삭제
  await prisma.teamMember.delete({ where: { id: targetTm.id } });
  
  // 다른 팀에도 속해있는지 확인 후 유저 자체 삭제
  const otherMemberships = await prisma.teamMember.count({ where: { userId } });
  if (otherMemberships === 0) {
    await prisma.user.delete({ where: { id: userId } });
  }

  return res.status(200).json({ data: { message: 'User deleted' } });
};
