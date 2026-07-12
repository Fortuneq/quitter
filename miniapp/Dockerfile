# Сборка miniapp из репозитория и раздача статики nginx-ом.
# Контекст сборки — каталог miniapp/.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_BOT_USERNAME
ARG VITE_API_BASE
ENV VITE_BOT_USERNAME=$VITE_BOT_USERNAME
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
