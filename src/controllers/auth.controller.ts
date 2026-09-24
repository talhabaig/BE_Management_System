import type { Request } from 'express';
import { getAuthUser } from '../middleware/auth.middleware';
import * as authService from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from '../utils/cookies';
import { AppError } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import type { LoginInput, RegisterInput } from '../validators/auth.validator';

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body as RegisterInput);
  sendSuccess(res, user, 201);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body as LoginInput);
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, { accessToken: result.accessToken, user: result.user });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = readRefreshCookie(req);
  if (!refreshToken) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const result = await authService.refresh(refreshToken);
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, { accessToken: result.accessToken, user: result.user });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  sendSuccess(res, { loggedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  const actor = getAuthUser(req);
  const user = await authService.getProfile(actor.id);
  sendSuccess(res, user);
});
