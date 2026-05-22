// En production (Nginx), l'API est proxifiée sur /api (même domaine).
// En développement local, on passe par localhost:3001.
const BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

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

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
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
  getAll: () => api.get('/assemblees'),
  getById: (id) => api.get(`/assemblees/${id}`),
  create: (data) => api.post('/assemblees', data),
  update: (id, data) => api.put(`/assemblees/${id}`, data),
  delete: (id) => api.delete(`/assemblees/${id}`),
  getPoints: (id) => api.get(`/assemblees/${id}/points`),
  createPoint: (id, data) => api.post(`/assemblees/${id}/points`, data),
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
};

// Tickets
export const tickets = {
  getAll: () => api.get('/tickets'),
  create: (data) => api.post('/tickets', data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  getMessages: (id) => api.get(`/tickets/${id}/messages`),
  addMessage: (id, data) => api.post(`/tickets/${id}/messages`, data),
};

// Messages de diffusion
export const messages = {
  getAll: () => api.get('/messages'),
  create: (data) => api.post('/messages', data),
  delete: (id) => api.delete(`/messages/${id}`),
};

// Finances
export const finances = {
  getByResidence: (id) => api.get(`/finances/${id}`),
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
};

export const relances = {
  getAll: (coproprieteId) => api.get(`/relances?copropriete_id=${coproprieteId}`),
  getMesRelances: () => api.get('/relances/mes-relances'),
  create: (data) => api.post('/relances', data),
  update: (id, data) => api.put(`/relances/${id}`, data),
};
