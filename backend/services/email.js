'use strict';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.FROM_EMAIL || 'SyndicPro <noreply@propnex.ma>';
const APP_URL = process.env.APP_URL || 'https://syndicpro.propnex.ma';

// ─── Core send function ───────────────────────────────────────────────────────

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY non configuré, email ignoré.');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[email] Erreur Resend:', err);
      return false;
    }
    console.log(`[email] Envoyé à ${Array.isArray(to) ? to.join(', ') : to} — ${subject}`);
    return true;
  } catch (err) {
    console.error('[email] Erreur réseau:', err.message);
    return false;
  }
}

// ─── Base HTML template ───────────────────────────────────────────────────────

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:24px 32px;border-radius:8px 8px 0 0;">
            <div style="color:white;font-size:22px;font-weight:bold;">&#127962; SyndicPro</div>
            <div style="color:#93c5fd;font-size:13px;margin-top:4px;">Gestion de copropriété</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:white;padding:32px;border-radius:0 0 8px 8px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px;text-align:center;color:#9ca3af;font-size:12px;">
            SyndicPro – Gestion de copropriété<br>
            <a href="${APP_URL}" style="color:#3b82f6;">syndicpro.propnex.ma</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(lien, label) {
  return `<a href="${lien}" style="display:inline-block;background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px;">${label}</a>`;
}

function statutBadge(statut) {
  const colors = {
    'Ouvert': '#3b82f6',
    'En cours': '#f59e0b',
    'Résolu': '#10b981',
    'Fermé': '#6b7280',
    'En attente': '#f59e0b',
  };
  const bg = colors[statut] || '#6b7280';
  return `<span style="display:inline-block;background:${bg};color:white;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${statut}</span>`;
}

function prioriteBadge(priorite) {
  const colors = {
    'Haute': '#ef4444',
    'Normale': '#f59e0b',
    'Basse': '#10b981',
    'Urgente': '#dc2626',
  };
  const bg = colors[priorite] || '#6b7280';
  return `<span style="display:inline-block;background:${bg};color:white;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${priorite}</span>`;
}

function infoRow(label, value) {
  return `<tr>
    <td style="padding:6px 0;color:#6b7280;font-size:14px;width:40%;">${label}</td>
    <td style="padding:6px 0;color:#1f2937;font-size:14px;font-weight:600;">${value || '—'}</td>
  </tr>`;
}

// ─── 1. Bienvenue / création de compte ───────────────────────────────────────

