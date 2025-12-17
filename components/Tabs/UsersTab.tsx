import React, { useState, useMemo, useEffect } from 'react';
import { User, UserLevel, Person } from '../../types';
import { StorageService } from '../../services/storage';
import { Shield, Plus, Pencil, Trash2, UserCog, Lock, FileText, Loader2, Search, User as UserIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
  users: User[];
  currentUser: User;
  onUpdate: () => void;
  people: Person[];
}

export const UsersTab: React.FC<Props> = ({ users, currentUser, onUpdate, people }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form States
  const [formName, setFormName] = useState('');
  const [formMatricula, setFormMatricula] = useState('');
  
  // Search States (Same as LostReportsTab)
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const userString = `${currentUser.name} (${currentUser.matricula})`;

  const normalizeText = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const filteredPeople = useMemo(() => {
    if (!personSearch.trim()) return [];
    
    const searchTerms = normalizeText(personSearch).split(/\s+/).filter(t => t.length > 0);

    return people.filter(p => {
      const personText = normalizeText(`${p.name} ${p.matricula}`);
      return searchTerms.every(term => personText.includes(term));
    }).slice(0, 5); 
  }, [people, personSearch]);

  const canManageUser = (targetUser: User) => {
    if (currentUser.id === targetUser.id) return true;
    if (currentUser.level === UserLevel.ADMIN) return true;
    if (currentUser.level === UserLevel.ADVANCED) {
      return targetUser.level === UserLevel.STANDARD;
    }
    return false;
  };

  const visibleUsers = useMemo(() => {
    const filtered = users.filter(u => {
      if (currentUser.level === UserLevel.ADMIN) return true;
      if (currentUser.level === UserLevel.ADVANCED) {
        return u.level !== UserLevel.ADMIN;
      }
      return false;
    });

    return filtered.sort((a, b) => {
      if (a.id === currentUser.id) return -1;
      if (b.id === currentUser.id) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [users, currentUser]);

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
      password: password, 
      level: formData.get('level') as UserLevel,
      logs: selectedUser ? selectedUser.logs : [],
    };

    try {
      await StorageService.saveUser(newUser as User, userString);
      onUpdate();
      setShowEditModal(false);
      setSelectedUser(null);
      if(!selectedUser) alert("Usuário criado com senha padrão 'ifrn123'.");
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (confirm(`Deseja resetar a senha do usuário ${selectedUser.name} para 'ifrn123'?`)) {
       setIsLoading(true);
       const updatedUser = { ...selectedUser, password: 'ifrn123' };
       await StorageService.saveUser(updatedUser, `${userString} (Reset de Senha)`);
       onUpdate();
       alert('Senha resetada com sucesso para: ifrn123');
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
        setSelectedPerson(null); // Reset person link on edit to avoid confusion unless we match perfectly
    } else {
        setFormName('');
        setFormMatricula('');
        setSelectedPerson(null);
    }
    setPersonSearch('');
    setShowEditModal(true);
  };

  const selectPerson = (p: Person) => {
      setSelectedPerson(p);
      setFormName(p.name);
      setFormMatricula(p.matricula);
      setPersonSearch('');
  };

  const clearSelection = () => {
      setSelectedPerson(null);
      setFormName('');
      setFormMatricula('');
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
        
        {(currentUser.level === UserLevel.ADMIN || currentUser.level === UserLevel.ADVANCED) && (
          <button 
            onClick={(e) => openEditModal(e, null)}
            className="flex items-center gap-2 px-4 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen transition-colors text-sm whitespace-nowrap"
          >
            <Plus size={18} /> Novo Usuário
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
              <tr>
                <th className="p-4 whitespace-nowrap">Matrícula (Login)</th>
                <th className="p-4 whitespace-nowrap">Nome</th>
                <th className="p-4 whitespace-nowrap">Nível de Acesso</th>
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
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      u.level === UserLevel.ADMIN ? 'bg-red-100 text-red-800' : 
                      u.level === UserLevel.ADVANCED ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {u.level}
                    </span>
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
                  onChange={e => setPersonSearch(e.target.value)}
                />
                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                
                {filteredPeople.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {filteredPeople.map(p => (
                      <div key={p.id} onClick={() => selectPerson(p)} className="p-3 hover:bg-gray-50 cursor-pointer text-sm group">
                        <div className="font-bold text-gray-800 group-hover:text-ifrn-green">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.matricula} • {p.type}</div>
                      </div>
                    ))}
                  </div>
                )}
                {personSearch.length > 1 && filteredPeople.length === 0 && (
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
            
            {!selectedUser && (<p className="text-xs text-gray-500 bg-gray-50 p-2 rounded"><span className="font-bold">Nota:</span> A senha inicial será definida automaticamente como <strong>ifrn123</strong>.</p>)}
            
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Acesso</label>
                <select name="level" defaultValue={selectedUser?.level || UserLevel.STANDARD} disabled={selectedUser?.id === currentUser.id && currentUser.level !== UserLevel.ADMIN} className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-ifrn-green outline-none disabled:bg-gray-100 disabled:text-gray-500"><option value={UserLevel.STANDARD}>Padrão (Apenas consulta e registro básico)</option><option value={UserLevel.ADVANCED}>Avançado (Gestão de Itens e Usuários Padrão)</option>{currentUser.level === UserLevel.ADMIN && (<option value={UserLevel.ADMIN}>Administrador (Acesso Total)</option>)}</select>
            </div>
            
            {selectedUser && canManageUser(selectedUser) && (
                <div className="pt-2 border-t mt-2">
                <label className="block text-xs font-semibold text-gray-500 mb-2">Segurança</label>
                <button type="button" onClick={handleResetPassword} className="w-full py-2 border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm flex items-center justify-center gap-2"><Lock size={14} /> Resetar Senha para 'ifrn123'</button>
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
            </div>
            <div>
              <h4 className="flex items-center gap-2 font-bold text-gray-700 mb-3 border-b pb-2"><FileText size={18} /> Log de Auditoria</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto bg-white border rounded-lg p-3">{selectedUser.logs && selectedUser.logs.length > 0 ? (selectedUser.logs.slice().reverse().map((log, index) => (<div key={index} className="text-xs text-gray-600 border-b border-gray-100 pb-1 mb-1 last:border-0">• {log}</div>))) : (<p className="text-xs text-gray-400 italic">Nenhum registro de alteração.</p>)}</div>
            </div>
            <div className="flex justify-end pt-2"><button onClick={() => { setShowDetailModal(false); setSelectedUser(null); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Fechar</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
};