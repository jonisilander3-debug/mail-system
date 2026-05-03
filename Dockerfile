FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend

COPY prisma ./prisma
COPY public ./public
COPY src ./src
COPY frontend ./frontend

RUN npm --prefix frontend run build && npx prisma generate

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY prisma ./prisma
COPY public ./public
COPY src ./src
COPY --from=build /app/frontend/dist ./frontend/dist

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
