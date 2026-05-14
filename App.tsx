import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StorageService, supabase } from './services/storage';
import { User, UserLevel, FoundItem, LostReport, Person, Book, BookLoan, Campus, CopyConfig, CopyRecord, Supply, SupplyRecord, StudentNotification } from './types';
import { Locker } from './types-armarios';
import { Material, MaterialLoan } from './types-materiais';
import { IfrnLogo } from './components/Logo';
// Lazy load tabs to improve initial load performance
const FoundItemsTab = React.lazy(() => import('./components/Tabs/FoundItemsTab').then(module => ({ default: module.FoundItemsTab })));
const LostReportsTab = React.lazy(() => import('./components/Tabs/LostReportsTab').then(module => ({ default: module.LostReportsTab })));
const PeopleTab = React.lazy(() => import('./components/Tabs/PeopleTab').then(module => ({ default: module.PeopleTab })));
const UsersTab = React.lazy(() => import('./components/Tabs/UsersTab').then(module => ({ default: module.UsersTab })));
const ArmariosTab = React.lazy(() => import('./components/Tabs/ArmariosTab').then(module => ({ default: module.ArmariosTab })));
const BooksTab = React.lazy(() => import('./components/Tabs/BooksTab').then(module => ({ default: module.BooksTab })));
const BookLoansTab = React.lazy(() => import('./components/Tabs/BookLoansTab').then(module => ({ default: module.BookLoansTab })));
const BookReportsTab = React.lazy(() => import('./components/Tabs/BookReportsTab').then(module => ({ default: module.BookReportsTab })));
const NadaConstaTab = React.lazy(() => import('./components/Tabs/NadaConstaTab').then(module => ({ default: module.NadaConstaTab })));
const MaterialManagementTab = React.lazy(() => import('./components/Tabs/MaterialManagementTab').then(module => ({ default: module.MaterialManagementTab })));
const CopyControlTab = React.lazy(() => import('./components/Tabs/CopyControlTab'));
const InsumosTab = React.lazy(() => import('./components/Tabs/InsumosTab').then(module => ({ default: module.InsumosTab })));
const NotificationsTab = React.lazy(() => import('./components/Tabs/NotificationsTab').then(module => ({ default: module.NotificationsTab })));
const TeacherAttendanceTab = React.lazy(() => import('./components/Tabs/TeacherAttendanceTab').then(module => ({ default: module.TeacherAttendanceTab })));

