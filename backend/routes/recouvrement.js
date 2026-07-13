'use strict';

const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { canGestionnaireAccessResidence } = require('../utils/access');
const { sendRelance } = require('../services/email');

const router = express.Router();

// GET /api/recouvrement/dashboard?copropriete_id=X
router.get('/dashboard', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const { copropriete_id } = req.query;
    if (!copropriete_id) return res.status(400).json({ error: 'copropriete_id requis' });
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const impayeurs = db.prepare(`
      SELECT
        u.id, u.nom, u.prenom, u.email, u.telephone,
        l.numero as lot_numero, l.type as lot_type,
        COUNT(cp.id) as nb_mois_impaye,
        COALESCE(SUM(cp.montant), 0) as montant_total_du,
        MIN(cp.mois) as premier_mois_impaye
      FROM users u
      LEFT JOIN lots l ON u.lot_id = l.id
      JOIN cotisations c ON c.user_id = u.id AND c.copropriete_id = ?
      JOIN cotisation_paiements cp ON cp.cotisation_id = c.id
        AND cp.statut IN ('En attente','En retard','Partiel')
        AND cp.mois <= strftime('%Y-%m', 'now')
      WHERE u.copropriete_id = ? AND u.is_active = 1
      GROUP BY u.id
      ORDER BY montant_total_du DESC
    `).all(copropriete_id, copropriete_id);

    const userIds = impayeurs.map((u) => u.id);
    let actions = [];
    if (userIds.length > 0) {
      actions = db.prepare(`
        SELECT ra.*, u.prenom as by_prenom, u.nom as by_nom
        FROM recouvrement_actions ra
        LEFT JOIN users u ON ra.created_by = u.id
        WHERE ra.user_id IN (${userIds.map(() => '?').join(',')})
          AND ra.copropriete_id = ?
        ORDER BY ra.created_at DESC
      `).all(...userIds, copropriete_id);
    }

    const actionsByUser = {};
    for (const a of actions) {
      if (!actionsByUser[a.user_id]) actionsByUser[a.user_id] = [];
      actionsByUser[a.user_id].push(a);
    }

    const result = impayeurs.map((u) => ({
      ...u,
      actions: actionsByUser[u.id] || [],
      derniere_action: (actionsByUser[u.id] || [])[0] || null,
    }));

    const total_du = result.reduce((s, u) => s + u.montant_total_du, 0);
    res.json({ impayeurs: result, total_du, nb_debiteurs: result.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recouvrement/actions?copropriete_id=X&user_id=Y — historique d'un copropriétaire
router.get('/actions', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const { copropriete_id, user_id } = req.query;
    if (!copropriete_id || !user_id) return res.status(400).json({ error: 'copropriete_id et user_id requis' });
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const rows = db.prepare(`
      SELECT ra.*, u.prenom as by_prenom, u.nom as by_nom
      FROM recouvrement_actions ra
      LEFT JOIN users u ON ra.created_by = u.id
      WHERE ra.user_id = ? AND ra.copropriete_id = ?
      ORDER BY ra.created_at DESC
    `).all(user_id, copropriete_id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recouvrement/actions — log an action (lettre)
router.post('/actions', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const { copropriete_id, user_id, type, canal, montant_du, notes } = req.body;
    if (!copropriete_id || !user_id || !type || !canal) {
      return res.status(400).json({ error: 'copropriete_id, user_id, type, canal requis' });
    }
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const statut = canal === 'Email' ? 'Envoyé' : 'À déposer';
    const r = db.prepare(`
      INSERT INTO recouvrement_actions (copropriete_id, user_id, type, canal, statut, montant_du, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(copropriete_id, user_id, type, canal, statut, montant_du || null, notes || null, req.user.id);
    res.status(201).json(db.prepare('SELECT * FROM recouvrement_actions WHERE id = ?').get(r.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/recouvrement/actions/:id/deposee — marquer lettre déposée
router.put('/actions/:id/deposee', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const action = db.prepare('SELECT * FROM recouvrement_actions WHERE id = ?').get(req.params.id);
    if (!action) return res.status(404).json({ error: 'Action non trouvée' });
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, action.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    db.prepare("UPDATE recouvrement_actions SET statut = 'Déposé' WHERE id = ?").run(req.params.id);
    res.json({ ...action, statut: 'Déposé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recouvrement/send-email — envoyer email + logger l'action
router.post('/send-email', authenticate, requireRole('gestionnaire', 'admin'), async (req, res) => {
  try {
    const { copropriete_id, user_id, type, montant_du } = req.body;
    if (!copropriete_id || !user_id || !type) {
      return res.status(400).json({ error: 'copropriete_id, user_id, type requis' });
    }
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const copro = db.prepare('SELECT nom, adresse FROM coproprietes WHERE id = ?').get(copropriete_id);
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const gestNom = `${req.user.prenom} ${req.user.nom}`;
    const montantStr = montant_du
      ? Number(montant_du).toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD'
      : '—';

    const templates = {
      'Rappel': {
        objet: `Rappel de paiement – ${copro?.nom}`,
        message: `Nous vous informons que des cotisations sont en attente de règlement pour un montant de ${montantStr} à ce jour.\n\nNous vous remercions de bien vouloir régulariser votre situation dans les meilleurs délais en utilisant l'un des modes de paiement indiqués ci-dessous.`,
      },
      'Relance': {
        objet: `Relance pour impayé – ${copro?.nom}`,
        message: `Malgré notre précédent rappel, nous constatons que votre cotisation d'un montant de ${montantStr} à ce jour reste impayée.\n\nNous vous demandons de procéder au règlement de cette somme dans les plus brefs délais en utilisant l'un des modes de paiement indiqués ci-dessous, afin d'éviter toute suite.`,
      },
      'Mise en demeure': {
        objet: `Mise en demeure – ${copro?.nom}`,
        message: `Nous avons le regret de constater que, malgré nos rappels successifs, votre cotisation d'un montant de ${montantStr} à ce jour demeure impayée.\n\nPar la présente, nous vous mettons en demeure de régulariser votre situation dans un délai de 8 jours à compter de la réception de ce courrier, faute de quoi nous nous verrons contraints d'engager les procédures légales nécessaires au recouvrement de cette créance.`,
      },
    };

    const tpl = templates[type] || templates['Rappel'];
    await sendRelance({
      to: target.email,
      prenom: target.prenom,
      type,
      objet: tpl.objet,
      message: tpl.message,
      residence: copro?.nom,
      gestionnaire_nom: gestNom,
    });

    const r = db.prepare(`
      INSERT INTO recouvrement_actions (copropriete_id, user_id, type, canal, statut, montant_du, created_by)
      VALUES (?, ?, ?, 'Email', 'Envoyé', ?, ?)
    `).run(copropriete_id, user_id, type, montant_du || null, req.user.id);

    res.status(201).json(db.prepare('SELECT * FROM recouvrement_actions WHERE id = ?').get(r.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
