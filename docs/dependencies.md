# Dependencies

Every package declared in `package.json` at the workspace root, with what it is
here for. Versions are the declared ranges — `npm ls <package>` says what is
actually installed.

The workspace has one `package.json`; both apps and both libraries draw from it.
For the same picture grouped by layer rather than by package, see
[technology-stack.md](technology-stack.md).

---

## Runtime Dependencies

### NestJS

| Package                    | Version  | Purpose                                                                               |
| -------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `@nestjs/common`           | ^11.1.14 | Decorators, guards, pipes, filters                                                    |
| `@nestjs/core`             | ^11.1.14 | Application bootstrap; supplies the `APP_GUARD` token the auth guard is registered on |
| `@nestjs/platform-express` | ^11.1.14 | Express HTTP adapter — typed as `NestExpressApplication` so `trust proxy` is settable |
| `@nestjs/config`           | ^4.0.3   | Loads `.env` and serves values through `ConfigService`                                |
| `@nestjs/jwt`              | ^11.0.2  | Signs and verifies the bearer tokens                                                  |
| `@nestjs/swagger`          | ^11.4.6  | Builds the OpenAPI document and serves Swagger UI at `/api/docs`                      |
| `reflect-metadata`         | ^0.2.2   | Decorator metadata NestJS depends on                                                  |
| `rxjs`                     | ^7.8.2   | Reactive primitives NestJS depends on                                                 |

### Frontend

| Package     | Version | Purpose                                                       |
| ----------- | ------- | ------------------------------------------------------------- |
| `next`      | ^16.1.6 | React framework for the client; App Router and server actions |
| `react`     | ^19.2.4 | UI library                                                    |
| `react-dom` | ^19.2.4 | DOM renderer                                                  |

### Data

| Package          | Version | Purpose                                                               |
| ---------------- | ------- | --------------------------------------------------------------------- |
| `@prisma/client` | ^6.19.2 | Generated database client, output to `apps/aze-api/generated/prisma/` |

### Cache

| Package                 | Version | Purpose                                                                                                 |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `@nestjs/cache-manager` | ^3.1.3  | Nest binding for the cache                                                                              |
| `cache-manager`         | ^7.2.9  | Cache API `CacheService` wraps                                                                          |
| `@keyv/redis`           | ^5.1.6  | Redis store, configured to fail fast rather than queue ([ADR-0005](adr/0005-redis-cache-fails-open.md)) |
| `keyv`                  | ^5.6.0  | Store interface `cache-manager` speaks                                                                  |

### Observability

| Package       | Version | Purpose                                                                                          |
| ------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `nestjs-pino` | ^4.6.1  | Nest binding for the request logger; the whole convention lives in `src/config/logging.ts`        |
| `pino`        | ^10.3.1 | The logger itself — JSON to stdout, redacting credentials, one line per request                   |
| `prom-client` | ^15.1.3 | The metrics registry behind `GET /api/metrics`, opt-in through `METRICS_ENABLED` ([ADR-0008](adr/0008-pino-logging-opt-in-metrics-and-a-named-error-hook.md)) |

### Security and validation

| Package             | Version | Purpose                                                                                                |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `helmet`            | ^8.3.0  | The response security headers, configured in `src/config/security-headers.ts`                          |
| `bcryptjs`          | ^3.0.3  | Password hashing; pure JS, so no image needs a compiler ([ADR-0003](adr/0003-bcryptjs-over-argon2.md)) |
| `class-validator`   | ^0.14.4 | The validation rules on every request DTO                                                              |
| `class-transformer` | ^0.5.1  | Turns a JSON body into the DTO class the pipe validates                                                |

### Other

