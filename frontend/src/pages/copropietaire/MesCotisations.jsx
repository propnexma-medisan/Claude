import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { cotisations, relances } from '../../api/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('fr-FR');
}

function fmtMonthLong(mois) {
  if (!mois) return '—';
  const [y, m] = mois.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function fmtMonthShort(mois) {
  if (!mois) return '—';
  const [y, m] = mois.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dateStr + 'T00:00:00');
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

const PAIEMENT_COLORS = {
  Payé: 'bg-green-100 text-green-700 border-green-200',
  'En attente': 'bg-gray-100 text-gray-500 border-gray-200',
  'En retard': 'bg-red-100 text-red-600 border-red-200',
  Partiel: 'bg-orange-100 text-orange-600 border-orange-200',
};

const PAIEMENT_ICONS = {
  Payé: '✓',
  'En attente': '○',
  'En retard': '⚠',
  Partiel: '◑',
};

// ─── MonthCell ────────────────────────────────────────────────────────────────
function MonthCell({ p }) {
  const icon = PAIEMENT_ICONS[p.statut] || '○';
  const colors = PAIEMENT_COLORS[p.statut] || 'bg-gray-100 text-gray-500 border-gray-200';
  return (
    <div className={`w-[60px] h-[60px] rounded-xl border flex flex-col items-center justify-center gap-0.5 ${colors}`}>
      <span className="text-base leading-none">{icon}</span>
      <span className="text-[11px] font-medium leading-none">{capitalize(fmtMonthShort(p.mois))}</span>
      <span className="text-[9px] leading-none opacity-70">{p.mois?.split('-')[0]}</span>
    </div>
  );
}

// ─── Cotisation card ──────────────────────────────────────────────────────────
function CotisationCard({ c, isActive, expanded, onToggle }) {
  const paiements = c.paiements || [];
  const totalPaye = paiements.filter((p) => p.statut === 'Payé').reduce((s, p) => s + p.montant, 0);
  const totalAttendu = paiements.reduce((s, p) => s + p.montant, 0);
  const solde = totalAttendu - totalPaye;
  const payeCount = paiements.filter((p) => p.statut === 'Payé').length;
  const totalMonths = paiements.length || 1;
  const progressPct = Math.round((payeCount / totalMonths) * 100);

  const STATUT_COLORS = {
    Active: 'bg-green-100 text-green-700',
    Expirée: 'bg-red-100 text-red-700',
    Suspendue: 'bg-yellow-100 text-yellow-700',
    Résiliée: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${isActive ? 'border-blue-200' : 'border-gray-100'} overflow-hidden`}>
      {/* Header */}
      <div className={`px-6 py-5 ${isActive ? 'bg-blue-50' : 'bg-gray-50'}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className={`text-lg font-bold ${isActive ? 'text-blue-800' : 'text-gray-700'}`}>
                {capitalize(fmtMonthLong(c.date_debut?.substring(0, 7)))} — {capitalize(fmtMonthLong(c.date_fin?.substring(0, 7)))}
              </h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[c.statut] || 'bg-gray-100 text-gray-600'}`}>
                {c.statut}
              </span>
            </div>
            {c.lot_numero && (
              <p className="text-sm text-gray-500">Lot {c.lot_numero}{c.lot_type ? ` — ${c.lot_type}` : ''}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-2xl font-bold ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
              {fmt(c.montant_mensuel)}<span className="text-sm font-normal text-gray-500">/mois</span>
            </p>
          </div>
        </div>

        {/* Progress bar (active cotisation) */}
        {isActive && totalMonths > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>{payeCount} mois payés sur {totalMonths}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-2.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Alert: expiring soon */}
        {isActive && c.statut === 'Active' && (() => {
          const days = daysUntil(c.date_fin);
          if (days <= 60 && days >= 0) {
            return (
              <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ${days <= 30 ? 'bg-red-100 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>
                  Votre cotisation expire dans <strong>{days} jours</strong> (le {fmtDate(c.date_fin)}).
                  Contactez votre gestionnaire pour le renouvellement.
                </span>
              </div>
            );
          }
          return null;
        })()}

        {/* Alert: expired */}
        {isActive && c.statut === 'Expirée' && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 rounded-xl p-3 text-sm text-red-700">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Votre cotisation a expiré le <strong>{fmtDate(c.date_fin)}</strong>.
              Veuillez contacter votre gestionnaire.
            </span>
          </div>
        )}
      </div>

      {/* Payments calendar */}
      {isActive && (
        <div className="px-6 py-5 border-t border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Mes paiements</h3>
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="text-green-600 font-medium">{fmt(totalPaye)} payé</span>
              <span>/ {fmt(totalAttendu)} total</span>
              {solde > 0 && <span className="text-red-500">Solde: {fmt(solde)}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {paiements.map((p) => (
              <MonthCell key={p.id} p={p} />
            ))}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-gray-100">
            {Object.entries(PAIEMENT_ICONS).map(([s, icon]) => (
              <div key={s} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-5 h-5 rounded flex items-center justify-center border ${PAIEMENT_COLORS[s]}`}>{icon}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Total payé</p>
              <p className="font-bold text-green-600">{fmt(totalPaye)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Total attendu</p>
              <p className="font-bold text-gray-700">{fmt(totalAttendu)}</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${solde > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className="text-xs text-gray-500 mb-1">Solde restant</p>
              <p className={`font-bold ${solde > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(solde)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Past cotisation toggle */}
      {!isActive && (
        <div className="px-6 py-3 border-t border-gray-100">
          <button onClick={onToggle} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1.5">
            {expanded ? 'Masquer' : 'Voir les paiements'}
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expanded && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1.5">
                {paiements.map((p) => (
                  <MonthCell key={p.id} p={p} />
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <span className="text-green-600">{fmt(totalPaye)} payé</span>
                <span>/ {fmt(totalAttendu)} total</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function MesCotisations() {
  const { user } = useAuth();
  const [allCotisations, setAllCotisations] = useState([]);
  const [mesRelances, setMesRelances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPast, setExpandedPast] = useState({});
  const [expandedRelance, setExpandedRelance] = useState(null);

  const load = useCallback(() => {
    if (!user?.copropriete_id) { setLoading(false); return; }
    Promise.all([
      cotisations.getAll({ copropriete_id: user.copropriete_id }),
      relances.getMesRelances(),
    ])
      .then(async ([cotisList, relanceList]) => {
        // Fetch paiements for each cotisation
        const withPaiements = await Promise.all(
          cotisList.map((c) => cotisations.getById(c.id))
        );
        setAllCotisations(withPaiements);
        setMesRelances(relanceList);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleRelanceClick(r) {
    if (r.statut === 'Envoyée') {
      try {
        await relances.update(r.id, { statut: 'Lue' });
        setMesRelances((prev) => prev.map((x) => x.id === r.id ? { ...x, statut: 'Lue' } : x));
      } catch {
        // ignore
      }
    }
    setExpandedRelance(expandedRelance === r.id ? null : r.id);
  }

  if (!user?.copropriete_id) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">
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
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>;
  }

  const activeCotisation = allCotisations.find((c) => c.statut === 'Active');
  const pastCotisations = allCotisations.filter((c) => c.statut !== 'Active');
  const newRelancesCount = mesRelances.filter((r) => r.statut === 'Envoyée').length;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mes cotisations</h1>
        <p className="text-sm text-gray-500 mt-1">{user.copropriete_nom || ''}</p>
      </div>

      {/* No cotisation */}
      {allCotisations.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center text-gray-500">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-medium">Aucune cotisation</p>
          <p className="text-sm mt-1">Votre gestionnaire n'a pas encore créé de cotisation pour vous.</p>
        </div>
      )}

      {/* Active cotisation */}
      {activeCotisation && (
        <CotisationCard c={activeCotisation} isActive={true} />
      )}

      {/* Relances */}
      {mesRelances.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Mes notifications</h2>
            {newRelancesCount > 0 && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2.5 py-1 rounded-full font-medium">
                {newRelancesCount} nouveau{newRelancesCount > 1 ? 'x' : ''}
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {mesRelances.map((r) => (
              <button
                key={r.id}
                onClick={() => handleRelanceClick(r)}
                className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-800 truncate">{r.objet}</span>
                      {r.statut === 'Envoyée' && (
                        <span className="flex-shrink-0 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                          Nouveau
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{new Date(r.sent_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      <span>·</span>
                      <span className={`px-1.5 py-0.5 rounded-full ${
                        r.type === 'Impayé' ? 'bg-red-100 text-red-500' :
                        r.type === 'Fin de période' ? 'bg-orange-100 text-orange-500' :
                        'bg-blue-100 text-blue-500'
                      }`}>{r.type}</span>
                    </div>
                    {expandedRelance !== r.id && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{r.message?.split('\n')[0]}</p>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${expandedRelance === r.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {expandedRelance === r.id && (
                  <div className="mt-3 bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-line text-left">
                    {r.message}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Past cotisations */}
      {pastCotisations.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Cotisations passées</h2>
          <div className="space-y-3">
            {pastCotisations.map((c) => (
              <CotisationCard
                key={c.id}
                c={c}
                isActive={false}
                expanded={!!expandedPast[c.id]}
                onToggle={() => setExpandedPast((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MesCotisations;
