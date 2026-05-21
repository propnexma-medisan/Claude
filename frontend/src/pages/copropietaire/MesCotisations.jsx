import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { finances } from '../../api/client';

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

const paiementColors = {
  'Payé': 'bg-green-100 text-green-700',
  'Non payé': 'bg-red-100 text-red-700',
  'Partiel': 'bg-yellow-100 text-yellow-700',
};

function MesCotisations() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.copropriete_id) { setLoading(false); return; }
    finances.getByResidence(user.copropriete_id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>;
  }

  if (!user?.copropriete_id) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">Aucune résidence assignée.</div>;
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>;
  }

  // Find cotisations for my lot
  const myCotisation = data?.cotisations_par_lot?.find((c) => c.lot_id === user.lot_id);
  const totalDu = myCotisation?.montant_total || 0;
  const totalPaye = myCotisation?.montant_paye || 0;
  const soldeRestant = totalDu - totalPaye;

  // Get charges with repartitions for my lot
  const myCharges = data?.depenses || [];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mes cotisations</h1>
        <p className="text-sm text-gray-500 mt-1">{data?.copropriete?.nom}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">Total dû</p>
          <p className="mt-1 text-xl font-bold text-gray-800">{fmt(totalDu)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">Total payé</p>
          <p className="mt-1 text-xl font-bold text-green-600">{fmt(totalPaye)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <p className="text-xs text-gray-500 font-medium">Solde restant</p>
          <p className={`mt-1 text-xl font-bold ${soldeRestant > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(soldeRestant)}</p>
        </div>
      </div>

      {/* Charges list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Détail des charges de la résidence</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Libellé', 'Montant total', 'Échéance', 'Statut'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {myCharges.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Aucune charge</td></tr>
            )}
            {myCharges.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{c.libelle}</td>
                <td className="px-4 py-3 text-gray-700">{fmt(c.montant_total)}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(c.date_echeance)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.statut === 'Soldé' ? 'bg-green-100 text-green-700' :
                    c.statut === 'En retard' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{c.statut}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* My lot cotisation detail */}
      {myCotisation && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Ma situation (Lot {myCotisation.lot_numero})</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Montant total dû</span>
              <span className="font-medium text-gray-800">{fmt(myCotisation.montant_total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Montant payé</span>
              <span className="font-medium text-green-600">{fmt(myCotisation.montant_paye)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Montant impayé</span>
              <span className="font-medium text-red-600">{fmt(myCotisation.montant_impaye + myCotisation.montant_partiel)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
              <span className="font-medium text-gray-700">Solde restant</span>
              <span className={`font-bold text-lg ${soldeRestant > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(soldeRestant)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MesCotisations;
