import { prisma } from '@/lib/prisma';

const ROLE_LEVEL: Record<string, number> = {
  GUEST: 0,
  VIEWER: 0,
  PARTNER: 1,
  MEMBER: 2,
  USER: 2,
  MANAGER: 3,
  ADMIN_HR: 4,
  ADMIN: 4,
  OWNER: 5,
  SUPER_ADMIN: 5,
};

export function getRoleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? 0;
}

export async function getTeamMemberByUserId(userId: string) {
  return prisma.teamMember.findFirst({
    where: { userId },
    include: { team: { select: { id: true, slug: true, name: true } } },
  });
}

export function hasMinRole(currentRole: string, minRole: string): boolean {
  return getRoleLevel(currentRole) >= getRoleLevel(minRole);
}

export function canDeleteUser(
  actorRole: string,
  actorUserId: string,
  targetRole: string,
  targetUserId: string
): boolean {
  if (actorUserId === targetUserId) return false;
  if (getRoleLevel(actorRole) <= getRoleLevel(targetRole)) return false;
  return true;
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (targetRole === 'SUPER_ADMIN' || targetRole === 'OWNER') return false;
  if (actorRole === 'SUPER_ADMIN' || actorRole === 'OWNER') return true;
  if (targetRole === 'ADMIN_HR') return actorRole === 'SUPER_ADMIN' || actorRole === 'OWNER';
  if (actorRole === 'ADMIN_HR') return ['MANAGER', 'USER', 'PARTNER', 'GUEST', 'VIEWER'].includes(targetRole);
  if (actorRole === 'MANAGER') return ['USER', 'PARTNER', 'GUEST', 'VIEWER'].includes(targetRole);
  return false;
}

export async function verifySiteAccess(userId: string, siteId: string) {
  const tm = await getTeamMemberByUserId(userId);
  if (!tm) return null;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, teamId: true },
  });
  if (!site) return null;
  if (site.teamId && site.teamId !== tm.teamId) return null;

  if (['PARTNER', 'GUEST', 'VIEWER'].includes(tm.role)) {
    const assignment = await prisma.siteAssignment.findFirst({ where: { siteId, userId } });
    if (!assignment) return null;
  }

  return tm;
}

export function getPermissionFlags(role: string, department?: string | null) {
  const isExec = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(role);
  const dept = department || '';

  return {
    canManageAccounts: ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'MANAGER'].includes(role),
    canApprove: isExec || ['경영지원부', '영업부', '수주팀', '생산관리팀'].includes(dept),
    canViewSales: isExec || ['영업부', '수주팀'].includes(dept),
    canViewContract: isExec || ['영업부', '수주팀', '경영지원부'].includes(dept),
    canViewProduction: isExec || ['생산관리팀', '도장팀', '출하팀', '공사팀'].includes(dept),
    canViewPainting: isExec || ['도장팀', '생산관리팀'].includes(dept),
    canViewShipping: isExec || ['출하팀', '생산관리팀'].includes(dept),
    canCreateExternal: ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'MANAGER'].includes(role),
    isExternal: ['PARTNER', 'GUEST', 'VIEWER'].includes(role),
  };
}

export async function findTeamAdminHr(teamId: string) {
  return prisma.teamMember.findFirst({
    where: { teamId, role: 'ADMIN_HR' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}
