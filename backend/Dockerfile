FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# Development stage
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Builder stage
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
RUN npx prisma generate
EXPOSE 3000
CMD ["node", "dist/main"]
