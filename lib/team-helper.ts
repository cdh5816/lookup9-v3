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
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          department: true,
          position: true,
        },
      },
    },
  });
}

export function hasMinRole(currentRole: string, minRole: string): boolean {
  return getRoleLevel(currentRole) >= getRoleLevel(minRole);
}

export function isExternalRole(role: string): boolean {
  return ['PARTNER', 'GUEST', 'VIEWER'].includes(role);
}

export function isSystemRole(role: string): boolean {
  return ['SUPER_ADMIN', 'OWNER'].includes(role);
}

export function isCompanyAdminRole(role: string): boolean {
  return ['ADMIN_HR', 'ADMIN'].includes(role);
}

export function getRoleDisplayName(role: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    OWNER: 'SUPER_ADMIN',
    ADMIN_HR: 'COMPANY_ADMIN',
    ADMIN: 'COMPANY_ADMIN',
    MANAGER: 'INTERNAL_MANAGER',
    USER: 'INTERNAL_USER',
    MEMBER: 'INTERNAL_USER',
    PARTNER: 'PARTNER',
    GUEST: 'GUEST',
    VIEWER: 'VIEWER',
  };

  return map[role] ?? role;
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
  if (targetRole === 'SUPER_ADMIN' || targetRole === 'OWNER') return false;

  if (actorRole === 'SUPER_ADMIN' || actorRole === 'OWNER') {
    return true;
  }

  if (isCompanyAdminRole(actorRole)) {
    return ['ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'MEMBER', 'PARTNER', 'GUEST', 'VIEWER'].includes(targetRole);
  }

  if (actorRole === 'MANAGER') {
    return ['USER', 'MEMBER', 'PARTNER', 'GUEST', 'VIEWER'].includes(targetRole);
  }

  if (['USER', 'MEMBER', 'PARTNER'].includes(actorRole)) {
    return ['GUEST', 'VIEWER'].includes(targetRole);
  }

  return false;
}

export function canManageGuests(role: string): boolean {
  return ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'MEMBER', 'PARTNER'].includes(role);
}

export function getPermissionFlags(role: string, department?: string | null) {
  const dept = department || '';
  const isSuperAdmin = isSystemRole(role);
  const isCompanyAdmin = isSuperAdmin || isCompanyAdminRole(role);
  const isManager = isCompanyAdmin || role === 'MANAGER';
  const isInternal = isManager || ['USER', 'MEMBER'].includes(role);
  const isExternal = isExternalRole(role);

  const canViewSales = isCompanyAdmin || dept.includes('영업');
  const canViewContract = isCompanyAdmin || dept.includes('수주') || dept.includes('영업');
  const canViewProduction = isCompanyAdmin || dept.includes('생산');
  const canViewPainting = isCompanyAdmin || dept.includes('도장') || dept.includes('생산');
  const canViewShipping = isCompanyAdmin || dept.includes('출하') || dept.includes('생산');
  const canApprove = isCompanyAdmin || isManager || dept.includes('경영') || dept.includes('지원');
  const canManageUsers = isCompanyAdmin || isManager;

  return {
    isSuperAdmin,
    isCompanyAdmin,
    isManager,
    isInternal,
    isExternal,
    canManageUsers,
    canManageGuests: canManageGuests(role),
    canApprove,
    canViewSales,
    canViewContract,
    canViewProduction,
    canViewPainting,
    canViewShipping,
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
    const assignment = await prisma.siteAssignment.findFirst({
      where: { siteId, userId },
    });
    if (!assignment) return null;
  }

  return tm;
}
