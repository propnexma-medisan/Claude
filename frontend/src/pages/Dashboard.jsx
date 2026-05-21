import React, { useEffect, useState } from 'react';
import StatCard from '../components/StatCard';
import { dashboard } from '../api/client';

const statusColors = {
  'En cours': 'bg-blue-100 text-blue-700',
  'Soldé': 'bg-green-100 text-green-700',
  'En retard': 'bg-red-100 text-red-700',
  'Planifiée': 'bg-indigo-100 text-indigo-700',
  'En cours': 'bg-yellow-100 text-yellow-700',
  'Terminée': 'bg-gray-100 text-gray-600',
  'Annulée': 'bg-red-100 text-red-600',
};

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    dashboard.getStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        Erreur de connexion au serveur : {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>
        <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de votre gestion syndic</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Copropriétés"
          value={stats.nbCoproprietes}
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <StatCard
          label="Lots au total"
          value={stats.nbLots}
          color="purple"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Charges en attente"
          value={fmt(stats.chargesEnAttente)}
          color="orange"
          sub={`dont ${fmt(stats.chargesEnRetard)} en retard`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Total collecté"
          value={fmt(stats.totalCollecte)}
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {stats.prochaineAG && (
        <div className="bg-blue-600 text-white rounded-xl p-5 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-blue-200 text-sm font-medium">Prochaine assemblée générale</p>
            <p className="font-bold text-lg">{stats.prochaineAG.copropriete_nom}</p>
            <p className="text-blue-100 text-sm">
              {fmtDate(stats.prochaineAG.date)} à {stats.prochaineAG.heure} — {stats.prochaineAG.lieu}
            </p>
          </div>
          <span className="ml-auto bg-white/20 text-white text-xs font-medium px-3 py-1 rounded-full">
            {stats.prochaineAG.type}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Dernières charges</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentCharges.length === 0 && (
              <p className="px-5 py-4 text-sm text-gray-400">Aucune charge enregistrée</p>
            )}
            {stats.recentCharges.map((c, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{c.libelle}</p>
                  <p className="text-xs text-gray-400">{c.copropriete_nom} · Échéance {fmtDate(c.date_echeance)}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-700">{fmt(c.montant_total)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[c.statut] || 'bg-gray-100 text-gray-600'}`}>
                    {c.statut}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Assemblées récentes</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentAGs.length === 0 && (
              <p className="px-5 py-4 text-sm text-gray-400">Aucune assemblée enregistrée</p>
            )}
            {stats.recentAGs.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{a.copropriete_nom}</p>
                  <p className="text-xs text-gray-400">{fmtDate(a.date)} à {a.heure} · {a.type}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[a.statut] || 'bg-gray-100 text-gray-600'}`}>
                  {a.statut}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
