import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StorageService, supabase } from './services/storage';
import { User, UserLevel, FoundItem, LostReport, Person, Book, BookLoan } from './types';
import { Locker } from './types-armarios';
import { Material, MaterialLoan } from './types-materiais';
import { IfrnLogo } from './components/Logo';
import { FoundItemsTab } from './components/Tabs/FoundItemsTab';
import { LostReportsTab } from './components/Tabs/LostReportsTab';
import { PeopleTab } from './components/Tabs/PeopleTab';
import { UsersTab } from './components/Tabs/UsersTab';
import { ArmariosTab } from './components/Tabs/ArmariosTab';
import { BooksTab } from './components/Tabs/BooksTab';
import { BookLoansTab } from './components/Tabs/BookLoansTab';
import { NadaConstaTab } from './components/Tabs/NadaConstaTab';
import { MaterialManagementTab } from './components/Tabs/MaterialManagementTab';
import { LogOut, Package, ClipboardList, Users, ShieldCheck, KeyRound, Menu, X, Settings, Trash, AlertTriangle, ChevronDown, ChevronUp, UserX, FileX, Save, Building2, Eye, EyeOff, Loader2, Key, Search, Trash2, ShieldAlert, AlertCircle, CheckCircle2, History, Send, ArrowRight, LayoutGrid, Download, BookOpen, FileCheck, Lock, User as UserIcon } from 'lucide-react';
import { Modal } from './components/ui/Modal';

type ConfirmActionType = 'DELETE_ITEMS' | 'DELETE_REPORTS' | 'DELETE_PEOPLE' | 'DELETE_USERS' | 'FACTORY_RESET' | null;

