import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { budgets as budgetsApi } from '../../api/client';

function fmt(n) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(n || 0);
}

function pct(used, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function MBBudget() {
  const { user } = useAuth();
  const [budgetList, setBudgetList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [synthese, setSynthese] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingSynth, setLoadingSynth] = useState(false);

  useEffect(() => {
    if (!user?.copropriete_id) { setLoading(false); return; }
    budgetsApi.getAll(user.copropriete_id)
      .then((list) => {
        setBudgetList(list);
        if (list.length > 0) setSelected(list[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.copropriete_id]);

  useEffect(() => {
    if (!selected) return;
    setLoadingSynth(true);
    budgetsApi.getSynthese(selected.id)
      .then(setSynthese)
      .catch(() => setSynthese(null))
      .finally(() => setLoadingSynth(false));
  }, [selected]);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Budget</h1>
          <p className="text-sm text-gray-500 mt-1">Suivi budgétaire — lecture seule</p>
        </div>
        {budgetList.length > 0 && (
          <select
            value={selected?.id || ''}
            onChange={(e) => setSelected(budgetList.find((b) => b.id === Number(e.target.value)))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {budgetList.map((b) => <option key={b.id} value={b.id}>Budget {b.annee} — {b.statut}</option>)}
          </select>
        )}
      </div>

      {budgetList.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200 text-gray-400">
          Aucun budget disponible
        </div>
      ) : selected && (
        <>
          {/* Budget header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm text-gray-500">Budget total {selected.annee}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(selected.total_budget)}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                selected.statut === 'Approuvé' ? 'bg-green-100 text-green-700' :
                selected.statut === 'Brouillon' ? 'bg-gray-100 text-gray-600' :
                'bg-blue-100 text-blue-700'
              }`}>{selected.statut}</span>
            </div>
          </div>

          {/* Synthèse par catégorie */}
          {loadingSynth ? (
            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full" /></div>
          ) : synthese && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Suivi par catégorie</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {synthese.map((ligne) => (
                  <div key={ligne.categorie} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{ligne.categorie}</span>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Budget : <span className="font-semibold text-gray-700">{fmt(ligne.budget_annuel)}</span></span>
                        <span>Consommé : <span className={`font-semibold ${ligne.pct_consomme > 100 ? 'text-red-600' : 'text-amber-600'}`}>{fmt(ligne.consomme)}</span></span>
                        <span>Restant : <span className={`font-semibold ${ligne.restant < 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(ligne.restant)}</span></span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${ligne.pct_consomme > 100 ? 'bg-red-500' : ligne.pct_consomme > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${pct(ligne.consomme, ligne.budget_annuel)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{ligne.pct_consomme}% consommé</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MBBudget;
