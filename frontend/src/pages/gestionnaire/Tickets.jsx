import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { tickets as ticketsApi } from '../../api/client';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

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

function Tickets() {
  const { selectedCoproId } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [attachFiles, setAttachFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [filterStatut, setFilterStatut] = useState('');
  const [filterPriorite, setFilterPriorite] = useState('');
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const load = () => {
    if (!selectedCoproId) { setLoading(false); return; }
    ticketsApi.getAll(selectedCoproId).then(setList).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selectedCoproId]);

  const openTicket = (t) => {
    setSelected(t);
    setShowDetail(true);
    setMsgLoading(true);
    ticketsApi.getMessages(t.id).then(setMessages).catch(() => setMessages([])).finally(() => setMsgLoading(false));
  };

  const updateStatut = async (id, statut) => {
    try {
      const updated = await ticketsApi.update(id, { statut, priorite: selected.priorite });
      setList((l) => l.map((x) => (x.id === id ? updated : x)));
      setSelected(updated);
    } catch (err) {
      alert(err.message);
    }
  };

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() && attachFiles.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('message', newMsg);
      attachFiles.forEach((f) => fd.append('attachments', f));
      const msg = await ticketsApi.addMessage(selected.id, fd);
      setMessages((m) => [...m, msg]);
      setNewMsg('');
      setAttachFiles([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const filtered = list.filter((t) => {
    if (filterStatut && t.statut !== filterStatut) return false;
    if (filterPriorite && t.priorite !== filterPriorite) return false;
    return true;
  });

  if (!selectedCoproId) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">Aucune résidence assignée.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tickets</h1>
        <p className="text-sm text-gray-500 mt-1">Support et demandes des copropriétaires</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Ticket list */}
        <div className={`w-full lg:w-96 lg:flex-shrink-0 space-y-3 ${showDetail ? 'hidden lg:block' : 'block'}`}>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tous les statuts</option>
              <option>Ouvert</option>
              <option>En cours</option>
              <option>Résolu</option>
              <option>Fermé</option>
            </select>
            <select value={filterPriorite} onChange={(e) => setFilterPriorite(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Toutes priorités</option>
              <option>Basse</option>
              <option>Normale</option>
              <option>Haute</option>
              <option>Urgente</option>
            </select>
          </div>

          {loading && <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}
          {!loading && filtered.length === 0 && (
            <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm border border-dashed border-gray-200">
              Aucun ticket{filterStatut || filterPriorite ? ' (filtres actifs)' : ''}
            </div>
          )}
          {filtered.map((t) => (
            <button key={t.id} onClick={() => openTicket(t)}
              className={`w-full text-left bg-white rounded-xl p-4 shadow-sm border transition-all ${selected?.id === t.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100 hover:border-blue-200'}`}>
              <div className="flex items-start gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statutColors[t.statut]}`}>{t.statut}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${prioriteColors[t.priorite]}`}>{t.priorite}</span>
              </div>
              <p className="font-medium text-gray-800 text-sm">{t.titre}</p>
              <p className="text-xs text-gray-400 mt-1">{t.createur_prenom} {t.createur_nom} · {t.categorie}</p>
              <p className="text-xs text-gray-400">{fmtDate(t.created_at)}</p>
            </button>
          ))}
        </div>

        {/* Ticket detail */}
        <div className={`flex-1 ${!showDetail ? 'hidden lg:block' : 'block'}`}>
          {/* Back button on mobile */}
          {showDetail && selected && (
            <button
              onClick={() => setShowDetail(false)}
              className="lg:hidden flex items-center gap-2 mb-4 text-sm text-blue-600 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Retour
            </button>
          )}
          {!selected ? (
            <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              <p className="text-gray-400">Sélectionnez un ticket</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColors[selected.statut]}`}>{selected.statut}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prioriteColors[selected.priorite]}`}>{selected.priorite}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{selected.categorie}</span>
                    </div>
                    <h2 className="font-semibold text-gray-800">{selected.titre}</h2>
                    <p className="text-xs text-gray-400 mt-1">Par {selected.createur_prenom} {selected.createur_nom} · {fmtDate(selected.created_at)}</p>
                  </div>
                  {/* Update statut */}
                  <select
                    value={selected.statut}
                    onChange={(e) => updateStatut(selected.id, e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Ouvert</option>
                    <option>En cours</option>
                    <option>Résolu</option>
                    <option>Fermé</option>
                  </select>
                </div>
                <p className="text-sm text-gray-600 mt-3">{selected.description}</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgLoading && <div className="flex justify-center py-4"><div className="animate-spin w-5 h-5 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}
                {messages.map((m) => {
                  const isGest = m.user_role === 'gestionnaire' || m.user_role === 'admin';
                  return (
                    <div key={m.id} className={`flex ${isGest ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md rounded-xl px-4 py-3 ${isGest ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        <p className={`text-xs font-medium mb-1 ${isGest ? 'text-blue-200' : 'text-gray-500'}`}>
                          {m.prenom} {m.nom}
                        </p>
                        {m.message && <p className="text-sm whitespace-pre-wrap">{m.message}</p>}
                        {(m.attachments || []).length > 0 && (
                          <div className={`mt-2 space-y-1 ${m.message ? 'pt-2 border-t border-white/20' : ''}`}>
                            {m.attachments.map((a) => (
                              <a
                                key={a.id || a.filename}
                                href={`${API_BASE}${a.url}`}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 transition-colors ${isGest ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-white hover:bg-gray-50 text-blue-600 border border-gray-200'}`}
                              >
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                <span className="truncate max-w-[180px]">{a.original_name}</span>
                              </a>
                            ))}
                          </div>
                        )}
                        <p className={`text-xs mt-1.5 ${isGest ? 'text-blue-200' : 'text-gray-400'}`}>
                          {fmtDate(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && !msgLoading && (
                  <p className="text-center text-sm text-gray-400 py-4">Aucun message dans ce ticket</p>
                )}
              </div>

              {/* Send message */}
              <form onSubmit={sendMsg} className="p-4 border-t border-gray-100 space-y-2">
                {error && <p className="text-red-600 text-xs">{error}</p>}
                <textarea
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendMsg(e); }}
                  placeholder="Votre réponse… (Ctrl+Entrée pour envoyer)"
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {attachFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {attachFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 text-xs text-blue-700">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="max-w-[140px] truncate">{f.name}</span>
                        <button type="button" onClick={() => setAttachFiles((prev) => prev.filter((_, j) => j !== i))} className="text-blue-400 hover:text-red-500">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    Joindre
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setAttachFiles((prev) => [...prev, ...Array.from(e.target.files)])}
                  />
                  <button
                    type="submit"
                    disabled={sending || (!newMsg.trim() && attachFiles.length === 0)}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sending
                      ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Envoi...</>
                      : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>Envoyer</>
                    }
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Tickets;
