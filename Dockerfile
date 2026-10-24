# Obraz pro nasazení hry LangWar
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    DB_FILE=/data/langwar.db \
    BACKUP_DIR=/data/backups

WORKDIR /app

# Nejdřív jen závislosti, ať se při změně kódu nemusí znovu instalovat
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY client ./client

# Databáze a zálohy leží na trvalém disku, který se připojí do /data
RUN mkdir -p /data && chown node:node /data
VOLUME /data

# Neběžet jako root
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/server.js"]
