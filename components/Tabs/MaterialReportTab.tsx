import React, { useState, useMemo } from 'react';
import { MaterialLoan, Material } from '../../types-materiais';
import { Search, AlertCircle, CheckCircle, Hash, Calendar, User, FileText, TrendingUp } from 'lucide-react';

interface Props {
    loans: MaterialLoan[];
    materials: Material[];
}

export const MaterialReportTab: React.FC<Props> = ({ loans, materials }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'RETURNED'>('ALL');

    const stats = useMemo(() => {
        const active = loans.filter(l => l.status === 'ACTIVE').length;
        const returned = loans.filter(l => l.status === 'RETURNED').length;
        return { active, returned, total: loans.length };
    }, [loans]);

    const unreturnedMaterials = useMemo(() => {
        return loans.filter(l => l.status === 'ACTIVE');
    }, [loans]);

    const filteredLoans = useMemo(() => {
        let result = loans;

        if (filterStatus !== 'ALL') {
            result = result.filter(l => l.status === filterStatus);
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(l =>
                l.materialName.toLowerCase().includes(term) ||
                l.materialCode.toLowerCase().includes(term) ||
                l.personName.toLowerCase().includes(term) ||
                l.personMatricula.toLowerCase().includes(term)
            );
        }

        return result.sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime());
    }, [loans, searchTerm, filterStatus]);

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-amber-100 text-sm font-medium">Empréstimos Ativos</p>
                            <p className="text-4xl font-black mt-2">{stats.active}</p>
                        </div>
                        <div className="bg-white/20 p-3 rounded-lg">
                            <AlertCircle size={32} />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm font-medium">Devolvidos</p>
                            <p className="text-4xl font-black mt-2">{stats.returned}</p>
                        </div>
                        <div className="bg-white/20 p-3 rounded-lg">
                            <CheckCircle size={32} />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-indigo-100 text-sm font-medium">Total de Empréstimos</p>
                            <p className="text-4xl font-black mt-2">{stats.total}</p>
                        </div>
                        <div className="bg-white/20 p-3 rounded-lg">
                            <TrendingUp size={32} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Unreturned Materials Alert */}
            {unreturnedMaterials.length > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-amber-600 flex-shrink-0" size={24} />
                        <div>
                            <h3 className="font-bold text-amber-900">
                                {unreturnedMaterials.length} material(is) não devolvido(s)
                            </h3>
                            <p className="text-sm text-amber-700 mt-1">
                                Esses materiais ainda estão em uso e precisam ser devolvidos.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-96">
                    <input
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        placeholder="Pesquisar por material, código ou pessoa..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setFilterStatus('ALL')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'ALL'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setFilterStatus('ACTIVE')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'ACTIVE'
                                ? 'bg-amber-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Ativos
                    </button>
                    <button
                        onClick={() => setFilterStatus('RETURNED')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'RETURNED'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Devolvidos
                    </button>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FileText size={20} className="text-indigo-600" />
                        Histórico Completo de Empréstimos
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
                            <tr>
                                <th className="p-4 text-left whitespace-nowrap">Código</th>
                                <th className="p-4 text-left whitespace-nowrap">Material</th>
                                <th className="p-4 text-left whitespace-nowrap">Pessoa</th>
                                <th className="p-4 text-left whitespace-nowrap">Empréstimo</th>
                                <th className="p-4 text-left whitespace-nowrap">Devolução</th>
                                <th className="p-4 text-left whitespace-nowrap">Responsável</th>
                                <th className="p-4 text-left whitespace-nowrap">Obs</th>
                                <th className="p-4 text-left whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredLoans.map(loan => (
                                <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Hash size={14} className="text-indigo-500" />
                                            <span className="font-mono text-xs font-bold text-indigo-600">{loan.materialCode}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 font-bold text-gray-800 whitespace-nowrap">
                                        {loan.materialName}
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <User size={14} className="text-gray-400" />
                                            <div>
                                                <p className="text-gray-800 font-medium">{loan.personName}</p>
                                                <p className="text-xs text-gray-500">{loan.personMatricula}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1 text-gray-600">
                                            <Calendar size={14} className="text-gray-400" />
                                            <span className="text-xs">{new Date(loan.loanDate).toLocaleString('pt-BR')}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        {loan.returnDate ? (
                                            <div className="flex items-center gap-1 text-green-600">
                                                <Calendar size={14} className="text-green-500" />
                                                <span className="text-xs">{new Date(loan.returnDate).toLocaleString('pt-BR')}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-amber-600 font-medium">Pendente</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-xs text-gray-600 whitespace-nowrap">
                                        {loan.loanedBy}
                                    </td>
                                    <td className="p-4 max-w-[120px]">
                                        {loan.observation ? (
                                            <span className="text-xs text-gray-500 italic truncate block" title={loan.observation}>{loan.observation}</span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${loan.status === 'ACTIVE'
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'bg-green-100 text-green-800'
                                            }`}>
                                            {loan.status === 'RETURNED' && <CheckCircle size={10} />}
                                            {loan.status === 'ACTIVE' ? 'ATIVO' : 'DEVOLVIDO'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredLoans.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-gray-400 italic">
                                        Nenhum registro encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
