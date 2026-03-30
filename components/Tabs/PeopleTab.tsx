import React, { useState, useRef } from 'react';
import { Person, PersonType, User, UserLevel, Campus } from '../../types';
import { StorageService } from '../../services/storage';
import { Upload, UserPlus, Pencil, FileText, X, CheckCircle, HelpCircle, Trash2, ChevronLeft, ChevronRight, UserX, AlertTriangle, Loader2, ShieldAlert, BookOpen, Package, Lock as LockIcon, CheckCircle2, Search } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
  onUpdate: () => void;
  user: User;
  campuses: Campus[];
  adminGlobalCampusId?: string | null;
}

export const PeopleTab: React.FC<Props> = ({ onUpdate, user, campuses, adminGlobalCampusId }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [filterType, setFilterType] = useState<PersonType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(true);

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
  const [selectedCampusId, setSelectedCampusId] = useState<string>(
    (user.level === UserLevel.ADMIN ? adminGlobalCampusId : user.campus_id) || ''
  );

  // Matricula Check State
  const [matriculaCheck, setMatriculaCheck] = useState<{
    person?: any;
    bookLoans: any[];
    materialLoans: any[];
    lockerLoans: any[];
    hasPendencies: boolean;
  } | null>(null);
  const [isCheckingMatricula, setIsCheckingMatricula] = useState(false);

  // Search State
  const [searchInput, setSearchInput] = useState('');

  // Sync with global admin campus selector
  React.useEffect(() => {
    if (user.level === UserLevel.ADMIN && adminGlobalCampusId !== undefined) {
      setSelectedCampusId(adminGlobalCampusId || '');
    }
  }, [adminGlobalCampusId, user.level]);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [selectedDeleteCampuses, setSelectedDeleteCampuses] = useState<string[]>([]);

  const toTitleCase = (str: string) => {
    return str.toLowerCase().split(' ').map((word, index) => {
      const prepositions = ['de', 'da', 'do', 'dos', 'das', 'e'];
      if (index > 0 && prepositions.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  const normalizeText = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

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
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ';' && !inQuotes) {
        currentRow.push(currentField);
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
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

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    return rows;
  };

  const performMatriculaCheck = async (mat: string) => {
    if (mat.length < 3) {
      setMatriculaCheck(null);
      return;
    }
    setIsCheckingMatricula(true);
    try {
      const result = await StorageService.checkPersonAndPendencies(mat, user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id);
      setMatriculaCheck(result);
    } catch (err) {
      console.error("Erro ao verificar matrícula:", err);
    } finally {
      setIsCheckingMatricula(false);
    }
  };

  // Debounce matricula check
  React.useEffect(() => {
    if (activeTab === 'manual' && matricula.length >= 3) {
      const timer = setTimeout(() => {
        performMatriculaCheck(matricula);
      }, 600);
      return () => clearTimeout(timer);
    } else {
      setMatriculaCheck(null);
    }
  }, [matricula, activeTab, selectedCampusId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await StorageService.savePerson({
        name: toTitleCase(name),
        matricula,
        type,
        campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id
      });
      setName('');
      setMatricula('');
      onUpdate();
      fetchData(); // Recarregar dados após cadastro
      alert('Pessoa cadastrada!');
      setMatriculaCheck(null); // Limpar check
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPerson) return;
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const rawName = formData.get('name') as string;
    const newMatricula = formData.get('matricula') as string;

    const updatedPerson: Person = {
      ...editingPerson,
      name: toTitleCase(rawName),
      matricula: newMatricula,
      type: formData.get('type') as PersonType,
      campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : (editingPerson.campus_id || user.campus_id)
    };

    try {
      await StorageService.savePerson(updatedPerson, editingPerson.matricula);
      onUpdate();
      fetchData(); // Recarregar dados após edição
      setShowEditModal(false);
      setEditingPerson(null);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja remover esta pessoa do cadastro?')) {
      await StorageService.deletePerson(id);
      onUpdate();
      fetchData(); // Recarregar dados após exclusão
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
    let totalInFiles = 0;

    try {
      for (const file of selectedFiles) {
        const text = await file.text();
        const rows = parseCSV(text);

        const headerIndex = rows.findIndex(row => {
          const rowStr = row.join(';').toLowerCase();
          return rowStr.includes('nome') && rowStr.includes('matrícula');
        });

        if (headerIndex === -1) {
          processingLog += `❌ ${file.name}: Cabeçalho não encontrado (necessário 'Nome' e 'Matrícula'). Ignorado.\n`;
          continue;
        }

        const colsHeader = rows[headerIndex].map(c => c.trim().toLowerCase().replace(/^["']|["']$/g, ''));

        const idxNome = colsHeader.indexOf('nome');
        const idxMatricula = colsHeader.findIndex(c => c.includes('matrícula'));

        if (idxNome === -1 || idxMatricula === -1) {
          processingLog += `❌ ${file.name}: Colunas 'Nome' ou 'Matrícula' não identificadas.\n`;
          continue;
        }

        let detectedType = PersonType.STUDENT;
        if (colsHeader.includes('cargo') || colsHeader.includes('setor suap') || colsHeader.includes('funções')) {
          detectedType = PersonType.SERVER;
        } else if (colsHeader.includes('curso') || colsHeader.includes('turma')) {
          detectedType = PersonType.STUDENT;
        }

        let fileCount = 0;
        const seenInFile = new Set<string>();

        for (let i = headerIndex + 1; i < rows.length; i++) {
          const cols = rows[i];
          if (cols.length <= Math.max(idxNome, idxMatricula)) continue;

          const pName = cols[idxNome];
          const pMatricula = cols[idxMatricula];

          if (!pName || !pMatricula) continue;

          const cleanName = toTitleCase(pName.trim().replace(/^["']|["']$/g, ''));
          const cleanMatricula = pMatricula.trim().replace(/^["']|["']$/g, '');

          if (cleanName.toLowerCase() === 'nome' && cleanMatricula.toLowerCase().includes('matrícula')) continue;
          if (cleanName.length < 2 || cleanMatricula.length < 2) continue;
          if (seenInFile.has(cleanMatricula)) continue;

          seenInFile.add(cleanMatricula);
          totalInFiles++;
          newPeople.push({
            name: cleanName,
            matricula: cleanMatricula,
            type: detectedType,
            campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id
          });
          fileCount++;
        }
        processingLog += `✅ ${file.name}: ${fileCount} registros de ${detectedType}.\n`;
      }

      if (newPeople.length > 0) {
        await StorageService.importPeople(newPeople);
        onUpdate();
        fetchData();
        setSelectedFiles([]);
        alert(`Importação concluída!\n\n${processingLog}\nTotal no arquivo: ${totalInFiles}\n(Matrículas já existentes foram ignoradas automaticamente)`);
      } else {
        alert(`Nenhum dado válido encontrado.\n\n${processingLog}`);
      }

    } catch (err) {
      console.error(err);
      alert('Erro ao importar: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAll = async (e: React.FormEvent) => {
    e.preventDefault();
    const hashedPass = await StorageService.hashPassword(deletePassword);
    if (user.password !== hashedPass) {
      alert("Senha incorreta.");
      return;
    }

    try {
      setIsLoading(true);
      if (user.level === UserLevel.ADMIN) {
        // Se nenhum campus for selecionado no modal, exclui de todos (ou podemos obrigar selecionar)
        // Por segurança, vamos processar o que foi selecionado. Se vazio e clicou com "Todos" marcado, vira undefined.
        const campusFilter = selectedDeleteCampuses.length === 0 ? undefined : selectedDeleteCampuses;
        await StorageService.deleteAllPeople(campusFilter);
      } else {
        // Avançado: Exclui apenas do seu campus
        await StorageService.deleteAllPeople(user.campus_id);
      }

      onUpdate();
      fetchData();
      setShowDeleteAllModal(false);
      setDeletePassword('');
      setSelectedDeleteCampuses([]);
      alert("Pessoas removidas com sucesso.");
    } catch (err) {
      alert("Erro ao excluir pessoas: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    setIsDataLoading(true);
    try {
      const campusFilter = user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id;
      const [data, count] = await Promise.all([
        StorageService.getPeoplePaginated(currentPage, itemsPerPage, campusFilter, filterType, search),
        StorageService.getPeopleCount(campusFilter, filterType, search)
      ]);
      setPeople(data);
      setTotalCount(count);
    } catch (err) {
      console.error("Erro ao buscar dados paginados:", err);
    } finally {
      setIsDataLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [currentPage, filterType, selectedCampusId]);

  // Trigger search manually
  const handleSearchTrigger = () => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      fetchData();
    }
    setSearch(searchInput);
  };

  // Sync search state ONLY when it actually changes (triggered by handleSearchTrigger)
  React.useEffect(() => {
    fetchData();
  }, [search]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

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

          {canDeleteAll && (
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
            <div className="w-full md:w-48 relative">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Matrícula</label>
              <div className="relative">
                <input required value={matricula} onChange={e => setMatricula(e.target.value)} className={`w-full border rounded-lg p-2.5 text-sm ${matriculaCheck?.person ? 'border-amber-400 bg-amber-50' : matriculaCheck?.hasPendencies ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} placeholder="202..." />
                {isCheckingMatricula && <Loader2 size={14} className="animate-spin absolute right-3 top-3 text-ifrn-green" />}
              </div>
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
            <button type="submit" disabled={isLoading || isCheckingMatricula} className="w-full md:w-auto px-6 py-2.5 bg-ifrn-darkGreen text-white rounded-lg hover:bg-emerald-900 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><UserPlus size={18} /> Salvar</>}
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

        {/* Feedback de Verificação de Matrícula */}
        {activeTab === 'manual' && matriculaCheck && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2">
            {matriculaCheck.person ? (
              (() => {
                const isSameCampus = matriculaCheck.person.campus_id === (user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id);
                
                return (
                  <div className={`p-3 border rounded-lg flex items-center justify-between gap-4 ${isSameCampus ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-center gap-3">
                      {isSameCampus ? <AlertTriangle className="text-amber-600" size={20} /> : <HelpCircle className="text-blue-600" size={20} />}
                      <div>
                        <p className={`text-xs font-bold ${isSameCampus ? 'text-amber-900' : 'text-blue-900'}`}>
                          {isSameCampus ? 'Esta matrícula já está cadastrada!' : 'Pessoa encontrada em outro câmpus!'}
                        </p>
                        <p className={`text-[10px] font-medium ${isSameCampus ? 'text-amber-700' : 'text-blue-700'}`}>
                          Pertence a <strong>{matriculaCheck.person.name}</strong> ({matriculaCheck.person.campuses?.name || 'Câmpus desconhecido'}).
                        </p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={async () => { 
                        if (isSameCampus) {
                          setEditingPerson(matriculaCheck.person); 
                          setShowEditModal(true); 
                        } else {
                          // Import logic
                          if (confirm(`Deseja importar ${matriculaCheck.person.name} para o câmpus atual?`)) {
                            setIsLoading(true);
                            try {
                              await StorageService.importPersonGlobal(
                                matriculaCheck.person.matricula,
                                (user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id) || ''
                              );
                              alert('Pessoa importada com sucesso!');
                              setMatricula('');
                              setName('');
                              setMatriculaCheck(null);
                              fetchData();
                              onUpdate();
                            } catch (err) {
                              alert((err as Error).message);
                            } finally {
                              setIsLoading(false);
                            }
                          }
                        }
                      }}
                      className={`px-3 py-1 text-white text-[10px] font-bold rounded transition-colors ${isSameCampus ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {isSameCampus ? 'EDITAR EXISTENTE' : 'IMPORTAR PARA ESTE CÂMPUS'}
                    </button>
                  </div>
                );
              })()
            ) : matriculaCheck.hasPendencies ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="text-red-600" size={20} />
                  <div>
                    <p className="text-xs font-black text-red-900 uppercase tracking-tight">Pendências Encontradas!</p>
                    <p className="text-[10px] text-red-700 font-medium italic">
                      Esta matrícula possui registros pendentes no sistema, embora não esteja na lista de pessoas.
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {matriculaCheck.bookLoans.length > 0 && (
                    <div className="bg-white/60 p-2 rounded border border-red-100 flex items-center gap-2">
                      <BookOpen size={14} className="text-red-500" />
                      <span className="text-[10px] font-bold text-red-800">{matriculaCheck.bookLoans.length} empréstimo(s) de livro</span>
                    </div>
                  )}
                  {matriculaCheck.materialLoans.length > 0 && (
                    <div className="bg-white/60 p-2 rounded border border-red-100 flex items-center gap-2">
                      <Package size={14} className="text-red-500" />
                      <span className="text-[10px] font-bold text-red-800">{matriculaCheck.materialLoans.length} material(is) pendente(s)</span>
                    </div>
                  )}
                  {matriculaCheck.lockerLoans.length > 0 && (
                    <div className="bg-white/60 p-2 rounded border border-red-100 flex items-center gap-2">
                      <LockIcon size={14} className="text-red-500" />
                      <span className="text-[10px] font-bold text-red-800">Armário nº {matriculaCheck.lockerLoans[0].lockerNumber} ocupado</span>
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-red-500 font-bold uppercase animate-pulse">
                  * Ao cadastrar esta pessoa, as pendências serão vinculadas automaticamente a ela.
                </p>
              </div>
            ) : matricula.length >= 3 && !isCheckingMatricula && (
              <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
                 <CheckCircle2 className="text-emerald-500" size={16} />
                 <span className="text-[10px] font-bold text-emerald-700">Matrícula disponível e sem pendências vinculadas.</span>
              </div>
            )}
          </div>
        )}

        {user.level === UserLevel.ADMIN && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col md:flex-row items-center gap-4">
            <label className="text-xs font-bold text-amber-800 uppercase whitespace-nowrap">Câmpus Alvo</label>
            <select
              value={selectedCampusId}
              onChange={e => setSelectedCampusId(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-amber-500 outline-none"
              required
            >
              <option value="">Selecione um Câmpus...</option>
              {campuses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-amber-700 italic">Administrador: Esta seleção define o campus para cadastros manuais e importações CSV.</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Layout Reorganizado: Título acima, filtros à direita */}
        <div className="flex flex-col gap-4">
          <h3 className="font-bold text-gray-700 text-lg">Pessoas Cadastradas ({totalCount})</h3>

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
              <div className="relative flex items-center w-full md:w-64">
                <input
                  className="text-sm border rounded-l-lg px-3 py-1.5 w-full focus:ring-2 focus:ring-ifrn-green outline-none h-[38px]"
                  placeholder="Buscar (nome, matrícula)..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchTrigger()}
                />
                <button
                  onClick={handleSearchTrigger}
                  className="bg-ifrn-green text-white px-3 py-1.5 rounded-r-lg hover:bg-ifrn-darkGreen transition-colors flex items-center justify-center h-[38px] border border-l-0 border-ifrn-green"
                  title="Pesquisar"
                >
                  <Search size={16} />
                </button>
              </div>
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
                  {user.level === UserLevel.ADMIN && <th className="p-3 whitespace-nowrap">Câmpus</th>}
                  <th className="p-3 w-10 text-center whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isDataLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-ifrn-green" size={24} />
                        <span>Carregando dados...</span>
                      </div>
                    </td>
                  </tr>
                ) : people.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">Nenhuma pessoa encontrada com os filtros atuais.</td>
                  </tr>
                ) : (
                  people.map(p => (
                    <tr
                      key={p.matricula}
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
                      {user.level === UserLevel.ADMIN && (
                        <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
                          {campuses.find(c => c.id === p.campus_id)?.name || '-'}
                        </td>
                      )}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex justify-center gap-2">
                          <button className="text-gray-400 hover:text-gray-600 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1">
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, p.matricula)}
                            className="text-gray-400 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <div className="text-xs text-gray-500 font-medium">
                Mostrando <span className="text-gray-900">{Math.min((currentPage * itemsPerPage) - itemsPerPage + 1, totalCount)} - {Math.min(currentPage * itemsPerPage, totalCount)}</span> de <span className="text-gray-900">{totalCount}</span> pessoas
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1 || isDataLoading}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold disabled:opacity-30 hover:bg-white transition-colors"
                >
                  Anterior
                </button>
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  // Mostrar apenas as primeiras 3 páginas, as últimas 3, e a página atual
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={isDataLoading}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === pageNum ? 'bg-ifrn-green text-white shadow-md shadow-green-100' : 'hover:bg-gray-100 text-gray-600'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  // Mostrar "..." se necessário
                  if (pageNum === 2 || pageNum === totalPages - 1) {
                    return <span key={pageNum} className="text-gray-300 px-1 text-xs">...</span>;
                  }
                  return null;
                })}
                <button
                  disabled={currentPage === totalPages || isDataLoading}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold disabled:opacity-30 hover:bg-white transition-colors"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Pessoa">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label><input name="name" required defaultValue={editingPerson?.name} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label><input name="matricula" required defaultValue={editingPerson?.matricula} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Vínculo</label><select name="type" defaultValue={editingPerson?.type} className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-ifrn-green outline-none"><option value={PersonType.STUDENT}>Aluno</option><option value={PersonType.SERVER}>Servidor</option><option value={PersonType.EXTERNAL}>Externo</option></select></div>
          </div>
          {user.level === UserLevel.ADMIN && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Câmpus</label>
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
          <div className="pt-4 flex justify-end gap-3 border-t mt-4">
            <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-medium">{isLoading ? 'Salvando...' : 'Salvar Alterações'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDeleteAllModal} onClose={() => { setShowDeleteAllModal(false); setDeletePassword(''); setSelectedDeleteCampuses([]); }} title="Confirmar Exclusão em Massa">
        <form onSubmit={handleDeleteAll} className="space-y-4">
          <div className="bg-red-50 text-red-800 p-4 rounded-lg text-sm mb-4 border border-red-200">
            <p className="font-bold flex items-center gap-2"><AlertTriangle size={16} /> Ação Irreversível</p>
            {user.level === UserLevel.ADVANCED ? (
              <p className="mt-1">Você está prestes a excluir <strong>TODAS</strong> as pessoas cadastradas no câmpus <strong>{campuses.find(c => c.id === user.campus_id)?.name}</strong>.</p>
            ) : (
              <p className="mt-1">Você está prestes a excluir as pessoas dos câmpus selecionados abaixo.</p>
            )}
            <p>Esta ação não pode ser desfeita.</p>
          </div>

          {user.level === UserLevel.ADMIN && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Selecionar Câmpus</label>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedDeleteCampuses.length === campuses.length) {
                      setSelectedDeleteCampuses([]);
                    } else {
                      setSelectedDeleteCampuses(campuses.map(c => c.id));
                    }
                  }}
                  className="text-xs font-bold text-ifrn-green hover:underline"
                >
                  {selectedDeleteCampuses.length === campuses.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-xl p-3 space-y-2 bg-gray-50">
                {campuses.map(campus => (
                  <label key={campus.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedDeleteCampuses.includes(campus.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDeleteCampuses(prev => [...prev, campus.id]);
                        } else {
                          setSelectedDeleteCampuses(prev => prev.filter(id => id !== campus.id));
                        }
                      }}
                      className="w-4 h-4 rounded text-ifrn-green focus:ring-ifrn-green"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-ifrn-green font-medium transition-colors">{campus.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 italic">
                * Se nenhum for selecionado e você confirmar, <strong>todos</strong> os câmpus serão limpos.
              </p>
            </div>
          )}

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
              onClick={() => { setShowDeleteAllModal(false); setDeletePassword(''); setSelectedDeleteCampuses([]); }} 
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><Trash2 size={18} /> Confirmar Exclusão</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};