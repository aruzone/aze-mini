# Postgres only, no SQLite

The Starter previously used SQLite, which cannot survive a pod restart or a second replica — a direct contradiction of the Docker and Kubernetes deployment path the Starter ships. Prisma pins the provider in `migration_lock.toml` and generates provider-specific migrations, so "SQLite locally, Postgres in production" would mean two schemas and two migration histories rather than a config flag. We removed SQLite entirely and made Postgres (via `docker-compose`) the only supported database.

## Consequences

- Docker is a hard prerequisite for running the Starter. An Adopter can no longer clone and run `prisma migrate dev` against a file — they start Postgres first.
- The original SQLite migration history was deleted and regenerated against Postgres.
