import { Prisma, type TaskStatus } from '@prisma/client';
import { prisma } from '../prisma/client';
import type { AuthUser } from '../types/auth';
import { AppError } from '../utils/errors';
import { taskSelect } from '../utils/selectors';
import type { TaskFilters } from '../validators/task.validator';

export type TaskView = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

export function assertCanManageTeam(actor: AuthUser, team: { managerId: string }): void {
  if (actor.role === 'ADMIN') {
    return;
  }
  if (actor.role === 'MANAGER' && team.managerId === actor.id) {
    return;
  }
  throw new AppError(403, 'FORBIDDEN', 'You do not have permission to manage this team');
}

export function taskVisibilityWhere(actor: AuthUser): Prisma.TaskWhereInput {
  if (actor.role === 'ADMIN') {
    return {};
  }
  if (actor.role === 'MANAGER') {
    return {
      OR: [{ team: { managerId: actor.id } }, { assignedToId: actor.id }],
    };
  }
  return { assignedToId: actor.id };
}

export function buildTaskWhere(actor: AuthUser, filters: TaskFilters): Prisma.TaskWhereInput {
  const clauses: Prisma.TaskWhereInput[] = [taskVisibilityWhere(actor)];

  if (filters.search) {
    clauses.push({
      OR: [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.status) {
    clauses.push({ status: filters.status });
  }
  if (filters.priority) {
    clauses.push({ priority: filters.priority });
  }
  if (filters.teamId) {
    clauses.push({ teamId: filters.teamId });
  }
  if (filters.assignedToId) {
    clauses.push({ assignedToId: filters.assignedToId });
  }
  if (filters.deadlineFrom || filters.deadlineTo) {
    clauses.push({
      deadline: {
        ...(filters.deadlineFrom ? { gte: filters.deadlineFrom } : {}),
        ...(filters.deadlineTo ? { lte: filters.deadlineTo } : {}),
      },
    });
  }

  return { AND: clauses };
}

export async function findVisibleTask(actor: AuthUser, taskId: string): Promise<TaskView> {
  const task = await prisma.task.findFirst({
    where: { AND: [{ id: taskId }, taskVisibilityWhere(actor)] },
    select: taskSelect,
  });

  if (!task) {
    throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
  }

  return task;
}

export function assertCanManageTask(actor: AuthUser, task: { team: { managerId: string } }): void {
  if (actor.role === 'ADMIN') {
    return;
  }
  if (actor.role === 'MANAGER' && task.team.managerId === actor.id) {
    return;
  }
  throw new AppError(403, 'FORBIDDEN', 'You do not have permission to manage this task');
}

export function assertCanUpdateStatus(
  actor: AuthUser,
  task: { assignedToId: string | null; team: { managerId: string } },
): void {
  if (actor.role === 'ADMIN') {
    return;
  }
  if (actor.role === 'MANAGER' && task.team.managerId === actor.id) {
    return;
  }
  if (task.assignedToId === actor.id) {
    return;
  }
  throw new AppError(403, 'FORBIDDEN', 'You do not have permission to update this task status');
}

export async function assertAssignableMember(teamId: string, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  if (!user.isActive) {
    throw new AppError(400, 'USER_INACTIVE', 'Inactive users cannot be assigned');
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { id: true },
  });

  if (!membership) {
    throw new AppError(400, 'ASSIGNEE_NOT_IN_TEAM', 'Assigned user must belong to the task team');
  }
}

export function statusRecipients(
  task: { assignedToId: string | null; createdById: string; team: { managerId: string } },
  actorId: string,
): string[] {
  const recipients = new Set<string>();
  if (task.assignedToId) {
    recipients.add(task.assignedToId);
  }
  recipients.add(task.createdById);
  recipients.add(task.team.managerId);
  recipients.delete(actorId);
  return [...recipients];
}

export type { TaskStatus };
