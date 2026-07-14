FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    URL_ANALYSIS_ENABLED=false

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node --input-type=module -e "const response = await fetch('http://127.0.0.1:8080/api/health'); process.exit(response.ok ? 0 : 1)"

CMD ["node", "apps/web/server.mjs"]
