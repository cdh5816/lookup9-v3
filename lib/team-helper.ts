import { prisma } from '@/lib/prisma';

/**
 * LOOKUP9 권한 계층
 * 
 * SUPER_ADMIN (레벨5): 시스템 관리자. 회사(팀) 생성/삭제. DB seed로만 생성.
 *   → 회사를 만들고, 각 회사에 ADMIN_HR 최초 계정을 심는 사람.
 *   → 일반 업무 데이터에는 관여하지 않음.
 * 
 * ADMIN_HR (레벨4): 회사 내 최고 관리자.
 *   → 자기 회사(팀) 안에서 유저 생성/삭제/권한변경.
 *   → SUPER_ADMIN/OWNER 역할은 부여 불가.
 *   → ADMIN_HR끼리는 삭제 불가 (동급 보호).
 * 
 * MANAGER (레벨3): 부서장. 유저/게스트 생성 가능 (USER 이하만).
 *   → ADMIN_HR 이상은 절대 삭제/변경 불가.
 * 
 * USER (레벨2) / PARTNER (레벨1) / GUEST (레벨0)
 *   → 계정 관리 접근 불가.
 */

const ROLE_LEVEL: Record<string, number> = {
  GUEST: 0, VIEWER: 0, PARTNER: 1, MEMBER: 2, USER: 2,
  MANAGER: 3, ADMIN_HR: 4, ADMIN: 4, OWNER: 5, SUPER_ADMIN: 5,
};

export function getRoleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? 0;
}

/** 세션 유저의 teamMember 조회 */
export async function getTeamMemberByUserId(userId: string) {
  return prisma.teamMember.findFirst({
    where: { userId },
    include: { team: { select: { id: true, slug: true, name: true } } },
  });
}

/** 최소 역할 레벨 체크 */
export function hasMinRole(currentRole: string, minRole: string): boolean {
  return getRoleLevel(currentRole) >= getRoleLevel(minRole);
}

/**
 * 삭제 가능 여부
 * - 자기 자신 삭제 불가
 * - 동급 이상 삭제 불가 (ADMIN_HR끼리 삭제 불가)
 * - SUPER_ADMIN/OWNER는 ADMIN_HR도 삭제 불가 (DB seed 전용이므로 직접 관리)
 */
export function canDeleteUser(
  actorRole: string, actorUserId: string,
  targetRole: string, targetUserId: string
): boolean {
  if (actorUserId === targetUserId) return false;
  if (getRoleLevel(actorRole) <= getRoleLevel(targetRole)) return false;
  return true;
}

/**
 * 역할 부여 가능 여부
 * - SUPER_ADMIN/OWNER: 모든 역할 부여 가능 (SUPER_ADMIN 제외 — DB seed 전용)
 * - ADMIN_HR: MANAGER 이하만 부여 가능
 * - MANAGER: USER/PARTNER/GUEST만 부여 가능
 */
export function canAssignRole(actorRole: string, targetRole: string): boolean {
  // SUPER_ADMIN은 DB seed 전용 — 아무도 UI에서 부여 불가
  if (targetRole === 'SUPER_ADMIN') return false;
  // OWNER도 UI에서 부여 불가
  if (targetRole === 'OWNER') return false;
  // SUPER_ADMIN/OWNER 본인은 나머지 역할 부여 가능
  if (actorRole === 'SUPER_ADMIN' || actorRole === 'OWNER') return true;
  // 자기보다 높거나 같은 역할 부여 불가
  if (getRoleLevel(targetRole) >= getRoleLevel(actorRole)) return false;
  return true;
}

/**
 * 현장 접근 검증 — 같은 팀 소속인지 + PARTNER/GUEST는 배정 확인
 * 모든 sites/[id]/* API에서 공통 사용
 */
export async function verifySiteAccess(userId: string, siteId: string) {
  const tm = await getTeamMemberByUserId(userId);
  if (!tm) return null;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, teamId: true },
  });
  if (!site) return null;

  // teamId가 있으면 같은 팀인지 확인
  if (site.teamId && site.teamId !== tm.teamId) return null;

  // PARTNER/GUEST는 배정 확인
  if (tm.role === 'PARTNER' || tm.role === 'GUEST') {
    const assignment = await prisma.siteAssignment.findFirst({
      where: { siteId, userId },
    });
    if (!assignment) return null;
  }

  return tm;
}
