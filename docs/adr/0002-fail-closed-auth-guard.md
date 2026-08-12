# Authentication fails closed, via a global guard

**Status:** accepted — implemented in #5.

The JWT guard was applied per route with `@UseGuards`, which meant protection was opt-in. `UsersController` had no guard at all, so `GET /api/users` returned every user record — including passwords — to anonymous callers. Opt-in protection fails open: forgetting one decorator silently exposes a route, and an Adopter adding their own controller inherits that trap.

We decided the JWT guard is registered globally through `APP_GUARD`, and routes reachable anonymously opt out with an explicit `@Public()` decorator. Three carry it: the root/health route, login, and registration.

`ApiKeyGuard` is no longer stacked on top of JWT. It survives as a Demo of machine-to-machine authentication on `POST /api/products`, marked `@MachineToMachine()` — one decorator that both stands the JWT guard down and applies the key guard. A route authenticated by key is not anonymous, so it does not take `@Public()`; keeping the two markers distinct is what lets a `@Public()` grep answer "which routes need no credential at all".

The users resource is reduced to `GET /api/users/me`, reading the id off the verified token. There is no route to another User and none to list them.

## Consequences

- Controllers carry no `@UseGuards` and are protected nonetheless. A reader unaware of the global guard may assume the opposite and re-add per-route guards.
- Every new anonymous route must be deliberately marked `@Public()`.
- Adding a second machine-to-machine route means the Demo is no longer a single example; prefer extending the existing one.
