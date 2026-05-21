#!/bin/bash
set -e

# ============================================================
#  Déploiement Syndic Management Platform
#  À exécuter en tant que root sur le VPS
# ============================================================

REPO_URL="https://github.com/propnexma-medisan/claude.git"
BRANCH="claude/syndic-management-platform-21mHT"
APP_DIR="/opt/syndic"
DOMAIN=""   # Laisser vide pour utiliser l'IP, ou mettre "syndic.mondomaine.com"
APP_PORT_API=3001
APP_PORT_FRONT=5173

echo "====== [1/7] Mise à jour du système ======"
apt-get update -qq && apt-get upgrade -y -qq

echo "====== [2/7] Installation des dépendances système ======"
apt-get install -y -qq curl git nginx ufw

# Node.js 20 LTS
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node: $(node -v) | npm: $(npm -v)"

# PM2
npm install -g pm2 --silent

echo "====== [3/7] Clonage du dépôt ======"
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" && git pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "====== [4/7] Installation des dépendances ======"
npm install --silent
cd backend && npm install --silent && cd ..
cd frontend && npm install --silent && npm run build && cd ..

echo "====== [5/7] Configuration PM2 (backend) ======"
cat > /opt/syndic/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'syndic-api',
    script: './backend/server.js',
    cwd: '/opt/syndic',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    restart_delay: 3000,
    max_restarts: 10
  }]
};
EOF

pm2 stop syndic-api 2>/dev/null || true
pm2 start /opt/syndic/ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo "====== [6/7] Configuration Nginx ======"
cat > /etc/nginx/sites-available/syndic << NGINX
server {
    listen 80;
    server_name ${DOMAIN:-_};

    # Frontend (fichiers statiques buildés)
    root /opt/syndic/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/syndic /etc/nginx/sites-enabled/syndic
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "====== [7/7] Pare-feu UFW ======"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "=============================================="
echo " Déploiement terminé !"
echo " Accès : http://76.13.55.3"
echo " API   : http://76.13.55.3/api"
echo " PM2   : pm2 status"
echo " Logs  : pm2 logs syndic-api"
echo "=============================================="
