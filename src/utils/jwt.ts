import { createHash, randomUUID } from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from './errors';

export interface AccessTokenPayload {
  userId: string;
  role: Role;
  tokenType: 'access';
}

export interface RefreshTokenPayload {
  userId: string;
  role: Role;
  tokenType: 'refresh';
  jti: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRole(value: unknown): value is Role {
  return value === 'ADMIN' || value === 'MANAGER' || value === 'USER';
}

function isAccessPayload(value: unknown): value is AccessTokenPayload {
  return isRecord(value) && typeof value.userId === 'string' && isRole(value.role) && value.tokenType === 'access';
}

function isRefreshPayload(value: unknown): value is RefreshTokenPayload {
  return (
    isRecord(value) &&
    typeof value.userId === 'string' &&
    isRole(value.role) &&
    value.tokenType === 'refresh' &&
    typeof value.jti === 'string'
  );
}

export function signAccessToken(userId: string, role: Role): string {
  const payload: AccessTokenPayload = { userId, role, tokenType: 'access' };
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(userId: string, role: Role): { token: string; jti: string } {
  const jti = randomUUID();
  const payload = { userId, role, tokenType: 'refresh' as const };
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
    jwtid: jti,
  };
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    if (!isAccessPayload(decoded)) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    return decoded;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Token expired');
    }
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
    if (!isRefreshPayload(decoded)) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
    return decoded;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Token expired');
    }
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
