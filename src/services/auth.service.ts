import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../prisma/client';
import { AppError } from '../utils/errors';
import { durationToMs } from '../utils/duration';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { assertLoginAllowed, clearLoginFailures, recordFailedLogin } from '../utils/loginLockout';
import { hashPassword, verifyPassword } from '../utils/password';
import { userPublicSelect } from '../utils/selectors';
import type { LoginInput, RegisterInput } from '../validators/auth.validator';

let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('not-a-real-password');
  return dummyHashPromise;
}

function publicUser<T extends { passwordHash?: string }>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

async function issueSession(userId: string, role: 'ADMIN' | 'MANAGER' | 'USER') {
  const accessToken = signAccessToken(userId, role);
  const refresh = signRefreshToken(userId, role);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refresh.token),
      expiresAt: new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_EXPIRES_IN)),
    },
  });
  return { accessToken, refreshToken: refresh.token };
}

export async function register(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash: await hashPassword(input.password),
        role: 'USER',
      },
      select: userPublicSelect,
    });
    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
    }
    throw error;
  }
}

export async function login(input: LoginInput) {
  const email = input.email.trim().toLowerCase();
  assertLoginAllowed(email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...userPublicSelect, passwordHash: true },
  });

  if (!user || !user.isActive) {
    await verifyPassword(input.password, await getDummyHash());
    recordFailedLogin(email);
    assertLoginAllowed(email);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const matches = await verifyPassword(input.password, user.passwordHash);
  if (!matches) {
    recordFailedLogin(email);
    assertLoginAllowed(email);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  clearLoginFailures(email);
  const session = await issueSession(user.id, user.role);
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: publicUser(user),
  };
}

export async function refresh(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing || existing.userId !== payload.userId) {
      return { status: 'invalid' as const };
    }

    if (existing.revokedAt) {
      await tx.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { status: 'reused' as const };
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      return { status: 'expired' as const };
    }

    const user = await tx.user.findUnique({
      where: { id: existing.userId },
      select: userPublicSelect,
    });
    if (!user || !user.isActive) {
      return { status: 'invalid' as const };
    }

    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const issued = signRefreshToken(user.id, user.role);
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(issued.token),
        expiresAt: new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_EXPIRES_IN)),
      },
    });

    return {
      status: 'ok' as const,
      accessToken: signAccessToken(user.id, user.role),
      refreshToken: issued.token,
      user,
    };
  });

  if (result.status === 'expired') {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Token expired');
  }
  if (result.status !== 'ok') {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) {
    return;
  }

  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userPublicSelect,
  });

  if (!user || !user.isActive) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  return user;
}
