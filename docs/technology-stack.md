# Technology Stack

What the Starter is built from, by layer. Versions are the ranges declared in
`package.json`; image tags come from `docker-compose.yml`.

Sources of truth, in case this page drifts: `package.json`, `docker-compose.yml`,
`.nvmrc`, `nx.json`. The per-package inventory is
[dependencies.md](dependencies.md).

---

## Languages

| Language        | Usage                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript ~5.9 | All application source, plus `jest.config.ts` and `apps/aze-api/prisma.config.ts`                                                             |
| JavaScript      | Build config: `webpack.config.js`, `next.config.js`, `postcss.config.js`, `jest.preset.js`, and the flat ESLint configs (`eslint.config.mjs`) |

---

## Runtime Platform

| Platform | Version | Usage                                                 |
| -------- | ------- | ----------------------------------------------------- |
| Node.js  | 24      | Backend runtime, client server, and all build tooling |

Node is pinned in **four** places that must move together: `.nvmrc`,
`engines` in `package.json`, `apps/aze-api/Dockerfile` and
`apps/aze-client/Dockerfile`. CI reads `.nvmrc` rather than restating it.

`@types/node` is `^22.19` — the type package trails the pinned runtime.

---

## Backend Framework

| Technology                 | Version | Role                                                     |
| -------------------------- | ------- | -------------------------------------------------------- |
| NestJS                     | ^11.1   | REST API framework                                       |
| `@nestjs/common`           | ^11.1   | Decorators, guards, pipes, filters                       |
| `@nestjs/core`             | ^11.1   | Application bootstrap and the global `APP_GUARD` binding |
| `@nestjs/platform-express` | ^11.1   | Express HTTP adapter — also what `trust proxy` is set on |
| `@nestjs/config`           | ^4.0    | Environment-based configuration                          |
| `@nestjs/jwt`              | ^11.0   | JWT signing and verification                             |
| `@nestjs/swagger`          | ^11.4   | OpenAPI document and the Swagger UI page                 |
| `reflect-metadata`         | ^0.2    | Decorator metadata NestJS depends on                     |
| `rxjs`                     | ^7.8    | Reactive primitives NestJS depends on                    |

---

## Frontend Framework

| Technology             | Version | Role                                                                                       |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------ |
| Next.js                | ^16.1   | React framework, App Router, `output: 'standalone'` for the image                          |
| React                  | ^19.2   | UI rendering                                                                               |
| React DOM              | ^19.2   | DOM renderer                                                                               |
| Tailwind CSS           | ^4.2    | Utility-first CSS, configured from `src/app/global.css` — v4 needs no `tailwind.config.js` |
| `@tailwindcss/postcss` | ^4.2    | The only plugin in `apps/aze-client/postcss.config.js`                                     |
| PostCSS                | ^8.5    | CSS transformation pipeline                                                                |

---

## Database / ORM

| Technology       | Version   | Role                                                                                                  |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| Postgres         | 18-alpine | The only supported database — there is no file-based fallback ([ADR-0001](adr/0001-postgres-only.md)) |
| Prisma ORM       | ^6.19     | Schema, migrations, generated client. CLI is a devDependency                                          |
| `@prisma/client` | ^6.19     | Generated client, output to `apps/aze-api/generated/prisma/` rather than the default location         |

`apps/aze-api/prisma.config.ts` names the schema and the seed command and loads
`.env` itself, because Prisma stops doing that once a config file exists.

---

## Cache

| Technology              | Version  | Role                                                                             |
| ----------------------- | -------- | -------------------------------------------------------------------------------- |
| Redis                   | 8-alpine | Cache for the product read path ([ADR-0005](adr/0005-redis-cache-fails-open.md)) |
| `@nestjs/cache-manager` | ^3.1     | Nest binding for the cache                                                       |
| `cache-manager`         | ^7.2     | Cache API `CacheService` wraps                                                   |
| `@keyv/redis`           | ^5.1     | Redis store, configured to fail fast rather than queue                           |
| `keyv`                  | ^5.6     | Store interface `cache-manager` speaks                                           |

Every `CacheService` method fails open: an unreachable Redis costs a request its
speed and nothing else.

---

## Security and Validation

| Technology          | Version | Role                                                                                                           |
| ------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `helmet`            | ^8.3    | Response security headers; strict CSP everywhere, loosened only for the docs page                              |
| `bcryptjs`          | ^3.0    | Password hashing — pure JS, so no image needs a build toolchain ([ADR-0003](adr/0003-bcryptjs-over-argon2.md)) |
| `class-validator`   | ^0.14   | Request body validation rules on the DTO classes                                                               |
| `class-transformer` | ^0.5    | Payload-to-class transformation the validation pipe runs on                                                    |

Login throttling and the API-key guard are first-party code, not libraries —
`src/auth/login-attempts.ts` and `src/config/guards/api-key.guard.ts`.

---

## Build Systems

