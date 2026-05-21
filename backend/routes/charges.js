const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all charges with copropriete name
router.get('/', (req, res) => {
  try {
    const charges = db.prepare(`
      SELECT ch.*, c.nom as copropriete_nom,
        (SELECT COUNT(*) FROM charge_repartitions WHERE charge_id = ch.id) as nb_repartitions,
        (SELECT SUM(montant) FROM charge_repartitions WHERE charge_id = ch.id AND statut_paiement = 'Payé') as montant_percu
      FROM charges ch
      LEFT JOIN coproprietes c ON ch.copropriete_id = c.id
      ORDER BY ch.date_echeance DESC
    `).all();
    res.json(charges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single charge with repartitions
router.get('/:id', (req, res) => {
  try {
    const charge = db.prepare(`
      SELECT ch.*, c.nom as copropriete_nom
      FROM charges ch
      LEFT JOIN coproprietes c ON ch.copropriete_id = c.id
      WHERE ch.id = ?
    `).get(req.params.id);
    if (!charge) return res.status(404).json({ error: 'Charge non trouvée' });

    const repartitions = db.prepare(`
      SELECT cr.*, l.numero as lot_numero, l.type as lot_type, l.proprietaire_nom, l.tantiemes
      FROM charge_repartitions cr
      JOIN lots l ON cr.lot_id = l.id
      WHERE cr.charge_id = ?
      ORDER BY l.numero ASC
    `).all(req.params.id);

    res.json({ ...charge, repartitions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create charge
router.post('/', (req, res) => {
  try {
    const { copropriete_id, libelle, montant_total, date_echeance, statut, budget_annuel, exercice, repartitions } = req.body;
    if (!copropriete_id || !libelle || !montant_total || !date_echeance) {
      return res.status(400).json({ error: 'Les champs copropriete_id, libelle, montant_total et date_echeance sont requis' });
    }

    const validStatuts = ['En cours', 'Soldé', 'En retard'];
    if (statut && !validStatuts.includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const result = db.prepare(`
      INSERT INTO charges (copropriete_id, libelle, montant_total, date_echeance, statut, budget_annuel, exercice)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(copropriete_id, libelle, montant_total, date_echeance, statut || 'En cours', budget_annuel || 0, exercice || new Date().getFullYear());

    // Insert repartitions if provided
    if (repartitions && Array.isArray(repartitions)) {
      const insertRep = db.prepare(`
        INSERT INTO charge_repartitions (charge_id, lot_id, montant, statut_paiement)
        VALUES (?, ?, ?, ?)
      `);
      for (const rep of repartitions) {
        insertRep.run(result.lastInsertRowid, rep.lot_id, rep.montant, rep.statut_paiement || 'Non payé');
      }
    }

    const newCharge = db.prepare('SELECT * FROM charges WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newCharge);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update charge
router.put('/:id', (req, res) => {
  try {
    const { libelle, montant_total, date_echeance, statut, budget_annuel, exercice } = req.body;
    const existing = db.prepare('SELECT id FROM charges WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Charge non trouvée' });

    db.prepare(`
      UPDATE charges SET libelle = ?, montant_total = ?, date_echeance = ?, statut = ?, budget_annuel = ?, exercice = ?
      WHERE id = ?
    `).run(libelle, montant_total, date_echeance, statut, budget_annuel || 0, exercice, req.params.id);

    const updated = db.prepare('SELECT * FROM charges WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE charge
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM charges WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Charge non trouvée' });

    db.prepare('DELETE FROM charges WHERE id = ?').run(req.params.id);
    res.json({ message: 'Charge supprimée avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET repartitions for a charge
router.get('/:id/repartitions', (req, res) => {
  try {
    const repartitions = db.prepare(`
      SELECT cr.*, l.numero as lot_numero, l.type as lot_type, l.proprietaire_nom, l.tantiemes
      FROM charge_repartitions cr
      JOIN lots l ON cr.lot_id = l.id
      WHERE cr.charge_id = ?
      ORDER BY l.numero ASC
    `).all(req.params.id);
    res.json(repartitions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a repartition payment status
router.put('/repartitions/:id', (req, res) => {
  try {
    const { statut_paiement, montant } = req.body;
    const validStatuts = ['Payé', 'Non payé', 'Partiel'];
    if (statut_paiement && !validStatuts.includes(statut_paiement)) {
      return res.status(400).json({ error: 'Statut de paiement invalide' });
    }

    const existing = db.prepare('SELECT * FROM charge_repartitions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Répartition non trouvée' });

    db.prepare(`
      UPDATE charge_repartitions SET statut_paiement = ?, montant = ? WHERE id = ?
    `).run(statut_paiement || existing.statut_paiement, montant !== undefined ? montant : existing.montant, req.params.id);

    const updated = db.prepare('SELECT * FROM charge_repartitions WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
