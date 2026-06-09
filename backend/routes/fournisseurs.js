const express = require('express');
const router = express.Router();
const db = require('../database');
const { canGestionnaireAccessResidence } = require('../utils/access');

function canAccess(user, coproprieteId) {
  if (user.role === 'admin') return true;
  if (user.role === 'gestionnaire') return canGestionnaireAccessResidence(user.id, coproprieteId);
  return false;
}

// GET /api/fournisseurs?copropriete_id=X
router.get('/', (req, res) => {
  try {
    const { copropriete_id } = req.query;
    if (!copropriete_id) return res.status(400).json({ error: 'copropriete_id requis' });
    if (!canAccess(req.user, copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });

    const fournisseurs = db.prepare(`
      SELECT f.*,
        (SELECT COUNT(*) FROM contrats c WHERE c.fournisseur_id = f.id) as nb_contrats
      FROM fournisseurs f
      WHERE f.copropriete_id = ?
      ORDER BY f.nom ASC
    `).all(copropriete_id);
    res.json(fournisseurs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fournisseurs
router.post('/', (req, res) => {
  try {
    const { copropriete_id, nom, categorie, contact_nom, contact_email, contact_tel, adresse, notes } = req.body;
    if (!copropriete_id || !nom) return res.status(400).json({ error: 'copropriete_id et nom requis' });
    if (!canAccess(req.user, copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });

    const result = db.prepare(`
      INSERT INTO fournisseurs (copropriete_id, nom, categorie, contact_nom, contact_email, contact_tel, adresse, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(copropriete_id, nom, categorie || 'Divers', contact_nom || null, contact_email || null, contact_tel || null, adresse || null, notes || null);

    const fournisseur = db.prepare(`
      SELECT f.*, 0 as nb_contrats FROM fournisseurs f WHERE f.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(fournisseur);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/fournisseurs/:id
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM fournisseurs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Fournisseur non trouvé' });
    if (!canAccess(req.user, existing.copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });

    const { nom, categorie, contact_nom, contact_email, contact_tel, adresse, notes } = req.body;
    db.prepare(`
      UPDATE fournisseurs SET nom = ?, categorie = ?, contact_nom = ?, contact_email = ?, contact_tel = ?, adresse = ?, notes = ?
      WHERE id = ?
    `).run(
      nom || existing.nom,
      categorie || existing.categorie,
      contact_nom !== undefined ? contact_nom : existing.contact_nom,
      contact_email !== undefined ? contact_email : existing.contact_email,
      contact_tel !== undefined ? contact_tel : existing.contact_tel,
      adresse !== undefined ? adresse : existing.adresse,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    );

    const updated = db.prepare(`
      SELECT f.*, (SELECT COUNT(*) FROM contrats c WHERE c.fournisseur_id = f.id) as nb_contrats
      FROM fournisseurs f WHERE f.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/fournisseurs/:id
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM fournisseurs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Fournisseur non trouvé' });
    if (!canAccess(req.user, existing.copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });
    db.prepare('DELETE FROM fournisseurs WHERE id = ?').run(req.params.id);
    res.json({ message: 'Fournisseur supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fournisseurs/:id/contrats
router.get('/:id/contrats', (req, res) => {
  try {
    const fournisseur = db.prepare('SELECT * FROM fournisseurs WHERE id = ?').get(req.params.id);
    if (!fournisseur) return res.status(404).json({ error: 'Fournisseur non trouvé' });
    if (!canAccess(req.user, fournisseur.copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });

    const contrats = db.prepare('SELECT * FROM contrats WHERE fournisseur_id = ? ORDER BY date_debut DESC').all(req.params.id);
    res.json(contrats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fournisseurs/:id/contrats
router.post('/:id/contrats', (req, res) => {
  try {
    const fournisseur = db.prepare('SELECT * FROM fournisseurs WHERE id = ?').get(req.params.id);
    if (!fournisseur) return res.status(404).json({ error: 'Fournisseur non trouvé' });
    if (!canAccess(req.user, fournisseur.copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });

    const { titre, type_contrat, montant_annuel, date_debut, date_fin, statut, notes } = req.body;
    if (!titre) return res.status(400).json({ error: 'titre requis' });

    const result = db.prepare(`
      INSERT INTO contrats (fournisseur_id, copropriete_id, titre, type_contrat, montant_annuel, date_debut, date_fin, statut, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id, fournisseur.copropriete_id, titre,
      type_contrat || 'Maintenance',
      montant_annuel || null,
      date_debut || null,
      date_fin || null,
      statut || 'Actif',
      notes || null
    );

    const contrat = db.prepare('SELECT * FROM contrats WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(contrat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/fournisseurs/contrats/:id
router.put('/contrats/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM contrats WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Contrat non trouvé' });
    const fournisseur = db.prepare('SELECT * FROM fournisseurs WHERE id = ?').get(existing.fournisseur_id);
    if (!canAccess(req.user, fournisseur.copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });

    const { titre, type_contrat, montant_annuel, date_debut, date_fin, statut, notes } = req.body;
    db.prepare(`
      UPDATE contrats SET titre = ?, type_contrat = ?, montant_annuel = ?, date_debut = ?, date_fin = ?, statut = ?, notes = ?
      WHERE id = ?
    `).run(
      titre || existing.titre,
      type_contrat || existing.type_contrat,
      montant_annuel !== undefined ? montant_annuel : existing.montant_annuel,
      date_debut !== undefined ? date_debut : existing.date_debut,
      date_fin !== undefined ? date_fin : existing.date_fin,
      statut || existing.statut,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM contrats WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/fournisseurs/contrats/:id
router.delete('/contrats/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM contrats WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Contrat non trouvé' });
    const fournisseur = db.prepare('SELECT * FROM fournisseurs WHERE id = ?').get(existing.fournisseur_id);
    if (!canAccess(req.user, fournisseur.copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });
    db.prepare('DELETE FROM contrats WHERE id = ?').run(req.params.id);
    res.json({ message: 'Contrat supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
