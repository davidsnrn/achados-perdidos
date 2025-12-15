import React, { useState } from 'react';
import { Person, PersonType } from '../../types';
import { StorageService } from '../../services/storage';
import { Upload, UserPlus } from 'lucide-react';

interface Props {
  people: Person[];
  onUpdate: () => void;
}

export const PeopleTab: React.FC<Props> = ({ people, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [filterType, setFilterType] = useState<PersonType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [matricula, setMatricula] = useState('');
  const [type, setType] = useState<PersonType>(PersonType.STUDENT);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      StorageService.savePerson({
        id: Math.random().toString(36).substr(2, 9),
        name,
        matricula,
        type
      });
      setName('');
      setMatricula('');
      onUpdate();
      alert('Pessoa cadastrada!');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleImport = () => {
    // Simulation of CSV processing
    alert('Simulação: Lendo CSV e importando dados...');
    const mockImport: Person[] = [
      { id: 'i1', name: 'Importado Silva', matricula: '2024001', type: PersonType.STUDENT },
      { id: 'i2', name: 'Importado Souza', matricula: '2024002', type: PersonType.STUDENT },
    ];
    StorageService.importPeople(mockImport);
    onUpdate();
    alert('2 pessoas importadas com sucesso.');
  };

  const filtered = people.filter(p => {
    const matchesType = filterType === 'ALL' || p.type === filterType;
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.matricula.includes(search);
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('manual')}
          className={`pb-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'manual' ? 'border-ifrn-green text-ifrn-green' : 'border-transparent text-gray-500'}`}
        >
          Cadastro Manual
        </button>
        <button 
          onClick={() => setActiveTab('import')}
          className={`pb-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'import' ? 'border-ifrn-green text-ifrn-green' : 'border-transparent text-gray-500'}`}
        >
          Importar CSV
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        {activeTab === 'manual' ? (
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nome Completo</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm" placeholder="Nome..." />
            </div>
            <div className="w-full md:w-48">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Matrícula</label>
              <input required value={matricula} onChange={e => setMatricula(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm" placeholder="202..." />
            </div>
            <div className="w-full md:w-40">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Vínculo</label>
              <select value={type} onChange={e => setType(e.target.value as PersonType)} className="w-full border rounded-lg p-2.5 text-sm bg-white">
                <option value={PersonType.STUDENT}>Aluno</option>
                <option value={PersonType.SERVER}>Servidor</option>
                <option value={PersonType.EXTERNAL}>Externo</option>
              </select>
            </div>
            <button type="submit" className="w-full md:w-auto px-6 py-2.5 bg-ifrn-darkGreen text-white rounded-lg hover:bg-emerald-900 flex items-center justify-center gap-2">
              <UserPlus size={18} /> Salvar
            </button>
          </form>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Upload className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 mb-4">Selecione um arquivo .csv com as colunas: Nome, Matrícula, Tipo</p>
            <button onClick={handleImport} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
              Selecionar Arquivo
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-700">Pessoas Cadastradas ({filtered.length})</h3>
          <div className="flex gap-2">
            <select 
              className="text-sm border rounded-lg px-2 py-1"
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
            >
              <option value="ALL">Todos</option>
              {Object.values(PersonType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input 
              className="text-sm border rounded-lg px-3 py-1 w-48" 
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
              <tr>
                <th className="p-3">Matrícula</th>
                <th className="p-3">Nome</th>
                <th className="p-3">Vínculo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, 50).map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="p-3 font-mono text-gray-600">{p.matricula}</td>
                  <td className="p-3 font-medium text-gray-900">{p.name}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${p.type === PersonType.STUDENT ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                      {p.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 50 && <div className="p-3 text-center text-xs text-gray-500">Exibindo 50 de {filtered.length} registros.</div>}
        </div>
      </div>
    </div>
  );
};