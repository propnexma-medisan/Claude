// En production (Nginx), l'API est proxifiée sur /api (même domaine).
// En développement local, on passe par localhost:3001.
const BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
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
