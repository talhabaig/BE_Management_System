import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import type { AuthUser } from '../types/auth';
import { AppError } from '../utils/errors';
import { buildPagination, getPagination } from '../utils/pagination';
import { teamSelect, userPublicSelect, userSummarySelect } from '../utils/selectors';
import { assertCanManageTeam } from './authorization.service';
import type { AddTeamMemberInput, CreateTeamInput, ListTeamsQuery, UpdateTeamInput } from '../validators/team.validator';

const membershipSelect = {
  id: true,
  teamId: true,
  userId: true,
  createdAt: true,
  user: { select: userSummarySelect },
} as const;

function teamVisibilityWhere(actor: AuthUser): Prisma.TeamWhereInput {
  if (actor.role === 'ADMIN') {
    return {};
  }
  return {
    OR: [{ managerId: actor.id }, { members: { some: { userId: actor.id } } }],
  };
}

async function canViewTeam(actor: AuthUser, team: { id: string; managerId: string }): Promise<boolean> {
  if (actor.role === 'ADMIN' || team.managerId === actor.id) {
    return true;
  }
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: actor.id } },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function getTeamForActor(actor: AuthUser, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: teamSelect,
  });

  if (!team || !(await canViewTeam(actor, team))) {
    throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
  }

  return team;
}

export async function requireManageableTeam(actor: AuthUser, teamId: string) {
  const team = await getTeamForActor(actor, teamId);
  assertCanManageTeam(actor, team);
  return team;
}

async function requireManagerCandidate(managerId: string) {
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: userPublicSelect,
  });

  if (!manager) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  if (!manager.isActive) {
    throw new AppError(400, 'USER_INACTIVE', 'Inactive users cannot manage a team');
  }
  if (manager.role !== 'MANAGER' && manager.role !== 'ADMIN') {
    throw new AppError(400, 'INVALID_MANAGER', 'Team manager must have the MANAGER or ADMIN role');
  }

  return manager;
}

async function requireActiveUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  if (!user.isActive) {
    throw new AppError(400, 'USER_INACTIVE', 'Inactive users cannot be added to a team');
  }

  return user;
}

export async function createTeam(actor: AuthUser, input: CreateTeamInput) {
  if (actor.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to create a team');
  }

  await requireManagerCandidate(input.managerId);

  return prisma.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        managerId: input.managerId,
      },
    });

    await tx.teamMember.create({
      data: { teamId: team.id, userId: input.managerId },
    });

    return tx.team.findUniqueOrThrow({
      where: { id: team.id },
      select: teamSelect,
    });
  });
}

export async function listTeams(actor: AuthUser, query: ListTeamsQuery) {
  const pagination = getPagination(query.page, query.limit);
  const where: Prisma.TeamWhereInput = {
    AND: [
      teamVisibilityWhere(actor),
      ...(query.search ? [{ name: { contains: query.search, mode: 'insensitive' as const } }] : []),
    ],
  };

  const [total, data] = await prisma.$transaction([
    prisma.team.count({ where }),
    prisma.team.findMany({
      where,
      select: teamSelect,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
  ]);

  return { data, pagination: buildPagination(query.page, query.limit, total) };
}

export async function getTeam(actor: AuthUser, teamId: string) {
  return getTeamForActor(actor, teamId);
}

export async function updateTeam(actor: AuthUser, teamId: string, input: UpdateTeamInput) {
  const team = await getTeamForActor(actor, teamId);
  assertCanManageTeam(actor, team);

  if (input.managerId !== undefined && actor.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Only an administrator can assign a team manager');
  }

  if (input.managerId) {
    await requireManagerCandidate(input.managerId);
  }

  return prisma.$transaction(async (tx) => {
    if (input.managerId) {
      await tx.teamMember.upsert({
        where: { teamId_userId: { teamId, userId: input.managerId } },
        update: {},
        create: { teamId, userId: input.managerId },
      });
    }

    return tx.team.update({
      where: { id: teamId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
      },
      select: teamSelect,
    });
  });
}

export async function deleteTeam(actor: AuthUser, teamId: string) {
  if (actor.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete a team');
  }

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) {
    throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
  }

  const taskCount = await prisma.task.count({ where: { teamId } });
  if (taskCount > 0) {
    throw new AppError(409, 'TEAM_HAS_TASKS', 'Cannot delete a team that still has tasks');
  }

  await prisma.team.delete({ where: { id: teamId } });
}

export async function addMember(actor: AuthUser, teamId: string, input: AddTeamMemberInput) {
  await requireManageableTeam(actor, teamId);
  await requireActiveUser(input.userId);

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: input.userId } },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(409, 'ALREADY_TEAM_MEMBER', 'User is already a member of this team');
  }

  try {
    return await prisma.teamMember.create({
      data: { teamId, userId: input.userId },
      select: membershipSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'ALREADY_TEAM_MEMBER', 'User is already a member of this team');
    }
    throw error;
  }
}

export async function removeMember(actor: AuthUser, teamId: string, userId: string) {
  const team = await requireManageableTeam(actor, teamId);
  if (team.managerId === userId) {
    throw new AppError(400, 'CANNOT_REMOVE_MANAGER', 'Assign a new manager before removing the current manager');
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { id: true },
  });
  if (!membership) {
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'Team member not found');
  }

  await prisma.teamMember.delete({ where: { id: membership.id } });
}

export async function listMembers(actor: AuthUser, teamId: string, page: number, limit: number) {
  await getTeamForActor(actor, teamId);
  const pagination = getPagination(page, limit);
  const where = { teamId };
  const [total, data] = await prisma.$transaction([
    prisma.teamMember.count({ where }),
    prisma.teamMember.findMany({
      where,
      select: membershipSelect,
      orderBy: { createdAt: 'asc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
  ]);

  return { data, pagination: buildPagination(page, limit, total) };
}
