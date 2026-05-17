# Backend API — Dockploy service (build context: repository root).
# Dockerfile path in Dockploy: api/Dockerfile

FROM node:20-alpine
WORKDIR /app/api

RUN apk add --no-cache tini

COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev

COPY api/ ./

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV TRUST_PROXY=true

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
