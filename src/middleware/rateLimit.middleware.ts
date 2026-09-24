import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export function createRateLimiter(max: number, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
        },
      });
    },
  });
}

export const apiRateLimiter = createRateLimiter(env.NODE_ENV === 'test' ? 10_000 : 300);
export const authRateLimiter = createRateLimiter(env.NODE_ENV === 'test' ? 10_000 : 10);
