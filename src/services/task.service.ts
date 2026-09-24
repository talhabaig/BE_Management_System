import { Prisma, type TaskStatus } from '@prisma/client';
import { prisma } from '../prisma/client';
import type { AuthUser } from '../types/auth';
import { buildPagination, getPagination } from '../utils/pagination';
import { taskSelect } from '../utils/selectors';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from '../validators/task.validator';
import {
  assertAssignableMember,
  assertCanManageTask,
  assertCanUpdateStatus,
  buildTaskWhere,
  findVisibleTask,
  statusRecipients,
  type TaskView,
} from './authorization.service';
import { createNotification } from './notification.service';
import { requireManageableTeam } from './team.service';

type DbClient = Prisma.TransactionClient;

async function notifyAssignment(db: DbClient, task: TaskView, actorId: string, assignedToId: string) {
  if (assignedToId === actorId) {
    return;
  }
  await createNotification(db, {
    userId: assignedToId,
    type: 'TASK_ASSIGNED',
    title: 'Task assigned',
    message: `You have been assigned to task "${task.title}".`,
    taskId: task.id,
  });
}

async function notifyStatusChange(db: DbClient, task: TaskView, actorId: string, status: TaskStatus) {
  const recipients = statusRecipients(task, actorId);
  for (const userId of recipients) {
    await createNotification(db, {
      userId,
      type: 'TASK_STATUS_UPDATED',
      title: 'Task status updated',
      message: `Task "${task.title}" status changed to ${status}.`,
      taskId: task.id,
    });
  }
}

export async function createTask(actor: AuthUser, input: CreateTaskInput) {
  await requireManageableTeam(actor, input.teamId);
  if (input.assignedToId) {
    await assertAssignableMember(input.teamId, input.assignedToId);
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'TODO',
        priority: input.priority ?? 'MEDIUM',
        deadline: input.deadline ?? null,
        teamId: input.teamId,
        assignedToId: input.assignedToId ?? null,
        createdById: actor.id,
      },
      select: taskSelect,
    });

    if (created.assignedToId) {
      await notifyAssignment(tx, created, actor.id, created.assignedToId);
    }

    return created;
  });
}

export async function listTasks(actor: AuthUser, query: ListTasksQuery) {
  const where = buildTaskWhere(actor, query);
  const pagination = getPagination(query.page, query.limit);
  const orderBy = { [query.sortBy]: query.sortOrder } as Prisma.TaskOrderByWithRelationInput;

  const [total, data] = await prisma.$transaction([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      select: taskSelect,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit,
    }),
  ]);

  return { data, pagination: buildPagination(query.page, query.limit, total) };
}

export async function getTask(actor: AuthUser, taskId: string) {
  return findVisibleTask(actor, taskId);
}

export async function updateTask(actor: AuthUser, taskId: string, input: UpdateTaskInput) {
  const existing = await findVisibleTask(actor, taskId);
  assertCanManageTask(actor, existing);

  const nextTeamId = input.teamId ?? existing.teamId;
  if (input.teamId && input.teamId !== existing.teamId) {
    await requireManageableTeam(actor, input.teamId);
  }

  const nextAssignee = input.assignedToId === undefined ? existing.assignedToId : input.assignedToId;
  if (nextAssignee) {
    await assertAssignableMember(nextTeamId, nextAssignee);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
        ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
        ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
      },
      select: taskSelect,
    });

    if (input.assignedToId && input.assignedToId !== existing.assignedToId) {
      await notifyAssignment(tx, updated, actor.id, input.assignedToId);
    }

    if (input.status && input.status !== existing.status) {
      await notifyStatusChange(tx, updated, actor.id, input.status);
    }

    return updated;
  });
}

export async function deleteTask(actor: AuthUser, taskId: string) {
  const existing = await findVisibleTask(actor, taskId);
  assertCanManageTask(actor, existing);
  await prisma.task.delete({ where: { id: taskId } });
}

export async function assignTask(actor: AuthUser, taskId: string, assignedToId: string) {
  const existing = await findVisibleTask(actor, taskId);
  assertCanManageTask(actor, existing);
  await assertAssignableMember(existing.teamId, assignedToId);

  if (existing.assignedToId === assignedToId) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: { assignedToId },
      select: taskSelect,
    });
    await notifyAssignment(tx, updated, actor.id, assignedToId);
    return updated;
  });
}

export async function updateTaskStatus(actor: AuthUser, taskId: string, status: TaskStatus) {
  const existing = await findVisibleTask(actor, taskId);
  assertCanUpdateStatus(actor, existing);

  if (existing.status === status) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: { status },
      select: taskSelect,
    });
    await notifyStatusChange(tx, updated, actor.id, status);
    return updated;
  });
}
