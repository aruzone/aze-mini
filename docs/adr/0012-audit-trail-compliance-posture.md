# The audit trail is queried, kept twelve months, and pseudonymized on erasure

**Status:** accepted and implemented in [#80](https://github.com/aruzone/aze-mini/issues/80). Decided in [#79](https://github.com/aruzone/aze-mini/issues/79), for the trail decided in the product-features triage ([#73](https://github.com/aruzone/aze-mini/issues/73)).

The audit table ships as Platform; this decision settles the posture around it — who reads it, how long it lives, and what a User's right to erasure means for rows that must never be rewritten. Settled with the driving dev:

**The Starter ships the trail, not a viewer.** There is no audit route and no
audit page: the table is the answerable-history view, queried with the
database tools an Adopter already has (psql, Prisma Studio, whatever BI they
run), and export-to-cold-storage is the documented Adopter plug-in point. An
in-product consumer would need an admin-and-roles model the Starter does not
have — every User is equal by design — and is product surface the Starter
refuses to guess. The pino JSON stream (ADR-0008) remains the live-operations
view; this table is the one that answers "who changed what" after the logs
have rotated.

**Events are kept twelve months by default, configurable per deployment.**
Monthly partitions make the drop cost one partition rather than one scan, and
an environment variable moves the horizon per deployment without code. Export
before drop — to whatever cold storage the Adopter runs — is the documented
hook, not a built job; shipping retention machinery now would be scope the
trail's decision deliberately left out.

**Erasure pseudonymizes; it never deletes.** When a User's right to erasure is
exercised, the acting User id in their audit rows is replaced with an
irreversible pseudonymous token held nowhere in the deployment, and the
redaction is itself recorded as an audit event: the history shows that
something happened without saying who. The alternative — deleting the User's
rows — rewrites the append-only trail whose whole value is that it cannot be
rewritten, which is the one thing an audit system must never be talked into.
Keeping the raw id is the compliance problem on the other side. The
account-deletion flow that triggers erasure is a roadmap item in its own
right; this decision fixes only what it does to the trail.

## Consequences

- Implementation carries three named pieces when the audit service ships: the
  retention environment variable, the partition drop, and the pseudonymization
  operation — each small, none silent.
- Audit rows carry no address or device data; the request's source is already
  in the pino stream under its own retention, so the table holds who and what,
  not where from.
- An Adopter with a stricter regime (longer retention, different erasure law)
  has three knobs, not a redesign: the retention variable, the export hook,
  and the pseudonymization operation.
