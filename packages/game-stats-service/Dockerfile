FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY packages/game-stats-service/package.json packages/game-stats-service/tsconfig.json ./packages/game-stats-service/
RUN npm install --workspace game-stats-service

COPY packages/game-stats-service/src ./packages/game-stats-service/src
RUN npm run build -w game-stats-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4004

COPY package*.json ./
COPY packages/game-stats-service/package.json ./packages/game-stats-service/
RUN npm install --omit=dev --workspace game-stats-service

COPY --from=builder /app/packages/game-stats-service/dist ./packages/game-stats-service/dist
COPY tsconfig.base.json ./

CMD ["npm", "run", "start", "-w", "game-stats-service"]
