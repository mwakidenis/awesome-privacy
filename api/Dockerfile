FROM oven/bun:1-slim AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN bun run build:data

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787
CMD ["bun", "run", "src/index.node.ts"]
