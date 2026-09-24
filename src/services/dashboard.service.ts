import type { TaskStatus } from '@prisma/client';
import { prisma } from '../prisma/client';
import type { AuthUser } from '../types/auth';
import { buildTaskWhere } from './authorization.service';
import type { TaskFilters } from '../validators/task.validator';

export async function getDashboardSummary(actor: AuthUser, filters: TaskFilters) {
  const where = buildTaskWhere(actor, filters);
  const now = new Date();

  const [grouped, highPriority, overdue] = await Promise.all([
    prisma.task.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.task.count({
      where: { AND: [where, { priority: 'HIGH' }] },
    }),
    prisma.task.count({
      where: {
        AND: [where, { deadline: { lt: now } }, { status: { not: 'DONE' } }],
      },
    }),
  ]);

  const countFor = (status: TaskStatus) => grouped.find((row) => row.status === status)?._count._all ?? 0;
  const todo = countFor('TODO');
  const inProgress = countFor('IN_PROGRESS');
  const done = countFor('DONE');

  return {
    total: todo + inProgress + done,
    todo,
    inProgress,
    done,
    highPriority,
    overdue,
  };
}
