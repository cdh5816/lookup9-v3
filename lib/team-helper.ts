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
    include: {
      team: { select: { id: true, slug: true, name: true } },
      user: { select: { id: true, name: true, department: true, position: true, company: true } },
    },
  });
}

export function hasMinRole(currentRole: string, minRole: string): boolean {
  return getRoleLevel(currentRole) >= getRoleLevel(minRole);
}

export function isExternalRole(role: string): boolean {
  return ['PARTNER', 'GUEST', 'VIEWER'].includes(role);
}

export function canDeleteUser(
  actorRole: string,
  actorUserId: string,
  targetRole: string,
  targetUserId: string
): boolean {
  if (actorUserId === targetUserId) return false;
  if (getRoleLevel(actorRole) <= getRoleLevel(targetRole)) return false;
  if (['SUPER_ADMIN', 'OWNER'].includes(targetRole)) return false;
  return true;
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (targetRole === 'SUPER_ADMIN' || targetRole === 'OWNER') return false;
  if (actorRole === 'SUPER_ADMIN' || actorRole === 'OWNER') return true;
  if (getRoleLevel(targetRole) >= getRoleLevel(actorRole)) return false;
  return true;
}

export function getPermissionFlags(role: string, department?: string | null) {
  const isSuperAdmin = ['SUPER_ADMIN', 'OWNER'].includes(role);
  const isCompanyAdmin = isSuperAdmin || ['ADMIN_HR', 'ADMIN'].includes(role);
  const isManager = isCompanyAdmin || role === 'MANAGER';
  const isInternal = isManager || ['USER', 'MEMBER'].includes(role);
  const isExternal = isExternalRole(role);

  const dept = department || '';
  const isSales = isCompanyAdmin || dept.includes('영업');
  const isContract = isCompanyAdmin || dept.includes('수주') || dept.includes('영업');
  const isProduction = isCompanyAdmin || dept.includes('생산');
  const isPainting = isCompanyAdmin || dept.includes('도장') || dept.includes('생산');
  const isShipping = isCompanyAdmin || dept.includes('출하') || dept.includes('생산');
  const canApprove = isCompanyAdmin || isManager || dept.includes('경영') || dept.includes('지원');
  const canManageUsers = isCompanyAdmin || isManager;

  return {
    isSuperAdmin,
    isCompanyAdmin,
    isManager,
    isInternal,
    isExternal,
    canManageUsers,
    canApprove,
    canViewSales: isSales,
    canViewContract: isContract,
    canViewProduction: isProduction,
    canViewPainting: isPainting,
    canViewShipping: isShipping,
  };
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

  if (isExternalRole(tm.role)) {
    const assignment = await prisma.siteAssignment.findFirst({ where: { siteId, userId } });
    if (!assignment) return null;
  }

  return tm;
}
