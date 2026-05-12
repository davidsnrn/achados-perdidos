import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Plus, Search, Filter, Calendar, 
  User, BookOpen, MapPin, Clock, CheckCircle2, 
  XCircle, UserPlus, AlertCircle, Save, Trash2,
  ChevronRight, ArrowLeft, Loader2, MoreVertical,
  GraduationCap, X, Pencil
} from 'lucide-react';
import { StorageService } from '../../services/storage';
import { TeacherSchedule, TeacherAttendance, User as UserType, Campus, TeacherClass } from '../../types';
import { Modal } from '../ui/Modal';

interface Props {
  user: UserType;
  campuses: Campus[];
  adminGlobalCampusId: string | null;
}

export const TeacherAttendanceTab: React.FC<Props> = ({ user, campuses, adminGlobalCampusId }) => {
  // States
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([]);
  const [attendances, setAttendances] = useState<TeacherAttendance[]>([]);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeSubTab, setActiveSubTab] = useState<'verificacao' | 'horarios' | 'grade' | 'turmas'>('verificacao');
  const [scheduleRows, setScheduleRows] = useState<{ class_name: string, subject: string, shorthand: string }[]>([
    { class_name: '', subject: '', shorthand: '' }
  ]);
  const [teacherName, setTeacherName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedShift, setSelectedShift] = useState<'M' | 'T' | 'N'>('M');
  
  // Modal States
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Partial<TeacherSchedule> | null>(null);
  const [bulkClassText, setBulkClassText] = useState('');
  const [originalTeacherName, setOriginalTeacherName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false);
  const [selectedScheduleForReplacement, setSelectedScheduleForReplacement] = useState<string | null>(null);
  const [searchTeacherReplacement, setSearchTeacherReplacement] = useState('');

  // Time slots mapping (IFRN Standard)
  const timeSlots = [
    { id: 1, label: '1', time: '07:00 - 07:45', shift: 'M' },
    { id: 2, label: '2', time: '07:45 - 08:30', shift: 'M' },
    { id: 3, label: '3', time: '08:50 - 09:35', shift: 'M' },
    { id: 4, label: '4', time: '09:35 - 10:20', shift: 'M' },
    { id: 5, label: '5', time: '10:30 - 11:15', shift: 'M' },
    { id: 6, label: '6', time: '11:15 - 12:00', shift: 'M' },
    { id: 7, label: '7', time: '13:00 - 13:45', shift: 'T' },
    { id: 8, label: '8', time: '13:45 - 14:30', shift: 'T' },
    { id: 9, label: '9', time: '14:50 - 15:35', shift: 'T' },
    { id: 10, label: '10', time: '15:35 - 16:20', shift: 'T' },
    { id: 11, label: '11', time: '16:30 - 17:15', shift: 'T' },
    { id: 12, label: '12', time: '17:15 - 18:00', shift: 'T' },
    { id: 13, label: '13', time: '19:00 - 19:45', shift: 'N' },
    { id: 14, label: '14', time: '19:45 - 20:30', shift: 'N' },
    { id: 15, label: '15', time: '20:45 - 21:30', shift: 'N' },
    { id: 16, label: '16', time: '21:30 - 22:15', shift: 'N' },
  ];

  const daysOfWeek = [
    { id: 2, label: 'Seg' },
    { id: 3, label: 'Ter' },
    { id: 4, label: 'Qua' },
    { id: 5, label: 'Qui' },
    { id: 6, label: 'Sex' },
  ];

  const isGlobalAdmin = user.role === 'admin' || user.role === 'advanced_global';
  const currentCampusId = isGlobalAdmin ? adminGlobalCampusId : (adminGlobalCampusId || user.campus_id);
  const currentDayOfWeek = new Date(selectedDate).getUTCDay() + 1;

  useEffect(() => {
    loadData();
  }, [currentCampusId, selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [schedulesData, attendanceData, classesData] = await Promise.all([
        StorageService.getTeacherSchedules(currentCampusId || undefined),
        StorageService.getTeacherAttendance(currentCampusId || undefined, selectedDate),
        StorageService.getTeacherClasses(currentCampusId || undefined)
      ]);
      setSchedules(schedulesData);
      setAttendances(attendanceData);
      setClasses(classesData);
      
      // Auto-select first class if none selected
      if (classesData.length > 0 && !selectedClass) {
        setSelectedClass(classesData[0].name);
      } else if (schedulesData.length > 0 && !selectedClass) {
        const uniqueClasses = [...new Set(schedulesData.map(s => s.class_name))].sort();
        setSelectedClass(uniqueClasses[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseShorthand = (code: string): { day: number, periods: number[] } | null => {
    // Regex for 2T12, 3M34, 4N12 etc.
    const match = code.toUpperCase().match(/^([2-7])([MTN])([1-6]+)$/);
    if (!match) return null;

    const day = parseInt(match[1]);
    const shift = match[2];
    const periodDigits = match[3].split('').map(Number);
    
    const baseMapping: Record<string, number> = { 'M': 0, 'T': 6, 'N': 12 };
    const base = baseMapping[shift];

    const periods = periodDigits.map(p => base + p).filter(p => p >= 1 && p <= 16);
    return { day, periods };
  };

  const handleShorthandChange = (code: string) => {
    setShorthandCode(code);
    const parsed = parseShorthand(code);
    if (parsed && editingSchedule) {
      // Just take the first period for start/end times if multiple
      const firstPeriod = timeSlots.find(ts => ts.id === parsed.periods[0]);
      const lastPeriod = timeSlots.find(ts => ts.id === parsed.periods[parsed.periods.length - 1]);
      
      if (firstPeriod && lastPeriod) {
        setEditingSchedule({
          ...editingSchedule,
          day_of_week: parsed.day - 1, // Store as 0-6
          period: parsed.periods[0],
          start_time: firstPeriod.time.split(' - ')[0],
          end_time: lastPeriod.time.split(' - ')[1]
        });
      }
    }
  };

  const handleSaveAttendance = async (scheduleId: string, status: 'PRESENTE' | 'SUBSTITUIDO' | 'VAGO', extra?: { substitute_name?: string, observation?: string }) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (!schedule) return;

      const attendance: TeacherAttendance = {
        campus_id: schedule.campus_id,
        schedule_id: scheduleId,
        date: selectedDate,
        status,
        substitute_name: extra?.substitute_name,
        observation: extra?.observation,
        operator_id: user.id
      };
      
      await StorageService.saveTeacherAttendance(attendance);
      await loadData();
    } catch (error) {
      alert('Erro ao salvar frequência');
    }
  };
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCampusId) {
      alert('Por favor, selecione um câmpus específico no topo da página antes de salvar horários.');
      return;
    }

    try {
      setIsSaving(true);
      
      // If we are editing (have an original name), delete old records first
      if (originalTeacherName) {
        const oldSchedules = schedules.filter(s => s.teacher_name === originalTeacherName && s.campus_id === currentCampusId);
        for (const s of oldSchedules) {
          await StorageService.deleteTeacherSchedule(s.id!);
        }
      }

      const allPromises: Promise<any>[] = [];
      for (const row of scheduleRows) {
        if (!row.class_name || !row.shorthand) continue;
        
        // Split shorthand by comma to support multiple codes in one field
        const shorthandParts = row.shorthand.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        for (const code of shorthandParts) {
          const parsed = parseShorthand(code);
          if (parsed) {
            parsed.periods.forEach(p => {
              const slot = timeSlots.find(ts => ts.id === p);
              allPromises.push(StorageService.saveTeacherSchedule({
                campus_id: currentCampusId,
                teacher_name: teacherName,
                class_name: row.class_name,
                subject: row.subject,
                day_of_week: parsed.day - 1,
                period: p,
                start_time: slot?.time.split(' - ')[0] || '',
                end_time: slot?.time.split(' - ')[1] || ''
              }));
            });
          }
        }
      }

      await Promise.all(allPromises);
      
      setIsScheduleModalOpen(false);
      setTeacherName('');
      setOriginalTeacherName(null);
      setScheduleRows([{ class_name: '', subject: '', shorthand: '' }]);
      await loadData();
    } catch (error) {
      alert('Erro ao salvar horário');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este horário?')) return;
    try {
      await StorageService.deleteTeacherSchedule(id);
      await loadData();
    } catch (error) {
      alert('Erro ao excluir horário');
    }
  };

  const handleBulkClassSave = async () => {
    if (!bulkClassText.trim()) return;
    if (!currentCampusId) {
      alert('Por favor, selecione um câmpus específico no topo da página antes de cadastrar turmas.');
      return;
    }
    try {
      setIsSaving(true);
      const classNames = bulkClassText.split('\n').map(name => name.trim()).filter(name => name.length > 0);
      
      const promises = classNames.map(async (name) => {
        try {
          await StorageService.saveTeacherClass({
            campus_id: currentCampusId || '',
            name
          });
        } catch (err) {
          // Ignore duplicates (409) or other individual errors to allow batch to continue
          console.warn(`Could not save class ${name}:`, err);
        }
      });

      await Promise.all(promises);
      
      setIsClassModalOpen(false);
      setBulkClassText('');
      await loadData();
    } catch (error) {
      console.error('Error in bulk save process:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta turma?')) return;
    try {
      await StorageService.deleteTeacherClass(id);
      await loadData();
    } catch (error) {
      alert('Erro ao excluir turma');
    }
  };

  // Helper to get attendance for a schedule
  const getAttendanceFor = (scheduleId: string) => attendances.find(a => a.schedule_id === scheduleId);

  // Helper to convert internal period/day back to shorthand code (IFRN)
  const getShorthandFrom = (day: number, period: number): string => {
    const slot = timeSlots.find(ts => ts.id === period);
    if (!slot) return '';
    
    // Convert 0-6 back to 2-7
    const dayCode = day + 1;
    const shift = slot.shift;
    
    // Convert slot ID back to 1-6 relative to shift
    const baseMapping: Record<string, number> = { 'M': 0, 'T': 6, 'N': 12 };
    const relativePeriod = period - baseMapping[shift];
    
    return `${dayCode}${shift}${relativePeriod}`;
  };

  // Filtered schedules for the list
  const displaySchedules = schedules.filter(s => {
    const matchesSearch = s.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeSubTab === 'verificacao') {
      const dateObj = new Date(selectedDate);
      const day = dateObj.getUTCDay();
      return s.day_of_week === day && matchesSearch;
    }
    return matchesSearch;
  }).sort((a, b) => {
    if (a.class_name !== b.class_name) return a.class_name.localeCompare(b.class_name);
    return a.period - b.period;
  });

  // Group schedules by teacher for the "Professores" tab
  const teacherGroups = displaySchedules.reduce((acc, schedule) => {
    if (!acc[schedule.teacher_name]) acc[schedule.teacher_name] = [];
    acc[schedule.teacher_name].push(schedule);
    return acc;
  }, {} as Record<string, TeacherSchedule[]>);

  const uniqueClasses = classes.map(c => c.name).sort();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Premium */}
      <div className="bg-white rounded-3xl p-6 shadow-xl shadow-indigo-100 border border-indigo-50 mb-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-50 rounded-full -ml-24 -mb-24 blur-3xl opacity-50"></div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <ClipboardList size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Frequência de Professores</h1>
              <p className="text-gray-500 font-medium">Controle e verificação diária de presença docente</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
              <button 
                onClick={() => setActiveSubTab('verificacao')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'verificacao' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Verificação
              </button>
              <button 
                onClick={() => setActiveSubTab('grade')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'grade' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Grade por Turma
              </button>
              <button 
                onClick={() => setActiveSubTab('horarios')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'horarios' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Professores
              </button>
              <button 
                onClick={() => setActiveSubTab('turmas')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'turmas' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Turmas
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6">
        {/* Filters & Actions */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            {activeSubTab !== 'grade' && (
              <div className="relative flex-1 max-w-md group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por professor, turma ou disciplina..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border-2 border-gray-100 rounded-xl text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-medium"
                />
              </div>
            )}

            {activeSubTab === 'grade' && (
              <div className="flex items-center gap-2 bg-indigo-50 p-1.5 rounded-xl border border-indigo-100">
                <Filter size={18} className="text-indigo-600 ml-2" />
                <select 
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="bg-transparent border-none text-sm font-bold text-indigo-800 outline-none cursor-pointer pr-8"
                >
                  <option value="">Selecione a Turma</option>
                  {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {activeSubTab === 'verificacao' && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-indigo-50 p-1.5 rounded-xl border border-indigo-100">
                  <Calendar size={18} className="text-indigo-600 ml-2" />
                  <input 
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="bg-transparent border-none text-sm font-bold text-indigo-800 outline-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2 bg-indigo-50 p-1.5 rounded-xl border border-indigo-100">
                  <Clock size={18} className="text-indigo-600 ml-2" />
                  <select 
                    value={selectedShift}
                    onChange={e => setSelectedShift(e.target.value as any)}
                    className="bg-transparent border-none text-sm font-bold text-indigo-800 outline-none cursor-pointer pr-8"
                  >
                    <option value="M">Manhã</option>
                    <option value="T">Tarde</option>
                    <option value="N">Noite</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-indigo-50 p-1.5 rounded-xl border border-indigo-100">
                  <Filter size={18} className="text-indigo-600 ml-2" />
                  <select 
                    value=""
                    onChange={e => {
                      if (e.target.value && !selectedClasses.includes(e.target.value)) {
                        setSelectedClasses([...selectedClasses, e.target.value]);
                      }
                    }}
                    className="bg-transparent border-none text-sm font-bold text-indigo-800 outline-none cursor-pointer pr-8"
                  >
                    <option value="">Adicionar Turma...</option>
                    {uniqueClasses.filter(c => !selectedClasses.includes(c)).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {selectedClasses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedClasses.map(c => (
                      <span key={c} className="flex items-center gap-1 bg-white border-2 border-indigo-100 text-indigo-600 px-2 py-1 rounded-lg text-xs font-black">
                        {c}
                        <button onClick={() => setSelectedClasses(selectedClasses.filter(sc => sc !== c))}>
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                    <button 
                      onClick={() => setSelectedClasses([])}
                      className="text-xs text-gray-400 hover:text-red-500 font-bold"
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {activeSubTab === 'horarios' && (
            <button 
              onClick={() => { 
                setTeacherName(''); 
                setOriginalTeacherName(null);
                setScheduleRows([{ class_name: '', subject: '', shorthand: '' }]); 
                setIsScheduleModalOpen(true); 
              }}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus size={20} />
              Adicionar Professor
            </button>
          )}

          {activeSubTab === 'turmas' && (
            <button 
              onClick={() => { setBulkClassText(''); setIsClassModalOpen(true); }}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus size={20} />
              Cadastrar em Lote
            </button>
          )}
        </div>

        {/* View Switcher */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border border-dashed border-gray-200">
            <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
            <p className="text-gray-500 font-bold">Carregando dados...</p>
          </div>
        ) : activeSubTab === 'turmas' ? (
          /* TURMAS VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <GraduationCap size={40} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhuma turma cadastrada</h3>
                <p className="text-gray-500 mb-6">Comece cadastrando as turmas da instituição.</p>
                <button 
                  onClick={() => setIsClassModalOpen(true)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  Cadastrar Turmas
                </button>
              </div>
            ) : (
              classes.map(c => (
                <div key={c.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                      <GraduationCap size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-lg">{c.name}</h3>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Turma</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteClass(c.id!)}
                    className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : activeSubTab === 'grade' ? (
          /* GRID VIEW */
          <div className="bg-white rounded-3xl p-4 shadow-xl border border-gray-100 overflow-x-auto">
            <div className="min-w-[1000px]">
              <div className="text-center mb-6">
                <h2 className="text-4xl font-black text-gray-900">{selectedClass || "Selecione uma turma"}</h2>
                <p className="text-gray-400 text-sm mt-1">Horário Semanal de Aulas</p>
              </div>
              
              <table className="w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="p-4 bg-gray-50 rounded-2xl w-32"></th>
                    {daysOfWeek.map(day => (
                      <th key={day.id} className="p-4 bg-indigo-600 text-white rounded-2xl text-xl font-black min-w-[150px]">
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['M', 'T', 'N'].map(shiftCode => (
                    <React.Fragment key={shiftCode}>
                      {/* SHIFT HEADER ROW */}
                      <tr className="h-4"></tr>
                      <tr className="bg-gray-100">
                        <td colSpan={daysOfWeek.length + 1} className="py-2 px-4 rounded-xl text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
                          Turno {shiftCode === 'M' ? 'Manhã' : shiftCode === 'T' ? 'Tarde' : 'Noite'}
                        </td>
                      </tr>
                      {timeSlots.filter(s => s.shift === shiftCode).map(slot => (
                        <tr key={slot.id} className="group">
                          <td className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                            <div className="text-indigo-600 font-black text-lg leading-none mb-1">{slot.label}º Aula</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase whitespace-nowrap">{slot.time}</div>
                          </td>
                          {daysOfWeek.map(day => {
                            const schedule = schedules.find(s => 
                              s.class_name === selectedClass && 
                              s.day_of_week === day.id - 1 && 
                              s.period === slot.id
                            );

                            return (
                              <td key={`${day.id}-${slot.id}`} className="p-1 border border-gray-100 rounded-2xl bg-white/50 min-h-[80px] w-[180px]">
                                {schedule ? (
                                  <div className="h-full bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-3 flex flex-col justify-center text-center animate-in zoom-in-95 duration-300">
                                    <div className="text-[11px] font-black text-indigo-700 uppercase leading-tight mb-1">{schedule.subject}</div>
                                    <div className="text-[10px] font-bold text-gray-500 truncate">{schedule.teacher_name}</div>
                                  </div>
                                ) : (
                                  <div className="h-full min-h-[60px] border border-dashed border-gray-50 rounded-2xl"></div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeSubTab === 'horarios' ? (
          /* GROUPED TEACHER VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(teacherGroups).length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <User size={40} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum professor encontrado</h3>
                <p className="text-gray-500 mb-6">Comece adicionando os horários dos professores.</p>
                <button 
                  onClick={() => { setTeacherName(''); setScheduleRows([{ class_name: '', subject: '', shorthand: '' }]); setIsScheduleModalOpen(true); }}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  Adicionar Professor
                </button>
              </div>
            ) : (
              Object.entries(teacherGroups).map(([name, teacherSchedules]) => (
                <div key={name} className="bg-white rounded-[32px] p-6 shadow-sm border-2 border-gray-100 hover:border-indigo-200 transition-all group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                        <User size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 text-lg leading-tight">{name}</h3>
                        <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">{teacherSchedules.length} {teacherSchedules.length === 1 ? 'Horário' : 'Horários'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          setTeacherName(name);
                          setOriginalTeacherName(name);
                          
                          // Group by class and subject for cleaner rows
                          const groupedRows: Record<string, string[]> = {};
                          teacherSchedules.forEach(s => {
                            const key = `${s.class_name}|||${s.subject}`;
                            if (!groupedRows[key]) groupedRows[key] = [];
                            groupedRows[key].push(getShorthandFrom(s.day_of_week, s.period));
                          });

                          const rows = Object.entries(groupedRows).map(([key, shorthands]) => {
                            const [class_name, subject] = key.split('|||');
                            return {
                              class_name,
                              subject,
                              shorthand: Array.from(new Set(shorthands)).join(', ')
                            };
                          });
                          
                          setScheduleRows(rows);
                          setIsScheduleModalOpen(true);
                        }}
                        className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      >
                        <Pencil size={20} />
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm(`Excluir todos os ${teacherSchedules.length} horários de ${name}?`)) {
                            for (const s of teacherSchedules) {
                              await StorageService.deleteTeacherSchedule(s.id!);
                            }
                            await loadData();
                          }
                        }}
                        className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(
                      teacherSchedules.reduce((acc, s) => {
                        const key = `${s.class_name}|||${s.subject}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(s);
                        return acc;
                      }, {} as Record<string, TeacherSchedule[]>)
                    ).map(([key, group]) => {
                      const [className, subject] = key.split('|||');
                      const shorthands = Array.from(new Set(group.map(s => getShorthandFrom(s.day_of_week, s.period)))).join(', ');
                      
                      return (
                        <div key={key} className="p-3 bg-gray-50 rounded-2xl">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-indigo-600 text-xs uppercase tracking-wider">{className}</span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter bg-white px-2 py-0.5 rounded-md border border-gray-100 shadow-sm">
                              {shorthands}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-gray-700">{subject}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* VERIFICAÇÃO VIEW (GRID MODE) */
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 overflow-x-auto">
            <div className="min-w-max">
              <table className="w-full border-separate border-spacing-2">
                <thead>
                  <tr>
                    <th className="p-4 bg-gray-50 rounded-2xl w-32"></th>
                    {(selectedClasses.length > 0 ? selectedClasses : [...new Set(schedules.map(s => s.class_name))].sort()).map(className => (
                      <th key={className} className="p-4 bg-indigo-600 text-white rounded-2xl text-lg font-black min-w-[250px]">
                        {className}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.filter(s => s.shift === selectedShift).map(slot => (
                    <tr key={slot.id}>
                      <td className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                        <div className="text-indigo-600 font-black text-lg leading-none mb-1">{slot.label}º Aula</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase whitespace-nowrap">{slot.time}</div>
                      </td>
                      {(selectedClasses.length > 0 ? selectedClasses : [...new Set(schedules.map(s => s.class_name))].sort()).map(className => {
                        const dayNum = new Date(selectedDate).getUTCDay();
                        const schedule = schedules.find(s => 
                          s.class_name === className && 
                          s.day_of_week === dayNum && 
                          s.period === slot.id
                        );

                        if (!schedule) return <td key={className} className="p-2 bg-gray-50/30 rounded-2xl border border-dashed border-gray-100"></td>;

                        const attendance = getAttendanceFor(schedule.id!);
                        
                        return (
                          <td key={className} className="p-2">
                            <div className={`h-full rounded-2xl p-4 border-2 transition-all flex flex-col justify-between min-h-[160px] ${
                              attendance?.status === 'PRESENTE' ? 'bg-green-50 border-green-200 shadow-sm' :
                              attendance?.status === 'SUBSTITUIDO' ? 'bg-yellow-50 border-yellow-200 shadow-sm' :
                              attendance?.status === 'VAGO' ? 'bg-red-50 border-red-200 shadow-sm' :
                              'bg-white border-gray-100 hover:border-indigo-200'
                            }`}>
                              <div>
                                <div className="text-xs font-black text-indigo-600 uppercase mb-1 truncate">
                                  {attendance?.status === 'SUBSTITUIDO' ? (
                                    <span className="text-yellow-700">SUBSTITUÍDO POR:</span>
                                  ) : schedule.teacher_name}
                                </div>
                                
                                {attendance?.status === 'SUBSTITUIDO' ? (
                                  <div className="text-sm font-black text-yellow-800 uppercase truncate">
                                    {attendance.substitute_name}
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-bold text-gray-400 uppercase truncate">{schedule.subject}</div>
                                )}
                                
                                {attendance?.status === 'VAGO' && attendance?.observation && (
                                  <div className="mt-2 p-1.5 bg-red-100/50 rounded-lg text-[9px] text-red-700 font-bold flex items-center gap-1">
                                    <AlertCircle size={10} /> {attendance.observation}
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-1 mt-4">
                                <button 
                                  onClick={() => handleSaveAttendance(schedule.id!, 'PRESENTE', { observation: '' })}
                                  title="Presente"
                                  className={`flex-1 p-2 rounded-xl border transition-all flex items-center justify-center ${
                                    attendance?.status === 'PRESENTE' ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-green-300 hover:text-green-600'
                                  }`}
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                                <button 
                                  onClick={() => {
                                    setSelectedScheduleForReplacement(schedule.id!);
                                    setIsReplacementModalOpen(true);
                                  }}
                                  title="Substituído"
                                  className={`flex-1 p-2 rounded-xl border transition-all flex items-center justify-center ${
                                    attendance?.status === 'SUBSTITUIDO' ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-yellow-300 hover:text-yellow-600'
                                  }`}
                                >
                                  <UserPlus size={16} />
                                </button>
                                <button 
                                  onClick={() => {
                                    const obs = prompt('Observação:', attendance?.observation || '');
                                    if (obs !== null) handleSaveAttendance(schedule.id!, 'VAGO', { observation: obs });
                                  }}
                                  title="Vago"
                                  className={`flex-1 p-2 rounded-xl border transition-all flex items-center justify-center ${
                                    attendance?.status === 'VAGO' ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-red-300 hover:text-red-600'
                                  }`}
                                >
                                  <XCircle size={16} />
                                </button>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Professores/Horários */}
      <Modal 
        isOpen={isScheduleModalOpen} 
        onClose={() => setIsScheduleModalOpen(false)}
        title="Cadastrar Professor e Horários"
      >
        <form onSubmit={handleSaveSchedule} className="p-8">
          {!currentCampusId && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-start gap-3">
              <AlertCircle className="text-red-500 shrink-0" size={20} />
              <p className="text-sm text-red-700 font-bold">
                Você está em "Todos os Câmpus". Selecione um câmpus específico no topo da página para poder cadastrar horários.
              </p>
            </div>
          )}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nome do Professor(a)</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text"
                  required
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all outline-none"
                  placeholder="Nome do docente"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Turmas e Horários</h3>
                <button 
                  type="button"
                  onClick={() => setScheduleRows([...scheduleRows, { class_name: '', subject: '', shorthand: '' }])}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus size={18} />
                  Adicionar Linha
                </button>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {scheduleRows.map((row, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 relative group">
                    {scheduleRows.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => setScheduleRows(scheduleRows.filter((_, i) => i !== index))}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X size={16} />
                      </button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Turma</label>
                        <select 
                          required
                          className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0 transition-all outline-none text-sm"
                          value={row.class_name}
                          onChange={(e) => {
                            const newRows = [...scheduleRows];
                            newRows[index].class_name = e.target.value;
                            setScheduleRows(newRows);
                          }}
                        >
                          <option value="">Selecione a Turma</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Disciplina</label>
                        <input 
                          type="text"
                          required
                          className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0 transition-all outline-none text-sm"
                          placeholder="Ex: Matemática II"
                          value={row.subject}
                          onChange={(e) => {
                            const newRows = [...scheduleRows];
                            newRows[index].subject = e.target.value;
                            setScheduleRows(newRows);
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Código de Horário (Ex: 2T12)</label>
                      <input 
                        type="text"
                        required
                        name={`shorthand-${index}`}
                        autoComplete="off"
                        className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0 transition-all outline-none text-sm font-mono uppercase"
                        placeholder="Ex: 2T12, 3M34"
                        value={row.shorthand}
                        onChange={(e) => {
                          const newRows = [...scheduleRows];
                          newRows[index].shorthand = e.target.value;
                          setScheduleRows(newRows);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <button 
              type="button"
              onClick={() => {
                setIsScheduleModalOpen(false);
                setTeacherName('');
                setOriginalTeacherName(null);
                setScheduleRows([{ class_name: '', subject: '', shorthand: '' }]);
              }}
              className="flex-1 px-6 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="flex-1 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Salvar Tudo
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Class Modal */}
      {isClassModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-700 p-8 text-white flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black mb-1">Cadastrar Turmas em Lote</h2>
                <p className="text-indigo-100 font-medium">Adicione várias turmas de uma vez</p>
              </div>
              <button 
                onClick={() => setIsClassModalOpen(false)}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              {!currentCampusId && (
                <div className="mb-6 p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="text-red-500 shrink-0" size={20} />
                  <p className="text-sm text-red-700 font-bold">
                    Você está em "Todos os Câmpus". Selecione um câmpus específico no topo da página para poder cadastrar turmas.
                  </p>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Lista de Turmas (Uma por linha)</label>
                <textarea 
                  rows={10}
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-4 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                  placeholder="Ex:&#10;ADM1M&#10;ADM2M&#10;INF1M&#10;INF2M"
                  value={bulkClassText}
                  onChange={e => setBulkClassText(e.target.value)}
                />
                <p className="text-[11px] text-gray-400 mt-2 font-bold uppercase tracking-wider">Dica: Cada linha criará uma turma diferente.</p>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setIsClassModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-2xl font-black hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBulkClassSave}
                  disabled={isSaving || !bulkClassText.trim()}
                  className="flex-[2] px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  Cadastrar Turmas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Seleção de Professor Substituto */}
      <Modal
        isOpen={isReplacementModalOpen}
        onClose={() => setIsReplacementModalOpen(false)}
        title="Selecionar Professor Substituído"
      >
        <div className="p-8">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all outline-none"
                placeholder="Buscar professor cadastrado..."
                value={searchTeacherReplacement}
                onChange={(e) => setSearchTeacherReplacement(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {Array.from(new Set(schedules.map(s => s.teacher_name)))
              .filter(name => name.toLowerCase().includes(searchTeacherReplacement.toLowerCase()))
              .sort()
              .map(name => (
                <button
                  key={name}
                  onClick={() => {
                    if (selectedScheduleForReplacement) {
                      handleSaveAttendance(selectedScheduleForReplacement, 'SUBSTITUIDO', { 
                        substitute_name: name,
                        observation: '' // Limpa o "Sem aula" ao substituir
                      });
                      setIsReplacementModalOpen(false);
                      setSearchTeacherReplacement('');
                    }
                  }}
                  className="w-full text-left p-4 hover:bg-indigo-50 rounded-2xl border-2 border-transparent hover:border-indigo-100 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-700 group-hover:text-indigo-600">{name}</span>
                    <UserPlus size={18} className="text-gray-300 group-hover:text-indigo-400" />
                  </div>
                </button>
              ))
            }
          </div>
        </div>
      </Modal>
    </div>
  );
};
