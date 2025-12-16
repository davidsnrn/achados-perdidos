import React, { useState, useMemo } from 'react';
import { User, UserLevel } from '../../types';
import { StorageService } from '../../services/storage';
import { Shield, Plus, Pencil, Trash2, UserCog, Lock, FileText } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
  users: User[];
  currentUser: User;
  onUpdate: () => void;
}

export const UsersTab: React.FC<Props> = ({ users, currentUser, onUpdate }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Helper: Verifica se o usuário atual tem permissão para EDITAR/EXCLUIR o alvo
  const canManageUser = (targetUser: User) => {
    // REGRA: Usuário pode editar seu próprio perfil (Admin e Avançado)
    if (currentUser.id === targetUser.id) return true;
    
    if (currentUser.level === UserLevel.ADMIN) return true; // Admin pode gerenciar todos
    
    if (currentUser.level === UserLevel.ADVANCED) {
      // Avançado só pode editar/excluir PADRÃO. 
      // Não pode editar outro Avançado (mesmo nível).
      return targetUser.level === UserLevel.STANDARD;
    }
    
    return false;
  };

  // Filtra e Ordena os usuários visíveis na tabela
  const visibleUsers = useMemo(() => {
    // 1. Filtragem de Visibilidade
    const filtered = users.filter(u => {
      // Admin vê tudo
      if (currentUser.level === UserLevel.ADMIN) return true;
      
      // Avançado vê Padrão e Avançado (incluindo ele mesmo), mas NÃO vê Admin
      if (currentUser.level === UserLevel.ADVANCED) {
        return u.level !== UserLevel.ADMIN;
      }
      
      return false;
    });

    // 2. Ordenação: Usuário atual primeiro, depois A-Z
    return filtered.sort((a, b) => {
      if (a.id === currentUser.id) return -1; // Usuário atual sobe
      if (b.id === currentUser.id) return 1;
      return a.name.localeCompare(b.name); // Ordem alfabética
    });
  }, [users, currentUser]);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Se estiver editando, manter a senha antiga.
    // Se for novo, o StorageService define a senha padrão 'ifrn123'.
    const password = selectedUser ? selectedUser.password : undefined; 

    const newUser: User = {
      id: selectedUser ? selectedUser.id : Math.random().toString(36).substr(2, 9),
      matricula: formData.get('matricula') as string,
      name: formData.get('name') as string,
      password: password, 
      level: formData.get('level') as UserLevel,
      logs: selectedUser ? selectedUser.logs : [], // Preserva logs antigos
    };

    try {
      StorageService.saveUser(newUser as User, currentUser.name);
      onUpdate();
      setShowEditModal(false);
      setSelectedUser(null);
      if(!selectedUser) alert("Usuário criado com senha padrão 'ifrn123'.");
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handleResetPassword = () => {
    if (!selectedUser) return;
    if (confirm(`Deseja resetar a senha do usuário ${selectedUser.name} para 'ifrn123'?`)) {
       const updatedUser = { ...selectedUser, password: 'ifrn123' };
       StorageService.saveUser(updatedUser, `${currentUser.name} (Reset de Senha)`);
       onUpdate();
       alert('Senha resetada com sucesso para: ifrn123');
       setShowEditModal(false);
       setSelectedUser(null);
    }
  };

  const handleDelete = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    if (!canManageUser(user)) {
       alert("Você não tem permissão para excluir este usuário.");
       return;
    }
    
    // Impede excluir a si mesmo acidentalmente (melhor UX)
    if (user.id === currentUser.id) {
        if (!confirm('ATENÇÃO: Você está prestes a excluir SEU PRÓPRIO usuário. Você perderá o acesso imediatamente. Deseja continuar?')) {
            return;
        }
    } else {
        if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    }

    StorageService.deleteUser(user.id);
    onUpdate();
    setShowDetailModal(false);
    setSelectedUser(null);
    
    // Se excluiu a si mesmo, recarrega a página para logout
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
    setShowEditModal(true);
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
        
        {/* Botão Novo Usuário: Admin ou Avançado */}
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
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
            <tr>
              <th className="p-4">Matrícula (Login)</th>
              <th className="p-4">Nome</th>
              <th className="p-4">Nível de Acesso</th>
              <th className="p-4 text-center">Ações</th>
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
                <td className="p-4 font-mono text-ifrn-green font-bold">{u.matricula}</td>
                <td className="p-4 font-medium flex items-center gap-2">
                   {u.id === currentUser.id && <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">Você</span>}
                   {u.name}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    u.level === UserLevel.ADMIN ? 'bg-red-100 text-red-800' : 
                    u.level === UserLevel.ADVANCED ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {u.level}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex justify-center gap-2">
                     {/* Botão de Olho Removido conforme solicitado */}
                     
                     {/* Botões de Ação */}
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

      {/* Modal: Novo / Editar */}
      <Modal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)} 
        title={selectedUser ? 'Editar Usuário' : 'Novo Usuário'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
            <input 
              name="name" 
              required 
              defaultValue={selectedUser?.name} 
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" 
              placeholder="Nome do servidor..." 
            />
          </div>
          
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula (Login)</label>
              <input 
                name="matricula" 
                required 
                defaultValue={selectedUser?.matricula} 
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" 
              />
          </div>

          {!selectedUser && (
             <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
               <span className="font-bold">Nota:</span> A senha inicial será definida automaticamente como <strong>ifrn123</strong>.
             </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Acesso</label>
            <select 
              name="level" 
              defaultValue={selectedUser?.level || UserLevel.STANDARD}
              // Bloqueia a alteração do próprio nível para evitar trancar-se fora (opcional, mas recomendado)
              // Se for admin, pode tudo.
              disabled={selectedUser?.id === currentUser.id && currentUser.level !== UserLevel.ADMIN}
              className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-ifrn-green outline-none disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value={UserLevel.STANDARD}>Padrão (Apenas consulta e registro básico)</option>
              {/* Avançado e Admin podem criar Avançado */}
              <option value={UserLevel.ADVANCED}>Avançado (Gestão de Itens e Usuários Padrão)</option>
              {/* Apenas Admin pode criar Admin */}
              {currentUser.level === UserLevel.ADMIN && (
                <option value={UserLevel.ADMIN}>Administrador (Acesso Total)</option>
              )}
            </select>
            {selectedUser?.id === currentUser.id && currentUser.level !== UserLevel.ADMIN && (
              <p className="text-[10px] text-gray-400 mt-1">Você não pode alterar seu próprio nível de acesso.</p>
            )}
          </div>

          {/* Área de Reset de Senha (Só aparece ao EDITAR e se tiver permissão) */}
          {selectedUser && canManageUser(selectedUser) && (
            <div className="pt-2 border-t mt-2">
              <label className="block text-xs font-semibold text-gray-500 mb-2">Segurança</label>
              <button 
                type="button" 
                onClick={handleResetPassword}
                className="w-full py-2 border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm flex items-center justify-center gap-2"
              >
                <Lock size={14} /> Resetar Senha para 'ifrn123'
              </button>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t mt-4">
            <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button type="submit" className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-medium flex items-center gap-2">
              <UserCog size={18} /> Salvar Usuário
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Detalhes e Logs */}
      <Modal 
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedUser(null); }}
        title="Detalhes do Usuário"
      >
        {selectedUser && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg border border-gray-100">
               <div>
                 <span className="block text-xs font-bold text-gray-400 uppercase">Nome</span>
                 <p className="font-bold text-gray-800">{selectedUser.name}</p>
               </div>
               <div>
                 <span className="block text-xs font-bold text-gray-400 uppercase">Matrícula</span>
                 <p className="font-mono">{selectedUser.matricula}</p>
               </div>
               <div className="col-span-2">
                 <span className="block text-xs font-bold text-gray-400 uppercase">Nível</span>
                 <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold ${
                    selectedUser.level === UserLevel.ADMIN ? 'bg-red-100 text-red-800' : 
                    selectedUser.level === UserLevel.ADVANCED ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedUser.level}
                  </span>
               </div>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-bold text-gray-700 mb-3 border-b pb-2">
                <FileText size={18} /> Log de Auditoria
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto bg-white border rounded-lg p-3">
                {selectedUser.logs && selectedUser.logs.length > 0 ? (
                  selectedUser.logs.slice().reverse().map((log, index) => (
                    <div key={index} className="text-xs text-gray-600 border-b border-gray-100 pb-1 mb-1 last:border-0">
                       • {log}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic">Nenhum registro de alteração.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => { setShowDetailModal(false); setSelectedUser(null); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};