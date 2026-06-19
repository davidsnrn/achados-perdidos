import React, { useState, useMemo, useEffect } from 'react';
import { User, UserLevel, Person, Campus, Setor } from '../../types';
import { StorageService } from '../../services/storage';
import { DEFAULT_PASSWORD } from '../../constants';
import { Shield, Plus, Pencil, Trash2, UserCog, Lock, FileText, Loader2, Search, User as UserIcon, CheckCircle, Package, Key, BookOpen, FileCheck, History, Printer, Truck, ShieldAlert, ClipboardList, Mail, CheckSquare, Square } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
  users: User[];
  currentUser: User;
  onUpdate: () => void;
  campuses: Campus[];
  setores: Setor[];
  adminGlobalCampusId?: string | null;
  adminGlobalSetorId?: string | null;
}

export const UsersTab: React.FC<Props> = ({ users, currentUser, onUpdate, campuses, setores, adminGlobalCampusId, adminGlobalSetorId }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncItems, setSyncItems] = useState<{ userId: string; matricula: string; name: string; currentEmail: string; proposedEmail: string }[]>([]);
  const [selectedSyncIds, setSelectedSyncIds] = useState<Set<string>>(new Set());
  const [isSyncingEmails, setIsSyncingEmails] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form States
  const [formName, setFormName] = useState('');
  const [formMatricula, setFormMatricula] = useState('');
  const [formEmail, setFormEmail] = useState('');

  // Search States (Same as LostReportsTab)
  const [personSearch, setPersonSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [searchResultsPeople, setSearchResultsPeople] = useState<Person[]>([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  const [formLevel, setFormLevel] = useState<UserLevel>(UserLevel.STANDARD);
  // Permission States
  const [permissions, setPermissions] = useState({
    achados: true,
    armarios: true,
    livros: true,
    nadaconsta: true,
    pessoas: true,
    usuarios: true,
    materiais: true,
    copias: false,
    insumos: false,
    notificacoes: false,
    frequencia: false,
  });
  const [selectedCampusId, setSelectedCampusId] = useState<string>(
    (currentUser.level === UserLevel.ADMIN ? adminGlobalCampusId : currentUser.campus_id) || ''
  );
  const [selectedSetorId, setSelectedSetorId] = useState<string>(
    (currentUser.level === UserLevel.ADMIN ? adminGlobalSetorId : currentUser.setor_id) || ''
  );

  // Sync with global admin campus selector
  useEffect(() => {
    if (currentUser.level === UserLevel.ADMIN && adminGlobalCampusId !== undefined) {
      setSelectedCampusId(adminGlobalCampusId || '');
    }
  }, [adminGlobalCampusId, currentUser.level]);

  useEffect(() => {
    if (currentUser.level === UserLevel.ADMIN && adminGlobalSetorId !== undefined) {
      setSelectedSetorId(adminGlobalSetorId || '');
    }
  }, [adminGlobalSetorId, currentUser.level]);

  const userString = `${currentUser.name} (${currentUser.matricula})`;

  const normalizeText = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const handlePersonSearch = async (val: string) => {
    setPersonSearch(val);
    if (val.trim().length >= 2) {
      setIsSearchingPeople(true);
      try {
        const campusFilter = currentUser.level === UserLevel.ADMIN ? undefined : (currentUser.campus_id || undefined);
        const results = await StorageService.searchPeople(val, 10, campusFilter);
        setSearchResultsPeople(results.slice(0, 5));
      } catch (error) {
        console.error("Erro na busca:", error);
      } finally {
        setIsSearchingPeople(false);
      }
    } else {
      setSearchResultsPeople([]);
    }
  };

  const canManageUser = (targetUser: User) => {
    if (currentUser.id === targetUser.id) return true;
    if (currentUser.level === UserLevel.ADMIN) {
      return targetUser.level !== UserLevel.ADMIN;
    }
    if (currentUser.level === UserLevel.ADVANCED) {
      return targetUser.level === UserLevel.STANDARD;
    }
    return false;
  };

  const canResetPassword = (targetUser: User) => {
    if (currentUser.id === targetUser.id) return false; // Não reseta a própria senha aqui
    if (currentUser.level === UserLevel.ADMIN) {
      return targetUser.level !== UserLevel.ADMIN;
    }
    if (currentUser.level === UserLevel.ADVANCED) {
      return targetUser.level === UserLevel.STANDARD;
    }
    return false;
  };

  const visibleUsers = useMemo(() => {
    let filtered = users.filter(u => {
      if (currentUser.level === UserLevel.ADMIN) return true;
      if (currentUser.level === UserLevel.ADVANCED) {
        return u.level !== UserLevel.ADMIN;
      }
      return false;
    });

    if (userSearch.trim()) {
      const searchTerms = normalizeText(userSearch).split(/\s+/).filter(t => t.length > 0);
      filtered = filtered.filter(u => {
        const userText = normalizeText(`${u.name} ${u.matricula} ${u.level}`);
        return searchTerms.every(term => userText.includes(term));
      });
    }

    return filtered.sort((a, b) => {
      if (a.id === currentUser.id) return -1;
      if (b.id === currentUser.id) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [users, currentUser, userSearch]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);

    const password = selectedUser ? selectedUser.password : undefined;

    // Use state values (formName, formMatricula) to ensure we capture edits or autofills
    const newUser: User = {
      id: selectedUser ? selectedUser.id : Math.random().toString(36).substr(2, 9),
      matricula: formMatricula,
      name: formName,
      email: formEmail || `${formMatricula}@sistema.local`,
      password: password,
      level: formLevel,
      campus_id: formLevel === UserLevel.ADMIN ? undefined : (selectedCampusId || undefined),
      setor_id: formLevel === UserLevel.ADMIN ? undefined : (selectedSetorId || undefined),
      permissions: permissions,
      logs: selectedUser ? selectedUser.logs : [],
      access_logs: selectedUser ? selectedUser.access_logs : [],
    };

    try {
      await StorageService.saveUser(newUser as User, userString);
      onUpdate();
      setShowEditModal(false);
      setSelectedUser(null);
      if (!selectedUser) alert(`Usuário criado com senha padrão '${DEFAULT_PASSWORD}'.`);
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (confirm(`Deseja resetar a senha do usuário ${selectedUser.name} para '${DEFAULT_PASSWORD}'?`)) {
      setIsLoading(true);
      const updatedUser = { ...selectedUser, password: DEFAULT_PASSWORD };
      await StorageService.saveUser(updatedUser, `${userString} (Reset de Senha)`);
      onUpdate();
      alert(`Senha resetada com sucesso para: ${DEFAULT_PASSWORD}`);
      setShowEditModal(false);
      setSelectedUser(null);
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    if (!canManageUser(user)) {
      alert("Você não tem permissão para excluir este usuário.");
      return;
    }

    if (user.id === currentUser.id) {
      if (!confirm('ATENÇÃO: Você está prestes a excluir SEU PRÓPRIO usuário. Você perderá o acesso imediatamente. Deseja continuar?')) {
        return;
      }
    } else {
      if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    }

    await StorageService.deleteUser(user.id);
    onUpdate();
    setShowDetailModal(false);
    setSelectedUser(null);

    if (user.id === currentUser.id) {
      window.location.reload();
    }
  };

  const handleRowClick = (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const openEditModal = (e: React.MouseEvent, user: User | null) => {
    e.stopPropagation();
    setSelectedUser(user);
    // Init form state
    if (user) {
      setFormName(user.name);
      setFormMatricula(user.matricula);
      setFormEmail(user.email || '');
      setSelectedPerson(null);
      setPermissions({
        achados: user.permissions?.achados ?? (user.level !== UserLevel.STANDARD),
        armarios: user.permissions?.armarios ?? (user.level !== UserLevel.STANDARD),
        livros: user.permissions?.livros ?? (user.level !== UserLevel.STANDARD),
        nadaconsta: user.permissions?.nadaconsta ?? true,
        pessoas: user.permissions?.pessoas ?? (user.level !== UserLevel.STANDARD),
        usuarios: user.permissions?.usuarios ?? (user.level !== UserLevel.STANDARD),
        materiais: user.permissions?.materiais ?? (user.level !== UserLevel.STANDARD),
        copias: user.permissions?.copias ?? false,
        insumos: user.permissions?.insumos ?? false,
        notificacoes: user.permissions?.notificacoes ?? false,
        frequencia: user.permissions?.frequencia ?? false,
      });
      setFormLevel(user.level);
      setSelectedCampusId(user.campus_id || '');
      setSelectedSetorId(user.setor_id || '');
    } else {
      setFormName('');
      setFormMatricula('');
      setFormEmail('');
      setSelectedPerson(null);
      // Pre-select current user's campus if they are ADVANCED
      setFormLevel(UserLevel.STANDARD);
      setSelectedCampusId(currentUser.level === UserLevel.ADVANCED ? (currentUser.campus_id || '') : '');
      setSelectedSetorId('');
      setPermissions({
        achados: false,
        armarios: false,
        livros: false,
        nadaconsta: true,
        pessoas: false,
        usuarios: false,
        materiais: false,
        copias: false,
        insumos: false,
        notificacoes: false,
        frequencia: false,
      });
    }
    setPersonSearch('');
    setSearchResultsPeople([]); // Clear search results when opening modal
    setShowEditModal(true);
  };

  const selectPerson = (p: Person) => {
    setSelectedPerson(p);
    setFormName(p.name);
    setFormMatricula(p.matricula);
    setPersonSearch('');
    setSearchResultsPeople([]); // Clear search results after selection
  };

  const handleSyncEmails = async () => {
    setIsLoadingPreview(true);
    try {
      const items = await StorageService.previewUserEmailSync();
      if (items.length === 0) {
        alert('Nenhum usuário com e-mail @sistema.local encontrado para sincronizar.');
        return;
      }
      setSyncItems(items);
      setSelectedSyncIds(new Set(items.map(i => i.userId)));
      setShowSyncModal(true);
    } catch (e) {
      alert('Erro ao buscar preview: ' + (e as Error).message);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleToggleSyncItem = (userId: string) => {
    setSelectedSyncIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleToggleAllSync = () => {
    if (selectedSyncIds.size === syncItems.length) {
      setSelectedSyncIds(new Set());
    } else {
      setSelectedSyncIds(new Set(syncItems.map(i => i.userId)));
    }
  };

  const handleConfirmSync = async () => {
    const itemsToApply = syncItems
      .filter(i => selectedSyncIds.has(i.userId))
      .map(i => ({ userId: i.userId, proposedEmail: i.proposedEmail }));

    if (itemsToApply.length === 0) {
      alert('Nenhum e-mail selecionado para atualizar.');
      return;
    }

    setIsSyncingEmails(true);
    try {
      const result = await StorageService.applyEmailSync(itemsToApply);
      alert(`Concluído!\n\nE-mails atualizados: ${result.updated}\nErros: ${result.errors}`);
      setShowSyncModal(false);
      setSyncItems([]);
      setSelectedSyncIds(new Set());
      onUpdate();
    } catch (e) {
      alert('Erro ao sincronizar: ' + (e as Error).message);
    } finally {
      setIsSyncingEmails(false);
    }
  };

  const clearSelection = () => {
    setSelectedPerson(null);
    setFormName('');
    setFormMatricula('');
    setPersonSearch('');
    setSearchResultsPeople([]); // Clear search results when clearing selection
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3 flex-1">
          <Shield className="text-amber-600 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-amber-800 text-sm">Controle de Acesso</h4>
            <p className="text-amber-700 text-xs mt-1">
              {currentUser.level === UserLevel.ADMIN
                ? "Acesso Total: Pode criar e editar todos os níveis."
                : "Acesso Avançado: Pode criar Padrão e Avançado. Edita Padrão e seu Próprio Perfil."}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full md:w-auto">
          <div className="relative flex-1">
            <input
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ifrn-green transition-all"
              placeholder="Pesquisar usuários..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          </div>

          {(currentUser.level === UserLevel.ADMIN || currentUser.level === UserLevel.ADVANCED) && (
            <button
              onClick={(e) => openEditModal(e, null)}
              className="flex items-center gap-2 px-4 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen transition-colors text-sm whitespace-nowrap"
            >
              <Plus size={18} /> Novo Usuário
            </button>
          )}
          {currentUser.level === UserLevel.ADMIN && (
            <button
              onClick={handleSyncEmails}
              disabled={isSyncingEmails || isLoadingPreview}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm whitespace-nowrap disabled:opacity-50"
            >
              {isLoadingPreview ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />} Sincronizar E-mails
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
              <tr>
                <th className="p-4 whitespace-nowrap">Matrícula (Login)</th>
                <th className="p-4 whitespace-nowrap">Nome</th>
                {currentUser.level === UserLevel.ADMIN && <th className="p-4 whitespace-nowrap">Câmpus</th>}
                {currentUser.level === UserLevel.ADMIN && <th className="p-4 whitespace-nowrap">Setor</th>}
                <th className="p-4 whitespace-nowrap">Nível de Acesso</th>
                <th className="p-4 whitespace-nowrap text-center">Módulos Liberados</th>
                <th className="p-4 text-center whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleUsers.map(u => (
                <tr
                  key={u.id}
                  className={`hover:bg-gray-50 cursor-pointer ${u.id === currentUser.id ? 'bg-blue-50/50' : ''}`}
                  onClick={() => handleRowClick(u)}
                  title="Clique para ver detalhes"
                >
                  <td className="p-4 font-mono text-ifrn-green font-bold whitespace-nowrap">{u.matricula}</td>
                  <td className="p-4 font-medium flex items-center gap-2 whitespace-nowrap">
                    {u.id === currentUser.id && <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">Você</span>}
                    {u.name}
                  </td>
                  {currentUser.level === UserLevel.ADMIN && (
                    <td className="p-4 whitespace-nowrap">
                      <span className="text-xs text-gray-500 font-medium">
                        {u.level === UserLevel.ADMIN ? 'Todos' : (campuses.find(c => c.id === u.campus_id)?.name || 'Sem Câmpus')}
                      </span>
                    </td>
                  )}
                  {currentUser.level === UserLevel.ADMIN && (
                    <td className="p-4 whitespace-nowrap">
                      <span className="text-xs text-gray-500 font-medium">
                        {u.level === UserLevel.ADMIN ? '-' : (setores.find(s => s.id === u.setor_id)?.name || 'Sem setor')}
                      </span>
                    </td>
                  )}
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.level === UserLevel.ADMIN ? 'bg-red-100 text-red-800' :
                      u.level === UserLevel.ADVANCED ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                      {u.level}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex justify-center gap-1.5">
                      {[
                        { id: 'achados', icon: <Package size={14} />, label: 'Achados' },
                        { id: 'armarios', icon: <Key size={14} />, label: 'Armários' },
                        { id: 'livros', icon: <BookOpen size={14} />, label: 'Livros' },
                        { id: 'nadaconsta', icon: <FileCheck size={14} />, label: 'Nada Consta' },
                        { id: 'materiais', icon: <FileText size={14} />, label: 'Materiais' },
                        { id: 'copias', icon: <Printer size={14} />, label: 'Cópias' },
                        { id: 'insumos', icon: <Truck size={14} />, label: 'Insumos' },
                        { id: 'notificacoes', icon: <ShieldAlert size={14} />, label: 'Notificações' },
                        { id: 'frequencia', icon: <ClipboardList size={14} />, label: 'Frequência' },
                        { id: 'pessoas', icon: <UserIcon size={14} />, label: 'Pessoas' },
                        { id: 'usuarios', icon: <UserCog size={14} />, label: 'Usuários' }
                      ].filter(mod => {
                        // Check if current user has access to this module
                        if (currentUser.level === UserLevel.ADMIN) return true;

                        const perm = currentUser.permissions?.[mod.id as keyof typeof currentUser.permissions];
                        if (perm !== undefined) return perm;

                        if (mod.id === 'nadaconsta') return true;
                        if (mod.id === 'copias' || mod.id === 'insumos' || mod.id === 'notificacoes' || mod.id === 'frequencia') return false;

                        return (currentUser.level !== UserLevel.STANDARD);
                      }).map(mod => {
                        // For modules logic
                        const hasAccess = u.level === UserLevel.ADMIN || (u.permissions && u.permissions[mod.id as keyof typeof u.permissions] !== undefined
                          ? u.permissions[mod.id as keyof typeof u.permissions]
                          : (mod.id === 'nadaconsta' || (mod.id !== 'copias' && mod.id !== 'insumos' && mod.id !== 'notificacoes' && mod.id !== 'frequencia' && u.level !== UserLevel.STANDARD)));

                        return (
                          <div
                            key={mod.id}
                            title={`${mod.label}: ${hasAccess ? 'Liberado' : 'Inativo'}`}
                            className={`p-1.5 rounded-lg transition-all shadow-sm border ${hasAccess
                              ? 'text-green-600 bg-green-50 border-green-100'
                              : 'text-gray-300 bg-gray-50 border-gray-100 opacity-60'
                              }`}
                          >
                            {mod.icon}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex justify-center gap-2">
                      {canManageUser(u) && (
                        <>
                          <button
                            onClick={(e) => openEditModal(e, u)}
                            className="text-gray-400 hover:text-blue-600 p-1.5 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, u)}
                            className="text-gray-400 hover:text-red-500 p-1.5 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={selectedUser ? 'Editar Usuário' : 'Novo Usuário'}>
        <div className="space-y-4">

          {/* SEARCH COMPONENT (Identical Style to LostReportsTab) */}
          <div className="relative space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Quem é o usuário?</label>

            {selectedPerson ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3 animate-fadeIn">
                <div className="bg-green-100 p-2 rounded-full text-green-700">
                  <UserIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-green-900 text-sm truncate">{selectedPerson.name}</p>
                  <p className="text-xs text-green-700 truncate">{selectedPerson.matricula} • {selectedPerson.type}</p>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs text-red-500 hover:underline hover:text-red-700 font-medium whitespace-nowrap"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  className="w-full border rounded-lg p-2.5 pl-10 text-sm outline-none focus:ring-2 focus:ring-ifrn-green"
                  placeholder="Busque por Nome ou Matrícula..."
                  value={personSearch}
                  onChange={e => handlePersonSearch(e.target.value)}
                />
                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                {isSearchingPeople && (
                  <div className="absolute right-3 top-2.5">
                    <Loader2 size={16} className="animate-spin text-ifrn-green" />
                  </div>
                )}

                {searchResultsPeople.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {searchResultsPeople.map(p => (
                      <div key={p.matricula} onClick={() => selectPerson(p)} className="p-3 hover:bg-gray-50 cursor-pointer text-sm group">
                        <div className="font-bold text-gray-800 group-hover:text-ifrn-green">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.matricula} • {p.type}</div>
                      </div>
                    ))}
                  </div>
                )}
                {personSearch.length > 1 && !isSearchingPeople && searchResultsPeople.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-sm p-3 text-center">
                    <p className="text-xs text-gray-400 italic">Nenhuma pessoa encontrada.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <input
                name="name"
                required
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                placeholder="Preenchido automaticamente..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula (Login)</label>
              <input
                name="matricula"
                required
                value={formMatricula}
                onChange={e => setFormMatricula(e.target.value)}
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                placeholder="Preenchido automaticamente..."
              />
            </div>

            {currentUser.level === UserLevel.ADMIN && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                  placeholder="exemplo@email.com"
                />
              </div>
            )}

            {!selectedUser && (<p className="text-xs text-gray-500 bg-gray-50 p-2 rounded"><span className="font-bold">Nota:</span> A senha inicial será definida automaticamente como <strong>{DEFAULT_PASSWORD}</strong>.</p>)}

            {currentUser.level === UserLevel.ADMIN && formLevel !== UserLevel.ADMIN && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Câmpus <span className="text-red-500">*</span></label>
                <select
                  value={selectedCampusId}
                  onChange={e => setSelectedCampusId(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-ifrn-green outline-none"
                  required
                >
                  <option value="">Selecione um Câmpus...</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {currentUser.level === UserLevel.ADMIN && formLevel !== UserLevel.ADMIN && selectedCampusId && setores.filter(s => s.campus_id === selectedCampusId).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
                <select
                  value={selectedSetorId}
                  onChange={e => setSelectedSetorId(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-ifrn-green outline-none"
                >
                  <option value="">Sem setor definido</option>
                  {setores.filter(s => s.campus_id === selectedCampusId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}


            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Acesso</label>
              <select
                name="level"
                value={formLevel}
                disabled={(selectedUser?.id === currentUser.id && currentUser.level !== UserLevel.ADMIN) || selectedUser?.id === currentUser.id}
                className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-ifrn-green outline-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                onChange={(e) => {
                  const val = e.target.value as UserLevel;
                  setFormLevel(val);
                  if (val !== UserLevel.STANDARD) {
                    setPermissions({
                      achados: true,
                      armarios: true,
                      livros: true,
                      nadaconsta: true,
                      pessoas: true,
                      usuarios: true,
                      materiais: true,
                      copias: val === UserLevel.ADMIN,
                      insumos: val === UserLevel.ADMIN,
                      notificacoes: val === UserLevel.ADMIN,
                      frequencia: val === UserLevel.ADMIN
                    });
                  }
                  if (val === UserLevel.ADMIN) {
                    setSelectedCampusId('');
                  }
                }}
              >
                <option value={UserLevel.STANDARD}>Padrão</option>
                <option value={UserLevel.ADVANCED}>Avançado</option>
                {currentUser.level === UserLevel.ADMIN && (<option value={UserLevel.ADMIN}>Administrador</option>)}
              </select>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-3">Módulos Liberados</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'achados', label: 'Achados' },
                  { id: 'armarios', label: 'Armários' },
                  { id: 'livros', label: 'Livros' },
                  { id: 'nadaconsta', label: 'Nada Consta' },
                  { id: 'materiais', label: 'Materiais' },
                  { id: 'copias', label: 'Cópias' },
                  { id: 'insumos', label: 'Insumos' },
                  { id: 'notificacoes', label: 'Notificações' },
                  { id: 'frequencia', label: 'Frequência' },
                  { id: 'pessoas', label: 'Pessoas' },
                  { id: 'usuarios', label: 'Usuários' }
                ].filter(mod => {
                  // Insumos, Copias and Notificacoes visible for Admin or those with explicit permission
                  if (mod.id === 'insumos' || mod.id === 'copias' || mod.id === 'notificacoes' || mod.id === 'frequencia') {
                    if (currentUser.level === UserLevel.ADMIN) return true;
                    return !!currentUser.permissions?.[mod.id as keyof typeof currentUser.permissions];
                  }
                  
                  const perm = currentUser.permissions?.[mod.id as keyof typeof currentUser.permissions];
                  if (perm !== undefined) return perm;
                  if (mod.id === 'nadaconsta') return true;
                  return (currentUser.level !== UserLevel.STANDARD);
                }).map(module => {
                  const isActive = permissions[module.id as keyof typeof permissions] || formLevel === UserLevel.ADMIN;
                  return (
                    <button
                      key={module.id}
                      type="button"
                      disabled={selectedUser?.id === currentUser.id || ((module.id === 'insumos' || module.id === 'copias' || module.id === 'notificacoes' || module.id === 'frequencia') && currentUser.level !== UserLevel.ADMIN && !currentUser.permissions?.[module.id as keyof typeof currentUser.permissions])}
                      onClick={() => setPermissions(prev => ({ ...prev, [module.id]: !prev[module.id as keyof typeof prev] }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${isActive
                        ? 'bg-green-50 border-green-200 text-green-700 shadow-sm'
                        : 'bg-gray-50 border-gray-100 text-gray-400 opacity-60'
                        } ${selectedUser?.id === currentUser.id || (module.id === 'insumos' && currentUser.level !== UserLevel.ADMIN) ? 'cursor-not-allowed' : ''}`}
                    >
                      <div className={isActive ? 'text-green-600' : 'text-gray-400'}>
                        {module.id === 'achados' ? <Package size={14} /> :
                          module.id === 'armarios' ? <Key size={14} /> :
                            module.id === 'livros' ? <BookOpen size={14} /> :
                              module.id === 'nadaconsta' ? <FileCheck size={14} /> :
                                module.id === 'materiais' ? <FileText size={14} /> :
                                  module.id === 'copias' ? <Printer size={14} /> :
                                    module.id === 'insumos' ? <Truck size={14} /> :
                                      module.id === 'notificacoes' ? <ShieldAlert size={14} /> :
                                        module.id === 'frequencia' ? <ClipboardList size={14} /> :
                                          module.id === 'pessoas' ? <UserIcon size={14} /> :
                                            <UserCog size={14} />}
                      </div>
                      {module.label}
                      {isActive && <CheckCircle size={12} className="ml-auto" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedUser && canResetPassword(selectedUser) && (
              <div className="pt-2 border-t mt-2">
                <label className="block text-xs font-semibold text-gray-500 mb-2">Segurança</label>
                <button type="button" onClick={handleResetPassword} className="w-full py-2 border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm flex items-center justify-center gap-2"><Lock size={14} /> Resetar Senha para '{DEFAULT_PASSWORD}'</button>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-3 border-t mt-4">
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button type="submit" disabled={isLoading} className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-medium flex items-center gap-2">{isLoading ? <Loader2 className="animate-spin" size={18} /> : <><UserCog size={18} /> Salvar Usuário</>}</button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedUser(null); }} title="Detalhes do Usuário">
        {selectedUser && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div><span className="block text-xs font-bold text-gray-400 uppercase">Nome</span><p className="font-bold text-gray-800">{selectedUser.name}</p></div>
              <div><span className="block text-xs font-bold text-gray-400 uppercase">Matrícula</span><p className="font-mono">{selectedUser.matricula}</p></div>
              <div className="col-span-2"><span className="block text-xs font-bold text-gray-400 uppercase">Nível</span><span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold ${selectedUser.level === UserLevel.ADMIN ? 'bg-red-100 text-red-800' : selectedUser.level === UserLevel.ADVANCED ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>{selectedUser.level}</span></div>
              <div className="col-span-2"><span className="block text-xs font-bold text-gray-400 uppercase">Câmpus</span><p className="font-medium text-gray-700">{selectedUser.level === UserLevel.ADMIN ? 'Todos' : (campuses.find(c => c.id === selectedUser.campus_id)?.name || 'Sem Câmpus')}</p></div>
              <div className="col-span-2"><span className="block text-xs font-bold text-gray-400 uppercase">Setor</span><p className="font-medium text-gray-700">{selectedUser.level === UserLevel.ADMIN ? '-' : (setores.find(s => s.id === selectedUser.setor_id)?.name || 'Sem setor')}</p></div>
              {currentUser.level === UserLevel.ADMIN && selectedUser.email && (
                <div className="col-span-2"><span className="block text-xs font-bold text-gray-400 uppercase">E-mail</span><p className="font-medium text-gray-700">{selectedUser.email}</p></div>
              )}
            </div>
            <div>
              <h4 className="flex items-center gap-2 font-bold text-gray-700 mb-3 border-b pb-2"><FileText size={18} /> Log de Auditoria</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto bg-white border rounded-lg p-3">
                {selectedUser.logs && selectedUser.logs.length > 0 ? (
                  selectedUser.logs
                    .slice()
                    .reverse()
                    .map((log, index) => (
                      <div key={index} className="text-xs text-gray-600 border-b border-gray-100 pb-1 mb-1 last:border-0">
                        • {log}
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-gray-400 italic">Nenhum registro de alteração.</p>
                )}
              </div>
            </div>

            {currentUser.level === UserLevel.ADMIN && (
              <div className="mt-4">
                <h4 className="flex items-center gap-2 font-bold text-gray-700 mb-3 border-b pb-2">
                  <History size={18} /> Últimos 10 Acessos
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto bg-white border rounded-lg p-3">
                  {selectedUser.access_logs && selectedUser.access_logs.length > 0 ? (
                    selectedUser.access_logs.map((log, index) => (
                      <div key={index} className="text-xs text-gray-600 border-b border-gray-100 pb-1 mb-1 last:border-0">
                        • {log}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 italic">Nenhum registro de acesso recente.</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-2"><button onClick={() => { setShowDetailModal(false); setSelectedUser(null); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Fechar</button></div>
              </div>
            )}

      </Modal>

      {/* Sync Email Modal */}
      <Modal isOpen={showSyncModal} onClose={() => { setShowSyncModal(false); setSyncItems([]); setSelectedSyncIds(new Set()); }} title="Sincronizar E-mails">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-medium">E-mails reais encontrados na tabela de pessoas para vincular aos usuários.</p>
            <p className="text-xs mt-1 text-blue-500">Desmarque os que não deseja atualizar.</p>
          </div>

          <div className="flex items-center gap-2 pb-2 border-b">
            <button onClick={handleToggleAllSync} className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-ifrn-green transition-colors">
              {selectedSyncIds.size === syncItems.length ? <CheckSquare size={18} className="text-ifrn-green" /> : <Square size={18} className="text-gray-400" />}
              {selectedSyncIds.size === syncItems.length ? 'Desmarcar Todos' : 'Marcar Todos'}
            </button>
            <span className="text-xs text-gray-400 ml-auto">{selectedSyncIds.size} de {syncItems.length} selecionados</span>
          </div>

          <div className="max-h-[40vh] overflow-y-auto space-y-2">
            {syncItems.map(item => (
              <div
                key={item.userId}
                onClick={() => handleToggleSyncItem(item.userId)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedSyncIds.has(item.userId)
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex-shrink-0">
                  {selectedSyncIds.has(item.userId) ? <CheckSquare size={18} className="text-ifrn-green" /> : <Square size={18} className="text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-800">{item.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{item.matricula}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="text-red-500 line-through">{item.currentEmail}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-green-600 font-medium">{item.proposedEmail}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button
              onClick={() => { setShowSyncModal(false); setSyncItems([]); setSelectedSyncIds(new Set()); }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmSync}
              disabled={isSyncingEmails || selectedSyncIds.size === 0}
              className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-medium flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {isSyncingEmails ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Confirmar ({selectedSyncIds.size})
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};