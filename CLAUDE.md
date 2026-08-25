# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Aze Starter is a full-stack monorepo using **Nx**, **Next.js** (frontend), **NestJS** (backend), and **Prisma** with Postgres.

## Commands

### Setup (first-time)
```bash
npm install

# Start Postgres and Redis (Postgres is required — there is no file-based
# fallback, see docs/adr/0001; the cache fails open without Redis, see 0005)
# --wait blocks until the healthchecks pass; without it the migrate below races startup
docker compose up -d --wait
# A second clone runs alongside this one under its own project name and ports —
# POSTGRES_PORT=5433 REDIS_PORT=6380 docker compose -p aze-two up -d --wait —
# with that clone's .env carrying the ports it chose

# Backend: copy env and init database
cd apps/aze-api
cp .env.example .env
# Replace API_KEY and JWT_SECRET in .env — the API refuses to start while
# either still holds the placeholder it ships with
npx prisma migrate dev
npx prisma generate

# Seed the Demo User and catalogue. Prints the login to use; safe to re-run
npx prisma db seed
```

### Running
```bash
nx serve aze-api        # Backend → http://localhost:3030/api
nx dev aze-client       # Frontend → http://localhost:3000
```

### Testing
```bash
nx test aze-api                        # Run all backend tests
nx test aze-api --testFile=src/app/app.service.spec.ts  # Run a single test file
nx e2e aze-client-e2e                  # Frontend E2E (Playwright)
nx e2e aze-api-e2e                     # Backend E2E (Jest)
```

### CI

`.github/workflows/ci.yml` runs on every pull request: one job runs `nx affected -t lint test build` against the base branch, a second applies the migrations to a Postgres service and runs the API e2e suite against it and a Redis service. Redis is not optional there — the cache specs assert hits, which a fail-open cache cannot produce without one. Nx starts the API itself there — the `e2e` target declares `dependsOn: ["aze-api:build", "aze-api:serve"]`. The suite runs one spec file at a time (`maxWorkers: 1`): every spec drives that one API over one database and one Redis, and a product written by a parallel worker bumps the cached list's generation, which is a MISS the file asserting a HIT never asked for.

It reads no repository secrets, so it runs unchanged in a fork. The `JWT_SECRET` and `API_KEY` it sets are throwaway values for a throwaway database, present because the API refuses to start without them.

Node is pinned in `.nvmrc` (24), which `package.json` engines and the workflow both follow. Change one and change all three; the images added by #13 must match too.

`nx affected` only sees a root-level change if `sharedGlobals` in `nx.json` names the file — that is why a lockfile or workflow edit runs the full set.

### Linting & Building
```bash
nx lint aze-api
nx lint aze-client
nx build aze-api        # Webpack build for production
nx build aze-client     # Next.js build
```

### Prisma
```bash
# Run from apps/aze-api — prisma.config.ts lives there and names the schema
npx prisma migrate dev   # Apply migrations & regenerate client
npx prisma generate      # Regenerate client after schema changes
npx prisma studio        # Visual DB browser
npx prisma db seed       # Demo User and catalogue; safe to re-run
```

## Architecture

### Backend (`apps/aze-api`)

NestJS app with a global API prefix (`/api`), running on port 3030.

Interactive API documentation is served at `http://localhost:3030/api/docs`, with the raw spec at `/api/docs-json`. Authorize with a token from `POST /auth/register` or `/auth/login` to call protected routes from the page. What the docs claim about a route's auth comes from the same decorator that governs it — see `src/config/docs.ts` below.

**Module structure:**
- `src/app/` — Root `AppModule` wiring everything together
- `src/auth/` — JWT authentication (`AuthService`, `AuthController`, and `password.ts`, the one place a password becomes a hash — the Demo seed uses it too). `POST /auth/register` creates a User with a `bcryptjs` hash (see ADR-0003) and returns a token; `POST /auth/login` verifies against that hash and issues JWT tokens (1-day expiry).
- `src/users/` — `GET /users/me` only, reading the id off the verified token; also used by `AuthService` for login validation. It does not create accounts — registration is the only way in — and it never returns the `password` field
- `src/product/` — Feature group containing:
  - `products/` — Full CRUD for products. The two read routes go through `product-cache.ts`, the Demo of caching: keys, TTL and invalidation are all spelled out in that one file. A single product is keyed by id; lists are keyed by sort and limit under a generation token, so one deletion forgets every variant at once
  - `product-category/` — Category management
  - `review/` — Product reviews (one-to-many with Product)
  - `tag/` — Tags (many-to-many with Product)
