import { formatMAD } from '../../utils/currency';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { users, tickets, finances, cotisations } from '../../api/client';
import { Link } from 'react-router-dom';

function fmt(n) {
  return formatMAD(n || 0);
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

function GestDashboard() {
  const { user, selectedCoproId, coproprietes } = useAuth();
  const [stats, setStats] = useState(null);
  const [alertesCotisations, setAlertesCotisations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [annee, setAnnee] = useState(currentYear);

  useEffect(() => {
    if (!selectedCoproId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      users.byResidence(selectedCoproId),
      tickets.getAll(selectedCoproId),
      finances.getByResidence(selectedCoproId, annee),
      cotisations.getAlertes(selectedCoproId),
    ])
      .then(([copropietaires, allTickets, fin, alertes]) => {
        const openTickets = allTickets.filter((t) => t.statut === 'Ouvert').length;
        setStats({ nbCopropietaires: copropietaires.length, openTickets, finances: fin });
        setAlertesCotisations(alertes);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedCoproId, annee]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!selectedCoproId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">
        <p className="font-medium">Aucune résidence assignée</p>
        <p className="text-sm mt-1">Contactez l'administrateur pour vous assigner une résidence.</p>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">Erreur : {error}</div>;
  }

  const fin = stats?.finances;
  const budgetRestant = fin ? (fin.budget_annuel - fin.total_depenses_realisees) : 0;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-1">
            {coproprietes.find((c) => c.id === selectedCoproId)?.nom || user.copropriete_nom}
          </p>
        </div>
        <select
          value={annee}
          onChange={(e) => setAnnee(parseInt(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Copropriétaires</p>
              <p className="mt-1 text-2xl font-bold text-gray-800">{stats?.nbCopropietaires || 0}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Tickets ouverts</p>
              <p className="mt-1 text-2xl font-bold text-gray-800">{stats?.openTickets || 0}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Cotisations impayées</p>
              <p className="mt-1 text-xl font-bold text-red-600">{fmt(fin?.total_cot_impaye)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Mois échus non payés</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">À collecter</p>
              <p className="mt-1 text-xl font-bold text-purple-600">{fmt(fin?.total_cot_a_collecter)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total restant dû</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Budget restant</p>
              <p className={`mt-1 text-2xl font-bold ${budgetRestant >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(budgetRestant)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Cotisation alerts */}
      {alertesCotisations && (alertesCotisations.expirant_bientot?.length > 0 || alertesCotisations.impayes?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {alertesCotisations.expirant_bientot?.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-700">
                    {alertesCotisations.expirant_bientot.length} cotisation(s) expirent bientôt
                  </p>
                  <p className="text-xs text-orange-600 mt-0.5">Dans les 60 prochains jours</p>
                  <Link to="/gestionnaire/cotisations" className="inline-block mt-2 text-xs text-orange-700 underline hover:no-underline font-medium">
                    Gérer les cotisations
                  </Link>
                </div>
              </div>
            </div>
          )}
          {alertesCotisations.impayes?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-100 text-red-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">
                    {alertesCotisations.impayes.length} cotisation(s) avec paiements en retard
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {alertesCotisations.impayes.slice(0, 2).map((c) => `${c.prenom} ${c.nom}`).join(', ')}
                    {alertesCotisations.impayes.length > 2 ? ` +${alertesCotisations.impayes.length - 2}` : ''}
                  </p>
                  <Link to="/gestionnaire/cotisations" className="inline-block mt-2 text-xs text-red-700 underline hover:no-underline font-medium">
                    Voir les impayés
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {fin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Finances summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Résumé financier</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Budget annuel</span>
                <span className="font-medium text-gray-800">{fmt(fin.budget_annuel)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dépenses réalisées</span>
                <span className="font-medium text-gray-800">{fmt(fin.total_depenses_realisees)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Cotisations collectées</span>
                <span className="font-medium text-green-600">{fmt(fin.total_cot_paye)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Cotisations impayées</span>
                <span className="font-medium text-red-600">{fmt(fin.total_cot_impaye)}</span>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Taux de recouvrement</span>
                  <span className="font-bold text-gray-800">
                    {fin.total_cot_attendu > 0 ? Math.round((fin.total_cot_paye / fin.total_cot_attendu) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${fin.total_cot_attendu > 0 ? Math.round((fin.total_cot_paye / fin.total_cot_attendu) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Recent charges */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Dernières dépenses</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {(fin.depenses_list || []).slice(0, 5).map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{d.libelle}</p>
                    <p className="text-xs text-gray-400">{d.categorie}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{fmt(d.montant)}</span>
                </div>
              ))}
              {(fin.depenses_list || []).length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-400">Aucune dépense</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestDashboard;
