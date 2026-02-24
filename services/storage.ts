import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';
import { Book, BookLoan, BookLoanStatus, FoundItem, ItemStatus, LostReport, Person, PersonType, ReportStatus, User, UserLevel, Campus } from "../types";
import { Locker, LockerStatus, LoanData } from "../types-armarios";
import { Material, MaterialLoan } from "../types-materiais";

// Configuração do Supabase
// NOTA DE SEGURANÇA: Utilize apenas a chave pública (anon key) aqui. Nunca a service_role.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: window.sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

import { DEFAULT_PASSWORD, SESSION_USER_KEY, LAST_ACTIVE_KEY, SYSTEM_CONFIG_KEY, TIMEOUT_MS } from "../constants";

export const StorageService = {
  // Helpers
  hashPassword: async (pass: string): Promise<string> => {
    if (!pass) return '';
    try {
      // Use crypto-js for consistent SHA-256 hashing in all environments (HTTP/HTTPS)
      // This avoids issues where crypto.subtle is undefined in non-secure contexts
      return CryptoJS.SHA256(pass).toString(CryptoJS.enc.Hex).toLowerCase();
    } catch (e) {
      console.error("Erro ao gerar hash (crypto-js):", e);
      return '';
    }
  },


  // Campuses
  getCampuses: async (): Promise<Campus[]> => {
    const { data, error } = await supabase.from('campuses').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  saveCampus: async (campus: Partial<Campus>) => {
    const { error } = await supabase.from('campuses').upsert({
      id: campus.id || undefined,
      name: campus.name,
      slug: campus.slug
    });
    if (error) throw error;
  },

  deleteCampus: async (id: string) => {
    const { error } = await supabase.from('campuses').delete().eq('id', id);
    if (error) throw error;
  },

  getUsers: async (campusId?: string): Promise<User[]> => {
    let allData: User[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      let query = supabase
        .from('users')
        .select('*')
        .range(from, from + limit - 1);

      if (campusId) {
        query = query.eq('campus_id', campusId);
      }

      const { data, error } = await query;

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
        campus_id: user.campus_id,
        permissions: user.permissions,
        password: finalPassword,
        logs: updatedLogs,
        access_logs: user.access_logs || [],
        moduleOrder: user.moduleOrder || []
      }).eq('id', user.id);

      if (error) throw error;
    } else {
      const password = user.password || DEFAULT_PASSWORD;
      const hashedPassword = await StorageService.hashPassword(password);
      const logMessage = `Criado por ${actorName} em ${dateStr} com senha padrão.`;

      // 1. Criar usuário na tabela local
      const { error } = await supabase.from('users').insert({
        id: user.id,
        matricula: user.matricula,
        name: user.name,
        password: hashedPassword,
        level: user.level,
        campus_id: user.campus_id,
        permissions: user.permissions,
        moduleOrder: user.moduleOrder || [],
        logs: [logMessage],
        access_logs: user.access_logs || []
      });

      if (error) throw error;

      // 2. Criar usuário no Supabase Auth para permitir login imediato
      try {
        const email = `${user.matricula}@sistema.local`;
        const { error: authError } = await supabase.auth.signUp({
          email,
          password, // Usa a senha plain text (ifrn123 ou outra)
          options: {
            data: {
              matricula: user.matricula,
              name: user.name
            },
            emailRedirectTo: undefined // Desabilita email de confirmação
          }
        });

        if (authError) {
          console.warn(`[SAVE USER] Aviso ao criar no Auth: ${authError.message}`);
          // Não falha se o Auth der erro - o usuário ainda pode logar pelo fallback local
        } else {
          console.log(`[SAVE USER] Usuário ${user.matricula} criado com sucesso no Auth.`);
        }
      } catch (authEx) {
        console.error(`[SAVE USER] Exceção ao criar no Auth:`, authEx);
        // Continua mesmo se der erro no Auth
      }
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

  deleteAllUsers: async (currentAdminId: string, campusId?: string) => {
    let query = supabase.from('users').delete().neq('id', currentAdminId);
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    await query;
  },

  changePassword: async (userId: string, newPass: string, actorName: string): Promise<User | null> => {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();

    if (user) {
      const dateStr = new Date().toLocaleString('pt-BR');
      const log = `Senha alterada pelo próprio usuário em ${dateStr}.`;
      const updatedLogs = [...(user.logs || []), log];

      const hashedPassword = await StorageService.hashPassword(newPass);

      // 1. Atualizar senha no banco de dados local
      const { data, error } = await supabase
        .from('users')
        .update({ password: hashedPassword, logs: updatedLogs })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('[CHANGE PASSWORD] Erro ao atualizar senha no DB local:', error);
        return null;
      }

      // 2. Atualizar senha no Supabase Auth
      try {
        const { error: authError } = await supabase.auth.updateUser({
          password: newPass
        });

        if (authError) {
          console.warn('[CHANGE PASSWORD] Aviso ao atualizar senha no Auth:', authError.message);
          // Não retorna null aqui - a senha local já foi alterada com sucesso
          // O Auth pode falhar se o usuário não estiver autenticado via Auth ainda
        } else {
          console.log('[CHANGE PASSWORD] Senha atualizada com sucesso no Supabase Auth');
        }
      } catch (authEx) {
        console.error('[CHANGE PASSWORD] Exceção ao atualizar Auth:', authEx);
        // Mesmo se falhar no Auth, mantenha a alteração local
      }

      return data as User;
    }
    return null;
  },

  // People
  getAllPeople: async (campusId?: string): Promise<Person[]> => {
    let allData: Person[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      let query = supabase
        .from('people')
        .select('*')
        .range(from, from + limit - 1);

      if (campusId) {
        query = query.eq('campus_id', campusId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar pessoas:", error);
        break;
      }

      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < limit) break;
      from += limit;
    }

    return allData;
  },

  searchPeople: async (query: string, limit: number = 20, campusId?: string): Promise<Person[]> => {
    if (!query || query.trim().length < 2) return [];

    const searchTerm = query.trim();
    let rpcQuery = supabase
      .rpc('search_people', {
        search_term: searchTerm,
        limit_count: limit
      });

    if (campusId) {
      rpcQuery = rpcQuery.eq('campus_id', campusId);
    }

    const { data, error } = await rpcQuery;

    if (error) {
      console.error("Erro ao pesquisar pessoas (RPC):", error);
      // Fallback para busca simples se o RPC falhar
      let fallbackQuery = supabase
        .from('people')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,matricula.ilike.%${searchTerm}%`)
        .limit(limit);

      if (campusId) {
        fallbackQuery = fallbackQuery.eq('campus_id', campusId);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        console.error("Erro no fallback de pesquisa:", fallbackError);
        return [];
      }
      return fallbackData || [];
    }

    return data || [];
  },

  getPeople: async (): Promise<Person[]> => {
    // Keep it for backward compatibility but return empty if not absolutely needed
    // In most tabs, we should use searchPeople
    console.warn("StorageService.getPeople() is deprecated for performance reasons. Use searchPeople() or getAllPeople() instead.");
    return [];
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
      type: person.type,
      campus_id: person.campus_id
    });

    if (error) throw error;
  },

  deletePerson: async (id: string) => {
    await supabase.from('people').delete().eq('id', id);
  },

  deleteAllPeople: async (campusId?: string) => {
    let query = supabase.from('people').delete().neq('id', '0');
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    await query;
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
  getItems: async (campusId?: string): Promise<FoundItem[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      let query = supabase
        .from('items')
        .select('*')
        .order('id', { ascending: false })
        .range(from, from + limit - 1);

      if (campusId) {
        query = query.eq('campus_id', campusId);
      }

      const { data, error } = await query;

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
      imageUrl: d.image_url,
      campus_id: d.campus_id
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
      image_url: item.imageUrl,
      campus_id: item.campus_id
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

  deleteAllItems: async (campusId?: string) => {
    let query = supabase.from('items').delete().gt('id', -1);
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    await query;
  },

  // Reports
  getReports: async (campusId?: string): Promise<LostReport[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      let query = supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + limit - 1);

      if (campusId) {
        query = query.eq('campus_id', campusId);
      }

      const { data, error } = await query;

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
      history: d.history,
      campus_id: d.campus_id
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
      history: report.history,
      campus_id: report.campus_id
    };
    const { error } = await supabase.from('reports').upsert(payload);
    if (error) throw error;
  },

  deleteReport: async (id: string) => {
    await supabase.from('reports').delete().eq('id', id);
  },

  deleteAllReports: async (campusId?: string) => {
    let query = supabase.from('reports').delete().neq('id', '0');
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    await query;
  },

  // Lockers
  getLockers: async (campusId?: string): Promise<Locker[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      let query = supabase
        .from('lockers')
        .select('*')
        .order('number', { ascending: true })
        .range(from, from + limit - 1);

      if (campusId) {
        query = query.eq('campus_id', campusId);
      }

      const { data, error } = await query;

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
      location: d.location,
      campus_id: d.campus_id
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
      location: l.location,
      campus_id: l.campus_id
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
      current_loan: locker.currentLoan || null,
      maintenance_record: locker.maintenanceRecord || null,
      loan_history: locker.loanHistory,
      maintenance_history: locker.maintenanceHistory,
      location: locker.location,
      campus_id: locker.campus_id
    };
    const { error } = await supabase.from('lockers').update(payload).eq('number', locker.number);
    if (error) throw error;
  },

  clearAllLockerLoans: async (campusId?: string) => {
    let query = supabase.from('lockers').select('*');
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    const { data: lockers, error: fetchError } = await query;
    if (fetchError || !lockers) throw new Error("Erro ao buscar armários para limpeza.");

    if (lockers.length === 0) return;

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
    // 1. Limpeza de input (Trim)
    const cleanMatricula = matricula ? matricula.trim() : '';
    const cleanPass = pass ? pass.trim() : '';
    const email = `${cleanMatricula}@sistema.local`;

    console.log(`[LOGIN] Tentando login oficial para: ${cleanMatricula}`);

    // 2. Login nativo do Supabase Auth
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: cleanPass
      });

      if (!authError && authData.user) {
        console.log("[LOGIN] Sucesso via Supabase Auth.");
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('matricula', cleanMatricula)
          .single();

        if (userData) {
          const dateStr = new Date().toLocaleString('pt-BR');
          const updatedAccessLogs = [dateStr, ...(userData.access_logs || [])].slice(0, 10);

          await supabase.from('users').update({
            access_logs: updatedAccessLogs
          }).eq('id', userData.id);

          return { ...userData, access_logs: updatedAccessLogs } as User;
        }
      } else {
        console.warn("[LOGIN] Credenciais inválidas ou erro no Auth:", authError?.message);

        // 3. Fallback: Verificação direta na tabela 'users' (Legado/Migração)
        console.log(`[LOGIN] Tentando fallback local para: ${cleanMatricula}`);
        const { data: localUser, error: localError } = await supabase
          .from('users')
          .select('*')
          .eq('matricula', cleanMatricula)
          .single();

        if (!localError && localUser) {
          const hashed = await StorageService.hashPassword(cleanPass);
          if (hashed === localUser.password) {
            console.log("[LOGIN] Sucesso via login local (legado). Migrando...");

            // Tenta migrar para o Supabase Auth em segundo plano
            try {
              const { error: signUpError } = await supabase.auth.signUp({
                email,
                password: cleanPass,
                options: {
                  data: {
                    matricula: localUser.matricula,
                    name: localUser.name
                  }
                }
              });

              if (signUpError) {
                console.warn("[LOGIN] Erro na migração Auth:", signUpError.message);
              } else {
                console.log("[LOGIN] Migração automática concluída.");
              }
            } catch (migreEx) {
              console.warn("[LOGIN] Falha silenciosa na migração:", migreEx);
            }

            const dateStr = new Date().toLocaleString('pt-BR');
            const updatedAccessLogs = [dateStr, ...(localUser.access_logs || [])].slice(0, 10);

            await supabase.from('users').update({
              access_logs: updatedAccessLogs
            }).eq('id', localUser.id);

            return { ...localUser, access_logs: updatedAccessLogs } as User;
          } else {
            console.warn("[LOGIN] Senha incorreta no fallback local.");
          }
        }
      }
    } catch (authEx) {
      console.error("[LOGIN] Exceção crítica no Auth:", authEx);
    }

    return null;
  },

  setSessionUser: (user: User) => {
    // Agora o Supabase Auth cuida da persistência, 
    // mas mantemos o cache local para velocidade na UI se necessário.
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  },

  getSessionUser: async (): Promise<User | null> => {
    // 1. Tentar pegar a sessão nativa do Supabase
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      // Extrair matrícula do e-mail sintético
      const matricula = session.user.email?.split('@')[0];
      if (matricula) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('matricula', matricula)
          .single();
        return userData as User;
      }
    }

    // 2. Fallback para o sessionStorage (para transição)
    const cached = sessionStorage.getItem(SESSION_USER_KEY);
    return cached ? JSON.parse(cached) : null;
  },

  clearSession: async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem(SESSION_USER_KEY);
    sessionStorage.removeItem(LAST_ACTIVE_KEY);
    sessionStorage.removeItem('currentSystem');
    sessionStorage.removeItem('activeTab');
  },

  updateLastActive: () => {
    sessionStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  },

  isSessionExpired: async (): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    return !session;
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
    sessionStorage.clear();
  },

  // Books
  getBooks: async (campusId?: string): Promise<Book[]> => {
    let allData: Book[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      let query = supabase
        .from('books')
        .select('*')
        .order('title', { ascending: true })
        .range(from, from + limit - 1);

      if (campusId) {
        query = query.eq('campus_id', campusId);
      }

      const { data, error } = await query;

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
      quantity: book.quantity,
      campus_id: book.campus_id
    });

    if (error) throw error;
  },

  deleteBook: async (id: string) => {
    await supabase.from('books').delete().eq('id', id);
  },

  deleteAllBooks: async (campusId?: string) => {
    let query = supabase.from('books').delete().neq('id', '0');
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    await query;
  },

  // Book Loans
  getBookLoans: async (campusId?: string): Promise<BookLoan[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      let query = supabase
        .from('book_loans')
        .select('*')
        .order('loan_date', { ascending: false })
        .range(from, from + limit - 1);

      if (campusId) {
        query = query.eq('campus_id', campusId);
      }

      const { data, error } = await query;

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
      history: d.history,
      campus_id: d.campus_id
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
      history: loan.history || [],
      campus_id: loan.campus_id
    };
    const { error } = await supabase.from('book_loans').upsert(payload);
    if (error) throw error;
  },

  // Materials
  getMaterials: async (campusId?: string): Promise<Material[]> => {
    let allData: Material[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      let query = supabase
        .from('materials')
        .select('*')
        .order('name', { ascending: true })
        .range(from, from + limit - 1);

      if (campusId) {
        query = query.eq('campus_id', campusId);
      }

      const { data, error } = await query;

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
      createdAt: material.createdAt,
      campus_id: material.campus_id
    });

    if (error) throw error;
  },

  deleteMaterial: async (id: string) => {
    await StorageService.deleteMaterialsBulk([id]);
  },

  deleteMaterialsBulk: async (ids: string[]) => {
    // 1. Marcar empréstimos como DELETED apenas se estiverem ACTIVE (PENDENTES)
    // Se já foi DEVOLVIDO, não deve ser alterado.
    const { data: updatedLoans, error: loanError } = await supabase
      .from('material_loans')
      .update({
        status: 'DELETED',
        returnDate: new Date().toISOString()
      })
      .in('materialId', ids)
      .eq('status', 'ACTIVE')
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

  deleteAllMaterials: async (campusId?: string) => {
    let query = supabase.from('materials').delete().neq('id', '0');
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    await query;
  },

  // Material Loans
  getMaterialLoans: async (campusId?: string): Promise<MaterialLoan[]> => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      let query = supabase
        .from('material_loans')
        .select('*')
        .order('loanDate', { ascending: false })
        .range(from, from + limit - 1);

      if (campusId) {
        query = query.eq('campus_id', campusId);
      }

      const { data, error } = await query;

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
      returnedBy: d.returnedBy,
      campus_id: d.campus_id
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
      returnedBy: loan.returnedBy,
      campus_id: loan.campus_id
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

  returnMaterialLoansBulk: async (loanIds: string[], operatorName: string) => {
    const { error } = await supabase
      .from('material_loans')
      .update({
        status: 'RETURNED',
        returnDate: new Date().toISOString(),
        returnedBy: operatorName
      })
      .in('id', loanIds);

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