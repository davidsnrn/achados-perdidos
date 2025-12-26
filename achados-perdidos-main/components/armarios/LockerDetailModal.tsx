
import React, { useEffect, useState } from 'react';
import { Locker, LockerStatus } from '../../types-armarios';

interface LockerDetailModalProps {
  locker: Locker;
  onClose: () => void;
  onStartLoan: (locker: Locker) => void;
  onReturnLocker: (lockerNumber: number) => void;
  onUpdateMaintenance: (lockerNumber: number, problem: string) => void;
  onResolveMaintenance: (lockerNumber: number) => void;
  onUpdateObservation: (lockerNumber: number, observation: string) => void;
}

const LockerDetailModal: React.FC<LockerDetailModalProps> = ({
  locker,
  onClose,
  onStartLoan,
  onReturnLocker,
  onUpdateMaintenance,
  onResolveMaintenance,
  onUpdateObservation
}) => {
  const [isEditingObs, setIsEditingObs] = useState(false);
  const [tempObs, setTempObs] = useState('');

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
      case LockerStatus.MAINTENANCE: return 'text-slate-600 bg-slate-50 border-slate-200';
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
            <div className={`w-28 h-28 rounded-3xl flex items-center justify-center text-white text-5xl font-black shadow-2xl ring-4 ${locker.status === LockerStatus.AVAILABLE ? 'bg-green-600 ring-green-100' : locker.status === LockerStatus.OCCUPIED ? 'bg-red-600 ring-red-100' : 'bg-slate-500 ring-slate-100'}`}>
              {locker.number}
            </div>
            <div>
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
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Aluno Responsável</p>
                    <p className="text-sm font-black text-slate-800 uppercase">{locker.currentLoan.studentName}</p>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Matrícula</p>
                    <p className="text-sm font-bold text-slate-800">{locker.currentLoan.registrationNumber}</p>
                  </div>
                  <div className="col-span-2 py-3 border-t border-slate-100 mt-2 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Turma</p>
                      <p className="text-sm font-bold text-slate-700">{locker.currentLoan.studentClass}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Retirada em</p>
                      <p className="text-sm font-bold text-slate-700">{locker.currentLoan.loanDate}</p>
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

                  <div className="col-span-2 pt-4">
                    <button
                      onClick={() => onReturnLocker(locker.number)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                    >
                      Registrar Devolução da Chave
                    </button>
                  </div>
                </div>
              ) : locker.status === LockerStatus.MAINTENANCE && locker.maintenanceRecord ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-200/50 border border-slate-300 rounded-xl text-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Diagnóstico</p>
                    <p className="text-sm font-bold leading-relaxed">{locker.maintenanceRecord.problem}</p>
                  </div>
                  <button onClick={() => onResolveMaintenance(locker.number)} className="w-full bg-green-100 hover:bg-green-200 text-green-700 font-black py-3 rounded-xl border border-green-200">Liberar Armário</button>
                </div>
              ) : (
                <p className="text-sm text-green-700 font-bold bg-green-100/50 p-4 rounded-xl border border-green-100 text-center">✓ Disponível para novo empréstimo</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Histórico de Empréstimos
              </h4>
              {locker.loanHistory.length > 0 ? (
                <div className="space-y-6">
                  {locker.loanHistory.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-2 border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <p className="font-black text-slate-800 uppercase mb-0.5">{item.studentName}</p>
                          <p className="text-slate-400 font-bold">{item.registrationNumber} • {item.studentClass}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-500 font-black mb-1 whitespace-nowrap">{item.loanDate} — {item.returnDate || '...'}</p>
                          <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase">Concluído</span>
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
                  <p className="text-xs text-slate-300 font-bold uppercase tracking-widest italic">Sem registros anteriores</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          {locker.status === LockerStatus.AVAILABLE && (
            <button
              onClick={() => onStartLoan(locker)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs tracking-widest"
            >
              Iniciar Empréstimo
            </button>
          )}
          <button onClick={onClose} className="flex-1 font-black py-4 rounded-2xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all uppercase text-xs tracking-widest">Fechar Ficha</button>
        </div>
      </div>
    </div>
  );
};

export default LockerDetailModal;
