#!/bin/bash
# Usage: bash trigger-deploy.sh
# Pousse le code et déclenche le déploiement sur syndicpro.propnex.ma

WEBHOOK_URL="https://syndicpro.propnex.ma/webhook/deploy"
DEPLOY_TOKEN="673c8e666545af133e092545f4a922dd91d806d2295fe844f7a0ee36d88c3992"

echo "→ Push vers GitHub..."
git push origin claude/syndic-management-platform-21mHT

echo "→ Déclenchement du déploiement sur le VPS..."
curl -sS -X POST "$WEBHOOK_URL" \
  -H "Authorization: Bearer $DEPLOY_TOKEN" \
  --max-time 120 \
  -w "\n[HTTP %{http_code}]\n"
