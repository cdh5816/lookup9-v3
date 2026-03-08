import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
console.log('🌱 LOOKUP9 시드 시작...');

// SUPER ADMIN 생성
const superAdmin = await prisma.user.upsert({
where: { email: '[admin@lookup9.com](mailto:admin@lookup9.com)' },
update: {},
create: {
email: '[admin@lookup9.com](mailto:admin@lookup9.com)',
name: 'LOOKUP9 Super Admin',
password: 'lookup9!@#',
role: 'SUPER_ADMIN',
},
});

console.log('✅ SUPER_ADMIN:', superAdmin.email);

// 팀 생성
const team = await prisma.team.upsert({
where: { slug: 'lookup9' },
update: {},
create: {
name: '덕인금속',
slug: 'lookup9',
},
});

console.log('✅ 팀:', team.name, '(slug:', team.slug, ')');

// SUPER_ADMIN 팀 멤버 등록
await prisma.teamMember.upsert({
where: {
teamId_userId: {
teamId: team.id,
userId: superAdmin.id,
},
},
update: {
role: 'SUPER_ADMIN',
},
create: {
teamId: team.id,
userId: superAdmin.id,
role: 'SUPER_ADMIN',
},
});

// ADMIN HR 생성
const adminHR = await prisma.user.upsert({
where: { email: '[hr@dukein.co.kr](mailto:hr@dukein.co.kr)' },
update: {},
create: {
email: '[hr@dukein.co.kr](mailto:hr@dukein.co.kr)',
name: '덕인금속 HR',
password: 'dukein!@#',
role: 'ADMIN_HR',
},
});

console.log('✅ ADMIN_HR:', adminHR.email);

await prisma.teamMember.upsert({
where: {
teamId_userId: {
teamId: team.id,
userId: adminHR.id,
},
},
update: {
role: 'ADMIN_HR',
},
create: {
teamId: team.id,
userId: adminHR.id,
role: 'ADMIN_HR',
},
});

console.log('🌱 LOOKUP9 시드 완료!');
}

main()
.catch((e) => {
console.error('❌ 시드 오류:', e);
process.exit(1);
})
.finally(async () => {
await prisma.$disconnect();
});
