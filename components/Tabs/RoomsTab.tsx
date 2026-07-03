import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar, Search, Plus, Trash2, Loader2, MapPin, Clock, CheckCircle2,
  AlertCircle, Save, Filter, Building2, User, BookOpen, AlertTriangle, Play, HelpCircle, X
} from 'lucide-react';
import { StorageService } from '../../services/storage';
import { RoomBooking, TeacherSchedule, User as UserType, Campus, Setor, UserLevel } from '../../types';
import { Modal } from '../ui/Modal';

interface Props {
  user: UserType;
  campuses: Campus[];
  setores: Setor[];
  adminGlobalCampusId: string | null;
  adminGlobalSetorId: string | null;
}

export const RoomsTab: React.FC<Props> = ({
  user,
  campuses,
  setores,
  adminGlobalCampusId,
  adminGlobalSetorId
}) => {
  const isUserStandard = user.level === UserLevel.STANDARD;
  const isGlobalAdmin = user.level === UserLevel.ADMIN;
  const currentCampusId = isGlobalAdmin ? adminGlobalCampusId : (adminGlobalCampusId || user.campus_id);
  const currentSetorId = isGlobalAdmin ? adminGlobalSetorId : (adminGlobalSetorId || user.setor_id);

  // Data States
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Sub Tab
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'busca' | 'agendamentos'>('status');

  // Search vacuums state
  const [searchMode, setSearchMode] = useState<'agora' | 'periodo'>('agora');
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchShift, setSearchShift] = useState<'M' | 'T' | 'N'>('M');
  const [searchPeriods, setSearchPeriods] = useState<number[]>([]);
  const [vacantRooms, setVacantRooms] = useState<string[]>([]);
  const [searchDone, setSearchDone] = useState(false);

  // Modal Detalhe da Sala
  const [roomDetailRoom, setRoomDetailRoom] = useState<string | null>(null);

  // Modal Agendamento
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState<Partial<RoomBooking>>({
    room_name: '',
    teacher_name: '',
    event_title: '',
    booking_type: 'EVENTO',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    recurrence_type: 'ALL_DAYS',
    recurrence_days: [],
    periods: [],
    observation: ''
  });

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

  const daysOfWeekList = [
    { id: 1, label: 'Segunda-feira' },
    { id: 2, label: 'Terça-feira' },
    { id: 3, label: 'Quarta-feira' },
    { id: 4, label: 'Quinta-feira' },
    { id: 5, label: 'Sexta-feira' }
  ];

  useEffect(() => {
    loadData();
  }, [currentCampusId, currentSetorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [schedulesData, bookingsData, classesData] = await Promise.all([
        StorageService.getTeacherSchedules(currentCampusId || undefined),
        (StorageService as any).getRoomBookings(currentCampusId || undefined, currentSetorId || undefined),
        StorageService.getTeacherClasses(currentCampusId || undefined)
      ]);

      setSchedules(schedulesData);
      setBookings(bookingsData);

      // Extrair todas as salas únicas cadastradas nas turmas
      const roomsSet = new Set<string>();
      classesData.forEach(c => {
        if (c.room && c.room.trim()) {
          roomsSet.add(c.room.trim());
        }
      });
      schedulesData.forEach(s => {
        if (s.room && s.room.trim()) {
          roomsSet.add(s.room.trim());
        }
      });
      bookingsData.forEach(b => {
        if (b.room_name && b.room_name.trim()) {
          roomsSet.add(b.room_name.trim());
        }
      });
      setRooms(Array.from(roomsSet).sort());
    } catch (err) {
      console.error('Erro ao carregar dados de salas:', err);
    } finally {
      setLoading(false);
    }
  };

  // Grade semanal para detalhe da sala
  const roomWeekGrid = useMemo(() => {
    if (!roomDetailRoom) return null;
    const roomKey = roomDetailRoom.toLowerCase();

    const grid: Record<number, Record<number, { schedule?: TeacherSchedule; booking?: RoomBooking }>> = {};
    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 0; day < 5; day++) {
      grid[day] = {};
      const daySchedules = schedules.filter(s =>
        s.room?.trim().toLowerCase() === roomKey && s.day_of_week === day
      );
      daySchedules.forEach(s => {
        const periods = s.periods && s.periods.length > 0 ? s.periods : [s.period];
        periods.forEach(p => {
          if (!grid[day][p]) grid[day][p] = {};
          grid[day][p]!.schedule = s;
        });
      });

      const dayBookings = bookings.filter(b => {
        if (b.room_name?.trim().toLowerCase() !== roomKey) return false;
        if (todayStr < b.start_date || todayStr > b.end_date) return false;
        if (b.recurrence_type === 'WEEKLY' || b.recurrence_type === 'SPECIFIC_DAYS') {
          if (b.recurrence_days && !b.recurrence_days.includes(day + 1)) return false;
        }
        return true;
      });
      dayBookings.forEach(b => {
        b.periods.forEach(p => {
          if (!grid[day][p]) grid[day][p] = {};
          grid[day][p]!.booking = b;
        });
      });
    }
    return grid;
  }, [roomDetailRoom, schedules, bookings]);

  // Helper to check if a booking conflicts with a slot on a specific date
  const isBookingActiveOn = (booking: RoomBooking, dateStr: string, slotId: number) => {
    if (dateStr < booking.start_date || dateStr > booking.end_date) return false;
    if (!booking.periods.includes(slotId)) return false;

    if (booking.recurrence_type === 'WEEKLY') {
      const dateObj = new Date(dateStr + 'T12:00:00');
      const day = dateObj.getDay(); // 0=Dom, 1=Seg...
      if (booking.recurrence_days && !booking.recurrence_days.includes(day)) return false;
    } else if (booking.recurrence_type === 'SPECIFIC_DAYS') {
      const dateObj = new Date(dateStr + 'T12:00:00');
      const day = dateObj.getDay();
      if (booking.recurrence_days && !booking.recurrence_days.includes(day)) return false;
    }
    return true;
  };

  // Status de ocupação atual da sala
  const getRoomOccupancyAt = (room: string, dateStr: string, slotId: number) => {
    const dateObj = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = dateObj.getDay(); // 0=Dom, 1=Seg...

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { occupied: false, schedule: null, booking: null };
    }

    const roomKey = room.toLowerCase();
    // 1. Verificar grade de aula regular
    const scheduleMatch = schedules.find(s =>
      s.room?.trim().toLowerCase() === roomKey &&
      s.day_of_week === dayOfWeek - 1 &&
      (s.period === slotId || s.periods?.includes(slotId))
    );

    // 2. Verificar agendamentos temporários/eventos
    const bookingMatch = bookings.find(b =>
      b.room_name?.trim().toLowerCase() === roomKey &&
      isBookingActiveOn(b, dateStr, slotId)
    );

    return {
      occupied: !!(scheduleMatch || bookingMatch),
      schedule: scheduleMatch,
      booking: bookingMatch
    };
  };

  // Verificar ocupação em QUALQUER período do dia
  const getRoomOccupancyToday = (room: string, dateStr: string) => {
    const dateObj = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { occupied: false, schedules: [] as TeacherSchedule[], bookings: [] as RoomBooking[] };
    }

    const roomKey = room.toLowerCase();
    const roomSchedules = schedules.filter(s =>
      s.room?.trim().toLowerCase() === roomKey &&
      s.day_of_week === dayOfWeek - 1 &&
      s.period != null
    );

    const roomBookings = bookings.filter(b => {
      if (b.room_name?.trim().toLowerCase() !== roomKey) return false;
      if (dateStr < b.start_date || dateStr > b.end_date) return false;
      if (b.recurrence_type === 'WEEKLY' || b.recurrence_type === 'SPECIFIC_DAYS') {
        const day = dateObj.getDay();
        if (b.recurrence_days && !b.recurrence_days.includes(day)) return false;
      }
      return b.periods && b.periods.length > 0;
    });

    return {
      occupied: roomSchedules.length > 0 || roomBookings.length > 0,
      schedules: roomSchedules,
      bookings: roomBookings
    };
  };

  // Determinar slot atual baseado no horário real
  const getCurrentSlot = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const currentDay = now.getDay(); // 0 = Dom, 1 = Seg ...

    if (currentDay === 0 || currentDay === 6) return null; // Fim de semana

    const matchedSlot = timeSlots.find(slot => {
      const [start, end] = slot.time.split(' - ');
      return timeStr >= start && timeStr <= end;
    });

    return matchedSlot || null;
  };

  const currentSlot = getCurrentSlot();

  // Executar busca de salas vazias
  const handleSearchVacantRooms = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let targetDate = searchDate;
    let targetPeriods: number[] = [];

    if (searchMode === 'agora') {
      const now = new Date();
      targetDate = now.toISOString().split('T')[0];
      const slot = getCurrentSlot();
      if (slot) {
        targetPeriods = [slot.id];
      } else {
        alert('Não há nenhuma aula ocorrendo no horário atual do sistema. Use a busca por período.');
        return;
      }
    } else {
      if (searchPeriods.length === 0) {
        alert('Por favor, selecione ao menos uma aula para busca por período.');
        return;
      }
      targetPeriods = searchPeriods;
    }

    // Filtrar salas que não estão ocupadas em NENHUM dos períodos solicitados
    const vacant = rooms.filter(room => {
      return targetPeriods.every(periodId => {
        const occupancy = getRoomOccupancyAt(room, targetDate, periodId);
        return !occupancy.occupied;
      });
    });

    setVacantRooms(vacant);
    setSearchDone(true);
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingForm.room_name || !bookingForm.event_title || bookingForm.periods?.length === 0 || !currentCampusId) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    try {
      setIsSaving(true);
      await (StorageService as any).saveRoomBooking({
        ...bookingForm,
        campus_id: currentCampusId,
        setor_id: currentSetorId || undefined,
        operator_id: user.id
      } as RoomBooking);

      setIsBookingModalOpen(false);
      alert('Reserva/Agendamento de sala salvo com sucesso!');
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar reserva: ${err.message || JSON.stringify(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!confirm('Deseja realmente remover esta reserva de sala?')) return;

    try {
      setLoading(true);
      await (StorageService as any).deleteRoomBooking(id);
      alert('Reserva de sala removida.');
      loadData();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir reserva.');
    } finally {
      setLoading(false);
    }
  };

  const togglePeriodSelection = (periodId: number) => {
    if (searchPeriods.includes(periodId)) {
      setSearchPeriods(searchPeriods.filter(id => id !== periodId));
    } else {
      setSearchPeriods([...searchPeriods, periodId]);
    }
  };

  const toggleBookingPeriodSelection = (periodId: number) => {
    const current = bookingForm.periods || [];
    if (current.includes(periodId)) {
      setBookingForm({ ...bookingForm, periods: current.filter(id => id !== periodId) });
    } else {
      setBookingForm({ ...bookingForm, periods: [...current, periodId] });
    }
  };

  const toggleBookingDaySelection = (dayId: number) => {
    const current = bookingForm.recurrence_days || [];
    if (current.includes(dayId)) {
      setBookingForm({ ...bookingForm, recurrence_days: current.filter(id => id !== dayId) });
    } else {
      setBookingForm({ ...bookingForm, recurrence_days: [...current, dayId] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Building2 size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Controle de Salas</h1>
            <p className="text-gray-500 font-medium">Controle de ocupação, reservas e salas vazias</p>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 relative z-10 w-fit">
          <button
            onClick={() => setActiveSubTab('status')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'status' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Status Atual
          </button>
          <button
            onClick={() => { setActiveSubTab('busca'); setSearchDone(false); }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'busca' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Buscar Sala Vazia
          </button>
          <button
            onClick={() => setActiveSubTab('agendamentos')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'agendamentos' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Agendamentos / Reservas
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border border-dashed border-gray-200">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
          <p className="text-gray-500 font-bold">Buscando dados de salas...</p>
        </div>
      ) : (
        <>
          {/* ABA 1: STATUS ATUAL DAS SALAS */}
          {activeSubTab === 'status' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900">Salas no Câmpus</h3>
                  <p className="text-xs text-gray-500 font-medium mt-1">Status de ocupação no momento atual</p>
                </div>
                {currentSlot ? (
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-xs font-bold text-indigo-700">
                    <Clock size={16} /> Aula Atual: {currentSlot.label}ª Aula ({currentSlot.time})
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-2 text-xs font-bold text-yellow-700">
                    <Clock size={16} /> Sem Aula ativa no momento atual
                  </div>
                )}
              </div>

              {rooms.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                  <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-400 font-bold">Nenhuma sala identificada no sistema.</p>
                  <p className="text-xs text-gray-400 mt-1">Salas são cadastradas nas Turmas ou Agendamentos.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rooms.map(room => {
                    const todayStr = new Date().toISOString().split('T')[0];

                    const occ = currentSlot
                      ? getRoomOccupancyAt(room, todayStr, currentSlot.id)
                      : getRoomOccupancyToday(room, todayStr);

                    const isOccupied = occ && 'occupied' in occ ? occ.occupied : false;
                    const schedules = (occ as any).schedules || [];
                    const bookings = (occ as any).bookings || [];
                    const singleSchedule = (occ as any).schedule || null;
                    const singleBooking = (occ as any).booking || null;

                    return (
                      <div
                        key={room}
                        onClick={() => setRoomDetailRoom(room)}
                        className={`bg-white p-6 rounded-[2rem] shadow-sm border-2 transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                          isOccupied
                            ? 'border-red-100 hover:border-red-300 bg-red-50/20'
                            : 'border-green-100 hover:border-green-300 bg-green-50/20'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xl font-black text-gray-900">{room}</h4>
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                              isOccupied
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {isOccupied ? 'Ocupada' : 'Livre'}
                            </span>
                          </div>

                          {isOccupied && currentSlot && singleSchedule && (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Aula Regular <span className="text-indigo-500">({timeSlots.find(t => t.id === currentSlot.id)?.label}ª)</span></p>
                              <div className="bg-white rounded-2xl p-4 border border-red-50 space-y-1">
                                <div className="text-sm font-black text-gray-900">{singleSchedule.class_name}</div>
                                <div className="text-xs font-bold text-indigo-600">{singleSchedule.subject}</div>
                                <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-1">
                                  <User size={12} /> Prof: {singleSchedule.teacher_name}
                                </div>
                              </div>
                            </div>
                          )}

                          {isOccupied && currentSlot && singleBooking && (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Evento / Agendamento</p>
                              <div className="bg-white rounded-2xl p-4 border border-purple-50 space-y-1">
                                <div className="text-sm font-black text-gray-900">{singleBooking.event_title}</div>
                                <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{singleBooking.booking_type}</div>
                                {singleBooking.teacher_name && (
                                  <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-1">
                                    <User size={12} /> Prof: {singleBooking.teacher_name}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {isOccupied && !currentSlot && (
                            <div className="space-y-2">
                              {schedules.length > 0 && (
                                <>
                                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Aulas Hoje ({schedules.length})</p>
                                  <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {schedules.map((sch: TeacherSchedule, i: number) => {
                                      const slotLabel = timeSlots.find(t => t.id === sch.period)?.label || sch.period;
                                      return (
                                        <div key={i} className="bg-white rounded-2xl p-3 border border-red-50 space-y-0.5 text-xs">
                                          <div className="font-black text-gray-900">{slotLabel}ª - {sch.class_name}</div>
                                          <div className="font-bold text-indigo-600">{sch.subject}</div>
                                          <div className="text-gray-500 font-medium flex items-center gap-1">
                                            <User size={10} /> {sch.teacher_name}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                              {bookings.length > 0 && schedules.length === 0 && (
                                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                  <p className="text-xs font-black text-gray-900">{bookings[0].event_title}</p>
                                  <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">{bookings[0].booking_type}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {!isOccupied && (
                            <p className="text-sm text-gray-500 font-medium">Esta sala está livre e disponível no momento.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: BUSCA POR SALAS VAZIAS */}
          {activeSubTab === 'busca' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-6">Procurar Sala Vazia</h3>

                <form onSubmit={handleSearchVacantRooms} className="space-y-6">
                  <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                    <button
                      type="button"
                      onClick={() => { setSearchMode('agora'); setSearchDone(false); }}
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${searchMode === 'agora' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Agora Mesmo
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSearchMode('periodo'); setSearchDone(false); }}
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${searchMode === 'periodo' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Por Período / Aula
                    </button>
                  </div>

                  {searchMode === 'periodo' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Data *</label>
                          <input
                            type="date"
                            required
                            value={searchDate}
                            onChange={e => setSearchDate(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Turno *</label>
                          <select
                            value={searchShift}
                            onChange={e => { setSearchShift(e.target.value as any); setSearchPeriods([]); }}
                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
                          >
                            <option value="M">Manhã</option>
                            <option value="T">Tarde</option>
                            <option value="N">Noite</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Selecione as Aulas / Períodos desejados *</label>
                        <div className="flex flex-wrap gap-2">
                          {timeSlots.filter(s => s.shift === searchShift).map(slot => {
                            const isSelected = searchPeriods.includes(slot.id);
                            return (
                              <button
                                type="button"
                                key={slot.id}
                                onClick={() => togglePeriodSelection(slot.id)}
                                className={`px-4 py-2.5 rounded-xl border-2 font-bold text-xs transition-all ${
                                  isSelected
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                                    : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {slot.label}ª Aula ({slot.time})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-md"
                  >
                    <Search size={18} />
                    {searchMode === 'agora' ? 'Buscar Agora' : 'Filtrar Salas Livres'}
                  </button>
                </form>
              </div>

              {searchDone && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-lg font-black text-gray-900 mb-4">Salas Vazias Encontradas ({vacantRooms.length})</h3>

                  {vacantRooms.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                      <AlertTriangle size={36} className="mx-auto text-yellow-500 mb-2" />
                      <p className="font-bold">Não foi encontrada nenhuma sala 100% desocupada no horário selecionado.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {vacantRooms.map(room => (
                        <div key={room} className="bg-green-50 border-2 border-green-200 text-green-900 p-4 rounded-2xl flex flex-col items-center justify-center font-black text-center shadow-sm">
                          <CheckCircle2 className="text-green-600 mb-2" size={24} />
                          <span className="text-base">{room}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ABA 3: GERENCIAR AGENDAMENTOS */}
          {activeSubTab === 'agendamentos' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-gray-900">Histórico de Reservas</h3>
                  <p className="text-xs text-gray-500 font-medium mt-1">Gerencie os agendamentos cadastrados</p>
                </div>
                {!isUserStandard && (
                  <button
                    onClick={() => {
                      setBookingForm({
                        room_name: '',
                        teacher_name: '',
                        event_title: '',
                        booking_type: 'EVENTO',
                        start_date: new Date().toISOString().split('T')[0],
                        end_date: new Date().toISOString().split('T')[0],
                        recurrence_type: 'ALL_DAYS',
                        recurrence_days: [],
                        periods: [],
                        observation: ''
                      });
                      setIsBookingModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95"
                  >
                    <Plus size={18} /> Reservar Sala
                  </button>
                )}
              </div>

              {bookings.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                  <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-400 font-bold">Nenhuma reserva ou agendamento de sala ativo no momento.</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Sala</th>
                          <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Período / Datas</th>
                          <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Evento / Responsável</th>
                          <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Aulas/Horários</th>
                          <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Recorrência</th>
                          {!isUserStandard && <th className="p-4 w-20"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {bookings.map(booking => {
                          const start = new Date(booking.start_date + 'T12:00:00').toLocaleDateString('pt-BR');
                          const end = new Date(booking.end_date + 'T12:00:00').toLocaleDateString('pt-BR');

                          return (
                            <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="p-4 font-black text-gray-900 text-lg">{booking.room_name}</td>
                              <td className="p-4">
                                <div className="text-sm font-bold text-gray-700">
                                  {booking.start_date === booking.end_date ? start : `De ${start} a ${end}`}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="text-sm font-black text-gray-900">{booking.event_title}</div>
                                {booking.teacher_name && (
                                  <div className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                                    <User size={10} /> Prof: {booking.teacher_name}
                                  </div>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="flex flex-wrap gap-1">
                                  {booking.periods.map(p => (
                                    <span key={p} className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded">
                                      {p}ª Aula
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="text-xs font-bold text-gray-600">
                                  {booking.recurrence_type === 'ALL_DAYS' && 'Todos os dias'}
                                  {booking.recurrence_type === 'WEEKLY' && 'Semanal'}
                                  {booking.recurrence_type === 'SPECIFIC_DAYS' && 'Dias específicos'}
                                </div>
                              </td>
                              {!isUserStandard && (
                                <td className="p-4 text-right">
                                  <button
                                    onClick={() => handleDeleteBooking(booking.id!)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Novo Agendamento */}
      <Modal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        title="Reservar / Agendar Sala"
      >
        <form onSubmit={handleSaveBooking} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Sala *</label>
              <select
                required
                value={bookingForm.room_name}
                onChange={e => setBookingForm({ ...bookingForm, room_name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="">Selecione uma sala...</option>
                {rooms.map(room => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Tipo de Agendamento *</label>
              <select
                required
                value={bookingForm.booking_type}
                onChange={e => setBookingForm({ ...bookingForm, booking_type: e.target.value as any })}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="EVENTO">Evento / Reserva Geral</option>
                <option value="AULA">Aula Especial / Reposição</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Título do Evento / Motivo *</label>
              <input
                type="text"
                required
                value={bookingForm.event_title}
                onChange={e => setBookingForm({ ...bookingForm, event_title: e.target.value })}
                placeholder="Ex: Reunião do Grêmio, Aula de Robótica"
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-medium text-gray-900 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Professor Responsável (Opcional)</label>
              <input
                type="text"
                value={bookingForm.teacher_name || ''}
                onChange={e => setBookingForm({ ...bookingForm, teacher_name: e.target.value })}
                placeholder="Ex: Prof. Silva"
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-medium text-gray-900 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Data Início *</label>
              <input
                type="date"
                required
                value={bookingForm.start_date}
                onChange={e => setBookingForm({ ...bookingForm, start_date: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Data Fim *</label>
              <input
                type="date"
                required
                value={bookingForm.end_date}
                min={bookingForm.start_date}
                onChange={e => setBookingForm({ ...bookingForm, end_date: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-900 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">Configuração de Recorrência *</label>
            <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setBookingForm({ ...bookingForm, recurrence_type: 'ALL_DAYS', recurrence_days: [] })}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${bookingForm.recurrence_type === 'ALL_DAYS' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Todos os Dias
              </button>
              <button
                type="button"
                onClick={() => setBookingForm({ ...bookingForm, recurrence_type: 'WEEKLY', recurrence_days: [] })}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${bookingForm.recurrence_type === 'WEEKLY' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Um dia da Semana
              </button>
              <button
                type="button"
                onClick={() => setBookingForm({ ...bookingForm, recurrence_type: 'SPECIFIC_DAYS', recurrence_days: [] })}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${bookingForm.recurrence_type === 'SPECIFIC_DAYS' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Vários Dias
              </button>
            </div>

            {bookingForm.recurrence_type !== 'ALL_DAYS' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500">Selecione os dias da semana:</label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeekList.map(day => {
                    const isSelected = (bookingForm.recurrence_days || []).includes(day.id);
                    return (
                      <button
                        type="button"
                        key={day.id}
                        onClick={() => toggleBookingDaySelection(day.id)}
                        className={`px-3 py-1.5 rounded-lg border font-bold text-xs transition-all ${
                          isSelected ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-gray-100 text-gray-500'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Aulas / Períodos Afetados *</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {timeSlots.map(slot => {
                const isSelected = (bookingForm.periods || []).includes(slot.id);
                return (
                  <button
                    type="button"
                    key={slot.id}
                    onClick={() => toggleBookingPeriodSelection(slot.id)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {slot.label}ª ({slot.shift} - {slot.time.split(' - ')[0]})
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Observação adicional</label>
            <textarea
              value={bookingForm.observation || ''}
              onChange={e => setBookingForm({ ...bookingForm, observation: e.target.value })}
              placeholder="Ex: Deixar as chaves na coordenação..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl font-medium text-gray-900 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsBookingModalOpen(false)}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || (bookingForm.periods || []).length === 0}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              Salvar Reserva
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Detalhe da Sala - Grade Semanal */}
      <Modal
        isOpen={!!roomDetailRoom}
        onClose={() => setRoomDetailRoom(null)}
        title={roomDetailRoom ? `Grade Semanal - ${roomDetailRoom}` : ''}
        maxWidth="max-w-6xl"
      >
        <div className="p-6 overflow-x-auto">
          {!roomWeekGrid ? (
            <div className="py-12 text-center text-gray-400 font-bold">Carregando...</div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="p-2 sticky left-0 bg-white z-10 w-20"></th>
                  {daysOfWeekList.map(d => (
                    <th key={d.id} className="p-3 text-center font-black text-gray-700 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50/50 min-w-[130px]">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['M', 'T', 'N'] as const).map(shift => {
                  const shiftSlots = timeSlots.filter(s => s.shift === shift);
                  const shiftLabel = shift === 'M' ? 'Manhã' : shift === 'T' ? 'Tarde' : 'Noite';
                  return (
                    <React.Fragment key={shift}>
                      <tr>
                        <td
                          colSpan={6}
                          className="p-2 pt-4 text-xs font-black uppercase tracking-widest text-gray-400"
                        >
                          {shiftLabel}
                        </td>
                      </tr>
                      {shiftSlots.map(slot => {
                        const day0 = roomWeekGrid[0]?.[slot.id];
                        const day1 = roomWeekGrid[1]?.[slot.id];
                        const day2 = roomWeekGrid[2]?.[slot.id];
                        const day3 = roomWeekGrid[3]?.[slot.id];
                        const day4 = roomWeekGrid[4]?.[slot.id];
                        const cells = [day0, day1, day2, day3, day4];
                        const colSpan = cells.every(c => !c) ? 6 : undefined;

                        return (
                          <tr key={slot.id}>
                            <td className="p-2 sticky left-0 bg-white z-10 text-[11px] font-bold text-gray-500 whitespace-nowrap border-b border-gray-50">
                              {slot.label}ª ({slot.time})
                            </td>
                            {colSpan ? (
                              <td colSpan={5} className="p-2 text-center text-[10px] text-gray-300 italic border-b border-gray-50">
                                Sem aulas neste horário
                              </td>
                            ) : (
                              daysOfWeekList.map((d, i) => {
                                const cell = cells[i];
                                if (!cell) {
                                  return (
                                    <td key={d.id} className="p-1.5 border-b border-gray-50">
                                      <div className="h-full min-h-[36px] rounded-lg bg-gray-50/30 border border-dashed border-gray-100 flex items-center justify-center">
                                        <span className="text-[10px] text-gray-300">—</span>
                                      </div>
                                    </td>
                                  );
                                }
                                const isSchedule = !!cell.schedule;
                                const isBooking = !!cell.booking;
                                return (
                                  <td key={d.id} className="p-1.5 border-b border-gray-50">
                                    {isSchedule && (
                                      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-[10px] leading-tight space-y-0.5">
                                        <div className="font-black text-indigo-900 truncate">{cell.schedule!.class_name}</div>
                                        <div className="font-bold text-indigo-600 truncate">{cell.schedule!.subject}</div>
                                        <div className="text-gray-500 truncate flex items-center gap-1">
                                          <User size={9} /> {cell.schedule!.teacher_name}
                                        </div>
                                      </div>
                                    )}
                                    {isBooking && !isSchedule && (
                                      <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-[10px] leading-tight space-y-0.5">
                                        <div className="font-black text-purple-900 truncate">{cell.booking!.event_title}</div>
                                        <div className="font-bold text-purple-600 uppercase tracking-wider text-[9px]">{cell.booking!.booking_type}</div>
                                        {cell.booking!.teacher_name && (
                                          <div className="text-gray-500 truncate flex items-center gap-1">
                                            <User size={9} /> {cell.booking!.teacher_name}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                );
                              })
                            )}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  );
};
