# ============================================================
# Stage 1: Build all apps
# ============================================================
FROM node:22-slim AS builder

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace config first for better layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy all workspace package.json files
COPY lib/ lib/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/community-website/package.json artifacts/community-website/
COPY artifacts/admin-dashboard/package.json artifacts/admin-dashboard/

# Install all dependencies (dev + prod)
RUN pnpm install --frozen-lockfile

# Copy full source
COPY . .

# Build API server (esbuild — partially bundled, some packages externalized)
RUN pnpm --filter @workspace/api-server run build

# Build community website (served at /)
RUN BASE_PATH=/ PORT=3000 NODE_ENV=production pnpm --filter @workspace/community-website run build

# Build admin dashboard (served at /admin/)
RUN BASE_PATH=/admin/ PORT=3001 NODE_ENV=production pnpm --filter @workspace/admin-dashboard run build

# ============================================================
# Stage 2: Production image
# ============================================================
FROM node:22-slim AS production

WORKDIR /app

# Install runtime-only native dependencies that esbuild externalises.
# Using npm here avoids the pnpm workspace minimumReleaseAge constraint.
RUN npm install --no-save \
    @google-cloud/storage@^7 \
    google-auth-library@^10 \
    sharp@^0.34

# Copy the bundled API server and its pino worker side-files
COPY --from=builder /app/artifacts/api-server/dist ./dist

# Copy Vite-built static sites
COPY --from=builder /app/artifacts/community-website/dist/public ./static/community
COPY --from=builder /app/artifacts/admin-dashboard/dist/public  ./static/admin

# Create the uploads directory (overridden by Docker volume on VPS)
RUN mkdir -p /data/uploads

ENV NODE_ENV=production
ENV PORT=8081
ENV STATIC_DIR=/app/static
ENV STORAGE_TYPE=local
ENV LOCAL_STORAGE_PATH=/data/uploads

EXPOSE 8081

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
