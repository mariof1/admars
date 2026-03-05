FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY server/package.json server/tsconfig.json ./server/
COPY client/package.json client/tsconfig.json client/vite.config.ts client/postcss.config.js client/tailwind.config.ts ./client/

RUN npm install --workspaces --include-workspace-root

COPY server/src ./server/src
COPY client/src ./client/src
COPY client/index.html ./client/
COPY client/public ./client/public

RUN npm run build --workspace=client
RUN npm run build --workspace=server

# --- Production ---
FROM node:20-alpine

RUN addgroup -S admars && adduser -S admars -G admars

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

RUN cd server && npm install --omit=dev

RUN mkdir -p /data && chown admars:admars /data

ENV NODE_ENV=production
ENV PORT=4000
ENV DATA_DIR=/data

EXPOSE 4000
VOLUME ["/data"]

USER admars

CMD ["node", "server/dist/index.js"]
