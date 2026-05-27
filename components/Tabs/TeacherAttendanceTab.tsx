import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardList, Plus, Search, Filter, Calendar,
  User, BookOpen, MapPin, Clock, CheckCircle2,
  XCircle, UserPlus, AlertCircle, Save, Trash2,
  ChevronRight, ArrowLeft, Loader2, MoreVertical,
  GraduationCap, X, Pencil, BarChart2, ChevronUp, ChevronDown, Printer, Check,
  ChevronLeft
} from 'lucide-react';
import { StorageService } from '../../services/storage';
import { TeacherSchedule, TeacherAttendance, User as UserType, Campus, TeacherClass, Person, UserLevel, TeacherPlannedAbsence, TeacherReposicao } from '../../types';
import { Modal } from '../ui/Modal';

interface Props {
  user: UserType;
  campuses: Campus[];
  adminGlobalCampusId: string | null;
}

export const TeacherAttendanceTab: React.FC<Props> = ({ user, campuses, adminGlobalCampusId }) => {
  // States
  const isUserStandard = user.level === UserLevel.STANDARD;
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([]);
  const [attendances, setAttendances] = useState<TeacherAttendance[]>([]);
  const [plannedAbsences, setPlannedAbsences] = useState<TeacherPlannedAbsence[]>([]);
  const [reposicoes, setReposicoes] = useState<TeacherReposicao[]>([]);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [gradeWeekDate, setGradeWeekDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeSubTab, setActiveSubTab] = useState<'verificacao' | 'horarios' | 'grade' | 'turmas' | 'relatorio' | 'ausencias' | 'substituicoes' | 'remanejamentos' | 'reposicoes'>(
    isUserStandard ? 'grade' : 'verificacao'
  );
  
  // Remanejamento Modal States
  const [isRemanejamentoModalOpen, setIsRemanejamentoModalOpen] = useState(false);
  const [remanejamentoTeacher, setRemanejamentoTeacher] = useState('');
  const [remanejamentoProposals, setRemanejamentoProposals] = useState<Array<{
    id: string;
    original_date: string;
    schedule_id: string;
    is_reposicao: boolean;
    new_date: string;
    new_period: number;
    absent_key: string;
    observation: string;
  }>>([{ id: '1', original_date: '', schedule_id: '', is_reposicao: false, new_date: '', new_period: 0, absent_key: '', observation: '' }]);
  const [remanejamentoConflicts, setRemanejamentoConflicts] = useState<Record<string, {
    teacher: string | null;
    class: string | null;
    room: string | null;
  }>>({}); 


  // Substitution States
  const [substitutionWeekDate, setSubstitutionWeekDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubstitutionModalOpen, setIsSubstitutionModalOpen] = useState(false);
  const [selectedAbsenceForSubstitution, setSelectedAbsenceForSubstitution] = useState<{
    type: 'planned' | 'attendance';
    id: string;
    schedule_id: string;
    period: number;
    date: string;
    teacher_name: string;
    class_name: string;
    subject: string;
    substitute_name?: string;
  } | null>(null);
  const [searchSubstitutionTeacher, setSearchSubstitutionTeacher] = useState('');

  useEffect(() => {
    const newConflicts: Record<string, { teacher: string | null; class: string | null; room: string | null }> = {};

    for (const proposal of remanejamentoProposals) {
      const { schedule_id, new_date, new_period } = proposal;
      if (!remanejamentoTeacher || !schedule_id || !new_date || !new_period) {
        newConflicts[proposal.id] = { teacher: null, class: null, room: null };
        continue;
      }

      const schedule = schedules.find(s => s.id === schedule_id);
      if (!schedule) continue;

      const newDayOfWeek = new Date(new_date + 'T12:00:00').getDay();
      let teacherConflict: string | null = null;
      let classConflict: string | null = null;
      let roomConflict: string | null = null;

      // 1. Teacher Conflict
      const teacherWeekly = schedules.find(s =>
        s.teacher_name === remanejamentoTeacher &&
        s.day_of_week === newDayOfWeek &&
        (s.period === new_period || s.periods?.includes(new_period))
      );
      const teacherRepo = reposicoes.find(r =>
        r.teacher_name === remanejamentoTeacher &&
        r.status === 'CONCLUIDO' &&
        r.makeup_date === new_date &&
        r.makeup_period === new_period
      );
      if (teacherWeekly) {
        teacherConflict = `Docente tem aula semanal com a turma ${teacherWeekly.class_name}`;
      } else if (teacherRepo) {
        teacherConflict = `Docente já tem uma reposição/antecipação para: ${teacherRepo.class_name}`;
      }

      // 2. Class Conflict
      const classWeekly = schedules.find(s =>
        s.class_name === schedule.class_name &&
        s.day_of_week === newDayOfWeek &&
        (s.period === new_period || s.periods?.includes(new_period))
      );
      const classRepo = reposicoes.find(r =>
        r.class_name === schedule.class_name &&
        r.status === 'CONCLUIDO' &&
        r.makeup_date === new_date &&
        r.makeup_period === new_period
      );
      if (classWeekly) {
        classConflict = `A turma ${schedule.class_name} já tem aula de ${classWeekly.subject} com o(a) prof. ${classWeekly.teacher_name}`;
      } else if (classRepo) {
        classConflict = `A turma ${schedule.class_name} já tem reposição com o(a) prof. ${classRepo.teacher_name}`;
      }

      // 3. Room Conflict
      const room = classes.find(c => c.name === schedule.class_name)?.room;
      if (room) {
        const roomWeekly = schedules.find(s =>
          s.room === room &&
          s.class_name !== schedule.class_name &&
          s.day_of_week === newDayOfWeek &&
          (s.period === new_period || s.periods?.includes(new_period))
        );
        const roomRepo = reposicoes.find(r => {
          const rRoom = classes.find(c => c.name === r.class_name)?.room;
          return rRoom === room && r.class_name !== schedule.class_name && r.status === 'CONCLUIDO' && r.makeup_date === new_date && r.makeup_period === new_period;
        });
        if (roomWeekly) {
          roomConflict = `A sala ${room} estará ocupada pela turma ${roomWeekly.class_name}`;
        } else if (roomRepo) {
          roomConflict = `A sala ${room} estará ocupada por reposição da turma ${roomRepo.class_name}`;
        }
      }

      newConflicts[proposal.id] = { teacher: teacherConflict, class: classConflict, room: roomConflict };
    }

    setRemanejamentoConflicts(newConflicts);
  }, [remanejamentoTeacher, remanejamentoProposals, schedules, reposicoes, classes]);

  const [collapsedTeachers, setCollapsedTeachers] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const [scheduleRows, setScheduleRows] = useState<{ class_name: string, subject: string, shorthand: string }[]>([
    { class_name: '', subject: '', shorthand: '' }
  ]);
  const [isEditingRoomInline, setIsEditingRoomInline] = useState(false);
  const [tempRoomValue, setTempRoomValue] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedShift, setSelectedShift] = useState<'M' | 'T' | 'N'>(() => {
    const hour = new Date().getHours();
    if (hour >= 19 || hour < 7) return 'N';
    if (hour >= 13) return 'T';
    return 'M';
  });
  const [verificationViewMode, setVerificationViewMode] = useState<'turma' | 'sala'>('turma');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [isRoomSelectionOpen, setIsRoomSelectionOpen] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const roomSelectionRef = useRef<HTMLDivElement>(null);
  const roomSearchInputRef = useRef<HTMLInputElement>(null);

  // Drag-to-scroll refs and handlers
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingScroll = useRef(false);
  const startX = useRef(0);
  const scrollLeftVal = useRef(0);

  const handleScrollMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input')) return;
    
    isDraggingScroll.current = true;
    startX.current = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    scrollLeftVal.current = scrollContainerRef.current?.scrollLeft || 0;
    
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grabbing';
      scrollContainerRef.current.style.userSelect = 'none';
    }
  };

  const handleScrollMouseUpOrLeave = () => {
    isDraggingScroll.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grab';
      scrollContainerRef.current.style.removeProperty('user-select');
    }
  };

  const handleScrollMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingScroll.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - (scrollContainerRef.current.offsetLeft || 0);
    const walk = (x - startX.current) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeftVal.current - walk;
  };

  // Modal States
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [absenceForm, setAbsenceForm] = useState<{
    date: string;
    date_end: string;
    is_period: boolean;
    teacher_name: string;
    status: 'VAGO' | 'SUBSTITUIDO';
    substitute_name: string;
    observation: string;
    selected_schedules: string[];
  }>({
    date: '',
    date_end: '',
    is_period: false,
    teacher_name: '',
    status: 'VAGO',
    substitute_name: '',
    observation: '',
    selected_schedules: []
  });
  const [isReposicaoModalOpen, setIsReposicaoModalOpen] = useState(false);
  const [editingReposicao, setEditingReposicao] = useState<TeacherReposicao | null>(null);
  const [selectedPendingReposicoes, setSelectedPendingReposicoes] = useState<string[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<Partial<TeacherSchedule> | null>(null);
  const [bulkClassText, setBulkClassText] = useState('');
  const [editingClass, setEditingClass] = useState<TeacherClass | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassRoom, setEditClassRoom] = useState('');
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [originalTeacherName, setOriginalTeacherName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchingTeacher, setIsSearchingTeacher] = useState(false);
  const [teacherSearchResults, setTeacherSearchResults] = useState<Person[]>([]);
  const [showTeacherResults, setShowTeacherResults] = useState(false);
  const [shorthandCode, setShorthandCode] = useState('');
  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false);
  const [selectedScheduleForReplacement, setSelectedScheduleForReplacement] = useState<string | null>(null);
  const [selectedPeriodForReplacement, setSelectedPeriodForReplacement] = useState<number | null>(null);
  const [searchTeacherReplacement, setSearchTeacherReplacement] = useState('');

  // Grade Edit Mode
  const [isGradeEditMode, setIsGradeEditMode] = useState(false);
  const [gradeEditCell, setGradeEditCell] = useState<{ day: number; slotId: number } | null>(null);
  const [gradeCellTeacher, setGradeCellTeacher] = useState('');
  const [gradeCellSubject, setGradeCellSubject] = useState('');
  const [gradeSelectedSlots, setGradeSelectedSlots] = useState<{ day: number; slotId: number }[]>([]);
  const [gradeTeacherSearch, setGradeTeacherSearch] = useState('');
  const [allServers, setAllServers] = useState<Person[]>([]);
  const [editingSchedulesInGrid, setEditingSchedulesInGrid] = useState<TeacherSchedule[]>([]);

  // Report states
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportAttendances, setReportAttendances] = useState<TeacherAttendance[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState<'' | 'PRESENTE' | 'SUBSTITUIDO' | 'VAGO'>('');
  const [reportTeacherSearch, setReportTeacherSearch] = useState('');
  const [isClassSelectionOpen, setIsClassSelectionOpen] = useState(false);
  const [classSearch, setClassSearch] = useState('');
  const classSelectionRef = useRef<HTMLDivElement>(null);
  const classSearchInputRef = useRef<HTMLInputElement>(null);
  const teacherSearchRef = useRef<HTMLDivElement>(null);
  const [reportSorts, setReportSorts] = useState<{ field: string, direction: 'asc' | 'desc' }[]>([
    { field: 'date', direction: 'asc' },
    { field: 'class', direction: 'asc' },
    { field: 'time', direction: 'asc' }
  ]);

  const toggleSort = (field: string) => {
    setReportSorts(prev => {
      const existingIndex = prev.findIndex(s => s.field === field);
      if (existingIndex === 0) {
        // Toggle direction if it's already the primary sort
        return [{ field, direction: prev[0].direction === 'asc' ? 'desc' : 'asc' }, ...prev.slice(1)];
      }

      // Move to front and set as primary
      const newSort = { field, direction: 'asc' as const };
      const filtered = prev.filter(s => s.field !== field);
      return [newSort, ...filtered];
    });
  };



  const getSortIcon = (field: string, isPrint = false) => {
    if (isPrint) return null;
    const sort = reportSorts.find(s => s.field === field);
    const isPrimary = reportSorts[0].field === field;
    if (!sort) return <div className="w-4 h-4 no-print" />;
    return (
      <div className={`transition-all no-print ${isPrimary ? 'text-indigo-600' : 'text-gray-300'}`}>
        {sort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
    );
  };

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

  const isGlobalAdmin = user.level === UserLevel.ADMIN;
  const currentCampusId = isGlobalAdmin ? adminGlobalCampusId : (adminGlobalCampusId || user.campus_id);
  const currentDayOfWeek = new Date(selectedDate).getUTCDay() + 1;

  const getWeekRange = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDay();
    const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diffToMonday));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    return {
      start: monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      end: friday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      startDate: monday,
      endDate: friday
    };
  };

  const changeWeek = (offset: number) => {
    const d = new Date(gradeWeekDate + 'T12:00:00');
    d.setDate(d.getDate() + (offset * 7));
    setGradeWeekDate(d.toISOString().split('T')[0]);
  };

  useEffect(() => {
    loadData();
  }, [currentCampusId, selectedDate]);

  useEffect(() => {
    if (activeSubTab === 'relatorio') loadReport();
  }, [activeSubTab, reportStartDate, reportEndDate, currentCampusId]);

  // Focus search input when class selection opens
  useEffect(() => {
    if (isClassSelectionOpen) {
      setTimeout(() => {
        classSearchInputRef.current?.focus();
      }, 100);
    }
  }, [isClassSelectionOpen]);

  // Focus search input when room selection opens
  useEffect(() => {
    if (isRoomSelectionOpen) {
      setTimeout(() => {
        roomSearchInputRef.current?.focus();
      }, 100);
    }
  }, [isRoomSelectionOpen]);

  // Click outside listener for class and room selection dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (classSelectionRef.current && !classSelectionRef.current.contains(event.target as Node)) {
        setIsClassSelectionOpen(false);
      }
      if (roomSelectionRef.current && !roomSelectionRef.current.contains(event.target as Node)) {
        setIsRoomSelectionOpen(false);
      }
      if (teacherSearchRef.current && !teacherSearchRef.current.contains(event.target as Node)) {
        setShowTeacherResults(false);
      }
    }
    if (isClassSelectionOpen || isRoomSelectionOpen || showTeacherResults) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isClassSelectionOpen, isRoomSelectionOpen, showTeacherResults]);

  // Global keydown event listener to close active modals using Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGradeEditCell(null);
        setEditingSchedulesInGrid([]);
        setGradeSelectedSlots([]);
        setGradeCellTeacher('');
        setGradeCellSubject('');
        setGradeTeacherSearch('');
        setIsScheduleModalOpen(false);
        setIsClassModalOpen(false);
        setIsEditClassModalOpen(false);
        setIsReplacementModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);



  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [schedulesData, attendanceData, classesData, usersData, plannedAbsencesData, reposicoesData] = await Promise.all([
        StorageService.getTeacherSchedules(currentCampusId || undefined),
        StorageService.getTeacherAttendance(currentCampusId || undefined, selectedDate),
        StorageService.getTeacherClasses(currentCampusId || undefined),
        StorageService.getUsers(),
        StorageService.getTeacherPlannedAbsences(currentCampusId || undefined),
        StorageService.getTeacherReposicoes(currentCampusId || undefined)
      ]);
      setSchedules(schedulesData);
      setAttendances(attendanceData);
      setClasses(classesData);
      setPlannedAbsences(plannedAbsencesData);
      setReposicoes(reposicoesData);

      const map: Record<string, string> = {};
      usersData.forEach((u: any) => { if (u.id) map[u.id] = u.name; });
      setUsersMap(map);

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

  const loadReport = async () => {
    try {
      setReportLoading(true);
      const [attendancesData, plannedData] = await Promise.all([
        (StorageService as any).getTeacherAttendanceByDateRange(
          currentCampusId || undefined,
          reportStartDate,
          reportEndDate
        ),
        (StorageService as any).getTeacherPlannedAbsencesByDateRange(
          currentCampusId || undefined,
          reportStartDate,
          reportEndDate
        )
      ]);

      const combined = [...attendancesData];
      for (const planned of plannedData) {
        const exists = combined.find(a => a.schedule_id === planned.schedule_id && a.period === planned.period && a.date === planned.date);
        if (!exists) {
          combined.push({
            id: undefined,
            planned_absence_id: planned.id,
            campus_id: planned.campus_id,
            schedule_id: planned.schedule_id,
            period: planned.period,
            date: planned.date,
            status: planned.status,
            substitute_name: planned.substitute_name,
            observation: planned.observation || 'Ausência informada',
            operator_id: planned.operator_id,
            is_planned: true
          } as any);
        }
      }
      setReportAttendances(combined);
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setReportLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const parseShorthand = (code: string): { days: number[], periods: number[] } | null => {
    // Supports: 2M1, 2M12, 25M12 (multi-day), 25M123 (multi-day, multi-period)
    // Day digits: 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri
    // Shift: M=Manhã, T=Tarde, N=Noite
    // Period digits: 1-6 within each shift
    const match = code.toUpperCase().match(/^([2-7]+)([MTN])([1-6]+)$/);
    if (!match) return null;

    const days = match[1].split('').map(Number).filter(d => d >= 2 && d <= 7);
    const shift = match[2];
    const periodDigits = match[3].split('').map(Number);

    const baseMapping: Record<string, number> = { 'M': 0, 'T': 6, 'N': 12 };
    const base = baseMapping[shift];

    const periods = periodDigits.map(p => base + p).filter(p => p >= 1 && p <= 16);
    if (days.length === 0 || periods.length === 0) return null;
    return { days, periods };
  };

  // Legacy compat: returns first day only (used by handleShorthandChange)
  const parseShorthandSingle = (code: string): { day: number, periods: number[] } | null => {
    const result = parseShorthand(code);
    if (!result) return null;
    return { day: result.days[0], periods: result.periods };
  };

  const handleShorthandChange = (code: string) => {
    setShorthandCode(code);
    const parsed = parseShorthandSingle(code);
    if (parsed && editingSchedule) {
      const firstPeriod = timeSlots.find(ts => ts.id === parsed.periods[0]);
      const lastPeriod = timeSlots.find(ts => ts.id === parsed.periods[parsed.periods.length - 1]);

      if (firstPeriod && lastPeriod) {
        setEditingSchedule({
          ...editingSchedule,
          day_of_week: parsed.day - 1,
          period: parsed.periods[0],
          start_time: firstPeriod.time.split(' - ')[0],
          end_time: lastPeriod.time.split(' - ')[1]
        });
      }
    }
  };

  // Helper to get effective attendance (checking real attendances first, then planned absences)
  const getEffectiveAttendance = (scheduleId: string, period: number, date: string) => {
    const real = attendances.find(a => a.schedule_id === scheduleId && a.period === period && a.date === date);
    if (real) return real;

    const planned = plannedAbsences.find(pa => pa.schedule_id === scheduleId && pa.period === period && pa.date === date);
    if (planned) {
      return {
        id: undefined,
        planned_absence_id: planned.id,
        campus_id: planned.campus_id,
        schedule_id: planned.schedule_id,
        period: planned.period,
        date: planned.date,
        status: planned.status,
        substitute_name: planned.substitute_name,
        observation: planned.observation || 'Ausência informada',
        operator_id: planned.operator_id,
        is_planned: true
      } as any;
    }
    return undefined;
  };

  const handleSaveAttendance = async (scheduleId: string, period: number, status: 'PRESENTE' | 'SUBSTITUIDO' | 'VAGO', extra?: { substitute_name?: string, observation?: string }) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (!schedule) return;

      const currentEffective = getEffectiveAttendance(scheduleId, period, selectedDate);
      const attendanceId = currentEffective && !currentEffective.is_planned ? currentEffective.id : '';

      const attendance: TeacherAttendance = {
        campus_id: schedule.campus_id,
        schedule_id: scheduleId,
        period,
        date: selectedDate,
        status,
        substitute_name: extra?.substitute_name,
        observation: extra?.observation,
        operator_id: user.id,
        id: attendanceId || ''
      };

      // Atualização otimista do estado local
      setAttendances(prev => {
        const filtered = prev.filter(a => !(a.schedule_id === scheduleId && a.period === period && a.date === selectedDate));
        return [...filtered, attendance];
      });

      const savedAttendance = await StorageService.saveTeacherAttendance(attendance);

      // Regra 2: Reposição deve ser gerada automaticamente sempre que for falta ou substituído
      if (status === 'VAGO' || status === 'SUBSTITUIDO') {
        const existingReposicao = reposicoes.find(r => r.attendance_id === savedAttendance.id);
        if (!existingReposicao) {
          const newReposicao: TeacherReposicao = {
            campus_id: schedule.campus_id,
            attendance_id: savedAttendance.id,
            schedule_id: scheduleId,
            date: selectedDate,
            period: period,
            teacher_name: schedule.teacher_name,
            class_name: schedule.class_name,
            subject: schedule.subject || '',
            status: 'PENDENTE',
            operator_id: user.id
          };
          await StorageService.saveTeacherReposicao(newReposicao);
        }
      } else {
        // Se mudou para PRESENTE, exclui reposições vinculadas à frequência
        if (savedAttendance.id) {
          await StorageService.deleteTeacherReposicaoByAttendance(savedAttendance.id);
        }
        // Exclui também a reposição da ausência informada se ela foi sobreposta com presença real
        const planned = plannedAbsences.find(pa => pa.schedule_id === scheduleId && pa.period === period && pa.date === selectedDate);
        if (planned && planned.id) {
          await StorageService.deleteTeacherReposicaoByPlannedAbsence(planned.id);
        }
      }

      await loadData(true); // Recarrega em segundo plano
    } catch (error) {
      console.error('Erro ao salvar frequência:', error);
      alert('Erro ao salvar frequência. Verifique sua conexão.');
      await loadData(true); // Tenta sincronizar novamente em caso de erro
    }
  };

  const handleToggleAttendance = async (scheduleId: string, period: number, status: 'PRESENTE' | 'SUBSTITUIDO' | 'VAGO', extra?: { substitute_name?: string, observation?: string }) => {
    const effective = getEffectiveAttendance(scheduleId, period, selectedDate);
    const displayStatus = effective?.status || 'PRESENTE';

    // Se clicar no status que já está ativo (ou se for PRESENTE e não tiver registro, o que significa que já é implicitamente PRESENTE)
    if (displayStatus === status) {
      if (!confirm('Deseja limpar este registro de frequência e reverter para Presente?')) return;

      try {
        // Atualização otimista
        setAttendances(prev => prev.filter(a => !(a.schedule_id === scheduleId && a.period === period && a.date === selectedDate)));

        if (effective) {
          if (!effective.is_planned && effective.id) {
            await StorageService.deleteTeacherAttendance(effective.id);
            await StorageService.deleteTeacherReposicaoByAttendance(effective.id);
          } else if (effective.is_planned && effective.planned_absence_id) {
            // Se for ausência informada, salvamos um registro real de PRESENTE para sobrepor
            const schedule = schedules.find(s => s.id === scheduleId);
            if (schedule) {
              const presentAttendance: TeacherAttendance = {
                campus_id: schedule.campus_id,
                schedule_id: scheduleId,
                period,
                date: selectedDate,
                status: 'PRESENTE',
                operator_id: user.id
              };
              const saved = await StorageService.saveTeacherAttendance(presentAttendance);
              await StorageService.deleteTeacherReposicaoByPlannedAbsence(effective.planned_absence_id);
            }
          }
        }
        await loadData(true);
      } catch (error) {
        console.error('Erro ao limpar frequência:', error);
        await loadData(true);
      }
    } else {
      // Caso contrário, salvamos normalmente
      handleSaveAttendance(scheduleId, period, status, extra);
    }
  };

  const handleTeacherSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!teacherName || teacherName.trim().length < 2) return;

    setIsSearchingTeacher(true);
    setShowTeacherResults(true);
    try {
      const results = await StorageService.searchPeople(teacherName, 20, currentCampusId || undefined, 'Servidor');
      setTeacherSearchResults(results);
    } catch (error) {
      console.error('Erro ao buscar professor:', error);
    } finally {
      setIsSearchingTeacher(false);
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
        const matchedClass = classes.find(c => c.name === row.class_name);
        const resolvedRoom = matchedClass?.room || '';

        for (const code of shorthandParts) {
          const parsed = parseShorthand(code);
          if (parsed) {
            // Create one record per (day × period) so every grid slot is filled
            for (const day of parsed.days) {
              for (const period of parsed.periods) {
                const slot = timeSlots.find(ts => ts.id === period);
                // Build a per-period shorthand label for display (e.g. "2M1")
                const singleShorthand = `${day}${code.toUpperCase().match(/([MTN])/)?.[1] || ''}${period - (['M', 'T', 'N'].indexOf(code.toUpperCase().match(/([MTN])/)?.[1] || 'M') * 6)}`;

                allPromises.push(StorageService.saveTeacherSchedule({
                  id: '',
                  campus_id: currentCampusId,
                  teacher_name: teacherName,
                  class_name: row.class_name,
                  subject: row.subject,
                  day_of_week: day - 1,
                  period: period,
                  periods: [period],
                  shorthand: code, // Keep original shorthand for display grouping
                  start_time: slot?.time.split(' - ')[0] || '',
                  end_time: slot?.time.split(' - ')[1] || '',
                  room: resolvedRoom || undefined
                }));
              }
            }
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

  const handleSaveEditClass = async () => {
    if (!editingClass || !editClassName.trim()) return;
    try {
      setIsSaving(true);
      await StorageService.saveTeacherClass({
        ...editingClass,
        name: editClassName.trim(),
        room: editClassRoom.trim() || undefined
      });
      setIsEditClassModalOpen(false);
      setEditingClass(null);
      setEditClassName('');
      setEditClassRoom('');
      await loadData();
    } catch (error) {
      console.error('Error saving edited class:', error);
      alert('Erro ao salvar alterações da turma. Verifique se o nome já existe.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRoomInline = async () => {
    const matchedClassObj = classes.find(c => c.name === selectedClass);
    if (!matchedClassObj) return;
    try {
      setIsSaving(true);
      await StorageService.saveTeacherClass({
        ...matchedClassObj,
        room: tempRoomValue.trim() || undefined
      });
      setIsEditingRoomInline(false);
      await loadData();
    } catch (error) {
      console.error('Error saving edited room inline:', error);
      alert('Erro ao salvar local da turma.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGradeCell = async () => {
    if (!gradeCellTeacher.trim() || gradeSelectedSlots.length === 0 || !currentCampusId || !selectedClass) return;

    const base: Record<string, number> = { 'M': 0, 'T': 6, 'N': 12 };

    try {
      setIsSaving(true);

      // Se estiver editando, realiza a validação de presença e exclui os antigos antes de salvar
      if (editingSchedulesInGrid.length > 0) {
        let hasLinkedAttendance = false;
        for (const s of editingSchedulesInGrid) {
          const hasAttendance = await StorageService.hasTeacherAttendance(s.id!);
          if (hasAttendance) {
            hasLinkedAttendance = true;
            break;
          }
        }
        if (hasLinkedAttendance) {
          alert("Não é possível alterar este horário pois existem registros de presença vinculados a ele.");
          setIsSaving(false);
          return;
        }

        // Exclui os registros anteriores
        for (const s of editingSchedulesInGrid) {
          await StorageService.deleteTeacherSchedule(s.id!);
        }
      }

      const matchedClass = classes.find(c => c.name === selectedClass);

      // Group slots by day and shift to generate combined shorthands (e.g., 2M12 instead of 2M1 and 2M2)
      const groupedSlots: Record<string, number[]> = {};
      gradeSelectedSlots.forEach(({ day, slotId }) => {
        const slot = timeSlots.find(ts => ts.id === slotId);
        if (slot) {
          const key = `${day}_${slot.shift}`;
          if (!groupedSlots[key]) groupedSlots[key] = [];
          groupedSlots[key].push(slotId);
        }
      });

      const promises: Promise<any>[] = [];
      Object.entries(groupedSlots).forEach(([key, slotIds]) => {
        const [dayStr, shift] = key.split('_');
        const day = parseInt(dayStr);
        slotIds.sort((a, b) => a - b);

        // Generate combined shorthand
        const relativePeriods = slotIds.map(id => id - base[shift]).join('');
        const combinedShorthand = `${day}${shift}${relativePeriods}`;

        slotIds.forEach(slotId => {
          const slot = timeSlots.find(ts => ts.id === slotId);
          if (slot) {
            promises.push(StorageService.saveTeacherSchedule({
              id: '',
              campus_id: currentCampusId,
              teacher_name: gradeCellTeacher.trim(),
              class_name: selectedClass,
              subject: gradeCellSubject.trim(),
              day_of_week: day - 1,
              period: slotId,
              periods: [slotId],
              shorthand: combinedShorthand,
              start_time: slot.time.split(' - ')[0],
              end_time: slot.time.split(' - ')[1],
              room: matchedClass?.room || undefined
            }));
          }
        });
      });
      await Promise.all(promises);
      setGradeEditCell(null);
      setEditingSchedulesInGrid([]);
      setGradeSelectedSlots([]);
      setGradeCellTeacher('');
      setGradeCellSubject('');
      setGradeTeacherSearch('');
      await loadData(true);
    } catch (err) {
      alert('Erro ao salvar. Verifique sua conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  const getDatesBetween = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const current = new Date(start + 'T12:00:00');
    const endDate = new Date(end + 'T12:00:00');
    while (current <= endDate) {
      const dow = current.getDay();
      if (dow >= 1 && dow <= 5) {
        dates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const handleSaveRemanejamento = async (e: React.FormEvent) => {
    e.preventDefault();
    const validProposals = remanejamentoProposals.filter(p => {
      const isRepos = p.is_reposicao || (p.original_date && p.new_date && p.new_date > p.original_date);
      return isRepos 
        ? (p.original_date && p.schedule_id && p.new_date)
        : (p.original_date && p.schedule_id && p.new_date && p.new_period);
    });
    if (!remanejamentoTeacher || validProposals.length === 0) {
      alert("Por favor, preencha o docente e ao menos uma proposta completa.");
      return;
    }

    const hasConflicts = validProposals.some(p => {
      const c = remanejamentoConflicts[p.id];
      return c && (c.teacher || c.class || c.room);
    });
    if (hasConflicts) {
      if (!confirm("Atenção: Existem conflitos de horário detectados. Deseja prosseguir mesmo assim?")) return;
    }

    try {
      setIsSaving(true);
      for (const proposal of validProposals) {
        const schedule = schedules.find(s => s.id === proposal.schedule_id);
        if (!schedule) continue;
        
        let attendance_id: string | undefined = undefined;
        let planned_absence_id: string | undefined = undefined;
        if (proposal.absent_key) {
          const [type, id] = proposal.absent_key.split('|||');
          if (type === 'attendance') {
            attendance_id = id;
          } else if (type === 'planned') {
            planned_absence_id = id;
          }
        }

        const isReposicao = proposal.is_reposicao || (proposal.original_date && proposal.new_date && proposal.new_date > proposal.original_date);
        const isAntecipacao = !isReposicao;
        const prefix = isAntecipacao ? "[Antecipação de Aula]" : "[Reposição de Aula]";
        const finalObs = proposal.observation ? `${prefix} ${proposal.observation}` : prefix;
        
        await StorageService.saveTeacherReposicao({
          campus_id: currentCampusId || '',
          schedule_id: schedule.id!,
          date: proposal.original_date,
          period: schedule.period,
          teacher_name: schedule.teacher_name,
          class_name: schedule.class_name,
          subject: schedule.subject || '',
          status: 'CONCLUIDO',
          makeup_date: proposal.new_date,
          makeup_period: isReposicao ? undefined : proposal.new_period,
          observation: finalObs,
          attendance_id,
          planned_absence_id,
          operator_id: user.id
        });
      }
      setRemanejamentoTeacher('');
      setRemanejamentoProposals([{
        id: Date.now().toString(),
        original_date: '',
        schedule_id: '',
        is_reposicao: false,
        new_date: '',
        new_period: 0,
        absent_key: '',
        observation: ''
      }]);
      setRemanejamentoConflicts({});
      setIsRemanejamentoModalOpen(false);
      alert(`${validProposals.length} remanejamento(s) registrado(s) com sucesso!`);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar remanejamento: ${err?.message || err?.details || JSON.stringify(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSubstitution = async (substituteName: string) => {
    if (!selectedAbsenceForSubstitution) return;

    try {
      setIsSaving(true);
      const { type, id, schedule_id, period, date } = selectedAbsenceForSubstitution;

      if (type === 'planned') {
        const planned = plannedAbsences.find(pa => pa.id === id);
        if (planned) {
          await StorageService.saveTeacherPlannedAbsence({
            ...planned,
            status: substituteName ? 'SUBSTITUIDO' : 'VAGO',
            substitute_name: substituteName || undefined,
            operator_id: user.id
          });
        }
      } else {
        const schedule = schedules.find(s => s.id === schedule_id);
        if (schedule) {
          await StorageService.saveTeacherAttendance({
            id: id || undefined,
            campus_id: currentCampusId || '',
            schedule_id,
            period,
            date,
            status: substituteName ? 'SUBSTITUIDO' : 'VAGO',
            substitute_name: substituteName || undefined,
            operator_id: user.id
          });
        }
      }

      setIsSubstitutionModalOpen(false);
      setSelectedAbsenceForSubstitution(null);
      setSearchSubstitutionTeacher('');
      alert("Substituto designado com sucesso!");
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao designar substituto: ${err?.message || err?.details || JSON.stringify(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAbsence = async (e: React.FormEvent) => {
    e.preventDefault();

    if (absenceForm.is_period) {
      if (!absenceForm.date || !absenceForm.date_end || !absenceForm.teacher_name) {
        alert("Preencha todos os campos obrigatórios (datas e professor).");
        return;
      }
      if (absenceForm.date_end < absenceForm.date) {
        alert("A data final deve ser igual ou posterior à data inicial.");
        return;
      }

      try {
        setIsSaving(true);
        const dates = getDatesBetween(absenceForm.date, absenceForm.date_end);

        for (const date of dates) {
          const dateObj = new Date(date + 'T12:00:00');
          const targetDay = dateObj.getDay();
          const teacherSchedules = schedules.filter(
            s => s.teacher_name === absenceForm.teacher_name && s.day_of_week === targetDay
          );

          for (const schedule of teacherSchedules) {
            const key = `${date}_${schedule.id}`;
            if (!absenceForm.selected_schedules.includes(key)) continue;

            const savedAbsence = await StorageService.saveTeacherPlannedAbsence({
              campus_id: currentCampusId || '',
              schedule_id: schedule.id!,
              teacher_name: schedule.teacher_name,
              period: schedule.period,
              date: date,
              status: 'VAGO',
              observation: absenceForm.observation,
              operator_id: user.id
            });

            await StorageService.saveTeacherReposicao({
              campus_id: currentCampusId || '',
              planned_absence_id: savedAbsence.id,
              schedule_id: schedule.id!,
              date: date,
              period: schedule.period,
              teacher_name: schedule.teacher_name,
              class_name: schedule.class_name,
              subject: schedule.subject || '',
              status: 'PENDENTE',
              operator_id: user.id
            });
          }
        }

        setIsAbsenceModalOpen(false);
        setAbsenceForm({
          date: '', date_end: '', is_period: false, teacher_name: '', status: 'VAGO', substitute_name: '', observation: '', selected_schedules: []
        });
        await loadData();
      } catch (err: any) {
        console.error(err);
        alert(`Erro ao salvar ausências: ${err?.message || err?.details || JSON.stringify(err)}`);
      } finally {
        setIsSaving(false);
      }
    } else {
      if (!absenceForm.date || !absenceForm.teacher_name || absenceForm.selected_schedules.length === 0) {
        alert("Preencha todos os campos obrigatórios e selecione ao menos uma aula.");
        return;
      }

      try {
        setIsSaving(true);

        const promises = absenceForm.selected_schedules.map(async (scheduleId) => {
          const schedule = schedules.find(s => s.id === scheduleId);
          if (!schedule) return;

          const savedAbsence = await StorageService.saveTeacherPlannedAbsence({
            campus_id: currentCampusId || '',
            schedule_id: schedule.id!,
            teacher_name: schedule.teacher_name,
            period: schedule.period,
            date: absenceForm.date,
            status: 'VAGO',
            observation: absenceForm.observation,
            operator_id: user.id
          });

          await StorageService.saveTeacherReposicao({
            campus_id: currentCampusId || '',
            planned_absence_id: savedAbsence.id,
            schedule_id: schedule.id!,
            date: absenceForm.date,
            period: schedule.period,
            teacher_name: schedule.teacher_name,
            class_name: schedule.class_name,
            subject: schedule.subject || '',
            status: 'PENDENTE',
            operator_id: user.id
          });
        });

        await Promise.all(promises);

        setIsAbsenceModalOpen(false);
        setAbsenceForm({
          date: '', date_end: '', is_period: false, teacher_name: '', status: 'VAGO', substitute_name: '', observation: '', selected_schedules: []
        });
        await loadData();
      } catch (err: any) {
        console.error(err);
        alert(`Erro ao salvar ausência informada: ${err?.message || err?.details || JSON.stringify(err)}`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSaveReposicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReposicao?.makeup_date) {
      alert("Informe a data da reposição");
      return;
    }
    try {
      setIsSaving(true);
      await StorageService.saveTeacherReposicao({
        ...editingReposicao,
        status: 'CONCLUIDO'
      });

      // Confirm selected pending reposicoes
      const otherSelected = reposicoes.filter(r => selectedPendingReposicoes.includes(r.id!));
      for (const r of otherSelected) {
        await StorageService.saveTeacherReposicao({
          ...r,
          makeup_date: editingReposicao.makeup_date,
          observation: editingReposicao.observation,
          status: 'CONCLUIDO'
        });
      }

      setIsReposicaoModalOpen(false);
      setEditingReposicao(null);
      setSelectedPendingReposicoes([]);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao confirmar reposição: ${err?.message || err?.details || JSON.stringify(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelReposicao = async (reposicao: TeacherReposicao) => {
    if (!window.confirm("Deseja realmente cancelar a confirmação desta reposição? Ela voltará para o estado pendente.")) {
      return;
    }
    try {
      setIsSaving(true);
      await StorageService.saveTeacherReposicao({
        ...reposicao,
        status: 'PENDENTE',
        makeup_date: undefined,
        makeup_period: undefined,
        observation: undefined
      });
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao cancelar reposição: ${err?.message || err?.details || JSON.stringify(err)}`);
    } finally {
      setIsSaving(false);
    }
  };


  const openGradeEditModal = async (day: number, slotId: number) => {
    setGradeEditCell({ day, slotId });
    setGradeSelectedSlots([{ day, slotId }]);
    setGradeCellTeacher('');
    setGradeCellSubject('');
    setGradeTeacherSearch('');
    setEditingSchedulesInGrid([]);
    // Load all servers if not already loaded
    if (allServers.length === 0) {
      try {
        const results = await StorageService.getPeoplePaginated(1, 2000, currentCampusId || undefined, 'Servidor');
        setAllServers(results);
      } catch (err) {
        console.error("Erro ao carregar servidores:", err);
      }
    }
  };

  const openGradeEditModalForEdit = async (schedule: TeacherSchedule) => {
    // Encontra todos os horários deste docente para a mesma turma e disciplina no campus atual
    const matchingSchedules = schedules.filter(s =>
      s.teacher_name === schedule.teacher_name &&
      s.class_name === selectedClass &&
      s.subject === schedule.subject &&
      s.campus_id === currentCampusId
    );

    setEditingSchedulesInGrid(matchingSchedules);
    setGradeEditCell({ day: schedule.day_of_week + 1, slotId: schedule.period });

    // Define os slots selecionados como todos os slots destes horários que estamos editando
    const slots = matchingSchedules.map(s => ({
      day: s.day_of_week + 1,
      slotId: s.period
    }));
    setGradeSelectedSlots(slots);

    setGradeCellTeacher(schedule.teacher_name);
    setGradeCellSubject(schedule.subject || '');
    setGradeTeacherSearch(schedule.teacher_name);

    // Carrega servidores se necessário
    if (allServers.length === 0) {
      try {
        const results = await StorageService.getPeoplePaginated(1, 2000, currentCampusId || undefined, 'Servidor');
        setAllServers(results);
      } catch (err) {
        console.error("Erro ao carregar servidores:", err);
      }
    }
  };

  const closeGradeEditModal = () => {
    setGradeEditCell(null);
    setEditingSchedulesInGrid([]);
    setGradeSelectedSlots([]);
    setGradeCellTeacher('');
    setGradeCellSubject('');
    setGradeTeacherSearch('');
  };

  // Helper to get attendance for a schedule
  const getAttendanceFor = (scheduleId: string, period?: number) =>
    attendances.find(a => a.schedule_id === scheduleId && (period === undefined || a.period === period));

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

  const toggleTeacherCollapse = (name: string) => {
    setCollapsedTeachers(prev => {
      const updated = { ...prev, [name]: !prev[name] };
      const teacherNames = Object.keys(teacherGroups);
      if (teacherNames.length > 0) {
        const allAreExpanded = teacherNames.every(tName => !!updated[tName]);
        setAllExpanded(allAreExpanded);
      }
      return updated;
    });
  };

  // Filtered schedules for the list
  const displaySchedules = schedules.filter(s => {
    const matchesSearch = s.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.subject || '').toLowerCase().includes(searchTerm.toLowerCase());

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
  const uniqueRooms = [...new Set(
    classes.filter(c => c.room?.trim()).map(c => c.room!.trim())
  )].sort();

  const activeColumns = verificationViewMode === 'sala' ? selectedRooms : selectedClasses;

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
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gestão de Aulas</h1>
              <p className="text-gray-500 font-medium">Acompanhamento diário das aulas</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
              {!isUserStandard && (
                <>
                  <button
                    onClick={() => setActiveSubTab('verificacao')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'verificacao' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Verificação
                  </button>
                  <button
                    onClick={() => setActiveSubTab('ausencias')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${['ausencias', 'substituicoes', 'remanejamentos'].includes(activeSubTab) ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Calendar size={14} />
                    Alterações de Aula
                  </button>
                </>
              )}
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
                Docentes
              </button>
              <button
                onClick={() => setActiveSubTab('turmas')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'turmas' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Turmas
              </button>
              <button
                onClick={() => setActiveSubTab('relatorio')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${activeSubTab === 'relatorio' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <BarChart2 size={14} />
                Relatório
              </button>
            </div>
          </div>
        </div>
      </div>

      {['ausencias', 'substituicoes', 'remanejamentos'].includes(activeSubTab) && (
        <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 mb-6 w-fit animate-in fade-in slide-in-from-top-2 duration-300">
          <button
            onClick={() => setActiveSubTab('ausencias')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'ausencias' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Ausências
          </button>
          <button
            onClick={() => setActiveSubTab('substituicoes')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'substituicoes' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Substituições
          </button>
          <button
            onClick={() => setActiveSubTab('remanejamentos')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'remanejamentos' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Remanejamentos
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6 overflow-visible">
        {/* Filters & Actions */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-gray-100 flex flex-wrap items-center justify-between gap-4 relative z-30 overflow-visible">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            {activeSubTab !== 'grade' && activeSubTab !== 'relatorio' && (
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

            {activeSubTab === 'horarios' && (
              <button
                onClick={() => {
                  const nextExpanded = !allExpanded;
                  setAllExpanded(nextExpanded);
                  const updated: Record<string, boolean> = {};
                  if (nextExpanded) {
                    Object.keys(teacherGroups).forEach(name => {
                      updated[name] = true;
                    });
                  }
                  setCollapsedTeachers(updated);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 rounded-xl font-bold text-xs transition-all border border-indigo-100 shadow-sm active:scale-95"
              >
                {allExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {allExpanded ? 'Recolher Todos' : 'Expandir Todos'}
              </button>
            )}

            {activeSubTab === 'relatorio' && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-indigo-50 p-1.5 rounded-xl border border-indigo-100">
                  <Calendar size={18} className="text-indigo-600 ml-2" />
                  <span className="text-xs font-bold text-indigo-600">De</span>
                  <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)}
                    className="bg-transparent border-none text-sm font-bold text-indigo-800 outline-none cursor-pointer" />
                </div>
                <div className="flex items-center gap-2 bg-indigo-50 p-1.5 rounded-xl border border-indigo-100">
                  <Calendar size={18} className="text-indigo-600 ml-2" />
                  <span className="text-xs font-bold text-indigo-600">Até</span>
                  <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)}
                    className="bg-transparent border-none text-sm font-bold text-indigo-800 outline-none cursor-pointer" />
                </div>
                <div className="flex items-center gap-2 bg-indigo-50 p-1.5 rounded-xl border border-indigo-100">
                  <Filter size={18} className="text-indigo-600 ml-2" />
                  <select value={reportStatusFilter} onChange={e => setReportStatusFilter(e.target.value as any)}
                    className="bg-transparent border-none text-sm font-bold text-indigo-800 outline-none cursor-pointer pr-6">
                    <option value="">Todos os status</option>
                    <option value="SUBSTITUIDO">Substituído</option>
                    <option value="VAGO">Vago / Ausente</option>
                  </select>
                </div>
                <div className="relative group">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Buscar professor..." value={reportTeacherSearch}
                    onChange={e => setReportTeacherSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm font-medium outline-none focus:border-indigo-400" />
                </div>
                <button onClick={loadReport}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors no-print">
                  <Search size={16} /> Buscar
                </button>
                <button onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all no-print">
                  <Printer size={16} /> Imprimir
                </button>
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
                  <button
                    onClick={() => {
                      const d = new Date(selectedDate + 'T12:00:00');
                      d.setDate(d.getDate() - 1);
                      setSelectedDate(d.toISOString().split('T')[0]);
                    }}
                    className="p-1 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-colors"
                    title="Dia Anterior"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <Calendar size={18} className="text-indigo-600" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="bg-transparent border-none text-sm font-bold text-indigo-800 outline-none cursor-pointer"
                  />
                  <button
                    onClick={() => {
                      const d = new Date(selectedDate + 'T12:00:00');
                      d.setDate(d.getDate() + 1);
                      setSelectedDate(d.toISOString().split('T')[0]);
                    }}
                    className="p-1 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-colors"
                    title="Próximo Dia"
                  >
                    <ChevronRight size={18} />
                  </button>
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

                <div className="flex bg-indigo-50 p-1 rounded-xl border border-indigo-100">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationViewMode('turma');
                      setSelectedClasses([]);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      verificationViewMode === 'turma'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-indigo-600 hover:text-indigo-800'
                    }`}
                  >
                    Por Turma
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationViewMode('sala');
                      setSelectedRoom('');
                      setSelectedClasses([]);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      verificationViewMode === 'sala'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-indigo-600 hover:text-indigo-800'
                    }`}
                  >
                    Por Sala
                  </button>
                </div>

                {verificationViewMode === 'turma' ? (
                  <div className="relative" ref={classSelectionRef}>
                    <button
                      onClick={() => setIsClassSelectionOpen(!isClassSelectionOpen)}
                      className="flex items-center gap-2 bg-indigo-50 p-2 px-4 rounded-xl border border-indigo-100 text-sm font-bold text-indigo-800 hover:bg-indigo-100 transition-colors"
                    >
                      <Filter size={18} className="text-indigo-600" />
                      Selecionar Turmas {selectedClasses.length > 0 && `(${selectedClasses.length})`}
                    </button>

                    {isClassSelectionOpen && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                        {(() => {
                          const filtered = uniqueClasses.filter(c =>
                            c.toLowerCase().includes(classSearch.toLowerCase())
                          );
                          const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedClasses.includes(c));

                          return (
                            <>
                              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-50">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={() => {
                                      if (allFilteredSelected) {
                                        // Deselect only the filtered ones
                                        setSelectedClasses(selectedClasses.filter(c => !filtered.includes(c)));
                                      } else {
                                        // Select all filtered ones (keeping previously selected that are not in filter)
                                        setSelectedClasses([...new Set([...selectedClasses, ...filtered])]);
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">
                                    {allFilteredSelected ? 'Desmarcar Visíveis' : 'Selecionar Visíveis'}
                                  </span>
                                </label>
                                <button onClick={() => setSelectedClasses([])} className="text-[10px] text-red-500 font-bold hover:underline">Limpar Tudo</button>
                              </div>

                              <div className="mb-3 relative group">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                                <input
                                  type="text"
                                  ref={classSearchInputRef}
                                  placeholder="Filtrar turmas..."
                                  value={classSearch}
                                  onChange={e => setClassSearch(e.target.value)}
                                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm font-bold focus:border-indigo-400 outline-none transition-all"
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-1">
                                {filtered.length === 0 ? (
                                  <p className="text-center py-4 text-xs text-gray-400 font-medium">Nenhuma turma encontrada</p>
                                ) : (
                                  filtered.map(c => (
                                    <label key={c} className="flex items-center gap-3 p-3 hover:bg-indigo-50/50 rounded-xl cursor-pointer transition-colors group active:scale-[0.98]">
                                      <input
                                        type="checkbox"
                                        checked={selectedClasses.includes(c)}
                                        onChange={() => {
                                          if (selectedClasses.includes(c)) {
                                            setSelectedClasses(selectedClasses.filter(sc => sc !== c));
                                          } else {
                                            setSelectedClasses([...selectedClasses, c]);
                                          }
                                        }}
                                        className="w-5 h-5 rounded-lg border-2 border-gray-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-all"
                                      />
                                      <span className={`text-sm font-black ${selectedClasses.includes(c) ? 'text-indigo-700' : 'text-gray-600'} group-hover:text-indigo-600`}>{c}</span>
                                    </label>
                                  ))
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative" ref={roomSelectionRef}>
                    <button
                      onClick={() => setIsRoomSelectionOpen(!isRoomSelectionOpen)}
                      className="flex items-center gap-2 bg-indigo-50 p-2 px-4 rounded-xl border border-indigo-100 text-sm font-bold text-indigo-800 hover:bg-indigo-100 transition-colors"
                    >
                      <MapPin size={18} className="text-indigo-600" />
                      Selecionar Salas {selectedRooms.length > 0 && `(${selectedRooms.length})`}
                    </button>

                    {isRoomSelectionOpen && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                        {(() => {
                          const filtered = uniqueRooms.filter(r =>
                            r.toLowerCase().includes(roomSearch.toLowerCase())
                          );
                          const allFilteredSelected = filtered.length > 0 && filtered.every(r => selectedRooms.includes(r));

                          return (
                            <>
                              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-50">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={() => {
                                      if (allFilteredSelected) {
                                        setSelectedRooms(selectedRooms.filter(r => !filtered.includes(r)));
                                      } else {
                                        setSelectedRooms([...new Set([...selectedRooms, ...filtered])]);
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">
                                    {allFilteredSelected ? 'Desmarcar Visíveis' : 'Selecionar Visíveis'}
                                  </span>
                                </label>
                                <button onClick={() => setSelectedRooms([])} className="text-[10px] text-red-500 font-bold hover:underline">Limpar Tudo</button>
                              </div>

                              <div className="mb-3 relative group">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                                <input
                                  type="text"
                                  ref={roomSearchInputRef}
                                  placeholder="Filtrar salas..."
                                  value={roomSearch}
                                  onChange={e => setRoomSearch(e.target.value)}
                                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm font-bold focus:border-indigo-400 outline-none transition-all"
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-1">
                                {filtered.length === 0 ? (
                                  <p className="text-center py-4 text-xs text-gray-400 font-medium">Nenhuma sala encontrada</p>
                                ) : (
                                  filtered.map(r => (
                                    <label key={r} className="flex items-center gap-3 p-3 hover:bg-indigo-50/50 rounded-xl cursor-pointer transition-colors group active:scale-[0.98]">
                                      <input
                                        type="checkbox"
                                        checked={selectedRooms.includes(r)}
                                        onChange={() => {
                                          if (selectedRooms.includes(r)) {
                                            setSelectedRooms(selectedRooms.filter(sr => sr !== r));
                                          } else {
                                            setSelectedRooms([...selectedRooms, r]);
                                          }
                                        }}
                                        className="w-5 h-5 rounded-lg border-2 border-gray-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-all"
                                      />
                                      <span className={`text-sm font-black ${selectedRooms.includes(r) ? 'text-indigo-700' : 'text-gray-600'} group-hover:text-indigo-600`}>{r}</span>
                                    </label>
                                  ))
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {activeSubTab === 'horarios' && !isUserStandard && (
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

          {activeSubTab === 'turmas' && !isUserStandard && (
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
        ) : activeSubTab === 'relatorio' ? (
          /* RELATÓRIO VIEW */
          (() => {
            const filtered = reportAttendances.filter(a => {
              if (a.status === 'PRESENTE') return false; // Filter out PRESENTE entirely
              const sched = schedules.find(s => s.id === a.schedule_id);
              const matchesStatus = !reportStatusFilter || a.status === reportStatusFilter;
              const matchesTeacher = !reportTeacherSearch || (sched?.teacher_name || '').toLowerCase().includes(reportTeacherSearch.toLowerCase());
              return matchesStatus && matchesTeacher;
            });
            const totalSubstituido = filtered.filter(a => a.status === 'SUBSTITUIDO').length;
            const totalVago = filtered.filter(a => a.status === 'VAGO').length;
            return (
              <div className="space-y-6 print-section">
                {/* Cabeçalho de Impressão (Formal) */}
                <div className="hidden print:block border-b-4 border-gray-800 pb-4 mb-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-2xl font-black text-gray-900 mb-1">IFRN - NOVA CRUZ</div>
                      <div className="text-lg font-bold text-gray-600 uppercase tracking-widest">Relatório de Gestão de Aulas</div>
                    </div>
                    <div className="text-right text-xs font-bold text-gray-500 space-y-1">
                      <div>Período: {new Date(reportStartDate + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(reportEndDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                      <div>Emissão: {new Date().toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-yellow-50 border-2 border-yellow-100 rounded-2xl p-5 text-center">
                    <div className="text-3xl font-black text-yellow-600 mb-1">{totalSubstituido}</div>
                    <div className="text-sm font-bold text-yellow-700">Substituídos</div>
                  </div>
                  <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-5 text-center">
                    <div className="text-3xl font-black text-red-600 mb-1">{totalVago}</div>
                    <div className="text-sm font-bold text-red-700">Vagos / Ausentes</div>
                  </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  {reportLoading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>
                  ) : filtered.length === 0 ? (
                    <div className="py-20 text-center">
                      <BarChart2 size={48} className="mx-auto text-gray-200 mb-4" />
                      <p className="text-gray-400 font-bold">Nenhum registro encontrado no período.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            {[
                              { label: 'Data', field: 'date' },
                              { label: 'Professor', field: 'teacher' },
                              { label: 'Turma', field: 'class' },
                              { label: 'Disciplina', field: 'subject' },
                              { label: 'Horário', field: 'time' },
                              { label: 'Status', field: 'status' },
                              { label: 'Registrado por', field: 'operator' }
                            ].map(col => (
                              <th
                                key={col.field}
                                onClick={() => toggleSort(col.field)}
                                className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group"
                              >
                                <div className="flex items-center gap-1">
                                  {col.label}
                                  {getSortIcon(col.field)}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(() => {
                            const sorted = [...filtered].sort((a, b) => {
                              for (const sort of reportSorts) {
                                const schedA = schedules.find(s => s.id === a.schedule_id);
                                const schedB = schedules.find(s => s.id === b.schedule_id);
                                const slotA = timeSlots.find(ts => ts.id === (a.period || schedA?.period));
                                const slotB = timeSlots.find(ts => ts.id === (b.period || schedB?.period));

                                let valA: any = '';
                                let valB: any = '';

                                if (sort.field === 'date') {
                                  valA = a.date;
                                  valB = b.date;
                                } else if (sort.field === 'teacher') {
                                  valA = schedA?.teacher_name || '';
                                  valB = schedB?.teacher_name || '';
                                } else if (sort.field === 'class') {
                                  valA = schedA?.class_name || '';
                                  valB = schedB?.class_name || '';
                                } else if (sort.field === 'subject') {
                                  valA = schedA?.subject || '';
                                  valB = schedB?.subject || '';
                                } else if (sort.field === 'time') {
                                  valA = slotA?.id || 0;
                                  valB = slotB?.id || 0;
                                } else if (sort.field === 'status') {
                                  valA = a.status;
                                  valB = b.status;
                                } else if (sort.field === 'operator') {
                                  valA = usersMap[a.operator_id] || a.operator_id;
                                  valB = usersMap[b.operator_id] || b.operator_id;
                                }

                                if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
                                if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
                              }
                              return 0;
                            });

                            return sorted.map((att, i) => {
                              const sched = schedules.find(s => s.id === att.schedule_id);
                              const slot = timeSlots.find(ts => ts.id === (att.period || sched?.period));
                              const dateFormatted = new Date(att.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
                              return (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                  <td className="p-4 text-sm font-bold text-gray-700 whitespace-nowrap">{dateFormatted}</td>
                                  <td className="p-4 text-sm font-bold text-gray-900">{sched?.teacher_name || '—'}</td>
                                  <td className="p-4 text-sm font-bold text-indigo-600">{sched?.class_name || '—'}</td>
                                  <td className="p-4 text-sm text-gray-600">{sched?.subject || '—'}</td>
                                  <td className="p-4 text-xs font-mono text-gray-500">{slot?.time || '—'}</td>
                                  <td className="p-4">
                                    {att.status === 'PRESENTE' && <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-black"><CheckCircle2 size={12} /> Presente</span>}
                                    {att.status === 'SUBSTITUIDO' && <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-black"><UserPlus size={12} /> {att.substitute_name || 'Substituído'}</span>}
                                    {att.status === 'VAGO' && <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-black"><XCircle size={12} /> Vago{att.observation ? ` — ${att.observation}` : ''}</span>}
                                  </td>
                                  <td className="p-4 text-xs text-gray-500 font-bold">{usersMap[att.operator_id] || att.operator_id}</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()
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
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Turma</p>
                        {c.room && (
                          <>
                            <span className="text-xs text-gray-300">•</span>
                            <span className="text-xs text-indigo-600 font-semibold px-2 py-0.5 bg-indigo-50 rounded-full">{c.room}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {!isUserStandard && (
                    <div className="flex gap-1 items-center opacity-65 md:opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <button
                        onClick={() => {
                          setEditingClass(c);
                          setEditClassName(c.name);
                          setEditClassRoom(c.room || '');
                          setIsEditClassModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Editar Turma"
                      >
                        <Pencil size={20} />
                      </button>
                      <button
                        onClick={() => handleDeleteClass(c.id!)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Excluir Turma"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : activeSubTab === 'grade' ? (
          /* GRID VIEW */
          <div className="bg-white rounded-3xl p-4 shadow-xl border border-gray-100 overflow-x-auto">
            <div className="min-w-[1000px]">
              <div className="flex flex-col items-center justify-center gap-4 mb-6 relative">
                <div className="flex items-center gap-4 bg-indigo-50 px-6 py-2 rounded-2xl border-2 border-indigo-100">
                  <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-indigo-100 rounded-xl transition-colors text-indigo-700">
                    <ChevronLeft size={20} />
                  </button>
                  <div className="text-center">
                    <div className="text-sm font-bold text-indigo-900">
                      Semana de {getWeekRange(gradeWeekDate).start} a {getWeekRange(gradeWeekDate).end}
                    </div>
                  </div>
                  <button onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setGradeWeekDate(today);
                  }} className="text-xs font-bold text-indigo-600 hover:underline">
                    Hoje
                  </button>
                  <button onClick={() => changeWeek(1)} className="p-2 hover:bg-indigo-100 rounded-xl transition-colors text-indigo-700">
                    <ChevronRight size={20} />
                  </button>
                </div>

                <div className="text-center">
                  <h2 className="text-4xl font-black text-gray-900">{selectedClass || "Selecione uma turma"}</h2>
                  {selectedClass && (() => {
                    const matchedClassObj = classes.find(c => c.name === selectedClass);
                    return (
                      <div className="flex items-center justify-center gap-2 mt-2">
                        {isEditingRoomInline ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tempRoomValue}
                              onChange={(e) => setTempRoomValue(e.target.value)}
                              placeholder="Cadastrar Local (Ex: Lab 3, Sala 102)"
                              className="px-4 py-1.5 text-sm border-2 border-indigo-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-white shadow-inner font-bold text-gray-800 w-64 text-center animate-in zoom-in-95 duration-200"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRoomInline();
                                if (e.key === 'Escape') setIsEditingRoomInline(false);
                              }}
                            />
                            <button
                              onClick={handleSaveRoomInline}
                              className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl transition-all border border-green-200"
                              title="Salvar"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={() => setIsEditingRoomInline(false)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all border border-red-200"
                              title="Cancelar"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50/50 px-4 py-1.5 rounded-full border border-indigo-100/80 shadow-sm transition-all hover:bg-indigo-50">
                            <MapPin size={14} className="text-indigo-500 animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-wider">
                              {matchedClassObj?.room ? `${matchedClassObj.room}` : 'Sem Local definido'}
                            </span>
                            {!isUserStandard && (
                              <button
                                onClick={() => {
                                  setTempRoomValue(matchedClassObj?.room || '');
                                  setIsEditingRoomInline(true);
                                }}
                                className="p-1 hover:bg-indigo-100/50 rounded-lg transition-all ml-1 text-indigo-400 hover:text-indigo-600"
                                title="Alterar Local da Turma"
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <p className="text-gray-400 text-sm mt-1">{isGradeEditMode ? 'Clique em uma célula para adicionar um professor' : 'Horário Semanal de Aulas'}</p>
                </div>
                {selectedClass && !isUserStandard && (
                  <button
                    onClick={() => setIsGradeEditMode(v => !v)}
                    className={`absolute right-0 flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${isGradeEditMode
                      ? 'bg-green-100 text-green-700 border-2 border-green-200 hover:bg-green-200'
                      : 'bg-indigo-50 text-indigo-700 border-2 border-indigo-100 hover:bg-indigo-100'
                      }`}
                  >
                    {isGradeEditMode ? <CheckCircle2 size={16} /> : <Pencil size={16} />}
                    {isGradeEditMode ? 'Concluir Edição' : 'Editar Grade'}
                  </button>
                )}
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
                            // Determinar a data exata da célula na semana selecionada
                            const { startDate } = getWeekRange(gradeWeekDate);
                            const cellDateObj = new Date(startDate);
                            cellDateObj.setDate(cellDateObj.getDate() + (day.id - 2));
                            const cellDateStr = cellDateObj.toISOString().split('T')[0];

                            // Reposição/Antecipação agendada para este slot
                            const cellRepo = reposicoes.find(r => 
                              r.class_name === selectedClass && 
                              r.status === 'CONCLUIDO' && 
                              r.makeup_date === cellDateStr && 
                              r.makeup_period === slot.id
                            );

                            const schedule = schedules.find(s =>
                              s.class_name === selectedClass &&
                              s.day_of_week === day.id - 1 &&
                              (s.period === slot.id || (s.periods?.includes(slot.id)))
                            );

                            // Se há um horário semanal aqui, verificar se foi remanejado para outra data
                            const originalRepo = schedule ? reposicoes.find(r => 
                              r.schedule_id === schedule.id && 
                              r.date === cellDateStr && 
                              r.period === slot.id && 
                              r.status === 'CONCLUIDO'
                            ) : null;

                            const isEditable = isGradeEditMode && !schedule && !cellRepo;

                            // Pegar a situação efetiva do professor para essa célula
                            const effective = schedule ? getEffectiveAttendance(schedule.id!, slot.id, cellDateStr) : null;
                            const status = effective?.status || 'PRESENTE'; // default to presence

                            let cellStyle = "bg-indigo-50 border-2 border-indigo-100 text-indigo-700";
                            let cellText = schedule?.teacher_name;
                            let subText = schedule?.subject;
                            let labelBadge = "";

                            if (cellRepo) {
                              const isAntecipacao = cellRepo.makeup_date! < cellRepo.date;
                              cellStyle = "bg-emerald-50 border-2 border-emerald-200 text-emerald-800";
                              cellText = cellRepo.teacher_name;
                              subText = cellRepo.subject;
                              labelBadge = isAntecipacao ? "Antecipação" : "Reposição";
                            } else if (originalRepo) {
                              const isAntecipacao = originalRepo.makeup_date! < originalRepo.date;
                              cellStyle = "bg-gray-50 border border-dashed border-gray-300 text-gray-400 opacity-60";
                              cellText = `${schedule?.teacher_name} (Sem Aula)`;
                              subText = schedule?.subject;
                              labelBadge = isAntecipacao ? "Antecipada" : "Reposta";
                            } else if (!isGradeEditMode && schedule) {
                              if (status === 'VAGO') {
                                cellStyle = "bg-red-50 border-2 border-red-200 text-red-700";
                                cellText = `${schedule.teacher_name} - Ausente`;
                              } else if (status === 'SUBSTITUIDO') {
                                cellStyle = "bg-yellow-50 border-2 border-yellow-200 text-yellow-800";
                                cellText = `Substituto: ${effective?.substitute_name || 'Desconhecido'}`;
                                subText = schedule.teacher_name;
                              }
                            }

                            return (
                              <td
                                key={`${day.id}-${slot.id}`}
                                className={`p-1 border border-gray-100 rounded-2xl min-h-[80px] w-[180px] transition-all ${isEditable ? 'cursor-pointer bg-indigo-50/30 hover:bg-indigo-100/50 hover:border-indigo-300' : 'bg-white/50'
                                  }`}
                                onClick={() => {
                                  if (isEditable) {
                                    openGradeEditModal(day.id, slot.id);
                                  }
                                }}
                              >
                                {(schedule || cellRepo) ? (
                                  <div className={`h-full rounded-2xl p-3 flex flex-col justify-center text-center animate-in zoom-in-95 duration-300 relative group/cell ${cellStyle}`}>
                                    {labelBadge && (
                                      <div className="mb-1">
                                        <span className="px-1.5 py-0.5 bg-white/90 border border-gray-100 rounded text-[9px] font-black uppercase shadow-sm tracking-wide">
                                          {labelBadge}
                                        </span>
                                      </div>
                                    )}
                                    <div className="text-[11px] font-black uppercase leading-tight mb-1 opacity-80">{subText}</div>
                                    <div className="text-[10px] font-bold truncate">{cellText}</div>
                                    {originalRepo && (
                                      <div className="text-[8px] mt-1 font-bold opacity-75">
                                        P/ {new Date(originalRepo.makeup_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                      </div>
                                    )}
                                    {cellRepo && (
                                      <div className="text-[8px] mt-1 font-bold opacity-75">
                                        Origem: {new Date(cellRepo.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                      </div>
                                    )}
                                    {isGradeEditMode && schedule && !originalRepo && (
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          openGradeEditModalForEdit(schedule);
                                        }}
                                        className="absolute top-1 right-1 p-1 rounded-lg bg-white/50 text-indigo-600 opacity-0 group-hover/cell:opacity-100 hover:bg-white transition-all shadow-sm"
                                        title="Editar Horários"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                    )}
                                  </div>
                                ) : isEditable ? (
                                  <div className="h-full min-h-[60px] flex items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200">
                                    <Plus size={20} className="text-indigo-300" />
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
        ) : activeSubTab === 'ausencias' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div>
                <h2 className="text-xl font-black text-gray-900">Ausências Informadas</h2>
                <p className="text-sm text-gray-500 font-medium">Gerencie as ausências informadas</p>
              </div>
              <button
                onClick={() => {
                  setAbsenceForm({
                    date: selectedDate,
                    date_end: '',
                    is_period: false,
                    teacher_name: '',
                    status: 'VAGO',
                    substitute_name: '',
                    observation: '',
                    selected_schedules: []
                  });
                  setIsAbsenceModalOpen(true);
                }}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                Informar Ausência
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              {plannedAbsences.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <Calendar size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Nenhuma ausência informada</h3>
                  <p className="text-gray-500">Clique no botão acima para informar uma nova ausência.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b-2 border-gray-100 bg-gray-50/50">
                        <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Data</th>
                        <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Professor</th>
                        <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Turma / Disciplina</th>
                        <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {plannedAbsences.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(pa => {
                        const schedule = schedules.find(s => s.id === pa.schedule_id);
                        const slot = timeSlots.find(ts => ts.id === pa.period);
                        return (
                          <tr key={pa.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-900">{new Date(pa.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                <span className="text-xs text-gray-400 font-medium">{slot?.time || '-'}</span>
                              </div>
                            </td>
                            <td className="p-4 font-bold text-gray-900">{schedule?.teacher_name || pa.teacher_name || 'Desconhecido'}</td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-900">{schedule?.class_name || '-'}</span>
                                <span className="text-xs text-gray-400 font-medium">{schedule?.subject || '-'}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <button
                                onClick={async () => {
                                  if (confirm('Deseja excluir esta ausência informada?')) {
                                    try {
                                      await StorageService.deleteTeacherPlannedAbsence(pa.id!);
                                      await StorageService.deleteTeacherReposicaoByPlannedAbsence(pa.id!);
                                      loadData(true);
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : activeSubTab === 'substituicoes' ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <UserPlus size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Cadastro de Substituições</h3>
            <p className="text-gray-500 max-w-sm mx-auto font-medium">Esta funcionalidade estará disponível em breve para gerenciar a substituição temporária de docentes.</p>
          </div>
        ) : activeSubTab === 'remanejamentos' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Button to open modal */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setRemanejamentoTeacher('');
                  setRemanejamentoProposals([{
                    id: Date.now().toString(),
                    original_date: '',
                    schedule_id: '',
                    is_reposicao: false,
                    new_date: '',
                    new_period: 0,
                    absent_key: '',
                    observation: ''
                  }]);
                  setRemanejamentoConflicts({});
                  setIsRemanejamentoModalOpen(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus size={20} />
                Registrar Remanejamento
              </button>
            </div>

            {/* List / Table of existing remanejamentos */}
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-black text-gray-900">Histórico de Remanejamentos</h3>
                <p className="text-xs text-gray-500 font-medium mt-1">Lista de reposições e antecipações registradas</p>
              </div>

              {reposicoes.length === 0 ? (
                <div className="py-16 text-center text-gray-500">
                  <ClipboardList size={40} className="mx-auto text-gray-300 mb-2" />
                  <p className="font-bold">Nenhum remanejamento registrado até o momento.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b-2 border-gray-100 bg-gray-50/50">
                        <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Origem</th>
                        <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Professor</th>
                        <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Turma / Disc</th>
                        <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Tipo / Destino</th>
                        <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Observação</th>
                        <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider w-24">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reposicoes
                        .filter(r => !searchTerm || r.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(r => {
                          const originalSlot = timeSlots.find(ts => ts.id === r.period);
                          const makeupSlot = timeSlots.find(ts => ts.id === r.makeup_period);
                          
                          // Determine if it was an anticipation or reposition
                          const isAntecipacao = r.makeup_date && r.makeup_date < r.date;
                          const labelType = isAntecipacao ? "Antecipação" : "Reposição";
                          const labelColor = isAntecipacao ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700";

                          return (
                            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                              <td className="p-4">
                                <div className="font-bold text-gray-900">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                <div className="text-xs text-gray-500 font-medium">{originalSlot?.time}</div>
                              </td>
                              <td className="p-4 font-bold text-gray-900">{r.teacher_name}</td>
                              <td className="p-4">
                                <div className="font-bold text-gray-900">{r.class_name}</div>
                                <div className="text-xs text-gray-500 font-medium">{r.subject}</div>
                              </td>
                              <td className="p-4">
                                {r.makeup_date ? (
                                  <div>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${labelColor}`}>
                                      {labelType}
                                    </span>
                                    <div className="font-bold text-green-700 mt-1">
                                      {new Date(r.makeup_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                    </div>
                                    <div className="text-xs text-gray-500 font-medium">
                                      {makeupSlot ? `${makeupSlot.label}º Aula (${makeupSlot.time})` : ''}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-red-500 font-bold">Pendente</span>
                                )}
                              </td>
                              <td className="p-4 text-xs font-medium text-gray-600 max-w-[200px] truncate" title={r.observation}>
                                {r.observation || '-'}
                              </td>
                              <td className="p-4">
                                <button
                                  onClick={async () => {
                                    if (confirm('Deseja excluir este registro de remanejamento?')) {
                                      try {
                                        setIsSaving(true);
                                        await StorageService.deleteTeacherReposicao(r.id!);
                                        await loadData();
                                      } catch (err) {
                                        console.error(err);
                                      } finally {
                                        setIsSaving(false);
                                      }
                                    }
                                  }}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
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
              Object.entries(teacherGroups).map(([name, teacherSchedules]) => {
                const isExpanded = !!collapsedTeachers[name];
                return (
                  <div key={name} className="bg-white rounded-[32px] p-6 shadow-sm border-2 border-gray-100 hover:border-indigo-200 transition-all group relative overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div
                          onClick={() => toggleTeacherCollapse(name)}
                          className="flex items-center gap-4 cursor-pointer select-none group/title"
                        >
                          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover/title:bg-indigo-100 transition-all">
                            <User size={24} />
                          </div>
                          <div>
                            <h3 className="font-black text-gray-900 text-lg leading-tight group-hover/title:text-indigo-600 transition-colors flex items-center gap-1.5">
                              {name}
                              {isExpanded ? (
                                <ChevronUp size={16} className="text-gray-400 group-hover/title:text-indigo-500 transition-colors animate-in fade-in" />
                              ) : (
                                <ChevronDown size={16} className="text-gray-400 group-hover/title:text-indigo-500 transition-colors animate-in fade-in" />
                              )}
                            </h3>
                            <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">{teacherSchedules.length} {teacherSchedules.length === 1 ? 'Horário' : 'Horários'}</p>
                          </div>
                        </div>
                        {!isUserStandard && (
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
                                  groupedRows[key].push(s.shorthand || getShorthandFrom(s.day_of_week, s.period));
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
                              title="Editar Professor"
                            >
                              <Pencil size={20} />
                            </button>
                            <button
                              onClick={async () => {
                                // Check linked attendances
                                const scheduleIds = teacherSchedules.map(s => s.id!).filter(Boolean);
                                let hasLinkedAttendance = false;
                                for (const sId of scheduleIds) {
                                  const hasAttendance = await StorageService.hasTeacherAttendance(sId);
                                  if (hasAttendance) {
                                    hasLinkedAttendance = true;
                                    break;
                                  }
                                }

                                if (hasLinkedAttendance) {
                                  alert("Não é possível excluir este horário pois existem registros de presença vinculados a ele.");
                                  return;
                                }

                                if (confirm(`Excluir todos os ${teacherSchedules.length} horários de ${name}?`)) {
                                  for (const s of teacherSchedules) {
                                    await StorageService.deleteTeacherSchedule(s.id!);
                                  }
                                  await loadData();
                                }
                              }}
                              className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Excluir Professor"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                          {Object.entries(
                            teacherSchedules.reduce((acc, s) => {
                              const key = `${s.class_name}|||${s.subject}`;
                              if (!acc[key]) acc[key] = [];
                              acc[key].push(s);
                              return acc;
                            }, {} as Record<string, TeacherSchedule[]>)
                          ).map(([key, group]) => {
                            const [className, subject] = key.split('|||');
                            const shorthands = Array.from(new Set(group.map(s => s.shorthand || getShorthandFrom(s.day_of_week, s.period)))).join(', ');

                            return (
                              <div key={key} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100/50 transition-colors">
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
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* VERIFICAÇÃO VIEW (GRID MODE) */
          <div className="space-y-6">
            {activeColumns.length === 0 ? (
              <div className="py-32 text-center bg-white/80 backdrop-blur-md rounded-[32px] border-2 border-dashed border-gray-200">
                <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-400 rotate-3 transition-transform hover:rotate-0">
                  <Filter size={40} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-2">Inicie a Verificação</h3>
                <p className="text-gray-500 font-medium max-w-sm mx-auto">
                  {verificationViewMode === 'sala'
                    ? 'Selecione as salas no filtro acima para visualizar a grade de horários e registrar a frequência.'
                    : 'Selecione as turmas no filtro acima para visualizar a grade de horários e registrar a frequência.'
                  }
                </p>
              </div>
            ) : (
              <div
                ref={scrollContainerRef}
                onMouseDown={handleScrollMouseDown}
                onMouseLeave={handleScrollMouseUpOrLeave}
                onMouseUp={handleScrollMouseUpOrLeave}
                onMouseMove={handleScrollMouseMove}
                className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 overflow-x-auto cursor-grab select-none"
              >
                <div className="min-w-max">
                  <table className="w-full border-separate border-spacing-2">
                    <thead>
                      <tr>
                        <th className="p-3 bg-gray-50 rounded-2xl w-28"></th>
                        {activeColumns.map((colName, index) => (
                          <th
                            key={colName}
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData('text/plain', index.toString());
                            }}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => {
                              const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                              const toIndex = index;
                              if (fromIndex === toIndex) return;

                              if (verificationViewMode === 'sala') {
                                const newRooms = [...selectedRooms];
                                const [moved] = newRooms.splice(fromIndex, 1);
                                newRooms.splice(toIndex, 0, moved);
                                setSelectedRooms(newRooms);
                              } else {
                                const newClasses = [...selectedClasses];
                                const [moved] = newClasses.splice(fromIndex, 1);
                                newClasses.splice(toIndex, 0, moved);
                                setSelectedClasses(newClasses);
                              }
                            }}
                            className="p-3 bg-indigo-600 text-white rounded-2xl text-base font-black min-w-[220px] shadow-lg shadow-indigo-100 cursor-grab active:cursor-grabbing hover:bg-indigo-700 transition-colors"
                          >
                            {colName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeSlots.filter(s => s.shift === selectedShift).map(slot => (
                        <tr key={slot.id}>
                          <td className="p-3 bg-gray-50 border border-gray-100 rounded-2xl shadow-sm">
                            <div className="text-indigo-600 font-black text-base leading-none mb-1">{slot.label}º Aula</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase whitespace-nowrap">{slot.time}</div>
                          </td>
                          {activeColumns.map(colName => {
                            const dayNum = new Date(selectedDate).getUTCDay();
                            const schedule = schedules.find(s => {
                              if (verificationViewMode === 'sala') {
                                const classRoom = classes.find(c => c.name === s.class_name)?.room;
                                return classRoom?.trim() === colName &&
                                  s.day_of_week === dayNum &&
                                  (s.periods?.includes(slot.id) || s.period === slot.id);
                              } else {
                                return s.class_name === colName &&
                                  s.day_of_week === dayNum &&
                                  (s.periods?.includes(slot.id) || s.period === slot.id);
                              }
                            });

                            if (!schedule) return <td key={colName} className="p-2 bg-gray-50/30 rounded-2xl border border-dashed border-gray-100"></td>;

                            const attendance = getEffectiveAttendance(schedule.id!, slot.id, selectedDate);
                            const displayStatus = attendance?.status || 'PRESENTE';

                            return (
                              <td key={colName} className="p-2">
                                <div className={`h-full rounded-2xl p-3 border-2 transition-all flex flex-col justify-between min-h-[130px] ${displayStatus === 'PRESENTE' ? 'bg-green-50 border-green-200 shadow-sm' :
                                  displayStatus === 'SUBSTITUIDO' ? 'bg-yellow-50 border-yellow-200 shadow-sm' :
                                    displayStatus === 'VAGO' ? 'bg-red-50 border-red-200 shadow-sm' :
                                      'bg-white border-gray-100 hover:border-indigo-200'
                                  }`}>
                                  <div>
                                    <div className="text-xs font-black text-indigo-600 uppercase mb-1 truncate">
                                      {displayStatus === 'SUBSTITUIDO' ? (
                                        <span className="text-yellow-700">SUBSTITUÍDO POR:</span>
                                      ) : schedule.teacher_name}
                                    </div>

                                    {displayStatus === 'SUBSTITUIDO' ? (
                                      <div className="text-sm font-black text-yellow-800 uppercase truncate mb-1">
                                        {attendance?.substitute_name}
                                      </div>
                                    ) : (
                                      <div className="text-[10px] font-bold text-gray-400 uppercase truncate mb-1">{schedule.subject}</div>
                                    )}

                                    {verificationViewMode === 'sala' && (
                                      <div className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-1.5 py-0.5 w-fit mt-1">
                                        {schedule.class_name}
                                      </div>
                                    )}

                                    {displayStatus === 'VAGO' && attendance?.observation && (
                                      <div className="mt-1 p-1 bg-red-100/50 rounded-md text-[8px] text-red-700 font-bold flex items-center gap-0.5">
                                        <AlertCircle size={8} /> {attendance.observation}
                                      </div>
                                    )}

                                    {attendance?.is_planned && (
                                      <div className="mt-1 p-1 bg-indigo-50 rounded-md text-[8px] text-indigo-700 font-bold uppercase tracking-wider text-center">
                                        Ausência Informada
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex gap-0.5 mt-2">
                                    <button
                                      onClick={() => handleToggleAttendance(schedule.id!, slot.id, 'PRESENTE', { observation: '' })}
                                      title={displayStatus === 'PRESENTE' ? "Limpar Registro" : "Presente"}
                                      className={`flex-1 p-1.5 rounded-lg border transition-all flex items-center justify-center ${displayStatus === 'PRESENTE' ? 'bg-green-600 border-green-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:border-green-300 hover:text-green-600'
                                        }`}
                                    >
                                      <CheckCircle2 size={16} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (displayStatus === 'SUBSTITUIDO') {
                                          handleToggleAttendance(schedule.id!, slot.id, 'SUBSTITUIDO');
                                        } else {
                                          setSelectedScheduleForReplacement(schedule.id!);
                                          setSelectedPeriodForReplacement(slot.id);
                                          setIsReplacementModalOpen(true);
                                        }
                                      }}
                                      title={displayStatus === 'SUBSTITUIDO' ? "Limpar Registro" : "Substituído"}
                                      className={`flex-1 p-1.5 rounded-lg border transition-all flex items-center justify-center ${displayStatus === 'SUBSTITUIDO' ? 'bg-yellow-500 border-yellow-500 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:border-yellow-300 hover:text-yellow-600'
                                        }`}
                                    >
                                      <UserPlus size={16} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (displayStatus === 'VAGO') {
                                          // Se clicar de novo, perguntamos se quer limpar ou editar observação
                                          const choice = confirm('Pressione OK para LIMPAR o registro ou Cancelar para apenas EDITAR a observação.');
                                          if (choice) {
                                            handleToggleAttendance(schedule.id!, slot.id, 'VAGO');
                                          } else {
                                            const obs = prompt('Editar Observação:', attendance?.observation || '');
                                            if (obs !== null) handleSaveAttendance(schedule.id!, slot.id, 'VAGO', { observation: obs });
                                          }
                                        } else {
                                          const obs = prompt('Observação (Opcional):', '');
                                          if (obs !== null) {
                                            handleSaveAttendance(schedule.id!, slot.id, 'VAGO', { observation: obs });
                                          }
                                        }
                                      }}
                                      title={displayStatus === 'VAGO' ? "Limpar / Editar" : "Vago / Ausente"}
                                      className={`flex-1 p-1.5 rounded-lg border transition-all flex items-center justify-center ${displayStatus === 'VAGO' ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:border-red-300 hover:text-red-600'
                                        }`}
                                    >
                                      <XCircle size={16} />
                                    </button>
                                  </div>
                                  {attendance && (
                                    <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center gap-1.5">
                                      <User size={10} className="text-gray-300 shrink-0" />
                                      <span className="text-[10px] text-gray-400 font-bold truncate">
                                        {usersMap[attendance.operator_id] || 'Operador'}
                                      </span>
                                    </div>
                                  )}
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
        )}
      </div>

      {/* Modal Professores/Horários */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Cadastrar Docente e Horários"
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
              <label className="block text-sm font-bold text-gray-700 mb-2">Nome do Docente</label>
              <div className="relative" ref={teacherSearchRef}>
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  required
                  className="w-full pl-12 pr-12 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all outline-none"
                  placeholder="Busque pelo nome ou matrícula..."
                  value={teacherName}
                  onChange={(e) => {
                    setTeacherName(e.target.value);
                    if (e.target.value.length < 2) setShowTeacherResults(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // Se os resultados estiverem abertos e houver resultados, selecionamos o primeiro
                      if (showTeacherResults && teacherSearchResults.length > 0) {
                        setTeacherName(teacherSearchResults[0].name);
                        setShowTeacherResults(false);
                      } else {
                        // Caso contrário, realizamos a busca
                        handleTeacherSearch();
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleTeacherSearch()}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                >
                  {isSearchingTeacher ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                </button>

                {/* Dropdown de Resultados */}
                {showTeacherResults && teacherName.length >= 2 && (
                  <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-[240px] overflow-y-auto custom-scrollbar">
                    {isSearchingTeacher ? (
                      <div className="p-8 text-center text-gray-400">
                        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                        <span className="text-sm font-bold">Buscando servidores...</span>
                      </div>
                    ) : teacherSearchResults.length > 0 ? (
                      <div className="p-2">
                        {teacherSearchResults.map((person) => (
                          <button
                            key={person.matricula}
                            type="button"
                            onClick={() => {
                              setTeacherName(person.name);
                              setShowTeacherResults(false);
                            }}
                            className="w-full text-left p-3 hover:bg-indigo-50 rounded-xl transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-sm font-bold text-gray-800 group-hover:text-indigo-700">{person.name}</div>
                              <div className="text-[10px] text-gray-400 font-bold uppercase">{person.matricula}</div>
                            </div>
                            <div className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-md group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors font-black">
                              {person.type}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <User className="mx-auto text-gray-200 mb-2" size={32} />
                        <p className="text-sm text-gray-500 font-bold">Nenhum servidor encontrado</p>
                        <p className="text-[10px] text-gray-400">Certifique-se de que o servidor está cadastrado</p>
                      </div>
                    )}
                  </div>
                )}
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
                          className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0 transition-all outline-none text-sm font-bold text-gray-800"
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

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Código de Horário (Ex: 2T12, 3M34)</label>
                        <input
                          type="text"
                          required
                          name={`shorthand-${index}`}
                          autoComplete="off"
                          className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0 transition-all outline-none text-sm font-mono uppercase font-bold text-gray-800"
                          placeholder="Ex: 2T12, 3M34, 4M56"
                          value={row.shorthand}
                          onChange={(e) => {
                            const newRows = [...scheduleRows];
                            newRows[index].shorthand = e.target.value;
                            setScheduleRows(newRows);
                          }}
                        />
                      </div>
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

      {/* Edit Class Modal */}
      {isEditClassModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-700 p-8 text-white flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black mb-1">Editar Turma</h2>
                <p className="text-indigo-100 font-medium">Altere as informações da turma ou cadastre a sala de aula</p>
              </div>
              <button
                onClick={() => {
                  setIsEditClassModalOpen(false);
                  setEditingClass(null);
                }}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nome da Turma</label>
                <div className="relative">
                  <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-gray-800"
                    placeholder="Ex: ADM1M"
                    value={editClassName}
                    onChange={e => setEditClassName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Local / Sala de Aula (Opcional)</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-gray-800"
                    placeholder="Ex: Lab de Informática, Sala 102, etc."
                    value={editClassRoom}
                    onChange={e => setEditClassRoom(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-2 font-bold uppercase tracking-wider">
                  Dica: Definir o local ajuda os alunos e servidores a se localizarem na grade horária.
                </p>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => {
                    setIsEditClassModalOpen(false);
                    setEditingClass(null);
                  }}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-2xl font-black hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEditClass}
                  disabled={isSaving || !editClassName.trim()}
                  className="flex-[2] px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Seleção de Professor Substituto */}
      {/* Modal: Informar Ausência */}
      <Modal
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
        title="Informar Ausência"
      >
        <form onSubmit={handleSaveAbsence} className="p-8 space-y-6">
          {/* Toggle: Data Única / Período */}
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setAbsenceForm({ ...absenceForm, is_period: false, date_end: '', selected_schedules: [] })}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!absenceForm.is_period ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span className="flex items-center gap-1.5"><Calendar size={14} /> Data Única</span>
            </button>
            <button
              type="button"
              onClick={() => setAbsenceForm({ ...absenceForm, is_period: true, selected_schedules: [] })}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${absenceForm.is_period ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span className="flex items-center gap-1.5"><Calendar size={14} /> Período</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">{absenceForm.is_period ? 'Data Início *' : 'Data da Ausência *'}</label>
              <input
                type="date"
                required
                value={absenceForm.date}
                onChange={e => setAbsenceForm({ ...absenceForm, date: e.target.value, selected_schedules: [] })}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            {absenceForm.is_period ? (
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Data Fim *</label>
                <input
                  type="date"
                  required
                  value={absenceForm.date_end}
                  min={absenceForm.date}
                  onChange={e => setAbsenceForm({ ...absenceForm, date_end: e.target.value, selected_schedules: [] })}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            ) : null}
            <div className={absenceForm.is_period ? 'md:col-span-2' : ''}>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Professor Ausente *</label>
              <select
                required
                value={absenceForm.teacher_name}
                onChange={e => setAbsenceForm({ ...absenceForm, teacher_name: e.target.value, selected_schedules: [] })}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="">Selecione o professor...</option>
                {Array.from(new Set(schedules
                  .filter(s => {
                    if (absenceForm.is_period) return true;
                    if (!absenceForm.date) return true;
                    const dateObj = new Date(absenceForm.date + 'T12:00:00');
                    return s.day_of_week === dateObj.getDay();
                  })
                  .map(s => s.teacher_name)))
                  .sort((a, b) => a.localeCompare(b))
                  .map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))
                }
              </select>
            </div>
          </div>

          {/* Modo Período: Resumo das aulas afetadas */}
          {absenceForm.is_period && absenceForm.teacher_name && absenceForm.date && absenceForm.date_end && (() => {
            const dates = getDatesBetween(absenceForm.date, absenceForm.date_end);
            const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            let totalAulas = 0;

            const daysSummary = dates.map(date => {
              const dateObj = new Date(date + 'T12:00:00');
              const targetDay = dateObj.getDay();
              const teacherSchedules = schedules
                .filter(s => s.teacher_name === absenceForm.teacher_name && s.day_of_week === targetDay)
                .sort((a, b) => a.period - b.period);
              totalAulas += teacherSchedules.length;
              return { date, dateObj, dayName: dayNames[targetDay], teacherSchedules };
            }).filter(d => d.teacherSchedules.length > 0);

            if (daysSummary.length === 0) return (
              <div className="bg-orange-50 p-4 rounded-2xl border-2 border-orange-100 text-center">
                <AlertCircle size={24} className="text-orange-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-orange-800">Nenhuma aula encontrada para este professor no período selecionado.</p>
              </div>
            );

            return (
              <div className="bg-indigo-50 p-4 rounded-2xl border-2 border-indigo-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-black text-indigo-800 uppercase tracking-wider">
                    Aulas Afetadas no Período
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-lg">
                      {absenceForm.selected_schedules.length} de {totalAulas} aulas
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (absenceForm.selected_schedules.length === totalAulas) {
                          setAbsenceForm({ ...absenceForm, selected_schedules: [] });
                        } else {
                          const allKeys = daysSummary.flatMap(d => d.teacherSchedules.map(s => `${d.date}_${s.id}`));
                          setAbsenceForm({ ...absenceForm, selected_schedules: allKeys });
                        }
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      {absenceForm.selected_schedules.length === totalAulas ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {daysSummary.map(({ date, dateObj, dayName, teacherSchedules }) => {
                    const allDaySelected = teacherSchedules.every(s => absenceForm.selected_schedules.includes(`${date}_${s.id}`));

                    return (
                      <div key={date} className="bg-white rounded-xl p-3 border border-indigo-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <Calendar size={14} className="text-indigo-500" />
                            {dayName}, {dateObj.toLocaleDateString('pt-BR')}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (allDaySelected) {
                                setAbsenceForm({
                                  ...absenceForm,
                                  selected_schedules: absenceForm.selected_schedules.filter(id => !teacherSchedules.find(s => `${date}_${s.id}` === id))
                                });
                              } else {
                                const newSelected = new Set(absenceForm.selected_schedules);
                                teacherSchedules.forEach(s => newSelected.add(`${date}_${s.id}`));
                                setAbsenceForm({ ...absenceForm, selected_schedules: Array.from(newSelected) });
                              }
                            }}
                            className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-wider"
                          >
                            {allDaySelected ? 'Desmarcar Dia' : 'Selecionar Dia'}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {teacherSchedules.map(s => {
                            const slot = timeSlots.find(ts => ts.id === s.period);
                            const key = `${date}_${s.id}`;
                            const isSelected = absenceForm.selected_schedules.includes(key);

                            return (
                              <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                  {isSelected && <Check size={14} className="text-white" />}
                                </div>
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setAbsenceForm({ ...absenceForm, selected_schedules: [...absenceForm.selected_schedules, key] });
                                    } else {
                                      setAbsenceForm({ ...absenceForm, selected_schedules: absenceForm.selected_schedules.filter(id => id !== key) });
                                    }
                                  }}
                                />
                                <div className="flex-1">
                                  <div className="font-bold text-gray-900 text-sm">{s.class_name} <span className="text-gray-500 font-medium ml-1">({slot?.time})</span></div>
                                  <div className="text-xs text-indigo-600 font-medium">{s.subject}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            );
          })()}

          {/* Modo Data Única: Seleção de aulas */}
          {!absenceForm.is_period && absenceForm.teacher_name && absenceForm.date && (() => {
            const dateObj = new Date(absenceForm.date + 'T12:00:00');
            const targetDay = dateObj.getDay();

            const teacherSchedules = schedules
              .filter(s => s.teacher_name === absenceForm.teacher_name && s.day_of_week === targetDay)
              .sort((a, b) => a.period - b.period);

            if (teacherSchedules.length === 0) return null;

            return (
              <div className="bg-indigo-50 p-4 rounded-2xl border-2 border-indigo-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-black text-indigo-800 uppercase tracking-wider">Aulas do Dia</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (absenceForm.selected_schedules.length === teacherSchedules.length) {
                        setAbsenceForm({ ...absenceForm, selected_schedules: [] });
                      } else {
                        setAbsenceForm({ ...absenceForm, selected_schedules: teacherSchedules.map(s => s.id!) });
                      }
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    {absenceForm.selected_schedules.length === teacherSchedules.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {teacherSchedules.map(s => {
                    const slot = timeSlots.find(ts => ts.id === s.period);
                    const isSelected = absenceForm.selected_schedules.includes(s.id!);
                    return (
                      <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-white shadow-sm' : 'border-indigo-100/50 hover:bg-indigo-100/30'}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-indigo-200'}`}>
                          {isSelected && <Check size={14} className="text-white" />}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAbsenceForm({ ...absenceForm, selected_schedules: [...absenceForm.selected_schedules, s.id!] });
                            } else {
                              setAbsenceForm({ ...absenceForm, selected_schedules: absenceForm.selected_schedules.filter(id => id !== s.id) });
                            }
                          }}
                        />
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 text-sm">{s.class_name} <span className="text-gray-500 font-medium ml-1">({slot?.time})</span></div>
                          <div className="text-xs text-indigo-600 font-medium">{s.subject}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Observação (Opcional)</label>
            <input
              type="text"
              value={absenceForm.observation}
              onChange={e => setAbsenceForm({ ...absenceForm, observation: e.target.value })}
              placeholder="Ex: Atestado médico, participação em evento..."
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-medium text-gray-900 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsAbsenceModalOpen(false)}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || (!absenceForm.is_period && absenceForm.selected_schedules.length === 0)}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirmar Reposição */}
      <Modal
        isOpen={isReposicaoModalOpen}
        onClose={() => setIsReposicaoModalOpen(false)}
        title={editingReposicao?.status === 'CONCLUIDO' ? 'Editar Reposição' : 'Confirmar Reposição'}
      >
        <form onSubmit={handleSaveReposicao} className="p-8 space-y-6">
          <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 mb-6">
            <h4 className="font-black text-indigo-900">{editingReposicao?.teacher_name}</h4>
            <p className="text-sm text-indigo-700 mt-1">
              Turma: <span className="font-bold">{editingReposicao?.class_name}</span> | Disc: <span className="font-bold">{editingReposicao?.subject}</span>
            </p>
            <p className="text-xs font-medium text-indigo-500 mt-2">
              Reposição referente à aula original do dia {editingReposicao?.date ? new Date(editingReposicao.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
            </p>
          </div>

          {(() => {
            const pending = reposicoes.filter(r =>
              r.teacher_name === editingReposicao?.teacher_name &&
              r.class_name === editingReposicao?.class_name &&
              r.status === 'PENDENTE' &&
              r.id !== editingReposicao?.id
            );
            if (pending.length > 0 && editingReposicao?.status === 'PENDENTE') {
              return (
                <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 mb-6">
                  <h5 className="text-xs font-black text-orange-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Outras Reposições Pendentes ({pending.length}) (Clique para selecionar e repor juntas)
                  </h5>
                  <ul className="space-y-2">
                    {pending.map(r => {
                      const isSelected = selectedPendingReposicoes.includes(r.id!);
                      return (
                        <li
                          key={r.id}
                          onClick={() => {
                            setSelectedPendingReposicoes(prev =>
                              prev.includes(r.id!)
                                ? prev.filter(id => id !== r.id)
                                : [...prev, r.id!]
                            );
                          }}
                          className={`text-xs font-medium flex justify-between items-center p-3 rounded-xl border cursor-pointer select-none transition-all ${isSelected
                            ? 'bg-orange-100/80 border-orange-300 text-orange-900 shadow-sm'
                            : 'bg-white/60 border-orange-100/50 text-orange-700 hover:bg-orange-100/30'
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-orange-600 border-orange-600' : 'border-orange-300 bg-white'
                              }`}>
                              {isSelected && <Check size={12} className="text-white" />}
                            </div>
                            <span>
                              <span className="font-bold">{r.class_name}</span> - {r.subject || 'Sem disciplina'}
                            </span>
                          </div>
                          <span className={`font-bold px-2 py-1 rounded-lg transition-colors ${isSelected ? 'bg-orange-200/80 text-orange-800' : 'bg-orange-100 text-orange-600'
                            }`}>
                            {r.date ? new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            }
            return null;
          })()}

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Data da Reposição *</label>
              <input
                type="date"
                required
                value={editingReposicao?.makeup_date || ''}
                onChange={e => setEditingReposicao(prev => prev ? { ...prev, makeup_date: e.target.value } : null)}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Observação (Opcional)</label>
            <input
              type="text"
              value={editingReposicao?.observation || ''}
              onChange={e => setEditingReposicao(prev => prev ? { ...prev, observation: e.target.value } : null)}
              placeholder="Ex: Aula dada em laboratório..."
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-medium text-gray-900 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsReposicaoModalOpen(false)}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              {editingReposicao?.status === 'CONCLUIDO' ? 'Salvar Alterações' : 'Confirmar Reposição'}
            </button>
          </div>
        </form>
      </Modal>

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
                    if (selectedScheduleForReplacement && selectedPeriodForReplacement !== null) {
                      handleSaveAttendance(selectedScheduleForReplacement, selectedPeriodForReplacement, 'SUBSTITUIDO', {
                        substitute_name: name,
                        observation: '' // Limpa o "Sem aula" ao substituir
                      });
                      setIsReplacementModalOpen(false);
                      setSearchTeacherReplacement('');
                      setSelectedPeriodForReplacement(null);
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

      <Modal
        isOpen={isSubstitutionModalOpen}
        onClose={() => {
          setIsSubstitutionModalOpen(false);
          setSelectedAbsenceForSubstitution(null);
        }}
        title="Designar Professor Substituto"
      >
        <div className="p-8">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:ring-0 transition-all outline-none"
                placeholder="Buscar professor substituto..."
                value={searchSubstitutionTeacher}
                onChange={(e) => setSearchSubstitutionTeacher(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {Array.from(new Set(schedules.map(s => s.teacher_name)))
              .filter(name => name.toLowerCase().includes(searchSubstitutionTeacher.toLowerCase()))
              .sort()
              .map(name => (
                <button
                  key={name}
                  onClick={() => handleSaveSubstitution(name)}
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

      {/* Modal: Adicionar Professor na Grade (multi-slot) */}
      {gradeEditCell && (() => {
        // All empty slots for this class (to allow multi-selection)
        const availableSlots = timeSlots.map(slot => {
          return daysOfWeek.map(day => {
            const occupied = schedules.some(
              s => s.class_name === selectedClass &&
                s.day_of_week === day.id - 1 &&
                (s.period === slot.id || (s.periods?.includes(slot.id))) &&
                !editingSchedulesInGrid.some(es => es.id === s.id)
            );
            return { day, slot, occupied };
          });
        }).flat();

        const isSlotSelected = (day: number, slotId: number) =>
          gradeSelectedSlots.some(s => s.day === day && s.slotId === slotId);

        const toggleSlot = (day: number, slotId: number, occupied: boolean) => {
          if (occupied) return;
          if (isSlotSelected(day, slotId)) {
            setGradeSelectedSlots(prev => prev.filter(s => !(s.day === day && s.slotId === slotId)));
          } else {
            setGradeSelectedSlots(prev => [...prev, { day, slotId }]);
          }
        };

        // Combine servers from DB + teachers already in schedules
        const scheduledTeachers = Array.from(new Set(schedules.map(s => s.teacher_name)));
        const serverNames = allServers.map(p => p.name);
        const allNames = Array.from(new Set([...scheduledTeachers, ...serverNames])).sort();
        const filteredNames = allNames.filter(n =>
          !gradeTeacherSearch || n.toLowerCase().includes(gradeTeacherSearch.toLowerCase())
        );

        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-700 p-6 flex items-start justify-between shrink-0">
                <div>
                  <h3 className="text-white font-black text-xl leading-tight">
                    {editingSchedulesInGrid.length > 0 ? 'Editar Professor' : 'Adicionar Professor'} — {selectedClass}
                  </h3>
                  <p className="text-indigo-200 text-sm mt-1 font-medium">
                    {gradeSelectedSlots.length === 0
                      ? 'Selecione ao menos um horário na grade'
                      : `${gradeSelectedSlots.length} horário(s) selecionado(s)`}
                  </p>
                </div>
                <button onClick={closeGradeEditModal} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors">
                  <X size={20} className="text-white" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* LEFT: teacher + subject */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Nome do Professor *</label>
                      <input
                        autoFocus
                        type="text"
                        value={gradeCellTeacher}
                        onChange={e => { setGradeCellTeacher(e.target.value); setGradeTeacherSearch(e.target.value); }}
                        placeholder="Digite para buscar..."
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                        Disciplina <span className="text-gray-300 font-medium normal-case">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={gradeCellSubject}
                        onChange={e => setGradeCellSubject(e.target.value)}
                        placeholder="Ex: Matemática..."
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>

                    {/* Server list */}
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                        Servidores ({filteredNames.length})
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {filteredNames.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-4">Nenhum resultado</p>
                        ) : filteredNames.map(name => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => { setGradeCellTeacher(name); setGradeTeacherSearch(name); }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${gradeCellTeacher === name
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
                              }`}
                          >
                            <User size={13} className={gradeCellTeacher === name ? 'text-white' : 'text-gray-400'} />
                            <span className="truncate">{name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: slot multi-select grid */}
                  <div>
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Horários <span className="text-gray-300 font-medium normal-case">(selecione vários)</span></p>
                    <div className="overflow-x-auto">
                      <table className="w-full border-separate border-spacing-0.5 text-[11px]">
                        <thead>
                          <tr>
                            <th className="py-1 text-gray-400 font-black text-left pl-1">Aula</th>
                            {daysOfWeek.map(d => (
                              <th key={d.id} className="py-1 text-indigo-600 font-black text-center">{d.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {['M', 'T', 'N'].map(shift => (
                            <React.Fragment key={shift}>
                              <tr>
                                <td colSpan={6} className="pt-2 pb-0.5 pl-1">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    {shift === 'M' ? 'Manhã' : shift === 'T' ? 'Tarde' : 'Noite'}
                                  </span>
                                </td>
                              </tr>
                              {timeSlots.filter(s => s.shift === shift).map(slot => (
                                <tr key={slot.id}>
                                  <td className="pr-1 text-gray-500 font-bold whitespace-nowrap pl-1">{slot.label}º</td>
                                  {daysOfWeek.map(day => {
                                    const occ = availableSlots.find(a => a.day.id === day.id && a.slot.id === slot.id);
                                    const occupied = occ?.occupied ?? false;
                                    const selected = isSlotSelected(day.id, slot.id);
                                    return (
                                      <td key={day.id} className="text-center">
                                        <button
                                          type="button"
                                          disabled={occupied}
                                          onClick={() => toggleSlot(day.id, slot.id, occupied)}
                                          className={`w-7 h-7 rounded-lg border-2 text-[10px] font-black transition-all ${occupied
                                            ? 'bg-gray-100 border-gray-100 text-gray-300 cursor-not-allowed'
                                            : selected
                                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                              : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-400 hover:text-indigo-600'
                                            }`}
                                          title={occupied ? 'Já preenchido' : selected ? 'Desmarcar' : 'Selecionar'}
                                        >
                                          {occupied ? '–' : selected ? '✓' : ''}
                                        </button>
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
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 pt-0 shrink-0">
                <button
                  onClick={closeGradeEditModal}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-2xl font-black hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveGradeCell}
                  disabled={isSaving || !gradeCellTeacher.trim() || gradeSelectedSlots.length === 0}
                  className="flex-[2] px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  Salvar {gradeSelectedSlots.length > 0 ? `${gradeSelectedSlots.length} horário(s)` : ''}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== MODAL: Registrar Remanejamento ===== */}
      {isRemanejamentoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">

            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-7 text-white flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-2xl font-black mb-1">Registrar Remanejamento</h2>
                <p className="text-indigo-100 text-sm font-medium">Selecione o docente e defina as propostas de remanejamento</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRemanejamentoModalOpen(false)}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors ml-4 shrink-0"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSaveRemanejamento} className="overflow-y-auto flex-1 flex flex-col">
              <div className="p-7 space-y-6 flex-1">

                {/* --- Docente --- */}
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Docente *</label>
                  <select
                    required
                    value={remanejamentoTeacher}
                    onChange={e => {
                      setRemanejamentoTeacher(e.target.value);
                      setRemanejamentoProposals([{
                        id: Date.now().toString(),
                        original_date: '',
                        schedule_id: '',
                        is_reposicao: false,
                        new_date: '',
                        new_period: 0,
                        absent_key: '',
                        observation: ''
                      }]);
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
                  >
                    <option value="">Selecione o professor...</option>
                    {Array.from(new Set(schedules.map(s => s.teacher_name)))
                      .sort((a, b) => a.localeCompare(b))
                      .map(name => <option key={name} value={name}>{name}</option>)
                    }
                  </select>
                </div>

                {/* Warning: Aulas a Repor */}
                {remanejamentoTeacher && (() => {
                  const pendingAbsences = [
                    ...attendances.filter(att => {
                      const sch = schedules.find(s => s.id === att.schedule_id);
                      return sch && sch.teacher_name === remanejamentoTeacher && (att.status === 'VAGO' || att.status === 'SUBSTITUIDO');
                    }),
                    ...plannedAbsences.filter(pa => {
                      const sch = schedules.find(s => s.id === pa.schedule_id);
                      const tName = sch ? sch.teacher_name : pa.teacher_name;
                      return tName === remanejamentoTeacher && (pa.status === 'VAGO' || pa.status === 'SUBSTITUIDO');
                    })
                  ];
                  if (pendingAbsences.length === 0) return null;
                  return (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3 mt-3">
                      <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                      <div>
                        <p className="text-sm font-black text-amber-800">
                          ⚠️ {pendingAbsences.length} aula(s) pendente(s) de reposição
                        </p>
                        <p className="text-xs text-amber-600 font-medium mt-0.5">
                          Este docente possui ausência(s) registrada(s). Marque o checkbox "Reposição" nas propostas abaixo para vincular.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* --- Divider: Aulas Propostas --- */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Aulas Propostas</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* --- Proposals List --- */}
                <div className="space-y-4">
                  {remanejamentoProposals.map((proposal, idx) => {
                    const dow = proposal.original_date ? new Date(proposal.original_date + 'T12:00:00').getDay() : null;
                    const teacherSchedulesOnDay = schedules.filter(s =>
                      s.teacher_name === remanejamentoTeacher && (dow === null || s.day_of_week === dow)
                    );

                    const selectedSchedule = schedules.find(s => s.id === proposal.schedule_id);
                    const turmaName = selectedSchedule ? selectedSchedule.class_name : '';

                    const vacantPeriodsForClass = (() => {
                      if (!turmaName || !proposal.new_date) return [];
                      const pDow = new Date(proposal.new_date + 'T12:00:00').getDay();
                      return timeSlots.filter(slot => {
                        const weeklySchedule = schedules.find(s =>
                          s.class_name === turmaName && s.day_of_week === pDow &&
                          (s.period === slot.id || s.periods?.includes(slot.id))
                        );

                        let isClassFree = !weeklySchedule;
                        if (weeklySchedule) {
                          const hasAttAbsence = attendances.some(att =>
                            att.schedule_id === weeklySchedule.id &&
                            att.date === proposal.new_date &&
                            (att.status === 'VAGO' || att.status === 'SUBSTITUIDO')
                          );
                          const hasPlannedAbsence = plannedAbsences.some(pa =>
                            pa.schedule_id === weeklySchedule.id &&
                            pa.date === proposal.new_date &&
                            (pa.status === 'VAGO' || pa.status === 'SUBSTITUIDO')
                          );
                          const hasPendingRepo = reposicoes.some(r =>
                            r.class_name === turmaName &&
                            r.status === 'PENDENTE' &&
                            r.date === proposal.new_date &&
                            r.period === slot.id
                          );
                          if (hasAttAbsence || hasPlannedAbsence || hasPendingRepo) {
                            isClassFree = true;
                          }
                        }

                        const hasConfirmedRepo = reposicoes.some(r =>
                          r.class_name === turmaName && r.status === 'CONCLUIDO' &&
                          r.makeup_date === proposal.new_date && r.makeup_period === slot.id
                        );
                        return isClassFree && !hasConfirmedRepo;
                      });
                    })();

                    // 1. List of absences for this teacher (available for reposição)
                    const teacherAbsences = (() => {
                      if (!remanejamentoTeacher) return [];
                      const list: Array<{ key: string; date: string; schedule_id: string; label: string }> = [];

                      attendances.forEach(att => {
                        const sch = schedules.find(s => s.id === att.schedule_id);
                        if (sch && sch.teacher_name === remanejamentoTeacher && (att.status === 'VAGO' || att.status === 'SUBSTITUIDO')) {
                          const slot = timeSlots.find(ts => ts.id === sch.period);
                          const periodLabel = slot ? ` (${slot.label}ª aula)` : '';
                          list.push({
                            key: `attendance|||${att.id}`,
                            date: att.date,
                            schedule_id: att.schedule_id,
                            label: `Falta em ${new Date(att.date + 'T12:00:00').toLocaleDateString('pt-BR')}${periodLabel} – Turma ${sch.class_name} (${sch.subject})`
                          });
                        }
                      });

                      plannedAbsences.forEach(pa => {
                        const sch = schedules.find(s => s.id === pa.schedule_id);
                        const tName = sch ? sch.teacher_name : pa.teacher_name;
                        if (tName === remanejamentoTeacher && (pa.status === 'VAGO' || pa.status === 'SUBSTITUIDO')) {
                          const subjectLabel = sch ? sch.subject : '';
                          const classNameLabel = sch ? sch.class_name : '';
                          const periodVal = sch ? sch.period : pa.period;
                          const slot = timeSlots.find(ts => ts.id === periodVal);
                          const periodLabel = slot ? ` (${slot.label}ª aula)` : '';
                          list.push({
                            key: `planned|||${pa.id}`,
                            date: pa.date,
                            schedule_id: pa.schedule_id,
                            label: `Ausência em ${new Date(pa.date + 'T12:00:00').toLocaleDateString('pt-BR')}${periodLabel} – Turma ${classNameLabel} (${subjectLabel})`
                          });
                        }
                      });

                      // Filter out keys already used by other proposals
                      const usedAbsentKeys = remanejamentoProposals
                        .filter(p => p.id !== proposal.id && p.absent_key)
                        .map(p => p.absent_key);
                      return list.filter(item => !usedAbsentKeys.includes(item.key));
                    })();

                    // 2. List of absences for the selected class/turma (for optional linking in Antecipação)
                    const absentClassesForTurma = (() => {
                      if (!turmaName) return [];
                      const list: Array<{ key: string; label: string }> = [];

                      attendances.forEach(att => {
                        const sch = schedules.find(s => s.id === att.schedule_id);
                        if (sch && sch.class_name === turmaName && (att.status === 'VAGO' || att.status === 'SUBSTITUIDO')) {
                          const slot = timeSlots.find(ts => ts.id === sch.period);
                          const periodLabel = slot ? ` (${slot.label}ª aula)` : '';
                          list.push({
                            key: `attendance|||${att.id}`,
                            label: `Falta em ${new Date(att.date + 'T12:00:00').toLocaleDateString('pt-BR')}${periodLabel} – ${sch.subject} com ${sch.teacher_name}`
                          });
                        }
                      });

                      plannedAbsences.forEach(pa => {
                        const sch = schedules.find(s => s.id === pa.schedule_id);
                        if (sch && sch.class_name === turmaName && (pa.status === 'VAGO' || pa.status === 'SUBSTITUIDO')) {
                          const periodVal = sch ? sch.period : pa.period;
                          const slot = timeSlots.find(ts => ts.id === periodVal);
                          const periodLabel = slot ? ` (${slot.label}ª aula)` : '';
                          list.push({
                            key: `planned|||${pa.id}`,
                            label: `Ausência em ${new Date(pa.date + 'T12:00:00').toLocaleDateString('pt-BR')}${periodLabel} – ${sch.subject} com ${sch.teacher_name}`
                          });
                        }
                      });

                      // Filter out keys already used by other proposals
                      const usedTurmaAbsentKeys = remanejamentoProposals
                        .filter(p => p.id !== proposal.id && p.absent_key)
                        .map(p => p.absent_key);
                      return list.filter(item => !usedTurmaAbsentKeys.includes(item.key));
                    })();

                    // Vacant classes for this proposal's new_date + new_period
                    const vacantClasses = (() => {
                      if (!proposal.new_date || !proposal.new_period) return [];
                      const pDow = new Date(proposal.new_date + 'T12:00:00').getDay();
                      return classes.filter(c => {
                        const hasWeekly = schedules.some(s =>
                          s.class_name === c.name && s.day_of_week === pDow &&
                          (s.period === proposal.new_period || s.periods?.includes(proposal.new_period))
                        );
                        const hasRepo = reposicoes.some(r =>
                          r.class_name === c.name && r.status === 'CONCLUIDO' &&
                          r.makeup_date === proposal.new_date && r.makeup_period === proposal.new_period
                        );
                        return !hasWeekly && !hasRepo;
                      });
                    })();

                    const conflicts = remanejamentoConflicts[proposal.id];
                    const hasConflict = conflicts && (conflicts.teacher || conflicts.class || conflicts.room);

                    // Colors based on whether it is reposição or antecipação
                    const isProposalReposicao = (() => {
                      if (proposal.is_reposicao) return true;
                      if (proposal.original_date && proposal.new_date) {
                        return proposal.new_date > proposal.original_date;
                      }
                      return false;
                    })();

                    const calculatedTypeLabel = isProposalReposicao ? "REPOSIÇÃO" : "ANTECIPAÇÃO";
                    const cardBg = isProposalReposicao ? "bg-purple-50/40 border-purple-200" : "bg-blue-50/40 border-blue-200";
                    const labelText = isProposalReposicao ? "text-purple-700" : "text-blue-700";
                    const inputFocusBorder = isProposalReposicao ? "focus:border-purple-500" : "focus:border-blue-500";

                    return (
                      <div key={proposal.id} className={`${cardBg} border-2 rounded-2xl p-5 space-y-4 relative transition-colors duration-200`}>
                        {/* Label + Checkbox + Remove */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className={`text-xs font-black uppercase tracking-widest ${labelText}`}>
                              Proposta {idx + 1} ({calculatedTypeLabel})
                            </span>
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold text-gray-700">
                              <input
                                type="checkbox"
                                checked={proposal.is_reposicao}
                                onChange={e => setRemanejamentoProposals(prev =>
                                  prev.map(p => p.id === proposal.id ? {
                                    ...p,
                                    is_reposicao: e.target.checked,
                                    original_date: '',
                                    schedule_id: '',
                                    absent_key: ''
                                  } : p)
                                )}
                                className="w-4 h-4 rounded text-purple-600 border-gray-300 focus:ring-purple-500"
                              />
                              Reposição
                            </label>
                          </div>
                          {remanejamentoProposals.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setRemanejamentoProposals(prev => prev.filter(p => p.id !== proposal.id))}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Remover proposta"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                          {proposal.is_reposicao ? (
                            <>
                              {/* Reposição: Select absent class */}
                              <div className="sm:col-span-6">
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Selecionar Aula Ausente para Reposição *</label>
                                <select
                                  required
                                  disabled={!remanejamentoTeacher}
                                  value={proposal.absent_key}
                                  onChange={e => {
                                    const val = e.target.value;
                                    const foundAbsence = teacherAbsences.find(a => a.key === val);
                                    setRemanejamentoProposals(prev =>
                                      prev.map(p => p.id === proposal.id ? {
                                        ...p,
                                        absent_key: val,
                                        original_date: foundAbsence ? foundAbsence.date : '',
                                        schedule_id: foundAbsence ? foundAbsence.schedule_id : ''
                                      } : p)
                                    );
                                  }}
                                  className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-purple-500 outline-none transition-all disabled:opacity-50 text-sm"
                                >
                                  <option value="">Selecione a aula ausente do professor...</option>
                                  {teacherAbsences.map(abs => (
                                    <option key={abs.key} value={abs.key}>{abs.label}</option>
                                  ))}
                                </select>
                                {!remanejamentoTeacher && (
                                  <p className="text-[10px] text-gray-400 mt-1">Selecione o Docente no topo para listar as aulas ausentes.</p>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Antecipação: Data da Aula Original */}
                              <div className="sm:col-span-3">
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Data da Aula Original *</label>
                                <input
                                  type="date"
                                  required
                                  disabled={!remanejamentoTeacher}
                                  value={proposal.original_date}
                                  onChange={e => setRemanejamentoProposals(prev =>
                                    prev.map(p => p.id === proposal.id ? { ...p, original_date: e.target.value, schedule_id: '', absent_key: '' } : p)
                                  )}
                                  className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-blue-500 outline-none transition-all disabled:opacity-50 text-sm"
                                />
                              </div>

                              {/* Antecipação: Aula Original */}
                              <div className="sm:col-span-3">
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Aula Original *</label>
                                <select
                                  required
                                  disabled={!remanejamentoTeacher || !proposal.original_date}
                                  value={proposal.schedule_id}
                                  onChange={e => setRemanejamentoProposals(prev =>
                                    prev.map(p => p.id === proposal.id ? { ...p, schedule_id: e.target.value, absent_key: '' } : p)
                                  )}
                                  className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-blue-500 outline-none transition-all disabled:opacity-50 text-sm"
                                >
                                  <option value="">Selecione a aula...</option>
                                  {teacherSchedulesOnDay.map(s => {
                                    const slot = timeSlots.find(ts => ts.id === s.period);
                                    return (
                                      <option key={s.id} value={s.id}>
                                        {s.class_name} – {slot?.label}ª ({slot?.time}) {s.subject ? `– ${s.subject}` : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            </>
                          )}

                          {/* Nova Data */}
                          <div className={isProposalReposicao ? "sm:col-span-6" : "sm:col-span-3"}>
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                              {isProposalReposicao ? 'Data da Reposição *' : 'Data da Antecipação *'}
                            </label>
                            <input
                              type="date"
                              required
                              value={proposal.new_date}
                              onChange={e => setRemanejamentoProposals(prev =>
                                prev.map(p => p.id === proposal.id ? { ...p, new_date: e.target.value } : p)
                              )}
                              className={`w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-900 ${inputFocusBorder} outline-none transition-all text-sm`}
                            />
                          </div>

                          {/* Novo Horário */}
                          {!isProposalReposicao && (
                            <div className="sm:col-span-3">
                              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Novo Horário Proposto</label>
                              <select
                                value={proposal.new_period || ''}
                                onChange={e => setRemanejamentoProposals(prev =>
                                  prev.map(p => p.id === proposal.id ? { ...p, new_period: Number(e.target.value) } : p)
                                )}
                                className={`w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-900 ${inputFocusBorder} outline-none transition-all text-sm`}
                              >
                                <option value="">Selecione o horário...</option>
                                {vacantPeriodsForClass.map(ts => (
                                  <option key={ts.id} value={ts.id}>
                                    {ts.shift === 'M' ? 'Manhã' : ts.shift === 'T' ? 'Tarde' : 'Noite'} – {ts.label}ª ({ts.time})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Observação */}
                          <div className="sm:col-span-6">
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Observação (Opcional)</label>
                            <input
                              type="text"
                              value={proposal.observation}
                              onChange={e => setRemanejamentoProposals(prev =>
                                prev.map(p => p.id === proposal.id ? { ...p, observation: e.target.value } : p)
                              )}
                              placeholder="Ex: Aula no laboratório de redes..."
                              className={`w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-2xl font-medium text-gray-900 ${inputFocusBorder} outline-none transition-all text-sm`}
                            />
                          </div>
                        </div>

                        {/* Turmas livres */}
                        {!isProposalReposicao && proposal.new_date && proposal.new_period > 0 && (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                            <p className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <CheckCircle2 size={13} />
                              Turmas livres nesta data/aula ({vacantClasses.length})
                            </p>
                            {vacantClasses.length === 0
                              ? <p className="text-xs text-emerald-600 font-medium">Nenhuma turma com horário livre.</p>
                              : <div className="flex flex-wrap gap-1.5">
                                  {vacantClasses.map(c => (
                                    <span key={c.id} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-xs font-bold">{c.name}</span>
                                  ))}
                                </div>
                            }
                          </div>
                        )}

                        {/* Conflitos */}
                        {!isProposalReposicao && hasConflict && (
                          <div className="bg-red-50 border-2 border-red-100 rounded-xl p-3 space-y-1">
                            <p className="text-xs font-black text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                              <AlertCircle size={13} /> Conflitos detectados:
                            </p>
                            <ul className="list-disc pl-4 text-xs font-bold text-red-600 space-y-0.5">
                              {conflicts?.teacher && <li>{conflicts.teacher}</li>}
                              {conflicts?.class && <li>{conflicts.class}</li>}
                              {conflicts?.room && <li>{conflicts.room}</li>}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add more proposals */}
                <button
                  type="button"
                  onClick={() => setRemanejamentoProposals(prev => [
                    ...prev,
                    {
                      id: Date.now().toString(),
                      original_date: '',
                      schedule_id: '',
                      is_reposicao: false,
                      new_date: '',
                      new_period: 0,
                      absent_key: '',
                      observation: ''
                    }
                  ])}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-2xl font-bold text-sm hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                >
                  <Plus size={18} />
                  Adicionar Mais uma Aula Proposta
                </button>
              </div>

              {/* Footer buttons */}
              <div className="flex gap-4 px-7 pb-7 pt-3 shrink-0 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsRemanejamentoModalOpen(false)}
                  className="flex-1 px-6 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Confirmar Remanejamento{remanejamentoProposals.filter(p => {
                    const isRepos = p.is_reposicao || (p.original_date && p.new_date && p.new_date > p.original_date);
                    return isRepos 
                      ? (p.original_date && p.schedule_id && p.new_date)
                      : (p.original_date && p.schedule_id && p.new_date && p.new_period);
                  }).length > 1 ? 's' : ''}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          /* Esconder tudo por padrão */
          body * {
            visibility: hidden;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Mostrar apenas a seção de impressão e seus filhos */
          .print-section, .print-section * {
            visibility: visible;
            opacity: 1 !important;
            transform: none !important;
          }
          
          /* Posicionar a seção de impressão no topo da página */
          .print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* Ajustes de tabela para impressão */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          
          th, td {
            border: 1px solid #ddd !important;
            padding: 8px !important;
            color: black !important;
            background: white !important;
          }

          /* Garantir que cores de fundo apareçam (como os badges de status e cards) */
          .bg-green-100, .bg-green-50 { background-color: #dcfce7 !important; }
          .bg-yellow-100, .bg-yellow-50 { background-color: #fef9c3 !important; }
          .bg-red-100, .bg-red-50 { background-color: #fee2e2 !important; }
          
          /* Garantir bordas nas tabelas e cards */
          .border-green-100 { border-color: #bbf7d0 !important; }
          .border-yellow-100 { border-color: #fef08a !important; }
          .border-red-100 { border-color: #fecaca !important; }
          .border-gray-100 { border-color: #f3f4f6 !important; }
          
          th {
            background-color: #f9fafb !important;
            border-bottom: 2px solid #333 !important;
          }

          /* Forçar cores de texto */
          .text-green-700 { color: #15803d !important; }
          .text-yellow-700 { color: #a16207 !important; }
          .text-red-700 { color: #b91c1c !important; }
          .text-indigo-600 { color: #4f46e5 !important; }

          /* Ocultar elementos específicos dentro da seção de impressão que não queremos */
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
