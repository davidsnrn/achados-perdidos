import React, { useState, useMemo } from 'react';
import { Book, BookLoan, BookLoanStatus, Person, User, Campus, UserLevel, PersonType } from '../../types';
import { Search, Calendar, User as UserIcon, Book as BookIcon, TrendingUp, CheckCircle, AlertCircle, FileText, LayoutGrid, List, ChevronRight, Download, BarChart3, Filter, Clock } from 'lucide-react';

interface Props {
    books: Book[];
    loans: BookLoan[];
    user: User;
    campuses: Campus[];
    adminGlobalCampusId?: string | null;
}

type ReportView = 'general' | 'detailed';
type BookDisplayStyle = 'table' | 'cards';

export const BookReportsTab: React.FC<Props> = ({ books, loans, user, campuses, adminGlobalCampusId }) => {
    const [activeView, setActiveView] = useState<ReportView>('general');
    const [bookStyle, setBookStyle] = useState<BookDisplayStyle>('table');
    
    // Filters State
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [personSearch, setPersonSearch] = useState<string>('');
    const [bookSearch, setBookSearch] = useState<string>('');
    
    // Base stats
    const stats = useMemo(() => {
        const totalBooks = books.reduce((acc, b) => acc + (parseInt(b.quantity) || 0), 0);
        const activeLoansCount = loans.filter(l => l.status === BookLoanStatus.ACTIVE).length;
        const totalLentBooks = loans.reduce((acc, l) => {
            if (l.status === BookLoanStatus.ACTIVE) {
                return acc + l.books.filter(b => b.status === 'Ativo').length;
            }
            return acc;
        }, 0);
        
        const uniqueBorrowers = new Set(loans.map(l => l.personMatricula)).size;
        
        return {
            totalBooks,
            activeLoansCount,
            totalLentBooks,
            availableBooks: totalBooks - totalLentBooks,
            uniqueBorrowers
        };
    }, [books, loans]);

    // Unified Filtered Loans
    const filteredLoans = useMemo(() => {
        return loans.filter(l => {
            // Filter by Period
            if (startDate || endDate) {
                const loanDateStr = l.loanDate.split('T')[0]; // Get only YYYY-MM-DD
                
                if (startDate && loanDateStr < startDate) return false;
                if (endDate && loanDateStr > endDate) return false;
            }

            // Filter by Person
            if (personSearch.trim()) {
                const terms = personSearch.toLowerCase().split(/\s+/).filter(t => t.length > 0);
                const name = l.personName.toLowerCase();
                const matricula = l.personMatricula?.toLowerCase() || '';
                const matchesPerson = terms.every(term => 
                    name.includes(term) || matricula.includes(term)
                );
                if (!matchesPerson) return false;
            }

            // Filter by Book
            if (bookSearch.trim()) {
                const terms = bookSearch.toLowerCase().split(/\s+/).filter(t => t.length > 0);
                const matchesBook = terms.every(term => 
                    l.books.some(b => 
                        b.title.toLowerCase().includes(term) || 
                        b.code?.toLowerCase().includes(term)
                    )
                );
                if (!matchesBook) return false;
            }

            return true;
        });
    }, [loans, startDate, endDate, personSearch, bookSearch]);

    // Most Borrowed Books
    const mostBorrowed = useMemo(() => {
        const counts: Record<string, { title: string; count: number; code?: string; series?: string }> = {};
        
        loans.forEach(l => {
            l.books.forEach(b => {
                if (!counts[b.id]) {
                    counts[b.id] = { title: b.title, count: 0, code: b.code, series: b.series };
                }
                counts[b.id].count++;
            });
        });
        
        return Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [loans]);

    const renderGeneralView = () => (
        <div className="space-y-8 animate-fade-in-up">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <BookIcon size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total no Acervo</span>
                    </div>
                    <p className="text-3xl font-black text-gray-900">{stats.totalBooks}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium italic">Soma de todos os exemplares</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <Clock size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lent Books / Est. Ativos</span>
                    </div>
                    <p className="text-3xl font-black text-gray-900">{stats.totalLentBooks}</p>
                    <p className="text-xs text-amber-600 mt-1 font-bold">{stats.activeLoansCount} transações ativas</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                            <CheckCircle size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Disponíveis</span>
                    </div>
                    <p className="text-3xl font-black text-gray-900">{stats.availableBooks}</p>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3">
                        <div 
                            className="bg-green-500 h-full rounded-full" 
                            style={{ width: `${(stats.availableBooks / stats.totalBooks) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                            <UserIcon size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Leitores Ativos</span>
                    </div>
                    <p className="text-3xl font-black text-gray-900">{stats.uniqueBorrowers}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium italic">Pessoas que já emprestaram</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Most Borrowed Books */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <BarChart3 size={18} className="text-ifrn-green" />
                            Livros Mais Procurados
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            {mostBorrowed.map((book, index) => (
                                <div key={index} className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500">
                                        #{index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-gray-900 truncate">{book.title}</p>
                                            {book.series && <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-500 font-bold uppercase">{book.series}</span>}
                                        </div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{book.code || 'S/C'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-ifrn-green">{book.count}</p>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase">Ciclos</p>
                                    </div>
                                </div>
                            ))}
                            {mostBorrowed.length === 0 && (
                                <div className="text-center py-8 text-gray-400 italic text-sm">Nenhum dado de empréstimo disponível.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Display Styles Preview */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <LayoutGrid size={18} className="text-ifrn-green" />
                            Catálogo de Livros - Estilos
                        </h3>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setBookStyle('table')}
                                className={`p-1.5 rounded-md transition-all ${bookStyle === 'table' ? 'bg-white shadow-sm text-ifrn-green' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <List size={16} />
                            </button>
                            <button 
                                onClick={() => setBookStyle('cards')}
                                className={`p-1.5 rounded-md transition-all ${bookStyle === 'cards' ? 'bg-white shadow-sm text-ifrn-green' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <LayoutGrid size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className={`grid gap-4 ${bookStyle === 'table' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
                            {books.slice(0, bookStyle === 'table' ? 4 : 6).map(book => (
                                bookStyle === 'table' ? (
                                    <div key={book.id} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                                        <div className="p-2 bg-blue-50 text-blue-500 rounded-lg">
                                            <BookIcon size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-gray-800 truncate">{book.title}</p>
                                            <p className="text-[10px] text-gray-400">{book.series} • {book.publisher}</p>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-300" />
                                    </div>
                                ) : (
                                    <div key={book.id} className="aspect-square rounded-xl border border-gray-100 p-3 flex flex-col items-center justify-center text-center gap-2 hover:bg-gray-50 transition-colors">
                                        <BookIcon size={24} className="text-blue-500" />
                                        <p className="text-[10px] font-bold text-gray-800 line-clamp-2">{book.title}</p>
                                        <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-500 font-bold uppercase">{book.series}</span>
                                    </div>
                                )
                            ))}
                            <div className="text-center pt-2">
                                <p className="text-[10px] text-gray-400 italic">...e outros {Math.max(0, books.length - (bookStyle === 'table' ? 4 : 6))} exemplares</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const handleExportPDF = async () => {
        if (filteredLoans.length === 0) {
            alert("Nenhum dado para exportar.");
            return;
        }

        try {
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;
            
            const doc = new jsPDF();
            
            // Header Content
            doc.setFontSize(20);
            doc.setTextColor(40, 40, 40);
            doc.text("Relatório de Empréstimos - IFRN", 14, 22);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            const periodText = startDate || endDate ? `Período: ${startDate || 'Início'} até ${endDate || 'Fim'}` : "Histórico Geral";
            doc.text(`${periodText} | Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
            
            const tableData = filteredLoans.map(loan => [
                new Date(loan.loanDate).toLocaleDateString('pt-BR'),
                loan.personName,
                loan.personMatricula || 'N/A',
                loan.books.map(b => `${b.title} (${b.code || 'S/C'})`).join(', '),
                loan.status,
                loan.loanedBy
            ]);

            autoTable(doc, {
                startY: 35,
                head: [['Data', 'Pessoa', 'Matrícula', 'Livros', 'Status', 'Operador']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [4, 120, 87] }, // IFRN Green
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 20 },
                    3: { cellWidth: 60 }
                }
            });

            doc.save(`relatorio_livros_${new Date().getTime()}.pdf`);
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            alert("Erro ao gerar o PDF. Verifique se as dependências estão instaladas.");
        }
    };

    const renderDetailedView = () => (
        <div className="space-y-6 animate-fade-in-up">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div className="w-full">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Data Inicial</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-ifrn-green/20 outline-none"
                            />
                        </div>
                    </div>
                    <div className="w-full">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Data Final</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input 
                                type="date" 
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-ifrn-green/20 outline-none"
                            />
                        </div>
                    </div>
                    <div className="w-full">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pessoa (Nome/Matrícula)</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Filtrar por pessoa..."
                                value={personSearch}
                                onChange={e => setPersonSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-ifrn-green/20 outline-none"
                            />
                        </div>
                    </div>
                    <div className="w-full">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Livro (Título/Código)</label>
                        <div className="relative">
                            <BookIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Filtrar por livro..."
                                value={bookSearch}
                                onChange={e => setBookSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-ifrn-green/20 outline-none"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-2">
                    <button 
                        onClick={() => { setStartDate(''); setEndDate(''); setPersonSearch(''); setBookSearch(''); }}
                        className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-bold text-sm h-[42px]"
                    >
                        Limpar Filtros
                    </button>
                    <button 
                        onClick={handleExportPDF}
                        disabled={filteredLoans.length === 0}
                        className="px-6 py-2 bg-ifrn-green text-white rounded-xl hover:bg-ifrn-darkGreen transition-colors font-bold text-sm h-[42px] flex items-center gap-2 shadow-md shadow-green-100 disabled:opacity-50 disabled:shadow-none"
                    >
                        <Download size={18} /> Exportar PDF
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Filter size={18} className="text-ifrn-green" />
                        Resultados do Relatório
                        {filteredLoans.length > 0 ? (
                            <span className="ml-2 px-2 py-0.5 bg-ifrn-green/10 text-ifrn-green text-[10px] rounded-full uppercase font-black">{filteredLoans.length} registros</span>
                        ) : (
                            <span className="ml-2 px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] rounded-full uppercase font-black">Nenhum registro</span>
                        )}
                    </h3>
                </div>
                
                {filteredLoans.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 text-left">Data</th>
                                    <th className="px-6 py-3 text-left">Aluno/Pessoa</th>
                                    <th className="px-6 py-3 text-left">Livros</th>
                                    <th className="px-6 py-3 text-left">Status</th>
                                    <th className="px-6 py-3 text-left">Operador</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredLoans.map(loan => (
                                    <tr key={loan.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">{new Date(loan.loanDate).toLocaleDateString('pt-BR')}</span>
                                                <span className="text-[10px] text-gray-400">{new Date(loan.loanDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-900">{loan.personName}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{loan.personMatricula}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {loan.books.map(b => (
                                                    <div key={b.id} className={`flex flex-col text-[9px] px-2 py-1 rounded-lg border ${b.status === 'Devolvido' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 opacity-80' : 'bg-blue-50 text-blue-600 border-blue-100 font-black'}`}>
                                                        <span className="uppercase">{b.title}</span>
                                                        <div className="flex items-center gap-1 opacity-70">
                                                            <span className="text-[8px] font-bold tracking-tighter">{b.code || 'S/C'}</span>
                                                            {b.series && <span className="text-[7px]">|</span>}
                                                            <span className="text-[8px] font-medium italic">{b.series}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${loan.status === BookLoanStatus.RETURNED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                {loan.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-medium italic">
                                            {loan.loanedBy}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-4 text-gray-400 italic">
                            <div className="p-4 bg-gray-50 rounded-full">
                                <FileText size={40} strokeWidth={1} />
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-gray-500 not-italic">Nenhum registro encontrado</p>
                                <p className="text-sm">Ajuste os filtros acima para visualizar os dados.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-10 py-6 animate-scale-in">
            {/* Tab Header with Glassmorphism */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl p-2 border border-white/50 shadow-xl shadow-gray-200/50 flex flex-col md:flex-row items-center justify-between gap-2 overflow-hidden sticky top-20 z-10 transition-all">
                <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto no-scrollbar scroll-smooth">
                    <button 
                        onClick={() => setActiveView('general')}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeView === 'general' ? 'bg-ifrn-green text-white shadow-lg shadow-green-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                    >
                        <TrendingUp size={18} /> Visão Geral
                    </button>
                    <button 
                        onClick={() => setActiveView('detailed')}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeView === 'detailed' ? 'bg-ifrn-green text-white shadow-lg shadow-green-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                    >
                        <FileText size={18} /> Relatórios Detalhados
                    </button>
                </div>
                
                {/* Branding within the sticky header */}
                <div className="hidden lg:flex items-center gap-3 px-6 py-2 border-l border-gray-100">
                    <div className="text-right">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Módulo de Livros</p>
                        <p className="text-xs font-bold text-gray-600">Relatórios Estratégicos</p>
                    </div>
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 text-ifrn-green">
                        <BarChart3 size={20} />
                    </div>
                </div>
            </div>

            {/* Dynamic Content Rendering */}
            <main className="min-h-[600px]">
                {activeView === 'general' && renderGeneralView()}
                {activeView === 'detailed' && renderDetailedView()}
            </main>

            {/* Print/Export Floating Badge */}
            <div className="fixed bottom-8 right-8 z-50 animate-bounce cursor-pointer group">
                <div className="bg-ifrn-green text-white p-4 rounded-full shadow-2xl shadow-green-400 flex items-center gap-3 group-hover:scale-110 transition-transform">
                    <BarChart3 size={24} />
                    <span className="hidden group-hover:inline pr-2 font-black text-xs uppercase tracking-widest">Painel de Analytcs</span>
                </div>
            </div>
        </div>
    );
};
