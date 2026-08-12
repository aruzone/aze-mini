# Authentication fails closed, via a global guard

The JWT guard was applied per route with `@UseGuards`, which meant protection was opt-in. `UsersController` had no guard at all, so `GET /api/users` returned every user record — including passwords — to anonymous callers. Opt-in protection fails open: forgetting one decorator silently exposes a route, and an Adopter adding their own controller inherits that trap. The JWT guard is now registered globally through `APP_GUARD`, and routes that should be reachable anonymously opt out with an explicit `@Public()` decorator.

`ApiKeyGuard` is no longer stacked on top of JWT. It remains as a Demo of machine-to-machine authentication on a single route.

## Consequences

- Controllers carry no `@UseGuards` and are nonetheless protected. A reader unaware of the global guard may assume the opposite and re-add per-route guards.
- Every new anonymous route must be deliberately marked `@Public()`.