async function sendBienvenue({ to, prenom, nom, email, password, role, residence }) {
  const roleLabel = {
    gestionnaire: 'Gestionnaire',
    copropietaire: 'Copropriétaire',
    admin: 'Administrateur',
  }[role] || role;

  const content = `
    <h2 style="color:#1e3a5f;margin-top:0;">Bienvenue sur SyndicPro, ${prenom} !</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">
      Votre compte a été créé avec succès. Vous avez accès à la plateforme SyndicPro en tant que <strong>${roleLabel}</strong>${residence ? ` pour la résidence <strong>${residence}</strong>` : ''}.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <div style="font-size:14px;font-weight:bold;color:#1e3a5f;margin-bottom:12px;">&#128274; Vos identifiants de connexion</div>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${infoRow('Email', email)}
        ${infoRow('Mot de passe temporaire', `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:monospace;">${password}</code>`)}
        ${infoRow('Rôle', roleLabel)}
        ${residence ? infoRow('Résidence', residence) : ''}
      </table>
    </div>

    <p style="color:#ef4444;font-size:13px;">&#9888; Pour des raisons de sécurité, nous vous recommandons de changer votre mot de passe dès votre première connexion.</p>

    ${ctaButton(APP_URL, 'Accéder à SyndicPro')}

    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Si vous n'êtes pas à l'origine de cette création de compte, veuillez contacter votre gestionnaire.</p>
  `;

  return sendEmail({
    to,
    subject: 'Bienvenue sur SyndicPro – Vos accès',
    html: baseTemplate(content),
  });
}

// ─── 2. Nouveau ticket créé (→ gestionnaire) ─────────────────────────────────

async function sendNouveauTicket({ to, gestionnaire_prenom, copro_nom, copro_prenom, titre, description, categorie, priorite, lien }) {
  const content = `
    <h2 style="color:#1e3a5f;margin-top:0;">Nouveau ticket ouvert</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">
      Bonjour ${gestionnaire_prenom || 'Gestionnaire'},<br>
      Un copropriétaire vient d'ouvrir un nouveau ticket qui requiert votre attention.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <div style="font-size:14px;font-weight:bold;color:#1e3a5f;margin-bottom:12px;">&#127993; Détails du ticket</div>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${infoRow('Titre', `<strong>${titre}</strong>`)}
        ${infoRow('Copropriétaire', `${copro_prenom || ''} ${copro_nom || ''}`.trim())}
        ${infoRow('Catégorie', categorie || 'Général')}
        ${infoRow('Priorité', prioriteBadge(priorite || 'Normale'))}
      </table>
    </div>

    <div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:16px;border-radius:0 6px 6px 0;margin:16px 0;">
      <div style="font-size:13px;font-weight:bold;color:#92400e;margin-bottom:8px;">Description</div>
      <p style="color:#4b5563;font-size:14px;margin:0;line-height:1.6;">${description}</p>
    </div>

    ${ctaButton(lien || APP_URL, 'Traiter le ticket')}
  `;

  return sendEmail({
    to,
    subject: `[SyndicPro] Nouveau ticket – ${titre}`,
    html: baseTemplate(content),
  });
}

// ─── 3. Réponse à un ticket (→ auteur du ticket) ─────────────────────────────

async function sendReponseTicket({ to, prenom, titre, reponse, auteur_reponse, statut, lien }) {
  const content = `
    <h2 style="color:#1e3a5f;margin-top:0;">Réponse à votre ticket</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">
      Bonjour ${prenom || ''},<br>
      Une réponse a été apportée à votre ticket <strong>${titre}</strong>.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <table cellpadding="0" cellspacing="0" width="100%">
        ${infoRow('Ticket', titre)}
        ${infoRow('Statut actuel', statutBadge(statut || 'En cours'))}
        ${infoRow('Répondu par', auteur_reponse || '—')}
      </table>
    </div>

    <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:16px;border-radius:0 6px 6px 0;margin:16px 0;">
      <div style="font-size:13px;font-weight:bold;color:#065f46;margin-bottom:8px;">Message</div>
      <p style="color:#4b5563;font-size:14px;margin:0;line-height:1.6;">${reponse}</p>
    </div>

    ${ctaButton(lien || APP_URL, 'Voir le ticket')}
  `;

  return sendEmail({
    to,
    subject: `[SyndicPro] Réponse à votre ticket – ${titre}`,
    html: baseTemplate(content),
  });
}

// ─── 4. Ticket clôturé (→ auteur du ticket) ──────────────────────────────────

async function sendTicketCloture({ to, prenom, titre, resolution }) {
  const content = `
    <h2 style="color:#1e3a5f;margin-top:0;">Votre ticket a été résolu</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">
      Bonjour ${prenom || ''},<br>
      Votre ticket <strong>${titre}</strong> a été marqué comme résolu.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">&#10003;</div>
      <div style="font-size:16px;font-weight:bold;color:#065f46;">Ticket résolu</div>
      <div style="color:#6b7280;font-size:14px;margin-top:4px;">${titre}</div>
    </div>

    ${resolution ? `
    <div style="background:#f8fafc;border-left:4px solid #10b981;padding:16px;border-radius:0 6px 6px 0;margin:16px 0;">
      <div style="font-size:13px;font-weight:bold;color:#1e3a5f;margin-bottom:8px;">Résolution</div>
      <p style="color:#4b5563;font-size:14px;margin:0;line-height:1.6;">${resolution}</p>
    </div>` : ''}

    ${ctaButton(APP_URL, 'Consulter mes tickets')}

    <p style="color:#9ca3af;font-size:12px;margin-top:20px;">Si le problème persiste, n'hésitez pas à ouvrir un nouveau ticket.</p>
  `;

  return sendEmail({
    to,
    subject: `[SyndicPro] Ticket résolu – ${titre}`,
    html: baseTemplate(content),
  });
}

// ─── 5. Relance cotisation (→ copropriétaire) ─────────────────────────────────

async function sendRelance({ to, prenom, type, objet, message, residence, date_fin, gestionnaire_nom, lien }) {
  const typeColors = {
    'Rappel': '#3b82f6',
    'Relance': '#f59e0b',
    'Mise en demeure': '#ef4444',
  };
  const typeBg = typeColors[type] || '#6b7280';

  const content = `
    <h2 style="color:#1e3a5f;margin-top:0;">${objet}</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">
      Bonjour ${prenom || ''},
    </p>

    <div style="margin-bottom:16px;">
      <span style="display:inline-block;background:${typeBg};color:white;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold;">${type}</span>
    </div>

    <div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:16px;border-radius:0 6px 6px 0;margin:16px 0;">
      <p style="color:#4b5563;font-size:15px;margin:0;line-height:1.7;">${message}</p>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <div style="font-size:14px;font-weight:bold;color:#1e3a5f;margin-bottom:12px;">&#8505; Informations</div>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${residence ? infoRow('Résidence', residence) : ''}
        ${date_fin ? infoRow('Date limite', `<strong style="color:#ef4444;">${date_fin}</strong>`) : ''}
        ${gestionnaire_nom ? infoRow('Votre gestionnaire', gestionnaire_nom) : ''}
        ${infoRow('Montant', '<span style="font-size:12px;color:#6b7280;">Le montant indiqué correspond aux cotisations impayées à ce jour uniquement.</span>')}
      </table>
    </div>

    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;margin:20px 0;">
      <div style="font-size:14px;font-weight:bold;color:#1e3a5f;margin-bottom:12px;">💳 Modalités de règlement</div>
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="vertical-align:top;padding-right:20px;width:50%;">
            <div style="font-size:12px;font-weight:bold;color:#374151;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Par virement bancaire</div>
            ${infoRow('Banque', 'CIH BANK')}
            ${infoRow('Titulaire', 'PROPNEX SARLAU')}
            ${infoRow('RIB', '<span style="font-family:monospace;font-weight:bold;">230 780 6472792221032000 09</span>')}
            ${infoRow('SWIFT', '<span style="font-family:monospace;">CIHMMAMC</span>')}
          </td>
          <td style="vertical-align:top;width:50%;">
            <div style="font-size:12px;font-weight:bold;color:#374151;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Par chèque</div>
            ${infoRow('À l\'ordre de', '<strong>PROPNEX SARLAU</strong>')}
            <tr><td colspan="2" style="padding-top:6px;font-size:12px;color:#6b7280;">À remettre au gestionnaire de votre résidence.</td></tr>
          </td>
        </tr>
      </table>
    </div>

    ${ctaButton(lien || APP_URL, 'Voir mes cotisations')}
  `;

  return sendEmail({
    to,
    subject: `[SyndicPro] ${objet}`,
    html: baseTemplate(content),
  });
}

// ─── 6. Appel de fonds (→ copropriétaires) ────────────────────────────────────

async function sendAppelFonds({ to, prenom, residence, libelle, montant_total, date_echeance, motif, lien }) {
  const montantFormate = typeof montant_total === 'number'
    ? montant_total.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' MAD'
    : montant_total;

  const content = `
    <h2 style="color:#1e3a5f;margin-top:0;">Appel de fonds – ${residence}</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">
      Bonjour ${prenom || ''},<br>
      Un nouvel appel de fonds a été émis pour votre résidence <strong>${residence}</strong>.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
      <div style="color:#1e3a5f;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Montant</div>
      <div style="color:#1e3a5f;font-size:32px;font-weight:bold;">${montantFormate}</div>
      ${date_echeance ? `<div style="color:#6b7280;font-size:13px;margin-top:8px;">Échéance : <strong>${date_echeance}</strong></div>` : ''}
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <table cellpadding="0" cellspacing="0" width="100%">
        ${infoRow('Libellé', libelle)}
        ${infoRow('Résidence', residence)}
        ${date_echeance ? infoRow('Date d\'échéance', `<strong style="color:#ef4444;">${date_echeance}</strong>`) : ''}
        ${motif ? infoRow('Motif', motif) : ''}
      </table>
    </div>

    ${ctaButton(lien || APP_URL, 'Voir l\'appel de fonds')}

    <p style="color:#9ca3af;font-size:12px;margin-top:20px;">Pour toute question, contactez votre gestionnaire de résidence.</p>
  `;

  return sendEmail({
    to,
    subject: `[SyndicPro] Appel de fonds – ${residence}`,
    html: baseTemplate(content),
  });
}

// ─── 7. Message broadcast (→ copropriétaires) ─────────────────────────────────

async function sendMessageBroadcast({ to, prenom, residence, titre, contenu, gestionnaire_nom, pieces_jointes = [] }) {
  const pjSection = pieces_jointes.length > 0 ? `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:16px 0;">
      <div style="font-size:13px;font-weight:bold;color:#1e3a5f;margin-bottom:10px;">&#128206; Pièces jointes (${pieces_jointes.length})</div>
      ${pieces_jointes.map((pj) => {
        const isPdf = pj.mimetype === 'application/pdf';
        const icon = isPdf ? '&#128196;' : '&#128247;';
        const fileUrl = `${APP_URL}${pj.url}`;
        return `<div style="margin-bottom:8px;">
          <a href="${fileUrl}" style="display:inline-flex;align-items:center;gap:6px;color:#3b82f6;text-decoration:none;font-size:14px;font-weight:500;">
            <span>${icon}</span>
            <span style="text-decoration:underline;">${pj.original_name}</span>
          </a>
        </div>`;
      }).join('')}
    </div>` : '';

  const content = `
    <h2 style="color:#1e3a5f;margin-top:0;">Message de votre résidence</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">
      Bonjour ${prenom || ''},<br>
      Vous avez reçu un message de la part de votre gestionnaire concernant la résidence <strong>${residence}</strong>.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <div style="font-size:16px;font-weight:bold;color:#1e3a5f;margin-bottom:12px;">&#128233; ${titre}</div>
      <div style="height:1px;background:#e2e8f0;margin-bottom:16px;"></div>
      <p style="color:#374151;font-size:15px;margin:0;line-height:1.7;white-space:pre-wrap;">${contenu}</p>
    </div>

    ${pjSection}

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;margin:16px 0;font-size:13px;color:#065f46;">
      Message envoyé par <strong>${gestionnaire_nom || 'votre gestionnaire'}</strong> – Résidence ${residence}
    </div>

    ${ctaButton(APP_URL, 'Voir tous les messages')}
  `;

  return sendEmail({
    to,
    subject: `[SyndicPro] Message de votre résidence – ${titre}`,
    html: baseTemplate(content),
  });
}

// ─── 8. Alerte expiration cotisation (→ copropriétaire) ──────────────────────

async function sendAlertExpirationCotisation({ to, prenom, residence, date_fin, jours_restants, lien }) {
  const urgence = jours_restants <= 7 ? 'rouge' : jours_restants <= 30 ? 'orange' : 'normal';
  const headerColor = urgence === 'rouge' ? '#ef4444' : urgence === 'orange' ? '#f59e0b' : '#3b82f6';
  const bgColor = urgence === 'rouge' ? '#fef2f2' : urgence === 'orange' ? '#fff7ed' : '#eff6ff';
  const borderColor = urgence === 'rouge' ? '#fecaca' : urgence === 'orange' ? '#fed7aa' : '#bfdbfe';

  const content = `
    <h2 style="color:#1e3a5f;margin-top:0;">Votre cotisation expire bientôt</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">
      Bonjour ${prenom || ''},<br>
      Nous vous informons que votre cotisation pour la résidence <strong>${residence}</strong> arrive à expiration.
    </p>

    <div style="background:${bgColor};border:2px solid ${borderColor};border-radius:8px;padding:24px;margin:20px 0;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">&#9203;</div>
      <div style="color:${headerColor};font-size:28px;font-weight:bold;">${jours_restants} jour${jours_restants > 1 ? 's' : ''}</div>
      <div style="color:#6b7280;font-size:14px;margin-top:4px;">restants avant expiration</div>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <table cellpadding="0" cellspacing="0" width="100%">
        ${infoRow('Résidence', residence)}
        ${infoRow('Date d\'expiration', `<strong style="color:${headerColor};">${date_fin}</strong>`)}
        ${infoRow('Jours restants', `<strong>${jours_restants} jour${jours_restants > 1 ? 's' : ''}</strong>`)}
      </table>
    </div>

    <p style="color:#4b5563;font-size:14px;line-height:1.6;">Veuillez prendre contact avec votre gestionnaire pour renouveler votre cotisation avant la date d'expiration.</p>

    ${ctaButton(lien || APP_URL, 'Voir ma cotisation')}
  `;

  return sendEmail({
    to,
    subject: `[SyndicPro] Votre cotisation expire dans ${jours_restants} jours`,
    html: baseTemplate(content),
  });
}

// ─── 9. Convocation AG (→ copropriétaires) ───────────────────────────────────

async function sendConvocation({ to, prenom, nom, lot_numero, tantiemes, copropriete_nom, copropriete_adresse, date, heure, lieu, type, points, gestionnaire_nom }) {
  const dateFormate = date ? new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : date;

  const pointsHtml = (points || []).map((pt, i) => `
    <tr>
      <td style="padding:5px 8px;color:#1e3a5f;font-weight:bold;vertical-align:top">${i + 1}.</td>
      <td style="padding:5px 8px;color:#374151">${pt.libelle}${pt.description ? `<br><span style="font-size:12px;color:#6b7280">${pt.description}</span>` : ''}</td>
      <td style="padding:5px 8px;color:#6b7280;font-size:12px;white-space:nowrap">${pt.type_vote || 'Simple majorité'}</td>
    </tr>`).join('');

  const content = `
    <h2 style="color:#1e3a5f;margin-top:0;">Convocation à l'Assemblée Générale</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">
      Bonjour ${prenom || ''} ${nom || ''},<br>
      Vous êtes convoqué(e) à l'Assemblée Générale <strong>${type || 'Ordinaire'}</strong> de la résidence <strong>${copropriete_nom}</strong>.
    </p>

    <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:8px;padding:20px;margin:20px 0;">
      <div style="font-size:14px;font-weight:bold;color:#1e3a5f;margin-bottom:12px;">&#128197; Détails de la séance</div>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${infoRow('Date', `<strong style="color:#1e3a5f">${dateFormate}</strong>`)}
        ${infoRow('Heure', `<strong>${heure || '—'}</strong>`)}
        ${infoRow('Lieu', lieu || '—')}
        ${copropriete_adresse ? infoRow('Adresse', copropriete_adresse) : ''}
        ${lot_numero ? infoRow('Votre lot', lot_numero) : ''}
        ${tantiemes ? infoRow('Vos tantiemes', `${tantiemes}`) : ''}
      </table>
    </div>

    ${pointsHtml ? `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <div style="font-size:14px;font-weight:bold;color:#1e3a5f;margin-bottom:12px;">&#128203; Ordre du jour</div>
      <table cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #e5e7eb">
        ${pointsHtml}
      </table>
    </div>` : ''}

    <div style="background:#fefce8;border:1px solid #fef08a;border-radius:6px;padding:12px 16px;font-size:13px;color:#713f12;margin:16px 0;">
      &#9888; Si vous ne pouvez pas assister à cette assemblée, vous pouvez donner procuration à un autre copropriétaire. Contactez votre gestionnaire.
    </div>

    <p style="color:#4b5563;font-size:13px;margin-top:16px;">
      Convocation envoyée par <strong>${gestionnaire_nom || 'votre gestionnaire'}</strong> — Résidence ${copropriete_nom}
    </p>

    ${ctaButton(APP_URL, 'Accéder à SyndicPro')}
  `;

  return sendEmail({
    to,
    subject: `[SyndicPro] Convocation AG ${type || 'Ordinaire'} – ${copropriete_nom} – ${date || ''}`,
    html: baseTemplate(content),
  });
}

// ─── 10. Quitus de cotisation (→ copropriétaire) ─────────────────────────────

async function sendQuitus({ to, prenom, nom, lot_numero, copropriete_nom, copropriete_adresse, montant_mensuel, date_debut, date_fin, nb_mois_payes, total_paye, gestionnaire_nom }) {
  const fmtMAD = (n) => (n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD';
  const fmtPeriod = (d) => {
    if (!d) return '—';
    const s = d.length === 7 ? d : d.substring(0, 7);
    const [y, m] = s.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };
  const today = new Date().toLocaleDateString('fr-FR');

  const content = `
    <h2 style="color:#1e3a5f;margin-top:0;">Quitus de cotisation</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">
      Bonjour ${prenom || ''} ${nom || ''},<br>
      Nous avons le plaisir de vous confirmer que votre cotisation pour la résidence <strong>${copropriete_nom}</strong> est en règle.
    </p>

    <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">&#9989;</div>
      <div style="color:#065f46;font-size:18px;font-weight:bold;">Quitus accordé</div>
      <div style="color:#6b7280;font-size:13px;margin-top:4px;">Cotisation à jour au ${today}</div>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <div style="font-size:14px;font-weight:bold;color:#1e3a5f;margin-bottom:12px;">&#128203; Détails de la cotisation</div>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${lot_numero ? infoRow('Lot', `N° ${lot_numero}`) : ''}
        ${infoRow('Résidence', copropriete_nom)}
        ${copropriete_adresse ? infoRow('Adresse', copropriete_adresse) : ''}
        ${infoRow('Période', `${fmtPeriod(date_debut)} → ${fmtPeriod(date_fin)}`)}
        ${infoRow('Montant mensuel', `<strong>${fmtMAD(montant_mensuel)}</strong>`)}
        ${infoRow('Mois réglés', `<strong style="color:#16a34a;">${nb_mois_payes} mois</strong>`)}
        ${infoRow('Total réglé', `<strong style="color:#1e3a5f;font-size:15px;">${fmtMAD(total_paye)}</strong>`)}
      </table>
    </div>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px 16px;margin:16px 0;font-size:13px;color:#1e40af;">
      &#8505; Ce quitus certifie que vous êtes à jour de vos cotisations au ${today}. Conservez ce document à titre de justificatif.
    </div>

    <p style="color:#4b5563;font-size:13px;margin-top:16px;">
      Document émis par <strong>${gestionnaire_nom || 'votre gestionnaire'}</strong> — Résidence ${copropriete_nom}
    </p>

    ${ctaButton(APP_URL, 'Accéder à SyndicPro')}
  `;

  return sendEmail({
    to,
    subject: `[SyndicPro] Quitus de cotisation – ${copropriete_nom}`,
    html: baseTemplate(content),
  });
}

module.exports = {
  sendEmail,
  sendBienvenue,
  sendNouveauTicket,
  sendReponseTicket,
  sendTicketCloture,
  sendRelance,
  sendAppelFonds,
  sendMessageBroadcast,
  sendAlertExpirationCotisation,
  sendConvocation,
  sendQuitus,
};
