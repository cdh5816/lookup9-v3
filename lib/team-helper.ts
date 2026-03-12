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

export function isCompanyAdminRole(role: string): boolean {
  return role === 'ADMIN_HR' || role === 'ADMIN';
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
    case 'VIEWER':
      return 'CLIENT_VIEWER';
    case 'GUEST':
      return 'CLIENT_GUEST';
    case 'SUPER_ADMIN':
    case 'OWNER':
      return 'SUPER_ADMIN';
    default:
      return role;
  }
}

export function getRoleGuide(role: string): string {
  switch (role) {
    case 'ADMIN_HR':
      return '회사 최고 관리자. 회사 전체 계정/현장/문서/요청 관리';
    case 'MANAGER':
      return '내부 팀장. 회사 전체 현장 조회 + 담당 부서 수정 + 게스트 관리';
    case 'USER':
      return '내부 직원. 회사 전체 현장 조회 + 담당 업무 입력';
    case 'PARTNER':
      return '협력사. 배정 현장만 조회/수정';
    case 'GUEST':
      return '외부 열람. 배정 현장만 조회';
    case 'VIEWER':
      return '외부 열람 전용';
    default:
      return '-';
  }
}

export async function getTeamMemberByUserId(userId: string) {
  return prisma.teamMember.findFirst({
    where: { userId },
    include: {
      team: { select: { id: true, slug: true, name: true } },
      user: { select: { id: true, department: true, company: true, position: true } },
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
  if (isCompanyAdminRole(targetRole) && actorRole !== 'SUPER_ADMIN' && actorRole !== 'OWNER') return false;
  if (getRoleLevel(actorRole) <= getRoleLevel(targetRole)) return false;
  return true;
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (targetRole === 'SUPER_ADMIN' || targetRole === 'OWNER') return false;
  if (actorRole === 'SUPER_ADMIN' || actorRole === 'OWNER') return true;
  if (actorRole === 'ADMIN_HR') return ['MANAGER', 'USER', 'PARTNER', 'GUEST', 'VIEWER'].includes(targetRole);
  if (actorRole === 'MANAGER') return ['USER', 'PARTNER', 'GUEST', 'VIEWER'].includes(targetRole);
  return false;
}

export function getAllowedRoleOptions(actorRole: string, hasCompanyAdmin: boolean) {
  const base = [
    { value: 'ADMIN_HR', label: 'COMPANY_ADMIN', disabled: hasCompanyAdmin || actorRole !== 'SUPER_ADMIN' },
    { value: 'MANAGER', label: 'INTERNAL_MANAGER', disabled: !canAssignRole(actorRole, 'MANAGER') },
    { value: 'USER', label: 'INTERNAL_USER', disabled: !canAssignRole(actorRole, 'USER') },
    { value: 'PARTNER', label: 'PARTNER', disabled: !canAssignRole(actorRole, 'PARTNER') },
    { value: 'GUEST', label: 'CLIENT_GUEST', disabled: !canAssignRole(actorRole, 'GUEST') },
    { value: 'VIEWER', label: 'CLIENT_VIEWER', disabled: !canAssignRole(actorRole, 'VIEWER') },
  ];
  return base;
}

export function canAccessSiteTab(role: string, department: string | null | undefined, tab: string): boolean {
  if (role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN_HR' || role === 'ADMIN') return true;
  if (role === 'GUEST' || role === 'VIEWER') {
    return ['overview', 'documents', 'comments'].includes(tab);
  }
  if (role === 'PARTNER') {
    return !['sales', 'contract', 'changes', 'history'].includes(tab);
  }

  const dept = department || '';
  if (tab === 'sales') return dept.includes('영업');
  if (tab === 'contract') return dept.includes('수주') || dept.includes('영업') || dept.includes('경영');
  if (tab === 'production') return dept.includes('생산') || dept.includes('공사') || dept.includes('도장') || dept.includes('출하') || role === 'MANAGER' || role === 'USER';
  if (tab === 'painting') return dept.includes('도장') || dept.includes('생산') || role === 'MANAGER';
  if (tab === 'shipping') return dept.includes('출하') || dept.includes('생산') || dept.includes('공사') || role === 'MANAGER';
  if (tab === 'changes') return role === 'MANAGER' || dept.includes('경영') || dept.includes('수주');
  return true;
}

export function canManageByDept(role: string, department: string | null | undefined, area: 'production' | 'painting' | 'shipping' | 'request' | 'change') {
  if (role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN_HR' || role === 'ADMIN') return true;
  if (role === 'PARTNER' && area === 'request') return true;
  const dept = department || '';
  if (area === 'production') return role === 'MANAGER' || dept.includes('생산') || dept.includes('공사');
  if (area === 'painting') return role === 'MANAGER' || dept.includes('도장') || dept.includes('생산');
  if (area === 'shipping') return role === 'MANAGER' || dept.includes('출하') || dept.includes('생산');
  if (area === 'request') return !isExternalRole(role) || role === 'PARTNER';
  if (area === 'change') return role === 'MANAGER' || dept.includes('경영') || dept.includes('수주');
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

  if (tm.role === 'PARTNER' || tm.role === 'GUEST' || tm.role === 'VIEWER') {
    const assignment = await prisma.siteAssignment.findFirst({ where: { siteId, userId } });
    if (!assignment) return null;
  }

  return tm;
}
