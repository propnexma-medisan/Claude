import { formatMAD } from '../../utils/currency';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { budgets as budgetsApi, depenses as depensesApi, appelsFonds as appelsFondsApi } from '../../api/client';

const CATEGORIES_BUDGET = [
  'Honoraires syndic',
  'Sécurité',
  'Ménage / Nettoyage',
  'Jardinage / Espaces verts',
  'Contrats ascenseur',
  'Électricité parties communes',
  'Eau / Plomberie',
  'Assurance immeuble',
  'Travaux courants',
  'Chauffage collectif',
  'Ordures ménagères',
  'Administration / Juridique',
  'Divers',
];

const MONTHS_KEYS = ['jan', 'fev', 'mar', 'avr', 'mai', 'jun', 'jul', 'aou', 'sep', 'oct', 'nov', 'dec'];
const MONTHS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function fmt(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function StatutBadge({ statut }) {
  const colors = {
    'Brouillon': 'bg-gray-100 text-gray-700',
    'Soumis': 'bg-yellow-100 text-yellow-700',
    'Approuvé': 'bg-green-100 text-green-700',
    'Clôturé': 'bg-blue-100 text-blue-700',
    'En cours': 'bg-blue-100 text-blue-700',
    'Soldé': 'bg-green-100 text-green-700',
    'Annulé': 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[statut] || 'bg-gray-100 text-gray-600'}`}>
      {statut}
    </span>
  );
}

// ─── INLINE EDITABLE CELL ─────────────────────────────────────────────────────

function EditableCell({ value, onSave, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    const num = parseFloat(localVal) || 0;
    if (num !== value) {
      onSave(num);
    }
    setLocalVal(num);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') inputRef.current?.blur();
    if (e.key === 'Escape') {
      setLocalVal(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        className={`w-full px-1 py-0.5 border border-blue-400 rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        step="0.01"
        min="0"
      />
    );
  }

  return (
    <span
      className={`block w-full text-right cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 text-sm ${className}`}
      onClick={() => setEditing(true)}
      title="Cliquer pour modifier"
    >
      {fmt(value)}
    </span>
  );
}

// ─── TAB 1: BUDGETS ───────────────────────────────────────────────────────────

