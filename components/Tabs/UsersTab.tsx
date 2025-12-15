import React from 'react';
import { User, UserLevel } from '../../types';
import { Shield } from 'lucide-react';

interface Props {
  users: User[];
}

export const UsersTab: React.FC<Props> = ({ users }) => {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
        <Shield className="text-amber-600 mt-0.5" size={20} />
        <div>
          <h4 className="font-bold text-amber-800 text-sm">Área Restrita</h4>
          <p className="text-amber-700 text-xs mt-1">Apenas administradores podem visualizar e gerenciar usuários do sistema.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
            <tr>
              <th className="p-4">Matrícula (Login)</th>
              <th className="p-4">Nome</th>
              <th className="p-4">Nível de Acesso</th>
              <th className="p-4">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(user => (
              <tr key={user.id}>
                <td className="p-4 font-mono">{user.matricula}</td>
                <td className="p-4 font-medium">{user.name}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    user.level === UserLevel.ADMIN ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.level}
                  </span>
                </td>
                <td className="p-4 text-gray-400 italic">Gerenciar</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Mock Audit Log UI */}
      <div className="bg-white p-4 rounded-xl border border-gray-100">
        <h3 className="font-bold text-gray-700 mb-4 text-sm">Log de Auditoria Recente</h3>
        <div className="space-y-2 text-xs text-gray-500">
          <p>• {new Date().toLocaleString()} - Admin alterou configurações do sistema.</p>
          <p>• {new Date(Date.now() - 3600000).toLocaleString()} - Operador Padrão registrou item #1003.</p>
        </div>
      </div>
    </div>
  );
};