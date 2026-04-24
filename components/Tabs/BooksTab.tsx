import React, { useState, useMemo } from 'react';
import { Book, User, BookLoan, BookLoanStatus, Campus, UserLevel, Person } from '../../types';
import { StorageService } from '../../services/storage';
import { Plus, Search, Trash2, Pencil, Loader2, FileText, Printer, ArrowRight, X, ChevronUp, ChevronDown, ChevronsUpDown, User as UserIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';

type SortDir = 'asc' | 'desc';
type SortCol = keyof Pick<Book, 'edition' | 'code' | 'area' | 'title' | 'series' | 'publisher'>;
type SortEntry = { col: SortCol; dir: SortDir };

interface Props {
    books: Book[];
    bookLoans: BookLoan[];
    onUpdate: () => void;
    user: User;
    campuses: Campus[];
    people?: Person[];
    isPeopleLoading?: boolean;
    peopleSearchIndex?: { id: string, searchStr: string }[];
    adminGlobalCampusId?: string | null;
}

interface BookTableProps {
    books: Book[];
    title: string;
    onEdit: (book: Book) => void;
    onDelete: (id: string) => void;
    onLoan: (book: Book) => void;
    getBorrowedCount: (id: string) => number;
    sortConfig: SortEntry[];
    onSort: (col: SortCol) => void;
    onViewBorrowers: (book: Book) => void;
}

const SORT_COLS: { col: SortCol; label: string }[] = [
    { col: 'edition', label: 'Edição' },
    { col: 'code', label: 'Código' },
    { col: 'area', label: 'Área' },
    { col: 'title', label: 'Título' },
    { col: 'series', label: 'Série' },
    { col: 'publisher', label: 'Editora' },
];

const BookTable: React.FC<BookTableProps> = ({ books, title, onEdit, onDelete, onLoan, getBorrowedCount, sortConfig, onSort, onViewBorrowers }) => {
    const SortIcon = ({ col }: { col: SortCol }) => {
        const entry = sortConfig.find(s => s.col === col);
        const priority = sortConfig.findIndex(s => s.col === col);
        return (
            <span className="inline-flex items-center gap-0.5 ml-1">
                {priority >= 0 && (
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 bg-ifrn-green text-white text-[9px] font-black rounded-full">{priority + 1}</span>
                )}
                {entry ? (entry.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} className="text-gray-300" />}
            </span>
        );
    };

    return (
        <div className="space-y-4">
            <h4 className="font-bold text-gray-700 text-md px-2">{title} ({books.length})</h4>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
                            <tr>
                                {SORT_COLS.map(({ col, label }) => (
                                    <th key={col} className="p-4 cursor-pointer select-none hover:bg-gray-100 transition-colors" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSort(col); }}>
                                        <span className="inline-flex items-center">{label}<SortIcon col={col} /></span>
                                    </th>
                                ))}
                                <th className="p-4 text-center">QTD EMP.</th>
                                <th className="p-4 text-center">QTD ATUAL</th>
                                <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {books.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-gray-400">Nenhum livro encontrado nesta categoria.</td>
                                </tr>
                            ) : (
                                books.map(book => {
                                    const isMP = book.code?.endsWith('MP');
                                    return (
                                        <tr
                                            key={book.id}
                                            className={`hover:bg-gray-50 transition-colors group cursor-pointer ${isMP ? 'bg-orange-200/50' : ''}`}
                                            onClick={() => onViewBorrowers(book)}
                                        >
                                            <td className="p-4 whitespace-nowrap">{book.edition}</td>
                                            <td className="p-4 font-mono text-xs">{book.code}</td>
                                            <td className="p-4">{book.area}</td>
                                            <td className="p-4 font-bold text-gray-800">{book.title}</td>
                                            <td className="p-4">{book.series}</td>
                                            <td className="p-4">{book.publisher}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getBorrowedCount(book.id) > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {getBorrowedCount(book.id)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center font-bold">
                                                {book.quantity === 'Indeterminado' ? (
                                                    <span className="text-gray-400">Indeterminado</span>
                                                ) : (
                                                    <span className={parseInt(book.quantity) - getBorrowedCount(book.id) <= 0 ? 'text-red-600' : 'text-ifrn-darkGreen'}>
                                                        {Math.max(0, parseInt(book.quantity) - getBorrowedCount(book.id))}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => onLoan(book)}
                                                        className="p-1.5 text-ifrn-green hover:bg-ifrn-green/10 rounded"
                                                        title="Adicionar para Empréstimo"
                                                    >
                                                        <ArrowRight size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => onEdit(book)}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                        title="Editar"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => onDelete(book.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const BooksTab: React.FC<Props> = ({ books, bookLoans, onUpdate, user, campuses, people = [], isPeopleLoading, peopleSearchIndex = [], adminGlobalCampusId }) => {
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingBook, setEditingBook] = useState<Book | null>(null);
    const [sortConfig, setSortConfig] = useState<SortEntry[]>([]);

    // Quick Loan State (Multiple Books + Multiple Students)
    const [selectedLoanBooks, setSelectedLoanBooks] = useState<Book[]>([]);
    const [showQuickLoanModal, setShowQuickLoanModal] = useState(false);
    const [loanPersons, setLoanPersons] = useState<Person[]>([]);
    const [loanPersonSearch, setLoanPersonSearch] = useState('');
    const [loanBookSearch, setLoanBookSearch] = useState('');
    const [isBookInputFocused, setIsBookInputFocused] = useState(false);
    const [loanObs, setLoanObs] = useState('');
    const [isLoanLoading, setIsLoanLoading] = useState(false);
    const [searchResultsPeople, setSearchResultsPeople] = useState<Person[]>([]);
    const [isSearchingPeople, setIsSearchingPeople] = useState(false);
    const [selectedPersonIndex, setSelectedPersonIndex] = useState<number | null>(null);

    // View Borrowers State
    const [showBorrowersModal, setShowBorrowersModal] = useState(false);
    const [selectedBookForBorrowers, setSelectedBookForBorrowers] = useState<Book | null>(null);
    const [borrowerSearch, setBorrowerSearch] = useState('');
    const [borrowerTypeFilter, setBorrowerTypeFilter] = useState<'ALL' | 'STUDENT' | 'SERVER'>('ALL');

    // Form State
    const [edition, setEdition] = useState('');
    const [code, setCode] = useState('');
    const [area, setArea] = useState('');
    const [title, setTitle] = useState('');
    const [series, setSeries] = useState('');
    const [publisher, setPublisher] = useState('');
    const [quantity, setQuantity] = useState('Indeterminado');
    const [selectedCampusId, setSelectedCampusId] = useState<string>(
        (user.level === UserLevel.ADMIN ? adminGlobalCampusId : user.campus_id) || ''
    );

    // Sync with global admin campus selector
    React.useEffect(() => {
        if (user.level === UserLevel.ADMIN && adminGlobalCampusId !== undefined) {
            setSelectedCampusId(adminGlobalCampusId || '');
        }
    }, [adminGlobalCampusId, user.level]);

    const getBorrowedCount = (bookId: string) => {
        return bookLoans.reduce((total, loan) => {
            if (loan.status === BookLoanStatus.ACTIVE) {
                const bookInLoan = loan.books.find(b => b.id === bookId && b.status !== 'Devolvido');
                if (bookInLoan) return total + 1;
            }
            return total;
        }, 0);
    };

    const getBorrowers = (bookId: string) => {
        return bookLoans
            .filter(loan =>
                loan.status === BookLoanStatus.ACTIVE &&
                loan.books.some(b => b.id === bookId && b.status !== 'Devolvido')
            )
            .map(loan => {
                const bookEntry = loan.books.find(b => b.id === bookId && b.status !== 'Devolvido');
                let specificLoanDate = bookEntry?.loanDate;

                // Fallback inteligente para dados legados: procurar no histórico
                if (!specificLoanDate && loan.history) {
                    const bookTitle = bookEntry?.title;
                    const bookCode = bookEntry?.code;

                    // Procurar a última ação de empréstimo/adição deste livro específico
                    const historyEntry = [...loan.history].reverse().find(h =>
                        (h.action.includes('Novo livro adicionado') || h.action.includes('Empréstimo') || h.action.includes('Empréstimo inicial')) &&
                        (
                            (bookTitle && h.action.toLowerCase().includes(bookTitle.toLowerCase())) ||
                            (bookCode && h.action.includes(bookCode))
                        )
                    );

                    if (historyEntry) {
                        specificLoanDate = historyEntry.timestamp;
                    }
                }

                return {
                    id: loan.personMatricula,
                    name: loan.personName,
                    matricula: loan.personMatricula,
                    type: loan.personType,
                    loanDate: specificLoanDate || loan.loanDate,
                    loanedBy: bookEntry?.loanedBy || loan.loanedBy
                };
            })
            .sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime());
    };

    const resetForm = () => {
        setEdition('');
        setCode('');
        setArea('');
        setTitle('');
        setSeries('');
        setPublisher('');
        setQuantity('Indeterminado');
        setEditingBook(null);
    };

    const handleEdit = (book: Book) => {
        setEditingBook(book);
        setEdition(book.edition);
        setCode(book.code);
        setArea(book.area);
        setTitle(book.title);
        setSeries(book.series);
        setPublisher(book.publisher);
        setQuantity(book.quantity);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await StorageService.saveBook({
                id: editingBook?.id || Math.random().toString(36).substr(2, 9),
                edition,
                code,
                area,
                title,
                series,
                publisher,
                quantity,
                campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id
            });
            onUpdate();
            setShowModal(false);
            resetForm();
            alert('Livro salvo com sucesso!');
        } catch (err) {
            alert((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja remover este livro?')) {
            await StorageService.deleteBook(id);
            onUpdate();
        }
    };

    const normalizeText = (text: string) => {
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    };

    // Quick loan: handle person search input change
    const handlePersonSearchChange = (val: string) => {
        setLoanPersonSearch(val);
        // Clear results on change, matching FoundItemsTab behavior
        setSearchResultsPeople([]);
        setSelectedPersonIndex(null);
    };

    const performPersonSearch = async () => {
        const val = loanPersonSearch.trim();
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

    const handleAddPerson = (p: Person) => {
        if (!loanPersons.find(lp => lp.matricula === p.matricula)) {
            setLoanPersons(prev => [...prev, p]);
        }
        setLoanPersonSearch('');
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
                handleAddPerson(searchResultsPeople[selectedPersonIndex]);
            } else if (loanPersonSearch.trim().length >= 2) {
                performPersonSearch();
            }
        }
    };

    // Quick loan: filtered books by search within modal
    const filteredLoanBooks = useMemo(() => {
        const searchTerms = normalizeText(loanBookSearch).split(/\s+/).filter(t => t.length > 0);
        return books.filter(b => {
            if (searchTerms.length === 0) return true;
            const bookText = normalizeText(`${b.title} ${b.code} ${b.area}`);
            return searchTerms.every(term => bookText.includes(term));
        });
    }, [loanBookSearch, books]);

    const handleQuickLoan = async () => {
        if (selectedLoanBooks.length === 0 || loanPersons.length === 0) return;

        const hasMP = selectedLoanBooks.some(b => b.code?.endsWith('MP'));
        if (hasMP) {
            if (!confirm('Você selecionou um "Manual do Professor" (MP). Tem certeza que deseja emprestá-lo?')) {
                return;
            }
        }

        setIsLoanLoading(true);
        try {
            const now = new Date().toISOString();
            const booksToAdd: { id: string; title: string; code?: string; series?: string; status: 'Ativo' | 'Devolvido'; loanDate: string; loanedBy: string }[] = selectedLoanBooks.map(b => ({
                id: b.id,
                title: b.title,
                code: b.code,
                series: b.series,
                status: 'Ativo' as const,
                loanDate: now,
                loanedBy: user.name
            }));

            let totalLentCount = 0;
            let affectedPeopleCount = 0;

            // Process loan for each selected student
            for (const person of loanPersons) {
                const existing = bookLoans.find(l => l.personMatricula === person.matricula && l.status === BookLoanStatus.ACTIVE);
                let lentToThisPerson = 0;

                if (existing) {
                    const duplicates = selectedLoanBooks.filter(b =>
                        existing.books.some(eb => eb.id === b.id && eb.status === 'Ativo')
                    );

                    if (duplicates.length > 0) {
                        if (!confirm(`${person.name} já possui:\n${duplicates.map(d => `• ${d.title}`).join('\n')}\n\nIgnorar duplicados e adicionar apenas os novos?`)) {
                            setIsLoanLoading(false);
                            return;
                        }
                    }

                    const finalBooksToAdd = booksToAdd.filter(b =>
                        !existing.books.some(eb => eb.id === b.id && eb.status === 'Ativo')
                    );

                    if (finalBooksToAdd.length === 0) continue;

                    await StorageService.saveBookLoan({
                        ...existing,
                        books: [...existing.books, ...finalBooksToAdd.map(b => ({ ...b, loanDate: now, loanedBy: user.name }))],
                        history: [
                            ...(existing.history || []),
                            ...finalBooksToAdd.map(b => ({
                                action: `Novo livro adicionado: ${b.title} (#${b.code || 'S/C'})`,
                                user: user.name,
                                timestamp: now
                            }))
                        ]
                    });
                    lentToThisPerson = finalBooksToAdd.length;
                } else {
                    const newLoan: BookLoan = {
                        id: Math.random().toString(36).substr(2, 9),
                        personName: person.name,
                        personMatricula: person.matricula,
                        books: booksToAdd,
                        loanedBy: user.name,
                        loanDate: now,
                        status: BookLoanStatus.ACTIVE,
                        observation: loanObs,
                        campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id,
                        history: booksToAdd.map(b => ({
                            action: `Empréstimo: ${b.title} (#${b.code || 'S/C'})`,
                            user: user.name,
                            timestamp: now
                        }))
                    };
                    await StorageService.saveBookLoan(newLoan);
                    lentToThisPerson = booksToAdd.length;
                }

                if (lentToThisPerson > 0) {
                    totalLentCount += lentToThisPerson;
                    affectedPeopleCount++;
                }
            }

            onUpdate();

            if (totalLentCount > 0) {
                alert(`${totalLentCount} livro(s) emprestado(s) com sucesso para ${affectedPeopleCount} aluno(s)!`);
                setSelectedLoanBooks([]);
                setLoanPersons([]);
                setLoanPersonSearch('');
                setSearchResultsPeople([]);
                setLoanBookSearch('');
                setLoanObs('');
                setShowQuickLoanModal(false);
            } else {
                alert('Nenhum novo livro foi emprestado (todos os selecionados já estavam emprestados).');
            }
        } catch {
            alert('Erro ao registrar empréstimo.');
        } finally {
            setIsLoanLoading(false);
        }
    };

    const handleSort = (col: SortCol) => {
        const scrollY = window.scrollY;
        setSortConfig(prev => {
            const existing = prev.find(s => s.col === col);
            if (!existing) return [...prev, { col, dir: 'asc' }];
            if (existing.dir === 'asc') return prev.map(s => s.col === col ? { ...s, dir: 'desc' as SortDir } : s);
            return prev.filter(s => s.col !== col);
        });
        requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior }));
    };

    // Default base sort: title asc, then series asc (invisible, no badges)
    const DEFAULT_SORT: SortEntry[] = [
        { col: 'title', dir: 'asc' },
        { col: 'series', dir: 'asc' },
    ];

    const filteredBooks = useMemo(() => {
        let result = books.filter(b => {
            if (!search.trim()) return true;
            const searchTerms = normalizeText(search).split(/\s+/).filter(t => t.length > 0);
            const bookText = normalizeText(`${b.title} ${b.code} ${b.area} ${b.edition} ${b.publisher}`);
            return searchTerms.every(term => bookText.includes(term));
        });

        // Merge user sort + default fallback (skip default cols already in user sort)
        const userCols = new Set(sortConfig.map(s => s.col));
        const effectiveSort = [
            ...sortConfig,
            ...DEFAULT_SORT.filter(s => !userCols.has(s.col)),
        ];

        const getVal = (book: Book, col: SortCol): string => (book[col] ?? '').toLowerCase();
        result = [...result].sort((a, b) => {
            for (const { col, dir } of effectiveSort) {
                const va = getVal(a, col);
                const vb = getVal(b, col);
                if (va < vb) return dir === 'asc' ? -1 : 1;
                if (va > vb) return dir === 'asc' ? 1 : -1;
            }
            return 0;
        });

        return result;
    }, [search, books, sortConfig]);

    const studentBooks = filteredBooks.filter(b => !b.code?.endsWith('MP'));
    const teacherBooks = filteredBooks.filter(b => b.code?.endsWith('MP'));

    const availableBooksForReport = filteredBooks.filter(book => {
        if (book.quantity === 'Indeterminado') return true;
        const available = parseInt(book.quantity) - getBorrowedCount(book.id);
        return available > 0;
    });

    const campusName = campuses.find(c => c.id === (user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id))?.name || 'Câmpus Principal';

    const handlePrint = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR');
        const timeStr = now.toLocaleTimeString('pt-BR');

        const studentBooksReport = availableBooksForReport.filter(b => !b.code?.endsWith('MP'));
        const teacherBooksReport = availableBooksForReport.filter(b => b.code?.endsWith('MP'));

        const renderTableRows = (bookList: Book[]) => {
            return bookList.map(book => {
                const available = book.quantity === 'Indeterminado'
                    ? '∞'
                    : String(parseInt(book.quantity) - getBorrowedCount(book.id));
                return `
                    <tr>
                        <td>${book.edition || ''}</td>
                        <td class="mono">${book.code || ''}</td>
                        <td class="bold">${book.title || ''}</td>
                        <td>${book.series || ''}</td>
                        <td>${book.publisher || ''}</td>
                        <td class="center bold">${available}</td>
                    </tr>`;
            }).join('');
        };

        const totalInStock = books.reduce((acc, book) => {
            if (book.quantity === 'Indeterminado') return acc;
            return acc + (parseInt(book.quantity) || 0);
        }, 0);

        const totalBorrowed = books.reduce((acc, book) => {
            return acc + getBorrowedCount(book.id);
        }, 0);

        const totalAvailable = totalInStock - totalBorrowed;

        const logoSvg = `<svg viewBox="0 0 110 150" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="16" fill="#CB161D"/>
            <rect x="38" y="0" width="32" height="32" rx="6" fill="#78BE20"/>
            <rect x="76" y="0" width="32" height="32" rx="6" fill="#78BE20"/>
            <rect x="0" y="38" width="32" height="32" rx="6" fill="#78BE20"/>
            <rect x="38" y="38" width="32" height="32" rx="6" fill="#78BE20"/>
            <rect x="0" y="76" width="32" height="32" rx="6" fill="#78BE20"/>
            <rect x="38" y="76" width="32" height="32" rx="6" fill="#78BE20"/>
            <rect x="76" y="76" width="32" height="32" rx="6" fill="#78BE20"/>
            <rect x="0" y="114" width="32" height="32" rx="6" fill="#78BE20"/>
            <rect x="38" y="114" width="32" height="32" rx="6" fill="#78BE20"/>
        </svg>`;

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Inventário - IFRN</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #111; padding: 12mm; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #309B41; padding-bottom: 16px; margin-bottom: 20px; }
    .logo-area { display: flex; align-items: center; gap: 12px; }
    .logo-text { display: flex; flex-direction: column; }
    .logo-text .name { font-size: 18px; font-weight: 900; color: #1a1a1a; }
    .logo-text .sub { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #555; }
    .title-area { text-align: right; }
    .title-area h1 { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.03em; color: #1a1a1a; }
    .title-area p { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; color: #777; margin-top: 3px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .meta-box { background: #f8f8f8; border: 1px solid #eee; border-radius: 8px; padding: 10px 14px; }
    .meta-box .label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #aaa; margin-bottom: 3px; }
    .meta-box .value { font-size: 10px; font-weight: 900; color: #333; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .summary-item { background: #fff; border: 1px solid #111; padding: 12px; text-align: center; border-radius: 4px; }
    .summary-item .label { font-size: 8px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; color: #555; }
    .summary-item .value { font-size: 14px; font-weight: 900; color: #111; }
    
    .section-title { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #309B41; margin: 25px 0 10px 0; border-left: 4px solid #309B41; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 10px; }
    thead tr { border-bottom: 2px solid #111; }
    thead th { padding: 8px 6px; font-weight: 900; text-transform: uppercase; font-size: 8px; letter-spacing: 0.05em; text-align: left; }
    tbody tr { border-bottom: 1px solid #e5e5e5; }
    tbody td { padding: 7px 6px; color: #333; font-style: italic; }
    td.bold { font-weight: 900; font-style: normal; color: #111; }
    td.mono { font-family: monospace; font-size: 8px; font-style: normal; }
    td.center { text-align: center; font-style: normal; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px dashed #ccc; text-align: center; page-break-inside: avoid; break-inside: avoid; }
    .signature-line { display: inline-block; width: 220px; border-top: 1px solid #777; padding-top: 6px; margin-top: 30px; }
    .signature-line p { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; }
    .footer-note { font-size: 8px; color: #aaa; margin-top: 20px; font-style: italic; }
</style>
</head>
<body>
<div class="header">
    <div class="logo-area">
        ${logoSvg}
        <div class="logo-text">
            <span class="name">IFRN</span>
            <span class="sub">PNLD - ${campusName}</span>
        </div>
    </div>
    <div class="title-area">
        <h1>Relatório de Inventário</h1>
        <p>Acervo de Livros Disponíveis</p>
    </div>
</div>
<div class="meta">
    <div class="meta-box">
        <div class="label">Emitido em</div>
        <div class="value">${dateStr} às ${timeStr}</div>
    </div>
    <div class="meta-box">
        <div class="label">Operador</div>
        <div class="value">${user.name}</div>
    </div>
</div>
<div class="summary-grid">
    <div class="summary-item">
        <div class="label">Total de Livros</div>
        <div class="value">${totalInStock}</div>
    </div>
    <div class="summary-item">
        <div class="label">Total Emprestado</div>
        <div class="value">${totalBorrowed}</div>
    </div>
    <div class="summary-item">
        <div class="label">Disponíveis</div>
        <div class="value" style="color: #309B41">${totalAvailable}</div>
    </div>
</div>

<h2 class="section-title">Livro do Estudante</h2>
<table>
    <thead>
        <tr>
            <th>Edição</th>
            <th>Código</th>
            <th>Título</th>
            <th>Série</th>
            <th>Editora</th>
            <th style="text-align:center">Disponível</th>
        </tr>
    </thead>
    <tbody>${renderTableRows(studentBooksReport)}</tbody>
</table>

<h2 class="section-title">Manual do Professor</h2>
<table>
    <thead>
        <tr>
            <th>Edição</th>
            <th>Código</th>
            <th>Título</th>
            <th>Série</th>
            <th>Editora</th>
            <th style="text-align:center">Disponível</th>
        </tr>
    </thead>
    <tbody>${renderTableRows(teacherBooksReport)}</tbody>
</table>

<div class="footer">
    <div class="signature-line"><p>Assinatura Responsável</p></div>
    <p class="footer-note">Este documento foi gerado eletronicamente pelo SIGAE - IFRN em ${dateStr}</p>
</div>
</body>
</html>`;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) { document.body.removeChild(iframe); return; }

        doc.open();
        doc.write(html);
        doc.close();

        iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
        };
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="font-bold text-gray-700 text-lg">Catálogo Geral ({filteredBooks.length})</h3>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar livro ou código..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors font-medium text-sm shadow-sm"
                    >
                        <Printer size={18} /> Gerar Relatório
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="px-4 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen flex items-center gap-2 transition-colors font-medium text-sm"
                    >
                        <Plus size={18} /> Novo Livro
                    </button>
                </div>
            </div>

            <div className="space-y-8">
                <BookTable
                    title="Livro do Estudante"
                    books={studentBooks}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onLoan={(book) => {
                        if (!selectedLoanBooks.find(b => b.id === book.id)) {
                            setSelectedLoanBooks(prev => [...prev, book]);
                        }
                        setShowQuickLoanModal(true);
                    }}
                    getBorrowedCount={getBorrowedCount}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    onViewBorrowers={(book) => {
                        setSelectedBookForBorrowers(book);
                        setShowBorrowersModal(true);
                    }}
                />

                <BookTable
                    title="Manual do Professor"
                    books={teacherBooks}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onLoan={(book) => {
                        if (!selectedLoanBooks.find(b => b.id === book.id)) {
                            setSelectedLoanBooks(prev => [...prev, book]);
                        }
                        setShowQuickLoanModal(true);
                    }}
                    getBorrowedCount={getBorrowedCount}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    onViewBorrowers={(book) => {
                        setSelectedBookForBorrowers(book);
                        setShowBorrowersModal(true);
                    }}
                />
            </div>

            {/* Floating cart banner when modal is closed but books are selected */}
            {selectedLoanBooks.length > 0 && !showQuickLoanModal && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 bg-ifrn-green rounded-full text-xs font-black">{selectedLoanBooks.length}</span>
                        <span className="text-sm font-semibold">{selectedLoanBooks.length === 1 ? 'livro selecionado' : 'livros selecionados'}</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowQuickLoanModal(true)}
                            className="px-4 py-1.5 bg-ifrn-green hover:bg-ifrn-darkGreen text-white rounded-lg text-xs font-bold transition-colors"
                        >
                            Ver Empréstimo
                        </button>
                        <button
                            onClick={() => { setSelectedLoanBooks([]); setLoanPersons([]); setLoanObs(''); }}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Limpar seleção"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingBook ? "Editar Livro" : "Cadastrar Novo Livro"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Edição</label>
                            <input
                                required
                                value={edition}
                                onChange={e => setEdition(e.target.value)}
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green"
                                placeholder="PNLD - 2026..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Código</label>
                            <div className="relative">
                                <input
                                    required
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                    className="w-full border rounded-lg p-2.5 pr-12 text-sm focus:ring-2 focus:ring-ifrn-green"
                                    placeholder="Código único..."
                                />

                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Área do Conhecimento</label>
                        <input
                            required
                            value={area}
                            onChange={e => setArea(e.target.value)}
                            className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green"
                            placeholder="Ex: Matemática, Literatura..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Título</label>
                        <input
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green"
                            placeholder="Nome do livro..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Série/Ano</label>
                            <input
                                required
                                value={series}
                                onChange={e => setSeries(e.target.value)}
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green"
                                placeholder="Ex: 1º ANO..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Editora</label>
                            <input
                                required
                                value={publisher}
                                onChange={e => setPublisher(e.target.value)}
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green"
                                placeholder="Nome da editora..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Quantidade Atual</label>
                            <input
                                required
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green"
                                placeholder="Ex: 50 ou Indeterminado"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Quantidade Emprestada</label>
                            <div className="w-full border bg-gray-50 rounded-lg p-2.5 text-sm text-gray-500 font-bold flex items-center justify-between">
                                {editingBook ? getBorrowedCount(editingBook.id) : 0}
                                <FileText size={16} className="text-gray-400" />
                            </div>
                        </div>
                    </div>

                    {user.level === UserLevel.ADMIN && (
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mt-4">
                            <label className="block text-xs font-bold text-amber-900 mb-2 uppercase tracking-tight">Câmpus do Livro</label>
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

                    <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-bold flex items-center gap-2"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={18} /> : (editingBook ? 'Atualizar' : 'Salvar')}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={showQuickLoanModal && selectedLoanBooks.length > 0}
                onClose={() => {
                    setShowQuickLoanModal(false);
                    setLoanPersonSearch('');
                    setSearchResultsPeople([]);
                    setLoanBookSearch('');
                }}
                title="Empréstimo Rápido (Múltiplos Livros)"
            >
                <div className="space-y-6">
                    {/* Selected Books Section */}
                    <div className="space-y-3">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest leading-none">
                            Livros Selecionados ({selectedLoanBooks.length})
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {selectedLoanBooks.map((book, idx) => {
                                const isMP = book.code?.endsWith('MP');
                                return (
                                    <div key={`${book.id}-${idx}`} className={`p-3 rounded-xl border flex items-center justify-between group ${isMP ? 'bg-orange-50 border-orange-200' : 'bg-ifrn-green/5 border-ifrn-green/10'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isMP ? 'bg-orange-200 text-orange-800' : 'bg-ifrn-green/10 text-ifrn-green'}`}>
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className={`font-bold text-sm leading-tight ${isMP ? 'text-orange-900' : 'text-gray-800'}`}>{book.title}</h4>
                                                    {isMP && <span className="text-[8px] bg-orange-400 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">MP</span>}
                                                </div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{book.code || 'S/C'} • {book.series}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedLoanBooks(prev => prev.filter((_, i) => i !== idx))}
                                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add more books — closes modal so user can click on table */}
                        <button
                            type="button"
                            onClick={() => { setShowQuickLoanModal(false); setLoanBookSearch(''); }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-ifrn-green hover:text-ifrn-green hover:bg-ifrn-green/5 transition-all font-semibold"
                        >
                            <Plus size={14} />
                            Adicionar mais livros na tabela...
                        </button>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        {/* Students Section */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-semibold text-gray-500 uppercase">Aluno / Servidor ({loanPersons.length})</label>
                                {(isPeopleLoading || isSearchingPeople) && <Loader2 size={12} className="animate-spin text-ifrn-green" />}
                            </div>

                            {/* Selected students list */}
                            {loanPersons.length > 0 && (
                                <div className="space-y-1.5 mb-3">
                                    {loanPersons.map(p => (
                                        <div key={p.matricula} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-blue-900 text-sm">{p.name}</p>
                                                <p className="text-[10px] text-blue-600 font-bold uppercase">{p.matricula || 'Matrícula não informada'}</p>
                                            </div>
                                            <button
                                                onClick={() => setLoanPersons(prev => prev.filter(x => x.matricula !== p.matricula))}
                                                className="p-1 text-blue-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Search to add more students */}
                            <div className="relative group/search">
                                <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within/search:text-ifrn-green" size={16} />
                                <input
                                    type="text"
                                    placeholder={loanPersons.length === 0 ? 'Buscar por nome ou matrícula...' : 'Adicionar outro aluno...'}
                                    className="w-full pl-10 pr-12 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                                    value={loanPersonSearch}
                                    onChange={e => handlePersonSearchChange(e.target.value)}
                                    onKeyDown={handlePersonSearchKeyDown}
                                    autoFocus={loanPersons.length === 0}
                                />
                                <button
                                    type="button"
                                    onClick={performPersonSearch}
                                    className="absolute right-2 top-1.5 p-1 text-gray-400 hover:text-ifrn-green hover:bg-gray-100 rounded-md transition-all active:scale-95"
                                    title="Buscar aluno"
                                >
                                    <Search size={18} />
                                </button>
                                {searchResultsPeople.length > 0 && (
                                    <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                        {searchResultsPeople
                                            .filter(p => !loanPersons.find(lp => lp.matricula === p.matricula))
                                            .map((p, idx) => (
                                                <button
                                                    key={p.matricula}
                                                    onClick={() => handleAddPerson(p)}
                                                    className={`w-full text-left p-3 transition-colors border-b last:border-0 border-gray-100 ${selectedPersonIndex === idx ? 'bg-ifrn-green/10 border-l-4 border-l-ifrn-green' : 'hover:bg-gray-50'}`}
                                                    onMouseMove={() => setSelectedPersonIndex(idx)}
                                                >
                                                    <p className={`font-bold text-sm ${selectedPersonIndex === idx ? 'text-ifrn-darkGreen' : 'text-gray-800'}`}>{p.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">{p.matricula || 'Matrícula não informada'}</p>
                                                </button>
                                            ))
                                        }
                                        {searchResultsPeople.filter(p => !loanPersons.find(lp => lp.matricula === p.matricula)).length === 0 && !isSearchingPeople && (
                                            <div className="p-4 text-center text-xs text-gray-400">Nenhum aluno encontrado.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Observação (Opcional)</label>
                            <textarea
                                className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-ifrn-green outline-none h-20 resize-none"
                                placeholder="Adicione observações se necessário..."
                                value={loanObs}
                                onChange={e => setLoanObs(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pt-6 flex justify-end gap-3 border-t">
                        <button
                            onClick={() => { setSelectedLoanBooks([]); setLoanPersons([]); setLoanPersonSearch(''); setSearchResultsPeople([]); setLoanBookSearch(''); setLoanObs(''); setShowQuickLoanModal(false); }}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-semibold"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleQuickLoan}
                            disabled={isLoanLoading || loanPersons.length === 0}
                            className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-bold flex items-center gap-2 disabled:opacity-50 shadow-md active:scale-95"
                        >
                            {isLoanLoading ? <Loader2 className="animate-spin" size={18} /> : `Finalizar (${loanPersons.length} aluno${loanPersons.length !== 1 ? 's' : ''})`}
                        </button>
                    </div>
                </div>
            </Modal>


            <Modal
                isOpen={showBorrowersModal && !!selectedBookForBorrowers}
                onClose={() => {
                    setShowBorrowersModal(false);
                    setSelectedBookForBorrowers(null);
                    setBorrowerSearch('');
                    setBorrowerTypeFilter('ALL');
                }}
                title="Pessoas com este Livro"
            >
                <div className="space-y-4">
                    <div className="bg-ifrn-green/5 p-4 rounded-xl border border-ifrn-green/10 mb-2">
                        <h4 className="font-bold text-gray-800 text-sm leading-tight">{selectedBookForBorrowers?.title}</h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{selectedBookForBorrowers?.code || 'S/C'} • {selectedBookForBorrowers?.series}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Buscar pessoa ou matrícula..."
                                className="w-full pl-8 pr-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-ifrn-green outline-none"
                                value={borrowerSearch}
                                onChange={e => setBorrowerSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg shrink-0">
                            {(['ALL', 'STUDENT', 'SERVER'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setBorrowerTypeFilter(f)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${borrowerTypeFilter === f ? 'bg-white text-ifrn-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {f === 'ALL' ? 'Todos' : f === 'STUDENT' ? 'Alunos' : 'Servidores'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {(() => {
                            if (!selectedBookForBorrowers) return null;
                            const borrowers = getBorrowers(selectedBookForBorrowers.id);
                            const filtered = borrowers.filter(b => {
                                const st = normalizeText(borrowerSearch);
                                const matchesSearch = normalizeText(b.name).includes(st) || (b.matricula && normalizeText(b.matricula).includes(st));
                                const matchesType = borrowerTypeFilter === 'ALL' ||
                                    (borrowerTypeFilter === 'STUDENT' && b.type === 'Aluno') ||
                                    (borrowerTypeFilter === 'SERVER' && b.type === 'Servidor');
                                return matchesSearch && matchesType;
                            });

                            if (filtered.length === 0) {
                                return <p className="text-center py-8 text-gray-400 text-sm italic">Nenhum resultado encontrado.</p>;
                            }

                            return filtered.map((borrower, idx) => (
                                <div key={`${borrower.id}-${idx}`} className="p-3 rounded-xl border bg-white border-gray-100 flex items-center justify-between group hover:border-ifrn-green/30 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${borrower.type === 'Servidor' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                            <UserIcon size={14} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-sm text-gray-800 leading-none">{borrower.name}</h4>
                                                <span className={`text-[8px] px-1 py-0.5 rounded font-black uppercase tracking-tighter ${borrower.type === 'Servidor' ? 'bg-orange-200 text-orange-900' : 'bg-blue-200 text-blue-900'}`}>
                                                    {borrower.type || 'S/D'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">{borrower.matricula || 'Matrícula não informada'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1">
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase leading-none mb-1">Data do Empréstimo</p>
                                            <p className="text-xs text-ifrn-green font-bold leading-none">{new Date(borrower.loanDate).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        <div className="mt-1">
                                            <p className="text-[9px] text-gray-300 font-bold uppercase leading-none mb-0.5">Operador</p>
                                            <p className="text-[10px] text-gray-500 font-medium leading-none truncate max-w-[80px]" title={borrower.loanedBy}>{borrower.loanedBy}</p>
                                        </div>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>

                    <div className="pt-4 flex justify-end border-t">
                        <button
                            onClick={() => {
                                setShowBorrowersModal(false);
                                setSelectedBookForBorrowers(null);
                                setBorrowerSearch('');
                                setBorrowerTypeFilter('ALL');
                            }}
                            className="px-6 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-bold transition-all"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
