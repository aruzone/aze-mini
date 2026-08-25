# The Demo, and how to delete it

The Starter ships a Demo: a small product catalogue, a seeded User, and one machine-to-machine route. It exists to show a pattern once. It is read and then deleted — never extended.

This page is the inventory. Deleting everything listed here, and making the edits below, should leave a Starter that still builds, still passes `nx run-many -t test lint build`, and still registers and authenticates a User.

The order to work in and how to check the result are at the bottom, under **Doing it**.

## Delete

| Path | What it is |
| --- | --- |
| `libs/demo-contracts/` | The catalogue's shapes on the wire, and the `@aze-mini/demo-contracts` entry in `tsconfig.base.json` `paths` that names it |
| `apps/aze-api/src/product/` | The whole catalogue: products, categories, reviews, tags — controllers, services and DTOs. `demo-contracts.spec.ts` in it is what checks nothing outside points at the package above |
| `apps/aze-api/prisma/seed.ts` | Seeds the Demo User and catalogue |
| `apps/aze-api/prisma/seed.spec.ts` | Covers that seed |
| `apps/aze-api-e2e/src/aze-api/validation.spec.ts` | Exercises validation through catalogue routes |
| `apps/aze-api-e2e/src/aze-api/cache.spec.ts` | Proves the catalogue read path is cached and invalidated |
| `apps/aze-api-e2e/src/aze-api/missing-records.spec.ts` | Drives the missing-relation 404s through catalogue routes |
| `apps/aze-api-e2e/src/aze-api/referenced-rows.spec.ts` | Drives the RESTRICT 409s through catalogue routes |
| `apps/aze-api-e2e/src/support/catalogue.ts` | Creates the catalogue rows those specs set up with |
| `apps/aze-client/src/app/catalogue/` | The authenticated page that lists the catalogue |
| `deploy/` | The Helm chart and the Argo CD Application — barebones, and Demo (ADR-0006, `deploy/README.md`). Keep them if you want the shape; they are yours to rewrite either way |
| `apps/aze-client/src/app/api/hello/` | The example Next.js route handler |

## Edit rather than delete

| Where | What to do |
| --- | --- |
| `apps/aze-api/prisma/schema.prisma` | Drop the `Product`, `ProductCategory`, `Review` and `Tag` models, keep `User`, then run a migration |
| `apps/aze-api/src/app/app.module.ts` | Drop the `ProductsModule` import — the other three modules nest inside it |
| `apps/aze-api/prisma.config.ts` | Drop the `migrations.seed` entry along with the seed file |
| `apps/aze-api/src/config/pipes/validation.pipe.spec.ts` | It validates against `CreateProductDto`; point it at a DTO you keep — `RegisterDto` does the job — and rewrite the bodies it sends to match that DTO's fields, or the suite will not compile and then will not pass |
| `apps/aze-client/src/app/page.tsx` | Drop the link to `/catalogue` |
| `apps/aze-api/src/config/decorators/machine-to-machine.decorator.ts` | Keep the decorator if you want key auth; its only use is `POST /products`, which goes with the catalogue (ADR-0002) |
| `apps/aze-api-e2e/src/aze-api/perimeter.spec.ts` | Its machine-to-machine cases, and "protects a route that opts out of nothing", reference catalogue routes; point them at a route you keep |
| `apps/aze-api-e2e/src/aze-api/docs.spec.ts` | It pins the full endpoint list, which shrinks |
| `apps/aze-client-e2e/src/session.spec.ts` | Its last two cases sign in and then read the catalogue; the rest are Platform and stay. The seeded credentials at the top go with the seed |

### The contracts, which are two packages

`libs/platform-contracts/` is Platform and stays: the auth requests, the token they answer with, the current User, and the envelope every refusal arrives in. `libs/demo-contracts/` is Demo and goes. The `tier:` tags on those two projects are what stop the first coming to depend on the second, and `demo-contracts.spec.ts` is what stops the API's Platform code doing the same — see ADR-0006 — so the deletion above is a deletion rather than an edit.

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

## Doing it

The order matters only in that the database goes last — a migration that drops
tables while code still selects from them fails in the least helpful way.

1. **Delete the paths** in the first table.
2. **Make the edits** in the second. `nx run-many -t lint build --all` will name
   anything you missed; every one of them is an import that no longer resolves.
3. **Drop the models.** Remove `Product`, `ProductCategory`, `Review` and `Tag`
   from `prisma/schema.prisma`, keep `User`, then `npx prisma migrate dev --name
   remove-demo`. Check the generated SQL before you apply it anywhere that
   matters — it drops tables.
4. **Delete the Demo User** if the seed ever ran against something real.

### Checking

```bash
nx run-many -t lint test build --all
nx e2e aze-api-e2e        # needs Postgres and Redis
nx e2e aze-client-e2e     # needs both apps running
```

Then, by hand: register a new User, sign in as them, and land on the home page.
That path is Platform from end to end and is what the Starter is actually for.

### What should be left

The whole Platform, still working: registration and login, the request
perimeter and its guards, the global validation pipe, the error envelope, the
session cookie and the redirect that enforces it, `CacheService` and Redis, the
database layer, the configuration check, the OpenAPI document, and CI.

`libs/platform-contracts` stays. `libs/demo-contracts` goes with the catalogue —
and the `tier:` tags are what guarantee the first never came to depend on the
second (ADR-0006).
