const BASE = process.env.CHATWOOT_URL || 'https://chat.propnex.ma';
const TOKEN = process.env.CHATWOOT_TOKEN || '';
const ACCOUNT = process.env.CHATWOOT_ACCOUNT_ID || '2';
const INBOX = parseInt(process.env.CHATWOOT_INBOX_ID || '6');

async function chatwootFetch(path, options = {}) {
  const res = await fetch(`${BASE}/api/v1/accounts/${ACCOUNT}${path}`, {
    ...options,
    headers: {
      'api_access_token': TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Chatwoot ${res.status}`);
  return data;
}

async function findOrCreateContact(phone, name) {
  try {
    const search = await chatwootFetch(`/contacts/search?q=${encodeURIComponent(phone)}&page=1`);
    const found = (search.payload || []).find(c => c.phone_number === phone);
    if (found) return found.id;
  } catch {}

  const contact = await chatwootFetch('/contacts', {
    method: 'POST',
    body: JSON.stringify({ name, phone_number: phone }),
  });
  return contact.id;
}

async function sendWhatsAppMessage({ phone, name, message }) {
  if (!TOKEN) throw new Error('CHATWOOT_TOKEN non configuré');

  const contactId = await findOrCreateContact(phone, name);

  const conv = await chatwootFetch(`/contacts/${contactId}/conversations`, {
    method: 'POST',
    body: JSON.stringify({ inbox_id: INBOX }),
  });

  await chatwootFetch(`/conversations/${conv.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: message, message_type: 'outgoing', private: false }),
  });

  return { conversation_id: conv.id };
}

module.exports = { sendWhatsAppMessage };
