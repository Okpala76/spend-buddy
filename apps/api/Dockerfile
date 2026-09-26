FROM node:22-alpine AS builder

WORKDIR /app

# Root workspace manifests
COPY package.json package-lock.json ./

# API package manifest
COPY apps/api/package.json ./apps/api/package.json

# Install monorepo dependencies
RUN npm ci

# Copy API source
COPY apps/api ./apps/api

# Build API
RUN npm --prefix apps/api run build


FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]