import React, { useState, useMemo, useEffect } from 'react';
import { CopyRecord, CopyConfig, User, Campus, UserLevel, PersonType, Person, Setor } from '../../types';
import { StorageService } from '../../services/storage';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Settings,
  Printer,
  FileText,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  CheckCircle2,
  User as UserIcon,
  Building2,
  Table as TableIcon,
  PieChart,
  Save,
  Eye,
  Info,
  FileDown,
  Pencil
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface CopyControlTabProps {
  records: CopyRecord[];
  config?: CopyConfig;
  user: User | null;
  campuses: Campus[];
  adminGlobalCampusId: string | null;
  setores: Setor[];
  adminGlobalSetorId?: string | null;
  onUpdate: () => Promise<void>;
}

export const CopyControlTab: React.FC<CopyControlTabProps> = ({
  records,
  config,
  user,
  campuses,
  adminGlobalCampusId,
  setores,
  adminGlobalSetorId,
  onUpdate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<CopyRecord[] | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportRange, setReportRange] = useState({
    startMonth: new Date().getMonth(),
    startYear: new Date().getFullYear(),
    endMonth: new Date().getMonth(),
    endYear: new Date().getFullYear()
  });
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PROVA' | 'OUTRAS' | 'SERVIDOR' | 'ALUNO'>('ALL');

  // Period Logic
  const startDayConfig = config?.start_day || 13;
  const { initialMonth, initialYear, isAccountingDiff } = useMemo(() => {
    const today = new Date();
    let month = today.getMonth();
    let year = today.getFullYear();
    let diff = false;

    if (today.getDate() < startDayConfig) {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      diff = true;
    }
    return { initialMonth: month, initialYear: year, isAccountingDiff: diff };
  }, [startDayConfig]);

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Re-sync on first mount or when config loads if not manually changed
  React.useEffect(() => {
    if (!hasInitialized) {
      setSelectedMonth(initialMonth);
      setSelectedYear(initialYear);
      setHasInitialized(true);
    }
  }, [initialMonth, initialYear, hasInitialized]);

  // New Record Form State
  const [newRecord, setNewRecord] = useState<Partial<CopyRecord>>({
    print_type: 'OUTRAS',
    quantity: 1,
    date: new Date().toISOString()
  });
  const [editingRecord, setEditingRecord] = useState<CopyRecord | null>(null);
  const [personSearch, setPersonSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSetorId, setSelectedSetorId] = useState<string>(
    (user?.level === UserLevel.ADMIN ? adminGlobalSetorId : user?.setor_id) || ''
  );
  useEffect(() => {
    if (user?.level === UserLevel.ADMIN && adminGlobalSetorId !== undefined) {
      setSelectedSetorId(adminGlobalSetorId || '');
    }
  }, [adminGlobalSetorId, user?.level]);
  const isAdmin = user?.level === UserLevel.ADMIN;
  const activeSetorId = isAdmin ? selectedSetorId : user?.setor_id;

  // Calculate period dates
  const periodRange = useMemo(() => {
    const startDay = config?.start_day || 13;
    const endDay = config?.end_day || 12;
    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    const startDate = new Date(selectedYear, selectedMonth, Math.min(startDay, lastDayOfMonth), 0, 0, 0);
    const endDate = new Date(selectedYear, selectedMonth, Math.min(endDay, lastDayOfMonth), 23, 59, 59);

    return { start: startDate, end: endDate };
  }, [selectedMonth, selectedYear, config]);

  // Check if current selected period matches today's date
  const isPeriodForToday = useMemo(() => {
    const today = new Date();
    return today >= periodRange.start && today <= periodRange.end;
  }, [periodRange]);

  // Filter records by period and search term
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const recordDate = new Date(record.date);
      const isInPeriod = recordDate >= periodRange.start && recordDate <= periodRange.end;

      const matchesSearch = !appliedSearchTerm ||
        record.person_name.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
        record.person_matricula.includes(appliedSearchTerm) ||
        record.sector?.toLowerCase().includes(appliedSearchTerm.toLowerCase());

      const matchesFilter = activeFilter === 'ALL' ||
        (activeFilter === 'PROVA' && record.print_type === 'PROVA') ||
        (activeFilter === 'OUTRAS' && record.print_type === 'OUTRAS') ||
        (activeFilter === 'SERVIDOR' && record.person_type === PersonType.SERVER) ||
        (activeFilter === 'ALUNO' && record.person_type === PersonType.STUDENT);

      return isInPeriod && matchesSearch && matchesFilter;
    });
  }, [records, periodRange, appliedSearchTerm, activeFilter]);

  // Totals
  const totals = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => {
      if (curr.print_type === 'PROVA') acc.prova += curr.quantity;
      else acc.outras += curr.quantity;

      if (curr.person_type === PersonType.STUDENT) acc.aluno += curr.quantity;
      else if (curr.person_type === PersonType.SERVER) acc.servidor += curr.quantity;

      acc.total += curr.quantity;
      return acc;
    }, { prova: 0, outras: 0, aluno: 0, servidor: 0, total: 0 });
  }, [filteredRecords]);

  // Group records by person only for the main list
  const groupedRecords = useMemo(() => {
    const groups: { [key: string]: { records: CopyRecord[]; totalQuantity: number } } = {};

    filteredRecords.forEach(record => {
      const key = record.person_matricula;

      if (!groups[key]) {
        groups[key] = { records: [], totalQuantity: 0 };
      }
      groups[key].records.push(record);
      groups[key].totalQuantity += record.quantity;
    });

    // Within each group, sort records by date (descending)
    Object.values(groups).forEach(group => {
      group.records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return Object.values(groups).sort((a, b) =>
      new Date(b.records[0].date).getTime() - new Date(a.records[0].date).getTime()
    );
  }, [filteredRecords]);

  // Config State
  const [tempConfig, setTempConfig] = useState({
    start_day: config?.start_day || 13,
    end_day: config?.end_day || 12
  });

  const handleSaveConfig = async () => {
    if (!user?.campus_id && !adminGlobalCampusId) return;
    setIsSaving(true);
    try {
      await StorageService.saveCopyConfig({
        campus_id: adminGlobalCampusId || user!.campus_id!,
        setor_id: isAdmin ? adminGlobalSetorId : user.setor_id,
        start_day: tempConfig.start_day,
        end_day: tempConfig.end_day
      });
      await onUpdate();
      setIsConfigModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar configuração.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePersonSearch = async (val: string, isTriggered = false) => {
    setPersonSearch(val);
    if (isTriggered && val.length >= 2) {
      setIsSearchingPeople(true);
      try {
        const results = await StorageService.searchPeople(val, 5, adminGlobalCampusId || user?.campus_id || undefined);
        setSearchResults(results);
        setSelectedResultIndex(results.length > 0 ? 0 : -1);
      } catch (error) {
        console.error(error);
      } finally {
        setIsSearchingPeople(false);
      }
    } else {
      // Clear results when editing or search is too short
      setSearchResults([]);
      setSelectedResultIndex(-1);
    }
  };

  const handleSelectPerson = (p: Person) => {
    setSelectedPerson(p);
    setNewRecord(prev => ({
      ...prev,
      person_name: p.name,
      person_matricula: p.matricula
    }));
    setSearchResults([]);
    setPersonSearch('');
  };

  const handleSaveRecord = async () => {
    if (!newRecord.person_name || !newRecord.quantity) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    setIsSaving(true);
    try {
      await StorageService.saveCopyRecord({
        ...newRecord,
        id: editingRecord?.id,
        date: new Date(selectedDate + "T12:00:00").toISOString(),
        campus_id: adminGlobalCampusId || user!.campus_id!,
        setor_id: isAdmin ? adminGlobalSetorId : (selectedSetorId || undefined),
        operator_id: user!.id
      });
      await onUpdate();
      setIsModalOpen(false);
      setEditingRecord(null);
      setNewRecord({
        print_type: 'OUTRAS',
        quantity: 1,
        date: new Date().toISOString()
      });
      setSelectedPerson(null);
      setSelectedDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar registro.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async (id: string | string[]) => {
    const counts = Array.isArray(id) ? id.length : 1;
    if (!window.confirm(`Deseja realmente excluir este(s) ${counts} registro(s)?`)) return;
    try {
      if (Array.isArray(id)) {
        await Promise.all(id.map(i => StorageService.deleteCopyRecord(i)));
      } else {
        await StorageService.deleteCopyRecord(id);
      }
      await onUpdate();
      setIsDetailsModalOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert("Nenhum registro para exportar no período selecionado.");
      return;
    }

    // CSV Headers
    const headers = [
      "Data",
      "Nome",
      "Matricula",
      "Tipo",
      "Quantidade",
      "Setor"
    ];

    // CSV Rows
    const csvRows = filteredRecords.map(record => {
      const date = new Date(record.date);
      return [
        `"${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}"`,
        `"${record.person_name}"`,
        `"${record.person_matricula}"`,
        `"${record.print_type}"`,
        `"${record.quantity}"`,
        `"${record.sector || 'Sem Setor'}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(';'), ...csvRows.map(row => row.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `controle_copias_${selectedYear}_${selectedMonth + 1}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGeneratePDF = async () => {
    setIsSaving(true);
    try {
      const startDay = config?.start_day || 13;
      const endDay = config?.end_day || 12;

      const lastDayOfEndMonth = new Date(reportRange.endYear, reportRange.endMonth + 1, 0).getDate();
      const startDate = new Date(reportRange.startYear, reportRange.startMonth, startDay, 0, 0, 0);
      const endDate = new Date(reportRange.endYear, reportRange.endMonth, Math.min(endDay, lastDayOfEndMonth), 23, 59, 59);

      // 2. Fetch all records in range
      const campusId = adminGlobalCampusId || user?.campus_id;
      if (!campusId) return;

      const allRecords = await StorageService.getCopyRecords(
        campusId,
        activeSetorId || undefined,
        startDate.toISOString(),
        endDate.toISOString()
      );

      // Helper for consistent month key formatting
      const formatMonthKey = (month: number, pStart: Date, pEnd: Date) => {
        const mStr = (month + 1).toString().padStart(2, '0');
        const sDay = pStart.getDate().toString().padStart(2, '0');
        const sMonth = (pStart.getMonth() + 1).toString().padStart(2, '0');
        const eDay = pEnd.getDate().toString().padStart(2, '0');
        const eMonth = (pEnd.getMonth() + 1).toString().padStart(2, '0');

        return `${months[month].substring(0, 3).toUpperCase()} ${sDay}/${sMonth}-${eDay}/${eMonth}`;
      };

      // 3. Generate list of months in the range
      const monthPeriods: { month: number; year: number; start: Date; end: Date; key: string }[] = [];
      let currMonth = reportRange.startMonth;
      let currYear = reportRange.startYear;

      while (currYear < reportRange.endYear || (currYear === reportRange.endYear && currMonth <= reportRange.endMonth)) {
        const pStart = new Date(currYear, currMonth, startDay, 0, 0, 0);
        const pEnd = new Date(currYear, currMonth + 1, endDay, 23, 59, 59);

        monthPeriods.push({
          month: currMonth,
          year: currYear,
          start: pStart,
          end: pEnd,
          key: formatMonthKey(currMonth, pStart, pEnd)
        });

        currMonth++;
        if (currMonth > 11) {
          currMonth = 0;
          currYear++;
        }
      }

      // 4. Process data: Grouped by Server -> Sector
      const data: any = {};
      const grandTotals: Record<string, { prova: number; outras: number }> = {}; // monthKey -> totals

      allRecords.forEach(record => {
        const rDate = new Date(record.date);
        const period = monthPeriods.find(p => rDate >= p.start && rDate <= p.end);
        if (!period) return;

        const monthKey = period.key;
        if (!grandTotals[monthKey]) grandTotals[monthKey] = { prova: 0, outras: 0 };

        const sector = record.sector || 'SEM SETOR';
        const server = record.person_name;

        if (!data[server]) data[server] = {};
        if (!data[server][sector]) data[server][sector] = { months: {} };

        if (!data[server][sector].months[monthKey]) {
          data[server][sector].months[monthKey] = { prova: 0, outras: 0 };
        }

        if (record.print_type === 'PROVA') {
          data[server][sector].months[monthKey].prova += record.quantity;
          grandTotals[monthKey].prova += record.quantity;
        } else {
          data[server][sector].months[monthKey].outras += record.quantity;
          grandTotals[monthKey].outras += record.quantity;
        }
      });

      // 5. Generate PDF
      const doc = new jsPDF('l', 'mm', 'a4');
      const campusName = campuses.find(c => c.id === campusId)?.name || '';

      // IFRN Colors
      const IFRN_GREEN: [number, number, number] = [120, 190, 32];
      const IFRN_RED: [number, number, number] = [203, 22, 29];

      // Set elegant headers
      doc.setFillColor(IFRN_GREEN[0], IFRN_GREEN[1], IFRN_GREEN[2]);
      doc.rect(0, 0, 297, 40, 'F');

      // Draw IFRN Logo (top-aligned with title)
      const logoX = 14;
      const size = 2.2;
      const gap = 2.8;
      const logoY = 12; // Adjusted to align with line 18 title

      // Draw red circle (top-left)
      doc.setFillColor(IFRN_RED[0], IFRN_RED[1], IFRN_RED[2]);
      doc.circle(logoX + size / 2, logoY + size / 2, size / 2, 'F');

      // Draw squares (white on green background for visibility)
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(logoX + gap, logoY, size, size, 0.4, 0.4, 'F');
      doc.roundedRect(logoX + gap * 2, logoY, size, size, 0.4, 0.4, 'F');
      doc.roundedRect(logoX, logoY + gap, size, size, 0.4, 0.4, 'F');
      doc.roundedRect(logoX + gap, logoY + gap, size, size, 0.4, 0.4, 'F');
      doc.roundedRect(logoX, logoY + gap * 2, size, size, 0.4, 0.4, 'F');
      doc.roundedRect(logoX + gap, logoY + gap * 2, size, size, 0.4, 0.4, 'F');
      doc.roundedRect(logoX + gap * 2, logoY + gap * 2, size, size, 0.4, 0.4, 'F');
      doc.roundedRect(logoX, logoY + gap * 3, size, size, 0.4, 0.4, 'F');
      doc.roundedRect(logoX + gap, logoY + gap * 3, size, size, 0.4, 0.4, 'F');

      const textX = logoX + (gap * 2) + size + 4;

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('• Controle de Cópias', textX, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`${campusName} • Relatório de Gestão de Impressões`, 14, 27);

      doc.setFontSize(9);
      doc.text(`Período de Referência: ${months[reportRange.startMonth]} ${reportRange.startYear} até ${months[reportRange.endMonth]} ${reportRange.endYear}`, 14, 34);

      const tableHeaders = ['SERVIDOR', 'SETOR', 'TIPO'];
      const monthKeys = monthPeriods.map(p => p.key);
      tableHeaders.push(...monthKeys);
      tableHeaders.push('TOTAL');

      const tableRows: any[] = [];

      // Grand Total Row (Top) - Styled elegantly
      const provaTotalRow = ['TOTAL GERAL', '', 'PROVA'];
      const outrasTotalRow = ['', '', 'OUTRAS'];
      const sumRow = ['SOMATÓRIO', '', 'TODOS'];

      let grandProvaSum = 0;
      let grandOutrasSum = 0;

      monthKeys.forEach(mk => {
        const pVal = grandTotals[mk]?.prova || 0;
        const oVal = grandTotals[mk]?.outras || 0;
        provaTotalRow.push(pVal ? pVal.toString() : '0');
        outrasTotalRow.push(oVal ? oVal.toString() : '0');
        sumRow.push((pVal + oVal).toString());
        grandProvaSum += pVal;
        grandOutrasSum += oVal;
      });

      provaTotalRow.push(grandProvaSum.toString());
      outrasTotalRow.push(grandOutrasSum.toString());
      sumRow.push((grandProvaSum + grandOutrasSum).toString());

      tableRows.push(provaTotalRow, outrasTotalRow, sumRow);

      // Body Rows
      let lastServer = '';
      Object.keys(data).sort().forEach(server => {
        Object.keys(data[server]).sort().forEach(sector => {
          let sTotalProva = 0;
          let sTotalOutras = 0;

          // Calculate totals first to check if we should skip this row
          monthKeys.forEach(mk => {
            const val = data[server][sector].months[mk];
            sTotalProva += (val?.prova || 0);
            sTotalOutras += (val?.outras || 0);
          });

          // Skip individual lines with zero totals for a cleaner report
          if (sTotalProva > 0) {
            const sProvaRow = [server === lastServer ? '' : server.toString(), sector.toString(), 'PROVA'];
            monthKeys.forEach(mk => {
              const val = data[server][sector].months[mk];
              sProvaRow.push(val?.prova ? val.prova.toString() : '0');
            });
            sProvaRow.push(sTotalProva.toString());
            tableRows.push(sProvaRow);
            lastServer = server;
          }

          if (sTotalOutras > 0) {
            const sOutrasRow = [server === lastServer ? '' : server.toString(), sector.toString(), 'OUTRAS'];
            monthKeys.forEach(mk => {
              const val = data[server][sector].months[mk];
              sOutrasRow.push(val?.outras ? val.outras.toString() : '0');
            });
            sOutrasRow.push(sTotalOutras.toString());
            tableRows.push(sOutrasRow);
            lastServer = server;
          }
        });
      });

      autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: 50,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 3,
          font: 'helvetica',
          lineColor: [240, 240, 240],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [31, 41, 55], // gray-800
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 50 },
          2: { cellWidth: 20, fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          // IFRN Colors
          const IFRN_GREEN: [number, number, number] = [120, 190, 32];
          const IFRN_RED: [number, number, number] = [203, 22, 29];

          // Alignment for numbers
          if (data.column.index > 2) {
            data.cell.styles.halign = 'center';
          }

          // Total Rows Style (Top 3 rows)
          if (data.row.index < 3) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 253, 244]; // green-50
            data.cell.styles.textColor = [20, 83, 45]; // green-900

            if (data.row.index === 2) { // Somatório row
              data.cell.styles.fillColor = [31, 41, 55]; // gray-800
              data.cell.styles.textColor = [255, 255, 255];
            }
          }

          // Color coded print types
          if (data.column.index === 2) {
            if (data.cell.text[0] === 'PROVA') {
              data.cell.styles.textColor = IFRN_RED;
            } else if (data.cell.text[0] === 'OUTRAS') {
              data.cell.styles.textColor = [217, 119, 6]; // amber-600
            }
          }

          // Total column highligh
          if (data.column.index === tableHeaders.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            if (data.row.index >= 3) {
              data.cell.styles.fillColor = [249, 250, 251]; // gray-50
            }
          }
        },
        margin: { top: 50 },
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Gerado em ${new Date().toLocaleString()} • Página ${i} de ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`relatorio_copias_${reportRange.startYear}.pdf`);
      setIsReportModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar PDF.");
    } finally {
      setIsSaving(false);
    }
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header & Stats */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-rose-100/50 p-8 border border-rose-50 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl text-white shadow-lg shadow-rose-200">
                <Printer size={28} />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Controle de Cópias</h1>
            </div>
            <p className="text-gray-500 font-medium">Gestão de impressões e quotas por período</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center bg-gray-50 p-1.5 rounded-2xl border border-gray-100 shadow-sm">
              <button
                onClick={() => setIsReportModalOpen(true)}
                className="flex items-center gap-2 bg-white text-rose-600 border-2 border-rose-100 px-6 py-3.5 rounded-2xl font-bold shadow-sm hover:border-rose-300 hover:-translate-y-0.5 transition-all"
              >
                <FileDown size={20} /> RELATÓRIO PDF
              </button>

              <button
                onClick={() => {
                  if (selectedMonth === 0) {
                    setSelectedMonth(11);
                    setSelectedYear(v => v - 1);
                  } else {
                    setSelectedMonth(v => v - 1);
                  }
                }}
                className="p-2 hover:bg-white hover:text-rose-600 rounded-xl transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="px-4 font-bold text-gray-700 min-w-[140px] text-center">
                {months[selectedMonth]} {selectedYear}
              </div>
              <button
                onClick={() => {
                  if (selectedMonth === 11) {
                    setSelectedMonth(0);
                    setSelectedYear(v => v + 1);
                  } else {
                    setSelectedMonth(v => v + 1);
                  }
                }}
                className="p-2 hover:bg-white hover:text-rose-600 rounded-xl transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <button
              onClick={() => {
                setIsModalOpen(true);
                setSelectedDate(new Date().toISOString().split('T')[0]);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-rose-200 hover:shadow-rose-300 hover:-translate-y-0.5 transition-all"
            >
              <Plus size={20} /> NOVO REGISTRO
            </button>

            {(user?.level === UserLevel.ADMIN || user?.level === UserLevel.ADVANCED) && (
              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="p-3.5 bg-white text-gray-600 hover:text-rose-600 border-2 border-gray-100 rounded-2xl hover:border-rose-200 transition-all shadow-sm"
                title="Configurações de Período"
              >
                <Settings size={22} />
              </button>
            )}
          </div>
        </div>

        {/* Dash Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mt-10">
          <button
            onClick={() => setActiveFilter(prev => prev === 'PROVA' ? 'ALL' : 'PROVA')}
            className={`bg-gradient-to-br from-rose-50 to-white p-6 rounded-[2rem] border-2 shadow-sm transition-all hover:shadow-md group text-left ${activeFilter === 'PROVA' ? 'border-rose-500 scale-105 shadow-rose-100' : 'border-rose-100 hover:border-rose-200'}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white text-rose-600 rounded-2xl shadow-sm group-hover:scale-110 transition-transform border border-rose-50">
                <FileText size={24} />
              </div>
              <span className="text-[10px] font-black tracking-widest text-rose-300 uppercase">Provas</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-4xl font-black text-gray-900">{totals.prova}</h3>
              <p className="text-xs font-bold text-gray-400">Total em provas</p>
            </div>
          </button>

          <button
            onClick={() => setActiveFilter(prev => prev === 'OUTRAS' ? 'ALL' : 'OUTRAS')}
            className={`bg-gradient-to-br from-amber-50 to-white p-6 rounded-[2rem] border-2 shadow-sm transition-all hover:shadow-md group text-left ${activeFilter === 'OUTRAS' ? 'border-amber-500 scale-105 shadow-amber-100' : 'border-amber-100 hover:border-amber-200'}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white text-amber-600 rounded-2xl shadow-sm group-hover:scale-110 transition-transform border border-amber-50">
                <PieChart size={24} />
              </div>
              <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase">Outras</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-4xl font-black text-gray-900">{totals.outras}</h3>
              <p className="text-xs font-bold text-gray-400">Apostilas e outros</p>
            </div>
          </button>

          <button
            onClick={() => setActiveFilter(prev => prev === 'SERVIDOR' ? 'ALL' : 'SERVIDOR')}
            className={`bg-gradient-to-br from-emerald-50 to-white p-6 rounded-[2rem] border-2 shadow-sm transition-all hover:shadow-md group text-left ${activeFilter === 'SERVIDOR' ? 'border-emerald-500 scale-105 shadow-emerald-100' : 'border-emerald-100 hover:border-emerald-200'}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white text-emerald-600 rounded-2xl shadow-sm group-hover:scale-110 transition-transform border border-emerald-50">
                <Building2 size={24} />
              </div>
              <span className="text-[10px] font-black tracking-widest text-emerald-300 uppercase">Servidores</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-4xl font-black text-gray-900">{totals.servidor}</h3>
              <p className="text-xs font-bold text-gray-400">Cópias de servidores</p>
            </div>
          </button>

          <button
            onClick={() => setActiveFilter(prev => prev === 'ALUNO' ? 'ALL' : 'ALUNO')}
            className={`bg-gradient-to-br from-blue-50 to-white p-6 rounded-[2rem] border-2 shadow-sm transition-all hover:shadow-md group text-left ${activeFilter === 'ALUNO' ? 'border-blue-500 scale-105 shadow-blue-100' : 'border-blue-100 hover:border-blue-200'}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white text-blue-600 rounded-2xl shadow-sm group-hover:scale-110 transition-transform border border-blue-50">
                <UserIcon size={24} />
              </div>
              <span className="text-[10px] font-black tracking-widest text-blue-300 uppercase">Alunos</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-4xl font-black text-gray-900">{totals.aluno}</h3>
              <p className="text-xs font-bold text-gray-400">Cópias de alunos</p>
            </div>
          </button>


          <button
            onClick={() => setActiveFilter('ALL')}
            className={`bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-[2rem] shadow-xl transition-all group relative overflow-hidden text-left border-2 ${activeFilter === 'ALL' ? 'border-rose-500 scale-105' : 'border-transparent shadow-gray-200'}`}
          >
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <TrendingUp size={120} />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="p-3 bg-white/10 text-white rounded-2xl backdrop-blur-md group-hover:scale-110 transition-transform">
                <TrendingUp size={24} />
              </div>
              <span className="text-[10px] font-black tracking-widest text-white/30 uppercase">Geral</span>
            </div>
            <div className="space-y-1 relative z-10">
              <h3 className="text-4xl font-black text-white">{totals.total}</h3>
              <p className="text-xs font-bold text-white/50">Geral no período</p>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-md group">
            <input
              type="text"
              placeholder="Pesquisar por nome, matrícula ou setor..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setAppliedSearchTerm(''); // Clear results when editing
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setAppliedSearchTerm(searchTerm);
                }
              }}
              className="w-full pl-6 pr-14 py-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-sm text-gray-700 shadow-inner"
            />
            <button
              onClick={() => setAppliedSearchTerm(searchTerm)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-600 transition-colors p-2"
            >
              <Search size={24} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 rounded-xl text-rose-700 text-xs font-bold border border-rose-100 italic">
                  <Calendar size={14} />
                  Periodo: {periodRange.start.toLocaleDateString()} - {periodRange.end.toLocaleDateString()}
                </div>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-gray-100 rounded-xl text-gray-500 hover:text-rose-600 hover:border-rose-200 transition-all font-bold text-xs uppercase tracking-wide"
                >
                  <Download size={16} /> Exportar
                </button>
              </div>

              {/* Accounting Month Notice */}
              {!isPeriodForToday && (
                <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 py-1 bg-amber-50 rounded-lg animate-pulse border border-amber-100">
                  <Info size={12} /> Visualizando Competência: {months[selectedMonth]} {selectedYear}
                </div>
              )}
              {isPeriodForToday && (
                <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase tracking-widest px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                  <CheckCircle2 size={12} /> Competência Atual: {months[selectedMonth]} {selectedYear}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Informações do Solicitante</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo / Finalidade</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantidade</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Setor</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data / Registro</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {groupedRecords.length > 0 ? groupedRecords.map((group) => {
                const record = group.records[0];
                const isGrouped = group.records.length > 1;

                return (
                  <tr key={record.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-8 py-6">
                      <div>
                          <p className="font-bold text-gray-900 group-hover:text-rose-600 transition-colors">{record.person_name}</p>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 mt-1">
                            <span className="bg-gray-100 px-2 py-0.5 rounded-md">{record.person_matricula}</span>
                            <span className="flex items-center gap-1">
                              <Building2 size={10} />
                              {(() => {
                                const sectors = Array.from(new Set(group.records.map(r => r.sector).filter(Boolean)));
                                if (sectors.length > 1) return `${sectors.length} Setores`;
                                if (sectors.length === 1) return sectors[0];
                                return 'Sem Setor';
                              })()}
                            </span>
                          </div>
                        </div>
                    </td>
                    <td className="px-8 py-6">
                      {(() => {
                        const types = Array.from(new Set(group.records.map(r => r.print_type)));
                        if (types.length > 1) {
                          return (
                            <div className="flex flex-wrap gap-1">
                              {types.map(t => (
                                <span key={t} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider ${t === 'PROVA' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                                  }`}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          );
                        }
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${record.print_type === 'PROVA'
                            ? 'bg-rose-100 text-rose-700 shadow-sm shadow-rose-100'
                            : 'bg-amber-100 text-amber-700 shadow-sm shadow-amber-100'
                            }`}>
                            <Printer size={12} /> {record.print_type}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xl font-black text-gray-800 tracking-tight">{group.totalQuantity}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">UNID</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        {(() => {
                          const setorIds = Array.from(new Set(group.records.map(r => r.setor_id).filter(Boolean)));
                          if (setorIds.length > 1) return <span className="text-xs font-bold text-gray-500">{setorIds.length} setores</span>;
                          if (setorIds.length === 1) {
                            const setor = setores.find(s => s.id === setorIds[0]);
                            return <span className="text-xs font-bold text-gray-700">{setor?.name || setorIds[0]}</span>;
                          }
                          return <span className="text-xs text-gray-400 italic">---</span>;
                        })()}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase">
                          <Calendar size={12} className="text-gray-400" />
                          {(() => {
                            const dates = group.records.map(r => new Date(r.date).getTime());
                            const minDate = new Date(Math.min(...dates));
                            const maxDate = new Date(Math.max(...dates));
                            
                            if (minDate.toLocaleDateString() === maxDate.toLocaleDateString()) {
                              return minDate.toLocaleDateString();
                            }
                            return `${minDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${maxDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedGroup(group.records);
                            setIsDetailsModalOpen(true);
                          }}
                          className="p-2.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Ver Detalhes"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingRecord(record);
                            setNewRecord({
                              print_type: record.print_type,
                              quantity: record.quantity,
                              date: record.date,
                              person_name: record.person_name,
                              person_matricula: record.person_matricula,
                              sector: record.sector
                            });
                            setSelectedSetorId(record.setor_id || '');
                            setSelectedDate(new Date(record.date).toISOString().split('T')[0]);
                            setSelectedPerson({
                              name: record.person_name,
                              matricula: record.person_matricula,
                              type: record.person_type as any,
                              campus_id: record.campus_id
                            });
                            setIsModalOpen(true);
                          }}
                          className="p-2.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                          title="Editar todos os registros deste grupo"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(group.records.map(r => r.id))}
                          className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="max-w-xs mx-auto">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-gray-100">
                        <TableIcon size={24} className="text-gray-300" />
                      </div>
                      <h3 className="text-lg font-black text-gray-800 mb-2">Sem registros</h3>
                      <p className="text-sm text-gray-500 mb-6">Nenhuma cópia registrada para este período ou busca.</p>
                      <button
                        onClick={() => {
                          setIsModalOpen(true);
                          setSelectedDate(new Date().toISOString().split('T')[0]);
                        }}
                        className="text-rose-600 font-bold hover:underline"
                      >
                        Clique aqui para adicionar
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW RECORD MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="">
        <div className="space-y-6">
          <div className="text-center pb-6 border-b border-gray-100">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-rose-200">
              <Printer size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">
              {editingRecord ? 'Editar Registro de Cópia' : 'Novo Registro de Cópia'}
            </h3>
            <p className="text-sm text-gray-500 font-medium">
              {editingRecord ? 'Atualize os dados do registro' : 'Preencha os dados do solicitante e quantidade'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Person Search */}
            <div className="space-y-3 relative">
              <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <UserIcon size={16} className="text-rose-500" />
                Dono(a) das Cópias
              </label>
              {selectedPerson ? (
                <div className="flex items-center justify-between p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl gap-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{selectedPerson.name}</p>
                      <p className="text-xs text-rose-400 font-medium">{selectedPerson.matricula}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPerson(null)}
                    className="p-2 hover:bg-white hover:text-rose-600 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Nome ou Matrícula..."
                    value={personSearch}
                    onChange={e => handlePersonSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (searchResults.length > 0 && selectedResultIndex >= 0) {
                          handleSelectPerson(searchResults[selectedResultIndex]);
                        } else {
                          handlePersonSearch(personSearch, true);
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedResultIndex(prev =>
                          prev < searchResults.length - 1 ? prev + 1 : prev
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedResultIndex(prev => prev > 0 ? prev - 1 : prev);
                      }
                    }}
                    className="w-full pl-6 pr-14 py-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-sm"
                  />
                  <button
                    onClick={() => handlePersonSearch(personSearch, true)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-600 transition-colors p-2"
                  >
                    {isSearchingPeople ? (
                      <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Search size={22} />
                    )}
                  </button>
                  {(searchResults.length > 0 || isSearchingPeople) && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-xl mt-2 overflow-hidden z-[100] border-t-0 animate-in fade-in slide-in-from-top-2 duration-300">
                      {isSearchingPeople ? (
                        <div className="p-4 text-center text-gray-400 text-sm font-bold flex items-center justify-center gap-2 italic">
                          <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                          Pesquisando...
                        </div>
                      ) : (
                        searchResults.map((p, index) => (
                          <button
                            key={p.matricula}
                            onClick={() => handleSelectPerson(p)}
                            className={`w-full p-4 flex items-center justify-between transition-colors border-b border-gray-50 last:border-0 ${selectedResultIndex === index ? 'bg-rose-50 border-l-4 border-rose-500' : 'hover:bg-rose-50 pl-4'}`}
                            style={{ paddingLeft: selectedResultIndex === index ? '12px' : '16px' }}
                          >
                            <div className="text-left">
                              <p className={`font-bold text-sm uppercase ${selectedResultIndex === index ? 'text-rose-600' : 'text-gray-800'}`}>{p.name}</p>
                              <p className="text-xs text-gray-400 font-medium">{p.matricula} • {p.type}</p>
                            </div>
                            {selectedResultIndex === index && <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Selecionar</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <PieChart size={16} className="text-rose-500" />
                Finalidade
              </label>
              <select
                value={newRecord.print_type}
                onChange={e => setNewRecord(v => ({ ...v, print_type: e.target.value as any }))}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-sm text-gray-700 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNhYWFhYWEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNiA5bDYgNiA2LTYiLz48L3N2Zz4=')] bg-no-repeat bg-[right_1rem_center]"
              >
                <option value="PROVA">PROVA</option>
                <option value="OUTRAS">OUTRAS</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={16} className="text-rose-500" />
                  Quantidade
                </label>
                <input
                  type="number"
                  min="1"
                  value={newRecord.quantity}
                  onChange={e => setNewRecord(v => ({ ...v, quantity: parseInt(e.target.value) }))}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-black text-lg text-rose-700 text-center"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={16} className="text-rose-500" />
                  Data
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-bold text-sm text-gray-700 text-center"
                />
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-3">
                <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                  <Building2 size={16} className="text-rose-500" />
                  Setor (vínculo)
                </label>
                <select
                  value={selectedSetorId}
                  onChange={e => setSelectedSetorId(e.target.value)}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-bold text-sm text-gray-700"
                >
                  <option value="">Selecione um setor...</option>
                  {setores.filter(s => s.campus_id === (adminGlobalCampusId || user?.campus_id)).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-3">
              <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <Building2 size={16} className="text-rose-500" />
                Setor / Destino
              </label>
              <input
                type="text"
                placeholder="Ex: Coordenação, Biblioteca..."
                value={newRecord.sector || ''}
                onChange={e => setNewRecord(v => ({ ...v, sector: e.target.value }))}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-sm text-gray-700"
              />
            </div>

            <div className="pt-6 border-t border-gray-100 flex gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-6 py-4 bg-gray-50 text-gray-400 hover:text-gray-700 rounded-2xl font-black transition-all text-xs uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRecord}
                disabled={isSaving}
                className="flex-[2] px-6 py-4 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-2xl font-black shadow-lg shadow-rose-200 hover:shadow-rose-400 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Save size={20} /> {editingRecord ? 'Salvar Alterações' : 'Salvar Registro'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* CONFIG MODAL */}
      <Modal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} title="">
        <div className="space-y-6">
          <div className="text-center pb-6 border-b border-gray-100">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
              <Settings size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Configurar Período</h3>
            <p className="text-sm text-gray-500 font-medium">{campuses.find(c => c.id === (adminGlobalCampusId || user?.campus_id))?.name || ''}</p>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex gap-3 text-blue-700">
            <Info size={20} className="shrink-0" />
            <p className="text-xs font-bold leading-relaxed">
              Defina o <strong>dia inicial</strong> e o <strong>dia final</strong> de cada mês de competência.
              Ambos os dias ficam <strong>dentro do mesmo mês</strong>. Se o dia final for maior que os dias do mês, será ajustado automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" />
                Dia Inicial
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={tempConfig.start_day}
                onChange={e => setTempConfig(v => ({ ...v, start_day: parseInt(e.target.value) }))}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white rounded-2xl outline-none transition-all font-black text-lg text-indigo-700 text-center"
              />
              <p className="text-xs text-gray-400 text-center font-medium">Primeiro dia do mês</p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" />
                Dia Final
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={tempConfig.end_day}
                onChange={e => setTempConfig(v => ({ ...v, end_day: parseInt(e.target.value) }))}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white rounded-2xl outline-none transition-all font-black text-lg text-indigo-700 text-center"
              />
              <p className="text-xs text-gray-400 text-center font-medium">Último dia do mês</p>
            </div>
          </div>

          {(() => {
            const today = new Date();
            const sm = today.getMonth();
            const sy = today.getFullYear();
            const lastDay = new Date(sy, sm + 1, 0).getDate();
            const sdFmt = `${String(Math.min(tempConfig.start_day, lastDay)).padStart(2, '0')}/${String(sm + 1).padStart(2, '0')}/${sy}`;
            const edFmt = `${String(Math.min(tempConfig.end_day, lastDay)).padStart(2, '0')}/${String(sm + 1).padStart(2, '0')}/${sy}`;
            return (
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-center">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Prévia deste mês</p>
                <p className="text-lg font-black text-emerald-800">{sdFmt} — {edFmt}</p>
                {tempConfig.end_day > lastDay && (
                  <p className="text-xs text-amber-600 font-semibold mt-1">⚠ {MONTHS[sm]} tem apenas {lastDay} dias — dia final ajustado para {lastDay}</p>
                )}
              </div>
            );
          })()}

          <div className="pt-6 border-t border-gray-100 flex gap-4">
            <button
              onClick={() => setIsConfigModalOpen(false)}
              className="flex-1 px-6 py-4 bg-gray-50 text-gray-400 hover:text-gray-700 rounded-2xl font-black transition-all text-xs uppercase tracking-widest"
            >
              Fechar
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="flex-[2] px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 hover:shadow-indigo-400 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save size={20} /> Salvar Configuração
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* REPORT PDF MODAL */}
      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} title="">
        <div className="space-y-6">
          <div className="text-center pb-6 border-b border-gray-100">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-rose-200">
              <FileDown size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Gerar Relatório PDF</h3>
            <p className="text-sm text-gray-500 font-medium">Escolha o intervalo de meses para o relatório</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-black text-gray-700 uppercase tracking-widest">Início</label>
              <div className="flex flex-col gap-2">
                <select
                  value={reportRange.startMonth}
                  onChange={e => setReportRange(v => ({ ...v, startMonth: parseInt(e.target.value) }))}
                  className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-rose-200 rounded-xl outline-none font-bold text-sm"
                >
                  {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <input
                  type="number"
                  value={reportRange.startYear}
                  onChange={e => setReportRange(v => ({ ...v, startYear: parseInt(e.target.value) }))}
                  className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-rose-200 rounded-xl outline-none font-bold text-sm text-center"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-black text-gray-700 uppercase tracking-widest">Fim</label>
              <div className="flex flex-col gap-2">
                <select
                  value={reportRange.endMonth}
                  onChange={e => setReportRange(v => ({ ...v, endMonth: parseInt(e.target.value) }))}
                  className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-rose-200 rounded-xl outline-none font-bold text-sm"
                >
                  {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <input
                  type="number"
                  value={reportRange.endYear}
                  onChange={e => setReportRange(v => ({ ...v, endYear: parseInt(e.target.value) }))}
                  className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-rose-200 rounded-xl outline-none font-bold text-sm text-center"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex gap-4">
            <button
              onClick={() => setIsReportModalOpen(false)}
              className="flex-1 px-6 py-4 bg-gray-50 text-gray-400 hover:text-gray-700 rounded-2xl font-black transition-all text-xs uppercase tracking-widest"
            >
              Cancelar
            </button>
            <button
              onClick={handleGeneratePDF}
              disabled={isSaving}
              className="flex-[2] px-6 py-4 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-2xl font-black shadow-lg shadow-rose-200 hover:shadow-rose-400 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <FileDown size={20} /> Gerar Relatório
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* DETAILS MODAL */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="">
        <div className="space-y-6">
          <div className="text-center pb-6 border-b border-gray-100">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-rose-200">
              <Printer size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Detalhes da Impressão</h3>
            <p className="text-sm text-gray-500 font-medium">Breakdown por setor e quantidade</p>
          </div>

          {selectedGroup && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 text-left">Solicitante</p>
                    <p className="font-bold text-gray-800 text-left">{selectedGroup[0].person_name}</p>
                    <p className="text-xs text-rose-500 font-bold text-left">{selectedGroup[0].person_matricula}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Última Impressão</p>
                    <p className="text-xs font-bold text-gray-700">
                      {new Date(selectedGroup[0].date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-left">Detalhamento</p>
                  {selectedGroup.map((record, idx) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 text-[10px] font-black italic">
                          {record.print_type === 'PROVA' ? <FileText size={14} /> : <Printer size={14} className="text-amber-500" />}
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-gray-800">{record.sector || 'Sem Setor'}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${record.print_type === 'PROVA' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                              {record.print_type}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold mt-0.5 flex items-center gap-1">
                            <Calendar size={10} className="text-rose-400" />
                            {new Date(record.date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-sm font-black text-gray-900">{record.quantity}</span>
                          <span className="text-[10px] font-bold text-gray-400 ml-1">UNID</span>
                        </div>
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir este item"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingRecord(record);
                            setNewRecord({
                              print_type: record.print_type,
                              quantity: record.quantity,
                              date: record.date,
                              person_name: record.person_name,
                              person_matricula: record.person_matricula,
                              sector: record.sector
                            });
                            setSelectedSetorId(record.setor_id || '');
                            setSelectedDate(new Date(record.date).toISOString().split('T')[0]);
                            setSelectedPerson({
                              name: record.person_name,
                              matricula: record.person_matricula,
                              type: record.person_type as any,
                              campus_id: record.campus_id
                            });
                            setIsDetailsModalOpen(false);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                          title="Editar este item"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Acumulado</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-rose-600">
                      {selectedGroup.reduce((acc, curr) => acc + curr.quantity, 0)}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">UNID</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => setIsDetailsModalOpen(false)}
              className="w-full px-6 py-4 bg-gray-50 text-gray-500 hover:text-gray-700 rounded-2xl font-black transition-all text-xs uppercase tracking-widest border-2 border-transparent hover:border-gray-100"
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CopyControlTab;

