# platform-contracts

The shapes the Platform puts on the wire: the auth requests and the token they
answer with, the current User, and the envelope every refusal arrives in.

Platform, so an Adopter keeps this package. It depends on nothing — not on
`@aze-mini/demo-contracts`, and not on Nest, Prisma or React — so both the API
and the client can declare themselves against it. See `docs/adr/0006-contracts-as-types-split-by-tier.md`.
