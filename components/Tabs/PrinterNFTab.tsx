import React, { useState, useEffect, useCallback } from 'react';
import { StorageService } from '../../services/storage';
import { PrinterCounterRecord, PrinterBillingConfig, User, Campus, PrinterRegistry, CopyConfig } from '../../types';
import {
  Printer, Plus, Trash2, Pencil, Save, Settings, ChevronLeft, ChevronRight,
  Loader2, FileText, DollarSign, AlertCircle, CheckCircle2, Download, Info,
  BarChart3, AlertTriangle, Ban, Info as InfoIcon, ArrowUpDown, ArrowUp, ArrowDown,
  Calendar
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PrinterNFTabProps {
  user: User;
  campuses: Campus[];
  adminGlobalCampusId?: string | null;
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const DEFAULT_CONFIG: Omit<PrinterBillingConfig, 'campus_id'> = {
  a4_mono_franchise: 16000, a4_mono_excess_franchise: 5000, a4_mono_price_franchise: 0.052, a4_mono_price_excess: 0.042,
  a4_poli_franchise: 500,   a4_poli_excess_franchise: 200,  a4_poli_price_franchise: 0.306, a4_poli_price_excess: 0.200,
  a3_mono_franchise: 100,   a3_mono_excess_franchise: 50,   a3_mono_price_franchise: 0.198, a3_mono_price_excess: 0.084,
  a3_poli_franchise: 100,   a3_poli_excess_franchise: 50,   a3_poli_price_franchise: 0.306, a3_poli_price_excess: 0.200,
};

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (v: number) => v.toLocaleString('pt-BR');

type CatKey = 'a4_mono' | 'a4_poli' | 'a3_mono' | 'a3_poli';

interface BillingResult {
  total: number;
  withinFranchise: number;
  excess: number;
  valueF: number;
  valueE: number;
  isBlocked: boolean;        // total > franchise + excess_franchise
  blockRemaining: number;    // pages until block (negative = already blocked)
}

function calcBilling(records: PrinterCounterRecord[], cfg: PrinterBillingConfig) {
  const sum = (format: 'A4'|'A3', color: 'MONO'|'POLI') =>
    records.filter(r => r.format === format && r.color_mode === color)
      .reduce((s, r) => s + Math.max(0, r.counter_curr - r.counter_prev), 0);

  const calc = (total: number, franchise: number, excessFranchise: number, priceF: number, priceE: number): BillingResult => {
    const maxTotal = franchise + excessFranchise;
    const effectiveTotal = Math.min(total, maxTotal);
    const withinFranchise = Math.min(effectiveTotal, franchise);
    const excess = Math.max(0, effectiveTotal - franchise);
    const isBlocked = total > maxTotal;
    const blockRemaining = maxTotal - total;
    return { total, withinFranchise, excess, valueF: withinFranchise * priceF, valueE: excess * priceE, isBlocked, blockRemaining };
  };

  const a4Mono = calc(sum('A4','MONO'), cfg.a4_mono_franchise, cfg.a4_mono_excess_franchise, cfg.a4_mono_price_franchise, cfg.a4_mono_price_excess);
  const a4Poli = calc(sum('A4','POLI'), cfg.a4_poli_franchise, cfg.a4_poli_excess_franchise, cfg.a4_poli_price_franchise, cfg.a4_poli_price_excess);
  const a3Mono = calc(sum('A3','MONO'), cfg.a3_mono_franchise, cfg.a3_mono_excess_franchise, cfg.a3_mono_price_franchise, cfg.a3_mono_price_excess);
  const a3Poli = calc(sum('A3','POLI'), cfg.a3_poli_franchise, cfg.a3_poli_excess_franchise, cfg.a3_poli_price_franchise, cfg.a3_poli_price_excess);

  const totalValue = [a4Mono, a4Poli, a3Mono, a3Poli].reduce((s, c) => s + c.valueF + c.valueE, 0);
  const totalExcess = a4Mono.excess + a4Poli.excess + a3Mono.excess + a3Poli.excess;
  const excessValue = a4Mono.valueE + a4Poli.valueE + a3Mono.valueE + a3Poli.valueE;
  const anyBlocked = [a4Mono, a4Poli, a3Mono, a3Poli].some(c => c.isBlocked);

  return { a4Mono, a4Poli, a3Mono, a3Poli, totalValue, totalExcess, excessValue, anyBlocked };
}

// ─── 3-Zone Franchise Bar ─────────────────────────────────────────────────────
interface FranchiseBarProps {
  label: string;
  used: number;
  franchise: number;
  excessFranchise: number;
  dot: string;
}
function FranchiseBar({ label, used, franchise, excessFranchise, dot }: FranchiseBarProps) {
  const maxTotal = franchise + excessFranchise;
  if (maxTotal === 0) return null;

  const franchisePct = Math.min(100, (franchise / maxTotal) * 100);   // where zone 1 ends on bar
  const usedPct      = Math.min(100, (used        / maxTotal) * 100); // how much is filled

  const isBlocked = used > maxTotal;
  const inExcess  = !isBlocked && used > franchise;
  const excess    = Math.max(0, used - franchise);
  const remaining = maxTotal - used;

  // Status
  let statusLabel = '';
  let statusColor = 'text-emerald-600';
  let StatusIcon: React.ElementType = CheckCircle2;

  if (isBlocked) {
    statusLabel = `BLOQUEADO — ${fmt(Math.abs(remaining))} pág. acima do teto`;
    statusColor = 'text-red-700';
    StatusIcon = Ban;
  } else if (inExcess) {
    statusLabel = `Excedente — ${fmt(excess)} pág. exc. · ${fmt(remaining)} até bloqueio`;
    statusColor = 'text-orange-600';
    StatusIcon = AlertCircle;
  } else if (used / franchise >= 0.85) {
    statusLabel = `Atenção — ${fmt(franchise - used)} pág. até o limite da franquia`;
    statusColor = 'text-amber-600';
    StatusIcon = AlertTriangle;
  } else {
    statusLabel = `${fmt(franchise - used)} pág. restantes na franquia`;
    statusColor = 'text-emerald-600';
    StatusIcon = CheckCircle2;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-gray-700 flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${dot}`}/>
          {label}
        </span>
        <span className={`font-bold ${statusColor} flex items-center gap-1`}>
          <StatusIcon size={11}/>
          {statusLabel}
        </span>
      </div>

      {/* Three-zone bar */}
      <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden flex">
        {/* Zone 1: Franchise (light gray track → green fill) */}
        <div className="relative h-full" style={{ width: `${franchisePct}%`, background: '#e2e8f0' }}>
          <div
            className="h-full bg-emerald-500 rounded-l-full transition-all duration-700"
            style={{ width: used <= franchise ? `${Math.min(100,(used/franchise)*100)}%` : '100%' }}
          />
        </div>
        {/* Separator line at franchise limit */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10" style={{ left: `${franchisePct}%` }}/>
        {/* Zone 2: Excess (darker track → orange/red fill) */}
        <div className="relative h-full flex-1 bg-red-100">
          {inExcess && !isBlocked && (
            <div
              className="h-full bg-orange-400 rounded-r-full transition-all duration-700"
              style={{ width: `${Math.min(100,(excess/excessFranchise)*100)}%` }}
            />
          )}
          {isBlocked && (
            <div className="h-full w-full bg-red-600 rounded-r-full flex items-center justify-center">
              <span className="text-white text-xs font-black tracking-widest">BLOQUEADO</span>
            </div>
          )}
        </div>
      </div>

      {/* Legend row */}
      <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Franquia: {fmt(franchise)} pág.</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>Excedente max: {fmt(excessFranchise)} pág.</span>
        <span className="font-semibold text-gray-600">Usado: {fmt(used)} / {fmt(maxTotal)} pág. totais</span>
      </div>
    </div>
  );
}

// ─── Radial Gauge ─────────────────────────────────────────────────────────────
function RadialGauge({ used, franchise, excessFranchise, label }: { used:number; franchise:number; excessFranchise:number; label:string }) {
  const maxTotal = franchise + excessFranchise;
  const p = maxTotal > 0 ? Math.min(100, Math.round((used / maxTotal) * 100)) : 0;
  const isBlocked = used > maxTotal;
  const r = 34;
  const circ = 2 * Math.PI * r;
  const franchiseLine = maxTotal > 0 ? (franchise / maxTotal) : 0;
  const trackColor = isBlocked ? '#dc2626' : used > franchise ? '#f97316' : used / franchise >= 0.85 ? '#f59e0b' : '#10b981';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          {/* Full track */}
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7"/>
          {/* Franchise zone track (slightly different shade) */}
          <circle cx="40" cy="40" r={r} fill="none" stroke="#dcfce7" strokeWidth="7"
            strokeDasharray={`${franchiseLine * circ} ${circ}`} strokeDashoffset={0}/>
          {/* Used fill */}
          <circle cx="40" cy="40" r={r} fill="none" stroke={trackColor} strokeWidth="7"
            strokeDasharray={circ} strokeDashoffset={circ - (p / 100) * circ}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }}/>
          {/* Franchise separator tick */}
          <line x1="40" y1="6" x2="40" y2="12" stroke="white" strokeWidth="2"
            style={{ transformOrigin:'40px 40px', transform:`rotate(${franchiseLine*360}deg)` }}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isBlocked
            ? <Ban size={18} className="text-red-600"/>
            : <span className="text-sm font-black text-gray-800 leading-none">{p}%</span>}
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{fmt(used)}<span className="text-gray-300"> / {fmt(maxTotal)}</span></p>
      </div>
    </div>
  );
}

const EMPTY_COUNTER_FORM = {
  printer_id: '',
  local_name: '',
  serial_number: '',
  ip_address: '',
  model: '',
  format: 'A4' as 'A4'|'A3',
  color_mode: 'MONO' as 'MONO'|'POLI',
  counter_prev: 0,
  counter_curr: 0,
  formMonth: new Date().getMonth(),
  formYear: new Date().getFullYear(),
};

const EMPTY_PRINTER_FORM = {
  local_name: '',
  serial_number: '',
  ip_address: '',
  model: '',
  supports_a4_mono: true,
  supports_a4_poli: false,
  supports_a3_mono: false,
  supports_a3_poli: false,
};

export const PrinterNFTab: React.FC<PrinterNFTabProps> = ({ user, campuses, adminGlobalCampusId }) => {
  const campusId = adminGlobalCampusId || user.campus_id || '';

  const [copyConfig, setCopyConfig]     = useState<CopyConfig | null>(null);
  const [selMonth, setSelMonth]         = useState(new Date().getMonth());
  const [selYear, setSelYear]           = useState(new Date().getFullYear());
  const [hasInitialized, setHasInitialized] = useState(false);
  const period = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`;

  const [records, setRecords]           = useState<PrinterCounterRecord[]>([]);
  const [printers, setPrinters]         = useState<PrinterRegistry[]>([]);
  const [cfg, setCfg]                   = useState<PrinterBillingConfig>({ campus_id: campusId, ...DEFAULT_CONFIG });
  const [loading, setLoading]           = useState(false);
  
  // Modals
  const [showCounterForm, setShowCounterForm]   = useState(false);
  const [showConfig, setShowConfig]             = useState(false);
  const [showPrintersManager, setShowPrintersManager] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);

  // Editing states
  const [editingRecord, setEditingRecord]   = useState<PrinterCounterRecord | null>(null);
  const [editingPrinter, setEditingPrinter] = useState<PrinterRegistry | null>(null);

  // Forms
  const [counterForm, setCounterForm] = useState(EMPTY_COUNTER_FORM);
  const [printerForm, setPrinterForm] = useState(EMPTY_PRINTER_FORM);
  const [cfgDraft, setCfgDraft]       = useState<PrinterBillingConfig>({ campus_id: campusId, ...DEFAULT_CONFIG });

  // Progress/Saving states
  const [savingCounter, setSavingCounter] = useState(false);
  const [savingPrinter, setSavingPrinter] = useState(false);
  const [savingCfg, setSavingCfg]         = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [deletingPrinterId, setDeletingPrinterId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!campusId) return;
    setLoading(true);
    try {
      const [recs, prns, billingCfg, cpCfg] = await Promise.all([
        StorageService.getPrinterCounterRecords(campusId, period),
        StorageService.getPrinterRegistry(campusId),
        StorageService.getPrinterBillingConfig(campusId),
        StorageService.getCopyConfig(campusId),
      ]);
      setRecords(recs);
      setPrinters(prns);
      if (cpCfg) setCopyConfig(cpCfg);
      if (billingCfg) {
        setCfg({ ...DEFAULT_CONFIG, ...billingCfg, campus_id: campusId });
        setCfgDraft({ ...DEFAULT_CONFIG, ...billingCfg, campus_id: campusId });
      } else {
        const b = { campus_id: campusId, ...DEFAULT_CONFIG };
        setCfg(b);
        setCfgDraft(b);
      }
    } catch (e) {
      console.error('Erro ao carregar dados NF:', e);
    } finally {
      setLoading(false);
    }
  }, [campusId, period]);

  useEffect(() => { loadData(); }, [loadData]);

  // Sync period with copy config (same accounting period as Controle de Cópias)
  useEffect(() => {
    if (!copyConfig || hasInitialized) return;
    const startDay = copyConfig.start_day || 13;
    const today = new Date();
    let month = today.getMonth();
    let year = today.getFullYear();
    if (today.getDate() < startDay) {
      month -= 1;
      if (month < 0) { month = 11; year -= 1; }
    }
    setSelMonth(month);
    setSelYear(year);
    setHasInitialized(true);
  }, [copyConfig, hasInitialized]);

  const billing = calcBilling(records, cfg);

  // Sorting state for printers
  const [sortField, setSortField] = useState<'local_name' | 'serial_number' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'local_name' | 'serial_number') => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedPrinters = [...printers].sort((a, b) => {
    if (!sortField) return 0;
    const valA = (a[sortField] || '').toLowerCase();
    const valB = (b[sortField] || '').toLowerCase();
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Open Counter Form
  const openNewCounter = () => {
    const startDay = copyConfig?.start_day || 13;
    const today = new Date();
    let m = today.getMonth();
    let y = today.getFullYear();
    if (today.getDate() < startDay) {
      m -= 1;
      if (m < 0) { m = 11; y -= 1; }
    }
    setEditingRecord(null);
    setCounterForm({ ...EMPTY_COUNTER_FORM, formMonth: m, formYear: y });
    setShowCounterForm(true);
  };

  const openEditCounter = (r: PrinterCounterRecord) => {
    const parts = (r.period || '').split('-');
    const fm = parts.length === 2 ? parseInt(parts[1]) - 1 : selMonth;
    const fy = parts.length === 2 ? parseInt(parts[0]) : selYear;
    setEditingRecord(r);
    setCounterForm({
      printer_id: r.printer_id || '',
      local_name: r.local_name,
      serial_number: r.serial_number || '',
      ip_address: r.ip_address || '',
      model: r.model || '',
      format: r.format,
      color_mode: r.color_mode,
      counter_prev: r.counter_prev,
      counter_curr: r.counter_curr,
      formMonth: fm,
      formYear: fy,
    });
    setShowCounterForm(true);
  };

  // Open Printer Form
  const openNewPrinter = () => {
    setEditingPrinter(null);
    setPrinterForm(EMPTY_PRINTER_FORM);
    setShowPrinterModal(true);
  };

  const openEditPrinter = (p: PrinterRegistry) => {
    setEditingPrinter(p);
    setPrinterForm({
      local_name: p.local_name,
      serial_number: p.serial_number || '',
      ip_address: p.ip_address || '',
      model: p.model || '',
      supports_a4_mono: p.supports_a4_mono,
      supports_a4_poli: p.supports_a4_poli,
      supports_a3_mono: p.supports_a3_mono,
      supports_a3_poli: p.supports_a3_poli,
    });
    setShowPrinterModal(true);
  };

  // Handlers
  const handleSaveCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterForm.local_name) {
      alert('Selecione uma impressora cadastrada.');
      return;
    }
    const formPeriod = `${counterForm.formYear}-${String(counterForm.formMonth + 1).padStart(2, '0')}`;
    setSavingCounter(true);
    try {
      await StorageService.savePrinterCounterRecord({
        ...(editingRecord ? { id: editingRecord.id } : {}),
        campus_id: campusId,
        period: formPeriod,
        printer_id: counterForm.printer_id || undefined,
        local_name: counterForm.local_name,
        serial_number: counterForm.serial_number || undefined,
        ip_address: counterForm.ip_address || undefined,
        model: counterForm.model || undefined,
        format: counterForm.format,
        color_mode: counterForm.color_mode,
        counter_prev: Number(counterForm.counter_prev),
        counter_curr: Number(counterForm.counter_curr),
        operator_id: user.id,
      });

      const savedCurr = Number(counterForm.counter_curr);
      const savedPrev = Number(counterForm.counter_prev);

      if (savedCurr > 0 && counterForm.printer_id) {
        const nextAdj = findAdjacent(counterForm.printer_id, counterForm.format, counterForm.color_mode, counterForm.formMonth, counterForm.formYear, 1);
        if (nextAdj && nextAdj.counter_prev === 0 && nextAdj.id) {
          await StorageService.savePrinterCounterRecord({ id: nextAdj.id, counter_prev: savedCurr, campus_id: campusId });
        }
      }

      if (savedPrev > 0 && counterForm.printer_id) {
        const prevAdj = findAdjacent(counterForm.printer_id, counterForm.format, counterForm.color_mode, counterForm.formMonth, counterForm.formYear, -1);
        if (prevAdj && prevAdj.counter_curr === 0 && prevAdj.id) {
          await StorageService.savePrinterCounterRecord({ id: prevAdj.id, counter_curr: savedPrev, campus_id: campusId });
        }
      }

      setShowCounterForm(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar contador.');
    } finally {
      setSavingCounter(false);
    }
  };

  const handleDeleteCounter = async (id: string) => {
    if (!confirm('Deseja remover este registro de contador?')) return;
    setDeletingRecordId(id);
    try {
      await StorageService.deletePrinterCounterRecord(id);
      await loadData();
    } catch {
      alert('Erro ao excluir registro de contador.');
    } finally {
      setDeletingRecordId(null);
    }
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!printerForm.local_name.trim()) {
      alert('Nome Local é obrigatório.');
      return;
    }
    setSavingPrinter(true);
    try {
      await StorageService.savePrinterRegistry({
        ...(editingPrinter ? { id: editingPrinter.id } : {}),
        campus_id: campusId,
        local_name: printerForm.local_name.trim(),
        serial_number: printerForm.serial_number.trim() || undefined,
        ip_address: printerForm.ip_address.trim() || undefined,
        model: printerForm.model.trim() || undefined,
        supports_a4_mono: printerForm.supports_a4_mono,
        supports_a4_poli: printerForm.supports_a4_poli,
        supports_a3_mono: printerForm.supports_a3_mono,
        supports_a3_poli: printerForm.supports_a3_poli,
      });
      setShowPrinterModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar impressora.');
    } finally {
      setSavingPrinter(false);
    }
  };

  const handleDeletePrinter = async (id: string) => {
    if (!confirm('Deseja remover esta impressora do cadastro?')) return;
    setDeletingPrinterId(id);
    try {
      await StorageService.deletePrinterRegistry(id);
      await loadData();
    } catch {
      alert('Erro ao excluir impressora.');
    } finally {
      setDeletingPrinterId(null);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCfg(true);
    try {
      await StorageService.savePrinterBillingConfig(cfgDraft);
      setCfg(cfgDraft);
      setShowConfig(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSavingCfg(false);
    }
  };

  // Find record for same printer+format+color in an adjacent period
  const findAdjacent = (printerId: string, fmt: string, color: string, month: number, year: number, dir: -1 | 1) => {
    const d = new Date(year, month + dir, 1);
    const adjPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return records.find(r =>
      r.printer_id === printerId &&
      r.period === adjPeriod &&
      r.format === fmt &&
      r.color_mode === color
    );
  };

  const recalcCounterPrev = (printerId: string, fmt: string, color: string, month: number, year: number): number => {
    const prev = findAdjacent(printerId, fmt, color, month, year, -1);
    return prev ? prev.counter_curr : 0;
  };

  const recalcCounterCurr = (printerId: string, fmt: string, color: string, month: number, year: number, fallbackPrev: number): number => {
    const next = findAdjacent(printerId, fmt, color, month, year, 1);
    if (next && next.counter_prev > 0) return next.counter_prev;
    return fallbackPrev;
  };

  // Change of selected printer in counter record modal
  const handleSelectPrinter = (pId: string) => {
    const prn = printers.find(p => p.id === pId);
    if (!prn) {
      setCounterForm(f => ({
        ...f,
        printer_id: '',
        local_name: '',
        serial_number: '',
        ip_address: '',
        model: '',
      }));
      return;
    }

    // Determine first available type based on printer capabilities
    let defaultFormat: 'A4'|'A3' = 'A4';
    let defaultColor: 'MONO'|'POLI' = 'MONO';

    if (prn.supports_a4_mono) { defaultFormat = 'A4'; defaultColor = 'MONO'; }
    else if (prn.supports_a4_poli) { defaultFormat = 'A4'; defaultColor = 'POLI'; }
    else if (prn.supports_a3_mono) { defaultFormat = 'A3'; defaultColor = 'MONO'; }
    else if (prn.supports_a3_poli) { defaultFormat = 'A3'; defaultColor = 'POLI'; }

    const cPrev = recalcCounterPrev(prn.id || '', defaultFormat, defaultColor, counterForm.formMonth, counterForm.formYear);
    const cCurr = recalcCounterCurr(prn.id || '', defaultFormat, defaultColor, counterForm.formMonth, counterForm.formYear, cPrev);

    setCounterForm(f => ({
      ...f,
      printer_id: prn.id || '',
      local_name: prn.local_name,
      serial_number: prn.serial_number || '',
      ip_address: prn.ip_address || '',
      model: prn.model || '',
      format: defaultFormat,
      color_mode: defaultColor,
      counter_prev: cPrev,
      counter_curr: cCurr,
    }));
  };

  const prevMonth = () => { if (selMonth===0){setSelMonth(11);setSelYear(y=>y-1);}else setSelMonth(m=>m-1); };
  const nextMonth = () => { if (selMonth===11){setSelMonth(0);setSelYear(y=>y+1);}else setSelMonth(m=>m+1); };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const campus = campuses.find(c => c.id === campusId)?.name || campusId;
    doc.setFontSize(14); doc.text(`Conferência de NF — ${MONTHS[selMonth]}/${selYear}`, 14, 14);
    doc.setFontSize(10); doc.text(`Campus: ${campus}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [['Nome Local','N° Série','IP','Modelo','Formato','Cor','Cont. Ant.','Cont. Atual','Consumo','% Franquia']],
      body: records.map(r => {
        const consumo = Math.max(0,r.counter_curr-r.counter_prev);
        const fq = r.format==='A4'&&r.color_mode==='MONO'?cfg.a4_mono_franchise
          :r.format==='A4'&&r.color_mode==='POLI'?cfg.a4_poli_franchise
          :r.format==='A3'&&r.color_mode==='MONO'?cfg.a3_mono_franchise:cfg.a3_poli_franchise;
        const maxT = fq + (r.format==='A4'&&r.color_mode==='MONO'?cfg.a4_mono_excess_franchise
          :r.format==='A4'&&r.color_mode==='POLI'?cfg.a4_poli_excess_franchise
          :r.format==='A3'&&r.color_mode==='MONO'?cfg.a3_mono_excess_franchise:cfg.a3_poli_excess_franchise);
        const p = maxT>0?Math.round((consumo/maxT)*100):0;
        return [r.local_name, r.serial_number||'-', r.ip_address||'-', r.model||'-', r.format, r.color_mode,
          fmt(r.counter_prev), fmt(r.counter_curr), fmt(consumo), `${p}%`];
      }),
      styles: { fontSize: 8 },
    });
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11); doc.text('Resumo de Faturamento', 14, finalY);
    autoTable(doc, {
      startY: finalY + 4,
      head: [['Tipo','Total','Franquia','Exc. Max','Excedente Usado','Vlr. NF','Status']],
      body: [
        ['A4 Mono',fmt(billing.a4Mono.total),fmt(cfg.a4_mono_franchise),fmt(cfg.a4_mono_excess_franchise),fmt(billing.a4Mono.excess),BRL(billing.a4Mono.valueF+billing.a4Mono.valueE),billing.a4Mono.isBlocked?'BLOQUEADO':'OK'],
        ['A4 Poli',fmt(billing.a4Poli.total),fmt(cfg.a4_poli_franchise),fmt(cfg.a4_poli_excess_franchise),fmt(billing.a4Poli.excess),BRL(billing.a4Poli.valueF+billing.a4Poli.valueE),billing.a4Poli.isBlocked?'BLOQUEADO':'OK'],
        ['A3 Mono',fmt(billing.a3Mono.total),fmt(cfg.a3_mono_franchise),fmt(cfg.a3_mono_excess_franchise),fmt(billing.a3Mono.excess),BRL(billing.a3Mono.valueF+billing.a3Mono.valueE),billing.a3Mono.isBlocked?'BLOQUEADO':'OK'],
        ['A3 Poli',fmt(billing.a3Poli.total),fmt(cfg.a3_poli_franchise),fmt(cfg.a3_poli_excess_franchise),fmt(billing.a3Poli.excess),BRL(billing.a3Poli.valueF+billing.a3Poli.valueE),billing.a3Poli.isBlocked?'BLOQUEADO':'OK'],
      ],
      foot: [['TOTAL DA NF','','','','','',BRL(billing.totalValue)]],
      styles: { fontSize: 9 },
      footStyles: { fontStyle: 'bold', fillColor: [15,23,42], textColor: [255,255,255] },
    });
    doc.save(`NF-Impressao-${period}.pdf`);
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent';
  const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1';

  const cats = [
    { key:'a4Mono' as const, cfgKey:'a4_mono' as CatKey, label:'A4 Mono', dot:'bg-slate-500',  data:billing.a4Mono, franchise:cfg.a4_mono_franchise, excessFranchise:cfg.a4_mono_excess_franchise },
    { key:'a4Poli' as const, cfgKey:'a4_poli' as CatKey, label:'A4 Poli', dot:'bg-blue-500',   data:billing.a4Poli, franchise:cfg.a4_poli_franchise, excessFranchise:cfg.a4_poli_excess_franchise },
    { key:'a3Mono' as const, cfgKey:'a3_mono' as CatKey, label:'A3 Mono', dot:'bg-indigo-500', data:billing.a3Mono, franchise:cfg.a3_mono_franchise, excessFranchise:cfg.a3_mono_excess_franchise },
    { key:'a3Poli' as const, cfgKey:'a3_poli' as CatKey, label:'A3 Poli', dot:'bg-violet-500', data:billing.a3Poli, franchise:cfg.a3_poli_franchise, excessFranchise:cfg.a3_poli_excess_franchise },
  ];

  const cfgGroups = [
    { key:'a4_mono' as CatKey, label:'A4 Monocromático (P&B)' },
    { key:'a4_poli' as CatKey, label:'A4 Policromático (Colorido)' },
    { key:'a3_mono' as CatKey, label:'A3 Monocromático (P&B)' },
    { key:'a3_poli' as CatKey, label:'A3 Policromático (Colorido)' },
  ];

  // Helper to check if a specific printer supports a type
  const activePrinter = printers.find(p => p.id === counterForm.printer_id);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl shadow-lg ring-4 ring-white">
              <FileText size={26} className="text-white"/>
            </div>
            Conferência de NF
          </h1>
          <p className="mt-1 text-gray-500 font-medium">Contadores de impressoras · Franquia · Excedente · Bloqueio</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-sm hover:bg-gray-50 transition-all shadow-sm">
            <Download size={16}/> PDF
          </button>
          <button onClick={() => { setCfgDraft(cfg); setShowConfig(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-sm hover:bg-gray-50 transition-all shadow-sm">
            <Settings size={16}/> Configurar
          </button>
          <button onClick={() => setShowPrintersManager(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-sm hover:bg-gray-50 transition-all shadow-sm">
            <Printer size={16}/> Impressoras Cadastradas
          </button>
          <button onClick={openNewCounter} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all shadow-md">
            <Plus size={16}/> Novo Contador
          </button>
        </div>
      </div>

      {/* Period */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center justify-center gap-4">
          <button onClick={prevMonth} className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"><ChevronLeft size={20}/></button>
          <div className="px-10 py-3 bg-white rounded-2xl border border-gray-200 shadow-sm text-center min-w-[220px]">
            <span className="text-xl font-black text-slate-800">{MONTHS[selMonth]} {selYear}</span>
          </div>
          <button onClick={nextMonth} className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"><ChevronRight size={20}/></button>
        </div>
        {(() => {
          const sd = copyConfig?.start_day || 13;
          const ed = copyConfig?.end_day || 12;
          const s = new Date(selYear, selMonth, sd);
          const e = new Date(selYear, selMonth + 1, ed);
          return (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold italic">
              <Calendar size={13} />
              Período: {s.toLocaleDateString()} — {e.toLocaleDateString()}
            </div>
          );
        })()}
      </div>

      {/* Global BLOCKED alert */}
      {billing.anyBlocked && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-400 rounded-2xl text-red-800 animate-pulse">
          <Ban size={24} className="shrink-0 text-red-600"/>
          <div>
            <p className="font-black text-base">⚠ LIMITE DE IMPRESSÃO ATINGIDO</p>
            <p className="text-sm font-medium">Um ou mais tipos de impressão ultrapassaram o teto de excedente. A impressão deve ser bloqueada imediatamente.</p>
          </div>
        </div>
      )}

      {/* ── FRANCHISE CHART ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-600"/> Uso da Franquia e Excedente
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5"><span className="w-8 h-3 rounded bg-emerald-500 inline-block"/>Franquia usada</span>
            <span className="flex items-center gap-1.5"><span className="w-8 h-3 rounded bg-orange-400 inline-block"/>Excedente usado</span>
            <span className="flex items-center gap-1.5"><span className="w-8 h-3 rounded bg-red-100 inline-block border border-red-300"/>Zona de bloqueio</span>
            <span className="flex items-center gap-1.5 text-gray-400">│ branco = limite franquia</span>
          </div>
        </div>
        <div className="p-6 space-y-7">
          {cats.map(cat => (
            <FranchiseBar
              key={cat.key}
              label={cat.label}
              used={cat.data.total}
              franchise={cat.franchise}
              excessFranchise={cat.excessFranchise}
              dot={cat.dot}
            />
          ))}
        </div>

        {/* Radial gauges */}
        <div className="px-6 pb-6 border-t border-gray-50 pt-4">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">% do Total Máximo Usado (Franquia + Excedente)</p>
          <div className="flex flex-wrap justify-around gap-4">
            {cats.map(cat => (
              <RadialGauge
                key={cat.key}
                used={cat.data.total}
                franchise={cat.franchise}
                excessFranchise={cat.excessFranchise}
                label={cat.label}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cats.map(cat => {
          const blocked = cat.data.isBlocked;
          return (
            <div key={cat.key} className={`rounded-2xl border shadow-sm p-4 space-y-1 ${blocked ? 'bg-red-50 border-red-300' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${cat.dot}`}/>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500">{cat.label}</p>
                </div>
                {blocked && <Ban size={14} className="text-red-600"/>}
              </div>
              <p className={`text-2xl font-black ${blocked ? 'text-red-700' : 'text-gray-800'}`}>{fmt(cat.data.total)}</p>
              <p className="text-xs text-gray-400 font-medium">pág. consumidas</p>
              <p className="text-xs text-gray-400">Franquia: <strong>{fmt(cat.franchise)}</strong> + Exc.max: <strong>{fmt(cat.excessFranchise)}</strong></p>
              <p className="text-base font-bold text-gray-700">{BRL(cat.data.valueF + cat.data.valueE)}</p>
              {cat.data.excess > 0 && (
                <p className={`text-xs font-semibold flex items-center gap-1 ${blocked ? 'text-red-600' : 'text-orange-500'}`}>
                  {blocked ? <Ban size={10}/> : <AlertCircle size={10}/>}
                  {fmt(cat.data.excess)} pág. excedentes
                </p>
              )}
            </div>
          );
        })}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-lg p-4 text-white space-y-1">
          <p className="text-xs font-black uppercase tracking-widest opacity-60">Valor Total NF</p>
          <p className="text-2xl font-black">{BRL(billing.totalValue)}</p>
          {billing.totalExcess > 0 && (
            <p className="text-xs opacity-70 flex items-center gap-1">
              <AlertCircle size={10}/> +{fmt(billing.totalExcess)} exc.
            </p>
          )}
        </div>
      </div>

      {/* Excess Warning */}
      {billing.totalExcess > 0 && !billing.anyBlocked && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
          <AlertTriangle size={20} className="shrink-0"/>
          <span className="font-semibold text-sm">
            Cobrança de excedente: <strong>{fmt(billing.totalExcess)} páginas</strong> acima da franquia →
            custo adicional de <strong>{BRL(billing.excessValue)}</strong>
          </span>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2"><Printer size={18} className="text-slate-600"/> Contadores de Impressoras</h2>
          <span className="text-sm text-gray-400 font-medium">{records.length} lançamento{records.length!==1?'s':''}</span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-slate-600" size={40}/>
            <p className="text-gray-500 font-medium">Carregando...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Printer size={48} strokeWidth={1}/>
            <p className="font-medium">Nenhum contador para este período.</p>
            <button onClick={openNewCounter} className="mt-2 flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-all">
              <Plus size={14}/> Novo Lançamento
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-400 text-xs font-black uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-4">Nome Local</th>
                  <th className="px-5 py-4">N° Série</th>
                  <th className="px-5 py-4">IP</th>
                  <th className="px-5 py-4">Modelo</th>
                  <th className="px-5 py-4 text-center">Formato</th>
                  <th className="px-5 py-4 text-center">Cor</th>
                  <th className="px-5 py-4 text-right">Ant.</th>
                  <th className="px-5 py-4 text-right">Atual</th>
                  <th className="px-5 py-4 text-right">Consumo</th>
                  <th className="px-5 py-4 text-right">Status</th>
                  <th className="px-5 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const consumo = Math.max(0, r.counter_curr - r.counter_prev);
                  const catMap = {
                    'A4-MONO': { fq: cfg.a4_mono_franchise, ef: cfg.a4_mono_excess_franchise },
                    'A4-POLI': { fq: cfg.a4_poli_franchise, ef: cfg.a4_poli_excess_franchise },
                    'A3-MONO': { fq: cfg.a3_mono_franchise, ef: cfg.a3_mono_excess_franchise },
                    'A3-POLI': { fq: cfg.a3_poli_franchise, ef: cfg.a3_poli_excess_franchise },
                  };
                  const { fq, ef } = catMap[`${r.format}-${r.color_mode}` as keyof typeof catMap] || { fq:1, ef:0 };
                  const maxT = fq + ef;
                  const p = maxT > 0 ? Math.min(100, Math.round((consumo / maxT) * 100)) : 0;
                  const rowBlocked = consumo > maxT;
                  const rowExcess  = !rowBlocked && consumo > fq;

                  return (
                    <tr key={r.id} className={`border-t border-gray-50 transition-colors ${rowBlocked ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-5 py-4 font-bold text-gray-800">{r.local_name}</td>
                      <td className="px-5 py-4 text-gray-500 font-mono text-xs">{r.serial_number||'—'}</td>
                      <td className="px-5 py-4 text-gray-500 font-mono text-xs">{r.ip_address||'—'}</td>
                      <td className="px-5 py-4 text-gray-700">{r.model||'—'}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">{r.format}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${r.color_mode==='MONO'?'bg-gray-100 text-gray-700':'bg-blue-50 text-blue-700'}`}>{r.color_mode}</span>
                      </td>
                      <td className="px-5 py-4 text-right text-gray-500 font-mono">{fmt(r.counter_prev)}</td>
                      <td className="px-5 py-4 text-right text-gray-500 font-mono">{fmt(r.counter_curr)}</td>
                      <td className="px-5 py-4 text-right font-black text-slate-800 font-mono">{fmt(consumo)}</td>
                      <td className="px-5 py-4 text-right">
                        {rowBlocked
                          ? <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-black rounded-lg"><Ban size={10}/>BLOQUEADO</span>
                          : rowExcess
                          ? <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 text-xs font-black rounded-lg"><AlertCircle size={10}/>EXCEDENTE {p}%</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg"><CheckCircle2 size={10}/>{p}%</span>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEditCounter(r)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"><Pencil size={14}/></button>
                          <button onClick={() => handleDeleteCounter(r.id)} disabled={deletingRecordId===r.id} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-40">
                            {deletingRecordId===r.id ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-800 text-white">
                <tr>
                  <td colSpan={8} className="px-5 py-4 font-black text-right text-sm uppercase tracking-widest">Total Consumo</td>
                  <td className="px-5 py-4 text-right font-black text-xl font-mono">
                    {fmt(records.reduce((s,r) => s+Math.max(0,r.counter_curr-r.counter_prev),0))}
                  </td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Billing Detail */}
      {records.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><DollarSign size={18} className="text-emerald-600"/> Detalhamento de Faturamento</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-400 text-xs font-black uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-4">Tipo</th>
                  <th className="px-5 py-4 text-right">Total Pág.</th>
                  <th className="px-5 py-4 text-right">Franquia</th>
                  <th className="px-5 py-4 text-right">Teto Excedente</th>
                  <th className="px-5 py-4 text-right">Pág. Excedentes</th>
                  <th className="px-5 py-4 text-right">Vlr. Franquia</th>
                  <th className="px-5 py-4 text-right">Vlr. Excedente</th>
                  <th className="px-5 py-4 text-right">Total NF</th>
                  <th className="px-5 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label:'A4 Monocromático', data:billing.a4Mono, franchise:cfg.a4_mono_franchise, ef:cfg.a4_mono_excess_franchise },
                  { label:'A4 Policromático', data:billing.a4Poli, franchise:cfg.a4_poli_franchise, ef:cfg.a4_poli_excess_franchise },
                  { label:'A3 Monocromático', data:billing.a3Mono, franchise:cfg.a3_mono_franchise, ef:cfg.a3_mono_excess_franchise },
                  { label:'A3 Policromático', data:billing.a3Poli, franchise:cfg.a3_poli_franchise, ef:cfg.a3_poli_excess_franchise },
                ].map(({ label, data, franchise, ef }) => (
                  <tr key={label} className={`border-t border-gray-50 ${data.isBlocked?'bg-red-50':''}`}>
                    <td className="px-5 py-4 font-semibold text-gray-800">{label}</td>
                    <td className="px-5 py-4 text-right font-mono">{fmt(data.total)}</td>
                    <td className="px-5 py-4 text-right font-mono text-gray-400">{fmt(franchise)}</td>
                    <td className="px-5 py-4 text-right font-mono text-orange-500 font-bold">{fmt(ef)}</td>
                    <td className="px-5 py-4 text-right font-mono">
                      {data.excess>0 ? <span className="text-orange-600 font-bold">{fmt(data.excess)}</span> : <span className="text-emerald-600">0</span>}
                    </td>
                    <td className="px-5 py-4 text-right font-mono">{BRL(data.valueF)}</td>
                    <td className="px-5 py-4 text-right font-mono">
                      {data.valueE>0 ? <span className="text-orange-600 font-bold">{BRL(data.valueE)}</span> : BRL(0)}
                    </td>
                    <td className="px-5 py-4 text-right font-black font-mono">{BRL(data.valueF+data.valueE)}</td>
                    <td className="px-5 py-4 text-center">
                      {data.isBlocked
                        ? <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-black rounded-lg"><Ban size={10}/>BLOQUEADO</span>
                        : data.excess>0
                        ? <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 text-xs font-bold rounded-lg"><AlertCircle size={10}/>EXCEDENTE</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-lg"><CheckCircle2 size={10}/>OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900 text-white">
                <tr>
                  <td colSpan={7} className="px-5 py-4 font-black text-right uppercase tracking-widest text-sm">Valor Total da NF</td>
                  <td className="px-5 py-4 text-right font-black text-2xl font-mono">{BRL(billing.totalValue)}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Novo Contador (Leitura) ───────────────────────────────────── */}
      <Modal isOpen={showCounterForm} onClose={() => setShowCounterForm(false)} title={editingRecord ? 'Editar Lançamento' : 'Novo Lançamento de Contador'}>
        <form onSubmit={handleSaveCounter} className="space-y-4 p-1">
          {editingRecord && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-semibold">
              <AlertCircle size={16} className="shrink-0"/>
              Este registro já foi salvo e não pode ser alterado.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Período (Competência) *</label>
              <div className="flex items-center gap-2">
                <button type="button" disabled={!!editingRecord} onClick={() => setCounterForm(f => {
                  const nm = f.formMonth === 0 ? 11 : f.formMonth - 1;
                  const ny = f.formMonth === 0 ? f.formYear - 1 : f.formYear;
                  const cp = recalcCounterPrev(f.printer_id, f.format, f.color_mode, nm, ny);
                  const cc = recalcCounterCurr(f.printer_id, f.format, f.color_mode, nm, ny, cp);
                  return {...f, formMonth: nm, formYear: ny, counter_prev: cp, counter_curr: cc};
                })} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft size={16}/></button>
                <select className={`${inputCls} ${editingRecord ? 'bg-gray-50' : ''}`} disabled={!!editingRecord} value={counterForm.formMonth} onChange={e => {
                  const nm = Number(e.target.value);
                  setCounterForm(f => {
                    const cp = recalcCounterPrev(f.printer_id, f.format, f.color_mode, nm, f.formYear);
                    const cc = recalcCounterCurr(f.printer_id, f.format, f.color_mode, nm, f.formYear, cp);
                    return {...f, formMonth: nm, counter_prev: cp, counter_curr: cc};
                  });
                }}>
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select className={`${inputCls} ${editingRecord ? 'bg-gray-50' : ''}`} disabled={!!editingRecord} value={counterForm.formYear} onChange={e => {
                  const ny = Number(e.target.value);
                  setCounterForm(f => {
                    const cp = recalcCounterPrev(f.printer_id, f.format, f.color_mode, f.formMonth, ny);
                    const cc = recalcCounterCurr(f.printer_id, f.format, f.color_mode, f.formMonth, ny, cp);
                    return {...f, formYear: ny, counter_prev: cp, counter_curr: cc};
                  });
                }}>
                  {Array.from({length: 10}, (_, i) => {
                    const y = new Date().getFullYear() - 5 + i;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
                <button type="button" disabled={!!editingRecord} onClick={() => setCounterForm(f => {
                  const nm = f.formMonth === 11 ? 0 : f.formMonth + 1;
                  const ny = f.formMonth === 11 ? f.formYear + 1 : f.formYear;
                  const cp = recalcCounterPrev(f.printer_id, f.format, f.color_mode, nm, ny);
                  const cc = recalcCounterCurr(f.printer_id, f.format, f.color_mode, nm, ny, cp);
                  return {...f, formMonth: nm, formYear: ny, counter_prev: cp, counter_curr: cc};
                })} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight size={16}/></button>
              </div>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Impressora (Nome Local) *</label>
              {editingRecord ? (
                <input disabled className={`${inputCls} bg-gray-50`} value={counterForm.local_name} />
              ) : (
                <select required className={inputCls} value={counterForm.printer_id} onChange={e => handleSelectPrinter(e.target.value)}>
                  <option value="">Selecione uma impressora...</option>
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>{p.local_name}{p.ip_address ? ` — ${p.ip_address}` : ''}</option>
                  ))}
                </select>
              )}
            </div>

            {counterForm.local_name && (
              <>
                <div className="col-span-2 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs text-gray-500">
                  <p className="font-bold text-gray-700">Dados Técnicos Cadastrados:</p>
                  <p>Número de Série: <strong className="text-gray-600 font-mono">{counterForm.serial_number || 'Não informado'}</strong></p>
                  <p>IP: <strong className="text-gray-600 font-mono">{counterForm.ip_address || 'Não informado'}</strong></p>
                  <p>Modelo: <strong className="text-gray-600">{counterForm.model || 'Não informado'}</strong></p>
                </div>

                <div>
                  <label className={labelCls}>Formato *</label>
                  <select required className={`${inputCls} ${editingRecord ? 'bg-gray-50' : ''}`} disabled={!!editingRecord} value={counterForm.format} onChange={e => {
                    const newFmt = e.target.value as 'A4'|'A3';
                    const cPrev = recalcCounterPrev(counterForm.printer_id, newFmt, counterForm.color_mode, counterForm.formMonth, counterForm.formYear);
                    const cCurr = recalcCounterCurr(counterForm.printer_id, newFmt, counterForm.color_mode, counterForm.formMonth, counterForm.formYear, cPrev);
                    setCounterForm(f=>({...f, format:newFmt, counter_prev: cPrev, counter_curr: cCurr }));
                  }}>
                    {activePrinter?.supports_a4_mono || activePrinter?.supports_a4_poli || !activePrinter ? <option value="A4">A4</option> : null}
                    {activePrinter?.supports_a3_mono || activePrinter?.supports_a3_poli || !activePrinter ? <option value="A3">A3</option> : null}
                  </select>
                </div>
                
                <div>
                  <label className={labelCls}>Cor *</label>
                  <select required className={`${inputCls} ${editingRecord ? 'bg-gray-50' : ''}`} disabled={!!editingRecord} value={counterForm.color_mode} onChange={e => {
                    const newColor = e.target.value as 'MONO'|'POLI';
                    const cPrev = recalcCounterPrev(counterForm.printer_id, counterForm.format, newColor, counterForm.formMonth, counterForm.formYear);
                    const cCurr = recalcCounterCurr(counterForm.printer_id, counterForm.format, newColor, counterForm.formMonth, counterForm.formYear, cPrev);
                    setCounterForm(f=>({...f, color_mode:newColor, counter_prev: cPrev, counter_curr: cCurr }));
                  }}>
                    {(counterForm.format === 'A4' && (activePrinter?.supports_a4_mono || !activePrinter)) || 
                     (counterForm.format === 'A3' && (activePrinter?.supports_a3_mono || !activePrinter)) ? (
                      <option value="MONO">MONO (Preto e Branco)</option>
                    ) : null}
                    {(counterForm.format === 'A4' && (activePrinter?.supports_a4_poli || !activePrinter)) || 
                     (counterForm.format === 'A3' && (activePrinter?.supports_a3_poli || !activePrinter)) ? (
                      <option value="POLI">POLI (Colorido)</option>
                    ) : null}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Contador Mês Anterior *</label>
                  <div className="flex items-center gap-2">
                    <input required type="number" min={0} className={`${inputCls} bg-gray-100`} disabled value={counterForm.counter_prev} onChange={e => setCounterForm(f=>({...f,counter_prev:Number(e.target.value)}))}/>
                    {(() => {
                      const prev = findAdjacent(counterForm.printer_id, counterForm.format, counterForm.color_mode, counterForm.formMonth, counterForm.formYear, -1);
                      if (prev) {
                        const d = new Date(counterForm.formYear, counterForm.formMonth - 1, 1);
                        return <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">herdado de {MONTHS[d.getMonth()]}/{d.getFullYear()}</span>;
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Contador Mês Atual *</label>
                  <div className="flex items-center gap-2">
                    <input required type="number" min={0} className={`${inputCls} ${editingRecord ? 'bg-gray-50' : ''}`} disabled={!!editingRecord} value={counterForm.counter_curr} onChange={e => setCounterForm(f=>({...f,counter_curr:Number(e.target.value)}))}/>
                    {(() => {
                      const next = findAdjacent(counterForm.printer_id, counterForm.format, counterForm.color_mode, counterForm.formMonth, counterForm.formYear, 1);
                      if (next && next.counter_prev > 0 && next.counter_prev === counterForm.counter_curr && !editingRecord) {
                        const d = new Date(counterForm.formYear, counterForm.formMonth + 1, 1);
                        return <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">herdado de {MONTHS[d.getMonth()]}/{d.getFullYear()}</span>;
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>

          {counterForm.local_name && counterForm.counter_curr >= counterForm.counter_prev && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-slate-700 text-sm font-semibold border border-slate-200">
              <CheckCircle2 size={16} className="text-emerald-500"/>
              Consumo: <strong>{fmt(counterForm.counter_curr - counterForm.counter_prev)} páginas</strong>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCounterForm(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">Cancelar</button>
            <button type="submit" disabled={savingCounter || !counterForm.local_name} className="px-6 py-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 transition-all disabled:opacity-50 flex items-center gap-2">
              {savingCounter ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
              {editingRecord ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Gerenciar Impressoras ─────────────────────────────────────── */}
      <Modal isOpen={showPrintersManager} onClose={() => setShowPrintersManager(false)} title="Impressoras Cadastradas">
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500 font-medium">Cadastre aqui as impressoras com o Nome Local de sua rede.</p>
            <button onClick={openNewPrinter} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-all">
              <Plus size={12}/> Nova Impressora
            </button>
          </div>

          {printers.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              Nenhuma impressora cadastrada.
            </div>
          ) : (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase">
                  <tr>
                    <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-100/80 transition-colors" onClick={() => handleSort('local_name')}>
                      <div className="flex items-center gap-1">
                        Nome Local
                        {sortField === 'local_name' ? (
                          sortDirection === 'asc' ? <ArrowUp size={12} className="text-slate-700" /> : <ArrowDown size={12} className="text-slate-700" />
                        ) : (
                          <ArrowUpDown size={12} className="text-gray-300" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-100/80 transition-colors" onClick={() => handleSort('serial_number')}>
                      <div className="flex items-center gap-1">
                        N° Série
                        {sortField === 'serial_number' ? (
                          sortDirection === 'asc' ? <ArrowUp size={12} className="text-slate-700" /> : <ArrowDown size={12} className="text-slate-700" />
                        ) : (
                          <ArrowUpDown size={12} className="text-gray-300" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3">Formatos/Cores</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedPrinters.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-gray-800">{p.local_name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono">{p.serial_number || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.supports_a4_mono && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-bold">A4 Mono</span>}
                          {p.supports_a4_poli && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">A4 Color</span>}
                          {p.supports_a3_mono && <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">A3 Mono</span>}
                          {p.supports_a3_poli && <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[10px] font-bold">A3 Color</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditPrinter(p)} className="p-1 rounded hover:bg-slate-100 text-slate-600"><Pencil size={12}/></button>
                          <button onClick={() => handleDeletePrinter(p.id!)} disabled={deletingPrinterId===p.id} className="p-1 rounded hover:bg-red-50 text-red-500">
                            {deletingPrinterId===p.id ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button onClick={() => setShowPrintersManager(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200">Fechar</button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Cadastrar/Editar Impressora ────────────────────────────────── */}
      <Modal isOpen={showPrinterModal} onClose={() => setShowPrinterModal(false)} title={editingPrinter ? 'Editar Impressora' : 'Cadastrar Impressora'}>
        <form onSubmit={handleSavePrinter} className="space-y-4 p-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Nome Local *</label>
              <input required className={inputCls} value={printerForm.local_name} onChange={e => setPrinterForm(f=>({...f,local_name:e.target.value}))} placeholder="Ex: CMIMPADM15"/>
            </div>
            <div>
              <label className={labelCls}>Número de Série</label>
              <input className={inputCls} value={printerForm.serial_number} onChange={e => setPrinterForm(f=>({...f,serial_number:e.target.value}))} placeholder="Ex: HST3800216"/>
            </div>
            <div>
              <label className={labelCls}>IP da Impressora</label>
              <input className={inputCls} value={printerForm.ip_address} onChange={e => setPrinterForm(f=>({...f,ip_address:e.target.value}))} placeholder="Ex: 192.168.33.17"/>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Modelo</label>
              <input className={inputCls} value={printerForm.model} onChange={e => setPrinterForm(f=>({...f,model:e.target.value}))} placeholder="Ex: TASKalfa 2554ci"/>
            </div>

            <div className="col-span-2 space-y-2 border-t border-gray-100 pt-3">
              <label className={labelCls}>Formatos e Cores Suportados *</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input type="checkbox" checked={printerForm.supports_a4_mono} onChange={e => setPrinterForm(f=>({...f,supports_a4_mono:e.target.checked}))} className="rounded border-gray-300 text-slate-800 focus:ring-slate-500 w-4 h-4"/>
                  A4 Monocromático
                </label>
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input type="checkbox" checked={printerForm.supports_a4_poli} onChange={e => setPrinterForm(f=>({...f,supports_a4_poli:e.target.checked}))} className="rounded border-gray-300 text-slate-800 focus:ring-slate-500 w-4 h-4"/>
                  A4 Colorido (Poli)
                </label>
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input type="checkbox" checked={printerForm.supports_a3_mono} onChange={e => setPrinterForm(f=>({...f,supports_a3_mono:e.target.checked}))} className="rounded border-gray-300 text-slate-800 focus:ring-slate-500 w-4 h-4"/>
                  A3 Monocromático
                </label>
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-gray-700 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input type="checkbox" checked={printerForm.supports_a3_poli} onChange={e => setPrinterForm(f=>({...f,supports_a3_poli:e.target.checked}))} className="rounded border-gray-300 text-slate-800 focus:ring-slate-500 w-4 h-4"/>
                  A3 Colorido (Poli)
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowPrinterModal(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">Cancelar</button>
            <button type="submit" disabled={savingPrinter} className="px-6 py-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 transition-all disabled:opacity-50 flex items-center gap-2">
              {savingPrinter ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Configuração ──────────────────────────────────────────────── */}
      <Modal isOpen={showConfig} onClose={() => setShowConfig(false)} title="Configuração de Franquias e Valores">
        <form onSubmit={handleSaveConfig} className="space-y-4 p-1">
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl text-blue-700 text-xs">
            <InfoIcon size={14} className="shrink-0 mt-0.5"/>
            <span><strong>Franquia:</strong> páginas inclusas no contrato. <strong>Teto excedente:</strong> máximo de páginas extras permitidas — após atingir, a impressão é bloqueada. <strong>R$/pág.:</strong> valor para cálculo da NF.</span>
          </div>

          {cfgGroups.map(({ key, label }) => (
            <div key={key} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h3 className="font-bold text-gray-800 text-sm mb-3">{label}</h3>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className={labelCls}>Franquia (pág. inclusas) *</label>
                  <input type="number" min={0} className={inputCls}
                    value={(cfgDraft as any)[`${key}_franchise`]}
                    onChange={e => setCfgDraft(d => ({...d, [`${key}_franchise`]: Number(e.target.value)}))}/>
                </div>
                <div>
                  <label className={`${labelCls} text-orange-600`}>Teto Excedente (pág. máx. extra) *</label>
                  <input type="number" min={0} className={`${inputCls} border-orange-200 focus:ring-orange-400`}
                    value={(cfgDraft as any)[`${key}_excess_franchise`]}
                    onChange={e => setCfgDraft(d => ({...d, [`${key}_excess_franchise`]: Number(e.target.value)}))}/>
                  <p className="text-xs text-orange-500 mt-1 font-semibold">Após atingir: impressão bloqueada</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>R$/pág. Franquia</label>
                  <input type="number" min={0} step={0.0001} className={inputCls}
                    value={(cfgDraft as any)[`${key}_price_franchise`]}
                    onChange={e => setCfgDraft(d => ({...d, [`${key}_price_franchise`]: Number(e.target.value)}))}/>
                </div>
                <div>
                  <label className={labelCls}>R$/pág. Excedente</label>
                  <input type="number" min={0} step={0.0001} className={inputCls}
                    value={(cfgDraft as any)[`${key}_price_excess`]}
                    onChange={e => setCfgDraft(d => ({...d, [`${key}_price_excess`]: Number(e.target.value)}))}/>
                </div>
              </div>
              {/* Live summary */}
              <div className="mt-3 p-2 bg-white rounded-lg border border-gray-200 text-xs text-gray-500 flex items-center justify-between">
                <span>Total máximo permitido:</span>
                <strong className="text-gray-800 text-sm">
                  {fmt((cfgDraft as any)[`${key}_franchise`] + (cfgDraft as any)[`${key}_excess_franchise`])} páginas
                </strong>
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowConfig(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">Cancelar</button>
            <button type="submit" disabled={savingCfg} className="px-6 py-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 transition-all disabled:opacity-50 flex items-center gap-2">
              {savingCfg ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
              Salvar Configurações
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PrinterNFTab;
