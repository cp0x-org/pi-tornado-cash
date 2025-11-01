# 1. Сборка
FROM node:14 AS build

WORKDIR /app

COPY package*.json yarn.lock* ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn generate

# 2. Продакшн
FROM nginx:alpine

# Чистим дефолтный html и копируем собранный дист
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
