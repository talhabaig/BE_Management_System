import type { Request } from 'express';
import { prisma } from '../prisma/client';
import type { AuthUser } from '../types/auth';
import { AppError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAccessToken } from '../utils/jwt';
import { userPublicSelect } from '../utils/selectors';

export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return req.user;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const payload = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: userPublicSelect,
  });

  if (!user || !user.isActive) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  req.user = user;
  next();
});
