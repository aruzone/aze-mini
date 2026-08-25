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
handling real accounts it probably is — shorten the expiry, add a refresh token,
and put a revocation check somewhere. Decide this before launch, not after an
incident.

### 4. Set the CORS origin

`apps/aze-api/src/main.ts` hardcodes `http://localhost:3000`:

```ts
app.enableCors({ origin: 'http://localhost:3000', ... });
```

Deployed, that is wrong in both directions: it names an origin that is not yours,
and it needs a code change to fix. Make it an environment variable before you
deploy.

Note what does *and does not* depend on this. The client's own pages call the API
from the Next **server**, not the browser, so they are unaffected by CORS
entirely. This matters for anything else that calls the API from a browser —
another front end, the interactive docs page, a mobile web view.

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
- **Registration is open.** Anyone who can reach `/auth/register` can create an
  account. If that is not what you want, that is your change to make.
- **There is no rate limiting anywhere.** Login included. Nothing slows down a
  password-guessing loop.
- **There are no security headers.** No HSTS, no CSP, no `X-Frame-Options`.

### 9. Run it as a non-root user with a read-only root

Both images already do (`USER node`, and the chart sets
`readOnlyRootFilesystem`). If you change the images, keep that.

## The short version

| | State |
| --- | --- |
| Passwords hashed | ✅ bcryptjs (ADR-0003) |
| Tokens signed, expiry enforced | ✅ 1 day |
| Token revocation | ❌ none |
| Refresh tokens | ❌ none |
| Login rate limiting | ❌ none |
| Security headers | ❌ none |
| CORS origin configurable | ❌ hardcoded to localhost |
| Secrets by reference in the chart | ✅ |
| TLS / Ingress | ❌ yours to write |
| Database backups | ❌ yours to arrange |
| Migrations on deploy | ✅ Helm pre-upgrade hook |
| Images run as non-root | ✅ |
