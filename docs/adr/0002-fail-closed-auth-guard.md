# Authentication fails closed, via a global guard

**Status:** accepted — **not yet implemented**, tracked in #5.

> Until #5 lands, none of the below describes the running code. Guards are still applied per route with `@UseGuards`, there is no `APP_GUARD` registration and no `@Public()` decorator, and `GET /api/users` remains reachable anonymously. Do not assume a new controller is protected by default.

The JWT guard was applied per route with `@UseGuards`, which meant protection was opt-in. `UsersController` had no guard at all, so `GET /api/users` returned every user record — including passwords — to anonymous callers. Opt-in protection fails open: forgetting one decorator silently exposes a route, and an Adopter adding their own controller inherits that trap.

We decided the JWT guard will be registered globally through `APP_GUARD`, and routes that should be reachable anonymously will opt out with an explicit `@Public()` decorator.

`ApiKeyGuard` will no longer be stacked on top of JWT. It remains as a Demo of machine-to-machine authentication on a single route.

## Consequences

- Once implemented, controllers will carry no `@UseGuards` and be protected nonetheless. A reader unaware of the global guard may assume the opposite and re-add per-route guards.
- Every new anonymous route must be deliberately marked `@Public()`.
