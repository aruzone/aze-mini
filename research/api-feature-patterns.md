# Product-grade API feature patterns — survey for #70

Research ticket closing out the "headline" list on #68. For each of the six
features: the mainstream 2026 answer from primary sources, the recommendation
for this Starter, rejected alternatives, the indirection cost, and where it
lands — **Platform** (kept and built upon), **Demo** (teaching pattern,
deletable), or **documented Adopter-side work**.

The lens throughout is the two constraints the map names:

- **Contracts-as-types** (ADR-0006/0007): shapes crossing the wire live once,
  as plain TS types in `libs/`; DTOs and response classes `implements` them.
  Anything that puts a shape on the wire must enter through that system or it
  creates a second, unenforced declaration.
- **Pedagogical character**: one file spells the pattern out, deleting the Demo
  stays a delete (ADR-0004 clone-and-own), and docs name files, not lines.

---

## a. Background jobs / queues

**Mainstream answer.** In NestJS the answer is BullMQ behind `@nestjs/bullmq`,
the framework's own integration package. The docs state Bull is in maintenance
mode and BullMQ is "actively developed, featuring a modern TypeScript
implementation"; both are Redis-backed, which makes queues "completely
distributed and platform-independent" — producers, consumers and listeners may
run on separate nodes ([NestJS docs, Queues](
https://docs.nestjs.com/techniques/queues)). BullMQ's own docs show the worker
as a `Worker` consuming named jobs, with automatic retry and backoff
([BullMQ docs, Workers](https://docs.bullmq.io/guide/workers),
[Retrying failing jobs](https://docs.bullmq.io/patterns/retrying-failing-jobs)).

**Worker deployment shape.** Same image, separate process — concretely, a
second Kubernetes Deployment reusing the API image with a different entry
point/command, so the queue consumer cannot starve request handling. BullMQ
motivates this directly: a CPU-busy event loop stops renewing job locks and
jobs get marked **Stalled** and reprocessed; sandboxed processors exist as the
mitigation ([BullMQ docs, Stalled jobs](
https://docs.bullmq.io/guide/workers#stalled-jobs)). In NestJS terms the
`@Processor` consumers are providers registered only in the worker process
(a conditional module or a `worker` bootstrap); producers (`Queue#add`) stay
in the API process. Both processes speak to the same Redis.

**Recommendation.** `@nestjs/bullmq` + BullMQ. The Starter already runs Redis
(ADR-0005), so the queue adds zero new infrastructure; queue config joins
`BullModule.forRoot({ connection })` next to the cache config, keyed from the
same `REDIS_URL`. One deliberate split to document: **the queue's Redis must
not inherit the cache's fail-open policy** — for the cache, degraded reads are
acceptable (ADR-0005); for jobs, a fail-open enqueue is silent data loss. Same
server, different failure budget, different config.

**Rejected alternatives.**

- **pg-boss** — Postgres-backed with `SKIP LOCKED` exactly-once delivery, a
  Prisma adapter, and "exactly-once job delivery" as its headline
  ([pg-boss README](https://github.com/timgit/pg-boss)); genuinely attractive
  for transactional enqueue (job created in the same Prisma transaction as the
  write), but it is not what NestJS documents, not what most Adopters will
  expect, and transactional enqueue is a pattern you can add to a BullMQ stack
  later via an outbox — reverse is harder. Worth a paragraph in the recipe, not
  the default.
- **graphile-worker** — high-performance PG-backed queue
  ([graphile/worker](https://github.com/graphile/worker)); no Nest integration
  to hang consumers on, and the same transactional-enqueue argument loses to
  pg-boss on fit.
- **In-process timers / `setTimeout` workarounds** — no durability, no retry,
  no visibility; the failure mode (job gone on restart) is exactly what the
  feature exists to prevent.

**Indirection cost.** Low. One module import (`BullModule`), one config block,
named jobs with payload types declared as plain TS types (job payloads are
internal — they never cross the wire, so they do **not** belong in the wire
contracts; a `jobs/` types module next to the processors is enough), and one
extra Deployment per worker in the chart. The one real risk is Redis coupling:
jobs share fate with the cache server unless Adopters point the queue at its
own instance — a documented env knob, not code.

**Landing spot.** **Platform** for the infra (module wiring, worker bootstrap,
chart Deployment, "queue Redis fails closed" note), **Demo** for the example
jobs (e.g. a product-thumbnail job on the catalogue) so the pattern is spelled
out in one file an Adopter reads once and deletes. This matches the map's open
question ("jobs/storage/audit taught as Demo patterns or shipped as Platform
modules"): infra Platform, exemplars Demo.

---

## b. File storage

**Mainstream answer.** Presigned direct upload. The API answers `POST /files`
with a short-lived, capability-scoped URL; the client uploads straight to the
object store and nobody's file bytes touch the API. AWS documents presigned
PUT for exactly this: "allow an upload without requiring another party to have
AWS security credentials", generated per method/key/content-type, expiring —
SDKs cap expiry at 7 days, practice is minutes
([AWS S3 docs, Uploading objects with presigned URLs](
https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)).
The proxy-through-API alternative makes the Node process an expensive reverse
proxy: every upload holds an event-loop connection and buffers bandwidth the
API's SLA never promised.

**Recommendation.** Presigned direct upload behind a **minimal storage seam** —
one interface, not a framework:

```ts
interface Storage {
  /** Capability-scoped, short-lived upload grant for one key. */
  createUploadUrl(key: string, contentType: string, ttlSeconds: number): Promise<{ url: string; method: 'PUT' }>;
  /** Where the object will be readable from after upload. */
  publicUrl(key: string): string;
}
```

One S3 implementation (AWS SDK v3 `@aws-sdk/s3-request-presigner`) plus a
local-dev implementation (MinIO speaks the S3 API, so local dev is just
configuration, not a second code path). Two constraints worth writing into the
recipe: pin `contentType` into the signature (AWS verifies it on upload, so a
URL can't be replayed for a different file type), and derive the key
server-side (prefix with the User's id; never trust the client's path — that
is the whole reason the presign step exists).

**Rejected alternatives.**

- **Proxy uploads through the API** — simplest to reason about, but the API
  becomes a bandwidth-bound file relay and the failure mode (big file blocks
  workers, needs multipart passthrough) is strictly worse than presigning.
- **Framework-specific "storage" libraries (Nest `FileInterceptor`+multer,
  CQRS-style file aggregates)** — solves the receiving problem, which presign
  removes, and drags a filesystem/middleware abstraction behind it.
- **Bare SDK calls scattered in services** — no seam means every Adopter
  choosing a different store (S3, GCS, Azure, MinIO) rewrites call sites;
  the seam exists precisely to keep that a one-file change.

**Indirection cost.** Low. One interface, two implementations, one env block
(`S3_ENDPOINT/BUCKET/…`), one `POST /files` route whose response shape
(`{ uploadUrl, key, publicUrl }`) is a wire contract and therefore goes into
`platform-contracts` and gets a response class per ADR-0007 like anything
else. The Demo product image shows the client flow; the seam and the route
stay Platform.

**Landing spot.** **Platform** for the seam + presign route; **Demo** for the
product-image usage that teaches the client-side flow. An Adopter on GCS
swaps the one implementation file.

---

## c. Pagination

**Mainstream answer.** Cursor-based, explicitly. Zalando's REST guidelines:
pagination **MUST** be supported for lists beyond a few hundred entries;
cursor-based **SHOULD** be preferred over offset; the cursor is an opaque
pointer clients must never inspect or construct; a total result count
**SHOULD** be avoided ("calculating it is a costly operation… removing them
will be more difficult than not providing them")
([Zalando pagination](
https://opensource.zalando.com/restful-api-guidelines/#pagination), chapters
`159/160/254`). Offset pagination's anomaly — duplicates and missing entries
when rows change between page requests — is the stated reason.

**Fit with this Starter.** The existing product list validates `sort`
(asc/desc) and `limit` (`DefaultValuePipe` + `ParseIntPipe` +
`IsPositivePipe`, `products.controller.ts`) and keys the cache by exactly
`sort:limit` (`product-cache.ts`). Cursor pagination slots into that without
disturbing it:

- A `Page<T>` contract type — `{ items: T[]; nextCursor?: string }` — joins
  the contracts; the response class `implements Wire<Page<Product>>` per
  ADR-0007, so the compiler keeps the wire honest exactly the way the rest of
  the API works. This is the feature where contracts-as-types pays off most
  visibly: pagination metadata is just another shape with one home.
- The cursor is opaque base64url of the keyset position (`lastId` + `sort`),
  produced and consumed server-side — matching Zalando's "never inspected or
  constructed by clients".
- Keyset pagination on the `id` ordering the endpoint already sorts by turns
  the cache question into a smaller one: pages can be cached under
  `sort:limit:cursor` the way lists are today, and the generation-based
  `forgetList()` invalidation carries over unchanged.

**Rejected alternatives.**

- **Offset/`page` query params** — familiar to clients (Zalando acknowledges
  the usability/framework trade-off) but suffers the insert/delete anomaly and
  degrades badly at depth on the database; the anomaly alone is
  disqualifying for anything Adopters will grow.
- **Total count alongside pages** — Zalando SHOULD-avoid; invites Adopters to
  build UIs that a `COUNT(*)` per request can't sustain.
- **RFC 8288 `Link` headers / hypermedia controls** — standards-clean but
  invisible in OpenAPI-generated clients, which is how every Adopter's
  consumer will be built; the in-body cursor is what a generated client can
  actually follow.
- **Relay-style connections (`pageInfo`, edges, nodes)** — the right shape for
  GraphQL, ceremony overkill for a JSON REST list.

**Indirection cost.** Minimal, and mostly on the Demo. One contract type, one
cursor-encode/decode helper, one Prisma change (`cursor`/`skip`-style keyset
`where` instead of `take`-from-start). The one behavioral cost worth naming:
cursors make "jump to page 7" impossible by design; for a catalogue list with
sort+limit already in place that is the right trade, and it is documented.

**Landing spot.** **Platform** for `Page<T>` + the cursor helper (an Adopter
who deletes the Demo still paginates their own lists), **Demo** for the
product list as the teaching instance. This is the smallest of the six and the
one most naturally one-file.

---

## d. API versioning

**Mainstream answer.** There is no single one — the guidelines disagree, and
that disagreement is itself the finding:

- **Zalando**: versioning **SHOULD** be avoided entirely; evolve with
  compatible extensions, and when unavoidable use **media type** versioning
  (`application/x.zalando.cart+json;version=2`) — [compatibility chapter](
  https://opensource.zalando.com/restful-api-guidelines/#compatibility), rules
  106/113/114.
- **Azure**: a required `api-version` **query parameter** on every operation,
  date-valued, and "**DO NOT** include a version number segment in any
  operation path" ([Microsoft Azure REST API Guidelines, API Versioning](
  https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md#api-versioning)).
- **NestJS**: four built-in types — **URI** (the default), header, media
  type, custom — with URI composition documented for exactly this Starter's
  situation: "the version will be automatically added to the URI after the
  global path prefix (if one exists), and before any controller or route
  paths", plus a `defaultVersion` so un-versioned controllers keep serving
  ([NestJS docs, Versioning](
  https://docs.nestjs.com/techniques/versioning)).

**Recommendation.** Do **not** build versioning now, and do not pick a
mechanism that costs anything before the first breaking change. Concretely:

1. Document the compatible-extension rules (Zalando 107) as the API's change
   policy — add-only, never re-semantic a field — because at the Starter's
   stage the cheapest versioning is the versioning you never need.
2. When an Adopter (or a later iteration) ships the first breaking change,
   enable NestJS **URI versioning**: `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`.
   The built-in composes with the existing `/api` global prefix with zero
   route edits, `defaultVersion: '1'` means nothing 404s on the day it's
   switched on, and `VERSION_NEUTRAL` covers the health route and docs.
   URI wins the pragmatic mainstream for REST + OpenAPI + generated clients —
   the version is visible in every URL, log line and generated SDK — even
   though both named guilds prefer something subtler. Header and media type
   versioning are one-line swaps later if a guild mandate ever lands; NestJS
   treats the choice as config, not architecture.

The relevant discipline to write down now is the ADR-0006 corollary: a
breaking change means a new **contract version** in `libs/`, with both
response classes present during deprecation — the contracts layer, not the
controller layer, is where a v2 forks.

**Rejected alternatives.**

- **Header-based custom versioning from day one** — invisible in URLs and
  docs, breaks naive cache keys, and buys nothing until the API actually has
  consumers to break.
- **Query-param `api-version` (Azure style)** — the right answer inside
  Microsoft's fleet-management context; inside a NestJS app it fights the
  framework's built-in URI machinery for no Adopter-visible gain.
- **Date-valued versions** — delightful at Azure scale, noise for a starter
  that will have at most a `v2` this decade.

**Indirection cost.** Zero until the first breaking change — the enablement
call is one line in `main.ts` and the decision is documentation. That is the
whole point of recommending deferral: the cost curve here is flat-then-flat.

**Landing spot.** **Documented Adopter-side decision** (a section in the
roadmap spec / architecture docs: the change policy now, the one-line
enablement and the contracts-versioning corollary for later). Nothing
Platform, nothing Demo.

---

## e. Webhooks (outbound)

**Mainstream answer.** The Stripe model is the canon, and its docs make the
whole machine legible: register endpoint URLs per event type; sign each
delivery with a per-endpoint secret (`whsec_…`) and a `Stripe-Signature`
header, verified against the **raw** body; return `2xx` **fast**, before any
processing; automatic retries "for up to three days with an exponential
backoff in live mode", manual resend for 15 days
([Stripe webhooks docs](https://docs.stripe.com/webhooks)). GitHub's delivery
model (per-endpoint secret, HMAC signature, redelivery from the dashboard) is
the same shape ([GitHub webhooks](
https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries-from-github)).
Svix exists as a product because the remaining parts — endpoint CRUD, secret
rotation, per-endpoint delivery logs and automatic disabling of chronically
failing endpoints — are a product.

**Is this Starter scope?** No — not as Platform. The headline feature set
rightly includes webhooks, but the gap between "a signed POST with retries"
and "product-grade outbound webhooks" is exactly the gap Stripe/Svix
monetize: an endpoint-registry API, per-endpoint signing secrets and their
rotation, delivery attempt logs, and failure-driven disabling. For a starter
whose Adopters are cloning to own, shipping half of that is worse than
documenting the recipe for it.

**Recommendation.** **Documented Adopter-side recipe**, built on pieces the
Starter already decided to ship:

- events enqueue one job per subscribed endpoint through the Platform queue
  (feature a);
- the job HMAC-signs `timestamp + '.' + body` with the endpoint's secret and
  POSTs it — Node's `node:crypto` is the entire signing dependency, same
  construct Stripe documents on the receiving side;
- `attempts`/`backoff` on the job give the exponential-retry story; a
  dead-letter queue is the "endpoint disabled" story;
- idempotency keys (`jobId` = event id) so retries are safe.

One thing worth **keeping** in Platform: nothing, or at most a tiny
`signPayload` util if the audit trail (feature f) also wants HMAC'd exports.
The recipe references the Stripe docs for the wire details rather than
restating them.

**Rejected alternatives.**

- **Build full endpoint management now** — endpoint registry, secret
  rotation, delivery logs: a product surface with its own security review;
  the effort outranks everything else on the map.
- **Embed Svix (self-hosted or cloud)** — offloads the whole problem, but
  introduces a new infrastructure dependency an Adopter must operate; wrong
  default for clone-and-own.
- **Fire-and-forget from the request path** — unsignable, unobservable, and
  the first Adopter outage teaches them to distrust the Starter's judgement.

**Indirection cost.** Zero if deferred (the recipe is docs). If built anyway:
a webhook-endpoint table, a signing service, a delivery queue and a DLQ —
four subsystems, each with failure modes, which is the cost estimate itself.

**Landing spot.** **Documented Adopter-side work** — a recipe in the docs
pointing at the Platform queue, with Stripe/Svix as the references. The
product-features triage should place it deliberately, not as a half-built
module.

---

## f. Audit logging

**Mainstream answer.** An append-only, database-backed trail. For a
Postgres-only Starter (ADR-0001) the mainstream shape is an
`audit_events` table written by the application — never updated, only
inserted — holding who/what/when/before/after; retention handled by monthly
partitions and a drop-or-archive policy. OWASP's Logging Cheat Sheet sets the
event floor and the red line: "Authentication successes and failures" must
always be logged (ASVS 7.1.1), and things like passwords are on the never-log
list ([OWASP Logging Cheat Sheet](
https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)).

**What events matter.** Map says compliance questions ("who consumes audit
logs") wait on this decision, so name the floor: authentication events
(register, login success/failure — the throttler already counts them,
`login-attempts.ts`, so the same code path emits them), authorization
failures at the guard boundary (ADR-0002's refusals, logged at one choke
point), and data mutations (create/update/delete) with the acting User id.
Crossing-Tenant operations are not a separate category here — deployments are
single-Tenant (map decision), so "who did what" is the whole question.

**Recommendation.** **Platform**, kept deliberately small:

- one append-only table + one `AuditService.append()`; the audit row for a
  mutation is written in the **same Prisma transaction** as the mutation
  (transactional enqueue, from the pg-boss feature above, is the later
  upgrade path if volume demands it);
- the service never throws into the request path — an audit write failure is
  logged loudly, not a 500. (Same fail-*loud*-not-*fail-the-request* logic
  the cache inverts under ADR-0005; audit is the one subsystem where
  fail-silent is the documented, deliberate choice, because refusing a
  checkout because a log row failed punishes the User for our observability.)
- retention sketch, not retention system: partition by month, drop after a
  configurable N months, export-to-cold-storage as the Adopter's plug-in
  point. Shipping retention jobs now would be scope the map doesn't ask for.

**Rejected alternatives.**

- **Structured stdout logs only** — zero schema, no queryability, gone at the
  next log rotation; fine as an *additional* sink, useless as the trail.
- **Kafka/event-stream** — the pattern for services that already run one;
  adds a distributed-systems dependency the Starter's ADR-0001 explicitly
  refuses.
- **Postgres triggers for audit** — keeps writes atomic, but hides the
  pattern under the schema: not TypeScript, not visible in the one file that
  is supposed to spell the pattern out, and invisible to an Adopter changing
  the model.

**Indirection cost.** Low and honest: one service, one table, and a call at
each mutation site (which is the pedagogical point — the call sites *are* the
documentation). The cost that actually accrues is schema-coupling: audit rows
freeze event shapes, so the contract for an audit event should be as
informational (`{ action, entity, entityId, actorId, at, detail: unknown }`)
as the contracts-as-types approach allows — `detail` stays loose precisely so
the trail outlives model changes.

**Landing spot.** **Platform** — table, service, emission at the auth and
mutation choke points, retention note in `docs/deployment.md`'s gap table.
This is the feature the compliance/PII question on the map is explicitly
waiting for.

---

## Summary

| Feature | Recommendation | Indirection cost | Landing spot |
| --- | --- | --- | --- |
| Jobs/queues | `@nestjs/bullmq`; same image, separate worker process | Low: 1 module, 1 config, 1 Deployment | Platform infra + Demo exemplars |
| File storage | Presigned direct upload behind a two-method `Storage` seam | Low: 1 interface, 2 impls, 1 route (contracted) | Platform seam + Demo usage |
| Pagination | Opaque cursor (keyset), `Page<T>` contract, no total count | Minimal: 1 type, 1 helper | Platform `Page<T>` + Demo list |
| Versioning | Defer; compatible-extensions policy now, NestJS URI versioning at first break | Zero until first breaking change | Documented Adopter-side |
| Webhooks | Don't build; document the queue+HMAC recipe | Zero if deferred; ~4 subsystems if built | Documented Adopter-side |
| Audit logging | Append-only table + `AuditService`, same-transaction writes, partitioned retention | Low: 1 service, 1 table | Platform |

The three Platform features share one property worth carrying into the
triage: each enters the wire through the contracts system (upload-grant
response, `Page<T>`, audit event shape), so ADR-0006/0007 hold without
amendment. The two deferrals (versioning, webhooks) share the other: their
correct Starter artifact is a documented decision, not a module.

## Sources

- [NestJS docs — Queues (@nestjs/bullmq)](https://docs.nestjs.com/techniques/queues)
- [BullMQ docs — Workers, stalled jobs, retries](https://docs.bullmq.io/guide/workers)
- [pg-boss README](https://github.com/timgit/pg-boss)
- [graphile/worker](https://github.com/graphile/worker)
- [AWS S3 — Uploading objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [Zalando RESTful API Guidelines — Pagination (159/160/161/254)](https://opensource.zalando.com/restful-api-guidelines/#pagination)
- [Zalando RESTful API Guidelines — Compatibility (106/107/113/114)](https://opensource.zalando.com/restful-api-guidelines/#compatibility)
- [NestJS docs — Versioning](https://docs.nestjs.com/techniques/versioning)
- [Microsoft Azure REST API Guidelines — API Versioning](https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md#api-versioning)
- [Stripe — Receive events in your webhook endpoint](https://docs.stripe.com/webhooks)
- [GitHub — Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries-from-github)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
