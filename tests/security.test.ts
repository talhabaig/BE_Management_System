import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../src/middleware/rateLimit.middleware';
import { buildRefreshCookieOptions } from '../src/utils/cookies';
import { durationToMs } from '../src/utils/duration';

describe('security helpers', () => {
  it('returns 429 when the rate limit is exceeded', async () => {
    const app = express();
    app.use(createRateLimiter(2, 60_000));
    app.get('/limited', (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).get('/limited').expect(200);
    await request(app).get('/limited').expect(200);
    const limited = await request(app).get('/limited');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });

  it('configures refresh cookies for production and non-production', () => {
    const production = buildRefreshCookieOptions('production', 1000);
    expect(production).toMatchObject({ httpOnly: true, secure: true, sameSite: 'none', path: '/api/auth' });

    const test = buildRefreshCookieOptions('test', 1000);
    expect(test).toMatchObject({ httpOnly: true, secure: false, sameSite: 'lax', path: '/api/auth' });
  });

  it('parses configured token durations', () => {
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('7d')).toBe(7 * 86_400_000);
    expect(() => durationToMs('forever')).toThrow(/Invalid duration/);
  });
});