- `src/cache/` — Redis caching (ADR-0005). `CacheService` is the one place the Starter talks to the cache and every method fails open — a Redis that is unreachable costs a request its speed and nothing else. `redis-store.ts` configures the store to fail fast rather than queue. `cache-status.ts` names the `X-Cache: HIT|MISS` header the cached routes answer with. The module is `@Global()`
- `src/database/` — `DatabaseService` extends `PrismaClient`; injected into all services. `prisma-errors.ts` names the Prisma error codes the API answers for (`P2025`, `P2002`) and is the one place they are spelled. `referenced-rows.ts` is what a delete calls before deleting: every relation is `RESTRICT`, and the database's refusal carries no Prisma code the filter could name, so the service counts the rows still pointing at the one being deleted and answers 409 naming them
- `src/config/` — App config, guards, pipes, filters:
  - `auth.guard.ts` — JWT bearer token guard, registered globally via `APP_GUARD` (see ADR-0002); attaches `req.user`. Every route requires a token unless it opts out
  - `decorators/public.decorator.ts` — `@Public()` opts a route out of the global guard. Only the root/health route, login, and registration carry it
  - `decorators/machine-to-machine.decorator.ts` — `@MachineToMachine()` stands the JWT guard down and applies `ApiKeyGuard` instead; on `POST /products` only
  - `api-key.guard.ts` — `x-api-key` header guard; reads `API_KEY` env var; throws `ForbiddenException` on failure. Never stacked on top of the JWT guard
  - `pipes/validation.pipe.ts` — The global `ValidationPipe` (active in `main.ts`). `whitelist` + `forbidNonWhitelisted` mean an undeclared property is refused by name, not dropped
  - `security.ts` — The `x-api-key` header name and the OpenAPI scheme names, so the guards and the documentation cannot advertise different credentials
  - `docs.ts` — Builds and serves the OpenAPI document (active in `main.ts` when `API_DOCS` allows). Bearer auth is required document-wide, mirroring the global guard; the two opt-out decorators carry their own exception
  - `api-exception.filter.ts` — Global exception filter (active in `main.ts`). It catches everything and answers in one envelope: `{ statusCode, timestamp, path, message }`. It takes `message` from the exception's own body without flattening it, which is what keeps the validation pipe's per-field array intact. Following Nest, `message` is a string for a single failure and an array of strings for a field list, so a client reading it must accept both. It also names two Prisma failures rather than letting them reach the 500 default: `P2025` (a row the write needed was not there) answers 404, `P2002` (a unique index) answers 409 naming the column that collided. Anything still answering 5xx is logged with its stack — the body deliberately carries no detail, so the log is the only place the cause survives
  - `is-positive.pipe.ts` — Validation pipe for positive number parameters

**Request bodies** bind to explicit DTO classes under each feature's `dto/`, validated with `class-validator`. No endpoint binds a generated Prisma input type — relations are flat ids on the wire (`categoryId`, `productId`) and the service turns them into Prisma's nested `connect`, so the generated types stop at the database layer. When a `connect` finds nothing, Prisma names the relation but never the id that missed, so the service looks up the ids the request supplied — only on the failing path — and answers 404 naming the one that is absent.

**Prisma schema** is at `apps/aze-api/prisma/schema.prisma`. The generated client outputs to `apps/aze-api/generated/prisma/` (not the default location). Import from `../../generated/prisma` within the api app. `apps/aze-api/prisma.config.ts` names the schema and the seed command, and loads `.env` itself — Prisma stops doing that once a config file exists.

**Demo tier.** The catalogue, the seed and the seeded User are Demo: read once, then deleted. `docs/demo.md` is the inventory of what to delete and what to edit.

**Environment variables** (see `apps/aze-api/.env.example`). `src/config/configuration.ts` is the one place the environment is read: `configurationProblems()` names what is missing or still a placeholder, and `main.ts` logs every problem at once and exits before Prisma connects, so an unconfigured Starter says which variable is wrong instead of failing later. Consumers read the values off `appConfig` (`jwtSecret`, `apiKey`) rather than reaching past it to `process.env`, so nothing can use a value the check never saw. The three below are required:
- `DATABASE_URL` — Postgres connection string (e.g., `postgresql://aze:aze_local_password@localhost:5432/aze?schema=public`)
- `JWT_SECRET` — Secret for JWT signing. No fallback exists anywhere; an unset one stops startup
- `API_KEY` — Key for the `x-api-key` guard. The guard refuses every request when it is unset, rather than comparing two absent values

The rest are optional:
- `REDIS_URL` — Redis connection string; defaults to `redis://localhost:6379`, the compose service. Deliberately not on the required list: the cache fails open, so an unreachable Redis makes the Starter slower rather than unstartable (ADR-0005)
- `API_DOCS` — `"true"` serves the docs, anything else withholds them. Unset means on everywhere but production
- `NODE_ENV`, `PORT`

### Frontend (`apps/aze-client`)

Next.js 15 app (React 19) with Tailwind CSS, running on port 3000.

- `src/app/` — Next.js App Router pages
- `src/app/api/` — Next.js API routes (currently has a `hello` route)
- `src/components/` — Shared React components

CORS is configured on the backend to allow `http://localhost:3000`.

### Nx Workspace

`nx.json` configures plugins for Next.js, Jest, ESLint, Webpack, and Playwright. All Nx targets (`build`, `serve`, `test`, `lint`, `e2e`) are inferred via these plugins. The `aze-api` project has an explicit `project.json` for its build targets using webpack-cli.

## Agent skills

### Issue tracker

Issues live in the `aruzone/aze-mini` GitHub Issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using the default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
