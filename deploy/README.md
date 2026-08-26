# Deploying the Starter

> **This is barebones, and it is Demo.** It shows the shape of a deployment —
> two Deployments, two Services, a migration hook, secrets by reference. It has
> not been reviewed for your cluster, your compliance regime or your traffic,
> and nothing here should carry anything real until you have read all of it and
> made it yours. See `docs/demo.md`.

```
deploy/
  helm/aze/          The chart: API, client, and the migration job
  argocd/            One Application pointing at that chart
```

Raw manifests are deliberately absent. A chart and the manifests it renders are
the same information twice, and the copy is the one that goes stale.

## Building the images

Both come from this repository, and both need the repository root as the build
context:

```bash
docker build -f apps/aze-api/Dockerfile    -t ghcr.io/your-org/aze-api:v0.1.0     .
docker build -f apps/aze-client/Dockerfile -t ghcr.io/your-org/aze-client:v0.1.0  .

# The migration job runs the API Dockerfile's `migrator` stage, which carries
# the Prisma CLI that the runtime image deliberately does not.
docker build -f apps/aze-api/Dockerfile --target migrator \
  -t ghcr.io/your-org/aze-migrate:v0.1.0 .
```

`AZE_API_URL` is read by the client's server at request time rather than
compiled in, so one client image serves every environment. The chart points it
at the API's Service.

## Installing

Secrets first, somewhere built to hold them, then the chart by reference:

```bash
helm upgrade --install aze deploy/helm/aze \
  --namespace aze --create-namespace \
  --set secrets.existingSecret=aze-secrets \
  --set api.image.repository=ghcr.io/your-org/aze-api \
  --set api.image.tag=v0.1.0 \
  --set client.image.repository=ghcr.io/your-org/aze-client \
  --set client.image.tag=v0.1.0 \
  --set migrate.image.repository=ghcr.io/your-org/aze-migrate \
  --set migrate.image.tag=v0.1.0
```

The Secret it expects carries `DATABASE_URL`, `JWT_SECRET`, `API_KEY` and
optionally `REDIS_URL`. The chart can render one from values instead, and says
loudly that it should not: a value passed to Helm is kept in the release's own
Secret in the cluster, in the clear, for every revision Helm retains.

## What this chart leaves to you

Each of these is a decision, not an omission:

| Not rendered | Why, and what to do |
| --- | --- |
| **Ingress / Gateway** | Controller, class, annotations and TLS issuer vary too much between clusters for a guess to be worth anything. Write your own; the two Services are what it points at. |
| **TLS** | Follows the Ingress. Until it exists, the session cookie's `secure` flag is doing nothing for you. |
| **Postgres** | A database wants backups, failover and upgrade paths that a Deployment in a barebones chart would not give it — and would be trusted anyway. Use a managed service or an operator. `docker-compose.yml` is the local one. |
| **Redis** | Same, though the cache fails open, so an unreachable Redis costs speed and nothing else (ADR-0005). |
| **HorizontalPodAutoscaler** | Needs metrics and a load profile that only you have. `replicas` is a fixed number here. |
| **NetworkPolicy** | Nothing stops any pod in the cluster reaching the API. Your cluster's default posture decides whether that matters. |
| **PodDisruptionBudget** | Two replicas and no budget means a drain can take both. |
| **Backups** | Nothing here backs anything up. |

## Before you deploy

The checklist lives in one place, `docs/deployment.md`, because it is not only
about Kubernetes. Read it.
