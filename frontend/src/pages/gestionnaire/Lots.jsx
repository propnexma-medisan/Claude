import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/Modal';
import { coproprietes as coproApi, lots as lotsApi } from '../../api/client';

const TYPE_OPTIONS = ['Appartement', 'Studio', 'Commerce', 'Bureau', 'Parking', 'Cave'];

const typeColors = {
  Appartement: 'bg-blue-100 text-blue-700',
  Studio: 'bg-indigo-100 text-indigo-700',
  Commerce: 'bg-purple-100 text-purple-700',
  Bureau: 'bg-cyan-100 text-cyan-700',
  Parking: 'bg-gray-100 text-gray-600',
  Cave: 'bg-amber-100 text-amber-700',
};

const emptyForm = { numero: '', type: 'Appartement', surface: '', tantiemes: '', proprietaire_nom: '', proprietaire_email: '', proprietaire_tel: '' };

function Lots() {
  const { selectedCoproId } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    if (!selectedCoproId) { setLoading(false); return; }
    coproApi.getLots(selectedCoproId).then(setList).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); load(); }, [selectedCoproId]);

  const openNew = () => { setForm(emptyForm); setEditId(null); setShowForm(true); setError(null); };
  const openEdit = (lot) => {
    setForm({
      numero: lot.numero, type: lot.type, surface: lot.surface || '',
      tantiemes: lot.tantiemes || '', proprietaire_nom: lot.proprietaire_nom || '',
      proprietaire_email: lot.proprietaire_email || '', proprietaire_tel: lot.proprietaire_tel || '',
    });
    setEditId(lot.id);
    setShowForm(true);
    setError(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        const updated = await lotsApi.update(editId, form);
        setList((l) => l.map((x) => (x.id === editId ? updated : x)));
      } else {
        const created = await coproApi.createLot(selectedCoproId, form);
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
    if (!confirm('Supprimer ce lot ?')) return;
    try {
      await lotsApi.delete(id);
      setList((l) => l.filter((x) => x.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  if (!selectedCoproId) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">Aucune résidence assignée.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Lots</h1>
          <p className="text-sm text-gray-500 mt-1">{list.length} lot{list.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nouveau lot
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50">
              <tr>
                {['N°', 'Type', 'Surface', 'Tantièmes', 'Propriétaire', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucun lot enregistré</td></tr>
              )}
              {list.map((lot) => (
                <tr key={lot.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{lot.numero}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[lot.type] || 'bg-gray-100 text-gray-600'}`}>{lot.type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lot.surface ? `${lot.surface} m²` : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{lot.tantiemes || '—'}</td>
                  <td className="px-4 py-3">
                    {lot.proprietaire_nom ? (
                      <div>
                        <p className="text-gray-700">{lot.proprietaire_nom}</p>
                        {lot.proprietaire_email && <p className="text-xs text-gray-400">{lot.proprietaire_email}</p>}
                        {lot.proprietaire_tel && <p className="text-xs text-gray-400">{lot.proprietaire_tel}</p>}
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(lot)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">Modifier</button>
                      <button onClick={() => del(lot.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editId ? 'Modifier le lot' : 'Nouveau lot'}>
        <form onSubmit={save} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro *</label>
              <input required value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="A101" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Surface (m²)</label>
              <input type="number" step="0.1" value={form.surface} onChange={(e) => setForm({ ...form, surface: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="65.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tantièmes</label>
              <input type="number" value={form.tantiemes} onChange={(e) => setForm({ ...form, tantiemes: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="850" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du propriétaire</label>
              <input value={form.proprietaire_nom} onChange={(e) => setForm({ ...form, proprietaire_nom: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Marie Dupont" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email propriétaire</label>
              <input type="email" value={form.proprietaire_email} onChange={(e) => setForm({ ...form, proprietaire_email: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="marie@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone propriétaire</label>
              <input value={form.proprietaire_tel} onChange={(e) => setForm({ ...form, proprietaire_tel: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="06 12 34 56 78" />
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
    </div>
  );
}

export default Lots;
