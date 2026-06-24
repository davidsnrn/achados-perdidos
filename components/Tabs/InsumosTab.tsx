import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StorageService } from '../../services/storage';
import { Supply, SupplyRecord, User, UserLevel, Person, SupplyRestock, Setor } from '../../types';
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
  ChevronLeft,
  ChevronRight,
  XCircle,
  RotateCcw,
  Sliders
} from 'lucide-react';
import { Modal } from '../ui/Modal';

interface InsumosTabProps {
  user: User;
  onRefresh?: () => void;
  setores: Setor[];
  adminGlobalCampusId?: string | null;
  adminGlobalSetorId?: string | null;
  suppliesRefreshKey?: number;
}

export const InsumosTab: React.FC<InsumosTabProps> = ({ user, onRefresh, setores, adminGlobalCampusId, adminGlobalSetorId, suppliesRefreshKey }) => {
  const [activeSubTab, setActiveSubTab] = useState<'estoque' | 'historico'>('estoque');
  const [historyMode, setHistoryMode] = useState<'saida' | 'entrada'>('saida');
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
  const [supplyThreshold, setSupplyThreshold] = useState(5);
  const [restockMode, setRestockMode] = useState<'novo' | 'reposicao'>('novo');
  const [restockHistory, setRestockHistory] = useState<SupplyRestock[]>([]);

  // Bulk new items state
  const [bulkItems, setBulkItems] = useState([{ name: '', unit: 'Unidade', quantity: 0 }]);

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
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const [viewDate, setViewDate] = useState(new Date());
  const [personSearchResults, setPersonSearchResults] = useState<Person[]>([]);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);

  const campusId = adminGlobalCampusId || user.campus_id;
  const isAdmin = user.level === UserLevel.ADMIN;

  const [selectedSetorId, setSelectedSetorId] = useState<string>(
    (isAdmin ? adminGlobalSetorId : user.setor_id) || ''
  );

  const [deletingSupplyId, setDeletingSupplyId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [supplyToDelete, setSupplyToDelete] = useState<Supply | null>(null);

  useEffect(() => {
    if (isAdmin && adminGlobalSetorId !== undefined) {
      setSelectedSetorId(adminGlobalSetorId || '');
    }
  }, [adminGlobalSetorId, isAdmin]);

  const activeSetorId = isAdmin ? selectedSetorId : user.setor_id;

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sData, rData, hData] = await Promise.all([
        StorageService.getSupplies(campusId, activeSetorId),
        StorageService.getSupplyRecords(campusId, activeSetorId),
        StorageService.getRestockHistory(campusId, activeSetorId)
      ]);
      setSupplies(sData);
      setRecords(rData);
      setRestockHistory(hData);
    } catch (error) {
      console.error("Erro ao carregar dados de insumos:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [campusId, activeSetorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    loadData(true); // silent refresh
  }, [suppliesRefreshKey, loadData]);

  const handleSaveSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusId) return;

    try {
      if (restockMode === 'reposicao' && selectedItemId) {
        await StorageService.restockSupply({
          campus_id: campusId,
          setor_id: activeSetorId,
          supply_id: selectedItemId,
          quantity_added: supplyQuantity,
          operator_id: user.id
        });
      } else if (editingSupply) {
        await StorageService.saveSupply({
          id: editingSupply.id,
          campus_id: campusId,
          setor_id: activeSetorId || undefined,
          name: supplyName,
          quantity: supplyQuantity,
          unit: supplyUnit,
          low_stock_threshold: supplyThreshold,
          operator_id: user.id
        }, user.name);
      } else {
        const validItems = bulkItems.filter(i => i.name.trim() !== '');
        if (validItems.length === 0) { alert('Preencha ao menos um item'); return; }
        for (const item of validItems) {
          await StorageService.saveSupply({
            campus_id: campusId,
            setor_id: activeSetorId || undefined,
            name: item.name.trim(),
            quantity: item.quantity,
            unit: item.unit,
            low_stock_threshold: supplyThreshold,
            operator_id: user.id
          }, user.name);
        }
      }
      setShowSupplyModal(false);
      resetSupplyForm();
      loadData();
    } catch (error: any) {
      alert(error.message || "Erro ao salvar insumo.");
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
        setor_id: activeSetorId || undefined,
        person_name: deliveryMode === 'pessoa' ? recipientName : undefined,
        person_matricula: deliveryMode === 'pessoa' ? recipientMatricula : undefined,
        environment: deliveryMode === 'ambiente' ? recipientEnvironment : undefined,
        item_id: selectedItemId,
        quantity: recordQuantity,
        date: new Date(recordDate + "T12:00:00").toISOString(),
        operator_id: user.id
      });
      setShowRecordModal(false);
      resetRecordForm();
      loadData();
    } catch (error: any) {
      alert(error.message || "Erro ao registrar distribuição.");
    }
  };

  const handleCancelRecord = async (record: SupplyRecord) => {
    if (!confirm("Deseja realmente cancelar esta entrega? O estoque será restaurado.")) return;
    try {
      await StorageService.cancelSupplyRecord(record.id, user.name);
      loadData();
    } catch (error: any) {
      alert(error.message || "Erro ao cancelar registro.");
    }
  };

  const handleCancelRestock = async (restock: SupplyRestock) => {
    if (!confirm("Deseja realmente cancelar esta entrada? A quantidade será removida do estoque.")) return;
    try {
      await StorageService.cancelRestockRecord(restock.id, user.name);
      loadData();
    } catch (error: any) {
      alert(error.message || "Erro ao cancelar entrada.");
    }
  };

  const handleBulkItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...bulkItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setBulkItems(newItems);
  };

  const addBulkItem = () => {
    setBulkItems([...bulkItems, { name: '', unit: 'Unidade', quantity: 0 }]);
  };

  const removeBulkItem = (index: number) => {
    const newItems = bulkItems.filter((_, i) => i !== index);
    setBulkItems(newItems);
  };

  const resetSupplyForm = () => {
    setEditingSupply(null);
    setSupplyName('');
    setSupplyQuantity(restockMode === 'novo' ? 0 : 1);
    setSupplyUnit('Unidade');
    setSupplyThreshold(5);
    setSelectedItemId('');
    setBulkItems([{ name: '', unit: 'Unidade', quantity: 0 }]);
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
    setSupplyThreshold(supply.low_stock_threshold || 5);
    setRestockMode('novo');
    setShowSupplyModal(true);
  };

  const confirmDeleteSupply = async () => {
    if (!supplyToDelete) return;
    setDeletingSupplyId(supplyToDelete.id);
    try {
      await StorageService.deleteSupply(supplyToDelete.id);
      await loadData();
      setShowDeleteConfirm(false);
      setSupplyToDelete(null);
    } catch (error) {
      alert('Erro ao excluir insumo.');
    } finally {
      setDeletingSupplyId(null);
    }
  };

  const filteredSupplies = supplies.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRecords = records.filter(r => {
    const recordDate = new Date(r.date);
    const inRange = recordDate >= new Date(startDate + "T00:00:00") && recordDate <= new Date(endDate + "T23:59:59");
    const matchesSearch = (r.person_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.person_matricula?.includes(searchTerm) ||
      r.environment?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.sector && r.sector.toLowerCase().includes(searchTerm.toLowerCase()));
    return inRange && matchesSearch;
  });

  const filteredRestockHistory = restockHistory.filter(h => {
    const restockDate = new Date(h.date);
    const inRange = restockDate >= new Date(startDate + "T00:00:00") && restockDate <= new Date(endDate + "T23:59:59");
    const supply = supplies.find(s => s.id === h.supply_id);
    const matchesSearch = supply?.name.toLowerCase().includes(searchTerm.toLowerCase());
    return inRange && matchesSearch;
  });

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
            <Plus size={20} className="text-indigo-600" /> Cadastrar Insumo
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex p-1.5 bg-gray-100/80 backdrop-blur-sm rounded-2xl mb-8 w-fit border border-gray-200 shadow-inner">
        <button
          onClick={() => setActiveSubTab('estoque')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeSubTab === 'estoque'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Truck size={18} /> Consultar Estoque
        </button>
        <button
          onClick={() => setActiveSubTab('historico')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeSubTab === 'historico'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <History size={18} /> Histórico de Movimentações
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

          {activeSubTab === 'historico' && (
            <button
              onClick={() => {
                setTempStartDate(startDate);
                setTempEndDate(endDate);
                setShowFilterModal(true);
              }}
              className="group flex items-center gap-3 text-sm font-bold text-gray-500 bg-white px-5 py-3 rounded-2xl border-2 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all shadow-sm active:scale-95"
            >
              <Filter size={18} className="text-indigo-600 group-hover:scale-110 transition-transform" />
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] uppercase tracking-wider text-gray-400">Filtrar por Período</span>
                <span className="text-gray-700">
                  {new Date(startDate + "T12:00:00").toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - {new Date(endDate + "T12:00:00").toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-2 sm:p-6 overflow-x-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
              <p className="text-gray-500 font-medium">Carregando informações...</p>
            </div>
          ) : activeSubTab === 'estoque' ? (
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr className="text-gray-400 text-xs font-black uppercase tracking-widest px-6">
                  <th className="px-6 py-4">Item</th>
                  <th className="px-6 py-4">Quantidade</th>
                  <th className="px-6 py-4">Unidade</th>
                  <th className="px-6 py-4">Setor</th>
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
                      <div className={`text-lg font-black ${supply.quantity <= (supply.low_stock_threshold || 5) ? 'text-amber-600' : 'text-indigo-600'}`}>
                        {supply.quantity}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold uppercase">
                        {supply.unit}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-gray-500 font-bold">
                        {supply.setor_id ? (setores.find(s => s.id === supply.setor_id)?.name || '---') : '---'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {supply.quantity <= 0 ? (
                        <div className="flex items-center gap-2 w-fit px-3 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-bold ring-1 ring-red-100 uppercase">
                          <AlertCircle size={14} /> Sem Estoque
                        </div>
                      ) : supply.quantity <= (supply.low_stock_threshold || 5) ? (
                        <div className="flex items-center gap-2 w-fit px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold ring-1 ring-amber-100 uppercase">
                          <AlertCircle size={14} /> Estoque Baixo
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-fit px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold ring-1 ring-emerald-100 uppercase">
                          <CheckCircle2 size={14} /> Em Dia
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openEditSupply(supply)}
                          className="p-2.5 text-indigo-600 hover:text-white hover:bg-indigo-600 rounded-xl transition-all shadow-sm border border-indigo-100 bg-white"
                          title="Ajustar"
                        >
                          <Sliders size={20} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => { setSupplyToDelete(supply); setShowDeleteConfirm(true); }}
                            className="p-2.5 text-red-500 hover:text-white hover:bg-red-500 rounded-xl transition-all shadow-sm border border-red-100 bg-white"
                            title="Excluir"
                            disabled={deletingSupplyId === supply.id}
                          >
                            {deletingSupplyId === supply.id ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="space-y-8">
              <div className="flex p-1 bg-gray-50 rounded-2xl w-fit border border-gray-100">
                <button
                  onClick={() => setHistoryMode('saida')}
                  className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${historyMode === 'saida' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Saídas (Entregas)
                </button>
                <button
                  onClick={() => setHistoryMode('entrada')}
                  className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${historyMode === 'entrada' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Entradas
                </button>
              </div>

              {historyMode === 'saida' ? (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <TrendingDown size={20} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Histórico de Distribuições</h3>
                  </div>
                  <table className="w-full text-left border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-gray-400 text-xs font-black uppercase tracking-widest px-6">
                        <th className="px-6 py-4">Destinatário / Local</th>
                        <th className="px-6 py-4">Item</th>
                        <th className="px-6 py-4">Setor</th>
                        <th className="px-6 py-4">Qtd</th>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map(record => (
                        <tr key={record.id} className="group bg-white hover:bg-indigo-50/30 transition-all duration-300 rounded-2xl shadow-sm border border-gray-100 animate-fade-in-up">
                          <td className={`px-6 py-5 ${record.cancelled_at ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform ${record.cancelled_at ? 'bg-gray-100' : 'bg-indigo-50'}`}>
                                {record.environment ? <Building2 size={20} /> : <UserIcon size={20} />}
                              </div>
                              <div>
                                <div className={`font-bold text-gray-900 group-hover:text-indigo-700 transition-colors uppercase ${record.cancelled_at ? 'line-through' : ''}`}>
                                  {record.person_name || record.environment}
                                </div>
                                <div className="text-xs text-gray-400 font-medium whitespace-nowrap">
                                  {record.person_matricula || 'DISTR. AMBIENTE'}
                                </div>
                                {record.cancelled_at && (
                                  <div className="text-[10px] text-red-500 font-bold mt-1 bg-red-50 px-2 py-0.5 rounded-md w-fit ring-1 ring-red-100 uppercase">
                                    Cancelado por: {record.cancelled_by}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={`px-6 py-5 ${record.cancelled_at ? 'opacity-50' : ''}`}>
                            <div className={`font-bold text-gray-800 uppercase ${record.cancelled_at ? 'line-through' : ''}`}>
                              {supplies.find(s => s.id === record.item_id)?.name || 'Item Excluído'}
                            </div>
                          </td>
                          <td className={`px-6 py-5 ${record.cancelled_at ? 'opacity-50' : ''}`}>
                            <span className="text-xs text-gray-500 font-bold">
                              {record.setor_id ? (setores.find(s => s.id === record.setor_id)?.name || '---') : '---'}
                            </span>
                          </td>
                          <td className={`px-6 py-5 ${record.cancelled_at ? 'opacity-50' : ''}`}>
                            <div className={`w-fit px-3 py-1 text-white rounded-lg text-sm font-black shadow-sm ${record.cancelled_at ? 'bg-gray-400' : 'bg-indigo-600'}`}>
                              {record.quantity}
                            </div>
                          </td>
                          <td className={`px-6 py-5 ${record.cancelled_at ? 'opacity-50' : ''}`}>
                            <div className="text-sm font-medium text-gray-500">
                              {new Date(record.date).toLocaleDateString('pt-BR')}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            {!record.cancelled_at && (
                              <button
                                onClick={() => handleCancelRecord(record)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                title="Cancelar entrega"
                              >
                                <XCircle size={18} />
                              </button>
                            )}
                            {record.cancelled_at && (
                               <div className="text-red-500 opacity-60">
                                 <XCircle size={18} className="mx-auto" />
                               </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredRecords.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-20 text-center text-gray-400 font-medium">Nenhuma distribuição registrada.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Plus size={20} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Histórico de Entradas</h3>
                  </div>
                  <table className="w-full text-left border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-gray-400 text-xs font-black uppercase tracking-widest px-6">
                        <th className="px-6 py-4">Item</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4">Qtd Adicionada</th>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRestockHistory.map(history => {
                        const isInitial = history.note === 'Estoque Inicial';
                        return (
                        <tr key={history.id} className="group bg-white hover:bg-emerald-50/30 transition-all duration-300 rounded-2xl shadow-sm border border-gray-100 animate-fade-in-up">
                          <td className={`px-6 py-5 ${history.cancelled_at ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                                history.cancelled_at ? 'bg-gray-100 text-gray-400' : 
                                history.note?.includes('Ajuste') ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                              }`}>
                                <Layers size={20} />
                              </div>
                              <div>
                                <div className={`font-bold text-gray-900 uppercase ${history.cancelled_at ? 'line-through' : ''}`}>
                                  {supplies.find(s => s.id === history.supply_id)?.name || 'Item Excluído'}
                                </div>
                                {history.cancelled_at && (
                                  <div className="text-[10px] text-red-500 font-bold mt-1 bg-red-50 px-2 py-0.5 rounded-md w-fit ring-1 ring-red-100 uppercase">
                                    Cancelado por: {history.cancelled_by}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={`px-6 py-5 ${history.cancelled_at ? 'opacity-50' : ''}`}>
                            {history.note?.includes('Ajuste') ? (
                              <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-black ring-1 uppercase tracking-wide ${history.cancelled_at ? 'bg-gray-100 text-gray-400 ring-gray-200' : 'bg-amber-50 text-amber-700 ring-amber-100'}`}>
                                Ajuste
                              </span>
                            ) : (
                              <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-black ring-1 uppercase tracking-wide ${history.cancelled_at ? 'bg-gray-100 text-gray-400 ring-gray-200' : 'bg-blue-50 text-blue-700 ring-blue-100'}`}>
                                Entrada
                              </span>
                            )}
                          </td>
                          <td className={`px-6 py-5 ${history.cancelled_at ? 'opacity-50' : ''}`}>
                            <div className={`w-fit px-3 py-1 text-white rounded-lg text-sm font-black shadow-sm ${
                              history.cancelled_at ? 'bg-gray-400' : 
                              history.quantity_added < 0 ? 'bg-red-500' :
                              history.note?.includes('Ajuste') ? 'bg-emerald-600' : 'bg-blue-600'
                            }`}>
                              {history.quantity_added >= 0 ? `+${history.quantity_added}` : history.quantity_added}
                            </div>
                          </td>
                          <td className={`px-6 py-5 ${history.cancelled_at ? 'opacity-50' : ''}`}>
                            <div className="text-sm font-medium text-gray-500">
                              {new Date(history.date).toLocaleDateString('pt-BR')} {new Date(history.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            {!history.cancelled_at && (
                              <button
                                onClick={() => handleCancelRestock(history)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                title="Cancelar entrada"
                              >
                                <XCircle size={18} />
                              </button>
                            )}
                            {history.cancelled_at && (
                               <div className="text-red-500 opacity-60">
                                 <XCircle size={18} className="mx-auto" />
                               </div>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                      {filteredRestockHistory.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-20 text-center text-gray-400 font-medium">Nenhuma entrada encontrada no período selecionado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                </div>
              )}
            </div>
          )}

          {!loading && ((activeSubTab === 'estoque' && filteredSupplies.length === 0) || (activeSubTab === 'historico' && ((historyMode === 'saida' && filteredRecords.length === 0) || (historyMode === 'entrada' && restockHistory.length === 0)))) && (
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

      {/* Modal de Filtro de Período */}
      <Modal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title=""
      >
        <div className="space-y-6 max-w-sm mx-auto">
          <div className="text-center pb-6 border-b border-gray-100">
            <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 text-indigo-600">
              <Calendar size={32} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-1">Filtrar Período</h3>
            <p className="text-sm text-gray-500 font-medium">Selecione o intervalo de datas</p>
          </div>

          {/* Calendário Customizado */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6 px-2">
              <button
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-indigo-600"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="text-sm font-black text-gray-900 uppercase tracking-widest">
                {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(viewDate)}
              </div>
              <button
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-indigo-600"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (
                <div key={day} className="text-[10px] font-black text-gray-400 uppercase text-center pb-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const days = [];
                const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
                const firstDay = d.getDay();
                const totalDays = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();

                // Empty slots for previous month
                for (let i = 0; i < firstDay; i++) {
                  days.push(<div key={`empty-${i}`} />);
                }

                // Days of current month
                for (let i = 1; i <= totalDays; i++) {
                  const dayDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), i);
                  const dayStr = dayDate.toISOString().split('T')[0];
                  const isStart = tempStartDate === dayStr;
                  const isEnd = tempEndDate === dayStr;
                  const isInRange = tempStartDate && tempEndDate && dayStr > tempStartDate && dayStr < tempEndDate;

                  days.push(
                    <button
                      key={i}
                      onClick={() => {
                        if (!tempStartDate || (tempStartDate && tempEndDate)) {
                          setTempStartDate(dayStr);
                          setTempEndDate('');
                        } else {
                          if (dayStr < tempStartDate) {
                            setTempStartDate(dayStr);
                          } else {
                            setTempEndDate(dayStr);
                          }
                        }
                      }}
                      className={`
                        relative h-10 w-full rounded-xl text-sm font-bold transition-all
                        ${isStart || isEnd ? 'bg-indigo-600 text-white shadow-md z-10' : ''}
                        ${isInRange ? 'bg-indigo-50 text-indigo-600 rounded-none' : ''}
                        ${!isStart && !isEnd && !isInRange ? 'text-gray-600 hover:bg-gray-100' : ''}
                        ${isStart && tempEndDate ? 'rounded-r-none' : ''}
                        ${isEnd ? 'rounded-l-none' : ''}
                      `}
                    >
                      {i}
                    </button>
                  );
                }
                return days;
              })()}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs px-2">
              <div className="flex flex-col">
                <span className="text-gray-400 font-medium uppercase tracking-wider">Início</span>
                <span className="font-black text-gray-800">{tempStartDate ? new Date(tempStartDate + "T12:00:00").toLocaleDateString('pt-BR') : '---'}</span>
              </div>
              <ArrowRight className="text-indigo-300" size={16} />
              <div className="flex flex-col text-right">
                <span className="text-gray-400 font-medium uppercase tracking-wider">Fim</span>
                <span className="font-black text-gray-800">{tempEndDate ? new Date(tempEndDate + "T12:00:00").toLocaleDateString('pt-BR') : '---'}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const d = new Date();
                  setTempStartDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]);
                  setTempEndDate(new Date().toISOString().split('T')[0]);
                }}
                className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Mês Atual
              </button>
              <button
                disabled={!tempStartDate || !tempEndDate}
                onClick={() => {
                  setStartDate(tempStartDate);
                  setEndDate(tempEndDate);
                  setShowFilterModal(false);
                }}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-100"
              >
                APLICAR FILTRO
              </button>
            </div>
          </div>
        </div>
      </Modal>

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
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${deliveryMode === 'pessoa' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Pessoa
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode('ambiente')}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${deliveryMode === 'ambiente' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
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

      <Modal isOpen={showSupplyModal} onClose={() => setShowSupplyModal(false)} title="">
        <form onSubmit={handleSaveSupply} className="space-y-6">
          <div className="text-center pb-6 border-b border-gray-100">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
              <Layers size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-1">
              {editingSupply ? 'Editar Item' : restockMode === 'reposicao' ? 'Entrada de Estoque' : 'Novo Insumo'}
            </h3>
            <p className="text-sm text-gray-500 font-medium">Cadastre ou ajuste materiais para distribuição</p>
          </div>

          <div className="space-y-4">
            {/* Restock Mode Toggle - Only for new registrations */}
            {!editingSupply && (
              <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                <button
                  type="button"
                  onClick={() => { setRestockMode('novo'); resetSupplyForm(); }}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${restockMode === 'novo' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  Novo Item
                </button>
                <button
                  type="button"
                  onClick={() => { setRestockMode('reposicao'); resetSupplyForm(); }}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${restockMode === 'reposicao' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  Entrada
                </button>
              </div>
            )}

            {restockMode === 'reposicao' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Selecionar Item Existente</label>
                  <select
                    required
                    value={selectedItemId}
                    onChange={e => setSelectedItemId(e.target.value)}
                    className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-bold text-indigo-900"
                  >
                    <option value="">Selecione um item...</option>
                    {supplies.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.quantity} {s.unit} atuais)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Quantidade Adicionada</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={supplyQuantity}
                    onChange={e => setSupplyQuantity(Number(e.target.value))}
                    className="w-full bg-indigo-50/50 border-2 border-indigo-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-black text-indigo-600"
                  />
                </div>
              </div>
            ) : !editingSupply ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Itens para Cadastrar</label>
                </div>
                {bulkItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-2xl border border-gray-100 relative group/row">
                    <div className="flex-1">
                      <input
                        type="text"
                        required
                        value={item.name}
                        onChange={e => handleBulkItemChange(index, 'name', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-bold placeholder:text-gray-300"
                        placeholder="Nome..."
                      />
                    </div>
                    <div className="w-28">
                      <select
                        required
                        value={item.unit}
                        onChange={e => handleBulkItemChange(index, 'unit', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2.5 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-bold"
                      >
                        <option value="Unidade">Unid</option>
                        <option value="Caixa">Caixa</option>
                        <option value="Pacote">Pct</option>
                        <option value="Resma">Resma</option>
                        <option value="Kilo">Kilo</option>
                      </select>
                    </div>
                    <div className="w-20">
                      <input
                        type="number"
                        required
                        min="0"
                        value={item.quantity}
                        onChange={e => handleBulkItemChange(index, 'quantity', Number(e.target.value))}
                        className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2.5 text-sm text-center focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-black text-indigo-600"
                        placeholder="Qtd..."
                      />
                    </div>
                    {bulkItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBulkItem(index)}
                        className="absolute -right-2 top-1/2 -translate-y-1/2 p-1.5 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-all opacity-0 group-hover/row:opacity-100 translate-x-2 group-hover/row:translate-x-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addBulkItem}
                  className="w-full py-3 border-2 border-dashed border-gray-200 text-gray-500 font-bold rounded-2xl flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all text-sm"
                >
                  <Plus size={18} /> Adicionar outro item
                </button>
                
                <div className="space-y-2 p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                  <label className="flex items-center gap-2 text-xs font-black text-amber-600 uppercase tracking-widest mb-1 ml-1">
                    <AlertCircle size={14} /> Alerta de Estoque Baixo (Global)
                  </label>
                  <p className="text-[10px] text-amber-500 font-bold mb-3 ml-1">Aplicado a todos os itens acima:</p>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={supplyThreshold}
                      onChange={e => setSupplyThreshold(Number(e.target.value))}
                      className="flex-1 h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="w-16 text-center font-black text-amber-700 bg-white px-2 py-1 rounded-lg border border-amber-200 shadow-sm">
                      {supplyThreshold}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nome do Item</label>
                  <input
                    type="text"
                    required
                    value={supplyName}
                    onChange={e => setSupplyName(e.target.value)}
                    className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-bold placeholder:text-gray-300"
                    placeholder="Ex: Resma, Piloto, Apagador..."
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
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Estoque Atual</label>
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

                <div className="space-y-2 p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                  <label className="flex items-center gap-2 text-xs font-black text-amber-600 uppercase tracking-widest mb-1 ml-1">
                    <AlertCircle size={14} /> Alerta de Estoque Baixo
                  </label>
                  <p className="text-[10px] text-amber-500 font-bold mb-3 ml-1">Considere estoque baixo quando for menor ou igual a:</p>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={supplyThreshold}
                      onChange={e => setSupplyThreshold(Number(e.target.value))}
                      className="flex-1 h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="w-16 text-center font-black text-amber-700 bg-white px-2 py-1 rounded-lg border border-amber-200 shadow-sm">
                      {supplyThreshold}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {isAdmin && setores.length > 0 && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-3">
              <label className="flex items-center gap-2 text-xs font-black text-amber-600 uppercase tracking-widest">
                <Building2 size={14} /> Setor
              </label>
              <select
                value={selectedSetorId}
                onChange={e => setSelectedSetorId(e.target.value)}
                className="w-full bg-white border-2 border-amber-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-bold"
              >
                <option value="">Selecione um setor...</option>
                {setores.filter(s => s.campus_id === campusId).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

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
              {restockMode === 'reposicao' ? 'Adicionar Estoque' : 'Salvar Insumo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setSupplyToDelete(null); }} title="Confirmar Exclusão">
        {supplyToDelete && (
          <div className="space-y-6">
            <p className="text-gray-600">
              Tem certeza que deseja excluir <strong>{supplyToDelete.name}</strong>?
              {supplyToDelete.quantity > 0 && (
                <span className="block mt-2 text-amber-600 text-sm font-bold">
                  ⚠️ Este insumo possui {supplyToDelete.quantity} {supplyToDelete.unit}(s) em estoque.
                </span>
              )}
            </p>
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => { setShowDeleteConfirm(false); setSupplyToDelete(null); }}
                className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteSupply}
                disabled={!!deletingSupplyId}
                className="flex-[2] py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {deletingSupplyId ? <><Loader2 size={18} className="animate-spin" /> Excluindo...</> : <><Trash2 size={18} /> Sim, Excluir</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InsumosTab;
