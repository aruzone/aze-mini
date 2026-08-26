# Aze Starter

![The Aze logo](apps/aze-client/public/assets/aze-logo.png)

[![CI](https://github.com/aruzone/aze-mini/actions/workflows/ci.yml/badge.svg)](https://github.com/aruzone/aze-mini/actions/workflows/ci.yml)

A **highly opinionated** full-stack starter, built to be worked on by people and
by coding agents: an **Nx** monorepo with a **Next.js** client, a **NestJS**
API, **Prisma** on **Postgres**, a **Redis** cache, Docker images, a **Helm**
chart and an **Argo CD** Application.

Clone it, delete the Demo, and build your own thing on what is left.

## Opinionated on purpose

A starter usually hands you a pile of choices. This one has already made them,
and each is written down where you can find it and argue with it:

- **One database.** Postgres, with no file-based fallback ([ADR-0001](docs/adr/0001-postgres-only.md)).
- **Auth fails closed.** Every route needs a token unless it explicitly opts out ([ADR-0002](docs/adr/0002-fail-closed-auth-guard.md)).
- **The cache fails open.** If Redis is down the API is slower, not broken ([ADR-0005](docs/adr/0005-redis-cache-fails-open.md)).
- **One shape for every error**, so a client has one thing to read — and the document says so once, referenced from every refusal ([ADR-0007](docs/adr/0007-responses-documented-from-the-contracts.md)).
- **The token never reaches browser JavaScript.** The client calls the API from its own server.
- **Contracts are plain types**, shared by both apps, tagged by tier and enforced by lint ([ADR-0006](docs/adr/0006-contracts-as-types-split-by-tier.md)).

Where a decision was a real trade-off, there is an ADR in
[docs/adr/](docs/adr/) saying which way it went and why. You own your clone —
disagree freely and change it.

### Platform and Demo

Two tiers, and the difference matters:

- **Platform** — what you keep and build on: auth, the request perimeter, the
  cache, the error envelope, the session, the CI.
- **Demo** — a product catalogue, a seeded User, one machine-to-machine route,
  the Helm chart. There to show a pattern once. Read it, then delete it.

**[docs/demo.md](docs/demo.md)** is the removal guide: the exact paths to
delete, the order to work in, and how to check that what is left still works.

### The Starter is a snapshot

When you clone this, you own the result outright. **There is no update path.**
Fixes made here later — including security fixes — will not reach your project,
and there is no supported way to pull them in.

Releases are tagged so you can tell what you started from, and that is all the
relationship there is ([ADR-0004](docs/adr/0004-clone-and-own-no-update-path.md)).
The security posture at the moment you clone is the posture you keep, which is
why the credential path here is held to a production bar — and why the parts
that are _not_ held to that bar say so out loud.

## What is already wired

| Area                           | What you get                                                                                                                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication                 | Register and login, passwords hashed with bcryptjs, signed JWTs with a one-day expiry, a `GET /users/me` that reads the verified token                                                                                                              |
| Login throttling               | Failed sign-ins counted two ways — per source **and** User, so a password cannot be guessed; per source alone, so one host cannot work through a list of Users. A success clears the count                                                          |
| Request perimeter              | A global guard every route passes through, an explicit `@Public()` opt-out, an API-key route for machine callers, and a validation pipe that refuses an undeclared field by name rather than dropping it                                            |
| One error envelope             | Every refusal answers `{ statusCode, timestamp, path, message }`. Database failures are translated — a missing row is a 404, a unique collision a 409 naming the column                                                                             |
| Security headers               | Helmet on the API with a strict content policy, loosened only for the documentation page; headers on the client too                                                                                                                                 |
| CORS from the environment      | Allowed origins are configuration, not code. Defaults to the client a local clone starts                                                                                                                                                            |
| Proxy awareness                | What the API believes about `X-Forwarded-For` is explicit, because throttling counts on it                                                                                                                                                          |
| Caching with real invalidation | Redis behind one service. Keys, TTL and invalidation live in a single file, responses carry `X-Cache: HIT\|MISS`, and one deletion forgets every cached variant of a list at once                                                                   |
| Safe deletes                   | A delete blocked by a relation answers 409 naming the rows still pointing at it, instead of a 500                                                                                                                                                   |
| Startup configuration check    | The API names every missing or placeholder variable at once and refuses to start, before it connects to anything                                                                                                                                    |
| API documentation              | An interactive OpenAPI page at `/api/docs`, generated from the same decorators that guard the routes, with a schema on every request and every response, and switchable off per environment                                                         |
| Session handling               | The token lives in an `httpOnly`, `sameSite=lax` cookie; middleware redirects a signed-out visitor, so a page added later is protected by existing                                                                                                  |
| Shared contracts               | The shapes that cross the wire are declared once and used by both apps, with lint refusing a Platform dependency on the Demo                                                                                                                        |
| Tests at three levels          | Unit tests, API end-to-end tests against a real database and cache, and browser end-to-end tests                                                                                                                                                    |
| CI on every pull request       | Lint, test and build across affected projects, plus the API suite against real Postgres and Redis services. It reads no repository secrets, so it runs unchanged in a fork                                                                          |
| Containers                     | Multi-stage images for both apps, running as a non-root user, with a separate stage for migrations                                                                                                                                                  |
| Deployment readiness           | A compose stack that migrates before it serves; a Helm chart with a pre-upgrade migration hook, readiness and liveness probes, secrets by reference and a read-only root filesystem; Argo CD Applications for staging and production pointing at it |

## The stack

| Layer         | What is used                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Language      | TypeScript, everywhere                                                                                        |
| Monorepo      | Nx — one task runner, one dependency graph, affected-only CI                                                  |
| Client        | Next.js (App Router, React Server Components, server actions), React, Tailwind CSS                            |
| API           | NestJS on Express, with guards, pipes, filters and decorators                                                 |
| Database      | Postgres via Prisma — schema, migrations and a generated typed client                                         |
| Cache         | Redis via `cache-manager` and `@keyv/redis`                                                                   |
| Auth          | `@nestjs/jwt` for tokens, `bcryptjs` for password hashing ([ADR-0003](docs/adr/0003-bcryptjs-over-argon2.md)) |
| Validation    | `class-validator` and `class-transformer`, bound to explicit request classes                                  |
| Documentation | `@nestjs/swagger`, generated from the code that runs                                                          |
| Hardening     | Helmet, environment-driven CORS, in-process login throttling                                                  |
| Testing       | Jest, Testing Library, Playwright                                                                             |
| Quality       | ESLint, Prettier, and Nx module boundaries — a Platform import of Demo code fails lint                        |
| Build         | webpack for the API bundle, Next's standalone output for the client, SWC for speed                            |
| Ship          | Docker and Docker Compose, Helm, Argo CD, GitHub Actions                                                      |

## Layout

```
.
├── apps/
│   ├── aze-api/              NestJS API        → :3030/api
│   ├── aze-api-e2e/          API e2e (Jest)
│   ├── aze-client/           Next.js client    → :3000
│   └── aze-client-e2e/       Client e2e (Playwright)
├── libs/
│   ├── platform-contracts/   Wire shapes you keep    (tier:platform)
│   └── demo-contracts/       Wire shapes you delete  (tier:demo)
├── deploy/
│   ├── helm/aze/             Barebones chart for both apps
│   └── argocd/               One Application pointing at it
├── docs/
│   ├── adr/                  Decisions, and why
│   ├── agents/               Conventions coding agents follow here
│   ├── demo.md               How to strip the Demo
│   └── deployment.md         Before you deploy
├── tools/check-docs.mjs      Holds the documentation to the code
├── CONTEXT.md                The project's vocabulary
├── AGENTS.md                 The brief for coding agents
└── docker-compose.yml        Postgres, Redis, and both apps
```

## Getting started

Two ways in. Everything in Docker is fewer steps; the local toolchain is what
you want for day-to-day work.

Both are written up as runbooks a coding agent can follow unaided —
[docs/agents/run-docker.md](docs/agents/run-docker.md) and
[docs/agents/run-dev.md](docs/agents/run-dev.md). They carry the same steps as
below, plus what to check when it is up and the things that catch people out.

### Everything in Docker

Docker is the only prerequisite.

```bash
git clone https://github.com/aruzone/aze-mini.git
cd aze-mini

# Builds both images, starts Postgres and Redis, applies the migrations, and
# brings both apps up. --wait blocks until they are actually answering.
docker compose up -d --build --wait

# Optional: the Demo catalogue and a User to sign in as. Prints the login.
docker compose run --rm migrate npx prisma db seed
```

- Client → <http://localhost:3000>
- API → <http://localhost:3030/api>
- API docs → <http://localhost:3030/api/docs>

The compose file carries real, committed, public credentials for local use.
They are not secrets and are not fit to be. Replace them before running that
file anywhere but your own machine.

### The local toolchain

Node 24 (`.nvmrc` — `nvm use` picks it up) and Docker for Postgres and Redis.

```bash
npm install

# Postgres and Redis only. There is no file-based fallback (ADR-0001); the
# cache fails open, so the API still works without Redis (ADR-0005).
docker compose up -d --wait postgres redis

cd apps/aze-api
cp .env.example .env
# Replace API_KEY and JWT_SECRET. Both ship as placeholders and the API
# refuses to start while either is unedited.

npx prisma migrate dev   # applies migrations and regenerates the client
npx prisma db seed       # Demo catalogue and User; prints the login

cd ../..
nx serve aze-api         # → http://localhost:3030/api
nx dev aze-client        # → http://localhost:3000
```

Running a second clone at the same time? Give it its own project name and host
ports, then put those ports in that clone's `apps/aze-api/.env`:

```bash
POSTGRES_PORT=5433 REDIS_PORT=6380 docker compose -p aze-two up -d --wait
```

## Working on it

```bash
npm run lint                 # every project
npm test                     # every project's unit tests
npm run build                # both applications
npm run check:docs           # the documents, against the code they describe
npm run e2e:api              # API e2e — needs Postgres and Redis
npm run e2e:client           # client e2e — needs both apps running
```

Each wraps an Nx target, and Nx is there when you want to name one project:

```bash
nx test aze-api
nx test aze-api --testFile=src/app/app.service.spec.ts
nx run-many -t lint test build --all
```

The client e2e drives your installed Google Chrome, so nothing has to be
downloaded first.

## Built for coding agents

Agents write a lot of the code now, and they work from what a repository tells
them. This one is written to be read by both audiences:

- **[AGENTS.md](AGENTS.md)** — the working brief, and the canonical one: every
  command, the module layout, what each file is for, and the reasoning behind
  the arrangement. `CLAUDE.md` is a pointer at it, so no harness reads a
  different version of the truth.
- **Commands that need no local knowledge.** `npm run test`, `npm run lint`,
  `npm run build`, `npm run check:docs` — an agent that has never met Nx can
  work here from the first command.
- **[CONTEXT.md](CONTEXT.md)** — the project's vocabulary, including the words
  to avoid, so an agent's output uses the same terms the code does.
- **[docs/adr/](docs/adr/)** — the decisions already taken, so a change that
  contradicts one is caught as a contradiction rather than made by accident.
- **[docs/agents/](docs/agents/)** — the conventions to follow here: the issue
  tracker and its commands, the triage labels, how to read the domain docs, and
  a runbook for each way of running it — `run-docker.md` and `run-dev.md`.
- **One place per concern.** Cache keys and their invalidation, the database
  error codes, the API-key header name, the security headers, the environment
  check — each lives in a single named file, so a change is one edit rather
  than a search.
- **Rules a machine can check.** Lint refuses a Platform import of Demo code, a
  test reads the source to hold the same line inside the API, and request
  classes are declared against the shared contracts. An agent that drifts is
  told by CI, not by a reviewer.
- **Documentation that cannot quietly go stale.** `npm run check:docs` fails
  when a document names a file that is not there, points at a line number, or
  describes a route the API does not serve — `docs/interfaces.md` is compared
  route by route against the controllers, guard included. CI runs it on every
  pull request.
- **Comments explain why, not what.** The non-obvious choices — ordering,
  fail-open, fail-closed, the placeholder refusal — carry their reasoning where
  the code is, which is the context an agent reads before editing.

## Before you deploy

The Starter runs, migrates and deploys. Carrying real people's data asks for a
few more decisions, and they are listed rather than left for you to discover:
TLS and an Ingress, database backups, a general rate limit beyond login, token
revocation or refresh, throttle counts shared across replicas, and real secret
management.

**[docs/deployment.md](docs/deployment.md)** is that checklist, with a summary
table of what is already handled and what is still yours.

## What is worth reading

| Where                                                          | What is in it                             |
| -------------------------------------------------------------- | ----------------------------------------- |
| [docs/demo.md](docs/demo.md)                                   | The Demo, and how to delete it            |
| [docs/deployment.md](docs/deployment.md)                       | Before you deploy: the honest checklist   |
| [docs/adr/](docs/adr/)                                         | The decisions, and why they went that way |
| [docs/architecture-overview.md](docs/architecture-overview.md) | How the pieces fit                        |
| [docs/data-contracts.md](docs/data-contracts.md)               | The database's shapes, and the wire's     |
| [docs/interfaces.md](docs/interfaces.md)                       | Every route, with the guard on it         |
| [deploy/README.md](deploy/README.md)                           | The chart, and what it leaves to you      |
| [AGENTS.md](AGENTS.md)                                         | The brief every agent reads first         |
| [CONTEXT.md](CONTEXT.md)                                       | The vocabulary this project uses          |

## License

MIT. Use it for whatever you like.
