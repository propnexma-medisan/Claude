require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('./database');
const { authenticate, requireRole } = require('./middleware/auth');

// Setup upload storage
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowed = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
  cb(null, allowed);
}});

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

// Serve uploaded files — both paths so Nginx proxy (/api/uploads) and direct (/uploads) work
app.use('/uploads', express.static(uploadDir));
app.use('/api/uploads', express.static(uploadDir));

// Upload endpoint (authenticated)
app.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  res.json({ url: `/api/uploads/${req.file.filename}` });
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
const fournisseursRouter = require('./routes/fournisseurs');
const recouvrementRouter = require('./routes/recouvrement');
const adminRouter = require('./routes/admin');

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
app.use('/api/fournisseurs', authenticate, fournisseursRouter);
app.use('/api/recouvrement', authenticate, recouvrementRouter);
app.use('/api/admin', authenticate, requireRole('admin'), adminRouter);

// Rapport cotisations — accessible admin + gestionnaire
const adminRouter2 = require('./routes/admin');
app.get('/api/rapports/cotisations', authenticate, (req, res) => {
  if (!['admin', 'gestionnaire'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  // Proxy to admin handler logic inline
  try {
    const db = require('./database');
    const { copropriete_id, nom } = req.query;
    let copropriete;
    if (copropriete_id) {
      copropriete = db.prepare('SELECT * FROM coproprietes WHERE id = ?').get(copropriete_id);
    } else if (nom) {
      copropriete = db.prepare('SELECT * FROM coproprietes WHERE nom LIKE ?').get(`%${nom}%`);
    } else {
      return res.status(400).json({ error: 'Paramètre copropriete_id ou nom requis' });
    }
    if (!copropriete) return res.status(404).json({ error: 'Résidence introuvable' });

    const copropietaires = db.prepare(`
      SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.is_active,
        l.id as lot_id, l.numero as lot_numero, l.type as lot_type, l.tantiemes,
        cot.id as cotisation_id, cot.montant_mensuel,
        cot.date_debut, cot.date_fin, cot.statut as cotisation_statut
      FROM users u
      LEFT JOIN lots l ON l.id = u.lot_id
      LEFT JOIN cotisations cot ON cot.user_id = u.id AND cot.copropriete_id = ?
        AND cot.statut IN ('Active','Expirée')
        AND cot.id = (
          SELECT id FROM cotisations WHERE user_id = u.id AND copropriete_id = ?
            AND statut IN ('Active','Expirée')
          ORDER BY CASE statut WHEN 'Active' THEN 0 ELSE 1 END, date_fin DESC LIMIT 1
        )
      WHERE u.copropriete_id = ? AND u.role = 'copropietaire'
      ORDER BY l.numero ASC
    `).all(copropriete.id, copropriete.id, copropriete.id);

    const enriched = copropietaires.map(cp => {
      let p = { total_mois: 0, mois_payes: 0, mois_en_retard: 0, mois_en_attente: 0, total_attendu: 0, total_encaisse: 0 };
      if (cp.cotisation_id) {
        const rows = db.prepare(`
          SELECT statut, SUM(montant) as ms,
            SUM(COALESCE(montant_regle, CASE WHEN statut='Payé' THEN montant ELSE 0 END)) as es,
            COUNT(*) as nb
          FROM cotisation_paiements WHERE cotisation_id = ? GROUP BY statut
        `).all(cp.cotisation_id);
        rows.forEach(r => {
          p.total_mois += r.nb; p.total_attendu += r.ms || 0;
          if (r.statut === 'Payé') { p.mois_payes += r.nb; p.total_encaisse += r.es || 0; }
          else if (r.statut === 'En retard') p.mois_en_retard += r.nb;
          else if (r.statut === 'En attente') p.mois_en_attente += r.nb;
          else if (r.statut === 'Partiel') p.total_encaisse += r.es || 0;
        });
      }
      const impaye = Math.max(0, p.total_attendu - p.total_encaisse);
      return {
        id: cp.id, nom: cp.nom, prenom: cp.prenom, email: cp.email, telephone: cp.telephone,
        lot: cp.lot_numero ? { numero: cp.lot_numero, type: cp.lot_type, tantiemes: cp.tantiemes } : null,
        cotisation: cp.cotisation_id ? { id: cp.cotisation_id, montant_mensuel: cp.montant_mensuel, date_debut: cp.date_debut, date_fin: cp.date_fin, statut: cp.cotisation_statut } : null,
        paiements: p, impaye,
        taux_recouvrement: p.total_attendu > 0 ? Math.round((p.total_encaisse / p.total_attendu) * 100) : null,
      };
    });

    const totaux = {
      nb_copropietaires: enriched.length,
      total_mensuel: enriched.reduce((s, c) => s + (c.cotisation?.montant_mensuel || 0), 0),
      total_annuel_attendu: enriched.reduce((s, c) => s + (c.paiements.total_attendu || 0), 0),
      total_encaisse: enriched.reduce((s, c) => s + (c.paiements.total_encaisse || 0), 0),
      total_impaye: enriched.reduce((s, c) => s + (c.impaye || 0), 0),
    };

    res.json({ residence: copropriete, totaux, copropietaires: enriched, genere_le: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
