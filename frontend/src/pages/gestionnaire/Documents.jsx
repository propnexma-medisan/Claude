import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { coproprietes as coproApi } from '../../api/client';

const DOC_TYPES = [
  { value: 'reglement', label: 'Règlement de copropriété', color: 'bg-blue-100 text-blue-700' },
  { value: 'contrat_syndic', label: 'Contrat de mandat de syndic', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'assurance', label: 'Assurance immeuble', color: 'bg-green-100 text-green-700' },
  { value: 'pv_ag', label: 'Procès-verbal d\'AG', color: 'bg-purple-100 text-purple-700' },
  { value: 'autre', label: 'Autre document', color: 'bg-gray-100 text-gray-600' },
];

function typeLabel(type) {
  return DOC_TYPES.find((t) => t.value === type)?.label || type;
}
function typeColor(type) {
  return DOC_TYPES.find((t) => t.value === type)?.color || 'bg-gray-100 text-gray-600';
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Documents() {
  const { selectedCoproId } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom: '', type: 'reglement' });
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const load = () => {
    if (!selectedCoproId) { setLoading(false); return; }
    coproApi.getDocuments(selectedCoproId)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); setDocs([]); load(); }, [selectedCoproId]);

  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    if (!form.nom) setForm((p) => ({ ...p, nom: f.name.replace(/\.pdf$/i, '').replace(/_/g, ' ') }));
    setShowForm(true);
    setError(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !form.nom) return;
    setUploading(true);
    setError(null);
    try {
      const doc = await coproApi.uploadDocument(selectedCoproId, file, form.nom, form.type);
      setDocs((d) => [doc, ...d]);
      setShowForm(false);
      setForm({ nom: '', type: 'reglement' });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Supprimer ce document ?')) return;
    try {
      await coproApi.deleteDocument(selectedCoproId, docId);
      setDocs((d) => d.filter((x) => x.id !== docId));
    } catch (err) {
      alert(err.message);
    }
  };

  if (!selectedCoproId) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700 text-sm">Aucune résidence assignée.</div>;
  }

  const grouped = DOC_TYPES.map((t) => ({
    ...t,
    items: docs.filter((d) => d.type === t.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">{docs.length} document{docs.length !== 1 ? 's' : ''} enregistré{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un document
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
        </label>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-3">
            Fichier sélectionné : <span className="font-normal">{file?.name}</span>
          </p>
          <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {error && <div className="sm:col-span-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2">{error}</div>}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type de document</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom du document *</label>
              <input
                required
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Règlement de copropriété 2026"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={uploading}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {uploading ? 'Envoi...' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Empty state */}
      {!loading && docs.length === 0 && !showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-14 text-center text-gray-400">
          <svg className="w-14 h-14 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="font-medium text-gray-500">Aucun document enregistré</p>
          <p className="text-sm mt-1">Ajoutez le règlement de copropriété, le contrat de syndic, l'assurance…</p>
        </div>
      )}

      {/* Documents groupés par type */}
      {!loading && grouped.length > 0 && (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.value} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${g.color}`}>{g.label}</span>
                <span className="text-xs text-gray-400">{g.items.length} fichier{g.items.length > 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {g.items.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                    {/* PDF icon */}
                    <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.nom}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Ajouté le {formatDate(doc.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Ouvrir
                      </a>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
