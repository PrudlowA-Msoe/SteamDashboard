FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY packages/auth-service/package.json packages/auth-service/tsconfig.json ./packages/auth-service/
RUN npm install --workspace auth-service

COPY packages/auth-service/src ./packages/auth-service/src
RUN npm run build -w auth-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4001

COPY package*.json ./
COPY packages/auth-service/package.json ./packages/auth-service/
RUN npm install --omit=dev --workspace auth-service

COPY --from=builder /app/packages/auth-service/dist ./packages/auth-service/dist
COPY tsconfig.base.json ./

CMD ["npm", "run", "start", "-w", "auth-service"]
