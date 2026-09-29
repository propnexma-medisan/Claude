import React, { useEffect, useState } from 'react';
import { agence as agenceApi } from '../../api/client';

const STATUTS = ['Nouveau', 'Contacté', 'Qualifié', 'Perdu', 'Converti'];

const STATUT_COLORS = {
  'Nouveau': 'bg-blue-100 text-blue-700',
  'Contacté': 'bg-amber-100 text-amber-700',
  'Qualifié': 'bg-purple-100 text-purple-700',
  'Perdu': 'bg-gray-100 text-gray-500',
  'Converti': 'bg-green-100 text-green-700',
};

function fmtDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMAD(n) {
  return n ? Number(n).toLocaleString('fr-FR') + ' MAD' : '—';
}

export default function LeadsAgence() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Tous');
  const [selected, setSelected] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    agenceApi.getAll().then(setList).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'Tous' ? list : list.filter((d) => d.statut === filter);

  const openDemande = (d) => {
    setSelected(d);
    setNotesDraft(d.notes || '');
  };

  const updateStatut = async (statut) => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await agenceApi.update(selected.id, { statut, notes: notesDraft });
      setSelected(updated);
      setList((l) => l.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await agenceApi.update(selected.id, { statut: selected.statut, notes: notesDraft });
      setSelected(updated);
      setList((l) => l.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-5 h-full">
      <div className="flex-1 min-w-0 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Demandes Agence</h1>
          <p className="text-sm text-gray-500 mt-0.5">Copropriétaires souhaitant vendre ou louer leur bien</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['Tous', ...STATUTS].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === s ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s} {s !== 'Tous' && `(${list.filter((d) => d.statut === s).length})`}
              {s === 'Tous' && `(${list.length})`}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
            Aucune demande pour ce filtre
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Copropriétaire</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Résidence / Lot</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Type</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Prix</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Statut</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Reçu le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((d) => (
                    <tr key={d.id} onClick={() => openDemande(d)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{d.user_prenom} {d.user_nom}</div>
                        <div className="text-xs text-gray-400">{d.user_telephone || d.user_email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {d.copropriete_nom}{d.lot_numero ? ` · Lot ${d.lot_numero}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${d.type_demande === 'Vendre' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                          {d.type_demande}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtMAD(d.prix_estime)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_COLORS[d.statut]}`}>{d.statut}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="w-96 flex-shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm p-5 h-fit sticky top-4 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900">{selected.user_prenom} {selected.user_nom}</p>
              <p className="text-xs text-gray-400">{selected.copropriete_nom}{selected.lot_numero ? ` · Lot ${selected.lot_numero}` : ''}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="space-y-2 text-sm">
            {selected.user_telephone && (
              <a href={`tel:${selected.user_telephone}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                {selected.user_telephone}
              </a>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              {selected.user_email}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">{selected.type_demande}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Délai</span><span className="font-medium">{selected.delai || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Prix envisagé</span><span className="font-medium">{fmtMAD(selected.prix_estime)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Canal préféré</span><span className="font-medium">{selected.canal_prefere || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Reçu le</span><span className="font-medium">{fmtDate(selected.created_at)}</span></div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Statut</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUTS.map((s) => (
                <button
                  key={s} disabled={saving} onClick={() => updateStatut(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                    selected.statut === s ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Note du copropriétaire / interne</p>
            <textarea
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)}
            />
            <button
              onClick={saveNotes} disabled={saving}
              className="mt-2 w-full bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Enregistrer la note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
