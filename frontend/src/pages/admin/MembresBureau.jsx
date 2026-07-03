import React, { useEffect, useState } from 'react';
import { users, coproprietes as coproApi } from '../../api/client';

const emptyForm = { prenom: '', nom: '', email: '', password: '', telephone: '', copropriete_id: '' };

function MembresBureau() {
  const [list, setList] = useState([]);
  const [copros, setCopros] = useState([]);
  const [allCopros, setAllCopros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPromotModal, setShowPromotModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [promotSearch, setPromotSearch] = useState('');
  const [selectedCopro, setSelectedCopro] = useState(null);
  const [promoting, setPromoting] = useState(false);
  const [promotError, setPromotError] = useState(null);

  const load = () => {
    Promise.all([users.getAll(), coproApi.getAll()])
      .then(([all, allC]) => {
        setList(all.filter((u) => u.role === 'membre_bureau'));
        setAllCopros(all.filter((u) => u.role === 'copropietaire'));
        setCopros(allC);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ prenom: u.prenom, nom: u.nom, email: u.email, password: '', telephone: u.telephone || '', copropriete_id: u.copropriete_id || '' });
    setError(null);
    setShowModal(true);
  };

  const openPromot = () => {
    setPromotSearch('');
    setSelectedCopro(null);
    setPromotError(null);
    setShowPromotModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, role: 'membre_bureau', copropriete_id: form.copropriete_id || null };
      if (!payload.password) delete payload.password;
      if (editing) {
        await users.update(editing.id, payload);
      } else {
        await users.create({ ...payload, password: form.password });
      }
      load();
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const promote = async () => {
    if (!selectedCopro) return;
    setPromoting(true);
    setPromotError(null);
    try {
      await users.update(selectedCopro.id, { role: 'membre_bureau', copropriete_id: selectedCopro.copropriete_id });
      load();
      setShowPromotModal(false);
    } catch (err) {
      setPromotError(err.message);
    } finally {
      setPromoting(false);
    }
  };

  const demote = async (u) => {
    if (!confirm(`Rétrograder ${u.prenom} ${u.nom} en copropriétaire ?`)) return;
    try { await users.update(u.id, { role: 'copropietaire' }); load(); } catch (err) { alert(err.message); }
  };

  const del = async (id) => {
    if (!confirm('Supprimer ce membre du bureau ?')) return;
    try { await users.delete(id); load(); } catch (err) { alert(err.message); }
  };

  const toggle = async (u) => {
    try { await users.update(u.id, { is_active: u.is_active ? 0 : 1 }); load(); } catch (err) { alert(err.message); }
  };

  const getCoproNom = (id) => copros.find((c) => c.id === id)?.nom || '—';

  const filteredCopros = allCopros.filter((u) => {
    const q = promotSearch.toLowerCase();
    return !q || `${u.prenom} ${u.nom} ${u.email} ${u.copropriete_nom || ''}`.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Membres du bureau syndical</h1>
          <p className="text-sm text-gray-500 mt-1">Accès lecture seule : finances, budget, cotisations + espace personnel copropriétaire</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openPromot} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
            Promouvoir un copropriétaire
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nouveau membre
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200 text-gray-400">
          Aucun membre du bureau syndical
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Membre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Résidence</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {u.prenom?.[0]}{u.nom?.[0]}
                      </div>
                      <span className="font-medium text-gray-800">{u.prenom} {u.nom}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3 text-gray-500">{u.telephone || '—'}</td>
                  <td className="px-4 py-3">
                    {u.copropriete_nom ? (
                      <span className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{u.copropriete_nom}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => toggle(u)} title={u.is_active ? 'Désactiver' : 'Activer'} className={`text-xs px-2 py-1 rounded border transition-colors ${u.is_active ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                        {u.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button onClick={() => demote(u)} title="Rétrograder en copropriétaire" className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                        Copropriétaire
                      </button>
                      <button onClick={() => openEdit(u)} className="text-gray-400 hover:text-blue-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => del(u.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">{editing ? 'Modifier le membre' : 'Nouveau membre du bureau'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                  <input required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{editing ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe *'}</label>
                <input type="password" required={!editing} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Résidence *</label>
                <select required value={form.copropriete_id} onChange={(e) => setForm({ ...form, copropriete_id: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="">Sélectionner une résidence</option>
                  {copros.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  {saving ? 'Enregistrement...' : editing ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promote copropriétaire modal */}
      {showPromotModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">Promouvoir un copropriétaire</h2>
                <p className="text-xs text-gray-500 mt-0.5">Le copropriétaire conserve son compte et aura aussi accès au bureau syndical</p>
              </div>
              <button onClick={() => setShowPromotModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {promotError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{promotError}</div>}

              <input
                type="text"
                value={promotSearch}
                onChange={(e) => setPromotSearch(e.target.value)}
                placeholder="Rechercher par nom, email ou résidence..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />

              <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                {filteredCopros.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Aucun copropriétaire trouvé</p>
                ) : filteredCopros.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedCopro(u)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left ${selectedCopro?.id === u.id ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {u.prenom?.[0]}{u.nom?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{u.prenom} {u.nom}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                    {u.copropriete_nom && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0">{u.copropriete_nom}</span>
                    )}
                    {selectedCopro?.id === u.id && (
                      <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    )}
                  </button>
                ))}
              </div>

              {selectedCopro && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <strong>{selectedCopro.prenom} {selectedCopro.nom}</strong> aura accès au bureau syndical de <strong>{selectedCopro.copropriete_nom || 'sa résidence'}</strong> en lecture seule, tout en gardant son espace copropriétaire.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowPromotModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
                <button
                  type="button"
                  onClick={promote}
                  disabled={!selectedCopro || promoting}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {promoting ? 'Promotion...' : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
                      Promouvoir
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MembresBureau;
