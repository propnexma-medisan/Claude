import { formatMAD } from '../../utils/currency';
import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { finances, charges as chargesApi } from '../../api/client';

function fmt(n) {
  return formatMAD(n || 0);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

const paiementColors = {
  'Payé': 'bg-green-100 text-green-700',
  'Non payé': 'bg-red-100 text-red-700',
  'Partiel': 'bg-yellow-100 text-yellow-700',
};

const emptyDepenseForm = { libelle: '', montant_total: '', date_echeance: '', statut: 'En cours', budget_annuel: '', exercice: new Date().getFullYear() };

function Finances() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDepenseForm, setShowDepenseForm] = useState(false);
  const [depenseForm, setDepenseForm] = useState(emptyDepenseForm);
  const [editDepenseId, setEditDepenseId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = () => {
    if (!user?.copropriete_id) { setLoading(false); return; }
    finances.getByResidence(user.copropriete_id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [user]);

  const openNewDepense = () => { setDepenseForm(emptyDepenseForm); setEditDepenseId(null); setShowDepenseForm(true); setFormError(null); };
  const openEditDepense = (d) => {
    setDepenseForm({ libelle: d.libelle, montant_total: d.montant_total, date_echeance: d.date_echeance, statut: d.statut, budget_annuel: d.budget_annuel || '', exercice: d.exercice || new Date().getFullYear() });
    setEditDepenseId(d.id);
    setShowDepenseForm(true);
    setFormError(null);
  };

  const saveDepense = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = { ...depenseForm, copropriete_id: user.copropriete_id };
      if (editDepenseId) {
        await chargesApi.update(editDepenseId, payload);
      } else {
        await chargesApi.create(payload);
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
      await chargesApi.delete(id);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Finances</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.copropriete?.nom}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Budget annuel</p>
          <p className="mt-1 text-xl font-bold text-gray-800">{fmt(data?.budget_annuel)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Total charges</p>
          <p className="mt-1 text-xl font-bold text-gray-800">{fmt(data?.total_charges)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Total collecté</p>
          <p className="mt-1 text-xl font-bold text-green-600">{fmt(data?.total_paye)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Total impayé</p>
          <p className="mt-1 text-xl font-bold text-red-600">{fmt(data?.total_impaye)}</p>
        </div>
      </div>

      {/* Taux de recouvrement */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-700">Taux de recouvrement</p>
          <p className="text-lg font-bold text-gray-800">{data?.taux_recouvrement}%</p>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${data?.taux_recouvrement}%`,
              backgroundColor: data?.taux_recouvrement >= 80 ? '#22c55e' : data?.taux_recouvrement >= 50 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
      </div>

      {/* Dépenses */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Dépenses</h2>
          <button onClick={openNewDepense} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Ajouter
          </button>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[550px]">
          <thead className="bg-gray-50">
            <tr>
              {['Libellé', 'Montant', 'Échéance', 'Exercice', 'Statut', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(!data?.depenses || data.depenses.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Aucune dépense</td></tr>
            )}
            {data?.depenses?.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{d.libelle}</td>
                <td className="px-4 py-3 text-gray-700">{fmt(d.montant_total)}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(d.date_echeance)}</td>
                <td className="px-4 py-3 text-gray-600">{d.exercice}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    d.statut === 'Soldé' ? 'bg-green-100 text-green-700' :
                    d.statut === 'En retard' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{d.statut}</span>
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

      {/* Cotisations par lot */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Cotisations par copropriétaire</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[550px]">
          <thead className="bg-gray-50">
            <tr>
              {['Lot', 'Copropriétaire', 'Total dû', 'Payé', 'Impayé', 'Statut'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(!data?.cotisations_par_lot || data.cotisations_par_lot.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Aucune donnée</td></tr>
            )}
            {data?.cotisations_par_lot?.map((c) => {
              let statutLabel = 'Payé';
              let statutClass = 'bg-green-100 text-green-700';
              if (c.montant_impaye > 0 && c.montant_paye === 0 && c.montant_partiel === 0) { statutLabel = 'Impayé'; statutClass = 'bg-red-100 text-red-700'; }
              else if (c.montant_impaye > 0 || c.montant_partiel > 0) { statutLabel = 'Partiel'; statutClass = 'bg-yellow-100 text-yellow-700'; }
              else if (c.montant_total === 0) { statutLabel = '—'; statutClass = 'bg-gray-100 text-gray-500'; }

              return (
                <tr key={c.lot_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{c.lot_numero}</p>
                    <p className="text-xs text-gray-400">{c.lot_type}</p>
                  </td>
                  <td className="px-4 py-3">
                    {c.user_nom ? (
                      <div>
                        <p className="text-gray-700">{c.user_prenom} {c.user_nom}</p>
                        <p className="text-xs text-gray-400">{c.user_email}</p>
                      </div>
                    ) : <span className="text-gray-400 text-xs">{c.proprietaire_nom || '—'}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{fmt(c.montant_total)}</td>
                  <td className="px-4 py-3 text-green-600 font-medium">{fmt(c.montant_paye)}</td>
                  <td className="px-4 py-3 text-red-600">{fmt(c.montant_impaye + c.montant_partiel)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutClass}`}>{statutLabel}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Depense form modal */}
      <Modal isOpen={showDepenseForm} onClose={() => setShowDepenseForm(false)} title={editDepenseId ? 'Modifier la dépense' : 'Nouvelle dépense'}>
        <form onSubmit={saveDepense} className="space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{formError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
            <input required value={depenseForm.libelle} onChange={(e) => setDepenseForm({ ...depenseForm, libelle: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Entretien ascenseur" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant *</label>
              <input required type="number" step="0.01" value={depenseForm.montant_total} onChange={(e) => setDepenseForm({ ...depenseForm, montant_total: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="1500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget annuel</label>
              <input type="number" step="0.01" value={depenseForm.budget_annuel} onChange={(e) => setDepenseForm({ ...depenseForm, budget_annuel: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="20000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Échéance *</label>
              <input required type="date" value={depenseForm.date_echeance} onChange={(e) => setDepenseForm({ ...depenseForm, date_echeance: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exercice</label>
              <input type="number" value={depenseForm.exercice} onChange={(e) => setDepenseForm({ ...depenseForm, exercice: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select value={depenseForm.statut} onChange={(e) => setDepenseForm({ ...depenseForm, statut: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>En cours</option>
              <option>Soldé</option>
              <option>En retard</option>
            </select>
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
