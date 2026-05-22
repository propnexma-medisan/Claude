import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/client';

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

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

function JoursRestantsBadge({ jours, statut }) {
  if (statut === 'Expirée' || jours < 0) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Expirée</span>;
  }
  if (jours < 7) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{jours}j</span>;
  }
  if (jours < 30) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{jours}j</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{jours}j</span>;
}

function KpiCard({ label, value, sub, subColor, color, icon }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500 truncate">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{value}</p>
          {sub && (
            <p className={`text-xs mt-1 font-medium ${subColor || 'text-gray-400'}`}>{sub}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([adminApi.getStats(), adminApi.getDashboard()])
      .then(([s, d]) => { setStats(s); setDashData(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

  const urgentTickets = (stats.tickets.par_priorite || []).find(p => p.priorite === 'Urgente')?.count || 0;
  const budgetPct = stats.budgets.montant_total_annuel > 0
    ? Math.round((stats.depenses.total_annee_courante / stats.budgets.montant_total_annuel) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Tableau de bord Global</h1>
        <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de la plateforme SyndicPro</p>
      </div>

      {/* Row 1 — KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Résidences"
          value={stats.residences.total}
          color="bg-blue-50 text-blue-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <KpiCard
          label="Copropriétaires"
          value={stats.copropietaires.total}
          sub={`${stats.copropietaires.actifs} actifs`}
          subColor="text-green-600"
          color="bg-green-50 text-green-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <KpiCard
          label="Cotisations actives"
          value={stats.cotisations.actives}
          sub={stats.cotisations.expirant_30j > 0 ? `${stats.cotisations.expirant_30j} expirent bientôt` : null}
          subColor="text-orange-500"
          color="bg-purple-50 text-purple-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
        <KpiCard
          label="Tickets ouverts"
          value={stats.tickets.ouverts + stats.tickets.en_cours}
          sub={urgentTickets > 0 ? `${urgentTickets} urgents` : null}
          subColor="text-red-600"
          color="bg-red-50 text-red-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          }
        />
        <KpiCard
          label="Budget total annuel"
          value={fmt(stats.budgets.montant_total_annuel)}
          color="bg-indigo-50 text-indigo-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <KpiCard
          label="Dépenses année courante"
          value={fmt(stats.depenses.total_annee_courante)}
          sub={`${budgetPct}% du budget`}
          subColor={budgetPct > 90 ? 'text-red-600' : budgetPct > 70 ? 'text-orange-500' : 'text-gray-500'}
          color="bg-orange-50 text-orange-600"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Row 2 — Alerts */}
      {(stats.cotisations.expirees > 0 || stats.cotisations.expirant_30j > 0 || urgentTickets > 0) && (
        <div className="space-y-2">
          {stats.cotisations.expirees > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700 font-medium">
                {stats.cotisations.expirees} cotisation{stats.cotisations.expirees > 1 ? 's' : ''} expirée{stats.cotisations.expirees > 1 ? 's' : ''} non renouvelée{stats.cotisations.expirees > 1 ? 's' : ''}
              </p>
              <Link to="/admin/cotisations" className="ml-auto text-xs font-semibold text-red-600 hover:text-red-800 underline">Voir</Link>
            </div>
          )}
          {stats.cotisations.expirant_30j > 0 && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-orange-700 font-medium">
                {stats.cotisations.expirant_30j} cotisation{stats.cotisations.expirant_30j > 1 ? 's' : ''} expir{stats.cotisations.expirant_30j > 1 ? 'ent' : 'e'} dans 30 jours
              </p>
              <Link to="/admin/cotisations" className="ml-auto text-xs font-semibold text-orange-600 hover:text-orange-800 underline">Voir</Link>
            </div>
          )}
          {urgentTickets > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              <p className="text-sm text-red-700 font-medium">
                {urgentTickets} ticket{urgentTickets > 1 ? 's' : ''} urgent{urgentTickets > 1 ? 's' : ''} non traité{urgentTickets > 1 ? 's' : ''}
              </p>
              <Link to="/admin/tickets" className="ml-auto text-xs font-semibold text-red-600 hover:text-red-800 underline">Voir</Link>
            </div>
          )}
        </div>
      )}

      {/* Row 3 — Résidences table + Derniers tickets */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Résidences */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Résidences</h2>
            <Link to="/admin/residences" className="text-xs text-purple-600 hover:underline font-medium">Gérer</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Nom', 'Gestionnaire', 'Copr.', 'Budget', 'Dépenses', 'Taux', 'Tickets'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(!dashData?.residences || dashData.residences.length === 0) && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">Aucune résidence</td></tr>
                )}
                {(dashData?.residences || []).map((r) => {
                  const taux = r.budget_annuel > 0 ? Math.round((r.total_depenses / r.budget_annuel) * 100) : 0;
                  return (
                    <tr key={r.id} className="hover:bg-purple-50/40 cursor-pointer transition-colors">
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-800 text-xs">{r.nom}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{r.gestionnaire_nom || <span className="text-gray-400">-</span>}</td>
                      <td className="px-3 py-3 text-xs text-center font-medium text-gray-700">{r.nb_copropietaires}</td>
                      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{fmt(r.budget_annuel)}</td>
                      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{fmt(r.total_depenses)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${taux > 90 ? 'bg-red-500' : taux > 70 ? 'bg-orange-400' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(taux, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700">{taux}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {r.tickets_ouverts > 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            {r.tickets_ouverts}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Derniers tickets */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Derniers tickets</h2>
            <Link to="/admin/tickets" className="text-xs text-purple-600 hover:underline font-medium">Tous voir</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(!dashData?.recentTickets || dashData.recentTickets.length === 0) && (
              <p className="px-5 py-6 text-sm text-center text-gray-400">Aucun ticket</p>
            )}
            {(dashData?.recentTickets || []).map((t) => (
              <div key={t.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 mt-0.5 ${PRIORITY_COLORS[t.priorite] || 'bg-gray-100 text-gray-600'}`}>
                    {t.priorite}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.titre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-400 truncate">{t.copropriete_nom}</p>
                      <span className="text-gray-300">·</span>
                      <p className="text-xs text-gray-400 flex-shrink-0">{fmtDate(t.created_at)}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[t.statut] || 'bg-gray-100 text-gray-600'}`}>
                    {t.statut}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4 — Cotisations à surveiller + Activité récente */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Cotisations à surveiller */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Cotisations à surveiller</h2>
            <Link to="/admin/cotisations" className="text-xs text-purple-600 hover:underline font-medium">Toutes voir</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(!dashData?.cotisationsSurveillance || dashData.cotisationsSurveillance.length === 0) && (
              <p className="px-5 py-6 text-sm text-center text-gray-400">Aucune cotisation à surveiller</p>
            )}
            {(dashData?.cotisationsSurveillance || []).map((c) => (
              <div key={c.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <JoursRestantsBadge jours={c.jours_restants} statut={c.statut} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">{c.prenom} {c.nom}</p>
                  <p className="text-xs text-gray-400">{c.copropriete_nom} · Échéance : {fmtDate(c.date_fin)}</p>
                </div>
                <p className="text-xs font-semibold text-gray-600 flex-shrink-0">{fmt(c.montant_mensuel)}/mois</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activité récente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Activité récente</h2>
            <Link to="/admin/communications" className="text-xs text-purple-600 hover:underline font-medium">Tout voir</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(!dashData?.recentComms || dashData.recentComms.length === 0) && (
              <p className="px-5 py-6 text-sm text-center text-gray-400">Aucune communication récente</p>
            )}
            {(dashData?.recentComms || []).map((c, idx) => (
              <div key={`${c.type}-${c.id}-${idx}`} className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 mt-0.5 ${c.type === 'relance' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                  {c.type === 'relance' ? 'Relance' : 'Message'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.objet || c.titre_ou_objet}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400 truncate">{c.copropriete_nom}</p>
                    <span className="text-gray-300">·</span>
                    <p className="text-xs text-gray-400 flex-shrink-0">{fmtDate(c.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
