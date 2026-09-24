import request from 'supertest';
import { app } from '../src/app';
import { bearer, createUser, login, password, resetDatabase } from './helpers/factory';

describe('users', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('enforces role access, search, pagination, and profile updates', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@example.com', role: 'ADMIN' });
    const manager = await createUser({ name: 'Mary Manager', email: 'mary@example.com', role: 'MANAGER' });
    await createUser({ name: 'John User', email: 'john@example.com', role: 'USER' });
    const adminToken = await login(admin.email);
    const managerToken = await login(manager.email);
    const userToken = await login('john@example.com');

    const forbidden = await request(app).get('/api/users').set(bearer(userToken));
    expect(forbidden.status).toBe(403);

    const listed = await request(app).get('/api/users?page=1&limit=20&search=john&role=USER').set(bearer(adminToken));
    expect(listed.status).toBe(200);
    expect(listed.body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].passwordHash).toBeUndefined();

    const managerList = await request(app).get('/api/users').set(bearer(managerToken));
    expect(managerList.status).toBe(200);

    const self = await request(app).get(`/api/users/${admin.id}`).set(bearer(userToken));
    expect(self.status).toBe(403);

    const own = await request(app).get(`/api/users/${listed.body.data[0].id}`).set(bearer(userToken));
    expect(own.status).toBe(200);

    const rename = await request(app).patch(`/api/users/${own.body.data.id}`).set(bearer(userToken)).send({ name: 'John Updated' });
    expect(rename.status).toBe(200);
    expect(rename.body.data.name).toBe('John Updated');

    const roleChange = await request(app)
      .patch(`/api/users/${own.body.data.id}`)
      .set(bearer(userToken))
      .send({ role: 'ADMIN' });
    expect(roleChange.status).toBe(403);

    const promoted = await request(app)
      .patch(`/api/users/${own.body.data.id}`)
      .set(bearer(adminToken))
      .send({ role: 'MANAGER' });
    expect(promoted.status).toBe(200);
    expect(promoted.body.data.role).toBe('MANAGER');

    const selfDelete = await request(app).delete(`/api/users/${admin.id}`).set(bearer(adminToken));
    expect(selfDelete.status).toBe(400);

    const removed = await request(app).delete(`/api/users/${manager.id}`).set(bearer(adminToken));
    expect(removed.status).toBe(200);
    expect(removed.body.data.isActive).toBe(false);

    const inactiveLogin = await request(app).post('/api/auth/login').send({ email: manager.email, password });
    expect(inactiveLogin.status).toBe(401);

    const tooLarge = await request(app).get('/api/users?limit=101').set(bearer(adminToken));
    expect(tooLarge.status).toBe(422);
  });
});
