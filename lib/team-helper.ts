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

export const INTERNAL_ROLES = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER', 'USER', 'MEMBER'];
export const EXTERNAL_ROLES = ['PARTNER', 'GUEST', 'VIEWER'];

export function getRoleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? 0;
}

export function normalizeDepartment(department?: string | null): string {
  return (department || '').replace(/\s+/g, '').trim();
}

export function isInternalRole(role?: string | null): boolean {
  return !!role && INTERNAL_ROLES.includes(role);
}

export function isExternalRole(role?: string | null): boolean {
  return !!role && EXTERNAL_ROLES.includes(role);
}

export async function getTeamMemberByUserId(userId: string) {
  return prisma.teamMember.findFirst({
    where: { userId },
    include: {
      team: { select: { id: true, slug: true, name: true } },
      user: { select: { id: true, name: true, department: true, company: true, email: true } },
    },
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
    const assignment = await prisma.siteAssignment.findFirst({
      where: { siteId, userId },
    });
    if (!assignment) return null;
  }

  return tm;
}

export function getDepartmentFlags(department?: string | null) {
  const value = normalizeDepartment(department);

  const has = (...names: string[]) => names.some((name) => value.includes(normalizeDepartment(name)));

  const isExecutive = has('경영진');
  const isSupport = has('경영지원부');
  const isSales = has('영업부');
  const isContract = has('수주팀');
  const isProduction = has('생산관리팀');
  const isPaint = has('도장팀');
  const isShipping = has('출하팀');
  const isConstruction = has('공사팀');
  const isPartnerDept = has('협력사');

  return {
    isExecutive,
    isSupport,
    isSales,
    isContract,
    isProduction,
    isPaint,
    isShipping,
    isConstruction,
    isPartnerDept,
  };
}

export function getPermissionProfile(role?: string | null, department?: string | null) {
  const level = getRoleLevel(role || 'GUEST');
  const dept = getDepartmentFlags(department);
  const internal = isInternalRole(role);
  const admin = level >= getRoleLevel('ADMIN_HR');
  const manager = level >= getRoleLevel('MANAGER');

  const canViewSales = internal && (admin || dept.isExecutive || dept.isSupport || dept.isSales || dept.isContract);
  const canViewContract = internal && (admin || dept.isExecutive || dept.isSupport || dept.isSales || dept.isContract);
  const canViewProduction = internal && (admin || dept.isExecutive || dept.isProduction || dept.isPaint || dept.isShipping || dept.isConstruction);
  const canViewPainting = internal && (admin || dept.isExecutive || dept.isProduction || dept.isPaint);
  const canViewShipping = internal && (admin || dept.isExecutive || dept.isProduction || dept.isShipping);
  const canManageApprovals = internal && (admin || dept.isExecutive || dept.isSupport || manager);

  return {
    role,
    level,
    internal,
    external: isExternalRole(role),
    admin,
    manager,
    departmentFlags: dept,
    canViewSales,
    canViewContract,
    canViewProduction,
    canViewPainting,
    canViewShipping,
    canManageApprovals,
  };
}

export async function findUsersByTargetDept(teamId: string, targetDept?: string | null) {
  const normalized = normalizeDepartment(targetDept);

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: {
      user: {
        select: { id: true, name: true, department: true, position: true, email: true },
      },
    },
  });

  if (!normalized) {
    return members
      .filter((member) => isInternalRole(member.role))
      .map((member) => member.user);
  }

  return members
    .filter((member) => {
      if (!isInternalRole(member.role)) return false;
      const dept = normalizeDepartment(member.user.department);
      return dept.includes(normalized);
    })
    .map((member) => member.user);
}
