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

const SALES_DEPARTMENTS = ['영업부', '경영진', '경영지원부'];
const CONTRACT_DEPARTMENTS = ['영업부', '수주팀', '경영진', '경영지원부'];
const PRODUCTION_DEPARTMENTS = ['생산관리팀', '경영진', '경영지원부'];
const PAINT_DEPARTMENTS = ['도장팀', '생산관리팀', '경영진', '경영지원부'];
const SHIPPING_DEPARTMENTS = ['출하팀', '생산관리팀', '경영진', '경영지원부'];

export function getRoleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? 0;
}

export async function getTeamMemberByUserId(userId: string) {
  return prisma.teamMember.findFirst({
    where: { userId },
    include: {
      team: { select: { id: true, slug: true, name: true } },
      user: { select: { id: true, name: true, email: true, company: true, department: true, position: true } },
    },
  });
}

export function hasMinRole(currentRole: string, minRole: string): boolean {
  return getRoleLevel(currentRole) >= getRoleLevel(minRole);
}

export function isExternalRole(role: string): boolean {
  return ['PARTNER', 'GUEST', 'VIEWER'].includes(role);
}

export function isCompanyAdminRole(role: string): boolean {
  return role === 'ADMIN_HR';
}

export function canDeleteUser(actorRole: string, actorUserId: string, targetRole: string, targetUserId: string): boolean {
  if (actorUserId === targetUserId) return false;
  if (getRoleLevel(actorRole) <= getRoleLevel(targetRole)) return false;
  return true;
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (targetRole === 'SUPER_ADMIN' || targetRole === 'OWNER') return false;
  if (actorRole === 'SUPER_ADMIN' || actorRole === 'OWNER') return true;
  if (actorRole === 'ADMIN_HR' || actorRole === 'ADMIN') {
    return ['MANAGER', 'USER', 'PARTNER', 'GUEST', 'VIEWER'].includes(targetRole);
  }
  if (actorRole === 'MANAGER') {
    return ['USER', 'PARTNER', 'GUEST', 'VIEWER'].includes(targetRole);
  }
  return false;
}

export function canManageAccounts(actorRole: string): boolean {
  return ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(actorRole);
}

export function canApproveRequest(actorRole: string, department?: string | null, targetDept?: string | null): boolean {
  if (['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(actorRole)) return true;
  if (actorRole !== 'MANAGER') return false;
  if (!targetDept) return true;
  return department === targetDept;
}

export function getPermissionFlags(role: string, department?: string | null) {
  const dep = department || '';
  const isAdmin = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(role);
  return {
    role,
    isExternal: isExternalRole(role),
    canManageAccounts: canManageAccounts(role),
    canViewSales: isAdmin || SALES_DEPARTMENTS.includes(dep),
    canViewContracts: isAdmin || CONTRACT_DEPARTMENTS.includes(dep),
    canViewProduction: isAdmin || PRODUCTION_DEPARTMENTS.includes(dep),
    canViewPaint: isAdmin || PAINT_DEPARTMENTS.includes(dep),
    canViewShipping: isAdmin || SHIPPING_DEPARTMENTS.includes(dep),
    canApprove: canApproveRequest(role, dep, null),
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
