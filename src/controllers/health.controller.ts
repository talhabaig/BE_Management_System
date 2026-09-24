import { prisma } from '../prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const getHealth = asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  sendSuccess(res, { status: 'ok' });
});
