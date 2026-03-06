import { Role } from '@prisma/client';

type RoleType = (typeof Role)[keyof typeof Role];
export type Action = 'create' | 'update' | 'read' | 'delete' | 'leave';
export type Resource =
  | 'team'
  | 'team_member'
  | 'team_invitation'
  | 'team_sso'
  | 'team_dsync'
  | 'team_audit_log'
  | 'team_webhook'
  | 'team_payments'
  | 'team_api_key'
  | 'site'
  | 'site_assignment'
  | 'sales'
  | 'contract'
  | 'production'
  | 'shipping'
  | 'painting'
  | 'document'
  | 'comment'
  | 'message'
  | 'client'
  | 'user_management'
  | 'leave_management'
  | 'admin_hr';

type RolePermissions = {
  [role in RoleType]: Permission[];
};

export type Permission = {
  resource: Resource;
  actions: Action[] | '*';
};

export const availableRoles = [
  { id: Role.SUPER_ADMIN, name: 'Super Admin' },
  { id: Role.ADMIN_HR, name: 'Admin HR' },
  { id: Role.MANAGER, name: 'Manager' },
  { id: Role.USER, name: 'User' },
  { id: Role.PARTNER, name: 'Partner' },
  { id: Role.GUEST, name: 'Guest' },
  { id: Role.VIEWER, name: 'Viewer' },
  { id: Role.OWNER, name: 'Owner' },
  { id: Role.ADMIN, name: 'Admin' },
  { id: Role.MEMBER, name: 'Member' },
];

// SUPER_ADMIN / OWNER: 전 권한
const superAdminAccess: Permission[] = [
  { resource: 'team', actions: '*' },
  { resource: 'team_member', actions: '*' },
  { resource: 'team_invitation', actions: '*' },
  { resource: 'team_sso', actions: '*' },
  { resource: 'team_dsync', actions: '*' },
  { resource: 'team_audit_log', actions: '*' },
  { resource: 'team_payments', actions: '*' },
  { resource: 'team_webhook', actions: '*' },
  { resource: 'team_api_key', actions: '*' },
  { resource: 'site', actions: '*' },
  { resource: 'site_assignment', actions: '*' },
  { resource: 'sales', actions: '*' },
  { resource: 'contract', actions: '*' },
  { resource: 'production', actions: '*' },
  { resource: 'shipping', actions: '*' },
  { resource: 'painting', actions: '*' },
  { resource: 'document', actions: '*' },
  { resource: 'comment', actions: '*' },
  { resource: 'message', actions: '*' },
  { resource: 'client', actions: '*' },
  { resource: 'user_management', actions: '*' },
  { resource: 'leave_management', actions: '*' },
  { resource: 'admin_hr', actions: '*' },
];

// ADMIN_HR: 전 권한 (SUPER_ADMIN 생성 불가는 별도 로직)
const adminHrAccess: Permission[] = [
  ...superAdminAccess,
];

// MANAGER: 현장/생산/출하/댓글/쪽지/문서 전체 + 게스트 생성
const managerAccess: Permission[] = [
  { resource: 'team', actions: ['read'] },
  { resource: 'team_member', actions: ['read'] },
  { resource: 'site', actions: '*' },
  { resource: 'site_assignment', actions: '*' },
  { resource: 'sales', actions: '*' },
  { resource: 'contract', actions: '*' },
  { resource: 'production', actions: '*' },
  { resource: 'shipping', actions: '*' },
  { resource: 'painting', actions: '*' },
  { resource: 'document', actions: '*' },
  { resource: 'comment', actions: '*' },
  { resource: 'message', actions: '*' },
  { resource: 'client', actions: '*' },
  { resource: 'user_management', actions: ['create', 'read'] },
];

// USER: 전체현장 열람 + 본인 부서 업무
const userAccess: Permission[] = [
  { resource: 'team', actions: ['read', 'leave'] },
  { resource: 'site', actions: ['read'] },
  { resource: 'sales', actions: ['read'] },
  { resource: 'contract', actions: ['read'] },
  { resource: 'production', actions: ['read'] },
  { resource: 'shipping', actions: ['read'] },
  { resource: 'painting', actions: ['read'] },
  { resource: 'document', actions: ['read'] },
  { resource: 'comment', actions: ['create', 'read'] },
  { resource: 'message', actions: ['create', 'read'] },
  { resource: 'client', actions: ['read'] },
];

// PARTNER: 배정현장만 + 상세 수정 + 영업/수주/경영 숨김
const partnerAccess: Permission[] = [
  { resource: 'team', actions: ['read'] },
  { resource: 'site', actions: ['read', 'update'] },
  { resource: 'production', actions: ['read', 'update'] },
  { resource: 'shipping', actions: ['read', 'update'] },
  { resource: 'painting', actions: ['read', 'update'] },
  { resource: 'document', actions: ['read', 'create'] },
  { resource: 'comment', actions: ['create', 'read'] },
  { resource: 'message', actions: ['create', 'read'] },
];

// GUEST: 배정현장만 + 진행률 열람 + 요청 작성 + 달력 미팅 요청
const guestAccess: Permission[] = [
  { resource: 'team', actions: ['read'] },
  { resource: 'site', actions: ['read'] },
  { resource: 'document', actions: ['read'] },
  { resource: 'comment', actions: ['create', 'read'] },
  { resource: 'message', actions: ['create', 'read'] },
];

export const permissions: RolePermissions = {
  SUPER_ADMIN: superAdminAccess,
  ADMIN_HR: adminHrAccess,
  MANAGER: managerAccess,
  USER: userAccess,
  PARTNER: partnerAccess,
  GUEST: guestAccess,
  VIEWER: guestAccess,
  OWNER: superAdminAccess,
  ADMIN: adminHrAccess,
  MEMBER: userAccess,
};

// ========= Role+Department 복합 권한 헬퍼 =========

/**
 * USER 역할이지만 부서가 영업부면 영업 메뉴 write 가능
 * USER 역할이지만 부서가 생산관리팀이면 생산 write 가능 등
 */
const departmentResourceMap: Record<string, Resource[]> = {
  '영업부': ['sales'],
  '수주팀': ['contract'],
  '생산관리팀': ['production'],
  '도장팀': ['painting'],
  '출하팀': ['shipping'],
  '공사팀': ['production', 'shipping'],
  '경영지원부': ['admin_hr', 'leave_management', 'user_management'],
};

export function canAccess(
  role: RoleType,
  resource: Resource,
  action: Action,
  department?: string | null
): boolean {
  const rolePerms = permissions[role] || [];

  // Role 기반 검사
  const hasPerm = rolePerms.some((p) => {
    if (p.resource !== resource) return false;
    if (p.actions === '*') return true;
    return p.actions.includes(action);
  });

  if (hasPerm) return true;

  // USER 역할일 때 Department 복합 권한 확인
  if ((role === 'USER' || role === 'MEMBER') && department) {
    const deptResources = departmentResourceMap[department];
    if (deptResources && deptResources.includes(resource)) {
      // Department 매칭 → create/update/read 허용 (delete는 MANAGER 이상만)
      if (action !== 'delete') return true;
    }
  }

  return false;
}

/**
 * PARTNER/GUEST가 배정된 현장만 접근 가능한지 체크
 */
export function needsSiteAssignment(role: RoleType): boolean {
  return role === 'PARTNER' || role === 'GUEST' || role === 'VIEWER';
}
