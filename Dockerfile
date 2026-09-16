FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
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
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# The base image already runs as this uid; stating it here is what makes the
# guarantee visible to a reader and to a scanner, neither of which pulls the
# base image to find out.
USER 101
# 8080 rather than 80: an unprivileged process cannot bind a privileged port.
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
