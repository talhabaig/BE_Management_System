import { AppError } from '../utils/errors';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptState {
  failures: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptState>();

function getState(email: string): AttemptState {
  const existing = attempts.get(email);
  if (existing) {
    return existing;
  }
  const created: AttemptState = { failures: 0, lockedUntil: null };
  attempts.set(email, created);
  return created;
}

export function assertLoginAllowed(email: string): void {
  const key = email.trim().toLowerCase();
  const state = getState(key);
  if (state.lockedUntil && state.lockedUntil > Date.now()) {
    throw new AppError(
      429,
      'LOGIN_LOCKED',
      'Too many failed login attempts. Please try again in 15 minutes.',
      { retryAfterSeconds: Math.ceil((state.lockedUntil - Date.now()) / 1000) },
    );
  }
  if (state.lockedUntil && state.lockedUntil <= Date.now()) {
    state.failures = 0;
    state.lockedUntil = null;
  }
}

export function recordFailedLogin(email: string): void {
  const key = email.trim().toLowerCase();
  const state = getState(key);
  state.failures += 1;
  if (state.failures >= MAX_FAILED_ATTEMPTS) {
    state.lockedUntil = Date.now() + LOCKOUT_MS;
    state.failures = 0;
  }
}

export function clearLoginFailures(email: string): void {
  attempts.delete(email.trim().toLowerCase());
}
