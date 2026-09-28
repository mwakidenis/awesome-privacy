###############################################################################
# A lightweight, non-root, multi-stage, cross-architecture Dockerfile         #
# That you can use in order to easily deploy Awesome Privacy to any server    #
# For docs visit the GitHub repo: https://github.com/lissy93/awesome-privacy  #
# Licensed under MIT (C) Alicia Sykes <https://aliciasykes.com> 2024          #
###############################################################################
# Usage:                                                                      #
# Step 1: Build the Docker image                                              #
# docker build -t awesome-privacy .                                           #
#                                                                             #
# Step 2: Run the Docker container                                            #
# docker run -p 8080:80 awesome-privacy                                       #
#                                                                             #
# Step 3: Access the running app                                              #
# Open your browser and navigate to http://127.0.0.1:8080                     #
###############################################################################

# Stage 1: Install deps
FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
RUN yarn install --immutable

# Stage 2: Build the site (SSG + standalone Node server)
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DEPLOY_TARGET=node OUTPUT=static
RUN yarn build

# Stage 3: Production runtime (non-root, minimal)
FROM node:24-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
USER app
ENV HOST=0.0.0.0 PORT=80
EXPOSE 80
CMD ["node", "dist/server/entry.mjs"]
