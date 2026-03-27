import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';
import { Book, BookLoan, BookLoanStatus, FoundItem, ItemStatus, LostReport, Person, PersonType, ReportStatus, User, UserLevel, Campus, CopyConfig, CopyRecord, Supply, SupplyRecord } from "../types";
import { Locker, LockerStatus, LoanData, LockerSchedule, LockerScheduleStatus } from "../types-armarios";
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

      // 2. Criar usuário no Supabase Auth via Edge Function para evitar troca de sessão
      try {
        const { error: funcError } = await supabase.functions.invoke('create-user', {
          body: {
            matricula: user.matricula,
            name: user.name,
            password: password
          }
        });

        if (funcError) {
          console.warn(`[SAVE USER] Aviso ao criar no Auth via Edge Function: ${funcError.message}`);
          // Não falha o processo total se o Auth der erro, permitindo fallback local
        } else {
          console.log(`[SAVE USER] Usuário ${user.matricula} criado com sucesso no Auth via Edge Function.`);
        }
      } catch (authEx) {
        console.error(`[SAVE USER] Exceção ao criar no Auth via Edge Function:`, authEx);
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
        .select('id, name, matricula, campus_id, type')
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

  getPeoplePaginated: async (
    page: number = 1,
    limit: number = 50,
    campusId?: string,
    type?: string,
    search?: string
  ): Promise<Person[]> => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('people')
      .select('name, matricula, campus_id, type')
      .range(from, to)
      .order('name', { ascending: true });

    if (campusId) {
      query = query.eq('campus_id', campusId);
    }

    if (type && type !== 'ALL') {
      query = query.eq('type', type);
    }

    if (search && search.trim().length >= 2) {
      const tokens = search.trim().split(/\s+/).filter(t => t.length > 0);
      tokens.forEach(t => {
        if (/^\d{6,}$/.test(t)) {
          query = query.or(`matricula.eq.${t},name.ilike.%${t}%,matricula.ilike.%${t}%`);
        } else {
          query = query.or(`name.ilike.%${t}%,matricula.ilike.%${t}%`);
        }
      });
    }

    const { data, error } = await query;
    if (error) {
      console.error("Erro getPeoplePaginated:", error);
      return [];
    }
    return data || [];
  },

  getPeopleCount: async (campusId?: string, type?: string, search?: string): Promise<number> => {
    let query = supabase
      .from('people')
      .select('*', { count: 'exact', head: true });

    if (campusId) {
      query = query.eq('campus_id', campusId);
    }

    if (type && type !== 'ALL') {
      query = query.eq('type', type);
    }

    if (search && search.trim().length >= 2) {
      const tokens = search.trim().split(/\s+/).filter(t => t.length > 0);
      tokens.forEach(t => {
        if (/^\d{6,}$/.test(t)) {
          query = query.or(`matricula.eq.${t},name.ilike.%${t}%,matricula.ilike.%${t}%`);
        } else {
          query = query.or(`name.ilike.%${t}%,matricula.ilike.%${t}%`);
        }
      });
    }

    const { count, error } = await query;
    if (error) {
      console.error("Erro getPeopleCount:", error);
      return 0;
    }
    return count || 0;
  },

  searchPeople: async (query: string, limit: number = 20, campusId?: string, type?: string): Promise<Person[]> => {
    if (!query || query.trim().length < 2) return [];

    const searchTerm = query.trim();
    const tokens = searchTerm.split(/\s+/).filter(t => t.length > 0);

    let supabaseQuery = supabase
      .from('people')
      .select('name, matricula, campus_id, type');

    if (tokens.length > 0) {
      tokens.forEach(t => {
        if (/^\d{6,}$/.test(t)) {
          supabaseQuery = supabaseQuery.or(`matricula.eq.${t},name.ilike.%${t}%,matricula.ilike.%${t}%`);
        } else {
          supabaseQuery = supabaseQuery.or(`name.ilike.%${t}%,matricula.ilike.%${t}%`);
        }
      });
    }

    if (campusId) {
      supabaseQuery = supabaseQuery.eq('campus_id', campusId);
    }

    if (type && type !== 'ALL') {
      supabaseQuery = supabaseQuery.eq('type', type);
    }

    const { data, error } = await supabaseQuery
      .limit(limit)
      .order('name', { ascending: true });

    if (error) {
      console.error("Erro ao pesquisar pessoas:", error);
      return [];
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
    const { error } = await supabase.from('people').upsert({
      matricula: person.matricula,
      name: person.name,
      type: person.type,
      campus_id: person.campus_id
    }, { onConflict: 'matricula' });

    if (error) throw error;
  },

  deletePerson: async (matricula: string) => {
    const { error } = await supabase.from('people').delete().eq('matricula', matricula);
    if (error) throw error;
  },

  deleteAllPeople: async (campusIds?: string[] | string) => {
    // 2. Deletar as pessoas
    let query = supabase.from('people').delete().neq('matricula', 'PLACEHOLDER_QUE_NUNCA_EXISTE');

    if (Array.isArray(campusIds)) {
      if (campusIds.length > 0) {
        query = query.in('campus_id', campusIds);
      }
    } else if (typeof campusIds === 'string' && campusIds.length > 0) {
      query = query.eq('campus_id', campusIds);
    }

    const { error } = await query;
    if (error) throw error;
  },

  importPeople: async (people: Person[]) => {
    const toUpsert = people.map(p => ({
      matricula: p.matricula,
      name: p.name,
      type: p.type,
      campus_id: p.campus_id
    }));

    if (toUpsert.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
        const batch = toUpsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('people').upsert(batch, {
          onConflict: 'matricula',
          ignoreDuplicates: true
        });
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
      campusItemId: d.campus_item_id,
      description: d.description,
      detailedDescription: d.detailed_description,
      locationFound: d.location_found,
      locationStored: d.location_stored,
      dateFound: d.date_found,
      dateRegistered: d.date_registered,
      status: d.status as ItemStatus,
      returnedTo: d.returned_to,
      returnedDate: d.returned_date,
      discardType: d.discard_type,
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

    // For new items, get a campus-scoped sequential ID
    let campusItemId = item.campusItemId;
    if (isNew && item.campus_id) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_next_campus_item_id', {
        p_campus_id: item.campus_id
      });
      if (!rpcError && rpcData) {
        campusItemId = rpcData as number;
      }
    }

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
      discard_type: item.discardType || null,
      history: history,
      image_url: item.imageUrl,
      campus_id: item.campus_id,
      ...(campusItemId !== undefined ? { campus_item_id: campusItemId } : {})
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
      personMatricula: d.person_matricula,
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
      person_matricula: report.personMatricula,
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

    let query = supabase.from('lockers').update(payload).eq('number', locker.number);
    if (locker.campus_id) {
      query = query.eq('campus_id', locker.campus_id);
    }

    const { error } = await query;
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

  deleteEmptyLockers: async (campusId?: string) => {
    let query = supabase.from('lockers').delete().eq('status', LockerStatus.AVAILABLE);
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    const { error } = await query;
    if (error) throw error;
  },

  // Locker Schedules
  getLockerSchedules: async (campusId?: string): Promise<LockerSchedule[]> => {
    let query = supabase.from('locker_schedules').select('*').order('scheduled_at', { ascending: false });
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: d.id,
      lockerNumber: d.locker_number,
      lockerLocation: d.locker_location || '',
      campusId: d.campus_id,
      studentName: d.student_name,
      registrationNumber: d.registration_number,
      studentClass: d.student_class || '',
      scheduledBy: d.scheduled_by,
      scheduledAt: d.scheduled_at,
      observation: d.observation,
      status: d.status as LockerScheduleStatus,
      completedBy: d.completed_by,
      completedAt: d.completed_at
    }));
  },

  saveLockerSchedule: async (schedule: Omit<LockerSchedule, 'id'> & { id?: string }): Promise<LockerSchedule> => {
    const payload: any = {
      locker_number: schedule.lockerNumber,
      locker_location: schedule.lockerLocation,
      campus_id: schedule.campusId,
      student_name: schedule.studentName,
      registration_number: schedule.registrationNumber,
      student_class: schedule.studentClass,
      scheduled_by: schedule.scheduledBy,
      scheduled_at: schedule.scheduledAt,
      observation: schedule.observation || null,
      status: schedule.status,
      completed_by: schedule.completedBy || null,
      completed_at: schedule.completedAt || null,
      updated_at: new Date().toISOString()
    };
    if (schedule.id) payload.id = schedule.id;

    const { data, error } = await supabase.from('locker_schedules').upsert(payload).select().single();
    if (error) throw error;
    return {
      id: data.id,
      lockerNumber: data.locker_number,
      lockerLocation: data.locker_location || '',
      campusId: data.campus_id,
      studentName: data.student_name,
      registrationNumber: data.registration_number,
      studentClass: data.student_class || '',
      scheduledBy: data.scheduled_by,
      scheduledAt: data.scheduled_at,
      observation: data.observation,
      status: data.status as LockerScheduleStatus,
      completedBy: data.completed_by,
      completedAt: data.completed_at
    };
  },

  updateLockerScheduleStatus: async (id: string, status: LockerScheduleStatus, completedBy?: string) => {
    const payload: any = { status, updated_at: new Date().toISOString() };
    if (status === LockerScheduleStatus.COMPLETED && completedBy) {
      payload.completed_by = completedBy;
      payload.completed_at = new Date().toISOString();
    }
    const { error } = await supabase.from('locker_schedules').update(payload).eq('id', id);
    if (error) throw error;
  },

  deleteLockerSchedule: async (id: string) => {
    const { error } = await supabase.from('locker_schedules').delete().eq('id', id);
    if (error) throw error;
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

      if (error) {
        console.error("Erro getBookLoans:", error);
        break;
      }
      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < limit) break;
      from += limit;
    }

    // Manual join to get PersonType
    const matriculasIdList = Array.from(new Set(allData.map(d => d.person_matricula).filter(Boolean)));
    const peopleMap: Record<string, string> = {};
    if (matriculasIdList.length > 0) {
      const { data: pData } = await supabase.from('people').select('matricula, type').in('matricula', matriculasIdList);
      if (pData) {
        pData.forEach(p => peopleMap[p.matricula] = p.type);
      }
    }

    return allData.map((d: any) => ({
      id: d.id,
      personName: d.person_name,
      personMatricula: d.person_matricula,
      personType: peopleMap[d.person_matricula] as PersonType,
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
      person_name: loan.personName,
      person_matricula: loan.personMatricula,
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

  saveMaterialsBulk: async (materials: Material[]) => {
    const { error } = await supabase.from('materials').insert(materials.map(m => ({
      id: m.id,
      code: m.code,
      name: m.name,
      createdAt: m.createdAt,
      campus_id: m.campus_id
    })));
    if (error) throw error;
  },

  getMaxMaterialCode: async (prefix?: string): Promise<string | null> => {
    let query = supabase
      .from('materials')
      .select('code')
      .order('code', { ascending: false })
      .limit(1);

    if (prefix) {
      query = query.like('code', `${prefix}%`);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) return null;
    return data[0].code;
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
    const [config, users, people, items, reports, lockers, books, loans, copyRecords, copyConfigs] = await Promise.all([
      supabase.from('config').select('*'),
      supabase.from('users').select('*'),
      supabase.from('people').select('*'),
      supabase.from('items').select('*'),
      supabase.from('reports').select('*'),
      supabase.from('lockers').select('*'),
      supabase.from('books').select('*'),
      supabase.from('book_loans').select('*'),
      supabase.from('copy_records').select('*'),
      supabase.from('copy_configs').select('*')
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
      copyRecords: copyRecords.data || [],
      copyConfigs: copyConfigs.data || [],
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  },

  // Copy Control
  getCopyConfig: async (campusId: string): Promise<CopyConfig | null> => {
    const { data, error } = await supabase
      .from('copy_configs')
      .select('*')
      .eq('campus_id', campusId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar config de cópias:", error);
      return null;
    }
    return data;
  },

  saveCopyConfig: async (config: CopyConfig) => {
    const { error } = await supabase
      .from('copy_configs')
      .upsert({
        campus_id: config.campus_id,
        start_day: config.start_day,
        end_day: config.end_day,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
  },

  getCopyRecords: async (campusId: string, startDate?: string, endDate?: string): Promise<CopyRecord[]> => {
    let query = supabase
      .from('copy_records')
      .select('*')
      .eq('campus_id', campusId)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: records, error } = await query;
    if (error) {
      console.error("Erro ao buscar registros de cópias:", error);
      return [];
    }

    // Manual join to get PersonType
    const matriculasIdList = Array.from(new Set((records || []).map(r => r.person_matricula).filter(Boolean)));
    const peopleMap: Record<string, string> = {};
    if (matriculasIdList.length > 0) {
      const { data: pData } = await supabase.from('people').select('matricula, type').in('matricula', matriculasIdList);
      if (pData) {
        pData.forEach(p => peopleMap[p.matricula] = p.type);
      }
    }

    return (records || []).map((record: any) => ({
      ...record,
      person_type: peopleMap[record.person_matricula]
    }));
  },

  saveCopyRecord: async (record: Partial<CopyRecord>) => {
    const payload = {
      id: record.id || undefined,
      campus_id: record.campus_id,
      person_name: record.person_name,
      person_matricula: record.person_matricula,
      sector: record.sector,
      print_type: record.print_type,
      quantity: record.quantity,
      date: record.date || new Date().toISOString(),
      operator_id: record.operator_id
    };

    const { error } = await supabase.from('copy_records').upsert(payload);
    if (error) throw error;
  },

  deleteCopyRecord: async (id: string) => {
    const { error } = await supabase.from('copy_records').delete().eq('id', id);
    if (error) throw error;
  },

  checkPersonAndPendencies: async (matricula: string, campusId?: string) => {
    // 1. Check if person exists in the 'people' table
    const { data: person } = await supabase
      .from('people')
      .select('*, campuses(name)')
      .eq('matricula', matricula)
      .maybeSingle();

    // 2. Check for active book loans
    let bookLoansQuery = supabase
      .from('book_loans')
      .select('*')
      .eq('status', 'ACTIVE');
    
    if (person) {
      bookLoansQuery = bookLoansQuery.eq('person_matricula', matricula);
    } else {
      bookLoansQuery = bookLoansQuery.eq('person_matricula', matricula);
    }
    const { data: bookLoans } = await bookLoansQuery;

    // 3. Check for active material loans
    let materialLoansQuery = supabase
      .from('material_loans')
      .select('*')
      .eq('status', 'ACTIVE');
    
    if (person) {
      materialLoansQuery = materialLoansQuery.eq('personMatricula', matricula);
    } else {
      materialLoansQuery = materialLoansQuery.eq('personMatricula', matricula);
    }
    const { data: materialLoans } = await materialLoansQuery;

    // 4. Check for active locker loans (JSON field)
    let lockersQuery = supabase.from('lockers').select('*').not('current_loan', 'is', null);
    if (campusId) lockersQuery = lockersQuery.eq('campus_id', campusId);
    const { data: lockerData } = await lockersQuery;
    const activeLockerLoans = (lockerData || []).filter(l => l.current_loan?.registrationNumber === matricula);

    return {
      person,
      bookLoans: bookLoans || [],
      materialLoans: materialLoans || [],
      lockerLoans: activeLockerLoans.map(l => ({ ...l.current_loan, lockerNumber: l.number })),
      hasPendencies: (bookLoans?.length || 0) > 0 || (materialLoans?.length || 0) > 0 || activeLockerLoans.length > 0
    };
  },

  // Supply Distribution Methods
  getSupplies: async (campusId?: string): Promise<Supply[]> => {
    let query = supabase.from('supplies').select('*').order('name', { ascending: true });
    if (campusId) query = query.eq('campus_id', campusId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  saveSupply: async (supply: Partial<Supply>) => {
    const payload = {
      id: supply.id || undefined,
      campus_id: supply.campus_id,
      name: supply.name,
      quantity: supply.quantity || 0,
      unit: supply.unit,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('supplies').upsert(payload);
    if (error) throw error;
  },

  deleteSupply: async (id: string) => {
    const { error } = await supabase.from('supplies').delete().eq('id', id);
    if (error) throw error;
  },

  getSupplyRecords: async (campusId?: string, startDate?: string, endDate?: string): Promise<SupplyRecord[]> => {
    let query = supabase.from('supply_records').select('*').order('date', { ascending: false });
    if (campusId) query = query.eq('campus_id', campusId);
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  saveSupplyRecord: async (record: Partial<SupplyRecord>) => {
    // 1. Get current supply to check quantity
    const { data: supply, error: sError } = await supabase
      .from('supplies')
      .select('quantity')
      .eq('id', record.item_id)
      .single();

    if (sError) throw sError;
    if (!supply) throw new Error("Insumo não encontrado.");
    
    const newQuantity = supply.quantity - (record.quantity || 0);
    if (newQuantity < 0) {
      throw new Error(`Estoque insuficiente. Disponível: ${supply.quantity}`);
    }

    // 2. Insert record
    const payload = {
      id: record.id || undefined,
      campus_id: record.campus_id,
      person_name: record.person_name,
      person_matricula: record.person_matricula,
      sector: record.sector,
      item_id: record.item_id,
      quantity: record.quantity,
      date: record.date || new Date().toISOString(),
      operator_id: record.operator_id
    };

    const { error: rError } = await supabase.from('supply_records').insert(payload);
    if (rError) throw rError;

    // 3. Update supply quantity
    const { error: uError } = await supabase
      .from('supplies')
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq('id', record.item_id);

    if (uError) throw uError;
  },

  deleteSupplyRecord: async (id: string, restoreStock: boolean = false) => {
    if (restoreStock) {
      const { data: record } = await supabase.from('supply_records').select('*').eq('id', id).single();
      if (record) {
        const { data: supply } = await supabase.from('supplies').select('quantity').eq('id', record.item_id).single();
        if (supply) {
          await supabase.from('supplies')
            .update({ quantity: supply.quantity + record.quantity, updated_at: new Date().toISOString() })
            .eq('id', record.item_id);
        }
      }
    }
    const { error } = await supabase.from('supply_records').delete().eq('id', id);
    if (error) throw error;
  }
};