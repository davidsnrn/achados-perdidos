import React, { useState } from 'react';
import { LostReport, ReportStatus, Person, PersonType } from '../../types';
import { StorageService } from '../../services/storage';
import { Search, Send, Clock, CheckCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
  reports: LostReport[];
  people: Person[];
  onUpdate: () => void;
}

export const LostReportsTab: React.FC<Props> = ({ reports, people, onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [viewingReport, setViewingReport] = useState<LostReport | null>(null);

  // Form states
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const filteredPeople = personSearch.length > 1 
    ? people.filter(p => p.name.toLowerCase().includes(personSearch.toLowerCase()) || p.matricula.includes(personSearch))
    : [];

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) {
      alert('Selecione uma pessoa cadastrada.');
      return;
    }

    const newReport: LostReport = {
      id: Math.random().toString(36).substr(2, 9),
      itemDescription: newItemDesc,
      personId: selectedPerson.id,
      personName: selectedPerson.name,
      whatsapp: newWhatsapp,
      email: newEmail,
      status: ReportStatus.OPEN,
      createdAt: new Date().toISOString(),
      history: [{ date: new Date().toISOString(), note: 'Relato de perda criado.' }]
    };

    StorageService.saveReport(newReport);
    onUpdate();
    
    // Critical: Clean form
    setNewItemDesc('');
    setNewWhatsapp('');
    setNewEmail('');
    setPersonSearch('');
    setSelectedPerson(null);
    alert('Relato registrado com sucesso!');
  };

  const addNote = (note: string) => {
    if (!viewingReport || !note.trim()) return;
    const updated = {
      ...viewingReport,
      history: [...viewingReport.history, { date: new Date().toISOString(), note }]
    };
    StorageService.saveReport(updated);
    setViewingReport(updated);
    onUpdate();
  };

  const changeStatus = (status: ReportStatus) => {
    if (!viewingReport) return;
    const updated = {
      ...viewingReport,
      status,
      history: [...viewingReport.history, { date: new Date().toISOString(), note: `Status alterado para: ${status}` }]
    };
    StorageService.saveReport(updated);
    setViewingReport(updated);
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
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Quem Perdeu?</label>
              {selectedPerson ? (
                <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-sm font-medium text-emerald-800">{selectedPerson.name}</span>
                  <button 
                    type="button" 
                    onClick={() => setSelectedPerson(null)}
                    className="text-xs text-red-500 hover:underline"
                  >Alterar</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-ifrn-green"
                    placeholder="Busque por Nome ou Matrícula..."
                    value={personSearch}
                    onChange={e => setPersonSearch(e.target.value)}
                  />
                  {filteredPeople.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredPeople.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => { setSelectedPerson(p); setPersonSearch(''); }}
                          className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                        >
                          <div className="font-bold">{p.name}</div>
                          <div className="text-xs text-gray-500">{p.matricula} • {p.type}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
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
                  className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-ifrn-green"
                  placeholder="(84) 9..."
                  value={newWhatsapp}
                  onChange={e => setNewWhatsapp(e.target.value)}
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

            <button type="submit" className="w-full py-2.5 bg-ifrn-red text-white font-bold rounded-lg shadow-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
              <Send size={18} /> Registrar
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT: List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-700">Relatos Recentes</h3>
            <div className="relative">
              <input 
                className="pl-8 pr-4 py-1.5 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-ifrn-green" 
                placeholder="Filtrar..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-2.5 top-2 text-gray-400" size={14} />
            </div>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Item</th>
                <th className="p-3">Quem</th>
                <th className="p-3">Status</th>
                <th className="p-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports
                .filter(r => r.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) || r.personName.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(report => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="p-3 text-gray-500">{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 font-medium text-gray-800">{report.itemDescription}</td>
                  <td className="p-3 text-gray-600">{report.personName}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      report.status === ReportStatus.OPEN ? 'bg-yellow-100 text-yellow-800' :
                      report.status === ReportStatus.FOUND ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <button onClick={() => setViewingReport(report)} className="text-ifrn-green hover:underline font-medium">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!viewingReport} onClose={() => setViewingReport(null)} title="Detalhes do Relato">
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
                   <a href={`https://wa.me/55${viewingReport.whatsapp}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline flex items-center gap-1">
                     WhatsApp
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

            <div className="flex justify-end gap-3 pt-4 border-t">
              {viewingReport.status !== ReportStatus.RESOLVED && (
                <button 
                  onClick={() => changeStatus(ReportStatus.RESOLVED)}
                  className="flex items-center gap-2 px-4 py-2 bg-ifrn-green text-white rounded-lg hover:bg-emerald-700"
                >
                  <CheckCircle size={16} /> Marcar como Resolvido
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};