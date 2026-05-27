FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared-contracts/package.json shared-contracts/package.json
COPY backend/prisma backend/prisma
RUN npm ci && npx prisma generate --schema backend/prisma/schema.prisma

FROM deps AS build
COPY backend backend
COPY shared-contracts shared-contracts
RUN npm run contracts:generate && npm --prefix backend run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared-contracts/package.json shared-contracts/package.json
RUN npm ci --omit=dev
COPY --from=build /app/backend/prisma backend/prisma
RUN npx prisma generate --schema backend/prisma/schema.prisma
COPY --from=build /app/backend/dist backend/dist
RUN chown -R app:app /app
USER app
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy --schema backend/prisma/schema.prisma && npm --prefix backend run start:prod"]
