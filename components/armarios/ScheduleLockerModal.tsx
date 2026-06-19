import React, { useState, useRef, useEffect } from 'react';
import { Locker, Student, LockerScheduleStatus, LockerSchedule } from '../../types-armarios';

import { StorageService } from '../../services/storage';
import { X, Search, Loader2, Calendar, User, BookOpen, AlertCircle } from 'lucide-react';

interface ScheduleLockerModalProps {
  locker: Locker;
  onClose: () => void;
  onSchedule: (schedule: Omit<LockerSchedule, 'id'>) => Promise<void>;
  operatorName: string;
}

const ScheduleLockerModal: React.FC<ScheduleLockerModalProps> = ({
  locker,
  onClose,
  onSchedule,
  operatorName
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [observation, setObservation] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (val.trim().length >= 2) {
      setIsSearching(true);
      try {
        const results = await StorageService.searchPeople(val, 5, locker.campus_id);
        setSearchResults(results
          .map(p => ({
            registration: p.matricula,
            name: p.name,
            course: '',
            situation: 'Ativo',
            email: ''
          } as Student))
        );
      } catch (error) {
        console.error("Erro na busca:", error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setSearchTerm(student.name);
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    setIsSubmitting(true);
    try {
      const newSchedule: Omit<LockerSchedule, 'id'> = {
        lockerNumber: locker.number,
        lockerLocation: locker.location,
        campusId: locker.campus_id,
        setor_id: locker.setor_id,
        studentName: selectedStudent.name,
        registrationNumber: selectedStudent.registration,
        studentClass: studentClass,
        scheduledBy: operatorName,
        scheduledAt: new Date().toISOString(),
        observation: observation,
        status: LockerScheduleStatus.PENDING
      };

      await onSchedule(newSchedule);
      onClose();
    } catch (error) {
      alert("Erro ao realizar agendamento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-100">
              <Calendar size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Agendar Armário #{locker.number}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{locker.location || 'Local não definido'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl text-slate-400 transition-all shadow-sm hover:shadow-md border border-transparent hover:border-slate-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 flex gap-3">
            <AlertCircle className="text-amber-500 shrink-0" size={18} />
            <p className="text-[11px] text-amber-700 font-bold leading-tight uppercase tracking-tight">
              O agendamento reserva o armário visualmente, mas não efetiva o empréstimo imediato. A chave deve ser entregue posteriormente.
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">1. Buscar Aluno / Servidor (Nome ou Matrícula)</label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Digite para pesquisar..."
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 transition-all shadow-inner"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  readOnly={!!selectedStudent}
                />
                <Search className="absolute left-4 top-4 text-slate-300" size={20} />
                {isSearching && (
                  <Loader2 className="absolute right-4 top-4 animate-spin text-amber-500" size={20} />
                )}
                {selectedStudent && (
                  <button 
                    type="button"
                    onClick={() => { setSelectedStudent(null); setSearchTerm(''); }}
                    className="absolute right-4 top-4 text-[9px] font-black uppercase text-red-500 hover:underline"
                  >
                    Trocar
                  </button>
                )}
              </div>

              {searchResults.length > 0 && !selectedStudent && (
                <div className="absolute z-10 w-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-slide-up">
                  {searchResults.map(student => (
                    <button
                      key={student.registration}
                      type="button"
                      className="w-full text-left p-4 hover:bg-amber-50 border-b border-slate-50 last:border-none transition-colors flex justify-between items-center group"
                      onClick={() => handleSelectStudent(student)}
                    >
                      <div>
                        <p className="font-black text-slate-700 uppercase text-xs group-hover:text-amber-700">{student.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5">{student.registration}</p>
                      </div>
                      <Plus size={14} className="text-slate-300 group-hover:text-amber-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">2. Turma (Opcional)</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ex: TADS3V"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 transition-all shadow-inner"
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                  />
                  <BookOpen className="absolute left-4 top-4 text-slate-300" size={20} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Responsável</label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    className="w-full bg-slate-100 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold text-slate-400 outline-none"
                    value={operatorName}
                  />
                  <User className="absolute left-4 top-4 text-slate-300" size={20} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">3. Observação Adicional</label>
              <textarea
                rows={3}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-amber-500 outline-none resize-none transition-all shadow-inner placeholder:text-slate-300"
                placeholder="Ex: Solicitante virá buscar no final do dia..."
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
              />
            </div>
          </div>
        </form>

        <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 hover:border-slate-300 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedStudent || isSubmitting}
            className={`flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2
              ${!selectedStudent || isSubmitting 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                : 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-100'}`}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar Agendamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleLockerModal;
const Plus = ({ size, className }: { size: number, className: string }) => (
  <svg className={className} width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
);
