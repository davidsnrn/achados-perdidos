import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StorageService, supabase } from './services/storage';
import { User, UserLevel, FoundItem, LostReport, Person, Book, BookLoan, Campus, CopyConfig, CopyRecord, Supply, SupplyRecord, StudentNotification, NotificationType, Setor } from './types';
import { Locker } from './types-armarios';
import { Material, MaterialLoan } from './types-materiais';
import { IfrnLogo } from './components/Logo';
import { EmailService } from './services/emailService';
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
const PrinterNFTab = React.lazy(() => import('./components/Tabs/PrinterNFTab').then(module => ({ default: module.PrinterNFTab })));
const InsumosTab = React.lazy(() => import('./components/Tabs/InsumosTab').then(module => ({ default: module.InsumosTab })));
const NotificationsTab = React.lazy(() => import('./components/Tabs/NotificationsTab').then(module => ({ default: module.NotificationsTab })));
const TeacherAttendanceTab = React.lazy(() => import('./components/Tabs/TeacherAttendanceTab').then(module => ({ default: module.TeacherAttendanceTab })));
const RoomsTab = React.lazy(() => import('./components/Tabs/RoomsTab').then(module => ({ default: module.RoomsTab })));

import { LogOut, Package, ClipboardList, Users, ShieldCheck, KeyRound, Menu, X, Settings, Trash, AlertTriangle, ChevronDown, ChevronUp, UserX, FileX, FileText, Save, Building2, Eye, EyeOff, Loader2, Key, Search, Trash2, ShieldAlert, AlertCircle, CheckCircle2, History, Send, ArrowRight, LayoutGrid, Download, BookOpen, FileCheck, Mail, Lock, User as UserIcon, RefreshCcw, ChevronRight, Printer, BarChart3, Truck, Pencil } from 'lucide-react';
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
  const [configMode, setConfigMode] = useState<'setores' | 'mover'>('setores');

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
  const [suppliesRefreshKey, setSuppliesRefreshKey] = useState(0);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);

  // Otimização para 50k+ alunos: Índice de busca pré-normalizado
  // Manter em Ref evita overhead de renderização e permite busca ultra-rápida
  const peopleSearchIndexRef = useRef<{ id: string, searchStr: string }[]>([]);
  const lastFetchIdRef = useRef(0);

  const [users, setUsers] = useState<User[]>([]);

  // Global Admin Campus Switcher
  const [adminGlobalCampusId, setAdminGlobalCampusId] = useState<string | null>(null);
  const [adminGlobalSetorId, setAdminGlobalSetorId] = useState<string | null>(null);

  // Setor Management (Config Modal)
  const [configCampusId, setConfigCampusId] = useState<string>('');
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null);
  const [newSetorName, setNewSetorName] = useState('');
  const [deletingSetorId, setDeletingSetorId] = useState<string | null>(null);
  const [moveFromSetorId, setMoveFromSetorId] = useState<string>('');
  const [moveToSetorId, setMoveToSetorId] = useState<string>('');
  const [isMovingData, setIsMovingData] = useState(false);
  const [moveResults, setMoveResults] = useState<{ table: string; count: number }[] | null>(null);
  const [movePreview, setMovePreview] = useState<{ table: string; count: number; label: string }[] | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [selectedMoveTables, setSelectedMoveTables] = useState<Set<string>>(new Set());
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<Record<string, { id: string | number; label: string; checked: boolean; currentSetorId: string | null; group?: string }[]>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, Set<string>>>({});
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [moveSistema, setMoveSistema] = useState<string>('Todos');

  const moveSistemas: Record<string, { tables: string[]; label: string }> = {
    Todos: { tables: [], label: 'Todos os Sistemas' },
    Armários: { tables: ['lockers', 'locker_schedules'], label: 'Armários' },
    'Achados e Perdidos': { tables: ['items', 'reports'], label: 'Achados e Perdidos' },
    Livros: { tables: ['books', 'book_loans'], label: 'Livros' },
    Materiais: { tables: ['materials', 'material_loans'], label: 'Materiais' },
    Cópias: { tables: ['copy_records'], label: 'Cópias' },
    Insumos: { tables: ['supplies', 'supply_records'], label: 'Insumos' },
    Notificações: { tables: ['student_notifications', 'notification_types'], label: 'Notificações' },
    Usuários: { tables: ['users'], label: 'Usuários' },
    Pessoas: { tables: ['people'], label: 'Pessoas' },
  };

  // Login State
  const [loginMat, setLoginMat] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [useSuapTestMode, setUseSuapTestMode] = useState(true);

  // Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Forgot Password
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotMatricula, setForgotMatricula] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Reset Password (from email link)
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Account Config
  const [showAccountConfig, setShowAccountConfig] = useState(false);
  const [accountTab, setAccountTab] = useState<'email' | 'password'>('email');

  // Email Change
  const [emailPassword, setEmailPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [showEmailPass, setShowEmailPass] = useState(false);

  // Password Change (inline feedback for account config modal)
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const openAccountConfig = () => {
    setNewEmail('');
    setConfirmEmail('');
    setEmailPassword('');
    setEmailError('');
    setEmailSuccess('');
    setShowEmailPass(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPass(false);
    setShowNewPass(false);
    setShowConfirmPass(false);
    setPasswordError('');
    setPasswordSuccess('');
    setAccountTab('email');
    setShowAccountConfig(true);
  };

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
    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;
    setItems(await StorageService.getItems(campusId, setorId));
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

  const refreshReports = useCallback(async () => {
    if (!user) return;
    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;
    setReports(await StorageService.getReports(campusId, setorId));
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

  // Removido refreshPeople massivo

  const refreshUsers = useCallback(async () => {
    if (!user || user.level !== UserLevel.ADMIN) return;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = (user.level === UserLevel.ADMIN) ? (adminGlobalSetorId || undefined) : user.setor_id;
    setUsers(await StorageService.getUsers(campusId, setorId));
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

  const refreshCampuses = useCallback(async () => {
    setCampuses(await StorageService.getCampuses());
  }, []);

  const refreshSetores = useCallback(async (campusId?: string) => {
    setSetores(await StorageService.getSetores(campusId));
  }, []);

  const refreshBooks = useCallback(async () => {
    if (!user) return;
    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;
    setBooks(await StorageService.getBooks(campusId, setorId));
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

  const refreshBookLoans = useCallback(async () => {
    if (!user) return;
    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;
    setBookLoans(await StorageService.getBookLoans(campusId, setorId));
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

  const refreshLockers = useCallback(async () => {
    if (!user) return;
    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;
    setLockers(await StorageService.getLockers(campusId, setorId));
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

  const refreshMaterials = useCallback(async () => {
    if (!user) return;
    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;
    setMaterials(await StorageService.getMaterials(campusId, setorId));
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

  const refreshMaterialLoans = useCallback(async () => {
    if (!user) return;
    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;
    setMaterialLoans(await StorageService.getMaterialLoans(campusId, setorId));
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

  const refreshCopyRecords = useCallback(async () => {
    if (!user) return;
    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;
    setCopyRecords(await StorageService.getCopyRecords(campusId || '', setorId));
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

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
    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;
    setSupplies(await StorageService.getSupplies(campusId, setorId));
    setSuppliesRefreshKey(k => k + 1);
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

  const refreshSupplyRecords = useCallback(async () => {
    if (!user) return;
    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;
    setSupplyRecords(await StorageService.getSupplyRecords(campusId, setorId));
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;
    const [notifs, types] = await Promise.all([
      StorageService.getNotifications(campusId, setorId),
      StorageService.getNotificationTypes(campusId, setorId)
    ]);
    setNotifications(notifs);
    setNotificationTypes(types);
  }, [user, adminGlobalCampusId, adminGlobalSetorId]);

  // Refresh Data Helper (Async) with Timeout
  const refreshData = useCallback(async () => {
    if (!user || isBackdropSleep) return;

    const fetchId = ++lastFetchIdRef.current;
    setLoading(true);

    const isGlobalOrAdvanced = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;
    const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
    try {
      // Lazy Loading: Só carrega dados do sistema atual
      // Isso reduz drasticamente o uso de memória no Android

      const setorId = isGlobalOrAdvanced ? (adminGlobalSetorId || undefined) : user.setor_id;

      console.log(`[REFRESH DATA] level=${user.level} | currentSystem=${currentSystem} | activeTab=${activeTab} | campusId=${campusId ?? 'undefined'} | setorId=${setorId ?? 'undefined'}`);

      if (currentSystem === 'achados' || activeTab === 'achados' || activeTab === 'relatos') {
        const [fetchedItems, fetchedReports] = await Promise.all([
          StorageService.getItems(campusId, setorId),
          StorageService.getReports(campusId, setorId)
        ]);

        if (fetchId !== lastFetchIdRef.current) return;

        setItems(fetchedItems);
        setReports(fetchedReports);
        setBooks([]);
        setBookLoans([]);
        setLockers([]);
        setMaterials([]);
        setMaterialLoans([]);
      } else if (currentSystem === 'armarios' || activeTab === 'armarios') {
        const [fetchedLockers] = await Promise.all([
          StorageService.getLockers(campusId, setorId)
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
          StorageService.getBooks(campusId, setorId),
          StorageService.getBookLoans(campusId, setorId)
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
          StorageService.getLockers(campusId, setorId),
          StorageService.getBooks(campusId, setorId),
          StorageService.getBookLoans(campusId, setorId),
          StorageService.getMaterials(campusId, setorId),
          StorageService.getMaterialLoans(campusId, setorId)
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
          StorageService.getMaterials(campusId, setorId),
          StorageService.getMaterialLoans(campusId, setorId)
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
          StorageService.getSupplies(campusId, setorId),
          StorageService.getSupplyRecords(campusId, setorId)
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
          StorageService.getNotifications(campusId, setorId),
          StorageService.getNotificationTypes(campusId, setorId)
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
          StorageService.getCopyRecords(campusId || '', setorId),
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
          StorageService.getUsers(campusId, setorId),
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
  }, [user, currentSystem, activeTab, adminGlobalCampusId, adminGlobalSetorId]);

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
        case 'copy_records': refreshCopyRecords(); break;
        case 'student_notifications': refreshNotifications(); break;
        case 'teacher_schedules':
        case 'teacher_attendance': refreshData(); break;
        case 'setores': refreshSetores(adminGlobalCampusId || undefined); break;
      }
    }, 1000); // 1 second debounce
  }, [refreshItems, refreshReports, refreshUsers, refreshBooks, refreshBookLoans, refreshLockers, refreshMaterials, refreshMaterialLoans, refreshSupplies, refreshSupplyRecords, refreshCopyRecords, refreshNotifications, refreshSetores, adminGlobalCampusId]);

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

  // Load setores after campuses and user are available
  useEffect(() => {
    if (user) {
      const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
      refreshSetores(campusId);
    }
  }, [user, adminGlobalCampusId, refreshSetores]);

  // Detect reset_token in URL and validate it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (token) {
      window.history.replaceState({}, '', window.location.pathname);
      setResetToken(token);
      setResetError('');
      
      // Validação imediata do token
      StorageService.validateResetToken(token).then(isValid => {
        if (!isValid) {
          setResetError('Link inválido ou expirado. Solicite uma nova redefinição.');
        }
      }).catch(() => {
        setResetError('Erro ao validar o link de redefinição.');
      });
    }
  }, []);

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
    }, 300000); // Verifica a cada 5 minutos

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(intervalId);
    };
  }, [user, handleLogout]);

  // 4. Browser Back/Forward Buttons -> Home Screen / System Restore
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.system) {
        setCurrentSystem(e.state.system);
        sessionStorage.setItem('currentSystem', e.state.system);
        setActiveTab(e.state.system === 'livros' ? 'livros-catalogo' : e.state.system);
        setShowModuleSelector(false);
      } else {
        setShowModuleSelector(true);
        setCurrentSystem(null);
        sessionStorage.removeItem('currentSystem');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    attemptLogin(loginMat, loginPass);
  };

  const attemptLogin = async (mat: string, pass: string) => {
    setLoading(true);
    setLoginError('');
    try {
      let loggedUser = null;
      if (useSuapTestMode) {
        console.log('[LOGIN] Tentando autenticação via SUAP...');
        try {
          loggedUser = await StorageService.loginSuap(mat, pass);
        } catch (suapErr) {
          console.warn('[LOGIN] Falha/Erro na API do SUAP, tentando fallback local...', suapErr);
        }

        // Fallback automático para login local caso o SUAP não retorne usuário
        if (!loggedUser) {
          console.log('[LOGIN] SUAP não autenticou. Tentando banco de dados local...');
          loggedUser = await StorageService.login(mat, pass);
        }
      } else {
        loggedUser = await StorageService.login(mat, pass);
      }

      if (loggedUser) {
        StorageService.updateLastActive(); // Inicializa o timer a partir do login
        StorageService.setSessionUser(loggedUser);
        setUser(loggedUser);
        setLoginError('');
        setShowModuleSelector(true);
      } else {
        setLoginError('Credenciais inválidas. Verifique sua matrícula e senha.');
      }
    } catch (e) {
      console.error('[LOGIN ERROR]', e);
      setLoginError('Erro de conexão ou configuração ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setPasswordError('');
    setPasswordSuccess('');

    const hashedCurrent = await StorageService.hashPassword(currentPassword);
    if (user.password !== hashedCurrent) {
      setPasswordError('A senha atual está incorreta.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('A nova senha e a confirmação não coincidem.');
      return;
    }
    if (newPassword.length < 3) {
      setPasswordError('A senha deve ter pelo menos 3 caracteres.');
      return;
    }

    try {
      const updatedUser = await StorageService.changePassword(user.id, newPassword, user.name);
      if (updatedUser) {
        setUser(updatedUser);
        StorageService.setSessionUser(updatedUser);
        setPasswordSuccess('Senha alterada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowCurrentPass(false);
        setShowNewPass(false);
        setShowConfirmPass(false);
        setTimeout(() => {
          setShowAccountConfig(false);
          setPasswordSuccess('');
        }, 2000);
      } else {
        setPasswordError('Erro ao alterar senha. Tente novamente.');
      }
    } catch (e) {
      setPasswordError('Erro de conexão ao alterar senha.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotMatricula.trim()) return;

    setForgotLoading(true);
    setForgotError('');
    setForgotMessage('');

    try {
      const result = await StorageService.requestPasswordReset(forgotMatricula.trim());
      if (result) {
        const resetLink = `${window.location.origin}${window.location.pathname}?reset_token=${result.token}`;
        await EmailService.sendPasswordResetEmail(result.email, result.name, resetLink);
        setForgotMessage(`E-mail de redefinição enviado para ${result.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(b.length) + c)}`);
      } else {
        setForgotError('Matrícula não encontrada ou usuário sem e-mail cadastrado.');
      }
    } catch (e) {
      setForgotError('Erro ao processar solicitação. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) return;
    if (resetNewPass !== resetConfirmPass) {
      setResetError('As senhas não coincidem.');
      return;
    }
    if (resetNewPass.length < 3) {
      setResetError('A senha deve ter pelo menos 3 caracteres.');
      return;
    }

    setResetError('');
    try {
      const success = await StorageService.completePasswordReset(resetToken, resetNewPass);
      if (success) {
        setResetSuccess(true);
        setTimeout(() => {
          setResetToken(null);
          setResetNewPass('');
          setResetConfirmPass('');
          setResetSuccess(false);
        }, 4000);
      } else {
        setResetError('Link inválido ou expirado. Solicite uma nova redefinição.');
      }
    } catch (e) {
      setResetError('Erro ao redefinir senha. Tente novamente.');
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newEmail !== confirmEmail) {
      setEmailError('Os e-mails não coincidem.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError('E-mail inválido.');
      return;
    }

    setEmailLoading(true);
    setEmailError('');
    setEmailSuccess('');

    try {
      const updated = await StorageService.updateUserEmail(user.id, newEmail);
      if (updated) {
        setUser({ ...user, email: newEmail });
        setEmailSuccess('E-mail atualizado com sucesso!');
        setNewEmail('');
        setConfirmEmail('');
      } else {
        setEmailError('Erro ao atualizar e-mail.');
      }
    } catch (e) {
      setEmailError('Erro de conexão ao atualizar e-mail.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleMobileNav = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const resetConfigState = () => {
    setConfigCampusId('');
    setEditingSetor(null);
    setNewSetorName('');
    setDeletingSetorId(null);
    setMoveFromSetorId('');
    setMoveToSetorId('');
    setMovePreview(null);
    setMoveResults(null);
    setSelectedMoveTables(new Set());
    setExpandedTable(null);
    setPreviewItems({});
    setMoveSistema('Todos');
    setConfigMode('setores');
  };

  const openConfigModal = () => {
    resetConfigState();
    setShowConfigModal(true);
  };

  const closeConfigModal = () => {
    setShowConfigModal(false);
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

            {resetToken ? (
              <>
                <div className="text-center lg:text-left">
                  <div className="lg:hidden mb-8 flex justify-center">
                    <IfrnLogo />
                  </div>
                  {resetSuccess ? (
                    <>
                      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-ifrn-green to-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-200">
                        <CheckCircle2 size={32} className="text-white" />
                      </div>
                      <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Senha redefinida!</h2>
                      <p className="text-gray-500">Sua senha foi alterada. Você já pode fazer login.</p>
                    </>
                  ) : (
                    <>
                      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                        <KeyRound size={32} className="text-white" />
                      </div>
                      <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Redefinir Senha</h2>
                      <p className="text-gray-500">Crie uma nova senha para sua conta.</p>
                    </>
                  )}
                </div>

                {!resetSuccess && (
                  <form onSubmit={handleCompleteReset} className="space-y-5">
                    <div className="relative group">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Nova Senha</label>
                      <input
                        type="password"
                        required
                        value={resetNewPass}
                        onChange={e => setResetNewPass(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green block w-full p-4 transition-all outline-none font-medium"
                        placeholder="Mínimo de 3 caracteres"
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="relative group">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Confirmar Nova Senha</label>
                      <input
                        type="password"
                        required
                        value={resetConfirmPass}
                        onChange={e => setResetConfirmPass(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green block w-full p-4 transition-all outline-none font-medium"
                        placeholder="Repita a nova senha"
                        autoComplete="new-password"
                      />
                    </div>

                    {resetError && (
                      <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-3 border border-red-100">
                        <AlertCircle size={18} className="flex-shrink-0" />
                        <span className="font-medium">{resetError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full text-white bg-ifrn-green hover:bg-ifrn-darkGreen focus:ring-4 focus:ring-green-300 font-bold rounded-xl text-lg px-5 py-4 transition-all shadow-lg shadow-green-200"
                    >
                      Redefinir Senha
                    </button>
                  </form>
                )}

                {resetSuccess && (
                  <button
                    onClick={() => { setResetToken(null); setResetNewPass(''); setResetConfirmPass(''); }}
                    className="w-full text-white bg-ifrn-green hover:bg-ifrn-darkGreen font-bold rounded-xl text-lg px-5 py-4 transition-all shadow-lg shadow-green-200"
                  >
                    Ir para o Login
                  </button>
                )}
              </>
            ) : (
              <>
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

                  <div className="flex items-center justify-between -mt-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
                      <input
                        type="checkbox"
                        checked={useSuapTestMode}
                        onChange={(e) => setUseSuapTestMode(e.target.checked)}
                        className="w-4 h-4 text-ifrn-green bg-gray-100 border-gray-300 rounded focus:ring-ifrn-green focus:ring-2"
                      />
                      <span className="font-semibold text-ifrn-darkGreen">Entrar via SUAP (TESTE)</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs font-medium text-gray-500 hover:text-ifrn-green transition-colors"
                    >
                      Esqueci minha senha?
                    </button>
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
              </>
            )}

            <div className="text-center">
              <p className="text-xs text-gray-400 mt-8">
                &copy; {new Date().getFullYear()} IFRN
                <br /> <span className="italic">Desenvolvido por <span className="font-semibold text-gray-500">David Galdino</span></span>
              </p>
            </div>
          </div>
        </div >

        {/* Forgot Password Modal */}
        <Modal isOpen={showForgotModal} onClose={() => { setShowForgotModal(false); setForgotMatricula(''); setForgotMessage(''); setForgotError(''); }} title="">
          <div className="space-y-6">
            <div className="text-center pb-6 border-b border-gray-100">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                <KeyRound size={32} className="text-white" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Recuperar Senha</h3>
              <p className="text-sm text-gray-500">Digite sua matrícula para receber um link de redefinição.</p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <UserIcon size={20} strokeWidth={2} />
                </div>
                <input
                  type="text"
                  value={forgotMatricula}
                  onChange={e => setForgotMatricula(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green block w-full pl-12 p-4 transition-all outline-none font-medium"
                  placeholder="Sua Matrícula"
                  required
                  disabled={forgotLoading}
                />
              </div>

              {forgotError && (
                <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-3 border border-red-100">
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <span className="font-medium">{forgotError}</span>
                </div>
              )}

              {forgotMessage && (
                <div className="p-4 bg-green-50 text-ifrn-green text-sm rounded-xl flex items-center gap-3 border border-green-100">
                  <CheckCircle2 size={18} className="flex-shrink-0" />
                  <span className="font-medium">{forgotMessage}</span>
                </div>
              )}

              <div className="pt-2 flex gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowForgotModal(false); setForgotMatricula(''); setForgotMessage(''); setForgotError(''); }}
                  className="flex-1 px-6 py-3.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-200 font-bold transition-all text-sm flex items-center justify-center gap-2"
                >
                  {forgotLoading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Enviar Link</>}
                </button>
              </div>
            </form>
          </div>
        </Modal>
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
                <div className="w-full md:w-96 space-y-3 px-4 animate-fade-in-right">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Building2 size={14} /> Visualizar Câmpus
                  </label>
                  <div className="relative group">
                    <select
                      value={adminGlobalCampusId || ''}
                      onChange={e => { setAdminGlobalCampusId(e.target.value || null); setAdminGlobalSetorId(null); refreshSetores(e.target.value || undefined); }}
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
                  {adminGlobalCampusId && setores.length > 0 && (
                    <div className="relative group">
                      <select
                        value={adminGlobalSetorId || ''}
                        onChange={e => setAdminGlobalSetorId(e.target.value || null)}
                        className="w-full bg-white border-2 border-gray-200 text-gray-800 text-sm font-bold rounded-2xl px-4 py-3.5 focus:ring-4 focus:ring-ifrn-green/10 focus:border-ifrn-green outline-none transition-all cursor-pointer shadow-sm hover:border-gray-300 appearance-none"
                      >
                        <option value="">📋 Todos os Setores</option>
                        {setores.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-ifrn-green transition-colors">
                        <ChevronDown size={20} />
                      </div>
                    </div>
                  )}
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
                    history.pushState({ system: 'achados' }, '', window.location.href);
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
                    history.pushState({ system: 'armarios' }, '', window.location.href);
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
                    history.pushState({ system: 'livros' }, '', window.location.href);
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
                    history.pushState({ system: 'nadaconsta' }, '', window.location.href);
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
                    history.pushState({ system: 'materiais' }, '', window.location.href);
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
                    history.pushState({ system: 'copias' }, '', window.location.href);
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
                    history.pushState({ system: 'insumos' }, '', window.location.href);
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
                    history.pushState({ system: 'notificacoes' }, '', window.location.href);
                    sessionStorage.setItem('currentSystem', 'notificacoes');
                    setActiveTab('notificacoes');
                    setShowModuleSelector(false);
                  }
                },
                frequencia: {
                  id: 'frequencia',
                  label: 'Gestão de Aulas',
                  description: 'Acompanhe o cronograma das turmas e organize substituições ou horários livres.',
                  icon: <ClipboardList size={32} />,
                  color: 'text-indigo-800',
                  iconBg: 'bg-gradient-to-br from-indigo-700 to-blue-900',
                  textColor: 'text-indigo-800',
                  hoverBorder: 'hover:border-indigo-700',
                  bgLight: 'bg-indigo-50',
                  permission: 'frequencia',
                    onSelect: () => {
                    setCurrentSystem('frequencia');
                    history.pushState({ system: 'frequencia' }, '', window.location.href);
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
                onClick={openAccountConfig}
                className="px-6 py-3 text-gray-600 hover:text-ifrn-green font-bold transition-all flex items-center gap-3 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-ifrn-green hover:-translate-y-0.5 active:translate-y-0"
              >
                <Settings size={20} /> Configurações da Conta
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

        <Modal isOpen={showConfigModal} onClose={closeConfigModal} title="Configurações do Sistema" maxWidth="max-w-2xl">
          <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">

            {/* Mode selector */}
            <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
              <button
                type="button"
                onClick={() => setConfigMode('setores')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  configMode === 'setores'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Building2 size={15} />
                Gerenciar Setores
              </button>
              <button
                type="button"
                onClick={() => setConfigMode('mover')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  configMode === 'mover'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ArrowRight size={15} />
                Mover / Atribuir Dados
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                <Building2 size={14} /> Selecione o Câmpus
              </label>
              <div className="relative group">
                <select
                  value={configCampusId}
                  onChange={e => { setConfigCampusId(e.target.value); setEditingSetor(null); setNewSetorName(''); setDeletingSetorId(null); refreshSetores(e.target.value || undefined); }}
                  className="w-full bg-white border-2 border-gray-200 text-gray-800 text-sm font-bold rounded-xl px-4 py-3 focus:ring-4 focus:ring-ifrn-green/10 focus:border-ifrn-green outline-none transition-all cursor-pointer shadow-sm hover:border-gray-300 appearance-none"
                >
                  <option value="">Selecione um câmpus</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-ifrn-green transition-colors">
                  <ChevronDown size={20} />
                </div>
              </div>
            </div>

            {configCampusId && (
              <>
                {configMode === 'setores' && (
                <>
                {/* Add / Edit form */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h4 className="text-sm font-bold text-gray-700 mb-3">
                    {editingSetor ? 'Editar Setor' : 'Novo Setor'}
                  </h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSetorName}
                      onChange={e => setNewSetorName(e.target.value)}
                      placeholder="Nome do setor"
                      className="flex-1 bg-white border-2 border-gray-200 text-gray-800 text-sm rounded-lg px-4 py-2.5 focus:ring-4 focus:ring-ifrn-green/10 focus:border-ifrn-green outline-none transition-all"
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && newSetorName.trim()) {
                          const name = newSetorName.trim();
                          const exists = setores.some(s => s.campus_id === configCampusId && s.name.toLowerCase() === name.toLowerCase() && s.id !== editingSetor?.id);
                          if (exists) { alert('Já existe um setor com este nome neste câmpus.'); return; }
                          try {
                            const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                            await StorageService.saveSetor({
                              id: editingSetor?.id,
                              campus_id: configCampusId,
                              name,
                              slug
                            });
                            setNewSetorName('');
                            setEditingSetor(null);
                            await refreshSetores(configCampusId);
                          } catch (e: any) {
                            alert('Erro ao salvar setor: ' + (e.message || 'Erro desconhecido'));
                          }
                        }
                      }}
                    />
                    <button
                      onClick={async () => {
                        if (!newSetorName.trim()) return;
                        const name = newSetorName.trim();
                        const exists = setores.some(s => s.campus_id === configCampusId && s.name.toLowerCase() === name.toLowerCase() && s.id !== editingSetor?.id);
                        if (exists) { alert('Já existe um setor com este nome neste câmpus.'); return; }
                        try {
                          const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                          await StorageService.saveSetor({
                            id: editingSetor?.id,
                            campus_id: configCampusId,
                            name,
                            slug
                          });
                          setNewSetorName('');
                          setEditingSetor(null);
                          await refreshSetores(configCampusId);
                        } catch (e: any) {
                          alert('Erro ao salvar setor: ' + (e.message || 'Erro desconhecido'));
                        }
                      }}
                      className="px-4 py-2.5 bg-ifrn-green text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                      <Save size={16} /> {editingSetor ? 'Salvar' : 'Adicionar'}
                    </button>
                    {editingSetor && (
                      <button
                        onClick={() => { setEditingSetor(null); setNewSetorName(''); }}
                        className="px-4 py-2.5 bg-gray-200 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {/* Setores list */}
                <div className="space-y-2">
                  {setores.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8 font-medium">
                      Nenhum setor cadastrado neste câmpus.
                    </p>
                  )}
                  {setores.map(setor => (
                    <div key={setor.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{setor.name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingSetor(setor);
                              setNewSetorName(setor.name);
                            }}
                            className="p-2 text-gray-400 hover:text-ifrn-green transition-colors rounded-lg hover:bg-green-50"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                        {deletingSetorId === setor.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={async () => {
                                try {
                                  await StorageService.deleteSetor(setor.id);
                                  setDeletingSetorId(null);
                                  await refreshSetores(configCampusId);
                                  if (adminGlobalSetorId === setor.id) setAdminGlobalSetorId(null);
                                } catch (e: any) {
                                  const msg = e.message || '';
                                  const fkMatch = msg.match(/violates foreign key constraint "\w+" on table "(\w+)"/);
                                  if (fkMatch && fkMatch[1] === 'people') {
                                    if (confirm(`Existem pessoas vinculadas a este setor. Como as pessoas são cadastradas por campus e não por setor, o vínculo será removido automaticamente.\n\nDeseja continuar?`)) {
                                      await StorageService.nullifySetorPeople(setor.id);
                                      await StorageService.deleteSetor(setor.id);
                                      setDeletingSetorId(null);
                                      await refreshSetores(configCampusId);
                                      if (adminGlobalSetorId === setor.id) setAdminGlobalSetorId(null);
                                    } else {
                                      setDeletingSetorId(null);
                                    }
                                  } else if (fkMatch) {
                                    const tableLabels: Record<string, string> = {
                                      items: 'Achados - Itens',
                                      reports: 'Achados - Relatos',
                                      lockers: 'Armários',
                                      locker_schedules: 'Agendamentos de Armários',
                                      books: 'Livros',
                                      book_loans: 'Empréstimos de Livros',
                                      materials: 'Materiais',
                                      material_loans: 'Empréstimos de Materiais',
                                      copy_records: 'Registros de Cópias',
                                      supplies: 'Insumos (Estoque)',
                                      supply_records: 'Registros de Insumos',
                                      student_notifications: 'Notificações de Alunos',
                                      notification_types: 'Tipos de Notificação',
                                      users: 'Usuários',
                                      people: 'Pessoas',
                                    };
                                    alert(`Não é possível excluir este setor pois existem registros vinculados em "${tableLabels[fkMatch[1]] || fkMatch[1]}".\n\nUtilize a opção "Mover / Atribuir Dados" para transferir os registros para outro setor antes de excluir.`);
                                  } else {
                                    alert('Erro ao excluir setor: ' + msg);
                                  }
                                }
                              }}
                              className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setDeletingSetorId(null)}
                              className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingSetorId(setor.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                            title="Excluir"
                          >
                            <Trash size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                </>
                )}

                {configMode === 'mover' && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <h4 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                    <ArrowRight size={16} /> Mover / Atribuir Dados entre Setores
                  </h4>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 mb-3">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-amber-700 mb-1">Origem</label>
                      <select
                        value={moveFromSetorId}
                        onChange={e => {
                          setMoveFromSetorId(e.target.value);
                          setMovePreview(null);
                          setMoveResults(null);
                          setSelectedMoveTables(new Set());
                          setExpandedTable(null);
                          setPreviewItems({});
                        }}
                        className="w-full bg-white border-2 border-amber-200 text-sm rounded-lg px-3 py-2 focus:ring-4 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      >
                        <option value="">{moveSistema === 'Usuários' ? 'Selecione um setor...' : 'Selecione ou deixe vazio (sem setor)'}</option>
                        {setores.filter(s => s.id !== moveToSetorId).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-center py-2 sm:py-0">
                      <ArrowRight size={20} className="text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-amber-700 mb-1">Destino</label>
                      <select
                        value={moveToSetorId}
                        onChange={e => {
                          setMoveToSetorId(e.target.value);
                          setMoveResults(null);
                        }}
                        className="w-full bg-white border-2 border-amber-200 text-sm rounded-lg px-3 py-2 focus:ring-4 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      >
                        <option value="">Selecione...</option>
                        {setores.filter(s => s.id !== moveFromSetorId).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sistema selector */}
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-amber-700 mb-1">Sistema</label>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(moveSistemas).map(([key, sys]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setMoveSistema(key);
                            setExpandedTable(null);
                            setExpandedGroups({});
                            if (movePreview) {
                              const tables = key === 'Todos'
                                ? movePreview.map(p => p.table)
                                : (moveSistemas[key]?.tables || []);
                              setSelectedMoveTables(new Set(tables));
                              setPreviewItems(prev => {
                                const next: typeof prev = {};
                                for (const [table, items] of Object.entries(prev)) {
                                  next[table] = items.map(i => ({ ...i, checked: tables.includes(table) }));
                                }
                                return next;
                              });
                            }
                          }}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            moveSistema === key
                              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                              : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {sys.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={isLoadingPreview}
                    onClick={async () => {
                      if (!moveFromSetorId && moveSistema !== 'Usuários') {
                        // Allow loading without source setor to see unassigned items
                      }
                      setIsLoadingPreview(true);
                      setMovePreview(null);
                      setSelectedMoveTables(new Set());
                      setExpandedTable(null);
                      setPreviewItems({});
                      setMoveResults(null);
                      try {
                        const sid = moveFromSetorId || 'unassigned';
                        const preview = await StorageService.getMovePreview(sid);
                        setMovePreview(preview);
                        const allTables = moveSistema === 'Todos'
                          ? preview.map(p => p.table)
                          : (moveSistemas[moveSistema]?.tables || []);
                        setSelectedMoveTables(new Set(allTables));
                      } catch (e: any) {
                        alert('Erro ao carregar preview: ' + (e.message || 'Erro desconhecido'));
                      } finally {
                        setIsLoadingPreview(false);
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-amber-100 text-amber-800 text-sm font-bold rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-amber-300 mb-3"
                  >
                    {isLoadingPreview ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                    Carregar Itens
                  </button>

                  {movePreview && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-700">
                          {moveSistema === 'Todos' ? 'Todos os sistemas' : moveSistemas[moveSistema]?.label}:
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const filtered = moveSistema === 'Todos'
                                ? movePreview.map(p => p.table)
                                : (moveSistemas[moveSistema]?.tables || []);
                              setSelectedMoveTables(new Set(filtered));
                            }}
                            className="text-xs text-amber-700 hover:text-amber-900 underline font-medium"
                          >
                            Selecionar todos
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMoveTables(new Set());
                              setPreviewItems(prev => {
                                const next: typeof prev = {};
                                for (const [table, items] of Object.entries(prev)) {
                                  next[table] = items.map(i => ({ ...i, checked: false }));
                                }
                                return next;
                              });
                            }}
                            className="text-xs text-amber-700 hover:text-amber-900 underline font-medium"
                          >
                            Limpar seleção
                          </button>
                        </div>
                      </div>
                      {movePreview.filter(p => {
                        if (moveSistema === 'Todos') return true;
                        return (moveSistemas[moveSistema]?.tables || []).includes(p.table);
                      }).map(p => {
                        const items = previewItems[p.table] || [];
                        const checkedCount = items.filter(i => i.checked).length;
                        const isIndeterminate = items.length > 0 && checkedCount > 0 && checkedCount < items.length;
                        const isExpanded = expandedTable === p.table;
                        return (
                          <div key={p.table} className="bg-white rounded-lg border border-amber-100 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={selectedMoveTables.has(p.table)}
                                ref={el => { if (el) el.indeterminate = isIndeterminate && selectedMoveTables.has(p.table); }}
                                onChange={() => {
                                  const next = new Set(selectedMoveTables);
                                  if (next.has(p.table)) {
                                    next.delete(p.table);
                                    setPreviewItems(prev => ({ ...prev, [p.table]: (prev[p.table] || []).map(i => ({ ...i, checked: false })) }));
                                  } else {
                                    next.add(p.table);
                                  }
                                  setSelectedMoveTables(next);
                                }}
                                className="accent-amber-600 cursor-pointer"
                              />
                              <span className="flex-1 text-sm font-medium text-gray-800">{p.label}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${p.count > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-gray-400 bg-gray-50 border-gray-200'}`}>
                                {p.count} no setor
                              </span>
                              <button
                                onClick={async () => {
                                  if (isExpanded) {
                                    setExpandedTable(null);
                                  } else {
                                    setExpandedTable(p.table);
                                    if (!previewItems[p.table]) {
                                      setIsLoadingItems(true);
                                      try {
                                        const sid = moveFromSetorId || '';
                                        const list = await StorageService.getMovePreviewItems(sid, p.table);
                                        setPreviewItems(prev => ({
                                          ...prev,
                                          [p.table]: list.map(i => ({ ...i, checked: selectedMoveTables.has(p.table) }))
                                        }));
                                      } catch { /* ignore */ }
                                      setIsLoadingItems(false);
                                    }
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-amber-700 transition-colors"
                                title={isExpanded ? 'Recolher' : 'Ver itens'}
                              >
                                {isLoadingItems && isExpanded ? <Loader2 size={14} className="animate-spin" /> : isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </div>
                            {isExpanded && items.length > 0 && (
                              <div className="border-t border-amber-50 max-h-48 overflow-y-auto divide-y divide-amber-50">
                                {items.some(i => i.group) ? (() => {
                                  const groups: Record<string, typeof items> = {};
                                  const ungrouped: typeof items = [];
                                  items.forEach(item => {
                                    const g = item.group || '__ungrouped__';
                                    if (item.group) {
                                      (groups[g] ||= []).push(item);
                                    } else {
                                      ungrouped.push(item);
                                    }
                                  });
                                  return <>
                                    {Object.entries(groups).map(([groupName, groupItems]) => {
                                      const allChecked = groupItems.every(i => i.checked);
                                      const someChecked = groupItems.some(i => i.checked);
                                      return (
                                        <div key={groupName}>
                                          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/50 hover:bg-amber-100/50 text-xs font-semibold text-amber-800 border-b border-amber-100">
                                            <input
                                              type="checkbox"
                                              checked={allChecked}
                                              ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                                              onChange={() => {
                                                setPreviewItems(prev => ({
                                                  ...prev,
                                                  [p.table]: (prev[p.table] || []).map(i =>
                                                    i.group === groupName ? { ...i, checked: !allChecked } : i
                                                  )
                                                }));
                                                setSelectedMoveTables(prev => new Set(prev).add(p.table));
                                              }}
                                              className="accent-amber-600 cursor-pointer"
                                            />
                                            <span>{groupName}</span>
                                            <span className="text-xs font-normal text-amber-500">({groupItems.length})</span>
                                            <button
                                              onClick={() => {
                                                setExpandedGroups(prev => {
                                                  const next = { ...prev };
                                                  const set = new Set(next[p.table] || []);
                                                  if (set.has(groupName)) {
                                                    set.delete(groupName);
                                                    if (set.size === 0) {
                                                      delete next[p.table];
                                                    } else {
                                                      next[p.table] = set;
                                                    }
                                                  } else {
                                                    set.add(groupName);
                                                    next[p.table] = set;
                                                  }
                                                  return next;
                                                });
                                              }}
                                              className="ml-auto p-1 text-gray-400 hover:text-amber-700 transition-colors"
                                            >
                                              {expandedGroups[p.table]?.has(groupName) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                          </div>
                                          {expandedGroups[p.table]?.has(groupName) && groupItems.map(item => (
                                            <label key={String(item.id)} className="flex items-center gap-2 px-3 py-1.5 pl-8 hover:bg-amber-50 cursor-pointer text-xs">
                                              <input
                                                type="checkbox"
                                                checked={item.checked}
                                                onChange={() => {
                                                  setPreviewItems(prev => ({
                                                    ...prev,
                                                    [p.table]: (prev[p.table] || []).map(i => i.id === item.id ? { ...i, checked: !i.checked } : i)
                                                  }));
                                                  setSelectedMoveTables(prev => new Set(prev).add(p.table));
                                                }}
                                                className="accent-amber-600 cursor-pointer"
                                              />
                                              <span className="flex-1 truncate text-gray-600">{item.label}</span>
                                              {!item.currentSetorId && (
                                                <span className="text-xs text-gray-400 italic font-medium shrink-0">sem setor</span>
                                              )}
                                              {item.currentSetorId && item.currentSetorId !== moveFromSetorId && moveFromSetorId && (
                                                <span className="text-xs text-amber-600 font-medium shrink-0">
                                                  {setores.find(s => s.id === item.currentSetorId)?.name || 'outro setor'}
                                                </span>
                                              )}
                                            </label>
                                          ))}
                                        </div>
                                      );
                                    })}
                                    {ungrouped.map(item => (
                                      <label key={String(item.id)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-amber-50 cursor-pointer text-xs">
                                        <input
                                          type="checkbox"
                                          checked={item.checked}
                                          onChange={() => {
                                            setPreviewItems(prev => ({
                                              ...prev,
                                              [p.table]: (prev[p.table] || []).map(i => i.id === item.id ? { ...i, checked: !i.checked } : i)
                                            }));
                                            setSelectedMoveTables(prev => new Set(prev).add(p.table));
                                          }}
                                          className="accent-amber-600 cursor-pointer"
                                        />
                                        <span className="flex-1 truncate text-gray-600">{item.label}</span>
                                        {!item.currentSetorId && (
                                          <span className="text-xs text-gray-400 italic font-medium shrink-0">sem setor</span>
                                        )}
                                        {item.currentSetorId && item.currentSetorId !== moveFromSetorId && moveFromSetorId && (
                                          <span className="text-xs text-amber-600 font-medium shrink-0">
                                            {setores.find(s => s.id === item.currentSetorId)?.name || 'outro setor'}
                                          </span>
                                        )}
                                      </label>
                                    ))}
                                  </>;
                                })() : (
                                  items.map(item => (
                                    <label key={String(item.id)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-amber-50 cursor-pointer text-xs">
                                      <input
                                        type="checkbox"
                                        checked={item.checked}
                                        onChange={() => {
                                          setPreviewItems(prev => ({
                                            ...prev,
                                            [p.table]: (prev[p.table] || []).map(i => i.id === item.id ? { ...i, checked: !i.checked } : i)
                                          }));
                                          setSelectedMoveTables(prev => new Set(prev).add(p.table));
                                        }}
                                        className="accent-amber-600 cursor-pointer"
                                      />
                                      <span className="flex-1 truncate text-gray-600">{item.label}</span>
                                      {!item.currentSetorId && (
                                        <span className="text-xs text-gray-400 italic font-medium shrink-0">sem setor</span>
                                      )}
                                      {item.currentSetorId && item.currentSetorId !== moveFromSetorId && moveFromSetorId && (
                                        <span className="text-xs text-amber-600 font-medium shrink-0">
                                          {setores.find(s => s.id === item.currentSetorId)?.name || 'outro setor'}
                                        </span>
                                      )}
                                    </label>
                                  ))
                                )}
                              </div>
                            )}
                            {isExpanded && items.length === 0 && (
                              <div className="border-t border-amber-50 px-3 py-4 text-center text-xs text-gray-400 italic">
                                Nenhum item encontrado.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {movePreview && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-200">
                      <span className="text-xs text-amber-700 font-medium">
                        {Array.from(selectedMoveTables).reduce((sum, t) => sum + (previewItems[t]?.filter(i => i.checked).length || 0), 0)} item(ns) selecionado(s) em {selectedMoveTables.size} categoria(s)
                      </span>
                      <button
                        disabled={selectedMoveTables.size === 0 || !moveToSetorId || isMovingData}
                        onClick={async () => {
                          const fromName = moveFromSetorId ? (setores.find(s => s.id === moveFromSetorId)?.name || setores.find(s => s.id === moveFromSetorId)?.name) : 'sem setor';
                          const toName = setores.find(s => s.id === moveToSetorId)?.name;
                          if (!confirm(`ATENÇÃO: Esta operação não pode ser desfeita.\n\nMover dados selecionados para "${toName}"?`)) return;
                          setIsMovingData(true);
                          setMoveResults(null);
                          try {
                            const selections: { table: string; ids?: (string | number)[] }[] = Array.from(selectedMoveTables).flatMap(table => {
                              const items = previewItems[table] || [];
                              const checkedItems = items.filter(i => i.checked);
                              if (items.length > 0) {
                                return checkedItems.length > 0 ? [{ table, ids: checkedItems.map(i => i.id) }] : [];
                              }
                              if (!moveFromSetorId) return [];
                              return [{ table }];
                            });
                            const results = await StorageService.moveSetorData(moveFromSetorId || '', moveToSetorId, selections);
                            setMoveResults(results);
                            await refreshData();
                            if (moveFromSetorId && adminGlobalSetorId === moveFromSetorId) setAdminGlobalSetorId(moveToSetorId);
                            const sid = moveFromSetorId || 'unassigned';
                            const preview = await StorageService.getMovePreview(sid);
                            setMovePreview(preview);
                            setSelectedMoveTables(new Set());
                            setPreviewItems({});
                            setExpandedTable(null);
                            setExpandedGroups({});
                          } catch (e: any) {
                            alert('Erro ao mover dados: ' + (e.message || 'Erro desconhecido'));
                          } finally {
                            setIsMovingData(false);
                          }
                        }}
                        className="px-5 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isMovingData ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        {moveFromSetorId ? 'Mover para' : 'Atribuir para'} {setores.find(s => s.id === moveToSetorId)?.name || '...'}
                      </button>
                    </div>
                  )}

                  {moveResults && (
                    <div className="mt-3 bg-green-50 rounded-lg border border-green-200 p-3 text-xs space-y-1.5">
                      <p className="flex items-center gap-2 font-semibold text-green-800">
                        <CheckCircle2 size={16} /> Operação concluída com sucesso!
                      </p>
                      {moveResults.filter(r => r.count > 0).length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-0.5 pl-6">
                          {moveResults.filter(r => r.count > 0).map(r => (
                            <p key={r.table} className="text-green-700">
                              <span className="font-medium">{r.table}:</span> {r.count} registro(s) movido(s)
                            </p>
                          ))}
                        </div>
                      )}
                      {moveResults.every(r => r.count === 0) && (
                        <p className="text-green-600 italic pl-6">Nenhum registro foi encontrado para mover.</p>
                      )}
                    </div>
                  )}
                </div>
                )}
              </>
            )}

          </div>
        </Modal>

        {/* Account Config Modal (Password + Email) - Tabbed */}
        <Modal isOpen={showAccountConfig} onClose={() => setShowAccountConfig(false)} title="">
          <div>
            {/* Header com Avatar e nome */}
            <div className="text-center pb-5 mb-2">
              <div className="mx-auto w-14 h-14 bg-gradient-to-br from-ifrn-green to-emerald-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-green-200">
                <span className="text-white font-black text-2xl">{user?.name?.charAt(0)}</span>
              </div>
              <h3 className="text-xl font-black text-gray-900">{user?.name}</h3>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{user?.level} · Matrícula {user?.matricula}</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
              <button
                type="button"
                onClick={() => { setAccountTab('email'); setEmailError(''); setEmailSuccess(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  accountTab === 'email'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Mail size={15} />
                E-mail
              </button>
              <button
                type="button"
                onClick={() => { setAccountTab('password'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  accountTab === 'password'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <KeyRound size={15} />
                Senha
              </button>
            </div>

            {/* ── ABA: E-MAIL ── */}
            {accountTab === 'email' && (
              <div className="space-y-4 animate-fade-in-up">
                {user?.email && (
                  <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                    <Mail size={16} className="text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-blue-500 font-bold uppercase tracking-wide">E-mail atual</p>
                      <p className="text-sm font-semibold text-gray-800">{user.email}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleUpdateEmail} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Novo E-mail</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all font-medium placeholder:text-gray-400"
                      placeholder="exemplo@email.com"
                      autoComplete="off"
                      readOnly
                      onFocus={e => e.currentTarget.removeAttribute('readOnly')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Confirmar Novo E-mail</label>
                    <input
                      type="email"
                      required
                      value={confirmEmail}
                      onChange={e => setConfirmEmail(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all font-medium placeholder:text-gray-400"
                      placeholder="confirme@email.com"
                      autoComplete="off"
                      readOnly
                      onFocus={e => e.currentTarget.removeAttribute('readOnly')}
                    />
                  </div>

                  {emailError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                      <AlertCircle size={16} className="flex-shrink-0" />
                      <span className="font-medium">{emailError}</span>
                    </div>
                  )}
                  {emailSuccess && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 text-ifrn-green text-sm rounded-xl border border-green-100">
                      <CheckCircle2 size={16} className="flex-shrink-0" />
                      <span className="font-medium">{emailSuccess}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAccountConfig(false)}
                      className="flex-1 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-all text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="flex-1 py-3 bg-gradient-to-r from-ifrn-green to-emerald-600 text-white rounded-xl hover:shadow-lg hover:shadow-green-200 hover:-translate-y-0.5 active:translate-y-0 font-bold transition-all text-sm flex items-center justify-center gap-2"
                    >
                      {emailLoading ? <Loader2 size={18} className="animate-spin" /> : <><Mail size={16} /> {user?.email ? 'Atualizar E-mail' : 'Cadastrar E-mail'}</>}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── ABA: SENHA ── */}
            {accountTab === 'password' && (
              <div className="space-y-4 animate-fade-in-up">
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Senha Atual</label>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all font-medium placeholder:text-gray-400"
                        placeholder="Digite sua senha atual"
                        autoComplete="off"
                        readOnly
                        onFocus={e => e.currentTarget.removeAttribute('readOnly')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ifrn-green transition-colors"
                        tabIndex={-1}
                      >
                        {showCurrentPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Nova Senha</label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all font-medium placeholder:text-gray-400"
                        placeholder="Mínimo de 3 caracteres"
                        autoComplete="off"
                        readOnly
                        onFocus={e => e.currentTarget.removeAttribute('readOnly')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ifrn-green transition-colors"
                        tabIndex={-1}
                      >
                        {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Confirmar Nova Senha</label>
                    <div className="relative">
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all font-medium placeholder:text-gray-400"
                        placeholder="Repita a nova senha"
                        autoComplete="off"
                        readOnly
                        onFocus={e => e.currentTarget.removeAttribute('readOnly')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ifrn-green transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                      <AlertCircle size={16} className="flex-shrink-0" />
                      <span className="font-medium">{passwordError}</span>
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 text-ifrn-green text-sm rounded-xl border border-green-100">
                      <CheckCircle2 size={16} className="flex-shrink-0" />
                      <span className="font-medium">{passwordSuccess}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAccountConfig(false)}
                      className="flex-1 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-all text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-gradient-to-r from-ifrn-green to-emerald-600 text-white rounded-xl hover:shadow-lg hover:shadow-green-200 hover:-translate-y-0.5 active:translate-y-0 font-bold transition-all text-sm flex items-center justify-center gap-2"
                    >
                      <KeyRound size={16} /> Salvar Nova Senha
                    </button>
                  </div>
                </form>
              </div>
            )}
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
              <IfrnLogo className="scale-90 origin-left flex-shrink-0" campus={user?.level === UserLevel.ADMIN ? "" : (campuses.find(c => c.id === user?.campus_id)?.name || '')} sector={user?.level === UserLevel.ADMIN ? "" : (setores.find(s => s.id === user?.setor_id)?.name || '')} />
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
              <button onClick={() => { openAccountConfig(); setMobileMenuOpen(false); }} className="mt-3 w-full flex items-center justify-center gap-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50"><Settings size={14} /> Configurações da Conta</button>
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
              {currentSystem === 'frequencia' && (
                <>
                  <button onClick={() => handleMobileNav('frequencia')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'frequencia' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><ClipboardList size={20} /> Gestão de Aulas</button>
                  <button onClick={() => handleMobileNav('salas')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'salas' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}><Building2 size={20} /> Controle de Salas</button>
                </>
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
            <button
              onClick={() => { setShowModuleSelector(true); setCurrentSystem(null); sessionStorage.removeItem('currentSystem'); }}
              className="hover:opacity-80 transition-opacity"
              title="Ir para tela inicial"
            >
              <IfrnLogo campus={user?.level === UserLevel.ADMIN ? "" : (campuses.find(c => c.id === user?.campus_id)?.name || '')} sector={user?.level === UserLevel.ADMIN ? "" : (setores.find(s => s.id === user?.setor_id)?.name || '')} className="flex-shrink-0 cursor-pointer" />
            </button>
          </div>
          <div className="flex items-center gap-4 flex-1 justify-center md:justify-start max-w-sm ml-4">
            {user.level === UserLevel.ADMIN && (
              <div className="relative group w-full hidden md:flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-hover:text-ifrn-green transition-colors">
                    <Building2 size={16} />
                  </div>
                  <select
                    value={adminGlobalCampusId || ''}
                    onChange={e => { setAdminGlobalCampusId(e.target.value || null); setAdminGlobalSetorId(null); refreshSetores(e.target.value || undefined); }}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold rounded-lg pl-9 pr-3 py-1.5 focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all cursor-pointer hover:bg-white"
                  >
                    <option value="">🌎 Todos os Câmpus</option>
                    {campuses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {adminGlobalCampusId && setores.length > 0 && (
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Building2 size={16} />
                    </div>
                    <select
                      value={adminGlobalSetorId || ''}
                      onChange={e => setAdminGlobalSetorId(e.target.value || null)}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold rounded-lg pl-9 pr-3 py-1.5 focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green outline-none transition-all cursor-pointer hover:bg-white"
                    >
                      <option value="">📋 Todos os Setores</option>
                      {setores.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            {loading && <Loader2 className="animate-spin text-ifrn-green" size={20} />}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-sm font-bold text-gray-800 flex items-center justify-end gap-2">{user.name}<button onClick={openAccountConfig} className="text-gray-400 hover:text-ifrn-green p-1 rounded-full transition-colors" title="Configurações da Conta"><Settings size={14} /></button></div>
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

      <main className="flex-1 w-full mx-auto p-4 md:p-6 space-y-6">
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
          {currentSystem === 'copias' && (
            <button onClick={() => setActiveTab('copias-nf')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'copias-nf' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><FileText size={18} /> Conferência de NF
            </button>
          )}
          {currentSystem === 'notificacoes' && (
            <button onClick={() => setActiveTab('notificacoes')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'notificacoes' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><ShieldAlert size={18} /> Notificação de Alunos</button>
          )}
          {currentSystem === 'frequencia' && (
            <>
              <button onClick={() => setActiveTab('frequencia')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'frequencia' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><ClipboardList size={18} /> Gestão de Aulas</button>
              <button onClick={() => setActiveTab('salas')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'salas' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}><Building2 size={18} /> Controle de Salas</button>
            </>
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
                    setores={setores}
                    adminGlobalCampusId={adminGlobalCampusId}
                    adminGlobalSetorId={adminGlobalSetorId}
                  />
                )}
                {activeTab === 'relatos' && <LostReportsTab reports={reports} items={items} onUpdate={refreshData} user={user} campuses={campuses} setores={setores} adminGlobalCampusId={adminGlobalCampusId} adminGlobalSetorId={adminGlobalSetorId} />}
                {activeTab === 'pessoas' && (
                  <PeopleTab
                    onUpdate={refreshData}
                    user={user}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'armarios' && <ArmariosTab user={user} lockers={lockers} onUpdate={refreshData} campuses={campuses} setores={setores} adminGlobalCampusId={adminGlobalCampusId} adminGlobalSetorId={adminGlobalSetorId} />}
                {activeTab === 'livros-catalogo' && (
                  <BooksTab
                    books={books}
                    bookLoans={bookLoans}
                    onUpdate={refreshData}
                    user={user}
                    campuses={campuses}
                    setores={setores}
                    adminGlobalCampusId={adminGlobalCampusId}
                    adminGlobalSetorId={adminGlobalSetorId}
                  />
                )}
                {activeTab === 'livros-emprestimos' && (
                  <BookLoansTab
                    loans={bookLoans}
                    books={books}
                    onUpdate={refreshBookLoans}
                    user={user}
                    campuses={campuses}
                    setores={setores}
                    adminGlobalCampusId={adminGlobalCampusId}
                    adminGlobalSetorId={adminGlobalSetorId}
                  />
                )}
                {activeTab === 'livros-relatorios' && (
                  <BookReportsTab
                    books={books}
                    loans={bookLoans}
                    user={user}
                    campuses={campuses}
                    setores={setores}
                    adminGlobalCampusId={adminGlobalCampusId}
                    adminGlobalSetorId={adminGlobalSetorId}
                  />
                )}
                {activeTab === 'copias' && (
                  <CopyControlTab
                    records={copyRecords}
                    config={copyConfigs[0]}
                    user={user}
                    campuses={campuses}
                    setores={setores}
                    adminGlobalCampusId={adminGlobalCampusId}
                    adminGlobalSetorId={adminGlobalSetorId}
                    onUpdate={refreshData}
                  />
                )}
                {activeTab === 'copias-nf' && (
                  <PrinterNFTab
                    user={user}
                    campuses={campuses}
                    adminGlobalCampusId={adminGlobalCampusId}
                  />
                )}
                {activeTab === 'nadaconsta' && (
                  <NadaConstaTab
                    lockers={lockers}
                    bookLoans={bookLoans}
                    materialLoans={materialLoans}
                    user={user}
                    campuses={campuses}
                    setores={setores}
                    adminGlobalCampusId={adminGlobalCampusId}
                    adminGlobalSetorId={adminGlobalSetorId}
                  />
                )}
                {activeTab === 'materiais' && (
                  <MaterialManagementTab
                    materials={materials}
                    loans={materialLoans}
                    user={user}
                    onUpdate={refreshData}
                    campuses={campuses}
                    setores={setores}
                    adminGlobalCampusId={adminGlobalCampusId}
                    adminGlobalSetorId={adminGlobalSetorId}
                  />
                )}
                {activeTab === 'insumos' && (
                  <InsumosTab
                    user={user}
                    onRefresh={refreshData}
                    setores={setores}
                    adminGlobalCampusId={adminGlobalCampusId}
                    adminGlobalSetorId={adminGlobalSetorId}
                    suppliesRefreshKey={suppliesRefreshKey}
                  />
                )}
                {activeTab === 'notificacoes' && (
                  <NotificationsTab
                    notifications={notifications}
                    notificationTypes={notificationTypes}
                    user={user}
                    onUpdate={refreshNotifications}
                    campuses={campuses}
                    setores={setores}
                    adminGlobalCampusId={adminGlobalCampusId}
                    adminGlobalSetorId={adminGlobalSetorId}
                  />
                )}
                {activeTab === 'frequencia' && (
                  <TeacherAttendanceTab
                    user={user}
                    campuses={campuses}
                    setores={setores}
                    adminGlobalCampusId={adminGlobalCampusId}
                    adminGlobalSetorId={adminGlobalSetorId}
                  />
                )}
                {activeTab === 'salas' && (
                  <RoomsTab
                    user={user}
                    campuses={campuses}
                    setores={setores}
                    adminGlobalCampusId={adminGlobalCampusId}
                    adminGlobalSetorId={adminGlobalSetorId}
                  />
                )}
                {activeTab === 'usuarios' && <UsersTab users={users} currentUser={user} onUpdate={refreshData} campuses={campuses} setores={setores} adminGlobalCampusId={adminGlobalCampusId} adminGlobalSetorId={adminGlobalSetorId} />}
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

    </div >
  );
};

export default App;