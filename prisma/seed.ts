import { prisma } from '../src/prisma/client';
import { hashPassword } from '../src/utils/password';

const DEV_PASSWORD = 'Password123!';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed when NODE_ENV is production');
  }

  const passwordHash = await hashPassword(DEV_PASSWORD);

  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.task.deleteMany(),
    prisma.teamMember.deleteMany(),
    prisma.team.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const admin = await prisma.user.create({
    data: { name: 'System Admin', email: 'admin@example.com', passwordHash, role: 'ADMIN' },
  });
  const manager = await prisma.user.create({
    data: { name: 'Team Manager', email: 'manager@example.com', passwordHash, role: 'MANAGER' },
  });
  const user1 = await prisma.user.create({
    data: { name: 'User One', email: 'user1@example.com', passwordHash, role: 'USER' },
  });
  const user2 = await prisma.user.create({
    data: { name: 'User Two', email: 'user2@example.com', passwordHash, role: 'USER' },
  });

  const team = await prisma.team.create({
    data: {
      name: 'Development',
      description: 'Product engineering team',
      managerId: manager.id,
    },
  });

  await prisma.teamMember.createMany({
    data: [admin.id, manager.id, user1.id, user2.id].map((userId) => ({ teamId: team.id, userId })),
  });

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const design = await prisma.task.create({
    data: {
      title: 'Design the API',
      description: 'Define resources, roles, and pagination.',
      status: 'TODO',
      priority: 'HIGH',
      deadline: new Date(now + 7 * day),
      teamId: team.id,
      createdById: manager.id,
      assignedToId: user1.id,
    },
  });

  const authTask = await prisma.task.create({
    data: {
      title: 'Implement authentication',
      description: 'JWT access tokens and rotating refresh tokens.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      deadline: new Date(now + 3 * day),
      teamId: team.id,
      createdById: manager.id,
      assignedToId: user2.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Write integration tests',
      description: 'Cover auth, tasks, and dashboard counts.',
      status: 'DONE',
      priority: 'LOW',
      deadline: new Date(now - day),
      teamId: team.id,
      createdById: admin.id,
      assignedToId: user1.id,
    },
  });

  const overdue = await prisma.task.create({
    data: {
      title: 'Fix overdue bug',
      description: 'Investigate tasks that missed their deadline.',
      status: 'TODO',
      priority: 'HIGH',
      deadline: new Date(now - 2 * day),
      teamId: team.id,
      createdById: manager.id,
      assignedToId: user2.id,
    },
  });

  await prisma.comment.createMany({
    data: [
      { taskId: design.id, userId: manager.id, content: 'Please keep the status values limited to the agreed enum.' },
      { taskId: design.id, userId: user1.id, content: 'I will start with the task and team resources.' },
      { taskId: authTask.id, userId: user2.id, content: 'Refresh tokens will be stored as hashes.' },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: user1.id,
        type: 'TASK_ASSIGNED',
        title: 'Task assigned',
        message: 'You have been assigned to task "Design the API".',
        taskId: design.id,
        isRead: false,
      },
      {
        userId: user2.id,
        type: 'TASK_STATUS_UPDATED',
        title: 'Task status updated',
        message: 'Task "Implement authentication" status changed to IN_PROGRESS.',
        taskId: authTask.id,
        isRead: true,
      },
      {
        userId: user2.id,
        type: 'TASK_ASSIGNED',
        title: 'Task assigned',
        message: 'You have been assigned to task "Fix overdue bug".',
        taskId: overdue.id,
        isRead: false,
      },
      {
        userId: manager.id,
        type: 'TASK_STATUS_UPDATED',
        title: 'Task status updated',
        message: 'Task "Implement authentication" status changed to IN_PROGRESS.',
        taskId: authTask.id,
        isRead: false,
      },
    ],
  });
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Seed failed';
    process.stderr.write(`${message}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
