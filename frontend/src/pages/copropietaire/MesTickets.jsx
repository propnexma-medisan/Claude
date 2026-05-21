import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { tickets as ticketsApi } from '../../api/client';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const statutColors = {
  'Ouvert': 'bg-blue-100 text-blue-700',
  'En cours': 'bg-yellow-100 text-yellow-700',
  'Résolu': 'bg-green-100 text-green-700',
  'Fermé': 'bg-gray-100 text-gray-600',
};

const prioriteColors = {
  'Basse': 'bg-gray-100 text-gray-600',
  'Normale': 'bg-blue-100 text-blue-600',
  'Haute': 'bg-orange-100 text-orange-700',
  'Urgente': 'bg-red-100 text-red-700',
};

const CATEGORIES = ['Plomberie', 'Electricité', 'Parties communes', 'Sécurité', 'Autre'];
const PRIORITES = ['Basse', 'Normale', 'Haute', 'Urgente'];

const emptyForm = { titre: '', description: '', categorie: 'Autre', priorite: 'Normale' };

function MesTickets() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);

  const load = () => ticketsApi.getAll().then(setList).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const openTicket = (t) => {
    setSelected(t);
    setShowCreate(false);
    setMsgLoading(true);
    ticketsApi.getMessages(t.id).then(setMessages).catch(() => setMessages([])).finally(() => setMsgLoading(false));
  };

  const createTicket = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const created = await ticketsApi.create(form);
      setList((l) => [created, ...l]);
      setForm(emptyForm);
      setShowCreate(false);
      openTicket(created);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setSending(true);
    setError(null);
    try {
      const msg = await ticketsApi.addMessage(selected.id, { message: newMsg });
      setMessages((m) => [...m, msg]);
      setNewMsg('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!user?.copropriete_id) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">Aucune résidence assignée.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mes tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Vos demandes et réclamations</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setSelected(null); setFormError(null); }}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nouveau ticket
        </button>
      </div>

      <div className="flex gap-6">
        {/* Ticket list */}
        <div className="w-72 flex-shrink-0 space-y-3">
          {loading && <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full" /></div>}
          {!loading && list.length === 0 && (
            <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm border border-dashed border-gray-200">
              Aucun ticket
            </div>
          )}
          {list.map((t) => (
            <button key={t.id} onClick={() => openTicket(t)}
              className={`w-full text-left bg-white rounded-xl p-4 shadow-sm border transition-all ${selected?.id === t.id && !showCreate ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-100 hover:border-green-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColors[t.statut]}`}>{t.statut}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prioriteColors[t.priorite]}`}>{t.priorite}</span>
              </div>
              <p className="font-medium text-gray-800 text-sm">{t.titre}</p>
              <p className="text-xs text-gray-400 mt-1">{t.categorie} · {fmtDate(t.created_at)}</p>
            </button>
          ))}
        </div>

        {/* Main panel */}
        <div className="flex-1">
          {showCreate ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Nouveau ticket</h2>
              <form onSubmit={createTicket} className="space-y-4">
                {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{formError}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                  <input required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Ex: Fuite d'eau dans la salle de bain" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Décrivez le problème en détail..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                    <select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                    <select value={form.priorite} onChange={(e) => setForm({ ...form, priorite: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      {PRIORITES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
                  <button type="submit" disabled={creating} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                    {creating ? 'Création...' : 'Créer le ticket'}
                  </button>
                </div>
              </form>
            </div>
          ) : !selected ? (
            <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              <p className="text-gray-400">Sélectionnez un ticket ou créez-en un nouveau</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColors[selected.statut]}`}>{selected.statut}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prioriteColors[selected.priorite]}`}>{selected.priorite}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{selected.categorie}</span>
                </div>
                <h2 className="font-semibold text-gray-800">{selected.titre}</h2>
                <p className="text-xs text-gray-400 mt-1">{fmtDate(selected.created_at)}</p>
                <p className="text-sm text-gray-600 mt-2">{selected.description}</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgLoading && <div className="flex justify-center py-4"><div className="animate-spin w-5 h-5 border-4 border-green-500 border-t-transparent rounded-full" /></div>}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.user_role === 'copropietaire' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md rounded-xl px-4 py-3 ${m.user_role === 'copropietaire' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                      <p className={`text-xs font-medium mb-1 ${m.user_role === 'copropietaire' ? 'text-green-200' : 'text-gray-500'}`}>
                        {m.prenom} {m.nom} {m.user_role !== 'copropietaire' && '(Gestionnaire)'}
                      </p>
                      <p className="text-sm">{m.message}</p>
                      <p className={`text-xs mt-1 ${m.user_role === 'copropietaire' ? 'text-green-200' : 'text-gray-400'}`}>
                        {fmtDate(m.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && !msgLoading && (
                  <p className="text-center text-sm text-gray-400 py-4">Aucun message dans ce ticket</p>
                )}
              </div>

              {/* Send message (only if ticket not closed) */}
              {selected.statut !== 'Fermé' && selected.statut !== 'Résolu' && (
                <form onSubmit={sendMsg} className="p-4 border-t border-gray-100 flex gap-3">
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <input
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder="Votre message..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button type="submit" disabled={sending || !newMsg.trim()} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    Envoyer
                  </button>
                </form>
              )}
              {(selected.statut === 'Fermé' || selected.statut === 'Résolu') && (
                <div className="p-4 border-t border-gray-100 text-center text-sm text-gray-400">
                  Ce ticket est {selected.statut.toLowerCase()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MesTickets;
