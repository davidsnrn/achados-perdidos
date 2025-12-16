import React, { useState, useEffect, useCallback } from 'react';
import { StorageService } from './services/storage';
import { User, UserLevel, FoundItem, LostReport, Person } from './types';
import { IfrnLogo } from './components/Logo';
import { FoundItemsTab } from './components/Tabs/FoundItemsTab';
import { LostReportsTab } from './components/Tabs/LostReportsTab';
import { PeopleTab } from './components/Tabs/PeopleTab';
import { UsersTab } from './components/Tabs/UsersTab';
import { LogOut, Package, ClipboardList, Users, ShieldCheck, KeyRound, Menu, X } from 'lucide-react';
import { Modal } from './components/ui/Modal';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('achados');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Data State
  const [items, setItems] = useState<FoundItem[]>([]);
  const [reports, setReports] = useState<LostReport[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Login State
  const [loginMat, setLoginMat] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Change Password State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Refresh Data Helper
  const refreshData = () => {
    setItems(StorageService.getItems());
    setReports(StorageService.getReports());
    setPeople(StorageService.getPeople());
    setUsers(StorageService.getUsers());
  };

  const handleLogout = useCallback(() => {
    StorageService.clearSession();
    setUser(null);
    setLoginMat('');
    setLoginPass('');
    setActiveTab('achados');
    setMobileMenuOpen(false);
  }, []);

  // Initial Load & Session Management
  useEffect(() => {
    // 1. Try to restore session
    const sessionUser = StorageService.getSessionUser();
    if (sessionUser) {
      // Check if session expired while closed
      if (StorageService.isSessionExpired()) {
        handleLogout();
      } else {
        setUser(sessionUser);
        refreshData();
        StorageService.updateLastActive(); // Refresh timestamp on load
      }
    }

    // 2. Inactivity Timer Logic
    const handleActivity = () => {
       if (user) {
         StorageService.updateLastActive();
       }
    };

    // Events to track activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Check for expiration periodically (every 30 seconds)
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
  }, [user, handleLogout]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    attemptLogin(loginMat, loginPass);
  };

  const attemptLogin = (mat: string, pass: string) => {
    const loggedUser = StorageService.login(mat, pass);
    if (loggedUser) {
      StorageService.setSessionUser(loggedUser); // Save session
      setUser(loggedUser);
      setLoginError('');
      refreshData();
    } else {
      setLoginError('Credenciais inválidas. Tente novamente.');
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
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

    const updatedUser = StorageService.changePassword(user.id, newPassword, user.name);
    if (updatedUser) {
      setUser(updatedUser);
      StorageService.setSessionUser(updatedUser); // Update session with new password/data
      alert("Senha alterada com sucesso!");
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleMobileNav = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
          <div className="bg-gray-50 p-8 flex flex-col items-center border-b border-gray-100">
            <IfrnLogo className="mb-2" />
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
                <input 
                  type="password"
                  value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-ifrn-green" 
                  placeholder="Sua senha..."
                />
              </div>
              {loginError && <p className="text-sm text-red-500 text-center">{loginError}</p>}
              <button 
                type="submit" 
                className="w-full bg-ifrn-green text-white font-bold py-3 rounded-lg hover:bg-ifrn-darkGreen transition-colors shadow-md"
              >
                Entrar
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
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          
          {/* Drawer */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col animate-slideInLeft">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <IfrnLogo className="scale-90 origin-left" />
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

            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
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
            {/* Botão Menu Mobile */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-gray-500 hover:text-ifrn-green p-1 transition-colors"
            >
              <Menu size={24} />
            </button>
            <IfrnLogo />
          </div>
          
          <div className="flex items-center gap-4">
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
        
        {/* Navigation Tabs (Desktop Only) - Hidden on Mobile */}
        <div className="hidden md:flex flex-wrap gap-2 border-b border-gray-200 pb-1">
          <button 
            onClick={() => setActiveTab('achados')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${
              activeTab === 'achados' 
                ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' 
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <Package size={18} /> Itens Achados
          </button>
          
          <button 
            onClick={() => setActiveTab('relatos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${
              activeTab === 'relatos' 
                ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' 
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <ClipboardList size={18} /> Relatos de Perdidos
          </button>
          
          <button 
            onClick={() => setActiveTab('pessoas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${
              activeTab === 'pessoas' 
                ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' 
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <Users size={18} /> Cadastro de Pessoas
          </button>

          {(user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED) && (
            <button 
              onClick={() => setActiveTab('usuarios')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all ${
                activeTab === 'usuarios' 
                  ? 'bg-white border-x border-t border-gray-200 text-ifrn-darkGreen -mb-px' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <ShieldCheck size={18} /> Usuários
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'achados' && (
            <FoundItemsTab 
              items={items} 
              people={people}
              reports={reports}
              onUpdate={refreshData} 
              user={user}
            />
          )}
          {activeTab === 'relatos' && <LostReportsTab reports={reports} people={people} onUpdate={refreshData} />}
          {activeTab === 'pessoas' && <PeopleTab people={people} onUpdate={refreshData} />}
          {activeTab === 'usuarios' && <UsersTab users={users} currentUser={user} onUpdate={refreshData} />}
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

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Alterar Minha Senha"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha Atual</label>
            <input 
              type="password"
              required 
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
            <input 
              type="password"
              required 
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
            <input 
              type="password"
              required 
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" 
            />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t">
            <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button type="submit" className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-medium flex items-center gap-2">
              <KeyRound size={18} /> Salvar Nova Senha
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default App;