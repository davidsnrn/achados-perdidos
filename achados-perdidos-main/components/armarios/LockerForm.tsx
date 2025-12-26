import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Locker, Student, LoanData } from '../../types-armarios';
import { analyzeLoanObservation } from '../../services/armarios/geminiService';

interface LockerFormProps {
  selectedLocker: Locker | null;
  students: Student[];
  onSubmit: (data: LoanData) => void;
  onCancel: () => void;
}

const LockerForm: React.FC<LockerFormProps> = ({ selectedLocker, students, onSubmit, onCancel }) => {
  const [studentSearch, setStudentSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<LoanData>>({
    id: Math.floor(1000 + Math.random() * 9000).toString(),
    lockerNumber: selectedLocker?.number || 0,
    physicalLocation: selectedLocker?.location || '',
    registrationNumber: '',
    studentName: '',
    studentClass: '',
    loanDate: new Date().toISOString().split('T')[0],
    returnDate: '',
    observation: '',
  });

  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ keywords: string[], summary: string } | null>(null);

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

  const searchResults = useMemo(() => {
    const terms = studentSearch.toLowerCase().split(' ').filter(t => t.length > 0);
    if (terms.length === 0) return [];

    return students.filter(s => {
      const studentStr = `${s.registration} ${s.name} ${s.course} `.toLowerCase();
      return terms.every(term => studentStr.includes(term));
    }).slice(0, 8);
  }, [studentSearch, students]);

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

  const handleAiAnalyze = async () => {
    if (!formData.observation) return;
    setAiAnalyzing(true);
    const result = await analyzeLoanObservation(formData.observation);
    if (result) setAiSummary(result);
    setAiAnalyzing(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.studentName && formData.registrationNumber && formData.lockerNumber) {
      onSubmit(formData as LoanData);
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
          <div className="relative">
            <input
              type="text"
              placeholder="Digite partes do nome ou matrícula..."
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-slate-800 font-bold focus:border-blue-500 outline-none transition-all shadow-inner placeholder:text-slate-300"
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>

          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-3xl shadow-2xl z-50 overflow-hidden animate-slide-up">
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
              required
              name="studentClass"
              placeholder="Ex: INFO3M"
              className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-bold focus:border-green-500 outline-none transition-all shadow-sm"
              value={formData.studentClass}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Início</label>
            <div className="relative">
              <input type="date" name="loanDate" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-bold outline-none" value={formData.loanDate} onChange={handleInputChange} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-1">Previsão Devolução</label>
            <input required type="date" name="returnDate" className="w-full bg-white border-2 border-red-50 rounded-2xl p-4 text-red-600 font-black outline-none focus:border-red-500 shadow-sm" value={formData.returnDate} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ID Registro</label>
            <input readOnly className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-400 font-mono text-xs" value={formData.id} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Observações</label>
            <button type="button" onClick={handleAiAnalyze} disabled={aiAnalyzing || !formData.observation} className="text-[10px] font-black text-green-700 flex items-center gap-2 hover:bg-green-50 px-3 py-1 rounded-lg transition-all disabled:opacity-30">
              <svg className={`w - 3.5 h - 3.5 ${aiAnalyzing ? 'animate-spin' : ''} `} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              RESUMIR COM IA
            </button>
          </div>
          <textarea name="observation" rows={3} placeholder="Condição da chave, autorizações especiais..." className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-slate-800 font-medium focus:border-green-500 outline-none transition-all resize-none shadow-sm" value={formData.observation} onChange={handleInputChange} />
        </div>

        {aiSummary && (
          <div className="p-5 bg-green-50 border-2 border-green-100 rounded-3xl animate-fade-in flex items-start gap-4">
            <div className="bg-green-600 text-white p-2 rounded-xl">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 10-2 0v1a1 1 0 102 0zM13 16v-1a1 1 0 10-2 0v1a1 1 0 102 0zM14.586 11H12.414l.829-2.316a1 1 0 00-1.886-.668l-1 2.8a1 1 0 00.943 1.336h2.172l-.829 2.316a1 1 0 001.886.668l1-2.8a1 1 0 00-.943-1.336z" /></svg>
            </div>
            <div>
              <p className="text-[10px] font-black text-green-800 uppercase mb-1 tracking-widest">Sugestão da IA</p>
              <p className="text-sm text-green-900 font-bold leading-relaxed">"{aiSummary.summary}"</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 pt-6">
          <button type="submit" className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-green-100 transition-all transform active:scale-95 text-lg uppercase tracking-widest">Gravar Empréstimo</button>
          <button type="button" onClick={onCancel} className="flex-1 border-2 border-slate-100 text-slate-400 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase text-sm tracking-widest">Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default LockerForm;
