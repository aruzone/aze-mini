# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Aze Starter is a full-stack monorepo using **Nx**, **Next.js** (frontend), **NestJS** (backend), and **Prisma** with SQLite.

## Commands

### Setup (first-time)
```bash
npm install

# Backend: copy env and init database
cd apps/aze-api
cp .env.example .env
npx prisma migrate dev
npx prisma generate
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

### Linting & Building
```bash
nx lint aze-api
nx lint aze-client
nx build aze-api        # Webpack build for production
nx build aze-client     # Next.js build
```

### Prisma
```bash
# Run from apps/aze-api or workspace root with npx
npx prisma migrate dev   # Apply migrations & regenerate client
npx prisma generate      # Regenerate client after schema changes
npx prisma studio        # Visual DB browser
```

## Architecture

### Backend (`apps/aze-api`)

NestJS app with a global API prefix (`/api`), running on port 3030.

**Module structure:**
- `src/app/` — Root `AppModule` wiring everything together
- `src/auth/` — JWT authentication (`AuthService`, `AuthController`). Login validates against `users` table and issues JWT tokens (1-day expiry). Passwords are stored plain-text (no hashing yet).
- `src/users/` — User CRUD; used by `AuthService` for login validation
- `src/product/` — Feature group containing:
  - `products/` — Full CRUD for products
  - `product-category/` — Category management
  - `review/` — Product reviews (one-to-many with Product)
  - `tag/` — Tags (many-to-many with Product)
- `src/database/` — `DatabaseService` extends `PrismaClient`; injected into all services
- `src/config/` — App config, guards, pipes, filters:
  - `auth.guard.ts` — JWT bearer token guard; attaches `req.user`
  - `api-key.guard.ts` — `x-api-key` header guard; reads `API_KEY` env var
  - `prisma.filter.ts` — Global exception filter for Prisma errors (currently commented out in `main.ts`)
  - `is-positive.pipe.ts` — Validation pipe for positive number parameters

**Prisma schema** is at `apps/aze-api/prisma/schema.prisma`. The generated client outputs to `apps/aze-api/generated/prisma/` (not the default location). Import from `../../generated/prisma` within the api app.

**Environment variables** (see `apps/aze-api/.env.example`):
- `DATABASE_URL` — SQLite file path (e.g., `file:./dev.db`)
- `JWT_SECRET` — Secret for JWT signing
- `API_KEY` — Key for the `x-api-key` guard
- `NODE_ENV`, `PORT`

### Frontend (`apps/aze-client`)

Next.js 15 app (React 19) with Tailwind CSS, running on port 3000.

- `src/app/` — Next.js App Router pages
- `src/app/api/` — Next.js API routes (currently has a `hello` route)
- `src/components/` — Shared React components

CORS is configured on the backend to allow `http://localhost:3000`.

### Nx Workspace

`nx.json` configures plugins for Next.js, Jest, ESLint, Webpack, and Playwright. All Nx targets (`build`, `serve`, `test`, `lint`, `e2e`) are inferred via these plugins. The `aze-api` project has an explicit `project.json` for its build targets using webpack-cli.
