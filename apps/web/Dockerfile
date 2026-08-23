# Build context is apps/web.
FROM node:20-alpine AS build

WORKDIR /app
# Lockfile + `npm ci`: a deterministic, resolver-free install. `npm install`
# re-resolves the tree on every build, which is what timed out the first
# Coolify build with no error output.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# Baked into the client bundle at build time — in Coolify these must be marked
# Build Variable, and changing them needs a rebuild, not a restart.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ARG NEXT_PUBLIC_PROVIDER_LABEL=""
ENV NEXT_PUBLIC_PROVIDER_LABEL=$NEXT_PUBLIC_PROVIDER_LABEL

RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
