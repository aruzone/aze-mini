# Caching is Redis, and it fails open

**Status:** accepted — implemented in #9.

Caching was a headline promise of the Starter with nothing behind it. Adding the cache raised two questions that a bare module registration would have answered by accident.

**Where the cache lives.** The obvious cheap answer — an in-process memory store — is a different cache in every replica, so two pods answer the same read differently and an invalidation performed by one is not performed by the other. That contradicts the deployment path the Starter ships towards (#13, #14), for the same reason SQLite did (ADR-0001). The cache is Redis, run from the same `docker-compose.yml` as Postgres, and there is no in-memory fallback to quietly degrade into.

**What happens when Redis is not there.** A cache is not a source of truth, so a Redis that is unreachable must cost a request its speed and nothing else. Every call through `CacheService` fails open: a read that cannot reach Redis is a miss and goes to Postgres, a write that cannot be recorded is dropped, and an invalidation that cannot be performed is logged and abandoned.

Unreachable includes slow. The store refuses an offline queue and gives up on a connection after a second, but neither covers the worse failure — a Redis that accepts the socket and then stops answering, which no connect timeout can see. Every operation is therefore raced against a 250ms deadline in `CacheService`, and a request that loses the race goes to Postgres. A failure then puts the cache aside for five seconds: one read can involve several operations, and without that, every one of them — in every request — would pay the deadline again. So an outage costs one deadline every five seconds across the process, not one per operation per request.

The Demo is `GET /api/products` and `GET /api/products/:id`, cached for 60 seconds, with `POST`, `PATCH` and `DELETE` forgetting what they touched. Both routes answer with `X-Cache: HIT` or `MISS`, so "this was served from Redis" is something a caller sees rather than infers from a stopwatch.

Lists are keyed by the sort and limit they were read under, which a write cannot enumerate, so they hang off a generation token instead: forgetting that one key orphans every list at once and leaves the orphans to expire. Invalidation stays O(1) whatever the size of the catalogue, and never scans the keyspace.

## Consequences

- Redis joins Postgres as a prerequisite for the full experience. An Adopter who does not start it gets a Starter that works and repeats every query.
- A dropped invalidation is not retried. The 60-second TTL is the ceiling on how long a stale product can survive one, which is why the TTL is short and why lengthening it is a decision about correctness, not only about load.
- A read of a single product that begins before a write and records its result after that write's invalidation stores a value that is already old. Every read-through cache has this window, and the TTL is again the ceiling on it. A read path that cannot tolerate one stale answer wants a different pattern, not a longer TTL. The list path is not exposed to it: a list read resolves its generation before it queries, so an invalidation that lands in between orphans whatever that read goes on to store.
- The cache holds whatever the read path returned, so a change to what `GET /api/products/:id` selects is served from the old shape until the entries expire. A deploy that changes a response shape should assume up to one TTL of both.
- `ProductCache` is Demo and goes with the catalogue (`docs/demo.md`). `CacheService`, the Redis store and the compose service are Platform: an Adopter keeps them and writes their own cache in front of their own read path.
