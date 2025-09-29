# Multi-stage Docker build for production-optimized frontend
# Stage 1: Build environment
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install security updates and build dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S frontend -u 1001

# Copy package files
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies with security audit
RUN npm ci --only=production --audit --audit-level=moderate && \
    npm cache clean --force

# Copy source code
COPY --chown=frontend:nodejs . .

# Build the application
RUN npm run build

# Stage 2: Production environment
FROM nginx:1.25-alpine AS production

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S frontend -u 1001 -G nginx-app

# Copy built application from builder stage
COPY --from=builder --chown=frontend:nginx-app /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY --chown=frontend:nginx-app nginx.conf /etc/nginx/nginx.conf
COPY --chown=frontend:nginx-app nginx-default.conf /etc/nginx/conf.d/default.conf

# Create necessary directories and set permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R frontend:nginx-app /var/cache/nginx /var/log/nginx /var/run /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Remove default nginx user and switch to non-root user
RUN deluser nginx || true
USER frontend

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Security labels
LABEL maintainer="Dyad CLI Gateway Team" \
      version="1.0.0" \
      description="Production-ready frontend for Dyad CLI Gateway Admin UI" \
      security.scan="enabled" \
      security.non-root="true"