import React, { useEffect, useState, useMemo } from 'react';
import { adminApi } from '../../api/client';

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function StatutBadge({ statut }) {
  const colors = {
    Active: 'bg-green-100 text-green-700',
    Expirée: 'bg-red-100 text-red-700',
    Suspendue: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[statut] || 'bg-gray-100 text-gray-600'}`}>
      {statut || '-'}
    </span>
  );
}

function JoursBadge({ jours, statut }) {
  if (statut === 'Expirée' || jours == null || jours < 0) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Expirée</span>;
  }
  if (jours < 7) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{jours}j</span>;
  }
  if (jours < 30) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{jours}j</span>;
  }
  if (jours < 60) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">{jours}j</span>;
  }
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{jours}j</span>;
}

function AdminCotisations() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterResidence, setFilterResidence] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterAnnee, setFilterAnnee] = useState('');

  useEffect(() => {
    adminApi.getCotisations()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const residences = useMemo(() => [...new Set(data.map(r => r.copropriete_nom))].sort(), [data]);
  const annees = useMemo(() => {
    const years = new Set();
    data.forEach(r => {
      if (r.date_debut) years.add(new Date(r.date_debut).getFullYear());
    });
    return [...years].sort((a, b) => b - a);
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (filterResidence) rows = rows.filter(r => r.copropriete_nom === filterResidence);
    if (filterStatut) rows = rows.filter(r => r.statut === filterStatut);
    if (filterAnnee) rows = rows.filter(r => r.date_debut && new Date(r.date_debut).getFullYear() === Number(filterAnnee));
    return rows;
  }, [data, filterResidence, filterStatut, filterAnnee]);

  const summary = useMemo(() => ({
    actives: filtered.filter(r => r.statut === 'Active').length,
    expirant: filtered.filter(r => r.statut === 'Active' && r.jours_restants != null && r.jours_restants <= 30).length,
    expirees: filtered.filter(r => r.statut === 'Expirée' || (r.jours_restants != null && r.jours_restants < 0)).length,
    totalMensuel: filtered.filter(r => r.statut === 'Active').reduce((s, r) => s + (r.montant_mensuel || 0), 0),
  }), [filtered]);

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
        <h1 className="text-2xl font-bold text-gray-800">Cotisations</h1>
        <p className="text-sm text-gray-500 mt-1">Toutes les cotisations à travers toutes les résidences</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Actives</p>
          <p className="text-2xl font-bold text-green-600">{summary.actives}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Expirant bientôt</p>
          <p className="text-2xl font-bold text-orange-500">{summary.expirant}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Expirées</p>
          <p className="text-2xl font-bold text-red-600">{summary.expirees}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Montant mensuel total</p>
          <p className="text-xl font-bold text-purple-700">{fmt(summary.totalMensuel)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={filterResidence}
            onChange={e => setFilterResidence(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Toutes les résidences</option>
            {residences.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Tous les statuts</option>
            <option value="Active">Active</option>
            <option value="Expirée">Expirée</option>
            <option value="Suspendue">Suspendue</option>
          </select>
          <select
            value={filterAnnee}
            onChange={e => setFilterAnnee(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Toutes les années</option>
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {(filterResidence || filterStatut || filterAnnee) && (
            <button
              onClick={() => { setFilterResidence(''); setFilterStatut(''); setFilterAnnee(''); }}
              className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800 underline"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-500">{filtered.length} cotisation{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Résidence', 'Copropriétaire', 'Lot', 'Période', 'Montant/mois', 'Statut', 'Jours restants', 'Impayés'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Aucune cotisation trouvée</td></tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 text-xs">{row.copropriete_nom}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800 text-xs font-medium">{row.copropietaire_prenom} {row.copropietaire_nom}</p>
                    <p className="text-xs text-gray-400">{row.copropietaire_email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {row.lot_numero || <span className="text-gray-400">-</span>}
                    {row.lot_type && <span className="text-gray-400 ml-1 text-xs">({row.lot_type})</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {fmtDate(row.date_debut)} → {fmtDate(row.date_fin)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800 text-xs whitespace-nowrap">
                    {fmt(row.montant_mensuel)}
                  </td>
                  <td className="px-4 py-3"><StatutBadge statut={row.statut} /></td>
                  <td className="px-4 py-3"><JoursBadge jours={row.jours_restants} statut={row.statut} /></td>
                  <td className="px-4 py-3">
                    {row.paiements_en_retard > 0 ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {row.paiements_en_retard} en retard
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminCotisations;
