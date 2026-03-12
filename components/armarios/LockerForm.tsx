import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Locker, Student, LoanData } from '../../types-armarios';
import { StorageService } from '../../services/storage';
import { PersonType } from '../../types';
import { Loader2 } from 'lucide-react';


interface LockerFormProps {
  selectedLocker: Locker | null;
  onSubmit: (data: LoanData) => void;
  onCancel: () => void;
  operatorName?: string;
}

const LockerForm: React.FC<LockerFormProps> = ({ selectedLocker, onSubmit, onCancel, operatorName }) => {
  const [studentSearch, setStudentSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<LoanData>>({
    id: Math.floor(1000 + Math.random() * 9000).toString(),
    lockerNumber: selectedLocker?.number || 0,
    physicalLocation: selectedLocker?.location || '',
    registrationNumber: '',
    studentName: '',
    studentClass: '',
    loanDate: new Date().toLocaleDateString('en-CA'), // Formato YYYY-MM-DD local
    returnDate: '',
    observation: '',
    loanBy: operatorName || '',
    loanTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  });



  // Fecha o dropdown se clicar fora
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
        const campusId = selectedLocker?.campus_id;
        const results = await StorageService.searchPeople(query, 10, campusId);
        setSearchResults(results
          .filter(p => p.type === PersonType.STUDENT)
          .map(p => ({
            registration: p.matricula,
            name: p.name,
            course: '',
            situation: 'Matriculado',
            email: ''
          } as Student))
          .slice(0, 8)
        );
      } catch (error) {
        console.error("Erro na busca de alunos:", error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
  };

  const selectStudent = (student: Student) => {
    setFormData(prev => ({
      ...prev,
      registrationNumber: student.registration,
      studentName: student.name,
      studentClass: student.course
    }));
    setStudentSearch(student.name);
    setShowSearchDropdown(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.studentName && formData.registrationNumber && formData.lockerNumber) {
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      onSubmit({ ...formData, loanTime: now } as LoanData);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-4xl mx-auto my-10 animate-fade-in relative z-[70]">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Novo Empréstimo</h2>
          <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-wide">Armário #{formData.lockerNumber} - {selectedLocker?.location}</p>
        </div>
        <button onClick={onCancel} className="text-slate-300 hover:text-slate-500 p-2 bg-slate-50 rounded-xl transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Campo de busca inteligente antes de tudo */}
        <div className="relative" ref={dropdownRef}>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Buscar Aluno (Nome ou Matrícula)</label>
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Digite partes do nome ou matrícula..."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-slate-800 font-bold focus:border-blue-500 outline-none transition-all shadow-inner placeholder:text-slate-300"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  if (e.target.value.length < 2) setSearchResults([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowSearchDropdown(true);
                }}
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Loader2 size={16} className="animate-spin text-blue-500" />
                </div>
              )}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSearch()}
              className="px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-md"
            >
              Buscar
            </button>
          </div>

          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white border border-slate-100 rounded-3xl shadow-2xl z-50 overflow-hidden animate-slide-up">
              {searchResults.map(s => (
                <button
                  key={s.registration}
                  type="button"
                  onClick={() => selectStudent(s)}
                  className="w-full p-4 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center group transition-colors"
                >
                  <div>
                    <p className="font-black text-slate-800 uppercase text-xs group-hover:text-blue-600 transition-colors">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{s.registration} • {s.course}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-200 group-hover:text-blue-400 transform translate-x-0 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}
            </div>
          )}
          {studentSearch.length >= 2 && !isSearching && searchResults.length === 0 && showSearchDropdown && (
            <div className="absolute top-full mt-2 w-full bg-white border border-slate-100 rounded-3xl p-4 text-center text-xs text-slate-400 font-bold italic shadow-2xl z-50 animate-slide-up">
              Nenhum aluno encontrado
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Matrícula</label>
            <input
              readOnly
              name="registrationNumber"
              placeholder="0000000000"
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-bold outline-none cursor-default"
              value={formData.registrationNumber}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
            <input
              readOnly
              name="studentName"
              placeholder="Preenchido automaticamente"
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-bold outline-none cursor-default"
              value={formData.studentName}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Turma/Curso</label>
            <input
              name="studentClass"
              placeholder="Ex: INFO3M"
              className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-bold focus:border-green-500 outline-none transition-all shadow-sm"
              value={formData.studentClass}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Início</label>
            <div className="relative">
              <input type="date" name="loanDate" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-bold outline-none" value={formData.loanDate} onChange={handleInputChange} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ID Registro</label>
            <input readOnly className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-400 font-mono text-xs" value={formData.id} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Observações</label>
          </div>
          <textarea name="observation" rows={3} placeholder="Condição da chave, autorizações especiais..." className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-medium focus:border-green-500 outline-none transition-all resize-none shadow-sm" value={formData.observation} onChange={handleInputChange} />
        </div>



        <div className="flex flex-col sm:flex-row gap-4 pt-6">
          <button type="submit" className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-green-100 transition-all transform active:scale-95 text-lg uppercase tracking-widest">Gravar Empréstimo</button>
          <button type="button" onClick={onCancel} className="flex-1 border-2 border-slate-100 text-slate-400 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase text-sm tracking-widest">Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default LockerForm;
