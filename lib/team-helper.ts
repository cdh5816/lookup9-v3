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
  if (targetRole === 'SUPER_ADMIN') return false;
  if (targetRole === 'OWNER') return false;
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
    const assignment = await prisma.siteAssignment.findFirst({
      where: { siteId, userId },
    });
    if (!assignment) return null;
  }

  return tm;
}

export function isSystemRole(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'OWNER';
}

export function isCompanyAdminRole(role: string): boolean {
  return role === 'ADMIN_HR' || role === 'ADMIN';
}

export function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'SUPER_ADMIN';
    case 'OWNER':
      return 'OWNER';
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
      return 'GUEST';
    case 'VIEWER':
      return 'VIEWER';
    default:
      return role;
  }
}

export function canManageGuests(role: string): boolean {
  return ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'PARTNER'].includes(role);
}

export function getPermissionFlags(role: string, department?: string | null) {
  const isSuper = role === 'SUPER_ADMIN' || role === 'OWNER';
  const isCompanyAdmin = isCompanyAdminRole(role);
  const isManager = role === 'MANAGER';
  const isInternal = isSuper || isCompanyAdmin || isManager || role === 'USER' || role === 'MEMBER';
  const dept = department || '';

  return {
    isSuper,
    isCompanyAdmin,
    isInternal,
    canManageUsers: isSuper || isCompanyAdmin || isManager,
    canManageGuests: canManageGuests(role),
    canViewApprovals: isSuper || isCompanyAdmin || isManager,
    canViewSales: isSuper || isCompanyAdmin || dept.includes('영업') || dept.includes('경영'),
    canViewContract: isSuper || isCompanyAdmin || dept.includes('영업') || dept.includes('수주') || dept.includes('경영'),
    canViewProduction: isSuper || isCompanyAdmin || dept.includes('생산'),
    canViewPainting: isSuper || isCompanyAdmin || dept.includes('도장') || dept.includes('생산'),
    canViewShipping: isSuper || isCompanyAdmin || dept.includes('출하') || dept.includes('생산'),
  };
}
