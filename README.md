# Role-Based Task Management System

REST API for a role-based task management system. Users belong to teams, managers run those teams, and administrators manage the whole system. Tasks, comments, notifications, and dashboard statistics are enforced on the server.

## Technology stack

- Node.js and TypeScript (strict)
- Express.js
- PostgreSQL
- Prisma ORM
- JWT access tokens and rotating refresh tokens
- bcrypt password hashing
- Zod validation
- Swagger / OpenAPI
- Jest and Supertest
- Helmet, CORS, and express-rate-limit (available; not enabled on routes for now)
- Pino logging

## Architecture

```
src/
  app.ts                 Express application
  server.ts              Process startup and shutdown
  config/env.ts          Environment loading and validation
  controllers/           HTTP adapters
  services/              Business rules and database access
  routes/                Route registration
  middleware/            Auth, roles, validation, errors
  validators/            Zod schemas
  utils/                 Tokens, passwords, pagination, logging
  types/                 Shared TypeScript types
  prisma/client.ts       Prisma client singleton
docs/swagger.ts          OpenAPI document
prisma/schema.prisma     Database schema
prisma/seed.ts           Development seed
tests/                   Integration tests
```

Controllers stay thin. Services own authorization and persistence. Routes only wire HTTP concerns.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 16, either installed locally or started with Docker Compose

## Installation

```bash
npm install
cp .env.example .env
```

Fill in `.env`. Generate two different secrets of at least 32 characters:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For tests, copy `.env.test.example` to `.env.test` and point `DATABASE_URL` at a database whose name contains `test`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | HTTP port |
| `NODE_ENV` | `development`, `test`, or `production` |
| `JWT_ACCESS_SECRET` | Access-token signing secret |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret. Must differ from the access secret |
| `ACCESS_TOKEN_EXPIRES_IN` | Short access-token lifetime, for example `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh-token lifetime, for example `7d` |
| `CORS_ORIGIN` | Comma-separated allowed origins. `*` is rejected |
| `POSTGRES_USER` | Used by Docker Compose |
| `POSTGRES_PASSWORD` | Used by Docker Compose |
| `POSTGRES_DB` | Used by Docker Compose |

The application refuses to start when a required variable is missing or invalid. Secrets are never returned by an API.

## PostgreSQL setup

Local database:

```bash
docker compose up -d postgres
```

Use a `DATABASE_URL` that points at `localhost` when the API runs on the host. Docker Compose points the API container at the `postgres` service hostname.

## Prisma

```bash
npx prisma migrate dev
npx prisma migrate deploy
npx prisma generate
npm run prisma:seed
```

`migrate dev` creates a development migration. `migrate deploy` applies committed migrations. The seed script deletes existing application data and is refused when `NODE_ENV=production`.

## Development

```bash
npm run dev
```

## Production build

```bash
npm run build
npm start
```

## Tests

```bash
npm test
```

Jest uses `.env.test`, creates the test database if needed, and applies migrations. It will not run when `DATABASE_URL` does not contain `test`.

## Swagger

Interactive docs: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

OpenAPI JSON: [http://localhost:3000/api-docs.json](http://localhost:3000/api-docs.json)

## Authentication

`POST /api/auth/register` creates an active `USER`. Role cannot be chosen during registration.

`POST /api/auth/login` validates the password with bcrypt and returns a short-lived access token:

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "user": {}
  }
}
```

The refresh token is set as an `HttpOnly` cookie named `refreshToken` on `/api/auth`. `Secure` and `SameSite=None` are used in production. Other environments use `SameSite=Lax`. The raw refresh token is not stored and is not returned in JSON. The database stores a SHA-256 hash.

`POST /api/auth/refresh` rotates that cookie. Presenting a revoked refresh token revokes the user's active refresh tokens.

`POST /api/auth/logout` revokes the current refresh token and clears the cookie. Access tokens stay valid until they expire. Keep that lifetime short.

`GET /api/auth/me` requires `Authorization: Bearer <accessToken>`.

Access-token claims are only `userId`, `role`, and `tokenType`. Every protected request loads the current user from the database, so a deactivated account or a changed role takes effect immediately.

Failed logins return the same message for an unknown email, a wrong password, and an inactive account.

## Roles and permissions

