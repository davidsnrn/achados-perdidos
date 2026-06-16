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
import AgendamentosTab from '../armarios/AgendamentosTab';
import ScheduleLockerModal from '../armarios/ScheduleLockerModal';
import LockerLoanModal from '../armarios/LockerLoanModal';
import { Loader2, LayoutGrid, FileText, Settings, Key, Plus, Download, FileSpreadsheet, Calendar, Mail } from 'lucide-react';
import { LockerSchedule, LockerScheduleStatus } from '../../types-armarios';
import { EmailService } from '../../services/emailService';
import { ChargeHistory } from '../../types-materiais';

interface ArmariosTabProps {
  user: any; // User from Achados system
  lockers: Locker[];
  onUpdate: () => void;
  campuses: Campus[];
  adminGlobalCampusId?: string | null;
}

export const ArmariosTab: React.FC<ArmariosTabProps> = ({ user, lockers, onUpdate, campuses, adminGlobalCampusId }) => {
  const [loading, setLoading] = useState(false);

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [lockerSearch, setLockerSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [schedules, setSchedules] = useState<LockerSchedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [reserveAlertOpen, setReserveAlertOpen] = useState(false);
  const [selectedCampusId, setSelectedCampusId] = useState<string>(
    (user?.level === UserLevel.ADMIN ? adminGlobalCampusId : user?.campus_id) || ''
  );

  // Reserve key charge state
  const [reserveKeyChargeHistory, setReserveKeyChargeHistory] = useState<ChargeHistory[]>([]);
  const [sendingReserveKeyCharge, setSendingReserveKeyCharge] = useState(false);
  const [showEmailRegisterModal, setShowEmailRegisterModal] = useState(false);
  const [registerEmailMatricula, setRegisterEmailMatricula] = useState('');
  const [registerEmailName, setRegisterEmailName] = useState('');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [pendingChargeLoanId, setPendingChargeLoanId] = useState<string | null>(null);
  const [pendingChargeLockerNumber, setPendingChargeLockerNumber] = useState<string | null>(null);

  // Load charge history when detail modal opens with an active reserve key
  useEffect(() => {
    if (showDetail && selectedLocker) {
      const activeReserve = (selectedLocker.loanHistory || []).find(l => l.loanType === 'reserve_key' && !l.returnDate);
      if (activeReserve) {
        StorageService.getChargeHistory(activeReserve.id).then(history => {
          setReserveKeyChargeHistory(history);
        }).catch(() => setReserveKeyChargeHistory([]));
      } else {
        setReserveKeyChargeHistory([]);
      }
    }
  }, [showDetail, selectedLocker]);

  // Sync with global admin campus selector
  useEffect(() => {
    if (user?.level === UserLevel.ADMIN && adminGlobalCampusId !== undefined) {
      setSelectedCampusId(adminGlobalCampusId || '');
    }
  }, [adminGlobalCampusId, user?.level]);

  const isAdmin = user?.level === UserLevel.ADMIN;
  const isAdvanced = user?.level === UserLevel.ADVANCED;
  const canViewConfig = isAdmin || isAdvanced;

  const activeReserveKeys = useMemo(() => {
    const result: { lockerNumber: string; studentName: string; loanDate: string; loanTime?: string }[] = [];
    lockers.forEach(locker => {
      locker.loanHistory.forEach(loan => {
        if (loan.loanType === 'reserve_key' && !loan.returnDate) {
          result.push({
            lockerNumber: locker.number,
            studentName: loan.studentName,
            loanDate: loan.loanDate,
            loanTime: loan.loanTime,
          });
        }
      });
    });
    return result;
  }, [lockers]);

  useEffect(() => {
    loadSchedules();
  }, [selectedCampusId]);

  const loadSchedules = async () => {
    try {
      const activeCampusId = isAdmin ? selectedCampusId : user.campus_id;
      const data = await StorageService.getLockerSchedules(activeCampusId || undefined);
      setSchedules(data);
    } catch (e) {
      console.error("Erro ao carregar agendamentos:", e);
    }
  };

  const stats = useMemo(() => {
    return {
      total: lockers.length,
      available: lockers.filter(l => l.status === LockerStatus.AVAILABLE).length,
      occupied: lockers.filter(l => l.status === LockerStatus.OCCUPIED).length,
      maintenance: lockers.filter(l => l.status === LockerStatus.MAINTENANCE).length,
      scheduled: lockers.filter(l => l.status === LockerStatus.SCHEDULED).length,
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
    if (!isAdmin && !isAdvanced) return;
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
    setSelectedLocker(locker);
    setShowDetail(false);
    setShowLoanModal(true);
  };

  const handleLoanSubmit = async (loan: LoanData) => {
    setLoading(true);
    try {
      const locker = lockers.find(l => l.number === loan.lockerNumber);
      if (!locker) return;

      const updatedLocker = {
        ...locker,
        status: LockerStatus.OCCUPIED,
        currentLoan: loan,
        campus_id: locker.campus_id || (user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id)
      };

      await StorageService.updateSingleLocker(updatedLocker);
      onUpdate();
      setShowLoanModal(false);
      setSelectedLocker(null);
      alert(`Empréstimo realizado com sucesso para ${loan.studentName}!`);
    } catch (e) {
      alert("Erro ao salvar empréstimo.");
    } finally {
      setLoading(false);
    }
  };

  const handleReturnLocker = async (lockerNumber: string) => {
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

  const handleReserveKeyLoan = async (locker: Locker, reason: string) => {
    if (!locker.currentLoan) return;

    const now = new Date();
    const reserveLoan: LoanData = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      lockerNumber: locker.number,
      physicalLocation: locker.location,
      registrationNumber: locker.currentLoan.registrationNumber,
      studentName: locker.currentLoan.studentName,
      studentClass: locker.currentLoan.studentClass,
      loanDate: now.toLocaleDateString('en-CA'),
      loanTime: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      loanBy: user?.name || 'Sistema',
      observation: `Chave reserva — ${reason}`,
      campus_id: locker.campus_id,
      loanType: 'reserve_key'
    };

    const updatedLocker = {
      ...locker,
      loanHistory: [reserveLoan, ...locker.loanHistory].slice(0, 50)
    };

    setLoading(true);
    try {
      await StorageService.updateSingleLocker(updatedLocker);
      onUpdate();
      setShowDetail(false);
      setSelectedLocker(null);
      alert(`Chave reserva registrada para ${locker.currentLoan.studentName}!`);
    } catch (e) {
      alert("Erro ao registrar chave reserva.");
    } finally {
      setLoading(false);
    }
  };

  const handleReturnReserveKey = async (lockerNumber: string, loanId: string) => {
    const l = lockers.find(loc => loc.number === lockerNumber);
    if (!l) return;

    const now = new Date();
    const updatedHistory = l.loanHistory.map(loan => {
      if (loan.id === loanId && loan.loanType === 'reserve_key' && !loan.returnDate) {
        return {
          ...loan,
          returnDate: now.toLocaleDateString('en-CA'),
          returnTime: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          returnedBy: user?.name || 'Sistema'
        };
      }
      return loan;
    });

    const updatedLocker = { ...l, loanHistory: updatedHistory };

    setLoading(true);
    try {
      await StorageService.updateSingleLocker(updatedLocker);
      onUpdate();
      setShowDetail(false);
      setSelectedLocker(null);
      alert("Chave reserva devolvida com sucesso!");
    } catch (e) {
      alert("Erro ao registrar devolução da chave reserva.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReserveKeyCharge = async (lockerNumber: string, loanId: string) => {
    const l = lockers.find(loc => loc.number === lockerNumber);
    if (!l) return;

    const reserveLoan = l.loanHistory.find(loan => loan.id === loanId && loan.loanType === 'reserve_key');
    if (!reserveLoan) return;

    const personName = reserveLoan.studentName;
    const personMatricula = reserveLoan.registrationNumber;

    setSendingReserveKeyCharge(true);
    try {
      let personEmail = '';
      const loanPersonEmail = (reserveLoan as any).personEmail;
      if (loanPersonEmail) {
        personEmail = loanPersonEmail;
      } else {
        const emailResult = await StorageService.getPersonEmail(personMatricula);
        personEmail = emailResult || '';
      }

      if (!personEmail) {
        setRegisterEmailMatricula(personMatricula);
        setRegisterEmailName(personName);
        setPendingChargeLoanId(loanId);
        setPendingChargeLockerNumber(lockerNumber);
        setShowEmailRegisterModal(true);
        return;
      }

      await executeSendReserveKeyCharge(lockerNumber, loanId, personEmail, personName);
    } catch (err) {
      alert('Erro ao enviar lembrete: ' + ((err as any)?.message || 'Erro desconhecido'));
    } finally {
      setSendingReserveKeyCharge(false);
    }
  };

  const executeSendReserveKeyCharge = async (lockerNumber: string, loanId: string, personEmail: string, personName: string) => {
    const l = lockers.find(loc => loc.number === lockerNumber);
    if (!l) return;

    const reserveLoan = l.loanHistory.find(loan => loan.id === loanId && loan.loanType === 'reserve_key');
    if (!reserveLoan) return;

    const campusName = campuses.find(c => c.id === (selectedCampusId || l.campus_id))?.name;

    const result = await EmailService.sendLockerChargeNotification(
      personEmail,
      personName,
      lockerNumber,
      reserveLoan.loanDate,
      user?.email,
      campusName
    );

    if (!result.success) {
      alert('Erro ao enviar e-mail: ' + (result.error || 'Falha no envio'));
      return;
    }

    await StorageService.logChargeSent({
      loan_id: loanId,
      material_id: `ARMARIO-${lockerNumber}`,
      person_email: personEmail,
      person_name: personName,
      triggered_by_name: user?.name || 'Sistema',
      triggered_by_email: user?.email,
      campus_id: selectedCampusId || l.campus_id,
    });

    const updatedHistory = await StorageService.getChargeHistory(loanId);
    setReserveKeyChargeHistory(updatedHistory);
    alert('Lembrete enviado com sucesso!');
  };

  const handleSaveEmailAndSendCharge = async () => {
    if (!newEmailInput.trim()) {
      alert('Informe um e-mail.');
      return;
    }
    setIsSavingEmail(true);
    try {
      await StorageService.updatePersonEmail(registerEmailMatricula, newEmailInput.trim());
      if (pendingChargeLoanId && pendingChargeLockerNumber) {
        await executeSendReserveKeyCharge(pendingChargeLockerNumber, pendingChargeLoanId, newEmailInput.trim(), registerEmailName);
      }
      setShowEmailRegisterModal(false);
      setNewEmailInput('');
    } catch (err) {
      alert('Erro ao salvar e-mail: ' + ((err as any)?.message || ''));
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleDeleteLoanHistory = async (lockerNumber: string, loanId: string) => {
    if (!isAdmin) return;
    const l = lockers.find(loc => loc.number === lockerNumber);
    if (!l) return;

    const updatedHistory = l.loanHistory.filter(loan => loan.id !== loanId);
    const updatedLocker = { ...l, loanHistory: updatedHistory };

    setSelectedLocker(prev => prev?.number === lockerNumber ? updatedLocker : prev);

    setLoading(true);
    try {
      await StorageService.updateSingleLocker(updatedLocker);
    } catch (e) {
      alert("Erro ao excluir registro.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateObservation = async (lockerNumber: string, newObservation: string) => {
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

  const handleChangeLocker = async (oldNumber: string, newNumber: string) => {
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

  const handleUpdateMaintenance = async (lockerNumber: string, problem: string) => {
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

  const handleResolveMaintenance = async (lockerNumber: string) => {
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

  // --- Handlers para Agendamentos ---
  const handleScheduleLocker = async (newSchedule: Omit<LockerSchedule, 'id'>) => {
    setLoading(true);
    try {
      const saved = await StorageService.saveLockerSchedule(newSchedule);
      
      const l = lockers.find(loc => loc.number === newSchedule.lockerNumber);
      if (l) {
        const updatedLocker = { 
          ...l, 
          status: LockerStatus.SCHEDULED,
          activeScheduleId: saved.id
        };
        await StorageService.updateSingleLocker(updatedLocker);
      }
      
      await loadSchedules();
      onUpdate();
      setShowScheduleModal(false);
      setShowDetail(false);
    } catch (e) {
      alert("Erro ao realizar agendamento.");
    } finally {
      setLoading(false);
    }
  };

  const handleEfetivarAgendamento = async (s: LockerSchedule) => {
    setLoading(true);
    try {
      // 1. Criar o empréstimo real
      const loan: LoanData = {
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        lockerNumber: s.lockerNumber,
        physicalLocation: s.lockerLocation,
        registrationNumber: s.registrationNumber,
        studentName: s.studentName,
        studentClass: s.studentClass,
        loanDate: new Date().toLocaleDateString('en-CA'),
        loanTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        loanBy: user.name,
        observation: s.observation || '',
        campus_id: s.campusId
      };

      // 2. Atualizar o armário para OCUPADO e anexar o empréstimo
      const l = lockers.find(loc => loc.number === s.lockerNumber);
      if (l) {
        const updatedLocker = {
          ...l,
          status: LockerStatus.OCCUPIED,
          currentLoan: loan,
          activeScheduleId: undefined
        };
        await StorageService.updateSingleLocker(updatedLocker);
      }

      // 3. Marcar agendamento como concluído
      await StorageService.updateLockerScheduleStatus(s.id, LockerScheduleStatus.COMPLETED, user.name);
      
      await loadSchedules();
      onUpdate();
      setCurrentView('dashboard');
      alert(`Empréstimo efetivado com sucesso para ${s.studentName}!`);
    } catch (e) {
      alert("Erro ao efetivar agendamento.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarAgendamento = async (id: string) => {
    if (!confirm("Deseja realmente cancelar este agendamento? O armário voltará a ficar disponível.")) return;
    
    setLoading(true);
    try {
      const s = schedules.find(sched => sched.id === id);
      if (s) {
        const l = lockers.find(loc => loc.number === s.lockerNumber);
        if (l && l.status === LockerStatus.SCHEDULED) {
          const updatedLocker = { ...l, status: LockerStatus.AVAILABLE, activeScheduleId: undefined };
          await StorageService.updateSingleLocker(updatedLocker);
        }
      }
      
      await StorageService.updateLockerScheduleStatus(id, LockerScheduleStatus.CANCELLED);
      await loadSchedules();
      onUpdate();
    } catch (e) {
      alert("Erro ao cancelar agendamento.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgendamento = async (id: string) => {
    if (!confirm("Deseja excluir permanentemente este registro de agendamento?")) return;
    
    setLoading(true);
    try {
      await StorageService.deleteLockerSchedule(id);
      await loadSchedules();
    } catch (e) {
      alert("Erro ao excluir agendamento.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetLayout = async () => {
    if (!isAdmin && !isAdvanced) return;
    if (!confirm("Isso removerá a localização (Bloco/Agrupamento) de TODOS os armários. Os empréstimos e o histórico serão mantidos. Deseja continuar?")) return;

    setLoading(true);
    try {
      const resetLockers = lockers.map(l => ({
        ...l,
        location: ''
      }));
      await StorageService.saveLockers(resetLockers);
      onUpdate();
      alert("Layout reiniciado com sucesso.");
    } catch (e) {
      alert("Erro ao reiniciar layout.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmptyLockers = async () => {
    if (!isAdmin && !isAdvanced) return;
    const emptyCount = lockers.filter(l => l.status === LockerStatus.AVAILABLE).length;
    if (emptyCount === 0) {
      alert("Não há armários vazios para apagar.");
      return;
    }
    if (!confirm(`Isso apagará permanentemente ${emptyCount} armário(s) vazio(s).\n\nArmários emprestados e em manutenção serão mantidos.\n\nOs históricos dos armários que estão disponíveis serão excluídos, incluindo os relatórios relacionados a esses armários.\n\nDeseja continuar?`)) return;

    setLoading(true);
    try {
      const campusId = user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id;
      await StorageService.deleteEmptyLockers(campusId || undefined);
      onUpdate();
      alert(`${emptyCount} armário(s) vazio(s) apagado(s) com sucesso.`);
    } catch (e) {
      alert("Erro ao apagar armários vazios.");
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
      else if (statusFilter === 'agendado') matchesStatus = l.status === LockerStatus.SCHEDULED;

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
        {subset.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' })).map(locker => (
          <button
            key={locker.number}
            onClick={() => handleLockerClick(locker)}
            className={`aspect-square rounded-xl flex items-center justify-center transition-all transform hover:scale-110 border-2 text-sm font-black ${locker.status === LockerStatus.AVAILABLE
              ? 'bg-green-50 border-green-200 text-green-700'
              : locker.status === LockerStatus.OCCUPIED
                ? 'bg-red-50 border-red-200 text-red-600'
                : locker.status === LockerStatus.SCHEDULED
                  ? 'bg-amber-50 border-amber-300 text-amber-600'
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
      // Se não tem localização, só mostramos se estiver ocupado ou em manutenção
      if (!locker.location) {
        if (locker.status === LockerStatus.AVAILABLE) return;

        const blockName = 'Sem Localização';
        const groupName = 'Armários Ocupados/Pendentes';

        if (!grouped[blockName]) grouped[blockName] = {};
        if (!grouped[blockName][groupName]) grouped[blockName][groupName] = [];
        grouped[blockName][groupName].push(locker);
        return;
      }

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
        const numbers = groupLockers.map(l => l.number).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        const min = numbers[0];
        const max = numbers[numbers.length - 1];
        return {
          id: `${blockName}-${groupName}`,
          title: groupName,
          range: [min, max],
          lockers: groupLockers
        };
      })
    })).sort((a, b) => {
      if (a.name === 'Sem Localização') return 1;
      if (b.name === 'Sem Localização') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [lockers]);

  return (
    <div className="bg-slate-50 text-slate-900 pb-20 font-sans rounded-3xl overflow-hidden shadow-inner">
      <div className="bg-white border-b border-slate-200 flex justify-between items-center p-4">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button onClick={() => setCurrentView('dashboard')} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${currentView === 'dashboard' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><LayoutGrid size={14} /> Painel</button>
          <button onClick={() => setCurrentView('schedules')} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${currentView === 'schedules' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><Calendar size={14} /> Agendamentos</button>
          <button onClick={() => setCurrentView('reports')} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${currentView === 'reports' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><FileText size={14} /> Relatórios</button>
          {canViewConfig && (
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
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2" /></svg>}
                color="bg-orange-500"
                onClick={() => setStatusFilter('manutencao')}
                isActive={statusFilter === 'manutencao'}
              />
              <StatCard
                label="Agendados"
                value={stats.scheduled}
                icon={<Calendar className="w-5 h-5" />}
                color="bg-amber-500"
                onClick={() => setStatusFilter('agendado')}
                isActive={statusFilter === 'agendado'}
              />
            </div>

            {activeReserveKeys.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-[2rem] shadow-sm overflow-hidden">
                <button
                  onClick={() => setReserveAlertOpen(!reserveAlertOpen)}
                  className="w-full flex items-center justify-between p-6 hover:bg-amber-100/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="text-left">
                      <p className="font-black text-amber-800 text-sm uppercase tracking-widest">Chaves Reserva Pendentes</p>
                      <p className="text-xs font-bold text-amber-600">{activeReserveKeys.length} chave(s) reserva não devolvida(s)</p>
                    </div>
                  </div>
                  <svg className={`w-5 h-5 text-amber-500 transition-transform duration-300 ${reserveAlertOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {reserveAlertOpen && (
                  <div className="px-6 pb-6 flex flex-wrap gap-2 animate-fade-in">
                    {activeReserveKeys.map((rk, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const locker = lockers.find(l => l.number === rk.lockerNumber);
                          if (locker) handleLockerClick(locker);
                        }}
                        className="px-4 py-2 bg-white rounded-xl border border-amber-200 text-xs font-bold text-amber-800 shadow-sm hover:shadow-md hover:border-amber-400 transition-all text-left"
                      >
                        #{rk.lockerNumber} — {rk.studentName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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

        {currentView === 'schedules' && (
          <AgendamentosTab 
            schedules={schedules} 
            onEfetivar={handleEfetivarAgendamento} 
            onCancelar={handleCancelarAgendamento}
            onExcluir={handleDeleteAgendamento}
            isLoading={loading}
          />
        )}


        {currentView === 'config' && canViewConfig && (
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
            <LockerManagement
              existingLockers={lockers}
              onGenerate={handleBatchGenerate}
              onReset={handleResetLayout}
              onDeleteEmpty={handleDeleteEmptyLockers}
            />
            {isAdmin && (
              <>
                <CSVImport onImportLockers={handleImportLockers} onCancel={() => setCurrentView('dashboard')} />
                <ExportTab lockers={lockers} onClearAll={handleClearAllLoans} />
              </>
            )}
          </div>
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
          onOpenSchedule={(l) => { setSelectedLocker(l); setShowScheduleModal(true); }}
          onReserveKeyLoan={handleReserveKeyLoan}
          onReturnReserveKey={handleReturnReserveKey}
          onDeleteLoanHistory={isAdmin ? handleDeleteLoanHistory : undefined}
          onSendReserveKeyCharge={handleSendReserveKeyCharge}
          reserveKeyChargeHistory={reserveKeyChargeHistory}
          sendingReserveKeyCharge={sendingReserveKeyCharge}
        />
      )}

      {showScheduleModal && selectedLocker && (
        <ScheduleLockerModal
          locker={selectedLocker}
          operatorName={user?.name}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={handleScheduleLocker}
        />
      )}

      {showLoanModal && selectedLocker && (
        <LockerLoanModal
          locker={selectedLocker}
          operatorName={user?.name}
          onClose={() => setShowLoanModal(false)}
          onSubmit={handleLoanSubmit}
        />
      )}

      {/* Email Registration Modal for Reserve Key Charge */}
      {showEmailRegisterModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100">
            <h3 className="text-lg font-black text-slate-800 mb-4">Cadastrar E-mail</h3>
            <p className="text-sm text-slate-500 mb-4">
              O aluno <strong>{registerEmailName}</strong> ({registerEmailMatricula}) não possui e-mail cadastrado. Informe um e-mail para enviar o lembrete.
            </p>
            <input
              type="email"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 mb-4"
              placeholder="email@exemplo.com"
              value={newEmailInput}
              onChange={(e) => setNewEmailInput(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowEmailRegisterModal(false); setNewEmailInput(''); }}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-black text-slate-400 uppercase text-[10px] hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEmailAndSendCharge}
                disabled={isSavingEmail}
                className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-amber-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Cadastrar e Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
