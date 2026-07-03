import React, { useEffect, useState } from 'react';
import { messages as messagesApi } from '../../api/client';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

function PJItem({ pj }) {
  const isImage = pj.mimetype && pj.mimetype.startsWith('image/');
  const url = `${BASE_URL}${pj.url}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
    >
      {isImage ? (
        <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )}
      <span className="truncate max-w-[180px]">{pj.original_name}</span>
      <svg className="w-3 h-3 text-gray-400 flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

function MesMessages() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    messagesApi.getAll()
      .then(setList)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mes messages</h1>
        <p className="text-sm text-gray-500 mt-1">Communications de votre syndic</p>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-200">
          <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-400 text-sm">Aucun message de votre syndic pour l'instant</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((m) => (
            <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                  {(m.gestionnaire_prenom?.[0] || '') + (m.gestionnaire_nom?.[0] || '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-800 leading-snug">{m.titre}</h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {m.gestionnaire_prenom} {m.gestionnaire_nom} · {fmtDate(m.created_at)}
                  </p>
                  <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap leading-relaxed">{m.contenu}</p>

                  {m.pieces_jointes && m.pieces_jointes.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-500 mb-2">Pièces jointes ({m.pieces_jointes.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {m.pieces_jointes.map((pj) => <PJItem key={pj.id} pj={pj} />)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MesMessages;
