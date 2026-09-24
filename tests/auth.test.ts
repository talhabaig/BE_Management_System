import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/prisma/client';
import { bearer, createUser, password, resetDatabase } from './helpers/factory';

function refreshCookie(setCookie: string | string[] | undefined): string {
  const raw = Array.isArray(setCookie) ? setCookie.join(';') : setCookie ?? '';
  const match = /refreshToken=([^;]+)/.exec(raw);
  if (!match?.[1]) {
    throw new Error(`Refresh cookie was not set: ${raw}`);
  }
  return `refreshToken=${match[1]}`;
}

describe('authentication', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns health and a not-found route', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ success: true, data: { status: 'ok' } });

    const missing = await request(app).get('/api/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('registers a user, normalizes email, and rejects duplicates and extra role fields', async () => {
    const created = await request(app).post('/api/auth/register').send({
      name: 'New User',
      email: 'New.User@Example.com',
      password,
    });

    expect(created.status).toBe(201);
    expect(created.body.data.email).toBe('new.user@example.com');
    expect(created.body.data.role).toBe('USER');
    expect(created.body.data.passwordHash).toBeUndefined();

    const duplicate = await request(app).post('/api/auth/register').send({
      name: 'New User',
      email: 'new.user@example.com',
      password,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_EXISTS');

    const withRole = await request(app).post('/api/auth/register').send({
      name: 'Admin Attempt',
      email: 'admin-attempt@example.com',
      password,
      role: 'ADMIN',
    });
    expect(withRole.status).toBe(422);

    const weak = await request(app).post('/api/auth/register').send({
      name: 'Weak User',
      email: 'weak@example.com',
      password: 'short',
    });
    expect(weak.status).toBe(422);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in, rejects invalid credentials with the same message, and protects routes', async () => {
    await createUser({ name: 'Ada', email: 'ada@example.com', role: 'USER' });

    const unknown = await request(app).post('/api/auth/login').send({
      email: 'missing@example.com',
      password,
    });
    const wrong = await request(app).post('/api/auth/login').send({
      email: 'ada@example.com',
      password: 'WrongPass1',
    });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);

    const loggedIn = await request(app).post('/api/auth/login').send({
      email: 'Ada@Example.com',
      password,
    });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.data.accessToken).toEqual(expect.any(String));
    expect(loggedIn.body.data.refreshToken).toBeUndefined();
    expect(loggedIn.body.data.user.passwordHash).toBeUndefined();
    const cookie = Array.isArray(loggedIn.headers['set-cookie'])
      ? loggedIn.headers['set-cookie'].join(';')
      : loggedIn.headers['set-cookie'] ?? '';
    expect(cookie).toMatch(/refreshToken=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const unauthenticated = await request(app).get('/api/auth/me');
    expect(unauthenticated.status).toBe(401);

    const me = await request(app).get('/api/auth/me').set(bearer(loggedIn.body.data.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('ada@example.com');
  });

  it('rotates refresh tokens, detects reuse, logs out, and rejects expired access tokens', async () => {
    const user = await createUser({ name: 'Ada', email: 'ada@example.com', role: 'USER' });
    const loggedIn = await request(app).post('/api/auth/login').send({ email: user.email, password });
    const firstCookie = refreshCookie(loggedIn.headers['set-cookie']);

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.data.refreshToken).toBeUndefined();
    const replacement = refreshCookie(refreshed.headers['set-cookie']);

    const reused = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(reused.status).toBe(401);

    const afterReuse = await request(app).post('/api/auth/refresh').set('Cookie', replacement);
    expect(afterReuse.status).toBe(401);

    const agent = request.agent(app);
    const agentLogin = await agent.post('/api/auth/login').send({ email: user.email, password });
    expect(agentLogin.status).toBe(200);
    const logoutCookie = refreshCookie(agentLogin.headers['set-cookie']);
    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);
    const afterLogout = await request(app).post('/api/auth/refresh').set('Cookie', logoutCookie);
    expect(afterLogout.status).toBe(401);

    const expired = jwt.sign(
      { userId: user.id, role: 'USER', tokenType: 'access', exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256' },
    );
    const expiredResponse = await request(app).get('/api/auth/me').set(bearer(expired));
    expect(expiredResponse.status).toBe(401);
    expect(expiredResponse.body.error.code).toBe('TOKEN_EXPIRED');

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const inactive = await request(app).post('/api/auth/login').send({ email: user.email, password });
    expect(inactive.status).toBe(401);
    expect(inactive.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
