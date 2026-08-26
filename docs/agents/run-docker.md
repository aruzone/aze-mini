# Running it in Docker

The fewest-steps way to a running API and client: Docker is the only
prerequisite. No Node, no `npm install`, no `.env` to edit. For day-to-day work
use the local toolchain instead — `AGENTS.md`, "Commands", or the same steps in
`README.md`.

## Start

```bash
docker compose up -d --build --wait
```

Builds both images, starts Postgres and Redis, runs the `migrate` service to
completion so a fresh volume is migrated before anything reads from it, then
brings up the API and the client. `--wait` blocks until the healthchecks pass,
so when it returns the stack is answering. The first build takes a few minutes;
drop `--build` when no code changed.

## Seed the Demo data

Optional — the catalogue and a User to sign in as. Safe to re-run.

```bash
docker compose run --rm migrate npx prisma db seed
```

It prints the login: `demo@example.com` / `demo-password-change-me`.

## Where it is

- Client → <http://localhost:3000>
- API → <http://localhost:3030/api>
- API docs → <http://localhost:3030/api/docs>

## Check it answers

```bash
docker compose ps    # every service healthy
docker compose logs -f api
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3030/api
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/login
```

Both curls answer 200. `X-Cache: HIT` on a second `GET /api/products` is the
sign Redis is wired.

## Stop

```bash
docker compose down       # keeps the database volume
docker compose down -v    # drops it — the next start migrates an empty database, so re-seed
```

## What this path does not use

- **`apps/aze-api/.env` is not read here.** `docker-compose.yml` sets every
  service's environment inline, so editing that file changes nothing about the
  containers — it belongs to the local toolchain path (`nx serve aze-api`,
  host-side `npx prisma`). To change what a container gets, edit
  `docker-compose.yml`.
- **The credentials in `docker-compose.yml` are committed and public.** They
  are local-only and are not fit to be anything else. Replace them before
  running that file anywhere but your own machine.

## When a port is taken

Every port is published on `127.0.0.1` and each is a variable, so a second
clone runs alongside this one under its own project name:

```bash
POSTGRES_PORT=5433 REDIS_PORT=6380 API_PORT=3031 CLIENT_PORT=3001 \
  docker compose -p aze-two up -d --wait
```
