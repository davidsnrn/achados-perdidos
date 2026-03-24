import React, { useState, useMemo } from 'react';
import { LockerSchedule, LockerScheduleStatus } from '../../types-armarios';
import { Search, Calendar, User, CheckCircle2, XCircle, Trash2, Clock, MapPin, Filter, Loader2, Info } from 'lucide-react';

interface AgendamentosTabProps {
  schedules: LockerSchedule[];
  onEfetivar: (schedule: LockerSchedule) => Promise<void>;
  onCancelar: (scheduleId: string) => Promise<void>;
  onExcluir: (scheduleId: string) => Promise<void>;
  isLoading?: boolean;
}

const AgendamentosTab: React.FC<AgendamentosTabProps> = ({
  schedules,
  onEfetivar,
  onCancelar,
  onExcluir,
  isLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LockerScheduleStatus | 'all'>(LockerScheduleStatus.PENDING);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const search = normalize(searchTerm);
      const matchesSearch = !search || 
        normalize(s.studentName).includes(search) || 
        normalize(s.registrationNumber).includes(search) || 
        normalize(s.lockerNumber.toString()).includes(search) ||
        normalize(s.lockerLocation).includes(search);
      
      return matchesStatus && matchesSearch;
    });
  }, [schedules, statusFilter, searchTerm]);

  const stats = useMemo(() => ({
    pending: schedules.filter(s => s.status === LockerScheduleStatus.PENDING).length,
    completed: schedules.filter(s => s.status === LockerScheduleStatus.COMPLETED).length,
    cancelled: schedules.filter(s => s.status === LockerScheduleStatus.CANCELLED).length,
  }), [schedules]);

  if (isLoading && schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <Loader2 size={48} className="text-amber-500 animate-spin mb-4" />
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Carregando agendamentos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={() => setStatusFilter(LockerScheduleStatus.PENDING)}
          className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${statusFilter === LockerScheduleStatus.PENDING ? 'bg-amber-500 border-amber-600 text-white shadow-xl shadow-amber-100 scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-amber-200'}`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Pendentes</span>
          <span className="text-4xl font-black">{stats.pending}</span>
        </button>
        <button 
          onClick={() => setStatusFilter(LockerScheduleStatus.COMPLETED)}
          className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${statusFilter === LockerScheduleStatus.COMPLETED ? 'bg-green-600 border-green-700 text-white shadow-xl shadow-green-100 scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-green-200'}`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Efetivados</span>
          <span className="text-4xl font-black">{stats.completed}</span>
        </button>
        <button 
          onClick={() => setStatusFilter(LockerScheduleStatus.CANCELLED)}
          className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${statusFilter === LockerScheduleStatus.CANCELLED ? 'bg-red-600 border-red-700 text-white shadow-xl shadow-red-100 scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-red-200'}`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Cancelados</span>
          <span className="text-4xl font-black">{stats.cancelled}</span>
        </button>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Lista de Agendamentos</h2>
            {statusFilter !== 'all' && (
              <button 
                onClick={() => setStatusFilter('all')}
                className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                <Filter size={12} /> Ver Todos
              </button>
            )}
          </div>
          
          <div className="relative w-full md:w-80">
            <input 
              type="text" 
              placeholder="Buscar agendamento..."
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 pl-10 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3 text-slate-300" size={18} />
          </div>
        </div>

        {filteredSchedules.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filteredSchedules.map(s => {
              const isPending = s.status === LockerScheduleStatus.PENDING;
              const isCompleted = s.status === LockerScheduleStatus.COMPLETED;
              const isCancelled = s.status === LockerScheduleStatus.CANCELLED;

              return (
                <div key={s.id} className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col gap-5 relative overflow-hidden group hover:shadow-xl ${isPending ? 'bg-amber-50/30 border-amber-100' : isCompleted ? 'bg-green-50/20 border-green-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  {isPending && <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-700"></div>}
                  
                  <div className="flex justify-between items-start z-10">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg ${isPending ? 'bg-amber-500 text-white' : isCompleted ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-500'}`}>
                        {s.lockerNumber}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 uppercase tracking-tight line-clamp-1">{s.studentName}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.registrationNumber}</span>
                          {s.studentClass && <span className="bg-slate-200/50 text-slate-500 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">{s.studentClass}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] shadow-sm ${isPending ? 'bg-amber-100 text-amber-600' : isCompleted ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                      {isPending ? 'Pendente' : isCompleted ? 'Concluído' : 'Cancelado'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/60 rounded-2xl border border-white/80 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                        <Calendar size={12} className="text-amber-500" /> Agendado em
                      </p>
                      <p className="text-[11px] font-black text-slate-700 uppercase">{new Date(s.scheduledAt).toLocaleDateString()} — {new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Por: <span className="text-slate-600">{s.scheduledBy}</span></p>
                    </div>

                    <div className="p-4 bg-white/60 rounded-2xl border border-white/80 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                        <MapPin size={12} className="text-amber-500" /> Localização
                      </p>
                      <p className="text-[11px] font-black text-slate-700 uppercase line-clamp-1">{s.lockerLocation || '---'}</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase italic whitespace-nowrap">Aguardando retirada</p>
                    </div>
                  </div>

                  {s.observation && (
                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50 flex gap-3">
                      <Info size={14} className="text-amber-400 shrink-0" />
                      <p className="text-[11px] text-amber-800 font-medium italic italic leading-snug">{s.observation}</p>
                    </div>
                  )}

                  {isCompleted && (
                    <div className="pt-4 border-t border-green-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-green-500" />
                        <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Efetivado por {s.completedBy}</span>
                      </div>
                      <span className="text-[10px] font-bold text-green-400">{new Date(s.completedAt || '').toLocaleDateString()}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {isPending && (
                      <>
                        <button 
                          onClick={() => onEfetivar(s)}
                          className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={14} /> Efetivar
                        </button>
                        <button 
                          onClick={() => onCancelar(s.id)}
                          className="flex-1 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 font-black py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <XCircle size={14} /> Cancelar
                        </button>
                      </>
                    )}
                    {(isCancelled || isCompleted) && (
                      <button 
                        onClick={() => onExcluir(s.id)}
                        className="w-full bg-slate-100 border-2 border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-100 font-black py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 size={14} /> Excluir Registro
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-24 bg-slate-50/50 rounded-[2.5rem] border-4 border-dashed border-slate-100">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
              <Clock size={32} className="text-slate-200" />
            </div>
            <p className="text-slate-400 font-black uppercase tracking-widest italic tracking-[0.2em]">Nenhum agendamento encontrado</p>
            <p className="text-slate-300 text-xs font-bold mt-2">Os agendamentos pendentes aparecerão aqui para efetivação.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgendamentosTab;
