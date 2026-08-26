# Interfaces

Every route the API serves, under the global prefix `/api` on port 3030.

`npm run check:docs` compares this page to the controllers: a route that is
served and not listed here, listed here and not served, or listed with the wrong
guard, fails the check. The **Guard** column is derived from the decorators, so
it cannot say one thing while the code does another.

The same routes are described in machine-readable form at `/api/docs-json`, with
the interactive page at `/api/docs`.

## Guards

| Guard | What it means |
| --- | --- |
| **JWT** | `Authorization: Bearer <token>`, verified by the global `AuthGuard` ([ADR-0002](adr/0002-fail-closed-auth-guard.md)). This is the default: a route is here unless it opts out |
| **None** | `@Public()` — no credential. Only the health route, registration and login |
| **API key** | `@MachineToMachine()` — `x-api-key` matching `API_KEY`. It replaces the JWT guard rather than stacking on top of it |

Every refusal, whatever raised it, arrives in one envelope —
`{ statusCode, timestamp, path, message }`, the `ApiErrorResponse` contract —
where `message` is a string for a single failure and an array of strings for a
field list. A caller has to accept both.

No route accepts a type generated from the Prisma schema. Request bodies are DTO
classes under each feature's `dto/`, each declared `implements` against a
contract in `libs/`, and relations cross the wire as flat ids.

---

## Platform

These routes are what an Adopter keeps.

| Route | Guard | Body | Answers |
| --- | --- | --- | --- |
| `GET /api` | None | — | `{ message: string }`. The health route, and what the container healthcheck and the chart's probes call |
| `POST /api/auth/register` | None | `RegisterDto` — `email`, `password`, optional `name` | `AuthResponse` — `{ userId, email, accessToken }`. Creates the User with a bcryptjs hash. Registration is open ([docs/deployment.md](deployment.md) §8) |
| `POST /api/auth/login` | None | `LoginDto` — `email`, `password` | `AuthResponse`. Answers 200, not 201. Failures are throttled per source and User; the source is `@Ip()`, which depends on `TRUST_PROXY` |
| `GET /api/users/me` | JWT | — | `UserProfile` — the User the token identifies. There is no route to any other User, and no route here creates one |

## Demo

The catalogue, deleted with the rest of the Demo ([docs/demo.md](demo.md)).

### Products

| Route | Guard | Body | Answers |
| --- | --- | --- | --- |
| `POST /api/products` | API key | `CreateProductDto` — `name`, `price`, `categoryId`, optional `description` and `tagIds` | The created `Product`. The one machine-to-machine route in the Starter |
| `GET /api/products` | JWT | — | `Product[]`. Takes `sort` (`asc` \| `desc`, default `asc`) and `limit` (positive integer, default 10). Cached, and answers `X-Cache: HIT` or `MISS` |
| `GET /api/products/:id` | JWT | — | One `Product`, or 404. Cached, and answers `X-Cache` |
| `PATCH /api/products/:id` | JWT | `UpdateProductDto` — every `CreateProductDto` field, optional | The updated `Product`. `tagIds` replaces the linked Tags rather than adding to them. Invalidates the cache |
| `DELETE /api/products/:id` | JWT | — | The deleted `Product`, or 409 naming the Reviews still pointing at it. Invalidates the cache |

### Categories

| Route | Guard | Body | Answers |
| --- | --- | --- | --- |
| `POST /api/categories` | JWT | `CreateProductCategoryDto` — `name` | The created `ProductCategory`, or 409 if the name is taken |
| `GET /api/categories` | JWT | — | `ProductCategory[]` |
| `GET /api/categories/:id` | JWT | — | One `ProductCategory`, or 404 |
| `PATCH /api/categories/:id` | JWT | `UpdateProductCategoryDto` — `name`, optional | The updated `ProductCategory` |
| `DELETE /api/categories/:id` | JWT | — | The deleted `ProductCategory`, or 409 naming the Products still in it |

### Reviews

| Route | Guard | Body | Answers |
| --- | --- | --- | --- |
| `POST /api/review` | JWT | `CreateReviewDto` — `rating`, `productId`, optional `comment` | The created `Review`, or 404 naming `productId` when no such Product exists |
| `GET /api/review/:id` | JWT | — | One `Review`, or 404 |
| `PATCH /api/review/:id` | JWT | `UpdateReviewDto` — every `CreateReviewDto` field, optional | The updated `Review` |
| `DELETE /api/review/:id` | JWT | — | The deleted `Review` |

### Tags

| Route | Guard | Body | Answers |
| --- | --- | --- | --- |
| `POST /api/tag` | JWT | `CreateTagDto` — `name`, optional `productIds` | The created `Tag`, or 409 if the name is taken |
| `GET /api/tag` | JWT | — | `Tag[]` |
| `GET /api/tag/:id` | JWT | — | One `Tag`, or 404 |
| `PATCH /api/tag/:id` | JWT | `UpdateTagDto` — every `CreateTagDto` field, optional | The updated `Tag`. `productIds` replaces the linked Products rather than adding to them |
| `DELETE /api/tag/:id` | JWT | — | The deleted `Tag` |

---

## The client's own routes

| Route | What it is |
| --- | --- |
| `/` | The authenticated home page, reading `GET /api/users/me` from the Next server |
| `/login` | The sign-in form. The only page that renders without a session, and what the container healthcheck calls |
| `/catalogue` | Demo: the catalogue, read from the API server-side |
| `/api/hello` | A Next route handler returning a static string. Demo |

The client never calls the API from the browser. `src/lib/api.ts` is the one
place it calls it at all, always from the server, so the token stays in an
`httpOnly` cookie that browser script cannot read.
