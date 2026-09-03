const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const db = new Database(path.join(__dirname, 'syndic.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS coproprietes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      adresse TEXT NOT NULL,
      nb_lots INTEGER DEFAULT 0,
      syndic_nom TEXT,
      date_creation TEXT NOT NULL,
      notes TEXT,
      photo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copropriete_id INTEGER NOT NULL,
      numero TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Appartement','Studio','Commerce','Bureau','Parking','Cave')),
      surface REAL,
      tantiemes INTEGER DEFAULT 0,
      proprietaire_nom TEXT,
      proprietaire_email TEXT,
      proprietaire_tel TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (copropriete_id) REFERENCES coproprietes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS charges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copropriete_id INTEGER NOT NULL,
      libelle TEXT NOT NULL,
      montant_total REAL NOT NULL DEFAULT 0,
      date_echeance TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'En cours' CHECK(statut IN ('En cours','Soldé','En retard')),
      budget_annuel REAL DEFAULT 0,
      exercice INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (copropriete_id) REFERENCES coproprietes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS charge_repartitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      charge_id INTEGER NOT NULL,
      lot_id INTEGER NOT NULL,
      montant REAL NOT NULL DEFAULT 0,
      statut_paiement TEXT NOT NULL DEFAULT 'Non payé' CHECK(statut_paiement IN ('Payé','Non payé','Partiel')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (charge_id) REFERENCES charges(id) ON DELETE CASCADE,
      FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assemblees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copropriete_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      heure TEXT NOT NULL,
      lieu TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Ordinaire' CHECK(type IN ('Ordinaire','Extraordinaire')),
      statut TEXT NOT NULL DEFAULT 'Planifiée' CHECK(statut IN ('Planifiée','En cours','Terminée','Annulée')),
      ordre_du_jour_json TEXT DEFAULT '[]',
      convocations_envoyees INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (copropriete_id) REFERENCES coproprietes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ag_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assemblee_id INTEGER NOT NULL,
      numero INTEGER NOT NULL,
      libelle TEXT NOT NULL,
      description TEXT,
      type_vote TEXT NOT NULL DEFAULT 'Simple majorité' CHECK(type_vote IN ('Simple majorité','Double majorité','Unanimité')),
      resultat TEXT CHECK(resultat IN ('Approuvé','Refusé','Ajourné') OR resultat IS NULL),
      votes_pour INTEGER DEFAULT 0,
      votes_contre INTEGER DEFAULT 0,
      votes_abstention INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assemblee_id) REFERENCES assemblees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','gestionnaire','copropietaire')),
      copropriete_id INTEGER REFERENCES coproprietes(id) ON DELETE SET NULL,
      lot_id INTEGER REFERENCES lots(id) ON DELETE SET NULL,
      telephone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copropriete_id INTEGER NOT NULL REFERENCES coproprietes(id),
      lot_id INTEGER REFERENCES lots(id),
      createur_id INTEGER NOT NULL REFERENCES users(id),
      titre TEXT NOT NULL,
      description TEXT NOT NULL,
      categorie TEXT DEFAULT 'Général',
      statut TEXT DEFAULT 'Ouvert' CHECK(statut IN ('Ouvert','En cours','Résolu','Fermé')),
      priorite TEXT DEFAULT 'Normale' CHECK(priorite IN ('Basse','Normale','Haute','Urgente')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ticket_message_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_message_id INTEGER NOT NULL REFERENCES ticket_messages(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mimetype TEXT,
      size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages_diffusion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copropriete_id INTEGER NOT NULL REFERENCES coproprietes(id),
      gestionnaire_id INTEGER NOT NULL REFERENCES users(id),
      titre TEXT NOT NULL,
      contenu TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copropriete_id INTEGER NOT NULL REFERENCES coproprietes(id) ON DELETE CASCADE,
      annee INTEGER NOT NULL,
      statut TEXT DEFAULT 'Brouillon' CHECK(statut IN ('Brouillon','Soumis','Approuvé','Clôturé')),
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(copropriete_id, annee)
    );

    CREATE TABLE IF NOT EXISTS budget_lignes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      categorie TEXT NOT NULL,
      montant_annuel REAL DEFAULT 0,
      jan REAL DEFAULT 0, fev REAL DEFAULT 0, mar REAL DEFAULT 0,
      avr REAL DEFAULT 0, mai REAL DEFAULT 0, jun REAL DEFAULT 0,
      jul REAL DEFAULT 0, aou REAL DEFAULT 0, sep REAL DEFAULT 0,
      oct REAL DEFAULT 0, nov REAL DEFAULT 0, dec REAL DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS depenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copropriete_id INTEGER NOT NULL REFERENCES coproprietes(id) ON DELETE CASCADE,
      budget_id INTEGER REFERENCES budgets(id) ON DELETE SET NULL,
      categorie TEXT NOT NULL,
      libelle TEXT NOT NULL,
      montant REAL NOT NULL,
      date_depense DATE NOT NULL,
      fournisseur TEXT,
      numero_facture TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appels_fonds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copropriete_id INTEGER NOT NULL REFERENCES coproprietes(id) ON DELETE CASCADE,
      budget_id INTEGER REFERENCES budgets(id),
      libelle TEXT NOT NULL,
      motif TEXT,
      montant_total REAL NOT NULL,
      date_appel DATE NOT NULL,
      date_echeance DATE NOT NULL,
      statut TEXT DEFAULT 'En cours' CHECK(statut IN ('En cours','Soldé','Annulé')),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cotisations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copropriete_id INTEGER NOT NULL REFERENCES coproprietes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lot_id INTEGER REFERENCES lots(id) ON DELETE SET NULL,
      montant_mensuel REAL NOT NULL,
      date_debut DATE NOT NULL,
      date_fin DATE NOT NULL,
      statut TEXT DEFAULT 'Active' CHECK(statut IN ('Active','Expirée','Suspendue','Résiliée')),
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cotisation_paiements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cotisation_id INTEGER NOT NULL REFERENCES cotisations(id) ON DELETE CASCADE,
      mois TEXT NOT NULL,
      montant REAL NOT NULL,
      statut TEXT DEFAULT 'En attente' CHECK(statut IN ('En attente','Payé','En retard','Partiel')),
      date_paiement DATE,
      mode_paiement TEXT,
      reference TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cotisation_id, mois)
    );

    CREATE TABLE IF NOT EXISTS relances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copropriete_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      cotisation_id INTEGER REFERENCES cotisations(id),
      type TEXT NOT NULL CHECK(type IN ('Fin de période','Impayé','Renouvellement','Bienvenue')),
      objet TEXT NOT NULL,
      message TEXT NOT NULL,
      statut TEXT DEFAULT 'Envoyée' CHECK(statut IN ('Envoyée','Lue','Traitée')),
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Créer le compte admin s'il n'existe pas
  const adminExists = db.prepare("SELECT id FROM users WHERE email = 'mehdi@propnex.ma'").get();
  if (!adminExists) {
    seedAdmin();
  }
}

