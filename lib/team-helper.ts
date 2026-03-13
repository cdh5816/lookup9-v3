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

export function isExternalRole(role: string): boolean {
  return ['PARTNER', 'GUEST', 'VIEWER'].includes(role);
}

export function isSystemRole(role: string): boolean {
  return ['SUPER_ADMIN', 'OWNER'].includes(role);
}

export function isCompanyAdminRole(role: string): boolean {
  return role === 'ADMIN_HR' || role === 'ADMIN';
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
  if (isSystemRole(targetRole)) return false;
  if (getRoleLevel(actorRole) <= getRoleLevel(targetRole)) return false;
  return true;
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (isSystemRole(targetRole)) return false;
  if (actorRole === 'SUPER_ADMIN' || actorRole === 'OWNER') return true;
  if (getRoleLevel(targetRole) >= getRoleLevel(actorRole)) return false;
  return true;
}

export function canManageGuests(role: string): boolean {
  return ['ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'PARTNER', 'OWNER', 'SUPER_ADMIN'].includes(role);
}

export function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'ADMIN_HR':
    case 'ADMIN':
      return 'COMPANY_ADMIN';
    case 'MANAGER':
      return 'INTERNAL_MANAGER';
    case 'USER':
    case 'MEMBER':
      return 'INTERNAL_USER';
    case 'PARTNER':
      return 'PARTNER';
    case 'GUEST':
    case 'VIEWER':
      return 'CLIENT / GUEST';
    case 'OWNER':
    case 'SUPER_ADMIN':
      return 'SUPER_ADMIN';
    default:
      return role || '-';
  }
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

export function getPermissionFlags(role: string, department?: string | null) {
  const isSuper = role === 'SUPER_ADMIN' || role === 'OWNER';
  const isCompanyAdmin = isCompanyAdminRole(role) || isSuper;
  const isManager = role === 'MANAGER' || isCompanyAdmin;
  const isUser = role === 'USER' || role === 'MEMBER';
  const isPartner = role === 'PARTNER';
  const dept = department || '';

  return {
    isExternal: isExternalRole(role),
    isInternal: !isExternalRole(role),
    canManageAccounts: isManager,
    canManageGuests: canManageGuests(role),
    canUseApprovals: isManager || dept.includes('경영') || dept.includes('지원'),
    canViewSupport: isManager || dept.includes('경영') || dept.includes('지원'),
    canViewSales: isManager || dept.includes('영업'),
    canViewContracts: isManager || dept.includes('수주') || dept.includes('영업'),
    canViewProduction: isManager || dept.includes('생산') || dept.includes('도장') || dept.includes('출하'),
    canViewPaint: isManager || dept.includes('도장') || dept.includes('생산'),
    canViewShipping: isManager || dept.includes('출하') || dept.includes('생산'),
    canEditProgress: isManager || dept.includes('생산'),
    canViewWorklogs: isManager || isUser || isCompanyAdmin,
    canCreatePartner: isCompanyAdmin || isManager,
    canCreateCompanyAdmin: isSuper,
    canSeeSystemUsers: isSuper,
    canSeeGuestMenu: canManageGuests(role) || isPartner,
  };
}

export const getPermissions = getPermissionFlags;
