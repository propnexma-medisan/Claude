import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { messages as messagesApi } from '../../api/client';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const emptyForm = { titre: '', contenu: '' };

function Messages() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = () => messagesApi.getAll().then(setList).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await messagesApi.create(form);
      setList((l) => [created, ...l]);
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!confirm('Supprimer ce message ?')) return;
    try {
      await messagesApi.delete(id);
      setList((l) => l.filter((x) => x.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  if (!user?.copropriete_id) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">Aucune résidence assignée.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Messages de diffusion</h1>
          <p className="text-sm text-gray-500 mt-1">Communiquez avec tous les copropriétaires</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError(null); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nouveau message
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Diffuser un message</h2>
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Information importante" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
              <textarea required value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} rows={5} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Chers copropriétaires..." />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Envoi...' : 'Diffuser'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="space-y-4">
          {list.length === 0 && (
            <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200 text-gray-400">
              Aucun message diffusé
            </div>
          )}
          {list.map((m) => (
            <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800">{m.titre}</h3>
                  <p className="text-xs text-gray-400 mt-1">{fmtDate(m.created_at)} · {m.copropriete_nom}</p>
                  <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{m.contenu}</p>
                </div>
                <button onClick={() => del(m.id)} className="ml-4 text-red-400 hover:text-red-600 flex-shrink-0">
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

export default Messages;
