import React, { useState } from 'react';
import { Book, BookLoan, BookLoanStatus, Person, PersonType, User, Campus, UserLevel, Setor } from '../../types';
import { StorageService } from '../../services/storage';
import { Search, History, CheckCircle, X, Loader2, ArrowRight, User as UserIcon, Book as BookIcon, Calendar, Clock, Undo2, Plus, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
    loans: BookLoan[];
    books: Book[];
    onUpdate: () => void;
    user: User;
    campuses: Campus[];
    setores: Setor[];
    adminGlobalCampusId?: string | null;
    adminGlobalSetorId?: string | null;
}

// ── LoanRow ──────────────────────────────────────────────────────────────────
interface LoanRowProps {
    loan: BookLoan;
    onViewDetail: () => void;
    onReturn: () => void;
    setores: Setor[];
}

const LoanRow: React.FC<LoanRowProps> = ({ loan, onViewDetail, onReturn, setores }) => {
    const [expanded, setExpanded] = useState(false);
    const activeBooks = loan.books.filter(b => b.status === 'Ativo');
    const returnedBooks = loan.books.filter(b => b.status === 'Devolvido');
    const isReturned = loan.status === BookLoanStatus.RETURNED;

    return (
        <div className={`transition-colors ${isReturned ? 'bg-white' : 'bg-white hover:bg-gray-50/70'}`}>
            {/* Main Row */}
            <div
                className="grid grid-cols-[32px_1fr_80px_60px_100px_100px_80px] gap-x-3 items-center px-4 py-3 cursor-pointer"
                onClick={() => setExpanded(prev => !prev)}
            >
                {/* Expand chevron */}
                <span className="text-gray-400 w-5">
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>

                {/* Student info */}
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800 text-sm truncate">{loan.personName}</p>
                        {isReturned && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">
                                <CheckCircle size={10} /> Devolvido
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{loan.personMatricula || 'Matrícula não informada'}</p>
                </div>

                {/* Date */}
                <div className="hidden md:flex flex-col items-end text-right">
                    <span className="text-xs text-gray-600 font-medium">{new Date(loan.loanDate).toLocaleDateString('pt-BR')}</span>
                    <span className="text-[10px] text-gray-400">{new Date(loan.loanDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* Book count badge */}
                <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${isReturned ? 'bg-gray-50 text-gray-500 border-gray-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                        <BookIcon size={12} />
                        {loan.books.length}
                        {!isReturned && activeBooks.length < loan.books.length && (
                            <span className="text-emerald-600">/{returnedBooks.length}✓</span>
                        )}
                    </span>
                </div>

                {/* Operator */}
                <div className="hidden lg:block text-right">
                    <p className="text-[10px] text-gray-400 font-medium truncate max-w-[120px]">{loan.loanedBy}</p>
                </div>

                {/* Setor */}
                <div className="hidden lg:block text-xs text-gray-500">
                    {loan.setor_id ? (setores.find(s => s.id === loan.setor_id)?.name || '---') : '---'}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {!isReturned && (
                        <button
                            onClick={onReturn}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-bold transition-all shadow-sm whitespace-nowrap"
                        >
                            <Undo2 size={13} /> Devolver
                        </button>
                    )}
                    <button
                        onClick={onViewDetail}
                        className="p-1.5 text-gray-400 hover:text-ifrn-green hover:bg-gray-100 rounded-lg transition-colors"
                        title="Ver detalhes completos"
                    >
                        <FileText size={15} />
                    </button>
                </div>
            </div>

            {/* Expanded book list */}
            {expanded && (
                <div className="px-12 pb-4 pt-1 bg-gray-50/50 border-t border-gray-100">
                    {loan.observation && (
                        <p className="text-[11px] italic text-gray-500 mb-3 px-1">
                            <span className="font-bold not-italic text-gray-400 uppercase text-[9px] tracking-widest mr-1">Obs:</span>
                            "{loan.observation}"
                        </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {loan.books.map(book => {
                            const isMP = book.code?.endsWith('MP');
                            const isBookReturned = book.status === 'Devolvido';
                            return (
                                <div
                                    key={book.id}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs
                                        ${isBookReturned ? 'bg-emerald-50/50 border-emerald-100 opacity-80' : isMP ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100'}`}
                                >
                                    <BookIcon size={14} className={isBookReturned ? 'text-emerald-500' : isMP ? 'text-orange-500' : 'text-blue-500'} />
                                    <div className="min-w-0 flex-1">
                                        <div className={`font-bold truncate ${isBookReturned ? 'line-through text-gray-400' : isMP ? 'text-orange-900' : 'text-gray-700'}`}>
                                            {book.title}
                                            {isMP && <span className="ml-1 text-[8px] bg-orange-200 text-orange-900 px-1 py-0.5 rounded font-black uppercase tracking-tighter align-middle">MP</span>}
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            {book.code || 'S/C'} {book.series ? `• ${book.series}` : ''}
                                        </div>
                                    </div>
                                    {isBookReturned && <CheckCircle size={14} className="text-emerald-500 shrink-0" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
// ── StudentLoanGroup (history grouping) ─────────────────────────────────────
interface StudentLoanGroupProps {
    loans: BookLoan[];
    onViewDetail: (loan: BookLoan) => void;
    onReturn: (loan: BookLoan) => void;
    setores: Setor[];
}

const StudentLoanGroup: React.FC<StudentLoanGroupProps> = ({ loans, onViewDetail, onReturn, setores }) => {
    const [expanded, setExpanded] = useState(false);
    const first = loans[0];
    const totalBooks = loans.reduce((acc, l) => acc + l.books.length, 0);
    const allReturned = loans.every(l => l.status === BookLoanStatus.RETURNED);
    const dates = loans.map(l => new Date(l.loanDate));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const sameDay = latest.toDateString() === earliest.toDateString();

    return (
        <div className="transition-colors">
            {/* Group Header */}
            <div
                className="grid grid-cols-[32px_1fr_80px_60px_100px_100px_80px] gap-x-3 items-center px-4 py-3 cursor-pointer hover:bg-gray-50/70"
                onClick={() => setExpanded(prev => !prev)}
            >
                <span className="text-gray-400 w-5">
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>

                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800 text-sm truncate">{first.personName}</p>
                        {allReturned && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">
                                <CheckCircle size={10} /> Devolvido
                            </span>
                        )}
                        {loans.length > 1 && (
                            <span className="shrink-0 text-[9px] font-black uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">
                                {loans.length} empréstimos
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{first.personMatricula || 'Matrícula não informada'}</p>
                </div>

                {/* Date range */}
                <div className="hidden md:flex flex-col items-end text-right">
                    <span className="text-xs text-gray-600 font-medium">
                        {sameDay
                            ? latest.toLocaleDateString('pt-BR')
                            : `${earliest.toLocaleDateString('pt-BR')} – ${latest.toLocaleDateString('pt-BR')}`}
                    </span>
                    {sameDay && (
                        <span className="text-[10px] text-gray-400">{latest.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                </div>

                {/* Total book count */}
                <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border bg-gray-50 text-gray-500 border-gray-100">
                        <BookIcon size={12} />{totalBooks}
                    </span>
                </div>

                {/* Operator */}
                <div className="hidden lg:block text-right">
                    <p className="text-[10px] text-gray-400 font-medium truncate max-w-[120px]">{first.loanedBy}</p>
                </div>

                {/* Setor */}
                <div className="hidden lg:block text-xs text-gray-500">
                    {first.setor_id ? (setores.find(s => s.id === first.setor_id)?.name || '---') : '---'}
                </div>

                {/* Actions placeholder */}
                <div className="w-[60px]" />
            </div>

            {/* Sub-loans */}
            {expanded && (
                <div className="border-t border-gray-100 bg-gray-50/40 pl-8">
                    {loans.map(loan => (
                        <div key={loan.id} className="border-b border-gray-100 last:border-b-0">
                            <LoanRow
                                loan={loan}
                                onViewDetail={() => onViewDetail(loan)}
                                onReturn={() => onReturn(loan)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
// ─────────────────────────────────────────────────────────────────────────────


export const BookLoansTab: React.FC<Props> = ({ loans, books, onUpdate, user, campuses, adminGlobalCampusId }) => {
    const [activeSubTab, setActiveSubTab] = useState<'current' | 'history'>('current');
    const [showLoanModal, setShowLoanModal] = useState(false);
    const [showPartialReturnModal, setShowPartialReturnModal] = useState(false);
    const [selectedLoanForReturn, setSelectedLoanForReturn] = useState<BookLoan | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [returnSearch, setReturnSearch] = useState('');
    const [personTypeFilter, setPersonTypeFilter] = useState<'ALL' | 'STUDENT' | 'SERVER'>('ALL');

    // New Loan Form State
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [selectedBooks, setSelectedBooks] = useState<{ id: string, title: string, code?: string, series?: string, status?: 'Ativo' | 'Devolvido', loanDate?: string }[]>([]);
    const [personSearch, setPersonSearch] = useState('');
    const [bookSearch, setBookSearch] = useState('');
    const [observation, setObservation] = useState('');
    const [searchResultsPeople, setSearchResultsPeople] = useState<Person[]>([]);
    const [isSearchingPeople, setIsSearchingPeople] = useState(false);
    const [selectedPersonIndex, setSelectedPersonIndex] = useState<number | null>(null);

    const [viewingLoan, setViewingLoan] = useState<BookLoan | null>(null);
    const [editingBookObs, setEditingBookObs] = useState<{ loanId: string, bookId: string, value: string } | null>(null);
    const [expandedBookIdInModal, setExpandedBookIdInModal] = useState<string | null>(null);
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
    const [selectedSeries, setSelectedSeries] = useState<string>('');
    const [isBookInputFocused, setIsBookInputFocused] = useState(false);
    const [isSeriesSelectFocused, setIsSeriesSelectFocused] = useState(false);
    const [isMPToggleFocused, setIsMPToggleFocused] = useState(false);
    const [isBookListExpanded, setIsBookListExpanded] = useState(false);
    const [showMPBooks, setShowMPBooks] = useState(false);


    const isAdmin = user.level === UserLevel.ADMIN;

    const handleAddBook = (book: Book) => {
        if (selectedBooks.find(b => b.id === book.id)) return;
        setSelectedBooks([...selectedBooks, {
            id: book.id,
            title: book.title,
            code: book.code,
            series: book.series,
            status: 'Ativo',
            loanDate: new Date().toISOString()
        }]);
    };

    const handleRemoveBook = (bookId: string) => {
        setSelectedBooks(selectedBooks.filter(b => b.id !== bookId));
    };

    const handleCreateLoan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPerson || selectedBooks.length === 0) {
            alert('Selecione uma pessoa e pelo menos um livro.');
            return;
        }

        const person = selectedPerson;
        if (!person) return;

        const hasMP = selectedBooks.some(b => b.code?.endsWith('MP'));
        if (hasMP) {
            if (!confirm('Você selecionou um "Manual do Professor" (MP). Tem certeza que deseja emprestá-lo?')) {
                return;
            }
        }

        setIsLoading(true);
        try {
            const now = new Date().toISOString();

            // Verificando se já existe um empréstimo ATIVO para esta pessoa
            // Verificando se já existe um empréstimo ATIVO para esta pessoa (por ID ou Matrícula)
            const existingActiveLoan = loans.find(l => 
                (l.personMatricula === person.matricula) && 
                l.status === BookLoanStatus.ACTIVE
            );

            if (existingActiveLoan) {
                // Verificar se o aluno já possui algum dos livros selecionados (ativos)
                const alreadyBorrowed = selectedBooks.filter(newBook =>
                    existingActiveLoan.books.some(eb => eb.id === newBook.id && eb.status === 'Ativo')
                );

                if (alreadyBorrowed.length > 0) {
                    alert(`O aluno já possui o(s) seguinte(s) livro(s) em aberto:\n${alreadyBorrowed.map(b => `- ${b.title} (Cód: ${b.code || '---'})`).join('\n')}`);
                    setIsLoading(false);
                    return;
                }

                // Atualizar empréstimo existente
                const updatedLoan: BookLoan = {
                    ...existingActiveLoan,
                    setor_id: isAdmin ? selectedSetorId : existingActiveLoan.setor_id,
                    books: [
                        ...existingActiveLoan.books, 
                        ...selectedBooks.map(b => ({ 
                            ...b, 
                            status: 'Ativo' as const, 
                            loanDate: now, 
                            loanedBy: user.name,
                            observation: (document.getElementById(`book-obs-${b.id}`) as HTMLInputElement)?.value || ''
                        }))
                    ],
                    history: [
                        ...(existingActiveLoan.history || []),
                        {
                            action: `Novos livros adicionados: ${selectedBooks.map(b => `${b.title} (#${b.code || 'S/C'})`).join(', ')}`,
                            user: user.name,
                            timestamp: now
                        }
                    ]
                };

                await StorageService.saveBookLoan(updatedLoan);
                alert('Empréstimo atualizado com sucesso!');
            } else {
                // Criar novo empréstimo
                const newLoan: BookLoan = {
                    id: Math.random().toString(36).substr(2, 9),
                    personName: person.name,
                    personMatricula: person.matricula, // Garantindo o mapeamento da matrícula
                    books: selectedBooks.map(b => ({ 
                        ...b, 
                        status: 'Ativo' as const, 
                        loanDate: now, 
                        loanedBy: user.name,
                        observation: (document.getElementById(`book-obs-${b.id}`) as HTMLInputElement)?.value || ''
                    })),
                    loanedBy: user.name,
                    loanDate: now,
                    status: BookLoanStatus.ACTIVE,
                    observation,
                    campus_id: user.level === UserLevel.ADMIN ? (selectedCampusId || user.campus_id) : user.campus_id,
                    setor_id: isAdmin ? selectedSetorId : user.setor_id || null,
                    history: [{
                        action: `Empréstimo inicial: ${selectedBooks.map(b => `${b.title} (#${b.code || 'S/C'})`).join(', ')}`,
                        user: user.name,
                        timestamp: now
                    }]
                };

                await StorageService.saveBookLoan(newLoan);
                alert('Empréstimo realizado com sucesso!');
            }

            onUpdate();
            setShowLoanModal(false);
            setSelectedPerson(null);
            setSelectedBooks([]);
            setPersonSearch('');
            setBookSearch('');
            setObservation('');
            setShowMPBooks(false);
            setIsBookListExpanded(false);
        } catch (err) {
            alert('Erro ao processar empréstimo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePartialReturn = async (loan: BookLoan, bookIds: string[]) => {
        if (bookIds.length === 0) return;

        setIsLoading(true);
        try {
            const now = new Date().toISOString();
            const updatedBooks = loan.books.map(b => {
                if (bookIds.includes(b.id)) {
                    return { ...b, status: 'Devolvido' as const, returnDate: now, returnedBy: user.name };
                }
                return b;
            });

            const allReturned = updatedBooks.every(b => b.status === 'Devolvido');
            const returnedTitles = loan.books.filter(b => bookIds.includes(b.id)).map(b => `${b.title} (#${b.code || 'S/C'})`).join(', ');

            const updatedLoan: BookLoan = {
                ...loan,
                books: updatedBooks,
                status: allReturned ? BookLoanStatus.RETURNED : BookLoanStatus.ACTIVE,
                returnDate: allReturned ? now : loan.returnDate,
                history: [
                    ...(loan.history || []),
                    {
                        action: `Devolução parcial: ${returnedTitles}`,
                        user: user.name,
                        timestamp: now
                    }
                ]
            };

            await StorageService.saveBookLoan(updatedLoan);
            onUpdate();
            setShowPartialReturnModal(false);
            alert('Devolução registrada com sucesso!');
        } catch (err) {
            alert('Erro ao processar devolução.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveBookObservation = async (loanId: string, bookId: string, obs: string) => {
        const loan = loans.find(l => l.id === loanId);
        if (!loan) return;

        setIsLoading(true);
        try {
            const now = new Date().toISOString();
            const updatedBooks = loan.books.map(b => {
                if (b.id === bookId) {
                    return { ...b, observation: obs };
                }
                return b;
            });

            const updatedLoan: BookLoan = {
                ...loan,
                books: updatedBooks,
                history: [
                    ...(loan.history || []),
                    {
                        action: `Observação adicionada ao livro ${loan.books.find(b => b.id === bookId)?.title}: ${obs}`,
                        user: user.name,
                        timestamp: now
                    }
                ]
            };

            await StorageService.saveBookLoan(updatedLoan);
            onUpdate();
            setEditingBookObs(null);
            // Update viewingLoan to reflect the change in the UI immediately
            setViewingLoan(updatedLoan);
            alert('Observação salva com sucesso!');
        } catch (err) {
            alert('Erro ao salvar observação.');
        } finally {
            setIsLoading(false);
        }
    };

    const normalizeText = (text: string) => {
        return text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    };

    const enrichedLoans = loans; // A matrícula já deve vir do banco agora

    const filteredLoans = enrichedLoans.filter(l => {
        if (!search.trim()) return true;
        const searchTerms = normalizeText(search).split(/\s+/).filter((t: string) => t.length > 0);
        const loanText = normalizeText(`${l.personName} ${l.personMatricula || ''} ${l.books.map(b => `${b.title} ${b.code || ''}`).join(' ')}`);
        return searchTerms.every((term: string) => loanText.includes(term));
    });

    const activeLoans = filteredLoans.filter(l => {
        const matchesStatus = l.status === BookLoanStatus.ACTIVE;
        if (!matchesStatus) return false;
        if (personTypeFilter === 'STUDENT') return l.personType === 'Aluno';
        if (personTypeFilter === 'SERVER') return l.personType === 'Servidor';
        return true;
    });
    const historicalLoans = filteredLoans.filter(l => {
        const matchesStatus = l.status === BookLoanStatus.RETURNED;
        if (!matchesStatus) return false;
        if (personTypeFilter === 'STUDENT') return l.personType === 'Aluno';
        if (personTypeFilter === 'SERVER') return l.personType === 'Servidor';
        return true;
    });

    // Group historical loans by student (personMatricula)
    const groupedHistory = React.useMemo(() => {
        const map = new Map<string, BookLoan[]>();
        historicalLoans.forEach(loan => {
            const key = loan.personMatricula || loan.personName;
            const group = map.get(key) || [];
            group.push(loan);
            map.set(key, group);
        });
        // Sort each group by date descending
        map.forEach(group => group.sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime()));
        // Sort groups by most recent loan descending
        return Array.from(map.values()).sort((a, b) =>
            new Date(b[0].loanDate).getTime() - new Date(a[0].loanDate).getTime()
        );
    }, [historicalLoans]);
    const handlePersonSearchChange = (val: string) => {
        setPersonSearch(val);
        // Clear results on change, matching FoundItemsTab behavior
        setSearchResultsPeople([]);
        setSelectedPersonIndex(null);
    };

    const performPersonSearch = async () => {
        const val = personSearch.trim();
        if (val.length < 2) return;

        setIsSearchingPeople(true);
        try {
            const results = await StorageService.searchPeople(val, 10, user.level === UserLevel.ADMIN ? undefined : user.campus_id);
            setSearchResultsPeople(results);
            if (results.length > 0) {
                setSelectedPersonIndex(0);
            } else {
                setSelectedPersonIndex(null);
            }
        } catch (err) {
            console.error("Erro busca pessoas:", err);
        } finally {
            setIsSearchingPeople(false);
        }
    };

    const handleSelectPerson = (p: Person) => {
        setSelectedPerson(p);
        setPersonSearch('');
        setSearchResultsPeople([]);
        setSelectedPersonIndex(null);
    };

    const handlePersonSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (searchResultsPeople.length > 0) {
                setSelectedPersonIndex(prev => 
                    prev === null || prev === searchResultsPeople.length - 1 ? 0 : prev + 1
                );
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (searchResultsPeople.length > 0) {
                setSelectedPersonIndex(prev => 
                    prev === null || prev === 0 ? searchResultsPeople.length - 1 : prev - 1
                );
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedPersonIndex !== null && searchResultsPeople[selectedPersonIndex]) {
                handleSelectPerson(searchResultsPeople[selectedPersonIndex]);
            } else if (personSearch.trim().length >= 2) {
                performPersonSearch();
            }
        }
    };

    const filteredLoanBooks = React.useMemo(() => {
        const searchTerms = normalizeText(bookSearch).split(/\s+/).filter(t => t.length > 0);
        const selectedBookIds = new Set(selectedBooks.map(b => b.id));

        return books.filter(b => {
            // Filter out already selected books
            if (selectedBookIds.has(b.id)) return false;

            // Filter MP books if not toggled
            const isMP = b.code?.endsWith('MP');
            if (isMP && !showMPBooks) return false;

            // Filter by series if selected
            if (selectedSeries && b.series !== selectedSeries) return false;

            if (searchTerms.length === 0) return true;
            const bookText = normalizeText(`${b.title} ${b.code} ${b.area}`);
            return searchTerms.every(term => bookText.includes(term));
        });
    }, [bookSearch, books, selectedSeries, selectedBooks, showMPBooks]);

    const uniqueSeries = Array.from(new Set(books.map(b => b.series).filter(Boolean))).sort();

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 30;

    // Reset pagination when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [search, activeSubTab]);

    const totalPages = Math.ceil((activeSubTab === 'current' ? activeLoans.length : groupedHistory.length) / itemsPerPage);
    
    const paginatedActive = React.useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return activeLoans.slice(start, start + itemsPerPage);
    }, [activeLoans, currentPage]);

    const paginatedHistory = React.useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return groupedHistory.slice(start, start + itemsPerPage);
    }, [groupedHistory, currentPage]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex gap-4 items-center">
                    <button
                        onClick={() => setActiveSubTab('current')}
                        className={`pb-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeSubTab === 'current' ? 'border-ifrn-green text-ifrn-green' : 'border-transparent text-gray-500'}`}
                    >
                        Empréstimos Ativos ({activeLoans.length})
                    </button>
                    <button
                        onClick={() => setActiveSubTab('history')}
                        className={`pb-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeSubTab === 'history' ? 'border-ifrn-green text-ifrn-green' : 'border-transparent text-gray-500'}`}
                    >
                        Histórico
                    </button>
                </div>

                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setPersonTypeFilter('ALL')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${personTypeFilter === 'ALL' ? 'bg-white text-ifrn-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setPersonTypeFilter('STUDENT')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${personTypeFilter === 'STUDENT' ? 'bg-white text-ifrn-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Alunos
                    </button>
                    <button
                        onClick={() => setPersonTypeFilter('SERVER')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${personTypeFilter === 'SERVER' ? 'bg-white text-ifrn-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Servidores
                    </button>
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por aluno ou livro..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowLoanModal(true)}
                        className="px-4 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen flex items-center gap-2 transition-colors font-medium text-sm"
                    >
                        <ArrowRight size={18} /> Novo Empréstimo
                    </button>
                </div>
            </div>

            {/* Expandable Table Layout */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {(activeSubTab === 'current' ? activeLoans : groupedHistory).length === 0 ? (
                    <div className="py-16 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
                        Nenhum registro encontrado.
                    </div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div className="grid grid-cols-[32px_1fr_80px_60px_100px_100px_80px] gap-x-3 items-center px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <span className="w-6" />
                            <span>Aluno</span>
                            <span className="hidden md:block text-right">Data</span>
                            <span className="text-center">Livros</span>
                            <span className="hidden lg:block text-right">Operador</span>
                            <span className="hidden lg:block">Setor</span>
                            <div className="w-[60px]" />
                        </div>

                        {/* Table Rows */}
                        <div className="divide-y divide-gray-50">
                            {activeSubTab === 'current'
                                ? paginatedActive.map(loan => (
                                    <LoanRow
                                        key={loan.id}
                                        loan={loan}
                                        onViewDetail={() => setViewingLoan(loan)}
                                        onReturn={() => {
                                            setSelectedLoanForReturn(loan);
                                            setShowPartialReturnModal(true);
                                        }}
                                        setores={setores}
                                    />
                                ))
                                : paginatedHistory.map(group => (
                                    group.length === 1
                                        ? <LoanRow
                                            key={group[0].id}
                                            loan={group[0]}
                                            onViewDetail={() => setViewingLoan(group[0])}
                                            onReturn={() => {
                                                setSelectedLoanForReturn(group[0]);
                                                setShowPartialReturnModal(true);
                                            }}
                                            setores={setores}
                                          />
                                        : <StudentLoanGroup
                                            key={group[0].personMatricula || group[0].personName}
                                            loans={group}
                                            onViewDetail={loan => setViewingLoan(loan)}
                                            onReturn={loan => {
                                                setSelectedLoanForReturn(loan);
                                                setShowPartialReturnModal(true);
                                            }}
                                            setores={setores}
                                          />
                                ))
                            }
                        </div>

                        {/* Pagination UI */}
                        {totalPages > 1 && (
                            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                <div className="text-xs text-gray-500 font-medium">
                                    Mostrando <span className="text-gray-900">{(activeSubTab === 'current' ? paginatedActive : paginatedHistory).length}</span> de <span className="text-gray-900">{(activeSubTab === 'current' ? activeLoans : groupedHistory).length}</span> {(activeSubTab === 'current' ? 'empréstimos' : 'alunos no histórico')}
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
                                        if (
                                            pageNum === 1 ||
                                            pageNum === totalPages ||
                                            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                        ) {
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === pageNum ? 'bg-ifrn-green text-white shadow-md shadow-green-100' : 'hover:bg-gray-100 text-gray-600'}`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        }
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
                    </>
                )}
            </div>

            <Modal
                isOpen={showLoanModal}
                onClose={() => {
                    setShowLoanModal(false);
                    setSelectedPerson(null);
                    setSelectedBooks([]);
                    setShowMPBooks(false);
                    setIsBookListExpanded(false);
                }}
                title="Novo Empréstimo de Livros"
            >
                <div className="space-y-6">
                    {/* Person Selection */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase">1. Selecionar Aluno/Pessoa</label>
                            {isSearchingPeople && (
                                <div className="flex items-center gap-1.5 text-[10px] text-ifrn-green font-bold animate-pulse">
                                    <Loader2 size={12} className="animate-spin" /> Buscando...
                                </div>
                            )}
                        </div>
                        {selectedPerson ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
                                <div className="flex-1">
                                    <p className="font-bold text-blue-900">{selectedPerson.name}</p>
                                    <p className="text-[10px] text-blue-700 font-bold uppercase">{selectedPerson.matricula || 'Não informada'} • {selectedPerson.type}</p>
                                </div>
                                <button type="button" onClick={() => setSelectedPerson(null)} className="text-xs text-red-500 font-bold underline">Alterar</button>
                            </div>
                        ) : (
                            <>
                                <div className="relative group/search">
                                    <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within/search:text-ifrn-green" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nome ou matrícula..."
                                        className="w-full pl-10 pr-12 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                                        value={personSearch}
                                        onFocus={() => setIsBookListExpanded(false)}
                                        onChange={e => handlePersonSearchChange(e.target.value)}
                                        onKeyDown={handlePersonSearchKeyDown}
                                    />
                                    <button
                                        type="button"
                                        onClick={performPersonSearch}
                                        className="absolute right-2 top-1.5 p-1 text-gray-400 hover:text-ifrn-green hover:bg-gray-100 rounded-md transition-all active:scale-95"
                                        title="Buscar aluno"
                                    >
                                        <Search size={18} />
                                    </button>
                                </div>
                                {searchResultsPeople.length > 0 && (
                                    <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        {searchResultsPeople.map((p, idx) => (
                                            <button
                                                key={p.matricula}
                                                type="button"
                                                onClick={() => handleSelectPerson(p)}
                                                className={`w-full text-left p-2 rounded text-sm transition-colors flex flex-col ${selectedPersonIndex === idx ? 'bg-ifrn-green/10 border-l-4 border-l-ifrn-green' : 'hover:bg-gray-200 text-gray-700'}`}
                                                onMouseMove={() => setSelectedPersonIndex(idx)}
                                            >
                                                <div className={`font-bold ${selectedPersonIndex === idx ? 'text-ifrn-darkGreen' : ''}`}>{p.name}</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">{p.matricula || 'Não informada'} • {p.type}</div>
                                            </button>
                                        ))}
                                        {searchResultsPeople.length === 0 && !isSearchingPeople && personSearch.length >= 2 && <div className="p-2 text-xs text-center text-gray-400">Nenhum resultado.</div>}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Book Selection */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">2. Adicionar Livros</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2 relative">
                                <div className="relative">
                                    <BookIcon className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar livro pelo título ou código..."
                                        className="w-full pl-10 pr-12 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                                        value={bookSearch}
                                        onChange={e => {
                                            setBookSearch(e.target.value);
                                            if (e.target.value.length > 0) setIsBookListExpanded(true);
                                        }}
                                        onFocus={() => {
                                            setIsBookInputFocused(true);
                                            setIsBookListExpanded(true);
                                        }}
                                        onBlur={() => setTimeout(() => setIsBookInputFocused(false), 200)}
                                    />

                                </div>
                            </div>
                            <div className="relative">
                                <select
                                    value={selectedSeries}
                                    onChange={e => {
                                        setSelectedSeries(e.target.value);
                                        setIsBookListExpanded(true);
                                    }}
                                    onFocus={() => {
                                        setIsSeriesSelectFocused(true);
                                        setIsBookListExpanded(true);
                                    }}
                                    onBlur={() => setTimeout(() => setIsSeriesSelectFocused(false), 200)}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-ifrn-green outline-none appearance-none bg-white font-medium text-gray-700"
                                >
                                    <option value="">Todas as Séries</option>
                                    {uniqueSeries.map(series => (
                                        <option key={series} value={series}>{series}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* MP Toggle Checkbox */}
                        <div className="mt-3 flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="showMPBooks"
                                checked={showMPBooks}
                                onChange={e => {
                                    setShowMPBooks(e.target.checked);
                                    setIsBookListExpanded(true);
                                }}
                                onFocus={() => {
                                    setIsMPToggleFocused(true);
                                    setIsBookListExpanded(true);
                                }}
                                onBlur={() => setTimeout(() => setIsMPToggleFocused(false), 200)}
                                className="w-4 h-4 accent-ifrn-green rounded border-gray-300 cursor-pointer"
                            />
                            <label
                                htmlFor="showMPBooks"
                                className="text-xs font-bold text-gray-500 uppercase cursor-pointer select-none"
                                onMouseDown={() => {
                                    setIsMPToggleFocused(true);
                                    setIsBookListExpanded(true);
                                }}
                                onMouseUp={() => setTimeout(() => setIsMPToggleFocused(false), 200)}
                            >
                                Mostrar Livros "Manual do Professor" (MP)
                            </label>
                        </div>
                        {(bookSearch.length > 0 || isBookInputFocused || isSeriesSelectFocused || isMPToggleFocused || isBookListExpanded) && (
                            <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded-lg border border-gray-100 max-h-64 overflow-y-auto">
                                {filteredLoanBooks.map(b => {
                                    const isMP = b.code?.endsWith('MP');
                                    return (
                                        <button
                                            key={b.id}
                                            onClick={() => { handleAddBook(b); setBookSearch(''); }}
                                            className={`w-full text-left p-2 rounded text-sm hover:bg-gray-200 text-gray-700 transition-colors flex justify-between items-center ${isMP ? 'bg-orange-100/50' : ''}`}
                                        >
                                            <div>
                                                <div className="font-bold">{b.title}</div>
                                                <div className="text-[10px] text-gray-400">{b.code} • {b.series}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isMP && (
                                                    <span className="text-[8px] bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">MP</span>
                                                )}
                                                <Plus size={14} className="text-ifrn-green" />
                                            </div>
                                        </button>
                                    );
                                })}
                                {filteredLoanBooks.length === 0 && <div className="p-2 text-xs text-center text-gray-400">Nenhum resultado.</div>}
                            </div>
                        )}

                        {selectedBooks.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Livros Selecionados e Observações Específicas</label>
                                {selectedBooks.map(b => {
                                    const isMP = b.code?.endsWith('MP');
                                    return (
                                        <div key={b.id} className={`p-2 rounded-xl border ${isMP ? 'bg-orange-50/30 border-orange-100' : 'bg-gray-50/50 border-gray-100'} flex flex-col gap-2`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-full border ${isMP ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-ifrn-green/10 text-ifrn-darkGreen border-ifrn-green/20'}`}>
                                                        {b.title} <span className="opacity-60 font-medium">({b.code || 'S/C'})</span>
                                                    </span>
                                                </div>
                                                <button onClick={() => handleRemoveBook(b.id)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                                            </div>
                                            <input 
                                                id={`book-obs-${b.id}`}
                                                type="text"
                                                placeholder="Obs. específica..."
                                                className="w-full px-2 py-1 text-[11px] bg-white border border-gray-100 rounded-lg focus:ring-1 focus:ring-ifrn-green outline-none"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Observation */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">3. Observação (Opcional)</label>
                        <textarea
                            className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-ifrn-green outline-none h-20 resize-none"
                            placeholder="Adicione observações importantes sobre este empréstimo..."
                            value={observation}
                            onFocus={() => setIsBookListExpanded(false)}
                            onChange={e => setObservation(e.target.value)}
                        />
                    </div>

                    {user.level === UserLevel.ADMIN && (
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mt-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-amber-900 mb-2 uppercase tracking-tight">Câmpus do Empréstimo</label>
                                <select
                                    value={selectedCampusId}
                                    onChange={e => { setSelectedCampusId(e.target.value); setSelectedSetorId(''); }}
                                    className="w-full bg-white border-2 border-amber-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                    required
                                >
                                    <option value="">Selecione um Câmpus...</option>
                                    {campuses.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-amber-700 mt-1 italic">Administrador: Isto definirá em qual campus este empréstimo será contabilizado.</p>
                            </div>
                            {selectedCampusId && setores.filter(s => s.campus_id === selectedCampusId).length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-amber-900 mb-2 uppercase tracking-tight">Setor do Empréstimo</label>
                                    <select
                                        value={selectedSetorId}
                                        onChange={e => setSelectedSetorId(e.target.value)}
                                        className="w-full bg-white border-2 border-amber-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                    >
                                        <option value="">Selecione um Setor...</option>
                                        {setores.filter(s => s.campus_id === selectedCampusId).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-6 flex justify-end gap-3 border-t">
                        <button
                            type="button"
                            onClick={() => {
                                setShowLoanModal(false);
                                setSelectedPerson(null);
                                setSelectedBooks([]);
                                setShowMPBooks(false);
                                setIsBookListExpanded(false);
                            }}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreateLoan}
                            disabled={isLoading || !selectedPerson || selectedBooks.length === 0}
                            className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Finalizar Empréstimo'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Partial Return Modal */}
            <Modal
                isOpen={showPartialReturnModal}
                onClose={() => { 
                    setShowPartialReturnModal(false); 
                    setSelectedLoanForReturn(null); 
                    setReturnSearch('');
                }}
                title="Confirmar Devolução de Livros"
            >
                {selectedLoanForReturn && (
                    <div className="space-y-6">
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-bold text-blue-700">{selectedLoanForReturn.personName}</p>
                                <span className="text-[10px] font-bold text-blue-400 uppercase bg-white/50 px-2 py-0.5 rounded-full border border-blue-100">
                                    {selectedLoanForReturn.personType === PersonType.STUDENT ? 'ALUNO' : 'SERVIDOR'}
                                </span>
                            </div>
                            <p className="text-xs text-blue-500">Selecione os livros que estão sendo devolvidos agora:</p>
                        </div>

                        {/* Return Search Filter */}
                        <div className="relative group">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${returnSearch ? 'text-ifrn-green' : 'text-gray-400'}`} />
                            <input
                                type="text"
                                placeholder="Filtrar livros por título, código ou série..."
                                value={returnSearch}
                                onChange={(e) => setReturnSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ifrn-green/20 focus:border-ifrn-green transition-all"
                            />
                            {returnSearch && (
                                <button 
                                    onClick={() => setReturnSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {selectedLoanForReturn.books
                                .filter(book => {
                                    if (!returnSearch) return true;
                                    const searchLower = returnSearch.toLowerCase();
                                    return (
                                        book.title.toLowerCase().includes(searchLower) ||
                                        (book.code || '').toLowerCase().includes(searchLower) ||
                                        (book.series || '').toLowerCase().includes(searchLower)
                                    );
                                })
                                .map(book => {
                                    const isMP = book.code?.endsWith('MP');
                                    return (
                                        <div
                                            key={book.id}
                                            className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${book.status === 'Devolvido' ? 'bg-gray-50/50 opacity-50 border-gray-100' : isMP ? 'bg-orange-50/30 border-orange-100 hover:border-orange-300' : 'bg-white border-gray-100 hover:border-ifrn-green/50'} ${book.status !== 'Devolvido' ? 'cursor-pointer active:scale-[0.99]' : ''}`}
                                            onClick={() => {
                                                if (book.status === 'Devolvido') return;
                                                const checkbox = document.getElementById(`book-${book.id}`) as HTMLInputElement;
                                                if (checkbox) checkbox.checked = !checkbox.checked;
                                            }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`shrink-0 p-2 rounded-lg ${book.status === 'Devolvido' ? 'bg-gray-100 text-gray-400' : isMP ? 'bg-orange-100 text-orange-600' : 'bg-green-50 text-ifrn-green'}`}>
                                                    <BookIcon size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-bold truncate ${book.status === 'Devolvido' ? 'text-gray-400 line-through' : isMP ? 'text-orange-900' : 'text-gray-700'}`}>
                                                        {book.title}
                                                        {isMP && (
                                                            <span className="ml-2 text-[8px] bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter align-middle font-sans">MP</span>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">CÓD: <span className={book.status === 'Devolvido' ? '' : isMP ? 'text-orange-700' : 'text-gray-600'}>{book.code || '---'}</span></span>
                                                        <span className="text-[10px] text-gray-300">•</span>
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">SÉRIE: <span className={book.status === 'Devolvido' ? '' : isMP ? 'text-orange-700' : 'text-gray-600'}>{book.series || '---'}</span></span>
                                                    </div>
                                                    {book.status === 'Devolvido' && (
                                                        <p className="text-[9px] text-emerald-600 font-bold uppercase mt-1 flex items-center gap-1"><CheckCircle size={10} /> Devolvido em {new Date(book.returnDate!).toLocaleDateString('pt-BR')}</p>
                                                    )}
                                                </div>
                                            </div>
                                            {book.status !== 'Devolvido' && (
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id={`book-${book.id}`}
                                                        className={`w-5 h-5 rounded border-gray-300 ${isMP ? 'accent-orange-500' : 'accent-ifrn-green'} cursor-pointer group-hover:scale-110 transition-transform`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>

                        <div className="pt-6 flex justify-end gap-3 border-t bg-white">
                            <button
                                onClick={() => { 
                                    setShowPartialReturnModal(false); 
                                    setSelectedLoanForReturn(null); 
                                    setReturnSearch(''); 
                                }}
                                className="px-5 py-2 text-gray-500 font-bold text-[11px] uppercase tracking-wider hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const selectedBookIds: string[] = [];
                                    selectedLoanForReturn.books.forEach(b => {
                                        const cb = document.getElementById(`book-${b.id}`) as HTMLInputElement;
                                        if (cb && cb.checked) selectedBookIds.push(b.id);
                                    });
                                    if (selectedBookIds.length === 0) {
                                        alert('Selecione pelo menos um livro para devolver.');
                                        return;
                                    }
                                    handlePartialReturn(selectedLoanForReturn, selectedBookIds);
                                }}
                                disabled={isLoading}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar Devolução'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Loan Detail Modal */}
            <Modal
                isOpen={!!viewingLoan}
                onClose={() => {
                    setViewingLoan(null);
                    setExpandedBookIdInModal(null);
                }}
                title="Detalhes do Empréstimo"
            >
                {viewingLoan && (
                    <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                        {/* Student Info */}
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="w-12 h-12 bg-ifrn-green/10 text-ifrn-green rounded-full flex items-center justify-center">
                                <UserIcon size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">{viewingLoan.personName}</h3>
                                <p className="text-sm text-gray-500 font-medium">Matrícula: {viewingLoan.personMatricula || 'Não informada'}</p>
                                {viewingLoan.setor_id && (
                                    <p className="text-xs text-gray-400 font-medium mt-1">Setor: {setores.find(s => s.id === viewingLoan.setor_id)?.name || '---'}</p>
                                )}
                            </div>
                        </div>

                        {/* Observation */}
                        {viewingLoan.observation && (
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <FileText size={14} /> Observação
                                </p>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 italic text-sm text-gray-600">
                                    "{viewingLoan.observation}"
                                </div>
                            </div>
                        )}

                        {/* Books Details */}
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <BookIcon size={14} /> Livros e Movimentações por Item
                            </p>
                            <div className="space-y-3">
                                {viewingLoan.books.map(book => {
                                    const isMP = book.code?.endsWith('MP');
                                    const isExpanded = expandedBookIdInModal === book.id;
                                    return (
                                        <div key={book.id} className={`overflow-hidden rounded-2xl border transition-all ${book.status === 'Devolvido' ? 'bg-white border-gray-100' : isMP ? 'bg-orange-50/50 border-orange-100' : 'bg-white border-gray-100'} shadow-sm`}>
                                            <div 
                                                className={`p-4 cursor-pointer hover:bg-gray-50/50 transition-colors ${isExpanded ? 'bg-gray-50/30' : ''}`}
                                                onClick={() => setExpandedBookIdInModal(isExpanded ? null : book.id)}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className={`font-bold truncate ${isMP && book.status !== 'Devolvido' ? 'text-orange-900' : 'text-gray-800'}`}>
                                                            {book.title}
                                                            {isMP && (
                                                                <span className="ml-2 text-[8px] bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter align-middle">MP</span>
                                                            )}
                                                        </h4>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                                                            CÓD: <span className={isMP && book.status !== 'Devolvido' ? 'text-orange-700' : 'text-gray-600'}>{book.code || '---'}</span> • SÉRIE: <span className={isMP && book.status !== 'Devolvido' ? 'text-orange-700' : 'text-gray-600'}>{book.series || '---'}</span>
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3 ml-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${book.status === 'Devolvido' ? 'bg-emerald-100 text-emerald-700' : isMP ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {book.status}
                                                        </span>
                                                        <span className="text-gray-400">
                                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Book Specific Loan Details (Expandable) */}
                                                {isExpanded && (
                                                    <div className="mt-4 pt-4 border-t border-gray-100/50 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="p-2.5 bg-gray-50/50 rounded-xl border border-gray-100">
                                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Empréstimo</p>
                                                                <p className="text-[11px] font-bold text-gray-700">
                                                                    {(book.loanDate || viewingLoan.loanDate) ? new Date(book.loanDate || viewingLoan.loanDate).toLocaleDateString('pt-BR') : '---'} às {(book.loanDate || viewingLoan.loanDate) ? new Date(book.loanDate || viewingLoan.loanDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---'}
                                                                </p>
                                                                <p className="text-[9px] text-gray-400 mt-1 uppercase">Por: <span className="font-bold text-gray-600">{book.loanedBy || viewingLoan.loanedBy}</span></p>
                                                            </div>

                                                            {book.status === 'Devolvido' && book.returnDate ? (
                                                                <div className="p-2.5 bg-emerald-50/30 rounded-xl border border-emerald-100">
                                                                    <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Devolução</p>
                                                                    <p className="text-[11px] font-bold text-emerald-700">
                                                                        {new Date(book.returnDate || viewingLoan.returnDate || '').toLocaleDateString('pt-BR')} às {new Date(book.returnDate || viewingLoan.returnDate || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                    </p>
                                                                    <p className="text-[9px] text-emerald-500 mt-1 uppercase">Para: <span className="font-bold text-emerald-600">{book.returnedBy || '---'}</span></p>
                                                                </div>
                                                            ) : (
                                                                <div className="p-2.5 bg-gray-50/50 rounded-xl border border-gray-100 flex items-center justify-center border-dashed">
                                                                    <p className="text-[9px] text-gray-300 font-black uppercase italic tracking-widest">Em aberto</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Book Observation View/Edit */}
                                                        <div className="mt-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                                                            <div className="flex justify-between items-center mb-1.5">
                                                                <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                                                    <FileText size={10} /> Observação do Item
                                                                </p>
                                                                {editingBookObs?.bookId !== book.id && (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingBookObs({ loanId: viewingLoan.id, bookId: book.id, value: book.observation || '' });
                                                                        }}
                                                                        className="text-[9px] font-black uppercase text-amber-700 hover:underline"
                                                                    >
                                                                        {book.observation ? 'Editar' : 'Adicionar'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            
                                                            {editingBookObs?.bookId === book.id ? (
                                                                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                                    <textarea 
                                                                        className="w-full p-2 text-xs border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none h-16 resize-none bg-white"
                                                                        value={editingBookObs.value}
                                                                        onChange={e => setEditingBookObs({ ...editingBookObs, value: e.target.value })}
                                                                        placeholder="Ex: Aluno perdeu exemplar anterior..."
                                                                        autoFocus
                                                                    />
                                                                    <div className="flex justify-end gap-2">
                                                                        <button 
                                                                            onClick={() => setEditingBookObs(null)}
                                                                            className="px-2 py-1 text-[10px] text-gray-500 font-bold hover:bg-gray-100 rounded"
                                                                        >
                                                                            Cancelar
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleSaveBookObservation(viewingLoan.id, book.id, editingBookObs.value)}
                                                                            className="px-3 py-1 bg-amber-600 text-white text-[10px] font-bold rounded hover:bg-amber-700 transition-colors"
                                                                        >
                                                                            Salvar
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className={`text-xs ${book.observation ? 'text-amber-900 italic' : 'text-amber-400 font-medium'}`}>
                                                                    {book.observation ? `"${book.observation}"` : 'Nenhuma observação específica para este exemplar.'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button
                                onClick={() => setViewingLoan(null)}
                                className="px-8 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all text-sm"
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
