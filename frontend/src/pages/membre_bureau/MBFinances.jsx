import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { finances } from '../../api/client';

function fmt(n) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(n || 0);
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

function StatusBadge({ statut }) {
  const map = {
    'Active': 'bg-green-100 text-green-700',
    'Expirée': 'bg-gray-100 text-gray-600',
    'Suspendue': 'bg-red-100 text-red-700',
    'Payé': 'bg-green-100 text-green-700',
    'Non payé': 'bg-red-100 text-red-700',
    'Partiel': 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[statut] || 'bg-gray-100 text-gray-600'}`}>
      {statut}
    </span>
  );
}

function MBFinances() {
  const { user } = useAuth();
  const [fin, setFin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [annee, setAnnee] = useState(currentYear);
  const [tab, setTab] = useState('cotisations');

  useEffect(() => {
    if (!user?.copropriete_id) { setLoading(false); return; }
    setLoading(true);
    finances.getByResidence(user.copropriete_id, annee)
      .then(setFin)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.copropriete_id, annee]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Finances</h1>
          <p className="text-sm text-gray-500 mt-1">Vue financière de la résidence — lecture seule</p>
        </div>
        <select
          value={annee}
          onChange={(e) => setAnnee(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>
      ) : !fin ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700 text-sm">Données non disponibles.</div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Budget annuel', val: fin.budget_annuel, color: 'text-blue-600' },
              { label: 'Dépenses réalisées', val: fin.total_depenses_realisees, color: 'text-amber-600' },
              { label: 'Cotisations collectées', val: fin.total_cot_paye, color: 'text-green-600' },
              { label: 'Impayés', val: fin.total_cot_impaye, color: 'text-red-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-lg font-bold mt-1 ${s.color}`}>{fmt(s.val)}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
            {[{ id: 'cotisations', label: 'Cotisations par lot' }, { id: 'depenses', label: 'Dépenses' }].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'cotisations' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Lot</th>
                    <th className="px-4 py-3 font-medium">Propriétaire</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-right">Payé</th>
                    <th className="px-4 py-3 font-medium text-right">Impayé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fin.cotisations_par_lot?.map((lot) => (
                    <tr key={lot.lot_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">Lot {lot.lot_numero} <span className="text-gray-400 font-normal">({lot.lot_type})</span></td>
                      <td className="px-4 py-3 text-gray-600">{lot.proprietaire_nom || (lot.user_prenom ? `${lot.user_prenom} ${lot.user_nom}` : '—')}</td>
                      <td className="px-4 py-3 text-right text-gray-800">{fmt(lot.montant_total)}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{fmt(lot.montant_paye)}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">{fmt(lot.montant_impaye)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'depenses' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
              {fin.depenses_list?.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">Aucune dépense pour {annee}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Libellé</th>
                      <th className="px-4 py-3 font-medium">Catégorie</th>
                      <th className="px-4 py-3 font-medium">Fournisseur</th>
                      <th className="px-4 py-3 font-medium text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {fin.depenses_list?.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{new Date(d.date_depense).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{d.libelle}</td>
                        <td className="px-4 py-3 text-gray-500">{d.categorie}</td>
                        <td className="px-4 py-3 text-gray-500">{d.fournisseur_nom || d.fournisseur || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(d.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MBFinances;
