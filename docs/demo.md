# The Demo, and how to delete it

The Starter ships a Demo: a small product catalogue, a seeded User, and one machine-to-machine route. It exists to show a pattern once. It is read and then deleted — never extended.

This page is the inventory. Deleting everything listed here, and making the edits below, should leave a Starter that still builds, still passes `nx run-many -t test lint build`, and still registers and authenticates a User.

> A fuller removal guide — the order to work in, and what to check afterwards — is #16. This list is what that guide will work from.

## Delete

| Path | What it is |
| --- | --- |
| `apps/aze-api/src/product/` | The whole catalogue: products, categories, reviews, tags — controllers, services and DTOs |
| `apps/aze-api/prisma/seed.ts` | Seeds the Demo User and catalogue |
| `apps/aze-api/prisma/seed.spec.ts` | Covers that seed |
| `apps/aze-api-e2e/src/aze-api/validation.spec.ts` | Exercises validation through catalogue routes |
| `apps/aze-api-e2e/src/aze-api/cache.spec.ts` | Proves the catalogue read path is cached and invalidated |
| `apps/aze-api-e2e/src/aze-api/missing-records.spec.ts` | Drives the missing-relation 404s through catalogue routes |
| `apps/aze-api-e2e/src/aze-api/referenced-rows.spec.ts` | Drives the RESTRICT 409s through catalogue routes |
| `apps/aze-api-e2e/src/support/catalogue.ts` | Creates the catalogue rows those specs set up with |
| `apps/aze-client/src/components/MyComponent.tsx` | Fetches and lists the catalogue from the API |
| `apps/aze-client/src/app/api/hello/` | The example Next.js route handler |

## Edit rather than delete

| Where | What to do |
| --- | --- |
| `apps/aze-api/prisma/schema.prisma` | Drop the `Product`, `ProductCategory`, `Review` and `Tag` models, keep `User`, then run a migration |
| `apps/aze-api/src/app/app.module.ts` | Drop the `ProductsModule` import — the other three modules nest inside it |
| `apps/aze-api/prisma.config.ts` | Drop the `migrations.seed` entry along with the seed file |
| `apps/aze-api/src/config/pipes/validation.pipe.spec.ts` | It validates against `CreateProductDto`; point it at a DTO you keep, or the suite will not compile |
| `apps/aze-client/src/app/page.tsx` | Drop the `MyComponent` import and the `<div id="products">` that renders it |
| `apps/aze-api/src/config/decorators/machine-to-machine.decorator.ts` | Keep the decorator if you want key auth; its only use is `POST /products`, which goes with the catalogue (ADR-0002) |
| `apps/aze-api-e2e/src/aze-api/perimeter.spec.ts` | Its machine-to-machine cases, and "protects a route that opts out of nothing", reference catalogue routes; point them at a route you keep |
| `apps/aze-api-e2e/src/aze-api/docs.spec.ts` | It pins the full endpoint list, which shrinks |
| `apps/aze-client-e2e/` | Its assertions follow whatever you leave on the page |

### The cache, which is both

`apps/aze-api/src/product/products/product-cache.ts` is the Demo of caching and goes with the rest of `src/product/`. Everything under `apps/aze-api/src/cache/` is Platform, along with the `redis` compose service: keep it, and nothing in it needs editing when the catalogue leaves. Read `product-cache.ts` once for the pattern — a key, a TTL, and a write that forgets what it changed — then write your own in front of your own read path (ADR-0005).

## Documentation that describes the Demo

These do not break anything if left, but they will describe models and routes that no longer exist.

| Where | What describes the Demo |
| --- | --- |
| `docs/interfaces.md` | The catalogue endpoints, in detail |
| `docs/data-contracts.md` | The `Product`, `ProductCategory`, `Review` and `Tag` entities, and the controller table |
| `docs/architecture-overview.md` | The `src/product/` feature group |
| `CLAUDE.md` | The `src/product/` bullet, the Demo tier note, and `npx prisma db seed` in the setup and Prisma sections |
| `README.md` | Whatever it says about the catalogue |

## The Demo User

`prisma/seed.ts` creates `demo@example.com` with a known password, printed when the seed runs. It is a real User with a real hash — written through the same function registration uses — so it keeps working after the catalogue is gone.

Delete that User before deploying anywhere real. An Adopter keeps the security posture they cloned (ADR-0004), and that includes this one.