import { LogOut, Package, ClipboardList, Users, ShieldCheck, KeyRound, Menu, X, Settings, Trash, AlertTriangle, ChevronDown, ChevronUp, UserX, FileX, FileText, Save, Building2, Eye, EyeOff, Loader2, Key, Search, Trash2, ShieldAlert, AlertCircle, CheckCircle2, History, Send, ArrowRight, LayoutGrid, Download, BookOpen, FileCheck, Lock, User as UserIcon, RefreshCcw, ChevronRight, Printer, BarChart3, Truck } from 'lucide-react';
import { Modal } from './components/ui/Modal';
import ErrorBoundary from './components/ui/ErrorBoundary';



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
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('activeTab') || 'achados');
  const [user, setUser] = useState<User | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initialize from sessionStorage
  const [currentSystem, setCurrentSystem] = useState<'achados' | 'armarios' | 'livros' | 'nadaconsta' | 'materiais' | 'copias' | 'insumos' | 'notificacoes' | 'frequencia' | null>(() => {
    return (sessionStorage.getItem('currentSystem') as any) || null;
  });

  const [showModuleSelector, setShowModuleSelector] = useState(() => {
    // If we have a current system stored in session, don't show selector initially (for F5)
    return !sessionStorage.getItem('currentSystem');
  });

  const [loading, setLoading] = useState(false);
  const [isBackdropSleep, setIsBackdropSleep] = useState(false);

  // Settings / Admin Config State
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isPeopleLoading, setIsPeopleLoading] = useState(false);

  // Data State
  const [items, setItems] = useState<FoundItem[]>([]);
  const [reports, setReports] = useState<LostReport[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  // Mantendo apenas para tipos se necessário, mas vazio
  const [books, setBooks] = useState<Book[]>([]);
  const [bookLoans, setBookLoans] = useState<BookLoan[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialLoans, setMaterialLoans] = useState<MaterialLoan[]>([]);
  const [copyRecords, setCopyRecords] = useState<CopyRecord[]>([]);
  const [copyConfigs, setCopyConfigs] = useState<CopyConfig[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [supplyRecords, setSupplyRecords] = useState<SupplyRecord[]>([]);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);

  // Otimização para 50k+ alunos: Índice de busca pré-normalizado
  // Manter em Ref evita overhead de renderização e permite busca ultra-rápida
  const peopleSearchIndexRef = useRef<{ id: string, searchStr: string }[]>([]);
  const lastFetchIdRef = useRef(0);

  const [users, setUsers] = useState<User[]>([]);

  // Global Admin Campus Switcher
  const [adminGlobalCampusId, setAdminGlobalCampusId] = useState<string | null>(null);


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
      sessionStorage.setItem('activeTab', activeTab);
    }
  }, [activeTab, user]);

  const hasAccess = (mod: keyof NonNullable<User['permissions']>) => {
    if (!user) return false;
    if (user.level === UserLevel.ADMIN) return true;

    if (user.permissions && user.permissions[mod] !== undefined) {
      return user.permissions[mod];
    }

    if (mod === 'nadaconsta') return true;
    if (mod === 'copias' || mod === 'insumos' || mod === 'notificacoes' || mod === 'frequencia') return false;
    if (user.level === UserLevel.STANDARD) return false;

    return true;
  };

  // Refresh Data Individual Helpers
  const refreshItems = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    setItems(await StorageService.getItems(campusId));
  }, [user, adminGlobalCampusId]);

  const refreshReports = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    setReports(await StorageService.getReports(campusId));
  }, [user, adminGlobalCampusId]);

  // Removido refreshPeople massivo

  const refreshUsers = useCallback(async () => {
    if (!user || user.level !== UserLevel.ADMIN) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    setUsers(await StorageService.getUsers(campusId));
  }, [user, adminGlobalCampusId]);

  const refreshCampuses = useCallback(async () => {
    setCampuses(await StorageService.getCampuses());
  }, []);

  const refreshBooks = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    setBooks(await StorageService.getBooks(campusId));
  }, [user, adminGlobalCampusId]);

  const refreshBookLoans = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    setBookLoans(await StorageService.getBookLoans(campusId));
  }, [user, adminGlobalCampusId]);

  const refreshLockers = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    setLockers(await StorageService.getLockers(campusId));
  }, [user, adminGlobalCampusId]);

  const refreshMaterials = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    setMaterials(await StorageService.getMaterials(campusId));
  }, [user, adminGlobalCampusId]);

  const refreshMaterialLoans = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    setMaterialLoans(await StorageService.getMaterialLoans(campusId));
  }, [user, adminGlobalCampusId]);

  const refreshCopyRecords = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    setCopyRecords(await StorageService.getCopyRecords(campusId || ''));
  }, [user, adminGlobalCampusId]);

  const refreshCopyConfigs = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    if (campusId) {
      const config = await StorageService.getCopyConfig(campusId);
      if (config) setCopyConfigs([config]);
    }
  }, [user, adminGlobalCampusId]);

  const refreshSupplies = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    setSupplies(await StorageService.getSupplies(campusId));
  }, [user, adminGlobalCampusId]);

  const refreshSupplyRecords = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    setSupplyRecords(await StorageService.getSupplyRecords(campusId));
  }, [user, adminGlobalCampusId]);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const [notifs, types] = await Promise.all([
      StorageService.getNotifications(campusId),
      StorageService.getNotificationTypes(campusId)
    ]);
    setNotifications(notifs);
    setNotificationTypes(types);
  }, [user, adminGlobalCampusId]);

  // Refresh Data Helper (Async) with Timeout
  const refreshData = useCallback(async () => {
    if (!user || isBackdropSleep) return;

    const fetchId = ++lastFetchIdRef.current;
    setLoading(true);

    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    try {
      // Lazy Loading: Só carrega dados do sistema atual
      // Isso reduz drasticamente o uso de memória no Android

      if (currentSystem === 'achados' || activeTab === 'achados' || activeTab === 'relatos') {
        const [fetchedItems, fetchedReports] = await Promise.all([
          StorageService.getItems(campusId),
          StorageService.getReports(campusId)
        ]);

        if (fetchId !== lastFetchIdRef.current) return;

        setItems(fetchedItems);
        setReports(fetchedReports);
        // Limpar outros dados pesados
        setBooks([]);
        setBookLoans([]);
        setLockers([]);
        setMaterials([]);
        setMaterialLoans([]);
      } else if (currentSystem === 'armarios' || activeTab === 'armarios') {
        const [fetchedLockers] = await Promise.all([
          StorageService.getLockers(campusId)
        ]);

        if (fetchId !== lastFetchIdRef.current) return;

        setLockers(fetchedLockers);
        setItems([]);
        setReports([]);
        setBooks([]);
        setBookLoans([]);
        setMaterials([]);
        setMaterialLoans([]);
      } else if (currentSystem === 'livros' || activeTab.startsWith('livros')) {
        const [fetchedBooks, fetchedLoans] = await Promise.all([
          StorageService.getBooks(campusId),
          StorageService.getBookLoans(campusId)
        ]);

        if (fetchId !== lastFetchIdRef.current) return;

        setBooks(fetchedBooks);
        setBookLoans(fetchedLoans);
        setItems([]);
        setReports([]);
        setLockers([]);
        setMaterials([]);
        setMaterialLoans([]);
      } else if (currentSystem === 'nadaconsta' || activeTab === 'nadaconsta') {
        const [fetchedLockers, fetchedBooks, fetchedBookLoans, fetchedMaterials, fetchedMaterialLoans] = await Promise.all([
          StorageService.getLockers(campusId),
          StorageService.getBooks(campusId),
          StorageService.getBookLoans(campusId),
          StorageService.getMaterials(campusId),
          StorageService.getMaterialLoans(campusId)
        ]);

        if (fetchId !== lastFetchIdRef.current) return;

        setLockers(fetchedLockers);
        setBooks(fetchedBooks);
        setBookLoans(fetchedBookLoans);
        setMaterials(fetchedMaterials);
        setMaterialLoans(fetchedMaterialLoans);
        setItems([]);
        setReports([]);
      } else if (currentSystem === 'materiais' || activeTab === 'materiais') {
        const [fetchedMaterials, fetchedMaterialLoans] = await Promise.all([
          StorageService.getMaterials(campusId),
          StorageService.getMaterialLoans(campusId)
        ]);

        if (fetchId !== lastFetchIdRef.current) return;

        setMaterials(fetchedMaterials);
        setMaterialLoans(fetchedMaterialLoans);
        setItems([]);
        setReports([]);
        setLockers([]);
        setBooks([]);
        setBookLoans([]);
      } else if (currentSystem === 'insumos' || activeTab === 'insumos') {
        const [fetchedSupplies, fetchedSupplyRecords] = await Promise.all([
          StorageService.getSupplies(campusId),
          StorageService.getSupplyRecords(campusId)
        ]);

        if (fetchId !== lastFetchIdRef.current) return;

        setSupplies(fetchedSupplies);
        setSupplyRecords(fetchedSupplyRecords);
        setItems([]);
        setReports([]);
        setLockers([]);
        setBooks([]);
        setBookLoans([]);
        setMaterials([]);
        setMaterialLoans([]);
      } else if (currentSystem === 'notificacoes' || activeTab === 'notificacoes') {
        const [fetchedNotifications, fetchedTypes] = await Promise.all([
          StorageService.getNotifications(campusId),
          StorageService.getNotificationTypes(campusId)
        ]);

        if (fetchId !== lastFetchIdRef.current) return;

        setNotifications(fetchedNotifications);
        setNotificationTypes(fetchedTypes);
        setItems([]);
        setReports([]);
        setLockers([]);
        setBooks([]);
        setBookLoans([]);
        setMaterials([]);
        setMaterialLoans([]);
      } else if (currentSystem === 'copias' || activeTab === 'copias') {
        const [fetchedRecords, fetchedConfig] = await Promise.all([
          StorageService.getCopyRecords(campusId || ''),
          campusId ? StorageService.getCopyConfig(campusId) : Promise.resolve(null)
        ]);

        if (fetchId !== lastFetchIdRef.current) return;

        setCopyRecords(fetchedRecords);
        if (fetchedConfig) setCopyConfigs([fetchedConfig]);
        setItems([]);
        setReports([]);
        setLockers([]);
        setBooks([]);
        setBookLoans([]);
        setMaterials([]);
        setMaterialLoans([]);
      } else if (activeTab === 'usuarios') {
        const [fetchedUsers, fetchedCampuses] = await Promise.all([
          StorageService.getUsers(campusId),
          StorageService.getCampuses()
        ]);

        if (fetchId !== lastFetchIdRef.current) return;

        setUsers(fetchedUsers);
        setCampuses(fetchedCampuses);
      } else if (activeTab === 'pessoas') {
        // People data is now fetched directly by PeopleTab
      }
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    } finally {
      if (fetchId === lastFetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [user, currentSystem, activeTab, adminGlobalCampusId]);

  const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  // Carrega as pessoas do campus APENAS quando o campus ou usuário muda
  // Carregar pessoas apenas quando necessário (Lazy Loading) para economizar memória (18k+ registros)
  const tabsNeedingPeople = ['pessoas', 'achados', 'relatos', 'armarios', 'livros-catalogo', 'livros-emprestimos'];

  useEffect(() => {
    // People data is now fetched directly by PeopleTab
  }, [user?.id, user?.campus_id, adminGlobalCampusId, user?.level, activeTab]);

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
        case 'people': /* People data is now fetched directly by PeopleTab */ break;
        case 'users': refreshUsers(); break;
        case 'books': refreshBooks(); break;
        case 'book_loans': refreshBookLoans(); break;
        case 'lockers': refreshLockers(); break;
        case 'materials': refreshMaterials(); break;
        case 'material_loans': refreshMaterialLoans(); break;
        case 'supplies': refreshSupplies(); break;
        case 'supply_records': refreshSupplyRecords(); break;
        case 'student_notifications': refreshNotifications(); break;
        case 'teacher_schedules':
        case 'teacher_attendance': refreshData(); break;
      }
    }, 1000); // 1 second debounce
  }, [refreshItems, refreshReports, refreshUsers, refreshBooks, refreshBookLoans, refreshLockers, refreshMaterials, refreshMaterialLoans, refreshNotifications]);

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
    // System-wide sector/campus configuration removed
  }, []);

  const handleLogout = useCallback(async () => {
    await StorageService.clearSession();
    setUser(null);
    setLoginMat('');
    setLoginPass('');
    setShowLoginPassword(false);
    setActiveTab('achados');
    sessionStorage.removeItem('activeTab');
    sessionStorage.removeItem('currentSystem'); // Clear system persistence
    setMobileMenuOpen(false);
    setConfigMenuOpen(false);
    setShowModuleSelector(false);
    setCurrentSystem(null);
  }, []);

  // 1. Initial System Load
  useEffect(() => {
    loadSystemConfig();

    const initSession = async () => {
      // Start session Check
      setIsSessionLoading(true);
      try {
        const sessionUser = await StorageService.getSessionUser();
        if (sessionUser) {
          if (await StorageService.isSessionExpired()) {
            await StorageService.clearSession();
            setUser(null);
          } else {
            setUser(sessionUser);
            StorageService.updateLastActive();
            // Only show module selector if we don't have a persisted system in session (for F5)
            const persistedSystem = sessionStorage.getItem('currentSystem');
            if (persistedSystem) {
              setShowModuleSelector(false);
              // currentSystem initialized from state, so it should match
            } else {
              setShowModuleSelector(true);
            }
          }
        }
      } catch (e) {
        console.error("Session check failed", e);
      } finally {
        setIsSessionLoading(false);
      }
    };
    initSession();
    refreshCampuses();
  }, [loadSystemConfig, refreshCampuses]);

  // Handle module order
  useEffect(() => {
    if (user) {
      const defaultOrder = ['frequencia', 'copias', 'insumos', 'notificacoes', 'achados', 'armarios', 'livros', 'nadaconsta', 'materiais', 'pessoas', 'usuarios'];
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
  // Backdrop Sleep: Purge everything when system is in "Photo Mode"
  useEffect(() => {
    if (!isBackdropSleep) {
      refreshData();
    }
  }, [isBackdropSleep, user, refreshData]); // Removed data purging logic to preserve state

  // View switch: Refresh data when system or tab changes
  useEffect(() => {
    if (!isBackdropSleep && user) { // Only refresh if not in backdrop sleep and user is logged in
      refreshData();
    }
  }, [currentSystem, activeTab, refreshData, isBackdropSleep, user, adminGlobalCampusId]);

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
    setShowConfigModal(true);
  };

  const handleSaveSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    // Section removed per user request
    setShowConfigModal(false);
  };



  const canConfigure = user?.level === UserLevel.ADMIN;

  // 1. Initial Login Screen
  if (isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
        <Loader2 className="animate-spin text-ifrn-green" size={48} />
        <p className="text-gray-500 font-medium">Carregando sistema...</p>
      </div>
    );
  }

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
              <span className="text-7xl font-black text-white">SIGAE</span>
              <div className="flex flex-col mt-3">
                <span className="text-3xl font-black text-green-200 uppercase tracking-tight">Instituto Federal</span>
                <span className="text-3xl font-medium text-white">Rio Grande do Norte</span>
              </div>
            </h1>
            <p className="text-xl text-green-100 font-medium leading-relaxed max-w-md border-l-4 border-green-400 pl-6">
              Sistema de Gestão de Administração Escolar
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
                <br /> <span className="italic">Desenvolvido por <span className="font-semibold text-gray-500">David Galdino</span></span>
              </p>
            </div>


            {/*&copy; {new Date().getFullYear()} IFRN - Campus {systemCampus}. <br /> Todos os direitos reservados.*/}
          </div>
        </div >
      </div >
    );
  }

  // 2. Module Selector Screen
  if (showModuleSelector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-6">
        <div className="max-w-7xl w-full">
          <div className="mb-16 animate-fade-in-down border-b border-gray-200/50 pb-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
              <div className="px-4">
                <IfrnLogo
                  className="scale-110 sm:scale-125 drop-shadow-sm origin-left"
                  campus={user?.level === UserLevel.ADMIN ? "" : (campuses.find(c => c.id === user?.campus_id)?.name || '')}
                />
              </div>

              {user.level === UserLevel.ADMIN && (
                <div className="w-full md:w-80 space-y-3 px-4 animate-fade-in-right">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Building2 size={14} /> Visualizar Câmpus
                  </label>
                  <div className="relative group">
                    <select
                      value={adminGlobalCampusId || ''}
                      onChange={e => setAdminGlobalCampusId(e.target.value || null)}
                      className="w-full bg-white border-2 border-gray-200 text-gray-800 text-sm font-bold rounded-2xl px-4 py-3.5 focus:ring-4 focus:ring-ifrn-green/10 focus:border-ifrn-green outline-none transition-all cursor-pointer shadow-sm hover:border-gray-300 appearance-none"
                    >
                      <option value="">🌎 Todos os Câmpus</option>
                      {campuses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-ifrn-green transition-colors">
                      <ChevronDown size={20} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Saudação Centralizada */}
            <div className="px-4 space-y-2 text-center animate-fade-in-up">
              <h2 className="text-3xl sm:text-4xl font-black text-gray-800 tracking-tight leading-tight">
                Olá, <span className="text-ifrn-green">{user.name.split(' ')[0]}</span>.
              </h2>
              <p className="text-base sm:text-lg text-gray-500 font-medium">
                Selecione o sistema que deseja gerenciar.
              </p>
            </div>
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
                    sessionStorage.setItem('currentSystem', 'achados');
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
                    sessionStorage.setItem('currentSystem', 'armarios');
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
                    sessionStorage.setItem('currentSystem', 'livros');
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
                    sessionStorage.setItem('currentSystem', 'nadaconsta');
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
                    sessionStorage.setItem('currentSystem', 'materiais');
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
                    sessionStorage.removeItem('currentSystem');
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
                    sessionStorage.removeItem('currentSystem');
                    setActiveTab('usuarios');
                    setShowModuleSelector(false);
                  }
                },
                copias: {
                  id: 'copias',
                  label: 'Controle de Cópias',
                  description: 'Rastreie o uso de impressões e cópias por servidores e departamentos.',
                  icon: <Printer size={32} />,
                  color: 'text-rose-700',
                  iconBg: 'bg-gradient-to-br from-rose-600 to-red-700',
                  textColor: 'text-rose-700',
                  hoverBorder: 'hover:border-rose-600',
                  bgLight: 'bg-rose-50',
                  permission: 'copias',
                  onSelect: () => {
                    setCurrentSystem('copias');
                    sessionStorage.setItem('currentSystem', 'copias');
                    setActiveTab('copias');
                    setShowModuleSelector(false);
                  }
                },
                insumos: {
                  id: 'insumos',
                  label: 'Distribuição de Insumos',
                  description: 'Gerencie o estoque e registre a entrega definitiva de suprimentos para setores e servidores.',
                  icon: <Truck size={32} />,
                  color: 'text-indigo-700',
                  iconBg: 'bg-gradient-to-br from-indigo-600 to-purple-600',
                  textColor: 'text-indigo-700',
                  hoverBorder: 'hover:border-indigo-600',
                  bgLight: 'bg-indigo-50',
                  permission: 'insumos',
                  onSelect: () => {
                    setCurrentSystem('insumos');
                    sessionStorage.setItem('currentSystem', 'insumos');
                    setActiveTab('insumos');
                    setShowModuleSelector(false);
                  }
                },
                notificacoes: {
                  id: 'notificacoes',
                  label: 'Notificação de Alunos',
                  description: 'Registre e acompanhe ocorrências disciplinares e notificações de alunos.',
                  icon: <ShieldAlert size={32} />,
                  color: 'text-red-700',
                  iconBg: 'bg-gradient-to-br from-red-600 to-orange-700',
                  textColor: 'text-red-700',
                  hoverBorder: 'hover:border-red-600',
                  bgLight: 'bg-red-50',
                  permission: 'notificacoes',
                  onSelect: () => {
                    setCurrentSystem('notificacoes');
                    sessionStorage.setItem('currentSystem', 'notificacoes');
                    setActiveTab('notificacoes');
                    setShowModuleSelector(false);
                  }
                },
                frequencia: {
                  id: 'frequencia',
                  label: 'Frequência de Docentes',
                  description: 'Verifique a presença de docentes nas salas e registre substituições ou horários vagos.',
                  icon: <ClipboardList size={32} />,
                  color: 'text-indigo-800',
                  iconBg: 'bg-gradient-to-br from-indigo-700 to-blue-900',
                  textColor: 'text-indigo-800',
                  hoverBorder: 'hover:border-indigo-700',
                  bgLight: 'bg-indigo-50',
                  permission: 'frequencia',
                  onSelect: () => {
                    setCurrentSystem('frequencia');
                    sessionStorage.setItem('currentSystem', 'frequencia');
                    setActiveTab('frequencia');
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
            {/* Seleta de campus e setor removido conforme solicitação */}



          </div>
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
              <IfrnLogo className="scale-90 origin-left flex-shrink-0" campus={user?.level === UserLevel.ADMIN ? "" : (campuses.find(c => c.id === user?.campus_id)?.name || '')} />
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
                onClick={() => { setShowModuleSelector(true); setCurrentSystem(null); sessionStorage.removeItem('currentSystem'); setMobileMenuOpen(false); }}
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
                  <button onClick={() => handleMobileNav('livros-catalogo')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'livros-catalogo' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><BookOpen size={20} /> Livro do Estudante</button>
                  <button onClick={() => handleMobileNav('livros-emprestimos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'livros-emprestimos' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><ArrowRight size={20} /> Empréstimos</button>
                </>
              )}
              {currentSystem === 'nadaconsta' && (
                <button onClick={() => handleMobileNav('nadaconsta')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'nadaconsta' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><FileCheck size={20} /> Nada Consta</button>
              )}
              {currentSystem === 'materiais' && (
                <button onClick={() => handleMobileNav('materiais')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'materiais' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><LayoutGrid size={20} /> Empréstimos</button>
              )}
              {currentSystem === 'insumos' && (
                <button onClick={() => handleMobileNav('insumos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'insumos' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><Truck size={20} /> Distribuição de Insumos</button>
              )}
              {currentSystem === 'notificacoes' && (
                <button onClick={() => handleMobileNav('notificacoes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'notificacoes' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><ShieldAlert size={20} /> Notificação de Alunos</button>
              )}

              {canConfigure && (
                <div className="pt-4 mt-2 border-t border-gray-100">
                  <button onClick={() => setConfigMenuOpen(!configMenuOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium text-sm text-gray-600 hover:bg-gray-50">
                    <div className="flex items-center gap-3"><Settings size={20} /> Configurações</div>
                    {configMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {configMenuOpen && (
                    <div className="bg-gray-50 rounded-xl mt-2 overflow-hidden transition-all p-3 space-y-3">

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
            <IfrnLogo campus={user?.level === UserLevel.ADMIN ? "" : (campuses.find(c => c.id === user?.campus_id)?.name || '')} className="flex-shrink-0" />
          </div>
          <div className="flex items-center gap-4 flex-1 justify-center md:justify-start max-w-sm ml-4">
            {user.level === UserLevel.ADMIN && (
              <div className="relative group w-full hidden md:block">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-hover:text-ifrn-green transition-colors">
                  <Building2 size={16} />
                </div>
                <select
                  value={adminGlobalCampusId || ''}
                  onChange={e => setAdminGlobalCampusId(e.target.value || null)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold rounded-lg pl-9 pr-3 py-1.5 focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all cursor-pointer hover:bg-white"
                >
                  <option value="">🌎 Todos os Câmpus</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {loading && <Loader2 className="animate-spin text-ifrn-green" size={20} />}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-sm font-bold text-gray-800 flex items-center justify-end gap-2">{user.name}<button onClick={() => setShowPasswordModal(true)} className="text-gray-400 hover:text-ifrn-green p-1 rounded-full transition-colors" title="Alterar Minha Senha"><KeyRound size={14} /></button></div>
              <div className="text-xs text-gray-500">{user.level} • {user.matricula}</div>
            </div>

            <button
              onClick={() => { setShowModuleSelector(true); setCurrentSystem(null); sessionStorage.removeItem('currentSystem'); }}
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
              <button onClick={() => setActiveTab('livros-catalogo')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'livros-catalogo' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><BookOpen size={18} /> Livro do Estudante</button>
              <button onClick={() => setActiveTab('livros-emprestimos')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'livros-emprestimos' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><ArrowRight size={18} /> Empréstimos</button>
              <button onClick={() => setActiveTab('livros-relatorios')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'livros-relatorios' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><BarChart3 size={18} /> Relatórios</button>
            </>
          )}
          {currentSystem === 'nadaconsta' && (
            <button onClick={() => setActiveTab('nadaconsta')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'nadaconsta' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><FileCheck size={18} /> Sistema de Nada Consta</button>
          )}
          {currentSystem === 'materiais' && (
            <button onClick={() => setActiveTab('materiais')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'materiais' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><LayoutGrid size={18} /> Empréstimos de Material</button>
          )}
          {currentSystem === 'insumos' && (
            <button onClick={() => setActiveTab('insumos')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'insumos' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><Truck size={18} /> Distribuição de Insumos</button>
          )}
          {currentSystem === 'copias' && (
            <button onClick={() => setActiveTab('copias')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'copias' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><Printer size={18} /> Controle de Cópias</button>
          )}
          {currentSystem === 'notificacoes' && (
            <button onClick={() => setActiveTab('notificacoes')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'notificacoes' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><ShieldAlert size={18} /> Notificação de Alunos</button>
          )}
          {currentSystem === 'frequencia' && (
            <button onClick={() => setActiveTab('frequencia')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'frequencia' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><ClipboardList size={18} /> Frequência de Docentes</button>
          )}

        </div>
        <div className="min-h-[400px]">
          <ErrorBoundary>
            {loading && activeTab !== 'none' ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-ifrn-green" size={48} /></div>
            ) : (
              <React.Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-ifrn-green" size={48} /></div>}>
                {activeTab === 'achados' && (
                  <FoundItemsTab
                    items={items}
                    reports={reports}
                    onUpdate={refreshData}
                    user={user}
                    onToggleSleep={setIsBackdropSleep}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'relatos' && <LostReportsTab reports={reports} items={items} onUpdate={refreshData} user={user} campuses={campuses} adminGlobalCampusId={adminGlobalCampusId} />}
                {activeTab === 'pessoas' && (
                  <PeopleTab
                    onUpdate={refreshData}
                    user={user}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'armarios' && <ArmariosTab user={user} lockers={lockers} onUpdate={refreshData} campuses={campuses} adminGlobalCampusId={adminGlobalCampusId} />}
                {activeTab === 'livros-catalogo' && (
                  <BooksTab
                    books={books}
                    bookLoans={bookLoans}
                    onUpdate={refreshData}
                    user={user}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'livros-emprestimos' && (
                  <BookLoansTab
                    loans={bookLoans}
                    books={books}
                    onUpdate={refreshBookLoans}
                    user={user}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'livros-relatorios' && (
                  <BookReportsTab
                    books={books}
                    loans={bookLoans}
                    user={user}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'copias' && (
                  <CopyControlTab
                    records={copyRecords}
                    config={copyConfigs[0]}
                    user={user}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                    onUpdate={refreshData}
                  />
                )}
                {activeTab === 'nadaconsta' && (
                  <NadaConstaTab
                    lockers={lockers}
                    bookLoans={bookLoans}
                    materialLoans={materialLoans}
                    user={user}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'materiais' && (
                  <MaterialManagementTab
                    materials={materials}
                    loans={materialLoans}
                    user={user}
                    onUpdate={refreshData}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'insumos' && (
                  <InsumosTab
                    user={user}
                    onRefresh={refreshData}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'notificacoes' && (
                  <NotificationsTab
                    notifications={notifications}
                    notificationTypes={notificationTypes}
                    user={user}
                    onUpdate={refreshNotifications}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'frequencia' && (
                  <TeacherAttendanceTab
                    user={user}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'usuarios' && <UsersTab users={users} currentUser={user} onUpdate={refreshData} campuses={campuses} adminGlobalCampusId={adminGlobalCampusId} />}
              </React.Suspense>
            )}
          </ErrorBoundary>
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
          {/* Seletor de campus e setor removido conforme solicitação */}





        </div>
      </Modal>


    </div >
  );
};

export default App;