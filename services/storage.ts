import { FoundItem, ItemStatus, LostReport, Person, PersonType, ReportStatus, User, UserLevel } from "../types";

// Initial Mock Data
const INITIAL_USERS: User[] = [
  { 
    id: '1', 
    matricula: 'admin', 
    name: 'Administrador COADES', 
    password: 'admin', 
    level: UserLevel.ADMIN,
    logs: ['Usuário inicial do sistema.']
  },
  { 
    id: '2', 
    matricula: 'op1', 
    name: 'Operador Padrão', 
    password: '123', 
    level: UserLevel.STANDARD,
    logs: ['Usuário inicial do sistema.']
  },
];

const INITIAL_ITEMS: FoundItem[] = [
  {
    id: 1,
    description: 'Garrafa Azul',
    detailedDescription: 'Garrafa térmica marca Contigo, azul marinho, amassada na base.',
    locationFound: 'Auditório',
    locationStored: 'Armário 2, Prateleira B',
    dateFound: new Date().toISOString().split('T')[0],
    dateRegistered: new Date().toISOString(),
    status: ItemStatus.AVAILABLE,
    history: [
      { date: new Date().toISOString(), action: 'Item registrado no sistema.', user: 'admin' }
    ]
  },
  {
    id: 2,
    description: 'Caderno Capa Dura',
    locationFound: 'Sala 60',
    locationStored: 'Sala AP',
    dateFound: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
    dateRegistered: new Date(Date.now() - 86400000 * 5).toISOString(),
    status: ItemStatus.RETURNED,
    returnedTo: 'João Silva',
    returnedDate: new Date().toISOString(),
    history: [
      { date: new Date(Date.now() - 86400000 * 5).toISOString(), action: 'Item registrado.', user: 'op1' },
      { date: new Date().toISOString(), action: 'Item devolvido para João Silva.', user: 'admin' }
    ]
  }
];

const INITIAL_PEOPLE: Person[] = [
  { id: 'p1', matricula: '20231011110055', name: 'Maria Souza', type: PersonType.STUDENT },
  { id: 'p2', matricula: '1552233', name: 'Prof. Carlos Lima', type: PersonType.SERVER },
];

const INITIAL_REPORTS: LostReport[] = [
  {
    id: 'r1',
    itemDescription: 'Chave do carro Honda',
    personName: 'Maria Souza',
    personId: 'p1',
    whatsapp: '84999998888',
    status: ReportStatus.OPEN,
    createdAt: new Date().toISOString(),
    history: [{ date: new Date().toISOString(), note: 'Relato criado.' }]
  }
];

// Helper to manage localStorage
const getStorage = <T>(key: string, initial: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(stored);
};

const setStorage = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Session constants
const SESSION_USER_KEY = 'coades_session_user';
const LAST_ACTIVE_KEY = 'coades_last_active';
const TIMEOUT_MINUTES = 5;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;

