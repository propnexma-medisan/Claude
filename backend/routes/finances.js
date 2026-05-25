const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

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
    if (req.user.role === 'gestionnaire' && req.user.copropriete_id !== parseInt(coproprieteId)) {
      return res.status(403).json({ error: 'Accès refusé à cette résidence' });
    }
    if (req.user.role === 'copropietaire' && req.user.copropriete_id !== parseInt(coproprieteId)) {
      return res.status(403).json({ error: 'Accès refusé à cette résidence' });
    }

    const copropriete = db.prepare('SELECT * FROM coproprietes WHERE id = ?').get(coproprieteId);
    if (!copropriete) return res.status(404).json({ error: 'Résidence non trouvée' });

    // Budget annuel (sum of budget_annuel from charges of current year)
    const currentYear = new Date().getFullYear();
    const budgetRow = db.prepare(`
      SELECT COALESCE(SUM(budget_annuel), 0) as budget_annuel
      FROM charges WHERE copropriete_id = ? AND exercice = ?
    `).get(coproprieteId, currentYear);

    // Total charges
    const totalChargesRow = db.prepare(`
      SELECT COALESCE(SUM(montant_total), 0) as total
      FROM charges WHERE copropriete_id = ?
    `).get(coproprieteId);

    // Total payé
    const totalPayeRow = db.prepare(`
      SELECT COALESCE(SUM(cr.montant), 0) as total
      FROM charge_repartitions cr
      JOIN charges ch ON cr.charge_id = ch.id
      WHERE ch.copropriete_id = ? AND cr.statut_paiement = 'Payé'
    `).get(coproprieteId);

    // Dépenses (charges list)
    const depenses = db.prepare(`
      SELECT id, libelle, montant_total, date_echeance, statut, budget_annuel, exercice, created_at
      FROM charges
      WHERE copropriete_id = ?
      ORDER BY date_echeance DESC
    `).all(coproprieteId);

    // Cotisations par lot
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
    const cotisationsList = db.prepare(`
      SELECT c.*,
        u.nom, u.prenom, u.email,
        l.numero as lot_numero, l.type as lot_type,
        COALESCE(SUM(cp.montant), 0) as total_attendu,
        COALESCE(SUM(CASE WHEN cp.statut = 'Payé' THEN cp.montant ELSE 0 END), 0) as cot_paye,
        COALESCE(SUM(CASE WHEN cp.statut != 'Payé' THEN cp.montant ELSE 0 END), 0) as cot_impaye
      FROM cotisations c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN lots l ON c.lot_id = l.id
      LEFT JOIN cotisation_paiements cp ON cp.cotisation_id = c.id
      WHERE c.copropriete_id = ?
      GROUP BY c.id
      ORDER BY c.statut ASC, c.date_debut DESC
    `).all(coproprieteId);

    // Real depenses from depenses table
    const depensesList = db.prepare(`
      SELECT * FROM depenses
      WHERE copropriete_id = ?
      ORDER BY date_depense DESC
    `).all(coproprieteId);

    const total_cot_attendu = cotisationsList.reduce((s, c) => s + c.total_attendu, 0);
    const total_cot_paye = cotisationsList.reduce((s, c) => s + c.cot_paye, 0);
    const total_cot_impaye = cotisationsList.reduce((s, c) => s + c.cot_impaye, 0);
    const total_depenses_realisees = depensesList.reduce((s, d) => s + d.montant, 0);

    const total_charges = totalChargesRow.total;
    const total_paye = totalPayeRow.total;
    const total_impaye = total_charges - total_paye;

    res.json({
      copropriete,
      budget_annuel: budgetRow.budget_annuel,
      total_charges,
      total_paye,
      total_impaye,
      taux_recouvrement: total_charges > 0 ? Math.round((total_paye / total_charges) * 100) : 0,
      depenses,
      cotisations_par_lot: cotisations,
      cotisations_list: cotisationsList,
      depenses_list: depensesList,
      total_cot_attendu,
      total_cot_paye,
      total_cot_impaye,
      total_depenses_realisees,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
