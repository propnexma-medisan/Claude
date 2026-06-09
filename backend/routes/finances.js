const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { canGestionnaireAccessResidence } = require('../utils/access');

const router = express.Router();

// GET /api/finances/global — admin only, all residences summary
router.get('/global', authenticate, requireRole('admin'), (req, res) => {
  try {
    const residences = db.prepare(`
      SELECT c.id, c.nom, c.adresse, c.nb_lots,
        COALESCE(SUM(ch.budget_annuel), 0) as budget_annuel,
        COALESCE(SUM(ch.montant_total), 0) as total_charges,
        COALESCE((
          SELECT SUM(cr.montant) FROM charge_repartitions cr
          JOIN charges ch2 ON cr.charge_id = ch2.id
          WHERE ch2.copropriete_id = c.id AND cr.statut_paiement = 'Payé'
        ), 0) as total_paye,
        (SELECT COUNT(*) FROM users WHERE copropriete_id = c.id AND role = 'copropietaire') as nb_copropietaires,
        (SELECT COUNT(*) FROM tickets WHERE copropriete_id = c.id AND statut = 'Ouvert') as tickets_ouverts
      FROM coproprietes c
      LEFT JOIN charges ch ON ch.copropriete_id = c.id
      GROUP BY c.id
      ORDER BY c.nom ASC
    `).all();

    const summary = residences.map(r => ({
      ...r,
      total_impaye: r.total_charges - r.total_paye,
      taux_recouvrement: r.total_charges > 0 ? Math.round((r.total_paye / r.total_charges) * 100) : 0,
    }));

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finances/:coproprieteId
// Returns detailed finance view for a residence
router.get('/:coproprieteId', authenticate, (req, res) => {
  try {
    const { coproprieteId } = req.params;

    // Access control
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, coproprieteId)) {
      return res.status(403).json({ error: 'Accès refusé à cette résidence' });
    }
    if (req.user.role === 'copropietaire' && req.user.copropriete_id !== parseInt(coproprieteId)) {
      return res.status(403).json({ error: 'Accès refusé à cette résidence' });
    }

    const copropriete = db.prepare('SELECT * FROM coproprietes WHERE id = ?').get(coproprieteId);
    if (!copropriete) return res.status(404).json({ error: 'Résidence non trouvée' });

    const currentYear = new Date().getFullYear();
    const annee = req.query.annee ? parseInt(req.query.annee) : currentYear;
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Budget annuel from budget_lignes filtered by selected year
    const budgetRow = db.prepare(`
      SELECT COALESCE(SUM(bl.montant_annuel), 0) as budget_annuel
      FROM budget_lignes bl
      JOIN budgets b ON bl.budget_id = b.id
      WHERE b.copropriete_id = ? AND b.annee = ?
    `).get(coproprieteId, annee);

    // Dépenses réalisées filtered by selected year
    const depensesList = db.prepare(`
      SELECT * FROM depenses
      WHERE copropriete_id = ? AND strftime('%Y', date_depense) = ?
      ORDER BY date_depense DESC
    `).all(coproprieteId, String(annee));

    // Cotisations par lot (legacy, kept for Finances page)
    const cotisations = db.prepare(`
      SELECT l.id as lot_id, l.numero as lot_numero, l.type as lot_type,
             l.proprietaire_nom, l.tantiemes,
             u.id as user_id, u.nom as user_nom, u.prenom as user_prenom, u.email as user_email,
             COALESCE(SUM(cr.montant), 0) as montant_total,
             COALESCE(SUM(CASE WHEN cr.statut_paiement = 'Payé' THEN cr.montant ELSE 0 END), 0) as montant_paye,
             COALESCE(SUM(CASE WHEN cr.statut_paiement = 'Non payé' THEN cr.montant ELSE 0 END), 0) as montant_impaye,
             COALESCE(SUM(CASE WHEN cr.statut_paiement = 'Partiel' THEN cr.montant ELSE 0 END), 0) as montant_partiel
      FROM lots l
      LEFT JOIN users u ON u.lot_id = l.id AND u.role = 'copropietaire'
      LEFT JOIN charge_repartitions cr ON cr.lot_id = l.id
      LEFT JOIN charges ch ON cr.charge_id = ch.id AND ch.copropriete_id = ?
      WHERE l.copropriete_id = ?
      GROUP BY l.id
      ORDER BY l.numero ASC
    `).all(coproprieteId, coproprieteId);

    // Cotisations with paiements totals
    // total_attendu / cot_impaye = only past-due months (mois <= currentMonth)
    // cot_a_collecter = all remaining unpaid (past + future)
    const cotisationsList = db.prepare(`
      SELECT c.*,
        u.nom, u.prenom, u.email,
        l.numero as lot_numero, l.type as lot_type,
        COALESCE(SUM(CASE WHEN cp.mois <= ? THEN cp.montant ELSE 0 END), 0) as total_attendu,
        COALESCE(SUM(CASE WHEN cp.statut = 'Payé' THEN cp.montant ELSE 0 END), 0) as cot_paye,
        COALESCE(SUM(CASE WHEN cp.statut != 'Payé' AND cp.mois <= ? THEN cp.montant ELSE 0 END), 0) as cot_impaye,
        COALESCE(SUM(CASE WHEN cp.statut != 'Payé' THEN cp.montant ELSE 0 END), 0) as cot_a_collecter
      FROM cotisations c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN lots l ON c.lot_id = l.id
      LEFT JOIN cotisation_paiements cp ON cp.cotisation_id = c.id
      WHERE c.copropriete_id = ?
      GROUP BY c.id
      ORDER BY c.statut ASC, c.date_debut DESC
    `).all(currentMonth, currentMonth, coproprieteId);

    const total_cot_attendu = cotisationsList.reduce((s, c) => s + c.total_attendu, 0);
    const total_cot_paye = cotisationsList.reduce((s, c) => s + c.cot_paye, 0);
    const total_cot_impaye = cotisationsList.reduce((s, c) => s + c.cot_impaye, 0);
    const total_cot_a_collecter = cotisationsList.reduce((s, c) => s + c.cot_a_collecter, 0);
    const total_depenses_realisees = depensesList.reduce((s, d) => s + d.montant, 0);

    res.json({
      copropriete,
      annee,
      budget_annuel: budgetRow.budget_annuel,
      cotisations_par_lot: cotisations,
      cotisations_list: cotisationsList,
      depenses_list: depensesList,
      total_cot_attendu,
      total_cot_paye,
      total_cot_impaye,
      total_cot_a_collecter,
      total_depenses_realisees,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
