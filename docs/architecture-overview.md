# Architecture Overview

## High-Level Description

Aze is a full-stack monorepo built with **Nx**. It contains two applications — a NestJS REST API backend (`aze-api`) and a Next.js frontend (`aze-client`) — sharing a common workspace configuration.

```
Workspace (Nx)
├── apps/aze-api             NestJS REST API  (port 3030, prefix /api)
├── apps/aze-client          Next.js frontend (port 3000)
├── apps/aze-api-e2e         Backend E2E tests (Jest)
├── apps/aze-client-e2e      Frontend E2E tests (Playwright)
├── libs/platform-contracts  Wire shapes an Adopter keeps   (tier:platform)
└── libs/demo-contracts      Wire shapes an Adopter deletes (tier:demo)
```

The two libraries hold the shapes that cross between the applications, split so that removing the Demo is a delete rather than an edit (ADR-0006). A `tier:platform` project may not depend on a `tier:demo` one, which `@nx/enforce-module-boundaries` refuses at lint time.

---

## Major Components

### Backend (`apps/aze-api`)

| Layer | Files | Responsibility |
|---|---|---|
| Entry point | `src/main.ts` | Bootstrap NestJS app, set global prefix, enable CORS |
| Root module | `src/app/app.module.ts` | Wire all feature modules together |
| Auth | `src/auth/` | JWT login flow, credential validation |
| Users | `src/users/` | User CRUD, email lookup for auth |
| Products | `src/product/products/` | Product CRUD with sorting/pagination |
| Categories | `src/product/product-category/` | Product category management |
| Reviews | `src/product/review/` | Product reviews (one-to-many with Product) |
| Tags | `src/product/tag/` | Product tags (many-to-many with Product) |
| Cache | `src/cache/` | `CacheService` over Redis, failing open on every call (ADR-0005) |
| Database | `src/database/` | `DatabaseService` extends `PrismaClient`, connects on module init |
| Config | `src/config/` | App configuration, guards, pipes, exception filters |

### Shared contracts (`libs/`)

| Package | Import path | Holds |
|---|---|---|
| `platform-contracts` | `@aze-mini/platform-contracts` | `RegisterRequest`, `LoginRequest`, `AuthResponse`, `UserProfile`, `ApiErrorResponse`, and `Wire<T>` for reading any of them as JSON delivers it |
| `demo-contracts` | `@aze-mini/demo-contracts` | `Product`, `ProductCategory`, `Review`, `Tag` and the request bodies that write them |

Both are plain types depending on nothing, so either application can declare itself against them. The API's DTO classes keep their validation decorators and add `implements` against the contract.

### Frontend (`apps/aze-client`)

| Layer | Files | Responsibility |
|---|---|---|
| App shell | `src/app/layout.tsx` | Root HTML layout with global CSS |
| Home page | `src/app/page.tsx` | Authenticated: reads `GET /users/me` server-side |
| Login | `src/app/login/page.tsx` | Sign-in form, posting to a server action |
| Catalogue | `src/app/catalogue/page.tsx` | Demo: lists products from the API |
| Actions | `src/app/actions.ts` | `login` / `logout` server actions; set and clear the session cookie |
| Session | `src/lib/session.ts` | The token in an httpOnly cookie |
| API client | `src/lib/api.ts` | The one place the client calls the API |
| Middleware | `src/middleware.ts` | Redirects to `/login` without a session |
| API route | `src/app/api/hello/route.ts` | Next.js API route returning a static string |

---

## Execution Flow

### Backend Startup

1. `main.ts` calls `NestFactory.create(AppModule)`
2. `AppModule` loads `ConfigModule` (global), `DatabaseModule`, `AuthModule`, `UsersModule`, `ProductsModule`
3. `DatabaseService.onModuleInit()` calls `this.$connect()` to open the Postgres connection
4. Global prefix `/api` set; CORS allowed for `http://localhost:3000`
5. Server listens on `PORT` env var (default `3030`)

### Request Flow (authenticated write)

```
Client → POST /api/products
  → ApiKeyGuard (validates x-api-key header)
  → AuthGuard (validates Bearer JWT, attaches req.user)
  → ProductsController.create()
  → ProductsService.create()
  → DatabaseService (PrismaClient) → Postgres
```

### Authentication Flow

```
Client → POST /api/auth/login { email, password }
  → AuthController.login()
  → AuthService.authenticate()
  → UsersService.findUserByEmail()
  → plain-text password comparison
  → JwtService.sign({ email, sub: userId })
  ← { accessToken, userId, email }
```

---

## Entry Points

| Entry Point | Path | Description |
|---|---|---|
| Backend main | `apps/aze-api/src/main.ts` | NestJS bootstrap |
| Frontend main | `apps/aze-client/src/app/layout.tsx` | Next.js App Router root |
| Frontend home | `apps/aze-client/src/app/page.tsx` | Default route `/` |

---

## Dependency Relationships

```
AppModule
  ├── ConfigModule (global)
  ├── DatabaseModule ← ProductsModule, ProductCategoryModule, ReviewModule, TagModule
  ├── AuthModule
  │     └── UsersModule
  └── UsersModule

ProductsModule
  ├── DatabaseModule
  ├── ProductCategoryModule
  ├── ReviewModule
  └── TagModule
```

---

## Security Notes

- Write endpoints (POST, PATCH, DELETE) on Products, Categories, Reviews, and Tags are protected by both `ApiKeyGuard` and `AuthGuard`.
- `AuthGuard` expects `Authorization: Bearer <jwt>`.
- `ApiKeyGuard` expects `x-api-key` header matching `API_KEY` env var.
- Passwords are stored and compared in plain text — no hashing is implemented.
- `PrismaFilter` global exception filter exists but is **commented out** in `main.ts`.
