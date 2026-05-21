const express = require('express');
const router = express.Router();
const db = require('../database');

// GET all assemblees with copropriete name
router.get('/', (req, res) => {
  try {
    const assemblees = db.prepare(`
      SELECT a.*, c.nom as copropriete_nom,
        (SELECT COUNT(*) FROM ag_points WHERE assemblee_id = a.id) as nb_points
      FROM assemblees a
      LEFT JOIN coproprietes c ON a.copropriete_id = c.id
      ORDER BY a.date DESC, a.heure DESC
    `).all();
    res.json(assemblees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single assemblee with points
router.get('/:id', (req, res) => {
  try {
    const assemblee = db.prepare(`
      SELECT a.*, c.nom as copropriete_nom
      FROM assemblees a
      LEFT JOIN coproprietes c ON a.copropriete_id = c.id
      WHERE a.id = ?
    `).get(req.params.id);
    if (!assemblee) return res.status(404).json({ error: 'Assemblée non trouvée' });

    const points = db.prepare(`
      SELECT * FROM ag_points WHERE assemblee_id = ? ORDER BY numero ASC
    `).all(req.params.id);

    res.json({ ...assemblee, points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create assemblee
router.post('/', (req, res) => {
  try {
    const { copropriete_id, date, heure, lieu, type, statut, convocations_envoyees } = req.body;
    if (!copropriete_id || !date || !heure || !lieu) {
      return res.status(400).json({ error: 'Les champs copropriete_id, date, heure et lieu sont requis' });
    }

    const validTypes = ['Ordinaire', 'Extraordinaire'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: 'Type d\'assemblée invalide' });
    }

    const validStatuts = ['Planifiée', 'En cours', 'Terminée', 'Annulée'];
    if (statut && !validStatuts.includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const result = db.prepare(`
      INSERT INTO assemblees (copropriete_id, date, heure, lieu, type, statut, convocations_envoyees)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      copropriete_id,
      date,
      heure,
      lieu,
      type || 'Ordinaire',
      statut || 'Planifiée',
      convocations_envoyees ? 1 : 0
    );

    const newAssemblee = db.prepare(`
      SELECT a.*, c.nom as copropriete_nom
      FROM assemblees a
      LEFT JOIN coproprietes c ON a.copropriete_id = c.id
      WHERE a.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(newAssemblee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update assemblee
router.put('/:id', (req, res) => {
  try {
    const { date, heure, lieu, type, statut, convocations_envoyees } = req.body;
    const existing = db.prepare('SELECT id FROM assemblees WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Assemblée non trouvée' });

    db.prepare(`
      UPDATE assemblees SET date = ?, heure = ?, lieu = ?, type = ?, statut = ?, convocations_envoyees = ?
      WHERE id = ?
    `).run(date, heure, lieu, type, statut, convocations_envoyees ? 1 : 0, req.params.id);

    const updated = db.prepare(`
      SELECT a.*, c.nom as copropriete_nom
      FROM assemblees a
      LEFT JOIN coproprietes c ON a.copropriete_id = c.id
      WHERE a.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE assemblee
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM assemblees WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Assemblée non trouvée' });

    db.prepare('DELETE FROM assemblees WHERE id = ?').run(req.params.id);
    res.json({ message: 'Assemblée supprimée avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET points for an assemblee
router.get('/:id/points', (req, res) => {
  try {
    const points = db.prepare(`
      SELECT * FROM ag_points WHERE assemblee_id = ? ORDER BY numero ASC
    `).all(req.params.id);
    res.json(points);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create point for assemblee
router.post('/:id/points', (req, res) => {
  try {
    const { numero, libelle, description, type_vote, resultat, votes_pour, votes_contre, votes_abstention } = req.body;
    if (!libelle) {
      return res.status(400).json({ error: 'Le libellé est requis' });
    }

    const validTypeVote = ['Simple majorité', 'Double majorité', 'Unanimité'];
    if (type_vote && !validTypeVote.includes(type_vote)) {
      return res.status(400).json({ error: 'Type de vote invalide' });
    }

    const validResultat = ['Approuvé', 'Refusé', 'Ajourné', null, undefined];
    if (resultat !== null && resultat !== undefined && resultat !== '' && !['Approuvé', 'Refusé', 'Ajourné'].includes(resultat)) {
      return res.status(400).json({ error: 'Résultat invalide' });
    }

    // Auto-assign numero if not provided
    let pointNumero = numero;
    if (!pointNumero) {
      const maxNum = db.prepare('SELECT MAX(numero) as max FROM ag_points WHERE assemblee_id = ?').get(req.params.id);
      pointNumero = (maxNum.max || 0) + 1;
    }

    const result = db.prepare(`
      INSERT INTO ag_points (assemblee_id, numero, libelle, description, type_vote, resultat, votes_pour, votes_contre, votes_abstention)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      pointNumero,
      libelle,
      description || null,
      type_vote || 'Simple majorité',
      resultat || null,
      votes_pour || 0,
      votes_contre || 0,
      votes_abstention || 0
    );

    const newPoint = db.prepare('SELECT * FROM ag_points WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newPoint);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
