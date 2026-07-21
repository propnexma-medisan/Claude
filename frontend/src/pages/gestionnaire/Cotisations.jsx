import { formatMAD } from '../../utils/currency';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { cotisations, relances, users } from '../../api/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return formatMAD(n || 0);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('fr-FR');
}

function fmtMonth(mois) {
  // mois = 'YYYY-MM'
  if (!mois) return '—';
  const [y, m] = mois.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function shortMonth(mois) {
  const [y, m] = mois.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

function initials(prenom, nom) {
  return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase();
}

function daysRemaining(dateFin) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dateFin + 'T00:00:00');
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function joursLabel(days) {
  if (days < 0) return { label: `J+${Math.abs(days)}`, cls: 'text-red-600 font-bold' };
  if (days <= 7) return { label: `J-${days}`, cls: 'text-red-600 font-bold' };
  if (days <= 30) return { label: `J-${days}`, cls: 'text-orange-500 font-semibold' };
  if (days <= 60) return { label: `J-${days}`, cls: 'text-yellow-600' };
  return { label: `J-${days}`, cls: 'text-gray-400' };
}

const STATUT_COLORS = {
  Active: 'bg-green-100 text-green-700',
  Expirée: 'bg-red-100 text-red-700',
  Suspendue: 'bg-yellow-100 text-yellow-700',
  Résiliée: 'bg-gray-100 text-gray-600',
};

const PAIEMENT_COLORS = {
  Payé: 'bg-green-100 text-green-700 border-green-200',
  'En attente': 'bg-gray-100 text-gray-500 border-gray-200',
  'En retard': 'bg-red-100 text-red-600 border-red-200',
  Partiel: 'bg-orange-100 text-orange-600 border-orange-200',
};

const PAIEMENT_ICONS = {
  Payé: '✓',
  'En attente': '○',
  'En retard': '⚠',
  Partiel: '◑',
};

const RELANCE_TEMPLATES = {
  'Fin de période': {
    objet: (c) => `Fin de période de cotisation - ${c.prenom} ${c.nom}`,
    message: (c) => `Bonjour ${c.prenom} ${c.nom},\n\nVotre période de cotisation se termine le ${fmtDate(c.date_fin)}.\n\nNous vous invitons à prendre contact avec nous pour le renouvellement de votre cotisation.\n\nCordialement,\nVotre gestionnaire`,
  },
  Impayé: {
    objet: (c) => `Paiement en retard - ${c.prenom} ${c.nom}`,
    message: (c) => `Bonjour ${c.prenom} ${c.nom},\n\nNous constatons que votre cotisation mensuelle de ${fmt(c.montant_mensuel)} présente un retard de paiement.\n\nMerci de régulariser votre situation dans les meilleurs délais.\n\nCordialement,\nVotre gestionnaire`,
  },
  Renouvellement: {
    objet: (c) => `Renouvellement de cotisation - ${c.prenom} ${c.nom}`,
    message: (c) => `Bonjour ${c.prenom} ${c.nom},\n\nNous vous proposons le renouvellement de votre cotisation pour la prochaine période.\n\nMerci de bien vouloir nous contacter pour convenir des modalités.\n\nCordialement,\nVotre gestionnaire`,
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatutBadge({ statut }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[statut] || 'bg-gray-100 text-gray-600'}`}>
      {statut}
    </span>
  );
}

function PaiementCell({ p, onUpdate, disabled }) {
  const montantAffiche = p.montant_regle !== null && p.montant_regle !== undefined && p.montant_regle !== p.montant;
  return (
    <button
      disabled={disabled}
      onClick={() => onUpdate(p)}
      title={montantAffiche ? `Reçu: ${p.montant_regle} / Attendu: ${p.montant}` : undefined}
      className={`w-[60px] h-[56px] rounded-lg border text-center text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-all hover:opacity-80 ${PAIEMENT_COLORS[p.statut] || 'bg-gray-100 text-gray-500 border-gray-200'} ${disabled ? 'cursor-default' : 'cursor-pointer hover:shadow-sm'} ${montantAffiche ? 'ring-1 ring-orange-400' : ''}`}
    >
      <span className="text-base leading-none">{PAIEMENT_ICONS[p.statut] || '○'}</span>
      <span className="text-[10px] leading-none">{shortMonth(p.mois)}</span>
      {montantAffiche && <span className="text-[9px] leading-none opacity-70">{p.montant_regle}</span>}
    </button>
  );
}

// ─── Preuves section (reusable) ───────────────────────────────────────────────
function PreuvesSection({ cotisationId, initialPreuves }) {
  const [preuves, setPreuves] = useState(initialPreuves || []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const fileInputRef = React.useRef(null);

  const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const created = await cotisations.uploadPreuve(cotisationId, file);
      setPreuves((prev) => [...prev, created]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(preuveId) {
    if (!confirm('Supprimer ce justificatif ?')) return;
    try {
      await cotisations.deletePreuve(preuveId);
      setPreuves((prev) => prev.filter((p) => p.id !== preuveId));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Justificatifs</h3>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50">
            {uploading
              ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            }
            {uploading ? 'Envoi...' : 'Ajouter'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} />
        </div>

        {uploadError && <p className="text-xs text-red-500 mb-2">{uploadError}</p>}

        {preuves.length === 0 ? (
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 text-center text-xs text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors">
            <svg className="w-7 h-7 mx-auto mb-1.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Joindre un justificatif (photo de chèque, virement…)
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {preuves.map((pr) => (
              <div key={pr.id} className="relative group">
                {pr.mimetype?.startsWith('image/') ? (
                  <button type="button" onClick={() => setLightbox(pr)}
                    className="w-full aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-300 transition-colors">
                    <img src={`${API_BASE}${pr.url}`} alt={pr.original_name} className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <a href={`${API_BASE}${pr.url}`} target="_blank" rel="noreferrer"
                    className="flex flex-col items-center justify-center w-full aspect-square rounded-lg border border-gray-200 hover:border-blue-300 bg-gray-50 transition-colors">
                    <svg className="w-7 h-7 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
                    </svg>
                    <span className="text-[9px] text-gray-500 mt-1 px-1 text-center truncate w-full">{pr.original_name}</span>
                  </a>
                )}
                <button type="button" onClick={() => handleDelete(pr.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-300 hover:text-blue-400 text-gray-300 transition-colors flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(null)}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img src={`${API_BASE}${lightbox.url}`} alt={lightbox.original_name}
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
          <p className="absolute bottom-4 text-white/60 text-sm">{lightbox.original_name}</p>
        </div>
      )}
    </>
  );
}

// ─── Modal: Update Payment ─────────────────────────────────────────────────────
function PaiementModal({ paiement, onClose, onSave }) {
  const [form, setForm] = useState({
    statut: paiement.statut,
    date_paiement: paiement.date_paiement || '',
    mode_paiement: paiement.mode_paiement || '',
    reference: paiement.reference || '',
    notes: paiement.notes || '',
    montant_regle: paiement.montant_regle !== null && paiement.montant_regle !== undefined ? String(paiement.montant_regle) : '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(paiement.id, form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">Mettre à jour le paiement</h3>
            <p className="text-xs text-gray-400 mt-0.5">{fmtMonth(paiement.mois)} · {fmt(paiement.montant)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['En attente', 'Payé', 'En retard', 'Partiel'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de paiement</label>
            <input type="date" value={form.date_paiement} onChange={(e) => setForm({ ...form, date_paiement: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
            <select value={form.mode_paiement} onChange={(e) => setForm({ ...form, mode_paiement: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Sélectionner —</option>
              {['Virement', 'Chèque', 'Espèces', 'Prélèvement', 'Carte bancaire'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Montant réellement reçu (Dhs)
              <span className="ml-1 text-xs text-gray-400 font-normal">— laisser vide si égal au montant attendu ({fmt(paiement.montant)})</span>
            </label>
            <input type="number" min="0" step="0.01" value={form.montant_regle}
              onChange={(e) => setForm({ ...form, montant_regle: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={String(paiement.montant)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Référence</label>
            <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="N° de virement, chèque..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Relance ────────────────────────────────────────────────────────────
function RelanceModal({ cotisation, onClose, onSave }) {
  const [type, setType] = useState('Fin de période');
  const [objet, setObjet] = useState(RELANCE_TEMPLATES['Fin de période'].objet(cotisation));
  const [message, setMessage] = useState(RELANCE_TEMPLATES['Fin de période'].message(cotisation));
  const [saving, setSaving] = useState(false);

  function handleTypeChange(t) {
    setType(t);
    setObjet(RELANCE_TEMPLATES[t].objet(cotisation));
    setMessage(RELANCE_TEMPLATES[t].message(cotisation));
  }

  async function handleSend() {
    setSaving(true);
    try {
      await onSave({ copropriete_id: cotisation.copropriete_id, user_id: cotisation.user_id, cotisation_id: cotisation.id, type, objet, message });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Envoyer une relance</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-sm text-gray-600 bg-blue-50 rounded-lg px-4 py-3">
            Destinataire: <strong>{cotisation.prenom} {cotisation.nom}</strong>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de relance</label>
            <div className="flex gap-2">
              {['Fin de période', 'Impayé', 'Renouvellement'].map((t) => (
                <button key={t} onClick={() => handleTypeChange(t)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${type === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objet</label>
            <input type="text" value={objet} onChange={(e) => setObjet(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={handleSend} disabled={saving || !objet.trim() || !message.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {saving ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: New Cotisation ─────────────────────────────────────────────────────
function getMonthsBetween(start, end) {
  if (!start || !end) return [];
  const months = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 120) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
    guard++;
  }
  return months;
}

function NewCotisationModal({ coproprieteId, coproUsers, onClose, onSave }) {
  const [form, setForm] = useState({
    user_id: '',
    lot_id: '',
    montant_mensuel: '',
    date_debut: '',
    date_fin: '',
    notes: '',
  });
  const [paidMonths, setPaidMonths] = useState(new Set());
  const [batchMode, setBatchMode] = useState('');
  const [batchDate, setBatchDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedUser = coproUsers.find((u) => String(u.id) === String(form.user_id));
  const allMonths = getMonthsBetween(form.date_debut, form.date_fin);

  function handleUserChange(userId) {
    const u = coproUsers.find((x) => String(x.id) === String(userId));
    setForm((f) => ({ ...f, user_id: userId, lot_id: u?.lot_id || '' }));
  }

  function handleDateChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setPaidMonths(new Set());
  }

  function toggleMonth(mois) {
    setPaidMonths((prev) => {
      const next = new Set(prev);
      if (next.has(mois)) next.delete(mois); else next.add(mois);
      return next;
    });
  }

  function toggleAll() {
    setPaidMonths(paidMonths.size === allMonths.length ? new Set() : new Set(allMonths));
  }

  async function handleSave() {
    if (!form.user_id || !form.montant_mensuel || !form.date_debut || !form.date_fin) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await onSave({
        copropriete_id: coproprieteId,
        ...form,
        lot_id: form.lot_id || null,
        montant_mensuel: parseFloat(form.montant_mensuel),
      });

      if (paidMonths.size > 0 && created?.id) {
        const detail = await cotisations.getById(created.id);
        const toUpdate = (detail.paiements || []).filter((p) => paidMonths.has(p.mois));
        await Promise.all(toUpdate.map((p) =>
          cotisations.updatePaiement(p.id, {
            statut: 'Payé',
            mode_paiement: batchMode || '',
            date_paiement: batchDate || new Date().toISOString().split('T')[0],
          })
        ));
      }

      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const totalPaye = paidMonths.size > 0 && form.montant_mensuel
    ? paidMonths.size * parseFloat(form.montant_mensuel)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-gray-800">Nouvelle cotisation</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

          {coproUsers.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
              Tous les copropriétaires ont déjà une cotisation active ou suspendue.
            </div>
          )}

          {/* Copropriétaire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Copropriétaire <span className="text-red-500">*</span></label>
            <select value={form.user_id} onChange={(e) => handleUserChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={coproUsers.length === 0}>
              <option value="">— Sélectionner —</option>
              {coproUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.prenom} {u.nom}{u.lot_numero ? ` — Lot ${u.lot_numero}` : ''}</option>
              ))}
            </select>
            {selectedUser && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {selectedUser.lot_numero
                  ? <span>Lot <strong className="text-gray-700">{selectedUser.lot_numero}</strong> — {selectedUser.lot_type}{selectedUser.lot_surface ? ` · ${selectedUser.lot_surface} m²` : ''}</span>
                  : <span className="italic text-gray-400">Aucun lot associé à ce copropriétaire</span>
                }
              </div>
            )}
          </div>

          {/* Montant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant mensuel (Dhs) <span className="text-red-500">*</span></label>
            <input type="number" min="0" step="0.01" value={form.montant_mensuel}
              onChange={(e) => setForm({ ...form, montant_mensuel: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="350.00" />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Début <span className="text-red-500">*</span></label>
              <input type="month" value={form.date_debut} onChange={(e) => handleDateChange('date_debut', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin <span className="text-red-500">*</span></label>
              <input type="month" value={form.date_fin} onChange={(e) => handleDateChange('date_fin', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Mois déjà payés */}
          {allMonths.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Mois déjà réglés <span className="text-gray-400 font-normal">(optionnel)</span></p>
                  <p className="text-xs text-gray-400 mt-0.5">Cliquez pour marquer les mois payés d'avance</p>
                </div>
                <button type="button" onClick={toggleAll}
                  className="text-xs px-2.5 py-1 border border-blue-300 text-blue-600 rounded-full hover:bg-blue-100 transition-colors whitespace-nowrap">
                  {paidMonths.size === allMonths.length ? 'Tout effacer' : 'Tout cocher'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {allMonths.map((mois) => {
                  const isPaid = paidMonths.has(mois);
                  return (
                    <button key={mois} type="button" onClick={() => toggleMonth(mois)}
                      className={`w-[52px] h-[46px] rounded-lg border text-center text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-all ${
                        isPaid
                          ? 'bg-green-100 text-green-700 border-green-300 shadow-sm'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500'
                      }`}>
                      <span className="text-base leading-none">{isPaid ? '✓' : '○'}</span>
                      <span className="text-[10px] leading-none">{shortMonth(mois)}</span>
                    </button>
                  );
                })}
              </div>

              {paidMonths.size > 0 && (
                <>
                  <p className="text-xs text-green-700 font-medium">
                    {paidMonths.size} mois sélectionné{paidMonths.size > 1 ? 's' : ''}
                    {form.montant_mensuel ? ` — ${fmt(totalPaye)} au total` : ''}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Mode de règlement</label>
                      <select value={batchMode} onChange={(e) => setBatchMode(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">— Optionnel —</option>
                        {['Virement', 'Chèque', 'Espèces', 'Prélèvement', 'Carte bancaire'].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date de règlement</label>
                      <input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Création...' : 'Créer la cotisation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Virement groupé ───────────────────────────────────────────────────
function VirementModal({ detail, onClose, onSave }) {
  const unpaid = useMemo(() =>
    (detail.paiements || [])
      .filter((p) => p.statut !== 'Payé')
      .sort((a, b) => a.mois.localeCompare(b.mois)),
    [detail.paiements]
  );

  const today = new Date().toISOString().slice(0, 10);
  const [montant, setMontant] = useState('');
  const [datePaiement, setDatePaiement] = useState(today);
  const [modePaiement, setModePaiement] = useState('Virement');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const total = parseFloat(montant);
    if (!total || total <= 0 || unpaid.length === 0) return null;
    let restant = total;
    const covered = [];
    for (const p of unpaid) {
      if (restant <= 0) break;
      if (restant >= p.montant) {
        covered.push({ p, type: 'full' });
        restant = Math.round((restant - p.montant) * 100) / 100;
      } else {
        covered.push({ p, type: 'partial', amount: Math.round(restant * 100) / 100 });
        restant = 0;
      }
    }
    return { covered, reste: Math.round(restant * 100) / 100 };
  }, [montant, unpaid]);

  async function handleSave() {
    if (!montant || parseFloat(montant) <= 0) return;
    setSaving(true);
    try {
      await onSave({ montant_total: parseFloat(montant), date_paiement: datePaiement, mode_paiement: modePaiement, reference });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-gray-800">Saisir un virement</h3>
            <p className="text-xs text-gray-400 mt-0.5">{detail.prenom} {detail.nom} · {fmt(detail.montant_mensuel)}/mois</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {unpaid.length === 0 ? (
            <div className="text-center py-8 text-green-600">
              <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="font-medium">Tous les mois sont déjà réglés</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant reçu (Dhs)</label>
                <input
                  type="number" min="0" step="0.01" value={montant} autoFocus
                  onChange={(e) => setMontant(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                  placeholder="Ex : 6000"
                />
                {unpaid.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {unpaid.length} mois impayé{unpaid.length > 1 ? 's' : ''} · montant attendu : {fmt(detail.montant_mensuel)}/mois
                  </p>
                )}
              </div>

              {/* Preview */}
              {preview && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Répartition automatique</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.covered.map(({ p, type, amount }) => (
                      <div
                        key={p.id}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex flex-col items-center gap-0.5 ${
                          type === 'full'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-orange-100 text-orange-700 border border-orange-200'
                        }`}
                      >
                        <span>{shortMonth(p.mois)}</span>
                        <span className="font-bold">{type === 'full' ? '✓' : `${amount} Dhs`}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-blue-100 text-xs text-blue-800 space-y-0.5">
                    <p>
                      <span className="font-semibold">{preview.covered.filter((c) => c.type === 'full').length} mois</span> soldés intégralement
                      {preview.covered.some((c) => c.type === 'partial') && (
                        <span className="ml-1 text-orange-600">+ 1 mois partiel</span>
                      )}
                    </p>
                    {preview.reste > 0 && (
                      <p className="text-amber-600 font-medium">⚠ Excédent de {fmt(preview.reste)} — tous les mois impayés sont couverts</p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de réception</label>
                  <input type="date" value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                  <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['Virement', 'Chèque', 'Espèces', 'Prélèvement', 'Carte bancaire'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Référence <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="N° de virement…" />
              </div>
            </>
          )}
        </div>

        {unpaid.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving || !montant || parseFloat(montant) <= 0}
              className="px-5 py-2 text-sm bg-[#1e3a5f] text-white rounded-lg hover:bg-[#16304f] disabled:opacity-50 font-medium">
              {saving ? 'Enregistrement…' : `Enregistrer ${montant ? fmt(parseFloat(montant) || 0) : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CotisationRow ────────────────────────────────────────────────────────────
function CotisationRow({ c, isSelected, onClick }) {
  const days = daysRemaining(c.date_fin);
  const { label, cls } = joursLabel(days);

  let rowBg = 'hover:bg-gray-50';
  if (c.statut === 'Active' && days <= 30 && days >= 0) rowBg = 'bg-orange-50 hover:bg-orange-100';
  else if (c.statut === 'Expirée') rowBg = 'bg-red-50 hover:bg-red-100';
  else if (c.dernier_paiement_statut === 'En retard') rowBg = 'bg-red-50 hover:bg-red-100';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${rowBg} ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initials(c.prenom, c.nom)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{c.prenom} {c.nom}</span>
            {c.lot_numero && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Lot {c.lot_numero}</span>}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {fmtDate(c.date_debut)} → {fmtDate(c.date_fin)} · {fmt(c.montant_mensuel)}/mois
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <StatutBadge statut={c.statut} />
          {c.statut === 'Active' && (
            <span className={`text-xs ${cls}`}>{label}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────────────
function CotisationDetail({ cotisationId, coproprieteId, onRefresh, onDelete }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPaiement, setSelectedPaiement] = useState(null);
  const [showRelanceModal, setShowRelanceModal] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [newDateFin, setNewDateFin] = useState('');
  const [showStatutMenu, setShowStatutMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingQuitus, setSendingQuitus] = useState(false);
  const [quitusSent, setQuitusSent] = useState(false);
  const [showVirement, setShowVirement] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    cotisations.getById(cotisationId)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [cotisationId]);

  useEffect(() => { load(); }, [load]);

  async function handlePaiementSave(id, data) {
    await cotisations.updatePaiement(id, data);
    load();
  }

  async function handleRelanceSave(data) {
    await relances.create(data);
    load();
  }

  async function handleVirement(data) {
    await cotisations.virementGroupe(cotisationId, data);
    load();
    onRefresh();
  }

  async function handleExtend() {
    if (!newDateFin) return;
    setSaving(true);
    try {
      await cotisations.update(cotisationId, { date_fin: newDateFin });
      setShowExtend(false);
      setNewDateFin('');
      load();
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  function openQuitus() {
    cotisations.getQuitus(detail.id).then((html) => {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }).catch((e) => alert(e.message));
  }

  async function handleSendQuitus() {
    setSendingQuitus(true);
    setQuitusSent(false);
    try {
      await cotisations.sendQuitus(detail.id);
      setQuitusSent(true);
      setTimeout(() => setQuitusSent(false), 3000);
    } catch (e) {
      alert(e.message);
    } finally {
      setSendingQuitus(false);
    }
  }

  async function handleStatutChange(statut) {
    setSaving(true);
    setShowStatutMenu(false);
    try {
      await cotisations.update(cotisationId, { statut });
      load();
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  if (!detail) return null;

  const days = daysRemaining(detail.date_fin);
  const { label: jLabel, cls: jCls } = joursLabel(days);

  const paiements = detail.paiements || [];
  const totalPaye = paiements.filter((p) => p.statut === 'Payé').reduce((s, p) => s + p.montant, 0);
  const totalAttendu = paiements.reduce((s, p) => s + p.montant, 0);
  const impayes = paiements.filter((p) => p.statut === 'En retard' || p.statut === 'En attente').length;

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                {initials(detail.prenom, detail.nom)}
              </div>
              <div>
                <h2 className="font-bold text-gray-800 text-lg">{detail.prenom} {detail.nom}</h2>
                <p className="text-sm text-gray-500">{detail.email}</p>
              </div>
            </div>
            {detail.lot_numero && (
              <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Lot {detail.lot_numero} — {detail.lot_type}</span>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-gray-800">{fmt(detail.montant_mensuel)}<span className="text-sm font-normal text-gray-500">/mois</span></p>
            <p className="text-xs text-gray-400 mt-1">{fmtDate(detail.date_debut)} → {fmtDate(detail.date_fin)}</p>
          </div>
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="relative">
            <button onClick={() => setShowStatutMenu(!showStatutMenu)}
              className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
              <StatutBadge statut={detail.statut} />
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showStatutMenu && (
              <div className="absolute top-10 left-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-44 py-1">
                {['Active', 'Expirée', 'Suspendue', 'Résiliée'].map((s) => (
                  <button key={s} onClick={() => handleStatutChange(s)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                    <StatutBadge statut={s} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {detail.statut === 'Active' && (
            <span className={`text-sm font-medium ${jCls}`}>{jLabel}</span>
          )}

          <button onClick={() => setShowExtend(!showExtend)}
            className="text-sm px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
            Prolonger
          </button>

          <button onClick={() => setShowRelanceModal(true)}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Relance
          </button>

          <button onClick={() => {
            if (confirm('Supprimer cette cotisation et tous ses paiements ?')) onDelete(cotisationId);
          }}
            className="text-sm px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
            Supprimer
          </button>
        </div>

        {/* Extend form */}
        {showExtend && (
          <div className="mt-3 flex items-center gap-3 bg-blue-50 rounded-xl p-3">
            <span className="text-sm text-gray-600 flex-shrink-0">Nouvelle date de fin :</span>
            <input type="month" value={newDateFin} onChange={(e) => setNewDateFin(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={handleExtend} disabled={saving || !newDateFin}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? '...' : 'Confirmer'}
            </button>
            <button onClick={() => setShowExtend(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Paiements calendar */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Paiements</h3>
          <div className="flex items-center gap-3">
            <div className="flex gap-3 text-xs text-gray-500">
              <span>{fmt(totalPaye)} payé</span>
              <span className="text-gray-300">|</span>
              <span>{fmt(totalAttendu)} total</span>
              {impayes > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-red-500">{impayes} impayé(s)</span>
                </>
              )}
            </div>
            {impayes > 0 && (
              <button
                onClick={() => setShowVirement(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#16304f] transition-colors font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Saisir un virement
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {paiements.map((p) => (
            <PaiementCell key={p.id} p={p} onUpdate={setSelectedPaiement} disabled={false} />
          ))}
        </div>
        {/* Legend */}
        <div className="flex gap-4 mt-3">
          {Object.entries(PAIEMENT_ICONS).map(([s, icon]) => (
            <div key={s} className="flex items-center gap-1 text-xs text-gray-500">
              <span className={`w-4 h-4 rounded text-center text-[10px] flex items-center justify-center border ${PAIEMENT_COLORS[s]}`}>{icon}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Justificatifs */}
      <div className="px-6 py-5 border-b border-gray-100">
        <PreuvesSection cotisationId={cotisationId} initialPreuves={detail.preuves || []} />
      </div>

      {/* Quitus */}
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-3">Documents</h3>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={openQuitus}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimer le quitus
          </button>
          <button
            onClick={handleSendQuitus}
            disabled={sendingQuitus}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            {sendingQuitus ? (
              <span className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            ) : quitusSent ? (
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
            {sendingQuitus ? 'Envoi...' : quitusSent ? 'Quitus envoyé !' : 'Envoyer le quitus par email'}
          </button>
        </div>
      </div>

      {/* Historique relances */}
      <div className="px-6 py-5">
        <h3 className="font-semibold text-gray-800 mb-3">Historique des relances</h3>
        {(detail.relances || []).length === 0 ? (
          <p className="text-sm text-gray-400">Aucune relance envoyée</p>
        ) : (
          <div className="space-y-2">
            {detail.relances.map((r) => (
              <div key={r.id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{r.objet}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.statut === 'Traitée' ? 'bg-green-100 text-green-600' : r.statut === 'Lue' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                      {r.statut}
                    </span>
                    <span className="text-xs text-gray-400">{fmtDate(r.sent_at)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 whitespace-pre-line">{r.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedPaiement && (
        <PaiementModal
          paiement={selectedPaiement}
          onClose={() => setSelectedPaiement(null)}
          onSave={handlePaiementSave}
        />
      )}
      {showRelanceModal && (
        <RelanceModal
          cotisation={detail}
          onClose={() => setShowRelanceModal(false)}
          onSave={handleRelanceSave}
        />
      )}
      {showVirement && (
        <VirementModal
          detail={detail}
          onClose={() => setShowVirement(false)}
          onSave={handleVirement}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function Cotisations() {
  const { user, selectedCoproId } = useAuth();
  const [list, setList] = useState([]);
  const [alertes, setAlertes] = useState({ expirant_bientot: [], impayes: [], expirees: [] });
  const [coproUsers, setCoproUsers] = useState([]);
  const [lotsData, setLotsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filter, setFilter] = useState('Tous');
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [error, setError] = useState('');

  const coproprieteId = selectedCoproId;

  const loadAll = useCallback(() => {
    if (!coproprieteId) return;
    Promise.all([
      cotisations.getAll({ copropriete_id: coproprieteId }),
      cotisations.getAlertes(coproprieteId),
      users.byResidence(coproprieteId),
    ])
      .then(([cotisationList, alerteData, userList]) => {
        setList(cotisationList);
        setAlertes(alerteData);
        const copros = userList
          .filter((u) => u.role === 'copropietaire')
          .sort((a, b) => (a.lot_numero || '').localeCompare(b.lot_numero || '', undefined, { numeric: true }));
        setCoproUsers(copros);
        // Gather unique lots from user data
        const lotSet = new Map();
        userList.forEach((u) => {
          if (u.lot_id && u.lot_numero) {
            lotSet.set(u.lot_id, { id: u.lot_id, numero: u.lot_numero, type: u.lot_type || 'Appartement' });
          }
        });
        setLotsData(Array.from(lotSet.values()));
        if (!selectedId && cotisationList.length > 0) setSelectedId(cotisationList[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [coproprieteId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleCreate(data) {
    const created = await cotisations.create(data);
    loadAll();
    return created;
  }

  async function handleDelete(id) {
    try {
      await cotisations.delete(id);
      setSelectedId(null);
      setShowDetail(false);
      loadAll();
    } catch (e) {
      alert(e.message);
    }
  }

  // Users who already have an ongoing cotisation (Active or Suspendue)
  const usersWithActiveCotisation = new Set(
    list
      .filter((c) => c.statut === 'Active' || c.statut === 'Suspendue')
      .map((c) => c.user_id)
  );
  const coproUsersAvailable = coproUsers.filter((u) => !usersWithActiveCotisation.has(u.id));

  const expirantCount30 = alertes.expirant_bientot.filter((c) => daysRemaining(c.date_fin) <= 30).length;
  const impayes30Count = alertes.impayes.length;

  const filtered = list.filter((c) => {
    if (filter === 'Actives') { if (c.statut !== 'Active') return false; }
    else if (filter === 'Expirées') { if (c.statut !== 'Expirée') return false; }
    else if (filter === 'Alertes') {
      const days = daysRemaining(c.date_fin);
      if (!((c.statut === 'Active' && days <= 60) || c.statut === 'Expirée' || c.dernier_paiement_statut === 'En retard')) return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const nom = (c.nom || '').toLowerCase();
      const prenom = (c.prenom || '').toLowerCase();
      const lot = (c.lot_numero || '').toLowerCase();
      if (!nom.includes(q) && !prenom.includes(q) && !lot.includes(q) && !(prenom + ' ' + nom).includes(q)) return false;
    }
    return true;
  });

  if (!coproprieteId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">
        Aucune résidence assignée. Contactez l'administrateur.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Alert banners */}
      {(expirantCount30 > 0 || impayes30Count > 0) && (
        <div className="flex-shrink-0 px-6 pt-4 space-y-2">
          {expirantCount30 > 0 && (
            <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-yellow-700 text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span><strong>{expirantCount30} cotisation(s)</strong> expire(nt) dans moins de 30 jours</span>
              </div>
              <button onClick={() => setFilter('Alertes')} className="text-xs text-yellow-700 underline hover:no-underline">
                Voir les alertes
              </button>
            </div>
          )}
          {impayes30Count > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-600"><strong>{impayes30Count} paiement(s)</strong> en retard</span>
            </div>
          )}
        </div>
      )}

      {/* Main split layout */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-0 mt-4 px-4 sm:px-6 pb-6">
        {/* Left panel */}
        <div className={`w-full lg:w-[340px] lg:flex-shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden lg:mr-4 ${showDetail ? 'hidden lg:flex' : 'flex'}`}>
          {/* Header */}
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold text-gray-800">Cotisations</h1>
              <div className="flex items-center gap-2">
                {alertes.expirant_bientot.length > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                    {alertes.expirant_bientot.length} expirent bientôt
                  </span>
                )}
                {alertes.impayes.length > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                    {alertes.impayes.length} impayés
                  </span>
                )}
              </div>
            </div>
            {/* Filters */}
            <div className="flex gap-1 mb-2">
              {['Tous', 'Actives', 'Expirées', 'Alertes'].map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {f}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom, prénom ou lot…"
                className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
            ) : error ? (
              <p className="px-4 py-6 text-sm text-red-500">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">Aucune cotisation</p>
            ) : (
              filtered.map((c) => (
                <CotisationRow
                  key={c.id}
                  c={c}
                  isSelected={c.id === selectedId}
                  onClick={() => { setSelectedId(c.id); setShowDetail(true); }}
                />
              ))
            )}
          </div>

          {/* Footer: new button */}
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => setShowNewModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouvelle cotisation
            </button>
          </div>
        </div>

        {/* Right panel: detail */}
        <div className={`flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${!showDetail ? 'hidden lg:block' : 'block'}`}>
          {/* Back button on mobile */}
          {showDetail && (
            <button
              onClick={() => setShowDetail(false)}
              className="lg:hidden flex items-center gap-2 px-4 pt-4 pb-0 text-sm text-blue-600 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Retour
            </button>
          )}
          {selectedId ? (
            <CotisationDetail
              key={selectedId}
              cotisationId={selectedId}
              coproprieteId={coproprieteId}
              onRefresh={loadAll}
              onDelete={handleDelete}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg className="w-12 h-12 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Sélectionnez une cotisation</p>
            </div>
          )}
        </div>
      </div>

      {/* New cotisation modal */}
      {showNewModal && (
        <NewCotisationModal
          coproprieteId={coproprieteId}
          coproUsers={coproUsersAvailable}
          onClose={() => setShowNewModal(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  );
}

export default Cotisations;