function TabBudgets({ coproprieteId }) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const [budgetsList, setBudgetsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [showStatutModal, setShowStatutModal] = useState(false);
  const [newStatut, setNewStatut] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await budgetsApi.getAll(coproprieteId);
      setBudgetsList(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [coproprieteId]);

  useEffect(() => { load(); }, [load]);

  const openBudget = useCallback(async (id) => {
    try {
      const data = await budgetsApi.getById(id);
      setSelectedBudget(data);
    } catch (e) {
      alert(e.message);
    }
  }, []);

  const createBudget = async () => {
    if (budgetsList.find(b => b.annee === selectedYear)) {
      alert(`Un budget pour ${selectedYear} existe déjà.`);
      return;
    }
    setCreating(true);
    try {
      await budgetsApi.create({ copropriete_id: coproprieteId, annee: selectedYear });
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteBudget = async (id) => {
    if (!confirm('Supprimer ce budget ?')) return;
    try {
      await budgetsApi.delete(id);
      if (selectedBudget?.id === id) setSelectedBudget(null);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleUpdateStatut = async () => {
    try {
      const updated = await budgetsApi.update(selectedBudget.id, { statut: newStatut });
      setSelectedBudget(prev => ({ ...prev, statut: updated.statut }));
      setBudgetsList(prev => prev.map(b => b.id === updated.id ? { ...b, statut: updated.statut } : b));
      setShowStatutModal(false);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleUpdateLigne = useCallback(async (budgetId, ligneId, field, value) => {
    try {
      const updated = await budgetsApi.updateLigne(budgetId, ligneId, { [field]: value });
      setSelectedBudget(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          lignes: prev.lignes.map(l => l.id === ligneId ? updated : l),
        };
      });
      // Also update total in list
      setBudgetsList(prev => prev.map(b => {
        if (b.id !== budgetId) return b;
        return b; // will reload on next open
      }));
    } catch (e) {
      alert(e.message);
    }
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (error) return <div className="text-red-600 p-4">{error}</div>;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          onClick={createBudget}
          disabled={creating}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {creating ? 'Création...' : `Nouveau budget ${selectedYear}`}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* List */}
        <div className="w-full lg:w-72 lg:flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Budgets</h3>
          {budgetsList.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-lg border border-gray-200">
              Aucun budget créé
            </div>
          ) : (
            <div className="space-y-2">
              {budgetsList.map(b => (
                <div
                  key={b.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedBudget?.id === b.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}
                  onClick={() => openBudget(b.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-800">{b.annee}</span>
                    <StatutBadge statut={b.statut} />
                  </div>
                  <div className="text-sm text-gray-500">{formatMAD(b.total_budget)}</div>
                  {b.statut === 'Brouillon' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteBudget(b.id); }}
                      className="mt-2 text-xs text-red-500 hover:text-red-700"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="flex-1 min-w-0">
          {!selectedBudget ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200 text-gray-400">
              Sélectionnez un budget pour le modifier
            </div>
          ) : (
            <BudgetDetail
              budget={selectedBudget}
              onUpdateLigne={handleUpdateLigne}
              onModifierStatut={() => { setNewStatut(selectedBudget.statut); setShowStatutModal(true); }}
            />
          )}
        </div>
      </div>

      {/* Statut modal */}
      {showStatutModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">Modifier le statut</h3>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
              value={newStatut}
              onChange={(e) => setNewStatut(e.target.value)}
            >
              {['Brouillon', 'Soumis', 'Approuvé', 'Clôturé'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={handleUpdateStatut} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">
                Confirmer
              </button>
              <button onClick={() => setShowStatutModal(false)} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetDetail({ budget, onUpdateLigne, onModifierStatut }) {
  const lignes = budget.lignes || [];

  // Compute column totals
  const totalAnnuel = lignes.reduce((s, l) => s + (l.montant_annuel || 0), 0);
  const monthTotals = MONTHS_KEYS.map(m => lignes.reduce((s, l) => s + (l[m] || 0), 0));

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-gray-800">Budget {budget.annee}</span>
          <StatutBadge statut={budget.statut} />
          <span className="text-sm text-gray-500">{formatMAD(totalAnnuel)} total</span>
        </div>
        <button
          onClick={onModifierStatut}
          className="text-sm border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Modifier statut
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600 sticky left-0 bg-gray-50 min-w-[160px]">Catégorie</th>
              <th className="text-right px-2 py-2 font-semibold text-gray-600 min-w-[80px]">Annuel</th>
              {MONTHS_LABELS.map(m => (
                <th key={m} className="text-right px-1.5 py-2 font-semibold text-gray-600 min-w-[60px]">{m}</th>
              ))}
              <th className="text-left px-2 py-2 font-semibold text-gray-600 min-w-[100px]">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lignes.map((ligne) => (
              <BudgetLigneRow key={ligne.id} ligne={ligne} budgetId={budget.id} onUpdate={onUpdateLigne} />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
              <td className="px-3 py-2 text-blue-800 sticky left-0 bg-blue-50 text-sm">TOTAL</td>
              <td className="px-2 py-2 text-right text-blue-800 text-sm">{fmt(totalAnnuel)}</td>
              {monthTotals.map((t, i) => (
                <td key={i} className="px-1.5 py-2 text-right text-blue-800">{fmt(t)}</td>
              ))}
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-gray-400 px-4 py-2">Cliquez sur une cellule pour la modifier. Le montant annuel est recalculé automatiquement depuis les mois.</p>
    </div>
  );
}

function BudgetLigneRow({ ligne, budgetId, onUpdate }) {
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesVal, setNotesVal] = useState(ligne.notes || '');
  const notesRef = useRef(null);

  useEffect(() => { setNotesVal(ligne.notes || ''); }, [ligne.notes]);

  const saveMonth = (monthKey, value) => {
    onUpdate(budgetId, ligne.id, monthKey, value);
  };

  const saveNotes = () => {
    setNotesEditing(false);
    if (notesVal !== (ligne.notes || '')) {
      onUpdate(budgetId, ligne.id, 'notes', notesVal);
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-1.5 text-gray-700 sticky left-0 bg-white font-medium whitespace-nowrap">{ligne.categorie}</td>
      <td className="px-2 py-1.5 text-gray-500 text-right">{fmt(ligne.montant_annuel)}</td>
      {MONTHS_KEYS.map((m) => (
        <td key={m} className="px-1.5 py-1.5">
          <EditableCell value={ligne[m] || 0} onSave={(v) => saveMonth(m, v)} />
        </td>
      ))}
      <td className="px-2 py-1.5">
        {notesEditing ? (
          <input
            ref={notesRef}
            className="w-full border border-blue-300 rounded px-1 py-0.5 text-xs"
            value={notesVal}
            onChange={(e) => setNotesVal(e.target.value)}
            onBlur={saveNotes}
            onKeyDown={(e) => { if (e.key === 'Enter') notesRef.current?.blur(); }}
            autoFocus
          />
        ) : (
          <span
            className="block text-gray-400 cursor-pointer hover:text-gray-600 truncate max-w-[100px]"
            onClick={() => setNotesEditing(true)}
            title={notesVal || 'Ajouter une note'}
          >
            {notesVal || <span className="italic text-xs">note...</span>}
          </span>
        )}
      </td>
    </tr>
  );
}

// ─── TAB 2: DEPENSES ──────────────────────────────────────────────────────────

function TabDepenses({ coproprieteId }) {
  const currentYear = new Date().getFullYear();
  const [depensesList, setDepensesList] = useState([]);
  const [budgetsList, setBudgetsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAnnee, setFilterAnnee] = useState(String(currentYear));
  const [filterMois, setFilterMois] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDepense, setEditingDepense] = useState(null);

  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = { copropriete_id: coproprieteId };
      if (filterAnnee) params.annee = filterAnnee;
      if (filterCat) params.categorie = filterCat;
      const [data, bdata] = await Promise.all([
        depensesApi.getAll(params),
        budgetsApi.getAll(coproprieteId),
      ]);
      let filtered = data;
      if (filterMois) {
        filtered = data.filter(d => d.date_depense?.substring(5, 7) === filterMois);
      }
      setDepensesList(filtered);
      setBudgetsList(bdata);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [coproprieteId, filterAnnee, filterMois, filterCat]);

  useEffect(() => { load(); }, [load]);

  const deleteDepense = async (id) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    try {
      await depensesApi.delete(id);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const totalDepense = depensesList.reduce((s, d) => s + (d.montant || 0), 0);
  const nbFactures = depensesList.length;
  const moisActifs = new Set(depensesList.map(d => d.date_depense?.substring(0, 7))).size || 1;
  const moyenneMois = nbFactures > 0 ? totalDepense / moisActifs : 0;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)}>
          <option value="">Toutes les années</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={filterMois} onChange={e => setFilterMois(e.target.value)}>
          <option value="">Tous les mois</option>
          {MONTHS_LABELS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {CATEGORIES_BUDGET.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => { setEditingDepense(null); setShowModal(true); }}
          className="ml-auto flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle dépense
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total dépensé</p>
          <p className="text-2xl font-bold text-gray-800">{formatMAD(totalDepense)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Nb factures</p>
          <p className="text-2xl font-bold text-gray-800">{nbFactures}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Moyenne / mois</p>
          <p className="text-2xl font-bold text-gray-800">{formatMAD(moyenneMois)}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Catégorie</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Libellé</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fournisseur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">N° Facture</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Montant</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {depensesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">Aucune dépense trouvée</td>
                </tr>
              ) : depensesList.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{d.date_depense}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">{d.categorie}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{d.libelle}</td>
                  <td className="px-4 py-3 text-gray-500">{d.fournisseur || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{d.numero_facture || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatMAD(d.montant)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditingDepense(d); setShowModal(true); }} className="text-blue-500 hover:text-blue-700 mr-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => deleteDepense(d.id)} className="text-red-400 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {depensesList.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                  <td colSpan={5} className="px-4 py-3 text-gray-600">Total</td>
                  <td className="px-4 py-3 text-right text-gray-800">{formatMAD(totalDepense)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {showModal && (
        <DepenseModal
          depense={editingDepense}
          coproprieteId={coproprieteId}
          budgetsList={budgetsList}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function DepenseModal({ depense, coproprieteId, budgetsList, onClose, onSaved }) {
  const isEdit = !!depense;
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    copropriete_id: coproprieteId,
    budget_id: depense?.budget_id || '',
    categorie: depense?.categorie || CATEGORIES_BUDGET[0],
    libelle: depense?.libelle || '',
    montant: depense?.montant || '',
    date_depense: depense?.date_depense || today,
    fournisseur: depense?.fournisseur || '',
    numero_facture: depense?.numero_facture || '',
    notes: depense?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, budget_id: form.budget_id || null };
      if (isEdit) {
        await depensesApi.update(depense.id, payload);
      } else {
        await depensesApi.create(payload);
      }
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">{isEdit ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.date_depense} onChange={e => setForm(f => ({ ...f, date_depense: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant (Dhs) *</label>
              <input type="number" required step="0.01" min="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
            <select required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}>
              {CATEGORIES_BUDGET.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
            <input type="text" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))} placeholder="Description de la dépense" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
              <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.fournisseur} onChange={e => setForm(f => ({ ...f, fournisseur: e.target.value }))} placeholder="Nom du fournisseur" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° Facture</label>
              <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.numero_facture} onChange={e => setForm(f => ({ ...f, numero_facture: e.target.value }))} placeholder="FA-2024-001" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget lié</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.budget_id} onChange={e => setForm(f => ({ ...f, budget_id: e.target.value }))}>
              <option value="">Aucun</option>
              {budgetsList.map(b => <option key={b.id} value={b.id}>Budget {b.annee}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Créer'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-200 transition-colors">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── TAB 3: SYNTHESE ──────────────────────────────────────────────────────────

function TabSynthese({ coproprieteId }) {
  const currentYear = new Date().getFullYear();
  const [budgetsList, setBudgetsList] = useState([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [synthese, setSynthese] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingBudgets, setLoadingBudgets] = useState(true);

  useEffect(() => {
    budgetsApi.getAll(coproprieteId)
      .then(data => {
        setBudgetsList(data);
        // Auto-select budget for current year
        const cur = data.find(b => b.annee === currentYear);
        if (cur) setSelectedBudgetId(String(cur.id));
        else if (data.length > 0) setSelectedBudgetId(String(data[0].id));
      })
      .catch(console.error)
      .finally(() => setLoadingBudgets(false));
  }, [coproprieteId, currentYear]);

  useEffect(() => {
    if (!selectedBudgetId) return;
    setLoading(true);
    budgetsApi.getSynthese(selectedBudgetId)
      .then(setSynthese)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBudgetId]);

  if (loadingBudgets) return <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  if (budgetsList.length === 0) {
    return <div className="text-center py-16 text-gray-400">Aucun budget disponible. Créez d'abord un budget dans l'onglet Budgets.</div>;
  }

  const totBudget = synthese ? synthese.reduce((s, r) => s + r.budget_annuel, 0) : 0;
  const totConsomme = synthese ? synthese.reduce((s, r) => s + r.consomme, 0) : 0;
  const totRestant = totBudget - totConsomme;
  const totPct = totBudget > 0 ? Math.round((totConsomme / totBudget) * 100) : 0;

  return (
    <div>
      {/* Budget selector */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-gray-700">Budget à analyser :</label>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={selectedBudgetId}
          onChange={e => setSelectedBudgetId(e.target.value)}
        >
          {budgetsList.map(b => <option key={b.id} value={b.id}>Budget {b.annee} — {b.statut}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
      ) : synthese ? (
        <>
          {/* Global summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Budget total</p>
              <p className="text-xl font-bold text-gray-800">{formatMAD(totBudget)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Consommé</p>
              <p className="text-xl font-bold text-orange-600">{formatMAD(totConsomme)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Restant</p>
              <p className={`text-xl font-bold ${totRestant < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatMAD(totRestant)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">% Consommé</p>
              <p className={`text-xl font-bold ${totPct > 100 ? 'text-red-600' : totPct > 75 ? 'text-orange-500' : 'text-green-600'}`}>{totPct} %</p>
            </div>
          </div>

          {/* Per-category table with progress bars */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Catégorie</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Budget annuel</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Consommé</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Restant</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[160px]">Progression</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {synthese.map((row) => {
                  const pct = row.pct_consomme;
                  const barColor = pct > 100 ? 'bg-red-500' : pct > 75 ? 'bg-orange-400' : 'bg-green-500';
                  const pctColor = pct > 100 ? 'text-red-600 font-bold' : pct > 75 ? 'text-orange-500 font-semibold' : 'text-green-600';
                  const restantColor = row.restant < 0 ? 'text-red-600' : 'text-gray-600';

                  return (
                    <tr key={row.categorie} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800 font-medium">{row.categorie}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatMAD(row.budget_annuel)}</td>
                      <td className="px-4 py-3 text-right text-gray-800">{formatMAD(row.consomme)}</td>
                      <td className={`px-4 py-3 text-right ${restantColor}`}>{formatMAD(row.restant)}</td>
                      <td className="px-4 py-3">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right text-sm ${pctColor}`}>{pct} %</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                  <td className="px-4 py-3 text-gray-700">TOTAL</td>
                  <td className="px-4 py-3 text-right text-gray-800">{formatMAD(totBudget)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{formatMAD(totConsomme)}</td>
                  <td className={`px-4 py-3 text-right ${totRestant < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatMAD(totRestant)}</td>
                  <td className="px-4 py-3">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${totPct > 100 ? 'bg-red-500' : totPct > 75 ? 'bg-orange-400' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(totPct, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right ${totPct > 100 ? 'text-red-600 font-bold' : totPct > 75 ? 'text-orange-500' : 'text-green-600'}`}>{totPct} %</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Monthly table */}
          <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700">Détail mensuel — Budget vs Réel</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-semibold text-gray-500 sticky left-0 bg-gray-50">Catégorie</th>
                    {MONTHS_LABELS.map(m => (
                      <th key={m} className="text-right px-2 py-2 font-semibold text-gray-500 min-w-[70px]">
                        <div>{m}</div>
                        <div className="font-normal text-gray-400 text-xs">Bud / Réel</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {synthese.map(row => (
                    <tr key={row.categorie} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700 sticky left-0 bg-white font-medium whitespace-nowrap">{row.categorie}</td>
                      {row.par_mois.map((pm, i) => {
                        const over = pm.consomme > pm.budget && pm.budget > 0;
                        return (
                          <td key={i} className="px-2 py-2 text-right">
                            <div className="text-gray-500">{fmt(pm.budget)}</div>
                            <div className={over ? 'text-red-600 font-semibold' : 'text-blue-600'}>{fmt(pm.consomme)}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-xs text-gray-400">Chaque colonne affiche : Budget prévu / Réel dépensé. Rouge = dépassement.</div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─── TAB 4: APPELS DE FONDS ───────────────────────────────────────────────────

function TabAppelsFonds({ coproprieteId }) {
  const [appelsList, setAppelsList] = useState([]);
  const [budgetsList, setBudgetsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAppel, setEditingAppel] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [data, bdata] = await Promise.all([
        appelsFondsApi.getAll(coproprieteId),
        budgetsApi.getAll(coproprieteId),
      ]);
      setAppelsList(data);
      setBudgetsList(bdata);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [coproprieteId]);

  useEffect(() => { load(); }, [load]);

  const deleteAppel = async (id) => {
    if (!confirm('Supprimer cet appel de fonds ?')) return;
    try {
      await appelsFondsApi.delete(id);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const changeStatut = async (id, statut) => {
    try {
      await appelsFondsApi.update(id, { statut });
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const totalEnCours = appelsList.filter(a => a.statut === 'En cours').reduce((s, a) => s + (a.montant_total || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-4">
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">En cours</p>
            <p className="text-lg font-bold text-blue-600">{formatMAD(totalEnCours)}</p>
          </div>
        </div>
        <button
          onClick={() => { setEditingAppel(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvel appel de fonds
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[650px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Libellé</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Motif</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date appel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Échéance</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Montant</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appelsList.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Aucun appel de fonds</td></tr>
              ) : appelsList.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{a.libelle}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{a.motif || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.date_appel}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.date_echeance}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatMAD(a.montant_total)}</td>
                  <td className="px-4 py-3 text-center">
                    <select
                      className="text-xs border border-gray-200 rounded px-2 py-1"
                      value={a.statut}
                      onChange={e => changeStatut(a.id, e.target.value)}
                    >
                      {['En cours', 'Soldé', 'Annulé'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditingAppel(a); setShowModal(true); }} className="text-blue-500 hover:text-blue-700 mr-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => deleteAppel(a.id)} className="text-red-400 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AppelFondsModal
          appel={editingAppel}
          coproprieteId={coproprieteId}
          budgetsList={budgetsList}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function AppelFondsModal({ appel, coproprieteId, budgetsList, onClose, onSaved }) {
  const isEdit = !!appel;
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    copropriete_id: coproprieteId,
    budget_id: appel?.budget_id || '',
    libelle: appel?.libelle || '',
    motif: appel?.motif || '',
    montant_total: appel?.montant_total || '',
    date_appel: appel?.date_appel || today,
    date_echeance: appel?.date_echeance || today,
    statut: appel?.statut || 'En cours',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, budget_id: form.budget_id || null };
      if (isEdit) {
        await appelsFondsApi.update(appel.id, payload);
      } else {
        await appelsFondsApi.create(payload);
      }
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">{isEdit ? 'Modifier l\'appel de fonds' : 'Nouvel appel de fonds'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
            <input type="text" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))} placeholder="Ex: Appel de fonds T1 2026" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motif</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))} placeholder="Raison de l'appel de fonds" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant total (Dhs) *</label>
            <input type="number" required step="0.01" min="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.montant_total} onChange={e => setForm(f => ({ ...f, montant_total: e.target.value }))} placeholder="0.00" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'appel *</label>
              <input type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.date_appel} onChange={e => setForm(f => ({ ...f, date_appel: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'échéance *</label>
              <input type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.date_echeance} onChange={e => setForm(f => ({ ...f, date_echeance: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                {['En cours', 'Soldé', 'Annulé'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget lié</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.budget_id} onChange={e => setForm(f => ({ ...f, budget_id: e.target.value }))}>
                <option value="">Aucun</option>
                {budgetsList.map(b => <option key={b.id} value={b.id}>Budget {b.annee}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Créer'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-200 transition-colors">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN BUDGET PAGE ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'budgets', label: 'Budgets' },
  { id: 'depenses', label: 'Dépenses' },
  { id: 'synthese', label: 'Synthèse Budget vs Réel' },
  { id: 'appels', label: 'Appels de Fonds' },
];

export default function Budget() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('budgets');

  const coproprieteId = user?.copropriete_id;

  if (!coproprieteId) {
    return (
      <div className="text-center py-20 text-gray-500">
        Aucune copropriété associée à votre compte.
      </div>
    );
  }

  return (
    <div className="max-w-full">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Budget</h1>
        <p className="text-gray-500 text-sm mt-1">Gestion budgétaire, dépenses et appels de fonds</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-gray-200 mb-6 gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'budgets' && <TabBudgets coproprieteId={coproprieteId} />}
        {activeTab === 'depenses' && <TabDepenses coproprieteId={coproprieteId} />}
        {activeTab === 'synthese' && <TabSynthese coproprieteId={coproprieteId} />}
        {activeTab === 'appels' && <TabAppelsFonds coproprieteId={coproprieteId} />}
      </div>
    </div>
  );
}
