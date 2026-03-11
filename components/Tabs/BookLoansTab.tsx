import React, { useState } from 'react';
import { Book, BookLoan, BookLoanStatus, Person, User, Campus, UserLevel } from '../../types';
import { StorageService } from '../../services/storage';
import { Search, History, CheckCircle, X, Loader2, ArrowRight, User as UserIcon, Book as BookIcon, Calendar, Clock, Undo2, Plus, FileText } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
    loans: BookLoan[];
    books: Book[];
    onUpdate: () => void;
    user: User;
    campuses: Campus[];
    adminGlobalCampusId?: string | null;
}

export const BookLoansTab: React.FC<Props> = ({ loans, books, onUpdate, user, campuses, adminGlobalCampusId }) => {
    const [activeSubTab, setActiveSubTab] = useState<'current' | 'history'>('current');
    const [showLoanModal, setShowLoanModal] = useState(false);
    const [showPartialReturnModal, setShowPartialReturnModal] = useState(false);
    const [selectedLoanForReturn, setSelectedLoanForReturn] = useState<BookLoan | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState('');

    // New Loan Form State
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [selectedBooks, setSelectedBooks] = useState<{ id: string, title: string, code?: string, series?: string, status?: 'Ativo' | 'Devolvido' }[]>([]);
    const [personSearch, setPersonSearch] = useState('');
    const [bookSearch, setBookSearch] = useState('');
    const [observation, setObservation] = useState('');
    const [searchResultsPeople, setSearchResultsPeople] = useState<Person[]>([]);
    const [isSearchingPeople, setIsSearchingPeople] = useState(false);

    const [viewingLoan, setViewingLoan] = useState<BookLoan | null>(null);
    const [selectedCampusId, setSelectedCampusId] = useState<string>(
        (user.level === UserLevel.ADMIN ? adminGlobalCampusId : user.campus_id) || ''
    );

    // Sync with global admin campus selector
    React.useEffect(() => {
        if (user.level === UserLevel.ADMIN && adminGlobalCampusId !== undefined) {
            setSelectedCampusId(adminGlobalCampusId || '');
        }
    }, [adminGlobalCampusId, user.level]);
    const [selectedSeries, setSelectedSeries] = useState<string>('');
    const [isBookInputFocused, setIsBookInputFocused] = useState(false);
    const [isSeriesSelectFocused, setIsSeriesSelectFocused] = useState(false);
    const [isMPToggleFocused, setIsMPToggleFocused] = useState(false);
    const [isBookListExpanded, setIsBookListExpanded] = useState(false);
    const [showMPBooks, setShowMPBooks] = useState(false);


    const handleAddBook = (book: Book) => {
        if (selectedBooks.find(b => b.id === book.id)) return;
        setSelectedBooks([...selectedBooks, {
            id: book.id,
            title: book.title,
            code: book.code,
            series: book.series,
            status: 'Ativo'
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
            const existingActiveLoan = loans.find(l => l.personId === person.id && l.status === BookLoanStatus.ACTIVE);

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
                    books: [...existingActiveLoan.books, ...selectedBooks.map(b => ({ ...b, status: 'Ativo' as const }))],
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
                    personId: person.id,
                    personName: person.name,
                    personMatricula: person.matricula, // Garantindo o mapeamento da matrícula
                    books: selectedBooks.map(b => ({ ...b, status: 'Ativo' as const })),
                    loanedBy: user.name,
                    loanDate: now,
                    status: BookLoanStatus.ACTIVE,
                    observation,
                    campus_id: user.level === UserLevel.ADMIN ? (selectedCampusId || user.campus_id) : user.campus_id,
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

    const activeLoans = filteredLoans.filter(l => l.status === BookLoanStatus.ACTIVE);
    const historicalLoans = filteredLoans.filter(l => l.status === BookLoanStatus.RETURNED);
    const handlePersonSearch = async (val: string) => {
        setPersonSearch(val);
        if (val.trim().length >= 2) {
            setIsSearchingPeople(true);
            try {
                const results = await StorageService.searchPeople(val, 10, user.level === UserLevel.ADMIN ? undefined : user.campus_id);
                setSearchResultsPeople(results);
            } catch (err) {
                console.error("Erro busca pessoas:", err);
            } finally {
                setIsSearchingPeople(false);
            }
        } else {
            setSearchResultsPeople([]);
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(activeSubTab === 'current' ? activeLoans : historicalLoans).length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        Nenhum registro encontrado.
                    </div>
                ) : (
                    (activeSubTab === 'current' ? activeLoans : historicalLoans).map(loan => (
                        <div
                            key={loan.id}
                            onClick={() => setViewingLoan(loan)}
                            className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer"
                        >
                            {loan.status === BookLoanStatus.RETURNED && (
                                <div className="absolute top-3 right-3 text-emerald-600 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full">
                                    <CheckCircle size={12} /> Devolvido
                                </div>
                            )}

                            <div className="flex items-start gap-3 mb-4">
                                <div className={`p-2 rounded-lg ${loan.status === BookLoanStatus.ACTIVE ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>
                                    <UserIcon size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 leading-tight">{loan.personName}</h4>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{loan.personMatricula}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
                                        <Calendar size={12} /> {new Date(loan.loanDate).toLocaleDateString('pt-BR')}
                                        <Clock size={12} /> {new Date(loan.loanDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 mb-4">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Livros Emprestados:</p>
                                <div className="flex flex-col gap-1.5">
                                    {loan.books.map(book => (
                                        <div key={book.id} className={`flex flex-col p-2 rounded-lg border text-xs ${book.status === 'Devolvido' ? 'bg-green-50 text-green-600 border-green-100 opacity-70' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1 font-bold">
                                                    <BookIcon size={12} /> {book.title}
                                                </div>
                                                {book.status === 'Devolvido' && <CheckCircle size={12} />}
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-0.5 ml-4">
                                                Código: <span className="text-gray-600">{book.code || 'N/A'}</span> • Série: <span className="text-gray-600">{book.series || 'N/A'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {loan.observation && (
                                <div className="mt-2 mb-4 p-2.5 bg-gray-50 rounded-lg border border-gray-100 italic text-[11px] text-gray-500 line-clamp-1">
                                    "{loan.observation}"
                                </div>
                            )}

                            <div className="pt-4 border-t border-dashed border-gray-100 flex items-center justify-between">
                                <div className="text-[10px] text-gray-400">
                                    Operador: <span className="font-medium text-gray-600">{loan.loanedBy}</span>
                                </div>
                                {loan.status === BookLoanStatus.ACTIVE && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedLoanForReturn(loan);
                                            setShowPartialReturnModal(true);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                    >
                                        <Undo2 size={14} /> Devolver
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
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
                                    <p className="text-[10px] text-blue-700 font-bold uppercase">{selectedPerson.matricula} • {selectedPerson.type}</p>
                                </div>
                                <button type="button" onClick={() => setSelectedPerson(null)} className="text-xs text-red-500 font-bold underline">Alterar</button>
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nome ou matrícula..."
                                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                                        value={personSearch}
                                        onFocus={() => setIsBookListExpanded(false)}
                                        onChange={e => handlePersonSearch(e.target.value)}
                                    />
                                </div>
                                {personSearch && (
                                    <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        {searchResultsPeople.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => { setSelectedPerson(p); setPersonSearch(''); setSearchResultsPeople([]); }}
                                                className="w-full text-left p-2 rounded text-sm hover:bg-gray-200 text-gray-700 transition-colors"
                                            >
                                                <div className="font-bold">{p.name}</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">{p.matricula} • {p.type}</div>
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
                            <div className="mt-4 flex flex-wrap gap-2">
                                {selectedBooks.map(b => {
                                    const isMP = b.code?.endsWith('MP');
                                    return (
                                        <span key={b.id} className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full border ${isMP ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-ifrn-green/10 text-ifrn-darkGreen border-ifrn-green/20'}`}>
                                            {b.title} <span className="opacity-60 font-medium">({b.code || 'S/C'})</span>
                                            <button onClick={() => handleRemoveBook(b.id)} className="ml-1 hover:text-red-500 transition-colors"><X size={14} /></button>
                                        </span>
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
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mt-4">
                            <label className="block text-xs font-bold text-amber-900 mb-2 uppercase tracking-tight">Câmpus do Empréstimo</label>
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
                            <p className="text-[10px] text-amber-700 mt-1 italic">Administrador: Isto definirá em qual campus este empréstimo será contabilizado.</p>
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
                onClose={() => { setShowPartialReturnModal(false); setSelectedLoanForReturn(null); }}
                title="Confirmar Devolução de Livros"
            >
                {selectedLoanForReturn && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                            <p className="text-sm font-bold text-blue-700">{selectedLoanForReturn.personName}</p>
                            <p className="text-xs text-blue-500 mt-1">Selecione os livros que estão sendo devolvidos agora:</p>
                        </div>

                        <div className="space-y-2">
                            {selectedLoanForReturn.books.map(book => (
                                <div
                                    key={book.id}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${book.status === 'Devolvido' ? 'bg-gray-50 opacity-50 border-gray-200' : 'bg-white border-gray-100 hover:border-ifrn-green cursor-pointer'}`}
                                    onClick={() => {
                                        if (book.status === 'Devolvido') return;
                                        const checkbox = document.getElementById(`book-${book.id}`) as HTMLInputElement;
                                        if (checkbox) checkbox.checked = !checkbox.checked;
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <BookIcon size={18} className={book.status === 'Devolvido' ? 'text-gray-400' : 'text-ifrn-green'} />
                                        <div>
                                            <p className={`text-sm font-bold ${book.status === 'Devolvido' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                                {book.title} <span className="text-[10px] opacity-60 font-semibold uppercase">({book.code || 'S/C'})</span>
                                            </p>
                                            {book.status === 'Devolvido' && (
                                                <p className="text-[10px] text-green-600 font-bold uppercase">Já devolvido em {new Date(book.returnDate!).toLocaleDateString('pt-BR')}</p>
                                            )}
                                        </div>
                                    </div>
                                    {book.status !== 'Devolvido' && (
                                        <input
                                            type="checkbox"
                                            id={`book-${book.id}`}
                                            className="w-5 h-5 accent-ifrn-green rounded border-gray-300"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="pt-6 flex justify-end gap-3 border-t">
                            <button
                                onClick={() => { setShowPartialReturnModal(false); setSelectedLoanForReturn(null); }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
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
                onClose={() => setViewingLoan(null)}
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
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1">Data Empréstimo</p>
                                <p className="text-sm font-bold text-blue-700">
                                    {new Date(viewingLoan.loanDate).toLocaleDateString('pt-BR')} às {new Date(viewingLoan.loanDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Status Geral</p>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${viewingLoan.status === BookLoanStatus.ACTIVE ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {viewingLoan.status}
                                </span>
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
                                {viewingLoan.books.map(book => (
                                    <div key={book.id} className="p-4 rounded-2xl border border-gray-100 bg-white shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-gray-800">{book.title}</h4>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                                                    CÓD: <span className="text-gray-600">{book.code || '---'}</span> • SÉRIE/ÁREA: <span className="text-gray-600">{book.series || '---'}</span>
                                                </p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${book.status === 'Devolvido' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {book.status}
                                            </span>
                                        </div>

                                        {book.status === 'Devolvido' && (
                                            <div className="mt-3 pt-3 border-t border-dashed border-gray-100 flex items-center gap-3">
                                                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                                    <CheckCircle size={14} />
                                                </div>
                                                <div className="text-[11px]">
                                                    <p className="font-bold text-emerald-700 uppercase tracking-tighter">Devolvido em {new Date(book.returnDate!).toLocaleDateString('pt-BR')} às {new Date(book.returnDate!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    <p className="text-gray-500">Recebido por: <span className="font-medium">{book.returnedBy}</span></p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Movement History */}
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <History size={14} /> Histórico de Ações
                            </p>
                            <div className="space-y-2">
                                {viewingLoan.history?.map((entry, idx) => (
                                    <div key={idx} className="flex gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                        <div className="mt-1">
                                            <div className="w-2 h-2 rounded-full bg-ifrn-green shadow-sm shadow-ifrn-green/50"></div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-gray-700 font-medium">{entry.action}</p>
                                            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 font-bold uppercase">
                                                <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(entry.timestamp).toLocaleDateString('pt-BR')}</span>
                                                <span className="flex items-center gap-1"><Clock size={10} /> {new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="flex items-center gap-1"><UserIcon size={10} /> {entry.user}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
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