// API Services
export const StorageService = {
  // Users
  getUsers: (): User[] => getStorage('users', INITIAL_USERS),
  
  saveUser: (user: User, actorName: string) => {
    const users = StorageService.getUsers();
    
    // Check for duplicate matricula on OTHER users
    const duplicate = users.find(u => u.matricula === user.matricula && u.id !== user.id);
    if (duplicate) {
      throw new Error(`Erro: A matrícula '${user.matricula}' já está cadastrada para o usuário '${duplicate.name}'.`);
    }

    const existingIndex = users.findIndex(u => u.id === user.id);
    const dateStr = new Date().toLocaleString('pt-BR');

    if (existingIndex >= 0) {
      // Update
      const existingUser = users[existingIndex];
      // Mantém a senha antiga, a menos que tenha sido alterada explicitamente (aqui assumimos que saveUser via admin NÃO muda senha, apenas reset)
      
      const logMessage = `Editado por ${actorName} em ${dateStr}.`;
      user.logs = [...(existingUser.logs || []), logMessage];
      
      users[existingIndex] = user;
    } else {
      // Create
      // Senha padrão na criação
      user.password = 'ifrn123';
      const logMessage = `Criado por ${actorName} em ${dateStr} com senha padrão.`;
      user.logs = [logMessage];
      users.push(user);
    }
    setStorage('users', users);
  },

  deleteUser: (id: string) => {
    const users = StorageService.getUsers().filter(u => u.id !== id);
    setStorage('users', users);
  },

  changePassword: (userId: string, newPass: string, actorName: string) => {
    const users = StorageService.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index >= 0) {
      users[index].password = newPass;
      const dateStr = new Date().toLocaleString('pt-BR');
      const log = `Senha alterada pelo próprio usuário em ${dateStr}.`;
      users[index].logs = [...(users[index].logs || []), log];
      setStorage('users', users);
      return users[index];
    }
    return null;
  },
  
  // People
  getPeople: (): Person[] => getStorage('people', INITIAL_PEOPLE),
  savePerson: (person: Person) => {
    const people = StorageService.getPeople();
    
    // Check for duplicate matricula on OTHER people
    if (people.some(p => p.matricula === person.matricula && p.id !== person.id)) {
      throw new Error("Matrícula já cadastrada para outra pessoa.");
    }

    const existingIndex = people.findIndex(p => p.id === person.id);
    let newList;
    
    if (existingIndex >= 0) {
      // Update
      people[existingIndex] = person;
      newList = [...people];
    } else {
      // Create
      newList = [...people, person];
    }
    
    setStorage('people', newList);
    return newList;
  },
  deletePerson: (id: string) => {
    const people = StorageService.getPeople().filter(p => p.id !== id);
    setStorage('people', people);
  },
  importPeople: (people: Person[]) => {
    const current = StorageService.getPeople();
    // Simple merge avoiding duplicates by matricula
    const newPeople = people.filter(p => !current.some(c => c.matricula === p.matricula));
    setStorage('people', [...current, ...newPeople]);
  },

  // Items
  getItems: (): FoundItem[] => getStorage('items', INITIAL_ITEMS),
  saveItem: (item: FoundItem, actionDescription?: string) => {
    const items = StorageService.getItems();
    const exists = items.find(i => i.id === item.id);
    
    // Create history entry
    const newHistoryEntry = {
      date: new Date().toISOString(),
      action: actionDescription || (exists ? 'Item atualizado.' : 'Item registrado.'),
      user: 'Sistema' // Em um app real, pegaríamos o usuário logado
    };

    if (exists) {
      // Preserve existing history and add new entry
      item.history = [...(exists.history || []), newHistoryEntry];
      const updated = items.map(i => i.id === item.id ? item : i);
      setStorage('items', updated);
    } else {
      // Generate ID if new (simple max + 1)
      const maxId = items.reduce((max, i) => Math.max(max, i.id), 0);
      item.id = maxId + 1;
      item.history = [newHistoryEntry];
      setStorage('items', [item, ...items]);
    }
  },
  deleteItem: (id: number) => {
    const items = StorageService.getItems().filter(i => i.id !== id);
    setStorage('items', items);
  },
  
  // Reports
  getReports: (): LostReport[] => getStorage('reports', INITIAL_REPORTS),
  saveReport: (report: LostReport) => {
    const reports = StorageService.getReports();
    const existing = reports.findIndex(r => r.id === report.id);
    if (existing >= 0) {
      reports[existing] = report;
    } else {
      setStorage('reports', [report, ...reports]);
      return;
    }
    setStorage('reports', reports);
  },

  // Auth Simulation & Session Management
  login: (matricula: string, pass: string): User | null => {
    const users = StorageService.getUsers();
    const user = users.find(u => u.matricula === matricula && u.password === pass) || null;
    return user;
  },

  // Persist Session
  setSessionUser: (user: User) => {
    setStorage(SESSION_USER_KEY, user);
    StorageService.updateLastActive();
  },

  getSessionUser: (): User | null => {
    const user = localStorage.getItem(SESSION_USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  clearSession: () => {
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(LAST_ACTIVE_KEY);
  },

  updateLastActive: () => {
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  },

  isSessionExpired: (): boolean => {
    const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
    if (!lastActive) return true;
    
    const now = Date.now();
    const last = parseInt(lastActive, 10);
    
    return (now - last) > TIMEOUT_MS;
  }
};