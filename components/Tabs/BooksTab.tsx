import React, { useState } from 'react';
import { Book, User, BookLoan, BookLoanStatus, Campus, UserLevel } from '../../types';
import { StorageService } from '../../services/storage';
import { Plus, Search, Trash2, Pencil, Loader2, FileText, Printer, Camera } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { BarcodeScanner } from '../ui/BarcodeScanner';

interface Props {
    books: Book[];
    bookLoans: BookLoan[];
    onUpdate: () => void;
    user: User;
    campuses: Campus[];
}

export const BooksTab: React.FC<Props> = ({ books, bookLoans, onUpdate, user, campuses }) => {
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingBook, setEditingBook] = useState<Book | null>(null);
    const [showScanner, setShowScanner] = useState(false);

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

    const filteredBooks = books.filter(b => {
        if (!search.trim()) return true;
        const searchTerms = normalizeText(search).split(/\s+/).filter(t => t.length > 0);
        const bookText = normalizeText(`${b.title} ${b.code} ${b.area}`);
        return searchTerms.every(term => bookText.includes(term));
    });

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
        <div class="label">Total em Estoque</div>
        <div class="value">${totalInStock}</div>
    </div>
    <div class="summary-item">
        <div class="label">Total Emprestado</div>
        <div class="value">${totalBorrowed}</div>
    </div>
    <div class="summary-item">
        <div class="label">Disponível p/ Empréstimo</div>
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
                <h3 className="font-bold text-gray-700 text-lg">Catálogo de Livros ({filteredBooks.length})</h3>

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
                            {filteredBooks.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-gray-400">Nenhum livro cadastrado.</td>
                                </tr>
                            ) : (
                                filteredBooks.map(book => (
                                    <tr key={book.id} className="hover:bg-gray-50 transition-colors group">
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
                                                    onClick={() => handleEdit(book)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Editar"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(book.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
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
                                <button
                                    type="button"
                                    onClick={() => setShowScanner(true)}
                                    className="absolute right-2 top-1.5 p-1 text-gray-400 hover:text-ifrn-green hover:bg-ifrn-green/10 rounded transition-colors"
                                    title="Escanear código de barras"
                                >
                                    <Camera size={20} />
                                </button>
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

            {showScanner && (
                <BarcodeScanner
                    onScan={(decodedText) => {
                        setCode(decodedText);
                        setShowScanner(false);
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    );
};