function seedAdmin() {
  const adminHash = bcrypt.hashSync('Miaadl2020', 10);
  db.prepare(`
    INSERT INTO users (nom, prenom, email, password_hash, role, copropriete_id, lot_id, telephone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('Aadl', 'Mehdi', 'mehdi@propnex.ma', adminHash, 'admin', null, null, null);
  console.log('Compte admin créé : mehdi@propnex.ma');
}

initializeDatabase();

// Migrations: add columns that may not exist on older DBs
try { db.exec('ALTER TABLE depenses ADD COLUMN justificatif_url TEXT'); } catch {}

// Junction table: gestionnaire → multiple residences
try {
  db.exec(`CREATE TABLE IF NOT EXISTS gestionnaire_residences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gestionnaire_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    copropriete_id INTEGER NOT NULL REFERENCES coproprietes(id) ON DELETE CASCADE,
    UNIQUE(gestionnaire_id, copropriete_id)
  )`);
} catch {}

// Backfill existing single-residence assignments
try {
  db.exec(`
    INSERT OR IGNORE INTO gestionnaire_residences (gestionnaire_id, copropriete_id)
    SELECT id, copropriete_id FROM users
    WHERE role = 'gestionnaire' AND copropriete_id IS NOT NULL
  `);
} catch {}

// Fournisseurs
try {
  db.exec(`CREATE TABLE IF NOT EXISTS fournisseurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    copropriete_id INTEGER NOT NULL REFERENCES coproprietes(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    categorie TEXT NOT NULL DEFAULT 'Divers',
    contact_nom TEXT,
    contact_email TEXT,
    contact_tel TEXT,
    adresse TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
} catch {}

// Contrats fournisseurs
try {
  db.exec(`CREATE TABLE IF NOT EXISTS contrats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fournisseur_id INTEGER NOT NULL REFERENCES fournisseurs(id) ON DELETE CASCADE,
    copropriete_id INTEGER NOT NULL REFERENCES coproprietes(id) ON DELETE CASCADE,
    titre TEXT NOT NULL,
    type_contrat TEXT NOT NULL DEFAULT 'Maintenance',
    montant_annuel REAL,
    date_debut DATE,
    date_fin DATE,
    statut TEXT DEFAULT 'Actif' CHECK(statut IN ('Actif','Expiré','Résilié')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
} catch {}

// Document PDF attaché à un contrat
try { db.exec('ALTER TABLE contrats ADD COLUMN document_url TEXT'); } catch {}

// Documents de la copropriété (règlement, contrat syndic, assurance, etc.)
try {
  db.exec(`CREATE TABLE IF NOT EXISTS documents_copropriete (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    copropriete_id INTEGER NOT NULL REFERENCES coproprietes(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'autre',
    nom TEXT NOT NULL,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
} catch {}

// Link depenses to fournisseurs
try { db.exec('ALTER TABLE depenses ADD COLUMN fournisseur_id INTEGER REFERENCES fournisseurs(id) ON DELETE SET NULL'); } catch {}

// Preuves de paiement liées à la cotisation (pas au paiement mensuel)
try {
  db.exec(`CREATE TABLE IF NOT EXISTS cotisation_preuves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cotisation_id INTEGER NOT NULL REFERENCES cotisations(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mimetype TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
} catch {}

// Flag bureau syndical pour copropriétaires (sans changer leur rôle)
try { db.exec('ALTER TABLE users ADD COLUMN is_membre_bureau INTEGER DEFAULT 0'); } catch {}

// Table recouvrement (actions email + lettres)
try {
  db.exec(`CREATE TABLE IF NOT EXISTS recouvrement_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    copropriete_id INTEGER NOT NULL REFERENCES coproprietes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('Rappel','Relance','Mise en demeure')),
    canal TEXT NOT NULL CHECK(canal IN ('Email','Lettre')),
    statut TEXT NOT NULL DEFAULT 'Envoyé' CHECK(statut IN ('Envoyé','À déposer','Déposé')),
    montant_du REAL,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
} catch {}

// Pièces jointes des messages de diffusion
try {
  db.exec(`CREATE TABLE IF NOT EXISTS message_pieces_jointes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages_diffusion(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mimetype TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
} catch {}

// AG — présences par lot
try {
  db.exec(`CREATE TABLE IF NOT EXISTS assemblee_presences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assemblee_id INTEGER NOT NULL REFERENCES assemblees(id) ON DELETE CASCADE,
    lot_id INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    statut TEXT NOT NULL DEFAULT 'Absent' CHECK(statut IN ('Présent','Absent','Procuration')),
    mandataire_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    tantiemes INTEGER DEFAULT 0,
    UNIQUE(assemblee_id, lot_id)
  )`);
} catch {}

// AG — votes par lot et par point
try {
  db.exec(`CREATE TABLE IF NOT EXISTS assemblee_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    point_id INTEGER NOT NULL REFERENCES ag_points(id) ON DELETE CASCADE,
    lot_id INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    vote TEXT NOT NULL CHECK(vote IN ('Pour','Contre','Abstention')),
    tantiemes INTEGER DEFAULT 0,
    UNIQUE(point_id, lot_id)
  )`);
} catch {}

// Colonnes supplémentaires sur assemblees
try { db.exec('ALTER TABLE assemblees ADD COLUMN quorum_requis INTEGER DEFAULT 50'); } catch {}
try { db.exec('ALTER TABLE assemblees ADD COLUMN tantiemes_presents INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE assemblees ADD COLUMN total_tantiemes INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE assemblees ADD COLUMN pv_genere INTEGER DEFAULT 0'); } catch {}

// Colonnes supplémentaires sur ag_points
try { db.exec('ALTER TABLE ag_points ADD COLUMN tantiemes_pour INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE ag_points ADD COLUMN tantiemes_contre INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE ag_points ADD COLUMN tantiemes_abstention INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE ag_points ADD COLUMN notes TEXT'); } catch {}

// Montant réellement reçu par mois (distinct du montant attendu, pour paiements partiels ou en avance)
try { db.exec('ALTER TABLE cotisation_paiements ADD COLUMN montant_regle REAL'); } catch {}

// Signature + cachet numérique du gestionnaire
try { db.exec('ALTER TABLE users ADD COLUMN signature_url TEXT'); } catch {}

// Suivi de la dernière connexion (pour tableau d'activation)
try { db.exec('ALTER TABLE users ADD COLUMN last_login DATETIME'); } catch {}

// Token d'activation pour le flow premier-login (onboarding WhatsApp)
try { db.exec('ALTER TABLE users ADD COLUMN activation_token TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN must_activate INTEGER DEFAULT 0'); } catch {}

// Suivi de l'envoi d'invitation WhatsApp
try { db.exec('ALTER TABLE users ADD COLUMN whatsapp_invite_sent_at DATETIME'); } catch {}

// Ville du gestionnaire (pour "Fait à [Ville], le [date]" dans les documents)
try { db.exec('ALTER TABLE users ADD COLUMN ville TEXT'); } catch {}

module.exports = db;
