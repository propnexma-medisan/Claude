const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../database');
const { canGestionnaireAccessResidence } = require('../utils/access');

const uploadDir = path.join(__dirname, '../uploads');
const docUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
});

function canAccess(user, coproprieteId) {
  if (user.role === 'admin') return true;
  if (user.role === 'gestionnaire') return canGestionnaireAccessResidence(user.id, coproprieteId);
  return false;
}

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

// GET /api/coproprietes/:id/activation — tableau d'activation des copropriétaires
router.get('/:id/activation', (req, res) => {
  try {
    if (!canAccess(req.user, req.params.id)) return res.status(403).json({ error: 'Accès refusé' });
    const coproId = Number(req.params.id);

    const lots = db.prepare(`
      SELECT l.id as lot_id, l.numero, l.type,
        u.id as user_id, u.nom, u.prenom, u.email, u.telephone, u.created_at, u.last_login, u.whatsapp_invite_sent_at
      FROM lots l
      LEFT JOIN users u ON u.lot_id = l.id AND u.role = 'copropietaire' AND u.is_active = 1
      WHERE l.copropriete_id = ?
      ORDER BY l.numero ASC
    `).all(coproId);

    const total_lots = lots.length;
    const avec_compte = lots.filter(l => l.user_id).length;
    const actives = lots.filter(l => l.last_login).length;

    res.json({ total_lots, avec_compte, actives, lots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coproprietes/:id/documents
router.get('/:id/documents', (req, res) => {
  try {
    if (!canAccess(req.user, req.params.id)) return res.status(403).json({ error: 'Accès refusé' });
    const docs = db.prepare('SELECT * FROM documents_copropriete WHERE copropriete_id = ? ORDER BY type ASC, created_at DESC').all(req.params.id);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/coproprietes/:id/documents
router.post('/:id/documents', docUpload.single('document'), (req, res) => {
  try {
    if (!canAccess(req.user, req.params.id)) return res.status(403).json({ error: 'Accès refusé' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier PDF reçu' });
    const { type, nom } = req.body;
    if (!nom) return res.status(400).json({ error: 'Nom du document requis' });
    const url = `/api/uploads/${req.file.filename}`;
    const result = db.prepare(
      'INSERT INTO documents_copropriete (copropriete_id, type, nom, filename, url) VALUES (?, ?, ?, ?, ?)'
    ).run(req.params.id, type || 'autre', nom, req.file.filename, url);
    const doc = db.prepare('SELECT * FROM documents_copropriete WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/coproprietes/:id/documents/:docId
router.delete('/:id/documents/:docId', (req, res) => {
  try {
    if (!canAccess(req.user, req.params.id)) return res.status(403).json({ error: 'Accès refusé' });
    const doc = db.prepare('SELECT * FROM documents_copropriete WHERE id = ? AND copropriete_id = ?').get(req.params.docId, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document non trouvé' });
    try { fs.unlinkSync(path.join(uploadDir, doc.filename)); } catch {}
    db.prepare('DELETE FROM documents_copropriete WHERE id = ?').run(req.params.docId);
    res.json({ message: 'Document supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
