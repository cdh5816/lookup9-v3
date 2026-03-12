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

export const INTERNAL_ROLES = ['USER', 'MANAGER', 'ADMIN_HR', 'ADMIN', 'OWNER', 'SUPER_ADMIN'];
export const EXTERNAL_ROLES = ['PARTNER', 'GUEST', 'VIEWER'];

export function getRoleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? 0;
}

export function getRoleDisplayName(role: string): string {
  const map: Record<string, string> = {
    ADMIN_HR: 'COMPANY_ADMIN',
    MANAGER: 'INTERNAL_MANAGER',
    USER: 'INTERNAL_USER',
    PARTNER: 'PARTNER',
    GUEST: 'GUEST',
    VIEWER: 'VIEWER',
    OWNER: 'OWNER',
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
  };
  return map[role] || role;
}

export function isExternalRole(role?: string | null): boolean {
  return !!role && EXTERNAL_ROLES.includes(role);
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

export function canDeleteUser(actorRole: string, actorUserId: string, targetRole: string, targetUserId: string): boolean {
  if (actorUserId === targetUserId) return false;
  if (getRoleLevel(actorRole) <= getRoleLevel(targetRole)) return false;
  if (['OWNER', 'SUPER_ADMIN'].includes(targetRole)) return false;
  return true;
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (['SUPER_ADMIN', 'OWNER'].includes(targetRole)) return false;
  if (actorRole === 'SUPER_ADMIN' || actorRole === 'OWNER') return true;
  if (getRoleLevel(targetRole) >= getRoleLevel(actorRole)) return false;
  return true;
}

export function getDepartmentAccessMap(role: string, department?: string | null) {
  const dept = department || '';
  const isTop = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(role);
  const isManager = role === 'MANAGER';
  const isInternal = INTERNAL_ROLES.includes(role);

  return {
    sales: isTop || dept.includes('영업') || dept.includes('경영'),
    contract: isTop || dept.includes('영업') || dept.includes('수주') || dept.includes('경영'),
    production: isTop || dept.includes('생산') || dept.includes('공사') || dept.includes('경영') || isManager,
    painting: isTop || dept.includes('도장') || dept.includes('생산') || dept.includes('경영') || isManager,
    shipping: isTop || dept.includes('출하') || dept.includes('생산') || dept.includes('경영') || isManager,
    requests: isInternal || role === 'PARTNER' || role === 'GUEST',
    changes: isTop || isManager || dept.includes('영업') || dept.includes('수주') || dept.includes('생산') || dept.includes('출하'),
    approvals: isInternal,
    manageAccounts: isTop || isManager,
    canCreateCompanyAdmin: ['SUPER_ADMIN', 'OWNER'].includes(role),
  };
}

export function canReadTab(tab: string, role: string, department?: string | null): boolean {
  const access = getDepartmentAccessMap(role, department);
  const always = ['overview', 'documents', 'comments', 'history'];
  if (always.includes(tab)) return true;
  if (tab === 'sales') return access.sales;
  if (tab === 'contract') return access.contract;
  if (tab === 'production') return access.production;
  if (tab === 'painting') return access.painting;
  if (tab === 'shipping') return access.shipping;
  if (tab === 'requests') return access.requests;
  if (tab === 'changes') return access.changes;
  if (tab === 'schedule') return access.approvals || access.requests;
  if (tab === 'issues') return access.production || access.painting || access.shipping || access.sales;
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
