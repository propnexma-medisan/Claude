import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { finances, cotisations as cotisationsApi } from '../../api/client';

function fmt(n) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(n || 0);
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

function StatCard({ label, value, sub, color = 'blue', icon }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className={`mt-1 text-xl font-bold ${color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-gray-800'}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function MBDashboard() {
  const { user } = useAuth();
  const [fin, setFin] = useState(null);
  const [alertes, setAlertes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [annee, setAnnee] = useState(currentYear);

  useEffect(() => {
    if (!user?.copropriete_id) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      finances.getByResidence(user.copropriete_id, annee),
      cotisationsApi.getAlertes(user.copropriete_id),
    ])
      .then(([finData, alertesData]) => {
        setFin(finData);
        setAlertes(alertesData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.copropriete_id, annee]);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>;

  const budgetRestant = fin ? fin.budget_annuel - fin.total_depenses_realisees : 0;
  const tauxRecouvrement = fin && fin.total_cot_attendu > 0
    ? Math.round((fin.total_cot_paye / fin.total_cot_attendu) * 100)
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-1">{fin?.copropriete?.nom || user?.copropriete_nom || ''} · Vue bureau syndical</p>
        </div>
        <select
          value={annee}
          onChange={(e) => setAnnee(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Badge lecture seule */}
      <div className="mb-5 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-lg">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Mode lecture seule — bureau syndical
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Budget annuel"
          value={fmt(fin?.budget_annuel)}
          sub={`Exercice ${annee}`}
          color="blue"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        />
        <StatCard
          label="Dépenses réalisées"
          value={fmt(fin?.total_depenses_realisees)}
          sub={`Exercice ${annee}`}
          color="amber"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
        />
        <StatCard
          label="Budget restant"
          value={fmt(budgetRestant)}
          sub={budgetRestant < 0 ? 'Dépassement !' : 'Disponible'}
          color={budgetRestant < 0 ? 'red' : 'green'}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Cotisations collectées"
          value={fmt(fin?.total_cot_paye)}
          sub={`${tauxRecouvrement}% de recouvrement`}
          color="green"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Cotisations impayées"
          value={fmt(fin?.total_cot_impaye)}
          sub="Mois échus"
          color="red"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
      </div>

      {/* Alertes */}
      {alertes && (
        <div className="space-y-3 mb-6">
          {alertes.impayes?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 mb-2">
                {alertes.impayes.length} cotisation(s) avec paiements en retard
              </p>
              <div className="space-y-1">
                {alertes.impayes.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs text-red-600">
                    <span>{c.prenom} {c.nom} {c.lot_numero ? `— Lot ${c.lot_numero}` : ''}</span>
                    <span className="font-medium">{c.nb_impayes} mois impayé(s)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {alertes.expirant_bientot?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-700 mb-2">
                {alertes.expirant_bientot.length} cotisation(s) expirant dans 60 jours
              </p>
              <div className="space-y-1">
                {alertes.expirant_bientot.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs text-amber-600">
                    <span>{c.prenom} {c.nom}</span>
                    <span>dans {c.jours_restants} j — expire {new Date(c.date_fin).toLocaleDateString('fr-FR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dernières dépenses */}
      {fin?.depenses_list?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Dernières dépenses {annee}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Libellé</th>
                  <th className="pb-2 font-medium">Catégorie</th>
                  <th className="pb-2 font-medium text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fin.depenses_list.slice(0, 8).map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5 text-gray-500">{new Date(d.date_depense).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2.5 font-medium text-gray-800">{d.libelle}</td>
                    <td className="py-2.5 text-gray-500">{d.categorie}</td>
                    <td className="py-2.5 text-right font-semibold text-gray-800">{fmt(d.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default MBDashboard;
