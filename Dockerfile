# Service Recettes pour Raspberry Pi (arm64) : API d'import + version web de l'app
FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --no-audit --no-fund

COPY packages/core packages/core
COPY apps/server apps/server
COPY apps/mobile apps/mobile

# La version web parle à l'API sur la même origine → EXPO_PUBLIC_SERVER_URL vide
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_SERVER_URL=""
RUN cd apps/mobile && npx expo export --platform web

WORKDIR /app/apps/server
ENV NODE_ENV=production PORT=8787 WEB_DIST=/app/apps/mobile/dist
EXPOSE 8787
CMD ["npx", "tsx", "src/index.ts"]
