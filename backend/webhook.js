const http = require('http');
const { execSync } = require('child_process');
const crypto = require('crypto');

const TOKEN = process.env.DEPLOY_TOKEN || 'changeme';
const PORT  = process.env.WEBHOOK_PORT || 9001;
const APP_DIR = process.env.APP_DIR || '/opt/syndic';

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/deploy') {
    res.writeHead(404).end('Not found');
    return;
  }

  const auth = req.headers['authorization'] || '';
  const provided = auth.replace('Bearer ', '').trim();
  const valid = crypto.timingSafeEqual(
    Buffer.from(provided.padEnd(64)),
    Buffer.from(TOKEN.padEnd(64))
  );

  if (!valid) {
    res.writeHead(401).end('Unauthorized');
    console.log(`[webhook] Tentative non autorisée depuis ${req.socket.remoteAddress}`);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('Déploiement démarré...\n');

  try {
    const branch = process.env.BRANCH || 'claude/syndic-management-platform-21mHT';
    const log = (cmd) => { res.write(`$ ${cmd}\n`); return execSync(cmd, { cwd: APP_DIR, stdio: ['ignore', 'pipe', 'pipe'] }).toString(); };

    res.write(log(`git fetch origin ${branch}`));
    res.write(log(`git checkout ${branch}`));
    res.write(log(`git pull origin ${branch}`));
    res.write(log('npm install --prefix . --silent'));
    res.write(log('npm install --prefix backend --silent'));
    res.write(log('npm install --prefix frontend --silent'));
    res.write(log('npm run build --prefix frontend'));
    res.write(log('pm2 reload syndic-api'));

    res.write('\n✔ Déploiement terminé avec succès.\n');
    console.log('[webhook] Déploiement réussi.');
  } catch (err) {
    res.write(`\n✘ Erreur : ${err.message}\n`);
    console.error('[webhook] Erreur déploiement :', err.message);
  }

  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[webhook] Serveur démarré sur 127.0.0.1:${PORT}`);
});
