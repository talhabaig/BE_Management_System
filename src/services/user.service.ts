import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import type { AuthUser } from '../types/auth';
import { AppError } from '../utils/errors';
import { buildPagination, getPagination } from '../utils/pagination';
import { userPublicSelect } from '../utils/selectors';
import type { ListUsersQuery, UpdateUserInput } from '../validators/user.validator';

export async function listUsers(query: ListUsersQuery) {
  const pagination = getPagination(query.page, query.limit);
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, data] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userPublicSelect,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
  ]);

  return { data, pagination: buildPagination(query.page, query.limit, total) };
}

export async function getUser(actor: AuthUser, userId: string) {
  if (actor.role === 'USER' && actor.id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view this user');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userPublicSelect,
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return user;
}

export async function updateUser(actor: AuthUser, userId: string, input: UpdateUserInput) {
  if (actor.role !== 'ADMIN' && actor.id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to update this user');
  }

  if (actor.role !== 'ADMIN' && (input.role !== undefined || input.isActive !== undefined)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to change role or account status');
  }

  if (actor.role === 'ADMIN' && actor.id === userId) {
    if (input.role && input.role !== 'ADMIN') {
      throw new AppError(400, 'CANNOT_CHANGE_OWN_ROLE', 'Administrators cannot change their own role');
    }
    if (input.isActive === false) {
      throw new AppError(400, 'CANNOT_DEACTIVATE_SELF', 'Administrators cannot deactivate their own account');
    }
  }

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: userPublicSelect,
    });

    if (input.isActive === false) {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return user;
  });
}

export async function deactivateUser(actor: AuthUser, userId: string) {
  if (actor.id === userId) {
    throw new AppError(400, 'CANNOT_DEACTIVATE_SELF', 'Administrators cannot deactivate their own account');
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: userPublicSelect,
  });
  if (!existing) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const managedTeams = await prisma.team.count({ where: { managerId: userId } });
  if (managedTeams > 0) {
    throw new AppError(409, 'USER_MANAGES_TEAMS', 'Reassign teams before deactivating this user');
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: userPublicSelect,
    });
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return user;
  });
}
