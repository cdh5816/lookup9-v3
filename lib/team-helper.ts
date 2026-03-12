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

export const EXTERNAL_ROLES = ['PARTNER', 'GUEST', 'VIEWER'] as const;
export const INTERNAL_ROLES = ['USER', 'MANAGER', 'ADMIN_HR', 'ADMIN', 'OWNER', 'SUPER_ADMIN', 'MEMBER'] as const;

export function getRoleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? 0;
}

export function isExternalRole(role: string): boolean {
  return EXTERNAL_ROLES.includes(role as (typeof EXTERNAL_ROLES)[number]);
}

export function isCompanyAdminRole(role: string): boolean {
  return role === 'ADMIN_HR';
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
  if (isCompanyAdminRole(targetRole) && !['OWNER', 'SUPER_ADMIN'].includes(actorRole)) {
    return false;
  }
  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (targetRole === 'SUPER_ADMIN' || targetRole === 'OWNER') return false;
  if (actorRole === 'SUPER_ADMIN' || actorRole === 'OWNER') return true;
  if (actorRole === 'ADMIN_HR') return ['MANAGER', 'USER', 'PARTNER', 'GUEST', 'VIEWER', 'MEMBER'].includes(targetRole);
  if (actorRole === 'MANAGER') return ['USER', 'PARTNER', 'GUEST', 'VIEWER', 'MEMBER'].includes(targetRole);
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

  if (isExternalRole(tm.role)) {
    const assignment = await prisma.siteAssignment.findFirst({
      where: { siteId, userId },
    });
    if (!assignment) return null;
  }

  return tm;
}
