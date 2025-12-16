import React, { useState, useEffect, useCallback } from 'react';
import { StorageService } from './services/storage';
import { User, UserLevel, FoundItem, LostReport, Person } from './types';
import { IfrnLogo } from './components/Logo';
import { FoundItemsTab } from './components/Tabs/FoundItemsTab';
import { LostReportsTab } from './components/Tabs/LostReportsTab';
import { PeopleTab } from './components/Tabs/PeopleTab';
import { UsersTab } from './components/Tabs/UsersTab';
import { LogOut, Package, ClipboardList, Users, ShieldCheck, KeyRound, Menu, X, Settings, Trash, AlertTriangle, ChevronDown, ChevronUp, UserX, FileX, Save, Building2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Modal } from './components/ui/Modal';

type ConfirmActionType = 'DELETE_ITEMS' | 'DELETE_REPORTS' | 'DELETE_PEOPLE' | 'DELETE_USERS' | 'FACTORY_RESET' | null;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'achados');
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Settings / Admin Config State
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const [mobileDeleteOpen, setMobileDeleteOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [desktopDeleteOpen, setDesktopDeleteOpen] = useState(false);
  
  // System Config State
  const [systemSector, setSystemSector] = useState('COADES');
  const [systemCampus, setSystemCampus] = useState('NOVA CRUZ');

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

  // Persist Tab
  useEffect(() => {
    if (user) {
      localStorage.setItem('activeTab', activeTab);
    }
  }, [activeTab, user]);

  // Refresh Data Helper (Async)
  const refreshData = async () => {
    setLoading(true);
    try {
      const [fetchedItems, fetchedReports, fetchedPeople, fetchedUsers] = await Promise.all([
        StorageService.getItems(),
        StorageService.getReports(),
        StorageService.getPeople(),
        StorageService.getUsers()
      ]);
      setItems(fetchedItems);
      setReports(fetchedReports);
      setPeople(fetchedPeople);
      setUsers(fetchedUsers);
    } catch (e) {
      console.error("Erro ao carregar dados", e);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemConfig = useCallback(async () => {
    const config = await StorageService.getConfig();
    setSystemSector(config.sector);
    setSystemCampus(config.campus);
  }, []);

  const handleLogout = useCallback(() => {
    StorageService.clearSession();
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
  }, []);

  // Initial Load
  useEffect(() => {
    loadSystemConfig();

    const initSession = async () => {
      const sessionUser = StorageService.getSessionUser();
      if (sessionUser) {
        if (StorageService.isSessionExpired()) {
          handleLogout();
        } else {
          setUser(sessionUser);
          await refreshData(); // Await data load
          StorageService.updateLastActive();
        }
      }
    };
    initSession();

    // Inactivity Timer
    const handleActivity = () => {
       if (user) StorageService.updateLastActive();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const intervalId = setInterval(() => {
      if (user && StorageService.isSessionExpired()) {
        handleLogout();
        alert("Sua sessão expirou por inatividade (5 minutos).");
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
  }, [user, handleLogout, loadSystemConfig]);

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
        await refreshData();
      } else {
        setLoginError('Credenciais inválidas. Tente novamente.');
      }
    } catch (e) {
      setLoginError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (user.password !== currentPassword) {
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
    if (!user || user.password !== confirmationPassword) {
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
        await StorageService.factoryReset();
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
    switch(confirmAction) {
      case 'DELETE_ITEMS': return 'Apagar Todos os Itens';
      case 'DELETE_REPORTS': return 'Apagar Relatos de Perdidos';
      case 'DELETE_PEOPLE': return 'Apagar Pessoas Cadastradas';
      case 'DELETE_USERS': return 'Apagar Usuários do Sistema';
      case 'FACTORY_RESET': return 'Reset Geral (Fábrica)';
      default: return '';
    }
  };

  const canConfigure = user?.level === UserLevel.ADMIN || user?.level === UserLevel.ADVANCED;

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
          <div className="bg-gray-50 p-8 flex flex-col items-center border-b border-gray-100">
            <IfrnLogo className="mb-2" sector={systemSector} campus={systemCampus} />
          </div>
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Acesso ao Sistema</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Matrícula</label>
                <input 
                  type="text" 
                  value={loginMat}
                  onChange={e => setLoginMat(e.target.value)}
                  className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-ifrn-green" 
                  placeholder="Seu usuário..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Senha</label>
                <div className="relative group">
                  <input 
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPass}
                    onChange={e => setLoginPass(e.target.value)}
                    className="w-full border rounded-lg p-3 pr-10 outline-none focus:ring-2 focus:ring-ifrn-green" 
                    placeholder="Sua senha..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-ifrn-green opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200"
                    tabIndex={-1}
                  >
                    {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              {loginError && <p className="text-sm text-red-500 text-center">{loginError}</p>}
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-ifrn-green text-white font-bold py-3 rounded-lg hover:bg-ifrn-darkGreen transition-colors shadow-md flex justify-center items-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col animate-slideInLeft overflow-y-auto">
            {/* ... (Conteúdo do Drawer mantém-se similar, apenas lógica interna não muda) ... */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <IfrnLogo className="scale-90 origin-left" sector={systemSector} campus={systemCampus} />
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-red-500 p-1">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 bg-gray-50 border-b border-gray-100">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-ifrn-green text-white flex items-center justify-center font-bold text-lg">
                    {user.name.charAt(0)}
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.level}</p>
                 </div>
               </div>
               <button 
                  onClick={() => { setShowPasswordModal(true); setMobileMenuOpen(false); }} 
                  className="mt-3 w-full flex items-center justify-center gap-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50"
                >
                  <KeyRound size={14} /> Alterar Senha
               </button>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              <button 
                onClick={() => handleMobileNav('achados')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'achados' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <Package size={20} /> Itens Achados
              </button>
              <button 
                onClick={() => handleMobileNav('relatos')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'relatos' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <ClipboardList size={20} /> Relatos de Perdidos
              </button>
              <button 
                onClick={() => handleMobileNav('pessoas')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'pessoas' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <Users size={20} /> Cadastro de Pessoas
              </button>
              {(user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED) && (
                <button 
                  onClick={() => handleMobileNav('usuarios')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${activeTab === 'usuarios' ? 'bg-ifrn-green text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <ShieldCheck size={20} /> Usuários
                </button>
              )}

              {canConfigure && (
                <div className="pt-4 mt-2 border-t border-gray-100">
                  <button 
                    onClick={() => setConfigMenuOpen(!configMenuOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <Settings size={20} /> Configurações
                    </div>
                    {configMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  
                  {configMenuOpen && (
                    <div className="bg-gray-50 rounded-lg mt-1 overflow-hidden transition-all p-2 space-y-1">
                      <button 
                        onClick={() => { openConfigModal(); setMobileMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 rounded"
                      >
                        <Building2 size={14} /> Personalizar Campus
                      </button>

                      {user.level === UserLevel.ADMIN && (
                        <>
                          <button 
                            onClick={() => setMobileDeleteOpen(!mobileDeleteOpen)}
                            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded mt-1"
                          >
                            <div className="flex items-center gap-2">
                              <Trash size={14} /> Apagar Dados
                            </div>
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
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2 justify-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
              >
                <LogOut size={18} /> Sair do Sistema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-gray-500 hover:text-ifrn-green p-1 transition-colors"
            >
              <Menu size={24} />
            </button>
            <IfrnLogo sector={systemSector} campus={systemCampus} />
          </div>
          
          <div className="flex items-center gap-4">
             {loading && <Loader2 className="animate-spin text-ifrn-green" size={20} />}
             <div className="text-right hidden md:block">
              <div className="text-sm font-bold text-gray-800 flex items-center justify-end gap-2">
                 {user.name}
                 <button 
                   onClick={() => setShowPasswordModal(true)} 
                   className="text-gray-400 hover:text-ifrn-green p-1 rounded-full transition-colors"
                   title="Alterar Minha Senha"
                 >
                   <KeyRound size={14} />
                 </button>
              </div>
              <div className="text-xs text-gray-500">{user.level} • {user.matricula}</div>
            </div>
            
            {canConfigure && (
              <button 
                onClick={openConfigModal}
                className="hidden md:block p-2 text-gray-500 hover:text-ifrn-green transition-colors"
                title="Configurações Administrativas"
              >
                <Settings size={20} />
              </button>
            )}

            <div className="hidden md:block h-8 w-px bg-gray-200 mx-1"></div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 transition-colors hidden md:block"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="hidden md:flex flex-wrap gap-2 border-b border-gray-200 pb-1">
          <button onClick={() => setActiveTab('achados')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'achados' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
            <Package size={18} /> Itens Achados
          </button>
          <button onClick={() => setActiveTab('relatos')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'relatos' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
            <ClipboardList size={18} /> Relatos de Perdidos
          </button>
          <button onClick={() => setActiveTab('pessoas')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'pessoas' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
            <Users size={18} /> Cadastro de Pessoas
          </button>
          {(user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED) && (
            <button onClick={() => setActiveTab('usuarios')} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${activeTab === 'usuarios' ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
              <ShieldCheck size={18} /> Usuários
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
           {loading && activeTab !== 'none' ? (
             <div className="flex justify-center items-center h-64">
               <Loader2 className="animate-spin text-ifrn-green" size={48} />
             </div>
           ) : (
             <>
              {activeTab === 'achados' && <FoundItemsTab items={items} people={people} reports={reports} onUpdate={refreshData} user={user} />}
              {activeTab === 'relatos' && <LostReportsTab reports={reports} people={people} onUpdate={refreshData} user={user} />}
              {activeTab === 'pessoas' && <PeopleTab people={people} onUpdate={refreshData} user={user} />}
              {activeTab === 'usuarios' && <UsersTab users={users} currentUser={user} onUpdate={refreshData} />}
             </>
           )}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Desenvolvido por David Galdino
          </p>
        </div>
      </footer>

      {/* Modals */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Alterar Minha Senha">
         {/* Form change pass */}
         <form onSubmit={handleChangePassword} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Senha Atual</label><input type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label><input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label><input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" /></div>
          <div className="pt-4 flex justify-end gap-3 border-t">
            <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button type="submit" className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-medium flex items-center gap-2"><KeyRound size={18} /> Salvar Nova Senha</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="Configurações do Sistema">
         {/* Config form contents are same as before */}
         <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
           <form onSubmit={handleSaveSystemConfig} className="space-y-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <h4 className="font-bold text-gray-800 flex items-center gap-2 pb-2 border-b border-blue-100"><Building2 size={18} className="text-blue-600"/> Personalizar Campus</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome do Setor</label><input type="text" value={configSector} onChange={e => setConfigSector(e.target.value.toUpperCase())} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="Ex: COADES" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome do Campus</label><input type="text" value={configCampus} onChange={e => setConfigCampus(e.target.value.toUpperCase())} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="Ex: NOVA CRUZ" /></div>
              </div>
              <div className="flex justify-end pt-2"><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"><Save size={16} /> Salvar Alterações</button></div>
           </form>
           {user.level === UserLevel.ADMIN && (
             <div className="border-t border-gray-100 pt-4 mt-4">
               <button type="button" onClick={() => setDesktopDeleteOpen(!desktopDeleteOpen)} className="w-full flex items-center justify-between p-3 bg-red-50 text-red-800 rounded-lg hover:bg-red-100 transition-colors">
                 <div className="flex items-center gap-2 font-bold"><Trash size={18} /> Apagar Dados</div>
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