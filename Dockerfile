# --- Build stage -----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Base URL the map fetches tiles from, e.g. https://tiles.ardy.host — must be
# set at build time since Vite inlines import.meta.env.* into the bundle.
# Defaults to Explv's upstream GitHub-hosted tiles if left unset.
ARG VITE_TILE_BASE_URL
ENV VITE_TILE_BASE_URL=${VITE_TILE_BASE_URL}

RUN npm run build

# --- Runtime stage -----------------------------------------------------------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD wget -qO- http://127.0.0.1:3003/health || exit 1
