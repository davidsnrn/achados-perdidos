import { createClient } from '@supabase/supabase-js';
import { FoundItem, ItemStatus, LostReport, Person, PersonType, ReportStatus, User, UserLevel } from "../types";

// Configuração do Supabase
// NOTA DE SEGURANÇA: Utilize apenas a chave pública (anon key) aqui. Nunca a service_role.
const SUPABASE_URL = 'https://vfcnptykhuljtoykpbmv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jjl3YMTXv7Ly-LwahfI3Yw_5GZD4fpv';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Session constants
const SESSION_USER_KEY = 'coades_session_user';
const LAST_ACTIVE_KEY = 'coades_last_active';
const TIMEOUT_MINUTES = 5;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;

export const StorageService = {
  // System Config
  getConfig: async () => {
    const { data, error } = await supabase.from('config').select('*').limit(1).single();
    if (error || !data) return { sector: 'COADES', campus: 'NOVA CRUZ' };
    return { sector: data.sector, campus: data.campus };
  },

  saveConfig: async (sector: string, campus: string) => {
    // Tenta atualizar o primeiro registro, se não existir, cria
    const { data } = await supabase.from('config').select('id').limit(1);
    
    if (data && data.length > 0) {
      await supabase.from('config').update({ sector, campus }).eq('id', data[0].id);
    } else {
      await supabase.from('config').insert({ sector, campus });
    }
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }
    return data || [];
  },
  
  saveUser: async (user: User, actorName: string) => {
    // Check duplication (exceto o próprio usuário)
    const { data: existing } = await supabase
      .from('users')
      .select('id, name')
      .eq('matricula', user.matricula)
      .neq('id', user.id); // Garante que não é ele mesmo

    if (existing && existing.length > 0) {
      throw new Error(`Erro: A matrícula '${user.matricula}' já está cadastrada para o usuário '${existing[0].name}'.`);
    }

    const dateStr = new Date().toLocaleString('pt-BR');
    
    // Check if updating or creating
    const { data: currentUser } = await supabase.from('users').select('*').eq('id', user.id).single();

    if (currentUser) {
      // Update
      const logMessage = `Editado por ${actorName} em ${dateStr}.`;
      const updatedLogs = [...(currentUser.logs || []), logMessage];
      
      const { error } = await supabase.from('users').update({
        matricula: user.matricula,
        name: user.name,
        level: user.level,
        password: user.password, // Em prod, não atualize senha aqui sem hash
        logs: updatedLogs
      }).eq('id', user.id);
      
      if (error) throw error;
    } else {
      // Create
      const password = user.password || 'ifrn123';
      const logMessage = `Criado por ${actorName} em ${dateStr} com senha padrão.`;
      
      const { error } = await supabase.from('users').insert({
        id: user.id,
        matricula: user.matricula,
        name: user.name,
        password: password,
        level: user.level,
        logs: [logMessage]
      });

      if (error) throw error;
    }
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

      const { data, error } = await supabase
        .from('users')
        .update({ password: newPass, logs: updatedLogs })
        .eq('id', userId)
        .select()
        .single();
        
      if (!error) return data as User;
    }
    return null;
  },
  
  // People
  getPeople: async (): Promise<Person[]> => {
    const { data, error } = await supabase.from('people').select('*');
    if (error) return [];
    return data || [];
  },

  savePerson: async (person: Person) => {
    // Check duplicate matricula
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
    await supabase.from('people').delete().neq('id', '0'); // Delete all (hacky neq check) or allow delete without where
  },

  importPeople: async (people: Person[]) => {
    // Supabase permite insert de array
    // Filtra duplicatas locais antes de enviar ou usa onConflict (mas id é uuid, matricula é unique)
    // Vamos fazer um insert "ignore" based on matricula se possível, ou loop.
    // Para simplificar, vamos inserir um por um ou em batch e ignorar erros de constraint unique
    
    // Buscar matrículas existentes para não tentar inserir
    const { data: existing } = await supabase.from('people').select('matricula');
    const existingMats = new Set(existing?.map(p => p.matricula));
    
    const toInsert = people.filter(p => !existingMats.has(p.matricula)).map(p => ({
       id: p.id,
       matricula: p.matricula,
       name: p.name,
       type: p.type
    }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from('people').insert(toInsert);
      if (error) console.error("Erro import:", error);
    }
  },

  // Items
  getItems: async (): Promise<FoundItem[]> => {
    const { data, error } = await supabase.from('items').select('*').order('id', { ascending: false });
    
    if (error) {
      console.error("Erro ao buscar itens:", error);
      return [];
    }
    
    // Map snake_case to camelCase manually if needed, or rely on TS checks
    // Supabase returns keys as columns in DB. If DB columns are snake_case, we need map.
    // My provided SQL used snake_case for DB columns.
    
    return data.map((d: any) => ({
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
      history: d.history
    }));
  },

  saveItem: async (item: FoundItem, actionDescription?: string, actorName: string = 'Sistema') => {
    try {
      // Se ID for 0, é create
      const isNew = item.id === 0;

      const newHistoryEntry = {
        date: new Date().toISOString(),
        action: actionDescription || (isNew ? 'Item registrado.' : 'Item atualizado.'),
        user: actorName
      };

      let history = [];
      if (!isNew) {
         // Fetch current history
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
        history: history
      };

      let error = null;

      if (isNew) {
        // CORREÇÃO: Deixar o banco gerar o ID automaticamente.
        // Tentar inserir um ID manualmente em uma coluna IDENTITY GENERATED ALWAYS causa erro.
        const res = await supabase.from('items').insert(payload);
        error = res.error;
      } else {
        const res = await supabase.from('items').update(payload).eq('id', item.id);
        error = res.error;
      }

      if (error) {
        throw error;
      }
    } catch (e: any) {
      console.error("Erro completo ao salvar item:", e);
      throw new Error(e.message || "Erro desconhecido ao salvar item.");
    }
  },

  deleteItem: async (id: number) => {
    await supabase.from('items').delete().eq('id', id);
  },

  deleteAllItems: async () => {
    await supabase.from('items').delete().gt('id', -1);
  },
  
  // Reports
  getReports: async (): Promise<LostReport[]> => {
    const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (error) return [];

    return data.map((d: any) => ({
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

  // Auth Simulation (Using custom table, not Gotrue/Supabase Auth to keep logic simple)
  // NOTA: Para total conformidade RLS, migrar para supabase.auth.signInWithPassword()
  login: async (matricula: string, pass: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('matricula', matricula)
      .eq('password', pass) // Note: In production, compare Hash
      .single();

    if (error || !data) return null;
    return data as User;
  },

  // Persist Session (Local Storage for Client Session Persistence Only)
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
     // Warning: This destroys DB data
     await StorageService.deleteAllItems();
     await StorageService.deleteAllReports();
     await StorageService.deleteAllPeople();
     
     // Apaga todos os usuários MENOS o admin que está fazendo o reset
     await StorageService.deleteAllUsers(currentAdminId);
     
     // Limpa o local storage, o que vai deslogar o usuário no front,
     // mas como o usuário ainda existe no banco, ele pode logar novamente com a mesma senha.
     localStorage.clear();
  }
};