| Package | Version | Purpose                                                                                                                                                                |
| ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axios` | ^1.13.6 | HTTP client. Used only by the API e2e suite (`apps/aze-api-e2e`), which calls the running API with it — declared as a runtime dependency rather than a development one |

---

## Development Dependencies

### Nx

| Package             | Version | Purpose                                                                                                                                       |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `nx`                | 22.5.3  | Task runner, caching, project graph, `nx affected`                                                                                            |
| `@nx/devkit`        | 22.5.3  | Utilities the plugins build on                                                                                                                |
| `@nx/workspace`     | 22.5.3  | Workspace generators and utilities                                                                                                            |
| `@nx/js`            | 22.5.3  | TypeScript/JavaScript utilities; supplies the `@nx/js:node` serve executor                                                                    |
| `@nx/webpack`       | 22.5.3  | Infers webpack targets                                                                                                                        |
| `@nx/next`          | 22.5.3  | Infers Next.js targets                                                                                                                        |
| `@nx/nest`          | 22.5.3  | NestJS generators                                                                                                                             |
| `@nx/node`          | 22.5.3  | Node application utilities                                                                                                                    |
| `@nx/web`           | 22.5.3  | Web utilities                                                                                                                                 |
| `@nx/jest`          | 22.5.3  | Infers Jest test targets                                                                                                                      |
| `@nx/eslint`        | 22.5.3  | Infers lint targets                                                                                                                           |
| `@nx/eslint-plugin` | 22.5.3  | Supplies `@nx/enforce-module-boundaries`, which holds the Platform/Demo tier split ([ADR-0006](adr/0006-contracts-as-types-split-by-tier.md)) |
| `@nx/playwright`    | 22.5.3  | Infers e2e targets for the client suite                                                                                                       |

### Build tools

| Package              | Version  | Purpose                                                                                                             |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `typescript`         | ~5.9.3   | Compiler                                                                                                            |
| `webpack-cli`        | ^6.0.1   | Builds the API bundle, invoked by `apps/aze-api/project.json`                                                       |
| `prisma`             | ^6.19.2  | CLI for migrations, generation and seeding. A devDependency, which is why the image has a separate `migrator` stage |
| `ts-node`            | ^10.9.2  | Runs `prisma/seed.ts`, as named in `prisma.config.ts`                                                               |
| `tslib`              | ^2.8.1   | TypeScript runtime helpers                                                                                          |
| `dotenv`             | ^16.4.7  | Loads `.env` for tooling that runs outside Nest                                                                     |
| `@swc/core`          | ^1.15.17 | SWC compiler                                                                                                        |
| `@swc/cli`           | ^0.8.0   | SWC command line                                                                                                    |
| `@swc/helpers`       | ^0.5.19  | SWC runtime helpers                                                                                                 |
| `@swc-node/register` | ^1.11.1  | SWC transpile hook for TypeScript config files                                                                      |
| `@nestjs/schematics` | ^11.0.9  | NestJS code generation                                                                                              |

### Testing

| Package                  | Version  | Purpose                                  |
| ------------------------ | -------- | ---------------------------------------- |
| `jest`                   | ^30.2.0  | Test runner                              |
| `ts-jest`                | ^29.4.6  | TypeScript transform                     |
| `babel-jest`             | ^30.2.0  | Babel transform                          |
| `jest-environment-node`  | ^30.2.0  | Environment for backend specs            |
| `jest-environment-jsdom` | ^30.2.0  | Environment for client specs             |
| `jest-util`              | ^30.2.0  | Jest utilities                           |
| `@types/jest`            | ^30.0.0  | Jest types                               |
| `@nestjs/testing`        | ^11.1.14 | Builds testing modules for the API specs |
| `@testing-library/react` | ^16.3.2  | React component testing                  |
| `@testing-library/dom`   | ^10.4.1  | DOM queries                              |
| `@playwright/test`       | ^1.58.2  | Client e2e framework                     |

### Styling

| Package                | Version  | Purpose                                                                                                             |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `tailwindcss`          | ^4.2.1   | Utility CSS. v4 is configured from `src/app/global.css`; there is no `tailwind.config.js`                           |
| `@tailwindcss/postcss` | ^4.2.1   | The Tailwind PostCSS plugin, and the only entry in `apps/aze-client/postcss.config.js`                              |
| `postcss`              | ^8.5.6   | CSS transformation pipeline                                                                                         |
| `autoprefixer`         | ^10.4.27 | Vendor prefixing. Nothing references it — Tailwind v4 handles prefixing itself — so it is a leftover safe to remove |

### Code quality

| Package                     | Version | Purpose                                                              |
| --------------------------- | ------- | -------------------------------------------------------------------- |
| `eslint`                    | ^9.39.3 | Static analysis, flat config                                         |
| `@eslint/js`                | ^9.39.3 | Base JavaScript rules                                                |
| `@eslint/compat`            | ^1.4.1  | Flat-config compatibility helper from the Nx scaffold                |
| `@eslint/eslintrc`          | ^3.3.4  | Reads legacy-format shareable configs into flat config               |
| `typescript-eslint`         | ^8.56.1 | TypeScript rules                                                     |
| `eslint-config-next`        | ^16.1.6 | Next.js configuration, loaded by `apps/aze-client/eslint.config.mjs` |
| `@next/eslint-plugin-next`  | ^16.1.6 | Next.js rules                                                        |
| `eslint-plugin-react`       | ^7.37.5 | React rules                                                          |
| `eslint-plugin-react-hooks` | ^7.0.1  | Hooks rules                                                          |
| `eslint-plugin-jsx-a11y`    | ^6.10.2 | Accessibility rules                                                  |
| `eslint-plugin-import`      | ^2.32.0 | Import correctness                                                   |
| `eslint-plugin-playwright`  | ^2.8.0  | Playwright test rules                                                |
| `eslint-config-prettier`    | ^10.1.8 | Turns off rules Prettier owns                                        |
| `prettier`                  | ^3.8.1  | Formatting                                                           |

`eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`,
`eslint-plugin-import` and `@next/eslint-plugin-next` all arrive with
`eslint-config-next` anyway; declaring them here pins the version rather than
leaving it to resolution.

`@eslint/compat` and `@eslint/eslintrc` are different — no config in this repo
imports either, and `apps/aze-client/eslint.config.mjs` records why the
compatibility layer is not needed: `eslint-config-next` ships native flat config.

### Types

| Package            | Version   | Purpose                                       |
| ------------------ | --------- | --------------------------------------------- |
| `@types/node`      | ^22.19.13 | Node types. Trails the pinned Node 24 runtime |
| `@types/react`     | ^19.2.14  | React types                                   |
| `@types/react-dom` | ^19.2.3   | React DOM types                               |

---

## Overrides

`package.json` carries an `overrides` block. None of these are direct
dependencies — each is reached through the tooling, and the entry sets a floor
below which npm may not resolve it:

| Package                | Floor     |
| ---------------------- | --------- |
| `minimatch`            | >=9.0.0   |
| `koa`                  | >=3.1.2   |
| `webpack`              | >=5.104.0 |
| `serialize-javascript` | >=7.0.3   |
| `hono`                 | >=4.12.0  |

Removing one lets the transitive resolution fall back to whatever a dependency
asks for, which is what these exist to prevent.

---

## Not in `package.json`

Two things the Starter depends on that npm does not install:

| Dependency              | Where it is pinned                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Node 24                 | `.nvmrc`, `engines` in `package.json`, and both Dockerfiles — change one and change all four                                                    |
| Postgres 18 and Redis 8 | `docker-compose.yml` for local work and `.github/workflows/ci.yml` for CI; a deployment brings its own ([docs/deployment.md](deployment.md) §7) |