interface ModuleInfo {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  iconBg: string;
  textColor: string;
  hoverBorder: string;
  bgLight: string;
  permission: keyof NonNullable<User['permissions']>;
  onSelect: () => void;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'achados');
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showModuleSelector, setShowModuleSelector] = useState(false);
  const [currentSystem, setCurrentSystem] = useState<'achados' | 'armarios' | 'livros' | 'nadaconsta' | 'materiais' | null>(null);
  const [loading, setLoading] = useState(false);

  // Settings / Admin Config State
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const [mobileDeleteOpen, setMobileDeleteOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [desktopDeleteOpen, setDesktopDeleteOpen] = useState(false);

  // System Config State (Inicia com cache para evitar "SIAE" no refresh)
  const [systemSector, setSystemSector] = useState(() => {
    const cached = localStorage.getItem('sga_system_config');
    return cached ? JSON.parse(cached).sector : '';
  });
  const [systemCampus, setSystemCampus] = useState(() => {
    const cached = localStorage.getItem('sga_system_config');
    return cached ? JSON.parse(cached).campus : '';
  });

  // Temp State
  const [configSector, setConfigSector] = useState('');
  const [configCampus, setConfigCampus] = useState('');

  // Confirmation Modal
  const [confirmAction, setConfirmAction] = useState<ConfirmActionType>(null);
  const [confirmationPassword, setConfirmationPassword] = useState('');

  // Data State
  const [items, setItems] = useState<FoundItem[]>([]);
  const [reports, setReports] = useState<LostReport[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookLoans, setBookLoans] = useState<BookLoan[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialLoans, setMaterialLoans] = useState<MaterialLoan[]>([]);

  // Login State
  const [loginMat, setLoginMat] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Change Password
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Drag and Drop state
  const [moduleOrder, setModuleOrder] = useState<string[]>([]);
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);

  // Persist Tab
  useEffect(() => {
    if (user) {
      localStorage.setItem('activeTab', activeTab);
    }
  }, [activeTab, user]);

  const hasAccess = (mod: keyof NonNullable<User['permissions']>) => {
    if (!user) return false;
    if (user.permissions && user.permissions[mod] !== undefined) {
      return user.permissions[mod];
    }
    if (mod === 'nadaconsta') return true;
    return user.level !== UserLevel.STANDARD;
  };

  // Refresh Data Individual Helpers
  const refreshItems = useCallback(async () => { try { setItems(await StorageService.getItems()); } catch (e) { console.error("Erro items:", e); } }, []);
  const refreshReports = useCallback(async () => { try { setReports(await StorageService.getReports()); } catch (e) { console.error("Erro reports:", e); } }, []);
  const refreshPeople = useCallback(async () => { try { setPeople(await StorageService.getPeople()); } catch (e) { console.error("Erro people:", e); } }, []);
  const refreshUsers = useCallback(async () => { try { setUsers(await StorageService.getUsers()); } catch (e) { console.error("Erro users:", e); } }, []);
  const refreshBooks = useCallback(async () => { try { setBooks(await StorageService.getBooks()); } catch (e) { console.error("Erro books:", e); } }, []);
  const refreshBookLoans = useCallback(async () => { try { setBookLoans(await StorageService.getBookLoans()); } catch (e) { console.error("Erro book_loans:", e); } }, []);
  const refreshLockers = useCallback(async () => { try { setLockers(await StorageService.getLockers()); } catch (e) { console.error("Erro lockers:", e); } }, []);
  const refreshMaterials = useCallback(async () => { try { setMaterials(await StorageService.getMaterials()); } catch (e) { console.error("Erro materials:", e); } }, []);
  const refreshMaterialLoans = useCallback(async () => { try { setMaterialLoans(await StorageService.getMaterialLoans()); } catch (e) { console.error("Erro mat_loans:", e); } }, []);

  // Refresh Data Helper (Async) with Timeout
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Tempo limite excedido")), 10000)
      );

      const dataPromise = Promise.all([
        StorageService.getItems(),
        StorageService.getReports(),
        StorageService.getPeople(),
        StorageService.getUsers(),
        StorageService.getBooks(),
        StorageService.getBookLoans(),
        StorageService.getLockers(),
        StorageService.getMaterials(),
        StorageService.getMaterialLoans()
      ]);

      const result = await Promise.race([dataPromise, timeout]);
      const [fetchedItems, fetchedReports, fetchedPeople, fetchedUsers, fetchedBooks, fetchedLoans, fetchedLockers, fetchedMaterials, fetchedMaterialLoans] = result as [FoundItem[], LostReport[], Person[], User[], Book[], BookLoan[], Locker[], Material[], MaterialLoan[]];

      setItems(fetchedItems);
      setReports(fetchedReports);
      setPeople(fetchedPeople);
      setUsers(fetchedUsers);
      setBooks(fetchedBooks);
      setBookLoans(fetchedLoans);
      setLockers(fetchedLockers);
      setMaterials(fetchedMaterials);
      setMaterialLoans(fetchedMaterialLoans);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced notification handler to avoid too many refreshes in bulk operations
  const debounceTimers = useRef<Record<string, number>>({});
  const handleRealtimeChange = useCallback((table: string) => {
    if (debounceTimers.current[table]) {
      window.clearTimeout(debounceTimers.current[table]);
    }

    debounceTimers.current[table] = window.setTimeout(() => {
      switch (table) {
        case 'items': refreshItems(); break;
        case 'reports': refreshReports(); break;
        case 'people': refreshPeople(); break;
        case 'users': refreshUsers(); break;
        case 'books': refreshBooks(); break;
        case 'book_loans': refreshBookLoans(); break;
        case 'lockers': refreshLockers(); break;
        case 'materials': refreshMaterials(); break;
        case 'material_loans': refreshMaterialLoans(); break;
      }
    }, 1000); // 1 second debounce
  }, [refreshItems, refreshReports, refreshPeople, refreshUsers, refreshBooks, refreshBookLoans, refreshLockers, refreshMaterials, refreshMaterialLoans]);

  // 0. Setup Realtime Listeners
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          handleRealtimeChange(payload.table);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(debounceTimers.current).forEach(t => window.clearTimeout(t));
    };
  }, [user, handleRealtimeChange]);

  const loadSystemConfig = useCallback(async () => {
    const config = await StorageService.getConfig();
    setSystemSector(config.sector);
    setSystemCampus(config.campus);
  }, []);

  const handleLogout = useCallback(async () => {
    await StorageService.clearSession();
    setUser(null);
    setLoginMat('');
    setLoginPass('');
    setShowLoginPassword(false);
    setActiveTab('achados');
    localStorage.removeItem('activeTab');
    setMobileMenuOpen(false);
    setConfigMenuOpen(false);
    setMobileDeleteOpen(false);
    setDesktopDeleteOpen(false);
    setShowModuleSelector(false);
    setCurrentSystem(null);
  }, []);

  // 1. Initial System Load
  useEffect(() => {
    loadSystemConfig();

    const initSession = async () => {
      const sessionUser = await StorageService.getSessionUser();
      if (sessionUser) {
        if (await StorageService.isSessionExpired()) {
          await StorageService.clearSession();
          setUser(null);
        } else {
          setUser(sessionUser);
          StorageService.updateLastActive();
          setShowModuleSelector(true);
        }
      }
    };
    initSession();
  }, [loadSystemConfig]);

  // Handle module order
  useEffect(() => {
    if (user) {
      const defaultOrder = ['achados', 'armarios', 'livros', 'nadaconsta', 'materiais', 'pessoas', 'usuarios'];
      const savedOrder = user.moduleOrder || [];
      // Filtrar apenas módulos que existem (evitar erros se o nome mudar)
      const validSavedOrder = savedOrder.filter(id => defaultOrder.includes(id));
      // Adicionar módulos que faltam
      const missingModules = defaultOrder.filter(id => !validSavedOrder.includes(id));
      setModuleOrder([...validSavedOrder, ...missingModules]);
    }
  }, [user]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedModuleId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Adicionar um delay pequeno para o ghost image ser criado antes de esconder o original
    setTimeout(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedModuleId(null);
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedModuleId === null || draggedModuleId === id) return;

    const draggingIndex = moduleOrder.indexOf(draggedModuleId);
    const hoverIndex = moduleOrder.indexOf(id);

    const newOrder = [...moduleOrder];
    newOrder.splice(draggingIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedModuleId);
    setModuleOrder(newOrder);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (user && moduleOrder.length > 0) {
      try {
        await StorageService.updateModuleOrder(user.id, moduleOrder);
        // Atualizar usuário na sessão
        const updatedUser = { ...user, moduleOrder };
        setUser(updatedUser);
        StorageService.setSessionUser(updatedUser);
      } catch (err) {
        console.error("Erro ao salvar ordem dos módulos:", err);
      }
    }
  };

  // 2. Data Fetching Effect
  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshData]);

  // 3. Inactivity Timer Effect
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      StorageService.updateLastActive();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const intervalId = setInterval(async () => {
      if (await StorageService.isSessionExpired()) {
        handleLogout();
        alert("Sua sessão expirou por inatividade.");
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(intervalId);
    };
  }, [user, handleLogout]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    attemptLogin(loginMat, loginPass);
  };

  const attemptLogin = async (mat: string, pass: string) => {
    setLoading(true);
    try {
      const loggedUser = await StorageService.login(mat, pass);
      if (loggedUser) {
        StorageService.setSessionUser(loggedUser);
        setUser(loggedUser);
        setLoginError('');
        setShowModuleSelector(true);
      } else {
        setLoginError('Credenciais inválidas. Tente novamente.');
      }
    } catch (e) {
      setLoginError('Erro de conexão ou configuração.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const hashedCurrent = await StorageService.hashPassword(currentPassword);
    if (user.password !== hashedCurrent) {
      alert("A senha atual está incorreta.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("A nova senha e a confirmação não coincidem.");
      return;
    }
    if (newPassword.length < 3) {
      alert("A senha deve ter pelo menos 3 caracteres.");
      return;
    }

    try {
      const updatedUser = await StorageService.changePassword(user.id, newPassword, user.name);
      if (updatedUser) {
        setUser(updatedUser);
        StorageService.setSessionUser(updatedUser);
        alert("Senha alterada com sucesso!");
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowCurrentPass(false);
        setShowNewPass(false);
        setShowConfirmPass(false);
      }
    } catch (e) {
      alert("Erro ao alterar senha.");
    }
  };

  const handleMobileNav = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const openConfigModal = () => {
    setConfigSector(systemSector);
    setConfigCampus(systemCampus);
    setDesktopDeleteOpen(false);
    setShowConfigModal(true);
  };

  const handleSaveSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await StorageService.saveConfig(configSector, configCampus);
    setSystemSector(configSector);
    setSystemCampus(configCampus);
    alert('Configurações de sistema atualizadas!');
    setShowConfigModal(false);
  };

  const initiateConfigAction = (action: ConfirmActionType) => {
    setConfirmAction(action);
    setConfirmationPassword('');
    setMobileMenuOpen(false);
    setShowConfigModal(false);
  };

  const executeConfigAction = async (e: React.FormEvent) => {
    e.preventDefault();
    const hashedPass = await StorageService.hashPassword(confirmationPassword);
    if (!user || user.password !== hashedPass) {
      alert("Senha incorreta.");
      return;
    }

    setLoading(true);
    try {
      if (confirmAction === 'DELETE_ITEMS') {
        await StorageService.deleteAllItems();
        alert("Todos os itens foram apagados.");
      } else if (confirmAction === 'DELETE_REPORTS') {
        await StorageService.deleteAllReports();
        alert("Todos os relatos de perdidos foram apagados.");
      } else if (confirmAction === 'DELETE_PEOPLE') {
        await StorageService.deleteAllPeople();
        alert("Todas as pessoas cadastradas foram apagadas.");
      } else if (confirmAction === 'DELETE_USERS') {
        await StorageService.deleteAllUsers(user.id);
        alert("Todos os usuários (exceto você) foram apagados.");
      } else if (confirmAction === 'FACTORY_RESET') {
        await StorageService.factoryReset(user.id);
        window.location.reload();
        return;
      }
      setConfirmAction(null);
      setConfirmationPassword('');
      await refreshData();
    } catch (error) {
      alert("Erro ao executar ação.");
    } finally {
      setLoading(false);
    }
  };



  const getActionName = () => {
    switch (confirmAction) {
      case 'DELETE_ITEMS': return 'Apagar Todos os Itens';
      case 'DELETE_REPORTS': return 'Apagar Relatos de Perdidos';
      case 'DELETE_PEOPLE': return 'Apagar Pessoas Cadastradas';
      case 'DELETE_USERS': return 'Apagar Usuários do Sistema';
      case 'FACTORY_RESET': return 'Reset Geral (Fábrica)';
      default: return '';
    }
  };

  const canConfigure = user?.level === UserLevel.ADMIN || user?.level === UserLevel.ADVANCED;

  // 1. Initial Login Screen
  if (!user) {
    return (
      <div className="min-h-screen flex w-full bg-white animate-fade-in-down">
        {/* Lado da Imagem/Branding - Escondido em Mobile */}
        <div className="hidden lg:flex w-1/2 xl:w-2/3 bg-ifrn-green relative overflow-hidden items-center justify-center p-12 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-emerald-900 opacity-90" />
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <svg width="400" height="400" viewBox="0 0 100 100" fill="white">
              {/*<circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="20" y="20" width="20" height="20" rx="4" fill="currentColor" />
              <rect x="60" y="60" width="20" height="20" rx="4" fill="currentColor" />*/}



              {/* LINHA 1 (Topo) - Círculo Vermelho + 2 Quadrados Verdes */}
              <circle cx="19" cy="24" r="9" fill="currentColor" />
              <rect x="29" y="15" width="18" height="18" rx="4" fill="currentColor" />
              <rect x="48" y="15" width="18" height="18" rx="4" fill="currentColor" />

              {/* LINHA 2 (Meio Superior) - 2 Quadrados Verdes */}
              <rect x="10" y="34" width="18" height="18" rx="4" fill="currentColor" />
              <rect x="29" y="34" width="18" height="18" rx="4" fill="currentColor" />

              {/* LINHA 3 (Meio Inferior) - 3 Quadrados Verdes */}
              <rect x="10" y="53" width="18" height="18" rx="4" fill="currentColor" />
              <rect x="29" y="53" width="18" height="18" rx="4" fill="currentColor" />
              <rect x="48" y="53" width="18" height="18" rx="4" fill="currentColor" />

              {/* LINHA 4 (Base) - 2 Quadrados Verdes */}
              <rect x="10" y="72" width="18" height="18" rx="4" fill="currentColor" />
              <rect x="29" y="72" width="18" height="18" rx="4" fill="currentColor" />

            </svg>
          </div>

          <div className="relative z-10 max-w-lg text-left animate-fade-in-up">
            <div className="inline-block p-4 bg-white/10 backdrop-blur-md rounded-2xl mb-8 border border-white/20 shadow-xl">
              <IfrnLogo theme="light" className="scale-110" />
            </div>
            <h1 className="mb-8 tracking-tighter leading-none flex flex-col">
              <span className="text-7xl font-black text-white">SIAE</span>
              <div className="flex flex-col mt-3">
                <span className="text-3xl font-black text-green-200 uppercase tracking-tight">Instituto Federal</span>
                <span className="text-3xl font-medium text-white">Rio Grande do Norte</span>
              </div>
            </h1>
            <p className="text-xl text-green-100 font-medium leading-relaxed max-w-md border-l-4 border-green-400 pl-6">
              Sistema Integrado de Administração Escolar
            </p>
          </div>
        </div>

        {/* Lado do Formulário */}
        <div className="w-full lg:w-1/2 xl:w-1/3 flex items-center justify-center p-8 lg:p-16 relative">
          <div className="w-full max-w-sm space-y-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="text-center lg:text-left">
              <div className="lg:hidden mb-8 flex justify-center">
                <IfrnLogo />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Bem-vindo de volta.</h2>
              <p className="text-gray-500">Insira suas credenciais para acessar o painel.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-5">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-ifrn-green text-gray-400">
                    <UserIcon size={20} strokeWidth={2} />
                  </div>
                  <input
                    type="text"
                    value={loginMat}
                    onChange={e => setLoginMat(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green block w-full pl-12 p-4 transition-all outline-none font-medium placeholder:text-gray-400"
                    placeholder="Sua Matrícula"
                    required
                  />
                </div>

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-ifrn-green text-gray-400">
                    <Lock size={20} strokeWidth={2} />
                  </div>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPass}
                    onChange={e => setLoginPass(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green block w-full pl-12 p-4 pr-12 transition-all outline-none font-medium placeholder:text-gray-400"
                    placeholder="Sua Senha"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-ifrn-green cursor-pointer transition-colors"
                  >
                    {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-3 animate-scale-in border border-red-100">
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <span className="font-medium">{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white bg-ifrn-green hover:bg-ifrn-darkGreen focus:ring-4 focus:ring-green-300 font-bold rounded-xl text-lg px-5 py-4 text-center transition-all transform active:scale-[0.98] shadow-lg shadow-green-200 flex items-center justify-center gap-2 group"
              >
                {loading ? <Loader2 className="animate-spin" /> : <>Acessar Sistema <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></>}
              </button>
            </form>

            <div className="text-center">
              <p className="text-xs text-gray-400 mt-8">

                &copy; {new Date().getFullYear()} IFRN
                {systemCampus ? (
                  <>
                    {" - Campus "}
                    <span style={{ textTransform: 'capitalize' }}>
                      {systemCampus.toLowerCase()}
                    </span>.
                  </>
                ) : null}
                <br /> <span className="italic">Desenvolvido por <span className="font-semibold text-gray-500">David Galdino</span></span>


                {/*&copy; {new Date().getFullYear()} IFRN - Campus {systemCampus}. <br /> Todos os direitos reservados.*/}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Module Selector Screen
  if (showModuleSelector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-6">
        <div className="max-w-7xl w-full">
          <div className="mb-16 animate-fade-in-down">
            <div className="px-4 mb-8">
              <IfrnLogo className="scale-110 sm:scale-125 drop-shadow-sm origin-left" sector={systemSector} campus={systemCampus} />
            </div>
            <div className="text-center px-4 space-y-2">
              <h2 className="text-3xl sm:text-4xl font-black text-gray-800 tracking-tight leading-tight">
                Olá, <span className="text-ifrn-green">{user.name.split(' ')[0]}</span>.
              </h2>
              <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto font-medium">
                Selecione o sistema que deseja gerenciar.
              </p>
            </div>

            {/* Aviso de Transição - Somente para ADMINISTRADORES */}
            {user.level === UserLevel.ADMIN && (
              <div className="mt-8 px-4 max-w-3xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                      <ShieldAlert size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
                        🔄 Período de Transição - Supabase Auth
                      </h3>
                      <p className="text-sm text-gray-700 leading-relaxed mb-3">
                        O sistema está em <strong>processo de migração</strong> para autenticação via Supabase Auth. Usuários cadastrados antes desta atualização serão <strong>migrados automaticamente</strong> no primeiro login.
                      </p>
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-white/60 px-3 py-2 rounded-lg border border-amber-200">
                        <AlertCircle size={14} />
                        Este aviso será removido após a conclusão da migração de todos os usuários
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 px-4">
            {moduleOrder.map((moduleId) => {
              const modules: Record<string, ModuleInfo> = {
                achados: {
                  id: 'achados',
                  label: 'Achados e Perdidos',
                  description: 'Gerencie itens encontrados, registre devoluções e mantenha o controle do acervo.',
                  icon: <Package size={32} />,
                  color: 'text-ifrn-green',
                  iconBg: 'bg-gradient-to-br from-ifrn-green to-emerald-600',
                  textColor: 'text-ifrn-green',
                  hoverBorder: 'hover:border-ifrn-green',
                  bgLight: 'bg-green-50',
                  permission: 'achados',
                  onSelect: () => {
                    setCurrentSystem('achados');
                    setActiveTab('achados');
                    setShowModuleSelector(false);
                  }
                },
                armarios: {
                  id: 'armarios',
                  label: 'Gestão de Armários',
                  description: 'Controle de empréstimos, devoluções, manutenção e ocupação dos armários escolares.',
                  icon: <Key size={32} />,
                  color: 'text-emerald-700',
                  iconBg: 'bg-gradient-to-br from-emerald-600 to-teal-700',
                  textColor: 'text-emerald-700',
                  hoverBorder: 'hover:border-emerald-600',
                  bgLight: 'bg-emerald-50',
                  permission: 'armarios',
                  onSelect: () => {
                    setCurrentSystem('armarios');
                    setActiveTab('armarios');
                    setShowModuleSelector(false);
                  }
                },
                livros: {
                  id: 'livros',
                  label: 'Livros PNLD',
                  description: 'Gerencie o catálogo didático, realize empréstimos e controle o estoque de livros.',
                  icon: <BookOpen size={32} />,
                  color: 'text-orange-600',
                  iconBg: 'bg-gradient-to-br from-orange-500 to-amber-600',
                  textColor: 'text-orange-600',
                  hoverBorder: 'hover:border-orange-500',
                  bgLight: 'bg-orange-50',
                  permission: 'livros',
                  onSelect: () => {
                    setCurrentSystem('livros');
                    setActiveTab('livros-catalogo');
                    setShowModuleSelector(false);
                  }
                },
                nadaconsta: {
                  id: 'nadaconsta',
                  label: 'Nada Consta',
                  description: 'Emissão rápida de declarações e verificação de pendências de alunos e servidores.',
                  icon: <FileCheck size={32} />,
                  color: 'text-blue-700',
                  iconBg: 'bg-gradient-to-br from-blue-600 to-indigo-600',
                  textColor: 'text-blue-700',
                  hoverBorder: 'hover:border-blue-600',
                  bgLight: 'bg-blue-50',
                  permission: 'nadaconsta',
                  onSelect: () => {
                    setCurrentSystem('nadaconsta');
                    setActiveTab('nadaconsta');
                    setShowModuleSelector(false);
                  }
                },
                materiais: {
                  id: 'materiais',
                  label: 'Empréstimo de Material',
                  description: 'Gerencie catálogo de materiais e registre empréstimos.',
                  icon: <LayoutGrid size={32} />,
                  color: 'text-indigo-700',
                  iconBg: 'bg-gradient-to-br from-indigo-600 to-purple-600',
                  textColor: 'text-indigo-700',
                  hoverBorder: 'hover:border-indigo-600',
                  bgLight: 'bg-indigo-50',
                  permission: 'materiais',
                  onSelect: () => {
                    setCurrentSystem('materiais');
                    setActiveTab('materiais');
                    setShowModuleSelector(false);
                  }
                },
                pessoas: {
                  id: 'pessoas',
                  label: 'Pessoas',
                  description: 'Base de dados centralizada de alunos, servidores e colaboradores da instituição.',
                  icon: <Users size={32} />,
                  color: 'text-cyan-700',
                  iconBg: 'bg-gradient-to-br from-cyan-600 to-blue-500',
                  textColor: 'text-cyan-700',
                  hoverBorder: 'hover:border-cyan-600',
                  bgLight: 'bg-cyan-50',
                  permission: 'pessoas',
                  onSelect: () => {
                    setCurrentSystem(null);
                    setActiveTab('pessoas');
                    setShowModuleSelector(false);
                  }
                },
                usuarios: {
                  id: 'usuarios',
                  label: 'Usuários',
                  description: 'Administração de contas de acesso, níveis de permissão e segurança do sistema.',
                  icon: <ShieldCheck size={32} />,
                  color: 'text-purple-700',
                  iconBg: 'bg-gradient-to-br from-purple-600 to-violet-700',
                  textColor: 'text-purple-700',
                  hoverBorder: 'hover:border-purple-600',
                  bgLight: 'bg-purple-50',
                  permission: 'usuarios',
                  onSelect: () => {
                    setCurrentSystem(null);
                    setActiveTab('usuarios');
                    setShowModuleSelector(false);
                  }
                }
              };

              const mod = modules[moduleId];
              if (!mod || !hasAccess(mod.permission)) return null;

              return (
                <button
                  key={mod.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, mod.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, mod.id)}
                  onDrop={handleDrop}
                  onClick={mod.onSelect}
                  className={`bg-white/80 backdrop-blur-sm p-8 rounded-[2rem] shadow-lg hover:shadow-2xl border-2 border-white ${mod.hoverBorder} transition-all duration-300 group text-left relative overflow-hidden transform hover:-translate-y-1 hover:scale-[1.02] cursor-grab active:cursor-grabbing`}
                >
                  <div className="absolute -right-4 -top-4 p-6 text-gray-100 group-hover:opacity-10 transition-colors duration-500 pointer-events-none">
                    {React.cloneElement(mod.icon as React.ReactElement, { size: 140, strokeWidth: 1 })}
                  </div>
                  <div className="relative z-10 flex flex-col h-full pointer-events-none">
                    <div className={`${mod.iconBg} w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-gray-200 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                      {mod.icon}
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 mb-3 group-hover:text-gray-900 transition-colors">{mod.label}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed font-medium mb-8">{mod.description}</p>
                    <div className={`mt-auto flex items-center gap-2 ${mod.textColor} font-bold text-sm tracking-wide ${mod.bgLight} w-fit px-4 py-2 rounded-full group-hover:bg-gray-800 group-hover:text-white transition-all`}>
                      ACESSAR SISTEMA <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-16 flex flex-col md:flex-row items-center justify-center gap-4 animate-fade-in-up">
            <div className="flex gap-4">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="px-6 py-3 text-gray-600 hover:text-ifrn-green font-bold transition-all flex items-center gap-3 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-ifrn-green hover:-translate-y-0.5 active:translate-y-0"
              >
                <KeyRound size={20} /> Alterar Minha Senha
              </button>

              {canConfigure && (
                <button
                  onClick={openConfigModal}
                  className="px-6 py-3 text-gray-600 hover:text-blue-600 font-bold transition-all flex items-center gap-3 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-600 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Settings size={20} /> Configurações
                </button>
              )}
            </div>

            <button onClick={handleLogout} className="px-6 py-3 text-red-500 hover:text-red-600 hover:bg-red-50 font-bold transition-all flex items-center gap-3 rounded-xl hover:shadow-md border border-transparent hover:border-red-100">
              <LogOut size={20} /> Sair da conta
            </button>
          </div>
        </div>

        {/* MODALS IN MODULE SELECTOR */}
        <Modal isOpen={showPasswordModal} onClose={() => { setShowPasswordModal(false); setShowCurrentPass(false); setShowNewPass(false); setShowConfirmPass(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }} title="">
          <div className="space-y-6">
            {/* Header Moderno */}
            <div className="text-center pb-6 border-b border-gray-100">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-ifrn-green to-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-200">
                <KeyRound size={32} className="text-white" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Alterar Senha</h3>
              <p className="text-sm text-gray-500">Mantenha sua conta segura com uma senha forte</p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5">
              {/* Senha Atual */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-5 rounded-xl border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Lock size={16} className="text-gray-500" />
                  Senha Atual
                </label>
                <div className="relative group">
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3.5 pr-12 text-sm focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all font-medium placeholder:text-gray-400"
                    placeholder="Digite sua senha atual"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ifrn-green transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showCurrentPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Nova Senha */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50/50 p-5 rounded-xl border border-green-200">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Key size={16} className="text-ifrn-green" />
                  Nova Senha
                </label>
                <div className="relative group">
                  <input
                    type={showNewPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-white border-2 border-green-200 rounded-xl px-4 py-3.5 pr-12 text-sm focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all font-medium placeholder:text-gray-400"
                    placeholder="Digite a nova senha"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ifrn-green transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showNewPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                  <AlertCircle size={12} />
                  Mínimo de 3 caracteres
                </p>
              </div>

              {/* Confirmar Senha */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50/50 p-5 rounded-xl border border-green-200">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Confirmar Nova Senha
                </label>
                <div className="relative group">
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-white border-2 border-green-200 rounded-xl px-4 py-3.5 pr-12 text-sm focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all font-medium placeholder:text-gray-400"
                    placeholder="Confirme a nova senha"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ifrn-green transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showConfirmPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-6 flex gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowPasswordModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                  className="flex-1 px-6 py-3.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-ifrn-green to-emerald-600 text-white rounded-xl hover:shadow-lg hover:shadow-green-200 hover:-translate-y-0.5 active:translate-y-0 font-bold transition-all text-sm flex items-center justify-center gap-2"
                >
                  <KeyRound size={18} />
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </Modal>

        <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="Configurações do Sistema">
          <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
            <form onSubmit={handleSaveSystemConfig} className="space-y-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <h4 className="font-bold text-gray-800 flex items-center gap-2 pb-2 border-b border-blue-100"><Building2 size={18} className="text-blue-600" /> Personalizar Campus</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome do Setor</label><input type="text" value={configSector} onChange={e => setConfigSector(e.target.value.toUpperCase())} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="Ex: COADES" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome do Campus</label><input type="text" value={configCampus} onChange={e => setConfigCampus(e.target.value.toUpperCase())} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus://ifrn-green outline-none uppercase" placeholder="Ex: NOVA CRUZ" /></div>
              </div>
              <div className="flex justify-end pt-2"><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"><Save size={16} /> Salvar Alterações</button></div>
            </form>


            {user.level === UserLevel.ADMIN && (
              <div className="border-t border-gray-100 pt-4 mt-4">
                <button type="button" onClick={() => setDesktopDeleteOpen(!desktopDeleteOpen)} className="w-full flex items-center justify-between p-3 bg-red-50 text-red-800 rounded-lg hover:bg-red-100 transition-colors">
                  <div className="flex items-center gap-2 font-bold"><Trash size={18} /> Apagar Dados Administrativos</div>
                  {desktopDeleteOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {desktopDeleteOpen && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
                    <button onClick={() => initiateConfigAction('DELETE_ITEMS')} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors group gap-3"><div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-red-500"><Trash size={20} /></div><div className="text-left"><p className="font-bold text-gray-800 text-sm group-hover:text-red-700">Apagar Itens</p><p className="text-[10px] text-gray-500">Todos os achados.</p></div></button>
                    <button onClick={() => initiateConfigAction('DELETE_REPORTS')} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors group gap-3"><div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-red-500"><FileX size={20} /></div><div className="text-left"><p className="font-bold text-gray-800 text-sm group-hover:text-red-700">Apagar Relatos</p><p className="text-[10px] text-gray-500">Todos os perdidos.</p></div></button>
                    <button onClick={() => initiateConfigAction('DELETE_PEOPLE')} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors group gap-3"><div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-red-500"><UserX size={20} /></div><div className="text-left"><p className="font-bold text-gray-800 text-sm group-hover:text-red-700">Apagar Pessoas</p><p className="text-[10px] text-gray-500">Todos os cadastros.</p></div></button>
                    <button onClick={() => initiateConfigAction('DELETE_USERS')} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors group gap-3"><div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-red-500"><ShieldCheck size={20} /></div><div className="text-left"><p className="font-bold text-gray-800 text-sm group-hover:text-red-700">Apagar Usuários</p><p className="text-[10px] text-gray-500">Exceto você.</p></div></button>
                    <button onClick={() => initiateConfigAction('FACTORY_RESET')} className="col-span-1 md:col-span-2 w-full flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors group"><div className="flex items-center gap-3"><div className="p-2 bg-white rounded-lg text-red-600"><AlertTriangle size={20} /></div><div className="text-left"><p className="font-bold text-red-800">Configuração de Fábrica</p><p className="text-xs text-red-600">Apaga TUDO e restaura o estado inicial.</p></div></div></button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>

        <Modal isOpen={!!confirmAction} onClose={() => { setConfirmAction(null); setConfirmationPassword(''); }} title="Confirmação de Segurança">
          <form onSubmit={executeConfigAction} className="space-y-4">
            <div className="bg-red-50 text-red-800 p-4 rounded-lg text-sm mb-4 border border-red-200"><p className="font-bold">Esta ação é irreversível.</p><p>Por favor, confirme sua senha de administrador para continuar.</p><p className="mt-2 text-xs font-mono bg-white/50 p-1 rounded inline-block">Ação: {getActionName()}</p></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Sua Senha</label><input type="password" required value={confirmationPassword} onChange={e => setConfirmationPassword(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="Confirme sua senha..." autoFocus /></div>
            <div className="pt-4 flex justify-end gap-3 border-t"><button type="button" onClick={() => { setConfirmAction(null); setConfirmationPassword(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button><button type="submit" disabled={loading} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold flex items-center gap-2">{loading ? '...' : <><AlertTriangle size={18} /> Confirmar Exclusão</>}</button></div>
          </form>
        </Modal>
      </div>
    );
  }

  // 3. Main Dashboard
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col animate-slideInLeft overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <IfrnLogo className="scale-90 origin-left flex-shrink-0" sector={systemSector} campus={systemCampus} />
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-red-500 p-1"><X size={24} /></button>
            </div>
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-ifrn-green text-white flex items-center justify-center font-bold text-lg">{user.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.level}</p>
                </div>
              </div>
              <button onClick={() => { setShowPasswordModal(true); setMobileMenuOpen(false); }} className="mt-3 w-full flex items-center justify-center gap-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50"><KeyRound size={14} /> Alterar Senha</button>
              <button
                onClick={() => { setShowModuleSelector(true); setMobileMenuOpen(false); }}
                className="mt-2 w-full flex items-center justify-center gap-2 text-xs font-bold text-ifrn-green bg-green-50 border border-green-100 py-1.5 rounded-lg hover:bg-green-100 transition-colors"
              >
                <LayoutGrid size={14} /> Tela Inicial
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-2">
              {currentSystem === 'achados' && (
                <>
                  <button onClick={() => handleMobileNav('achados')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'achados' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><Package size={20} /> Itens Achados</button>
                  <button onClick={() => handleMobileNav('relatos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'relatos' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><ClipboardList size={20} /> Relatos de Perdidos</button>
                </>
              )}
              {currentSystem === 'armarios' && (
                <button onClick={() => handleMobileNav('armarios')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'armarios' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><Key size={20} /> Gestão de Armários</button>
              )}
              {currentSystem === 'livros' && (
                <>
                  <button onClick={() => handleMobileNav('livros-catalogo')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'livros-catalogo' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><BookOpen size={20} /> Catálogo de Livros</button>
                  <button onClick={() => handleMobileNav('livros-emprestimos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'livros-emprestimos' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><ArrowRight size={20} /> Empréstimos</button>
                </>
              )}
              {currentSystem === 'nadaconsta' && (
                <button onClick={() => handleMobileNav('nadaconsta')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'nadaconsta' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><FileCheck size={20} /> Nada Consta</button>
              )}
              {currentSystem === 'materiais' && (
                <button onClick={() => handleMobileNav('materiais')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'materiais' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><LayoutGrid size={20} /> Empréstimos</button>
              )}

              {canConfigure && (
                <div className="pt-4 mt-2 border-t border-gray-100">
                  <button onClick={() => setConfigMenuOpen(!configMenuOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium text-sm text-gray-600 hover:bg-gray-50">
                    <div className="flex items-center gap-3"><Settings size={20} /> Configurações</div>
                    {configMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {configMenuOpen && (
                    <div className="bg-gray-50 rounded-lg mt-1 overflow-hidden transition-all p-2 space-y-1">
                      <button onClick={() => { openConfigModal(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 rounded"><Building2 size={14} /> Personalizar Campus</button>
                      {user.level === UserLevel.ADMIN && (
                        <>
                          <button onClick={() => setMobileDeleteOpen(!mobileDeleteOpen)} className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded mt-1">
                            <div className="flex items-center gap-2"><Trash size={14} /> Apagar Dados</div>
                            {mobileDeleteOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          {mobileDeleteOpen && (
                            <div className="pl-4 space-y-1 mt-1 border-l-2 border-red-100 ml-2 animate-fadeIn">
                              <button onClick={() => initiateConfigAction('DELETE_ITEMS')} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded"><Trash size={14} /> Apagar Itens Achados</button>
                              <button onClick={() => initiateConfigAction('DELETE_REPORTS')} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded"><FileX size={14} /> Apagar Relatos</button>
                              <button onClick={() => initiateConfigAction('DELETE_PEOPLE')} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded"><UserX size={14} /> Apagar Pessoas</button>
                              <button onClick={() => initiateConfigAction('DELETE_USERS')} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded"><ShieldCheck size={14} /> Apagar Usuários</button>
                              <button onClick={() => initiateConfigAction('FACTORY_RESET')} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 rounded"><AlertTriangle size={14} /> Reset de Fábrica</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </nav>
            <div className="p-4 border-t border-gray-100">
              <button onClick={handleLogout} className="w-full flex items-center gap-2 justify-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"><LogOut size={18} /> Sair do Sistema</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-gray-500 hover:text-ifrn-green p-1 transition-colors"><Menu size={24} /></button>
            <IfrnLogo sector={systemSector} campus={systemCampus} className="flex-shrink-0" />
          </div>
          <div className="flex items-center gap-4">
            {loading && <Loader2 className="animate-spin text-ifrn-green" size={20} />}
            <div className="text-right hidden md:block">
              <div className="text-sm font-bold text-gray-800 flex items-center justify-end gap-2">{user.name}<button onClick={() => setShowPasswordModal(true)} className="text-gray-400 hover:text-ifrn-green p-1 rounded-full transition-colors" title="Alterar Minha Senha"><KeyRound size={14} /></button></div>
              <div className="text-xs text-gray-500">{user.level} • {user.matricula}</div>
            </div>

            <button
              onClick={() => setShowModuleSelector(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-600 hover:text-ifrn-green hover:bg-green-50 rounded-lg transition-all text-xs font-bold border border-gray-100"
              title="Tela Inicial"
            >
              <LayoutGrid size={16} /> <span className="hidden lg:inline">Ir para Início</span>
            </button>
            {canConfigure && (
              <button onClick={openConfigModal} className="hidden md:block p-2 text-gray-500 hover:text-ifrn-green transition-colors" title="Configurações Administrativas"><Settings size={20} /></button>
            )}
            <div className="hidden md:block h-8 w-px bg-gray-200 mx-1"></div>
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 transition-colors hidden md:block" title="Sair"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        <div className="hidden md:flex flex-wrap gap-2 border-b border-gray-200 pb-1">
          {currentSystem === 'achados' && (
            <>
              <button onClick={() => setActiveTab('achados')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'achados' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><Package size={18} /> Itens Achados</button>
              <button onClick={() => setActiveTab('relatos')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'relatos' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><ClipboardList size={18} /> Relatos de Perdidos</button>
            </>
          )}
          {currentSystem === 'armarios' && (
            <button onClick={() => setActiveTab('armarios')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'armarios' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><Key size={18} /> Gestão de Armários</button>
          )}
          {currentSystem === 'livros' && (
            <>
              <button onClick={() => setActiveTab('livros-catalogo')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'livros-catalogo' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><BookOpen size={18} /> Catálogo de Livros</button>
              <button onClick={() => setActiveTab('livros-emprestimos')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'livros-emprestimos' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><ArrowRight size={18} /> Empréstimos</button>
            </>
          )}
          {currentSystem === 'nadaconsta' && (
            <button onClick={() => setActiveTab('nadaconsta')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'nadaconsta' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><FileCheck size={18} /> Sistema de Nada Consta</button>
          )}
          {currentSystem === 'materiais' && (
            <button onClick={() => setActiveTab('materiais')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'materiais' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><LayoutGrid size={18} /> Empréstimos de Material</button>
          )}

        </div>
        <div className="min-h-[400px]">
          {loading && activeTab !== 'none' ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-ifrn-green" size={48} /></div>
          ) : (
            <>
              {activeTab === 'achados' && <FoundItemsTab items={items} people={people} reports={reports} onUpdate={refreshData} user={user} />}
              {activeTab === 'relatos' && <LostReportsTab reports={reports} people={people} items={items} onUpdate={refreshData} user={user} />}
              {activeTab === 'pessoas' && <PeopleTab people={people} onUpdate={refreshData} user={user} />}
              {activeTab === 'armarios' && <ArmariosTab user={user} people={people} lockers={lockers} onUpdate={refreshData} />}
              {activeTab === 'livros-catalogo' && <BooksTab books={books} bookLoans={bookLoans} onUpdate={refreshData} user={user} />}
              {activeTab === 'livros-emprestimos' && <BookLoansTab loans={bookLoans} books={books} people={people} onUpdate={refreshData} user={user} />}
              {activeTab === 'nadaconsta' && <NadaConstaTab people={people} lockers={lockers} bookLoans={bookLoans} materialLoans={materialLoans} />}
              {activeTab === 'materiais' && <MaterialManagementTab materials={materials} loans={materialLoans} people={people} user={user} onUpdate={refreshData} />}
              {activeTab === 'usuarios' && <UsersTab users={users} currentUser={user} onUpdate={refreshData} people={people} />}
            </>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} Desenvolvido por David Galdino</p>
        </div>
      </footer>

      <Modal isOpen={showPasswordModal} onClose={() => { setShowPasswordModal(false); setShowCurrentPass(false); setShowNewPass(false); setShowConfirmPass(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }} title="">
        <div className="space-y-6">
          {/* Header Moderno */}
          <div className="text-center pb-6 border-b border-gray-100">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-ifrn-green to-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-200">
              <KeyRound size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Alterar Senha</h3>
            <p className="text-sm text-gray-500">Mantenha sua conta segura com uma senha forte</p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-5">
            {/* Senha Atual */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-5 rounded-xl border border-gray-200">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Lock size={16} className="text-gray-500" />
                Senha Atual
              </label>
              <div className="relative group">
                <input
                  type={showCurrentPass ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3.5 pr-12 text-sm focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all font-medium placeholder:text-gray-400"
                  placeholder="Digite sua senha atual"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ifrn-green transition-colors p-1"
                  tabIndex={-1}
                >
                  {showCurrentPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Nova Senha */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50/50 p-5 rounded-xl border border-green-200">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Key size={16} className="text-ifrn-green" />
                Nova Senha
              </label>
              <div className="relative group">
                <input
                  type={showNewPass ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-white border-2 border-green-200 rounded-xl px-4 py-3.5 pr-12 text-sm focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all font-medium placeholder:text-gray-400"
                  placeholder="Digite a nova senha"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ifrn-green transition-colors p-1"
                  tabIndex={-1}
                >
                  {showNewPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                <AlertCircle size={12} />
                Mínimo de 3 caracteres
              </p>
            </div>

            {/* Confirmar Senha */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50/50 p-5 rounded-xl border border-green-200">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Confirmar Nova Senha
              </label>
              <div className="relative group">
                <input
                  type={showConfirmPass ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-white border-2 border-green-200 rounded-xl px-4 py-3.5 pr-12 text-sm focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all font-medium placeholder:text-gray-400"
                  placeholder="Confirme a nova senha"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ifrn-green transition-colors p-1"
                  tabIndex={-1}
                >
                  {showConfirmPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="pt-6 flex gap-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => { setShowPasswordModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                className="flex-1 px-6 py-3.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-all text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3.5 bg-gradient-to-r from-ifrn-green to-emerald-600 text-white rounded-xl hover:shadow-lg hover:shadow-green-200 hover:-translate-y-0.5 active:translate-y-0 font-bold transition-all text-sm flex items-center justify-center gap-2"
              >
                <KeyRound size={18} />
                Salvar Nova Senha
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="Configurações do Sistema">
        <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
          <form onSubmit={handleSaveSystemConfig} className="space-y-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
            <h4 className="font-bold text-gray-800 flex items-center gap-2 pb-2 border-b border-blue-100"><Building2 size={18} className="text-blue-600" /> Personalizar Campus</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome do Setor</label><input type="text" value={configSector} onChange={e => setConfigSector(e.target.value.toUpperCase())} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="Ex: COADES" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome do Campus</label><input type="text" value={configCampus} onChange={e => setConfigCampus(e.target.value.toUpperCase())} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="Ex: NOVA CRUZ" /></div>
            </div>
            <div className="flex justify-end pt-2"><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"><Save size={16} /> Salvar Alterações</button></div>
          </form>


          {user.level === UserLevel.ADMIN && (
            <div className="border-t border-gray-100 pt-4 mt-4">
              <button type="button" onClick={() => setDesktopDeleteOpen(!desktopDeleteOpen)} className="w-full flex items-center justify-between p-3 bg-red-50 text-red-800 rounded-lg hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-2 font-bold"><Trash size={18} /> Apagar Dados Administrativos</div>
                {desktopDeleteOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {desktopDeleteOpen && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
                  <button onClick={() => initiateConfigAction('DELETE_ITEMS')} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors group gap-3"><div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-red-500"><Trash size={20} /></div><div className="text-left"><p className="font-bold text-gray-800 text-sm group-hover:text-red-700">Apagar Itens</p><p className="text-[10px] text-gray-500">Todos os achados.</p></div></button>
                  <button onClick={() => initiateConfigAction('DELETE_REPORTS')} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors group gap-3"><div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-red-500"><FileX size={20} /></div><div className="text-left"><p className="font-bold text-gray-800 text-sm group-hover:text-red-700">Apagar Relatos</p><p className="text-[10px] text-gray-500">Todos os perdidos.</p></div></button>
                  <button onClick={() => initiateConfigAction('DELETE_PEOPLE')} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors group gap-3"><div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-red-500"><UserX size={20} /></div><div className="text-left"><p className="font-bold text-gray-800 text-sm group-hover:text-red-700">Apagar Pessoas</p><p className="text-[10px] text-gray-500">Todos os cadastros.</p></div></button>
                  <button onClick={() => initiateConfigAction('DELETE_USERS')} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors group gap-3"><div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white text-gray-600 group-hover:text-red-500"><ShieldCheck size={20} /></div><div className="text-left"><p className="font-bold text-gray-800 text-sm group-hover:text-red-700">Apagar Usuários</p><p className="text-[10px] text-gray-500">Exceto você.</p></div></button>
                  <button onClick={() => initiateConfigAction('FACTORY_RESET')} className="col-span-1 md:col-span-2 w-full flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors group"><div className="flex items-center gap-3"><div className="p-2 bg-white rounded-lg text-red-600"><AlertTriangle size={20} /></div><div className="text-left"><p className="font-bold text-red-800">Configuração de Fábrica</p><p className="text-xs text-red-600">Apaga TUDO e restaura o estado inicial.</p></div></div></button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={!!confirmAction} onClose={() => { setConfirmAction(null); setConfirmationPassword(''); }} title="Confirmação de Segurança">
        <form onSubmit={executeConfigAction} className="space-y-4">
          <div className="bg-red-50 text-red-800 p-4 rounded-lg text-sm mb-4 border border-red-200"><p className="font-bold">Esta ação é irreversível.</p><p>Por favor, confirme sua senha de administrador para continuar.</p><p className="mt-2 text-xs font-mono bg-white/50 p-1 rounded inline-block">Ação: {getActionName()}</p></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Sua Senha</label><input type="password" required value={confirmationPassword} onChange={e => setConfirmationPassword(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="Confirme sua senha..." autoFocus /></div>
          <div className="pt-4 flex justify-end gap-3 border-t"><button type="button" onClick={() => { setConfirmAction(null); setConfirmationPassword(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button><button type="submit" disabled={loading} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold flex items-center gap-2">{loading ? '...' : <><AlertTriangle size={18} /> Confirmar Exclusão</>}</button></div>
        </form>
      </Modal>
    </div>
  );
};

export default App;