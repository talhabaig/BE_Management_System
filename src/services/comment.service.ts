import { prisma } from '../prisma/client';
import type { AuthUser } from '../types/auth';
import { AppError } from '../utils/errors';
import { buildPagination, getPagination } from '../utils/pagination';
import { commentSelect } from '../utils/selectors';
import { findVisibleTask } from './authorization.service';

async function getCommentForActor(actor: AuthUser, commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: commentSelect,
  });

  if (!comment) {
    throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
  }

  await findVisibleTask(actor, comment.taskId);

  if (comment.userId !== actor.id && actor.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to modify this comment');
  }

  return comment;
}

export async function createComment(actor: AuthUser, taskId: string, content: string) {
  await findVisibleTask(actor, taskId);
  return prisma.comment.create({
    data: {
      taskId,
      userId: actor.id,
      content,
    },
    select: commentSelect,
  });
}

export async function listComments(actor: AuthUser, taskId: string, page: number, limit: number) {
  await findVisibleTask(actor, taskId);
  const pagination = getPagination(page, limit);
  const where = { taskId };
  const [total, data] = await prisma.$transaction([
    prisma.comment.count({ where }),
    prisma.comment.findMany({
      where,
      select: commentSelect,
      orderBy: { createdAt: 'asc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
  ]);

  return { data, pagination: buildPagination(page, limit, total) };
}

export async function updateComment(actor: AuthUser, commentId: string, content: string) {
  await getCommentForActor(actor, commentId);
  return prisma.comment.update({
    where: { id: commentId },
    data: { content },
    select: commentSelect,
  });
}

export async function deleteComment(actor: AuthUser, commentId: string) {
  await getCommentForActor(actor, commentId);
  await prisma.comment.delete({ where: { id: commentId } });
}
