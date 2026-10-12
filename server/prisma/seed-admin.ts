import { PrismaClient, KycStatus, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const adminEmail = 'admin@student.sz';

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('Set ADMIN_PASSWORD to the administrator password (at least 12 characters).');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      roles: [Role.ADMIN],
      status: UserStatus.ACTIVE,
    },
    create: {
      fullName: 'Platform Administrator',
      email: adminEmail,
      phone: '+268 7600 0000',
      university: 'StudentXchange',
      passwordHash,
      roles: [Role.ADMIN],
      kycStatus: KycStatus.APPROVED,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`Administrator account configured: ${admin.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
