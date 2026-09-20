FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
# REM-27: npm ci installs exactly what package-lock.json resolved and fails
# if the manifest and lockfile disagree, instead of npm install's looser
# best-effort resolution — the build is only as reproducible as its install
# step.
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_OIDC_AUTHORITY
ARG VITE_OIDC_CLIENT_ID
ENV VITE_OIDC_AUTHORITY=${VITE_OIDC_AUTHORITY}
ENV VITE_OIDC_CLIENT_ID=${VITE_OIDC_CLIENT_ID}
RUN npm run build

# The unprivileged image runs nginx as uid 101 with no capabilities and keeps
# its pid file and temporary paths under /tmp, so the container can run with a
# read-only root filesystem. The stock nginx image starts its master process as
# root, which is what Trivy's DS-0002 flags.
FROM nginxinc/nginx-unprivileged:1.30-alpine
# The packages carrying vulnerabilities in an image like this are the base
# image's own — openssl, musl, busybox — and nothing here installs anything, so
# nothing was ever upgrading them. A base tag is rebuilt on its own schedule,
# so an image built today can carry a library that was patched weeks ago and is
# still waiting for the tag to move.
#
# Root for the upgrade and back to the unprivileged uid immediately: the base
# image runs as 101 and the guarantee that it still does is stated below.
USER root
RUN apk upgrade --no-cache
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# The base image already runs as this uid; stating it here is what makes the
# guarantee visible to a reader and to a scanner, neither of which pulls the
# base image to find out.
USER 101
# 8080 rather than 80: an unprivileged process cannot bind a privileged port.
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
