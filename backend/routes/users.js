const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendBienvenue } = require('../services/email');

const router = express.Router();

// GET /api/users — admin only, list all users with copropriete info
router.get('/', authenticate, requireRole('admin'), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.nom, u.prenom, u.email, u.role, u.copropriete_id, u.lot_id, u.telephone, u.created_at, u.is_active,
             c.nom as copropriete_nom
      FROM users u
      LEFT JOIN coproprietes c ON u.copropriete_id = c.id
      ORDER BY u.created_at DESC
    `).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/by-residence/:coproprieteId — gestionnaire: list copropriétaires of their residence
router.get('/by-residence/:coproprieteId', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const { coproprieteId } = req.params;

    // Gestionnaire can only see their own residence
    if (req.user.role === 'gestionnaire' && req.user.copropriete_id !== parseInt(coproprieteId)) {
      return res.status(403).json({ error: 'Accès refusé à cette résidence' });
    }

    const users = db.prepare(`
      SELECT u.id, u.nom, u.prenom, u.email, u.role, u.copropriete_id, u.lot_id, u.telephone, u.created_at, u.is_active,
             l.numero as lot_numero, l.type as lot_type, l.surface as lot_surface, l.tantiemes as lot_tantiemes
      FROM users u
      LEFT JOIN lots l ON u.lot_id = l.id
      WHERE u.copropriete_id = ? AND u.role = 'copropietaire'
      ORDER BY u.nom ASC
    `).all(coproprieteId);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — admin or gestionnaire (gestionnaire can only create copropietaires for their residence)
router.post('/', authenticate, async (req, res) => {
  try {
    const { nom, prenom, email, password, role, copropriete_id, lot_id, telephone } = req.body;

    if (!nom || !prenom || !email || !password || !role) {
      return res.status(400).json({ error: 'nom, prenom, email, password et role sont requis' });
    }

    const isAdmin = req.user.role === 'admin';
    const isGestionnaire = req.user.role === 'gestionnaire';

    // Gestionnaire can only create copropietaires for their own residence
    if (isGestionnaire) {
      if (role !== 'copropietaire') {
        return res.status(403).json({ error: 'Accès refusé : rôle insuffisant' });
      }
      if (parseInt(copropriete_id) !== req.user.copropriete_id) {
        return res.status(403).json({ error: 'Accès refusé à cette résidence' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ error: 'Accès refusé : rôle insuffisant' });
    }

    const validRoles = ['gestionnaire', 'copropietaire', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const plainPassword = password;
    const password_hash = await bcrypt.hash(plainPassword, 10);

    const result = db.prepare(`
      INSERT INTO users (nom, prenom, email, password_hash, role, copropriete_id, lot_id, telephone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(nom, prenom, email.toLowerCase().trim(), password_hash, role, copropriete_id || null, lot_id || null, telephone || null);

    const user = db.prepare(`
      SELECT u.id, u.nom, u.prenom, u.email, u.role, u.copropriete_id, u.lot_id, u.telephone, u.created_at, u.is_active,
             c.nom as copropriete_nom
      FROM users u
      LEFT JOIN coproprietes c ON u.copropriete_id = c.id
      WHERE u.id = ?
    `).get(result.lastInsertRowid);

    // Send welcome email (non-blocking)
    sendBienvenue({
      to: user.email,
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      password: plainPassword,
      role: user.role,
      residence: user.copropriete_nom || null,
    }).catch(console.error);

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id — admin or self (profile update)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const isSelf = req.user.id === parseInt(id);
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const { nom, prenom, email, telephone, password, copropriete_id, lot_id, role, is_active } = req.body;

    let password_hash = existing.password_hash;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    // Non-admin users can only update their own basic info
    const newRole = isAdmin ? (role || existing.role) : existing.role;
    const newCoproId = isAdmin ? (copropriete_id !== undefined ? copropriete_id : existing.copropriete_id) : existing.copropriete_id;
    const newLotId = isAdmin ? (lot_id !== undefined ? lot_id : existing.lot_id) : existing.lot_id;
    const newIsActive = isAdmin ? (is_active !== undefined ? is_active : existing.is_active) : existing.is_active;

    db.prepare(`
      UPDATE users SET nom = ?, prenom = ?, email = ?, telephone = ?, password_hash = ?,
        copropriete_id = ?, lot_id = ?, role = ?, is_active = ?
      WHERE id = ?
    `).run(
      nom || existing.nom,
      prenom || existing.prenom,
      email ? email.toLowerCase().trim() : existing.email,
      telephone !== undefined ? telephone : existing.telephone,
      password_hash,
      newCoproId || null,
      newLotId || null,
      newRole,
      newIsActive,
      id
    );

    const updated = db.prepare(`
      SELECT u.id, u.nom, u.prenom, u.email, u.role, u.copropriete_id, u.lot_id, u.telephone, u.created_at, u.is_active,
             c.nom as copropriete_nom
      FROM users u
      LEFT JOIN coproprietes c ON u.copropriete_id = c.id
      WHERE u.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id — admin or gestionnaire (gestionnaire can only delete copropietaires in their residence)
router.delete('/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const isAdmin = req.user.role === 'admin';
    const isGestionnaire = req.user.role === 'gestionnaire';

    if (isGestionnaire) {
      if (existing.role !== 'copropietaire' || existing.copropriete_id !== req.user.copropriete_id) {
        return res.status(403).json({ error: 'Accès refusé' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
