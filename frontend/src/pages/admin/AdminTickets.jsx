import React, { useEffect, useState, useMemo } from 'react';
import { adminApi } from '../../api/client';

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PRIORITY_COLORS = {
  Urgente: 'bg-red-100 text-red-700',
  Haute: 'bg-orange-100 text-orange-700',
  Normale: 'bg-blue-100 text-blue-700',
  Basse: 'bg-gray-100 text-gray-600',
};

const STATUS_COLORS = {
  Ouvert: 'bg-yellow-100 text-yellow-700',
  'En cours': 'bg-blue-100 text-blue-700',
  Résolu: 'bg-green-100 text-green-700',
  Fermé: 'bg-gray-100 text-gray-600',
};

function DelaiCell({ jours, priorite, statut }) {
  if (statut === 'Résolu' || statut === 'Fermé') {
    return <span className="text-xs text-gray-400">{jours}j</span>;
  }
  const isRed =
    (priorite === 'Urgente' && jours > 7) ||
    (priorite === 'Haute' && jours > 14);
  return (
    <span className={`text-xs font-medium ${isRed ? 'text-red-600' : 'text-gray-600'}`}>
      {jours}j
    </span>
  );
}

function AdminTickets() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterResidence, setFilterResidence] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterPriorite, setFilterPriorite] = useState('');

  useEffect(() => {
    adminApi.getTickets()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const residences = useMemo(() => [...new Set(data.map(r => r.copropriete_nom))].sort(), [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (filterResidence) rows = rows.filter(r => r.copropriete_nom === filterResidence);
    if (filterStatut) rows = rows.filter(r => r.statut === filterStatut);
    if (filterPriorite) rows = rows.filter(r => r.priorite === filterPriorite);
    return rows;
  }, [data, filterResidence, filterStatut, filterPriorite]);

  const currentMonth = new Date().toISOString().substring(0, 7);
  const summary = useMemo(() => {
    const ouverts = data.filter(r => r.statut === 'Ouvert').length;
    const enCours = data.filter(r => r.statut === 'En cours').length;
    const resolusMonth = data.filter(r => r.statut === 'Résolu' && r.updated_at && r.updated_at.substring(0, 7) === currentMonth).length;
    const resolusAvecDelai = data.filter(r => r.statut === 'Résolu' && r.jours_depuis_creation != null);
    const avgResolution = resolusAvecDelai.length > 0
      ? Math.round(resolusAvecDelai.reduce((s, r) => s + r.jours_depuis_creation, 0) / resolusAvecDelai.length)
      : null;
    return { ouverts, enCours, resolusMonth, avgResolution };
  }, [data, currentMonth]);

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
        <h1 className="text-2xl font-bold text-gray-800">Tickets</h1>
        <p className="text-sm text-gray-500 mt-1">Tous les tickets support à travers toutes les résidences</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Ouverts</p>
          <p className="text-2xl font-bold text-yellow-600">{summary.ouverts}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">En cours</p>
          <p className="text-2xl font-bold text-blue-600">{summary.enCours}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Résolus ce mois</p>
          <p className="text-2xl font-bold text-green-600">{summary.resolusMonth}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Délai moyen résolution</p>
          <p className="text-2xl font-bold text-gray-800">
            {summary.avgResolution != null ? `${summary.avgResolution}j` : '-'}
          </p>
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
            <option value="Ouvert">Ouvert</option>
            <option value="En cours">En cours</option>
            <option value="Résolu">Résolu</option>
            <option value="Fermé">Fermé</option>
          </select>
          <select
            value={filterPriorite}
            onChange={e => setFilterPriorite(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Toutes les priorités</option>
            <option value="Urgente">Urgente</option>
            <option value="Haute">Haute</option>
            <option value="Normale">Normale</option>
            <option value="Basse">Basse</option>
          </select>
          {(filterResidence || filterStatut || filterPriorite) && (
            <button
              onClick={() => { setFilterResidence(''); setFilterStatut(''); setFilterPriorite(''); }}
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
          <p className="text-sm text-gray-500">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Priorité', 'Titre', 'Résidence', 'Créateur', 'Statut', 'Date', 'Délai', 'Messages'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Aucun ticket trouvé</td></tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[row.priorite] || 'bg-gray-100 text-gray-600'}`}>
                      {row.priorite}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 text-xs max-w-[200px] truncate">{row.titre}</p>
                    {row.categorie && <p className="text-xs text-gray-400">{row.categorie}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{row.copropriete_nom}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {row.createur_prenom} {row.createur_nom}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.statut] || 'bg-gray-100 text-gray-600'}`}>
                      {row.statut}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <DelaiCell jours={row.jours_depuis_creation} priorite={row.priorite} statut={row.statut} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 text-center">{row.nb_messages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminTickets;
