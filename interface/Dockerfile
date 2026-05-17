# Frontend static site — Dockploy service (build context: repository root).
# Dockerfile path in Dockploy: interface/Dockerfile
#
# Required build arg (Dockploy → Build → Build Args):
#   VITE_API_URL=https://api.usxicbooks.cloud/api

FROM node:20-alpine AS build
WORKDIR /app/interface

COPY interface/package.json interface/package-lock.json ./
RUN npm ci

COPY interface/ ./

ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "ERROR: Set build arg VITE_API_URL (e.g. https://api.usxicbooks.cloud/api)" && exit 1)
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY interface/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/interface/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1
