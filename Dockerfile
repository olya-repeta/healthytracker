# Multi-stage Dockerfile for Modular Monolith (Backend + Static Frontend or Standalone Services)

# Stage 1: Build Backend
FROM node:20-alpine AS backend-builder
RUN apk add --no-cache openssl
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# Stage 2: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ARG VITE_API_URL=/api
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# Stage 3: Production Backend Runtime
FROM node:20-alpine AS backend-production
RUN apk add --no-cache openssl
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]

# Stage 4: Production Frontend Runtime (Nginx)
FROM nginx:alpine AS frontend-production
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
