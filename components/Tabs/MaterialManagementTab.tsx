import React, { useState, useMemo, useEffect } from 'react';
import { Material, MaterialLoan } from '../../types-materiais';
import { Person, User, Campus, UserLevel } from '../../types';
import { StorageService } from '../../services/storage';
import { EmailService } from '../../services/emailService';
import { Search, Plus, Edit2, Trash2, Hash, AlertTriangle, Copy, CheckCircle, AlertCircle, Calendar, User as UserIcon, FileText, CornerUpRight, TrendingUp, Loader2, Users, GraduationCap, UserCog, Package, Mail } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
    materials: Material[];
    loans: MaterialLoan[];
    user: User;
    onUpdate: () => void;
    campuses: Campus[];
    adminGlobalCampusId?: string | null;
}

export const MaterialManagementTab: React.FC<Props> = ({ materials = [], loans = [], user, onUpdate, campuses, adminGlobalCampusId }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'LOANED'>('ALL');
    const [activeTab, setActiveTab] = useState<'management' | 'reports'>('management');

    // Pagination
    const ITEMS_PER_PAGE = 20;
    const [currentPageInventory, setCurrentPageInventory] = useState(1);
    const [currentPageReports, setCurrentPageReports] = useState(1);

    // Material form
    const [showMaterialForm, setShowMaterialForm] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
    const [formMaterialName, setFormMaterialName] = useState('');
    const [batchMaterialText, setBatchMaterialText] = useState('');
    const [materialFormMode, setMaterialFormMode] = useState<'single' | 'batch'>('single');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [lastRegisteredCount, setLastRegisteredCount] = useState(0);
    const [copiedCode, setCopiedCode] = useState(false);

    // Loan form
    const [showLoanForm, setShowLoanForm] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [personSearch, setPersonSearch] = useState('');
    const [searchResultsPeople, setSearchResultsPeople] = useState<Person[]>([]);
    const [isSearchingPeople, setIsSearchingPeople] = useState(false);
    const [personTypeFilter, setPersonTypeFilter] = useState<'ALL' | 'Aluno' | 'Servidor'>('ALL');
    const [hasSearchedPeople, setHasSearchedPeople] = useState(false);
    const [selectedResultIndex, setSelectedResultIndex] = useState(0);
    const [selectedMaterials, setSelectedMaterials] = useState<Material[]>([]);
    const [materialSearch, setMaterialSearch] = useState('');
    const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
    const [observation, setObservation] = useState('');
    const [viewingItem, setViewingItem] = useState<(Material & { status: 'LOANED' | 'AVAILABLE'; activeLoan: MaterialLoan | null }) | null>(null);

    // Reports Filter
    const [reportSearch, setReportSearch] = useState('');
    const [reportDateStart, setReportDateStart] = useState('');
    const [reportDateEnd, setReportDateEnd] = useState('');
    const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
    const [showDeleteReportConfirm, setShowDeleteReportConfirm] = useState(false);
    const [isDeletingReport, setIsDeletingReport] = useState(false);

    // Viewing
    const [viewingLoan, setViewingLoan] = useState<MaterialLoan | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedCampusId, setSelectedCampusId] = useState<string>(
        (user.level === UserLevel.ADMIN ? adminGlobalCampusId : user.campus_id) || ''
    );
    const [emailNotificationEnabled, setEmailNotificationEnabled] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [sendingCharge, setSendingCharge] = useState(false);
    const [chargeHistory, setChargeHistory] = useState<import('../../types-materiais').ChargeHistory[]>([]);
    const [loadingChargeHistory, setLoadingChargeHistory] = useState(false);

    const campusIdForConfig = user.level === UserLevel.ADMIN ? (selectedCampusId || user.campus_id) : user.campus_id;

    useEffect(() => {
        if (!campusIdForConfig) {
            setLoadingConfig(false);
            return;
        }
        StorageService.getCampusConfig(campusIdForConfig).then(config => {
            if (config) {
                setEmailNotificationEnabled(config.material_email_notification);
            }
            setLoadingConfig(false);
        }).catch(() => setLoadingConfig(false));
    }, [campusIdForConfig]);

    useEffect(() => {
        if (viewingItem?.activeLoan) {
            setLoadingChargeHistory(true);
            StorageService.getChargeHistory(viewingItem.activeLoan.id).then(history => {
                setChargeHistory(history);
                setLoadingChargeHistory(false);
            }).catch(() => setLoadingChargeHistory(false));
        } else {
            setChargeHistory([]);
        }
    }, [viewingItem]);

    const toggleEmailNotification = async () => {
        if (!campusIdForConfig) return;
        const newValue = !emailNotificationEnabled;
        try {
            await StorageService.saveCampusConfig(campusIdForConfig, newValue);
            setEmailNotificationEnabled(newValue);
        } catch (err) {
            const msg = (err as any)?.message || '';
            if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('campus_config')) {
                alert('Configuração não disponível. Execute o SQL em scripts/criar-tabela-campus-config.sql no Supabase.');
            } else {
                alert('Erro ao salvar configuração: ' + msg);
            }
        }
    };

    // Sync with global admin campus selector
    useEffect(() => {
        if (user.level === UserLevel.ADMIN && adminGlobalCampusId !== undefined) {
            setSelectedCampusId(adminGlobalCampusId || '');
        }
    }, [adminGlobalCampusId, user.level]);

    // Reset pagination on search or tab changes
    useMemo(() => {
        setCurrentPageInventory(1);
    }, [searchTerm, filterStatus]);

    useMemo(() => {
        setCurrentPageReports(1);
    }, [reportSearch, reportDateStart, reportDateEnd]);

    useEffect(() => {
        setCurrentPageInventory(1);
        setCurrentPageReports(1);
    }, [activeTab]);

    const stats = useMemo(() => {
        const active = loans.filter(l => l.status === 'ACTIVE').length;
        const returned = loans.filter(l => l.status === 'RETURNED').length;
        return { active, returned, total: loans.length };
    }, [loans]);

    const inventory = useMemo(() => {
        const activeLoansMap = new Map<string, MaterialLoan>();
        loans.forEach(loan => {
            if (loan.status === 'ACTIVE') {
                activeLoansMap.set(loan.materialId, loan);
            }
        });

        return materials.map(material => {
            const activeLoan = activeLoansMap.get(material.id);
            return {
                ...material,
                status: (activeLoan ? 'LOANED' : 'AVAILABLE') as 'LOANED' | 'AVAILABLE',
                activeLoan: activeLoan || null
            };
        });
    }, [materials, loans]);

    const normalizeText = (text: string) => {
        return text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    };

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const matchesSearch =
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.activeLoan?.personName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.activeLoan?.personMatricula || '').toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (filterStatus === 'ALL') return true;
            if (filterStatus === 'AVAILABLE') return item.status === 'AVAILABLE';
            if (filterStatus === 'LOANED') return item.status === 'LOANED';
            return true;
        });
    }, [inventory, searchTerm, filterStatus]);

    const paginatedInventory = useMemo(() => {
        const start = (currentPageInventory - 1) * ITEMS_PER_PAGE;
        return filteredInventory.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredInventory, currentPageInventory]);

    const totalPagesInventory = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);

    const handlePersonSearch = async (val?: string, isTriggered: boolean = true) => {
        const query = val !== undefined ? val : personSearch;
        
        if (!isTriggered) {
            setHasSearchedPeople(false);
            setSearchResultsPeople([]);
            setSelectedResultIndex(0);
            return;
        }

        if (query.trim().length >= 2) {
            setIsSearchingPeople(true);
            setHasSearchedPeople(true);
            setSelectedResultIndex(0);
            try {
                const results = await StorageService.searchPeople(query, 10, user.campus_id || undefined, personTypeFilter);
                setSearchResultsPeople(results.slice(0, 10));
            } catch (error) {
                console.error("Erro na busca:", error);
            } finally {
                setIsSearchingPeople(false);
            }
        } else {
            setSearchResultsPeople([]);
            setHasSearchedPeople(false);
        }
    };

    const filteredMaterialsForLoan = useMemo(() => {
        const normalizedSearchTerms = normalizeText(materialSearch).split(/\s+/).filter((t: string) => t.length > 0);

        return inventory.filter(item => {
            if (item.status !== 'AVAILABLE') return false;
            // Ocultar se já estiver selecionado
            if (selectedMaterials.some(sm => sm.id === item.id)) return false;

            if (normalizedSearchTerms.length === 0) return true;

            const materialText = normalizeText(`${item.name} ${item.code}`);
            return normalizedSearchTerms.every((term: string) => materialText.includes(term));
        }).slice(0, 10);
    }, [inventory, materialSearch, selectedMaterials]);



    const stripPrefix = (code: string): string => {
        if (!code) return '';
        if (code.includes(' ... ')) {
            const parts = code.split(' ... ');
            return `${stripPrefix(parts[0])} ... ${stripPrefix(parts[1])}`;
        }
        // O código agora é slug-numero (ex: natal-central-001)
        // Pegamos apenas a parte numérica final
        const parts = code.split('-');
        const lastPart = parts[parts.length - 1];
        // Se a última parte for numérica, retornamos ela. 
        // Caso contrário (códigos legados sem hífen), retorna o original.
        return /^\d+$/.test(lastPart) ? lastPart : code;
    };

    const handleMaterialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Obter o próximo número de código global direto do banco de dados
        // Para evitar colisões entre campi, adicionamos um prefixo baseado no campus atual
        const campusId = user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id;
        const currentCampus = campuses.find(c => c.id === campusId);

        // Gerar um prefixo Robusto: Usamos o slug do campus para garantir unicidade
        const prefix = currentCampus ? currentCampus.slug : 'material';

        let nextNum = 1;
        try {
            const maxCode = await StorageService.getMaxMaterialCode(prefix);
            if (maxCode && maxCode.startsWith(prefix)) {
                // Tenta extrair o número após o prefixo (ex: "slug-campus-050" -> 50)
                const parts = maxCode.split('-');
                const lastPart = parts[parts.length - 1];
                if (lastPart && /^\d+$/.test(lastPart)) {
                    nextNum = parseInt(lastPart, 10) + 1;
                }
            }
        } catch (error) {
            console.warn('Erro ao buscar código máximo no banco:', error);
            // Fallback local se o banco falhar
            materials.forEach(m => {
                if (m.code.startsWith(prefix)) {
                    const parts = m.code.split('-');
                    const numPart = parts.pop();
                    const n = parseInt(numPart || '0', 10);
                    if (!isNaN(n) && n >= nextNum) nextNum = n + 1;
                }
            });
        }

        if (materialFormMode === 'single') {
            const code = editingMaterial?.code || `${prefix}-${nextNum.toString().padStart(3, '0')}`;
            const material: Material = {
                id: editingMaterial?.id || Math.random().toString(36).substr(2, 9),
                code: code,
                name: formMaterialName.trim(),
                createdAt: editingMaterial?.createdAt || new Date().toISOString(),
                campus_id: campusId
            };

            try {
                await StorageService.saveMaterial(material);
                await onUpdate();
                setShowMaterialForm(false);

                if (!editingMaterial) {
                    setGeneratedCode(code);
                    setLastRegisteredCount(1);
                    setShowSuccessModal(true);
                } else {
                    alert('Material atualizado!');
                }
            } catch (error: any) {
                console.error('Erro ao salvar material:', error);
                alert(`Erro ao salvar material: ${error.message || 'Verifique a conexão com o banco de dados.'}`);
            }
        } else {
            // Batch Mode
            const lines = batchMaterialText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length === 0) {
                alert('Nenhum material informado para cadastro em lote.');
                return;
            }

            const newMaterials: Material[] = [];
            const startNum = nextNum;

            lines.forEach(name => {
                const code = `${prefix}-${nextNum.toString().padStart(3, '0')}`;
                newMaterials.push({
                    id: Math.random().toString(36).substr(2, 9),
                    code: code,
                    name: name,
                    createdAt: new Date().toISOString(),
                    campus_id: campusId
                });
                nextNum++;
            });

            const startCode = `${prefix}-${startNum.toString().padStart(3, '0')}`;
            const endCode = `${prefix}-${(nextNum - 1).toString().padStart(3, '0')}`;

            try {
                await StorageService.saveMaterialsBulk(newMaterials);
                await onUpdate();
                setShowMaterialForm(false);
                setBatchMaterialText('');
                setLastRegisteredCount(newMaterials.length);
                setGeneratedCode(newMaterials.length === 1 ? startCode : `${startCode} ... ${endCode}`);
                setShowSuccessModal(true);
            } catch (error: any) {
                console.error('Erro ao salvar materiais em lote:', error);
                alert(`Erro ao salvar materiais em lote: ${error.message || 'Verifique a conexão com o banco de dados.'}`);
            }
        }
    };

    const handleLoanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedPerson || selectedMaterials.length === 0) {
            alert('Selecione pessoa e pelo menos um material.');
            return;
        }

        // Cadastro Sem E-mail: Opção B - Alerta e pergunta se deseja prosseguir
        if (!selectedPerson.email) {
            const proceed = window.confirm(`Atenção: A pessoa '${selectedPerson.name}' não possui e-mail cadastrado. Deseja prosseguir com o empréstimo sem notificações por e-mail?`);
            if (!proceed) return;
        }

        const newLoans = selectedMaterials.map(mat => ({
            id: Math.random().toString(36).substr(2, 9),
            materialId: mat.id,
            materialName: mat.name,
            materialCode: mat.code,
            personName: selectedPerson.name,
            personMatricula: selectedPerson.matricula,
            personEmail: selectedPerson.email,
            loanDate: new Date().toISOString(),
            observation: observation.trim() || undefined,
            status: 'ACTIVE' as const,
            loanedBy: `${user.name} (${user.matricula})`,
            campus_id: user.level === UserLevel.ADMIN ? (selectedCampusId || user.campus_id) : user.campus_id
        }));

        try {
            for (const loan of newLoans) {
                await StorageService.saveMaterialLoan(loan);
            }
            onUpdate();
            setShowLoanForm(false);
            setSelectedPerson(null);
            setPersonSearch('');
            setSelectedMaterials([]);
            setMaterialSearch('');
            setObservation('');

            // Enviar e-mail único de notificação
            if (selectedPerson.email && emailNotificationEnabled) {
                const currentCampus = campuses.find(c => c.id === (user.level === UserLevel.ADMIN ? (selectedCampusId || user.campus_id) : user.campus_id));
                const res = await EmailService.sendLoanBatchNotification(
                    selectedPerson.email,
                    selectedPerson.name,
                    newLoans.map(l => ({ materialName: l.materialName, loanDate: l.loanDate })),
                    user.name,
                    user.email,
                    currentCampus?.name
                );
                if (!res.success) {
                    alert(`${newLoans.length} empréstimo(s) registrado(s) com sucesso!\n\n⚠️ Mas a notificação por e-mail falhou.`);
                } else {
                    alert(`${newLoans.length} empréstimo(s) registrado(s) com sucesso!`);
                }
            } else {
                alert(`${newLoans.length} empréstimo(s) registrado(s) com sucesso!`);
            }
        } catch (error) {
            alert('Erro ao registrar empréstimo.');
        }
    };

    const handleReturn = async (loan: MaterialLoan) => {
        if (loan.status === 'RETURNED') return;

        try {
            await StorageService.returnMaterialLoan(loan.id, `${user.name} (${user.matricula})`);
            onUpdate();
            setViewingLoan(null);

            // Enviar e-mail de devolução
            if (loan.personEmail && emailNotificationEnabled) {
                const campusName = campuses.find(c => c.id === user.campus_id)?.name;
                const res = await EmailService.sendReturnNotification(
                    loan.personEmail,
                    loan.personName,
                    loan.materialName,
                    loan.materialCode,
                    new Date().toISOString(),
                    user.name,
                    user.email,
                    campusName
                );
                if (!res.success) {
                    alert('Material devolvido com sucesso!\n\n⚠️ A notificação por e-mail falhou.');
                    return;
                }
            }

            alert('Material devolvido com sucesso!');
        } catch (error) {
            alert('Erro ao processar devolução.');
        }
    };

    const handleSendCharge = async (loan: MaterialLoan) => {
        let personEmail = loan.personEmail;
        if (!personEmail) {
            try {
                personEmail = await StorageService.getPersonEmail(loan.personMatricula);
            } catch (e: any) {
                alert('Erro ao buscar email: ' + (e?.message || String(e)));
            }
        }
        if (!personEmail) {
            alert('Esta pessoa não possui e-mail cadastrado para envio de cobrança.');
            return;
        }
        setSendingCharge(true);
        try {
            const campusName = campuses.find(c => c.id === user.campus_id)?.name;
            const res = await EmailService.sendChargeNotification(
                personEmail,
                loan.personName,
                loan.materialName,
                loan.materialCode,
                loan.loanDate,
                user.email,
                campusName
            );
            if (res.success) {
                try {
                    await StorageService.logChargeSent({
                        loan_id: loan.id,
                        material_id: loan.materialId,
                        person_email: personEmail,
                        person_name: loan.personName,
                        triggered_by_name: `${user.name} (${user.matricula})`,
                        triggered_by_email: user.email,
                        campus_id: user.campus_id
                    });
                } catch (logErr: any) {
                    const msg = logErr?.message || '';
                    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('charge_history')) {
                        alert('Lembrete enviado! Mas o histórico não foi registrado. Execute o SQL em scripts/criar-tabela-charge-history.sql no Supabase.');
                    } else {
                        alert('Lembrete enviado! Mas houve erro ao registrar histórico: ' + msg);
                    }
                }
                const updated = await StorageService.getChargeHistory(loan.id);
                setChargeHistory(updated);
                alert('Lembrete enviado com sucesso!');
            } else {
                alert('Erro ao enviar o lembrete: ' + (res.error || ''));
            }
        } catch (error) {
            alert('Erro ao enviar o lembrete.');
        } finally {
            setSendingCharge(false);
        }
    };

    const handleDeleteBulk = async () => {
        if (!selectedIds.length) return;

        const confirmMsg = selectedIds.length === 1
            ? 'Tem certeza que deseja excluir este material? Empréstimos ativos serão marcados como DELETADOS.'
            : `Tem certeza que deseja excluir os ${selectedIds.length} materiais selecionados? Empréstimos ativos serão marcados como DELETADOS.`;

        if (!window.confirm(confirmMsg)) return;

        setIsDeleting(true);
        try {
            await StorageService.deleteMaterialsBulk(selectedIds);
            await onUpdate();
            setSelectedIds([]);
            alert('Material(is) excluído(s) com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro ao excluir material(is).');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReturnBulk = async () => {
        const loanedItems = filteredInventory.filter(item => selectedIds.includes(item.id) && item.status === 'LOANED' && item.activeLoan);

        if (loanedItems.length === 0) return;

        const confirmMsg = loanedItems.length === 1
            ? 'Tem certeza que deseja registrar a devolução deste material?'
            : `Tem certeza que deseja registrar a devolução dos ${loanedItems.length} materiais selecionados?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const loanIds = loanedItems.map(item => item.activeLoan!.id);
            await StorageService.returnMaterialLoansBulk(loanIds, `${user.name} (${user.matricula})`);
            await onUpdate();
            setSelectedIds([]);

            // Enviar e-mails de notificação de devolução em lote (um por pessoa)
            let batchEmailOk = true;
            if (emailNotificationEnabled) {
                const campusName = campuses.find(c => c.id === user.campus_id)?.name;
                const byEmail: Record<string, { personName: string; items: { materialName: string }[] }> = {};
                for (const item of loanedItems) {
                    const loan = item.activeLoan;
                    if (loan?.personEmail) {
                        if (!byEmail[loan.personEmail]) {
                            byEmail[loan.personEmail] = { personName: loan.personName, items: [] };
                        }
                        byEmail[loan.personEmail].items.push({ materialName: loan.materialName });
                    }
                }
                for (const [email, data] of Object.entries(byEmail)) {
                    const res = await EmailService.sendReturnBatchNotification(
                        email, data.personName, data.items, user.name, user.email, campusName
                    );
                    if (!res.success) batchEmailOk = false;
                }
            }

            if (loanedItems.length > 0) {
                alert(`${loanedItems.length} material(is) devolvido(s) com sucesso!${batchEmailOk ? '' : '\n\n⚠️ Mas a notificação por e-mail falhou para algumas pessoa(s).'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao processar devolução em lote.');
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredInventory.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredInventory.map(i => i.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const isAdminOrAdvanced = user.level === 'Administrador' || user.level === 'Avançado';

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(generatedCode);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        } catch (error) {
            alert('Erro ao copiar código.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 inline-flex">
                <button
                    onClick={() => setActiveTab('management')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'management' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <FileText size={18} /> Gerenciar Materiais
                </button>
                <button
                    onClick={() => setActiveTab('reports')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <Calendar size={18} /> Relatório de Movimentações
                </button>
            </div>

            {/* MANAGEMENT TAB */}
            {activeTab === 'management' && (
                <div className="space-y-6 animate-fadeIn">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => setFilterStatus('ALL')}
                            className={`rounded-xl p-6 text-white text-left transition-all transform hover:scale-[1.02] border-4 ${filterStatus === 'ALL' ? 'border-indigo-300 shadow-xl scale-[1.02]' : 'border-transparent hover:shadow-lg'} bg-gradient-to-br from-indigo-500 to-purple-600`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-indigo-100 text-sm font-medium">Total de Materiais</p>
                                    <p className="text-4xl font-black mt-2">{materials.length}</p>
                                </div>
                                <div className="bg-white/20 p-3 rounded-lg">
                                    <TrendingUp size={32} />
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => setFilterStatus('AVAILABLE')}
                            className={`rounded-xl p-6 text-white text-left transition-all transform hover:scale-[1.02] border-4 ${filterStatus === 'AVAILABLE' ? 'border-green-300 shadow-xl scale-[1.02]' : 'border-transparent hover:shadow-lg'} bg-gradient-to-br from-green-500 to-emerald-600`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-green-100 text-sm font-medium">Disponíveis</p>
                                    <p className="text-4xl font-black mt-2">{inventory.filter(i => i.status === 'AVAILABLE').length}</p>
                                </div>
                                <div className="bg-white/20 p-3 rounded-lg">
                                    <CheckCircle size={32} />
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => setFilterStatus('LOANED')}
                            className={`rounded-xl p-6 text-white text-left transition-all transform hover:scale-[1.02] border-4 ${filterStatus === 'LOANED' ? 'border-amber-300 shadow-xl scale-[1.02]' : 'border-transparent hover:shadow-lg'} bg-gradient-to-br from-amber-500 to-orange-600`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-amber-100 text-sm font-medium">Emprestados</p>
                                    <p className="text-4xl font-black mt-2">{inventory.filter(i => i.status === 'LOANED').length}</p>
                                </div>
                                <div className="bg-white/20 p-3 rounded-lg">
                                    <AlertCircle size={32} />
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="relative w-full sm:w-96">
                            <input
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                placeholder="Pesquisar material, código..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            {isAdminOrAdvanced && selectedIds.length > 0 && (
                                <button
                                    onClick={handleDeleteBulk}
                                    disabled={isDeleting}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow-sm hover:bg-red-700 transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    {isDeleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                                    Excluir ({selectedIds.length})
                                </button>
                            )}
                            {selectedIds.length > 0 && filteredInventory.some(i => selectedIds.includes(i.id) && i.status === 'LOANED') && (
                                <button
                                    onClick={handleReturnBulk}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-amber-600 text-white font-bold rounded-lg shadow-sm hover:bg-amber-700 transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    <CornerUpRight size={18} />
                                    Devolver em Lote ({filteredInventory.filter(i => selectedIds.includes(i.id) && i.status === 'LOANED').length})
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setEditingMaterial(null);
                                    setFormMaterialName('');
                                    setBatchMaterialText('');
                                    setMaterialFormMode('single');
                                    setPersonTypeFilter('ALL');
                                    setShowMaterialForm(true);
                                }}
                                className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <Plus size={18} /> Cadastrar Material
                            </button>
                            <button
                                onClick={() => {
                                    setPersonTypeFilter('ALL');
                                    setShowLoanForm(true);
                                }}
                                className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <Plus size={18} /> Novo Empréstimo
                            </button>
                            <button
                                onClick={toggleEmailNotification}
                                disabled={loadingConfig}
                                className={`flex-1 sm:flex-none px-3 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                                    loadingConfig
                                    ? 'bg-gray-50 text-gray-300 border-gray-100'
                                    : emailNotificationEnabled
                                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                }`}
                                title="Ativar/desativar notificações por e-mail"
                            >
                                <Mail size={16} />
                                {loadingConfig ? '...' : emailNotificationEnabled ? 'E-mail Ativo' : 'E-mail Off'}
                            </button>
                        </div>
                    </div>


                    {/* Inventory Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
                                    <tr>
                                        <th className="p-4 w-10">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={filteredInventory.length > 0 && selectedIds.length === filteredInventory.length}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th className="p-4 text-left">Código</th>
                                        <th className="p-4 text-left">Material</th>
                                        <th className="p-4 text-left">Status</th>
                                        <th className="p-4 text-left">Emprestado Para</th>
                                        <th className="p-4 text-left">Desde</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedInventory.map(item => (
                                        <tr
                                            key={item.id}
                                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedIds.includes(item.id) ? 'bg-indigo-50/50' : ''}`}
                                            onClick={() => setViewingItem(item)}
                                        >
                                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    checked={selectedIds.includes(item.id)}
                                                    onChange={() => toggleSelectOne(item.id)}
                                                />
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <Hash size={14} className="text-indigo-500" />
                                                    <span className="font-mono text-xs font-bold text-indigo-600">{stripPrefix(item.code)}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 font-bold text-gray-800">{item.name}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${item.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                                    {item.status === 'AVAILABLE' ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                                                    {item.status === 'AVAILABLE' ? 'DISPONÍVEL' : 'EMPRESTADO'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {item.activeLoan ? (
                                                    <div>
                                                        <p className="text-gray-800 font-medium">{item.activeLoan.personName}</p>
                                                        <p className="text-xs text-gray-500">{item.activeLoan.personMatricula}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-xs text-gray-600">
                                                {item.activeLoan ? (() => {
                                                    const days = Math.floor((Date.now() - new Date(item.activeLoan!.loanDate).getTime()) / (1000 * 60 * 60 * 24));
                                                    return <>
                                                        {new Date(item.activeLoan!.loanDate).toLocaleString('pt-BR')}
                                                        {' '}
                                                        <span className={days >= 2 ? 'font-black text-red-600' : 'text-gray-400'}>
                                                            ({days} {days === 1 ? 'dia' : 'dias'})
                                                        </span>
                                                    </>;
                                                })() : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredInventory.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-gray-400 italic">Nenhum material encontrado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination UI - Inventory */}
                        {totalPagesInventory > 1 && (
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                                    Mostrando <span className="text-gray-900">{paginatedInventory.length}</span> de <span className="text-gray-900">{filteredInventory.length}</span> materiais
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        disabled={currentPageInventory === 1}
                                        onClick={() => setCurrentPageInventory(prev => Math.max(1, prev - 1))}
                                        className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest disabled:opacity-30 hover:bg-white transition-all text-slate-600"
                                    >
                                        Anterior
                                    </button>
                                    {[...Array(totalPagesInventory)].map((_, i) => {
                                        const pageNum = i + 1;
                                        if (pageNum === 1 || pageNum === totalPagesInventory || (pageNum >= currentPageInventory - 1 && pageNum <= currentPageInventory + 1)) {
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPageInventory(pageNum)}
                                                    className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPageInventory === pageNum ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-gray-100 text-slate-500'}`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        }
                                        if (pageNum === 2 || pageNum === totalPagesInventory - 1) {
                                            return <span key={pageNum} className="text-gray-300 px-1 text-xs">...</span>;
                                        }
                                        return null;
                                    })}
                                    <button
                                        disabled={currentPageInventory === totalPagesInventory}
                                        onClick={() => setCurrentPageInventory(prev => Math.min(totalPagesInventory, prev + 1))}
                                        className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest disabled:opacity-30 hover:bg-white transition-all text-slate-600"
                                    >
                                        Próxima
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* REPORTS TAB */}
            {activeTab === 'reports' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-gray-800">Histórico de Movimentações</h3>
                                <p className="text-sm text-gray-500">Consulte logins, empréstimos e devoluções.</p>
                            </div>
                            {user.level === UserLevel.ADMIN && selectedReportIds.length > 0 && (
                                <button
                                    onClick={() => setShowDeleteReportConfirm(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow-sm hover:bg-red-700 transition-all text-sm"
                                >
                                    <Trash2 size={16} />
                                    Excluir {selectedReportIds.length} registro(s)
                                </button>
                            )}
                        </div>

                        {/* Filters Row */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                            <div className="md:col-span-2 relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Nome, material, operador ou código (#)..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={reportSearch}
                                    onChange={e => setReportSearch(e.target.value)}
                                />
                            </div>
                            <div>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    title="Data Início"
                                    value={reportDateStart}
                                    onChange={e => setReportDateStart(e.target.value)}
                                />
                            </div>
                            <div>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    title="Data Final"
                                    value={reportDateEnd}
                                    onChange={e => setReportDateEnd(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
                                    <tr>
                                        {user.level === UserLevel.ADMIN && (
                                            <th className="p-4 w-10">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                    checked={(() => {
                                                        const filtered = loans
                                                            .filter(loan => {
                                                                const search = reportSearch.toLowerCase().trim();
                                                                return (!search ||
                                                                    loan.materialName.toLowerCase().includes(search) ||
                                                                    loan.personName.toLowerCase().includes(search) ||
                                                                    loan.personMatricula.toLowerCase().includes(search) ||
                                                                    loan.loanedBy.toLowerCase().includes(search) ||
                                                                    (loan.returnedBy || '').toLowerCase().includes(search) ||
                                                                    `#${loan.materialCode}`.includes(search) ||
                                                                    loan.materialCode.includes(search));
                                                            })
                                                            .sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime())
                                                            .slice((currentPageReports - 1) * ITEMS_PER_PAGE, currentPageReports * ITEMS_PER_PAGE);
                                                        return filtered.length > 0 && filtered.every(l => selectedReportIds.includes(l.id));
                                                    })()}
                                                    onChange={() => {
                                                        const filtered = loans
                                                            .filter(loan => {
                                                                const search = reportSearch.toLowerCase().trim();
                                                                return (!search ||
                                                                    loan.materialName.toLowerCase().includes(search) ||
                                                                    loan.personName.toLowerCase().includes(search) ||
                                                                    loan.personMatricula.toLowerCase().includes(search) ||
                                                                    loan.loanedBy.toLowerCase().includes(search) ||
                                                                    (loan.returnedBy || '').toLowerCase().includes(search) ||
                                                                    `#${loan.materialCode}`.includes(search) ||
                                                                    loan.materialCode.includes(search));
                                                            })
                                                            .sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime())
                                                            .slice((currentPageReports - 1) * ITEMS_PER_PAGE, currentPageReports * ITEMS_PER_PAGE);
                                                        const allSelected = filtered.every(l => selectedReportIds.includes(l.id));
                                                        if (allSelected) {
                                                            setSelectedReportIds(prev => prev.filter(id => !filtered.find(l => l.id === id)));
                                                        } else {
                                                            setSelectedReportIds(prev => [...new Set([...prev, ...filtered.map(l => l.id)])]);
                                                        }
                                                    }}
                                                />
                                            </th>
                                        )}
                                        <th className="p-4 text-left">Material</th>
                                        <th className="p-4 text-left">Pessoa</th>
                                        <th className="p-4 text-left">Data Empréstimo</th>
                                        <th className="p-4 text-left">Data Devolução</th>
                                        <th className="p-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loans
                                        .filter(loan => {
                                            const search = reportSearch.toLowerCase().trim();
                                            const matchesText = !search ||
                                                loan.materialName.toLowerCase().includes(search) ||
                                                loan.personName.toLowerCase().includes(search) ||
                                                loan.personMatricula.toLowerCase().includes(search) ||
                                                loan.loanedBy.toLowerCase().includes(search) ||
                                                (loan.returnedBy || '').toLowerCase().includes(search) ||
                                                `#${loan.materialCode}`.includes(search) ||
                                                loan.materialCode.includes(search);

                                            const loanDate = new Date(loan.loanDate);
                                            const matchesStart = !reportDateStart || loanDate >= new Date(reportDateStart + 'T00:00:00');
                                            const matchesEnd = !reportDateEnd || loanDate <= new Date(reportDateEnd + 'T23:59:59');

                                            return matchesText && matchesStart && matchesEnd;
                                        })
                                        .sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime())
                                        .slice((currentPageReports - 1) * ITEMS_PER_PAGE, currentPageReports * ITEMS_PER_PAGE)
                                        .map(loan => (
                                            <tr key={loan.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setViewingLoan(loan)}>
                                                {user.level === UserLevel.ADMIN && (
                                                    <td className="p-4 w-10" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                            checked={selectedReportIds.includes(loan.id)}
                                                            onChange={() => {
                                                                setSelectedReportIds(prev =>
                                                                    prev.includes(loan.id)
                                                                        ? prev.filter(id => id !== loan.id)
                                                                        : [...prev, loan.id]
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                )}
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-800">{loan.materialName}</div>
                                                    <div className="text-xs text-gray-500 font-mono">#{stripPrefix(loan.materialCode)}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-medium text-gray-800">{loan.personName}</div>
                                                    <div className="text-xs text-gray-500">{loan.personMatricula}</div>
                                                </td>
                                                <td className="p-4 text-gray-600">
                                                    {new Date(loan.loanDate).toLocaleString('pt-BR')}
                                                </td>
                                                <td className="p-4">
                                                    {loan.status === 'DELETED' ? (
                                                        <span className="text-red-700 font-bold text-[10px] bg-red-50 px-2 py-1 rounded-full border border-red-100 flex items-center gap-1 w-fit">
                                                            {loan.returnDate ? new Date(loan.returnDate).toLocaleString('pt-BR') : 'DATA INDISP.'}
                                                        </span>
                                                    ) : loan.returnDate ? (
                                                        <span className="text-green-700 font-bold text-[11.5px]">{new Date(loan.returnDate).toLocaleString('pt-BR')}</span>
                                                    ) : (
                                                        <span className="text-amber-600 font-bold text-[10px] bg-amber-50 px-2 py-1 rounded-full border border-amber-100">EM ABERTO</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${loan.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' :
                                                        loan.status === 'DELETED' ? 'bg-red-100 text-red-800' :
                                                            'bg-green-100 text-green-800'
                                                        }`}>
                                                        {loan.status === 'ACTIVE' ? 'PENDENTE' :
                                                            loan.status === 'DELETED' ? 'DELETADO' : 'DEVOLVIDO'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    {loans.length === 0 && (
                                        <tr>
                                            <td colSpan={user.level === UserLevel.ADMIN ? 6 : 5} className="p-12 text-center text-gray-400 italic">Nenhum histórico disponível.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination UI - Reports */}
                        {(() => {
                            const filteredReports = loans.filter(loan => {
                                const search = reportSearch.toLowerCase().trim();
                                const matchesText = !search ||
                                    loan.materialName.toLowerCase().includes(search) ||
                                    loan.personName.toLowerCase().includes(search) ||
                                    loan.personMatricula.toLowerCase().includes(search) ||
                                    loan.loanedBy.toLowerCase().includes(search) ||
                                    (loan.returnedBy || '').toLowerCase().includes(search) ||
                                    `#${loan.materialCode}`.includes(search) ||
                                    loan.materialCode.includes(search);

                                const loanDate = new Date(loan.loanDate);
                                const matchesStart = !reportDateStart || loanDate >= new Date(reportDateStart + 'T00:00:00');
                                const matchesEnd = !reportDateEnd || loanDate <= new Date(reportDateEnd + 'T23:59:59');

                                return matchesText && matchesStart && matchesEnd;
                            });
                            const totalPagesReports = Math.ceil(filteredReports.length / ITEMS_PER_PAGE);

                            return totalPagesReports > 1 && (
                                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                                        Mostrando <span className="text-gray-900">{Math.min(filteredReports.length, ITEMS_PER_PAGE)}</span> de <span className="text-gray-900">{filteredReports.length}</span> registros
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            disabled={currentPageReports === 1}
                                            onClick={() => setCurrentPageReports(prev => Math.max(1, prev - 1))}
                                            className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest disabled:opacity-30 hover:bg-white transition-all text-slate-600"
                                        >
                                            Anterior
                                        </button>
                                        {[...Array(totalPagesReports)].map((_, i) => {
                                            const pageNum = i + 1;
                                            if (pageNum === 1 || pageNum === totalPagesReports || (pageNum >= currentPageReports - 1 && pageNum <= currentPageReports + 1)) {
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setCurrentPageReports(pageNum)}
                                                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPageReports === pageNum ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-gray-100 text-slate-500'}`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            }
                                            if (pageNum === 2 || pageNum === totalPagesReports - 1) {
                                                return <span key={pageNum} className="text-gray-300 px-1 text-xs">...</span>;
                                            }
                                            return null;
                                        })}
                                        <button
                                            disabled={currentPageReports === totalPagesReports}
                                            onClick={() => setCurrentPageReports(prev => Math.min(totalPagesReports, prev + 1))}
                                            className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest disabled:opacity-30 hover:bg-white transition-all text-slate-600"
                                        >
                                            Próxima
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Delete Report Confirmation Modal */}
            <Modal isOpen={showDeleteReportConfirm} onClose={() => setShowDeleteReportConfirm(false)} title="Excluir Registros">
                <div className="space-y-4">
                    <p className="text-gray-600">
                        Tem certeza que deseja excluir permanentemente <strong>{selectedReportIds.length}</strong> registro(s) do histórico?
                    </p>
                    <p className="text-sm text-red-600 font-bold">
                        Esta ação não pode ser desfeita. Os registros serão apagados sem deixar rastro.
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setShowDeleteReportConfirm(false)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            disabled={isDeletingReport}
                            onClick={async () => {
                                setIsDeletingReport(true);
                                try {
                                    await StorageService.deleteMaterialLoansBulk(selectedReportIds);
                                    setSelectedReportIds([]);
                                    setShowDeleteReportConfirm(false);
                                    onUpdate();
                                } catch (err) {
                                    alert('Erro ao excluir registros: ' + ((err as any)?.message || err));
                                } finally {
                                    setIsDeletingReport(false);
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
                        >
                            {isDeletingReport ? 'Excluindo...' : 'Sim, Excluir'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Material Form Modal */}
            <Modal isOpen={showMaterialForm} onClose={() => setShowMaterialForm(false)} title={editingMaterial ? 'Editar Material' : 'Novo Material'}>
                <form onSubmit={handleMaterialSubmit} className="space-y-4">
                    {!editingMaterial && (
                        <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                            <button
                                type="button"
                                onClick={() => setMaterialFormMode('single')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${materialFormMode === 'single' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Individual
                            </button>
                            <button
                                type="button"
                                onClick={() => setMaterialFormMode('batch')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${materialFormMode === 'batch' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Em Lote
                            </button>
                        </div>
                    )}

                    {materialFormMode === 'single' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Material</label>
                            <input
                                type="text"
                                required
                                value={formMaterialName}
                                onChange={e => setFormMaterialName(e.target.value)}
                                className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 transition-all"
                                placeholder="Ex: Adaptador HDMI"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Lista de Materiais (Cole aqui)</label>
                            <textarea
                                required
                                value={batchMaterialText}
                                onChange={e => setBatchMaterialText(e.target.value)}
                                rows={10}
                                className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 transition-all font-mono"
                                placeholder={"Cabo HDMI\nADAPTADOR VGA\nALICATE"}
                            />
                            <p className="text-[10px] text-gray-400 mt-1 italic">Cada linha será cadastrada como um item individual com código sequencial.</p>
                        </div>
                    )}
                    {user.level === UserLevel.ADMIN && (
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                            <label className="block text-xs font-bold text-amber-900 mb-2 uppercase tracking-tight">Câmpus do Material</label>
                            <select
                                value={selectedCampusId}
                                onChange={e => setSelectedCampusId(e.target.value)}
                                className="w-full bg-white border-2 border-amber-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                required
                            >
                                <option value="">Selecione um Câmpus...</option>
                                {campuses.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setShowMaterialForm(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancelar</button>
                        <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Cadastrar</button>
                    </div>
                </form>
            </Modal>

            {/* Success Modal */}
            <Modal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} title={lastRegisteredCount > 1 ? `${lastRegisteredCount} Materiais Cadastrados!` : 'Material Cadastrado!'}>
                <div className="space-y-6">
                    <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-6 text-center">
                        <p className="text-sm text-indigo-700 font-medium mb-2">{lastRegisteredCount > 1 ? 'INTERVALO DE CÓDIGOS' : 'CÓDIGO DE RASTREAMENTO'}</p>
                        <div className="bg-white border-2 border-indigo-400 rounded-lg p-4 mb-4">
                            <p className="text-4xl font-black font-mono text-indigo-900">{stripPrefix(generatedCode)}</p>
                        </div>
                        <button
                            onClick={copyToClipboard}
                            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${copiedCode ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                            {copiedCode ? <><CheckCircle size={20} /> Copiado!</> : <><Copy size={20} /> Copiar Código</>}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Loan Form Modal */}
            <Modal isOpen={showLoanForm} onClose={() => {
                setShowLoanForm(false);
                setSelectedMaterials([]);
                setSelectedPerson(null);
                setPersonSearch('');
                setMaterialSearch('');
                setShowMaterialDropdown(false);
            }} title="Novo Empréstimo">
                <form onSubmit={handleLoanSubmit} className="space-y-6">
                    <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-100 shadow-sm space-y-3">
                        <div className="flex justify-between items-center mb-1">
                            <label className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
                                <UserIcon size={14} /> Pessoa (Quem está pegando)
                            </label>
                            {isSearchingPeople && (
                                <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold animate-pulse">
                                    <Loader2 size={10} className="animate-spin" /> Buscando...
                                </div>
                            )}
                        </div>
                        {selectedPerson ? (
                            <div className="bg-white border border-blue-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                    <UserIcon size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-blue-900 leading-tight">{selectedPerson.name}</p>
                                    <p className="text-xs text-blue-600 font-medium">{selectedPerson.matricula} • {selectedPerson.type}</p>
                                </div>
                                <button type="button" onClick={() => { setSelectedPerson(null); setPersonTypeFilter('ALL'); }} className="px-3 py-1 bg-white border border-red-200 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 transition-all">Alterar</button>
                            </div>
                        ) : (
                            <div className="space-y-4 pt-2">
                                {/* Campo de Busca Principal */}
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Search size={20} className="text-blue-400 group-focus-within:text-blue-600 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full border-2 border-blue-100 rounded-2xl p-4 pl-12 text-base outline-none focus:border-blue-600 focus:bg-white transition-all font-bold bg-white shadow-md placeholder:font-normal placeholder:text-blue-300 ring-4 ring-blue-50/50"
                                        placeholder="BUSCAR PESSOA (Nome ou Matrícula)..."
                                        value={personSearch}
                                        onChange={e => {
                                            setPersonSearch(e.target.value);
                                            handlePersonSearch(e.target.value, false);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                if (searchResultsPeople.length > 0) {
                                                    setSelectedResultIndex(prev => (prev + 1) % searchResultsPeople.length);
                                                }
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                if (searchResultsPeople.length > 0) {
                                                    setSelectedResultIndex(prev => (prev - 1 + searchResultsPeople.length) % searchResultsPeople.length);
                                                }
                                            } else if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (searchResultsPeople.length > 0) {
                                                    const p = searchResultsPeople[selectedResultIndex];
                                                    setSelectedPerson(p);
                                                    setPersonSearch('');
                                                    setSearchResultsPeople([]);
                                                    setHasSearchedPeople(false);
                                                } else {
                                                    handlePersonSearch();
                                                }
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handlePersonSearch()}
                                        className="absolute right-3 top-2.5 p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all group shadow-sm"
                                    >
                                        {isSearchingPeople ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                                    </button>

                                    {/* Resultados da Busca */}
                                    {searchResultsPeople.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-blue-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-gray-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                            {searchResultsPeople.map((p, index) => (
                                                <div
                                                    key={p.matricula}
                                                    onClick={() => { 
                                                        setSelectedPerson(p); 
                                                        setPersonSearch(''); 
                                                        setSearchResultsPeople([]); 
                                                        setHasSearchedPeople(false);
                                                    }}
                                                    className={`p-4 rounded-xl cursor-pointer text-sm group transition-all flex justify-between items-center ${
                                                        index === selectedResultIndex 
                                                        ? 'bg-blue-600 text-white shadow-lg scale-[1.01]' 
                                                        : 'hover:bg-blue-50 text-gray-700'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${index === selectedResultIndex ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                                                            <UserIcon size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-base">{p.name}</div>
                                                            <div className={`text-xs ${index === selectedResultIndex ? 'text-blue-100' : 'text-gray-500'}`}>{p.matricula} • {p.type}</div>
                                                        </div>
                                                    </div>
                                                    {index === selectedResultIndex && (
                                                        <div className="text-[10px] font-black bg-white/20 px-2 py-1 rounded-md">
                                                            ENTER
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {hasSearchedPeople && searchResultsPeople.length === 0 && !isSearchingPeople && (
                                        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-blue-100 rounded-2xl p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
                                            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Search size={24} className="text-red-300" />
                                            </div>
                                            <p className="text-sm text-gray-800 font-black">NÃO ENCONTRADO!</p>
                                            <p className="text-xs text-gray-500 mt-1 uppercase tracking-tight">Verifique se o nome está correto antes de tentar cadastrar</p>
                                        </div>
                                    )}
                                </div>

                                {/* Filtros Secundários */}
                                <div className="flex bg-white/50 p-1 rounded-xl border border-blue-100/50 backdrop-blur-sm">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPersonTypeFilter('ALL');
                                            if (personSearch.trim().length >= 2) {
                                                StorageService.searchPeople(personSearch, 10, user.campus_id || undefined, 'ALL').then(res => setSearchResultsPeople(res));
                                            }
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${personTypeFilter === 'ALL' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-400 hover:bg-blue-50'}`}
                                    >
                                        <Users size={14} /> Todos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPersonTypeFilter('Aluno');
                                            if (personSearch.trim().length >= 2) {
                                                StorageService.searchPeople(personSearch, 10, user.campus_id || undefined, 'Aluno').then(res => setSearchResultsPeople(res));
                                            }
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${personTypeFilter === 'Aluno' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-400 hover:bg-blue-50'}`}
                                    >
                                        <GraduationCap size={14} /> Alunos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPersonTypeFilter('Servidor');
                                            if (personSearch.trim().length >= 2) {
                                                StorageService.searchPeople(personSearch, 10, user.campus_id || undefined, 'Servidor').then(res => setSearchResultsPeople(res));
                                            }
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${personTypeFilter === 'Servidor' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-400 hover:bg-blue-50'}`}
                                    >
                                        <UserCog size={14} /> Servidores
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedMaterials.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Materiais Selecionados ({selectedMaterials.length})</label>
                            <div className="grid grid-cols-1 gap-2">
                                {selectedMaterials.map(mat => (
                                    <div key={mat.id} className="flex justify-between items-center bg-gray-50 p-2 px-3 rounded-lg border border-gray-100 animate-fadeIn">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-indigo-600">#{stripPrefix(mat.code)}</span>
                                            <span className="text-sm font-medium text-gray-700">{mat.name}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedMaterials(selectedMaterials.filter(sm => sm.id !== mat.id))}
                                            className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-100 shadow-sm space-y-3 relative">
                        <label className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                            <Package size={14} /> Material (O que está levando)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full border-2 border-amber-100 rounded-xl p-3 pl-10 text-sm outline-none focus:border-amber-500 focus:bg-white transition-all bg-white/80 font-medium"
                                placeholder="Digite o nome do material ou código..."
                                value={materialSearch}
                                onChange={e => {
                                    setMaterialSearch(e.target.value);
                                    setShowMaterialDropdown(true);
                                }}
                                onFocus={() => setShowMaterialDropdown(true)}
                            />
                            <Package className="absolute left-3 top-3.5 text-amber-400" size={18} />

                            {showMaterialDropdown && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowMaterialDropdown(false)}
                                    />
                                    <div className="absolute z-20 w-full mt-2 bg-white border border-amber-100 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y p-1">
                                        {filteredMaterialsForLoan.length > 0 ? (
                                            filteredMaterialsForLoan.map(m => (
                                                <div
                                                    key={m.id}
                                                    onClick={() => {
                                                        setSelectedMaterials([...selectedMaterials, m]);
                                                        setMaterialSearch('');
                                                        setShowMaterialDropdown(false);
                                                    }}
                                                    className="p-4 rounded-lg hover:bg-amber-50 cursor-pointer flex justify-between items-center group transition-all"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                                                            <Package size={14} />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-800 group-hover:text-amber-700">{m.name}</div>
                                                            <div className="text-xs text-amber-600 font-mono font-bold tracking-tighter">#{stripPrefix(m.code)}</div>
                                                        </div>
                                                    </div>
                                                    <Plus size={16} className="text-amber-400 group-hover:rotate-90 transition-transform" />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center text-gray-400">
                                                <Package size={24} className="mx-auto mb-2 opacity-20" />
                                                <p className="text-xs italic">Nenhum material disponível encontrado</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {user.level === UserLevel.ADMIN && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Câmpus do Empréstimo</label>
                            <select
                                value={selectedCampusId}
                                onChange={e => setSelectedCampusId(e.target.value)}
                                className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 bg-white"
                                required
                            >
                                <option value="">Selecione um Câmpus...</option>
                                {campuses.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t">
                        <button type="button" onClick={() => {
                            setShowLoanForm(false);
                            setSelectedMaterials([]);
                            setSelectedPerson(null);
                            setPersonSearch('');
                            setMaterialSearch('');
                            setShowMaterialDropdown(false);
                        }} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all">Cancelar</button>
                        <button type="submit" disabled={selectedMaterials.length === 0 || !selectedPerson} className="flex-[2] py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all active:scale-[0.98]">Registrar Empréstimo</button>
                    </div>
                </form>
            </Modal>

            {/* Item Details/Action Modal */}
            <Modal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} title="Detalhes do Material">
                {viewingItem && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl">
                            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                <Hash size={24} className="text-indigo-600" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                    {viewingItem.name}
                                    <button
                                        onClick={() => {
                                            setEditingMaterial(viewingItem);
                                            setFormMaterialName(viewingItem.name);
                                            setShowMaterialForm(true);
                                            setViewingItem(null);
                                        }}
                                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                        title="Editar Nome do Material"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                </h4>
                                <p className="text-sm font-mono text-gray-500 mt-1">Código: {stripPrefix(viewingItem.code)}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="p-4 rounded-xl border border-gray-100 bg-white">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Status Atual</p>
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${viewingItem.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {viewingItem.status === 'AVAILABLE' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                                        {viewingItem.status === 'AVAILABLE' ? 'DISPONÍVEL PARA USO' : 'EMPRESTADO NO MOMENTO'}
                                    </span>
                                </div>
                            </div>

                            {viewingItem.activeLoan && (
                                <div className="p-4 rounded-xl border border-gray-100 bg-white space-y-3">
                                    <p className="text-xs font-bold text-gray-400 uppercase">Dados do Empréstimo</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500">Pessoa</p>
                                            <p className="font-bold text-gray-800">{viewingItem.activeLoan.personName}</p>
                                            <p className="text-[10px] text-gray-500">{viewingItem.activeLoan.personMatricula}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Registrou o empréstimo</p>
                                            <p className="text-sm text-gray-700 font-medium">{viewingItem.activeLoan.loanedBy}</p>
                                            <p className="text-xs text-gray-500">{new Date(viewingItem.activeLoan.loanDate).toLocaleString('pt-BR')}</p>
                                        </div>
                                        {viewingItem.activeLoan.observation && (
                                            <div className="col-span-2 pt-2 border-t">
                                                <p className="text-xs text-gray-500">Observação</p>
                                                <p className="text-sm text-gray-600 italic">"{viewingItem.activeLoan.observation}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {viewingItem.status === 'LOANED' && (
                                <div className="p-4 rounded-xl border border-gray-100 bg-white space-y-3">
                                    <p className="text-xs font-bold text-gray-400 uppercase">Histórico de Lembretes</p>
                                    {loadingChargeHistory ? (
                                        <p className="text-xs text-gray-400 italic">Carregando...</p>
                                    ) : chargeHistory.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic">Nenhum lembrete enviado ainda.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {chargeHistory.map((ch, i) => (
                                                <div key={ch.id} className="flex items-start gap-2 text-xs">
                                                    <span className="text-amber-500 mt-0.5 shrink-0">
                                                        <Mail size={12} />
                                                    </span>
                                                    <div>
                                                        <span className="text-gray-700 font-medium">
                                                            {i === 0 ? 'Último envio' : `Envio #${chargeHistory.length - i}`}
                                                        </span>
                                                        <span className="text-gray-400 ml-1">
                                                            {new Date(ch.sent_at).toLocaleString('pt-BR')} por {ch.triggered_by_name}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-4 border-t">
                            <button
                                onClick={() => setViewingItem(null)}
                                className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all"
                            >
                                Fechar
                            </button>
                            {viewingItem.status === 'LOANED' && viewingItem.activeLoan && (
                                <button
                                    onClick={() => handleSendCharge(viewingItem.activeLoan!)}
                                    disabled={sendingCharge}
                                    className="py-3 px-4 text-amber-600 font-bold border-2 border-amber-200 rounded-xl hover:bg-amber-50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                >
                                    <Mail size={18} /> {sendingCharge ? 'Enviando...' : 'Enviar Lembrete'}
                                </button>
                            )}
                            {viewingItem.status === 'AVAILABLE' ? (
                                <button
                                    onClick={() => {
                                        setSelectedMaterials([viewingItem]);
                                        setViewingItem(null);
                                        setShowLoanForm(true);
                                    }}
                                    className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2 transition-all"
                                >
                                    <Plus size={20} /> Realizar Empréstimo
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        handleReturn(viewingItem.activeLoan!);
                                        setViewingItem(null);
                                    }}
                                    className="flex-[2] py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 shadow-md flex items-center justify-center gap-2 transition-all"
                                >
                                    <CornerUpRight size={20} /> Realizar Devolução
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Report Details Modal */}
            <Modal isOpen={!!viewingLoan} onClose={() => setViewingLoan(null)} title="Detalhes do Empréstimo">
                {viewingLoan && (
                    <div className="space-y-6">
                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                            <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">Material</label>
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-lg shadow-sm">
                                    <Hash size={20} className="text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-indigo-900 leading-none">{viewingLoan.materialName}</p>
                                    <p className="text-xs font-mono text-indigo-600 mt-1">#{stripPrefix(viewingLoan.materialCode)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white border border-gray-100 rounded-xl space-y-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pessoa</p>
                                <p className="font-bold text-gray-800">{viewingLoan.personName}</p>
                                <p className="text-xs text-gray-500">{viewingLoan.personMatricula}</p>
                            </div>
                            <div className="p-4 bg-white border border-gray-100 rounded-xl space-y-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</p>
                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${viewingLoan.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' :
                                    viewingLoan.status === 'DELETED' ? 'bg-red-100 text-red-800' :
                                        'bg-green-100 text-green-800'
                                    }`}>
                                    {viewingLoan.status === 'ACTIVE' ? 'PENDENTE' :
                                        viewingLoan.status === 'DELETED' ? 'DELETADO' : 'DEVOLVIDO'}
                                </span>
                            </div>
                            <div className="p-4 bg-white border border-gray-100 rounded-xl space-y-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Registrou o empréstimo</p>
                                <p className="text-sm text-gray-700 font-medium">{viewingLoan.loanedBy}</p>
                                <p className="text-xs text-gray-500">{new Date(viewingLoan.loanDate).toLocaleString('pt-BR')}</p>
                            </div>
                            {viewingLoan.returnedBy && (
                                <div className="p-4 bg-white border border-gray-100 rounded-xl space-y-1">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        {viewingLoan.status === 'DELETED' ? 'Registrou a exclusão' : 'Registrou a devolução'}
                                    </p>
                                    <p className="text-sm text-gray-700 font-medium">{viewingLoan.returnedBy}</p>
                                    <p className="text-xs text-gray-500">{new Date(viewingLoan.returnDate!).toLocaleString('pt-BR')}</p>
                                </div>
                            )}
                        </div>

                        {viewingLoan.observation && (
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1.5"><FileText size={12} /> Observação</p>
                                <p className="text-sm text-amber-900 italic font-medium leading-relaxed">"{viewingLoan.observation}"</p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-4 border-t">
                            <button onClick={() => setViewingLoan(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all">Fechar</button>
                            {viewingLoan.status === 'ACTIVE' && (
                                <button
                                    onClick={() => handleReturn(viewingLoan)}
                                    className="flex-[2] py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg flex items-center justify-center gap-2"
                                >
                                    <CornerUpRight size={20} /> Registrar Devolução
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
