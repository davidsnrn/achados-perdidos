import React, { useState, useMemo } from 'react';
import { LostReport, ReportStatus, Person, PersonType, User, UserLevel, FoundItem, ItemStatus } from '../../types';
import { StorageService } from '../../services/storage';
import { Search, Send, Clock, CheckCircle, User as UserIcon, Trash2, AlertTriangle, RotateCcw, Loader2, Link as LinkIcon, Package, X, CornerUpRight, FileText, Plus } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
  reports: LostReport[];
  people: Person[];
  items: FoundItem[];
  onUpdate: () => void;
  user: User;
}

export const LostReportsTab: React.FC<Props> = ({ reports, people, items, onUpdate, user }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [viewingReport, setViewingReport] = useState<LostReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Linking State
  const [showItemLinkSelector, setShowItemLinkSelector] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [linkedItem, setLinkedItem] = useState<FoundItem | null>(null);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form states
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [showForm, setShowForm] = useState(false);

  const userString = `${user.name} (${user.matricula})`;

  const normalizeText = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const filteredPeople = useMemo(() => {
    if (!personSearch.trim()) return [];

    const searchTerms = normalizeText(personSearch).split(/\s+/).filter(t => t.length > 0);

    return people.filter(p => {
      const personText = normalizeText(`${p.name} ${p.matricula}`);
      return searchTerms.every(term => personText.includes(term));
    }).slice(0, 5);
  }, [people, personSearch]);

  const availableItems = useMemo(() => {
    const available = items.filter(i => i.status === ItemStatus.AVAILABLE);
    if (!itemSearchTerm.trim()) return available.slice(0, 5);

    const terms = normalizeText(itemSearchTerm).split(/\s+/);
    return available.filter(i => {
      const text = normalizeText(`${i.id} ${i.description} ${i.locationFound}`);
      return terms.every(t => text.includes(t));
    }).slice(0, 5);
  }, [items, itemSearchTerm]);

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) {
      alert('Selecione uma pessoa cadastrada.');
      return;
    }

    setIsLoading(true);
    const cleanPhone = newWhatsapp.replace(/\D/g, '');

    const newReport: LostReport = {
      id: Math.random().toString(36).substr(2, 9),
      itemDescription: newItemDesc,
      personId: selectedPerson.id,
      personName: selectedPerson.name,
      whatsapp: cleanPhone,
      email: newEmail,
      status: ReportStatus.OPEN,
      createdAt: new Date().toISOString(),
      history: [{ date: new Date().toISOString(), note: 'Relato de perda criado.', user: userString }]
    };

    try {
      await StorageService.saveReport(newReport);
      onUpdate();

      setNewItemDesc('');
      setNewWhatsapp('');
      setNewEmail('');
      setPersonSearch('');
      setSelectedPerson(null);
      setShowForm(false);
      alert('Relato registrado com sucesso!');
    } catch (e) {
      alert("Erro ao registrar relato.");
    } finally {
      setIsLoading(false);
    }
  };

  const addNote = async (note: string) => {
    if (!viewingReport || !note.trim()) return;
    const updated = {
      ...viewingReport,
      history: [...viewingReport.history, { date: new Date().toISOString(), note, user: userString }]
    };
    await StorageService.saveReport(updated);
    setViewingReport(updated);
    onUpdate();
  };

  const changeStatus = async (status: ReportStatus) => {
    if (!viewingReport) return;
    const updated = {
      ...viewingReport,
      status,
      history: [...viewingReport.history, { date: new Date().toISOString(), note: `Status alterado para: ${status}`, user: userString }]
    };
    await StorageService.saveReport(updated);
    setViewingReport(updated);
    onUpdate();
  };

  const handleLinkItemAndResolve = async () => {
    if (!viewingReport || !linkedItem) return;
    setIsLoading(true);

    try {
      // 1. Atualizar o Item
      const updatedItem: FoundItem = {
        ...linkedItem,
        status: ItemStatus.RETURNED,
        returnedTo: viewingReport.personName,
        returnedDate: new Date().toISOString()
      };
      await StorageService.saveItem(updatedItem, `Item devolvido via Relato de Perda (Relato ID: ${viewingReport.id}) para ${viewingReport.personName}.`, userString);

      // 2. Atualizar o Relato
      const updatedReport: LostReport = {
        ...viewingReport,
        status: ReportStatus.RESOLVED,
        history: [
          ...viewingReport.history,
          {
            date: new Date().toISOString(),
            note: `Item vinculado e devolvido (Item ID: #${linkedItem.id} - ${linkedItem.description}). Relato resolvido.`,
            user: userString
          }
        ]
      };
      await StorageService.saveReport(updatedReport);

      alert(`Sucesso! Item #${linkedItem.id} devolvido e relato encerrado.`);
      setViewingReport(null);
      setLinkedItem(null);
      setShowItemLinkSelector(false);
      onUpdate();
    } catch (error) {
      alert("Erro ao processar devolução vinculada.");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!viewingReport) return;
    await StorageService.deleteReport(viewingReport.id);
    setShowDeleteConfirm(false);
    setViewingReport(null);
    onUpdate();
  };

  const closeModals = () => {
    setViewingReport(null);
    setShowItemLinkSelector(false);
    setLinkedItem(null);
  };

  return (
    <div className="space-y-6">
      {/* Header with Search and Add Button */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <input
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-ifrn-green transition-all"
            placeholder="Pesquisar por item ou nome da pessoa..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="w-full sm:w-auto px-6 py-2 bg-ifrn-green text-white font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={20} /> Adicionar Relato
        </button>
      </div>

      {/* Main List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
              <tr>
                <th className="p-4 whitespace-nowrap">Data</th>
                <th className="p-4 whitespace-nowrap">Item</th>
                <th className="p-4 whitespace-nowrap">Quem</th>
                <th className="p-4 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports
                .filter(r => r.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) || r.personName.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(report => (
                  <tr
                    key={report.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setViewingReport(report)}
                  >
                    <td className="p-4 text-gray-500 whitespace-nowrap">{new Date(report.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 font-bold text-gray-800 whitespace-nowrap">{report.itemDescription}</td>
                    <td className="p-4 text-gray-600 whitespace-nowrap">{report.personName}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${report.status === ReportStatus.OPEN ? 'bg-yellow-100 text-yellow-800' :
                          report.status === ReportStatus.FOUND ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800 border border-green-200 shadow-sm'
                        }`}>
                        {report.status === ReportStatus.RESOLVED && <CheckCircle size={12} />}
                        {report.status}
                      </span>
                    </td>
                  </tr>
                ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-gray-400 italic">Nenhum relato encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Novo Relato de Perda">
        <form onSubmit={handleCreateReport} className="space-y-6">
          {/* Person Autocomplete */}
          <div className="relative space-y-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Quem Perdeu?</label>

            {selectedPerson ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4 animate-fadeIn">
                <div className="bg-green-100 p-2.5 rounded-full text-green-700">
                  <UserIcon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-green-900 truncate">{selectedPerson.name}</p>
                  <p className="text-xs text-green-700 truncate">{selectedPerson.matricula} • {selectedPerson.type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPerson(null)}
                  className="text-xs text-red-500 hover:text-red-700 font-bold uppercase underline"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  className="w-full border-2 border-gray-100 rounded-xl p-3 pl-10 text-sm outline-none focus:border-ifrn-green transition-all"
                  placeholder="Busque por Nome ou Matrícula..."
                  value={personSearch}
                  onChange={e => setPersonSearch(e.target.value)}
                />
                <Search className="absolute left-3 top-3.5 text-gray-300" size={18} />

                {filteredPeople.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-gray-50">
                    {filteredPeople.map(p => (
                      <div key={p.id} onClick={() => { setSelectedPerson(p); setPersonSearch(''); }} className="p-4 hover:bg-green-50 cursor-pointer text-sm group transition-colors">
                        <div className="font-bold text-gray-800 group-hover:text-ifrn-green">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.matricula} • {p.type}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">O que foi perdido?</label>
            <textarea
              required
              className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-ifrn-green transition-all"
              rows={3}
              placeholder="Descreva o objeto da forma mais detalhada possível..."
              value={newItemDesc}
              onChange={e => setNewItemDesc(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">WhatsApp de Contato</label>
              <input
                type="text"
                required
                className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-ifrn-green transition-all"
                placeholder="(99) 99999-9999"
                value={newWhatsapp}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "");
                  if (v.length > 11) v = v.slice(0, 11);
                  if (v.length > 10) v = v.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
                  else if (v.length > 5) v = v.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
                  else if (v.length > 2) v = v.replace(/^(\d\d)(\d{0,5})/, "($1) $2");
                  else if (v.length > 0) v = v.replace(/^(\d*)/, "($1");
                  setNewWhatsapp(v);
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">E-mail (Opcional)</label>
              <input
                type="email"
                className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-ifrn-green transition-all"
                placeholder="exemplo@ifrn.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors uppercase text-xs tracking-widest">Cancelar</button>
            <button type="submit" disabled={isLoading} className="flex-[2] py-3 bg-ifrn-red text-white font-bold rounded-xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest">
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><Send size={16} /> Registrar Relato</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!viewingReport && !showDeleteConfirm} onClose={() => setViewingReport(null)} title="Detalhes do Relato">
        {viewingReport && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <span className="block text-gray-500 text-xs uppercase font-bold tracking-wider">Item Relatado</span>
                <span className="font-bold text-xl text-gray-900 leading-tight">{viewingReport.itemDescription}</span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase font-bold tracking-wider">Status Atual</span>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1 shadow-sm ${viewingReport.status === ReportStatus.OPEN ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                  }`}>{viewingReport.status}</span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase font-bold tracking-wider">Contato</span>
                <div className="flex flex-col gap-1 mt-1">
                  <a href={`https://wa.me/55${viewingReport.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline flex items-center gap-1 font-bold">
                    WhatsApp ({viewingReport.whatsapp})
                  </a>
                  {viewingReport.email && <span className="text-gray-400 text-xs">{viewingReport.email}</span>}
                </div>
              </div>
            </div>

            {/* NEW SECTION: Linked Item / Search Item */}
            {viewingReport.status === ReportStatus.OPEN && (
              <div className="border-t pt-4">
                <h4 className="font-bold text-gray-700 mb-3 text-sm flex items-center gap-2">
                  <LinkIcon size={16} /> Item Encontrado no Inventário?
                </h4>

                {!linkedItem ? (
                  !showItemLinkSelector ? (
                    <button
                      onClick={() => setShowItemLinkSelector(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-medium text-sm"
                    >
                      <Package size={18} /> Vincular a um Item do Estoque
                    </button>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl space-y-3 animate-fadeIn">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-blue-700 uppercase">Buscar no Inventário</label>
                        <button onClick={() => setShowItemLinkSelector(false)} className="text-gray-400 hover:text-red-500"><X size={16} /></button>
                      </div>
                      <div className="relative">
                        <input
                          autoFocus
                          type="text"
                          className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="Buscar por ID ou Descrição..."
                          value={itemSearchTerm}
                          onChange={e => setItemSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-blue-300" size={16} />
                      </div>
                      <div className="space-y-2">
                        {availableItems.length === 0 ? (
                          <p className="text-xs text-blue-400 italic text-center py-2">Nenhum item disponível encontrado.</p>
                        ) : (
                          availableItems.map(item => (
                            <div
                              key={item.id}
                              onClick={() => setLinkedItem(item)}
                              className="bg-white p-3 border rounded-lg hover:border-blue-500 cursor-pointer flex items-center justify-between group transition-all"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-mono font-bold text-blue-600">#{item.id}</p>
                                <p className="text-sm font-bold text-gray-800 truncate">{item.description}</p>
                                <p className="text-[10px] text-gray-500">{item.locationFound} • {new Date(item.dateFound).toLocaleDateString()}</p>
                              </div>
                              <LinkIcon size={16} className="text-gray-200 group-hover:text-blue-500" />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-700">ITEM SELECIONADO</p>
                        <p className="font-bold text-gray-900">#{linkedItem.id} - {linkedItem.description}</p>
                      </div>
                    </div>
                    <button onClick={() => setLinkedItem(null)} className="text-xs text-emerald-600 hover:text-red-500 font-bold uppercase underline">Alterar</button>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-700 mb-2 text-sm flex items-center gap-2">
                <FileText size={16} className="text-gray-400" /> Histórico / Log
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                {viewingReport.history.map((h, i) => (
                  <div key={i} className="text-xs border-l-2 border-gray-300 pl-2 py-1">
                    <span className="text-gray-500 font-medium">{new Date(h.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}:</span> <span className="text-gray-800">{h.note}</span>
                    {h.user && <span className="block text-[10px] text-gray-400 mt-0.5 font-mono">Por: {h.user}</span>}
                  </div>
                ))}
              </div>

              {/* ÁREA DE COMENTÁRIOS - DESABILITADA SE RESOLVIDO */}
              {viewingReport.status !== ReportStatus.RESOLVED ? (
                <div className="mt-4 flex gap-2 animate-fadeIn">
                  <input
                    id="newNote"
                    className="flex-1 text-sm border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-gray-300"
                    placeholder="Adicionar observação..."
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const el = e.currentTarget;
                        addNote(el.value);
                        el.value = '';
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const el = document.getElementById('newNote') as HTMLInputElement;
                      addNote(el.value);
                      el.value = '';
                    }}
                    className="bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition-colors"
                  >Add</button>
                </div>
              ) : (
                <div className="mt-4 p-2 bg-gray-100 text-gray-500 text-xs italic rounded text-center border border-dashed border-gray-300">
                  Relato encerrado. Novas observações não são permitidas.
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              {(user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED) ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                >
                  <Trash2 size={16} /> Excluir
                </button>
              ) : (
                <div></div>
              )}

              <div className="flex gap-2">
                <button onClick={closeModals} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Fechar</button>

                {linkedItem ? (
                  <button
                    onClick={handleLinkItemAndResolve}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-bold shadow-lg shadow-emerald-200 transition-all scale-105"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={16} /> : <><CornerUpRight size={18} /> Confirmar Devolução e Resolver</>}
                  </button>
                ) : (
                  viewingReport.status !== ReportStatus.RESOLVED && (
                    <button onClick={() => changeStatus(ReportStatus.RESOLVED)} className="flex items-center gap-2 px-4 py-2 bg-ifrn-green text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"><CheckCircle size={16} /> Marcar Resolvido</button>
                  )
                )}

                {viewingReport.status === ReportStatus.RESOLVED && (user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED) && (
                  <button onClick={() => changeStatus(ReportStatus.OPEN)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium"><RotateCcw size={16} /> Reabrir</button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Delete Modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirmar Exclusão">
        <div className="space-y-4">
          <div className="bg-red-50 text-red-800 p-4 rounded-lg flex items-start gap-3 border border-red-200">
            <AlertTriangle className="flex-shrink-0" size={20} />
            <div className="text-sm">
              <p className="font-bold">Atenção!</p>
              <p className="mt-1">Você tem certeza que deseja excluir permanentemente o relato de perda do item: <strong>{viewingReport?.itemDescription}</strong>?</p>
              <p className="mt-2 text-xs">Esta ação não poderá ser desfeita.</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancelar</button>
            <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold flex items-center gap-2"><Trash2 size={16} /> Sim, Excluir</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};