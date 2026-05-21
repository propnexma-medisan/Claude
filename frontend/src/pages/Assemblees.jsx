import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { assemblees as api, coproprietes as coproApi } from '../api/client';

const TYPES = ['Ordinaire', 'Extraordinaire'];
const STATUTS = ['Planifiée', 'En cours', 'Terminée', 'Annulée'];
const TYPES_VOTE = ['Simple majorité', 'Double majorité', 'Unanimité'];
const RESULTATS = ['', 'Approuvé', 'Refusé', 'Ajourné'];

const statutColors = {
  'Planifiée': 'bg-indigo-100 text-indigo-700',
  'En cours': 'bg-yellow-100 text-yellow-700',
  'Terminée': 'bg-green-100 text-green-700',
  'Annulée': 'bg-red-100 text-red-600',
};

const resultatColors = {
  'Approuvé': 'bg-green-100 text-green-700',
  'Refusé': 'bg-red-100 text-red-700',
  'Ajourné': 'bg-yellow-100 text-yellow-700',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const emptyForm = { copropriete_id: '', date: '', heure: '', lieu: '', type: 'Ordinaire', statut: 'Planifiée', convocations_envoyees: false };
const emptyPointForm = { libelle: '', description: '', type_vote: 'Simple majorité', resultat: '', votes_pour: 0, votes_contre: 0, votes_abstention: 0 };

function Assemblees() {
  const [list, setList] = useState([]);
  const [copros, setCopros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showPointForm, setShowPointForm] = useState(false);
  const [pointForm, setPointForm] = useState(emptyPointForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = () => Promise.all([api.getAll(), coproApi.getAll()])
    .then(([ags, c]) => { setList(ags); setCopros(c); })
    .catch(() => {})
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const selectAG = (ag) => {
    setSelected(ag);
    api.getById(ag.id).then(setDetail).catch(() => setDetail(null));
  };

  const openNew = () => {
    setForm({ ...emptyForm, copropriete_id: copros[0]?.id || '' });
    setEditId(null);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (ag) => {
    setForm({ copropriete_id: ag.copropriete_id, date: ag.date, heure: ag.heure, lieu: ag.lieu, type: ag.type, statut: ag.statut, convocations_envoyees: !!ag.convocations_envoyees });
    setEditId(ag.id);
    setShowForm(true);
    setError(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        const updated = await api.update(editId, form);
        setList((l) => l.map((x) => (x.id === editId ? { ...x, ...updated } : x)));
        if (selected?.id === editId) { setSelected((s) => ({ ...s, ...updated })); setDetail((d) => d ? { ...d, ...updated } : d); }
      } else {
        const created = await api.create(form);
        const withName = { ...created, copropriete_nom: copros.find((c) => c.id == created.copropriete_id)?.nom };
        setList((l) => [withName, ...l]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!confirm('Supprimer cette assemblée générale ?')) return;
    await api.delete(id);
    setList((l) => l.filter((x) => x.id !== id));
    if (selected?.id === id) { setSelected(null); setDetail(null); }
  };

  const savePoint = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...pointForm, resultat: pointForm.resultat || null };
      const created = await api.createPoint(selected.id, payload);
      setDetail((d) => d ? { ...d, points: [...(d.points || []), created] } : d);
      setSelected((s) => ({ ...s, nb_points: (s.nb_points || 0) + 1 }));
      setShowPointForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Assemblées Générales</h1>
          <p className="text-sm text-gray-500 mt-1">{list.length} assemblée{list.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nouvelle AG
        </button>
      </div>

      <div className="flex gap-6">
        <div className="w-80 flex-shrink-0 space-y-3">
          {loading && <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}
          {!loading && list.length === 0 && (
            <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm border border-dashed border-gray-200">Aucune assemblée</div>
          )}
          {list.map((ag) => (
            <button key={ag.id} onClick={() => selectAG(ag)}
              className={`w-full text-left bg-white rounded-xl p-4 shadow-sm border transition-all ${selected?.id === ag.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100 hover:border-blue-200'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-gray-800 text-sm truncate">{ag.copropriete_nom}</p>
                <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statutColors[ag.statut] || 'bg-gray-100 text-gray-600'}`}>{ag.statut}</span>
              </div>
              <p className="text-xs text-gray-500">{fmtDate(ag.date)} à {ag.heure}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">{ag.type}</span>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-400">{ag.nb_points || 0} point{(ag.nb_points || 0) > 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1">
          {!selected ? (
            <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="text-gray-400">Sélectionnez une assemblée pour voir ses détails</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-gray-800">AG {selected.type}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColors[selected.statut]}`}>{selected.statut}</span>
                    </div>
                    <p className="text-sm text-blue-600 font-medium">{selected.copropriete_nom}</p>
                    <p className="text-sm text-gray-500 mt-1">{fmtDate(selected.date)} à {selected.heure}</p>
                    <p className="text-sm text-gray-400">{selected.lieu}</p>
                    {selected.convocations_envoyees ? (
                      <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Convocations envoyées
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 mt-2 text-xs text-orange-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Convocations non envoyées
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(selected)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">Modifier</button>
                    <button onClick={() => del(selected.id)} className="px-3 py-1.5 text-sm border border-red-200 rounded-lg hover:bg-red-50 text-red-600 transition-colors">Supprimer</button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">Ordre du jour</h3>
                  <button onClick={() => { setPointForm(emptyPointForm); setShowPointForm(true); setError(null); }}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Ajouter un point
                  </button>
                </div>
                {!detail ? (
                  <div className="flex justify-center py-6"><div className="animate-spin w-5 h-5 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
                ) : detail.points?.length === 0 ? (
                  <div className="px-5 py-6 text-center text-gray-400 text-sm">Aucun point à l'ordre du jour</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {(detail.points || []).map((p) => (
                      <div key={p.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">{p.numero}</span>
                            <div>
                              <p className="font-medium text-gray-800 text-sm">{p.libelle}</p>
                              {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.type_vote}</span>
                                {p.resultat && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${resultatColors[p.resultat] || 'bg-gray-100 text-gray-600'}`}>{p.resultat}</span>
                                )}
                                {(p.votes_pour > 0 || p.votes_contre > 0 || p.votes_abstention > 0) && (
                                  <span className="text-xs text-gray-400">
                                    Pour: {p.votes_pour} · Contre: {p.votes_contre} · Abst.: {p.votes_abstention}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editId ? 'Modifier l\'assemblée' : 'Nouvelle assemblée générale'}>
        <form onSubmit={save} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Copropriété *</label>
            <select required value={form.copropriete_id} onChange={(e) => setForm({ ...form, copropriete_id: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sélectionner...</option>
              {copros.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure *</label>
              <input required type="time" value={form.heure} onChange={(e) => setForm({ ...form, heure: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STATUTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieu *</label>
            <input required value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Salle de réunion - 5 Rue de la Paix" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.convocations_envoyees} onChange={(e) => setForm({ ...form, convocations_envoyees: e.target.checked })} className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm text-gray-700">Convocations envoyées</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showPointForm} onClose={() => setShowPointForm(false)} title="Ajouter un point à l'ordre du jour">
        <form onSubmit={savePoint} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
            <input required value={pointForm.libelle} onChange={(e) => setPointForm({ ...pointForm, libelle: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Approbation des comptes 2025" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={pointForm.description} onChange={(e) => setPointForm({ ...pointForm, description: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Détails du point..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de vote</label>
              <select value={pointForm.type_vote} onChange={(e) => setPointForm({ ...pointForm, type_vote: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TYPES_VOTE.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Résultat</label>
              <select value={pointForm.resultat} onChange={(e) => setPointForm({ ...pointForm, resultat: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {RESULTATS.map((r) => <option key={r} value={r}>{r || '(en attente)'}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['votes_pour', 'Pour'], ['votes_contre', 'Contre'], ['votes_abstention', 'Abstentions']].map(([k, label]) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="number" min="0" value={pointForm[k]} onChange={(e) => setPointForm({ ...pointForm, [k]: parseInt(e.target.value) || 0 })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowPointForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Assemblees;
