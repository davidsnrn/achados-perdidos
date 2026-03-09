import React, { useState, useMemo, useEffect } from 'react';
import { Locker, ViewType, LockerStatus, LoanData, MaintenanceData, Student } from '../../types-armarios';
import { Person, PersonType, UserLevel, Campus } from '../../types';
import { TOTAL_LOCKERS, generateInitialLockers } from '../../constants-armarios';
import { StorageService } from '../../services/storage';
import StatCard from '../armarios/StatCard';
import LockerForm from '../armarios/LockerForm';
import LockerDetailModal from '../armarios/LockerDetailModal';
import CSVImport from '../armarios/CSVImport';
import StudentSearch from '../armarios/StudentSearch';
import ReportsTab from '../armarios/ReportsTab';
import LockerManagement from '../armarios/LockerManagement';
import ExportTab from '../armarios/ExportTab';
import { Loader2, LayoutGrid, FileText, Settings, Key, Plus, Download, FileSpreadsheet } from 'lucide-react';

interface ArmariosTabProps {
  user: any; // User from Achados system
  lockers: Locker[];
  onUpdate: () => void;
  campuses: Campus[];
}

export const ArmariosTab: React.FC<ArmariosTabProps> = ({ user, lockers, onUpdate, campuses }) => {
  const [loading, setLoading] = useState(false);

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [lockerSearch, setLockerSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [selectedCampusId, setSelectedCampusId] = useState<string>(user?.campus_id || '');

  const isAdmin = user?.level === UserLevel.ADMIN;

  useEffect(() => {
    // Escopo inicial gerenciado pelo pai (App.tsx)
  }, []);

  const stats = useMemo(() => {
    return {
      total: lockers.length,
      available: lockers.filter(l => l.status === LockerStatus.AVAILABLE).length,
      occupied: lockers.filter(l => l.status === LockerStatus.OCCUPIED).length,
      maintenance: lockers.filter(l => l.status === LockerStatus.MAINTENANCE).length,
    };
  }, [lockers]);

  const handleImportLockers = async (newData: Locker[]) => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      // Adicionar campus_id a cada armário importado
      const lockersWithCampus = newData.map(l => ({
        ...l,
        campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id
      }));
      await StorageService.saveLockers(lockersWithCampus);

      // Atualiza o estado local mesclando ou recarregando
      onUpdate();
      setCurrentView('dashboard');
    } catch (e: any) {
      alert("Erro ao importar dados:\n" + (e.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const handleBatchGenerate = async (newLockers: Locker[]) => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const lockersWithCampus = newLockers.map(l => ({
        ...l,
        campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id
      }));
      await StorageService.saveLockers(lockersWithCampus);
      onUpdate();
      setCurrentView('dashboard');
      alert(`${newLockers.length} armários processados com sucesso!`);
    } catch (e) {
      alert("Erro ao gerar armários.");
    } finally {
      setLoading(false);
    }
  };



  const handleLockerClick = (locker: Locker) => {
    setSelectedLocker(locker);
    setShowDetail(true);
  };

  const handleStartLoan = (locker: Locker) => {
    setShowDetail(false);
    setCurrentView('loan-form');
  };

  const handleLoanSubmit = async (loan: LoanData) => {
    const updatedLocker = lockers.find(l => l.number === loan.lockerNumber);
    if (!updatedLocker) return;

    const newLockerData = {
      ...updatedLocker,
      status: LockerStatus.OCCUPIED,
      currentLoan: loan,
      campus_id: updatedLocker.campus_id || (user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id)
    };

    setLoading(true);
    try {
      await StorageService.updateSingleLocker(newLockerData);
      onUpdate();
      setCurrentView('dashboard');
      setSelectedLocker(null);
    } catch (e) {
      alert("Erro ao salvar empréstimo.");
    } finally {
      setLoading(false);
    }
  };

  const handleReturnLocker = async (lockerNumber: number) => {
    const l = lockers.find(loc => loc.number === lockerNumber);
    if (!l || !l.currentLoan) return;

    const now = new Date();
    const finishedLoan = {
      ...l.currentLoan,
      returnDate: now.toLocaleDateString('en-CA'),
      returnTime: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      returnedBy: user?.name || 'Sistema'
    };
    const updatedLocker = {
      ...l,
      status: LockerStatus.AVAILABLE,
      loanHistory: [finishedLoan, ...l.loanHistory].slice(0, 50),
      currentLoan: undefined
    } as Locker;

    setLoading(true);
    try {
      await StorageService.updateSingleLocker(updatedLocker);
      onUpdate();
      setShowDetail(false);
      setSelectedLocker(null);
    } catch (e) {
      alert("Erro ao processar devolução.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateObservation = async (lockerNumber: number, newObservation: string) => {
    const l = lockers.find(loc => loc.number === lockerNumber);
    if (!l || !l.currentLoan) return;

    const updatedLocker = { ...l, currentLoan: { ...l.currentLoan, observation: newObservation } };

    setLoading(true);
    try {
      await StorageService.updateSingleLocker(updatedLocker);
      onUpdate();
    } catch (e) {
      alert("Erro ao atualizar observação.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeLocker = async (oldNumber: number, newNumber: number) => {
    const oldLocker = lockers.find(l => l.number === oldNumber);
    const targetLocker = lockers.find(l => l.number === newNumber);

    if (!targetLocker || targetLocker.status !== LockerStatus.AVAILABLE) {
      alert('Armário de destino não disponível.');
      return;
    }
    if (!oldLocker || !oldLocker.currentLoan) return;

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const finishedOldLoan = {
      ...oldLocker.currentLoan,
      returnDate: todayStr,
      returnTime: timeStr,
      returnedBy: user?.name || 'Sistema',
      observation: `${oldLocker.currentLoan.observation || ''} (Troca para #${newNumber})`.trim()
    };

    const newLoan: LoanData = {
      ...oldLocker.currentLoan,
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      lockerNumber: newNumber,
      physicalLocation: targetLocker.location,
      loanDate: todayStr,
      loanTime: timeStr,
      loanBy: user?.name || 'Sistema',
      returnDate: oldLocker.currentLoan.returnDate,
      observation: `${oldLocker.currentLoan.observation || ''} (Troca do #${oldNumber})`.trim()
    };

    const updatedOldLocker = {
      ...oldLocker,
      status: LockerStatus.AVAILABLE,
      currentLoan: undefined,
      loanHistory: [finishedOldLoan, ...oldLocker.loanHistory].slice(0, 50)
    } as Locker;

    const updatedNewLocker = {
      ...targetLocker,
      status: LockerStatus.OCCUPIED,
      currentLoan: newLoan
    } as Locker;

    setLoading(true);
    try {
      await Promise.all([
        StorageService.updateSingleLocker(updatedOldLocker),
        StorageService.updateSingleLocker(updatedNewLocker)
      ]);
      onUpdate();
    } catch (e) {
      alert("Erro ao realizar troca.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMaintenance = async (lockerNumber: number, problem: string) => {
    const l = lockers.find(loc => loc.number === lockerNumber);
    if (!l) return;

    const newRecord: MaintenanceData = {
      problem,
      registeredAt: new Date().toLocaleDateString('en-CA'),
      registeredBy: user?.name || 'Sistema'
    };

    const updatedLocker = {
      ...l,
      status: LockerStatus.MAINTENANCE,
      maintenanceRecord: newRecord,
      maintenanceHistory: [newRecord, ...l.maintenanceHistory].slice(0, 50)
    };

    setLoading(true);
    try {
      await StorageService.updateSingleLocker(updatedLocker);
      onUpdate();
    } catch (e) {
      alert("Erro ao registrar manutenção.");
    } finally {
      setLoading(false);
    }
  };

  const handleResolveMaintenance = async (lockerNumber: number) => {
    const l = lockers.find(loc => loc.number === lockerNumber);
    if (!l || !l.maintenanceRecord) return;

    const finishedRecord: MaintenanceData = {
      ...l.maintenanceRecord,
      resolvedAt: new Date().toLocaleDateString('en-CA'),
      resolvedBy: user?.name || 'Sistema',
      solution: 'Manutenção concluída'
    };

    // Atualiza a entrada no histórico (substitui a 'ativa' pela 'concluída')
    const updatedHistory = [finishedRecord, ...l.maintenanceHistory.filter(h => h.registeredAt !== l.maintenanceRecord?.registeredAt)].slice(0, 50);

    const updatedLocker = {
      ...l,
      status: LockerStatus.AVAILABLE,
      maintenanceRecord: undefined,
      maintenanceHistory: updatedHistory
    };

    setLoading(true);
    try {
      await StorageService.updateSingleLocker(updatedLocker);
      onUpdate();
      setShowDetail(false);
    } catch (e) {
      alert("Erro ao resolver manutenção.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllLoans = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      await StorageService.clearAllLockerLoans();
      onUpdate();
      alert("Todos os empréstimos e históricos foram apagados com sucesso.");
    } catch (e) {
      alert("Erro ao limpar dados.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const normalizeText = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const renderLockerGrid = (sectionId: string, sectionLockers: Locker[]) => {
    if (collapsedSections[sectionId]) return null;
    const subset = sectionLockers.filter(l => {
      // Filtro de Status
      let matchesStatus = true;
      if (statusFilter === 'disponivel') matchesStatus = l.status === LockerStatus.AVAILABLE;
      else if (statusFilter === 'ocupado') matchesStatus = l.status === LockerStatus.OCCUPIED;
      else if (statusFilter === 'manutencao') matchesStatus = l.status === LockerStatus.MAINTENANCE;

      if (!matchesStatus) return false;

      // Filtro de Busca
      if (!lockerSearch.trim()) return true;
      const terms = normalizeText(lockerSearch).split(/\s+/).filter(t => t.length > 0);
      const lockerText = normalizeText(`
        ${l.number} 
        ${l.currentLoan?.studentName || ''} 
        ${l.currentLoan?.registrationNumber || ''} 
        ${l.currentLoan?.studentClass || ''}
      `);
      return terms.every(t => lockerText.includes(t));
    });

    return (
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5 animate-fade-in pb-4">
        {subset.sort((a, b) => a.number - b.number).map(locker => (
          <button
            key={locker.number}
            onClick={() => handleLockerClick(locker)}
            className={`aspect-square rounded-xl flex items-center justify-center transition-all transform hover:scale-110 border-2 text-sm font-black ${locker.status === LockerStatus.AVAILABLE
              ? 'bg-green-50 border-green-200 text-green-700'
              : locker.status === LockerStatus.OCCUPIED
                ? 'bg-red-50 border-red-200 text-red-600'
                : 'bg-orange-50 border-orange-200 text-orange-600'
              }`}
          >
            {locker.number}
          </button>
        ))}
      </div>
    );
  };

  const dynamicBlocks = useMemo(() => {
    const grouped: Record<string, Record<string, Locker[]>> = {};

    lockers.forEach(locker => {
      let blockName = 'Sem Bloco';
      let groupName = 'Geral';

      if (locker.location && locker.location.includes(' - ')) {
        const [b, g] = locker.location.split(' - ');
        blockName = b.trim();
        groupName = g.trim();
      } else if (locker.location) {
        blockName = locker.location.trim();
      }

      if (!grouped[blockName]) grouped[blockName] = {};
      if (!grouped[blockName][groupName]) grouped[blockName][groupName] = [];
      grouped[blockName][groupName].push(locker);
    });

    return Object.entries(grouped).map(([blockName, groups]) => ({
      name: blockName,
      sections: Object.entries(groups).map(([groupName, groupLockers]) => {
        const numbers = groupLockers.map(l => l.number);
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        return {
          id: `${blockName}-${groupName}`,
          title: groupName,
          range: [min, max],
          lockers: groupLockers
        };
      })
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [lockers]);

  return (
    <div className="bg-slate-50 text-slate-900 pb-20 font-sans rounded-3xl overflow-hidden shadow-inner">
      <div className="bg-white border-b border-slate-200 flex justify-between items-center p-4">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button onClick={() => setCurrentView('dashboard')} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${currentView === 'dashboard' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><LayoutGrid size={14} /> Painel</button>
          <button onClick={() => setCurrentView('reports')} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${currentView === 'reports' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><FileText size={14} /> Relatórios</button>
          {isAdmin && (
            <button onClick={() => setCurrentView('config')} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${currentView === 'config' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><Settings size={14} /> Configuração</button>
          )}
        </div>
      </div>

      <div className="p-4 md:p-8 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-[100] flex flex-col items-center justify-center min-h-[400px] rounded-3xl">
            <Loader2 className="animate-spin text-green-600 mb-4" size={48} />
            <p className="text-slate-600 font-black uppercase tracking-widest text-xs">Sincronizando com Supabase...</p>
          </div>
        )}

        {currentView === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Armários"
                value={stats.total}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeWidth="2" /></svg>}
                color="bg-slate-800"
                onClick={() => setStatusFilter('todos')}
                isActive={statusFilter === 'todos'}
              />
              <StatCard
                label="Vagos"
                value={stats.available}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" /></svg>}
                color="bg-green-500"
                onClick={() => setStatusFilter('disponivel')}
                isActive={statusFilter === 'disponivel'}
              />
              <StatCard
                label="Emprestados"
                value={stats.occupied}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" strokeWidth="2" /></svg>}
                color="bg-blue-500"
                onClick={() => setStatusFilter('ocupado')}
                isActive={statusFilter === 'ocupado'}
              />
              <StatCard
                label="Manutenção"
                value={stats.maintenance}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2" /></svg>}
                color="bg-orange-500"
                onClick={() => setStatusFilter('manutencao')}
                isActive={statusFilter === 'manutencao'}
              />
            </div>

            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Mapa de Armários</h2>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <input
                      type="text"
                      className="w-full bg-slate-100 border-none rounded-xl px-4 py-2 pl-10 text-sm font-bold outline-none focus:ring-2 focus:ring-green-500 transition-all placeholder:text-slate-400"
                      placeholder="Buscar número ou aluno..."
                      value={lockerSearch}
                      onChange={(e) => setLockerSearch(e.target.value)}
                    />
                    <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3" /></svg>
                  </div>
                </div>
              </div>

              <div className="space-y-12">
                {dynamicBlocks.map(block => (
                  <div key={block.name} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-0.5 flex-1 bg-slate-100"></div>
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">{block.name}</h3>
                      <div className="h-0.5 flex-1 bg-slate-100"></div>
                    </div>

                    <div className="space-y-4">
                      {block.sections.map(sec => (
                        <div key={sec.id} className="pl-6 border-l-4 border-green-500 bg-slate-50/30 rounded-r-2xl transition-all">
                          <button
                            onClick={() => toggleSection(sec.id)}
                            className="flex items-center justify-between w-full text-left py-4 group pr-4"
                          >
                            <h4 className="text-sm font-black text-slate-400 group-hover:text-slate-600 uppercase tracking-widest">
                              {sec.title} (#{sec.range[0].toString().padStart(2, '0')}-#{sec.range[1]})
                            </h4>
                            <div className={`transition-transform duration-300 ${collapsedSections[sec.id] ? 'rotate-180' : 'rotate-0'}`}>
                              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                          </button>
                          {renderLockerGrid(sec.id, sec.lockers)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'reports' && (
          <ReportsTab lockers={lockers} />
        )}


        {currentView === 'config' && isAdmin && (
          <div className="space-y-12">
            {isAdmin && (
              <div className="bg-amber-50 p-6 rounded-[1.5rem] border border-amber-200">
                <label className="block text-sm font-bold text-amber-900 mb-2 uppercase tracking-wider">Câmpus Alvo da Configuração</label>
                <select
                  value={selectedCampusId}
                  onChange={e => setSelectedCampusId(e.target.value)}
                  className="w-full bg-white border-2 border-amber-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 outline-none"
                  required
                >
                  <option value="">Selecione um Câmpus...</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <LockerManagement existingLockers={lockers} onGenerate={handleBatchGenerate} />
            <CSVImport onImportLockers={handleImportLockers} onCancel={() => setCurrentView('dashboard')} />
            <ExportTab lockers={lockers} onClearAll={handleClearAllLoans} />
          </div>
        )}

        {currentView === 'loan-form' && selectedLocker && (
          <LockerForm selectedLocker={selectedLocker} onSubmit={handleLoanSubmit} onCancel={() => setCurrentView('dashboard')} operatorName={user?.name} />
        )}
      </div>

      {showDetail && selectedLocker && (
        <LockerDetailModal
          locker={selectedLocker}
          onClose={() => setShowDetail(false)}
          onStartLoan={handleStartLoan}
          onReturnLocker={handleReturnLocker}
          onUpdateMaintenance={handleUpdateMaintenance}
          onResolveMaintenance={handleResolveMaintenance}
          onUpdateObservation={handleUpdateObservation}
        />
      )}
    </div>
  );
};
