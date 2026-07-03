const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendRelance } = require('../services/email');

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
    // bureau view only when user has bureau access AND passes scope=bureau
    const isPersonalView = !canSeeBureau || req.query.scope !== 'bureau';
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
    ).all(req.params.id).map((pr) => ({ ...pr, url: `/uploads/${pr.filename}` }));

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

// ─── PAIEMENTS ───────────────────────────────────────────────────────────────

// PUT /api/cotisations/paiements/:id
router.put('/cotisations/paiements/:id', authenticate, (req, res) => {
  try {
    if (req.user.role === 'copropietaire' || req.user.role === 'membre_bureau') return res.status(403).json({ error: 'Accès refusé' });
    const existing = db.prepare('SELECT * FROM cotisation_paiements WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Paiement introuvable' });

    const { statut, date_paiement, mode_paiement, reference, notes } = req.body;
    db.prepare(`
      UPDATE cotisation_paiements
      SET statut = COALESCE(?, statut),
          date_paiement = COALESCE(?, date_paiement),
          mode_paiement = COALESCE(?, mode_paiement),
          reference = COALESCE(?, reference),
          notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(
      statut || null,
      date_paiement || null,
      mode_paiement || null,
      reference || null,
      notes || null,
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
    res.status(201).json({ ...preuve, url: `/uploads/${preuve.filename}` });
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
