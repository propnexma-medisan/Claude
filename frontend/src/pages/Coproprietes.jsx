import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { coproprietes as api, lots as lotsApi } from '../api/client';

const TYPE_OPTIONS = ['Appartement', 'Studio', 'Commerce', 'Bureau', 'Parking', 'Cave'];

const typeColors = {
  Appartement: 'bg-blue-100 text-blue-700',
  Commerce: 'bg-purple-100 text-purple-700',
  Parking: 'bg-gray-100 text-gray-600',
  Cave: 'bg-amber-100 text-amber-700',
};

const emptyForm = { nom: '', adresse: '', syndic_nom: '', date_creation: '', notes: '' };
const emptyLotForm = { numero: '', type: 'Appartement', surface: '', tantiemes: '', proprietaire_nom: '', proprietaire_email: '', proprietaire_tel: '' };

function Coproprietes() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [lots, setLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showLotForm, setShowLotForm] = useState(false);
  const [lotForm, setLotForm] = useState(emptyLotForm);
  const [editLotId, setEditLotId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = () => api.getAll().then(setList).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const selectCopro = (c) => {
    setSelected(c);
    setLotsLoading(true);
    api.getLots(c.id).then(setLots).catch(() => setLots([])).finally(() => setLotsLoading(false));
  };

  const openNew = () => { setForm(emptyForm); setEditId(null); setShowForm(true); setError(null); };
  const openEdit = (c) => {
    setForm({ nom: c.nom, adresse: c.adresse, syndic_nom: c.syndic_nom || '', date_creation: c.date_creation, notes: c.notes || '' });
    setEditId(c.id);
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
        if (selected?.id === editId) setSelected((s) => ({ ...s, ...updated }));
      } else {
        const created = await api.create(form);
        setList((l) => [...l, created]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!confirm('Supprimer cette copropriété et tous ses lots ?')) return;
    await api.delete(id);
    setList((l) => l.filter((x) => x.id !== id));
    if (selected?.id === id) { setSelected(null); setLots([]); }
  };

  const openNewLot = () => { setLotForm(emptyLotForm); setEditLotId(null); setShowLotForm(true); setError(null); };
  const openEditLot = (lot) => {
    setLotForm({
      numero: lot.numero, type: lot.type, surface: lot.surface || '', tantiemes: lot.tantiemes || '',
      proprietaire_nom: lot.proprietaire_nom || '', proprietaire_email: lot.proprietaire_email || '', proprietaire_tel: lot.proprietaire_tel || '',
    });
    setEditLotId(lot.id);
    setShowLotForm(true);
    setError(null);
  };

  const saveLot = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editLotId) {
        const updated = await lotsApi.update(editLotId, lotForm);
        setLots((l) => l.map((x) => (x.id === editLotId ? updated : x)));
      } else {
        const created = await api.createLot(selected.id, lotForm);
        setLots((l) => [...l, created]);
        setSelected((s) => ({ ...s, nb_lots_reel: (s.nb_lots_reel || 0) + 1 }));
      }
      setShowLotForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const delLot = async (id) => {
    if (!confirm('Supprimer ce lot ?')) return;
    await lotsApi.delete(id);
    setLots((l) => l.filter((x) => x.id !== id));
    setSelected((s) => ({ ...s, nb_lots_reel: Math.max(0, (s.nb_lots_reel || 1) - 1) }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Copropriétés</h1>
          <p className="text-sm text-gray-500 mt-1">{list.length} copropriété{list.length > 1 ? 's' : ''} enregistrée{list.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nouvelle copropriété
        </button>
      </div>

      <div className="flex gap-6">
        <div className="w-80 flex-shrink-0 space-y-3">
          {loading && <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}
          {!loading && list.length === 0 && <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm border border-dashed border-gray-200">Aucune copropriété</div>}
          {list.map((c) => (
            <button key={c.id} onClick={() => selectCopro(c)}
              className={`w-full text-left bg-white rounded-xl p-4 shadow-sm border transition-all ${selected?.id === c.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100 hover:border-blue-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{c.nom}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{c.adresse}</p>
                  {c.syndic_nom && <p className="text-xs text-blue-500 mt-1">{c.syndic_nom}</p>}
                </div>
                <span className="flex-shrink-0 bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">{c.nb_lots_reel} lots</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1">
          {!selected ? (
            <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              <p className="text-gray-400">Sélectionnez une copropriété pour voir ses détails</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{selected.nom}</h2>
                    <p className="text-sm text-gray-500 mt-1">{selected.adresse}</p>
                    {selected.syndic_nom && <p className="text-sm text-blue-600 mt-1">Syndic : {selected.syndic_nom}</p>}
                    {selected.notes && <p className="text-sm text-gray-400 mt-2 italic">{selected.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(selected)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">Modifier</button>
                    <button onClick={() => del(selected.id)} className="px-3 py-1.5 text-sm border border-red-200 rounded-lg hover:bg-red-50 text-red-600 transition-colors">Supprimer</button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">Lots ({selected.nb_lots_reel})</h3>
                  <button onClick={openNewLot} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Ajouter un lot
                  </button>
                </div>
                {lotsLoading ? (
                  <div className="flex justify-center py-6"><div className="animate-spin w-5 h-5 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['N°', 'Type', 'Surface', 'Tantièmes', 'Propriétaire', ''].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lots.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Aucun lot</td></tr>
                      )}
                      {lots.map((lot) => (
                        <tr key={lot.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{lot.numero}</td>
                          <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[lot.type] || 'bg-gray-100 text-gray-600'}`}>{lot.type}</span></td>
                          <td className="px-4 py-3 text-gray-600">{lot.surface ? `${lot.surface} m²` : '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{lot.tantiemes || '—'}</td>
                          <td className="px-4 py-3">
                            {lot.proprietaire_nom ? (
                              <div>
                                <p className="text-gray-700">{lot.proprietaire_nom}</p>
                                {lot.proprietaire_email && <p className="text-xs text-gray-400">{lot.proprietaire_email}</p>}
                              </div>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openEditLot(lot)} className="text-blue-500 hover:text-blue-700 text-xs">Modifier</button>
                              <button onClick={() => delLot(lot.id)} className="text-red-400 hover:text-red-600 text-xs">Suppr.</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editId ? 'Modifier la copropriété' : 'Nouvelle copropriété'}>
        <form onSubmit={save} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Résidence Les Oliviers" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse *</label>
              <input required value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="12 Rue de la Paix, 75001 Paris" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Syndic</label>
                <input value={form.syndic_nom} onChange={(e) => setForm({ ...form, syndic_nom: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Cabinet Martin" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de création *</label>
                <input required type="date" value={form.date_creation} onChange={(e) => setForm({ ...form, date_creation: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showLotForm} onClose={() => setShowLotForm(false)} title={editLotId ? 'Modifier le lot' : 'Nouveau lot'}>
        <form onSubmit={saveLot} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro *</label>
              <input required value={lotForm.numero} onChange={(e) => setLotForm({ ...lotForm, numero: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="A101" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select value={lotForm.type} onChange={(e) => setLotForm({ ...lotForm, type: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Surface (m²)</label>
              <input type="number" step="0.1" value={lotForm.surface} onChange={(e) => setLotForm({ ...lotForm, surface: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="65.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tantièmes</label>
              <input type="number" value={lotForm.tantiemes} onChange={(e) => setLotForm({ ...lotForm, tantiemes: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="850" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Propriétaire</label>
              <input value={lotForm.proprietaire_nom} onChange={(e) => setLotForm({ ...lotForm, proprietaire_nom: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Marie Dupont" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={lotForm.proprietaire_email} onChange={(e) => setLotForm({ ...lotForm, proprietaire_email: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="marie@email.fr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input value={lotForm.proprietaire_tel} onChange={(e) => setLotForm({ ...lotForm, proprietaire_tel: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="06 12 34 56 78" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowLotForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Coproprietes;
