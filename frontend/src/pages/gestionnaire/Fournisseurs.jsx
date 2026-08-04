import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/Modal';
import { fournisseurs as fournisseursApi } from '../../api/client';

const CATEGORIES = ['Ascenseur', 'Nettoyage', 'Jardinage', 'Électricité', 'Plomberie', 'Sécurité', 'Travaux', 'Assurance', 'Gardiennage', 'Divers'];
const TYPES_CONTRAT = ['Maintenance', 'Prestation', 'Travaux', 'Assurance', 'Service'];
const STATUTS_CONTRAT = ['Actif', 'Expiré', 'Résilié'];

const catColors = {
  Ascenseur: 'bg-blue-100 text-blue-700',
  Nettoyage: 'bg-green-100 text-green-700',
  Jardinage: 'bg-lime-100 text-lime-700',
  Électricité: 'bg-yellow-100 text-yellow-700',
  Plomberie: 'bg-cyan-100 text-cyan-700',
  Sécurité: 'bg-red-100 text-red-700',
  Travaux: 'bg-orange-100 text-orange-700',
  Assurance: 'bg-purple-100 text-purple-700',
  Gardiennage: 'bg-indigo-100 text-indigo-700',
  Divers: 'bg-gray-100 text-gray-600',
};

const statutColors = {
  Actif: 'bg-green-100 text-green-700',
  Expiré: 'bg-yellow-100 text-yellow-700',
  Résilié: 'bg-red-100 text-red-700',
};

const emptyFournisseur = { nom: '', categorie: 'Divers', contact_nom: '', contact_email: '', contact_tel: '', adresse: '', notes: '' };
const emptyContrat = { titre: '', type_contrat: 'Maintenance', montant_annuel: '', date_debut: '', date_fin: '', statut: 'Actif', notes: '' };

