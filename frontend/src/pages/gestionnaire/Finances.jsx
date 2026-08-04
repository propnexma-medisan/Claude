import { formatMAD } from '../../utils/currency';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { finances } from '../../api/client';

function fmt(n) { return formatMAD(n || 0); }

const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function buildMonthlyData(recettes_par_mois, depenses_par_mois, annee) {
  const rec = {};
  const dep = {};
  (recettes_par_mois || []).forEach((r) => { rec[r.mois] = r.recettes; });
  (depenses_par_mois || []).forEach((d) => { dep[d.mois] = d.depenses; });
  return MONTHS_SHORT.map((label, i) => {
    const mois = `${annee}-${String(i + 1).padStart(2, '0')}`;
    return { label, recettes: rec[mois] || 0, depenses: dep[mois] || 0 };
  });
}

function BarChart({ data }) {
  const maxVal = Math.max(...data.flatMap((d) => [d.recettes, d.depenses]), 1);
  const VW = 620;
  const VH = 180;
  const PAD = { top: 12, bottom: 28, left: 52, right: 8 };
  const chartH = VH - PAD.top - PAD.bottom;
  const chartW = VW - PAD.left - PAD.right;
  const groupW = chartW / 12;
  const barW = Math.min(groupW * 0.35, 18);
  const yTicks = 4;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ height: VH }}>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = (maxVal / yTicks) * i;
        const y = PAD.top + chartH - (val / maxVal) * chartH;
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={VW - PAD.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 3.5} textAnchor="end" fontSize="9.5" fill="#9ca3af" fontFamily="system-ui,sans-serif">
              {val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = PAD.left + (i + 0.5) * groupW;
        const rh = Math.max((d.recettes / maxVal) * chartH, d.recettes > 0 ? 2 : 0);
        const dh = Math.max((d.depenses / maxVal) * chartH, d.depenses > 0 ? 2 : 0);
        return (
          <g key={i}>
            <rect x={cx - barW - 2} y={PAD.top + chartH - rh} width={barW} height={rh} fill="#3b82f6" rx="2" opacity="0.85" />
            <rect x={cx + 2} y={PAD.top + chartH - dh} width={barW} height={dh} fill="#f97316" rx="2" opacity="0.85" />
            <text x={cx} y={VH - PAD.bottom + 14} textAnchor="middle" fontSize="9.5" fill="#6b7280" fontFamily="system-ui,sans-serif">
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke="#e5e7eb" strokeWidth="1" />
      <line x1={PAD.left} y1={PAD.top + chartH} x2={VW - PAD.right} y2={PAD.top + chartH} stroke="#e5e7eb" strokeWidth="1" />
    </svg>
  );
}

function KpiCard({ icon, label, value, color, sub }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color.bg}`}>
          {icon}
        </div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
      </div>
      <p className={`text-xl font-bold ${color.text}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Finances() {
  const { user, selectedCoproId } = useAuth();
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedCoproId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    finances.getByResidence(selectedCoproId, annee)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedCoproId, annee]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  if (!selectedCoproId && !user?.copropriete_id) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700 text-sm">
        Aucune résidence assignée.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">Erreur : {error}</div>;
  }

  const recettes = data?.total_cot_paye_annee ?? data?.total_cot_paye ?? 0;
  const depenses = data?.total_depenses_realisees || 0;
  const impaye = data?.total_cot_impaye_annee ?? data?.total_cot_impaye ?? 0;
  const solde = recettes - depenses;
  const attendu = data?.total_cot_attendu_annee ?? data?.total_cot_attendu ?? 0;
  const taux = attendu > 0 ? Math.round((recettes / attendu) * 100) : 0;

  const monthlyData = buildMonthlyData(data?.recettes_par_mois, data?.depenses_par_mois, annee);
  const categories = data?.depenses_par_categorie || [];
  const topCatMax = categories[0]?.total || 1;
  const topImpayeurs = data?.top_impayeurs || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tableau de bord financier</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.copropriete?.nom}</p>
        </div>
        <select
          value={annee}
          onChange={(e) => setAnnee(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        >
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={`Recettes ${annee}`}
          value={fmt(recettes)}
          sub="Cotisations encaissées"
          color={{ bg: 'bg-blue-50', text: 'text-blue-600' }}
          icon={
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KpiCard
          label={`Dépenses ${annee}`}
          value={fmt(depenses)}
          sub="Charges réalisées"
          color={{ bg: 'bg-orange-50', text: 'text-orange-500' }}
          icon={
            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          }
        />
        <KpiCard
          label="Solde net"
          value={fmt(solde)}
          sub="Recettes − Dépenses"
          color={{ bg: solde >= 0 ? 'bg-green-50' : 'bg-red-50', text: solde >= 0 ? 'text-green-600' : 'text-red-600' }}
          icon={
            <svg className={`w-4 h-4 ${solde >= 0 ? 'text-green-600' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={solde >= 0 ? 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' : 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6'} />
            </svg>
          }
        />
        <KpiCard
          label="Impayés"
          value={fmt(impaye)}
          sub="Cotisations en retard"
          color={{ bg: 'bg-red-50', text: 'text-red-500' }}
          icon={
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      {/* Chart + Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Recettes vs Dépenses — {annee}</h2>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2.5 rounded-sm bg-blue-500 inline-block opacity-85" />
                Recettes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2.5 rounded-sm bg-orange-500 inline-block opacity-85" />
                Dépenses
              </span>
            </div>
          </div>
          <BarChart data={monthlyData} />
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Dépenses par catégorie</h2>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Aucune dépense enregistrée</p>
          ) : (
            <div className="space-y-3.5">
              {categories.slice(0, 8).map((cat) => (
                <div key={cat.categorie}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600 truncate max-w-[140px]">{cat.categorie || 'Autre'}</span>
                    <span className="text-xs font-semibold text-gray-700 tabular-nums ml-2 flex-shrink-0">{fmt(cat.total)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-400"
                      style={{ width: `${Math.round((cat.total / topCatMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Taux de recouvrement */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">Taux de recouvrement</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Cotisations encaissées ({fmt(recettes)}) sur cotisations dues à ce jour ({fmt(attendu)})
            </p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{taux}%</p>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${taux}%`,
              backgroundColor: taux >= 80 ? '#22c55e' : taux >= 50 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
      </div>

      {/* Top impayeurs */}
      {topImpayeurs.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top impayeurs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Copropriétaire', 'Lot', 'Mois impayés', 'Montant dû'].map((h) => (
                    <th key={h} className={`pb-2 text-xs font-medium text-gray-400 uppercase ${h === 'Montant dû' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topImpayeurs.map((u, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-2.5 font-medium text-gray-800">{u.prenom} {u.nom}</td>
                    <td className="py-2.5 text-gray-500 text-xs">{u.lot_numero || '—'}</td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                        {u.nb_mois} mois
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-red-600 tabular-nums">{fmt(u.montant_du)}</td>
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

export default Finances;
