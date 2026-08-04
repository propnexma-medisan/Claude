import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/Modal';
import { coproprietes as coproApi, lots as lotsApi, users as usersApi } from '../../api/client';

const TYPE_OPTIONS = ['Appartement', 'Studio', 'Commerce', 'Bureau', 'Parking', 'Cave'];

const typeColors = {
  Appartement: 'bg-blue-100 text-blue-700',
  Studio: 'bg-indigo-100 text-indigo-700',
  Commerce: 'bg-purple-100 text-purple-700',
  Bureau: 'bg-cyan-100 text-cyan-700',
  Parking: 'bg-gray-100 text-gray-600',
  Cave: 'bg-amber-100 text-amber-700',
};

const emptyForm = { numero: '', type: 'Appartement', surface: '', tantiemes: '', copropietaire_id: '' };

function SortIcon({ active, dir }) {
  return (
    <span className="inline-flex flex-col ml-1 gap-0" style={{ lineHeight: 0 }}>
      <svg className={`w-2.5 h-2.5 ${active && dir === 'asc' ? 'text-blue-600' : 'text-gray-300'}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 0L10 6H0L5 0Z" />
      </svg>
      <svg className={`w-2.5 h-2.5 ${active && dir === 'desc' ? 'text-blue-600' : 'text-gray-300'}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 6L0 0H10L5 6Z" />
      </svg>
    </span>
  );
}

function Lots() {
  const { selectedCoproId } = useAuth();
  const [list, setList] = useState([]);
  const [copropietaires, setCopropietaires] = useState([]);
  const [sortCol, setSortCol] = useState('numero');
  const [sortDir, setSortDir] = useState('asc');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    if (!selectedCoproId) { setLoading(false); return; }
    Promise.all([
      coproApi.getLots(selectedCoproId),
      usersApi.byResidence(selectedCoproId),
    ]).then(([lots, users]) => {
      setList(lots);
      setCopropietaires(users.filter((u) => u.role === 'copropietaire'));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); load(); }, [selectedCoproId]);

  // Copropriétaires available for selection: not linked to any lot, + the one currently linked to this lot
  const availableForForm = (editId) => {
    const currentLot = list.find((l) => l.id === editId);
    return copropietaires.filter(
      (u) => !u.lot_id || u.lot_id === editId || u.id === currentLot?.copropietaire_id
    );
  };

  const openNew = () => { setForm(emptyForm); setEditId(null); setShowForm(true); setError(null); };
  const openEdit = (lot) => {
    setForm({
      numero: lot.numero,
      type: lot.type,
      surface: lot.surface || '',
      tantiemes: lot.tantiemes || '',
      copropietaire_id: lot.copropietaire_id || '',
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
      const payload = {
        numero: form.numero,
        type: form.type,
        surface: form.surface,
        tantiemes: form.tantiemes,
        copropietaire_id: form.copropietaire_id || null,
      };
      if (editId) {
        await lotsApi.update(editId, payload);
      } else {
        await coproApi.createLot(selectedCoproId, payload);
      }
      setShowForm(false);
      setLoading(true);
      load();
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

  const available = availableForForm(editId);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sorted = [...list].sort((a, b) => {
    let va, vb;
    if (sortCol === 'numero') { va = a.numero || ''; vb = b.numero || ''; return sortDir === 'asc' ? va.localeCompare(vb, 'fr', { numeric: true }) : vb.localeCompare(va, 'fr', { numeric: true }); }
    else if (sortCol === 'type') { va = a.type || ''; vb = b.type || ''; }
    else if (sortCol === 'surface') { va = parseFloat(a.surface) || 0; vb = parseFloat(b.surface) || 0; return sortDir === 'asc' ? va - vb : vb - va; }
    else if (sortCol === 'tantiemes') { va = parseFloat(a.tantiemes) || 0; vb = parseFloat(b.tantiemes) || 0; return sortDir === 'asc' ? va - vb : vb - va; }
    else if (sortCol === 'copropietaire') { va = `${a.copropietaire_nom || ''} ${a.copropietaire_prenom || ''}`.trim(); vb = `${b.copropietaire_nom || ''} ${b.copropietaire_prenom || ''}`.trim(); }
    else { va = ''; vb = ''; }
    return sortDir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr');
  });

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
                {[
                  { label: 'N°', col: 'numero' },
                  { label: 'Type', col: 'type' },
                  { label: 'Surface', col: 'surface' },
                  { label: 'Tantièmes', col: 'tantiemes' },
                  { label: 'Copropriétaire', col: 'copropietaire' },
                  { label: '', col: null },
                ].map(({ label, col }) => (
                  <th
                    key={label + (col || '')}
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase ${col ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}
                    onClick={col ? () => toggleSort(col) : undefined}
                  >
                    <span className="inline-flex items-center">
                      {label}
                      {col && <SortIcon active={sortCol === col} dir={sortDir} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucun lot enregistré</td></tr>
              )}
              {sorted.map((lot) => (
                <tr key={lot.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{lot.numero}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[lot.type] || 'bg-gray-100 text-gray-600'}`}>{lot.type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lot.surface ? `${lot.surface} m²` : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{lot.tantiemes || '—'}</td>
                  <td className="px-4 py-3">
                    {lot.copropietaire_id ? (
                      <div>
                        <p className="text-gray-700 font-medium">{lot.copropietaire_prenom} {lot.copropietaire_nom}</p>
                        <p className="text-xs text-gray-400">{lot.copropietaire_email}</p>
                      </div>
                    ) : <span className="text-xs text-gray-400 italic">Non assigné</span>}
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
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Copropriétaire <span className="text-gray-400 font-normal">(optionnel — peut être assigné plus tard)</span>
            </label>
            <select
              value={form.copropietaire_id}
              onChange={(e) => setForm({ ...form, copropietaire_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Non assigné —</option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.email})</option>
              ))}
            </select>
            {copropietaires.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Aucun copropriétaire créé — ajoutez-en dans la section Copropriétaires</p>
            )}
            {copropietaires.length > 0 && copropietaires.filter((u) => u.lot_id && u.lot_id !== editId).length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {copropietaires.filter((u) => u.lot_id && u.lot_id !== editId).length} copropriétaire(s) déjà assigné(s) à d'autres lots
              </p>
            )}
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
