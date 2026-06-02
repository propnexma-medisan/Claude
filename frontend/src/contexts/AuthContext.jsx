import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('syndic_token'));
  const [loading, setLoading] = useState(true);
  const [selectedCoproId, setSelectedCoproIdState] = useState(() => {
    const saved = parseInt(localStorage.getItem('selectedCoproId'));
    return isNaN(saved) ? null : saved;
  });

  const BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

  const resolveSelectedCoproId = (userData) => {
    if (!userData || userData.role !== 'gestionnaire') return null;
    const coproprietes = userData.coproprietes || [];
    const saved = parseInt(localStorage.getItem('selectedCoproId'));
    if (!isNaN(saved) && coproprietes.some((c) => c.id === saved)) return saved;
    // Fall back to primary copropriete_id or first in list
    if (userData.copropriete_id) return userData.copropriete_id;
    return coproprietes[0]?.id || null;
  };

  useEffect(() => {
    if (token) {
      fetch(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (!r.ok) throw new Error('Token invalide');
          return r.json();
        })
        .then((u) => {
          setUser(u);
          const coproId = resolveSelectedCoproId(u);
          setSelectedCoproIdState(coproId);
          if (coproId) localStorage.setItem('selectedCoproId', coproId);
        })
        .catch(() => {
          localStorage.removeItem('syndic_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur de connexion');

    localStorage.setItem('syndic_token', data.token);
    setToken(data.token);
    setUser(data.user);

    const coproId = resolveSelectedCoproId(data.user);
    setSelectedCoproIdState(coproId);
    if (coproId) localStorage.setItem('selectedCoproId', coproId);

    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('syndic_token');
    localStorage.removeItem('selectedCoproId');
    setToken(null);
    setUser(null);
    setSelectedCoproIdState(null);
  };

  const setSelectedCoproId = (id) => {
    const numId = parseInt(id);
    setSelectedCoproIdState(numId);
    localStorage.setItem('selectedCoproId', numId);
  };

  const isAuthenticated = !!user && !!token;
  const coproprietes = user?.coproprietes || [];

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, loading, selectedCoproId, setSelectedCoproId, coproprietes }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
