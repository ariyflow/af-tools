# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json vite.config.ts tsup.config.ts ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ARG APK_MIRROR=https://mirrors.aliyun.com/alpine
RUN sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${APK_MIRROR}|g" /etc/apk/repositories \
    && apk add --no-cache ffmpeg tini

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    TEMP_DIR=/app/tmp

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
RUN mkdir -p /app/tmp && chown -R node:node /app

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server/index.js"]
