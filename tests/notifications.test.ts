import request from 'supertest';
import { app } from '../src/app';
import { bearer, createTeam, createUser, login, resetDatabase } from './helpers/factory';

describe('notifications', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates notifications for assignment and status changes and marks them read', async () => {
    const manager = await createUser({ name: 'Manager', email: 'manager@example.com', role: 'MANAGER' });
    const user = await createUser({ name: 'User', email: 'user@example.com', role: 'USER' });
    const team = await createTeam(manager.id, [user.id]);
    const managerToken = await login(manager.email);
    const userToken = await login(user.email);

    const task = await request(app).post('/api/tasks').set(bearer(managerToken)).send({
      title: 'Ship the notification flow',
      teamId: team.id,
      assignedToId: user.id,
    });
    expect(task.status).toBe(201);

    const assigned = await request(app).get('/api/notifications').set(bearer(userToken));
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.some((item: { type: string }) => item.type === 'TASK_ASSIGNED')).toBe(true);

    const status = await request(app)
      .patch(`/api/tasks/${task.body.data.id}/status`)
      .set(bearer(userToken))
      .send({ status: 'IN_PROGRESS' });
    expect(status.status).toBe(200);

    const managerNotes = await request(app).get('/api/notifications').set(bearer(managerToken));
    expect(managerNotes.body.data.some((item: { type: string }) => item.type === 'TASK_STATUS_UPDATED')).toBe(true);

    const note = assigned.body.data[0];
    const marked = await request(app).patch(`/api/notifications/${note.id}/read`).set(bearer(userToken));
    expect(marked.status).toBe(200);
    expect(marked.body.data.isRead).toBe(true);

    const foreign = await request(app).patch(`/api/notifications/${note.id}/read`).set(bearer(managerToken));
    expect(foreign.status).toBe(404);

    const all = await request(app).patch('/api/notifications/read-all').set(bearer(managerToken));
    expect(all.status).toBe(200);
    expect(all.body.data.updated).toBeGreaterThan(0);

    const after = await request(app).get('/api/notifications').set(bearer(managerToken));
    expect(after.body.data.every((item: { isRead: boolean }) => item.isRead)).toBe(true);
  });
});
