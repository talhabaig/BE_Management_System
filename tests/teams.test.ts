import request from 'supertest';
import { app } from '../src/app';
import { bearer, createTeam, createUser, login, resetDatabase } from './helpers/factory';

describe('teams', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('lets an admin create a team and blocks other roles and foreign managers', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@example.com', role: 'ADMIN' });
    const manager = await createUser({ name: 'Manager', email: 'manager@example.com', role: 'MANAGER' });
    const otherManager = await createUser({ name: 'Other', email: 'other@example.com', role: 'MANAGER' });
    const user = await createUser({ name: 'User', email: 'user@example.com', role: 'USER' });
    const adminToken = await login(admin.email);
    const managerToken = await login(manager.email);
    const otherToken = await login(otherManager.email);
    const userToken = await login(user.email);

    const forbidden = await request(app).post('/api/teams').set(bearer(managerToken)).send({
      name: 'Platform',
      managerId: manager.id,
    });
    expect(forbidden.status).toBe(403);

    const invalidManager = await request(app).post('/api/teams').set(bearer(adminToken)).send({
      name: 'Platform',
      managerId: user.id,
    });
    expect(invalidManager.status).toBe(400);

    const created = await request(app).post('/api/teams').set(bearer(adminToken)).send({
      name: 'Platform',
      description: 'Core platform',
      managerId: manager.id,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.managerId).toBe(manager.id);

    const otherTeam = await createTeam(otherManager.id, [], 'Other Team');
    const foreignUpdate = await request(app)
      .patch(`/api/teams/${otherTeam.id}`)
      .set(bearer(managerToken))
      .send({ name: 'Hijacked' });
    expect(foreignUpdate.status).toBe(404);

    const renamed = await request(app)
      .patch(`/api/teams/${created.body.data.id}`)
      .set(bearer(managerToken))
      .send({ name: 'Platform Engineering' });
    expect(renamed.status).toBe(200);

    const managerCannotReassign = await request(app)
      .patch(`/api/teams/${created.body.data.id}`)
      .set(bearer(managerToken))
      .send({ managerId: otherManager.id });
    expect(managerCannotReassign.status).toBe(403);

    const added = await request(app)
      .post(`/api/teams/${created.body.data.id}/members`)
      .set(bearer(managerToken))
      .send({ userId: user.id });
    expect(added.status).toBe(201);

    const duplicate = await request(app)
      .post(`/api/teams/${created.body.data.id}/members`)
      .set(bearer(managerToken))
      .send({ userId: user.id });
    expect(duplicate.status).toBe(409);

    const userAdd = await request(app)
      .post(`/api/teams/${created.body.data.id}/members`)
      .set(bearer(userToken))
      .send({ userId: otherManager.id });
    expect(userAdd.status).toBe(403);

    const foreignAdd = await request(app)
      .post(`/api/teams/${otherTeam.id}/members`)
      .set(bearer(managerToken))
      .send({ userId: user.id });
    expect(foreignAdd.status).toBe(404);

    const members = await request(app)
      .get(`/api/teams/${created.body.data.id}/members?page=1&limit=20`)
      .set(bearer(userToken));
    expect(members.status).toBe(200);
    expect(members.body.pagination.total).toBe(2);

    const removeManager = await request(app)
      .delete(`/api/teams/${created.body.data.id}/members/${manager.id}`)
      .set(bearer(adminToken));
    expect(removeManager.status).toBe(400);

    const removed = await request(app)
      .delete(`/api/teams/${created.body.data.id}/members/${user.id}`)
      .set(bearer(managerToken));
    expect(removed.status).toBe(204);

    const listed = await request(app).get('/api/teams?search=platform').set(bearer(adminToken));
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);

    const hidden = await request(app).get('/api/teams').set(bearer(otherToken));
    expect(hidden.body.data.map((team: { id: string }) => team.id)).not.toContain(created.body.data.id);

    const deleted = await request(app).delete(`/api/teams/${created.body.data.id}`).set(bearer(adminToken));
    expect(deleted.status).toBe(204);

    const withTask = await createTeam(manager.id, [user.id], 'Busy');
    await request(app).post('/api/tasks').set(bearer(managerToken)).send({
      title: 'Keep the team',
      teamId: withTask.id,
    });
    const blocked = await request(app).delete(`/api/teams/${withTask.id}`).set(bearer(adminToken));
    expect(blocked.status).toBe(409);
  });
});
