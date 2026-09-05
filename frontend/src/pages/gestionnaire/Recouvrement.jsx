import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { recouvrement as recApi } from '../../api/client';

const TYPE_COLORS = {
  'Rappel':          'bg-blue-100 text-blue-700',
  'Relance':         'bg-orange-100 text-orange-700',
  'Mise en demeure': 'bg-red-100 text-red-700',
};

const CANAL_ICONS = {
  'Email':    '✉️',
  'Lettre':   '📄',
  'WhatsApp': '💬',
};

const STATUT_COLORS = {
  'Envoyé':     'bg-green-100 text-green-700',
  'À déposer':  'bg-yellow-100 text-yellow-700',
  'Déposé':     'bg-gray-100 text-gray-600',
};

function joursRetard(premierMoisImpaye) {
  if (!premierMoisImpaye) return 0;
  const [y, m] = premierMoisImpaye.split('-').map(Number);
  const debut = new Date(y, m - 1, 1);
  return Math.max(0, Math.floor((Date.now() - debut) / 86400000));
}

function generateLettre({ copro, user, type, montant, adresse, gestionnaire }) {
  const typeLabel = { 'Rappel': 'RAPPEL DE PAIEMENT', 'Relance': 'RELANCE POUR IMPAYÉ', 'Mise en demeure': 'MISE EN DEMEURE' }[type] || type;
  const montantStr = montant ? Number(montant).toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD' : '—';
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const body = {
    'Rappel': `Nous avons l'honneur de vous contacter concernant le règlement de vos cotisations de copropriété pour la résidence ${copro}.\n\nNous vous informons qu'un montant de ${montantStr} reste impayé à ce jour. Ce montant correspond aux cotisations dues à la date du ${today} uniquement.\n\nNous vous saurions gré de bien vouloir procéder au règlement de cette somme dans les meilleurs délais. Si vous avez déjà effectué ce paiement, nous vous prions de ne pas tenir compte de ce courrier.\n\nRestant à votre disposition pour tout renseignement complémentaire,`,
    'Relance': `Malgré notre précédent courrier resté sans suite, nous constatons que votre cotisation d'un montant de ${montantStr} pour la résidence ${copro} demeure impayée à ce jour. Ce montant correspond aux cotisations dues à la date du ${today} uniquement.\n\nNous vous demandons instamment de procéder au règlement de cette somme dans un délai de 15 jours à compter de la réception du présent courrier.\n\nPassé ce délai, nous nous verrons dans l'obligation d'engager les démarches nécessaires au recouvrement de cette créance.\n\nNous espérons qu'une telle procédure ne sera pas nécessaire et restons confiants en votre coopération,`,
    'Mise en demeure': `Par la présente, nous vous mettons en demeure de procéder au règlement de la somme de ${montantStr} due au titre de vos cotisations de copropriété pour la résidence ${copro}. Ce montant correspond aux cotisations impayées à la date du ${today} uniquement.\n\nCette mise en demeure formelle vous est adressée conformément à la réglementation en vigueur en matière de copropriété.\n\nVous disposez d'un délai de 8 jours à compter de la réception du présent courrier pour régulariser votre situation. Passé ce délai, nous nous verrons contraints de saisir les instances compétentes pour obtenir le recouvrement judiciaire de cette créance, et ce à vos frais.\n\nNous vous invitons à prendre contact avec le syndic sans délai,`,
  }[type] || '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${typeLabel} — ${user.prenom} ${user.nom}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #1a1a1a; background: white; }
  .page { max-width: 210mm; margin: 0 auto; padding: 16mm 20mm 14mm 22mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #1e3a5f; }
  .logo { font-size: 16pt; font-weight: bold; color: #1e3a5f; }
  .logo span { color: #3b82f6; }
  .logo-sub { font-size: 8pt; color: #6b7280; }
  .sender-block { text-align: right; font-size: 9pt; color: #374151; line-height: 1.5; }
  .dest-block { margin: 14px 0 12px; padding: 10px 14px; border-left: 4px solid #1e3a5f; background: #f8fafc; font-size: 10pt; line-height: 1.6; }
  .date-lieu { text-align: right; font-size: 10pt; color: #374151; margin-bottom: 12px; }
  .ref { font-size: 8.5pt; color: #6b7280; margin-bottom: 10px; }
  .type-badge { display: inline-block; padding: 3px 12px; border-radius: 4px; font-size: 9.5pt; font-weight: bold; letter-spacing: 0.05em; margin-bottom: 10px; }
  .badge-rappel { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
  .badge-relance { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }
  .badge-mise { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
  .objet { font-size: 10.5pt; font-weight: bold; margin-bottom: 10px; }
  .salut { margin-bottom: 10px; font-size: 10.5pt; }
  .body-text { font-size: 10.5pt; line-height: 1.7; margin-bottom: 14px; white-space: pre-wrap; }
  .montant-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 16px; margin: 12px 0; background: #f9fafb; display: flex; align-items: center; justify-content: space-between; }
  .montant-label { font-size: 8.5pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; }
  .montant-val { font-size: 15pt; font-weight: bold; color: #1e3a5f; }
  .montant-note { font-size: 7.5pt; color: #9ca3af; margin-top: 2px; }
  .rib-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 16px; margin: 10px 0; background: #f0f9ff; }
  .rib-title { font-size: 9pt; font-weight: bold; color: #1e3a5f; margin-bottom: 8px; }
  .rib-cols { display: flex; gap: 24px; flex-wrap: wrap; }
  .rib-section { flex: 1; min-width: 140px; }
  .rib-section-title { font-size: 8pt; font-weight: bold; color: #374151; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
  .rib-row { display: flex; gap: 6px; font-size: 8.5pt; color: #374151; margin-top: 3px; }
  .rib-key { color: #6b7280; min-width: 60px; flex-shrink: 0; }
  .rib-val { font-weight: bold; font-family: 'Courier New', monospace; }
  .signature { margin-top: 16px; }
  .sign-title { font-size: 10pt; color: #374151; margin-bottom: 4px; }
  .sign-name { font-size: 10.5pt; font-weight: bold; }
  .sign-role { font-size: 9pt; color: #6b7280; }
  .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #9ca3af; text-align: center; }
  .print-btn { position: fixed; top: 12px; right: 20px; background: #1e3a5f; color: white; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; font-family: system-ui, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 100; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page { padding: 12mm 18mm 12mm 20mm; }
    .print-btn { display: none; }
  }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Imprimer / PDF</button>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">Syndic<span>Pro</span></div>
      <div class="logo-sub">Gestion de copropriété</div>
    </div>
    <div class="sender-block">
      <strong>${copro}</strong><br>
      ${adresse || ''}<br>
      Syndic : ${gestionnaire}
    </div>
  </div>

  <div class="date-lieu">Casablanca, le ${today}</div>

  <div class="dest-block">
    <strong>${user.prenom} ${user.nom}</strong><br>
    ${user.lot_numero ? `Lot N° ${user.lot_numero}` : ''}<br>
    Résidence ${copro}
  </div>

  <div class="ref">Réf : REC-${type.substring(0,3).toUpperCase()}-${user.id}-${Date.now().toString().slice(-6)}</div>

  <div class="type-badge ${type === 'Rappel' ? 'badge-rappel' : type === 'Relance' ? 'badge-relance' : 'badge-mise'}">${typeLabel}</div>

  <div class="objet">Objet : ${typeLabel} — Cotisations de copropriété</div>

  <div class="salut">Madame, Monsieur ${user.nom},</div>

  <div class="body-text">${body}</div>

  <div class="montant-box">
    <div>
      <div class="montant-label">Montant dû à ce jour</div>
      <div class="montant-val">${montantStr}</div>
      <div class="montant-note">Cotisations impayées au ${today} uniquement</div>
    </div>
  </div>

  <div class="rib-box">
    <div class="rib-title">Modalités de règlement</div>
    <div class="rib-cols">
      <div class="rib-section">
        <div class="rib-section-title">Par virement bancaire</div>
        <div class="rib-row"><span class="rib-key">Banque :</span><span class="rib-val">CIH BANK</span></div>
        <div class="rib-row"><span class="rib-key">Titulaire :</span><span class="rib-val">PROPNEX SARLAU</span></div>
        <div class="rib-row"><span class="rib-key">RIB :</span><span class="rib-val">230 780 6472792221032000 09</span></div>
        <div class="rib-row"><span class="rib-key">SWIFT :</span><span class="rib-val">CIHMMAMC</span></div>
      </div>
      <div class="rib-section">
        <div class="rib-section-title">Par chèque</div>
        <div class="rib-row"><span class="rib-key">À l'ordre de :</span><span class="rib-val">PROPNEX SARLAU</span></div>
        <div class="rib-row" style="margin-top:6px;font-size:8pt;color:#6b7280;">Remettre le chèque au gestionnaire de votre résidence ou l'envoyer à l'adresse du syndic.</div>
      </div>
    </div>
  </div>

  <div class="signature">
    <div class="sign-title">Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</div>
    <br>
    <div class="sign-name">${gestionnaire}</div>
    <div class="sign-role">Gestionnaire — Résidence ${copro}</div>
  </div>

  <div class="footer">SyndicPro · Gestion de copropriété · syndicpro.propnex.ma</div>
</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function ActionBadge({ action, onMarkDeposee, loading }) {
  const isLettrePending = action.canal === 'Lettre' && action.statut === 'À déposer';
  return (
    <div className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm">{CANAL_ICONS[action.canal]}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[action.type] || 'bg-gray-100 text-gray-600'}`}>{action.type}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_COLORS[action.statut] || 'bg-gray-100 text-gray-500'}`}>{action.statut}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {new Date(action.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {action.by_prenom ? ` · par ${action.by_prenom} ${action.by_nom}` : ''}
          </div>
        </div>
      </div>
      {isLettrePending && (
        <button
          disabled={loading}
          onClick={() => onMarkDeposee(action.id)}
          className="text-xs font-medium text-green-600 hover:text-green-800 border border-green-200 rounded px-2 py-1 whitespace-nowrap disabled:opacity-50"
        >
          ✓ Déposée
        </button>
      )}
    </div>
  );
}

function DetailPanel({ impayeur, copro, coproprieteId, gestNom, onClose, onActionDone }) {
  const [sendType, setSendType] = useState('Rappel');
  const [sending, setSending] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [logging, setLogging] = useState(false);
  const [marking, setMarking] = useState(false);
  const [actions, setActions] = useState(impayeur.actions || []);
  const [err, setErr] = useState(null);

  const refreshActions = async () => {
    try {
      const fresh = await recApi.getActions(coproprieteId, impayeur.id);
      setActions(fresh);
    } catch {}
  };

  const sendEmail = async () => {
    setSending(true); setErr(null);
    try {
      await recApi.sendEmail({
        copropriete_id: coproprieteId,
        user_id: impayeur.id,
        type: sendType,
        montant_du: impayeur.montant_total_du,
      });
      await refreshActions();
      onActionDone();
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  };

  const sendWhatsApp = async () => {
    setSendingWa(true); setErr(null);
    try {
      await recApi.sendWhatsApp({
        copropriete_id: coproprieteId,
        user_id: impayeur.id,
        montant_du: impayeur.montant_total_du,
        retard: `${impayeur.nb_mois_impaye} mois`,
      });
      await refreshActions();
      onActionDone();
    } catch (e) { setErr(e.message); }
    finally { setSendingWa(false); }
  };

  const logLettre = async () => {
    setLogging(true); setErr(null);
    try {
      await recApi.logAction({
        copropriete_id: coproprieteId,
        user_id: impayeur.id,
        type: sendType,
        canal: 'Lettre',
        montant_du: impayeur.montant_total_du,
      });
      generateLettre({
        copro: copro.nom,
        user: impayeur,
        type: sendType,
        montant: impayeur.montant_total_du,
        adresse: copro.adresse,
        gestionnaire: gestNom,
      });
      await refreshActions();
      onActionDone();
    } catch (e) { setErr(e.message); }
    finally { setLogging(false); }
  };

  const markDeposee = async (actionId) => {
    setMarking(true);
    try {
      await recApi.markDeposee(actionId);
      await refreshActions();
      onActionDone();
    } catch (e) { setErr(e.message); }
    finally { setMarking(false); }
  };

  const jours = joursRetard(impayeur.premier_mois_impaye);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <aside className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold">
              {impayeur.prenom?.[0]}{impayeur.nom?.[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{impayeur.prenom} {impayeur.nom}</p>
              <p className="text-xs text-gray-500">{impayeur.lot_numero ? `Lot ${impayeur.lot_numero}` : 'Sans lot'} · {impayeur.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Montant dû */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-red-500 font-medium uppercase tracking-wide">Montant dû</p>
              <p className="text-2xl font-bold text-red-700 mt-0.5">
                {impayeur.montant_total_du.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
              </p>
              <p className="text-xs text-red-400 mt-1">{impayeur.nb_mois_impaye} mois · depuis {jours} jours</p>
            </div>
            {impayeur.telephone && (
              <a href={`tel:${impayeur.telephone}`} className="flex flex-col items-center gap-1 text-blue-600 hover:text-blue-800">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                <span className="text-xs font-medium">{impayeur.telephone}</span>
              </a>
            )}
          </div>

          {/* Envoyer une action */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Nouvelle action</p>
            <div className="flex gap-2 mb-3">
              {['Rappel', 'Relance', 'Mise en demeure'].map((t) => (
                <button key={t} onClick={() => setSendType(t)}
                  className={`flex-1 text-xs py-1.5 rounded-lg font-medium border transition-colors ${sendType === t ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {t}
                </button>
              ))}
            </div>
            {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
            <div className="flex gap-2">
              <button onClick={sendEmail} disabled={sending}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {sending ? '…' : <>✉️ Email</>}
              </button>
              <button onClick={logLettre} disabled={logging}
                className="flex-1 flex items-center justify-center gap-1.5 bg-gray-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {logging ? '…' : <>📄 Lettre PDF</>}
              </button>
              {sendType === 'Rappel' && impayeur.telephone && (
                <button onClick={sendWhatsApp} disabled={sendingWa}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {sendingWa ? '…' : <>💬 WhatsApp</>}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">La lettre s'ouvre dans un nouvel onglet pour impression. L'action est enregistrée automatiquement.</p>
          </div>

          {/* Historique */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Historique ({actions.length})</p>
            {actions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune action enregistrée</p>
            ) : (
              <div className="space-y-2">
                {actions.map((a) => (
                  <ActionBadge key={a.id} action={a} onMarkDeposee={markDeposee} loading={marking} />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Recouvrement() {
  const { user, selectedCoproId, coproprietes } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterType, setFilterType] = useState('Tous');

  const copro = coproprietes?.find((c) => c.id === selectedCoproId) || { nom: '', adresse: '' };

  const load = useCallback(async () => {
    if (!selectedCoproId) { setLoading(false); return; }
    setLoading(true);
    try {
      const d = await recApi.getDashboard(selectedCoproId);
      setData(d);
    } catch {}
    finally { setLoading(false); }
  }, [selectedCoproId]);

  useEffect(() => { load(); }, [load]);

  if (!selectedCoproId) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">Aucune résidence sélectionnée.</div>;
  }

  const impayeurs = data?.impayeurs || [];

  const filtered = filterType === 'Tous' ? impayeurs : impayeurs.filter((u) => {
    const lastType = u.derniere_action?.type;
    if (filterType === 'Aucun contact') return !u.derniere_action;
    return lastType === filterType;
  });

  const getEscaladeColor = (jours) => {
    if (jours >= 60) return 'text-red-600 font-bold';
    if (jours >= 30) return 'text-orange-500 font-semibold';
    return 'text-gray-600';
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Recouvrement</h1>
        <p className="text-sm text-gray-500 mt-1">{copro.nom}</p>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total impayé</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {data.total_du.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-gray-400">MAD</span>
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Débiteurs</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{data.nb_debiteurs}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Sans contact</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">
              {impayeurs.filter((u) => !u.derniere_action).length}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['Tous', 'Aucun contact', 'Rappel', 'Relance', 'Mise en demeure'].map((f) => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${filterType === f ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-green-700 font-medium">Aucun impayé pour cette résidence</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50">
              <tr>
                {['Copropriétaire', 'Lot', 'Montant dû', 'Retard', 'Dernière action', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => {
                const jours = joursRetard(u.premier_mois_impaye);
                return (
                  <tr key={u.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(u)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {u.prenom?.[0]}{u.nom?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{u.prenom} {u.nom}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {u.lot_numero ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {u.lot_numero}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-red-600">
                        {u.montant_total_du.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                      </span>
                      <p className="text-xs text-gray-400">{u.nb_mois_impaye} mois</p>
                    </td>
                    <td className={`px-4 py-3 text-sm ${getEscaladeColor(jours)}`}>{jours}j</td>
                    <td className="px-4 py-3">
                      {u.derniere_action ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{CANAL_ICONS[u.derniere_action.canal]}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[u.derniere_action.type] || 'bg-gray-100 text-gray-600'}`}>
                            {u.derniere_action.type}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${STATUT_COLORS[u.derniere_action.statut] || ''}`}>
                            {u.derniere_action.statut}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-orange-500 font-medium">Aucun contact</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(u); }}
                        className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                      >
                        Gérer →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          impayeur={selected}
          copro={copro}
          coproprieteId={selectedCoproId}
          gestNom={`${user.prenom} ${user.nom}`}
          onClose={() => setSelected(null)}
          onActionDone={load}
        />
      )}
    </div>
  );
}

export default Recouvrement;
