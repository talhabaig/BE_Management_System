import pino from 'pino';
import { env } from '../config/env';

const usePrettyTransport = env.NODE_ENV === 'development' && !process.env.VERCEL;

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'development' ? 'debug' : 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'accessToken',
    ],
    censor: '[REDACTED]',
  },
  ...(usePrettyTransport
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});
