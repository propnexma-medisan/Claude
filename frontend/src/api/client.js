// VITE_API_URL est requis pour les builds Capacitor (Android/iOS).
// En prod web (Nginx), l'API est proxifiée sur /api (même domaine).
// En développement local, on passe par localhost:3001.
const BASE_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

function getToken() {
  return localStorage.getItem('syndic_token');
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const token = getToken();

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorMessage = `Erreur HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  // Handle empty responses (e.g., 204 No Content)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

async function requestHtml(path) {
  const url = `${BASE_URL}${path}`;
  const token = getToken();
  const response = await fetch(url, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
  return response.text();
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  getHtml: (path) => requestHtml(path),
};

// Copropriétés
export const coproprietes = {
  getAll: () => api.get('/coproprietes'),
  getById: (id) => api.get(`/coproprietes/${id}`),
  create: (data) => api.post('/coproprietes', data),
  update: (id, data) => api.put(`/coproprietes/${id}`, data),
  delete: (id) => api.delete(`/coproprietes/${id}`),
  getLots: (id) => api.get(`/coproprietes/${id}/lots`),
  createLot: (id, data) => api.post(`/coproprietes/${id}/lots`, data),
};

// Lots
export const lots = {
  update: (id, data) => api.put(`/lots/${id}`, data),
  delete: (id) => api.delete(`/lots/${id}`),
};

// Charges
export const charges = {
  getAll: () => api.get('/charges'),
  getById: (id) => api.get(`/charges/${id}`),
  create: (data) => api.post('/charges', data),
  update: (id, data) => api.put(`/charges/${id}`, data),
  delete: (id) => api.delete(`/charges/${id}`),
  getRepartitions: (id) => api.get(`/charges/${id}/repartitions`),
  updateRepartition: (id, data) => api.put(`/charges/repartitions/${id}`, data),
};

// Assemblées
export const assemblees = {
  getAll: (copropriete_id) => api.get(copropriete_id ? `/assemblees?copropriete_id=${copropriete_id}` : '/assemblees'),
  getById: (id) => api.get(`/assemblees/${id}`),
  create: (data) => api.post('/assemblees', data),
  update: (id, data) => api.put(`/assemblees/${id}`, data),
  delete: (id) => api.delete(`/assemblees/${id}`),
  getPoints: (id) => api.get(`/assemblees/${id}/points`),
  createPoint: (id, data) => api.post(`/assemblees/${id}/points`, data),
  convoquer: (id) => api.post(`/assemblees/${id}/convoquer`, {}),
  getPresences: (id) => api.get(`/assemblees/${id}/presences`),
  setPresence: (id, data) => api.post(`/assemblees/${id}/presences`, data),
  getPV: (id) => api.getHtml(`/assemblees/${id}/pv`),
  getFeuilleEmargement: (id) => api.getHtml(`/assemblees/${id}/feuille-emargement`),
};

// AG Points
export const agPoints = {
  update: (id, data) => api.put(`/ag-points/${id}`, data),
  delete: (id) => api.delete(`/ag-points/${id}`),
};

// Dashboard
export const dashboard = {
  getStats: () => api.get('/dashboard/stats'),
};

// Users
export const users = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  byResidence: (coproprieteId) => api.get(`/users/by-residence/${coproprieteId}`),
  resendCredentials: (id) => api.post(`/users/${id}/resend-credentials`, {}),
  uploadSignature: (file) => {
    const form = new FormData();
    form.append('signature', file);
    const token = getToken();
    return fetch(`${BASE_URL}/users/upload-signature`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    }).then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(new Error(e.error || 'Erreur upload'))));
  },
  deleteSignature: () => api.delete('/users/upload-signature'),
};

// Tickets
export const tickets = {
  getAll: (coproprieteId) => api.get(coproprieteId ? `/tickets?copropriete_id=${coproprieteId}` : '/tickets'),
  create: (formData) => {
    const token = getToken();
    return fetch(`${BASE_URL}/tickets`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(new Error(e.error || 'Erreur'))));
  },
  update: (id, data) => api.put(`/tickets/${id}`, data),
  getMessages: (id) => api.get(`/tickets/${id}/messages`),
  addMessage: (id, formData) => {
    const token = getToken();
    return fetch(`${BASE_URL}/tickets/${id}/messages`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(new Error(e.error || 'Erreur'))));
  },
};

// Messages de diffusion
export const messages = {
  getAll: (coproprieteId) => api.get(coproprieteId ? `/messages?copropriete_id=${coproprieteId}` : '/messages'),
  create: (formData) => {
    const token = getToken();
    return fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(new Error(e.error || 'Erreur'))));
  },
  delete: (id) => api.delete(`/messages/${id}`),
  deletePJ: (id) => api.delete(`/messages/pj/${id}`),
};

// Finances
export const finances = {
  getByResidence: (id, annee) => api.get(`/finances/${id}${annee ? `?annee=${annee}` : ''}`),
  getGlobal: () => api.get('/finances/global'),
};

// Auth
export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout', {}),
};

// Budgets
export const budgets = {
  getAll: (coproprieteId) => api.get(`/budgets?copropriete_id=${coproprieteId}`),
  create: (data) => api.post('/budgets', data),
  getById: (id) => api.get(`/budgets/${id}`),
  update: (id, data) => api.put(`/budgets/${id}`, data),
  delete: (id) => api.delete(`/budgets/${id}`),
  getLignes: (id) => api.get(`/budgets/${id}/lignes`),
  updateLigne: (budgetId, ligneId, data) => api.put(`/budgets/${budgetId}/lignes/${ligneId}`, data),
  getSynthese: (id) => api.get(`/budgets/${id}/synthese`),
};

export const depenses = {
  getAll: (params) => api.get(`/depenses?${new URLSearchParams(params)}`),
  create: (data) => api.post('/depenses', data),
  update: (id, data) => api.put(`/depenses/${id}`, data),
  delete: (id) => api.delete(`/depenses/${id}`),
};

export const appelsFonds = {
  getAll: (coproprieteId) => api.get(`/appels-fonds?copropriete_id=${coproprieteId}`),
  create: (data) => api.post('/appels-fonds', data),
  update: (id, data) => api.put(`/appels-fonds/${id}`, data),
  delete: (id) => api.delete(`/appels-fonds/${id}`),
};

export const cotisations = {
  getAll: (params) => api.get(`/cotisations?${new URLSearchParams(params)}`),
  getById: (id) => api.get(`/cotisations/${id}`),
  create: (data) => api.post('/cotisations', data),
  update: (id, data) => api.put(`/cotisations/${id}`, data),
  delete: (id) => api.delete(`/cotisations/${id}`),
  updatePaiement: (id, data) => api.put(`/cotisations/paiements/${id}`, data),
  getAlertes: (coproprieteId) => api.get(`/cotisations/alertes?copropriete_id=${coproprieteId}`),
  getQuitus: (id) => api.getHtml(`/cotisations/${id}/quitus`),
  sendQuitus: (id) => api.post(`/cotisations/${id}/send-quitus`, {}),
  uploadPreuve: (cotisationId, file) => {
    const form = new FormData();
    form.append('file', file);
    const token = getToken();
    return fetch(`${BASE_URL}/cotisations/${cotisationId}/preuves`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    }).then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(new Error(e.error || 'Erreur upload'))));
  },
  deletePreuve: (preuveId) => api.delete(`/cotisations/preuves/${preuveId}`),
};

export const relances = {
  getAll: (coproprieteId) => api.get(`/relances?copropriete_id=${coproprieteId}`),
  getMesRelances: () => api.get('/relances/mes-relances'),
  create: (data) => api.post('/relances', data),
  update: (id, data) => api.put(`/relances/${id}`, data),
};

export const fournisseurs = {
  getAll: (coproprieteId) => api.get(`/fournisseurs?copropriete_id=${coproprieteId}`),
  create: (data) => api.post('/fournisseurs', data),
  update: (id, data) => api.put(`/fournisseurs/${id}`, data),
  delete: (id) => api.delete(`/fournisseurs/${id}`),
  getContrats: (fournisseurId) => api.get(`/fournisseurs/${fournisseurId}/contrats`),
  createContrat: (fournisseurId, data) => api.post(`/fournisseurs/${fournisseurId}/contrats`, data),
  updateContrat: (id, data) => api.put(`/fournisseurs/contrats/${id}`, data),
  deleteContrat: (id) => api.delete(`/fournisseurs/contrats/${id}`),
};

export const recouvrement = {
  getDashboard: (coproprieteId) => api.get(`/recouvrement/dashboard?copropriete_id=${coproprieteId}`),
  getActions: (coproprieteId, userId) => api.get(`/recouvrement/actions?copropriete_id=${coproprieteId}&user_id=${userId}`),
  logAction: (data) => api.post('/recouvrement/actions', data),
  markDeposee: (id) => api.put(`/recouvrement/actions/${id}/deposee`, {}),
  sendEmail: (data) => api.post('/recouvrement/send-email', data),
};

export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getDashboard: () => api.get('/admin/dashboard'),
  getCopropietaires: () => api.get('/admin/copropietaires'),
  getCotisations: () => api.get('/admin/cotisations'),
  getTickets: () => api.get('/admin/tickets'),
  getBudgets: () => api.get('/admin/budgets'),
  getCommunications: () => api.get('/admin/communications'),
};
