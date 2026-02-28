# Architecture Overview

## High-Level Description

Aze is a full-stack monorepo built with **Nx**. It contains two applications — a NestJS REST API backend (`aze-api`) and a Next.js frontend (`aze-client`) — sharing a common workspace configuration.

```
Workspace (Nx)
├── apps/aze-api         NestJS REST API  (port 3030, prefix /api)
├── apps/aze-client      Next.js frontend (port 3000)
├── apps/aze-api-e2e     Backend E2E tests (Jest)
└── apps/aze-client-e2e  Frontend E2E tests (Playwright)
```

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
| Database | `src/database/` | `DatabaseService` extends `PrismaClient`, connects on module init |
| Config | `src/config/` | App configuration, guards, pipes, exception filters |

### Frontend (`apps/aze-client`)

| Layer | Files | Responsibility |
|---|---|---|
| App shell | `src/app/layout.tsx` | Root HTML layout with global CSS |
| Home page | `src/app/page.tsx` | Main page; renders `MyComponent` |
| API route | `src/app/api/hello/route.ts` | Next.js API route returning a static string |
| Component | `src/components/MyComponent.tsx` | Fetches and renders product list from backend |

---

## Execution Flow

### Backend Startup

1. `main.ts` calls `NestFactory.create(AppModule)`
2. `AppModule` loads `ConfigModule` (global), `DatabaseModule`, `AuthModule`, `UsersModule`, `ProductsModule`
3. `DatabaseService.onModuleInit()` calls `this.$connect()` to open SQLite connection
4. Global prefix `/api` set; CORS allowed for `http://localhost:3000`
5. Server listens on `PORT` env var (default `3030`)

### Request Flow (authenticated write)

```
Client → POST /api/products
  → ApiKeyGuard (validates x-api-key header)
  → AuthGuard (validates Bearer JWT, attaches req.user)
  → ProductsController.create()
  → ProductsService.create()
  → DatabaseService (PrismaClient) → SQLite
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
