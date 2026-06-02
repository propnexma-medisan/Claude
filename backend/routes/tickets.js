const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendNouveauTicket, sendReponseTicket, sendTicketCloture } = require('../services/email');
const { canGestionnaireAccessResidence } = require('../utils/access');

const APP_URL = process.env.APP_URL || 'https://syndicpro.propnex.ma';

const router = express.Router();

// GET /api/tickets
// gestionnaire: tickets of their residence(s)
// copropriétaire: own tickets
router.get('/', authenticate, (req, res) => {
  try {
    let tickets;

    if (req.user.role === 'admin') {
      tickets = db.prepare(`
        SELECT t.*, u.nom as createur_nom, u.prenom as createur_prenom,
               c.nom as copropriete_nom, l.numero as lot_numero
        FROM tickets t
        JOIN users u ON t.createur_id = u.id
        JOIN coproprietes c ON t.copropriete_id = c.id
        LEFT JOIN lots l ON t.lot_id = l.id
        ORDER BY t.created_at DESC
      `).all();
    } else if (req.user.role === 'gestionnaire') {
      const { copropriete_id } = req.query;
      if (copropriete_id) {
        if (!canGestionnaireAccessResidence(req.user.id, copropriete_id)) {
          return res.status(403).json({ error: 'Accès refusé à cette résidence' });
        }
        tickets = db.prepare(`
          SELECT t.*, u.nom as createur_nom, u.prenom as createur_prenom,
                 c.nom as copropriete_nom, l.numero as lot_numero
          FROM tickets t
          JOIN users u ON t.createur_id = u.id
          JOIN coproprietes c ON t.copropriete_id = c.id
          LEFT JOIN lots l ON t.lot_id = l.id
          WHERE t.copropriete_id = ?
          ORDER BY t.created_at DESC
        `).all(copropriete_id);
      } else {
        tickets = db.prepare(`
          SELECT t.*, u.nom as createur_nom, u.prenom as createur_prenom,
                 c.nom as copropriete_nom, l.numero as lot_numero
          FROM tickets t
          JOIN users u ON t.createur_id = u.id
          JOIN coproprietes c ON t.copropriete_id = c.id
          LEFT JOIN lots l ON t.lot_id = l.id
          JOIN gestionnaire_residences gr ON t.copropriete_id = gr.copropriete_id
          WHERE gr.gestionnaire_id = ?
          ORDER BY t.created_at DESC
        `).all(req.user.id);
      }
    } else {
      // copropietaire
      tickets = db.prepare(`
        SELECT t.*, u.nom as createur_nom, u.prenom as createur_prenom,
               c.nom as copropriete_nom, l.numero as lot_numero
        FROM tickets t
        JOIN users u ON t.createur_id = u.id
        JOIN coproprietes c ON t.copropriete_id = c.id
        LEFT JOIN lots l ON t.lot_id = l.id
        WHERE t.createur_id = ?
        ORDER BY t.created_at DESC
      `).all(req.user.id);
    }

    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets — copropriétaire creates ticket
router.post('/', authenticate, (req, res) => {
  try {
    const { titre, description, categorie, priorite } = req.body;

    if (!titre || !description) {
      return res.status(400).json({ error: 'titre et description sont requis' });
    }

    const copropriete_id = req.user.copropriete_id;
    const lot_id = req.user.lot_id;
    const createur_id = req.user.id;

    if (!copropriete_id) {
      return res.status(400).json({ error: 'Vous devez être associé à une résidence pour créer un ticket' });
    }

    const result = db.prepare(`
      INSERT INTO tickets (copropriete_id, lot_id, createur_id, titre, description, categorie, priorite)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      copropriete_id,
      lot_id || null,
      createur_id,
      titre,
      description,
      categorie || 'Général',
      priorite || 'Normale'
    );

    const ticket = db.prepare(`
      SELECT t.*, u.nom as createur_nom, u.prenom as createur_prenom,
             c.nom as copropriete_nom
      FROM tickets t
      JOIN users u ON t.createur_id = u.id
      JOIN coproprietes c ON t.copropriete_id = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    // Notify gestionnaire of the residence (non-blocking)
    const gestionnaire = db.prepare(`
      SELECT id, nom, prenom, email FROM users
      WHERE role = 'gestionnaire' AND copropriete_id = ?
      LIMIT 1
    `).get(copropriete_id);

    if (gestionnaire) {
      sendNouveauTicket({
        to: gestionnaire.email,
        gestionnaire_prenom: gestionnaire.prenom,
        copro_nom: req.user.nom,
        copro_prenom: req.user.prenom,
        titre: ticket.titre,
        description: ticket.description,
        categorie: ticket.categorie,
        priorite: ticket.priorite,
        lien: `${APP_URL}/tickets/${ticket.id}`,
      }).catch(console.error);
    }

    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tickets/:id — gestionnaire updates statut/priorite
router.put('/:id', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Ticket non trouvé' });

    // Gestionnaire can only update tickets in their residences
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, existing.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé à ce ticket' });
    }

    const { statut, priorite } = req.body;

    db.prepare(`
      UPDATE tickets SET statut = ?, priorite = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      statut || existing.statut,
      priorite || existing.priorite,
      id
    );

    const updated = db.prepare(`
      SELECT t.*, u.nom as createur_nom, u.prenom as createur_prenom,
             c.nom as copropriete_nom
      FROM tickets t
      JOIN users u ON t.createur_id = u.id
      JOIN coproprietes c ON t.copropriete_id = c.id
      WHERE t.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/:id/messages — get thread
router.get('/:id/messages', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });

    // Access control
    if (req.user.role === 'copropietaire' && ticket.createur_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, ticket.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const messages = db.prepare(`
      SELECT tm.*, u.nom, u.prenom, u.role as user_role
      FROM ticket_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.ticket_id = ?
      ORDER BY tm.created_at ASC
    `).all(id);

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/messages — add message (gestionnaire or ticket owner)
router.post('/:id/messages', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) return res.status(400).json({ error: 'message est requis' });

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });

    // Access control
    if (req.user.role === 'copropietaire' && ticket.createur_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, ticket.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const result = db.prepare(`
      INSERT INTO ticket_messages (ticket_id, user_id, message)
      VALUES (?, ?, ?)
    `).run(id, req.user.id, message);

    // Update ticket updated_at
    db.prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

    const msg = db.prepare(`
      SELECT tm.*, u.nom, u.prenom, u.role as user_role
      FROM ticket_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = ?
    `).get(result.lastInsertRowid);

    // Email notifications for ticket messages (non-blocking)
    const { statut: nouveauStatut } = req.body;
    const isResolved = nouveauStatut === 'Résolu' || nouveauStatut === 'Fermé';

    if (req.user.role === 'gestionnaire' || req.user.role === 'admin') {
      // Gestionnaire replied → notify ticket creator (copropriétaire)
      const createur = db.prepare('SELECT id, nom, prenom, email FROM users WHERE id = ?').get(ticket.createur_id);
      if (createur) {
        if (isResolved) {
          sendTicketCloture({
            to: createur.email,
            prenom: createur.prenom,
            titre: ticket.titre,
            resolution: message,
          }).catch(console.error);
        } else {
          sendReponseTicket({
            to: createur.email,
            prenom: createur.prenom,
            titre: ticket.titre,
            reponse: message,
            auteur_reponse: `${req.user.prenom} ${req.user.nom}`,
            statut: nouveauStatut || ticket.statut,
            lien: `${APP_URL}/tickets/${ticket.id}`,
          }).catch(console.error);
        }
      }
    } else {
      // Copropriétaire replied → notify gestionnaire
      const gestionnaire = db.prepare(`
        SELECT id, nom, prenom, email FROM users
        WHERE role = 'gestionnaire' AND copropriete_id = ?
        LIMIT 1
      `).get(ticket.copropriete_id);
      if (gestionnaire) {
        sendReponseTicket({
          to: gestionnaire.email,
          prenom: gestionnaire.prenom,
          titre: ticket.titre,
          reponse: message,
          auteur_reponse: `${req.user.prenom} ${req.user.nom}`,
          statut: nouveauStatut || ticket.statut,
          lien: `${APP_URL}/tickets/${ticket.id}`,
        }).catch(console.error);
      }
    }

    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
