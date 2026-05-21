#!/bin/bash
# ============================================================
#  Installation du webhook de déploiement automatique
#  À exécuter sur le VPS après le premier déploiement
# ============================================================

APP_DIR="/opt/syndic"
DEPLOY_TOKEN="673c8e666545af133e092545f4a922dd91d806d2295fe844f7a0ee36d88c3992"
WEBHOOK_PORT=9001

echo "====== Installation du webhook de déploiement ======"

# Ajouter le token au .env backend
grep -q "DEPLOY_TOKEN" "$APP_DIR/backend/.env" || \
  echo "DEPLOY_TOKEN=$DEPLOY_TOKEN" >> "$APP_DIR/backend/.env"
grep -q "WEBHOOK_PORT" "$APP_DIR/backend/.env" || \
  echo "WEBHOOK_PORT=$WEBHOOK_PORT" >> "$APP_DIR/backend/.env"

# Ajouter webhook dans l'ecosystem PM2
cat > "$APP_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [
    {
      name: 'syndic-api',
      script: './backend/server.js',
      cwd: '$APP_DIR',
      env_file: '$APP_DIR/backend/.env',
      env: { NODE_ENV: 'production', PORT: 3001 },
      restart_delay: 3000,
      max_restarts: 10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'syndic-webhook',
      script: './backend/webhook.js',
      cwd: '$APP_DIR',
      env_file: '$APP_DIR/backend/.env',
      env: {
        DEPLOY_TOKEN: '$DEPLOY_TOKEN',
        WEBHOOK_PORT: '$WEBHOOK_PORT',
        APP_DIR: '$APP_DIR',
        BRANCH: 'claude/syndic-management-platform-21mHT'
      },
      restart_delay: 3000,
      max_restarts: 5
    }
  ]
};
EOF

pm2 start "$APP_DIR/ecosystem.config.js" --only syndic-webhook 2>/dev/null || \
  pm2 reload syndic-webhook
pm2 save --force >/dev/null

# Ajouter le endpoint /webhook/deploy dans Nginx
NGINX_CONF="/etc/nginx/sites-available/syndic-pro"
if ! grep -q "webhook" "$NGINX_CONF"; then
  sed -i '/add_header X-Frame-Options/i\
    location /webhook/deploy {\
        proxy_pass         http://127.0.0.1:'"$WEBHOOK_PORT"'\/deploy;\
        proxy_read_timeout 300s;\
        proxy_buffering    off;\
    }\
' "$NGINX_CONF"
  nginx -t && systemctl reload nginx
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          Webhook de déploiement installé !          ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  URL : https://syndicpro.propnex.ma/webhook/deploy  ║"
echo "║  Token : $DEPLOY_TOKEN  ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Test :                                              ║"
echo "║  curl -X POST https://syndicpro.propnex.ma/webhook/ ║"
echo "║  deploy -H 'Authorization: Bearer $DEPLOY_TOKEN'    ║"
echo "╚══════════════════════════════════════════════════════╝"
