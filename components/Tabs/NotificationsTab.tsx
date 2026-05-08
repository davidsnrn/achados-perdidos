import React, { useState, useMemo } from 'react';
import { Search, Plus, Filter, Download, Trash2, Calendar, Clock, User as UserIcon, BookOpen, AlertCircle, CheckCircle2, MoreVertical, ShieldAlert, FileText, UserPlus, ClipboardList, Printer, Settings, Loader2, Pencil } from 'lucide-react';
import { StorageService } from '../../services/storage';
import { StudentNotification, User, UserLevel, Campus, Person, NotificationType } from '../../types';
import { Modal } from '../ui/Modal';

interface NotificationsTabProps {
  notifications: StudentNotification[];
  notificationTypes: NotificationType[];
  user: User;
  onUpdate: () => void;
  campuses: Campus[];
  adminGlobalCampusId: string | null;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({
  notifications,
  notificationTypes,
  user,
  onUpdate,
  campuses,
  adminGlobalCampusId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isStudentDetailOpen, setIsStudentDetailOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<Partial<NotificationType> | null>(null);
  const [newSubtype, setNewSubtype] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<StudentNotification>>({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    student_matricula: '',
    student_name: '',
    period: '',
    class_name: '',
    out_of_hours: false,
    mobile_use: false,
    no_uniform: false,
    no_sneakers: false, // Removendo gradualmente do UI
    justification: '',
    teacher_referral: false,
    teacher_name: '',
    notification_type_ids: [],
    selected_subtypes: []
  });

  const [personSearch, setPersonSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);

  const groupedNotifications = useMemo(() => {
    const filtered = notifications.filter(n => 
      n.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.student_matricula.includes(searchTerm) ||
      (n.class_name && n.class_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const groups: { [key: string]: { student_name: string, student_matricula: string, class_name: string, items: StudentNotification[] } } = {};
    
    filtered.forEach(n => {
      if (!groups[n.student_matricula]) {
        groups[n.student_matricula] = {
          student_name: n.student_name,
          student_matricula: n.student_matricula,
          class_name: n.class_name || '-',
          items: []
        };
      }
      groups[n.student_matricula].items.push(n);
    });

    return Object.values(groups).sort((a, b) => b.items.length - a.items.length || a.student_name.localeCompare(b.student_name));
  }, [notifications, searchTerm]);

  const handleSearchPeople = async (query: string) => {
    setPersonSearch(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearchingPeople(true);
    try {
      const results = await StorageService.searchPeople(query, 5, adminGlobalCampusId || user.campus_id);
      setSearchResults(results);
    } catch (error) {
      console.error("Erro ao buscar pessoas:", error);
    } finally {
      setIsSearchingPeople(false);
    }
  };

  const selectPerson = (person: Person) => {
    setFormData(prev => ({
      ...prev,
      student_matricula: person.matricula,
      student_name: person.name
    }));
    setPersonSearch(person.name);
    setSearchResults([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_matricula || !formData.student_name) {
      alert("Por favor, selecione um aluno.");
      return;
    }

    setIsSaving(true);
    try {
      await StorageService.saveNotification({
        ...formData,
        campus_id: adminGlobalCampusId || user.campus_id || '',
        operator_id: user.id
      });
      onUpdate();
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar notificação:", error);
      alert("Erro ao salvar notificação.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta notificação?")) return;

    try {
      await StorageService.deleteNotification(id);
      onUpdate();
      // If we are in student detail modal, update it
      if (selectedStudent) {
        setSelectedStudent((prev: any) => ({
          ...prev,
          items: prev.items.filter((i: any) => i.id !== id)
        }));
      }
    } catch (error) {
      console.error("Erro ao excluir notificação:", error);
      alert("Erro ao excluir.");
    }
  };

  const handleEditNotification = (n: StudentNotification) => {
    setFormData({
      id: n.id,
      date: n.date,
      time: n.time,
      student_matricula: n.student_matricula,
      student_name: n.student_name,
      period: n.period,
      class_name: n.class_name,
      out_of_hours: n.out_of_hours,
      mobile_use: n.mobile_use,
      no_uniform: n.no_uniform,
      no_sneakers: n.no_sneakers,
      justification: n.justification,
      teacher_referral: n.teacher_referral,
      teacher_name: n.teacher_name,
      notification_type_ids: n.notification_type_ids || [],
      selected_subtypes: n.selected_subtypes || [],
      campus_id: n.campus_id,
      operator_id: n.operator_id
    });
    setPersonSearch(n.student_name);
    setIsStudentDetailOpen(false); // Fecha o modal de detalhes
    setIsModalOpen(true); // Abre o modal de edição
  };

  const handleAddSubtype = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const val = newSubtype.trim();
    if (val && !selectedType?.subtypes?.includes(val)) {
      setSelectedType({ 
        ...selectedType, 
        subtypes: [...(selectedType?.subtypes || []), val] 
      });
      setNewSubtype('');
    }
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType?.name) return;

    // Adiciona o subtipo pendente se houver
    let finalSubtypes = selectedType.subtypes || [];
    if (newSubtype.trim() && !finalSubtypes.includes(newSubtype.trim())) {
      finalSubtypes = [...finalSubtypes, newSubtype.trim()];
    }

    setIsSaving(true);
    try {
      await StorageService.saveNotificationType({
        ...selectedType,
        subtypes: finalSubtypes,
        campus_id: adminGlobalCampusId || user.campus_id || ''
      });
      onUpdate();
      setSelectedType(null);
      setNewSubtype('');
    } catch (error) {
      console.error("Erro ao salvar tipo:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm("Excluir este tipo de ocorrência?")) return;
    try {
      await StorageService.deleteNotificationType(id);
      onUpdate();
    } catch (error) {
      console.error("Erro ao excluir tipo:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      student_matricula: '',
      student_name: '',
      period: '',
      class_name: '',
      out_of_hours: false,
      mobile_use: false,
      no_uniform: false,
      no_sneakers: false,
      justification: '',
      teacher_referral: false,
      teacher_name: '',
      notification_type_ids: [],
      selected_subtypes: []
    });
    setPersonSearch('');
    setSearchResults([]);
  };

  const openNewModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-100">
            <ShieldAlert size={30} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Notificações de Alunos</h2>
            <p className="text-gray-500 font-medium">Controle de ocorrências e disciplina</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3.5 rounded-2xl font-bold transition-all active:scale-95"
          >
            <Settings size={20} />
            Configurar Tipos
          </button>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-red-100 active:scale-95"
          >
            <Plus size={20} />
            Nova Notificação
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, matrícula ou turma..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border-2 border-transparent focus:border-red-500 focus:bg-white rounded-2xl pl-12 pr-4 py-3.5 outline-none transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-2">
           {/* Possible filter by type/reason here */}
        </div>
      </div>

      {/* Grouped Notifications Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Aluno</th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Turma / Período</th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Total Ocorrências</th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groupedNotifications.length > 0 ? (
                groupedNotifications.map((group) => (
                  <tr key={group.student_matricula} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{group.student_name}</span>
                        <span className="text-xs text-gray-400 font-mono">{group.student_matricula}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-600">{group.class_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${group.items.length >= 3 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                        {group.items.length}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => {
                          setSelectedStudent(group);
                          setIsStudentDetailOpen(true);
                        }}
                        className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold text-xs transition-all"
                      >
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <ShieldAlert size={32} className="text-gray-300" />
                      </div>
                      <p className="text-gray-400 font-medium italic">Nenhuma notificação encontrada.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Notification Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={formData.id ? "Editar Notificação" : "Nova Notificação de Aluno"}
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleSave} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left Column: Student Identification */}
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <UserIcon size={14} /> Identificação do Aluno
                </h4>
                
                {!formData.student_matricula ? (
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Nome ou Matrícula..."
                      value={personSearch}
                      onChange={e => handleSearchPeople(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-red-500 outline-none font-bold transition-all"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto">
                        {searchResults.map(p => (
                          <button
                            key={p.matricula}
                            type="button"
                            onClick={() => selectPerson(p)}
                            className="w-full p-4 text-left hover:bg-red-50 flex flex-col gap-0.5 transition-all group border-b border-gray-50 last:border-0"
                          >
                            <p className="font-bold text-gray-800 group-hover:text-red-600 transition-colors">{p.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{p.matricula}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 border-2 border-green-100 rounded-2xl flex items-center justify-between group animate-scale-in">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-green-500 shadow-sm">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-tight">Aluno Selecionado</p>
                        <p className="font-bold text-gray-800 leading-tight">{formData.student_name}</p>
                        <p className="text-xs text-gray-400 font-mono">{formData.student_matricula}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-xs font-bold text-red-500 hover:bg-white px-3 py-1.5 rounded-lg transition-all"
                    >
                      Trocar
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-wider">Turma</label>
                    <input
                      type="text"
                      placeholder="Ex: ADM2M"
                      value={formData.class_name || ''}
                      onChange={e => setFormData({ ...formData, class_name: e.target.value.toUpperCase() })}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-red-500 outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-wider">Período</label>
                    <input
                      type="text"
                      placeholder="Ex: 2025.2"
                      value={formData.period || ''}
                      onChange={e => setFormData({ ...formData, period: e.target.value })}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-red-500 outline-none font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Date, Time & Types */}
            <div className="lg:col-span-3 space-y-8">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} /> Data e Horário
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-wider">Data do Registro</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                      <input
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-red-500 outline-none font-bold appearance-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-wider">Horário</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                      <input
                        type="time"
                        value={formData.time}
                        onChange={e => setFormData({ ...formData, time: e.target.value })}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-red-500 outline-none font-bold appearance-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ocorrências Dinâmicas */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle size={14} /> Tipos de Ocorrência
                </h4>
                <div className="flex flex-wrap gap-3">
                  {notificationTypes.map(type => (
                    <label key={type.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${formData.notification_type_ids?.includes(type.id) ? 'bg-white border-red-500 shadow-sm' : 'bg-gray-50 border-gray-100 hover:border-gray-200'}`}>
                      <input
                        type="checkbox"
                        checked={formData.notification_type_ids?.includes(type.id)}
                        onChange={e => {
                          const ids = formData.notification_type_ids || [];
                          if (e.target.checked) {
                            setFormData({ ...formData, notification_type_ids: [...ids, type.id] });
                          } else {
                            setFormData({ ...formData, notification_type_ids: ids.filter(id => id !== type.id) });
                          }
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: type.color }}></div>
                        <span className={`text-sm font-bold ${formData.notification_type_ids?.includes(type.id) ? 'text-gray-900' : 'text-gray-600'}`}>{type.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Subtipos Dinâmicos */}
              {notificationTypes.filter(t => formData.notification_type_ids?.includes(t.id) && t.subtypes && t.subtypes.length > 0).length > 0 && (
                <div className="space-y-4 animate-fade-in">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardList size={14} /> Classificação (Subtipos)
                  </h4>
                  <div className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-100 space-y-6">
                    {notificationTypes
                      .filter(t => formData.notification_type_ids?.includes(t.id) && t.subtypes && t.subtypes.length > 0)
                      .map(type => (
                        <div key={type.id} className="space-y-3">
                          <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: type.color }}></div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{type.name}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {type.subtypes?.map(sub => (
                              <button
                                key={`${type.id}-${sub}`}
                                type="button"
                                onClick={() => {
                                  const current = formData.selected_subtypes || [];
                                  if (current.includes(sub)) {
                                    setFormData({ ...formData, selected_subtypes: current.filter(s => s !== sub) });
                                  } else {
                                    setFormData({ ...formData, selected_subtypes: [...current, sub] });
                                  }
                                }}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border-2 ${formData.selected_subtypes?.includes(sub) ? 'bg-white border-red-500 text-red-600 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                              >
                                {sub}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-gray-100">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} /> Detalhes e Justificativa
              </h4>
              <textarea
                placeholder="Descreva a situação ou a justificativa apresentada pelo aluno..."
                value={formData.justification}
                onChange={e => setFormData({ ...formData, justification: e.target.value })}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-3xl p-6 text-sm focus:border-red-500 outline-none font-bold min-h-[140px] shadow-inner"
              />
            </div>

            <div className="flex items-center gap-8 p-8 bg-red-50 rounded-3xl border border-red-100">
              <label className="flex items-center gap-4 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.teacher_referral}
                  onChange={e => setFormData({ ...formData, teacher_referral: e.target.checked })}
                  className="w-7 h-7 rounded-lg border-red-200 text-red-600 focus:ring-red-500 transition-all"
                />
                <div>
                  <span className="text-sm font-black text-red-700 uppercase tracking-tight block">Encaminhamento do Professor?</span>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">A ocorrência foi solicitada por um docente?</p>
                </div>
              </label>
              
              {formData.teacher_referral && (
                <div className="flex-1 animate-slide-right">
                  <input
                    type="text"
                    placeholder="Nome do Professor Solicitante..."
                    value={formData.teacher_name}
                    onChange={e => setFormData({ ...formData, teacher_name: e.target.value })}
                    className="w-full bg-white border-2 border-red-100 rounded-2xl px-6 py-4 text-sm focus:border-red-500 outline-none font-bold shadow-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="flex-1 py-5 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition-all text-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !formData.student_matricula}
              className="flex-[2] py-5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-2xl font-black hover:shadow-2xl hover:shadow-red-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-xl"
            >
              {isSaving ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
              {formData.id ? 'Salvar Alterações' : 'Finalizar Registro'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Student Detail Modal */}
      <Modal
        isOpen={isStudentDetailOpen}
        onClose={() => setIsStudentDetailOpen(false)}
        title=""
        maxWidth="max-w-3xl"
      >
        {selectedStudent && (
          <div className="space-y-8 p-1">
            <div className="flex items-center justify-between border-b border-gray-100 pb-8">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-3xl font-black text-gray-900 tracking-tight">{selectedStudent.student_name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-black uppercase tracking-wider">{selectedStudent.student_matricula}</span>
                    <span className="text-gray-400 font-bold text-sm">|</span>
                    <span className="text-gray-500 font-black text-sm uppercase tracking-tight">{selectedStudent.class_name}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Total de Ocorrências</p>
                <span className="text-4xl font-black text-red-600 tabular-nums">{selectedStudent.items.length}</span>
              </div>
            </div>

            <div className="space-y-6 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-gray-100">
              {selectedStudent.items.map((n: StudentNotification) => (
                <div key={n.id} className="relative pl-12 group animate-fade-in">
                  <div className="absolute left-0 top-6 w-10 h-10 bg-white border-4 border-gray-50 rounded-2xl flex items-center justify-center text-gray-300 group-hover:border-red-100 group-hover:text-red-500 transition-all z-10 shadow-sm">
                    <AlertCircle size={20} />
                  </div>
                  
                  <div className="p-6 bg-white border-2 border-gray-100 rounded-3xl hover:border-red-200 transition-all shadow-sm hover:shadow-xl hover:shadow-red-500/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl">
                          <Calendar size={14} className="text-gray-400" />
                          <span className="text-xs font-black text-gray-600 uppercase">{new Date(n.date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl">
                          <Clock size={14} className="text-gray-400" />
                          <span className="text-xs font-black text-gray-600 uppercase">{n.time}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditNotification(n)}
                          className="p-3 text-blue-500 bg-blue-50 hover:bg-blue-500 hover:text-white rounded-2xl transition-all shadow-sm"
                          title="Editar Registro"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(n.id)}
                          className="p-3 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm"
                          title="Excluir Registro"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest px-1">Categorias e Classificações</p>
                        <div className="space-y-4">
                          {n.notification_type_ids?.map(id => {
                            const type = notificationTypes.find(t => t.id === id);
                            if (!type) return null;
                            const relatedSubtypes = n.selected_subtypes?.filter(s => type.subtypes?.includes(s)) || [];
                            return (
                              <div key={id} className="flex flex-wrap items-center gap-2">
                                <span className="px-4 py-2 text-xs font-black rounded-xl uppercase tracking-tight shadow-sm" style={{ backgroundColor: type.color, color: 'white' }}>
                                  {type.name}
                                </span>
                                {relatedSubtypes.map(sub => (
                                  <span key={sub} className="px-3 py-1.5 bg-gray-50 text-gray-500 text-[10px] font-black rounded-lg uppercase tracking-tight border border-gray-100">
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {n.justification && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest px-1">Justificativa / Descrição</p>
                          <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 relative">
                            <Quote size={20} className="absolute -top-3 -right-3 text-red-100 rotate-180" />
                            <p className="text-sm text-gray-700 leading-relaxed font-bold italic">
                              "{n.justification}"
                            </p>
                          </div>
                        </div>
                      )}

                      {n.teacher_referral && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl border border-red-100 border-dashed">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-sm">
                            <UserPlus size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Encaminhamento</p>
                            <p className="text-sm font-black text-red-700">Prof. {n.teacher_name}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Config Modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Configurar Tipos de Ocorrência"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-6">
          <form onSubmit={handleSaveType} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase ml-2">Nome do Tipo</label>
                <input
                  type="text"
                  placeholder="Ex: Farda, Celular, Atraso..."
                  value={selectedType?.name || ''}
                  onChange={e => setSelectedType({ ...selectedType, name: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-red-500 outline-none font-bold shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase ml-2">Cor</label>
                <input
                  type="color"
                  value={selectedType?.color || '#ff0000'}
                  onChange={e => setSelectedType({ ...selectedType, color: e.target.value })}
                  className="w-full h-11 bg-white border border-gray-200 rounded-xl px-1 py-1 cursor-pointer shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-gray-400 uppercase ml-2 flex items-center gap-2">
                Subtipos (Classificação)
                <span className="text-[10px] normal-case text-gray-300">Defina os detalhes para este tipo</span>
              </label>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Novo subtipo (ex: Camisa, Calça, Em sala...)"
                    value={newSubtype}
                    onChange={e => setNewSubtype(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSubtype(e)}
                    className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-red-500 outline-none font-bold shadow-sm pr-12"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-[10px] font-bold text-gray-300 uppercase">Enter</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddSubtype}
                  className="bg-gray-800 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-black transition-all shadow-lg active:scale-95"
                  title="Adicionar Subtipo"
                >
                  <Plus size={24} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 p-6 bg-gray-50 border-2 border-gray-100 rounded-2xl min-h-[80px] transition-all">
                {selectedType?.subtypes?.map(sub => (
                  <span key={sub} className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 shadow-sm animate-scale-in">
                    {sub}
                    <button
                      type="button"
                      onClick={() => setSelectedType({ ...selectedType, subtypes: selectedType.subtypes?.filter(s => s !== sub) })}
                      className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500 hover:text-white transition-all text-gray-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {(!selectedType?.subtypes || selectedType.subtypes.length === 0) && (
                  <div className="w-full h-full flex items-center justify-center py-4">
                    <p className="text-gray-300 text-xs font-bold italic">Nenhum subtipo adicionado ainda.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-red-100 text-lg"
              >
                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                Salvar Categoria e Subtipos
              </button>
              {selectedType?.id && (
                <button
                  type="button"
                  onClick={() => setSelectedType(null)}
                  className="flex-1 py-4 bg-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-300 transition-all text-lg"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Categorias Ativas</h4>
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-lg uppercase">{notificationTypes.length} Categorias</span>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {notificationTypes.map(type => (
                <div key={type.id} className="p-5 bg-white border-2 border-gray-100 rounded-3xl flex items-center justify-between group hover:border-red-200 hover:shadow-md transition-all">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg transform group-hover:scale-105 transition-all" style={{ backgroundColor: type.color }}>
                      {type.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h5 className="font-black text-gray-800 text-lg">{type.name}</h5>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {type.subtypes?.map(s => (
                          <span key={s} className="text-[10px] font-black text-gray-500 bg-gray-100 px-2 py-1 rounded-lg uppercase tracking-tight">
                            {s}
                          </span>
                        ))}
                        {(!type.subtypes || type.subtypes.length === 0) && (
                          <span className="text-[10px] font-bold text-gray-300 italic">Sem subtipos definidos</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                    <button
                      onClick={() => setSelectedType(type)}
                      className="p-3 text-blue-500 bg-blue-50 hover:bg-blue-500 hover:text-white rounded-2xl transition-all shadow-sm"
                      title="Editar"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteType(type.id)}
                      className="p-3 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {notificationTypes.length === 0 && (
                <div className="p-16 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                  <Settings size={48} className="mx-auto text-gray-200 mb-4 animate-pulse" />
                  <p className="text-gray-400 font-bold italic">Nenhuma categoria configurada ainda.</p>
                  <p className="text-xs text-gray-300 mt-2">Use o formulário acima para criar a primeira.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
