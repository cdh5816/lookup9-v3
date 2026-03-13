/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('lookup9!@#', 10);

  const superAdminUser = await prisma.user.upsert({
    where: { email: 'admin@lookup9.com' },
    update: {
      name: 'LOOKUP9 SUPER ADMIN',
      username: 'admin',
      password: hashed,
      company: 'LOOKUP9',
      department: '시스템관리',
      position: 'SUPER_ADMIN',
    },
    create: {
      name: 'LOOKUP9 SUPER ADMIN',
      email: 'admin@lookup9.com',
      username: 'admin',
      password: hashed,
      company: 'LOOKUP9',
      department: '시스템관리',
      position: 'SUPER_ADMIN',
    },
  });

  const systemTeam = await prisma.team.upsert({
    where: { slug: 'lookup9' },
    update: { name: 'LOOKUP9', defaultRole: 'USER' },
    create: {
      name: 'LOOKUP9',
      slug: 'lookup9',
      defaultRole: 'USER',
    },
  });

  const existingMembership = await prisma.teamMember.findFirst({
    where: { teamId: systemTeam.id, userId: superAdminUser.id },
  });

  if (!existingMembership) {
    await prisma.teamMember.create({
      data: { teamId: systemTeam.id, userId: superAdminUser.id, role: 'SUPER_ADMIN' },
    });
  } else if (existingMembership.role !== 'SUPER_ADMIN') {
    await prisma.teamMember.update({
      where: { id: existingMembership.id },
      data: { role: 'SUPER_ADMIN' },
    });
  }

  await prisma.teamMember.deleteMany({
    where: {
      role: 'ADMIN_HR',
      user: { email: 'hr@dukein.co.kr' },
    },
  });

  await prisma.user.deleteMany({
    where: { email: 'hr@dukein.co.kr' },
  });

  console.log('✅ SUPER_ADMIN: 아이디 admin / 비밀번호 lookup9!@#');
  console.log('✅ Seed cleaned test ADMIN_HR account');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
