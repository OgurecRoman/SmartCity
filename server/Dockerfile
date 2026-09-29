# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# prisma.config.ts / postinstall generate требуют DATABASE_URL
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"

RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY openapi.yaml ./
COPY certs ./certs

RUN npm run build \
 && npm prune --omit=dev \
 && npm install prisma@7.10.0 --no-save --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    NODE_EXTRA_CA_CERTS=/app/certs/russian_trusted_ca.pem

RUN addgroup -S app && adduser -S app -G app \
 && chown -R app:app /app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/certs ./certs
COPY --from=build --chown=app:app /app/openapi.yaml ./openapi.yaml

USER app
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
