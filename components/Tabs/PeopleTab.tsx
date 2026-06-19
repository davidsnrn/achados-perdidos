import React, { useState, useRef } from 'react';
import { Person, PersonType, User, UserLevel, Campus } from '../../types';
import { StorageService } from '../../services/storage';
import { Upload, UserPlus, Pencil, FileText, X, CheckCircle, HelpCircle, Trash2, ChevronLeft, ChevronRight, UserX, AlertTriangle, Loader2, ShieldAlert, BookOpen, Package, Lock as LockIcon, CheckCircle2, Search, Users } from 'lucide-react';
import { Modal } from '../ui/Modal';
import * as XLSX from 'xlsx';

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
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [documentType, setDocumentType] = useState<'CPF' | 'RG' | 'Outros'>('CPF');
  const [phone, setPhone] = useState('');

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatDocument = (value: string, docType: string) => {
    if (docType === 'CPF') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
      if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return value;
  };

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
  const [showManualForm, setShowManualForm] = useState(false);
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
    // Detectar delimitador (, ou ;)
    const firstLine = text.split('\n')[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

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
      } else if (char === delimiter && !inQuotes) {
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

  const parseXLSX = (buffer: ArrayBuffer): string[][] => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    return data.map(row =>
      row.map(cell => (cell == null ? '' : String(cell)))
    );
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
    if (activeTab === 'manual' && type !== PersonType.EXTERNAL && matricula.length >= 3) {
      const timer = setTimeout(() => {
        performMatriculaCheck(matricula);
      }, 600);
      return () => clearTimeout(timer);
    } else {
      setMatriculaCheck(null);
    }
  }, [matricula, activeTab, selectedCampusId, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await StorageService.savePerson({
        name: toTitleCase(name),
        matricula: type === PersonType.EXTERNAL ? document : matricula,
        type,
        email: email.trim() || undefined,
        campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id,
        document: type === PersonType.EXTERNAL ? document : undefined,
        document_type: type === PersonType.EXTERNAL ? documentType : undefined,
        phone: type === PersonType.EXTERNAL ? phone || undefined : undefined,
      });
      setName('');
      setMatricula('');
      setEmail('');
      setDocument('');
      setPhone('');
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
    const rawEmail = formData.get('email') as string;
    const personType = formData.get('type') as PersonType;

    const updatedPerson: Person = {
      ...editingPerson,
      name: toTitleCase(rawName),
      matricula: personType === PersonType.EXTERNAL ? (formData.get('document') as string || editingPerson.matricula) : newMatricula,
      type: personType,
      email: rawEmail.trim() || undefined,
      campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : (editingPerson.campus_id || user.campus_id),
      document: personType === PersonType.EXTERNAL ? (formData.get('document') as string || editingPerson.document) : undefined,
      document_type: personType === PersonType.EXTERNAL ? (formData.get('document_type') as string || editingPerson.document_type) : undefined,
      phone: personType === PersonType.EXTERNAL ? (formData.get('phone') as string || editingPerson.phone) : undefined,
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
    if (user.level === UserLevel.ADMIN && !selectedCampusId) {
      alert('Selecione um Câmpus do Cadastro antes de importar.');
      return;
    }
    setIsProcessing(true);

    const newPeople: Person[] = [];
    let processingLog = '';
    let totalInFiles = 0;
    
    // Contadores por tipo
    let totalAlunos = 0;
    let totalServidores = 0;
    let totalExternos = 0;

    try {
      for (const file of selectedFiles) {
        const isExcel = /\.xlsx?$/i.test(file.name);
        let rows: string[][];

        if (isExcel) {
          const buffer = await file.arrayBuffer();
          rows = parseXLSX(buffer);
        } else {
          const text = await file.text();
          rows = parseCSV(text);
        }

        const headerIndex = rows.findIndex(row => {
          const rowStr = row.join(';').toLowerCase();
          return rowStr.includes('nome') && rowStr.includes('matrícula');
        });

        if (headerIndex === -1) {
          processingLog += `❌ ${file.name}: Cabeçalho não encontrado.\n`;
          continue;
        }

        const colsHeader = rows[headerIndex].map(c =>
          c.trim()
            .toLowerCase()
            .replace(/^["']|["']$/g, '')
            .replace(/[\u2010-\u2015\u2212]/g, '-')
            .replace(/\u00a0/g, ' ')
        );
        const idxNome = colsHeader.indexOf('nome');
        const idxMatricula = colsHeader.findIndex(c => c.includes('matrícula'));
        const idxEmail = colsHeader.findIndex(c => c.includes('email') || c.includes('e-mail'));
        const idxEmailAcademico = colsHeader.findIndex(c =>
          c.includes('e-mail acadêmico') || c.includes('email acadêmico')
        );
        const idxEmailContato = colsHeader.findIndex(c =>
          c.includes('e-mail para contato') ||
          c.includes('email para contato') ||
          c.includes('e-mail de contato') ||
          c.includes('email de contato')
        );

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
          const pEmail =
            detectedType === PersonType.STUDENT && idxEmailAcademico !== -1
              ? cols[idxEmailAcademico]
              : detectedType === PersonType.SERVER && idxEmailContato !== -1
                ? cols[idxEmailContato]
                : idxEmail !== -1
                  ? cols[idxEmail]
                  : undefined;

          if (!pName || !pMatricula) continue;

          const cleanName = toTitleCase(pName.trim().replace(/^["']|["']$/g, ''));
          const cleanMatricula = pMatricula.trim().replace(/^["']|["']$/g, '');
          const cleanEmail = pEmail ? pEmail.trim().replace(/^["']|["']$/g, '') : undefined;

          if (cleanName.toLowerCase() === 'nome' && cleanMatricula.toLowerCase().includes('matrícula')) continue;
          if (cleanName.length < 2 || cleanMatricula.length < 2) continue;
          if (seenInFile.has(cleanMatricula)) continue;

          seenInFile.add(cleanMatricula);
          totalInFiles++;
          
          // Incrementar contadores por tipo
          if (detectedType === PersonType.STUDENT) totalAlunos++;
          else if (detectedType === PersonType.SERVER) totalServidores++;
          else totalExternos++;

          newPeople.push({
            name: cleanName,
            matricula: cleanMatricula,
            type: detectedType,
            email: cleanEmail || undefined,
            campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id,
          });
          fileCount++;
        }
        processingLog += `✅ ${file.name}: ${fileCount} registros de ${detectedType}.\n`;
      }

      if (newPeople.length > 0) {
        const stats = await StorageService.importPeople(newPeople);
        onUpdate();
        fetchData();
        setSelectedFiles([]);
        
        const summary = [
          `Importação concluída!`,
          ``,
          `${processingLog}`,
          `--- RESUMO ---`,
          `Total no(s) arquivo(s): ${totalInFiles}`,
          `Alunos: ${totalAlunos}`,
          `Servidores: ${totalServidores}`,
          totalExternos > 0 ? `Externos: ${totalExternos}` : '',
          ``,
          `Adicionados (Novos): ${stats.inserted}`,
          `Atualizados: ${stats.updated}`,
          ``,
          `(Matrículas já existentes foram atualizadas para este câmpus automaticamente)`
        ].filter(Boolean).join('\n');

        alert(summary);
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
  }, [currentPage, filterType, selectedCampusId, search]);

  // Trigger search manually
  const handleSearchTrigger = () => {
    setSearch(searchInput);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const canDeleteAll = user.level === UserLevel.ADMIN || user.level === UserLevel.ADVANCED;

  return (
    <div className="space-y-6">
      {/* Barra Superior de Ações e Busca */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          {/* Busca Alinhada à Esquerda */}
          <div className="relative flex items-center w-full md:w-80 group">
            <div className="absolute left-3 text-gray-400 group-focus-within:text-ifrn-green transition-colors">
              <Search size={18} />
            </div>
            <input
              className="w-full text-sm border-2 border-gray-100 rounded-xl pl-10 pr-4 py-2.5 focus:border-ifrn-green focus:bg-white outline-none transition-all bg-gray-50/50 font-medium"
              placeholder="Pesquisar por nome ou matrícula..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchTrigger()}
            />
            <button
              onClick={handleSearchTrigger}
              className="absolute right-2 bg-ifrn-green text-white p-1.5 rounded-lg hover:bg-ifrn-darkGreen transition-colors shadow-sm"
              title="Pesquisar"
            >
              <Search size={14} />
            </button>
          </div>

          <select
            className="w-full md:w-auto text-sm border-2 border-gray-100 rounded-xl px-3 py-2.5 focus:border-ifrn-green outline-none bg-gray-50/50 font-bold text-gray-600"
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
          >
            <option value="ALL">Todos os Vínculos</option>
            {Object.values(PersonType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => { setActiveTab('manual'); setShowManualForm(true); }}
            className="flex-1 md:flex-none px-4 py-2.5 bg-ifrn-green text-white rounded-xl hover:bg-ifrn-darkGreen font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <UserPlus size={18} /> + Individual
          </button>
          
          <button
            onClick={() => { setActiveTab('import'); setShowManualForm(true); }}
            className="px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 font-bold text-sm flex items-center justify-center gap-2 transition-all border border-blue-200"
          >
            <Upload size={18} /> Em Lote (CSV/Excel)
          </button>

          {canDeleteAll && (
            <button
              onClick={() => setShowDeleteAllModal(true)}
              className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              title="Limpar Cadastro"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Modal de Cadastro / Importação (Oculto por padrão) */}
      <Modal 
        isOpen={showManualForm} 
        onClose={() => { setShowManualForm(false); setMatriculaCheck(null); }} 
        title={activeTab === 'manual' ? 'Cadastro Individual' : 'Cadastro em Lote (CSV/Excel)'}
      >
        <div className="space-y-6">
          {activeTab === 'manual' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {type !== PersonType.EXTERNAL ? (
                  <div className="relative">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Matrícula</label>
                    <div className="relative">
                      <input 
                        required 
                        value={matricula} 
                        onChange={e => setMatricula(e.target.value)} 
                        className={`w-full border-2 rounded-xl p-3 text-sm focus:border-ifrn-green outline-none transition-all ${matriculaCheck?.person ? 'border-amber-400 bg-amber-50' : matriculaCheck?.hasPendencies ? 'border-red-400 bg-red-50' : 'border-gray-100'}`} 
                        placeholder="Ex: 2023..." 
                      />
                      {isCheckingMatricula && <Loader2 size={16} className="animate-spin absolute right-3 top-3.5 text-ifrn-green" />}
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Tipo de Documento</label>
                      <select
                        value={documentType}
                        onChange={e => { setDocumentType(e.target.value as 'CPF' | 'RG' | 'Outros'); setDocument(formatDocument(document, e.target.value)); }}
                        className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm bg-white focus:border-ifrn-green outline-none"
                      >
                        <option value="CPF">CPF</option>
                        <option value="RG">RG</option>
                        <option value="Outros">Outros</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Nº do Documento</label>
                      <input
                        required
                        value={document}
                        onChange={e => setDocument(formatDocument(e.target.value, documentType))}
                        className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-ifrn-green outline-none transition-all"
                        placeholder={documentType === 'CPF' ? '000.000.000-00' : 'Número do documento...'}
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Vínculo</label>
                  <select 
                    value={type} 
                    onChange={e => { setType(e.target.value as PersonType); if (e.target.value !== PersonType.EXTERNAL) setMatriculaCheck(null); }} 
                    className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm bg-white focus:border-ifrn-green outline-none"
                  >
                    <option value={PersonType.STUDENT}>Aluno</option>
                    <option value={PersonType.SERVER}>Servidor</option>
                    <option value={PersonType.EXTERNAL}>Externo</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Nome Completo</label>
                  <input 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-ifrn-green outline-none transition-all" 
                    placeholder="Nome completo..." 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">E-mail (opcional)</label>
                  <input 
                    type="email"
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-ifrn-green outline-none transition-all" 
                    placeholder="Ex: nome@ifrn.edu.br..." 
                  />
                </div>
                {type === PersonType.EXTERNAL && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Telefone (opcional)</label>
                    <input
                      value={phone}
                      onChange={e => setPhone(formatPhone(e.target.value))}
                      className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-ifrn-green outline-none transition-all"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                )}
              </div>

              {/* Feedback de Verificação dentro do Modal */}
              {matriculaCheck && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  {matriculaCheck.person ? (
                    (() => {
                      const isSameCampus = matriculaCheck.person.campus_id === (user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id);
                      return (
                        <div className={`p-4 border-2 rounded-xl flex items-center justify-between gap-4 ${isSameCampus ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                          <div className="flex items-center gap-3">
                            {isSameCampus ? <AlertTriangle className="text-amber-600" size={24} /> : <HelpCircle className="text-blue-600" size={24} />}
                            <div>
                              <p className={`text-sm font-black ${isSameCampus ? 'text-amber-900' : 'text-blue-900'}`}>
                                {isSameCampus ? 'MATRÍCULA JÁ EXISTE!' : 'PESSOA EM OUTRO CÂMPUS!'}
                              </p>
                              <p className={`text-xs font-medium ${isSameCampus ? 'text-amber-700' : 'text-blue-700'}`}>
                                Pertence a <strong>{matriculaCheck.person.name}</strong>.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : matriculaCheck.hasPendencies ? (
                    <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl space-y-3">
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="text-red-600" size={24} />
                        <p className="text-xs font-black text-red-900 uppercase">Pendências Encontradas!</p>
                      </div>
                      <p className="text-[10px] text-red-700 font-bold">Esta matrícula possui registros pendentes (Livros, Materiais ou Armários) que serão vinculados ao cadastro.</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 border-2 border-emerald-100 rounded-xl flex items-center gap-2">
                       <CheckCircle2 className="text-emerald-500" size={18} />
                       <span className="text-xs font-bold text-emerald-700">Matrícula disponível para cadastro.</span>
                    </div>
                  )}
                </div>
              )}

              {user.level === UserLevel.ADMIN && (
                <div className="p-4 bg-amber-50 border-2 border-amber-100 rounded-xl space-y-2">
                  <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Câmpus do Cadastro</label>
                  <select
                    value={selectedCampusId}
                    onChange={e => setSelectedCampusId(e.target.value)}
                    className="w-full border border-amber-200 rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  >
                    <option value="">Selecione um Câmpus...</option>
                    {campuses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowManualForm(false)} 
                  className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading || isCheckingMatricula} 
                  className="flex-[2] py-3 bg-ifrn-green text-white rounded-xl hover:bg-ifrn-darkGreen font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <><UserPlus size={20} /> Confirmar Cadastro</>}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 text-blue-800 p-5 rounded-2xl text-sm flex flex-col gap-4 border border-blue-100 shadow-inner">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 text-white p-1 rounded-lg">
                    <HelpCircle size={18} />
                  </div>
                  <p className="font-black uppercase text-[10px] tracking-widest">Configuração do Arquivo</p>
                </div>
                
                <div className="space-y-3 text-xs leading-relaxed">
                  <p className="font-semibold">
                    Formatos aceitos: CSV, XLSX e XLS.
                  </p>
                  <p>
                    O arquivo deve conter as colunas <strong>Nome</strong> e <strong>Matrícula</strong> (obrigatórias) e opcionalmente <strong>E-mail</strong>.
                  </p>
                  <p>
                    Para CSVs, ao salvar no Excel, escolha a opção:<br/>
                    <strong className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[11px] inline-block mt-2 shadow-sm">
                      CSV UTF-8 (Delimitado por vírgulas) (*.csv)
                    </strong>
                  </p>
                </div>
              </div>

               {user.level === UserLevel.ADMIN && (
                <div className="p-4 bg-amber-50 border-2 border-amber-100 rounded-xl space-y-2">
                  <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Câmpus do Cadastro</label>
                  <select
                    value={selectedCampusId}
                    onChange={e => setSelectedCampusId(e.target.value)}
                    className="w-full border border-amber-200 rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  >
                    <option value="">Selecione um Câmpus...</option>
                    {campuses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col items-center justify-center border-4 border-dashed border-gray-100 rounded-3xl p-10 bg-gray-50/50 hover:bg-white hover:border-ifrn-green/30 transition-all cursor-pointer group" onClick={handleSelectFiles}>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx,.xls" multiple onChange={handleFileChange} />
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-ifrn-green mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <p className="font-black text-gray-700">Clique para selecionar arquivos</p>
                <p className="text-xs text-gray-400 mt-1">Formatos aceitos: .csv, .xlsx, .xls</p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Arquivos selecionados ({selectedFiles.length})</p>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <FileText size={18} className="text-blue-500" />
                          <span className="text-sm font-bold text-gray-700 truncate max-w-[200px]">{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-500 p-1"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={processImport}
                    disabled={isProcessing}
                    className="w-full py-4 bg-ifrn-green text-white rounded-2xl hover:bg-ifrn-darkGreen font-black shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? 'Processando...' : <><CheckCircle size={20} /> Iniciar Importação</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <div className="space-y-4 pt-2">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-gray-800 text-xl tracking-tight flex items-center gap-2">
             <Users className="text-ifrn-green" size={24} />
             Pessoas Cadastradas
             <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-md ml-2 font-mono">#{totalCount}</span>
          </h3>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
                <tr>
                  <th className="p-3 whitespace-nowrap">Matrícula / Documento</th>
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
                      onClick={() => { setEditingPerson(p); setSelectedCampusId(p.campus_id || ''); setShowEditModal(true); }}
                    >
                      <td className="p-3 font-mono text-gray-600 whitespace-nowrap">{p.type === PersonType.EXTERNAL && p.document ? `${p.document_type ? p.document_type + ': ' : ''}${p.document}` : p.matricula}</td>
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
          <div><label className="block text-sm font-medium text-gray-700 mb-1">E-mail (opcional)</label><input name="email" type="email" defaultValue={editingPerson?.email} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Ex: nome@ifrn.edu.br..." /></div>
          <div className="grid grid-cols-2 gap-4">
            {editingPerson?.type !== PersonType.EXTERNAL ? (
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label><input name="matricula" required defaultValue={editingPerson?.matricula} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" /></div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                  <select name="document_type" defaultValue={editingPerson?.document_type || 'CPF'} className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-ifrn-green outline-none">
                    <option value="CPF">CPF</option>
                    <option value="RG">RG</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nº do Documento</label>
                  <input name="document" required defaultValue={editingPerson?.document} onChange={e => { const input = e.target as HTMLInputElement; const docType = (input.closest('form')?.querySelector('[name="document_type"]') as HTMLSelectElement)?.value || 'CPF'; input.value = formatDocument(input.value, docType); }} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Número do documento..." />
                </div>
              </>
            )}
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Vínculo</label><select name="type" defaultValue={editingPerson?.type} className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-ifrn-green outline-none"><option value={PersonType.STUDENT}>Aluno</option><option value={PersonType.SERVER}>Servidor</option><option value={PersonType.EXTERNAL}>Externo</option></select></div>
          </div>
          {editingPerson?.type === PersonType.EXTERNAL && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (opcional)</label>
              <input
                name="phone"
                defaultValue={editingPerson?.phone}
                onChange={e => { const input = e.target as HTMLInputElement; input.value = formatPhone(input.value); }}
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                placeholder="(00) 00000-0000"
              />
            </div>
          )}
          {user.level === UserLevel.ADMIN && (
            <>
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
            </> 
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