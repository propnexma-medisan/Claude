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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copropriete_id INTEGER NOT NULL,
      numero TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Appartement','Commerce','Parking','Cave')),
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
      message TEXT NOT NULL,
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

  // Seed data if tables are empty
  const count = db.prepare('SELECT COUNT(*) as c FROM coproprietes').get();
  if (count.c === 0) {
    seedData();
  }
}

function seedData() {
  const insertCopro = db.prepare(`
    INSERT INTO coproprietes (nom, adresse, nb_lots, syndic_nom, date_creation, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertLot = db.prepare(`
    INSERT INTO lots (copropriete_id, numero, type, surface, tantiemes, proprietaire_nom, proprietaire_email, proprietaire_tel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCharge = db.prepare(`
    INSERT INTO charges (copropriete_id, libelle, montant_total, date_echeance, statut, budget_annuel, exercice)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRepartition = db.prepare(`
    INSERT INTO charge_repartitions (charge_id, lot_id, montant, statut_paiement)
    VALUES (?, ?, ?, ?)
  `);

  const insertAssemblee = db.prepare(`
    INSERT INTO assemblees (copropriete_id, date, heure, lieu, type, statut, convocations_envoyees)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPoint = db.prepare(`
    INSERT INTO ag_points (assemblee_id, numero, libelle, description, type_vote, resultat, votes_pour, votes_contre, votes_abstention)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Copropriété 1
  const cp1 = insertCopro.run(
    'Résidence Les Oliviers',
    '12 Avenue des Fleurs, 06000 Nice',
    8,
    'Cabinet Riviera Syndic',
    '2010-03-15',
    'Résidence de standing avec piscine et gardien.'
  );

  // Lots de la copropriété 1
  const lot1 = insertLot.run(cp1.lastInsertRowid, 'A101', 'Appartement', 65.5, 850, 'Marie Dupont', 'marie.dupont@email.fr', '06 12 34 56 78');
  const lot2 = insertLot.run(cp1.lastInsertRowid, 'A102', 'Appartement', 48.0, 620, 'Jean Martin', 'jean.martin@email.fr', '06 23 45 67 89');
  const lot3 = insertLot.run(cp1.lastInsertRowid, 'A201', 'Appartement', 85.0, 1100, 'Pierre Blanc', 'p.blanc@email.fr', '06 34 56 78 90');
  const lot4 = insertLot.run(cp1.lastInsertRowid, 'C001', 'Commerce', 120.0, 1560, 'SAS Le Bon Goût', 'contact@lebongout.fr', '04 93 12 34 56');
  const lot5 = insertLot.run(cp1.lastInsertRowid, 'P001', 'Parking', 12.5, 125, 'Marie Dupont', 'marie.dupont@email.fr', '06 12 34 56 78');
  const lot6 = insertLot.run(cp1.lastInsertRowid, 'P002', 'Parking', 12.5, 125, 'Jean Martin', 'jean.martin@email.fr', '06 23 45 67 89');

  // Copropriété 2
  const cp2 = insertCopro.run(
    'Immeuble Le Beaumont',
    '5 Rue de la République, 69001 Lyon',
    5,
    'Cabinet Rhône Gestion',
    '2005-09-01',
    'Immeuble haussmannien rénové en 2018.'
  );

  // Lots de la copropriété 2
  const lot7 = insertLot.run(cp2.lastInsertRowid, '1er Gauche', 'Appartement', 95.0, 2400, 'Sophie Leroy', 's.leroy@email.fr', '06 45 67 89 01');
  const lot8 = insertLot.run(cp2.lastInsertRowid, '1er Droite', 'Appartement', 72.0, 1820, 'Thomas Bernard', 'thomas.b@email.fr', '06 56 78 90 12');
  const lot9 = insertLot.run(cp2.lastInsertRowid, '2ème', 'Appartement', 110.0, 2780, 'Isabelle Moreau', 'i.moreau@email.fr', '06 67 89 01 23');
  const lot10 = insertLot.run(cp2.lastInsertRowid, 'Cave 1', 'Cave', 8.0, 80, 'Sophie Leroy', 's.leroy@email.fr', '06 45 67 89 01');
  const lot11 = insertLot.run(cp2.lastInsertRowid, 'Cave 2', 'Cave', 6.5, 65, 'Thomas Bernard', 'thomas.b@email.fr', '06 56 78 90 12');

  // Copropriété 3
  const cp3 = insertCopro.run(
    'Villa Méditerranée',
    '28 Boulevard de la Mer, 13008 Marseille',
    4,
    'Cabinet Marseille Syndic',
    '2015-06-20',
    'Petite copropriété vue mer, accès direct à la plage.'
  );

  const lot12 = insertLot.run(cp3.lastInsertRowid, 'Villa A', 'Appartement', 130.0, 3000, 'François Petit', 'f.petit@email.fr', '06 78 90 12 34');
  const lot13 = insertLot.run(cp3.lastInsertRowid, 'Villa B', 'Appartement', 115.0, 2650, 'Nathalie Simon', 'n.simon@email.fr', '06 89 01 23 45');
  const lot14 = insertLot.run(cp3.lastInsertRowid, 'Garage A', 'Parking', 20.0, 175, 'François Petit', 'f.petit@email.fr', '06 78 90 12 34');
  const lot15 = insertLot.run(cp3.lastInsertRowid, 'Garage B', 'Parking', 20.0, 175, 'Nathalie Simon', 'n.simon@email.fr', '06 89 01 23 45');

  // Update nb_lots
  db.prepare('UPDATE coproprietes SET nb_lots = (SELECT COUNT(*) FROM lots WHERE copropriete_id = ?) WHERE id = ?').run(cp1.lastInsertRowid, cp1.lastInsertRowid);
  db.prepare('UPDATE coproprietes SET nb_lots = (SELECT COUNT(*) FROM lots WHERE copropriete_id = ?) WHERE id = ?').run(cp2.lastInsertRowid, cp2.lastInsertRowid);
  db.prepare('UPDATE coproprietes SET nb_lots = (SELECT COUNT(*) FROM lots WHERE copropriete_id = ?) WHERE id = ?').run(cp3.lastInsertRowid, cp3.lastInsertRowid);

  // Charges
  const charge1 = insertCharge.run(
    cp1.lastInsertRowid,
    'Charges courantes - T1 2026',
    4800.00,
    '2026-03-31',
    'En cours',
    19200.00,
    2026
  );
  insertRepartition.run(charge1.lastInsertRowid, lot1.lastInsertRowid, 816.00, 'Payé');
  insertRepartition.run(charge1.lastInsertRowid, lot2.lastInsertRowid, 595.20, 'Non payé');
  insertRepartition.run(charge1.lastInsertRowid, lot3.lastInsertRowid, 1056.00, 'Payé');
  insertRepartition.run(charge1.lastInsertRowid, lot4.lastInsertRowid, 1497.60, 'Non payé');

  const charge2 = insertCharge.run(
    cp2.lastInsertRowid,
    'Ravalement de façade 2025',
    28500.00,
    '2025-12-31',
    'En retard',
    28500.00,
    2025
  );
  insertRepartition.run(charge2.lastInsertRowid, lot7.lastInsertRowid, 9576.00, 'Partiel');
  insertRepartition.run(charge2.lastInsertRowid, lot8.lastInsertRowid, 7260.90, 'Non payé');
  insertRepartition.run(charge2.lastInsertRowid, lot9.lastInsertRowid, 11088.90, 'Non payé');

  const charge3 = insertCharge.run(
    cp1.lastInsertRowid,
    'Contrat ascenseur annuel',
    2400.00,
    '2025-12-31',
    'Soldé',
    2400.00,
    2025
  );
  insertRepartition.run(charge3.lastInsertRowid, lot1.lastInsertRowid, 408.00, 'Payé');
  insertRepartition.run(charge3.lastInsertRowid, lot2.lastInsertRowid, 297.60, 'Payé');
  insertRepartition.run(charge3.lastInsertRowid, lot3.lastInsertRowid, 528.00, 'Payé');

  const charge4 = insertCharge.run(
    cp3.lastInsertRowid,
    'Entretien espaces verts - Annuel',
    3600.00,
    '2026-06-30',
    'En cours',
    3600.00,
    2026
  );
  insertRepartition.run(charge4.lastInsertRowid, lot12.lastInsertRowid, 1800.00, 'Non payé');
  insertRepartition.run(charge4.lastInsertRowid, lot13.lastInsertRowid, 1800.00, 'Non payé');

  // Assemblées Générales
  const ag1 = insertAssemblee.run(
    cp1.lastInsertRowid,
    '2026-06-15',
    '18:00',
    'Salle polyvalente - 12 Avenue des Fleurs, Nice',
    'Ordinaire',
    'Planifiée',
    1
  );
  insertPoint.run(ag1.lastInsertRowid, 1, 'Approbation des comptes 2025', 'Présentation et vote des comptes de l\'exercice 2025 par le syndic.', 'Simple majorité', null, 0, 0, 0);
  insertPoint.run(ag1.lastInsertRowid, 2, 'Budget prévisionnel 2026', 'Vote du budget prévisionnel pour l\'exercice 2026 incluant les charges courantes.', 'Simple majorité', null, 0, 0, 0);
  insertPoint.run(ag1.lastInsertRowid, 3, 'Remplacement de la chaudière', 'Devis pour le remplacement de la chaudière collective - montant estimé 15 000 €.', 'Double majorité', null, 0, 0, 0);

  const ag2 = insertAssemblee.run(
    cp2.lastInsertRowid,
    '2025-11-20',
    '19:00',
    'Cabinet Rhône Gestion - 10 Rue de la Paix, Lyon',
    'Extraordinaire',
    'Terminée',
    1
  );
  insertPoint.run(ag2.lastInsertRowid, 1, 'Validation devis ravalement de façade', 'Vote pour l\'approbation du devis de ravalement sélectionné - Entreprise Rénov\'Art.', 'Double majorité', 'Approuvé', 8, 1, 1);
  insertPoint.run(ag2.lastInsertRowid, 2, 'Appel de fonds travaux', 'Modalités de l\'appel de fonds spécial pour financer le ravalement.', 'Simple majorité', 'Approuvé', 9, 0, 1);
  insertPoint.run(ag2.lastInsertRowid, 3, 'Questions diverses', 'Divers sujets abordés par les copropriétaires.', 'Simple majorité', 'Ajourné', 3, 3, 4);

  // Seed users
  const adminHash = bcrypt.hashSync('Admin2024!', 10);
  const gestHash = bcrypt.hashSync('Gest2024!', 10);
  const coproHash = bcrypt.hashSync('Copro2024!', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (nom, prenom, email, password_hash, role, copropriete_id, lot_id, telephone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('Admin', 'Système', 'admin@syndic.ma', adminHash, 'admin', null, null, null);
  insertUser.run('Gestionnaire', 'Principal', 'gestionnaire@syndic.ma', gestHash, 'gestionnaire', cp1.lastInsertRowid, null, '06 00 00 00 01');
  insertUser.run('Copropriétaire', 'Demo', 'copro@syndic.ma', coproHash, 'copropietaire', cp1.lastInsertRowid, lot1.lastInsertRowid, '06 00 00 00 02');

  // Seed cotisations for copropietaire demo user
  // Find the copropietaire user
  const coproUser = db.prepare("SELECT id FROM users WHERE role = 'copropietaire' LIMIT 1").get();
  if (coproUser) {
    const insertCotisation = db.prepare(`
      INSERT INTO cotisations (copropriete_id, user_id, lot_id, montant_mensuel, date_debut, date_fin, statut, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPaiement = db.prepare(`
      INSERT INTO cotisation_paiements (cotisation_id, mois, montant, statut, date_paiement)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Cotisation expirée 2024
    insertCotisation.run(
      cp1.lastInsertRowid,
      coproUser.id,
      lot1.lastInsertRowid,
      350,
      '2024-01-01',
      '2024-12-31',
      'Expirée',
      'Cotisation annuelle 2024',
      null
    );

    // Cotisation active 2025
    const cotis2025 = insertCotisation.run(
      cp1.lastInsertRowid,
      coproUser.id,
      lot1.lastInsertRowid,
      380,
      '2025-01-01',
      '2025-12-31',
      'Active',
      'Cotisation annuelle 2025',
      null
    );

    // Generate paiements for active cotisation: Jan 2025 to Dec 2025
    // Current date context: 2026-05-22, so all months in 2025 are past → all 'Payé'
    const today = new Date('2026-05-22');
    for (let m = 1; m <= 12; m++) {
      const moisStr = `2025-${String(m).padStart(2, '0')}`;
      const moisDate = new Date(`2025-${String(m).padStart(2, '0')}-01`);
      // All 2025 months are before today (2026-05-22), mark as Payé
      insertPaiement.run(
        cotis2025.lastInsertRowid,
        moisStr,
        380,
        'Payé',
        `2025-${String(m).padStart(2, '0')}-05`
      );
    }
  }

  console.log('Base de données initialisée avec les données de démonstration.');
}

initializeDatabase();

module.exports = db;
