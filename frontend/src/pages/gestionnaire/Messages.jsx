import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { messages as messagesApi } from '../../api/client';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

function PJIcon({ mimetype }) {
  if (mimetype && mimetype.startsWith('image/')) {
    return (
      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function PJList({ pjs, onDelete }) {
  if (!pjs || pjs.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {pjs.map((pj) => (
        <div key={pj.id} className="group flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-100 transition-colors">
          <PJIcon mimetype={pj.mimetype} />
          <a
            href={`${BASE_URL.replace('/api', '')}${pj.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[140px] truncate hover:text-blue-600"
            title={pj.original_name}
          >
            {pj.original_name}
          </a>
          {onDelete && (
            <button
              onClick={() => onDelete(pj.id)}
              className="ml-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              title="Supprimer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Messages() {
  const { selectedCoproId } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titre: '', contenu: '' });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef();

  const load = () => {
    if (!selectedCoproId) { setLoading(false); return; }
    messagesApi.getAll(selectedCoproId).then(setList).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selectedCoproId]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('titre', form.titre);
      fd.append('contenu', form.contenu);
      fd.append('copropriete_id', selectedCoproId);
      for (const f of files) fd.append('files', f);
      const created = await messagesApi.create(fd);
      setList((l) => [created, ...l]);
      setForm({ titre: '', contenu: '' });
      setFiles([]);
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

  const delPJ = async (msgId, pjId) => {
    try {
      await messagesApi.deletePJ(pjId);
      setList((l) => l.map((m) => m.id === msgId
        ? { ...m, pieces_jointes: (m.pieces_jointes || []).filter((p) => p.id !== pjId) }
        : m
      ));
    } catch (err) {
      alert(err.message);
    }
  };

  const removeSelectedFile = (idx) => setFiles((f) => f.filter((_, i) => i !== idx));

  if (!selectedCoproId) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">Aucune résidence assignée.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Messages de diffusion</h1>
          <p className="text-sm text-gray-500 mt-1">Communiquez avec tous les copropriétaires</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(null); setFiles([]); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
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
              <input
                required
                value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Information importante"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
              <textarea
                required
                value={form.contenu}
                onChange={(e) => setForm({ ...form, contenu: e.target.value })}
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Chers copropriétaires..."
              />
            </div>

            {/* Pièces jointes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pièces jointes (photos, PDF)</label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-6 h-6 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <p className="text-xs text-gray-500">Cliquez pour joindre des fichiers (images ou PDF, max 20 Mo chacun)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files)])}
                />
              </div>
              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs text-blue-700">
                      <span className="max-w-[150px] truncate">{f.name}</span>
                      <button type="button" onClick={() => removeSelectedFile(i)} className="text-blue-400 hover:text-red-500">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setShowForm(false); setFiles([]); }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                Annuler
              </button>
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
                  <PJList pjs={m.pieces_jointes} onDelete={(pjId) => delPJ(m.id, pjId)} />
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
