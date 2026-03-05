import React, { useState, useMemo } from 'react';
import { Book, User, BookLoan, BookLoanStatus, Campus, UserLevel, Person } from '../../types';
import { StorageService } from '../../services/storage';
import { Plus, Search, Trash2, Pencil, Loader2, FileText, Printer, ArrowRight, X } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
    books: Book[];
    bookLoans: BookLoan[];
    onUpdate: () => void;
    user: User;
    campuses: Campus[];
    people?: Person[];
    isPeopleLoading?: boolean;
    peopleSearchIndex?: { id: string, searchStr: string }[];
}

interface BookTableProps {
    books: Book[];
    title: string;
    onEdit: (book: Book) => void;
    onDelete: (id: string) => void;
    onLoan: (book: Book) => void;
    getBorrowedCount: (id: string) => number;
}

const BookTable: React.FC<BookTableProps> = ({ books, title, onEdit, onDelete, onLoan, getBorrowedCount }) => (
    <div className="space-y-4">
        <h4 className="font-bold text-gray-700 text-md px-2">{title} ({books.length})</h4>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
                        <tr>
                            <th className="p-4">Edição</th>
                            <th className="p-4">Código</th>
                            <th className="p-4">Área</th>
                            <th className="p-4">Título</th>
                            <th className="p-4">Série</th>
                            <th className="p-4">Editora</th>
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
                                    <tr key={book.id} className={`hover:bg-gray-50 transition-colors group ${isMP ? 'bg-orange-200/50' : ''}`}>
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
                                        <td className="p-4">
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

export const BooksTab: React.FC<Props> = ({ books, bookLoans, onUpdate, user, campuses, people = [], isPeopleLoading, peopleSearchIndex = [] }) => {
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingBook, setEditingBook] = useState<Book | null>(null);

    // Quick Loan State (Multiple Books)
    const [selectedLoanBooks, setSelectedLoanBooks] = useState<Book[]>([]);
    const [loanPerson, setLoanPerson] = useState<Person | null>(null);
    const [loanPersonSearch, setLoanPersonSearch] = useState('');
    const [loanBookSearch, setLoanBookSearch] = useState('');
    const [isBookInputFocused, setIsBookInputFocused] = useState(false);
    const [loanObs, setLoanObs] = useState('');
    const [isLoanLoading, setIsLoanLoading] = useState(false);

    // Form State
    const [edition, setEdition] = useState('');
    const [code, setCode] = useState('');
    const [area, setArea] = useState('');
    const [title, setTitle] = useState('');
    const [series, setSeries] = useState('');
    const [publisher, setPublisher] = useState('');
    const [quantity, setQuantity] = useState('Indeterminado');
    const [selectedCampusId, setSelectedCampusId] = useState<string>(user.campus_id || '');

    const getBorrowedCount = (bookId: string) => {
        return bookLoans.reduce((total, loan) => {
            if (loan.status === BookLoanStatus.ACTIVE) {
                const bookInLoan = loan.books.find(b => b.id === bookId && b.status !== 'Devolvido');
                if (bookInLoan) return total + 1;
            }
            return total;
        }, 0);
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

    // Quick loan: filtered people by search index
    const filteredLoanPeople = useMemo(() => {
        if (!loanPersonSearch.trim() || loanPersonSearch.length < 2) return [];
        const searchTerms = normalizeText(loanPersonSearch).split(/\s+/).filter(t => t.length > 0);
        const matchingIds = new Set(
            peopleSearchIndex
                .filter(idx => searchTerms.every(term => idx.searchStr.includes(term)))
                .slice(0, 10)
                .map(idx => idx.id)
        );
        return people.filter(p => matchingIds.has(p.id));
    }, [loanPersonSearch, people, peopleSearchIndex]);

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
        if (selectedLoanBooks.length === 0 || !loanPerson) return;

        const hasMP = selectedLoanBooks.some(b => b.code?.endsWith('MP'));
        if (hasMP) {
            if (!confirm('Você selecionou um "Manual do Professor" (MP). Tem certeza que deseja emprestá-lo?')) {
                return;
            }
        }

        setIsLoanLoading(true);
        try {
            const now = new Date().toISOString();
            const existing = bookLoans.find(l => l.personId === loanPerson.id && l.status === BookLoanStatus.ACTIVE);

            const booksToAdd: { id: string; title: string; code?: string; series?: string; status: "Ativo" | "Devolvido" }[] = selectedLoanBooks.map(b => ({
                id: b.id,
                title: b.title,
                code: b.code,
                series: b.series,
                status: 'Ativo' as const
            }));

            if (existing) {
                // Check if any book is already in open loan
                const duplicates = selectedLoanBooks.filter(b =>
                    existing.books.some(eb => eb.id === b.id && eb.status === 'Ativo')
                );

                if (duplicates.length > 0) {
                    if (!confirm(`${loanPerson.name} já possui os seguintes livros em aberto:\n${duplicates.map(d => `• ${d.title}`).join('\n')}\n\nDeseja ignorar os duplicados e adicionar apenas os novos?`)) {
                        setIsLoanLoading(false);
                        return;
                    }
                }

                const finalBooksToAdd = booksToAdd.filter(b =>
                    !existing.books.some(eb => eb.id === b.id && eb.status === 'Ativo')
                );

                if (finalBooksToAdd.length === 0) {
                    alert('Nenhum livro novo para adicionar ao empréstimo existente.');
                    setIsLoanLoading(false);
                    return;
                }

                await StorageService.saveBookLoan({
                    ...existing,
                    books: [...existing.books, ...finalBooksToAdd],
                    history: [
                        ...(existing.history || []),
                        ...finalBooksToAdd.map(b => ({
                            action: `Novo livro adicionado (Seta): ${b.title} (#${b.code || 'S/C'})`,
                            user: user.name,
                            timestamp: now
                        }))
                    ]
                });
            } else {
                const newLoan: BookLoan = {
                    id: Math.random().toString(36).substr(2, 9),
                    personId: loanPerson.id,
                    personName: loanPerson.name,
                    personMatricula: loanPerson.matricula,
                    books: booksToAdd,
                    loanedBy: user.name,
                    loanDate: now,
                    status: BookLoanStatus.ACTIVE,
                    observation: loanObs,
                    campus_id: user.level === UserLevel.ADMIN ? selectedCampusId : user.campus_id,
                    history: booksToAdd.map(b => ({
                        action: `Empréstimo (Seta): ${b.title} (#${b.code || 'S/C'})`,
                        user: user.name,
                        timestamp: now
                    }))
                };
                await StorageService.saveBookLoan(newLoan);
            }

            onUpdate();
            alert(`${selectedLoanBooks.length} livro(s) emprestado(s) com sucesso para ${loanPerson.name}!`);
            setSelectedLoanBooks([]);
            setLoanPerson(null);
            setLoanPersonSearch('');
            setLoanBookSearch('');
            setLoanObs('');
        } catch {
            alert('Erro ao registrar empréstimo.');
        } finally {
            setIsLoanLoading(false);
        }
    };

    const filteredBooks = useMemo(() => {
        if (!search.trim()) return books;
        const searchTerms = normalizeText(search).split(/\s+/).filter(t => t.length > 0);
        return books.filter(b => {
            const bookText = normalizeText(`${b.title} ${b.code} ${b.area} ${b.edition} ${b.publisher}`);
            return searchTerms.every(term => bookText.includes(term));
        });
    }, [search, books]);

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

        const rows = availableBooksForReport.map(book => {
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
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    thead tr { border-bottom: 2px solid #111; }
    thead th { padding: 8px 6px; font-weight: 900; text-transform: uppercase; font-size: 8px; letter-spacing: 0.05em; text-align: left; }
    tbody tr { border-bottom: 1px solid #e5e5e5; }
    tbody td { padding: 7px 6px; color: #333; font-style: italic; }
    td.bold { font-weight: 900; font-style: normal; color: #111; }
    td.mono { font-family: monospace; font-size: 8px; font-style: normal; }
    td.center { text-align: center; font-style: normal; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px dashed #ccc; text-align: center; }
    .signature-line { display: inline-block; width: 220px; border-top: 1px solid #777; padding-top: 6px; margin-top: 50px; }
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
    <tbody>${rows}</tbody>
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
                    onLoan={(book) => setSelectedLoanBooks(prev => [...prev, book])}
                    getBorrowedCount={getBorrowedCount}
                />

                <BookTable
                    title="Manual do Professor"
                    books={teacherBooks}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onLoan={(book) => setSelectedLoanBooks(prev => [...prev, book])}
                    getBorrowedCount={getBorrowedCount}
                />
            </div>

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
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Título</label>
                        <input
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green"
                            placeholder="Nome do livro..."
                        />
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
                isOpen={selectedLoanBooks.length > 0}
                onClose={() => { setSelectedLoanBooks([]); setLoanPerson(null); setLoanPersonSearch(''); setLoanBookSearch(''); setLoanObs(''); }}
                title="Empréstimo Rápido (Múltiplos Livros)"
            >
                <div className="space-y-6">
                    {/* Selected Books Section */}
                    <div className="space-y-3">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest leading-none">
                            Livros Selecionados ({selectedLoanBooks.length})
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {selectedLoanBooks.map((book, idx) => (
                                <div key={`${book.id}-${idx}`} className="bg-ifrn-green/5 p-3 rounded-xl border border-ifrn-green/10 flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-ifrn-green/10 text-ifrn-green rounded-lg flex items-center justify-center font-bold text-xs">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm leading-tight">{book.title}</h4>
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
                            ))}
                        </div>

                        {/* Add more books search */}
                        <div className="relative pt-2">
                            <Plus className="absolute left-3 top-4.5 text-ifrn-green" size={14} style={{ top: '1.15rem' }} />
                            <input
                                type="text"
                                placeholder="Adicionar mais livros..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-ifrn-green outline-none"
                                value={loanBookSearch}
                                onChange={e => setLoanBookSearch(e.target.value)}
                                onFocus={() => setIsBookInputFocused(true)}
                                onBlur={() => setTimeout(() => setIsBookInputFocused(false), 200)}
                            />
                            {(loanBookSearch.length > 0 || isBookInputFocused) && (
                                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                    {filteredLoanBooks.map(b => {
                                        const isMP = b.code?.endsWith('MP');
                                        return (
                                            <button
                                                key={b.id}
                                                onClick={() => {
                                                    setSelectedLoanBooks(prev => [...prev, b]);
                                                    setLoanBookSearch('');
                                                }}
                                                className={`w-full text-left p-3 hover:bg-ifrn-green/5 transition-colors border-b last:border-0 border-gray-100 ${isMP ? 'bg-orange-100/50' : ''}`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-bold text-xs text-gray-800">{b.title}</p>
                                                        <p className="text-[9px] text-gray-400 font-bold uppercase">{b.code || 'S/C'} • {b.series}</p>
                                                    </div>
                                                    {isMP && (
                                                        <span className="text-[8px] bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">MP</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {filteredLoanBooks.length === 0 && <div className="p-3 text-center text-[10px] text-gray-400">Nenhum livro encontrado.</div>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-semibold text-gray-500 uppercase">Selecionar Aluno</label>
                                {isPeopleLoading && <Loader2 size={12} className="animate-spin text-ifrn-green" />}
                            </div>

                            {loanPerson ? (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className="font-bold text-blue-900">{loanPerson.name}</p>
                                        <p className="text-[10px] text-blue-700 font-bold uppercase">{loanPerson.matricula}</p>
                                    </div>
                                    <button onClick={() => setLoanPerson(null)} className="text-xs text-red-500 font-bold underline ml-4">Alterar</button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nome ou matrícula..."
                                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-ifrn-green outline-none"
                                        value={loanPersonSearch}
                                        onChange={e => setLoanPersonSearch(e.target.value)}
                                        autoFocus
                                    />
                                    {loanPersonSearch.length >= 2 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                            {filteredLoanPeople.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setLoanPerson(p)}
                                                    className="w-full text-left p-3 hover:bg-gray-50 transition-colors border-b last:border-0 border-gray-100"
                                                >
                                                    <p className="font-bold text-sm text-gray-800">{p.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">{p.matricula}</p>
                                                </button>
                                            ))}
                                            {filteredLoanPeople.length === 0 && <div className="p-4 text-center text-xs text-gray-400">Nenhum aluno encontrado.</div>}
                                        </div>
                                    )}
                                </div>
                            )}
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
                            onClick={() => { setSelectedLoanBooks([]); setLoanPerson(null); setLoanPersonSearch(''); setLoanBookSearch(''); setLoanObs(''); }}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-semibold"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleQuickLoan}
                            disabled={isLoanLoading || !loanPerson}
                            className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-bold flex items-center gap-2 disabled:opacity-50 shadow-md active:scale-95"
                        >
                            {isLoanLoading ? <Loader2 className="animate-spin" size={18} /> : 'Finalizar Empréstimo'}
                        </button>
                    </div>
                </div>
            </Modal>


        </div>
    );
};
