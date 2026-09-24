export const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const userSummarySelect = {
  id: true,
  name: true,
  email: true,
} as const;

export const teamSelect = {
  id: true,
  name: true,
  description: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  manager: { select: userSummarySelect },
} as const;

export const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  deadline: true,
  teamId: true,
  createdById: true,
  assignedToId: true,
  createdAt: true,
  updatedAt: true,
  team: {
    select: {
      id: true,
      name: true,
      managerId: true,
    },
  },
  createdBy: { select: userSummarySelect },
  assignedTo: { select: userSummarySelect },
} as const;

export const commentSelect = {
  id: true,
  content: true,
  taskId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  user: { select: userSummarySelect },
} as const;

export const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  taskId: true,
  createdAt: true,
} as const;
