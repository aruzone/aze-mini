# syntax=docker/dockerfile:1

# Node matches .nvmrc and package.json engines — change one and change all
# three, as CLAUDE.md says.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `output: 'standalone'` in next.config.js is what makes the runtime stage
# below need no install of its own.
RUN npx nx build aze-client


FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# Next binds to localhost by default, which nothing outside the container can
# reach.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# The standalone build carries the server and only the node_modules it reaches.
COPY --from=builder /app/apps/aze-client/.next/standalone ./
# Static assets and anything under public/ are the two things standalone leaves
# behind, because a deployment may serve them from a CDN instead.
COPY --from=builder /app/apps/aze-client/.next/static ./apps/aze-client/.next/static
COPY --from=builder /app/apps/aze-client/public ./apps/aze-client/public

USER node
EXPOSE 3000
CMD ["node", "apps/aze-client/server.js"]
