import React, { useEffect, useState, useMemo } from 'react';
import { adminApi } from '../../api/client';

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const PAGE_SIZE = 20;

function AdminCommunications() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterResidence, setFilterResidence] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    adminApi.getCommunications()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const residences = useMemo(() => [...new Set(data.map(r => r.copropriete_nom))].filter(Boolean).sort(), [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (filterType === 'message') rows = rows.filter(r => r.type === 'message');
    else if (filterType === 'relance') rows = rows.filter(r => r.type === 'relance');
    if (filterResidence) rows = rows.filter(r => r.copropriete_nom === filterResidence);
    return rows;
  }, [data, filterType, filterResidence]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  const handleTypeFilter = (v) => { setFilterType(v); setPage(1); };
  const handleResidenceFilter = (v) => { setFilterResidence(v); setPage(1); };

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
        <h1 className="text-2xl font-bold text-gray-800">Communications</h1>
        <p className="text-sm text-gray-500 mt-1">Messages de diffusion et relances de toutes les résidences</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Type filter chips */}
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'Tous' },
              { key: 'message', label: 'Messages' },
              { key: 'relance', label: 'Relances' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => handleTypeFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === f.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Residence filter */}
          <select
            value={filterResidence}
            onChange={e => handleResidenceFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Toutes les résidences</option>
            {residences.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <span className="text-xs text-gray-400 ml-auto">{filtered.length} élément{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Timeline list */}
      <div className="space-y-3">
        {paginated.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-10 text-center text-gray-400">
            Aucune communication trouvée
          </div>
        )}
        {paginated.map((item, idx) => (
          <div key={`${item.type}-${item.id}-${idx}`} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              {/* Type indicator */}
              <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${item.type === 'relance' ? 'bg-orange-400' : 'bg-blue-400'}`} />

              <div className="min-w-0 flex-1">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${item.type === 'relance' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {item.type === 'relance' ? 'Relance' : 'Message'}
                    </span>
                    <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                      {item.copropriete_nom}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{fmtDate(item.created_at)}</span>
                </div>

                {/* Title */}
                <p className="font-semibold text-gray-800 text-sm mb-1">{item.titre_ou_objet || '(sans objet)'}</p>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                  {(item.expediteur_prenom || item.expediteur_nom) && (
                    <span>
                      De : <span className="font-medium text-gray-700">{item.expediteur_prenom} {item.expediteur_nom}</span>
                    </span>
                  )}
                  {item.destinataire_ou_cible && (
                    <span>
                      À : <span className="font-medium text-gray-700">{item.destinataire_ou_cible}</span>
                    </span>
                  )}
                </div>

                {/* Preview */}
                {item.contenu_preview && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 line-clamp-2">
                    {item.contenu_preview}{item.contenu_preview.length >= 150 ? '...' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-3">
          <p className="text-sm text-gray-500">
            Page {page} sur {totalPages} · {filtered.length} éléments
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Précédent
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCommunications;
