# bcryptjs for password hashing, not argon2

**Status:** accepted — implemented in #4.

OWASP recommends argon2id ahead of bcrypt, so this choice looks wrong at a glance. We chose `bcryptjs` because it is pure JavaScript: `argon2` and native `bcrypt` require `node-gyp`, a Python toolchain, and matching build stages in the Dockerfile the Starter intends to ship (#13). For a Starter distributed to strangers, every native dependency is a way a first `npm install` or `docker build` fails before the Adopter has seen anything work. All three algorithms are adequate here, and an Adopter with stricter requirements swaps a single module.

Do not "upgrade" this to argon2 without also solving the cross-platform install and multi-stage Docker build it drags in.
