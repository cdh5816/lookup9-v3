/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

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
  { id: Role.ADMIN_HR, name: 'COMPANY_ADMIN' },
  { id: Role.MANAGER, name: 'INTERNAL_MANAGER' },
  { id: Role.USER, name: 'INTERNAL_USER' },
  { id: Role.PARTNER, name: 'PARTNER' },
  { id: Role.GUEST, name: 'CLIENT/GUEST' },
  { id: Role.VIEWER, name: 'CLIENT/GUEST (VIEW ONLY)' },
];

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

const adminHrAccess: Permission[] = [...superAdminAccess];

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

const userAccess: Permission[] = [
  { resource: 'team', actions: ['read', 'leave'] },
  { resource: 'site', actions: ['read', 'create', 'update'] },
  { resource: 'sales', actions: ['read', 'create', 'update'] },
  { resource: 'contract', actions: ['read', 'create', 'update'] },
  { resource: 'production', actions: ['read', 'create', 'update'] },
  { resource: 'shipping', actions: ['read', 'create', 'update'] },
  { resource: 'painting', actions: ['read', 'create', 'update'] },
  { resource: 'document', actions: ['read', 'create'] },
  { resource: 'comment', actions: ['create', 'read'] },
  { resource: 'message', actions: ['create', 'read'] },
  { resource: 'client', actions: ['read'] },
];

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

const departmentResourceMap: Record<string, Resource[]> = {
  영업부: ['sales', 'site'],
  수주팀: ['contract'],
  생산관리팀: ['production'],
  도장팀: ['painting'],
  출하팀: ['shipping'],
  공사팀: ['production', 'shipping'],
  경영지원부: ['admin_hr', 'leave_management', 'user_management'],
};

export function canAccess(
  role: RoleType,
  resource: Resource,
  action: Action,
  department?: string | null
): boolean {
  const rolePerms = permissions[role] || [];

  const hasPerm = rolePerms.some((p) => {
    if (p.resource !== resource) return false;
    if (p.actions === '*') return true;
    return p.actions.includes(action);
  });

  if (hasPerm) return true;

  if ((role === 'USER' || role === 'MEMBER') && department) {
    const deptResources = departmentResourceMap[department];
    if (deptResources?.includes(resource) && action !== 'delete') return true;
  }

  return false;
}

export function needsSiteAssignment(role: RoleType): boolean {
  return role === 'PARTNER' || role === 'GUEST' || role === 'VIEWER';
}
