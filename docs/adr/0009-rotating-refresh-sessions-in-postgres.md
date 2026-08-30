# The token lifecycle: rotating refresh sessions in Postgres

**Status:** accepted, not yet implemented — decided in [#71](https://github.com/aruzone/aze-mini/issues/71) from the survey in [#69](https://github.com/aruzone/aze-mini/issues/69).

The Starter issued one JWT that lived a day, with no refresh and no
revocation: a stolen token was valid until it expired, and the only revocation
was rotating `JWT_SECRET`, which signed everyone out at once. That is what
[docs/deployment.md](../deployment.md) §3 records today; this decision
replaces it. The shape, settled with the driving dev:

**Access tokens stay short-lived JWTs** — 15 minutes by default instead of a
day. Nothing behind the guard changes (ADR-0002 stands); the shorter life is
what bounds the damage of any stolen access token.

**Refresh tokens are opaque 256-bit random strings, not JWTs**, stored in a
`RefreshToken` table in the Prisma schema: the SHA-256 hash of the token (never
the token), the User it belongs to, a family id, an absolute expiry of ~30
days, and an idle expiry of ~7 days — RFC 9700's inactivity expiry, and
Auth0's defaults. Every refresh exchanges the presented token for a new one in
the same family; presenting a token that was already used or revoked revokes
the entire family, which catches a stolen refresh token even when the attacker
races the legitimate client.

**The refresh token travels only as an httpOnly cookie**, separate from the
access-token cookie, and rotation re-sets it. The client's own pages already
keep every token out of browser JavaScript; body or header transport would put
a 30-day credential where that design said none would live.

**Revocation is a row update, and the events that trigger it are named:**
logout revokes the family the presented token belongs to; a password change or
reset revokes every family the User has. What `JWT_SECRET` rotation did
badly and globally, rows do precisely. Redis is never on this correctness
path — the only store read the design adds sits on the refresh endpoint, not
on every authenticated request — so the cache's fail-open policy (ADR-0005)
is structurally not inheritable: a session that cannot be verified is denied,
never waved through.

## Considered and rejected

- **Short expiry with no refresh token** — no state and real simplicity, but
  no revocation story at all; the clock is the only defence.
- **A `jti` deny-list on access tokens** — detects nothing, and putting a
  store check on every request drags fail-open cache semantics into
  authorization.
- **Server-side sessions end to end** — the OWASP-canonical answer, but it
  discards the stateless guard (ADR-0002) for churn the gap does not demand.

## Consequences

- Implementation adds a Prisma model, one new auth file teaching
  issue → rotate → reuse-detect → revoke, and refresh and logout endpoints;
  until it ships, [docs/deployment.md](../deployment.md) §3 describes the
  lifecycle that is actually running and is rewritten then.
- The Client's session flow changes with it: the session cookie shortens to
  the access-token life and the server actions refresh silently.
- A password reset must revoke the User's refresh families — the hook that
  ties the email-verification and reset flows (survey part c) to this store.
- Lifetimes ship as environment-configurable defaults
  (15 minutes / 30 days / 7 days), not constants, so a deployment can tighten
  them without a code change.
