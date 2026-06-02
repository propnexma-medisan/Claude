const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendMessageBroadcast } = require('../services/email');
const { canGestionnaireAccessResidence } = require('../utils/access');

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
      const { copropriete_id } = req.query;
      if (copropriete_id) {
        if (!canGestionnaireAccessResidence(req.user.id, copropriete_id)) {
          return res.status(403).json({ error: 'Accès refusé à cette résidence' });
        }
        messages = db.prepare(`
          SELECT m.*, c.nom as copropriete_nom, u.nom as gestionnaire_nom, u.prenom as gestionnaire_prenom
          FROM messages_diffusion m
          JOIN coproprietes c ON m.copropriete_id = c.id
          JOIN users u ON m.gestionnaire_id = u.id
          WHERE m.copropriete_id = ?
          ORDER BY m.created_at DESC
        `).all(copropriete_id);
      } else {
        messages = db.prepare(`
          SELECT m.*, c.nom as copropriete_nom, u.nom as gestionnaire_nom, u.prenom as gestionnaire_prenom
          FROM messages_diffusion m
          JOIN coproprietes c ON m.copropriete_id = c.id
          JOIN users u ON m.gestionnaire_id = u.id
          JOIN gestionnaire_residences gr ON m.copropriete_id = gr.copropriete_id
          WHERE gr.gestionnaire_id = ?
          ORDER BY m.created_at DESC
        `).all(req.user.id);
      }
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

    let coproId = req.user.role === 'gestionnaire' ? (copropriete_id || req.user.copropriete_id) : (copropriete_id || req.user.copropriete_id);
    if (req.user.role === 'gestionnaire' && coproId && !canGestionnaireAccessResidence(req.user.id, coproId)) {
      return res.status(403).json({ error: 'Accès refusé à cette résidence' });
    }

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

    // Notify all copropriétaires of the residence (non-blocking)
    const copropietaires = db.prepare(`
      SELECT id, nom, prenom, email FROM users
      WHERE role = 'copropietaire' AND copropriete_id = ? AND is_active = 1
    `).all(coproId);

    const gestNom = `${req.user.prenom} ${req.user.nom}`;
    for (const user of copropietaires) {
      sendMessageBroadcast({
        to: user.email,
        prenom: user.prenom,
        residence: message.copropriete_nom,
        titre,
        contenu,
        gestionnaire_nom: gestNom,
      }).catch(console.error);
    }

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

    // Gestionnaire can only delete messages from their residences
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, existing.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    db.prepare('DELETE FROM messages_diffusion WHERE id = ?').run(id);
    res.json({ message: 'Message supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
