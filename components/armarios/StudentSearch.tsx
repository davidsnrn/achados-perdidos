import React, { useState, useMemo } from 'react';
import { Locker, Student, LoanData, LockerStatus } from '../../types-armarios';
import { ExternalLink } from 'lucide-react';

interface StudentSearchProps {
  students: Student[];
  lockers: Locker[];
  onReturnLocker: (num: number) => void;
  onUpdateObservation: (num: number, obs: string) => void;
  onChangeLocker: (old: number, next: number) => void;
}

const StudentSearch: React.FC<StudentSearchProps> = ({
  students,
  lockers,
  onReturnLocker,
  onUpdateObservation,
  onChangeLocker
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingLoan, setEditingLoan] = useState<LoanData | null>(null);
  const [newObs, setNewObs] = useState('');
  const [selectedNewLocker, setSelectedNewLocker] = useState<number | null>(null);
  const [isPickingLocker, setIsPickingLocker] = useState(false);

  // Helper para buscar chaves do aluno
  const getStudentHistory = (registration: string) => {
    const activeLoans: LoanData[] = [];
    const pastHistory: LoanData[] = [];

    lockers.forEach(locker => {
      if (locker.currentLoan?.registrationNumber === registration) {
        activeLoans.push(locker.currentLoan);
      }
      locker.loanHistory.forEach(loan => {
        if (loan.registrationNumber === registration) {
          pastHistory.push(loan);
        }
      });
    });

    return { activeLoans, pastHistory };
  };

  const searchResults = useMemo(() => {
    const rawSegments = searchTerm.split(',');
    const searchGroups = rawSegments
      .map(segment => {
        const normalized = segment
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
        return normalized.split(' ').filter(t => t.length > 0);
      })
      .filter(group => group.length > 0);

    if (searchGroups.length === 0) return [];

    return students.filter(s => {
      const studentStr = `${s.registration} ${s.name} ${s.course}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      return searchGroups.some(group => {
        return group.every(word => studentStr.includes(word));
      });
    }).slice(0, 50);
  }, [searchTerm, students, lockers]);

  const openUpdateModal = (loan: LoanData) => {
    setEditingLoan(loan);
    setNewObs(loan.observation || '');
    setSelectedNewLocker(null);
    setIsPickingLocker(false);
  };

  const handleApplyUpdate = () => {
    if (!editingLoan) return;
    if (newObs !== editingLoan.observation) {
      onUpdateObservation(editingLoan.lockerNumber, newObs);
    }
    if (selectedNewLocker && selectedNewLocker !== editingLoan.lockerNumber) {
      onChangeLocker(editingLoan.lockerNumber, selectedNewLocker);
    }
    setEditingLoan(null);
  };

  const handleReturnDirectly = () => {
    if (!editingLoan) return;
    if (window.confirm(`Confirmar devolução da chave do armário #${editingLoan.lockerNumber}?`)) {
      onReturnLocker(editingLoan.lockerNumber);
      setEditingLoan(null);
    }
  };

  const availableLockers = useMemo(() =>
    lockers.filter(l => l.status === LockerStatus.AVAILABLE),
    [lockers]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
        <h2 className="text-3xl font-black text-slate-800 mb-6 tracking-tight">Consulta de Aluno</h2>
        <p className="text-slate-500 mb-8 font-medium">Pesquise por partes do nome, matrícula ou curso.</p>
        <div className="relative">
          <input
            type="text"
            placeholder="Ex: João Silva Administração..."
            className="w-full bg-slate-50 border-4 border-slate-100 rounded-3xl p-6 text-xl font-black text-slate-800 outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {searchResults.map(student => {
          const { activeLoans, pastHistory } = getStudentHistory(student.registration);
          const hasPendency = activeLoans.length > 0;

          return (
            <div key={student.registration} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg overflow-hidden animate-slide-up">
              <div className={`p-8 flex flex-col md:flex-row justify-between items-center gap-6 border-b ${hasPendency ? 'bg-red-50/50 border-red-100' : 'bg-green-50/30 border-green-100'}`}>
                <div className="text-center md:text-left">
                  <h3 className="text-2xl font-black text-slate-800 uppercase leading-tight">{student.name}</h3>
                  <div className="flex flex-wrap justify-center md:justify-start items-center gap-x-6 gap-y-2 mt-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Matrícula: <span className="text-slate-600">{student.registration}</span></span>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Curso: <span className="text-slate-600">{student.course}</span></span>
                    <a
                      href={`https://suap.ifrn.edu.br/edu/aluno/${student.registration}/?tab=nada_consta`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-100 shadow-sm"
                    >
                      <ExternalLink size={12} />
                      Verificar SUAP
                    </a>
                  </div>
                </div>

                <div className={`px-8 py-4 rounded-2xl border-4 flex flex-col items-center justify-center min-w-[220px] transition-all transform hover:scale-105 ${hasPendency ? 'bg-red-600 border-red-100 text-white shadow-xl shadow-red-100' : 'bg-green-600 border-green-100 text-white shadow-xl shadow-green-100'}`}>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">Assinatura Nada Consta</span>
                  <span className="text-xl font-black">{hasPendency ? 'PENDÊNCIA ATIVA' : 'NADA CONSTA'}</span>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 lg:grid-cols-5 gap-10">
                <div className="lg:col-span-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${hasPendency ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                    Situação de Empréstimo
                  </h4>
                  {activeLoans.length > 0 ? (
                    <div className="space-y-4">
                      {activeLoans.map(loan => (
                        <div key={loan.id} className="p-5 bg-red-50 border-2 border-red-100 rounded-2xl relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-1">Armário #{loan.lockerNumber}</p>
                              <p className="text-sm font-black text-red-800 uppercase">Chave em posse do aluno</p>
                            </div>
                            <button
                              onClick={() => openUpdateModal(loan)}
                              className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter hover:bg-red-700 transition-colors shadow-sm"
                            >
                              Atualizar Situação
                            </button>
                          </div>
                          <p className="text-xs text-red-600/70 font-bold mt-2 italic">Retirada em: {loan.loanDate}</p>
                          {loan.observation && (
                            <div className="mt-3 p-3 bg-white/50 rounded-xl border border-red-100">
                              <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Observação:</p>
                              <p className="text-[11px] font-medium text-red-900 leading-tight">{loan.observation}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                      <p className="text-sm text-slate-400 font-black uppercase tracking-widest">Nenhum armário ocupado</p>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                    Histórico de Utilização
                  </h4>
                  {pastHistory.length > 0 ? (
                    <div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-4">
                      {pastHistory.map((loan, i) => (
                        <div key={i} className="p-4 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-colors shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-black text-slate-700 uppercase text-xs">Armário #{loan.lockerNumber}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">Período: {loan.loanDate} — {loan.returnDate}</p>
                                <a
                                  href={`https://suap.ifrn.edu.br/edu/aluno/${loan.registrationNumber}/?tab=nada_consta`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] font-black text-blue-600 hover:underline uppercase"
                                >
                                  SUAP
                                </a>
                              </div>
                            </div>
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Devolvido</span>
                          </div>
                          {loan.observation && (
                            <div className="mt-2 pl-3 border-l-2 border-slate-100">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Obs:</p>
                              <p className="text-[10px] text-slate-500 font-medium italic leading-snug">{loan.observation}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-sm text-slate-300 font-bold uppercase tracking-widest italic">Sem histórico registrado no sistema</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {searchTerm.length >= 2 && searchResults.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border-4 border-dashed border-slate-100">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-slate-400 font-black uppercase tracking-[0.2em]">Nenhum aluno encontrado</p>
            <p className="text-slate-300 text-xs font-bold mt-2">Tente buscar por termos diferentes ou verifique a matrícula.</p>
          </div>
        )}
      </div>

      {/* Modal de Gerenciamento */}
      {editingLoan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Gerenciar Empréstimo</h3>
              <button onClick={() => setEditingLoan(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-5">
              <div className="p-5 bg-slate-50/80 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Armário Atual</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg">
                      {editingLoan.lockerNumber}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-600 uppercase tracking-tighter leading-none">Vínculo Ativo</span>
                      <span className="text-[10px] text-slate-400 font-bold mt-0.5">Clique para trocar chave</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsPickingLocker(true)}
                    className="bg-white hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-200 text-blue-600 p-3 rounded-2xl shadow-sm transition-all group"
                  >
                    <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  </button>
                </div>

                {selectedNewLocker && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between animate-slide-up">
                    <p className="text-[10px] font-black text-blue-500 uppercase">Novo Armário Selecionado:</p>
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-lg font-black text-sm">#{selectedNewLocker}</span>
                      <button onClick={() => setSelectedNewLocker(null)} className="text-slate-300 hover:text-red-400 p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Atualizar Observação</label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-blue-500 outline-none resize-none transition-all shadow-inner placeholder:text-slate-300"
                  value={newObs}
                  onChange={(e) => setNewObs(e.target.value)}
                  placeholder="Condição da chave, avisos..."
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleApplyUpdate}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 transition-all transform active:scale-95 uppercase text-xs tracking-widest"
              >
                Salvar Alterações
              </button>

              <div className="flex gap-3">
                <button
                  onClick={handleReturnDirectly}
                  className="flex-1 bg-red-50 text-red-600 border border-red-100 font-black py-4 rounded-2xl hover:bg-red-100 transition-all uppercase text-[10px] tracking-widest"
                >
                  Devolver Chave
                </button>
                <button
                  onClick={() => setEditingLoan(null)}
                  className="flex-1 bg-slate-50 text-slate-500 border border-slate-100 font-black py-4 rounded-2xl hover:bg-slate-100 transition-all uppercase text-[10px] tracking-widest"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seletor Visual de Armários (Modo Picker) */}
      {isPickingLocker && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Selecione Novo Armário</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Apenas chaves vazias disponíveis</p>
              </div>
              <button
                onClick={() => setIsPickingLocker(false)}
                className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all text-slate-400"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/20">
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                {lockers.map(locker => {
                  const isAvailable = locker.status === LockerStatus.AVAILABLE;
                  return (
                    <button
                      key={locker.number}
                      disabled={!isAvailable}
                      onClick={() => {
                        setSelectedNewLocker(locker.number);
                        setIsPickingLocker(false);
                      }}
                      className={`
                        aspect-square rounded-2xl flex items-center justify-center font-black text-sm transition-all transform
                        ${isAvailable
                          ? 'bg-white border-2 border-slate-100 text-slate-800 hover:border-blue-500 hover:text-blue-600 hover:scale-110 shadow-sm hover:shadow-xl hover:shadow-blue-50'
                          : 'bg-slate-100 border-2 border-slate-100 text-slate-300 opacity-40 cursor-not-allowed'
                        }
                      `}
                    >
                      {locker.number}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 text-center bg-white">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total de {lockers.filter(l => l.status === LockerStatus.AVAILABLE).length} chaves livres para troca</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentSearch;
