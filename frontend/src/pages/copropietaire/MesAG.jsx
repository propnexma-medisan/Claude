import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { assemblees as agApi } from '../../api/client';

const STATUT_COLORS = {
  'Planifiée': 'bg-blue-100 text-blue-700',
  'En cours': 'bg-amber-100 text-amber-700',
  'Terminée': 'bg-green-100 text-green-700',
  'Annulée': 'bg-gray-100 text-gray-500',
};

const RESULTAT_COLORS = {
  'Approuvé': 'bg-green-100 text-green-700',
  'Refusé': 'bg-red-100 text-red-700',
  'Ajourné': 'bg-amber-100 text-amber-700',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function openHtmlWindow(html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.onload = () => { URL.revokeObjectURL(url); setTimeout(() => w.print(), 300); };
  }
}

function AGCard({ ag, onOpen }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-gray-800">AG {ag.type}</p>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUT_COLORS[ag.statut] || 'bg-gray-100 text-gray-600'}`}>{ag.statut}</span>
            {ag.pv_genere ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">PV disponible</span> : null}
          </div>
          <div className="text-xs text-gray-400 space-y-0.5 mt-1.5">
            <p>📅 {fmtDate(ag.date)} à {ag.heure}</p>
            <p>📍 {ag.lieu}</p>
            <p>📋 {ag.nb_points || 0} point(s) à l'ordre du jour</p>
          </div>
        </div>
        {(ag.statut === 'Terminée' || ag.nb_points > 0) && (
          <button
            onClick={() => onOpen(ag)}
            className="flex-shrink-0 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100"
          >
            Voir détail
          </button>
        )}
      </div>
    </div>
  );
}

function AGDetailView({ ag, onBack }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    agApi.getById(ag.id)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ag.id]);

  const openPV = async () => {
    setPdfLoading(true);
    try {
      const html = await agApi.getPV(ag.id);
      openHtmlWindow(html);
    } catch (e) {
      alert(e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const d = detail || ag;
  const points = d.points || [];
  const presences = d.presences || [];
  const presents = presences.filter((p) => p.statut === 'Présent' || p.statut === 'Procuration');
  const tantiemesPresents = presents.reduce((s, p) => s + (p.tantiemes || 0), 0);
  const totalT = d.total_tantiemes || presences.reduce((s, p) => s + (p.tantiemes || 0), 0);
  const quorumPct = totalT > 0 ? Math.round((tantiemesPresents / totalT) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-800">AG {d.type}</h2>
          <p className="text-sm text-gray-500">{fmtDate(d.date)} à {d.heure} — {d.lieu}</p>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-xs text-blue-500 font-medium uppercase mb-0.5">Résidence</p><p className="font-medium text-blue-900">{d.copropriete_nom}</p></div>
          <div><p className="text-xs text-blue-500 font-medium uppercase mb-0.5">Statut</p><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUT_COLORS[d.statut] || ''}`}>{d.statut}</span></div>
          {d.convocations_envoyees ? (
            <div className="col-span-2">
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                ✓ Convocation reçue par email
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Ordre du jour */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Ordre du jour</h3>
        {points.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun point enregistré.</p>
        ) : (
          <div className="space-y-3">
            {points.map((pt, i) => (
              <div key={pt.id} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{pt.libelle}</p>
                  {pt.description && <p className="text-xs text-gray-500 mt-0.5">{pt.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{pt.type_vote}</span>
                    {pt.resultat && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RESULTAT_COLORS[pt.resultat] || 'bg-gray-100 text-gray-600'}`}>
                        {pt.resultat}
                      </span>
                    )}
                  </div>
                  {d.statut === 'Terminée' && pt.resultat && (
                    <div className="mt-1.5 text-xs text-gray-500">
                      Pour : {pt.votes_pour || 0} — Contre : {pt.votes_contre || 0} — Abstention : {pt.votes_abstention || 0}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quorum (only for terminated AG) */}
      {d.statut === 'Terminée' && (totalT > 0 || presences.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Résultat de la séance</h3>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Copropriétaires présents</span>
              <span className="font-medium">{presents.length}</span>
            </div>
            {totalT > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tantiemes représentés</span>
                <span className="font-medium">{tantiemesPresents.toLocaleString('fr-FR')} / {totalT.toLocaleString('fr-FR')} ({quorumPct}%)</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Quorum requis</span>
              <span className="font-medium">{d.quorum_requis || 50}%</span>
            </div>
          </div>
        </div>
      )}

      {/* PV download */}
      {d.pv_genere && (
        <button
          onClick={openPV}
          disabled={pdfLoading}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          {pdfLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          Consulter le Procès-Verbal
        </button>
      )}
    </div>
  );
}

function MesAG() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agApi.getAll();
      setList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return <AGDetailView ag={selected} onBack={() => setSelected(null)} />;
  }

  const upcoming = list.filter((a) => a.statut === 'Planifiée' || a.statut === 'En cours');
  const past = list.filter((a) => a.statut === 'Terminée' || a.statut === 'Annulée');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mes Assemblées Générales</h1>
        <p className="text-sm text-gray-500 mt-0.5">{user?.copropriete_nom || 'Ma résidence'}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 text-sm">Aucune assemblée générale enregistrée</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">À venir</h2>
              <div className="space-y-3">
                {upcoming.map((ag) => <AGCard key={ag.id} ag={ag} onOpen={setSelected} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Passées</h2>
              <div className="space-y-3">
                {past.map((ag) => <AGCard key={ag.id} ag={ag} onOpen={setSelected} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MesAG;
