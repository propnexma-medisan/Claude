import { formatMAD } from '../../utils/currency';
import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { finances, depenses as depensesApi } from '../../api/client';

function fmt(n) { return formatMAD(n || 0); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('fr-FR');
}

const STATUT_COTISATION = {
  Active: 'bg-green-100 text-green-700',
  Expirée: 'bg-red-100 text-red-700',
  Suspendue: 'bg-yellow-100 text-yellow-700',
  Résiliée: 'bg-gray-100 text-gray-600',
};

const BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

const emptyDepenseForm = {
  categorie: 'Entretien',
  libelle: '',
  montant: '',
  date_depense: '',
  fournisseur: '',
  numero_facture: '',
  notes: '',
  justificatif_url: '',
};

const CATEGORIES = ['Entretien', 'Réparation', 'Nettoyage', 'Sécurité', 'Assurance', 'Honoraires', 'Eau', 'Électricité', 'Ascenseur', 'Espaces verts', 'Autre'];

function Finances() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDepenseForm, setShowDepenseForm] = useState(false);
  const [depenseForm, setDepenseForm] = useState(emptyDepenseForm);
  const [editDepenseId, setEditDepenseId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [activeTab, setActiveTab] = useState('cotisations');

  const load = () => {
    if (!user?.copropriete_id) { setLoading(false); return; }
    finances.getByResidence(user.copropriete_id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [user]);

  const openNewDepense = () => {
    setDepenseForm({ ...emptyDepenseForm, date_depense: new Date().toISOString().slice(0, 10) });
    setEditDepenseId(null);
    setShowDepenseForm(true);
    setFormError(null);
  };

  const uploadJustificatif = async (file) => {
    setUploading(true);
    try {
      const token = localStorage.getItem('syndic_token');
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${BASE_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (data.url) setDepenseForm((f) => ({ ...f, justificatif_url: data.url }));
    } catch { } finally { setUploading(false); }
  };

  const openEditDepense = (d) => {
    setDepenseForm({
      categorie: d.categorie,
      libelle: d.libelle,
      montant: d.montant,
      date_depense: d.date_depense,
      fournisseur: d.fournisseur || '',
      numero_facture: d.numero_facture || '',
      notes: d.notes || '',
      justificatif_url: d.justificatif_url || '',
    });
    setEditDepenseId(d.id);
    setShowDepenseForm(true);
    setFormError(null);
  };

  const saveDepense = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = { ...depenseForm, copropriete_id: user.copropriete_id, montant: parseFloat(depenseForm.montant) };
      if (editDepenseId) {
        await depensesApi.update(editDepenseId, payload);
      } else {
        await depensesApi.create(payload);
      }
      setShowDepenseForm(false);
      setLoading(true);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const delDepense = async (id) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    try {
      await depensesApi.delete(id);
      setLoading(true);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!user?.copropriete_id) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">Aucune résidence assignée.</div>;
  }
  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }
  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">Erreur : {error}</div>;
  }

  const cotisationsList = data?.cotisations_list || [];
  const depensesList = data?.depenses_list || [];
  const tauxCot = data?.total_cot_attendu > 0
    ? Math.round((data.total_cot_paye / data.total_cot_attendu) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Finances</h1>
        <p className="text-sm text-gray-500 mt-1">{data?.copropriete?.nom}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase">Cotisations attendues</p>
          <p className="mt-1 text-xl font-bold text-gray-800">{fmt(data?.total_cot_attendu)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase">Cotisations collectées</p>
          <p className="mt-1 text-xl font-bold text-green-600">{fmt(data?.total_cot_paye)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase">Cotisations impayées</p>
          <p className="mt-1 text-xl font-bold text-red-600">{fmt(data?.total_cot_impaye)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase">Dépenses réalisées</p>
          <p className="mt-1 text-xl font-bold text-orange-600">{fmt(data?.total_depenses_realisees)}</p>
        </div>
      </div>

      {/* Taux de recouvrement */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-700">Taux de recouvrement des cotisations</p>
          <p className="text-lg font-bold text-gray-800">{tauxCot}%</p>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${tauxCot}%`, backgroundColor: tauxCot >= 80 ? '#22c55e' : tauxCot >= 50 ? '#f59e0b' : '#ef4444' }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'cotisations', label: `Cotisations (${cotisationsList.length})` },
          { key: 'depenses', label: `Dépenses réalisées (${depensesList.length})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Cotisations tab */}
      {activeTab === 'cotisations' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Copropriétaire', 'Lot', 'Période', 'Mensuel', 'Collecté', 'Impayé', 'Statut'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cotisationsList.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucune cotisation</td></tr>
                )}
                {cotisationsList.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{c.prenom} {c.nom}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {c.lot_numero ? `${c.lot_numero} (${c.lot_type})` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {fmtDate(c.date_debut)} → {fmtDate(c.date_fin)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{fmt(c.montant_mensuel)}</td>
                    <td className="px-4 py-3 text-green-600 font-medium">{fmt(c.cot_paye)}</td>
                    <td className="px-4 py-3 text-red-500">{fmt(c.cot_impaye)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COTISATION[c.statut] || 'bg-gray-100 text-gray-600'}`}>
                        {c.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dépenses tab */}
      {activeTab === 'depenses' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-sm text-gray-500">Total : <span className="font-semibold text-gray-800">{fmt(data?.total_depenses_realisees)}</span></p>
            <button onClick={openNewDepense} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Ajouter une dépense
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Date', 'Libellé', 'Catégorie', 'Fournisseur', 'Montant', 'Justif.', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {depensesList.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucune dépense enregistrée</td></tr>
                )}
                {depensesList.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(d.date_depense)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{d.libelle}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{d.categorie}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{d.fournisseur || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{fmt(d.montant)}</td>
                    <td className="px-4 py-3">
                      {d.justificatif_url ? (
                        <a href={BASE_URL + d.justificatif_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 text-xs">
                          {d.justificatif_url.endsWith('.pdf') ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          )}
                          Voir
                        </a>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEditDepense(d)} className="text-blue-500 hover:text-blue-700 text-xs">Modifier</button>
                        <button onClick={() => delDepense(d.id)} className="text-red-400 hover:text-red-600 text-xs">Suppr.</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal dépense */}
      <Modal isOpen={showDepenseForm} onClose={() => setShowDepenseForm(false)} title={editDepenseId ? 'Modifier la dépense' : 'Nouvelle dépense'}>
        <form onSubmit={saveDepense} className="space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{formError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
              <select value={depenseForm.categorie} onChange={(e) => setDepenseForm({ ...depenseForm, categorie: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input required type="date" value={depenseForm.date_depense} onChange={(e) => setDepenseForm({ ...depenseForm, date_depense: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
            <input required value={depenseForm.libelle} onChange={(e) => setDepenseForm({ ...depenseForm, libelle: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Entretien ascenseur, nettoyage parties communes..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant (Dhs) *</label>
              <input required type="number" step="0.01" min="0" value={depenseForm.montant}
                onChange={(e) => setDepenseForm({ ...depenseForm, montant: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1500.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
              <input value={depenseForm.fournisseur} onChange={(e) => setDepenseForm({ ...depenseForm, fournisseur: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nom du prestataire" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° facture</label>
            <input value={depenseForm.numero_facture} onChange={(e) => setDepenseForm({ ...depenseForm, numero_facture: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="FAC-2024-001" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={depenseForm.notes} onChange={(e) => setDepenseForm({ ...depenseForm, notes: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pièce justificative <span className="text-gray-400 font-normal">(optionnel — photo ou PDF)</span></label>
            {depenseForm.justificatif_url && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded-lg">
                {depenseForm.justificatif_url.endsWith('.pdf') ? (
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                ) : (
                  <img src={BASE_URL + depenseForm.justificatif_url} alt="Justificatif" className="w-16 h-12 object-cover rounded" />
                )}
                <a href={BASE_URL + depenseForm.justificatif_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex-1 truncate">
                  Voir le fichier
                </a>
                <button type="button" onClick={() => setDepenseForm((f) => ({ ...f, justificatif_url: '' }))}
                  className="text-gray-400 hover:text-red-500 text-xs">Supprimer</button>
              </div>
            )}
            <input type="file" accept="image/*,application/pdf"
              onChange={(e) => e.target.files[0] && uploadJustificatif(e.target.files[0])}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            {uploading && <p className="text-xs text-gray-400 mt-1">Téléchargement en cours...</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowDepenseForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Finances;
