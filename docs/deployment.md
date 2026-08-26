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

`AuthModule` signs tokens with **`expiresIn: '1d'`**.

- **There is no revocation.** No deny-list, no session store, no `jti`. A signed
  token is valid until it expires, and that is the entire mechanism. A User who
  signs out has their cookie cleared; the token itself remains valid for the
  rest of the day to anyone who captured it.
- **There is no refresh token.** One token, one day, then sign in again.
- **Rotating `JWT_SECRET` is your revocation.** It invalidates every token at
  once, including everyone else's.

If any of that is unacceptable for what you are building — and for anything
holding real Users it probably is — shorten the expiry, add a refresh token,
and put a revocation check somewhere. Decide this before launch, not after an
incident.

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
  (ADR-0002). Three do: the health route, login, and registration.
- `POST /products` uses an API key instead, via `@MachineToMachine()`.
- **Registration is open.** Anyone who can reach `/auth/register` can create a
  User. If that is not what you want, that is your change to make.
- **Failed sign-ins are throttled; nothing else is.** Registration, and every
  other route, can be called as fast as a caller likes. A general rate limit is
  still yours to add.
- **The throttle counts in one process.** Two replicas mean two counts, so an
  attacker spread across them gets twice the attempts. Moving the counts to
  Redis is the fix — and note that it must *not* inherit the cache's fail-open
  policy (ADR-0005), or an attacker disables the limiter by taking Redis down.
  `apps/aze-api/src/auth/login-attempts.ts` says the same thing where it lives.
- **The client's CSP is partial.** `frame-ancestors`, `base-uri` and `object-src`
  are set; a `script-src` worth having needs a per-request nonce threaded
  through the App Router, which is left to you.

### 9. Run it as a non-root user with a read-only root

All three images already do — the API, the client, and the `migrator` stage the
migration job runs — and the chart sets `readOnlyRootFilesystem` on every
workload, including the job that holds `DATABASE_URL`. If you change the
images, keep that.

## The short version

| | State |
| --- | --- |
| Passwords hashed | ✅ bcryptjs (ADR-0003) |
| Tokens signed, expiry enforced | ✅ 1 day |
| Token revocation | ❌ none |
| Refresh tokens | ❌ none |
| Login rate limiting | ✅ per source and User, in-process only |
| Rate limiting elsewhere | ❌ none |
| Security headers | ✅ both apps; client CSP is partial |
| CORS origin configurable | ✅ `CORS_ORIGIN` |
| Proxy awareness | ⚠️ `TRUST_PROXY`, and you must set it |
| Secrets by reference in the chart | ✅ |
| TLS / Ingress | ❌ yours to write |
| Database backups | ❌ yours to arrange |
| Migrations on deploy | ✅ Helm pre-upgrade hook |
| Images run as non-root | ✅ |
