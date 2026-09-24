import type { Role } from '@prisma/client';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { hashPassword } from '../../src/utils/password';

export const password = 'Password123!';

export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.task.deleteMany(),
    prisma.teamMember.deleteMany(),
    prisma.team.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function createUser(input: { name: string; email: string; role?: Role }) {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(password),
      role: input.role ?? 'USER',
    },
  });
}

export async function login(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data.accessToken as string;
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function createTeam(managerId: string, memberIds: string[], name = 'Delivery') {
  const team = await prisma.team.create({
    data: {
      name,
      managerId,
      description: 'Delivery team',
    },
  });
  const uniqueIds = [...new Set([managerId, ...memberIds])];
  await prisma.teamMember.createMany({
    data: uniqueIds.map((userId) => ({ teamId: team.id, userId })),
  });
  return team;
}
