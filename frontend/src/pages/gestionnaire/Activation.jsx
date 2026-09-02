import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { coproprietes as coproApi, users as usersApi } from '../../api/client';

const WHATSAPP_SYNDIC = '+212638663960';

function statutLabel(lot) {
  if (!lot.user_id) return { label: 'Sans compte', color: 'bg-gray-100 text-gray-500', icon: '○' };
  if (lot.last_login) return { label: 'Activé', color: 'bg-green-100 text-green-700', icon: '✓' };
  return { label: 'Non connecté', color: 'bg-amber-100 text-amber-700', icon: '◌' };
}

function buildWhatsAppLink(lot, email, password, residence, activationToken) {
  const tel = lot.telephone ? lot.telephone.replace(/[\s\-]/g, '').replace(/^0/, '+212') : '';
  const prenom = lot.prenom || lot.nom || 'Madame/Monsieur';
  const activationLink = activationToken
    ? `https://syndicpro.propnex.ma/activer?token=${activationToken}`
    : 'https://syndicpro.propnex.ma';
  const msg = `Bonjour ${prenom},\n\nVotre espace copropriétaire pour *${residence}* géré par Propnex Property Management est prêt.\n\nCliquez sur ce lien pour activer votre compte et choisir votre mot de passe :\n🔗 ${activationLink}\n\n_(Identifiants provisoires si besoin : 📧 ${email} / 🔑 ${password})_\n\nÀ votre disposition,\n_Propnex Property Management_`;
  if (tel) return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export default function Activation() {
  const { selectedCoproId, coproprietes } = useAuth();
  const selectedCoproName = coproprietes?.find(c => c.id === selectedCoproId)?.nom || 'votre résidence';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState({});
  const [filter, setFilter] = useState('tous');

  const load = () => {
    if (!selectedCoproId) { setLoading(false); return; }
    coproApi.getActivation(selectedCoproId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); setData(null); load(); }, [selectedCoproId]);

  const handleInviteWhatsApp = async (lot) => {
    setSending(s => ({ ...s, [lot.lot_id]: true }));
    try {
      const res = await usersApi.resendCredentials(lot.user_id);
      const residence = selectedCoproName || 'votre résidence';
      const activationLink = res.activationToken
        ? `https://syndicpro.propnex.ma/activer?token=${res.activationToken}`
        : 'https://syndicpro.propnex.ma';
      const prenom = lot.prenom || lot.nom || 'Madame/Monsieur';
      const message = `Bonjour ${prenom},\n\nVotre espace copropriétaire pour *${residence}* géré par Propnex Property Management est prêt.\n\nCliquez sur ce lien pour activer votre compte et choisir votre mot de passe :\n🔗 ${activationLink}\n\n_(Identifiants provisoires si besoin : 📧 ${res.email} / 🔑 ${res.tempPassword})_\n\nÀ votre disposition,\n_Propnex Property Management_`;

      // Tente envoi via Chatwoot, fallback wa.me si échec
      try {
        await usersApi.sendWhatsAppInvite(lot.user_id, {
          phone: lot.telephone,
          prenom: lot.prenom,
          nom: lot.nom,
          message,
        });
        alert('Message envoyé via Chatwoot ✓');
      } catch {
        const link = buildWhatsAppLink(lot, res.email, res.tempPassword, residence, res.activationToken);
        window.open(link, '_blank');
      }

      setTimeout(() => load(), 1200);
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(s => ({ ...s, [lot.lot_id]: false }));
    }
  };

  const handleInviteAll = async () => {
    const pending = filtered.filter(l => l.user_id && !l.last_login);
    if (!pending.length) return;
    if (!confirm(`Générer de nouveaux identifiants pour ${pending.length} copropriétaire(s) non connecté(s) ?`)) return;
    for (const lot of pending) {
      await handleInviteWhatsApp(lot);
    }
  };

  if (!selectedCoproId) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700 text-sm">Aucune résidence sélectionnée.</div>;
  }

  const filtered = data?.lots?.filter(l => {
    if (filter === 'actives') return !!l.last_login;
    if (filter === 'pending') return l.user_id && !l.last_login;
    if (filter === 'sans_compte') return !l.user_id;
    return true;
  }) || [];

  const pct = data ? Math.round((data.actives / Math.max(data.total_lots, 1)) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Activation copropriétaires</h1>
          <p className="text-sm text-gray-500 mt-0.5">Suivi des inscriptions et invitations WhatsApp</p>
        </div>
        {data && (
          <button
            onClick={handleInviteAll}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.856L0 24l6.336-1.525A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.892 0-3.667-.498-5.2-1.37l-.372-.217-3.862.93.97-3.767-.239-.384A9.946 9.946 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            Inviter tous les non-connectés
          </button>
        )}
      </div>

      {/* Stats cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 font-medium">Total lots</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{data.total_lots}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 font-medium">Avec compte</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{data.avec_compte}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 font-medium">Activés</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{data.actives}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 font-medium">Taux d'activation</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{pct}%</p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {data && (
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'tous', label: `Tous (${data.total_lots})` },
            { key: 'actives', label: `Activés (${data.actives})` },
            { key: 'pending', label: `Non connectés (${data.avec_compte - data.actives})` },
            { key: 'sans_compte', label: `Sans compte (${data.total_lots - data.avec_compte})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filtered.map((lot) => {
              const statut = statutLabel(lot);
              const isSending = sending[lot.lot_id];
              return (
                <div key={lot.lot_id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">{lot.numero}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {lot.user_id ? (
                      <>
                        <p className="text-sm font-medium text-gray-800">{lot.prenom} {lot.nom}</p>
                        <p className="text-xs text-gray-400">{lot.email} {lot.telephone ? `· ${lot.telephone}` : ''}</p>
                        {lot.whatsapp_invite_sent_at && !lot.last_login && (
                          <p className="text-xs text-green-700 mt-0.5 flex items-center gap-1">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.856L0 24l6.336-1.525A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.892 0-3.667-.498-5.2-1.37l-.372-.217-3.862.93.97-3.767-.239-.384A9.946 9.946 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                            Invitation envoyée le {new Date(lot.whatsapp_invite_sent_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} à {new Date(lot.whatsapp_invite_sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        {lot.last_login && (
                          <p className="text-xs text-green-600 mt-0.5">
                            Dernière connexion : {new Date(lot.last_login).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Lot {lot.type} — pas de copropriétaire</p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statut.color}`}>
                    {statut.icon} {statut.label}
                  </span>
                  {lot.user_id && !lot.last_login && (
                    <button
                      onClick={() => handleInviteWhatsApp(lot)}
                      disabled={isSending}
                      className="flex-shrink-0 flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isSending ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.856L0 24l6.336-1.525A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.892 0-3.667-.498-5.2-1.37l-.372-.217-3.862.93.97-3.767-.239-.384A9.946 9.946 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                        </svg>
                      )}
                      Inviter
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && data && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
          <p className="font-medium text-gray-500">Aucun résultat pour ce filtre</p>
        </div>
      )}
    </div>
  );
}
