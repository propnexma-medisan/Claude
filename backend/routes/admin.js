const express = require('express');
const db = require('../database');

const router = express.Router();

// GET /api/admin/stats — comprehensive global statistics
router.get('/stats', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const currentMonth = today.substring(0, 7);

    // Residences
    const residencesTotal = db.prepare('SELECT COUNT(*) as count FROM coproprietes').get().count;

    // Gestionnaires
    const gestionnairesTotal = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'gestionnaire'").get().count;
    const gestionnairesActifs = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'gestionnaire' AND is_active = 1").get().count;

    // Copropriétaires
    const copropietairesTotal = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'copropietaire'").get().count;
    const copropietairesActifs = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'copropietaire' AND is_active = 1").get().count;
    const copropietairesParResidence = db.prepare(`
      SELECT c.id, c.nom, COUNT(u.id) as count
      FROM coproprietes c
      LEFT JOIN users u ON u.copropriete_id = c.id AND u.role = 'copropietaire'
      GROUP BY c.id
      ORDER BY c.nom ASC
    `).all();

    // Cotisations
    const cotisationsActives = db.prepare("SELECT COUNT(*) as count FROM cotisations WHERE statut = 'Active'").get().count;
    const cotisationsExpirant30j = db.prepare(`
      SELECT COUNT(*) as count FROM cotisations
      WHERE statut = 'Active' AND date_fin <= ? AND date_fin >= ?
    `).get(in30days, today).count;
    const cotisationsExpirees = db.prepare("SELECT COUNT(*) as count FROM cotisations WHERE statut = 'Expirée'").get().count;
    const cotisationsImpayees = db.prepare(`
      SELECT COUNT(DISTINCT c.id) as count
      FROM cotisations c
      JOIN cotisation_paiements cp ON cp.cotisation_id = c.id
      WHERE cp.statut IN ('En retard','En attente') AND cp.mois < ? AND c.statut = 'Active'
    `).get(currentMonth).count;
    const totalMensuel = db.prepare("SELECT COALESCE(SUM(montant_mensuel),0) as total FROM cotisations WHERE statut = 'Active'").get().total;

    // Tickets
    const ticketsTotal = db.prepare('SELECT COUNT(*) as count FROM tickets').get().count;
    const ticketsOuverts = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE statut = 'Ouvert'").get().count;
    const ticketsEnCours = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE statut = 'En cours'").get().count;
    const ticketsResolus = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE statut = 'Résolu'").get().count;
    const ticketsParPriorite = db.prepare(`
      SELECT priorite, COUNT(*) as count FROM tickets
      WHERE statut NOT IN ('Résolu','Fermé')
      GROUP BY priorite
    `).all();

    // Budgets
    const budgetsTotal = db.prepare('SELECT COUNT(*) as count FROM budgets').get().count;
    const budgetsApprouves = db.prepare("SELECT COUNT(*) as count FROM budgets WHERE statut = 'Approuvé'").get().count;
    const montantTotalAnnuel = db.prepare(`
      SELECT COALESCE(SUM(bl.montant_annuel), 0) as total
      FROM budget_lignes bl
      JOIN budgets b ON bl.budget_id = b.id
      WHERE b.annee = ?
    `).get(currentYear).total;

    // Dépenses
    const totalDepensesAnnee = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) as total
      FROM depenses
      WHERE strftime('%Y', date_depense) = ?
    `).get(String(currentYear)).total;
    const depensesParCategorie = db.prepare(`
      SELECT categorie, COALESCE(SUM(montant), 0) as montant
      FROM depenses
      WHERE strftime('%Y', date_depense) = ?
      GROUP BY categorie
      ORDER BY montant DESC
    `).all(String(currentYear));

    // Communications
    const messagesCeMois = db.prepare(`
      SELECT COUNT(*) as count FROM messages_diffusion
      WHERE strftime('%Y-%m', created_at) = ?
    `).get(currentMonth).count;
    const relancesCeMois = db.prepare(`
      SELECT COUNT(*) as count FROM relances
      WHERE strftime('%Y-%m', sent_at) = ?
    `).get(currentMonth).count;

    res.json({
      residences: { total: residencesTotal },
      gestionnaires: { total: gestionnairesTotal, actifs: gestionnairesActifs },
      copropietaires: {
        total: copropietairesTotal,
        actifs: copropietairesActifs,
        par_residence: copropietairesParResidence,
      },
      cotisations: {
        actives: cotisationsActives,
        expirant_30j: cotisationsExpirant30j,
        expirees: cotisationsExpirees,
        impayees: cotisationsImpayees,
        total_mensuel: totalMensuel,
      },
      tickets: {
        total: ticketsTotal,
        ouverts: ticketsOuverts,
        en_cours: ticketsEnCours,
        resolus: ticketsResolus,
        par_priorite: ticketsParPriorite,
      },
      budgets: {
        total: budgetsTotal,
        approuves: budgetsApprouves,
        montant_total_annuel: montantTotalAnnuel,
      },
      depenses: {
        total_annee_courante: totalDepensesAnnee,
        par_categorie: depensesParCategorie,
      },
      communications: {
        messages_ce_mois: messagesCeMois,
        relances_ce_mois: relancesCeMois,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/copropietaires — all copropriétaires with full details
router.get('/copropietaires', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.substring(0, 7);

    const users = db.prepare(`
      SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.is_active,
        c.nom as copropriete_nom, c.id as copropriete_id,
        l.numero as lot_numero, l.type as lot_type, l.id as lot_id,
        cot.id as cotisation_id, cot.date_debut, cot.date_fin,
        cot.montant_mensuel, cot.statut as cotisation_statut,
        CAST((julianday(cot.date_fin) - julianday(?)) AS INTEGER) as jours_restants,
        (SELECT COUNT(*) FROM tickets t WHERE t.createur_id = u.id AND t.statut NOT IN ('Résolu','Fermé')) as tickets_ouverts,
        (SELECT cp2.mois FROM cotisation_paiements cp2 WHERE cp2.cotisation_id = cot.id ORDER BY cp2.mois DESC LIMIT 1) as dernier_paiement_mois,
        (SELECT cp2.statut FROM cotisation_paiements cp2 WHERE cp2.cotisation_id = cot.id ORDER BY cp2.mois DESC LIMIT 1) as dernier_paiement_statut
      FROM users u
      LEFT JOIN coproprietes c ON u.copropriete_id = c.id
      LEFT JOIN lots l ON u.lot_id = l.id
      LEFT JOIN cotisations cot ON cot.user_id = u.id AND cot.statut IN ('Active','Expirée')
        AND cot.id = (
          SELECT id FROM cotisations WHERE user_id = u.id AND statut IN ('Active','Expirée')
          ORDER BY CASE statut WHEN 'Active' THEN 0 ELSE 1 END, date_fin DESC LIMIT 1
        )
      WHERE u.role = 'copropietaire'
      ORDER BY c.nom ASC, u.nom ASC, u.prenom ASC
    `).all(today);

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/cotisations — all cotisations across all residences
router.get('/cotisations', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.substring(0, 7);

    const rows = db.prepare(`
      SELECT cot.id, cot.montant_mensuel, cot.date_debut, cot.date_fin, cot.statut,
        CAST((julianday(cot.date_fin) - julianday(?)) AS INTEGER) as jours_restants,
        c.nom as copropriete_nom, c.id as copropriete_id,
        u.nom as copropietaire_nom, u.prenom as copropietaire_prenom, u.email as copropietaire_email,
        l.numero as lot_numero, l.type as lot_type,
        (SELECT COUNT(*) FROM cotisation_paiements cp
          WHERE cp.cotisation_id = cot.id AND cp.statut IN ('En retard','En attente') AND cp.mois < ?) as paiements_en_retard
      FROM cotisations cot
      JOIN users u ON cot.user_id = u.id
      JOIN coproprietes c ON cot.copropriete_id = c.id
      LEFT JOIN lots l ON cot.lot_id = l.id
      ORDER BY
        CASE cot.statut WHEN 'Active' THEN 0 ELSE 1 END,
        jours_restants ASC
    `).all(today, currentMonth);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/tickets — all tickets across all residences
router.get('/tickets', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT t.id, t.titre, t.categorie, t.statut, t.priorite, t.created_at, t.updated_at,
        c.nom as copropriete_nom,
        u.nom as createur_nom, u.prenom as createur_prenom,
        (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id) as nb_messages,
        CAST((julianday('now') - julianday(t.created_at)) AS INTEGER) as jours_depuis_creation
      FROM tickets t
      JOIN coproprietes c ON t.copropriete_id = c.id
      JOIN users u ON t.createur_id = u.id
      ORDER BY
        CASE t.statut WHEN 'Ouvert' THEN 0 WHEN 'En cours' THEN 1 ELSE 2 END,
        CASE t.priorite WHEN 'Urgente' THEN 0 WHEN 'Haute' THEN 1 WHEN 'Normale' THEN 2 ELSE 3 END,
        t.created_at DESC
    `).all();

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/budgets — all budgets across all residences
router.get('/budgets', (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    const rows = db.prepare(`
      SELECT b.id, b.annee, b.statut, b.created_at, b.updated_at,
        c.nom as copropriete_nom, c.id as copropriete_id,
        u.nom as gestionnaire_nom, u.prenom as gestionnaire_prenom,
        COALESCE((SELECT SUM(bl.montant_annuel) FROM budget_lignes bl WHERE bl.budget_id = b.id), 0) as total_budget,
        COALESCE((SELECT SUM(d.montant) FROM depenses d WHERE d.copropriete_id = b.copropriete_id AND strftime('%Y', d.date_depense) = CAST(b.annee AS TEXT)), 0) as total_depenses
      FROM budgets b
      JOIN coproprietes c ON b.copropriete_id = c.id
      LEFT JOIN users u ON b.created_by = u.id
      ORDER BY b.annee DESC, c.nom ASC
    `).all();

    const enriched = rows.map(r => ({
      ...r,
      restant: r.total_budget - r.total_depenses,
      taux_consommation: r.total_budget > 0 ? Math.round((r.total_depenses / r.total_budget) * 100) : 0,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/communications — last 50 items merged (messages + relances)
router.get('/communications', (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT 'message' as type, m.id, c.nom as copropriete_nom, c.id as copropriete_id,
        m.titre as titre_ou_objet,
        u.nom as expediteur_nom, u.prenom as expediteur_prenom,
        'Tous copropriétaires' as destinataire_ou_cible,
        m.created_at,
        SUBSTR(m.contenu, 1, 150) as contenu_preview
      FROM messages_diffusion m
      JOIN coproprietes c ON m.copropriete_id = c.id
      JOIN users u ON m.gestionnaire_id = u.id
      ORDER BY m.created_at DESC
      LIMIT 50
    `).all();

    const relances = db.prepare(`
      SELECT 'relance' as type, r.id, c.nom as copropriete_nom, c.id as copropriete_id,
        r.objet as titre_ou_objet,
        sender.nom as expediteur_nom, sender.prenom as expediteur_prenom,
        (dest.prenom || ' ' || dest.nom) as destinataire_ou_cible,
        r.sent_at as created_at,
        SUBSTR(r.message, 1, 150) as contenu_preview
      FROM relances r
      JOIN coproprietes c ON r.copropriete_id = c.id
      LEFT JOIN users dest ON r.user_id = dest.id
      LEFT JOIN users sender ON sender.copropriete_id = r.copropriete_id AND sender.role = 'gestionnaire'
      ORDER BY r.sent_at DESC
      LIMIT 50
    `).all();

    const combined = [...messages, ...relances].sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    }).slice(0, 50);

    res.json(combined);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/dashboard — rich dashboard data in one call
router.get('/dashboard', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const currentMonth = today.substring(0, 7);

    // Residences with per-residence stats
    const residences = db.prepare(`
      SELECT c.id, c.nom, c.adresse,
        (SELECT u2.prenom || ' ' || u2.nom FROM users u2 WHERE u2.copropriete_id = c.id AND u2.role = 'gestionnaire' LIMIT 1) as gestionnaire_nom,
        (SELECT COUNT(*) FROM users u WHERE u.copropriete_id = c.id AND u.role = 'copropietaire') as nb_copropietaires,
        COALESCE((SELECT SUM(bl.montant_annuel) FROM budget_lignes bl JOIN budgets b ON bl.budget_id = b.id WHERE b.copropriete_id = c.id AND b.annee = ?), 0) as budget_annuel,
        COALESCE((SELECT SUM(d.montant) FROM depenses d WHERE d.copropriete_id = c.id AND strftime('%Y', d.date_depense) = ?), 0) as total_depenses,
        (SELECT COUNT(*) FROM tickets t WHERE t.copropriete_id = c.id AND t.statut NOT IN ('Résolu','Fermé')) as tickets_ouverts
      FROM coproprietes c
      ORDER BY c.nom ASC
    `).all(currentYear, String(currentYear));

    // Recent tickets (5)
    const recentTickets = db.prepare(`
      SELECT t.id, t.titre, t.statut, t.priorite, t.created_at,
        c.nom as copropriete_nom,
        u.nom as createur_nom, u.prenom as createur_prenom
      FROM tickets t
      JOIN coproprietes c ON t.copropriete_id = c.id
      JOIN users u ON t.createur_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 5
    `).all();

    // Cotisations à surveiller (expiring soon or expired, max 5)
    const cotisationsSurveillance = db.prepare(`
      SELECT cot.id, cot.date_fin, cot.statut, cot.montant_mensuel,
        CAST((julianday(cot.date_fin) - julianday(?)) AS INTEGER) as jours_restants,
        u.nom, u.prenom,
        c.nom as copropriete_nom
      FROM cotisations cot
      JOIN users u ON cot.user_id = u.id
      JOIN coproprietes c ON cot.copropriete_id = c.id
      WHERE (cot.statut = 'Active' AND cot.date_fin <= ?)
         OR cot.statut = 'Expirée'
      ORDER BY cot.date_fin ASC
      LIMIT 5
    `).all(today, in30days);

    // Recent communications (8)
    const recentMessages = db.prepare(`
      SELECT 'message' as type, m.id, c.nom as copropriete_nom,
        m.titre as objet, u.nom as expediteur_nom, u.prenom as expediteur_prenom,
        m.created_at
      FROM messages_diffusion m
      JOIN coproprietes c ON m.copropriete_id = c.id
      JOIN users u ON m.gestionnaire_id = u.id
      ORDER BY m.created_at DESC LIMIT 8
    `).all();

    const recentRelances = db.prepare(`
      SELECT 'relance' as type, r.id, c.nom as copropriete_nom,
        r.objet, dest.nom as expediteur_nom, dest.prenom as expediteur_prenom,
        r.sent_at as created_at
      FROM relances r
      JOIN coproprietes c ON r.copropriete_id = c.id
      LEFT JOIN users dest ON r.user_id = dest.id
      ORDER BY r.sent_at DESC LIMIT 8
    `).all();

    const recentComms = [...recentMessages, ...recentRelances]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);

    res.json({
      residences,
      recentTickets,
      cotisationsSurveillance,
      recentComms,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
