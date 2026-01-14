# Polymarket Tracker Dockerfile
#
# Multi-stage build for development and production
#
# Build targets:
#   development - Hot reloading, debugging, local development
#   production  - Optimized, minimal image for deployment
#
# Usage:
#   Development: docker build --target development -t polymarket-tracker:dev .
#   Production:  docker build --target production -t polymarket-tracker:prod .

# ============================================================================
# Base stage: Common dependencies and setup
# ============================================================================
FROM node:20-alpine AS base

# Install dependencies needed for building and Prisma
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    wget

WORKDIR /app

# ============================================================================
# Dependencies stage: Install all dependencies
# ============================================================================
FROM base AS deps

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install all dependencies (including devDependencies for Prisma generate)
RUN pnpm install --frozen-lockfile

# ============================================================================
# Development stage: Hot reloading, debugging
# ============================================================================
FROM base AS development

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose Next.js port
EXPOSE 3000

# Set environment
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Run development server with hot reloading
CMD ["pnpm", "dev"]

# ============================================================================
# Builder stage: Build the production application
# ============================================================================
FROM base AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Set production environment for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN pnpm build

# ============================================================================
# Production stage: Minimal, optimized image
# ============================================================================
FROM base AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public

# Set ownership for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Copy standalone build (includes node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health?simple=true || exit 1

# Run the application
CMD ["node", "server.js"]
