import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { users } from '../../api/client';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

function sigUrlToPreview(signatureUrl) {
  if (!signatureUrl) return null;
  // signatureUrl = 'uploads/signatures/sig-xxx.png'
  // Serve via the /api/uploads path which is always proxied
  return `${API_URL}/${signatureUrl}`;
}

function GestProfil() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    email: user?.email || '',
    telephone: user?.telephone || '',
    password: '',
    password_confirm: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [sigPreview, setSigPreview] = useState(sigUrlToPreview(user?.signature_url));
  const [uploadingSig, setUploadingSig] = useState(false);
  const [sigSuccess, setSigSuccess] = useState(false);
  const [sigError, setSigError] = useState(null);
  const fileRef = useRef(null);

  const save = async (e) => {
    e.preventDefault();
    if (form.password && form.password !== form.password_confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = { nom: form.nom, prenom: form.prenom, email: form.email, telephone: form.telephone };
      if (form.password) payload.password = form.password;
      await users.update(user.id, payload);
      setSuccess(true);
      setForm((f) => ({ ...f, password: '', password_confirm: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSigFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSigError(null);
    setSigSuccess(false);
    setUploadingSig(true);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => setSigPreview(ev.target.result);
      reader.readAsDataURL(file);

      await users.uploadSignature(file);
      setSigSuccess(true);
    } catch (err) {
      setSigError(err.message);
    } finally {
      setUploadingSig(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeSig = async () => {
    setSigError(null);
    setSigSuccess(false);
    setUploadingSig(true);
    try {
      await users.deleteSignature();
      setSigPreview(null);
    } catch (err) {
      setSigError(err.message);
    } finally {
      setUploadingSig(false);
    }
  };

  return (
    <div className="max-w-2xl w-full space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mon profil</h1>
        <p className="text-gray-500 text-sm mt-1">Informations personnelles et signature documentaire</p>
      </div>

      {/* Profile form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-5">Informations personnelles</h2>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">Profil mis à jour avec succès.</div>}
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input
                type="text"
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Changer le mot de passe <span className="font-normal text-gray-400">(laisser vide pour ne pas modifier)</span></p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Confirmer</label>
                <input
                  type="password"
                  value={form.password_confirm}
                  onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {/* Signature & cachet */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-1">Signature & Cachet</h2>
        <p className="text-sm text-gray-500 mb-5">
          Cette image sera automatiquement intégrée dans les documents générés (quitus de cotisation, PV d'AG, feuille d'émargement).
        </p>

        {sigError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{sigError}</div>}
        {sigSuccess && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">Signature mise à jour avec succès.</div>}

        <div className="flex items-start gap-6">
          {/* Preview box */}
          <div className="flex-shrink-0">
            <div className="w-48 h-28 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
              {sigPreview ? (
                <img src={sigPreview} alt="Signature" className="max-h-full max-w-full object-contain p-1" />
              ) : (
                <div className="text-center text-gray-400">
                  <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <p className="text-xs">Aucune signature</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex-1 space-y-3">
            <p className="text-sm text-gray-600">
              Importez une image PNG ou JPG de votre signature manuscrite avec votre cachet.
              Format recommandé : fond transparent (PNG), taille &lt; 5 Mo.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingSig}
                className="px-4 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#16304f] disabled:opacity-50 transition-colors"
              >
                {uploadingSig ? 'Upload…' : sigPreview ? 'Remplacer' : 'Importer une image'}
              </button>
              {sigPreview && (
                <button
                  type="button"
                  onClick={removeSig}
                  disabled={uploadingSig}
                  className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 border border-red-200 disabled:opacity-50 transition-colors"
                >
                  Supprimer
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSigFile}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default GestProfil;
