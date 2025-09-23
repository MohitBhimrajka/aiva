# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build arguments that will be used as environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application with environment variables embedded
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS prod
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built app from builder using the standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to the non-root user
USER nextjs

EXPOSE 3000

# Health check for the Next.js application (Optional but good practice)
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD wget -q --spider http://localhost:3000/ || exit 1

# Use the standalone server to run the app
CMD ["node", "server.js"]