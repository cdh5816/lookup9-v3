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
  if (getRoleLevel(targetRole) >= getRoleLevel(actorRole)) return false;
  return true;
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

  if (tm.role === 'PARTNER' || tm.role === 'GUEST' || tm.role === 'VIEWER') {
    const assignment = await prisma.siteAssignment.findFirst({ where: { siteId, userId } });
    if (!assignment) return null;
  }

  return tm;
}

export async function hasCompanyAdmin(teamId: string) {
  const count = await prisma.teamMember.count({
    where: { teamId, role: 'ADMIN_HR' },
  });
  return count > 0;
}

export function getDepartmentFlags(department?: string | null) {
  const dept = department || '';
  return {
    isSalesDept: dept.includes('영업'),
    isContractDept: dept.includes('수주'),
    isProductionDept: dept.includes('생산'),
    isPaintDept: dept.includes('도장'),
    isShippingDept: dept.includes('출하'),
    isSupportDept: dept.includes('경영') || dept.includes('지원'),
    isConstructionDept: dept.includes('공사'),
  };
}

export function buildPermissionSet(role: string, department?: string | null) {
  const dept = getDepartmentFlags(department);
  const isCompanyAdmin = role === 'ADMIN_HR' || role === 'ADMIN' || role === 'OWNER' || role === 'SUPER_ADMIN';
  const isManager = role === 'MANAGER' || isCompanyAdmin;
  const isInternal = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'MEMBER'].includes(role);
  const isExternal = ['PARTNER', 'GUEST', 'VIEWER'].includes(role);

  return {
    isInternal,
    isExternal,
    isCompanyAdmin,
    canOpenApprovals: isCompanyAdmin || isManager || dept.isSupportDept,
    canViewSales: isCompanyAdmin || dept.isSalesDept,
    canViewContract: isCompanyAdmin || dept.isSalesDept || dept.isContractDept,
    canViewProduction: isCompanyAdmin || dept.isProductionDept,
    canViewPaint: isCompanyAdmin || dept.isProductionDept || dept.isPaintDept,
    canViewShipping: isCompanyAdmin || dept.isProductionDept || dept.isShippingDept,
    canManageAccounts: isCompanyAdmin || role === 'MANAGER',
    canCreateGuest: isCompanyAdmin || role === 'MANAGER' || role === 'PARTNER' || role === 'USER',
  };
}
