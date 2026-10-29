#!/bin/bash
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin:~/.nvm/versions/node/$(ls ~/.nvm/versions/node 2>/dev/null | tail -n 1)/bin

APP_DIR="/var/www/html/sistema-traspaso-slep"
cd "$APP_DIR" || exit 1

# Consultar cambios en GitHub
git fetch origin main --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Nuevo cambio detectado ($REMOTE). Actualizando..."
    git reset --hard origin/main
    chmod +x "$APP_DIR/deploy.sh"
    pm2 restart all
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Actualización completada."
fi
