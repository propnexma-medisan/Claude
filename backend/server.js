const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const copropietesRouter = require('./routes/coproprietes');
const lotsRouter = require('./routes/lots');
const chargesRouter = require('./routes/charges');
const assembleesRouter = require('./routes/assemblees');
const agPointsRouter = require('./routes/agpoints');

app.use('/api/coproprietes', copropietesRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/charges', chargesRouter);
app.use('/api/assemblees', assembleesRouter);
app.use('/api/ag-points', agPointsRouter);

// Dashboard stats
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const nbCoproprietes = db.prepare('SELECT COUNT(*) as count FROM coproprietes').get().count;
    const nbLots = db.prepare('SELECT COUNT(*) as count FROM lots').get().count;

    const chargesEnAttente = db.prepare(`
      SELECT COALESCE(SUM(montant_total), 0) as total
      FROM charges
      WHERE statut IN ('En cours', 'En retard')
    `).get().total;

    const chargesEnRetard = db.prepare(`
      SELECT COALESCE(SUM(montant_total), 0) as total
      FROM charges
      WHERE statut = 'En retard'
    `).get().total;

    const totalCollecte = db.prepare(`
      SELECT COALESCE(SUM(cr.montant), 0) as total
      FROM charge_repartitions cr
      WHERE cr.statut_paiement = 'Payé'
    `).get().total;

    const prochaineAG = db.prepare(`
      SELECT a.*, c.nom as copropriete_nom
      FROM assemblees a
      JOIN coproprietes c ON a.copropriete_id = c.id
      WHERE a.date >= date('now') AND a.statut NOT IN ('Annulée', 'Terminée')
      ORDER BY a.date ASC, a.heure ASC
      LIMIT 1
    `).get();

    const recentCharges = db.prepare(`
      SELECT ch.id, ch.libelle, ch.montant_total, ch.statut, ch.date_echeance,
        c.nom as copropriete_nom
      FROM charges ch
      JOIN coproprietes c ON ch.copropriete_id = c.id
      ORDER BY ch.created_at DESC
      LIMIT 5
    `).all();

    const recentAGs = db.prepare(`
      SELECT a.id, a.date, a.heure, a.type, a.statut,
        c.nom as copropriete_nom
      FROM assemblees a
      JOIN coproprietes c ON a.copropriete_id = c.id
      ORDER BY a.created_at DESC
      LIMIT 3
    `).all();

    res.json({
      nbCoproprietes,
      nbLots,
      chargesEnAttente,
      chargesEnRetard,
      totalCollecte,
      prochaineAG,
      recentCharges,
      recentAGs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
