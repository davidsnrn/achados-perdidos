import React, { useState, useMemo } from 'react';
import { CopyRecord, CopyConfig, User, Campus, UserLevel, PersonType, Person } from '../../types';
import { StorageService } from '../../services/storage';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Settings, 
  Printer, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  MoreHorizontal, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Building2,
  Table as TableIcon,
  PieChart,
  Save
} from 'lucide-react';
import { Modal } from '../ui/Modal';

interface CopyControlTabProps {
  records: CopyRecord[];
  config?: CopyConfig;
  user: User | null;
  campuses: Campus[];
  adminGlobalCampusId: string | null;
  onUpdate: () => Promise<void>;
}

export const CopyControlTab: React.FC<CopyControlTabProps> = ({
  records,
  config,
  user,
  campuses,
  adminGlobalCampusId,
  onUpdate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Period Logic
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // New Record Form State
  const [newRecord, setNewRecord] = useState<Partial<CopyRecord>>({
    print_type: 'OUTRAS',
    quantity: 1,
    date: new Date().toISOString()
  });
  const [personSearch, setPersonSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  // Calculate period dates
  const periodRange = useMemo(() => {
    const startDay = config?.start_day || 13;
    const endDay = config?.end_day || 12;
    
    // Start date: Day X of previous month
    const startDate = new Date(selectedYear, selectedMonth - 1, startDay, 0, 0, 0);
    // End date: Day Y of current month
    const endDate = new Date(selectedYear, selectedMonth, endDay, 23, 59, 59);
    
    return { start: startDate, end: endDate };
  }, [selectedMonth, selectedYear, config]);

  // Filter records by period and search term
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const recordDate = new Date(record.date);
      const isInPeriod = recordDate >= periodRange.start && recordDate <= periodRange.end;
      
      const matchesSearch = 
        record.person_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.person_matricula.includes(searchTerm) ||
        record.sector?.toLowerCase().includes(searchTerm.toLowerCase());
        
      return isInPeriod && matchesSearch;
    });
  }, [records, periodRange, searchTerm]);

  // Totals
  const totals = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => {
      if (curr.print_type === 'PROVA') acc.prova += curr.quantity;
      else acc.outras += curr.quantity;
      acc.total += curr.quantity;
      return acc;
    }, { prova: 0, outras: 0, total: 0 });
  }, [filteredRecords]);

  // Config State
  const [tempConfig, setTempConfig] = useState({
    start_day: config?.start_day || 13,
    end_day: config?.end_day || 12
  });

  const handleSaveConfig = async () => {
    if (!user?.campus_id && !adminGlobalCampusId) return;
    setIsSaving(true);
    try {
      await StorageService.saveCopyConfig({
        campus_id: adminGlobalCampusId || user!.campus_id!,
        start_day: tempConfig.start_day,
        end_day: tempConfig.end_day
      });
      await onUpdate();
      setIsConfigModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar configuração.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePersonSearch = async (val: string) => {
    setPersonSearch(val);
    if (val.length >= 2) {
      const results = await StorageService.searchPeople(val, 5, adminGlobalCampusId || user?.campus_id || undefined);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectPerson = (p: Person) => {
    setSelectedPerson(p);
    setNewRecord(prev => ({
      ...prev,
      person_id: p.id,
      person_name: p.name,
      person_matricula: p.matricula
    }));
    setSearchResults([]);
    setPersonSearch('');
  };

  const handleSaveRecord = async () => {
    if (!newRecord.person_name || !newRecord.quantity) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }
    
    setIsSaving(true);
    try {
      await StorageService.saveCopyRecord({
        ...newRecord,
        campus_id: adminGlobalCampusId || user!.campus_id!,
        operator_id: user!.id
      });
      await onUpdate();
      setIsModalOpen(false);
      setNewRecord({
        print_type: 'OUTRAS',
        quantity: 1,
        date: new Date().toISOString()
      });
      setSelectedPerson(null);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar registro.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este registro?")) return;
    try {
      await StorageService.deleteCopyRecord(id);
      await onUpdate();
    } catch (error) {
      console.error(error);
    }
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header & Stats */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-rose-100/50 p-8 border border-rose-50 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl text-white shadow-lg shadow-rose-200">
                <Printer size={28} />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Controle de Cópias</h1>
            </div>
            <p className="text-gray-500 font-medium">Gestão de impressões e quotas por período</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center bg-gray-50 p-1.5 rounded-2xl border border-gray-100 shadow-sm">
              <button 
                onClick={() => {
                  if (selectedMonth === 0) {
                    setSelectedMonth(11);
                    setSelectedYear(v => v - 1);
                  } else {
                    setSelectedMonth(v => v - 1);
                  }
                }}
                className="p-2 hover:bg-white hover:text-rose-600 rounded-xl transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="px-4 font-bold text-gray-700 min-w-[140px] text-center">
                {months[selectedMonth]} {selectedYear}
              </div>
              <button 
                onClick={() => {
                  if (selectedMonth === 11) {
                    setSelectedMonth(0);
                    setSelectedYear(v => v + 1);
                  } else {
                    setSelectedMonth(v => v + 1);
                  }
                }}
                className="p-2 hover:bg-white hover:text-rose-600 rounded-xl transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-rose-200 hover:shadow-rose-300 hover:-translate-y-0.5 transition-all"
            >
              <Plus size={20} /> NOVO REGISTRO
            </button>

            {user?.level === UserLevel.ADMIN && (
              <button 
                onClick={() => setIsConfigModalOpen(true)}
                className="p-3.5 bg-white text-gray-600 hover:text-rose-600 border-2 border-gray-100 rounded-2xl hover:border-rose-200 transition-all shadow-sm"
                title="Configurações de Período"
              >
                <Settings size={22} />
              </button>
            )}
          </div>
        </div>

        {/* Dash Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          <div className="bg-gradient-to-br from-rose-50 to-white p-6 rounded-[2rem] border border-rose-100 shadow-sm transition-all hover:shadow-md group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white text-rose-600 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <span className="text-[10px] font-black tracking-widest text-rose-300 uppercase">Provas</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-4xl font-black text-gray-900">{totals.prova}</h3>
              <p className="text-xs font-bold text-gray-400">Total de cópias em provas</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-[2rem] border border-amber-100 shadow-sm transition-all hover:shadow-md group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white text-amber-600 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                <PieChart size={24} />
              </div>
              <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase">Outras</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-4xl font-black text-gray-900">{totals.outras}</h3>
              <p className="text-xs font-bold text-gray-400">Trabalhos, apostilas e outros</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-[2rem] shadow-xl shadow-gray-200 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <TrendingUp size={120} />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="p-3 bg-white/10 text-white rounded-2xl backdrop-blur-md group-hover:scale-110 transition-transform">
                <TrendingUp size={24} />
              </div>
              <span className="text-[10px] font-black tracking-widest text-white/30 uppercase">Consumo Geral</span>
            </div>
            <div className="space-y-1 relative z-10">
              <h3 className="text-4xl font-black text-white">{totals.total}</h3>
              <p className="text-xs font-bold text-white/50">Total geral no período</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-rose-600 transition-colors" size={20} />
            <input 
              type="text"
              placeholder="Pesquisar por nome, matrícula ou setor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-sm text-gray-700 shadow-inner"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 rounded-xl text-rose-700 text-xs font-bold border border-rose-100 italic">
              <Calendar size={14} />
              Periodo: {periodRange.start.toLocaleDateString()} - {periodRange.end.toLocaleDateString()}
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border-2 border-gray-100 rounded-xl text-gray-500 hover:text-rose-600 hover:border-rose-200 transition-all font-bold text-xs uppercase tracking-wide">
              <Download size={16} /> Exportar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Informações do Solicitante</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo / Finalidade</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantidade</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data / Registro</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRecords.length > 0 ? filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center text-indigo-500 font-black shadow-sm">
                        {record.person_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 group-hover:text-rose-600 transition-colors">{record.person_name}</p>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 mt-1">
                          <span className="bg-gray-100 px-2 py-0.5 rounded-md">{record.person_matricula}</span>
                          <span className="flex items-center gap-1"><Building2 size={10} /> {record.sector || 'Sem Setor'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                      record.print_type === 'PROVA' 
                        ? 'bg-rose-100 text-rose-700 shadow-sm shadow-rose-100' 
                        : 'bg-amber-100 text-amber-700 shadow-sm shadow-amber-100'
                    }`}>
                      <Printer size={12} /> {record.print_type}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xl font-black text-gray-800 tracking-tight">{record.quantity}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">UNID</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase">
                        <Calendar size={12} className="text-gray-400" />
                        {new Date(record.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-tighter">
                        <Clock size={12} />
                        {new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-center gap-2">
                       <button 
                        onClick={() => handleDeleteRecord(record.id)}
                        className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="max-w-xs mx-auto">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-gray-100">
                        <TableIcon size={24} className="text-gray-300" />
                      </div>
                      <h3 className="text-lg font-black text-gray-800 mb-2">Sem registros</h3>
                      <p className="text-sm text-gray-500 mb-6">Nenhuma cópia registrada para este período ou busca.</p>
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="text-rose-600 font-bold hover:underline"
                      >
                        Clique aqui para adicionar
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW RECORD MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="">
        <div className="space-y-6">
          <div className="text-center pb-6 border-b border-gray-100">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-rose-200">
              <Printer size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Novo Registro de Cópia</h3>
            <p className="text-sm text-gray-500 font-medium">Preencha os dados do solicitante e quantidade</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Person Search */}
            <div className="space-y-3 relative">
              <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <UserIcon size={16} className="text-rose-500" />
                Dono(a) das Cópias
              </label>
              {selectedPerson ? (
                <div className="flex items-center justify-between p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-rose-600 font-black shadow-sm">
                      {selectedPerson.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{selectedPerson.name}</p>
                      <p className="text-xs text-rose-400 font-medium">{selectedPerson.matricula}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedPerson(null)}
                    className="p-2 hover:bg-white hover:text-rose-600 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-rose-600 transition-colors" size={18} />
                  <input 
                    type="text"
                    placeholder="Nome ou Matrícula..."
                    value={personSearch}
                    onChange={e => handlePersonSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-sm"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-xl mt-2 overflow-hidden z-[100] border-t-0 animate-in fade-in slide-in-from-top-2 duration-300">
                      {searchResults.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => handleSelectPerson(p)}
                          className="w-full p-4 hover:bg-rose-50 flex items-center justify-between transition-colors border-b border-gray-50 last:border-0"
                        >
                          <div className="text-left">
                            <p className="font-bold text-gray-800 text-sm uppercase">{p.name}</p>
                            <p className="text-xs text-gray-400 font-medium">{p.matricula} • {p.type}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                  <PieChart size={16} className="text-rose-500" />
                  Finalidade
                </label>
                <select 
                  value={newRecord.print_type}
                  onChange={e => setNewRecord(v => ({ ...v, print_type: e.target.value as any }))}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-sm text-gray-700 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNhYWFhYWEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNiA5bDYgNiA2LTYiLz48L3N2Zz4=')] bg-no-repeat bg-[right_1rem_center]"
                >
                  <option value="PROVA">PROVA</option>
                  <option value="OUTRAS">OUTRAS</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={16} className="text-rose-500" />
                  Quantidade
                </label>
                <input 
                  type="number"
                  min="1"
                  value={newRecord.quantity}
                  onChange={e => setNewRecord(v => ({ ...v, quantity: parseInt(e.target.value) }))}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-black text-lg text-rose-700 text-center"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <Building2 size={16} className="text-rose-500" />
                Setor / Destino
              </label>
              <input 
                type="text"
                placeholder="Ex: Coordenação, Biblioteca..."
                value={newRecord.sector || ''}
                onChange={e => setNewRecord(v => ({ ...v, sector: e.target.value }))}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-sm text-gray-700"
              />
            </div>

            <div className="pt-6 border-t border-gray-100 flex gap-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-6 py-4 bg-gray-50 text-gray-400 hover:text-gray-700 rounded-2xl font-black transition-all text-xs uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveRecord}
                disabled={isSaving}
                className="flex-[2] px-6 py-4 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-2xl font-black shadow-lg shadow-rose-200 hover:shadow-rose-400 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Save size={20} /> Salvar Registro
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* CONFIG MODAL */}
      <Modal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} title="">
        <div className="space-y-6">
          <div className="text-center pb-6 border-b border-gray-100">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
              <Settings size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Configurar Período</h3>
            <p className="text-sm text-gray-500 font-medium">Defina os dias de corte do mês</p>
          </div>

          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3 text-amber-700">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-xs font-bold leading-relaxed">
              Dica: Se o período for do dia 13 ao dia 12 do mês seguinte, configure Dia de Início as 13 e Dia de Fim como 12.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" />
                Dia de Início
              </label>
              <input 
                type="number"
                min="1"
                max="31"
                value={tempConfig.start_day}
                onChange={e => setTempConfig(v => ({ ...v, start_day: parseInt(e.target.value) }))}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white rounded-2xl outline-none transition-all font-black text-lg text-indigo-700 text-center"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" />
                Dia de Fim
              </label>
              <input 
                type="number"
                min="1"
                max="31"
                value={tempConfig.end_day}
                onChange={e => setTempConfig(v => ({ ...v, end_day: parseInt(e.target.value) }))}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white rounded-2xl outline-none transition-all font-black text-lg text-indigo-700 text-center"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex gap-4">
            <button 
              onClick={() => setIsConfigModalOpen(false)}
              className="flex-1 px-6 py-4 bg-gray-50 text-gray-400 hover:text-gray-700 rounded-2xl font-black transition-all text-xs uppercase tracking-widest"
            >
              Fechar
            </button>
            <button 
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="flex-[2] px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 hover:shadow-indigo-400 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save size={20} /> Salvar Configuração
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CopyControlTab;

