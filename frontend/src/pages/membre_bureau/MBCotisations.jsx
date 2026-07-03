import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { cotisations as cotisationsApi } from '../../api/client';

function fmt(n) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(n || 0);
}

function StatusBadge({ statut }) {
  const map = {
    'Active': 'bg-green-100 text-green-700',
    'Expirée': 'bg-gray-100 text-gray-500',
    'Suspendue': 'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[statut] || 'bg-gray-100 text-gray-500'}`}>{statut}</span>;
}

function PaiementBadge({ statut }) {
  const map = {
    'Payé': 'bg-green-100 text-green-700',
    'En retard': 'bg-red-100 text-red-700',
    'En attente': 'bg-amber-100 text-amber-700',
  };
  return statut ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[statut] || 'bg-gray-100 text-gray-500'}`}>{statut}</span> : null;
}

function MBCotisations() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');

  useEffect(() => {
    if (!user?.copropriete_id) { setLoading(false); return; }
    cotisationsApi.getAll({ copropriete_id: user.copropriete_id })
      .then(setList)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.copropriete_id]);

  const filtered = list.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${c.prenom} ${c.nom} ${c.lot_numero || ''}`.toLowerCase().includes(q);
    const matchStatut = !filterStatut || c.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Cotisations</h1>
        <p className="text-sm text-gray-500 mt-1">Liste des cotisations de la résidence — lecture seule</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un copropriétaire..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 flex-1 min-w-[200px]"
        />
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">Tous les statuts</option>
          <option value="Active">Active</option>
          <option value="Expirée">Expirée</option>
          <option value="Suspendue">Suspendue</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200 text-gray-400">
          Aucune cotisation trouvée
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Copropriétaire</th>
                <th className="px-4 py-3 font-medium">Lot</th>
                <th className="px-4 py-3 font-medium">Période</th>
                <th className="px-4 py-3 font-medium text-right">Mensualité</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Dernier paiement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{c.prenom} {c.nom}</p>
                    <p className="text-xs text-gray-400">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.lot_numero ? `Lot ${c.lot_numero}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {c.date_debut?.slice(0, 7)} → {c.date_fin?.slice(0, 7)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(c.montant_mensuel)}</td>
                  <td className="px-4 py-3"><StatusBadge statut={c.statut} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <PaiementBadge statut={c.dernier_paiement_statut} />
                      {c.dernier_paiement_mois && (
                        <span className="text-xs text-gray-400">{c.dernier_paiement_mois}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} cotisation(s)
          </div>
        </div>
      )}
    </div>
  );
}

export default MBCotisations;
