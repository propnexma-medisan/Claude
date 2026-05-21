const express = require('express');
const router = express.Router();
const db = require('../database');

// PUT update ag_point
router.put('/:id', (req, res) => {
  try {
    const { numero, libelle, description, type_vote, resultat, votes_pour, votes_contre, votes_abstention } = req.body;
    const existing = db.prepare('SELECT * FROM ag_points WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Point non trouvé' });

    const validTypeVote = ['Simple majorité', 'Double majorité', 'Unanimité'];
    if (type_vote && !validTypeVote.includes(type_vote)) {
      return res.status(400).json({ error: 'Type de vote invalide' });
    }

    if (resultat && !['Approuvé', 'Refusé', 'Ajourné'].includes(resultat)) {
      return res.status(400).json({ error: 'Résultat invalide' });
    }

    db.prepare(`
      UPDATE ag_points
      SET numero = ?, libelle = ?, description = ?, type_vote = ?, resultat = ?,
          votes_pour = ?, votes_contre = ?, votes_abstention = ?
      WHERE id = ?
    `).run(
      numero !== undefined ? numero : existing.numero,
      libelle || existing.libelle,
      description !== undefined ? description : existing.description,
      type_vote || existing.type_vote,
      resultat !== undefined ? (resultat || null) : existing.resultat,
      votes_pour !== undefined ? votes_pour : existing.votes_pour,
      votes_contre !== undefined ? votes_contre : existing.votes_contre,
      votes_abstention !== undefined ? votes_abstention : existing.votes_abstention,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM ag_points WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ag_point
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM ag_points WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Point non trouvé' });

    db.prepare('DELETE FROM ag_points WHERE id = ?').run(req.params.id);
    res.json({ message: 'Point supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
