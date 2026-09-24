import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/prisma/client';
import { bearer, createTeam, createUser, login, resetDatabase } from './helpers/factory';

describe('dashboard', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns role-scoped aggregate statistics and honors filters', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@example.com', role: 'ADMIN' });
    const manager = await createUser({ name: 'Manager', email: 'manager@example.com', role: 'MANAGER' });
    const otherManager = await createUser({ name: 'Other', email: 'other@example.com', role: 'MANAGER' });
    const user = await createUser({ name: 'User', email: 'user@example.com', role: 'USER' });
    const team = await createTeam(manager.id, [user.id], 'Backend');
    const otherTeam = await createTeam(otherManager.id, [], 'Other');
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.task.createMany({
      data: [
        {
          title: 'Overdue high',
          status: 'TODO',
          priority: 'HIGH',
          deadline: past,
          teamId: team.id,
          createdById: manager.id,
          assignedToId: user.id,
        },
        {
          title: 'Active medium',
          status: 'IN_PROGRESS',
          priority: 'MEDIUM',
          deadline: future,
          teamId: team.id,
          createdById: manager.id,
          assignedToId: null,
        },
        {
          title: 'Finished low',
          status: 'DONE',
          priority: 'LOW',
          deadline: past,
          teamId: team.id,
          createdById: manager.id,
          assignedToId: null,
        },
        {
          title: 'Hidden team task',
          status: 'TODO',
          priority: 'HIGH',
          deadline: past,
          teamId: otherTeam.id,
          createdById: otherManager.id,
          assignedToId: null,
        },
      ],
    });

    const adminToken = await login(admin.email);
    const managerToken = await login(manager.email);
    const userToken = await login(user.email);

    const adminSummary = await request(app).get('/api/dashboard/summary').set(bearer(adminToken));
    expect(adminSummary.status).toBe(200);
    expect(adminSummary.body.data).toEqual({
      total: 4,
      todo: 2,
      inProgress: 1,
      done: 1,
      highPriority: 2,
      overdue: 2,
    });

    const managerSummary = await request(app).get('/api/dashboard/summary').set(bearer(managerToken));
    expect(managerSummary.body.data).toEqual({
      total: 3,
      todo: 1,
      inProgress: 1,
      done: 1,
      highPriority: 1,
      overdue: 1,
    });

    const userSummary = await request(app).get('/api/dashboard/summary').set(bearer(userToken));
    expect(userSummary.body.data).toEqual({
      total: 1,
      todo: 1,
      inProgress: 0,
      done: 0,
      highPriority: 1,
      overdue: 1,
    });

    const filtered = await request(app).get('/api/dashboard/summary?status=TODO').set(bearer(managerToken));
    expect(filtered.body.data).toMatchObject({ total: 1, todo: 1, inProgress: 0, done: 0, highPriority: 1, overdue: 1 });
  });
});
