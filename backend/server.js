const express = require('express');
const cors = require('cors');
const db = require('./database');
const { authenticate, requireRole } = require('./middleware/auth');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Public route — login
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All routes below require authentication
const copropietesRouter = require('./routes/coproprietes');
const lotsRouter = require('./routes/lots');
const chargesRouter = require('./routes/charges');
const assembleesRouter = require('./routes/assemblees');
const agPointsRouter = require('./routes/agpoints');
const usersRouter = require('./routes/users');
const ticketsRouter = require('./routes/tickets');
const messagesRouter = require('./routes/messages');
const financesRouter = require('./routes/finances');
const budgetsRouter = require('./routes/budgets');
const cotisationsRouter = require('./routes/cotisations');

app.use('/api/coproprietes', authenticate, copropietesRouter);
app.use('/api/lots', authenticate, lotsRouter);
app.use('/api/charges', authenticate, chargesRouter);
app.use('/api/assemblees', authenticate, assembleesRouter);
app.use('/api/ag-points', authenticate, agPointsRouter);
app.use('/api/users', usersRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/finances', financesRouter);
app.use('/api', budgetsRouter);
app.use('/api', cotisationsRouter);

// Dashboard stats (admin/gestionnaire)
app.get('/api/dashboard/stats', authenticate, (req, res) => {
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

    const nbGestionnaires = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('gestionnaire').count;
    const nbCopropietaires = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('copropietaire').count;

    const totalImpaye = db.prepare(`
      SELECT COALESCE(SUM(cr.montant), 0) as total
      FROM charge_repartitions cr
      WHERE cr.statut_paiement = 'Non payé'
    `).get().total;

    res.json({
      nbCoproprietes,
      nbLots,
      chargesEnAttente,
      chargesEnRetard,
      totalCollecte,
      prochaineAG,
      recentCharges,
      recentAGs,
      nbGestionnaires,
      nbCopropietaires,
      totalImpaye,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
