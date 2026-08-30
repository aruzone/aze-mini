# Email flows ship as Platform, and unverified Users may sign in

**Status:** accepted, not yet implemented — decided in [#78](https://github.com/aruzone/aze-mini/issues/78) from the survey in [#69](https://github.com/aruzone/aze-mini/issues/69).

Verification and password reset are the two email flows nearly every real
product needs, and they share one token machine — so both ship as Platform
behind one `EmailToken` table and one injectable `MailSender`, settled with
the driving dev:

**Tokens are opaque, single-use, and hashed at rest.** 32 CSPRNG bytes,
base64url-encoded, stored as a SHA-256 digest (the token is high-entropy, so
an unsalted fast hash cannot be brute-forced from a leaked table — bcrypt's
cost would buy nothing on a hot public endpoint). Single-use is enforced in
the same transaction that flips the state, and a newly issued token of a type
supersedes the previous one, which bounds table growth and prevents token
confusion. Lifetimes are environment-configurable defaults: **60 minutes for a
reset, 24 hours for verification**.

**The reset flow is enumeration-safe end to end.** The forgot-password
endpoint answers identically whether or not the account exists, in wording and
timing. A successful reset writes the new hash, notifies the User by email,
never auto-logs in, and — per ADR-0009 — revokes every refresh family the User
has, which is the concrete hook tying this decision to the token lifecycle.
The endpoints are public and inherit the fail-closed throttles (ADR-0010);
the account is never locked on reset requests.

**Unverified Users may log in.** Registration sends a verification email and
records `verifiedAt` — and nothing else changes. This is the decision a future
reader will most wonder about, so it is written here: the Starter must be
usable with no SMTP server at all (the `MailSender`'s jsonTransport logs the
mail locally), the seed User and every auth e2e test keep working untouched,
and refusing unverified logins is a documented one-line change at the login
check for the Adopter who wants it. OWASP requires verification at sign-up;
it does not require blocking sign-in on it — and for this Starter, a
registration wall that needs mail configured before a first login would break
the fresh-clone story the whole repository is built on.

**Outbound mail is one file and one method** — a `send({ to, subject, text })`
injectable over Nodemailer's SMTP transport from `SMTP_URL`. When the variable
is unset, or outside production, jsonTransport writes the mail into the JSON
log instead: local development needs no SMTP server, and providers remain an
Adopter choice via plain SMTP, which is what clone-and-own (ADR-0004) demands.
Provider SDKs (vendor lock-in) and a template-mailer module (machinery for
three static emails) were considered and rejected.

## Consequences

- Implementation adds a Prisma model, one issue/consume file beside the auth
  module, the `MailSender`, three public routes, and `SMTP_URL` plus the two
  token TTLs to the environment; [docs/deployment.md](../deployment.md) §8
  gains the verification posture and the enumeration-safety note when it ships.
- The verification link lands on a `noreferrer` client page and is exchanged
  at the API; reset URLs are built from configured origins, never the request's
  `Host` header (OWASP's host-header injection warning).
- Because unverified Users can sign in, `verifiedAt` joins the token claims so
  the gate is available to Adopters without a schema change.
