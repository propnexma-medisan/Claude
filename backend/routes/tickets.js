const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendNouveauTicket, sendReponseTicket, sendTicketCloture } = require('../services/email');
const { canGestionnaireAccessResidence } = require('../utils/access');

const APP_URL = process.env.APP_URL || 'https://syndicpro.propnex.ma';

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `ticket-${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    cb(null, ok);
  },
});

function attachPJ(messages) {
  if (!messages.length) return messages;
  const ids = messages.map((m) => m.id);
  const pjs = db.prepare(
    `SELECT * FROM ticket_message_attachments WHERE ticket_message_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at ASC`
  ).all(...ids);
  const byMsg = {};
  for (const pj of pjs) {
    if (!byMsg[pj.ticket_message_id]) byMsg[pj.ticket_message_id] = [];
    byMsg[pj.ticket_message_id].push({ ...pj, url: `/api/uploads/${pj.filename}` });
  }
  return messages.map((m) => ({ ...m, attachments: byMsg[m.id] || [] }));
}

// GET /api/tickets
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
    `).run(copropriete_id, lot_id || null, createur_id, titre, description, categorie || 'Général', priorite || 'Normale');

    const ticket = db.prepare(`
      SELECT t.*, u.nom as createur_nom, u.prenom as createur_prenom,
             c.nom as copropriete_nom
      FROM tickets t
      JOIN users u ON t.createur_id = u.id
      JOIN coproprietes c ON t.copropriete_id = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

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

    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, existing.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé à ce ticket' });
    }

    const { statut, priorite } = req.body;
    const newStatut = statut || existing.statut;

    db.prepare(`
      UPDATE tickets SET statut = ?, priorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newStatut, priorite || existing.priorite, id);

    const updated = db.prepare(`
      SELECT t.*, u.nom as createur_nom, u.prenom as createur_prenom,
             c.nom as copropriete_nom
      FROM tickets t
      JOIN users u ON t.createur_id = u.id
      JOIN coproprietes c ON t.copropriete_id = c.id
      WHERE t.id = ?
    `).get(id);

    // Send email when status changes to Résolu or Fermé (only if status actually changed)
    if (statut && statut !== existing.statut && (statut === 'Résolu' || statut === 'Fermé')) {
      const createur = db.prepare('SELECT id, nom, prenom, email FROM users WHERE id = ?').get(existing.createur_id);
      if (createur) {
        sendTicketCloture({
          to: createur.email,
          prenom: createur.prenom,
          titre: existing.titre,
          resolution: `Votre ticket a été marqué comme "${statut}" par votre gestionnaire.`,
        }).catch(console.error);
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/:id/messages — get thread with attachments
router.get('/:id/messages', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });

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

    res.json(attachPJ(messages));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/messages — add message with optional file attachments
router.post('/:id/messages', authenticate, upload.array('attachments', 5), (req, res) => {
  try {
    const { id } = req.params;
    const message = (req.body.message || '').trim();
    const files = req.files || [];

    if (!message && files.length === 0) {
      return res.status(400).json({ error: 'Un message ou une pièce jointe est requis' });
    }

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });

    if (req.user.role === 'copropietaire' && ticket.createur_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, ticket.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const result = db.prepare(`
      INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)
    `).run(id, req.user.id, message);

    const msgId = result.lastInsertRowid;

    // Store attachments
    for (const file of files) {
      db.prepare(`
        INSERT INTO ticket_message_attachments (ticket_message_id, filename, original_name, mimetype, size)
        VALUES (?, ?, ?, ?, ?)
      `).run(msgId, file.filename, file.originalname, file.mimetype, file.size);
    }

    db.prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

    const msg = db.prepare(`
      SELECT tm.*, u.nom, u.prenom, u.role as user_role
      FROM ticket_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = ?
    `).get(msgId);

    msg.attachments = files.map((f) => ({
      filename: f.filename,
      original_name: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      url: `/api/uploads/${f.filename}`,
    }));

    // Email notifications
    const { nouveauStatut } = req.body;
    const isResolved = nouveauStatut === 'Résolu' || nouveauStatut === 'Fermé';

    if (req.user.role === 'gestionnaire' || req.user.role === 'admin') {
      const createur = db.prepare('SELECT id, nom, prenom, email FROM users WHERE id = ?').get(ticket.createur_id);
      if (createur) {
        if (isResolved) {
          sendTicketCloture({
            to: createur.email,
            prenom: createur.prenom,
            titre: ticket.titre,
            resolution: message || `Ticket clôturé avec ${files.length} pièce(s) jointe(s)`,
          }).catch(console.error);
        } else {
          sendReponseTicket({
            to: createur.email,
            prenom: createur.prenom,
            titre: ticket.titre,
            reponse: message || `Le gestionnaire a joint ${files.length} fichier(s) à votre ticket.`,
            auteur_reponse: `${req.user.prenom} ${req.user.nom}`,
            statut: nouveauStatut || ticket.statut,
            lien: `${APP_URL}/tickets/${ticket.id}`,
          }).catch(console.error);
        }
      }
    } else {
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
          reponse: message || `Le copropriétaire a joint ${files.length} fichier(s).`,
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
