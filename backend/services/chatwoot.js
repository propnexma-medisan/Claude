const https = require('https');
const http = require('http');
const { URL } = require('url');

const BASE = process.env.CHATWOOT_URL || 'https://chat.propnex.ma';
const TOKEN = process.env.CHATWOOT_TOKEN || '';
const ACCOUNT = process.env.CHATWOOT_ACCOUNT_ID || '2';
const INBOX = parseInt(process.env.CHATWOOT_INBOX_ID || '6', 10);
const TEMPLATE_NAME = process.env.CHATWOOT_TEMPLATE_NAME || '';

// Normalise un numéro marocain vers le format E.164 strict qu'exige Chatwoot (+212XXXXXXXXX).
// Gère les formats déjà rencontrés en base : 0635133112, 635133112, 212635133112,
// +212 635 13 31 12, 00212635133112.
function normalizePhone(raw) {
  if (!raw) return '';
  let digits = String(raw).replace(/[^\d+]/g, '');
  digits = digits.replace(/^00/, '+');
  if (digits.startsWith('+')) {
    digits = '+' + digits.slice(1).replace(/\D/g, '');
  } else {
    digits = digits.replace(/\D/g, '');
    if (digits.startsWith('212')) digits = '+' + digits;
    else if (digits.startsWith('0')) digits = '+212' + digits.slice(1);
    else digits = '+212' + digits;
  }
  return digits;
}

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

async function findContactByPhone(phone) {
  // Essai 1 : endpoint search
  try {
    const search = await chatwootRequest(`/contacts/search?q=${encodeURIComponent(phone)}&page=1`);
    const found = (search.payload || []).find(c => c.phone_number === phone);
    if (found) return found.id;
  } catch (e) {
    console.log(`[Chatwoot] search échoué: ${e.message}`);
  }

  // Essai 2 : endpoint filter
  try {
    const filter = await chatwootRequest('/contacts/filter', 'POST', {
      payload: [{ attribute_key: 'phone_number', filter_operator: 'equal_to', values: [phone], query_operator: null }]
    });
    const found = (filter.payload || []).find(c => c.phone_number === phone);
    if (found) return found.id;
  } catch (e) {
    console.log(`[Chatwoot] filter échoué: ${e.message}`);
  }

  return null;
}

async function findOrCreateContact(phone, name) {
  // 1. Chercher le contact existant
  const existingId = await findContactByPhone(phone);
  if (existingId) {
    console.log(`[Chatwoot] Contact existant id=${existingId}`);
    return existingId;
  }

  // 2. Créer le contact
  try {
    console.log(`[Chatwoot] Création contact ${phone}`);
    const res = await chatwootRequest('/contacts', 'POST', { name, phone_number: phone });
    const newId = res?.payload?.contact?.id ?? res?.id;
    console.log(`[Chatwoot] Contact créé id=${newId}`);
    return newId;
  } catch (e) {
    // Si déjà pris entre temps, retry recherche
    if (e.message.includes('already been taken')) {
      const retryId = await findContactByPhone(phone);
      if (retryId) return retryId;
    }
    throw e;
  }
}

async function sendWhatsAppMessage({ phone, name, message, templateParams, templateName, templateLanguage }) {
  if (!TOKEN) throw new Error('CHATWOOT_TOKEN non configuré dans .env');

  const tplName = templateName || TEMPLATE_NAME;
  const tplLang = templateLanguage || 'en'; // défaut historique = activation_copropietaire (enregistré en English)

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) throw new Error('Numéro de téléphone manquant ou invalide');

  console.log(`[Chatwoot] Début envoi → ${normalizedPhone}`);
  const contactId = await findOrCreateContact(normalizedPhone, name);

  console.log(`[Chatwoot] Création conversation inbox=${INBOX} contact=${contactId}`);
  const conv = await chatwootRequest('/conversations', 'POST', { inbox_id: INBOX, contact_id: contactId });
  console.log(`[Chatwoot] Conversation id=${conv.id}`);

  if (tplName && templateParams) {
    // Template message requis pour initier une conversation WhatsApp (fenêtre 24h non ouverte)
    console.log(`[Chatwoot] Envoi template "${tplName}" (${tplLang})`);
    await chatwootRequest(`/conversations/${conv.id}/messages`, 'POST', {
      content: tplName,
      message_type: 'outgoing',
      private: false,
      template_params: {
        name: tplName,
        category: 'UTILITY',
        language: tplLang,
        processed_params: templateParams,
      },
    });
  } else {
    // Message libre (fenêtre 24h ouverte ou test)
    await chatwootRequest(`/conversations/${conv.id}/messages`, 'POST', {
      content: message,
      message_type: 'outgoing',
      private: false,
    });
  }

  console.log(`[Chatwoot] ✓ Message envoyé conversation ${conv.id}`);
  return { conversation_id: conv.id };
}

module.exports = { sendWhatsAppMessage };
