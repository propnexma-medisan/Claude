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

    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

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
      SELECT u.id, u.nom, u.prenom, u.email, u.role, u.copropriete_id, u.lot_id, u.telephone, u.created_at, u.is_active, u.is_membre_bureau, u.signature_url,
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

// GET /api/auth/activate/:token — public, verify activation token and return user info
router.get('/activate/:token', (req, res) => {
  try {
    const { token } = req.params;
    const user = db.prepare(`
      SELECT u.id, u.nom, u.prenom, u.email, u.must_activate,
             c.nom as copropriete_nom
      FROM users u
      LEFT JOIN coproprietes c ON u.copropriete_id = c.id
      WHERE u.activation_token = ? AND u.is_active = 1
    `).get(token);
    if (!user) return res.status(404).json({ error: 'Lien invalide ou expiré' });
    res.json({ prenom: user.prenom, nom: user.nom, copropriete: user.copropriete_nom });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/activate/:token — public, set real email + new password and mark activated
router.post('/activate/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
    if (password.length < 6) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });

    const user = db.prepare(`SELECT * FROM users WHERE activation_token = ? AND is_active = 1`).get(token);
    if (!user) return res.status(404).json({ error: 'Lien invalide ou expiré' });

    // Check email not already taken by another account
    const emailConflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase().trim(), user.id);
    if (emailConflict) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const password_hash = await bcrypt.hash(password, 10);

    db.prepare(`
      UPDATE users SET email = ?, password_hash = ?, activation_token = NULL, must_activate = 0, last_login = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(email.toLowerCase().trim(), password_hash, user.id);

    // Notifier le gestionnaire de la résidence via WhatsApp Chatwoot
    try {
      const lot = db.prepare('SELECT numero FROM lots WHERE id = ?').get(user.lot_id);
      const gestionnaire = db.prepare(`
        SELECT u.prenom, u.nom, u.telephone
        FROM users u
        JOIN gestionnaire_residences gr ON gr.gestionnaire_id = u.id
        WHERE gr.copropriete_id = ? AND u.is_active = 1
        LIMIT 1
      `).get(user.copropriete_id);

      if (gestionnaire?.telephone) {
        const { sendWhatsAppMessage } = require('../services/chatwoot');
        const tel = gestionnaire.telephone.replace(/[\s\-]/g, '').replace(/^0/, '+212');
        const copro = db.prepare('SELECT nom FROM coproprietes WHERE id = ?').get(user.copropriete_id);
        const msg = `✅ *${user.prenom} ${user.nom}* vient d'activer son compte copropriétaire${lot ? ` (Lot ${lot.numero})` : ''} sur SyndicPro.\n\n🏢 Résidence : ${copro?.nom || ''}\n📧 ${email}`;
        sendWhatsAppMessage({ phone: tel, name: `${gestionnaire.prenom} ${gestionnaire.nom}`, message: msg }).catch(() => {});
      }
    } catch {}

    res.json({ message: 'Compte activé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
