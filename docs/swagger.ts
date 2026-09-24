const errorSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
      required: ['code', 'message'],
    },
  },
  required: ['success', 'error'],
};

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'USER'] },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const paginationSchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 20 },
    total: { type: 'integer', example: 100 },
    totalPages: { type: 'integer', example: 5 },
    hasNextPage: { type: 'boolean' },
    hasPreviousPage: { type: 'boolean' },
  },
};

const taskSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
    priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    deadline: { type: 'string', format: 'date-time', nullable: true },
    teamId: { type: 'string', format: 'uuid' },
    createdById: { type: 'string', format: 'uuid' },
    assignedToId: { type: 'string', format: 'uuid', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

function jsonResponse(description: string, schema: object) {
  return {
    description,
    content: { 'application/json': { schema } },
  };
}

function successData(dataSchema: object) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: dataSchema,
    },
    required: ['success', 'data'],
  };
}

function paginated(itemSchema: object) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: { type: 'array', items: itemSchema },
      pagination: paginationSchema,
    },
    required: ['success', 'data', 'pagination'],
  };
}

const secured = [{ bearerAuth: [] }];
const uuidParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};
const pageQuery = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];

const standardErrors = {
  '400': jsonResponse('Bad request', errorSchema),
  '401': jsonResponse('Authentication required', errorSchema),
  '403': jsonResponse('Forbidden', errorSchema),
  '404': jsonResponse('Not found', errorSchema),
  '409': jsonResponse('Conflict', errorSchema),
  '422': jsonResponse('Validation failed', errorSchema),
  '429': jsonResponse('Rate limit exceeded', errorSchema),
};

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Role-Based Task Management API',
    version: '1.0.0',
    description:
      'REST API for users, teams, tasks, comments, notifications, and role-based dashboard statistics. Access tokens are bearer JWTs. Refresh tokens are HttpOnly cookies.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Teams' },
    { name: 'Tasks' },
    { name: 'Comments' },
    { name: 'Notifications' },
    { name: 'Dashboard' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: errorSchema,
      User: userSchema,
      Task: taskSchema,
      Pagination: paginationSchema,
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: { '200': jsonResponse('Service and database are reachable', successData({ type: 'object' })) },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a user',
        description: 'Public. New accounts are always created with the USER role. Email is trimmed and lowercased. Password must be 8-72 characters and include a letter and a number.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                additionalProperties: false,
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 100 },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, maxLength: 72 },
                },
              },
            },
          },
        },
        responses: {
          '201': jsonResponse('User created', successData(userSchema)),
          '409': standardErrors['409'],
          '422': standardErrors['422'],
          '429': standardErrors['429'],
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        description: 'Returns an access token. Sets an HttpOnly refreshToken cookie on path /api/auth. Secure is enabled in production and SameSite is none in production, lax otherwise. Failed logins use a generic message.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                additionalProperties: false,
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Authenticated', successData({ type: 'object' })),
          '401': standardErrors['401'],
          '422': standardErrors['422'],
          '429': standardErrors['429'],
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate refresh token',
        description: 'Reads the refreshToken cookie, revokes it, and issues a new access token plus a new refresh cookie. Reuse of a revoked refresh token revokes the user sessions.',
        responses: {
          '200': jsonResponse('Tokens rotated', successData({ type: 'object' })),
          '401': standardErrors['401'],
          '429': standardErrors['429'],
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out',
        description: 'Revokes the refresh token from the cookie and clears it. Access tokens remain valid until they expire.',
        responses: { '200': jsonResponse('Logged out', successData({ type: 'object' })) },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user',
        security: secured,
        responses: {
          '200': jsonResponse('Current profile', successData(userSchema)),
          '401': standardErrors['401'],
        },
      },
    },
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'List users',
        description: 'ADMIN and MANAGER. Supports page, limit (max 100), search, and role.',
        security: secured,
        parameters: [
          ...pageQuery,
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['ADMIN', 'MANAGER', 'USER'] } },
        ],
        responses: {
          '200': jsonResponse('Users', paginated(userSchema)),
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '422': standardErrors['422'],
        },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get a user',
        description: 'ADMIN and MANAGER can read any user. USER can read only their own profile.',
        security: secured,
        parameters: [uuidParam],
        responses: {
          '200': jsonResponse('User', successData(userSchema)),
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update a user',
        description: 'ADMIN can update name, role, and isActive. A user can update their own name. Administrators cannot change their own role or deactivate themselves.',
        security: secured,
        parameters: [uuidParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'USER'] },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Updated user', successData(userSchema)),
          '400': standardErrors['400'],
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
          '422': standardErrors['422'],
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Deactivate a user',
        description: 'ADMIN only. Soft-deletes the account and revokes refresh tokens. Fails when the user still manages a team.',
        security: secured,
        parameters: [uuidParam],
        responses: {
          '200': jsonResponse('Deactivated user', successData(userSchema)),
          '400': standardErrors['400'],
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
          '409': standardErrors['409'],
        },
      },
    },
    '/api/teams': {
      post: {
        tags: ['Teams'],
        summary: 'Create a team',
        description: 'ADMIN only. managerId must be an active MANAGER or ADMIN. The manager is added as a member.',
        security: secured,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'managerId'],
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  managerId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '201': jsonResponse('Team created', successData({ type: 'object' })),
          '400': standardErrors['400'],
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
          '422': standardErrors['422'],
        },
      },
      get: {
        tags: ['Teams'],
        summary: 'List visible teams',
        description: 'ADMIN sees every team. Other roles see teams they manage or belong to. Supports page, limit, and search.',
        security: secured,
        parameters: [...pageQuery, { name: 'search', in: 'query', schema: { type: 'string' } }],
        responses: {
          '200': jsonResponse('Teams', paginated({ type: 'object' })),
          '401': standardErrors['401'],
          '422': standardErrors['422'],
        },
      },
    },
    '/api/teams/{id}': {
      get: {
        tags: ['Teams'],
        summary: 'Get a team',
        security: secured,
        parameters: [uuidParam],
        responses: {
          '200': jsonResponse('Team', successData({ type: 'object' })),
          '401': standardErrors['401'],
          '404': standardErrors['404'],
        },
      },
      patch: {
        tags: ['Teams'],
        summary: 'Update a team',
        description: 'ADMIN or the team manager. Only ADMIN can change managerId.',
        security: secured,
        parameters: [uuidParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', additionalProperties: false } } },
        },
        responses: {
          '200': jsonResponse('Updated team', successData({ type: 'object' })),
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
          '422': standardErrors['422'],
        },
      },
      delete: {
        tags: ['Teams'],
        summary: 'Delete a team',
        description: 'ADMIN only. Rejected when the team still has tasks.',
        security: secured,
        parameters: [uuidParam],
        responses: {
          '204': { description: 'Deleted' },
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
          '409': standardErrors['409'],
        },
      },
    },
    '/api/teams/{id}/members': {
      get: {
        tags: ['Teams'],
        summary: 'List team members',
        security: secured,
        parameters: [uuidParam, ...pageQuery],
        responses: {
          '200': jsonResponse('Members', paginated({ type: 'object' })),
          '401': standardErrors['401'],
          '404': standardErrors['404'],
        },
      },
      post: {
        tags: ['Teams'],
        summary: 'Add a team member',
        description: 'ADMIN or the team manager. The user must exist, be active, and not already be a member.',
        security: secured,
        parameters: [uuidParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId'],
                additionalProperties: false,
                properties: { userId: { type: 'string', format: 'uuid' } },
              },
            },
          },
        },
        responses: {
          '201': jsonResponse('Member added', successData({ type: 'object' })),
          '400': standardErrors['400'],
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
          '409': standardErrors['409'],
          '422': standardErrors['422'],
        },
      },
    },
    '/api/teams/{id}/members/{userId}': {
      delete: {
        tags: ['Teams'],
        summary: 'Remove a team member',
        description: 'ADMIN or the team manager. The current manager cannot be removed.',
        security: secured,
        parameters: [
          uuidParam,
          { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '204': { description: 'Removed' },
          '400': standardErrors['400'],
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
        },
      },
    },
    '/api/tasks': {
      post: {
        tags: ['Tasks'],
        summary: 'Create a task',
        description: 'ADMIN or the manager of teamId. Default status is TODO and default priority is MEDIUM. assignedToId must belong to the team. createdById is taken from the access token.',
        security: secured,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'teamId'],
                additionalProperties: false,
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
                  priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                  deadline: { type: 'string', format: 'date-time' },
                  teamId: { type: 'string', format: 'uuid' },
                  assignedToId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '201': jsonResponse('Task created', successData(taskSchema)),
          '400': standardErrors['400'],
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
          '422': standardErrors['422'],
        },
      },
      get: {
        tags: ['Tasks'],
        summary: 'List visible tasks',
        description:
          'ADMIN sees all tasks. MANAGER sees tasks for managed teams and tasks assigned to them. USER sees assigned tasks. Filters: search, status, priority, teamId, assignedToId, deadlineFrom, deadlineTo. sortBy is limited to createdAt, updatedAt, deadline, priority, status, title.',
        security: secured,
        parameters: [
          ...pageQuery,
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] } },
          { name: 'teamId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'assignedToId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'deadlineFrom', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'deadlineTo', in: 'query', schema: { type: 'string', format: 'date-time' } },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'deadline', 'priority', 'status', 'title'] },
          },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: {
          '200': jsonResponse('Tasks', paginated(taskSchema)),
          '401': standardErrors['401'],
          '422': standardErrors['422'],
        },
      },
    },
    '/api/tasks/{id}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get a task',
        description: 'Returns 404 when the task is outside the caller visibility scope.',
        security: secured,
        parameters: [uuidParam],
        responses: {
          '200': jsonResponse('Task', successData(taskSchema)),
          '401': standardErrors['401'],
          '404': standardErrors['404'],
        },
      },
      patch: {
        tags: ['Tasks'],
        summary: 'Update a task',
        description: 'ADMIN or the team manager. Assignee must belong to the destination team. Status and assignment changes create notifications.',
        security: secured,
        parameters: [uuidParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', additionalProperties: false } } },
        },
        responses: {
          '200': jsonResponse('Updated task', successData(taskSchema)),
          '400': standardErrors['400'],
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
          '422': standardErrors['422'],
        },
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Delete a task',
        description: 'ADMIN or the team manager.',
        security: secured,
        parameters: [uuidParam],
        responses: {
          '204': { description: 'Deleted' },
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
        },
      },
    },
    '/api/tasks/{id}/assign': {
      post: {
        tags: ['Tasks'],
        summary: 'Assign a task',
        description: 'ADMIN or the team manager. The assignee must be an active member of the task team. Creates a TASK_ASSIGNED notification.',
        security: secured,
        parameters: [uuidParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['assignedToId'],
                additionalProperties: false,
                properties: { assignedToId: { type: 'string', format: 'uuid' } },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Assigned task', successData(taskSchema)),
          '400': standardErrors['400'],
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
          '422': standardErrors['422'],
        },
      },
    },
    '/api/tasks/{id}/status': {
      patch: {
        tags: ['Tasks'],
        summary: 'Update task status',
        description: 'ADMIN can update any visible task. MANAGER can update tasks in managed teams. USER can update only assigned tasks. Creates TASK_STATUS_UPDATED notifications.',
        security: secured,
        parameters: [uuidParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                additionalProperties: false,
                properties: { status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] } },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Updated status', successData(taskSchema)),
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
          '422': standardErrors['422'],
        },
      },
    },
    '/api/tasks/{id}/comments': {
      post: {
        tags: ['Comments'],
        summary: 'Add a comment',
        description: 'Caller must be allowed to view the task. Content is 1-5000 characters.',
        security: secured,
        parameters: [uuidParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                additionalProperties: false,
                properties: { content: { type: 'string', minLength: 1, maxLength: 5000 } },
              },
            },
          },
        },
        responses: {
          '201': jsonResponse('Comment created', successData({ type: 'object' })),
          '401': standardErrors['401'],
          '404': standardErrors['404'],
          '422': standardErrors['422'],
        },
      },
      get: {
        tags: ['Comments'],
        summary: 'List comments',
        security: secured,
        parameters: [uuidParam, ...pageQuery],
        responses: {
          '200': jsonResponse('Comments', paginated({ type: 'object' })),
          '401': standardErrors['401'],
          '404': standardErrors['404'],
        },
      },
    },
    '/api/comments/{id}': {
      patch: {
        tags: ['Comments'],
        summary: 'Update a comment',
        description: 'Author or ADMIN.',
        security: secured,
        parameters: [uuidParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                additionalProperties: false,
                properties: { content: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Updated comment', successData({ type: 'object' })),
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
          '422': standardErrors['422'],
        },
      },
      delete: {
        tags: ['Comments'],
        summary: 'Delete a comment',
        description: 'Author or ADMIN.',
        security: secured,
        parameters: [uuidParam],
        responses: {
          '204': { description: 'Deleted' },
          '401': standardErrors['401'],
          '403': standardErrors['403'],
          '404': standardErrors['404'],
        },
      },
    },
    '/api/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List my notifications',
        security: secured,
        parameters: pageQuery,
        responses: {
          '200': jsonResponse('Notifications', paginated({ type: 'object' })),
          '401': standardErrors['401'],
        },
      },
    },
    '/api/notifications/read-all': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark all notifications as read',
        security: secured,
        responses: { '200': jsonResponse('Updated count', successData({ type: 'object' })), '401': standardErrors['401'] },
      },
    },
    '/api/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark a notification as read',
        description: 'Only the owner can mark a notification. Other users receive 404.',
        security: secured,
        parameters: [uuidParam],
        responses: {
          '200': jsonResponse('Notification', successData({ type: 'object' })),
          '401': standardErrors['401'],
          '404': standardErrors['404'],
        },
      },
    },
    '/api/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Task statistics',
        description:
          'Counts are calculated in PostgreSQL for the caller visibility scope. Optional filters: status, priority, teamId, assignedToId, deadlineFrom, deadlineTo. overdue means deadline is in the past and status is not DONE.',
        security: secured,
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] } },
          { name: 'teamId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'assignedToId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'deadlineFrom', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'deadlineTo', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          '200': jsonResponse(
            'Summary',
            successData({
              type: 'object',
              properties: {
                total: { type: 'integer' },
                todo: { type: 'integer' },
                inProgress: { type: 'integer' },
                done: { type: 'integer' },
                highPriority: { type: 'integer' },
                overdue: { type: 'integer' },
              },
            }),
          ),
          '401': standardErrors['401'],
          '422': standardErrors['422'],
        },
      },
    },
  },
};
