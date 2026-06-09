const express = require('express');
const db = require('../database');
const { authenticate } = require('../middleware/auth');
const { sendAppelFonds } = require('../services/email');
const { canGestionnaireAccessResidence } = require('../utils/access');

const APP_URL = process.env.APP_URL || 'https://syndicpro.propnex.ma';

const router = express.Router();

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

// Helper: check access to a copropriete_id
function canAccessCopropriete(user, coproprieteId) {
  if (user.role === 'admin') return true;
  if (user.role === 'gestionnaire') return canGestionnaireAccessResidence(user.id, coproprieteId);
  return false;
}

// ─── BUDGETS ──────────────────────────────────────────────────────────────────

// GET /api/budgets?copropriete_id=X
router.get('/budgets', authenticate, (req, res) => {
  try {
    const { copropriete_id } = req.query;
    if (!copropriete_id) return res.status(400).json({ error: 'copropriete_id requis' });
    if (!canAccessCopropriete(req.user, copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const budgets = db.prepare(`
      SELECT b.*,
        COALESCE((SELECT SUM(bl.montant_annuel) FROM budget_lignes bl WHERE bl.budget_id = b.id), 0) as total_budget
      FROM budgets b
      WHERE b.copropriete_id = ?
      ORDER BY b.annee DESC
    `).all(copropriete_id);

    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budgets
router.post('/budgets', authenticate, (req, res) => {
  try {
    const { copropriete_id, annee, notes } = req.body;
    if (!copropriete_id || !annee) return res.status(400).json({ error: 'copropriete_id et annee requis' });
    if (!canAccessCopropriete(req.user, copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const existing = db.prepare('SELECT id FROM budgets WHERE copropriete_id = ? AND annee = ?').get(copropriete_id, annee);
    if (existing) return res.status(409).json({ error: `Un budget pour ${annee} existe déjà` });

    const result = db.prepare(`
      INSERT INTO budgets (copropriete_id, annee, notes, created_by)
      VALUES (?, ?, ?, ?)
    `).run(copropriete_id, annee, notes || null, req.user.id);

    const budgetId = result.lastInsertRowid;

    // Auto-create lines for all categories
    const insertLigne = db.prepare(`
      INSERT INTO budget_lignes (budget_id, categorie) VALUES (?, ?)
    `);
    for (const cat of CATEGORIES_BUDGET) {
      insertLigne.run(budgetId, cat);
    }

    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    res.status(201).json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budgets/:id
router.get('/budgets/:id', authenticate, (req, res) => {
  try {
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget non trouvé' });
    if (!canAccessCopropriete(req.user, budget.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const lignes = db.prepare('SELECT * FROM budget_lignes WHERE budget_id = ? ORDER BY id ASC').all(req.params.id);
    res.json({ ...budget, lignes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/budgets/:id
router.put('/budgets/:id', authenticate, (req, res) => {
  try {
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget non trouvé' });
    if (!canAccessCopropriete(req.user, budget.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { statut, notes } = req.body;
    const newStatut = statut !== undefined ? statut : budget.statut;
    const newNotes = notes !== undefined ? notes : budget.notes;

    db.prepare(`
      UPDATE budgets SET statut = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newStatut, newNotes, req.params.id);

    const updated = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/budgets/:id
router.delete('/budgets/:id', authenticate, (req, res) => {
  try {
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget non trouvé' });
    if (!canAccessCopropriete(req.user, budget.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (budget.statut !== 'Brouillon') {
      return res.status(400).json({ error: 'Seul un budget en Brouillon peut être supprimé' });
    }

    db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BUDGET LIGNES ────────────────────────────────────────────────────────────

// GET /api/budgets/:id/lignes
router.get('/budgets/:id/lignes', authenticate, (req, res) => {
  try {
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget non trouvé' });
    if (!canAccessCopropriete(req.user, budget.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const lignes = db.prepare('SELECT * FROM budget_lignes WHERE budget_id = ? ORDER BY id ASC').all(req.params.id);
    res.json(lignes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/budgets/:id/lignes/:ligneId
router.put('/budgets/:id/lignes/:ligneId', authenticate, (req, res) => {
  try {
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget non trouvé' });
    if (!canAccessCopropriete(req.user, budget.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const ligne = db.prepare('SELECT * FROM budget_lignes WHERE id = ? AND budget_id = ?').get(req.params.ligneId, req.params.id);
    if (!ligne) return res.status(404).json({ error: 'Ligne non trouvée' });

    const months = ['jan', 'fev', 'mar', 'avr', 'mai', 'jun', 'jul', 'aou', 'sep', 'oct', 'nov', 'dec'];
    const updated = {};

    for (const m of months) {
      updated[m] = req.body[m] !== undefined ? parseFloat(req.body[m]) || 0 : ligne[m];
    }

    // Auto-recalculate montant_annuel as sum of months if any month was provided
    const anyMonthProvided = months.some(m => req.body[m] !== undefined);
    if (anyMonthProvided) {
      updated.montant_annuel = months.reduce((sum, m) => sum + updated[m], 0);
    } else {
      updated.montant_annuel = req.body.montant_annuel !== undefined
        ? parseFloat(req.body.montant_annuel) || 0
        : ligne.montant_annuel;
    }

    updated.notes = req.body.notes !== undefined ? req.body.notes : ligne.notes;

    db.prepare(`
      UPDATE budget_lignes SET
        montant_annuel = ?, jan = ?, fev = ?, mar = ?, avr = ?, mai = ?, jun = ?,
        jul = ?, aou = ?, sep = ?, oct = ?, nov = ?, dec = ?, notes = ?
      WHERE id = ?
    `).run(
      updated.montant_annuel,
      updated.jan, updated.fev, updated.mar, updated.avr, updated.mai, updated.jun,
      updated.jul, updated.aou, updated.sep, updated.oct, updated.nov, updated.dec,
      updated.notes,
      req.params.ligneId
    );

    // Update budget updated_at
    db.prepare('UPDATE budgets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

    const updatedLigne = db.prepare('SELECT * FROM budget_lignes WHERE id = ?').get(req.params.ligneId);
    res.json(updatedLigne);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SYNTHESE ─────────────────────────────────────────────────────────────────

// GET /api/budgets/:id/synthese
router.get('/budgets/:id/synthese', authenticate, (req, res) => {
  try {
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget non trouvé' });
    if (!canAccessCopropriete(req.user, budget.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const lignes = db.prepare('SELECT * FROM budget_lignes WHERE budget_id = ? ORDER BY id ASC').all(req.params.id);

    const months = ['jan', 'fev', 'mar', 'avr', 'mai', 'jun', 'jul', 'aou', 'sep', 'oct', 'nov', 'dec'];
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const monthNums = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

    const synthese = lignes.map(ligne => {
      // Sum of all depenses for this category and budget year
      const depensesRows = db.prepare(`
        SELECT COALESCE(SUM(montant), 0) as total
        FROM depenses
        WHERE copropriete_id = ? AND categorie = ?
          AND strftime('%Y', date_depense) = ?
      `).get(budget.copropriete_id, ligne.categorie, String(budget.annee));

      const consomme = depensesRows.total;
      const budget_annuel = ligne.montant_annuel;
      const restant = budget_annuel - consomme;
      const pct_consomme = budget_annuel > 0 ? Math.round((consomme / budget_annuel) * 100) : 0;

      // Per month breakdown
      const par_mois = months.map((m, i) => {
        const depMois = db.prepare(`
          SELECT COALESCE(SUM(montant), 0) as total
          FROM depenses
          WHERE copropriete_id = ? AND categorie = ?
            AND strftime('%Y-%m', date_depense) = ?
        `).get(budget.copropriete_id, ligne.categorie, `${budget.annee}-${monthNums[i]}`);

        return {
          mois: monthNames[i],
          budget: ligne[m],
          consomme: depMois.total,
        };
      });

      return {
        categorie: ligne.categorie,
        budget_annuel,
        consomme,
        restant,
        pct_consomme,
        par_mois,
      };
    });

    res.json(synthese);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEPENSES ─────────────────────────────────────────────────────────────────

// GET /api/depenses?copropriete_id=X&annee=Y&categorie=Z
router.get('/depenses', authenticate, (req, res) => {
  try {
    const { copropriete_id, annee, categorie } = req.query;
    if (!copropriete_id) return res.status(400).json({ error: 'copropriete_id requis' });
    if (!canAccessCopropriete(req.user, copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    let query = `
      SELECT d.*, f.nom as fournisseur_nom, f.categorie as fournisseur_categorie
      FROM depenses d
      LEFT JOIN fournisseurs f ON f.id = d.fournisseur_id
      WHERE d.copropriete_id = ?
    `;
    const params = [copropriete_id];

    if (annee) {
      query += ` AND strftime('%Y', d.date_depense) = ?`;
      params.push(String(annee));
    }
    if (categorie) {
      query += ' AND d.categorie = ?';
      params.push(categorie);
    }

    query += ' ORDER BY d.date_depense DESC, d.created_at DESC';

    const depenses = db.prepare(query).all(...params);
    res.json(depenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/depenses
router.post('/depenses', authenticate, (req, res) => {
  try {
    const { copropriete_id, budget_id, categorie, libelle, montant, date_depense, fournisseur, fournisseur_id, numero_facture, notes, justificatif_url } = req.body;
    if (!copropriete_id || !categorie || !libelle || montant === undefined || !date_depense) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    if (!canAccessCopropriete(req.user, copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const result = db.prepare(`
      INSERT INTO depenses (copropriete_id, budget_id, categorie, libelle, montant, date_depense, fournisseur, fournisseur_id, numero_facture, notes, justificatif_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(copropriete_id, budget_id || null, categorie, libelle, parseFloat(montant), date_depense, fournisseur || null, fournisseur_id || null, numero_facture || null, notes || null, justificatif_url || null, req.user.id);

    const depense = db.prepare(`
      SELECT d.*, f.nom as fournisseur_nom FROM depenses d
      LEFT JOIN fournisseurs f ON f.id = d.fournisseur_id
      WHERE d.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(depense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/depenses/:id
router.put('/depenses/:id', authenticate, (req, res) => {
  try {
    const depense = db.prepare('SELECT * FROM depenses WHERE id = ?').get(req.params.id);
    if (!depense) return res.status(404).json({ error: 'Dépense non trouvée' });
    if (!canAccessCopropriete(req.user, depense.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { categorie, libelle, montant, date_depense, fournisseur, fournisseur_id, numero_facture, notes, budget_id, justificatif_url } = req.body;

    db.prepare(`
      UPDATE depenses SET
        categorie = ?, libelle = ?, montant = ?, date_depense = ?,
        fournisseur = ?, fournisseur_id = ?, numero_facture = ?, notes = ?, budget_id = ?, justificatif_url = ?
      WHERE id = ?
    `).run(
      categorie !== undefined ? categorie : depense.categorie,
      libelle !== undefined ? libelle : depense.libelle,
      montant !== undefined ? parseFloat(montant) : depense.montant,
      date_depense !== undefined ? date_depense : depense.date_depense,
      fournisseur !== undefined ? fournisseur : depense.fournisseur,
      fournisseur_id !== undefined ? (fournisseur_id || null) : depense.fournisseur_id,
      numero_facture !== undefined ? numero_facture : depense.numero_facture,
      notes !== undefined ? notes : depense.notes,
      budget_id !== undefined ? budget_id : depense.budget_id,
      justificatif_url !== undefined ? justificatif_url : depense.justificatif_url,
      req.params.id
    );

    const updated = db.prepare(`
      SELECT d.*, f.nom as fournisseur_nom FROM depenses d
      LEFT JOIN fournisseurs f ON f.id = d.fournisseur_id
      WHERE d.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/depenses/:id
router.delete('/depenses/:id', authenticate, (req, res) => {
  try {
    const depense = db.prepare('SELECT * FROM depenses WHERE id = ?').get(req.params.id);
    if (!depense) return res.status(404).json({ error: 'Dépense non trouvée' });
    if (!canAccessCopropriete(req.user, depense.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    db.prepare('DELETE FROM depenses WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── APPELS DE FONDS ──────────────────────────────────────────────────────────

// GET /api/appels-fonds?copropriete_id=X
router.get('/appels-fonds', authenticate, (req, res) => {
  try {
    const { copropriete_id } = req.query;
    if (!copropriete_id) return res.status(400).json({ error: 'copropriete_id requis' });
    if (!canAccessCopropriete(req.user, copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const appels = db.prepare(`
      SELECT af.*, b.annee as budget_annee
      FROM appels_fonds af
      LEFT JOIN budgets b ON af.budget_id = b.id
      WHERE af.copropriete_id = ?
      ORDER BY af.date_appel DESC
    `).all(copropriete_id);

    res.json(appels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appels-fonds
router.post('/appels-fonds', authenticate, (req, res) => {
  try {
    const { copropriete_id, budget_id, libelle, motif, montant_total, date_appel, date_echeance } = req.body;
    if (!copropriete_id || !libelle || montant_total === undefined || !date_appel || !date_echeance) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    if (!canAccessCopropriete(req.user, copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const result = db.prepare(`
      INSERT INTO appels_fonds (copropriete_id, budget_id, libelle, motif, montant_total, date_appel, date_echeance, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(copropriete_id, budget_id || null, libelle, motif || null, parseFloat(montant_total), date_appel, date_echeance, req.user.id);

    const appel = db.prepare('SELECT * FROM appels_fonds WHERE id = ?').get(result.lastInsertRowid);

    // Notify all copropriétaires of the residence (non-blocking)
    const copropriete = db.prepare('SELECT nom FROM coproprietes WHERE id = ?').get(copropriete_id);
    const copropietaires = db.prepare(`
      SELECT id, nom, prenom, email FROM users
      WHERE role = 'copropietaire' AND copropriete_id = ? AND is_active = 1
    `).all(copropriete_id);

    for (const user of copropietaires) {
      sendAppelFonds({
        to: user.email,
        prenom: user.prenom,
        residence: copropriete ? copropriete.nom : String(copropriete_id),
        libelle,
        montant_total: parseFloat(montant_total),
        date_echeance,
        motif: motif || null,
        lien: `${APP_URL}/finances`,
      }).catch(console.error);
    }

    res.status(201).json(appel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/appels-fonds/:id
router.put('/appels-fonds/:id', authenticate, (req, res) => {
  try {
    const appel = db.prepare('SELECT * FROM appels_fonds WHERE id = ?').get(req.params.id);
    if (!appel) return res.status(404).json({ error: 'Appel de fonds non trouvé' });
    if (!canAccessCopropriete(req.user, appel.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { statut, libelle, motif, montant_total, date_appel, date_echeance, budget_id } = req.body;

    db.prepare(`
      UPDATE appels_fonds SET
        statut = ?, libelle = ?, motif = ?, montant_total = ?,
        date_appel = ?, date_echeance = ?, budget_id = ?
      WHERE id = ?
    `).run(
      statut !== undefined ? statut : appel.statut,
      libelle !== undefined ? libelle : appel.libelle,
      motif !== undefined ? motif : appel.motif,
      montant_total !== undefined ? parseFloat(montant_total) : appel.montant_total,
      date_appel !== undefined ? date_appel : appel.date_appel,
      date_echeance !== undefined ? date_echeance : appel.date_echeance,
      budget_id !== undefined ? budget_id : appel.budget_id,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM appels_fonds WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/appels-fonds/:id
router.delete('/appels-fonds/:id', authenticate, (req, res) => {
  try {
    const appel = db.prepare('SELECT * FROM appels_fonds WHERE id = ?').get(req.params.id);
    if (!appel) return res.status(404).json({ error: 'Appel de fonds non trouvé' });
    if (!canAccessCopropriete(req.user, appel.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    db.prepare('DELETE FROM appels_fonds WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
