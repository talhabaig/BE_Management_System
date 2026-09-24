import { prisma } from '../src/prisma/client';

afterAll(async () => {
  await prisma.$disconnect();
});
