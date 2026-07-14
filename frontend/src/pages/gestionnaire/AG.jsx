import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { assemblees as agApi, agPoints } from '../../api/client';

const STATUTS = ['Planifiée', 'En cours', 'Terminée', 'Annulée'];
const TYPES = ['Ordinaire', 'Extraordinaire'];
const TYPES_VOTE = ['Simple majorité', 'Double majorité', 'Unanimité'];
const RESULTATS = ['Approuvé', 'Refusé', 'Ajourné'];

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
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function openHtmlWindow(html, title) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.onload = () => {
      URL.revokeObjectURL(url);
      setTimeout(() => w.print(), 300);
    };
  }
}

// ─── Modal helpers ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── Phase 1 : Agenda ─────────────────────────────────────────────────────────

function PhaseAgenda({ ag, onRefresh }) {
  const [points, setPoints] = useState(ag.points || []);
  const [newPoint, setNewPoint] = useState({ libelle: '', description: '', type_vote: 'Simple majorité' });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const addPoint = async () => {
    if (!newPoint.libelle.trim()) return;
    try {
      const pt = await agApi.createPoint(ag.id, newPoint);
      setPoints((p) => [...p, pt]);
      setNewPoint({ libelle: '', description: '', type_vote: 'Simple majorité' });
      setAdding(false);
    } catch (e) {
      alert(e.message);
    }
  };

  const saveEdit = async (id) => {
    try {
      const updated = await agPoints.update(id, editData);
      setPoints((p) => p.map((x) => (x.id === id ? updated : x)));
      setEditingId(null);
    } catch (e) {
      alert(e.message);
    }
  };

  const deletePoint = async (id) => {
    if (!confirm('Supprimer ce point ?')) return;
    try {
      await agPoints.delete(id);
      setPoints((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{points.length} point(s) à l'ordre du jour</p>
        <button
          onClick={() => setAdding(true)}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
        >
          + Ajouter un point
        </button>
      </div>

      {adding && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Libellé du point *"
            value={newPoint.libelle}
            onChange={(e) => setNewPoint((p) => ({ ...p, libelle: e.target.value }))}
          />
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            placeholder="Description (optionnel)"
            value={newPoint.description}
            onChange={(e) => setNewPoint((p) => ({ ...p, description: e.target.value }))}
          />
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={newPoint.type_vote}
            onChange={(e) => setNewPoint((p) => ({ ...p, type_vote: e.target.value }))}
          >
            {TYPES_VOTE.map((t) => <option key={t}>{t}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={addPoint} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700">Ajouter</button>
            <button onClick={() => setAdding(false)} className="text-sm text-gray-500 hover:text-gray-700">Annuler</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {points.map((pt, i) => (
          <div key={pt.id} className="border border-gray-200 rounded-xl p-4 bg-white">
            {editingId === pt.id ? (
              <div className="space-y-2">
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editData.libelle ?? pt.libelle}
                  onChange={(e) => setEditData((d) => ({ ...d, libelle: e.target.value }))}
                />
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={editData.description ?? pt.description ?? ''}
                  onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
                />
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={editData.type_vote ?? pt.type_vote}
                  onChange={(e) => setEditData((d) => ({ ...d, type_vote: e.target.value }))}
                >
                  {TYPES_VOTE.map((t) => <option key={t}>{t}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(pt.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm">Enregistrer</button>
                  <button onClick={() => setEditingId(null)} className="text-sm text-gray-500">Annuler</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    <span className="text-blue-600 font-bold mr-2">{i + 1}.</span>
                    {pt.libelle}
                  </p>
                  {pt.description && <p className="text-xs text-gray-500 mt-0.5">{pt.description}</p>}
                  <span className="inline-block mt-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{pt.type_vote}</span>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => { setEditingId(pt.id); setEditData({}); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deletePoint(pt.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {points.length === 0 && !adding && (
          <div className="text-center py-10 text-gray-400 text-sm">
            Aucun point à l'ordre du jour. Ajoutez-en un ci-dessus.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase 2 : Convocation ────────────────────────────────────────────────────

function PhaseConvocation({ ag, onRefresh }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    if (!ag.points?.length) {
      alert('Ajoutez au moins un point à l\'ordre du jour avant d\'envoyer les convocations.');
      return;
    }
    if (!confirm(`Envoyer les convocations à tous les copropriétaires de ${ag.copropriete_nom} ?`)) return;
    setSending(true);
    try {
      const r = await agApi.convoquer(ag.id);
      setResult(r);
      onRefresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Avant d'envoyer les convocations</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li>Vérifiez la date, l'heure et le lieu de l'AG</li>
          <li>Assurez-vous que l'ordre du jour est complet</li>
          <li>Les convocations doivent être envoyées au moins 15 jours avant la séance (loi 18-00)</li>
        </ul>
      </div>

      <div className="border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Type</span>
          <span className="font-medium">{ag.type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Date</span>
          <span className="font-medium">{fmtDate(ag.date)} à {ag.heure}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Lieu</span>
          <span className="font-medium">{ag.lieu}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Points ODJ</span>
          <span className="font-medium">{ag.points?.length || 0}</span>
        </div>
      </div>

      {ag.convocations_envoyees ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800">Convocations déjà envoyées</p>
            <p className="text-xs text-green-600">Vous pouvez renvoyer si nécessaire</p>
          </div>
        </div>
      ) : null}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
          ✓ {result.sent} convocation(s) envoyée(s) sur {result.total} copropriétaire(s)
        </div>
      )}

      <button
        onClick={send}
        disabled={sending}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {sending ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
        {ag.convocations_envoyees ? 'Renvoyer les convocations' : 'Envoyer les convocations'}
      </button>
    </div>
  );
}

// ─── Phase 3 : Séance ─────────────────────────────────────────────────────────

function PhaseSeance({ ag, onRefresh }) {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingLot, setSavingLot] = useState(null);
  const [activeTab, setActiveTab] = useState('presence');
  const [pointData, setPointData] = useState({});
  const [savingPoint, setSavingPoint] = useState(null);

  const loadPresences = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agApi.getPresences(ag.id);
      setLots(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [ag.id]);

  useEffect(() => { loadPresences(); }, [loadPresences]);

  const setPresence = async (lot, statut) => {
    setSavingLot(lot.lot_id);
    try {
      const r = await agApi.setPresence(ag.id, {
        lot_id: lot.lot_id,
        statut,
        user_id: lot.user_id || null,
      });
      setLots((prev) => prev.map((l) => l.lot_id === lot.lot_id ? { ...l, presence_statut: statut } : l));
      onRefresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingLot(null);
    }
  };

  const savePointVote = async (pt) => {
    const d = pointData[pt.id] || {};
    const payload = {
      votes_pour: parseInt(d.votes_pour ?? pt.votes_pour ?? 0),
      votes_contre: parseInt(d.votes_contre ?? pt.votes_contre ?? 0),
      votes_abstention: parseInt(d.votes_abstention ?? pt.votes_abstention ?? 0),
      resultat: d.resultat ?? pt.resultat ?? null,
      notes: d.notes ?? pt.notes ?? null,
    };
    setSavingPoint(pt.id);
    try {
      await agPoints.update(pt.id, payload);
      onRefresh();
      setPointData((prev) => { const n = { ...prev }; delete n[pt.id]; return n; });
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingPoint(null);
    }
  };

  const presents = lots.filter((l) => l.presence_statut === 'Présent' || l.presence_statut === 'Procuration');
  const tantiemesPresents = presents.reduce((s, l) => s + (l.tantiemes || 0), 0);
  const totalT = lots.reduce((s, l) => s + (l.tantiemes || 0), 0);
  const quorumReq = ag.quorum_requis || 50;
  const quorumPct = totalT > 0 ? Math.round((tantiemesPresents / totalT) * 100) : 0;
  const quorumOk = quorumPct >= quorumReq;

  const points = ag.points || [];

  return (
    <div className="space-y-4">
      {/* Quorum indicator */}
      <div className={`rounded-xl p-4 border ${quorumOk ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`text-sm font-semibold ${quorumOk ? 'text-green-800' : 'text-amber-800'}`}>
            Quorum : {quorumPct}% {quorumOk ? '✓ atteint' : `— requis ${quorumReq}%`}
          </p>
          <p className={`text-xs ${quorumOk ? 'text-green-600' : 'text-amber-600'}`}>
            {tantiemesPresents.toLocaleString('fr-FR')} / {totalT.toLocaleString('fr-FR')} tantiemes
          </p>
        </div>
        <div className="w-full h-2 bg-white/70 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${quorumOk ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min(quorumPct, 100)}%` }}
          />
        </div>
        <p className="text-xs mt-1.5 text-gray-500">
          {presents.length} lot(s) présent(s) ou représenté(s) sur {lots.length}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {[['presence', 'Présences'], ['votes', 'Votes']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'presence' && (
        <div>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {lots.map((lot) => (
                <div key={lot.lot_id} className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      Lot {lot.numero}
                      {lot.tantiemes ? <span className="text-xs text-gray-400 ml-2">({lot.tantiemes} tant.)</span> : null}
                    </p>
                    <p className="text-xs text-gray-500">{lot.proprietaire_nom || (lot.user_prenom ? `${lot.user_prenom} ${lot.user_nom}` : '—')}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {['Présent', 'Absent', 'Procuration'].map((s) => {
                      const active = lot.presence_statut === s;
                      const colors = {
                        Présent: active ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700',
                        Absent: active ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600',
                        Procuration: active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700',
                      };
                      return (
                        <button
                          key={s}
                          disabled={savingLot === lot.lot_id}
                          onClick={() => setPresence(lot, s)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${colors[s]}`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'votes' && (
        <div className="space-y-4">
          {points.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun point à l'ordre du jour.</p>
          ) : points.map((pt) => {
            const d = pointData[pt.id] || {};
            const vPour = d.votes_pour ?? pt.votes_pour ?? 0;
            const vContre = d.votes_contre ?? pt.votes_contre ?? 0;
            const vAbst = d.votes_abstention ?? pt.votes_abstention ?? 0;
            const resultat = d.resultat !== undefined ? d.resultat : (pt.resultat || '');
            const notes = d.notes !== undefined ? d.notes : (pt.notes || '');

            return (
              <div key={pt.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      <span className="text-blue-600 mr-1.5">{pt.numero}.</span>{pt.libelle}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{pt.type_vote}</p>
                  </div>
                  {pt.resultat && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${RESULTAT_COLORS[pt.resultat] || 'bg-gray-100 text-gray-600'}`}>
                      {pt.resultat}
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[['Pour', 'votes_pour', 'text-green-700 bg-green-50 border-green-200'], ['Contre', 'votes_contre', 'text-red-700 bg-red-50 border-red-200'], ['Abstention', 'votes_abstention', 'text-gray-700 bg-gray-50 border-gray-200']].map(([label, key, cls]) => (
                      <div key={key}>
                        <label className={`block text-xs font-semibold mb-1 ${cls.split(' ')[0]}`}>{label}</label>
                        <input
                          type="number"
                          min="0"
                          className={`w-full border rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${cls}`}
                          value={key === 'votes_pour' ? vPour : key === 'votes_contre' ? vContre : vAbst}
                          onChange={(e) => setPointData((prev) => ({ ...prev, [pt.id]: { ...prev[pt.id], [key]: e.target.value } }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <select
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={resultat}
                      onChange={(e) => setPointData((prev) => ({ ...prev, [pt.id]: { ...prev[pt.id], resultat: e.target.value || null } }))}
                    >
                      <option value="">— Résultat —</option>
                      {RESULTATS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <button
                      onClick={() => savePointVote(pt)}
                      disabled={savingPoint === pt.id}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingPoint === pt.id ? '...' : 'Valider'}
                    </button>
                  </div>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Notes / observations (optionnel)"
                    value={notes}
                    onChange={(e) => setPointData((prev) => ({ ...prev, [pt.id]: { ...prev[pt.id], notes: e.target.value } }))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Phase 4 : Documents ─────────────────────────────────────────────────────

function PhaseDocuments({ ag }) {
  const [loading, setLoading] = useState('');

  const openDoc = async (type) => {
    setLoading(type);
    try {
      const html = type === 'pv' ? await agApi.getPV(ag.id) : await agApi.getFeuilleEmargement(ag.id);
      openHtmlWindow(html, type === 'pv' ? 'Procès-Verbal' : 'Feuille d\'émargement');
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        Les documents s'ouvrent dans un nouvel onglet et peuvent être imprimés ou sauvegardés en PDF.
      </div>

      {[
        {
          key: 'emargement',
          title: 'Feuille d\'émargement',
          desc: 'À imprimer avant la séance pour recueillir les signatures des copropriétaires présents.',
          icon: (
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        },
        {
          key: 'pv',
          title: 'Procès-Verbal (PV)',
          desc: 'Document officiel de l\'AG incluant le quorum, les présences et les résultats des votes.',
          icon: (
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ].map((doc) => (
        <div key={doc.key} className="border border-gray-200 rounded-xl p-4 bg-white flex items-start gap-4">
          <div className="flex-shrink-0">{doc.icon}</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">{doc.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{doc.desc}</p>
          </div>
          <button
            onClick={() => openDoc(doc.key)}
            disabled={loading === doc.key}
            className="flex-shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading === doc.key ? (
              <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            )}
            Imprimer
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── AG Detail ────────────────────────────────────────────────────────────────

const PHASES = [
  { key: 'agenda', label: 'Ordre du jour' },
  { key: 'convocation', label: 'Convocation' },
  { key: 'seance', label: 'Séance' },
  { key: 'documents', label: 'Documents' },
];

function AGDetail({ agId, onBack }) {
  const [ag, setAg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('agenda');
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await agApi.getById(agId);
      setAg(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [agId]);

  useEffect(() => { load(); }, [load]);

  const updateStatut = async (statut) => {
    try {
      const updated = await agApi.update(ag.id, { statut });
      setAg((a) => ({ ...a, ...updated }));
    } catch (e) {
      alert(e.message);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const updated = await agApi.update(ag.id, editData);
      setAg((a) => ({ ...a, ...updated }));
      setEditMode(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ag) return <div className="text-red-500 text-sm">Assemblée introuvable.</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-800">AG {ag.type}</h2>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUT_COLORS[ag.statut] || 'bg-gray-100 text-gray-600'}`}>{ag.statut}</span>
            {ag.pv_genere ? <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">PV généré</span> : null}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{ag.copropriete_nom} — {fmtDate(ag.date)} à {ag.heure}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {ag.statut === 'Planifiée' && (
            <button onClick={() => updateStatut('En cours')} className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-200">
              Démarrer
            </button>
          )}
          {ag.statut === 'En cours' && (
            <button onClick={() => updateStatut('Terminée')} className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium hover:bg-green-200">
              Clôturer
            </button>
          )}
          <button onClick={() => { setEditMode(true); setEditData({ date: ag.date, heure: ag.heure, lieu: ag.lieu, type: ag.type, quorum_requis: ag.quorum_requis }); }} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200">
            Modifier
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editMode && (
        <Modal title="Modifier l'assemblée" onClose={() => setEditMode(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editData.type || ag.type} onChange={(e) => setEditData((d) => ({ ...d, type: e.target.value }))}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editData.date || ag.date} onChange={(e) => setEditData((d) => ({ ...d, date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Heure</label>
                <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editData.heure || ag.heure} onChange={(e) => setEditData((d) => ({ ...d, heure: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lieu</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editData.lieu || ag.lieu} onChange={(e) => setEditData((d) => ({ ...d, lieu: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Quorum requis (%)</label>
              <input type="number" min="1" max="100" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editData.quorum_requis ?? ag.quorum_requis ?? 50} onChange={(e) => setEditData((d) => ({ ...d, quorum_requis: parseInt(e.target.value) }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={saveEdit} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setEditMode(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Phase tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {PHASES.map((p) => (
          <button
            key={p.key}
            onClick={() => setPhase(p.key)}
            className={`flex-shrink-0 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${phase === p.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Phase content */}
      {phase === 'agenda' && <PhaseAgenda ag={ag} onRefresh={load} />}
      {phase === 'convocation' && <PhaseConvocation ag={ag} onRefresh={load} />}
      {phase === 'seance' && <PhaseSeance ag={ag} onRefresh={load} />}
      {phase === 'documents' && <PhaseDocuments ag={ag} />}
    </div>
  );
}

// ─── Main AG list ─────────────────────────────────────────────────────────────

function AG() {
  const { selectedCoproId } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newAG, setNewAG] = useState({ date: '', heure: '10:00', lieu: '', type: 'Ordinaire', quorum_requis: 50 });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agApi.getAll(selectedCoproId);
      setList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedCoproId]);

  useEffect(() => { load(); }, [load]);

  const createAG = async () => {
    if (!newAG.date || !newAG.heure || !newAG.lieu) {
      alert('Date, heure et lieu sont requis.');
      return;
    }
    if (!selectedCoproId) {
      alert('Sélectionnez une résidence.');
      return;
    }
    setCreating(true);
    try {
      const ag = await agApi.create({ ...newAG, copropriete_id: selectedCoproId });
      setList((l) => [ag, ...l]);
      setShowCreate(false);
      setNewAG({ date: '', heure: '10:00', lieu: '', type: 'Ordinaire', quorum_requis: 50 });
      setSelectedId(ag.id);
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteAG = async (id) => {
    if (!confirm('Supprimer cette assemblée ?')) return;
    try {
      await agApi.delete(id);
      setList((l) => l.filter((x) => x.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  if (selectedId) {
    return <AGDetail agId={selectedId} onBack={() => { setSelectedId(null); load(); }} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Assemblées Générales</h1>
          <p className="text-sm text-gray-500 mt-0.5">{list.length} assemblée(s)</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle AG
        </button>
      </div>

      {showCreate && (
        <Modal title="Nouvelle Assemblée Générale" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={newAG.type} onChange={(e) => setNewAG((d) => ({ ...d, type: e.target.value }))}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={newAG.date} onChange={(e) => setNewAG((d) => ({ ...d, date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Heure *</label>
                <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={newAG.heure} onChange={(e) => setNewAG((d) => ({ ...d, heure: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lieu *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Salle de réunion, hall d'entrée…" value={newAG.lieu} onChange={(e) => setNewAG((d) => ({ ...d, lieu: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Quorum requis (%)</label>
              <input type="number" min="1" max="100" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={newAG.quorum_requis} onChange={(e) => setNewAG((d) => ({ ...d, quorum_requis: parseInt(e.target.value) }))} />
              <p className="text-xs text-gray-400 mt-1">Par défaut 50% selon la loi 18-00</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={createAG} disabled={creating} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {creating ? 'Création...' : 'Créer l\'assemblée'}
              </button>
              <button onClick={() => setShowCreate(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50">
                Annuler
              </button>
            </div>
          </div>
        </Modal>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 text-sm">Aucune assemblée planifiée</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-blue-600 text-sm hover:underline">Créer la première AG</button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((ag) => (
            <div
              key={ag.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => setSelectedId(ag.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-gray-800">AG {ag.type}</p>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUT_COLORS[ag.statut] || 'bg-gray-100 text-gray-600'}`}>{ag.statut}</span>
                    {ag.pv_genere ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">PV</span> : null}
                    {ag.convocations_envoyees ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Convoqué</span> : null}
                  </div>
                  <p className="text-xs text-gray-500">{ag.copropriete_nom}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>📅 {fmtDate(ag.date)} à {ag.heure}</span>
                    <span>📍 {ag.lieu}</span>
                    <span>📋 {ag.nb_points || 0} point(s)</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteAG(ag.id); }}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AG;
