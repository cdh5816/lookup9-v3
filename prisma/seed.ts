const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 LOOKUP9 시드 시작...');

  // 1. SUPER_ADMIN 생성
  const superAdminPassword = await hash('lookup9!@#', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@lookup9.com' },
    update: {},
    create: {
      id: randomUUID(),
      name: '시스템관리자',
      email: 'admin@lookup9.com',
      password: superAdminPassword,
      company: 'LOOKUP9',
      department: '시스템',
      position: '관리자',
    },
  });
  console.log('✅ SUPER_ADMIN:', superAdmin.email);

  // 2. 덕인금속 팀 생성
  const team = await prisma.team.upsert({
    where: { slug: 'lookup9' },
    update: {},
    create: {
      id: randomUUID(),
      name: '덕인금속',
      slug: 'lookup9',
      defaultRole: 'USER',
    },
  });
  console.log('✅ 팀:', team.name, '(slug:', team.slug, ')');

  // 3. SUPER_ADMIN을 팀에 연결
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, oduserId: superAdmin.id } },
    update: { role: 'SUPER_ADMIN' },
    create: {
      teamId: team.id,
      userId: superAdmin.id,
      role: 'SUPER_ADMIN',
    },
  });

  // 4. ADMIN_HR 생성
  const adminHrPassword = await hash('dukein!@#', 12);
  const adminHr = await prisma.user.upsert({
    where: { email: 'hr@dukein.co.kr' },
    update: {},
    create: {
      id: randomUUID(),
      name: '경영지원',
      email: 'hr@dukein.co.kr',
      password: adminHrPassword,
      company: '덕인금속',
      department: '경영지원부',
      position: '부장',
    },
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: adminHr.id } },
    update: { role: 'ADMIN_HR' },
    create: {
      teamId: team.id,
      userId: adminHr.id,
      role: 'ADMIN_HR',
    },
  });
  console.log('✅ ADMIN_HR:', adminHr.email);

  console.log('🌱 LOOKUP9 시드 완료!');
  console.log('');
  console.log('=== 로그인 정보 ===');
  console.log('SUPER_ADMIN: admin@lookup9.com / lookup9!@#');
  console.log('ADMIN_HR: hr@dukein.co.kr / dukein!@#');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
