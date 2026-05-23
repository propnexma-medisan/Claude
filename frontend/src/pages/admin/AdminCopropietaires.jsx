import { formatMAD } from '../../utils/currency';
import React, { useEffect, useState, useMemo } from 'react';
import { adminApi } from '../../api/client';

function fmt(n) {
  return formatMAD(n || 0);
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'active', label: 'Actives' },
  { key: 'expirant', label: 'Expirant bientôt' },
  { key: 'expiree', label: 'Expirées' },
];

function AdminCopropietaires() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    adminApi.getCopropietaires()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let rows = data;

    if (filter === 'active') rows = rows.filter(r => r.cotisation_statut === 'Active');
    else if (filter === 'expirant') rows = rows.filter(r => r.cotisation_statut === 'Active' && r.jours_restants != null && r.jours_restants <= 30);
    else if (filter === 'expiree') rows = rows.filter(r => r.cotisation_statut === 'Expirée' || (r.jours_restants != null && r.jours_restants < 0));

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        `${r.nom} ${r.prenom}`.toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.copropriete_nom || '').toLowerCase().includes(q)
      );
    }

    return rows;
  }, [data, search, filter]);

  const summary = useMemo(() => ({
    total: data.length,
    actives: data.filter(r => r.cotisation_statut === 'Active').length,
    expirees: data.filter(r => r.cotisation_statut === 'Expirée' || (r.jours_restants != null && r.jours_restants < 0)).length,
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
        <h1 className="text-2xl font-bold text-gray-800">Copropriétaires</h1>
        <p className="text-sm text-gray-500 mt-1">Tous les copropriétaires de toutes les résidences</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Total</p>
          <p className="text-2xl font-bold text-gray-800">{summary.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Cotisations actives</p>
          <p className="text-2xl font-bold text-green-600">{summary.actives}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Cotisations expirées</p>
          <p className="text-2xl font-bold text-red-600">{summary.expirees}</p>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par nom, email, résidence..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          {/* Filter chips */}
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-500">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Nom', 'Email', 'Résidence', 'Lot', 'Cotisation', 'Jours restants', 'Tickets ouverts', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Aucun copropriétaire trouvé</td></tr>
              )}
              {filtered.map((row) => (
                <React.Fragment key={row.id}>
                  <tr
                    className="hover:bg-purple-50/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{row.prenom} {row.nom}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{row.email}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{row.copropriete_nom || <span className="text-gray-400">-</span>}</td>
                    <td className="px-4 py-3">
                      {row.lot_numero ? (
                        <span className="text-xs text-gray-700">
                          {row.lot_numero}
                          {row.lot_type && <span className="text-gray-400 ml-1">({row.lot_type})</span>}
                        </span>
                      ) : <span className="text-xs text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.date_debut && row.date_fin ? (
                        <div>
                          <StatutBadge statut={row.cotisation_statut} />
                          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(row.date_debut)} → {fmtDate(row.date_fin)}</p>
                        </div>
                      ) : <span className="text-xs text-gray-400">Aucune</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.jours_restants != null ? (
                        <JoursBadge jours={row.jours_restants} statut={row.cotisation_statut} />
                      ) : <span className="text-xs text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.tickets_ouverts > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          {row.tickets_ouverts}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">0</span>
                      )}
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
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                          {/* Contact */}
                          <div>
                            <p className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wider">Contact</p>
                            <p className="text-gray-600">{row.prenom} {row.nom}</p>
                            <p className="text-gray-500 text-xs">{row.email}</p>
                            {row.telephone && <p className="text-gray-500 text-xs">{row.telephone}</p>}
                          </div>
                          {/* Lot */}
                          <div>
                            <p className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wider">Lot</p>
                            {row.lot_numero ? (
                              <>
                                <p className="text-gray-600">N° {row.lot_numero}</p>
                                <p className="text-gray-500 text-xs">{row.lot_type}</p>
                              </>
                            ) : <p className="text-gray-400 text-xs">Aucun lot associé</p>}
                          </div>
                          {/* Cotisation */}
                          <div>
                            <p className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wider">Cotisation</p>
                            {row.montant_mensuel ? (
                              <>
                                <p className="text-gray-600 font-medium">{formatMAD(row.montant_mensuel)}/mois</p>
                                <p className="text-gray-500 text-xs">Du {fmtDate(row.date_debut)} au {fmtDate(row.date_fin)}</p>
                                {row.dernier_paiement_mois && (
                                  <p className="text-gray-500 text-xs mt-1">Dernier paiement : {row.dernier_paiement_mois} — <span className={row.dernier_paiement_statut === 'Payé' ? 'text-green-600' : 'text-red-500'}>{row.dernier_paiement_statut}</span></p>
                                )}
                              </>
                            ) : <p className="text-gray-400 text-xs">Aucune cotisation</p>}
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

export default AdminCopropietaires;
