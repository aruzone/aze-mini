# Running it for development

The local toolchain: both apps served from your own Node with hot reload, with
Postgres and Redis in Docker. This is the path for day-to-day work. To just get
the stack running with no Node at all, see `docs/agents/run-docker.md`.

## Prerequisites

Node 24 (`.nvmrc`, and `package.json` engines pin the major) and Docker. Nothing
else is required — `libs/` are source libraries the app builds compile, so there
is no build step before serving.

## Set it up once

```bash
npm install

# Postgres is required — there is no file-based fallback (ADR-0001). Redis is
# not: the cache fails open, so an unreachable one costs speed only (ADR-0005).
docker compose up -d --wait postgres redis

cd apps/aze-api
cp .env.example .env
```

Now replace two values in that `.env`. The API names every missing or
placeholder variable at once and refuses to start while either still holds its
`your_..._here` shape:

```bash
openssl rand -hex 32    # once for API_KEY, again for JWT_SECRET
```

`DATABASE_URL` and `REDIS_URL` already match the compose services and need no
editing. Then, still in `apps/aze-api`:

```bash
npx prisma migrate dev   # applies the migrations and regenerates the client
npx prisma db seed       # Demo catalogue and User; prints the login; safe to re-run
```

Prisma commands run from `apps/aze-api` — `prisma.config.ts` lives there, names
the schema and the seed command, and loads the `.env` itself.

## Run it

```bash
npm run dev     # both apps through Nx
```

Or one at a time, in two terminals, when you want their output apart:

```bash
nx serve aze-api    # → http://localhost:3030/api
nx dev aze-client   # → http://localhost:3000
```

Both reload on save.

## Where it is

- Client → <http://localhost:3000>
- API → <http://localhost:3030/api>
- API docs → <http://localhost:3030/api/docs>

The seed prints the login: `demo@example.com` / `demo-password-change-me`.

## Check it answers

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3030/api
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/login
```

Both answer 200. A signed-out `GET /` on the client 307s to `/login`, and a
second `GET /api/products` answering `X-Cache: HIT` is the sign Redis is wired.

## Stop it

Interrupt the dev servers. The data services outlive them:

```bash
docker compose stop postgres redis   # keeps the volume
docker compose down -v               # drops the database; re-migrate and re-seed after
```

## Gotchas

- **The client needs no `.env` here.** `nx dev aze-client` falls back to
  `http://localhost:3030/api` when `AZE_API_URL` is unset. Copy
  `apps/aze-client/.env.example` only if you run `nx start aze-client`, the
  production build, which refuses to guess.
- **A schema change without a migration** is the only time to run a bare
  `npx prisma generate` — `migrate dev` regenerates the client itself.
- **npm 11.19 and later gate install scripts.** `npm install` may report that
  packages "have install scripts not yet covered by allowScripts" and skip
  them, Prisma's among them. Nothing here has needed them — the platform
  binaries arrive as optional dependencies and `prisma generate` runs
  explicitly — but `npm install-scripts approve <pkg>` is the fix if a native
  binary turns up missing.
- **Ports are taken by the Docker path.** `docker compose stop api client`
  frees 3000 and 3030 while leaving Postgres and Redis up.

## Working on it

```bash
npm run lint
npm test
npm run build
npm run check:docs    # the documents, against the code they describe
npm run e2e:api       # needs Postgres and Redis
npm run e2e:client    # needs both apps running
```

Each wraps an Nx target; `nx test aze-api` names one project.
