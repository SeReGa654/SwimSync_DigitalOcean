FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared-contracts/package.json shared-contracts/package.json
RUN npm ci

FROM deps AS build
COPY frontend frontend
COPY shared-contracts shared-contracts
ENV NODE_ENV=production
ENV NEXT_DIST_DIR=.next-prod
RUN npm --prefix frontend run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_DIST_DIR=.next-prod
RUN addgroup -S app && adduser -S app -G app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared-contracts/package.json shared-contracts/package.json
RUN npm ci --omit=dev
COPY --from=build /app/frontend frontend
RUN chown -R app:app /app
USER app
EXPOSE 3000
CMD ["npm", "--prefix", "frontend", "run", "start"]
