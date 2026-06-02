const db = require('../database');

function canGestionnaireAccessResidence(gestionnaire_id, copropriete_id) {
  if (!gestionnaire_id || !copropriete_id) return false;
  return !!db.prepare(
    'SELECT 1 FROM gestionnaire_residences WHERE gestionnaire_id = ? AND copropriete_id = ?'
  ).get(gestionnaire_id, parseInt(copropriete_id));
}

// Sync junction table for a gestionnaire (replaces existing assignments)
function syncGestionnaireResidences(gestionnaire_id, copropriete_ids) {
  db.prepare('DELETE FROM gestionnaire_residences WHERE gestionnaire_id = ?').run(gestionnaire_id);
  for (const cid of copropriete_ids) {
    db.prepare('INSERT OR IGNORE INTO gestionnaire_residences (gestionnaire_id, copropriete_id) VALUES (?, ?)').run(gestionnaire_id, cid);
  }
}

// Get all residence IDs for a gestionnaire
function getGestionnaireResidences(gestionnaire_id) {
  return db.prepare(`
    SELECT c.id, c.nom FROM coproprietes c
    JOIN gestionnaire_residences gr ON c.id = gr.copropriete_id
    WHERE gr.gestionnaire_id = ?
    ORDER BY c.nom
  `).all(gestionnaire_id);
}

module.exports = { canGestionnaireAccessResidence, syncGestionnaireResidences, getGestionnaireResidences };
