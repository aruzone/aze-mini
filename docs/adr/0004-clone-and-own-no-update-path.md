# The Starter is a snapshot: no update path for Adopters

**Status:** accepted — the README says so as of #16, under "The Starter is a snapshot".

An Adopter clones the Starter and owns the result outright. There is no supported way to pull later changes — including security fixes — back into a cloned project. We tag releases so an Adopter can identify what they started from, and nothing more.

We rejected a documented `upstream` merge path because it breaks the moment an Adopter edits Platform files, which is the entire purpose of the Platform. We rejected publishing the Platform as a versioned package because maintaining a framework is a different product from offering a starter.

## Consequences

- Security fixes made here will not reach existing Adopters. The README states this plainly rather than leaving it implied, and `docs/deployment.md` opens with it.
- The security posture at the moment of cloning is the posture that Adopter keeps, which is why the credential path is held to a production bar rather than a demonstration one.
