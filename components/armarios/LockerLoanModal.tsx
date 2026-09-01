import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Phone, BookOpen, Clock, Loader2, Search, Calendar, FileText } from 'lucide-react';
import { Locker, Student, LoanData } from '../../types-armarios';
import { StorageService } from '../../services/storage';


interface LockerLoanModalProps {
  locker: Locker;
  operatorName?: string;
  onClose: () => void;
  onSubmit: (data: LoanData) => void;
}

const LockerLoanModal: React.FC<LockerLoanModalProps> = ({ 
  locker, 
  operatorName, 
  onClose, 
  onSubmit 
}) => {
  const [studentSearch, setStudentSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const [formData, setFormData] = useState<Partial<LoanData>>({
    id: Math.random().toString(36).substr(2, 6).toUpperCase(),
    lockerNumber: locker.number,
    physicalLocation: locker.location || '',
    registrationNumber: '',
    studentName: '',
    studentEmail: '',
    studentPhone: '',
    studentClass: '',
    loanDate: new Date().toLocaleDateString('en-CA'),
    observation: '',
    loanBy: operatorName || '',
    loanTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    campus_id: locker.campus_id
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (val?: string) => {
    const query = val !== undefined ? val : studentSearch;
    if (query.trim().length >= 2) {
      setIsSearching(true);
      setShowSearchDropdown(true);
      try {
        const results = await StorageService.searchPeople(query, 10, locker.campus_id);
        const students = results
          .map(p => ({
            registration: p.matricula,
            name: p.name,
            course: '',
            situation: 'Ativo',
            email: p.email || '',
            phone: p.phone || ''
          } as Student));
        setSearchResults(students);
      } catch (error) {
        console.error("Erro na busca de alunos:", error);
      } finally {
        setIsSearching(false);
      }
    }
  };

  const selectStudent = (student: Student) => {
    setFormData(prev => ({
      ...prev,
      registrationNumber: student.registration,
      studentName: student.name,
      studentEmail: student.email || prev.studentEmail,
      studentPhone: student.phone ? formatPhone(student.phone) : prev.studentPhone,
      studentClass: student.course || prev.studentClass
    }));
    setStudentSearch(student.name);
    setShowSearchDropdown(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'studentPhone') {
      setFormData(prev => ({ ...prev, studentPhone: formatPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.studentName && formData.registrationNumber) {
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Atualizar o telefone da pessoa no banco se foi preenchido/alterado
      if (formData.studentPhone && formData.registrationNumber) {
        const rawPhone = formData.studentPhone.replace(/\D/g, '');
        try {
          await StorageService.updatePersonPhone(formData.registrationNumber, rawPhone);
        } catch (err) {
          console.error('Erro ao atualizar telefone da pessoa:', err);
        }
      }

      onSubmit({ ...formData, loanTime: now } as LoanData);
    }
  };

  const isFormValid = formData.studentName && formData.registrationNumber;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-[151] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-8 pb-6 flex items-center gap-6">
          <div className="w-20 h-20 bg-green-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-green-100 ring-8 ring-green-50">
            <BookOpen size={36} />
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Empréstimo de Armário #{locker.number}</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
              {locker.location}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-8 pb-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Alerta Informativo */}
          <div className="bg-green-50 border border-green-100 p-4 rounded-2xl flex items-center gap-4">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white shrink-0">
              <Clock size={20} />
            </div>
            <p className="text-green-700 text-[11px] font-bold uppercase leading-relaxed tracking-wide">
              O empréstimo ocupará o armário imediatamente. O solicitante deve estar presente para receber a chave.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Busca de Aluno */}
            <div className="relative" ref={dropdownRef}>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
                1. Buscar Aluno/Servidor (Nome ou Matrícula)
              </label>
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Digite para pesquisar..."
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 pl-14 text-slate-800 font-bold focus:border-green-500 focus:bg-white outline-none transition-all shadow-inner group-hover:border-slate-200"
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    if (e.target.value.length >= 2) handleSearch(e.target.value);
                    else { setSearchResults([]); setShowSearchDropdown(false); }
                  }}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchDropdown(true);
                  }}
                />
                <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-green-500 transition-colors" strokeWidth={3} />
                {isSearching && (
                  <Loader2 size={20} className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-green-500" />
                )}
              </div>

              {showSearchDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-3xl shadow-2xl z-50 overflow-hidden animate-slide-up">
                  {searchResults.map(s => (
                    <button
                      key={s.registration}
                      type="button"
                      onClick={() => selectStudent(s)}
                      className="w-full p-4 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center group"
                    >
                      <div>
                        <p className="font-black text-slate-800 uppercase text-xs group-hover:text-green-600 transition-colors">{s.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{s.registration} • {s.course}</p>
                      </div>
                      <X size={16} className="text-transparent group-hover:text-green-400 rotate-45" />
                    </button>
                  ))}
                  {searchResults.length === 0 && !isSearching && (
                    <div className="p-4 text-center text-slate-400 font-bold text-xs italic">Nenhuma pessoa encontrada</div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Turma / Curso */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block">
                  2. Turma (Opcional)
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    name="studentClass"
                    placeholder="Ex: TADS3V"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 pl-14 text-slate-800 font-bold focus:border-green-500 focus:bg-white outline-none transition-all shadow-inner"
                    value={formData.studentClass}
                    onChange={handleInputChange}
                  />
                  <BookOpen size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                </div>
              </div>

              {/* Telefone / Contato */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block">
                  Telefone (Opcional)
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    name="studentPhone"
                    placeholder="(00) 00000-0000"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 pl-14 text-slate-800 font-bold focus:border-green-500 focus:bg-white outline-none transition-all shadow-inner"
                    value={formData.studentPhone || ''}
                    onChange={handleInputChange}
                  />
                  <Phone size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block">
                3. Observação Adicional
              </label>
              <div className="relative group">
                <textarea
                  name="observation"
                  rows={3}
                  placeholder="Ex: Solicitante pegou chave extra, condição da porta..."
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-5 text-slate-800 font-medium focus:border-green-500 focus:bg-white outline-none transition-all shadow-inner resize-none"
                  value={formData.observation}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-50 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-white border-2 border-slate-100 p-5 rounded-2xl text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-100 hover:text-slate-600 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className={`flex-1 p-5 rounded-2xl text-white font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-green-100 transform active:scale-95 ${isFormValid ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-200 cursor-not-allowed opacity-70'}`}
          >
            Confirmar Empréstimo
          </button>
        </div>
      </div>
    </div>
  );
};

export default LockerLoanModal;
