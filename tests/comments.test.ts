import request from 'supertest';
import { app } from '../src/app';
import { bearer, createTeam, createUser, login, resetDatabase } from './helpers/factory';

describe('comments', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates, lists, updates, and deletes comments with ownership checks', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@example.com', role: 'ADMIN' });
    const manager = await createUser({ name: 'Manager', email: 'manager@example.com', role: 'MANAGER' });
    const user = await createUser({ name: 'User', email: 'user@example.com', role: 'USER' });
    const other = await createUser({ name: 'Other', email: 'other@example.com', role: 'USER' });
    const team = await createTeam(manager.id, [user.id, other.id]);
    const managerToken = await login(manager.email);
    const userToken = await login(user.email);
    const otherToken = await login(other.email);
    const adminToken = await login(admin.email);

    const task = await request(app).post('/api/tasks').set(bearer(managerToken)).send({
      title: 'Discuss the rollout',
      teamId: team.id,
      assignedToId: user.id,
    });

    const hidden = await request(app).post(`/api/tasks/${task.body.data.id}/comments`).set(bearer(otherToken)).send({
      content: 'I should not see this task',
    });
    expect(hidden.status).toBe(404);

    const created = await request(app).post(`/api/tasks/${task.body.data.id}/comments`).set(bearer(userToken)).send({
      content: 'Starting today',
    });
    expect(created.status).toBe(201);

    const managerComment = await request(app)
      .post(`/api/tasks/${task.body.data.id}/comments`)
      .set(bearer(managerToken))
      .send({ content: 'Please update the status when you begin' });
    expect(managerComment.status).toBe(201);

    const listed = await request(app).get(`/api/tasks/${task.body.data.id}/comments?page=1&limit=10`).set(bearer(userToken));
    expect(listed.status).toBe(200);
    expect(listed.body.pagination.total).toBe(2);

    const stolen = await request(app)
      .patch(`/api/comments/${managerComment.body.data.id}`)
      .set(bearer(userToken))
      .send({ content: 'Edited by someone else' });
    expect(stolen.status).toBe(403);

    const edited = await request(app)
      .patch(`/api/comments/${created.body.data.id}`)
      .set(bearer(userToken))
      .send({ content: 'Starting this afternoon' });
    expect(edited.status).toBe(200);

    const moderated = await request(app)
      .patch(`/api/comments/${managerComment.body.data.id}`)
      .set(bearer(adminToken))
      .send({ content: 'Moderated comment' });
    expect(moderated.status).toBe(200);

    const userDelete = await request(app).delete(`/api/comments/${managerComment.body.data.id}`).set(bearer(userToken));
    expect(userDelete.status).toBe(403);

    const adminDelete = await request(app).delete(`/api/comments/${managerComment.body.data.id}`).set(bearer(adminToken));
    expect(adminDelete.status).toBe(204);
  });
});
