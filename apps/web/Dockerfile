FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/core ./packages/core
COPY packages/shared-types ./packages/shared-types
COPY apps/web ./apps/web

RUN npm install

# Build the project
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./

RUN npm run build --prefix packages/core
RUN npm run build --prefix apps/web

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start", "--prefix", "apps/web"]
