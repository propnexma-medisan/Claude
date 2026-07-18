const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendRelance, sendQuitus } = require('../services/email');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `preuve-${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    cb(null, ok);
  },
});

const APP_URL = process.env.APP_URL || 'https://syndicpro.propnex.ma';

// Helper: generate list of months between date_debut and date_fin (inclusive)
function generateMonths(dateDebut, dateFin) {
  const months = [];
  const start = new Date(dateDebut + '-01');
  const end = new Date(dateFin + '-01');
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

// Helper: parse YYYY-MM-DD or YYYY-MM to YYYY-MM
function toYYYYMM(dateStr) {
  if (!dateStr) return null;
  return dateStr.substring(0, 7);
}

// ─── Quitus HTML generator ───────────────────────────────────────────────────

function htmlQuitus(cotisation, paiements, copropriete, gestionnaire) {
  const dateDoc = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  const fmtPeriod = (d) => {
    if (!d) return '—';
    const s = d.length === 7 ? d : d.substring(0, 7);
    const [y, m] = s.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };
  const fmtMAD = (n) => (n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
  const allPaiements = paiements || [];
  // montant_regle = actual cash received for that month (may differ from montant for partial payments)
  const totalPaye = allPaiements.reduce((s, p) => {
    if (p.statut === 'Payé') return s + (p.montant_regle !== null && p.montant_regle !== undefined ? p.montant_regle : p.montant || 0);
    if (p.statut === 'Partiel' && p.montant_regle) return s + p.montant_regle;
    return s;
  }, 0);
  const paiementsPayes = allPaiements.filter((p) => p.statut === 'Payé');
  const totalAttendu = allPaiements.reduce((s, p) => s + (p.montant || 0), 0);
  const soldeTotalRestant = Math.max(0, totalAttendu - totalPaye);
  const estSolde = totalPaye >= totalAttendu && allPaiements.length > 0;
  const nomComplet = `${cotisation.prenom || ''} ${cotisation.nom || ''}`.trim();
  const gestionnaireNom = gestionnaire ? `${gestionnaire.prenom || ''} ${gestionnaire.nom || ''}`.trim() : 'Le Gestionnaire';
  const titreDoc = estSolde ? 'Quitus de Cotisation' : 'Reçu de Paiement Partiel';
  const refPrefix = estSolde ? 'QUI' : 'RPP';
  const accentColor = estSolde ? '#1e3a5f' : '#b45309';
  const totalBoxBg = estSolde ? '#1e3a5f' : '#92400e';

  const attestationText = estSolde
    ? `M./Mme <strong>${nomComplet}</strong>${cotisation.lot_numero ? `, propriétaire du lot N°&nbsp;<strong>${cotisation.lot_numero}</strong>` : ''},
    est à jour de ses cotisations de charges communes pour la période allant
    de <strong>${fmtPeriod(cotisation.date_debut)}</strong> à <strong>${fmtPeriod(cotisation.date_fin)}</strong>.`
    : `M./Mme <strong>${nomComplet}</strong>${cotisation.lot_numero ? `, propriétaire du lot N°&nbsp;<strong>${cotisation.lot_numero}</strong>` : ''},
    a réglé <strong>${paiementsPayes.length} mois</strong> de cotisations sur <strong>${allPaiements.length} mois</strong> prévus
    pour la période allant de <strong>${fmtPeriod(cotisation.date_debut)}</strong> à <strong>${fmtPeriod(cotisation.date_fin)}</strong>.
    <br><br>
    <strong style="color:#b45309;">⚠ Solde restant dû : ${fmtMAD(soldeTotalRestant)}</strong> — Ce document ne constitue pas un quitus et ne libère pas le copropriétaire de ses obligations.`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${titreDoc} – ${nomComplet}</title>
  <style>
    @page { size: A4; margin: 12mm 18mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, Georgia, serif; font-size: 10.5pt; color: #1a1a2e; background: white; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8pt; border-bottom: 2pt solid ${accentColor}; margin-bottom: 10pt; }
    .syndic-name { font-size: 14pt; font-weight: bold; color: ${accentColor}; }
    .syndic-sub { font-size: 9pt; color: #6b7280; margin-top: 2pt; }
    .ref-label { font-size: 8pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5pt; }
    .ref-value { font-size: 9.5pt; font-weight: bold; color: ${accentColor}; }
    .doc-title { text-align: center; margin: 10pt 0 8pt; }
    .doc-title h1 { font-size: 15pt; font-weight: bold; color: ${accentColor}; text-transform: uppercase; letter-spacing: 2pt; }
    .doc-title .underline { height: 2pt; background: ${accentColor}; width: 140pt; margin: 5pt auto 0; }
    .attestation { background: ${estSolde ? '#f0f4f8' : '#fef3c7'}; border-left: 4pt solid ${accentColor}; padding: 9pt 13pt; margin: 10pt 0; font-size: 10.5pt; line-height: 1.6; }
    .details-box { border: 1pt solid #d1d5db; border-radius: 4pt; padding: 8pt 13pt; margin: 8pt 0; }
    .details-box h3 { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5pt; color: #6b7280; margin-bottom: 6pt; padding-bottom: 4pt; border-bottom: 1pt solid #e5e7eb; }
    .detail-row { display: flex; justify-content: space-between; padding: 3pt 0; font-size: 10pt; border-bottom: 0.5pt solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #4b5563; }
    .detail-value { font-weight: bold; color: #1a1a2e; }
    .total-box { background: ${totalBoxBg}; color: white; padding: 8pt 13pt; border-radius: 4pt; margin: 8pt 0; display: flex; justify-content: space-between; align-items: center; }
    .total-label { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5pt; opacity: 0.8; }
    .total-amount { font-size: 14pt; font-weight: bold; }
    .signature-section { margin-top: 14pt; display: flex; justify-content: space-between; }
    .sig-block { width: 45%; }
    .sig-title { font-size: 9pt; font-weight: bold; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 3pt; }
    .sig-date { font-size: 9pt; color: #4b5563; margin-bottom: 28pt; }
    .sig-line { border-top: 1pt solid #9ca3af; padding-top: 4pt; font-size: 9pt; color: #4b5563; }
    .footer { margin-top: 10pt; padding-top: 6pt; border-top: 0.5pt solid #e5e7eb; text-align: center; font-size: 8pt; color: #9ca3af; }
    .print-btn { position: fixed; top: 10px; right: 10px; padding: 8px 16px; background: ${accentColor}; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; z-index: 100; font-family: Arial, sans-serif; }
    @media print { .print-btn { display: none !important; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Imprimer</button>

  <div class="header">
    <div>
      <div class="syndic-name">🏛 SyndicPro</div>
      <div class="syndic-sub">Gestion de Copropriété</div>
      ${copropriete ? `<div class="syndic-sub" style="margin-top:6pt;color:#374151;">${copropriete.nom || ''}</div>` : ''}
      ${copropriete && copropriete.adresse ? `<div class="syndic-sub">${copropriete.adresse}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div class="ref-label">Document N°</div>
      <div class="ref-value">${refPrefix}-${String(cotisation.id).padStart(5, '0')}</div>
      <div class="ref-label" style="margin-top:6pt;">Date d'émission</div>
      <div class="ref-value">${dateDoc}</div>
    </div>
  </div>

  <div class="doc-title">
    <h1>${titreDoc}</h1>
    <div class="underline"></div>
  </div>

  <div class="attestation">
    Je soussigné(e), <strong>${gestionnaireNom}</strong>, Syndic/Gestionnaire de la résidence
    <strong>${copropriete ? copropriete.nom : ''}</strong>, certifie par la présente que&nbsp;:
    <br><br>
    ${attestationText}
  </div>

  <div class="details-box">
    <h3>Détails de la cotisation</h3>
    ${cotisation.lot_numero ? `<div class="detail-row"><span class="detail-label">Lot</span><span class="detail-value">N° ${cotisation.lot_numero}${cotisation.lot_type ? ` — ${cotisation.lot_type}` : ''}</span></div>` : ''}
    <div class="detail-row"><span class="detail-label">Copropriétaire</span><span class="detail-value">${nomComplet}</span></div>
    <div class="detail-row"><span class="detail-label">Résidence</span><span class="detail-value">${copropriete ? copropriete.nom : '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Période</span><span class="detail-value">${fmtPeriod(cotisation.date_debut)} → ${fmtPeriod(cotisation.date_fin)}</span></div>
    <div class="detail-row"><span class="detail-label">Montant mensuel</span><span class="detail-value">${fmtMAD(cotisation.montant_mensuel)}</span></div>
    <div class="detail-row"><span class="detail-label">Total attendu</span><span class="detail-value">${fmtMAD(totalAttendu)}</span></div>
    <div class="detail-row"><span class="detail-label">Mois réglés</span><span class="detail-value" style="color:${estSolde ? '#16a34a' : '#b45309'};">${paiementsPayes.length} / ${allPaiements.length} mois</span></div>
    ${!estSolde ? `<div class="detail-row"><span class="detail-label">Solde restant dû</span><span class="detail-value" style="color:#dc2626;">${fmtMAD(soldeTotalRestant)}</span></div>` : ''}
    ${cotisation.notes ? `<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${cotisation.notes}</span></div>` : ''}
  </div>

  <div class="total-box">
    <span class="total-label">Total réglé</span>
    <span class="total-amount">${fmtMAD(totalPaye)}${!estSolde ? ` <span style="font-size:10pt;opacity:0.7;">/ ${fmtMAD(totalAttendu)}</span>` : ''}</span>
  </div>

  <div class="signature-section">
    <div class="sig-block">
      <div class="sig-title">Le Syndic / Gestionnaire</div>
      <div class="sig-date">Fait à ______________________, le ${dateDoc}</div>
      <div class="sig-line">Signature et cachet</div>
    </div>
    <div class="sig-block" style="text-align:right;">
      <div class="sig-title">Le Copropriétaire</div>
      <div class="sig-date">Reçu le ______________________</div>
      <div class="sig-line">Signature pour acquit</div>
    </div>
  </div>

  <div class="footer">
    Ce document est généré automatiquement par SyndicPro – Gestion de Copropriété
    ${copropriete ? `· Résidence ${copropriete.nom}` : ''}
  </div>
</body>
</html>`;
}

// ─── ALERTES ── must be BEFORE /:id ──────────────────────────────────────────
// GET /api/cotisations/alertes?copropriete_id=X
router.get('/cotisations/alertes', authenticate, (req, res) => {
  try {
    const { copropriete_id } = req.query;
    if (!copropriete_id) return res.status(400).json({ error: 'copropriete_id requis' });

    const today = new Date().toISOString().slice(0, 10);
    const in60days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Cotisations expiring within 60 days (Active)
    const expirantBientot = db.prepare(`
      SELECT c.*, u.nom, u.prenom, u.email,
        l.numero as lot_numero,
        CAST((julianday(c.date_fin) - julianday(?)) AS INTEGER) as jours_restants
      FROM cotisations c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN lots l ON c.lot_id = l.id
      WHERE c.copropriete_id = ?
        AND c.statut = 'Active'
        AND c.date_fin <= ?
        AND c.date_fin >= ?
      ORDER BY c.date_fin ASC
    `).all(today, copropriete_id, in60days, today);

    // Cotisations with late payments
    const impayes = db.prepare(`
      SELECT DISTINCT c.*, u.nom, u.prenom, u.email,
        l.numero as lot_numero,
        COUNT(cp.id) as nb_impayes
      FROM cotisations c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN lots l ON c.lot_id = l.id
      JOIN cotisation_paiements cp ON cp.cotisation_id = c.id
      WHERE c.copropriete_id = ?
        AND cp.statut IN ('En retard','En attente')
        AND cp.mois < ?
        AND c.statut = 'Active'
      GROUP BY c.id
      ORDER BY nb_impayes DESC
    `).all(copropriete_id, today.substring(0, 7));

    // Expired cotisations
    const expirees = db.prepare(`
      SELECT c.*, u.nom, u.prenom, u.email,
        l.numero as lot_numero
      FROM cotisations c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN lots l ON c.lot_id = l.id
      WHERE c.copropriete_id = ?
        AND c.statut = 'Expirée'
      ORDER BY c.date_fin DESC
      LIMIT 10
    `).all(copropriete_id);

    res.json({ expirant_bientot: expirantBientot, impayes, expirees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── COTISATIONS ─────────────────────────────────────────────────────────────

// GET /api/cotisations?copropriete_id=X
router.get('/cotisations', authenticate, (req, res) => {
  try {
    const { copropriete_id } = req.query;
    if (!copropriete_id) return res.status(400).json({ error: 'copropriete_id requis' });

    const canSeeBureau = req.user.role === 'membre_bureau' ||
      (req.user.role === 'copropietaire' && req.user.is_membre_bureau);
    if (canSeeBureau && req.user.copropriete_id !== parseInt(copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé à cette résidence' });
    }

    let rows;
    // personal view: bureau users without scope=bureau, or plain copropriétaires
    // admin/gestionnaire always see all cotisations (isPersonalView = false)
    const isPersonalView = canSeeBureau
      ? req.query.scope !== 'bureau'
      : req.user.role === 'copropietaire';
    if (isPersonalView) {
      rows = db.prepare(`
        SELECT c.*,
          u.nom, u.prenom, u.email, u.telephone,
          l.numero as lot_numero, l.type as lot_type,
          (SELECT cp.statut FROM cotisation_paiements cp
            WHERE cp.cotisation_id = c.id ORDER BY cp.mois DESC LIMIT 1) as dernier_paiement_statut,
          (SELECT cp.mois FROM cotisation_paiements cp
            WHERE cp.cotisation_id = c.id ORDER BY cp.mois DESC LIMIT 1) as dernier_paiement_mois
        FROM cotisations c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN lots l ON c.lot_id = l.id
        WHERE c.copropriete_id = ? AND c.user_id = ?
        ORDER BY c.date_debut DESC
      `).all(copropriete_id, req.user.id);
    } else {
      rows = db.prepare(`
        SELECT c.*,
          u.nom, u.prenom, u.email, u.telephone,
          l.numero as lot_numero, l.type as lot_type,
          (SELECT cp.statut FROM cotisation_paiements cp
            WHERE cp.cotisation_id = c.id ORDER BY cp.mois DESC LIMIT 1) as dernier_paiement_statut,
          (SELECT cp.mois FROM cotisation_paiements cp
            WHERE cp.cotisation_id = c.id ORDER BY cp.mois DESC LIMIT 1) as dernier_paiement_mois
        FROM cotisations c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN lots l ON c.lot_id = l.id
        WHERE c.copropriete_id = ?
        ORDER BY c.date_debut DESC
      `).all(copropriete_id);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cotisations/:id
router.get('/cotisations/:id', authenticate, (req, res) => {
  try {
    const cotisation = db.prepare(`
      SELECT c.*,
        u.nom, u.prenom, u.email, u.telephone,
        l.numero as lot_numero, l.type as lot_type
      FROM cotisations c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN lots l ON c.lot_id = l.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!cotisation) return res.status(404).json({ error: 'Cotisation introuvable' });

    // Restrict copropietaire to their own
    if (req.user.role === 'copropietaire' && cotisation.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const paiements = db.prepare(`
      SELECT * FROM cotisation_paiements
      WHERE cotisation_id = ?
      ORDER BY mois ASC
    `).all(req.params.id);

    const preuves = db.prepare(
      'SELECT id, filename, original_name, mimetype, created_at FROM cotisation_preuves WHERE cotisation_id = ? ORDER BY created_at ASC'
    ).all(req.params.id).map((pr) => ({ ...pr, url: `/api/uploads/${pr.filename}` }));

    const relancesData = db.prepare(`
      SELECT * FROM relances
      WHERE cotisation_id = ?
      ORDER BY sent_at DESC
    `).all(req.params.id);

    res.json({ ...cotisation, paiements, preuves, relances: relancesData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cotisations
router.post('/cotisations', authenticate, (req, res) => {
  try {
    if (req.user.role === 'copropietaire' || req.user.role === 'membre_bureau') return res.status(403).json({ error: 'Accès refusé' });

    const { copropriete_id, user_id, lot_id, montant_mensuel, date_debut, date_fin, notes } = req.body;
    if (!copropriete_id || !user_id || !montant_mensuel || !date_debut || !date_fin) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    // Normalize to YYYY-MM-DD
    const debutNorm = date_debut.length === 7 ? date_debut + '-01' : date_debut;
    const finNorm = date_fin.length === 7 ? date_fin + '-01' : date_fin;
    const debutYM = toYYYYMM(debutNorm);
    const finYM = toYYYYMM(finNorm);

    const result = db.prepare(`
      INSERT INTO cotisations (copropriete_id, user_id, lot_id, montant_mensuel, date_debut, date_fin, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(copropriete_id, user_id, lot_id || null, montant_mensuel, debutNorm, finNorm, notes || null, req.user.id);

    const cotisationId = result.lastInsertRowid;

    // Auto-generate paiements for each month
    const months = generateMonths(debutYM, finYM);
    const insertPaiement = db.prepare(`
      INSERT OR IGNORE INTO cotisation_paiements (cotisation_id, mois, montant, statut)
      VALUES (?, ?, ?, 'En attente')
    `);
    for (const mois of months) {
      insertPaiement.run(cotisationId, mois, montant_mensuel);
    }

    const cotisation = db.prepare('SELECT * FROM cotisations WHERE id = ?').get(cotisationId);
    const paiements = db.prepare('SELECT * FROM cotisation_paiements WHERE cotisation_id = ? ORDER BY mois ASC').all(cotisationId);

    res.status(201).json({ ...cotisation, paiements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/cotisations/:id
router.put('/cotisations/:id', authenticate, (req, res) => {
  try {
    if (req.user.role === 'copropietaire' || req.user.role === 'membre_bureau') return res.status(403).json({ error: 'Accès refusé' });

    const existing = db.prepare('SELECT * FROM cotisations WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Cotisation introuvable' });

    const { statut, montant_mensuel, notes, date_fin } = req.body;
    const newStatut = statut !== undefined ? statut : existing.statut;
    const newMontant = montant_mensuel !== undefined ? montant_mensuel : existing.montant_mensuel;
    const newNotes = notes !== undefined ? notes : existing.notes;
    let newDateFin = date_fin !== undefined ? date_fin : existing.date_fin;
    if (newDateFin && newDateFin.length === 7) newDateFin = newDateFin + '-01';

    db.prepare(`
      UPDATE cotisations SET statut = ?, montant_mensuel = ?, notes = ?, date_fin = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatut, newMontant, newNotes, newDateFin, req.params.id);

    // If date_fin was extended, generate new paiements for new months
    if (date_fin !== undefined) {
      const oldFinYM = toYYYYMM(existing.date_fin);
      const newFinYM = toYYYYMM(newDateFin);
      if (newFinYM > oldFinYM) {
        // Start from month after old fin
        const afterOld = new Date(oldFinYM + '-01');
        afterOld.setMonth(afterOld.getMonth() + 1);
        const afterOldYM = `${afterOld.getFullYear()}-${String(afterOld.getMonth() + 1).padStart(2, '0')}`;
        const newMonths = generateMonths(afterOldYM, newFinYM);
        const insertPaiement = db.prepare(`
          INSERT OR IGNORE INTO cotisation_paiements (cotisation_id, mois, montant, statut)
          VALUES (?, ?, ?, 'En attente')
        `);
        for (const mois of newMonths) {
          insertPaiement.run(req.params.id, mois, newMontant);
        }
      }
    }

    const updated = db.prepare(`
      SELECT c.*, u.nom, u.prenom, l.numero as lot_numero
      FROM cotisations c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN lots l ON c.lot_id = l.id
      WHERE c.id = ?
    `).get(req.params.id);

    const paiements = db.prepare('SELECT * FROM cotisation_paiements WHERE cotisation_id = ? ORDER BY mois ASC').all(req.params.id);
    res.json({ ...updated, paiements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/cotisations/:id
router.delete('/cotisations/:id', authenticate, (req, res) => {
  try {
    if (req.user.role === 'copropietaire' || req.user.role === 'membre_bureau') return res.status(403).json({ error: 'Accès refusé' });
    const existing = db.prepare('SELECT id FROM cotisations WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Cotisation introuvable' });
    // Nullify foreign key in relances before deleting (no CASCADE on that FK)
    db.prepare('UPDATE relances SET cotisation_id = NULL WHERE cotisation_id = ?').run(req.params.id);
    db.prepare('DELETE FROM cotisations WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cotisations/:id/quitus
router.get('/cotisations/:id/quitus', authenticate, (req, res) => {
  try {
    if (req.user.role === 'copropietaire' || req.user.role === 'membre_bureau') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const cotisation = db.prepare(`
      SELECT c.*, u.nom, u.prenom, u.email,
        l.numero as lot_numero, l.type as lot_type
      FROM cotisations c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN lots l ON c.lot_id = l.id
      WHERE c.id = ?
    `).get(req.params.id);
    if (!cotisation) return res.status(404).json({ error: 'Cotisation introuvable' });

    const paiements = db.prepare('SELECT * FROM cotisation_paiements WHERE cotisation_id = ? ORDER BY mois ASC').all(req.params.id);
    const copropriete = db.prepare('SELECT * FROM coproprietes WHERE id = ?').get(cotisation.copropriete_id);
    const gestionnaire = db.prepare('SELECT nom, prenom FROM users WHERE id = ?').get(req.user.id);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlQuitus(cotisation, paiements, copropriete, gestionnaire));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cotisations/:id/send-quitus
router.post('/cotisations/:id/send-quitus', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'copropietaire' || req.user.role === 'membre_bureau') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const cotisation = db.prepare(`
      SELECT c.*, u.nom, u.prenom, u.email,
        l.numero as lot_numero, l.type as lot_type
      FROM cotisations c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN lots l ON c.lot_id = l.id
      WHERE c.id = ?
    `).get(req.params.id);
    if (!cotisation) return res.status(404).json({ error: 'Cotisation introuvable' });

    const paiements = db.prepare('SELECT * FROM cotisation_paiements WHERE cotisation_id = ? ORDER BY mois ASC').all(req.params.id);
    const copropriete = db.prepare('SELECT * FROM coproprietes WHERE id = ?').get(cotisation.copropriete_id);
    const gestionnaire = db.prepare('SELECT nom, prenom FROM users WHERE id = ?').get(req.user.id);

    const paiementsPayes = paiements.filter((p) => p.statut === 'Payé');
    const totalPaye = paiementsPayes.reduce((s, p) => s + (p.montant || 0), 0);
    const gestionnaireNom = gestionnaire ? `${gestionnaire.prenom || ''} ${gestionnaire.nom || ''}`.trim() : '';

    await sendQuitus({
      to: cotisation.email,
      prenom: cotisation.prenom,
      nom: cotisation.nom,
      lot_numero: cotisation.lot_numero,
      copropriete_nom: copropriete ? copropriete.nom : '',
      copropriete_adresse: copropriete ? copropriete.adresse : '',
      montant_mensuel: cotisation.montant_mensuel,
      date_debut: cotisation.date_debut,
      date_fin: cotisation.date_fin,
      nb_mois_payes: paiementsPayes.length,
      total_paye: totalPaye,
      gestionnaire_nom: gestionnaireNom,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PAIEMENTS ───────────────────────────────────────────────────────────────

// PUT /api/cotisations/paiements/:id
router.put('/cotisations/paiements/:id', authenticate, (req, res) => {
  try {
    if (req.user.role === 'copropietaire' || req.user.role === 'membre_bureau') return res.status(403).json({ error: 'Accès refusé' });
    const existing = db.prepare('SELECT * FROM cotisation_paiements WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Paiement introuvable' });

    const { statut, date_paiement, mode_paiement, reference, notes, montant_regle } = req.body;
    db.prepare(`
      UPDATE cotisation_paiements
      SET statut = COALESCE(?, statut),
          date_paiement = COALESCE(?, date_paiement),
          mode_paiement = COALESCE(?, mode_paiement),
          reference = COALESCE(?, reference),
          notes = COALESCE(?, notes),
          montant_regle = ?
      WHERE id = ?
    `).run(
      statut || null,
      date_paiement || null,
      mode_paiement || null,
      reference || null,
      notes || null,
      montant_regle !== undefined ? (montant_regle === '' ? null : parseFloat(montant_regle)) : existing.montant_regle,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM cotisation_paiements WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RELANCES ────────────────────────────────────────────────────────────────

// GET /api/relances/mes-relances — BEFORE /relances/:id
router.get('/relances/mes-relances', authenticate, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT r.*, co.nom as copropriete_nom
      FROM relances r
      LEFT JOIN coproprietes co ON r.copropriete_id = co.id
      WHERE r.user_id = ?
      ORDER BY r.sent_at DESC
    `).all(req.user.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/relances?copropriete_id=X
router.get('/relances', authenticate, (req, res) => {
  try {
    if (req.user.role === 'copropietaire' || req.user.role === 'membre_bureau') return res.status(403).json({ error: 'Accès refusé' });
    const { copropriete_id } = req.query;
    if (!copropriete_id) return res.status(400).json({ error: 'copropriete_id requis' });
    const rows = db.prepare(`
      SELECT r.*, u.nom, u.prenom, u.email
      FROM relances r
      JOIN users u ON r.user_id = u.id
      WHERE r.copropriete_id = ?
      ORDER BY r.sent_at DESC
    `).all(copropriete_id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/relances
router.post('/relances', authenticate, (req, res) => {
  try {
    if (req.user.role === 'copropietaire' || req.user.role === 'membre_bureau') return res.status(403).json({ error: 'Accès refusé' });
    const { copropriete_id, user_id, cotisation_id, type, objet, message } = req.body;
    if (!copropriete_id || !user_id || !type || !objet || !message) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    const result = db.prepare(`
      INSERT INTO relances (copropriete_id, user_id, cotisation_id, type, objet, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(copropriete_id, user_id, cotisation_id || null, type, objet, message);
    const relance = db.prepare('SELECT * FROM relances WHERE id = ?').get(result.lastInsertRowid);

    // Notify the copropriétaire being relanced (non-blocking)
    const targetUser = db.prepare('SELECT id, nom, prenom, email FROM users WHERE id = ?').get(user_id);
    if (targetUser) {
      const copropriete = db.prepare('SELECT nom FROM coproprietes WHERE id = ?').get(copropriete_id);
      const gestionnaire = db.prepare(`
        SELECT nom, prenom FROM users WHERE role = 'gestionnaire' AND copropriete_id = ? LIMIT 1
      `).get(copropriete_id);
      const cotisation = cotisation_id
        ? db.prepare('SELECT date_fin FROM cotisations WHERE id = ?').get(cotisation_id)
        : null;

      sendRelance({
        to: targetUser.email,
        prenom: targetUser.prenom,
        type,
        objet,
        message,
        residence: copropriete ? copropriete.nom : null,
        date_fin: cotisation ? cotisation.date_fin : null,
        gestionnaire_nom: gestionnaire ? `${gestionnaire.prenom} ${gestionnaire.nom}` : null,
        lien: `${APP_URL}/cotisations`,
      }).catch(console.error);
    }

    res.status(201).json(relance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PREUVES DE COTISATION ───────────────────────────────────────────────────

// POST /api/cotisations/:id/preuves
router.post('/cotisations/:id/preuves', authenticate, upload.single('file'), (req, res) => {
  try {
    if (req.user.role === 'copropietaire' || req.user.role === 'membre_bureau') return res.status(403).json({ error: 'Accès refusé' });
    const cotisation = db.prepare('SELECT id FROM cotisations WHERE id = ?').get(req.params.id);
    if (!cotisation) return res.status(404).json({ error: 'Cotisation introuvable' });
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant ou type non autorisé (images/PDF)' });

    const result = db.prepare(
      'INSERT INTO cotisation_preuves (cotisation_id, filename, original_name, mimetype) VALUES (?, ?, ?, ?)'
    ).run(req.params.id, req.file.filename, req.file.originalname, req.file.mimetype);

    const preuve = db.prepare('SELECT * FROM cotisation_preuves WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...preuve, url: `/api/uploads/${preuve.filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/cotisations/preuves/:id
router.delete('/cotisations/preuves/:id', authenticate, (req, res) => {
  try {
    if (req.user.role === 'copropietaire' || req.user.role === 'membre_bureau') return res.status(403).json({ error: 'Accès refusé' });
    const preuve = db.prepare('SELECT * FROM cotisation_preuves WHERE id = ?').get(req.params.id);
    if (!preuve) return res.status(404).json({ error: 'Preuve introuvable' });

    const filePath = path.join(uploadDir, preuve.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    db.prepare('DELETE FROM cotisation_preuves WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/relances/:id
router.put('/relances/:id', authenticate, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM relances WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Relance introuvable' });

    // Copropietaire can only update their own relances (mark as read)
    if (req.user.role === 'copropietaire' && existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { statut } = req.body;
    db.prepare('UPDATE relances SET statut = ? WHERE id = ?').run(statut || existing.statut, req.params.id);
    const updated = db.prepare('SELECT * FROM relances WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
