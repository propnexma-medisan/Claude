import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api/client';

function Badge({ children, color }) {
  const colors = {
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    gray: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

function TauxBar({ taux }) {
  if (taux === null) return <span className="text-gray-400 text-xs">—</span>;
  const color = taux >= 80 ? '#22c55e' : taux >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div style={{ width: `${taux}%`, backgroundColor: color }} className="h-full rounded-full" />
      </div>
      <span className="text-xs font-medium tabular-nums" style={{ color }}>{taux}%</span>
    </div>
  );
}

export default function RapportCotisations() {
  const { selectedCoproId, coproprietes } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const printRef = useRef();

  const coproId = selectedCoproId || coproprietes?.[0]?.id;

  useEffect(() => {
    if (!coproId) return;
    setLoading(true);
    setError(null);
    api.get(`/rapports/cotisations?copropriete_id=${coproId}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [coproId]);

  function handlePrint() {
    window.print();
  }

  if (!coproId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Aucune résidence sélectionnée
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapport Cotisations</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">
              {data.residence.nom} — généré le {new Date(data.genere_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
        <button
          onClick={handlePrint}
          disabled={!data}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#163050] disabled:opacity-40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimer / PDF
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div ref={printRef}>
          {/* Print header (hidden on screen) */}
          <div className="hidden print:block mb-6">
            <h1 className="text-xl font-bold text-gray-900">Rapport Cotisations — {data.residence.nom}</h1>
            <p className="text-sm text-gray-500">Généré le {new Date(data.genere_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>

          {/* Totaux */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Copropriétaires</p>
              <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{data.totaux.nb_copropietaires}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Charges mensuelles</p>
              <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
                {data.totaux.total_mensuel.toLocaleString('fr-FR')} <span className="text-sm font-normal text-gray-400">DH</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total encaissé</p>
              <p className="text-2xl font-bold text-green-700 mt-1 tabular-nums">
                {data.totaux.total_encaisse.toLocaleString('fr-FR')} <span className="text-sm font-normal text-gray-400">DH</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total impayé</p>
              <p className="text-2xl font-bold text-red-600 mt-1 tabular-nums">
                {data.totaux.total_impaye.toLocaleString('fr-FR')} <span className="text-sm font-normal text-gray-400">DH</span>
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Lot</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Copropriétaire</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap text-right">Mensualité</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap text-right">Mois payés</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap text-right">Encaissé</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap text-right">Impayé</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Taux</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.copropietaires.map((cp) => {
                    const hasCot = !!cp.cotisation;
                    const impaye = hasCot ? cp.impaye : 0;
                    return (
                      <tr key={cp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                          {cp.lot ? cp.lot.numero : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{cp.prenom} {cp.nom}</div>
                          <div className="text-xs text-gray-400">{cp.email}</div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                          {hasCot
                            ? <>{cp.cotisation.montant_mensuel.toLocaleString('fr-FR')} <span className="text-gray-400">DH</span></>
                            : <span className="text-gray-400 text-xs">Sans cotisation</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                          {hasCot
                            ? <>{cp.paiements.mois_payes}<span className="text-gray-400">/{cp.paiements.total_mois}</span></>
                            : <span className="text-gray-400">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-700 whitespace-nowrap">
                          {hasCot
                            ? <>{cp.paiements.total_encaisse.toLocaleString('fr-FR')} <span className="text-gray-400">DH</span></>
                            : <span className="text-gray-400">0 DH</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold whitespace-nowrap">
                          <span className={impaye > 0 ? 'text-red-600' : 'text-gray-400'}>
                            {impaye.toLocaleString('fr-FR')} <span className="font-normal text-gray-400">DH</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <TauxBar taux={hasCot ? cp.taux_recouvrement : null} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!hasCot
                            ? <Badge color="gray">Sans cotisation</Badge>
                            : cp.paiements.mois_en_retard > 0
                              ? <Badge color="red">En retard</Badge>
                              : cp.paiements.mois_payes === cp.paiements.total_mois
                                ? <Badge color="green">À jour</Badge>
                                : <Badge color="yellow">En attente</Badge>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Print footer */}
          <div className="hidden print:block mt-6 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
            SyndicPro — Rapport généré le {new Date(data.genere_le).toLocaleDateString('fr-FR')}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .hidden.print\\:block { display: block !important; }
          body { font-size: 11px; }
          table { font-size: 10px; }
        }
      `}</style>
    </div>
  );
}
