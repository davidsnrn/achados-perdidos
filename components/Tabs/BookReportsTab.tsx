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

type ReportView = 'general' | 'period' | 'person';
type BookDisplayStyle = 'table' | 'cards';

export const BookReportsTab: React.FC<Props> = ({ books, loans, user, campuses, adminGlobalCampusId }) => {
    const [activeView, setActiveView] = useState<ReportView>('general');
    const [bookStyle, setBookStyle] = useState<BookDisplayStyle>('table');
    
    // Period Filter State
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    
    // Person Filter State
    const [personSearch, setPersonSearch] = useState<string>('');
    
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
        
        const uniqueBorrowers = new Set(loans.map(l => l.personId)).size;
        
        return {
            totalBooks,
            activeLoansCount,
            totalLentBooks,
            availableBooks: totalBooks - totalLentBooks,
            uniqueBorrowers
        };
    }, [books, loans]);

    // Period Filtered Loans
    const periodLoans = useMemo(() => {
        if (!startDate && !endDate) return [];
        
        return loans.filter(l => {
            const loanDate = new Date(l.loanDate);
            const start = startDate ? new Date(startDate) : new Date(0);
            const end = endDate ? new Date(endDate) : new Date();
            // Ajustar o fim do dia para a data final
            if (endDate) end.setHours(23, 59, 59, 999);
            
            return loanDate >= start && loanDate <= end;
        });
    }, [loans, startDate, endDate]);

    // Person Filtered Loans
    const personLoans = useMemo(() => {
        if (!personSearch.trim()) return [];
        const terms = personSearch.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        
        return loans.filter(l => {
            const name = l.personName.toLowerCase();
            const matricula = l.personMatricula?.toLowerCase() || '';
            
            // All terms must be found in either name or matricula
            return terms.every(term => 
                name.includes(term) || matricula.includes(term)
            );
        });
    }, [loans, personSearch]);

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

    const renderPeriodView = () => (
        <div className="space-y-6 animate-fade-in-up">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row items-end gap-4">
                    <div className="flex-1 w-full">
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
                    <div className="flex-1 w-full">
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
                    <button 
                        onClick={() => { setStartDate(''); setEndDate(''); }}
                        className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-bold text-sm h-[40px]"
                    >
                        Limpar
                    </button>
                    <button 
                        className="px-6 py-2 bg-ifrn-green text-white rounded-xl hover:bg-ifrn-darkGreen transition-colors font-bold text-sm h-[40px] flex items-center gap-2"
                        disabled={periodLoans.length === 0}
                    >
                        <Download size={18} /> Exportar
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Filter size={18} className="text-ifrn-green" />
                        Resultados do Período
                        {periodLoans.length > 0 && <span className="ml-2 px-2 py-0.5 bg-ifrn-green/10 text-ifrn-green text-[10px] rounded-full uppercase font-black">{periodLoans.length} registros</span>}
                    </h3>
                </div>
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
                            {periodLoans.map(loan => (
                                <tr key={loan.id} className="hover:bg-gray-50/80 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800">{new Date(loan.loanDate).toLocaleDateString('pt-BR')}</span>
                                            <span className="text-[10px] text-gray-400">{new Date(loan.loanDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-gray-800">{loan.personName}</p>
                                        <p className="text-[10px] text-gray-400 uppercase font-bold">{loan.personMatricula}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {loan.books.map(b => (
                                                <div key={b.id} className={`flex flex-col text-[9px] px-2 py-1 rounded-lg border ${b.status === 'Devolvido' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                    <span className="font-black uppercase">{b.title}</span>
                                                    {b.series && <span className="text-[8px] opacity-70 font-bold italic">{b.series}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${loan.status === BookLoanStatus.RETURNED ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {loan.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                        {loan.loanedBy}
                                    </td>
                                </tr>
                            ))}
                            {!startDate && !endDate && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3 text-gray-400 italic">
                                            <Calendar size={32} strokeWidth={1} />
                                            <p>Selecione um intervalo de datas para gerar o relatório.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {(startDate || endDate) && periodLoans.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                                        Nenhum empréstimo encontrado para este período.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderPersonView = () => (
        <div className="space-y-6 animate-fade-in-up">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Pesquisar por Nome ou Matrícula..."
                        value={personSearch}
                        onChange={e => setPersonSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-ifrn-green/20 outline-none shadow-inner"
                    />
                </div>
                {personLoans.length > 0 && (
                    <button className="px-6 py-3 bg-ifrn-green text-white rounded-2xl hover:bg-ifrn-darkGreen transition-colors font-bold text-sm shadow-md flex items-center gap-2">
                        <Download size={18} /> Histórico PDF
                    </button>
                )}
            </div>

            {personLoans.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 uppercase tracking-wide text-xs">
                                <TrendingUp size={16} className="text-ifrn-green" />
                                Histórico de Empréstimos
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {personLoans.map(loan => (
                                <div key={loan.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className={`p-2 rounded-xl border ${loan.status === BookLoanStatus.ACTIVE ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                <Calendar size={20} />
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-900">{new Date(loan.loanDate).toLocaleDateString('pt-BR')}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase leading-none mt-0.5">{loan.personName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Operador</p>
                                                <p className="text-xs font-bold text-gray-700">{loan.loanedBy}</p>
                                            </div>
                                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${loan.status === BookLoanStatus.ACTIVE ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                                {loan.status}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {loan.books.map(book => (
                                            <div key={book.id} className={`flex items-center gap-3 p-3 rounded-xl border ${book.status === 'Devolvido' ? 'bg-emerald-50/30 border-emerald-100 opacity-60' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                <BookIcon size={16} className={book.status === 'Devolvido' ? 'text-emerald-500' : 'text-ifrn-green'} />
                                                <div className="min-w-0 flex-1">
                                                    <p className={`font-bold text-xs truncate ${book.status === 'Devolvido' ? 'text-emerald-700' : 'text-gray-900'}`}>{book.title}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{book.code || 'S/C'}</span>
                                                        {book.series && <span className="text-[9px] text-gray-300">•</span>}
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{book.series}</span>
                                                    </div>
                                                </div>
                                                {book.status === 'Devolvido' && <CheckCircle size={14} className="text-emerald-500 shrink-0" />}
                                            </div>
                                        ))}
                                    </div>
                                    {loan.observation && (
                                        <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 flex gap-3 italic text-gray-500 text-xs">
                                            <AlertCircle size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                            <p><span className="font-bold not-italic text-gray-400 mr-1">Observação:</span> “{loan.observation}”</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-20 rounded-2xl border border-dashed border-gray-200 text-center space-y-4">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserIcon size={40} className="text-gray-300" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-bold text-gray-800">Selecione uma Pessoa</h4>
                        <p className="text-sm text-gray-400 max-w-sm mx-auto">Pesquise por nome ou matrícula para visualizar todo o histórico de empréstimos individuais.</p>
                    </div>
                </div>
            )}
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
                        onClick={() => setActiveView('period')}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeView === 'period' ? 'bg-ifrn-green text-white shadow-lg shadow-green-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                    >
                        <Calendar size={18} /> Por Período
                    </button>
                    <button 
                        onClick={() => setActiveView('person')}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeView === 'person' ? 'bg-ifrn-green text-white shadow-lg shadow-green-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                    >
                        <UserIcon size={18} /> Por Pessoa
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
                {activeView === 'period' && renderPeriodView()}
                {activeView === 'person' && renderPersonView()}
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
