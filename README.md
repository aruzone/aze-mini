# Aze Starter

![Alt text](apps/aze-client/public/assets/aze-logo.png "Optional title")

[![CI](https://github.com/aruzone/aze-mini/actions/workflows/ci.yml/badge.svg)](https://github.com/aruzone/aze-mini/actions/workflows/ci.yml)

🚀 Starter template with **Nx, Next.js, NestJS, Prisma, Docker, Kubernetes, Helm & ArgoCD** — production-ready monorepo for modern full-stack apps.

# 🚀 Full-Stack Starter Template

A production-ready **starter template** built with cutting-edge tools and frameworks to accelerate modern full-stack application development. Designed for scalability, developer productivity, and cloud-native deployments.

---

## ✨ Features

- **Monorepo with Nx** – Efficiently manage multiple apps and shared libraries in a single workspace.  
- **Frontend: Next.js** – React-based framework with SSR, SSG, API routes, and full TypeScript support.  
- **Backend: NestJS** – Scalable server-side framework for building reliable APIs and microservices.  
- **Database: Prisma ORM** – Type-safe database client with schema-driven migrations.  
- **Caching: Redis** – One read path cached with an explicit TTL and invalidation on write, answering `X-Cache: HIT|MISS`. Fails open: without Redis the API is slower, never broken ([ADR-0005](docs/adr/0005-redis-cache-fails-open.md)).  

## ✨ Upcoming Features 
- **Containerization: Docker** – Seamless local development and environment parity.  
- **Orchestration: Kubernetes** – Scalable deployments across clusters.  
- **Helm Charts** – Declarative configuration management for Kubernetes apps.  
- **GitOps with ArgoCD** – Continuous Delivery with version-controlled Kubernetes deployments.  

---

## 📂 Project Structure

```

.
├── apps/
│   ├── aze-client/      # Next.js app as the Frontend app
│   └── aze-api/         # NestJS app as the Backend service
├── libs/                # Shared libraries
├── charts/              # Helm charts for K8s deployments
├── docker/              # Dockerfiles and Compose setup
└── infra/               # Kubernetes manifests & ArgoCD configs

````

---

## ⚡ Getting Started

### Prerequisites
- Node.js 24 — the version in `.nvmrc`, which CI and `package.json` engines both follow. `nvm use` picks it up
- Docker (required — Postgres and Redis run in containers; there is no file-based database fallback)
- Nx CLI
- NestJc CLI

### Clone & Install

```bash
git clone https://github.com/aruzone/aze-mini.git
cd aze-mini
npm install
```

### Run Aze API Backend

```
# START POSTGRES AND REDIS (from the repo root)
# --wait blocks until both are accepting connections
docker compose up -d --wait

# Running a second clone at the same time? Give it its own project name and
# host ports, then point that clone's apps/aze-api/.env at the ports it chose:
#   POSTGRES_PORT=5433 REDIS_PORT=6380 docker compose -p aze-two up -d --wait

# CREATE BACKEND ENV FILE
cd apps/aze-api
cp .env.example .env

# Then edit .env and replace API_KEY and JWT_SECRET. Both ship as placeholders,
# and the API refuses to start while either is still unedited.

# CREATE THE DATABASE SCHEMA
# migrate dev regenerates the Prisma client itself — no separate generate step
npx prisma migrate dev

# RUN BACKEND
nx serve aze-api
```
Backend → [http://localhost:3030/api](http://localhost:3030/api)

### Run Aze App Frontend

```
nx dev aze-client
```
Frontend → [http://localhost:3000](http://localhost:3000)

### Important Documentation Links
- [NestJS](https://docs.nestjs.com/)
- [NextJS](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs/orm)
---

## 🚀 Roadmap

* [ ] Add authentication (JWT / OAuth2)
* [x] Integrate caching (Redis)
* [ ] Add CI/CD pipeline (GitHub Actions / GitLab CI)
* [ ] Expand Helm charts with configurable values

---

## 📜 License

MIT License – feel free to use this template for your own projects.