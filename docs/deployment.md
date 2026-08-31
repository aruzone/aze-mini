# Before you deploy

The Starter works. That is not the same as being ready to carry someone's data,
and this page is the difference between the two.

Nothing below is a surprise we are apologising for — each one is a decision made
deliberately, written down so you inherit it knowingly. You own the result of
the clone outright, and there is no update path (ADR-0004): whatever is true
here at the moment you clone stays true for you until you change it.

## The checklist

### 1. Replace every credential

| Where | What ships | What it must become |
| --- | --- | --- |
| `apps/aze-api/.env` | `API_KEY` and `JWT_SECRET` as `your_..._here` placeholders | Real, random, per-environment values. The API refuses to start on the placeholders — that refusal is the only thing standing between you and shipping them |
| `docker-compose.yml` | `aze_local_password`, `compose_local_jwt_secret_change_me`, `compose_local_api_key_change_me` | Anything else. These are committed to a public repository and are public knowledge |
| `deploy/helm/aze/values.yaml` | Empty secret values, and a chart that refuses to render without them | A Secret you manage elsewhere, named in `secrets.existingSecret` |

A value passed to Helm with `--set` is kept in the release's own Secret in the
cluster, in the clear, for every revision Helm retains. Use sealed-secrets,
external-secrets, or your cloud's secret store, and point the chart at the
result.

### 2. Delete the Demo User

`npx prisma db seed` creates `demo@example.com` with a password printed on the
terminal and written in `prisma/seed.ts`. It is a real User with a real hash and
it keeps working after the catalogue is gone.

Delete it, or never run the seed against anything real. See
[docs/demo.md](demo.md).

### 3. Understand the token you are issuing

The token lifecycle is rotating refresh sessions in Postgres
([ADR-0009](adr/0009-rotating-refresh-sessions-in-postgres.md)), spelled out in
`apps/aze-api/src/auth/refresh-sessions.ts`:

- **Access tokens live 15 minutes by default** (`ACCESS_TOKEN_TTL_SECONDS`).
  They are stateless JWTs, exactly as before (ADR-0002) — only shorter. A
  stolen one stops working on its own.
- **Refresh sessions live in the database.** `POST /auth/login` and
  `POST /auth/register` set an httpOnly `aze_refresh` cookie carrying an
  opaque 256-bit token. Only its SHA-256 hash is stored, with a family id, an
  absolute expiry of 30 days (`REFRESH_TOKEN_TTL_SECONDS`) and an idle expiry
  of 7 days (`REFRESH_IDLE_TTL_SECONDS`).
- **Every exchange rotates the token.** `POST /auth/refresh` swaps the
  presented cookie for a fresh access token and a new refresh token in the
  same family. Presenting a token that was already rotated or revoked revokes
  the entire family — that is what catches a stolen refresh token even when
  the attacker races the legitimate client.
- **Revocation is a row update.** Logout (`POST /auth/logout`) revokes the
  family the presented token belongs to; a password reset revokes every family
  the User has. Rotating `JWT_SECRET` is no longer the only way to sign
  anyone out.
- **The client refreshes silently.** `apps/aze-client/src/middleware.ts`
  exchanges the refresh cookie for a fresh pair on navigation, so a signed-in
  User never sees the sign-in screen because a quarter of an hour passed.

This store fails closed, deliberately: a session that cannot be verified
against the rows is denied, never waved through. The cache's fail-open policy
(ADR-0005) does not apply here.

### 4. Name your own CORS origin

`CORS_ORIGIN` is read from the environment. Unset, only `http://localhost:3000`
— the client a local clone starts — is allowed, which is right locally and wrong
everywhere else. Several are allowed, comma separated:

```
CORS_ORIGIN="https://app.example.com,https://admin.example.com"
```

`*` is passed through as itself and allows every origin. Setting it also turns
**credentials off**, because a browser refuses `Access-Control-Allow-Origin: *`
together with credentials and would fail every cross-origin call for a reason
neither setting names. So `*` means: any page anywhere may call your API, and
none of them may send a cookie while doing it. That is rarely what anyone
wants.

