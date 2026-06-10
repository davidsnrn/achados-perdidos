import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Filter, Download, Trash2, Calendar, Clock, User as UserIcon, BookOpen, AlertCircle, CheckCircle2, MoreVertical, ShieldAlert, FileText, UserPlus, ClipboardList, Printer, Settings, Loader2, Pencil, MessageSquare, ChevronDown, ChevronUp, ChevronRight, Eye, List, X } from 'lucide-react';
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
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteJustification, setDeleteJustification] = useState('');
  const [newSubtype, setNewSubtype] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'off' | 'single' | 'range'>('off');
  const [filterDate, setFilterDate] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  type SortColumn = 'name' | 'class' | 'total' | 'lastDate';
  const [sortColumn, setSortColumn] = useState<SortColumn>('lastDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
    let filtered = notifications.filter(n => 
      n.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.student_matricula.includes(searchTerm) ||
      (n.class_name && n.class_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (dateFilterMode === 'single' && filterDate) {
      filtered = filtered.filter(n => n.date === filterDate);
    } else if (dateFilterMode === 'range' && filterDateStart && filterDateEnd) {
      filtered = filtered.filter(n => n.date >= filterDateStart && n.date <= filterDateEnd);
    }

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

    return Object.values(groups).sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      switch (sortColumn) {
        case 'name':
          return dir * a.student_name.localeCompare(b.student_name);
        case 'class':
          return dir * (a.class_name || '').localeCompare(b.class_name || '');
        case 'total':
          return dir * (a.items.length - b.items.length);
        case 'lastDate': {
          const aMax = Math.max(...a.items.map(i => new Date(i.date + 'T' + (i.time || '00:00')).getTime()));
          const bMax = Math.max(...b.items.map(i => new Date(i.date + 'T' + (i.time || '00:00')).getTime()));
          return dir * (aMax - bMax);
        }
        default:
          return 0;
      }
    });
  }, [notifications, searchTerm, dateFilterMode, filterDate, filterDateStart, filterDateEnd, sortColumn, sortDirection]);

  useEffect(() => {
    if (selectedStudent) {
      const updated = notifications.filter(n => n.student_matricula === selectedStudent.student_matricula);
      if (updated.length > 0) {
        setSelectedStudent({
          student_name: updated[0].student_name,
          student_matricula: updated[0].student_matricula,
          class_name: updated[0].class_name || '-',
          items: updated
        });
      }
    }
  }, [notifications]);

  const toggleSelectGroup = (items: StudentNotification[]) => {
    const ids = items.map(i => i.id);
    const allSelected = ids.every(id => selectedNotificationIds.includes(id));
    if (allSelected) {
      setSelectedNotificationIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedNotificationIds(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const toggleSelectNotification = (id: string) => {
    setSelectedNotificationIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleExpandGroup = (matricula: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(matricula)) next.delete(matricula);
      else next.add(matricula);
      return next;
    });
  };

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
      const payload: any = {
        ...formData,
        campus_id: adminGlobalCampusId || user.campus_id || '',
        operator_id: formData.id ? formData.operator_id : user.id,
        operator_name: formData.id ? formData.operator_name : user.name,
        operator_matricula: formData.id ? formData.operator_matricula : user.matricula,
      };

      if (formData.id) {
        payload.updated_by = user.id;
        payload.updated_by_name = user.name;
        payload.updated_by_matricula = user.matricula;
        payload.updated_at = new Date().toISOString();
      }

      await StorageService.saveNotification(payload);
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

  const isAdmin = user.level === UserLevel.ADMIN;

  const openDeleteModal = (id: string) => {
    if (isAdmin) {
      if (!confirm("Excluir permanentemente esta notificação?")) return;
      handleForceDelete(id);
      return;
    }
    setDeleteTargetId(id);
    setDeleteJustification('');
    setIsDeleteModalOpen(true);
  };

  const handleForceDelete = async (id: string) => {
    try {
      await StorageService.forceDeleteNotification(id);
      onUpdate();
    } catch (error) {
      console.error("Erro ao excluir notificação:", error);
      alert("Erro ao excluir.");
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteTargetId || !deleteJustification.trim()) {
      alert("Informe a justificativa para a exclusão.");
      return;
    }

    try {
      await StorageService.softDeleteNotification(
        deleteTargetId,
        user.id,
        user.name,
        user.matricula,
        deleteJustification.trim()
      );
      onUpdate();
      setIsDeleteModalOpen(false);
      setDeleteTargetId(null);
      setDeleteJustification('');
    } catch (error) {
      console.error("Erro ao excluir notificação:", error);
      alert("Erro ao excluir.");
    }
  };

  const handleCancelDelete = async (id: string) => {
    if (!confirm("Cancelar a exclusão desta notificação?")) return;

    try {
      await StorageService.cancelDeleteNotification(id);
      onUpdate();
    } catch (error) {
      console.error("Erro ao cancelar exclusão:", error);
      alert("Erro ao cancelar exclusão.");
    }
  };

  const fmtDate = (d: string) => {
    if (!d) return '-';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const getCampusName = (campusId?: string) => {
    if (!campusId) return 'Não informado';
    const campus = campuses.find(c => c.id === campusId);
    return campus?.name || campusId;
  };

  const operatorDisplay = (name?: string, matricula?: string) => {
    if (!name && !matricula) return 'Não informado';
    if (name && matricula) return `${name} (${matricula})`;
    return name || matricula || 'Não informado';
  };

  const fmtDateTime = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const handlePrintNotification = (n: StudentNotification) => {
    // Usa iframe oculto para evitar bloqueio de popup
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    document.body.appendChild(iframe);
    const printWindow = (iframe.contentWindow || iframe.contentDocument) as Window;

    const activeCampusId = adminGlobalCampusId || user.campus_id || '';
    const campusName = campuses.find(c => c.id === activeCampusId)?.name || '';

    const types = n.notification_type_ids?.map(id => {
      const t = notificationTypes.find(tp => tp.id === id);
      return { id: t?.id, name: t?.name || '', color: t?.color || '#309B41' };
    }).filter(t => t.name) || [];

    const subtypes = n.selected_subtypes?.join(', ') || '';

    const verificationCode = n.id ? n.id.replace(/-/g, '').slice(0, 12).toUpperCase() : '';
    const verificationUrl = n.id ? `https://sigae-ifrn.vercel.app/verificar.html?id=${n.id}` : '';

    const ifrnLogoSvg = `
      <svg viewBox="0 0 110 150" style="width:48px;height:48px;flex-shrink:0" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#CB161D" />
        <rect x="38" y="0" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="76" y="0" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="0" y="38" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="38" y="38" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="0" y="76" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="38" y="76" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="76" y="76" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="0" y="114" width="32" height="32" rx="6" fill="#78BE20" />
        <rect x="38" y="114" width="32" height="32" rx="6" fill="#78BE20" />
      </svg>
    `;

    const tagHtml = (name: string, color: string) => `
      <span style="display:inline-block;padding:6px 18px;border-radius:100px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;background:${color};color:#fff">${name}</span>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprovante de Comparecimento - COADESC</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', -apple-system, sans-serif; padding: 48px 56px; color: #1e293b; background: #fff; }
          .topo { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
          .topo-left { display: flex; align-items: center; gap: 14px; }
          .ifrn-text { font-size: 22px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px; line-height: 1.1; }
          .ifrn-sub { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; }
          .emitido { font-size: 11px; font-weight: 500; color: #94a3b8; }
          .emitido strong { color: #475569; font-weight: 600; }
          .title-block { text-align: center; margin-bottom: 40px; }
          .title-block h1 { font-size: 22px; font-weight: 900; color: #1e3a5f; letter-spacing: 1px; }
          .title-block .sep { width: 60px; height: 2px; background: #e2e8f0; margin: 12px auto 0; border-radius: 2px; }
          .card { border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px 32px; margin-bottom: 28px; }
          .card-header { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; }
          .student-name { font-size: 24px; font-weight: 800; color: #1e293b; margin-bottom: 12px; }
          .matricula-tag { display: inline-block; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 700; padding: 4px 14px; border-radius: 8px; letter-spacing: 0.5px; margin-bottom: 16px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .grid-2 .label { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
          .grid-2 .value { font-size: 15px; font-weight: 700; color: #1e293b; }
          .ts-row { display: flex; align-items: center; gap: 24px; margin-bottom: 20px; }
          .ts-row .ts-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; font-weight: 500; }
          .ts-row .ts-item svg { width: 16px; height: 16px; flex-shrink: 0; }
          .tags-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
          .tag-subtle { display:inline-block;padding:4px 14px;border-radius:100px;font-size:12px;font-weight:700;color:#94a3b8;background:#f1f5f9;border:1px solid #e2e8f0; }

          .decl-text { font-size: 14px; line-height: 1.9; color: #475569; }
          .decl-text strong { color: #1e293b; font-weight: 700; }
          .just-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px 24px; }
          .just-box p { font-size: 14px; line-height: 1.8; color: #475569; margin: 0; }
          .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
          .footer-content { display: flex; align-items: center; justify-content: space-between; }
          .footer-left p { font-size: 11px; color: #cbd5e1; font-weight: 500; margin-bottom: 4px; }
          .footer-left p:last-child { margin-bottom: 0; }
          .verify-box { text-align: right; }
          .verify-box img { width: 72px; height: 72px; display: block; margin: 0 0 4px auto; }
          .verify-code { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 1px; }
          @media print {
            body { padding: 32px 40px; }
            .matricula-tag, .tag-subtle { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .just-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          @page { size: A4; margin: 0; }
        </style>
      </head>
      <body>
        <div class="topo">
          <div class="topo-left">
            ${ifrnLogoSvg}
            <div>
              <div class="ifrn-text">IFRN</div>
              <div class="ifrn-sub">${campusName}</div>
            </div>
          </div>
          <div class="emitido">Registrado por: <strong>${operatorDisplay(n.operator_name, n.operator_matricula) || 'Sistema'}</strong></div>
        </div>

        <div class="title-block">
          <h1>REGISTRO DE OCORRÊNCIA</h1>
          <div class="sep"></div>
        </div>

        <div class="card">
          <div class="card-header">Dados do Aluno</div>
          <div class="student-name">${n.student_name}</div>
          <div class="matricula-tag">Matricula: ${n.student_matricula}</div>
          <div class="grid-2">
            <div>
              <div class="label">Turma</div>
              <div class="value">${n.class_name}</div>
            </div>
            <div>
              <div class="label">Periodo</div>
              <div class="value">${n.period}</div>
            </div>
          </div>
        </div>

          <div class="card">
          <div class="card-header">Detalhes da Ocorrencia</div>
          <div class="ts-row">
            <span class="ts-item">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${fmtDate(n.date)}
            </span>
            <span class="ts-item">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${n.time}
            </span>
          </div>
          <div class="tags-row">
            ${types.map(t => tagHtml(t.name, t.color)).join('')}
            ${subtypes ? subtypes.split(', ').map(s => `<span class="tag-subtle">${s}</span>`).join('') : ''}
          </div>
          <div style="margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;display:flex;gap:24px;">
            <span>Registrado por: <strong style="color:#475569">${operatorDisplay(n.operator_name, n.operator_matricula)}</strong></span>
            ${n.updated_by_name ? `<span>Ultima atualizacao por: <strong style="color:#475569">${operatorDisplay(n.updated_by_name, n.updated_by_matricula)}</strong></span>` : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header">Declaracao</div>
          <p class="decl-text">Declaramos para os devidos fins que o(a) estudante acima identificado(a) <strong>compareceu a COADESC</strong> para tratar e justificar a ocorrencia listada neste documento.</p>
        </div>

        <div class="footer">
          <div class="footer-content">
            <div class="footer-left">
              <p>Documento gerado em ${new Date().toLocaleString('pt-BR')}</p>
              <p>Codigo de verificacao: ${verificationCode}</p>
            </div>
            <div class="verify-box">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}" alt="QR Code" />
              <div class="verify-code">${verificationCode}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();

    // Foca e imprime automaticamente
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Remove o iframe apos a impressao
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  const handlePrintMultiple = () => {
    const selected = notifications.filter(n => selectedNotificationIds.includes(n.id));
    if (selected.length === 0) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    document.body.appendChild(iframe);
    const printWindow = (iframe.contentWindow || iframe.contentDocument) as Window;

    const activeCampusId = adminGlobalCampusId || user.campus_id || '';
    const campusName = campuses.find(c => c.id === activeCampusId)?.name || '';
    const operatorName = user.name;

    const fmtDate2 = (d: string) => {
      const date = new Date(d + 'T12:00:00');
      return date.toLocaleDateString('pt-BR');
    };

    const notificationCards = selected.map((n, idx) => {
      const types = n.notification_type_ids?.map(id => {
        const t = notificationTypes.find(tp => tp.id === id);
        return { name: t?.name || '', color: t?.color || '#309B41' };
      }).filter(t => t.name) || [];

      const subtypes = n.selected_subtypes?.join(', ') || '';
      const verificationCode = n.id ? n.id.replace(/-/g, '').slice(0, 8).toUpperCase() : '';
      const verificationUrl = n.id ? `https://sigae-ifrn.vercel.app/verificar.html?id=${n.id}` : '';

      const tagsHtml = types.map(t =>
        `<span class="tag" style="background:${t.color}">${t.name}</span>`
      ).join('') +
      (subtypes ? subtypes.split(', ').map(s =>
        `<span class="tag-sub">${s}</span>`
      ).join('') : '');

      const justHtml = n.justification
        ? `<div class="just">"${n.justification}"</div>`
        : '';

      const teacherHtml = n.teacher_referral && n.teacher_name
        ? `<div class="teacher">Encaminhado: Prof. ${n.teacher_name}</div>`
        : '';

      const cutLine = (idx + 1) % 2 === 0 && idx < selected.length - 1
        ? '<div class="cut-row"></div>'
        : '';

      const pageBreak = (idx + 1) % 4 === 0 && idx < selected.length - 1
        ? '<div class="page-break"></div>'
        : '';

      return `
        <div class="card-wrap">
          <div class="card">
            <div class="card-topo">
              <div class="card-title">REGISTRO DE OCORRÊNCIA</div>
              <div class="card-campus">${campusName}</div>
            </div>
            <div class="card-body">
              <div class="card-body-left">
                <div class="card-student">
                  <span class="student-name">${n.student_name}</span>
                  <span class="student-mat">${n.student_matricula}</span>
                </div>
                <div class="card-class">
                  ${n.class_name || ''}${n.period ? ' - ' + n.period : ''}
                </div>
                <div class="card-dt">${fmtDate2(n.date)} às ${n.time}</div>
                <div class="tags-row">${tagsHtml}</div>
                ${justHtml}
                ${teacherHtml}
                <div class="card-operator">Registrado por: ${operatorDisplay(n.operator_name, n.operator_matricula)}${n.updated_by_name ? ' | Editado por: ' + operatorDisplay(n.updated_by_name, n.updated_by_matricula) : ''}</div>
              </div>
              <div class="card-body-right">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(verificationUrl)}" alt="QR" class="card-qr" />
                <span class="card-code">${verificationCode}</span>
              </div>
            </div>
            <div class="card-footer">
              <span class="card-verify">Acesse <strong>sigae-ifrn.vercel.app/verificar.html</strong></span>
            </div>
          </div>
          ${cutLine}
          ${pageBreak}
        </div>`;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Registros de Ocorrência</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
          .card-wrap { }
          .card { border: 1px solid #d1d5db; padding: 10px 12px; height: 100%; display: flex; flex-direction: column; }
          .card-topo { text-align: center; margin-bottom: 6px; }
          .card-title { font-size: 10px; font-weight: 900; color: #1e3a5f; letter-spacing: 0.5px; text-transform: uppercase; }
          .card-campus { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
          .card-body { flex: 1; display: flex; gap: 8px; }
          .card-body-left { flex: 1; min-width: 0; }
          .card-body-right { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; flex-shrink: 0; }
          .card-student { margin-bottom: 3px; }
          .student-name { font-size: 11px; font-weight: 800; color: #1e293b; }
          .student-mat { font-size: 9px; font-weight: 600; color: #64748b; margin-left: 6px; }
          .card-class { font-size: 9px; font-weight: 600; color: #475569; margin-bottom: 2px; }
          .card-dt { font-size: 9px; font-weight: 500; color: #64748b; margin-bottom: 4px; }
          .tags-row { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 3px; }
          .tag { display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 8px; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 0.3px; }
          .tag-sub { display: inline-block; padding: 1px 6px; border-radius: 100px; font-size: 7px; font-weight: 700; color: #94a3b8; background: #f1f5f9; border: 1px solid #e2e8f0; }
          .just { font-size: 8px; font-weight: 500; color: #475569; font-style: italic; background: #f8fafc; padding: 4px 6px; border-radius: 6px; margin-bottom: 2px; line-height: 1.3; }
          .teacher { font-size: 8px; font-weight: 700; color: #dc2626; margin-bottom: 2px; }
          .card-operator { font-size: 6.5px; font-weight: 600; color: #94a3b8; margin-top: 3px; }
          .card-qr { width: 52px; height: 52px; flex-shrink: 0; border-radius: 4px; }
          .card-code { font-size: 7px; font-weight: 900; color: #1e293b; letter-spacing: 1px; text-align: center; }
          .card-footer { margin-top: 3px; padding-top: 3px; border-top: 1px solid #e5e7eb; text-align: left; }
          .card-verify { font-size: 6.5px; font-weight: 500; color: #64748b; line-height: 1.2; }
          .card-verify strong { font-weight: 700; color: #2563eb; text-decoration: underline; }
          .cut-row { border-top: 1.5px dashed #94a3b8; margin: 0; height: 4px; }
          .page-break { page-break-after: always; }
          @media print {
            body { padding: 6mm; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
            .card { -webkit-print-color-adjust: exact; print-color-adjust: exact; border: 1px solid #d1d5db; }
            .tag { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .card-qr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          @page { size: A4; margin: 6mm; }
        </style>
      </head>
      <body>
        <div class="grid">
          ${notificationCards}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    }, 500);
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
      operator_id: n.operator_id,
      operator_name: n.operator_name,
      operator_matricula: n.operator_matricula
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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'name' || column === 'class' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ChevronDown size={12} className="opacity-0 group-hover:opacity-40 ml-1" />;
    return sortDirection === 'asc' ? <ChevronDown size={12} className="ml-1" /> : <ChevronUp size={12} className="ml-1" />;
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
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-4">
        <div className="relative flex-[2]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, matrícula ou turma..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border-2 border-transparent focus:border-red-500 focus:bg-white rounded-2xl pl-12 pr-4 py-3.5 outline-none transition-all font-medium"
          />
        </div>

        <div className="flex items-stretch gap-2 bg-gray-50 rounded-2xl p-1 border-2 border-transparent has-[.active]:border-red-200">
          <button
            onClick={() => { setDateFilterMode('off'); setFilterDate(''); setFilterDateStart(''); setFilterDateEnd(''); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${dateFilterMode === 'off' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Todas
          </button>
          <button
            onClick={() => { setDateFilterMode('single'); setFilterDateStart(''); setFilterDateEnd(''); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${dateFilterMode === 'single' ? 'bg-white text-red-600 shadow-sm active' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Calendar size={14} className="inline mr-1.5 -mt-0.5" />
            Data
          </button>
          <button
            onClick={() => { setDateFilterMode('range'); setFilterDate(''); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${dateFilterMode === 'range' ? 'bg-white text-red-600 shadow-sm active' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Calendar size={14} className="inline mr-1.5 -mt-0.5" />
            Período
          </button>
        </div>

        {dateFilterMode === 'single' && (
          <div className="flex items-center gap-2 animate-fade-in">
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="bg-gray-50 border-2 border-gray-100 focus:border-red-500 rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Limpar data"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {dateFilterMode === 'range' && (
          <div className="flex items-center gap-2 animate-fade-in">
            <input
              type="date"
              value={filterDateStart}
              onChange={e => setFilterDateStart(e.target.value)}
              className="bg-gray-50 border-2 border-gray-100 focus:border-red-500 rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all"
            />
            <span className="text-xs font-bold text-gray-400">até</span>
            <input
              type="date"
              value={filterDateEnd}
              onChange={e => setFilterDateEnd(e.target.value)}
              className="bg-gray-50 border-2 border-gray-100 focus:border-red-500 rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all"
            />
            {(filterDateStart || filterDateEnd) && (
              <button
                onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Limpar período"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {selectedNotificationIds.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-200 rounded-2xl animate-fade-in">
          <span className="text-sm font-bold text-red-700">
            {selectedNotificationIds.length} notificação(ões) selecionada(s)
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setSelectedNotificationIds([])}
            className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
          >
            Limpar
          </button>
          <button
            onClick={handlePrintMultiple}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95"
          >
            <Printer size={16} />
            Imprimir Selecionados
          </button>
        </div>
      )}

      {/* Grouped Notifications Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-2 py-5 w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                    checked={groupedNotifications.length > 0 && groupedNotifications.every(g => g.items.every(i => selectedNotificationIds.includes(i.id)))}
                    onChange={() => {
                      const allIds = groupedNotifications.flatMap(g => g.items.map(i => i.id));
                      const allSelected = allIds.every(id => selectedNotificationIds.includes(id));
                      if (allSelected) {
                        setSelectedNotificationIds(prev => prev.filter(id => !allIds.includes(id)));
                      } else {
                        setSelectedNotificationIds(prev => [...new Set([...prev, ...allIds])]);
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer select-none group" onClick={() => handleSort('name')}>
                  <span className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                    Aluno <SortIcon column="name" />
                  </span>
                </th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer select-none group" onClick={() => handleSort('class')}>
                  <span className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                    Turma / Período <SortIcon column="class" />
                  </span>
                </th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-center cursor-pointer select-none group" onClick={() => handleSort('total')}>
                  <span className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors">
                    Total Ocorrências <SortIcon column="total" />
                  </span>
                </th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-center cursor-pointer select-none group" onClick={() => handleSort('lastDate')}>
                  <span className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors">
                    Última Ocorrência <SortIcon column="lastDate" />
                  </span>
                </th>
                <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groupedNotifications.length > 0 ? (
                groupedNotifications.map((group) => (
                  <React.Fragment key={group.student_matricula}>
                    <tr className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-2 py-5">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                          checked={group.items.every(i => selectedNotificationIds.includes(i.id))}
                          onChange={() => toggleSelectGroup(group.items)}
                        />
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleExpandGroup(group.student_matricula)}
                            className="text-gray-400 hover:text-gray-700 transition-colors p-0.5"
                          >
                            {expandedGroups.has(group.student_matricula) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-800">{group.student_name}</span>
                            <span className="text-xs text-gray-400 font-mono">{group.student_matricula}</span>
                          </div>
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
                      <td className="px-6 py-5 text-center">
                        <span className="text-xs font-bold text-gray-500">
                          {fmtDate(group.items[0].date)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedStudent(group);
                              setIsStudentDetailOpen(true);
                            }}
                            className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Ver Detalhes"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedGroups.has(group.student_matricula) && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="space-y-2">
                            {group.items.map((n: StudentNotification) => {
                              const types = n.notification_type_ids?.map(id => {
                                const t = notificationTypes.find(tp => tp.id === id);
                                return { name: t?.name || '', color: t?.color || '#309B41' };
                              }).filter(t => t.name) || [];
                              return (
                                <div key={n.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${n.deleted_at ? 'bg-red-50/50 border-red-200 opacity-70' : 'bg-white border-gray-100 hover:border-red-200'}`}>
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                    checked={selectedNotificationIds.includes(n.id)}
                                    onChange={() => toggleSelectNotification(n.id)}
                                    disabled={!!n.deleted_at}
                                  />
                                  <div className="flex flex-col min-w-[180px]">
                                    <div className={`flex items-center gap-3 text-xs font-bold ${n.deleted_at ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                                      <Calendar size={12} className="text-gray-400" />
                                      {new Date(n.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                      <Clock size={12} className="text-gray-400 ml-1" />
                                      {n.time}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                                      <UserIcon size={10} className="text-gray-300" />
                                      <span>{operatorDisplay(n.operator_name, n.operator_matricula)}</span>
                                      {isAdmin && n.campus_id && (
                                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold">
                                          {getCampusName(n.campus_id)}
                                        </span>
                                      )}
                                      {n.updated_by_name && (
                                        <span className="ml-1 text-gray-300">
                                          · Editado por {operatorDisplay(n.updated_by_name, n.updated_by_matricula)}
                                        </span>
                                      )}
                                      {n.deleted_at && (
                                        <span className="ml-1 text-red-400 font-bold">
                                          · Excluído por {operatorDisplay(n.deleted_by_name, n.deleted_by_matricula)} em {fmtDateTime(n.deleted_at)}
                                        </span>
                                      )}
                                    </div>
                                    {n.deleted_at && n.deleted_justification && (
                                      <div className="text-[10px] text-red-300 italic mt-0.5">
                                        "{n.deleted_justification}"
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 flex-1">
                                    {types.map(t => (
                                      <span key={t.name} className={`px-2 py-0.5 text-[10px] font-bold text-white rounded-full ${n.deleted_at ? 'opacity-50' : ''}`} style={{ backgroundColor: t.color }}>
                                        {t.name}
                                      </span>
                                    ))}
                                  </div>
                                  {!n.deleted_at ? (
                                    <button
                                      onClick={() => handlePrintNotification(n)}
                                      className="p-1.5 text-green-500 bg-green-50 hover:bg-green-500 hover:text-white rounded-lg transition-all"
                                      title="Imprimir"
                                    >
                                      <Printer size={14} />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleCancelDelete(n.id)}
                                      className="p-1.5 text-amber-500 bg-amber-50 hover:bg-amber-500 hover:text-white rounded-lg transition-all"
                                      title="Cancelar Exclusão"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
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
                <div key={n.id} className={`relative pl-12 group animate-fade-in ${n.deleted_at ? 'opacity-60' : ''}`}>
                  <div className={`absolute left-0 top-6 w-10 h-10 border-4 rounded-2xl flex items-center justify-center transition-all z-10 shadow-sm ${n.deleted_at ? 'bg-red-50 border-red-100 text-red-300' : 'bg-white border-gray-50 text-gray-300 group-hover:border-red-100 group-hover:text-red-500'}`}>
                    <AlertCircle size={20} />
                  </div>
                  
                  <div className={`p-6 border-2 rounded-3xl transition-all shadow-sm ${n.deleted_at ? 'bg-red-50/30 border-red-200' : 'bg-white border-gray-100 hover:border-red-200 hover:shadow-xl hover:shadow-red-500/5'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${n.deleted_at ? 'bg-red-100' : 'bg-gray-50'}`}>
                          <Calendar size={14} className="text-gray-400" />
                          <span className={`text-xs font-black uppercase ${n.deleted_at ? 'text-red-400 line-through' : 'text-gray-600'}`}>{fmtDate(n.date)}</span>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${n.deleted_at ? 'bg-red-100' : 'bg-gray-50'}`}>
                          <Clock size={14} className="text-gray-400" />
                          <span className={`text-xs font-black uppercase ${n.deleted_at ? 'text-red-400 line-through' : 'text-gray-600'}`}>{n.time}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!n.deleted_at && (
                          <button
                            onClick={() => handlePrintNotification(n)}
                            className="p-3 text-green-500 bg-green-50 hover:bg-green-500 hover:text-white rounded-2xl transition-all shadow-sm"
                            title="Imprimir Comprovante"
                          >
                            <Printer size={18} />
                          </button>
                        )}
                        {!n.deleted_at && (
                          <button
                            onClick={() => handleEditNotification(n)}
                            className="p-3 text-blue-500 bg-blue-50 hover:bg-blue-500 hover:text-white rounded-2xl transition-all shadow-sm"
                            title="Editar Registro"
                          >
                            <Pencil size={18} />
                          </button>
                        )}
                        {!n.deleted_at ? (
                          <button
                            onClick={() => openDeleteModal(n.id)}
                            className="p-3 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm"
                            title="Excluir Registro"
                          >
                            <Trash2 size={18} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCancelDelete(n.id)}
                            className="p-3 text-amber-500 bg-amber-50 hover:bg-amber-500 hover:text-white rounded-2xl transition-all shadow-sm"
                            title="Cancelar Exclusão"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className={`flex flex-wrap items-center gap-4 text-xs px-4 py-2 rounded-xl ${n.deleted_at ? 'bg-red-100' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-1.5">
                          <UserIcon size={12} className="text-gray-300" />
                          <span className="font-bold text-gray-500">Registrado por:</span>
                          <span>{operatorDisplay(n.operator_name, n.operator_matricula)}</span>
                          {isAdmin && n.campus_id && (
                            <span className="ml-2 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold">
                              {getCampusName(n.campus_id)}
                            </span>
                          )}
                        </div>
                        {n.updated_by_name && (
                          <div className="flex items-center gap-1.5">
                            <Pencil size={12} className="text-gray-300" />
                            <span className="font-bold text-gray-500">Última atualização por:</span>
                            <span>{operatorDisplay(n.updated_by_name, n.updated_by_matricula)}</span>
                            {n.updated_at && (
                              <span className="text-gray-300">
                                · {new Date(n.updated_at).toLocaleString('pt-BR')}
                              </span>
                            )}
                          </div>
                        )}
                        {n.deleted_at && (
                          <div className="flex items-center gap-1.5 text-red-500 font-bold">
                            <Trash2 size={12} />
                            <span>Excluído por {operatorDisplay(n.deleted_by_name, n.deleted_by_matricula)} em {fmtDateTime(n.deleted_at)}</span>
                          </div>
                        )}
                      </div>

                      {n.deleted_at && n.deleted_justification && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest px-1">Motivo da Exclusão</p>
                          <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                            <p className="text-sm text-red-700 leading-relaxed font-bold italic">
                              "{n.deleted_justification}"
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest px-1">Categorias e Classificações</p>
                        <div className="space-y-4">
                          {n.notification_type_ids?.map(id => {
                            const type = notificationTypes.find(t => t.id === id);
                            if (!type) return null;
                            const relatedSubtypes = n.selected_subtypes?.filter(s => type.subtypes?.includes(s)) || [];
                            return (
                              <div key={id} className="flex flex-wrap items-center gap-2">
                                <span className={`px-4 py-2 text-xs font-black rounded-xl uppercase tracking-tight shadow-sm ${n.deleted_at ? 'opacity-50 line-through' : ''}`} style={{ backgroundColor: type.color, color: 'white' }}>
                                  {type.name}
                                </span>
                                {relatedSubtypes.map(sub => (
                                  <span key={sub} className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-tight border ${n.deleted_at ? 'bg-red-50 text-red-300 line-through border-red-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
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
                          <div className={`p-5 rounded-2xl border relative ${n.deleted_at ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                            <MessageSquare size={20} className={`absolute -top-3 -right-3 rotate-180 ${n.deleted_at ? 'text-red-200' : 'text-red-100'}`} />
                            <p className={`text-sm leading-relaxed font-bold italic ${n.deleted_at ? 'text-red-400 line-through' : 'text-gray-700'}`}>
                              "{n.justification}"
                            </p>
                          </div>
                        </div>
                      )}

                      {n.teacher_referral && (
                        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${n.deleted_at ? 'bg-red-50 border-red-100 border-dashed opacity-60' : 'bg-red-50 border-red-100 border-dashed'}`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${n.deleted_at ? 'bg-red-100 text-red-300' : 'bg-white text-red-500'}`}>
                            <UserPlus size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Encaminhamento</p>
                            <p className={`text-sm font-black ${n.deleted_at ? 'text-red-400 line-through' : 'text-red-700'}`}>Prof. {n.teacher_name}</p>
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteTargetId(null);
          setDeleteJustification('');
        }}
        title="Excluir Notificação"
        maxWidth="max-w-md"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-red-50 rounded-2xl border border-red-100">
            <Trash2 size={24} className="text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700">Tem certeza que deseja excluir esta notificação?</p>
              <p className="text-xs text-red-500 mt-1">A exclusão será definitiva após 24 horas. Você pode cancelar dentro deste período.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase ml-2">
              Justificativa para a exclusão <span className="text-red-500">*</span>
            </label>
            <textarea
              value={deleteJustification}
              onChange={e => setDeleteJustification(e.target.value)}
              placeholder="Descreva o motivo da exclusão..."
              className="w-full bg-gray-50 border-2 border-gray-100 focus:border-red-500 focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-medium resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteTargetId(null);
                setDeleteJustification('');
              }}
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSoftDelete}
              disabled={!deleteJustification.trim()}
              className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={18} />
              Confirmar Exclusão
            </button>
          </div>
        </div>
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
