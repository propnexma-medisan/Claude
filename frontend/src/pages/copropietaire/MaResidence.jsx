import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { coproprietes as coproApi, users, lots as lotsApi } from '../../api/client';

function MaResidence() {
  const { user } = useAuth();
  const [copropriete, setCopropriete] = useState(null);
  const [lot, setLot] = useState(null);
  const [gestionnaire, setGestionnaire] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.copropriete_id) { setLoading(false); return; }

    const tasks = [coproApi.getById(user.copropriete_id)];
    if (user.lot_id) tasks.push(coproApi.getLots(user.copropriete_id));

    Promise.all(tasks)
      .then(([copro, lots]) => {
        setCopropriete(copro);
        if (lots && user.lot_id) {
          const myLot = lots.find((l) => l.id === user.lot_id);
          setLot(myLot || null);
        }
        // Try to find gestionnaire
        return users.byResidence(user.copropriete_id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>;
  }

  if (!user?.copropriete_id) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">Vous n'êtes associé à aucune résidence.</div>;
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Ma résidence</h1>
        <p className="text-sm text-gray-500 mt-1">Informations sur votre résidence</p>
      </div>

      {/* Résidence info */}
      {copropriete && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-800">Résidence</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Nom</p>
              <p className="font-medium text-gray-800 mt-0.5">{copropriete.nom}</p>
            </div>
            <div>
              <p className="text-gray-500">Adresse</p>
              <p className="font-medium text-gray-800 mt-0.5">{copropriete.adresse}</p>
            </div>
            <div>
              <p className="text-gray-500">Nombre de lots</p>
              <p className="font-medium text-gray-800 mt-0.5">{copropriete.nb_lots}</p>
            </div>
            <div>
              <p className="text-gray-500">Syndic</p>
              <p className="font-medium text-gray-800 mt-0.5">{copropriete.syndic_nom || '—'}</p>
            </div>
            {copropriete.date_creation && (
              <div>
                <p className="text-gray-500">Date de création</p>
                <p className="font-medium text-gray-800 mt-0.5">{new Date(copropriete.date_creation).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
            {copropriete.notes && (
              <div className="col-span-2">
                <p className="text-gray-500">Notes</p>
                <p className="text-gray-600 mt-0.5 italic">{copropriete.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mon lot */}
      {lot ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-800">Mon lot</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Numéro</p>
              <p className="font-medium text-gray-800 mt-0.5">{lot.numero}</p>
            </div>
            <div>
              <p className="text-gray-500">Type</p>
              <p className="font-medium text-gray-800 mt-0.5">{lot.type}</p>
            </div>
            {lot.surface && (
              <div>
                <p className="text-gray-500">Surface</p>
                <p className="font-medium text-gray-800 mt-0.5">{lot.surface} m²</p>
              </div>
            )}
            {lot.tantiemes !== undefined && (
              <div>
                <p className="text-gray-500">Tantièmes</p>
                <p className="font-medium text-gray-800 mt-0.5">{lot.tantiemes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
          Aucun lot associé à votre compte
        </div>
      )}
    </div>
  );
}

export default MaResidence;