Note what does *and does not* depend on this. The client's own pages call the API
from the Next **server**, not the browser, so they are unaffected by CORS
entirely. This matters for anything else that calls the API from a browser —
another front end, the interactive docs page, a mobile web view.

### 4a. Tell the API what is in front of it

`TRUST_PROXY` decides whether `X-Forwarded-For` is believed, and it is `false` by
default. That default is right when nothing proxies the API and wrong the moment
something does:

- **Untrusted behind a proxy** — every request appears to come from the proxy, so
  login throttling counts the whole world in one bucket and one attacker locks
  everybody out.
- **Trusted with nothing in front** — the header is caller-supplied, so an
  attacker picks a fresh address per request and is never throttled at all.

Set it to the number of proxies actually in front of the API — `1` for a single
Ingress or load balancer. The Helm chart defaults to `1` for that reason; count
your own hops if you have more.

### 5. Decide about the API documentation

`API_DOCS` serves an interactive page at `/api/docs` describing every route.
Unset, it is on everywhere except production. The Helm chart sets it to
`"false"`.

It requires no credential to read. That is fine for a public API and a poor idea
for an internal one.

### 6. Read the chart before it carries anything

`deploy/helm/aze` is **barebones and Demo**. It renders two Deployments, two
Services and a migration hook. It renders no Ingress, no TLS, no
NetworkPolicy, no PodDisruptionBudget, no autoscaler, and no database.

[deploy/README.md](../deploy/README.md) has the full table of what it leaves to
you and why. Until there is TLS in front of it, the session cookie's `secure`
flag is protecting nothing.

### 7. Bring your own database and cache

Postgres and Redis are in `docker-compose.yml` for local work and are not in the
chart. A database wants backups, failover and an upgrade path that a Deployment
in a barebones chart would not give it. Use a managed service or an operator.

Nothing here backs anything up.

### 8. Know what the perimeter does

- Every route requires a bearer token unless it opts out with `@Public()`
  (ADR-0002). The health routes, the metrics endpoint, login, registration and
  the email-flow routes carry it.
- `POST /products` uses an API key instead, via `@MachineToMachine()`.
- **Every route sits behind a perimeter throttle** — 100 requests per minute
  per source by default (`THROTTLE_PER_MINUTE`), shared across replicas
  through Redis ([ADR-0010](adr/0010-throttling-fails-closed-in-two-layers.md)).
  The health and metrics routes are exempt: probes and scrapers must not eat
  the budget, and they must answer even while Redis is down. Per-route
  overrides use `@Throttle()` from `@nestjs/throttler` — that is the
  vocabulary to use for an expensive route of your own.
- **Registration stays open, throttled tighter** — 5 per source per minute by
  default (`REGISTRATIONS_PER_MINUTE`). Closing it remains your change to
  make; the Starter ships open, throttled, and honest about it.
- **Failed sign-ins are counted per source and User** — 5 failures per
  source-and-User pair, 20 per source alone, window from the first failure.
  The counters are Redis `INCR` now, in
  `apps/aze-api/src/auth/login-attempts.ts`, so two replicas share one budget.
- **Both limiters fail closed.** When Redis cannot answer, throttled routes
  answer 503 and sign-ins are refused — never waved through. A limiter that
  fails open is one an attacker disables by taking Redis down. This is the
  mirror of the cache's fail-open (ADR-0005): speed fails open, authorization
  fails closed, and the two are never one policy. It is also why Redis is
  required, not optional, for the full experience.
- **Unverified Users may sign in.** Registration sends a verification email,
  and `verifiedAt` rides in the token claims — but nothing blocks sign-in on
  it ([ADR-0011](adr/0011-email-flows-with-an-open-verification-gate.md)). If
  you want the gate, refuse the login when `verifiedAt` is null: a one-line
  change at the login check, no schema change.
- **The client's CSP is strict.** The middleware mints a per-request nonce,
  and `script-src` carries it with `strict-dynamic`
  (`apps/aze-client/src/middleware.ts`).
