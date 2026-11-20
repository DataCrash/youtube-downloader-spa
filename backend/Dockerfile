FROM node:20-bookworm-slim

ARG DENO_VERSION=2.6.3

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg python3 unzip \
  && mkdir -p /home/node/.local/bin \
  && curl --proto '=https' --proto-redir '=https' -fL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /home/node/.local/bin/yt-dlp \
  && curl --proto '=https' --proto-redir '=https' -fL "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip" -o /tmp/deno.zip \
  && unzip -q /tmp/deno.zip -d /usr/local/bin \
  && rm /tmp/deno.zip \
  && chmod 0755 /home/node/.local/bin/yt-dlp \
  && chown -R node:node /home/node/.local \
  && chmod 0755 /usr/local/bin/deno \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci --workspace backend

COPY backend ./backend
COPY --chmod=0755 backend/yt-dlp-wrapper.sh /usr/local/bin/yt-dlp
RUN npm run build --workspace backend && npm prune --omit=dev --workspace backend

RUN mkdir -p /downloads && chown -R node:node /downloads /app/backend
USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV DOWNLOAD_ROOT=/downloads
ENV PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
