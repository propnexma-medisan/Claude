const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { requireRole } = require('../middleware/auth');
const { canGestionnaireAccessResidence } = require('../utils/access');
const { sendConvocation } = require('../services/email');

function signatureBase64(signatureUrl) {
  if (!signatureUrl) return null;
  try {
    const filePath = path.join(__dirname, '..', signatureUrl);
    if (!fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
    return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
  } catch { return null; }
}

function checkAccess(req, copropriete_id) {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'gestionnaire') return canGestionnaireAccessResidence(req.user.id, copropriete_id);
  return String(req.user.copropriete_id) === String(copropriete_id);
}

const AG_SELECT = `
  SELECT a.*, c.nom as copropriete_nom, c.adresse as copropriete_adresse,
    (SELECT COUNT(*) FROM ag_points WHERE assemblee_id = a.id) as nb_points
  FROM assemblees a
  LEFT JOIN coproprietes c ON a.copropriete_id = c.id
`;

// GET / — list
router.get('/', (req, res) => {
  try {
    const { copropriete_id } = req.query;

    if (req.user.role === 'admin') {
      const rows = copropriete_id
        ? db.prepare(`${AG_SELECT} WHERE a.copropriete_id = ? ORDER BY a.date DESC, a.heure DESC`).all(copropriete_id)
        : db.prepare(`${AG_SELECT} ORDER BY a.date DESC, a.heure DESC`).all();
      return res.json(rows);
    }

    if (req.user.role === 'gestionnaire') {
      if (copropriete_id) {
        if (!canGestionnaireAccessResidence(req.user.id, copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });
        return res.json(db.prepare(`${AG_SELECT} WHERE a.copropriete_id = ? ORDER BY a.date DESC, a.heure DESC`).all(copropriete_id));
      }
      return res.json(db.prepare(`
        ${AG_SELECT}
        JOIN gestionnaire_residences gr ON a.copropriete_id = gr.copropriete_id
        WHERE gr.gestionnaire_id = ?
        ORDER BY a.date DESC, a.heure DESC
      `).all(req.user.id));
    }

    // copropriétaire / membre_bureau
    return res.json(db.prepare(`${AG_SELECT} WHERE a.copropriete_id = ? ORDER BY a.date DESC, a.heure DESC`).all(req.user.copropriete_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', (req, res) => {
  try {
    const ag = db.prepare(`
      SELECT a.*, c.nom as copropriete_nom, c.adresse as copropriete_adresse
      FROM assemblees a LEFT JOIN coproprietes c ON a.copropriete_id = c.id
      WHERE a.id = ?
    `).get(req.params.id);
    if (!ag) return res.status(404).json({ error: 'Assemblée non trouvée' });
    if (!checkAccess(req, ag.copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });

    const points = db.prepare('SELECT * FROM ag_points WHERE assemblee_id = ? ORDER BY numero ASC').all(req.params.id);

    const presences = db.prepare(`
      SELECT ap.*, l.numero as lot_numero, l.proprietaire_nom, l.tantiemes,
        u.nom as user_nom, u.prenom as user_prenom,
        um.nom as mandataire_nom, um.prenom as mandataire_prenom
      FROM assemblee_presences ap
      JOIN lots l ON ap.lot_id = l.id
      LEFT JOIN users u ON ap.user_id = u.id
      LEFT JOIN users um ON ap.mandataire_id = um.id
      WHERE ap.assemblee_id = ? ORDER BY l.numero ASC
    `).all(req.params.id);

    res.json({ ...ag, points, presences });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const { copropriete_id, date, heure, lieu, type, quorum_requis } = req.body;
    if (!copropriete_id || !date || !heure || !lieu) {
      return res.status(400).json({ error: 'copropriete_id, date, heure et lieu requis' });
    }
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const result = db.prepare(`
      INSERT INTO assemblees (copropriete_id, date, heure, lieu, type, statut, quorum_requis)
      VALUES (?, ?, ?, ?, ?, 'Planifiée', ?)
    `).run(copropriete_id, date, heure, lieu, type || 'Ordinaire', quorum_requis ?? 50);

    res.status(201).json(db.prepare(`
      SELECT a.*, c.nom as copropriete_nom FROM assemblees a
      LEFT JOIN coproprietes c ON a.copropriete_id = c.id WHERE a.id = ?
    `).get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id
router.put('/:id', requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM assemblees WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Assemblée non trouvée' });
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, existing.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const fields = ['date', 'heure', 'lieu', 'type', 'statut', 'quorum_requis', 'tantiemes_presents', 'total_tantiemes', 'pv_genere', 'convocations_envoyees'];
    const updates = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
      db.prepare(`UPDATE assemblees SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.id);
    }

    res.json(db.prepare(`
      SELECT a.*, c.nom as copropriete_nom FROM assemblees a
      LEFT JOIN coproprietes c ON a.copropriete_id = c.id WHERE a.id = ?
    `).get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM assemblees WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Assemblée non trouvée' });
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, existing.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    db.prepare('DELETE FROM assemblees WHERE id = ?').run(req.params.id);
    res.json({ message: 'Assemblée supprimée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/points
router.get('/:id/points', (req, res) => {
  try {
    const ag = db.prepare('SELECT * FROM assemblees WHERE id = ?').get(req.params.id);
    if (!ag) return res.status(404).json({ error: 'Assemblée non trouvée' });
    if (!checkAccess(req, ag.copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });
    res.json(db.prepare('SELECT * FROM ag_points WHERE assemblee_id = ? ORDER BY numero ASC').all(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/points
router.post('/:id/points', requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const ag = db.prepare('SELECT * FROM assemblees WHERE id = ?').get(req.params.id);
    if (!ag) return res.status(404).json({ error: 'Assemblée non trouvée' });
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, ag.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const { libelle, description, type_vote } = req.body;
    if (!libelle) return res.status(400).json({ error: 'libellé requis' });

    const maxNum = db.prepare('SELECT MAX(numero) as max FROM ag_points WHERE assemblee_id = ?').get(req.params.id);
    const result = db.prepare(`
      INSERT INTO ag_points (assemblee_id, numero, libelle, description, type_vote)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, (maxNum.max || 0) + 1, libelle, description || null, type_vote || 'Simple majorité');

    res.status(201).json(db.prepare('SELECT * FROM ag_points WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/convoquer — send convocation emails
router.post('/:id/convoquer', requireRole('gestionnaire', 'admin'), async (req, res) => {
  try {
    const ag = db.prepare(`
      SELECT a.*, c.nom as copropriete_nom, c.adresse as copropriete_adresse
      FROM assemblees a LEFT JOIN coproprietes c ON a.copropriete_id = c.id WHERE a.id = ?
    `).get(req.params.id);
    if (!ag) return res.status(404).json({ error: 'Assemblée non trouvée' });
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, ag.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const points = db.prepare('SELECT * FROM ag_points WHERE assemblee_id = ? ORDER BY numero ASC').all(req.params.id);
    const copros = db.prepare(`
      SELECT u.id, u.nom, u.prenom, u.email, l.numero as lot_numero, l.tantiemes
      FROM users u
      LEFT JOIN lots l ON u.lot_id = l.id
      WHERE u.role = 'copropietaire' AND u.copropriete_id = ? AND u.is_active = 1 AND u.email IS NOT NULL
    `).all(ag.copropriete_id);

    let sent = 0;
    for (const copro of copros) {
      try {
        await sendConvocation({
          to: copro.email,
          prenom: copro.prenom,
          nom: copro.nom,
          lot_numero: copro.lot_numero,
          tantiemes: copro.tantiemes,
          copropriete_nom: ag.copropriete_nom,
          copropriete_adresse: ag.copropriete_adresse,
          date: ag.date,
          heure: ag.heure,
          lieu: ag.lieu,
          type: ag.type,
          points,
          gestionnaire_nom: `${req.user.prenom} ${req.user.nom}`,
        });
        sent++;
      } catch (e) {
        console.error('[AG convocation] Erreur email à', copro.email, e.message);
      }
    }

    db.prepare('UPDATE assemblees SET convocations_envoyees = 1 WHERE id = ?').run(req.params.id);
    res.json({ sent, total: copros.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/presences — all lots with presence status
router.get('/:id/presences', (req, res) => {
  try {
    const ag = db.prepare('SELECT * FROM assemblees WHERE id = ?').get(req.params.id);
    if (!ag) return res.status(404).json({ error: 'Assemblée non trouvée' });
    if (!checkAccess(req, ag.copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });

    const rows = db.prepare(`
      SELECT l.id as lot_id, l.numero, l.type, l.proprietaire_nom, l.tantiemes,
        u.id as user_id, u.nom as user_nom, u.prenom as user_prenom,
        ap.id as presence_id, ap.statut as presence_statut, ap.mandataire_id,
        um.nom as mandataire_nom, um.prenom as mandataire_prenom
      FROM lots l
      LEFT JOIN users u ON u.lot_id = l.id AND u.role = 'copropietaire'
      LEFT JOIN assemblee_presences ap ON ap.lot_id = l.id AND ap.assemblee_id = ?
      LEFT JOIN users um ON ap.mandataire_id = um.id
      WHERE l.copropriete_id = ?
      ORDER BY l.numero ASC
    `).all(req.params.id, ag.copropriete_id);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/presences — upsert one lot's presence
router.post('/:id/presences', requireRole('gestionnaire', 'admin'), (req, res) => {
  try {
    const ag = db.prepare('SELECT * FROM assemblees WHERE id = ?').get(req.params.id);
    if (!ag) return res.status(404).json({ error: 'Assemblée non trouvée' });
    if (req.user.role === 'gestionnaire' && !canGestionnaireAccessResidence(req.user.id, ag.copropriete_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { lot_id, statut, user_id, mandataire_id } = req.body;
    if (!lot_id || !statut) return res.status(400).json({ error: 'lot_id et statut requis' });

    const lot = db.prepare('SELECT tantiemes FROM lots WHERE id = ?').get(lot_id);

    db.prepare(`
      INSERT INTO assemblee_presences (assemblee_id, lot_id, user_id, statut, mandataire_id, tantiemes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(assemblee_id, lot_id) DO UPDATE SET
        statut = excluded.statut, user_id = excluded.user_id,
        mandataire_id = excluded.mandataire_id, tantiemes = excluded.tantiemes
    `).run(req.params.id, lot_id, user_id || null, statut, mandataire_id || null, lot?.tantiemes || 0);

    // Recalculate quorum sums
    const sums = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN statut IN ('Présent','Procuration') THEN tantiemes ELSE 0 END), 0) as presents,
        (SELECT COALESCE(SUM(tantiemes), 0) FROM lots WHERE copropriete_id = ?) as total
      FROM assemblee_presences WHERE assemblee_id = ?
    `).get(ag.copropriete_id, req.params.id);

    db.prepare('UPDATE assemblees SET tantiemes_presents = ?, total_tantiemes = ? WHERE id = ?')
      .run(sums.presents, sums.total, req.params.id);

    res.json({ tantiemes_presents: sums.presents, total_tantiemes: sums.total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/feuille-emargement — printable HTML
router.get('/:id/feuille-emargement', (req, res) => {
  try {
    const ag = db.prepare(`
      SELECT a.*, c.nom as copropriete_nom, c.adresse as copropriete_adresse
      FROM assemblees a LEFT JOIN coproprietes c ON a.copropriete_id = c.id WHERE a.id = ?
    `).get(req.params.id);
    if (!ag) return res.status(404).json({ error: 'Assemblée non trouvée' });
    if (!checkAccess(req, ag.copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });

    const lots = db.prepare(`
      SELECT l.numero, l.type, l.proprietaire_nom, l.tantiemes,
        ap.statut as presence_statut,
        um.nom as mandataire_nom, um.prenom as mandataire_prenom
      FROM lots l
      LEFT JOIN assemblee_presences ap ON ap.lot_id = l.id AND ap.assemblee_id = ?
      LEFT JOIN users um ON ap.mandataire_id = um.id
      WHERE l.copropriete_id = ? ORDER BY l.numero ASC
    `).all(req.params.id, ag.copropriete_id);

    const totalT = lots.reduce((s, l) => s + (l.tantiemes || 0), 0);
    const gest = db.prepare('SELECT nom, prenom, signature_url FROM users WHERE id = ?').get(req.user.id);
    const sigImg = signatureBase64(gest?.signature_url);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlFeuilleEmargement(ag, lots, totalT, gest, sigImg));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/pv — PV HTML
router.get('/:id/pv', (req, res) => {
  try {
    const ag = db.prepare(`
      SELECT a.*, c.nom as copropriete_nom, c.adresse as copropriete_adresse
      FROM assemblees a LEFT JOIN coproprietes c ON a.copropriete_id = c.id WHERE a.id = ?
    `).get(req.params.id);
    if (!ag) return res.status(404).json({ error: 'Assemblée non trouvée' });
    if (!checkAccess(req, ag.copropriete_id)) return res.status(403).json({ error: 'Accès refusé' });

    const points = db.prepare('SELECT * FROM ag_points WHERE assemblee_id = ? ORDER BY numero ASC').all(req.params.id);
    const presences = db.prepare(`
      SELECT ap.statut, l.numero as lot_numero, l.proprietaire_nom, l.tantiemes,
        u.nom as user_nom, u.prenom as user_prenom,
        um.nom as mandataire_nom, um.prenom as mandataire_prenom
      FROM assemblee_presences ap
      JOIN lots l ON ap.lot_id = l.id
      LEFT JOIN users u ON ap.user_id = u.id
      LEFT JOIN users um ON ap.mandataire_id = um.id
      WHERE ap.assemblee_id = ? ORDER BY l.numero ASC
    `).all(req.params.id);

    db.prepare('UPDATE assemblees SET pv_genere = 1 WHERE id = ?').run(req.params.id);
    const gest = db.prepare('SELECT nom, prenom, signature_url FROM users WHERE id = ?').get(req.user.id);
    const sigImg = signatureBase64(gest?.signature_url);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlPV(ag, points, presences, gest, sigImg));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HTML generators ──────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return d; }
}

function htmlFeuilleEmargement(ag, lots, totalT, gest, sigImg) {
  const rows = lots.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${l.numero || ''}</td>
      <td>${l.type || ''}</td>
      <td>${l.proprietaire_nom || '—'}</td>
      <td style="text-align:right">${l.tantiemes || 0}</td>
      <td>${l.presence_statut === 'Procuration' ? `→ ${l.mandataire_prenom || ''} ${l.mandataire_nom || ''}`.trim() : ''}</td>
      <td style="min-width:80px"></td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Feuille d'émargement – ${ag.copropriete_nom}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px}
h1{font-size:17px;text-align:center;margin-bottom:3px}
h2{font-size:12px;text-align:center;color:#555;margin-bottom:14px;font-weight:normal}
.meta{display:flex;gap:14px;background:#f5f5f5;border:1px solid #ddd;padding:8px 12px;border-radius:4px;margin-bottom:14px}
.meta b{display:block;color:#555;font-size:10px}
table{width:100%;border-collapse:collapse}
th{background:#1e3a5f;color:#fff;padding:6px 7px;font-size:10px;text-transform:uppercase}
td{padding:5px 7px;border-bottom:1px solid #e5e5e5;vertical-align:middle}
tr:nth-child(even) td{background:#f9f9f9}
.total td{font-weight:bold;background:#eee!important}
.sigs{display:flex;justify-content:space-between;margin-top:24px}
.sig p{border-top:1px solid #999;width:170px;padding-top:4px;margin-top:36px;font-size:10px}
@media print{body{padding:8px}}
</style></head><body>
<h1>Feuille d'émargement</h1>
<h2>AG ${ag.type || 'Ordinaire'} – ${ag.copropriete_nom}</h2>
<div class="meta">
  <div><b>Date</b>${fmtDate(ag.date)}</div>
  <div><b>Heure</b>${ag.heure || '—'}</div>
  <div><b>Lieu</b>${ag.lieu || '—'}</div>
  <div><b>Lots</b>${lots.length}</div>
  <div><b>Total tantiemes</b>${totalT.toLocaleString('fr-FR')}</div>
</div>
<table>
<thead><tr><th>#</th><th>Lot</th><th>Type</th><th>Propriétaire</th><th>Tantiemes</th><th>Procuration</th><th>Signature</th></tr></thead>
<tbody>
${rows}
<tr class="total"><td colspan="4">TOTAL</td><td style="text-align:right">${totalT.toLocaleString('fr-FR')}</td><td colspan="2"></td></tr>
</tbody>
</table>
<div class="sigs">
  <div class="sig">
    ${sigImg ? `<img src="${sigImg}" style="max-height:50px;max-width:140px;object-fit:contain;display:block;margin-bottom:4px;" alt="signature">` : ''}
    <p>Le Syndic / Gestionnaire${gest ? ` — ${gest.prenom || ''} ${gest.nom || ''}`.trim() : ''}</p>
  </div>
  <div class="sig"><p>Le Président de séance</p></div>
  <div class="sig"><p>Le Secrétaire</p></div>
</div>
</body></html>`;
}

function htmlPV(ag, points, presences, gest, sigImg) {
  const presents = presences.filter((p) => p.statut === 'Présent' || p.statut === 'Procuration');
  const tantiemesPresents = presents.reduce((s, p) => s + (p.tantiemes || 0), 0);
  const totalT = ag.total_tantiemes || presences.reduce((s, p) => s + (p.tantiemes || 0), 0);
  const quorumReq = ag.quorum_requis || 50;
  const quorumPct = totalT > 0 ? Math.round((tantiemesPresents / totalT) * 100) : 0;
  const quorumOk = quorumPct >= quorumReq;

  const presenceRows = presences.map((p) => `
    <tr>
      <td>${p.lot_numero || ''}</td>
      <td>${p.proprietaire_nom || (p.user_prenom ? `${p.user_prenom} ${p.user_nom}` : '—')}</td>
      <td>${p.statut}${p.statut === 'Procuration' ? ` (→ ${p.mandataire_prenom || ''} ${p.mandataire_nom || ''})` : ''}</td>
      <td style="text-align:right">${p.tantiemes || 0}</td>
    </tr>`).join('');

  const pointsHtml = points.map((pt) => {
    const res = pt.resultat;
    const col = res === 'Approuvé' ? '#15803d' : res === 'Refusé' ? '#b91c1c' : '#b45309';
    const bg = res === 'Approuvé' ? '#f0fdf4' : res === 'Refusé' ? '#fef2f2' : '#fffbeb';
    return `
    <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      <div style="background:#1e3a5f;color:#fff;padding:7px 12px;font-weight:bold;font-size:12px">
        Point ${pt.numero} — ${pt.libelle}
      </div>
      <div style="padding:10px 12px">
        ${pt.description ? `<p style="color:#4b5563;font-size:11px;margin-bottom:8px">${pt.description}</p>` : ''}
        <p style="font-size:10px;color:#6b7280;margin-bottom:6px">Mode de vote : <strong>${pt.type_vote}</strong></p>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px">
          <tr>
            <td style="padding:3px 8px;background:#f0fdf4;color:#15803d;font-weight:bold">Pour</td>
            <td style="padding:3px 8px;background:#f0fdf4;color:#15803d">${pt.votes_pour || 0} voix${pt.tantiemes_pour ? ` / ${pt.tantiemes_pour} tant.` : ''}</td>
            <td style="padding:3px 8px;background:#fef2f2;color:#b91c1c;font-weight:bold">Contre</td>
            <td style="padding:3px 8px;background:#fef2f2;color:#b91c1c">${pt.votes_contre || 0} voix${pt.tantiemes_contre ? ` / ${pt.tantiemes_contre} tant.` : ''}</td>
            <td style="padding:3px 8px;background:#f3f4f6;color:#4b5563;font-weight:bold">Abstn.</td>
            <td style="padding:3px 8px;background:#f3f4f6;color:#4b5563">${pt.votes_abstention || 0}</td>
          </tr>
        </table>
        ${res
          ? `<div style="display:inline-block;background:${bg};color:${col};border:1px solid ${col};padding:3px 10px;border-radius:4px;font-weight:bold;font-size:12px">${res === 'Approuvé' ? '✓' : '✗'} ${res}</div>`
          : '<span style="color:#9ca3af;font-size:11px">— vote non enregistré</span>'}
        ${pt.notes ? `<p style="margin-top:8px;font-size:11px;color:#374151;background:#f8fafc;padding:6px 8px;border-radius:4px">${pt.notes}</p>` : ''}
      </div>
    </div>`;
  }).join('');

  const today = new Date().toLocaleDateString('fr-FR');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>PV AG – ${ag.copropriete_nom}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px;max-width:800px;margin:0 auto}
h1{font-size:20px;text-align:center;margin-bottom:3px;color:#1e3a5f}
h2{font-size:13px;text-align:center;color:#555;margin-bottom:18px;font-weight:normal}
.section{font-size:13px;font-weight:bold;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:3px;margin:18px 0 10px}
.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;border-radius:6px;margin-bottom:14px}
.meta label{font-weight:bold;font-size:10px;text-transform:uppercase;color:#555;display:block}
.meta span{font-size:12px}
table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px}
th{background:#1e3a5f;color:#fff;padding:5px 7px;font-size:10px;text-transform:uppercase}
td{padding:4px 7px;border-bottom:1px solid #e5e5e5}
.quorum{padding:10px 14px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.sigs{display:flex;justify-content:space-between;margin-top:28px}
.sig{text-align:center}
.sig-line{border-top:1px solid #999;width:150px;margin:32px auto 4px;font-size:10px}
@media print{body{padding:10px}}
</style></head><body>
<h1>Procès-Verbal d'Assemblée Générale</h1>
<h2>${ag.type || 'Ordinaire'} – ${ag.copropriete_nom}</h2>

<div class="meta">
  <div><label>Date</label><span>${fmtDate(ag.date)}</span></div>
  <div><label>Heure</label><span>${ag.heure || '—'}</span></div>
  <div><label>Lieu</label><span>${ag.lieu || '—'}</span></div>
  <div><label>Résidence</label><span>${ag.copropriete_nom}</span></div>
  <div><label>Adresse</label><span>${ag.copropriete_adresse || '—'}</span></div>
  <div><label>Type</label><span>${ag.type || 'Ordinaire'}</span></div>
</div>

<p class="section">1. Quorum et présences</p>

<div class="quorum" style="background:${quorumOk ? '#f0fdf4' : '#fef2f2'};border:1px solid ${quorumOk ? '#bbf7d0' : '#fecaca'}">
  <div>
    <div style="font-weight:bold;font-size:14px">Quorum : ${quorumPct}%</div>
    <div style="font-size:11px;color:#555">${tantiemesPresents.toLocaleString('fr-FR')} / ${totalT.toLocaleString('fr-FR')} tantiemes présents — requis : ${quorumReq}%</div>
  </div>
  <div style="font-weight:bold;font-size:17px;color:${quorumOk ? '#15803d' : '#b91c1c'}">${quorumOk ? '✓ Atteint' : '✗ Non atteint'}</div>
</div>

<table>
  <thead><tr><th>Lot</th><th>Propriétaire</th><th>Présence</th><th>Tantiemes</th></tr></thead>
  <tbody>${presenceRows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">Aucune présence enregistrée</td></tr>'}</tbody>
</table>

<p class="section">2. Ordre du jour et votes</p>

${pointsHtml || '<p style="color:#6b7280;font-size:12px">Aucun point enregistré.</p>'}

<p class="section">3. Clôture</p>
<p style="font-size:12px;color:#374151;line-height:1.7">
  L'Assemblée Générale ${ag.type || 'Ordinaire'} de la copropriété <strong>${ag.copropriete_nom}</strong> est levée à ______ heures.
  Le présent procès-verbal est établi conformément aux dispositions de la loi 18-00 relative au statut de la copropriété des immeubles bâtis au Maroc.
</p>

<div class="sigs">
  <div class="sig">
    ${sigImg ? `<img src="${sigImg}" style="max-height:55px;max-width:150px;object-fit:contain;display:block;margin-bottom:4px;" alt="signature">` : '<div style="height:55px"></div>'}
    <div class="sig-line">Le Syndic / Gestionnaire${gest ? ` — ${gest.prenom || ''} ${gest.nom || ''}`.trim() : ''}</div>
  </div>
  <div class="sig"><div class="sig-line">Le Président de séance</div></div>
  <div class="sig"><div class="sig-line">Le Secrétaire</div></div>
</div>

<p style="text-align:center;margin-top:20px;font-size:10px;color:#9ca3af">
  Document généré par SyndicPro – syndicpro.propnex.ma – ${today}
</p>
</body></html>`;
}

module.exports = router;
