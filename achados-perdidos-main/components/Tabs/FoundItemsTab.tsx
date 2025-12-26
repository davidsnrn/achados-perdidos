import React, { useState, useMemo } from 'react';
import { FoundItem, ItemStatus, Person, LostReport, ReportStatus, User, UserLevel } from '../../types';
import { StorageService } from '../../services/storage';
import { Plus, Search, Trash2, Gift, Calendar, Pencil, Info, History, CornerUpRight, ChevronUp, ChevronDown, RotateCcw, User as UserIcon, FileText, CheckCircle, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
  items: FoundItem[];
  people: Person[];
  reports: LostReport[];
  onUpdate: () => void;
  user: User;
}

type DateFilterType = 'ALL' | 'TODAY' | 'WEEK' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM';
type SortKey = 'id' | 'description' | 'locationFound' | 'locationStored' | 'dateFound';

export const FoundItemsTab: React.FC<Props> = ({ items, people, reports, onUpdate, user }) => {
  const [activeSubTab, setActiveSubTab] = useState<ItemStatus>(ItemStatus.AVAILABLE);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'id', direction: 'desc' });

  // Modals State
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Return Modal State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [itemToReturn, setItemToReturn] = useState<FoundItem | null>(null);
  const [returnType, setReturnType] = useState<'PERSON' | 'REPORT'>('PERSON');
  
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedReport, setSelectedReport] = useState<LostReport | null>(null);
  
  const [editingItem, setEditingItem] = useState<FoundItem | null>(null);
  const [viewingItem, setViewingItem] = useState<FoundItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  
  // Date Filtering State
  const [dateFilter, setDateFilter] = useState<DateFilterType>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const userString = `${user.name} (${user.matricula})`;
  
  const availableTabs = useMemo(() => {
    const statuses = Object.values(ItemStatus);
    if (user.level === UserLevel.STANDARD) {
      return statuses.filter(s => s !== ItemStatus.DISCARDED);
    }
    return statuses;
  }, [user.level]);

  const normalizeText = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesStatus = item.status === activeSubTab;
      
      const rawSearch = searchTerm.trim();
      let matchesSearch = true;

      if (rawSearch.startsWith('#')) {
         const searchId = parseInt(rawSearch.replace('#', ''));
         if (!isNaN(searchId)) {
            matchesSearch = item.id === searchId;
         } else {
            matchesSearch = false;
         }
      } else {
        const searchTerms = normalizeText(searchTerm).split(/\s+/).filter(t => t.length > 0);
        if (searchTerms.length > 0) {
          const itemSearchableText = normalizeText(`
            ${item.id} 
            ${item.description} 
            ${item.detailedDescription || ''} 
            ${item.locationFound} 
            ${item.locationStored}
          `);
          matchesSearch = searchTerms.every(term => itemSearchableText.includes(term));
        }
      }

      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const itemDate = new Date(item.dateFound + 'T12:00:00'); 
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === 'TODAY') {
          const iDate = new Date(item.dateFound + 'T00:00:00');
          iDate.setHours(0,0,0,0);
          matchesDate = iDate.getTime() === today.getTime();
        } else if (dateFilter === 'WEEK') {
          const firstDay = new Date(today);
          firstDay.setDate(today.getDate() - today.getDay()); 
          const lastDay = new Date(today);
          lastDay.setDate(today.getDate() + (6 - today.getDay())); 
          
          const iDate = new Date(item.dateFound + 'T00:00:00');
          iDate.setHours(0,0,0,0);
          matchesDate = iDate >= firstDay && iDate <= lastDay;

        } else if (dateFilter === 'THIS_MONTH') {
          matchesDate = itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
        } else if (dateFilter === 'THIS_YEAR') {
          matchesDate = itemDate.getFullYear() === today.getFullYear();
        } else if (dateFilter === 'CUSTOM' && startDate && endDate) {
          const start = new Date(startDate + 'T00:00:00');
          const end = new Date(endDate + 'T23:59:59');
          matchesDate = itemDate >= start && itemDate <= end;
        }
      }

      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [items, activeSubTab, searchTerm, dateFilter, startDate, endDate]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];
    sorted.sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      // Handle specific types if necessary (dates are strings in format YYYY-MM-DD so string sort works)
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [filteredItems, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (name: SortKey) => {
    if (sortConfig.key !== name) {
      return <div className="w-3 h-3 ml-1"></div>; // Spacer
    }
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />;
  };

  const filteredPeople = useMemo(() => {
    if (!personSearch.trim()) return [];
    
    const searchTerms = normalizeText(personSearch).split(/\s+/).filter(t => t.length > 0);

    return people.filter(p => {
      const personText = normalizeText(`${p.name} ${p.matricula}`);
      return searchTerms.every(term => personText.includes(term));
    }).slice(0, 5); 
  }, [people, personSearch]);

  const openReports = useMemo(() => {
    return reports.filter(r => r.status === ReportStatus.OPEN);
  }, [reports]);

  const getDaysInStock = (dateString: string) => {
    const foundDate = new Date(dateString + 'T12:00:00');
    const today = new Date();
    foundDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    
    const diffTime = Math.abs(today.getTime() - foundDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (diffDays === 0) return <span className="text-red-600 font-bold">Hoje</span>;
    if (diffDays === 1) return <span className="text-gray-700">Ontem</span>;
    return <span className="text-gray-700">Há {diffDays} dias</span>;
  };

  const getStatusColorClass = (status: ItemStatus) => {
    switch (status) {
      case ItemStatus.AVAILABLE: return 'bg-green-100 text-green-800 border-green-200';
      case ItemStatus.RETURNED: return 'bg-blue-100 text-blue-800 border-blue-200';
      case ItemStatus.DISCARDED: return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-50 text-gray-800';
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const isNew = !editingItem || editingItem.id === 0;

    const dateFoundInput = formData.get('dateFound') as string;
    const todayStr = new Date().toISOString().split('T')[0];

    if (dateFoundInput > todayStr) {
      alert("A data em que o item foi achado não pode ser futura.");
      setIsLoading(false);
      return;
    }

    const newItem: FoundItem = {
      id: editingItem ? editingItem.id : 0,
      description: formData.get('description') as string,
      detailedDescription: formData.get('detailedDescription') as string,
      locationFound: formData.get('locationFound') as string,
      locationStored: formData.get('locationStored') as string,
      dateFound: dateFoundInput,
      dateRegistered: editingItem ? editingItem.dateRegistered : new Date().toISOString(),
      status: editingItem ? editingItem.status : ItemStatus.AVAILABLE,
    };

    try {
      await StorageService.saveItem(newItem, isNew ? 'Novo item cadastrado.' : 'Detalhes do item editados.', userString);
      onUpdate();
      setShowEditModal(false);
      setEditingItem(null);
    } catch (e: any) {
      alert(`Erro ao salvar item: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (user.level === UserLevel.STANDARD) {
      alert("Usuários Padrão não podem excluir itens.");
      return;
    }
    if (confirm('Tem certeza que deseja excluir este item?')) {
      await StorageService.deleteItem(id);
      onUpdate();
    }
  };

  const handleOpenReturnModal = (e: React.MouseEvent, item: FoundItem) => {
    e.stopPropagation();
    setItemToReturn(item);
    setShowReturnModal(true);
    setPersonSearch('');
    setSelectedPerson(null);
    setSelectedReport(null);
    setReturnType('PERSON');
  };

  const handleConfirmReturn = async () => {
    if (!itemToReturn) return;
    setIsLoading(true);

    let receiverName = '';
    let logMessage = '';

    if (returnType === 'PERSON') {
      if (!selectedPerson) {
        alert("Selecione uma pessoa.");
        setIsLoading(false);
        return;
      }
      receiverName = selectedPerson.name;
      logMessage = `Item devolvido para: ${selectedPerson.name} (${selectedPerson.matricula})`;
    } else {
      if (!selectedReport) {
        alert("Selecione um relato.");
        setIsLoading(false);
        return;
      }
      receiverName = selectedReport.personName;
      logMessage = `Item vinculado ao Relato de Perda de ${selectedReport.personName}. Status do relato atualizado.`;
      
      const updatedReport: LostReport = {
        ...selectedReport,
        status: ReportStatus.RESOLVED,
        history: [...selectedReport.history, { date: new Date().toISOString(), note: `Item encontrado (ID: ${itemToReturn.id}) e devolvido.`, user: userString }]
      };
      await StorageService.saveReport(updatedReport);
    }

    const updatedItem = {
      ...itemToReturn,
      status: ItemStatus.RETURNED,
      returnedTo: receiverName,
      returnedDate: new Date().toISOString()
    };
    
    await StorageService.saveItem(updatedItem, logMessage, userString);
    
    onUpdate();
    setShowReturnModal(false);
    setItemToReturn(null);
    setIsLoading(false);
  };

  const handleCancelReturn = async (e: React.MouseEvent, item: FoundItem) => {
    e.stopPropagation();
    const action = item.status === ItemStatus.DISCARDED ? "cancelar o descarte" : "cancelar a devolução";
    
    if (confirm(`Deseja ${action} e marcar o item como Disponível novamente?`)) {
      const updated = {
        ...item,
        status: ItemStatus.AVAILABLE,
        returnedTo: undefined,
        returnedDate: undefined
      };
      await StorageService.saveItem(updated, `${action === "cancelar o descarte" ? 'Descarte' : 'Devolução'} cancelada. Item retornou para Disponível.`, userString);
      onUpdate();
    }
  };

  const handleBatchDonate = async () => {
    if (user.level === UserLevel.STANDARD) {
        alert("Ação não permitida para nível Padrão.");
        return;
    }

    if (confirm(`Marcar ${selectedItems.length} itens como Doado/Descartado?`)) {
      setIsLoading(true);
      // Processar em série ou paralelo.
      const promises = selectedItems.map(async (id) => {
        const item = items.find(i => i.id === id);
        if (item) {
          return StorageService.saveItem({ 
            ...item, 
            status: ItemStatus.DISCARDED,
            returnedDate: new Date().toISOString() 
          }, 'Item marcado como Doado/Descartado em lote.', userString);
        }
      });
      await Promise.all(promises);
      
      setSelectedItems([]);
      onUpdate();
      setIsLoading(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const openDetails = (item: FoundItem) => {
    setViewingItem(item);
    setShowDetailModal(true);
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const datePart = isoString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex p-1 bg-gray-200 rounded-lg">
          {availableTabs.map((status) => (
            <button
              key={status}
              onClick={() => { setActiveSubTab(status); setSelectedItems([]); }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeSubTab === status 
                ? 'bg-white text-ifrn-darkGreen shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          {selectedItems.length > 0 && activeSubTab === ItemStatus.AVAILABLE && user.level !== UserLevel.STANDARD && (
            <button 
              onClick={handleBatchDonate}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
            >
              <Gift size={16} /> Doar ({selectedItems.length})
            </button>
          )}
          <button 
            onClick={() => { setEditingItem(null); setShowEditModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen transition-colors text-sm w-full md:w-auto justify-center"
          >
            <Plus size={18} /> Novo Item
          </button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por ID, descrição ou palavras-chave..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ifrn-green focus:border-transparent outline-none text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
          <Calendar size={16} className="text-gray-500 ml-2" />
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
            className="bg-transparent border-none text-sm text-gray-700 focus:ring-0 cursor-pointer py-1.5"
          >
            <option value="ALL">Todo o período</option>
            <option value="TODAY">Hoje</option>
            <option value="WEEK">Esta Semana</option>
            <option value="THIS_MONTH">Este Mês</option>
            <option value="THIS_YEAR">Este Ano</option>
            <option value="CUSTOM">Data Personalizada</option>
          </select>
          
          {dateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-1 pl-2 border-l border-gray-300 animate-fadeIn">
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-white"
              />
              <span className="text-gray-400">-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="bg-gray-50/50 text-gray-500 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                {/* HEADERS FOR AVAILABLE */}
                {activeSubTab === ItemStatus.AVAILABLE && (
                  <>
                    <th className="p-4 w-4">
                      <input 
                        type="checkbox" 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedItems(filteredItems.map(i => i.id));
                          else setSelectedItems([]);
                        }}
                        checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                        disabled={user.level === UserLevel.STANDARD}
                      />
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('id')}>
                      <div className="flex items-center">ID {getSortIcon('id')}</div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('description')}>
                      <div className="flex items-center">Descrição {getSortIcon('description')}</div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('locationFound')}>
                      <div className="flex items-center">Local Encontrado {getSortIcon('locationFound')}</div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('locationStored')}>
                      <div className="flex items-center">Guardado Em {getSortIcon('locationStored')}</div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('dateFound')}>
                      <div className="flex items-center">Data {getSortIcon('dateFound')}</div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('dateFound')}>
                      <div className="flex items-center">Tempo no Estoque {getSortIcon('dateFound')}</div>
                    </th>
                    <th className="p-4 text-center">Ações</th>
                  </>
                )}

                {/* HEADERS FOR RETURNED / DISCARDED */}
                {(activeSubTab === ItemStatus.RETURNED || activeSubTab === ItemStatus.DISCARDED) && (
                  <>
                    <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('id')}>
                      <div className="flex items-center">ID {getSortIcon('id')}</div>
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('description')}>
                      <div className="flex items-center">Descrição {getSortIcon('description')}</div>
                    </th>
                    <th className="p-4">Data de {activeSubTab === ItemStatus.RETURNED ? 'Devolução' : 'Saída'}</th>
                    <th className="p-4 text-center">Ações</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Nenhum item encontrado com os filtros atuais.</td>
                </tr>
              ) : (
                sortedItems.map(item => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => openDetails(item)}
                  >
                     {/* BODY FOR AVAILABLE */}
                     {activeSubTab === ItemStatus.AVAILABLE && (
                        <>
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={selectedItems.includes(item.id)}
                              onChange={() => toggleSelection(item.id)}
                              disabled={user.level === UserLevel.STANDARD}
                            />
                          </td>
                          <td className="p-4 font-bold text-ifrn-green">{item.id}</td>
                          <td className="p-4">
                            <div className="font-medium text-gray-900 group flex items-center gap-2">
                              {item.description}
                              <Info size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {item.detailedDescription && (
                              <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">{item.detailedDescription}</div>
                            )}
                          </td>
                          <td className="p-4 text-gray-700">{item.locationFound}</td>
                          <td className="p-4 font-medium text-gray-800">{item.locationStored}</td>
                          <td className="p-4 text-gray-600">{formatDate(item.dateFound)}</td>
                          <td className="p-4 font-medium">{getDaysInStock(item.dateFound)}</td>
                          <td className="p-4">
                            <div className="flex justify-center gap-2">
                                <button onClick={(e) => handleOpenReturnModal(e, item)} title="Devolver / Dar Saída" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><CornerUpRight size={18} /></button>
                                <button onClick={(e) => { e.stopPropagation(); setEditingItem(item); setShowEditModal(true); }} title="Editar" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"><Pencil size={18} /></button>
                                {user.level !== UserLevel.STANDARD && (
                                  <button onClick={(e) => handleDelete(e, item.id)} title="Excluir" className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={18} /></button>
                                )}
                            </div>
                          </td>
                        </>
                     )}

                     {/* BODY FOR RETURNED / DISCARDED */}
                     {(activeSubTab === ItemStatus.RETURNED || activeSubTab === ItemStatus.DISCARDED) && (
                        <>
                           <td className="p-4 font-bold text-ifrn-green">{item.id}</td>
                           <td className="p-4">
                            <div className="font-medium text-gray-900 group flex items-center gap-2">
                              {item.description}
                            </div>
                            {activeSubTab === ItemStatus.RETURNED && item.returnedTo && (
                                <div className="text-xs text-gray-500 mt-1">Para: {item.returnedTo}</div>
                            )}
                          </td>
                          <td className="p-4 text-gray-600">
                             {item.returnedDate ? formatDate(item.returnedDate) : '-'}
                             {item.returnedDate && <span className="text-xs text-gray-400 ml-1">({new Date(item.returnedDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>}
                          </td>
                          <td className="p-4 text-center">
                            {user.level !== UserLevel.STANDARD && (
                              <button 
                                onClick={(e) => handleCancelReturn(e, item)}
                                title={activeSubTab === ItemStatus.RETURNED ? "Cancelar Devolução (Estornar)" : "Cancelar Descarte (Estornar)"}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors inline-flex items-center gap-1 text-xs font-medium px-2 border border-amber-200"
                              >
                                <RotateCcw size={14} /> Estornar
                              </button>
                            )}
                          </td>
                        </>
                     )}

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Edit/Create */}
      <Modal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)}
        title={editingItem ? `Editar Item #${editingItem.id}` : 'Cadastrar Novo Item'}
      >
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Curta *</label>
            <input name="description" required defaultValue={editingItem?.description} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Ex: Garrafa Azul" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Data que foi achado *</label>
            <input 
              type="date" 
              name="dateFound" 
              required 
              max={new Date().toISOString().split('T')[0]}
              defaultValue={editingItem?.dateFound || new Date().toISOString().split('T')[0]} 
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" 
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Detalhada</label>
            <textarea name="detailedDescription" rows={3} defaultValue={editingItem?.detailedDescription} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Marca, detalhes de avaria, conteúdo..." />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Local onde foi achado *</label>
            <input name="locationFound" required defaultValue={editingItem?.locationFound} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Ex: Auditório" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Local de Armazenamento *</label>
            <input name="locationStored" required defaultValue={editingItem?.locationStored} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Ex: Armário 1" />
          </div>
          <div className="col-span-2 pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-medium">{isLoading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Return Item */}
      <Modal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Realizar Devolução do Item"
      >
         {/* Conteúdo do Modal de Devolução (mantém-se estruturalmente igual, apenas botões usam handleConfirmReturn que é async) */}
         <div className="space-y-6">
          <p className="text-sm text-gray-600">
            Você está devolvendo o item: <strong>{itemToReturn?.description}</strong>
          </p>

          <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
             <button onClick={() => setReturnType('PERSON')} className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 ${returnType === 'PERSON' ? 'bg-white shadow-sm text-ifrn-darkGreen' : 'text-gray-500'}`}><UserIcon size={16} /> Selecionar Pessoa</button>
             <button onClick={() => setReturnType('REPORT')} className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 ${returnType === 'REPORT' ? 'bg-white shadow-sm text-ifrn-darkGreen' : 'text-gray-500'}`}><FileText size={16} /> Vincular a Relato</button>
          </div>

          {returnType === 'PERSON' && (
            <div className="relative space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Buscar Pessoa Cadastrada</label>
              <div className="relative">
                <input type="text" value={personSearch} onChange={(e) => { setPersonSearch(e.target.value); setSelectedPerson(null); }} placeholder="Digite o nome ou parte da matrícula..." className="w-full border rounded-lg p-2.5 pl-10 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" />
                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
              </div>

              {selectedPerson ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3"><div className="bg-green-100 p-2 rounded-full text-green-700"><UserIcon size={20} /></div><div><p className="font-bold text-green-900 text-sm">{selectedPerson.name}</p><p className="text-xs text-green-700">{selectedPerson.matricula} • {selectedPerson.type}</p></div><CheckCircle size={20} className="text-green-600 ml-auto" /></div>
              ) : (
                filteredPeople.length > 0 && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100 absolute w-full bg-white z-10 shadow-lg">
                    {filteredPeople.map(p => (
                      <div key={p.id} onClick={() => { setSelectedPerson(p); setPersonSearch(p.name); }} className="p-3 hover:bg-gray-50 cursor-pointer"><p className="text-sm font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-500">{p.matricula}</p></div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {returnType === 'REPORT' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Selecionar Relato de Perda (Aberto)</label>
              {openReports.length === 0 ? (
                <p className="text-sm text-gray-400 italic p-3 border rounded bg-gray-50">Não há relatos de perda em aberto.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {openReports.map(report => (
                    <div key={report.id} onClick={() => setSelectedReport(report)} className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedReport?.id === report.id ? 'border-ifrn-green bg-green-50 ring-1 ring-ifrn-green' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className="flex justify-between items-start"><div><p className="font-bold text-sm text-gray-800">{report.itemDescription}</p><p className="text-xs text-gray-500">Relatado por: <strong>{report.personName}</strong></p><p className="text-xs text-gray-400 mt-1">{new Date(report.createdAt).toLocaleDateString()}</p></div>{selectedReport?.id === report.id && <CheckCircle size={18} className="text-ifrn-green" />}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button onClick={() => setShowReturnModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
            <button onClick={handleConfirmReturn} disabled={isLoading} className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-medium text-sm flex items-center gap-2">{isLoading ? '...' : <><CornerUpRight size={16} /> Confirmar Devolução</>}</button>
          </div>
        </div>
      </Modal>

      {/* MODAL: View Details */}
      <Modal 
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalhes do Objeto"
      >
        {viewingItem && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                 <span className="text-xs font-bold text-gray-400 uppercase">Descrição</span>
                 <p className="text-lg font-bold text-gray-800">{viewingItem.description}</p>
                 <p className="text-gray-600 mt-1">{viewingItem.detailedDescription || "Sem detalhes adicionais."}</p>
              </div>
              <div>
                 <span className="text-xs font-bold text-gray-400 uppercase">ID</span>
                 <p className="font-mono text-ifrn-darkGreen font-bold">#{viewingItem.id}</p>
              </div>
              <div>
                 <span className="text-xs font-bold text-gray-400 uppercase">Status</span>
                 <p>
                   <span className={`border px-2 py-0.5 rounded text-xs font-bold ${getStatusColorClass(viewingItem.status)}`}>
                     {viewingItem.status}
                   </span>
                 </p>
              </div>
              <div>
                 <span className="text-xs font-bold text-gray-400 uppercase">Local Achado</span>
                 <p>{viewingItem.locationFound}</p>
              </div>
              <div>
                 <span className="text-xs font-bold text-gray-400 uppercase">Guardado Em</span>
                 <p>{viewingItem.locationStored}</p>
              </div>
              {viewingItem.returnedTo && viewingItem.status === ItemStatus.RETURNED && (
                <div className="col-span-2 bg-green-50 p-2 rounded border border-green-100">
                  <span className="text-xs font-bold text-green-700 uppercase">Devolvido Para</span>
                  <p className="text-green-900 font-medium">{viewingItem.returnedTo}</p>
                  <p className="text-xs text-green-700">{new Date(viewingItem.returnedDate!).toLocaleString()}</p>
                </div>
              )}
               {viewingItem.status === ItemStatus.DISCARDED && viewingItem.returnedDate && (
                <div className="col-span-2 bg-gray-200 p-2 rounded border border-gray-300">
                  <span className="text-xs font-bold text-gray-700 uppercase">Descartado/Doado em</span>
                  <p className="text-gray-900 font-medium">{new Date(viewingItem.returnedDate).toLocaleString()}</p>
                </div>
              )}
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-bold text-gray-700 mb-3 border-b pb-2">
                <History size={18} /> Histórico do Objeto
              </h4>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {viewingItem.history && viewingItem.history.length > 0 ? (
                  viewingItem.history.slice().reverse().map((log, index) => (
                    <div key={index} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                         <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5"></div>
                         {index !== viewingItem.history!.length - 1 && <div className="w-px h-full bg-gray-200 my-1"></div>}
                      </div>
                      <div>
                        <p className="text-gray-800">{log.action}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(log.date).toLocaleString()} • Por: {log.user || 'Sistema'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic">Nenhum histórico registrado para este item.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};