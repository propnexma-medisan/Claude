import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { charges as api, coproprietes as coproApi } from '../api/client';

const STATUTS = ['En cours', 'Soldé', 'En retard'];
const STATUTS_PAIEMENT = ['Payé', 'Non payé', 'Partiel'];

const statutColors = {
  'En cours': 'bg-blue-100 text-blue-700',
  'Soldé': 'bg-green-100 text-green-700',
  'En retard': 'bg-red-100 text-red-700',
};

const paiementColors = {
  'Payé': 'bg-green-100 text-green-700',
  'Non payé': 'bg-gray-100 text-gray-500',
  'Partiel': 'bg-yellow-100 text-yellow-700',
};

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const emptyForm = { copropriete_id: '', libelle: '', montant_total: '', date_echeance: '', statut: 'En cours', budget_annuel: '', exercice: new Date().getFullYear() };

function Charges() {
  const [list, setList] = useState([]);
  const [copros, setCopros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filterStatut, setFilterStatut] = useState('');

  const load = () => Promise.all([api.getAll(), coproApi.getAll()])
    .then(([charges, c]) => { setList(charges); setCopros(c); })
    .catch(() => {})
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const selectCharge = (c) => {
    setSelected(c);
    api.getById(c.id).then(setDetail).catch(() => setDetail(null));
  };

  const openNew = () => {
    setForm({ ...emptyForm, copropriete_id: copros[0]?.id || '' });
    setEditId(null);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (c) => {
    setForm({
      copropriete_id: c.copropriete_id,
      libelle: c.libelle,
      montant_total: c.montant_total,
      date_echeance: c.date_echeance,
      statut: c.statut,
      budget_annuel: c.budget_annuel || '',
      exercice: c.exercice || new Date().getFullYear(),
    });
    setEditId(c.id);
    setShowForm(true);
    setError(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, montant_total: parseFloat(form.montant_total), budget_annuel: parseFloat(form.budget_annuel) || 0 };
      if (editId) {
        const updated = await api.update(editId, payload);
        setList((l) => l.map((x) => (x.id === editId ? { ...x, ...updated } : x)));
        if (selected?.id === editId) setSelected((s) => ({ ...s, ...updated }));
      } else {
        const created = await api.create(payload);
        setList((l) => [...l, { ...created, copropriete_nom: copros.find((c) => c.id === created.copropriete_id)?.nom }]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!confirm('Supprimer cette charge ?')) return;
    await api.delete(id);
    setList((l) => l.filter((x) => x.id !== id));
    if (selected?.id === id) { setSelected(null); setDetail(null); }
  };

  const filtered = filterStatut ? list.filter((c) => c.statut === filterStatut) : list;

  const totals = {
    total: list.reduce((s, c) => s + c.montant_total, 0),
    enCours: list.filter((c) => c.statut === 'En cours').reduce((s, c) => s + c.montant_total, 0),
    enRetard: list.filter((c) => c.statut === 'En retard').reduce((s, c) => s + c.montant_total, 0),
    solde: list.filter((c) => c.statut === 'Soldé').reduce((s, c) => s + c.montant_total, 0),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Charges & Comptabilité</h1>
          <p className="text-sm text-gray-500 mt-1">{list.length} appel{list.length > 1 ? 's' : ''} de charges</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nouvelle charge
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total appels', value: fmt(totals.total), color: 'bg-gray-50 border-gray-200', text: 'text-gray-700' },
          { label: 'En cours', value: fmt(totals.enCours), color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
          { label: 'En retard', value: fmt(totals.enRetard), color: 'bg-red-50 border-red-200', text: 'text-red-700' },
          { label: 'Soldés', value: fmt(totals.solde), color: 'bg-green-50 border-green-200', text: 'text-green-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-4 border ${s.color}`}>
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            <p className={`text-lg font-bold mt-1 ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Filtrer :</span>
              {['', ...STATUTS].map((s) => (
                <button key={s} onClick={() => setFilterStatut(s)}
                  className={`text-sm px-3 py-1 rounded-full transition-colors ${filterStatut === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s || 'Tous'}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Libellé', 'Copropriété', 'Montant', 'Échéance', 'Statut', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucune charge</td></tr>}
                  {filtered.map((c) => (
                    <tr key={c.id} onClick={() => selectCharge(c)}
                      className={`cursor-pointer hover:bg-gray-50 ${selected?.id === c.id ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{c.libelle}</p>
                        {c.exercice && <p className="text-xs text-gray-400">Exercice {c.exercice}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{c.copropriete_nom}</td>
                      <td className="px-4 py-3 font-semibold text-gray-700">{fmt(c.montant_total)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtDate(c.date_echeance)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColors[c.statut] || 'bg-gray-100 text-gray-600'}`}>{c.statut}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openEdit(c)} className="text-blue-500 hover:text-blue-700 text-xs">Modifier</button>
                          <button onClick={() => del(c.id)} className="text-red-400 hover:text-red-600 text-xs">Suppr.</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selected && detail && (
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-1">{detail.libelle}</h3>
              <p className="text-sm text-gray-500 mb-4">{detail.copropriete_nom}</p>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Montant total</span><span className="font-semibold">{fmt(detail.montant_total)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Budget annuel</span><span>{fmt(detail.budget_annuel)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Échéance</span><span>{fmtDate(detail.date_echeance)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Statut</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColors[detail.statut]}`}>{detail.statut}</span></div>
              </div>
              {detail.repartitions && detail.repartitions.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Répartition par lot</h4>
                  <div className="space-y-2">
                    {detail.repartitions.map((r) => (
                      <div key={r.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-gray-700">Lot {r.lot_numero}</p>
                          <p className="text-xs text-gray-400">{r.proprietaire_nom}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{fmt(r.montant)}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${paiementColors[r.statut_paiement]}`}>{r.statut_paiement}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editId ? 'Modifier la charge' : 'Nouvelle charge'}>
        <form onSubmit={save} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Copropriété *</label>
            <select required value={form.copropriete_id} onChange={(e) => setForm({ ...form, copropriete_id: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sélectionner...</option>
              {copros.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
            <input required value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Charges courantes T1 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant total (€) *</label>
              <input required type="number" step="0.01" value={form.montant_total} onChange={(e) => setForm({ ...form, montant_total: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="5000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget annuel (€)</label>
              <input type="number" step="0.01" value={form.budget_annuel} onChange={(e) => setForm({ ...form, budget_annuel: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="20000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'échéance *</label>
              <input required type="date" value={form.date_echeance} onChange={(e) => setForm({ ...form, date_echeance: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exercice</label>
              <input type="number" value={form.exercice} onChange={(e) => setForm({ ...form, exercice: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="2026" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {STATUTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Charges;
