import { Role } from '@prisma/client';
import { ApiError } from './errors';
import { getTeamMember } from 'models/team';

// LOOKUP9 역할 계층 (숫자가 클수록 상위)
const roleHierarchy: Record<string, number> = {
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

function getRoleLevel(role: string): number {
  return roleHierarchy[role] ?? 0;
}

export async function validateMembershipOperation(
  memberId: string,
  teamMember: { role: Role; team: { slug: string } },
  operationMeta?: {
    role?: Role;
  }
) {
  const updatingMember = await getTeamMember(memberId, teamMember.team.slug);
  const actorLevel = getRoleLevel(teamMember.role);
  const targetLevel = getRoleLevel(updatingMember.role);

  // 자기보다 상위 역할 수정 불가
  if (actorLevel <= targetLevel && teamMember.role !== 'SUPER_ADMIN' && teamMember.role !== 'OWNER') {
    throw new ApiError(
      403,
      'You do not have permission to update this member.'
    );
  }

  // ADMIN_HR은 SUPER_ADMIN/OWNER 생성 불가
  if (
    (teamMember.role === 'ADMIN_HR' || teamMember.role === 'ADMIN') &&
    operationMeta?.role &&
    (operationMeta.role === 'SUPER_ADMIN' || operationMeta.role === 'OWNER')
  ) {
    throw new ApiError(
      403,
      'ADMIN_HR cannot assign SUPER_ADMIN or OWNER role.'
    );
  }

  // MANAGER는 ADMIN_HR 이상 생성 불가
  if (
    teamMember.role === 'MANAGER' &&
    operationMeta?.role &&
    getRoleLevel(operationMeta.role) >= getRoleLevel('ADMIN_HR')
  ) {
    throw new ApiError(
      403,
      'Manager cannot assign ADMIN_HR or higher roles.'
    );
  }

  // USER/MEMBER는 역할 변경 불가
  if (
    (teamMember.role === 'USER' || teamMember.role === 'MEMBER') &&
    operationMeta?.role
  ) {
    throw new ApiError(
      403,
      'You do not have permission to change roles.'
    );
  }
}
