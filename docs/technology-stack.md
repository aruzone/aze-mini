# Technology Stack

## Languages

| Language | Usage |
|---|---|
| TypeScript 5.9 | All backend and frontend source code |
| JavaScript | Config files (webpack.config.js, next.config.js, postcss.config.js, tailwind.config.js) |

---

## Runtime Platforms

| Platform | Version | Usage |
|---|---|---|
| Node.js | 20.x (types) | Backend and build tooling runtime |

---

## Backend Framework

| Technology | Version | Role |
|---|---|---|
| NestJS | ^11.0.0 | REST API framework |
| `@nestjs/common` | ^11.0.0 | Core decorators, guards, pipes, filters |
| `@nestjs/core` | ^11.0.0 | Application bootstrap |
| `@nestjs/config` | ^4.0.2 | Environment-based configuration |
| `@nestjs/jwt` | ^11.0.0 | JWT signing and verification |
| `@nestjs/platform-express` | ^11.0.0 | Express HTTP adapter |
| `@nestjs/mapped-types` | * | DTO type utilities |

---

## Frontend Framework

| Technology | Version | Role |
|---|---|---|
| Next.js | ~15.2.4 | React framework with App Router |
| React | 19.0.0 | UI rendering library |
| React DOM | 19.0.0 | DOM rendering |
| Tailwind CSS | 3.4.3 | Utility-first CSS |
| PostCSS | 8.4.38 | CSS transformation pipeline |
| Autoprefixer | 10.4.13 | CSS vendor prefix automation |

---

## Database / ORM

| Technology | Version | Role |
|---|---|---|
| Prisma ORM | ^6.16.2 | Schema management, migrations, typed queries |
| `@prisma/client` | ^6.16.2 | Generated database client |
| SQLite | — | Embedded relational database (via `DATABASE_URL=file:./dev.db`) |

---

## Build Systems

| Tool | Version | Role |
|---|---|---|
| Nx | 21.5.2 | Monorepo orchestration and task runner |
| webpack-cli | ^5.1.4 | Backend production build bundler |
| `@nx/webpack` | 21.5.2 | Nx webpack plugin |
| `@nx/next` | ^21.5.2 | Nx Next.js plugin |
| SWC | ~1.5.7 | Fast TypeScript/JS compiler (frontend) |

---

## Package Manager

| Tool | Role |
|---|---|
| npm | Dependency management; `package-lock.json` present |

---

## Testing Frameworks

| Tool | Version | Role |
|---|---|---|
| Jest | ^30.0.2 | Unit and integration tests (backend + frontend) |
| ts-jest | ^29.4.0 | TypeScript transform for Jest |
| `@nx/jest` | 21.5.2 | Nx Jest plugin |
| `@nestjs/testing` | ^11.0.0 | NestJS test module utilities |
| `@testing-library/react` | 16.1.0 | React component testing |
| `@testing-library/dom` | 10.4.0 | DOM testing utilities |
| Playwright | ^1.36.0 | Frontend E2E testing |
| `@nx/playwright` | 21.5.2 | Nx Playwright plugin |
| jest-environment-node | ^30.0.2 | Node test environment |
| jest-environment-jsdom | ^30.0.2 | JSDOM test environment for frontend |
| babel-jest | ^30.0.2 | Babel transform for Jest |

---

## Code Quality

| Tool | Version | Role |
|---|---|---|
| ESLint | ^9.8.0 | Static analysis |
| Prettier | ^2.6.2 | Code formatting |
| `typescript-eslint` | ^8.40.0 | TypeScript ESLint rules |
| `eslint-config-next` | ^15.2.4 | Next.js ESLint rules |

---

## Deployment Tooling

No containerization or CI/CD configuration files are present in the repository. The Nx `build` target for `aze-api` uses webpack-cli producing output to `dist/apps/aze-api/`. The `aze-client` build uses Next.js standard build output.
