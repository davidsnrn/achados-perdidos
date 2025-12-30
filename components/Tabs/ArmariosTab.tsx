import React, { useState, useMemo, useEffect } from 'react';
import { Locker, ViewType, LockerStatus, LoanData, MaintenanceData, Student } from '../../types-armarios';
import { Person, PersonType, UserLevel } from '../../types';
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
  people: Person[];
}

export const ArmariosTab: React.FC<ArmariosTabProps> = ({ user, people }) => {
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);

  const students = useMemo(() => {
    return people
      .filter(p => p.type === PersonType.STUDENT)
      .map(p => ({
        registration: p.matricula,
        name: p.name,
        course: '', // In the basic Person type, we don't have course, but it's used in search
        situation: 'Matriculado',
        email: ''
      }));
  }, [people]);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const isAdmin = user?.level === UserLevel.ADMIN;

  const refreshLockers = async () => {
    setLoading(true);
    const data = await StorageService.getLockers();
    if (data.length > 0) {
      setLockers(data);
    } else {
      // Se não houver dados no Supabase, tentamos ler do localStorage (Migração)
      const savedLockers = localStorage.getItem('sga_lockers_v4');
      if (savedLockers) {
        const parsed = JSON.parse(savedLockers);
        setLockers(parsed);
        // Opcionalmente salvamos no Supabase imediatamente para garantir persistência
        await StorageService.saveLockers(parsed);
      } else {
        const initial = generateInitialLockers();
        setLockers(initial);
        await StorageService.saveLockers(initial);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshLockers();
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
      // O upsert no StorageService já lida com a substituição de dados se o número for igual
      await StorageService.saveLockers(newData);

      // Atualiza o estado local mesclando ou recarregando
      await refreshLockers();
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
      await StorageService.saveLockers(newLockers);
      await refreshLockers();
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

    const newLockerData = { ...updatedLocker, status: LockerStatus.OCCUPIED, currentLoan: loan };

    setLoading(true);
    try {
      await StorageService.updateSingleLocker(newLockerData);
      setLockers(prev => prev.map(l => l.number === loan.lockerNumber ? newLockerData : l));
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

    const finishedLoan = { ...l.currentLoan, returnDate: new Date().toLocaleDateString('pt-BR') };
    const updatedLocker = {
      ...l,
      status: LockerStatus.AVAILABLE,
      loanHistory: [finishedLoan, ...l.loanHistory].slice(0, 50),
      currentLoan: undefined
    } as Locker;

    setLoading(true);
    try {
      await StorageService.updateSingleLocker(updatedLocker);
      setLockers(prev => prev.map(loc => loc.number === lockerNumber ? updatedLocker : loc));
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
      setLockers(prev => prev.map(loc => loc.number === lockerNumber ? updatedLocker : loc));
      if (selectedLocker?.number === lockerNumber) {
        setSelectedLocker(updatedLocker);
      }
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

    const todayStr = new Date().toLocaleDateString('pt-BR');
    const finishedOldLoan = {
      ...oldLocker.currentLoan,
      returnDate: todayStr,
      observation: `${oldLocker.currentLoan.observation || ''} (Troca para #${newNumber})`.trim()
    };

    const newLoan: LoanData = {
      ...oldLocker.currentLoan,
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      lockerNumber: newNumber,
      physicalLocation: targetLocker.location,
      loanDate: todayStr,
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
      setLockers(prev => prev.map(l => {
        if (l.number === oldNumber) return updatedOldLocker;
        if (l.number === newNumber) return updatedNewLocker;
        return l;
      }));
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
      registeredAt: new Date().toISOString().split('T')[0],
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
      setLockers(prev => prev.map(loc => loc.number === lockerNumber ? updatedLocker : loc));
      setSelectedLocker(updatedLocker);
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
      resolvedAt: new Date().toISOString().split('T')[0],
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
      setLockers(prev => prev.map(loc => loc.number === lockerNumber ? updatedLocker : loc));
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
      await refreshLockers();
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

  const renderLockerGrid = (sectionId: string, sectionLockers: Locker[]) => {
    if (collapsedSections[sectionId]) return null;
    const subset = sectionLockers.filter(l => {
      if (statusFilter === 'todos') return true;
      if (statusFilter === 'disponivel') return l.status === LockerStatus.AVAILABLE;
      if (statusFilter === 'ocupado') return l.status === LockerStatus.OCCUPIED;
      if (statusFilter === 'manutencao') return l.status === LockerStatus.MAINTENANCE;
      return true;
    });

    return (
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5 animate-fade-in pb-4">
        {subset.sort((a, b) => a.number - b.number).map(locker => (
          <button
            key={locker.number}
            onClick={() => handleLockerClick(locker)}
            className={`aspect-square rounded-xl flex items-center justify-center transition-all transform hover:scale-110 border-2 text-sm font-black ${locker.status === LockerStatus.AVAILABLE ? 'bg-green-50 border-green-200 text-green-700' : locker.status === LockerStatus.OCCUPIED ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
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
          <button onClick={() => setCurrentView('search')} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${currentView === 'search' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><Key size={14} /> NADA CONSTA</button>
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
              <StatCard label="Total Armários" value={stats.total} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeWidth="2" /></svg>} color="bg-slate-800" />
              <StatCard label="Vagos" value={stats.available} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" /></svg>} color="bg-green-500" />
              <StatCard label="Emprestados" value={stats.occupied} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" strokeWidth="2" /></svg>} color="bg-blue-500" />
              <StatCard label="Manutenção" value={stats.maintenance} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2" /></svg>} color="bg-orange-500" />
            </div>

            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Mapa de Armários</h2>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-100 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none cursor-pointer">
                  <option value="todos">Todos</option>
                  <option value="disponivel">Disponíveis</option>
                  <option value="ocupado">Ocupados</option>
                  <option value="manutencao">Manutenção</option>
                </select>
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
                            <h4 className="text-sm font-black text-slate-400 group-hover:text-slate-600 uppercase tracking-widest transition-colors">
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

        {currentView === 'search' && (
          <StudentSearch
            students={students}
            lockers={lockers}
            onReturnLocker={handleReturnLocker}
            onUpdateObservation={handleUpdateObservation}
            onChangeLocker={handleChangeLocker}
          />
        )}

        {currentView === 'reports' && (
          <ReportsTab lockers={lockers} />
        )}


        {currentView === 'config' && isAdmin && (
          <div className="space-y-12">
            <LockerManagement existingLockers={lockers} onGenerate={handleBatchGenerate} />
            <CSVImport onImportLockers={handleImportLockers} onCancel={() => setCurrentView('dashboard')} />
            <ExportTab lockers={lockers} onClearAll={handleClearAllLoans} />
          </div>
        )}

        {currentView === 'loan-form' && selectedLocker && (
          <LockerForm selectedLocker={selectedLocker} students={students} onSubmit={handleLoanSubmit} onCancel={() => setCurrentView('dashboard')} />
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
