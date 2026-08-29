# Auth & session hardening patterns — research for #69

*Part of #68. Researched 2026-08 against primary sources: RFC 9700, OWASP Cheat Sheet Series, Auth0 product docs, official NestJS docs and package registries. Feeds the token-lifecycle and rate-limiting decision tickets (#71, #72).*

Starter baseline (what the gaps are): one 1-day JWT, no `jti`, no refresh token, no revocation (`docs/deployment.md` §3); brute-force protection on login only, counted in-process per replica (`apps/aze-api/src/auth/login-attempts.ts`, `docs/deployment.md` §8); open unverified registration, no outbound email (§8). The cache is Redis and fails open by design (ADR-0005); `deployment.md` §8 warns the rate limiter must **not** inherit that fail-open policy.

---

## (a) Refresh-token rotation with revocation

### What the primary sources say

- **RFC 9700** (OAuth 2.0 Security BCP, January 2025) §2.2.2: refresh tokens for public clients MUST be sender-constrained **or rotated**. §4.14.2: rotation means a new refresh token on every refresh response, the previous one invalidated, the relationship retained — and when an invalidated token is replayed, the server revokes the whole family ("reuse detection"). Refresh tokens SHOULD expire on inactivity.
- **Auth0** implements exactly this shape: rotation issues a new token per exchange, automatic reuse detection revokes the token family and logs an event; idle lifetime defaults to 30 days, maximum lifetime configurable, and browser-based clients must not get non-expiring refresh tokens.
- **OWASP Session Management Cheat Sheet**: expiry must be enforced server-side, with both idle and absolute timeouts; server-side invalidation on logout is mandatory.
- **OWASP JSON Web Token Cheat Sheet**: JWTs for sessions are "frowned upon"; a deny-list makes sessions stateful anyway, defeating the point. It also warns that deny-list keys based on a raw-token hash are unsafe (JWT malleability can bypass them) and rates `jti` primarily as an audit claim, not a revocation mechanism.

### Recommendation: rotating refresh-token sessions, state in Postgres, Redis never on the correctness path

