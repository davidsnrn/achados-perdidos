import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FoundItem, ItemStatus, Person, LostReport, ReportStatus, User, UserLevel, Campus, Setor } from '../../types';
import { StorageService } from '../../services/storage';
import { Plus, Search, Trash2, Gift, Calendar, Pencil, Info, History, CornerUpRight, ChevronUp, ChevronDown, RotateCcw, User as UserIcon, FileText, CheckCircle, Loader2, Image as ImageIcon, X, Share, Building2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ImageViewer } from '../ui/ImageViewer';

interface Props {
  items: FoundItem[];
  reports: LostReport[];
  onUpdate: () => void;
  user: User;
  onToggleSleep?: (sleep: boolean) => void;
  campuses: Campus[];
  setores: Setor[];
  adminGlobalCampusId?: string | null;
  adminGlobalSetorId?: string | null;
}

export const FoundItemsTab: React.FC<Props> = ({ items, reports, onUpdate, user, onToggleSleep, campuses, setores, adminGlobalCampusId, adminGlobalSetorId }) => {
  const [activeSubTab, setActiveSubTab] = useState<ItemStatus>(ItemStatus.AVAILABLE);
  const [searchTerm, setSearchTerm] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [operatorSearch, setOperatorSearch] = useState('');
  const [searchResultsPeople, setSearchResultsPeople] = useState<Person[]>([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  const [hasSearchedPeople, setHasSearchedPeople] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);

  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'dateFound', direction: 'desc' });

  // Modals State
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Return Modal State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [itemToReturn, setItemToReturn] = useState<FoundItem | null>(null);
  const [returnType, setReturnType] = useState<'PERSON' | 'REPORT'>('PERSON');

  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [searchAllCampuses, setSearchAllCampuses] = useState(false);
  const [selectedReport, setSelectedReport] = useState<LostReport | null>(null);
  const [isExternalPerson, setIsExternalPerson] = useState(false);
  const [externalName, setExternalName] = useState('');
  const [externalDocument, setExternalDocument] = useState('');
  const [externalDocumentType, setExternalDocumentType] = useState<'CPF' | 'RG' | 'Outros'>('CPF');
  const [externalPhone, setExternalPhone] = useState('');

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

  const [editingItem, setEditingItem] = useState<FoundItem | null>(null);
  const [viewingItem, setViewingItem] = useState<FoundItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [selectedHistoryEntries, setSelectedHistoryEntries] = useState<number[]>([]);

  // Date Filtering State
  const [dateFilter, setDateFilter] = useState<DateFilterType>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [itemImage, setItemImage] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [selectedCampusId, setSelectedCampusId] = useState<string>(
    (user.level === UserLevel.ADMIN ? adminGlobalCampusId : user.campus_id) || ''
  );
  const [selectedSetorId, setSelectedSetorId] = useState<string>(
    (user.level === UserLevel.ADMIN ? adminGlobalSetorId : user.setor_id) || ''
  );

  // Sync with global admin campus selector
  React.useEffect(() => {
    if (user.level === UserLevel.ADMIN && adminGlobalCampusId !== undefined) {
      setSelectedCampusId(adminGlobalCampusId || '');
    }
  }, [adminGlobalCampusId, user.level]);

  React.useEffect(() => {
    if (user.level === UserLevel.ADMIN && adminGlobalSetorId !== undefined) {
      setSelectedSetorId(adminGlobalSetorId || '');
    }
  }, [adminGlobalSetorId, user.level]);

  // Discard modal state (for Advanced users choosing between soft/hard delete)
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [itemToDiscard, setItemToDiscard] = useState<FoundItem | null>(null);
  const [discardType, setDiscardType] = useState<'Doado' | 'Descartado'>('Descartado');

  const handleShareImage = async (base64Data: string, fileName: string) => {
    try {
      const response = await fetch(base64Data);
      const blob = await response.blob();
      const file = new File([blob], `${fileName}.jpg`, { type: 'image/jpeg' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Imagem do Item',
        });
      } else {
        // Fallback: Download the image
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = `${fileName}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert("O compartilhamento direto não é suportado pelo seu navegador. A imagem foi baixada para que você possa enviá-la manualmente.");
      }
    } catch (err) {
      console.error("Erro ao compartilhar imagem:", err);
      alert("Erro ao compartilhar imagem.");
    }
  };

  const processImageFile = async (file: File) => {
    try {
      setIsLoading(true);

      // Criar um ImageBitmap com redimensionamento nativo (Hardware Accelerated)
      // Isso evita decodificar a imagem de 50MP na thread principal
      // Máximo de 800px para economizar espaço no Supabase
      const maxWidth = 800;
      const bitmap = await createImageBitmap(file, {
        resizeWidth: maxWidth,
        resizeQuality: 'medium'
      });

      // Desenhar em um canvas para converter de volta para Blob
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Não foi possível obter contexto do canvas");

      // Ajustar dimensões mantendo proporção
      const ratio = bitmap.width / bitmap.height;
      canvas.width = maxWidth;
      canvas.height = maxWidth / ratio;

      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      // Liberar o bitmap da memória imediatamente
      bitmap.close();

      // Converter para Blob (JPEG com qualidade 0.7 para ser ainda mais leve no banco)
      canvas.toBlob((blob) => {
        if (blob) {
          // Revogar URL anterior se existir
          if (itemImage?.startsWith('blob:')) {
            URL.revokeObjectURL(itemImage);
          }

          const previewUrl = URL.createObjectURL(blob);
          setItemImage(previewUrl);
          setImageBlob(blob);
        }
        setIsLoading(false);
      }, 'image/jpeg', 0.7);

    } catch (err) {
      console.error("Erro ao processar imagem:", err);
      alert("Ocorreu um erro ao processar a foto. Se o problema persistir, tente tirar a foto fora do app e depois selecioná-la da galeria.");
      setIsLoading(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await processImageFile(file);
    }
  };

  const userString = `${user.name} (${user.matricula})`;

  const availableTabs = useMemo(() => {
    const statuses = Object.values(ItemStatus);
    if (user.level === UserLevel.STANDARD) {
      return statuses.filter(s => s !== ItemStatus.DISCARDED);
    }
    return statuses;
  }, [user.level]);

  // Limpeza de URLs de Blob para evitar vazamento de memória
  React.useEffect(() => {
    return () => {
      if (itemImage?.startsWith('blob:')) {
        URL.revokeObjectURL(itemImage);
      }
    };
  }, [itemImage]);

  const cleanupExpiredDiscarded = useCallback(async () => {
    const discardedItems = items.filter(
      i => i.status === ItemStatus.DISCARDED && i.returnedDate
    );
    const now = Date.now();
    for (const item of discardedItems) {
      const deadlineDays = item.discardType === 'Doado' ? 30 : 7;
      const deadlineMs = deadlineDays * 24 * 60 * 60 * 1000;
      const returnedDate = new Date(item.returnedDate!).getTime();
      if (now - returnedDate >= deadlineMs) {
        try {
          if (item.imageUrl) {
            await StorageService.deleteItemImage(item.imageUrl);
          }
          await StorageService.deleteItem(item.id);
        } catch (err) {
          console.error('Erro ao excluir item descartado expirado:', err);
        }
      }
    }
  }, [items]);

  // Executa limpeza de itens descartados expirados ao montar e quando os itens mudarem
  useEffect(() => {
    cleanupExpiredDiscarded();
  }, [cleanupExpiredDiscarded]);

  const normalizeText = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesStatus = item.status === activeSubTab;

      const rawSearch = searchTerm.trim();
      let matchesSearch = true;

      if (rawSearch.startsWith('#')) {
        const searchId = parseInt(rawSearch.replace('#', ''));
        if (!isNaN(searchId)) {
          matchesSearch = (item.campusItemId ?? item.id) === searchId;
        } else {
          matchesSearch = false;
        }
      } else {
        const searchTerms = normalizeText(searchTerm).split(/\s+/).filter(t => t.length > 0);
        if (searchTerms.length > 0) {
          const itemSearchableText = normalizeText(`
            ${item.campusItemId ?? item.id} 
            ${item.description} 
            ${item.detailedDescription || ''} 
            ${item.locationFound} 
            ${item.locationStored}
          `);
          matchesSearch = searchTerms.every(term => itemSearchableText.includes(term));
        }
      }

      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const itemDate = new Date(item.dateFound + 'T12:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === 'TODAY') {
          const iDate = new Date(item.dateFound + 'T00:00:00');
          iDate.setHours(0, 0, 0, 0);
          matchesDate = iDate.getTime() === today.getTime();
        } else if (dateFilter === 'WEEK') {
          const firstDay = new Date(today);
          firstDay.setDate(today.getDate() - today.getDay());
          const lastDay = new Date(today);
          lastDay.setDate(today.getDate() + (6 - today.getDay()));

          const iDate = new Date(item.dateFound + 'T00:00:00');
          iDate.setHours(0, 0, 0, 0);
          matchesDate = iDate >= firstDay && iDate <= lastDay;

        } else if (dateFilter === 'THIS_MONTH') {
          matchesDate = itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
        } else if (dateFilter === 'THIS_YEAR') {
          matchesDate = itemDate.getFullYear() === today.getFullYear();
        } else if (dateFilter === 'CUSTOM' && startDate && endDate) {
          const start = new Date(startDate + 'T00:00:00');
          const end = new Date(endDate + 'T23:59:59');
          matchesDate = itemDate >= start && itemDate <= end;
        } else if (dateFilter === 'SPECIFIC' && startDate) {
          matchesDate = item.dateFound === startDate;
        }
      }

      const matchesRecipient = !recipientSearch || (
        item.returnedTo && normalizeText(item.returnedTo).includes(normalizeText(recipientSearch))
      );

      const matchesOperator = !operatorSearch || (
        item.history && item.history.some(log => 
          log.user && normalizeText(log.user).includes(normalizeText(operatorSearch))
        )
      );

      return matchesStatus && matchesSearch && matchesDate && matchesRecipient && matchesOperator;
    });
  }, [items, activeSubTab, searchTerm, dateFilter, startDate, endDate, recipientSearch, operatorSearch]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];
    sorted.sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      // Handle specific types if necessary (dates are strings in format YYYY-MM-DD so string sort works)

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [filteredItems, sortConfig]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, activeSubTab, recipientSearch, operatorSearch]);

  // Ajusta a ordenação inicial baseada na aba ativa
  React.useEffect(() => {
    if (activeSubTab === ItemStatus.RETURNED || activeSubTab === ItemStatus.DISCARDED) {
      setSortConfig({ key: 'returnedDate', direction: 'desc' });
    } else {
      setSortConfig({ key: 'dateFound', direction: 'desc' });
    }
  }, [activeSubTab]);

  // Limpa filtros específicos ao trocar de aba se não estiver na aba Devolvido
  React.useEffect(() => {
    if (activeSubTab !== ItemStatus.RETURNED) {
      setRecipientSearch('');
      setOperatorSearch('');
    }
  }, [activeSubTab]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(start, start + itemsPerPage);
  }, [sortedItems, currentPage]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (name: SortKey) => {
    if (sortConfig.key !== name) {
      return <div className="w-3 h-3 ml-1"></div>; // Spacer
    }
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />;
  };

  const handlePersonSearch = async (val?: string, isTriggered = false) => {
    const query = val !== undefined ? val : personSearch;
    setPersonSearch(query);

    if (isTriggered && query.trim().length >= 2) {
      setIsSearchingPeople(true);
      try {
        const results = await StorageService.searchPeople(query, 10, searchAllCampuses ? undefined : user.campus_id);
        setSearchResultsPeople(results);
        setHasSearchedPeople(true);
        setSelectedResultIndex(results.length > 0 ? 0 : -1);
      } catch (err) {
        console.error("Erro busca pessoas:", err);
      } finally {
        setIsSearchingPeople(false);
      }
    } else if (!isTriggered) {
      // Clear results on edit or when typing too few characters
      setSearchResultsPeople([]);
      setHasSearchedPeople(false);
      setSelectedResultIndex(-1);
    }
  };

  const openReports = useMemo(() => {
    return reports.filter(r => r.status === ReportStatus.OPEN);
  }, [reports]);

  const getDaysInStock = (dateString: string) => {
    const foundDate = new Date(dateString + 'T12:00:00');
    const today = new Date();
    foundDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(today.getTime() - foundDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return <span className="text-red-600 font-bold">Hoje</span>;
    if (diffDays === 1) return <span className="text-gray-700">Ontem</span>;
    return <span className="text-gray-700">Há {diffDays} dias</span>;
  };

  const getStatusColorClass = (status: ItemStatus) => {
    switch (status) {
      case ItemStatus.AVAILABLE: return 'bg-green-100 text-green-800 border-green-200';
      case ItemStatus.RETURNED: return 'bg-blue-100 text-blue-800 border-blue-200';
      case ItemStatus.DISCARDED: return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-50 text-gray-800';
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const isNew = !editingItem || editingItem.id === 0;

    const dateFoundInput = formData.get('dateFound') as string;
    const todayStr = new Date().toISOString().split('T')[0];

    if (dateFoundInput > todayStr) {
      alert("A data em que o item foi achado não pode ser futura.");
      setIsLoading(false);
      return;
    }

    try {
      let finalImageUrl = itemImage;

      // Se tivermos um novo blob (nova imagem selecionada), fazemos o upload
      if (imageBlob) {
        // Se já existia uma imagem antes, apagamos a antiga do storage
        if (editingItem?.imageUrl) {
          await StorageService.deleteItemImage(editingItem.imageUrl);
        }
        finalImageUrl = await StorageService.uploadItemImage(imageBlob);
      } else if (!itemImage && editingItem?.imageUrl) {
        // Se a imagem foi removida (itemImage é null) e existia uma antes
        await StorageService.deleteItemImage(editingItem.imageUrl);
        finalImageUrl = null;
      }

      const newItem: FoundItem = {
        id: editingItem ? editingItem.id : 0,
        description: formData.get('description') as string,
        detailedDescription: formData.get('detailedDescription') as string,
        locationFound: formData.get('locationFound') as string,
        locationStored: formData.get('locationStored') as string,
        dateFound: dateFoundInput,
        dateRegistered: editingItem ? editingItem.dateRegistered : new Date().toISOString(),
        status: editingItem ? editingItem.status : ItemStatus.AVAILABLE,
        imageUrl: finalImageUrl || undefined,
        campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id,
        setor_id: user.level === UserLevel.ADMIN ? selectedSetorId : user.setor_id,
      };

      await StorageService.saveItem(newItem, isNew ? 'Novo item cadastrado.' : 'Detalhes do item editados.', userString);
      onUpdate();
      setShowEditModal(false);
      setEditingItem(null);
      setImageBlob(null);
    } catch (e: any) {
      alert(`Erro ao salvar item: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (user.level === UserLevel.STANDARD) {
      alert("Usuários Padrão não podem excluir itens.");
      return;
    }

    const itemToDelete = items.find(i => i.id === id);
    if (!itemToDelete) return;

    if (user.level === UserLevel.ADVANCED) {
      // Avançado: Encaminha direto para Descartado (Soft-delete)
      if (confirm(`Deseja mover o item "${itemToDelete.description}" para a aba Descartado/Doado?`)) {
        setIsLoading(true);
        try {
          const logMsg = `Item descartado por ${userString}.`;
          const updated: FoundItem = {
            ...itemToDelete,
            status: ItemStatus.DISCARDED,
            discardType: 'Descartado',
            returnedDate: new Date().toISOString()
          };
          await StorageService.saveItem(updated, logMsg, userString);
          onUpdate();
        } catch (err: any) {
          alert(`Erro: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      }
      return;
    }

    // Admin: Abre modal com escolha (Exclusão normal/descarte ou permanente)
    setItemToDiscard(itemToDelete);
    setDiscardType('Descartado');
    setShowDiscardModal(true);
  };

  const handleConfirmDiscard = async (action: 'SOFT' | 'HARD') => {
    if (!itemToDiscard) return;
    setIsLoading(true);
    try {
      if (action === 'HARD') {
        if (itemToDiscard.imageUrl) {
          await StorageService.deleteItemImage(itemToDiscard.imageUrl);
        }
        await StorageService.deleteItem(itemToDiscard.id);
      } else {
        const logMsg = `Item marcado como ${discardType} por ${userString}.`;
        const updated: FoundItem = {
          ...itemToDiscard,
          status: ItemStatus.DISCARDED,
          discardType,
          returnedDate: new Date().toISOString()
        };
        await StorageService.saveItem(updated, logMsg, userString);
      }
      onUpdate();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsLoading(false);
      setShowDiscardModal(false);
      setItemToDiscard(null);
    }
  };

  const handleDeleteHistoryEntry = async (item: FoundItem, entryIndex: number) => {
    if (!confirm('Excluir este registro do histórico?')) return;
    try {
      await StorageService.deleteItemHistoryEntry(item.id, entryIndex);
      const updatedItem = { ...viewingItem!, history: viewingItem!.history!.filter((_, i) => i !== entryIndex) };
      setViewingItem(updatedItem);
      setSelectedHistoryEntries(prev => prev.filter(i => i !== entryIndex).map(i => i > entryIndex ? i - 1 : i));
    } catch (err: any) {
      alert(`Erro ao excluir histórico: ${err.message}`);
    }
  };

  const toggleHistorySelection = (index: number) => {
    setSelectedHistoryEntries(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  };

  const handleBatchDeleteHistory = async () => {
    if (!viewingItem || selectedHistoryEntries.length === 0) return;
    if (!confirm(`Excluir ${selectedHistoryEntries.length} registro(s) do histórico?`)) return;
    try {
      const sorted = [...selectedHistoryEntries].sort((a, b) => b - a);
      for (const idx of sorted) {
        await StorageService.deleteItemHistoryEntry(viewingItem.id, idx);
      }
      const remainingHistory = viewingItem.history!.filter((_, i) => !selectedHistoryEntries.includes(i));
      setViewingItem({ ...viewingItem, history: remainingHistory });
      setSelectedHistoryEntries([]);
    } catch (err: any) {
      alert(`Erro ao excluir histórico: ${err.message}`);
    }
  };

  const handleOpenReturnModal = (e: React.MouseEvent, item: FoundItem) => {
    e.stopPropagation();
    setItemToReturn(item);
    setShowReturnModal(true);
    setPersonSearch('');
    setSelectedPerson(null);
    setSelectedReport(null);
    setReturnType('PERSON');
    setIsExternalPerson(false);
    setExternalName('');
    setExternalDocument('');
    setExternalPhone('');
    setSearchResultsPeople([]);
    setHasSearchedPeople(false);
    setSelectedResultIndex(-1);
    setSearchAllCampuses(false);
  };

  const handleConfirmReturn = async () => {
    if (!itemToReturn) return;
    setIsLoading(true);

    let receiverName = '';
    let logMessage = '';

    if (returnType === 'PERSON') {
      if (isExternalPerson) {
        if (!externalName.trim()) {
          alert("Informe o nome da pessoa.");
          setIsLoading(false);
          return;
        }
        receiverName = externalName.trim();
        const docStr = externalDocument.trim() ? `${externalDocumentType}: ${externalDocument.trim()}` : '';
        const phoneStr = externalPhone.trim() ? `Tel: ${externalPhone.trim()}` : '';
        logMessage = `Item devolvido para: ${externalName.trim()}${docStr || phoneStr ? ` (${[docStr, phoneStr].filter(Boolean).join(', ')})` : ''}`;
      } else {
        if (!selectedPerson) {
          alert("Selecione uma pessoa.");
          setIsLoading(false);
          return;
        }
        receiverName = selectedPerson.name;
        logMessage = `Item devolvido para: ${selectedPerson.name} (${selectedPerson.matricula})`;
      }
    } else {
      if (!selectedReport) {
        alert("Selecione um relato.");
        setIsLoading(false);
        return;
      }
      receiverName = selectedReport.personName;
      logMessage = `Item vinculado ao Relato de Perda de ${selectedReport.personName}. Status do relato atualizado.`;

      const updatedReport: LostReport = {
        ...selectedReport,
        status: ReportStatus.RESOLVED,
        history: [...selectedReport.history, { date: new Date().toISOString(), note: `Item encontrado (ID: ${itemToReturn.id}) e devolvido.`, user: userString }]
      };
      await StorageService.saveReport(updatedReport);
    }

    const updatedItem = {
      ...itemToReturn,
      status: ItemStatus.RETURNED,
      returnedTo: receiverName,
      returnedDate: new Date().toISOString()
    };

    await StorageService.saveItem(updatedItem, logMessage, userString);

    onUpdate();
    setShowReturnModal(false);
    setItemToReturn(null);
    setIsLoading(false);
  };

  const handleCancelReturn = async (e: React.MouseEvent, item: FoundItem) => {
    e.stopPropagation();
    const action = item.status === ItemStatus.DISCARDED ? "cancelar o descarte" : "cancelar a devolução";

    if (confirm(`Deseja ${action} e marcar o item como Disponível novamente?`)) {
      const updated = {
        ...item,
        status: ItemStatus.AVAILABLE,
        returnedTo: undefined,
        returnedDate: undefined
      };
      await StorageService.saveItem(updated, `${action === "cancelar o descarte" ? 'Descarte' : 'Devolução'} cancelada. Item retornou para Disponível.`, userString);
      onUpdate();
    }
  };

  const handleBatchDonate = async () => {
    if (user.level === UserLevel.STANDARD) {
      alert("Ação não permitida para nível Padrão.");
      return;
    }

    if (confirm(`Registrar doação de ${selectedItems.length} itens selecionados?`)) {
      setIsLoading(true);
      try {
        const promises = selectedItems.map(async (id) => {
          const item = items.find(i => i.id === id);
          if (item) {
            return StorageService.saveItem({
              ...item,
              status: ItemStatus.DISCARDED,
              discardType: 'Doado',
              returnedDate: new Date().toISOString()
            }, 'Item doado via ação em lote.', userString);
          }
        });
        await Promise.all(promises);

        setSelectedItems([]);
        onUpdate();
      } catch (err: any) {
        alert(`Erro ao processar doação: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleExportDonatedPDF = async () => {
    const donatedItems = items.filter(
      i => i.status === ItemStatus.DISCARDED && i.discardType === 'Doado'
    );
    if (donatedItems.length === 0) {
      alert('Nenhum item doado para exportar.');
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth();

      // Header background
      doc.setFillColor(4, 120, 87);
      doc.rect(0, 0, pageW, 38, 'F');

      // IFRN Logo
      const logoX = 14;
      const logoY = 8;
      const sq = 2.6;
      const gap = 3;
      doc.setFillColor(203, 22, 29);
      doc.circle(logoX + sq / 2, logoY + sq / 2, sq / 2, 'F');
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(logoX + gap, logoY, sq, sq, 0.3, 0.3, 'F');
      doc.roundedRect(logoX + gap * 2, logoY, sq, sq, 0.3, 0.3, 'F');
      doc.roundedRect(logoX, logoY + gap, sq, sq, 0.3, 0.3, 'F');
      doc.roundedRect(logoX + gap, logoY + gap, sq, sq, 0.3, 0.3, 'F');
      doc.roundedRect(logoX, logoY + gap * 2, sq, sq, 0.3, 0.3, 'F');
      doc.roundedRect(logoX + gap, logoY + gap * 2, sq, sq, 0.3, 0.3, 'F');
      doc.roundedRect(logoX + gap * 2, logoY + gap * 2, sq, sq, 0.3, 0.3, 'F');
      doc.roundedRect(logoX, logoY + gap * 3, sq, sq, 0.3, 0.3, 'F');
      doc.roundedRect(logoX + gap, logoY + gap * 3, sq, sq, 0.3, 0.3, 'F');

      // Header text
      const textX = logoX + gap * 2 + sq + 6;
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('Relatório de Itens Doados', textX, 17);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`IFRN • Gerado em: ${new Date().toLocaleString('pt-BR')}`, textX, 27);

      // Stats boxes below header
      const statsY = 48;
      const boxH = 14;
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(14, statsY, 55, boxH, 2, 2, 'F');
      doc.setFillColor(4, 120, 87);
      doc.setTextColor(4, 120, 87);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(String(donatedItems.length), 26, statsY + 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Total de Itens Doados', 26, statsY + boxH - 2);

      // Table
      const tableData = donatedItems.map(item => [
        `#${item.campusItemId ?? item.id}`,
        item.description,
        item.returnedDate ? new Date(item.returnedDate).toLocaleDateString('pt-BR') : '-',
        item.returnedTo || '-',
        item.locationFound
      ]);
      autoTable(doc, {
        startY: statsY + boxH + 10,
        head: [['ID', 'Descrição', 'Data da Doação', 'Recebedor', 'Local Encontrado']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [4, 120, 87], fontSize: 9, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 120 },
          2: { cellWidth: 35 },
          3: { cellWidth: 55 },
          4: { cellWidth: 45 }
        }
      });

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200);
        doc.line(14, doc.internal.pageSize.height - 14, pageW - 14, doc.internal.pageSize.height - 14);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${totalPages}`, 14, doc.internal.pageSize.height - 6);
        doc.text(`Total de itens: ${donatedItems.length}`, pageW - 14, doc.internal.pageSize.height - 6, { align: 'right' });
      }
      doc.save(`relatorio_doacoes_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar o PDF. Verifique se as dependências estão instaladas.');
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const openDetails = (item: FoundItem) => {
    setViewingItem(item);
    setShowDetailModal(true);
  };

  const openEditModal = (item: FoundItem | null) => {
    // Limpeza agressiva de memória antes de abrir o modal
    // Especialmente importante para Android com pouca RAM
    if (itemImage?.startsWith('blob:')) {
      URL.revokeObjectURL(itemImage);
    }
    if (zoomImage?.startsWith('blob:')) {
      URL.revokeObjectURL(zoomImage);
    }

    setEditingItem(item);
    setItemImage(item?.imageUrl || null);
    setImageBlob(null);
    setZoomImage(null);
    setSelectedCampusId(item?.campus_id || '');
    setSelectedSetorId(item?.setor_id || '');
    setShowEditModal(true);

    // Forçar coleta de lixo (garbage collection) se disponível
    // Isso pode ajudar a liberar memória no Android
    if (typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch (e) {
        // Ignorar se gc não estiver disponível
      }
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const datePart = isoString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-6">
      {/* Mantendo a interface visível para preservar filtros e estado */}
      <>
        {/* Sub-tabs & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex p-1 bg-gray-200 rounded-lg">
            {availableTabs.map((status) => (
              <button
                key={status}
                onClick={() => { setActiveSubTab(status); setSelectedItems([]); }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${activeSubTab === status
                  ? 'bg-gradient-to-r from-ifrn-green to-ifrn-darkGreen text-white shadow-md shadow-green-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            {selectedItems.length > 0 && activeSubTab === ItemStatus.AVAILABLE && user.level !== UserLevel.STANDARD && (
              <button
                onClick={handleBatchDonate}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm shadow-md shadow-amber-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
              >
                <Gift size={16} /> Doar ({selectedItems.length})
              </button>
            )}
            {activeSubTab === ItemStatus.DISCARDED && items.some(i => i.discardType === 'Doado') && (
              <button
                onClick={handleExportDonatedPDF}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm shadow-md shadow-blue-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Relatório de Doações
              </button>
            )}
            <button
              onClick={() => openEditModal(null)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-ifrn-green to-ifrn-darkGreen text-white rounded-lg shadow-md shadow-green-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 text-sm w-full md:w-auto justify-center"
            >
              <Plus size={18} /> Novo Item
            </button>
          </div>
        </div>

        {/* Filters Area */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por ID, descrição ou palavras-chave..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ifrn-green focus:border-transparent outline-none text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {activeSubTab === ItemStatus.RETURNED && (
            <div className="relative flex-1 md:max-w-[200px]">
              <UserIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Quem retirou..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ifrn-green focus:border-transparent outline-none text-sm"
                value={recipientSearch}
                onChange={e => setRecipientSearch(e.target.value)}
              />
            </div>
          )}

          {activeSubTab === ItemStatus.RETURNED && (
            <div className="relative flex-1 md:max-w-[200px]">
              <History className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Quem devolveu..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ifrn-green focus:border-transparent outline-none text-sm"
                value={operatorSearch}
                onChange={e => setOperatorSearch(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
            <Calendar size={16} className="text-gray-500 ml-2" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
              className="bg-transparent border-none text-sm text-gray-700 focus:ring-0 cursor-pointer py-1.5"
            >
              <option value="ALL">Todo o período</option>
              <option value="TODAY">Hoje</option>
              <option value="WEEK">Esta Semana</option>
              <option value="THIS_MONTH">Este Mês</option>
              <option value="THIS_YEAR">Este Ano</option>
              <option value="SPECIFIC">Data Específica</option>
              <option value="CUSTOM">Data Personalizada</option>
            </select>

            {dateFilter === 'SPECIFIC' && (
              <div className="flex items-center gap-1 pl-2 border-l border-gray-300 animate-fadeIn">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-white outline-none focus:ring-1 focus:ring-ifrn-green"
                />
              </div>
            )}

            {dateFilter === 'CUSTOM' && (
              <div className="flex items-center gap-1 pl-2 border-l border-gray-300 animate-fadeIn">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-white"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="bg-gray-50/50 text-gray-500 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  {/* HEADERS FOR AVAILABLE */}
                  {activeSubTab === ItemStatus.AVAILABLE && (
                    <>
                      <th className="p-4 w-4">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) setSelectedItems(filteredItems.map(i => i.id));
                            else setSelectedItems([]);
                          }}
                          checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                          disabled={user.level === UserLevel.STANDARD}
                        />
                      </th>
                      <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('id')}>
                        <div className="flex items-center">ID {getSortIcon('id')}</div>
                      </th>
                      <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('description')}>
                        <div className="flex items-center">Descrição {getSortIcon('description')}</div>
                      </th>
                      <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('locationFound')}>
                        <div className="flex items-center">Local Encontrado {getSortIcon('locationFound')}</div>
                      </th>
                      <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('locationStored')}>
                        <div className="flex items-center">Guardado Em {getSortIcon('locationStored')}</div>
                      </th>
                      <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('dateFound')}>
                        <div className="flex items-center">Data {getSortIcon('dateFound')}</div>
                      </th>
                      <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('dateFound')}>
                        <div className="flex items-center">Tempo no Estoque {getSortIcon('dateFound')}</div>
                      </th>
                    </>
                  )}

                  {/* HEADERS FOR RETURNED / DISCARDED */}
                  {(activeSubTab === ItemStatus.RETURNED || activeSubTab === ItemStatus.DISCARDED) && (
                    <>
                      <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('id')}>
                        <div className="flex items-center">ID {getSortIcon('id')}</div>
                      </th>
                      <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('description')}>
                        <div className="flex items-center">Descrição {getSortIcon('description')}</div>
                      </th>
                      <th className="p-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('returnedDate')}>
                        <div className="flex items-center">Data de {activeSubTab === ItemStatus.RETURNED ? 'Devolução' : 'Saída'} {getSortIcon('returnedDate')}</div>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">Nenhum item encontrado com os filtros atuais.</td>
                  </tr>
                ) : (
                  paginatedItems.map(item => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => openDetails(item)}
                    >
                      {/* BODY FOR AVAILABLE */}
                      {activeSubTab === ItemStatus.AVAILABLE && (
                        <>
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(item.id)}
                              onChange={() => toggleSelection(item.id)}
                              disabled={user.level === UserLevel.STANDARD}
                            />
                          </td>
                          <td className="p-4 font-bold text-ifrn-green">{item.campusItemId ?? item.id}</td>
                          <td className="p-4">
                            <div className="font-medium text-gray-900 group flex items-center gap-2">
                              {item.description}
                              <Info size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {item.detailedDescription && (
                              <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">{item.detailedDescription}</div>
                            )}
                          </td>
                          <td className="p-4 text-gray-700">{item.locationFound}</td>
                          <td className="p-4 font-medium text-gray-800">{item.locationStored}</td>
                          <td className="p-4 text-gray-600">{formatDate(item.dateFound)}</td>
                          <td className="p-4 font-medium">{getDaysInStock(item.dateFound)}</td>
                        </>
                      )}

                      {/* BODY FOR RETURNED / DISCARDED */}
                      {(activeSubTab === ItemStatus.RETURNED || activeSubTab === ItemStatus.DISCARDED) && (
                        <>
                          <td className="p-4 font-bold text-ifrn-green">{item.campusItemId ?? item.id}</td>
                          <td className="p-4">
                            <div className="font-medium text-gray-900 group flex items-center gap-2">
                              {item.description}
                              {activeSubTab === ItemStatus.DISCARDED && item.discardType && (
                                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${item.discardType === 'Doado' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                  {item.discardType}
                                </span>
                              )}
                            </div>
                            {activeSubTab === ItemStatus.RETURNED && item.returnedTo && (
                              <div className="text-xs text-gray-500 mt-1">Para: {item.returnedTo}</div>
                            )}
                            {activeSubTab === ItemStatus.DISCARDED && item.history && item.history.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1 italic">
                                {item.history[item.history.length - 1].action}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-gray-600">
                            {item.returnedDate ? formatDate(item.returnedDate) : '-'}
                            {item.returnedDate && <span className="text-xs text-gray-400 ml-1">({new Date(item.returnedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>}
                          </td>
                        </>
                      )}

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination UI */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <div className="text-xs text-gray-500 font-medium">
                Mostrando <span className="text-gray-900">{paginatedItems.length}</span> de <span className="text-gray-900">{sortedItems.length}</span> itens
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
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
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all duration-200 ${currentPage === pageNum ? 'bg-gradient-to-r from-ifrn-green to-ifrn-darkGreen text-white shadow-md shadow-green-200' : 'hover:bg-gray-100 text-gray-600'}`}
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
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold disabled:opacity-30 hover:bg-white transition-colors"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </div>
      </>

      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); }}
        title={editingItem ? `Editar Item #${editingItem.campusItemId ?? editingItem.id}` : 'Cadastrar Novo Item'}
      >
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Curta *</label>
            <input name="description" required defaultValue={editingItem?.description} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Ex: Garrafa Azul" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Data que foi achado *</label>
            <input
              type="date"
              name="dateFound"
              required
              max={new Date().toISOString().split('T')[0]}
              defaultValue={editingItem?.dateFound || new Date().toISOString().split('T')[0]}
              className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Detalhada</label>
            <textarea name="detailedDescription" rows={3} defaultValue={editingItem?.detailedDescription} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Marca, detalhes de avaria, conteúdo..." />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Local onde foi achado *</label>
            <input name="locationFound" required defaultValue={editingItem?.locationFound} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Ex: Auditório" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Local de Armazenamento *</label>
            <input name="locationStored" required defaultValue={editingItem?.locationStored} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Ex: Armário 1" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Foto do Produto</label>
            <div className="mt-1 flex items-center gap-4">
              <div className="flex-1 relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-ifrn-green hover:bg-green-50 transition-all text-sm text-gray-500"
                >
                  <ImageIcon size={20} />
                  {itemImage ? 'Alterar Foto' : 'Selecionar ou Arraste Foto'}
                </label>
              </div>
              {itemImage && (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <img src={itemImage} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setItemImage(null)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {user.level === UserLevel.ADMIN && (
            <div className="col-span-2 bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-4">
              <div>
                <label className="block text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                  <Building2 size={16} /> Câmpus do Item *
                </label>
                <select
                  value={selectedCampusId}
                  onChange={e => { setSelectedCampusId(e.target.value); setSelectedSetorId(''); }}
                  className="w-full bg-white border-2 border-amber-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  required
                >
                  <option value="">Selecione para qual campus este item pertence...</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {selectedCampusId && setores.filter(s => s.campus_id === selectedCampusId).length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                    <Building2 size={16} /> Setor
                  </label>
                  <select
                    value={selectedSetorId}
                    onChange={e => setSelectedSetorId(e.target.value)}
                    className="w-full bg-white border-2 border-amber-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="">Selecione um setor...</option>
                    {setores.filter(s => s.campus_id === selectedCampusId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-[10px] text-amber-700 font-medium">
                Como administrador, você deve selecionar obrigatoriamente um câmpus.
              </p>
            </div>
          )}
          <div className="col-span-2 pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button type="submit" disabled={isLoading} className="px-6 py-2 bg-gradient-to-r from-ifrn-green to-ifrn-darkGreen text-white rounded-lg shadow-md shadow-green-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 font-medium">{isLoading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showReturnModal}
        onClose={() => { setShowReturnModal(false); setItemToReturn(null); setPersonSearch(''); setSelectedPerson(null); setSelectedReport(null); setReturnType('PERSON'); setIsExternalPerson(false); setExternalName(''); setExternalDocument(''); setExternalPhone(''); setSearchResultsPeople([]); setHasSearchedPeople(false); setSelectedResultIndex(-1); setSearchAllCampuses(false); }}
        title="Realizar Devolução do Item"
      >
        {/* Conteúdo do Modal de Devolução (mantém-se estruturalmente igual, apenas botões usam handleConfirmReturn que é async) */}
        <div className="space-y-6">
          <p className="text-sm text-gray-600">
            Você está devolvendo o item: <strong>{itemToReturn?.description}</strong>
          </p>

          <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
            <button onClick={() => setReturnType('PERSON')} className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${returnType === 'PERSON' ? 'bg-gradient-to-r from-ifrn-green to-ifrn-darkGreen text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}><UserIcon size={16} /> Selecionar Pessoa</button>
            <button onClick={() => setReturnType('REPORT')} className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${returnType === 'REPORT' ? 'bg-gradient-to-r from-ifrn-green to-ifrn-darkGreen text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}><FileText size={16} /> Vincular a Relato</button>
          </div>

          {returnType === 'PERSON' && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isExternalPerson}
                onChange={e => { setIsExternalPerson(e.target.checked); setSelectedPerson(null); setPersonSearch(''); setSearchResultsPeople([]); setExternalDocument(''); setExternalPhone(''); }}
                className="rounded border-gray-300 text-ifrn-green focus:ring-ifrn-green"
              />
              Pessoa Externa (não cadastrada)
            </label>
          )}

          {returnType === 'PERSON' && isExternalPerson ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Dados da Pessoa Externa</label>
              <input
                type="text"
                placeholder="Nome completo *"
                value={externalName}
                onChange={e => setExternalName(e.target.value)}
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={externalDocumentType}
                  onChange={e => { setExternalDocumentType(e.target.value as 'CPF' | 'RG' | 'Outros'); setExternalDocument(formatDocument(externalDocument, e.target.value)); }}
                  className="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-ifrn-green outline-none"
                >
                  <option value="CPF">CPF</option>
                  <option value="RG">RG</option>
                  <option value="Outros">Outros</option>
                </select>
                <input
                  type="text"
                  placeholder={externalDocumentType === 'CPF' ? '000.000.000-00' : 'Nº do documento'}
                  value={externalDocument}
                  onChange={e => setExternalDocument(formatDocument(e.target.value, externalDocumentType))}
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                />
              </div>
              <input
                type="text"
                placeholder="Telefone (opcional)"
                value={externalPhone}
                onChange={e => setExternalPhone(formatPhone(e.target.value))}
                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
              />
            </div>
          ) : returnType === 'PERSON' && (
            <div className="relative space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase block">Buscar Pessoa Cadastrada</label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer hover:text-ifrn-green transition-colors select-none">
                <input
                  type="checkbox"
                  checked={searchAllCampuses}
                  onChange={e => { setSearchAllCampuses(e.target.checked); setSearchResultsPeople([]); setSelectedResultIndex(-1); setHasSearchedPeople(false); }}
                  className="rounded border-gray-300 text-ifrn-green focus:ring-ifrn-green w-3 h-3"
                />
                Buscar em todos os Campi
              </label>
                <div className="relative flex-1">
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2.5 pr-14 text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                    placeholder="Digite o nome ou parte da matrícula..."
                    value={personSearch}
                    onChange={e => handlePersonSearch(e.target.value, false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (searchResultsPeople.length > 0 && selectedResultIndex >= 0) {
                          const p = searchResultsPeople[selectedResultIndex];
                          setSelectedPerson(p);
                          setPersonSearch(p.name);
                          setSearchResultsPeople([]);
                          setSelectedResultIndex(-1);
                        } else {
                          handlePersonSearch(personSearch, true);
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedResultIndex(prev =>
                          prev < searchResultsPeople.length - 1 ? prev + 1 : prev
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedResultIndex(prev => prev > 0 ? prev - 1 : prev);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handlePersonSearch(personSearch, true)}
                    className="absolute right-0 top-0 bottom-0 px-4 flex items-center justify-center text-gray-400 hover:text-ifrn-green transition-colors border-l"
                  >
                    {isSearchingPeople ? (
                      <Loader2 size={18} className="animate-spin text-ifrn-green" />
                    ) : (
                      <Search size={18} />
                    )}
                  </button>
                </div>

              {selectedPerson ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3 mt-2">
                  <div className="bg-green-100 p-2 rounded-full text-green-700">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-green-900 text-sm">{selectedPerson.name}</p>
                    <p className="text-xs text-green-700">{selectedPerson.matricula} • {selectedPerson.type}{selectedPerson.campus_id ? ` • ${campuses.find(c => c.id === selectedPerson.campus_id)?.name || selectedPerson.campus_id}` : ''}</p>
                  </div>
                  <CheckCircle size={20} className="text-green-600 ml-auto" />
                  <button
                    onClick={() => { setSelectedPerson(null); setPersonSearch(''); setSearchResultsPeople([]); }}
                    className="text-xs text-red-500 font-bold ml-2 underline"
                  >
                    Alterar
                  </button>
                </div>
              ) : (
                searchResultsPeople.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100 z-50 shadow-xl">
                    {searchResultsPeople.map((p, index) => (
                      <div
                        key={p.matricula}
                        onClick={() => {
                          setSelectedPerson(p);
                          setPersonSearch(p.name);
                          setSearchResultsPeople([]);
                          setSelectedResultIndex(-1);
                        }}
                        className={`p-3 cursor-pointer transition-colors ${selectedResultIndex === index ? 'bg-ifrn-green/10 border-l-4 border-ifrn-green' : 'hover:bg-gray-50'}`}
                      >
                        <p className="text-sm font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.matricula}{searchAllCampuses && p.campus_id ? ` • ${campuses.find(c => c.id === p.campus_id)?.name || p.campus_id}` : ''}</p>
                      </div>
                    ))}
                  </div>
                )
              )}
              {personSearch.length >= 2 && !isSearchingPeople && searchResultsPeople.length === 0 && !selectedPerson && hasSearchedPeople && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-lg p-3 text-center text-xs text-gray-400 italic shadow-xl z-50 flex items-center justify-center gap-2">
                  Nenhuma pessoa encontrada
                </div>
              )}
            </div>
          )}

          {returnType === 'REPORT' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Selecionar Relato de Perda (Aberto)</label>
              {openReports.length === 0 ? (
                <p className="text-sm text-gray-400 italic p-3 border rounded bg-gray-50">Não há relatos de perda em aberto.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {openReports.map(report => (
                    <div key={report.id} onClick={() => setSelectedReport(report)} className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedReport?.id === report.id ? 'border-ifrn-green bg-green-50 ring-1 ring-ifrn-green' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className="flex justify-between items-start"><div><p className="font-bold text-sm text-gray-800">{report.itemDescription}</p><p className="text-xs text-gray-500">Relatado por: <strong>{report.personName}</strong></p><p className="text-xs text-gray-400 mt-1">{new Date(report.createdAt).toLocaleDateString()}</p></div>{selectedReport?.id === report.id && <CheckCircle size={18} className="text-ifrn-green" />}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button onClick={() => setShowReturnModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
            <button onClick={handleConfirmReturn} disabled={isLoading} className="px-6 py-2 bg-gradient-to-r from-ifrn-green to-ifrn-darkGreen text-white rounded-lg shadow-md shadow-green-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 font-medium text-sm flex items-center gap-2">{isLoading ? '...' : <><CornerUpRight size={16} /> Confirmar Devolução</>}</button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedHistoryEntries([]); }}
        title="Detalhes do Objeto"
      >
        {viewingItem && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <span className="text-xs font-bold text-gray-400 uppercase">Descrição</span>
                <p className="text-lg font-bold text-gray-800">{viewingItem.description}</p>
                <p className="text-gray-600 mt-1">{viewingItem.detailedDescription || "Sem detalhes adicionais."}</p>
              </div>
              {viewingItem.imageUrl && (
                <div className="col-span-2">
                  <div
                    onClick={() => { setZoomImage(viewingItem.imageUrl!); setShowZoomModal(true); }}
                    className="relative rounded-xl overflow-hidden shadow-md border border-gray-200 aspect-video md:aspect-auto md:h-64 bg-gray-100 cursor-zoom-in group/img"
                  >
                    <img src={viewingItem.imageUrl} alt={viewingItem.description} className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-white/90 px-3 py-1.5 rounded-full text-xs font-bold text-gray-700 shadow-sm">Clique para ampliar</span>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">ID</span>
                <p className="font-mono text-ifrn-darkGreen font-bold">#{viewingItem.campusItemId ?? viewingItem.id}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Status</span>
                <p>
                  <span className={`border px-2 py-0.5 rounded text-xs font-bold ${getStatusColorClass(viewingItem.status)}`}>
                    {viewingItem.status}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Local Achado</span>
                <p>{viewingItem.locationFound}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Guardado Em</span>
                <p>{viewingItem.locationStored}</p>
              </div>
              {viewingItem.returnedTo && viewingItem.status === ItemStatus.RETURNED && (
                <div className="col-span-2 bg-green-50 p-2 rounded border border-green-100">
                  <span className="text-xs font-bold text-green-700 uppercase">Devolvido Para</span>
                  <p className="text-green-900 font-medium">{viewingItem.returnedTo}</p>
                  <p className="text-xs text-green-700">{new Date(viewingItem.returnedDate!).toLocaleString()}</p>
                </div>
              )}
              {viewingItem.status === ItemStatus.DISCARDED && viewingItem.returnedDate && (
                <>
                  <div className="col-span-2 bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-xs font-bold mb-1">
                      Descartado/Doado em
                    </div>
                    <p className="text-gray-800 font-semibold">{new Date(viewingItem.returnedDate).toLocaleString()}</p>
                  </div>
                  <div className="col-span-2 bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-700 text-xs font-bold mb-1">
                      <span>⚠️</span> Exclusão automática programada
                    </div>
                    <p className="text-red-600 text-sm font-semibold">
                      {(function() {
                        const now = Date.now();
                        const deadlineDays = viewingItem.discardType === 'Doado' ? 30 : 7;
                        const deletionDate = new Date(viewingItem.returnedDate!).getTime() + deadlineDays * 24 * 60 * 60 * 1000;
                        const diffMs = deletionDate - now;
                        if (diffMs <= 0) return 'Sendo excluído...';
                        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        if (days > 0) return `Este item será excluído definitivamente em ${days} dia${days > 1 ? 's' : ''} e ${hours}h`;
                        if (hours > 0) return `Este item será excluído definitivamente em ${hours}h e ${minutes}min`;
                        return `Este item será excluído definitivamente em ${minutes}min`;
                      })()}
                    </p>
                    <p className="text-red-400 text-[10px] mt-1">
                      Após a exclusão não será mais possível recuperar o item.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 border-b pb-2">
                <h4 className="flex items-center gap-2 font-bold text-gray-700">
                  <History size={18} /> Histórico do Objeto
                </h4>
                {user.level === UserLevel.ADMIN && viewingItem.history && viewingItem.history.length > 0 && selectedHistoryEntries.length > 0 && (
                  <button
                    onClick={handleBatchDeleteHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-xs font-bold transition-all"
                  >
                    <Trash2 size={14} /> Excluir ({selectedHistoryEntries.length})
                  </button>
                )}
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {viewingItem.history && viewingItem.history.length > 0 ? (
                  viewingItem.history.slice().reverse().map((log, index) => {
                    const realIndex = viewingItem.history!.length - 1 - index;
                    return (
                      <div key={index} className="flex gap-3 text-sm group items-start">
                        {user.level === UserLevel.ADMIN && (
                          <input
                            type="checkbox"
                            checked={selectedHistoryEntries.includes(realIndex)}
                            onChange={() => toggleHistorySelection(realIndex)}
                            className="mt-1.5 rounded border-gray-300 text-ifrn-green focus:ring-ifrn-green"
                          />
                        )}
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5"></div>
                          {index !== viewingItem.history!.length - 1 && <div className="w-px h-full bg-gray-200 my-1"></div>}
                        </div>
                        <div className="flex-1 flex justify-between items-start">
                          <div>
                            <p className="text-gray-800">{log.action}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(log.date).toLocaleString()} • Por: {log.user || 'Sistema'}
                            </p>
                          </div>
                          {user.level === UserLevel.ADMIN && (
                            <button
                              onClick={() => handleDeleteHistoryEntry(viewingItem, realIndex)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500"
                              title="Excluir este registro do histórico"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-gray-400 italic">Nenhum histórico registrado para este item.</p>
                )}
              </div>
              {user.level === UserLevel.ADMIN && viewingItem.history && viewingItem.history.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    <input
                      type="checkbox"
                      checked={viewingItem.history.length > 0 && selectedHistoryEntries.length === viewingItem.history.length}
                      onChange={(e) => setSelectedHistoryEntries(e.target.checked ? viewingItem.history!.map((_, i) => i) : [])}
                      className="rounded border-gray-300 text-ifrn-green focus:ring-ifrn-green"
                    />
                    Selecionar todos
                  </label>
                </div>
              )}
            </div>

            {user.level === UserLevel.ADMIN && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <label className="block text-sm font-bold text-amber-900 mb-1 flex items-center gap-2">
                  <Building2 size={16} /> Câmpus do Item
                </label>
                <p className="text-amber-900 font-bold text-lg">
                  {campuses.find(c => c.id === viewingItem.campus_id)?.name || 'Câmpus não identificado'}
                </p>
                <p className="text-[10px] text-amber-700 mt-1 font-medium italic">
                  Para alterar o câmpus, clique no botão "Editar" abaixo.
                </p>
              </div>
            )}

            <div className="flex flex-col md:flex-row justify-between pt-4 border-t border-gray-100 mt-4 gap-4">
              <div className="flex gap-2 flex-wrap">
                {viewingItem.status === ItemStatus.AVAILABLE && (
                  <>
                    <button
                      onClick={(e) => { setShowDetailModal(false); handleOpenReturnModal(e, viewingItem); }}
                      className="px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-md shadow-blue-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 text-sm font-medium flex items-center gap-2"
                      title="Devolver ou dar baixa neste item"
                    >
                      <CornerUpRight size={16} /> Devolver
                    </button>

                    <button
                      onClick={() => { setShowDetailModal(false); openEditModal(viewingItem); }}
                      className="px-3 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg shadow-md shadow-orange-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 text-sm font-medium flex items-center gap-2"
                      title="Editar detalhes do item"
                    >
                      <Pencil size={16} /> Editar
                    </button>

                    {user.level !== UserLevel.STANDARD && (
                      <button
                        onClick={(e) => { setShowDetailModal(false); handleDelete(e, viewingItem.id); }}
                        className="px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg shadow-md shadow-red-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 text-sm font-medium flex items-center gap-2"
                        title={user.level === UserLevel.ADMIN ? "Excluir item permanentemente" : "Excluir ou Descartar item"}
                      >
                        <Trash2 size={16} /> {user.level === UserLevel.ADMIN ? "Excluir" : "Excluir"}
                      </button>
                    )}
                  </>
                )}
                {(viewingItem.status === ItemStatus.RETURNED || viewingItem.status === ItemStatus.DISCARDED) && user.level !== UserLevel.STANDARD && (
                  <button
                    onClick={(e) => { setShowDetailModal(false); handleCancelReturn(e, viewingItem); }}
                      className="px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg shadow-md shadow-amber-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 text-sm font-medium flex items-center gap-2"
                  >
                    <RotateCcw size={16} /> Estornar
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showZoomModal}
        onClose={() => { setShowZoomModal(false); if (onToggleSleep) onToggleSleep(false); }}
        title="Visualização da Imagem"
        maxWidth="max-w-5xl"
      >
        <div className="space-y-4">
          <ImageViewer
            src={zoomImage || ''}
            alt={viewingItem?.description || 'Imagem'}
          />

          <div className="flex justify-center items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
            <div className="flex gap-3">
              <button
                onClick={() => { setShowZoomModal(false); if (onToggleSleep) onToggleSleep(false); }}
                className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold uppercase tracking-wider transition-all"
              >
                Voltar
              </button>
              <button
                onClick={() => handleShareImage(zoomImage!, `item-${viewingItem?.id || 'foto'}`)}
                className="flex items-center gap-2 px-8 py-2 bg-gradient-to-r from-ifrn-green to-ifrn-darkGreen text-white rounded-lg font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 uppercase tracking-wider"
              >
                <Share size={18} /> Enviar Imagem
              </button>
            </div>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        title="Excluir ou Descartar Item"
      >
        <div className="space-y-6">
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <p className="text-amber-800 text-sm">
              Você está prestes a remover o item <strong>{itemToDiscard?.description}</strong>. Escolha como deseja proceder:
            </p>
          </div>

          <div className="space-y-4">
            <div
              onClick={() => setDiscardType('Descartado')}
              className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${discardType === 'Descartado' ? 'border-amber-500 bg-amber-50' : 'border-gray-100 hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${discardType === 'Descartado' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <Trash2 size={20} />
                </div>
                <div>
                  <p className="font-bold text-gray-800">Mover para Descartado</p>
                  <p className="text-xs text-gray-500">O item será movido para a aba Descartado/Doado com histórico.</p>
                </div>
              </div>
            </div>

            <div
              onClick={() => setDiscardType('Doado')}
              className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${discardType === 'Doado' ? 'border-amber-500 bg-amber-50' : 'border-gray-100 hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${discardType === 'Doado' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <Gift size={20} />
                </div>
                <div>
                  <p className="font-bold text-gray-800">Mover para Doado</p>
                  <p className="text-xs text-gray-500">O item será registrado como doação para fins de auditoria.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t">
            <button
              onClick={() => handleConfirmDiscard('SOFT')}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-amber-200"
            >
              Confirmar Movimentação
            </button>
            {user.level === UserLevel.ADMIN && (
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir permanentemente? Esta ação apaga os dados e a foto do item para sempre.')) {
                    handleConfirmDiscard('HARD');
                  }
                }}
                className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
              >
                Excluir Definitivamente (Permanente)
              </button>
            )}
            <button
              onClick={() => setShowDiscardModal(false)}
              className="w-full py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};