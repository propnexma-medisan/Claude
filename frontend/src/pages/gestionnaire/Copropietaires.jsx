import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { users, coproprietes as coproApi } from '../../api/client';

const emptyForm = { nom: '', prenom: '', email: '', password: '', telephone: '', lot_id: '' };

const paiementColors = {
  'Payé': 'bg-green-100 text-green-700',
  'Non payé': 'bg-red-100 text-red-700',
  'Partiel': 'bg-yellow-100 text-yellow-700',
};

function Copropietaires() {
  const { user, selectedCoproId } = useAuth();
  const [list, setList] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  const load = () => {
    if (!selectedCoproId) { setLoading(false); return; }
    Promise.all([
      users.byResidence(selectedCoproId),
      coproApi.getLots(selectedCoproId),
    ])
      .then(([u, l]) => { setList(u); setLots(l); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selectedCoproId]);

  // Available lots for a given copropriétaire: unassigned + the one currently assigned to them
  const availableLots = (currentLotId) =>
    lots.filter((l) => !l.copropietaire_id || l.id === currentLotId);

  const openNew = () => { setForm(emptyForm); setEditId(null); setShowForm(true); setError(null); };
  const openEdit = (u) => {
    setForm({ nom: u.nom, prenom: u.prenom, email: u.email, password: '', telephone: u.telephone || '', lot_id: u.lot_id || '' });
    setEditId(u.id);
    setShowForm(true);
    setError(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        role: 'copropietaire',
        copropriete_id: selectedCoproId,
        lot_id: form.lot_id || null,
      };
      if (editId && !payload.password) delete payload.password;

      if (editId) {
        const updated = await users.update(editId, payload);
        setList((l) => l.map((x) => (x.id === editId ? updated : x)));
      } else {
        const created = await users.create(payload);
        setList((l) => [...l, created]);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resendCredentials = async (u) => {
    if (!confirm(`Générer un nouveau mot de passe et renvoyer les identifiants à ${u.prenom} ${u.nom} (${u.email}) ?`)) return;
    setResendingId(u.id);
    try {
      await users.resendCredentials(u.id);
      alert(`Identifiants renvoyés à ${u.email}`);
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setResendingId(null);
    }
  };

  const del = async (id) => {
    if (!confirm('Supprimer ce copropriétaire ?')) return;
    try {
      await users.delete(id);
      setList((l) => l.filter((x) => x.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const [sortConfig, setSortConfig] = useState({ key: 'nom', dir: 'asc' });

  const toggleSort = (key) => {
    setSortConfig((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const sorted = [...list].sort((a, b) => {
    const dir = sortConfig.dir === 'asc' ? 1 : -1;
    if (sortConfig.key === 'nom') {
      return dir * `${a.prenom} ${a.nom}`.toLowerCase().localeCompare(`${b.prenom} ${b.nom}`.toLowerCase());
    }
    if (sortConfig.key === 'email') {
      return dir * (a.email || '').toLowerCase().localeCompare((b.email || '').toLowerCase());
    }
    if (sortConfig.key === 'lot') {
      return dir * (a.lot_numero || '').localeCompare(b.lot_numero || '', undefined, { numeric: true });
    }
    if (sortConfig.key === 'statut') {
      return dir * ((a.is_active ? 1 : 0) - (b.is_active ? 1 : 0));
    }
    return 0;
  });

  const getLotLabel = (lotId) => {
    const lot = lots.find((l) => l.id === lotId);
    return lot ? `${lot.numero} (${lot.type})` : '—';
  };

  if (!selectedCoproId) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">Aucune résidence assignée.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Copropriétaires</h1>
          <p className="text-sm text-gray-500 mt-1">{list.length} copropriétaire{list.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nouveau copropriétaire
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
                  { label: 'Copropriétaire', key: 'nom' },
                  { label: 'Email', key: 'email' },
                  { label: 'Téléphone', key: null },
                  { label: 'Lot', key: 'lot' },
                  { label: 'Statut', key: 'statut' },
                  { label: '', key: null },
                ].map(({ label, key }) => (
                  <th key={label}
                    className={`px-4 py-3 text-left text-xs font-medium uppercase select-none ${key ? 'cursor-pointer text-blue-600 hover:text-blue-800' : 'text-gray-500'}`}
                    onClick={() => key && toggleSort(key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {key && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {sortConfig.key === key && sortConfig.dir === 'asc'
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                            : sortConfig.key === key && sortConfig.dir === 'desc'
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4M8 15l4 4 4-4" />}
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucun copropriétaire</td></tr>
              )}
              {sorted.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">
                        {u.prenom?.[0]}{u.nom?.[0]}
                      </div>
                      <p className="font-medium text-gray-800">{u.prenom} {u.nom}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.telephone || '—'}</td>
                  <td className="px-4 py-3">
                    {u.lot_id ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {getLotLabel(u.lot_id)}
                      </span>
                    ) : <span className="text-gray-400 text-xs">Non assigné</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => openEdit(u)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">Modifier</button>
                      <button
                        onClick={() => resendCredentials(u)}
                        disabled={resendingId === u.id}
                        title="Renvoyer les identifiants de connexion par email"
                        className="text-amber-500 hover:text-amber-700 text-xs font-medium disabled:opacity-50"
                      >
                        {resendingId === u.id ? 'Envoi...' : 'Renvoyer identifiants'}
                      </button>
                      <button onClick={() => del(u.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editId ? 'Modifier le copropriétaire' : 'Nouveau copropriétaire'}>
        <form onSubmit={save} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
              <input required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Marie" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Dupont" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="marie@email.fr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{editId ? 'Nouveau mot de passe (laisser vide)' : 'Mot de passe *'}</label>
            <input type="password" required={!editId} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="06 00 00 00 00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lot <span className="text-gray-400 font-normal">(optionnel — peut être assigné plus tard)</span>
            </label>
            <select value={form.lot_id} onChange={(e) => setForm({ ...form, lot_id: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Non assigné —</option>
              {availableLots(editId ? (list.find((u) => u.id === editId)?.lot_id) : null).map((l) => (
                <option key={l.id} value={l.id}>{l.numero} — {l.type}{l.surface ? ` (${l.surface} m²)` : ''}</option>
              ))}
            </select>
            {availableLots(null).length === 0 && lots.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Aucun lot créé — créez d'abord des lots dans la section Lots</p>
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

export default Copropietaires;
