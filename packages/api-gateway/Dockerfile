FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY packages/api-gateway/package.json packages/api-gateway/tsconfig.json ./packages/api-gateway/
RUN npm install --workspace api-gateway

COPY packages/api-gateway/src ./packages/api-gateway/src
RUN npm run build -w api-gateway

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json ./
COPY packages/api-gateway/package.json ./packages/api-gateway/
RUN npm install --omit=dev --workspace api-gateway

COPY --from=builder /app/packages/api-gateway/dist ./packages/api-gateway/dist
COPY tsconfig.base.json ./

CMD ["npm", "run", "start", "-w", "api-gateway"]
