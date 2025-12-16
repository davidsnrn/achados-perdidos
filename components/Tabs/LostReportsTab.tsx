import React, { useState, useMemo } from 'react';
import { LostReport, ReportStatus, Person, PersonType, User, UserLevel } from '../../types';
import { StorageService } from '../../services/storage';
import { Search, Send, Clock, CheckCircle, User as UserIcon, Trash2, AlertTriangle, RotateCcw, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
  reports: LostReport[];
  people: Person[];
  onUpdate: () => void;
  user: User;
}

export const LostReportsTab: React.FC<Props> = ({ reports, people, onUpdate, user }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [viewingReport, setViewingReport] = useState<LostReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form states
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newEmail, setNewEmail] = useState('');

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

  const confirmDelete = async () => {
    if (!viewingReport) return;
    await StorageService.deleteReport(viewingReport.id);
    setShowDeleteConfirm(false);
    setViewingReport(null);
    onUpdate();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT: Registration Form */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-ifrn-darkGreen mb-4 flex items-center gap-2">
            <Clock size={20} /> Registrar Perda
          </h3>
          <form onSubmit={handleCreateReport} className="space-y-4">
            
            {/* Person Autocomplete */}
            <div className="relative space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Quem Perdeu?</label>
              
              {selectedPerson ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3 animate-fadeIn">
                  <div className="bg-green-100 p-2 rounded-full text-green-700">
                    <UserIcon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-green-900 text-sm truncate">{selectedPerson.name}</p>
                    <p className="text-xs text-green-700 truncate">{selectedPerson.matricula} • {selectedPerson.type}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedPerson(null)}
                    className="text-xs text-red-500 hover:underline hover:text-red-700 font-medium whitespace-nowrap"
                  >
                    Alterar
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2.5 pl-10 text-sm outline-none focus:ring-2 focus:ring-ifrn-green"
                    placeholder="Busque por Nome ou Matrícula..."
                    value={personSearch}
                    onChange={e => setPersonSearch(e.target.value)}
                  />
                  <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                  
                  {filteredPeople.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                      {filteredPeople.map(p => (
                        <div key={p.id} onClick={() => { setSelectedPerson(p); setPersonSearch(''); }} className="p-3 hover:bg-gray-50 cursor-pointer text-sm group">
                          <div className="font-bold text-gray-800 group-hover:text-ifrn-green">{p.name}</div>
                          <div className="text-xs text-gray-500">{p.matricula} • {p.type}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {personSearch.length > 1 && filteredPeople.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-sm p-3 text-center">
                       <p className="text-xs text-gray-400 italic">Nenhuma pessoa encontrada.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">O que foi perdido?</label>
              <textarea 
                required
                className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-ifrn-green"
                rows={3}
                placeholder="Descrição detalhada do item..."
                value={newItemDesc}
                onChange={e => setNewItemDesc(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">WhatsApp</label>
                <input 
                  type="text"
                  required
                  maxLength={15}
                  className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-ifrn-green"
                  placeholder="(99) 99999-9999"
                  value={newWhatsapp}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, "");
                    if (value.length > 11) value = value.slice(0, 11);
                    
                    if (value.length > 10) {
                      value = value.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
                    } else if (value.length > 5) {
                      value = value.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
                    } else if (value.length > 2) {
                      value = value.replace(/^(\d\d)(\d{0,5})/, "($1) $2");
                    } else if (value.length > 0) {
                      value = value.replace(/^(\d*)/, "($1");
                    }
                    setNewWhatsapp(value);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">E-mail (Opcional)</label>
                <input 
                  type="email"
                  className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-ifrn-green"
                  placeholder="email@..."
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full py-2.5 bg-ifrn-red text-white font-bold rounded-lg shadow-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Registrar</>}
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT: List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <h3 className="font-bold text-gray-700">Relatos Recentes</h3>
            <div className="relative w-full sm:w-auto">
              <input 
                className="w-full sm:w-auto pl-8 pr-4 py-1.5 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ifrn-green" 
                placeholder="Filtrar..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-2.5 top-2 text-gray-400" size={14} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
                <tr>
                  <th className="p-3 whitespace-nowrap">Data</th>
                  <th className="p-3 whitespace-nowrap">Item</th>
                  <th className="p-3 whitespace-nowrap">Quem</th>
                  <th className="p-3 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports
                  .filter(r => r.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) || r.personName.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(report => (
                  <tr 
                    key={report.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setViewingReport(report)}
                  >
                    <td className="p-3 text-gray-500 whitespace-nowrap">{new Date(report.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 font-medium text-gray-800 whitespace-nowrap">{report.itemDescription}</td>
                    <td className="p-3 text-gray-600 whitespace-nowrap">{report.personName}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                        report.status === ReportStatus.OPEN ? 'bg-yellow-100 text-yellow-800' :
                        report.status === ReportStatus.FOUND ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800 border border-green-200 shadow-sm'
                      }`}>
                        {report.status === ReportStatus.RESOLVED && <CheckCircle size={12} />}
                        {report.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!viewingReport && !showDeleteConfirm} onClose={() => setViewingReport(null)} title="Detalhes do Relato">
        {viewingReport && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-gray-500 text-xs uppercase">Item</span>
                <span className="font-medium text-lg text-gray-900">{viewingReport.itemDescription}</span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase">Status Atual</span>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mt-1 ${
                   viewingReport.status === ReportStatus.OPEN ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                }`}>{viewingReport.status}</span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase">Contato</span>
                <div className="flex gap-2 mt-1">
                   <a href={`https://wa.me/55${viewingReport.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline flex items-center gap-1">
                     WhatsApp ({viewingReport.whatsapp})
                   </a>
                   {viewingReport.email && <span className="text-gray-400">| {viewingReport.email}</span>}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-700 mb-2 text-sm">Histórico / Log</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {viewingReport.history.map((h, i) => (
                  <div key={i} className="text-xs border-l-2 border-gray-300 pl-2">
                    <span className="text-gray-500">{new Date(h.date).toLocaleString()}:</span> <span className="text-gray-800">{h.note}</span>
                    {h.user && <span className="block text-[10px] text-gray-400">Por: {h.user}</span>}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                 <input id="newNote" className="flex-1 text-sm border rounded px-2 py-1" placeholder="Adicionar observação..." />
                 <button 
                  onClick={() => {
                    const el = document.getElementById('newNote') as HTMLInputElement;
                    addNote(el.value);
                    el.value = '';
                  }}
                  className="bg-gray-200 px-3 py-1 rounded text-xs font-bold hover:bg-gray-300"
                >Add</button>
              </div>
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
                <button onClick={() => setViewingReport(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Fechar</button>
                {viewingReport.status !== ReportStatus.RESOLVED && (
                  <button onClick={() => changeStatus(ReportStatus.RESOLVED)} className="flex items-center gap-2 px-4 py-2 bg-ifrn-green text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"><CheckCircle size={16} /> Marcar Resolvido</button>
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