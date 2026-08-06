# 1. Build stage
FROM node:16 AS build

WORKDIR /app

ENV NUXT_TELEMETRY_DISABLED=1

COPY package*.json yarn.lock* ./
RUN yarn install --frozen-lockfile

COPY . .

ARG NUXT_ENV_BASE_URL=https://tornado.cp0x.com
ENV NUXT_ENV_BASE_URL=$NUXT_ENV_BASE_URL
ENV BASE_URL=$NUXT_ENV_BASE_URL
ENV NUXT_BASE_URL=$NUXT_ENV_BASE_URL
ENV NODE_ENV=production

RUN yarn build
RUN yarn generate

# 2. Runtime stage
FROM node:16 AS runtime

WORKDIR /app

# Ставим все зависимости (можно с --production, но лучше полностью)
COPY package*.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Копируем сборку
COPY --from=build /app/dist ./dist
COPY --from=build /app/.nuxt ./.nuxt
COPY --from=build /app/static ./static
COPY --from=build /app/nuxt.config.js ./

# Скрипты обновления кешей и их зависимости (нужны контейнеру cache-updater,
# который использует этот же образ — см. docker-compose.yml)
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/abis ./abis
COPY --from=build /app/networkConfig.js /app/rpcConfig.js ./

ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NUXT_ENV_BASE_URL=https://tornado.cp0x.com
ENV BASE_URL=https://tornado.cp0x.com
ENV NUXT_BASE_URL=https://tornado.cp0x.com

EXPOSE 3000

CMD ["yarn", "start"]
