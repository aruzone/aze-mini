# The production-readiness roadmap

This is the Starter's own answer to "what does production-grade mean here":
a prioritized list of the remaining work, each item carrying a decided
approach so an implementer can pick any of them and build without
re-litigating a decision. It was found the way anything in this repository
should be — as decisions, recorded before work — across
[this map](https://github.com/aruzone/aze-mini/issues/68) and the seven ADRs
it produced ([0008](adr/0008-pino-logging-opt-in-metrics-and-a-named-error-hook.md)
through [0012](adr/0012-audit-trail-compliance-posture.md)).

The ordering principle is Adopter prod-risk: what a fork needs before it
carries real Users first, what it needs as the product grows second, guidance
it reads rather than builds third. The Starter is clone-and-own
([ADR-0004](adr/0004-clone-and-own-no-update-path.md)); every item is judged
by whether an Adopter's fork reaches production *because of it*.

Two constraints bind every item, inherited from the map: the wire shapes
enter through the contracts system ([ADR-0006](adr/0006-contracts-as-types-split-by-tier.md),
[ADR-0007](adr/0007-responses-documented-from-the-contracts.md)), and the
pedagogical character holds — one file spells the pattern out, the Demo stays
a clean delete, and a change that contradicts an ADR updates the ADR. New
routes arrive documented in [docs/interfaces.md](interfaces.md), and
`npm run check:docs` holds the documents to the code.

## Shipped

- **Observability** — pino JSON logging with a per-request id echoed as
  `X-Request-Id`, opt-in metrics, liveness and readiness routes, and the named
  error-tracking hook ([ADR-0008](adr/0008-pino-logging-opt-in-metrics-and-a-named-error-hook.md)).
  Implemented and merged; the remaining chart wiring is Tier 1's first item.

## Tier 1 — before the fork carries real Users

### 1. Probes and a disruption budget in the chart

**Problem.** The chart renders no probes, so an orchestrator restarts pods
arbitrarily and cannot tell a live process from a ready one; two replicas and
no budget means a node drain can take both.

**Decided.** The API Deployment gains a liveness probe on
`GET /api/health/live` and a readiness probe on `GET /api/health/ready`
(Postgres gates readiness; the cache never does), the client Deployment a
liveness probe on `/login`, and a PodDisruptionBudget with
`minAvailable: 1`, flag-gated, default on — decided in
[the chart-graduation ticket](https://github.com/aruzone/aze-mini/issues/75).
Touched: `deploy/helm/aze/templates/` (two probe blocks, one new budget), the
README's "leaves to you" table. No next decision.

### 2. The token lifecycle

**Problem.** One JWT lives a day with no refresh and no revocation; a stolen
token is valid until it expires and only rotating `JWT_SECRET` revokes
anything.

**Decided.** Rotating refresh sessions in Postgres
([ADR-0009](adr/0009-rotating-refresh-sessions-in-postgres.md)): short-lived
access JWTs (15 minutes), opaque refresh tokens hashed at rest in a
`RefreshToken` table with family ids, rotation on every exchange, family
revocation on reuse, logout revoking the presented family, an httpOnly refresh
cookie the client's server actions rotate silently, and lifetimes
environment-configurable. The refresh and logout endpoints arrive documented,
and the deployment doc's token section is rewritten with the code. Touched:
`apps/aze-api/prisma/schema.prisma`, the auth module, the auth contracts in
`libs/platform-contracts`, `src/lib/session.ts` and `src/app/actions.ts` in
the client, [docs/deployment.md](deployment.md). No next decision.

### 3. Throttling, failing closed

**Problem.** Login throttling counts in one process (two replicas, two
budgets) and no other route is limited at all.

**Decided.** Two deliberate layers, both failing closed with 503
([ADR-0010](adr/0010-throttling-fails-closed-in-two-layers.md)): the official
NestJS throttler on the global guard with Redis storage (~100 requests/minute
per source default), and the login guard's two-counter shape kept in its one
file with its memory moved from the in-process map to Redis. Registration
stays open and gains its own tighter per-source throttle. Touched: the auth
module, the app module, the lockfile, [docs/deployment.md](deployment.md).
No next decision.

### 4. Email verification and password reset

**Problem.** There is no account recovery and no verified identity — a User
who loses a password is locked out forever, and registration is unverified.

**Decided.** Both flows as Platform
([ADR-0011](adr/0011-email-flows-with-an-open-verification-gate.md)): one
`EmailToken` table, 60-minute reset and 24-hour verification tokens
(single-use in-transaction, SHA-256 at rest, superseding), an
enumeration-safe reset that revokes every refresh family from item 2, three
public routes under item 3's throttles, and a one-file Nodemailer
`MailSender` from `SMTP_URL` that logs locally when unset. Unverified Users
may sign in; the refusing gate is a documented one-line change. Touched: the
schema, the auth module, the new mail module, the contracts,
`apps/aze-api/.env.example`, [docs/deployment.md](deployment.md). Depends on
items 2 and 3. No next decision.

### 5. The client's content-security-policy nonce

**Problem.** The client CSP sets `frame-ancestors`, `base-uri` and
`object-src` but its `script-src` is partial — the gap
[docs/deployment.md](deployment.md) names — so the one page a browser renders
runs without the strictest header.

**Decided.** Thread a per-request nonce through the App Router and tighten
`script-src` to it, in the client's layout and middleware. Client-side
telemetry is deliberately **not** in the roadmap: it is product surface with
no decided shape, recorded as Adopter-side. Touched: the client app. No next
decision.

## Tier 2 — as the product grows

### 6. The audit trail and its compliance posture

**Problem.** Nothing answers "who changed what" once the JSON logs have
rotated.

**Decided.** An append-only `audit_events` table written in the same Prisma
transaction as the mutation it records
([the feature triage](https://github.com/aruzone/aze-mini/issues/73)),
event floor of authentication events, authorization refusals and data
mutations, failing loudly-logged rather than 500. The posture
([ADR-0012](adr/0012-audit-trail-compliance-posture.md)): no in-product
viewer (SQL and a documented export hook are the interfaces), twelve months
default retention dropped by monthly partition, and erasure pseudonymizes the
acting User id — recorded as its own audit event — rather than ever deleting
rows. The account-deletion flow that triggers erasure is the one next
decision this item carries, taken when it is built. Touched: the schema, a
new audit module, the services that mutate, the contracts.

### 7. Pagination

**Problem.** Every list endpoint returns unbounded arrays, and an Adopter's
first real table outgrows that immediately.

**Decided.** A `Page<T>` contract (items plus an opaque cursor, no total
count, per Zalando's guidelines) and a small keyset cursor helper, taught on
the Demo product list whose `sort` and `limit` validation and cache keys
already exist. Touched: `libs/platform-contracts`, the products module, the
client catalogue. No next decision.

### 8. Background jobs

**Problem.** Anything slow — mail, thumbnails, exports — blocks a request
today, because there is nowhere to put it.

**Decided.** BullMQ behind `@nestjs/bullmq` on the existing Redis, with the
one rule that makes it not-the-cache: enqueue **fails closed** — a dropped
job is silent data loss, so a queue error is a 503, never a shrug (the mirror
of [ADR-0005](adr/0005-redis-cache-fails-open.md)). Workers run as a separate
process from the same image, and the chart gains the matching worker
Deployment. The Demo carries one exemplar job that deletes with the
catalogue. Touched: the lockfile, a new jobs module, the worker bootstrap,
`docker-compose.yml` and the chart. No next decision.

### 9. File storage

**Problem.** An Adopter's first upload either proxies bytes through the API
or invents a storage abstraction under deadline.

**Decided.** A two-method `Storage` seam — create an upload URL, name the
public URL — with presigned direct upload so file bytes never touch the API;
the upload-grant response is contracted, the Demo teaches the client flow
with a product image, and an Adopter on GCS swaps one implementation file.
Touched: a new storage module, one route, the contracts, the Demo. No next
decision.

### 10. Supply-chain gates in CI

**Problem.** The workflow an Adopter inherits scans nothing; a compromised
dependency ships silently.

**Decided.** Dependency scanning and an SBOM step join the existing CI job —
it reads no secrets and runs in a fork unchanged, so the gates do too. Load
testing is deliberately documented-only: a shipped k6 suite would encode
traffic thresholds the Starter cannot know. Touched:
`.github/workflows/ci.yml`. No next decision.

## Tier 3 — documented, nothing built

Each of these is a decision already made about where the work **stops**: the
Starter writes the guidance, an Adopter writes the cluster config.

- **Ingress and TLS** — no template (one that renders nothing by default
  teaches nothing); [docs/deployment.md](deployment.md) gains a worked
  example pointing at the two Services.
- **Backups** — a documented Adopter choice (managed PITR, pgBackRest to
  object storage); the chart will not back up a database it refuses to run.
- **Autoscaling and network policy** — guidance; an HPA needs the Adopter's
  load profile and policies encode the cluster's posture.
- **API versioning** — a compatible-extensions policy now (add-only, never
  re-semantic a field); NestJS URI versioning at the first breaking change.
- **Outbound webhooks** — a recipe on the Tier 2 queue: one job per
  subscribed endpoint, HMAC signing against the raw body, exponential
  backoff. Building delivery machinery is out of scope.
- **Load testing** — guidance (k6 against the readiness route); thresholds
  are the Adopter's.
- **SSO, OIDC and MFA** — the documented next direction past the Starter's
  own auth, which the token and email decisions were shaped not to block.
- **Client-side telemetry** — Adopter-side, named here so its absence is
  known rather than discovered.