1. **Keep the access token a short-lived JWT** — 15 minutes instead of 1 day. Every consumer behind the ADR-0002 guard keeps working unchanged; the shortened life is what bounds damage from any stolen access token.
2. **Refresh tokens are opaque 256-bit CSPRNG strings**, not JWTs. Store a `RefreshToken` table in Postgres: token hash (SHA-256), `userId`, `familyId`, `expiresAt` (absolute, ~30 days), `lastUsedAt` (idle, ~7 days, RFC 9700's inactivity expiry), `usedAt`/`revokedAt`.
3. **Rotate on every exchange**: mark the presented token used, issue a sibling in the same family. **Reuse of a used/revoked token → revoke the entire family.** That is RFC 9700's replay detection and Auth0's documented behaviour; it catches a stolen refresh token even when the attacker races the legitimate client.
4. **Revocation is a row delete/update**: logout, password change, password reset (part (c)) and email change all revoke the user's families. This is what `deployment.md` §3 currently says only `JWT_SECRET` rotation can do.
5. **Where state lives — Postgres, and why this dodges the ADR-0005 trap.** Refresh/revocation state is correctness state, not cache. The one hot-path store check this design adds — "is this refresh token's row valid?" — happens on the *refresh endpoint*, not on every authenticated request, so it costs nothing in steady state. If Redis is later added as a lookup accelerator, a Redis outage must degrade to a Postgres read — never to acceptance — so the fail-open policy is structurally not inheritable. "Fail-closed" here means: cannot verify the session row → deny the refresh (503); the 15-minute access-token expiry bounds how long a user is stuck, and the API is already dead without Postgres.

### Alternatives rejected

- **Short-expiry-only, no refresh token** — zero state and real simplicity, but users re-authenticate every 15 minutes and there is no revocation story at all; only the clock defends a stolen token. Right for the Demo, below the Adopter bar.
- **`jti` deny-list on access tokens** — revokes on demand but detects nothing (a stolen token is accepted until someone notices); puts a store check on *every* request; and making revocation fast enough to matter means Redis on the per-request path, dragging fail-open cache semantics into authorization.
- **Replace JWTs with server-side sessions end to end** — the most OWASP-canonical answer, but it discards the stateless-guard pattern (ADR-0002) and the Demo's JWT teaching in one move; more churn than the gap demands.

### Cost in indirection

One Prisma model, one new file that spells out issue → rotate → reuse-detect → revoke as a single readable story, two new endpoints. No new framework machinery, no decorators, no middleware.

### Files the Starter touches

`prisma/schema.prisma` (+ `RefreshToken`); **new** `apps/aze-api/src/auth/refresh-tokens.ts`; `auth.service.ts`; `auth.controller.ts` (+ `POST /auth/refresh`, `POST /auth/logout`); `libs/platform-contracts/src/` (auth response shape); `docs/deployment.md` §3.

---

## (b) Distributed, fail-closed rate limiting

### What the primary sources say

- **@nestjs/throttler** (official, v6.5.0, ~3.8M weekly downloads) is the mainstream NestJS answer: guard-based, per-route `@Throttle`/`@SkipThrottle`, pluggable `ThrottlerStorage`. The official rate-limiting docs name the distributed option: "For distributed servers you could use the community storage provider for Redis".
- **`@nest-lab/throttler-storage-redis`** (that provider, from jmcdo29's nest-lab; 1.2.0, ~574k weekly downloads) is ioredis-based and runs one Lua script per check: `INCR` the hit key, `PEXPIRE` on first hit, and a separate block key once `limit` is exceeded — atomic per key, shared across replicas.
- **nginx `ngx_http_limit_req_module`** does leaky-bucket limiting per key in shared memory; cross-node synchronization (`sync` parameter) is a commercial feature, and ingress-nginx's equivalent annotations likewise operate per replica.
- NestJS docs also document the proxy caveat the Starter already knows as `TRUST_PROXY`: trust proxy + a custom `getTracker()` to key on the real client address.

### Recommendation: two app-side layers, both Redis-backed, fail-closed by explicit code

1. **General perimeter**: `ThrottlerModule.forRoot` with named throttler sets + `APP_GUARD` registration of `ThrottlerGuard`, with `@nest-lab/throttler-storage-redis` as the storage. This is the officially documented distributed story and gives Adopters per-route vocabulary for their own routes.
2. **Login brute-force guard**: migrate `LoginAttempts`' storage from the `Map` to the same Redis, keeping its two-key semantics — `user:{source}:{email}` (limit 5) and `source:{source}` (limit 20). Concretely `INCR` + `PEXPIRE`-on-first-failure, which preserves the current "window starts at the first failure" rule and deletes the in-process prune sweep. Keep it as one file teaching the per-user+per-source pattern: a ThrottlerGuard keys **one** tracker per request, and this guard needs **two counters with different limits from one event**, which the guard model cannot express.
3. **Fail-closed, spelled out, not inherited**: wrap the storage call; on a Redis error throw `503 Service Unavailable`. Never fall back to an in-process count — an attacker disables a fail-open limiter by taking Redis down, which is exactly the trap `deployment.md` §8 warns about. Note the raw community adapter already fails closed *by accident*: a Redis outage makes its `increment` reject, Nest surfaces a 500, requests are denied — but the wrapper makes that a deliberate contract with the right status code.
4. **Proxy-level limiting stays an Adopter concern, not a substitute**: a coarse Ingress/nginx limit is worth recommending in `deployment.md` as the outer layer, but it cannot key on (source, email), its state is per-replica without commercial `sync`, and its config lives outside the clone — against the clone-and-own bar (ADR-0004).

### Alternatives rejected

- **Proxy-level only** (nginx `limit_req`, ingress-nginx `limit-rps`): per-node state, no per-User+per-source keying, pattern not spelled in the repo — fails the pedagogical bar and misses the two-replica hole.
- **Hand-rolled middleware instead of the throttler**: reinvents the official guard and loses the `@Throttle`/`@SkipThrottle` vocabulary Adopters will reach for.
- **Keep the in-process Map, document the limit**: honest, and already documented — but two replicas is the shipped deployment shape, so the gap is the Adopter's first production incident.

### Cost in indirection

Two dependencies (`@nestjs/throttler`, `@nest-lab/throttler-storage-redis`), one module registration, a thin storage-error wrapper, and one new concept to name in docs — "perimeter throttle" vs "brute-force guard" are different tools with different failure semantics.

### Files the Starter touches

`apps/aze-api/src/auth/login-attempts.ts` (storage swap in place, semantics preserved); `apps/aze-api/src/app.module.ts` (throttler registration); `package.json` / lockfile; `docs/deployment.md` §8; `login-attempts.spec.ts` extends to the Redis-backed behaviour.

---

## (c) Email verification + password reset

### What the primary sources say

- **OWASP Forgot Password Cheat Sheet**: send URL tokens over the email side channel; tokens must be CSPRNG-generated, long enough to brute-force-proof, **single use**, **expire after an appropriate period**, and **stored securely**; responses to existent and non-existent accounts must be consistent in wording *and* timing (enumeration); request endpoints need rate limiting; never lock the account on reset requests; after a successful reset — notify by email, **do not auto-login**, and invalidate (or offer to invalidate) existing sessions. It also warns against building reset URLs from the `Host` header (Host Header Injection).
- **OWASP Authentication Cheat Sheet**: email-as-username requires verification at sign-up; the same enumeration-safe messaging applies to account creation ("If that email address is in our database, we will send you an email…").

### Recommendation

**Token design.** One `EmailToken` Prisma model: `userId`, `type` (`verify` | `reset`), `tokenHash`, `expiresAt`, `usedAt`. Tokens are 32 CSPRNG bytes, base64url-encoded (~43 chars, ≥ 256 bits — far past OWASP's ≥ 128-bit session-ID floor for unguessable tokens). Single-use is enforced in the same transaction that flips the state (set `verifiedAt`, or write the new password hash and clear the token). **Hash at rest with SHA-256**: the token is high-entropy, so an unsalted fast hash of the raw token cannot be brute-forced from a leaked table — bcrypt's cost buys nothing here and would burn compare time on a hot public endpoint. Issue of a new token of a type supersedes the previous one, which bounds table growth and prevents token confusion. TTLs are named config with short defaults: reset 30–60 minutes, verification 24 hours — OWASP deliberately leaves the number "appropriate", so the Starter should make it visible config rather than a magic constant.

**Flow shape.** `POST /auth/forgot-password` answers identically whether or not the account exists (constant-time, same message), rate-limited per (b). The email link carries the raw token; the API looks up its SHA-256 digest. On reset success: revoke the user's refresh-token families from (a) — this is the concrete hook connecting the two tickets — notify by email, no auto-login. Verification links land on a `noreferrer` client page and are exchanged at the API. Whether unverified users may log in stays a product decision for the ticket; record `verifiedAt`, expose it in claims, and make the gate a one-line change.

**Outbound email, one file.** `apps/aze-api/src/mail/mail-sender.ts`: an injectable `MailSender` with a single `send({ to, subject, text })` method, backed by Nodemailer's SMTP transport from `SMTP_URL`. When unset (or outside production) it uses Nodemailer's `jsonTransport`, so mail lands in the log — local dev needs no SMTP server and the Demo stays a clean delete. Providers remain an Adopter choice via SMTP, which is what ADR-0004 demands.

### Alternatives rejected

- **JWT-signed reset links**: cannot be single-use or selectively revoked without server state — which reintroduces the store you were avoiding; OWASP explicitly flags JWTs for this use as adding vulnerability.
- **Token columns on the `User` row**: cannot hold concurrent live tokens of two types with independent TTLs; flag-column sprawl.
- **Provider SDK directly** (SES/Postmark/Resend): vendor lock-in in the Starter violates clone-and-own (ADR-0004); SMTP keeps the provider swappable.
- **`@nestjs-modules/mailer`** (ecosystem default, 2.3.7, ~369k weekly): template/layout machinery for three static emails; skip now — it can be adopted later without touching `MailSender`'s interface.

### Cost in indirection

One injectable provider, one Prisma model, one issue/consume file, three `@Public` endpoints (which must inherit the throttle from (b)).

### Files the Starter touches

`prisma/schema.prisma` (+ `EmailToken`); **new** `apps/aze-api/src/mail/mail-sender.ts`; **new** `apps/aze-api/src/auth/email-tokens.ts`; `auth.service.ts`; `auth.controller.ts` (+ verify / forgot-password / reset-password routes); `libs/platform-contracts/src/`; `.env.example` (+ `SMTP_URL`, TTLs); `docs/deployment.md` §8.

---

## Cross-cutting observations

- **Ordering**: (c)'s "invalidate sessions on reset" needs (a)'s refresh-token store; (c)'s endpoints need (b)'s throttle. The token-lifecycle ticket should decide (a) first.
- **The one-file constraint survives all three**: every new concept maps to exactly one file with one doc comment; nothing adds decorators, interceptors, or multi-file framework machinery.
- **ADR interaction**: none of these contradicts an existing ADR. (a) and (c) rely on Postgres as the correctness store (ADR-0001); (b) makes the fail-open/fail-closed boundary between cache (ADR-0005) and limiter explicit rather than new.

## Sources

- RFC 9700 — Best Current Practice for OAuth 2.0 Security (Jan 2025), §2.2.2, §4.14: <https://www.rfc-editor.org/rfc/rfc9700>
- OWASP Session Management Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
- OWASP JSON Web Token Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html>
- OWASP Forgot Password Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>
- OWASP Authentication Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>
- Auth0 — Refresh Tokens: <https://auth0.com/docs/secure/tokens/refresh-tokens>
- Auth0 — Refresh Token Rotation (automatic reuse detection): <https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation>
- Auth0 — Configure Refresh Token Expiration (idle/max lifetime defaults): <https://auth0.com/docs/secure/tokens/refresh-tokens/configure-refresh-token-expiration>
- NestJS — Rate limiting (`@nestjs/throttler` usage, storages, proxy/tracker): <https://docs.nestjs.com/security/rate-limiting>
- `@nestjs/throttler` on npm (v6.5.0): <https://www.npmjs.com/package/@nestjs/throttler>
- `@nest-lab/throttler-storage-redis` on npm (v1.2.0) and source (Lua storage script): <https://www.npmjs.com/package/@nest-lab/throttler-storage-redis> · <https://github.com/jmcdo29/nest-lab/tree/main/packages/throttler-storage-redis>
- nginx `ngx_http_limit_req_module` (leaky bucket, `sync` is commercial): <https://nginx.org/en/docs/http/ngx_http_limit_req_module.html>
- `@nestjs-modules/mailer` on npm (v2.3.7): <https://www.npmjs.com/package/@nestjs-modules/mailer>
