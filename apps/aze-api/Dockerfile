# syntax=docker/dockerfile:1

# Node matches .nvmrc and package.json engines. Change one and change all three
# — CLAUDE.md says so, and this is the third.
ARG NODE_VERSION=24

# Debian rather than Alpine: Prisma's query engine wants glibc and OpenSSL, and
# the musl build needs a binaryTarget in the schema that nothing else here
# needs. Nothing in the dependency tree compiles — passwords are bcryptjs, not
# bcrypt (ADR-0003) — so no build toolchain is installed at any stage.
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Generate before building: the bundle bakes in the path of the query engine
# that exists at build time, so this has to run on the image's platform rather
# than on whatever machine `docker build` was typed on.
WORKDIR /app/apps/aze-api
RUN npx prisma generate
WORKDIR /app
RUN npx nx build aze-api


# Migrations run from the build's own dependency tree. The Prisma CLI is a
# development dependency that drags in the engines package, and the runtime
# image below has no reason to carry either — so rather than reassembling a
# working CLI over there, the `migrate` service in docker-compose.yml targets
# this stage. It shares every layer with the builder, so it costs nothing to
# build and nothing to pull.
FROM builder AS migrator
WORKDIR /app/apps/aze-api
CMD ["npx", "prisma", "migrate", "deploy"]


FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# The generated client keeps the directory it was generated in, because the
# bundle refers to the engine by a path relative to that. Flattening the two
# into one directory would leave Prisma looking for an engine that is no
# longer where it was told.
COPY --from=builder /app/apps/aze-api/generated ./apps/aze-api/generated

# nx build writes a package.json naming only what the bundle did not inline,
# so this installs the runtime tree rather than carrying the build's.
COPY --from=builder /app/dist/apps/aze-api ./dist/apps/aze-api
RUN cd dist/apps/aze-api && npm ci --omit=dev

USER node
EXPOSE 3030
CMD ["node", "dist/apps/aze-api/main.js"]
