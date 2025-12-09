FROM node:20-alpine
WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY packages/web/package.json packages/web/tsconfig.json packages/web/vite.config.ts ./packages/web/
COPY packages/web/index.html ./packages/web/
RUN npm install --workspace web

COPY packages/web/src ./packages/web/src
RUN npm run build -w web

EXPOSE 4173
CMD ["npm", "run", "preview", "-w", "web", "--", "--host", "0.0.0.0", "--port", "4173"]
