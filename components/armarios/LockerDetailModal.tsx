import React, { useEffect, useState } from 'react';
import { Locker, LockerStatus } from '../../types-armarios';
import { ExternalLink, Mail, Loader2 } from 'lucide-react';
import { ChargeHistory } from '../../types-materiais';

interface LockerDetailModalProps {
  locker: Locker;
  onClose: () => void;
  onStartLoan: (locker: Locker) => void;
  onReturnLocker: (lockerNumber: string) => void;
  onUpdateMaintenance: (lockerNumber: string, problem: string) => void;
  onResolveMaintenance: (lockerNumber: string) => void;
  onUpdateObservation: (lockerNumber: string, observation: string) => void;
  onOpenSchedule: (locker: Locker) => void;
  onReserveKeyLoan?: (locker: Locker, reason: string) => void;
  onReturnReserveKey?: (lockerNumber: string, loanId: string) => void;
  onDeleteLoanHistory?: (lockerNumber: string, loanId: string) => void;
  onDeleteMaintenanceHistory?: (lockerNumber: string, maintenanceIndex: number) => void;
  onSendReserveKeyCharge?: (lockerNumber: string, loanId: string) => Promise<void>;
  reserveKeyChargeHistory?: ChargeHistory[];
  sendingReserveKeyCharge?: boolean;
}

