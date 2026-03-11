/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

export const SUPER_ROLES = ['SUPER_ADMIN', 'OWNER'] as const;
export const COMPANY_ADMIN_ROLES = ['ADMIN_HR', 'ADMIN'] as const;
export const INTERNAL_MANAGER_ROLES = ['MANAGER'] as const;
export const INTERNAL_USER_ROLES = ['USER', 'MEMBER'] as const;
export const PARTNER_ROLES = ['PARTNER'] as const;
export const EXTERNAL_VIEW_ROLES = ['GUEST', 'VIEWER'] as const;

export const INTERNAL_ROLES = [
  ...COMPANY_ADMIN_ROLES,
  ...INTERNAL_MANAGER_ROLES,
  ...INTERNAL_USER_ROLES,
] as const;

export const EXTERNAL_ROLES = [
  ...PARTNER_ROLES,
  ...EXTERNAL_VIEW_ROLES,
] as const;

export function isSuperRole(role?: string | null) {
  return !!role && SUPER_ROLES.includes(role as any);
}

export function isCompanyAdminRole(role?: string | null) {
  return !!role && COMPANY_ADMIN_ROLES.includes(role as any);
}

export function isInternalManagerRole(role?: string | null) {
  return !!role && INTERNAL_MANAGER_ROLES.includes(role as any);
}

export function isInternalUserRole(role?: string | null) {
  return !!role && INTERNAL_USER_ROLES.includes(role as any);
}

export function isInternalRole(role?: string | null) {
  return !!role && INTERNAL_ROLES.includes(role as any);
}

export function isPartnerRole(role?: string | null) {
  return !!role && PARTNER_ROLES.includes(role as any);
}

export function isExternalViewerRole(role?: string | null) {
  return !!role && EXTERNAL_VIEW_ROLES.includes(role as any);
}

export function isExternalRole(role?: string | null) {
  return !!role && EXTERNAL_ROLES.includes(role as any);
}

export function requiresSiteAssignment(role?: string | null) {
  return isExternalRole(role);
}

export function canUpdateAssignedSite(role?: string | null) {
  return isInternalRole(role) || isPartnerRole(role);
}

export function getRoleDisplayName(role?: string | null) {
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
    case 'GUEST':
    case 'VIEWER':
      return 'CLIENT/GUEST';
    case 'SUPER_ADMIN':
    case 'OWNER':
      return 'SUPER_ADMIN';
    default:
      return role || '-';
  }
}

export function getCompanyDisplayName(profile?: { company?: string | null; teamMembers?: Array<{ team?: { name?: string | null } }> } | null) {
  return profile?.company?.trim() || profile?.teamMembers?.[0]?.team?.name?.trim() || 'LOOKUP9';
}
