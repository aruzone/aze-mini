# Pino for logs, opt-in metrics, and a named error hook

**Status:** accepted — decided in [#74](https://github.com/aruzone/aze-mini/issues/74), implemented in the same ticket.

The Starter answered nothing when someone asked what a fork was doing: no
structured logs, no metrics, no readiness a probe could read, and no single
place a crash report could be wired into. An Adopter would have to invent all
of it after cloning, which is the opposite of what the Starter is for. The
decision, taken with the driving dev:

**Logs are pino, wired in `src/config/logging.ts` and nowhere else.** One JSON
line per request under a requestId echoed as `X-Request-Id`, with
`authorization`, `x-api-key` and `cookie` redacted at the logger rather than
trusted to every future log call. The alternative the Starter's usual taste
would have picked — a hand-rolled middleware logging the same fields — was
rejected because logging is exactly the machinery worth inheriting rather than
rewriting: request ids, serializers and redaction have edge cases measured in
production incidents, and pino's are already paid for.

**Metrics are `prom-client` behind `GET /api/metrics`, opt-in.** Unset,
`METRICS_ENABLED` means off everywhere, the same posture as `API_DOCS`: the
endpoint names routes and carries process internals, which is not something to
publish by accident. A scrape knows where to point; nobody else needs it on.

**Readiness gates on Postgres alone.** `GET /api/health/ready` answers 200
only while Postgres answers, and reports the cache without ever gating on it —
the cache fails open (ADR-0005), so a deployment without its cache serves every
request and marking it unready would take healthy pods out of rotation.
Liveness consults nothing: a process that answers is alive, and gating
liveness on a dependency turns a database blink into a restart.

**Error tracking is a hook, not a dependency.** The 5xx branch of
`api-exception.filter.ts` is the one place every unexplained failure passes
through and the last place the cause exists; an Adopter adds
`Sentry.captureException` there and nothing else changes. Shipping an SDK
instead would have chosen a vendor for every Adopter in advance.

## Consequences

- The Starter carries three new runtime dependencies, which costs some of the
  one-file pedagogy the Starter usually protects. The tradeoff was accepted
  deliberately: these are the parts of a fork most worth inheriting.
- The Helm chart does not yet wire the probe routes to anything — that is
  ticket [#75](https://github.com/aruzone/aze-mini/issues/75)'s call, not this one's.
- A probe or scraper polling the health and metrics routes is invisible in the
  logs on purpose; the absence of those lines is the convention, so a missing
  readiness signal looks like silence, not an error.
