const express = require('express');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { canGestionnaireAccessResidence, getGestionnaireResidences } = require('../utils/access');
const { sendNouvelleDemandeAgence } = require('../services/email');

const router = express.Router();

function fullDemande(id) {
  return db.prepare(`
    SELECT d.*,
           u.nom as user_nom, u.prenom as user_prenom, u.email as user_email, u.telephone as user_telephone,
           l.numero as lot_numero, l.type as lot_type,
           c.nom as copropriete_nom, c.adresse as copropriete_adresse
    FROM demandes_agence d
    JOIN users u ON d.user_id = u.id
    LEFT JOIN lots l ON d.lot_id = l.id
    JOIN coproprietes c ON d.copropriete_id = c.id
    WHERE d.id = ?
  `).get(id);
}

// POST /api/agence/demandes — un copropriétaire dépose une demande vente/location
router.post('/demandes', authenticate, requireRole('copropietaire'), (req, res) => {
  try {
    const { type_demande, delai, prix_estime, canal_prefere, notes } = req.body;
    if (!type_demande || !['Vendre', 'Louer'].includes(type_demande)) {
      return res.status(400).json({ error: 'type_demande requis (Vendre ou Louer)' });
    }
    if (!req.user.copropriete_id) {
      return res.status(400).json({ error: 'Vous devez être associé à une résidence' });
    }

    const result = db.prepare(`
      INSERT INTO demandes_agence (copropriete_id, lot_id, user_id, type_demande, delai, prix_estime, canal_prefere, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.copropriete_id,
      req.user.lot_id || null,
      req.user.id,
      type_demande,
      delai || null,
      prix_estime ? parseFloat(prix_estime) : null,
      canal_prefere || null,
      notes || null
    );

    const demande = fullDemande(result.lastInsertRowid);

    sendNouvelleDemandeAgence({
      demande,
    }).catch(console.error);

    res.status(201).json(demande);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agence/demandes — liste des leads (gestionnaire scopé à ses résidences, admin voit tout)
router.get('/demandes', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const { statut, copropriete_id } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'gestionnaire') {
      const residences = getGestionnaireResidences(req.user.id).map((r) => r.id);
      if (!residences.length) return res.json([]);
      conditions.push(`d.copropriete_id IN (${residences.map(() => '?').join(',')})`);
      params.push(...residences);
    }
    if (copropriete_id) {
      conditions.push('d.copropriete_id = ?');
      params.push(copropriete_id);
    }
    if (statut) {
      conditions.push('d.statut = ?');
      params.push(statut);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const demandes = db.prepare(`
      SELECT d.*,
             u.nom as user_nom, u.prenom as user_prenom, u.email as user_email, u.telephone as user_telephone,
             l.numero as lot_numero, l.type as lot_type,
             c.nom as copropriete_nom, c.adresse as copropriete_adresse
      FROM demandes_agence d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN lots l ON d.lot_id = l.id
      JOIN coproprietes c ON d.copropriete_id = c.id
      ${where}
      ORDER BY d.created_at DESC
    `).all(...params);

    res.json(demandes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/agence/demandes/:id — mise à jour statut / notes internes
router.put('/demandes/:id', authenticate, requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM demandes_agence WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Demande non trouvée' });

    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, existing.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { statut, notes } = req.body;
    db.prepare(`
      UPDATE demandes_agence SET
        statut = ?, notes = ?
      WHERE id = ?
    `).run(
      statut !== undefined ? statut : existing.statut,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    );

    res.json(fullDemande(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
