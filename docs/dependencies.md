# Dependencies

Source: `package.json` at workspace root.

---

## Runtime Dependencies

| Package | Version | Purpose | Type |
|---|---|---|---|
| `@nestjs/common` | ^11.0.0 | Core NestJS decorators, guards, pipes, filters | runtime |
| `@nestjs/config` | ^4.0.2 | Environment variable and configuration module | runtime |
| `@nestjs/core` | ^11.0.0 | NestJS application bootstrap | runtime |
| `@nestjs/jwt` | ^11.0.0 | JWT signing and verification for authentication | runtime |
| `@nestjs/mapped-types` | * | DTO type mapping utilities (PartialType etc.) | runtime |
| `@nestjs/platform-express` | ^11.0.0 | Express HTTP adapter for NestJS | runtime |
| `@prisma/client` | ^6.16.2 | Generated Prisma database client | runtime |
| `axios` | ^1.6.0 | HTTP client (available, not yet used in source) | runtime |
| `next` | ~15.2.4 | Next.js framework for frontend | runtime |
| `react` | 19.0.0 | React UI library | runtime |
| `react-dom` | 19.0.0 | React DOM renderer | runtime |
| `reflect-metadata` | ^0.1.13 | Decorator metadata support (required by NestJS) | runtime |
| `rxjs` | ^7.8.0 | Reactive extensions (required by NestJS internals) | runtime |

---

## Development Dependencies

### Nx Monorepo

| Package | Version | Purpose | Type |
|---|---|---|---|
| `nx` | 21.5.2 | Monorepo task runner and workspace orchestration | build |
| `@nx/devkit` | 21.5.2 | Nx developer utilities | build |
| `@nx/eslint` | 21.5.2 | Nx ESLint plugin | build |
| `@nx/eslint-plugin` | 21.5.2 | Nx-specific ESLint rules | build |
| `@nx/jest` | 21.5.2 | Nx Jest plugin | build |
| `@nx/js` | 21.5.2 | Nx JavaScript/TypeScript utilities | build |
| `@nx/nest` | ^21.5.2 | Nx NestJS plugin | build |
| `@nx/next` | ^21.5.2 | Nx Next.js plugin | build |
| `@nx/node` | 21.5.2 | Nx Node.js plugin | build |
| `@nx/playwright` | 21.5.2 | Nx Playwright E2E plugin | test |
| `@nx/web` | 21.5.2 | Nx web utilities | build |
| `@nx/webpack` | 21.5.2 | Nx webpack plugin | build |
| `@nx/workspace` | 21.5.2 | Nx workspace utilities | build |

### Build Tools

| Package | Version | Purpose | Type |
|---|---|---|---|
| `webpack-cli` | ^5.1.4 | webpack command-line builder for backend | build |
| `prisma` | ^6.16.2 | Prisma CLI for migrations and code generation | build |
| `typescript` | ~5.9.2 | TypeScript compiler | build |
| `ts-node` | 10.9.1 | TypeScript execution for Node.js | build |
| `tslib` | ^2.3.0 | TypeScript runtime helpers | build |
| `@swc-node/register` | ~1.9.1 | SWC Node.js register | build |
| `@swc/cli` | ~0.6.0 | SWC command-line compiler | build |
| `@swc/core` | ~1.5.7 | SWC compiler core | build |
| `@swc/helpers` | ~0.5.11 | SWC runtime helpers | build |

### Testing

| Package | Version | Purpose | Type |
|---|---|---|---|
| `jest` | ^30.0.2 | Test runner for unit and integration tests | test |
| `ts-jest` | ^29.4.0 | TypeScript transform for Jest | test |
| `babel-jest` | ^30.0.2 | Babel transform for Jest | test |
| `jest-environment-node` | ^30.0.2 | Node.js test environment | test |
| `jest-environment-jsdom` | ^30.0.2 | JSDOM test environment for React tests | test |
| `jest-util` | ^30.0.2 | Jest utility functions | test |
| `@nestjs/testing` | ^11.0.0 | NestJS testing module | test |
| `@playwright/test` | ^1.36.0 | Playwright E2E test framework | test |
| `@testing-library/react` | 16.1.0 | React component testing utilities | test |
| `@testing-library/dom` | 10.4.0 | DOM testing utilities | test |
| `@types/jest` | ^30.0.0 | TypeScript types for Jest | test |
| `@types/react` | 19.0.0 | TypeScript types for React | development |
| `@types/react-dom` | 19.0.0 | TypeScript types for React DOM | development |
| `@types/node` | 20.19.9 | TypeScript types for Node.js | development |

### Frontend Styling

| Package | Version | Purpose | Type |
|---|---|---|---|
| `tailwindcss` | 3.4.3 | Utility-first CSS framework | build |
| `postcss` | 8.4.38 | CSS transformation pipeline | build |
| `autoprefixer` | 10.4.13 | CSS vendor prefix automation | build |

### Code Quality

| Package | Version | Purpose | Type |
|---|---|---|---|
| `eslint` | ^9.8.0 | Static code analysis | development |
| `@eslint/js` | ^9.8.0 | ESLint JavaScript rules | development |
| `@eslint/compat` | ^1.1.1 | ESLint compatibility utilities | development |
| `@eslint/eslintrc` | ^2.1.1 | ESLint config format compatibility | development |
| `typescript-eslint` | ^8.40.0 | TypeScript ESLint rules | development |
| `eslint-config-next` | ^15.2.4 | Next.js ESLint configuration | development |
| `eslint-config-prettier` | ^10.0.0 | Disable ESLint rules that conflict with Prettier | development |
| `eslint-plugin-import` | 2.31.0 | ESLint import/export rules | development |
| `eslint-plugin-jsx-a11y` | 6.10.1 | JSX accessibility rules | development |
| `eslint-plugin-playwright` | ^1.6.2 | ESLint rules for Playwright tests | development |
| `eslint-plugin-react` | 7.35.0 | React-specific ESLint rules | development |
| `eslint-plugin-react-hooks` | 5.0.0 | React Hooks ESLint rules | development |
| `@next/eslint-plugin-next` | ^15.2.4 | Next.js-specific ESLint rules | development |
| `@nestjs/schematics` | ^11.0.0 | NestJS code generation schematics | development |
| `prettier` | ^2.6.2 | Code formatter | development |
