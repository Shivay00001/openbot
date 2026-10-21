FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/database ./packages/database
COPY packages/shared-types ./packages/shared-types
COPY packages/core ./packages/core
COPY services/api-gateway ./services/api-gateway

RUN npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./

RUN npm run build --prefix packages/database
RUN npm run build --prefix packages/core
RUN npm run build --prefix services/api-gateway

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /app/services/api-gateway/package.json ./services/api-gateway/package.json

USER nestjs

EXPOSE 4000

CMD ["node", "services/api-gateway/dist/main.js"]
