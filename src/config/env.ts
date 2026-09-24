import dotenv from 'dotenv';
import { durationToMs } from '../utils/duration';

dotenv.config({ quiet: true });

const required = [
  'DATABASE_URL',
  'NODE_ENV',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'ACCESS_TOKEN_EXPIRES_IN',
  'REFRESH_TOKEN_EXPIRES_IN',
  'CORS_ORIGIN',
] as const;

function readRequired(name: (typeof required)[number]): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

const missing = required.filter((name) => {
  const value = process.env[name];
  return !value || value.trim().length === 0;
});

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const nodeEnv = readRequired('NODE_ENV');
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be development, test, or production');
}

const portValue = process.env.PORT?.trim() || '3000';
const port = Number(portValue);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const accessSecret = readRequired('JWT_ACCESS_SECRET');
const refreshSecret = readRequired('JWT_REFRESH_SECRET');

if (accessSecret.length < 32 || refreshSecret.length < 32) {
  throw new Error('JWT secrets must be at least 32 characters');
}

if (accessSecret === refreshSecret) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
}

const accessTokenExpiresIn = readRequired('ACCESS_TOKEN_EXPIRES_IN');
const refreshTokenExpiresIn = readRequired('REFRESH_TOKEN_EXPIRES_IN');
durationToMs(accessTokenExpiresIn);
durationToMs(refreshTokenExpiresIn);

const corsOrigin = readRequired('CORS_ORIGIN');
const corsOrigins = corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
  throw new Error('CORS_ORIGIN must list explicit origins and cannot be *');
}

export const env = {
  DATABASE_URL: readRequired('DATABASE_URL'),
  PORT: port,
  NODE_ENV: nodeEnv as 'development' | 'test' | 'production',
  JWT_ACCESS_SECRET: accessSecret,
  JWT_REFRESH_SECRET: refreshSecret,
  ACCESS_TOKEN_EXPIRES_IN: accessTokenExpiresIn,
  REFRESH_TOKEN_EXPIRES_IN: refreshTokenExpiresIn,
  CORS_ORIGINS: corsOrigins,
};
