const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/messages — copropriétaire sees messages for their residence
router.get('/', authenticate, (req, res) => {
  try {
    let messages;

    if (req.user.role === 'admin') {
      messages = db.prepare(`
        SELECT m.*, c.nom as copropriete_nom, u.nom as gestionnaire_nom, u.prenom as gestionnaire_prenom
        FROM messages_diffusion m
        JOIN coproprietes c ON m.copropriete_id = c.id
        JOIN users u ON m.gestionnaire_id = u.id
        ORDER BY m.created_at DESC
      `).all();
    } else if (req.user.role === 'gestionnaire') {
      messages = db.prepare(`
        SELECT m.*, c.nom as copropriete_nom, u.nom as gestionnaire_nom, u.prenom as gestionnaire_prenom
        FROM messages_diffusion m
        JOIN coproprietes c ON m.copropriete_id = c.id
        JOIN users u ON m.gestionnaire_id = u.id
        WHERE m.copropriete_id = ?
        ORDER BY m.created_at DESC
      `).all(req.user.copropriete_id);
    } else {
      // copropietaire
      messages = db.prepare(`
        SELECT m.*, c.nom as copropriete_nom, u.nom as gestionnaire_nom, u.prenom as gestionnaire_prenom
        FROM messages_diffusion m
        JOIN coproprietes c ON m.copropriete_id = c.id
        JOIN users u ON m.gestionnaire_id = u.id
        WHERE m.copropriete_id = ?
        ORDER BY m.created_at DESC
      `).all(req.user.copropriete_id);
    }

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages — gestionnaire broadcasts message
router.post('/', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const { titre, contenu, copropriete_id } = req.body;

    if (!titre || !contenu) {
      return res.status(400).json({ error: 'titre et contenu sont requis' });
    }

    const coproId = req.user.role === 'gestionnaire' ? req.user.copropriete_id : (copropriete_id || req.user.copropriete_id);

    if (!coproId) {
      return res.status(400).json({ error: 'copropriete_id requis' });
    }

    const result = db.prepare(`
      INSERT INTO messages_diffusion (copropriete_id, gestionnaire_id, titre, contenu)
      VALUES (?, ?, ?, ?)
    `).run(coproId, req.user.id, titre, contenu);

    const message = db.prepare(`
      SELECT m.*, c.nom as copropriete_nom, u.nom as gestionnaire_nom, u.prenom as gestionnaire_prenom
      FROM messages_diffusion m
      JOIN coproprietes c ON m.copropriete_id = c.id
      JOIN users u ON m.gestionnaire_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/messages/:id — gestionnaire
router.delete('/:id', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM messages_diffusion WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Message non trouvé' });

    // Gestionnaire can only delete their own residence's messages
    if (req.user.role === 'gestionnaire' && existing.copropriete_id !== req.user.copropriete_id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    db.prepare('DELETE FROM messages_diffusion WHERE id = ?').run(id);
    res.json({ message: 'Message supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
