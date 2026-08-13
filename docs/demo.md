# The Demo, and how to delete it

The Starter ships a Demo: a small product catalogue, a seeded account, and one machine-to-machine route. It exists to show a pattern once. It is read and then deleted — never extended.

This page is the inventory. Deleting everything listed here should leave a Starter that still builds, still serves `/api`, and still registers and authenticates a User.

> A fuller removal guide, with the order to do it in and what to check afterwards, is #16. This list is what that guide will work from.

## Paths

| Path | What it is |
| --- | --- |
| `apps/aze-api/src/product/` | The whole catalogue: products, categories, reviews, tags — controllers, services and DTOs |
| `apps/aze-api/prisma/seed.ts` | Seeds the Demo User and catalogue |
| `apps/aze-api-e2e/src/aze-api/validation.spec.ts` | Exercises validation through catalogue routes |
| `apps/aze-client/src/app/api/hello/` | The example Next.js route handler |

## Things to edit rather than delete

| Where | What to do |
| --- | --- |
| `apps/aze-api/prisma/schema.prisma` | Drop the `Product`, `ProductCategory`, `Review` and `Tag` models, keep `User`, then run a migration |
| `apps/aze-api/src/app/app.module.ts` | Drop the `ProductsModule` import |
| `apps/aze-api/prisma.config.ts` | Drop the `migrations.seed` entry with the seed file |
| `apps/aze-api/src/config/decorators/machine-to-machine.decorator.ts` | Keep the decorator if you want key auth; its only use is `POST /products`, which goes with the catalogue (ADR-0002) |
| `apps/aze-api-e2e/src/aze-api/perimeter.spec.ts` | Its machine-to-machine and "protects a route that opts out of nothing" cases reference catalogue routes; point them at a route you keep |
| `apps/aze-api-e2e/src/aze-api/docs.spec.ts` | It pins the full endpoint list, which shrinks |

## The Demo account

`prisma/seed.ts` creates `demo@example.com` with a known password, printed when the seed runs. It is a real account with a real hash — the same path a visitor's registration takes — so it will keep working after you delete the catalogue.

Delete the account before deploying anywhere real. An Adopter keeps the security posture they cloned (ADR-0004), and that includes this one.
