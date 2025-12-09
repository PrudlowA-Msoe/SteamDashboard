FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY packages/metadata-service/package.json packages/metadata-service/tsconfig.json ./packages/metadata-service/
RUN npm install --workspace metadata-service

COPY packages/metadata-service/src ./packages/metadata-service/src
RUN npm run build -w metadata-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4002

COPY package*.json ./
COPY packages/metadata-service/package.json ./packages/metadata-service/
RUN npm install --omit=dev --workspace metadata-service

COPY --from=builder /app/packages/metadata-service/dist ./packages/metadata-service/dist
COPY tsconfig.base.json ./

CMD ["npm", "run", "start", "-w", "metadata-service"]
