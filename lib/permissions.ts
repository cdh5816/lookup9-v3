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
  | 'team_api_key';

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

const allAccess: Permission[] = [
  { resource: 'team', actions: '*' },
  { resource: 'team_member', actions: '*' },
  { resource: 'team_invitation', actions: '*' },
  { resource: 'team_sso', actions: '*' },
  { resource: 'team_dsync', actions: '*' },
  { resource: 'team_audit_log', actions: '*' },
  { resource: 'team_payments', actions: '*' },
  { resource: 'team_webhook', actions: '*' },
  { resource: 'team_api_key', actions: '*' },
];

const readOnly: Permission[] = [
  { resource: 'team', actions: ['read', 'leave'] },
];

export const permissions: RolePermissions = {
  SUPER_ADMIN: allAccess,
  ADMIN_HR: allAccess,
  MANAGER: allAccess,
  USER: readOnly,
  PARTNER: readOnly,
  GUEST: readOnly,
  VIEWER: readOnly,
  OWNER: allAccess,
  ADMIN: allAccess,
  MEMBER: readOnly,
};
