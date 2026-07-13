import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { tickets as ticketsApi } from '../../api/client';

const BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
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

const CATEGORIES = ['Plomberie', 'Electricité', 'Parties communes', 'Sécurité', 'Ascenseur', 'Autre'];
const PRIORITES = ['Basse', 'Normale', 'Haute', 'Urgente'];

const ACCEPT = 'image/*,video/*,application/pdf';

function FileChip({ file, onRemove, dark }) {
  const isVideo = file.type ? file.type.startsWith('video/') : file.mimetype?.startsWith('video/');
  const isPdf = file.type === 'application/pdf' || file.mimetype === 'application/pdf';
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${dark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}>
      {isVideo ? (
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ) : isPdf ? (
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )}
      <span className="truncate max-w-[120px]">{file.name || file.original_name}</span>
      {file.size && <span className={`flex-shrink-0 ${dark ? 'text-white/60' : 'text-gray-400'}`}>({fmtSize(file.size)})</span>}
      {onRemove && (
        <button type="button" onClick={onRemove} className={`ml-0.5 flex-shrink-0 ${dark ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-red-500'}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function AttachmentView({ att }) {
  const url = BASE_URL + att.url;
  const isImage = att.mimetype?.startsWith('image/');
  const isVideo = att.mimetype?.startsWith('video/');
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={att.original_name} className="rounded-lg max-w-[200px] max-h-[160px] object-cover mt-1 border border-white/20" />
      </a>
    );
  }
  if (isVideo) {
    return (
      <video controls className="rounded-lg max-w-[240px] max-h-[180px] mt-1" style={{ background: '#000' }}>
        <source src={url} type={att.mimetype} />
      </video>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 mt-1 underline text-xs opacity-80 hover:opacity-100">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      {att.original_name}
    </a>
  );
}

function MesTickets() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ titre: '', description: '', categorie: 'Autre', priorite: 'Normale' });
  const [createFiles, setCreateFiles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [msgFiles, setMsgFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);

  const createFileRef = useRef(null);
  const msgFileRef = useRef(null);
  const messagesEndRef = useRef(null);

  const load = () => ticketsApi.getAll().then(setList).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const openTicket = (t) => {
    setSelected(t);
    setShowCreate(false);
    setShowDetail(true);
    setMsgLoading(true);
    setMessages([]);
    ticketsApi.getMessages(t.id).then(setMessages).catch(() => setMessages([])).finally(() => setMsgLoading(false));
  };

  const createTicket = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append('titre', form.titre);
      fd.append('description', form.description);
      fd.append('categorie', form.categorie);
      fd.append('priorite', form.priorite);
      createFiles.forEach((f) => fd.append('attachments', f));
      const created = await ticketsApi.create(fd);
      setList((l) => [created, ...l]);
      setForm({ titre: '', description: '', categorie: 'Autre', priorite: 'Normale' });
      setCreateFiles([]);
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
    if (!newMsg.trim() && msgFiles.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('message', newMsg);
      msgFiles.forEach((f) => fd.append('attachments', f));
      const msg = await ticketsApi.addMessage(selected.id, fd);
      setMessages((m) => [...m, msg]);
      setNewMsg('');
      setMsgFiles([]);
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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mes tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Vos demandes et réclamations</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setSelected(null); setShowDetail(true); setFormError(null); setCreateFiles([]); }}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nouveau ticket
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Ticket list */}
        <div className={`w-full lg:w-72 lg:flex-shrink-0 space-y-3 ${showDetail ? 'hidden lg:block' : 'block'}`}>
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
        <div className={`flex-1 min-w-0 ${!showDetail ? 'hidden lg:block' : 'block'}`}>
          {showDetail && (
            <button onClick={() => setShowDetail(false)} className="lg:hidden flex items-center gap-2 mb-4 text-sm text-green-600 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Retour
            </button>
          )}

          {/* Create form */}
          {showCreate ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Nouveau ticket</h2>
              <form onSubmit={createTicket} className="space-y-4">
                {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{formError}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                  <input required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: Fuite d'eau dans la salle de bain" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={4} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Décrivez le problème en détail..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                    <select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                    <select value={form.priorite} onChange={(e) => setForm({ ...form, priorite: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      {PRIORITES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* File attachment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pièces jointes <span className="text-gray-400 font-normal">(photos, vidéos, PDF — max 100 Mo)</span>
                  </label>
                  {createFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {createFiles.map((f, i) => (
                        <FileChip key={i} file={f} onRemove={() => setCreateFiles((fs) => fs.filter((_, j) => j !== i))} />
                      ))}
                    </div>
                  )}
                  <input
                    type="file"
                    ref={createFileRef}
                    multiple
                    accept={ACCEPT}
                    onChange={(e) => {
                      const picked = Array.from(e.target.files || []);
                      setCreateFiles((fs) => [...fs, ...picked].slice(0, 5));
                      e.target.value = '';
                    }}
                    className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  />
                  <p className="text-xs text-gray-400 mt-1">Maximum 5 fichiers</p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                    Annuler
                  </button>
                  <button type="submit" disabled={creating}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                {messages.map((m) => {
                  const isMine = m.user_role === 'copropietaire';
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md rounded-xl px-4 py-3 ${isMine ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        <p className={`text-xs font-medium mb-1 ${isMine ? 'text-green-200' : 'text-gray-500'}`}>
                          {m.prenom} {m.nom}{!isMine && ' (Gestionnaire)'}
                        </p>
                        {m.message && <p className="text-sm">{m.message}</p>}
                        {(m.attachments || []).map((att, i) => (
                          <AttachmentView key={i} att={att} />
                        ))}
                        <p className={`text-xs mt-1.5 ${isMine ? 'text-green-200' : 'text-gray-400'}`}>
                          {fmtDate(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && !msgLoading && (
                  <p className="text-center text-sm text-gray-400 py-4">Aucun message dans ce ticket</p>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              {selected.statut !== 'Fermé' && selected.statut !== 'Résolu' ? (
                <form onSubmit={sendMsg} className="p-3 border-t border-gray-100 space-y-2">
                  {error && <p className="text-xs text-red-600 px-1">{error}</p>}
                  {msgFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {msgFiles.map((f, i) => (
                        <FileChip key={i} file={f} onRemove={() => setMsgFiles((fs) => fs.filter((_, j) => j !== i))} />
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={msgFileRef}
                      multiple
                      accept={ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files || []);
                        setMsgFiles((fs) => [...fs, ...picked].slice(0, 5));
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => msgFileRef.current?.click()}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex-shrink-0"
                      title="Joindre un fichier (photo, vidéo, PDF)"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>
                    <input
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      placeholder="Votre message..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="submit"
                      disabled={sending || (!newMsg.trim() && msgFiles.length === 0)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex-shrink-0"
                    >
                      {sending ? '...' : 'Envoyer'}
                    </button>
                  </div>
                </form>
              ) : (
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
