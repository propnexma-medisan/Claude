const https = require('https');
const http = require('http');
const { URL } = require('url');

const BASE = process.env.CHATWOOT_URL || 'https://chat.propnex.ma';
const TOKEN = process.env.CHATWOOT_TOKEN || '';
const ACCOUNT = process.env.CHATWOOT_ACCOUNT_ID || '2';
const INBOX = parseInt(process.env.CHATWOOT_INBOX_ID || '6', 10);

function chatwootRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api/v1/accounts/${ACCOUNT}${path}`, BASE);
    const lib = url.protocol === 'https:' ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'api_access_token': TOKEN,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const msg = parsed.error || parsed.message || `HTTP ${res.statusCode}`;
            console.error(`[Chatwoot] ERREUR ${res.statusCode} ${path}: ${msg}`);
            reject(new Error(msg));
          } else {
            resolve(parsed);
          }
        } catch {
          console.error(`[Chatwoot] Parse error: ${data}`);
          reject(new Error(`Réponse non-JSON: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`[Chatwoot] Connexion échouée: ${e.message}`);
      reject(e);
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function findOrCreateContact(phone, name) {
  try {
    const search = await chatwootRequest(`/contacts/search?q=${encodeURIComponent(phone)}&page=1`);
    const found = (search.payload || []).find(c => c.phone_number === phone);
    if (found) {
      console.log(`[Chatwoot] Contact existant id=${found.id}`);
      return found.id;
    }
  } catch (e) {
    console.log(`[Chatwoot] Recherche contact: ${e.message}`);
  }

  console.log(`[Chatwoot] Création contact ${phone}`);
  const contact = await chatwootRequest('/contacts', 'POST', { name, phone_number: phone });
  console.log(`[Chatwoot] Contact créé id=${contact.id}`);
  return contact.id;
}

async function sendWhatsAppMessage({ phone, name, message }) {
  if (!TOKEN) throw new Error('CHATWOOT_TOKEN non configuré dans .env');

  console.log(`[Chatwoot] Début envoi → ${phone}`);
  const contactId = await findOrCreateContact(phone, name);

  console.log(`[Chatwoot] Création conversation inbox=${INBOX}`);
  const conv = await chatwootRequest(`/contacts/${contactId}/conversations`, 'POST', { inbox_id: INBOX });
  console.log(`[Chatwoot] Conversation id=${conv.id}`);

  await chatwootRequest(`/conversations/${conv.id}/messages`, 'POST', {
    content: message,
    message_type: 'outgoing',
    private: false,
  });

  console.log(`[Chatwoot] ✓ Message envoyé conversation ${conv.id}`);
  return { conversation_id: conv.id };
}

module.exports = { sendWhatsAppMessage };
