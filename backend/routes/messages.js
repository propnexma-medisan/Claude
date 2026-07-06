const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendMessageBroadcast } = require('../services/email');
const { canGestionnaireAccessResidence } = require('../utils/access');

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `msg-${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
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
    `SELECT * FROM message_pieces_jointes WHERE message_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at ASC`
  ).all(...ids);
  const byMsg = {};
  for (const pj of pjs) {
    if (!byMsg[pj.message_id]) byMsg[pj.message_id] = [];
    byMsg[pj.message_id].push({ ...pj, url: `/api/uploads/${pj.filename}` });
  }
  return messages.map((m) => ({ ...m, pieces_jointes: byMsg[m.id] || [] }));
}

// GET /api/messages
router.get('/', authenticate, (req, res) => {
  try {
    let msgs;
    if (req.user.role === 'admin') {
      msgs = db.prepare(`
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
        msgs = db.prepare(`
          SELECT m.*, c.nom as copropriete_nom, u.nom as gestionnaire_nom, u.prenom as gestionnaire_prenom
          FROM messages_diffusion m
          JOIN coproprietes c ON m.copropriete_id = c.id
          JOIN users u ON m.gestionnaire_id = u.id
          WHERE m.copropriete_id = ?
          ORDER BY m.created_at DESC
        `).all(copropriete_id);
      } else {
        msgs = db.prepare(`
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
      msgs = db.prepare(`
        SELECT m.*, c.nom as copropriete_nom, u.nom as gestionnaire_nom, u.prenom as gestionnaire_prenom
        FROM messages_diffusion m
        JOIN coproprietes c ON m.copropriete_id = c.id
        JOIN users u ON m.gestionnaire_id = u.id
        WHERE m.copropriete_id = ?
        ORDER BY m.created_at DESC
      `).all(req.user.copropriete_id);
    }
    res.json(attachPJ(msgs));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages — multipart form with optional files
router.post('/', authenticate, requireRole('gestionnaire', 'admin'), upload.array('files', 10), (req, res) => {
  try {
    const { titre, contenu, copropriete_id } = req.body;

    if (!titre || !contenu) {
      return res.status(400).json({ error: 'titre et contenu sont requis' });
    }

    let coproId = copropriete_id || req.user.copropriete_id;
    if (req.user.role === 'gestionnaire' && coproId && !canGestionnaireAccessResidence(req.user.id, coproId)) {
      return res.status(403).json({ error: 'Accès refusé à cette résidence' });
    }
    if (!coproId) return res.status(400).json({ error: 'copropriete_id requis' });

    const result = db.prepare(`
      INSERT INTO messages_diffusion (copropriete_id, gestionnaire_id, titre, contenu)
      VALUES (?, ?, ?, ?)
    `).run(coproId, req.user.id, titre, contenu);

    const msgId = result.lastInsertRowid;

    // Save uploaded files
    const files = req.files || [];
    const insertPJ = db.prepare(
      'INSERT INTO message_pieces_jointes (message_id, filename, original_name, mimetype) VALUES (?, ?, ?, ?)'
    );
    for (const f of files) {
      insertPJ.run(msgId, f.filename, f.originalname, f.mimetype);
    }

    const message = db.prepare(`
      SELECT m.*, c.nom as copropriete_nom, u.nom as gestionnaire_nom, u.prenom as gestionnaire_prenom
      FROM messages_diffusion m
      JOIN coproprietes c ON m.copropriete_id = c.id
      JOIN users u ON m.gestionnaire_id = u.id
      WHERE m.id = ?
    `).get(msgId);

    const pjs = db.prepare(
      'SELECT * FROM message_pieces_jointes WHERE message_id = ? ORDER BY created_at ASC'
    ).all(msgId).map((p) => ({ ...p, url: `/api/uploads/${p.filename}` }));

    // Email copropriétaires (non-blocking)
    const copropietaires = db.prepare(
      `SELECT id, nom, prenom, email FROM users WHERE role = 'copropietaire' AND copropriete_id = ? AND is_active = 1`
    ).all(coproId);
    const gestNom = `${req.user.prenom} ${req.user.nom}`;
    for (const u of copropietaires) {
      sendMessageBroadcast({
        to: u.email,
        prenom: u.prenom,
        residence: message.copropriete_nom,
        titre,
        contenu,
        gestionnaire_nom: gestNom,
      }).catch(console.error);
    }

    res.status(201).json({ ...message, pieces_jointes: pjs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/messages/pj/:id
router.delete('/pj/:id', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const pj = db.prepare('SELECT * FROM message_pieces_jointes WHERE id = ?').get(req.params.id);
    if (!pj) return res.status(404).json({ error: 'Fichier non trouvé' });

    const msg = db.prepare('SELECT * FROM messages_diffusion WHERE id = ?').get(pj.message_id);
    if (req.user.role === 'gestionnaire' && msg && !canGestionnaireAccessResidence(req.user.id, msg.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const filePath = path.join(uploadDir, pj.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM message_pieces_jointes WHERE id = ?').run(pj.id);
    res.json({ message: 'Fichier supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/messages/:id
router.delete('/:id', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM messages_diffusion WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Message non trouvé' });
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, existing.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    // Delete attached files from disk
    const pjs = db.prepare('SELECT * FROM message_pieces_jointes WHERE message_id = ?').all(existing.id);
    for (const pj of pjs) {
      const fp = path.join(uploadDir, pj.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    db.prepare('DELETE FROM messages_diffusion WHERE id = ?').run(req.params.id);
    res.json({ message: 'Message supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
