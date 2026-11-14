# On the machine that builds, whatever the image is for (amd64 and arm64 get the
# same files): the build runs once and never emulated
FROM --platform=$BUILDPLATFORM oven/bun:1-alpine AS build-stage
WORKDIR /app

# Installing is cheap enough (~8s) that the build no longer tries to cache it.
# Caching it meant pulling a 577 MB node_modules layer out of the GitHub Actions
# cache before anything else could run, which cost far more than the install it
# was saving -- see the cache settings in .github/workflows/main.yml.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY index.html .
COPY vite.config.ts .
COPY public public
COPY src src
# all of them: Vite reads tsconfig.json and follows its references
COPY tsconfig*.json ./

# Vite compiles the .ts without checking the types: a type error fails the image
# here instead, so it never gets deployed. The page and the workers (bench/ and
# e2e/ are not in the image); TypeScript 7 takes a few seconds.
RUN bunx tsc --noEmit -p tsconfig.app.json && bunx tsc --noEmit -p tsconfig.worker.json

RUN bun run build

# The commit this image was built from (the workflow passes it, and so does a
# build by hand for another site: --build-arg REVISION=<commit>), at
# /version.json: the site's backend reads it there, and the admin page's Sites
# tab shows which build each site serves. Written here rather than in the last
# stage, so that stage runs nothing and an arm64 image needs no emulation.
ARG REVISION=
RUN printf '{"revision":"%s"}\n' "$REVISION" > /app/build/version.json


# alpine-slim rather than alpine: the difference is the njs and geoip modules
# and the extra entrypoint scripts, none of which this config touches -- it uses
# core http features only. 69 MB against 18.9 MB, which is most of the image.
FROM nginx:alpine-slim

COPY --from=build-stage /app/build/ /files
COPY nginx.conf /etc/nginx/conf.d/default.conf
