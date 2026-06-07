const express = require('express');
const router = express.Router();
const db = require('../database');
const { canGestionnaireAccessResidence } = require('../utils/access');

// PUT update lot
router.put('/:id', (req, res) => {
  try {
    const { numero, type, surface, tantiemes, proprietaire_nom, proprietaire_email, proprietaire_tel } = req.body;
    const existing = db.prepare('SELECT * FROM lots WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Lot non trouvé' });
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, existing.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé à cette résidence' });
    }

    const validTypes = ['Appartement', 'Studio', 'Commerce', 'Bureau', 'Parking', 'Cave'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: 'Type de lot invalide' });
    }

    db.prepare(`
      UPDATE lots SET numero = ?, type = ?, surface = ?, tantiemes = ?,
        proprietaire_nom = ?, proprietaire_email = ?, proprietaire_tel = ?
      WHERE id = ?
    `).run(
      numero || existing.numero,
      type || existing.type,
      surface !== undefined ? surface : existing.surface,
      tantiemes !== undefined ? tantiemes : existing.tantiemes,
      proprietaire_nom !== undefined ? proprietaire_nom : existing.proprietaire_nom,
      proprietaire_email !== undefined ? proprietaire_email : existing.proprietaire_email,
      proprietaire_tel !== undefined ? proprietaire_tel : existing.proprietaire_tel,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM lots WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE lot
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM lots WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Lot non trouvé' });
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, existing.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé à cette résidence' });
    }

    db.prepare('DELETE FROM lots WHERE id = ?').run(req.params.id);

    // Update nb_lots
    db.prepare(`
      UPDATE coproprietes SET nb_lots = (SELECT COUNT(*) FROM lots WHERE copropriete_id = ?)
      WHERE id = ?
    `).run(existing.copropriete_id, existing.copropriete_id);

    res.json({ message: 'Lot supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
