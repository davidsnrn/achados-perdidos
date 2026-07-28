import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Material, MaterialLoan } from '../types-materiais';
import { Campus, Setor } from '../types';
import { StorageService, supabase } from '../services/storage';
import { 
  Lock, ArrowRight, ArrowLeft, CheckCircle, Package, RefreshCw, 
  User as UserIcon, ShieldCheck, Check, AlertCircle, LogOut, Loader2, Sparkles, Building2, Layers,
  ShoppingBag, Trash2, Search, X, ChevronRight, Clock, Box
} from 'lucide-react';
import { Modal } from './ui/Modal';

interface Props {
  materials: Material[];
  loans: MaterialLoan[];
  campuses: Campus[];
  setores: Setor[];
  onUpdate: () => Promise<void>;
  onExitKiosk?: () => void;
}

const stripCodePrefix = (code: string): string => {
  if (!code) return '';
  const parts = code.split('-');
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? last : code;
};

export const SelfServiceKiosk: React.FC<Props> = ({
  materials,
  loans,
  campuses: campusesProp,
  setores: setoresProp,
  onUpdate,
  onExitKiosk
}) => {
  const [campuses, setCampuses] = useState<Campus[]>(campusesProp);
  const [setores, setSetores] = useState<Setor[]>(setoresProp);

  useEffect(() => {
    if (campusesProp.length > 0) setCampuses(campusesProp);
  }, [campusesProp]);

  useEffect(() => {
    if (setoresProp.length > 0) setSetores(setoresProp);
  }, [setoresProp]);

  useEffect(() => {
    if (campuses.length === 0) {
      StorageService.getCampuses().then(setCampuses).catch(() => {});
    }
    if (setores.length === 0) {
      StorageService.getSetores().then(setSetores).catch(() => {});
    }
  }, []);

  const [isTerminalUnlocked, setIsTerminalUnlocked] = useState(false);
  const [terminalCodeInput, setTerminalCodeInput] = useState('');
  const [terminalError, setTerminalError] = useState('');

  const [activeCampusId, setActiveCampusId] = useState<string>('');
  const [activeSetorId, setActiveSetorId] = useState<string>('');

  const [mode, setMode] = useState<'HOME' | 'SUCCESS'>('HOME');
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [showCheckoutDrawer, setShowCheckoutDrawer] = useState(false);

  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authenticatedUser, setAuthenticatedUser] = useState<{
    name: string;
    matricula: string;
    email?: string;
  } | null>(null);

  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [pendingCartIds, setPendingCartIds] = useState<string[]>([]);
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const [kioskMaterials, setKioskMaterials] = useState<Material[]>([]);
  const [kioskLoans, setKioskLoans] = useState<MaterialLoan[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  const ensureSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return;
    const email = 'kiosk@sistema.local';
    const password = 'kiosk123';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        console.warn('[ensureSession] Não foi possível estabelecer sessão:', signUpError.message);
      }
    }
  }, []);

  useEffect(() => {
    ensureSession().finally(() => setIsInitializing(false));
  }, [ensureSession]);

  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  useEffect(() => {
    setSelectedMaterialIds([]);
    setSelectedLoanIds([]);
  }, [mode]);

  useEffect(() => {
    if (activeSetorId) {
      StorageService.getMaterials(undefined, activeSetorId)
        .then(setKioskMaterials)
        .catch(err => console.warn('Erro ao buscar materiais para o kiosk:', err));
    }
  }, [activeSetorId]);

  useEffect(() => {
    if (!authenticatedUser || !(activeCampusId || activeSetorId)) return;
    const sectorId = activeSetorId || undefined;
    const campusId = activeCampusId || undefined;

    const refreshLoans = () =>
      StorageService.getMaterialLoans(campusId, sectorId)
        .then(setKioskLoans)
        .catch(err => console.warn('Erro ao buscar empréstimos:', err));

    refreshLoans();
    const channel = supabase.channel('kiosk-loans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_loans' }, refreshLoans)
      .subscribe();

    const pollInterval = setInterval(refreshLoans, 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [authenticatedUser, activeCampusId, activeSetorId]);

  const effectiveMaterials = useMemo(() => {
    return kioskMaterials.length > 0 ? kioskMaterials : materials;
  }, [kioskMaterials, materials]);

  const effectiveLoans = useMemo(() => {
    return kioskLoans.length > 0 ? kioskLoans : loans;
  }, [kioskLoans, loans]);

  const refreshKioskData = useCallback(async () => {
    try {
      const [fetchedMaterials, fetchedLoans] = await Promise.all([
        StorageService.getMaterials(activeCampusId || undefined, activeSetorId || undefined),
        StorageService.getMaterialLoans(activeCampusId || undefined, activeSetorId || undefined)
      ]);
      setKioskMaterials(fetchedMaterials);
      setKioskLoans(fetchedLoans);
    } catch (err) {
      console.warn('Erro ao recarregar dados do kiosk:', err);
    }
  }, [activeCampusId, activeSetorId]);

  useEffect(() => {
    localStorage.removeItem('sigae_kiosk_config');
  }, []);

  useEffect(() => {
    const checkKioskActive = async () => {
      const localEnabled = localStorage.getItem('sigae_kiosk_enabled');
      if (!localEnabled && isTerminalUnlocked) {
        const setorId = activeSetorId || localStorage.getItem('sigae_kiosk_setor_id');
        if (setorId) {
          try {
            const { data } = await supabase.from('setores').select('kiosk_code').eq('id', setorId).single();
            if (data?.kiosk_code) return;
          } catch { }
        }
        localStorage.removeItem('sigae_kiosk_config');
        setIsTerminalUnlocked(false);
      }
    };
    checkKioskActive();
    const interval = setInterval(checkKioskActive, 5000);
    return () => clearInterval(interval);
  }, [isTerminalUnlocked, activeSetorId]);

  const handleUnlockTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    setTerminalError('');
    const code = terminalCodeInput.trim();
    if (!code) {
      setTerminalError('Digite o código de validação.');
      return;
    }

    try {
      const { data: matchedSetores, error: errSetor } = await supabase
        .from('setores')
        .select('id, campus_id, name')
        .ilike('kiosk_code', code);
      if (errSetor) throw errSetor;
      if (matchedSetores && matchedSetores.length > 0) {
        const matched = matchedSetores[0];
        setActiveCampusId(matched.campus_id);
        setActiveSetorId(matched.id);
        setIsTerminalUnlocked(true);
        setTerminalCodeInput('');
        await loadKioskData(matched.campus_id, matched.id);
        return;
      }

      const { data: matchedCampuses, error: errCampus } = await supabase
        .from('campuses')
        .select('id')
        .ilike('kiosk_code', code);
      if (errCampus) throw errCampus;
      if (matchedCampuses && matchedCampuses.length > 0) {
        const matched = matchedCampuses[0];
        setActiveCampusId(matched.id);
        setActiveSetorId('');
        setIsTerminalUnlocked(true);
        setTerminalCodeInput('');
        await loadKioskData(matched.id, '');
        return;
      }

      const rawSectorId = localStorage.getItem('sigae_kiosk_setor_id');
      const rawCampusId = localStorage.getItem('sigae_kiosk_campus_id');
      const storedCode = localStorage.getItem('sigae_active_kiosk_code');
      if ((rawSectorId || rawCampusId) && storedCode?.toUpperCase() === code.toUpperCase()) {
        setActiveCampusId(rawCampusId || '');
        setActiveSetorId(rawSectorId || '');
        setIsTerminalUnlocked(true);
        setTerminalCodeInput('');
        await loadKioskData(rawCampusId || '', rawSectorId || '');
        return;
      }

      setTerminalError('Código do terminal/setor inválido.');
    } catch (err) {
      setTerminalError('Erro ao validar código.');
    }
  };

  const loadKioskData = async (campusId: string, setorId: string) => {
    try {
      await ensureSession();
      let fetchedMaterials: Material[];
      const setor = setorId || undefined;
      const campus = campusId || undefined;
      if (setor) {
        fetchedMaterials = await StorageService.getMaterials(undefined, setor);
      } else if (campus) {
        fetchedMaterials = await StorageService.getMaterials(campus, undefined);
      } else {
        fetchedMaterials = [];
      }
      const fetchedLoans = await StorageService.getMaterialLoans(campus, setor);
      setKioskMaterials(fetchedMaterials);
      setKioskLoans(fetchedLoans);
    } catch (err) {
      console.warn('Erro ao carregar dados do kiosk:', err);
    }
  };

  const handleLockTerminal = () => {
    if (confirm('Deseja bloquear este terminal de autoatendimento?')) {
      setIsTerminalUnlocked(false);
      setAuthenticatedUser(null);
      setPendingCartIds([]);
      setSelectedMaterialIds([]);
      setSelectedLoanIds([]);
      setMode('HOME');
    }
  };

  const handleSuapAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!matricula.trim() || !password.trim()) {
      setAuthError('Informe a matrícula e a senha.');
      return;
    }

    setIsAuthenticating(true);
    try {
      const res = await fetch('https://suap.ifrn.edu.br/api/token/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: matricula.trim(), password })
      });
      if (!res.ok) throw new Error('Credenciais do SUAP inválidas.');
      const data = await res.json();
      const userRes = await fetch('https://suap.ifrn.edu.br/api/rh/meus-dados/', {
        headers: { Authorization: `Bearer ${data.access}` }
      });
      if (!userRes.ok) throw new Error('Falha ao carregar dados do SUAP.');
      const userData = await userRes.json();
      setAuthenticatedUser({
        name: userData.nome_usual || userData.nome || 'Usuário',
        matricula: userData.matricula || matricula.trim(),
        email: userData.email
      });
      setMatricula('');
      setPassword('');
      setMode('HOME');
    } catch (err: any) {
      setAuthError(err.message || 'Falha ao autenticar.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const resetUserSession = () => {
    setAuthenticatedUser(null);
    setPendingCartIds([]);
    setSelectedMaterialIds([]);
    setSelectedLoanIds([]);
    setMode('HOME');
    setSuccessMessage('');
  };

  const userActiveLoans = useMemo(() => {
    if (!authenticatedUser) return [];
    return effectiveLoans.filter(l => 
      (l.personMatricula === authenticatedUser.matricula || 
       l.personName.toLowerCase().includes(authenticatedUser.name.toLowerCase())) &&
      (l.status === 'ACTIVE' || l.status === 'PENDING_RETURN')
    );
  }, [effectiveLoans, authenticatedUser]);

  const availableMaterials = useMemo(() => {
    const loanMatIds = effectiveLoans
      .filter(l => l.status === 'ACTIVE' || l.status === 'PENDING_RETURN')
      .map(l => l.materialId);

    return effectiveMaterials.filter(m => {
      const isLoaned = loanMatIds.includes(m.id);
      const matchesSearch = searchFilter === '' || 
        m.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        m.code.toLowerCase().includes(searchFilter.toLowerCase());
      return !isLoaned && matchesSearch;
    });
  }, [effectiveMaterials, effectiveLoans, searchFilter]);

  const pendingCartMaterials = useMemo(() => {
    return effectiveMaterials.filter(m => pendingCartIds.includes(m.id));
  }, [effectiveMaterials, pendingCartIds]);

  const activeCampus = useMemo(() => campuses.find(c => c.id === activeCampusId), [campuses, activeCampusId]);
  const activeSetor = useMemo(() => setores.find(s => s.id === activeSetorId), [setores, activeSetorId]);

  const handleConfirmLoan = async () => {
    if (!authenticatedUser || pendingCartIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const selectedItems = effectiveMaterials.filter(m => pendingCartIds.includes(m.id));
      await StorageService.createMaterialLoansBulk(
        selectedItems.map(mat => ({
          materialId: mat.id,
          materialName: mat.name,
          materialCode: mat.code,
          personName: authenticatedUser.name,
          personMatricula: authenticatedUser.matricula,
          personEmail: authenticatedUser.email,
          loanDate: new Date().toISOString(),
          status: 'ACTIVE',
          loanedBy: `${authenticatedUser.name} (Autoatendimento)`,
          campus_id: activeCampusId || mat.campus_id,
          setor_id: activeSetorId || mat.setor_id
        }))
      );
      const count = pendingCartIds.length;
      setPendingCartIds([]);
      setShowCheckoutDrawer(false);
      try {
        await refreshKioskData();
        await onUpdate();
      } catch (_) {}
      setSuccessMessage(`${count} item(ns) retirado(s) com sucesso!`);
      setMode('HOME');
    } catch (err: any) {
      console.error('[handleConfirmLoan] Erro completo:', err);
      alert('Erro ao registrar empréstimo: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!authenticatedUser || selectedLoanIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const returnedByInfo = `${authenticatedUser.name} (${authenticatedUser.matricula})`;
      await StorageService.requestSelfServiceReturnsBulk(selectedLoanIds, returnedByInfo);
      const count = selectedLoanIds.length;
      setSelectedLoanIds([]);
      try {
        await refreshKioskData();
        await onUpdate();
      } catch (_) {}
      setSuccessMessage(`${count} item(ns) enviado(s) para devolução!`);
      setMode('HOME');
    } catch (err: any) {
      alert('Erro ao registrar devolução: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectMaterial = (id: string) => {
    setSelectedMaterialIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectLoan = (id: string) => {
    setSelectedLoanIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  if (!isTerminalUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4 relative overflow-hidden">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800/80 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
          {isInitializing ? (
            <div className="text-center space-y-4 py-8">
              <Loader2 size={36} className="animate-spin text-emerald-400 mx-auto" />
              <p className="text-slate-400 text-sm">Inicializando terminal...</p>
            </div>
          ) : (
            <>
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Lock size={30} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Ativação de Terminal</h1>
            <p className="text-slate-400 text-xs leading-relaxed">
              Digite o código fornecido no painel administrativo para liberar o Totem de Autoatendimento.
            </p>
          </div>
          <form onSubmit={handleUnlockTerminal} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                Código do Terminal / Setor
              </label>
              <input
                type="text"
                value={terminalCodeInput}
                onChange={e => setTerminalCodeInput(e.target.value)}
                placeholder="EX: 123456"
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-emerald-400 uppercase placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
                autoFocus
              />
            </div>
            {terminalError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2.5">
                <AlertCircle size={16} className="shrink-0" />
                <span>{terminalError}</span>
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 text-sm"
            >
              <span>Ativar Terminal</span>
              <ArrowRight size={18} />
            </button>
          </form>
          {onExitKiosk && (
            <button
              onClick={onExitKiosk}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-1 block"
            >
              Voltar ao Painel Principal
            </button>
          )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none relative">
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 font-bold shadow-inner">
            <Box size={22} />
          </div>
          <div>
            <h1 className="font-extrabold text-base text-slate-100 flex items-center gap-2 tracking-tight">
              Autoatendimento de Materiais
              <span className="bg-emerald-500/15 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold tracking-wide uppercase">
                SUAP
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
              {activeCampus && <span className="flex items-center gap-1"><Building2 size={12} className="text-emerald-500" /> {activeCampus.name}</span>}
              {activeSetor && <span className="flex items-center gap-1"><Layers size={12} className="text-teal-500" /> {activeSetor.name}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {authenticatedUser && (
            <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/60 rounded-xl px-3.5 py-1.5 text-xs shadow-sm">
              <div className="w-7 h-7 bg-emerald-500/20 text-emerald-300 rounded-lg flex items-center justify-center font-bold">
                <UserIcon size={15} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-200 leading-tight">{authenticatedUser.name}</p>
                <p className="text-slate-400 text-[10px] font-mono">Matrícula: {authenticatedUser.matricula}</p>
              </div>
              {pendingCartIds.length > 0 && (
                <button
                  onClick={() => setShowCheckoutDrawer(true)}
                  className="ml-2 relative p-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 rounded-lg transition-all flex items-center justify-center"
                  title="Abrir carrinho"
                >
                  <ShoppingBag size={16} />
                  <span className="absolute -top-1.5 -right-1.5 bg-emerald-400 text-slate-950 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-md">
                    {pendingCartIds.length}
                  </span>
                </button>
              )}
              <button
                onClick={resetUserSession}
                className="ml-1 p-1.5 hover:bg-slate-700/80 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                title="Encerrar Sessão"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
          <button
            onClick={handleLockTerminal}
            className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-slate-200 rounded-xl transition-all"
            title="Bloquear Terminal"
          >
            <Lock size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col justify-center my-auto">
        {!authenticatedUser && (
          <div className="max-w-md w-full mx-auto bg-slate-900/80 border border-slate-800/80 rounded-3xl p-8 shadow-2xl space-y-6 backdrop-blur-xl relative">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Identificação do Usuário</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Digite sua matrícula e senha do SUAP para retirar ou devolver materiais neste terminal.
              </p>
            </div>
            <form onSubmit={handleSuapAuth} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-widest mb-1.5">Matrícula SUAP</label>
                <input
                  type="text"
                  value={matricula}
                  onChange={e => setMatricula(e.target.value)}
                  placeholder="Informe sua matrícula..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all text-sm font-mono shadow-inner"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-widest mb-1.5">Senha SUAP</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all text-sm shadow-inner"
                />
              </div>
              {authError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{authError}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Verificando credenciais...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Autoatendimento</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {authenticatedUser && mode === 'HOME' && (
          <div className="space-y-6">
            {successMessage && (
              <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-xl backdrop-blur-md animate-fadeIn">
                <CheckCircle size={22} className="shrink-0 text-emerald-400" />
                <p className="text-xs font-semibold">{successMessage}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setShowAddItemsModal(true)}
                className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-3xl p-6 text-left transition-all hover:shadow-xl hover:shadow-emerald-950/20 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-400"><Package size={80} /></div>
                <div className="w-12 h-12 bg-emerald-500/15 text-emerald-400 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/30 group-hover:scale-110 transition-transform"><Package size={24} /></div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                  Retirar Novo Material
                  <ChevronRight size={18} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-xs text-slate-400 mt-1">Procure e selecione itens disponíveis.</p>
                {pendingCartIds.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5"><ShoppingBag size={14} /> {pendingCartIds.length} item(ns) no carrinho</span>
                    <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-medium">Ver Resumo →</span>
                  </div>
                )}
              </button>
              {pendingCartIds.length > 0 ? (
                <button
                  onClick={() => setShowCheckoutDrawer(true)}
                  className="bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/40 rounded-3xl p-6 text-left transition-all hover:shadow-xl hover:shadow-emerald-900/20 group relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-emerald-500/20 text-emerald-300 rounded-2xl flex items-center justify-center border border-emerald-500/40"><ShoppingBag size={24} /></div>
                    <span className="text-xs font-bold bg-emerald-500 text-slate-950 px-3 py-1 rounded-full">{pendingCartIds.length} selecionado(s)</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mt-4 flex items-center gap-2">Concluir Retirada <ChevronRight size={18} className="text-emerald-400 group-hover:translate-x-1 transition-transform" /></h3>
                    <p className="text-xs text-emerald-300/80 mt-0.5">Clique para revisar a lista e confirmar a retirada.</p>
                  </div>
                </button>
              ) : (
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex flex-col justify-center">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Status do Usuário</p>
                  <p className="text-sm text-slate-200 font-medium">{userActiveLoans.length === 0 ? "Você não possui nenhum empréstimo pendente." : `Você possui ${userActiveLoans.length} item(ns) atualmente em sua posse.`}</p>
                </div>
              )}
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-teal-400" />
                  <h3 className="font-bold text-white text-base">Itens em Sua Posse</h3>
                </div>
                <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full font-mono">{userActiveLoans.length} item(ns)</span>
              </div>
              {userActiveLoans.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <CheckCircle size={36} className="mx-auto text-emerald-500/80" />
                  <p className="text-sm text-slate-400 font-medium">Você está em dia! Nenhum item pendente de devolução.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {userActiveLoans.map(loan => {
                    const isSelected = selectedLoanIds.includes(loan.id);
                    const isPendingValidation = loan.status === 'PENDING_RETURN';
                    return (
                      <div
                        key={loan.id}
                        onClick={() => !isPendingValidation && toggleSelectLoan(loan.id)}
                        className={`flex items-center justify-between px-6 py-4 transition-all ${isPendingValidation ? 'opacity-60 cursor-default bg-slate-950/40' : isSelected ? 'bg-emerald-950/20 cursor-pointer' : 'hover:bg-slate-800/40 cursor-pointer'}`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {isPendingValidation ? (
                            <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/30 font-semibold uppercase shrink-0">Em Validação</span>
                          ) : (
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-emerald-500 text-slate-950' : 'border border-slate-700 bg-slate-950'}`}>
                              {isSelected && <Check size={12} className="stroke-[3]" />}
                            </div>
                          )}
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-emerald-400/90 text-[11px] shrink-0">{stripCodePrefix(loan.materialCode)}</span>
                            <span className="text-slate-400 text-[11px]">•</span>
                            <span className="font-semibold text-slate-100 text-sm truncate">{loan.materialName}</span>
                            <span className="text-slate-400 text-[11px]">•</span>
                            <span className="text-xs text-slate-400 shrink-0">{new Date(loan.loanDate).toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                        {!isPendingValidation && isSelected && (
                          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 shrink-0">Selecionado</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedLoanIds.length > 0 && (
                <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4">
                  <p className="text-xs text-slate-400 pl-2"><span className="font-bold text-white">{selectedLoanIds.length}</span> item(ns) selecionado(s) para devolução</p>
                  <button
                    onClick={handleConfirmReturn}
                    disabled={isSubmitting}
                    className="py-2.5 px-6 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 text-white font-semibold rounded-xl transition-all flex items-center gap-2 text-xs shadow-md"
                  >
                    {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> Processando...</> : <><RefreshCw size={15} /> Confirmar Devolução</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Modal
        isOpen={showAddItemsModal}
        onClose={() => { setShowAddItemsModal(false); setSearchFilter(''); }}
        title="Catálogo de Materiais Disponíveis"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4 p-2 rounded-xl">
          <div className="relative">
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Digite o nome ou código do material..."
              className="w-full bg-gray-50 border border-gray-300 focus:border-emerald-500 rounded-xl px-4 py-3 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              autoFocus
            />
            <Search size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
          </div>
          {availableMaterials.length === 0 ? (
            <div className="p-10 text-center space-y-2 border border-dashed border-gray-200 rounded-2xl">
              <Package size={32} className="mx-auto text-gray-300" />
              <p className="text-xs text-gray-500">Nenhum material disponível no momento.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
              {availableMaterials.map(mat => {
                const isSelected = selectedMaterialIds.includes(mat.id);
                const isInCart = pendingCartIds.includes(mat.id);
                return (
                  <div
                    key={mat.id}
                    onClick={() => !isInCart && toggleSelectMaterial(mat.id)}
                    className={`rounded-xl px-4 py-3 border transition-all flex items-center gap-3.5 select-none ${
                      isInCart
                        ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'bg-emerald-50 border-emerald-400 text-gray-900 cursor-pointer shadow-sm'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 cursor-pointer'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 ${
                      isInCart
                        ? 'bg-gray-300 text-gray-500'
                        : isSelected
                        ? 'bg-emerald-500 text-white'
                        : 'border-2 border-gray-300'
                    }`}>
                      {isInCart || isSelected ? <Check size={12} className="stroke-[3]" /> : null}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <span className={`font-mono text-xs px-2 py-0.5 rounded font-medium ${
                        isSelected
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {stripCodePrefix(mat.code)}
                      </span>
                      <span className="font-medium text-sm truncate text-gray-800">{mat.name}</span>
                    </div>
                    {isInCart && <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-mono shrink-0">No carrinho</span>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-500 font-medium">{selectedMaterialIds.length} item(ns) selecionado(s)</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setShowAddItemsModal(false)} className="px-4 py-2.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">Cancelar</button>
              <button
                type="button"
                disabled={selectedMaterialIds.length === 0}
                onClick={() => {
                  setPendingCartIds(prev => [...new Set([...prev, ...selectedMaterialIds])]);
                  setSelectedMaterialIds([]);
                  setShowAddItemsModal(false);
                  setSearchFilter('');
                  setShowCheckoutDrawer(true);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2 text-xs shadow-lg shadow-emerald-950/40"
              >
                <ShoppingBag size={15} /> Adicionar e Revisar ({selectedMaterialIds.length})
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {showCheckoutDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-slideLeft">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center justify-center">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Resumo da Retirada</h3>
                  <p className="text-xs text-slate-400">Confira os materiais antes de finalizar</p>
                </div>
              </div>
              <button onClick={() => setShowCheckoutDrawer(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {pendingCartMaterials.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <ShoppingBag size={40} className="mx-auto text-slate-700" />
                  <p className="text-sm text-slate-400">Nenhum item no carrinho.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingCartMaterials.map(mat => (
                    <div key={mat.id} className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-inner">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">{stripCodePrefix(mat.code)}</span>
                        <p className="font-semibold text-sm text-slate-100 mt-1 truncate">{mat.name}</p>
                      </div>
                      <button
                        onClick={() => setPendingCartIds(prev => prev.filter(id => id !== mat.id))}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
                        title="Remover item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {pendingCartMaterials.length > 0 && (
              <div className="p-6 border-t border-slate-800 bg-slate-950/60 space-y-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Total de materiais:</span>
                  <span className="font-bold text-white">{pendingCartMaterials.length} item(ns)</span>
                </div>
                <button
                  onClick={handleConfirmLoan}
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Registrando empréstimo...</> : <><CheckCircle size={18} /> Confirmar Retirada Final</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
