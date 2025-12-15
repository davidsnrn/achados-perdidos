import React, { useState, useEffect } from 'react';
import { StorageService } from './services/storage';
import { User, UserLevel, FoundItem, LostReport, Person } from './types';
import { IfrnLogo } from './components/Logo';
import { FoundItemsTab } from './components/Tabs/FoundItemsTab';
import { LostReportsTab } from './components/Tabs/LostReportsTab';
import { PeopleTab } from './components/Tabs/PeopleTab';
import { UsersTab } from './components/Tabs/UsersTab';
import { LogOut, Package, ClipboardList, Users, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('achados');
  
  // Data State
  const [items, setItems] = useState<FoundItem[]>([]);
  const [reports, setReports] = useState<LostReport[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Login State
  const [loginMat, setLoginMat] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Initial Load
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setItems(StorageService.getItems());
    setReports(StorageService.getReports());
    setPeople(StorageService.getPeople());
    setUsers(StorageService.getUsers());
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const loggedUser = StorageService.login(loginMat, loginPass);
    if (loggedUser) {
      setUser(loggedUser);
      setLoginError('');
    } else {
      setLoginError('Credenciais inválidas. Tente novamente.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setLoginMat('');
    setLoginPass('');
    setActiveTab('achados');
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
                className="w-full bg-ifrn-red text-white font-bold py-3 rounded-lg hover:bg-red-700 transition-colors"
              >
                Entrar
              </button>
            </form>
            <div className="mt-6 text-center text-xs text-gray-400">
              <p>Credenciais padrão para teste:</p>
              <p>Admin: admin / admin</p>
              <p>Padrão: op1 / 123</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex justify-between items-center">
          <IfrnLogo />
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-sm font-bold text-gray-800">{user.name}</div>
              <div className="text-xs text-gray-500">{user.level} • {user.matricula}</div>
            </div>
            <div className="h-8 w-px bg-gray-200 mx-1"></div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
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
          {activeTab === 'achados' && <FoundItemsTab items={items} onUpdate={refreshData} />}
          {activeTab === 'relatos' && <LostReportsTab reports={reports} people={people} onUpdate={refreshData} />}
          {activeTab === 'pessoas' && <PeopleTab people={people} onUpdate={refreshData} />}
          {activeTab === 'usuarios' && <UsersTab users={users} />}
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} IFRN Campus Natal-Central. COADES.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;