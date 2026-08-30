# Throttling is fail-closed, in two deliberate layers

**Status:** accepted, not yet implemented — decided in [#72](https://github.com/aruzone/aze-mini/issues/72) from the survey in [#69](https://github.com/aruzone/aze-mini/issues/69).

Today the only limiter is the login brute-force guard, and its counts live in
one process: two replicas mean two budgets, and an attacker spread across both
gets twice the attempts ([docs/deployment.md](../deployment.md) §8). Nothing
limits any other route. This decision closes both gaps with two tools that are
deliberately different, because they answer different attacks and fail
differently:

**A perimeter throttle for every route.** The official NestJS throttler
registered globally on `APP_GUARD`, backed by the community Redis storage
adapter whose atomic Lua-script counters are shared across replicas — the
distributed story the NestJS docs themselves name. Default ~100 requests per
minute per source, environment-configurable, with per-route overrides through
the throttler's own vocabulary, so an Adopter throttles their expensive routes
without inventing a mechanism.

**The brute-force guard keeps its shape and moves its memory to Redis.** Two
counters with two different limits from one event — per source **and** User at
5, per source alone at 20, window starting at the first failure — is exactly
what a guard keyed on one tracker per request cannot express, so
`login-attempts.ts` stays bespoke and keeps teaching the pattern. The in-process
map becomes Redis `INCR` with an expiry set on first failure, which preserves
the window rule and deletes the prune sweep.

**Both fail closed: a Redis error answers 503, never an in-process fallback.**
A limiter that fails open is one an attacker disables by taking Redis down —
precisely the trap §8 warns about, and the reason this is written in an ADR
rather than left to the implementation to choose. The raw storage adapter
already fails closed by accident (its `increment` rejects, Nest answers a 500);
the wrapper makes it a deliberate contract with the right status. This is the
mirror of the cache's fail-open (ADR-0005): speed fails open, authorization
fails closed, and the two are never one policy.

**Registration stays open and gains its own tighter throttle** — a small
per-source registration limit through the same throttler vocabulary, so the
perimeter is not the only thing between a script and unbounded User rows.
Closing registration remains the Adopter's change to make, as §8 already says;
the Starter ships open, throttled, and honest about it.

## Considered and rejected

- **Documented-only, no code** — no dependencies, but the two-replica hole the
  ticket exists to close stays open and no in-repo pattern teaches the shape.
- **Perimeter throttle with in-process storage** — simpler, but doubles the
  budget per replica and makes Redis a dependency of only one of the two
  limiters for no reason.
- **Fail open to per-replica counting on Redis error** — service continues,
  and taking Redis down halves the defenses exactly when it matters.
- **Registration closed behind a flag by default** — safer for a real
  deployment, and breaks the fresh-clone story, the e2e suite and the seed
  flow that assume a Starter you can sign up to.

## Consequences

- Implementation adds two dependencies (`@nestjs/throttler`, the Redis storage
  adapter), one module registration, a thin fail-closed wrapper over storage
  errors, and the storage swap inside `login-attempts.ts` with its semantics
  and spec extended, not rewritten.
- [docs/deployment.md](../deployment.md) §8 is rewritten at implementation —
  until then it still describes what actually runs, per the ADR-0009 precedent.
- With Redis down, every route answers 503 instead of 401/200. That is the
  contract, and it is why the compose stack and the chart both treat Redis as
  required for the full experience rather than optional.
- The email-verification and reset flows ([#78](https://github.com/aruzone/aze-mini/issues/78))
  inherit these throttles for their public endpoints; nothing in this decision
  is theirs to re-choose.
