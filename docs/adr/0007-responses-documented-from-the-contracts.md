# Responses are documented from the contracts, not from Prisma

**Status:** accepted — implemented in #29.

Every operation was documented and every request body had a schema, generated
from its DTO. No response had one: each operation emitted a bare `200` or `201`
with no content, and no refusal at all. An Adopter generating a client from
`/api/docs-json` got typed requests and untyped responses, and the only place
`POST /auth/login` was said to answer with a token was the prose on the page.

Requests have DTO classes to point at. Responses had nothing, and what to point
them at was the decision.

**Not the Prisma models.** Generating a response schema from the generated
client is the cheapest answer and the wrong one: the generated types stop at the
database layer on purpose (ADR-0006), and a schema derived from them would put
the database's shape on the wire — a `User` model that carries `password`, a
`Product` that carries relation arrays no route returns. The document would then
describe the rows rather than the responses, and would be wrong in the one
direction nobody checks.

**Not inline schemas either.** Writing the shape into each `@ApiOkResponse` puts
23 copies of four shapes in the controllers, with nothing holding any copy to
what the service actually returns.

**Response classes, declared against the contracts.** Each shape that crosses
the wire gets one class — `Product`, `ProductCategory`, `Review`, `Tag`,
`UserProfile`, `AuthResponse`, `HealthResponse`, `ApiErrorResponse` — annotated
with `@ApiProperty` and declared `implements Wire<T>` against the contract in
`libs/`. That is the rule the DTOs already follow, pointed the other way: the
contract is the single declaration, the class is how the document describes it,
and a field added to the contract and not to the class is a compile error.

`Wire<T>` rather than the contract directly, because a document describes what a
caller receives: JSON has no date type, so `createdAt` is documented as the ISO
string the API actually sends rather than the `Date` the contract names.

The types live in the tier packages #10 created rather than in a package of
their own: `HealthResponse` joins the Platform contracts, and the catalogue's
shapes were already in the Demo ones, so the tier split keeps holding and
deleting the Demo stays a delete (ADR-0006).

The classes carry no runtime role — a controller still returns what its service
returned, and nothing is serialized through them. They are named after the
contracts they mirror, so a generated client's `Product` is the `Product` in
`@aze-mini/demo-contracts`.

**Refusals are derived, not written.** The envelope is one class, and every
refusal in the document is a `$ref` to it. Which refusals each operation carries
is read off what that operation already declares — `documentRefusals` in
`src/config/docs.ts` — because the perimeter is uniform: a route is guarded
unless a decorator says otherwise (ADR-0002), so an operation that inherits the
document's bearer requirement answers 401, one asking for the API key answers
403, one with a body or a query parameter answers 400 from the global validation
pipe, and one addressing a row by id answers 404. Changing a guard changes the
documented refusals with it, and none of that is repeated 23 times.

What a route knows and the perimeter does not is written on the route, with
`@ApiRefusal`: the Products still in a category being deleted, a name already
taken, a `productId` in a body that matches nothing. Those reference the same
envelope. A status a route documents itself is never overwritten by the derived
default.

## Consequences

- A response shape is declared twice — once as a contract, once as the class
  that documents it — and the compiler is what keeps the second honest. It
  cannot check that the `@ApiProperty` annotations agree with the fields, which
  is the same gap the DTOs have; `docs.spec.ts` in the API e2e suite closes it
  by pinning every documented property of every schema.
- The e2e suite reads real responses against the published schema, in both
  directions: a documented field the API stops sending fails, and a field the
  API sends that the document never mentions fails too. That second direction is
  what would catch a `password` reaching the wire.
- The document describes what the routes answer with, not what the database
  holds. A column added to a model appears in no response until a contract, a
  response class and a service all say it does.
- The Demo's response classes live in `src/product/` alongside its DTOs and go
  with it, so the tier split survives (ADR-0006, `docs/demo.md`).
- Nothing validates a response at runtime. A service that returned the wrong
  shape would still be documented as returning the right one — the e2e is where
  that is caught, not the request path.
