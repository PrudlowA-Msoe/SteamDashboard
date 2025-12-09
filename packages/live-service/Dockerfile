FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY packages/live-service/package.json packages/live-service/tsconfig.json ./packages/live-service/
RUN npm install --workspace live-service

COPY packages/live-service/src ./packages/live-service/src
RUN npm run build -w live-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4003

COPY package*.json ./
COPY packages/live-service/package.json ./packages/live-service/
RUN npm install --omit=dev --workspace live-service

COPY --from=builder /app/packages/live-service/dist ./packages/live-service/dist
COPY tsconfig.base.json ./

CMD ["npm", "run", "start", "-w", "live-service"]
