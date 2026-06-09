const express = require('express');
const router = express.Router();
const db = require('../database');
const { canGestionnaireAccessResidence } = require('../utils/access');

// GET all coproprietes
router.get('/', (req, res) => {
  try {
    const coproprietes = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM lots WHERE copropriete_id = c.id) as nb_lots_reel
      FROM coproprietes c
      ORDER BY c.nom ASC
    `).all();
    res.json(coproprietes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single copropriete
router.get('/:id', (req, res) => {
  try {
    const copropriete = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM lots WHERE copropriete_id = c.id) as nb_lots_reel
      FROM coproprietes c
      WHERE c.id = ?
    `).get(req.params.id);
    if (!copropriete) return res.status(404).json({ error: 'Copropriété non trouvée' });
    res.json(copropriete);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create copropriete
router.post('/', (req, res) => {
  try {
    const { nom, adresse, syndic_nom, date_creation, notes, photo_url } = req.body;
    if (!nom || !adresse || !date_creation) {
      return res.status(400).json({ error: 'Les champs nom, adresse et date_creation sont requis' });
    }
    const result = db.prepare(`
      INSERT INTO coproprietes (nom, adresse, nb_lots, syndic_nom, date_creation, notes, photo_url)
      VALUES (?, ?, 0, ?, ?, ?, ?)
    `).run(nom, adresse, syndic_nom || null, date_creation, notes || null, photo_url || null);

    const newCopropriete = db.prepare('SELECT * FROM coproprietes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newCopropriete);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update copropriete
router.put('/:id', (req, res) => {
  try {
    const { nom, adresse, syndic_nom, date_creation, notes, photo_url } = req.body;
    const existing = db.prepare('SELECT id FROM coproprietes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Copropriété non trouvée' });

    db.prepare(`
      UPDATE coproprietes SET nom = ?, adresse = ?, syndic_nom = ?, date_creation = ?, notes = ?, photo_url = ?
      WHERE id = ?
    `).run(nom, adresse, syndic_nom || null, date_creation, notes || null, photo_url || null, req.params.id);

    const updated = db.prepare('SELECT * FROM coproprietes WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE copropriete
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM coproprietes WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Copropriété non trouvée' });

    db.prepare('DELETE FROM coproprietes WHERE id = ?').run(req.params.id);
    res.json({ message: 'Copropriété supprimée avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET lots for a copropriete
router.get('/:id/lots', (req, res) => {
  try {
    const lots = db.prepare(`
      SELECT l.*,
        u.id as copropietaire_id, u.nom as copropietaire_nom,
        u.prenom as copropietaire_prenom, u.email as copropietaire_email
      FROM lots l
      LEFT JOIN users u ON u.lot_id = l.id AND u.role = 'copropietaire'
      WHERE l.copropriete_id = ?
      ORDER BY l.numero ASC
    `).all(req.params.id);
    res.json(lots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create lot for a copropriete
router.post('/:id/lots', (req, res) => {
  try {
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, req.params.id)) {
      return res.status(403).json({ error: 'Accès refusé à cette résidence' });
    }
    const { numero, type, surface, tantiemes, copropietaire_id } = req.body;
    if (!numero || !type) {
      return res.status(400).json({ error: 'Les champs numero et type sont requis' });
    }
    const validTypes = ['Appartement', 'Studio', 'Commerce', 'Bureau', 'Parking', 'Cave'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Type de lot invalide' });
    }

    const result = db.prepare(`
      INSERT INTO lots (copropriete_id, numero, type, surface, tantiemes)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, numero, type, surface || null, tantiemes || 0);

    const lotId = result.lastInsertRowid;

    if (copropietaire_id) {
      db.prepare(`UPDATE users SET lot_id = ? WHERE id = ? AND role = 'copropietaire'`).run(lotId, copropietaire_id);
    }

    // Update nb_lots
    db.prepare(`
      UPDATE coproprietes SET nb_lots = (SELECT COUNT(*) FROM lots WHERE copropriete_id = ?)
      WHERE id = ?
    `).run(req.params.id, req.params.id);

    const newLot = db.prepare(`
      SELECT l.*, u.id as copropietaire_id, u.nom as copropietaire_nom,
        u.prenom as copropietaire_prenom, u.email as copropietaire_email
      FROM lots l LEFT JOIN users u ON u.lot_id = l.id AND u.role = 'copropietaire'
      WHERE l.id = ?
    `).get(lotId);
    res.status(201).json(newLot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
