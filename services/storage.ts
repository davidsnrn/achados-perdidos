import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';
import { Book, BookLoan, BookLoanStatus, FoundItem, ItemHistory, ItemStatus, LostReport, Person, PersonType, ReportStatus, User, UserLevel, Campus, CopyConfig, CopyRecord, Supply, SupplyRecord, SupplyRestock, StudentNotification, NotificationType, TeacherSchedule, TeacherAttendance, TeacherClass, TeacherPlannedAbsence, TeacherReposicao, Setor } from "../types";
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

  getSetores: async (campusId?: string): Promise<Setor[]> => {
    let query = supabase.from('setores').select('*').order('name', { ascending: true });
    if (campusId) query = query.eq('campus_id', campusId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  saveSetor: async (setor: Partial<Setor>) => {
    const { error } = await supabase.from('setores').upsert({
      id: setor.id || undefined,
      campus_id: setor.campus_id,
      name: setor.name,
      slug: setor.slug
    });
    if (error) throw error;
  },

  deleteSetor: async (id: string) => {
    const { error } = await supabase.from('setores').delete().eq('id', id);
    if (error) throw error;
  },

  nullifySetorPeople: async (setorId: string) => {
    const { error } = await supabase.from('people').update({ setor_id: null }).eq('setor_id', setorId);
    if (error) throw error;
  },

  getMovePreview: async (fromSetorId: string): Promise<{ table: string; count: number; label: string }[]> => {
    const tables: { table: string; label: string; pk: string }[] = [
      { table: 'lockers', label: 'Armários', pk: 'number' },
      { table: 'items', label: 'Achados - Itens', pk: 'id' },
      { table: 'reports', label: 'Achados - Relatos', pk: 'id' },
      { table: 'locker_schedules', label: 'Agendamentos de Armários', pk: 'id' },
      { table: 'books', label: 'Livros', pk: 'id' },
      { table: 'book_loans', label: 'Empréstimos de Livros', pk: 'id' },
      { table: 'materials', label: 'Materiais', pk: 'id' },
      { table: 'material_loans', label: 'Empréstimos de Materiais', pk: 'id' },
      { table: 'copy_records', label: 'Registros de Cópias', pk: 'id' },
      { table: 'supplies', label: 'Insumos (Estoque)', pk: 'id' },
      { table: 'supply_records', label: 'Registros de Insumos', pk: 'id' },
      { table: 'student_notifications', label: 'Notificações de Alunos', pk: 'id' },
      { table: 'notification_types', label: 'Tipos de Notificação', pk: 'id' },
      { table: 'users', label: 'Usuários', pk: 'id' },
      { table: 'people', label: 'Pessoas', pk: 'matricula' },
    ];
    const results: { table: string; count: number; label: string }[] = [];
    for (const { table, label, pk } of tables) {
      const { count, error } = await supabase
        .from(table)
        .select(pk, { count: 'exact', head: true })
        .eq('setor_id', fromSetorId);
      if (error) {
        console.warn(`Erro ao contar ${table}:`, error.message);
      } else {
        results.push({ table, count: count || 0, label });
      }
    }
    return results;
  },

  getMovePreviewItems: async (fromSetorId: string, table: string): Promise<{ id: string | number; label: string; currentSetorId: string | null }[]> => {
    const pkMap: Record<string, string> = {
      items: 'id',
      reports: 'id',
      lockers: 'number',
      locker_schedules: 'id',
      books: 'id',
      book_loans: 'id',
      materials: 'id',
      material_loans: 'id',
      copy_records: 'id',
      supplies: 'id',
      supply_records: 'id',
      student_notifications: 'id',
      notification_types: 'id',
      users: 'id',
      people: 'matricula',
    };
    const selectMap: Record<string, string> = {
      items: 'id, description, campus_item_id, setor_id',
      reports: 'id, item_description, setor_id',
      lockers: 'number, location, setor_id',
      locker_schedules: 'id, locker_number, student_name, setor_id',
      books: 'id, title, setor_id',
      book_loans: 'id, person_name, setor_id',
      materials: 'id, name, code, setor_id',
      material_loans: 'id, materialName, personName, setor_id',
      copy_records: 'id, person_name, setor_id',
      supplies: 'id, name, setor_id',
      supply_records: 'id, person_name, setor_id',
      student_notifications: 'id, student_name, setor_id',
      notification_types: 'id, name, setor_id',
      users: 'id, name, matricula, setor_id',
      people: 'matricula, name, setor_id',
    };
    const columns = selectMap[table];
    const pk = pkMap[table] || 'id';
    if (!columns) return [];
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .or(`setor_id.eq.${fromSetorId},setor_id.is.null`)
      .order(pk, { ascending: true });
    if (error) return [];
    return (data || []).map((item: any) => {
      let label = '';
      let group: string | undefined;
      const itemId = item[pk];
      switch (table) {
        case 'items': label = `#${item.campus_item_id ?? item.id} - ${item.description}`; break;
        case 'reports': label = item.item_description; break;
        case 'lockers':
          label = `Armário ${item.number}${item.location ? ` (${item.location})` : ''}`;
          if (item.location) {
            const parts = item.location.split(' - ');
            group = parts[0];
          }
          break;
        case 'locker_schedules': label = `${item.locker_number} - ${item.student_name}`; break;
        case 'books': label = item.title; break;
        case 'book_loans': label = item.person_name; break;
        case 'materials': label = item.code ? `${item.name} (${item.code})` : item.name; break;
        case 'material_loans': label = `${item.materialName} - ${item.personName}`; break;
        case 'copy_records': label = item.person_name; break;
        case 'supplies': label = item.name; break;
        case 'supply_records': label = item.person_name || 'Sem nome'; break;
        case 'student_notifications': label = item.student_name; break;
        case 'notification_types': label = item.name; break;
        case 'users': label = `${item.name} (${item.matricula})`; break;
        case 'people': label = `${item.name} (${item.matricula})`; break;
        default: label = item.id?.toString() || '';
      }
      return { id: itemId, label, currentSetorId: item.setor_id || null, group };
    });
  },

  moveSetorData: async (fromSetorId: string, toSetorId: string, selections?: { table: string; ids?: (string | number)[] }[]) => {
    const pkMap: Record<string, string> = {
      items: 'id',
      reports: 'id',
      lockers: 'number',
      locker_schedules: 'id',
      books: 'id',
      book_loans: 'id',
      materials: 'id',
      material_loans: 'id',
      copy_records: 'id',
      supplies: 'id',
      supply_records: 'id',
      student_notifications: 'id',
      notification_types: 'id',
      users: 'id',
      people: 'matricula',
    };
    const tablesToProcess = selections ? selections.filter(s => s.ids === undefined || s.ids.length > 0) : Object.keys(pkMap).map(t => ({ table: t }));
    const results: { table: string; count: number }[] = [];
    for (const sel of tablesToProcess) {
      const pk = pkMap[sel.table] || 'id';
      let query = supabase.from(sel.table).update({ setor_id: toSetorId }).select(pk);
      if (sel.ids) {
        query = query.in(pk, sel.ids);
      } else {
        query = query.eq('setor_id', fromSetorId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn(`Erro ao mover dados da tabela ${sel.table}:`, error.message);
      } else {
        results.push({ table: sel.table, count: data?.length || 0 });
      }
    }
    return results;
  },

  getUsers: async (campusId?: string, setorId?: string): Promise<User[]> => {
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

      if (setorId) {
        query = query.eq('setor_id', setorId);
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
        email: user.email || `${user.matricula}@sistema.local`,
        level: user.level,
        campus_id: user.campus_id,
        setor_id: user.setor_id || null,
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
        email: user.email || `${user.matricula}@sistema.local`,
        password: hashedPassword,
        level: user.level,
        campus_id: user.campus_id,
        setor_id: user.setor_id || null,
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

  deleteAllUsers: async (currentAdminId: string, campusId?: string, setorId?: string) => {
    let query = supabase.from('users').delete();
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    if (setorId) {
      query = query.eq('setor_id', setorId);
    }
    const { error } = await query;
    if (error) throw error;
  },

  updateUserEmail: async (userId: string, newEmail: string): Promise<boolean> => {
    const { error } = await supabase
      .from('users')
      .update({ email: newEmail })
      .eq('id', userId);

    if (error) {
      console.error('[UPDATE EMAIL] Erro ao atualizar e-mail:', error);
      return false;
    }

    // Atualizar sessão local
    const sessionUser = sessionStorage.getItem(SESSION_USER_KEY);
    if (sessionUser) {
      const parsed = JSON.parse(sessionUser);
      if (parsed.id === userId) {
        parsed.email = newEmail;
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(parsed));
      }
    }

    return true;
  },

  requestPasswordReset: async (matricula: string): Promise<{ email: string; name: string; token: string } | null> => {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('matricula', matricula.trim())
      .single();

    if (error || !user) {
      console.warn('[RESET] Usuário não encontrado:', matricula);
      return null;
    }

    if (!user.email) {
      console.warn('[RESET] Usuário sem e-mail:', matricula);
      return null;
    }

    const token = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora

    const { data: rpcData, error: updateError } = await supabase.rpc('request_password_reset', {
      p_matricula: matricula.trim(),
      p_token: token,
      p_expires: expires
    });

    if (updateError) {
      console.error('[RESET] Erro ao salvar token via RPC:', updateError);
      return null;
    }

    console.log('[RESET] Token gerado e salvo para:', matricula);
    return { email: user.email, name: user.name, token };
  },

  validateResetToken: async (token: string): Promise<boolean> => {
    console.log('[RESET] Validando token via RPC:', token);
    
    const { data: isValid, error } = await supabase.rpc('validate_reset_token', {
      p_token: token.trim()
    });

    if (error) {
      console.error('[RESET] Erro na validação RPC:', error);
      return false;
    }

    return !!isValid;
  },

  completePasswordReset: async (token: string, newPassword: string): Promise<boolean> => {
    const isValid = await StorageService.validateResetToken(token);
    if (!isValid) {
      console.warn('[RESET] Token inválido ou expirado');
      return false;
    }

    const hashedPassword = await StorageService.hashPassword(newPassword);

    const { data: rpcSuccess, error: updateError } = await supabase.rpc('complete_password_reset', {
      p_token: token.trim(),
      p_new_password: newPassword,
      p_hashed_password: hashedPassword
    });

    if (updateError || !rpcSuccess) {
      console.error('[RESET] Erro ao atualizar senha via RPC:', updateError);
      return false;
    }

    return true;
  },

  changePassword: async (userId: string, newPass: string, actorName: string): Promise<User | null> => {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();

    if (!user) {
      console.error('[CHANGE PASSWORD] Usuário não encontrado:', userId);
      return null;
    }

    const hashedPassword = await StorageService.hashPassword(newPass);
    const dateStr = new Date().toLocaleString('pt-BR');
    const log = `Senha alterada pelo próprio usuário em ${dateStr}.`;

    const { data: rpcOk, error: rpcError } = await supabase.rpc('change_user_password', {
      p_user_id: userId,
      p_hashed_password: hashedPassword,
      p_log_message: log,
      p_new_password: newPass
    });

    if (rpcError || !rpcOk) {
      console.error('[CHANGE PASSWORD] Erro via RPC:', rpcError);
      const { error: directError } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', userId);
      if (directError) {
        console.error('[CHANGE PASSWORD] Fallback também falhou:', directError);
        return null;
      }
    }

    const updatedUser: User = {
      ...user,
      password: hashedPassword,
      logs: [...(user.logs || []), log]
    };

    const sessionUser = sessionStorage.getItem(SESSION_USER_KEY);
    if (sessionUser) {
      const parsed = JSON.parse(sessionUser);
      if (parsed.id === userId) {
        parsed.password = hashedPassword;
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(parsed));
      }
    }

    return updatedUser as User;
  },

  // People
  getAllPeople: async (campusId?: string, setorId?: string): Promise<Person[]> => {
    let allData: Person[] = [];
    let from = 0;
    const limit = 1000;

    while (true) {
      let query = supabase
        .from('people')
        .select('id, name, matricula, campus_id, setor_id, type, email')
        .range(from, from + limit - 1);

      if (campusId) {
        query = query.eq('campus_id', campusId);
      }

      if (setorId) {
        query = query.eq('setor_id', setorId);
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
      .select('name, matricula, campus_id, type, email')
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

  searchPeople: async (query: string, limit: number = 20, campusId?: string, type?: string, setorId?: string): Promise<Person[]> => {
    if (!query || query.trim().length < 2) return [];

    const searchTerm = query.trim();

    // Quando não há filtro de campus, usar RPC para bypassar RLS
    if (!campusId) {
      const { data, error } = await supabase.rpc('search_people_global', {
        p_query: searchTerm,
        p_limit: limit
      });
      if (error) {
        console.error("Erro ao pesquisar pessoas (global):", error);
        return [];
      }
      let results = data || [];
      if (type && type !== 'ALL') {
        results = results.filter((p: any) => p.type === type);
      }
      return results;
    }

    const tokens = searchTerm.split(/\s+/).filter(t => t.length > 0);

    let supabaseQuery = supabase
      .from('people')
      .select('name, matricula, campus_id, type, email, setor_id');

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

    if (setorId) {
      supabaseQuery = supabaseQuery.eq('setor_id', setorId);
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

  savePerson: async (person: Person, oldMatricula?: string) => {
    if (oldMatricula && oldMatricula !== person.matricula) {
      // 1. Verificar se a nova matrícula já existe (para evitar conflito de PK)
      const { data: existing } = await supabase.from('people').select('matricula').eq('matricula', person.matricula).maybeSingle();
      if (existing) {
        throw new Error(`A matrícula '${person.matricula}' já está cadastrada para outra pessoa.`);
      }

      // 2. Atualizar a matrícula na tabela principal (PK)
      const { error: updateError } = await supabase
        .from('people')
            .update({
              matricula: person.matricula,
              name: person.name,
              type: person.type,
              campus_id: person.campus_id,
              setor_id: person.setor_id || null,
              email: person.email,
              document: person.document || null,
              document_type: person.document_type || null,
              phone: person.phone || null,
            })
            .eq('matricula', oldMatricula);

      if (updateError) throw updateError;

      // 3. Atualizar tabelas relacionadas (Mantendo integridade manual)
      // Nota: Como não são FKeys formais com ON UPDATE CASCADE, fazemos manualmente.
      const relatedTables = [
        { table: 'book_loans', col: 'person_matricula' },
        { table: 'material_loans', col: 'personMatricula' },
        { table: 'reports', col: 'person_matricula' },
        { table: 'copy_records', col: 'person_matricula' },
        { table: 'supply_records', col: 'person_matricula' },
        { table: 'locker_schedules', col: 'registration_number' }
      ];

      for (const { table, col } of relatedTables) {
        await supabase.from(table).update({ [col]: person.matricula }).eq(col, oldMatricula);
      }

      // 4. Caso especial: Lockers (JSONB)
      const { data: lockersToUpdate } = await supabase.from('lockers').select('number, campus_id, current_loan').not('current_loan', 'is', null);
      if (lockersToUpdate) {
        for (const l of lockersToUpdate) {
          if (l.current_loan?.registrationNumber === oldMatricula) {
            const updatedLoan = { ...l.current_loan, registrationNumber: person.matricula };
            await supabase.from('lockers').update({ current_loan: updatedLoan }).eq('number', l.number).eq('campus_id', l.campus_id);
          }
        }
      }
    } else {
      // Caso normal: Upsert (Cria novo ou atualiza por matrícula)
      const { error } = await supabase.from('people').upsert({
        matricula: person.matricula,
        name: person.name,
        type: person.type,
        campus_id: person.campus_id,
        setor_id: person.setor_id || null,
        email: person.email,
        document: person.document || null,
        document_type: person.document_type || null,
        phone: person.phone || null,
      }, { onConflict: 'matricula' });

      if (error) throw error;
    }
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
    let totalInserted = 0;
    let totalUpdated = 0;

    if (people.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < people.length; i += BATCH_SIZE) {
        const batch = people.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.rpc('import_people_bulk', {
          p_people: batch.map(p => ({
            matricula: p.matricula,
            name: p.name,
            type: p.type,
            email: p.email || null,
            campus_id: p.campus_id,
            setor_id: p.setor_id || null
          }))
        });
        if (error) {
          console.error("Erro import batch via RPC:", error);
          throw error;
        }
        if (data && data.length > 0) {
          totalInserted += data[0].inserted_count || 0;
          totalUpdated += data[0].updated_count || 0;
        }
      }

      const withEmail = people.filter(p => p.email);
      if (withEmail.length > 0) {
        const CONCURRENT = 50;
        for (let i = 0; i < withEmail.length; i += CONCURRENT) {
          const batch = withEmail.slice(i, i + CONCURRENT);
          await Promise.all(batch.map(p =>
            supabase
              .from('people')
              .update({ email: p.email })
              .eq('matricula', p.matricula)
              .then(({ error }) => {
                if (error) console.warn(`Email não atualizado: ${p.matricula}`, error);
              })
          ));
        }
      }
    }
    return { inserted: totalInserted, updated: totalUpdated };
  },

  // Items
  getItems: async (campusId?: string, setorId?: string): Promise<FoundItem[]> => {
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

      if (setorId) {
        query = query.eq('setor_id', setorId);
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
      campus_id: d.campus_id,
      setor_id: d.setor_id
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
      setor_id: item.setor_id || null,
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

  deleteItemHistoryEntry: async (itemId: number, entryIndex: number) => {
    const { data, error: fetchError } = await supabase.from('items').select('history').eq('id', itemId).single();
    if (fetchError) throw fetchError;
    const history: ItemHistory[] = data?.history || [];
    if (entryIndex < 0 || entryIndex >= history.length) throw new Error('Índice de histórico inválido.');
    history.splice(entryIndex, 1);
    const { error: updateError } = await supabase.from('items').update({ history }).eq('id', itemId);
    if (updateError) throw updateError;
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
  getReports: async (campusId?: string, setorId?: string): Promise<LostReport[]> => {
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

      if (setorId) {
        query = query.eq('setor_id', setorId);
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
      campus_id: d.campus_id,
      setor_id: d.setor_id
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
      campus_id: report.campus_id,
      setor_id: report.setor_id || null
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
  getLockers: async (campusId?: string, setorId?: string): Promise<Locker[]> => {
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

      if (setorId) {
        query = query.eq('setor_id', setorId);
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
      campus_id: d.campus_id,
      setor_id: d.setor_id
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
      campus_id: l.campus_id,
      setor_id: l.setor_id || null
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
      campus_id: locker.campus_id,
      setor_id: locker.setor_id || null
    };

    let query = supabase.from('lockers').update(payload).eq('number', locker.number);
    if (locker.campus_id) {
      query = query.eq('campus_id', locker.campus_id);
    }

    const { error } = await query;
    if (error) throw error;
  },

  clearAllLockerLoans: async (campusId?: string, setorId?: string) => {
    let query = supabase.from('lockers').select('*');
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    if (setorId) {
      query = query.eq('setor_id', setorId);
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

  deleteEmptyLockers: async (campusId?: string, setorId?: string) => {
    let query = supabase.from('lockers').delete().eq('status', LockerStatus.AVAILABLE);
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    if (setorId) {
      query = query.eq('setor_id', setorId);
    }
    const { error } = await query;
    if (error) throw error;
  },

  // Locker Schedules
  getLockerSchedules: async (campusId?: string, setorId?: string): Promise<LockerSchedule[]> => {
    let query = supabase.from('locker_schedules').select('*').order('scheduled_at', { ascending: false });
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    if (setorId) {
      query = query.eq('setor_id', setorId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: d.id,
      lockerNumber: d.locker_number,
      lockerLocation: d.locker_location || '',
      campusId: d.campus_id,
      setor_id: d.setor_id,
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
      setor_id: schedule.setor_id || null,
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
      setor_id: data.setor_id,
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
    const cleanMatricula = matricula ? matricula.trim() : '';
    const cleanPass = pass ? pass.trim() : '';
    const email = `${cleanMatricula}@sistema.local`;

    console.log(`[LOGIN] Tentando login para: ${cleanMatricula}`);

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
      }

      console.warn("[LOGIN] Auth falhou, tentando fallback legado...");

      const { data: localUser, error: localError } = await supabase
        .from('users')
        .select('*')
        .eq('matricula', cleanMatricula)
        .single();

      if (!localError && localUser) {
        const hashed = await StorageService.hashPassword(cleanPass);
        if (hashed === localUser.password) {
          console.log("[LOGIN] Fallback OK. Migrando para Auth...");

          try {
            const { error: signUpError } = await supabase.auth.signUp({
              email,
              password: cleanPass,
              options: { data: { matricula: localUser.matricula, name: localUser.name } }
            });

            if (!signUpError) {
              console.log("[LOGIN] Migração concluída. Faça login novamente.");
            }
          } catch (migreEx) {
            console.warn("[LOGIN] Falha na migração Auth:", migreEx);
          }

          const dateStr = new Date().toLocaleString('pt-BR');
          const updatedAccessLogs = [dateStr, ...(localUser.access_logs || [])].slice(0, 10);

          await supabase.from('users').update({
            access_logs: updatedAccessLogs
          }).eq('id', localUser.id);

          return { ...localUser, access_logs: updatedAccessLogs } as User;
        }
      }
    } catch (authEx) {
      console.error("[LOGIN] Exceção no Auth:", authEx);
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
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('[CLEAR] Erro no signOut do Auth:', e);
    }
    // Limpar manualmente TUDO relacionado ao Supabase Auth
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('sb-') || key === SESSION_USER_KEY || key === LAST_ACTIVE_KEY || key === 'currentSystem' || key === 'activeTab')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    // Também limpar localStorage por segurança
    const lbKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-')) {
        lbKeys.push(key);
      }
    }
    lbKeys.forEach(key => localStorage.removeItem(key));
  },

  updateLastActive: () => {
    sessionStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  },

  isSessionExpired: async (): Promise<boolean> => {
    const lastActive = sessionStorage.getItem(LAST_ACTIVE_KEY);
    // Se não existe lastActive, o usuário acabou de logar — não expirou
    if (!lastActive) return false;
    return Date.now() - parseInt(lastActive, 10) > TIMEOUT_MS;
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
  getBooks: async (campusId?: string, setorId?: string): Promise<Book[]> => {
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
      if (setorId) {
        query = query.eq('setor_id', setorId);
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
      campus_id: book.campus_id,
      setor_id: book.setor_id || null
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
  getBookLoans: async (campusId?: string, setorId?: string): Promise<BookLoan[]> => {
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
      if (setorId) {
        query = query.eq('setor_id', setorId);
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
      campus_id: d.campus_id,
      setor_id: d.setor_id
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
      campus_id: loan.campus_id,
      setor_id: loan.setor_id || null
    };
    const { error } = await supabase.from('book_loans').upsert(payload);
    if (error) throw error;
  },

  deleteBookLoan: async (loanId: string) => {
    const { error } = await supabase
      .from('book_loans')
      .delete()
      .eq('id', loanId);
    if (error) throw error;
  },

  // Materials
  getMaterials: async (campusId?: string, setorId?: string): Promise<Material[]> => {
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
      if (setorId) {
        query = query.eq('setor_id', setorId);
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
      campus_id: material.campus_id,
      setor_id: material.setor_id || null
    });

    if (error) throw error;
  },

  saveMaterialsBulk: async (materials: Material[]) => {
    const { error } = await supabase.from('materials').insert(materials.map(m => ({
      id: m.id,
      code: m.code,
      name: m.name,
      createdAt: m.createdAt,
      campus_id: m.campus_id,
      setor_id: m.setor_id || null
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
  getMaterialLoans: async (campusId?: string, setorId?: string): Promise<MaterialLoan[]> => {
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
      if (setorId) {
        query = query.eq('setor_id', setorId);
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
      personEmail: d.personEmail,
      loanDate: d.loanDate,
      returnDate: d.returnDate,
      observation: d.observation,
      status: d.status,
      loanedBy: d.loanedBy,
      returnedBy: d.returnedBy,
      campus_id: d.campus_id,
      setor_id: d.setor_id
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
      personEmail: loan.personEmail,
      loanDate: loan.loanDate,
      returnDate: loan.returnDate,
      observation: loan.observation,
      status: loan.status,
      loanedBy: loan.loanedBy,
      returnedBy: loan.returnedBy,
      campus_id: loan.campus_id,
      setor_id: loan.setor_id || null
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

  deleteMaterialLoan: async (loanId: string) => {
    const { error } = await supabase
      .from('material_loans')
      .delete()
      .eq('id', loanId);

    if (error) throw error;
  },

  deleteMaterialLoansBulk: async (loanIds: string[]) => {
    const { error } = await supabase
      .from('material_loans')
      .delete()
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
        setor_id: config.setor_id || null,
        start_day: config.start_day,
        end_day: config.end_day,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
  },

  getCampusConfig: async (campusId: string): Promise<{ material_email_notification: boolean } | null> => {
    const { data, error } = await supabase
      .from('campus_config')
      .select('material_email_notification')
      .eq('campus_id', campusId)
      .maybeSingle();
    if (error) {
      console.error("Erro ao buscar config do campus:", error);
      return null;
    }
    return data;
  },

  saveCampusConfig: async (campusId: string, material_email_notification: boolean) => {
    const { error } = await supabase
      .from('campus_config')
      .upsert({
        campus_id: campusId,
        material_email_notification,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
  },

  getCopyRecords: async (campusId: string, setorId?: string, startDate?: string, endDate?: string): Promise<CopyRecord[]> => {
    let query = supabase
      .from('copy_records')
      .select('*')
      .eq('campus_id', campusId)
      .order('date', { ascending: false });

    if (setorId) {
      query = query.eq('setor_id', setorId);
    }
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
      person_type: peopleMap[record.person_matricula],
      setor_id: record.setor_id
    }));
  },

  saveCopyRecord: async (record: Partial<CopyRecord>) => {
    const payload = {
      id: record.id || undefined,
      campus_id: record.campus_id,
      setor_id: record.setor_id || null,
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
    // 1. Check if person exists globally in the 'people' table (bypassing RLS via RPC)
    const { data: rpcData, error: rpcError } = await supabase.rpc('check_person_exists_global', {
      p_matricula: matricula
    });

    if (rpcError) {
      console.warn("Falling back to direct query on people (likely RLS limited):", rpcError);
    }

    const globalPerson = rpcData?.[0] ? {
      matricula: matricula,
      name: rpcData[0].name,
      campus_id: rpcData[0].campus_id,
      type: rpcData[0].type,
      campuses: { name: rpcData[0].campus_name }
    } : null;

    // Se o RPC falhar por qualquer motivo (ex: não instalado ainda), tentamos a consulta normal (RLS limitada)
    let person = globalPerson;
    if (!person && !rpcError) {
      const { data } = await supabase
        .from('people')
        .select('*, campuses(name)')
        .eq('matricula', matricula)
        .maybeSingle();
      person = data;
    }

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

    // 5. Check for active reserve key loans (in loan_history)
    let allLockersQuery = supabase.from('lockers').select('*');
    if (campusId) allLockersQuery = allLockersQuery.eq('campus_id', campusId);
    const { data: allLockerData } = await allLockersQuery;
    const reserveKeyLoans: any[] = [];
    (allLockerData || []).forEach(l => {
      (l.loan_history || []).forEach((loan: any) => {
        if (loan.registrationNumber === matricula && loan.loanType === 'reserve_key' && !loan.returnDate) {
          reserveKeyLoans.push({ ...loan, lockerNumber: l.number });
        }
      });
    });

    return {
      person,
      bookLoans: bookLoans || [],
      materialLoans: materialLoans || [],
      lockerLoans: activeLockerLoans.map(l => ({ ...l.current_loan, lockerNumber: l.number })),
      reserveKeyLoans,
      hasPendencies: (bookLoans?.length || 0) > 0 || (materialLoans?.length || 0) > 0 || activeLockerLoans.length > 0 || reserveKeyLoans.length > 0
    };
  },

  // Supply Distribution Methods
  getSupplies: async (campusId?: string, setorId?: string): Promise<Supply[]> => {
    let query = supabase.from('supplies').select('*').order('name', { ascending: true });
    if (campusId) query = query.eq('campus_id', campusId);
    if (setorId) query = query.eq('setor_id', setorId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  saveSupply: async (supply: Partial<Supply>, operator_name?: string) => {
    const isNew = !supply.id;

    // Se estiver editando, verifica se a quantidade mudou para registrar o ajuste no histórico
    if (!isNew && supply.id) {
      const { data: existing } = await supabase
        .from('supplies')
        .select('quantity')
        .eq('id', supply.id)
        .single();

      if (existing && existing.quantity !== supply.quantity) {
        const delta = (supply.quantity || 0) - existing.quantity;
        await supabase.from('supply_restock_history').insert({
          supply_id: supply.id,
          campus_id: supply.campus_id,
          quantity_added: delta,
          operator_id: supply.operator_id || null,
          date: new Date().toISOString(),
          note: delta > 0 ? `Ajuste de Estoque (+${delta})` : `Ajuste de Estoque (${delta})`
        });
      }
    }

    const payload = {
      id: supply.id || undefined,
      campus_id: supply.campus_id,
      setor_id: supply.setor_id || null,
      name: supply.name,
      quantity: supply.quantity || 0,
      unit: supply.unit,
      low_stock_threshold: supply.low_stock_threshold,
      updated_at: new Date().toISOString()
    };
    const { data: upserted, error } = await supabase.from('supplies').upsert(payload).select().single();
    if (error) throw error;

    // Register initial stock as a restock history entry when creating a new supply with quantity > 0
    if (isNew && (supply.quantity || 0) > 0 && upserted) {
      await supabase.from('supply_restock_history').insert({
        supply_id: upserted.id,
        campus_id: supply.campus_id,
        quantity_added: supply.quantity,
        operator_id: supply.operator_id || null,
        date: new Date().toISOString(),
        note: 'Entrada'
      });
    }
  },

  deleteSupply: async (id: string) => {
    const { error } = await supabase.from('supplies').delete().eq('id', id);
    if (error) throw error;
  },

  getSupplyRecords: async (campusId?: string, setorId?: string, startDate?: string, endDate?: string): Promise<SupplyRecord[]> => {
    let query = supabase.from('supply_records').select('*').order('date', { ascending: false });
    if (campusId) query = query.eq('campus_id', campusId);
    if (setorId) query = query.eq('setor_id', setorId);
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
      setor_id: record.setor_id || null,
      person_name: record.person_name,
      person_matricula: record.person_matricula,
      environment: record.environment,
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

  cancelSupplyRecord: async (id: string, operatorName: string) => {
    // 1. Get record
    const { data: record } = await supabase.from('supply_records').select('*').eq('id', id).single();
    if (!record || record.cancelled_at) return;

    // 2. Restore stock
    const { data: supply } = await supabase.from('supplies').select('quantity').eq('id', record.item_id).single();
    if (supply) {
      await supabase.from('supplies')
        .update({ quantity: supply.quantity + record.quantity, updated_at: new Date().toISOString() })
        .eq('id', record.item_id);
    }

    // 3. Update record with cancellation info
    const { error } = await supabase.from('supply_records').update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: operatorName
    }).eq('id', id);
    if (error) throw error;
  },

  importPersonGlobal: async (matricula: string, newCampusId: string) => {
    const { error } = await supabase.rpc('import_person_to_campus', {
      p_matricula: matricula,
      p_new_campus_id: newCampusId
    });
    if (error) throw error;
  },

  restockSupply: async (restock: Partial<SupplyRestock>) => {
    // 1. Get current supply
    const { data: supply } = await supabase
      .from('supplies')
      .select('quantity')
      .eq('id', restock.supply_id)
      .single();

    if (!supply) throw new Error("Insumo não encontrado.");

    const newQuantity = (supply.quantity || 0) + (restock.quantity_added || 0);

    // 2. Insert into history
    const { error: hError } = await supabase.from('supply_restock_history').insert({
      supply_id: restock.supply_id,
      campus_id: restock.campus_id,
      setor_id: restock.setor_id || null,
      quantity_added: restock.quantity_added,
      operator_id: restock.operator_id,
      date: restock.date || new Date().toISOString()
    });
    if (hError) throw hError;

    // 3. Update supply quantity
    const { error: uError } = await supabase
      .from('supplies')
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq('id', restock.supply_id);

    if (uError) throw uError;
  },

  getRestockHistory: async (campusId?: string, setorId?: string): Promise<SupplyRestock[]> => {
    let query = supabase.from('supply_restock_history').select('*').order('date', { ascending: false });
    if (campusId) query = query.eq('campus_id', campusId);
    if (setorId) query = query.eq('setor_id', setorId);
    
    const { data, error } = await query;
    if (error) throw error;
    return (data as SupplyRestock[]) || [];
  },

  cancelRestockRecord: async (id: string, operatorName: string) => {
    // 1. Get record
    const { data: record } = await supabase.from('supply_restock_history').select('*').eq('id', id).single();
    if (!record || record.cancelled_at) return;

    // 2. Restore stock (reverse the restock)
    const { data: supply } = await supabase.from('supplies').select('quantity').eq('id', record.supply_id).single();
    if (supply) {
      const newQuantity = Math.max(0, supply.quantity - record.quantity_added);
      await supabase.from('supplies')
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', record.supply_id);
    }

    // 3. Update record with cancellation info
    const { error } = await supabase.from('supply_restock_history').update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: operatorName
    }).eq('id', id);
    if (error) throw error;
  },

  adjustSupplyQuantity: async (supplyId: string, campusId: string, newTotal: number, operatorId: string, operatorName: string, setorId?: string) => {
    // 1. Get current supply
    const { data: supply } = await supabase.from('supplies').select('quantity').eq('id', supplyId).single();
    if (!supply) throw new Error("Insumo não encontrado.");

    const currentQuantity = supply.quantity || 0;
    const delta = newTotal - currentQuantity;
    if (delta === 0) return;

    // 2. Insert into history as adjustment
    const { error: hError } = await supabase.from('supply_restock_history').insert({
      supply_id: supplyId,
      campus_id: campusId,
      setor_id: setorId || null,
      quantity_added: delta,
      operator_id: operatorId,
      date: new Date().toISOString(),
      note: delta > 0 ? `Ajuste de Estoque (+${delta})` : `Ajuste de Estoque (${delta})`
    });
    if (hError) throw hError;

    // 3. Update supply quantity
    const { error: uError } = await supabase.from('supplies').update({
      quantity: newTotal,
      updated_at: new Date().toISOString()
    }).eq('id', supplyId);
    if (uError) throw uError;
  },

  // Student Notifications
  getNotifications: async (campusId?: string, setorId?: string): Promise<StudentNotification[]> => {
    // Permanently delete expired soft-deletes (>24h)
    const expiryThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('student_notifications')
      .delete()
      .not('deleted_at', 'is', null)
      .lt('deleted_at', expiryThreshold);

    let query = supabase
      .from('student_notifications')
      .select('*, notification_types(*)')
      .order('date', { ascending: false })
      .order('time', { ascending: false });
    if (campusId) query = query.eq('campus_id', campusId);
    if (setorId) query = query.eq('setor_id', setorId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((d: any) => ({
      id: d.id,
      campus_id: d.campus_id,
      setor_id: d.setor_id,
      date: d.date,
      time: d.time,
      student_matricula: d.student_matricula,
      student_name: d.student_name,
      period: d.period,
      class_name: d.class_name,
      notification_type_ids: d.notification_type_ids || [],
      selected_subtypes: d.selected_subtypes || [],
      justification: d.justification,
      teacher_referral: d.teacher_referral,
      teacher_name: d.teacher_name,
      operator_id: d.operator_id,
      operator_name: d.operator_name,
      operator_matricula: d.operator_matricula,
      updated_by: d.updated_by,
      updated_by_name: d.updated_by_name,
      updated_by_matricula: d.updated_by_matricula,
      updated_at: d.updated_at,
      out_of_hours: d.out_of_hours,
      mobile_use: d.mobile_use,
      no_uniform: d.no_uniform,
      no_sneakers: d.no_sneakers,
      deleted_at: d.deleted_at,
      deleted_by: d.deleted_by,
      deleted_by_name: d.deleted_by_name,
      deleted_by_matricula: d.deleted_by_matricula,
      deleted_justification: d.deleted_justification,
      created_at: d.created_at
    }));
  },

  saveNotification: async (notification: Partial<StudentNotification>) => {
    const payload = {
      id: notification.id || undefined,
      campus_id: notification.campus_id,
      setor_id: notification.setor_id || null,
      date: notification.date,
      time: notification.time,
      student_matricula: notification.student_matricula,
      student_name: notification.student_name,
      period: notification.period,
      class_name: notification.class_name,
      notification_type_ids: notification.notification_type_ids || [],
      notification_type_id: notification.notification_type_ids?.[0] || null, // Backward compatibility
      selected_subtypes: notification.selected_subtypes || [],
      justification: notification.justification,
      teacher_referral: notification.teacher_referral,
      teacher_name: notification.teacher_name,
      operator_id: notification.operator_id,
      operator_name: notification.operator_name,
      operator_matricula: notification.operator_matricula,
      updated_by: notification.updated_by,
      updated_by_name: notification.updated_by_name,
      updated_by_matricula: notification.updated_by_matricula,
      updated_at: notification.updated_at,
      deleted_at: notification.deleted_at,
      deleted_by: notification.deleted_by,
      deleted_by_name: notification.deleted_by_name,
      deleted_by_matricula: notification.deleted_by_matricula,
      deleted_justification: notification.deleted_justification,
      out_of_hours: notification.out_of_hours || false,
      mobile_use: notification.mobile_use || false,
      no_uniform: notification.no_uniform || false,
      no_sneakers: notification.no_sneakers || false
    };

    const { error } = await supabase.from('student_notifications').upsert(payload);
    if (error) throw error;
  },

  softDeleteNotification: async (id: string, userId: string, userName: string, userMatricula: string, justification: string) => {
    const { error } = await supabase
      .from('student_notifications')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deleted_by_name: userName,
        deleted_by_matricula: userMatricula,
        deleted_justification: justification
      })
      .eq('id', id);
    if (error) throw error;
  },

  cancelDeleteNotification: async (id: string) => {
    const { error } = await supabase
      .from('student_notifications')
      .update({
        deleted_at: null,
        deleted_by: null,
        deleted_by_name: null,
        deleted_by_matricula: null,
        deleted_justification: null
      })
      .eq('id', id);
    if (error) throw error;
  },

  deleteNotificationExpired: async (id: string) => {
    const { error } = await supabase.from('student_notifications').delete().eq('id', id);
    if (error) throw error;
  },

  forceDeleteNotification: async (id: string) => {
    const { error } = await supabase.from('student_notifications').delete().eq('id', id);
    if (error) throw error;
  },

  // Notification Types
  getNotificationTypes: async (campusId?: string, setorId?: string): Promise<NotificationType[]> => {
    let query = supabase
      .from('notification_types')
      .select('*')
      .order('name', { ascending: true });
    if (campusId) query = query.eq('campus_id', campusId);
    if (setorId) query = query.eq('setor_id', setorId);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      setor_id: d.setor_id,
      subtypes: d.subtypes || []
    }));
  },

  saveNotificationType: async (type: Partial<NotificationType>) => {
    const payload: any = {
      name: type.name,
      color: type.color || 'red',
      etep_threshold: type.etep_threshold ?? 3,
      subtypes: type.subtypes || [],
      campus_id: type.campus_id || null,
      setor_id: type.setor_id || null,
    };
    if (type.id) payload.id = type.id;

    const { error } = await supabase.from('notification_types').upsert(payload);
    if (error) throw error;
  },

  deleteNotificationType: async (id: string) => {
    const { error } = await supabase.from('notification_types').delete().eq('id', id);
    if (error) throw error;
  },

  // Teacher Attendance & Schedules
  getTeacherSchedules: async (campusId?: string): Promise<TeacherSchedule[]> => {
    let query = supabase.from('teacher_schedules').select('*').order('class_name', { ascending: true }).order('period', { ascending: true });
    if (campusId) query = query.eq('campus_id', campusId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  saveTeacherSchedule: async (schedule: TeacherSchedule) => {
    const { error } = await supabase.from('teacher_schedules').upsert({
      id: schedule.id || undefined,
      campus_id: schedule.campus_id,
      class_name: schedule.class_name,
      subject: schedule.subject,
      teacher_name: schedule.teacher_name,
      day_of_week: schedule.day_of_week,
      period: schedule.period,
      periods: schedule.periods,
      shorthand: schedule.shorthand,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      room: schedule.room
    });
    if (error) throw error;
  },

  deleteTeacherSchedule: async (id: string) => {
    const { error } = await supabase.from('teacher_schedules').delete().eq('id', id);
    if (error) throw error;
  },

  getTeacherAttendance: async (campusId: string | undefined, date: string): Promise<TeacherAttendance[]> => {
    let query = supabase.from('teacher_attendance').select('*').eq('date', date);
    if (campusId) query = query.eq('campus_id', campusId);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  saveTeacherAttendance: async (attendance: TeacherAttendance): Promise<TeacherAttendance> => {
    const { data, error } = await supabase.from('teacher_attendance').upsert({
      id: attendance.id || undefined,
      campus_id: attendance.campus_id,
      schedule_id: attendance.schedule_id,
      period: attendance.period,
      date: attendance.date,
      status: attendance.status,
      substitute_name: attendance.substitute_name,
      observation: attendance.observation,
      operator_id: attendance.operator_id
    }, { onConflict: 'schedule_id, date, period' }).select().single();
    if (error) throw error;
    return data;
  },

  deleteTeacherAttendance: async (id: string) => {
    const { error } = await supabase.from('teacher_attendance').delete().eq('id', id);
    if (error) throw error;
  },

  // Teacher Classes
  getTeacherClasses: async (campusId?: string): Promise<TeacherClass[]> => {
    let query = supabase.from('teacher_classes').select('*');
    if (campusId) query = query.eq('campus_id', campusId);
    const { data, error } = await query.order('name');
    if (error) throw error;
    return data || [];
  },

  saveTeacherClass: async (teacherClass: TeacherClass) => {
    if (teacherClass.id) {
      const { data, error } = await supabase
        .from('teacher_classes')
        .update({
          name: teacherClass.name,
          room: teacherClass.room || null
        })
        .eq('id', teacherClass.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('teacher_classes')
        .upsert(teacherClass, { onConflict: 'campus_id,name' })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  deleteTeacherClass: async (id: string) => {
    const { error } = await supabase.from('teacher_classes').delete().eq('id', id);
    if (error) throw error;
  },

  getTeacherAttendanceByDateRange: async (campusId: string | undefined, startDate: string, endDate: string): Promise<TeacherAttendance[]> => {
    let query = supabase
      .from('teacher_attendance')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });
    if (campusId) query = query.eq('campus_id', campusId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  hasTeacherAttendance: async (scheduleId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('teacher_attendance')
      .select('id')
      .eq('schedule_id', scheduleId)
      .limit(1);
    if (error) throw error;
    return !!(data && data.length > 0);
  },

  // Teacher Planned Absences
  getTeacherPlannedAbsences: async (campusId?: string): Promise<TeacherPlannedAbsence[]> => {
    let query = supabase.from('teacher_planned_absences').select('*');
    if (campusId) query = query.eq('campus_id', campusId);
    const { data, error } = await query.order('date', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  getTeacherPlannedAbsencesByDateRange: async (campusId: string | undefined, startDate: string, endDate: string): Promise<TeacherPlannedAbsence[]> => {
    let query = supabase
      .from('teacher_planned_absences')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    if (campusId) query = query.eq('campus_id', campusId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  saveTeacherPlannedAbsence: async (absence: TeacherPlannedAbsence): Promise<TeacherPlannedAbsence> => {
    const payload: any = {
      campus_id: absence.campus_id,
      teacher_name: absence.teacher_name,
      date: absence.date,
      schedule_id: absence.schedule_id,
      period: absence.period,
      status: absence.status,
      substitute_name: absence.substitute_name || null,
      observation: absence.observation || null,
      operator_id: absence.operator_id
    };
    payload.id = absence.id || crypto.randomUUID();
    payload.created_at = absence.created_at || new Date().toISOString();

    const { data, error } = await supabase.from('teacher_planned_absences').upsert(payload, { onConflict: 'id' }).select().single();
    if (error) throw error;
    return data;
  },

  deleteTeacherPlannedAbsence: async (id: string) => {
    const { error } = await supabase.from('teacher_planned_absences').delete().eq('id', id);
    if (error) throw error;
  },

  // Teacher Reposições
  getTeacherReposicoes: async (campusId?: string): Promise<TeacherReposicao[]> => {
    let query = supabase.from('teacher_reposicoes').select('*');
    if (campusId) query = query.eq('campus_id', campusId);
    const { data, error } = await query.order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  saveTeacherReposicao: async (reposicao: TeacherReposicao) => {
    const payload: any = {
      campus_id: reposicao.campus_id,
      attendance_id: reposicao.attendance_id || null,
      planned_absence_id: reposicao.planned_absence_id || null,
      schedule_id: reposicao.schedule_id,
      date: reposicao.date,
      period: reposicao.period,
      teacher_name: reposicao.teacher_name,
      class_name: reposicao.class_name,
      subject: reposicao.subject,
      status: reposicao.status,
      makeup_date: reposicao.makeup_date || null,
      makeup_period: reposicao.makeup_period || null,
      observation: reposicao.observation || null,
      operator_id: reposicao.operator_id
    };
    payload.id = reposicao.id || crypto.randomUUID();
    payload.created_at = reposicao.created_at || new Date().toISOString();

    const { error } = await supabase.from('teacher_reposicoes').upsert(payload);
    if (error) throw error;
  },

  deleteTeacherReposicao: async (id: string) => {
    const { error } = await supabase.from('teacher_reposicoes').delete().eq('id', id);
    if (error) throw error;
  },

  deleteTeacherReposicaoByAttendance: async (attendanceId: string) => {
    const { error } = await supabase.from('teacher_reposicoes').delete().eq('attendance_id', attendanceId);
    if (error) throw error;
  },

  deleteTeacherReposicaoByPlannedAbsence: async (plannedAbsenceId: string) => {
    const { error } = await supabase.from('teacher_reposicoes').delete().eq('planned_absence_id', plannedAbsenceId);
    if (error) throw error;
  },

  logChargeSent: async (params: {
    loan_id: string;
    material_id: string;
    person_email: string;
    person_name: string;
    triggered_by_name: string;
    triggered_by_email?: string;
    campus_id?: string;
    setor_id?: string;
  }) => {
    const { error } = await supabase.from('charge_history').insert({
      loan_id: params.loan_id,
      material_id: params.material_id,
      person_email: params.person_email,
      person_name: params.person_name,
      triggered_by_name: params.triggered_by_name,
      triggered_by_email: params.triggered_by_email,
      campus_id: params.campus_id,
      setor_id: params.setor_id || null,
    });
    if (error) {
      console.error("Erro ao registrar envio de lembrete:", error);
      throw error;
    }
  },

  getChargeHistory: async (loanId: string): Promise<import('./types-materiais').ChargeHistory[]> => {
    const { data, error } = await supabase
      .from('charge_history')
      .select('*')
      .eq('loan_id', loanId)
      .order('sent_at', { ascending: false });
    if (error) {
      console.error("Erro ao buscar historico de lembretes:", error);
      return [];
    }
    return data || [];
  },

  getPersonEmail: async (matricula: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('people')
      .select('email')
      .eq('matricula', matricula)
      .maybeSingle();
    if (error) {
      console.error("Erro ao buscar email da pessoa:", error);
      return null;
    }
    return data?.email || null;
  },

  updatePersonEmail: async (matricula: string, email: string) => {
    const { error } = await supabase
      .from('people')
      .update({ email })
      .eq('matricula', matricula);
    if (error) throw error;
  },

  previewUserEmailSync: async (): Promise<{ userId: string; matricula: string; name: string; currentEmail: string; proposedEmail: string }[]> => {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, matricula, name, email')
      .like('email', '%@sistema.local');

    if (usersError) throw usersError;
    if (!users || users.length === 0) return [];

    const matriculas = users.map(u => u.matricula);

    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('matricula, email')
      .in('matricula', matriculas)
      .not('email', 'is', null)
      .neq('email', '');

    if (peopleError) throw peopleError;

    const emailMap: Record<string, string> = {};
    if (people) {
      people.forEach(p => { emailMap[p.matricula] = p.email; });
    }

    return users
      .filter(u => emailMap[u.matricula])
      .map(u => ({
        userId: u.id,
        matricula: u.matricula,
        name: u.name,
        currentEmail: u.email || '',
        proposedEmail: emailMap[u.matricula],
      }));
  },

  applyEmailSync: async (items: { userId: string; proposedEmail: string }[]): Promise<{ updated: number; errors: number }> => {
    let updated = 0;
    let errors = 0;

    for (const item of items) {
      const { error } = await supabase
        .from('users')
        .update({ email: item.proposedEmail })
        .eq('id', item.userId);
      if (!error) updated++;
      else errors++;
    }

    return { updated, errors };
  },
};