- **Email flows are built in** ([ADR-0011](adr/0011-email-flows-with-an-open-verification-gate.md)).
  Password reset and address verification share one token machine
  (`apps/aze-api/src/auth/email-tokens.ts`) and three public routes under the
  fail-closed throttles. The reset flow is enumeration-safe end to end, and
  reset links are built from `APP_ORIGIN`, never from the request's `Host`
  header. Outbound mail goes over plain SMTP from `SMTP_URL`; unset — or
  anywhere outside production — and the mail is written into the JSON log
  instead, so a fresh clone runs the whole flow with no SMTP server and reads
  the tokens off the console.

### 9. Run it as a non-root user with a read-only root

All three images already do — the API, the client, and the `migrator` stage the
migration job runs — and the chart sets `readOnlyRootFilesystem` on every
workload, including the job that holds `DATABASE_URL`. If you change the
images, keep that.

### 10. Observe it

The fork you deploy ships with the observability it needs on day one, spelled out in the places it lives:

- **Logs are JSON.** Every request logs one structured line under a `requestId` echoed as `X-Request-Id` — the same id the exception filter puts on the log of any 5xx it answers. `authorization`, `x-api-key` and `cookie` headers are redacted by the logger, not trusted to each log call. `LOG_LEVEL` (optional, default `info`) decides how much; a value that is none of pino's levels is refused at startup. The wiring is `apps/aze-api/src/config/logging.ts` and nowhere else.
- **Probes exist.** `GET /api/health/live` answers whenever the process is up. `GET /api/health/ready` answers 200 only while Postgres answers a `SELECT 1`; the cache is reported in the body but never gates readiness, because it fails open ([ADR-0005](adr/0005-redis-cache-fails-open.md)) and a deployment without its cache still serves. The chart wires both: the API Deployment's liveness probe hits `/api/health/live` and its readiness probe `/api/health/ready`, and a PodDisruptionBudget per Deployment keeps a drain from taking the last pod of either — [deploy/README.md](../deploy/README.md) has what it still leaves to you.
- **Metrics are opt-in.** `GET /api/metrics` serves the Prometheus exposition once `METRICS_ENABLED=true`, and refuses with 404 until then. It names routes and carries process internals, so it is off by default the way `API_DOCS` is; turn it on for the thing that scrapes it.
- **Error tracking has one hook point.** The 5xx branch of `apps/aze-api/src/config/filter/api-exception.filter.ts` is where every unexplained failure passes through and the last place the cause exists. Adding `Sentry.captureException` — or anything else — there is the whole integration.

## The short version

| | State |
| --- | --- |
| Tokens signed, expiry enforced | ✅ 15-minute access tokens (`ACCESS_TOKEN_TTL_SECONDS`) |
| Token revocation | ✅ row-level, per family or per User ([ADR-0009](adr/0009-rotating-refresh-sessions-in-postgres.md)) |
| Refresh tokens | ✅ rotating, hashed at rest, httpOnly cookie |
| Login rate limiting | ✅ per source and User, shared through Redis |
| Rate limiting elsewhere | ✅ perimeter throttle, fail-closed ([ADR-0010](adr/0010-throttling-fails-closed-in-two-layers.md)) |
| Security headers | ✅ both apps; client CSP is strict with a per-request nonce |
| Email verification and reset | ✅ built in; mail over `SMTP_URL`, logged locally when unset ([ADR-0011](adr/0011-email-flows-with-an-open-verification-gate.md)) |
| Structured logs | ✅ pino, JSON with `requestId` — `LOG_LEVEL` tunes it |
| Readiness / liveness probes | ✅ `/api/health/live`, `/api/health/ready` |
| Metrics endpoint | ⚠️ opt-in — `METRICS_ENABLED=true` |
| Error tracking | ⚠️ a named hook point in the exception filter; bring your own |
| Proxy awareness | ⚠️ `TRUST_PROXY`, and you must set it |
| Secrets by reference in the chart | ✅ |
| TLS / Ingress | ❌ yours to write |
| Database backups | ❌ yours to arrange |
| Migrations on deploy | ✅ Helm pre-upgrade hook |
| Images run as non-root | ✅ |
