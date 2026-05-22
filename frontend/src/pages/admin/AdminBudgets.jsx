import React, { useEffect, useState, useMemo } from 'react';
import { adminApi } from '../../api/client';

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function StatutBadge({ statut }) {
  const colors = {
    Approuvé: 'bg-green-100 text-green-700',
    Brouillon: 'bg-gray-100 text-gray-600',
    'En révision': 'bg-yellow-100 text-yellow-700',
    Rejeté: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[statut] || 'bg-gray-100 text-gray-600'}`}>
      {statut || '-'}
    </span>
  );
}

function ProgressBar({ pct }) {
  const color = pct > 100 ? 'bg-red-500' : pct > 90 ? 'bg-orange-400' : pct > 70 ? 'bg-yellow-400' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${pct > 90 ? 'text-red-600' : 'text-gray-700'}`}>{pct}%</span>
    </div>
  );
}

function AdminBudgets() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    adminApi.getBudgets()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => ({
    totalBudget: data.reduce((s, r) => s + (r.total_budget || 0), 0),
    totalDepenses: data.reduce((s, r) => s + (r.total_depenses || 0), 0),
    tauxMoyen: data.length > 0
      ? Math.round(data.reduce((s, r) => s + (r.taux_consommation || 0), 0) / data.length)
      : 0,
  }), [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">Erreur : {error}</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Budgets & Dépenses</h1>
        <p className="text-sm text-gray-500 mt-1">Vue globale de tous les budgets et dépenses</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Total budgété</p>
          <p className="text-xl font-bold text-indigo-700">{fmt(summary.totalBudget)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Total dépensé</p>
          <p className="text-xl font-bold text-orange-600">{fmt(summary.totalDepenses)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Taux moyen consommation</p>
          <p className="text-xl font-bold text-gray-800">{summary.tauxMoyen}%</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-500">{data.length} budget{data.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Résidence', 'Année', 'Statut', 'Budget total', 'Dépenses', 'Restant', 'Taux', 'Gestionnaire', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Aucun budget</td></tr>
              )}
              {data.map((row) => (
                <React.Fragment key={row.id}>
                  <tr
                    className="hover:bg-purple-50/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 text-xs">{row.copropriete_nom}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{row.annee}</td>
                    <td className="px-4 py-3"><StatutBadge statut={row.statut} /></td>
                    <td className="px-4 py-3 text-xs text-gray-700 font-medium whitespace-nowrap">{fmt(row.total_budget)}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{fmt(row.total_depenses)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${row.restant < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {fmt(row.restant)}
                      </span>
                    </td>
                    <td className="px-4 py-3"><ProgressBar pct={row.taux_consommation} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {row.gestionnaire_prenom ? `${row.gestionnaire_prenom} ${row.gestionnaire_nom}` : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform inline-block ${expandedId === row.id ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr className="bg-purple-50/20">
                      <td colSpan={9} className="px-6 py-4">
                        <div className="text-sm">
                          <p className="font-semibold text-gray-700 mb-3 text-xs uppercase tracking-wider">Détail du budget {row.annee} — {row.copropriete_nom}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg p-3 border border-gray-100">
                              <p className="text-xs text-gray-500">Budget voté</p>
                              <p className="font-bold text-gray-800">{fmt(row.total_budget)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-gray-100">
                              <p className="text-xs text-gray-500">Dépenses engagées</p>
                              <p className="font-bold text-orange-600">{fmt(row.total_depenses)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-gray-100">
                              <p className="text-xs text-gray-500">Solde restant</p>
                              <p className={`font-bold ${row.restant < 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(row.restant)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-gray-100">
                              <p className="text-xs text-gray-500">Taux consommation</p>
                              <p className="font-bold text-gray-800">{row.taux_consommation}%</p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminBudgets;
