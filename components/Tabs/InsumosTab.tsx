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
  const [recipientSector, setRecipientSector] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [recordQuantity, setRecordQuantity] = useState(1);
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [personSearchResults, setPersonSearchResults] = useState<Person[]>([]);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  
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
        person_name: recipientName,
        person_matricula: recipientMatricula,
        sector: recipientSector,
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
    setRecipientSector('');
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
    r.person_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.person_matricula.includes(searchTerm) ||
    (r.sector && r.sector.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Person Search Logic (simplified for now, ideally debounced)
  const handlePersonSearch = async (val: string) => {
    setRecipientMatricula(val);
    if (val.length >= 3) {
      const { data } = await supabase
        .from('people')
        .select('*')
        .or(`matricula.ilike.%${val}%,name.ilike.%${val}%`)
        .limit(5);
      setPersonSearchResults(data || []);
      setShowPersonDropdown(true);
    } else {
      setShowPersonDropdown(false);
    }
  };

  const selectPerson = (p: Person) => {
    setRecipientName(p.name);
    setRecipientMatricula(p.matricula);
    setShowPersonDropdown(false);
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
                  <th className="px-6 py-4">Destinatário</th>
                  <th className="px-6 py-4">Setor</th>
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
                          <UserIcon size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors uppercase">{record.person_name}</div>
                          <div className="text-xs text-gray-400 font-medium">{record.person_matricula}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold uppercase">
                        {record.sector || 'N/A'}
                      </span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
              {filteredSupplies.map(supply => (
                <div key={supply.id} className="group p-6 bg-white border-2 border-gray-100 rounded-[2rem] hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-50 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 p-8 text-gray-50 group-hover:text-indigo-50 transition-colors pointer-events-none">
                    <Truck size={80} strokeWidth={1} />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                      <Layers size={24} />
                    </div>
                    <h3 className="text-xl font-black text-gray-800 mb-2 truncate group-hover:text-indigo-700">{supply.name}</h3>
                    <div className="flex items-end gap-2 mb-6">
                      <span className={`text-4xl font-black ${supply.quantity <= 5 ? 'text-amber-600' : 'text-indigo-600'}`}>
                        {supply.quantity}
                      </span>
                      <span className="text-sm font-bold text-gray-400 mb-1.5 uppercase">{supply.unit}</span>
                    </div>

                    {supply.quantity <= 5 && (
                      <div className="flex items-center gap-2 mb-6 p-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold ring-1 ring-amber-100">
                        <AlertCircle size={14} /> ESTOQUE BAIXO
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button 
                        onClick={() => openEditSupply(supply)}
                        className="flex-1 py-2.5 bg-gray-50 hover:bg-indigo-600 hover:text-white text-gray-600 text-xs font-black rounded-xl transition-all uppercase tracking-wider"
                      >
                        Ajustar
                      </button>
                      <button 
                        onClick={() => handleDeleteSupply(supply.id)}
                        className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 relative">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Matrícula/Busca</label>
                <input
                  type="text"
                  required
                  value={recipientMatricula}
                  onChange={e => handlePersonSearch(e.target.value)}
                  className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-medium"
                  placeholder="Matrícula..."
                />
                
                {showPersonDropdown && personSearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-scale-in">
                    {personSearchResults.map(p => (
                      <button
                        key={p.matricula}
                        type="button"
                        onClick={() => selectPerson(p)}
                        className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0"
                      >
                        <UserIcon size={16} className="text-indigo-400" />
                        <div>
                          <p className="text-xs font-black text-gray-900 uppercase">{p.name}</p>
                          <p className="text-[10px] text-gray-400">{p.matricula} • {p.type}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-medium uppercase"
                  placeholder="Nome do Recebedor..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Setor/Departamento</label>
                <input
                  type="text"
                  value={recipientSector}
                  onChange={e => setRecipientSector(e.target.value)}
                  className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all font-medium"
                  placeholder="Ex: Coordenação, Financeiro..."
                />
              </div>
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
