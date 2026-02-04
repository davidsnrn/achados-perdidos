import { createClient } from '@supabase/supabase-js';
import { Book, BookLoan, BookLoanStatus, FoundItem, ItemStatus, LostReport, Person, PersonType, ReportStatus, User, UserLevel } from "../types";
import { Locker, LockerStatus } from "../types-armarios";
import { Material, MaterialLoan } from "../types-materiais";

// Configuração do Supabase
// NOTA DE SEGURANÇA: Utilize apenas a chave pública (anon key) aqui. Nunca a service_role.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Session constants
const SESSION_USER_KEY = 'coades_session_user';
const LAST_ACTIVE_KEY = 'coades_last_active';
const TIMEOUT_MINUTES = 60;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;

export const StorageService = {
  // Helpers
  hashPassword: async (pass: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pass);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // System Config
  getConfig: async () => {
    const cached = localStorage.getItem('sga_system_config');
    const defaultVal = { sector: '', campus: '' };

    try {
      const { data, error } = await supabase.from('config').select('*').limit(1).single();
      if (!error && data) {
        const config = { sector: data.sector, campus: data.campus };
        localStorage.setItem('sga_system_config', JSON.stringify(config));
        return config;
      }
    } catch (e) {
      console.warn("DB Config error, using cache/default");
    }

    return cached ? JSON.parse(cached) : defaultVal;
  },

  saveConfig: async (sector: string, campus: string) => {
    localStorage.setItem('sga_system_config', JSON.stringify({ sector, campus }));
    const { data } = await supabase.from('config').select('id').limit(1);

    if (data && data.length > 0) {
      await supabase.from('config').update({ sector, campus }).eq('id', data[0].id);
    } else {
      await supabase.from('config').insert({ sector, campus });
    }
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    let allData: User[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .range(from, from + limit - 1);

      if (error) {
        console.error('Error fetching users:', error);
        break;
      }

      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < limit) break;
      from += limit;
    }
    return allData;
  },

  saveUser: async (user: User, actorName: string) => {
    const { data: existing } = await supabase
      .from('users')
      .select('id, name')
      .eq('matricula', user.matricula)
      .neq('id', user.id);

    if (existing && existing.length > 0) {
      throw new Error(`Erro: A matrícula '${user.matricula}' já está cadastrada para o usuário '${existing[0].name}'.`);
    }

    const dateStr = new Date().toLocaleString('pt-BR');
    const { data: currentUser } = await supabase.from('users').select('*').eq('id', user.id).single();

    if (currentUser) {
      const logMessage = `Editado por ${actorName} em ${dateStr}.`;
      const updatedLogs = [...(currentUser.logs || []), logMessage];

      let finalPassword = currentUser.password;
      if (user.password && user.password !== currentUser.password) {
        finalPassword = await StorageService.hashPassword(user.password);
      }

      const { error } = await supabase.from('users').update({
        matricula: user.matricula,
        name: user.name,
        level: user.level,
        permissions: user.permissions,
        password: finalPassword,
        logs: updatedLogs,
        moduleOrder: user.moduleOrder || []
      }).eq('id', user.id);

      if (error) throw error;
    } else {
      const password = user.password || 'ifrn123';
      const hashedPassword = await StorageService.hashPassword(password);
      const logMessage = `Criado por ${actorName} em ${dateStr} com senha padrão.`;

      const { error } = await supabase.from('users').insert({
        id: user.id,
        matricula: user.matricula,
        name: user.name,
        password: hashedPassword,
        level: user.level,
        permissions: user.permissions,
        moduleOrder: user.moduleOrder || [],
        logs: [logMessage]
      });

      if (error) throw error;
    }
  },

  updateModuleOrder: async (userId: string, order: string[]) => {
    const { error } = await supabase
      .from('users')
      .update({ moduleOrder: order })
      .eq('id', userId);
    if (error) throw error;
  },

  deleteUser: async (id: string) => {
    await supabase.from('users').delete().eq('id', id);
  },

  deleteAllUsers: async (currentAdminId: string) => {
    await supabase.from('users').delete().neq('id', currentAdminId);
  },

  changePassword: async (userId: string, newPass: string, actorName: string): Promise<User | null> => {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();

    if (user) {
      const dateStr = new Date().toLocaleString('pt-BR');
      const log = `Senha alterada pelo próprio usuário em ${dateStr}.`;
      const updatedLogs = [...(user.logs || []), log];

      const hashedPassword = await StorageService.hashPassword(newPass);

      const { data, error } = await supabase
        .from('users')
        .update({ password: hashedPassword, logs: updatedLogs })
        .eq('id', userId)
        .select()
        .single();

      if (!error) return data as User;
    }
    return null;
  },

  // People
  getPeople: async (): Promise<Person[]> => {
    let allData: Person[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .range(from, from + limit - 1);

      if (error) break;
      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < limit) break;
      from += limit;
    }
    return allData;
  },

  savePerson: async (person: Person) => {
    const { data: existing } = await supabase
      .from('people')
      .select('id')
      .eq('matricula', person.matricula)
      .neq('id', person.id);

    if (existing && existing.length > 0) {
      throw new Error("Matrícula já cadastrada para outra pessoa.");
    }

    const { error } = await supabase.from('people').upsert({
      id: person.id,
      matricula: person.matricula,
      name: person.name,
      type: person.type
    });

    if (error) throw error;
  },

  deletePerson: async (id: string) => {
    await supabase.from('people').delete().eq('id', id);
  },

  deleteAllPeople: async () => {
    await supabase.from('people').delete().neq('id', '0');
  },

  importPeople: async (people: Person[]) => {
    const { data: existing } = await supabase.from('people').select('matricula');
    const existingMats = new Set(existing?.map(p => p.matricula));

    const toInsert = people.filter(p => !existingMats.has(p.matricula)).map(p => ({
      id: p.id,
      matricula: p.matricula,
      name: p.name,
      type: p.type
    }));

    if (toInsert.length > 0) {
      const BATCH_SIZE = 1000;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('people').insert(batch);
        if (error) {
          console.error("Erro import batch:", error);
          throw error;
        }
      }
    }
  },

  // Items
  getItems: async (): Promise<FoundItem[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('id', { ascending: false })
        .range(from, from + limit - 1);

      if (error) {
        console.error("Erro ao buscar itens:", error);
        break;
      }

      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < limit) break;
      from += limit;
    }

    return allData.map((d: any) => ({
      id: d.id,
      description: d.description,
      detailedDescription: d.detailed_description,
      locationFound: d.location_found,
      locationStored: d.location_stored,
      dateFound: d.date_found,
      dateRegistered: d.date_registered,
      status: d.status as ItemStatus,
      returnedTo: d.returned_to,
      returnedDate: d.returned_date,
      history: d.history,
      imageUrl: d.image_url
    }));
  },

  saveItem: async (item: FoundItem, actionDescription?: string, actorName: string = 'Sistema') => {
    const isNew = item.id === 0;
    const newHistoryEntry = {
      date: new Date().toISOString(),
      action: actionDescription || (isNew ? 'Item registrado.' : 'Item atualizado.'),
      user: actorName
    };

    let history = [];
    if (!isNew) {
      const { data } = await supabase.from('items').select('history').eq('id', item.id).single();
      history = data?.history || [];
    }
    history.push(newHistoryEntry);

    const payload = {
      description: item.description,
      detailed_description: item.detailedDescription,
      location_found: item.locationFound,
      location_stored: item.locationStored,
      date_found: item.dateFound,
      date_registered: item.dateRegistered,
      status: item.status,
      returned_to: item.returnedTo,
      returned_date: item.returnedDate,
      history: history,
      image_url: item.imageUrl
    };

    let error = null;
    if (isNew) {
      const res = await supabase.from('items').insert(payload);
      error = res.error;
    } else {
      const res = await supabase.from('items').update(payload).eq('id', item.id);
      error = res.error;
    }
    if (error) throw error;
  },

  uploadItemImage: async (file: Blob): Promise<string> => {
    const fileExt = 'jpg';
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('found-items')
      .upload(filePath, file, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('found-items')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  deleteItemImage: async (imageUrl: string) => {
    try {
      // Extrair o nome do arquivo da URL pública
      // A URL é algo como: https://[project].supabase.co/storage/v1/object/public/found-items/filename.jpg
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];

      if (fileName) {
        const { error } = await supabase.storage
          .from('found-items')
          .remove([fileName]);

        if (error) console.warn("Erro ao deletar imagem do storage:", error);
      }
    } catch (e) {
      console.error("Erro ao processar exclusão de imagem:", e);
    }
  },

  deleteItem: async (id: number) => {
    await supabase.from('items').delete().eq('id', id);
  },

  deleteAllItems: async () => {
    const { error } = await supabase.rpc('admin_clear_items_only');
    if (error) {
      await supabase.from('items').delete().gt('id', -1);
    }
  },

  // Reports
  getReports: async (): Promise<LostReport[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + limit - 1);

      if (error) break;

      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < limit) break;
      from += limit;
    }

    return allData.map((d: any) => ({
      id: d.id,
      itemDescription: d.item_description,
      personId: d.person_id,
      personName: d.person_name,
      whatsapp: d.whatsapp,
      email: d.email,
      status: d.status as ReportStatus,
      createdAt: d.created_at,
      history: d.history
    }));
  },

  saveReport: async (report: LostReport) => {
    const payload = {
      id: report.id,
      item_description: report.itemDescription,
      person_id: report.personId,
      person_name: report.personName,
      whatsapp: report.whatsapp,
      email: report.email,
      status: report.status,
      created_at: report.createdAt,
      history: report.history
    };
    const { error } = await supabase.from('reports').upsert(payload);
    if (error) throw error;
  },

  deleteReport: async (id: string) => {
    await supabase.from('reports').delete().eq('id', id);
  },

  deleteAllReports: async () => {
    await supabase.from('reports').delete().neq('id', '0');
  },

  // Lockers
  getLockers: async (): Promise<Locker[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('lockers')
        .select('*')
        .order('number', { ascending: true })
        .range(from, from + limit - 1);

      if (error) break;

      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < limit) break;
      from += limit;
    }

    return allData.map((d: any) => ({
      number: d.number,
      status: d.status as LockerStatus,
      currentLoan: d.current_loan,
      maintenanceRecord: d.maintenance_record,
      loanHistory: d.loan_history || [],
      maintenanceHistory: d.maintenance_history || [],
      location: d.location
    }));
  },

  saveLockers: async (lockers: Locker[]) => {
    const payload = lockers.map(l => ({
      number: l.number,
      status: l.status,
      current_loan: l.currentLoan || null,
      maintenance_record: l.maintenanceRecord || null,
      loan_history: l.loanHistory || [],
      maintenance_history: l.maintenanceHistory || [],
      location: l.location
    }));

    const BATCH_SIZE = 50;
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('lockers').upsert(batch);
      if (error) throw error;
    }
  },

  updateSingleLocker: async (locker: Locker) => {
    const payload = {
      status: locker.status,
      current_loan: locker.currentLoan,
      maintenance_record: locker.maintenanceRecord,
      loan_history: locker.loanHistory,
      maintenance_history: locker.maintenanceHistory,
      location: locker.location
    };
    const { error } = await supabase.from('lockers').update(payload).eq('number', locker.number);
    if (error) throw error;
  },

  clearAllLockerLoans: async () => {
    const { data: lockers, error: fetchError } = await supabase.from('lockers').select('*');
    if (fetchError || !lockers) throw new Error("Erro ao buscar armários para limpeza.");

    const updated = lockers.map(l => ({
      ...l,
      status: LockerStatus.AVAILABLE,
      current_loan: null,
      loan_history: []
    }));

    const { error: upsertError } = await supabase.from('lockers').upsert(updated);
    if (upsertError) throw upsertError;
  },

  login: async (matricula: string, pass: string): Promise<User | null> => {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('matricula', matricula)
      .single();

    if (error || !user) return null;

    const hashedFn = await StorageService.hashPassword(pass);

    if (user.password === hashedFn) {
      // Registrar acesso
      const dateStr = new Date().toLocaleString('pt-BR');
      const accessLog = `Acesso em ${dateStr}.`;
      const updatedLogs = [...(user.logs || []), accessLog];

      await supabase.from('users').update({ logs: updatedLogs }).eq('id', user.id);
      user.logs = updatedLogs;

      return user as User;
    } else if (user.password === pass) {
      await supabase.from('users').update({ password: hashedFn }).eq('id', user.id);
      user.password = hashedFn;

      // Registrar acesso (também no caso de migração de senha)
      const dateStr = new Date().toLocaleString('pt-BR');
      const accessLog = `Acesso em ${dateStr}.`;
      const updatedLogs = [...(user.logs || []), accessLog];

      await supabase.from('users').update({ logs: updatedLogs }).eq('id', user.id);
      user.logs = updatedLogs;

      return user as User;
    }

    return null;
  },

  setSessionUser: (user: User) => {
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
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
  },

  factoryReset: async (currentAdminId: string) => {
    const { error } = await supabase.rpc('admin_reset_db');
    if (error) {
      await StorageService.deleteAllItems();
      await StorageService.deleteAllReports();
      await StorageService.deleteAllPeople();
    }
    await StorageService.deleteAllUsers(currentAdminId);
    localStorage.clear();
  },

  // Books
  getBooks: async (): Promise<Book[]> => {
    let allData: Book[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('title', { ascending: true })
        .range(from, from + limit - 1);

      if (error) break;
      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < limit) break;
      from += limit;
    }
    return allData;
  },

  saveBook: async (book: Book) => {
    const { error } = await supabase.from('books').upsert({
      id: book.id,
      edition: book.edition,
      code: book.code,
      area: book.area,
      title: book.title,
      series: book.series,
      publisher: book.publisher,
      quantity: book.quantity
    });

    if (error) throw error;
  },

  deleteBook: async (id: string) => {
    await supabase.from('books').delete().eq('id', id);
  },

  // Book Loans
  getBookLoans: async (): Promise<BookLoan[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('book_loans')
        .select('*')
        .order('loan_date', { ascending: false })
        .range(from, from + limit - 1);

      if (error) break;
      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < limit) break;
      from += limit;
    }

    return allData.map((d: any) => ({
      id: d.id,
      personId: d.person_id,
      personName: d.person_name,
      books: d.books,
      loanedBy: d.loaned_by,
      loanDate: d.loan_date,
      status: d.status as BookLoanStatus,
      returnDate: d.return_date,
      observation: d.observation,
      history: d.history
    }));
  },

  saveBookLoan: async (loan: BookLoan) => {
    const payload = {
      id: loan.id,
      person_id: loan.personId,
      person_name: loan.personName,
      books: loan.books,
      loaned_by: loan.loanedBy,
      loan_date: loan.loanDate,
      status: loan.status,
      return_date: loan.returnDate,
      observation: loan.observation,
      history: loan.history || []
    };
    const { error } = await supabase.from('book_loans').upsert(payload);
    if (error) throw error;
  },

  // Materials
  getMaterials: async (): Promise<Material[]> => {
    let allData: Material[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('name', { ascending: true })
        .range(from, from + limit - 1);

      if (error) break;
      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < limit) break;
      from += limit;
    }
    return allData;
  },

  saveMaterial: async (material: Material) => {
    const { error } = await supabase.from('materials').upsert({
      id: material.id,
      code: material.code,
      name: material.name,
      createdAt: material.createdAt
    });

    if (error) throw error;
  },

  deleteMaterialsBulk: async (ids: string[]) => {
    // 1. Marcar empréstimos como DELETED
    const { data: updatedLoans, error: loanError } = await supabase
      .from('material_loans')
      .update({
        status: 'DELETED',
        returnDate: new Date().toISOString()
      })
      .in('materialId', ids)
      .select();

    if (loanError) {
      console.error('Erro ao atualizar empréstimos:', loanError);
      throw new Error(`Erro ao atualizar empréstimos: ${loanError.message}`);
    }

    if (updatedLoans) {
      console.log(`${updatedLoans.length} registros de empréstimo marcados como DELETADOS.`);
    }

    // 2. Deletar os materiais
    const { error } = await supabase.from('materials').delete().in('id', ids);
    if (error) throw error;
  },

  // Material Loans
  getMaterialLoans: async (): Promise<MaterialLoan[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('material_loans')
        .select('*')
        .order('loanDate', { ascending: false })
        .range(from, from + limit - 1);

      if (error) break;
      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < limit) break;
      from += limit;
    }

    return allData.map((d: any) => ({
      id: d.id,
      materialId: d.materialId,
      materialName: d.materialName,
      materialCode: d.materialCode,
      personId: d.personId,
      personName: d.personName,
      personMatricula: d.personMatricula,
      loanDate: d.loanDate,
      returnDate: d.returnDate,
      observation: d.observation,
      status: d.status,
      loanedBy: d.loanedBy,
      returnedBy: d.returnedBy
    }));
  },

  saveMaterialLoan: async (loan: MaterialLoan) => {
    const payload = {
      id: loan.id,
      materialId: loan.materialId,
      materialName: loan.materialName,
      materialCode: loan.materialCode,
      personId: loan.personId,
      personName: loan.personName,
      personMatricula: loan.personMatricula,
      loanDate: loan.loanDate,
      returnDate: loan.returnDate,
      observation: loan.observation,
      status: loan.status,
      loanedBy: loan.loanedBy,
      returnedBy: loan.returnedBy
    };
    const { error } = await supabase.from('material_loans').upsert(payload);
    if (error) throw error;
  },

  returnMaterialLoan: async (loanId: string, operatorName: string) => {
    // Update loan status and return operator
    const { error } = await supabase
      .from('material_loans')
      .update({
        status: 'RETURNED',
        returnDate: new Date().toISOString(),
        returnedBy: operatorName
      })
      .eq('id', loanId);

    if (error) throw error;
  },

  getBackupData: async () => {
    const [config, users, people, items, reports, lockers, books, loans] = await Promise.all([
      supabase.from('config').select('*'),
      supabase.from('users').select('*'),
      supabase.from('people').select('*'),
      supabase.from('items').select('*'),
      supabase.from('reports').select('*'),
      supabase.from('lockers').select('*'),
      supabase.from('books').select('*'),
      supabase.from('book_loans').select('*')
    ]);

    return {
      config: config.data || [],
      users: users.data || [],
      people: people.data || [],
      items: items.data || [],
      reports: reports.data || [],
      lockers: lockers.data || [],
      books: books.data || [],
      loans: loans.data || [],
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }
};