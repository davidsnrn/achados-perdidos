import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StorageService, supabase } from '../../services/storage';
import { Supply, SupplyRecord, User, UserLevel, Person } from '../../types';
import { 
  Truck, 
  Plus, 
  Search, 
  History, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Pencil, 
  Loader2, 
  User as UserIcon, 
  Building2, 
  Hash, 
  Layers, 
  Printer, 
  Download,
  Calendar,
  Filter,
  ArrowRight,
  TrendingDown,
  ChevronRight
} from 'lucide-react';
import { Modal } from '../ui/Modal';

interface InsumosTabProps {
  user: User;
  onRefresh?: () => void;
}

export const InsumosTab: React.FC<InsumosTabProps> = ({ user }) => {
  const [activeSubTab, setActiveSubTab] = useState<'distribuicao' | 'estoque' | 'historico'>('distribuicao');
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [records, setRecords] = useState<SupplyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modals
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);

  // Form State - Supply
  const [supplyName, setSupplyName] = useState('');
  const [supplyQuantity, setSupplyQuantity] = useState(0);
  const [supplyUnit, setSupplyUnit] = useState('Unidade');

  // Form State - Distribution Record
  const [recipientName, setRecipientName] = useState('');
  const [recipientMatricula, setRecipientMatricula] = useState('');
  const [recipientEnvironment, setRecipientEnvironment] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'pessoa' | 'ambiente'>('pessoa');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [recordQuantity, setRecordQuantity] = useState(1);
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [personSearchResults, setPersonSearchResults] = useState<Person[]>([]);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  
  const campusId = user.campus_id;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sData, rData] = await Promise.all([
        StorageService.getSupplies(campusId),
        StorageService.getSupplyRecords(campusId)
      ]);
      setSupplies(sData);
      setRecords(rData);
    } catch (error) {
      console.error("Erro ao carregar dados de insumos:", error);
    } finally {
      setLoading(false);
    }
  }, [campusId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusId) return;

    try {
      await StorageService.saveSupply({
        id: editingSupply?.id,
        campus_id: campusId,
        name: supplyName,
        quantity: supplyQuantity,
        unit: supplyUnit
      });
      setShowSupplyModal(false);
      resetSupplyForm();
      loadData();
    } catch (error) {
      alert("Erro ao salvar insumo.");
    }
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusId) return;
    if (!selectedItemId) {
      alert("Selecione um item.");
      return;
    }

    try {
      await StorageService.saveSupplyRecord({
        campus_id: campusId,
        person_name: deliveryMode === 'pessoa' ? recipientName : undefined,
        person_matricula: deliveryMode === 'pessoa' ? recipientMatricula : undefined,
        environment: deliveryMode === 'ambiente' ? recipientEnvironment : undefined,
        item_id: selectedItemId,
        quantity: recordQuantity,
        date: new Date(recordDate).toISOString(),
        operator_id: user.id
      });
      setShowRecordModal(false);
      resetRecordForm();
      loadData();
    } catch (error: any) {
      alert(error.message || "Erro ao registrar distribuição.");
    }
  };

  const handleDeleteSupply = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este item do estoque?")) return;
    try {
      await StorageService.deleteSupply(id);
      loadData();
    } catch (error) {
      alert("Erro ao excluir insumo.");
    }
  };

  const resetSupplyForm = () => {
    setEditingSupply(null);
    setSupplyName('');
    setSupplyQuantity(0);
    setSupplyUnit('Unidade');
  };

  const resetRecordForm = () => {
    setRecipientName('');
    setRecipientMatricula('');
    setRecipientEnvironment('');
    setDeliveryMode('pessoa');
    setSelectedPerson(null);
    setSelectedItemId('');
    setRecordQuantity(1);
    setRecordDate(new Date().toISOString().split('T')[0]);
  };

  const openEditSupply = (supply: Supply) => {
    setEditingSupply(supply);
    setSupplyName(supply.name);
    setSupplyQuantity(supply.quantity);
    setSupplyUnit(supply.unit);
    setShowSupplyModal(true);
  };

  const filteredSupplies = supplies.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRecords = records.filter(r => 
    (r.person_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     r.person_matricula?.includes(searchTerm) ||
     r.environment?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.sector && r.sector.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const handlePersonSearch = async (val: string, isTriggered = false) => {
    setPersonSearch(val);
    if (isTriggered && val.length >= 2) {
      setIsSearchingPeople(true);
      try {
        const results = await StorageService.searchPeople(val, 5, user.campus_id || undefined);
        setPersonSearchResults(results);
        setShowPersonDropdown(results.length > 0);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearchingPeople(false);
      }
    } else {
      setPersonSearchResults([]);
      setShowPersonDropdown(false);
    }
  };

  const selectPerson = (p: Person) => {
    setSelectedPerson(p);
    setRecipientName(p.name);
    setRecipientMatricula(p.matricula);
    setPersonSearch('');
    setPersonSearchResults([]);
    setShowPersonDropdown(false);
  };

  const clearSelectedPerson = () => {
    setSelectedPerson(null);
    setRecipientName('');
    setRecipientMatricula('');
    setPersonSearch('');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in-down">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-100 ring-4 ring-white">
              <Truck size={32} className="text-white" />
            </div>
            Distribuição de Insumos
          </h1>
          <p className="mt-2 text-gray-500 font-medium">Controle definitivo de materiais e gestão de estoque</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => { resetRecordForm(); setShowRecordModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-100 hover:-translate-y-0.5"
          >
            <Plus size={20} /> Nova Distribuição
          </button>
          <button 
            onClick={() => { resetSupplyForm(); setShowSupplyModal(true); }}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-5 py-3 rounded-xl font-bold transition-all border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <Layers size={20} className="text-indigo-600" /> Gerenciar Estoque
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex p-1.5 bg-gray-100/80 backdrop-blur-sm rounded-2xl mb-8 w-fit border border-gray-200 shadow-inner">
        <button
          onClick={() => setActiveSubTab('distribuicao')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'distribuicao' 
            ? 'bg-white text-indigo-600 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingDown size={18} /> Entregas Recentes
        </button>
        <button
          onClick={() => setActiveSubTab('estoque')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'estoque' 
            ? 'bg-white text-indigo-600 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Truck size={18} /> Consultar Estoque
        </button>
        <button
          onClick={() => setActiveSubTab('historico')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'historico' 
            ? 'bg-white text-indigo-600 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <History size={18} /> Histórico Completo
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden relative">
        {/* Search Bar */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome, matrícula ou setor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-500 transition-all font-medium text-gray-700 placeholder:text-gray-400 group-focus-within:shadow-lg group-focus-within:shadow-indigo-50"
            />
          </div>
          
          <div className="flex items-center gap-2 text-sm font-bold text-gray-500 bg-white px-4 py-2 rounded-xl border border-gray-100">
            <Filter size={16} className="text-indigo-600" /> Filtrar Por Período
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-2 sm:p-6 overflow-x-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
              <p className="text-gray-500 font-medium">Carregando informações...</p>
            </div>
          ) : activeSubTab === 'distribuicao' ? (
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr className="text-gray-400 text-xs font-black uppercase tracking-widest px-6">
                  <th className="px-6 py-4">Destinatário / Local</th>
                  <th className="px-6 py-4">Item</th>
                  <th className="px-6 py-4">Qtd</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(record => (
                  <tr key={record.id} className="group bg-white hover:bg-indigo-50/30 transition-all duration-300 rounded-2xl shadow-sm border border-gray-100 animate-fade-in-up">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                          {record.environment ? <Building2 size={20} /> : <UserIcon size={20} />}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors uppercase">
                            {record.person_name || record.environment}
                          </div>
                          <div className="text-xs text-gray-400 font-medium">
                            {record.person_matricula || 'DISTR. AMBIENTE'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-gray-800">
                        {supplies.find(s => s.id === record.item_id)?.name || 'Item Excluído'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="w-fit px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm font-black shadow-sm">
                        {record.quantity}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-medium text-gray-500">
                        {new Date(record.date).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button 
                        onClick={() => { if(confirm("Deseja cancelar esta entrega e restaurar o estoque?")) StorageService.deleteSupplyRecord(record.id, true).then(loadData); }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Estornar entrega"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeSubTab === 'estoque' ? (
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr className="text-gray-400 text-xs font-black uppercase tracking-widest px-6">
                  <th className="px-6 py-4">Item</th>
                  <th className="px-6 py-4">Quantidade</th>
                  <th className="px-6 py-4">Unidade</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredSupplies.map(supply => (
                  <tr key={supply.id} className="group bg-white hover:bg-indigo-50/30 transition-all duration-300 rounded-2xl shadow-sm border border-gray-100 animate-fade-in-up">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                          <Layers size={20} />
                        </div>
                        <div className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors uppercase">
                          {supply.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className={`text-lg font-black ${supply.quantity <= 5 ? 'text-amber-600' : 'text-indigo-600'}`}>
                        {supply.quantity}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold uppercase">
                        {supply.unit}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {supply.quantity <= 5 ? (
                        <div className="flex items-center gap-2 w-fit px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold ring-1 ring-amber-100">
                          <AlertCircle size={14} /> ESTOQUE BAIXO
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-fit px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold ring-1 ring-emerald-100">
                          <CheckCircle2 size={14} /> EM DIA
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => openEditSupply(supply)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="Ajustar estoque"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSupply(supply.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Excluir item"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Printer className="text-gray-200" size={64} />
              <p className="text-gray-500 font-medium">Relatórios detalhados seguem em implementação.</p>
            </div>
          )}
          
          {!loading && ((activeSubTab === 'distribuicao' && filteredRecords.length === 0) || (activeSubTab === 'estoque' && filteredSupplies.length === 0)) && (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="p-6 bg-gray-50 rounded-full">
                <Search className="text-gray-200" size={48} />
              </div>
              <p className="text-gray-500 font-medium text-lg">Nenhum registro encontrado.</p>
              <button 
                onClick={() => setSearchTerm('')}
                className="text-indigo-600 font-bold hover:underline"
              >
                Limpar filtros de busca
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nova Distribuição */}
      <Modal 
        isOpen={showRecordModal} 
        onClose={() => setShowRecordModal(false)}
        title=""
      >
        <form onSubmit={handleSaveRecord} className="space-y-6">
          <div className="text-center pb-6 border-b border-gray-100">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
              <Plus size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-1">Registrar Entrega</h3>
            <p className="text-sm text-gray-500 font-medium">Preencha os dados para baixa no estoque</p>
          </div>

          <div className="space-y-5">
            {/* Delivery Mode Toggle */}
            <div className="flex p-1 bg-gray-100 rounded-xl mb-2">
              <button
                type="button"
                onClick={() => setDeliveryMode('pessoa')}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                  deliveryMode === 'pessoa' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Pessoa
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode('ambiente')}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                  deliveryMode === 'ambiente' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Ambiente/Local
              </button>
            </div>

            {/* Person Search Section */}
            {deliveryMode === 'pessoa' ? (
              <div>
                <label className="flex items-center gap-2 text-xs font-black text-indigo-500 uppercase tracking-widest mb-2">
                  <UserIcon size={14} /> Solicitante
                </label>

                {selectedPerson ? (
                  <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-4 animate-fade-in-down shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-50">
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <p className="font-black text-indigo-900 text-sm uppercase">{selectedPerson.name}</p>
                        <p className="text-xs text-indigo-400 font-bold tracking-wider">{selectedPerson.matricula} • {selectedPerson.type}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearSelectedPerson}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Remover seleção"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="relative group">
                    <input
                      type="text"
                      value={personSearch}
                      onChange={e => handlePersonSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handlePersonSearch(personSearch, true))}
                      className="w-full bg-gray-50 border-2 border-gray-100/50 rounded-2xl pl-5 pr-14 py-4 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-400"
                      placeholder="Busca por Nome ou Matrícula..."
                    />
                    <button
                      type="button"
                      onClick={() => handlePersonSearch(personSearch, true)}
                      disabled={isSearchingPeople}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      {isSearchingPeople ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                    </button>

                    {showPersonDropdown && personSearchResults.length > 0 && (
                      <div className="absolute z-[60] w-full mt-2 bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden ring-4 ring-gray-100/50 animate-scale-in">
                        <div className="p-2 space-y-1">
                          {personSearchResults.map(p => (
                            <button
                              key={p.matricula}
                              type="button"
                              onClick={() => selectPerson(p)}
                              className="w-full p-4 text-left bg-indigo-50/30 hover:bg-indigo-50 rounded-2xl transition-all flex items-center justify-between group/item border border-transparent hover:border-indigo-100 hover:scale-[1.01]"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-400 shadow-sm border border-indigo-50 group-hover/item:text-indigo-600 transition-colors">
                                  <UserIcon size={20} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-indigo-900 uppercase truncate leading-tight mb-0.5">{p.name}</p>
                                  <p className="text-[11px] text-indigo-400 font-black tracking-widest">{p.matricula} <span className="mx-1.5 opacity-30">|</span> {p.type}</p>
                                </div>
                              </div>
                              <span className="text-[10px] font-black text-indigo-500 bg-white px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm uppercase tracking-tighter opacity-0 group-hover/item:opacity-100 transition-all translate-x-2 group-hover/item:translate-x-0">
                                Selecionar
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 animate-fade-in-down">
                <label className="flex items-center gap-2 text-xs font-black text-indigo-500 uppercase tracking-widest mb-1 ml-1">
                  <Building2 size={14} /> Ambiente/Local
                </label>
                <input
                  type="text"
                  required
                  value={recipientEnvironment}
                  onChange={e => setRecipientEnvironment(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100/50 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold text-gray-900"
                  placeholder="EX: Sala de Aula 10, Biblioteca, Lab 01..."
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Data</label>
                <input
                  type="date"
                  required
                  value={recordDate}
                  onChange={e => setRecordDate(e.target.value)}
                  className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div className="p-5 bg-indigo-50 rounded-[1.5rem] border border-indigo-100 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-indigo-400 uppercase tracking-widest ml-1">Material do Estoque</label>
                <select
                  required
                  value={selectedItemId}
                  onChange={e => setSelectedItemId(e.target.value)}
                  className="w-full bg-white border-2 border-indigo-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-200/20 focus:border-indigo-500 outline-none transition-all font-bold text-indigo-900"
                >
                  <option value="">Selecione um item...</option>
                  {supplies.map(s => (
                    <option key={s.id} value={s.id} disabled={s.quantity <= 0}>
                      {s.name} ({s.quantity} {s.unit} disponíveis)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-indigo-400 uppercase tracking-widest ml-1">Quantidade a Entregar</label>
                <div className="flex items-center gap-4">
                  <button 
                    type="button"
                    onClick={() => setRecordQuantity(q => Math.max(1, q - 1))}
                    className="w-12 h-12 bg-white rounded-xl shadow-sm border border-indigo-100 flex items-center justify-center text-xl font-black text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    required
                    value={recordQuantity}
                    onChange={e => setRecordQuantity(Number(e.target.value))}
                    className="flex-1 bg-white border-2 border-indigo-200 rounded-xl px-4 py-3 text-center text-lg font-black text-indigo-900 focus:ring-4 focus:ring-indigo-200/20 focus:border-indigo-500 outline-none transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => setRecordQuantity(q => q + 1)}
                    className="w-12 h-12 bg-white rounded-xl shadow-sm border border-indigo-100 flex items-center justify-center text-xl font-black text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowRecordModal(false)}
              className="flex-1 px-4 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-200 transition-all uppercase text-xs tracking-widest"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-[2] px-4 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all uppercase text-xs tracking-widest flex items-center justify-center gap-2"
            >
              Registrar Entrega <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Gerenciar Estoque */}
      <Modal isOpen={showSupplyModal} onClose={() => setShowSupplyModal(false)} title="">
        <form onSubmit={handleSaveSupply} className="space-y-6">
          <div className="text-center pb-6 border-b border-gray-100">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
              <Layers size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-1">
              {editingSupply ? 'Ajustar Estoque' : 'Novo Insumo'}
            </h3>
            <p className="text-sm text-gray-500 font-medium">Cadastre ou ajuste materiais para distribuição</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nome do Item</label>
              <input
                type="text"
                required
                value={supplyName}
                onChange={e => setSupplyName(e.target.value)}
                className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-bold placeholder:text-gray-300"
                placeholder="Ex: Resma, Piloto, Papel A4..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Unidade</label>
                <select
                  required
                  value={supplyUnit}
                  onChange={e => setSupplyUnit(e.target.value)}
                  className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-bold"
                >
                  <option value="Unidade">Unidade</option>
                  <option value="Caixa">Caixa</option>
                  <option value="Pacote">Pacote</option>
                  <option value="Resma">Resma</option>
                  <option value="Kilo">Kilo</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Quantidade</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={supplyQuantity}
                  onChange={e => setSupplyQuantity(Number(e.target.value))}
                  className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-black text-indigo-600"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => setShowSupplyModal(false)}
              className="flex-1 px-4 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-200 transition-all uppercase text-xs tracking-widest"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-[2] px-4 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all uppercase text-xs tracking-widest"
            >
              Salvar Insumo
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InsumosTab;
