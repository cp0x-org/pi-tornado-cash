FROM node:14 AS build

WORKDIR /app

COPY package*.json yarn.lock* ./
RUN yarn install --frozen-lockfile

COPY . .
# try to fix redirect to localhost in docker
ARG NUXT_ENV_BASE_URL=https://tornado.cp0x.com
ENV NUXT_ENV_BASE_URL=$NUXT_ENV_BASE_URL
RUN yarn generate

FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
