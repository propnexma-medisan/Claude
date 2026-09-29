import React, { useState } from 'react';
import { agence as agenceApi } from '../../api/client';

const DELAIS = ['Urgent (moins d\'1 mois)', '1 à 3 mois', '3 à 6 mois', 'Pas pressé'];
const CANAUX = ['WhatsApp', 'Téléphone', 'Email'];

export default function ServicesAgence() {
  const [type_demande, setType] = useState('Vendre');
  const [delai, setDelai] = useState(DELAIS[1]);
  const [prix_estime, setPrix] = useState('');
  const [canal_prefere, setCanal] = useState('WhatsApp');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await agenceApi.create({ type_demande, delai, prix_estime: prix_estime || null, canal_prefere, notes });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Merci !</h1>
        <p className="text-sm text-gray-500">Un conseiller Propnex vous recontacte sous 24h pour discuter de votre projet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Vendre ou louer votre bien</h1>
        <p className="text-sm text-gray-500 mt-1">
          Propnex Property Management vous accompagne aussi pour la vente ou la location de votre appartement.
          Laissez-nous vos coordonnées, un conseiller vous recontacte rapidement.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Je souhaite</label>
          <div className="grid grid-cols-2 gap-3">
            {['Vendre', 'Louer'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  type_demande === t ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Délai souhaité</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={delai} onChange={(e) => setDelai(e.target.value)}>
            {DELAIS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prix envisagé (MAD) <span className="text-gray-400 font-normal">— optionnel</span>
          </label>
          <input
            type="number" min="0" step="1000"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={prix_estime} onChange={(e) => setPrix(e.target.value)}
            placeholder="Ex : 850000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Comment préférez-vous être contacté ?</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={canal_prefere} onChange={(e) => setCanal(e.target.value)}>
            {CANAUX.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note <span className="text-gray-400 font-normal">— optionnel</span>
          </label>
          <textarea
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Précisions utiles pour le conseiller..."
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">{error}</div>
        )}

        <button
          type="submit" disabled={saving}
          className="w-full bg-[#1e3a5f] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#163050] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Envoi...' : 'Être recontacté(e)'}
        </button>
      </form>
    </div>
  );
}
