import type { NotificationType, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prisma/client';
import type { AuthUser } from '../types/auth';
import { AppError } from '../utils/errors';
import { buildPagination, getPagination } from '../utils/pagination';
import { notificationSelect } from '../utils/selectors';

type DbClient = PrismaClient | Prisma.TransactionClient;

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string | null;
}

export async function createNotification(db: DbClient, input: CreateNotificationInput) {
  return db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      taskId: input.taskId ?? null,
    },
    select: notificationSelect,
  });
}

export async function listNotifications(actor: AuthUser, page: number, limit: number) {
  const pagination = getPagination(page, limit);
  const where = { userId: actor.id };
  const [total, data] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      select: notificationSelect,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
  ]);

  return { data, pagination: buildPagination(page, limit, total) };
}

export async function markNotificationRead(actor: AuthUser, notificationId: string) {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId: actor.id },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
    select: notificationSelect,
  });
}

export async function markAllNotificationsRead(actor: AuthUser) {
  const result = await prisma.notification.updateMany({
    where: { userId: actor.id, isRead: false },
    data: { isRead: true },
  });

  return { updated: result.count };
}