function Fournisseurs() {
  const { selectedCoproId } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [contrats, setContrats] = useState({});
  const [loadingContrats, setLoadingContrats] = useState({});

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyFournisseur);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [showContratForm, setShowContratForm] = useState(false);
  const [contratForm, setContratForm] = useState(emptyContrat);
  const [contratEditId, setContratEditId] = useState(null);
  const [contratFournisseurId, setContratFournisseurId] = useState(null);
  const [savingContrat, setSavingContrat] = useState(false);
  const [contratError, setContratError] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null);

  const load = () => {
    if (!selectedCoproId) { setLoading(false); return; }
    fournisseursApi.getAll(selectedCoproId)
      .then(setList)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); setExpanded(null); setContrats({}); load(); }, [selectedCoproId]);

  const toggleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!contrats[id]) {
      setLoadingContrats((p) => ({ ...p, [id]: true }));
      const data = await fournisseursApi.getContrats(id).catch(() => []);
      setContrats((p) => ({ ...p, [id]: data }));
      setLoadingContrats((p) => ({ ...p, [id]: false }));
    }
  };

  const openNew = () => { setForm(emptyFournisseur); setEditId(null); setShowForm(true); setError(null); };
  const openEdit = (f) => {
    setForm({ nom: f.nom, categorie: f.categorie, contact_nom: f.contact_nom || '', contact_email: f.contact_email || '', contact_tel: f.contact_tel || '', adresse: f.adresse || '', notes: f.notes || '' });
    setEditId(f.id);
    setShowForm(true);
    setError(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        const updated = await fournisseursApi.update(editId, form);
        setList((l) => l.map((x) => x.id === editId ? { ...updated, nb_contrats: x.nb_contrats } : x));
      } else {
        const created = await fournisseursApi.create({ ...form, copropriete_id: selectedCoproId });
        setList((l) => [...l, created]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!confirm('Supprimer ce fournisseur et tous ses contrats ?')) return;
    await fournisseursApi.delete(id).catch((err) => alert(err.message));
    setList((l) => l.filter((x) => x.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const openNewContrat = (fournisseurId) => {
    setContratForm(emptyContrat);
    setContratEditId(null);
    setContratFournisseurId(fournisseurId);
    setShowContratForm(true);
    setContratError(null);
  };

  const openEditContrat = (contrat) => {
    setContratForm({
      titre: contrat.titre,
      type_contrat: contrat.type_contrat,
      montant_annuel: contrat.montant_annuel || '',
      date_debut: contrat.date_debut || '',
      date_fin: contrat.date_fin || '',
      statut: contrat.statut,
      notes: contrat.notes || '',
    });
    setContratEditId(contrat.id);
    setContratFournisseurId(contrat.fournisseur_id);
    setShowContratForm(true);
    setContratError(null);
  };

  const saveContrat = async (e) => {
    e.preventDefault();
    setSavingContrat(true);
    setContratError(null);
    try {
      if (contratEditId) {
        const updated = await fournisseursApi.updateContrat(contratEditId, contratForm);
        setContrats((p) => ({ ...p, [contratFournisseurId]: p[contratFournisseurId].map((c) => c.id === contratEditId ? updated : c) }));
      } else {
        const created = await fournisseursApi.createContrat(contratFournisseurId, contratForm);
        setContrats((p) => ({ ...p, [contratFournisseurId]: [...(p[contratFournisseurId] || []), created] }));
        setList((l) => l.map((x) => x.id === contratFournisseurId ? { ...x, nb_contrats: (x.nb_contrats || 0) + 1 } : x));
      }
      setShowContratForm(false);
    } catch (err) {
      setContratError(err.message);
    } finally {
      setSavingContrat(false);
    }
  };

  const delContrat = async (contratId, fournisseurId) => {
    if (!confirm('Supprimer ce contrat ?')) return;
    await fournisseursApi.deleteContrat(contratId).catch((err) => alert(err.message));
    setContrats((p) => ({ ...p, [fournisseurId]: p[fournisseurId].filter((c) => c.id !== contratId) }));
    setList((l) => l.map((x) => x.id === fournisseurId ? { ...x, nb_contrats: Math.max(0, (x.nb_contrats || 1) - 1) } : x));
  };

  const handleDocUpload = async (contratId, fournisseurId, file) => {
    if (!file) return;
    setUploadingDoc(contratId);
    try {
      const result = await fournisseursApi.uploadDocument(contratId, file);
      setContrats((p) => ({
        ...p,
        [fournisseurId]: (p[fournisseurId] || []).map((c) =>
          c.id === contratId ? { ...c, document_url: result.document_url } : c
        ),
      }));
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleDocDelete = async (contratId, fournisseurId) => {
    if (!confirm('Supprimer le document PDF attaché ?')) return;
    try {
      await fournisseursApi.deleteDocument(contratId);
      setContrats((p) => ({
        ...p,
        [fournisseurId]: (p[fournisseurId] || []).map((c) =>
          c.id === contratId ? { ...c, document_url: null } : c
        ),
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  if (!selectedCoproId) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-700">Aucune résidence assignée.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Fournisseurs</h1>
          <p className="text-sm text-gray-500 mt-1">{list.length} fournisseur{list.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nouveau fournisseur
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="font-medium">Aucun fournisseur enregistré</p>
          <p className="text-sm mt-1">Ajoutez vos prestataires pour les rattacher aux dépenses</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div
                className="flex items-center gap-4 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(f.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800">{f.nom}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColors[f.categorie] || 'bg-gray-100 text-gray-600'}`}>{f.categorie}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-400 flex-wrap">
                    {f.contact_nom && <span>{f.contact_nom}</span>}
                    {f.contact_email && <span>{f.contact_email}</span>}
                    {f.contact_tel && <span>{f.contact_tel}</span>}
                    <span className="text-gray-300">{f.nb_contrats} contrat{f.nb_contrats !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(f); }}
                    className="text-blue-500 hover:text-blue-700 text-xs font-medium px-2 py-1 hover:bg-blue-50 rounded"
                  >Modifier</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); del(f.id); }}
                    className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-1 hover:bg-red-50 rounded"
                  >Supprimer</button>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ml-1 ${expanded === f.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {expanded === f.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                  {(f.adresse || f.notes) && (
                    <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {f.adresse && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-0.5">Adresse</p>
                          <p className="text-gray-700">{f.adresse}</p>
                        </div>
                      )}
                      {f.notes && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-0.5">Notes</p>
                          <p className="text-gray-600">{f.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Contrats</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); openNewContrat(f.id); }}
                      className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Nouveau contrat
                    </button>
                  </div>

                  {loadingContrats[f.id] ? (
                    <div className="flex justify-center py-4"><div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
                  ) : (contrats[f.id] || []).length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-3">Aucun contrat enregistré</p>
                  ) : (
                    <div className="space-y-2">
                      {(contrats[f.id] || []).map((c) => (
                        <div key={c.id} className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-800">{c.titre}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColors[c.statut] || 'bg-gray-100 text-gray-600'}`}>{c.statut}</span>
                              <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{c.type_contrat}</span>
                            </div>
                            <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-400 flex-wrap">
                              {c.montant_annuel && <span>{Number(c.montant_annuel).toLocaleString('fr-FR')} Dhs/an</span>}
                              {c.date_debut && <span>Du {c.date_debut}</span>}
                              {c.date_fin && <span>au {c.date_fin}</span>}
                              {c.notes && <span className="truncate max-w-[200px]">{c.notes}</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              {c.document_url ? (
                                <>
                                  <a
                                    href={c.document_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Voir le PDF
                                  </a>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDocDelete(c.id, f.id); }}
                                    className="text-xs text-red-400 hover:text-red-600"
                                  >
                                    Retirer
                                  </button>
                                </>
                              ) : (
                                <label
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 cursor-pointer"
                                >
                                  {uploadingDoc === c.id ? (
                                    <span className="flex items-center gap-1">
                                      <div className="animate-spin w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full" />
                                      Envoi...
                                    </span>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                      </svg>
                                      Joindre PDF
                                    </>
                                  )}
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={(e) => { if (e.target.files[0]) handleDocUpload(c.id, f.id, e.target.files[0]); e.target.value = ''; }}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); openEditContrat(c); }} className="text-blue-500 hover:text-blue-700 text-xs font-medium px-2 py-1 hover:bg-blue-50 rounded">Modifier</button>
                            <button onClick={(e) => { e.stopPropagation(); delContrat(c.id, f.id); }} className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-1 hover:bg-red-50 rounded">Supprimer</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal fournisseur */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}>
        <form onSubmit={save} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nom du fournisseur" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du contact</label>
              <input value={form.contact_nom} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jean Dupont" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input value={form.contact_tel} onChange={(e) => setForm({ ...form, contact_tel: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+212 6XX XXX XXX" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="contact@fournisseur.ma" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Adresse complète" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Remarques éventuelles..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal contrat */}
      <Modal isOpen={showContratForm} onClose={() => setShowContratForm(false)} title={contratEditId ? 'Modifier le contrat' : 'Nouveau contrat'}>
        <form onSubmit={saveContrat} className="space-y-4">
          {contratError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{contratError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input required value={contratForm.titre} onChange={(e) => setContratForm({ ...contratForm, titre: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Contrat de maintenance ascenseur" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={contratForm.type_contrat} onChange={(e) => setContratForm({ ...contratForm, type_contrat: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TYPES_CONTRAT.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select value={contratForm.statut} onChange={(e) => setContratForm({ ...contratForm, statut: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STATUTS_CONTRAT.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant annuel (Dhs)</label>
              <input type="number" step="0.01" value={contratForm.montant_annuel} onChange={(e) => setContratForm({ ...contratForm, montant_annuel: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="12 000" />
            </div>
            <div />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
              <input type="date" value={contratForm.date_debut} onChange={(e) => setContratForm({ ...contratForm, date_debut: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
              <input type="date" value={contratForm.date_fin} onChange={(e) => setContratForm({ ...contratForm, date_fin: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea rows={2} value={contratForm.notes} onChange={(e) => setContratForm({ ...contratForm, notes: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Conditions particulières, échéances de renouvellement..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowContratForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Annuler</button>
            <button type="submit" disabled={savingContrat} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {savingContrat ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Fournisseurs;