const LockerDetailModal: React.FC<LockerDetailModalProps> = ({
  locker,
  onClose,
  onStartLoan,
  onReturnLocker,
  onUpdateMaintenance,
  onResolveMaintenance,
  onUpdateObservation,
  onOpenSchedule,
  onReserveKeyLoan,
  onReturnReserveKey,
  onDeleteLoanHistory,
  onDeleteMaintenanceHistory,
  onSendReserveKeyCharge,
  reserveKeyChargeHistory = [],
  sendingReserveKeyCharge = false
}) => {
  const [isEditingObs, setIsEditingObs] = useState(false);
  const [showReserveForm, setShowReserveForm] = useState(false);
  const [reserveReason, setReserveReason] = useState('');
  const [deletedLoanIds, setDeletedLoanIds] = useState<string[]>([]);
  const [deletedMaintenanceIndices, setDeletedMaintenanceIndices] = useState<number[]>([]);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  };

  const [tempObs, setTempObs] = useState('');
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [showHistoryType, setShowHistoryType] = useState<'loans' | 'maintenance'>('loans');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const getStatusColor = (status: LockerStatus) => {
    switch (status) {
      case LockerStatus.AVAILABLE: return 'text-green-600 bg-green-50 border-green-200';
      case LockerStatus.OCCUPIED: return 'text-red-600 bg-red-50 border-red-200';
      case LockerStatus.MAINTENANCE: return 'text-orange-600 bg-orange-50 border-orange-200';
      case LockerStatus.SCHEDULED: return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const startEditObs = () => {
    setTempObs(locker.currentLoan?.observation || '');
    setIsEditingObs(true);
  };

  const saveObs = () => {
    onUpdateObservation(locker.number, tempObs);
    setIsEditingObs(false);
  };

  const handleMaintenanceSubmit = () => {
    if (!maintenanceReason.trim()) {
      alert('O motivo da manutenção é obrigatório.');
      return;
    }
    onUpdateMaintenance(locker.number, maintenanceReason);
    setShowMaintenanceForm(false);
    setMaintenanceReason('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 my-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800">Ficha do Armário</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-6">
            <div className={`w-28 h-28 rounded-3xl flex items-center justify-center text-white text-5xl font-black shadow-2xl ring-4 ${locker.status === LockerStatus.AVAILABLE ? 'bg-green-600 ring-green-100' : locker.status === LockerStatus.OCCUPIED ? 'bg-red-600 ring-red-100' : locker.status === LockerStatus.SCHEDULED ? 'bg-amber-500 ring-amber-100' : 'bg-orange-600 ring-orange-100'}`}>
              {locker.number}
            </div>
            <div className="flex-1">
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${getStatusColor(locker.status)}`}>
                {locker.status}
              </span>
              <p className="mt-3 text-slate-500 text-sm font-medium">Localização Física:</p>
              <p className="text-slate-800 font-bold text-lg leading-tight">{locker.location}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Estado Atual</h4>

              {locker.status === LockerStatus.OCCUPIED && locker.currentLoan ? (
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  <div className="col-span-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Aluno / Servidor</p>
                    <p className="text-sm font-black text-slate-800 uppercase">{locker.currentLoan.studentName}</p>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Matrícula</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">{locker.currentLoan.registrationNumber}</p>
                      <a
                        href={`https://suap.ifrn.edu.br/edu/aluno/${locker.currentLoan.registrationNumber}/?tab=nada_consta`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-50 text-blue-600 p-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all border border-blue-100 flex items-center gap-1 shadow-sm"
                        title="Verificar Nada Consta no SUAP"
                      >
                        <ExternalLink size={12} />
                        <span className="text-[9px] font-black uppercase tracking-tighter">SUAP</span>
                      </a>
                    </div>
                  </div>
                  {locker.currentLoan.studentPhone && (
                    <div className="col-span-2 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-100 rounded-xl">
                      <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-0.5">Telefone para contato</p>
                        <a
                          href={`tel:${locker.currentLoan.studentPhone.replace(/\D/g, '')}`}
                          className="text-sm font-black text-slate-800 hover:text-green-700 transition-colors"
                        >
                          {locker.currentLoan.studentPhone}
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="col-span-2 py-3 border-t border-slate-100 mt-2 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Turma</p>
                      <p className="text-sm font-bold text-slate-700">{locker.currentLoan.studentClass || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Retirada em</p>
                      <p className="text-sm font-bold text-slate-700">{formatDisplayDate(locker.currentLoan.loanDate)} {locker.currentLoan.loanTime ? `às ${locker.currentLoan.loanTime}` : ''}</p>
                      {locker.currentLoan.loanBy && (
                        <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Operador: {locker.currentLoan.loanBy}</p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 p-4 bg-white/60 border border-slate-200 rounded-xl relative">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Observação do Empréstimo:</p>
                      {!isEditingObs && (
                        <button onClick={startEditObs} className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          Editar
                        </button>
                      )}
                    </div>

                    {isEditingObs ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-medium text-slate-700 focus:border-blue-500 outline-none resize-none"
                          rows={2}
                          value={tempObs}
                          onChange={(e) => setTempObs(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setIsEditingObs(false)} className="px-3 py-1 text-[9px] font-black text-slate-400 uppercase">Cancelar</button>
                          <button onClick={saveObs} className="px-3 py-1 bg-blue-600 text-white rounded text-[9px] font-black uppercase shadow-sm">Gravar</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-slate-700 leading-relaxed italic">
                        {locker.currentLoan.observation || 'Nenhuma observação registrada.'}
                      </p>
                    )}
                  </div>

                  <div className="col-span-2 pt-4 flex flex-col gap-3">
                    <button
                      onClick={() => {
                        if (window.confirm(`Confirmar devolução da chave do armário #${locker.number}?`)) {
                          onReturnLocker(locker.number);
                        }
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                    >
                      Registrar Devolução da Chave
                    </button>

                    {(() => {
                      const activeReserve = (locker.loanHistory || []).find(l => l.loanType === 'reserve_key' && !l.returnDate);
                      if (activeReserve && onReturnReserveKey) {
                        return (
                          <>
                            <button
                              onClick={() => {
                                if (window.confirm(`Confirmar devolução da chave reserva do armário #${locker.number}?`)) {
                                  onReturnReserveKey(locker.number, activeReserve.id);
                                }
                              }}
                              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Devolver Chave Reserva
                            </button>

                            {onSendReserveKeyCharge && (
                              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Lembretes Enviados</p>
                                  <button
                                    onClick={() => onSendReserveKeyCharge(locker.number, activeReserve.id)}
                                    disabled={sendingReserveKeyCharge}
                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-lg transition-all flex items-center gap-1.5 uppercase text-[9px] tracking-wider"
                                  >
                                    {sendingReserveKeyCharge ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                                    Enviar Lembrete
                                  </button>
                                </div>
                                {reserveKeyChargeHistory.length > 0 ? (
                                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {reserveKeyChargeHistory.map((ch, i) => (
                                      <div key={ch.id || i} className="flex items-start gap-2 text-[10px] bg-white rounded-lg p-2 border border-amber-100">
                                        <Mail size={10} className="text-amber-500 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="font-bold text-slate-700 truncate">{ch.person_name} — {ch.person_email}</p>
                                          <p className="text-slate-400 font-medium">
                                            {new Date(ch.sent_at).toLocaleString('pt-BR')}
                                            {ch.triggered_by_name ? ` por ${ch.triggered_by_name}` : ''}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-400 italic text-center">Nenhum lembrete enviado ainda.</p>
                                )}
                              </div>
                            )}
                          </>
                        );
                      }
                      if (onReserveKeyLoan && !showReserveForm) {
                        return (
                          <button
                            onClick={() => setShowReserveForm(true)}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                            Emprestar Chave Reserva
                          </button>
                        );
                      }
                      if (onReserveKeyLoan && showReserveForm) {
                        return (
                          <div className="space-y-3 animate-fade-in">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                              <p className="text-[10px] font-black text-amber-600 uppercase mb-2">Motivo do Empréstimo da Chave Reserva</p>
                              <textarea
                                placeholder="Ex: Aluno perdeu a chave original, precisa de cópia..."
                                className="w-full bg-white border border-amber-200 rounded-lg p-3 text-sm font-bold text-slate-700 focus:border-amber-500 outline-none resize-none"
                                rows={3}
                                value={reserveReason}
                                onChange={(e) => setReserveReason(e.target.value)}
                                autoFocus
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setShowReserveForm(false); setReserveReason(''); }}
                                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-black text-slate-400 uppercase text-[10px] hover:bg-slate-50"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => {
                                  if (!reserveReason.trim()) { alert("Informe o motivo do empréstimo da chave reserva."); return; }
                                  onReserveKeyLoan(locker, reserveReason.trim());
                                  setShowReserveForm(false);
                                  setReserveReason('');
                                }}
                                className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-amber-700"
                              >
                                Confirmar
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              ) : locker.status === LockerStatus.MAINTENANCE && locker.maintenanceRecord ? (
                <div className="space-y-4">
                  <div className="p-4 bg-orange-100/50 border border-orange-200 rounded-xl text-slate-800">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-black text-orange-600 uppercase">Diagnóstico / Motivo</p>
                      <span className="text-[9px] font-bold text-orange-400">{formatDisplayDate(locker.maintenanceRecord.registeredAt)}</span>
                    </div>
                    <p className="text-sm font-bold leading-relaxed">{locker.maintenanceRecord.problem}</p>
                    {locker.maintenanceRecord.registeredBy && (
                      <p className="mt-2 text-[9px] font-bold text-orange-400 uppercase">Registrado por: {locker.maintenanceRecord.registeredBy}</p>
                    )}
                  </div>
                  <button onClick={() => onResolveMaintenance(locker.number)} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-4 rounded-xl shadow-lg transition-all uppercase text-xs tracking-widest">Concluir Manutenção e Liberar</button>
                </div>
              ) : showMaintenanceForm ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-slate-800">
                    <p className="text-[10px] font-black text-orange-600 uppercase mb-2">Novo Registro de Manutenção</p>
                    <textarea
                      placeholder="Descreva o problema ou motivo da manutenção (Obrigatório)..."
                      className="w-full bg-white border border-orange-200 rounded-lg p-3 text-sm font-bold text-slate-700 focus:border-orange-500 outline-none resize-none"
                      rows={3}
                      value={maintenanceReason}
                      onChange={(e) => setMaintenanceReason(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowMaintenanceForm(false)} className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-black text-slate-400 uppercase text-[10px]">Cancelar</button>
                    <button onClick={handleMaintenanceSubmit} className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg">Confirmar Manutenção</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-green-700 font-bold bg-green-100/50 p-4 rounded-xl border border-green-100 text-center">✓ Disponível para novo empréstimo</p>
                  <button onClick={() => setShowMaintenanceForm(true)} className="flex items-center justify-center gap-2 py-2 text-[10px] font-black text-slate-400 hover:text-orange-600 uppercase transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                    Colocar em Manutenção
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <div className="flex border-b border-slate-100 mb-6 pb-2 gap-4">
                <button
                  onClick={() => setShowHistoryType('loans')}
                  className={`text-[10px] font-bold uppercase tracking-widest pb-1 transition-all border-b-2 ${showHistoryType === 'loans' ? 'text-slate-800 border-slate-800' : 'text-slate-300 border-transparent'}`}
                >
                  Histórico de Empréstimos
                </button>
                <button
                  onClick={() => setShowHistoryType('maintenance')}
                  className={`text-[10px] font-bold uppercase tracking-widest pb-1 transition-all border-b-2 ${showHistoryType === 'maintenance' ? 'text-slate-800 border-slate-800' : 'text-slate-300 border-transparent'}`}
                >
                  Histórico de Manutenções
                </button>
              </div>

              {showHistoryType === 'loans' ? (
                <>
                  {(locker.loanHistory?.filter(l => !deletedLoanIds.includes(l.id)) ?? []).length > 0 ? (
                    <div className="space-y-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {[...locker.loanHistory].filter(l => !deletedLoanIds.includes(l.id))
                        .sort((a, b) => {
                          const parseDate = (dateStr: string) => {
                            if (!dateStr) return 0;
                            if (dateStr.includes('-')) {
                              const [y, m, d] = dateStr.split('-');
                              return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getTime();
                            }
                            const parts = dateStr.split('/');
                            if (parts.length !== 3) return 0;
                            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
                          };
                          const timeA = a.loanTime || '00:00';
                          const timeB = b.loanTime || '00:00';
                          const dateDiff = parseDate(b.loanDate) - parseDate(a.loanDate);
                          if (dateDiff !== 0) return dateDiff;
                          return timeB.localeCompare(timeA);
                        })
                        .map((item, idx) => (
                          <div key={idx} className={`flex flex-col gap-2 border-b border-slate-50 pb-4 last:border-0 last:pb-0 ${item.loanType === 'reserve_key' ? 'bg-amber-50/50 -mx-4 px-4 py-2 rounded-xl border-l-4 border-amber-400 mb-2' : ''}`}>
                            <div className="flex justify-between items-start text-xs">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="font-black text-slate-800 uppercase truncate">{item.studentName}</p>
                                  <a
                                    href={`https://suap.ifrn.edu.br/edu/aluno/${item.registrationNumber}/?tab=nada_consta`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] font-black text-blue-600 hover:underline uppercase whitespace-nowrap"
                                  >
                                    SUAP
                                  </a>
                                  {item.loanType === 'reserve_key' && (
                                    <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-[8px] font-black uppercase tracking-wider">Chave Reserva</span>
                                  )}
                                </div>
                                <p className="text-slate-400 font-bold">{item.registrationNumber} • {item.studentClass}</p>
                                <div className="mt-1 flex flex-col gap-0.5">
                                  {item.loanBy && (
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                      <span className="text-slate-300">Empréstimo:</span> {item.loanBy}
                                    </p>
                                  )}
                                  {item.returnedBy && (
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                      <span className="text-slate-300">Devolução:</span> {item.returnedBy}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-1">
                                <p className="text-slate-500 font-black whitespace-nowrap text-[11px]">
                                  {formatDisplayDate(item.loanDate)} {item.loanTime ? `às ${item.loanTime}` : ''}
                                  {item.returnDate ? ` — ${formatDisplayDate(item.returnDate)}${item.returnTime ? ` às ${item.returnTime}` : ''}` : ' — ...'}
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase inline-block ${item.returnDate ? 'bg-green-100 text-green-700' : item.loanType === 'reserve_key' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{item.returnDate ? 'Concluído' : item.loanType === 'reserve_key' ? 'Ativo (Reserva)' : 'Ativo'}</span>
                                  {onDeleteLoanHistory && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Excluir permanentemente este registro do histórico do armário #${locker.number}?`)) {
                                          setDeletedLoanIds(prev => [...prev, item.id]);
                                          onDeleteLoanHistory(locker.number, item.id);
                                        }
                                      }}
                                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                      title="Excluir registro"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {item.observation && (
                              <div className="pl-3 border-l-2 border-slate-100 py-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Obs:</p>
                                <p className="text-[10px] text-slate-500 font-medium italic leading-snug">{item.observation}</p>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-300 font-bold uppercase tracking-widest italic">Sem registros de empréstimos</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {locker.maintenanceHistory && locker.maintenanceHistory.filter((_, idx) => !deletedMaintenanceIndices.includes(idx)).length > 0 ? (
                    <div className="space-y-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {[...locker.maintenanceHistory]
                        .map((m, origIdx) => ({ m, origIdx }))
                        .filter(({ origIdx }) => !deletedMaintenanceIndices.includes(origIdx))
                        .sort((a, b) => new Date(b.m.registeredAt).getTime() - new Date(a.m.registeredAt).getTime())
                        .map(({ m, origIdx }) => (
                          <div key={origIdx} className="flex flex-col gap-2 border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                            <div className="flex justify-between items-start text-xs">
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-slate-800 mb-0.5 uppercase">{m.problem}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase truncate">Resp: {m.registeredBy || 'Sist.'} {m.resolvedBy ? `→ Resolvido por ${m.resolvedBy}` : ''}</p>
                              </div>
                              <div className="text-right flex flex-col items-end gap-1">
                                <p className="text-slate-500 font-black whitespace-nowrap text-[11px]">{formatDisplayDate(m.registeredAt)} — {m.resolvedAt ? formatDisplayDate(m.resolvedAt) : '...'}</p>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${m.resolvedAt ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{m.resolvedAt ? 'Resolvido' : 'Em curso'}</span>
                                  {onDeleteMaintenanceHistory && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Excluir permanentemente este registro de manutenção do armário #${locker.number}?`)) {
                                          setDeletedMaintenanceIndices(prev => [...prev, origIdx]);
                                          onDeleteMaintenanceHistory(locker.number, origIdx);
                                        }
                                      }}
                                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                      title="Excluir registro"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {m.solution && (
                              <div className="pl-3 border-l-2 border-slate-100 py-1">
                                <p className="text-[10px] text-slate-500 font-medium italic leading-snug"><span className="font-black text-slate-400 uppercase text-[9px]">Solução:</span> {m.solution}</p>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-300 font-bold uppercase tracking-widest italic">Sem registros de manutenções</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          {locker.status === LockerStatus.AVAILABLE && !showMaintenanceForm && (
            <>
              <button onClick={onClose} className="flex-1 font-black py-4 rounded-2xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all uppercase text-xs tracking-widest">Cancelar</button>
              <button
                onClick={() => onOpenSchedule(locker)}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs tracking-widest"
              >
                Agendar
              </button>
              <button
                onClick={() => onStartLoan(locker)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs tracking-widest"
              >
                Emprestar
              </button>
            </>
          )}
          {locker.status !== LockerStatus.AVAILABLE && (
            <button onClick={onClose} className="flex-1 font-black py-4 rounded-2xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all uppercase text-xs tracking-widest">Fechar Ficha</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LockerDetailModal;
