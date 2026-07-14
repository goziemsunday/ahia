FROM oven/bun:1.3.11 AS base

# --- PREPARE STAGE ---
FROM base AS prepare
WORKDIR /app

RUN bun add -g turbo@^2.9.6

COPY . .

RUN turbo prune @repo/nest --docker

# --- BUILDER STAGE ---
FROM base AS builder
WORKDIR /app

COPY --from=prepare /app/out/json/ .
COPY --from=prepare /app/out/full/packages ./packages
# hoisted linker: flattens all deps into root node_modules/ so a single COPY
# captures everything for the runner, keeping the image small and simple
RUN bun install --linker=hoisted

COPY --from=prepare /app/out/full/ .

RUN bunx turbo run build --filter=@repo/nest
RUN bun build --compile packages/db/src/migrate.ts --outfile migrate-exe

# --- RUNNER STAGE ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME="0.0.0.0" \
    PORT=5000

COPY --from=builder /app/apps/nest/dist ./dist
COPY --from=builder /app/migrate-exe ./migrate-exe
COPY --from=builder /app/packages/db/src/migrations ./migrations
COPY --from=builder /app/node_modules ./node_modules
# hoisted linker symlinks @repo/* packages into node_modules — copy their
# source to the runner so those symlinks resolve at runtime
COPY --from=builder /app/packages ./packages

USER bun
EXPOSE 5000

ENTRYPOINT [ "/bin/sh", "-c", "./migrate-exe && bun run dist/main" ]
