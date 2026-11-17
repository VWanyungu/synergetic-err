FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install build dependencies for native modules (e.g. bcrypt)
RUN apk add --no-cache python3 make g++

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS runner
# The commit this image was built from, reported by /health.
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["bun", "index.ts"]

