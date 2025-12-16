import React, { useState, useRef } from 'react';
import { Person, PersonType, User, UserLevel } from '../../types';
import { StorageService } from '../../services/storage';
import { Upload, UserPlus, Pencil, FileText, X, CheckCircle, HelpCircle, Trash2, ChevronLeft, ChevronRight, UserX, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
  people: Person[];
  onUpdate: () => void;
  user: User;
}

export const PeopleTab: React.FC<Props> = ({ people, onUpdate, user }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [filterType, setFilterType] = useState<PersonType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Manual Form State
  const [name, setName] = useState('');
  const [matricula, setMatricula] = useState('');
  const [type, setType] = useState<PersonType>(PersonType.STUDENT);

  // Import State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  // Delete All State
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  // Helper: Title Case for Names
  const toTitleCase = (str: string) => {
    return str.toLowerCase().split(' ').map((word, index) => {
      // Preposições comuns em nomes brasileiros que devem ficar minúsculas
      const prepositions = ['de', 'da', 'do', 'dos', 'das', 'e'];
      if (index > 0 && prepositions.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  // Helper: Remove accents and lower case for search
  const normalizeText = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  // Helper: Robust CSV Parser (handles quoted newlines)
  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // Toggle quote
          inQuotes = !inQuotes;
        }
      } else if (char === ';' && !inQuotes) {
        // Field separator
        currentRow.push(currentField);
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        // Row separator
        // Handle \r\n
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        
        // Only push if row has content (avoid empty lines)
        if (currentRow.length > 0 || currentField) {
           currentRow.push(currentField);
           rows.push(currentRow);
        }
        
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    
    // Push last row
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    return rows;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      StorageService.savePerson({
        id: Math.random().toString(36).substr(2, 9),
        name: toTitleCase(name),
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

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPerson) return;
    
    const formData = new FormData(e.currentTarget);
    const rawName = formData.get('name') as string;
    
    const updatedPerson: Person = {
      ...editingPerson,
      name: toTitleCase(rawName),
      matricula: formData.get('matricula') as string,
      type: formData.get('type') as PersonType
    };

    try {
      StorageService.savePerson(updatedPerson);
      onUpdate();
      setShowEditModal(false);
      setEditingPerson(null);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja remover esta pessoa do cadastro?')) {
      StorageService.deletePerson(id);
      onUpdate();
    }
  };

  const handleSelectFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    // Reset input
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processImport = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);

    const newPeople: Person[] = [];
    let processingLog = '';

    try {
      for (const file of selectedFiles) {
        const text = await file.text();
        // Use the robust parser instead of simple split
        const rows = parseCSV(text);

        // 1. Detectar Cabeçalho
        const headerIndex = rows.findIndex(row => {
          const rowStr = row.join(';').toLowerCase();
          return rowStr.includes('nome') && rowStr.includes('matrícula');
        });

        if (headerIndex === -1) {
          processingLog += `❌ ${file.name}: Cabeçalho não encontrado (necessário 'Nome' e 'Matrícula'). Ignorado.\n`;
          continue;
        }

        const colsHeader = rows[headerIndex].map(c => c.trim().toLowerCase().replace(/^["']|["']$/g, ''));
        
        // Índices dinâmicos
        const idxNome = colsHeader.indexOf('nome');
        const idxMatricula = colsHeader.findIndex(c => c.includes('matrícula')); 

        if (idxNome === -1 || idxMatricula === -1) {
          processingLog += `❌ ${file.name}: Colunas 'Nome' ou 'Matrícula' não identificadas.\n`;
          continue;
        }

        // 2. Auto-Detectar Tipo (Aluno ou Servidor)
        let detectedType = PersonType.STUDENT; 
        if (colsHeader.includes('cargo') || colsHeader.includes('setor suap') || colsHeader.includes('funções')) {
          detectedType = PersonType.SERVER;
        } else if (colsHeader.includes('curso') || colsHeader.includes('turma')) {
          detectedType = PersonType.STUDENT;
        }

        let fileCount = 0;

        // 3. Processar Linhas de Dados
        for (let i = headerIndex + 1; i < rows.length; i++) {
          const cols = rows[i];
          
          // Validação de segurança
          if (cols.length <= Math.max(idxNome, idxMatricula)) continue;

          const pName = cols[idxNome];
          const pMatricula = cols[idxMatricula];

          if (!pName || !pMatricula) continue;
          
          // Limpeza e Formatação
          const cleanName = toTitleCase(pName.trim().replace(/^["']|["']$/g, ''));
          const cleanMatricula = pMatricula.trim().replace(/^["']|["']$/g, '');

          // Ignora linhas que pareçam cabeçalho repetido
          if (cleanName.toLowerCase() === 'nome') continue;
          // Ignora linhas vazias ou inválidas
          if (cleanName.length < 2 || cleanMatricula.length < 2) continue;

          newPeople.push({
            id: Math.random().toString(36).substr(2, 9),
            name: cleanName,
            matricula: cleanMatricula,
            type: detectedType
          });
          fileCount++;
        }
        processingLog += `✅ ${file.name}: ${fileCount} registros de ${detectedType}.\n`;
      }

      if (newPeople.length > 0) {
        StorageService.importPeople(newPeople);
        onUpdate();
        setSelectedFiles([]);
        alert(`Importação concluída!\n\n${processingLog}\nTotal importado: ${newPeople.length}`);
      } else {
        alert(`Nenhum dado importado.\n\n${processingLog}`);
      }

    } catch (err) {
      console.error(err);
      alert('Erro crítico ao processar arquivos.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAll = (e: React.FormEvent) => {
    e.preventDefault();
    if (user.password !== deletePassword) {
      alert("Senha incorreta.");
      return;
    }
    StorageService.deleteAllPeople();
    onUpdate();
    setShowDeleteAllModal(false);
    setDeletePassword('');
    alert("Todas as pessoas foram removidas com sucesso.");
  };

  const filtered = people.filter(p => {
    // 1. Filter by Type
    const matchesType = filterType === 'ALL' || p.type === filterType;

    // 2. Advanced Search (Partial, Mixed, Accent-Insensitive)
    if (!search.trim()) return matchesType;

    const normalizedSearchTerms = normalizeText(search).split(/\s+/).filter(t => t.length > 0);
    const personText = normalizeText(`${p.name} ${p.matricula}`); // Combine fields to search in both

    // Check if EVERY search term is present in the person's data
    const matchesSearch = normalizedSearchTerms.every(term => personText.includes(term));

    return matchesType && matchesSearch;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterType, search]);

  const canDeleteAll = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions Bar */}
      <div className="flex items-center border-b border-gray-200">
        <div className="flex gap-4 items-center">
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
          
          {/* Delete All Button - Next to tabs as Icon */}
          {canDeleteAll && people.length > 0 && (
            <button 
              onClick={() => setShowDeleteAllModal(true)}
              className="mb-1.5 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
              title="Excluir todas as pessoas cadastradas"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        {activeTab === 'manual' ? (
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
             {/* ORDEM ALTERADA: Matrícula -> Nome -> Vínculo */}
             <div className="w-full md:w-48">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Matrícula</label>
              <input required value={matricula} onChange={e => setMatricula(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm" placeholder="202..." />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nome Completo</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm" placeholder="Nome..." />
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
          <div className="flex flex-col gap-6 items-center">
            {/* Upload UI unchanged */}
            <div className="w-full max-w-xl text-center">
              <div className="mb-6 bg-blue-50 text-blue-800 p-4 rounded-lg text-sm flex items-start gap-3 text-left">
                <HelpCircle className="flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="font-bold mb-1">Detecção Automática</p>
                  <p>O sistema identifica automaticamente se o arquivo é de <strong>Aluno</strong> ou <strong>Servidor</strong>. Envie arquivos CSV.</p>
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv" 
                multiple
                onChange={handleFileChange}
              />
              
              <button 
                onClick={handleSelectFiles} 
                className="w-full md:w-auto px-8 py-4 border-2 border-dashed border-ifrn-green bg-green-50 hover:bg-green-100 text-ifrn-darkGreen rounded-xl font-medium transition-all flex flex-col items-center gap-2 mx-auto"
              >
                <Upload size={32} /> 
                <span>Selecione arquivo(s)</span>
              </button>
            </div>

            {selectedFiles.length > 0 && (
              <div className="w-full max-w-xl space-y-3">
                <h4 className="font-semibold text-gray-700 text-sm border-b pb-2">Arquivos na fila ({selectedFiles.length}):</h4>
                <div className="grid grid-cols-1 gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText size={20} className="text-gray-400 flex-shrink-0" />
                        <div className="flex flex-col overflow-hidden">
                           <span className="text-sm text-gray-700 truncate font-medium">{file.name}</span>
                           <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                      <button onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-500 ml-2 p-1">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="pt-4">
                  <button 
                    onClick={processImport} 
                    disabled={isProcessing}
                    className="w-full px-8 py-3 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                  >
                    {isProcessing ? 'Processando...' : <><CheckCircle size={18} /> Importar</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Layout Reorganizado: Título acima, filtros à direita */}
        <div className="flex flex-col gap-4">
          <h3 className="font-bold text-gray-700 text-lg">Pessoas Cadastradas ({filtered.length})</h3>
          
          <div className="flex flex-col md:flex-row justify-end items-center gap-3">
             <div className="flex gap-2 w-full md:w-auto">
                <select 
                  className="text-sm border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-ifrn-green outline-none"
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as any)}
                >
                  <option value="ALL">Todos</option>
                  {Object.values(PersonType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input 
                  className="text-sm border rounded-lg px-3 py-1.5 w-full md:w-56 focus:ring-2 focus:ring-ifrn-green outline-none" 
                  placeholder="Buscar (nome, matrícula)..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
                <tr>
                  <th className="p-3 whitespace-nowrap">Matrícula</th>
                  <th className="p-3 whitespace-nowrap">Nome</th>
                  <th className="p-3 whitespace-nowrap">Vínculo</th>
                  <th className="p-3 w-10 text-center whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentItems.map(p => (
                  <tr 
                    key={p.id} 
                    className="hover:bg-gray-50 cursor-pointer group"
                    onClick={() => { setEditingPerson(p); setShowEditModal(true); }}
                  >
                    <td className="p-3 font-mono text-gray-600 whitespace-nowrap">{p.matricula}</td>
                    <td className="p-3 font-medium text-gray-900 whitespace-nowrap">{p.name}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`text-xs px-2 py-1 rounded-full ${p.type === PersonType.STUDENT ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                        {p.type}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex justify-center gap-2">
                        <button className="text-gray-400 hover:text-gray-600 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1">
                           <Pencil size={14} />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, p.id)}
                          className="text-gray-400 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1"
                        >
                           <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50">
               <span className="text-xs text-gray-500">
                 Mostrando {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filtered.length)} de {filtered.length}
               </span>
               <div className="flex items-center gap-2">
                 <button 
                   onClick={prevPage} 
                   disabled={currentPage === 1}
                   className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <ChevronLeft size={20} className="text-gray-600" />
                 </button>
                 <span className="text-sm font-medium text-gray-700">
                   Página {currentPage} de {totalPages}
                 </span>
                 <button 
                   onClick={nextPage} 
                   disabled={currentPage === totalPages}
                   className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <ChevronRight size={20} className="text-gray-600" />
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Person Modal */}
      <Modal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)} 
        title="Editar Pessoa"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
            <input 
              name="name" 
              required 
              defaultValue={editingPerson?.name} 
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label>
              <input 
                name="matricula" 
                required 
                defaultValue={editingPerson?.matricula} 
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vínculo</label>
              <select 
                name="type" 
                defaultValue={editingPerson?.type} 
                className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-ifrn-green outline-none"
              >
                <option value={PersonType.STUDENT}>Aluno</option>
                <option value={PersonType.SERVER}>Servidor</option>
                <option value={PersonType.EXTERNAL}>Externo</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t mt-4">
            <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button type="submit" className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-medium">Salvar Alterações</button>
          </div>
        </form>
      </Modal>

      {/* Delete All Modal Confirmation */}
      <Modal
        isOpen={showDeleteAllModal}
        onClose={() => { setShowDeleteAllModal(false); setDeletePassword(''); }}
        title="Confirmar Exclusão em Massa"
      >
        <form onSubmit={handleDeleteAll} className="space-y-4">
          <div className="bg-red-50 text-red-800 p-4 rounded-lg text-sm mb-4 border border-red-200">
             <p className="font-bold flex items-center gap-2"><AlertTriangle size={16}/> Ação Irreversível</p>
             <p className="mt-1">Você está prestes a excluir <strong>TODAS</strong> as pessoas cadastradas.</p>
             <p>Esta ação não pode ser desfeita.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sua Senha</label>
            <input 
              type="password"
              required 
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none" 
              placeholder="Confirme sua senha para continuar..."
              autoFocus
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button 
              type="button" 
              onClick={() => { setShowDeleteAllModal(false); setDeletePassword(''); }} 
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold flex items-center gap-2"
            >
              <Trash2 size={18} /> Confirmar Exclusão
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};