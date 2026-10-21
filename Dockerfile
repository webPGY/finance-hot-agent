# 多阶段构建
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate

# 构建阶段：自动跑 migration + build
FROM base AS builder
ENV NODE_ENV=production
RUN npm run build

# 生产阶段
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts

# 容器启动：自动建表迁移 + seed，再启动服务
# 保证数据库零介入
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npm run start"]
