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

Every route the API serves is listed in [interfaces.md](interfaces.md), which `npm run check:docs` holds to the controllers.

---

## Major Components

### Backend (`apps/aze-api`)

| Layer       | Files                           | Responsibility                                                                                                                                                                           |
| ----------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry point | `src/main.ts`                   | Check the environment and refuse to start if it is incomplete, then bootstrap Nest: global prefix, proxy trust, security headers, CORS, documentation, validation pipe, exception filter |
| Root module | `src/app/app.module.ts`         | Wire the feature modules together and register `AuthGuard` globally on `APP_GUARD`                                                                                                       |
| Auth        | `src/auth/`                     | Registration, login, bcryptjs hashing, JWT signing, and the failed-login throttle                                                                                                        |
| Users       | `src/users/`                    | `GET /users/me` only — reads the User the token identifies, never returning the password field. Also the email lookup `AuthService` validates a login against                            |
| Products    | `src/product/products/`         | Demo: product CRUD, with the two read routes cached                                                                                                                                      |
| Categories  | `src/product/product-category/` | Demo: category management                                                                                                                                                                |
| Reviews     | `src/product/review/`           | Demo: product reviews (one-to-many with Product)                                                                                                                                         |
| Tags        | `src/product/tag/`              | Demo: product tags (many-to-many with Product)                                                                                                                                           |
| Cache       | `src/cache/`                    | `CacheService` over Redis, failing open on every call (ADR-0005)                                                                                                                         |
| Database    | `src/database/`                 | `DatabaseService` extends `PrismaClient`, connects on module init; names the Prisma error codes the API answers for, and counts referencing rows before a delete                         |
| Config      | `src/config/`                   | Configuration reading, guards, decorators, pipes, security headers, the OpenAPI document, and the exception filter                                                                       |

### Shared contracts (`libs/`)

| Package              | Import path                    | Holds                                                                                                                                           |
| -------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform-contracts` | `@aze-mini/platform-contracts` | `RegisterRequest`, `LoginRequest`, `AuthResponse`, `UserProfile`, `ApiErrorResponse`, and `Wire<T>` for reading any of them as JSON delivers it |
| `demo-contracts`     | `@aze-mini/demo-contracts`     | `Product`, `ProductCategory`, `Review`, `Tag` and the request bodies that write them                                                            |

Both are plain types depending on nothing, so either application can declare itself against them. The API's DTO classes keep their validation decorators and add `implements` against the contract.

### Frontend (`apps/aze-client`)

| Layer      | Files                        | Responsibility                                                      |
| ---------- | ---------------------------- | ------------------------------------------------------------------- |
| Root layout | `src/app/layout.tsx`        | Root HTML document, pulling in the token layer                      |
| Tokens     | `src/app/global.css`         | Colours, type and radii as `@theme` tokens, and the dark scheme     |
| App shell  | `src/components/shell.tsx`   | The header and `main` landmark every page sits inside (Platform)    |
| Home page  | `src/app/page.tsx`           | Authenticated: reads `GET /users/me` server-side                    |
| Login      | `src/app/login/page.tsx`     | Sign-in form, posting to a server action                            |
| Catalogue  | `src/app/catalogue/page.tsx` | Demo: lists products from the API                                   |
| Actions    | `src/app/actions.ts`         | `login` / `logout` server actions; set and clear the session cookie |
| Session    | `src/lib/session.ts`         | The token in an httpOnly cookie                                     |
| API client | `src/lib/api.ts`             | The one place the client calls the API                              |
| Middleware | `src/middleware.ts`          | Redirects to `/login` without a session                             |
| API route  | `src/app/api/hello/route.ts` | Next.js API route returning a static string                         |

---

## Execution Flow

### Backend Startup

1. `configurationProblems()` names every missing or placeholder environment variable at once; if there are any, `main.ts` logs them all and exits before Prisma connects
2. `NestFactory.create(AppModule)` builds the application; `AppModule` loads `ConfigModule` (global), `CacheModule` (global), `DatabaseModule`, `AuthModule`, `UsersModule` and `ProductsModule`
3. `DatabaseService.onModuleInit()` calls `this.$connect()` to open the Postgres connection
4. Global prefix `/api` is set, and `trust proxy` is set from `TRUST_PROXY` — what `@Ip()` returns, and so what login throttling counts
5. Helmet security headers are registered, **before** the documentation route, because Express runs handlers in the order they were added
6. CORS is enabled from `CORS_ORIGIN`, defaulting to `http://localhost:3000`, exposing `X-Cache` to browser script
7. The OpenAPI document is served at `/api/docs` when `API_DOCS` allows
8. The global `ValidationPipe` and `ApiExceptionFilter` are registered
9. Server listens on `PORT` (default `3030`)

