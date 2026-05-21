#!/bin/bash
set -e

# ============================================================
#  Déploiement Syndic Management Platform
#  À exécuter en tant que root sur le VPS
#  NON-DESTRUCTIF : ne touche pas aux autres projets Nginx/PM2
# ============================================================

REPO_URL="https://github.com/propnexma-medisan/claude.git"
BRANCH="claude/syndic-management-platform-21mHT"
APP_DIR="/opt/syndic"
DOMAIN="syndicpro.propnex.ma"
API_PORT=3001      # Port interne du backend (doit être libre sur le VPS)

# ─── Couleurs ───────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✔]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✘]${NC} $1"; exit 1; }

# ─── Vérifications préalables ───────────────────────────────
[ "$(id -u)" -eq 0 ] || error "Ce script doit être exécuté en root."

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     Déploiement Syndic Pro → $DOMAIN     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── [1/8] Vérifier que le port API est libre ───────────────
echo "────── [1/8] Vérification du port $API_PORT ──────"
if ss -tlnp | grep -q ":${API_PORT} "; then
  warn "Le port $API_PORT est déjà utilisé. Vérifiez avec : ss -tlnp | grep $API_PORT"
  warn "Modifiez API_PORT dans ce script si nécessaire."
  read -p "Continuer quand même ? (o/N) " cont
  [[ "$cont" =~ ^[oO]$ ]] || exit 0
fi
info "Port $API_PORT disponible."

# ─── [2/8] Dépendances système (sans upgrade global) ────────
echo "────── [2/8] Installation des outils système ──────"
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw
info "Nginx, certbot, git installés."

# Node.js 20 LTS (seulement si absent ou version < 18)
NODE_OK=false
if command -v node &>/dev/null; then
  NODE_VER=$(node -e "process.exit(parseInt(process.version.slice(1)))")  || true
  node -e "process.exit(parseInt(process.version.slice(1)) >= 18 ? 0 : 1)" && NODE_OK=true || true
fi
if [ "$NODE_OK" = false ]; then
  info "Installation de Node.js 20 LTS…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
info "Node $(node -v) — npm $(npm -v)"

# PM2 (global, partagé entre tous les projets)
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2 --silent
  info "PM2 installé."
else
  info "PM2 déjà présent ($(pm2 -v))."
fi

# ─── [3/8] Clonage / mise à jour du code ────────────────────
echo "────── [3/8] Récupération du code ──────"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull origin "$BRANCH"
  info "Dépôt mis à jour."
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  info "Dépôt cloné dans $APP_DIR."
fi

# ─── [4/8] Dépendances Node & build frontend ────────────────
echo "────── [4/8] npm install + build ──────"
cd "$APP_DIR"
npm install --silent --prefix .
cd backend  && npm install --silent && cd ..
cd frontend && npm install --silent && npm run build && cd ..
info "Build frontend terminé → $APP_DIR/frontend/dist"

# ─── [5/8] Variable d'environnement du port ─────────────────
echo "────── [5/8] Configuration .env ──────"
cat > "$APP_DIR/backend/.env" << ENV
NODE_ENV=production
PORT=$API_PORT
ENV
info ".env backend créé."

# ─── [6/8] PM2 — uniquement l'app syndic ───────────────────
echo "────── [6/8] PM2 — démarrage/redémarrage ──────"
cat > "$APP_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'syndic-api',
    script: './backend/server.js',
    cwd: '$APP_DIR',
    env: { NODE_ENV: 'production', PORT: $API_PORT },
    restart_delay: 3000,
    max_restarts: 10,
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
EOF

if pm2 describe syndic-api &>/dev/null; then
  pm2 reload syndic-api
  info "syndic-api rechargé."
else
  pm2 start "$APP_DIR/ecosystem.config.js"
  info "syndic-api démarré."
fi
pm2 save --force >/dev/null

# Configurer le démarrage automatique au boot (sans écraser les autres apps)
pm2 startup systemd -u root --hp /root 2>&1 | grep -v "^\[PM2\]" | bash 2>/dev/null || true
info "PM2 configuré pour démarrer au boot."

# ─── [7/8] Nginx — bloc dédié, sans toucher aux autres ──────
echo "────── [7/8] Nginx — vhost $DOMAIN ──────"
NGINX_CONF="/etc/nginx/sites-available/syndic-pro"

cat > "$NGINX_CONF" << NGINX
# ── Syndic Pro ── généré automatiquement ──────────────────
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend (SPA React buildée)
    root $APP_DIR/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API backend
    location /api/ {
        proxy_pass         http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }

    # Sécurité headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
}
NGINX

# Activer le site sans toucher aux autres symlinks
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/syndic-pro

# Tester la config avant de recharger
nginx -t && systemctl reload nginx
info "Nginx configuré pour $DOMAIN."

# ─── [8/8] SSL Let's Encrypt ────────────────────────────────
echo "────── [8/8] Certificat SSL (Let's Encrypt) ──────"
warn "Vérification DNS : $DOMAIN doit pointer vers $(curl -s ifconfig.me 2>/dev/null || echo 'cette IP')"
echo ""
read -p "Le DNS est-il configuré ? (o/N) : " dns_ok
if [[ "$dns_ok" =~ ^[oO]$ ]]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    -m admin@propnex.ma --redirect
  info "SSL activé — HTTPS configuré avec renouvellement automatique."
else
  warn "SSL ignoré. Une fois le DNS configuré, exécutez :"
  warn "  certbot --nginx -d $DOMAIN --redirect"
fi

# ─── UFW : ouvrir seulement ce qui est nécessaire ───────────
ufw allow OpenSSH    >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
ufw --force enable   >/dev/null 2>&1 || true

# ─── Résumé final ───────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║               Déploiement terminé !                 ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  URL       : https://$DOMAIN              ║"
echo "║  API       : https://$DOMAIN/api          ║"
echo "║  App dir   : $APP_DIR                       ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Commandes utiles :                                  ║"
echo "║    pm2 status          → état de tous les projets   ║"
echo "║    pm2 logs syndic-api → logs en temps réel         ║"
echo "║    pm2 restart syndic-api                           ║"
echo "║    nginx -t && systemctl reload nginx               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