| Tool             | Version | Role                                                             |
| ---------------- | ------- | ---------------------------------------------------------------- |
| Nx               | 22.5.3  | Monorepo orchestration, task caching, `nx affected`              |
| `@nx/webpack`    | 22.5.3  | Inferred webpack targets                                         |
| `@nx/next`       | 22.5.3  | Inferred Next.js targets                                         |
| `@nx/jest`       | 22.5.3  | Inferred Jest targets                                            |
| `@nx/eslint`     | 22.5.3  | Inferred lint targets                                            |
| `@nx/playwright` | 22.5.3  | Inferred e2e targets                                             |
| webpack-cli      | ^6.0    | Backend production bundle, driven by `apps/aze-api/project.json` |
| SWC              | ^1.15   | Fast TypeScript compilation                                      |

Every target except the `aze-api` build ones is inferred by an Nx plugin. The
`libs/` packages are unbuildable source libraries mapped by `paths` in
`tsconfig.base.json`, so there is no build step before serving.

---

## Package Manager

| Tool | Role                                                                         |
| ---- | ---------------------------------------------------------------------------- |
| npm  | Dependency management; `package-lock.json` is committed and CI uses `npm ci` |

`package.json` carries an `overrides` block pinning minimum versions of
transitive packages (`minimatch`, `koa`, `webpack`, `serialize-javascript`,
`hono`) — floors for advisories reached through the tooling, not direct
dependencies.

---

## Testing

| Tool                     | Version | Role                                                         |
| ------------------------ | ------- | ------------------------------------------------------------ |
| Jest                     | ^30.2   | Unit and integration tests, backend and frontend             |
| ts-jest                  | ^29.4   | TypeScript transform                                         |
| babel-jest               | ^30.2   | Babel transform                                              |
| jest-environment-node    | ^30.2   | Node environment for backend specs                           |
| jest-environment-jsdom   | ^30.2   | JSDOM environment for client specs                           |
| `@nestjs/testing`        | ^11.1   | NestJS testing module                                        |
| `@testing-library/react` | ^16.3   | React component testing                                      |
| `@testing-library/dom`   | ^10.4   | DOM queries                                                  |
| Playwright               | ^1.58   | Client end-to-end tests, driving the installed Google Chrome |
| axios                    | ^1.13   | HTTP client the API e2e suite calls the running API with     |

The API e2e suite runs one spec file at a time — every spec drives one API over
one database and one Redis, and a parallel writer would turn a cache HIT the
suite asserts into a MISS.

---

## Code Quality

| Tool                                                | Version      | Role                                                                                                                                                                             |
| --------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                                              | ^9.39        | Static analysis, flat config (`eslint.config.mjs`)                                                                                                                               |
| `typescript-eslint`                                 | ^8.56        | TypeScript rules                                                                                                                                                                 |
| `@nx/eslint-plugin`                                 | 22.5.3       | Supplies `@nx/enforce-module-boundaries`, which refuses a `tier:platform` project any dependency on a `tier:demo` one ([ADR-0006](adr/0006-contracts-as-types-split-by-tier.md)) |
| `eslint-config-next` / `@next/eslint-plugin-next`   | ^16.1        | Next.js rules                                                                                                                                                                    |
| `eslint-plugin-react` / `eslint-plugin-react-hooks` | ^7.37 / ^7.0 | React rules                                                                                                                                                                      |
| `eslint-plugin-jsx-a11y`                            | ^6.10        | Accessibility rules                                                                                                                                                              |
| `eslint-plugin-import`                              | ^2.32        | Import correctness                                                                                                                                                               |
| `eslint-plugin-playwright`                          | ^2.8         | Playwright test rules                                                                                                                                                            |
| `eslint-config-prettier`                            | ^10.1        | Turns off rules Prettier owns                                                                                                                                                    |
| Prettier                                            | ^3.8         | Formatting                                                                                                                                                                       |

---

## Containers

| Artifact                     | Base           | Notes                                                                                                                                                                                                                                                     |
| ---------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/aze-api/Dockerfile`    | `node:24-slim` | Multi-stage. `prisma generate` runs inside the image so the query engine matches the image's platform. A `migrator` stage keeps the build's full tree, because the Prisma CLI is a devDependency the runtime image has no reason to carry. Runs as `node` |
| `apps/aze-client/Dockerfile` | `node:24-slim` | Multi-stage over Next's standalone output, so the runtime stage installs nothing. Runs as `node`                                                                                                                                                          |
| `docker-compose.yml`         | —              | Postgres, Redis, both apps, and a `migrate` service that applies migrations and exits. Every service has a healthcheck; ports bind to loopback only                                                                                                       |

Debian rather than Alpine: Prisma's query engine wants glibc and OpenSSL, and
nothing in the tree compiles.

---

## Deployment Tooling

| Tool           | Role                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Helm           | `deploy/helm/aze` — two Deployments, two Services, a Secret and a pre-upgrade migration Job. Barebones and Demo; see [deploy/README.md](../deploy/README.md)                                       |
| Argo CD        | `deploy/argocd/` — two Applications pointing at the chart: staging tracks `main`, production pins a tag                                                                                             |
| GitHub Actions | `.github/workflows/ci.yml` — `nx affected -t lint test build` on one job, the API e2e suite against real Postgres and Redis services on another. Reads no repository secrets, so it runs in a fork |

Nx `build` for `aze-api` writes to `dist/apps/aze-api/`; `aze-client` builds to
Next's standalone output.
