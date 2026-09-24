import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';
import { durationToMs } from './duration';

export const REFRESH_COOKIE_NAME = 'refreshToken';

export function buildRefreshCookieOptions(nodeEnv: string, maxAge: number): CookieOptions {
  const secure = nodeEnv === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/api/auth',
    maxAge,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(
    REFRESH_COOKIE_NAME,
    token,
    buildRefreshCookieOptions(env.NODE_ENV, durationToMs(env.REFRESH_TOKEN_EXPIRES_IN)),
  );
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, buildRefreshCookieOptions(env.NODE_ENV, 0));
}
