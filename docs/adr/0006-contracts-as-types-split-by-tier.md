# Shared contracts are types, split by tier

**Status:** accepted — implemented in #10.

The shapes crossing between the API and the client were declared twice: once as
a Nest DTO with validation decorators, once again wherever a caller needed them.
`MyComponent` declared a product's `id` as a number; it is a uuid string. Nothing
caught that, because nothing connected the two declarations.

**One package or two.** A single `contracts` package would put `Product` next to
`AuthResponse`, and removing the Demo would become an edit inside a file the
Adopter has to read first — exactly what `docs/demo.md` exists to avoid. So there
are two: `@aze-mini/platform-contracts` for what an Adopter keeps (the auth
requests, the token, the current User, the error envelope) and
`@aze-mini/demo-contracts` for the catalogue they delete. Deleting the Demo stays
a delete.

The direction is enforced rather than described, as far as it can be. Both
packages carry a `tier:` tag and `@nx/enforce-module-boundaries` refuses a
`tier:platform` project any dependency on a `tier:demo` one, so the Platform
package cannot come to rely on something the Adopter is told to remove. Tags work
between projects, and the API is one project holding both tiers, so
`src/product/demo-contracts.spec.ts` checks the same containment there by reading
the source; it is deleted with the rest of the Demo. The client is covered by
neither: its Demo is a handful of scattered files rather than a directory, and a
list of them in a spec would rot faster than it would catch anything.
`docs/demo.md` is what names them.

**Types, not classes.** A contract is a plain type. The Nest DTO stays where it
is and declares `implements` against it, so the validation decorators and the
OpenAPI examples live with the framework that reads them while the shape has one
home. A field added to a contract and not to its DTO is a compile error rather
than a silent 400. The packages depend on nothing — not Nest, not Prisma, not
React — which is what lets both applications import them.

**Dates.** JSON has no date, so a `Date` the API returns arrives as a string. The
contracts are written in the API's terms and the client reads them through
`Wire<T>`, which maps every `Date` to `string`. One declaration serves both sides
without either restating the other's fields.

## Consequences

- A response shape changes in one place. Anything declared against it that no
  longer matches fails to compile, on both sides of the wire.
- The contracts are hand-written, not generated from the Prisma schema. A column
  added to a model does not appear on the wire until someone puts it there, which
  is the point: the schema is the database's shape, not the API's.
- `implements` checks that a DTO's fields match the contract; it cannot check
  that the validation decorators agree with it. A contract saying `price: number`
  and a DTO validating it with `@IsString()` still compiles.
- These are the types #29 needs to document responses with, and the types #11
  wires the client against. Neither has to invent its own.
- A third tier — contracts shared by neither — would need a third package and a
  third tag rather than a folder inside one of these two.
