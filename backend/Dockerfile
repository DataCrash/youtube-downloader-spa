FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg \
  && curl -fL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod 0755 /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci --workspace backend

COPY backend ./backend
RUN npm run build --workspace backend && npm prune --omit=dev --workspace backend

RUN mkdir -p /downloads && chown -R node:node /downloads /app/backend
USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV DOWNLOAD_ROOT=/downloads

EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
