import React, { useState, useRef, useEffect } from 'react';
import { Locker, LoanData } from '../../types-armarios';
import { Person, BookLoan, BookLoanStatus, User, Campus, Setor, UserLevel } from '../../types';
import { MaterialLoan } from '../../types-materiais';
import { Search, ExternalLink, CheckCircle, AlertTriangle, User as UserIcon, BookOpen, Key, Info, History, Hash, Loader2 } from 'lucide-react';
import { StorageService } from '../../services/storage';

interface NadaConstaTabProps {
    lockers: Locker[];
    bookLoans: BookLoan[];
    materialLoans: MaterialLoan[];
    user: User;
    campuses: Campus[];
    setores: Setor[];
    adminGlobalCampusId?: string | null;
    adminGlobalSetorId?: string | null;
}

export const NadaConstaTab: React.FC<NadaConstaTabProps> = ({
    lockers,
    bookLoans,
    materialLoans,
    user,
    campuses,
    setores,
    adminGlobalCampusId,
    adminGlobalSetorId
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [selectedSetorId, setSelectedSetorId] = useState<string>(
        (user?.level === UserLevel.ADMIN ? adminGlobalSetorId : user?.setor_id) || ''
    );

    useEffect(() => {
        if (user?.level === UserLevel.ADMIN && adminGlobalSetorId !== undefined) {
            setSelectedSetorId(adminGlobalSetorId || '');
        }
    }, [adminGlobalSetorId, user?.level]);

    const isAdmin = user.level === UserLevel.ADMIN;
    const activeSetorId = isAdmin ? selectedSetorId : user.setor_id;

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [searchTerm]);

    const normalizeText = (text: string) => {
        return text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    };

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const rawSearch = searchTerm.trim();
        if (rawSearch.length === 0) {
            setSearchResults([]);
            setHasSearched(false);
            return;
        }
        if (rawSearch.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        setHasSearched(true);
        try {
            // Suporte para busca única ou em lote (vírgula)
            const searchGroups = rawSearch.includes(',')
                ? rawSearch.split(',').map(s => s.trim()).filter(s => s.length >= 2)
                : [rawSearch];

            const campusId = (user.level === UserLevel.ADMIN) ? (adminGlobalCampusId || undefined) : user.campus_id;
            let allResults: Person[] = [];

            // Buscar cada grupo no servidor de forma assíncrona (sem restrição por setor)
            const searchPromises = searchGroups.map(group =>
                StorageService.searchPeople(group, 50, campusId)
            );

            const promiseResults = await Promise.all(searchPromises);
            promiseResults.forEach(res => {
                allResults = [...allResults, ...res];
            });

            // Remover duplicados por ID (caso a busca retorne a mesma pessoa em grupos diferentes)
            const uniqueResults = Array.from(new Map(allResults.map(r => [r.matricula, r])).values());

            setSearchResults(uniqueResults.map(p => ({
                registration: p.matricula,
                name: p.name,
                course: '',
                situation: 'Matriculado',
                email: '',
                id: p.matricula,
                campus_id: p.campus_id
            })));
        } catch (error) {
            console.error("Erro ao realizar busca:", error);
            alert("Erro ao realizar busca. Tente novamente.");
        } finally {
            setIsSearching(false);
        }
    };

    // Suporte para apertar Enter no textarea (Shift+Enter para nova linha se necessário, mas aqui é busca)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSearch();
        }
    };

    const getStudentPendencies = (registration: string, studentId?: string, studentCampusId?: string) => {
        const activeLockerLoans: LoanData[] = [];
        const activeBookLoans: BookLoan[] = [];
        const activeMaterialLoans: MaterialLoan[] = [];

        // Check Lockers
        lockers.forEach(locker => {
            if (locker.currentLoan?.registrationNumber === registration) {
                activeLockerLoans.push(locker.currentLoan);
            }
            // Check for active reserve key loans in history
            (locker.loanHistory || []).forEach(loan => {
                if (loan.registrationNumber === registration && loan.loanType === 'reserve_key' && !loan.returnDate) {
                    activeLockerLoans.push({ ...loan, lockerNumber: locker.number });
                }
            });
        });

        // Check Books
        if (registration) {
            bookLoans.forEach(loan => {
                const hasActiveBooks = loan.books.some(b => b.status === 'Ativo' || !b.status);
                // Busca por Matrícula
                const isOwner = registration && loan.personMatricula === registration;
                
                if (isOwner && (loan.status === BookLoanStatus.ACTIVE || hasActiveBooks)) {
                    activeBookLoans.push(loan);
                }
            });

            // Check Materials
            materialLoans.forEach(loan => {
                if (loan.personMatricula === registration && loan.status === 'ACTIVE') {
                    activeMaterialLoans.push(loan);
                }
            });
        }

        return { activeLockerLoans, activeBookLoans, activeMaterialLoans };
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-24">
            <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl border border-slate-100 ring-1 ring-slate-200/50">
                <div className="flex items-center gap-4 mb-6">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-100">
                        <Search size={24} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Sistema de Nada Consta</h2>
                        <div className="flex items-center gap-3">
                            <p className="text-slate-500 font-medium italic">Verificação unificada de armários e livros PNLD</p>
                        </div>
                    </div>
                </div>

                <div className="relative group">
                    <textarea
                        ref={textareaRef}
                        placeholder="Ex: 202312345, 202398765 ou nomes..."
                        className="w-full bg-slate-50 border-4 border-slate-100 rounded-3xl p-6 pr-16 text-xl font-black text-slate-800 outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-300 min-h-[72px] overflow-hidden resize-none"
                        rows={1}
                        value={searchTerm}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSearchTerm(val);
                            if (val.trim() === '') {
                                setSearchResults([]);
                                setHasSearched(false);
                            }
                        }}
                        onKeyDown={handleKeyDown}
                    />

                    <button
                        onClick={() => handleSearch()}
                        disabled={isSearching || searchTerm.trim().length < 2}
                        className="absolute right-6 top-6 text-blue-600 hover:text-blue-700 disabled:text-slate-300 transition-all active:scale-90"
                        title="Consultar"
                    >
                        {isSearching ? <Loader2 size={32} className="animate-spin" /> : <Search size={32} />}
                    </button>
                </div>
                <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2 ml-4">
                    <Info size={12} /> Dica: Separe por vírgula para buscar vários alunos. Pressione <span className="text-blue-500 underline font-black">Enter</span> para pesquisar.
                    {isAdmin && activeSetorId && (
                        <span className="ml-auto text-amber-600 flex items-center gap-1">
                            <Info size={12} /> Setor: {setores.find(s => s.id === activeSetorId)?.name || '---'}
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                {searchResults.map(student => {
                    const { activeLockerLoans, activeBookLoans, activeMaterialLoans } = getStudentPendencies(student.registration, student.id, student.campus_id);

                    const realActiveBookLoans = activeBookLoans.filter(loan =>
                        loan.books.some(b => b.status === 'Ativo' || !b.status)
                    );

                    const hasPendency = activeLockerLoans.length > 0 || realActiveBookLoans.length > 0 || activeMaterialLoans.length > 0;

                    return (
                        <div key={student.registration} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg overflow-hidden animate-slide-up ring-1 ring-slate-200/50 transition-all hover:shadow-xl hover:translate-y-[-2px]">
                            <div className={`p-8 flex flex-col md:flex-row justify-between items-center gap-6 border-b ${hasPendency ? 'bg-red-50/50 border-red-100' : 'bg-green-50/30 border-green-100'}`}>
                                <div className="text-center md:text-left">
                                    <h3 className="text-2xl font-black text-slate-800 uppercase leading-tight">{student.name}</h3>
                                    <div className="flex flex-wrap justify-center md:justify-start items-center gap-x-6 gap-y-2 mt-2">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Info size={14} className="text-slate-300" />
                                            Matrícula: <span className="text-slate-600">{student.registration}</span>
                                        </span>
                                        {user.level === UserLevel.ADMIN && student.campus_id && (
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Info size={14} className="text-slate-300" />
                                                Câmpus: <span className="text-slate-600">{campuses.find(c => c.id === student.campus_id)?.name || '---'}</span>
                                            </span>
                                        )}
                                        {activeSetorId && (
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Info size={14} className="text-slate-300" />
                                                Setor: <span className="text-slate-600">{setores.find(s => s.id === activeSetorId)?.name || '---'}</span>
                                            </span>
                                        )}
                                        <a
                                            href={`https://suap.ifrn.edu.br/edu/aluno/${student.registration}/?tab=nada_consta`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-100 shadow-sm"
                                        >
                                            <ExternalLink size={12} />
                                            Consultar SUAP
                                        </a>
                                    </div>
                                </div>

                                <div className={`px-10 py-5 rounded-[1.5rem] border-4 flex flex-col items-center justify-center min-w-[260px] transition-all transform hover:scale-105 ${hasPendency ? 'bg-red-600 border-red-100 text-white shadow-xl shadow-red-200' : 'bg-emerald-600 border-emerald-100 text-white shadow-xl shadow-emerald-200'}`}>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">Declaração Escolar</span>
                                    <div className="flex items-center gap-2">
                                        {hasPendency ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
                                        <span className="text-2xl font-black tracking-tight">{hasPendency ? 'PENDÊNCIA' : 'NADA CONSTA'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
                                {/* Armários Section */}
                                <div>
                                    <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                                        <Key size={14} /> Situação de Armários
                                    </h4>
                                    <div className="space-y-4">
                                        {activeLockerLoans.length > 0 ? (
                                            activeLockerLoans.map(loan => {
                                                const isReserve = loan.loanType === 'reserve_key';
                                                return (
                                                <div key={loan.id} className={`p-6 rounded-[2rem] flex items-center justify-between shadow-sm border-l-8 ${isReserve ? 'bg-amber-50 border-amber-200 border-l-amber-500' : 'bg-red-50 border-red-200 border-l-red-500'}`}>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className={`text-xs font-black uppercase tracking-tight ${isReserve ? 'text-amber-600' : 'text-red-600'}`}>Armário #{loan.lockerNumber}</p>
                                                            {isReserve && (
                                                                <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-[8px] font-black uppercase">Chave Reserva</span>
                                                            )}
                                                        </div>
                                                        <p className={`text-[10px] font-bold uppercase mt-1.5 flex items-center gap-1.5 ${isReserve ? 'text-amber-400' : 'text-red-400'}`}><History size={10} />Retirado em: {loan.loanDate}</p>
                                                    </div>
                                                    <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-sm ${isReserve ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}`}>{isReserve ? 'Chave Reserva' : 'Ocupado'}</div>
                                                </div>
                                                );
                                            })
                                        ) : (
                                            <div className="p-8 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 transition-colors hover:bg-slate-100/50">
                                                <Key size={32} className="opacity-20 mb-3" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sem pendências</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Livros Section */}
                                <div>
                                    <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                                        <BookOpen size={14} /> Situação de Livros (PNLD)
                                    </h4>
                                    <div className="space-y-4">
                                        {realActiveBookLoans.length > 0 ? (
                                            realActiveBookLoans.map(loan => {
                                                const pendingBooks = loan.books.filter(b => b.status === 'Ativo' || !b.status);
                                                return (
                                                    <div key={loan.id} className="p-6 bg-orange-50 border border-orange-200 rounded-[2rem] shadow-sm border-l-8 border-l-orange-500">
                                                        <div className="flex justify-between items-start mb-5">
                                                            <p className="text-xs font-black text-orange-700 uppercase tracking-tight">Pendente: {pendingBooks.length} de {loan.books.length} Livro(s)</p>
                                                            <div className="bg-orange-500 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-sm shadow-orange-100">Pendente</div>
                                                        </div>
                                                        <div className="flex flex-col gap-3">
                                                            {loan.books.map(b => (
                                                                <div key={b.id} className={`flex flex-col p-4 rounded-2xl border text-[10px] ${b.status === 'Devolvido' ? 'bg-green-50 text-green-600 border-green-100 opacity-50' : 'bg-white/90 border-orange-100 text-orange-900 shadow-sm'}`}>
                                                                    <div className="flex items-center justify-between font-black uppercase tracking-tighter">
                                                                        <span>{b.title}</span>
                                                                        {b.status === 'Devolvido' && <CheckCircle size={12} />}
                                                                    </div>
                                                                    <div className="text-[9px] text-slate-400 mt-1.5 font-bold">
                                                                        CÓD: <span className="text-slate-600 font-black">{b.code || '---'}</span> • SÉRIE: <span className="text-slate-600 font-black">{b.series || '---'}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[9px] text-orange-400 font-bold uppercase mt-5 flex items-center gap-1.5">
                                                            <History size={10} /> Iniciado em: {new Date(loan.loanDate).toLocaleDateString('pt-BR')}
                                                        </p>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="p-8 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 transition-colors hover:bg-slate-100/50">
                                                <BookOpen size={32} className="opacity-20 mb-3" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sem pendências</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Materiais Section */}
                                <div>
                                    <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                                        <Hash size={14} /> Situação de Materiais
                                    </h4>
                                    <div className="space-y-4">
                                        {activeMaterialLoans.length > 0 ? (
                                            <div className="p-6 bg-amber-50 border border-amber-200 rounded-[2rem] shadow-sm border-l-8 border-l-amber-500">
                                                <div className="flex justify-between items-start mb-5">
                                                    <p className="text-xs font-black text-amber-700 uppercase tracking-tight">Pendente: {activeMaterialLoans.length} Item(ns)</p>
                                                    <div className="bg-amber-500 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-sm shadow-amber-100">Pendente</div>
                                                </div>
                                                <div className="flex flex-col gap-3">
                                                    {activeMaterialLoans.map(loan => (
                                                        <div key={loan.id} className="flex flex-col p-4 rounded-2xl border border-amber-100 bg-white/90 text-amber-900 shadow-sm text-[10px]">
                                                            <div className="flex items-center justify-between font-black uppercase tracking-tighter">
                                                                <span>{loan.materialName}</span>
                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 rotate-45" />
                                                            </div>
                                                            <div className="text-[9px] text-slate-400 mt-1.5 font-bold flex justify-between items-center">
                                                                <span>CÓD: <span className="text-slate-600 font-black">#{loan.materialCode}</span></span>
                                                                <span className="text-amber-500 uppercase flex items-center gap-1 font-black">
                                                                    <History size={10} /> {new Date(loan.loanDate).toLocaleDateString('pt-BR')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-8 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 transition-colors hover:bg-slate-100/50">
                                                <Hash size={32} className="opacity-20 mb-3" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sem pendências</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {searchTerm.length >= 2 && isSearching && (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border-4 border-dashed border-slate-100">
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Loader2 size={36} className="text-blue-400 animate-spin" />
                        </div>
                        <p className="text-slate-400 font-black uppercase tracking-[0.2em]">Buscando aluno...</p>
                        <p className="text-slate-300 text-xs font-bold mt-2">Aguarde um momento.</p>
                    </div>
                )}

                {searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && hasSearched && (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border-4 border-dashed border-slate-100">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <UserIcon size={40} className="text-slate-200" />
                        </div>
                        <p className="text-slate-400 font-black uppercase tracking-[0.2em]">Nenhum aluno encontrado</p>
                        <p className="text-slate-300 text-xs font-bold mt-2">Verifique se a matrícula ou nome estão corretos.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
