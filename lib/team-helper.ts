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

export function isExternalRole(role: string): boolean {
  return ['PARTNER', 'GUEST', 'VIEWER'].includes(role);
}

export function isSystemRole(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'OWNER';
}

export function isCompanyAdminRole(role: string): boolean {
  return role === 'ADMIN_HR' || role === 'ADMIN';
}

export function canDeleteUser(
  actorRole: string,
  actorUserId: string,
  targetRole: string,
  targetUserId: string
): boolean {
  if (actorUserId === targetUserId) return false;
  // SUPER_ADMIN은 삭제 불가 (DB 시드 전용)
  if (isSystemRole(targetRole)) return false;
  if (getRoleLevel(actorRole) <= getRoleLevel(targetRole)) return false;
  return true;
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  // SUPER_ADMIN/OWNER는 절대 생성 불가 (UI/API 막음)
  if (targetRole === 'SUPER_ADMIN') return false;
  if (targetRole === 'OWNER') return false;
  // SUPER_ADMIN은 COMPANY_ADMIN(ADMIN_HR) 생성 가능 (여러 회사에 각 1개씩)
  if (actorRole === 'SUPER_ADMIN' || actorRole === 'OWNER') return true;
  // COMPANY_ADMIN은 자기보다 낮은 역할 생성 가능 (SUPER_ADMIN/OWNER 제외 위에서 처리)
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

  // SUPER_ADMIN은 모든 사이트 접근 가능
  if (isSystemRole(tm.role)) return tm;

  // 회사 스코프 강제
  if (site.teamId && site.teamId !== tm.teamId) return null;

  // 외부 계정은 배정된 현장만
  if (isExternalRole(tm.role)) {
    const assignment = await prisma.siteAssignment.findFirst({
      where: { siteId, userId },
    });
    if (!assignment) return null;
  }

  return tm;
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
  const isSuper = isSystemRole(role);
  const isCompanyAdmin = isCompanyAdminRole(role);
  const isManager = role === 'MANAGER';
  const isInternal = isSuper || isCompanyAdmin || isManager || role === 'USER' || role === 'MEMBER';
  const dept = department || '';

  return {
    isSuper,
    isCompanyAdmin,
    isManager,
    isInternal,
    canManageUsers: isSuper || isCompanyAdmin || isManager,
    canManageGuests: canManageGuests(role),
    canViewApprovals: isSuper || isCompanyAdmin || isManager,
    canApprove: isSuper || isCompanyAdmin || isManager,
    canViewSales: isSuper || isCompanyAdmin || dept.includes('영업') || dept.includes('경영'),
    canViewContract:
      isSuper || isCompanyAdmin || dept.includes('영업') || dept.includes('수주') || dept.includes('경영'),
    canViewProduction: isSuper || isCompanyAdmin || isManager || dept.includes('생산'),
    canViewPainting:
      isSuper || isCompanyAdmin || isManager || dept.includes('도장') || dept.includes('생산'),
    canViewShipping:
      isSuper || isCompanyAdmin || isManager || dept.includes('출하') || dept.includes('생산'),
  };
}

/**
 * 실질 계정 삭제 (세션/계정/배정/멤버십 포함)
 * - 다른 팀 소속이 없으면 User 레코드도 삭제
 * - 삭제 불가 시 비활성화로 대체
 */
export async function deleteUserFully(
  userId: string,
  teamId: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      // 세션/소셜계정 삭제
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      // 현장 배정 삭제
      await tx.siteAssignment.deleteMany({ where: { userId } });
      // 알림/메시지/댓글 등 연관 데이터 정리 (team 범위)
      await tx.notification.deleteMany({ where: { userId } });
      // 팀 멤버십 삭제
      await tx.teamMember.deleteMany({ where: { userId, teamId } });

      // 다른 팀에 소속이 없으면 완전 삭제
      const otherMemberships = await tx.teamMember.count({ where: { userId } });
      if (otherMemberships === 0) {
        try {
          await tx.user.delete({ where: { id: userId } });
        } catch {
          // 참조 무결성 제약으로 삭제 불가 시 비활성화
          const ts = Date.now();
          await tx.user.update({
            where: { id: userId },
            data: {
              email: `_deleted_${ts}_${userId}@lookup9.invalid`,
              password: null,
              name: `[삭제됨]`,
              lockedAt: new Date(),
              invalid_login_attempts: 999,
            },
          });
        }
      }
    });
    return { ok: true };
  } catch (error: any) {
    return { ok: false, message: error?.message || '삭제 중 오류가 발생했습니다.' };
  }
}