| Action | ADMIN | MANAGER | USER |
| --- | --- | --- | --- |
| List and update users, change roles, deactivate users | Yes | List users only | Own profile only |
| Create and delete teams, assign managers | Yes | No | No |
| Update a team and its membership | Any team | Teams they manage | No |
| Create, update, assign, and delete tasks | Any team | Teams they manage | No |
| View tasks | All | Managed teams and assigned tasks | Assigned tasks |
| Update task status | Any visible task | Managed team tasks and assigned tasks | Assigned tasks |
| Comment | Visible tasks | Visible tasks | Assigned tasks |
| Edit or delete another person's comment | Yes | No | No |
| Notifications and dashboard | Own notifications; all task stats | Own notifications; managed-team stats | Own notifications; assigned-task stats |

A caller who cannot see a team or task receives `404`, not the other person's data. A member who can see a team but does not manage it receives `403` for management actions.

## Pagination

Collection endpoints accept `page` and `limit`.

- Default page: `1`
- Default limit: `20`
- Maximum limit: `100`
- Invalid values return `422`

The response includes:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Task sorting accepts only `createdAt`, `updatedAt`, `deadline`, `priority`, `status`, and `title`.

## Security

- Helmet and explicit CORS origins with credentials
- Login lockout after 5 failed attempts (15 minutes)
- bcrypt hashes, cost 12 outside tests
- Zod validation for body, query, and params
- Prisma queries instead of dynamic SQL
- Request body limit of 100kb
- Centralized errors without stack traces outside development
- `passwordHash` and refresh tokens are excluded from responses
- Authorization is checked on the server for identity, role, and resource scope

## Docker

```bash
docker compose up --build
```

Compose starts PostgreSQL and the API. Database credentials come from `.env`; they are not hard-coded in the compose file. The API container rewrites `DATABASE_URL` to the `postgres` hostname.

Run the seed from the host after Postgres is reachable:

```bash
npm run prisma:seed
```

## Vercel deployment

This API runs on Vercel as a serverless function (`api/index.ts`). It does not use `app.listen` on Vercel.

1. Push the repo to GitHub and import it in Vercel as a new project.
2. Framework Preset: Other.
3. In Project Settings → Environment Variables, set:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooler** URL with `sslmode=require&pgbouncer=true&connect_timeout=30` |
| `DIRECT_URL` | Neon **direct** URL (hostname without `-pooler`) with `sslmode=require&connect_timeout=30` |
| `NODE_ENV` | `production` |
| `JWT_ACCESS_SECRET` | Random string, at least 32 characters |
| `JWT_REFRESH_SECRET` | Different random string, at least 32 characters |
| `ACCESS_TOKEN_EXPIRES_IN` | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | Your frontend origin(s), comma-separated, for example `https://your-app.vercel.app,http://localhost:5173` |

`PORT` is optional on Vercel. Do not paste `.env` from your laptop into Git.

4. Deploy. The `vercel-build` script runs `prisma generate`. Apply migrations from your machine when the schema changes:

```bash
npx prisma migrate deploy
```

Set every variable for **Production**, **Preview**, and **Development** in Vercel, including `DIRECT_URL`. A Preview deploy fails if those vars exist only on Production.
5. Seed the hosted database once from your machine (seed refuses `NODE_ENV=production`):

```bash
DATABASE_URL="your-neon-url" NODE_ENV=development npm run prisma:seed
```

6. Check `https://YOUR_BACKEND.vercel.app/api/health` and `https://YOUR_BACKEND.vercel.app/api-docs`.

7. Point the frontend `VITE_API_URL` at the Vercel backend URL. Keep `CORS_ORIGIN` and cookie credentials aligned; production cookies use `Secure` and `SameSite=None`.

If the deploy shows `FUNCTION_INVOCATION_FAILED`, open Vercel → Deployment → Functions → Logs. Missing env vars or a bad `DATABASE_URL` are the usual causes.

## Example requests

Register:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"New User\",\"email\":\"new.user@example.com\",\"password\":\"Password123!\"}"
```

Log in:

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"Password123!\"}"
```

Create a task:

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Prepare release\",\"priority\":\"HIGH\",\"teamId\":\"TEAM_UUID\",\"assignedToId\":\"USER_UUID\"}"
```

Update status:

```bash
curl -X PATCH http://localhost:3000/api/tasks/TASK_UUID/status \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"IN_PROGRESS\"}"
```

## Development credentials

The seed password is for local development only: `Password123!`

| Role | Email |
| --- | --- |
| ADMIN | admin@example.com |
| MANAGER | manager@example.com |
| USER | user1@example.com |
| USER | user2@example.com |

Do not use this password in production.