### Request Flow (a cached read)

```
Client → GET /api/products          Authorization: Bearer <jwt>
  → AuthGuard (global; verifies the token, attaches req.user)
  → ValidationPipe (sort, limit — limit must be a positive integer)
  → ProductsController.findAll()
  → ProductsService.findAll() → CacheService
      → HIT  ← Redis                        X-Cache: HIT
      → MISS → DatabaseService → Postgres,
               written back under the list's generation token
                                            X-Cache: MISS
```

### Request Flow (a machine-to-machine write)

```
Client → POST /api/products          x-api-key: <key>
  → @MachineToMachine() stands the JWT guard down
  → ApiKeyGuard (compares x-api-key with API_KEY; Forbidden on a mismatch)
  → ValidationPipe (CreateProductDto; an undeclared property is refused by name)
  → ProductsController.create()
  → ProductsService.create() → DatabaseService (PrismaClient) → Postgres
  → the product cache's generation token is bumped, forgetting every list variant
```

### Authentication Flow

```
Client → POST /api/auth/login { email, password }
  → @Public() — the global guard stands down
  → AuthController.login() reads the source address with @Ip()
  → AuthService.authenticate()
  → LoginAttempts.check(source, email)   refused after 5 failures for this
                                         source and User, or 20 for the source
  → UsersService.findUserByEmail()
  → bcryptjs compare against the stored hash
  → failure: the attempt is counted, and the answer is the same 401 whether or
             not that email exists
  → success: the count for that User is cleared
  → JwtService.sign({ sub: userId, email })       expires in 1 day
  ← { userId, email, accessToken }
```

`POST /auth/register` follows the same path, hashing with `hashPassword()` and answering with the same `AuthResponse`, so a new User arrives holding a token.

---

## Entry Points

| Entry Point   | Path                                 | Description             |
| ------------- | ------------------------------------ | ----------------------- |
| Backend main  | `apps/aze-api/src/main.ts`           | NestJS bootstrap        |
| Frontend main | `apps/aze-client/src/app/layout.tsx` | Next.js App Router root |
| Frontend home | `apps/aze-client/src/app/page.tsx`   | Default route `/`       |

---

## Dependency Relationships

```
AppModule
  ├── ConfigModule (global)
  ├── CacheModule (global)
  ├── DatabaseModule
  ├── AuthModule
  │     └── UsersModule
  ├── UsersModule
  ├── ProductsModule
  └── APP_GUARD → AuthGuard

ProductsModule
  ├── DatabaseModule
  ├── ProductCategoryModule
  ├── ReviewModule
  └── TagModule
```

---

## Security Notes

- **Every route requires a bearer token unless it opts out** with `@Public()`, because `AuthGuard` is registered globally on `APP_GUARD` (ADR-0002). Three routes opt out: the health route, registration and login.
- `AuthGuard` expects `Authorization: Bearer <jwt>` and attaches the verified claims to `req.user`.
- `ApiKeyGuard` expects `x-api-key` matching `API_KEY`, and refuses every request when that variable is unset rather than comparing two absent values. It is **never stacked** on the JWT guard — `@MachineToMachine()` stands that one down and applies this one instead, on `POST /products` alone.
- **Passwords are hashed with bcryptjs** and compared against the hash (ADR-0003). The password field is never returned by any route.
- **Failed logins are throttled** per source _and_ User, and per source alone. Only failures count, and a success clears that User's record. The counts live in one process, so two replicas mean two counts — [deployment.md](deployment.md) §8 records that as the limit it is.
- `ApiExceptionFilter` is **registered globally** in `main.ts`. It answers everything in one envelope, translates `P2025` to 404 and `P2002` to 409, and logs the stack of anything still answering 5xx — the body deliberately carries no detail.
- The `ValidationPipe` runs with `whitelist` and `forbidNonWhitelisted`, so an undeclared property is refused by name rather than dropped silently.
- Helmet sets a strict Content-Security-Policy on every response, loosened only for the Swagger UI page, which is built from inline script and style.
- CORS comes from `CORS_ORIGIN`. It matters only for callers reaching the API _from a browser_ — the client's own pages call it from the Next server.
- What remains an Adopter's to decide — token revocation, refresh tokens, a general rate limit, TLS — is in [deployment.md](deployment.md).
