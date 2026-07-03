const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database');
const { authenticate, signToken } = require('../middleware/auth');
const { getGestionnaireResidences } = require('../utils/access');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    const user = db.prepare(`
      SELECT u.*, c.nom as copropriete_nom
      FROM users u
      LEFT JOIN coproprietes c ON u.copropriete_id = c.id
      WHERE u.email = ? AND u.is_active = 1
    `).get(email.toLowerCase().trim());

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = signToken(user);

    const { password_hash, ...safeUser } = user;
    safeUser.coproprietes = user.role === 'gestionnaire' ? getGestionnaireResidences(user.id) : [];

    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT u.id, u.nom, u.prenom, u.email, u.role, u.copropriete_id, u.lot_id, u.telephone, u.created_at, u.is_active, u.is_membre_bureau,
             c.nom as copropriete_nom
      FROM users u
      LEFT JOIN coproprietes c ON u.copropriete_id = c.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(req.user.id);

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    user.coproprietes = user.role === 'gestionnaire' ? getGestionnaireResidences(user.id) : [];
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Déconnecté avec succès' });
});

module.exports = router;
