# Dockerfile for NestJS application

# ---- Base Stage ----
# Use a specific Node.js version for reproducibility. Alpine is for a smaller image size.
FROM node:20-alpine AS base
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
WORKDIR /usr/src/app
# Install pnpm globally (stable pinned via lockfile)
RUN npm install -g pnpm

# ---- Dependencies Stage ----
# This stage is dedicated to installing all dependencies, including devDependencies needed for the build.
# It leverages Docker layer caching. This layer is only rebuilt when package.json or the lockfile changes.
FROM base AS dependencies
# Copy only package manifests to leverage Docker layer caching
COPY package.json pnpm-lock.yaml ./
# Install all dependencies (including dev) required for build
RUN pnpm install --frozen-lockfile

# ---- Build Stage ----
# This stage builds the TypeScript source code into JavaScript.
FROM dependencies AS build
# Copy source code and build
COPY . .
RUN pnpm build

# ---- Production Stage ----
# This is the final stage that will be used to create the production image.
# It starts from the base image again to keep it clean and small.
FROM base AS production
# Install curl for health checks
RUN apk add --no-cache curl
# Copy package manifests and install only production dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
# Copy built application from the build stage
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
