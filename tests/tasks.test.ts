import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/prisma/client';
import { bearer, createTeam, createUser, login, resetDatabase } from './helpers/factory';

describe('tasks', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function fixture() {
    const admin = await createUser({ name: 'Admin', email: 'admin@example.com', role: 'ADMIN' });
    const manager = await createUser({ name: 'Manager', email: 'manager@example.com', role: 'MANAGER' });
    const otherManager = await createUser({ name: 'Other Manager', email: 'other@example.com', role: 'MANAGER' });
    const user = await createUser({ name: 'User', email: 'user@example.com', role: 'USER' });
    const outsider = await createUser({ name: 'Outsider', email: 'outsider@example.com', role: 'USER' });
    const team = await createTeam(manager.id, [user.id], 'Backend');
    const otherTeam = await createTeam(otherManager.id, [outsider.id], 'Frontend');
    return {
      admin,
      manager,
      otherManager,
      user,
      outsider,
      team,
      otherTeam,
      adminToken: await login(admin.email),
      managerToken: await login(manager.email),
      userToken: await login(user.email),
      outsiderToken: await login(outsider.email),
    };
  }

  it('creates, filters, paginates, and protects tasks', async () => {
    const { managerToken, userToken, outsiderToken, team, otherTeam, user, outsider, adminToken } = await fixture();

    const denied = await request(app).post('/api/tasks').set(bearer(userToken)).send({
      title: 'User cannot create',
      teamId: team.id,
    });
    expect(denied.status).toBe(403);

    const created = await request(app).post('/api/tasks').set(bearer(managerToken)).send({
      title: 'Build backend filters',
      description: 'Pagination and status filters',
      priority: 'HIGH',
      teamId: team.id,
      assignedToId: user.id,
      deadline: '2026-09-30T00:00:00.000Z',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('TODO');
    expect(created.body.data.createdById).toBeDefined();

    const notMember = await request(app).post('/api/tasks').set(bearer(managerToken)).send({
      title: 'Wrong assignee',
      teamId: team.id,
      assignedToId: outsider.id,
    });
    expect(notMember.status).toBe(400);
    expect(notMember.body.error.code).toBe('ASSIGNEE_NOT_IN_TEAM');

    const foreign = await request(app).post('/api/tasks').set(bearer(managerToken)).send({
      title: 'Other team',
      teamId: otherTeam.id,
    });
    expect(foreign.status).toBe(404);

    await prisma.task.createMany({
      data: Array.from({ length: 24 }, (_, index) => ({
        title: index % 2 === 0 ? `Backend task ${index}` : `Docs task ${index}`,
        status: index % 3 === 0 ? 'IN_PROGRESS' : 'TODO',
        priority: index % 2 === 0 ? 'HIGH' : 'LOW',
        teamId: team.id,
        createdById: created.body.data.createdById,
        assignedToId: user.id,
      })),
    });

    const page = await request(app).get('/api/tasks?page=2&limit=20').set(bearer(adminToken));
    expect(page.status).toBe(200);
    expect(page.body.pagination.total).toBe(25);
    expect(page.body.pagination.totalPages).toBe(2);
    expect(page.body.pagination.hasNextPage).toBe(false);
    expect(page.body.pagination.hasPreviousPage).toBe(true);
    expect(page.body.data).toHaveLength(5);

    const filtered = await request(app)
      .get(`/api/tasks?status=TODO&priority=HIGH&teamId=${team.id}&search=backend`)
      .set(bearer(managerToken));
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.length).toBeGreaterThan(0);
    expect(filtered.body.data.every((task: { status: string; priority: string }) => task.status === 'TODO' && task.priority === 'HIGH')).toBe(true);

    const unsafeSort = await request(app).get('/api/tasks?sortBy=passwordHash').set(bearer(adminToken));
    expect(unsafeSort.status).toBe(422);

    const hidden = await request(app).get(`/api/tasks/${created.body.data.id}`).set(bearer(outsiderToken));
    expect(hidden.status).toBe(404);

    const visible = await request(app).get(`/api/tasks/${created.body.data.id}`).set(bearer(userToken));
    expect(visible.status).toBe(200);

    const userPatch = await request(app)
      .patch(`/api/tasks/${created.body.data.id}`)
      .set(bearer(userToken))
      .send({ title: 'Changed by user' });
    expect(userPatch.status).toBe(403);

    const updated = await request(app)
      .patch(`/api/tasks/${created.body.data.id}`)
      .set(bearer(managerToken))
      .send({ title: 'Build secure filters', priority: 'MEDIUM' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe('Build secure filters');

    const invalidStatus = await request(app)
      .patch(`/api/tasks/${created.body.data.id}/status`)
      .set(bearer(userToken))
      .send({ status: 'BLOCKED' });
    expect(invalidStatus.status).toBe(422);

    const status = await request(app)
      .patch(`/api/tasks/${created.body.data.id}/status`)
      .set(bearer(userToken))
      .send({ status: 'IN_PROGRESS' });
    expect(status.status).toBe(200);
    expect(status.body.data.status).toBe('IN_PROGRESS');

    const outsiderStatus = await request(app)
      .patch(`/api/tasks/${created.body.data.id}/status`)
      .set(bearer(outsiderToken))
      .send({ status: 'DONE' });
    expect(outsiderStatus.status).toBe(404);

    const removed = await request(app).delete(`/api/tasks/${created.body.data.id}`).set(bearer(userToken));
    expect(removed.status).toBe(403);

    const deleted = await request(app).delete(`/api/tasks/${created.body.data.id}`).set(bearer(managerToken));
    expect(deleted.status).toBe(204);
  });
});
