import React, { useState, useMemo } from 'react';
import { MaterialLoan, Material } from '../../types-materiais';
import { Person, User } from '../../types';
import { StorageService } from '../../services/storage';
import { Search, Plus, CheckCircle, Hash, User as UserIcon, Calendar, FileText, CornerUpRight, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
    loans: MaterialLoan[];
    materials: Material[];
    people: Person[];
    onUpdate: () => void;
    user: User;
}

export const MaterialLoansTab: React.FC<Props> = ({ loans, materials, people, onUpdate, user }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showLoanForm, setShowLoanForm] = useState(false);
    const [viewingLoan, setViewingLoan] = useState<MaterialLoan | null>(null);

    // Form state
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [personSearch, setPersonSearch] = useState('');
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
    const [observation, setObservation] = useState('');

    const filteredLoans = useMemo(() => {
        if (!searchTerm.trim()) return loans;
        const term = searchTerm.toLowerCase();
        return loans.filter(l =>
            l.materialName.toLowerCase().includes(term) ||
            l.materialCode.toLowerCase().includes(term) ||
            l.personName.toLowerCase().includes(term) ||
            l.personMatricula.toLowerCase().includes(term)
        );
    }, [loans, searchTerm]);

    const filteredPeople = useMemo(() => {
        if (!personSearch.trim()) return [];
        const term = personSearch.toLowerCase();
        return people.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.matricula.toLowerCase().includes(term)
        ).slice(0, 5);
    }, [people, personSearch]);

    const openLoanForm = () => {
        setSelectedPerson(null);
        setPersonSearch('');
        setSelectedMaterial(null);
        setObservation('');
        setShowLoanForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedPerson) {
            alert('Selecione uma pessoa.');
            return;
        }

        if (!selectedMaterial) {
            alert('Selecione um material.');
            return;
        }

        // Check if material is already loaned out
        const activeLoan = loans.find(
            l => l.materialId === selectedMaterial.id && l.status === 'ACTIVE'
        );

        if (activeLoan) {
            alert(`Este material já está emprestado para ${activeLoan.personName}.`);
            return;
        }

        const loan: MaterialLoan = {
            id: Math.random().toString(36).substr(2, 9),
            materialId: selectedMaterial.id,
            materialName: selectedMaterial.name,
            materialCode: selectedMaterial.code,
            personId: selectedPerson.id,
            personName: selectedPerson.name,
            personMatricula: selectedPerson.matricula,
            loanDate: new Date().toISOString(),
            observation: observation.trim() || undefined,
            status: 'ACTIVE',
            loanedBy: `${user.name} (${user.matricula})`
        };

        try {
            await StorageService.saveMaterialLoan(loan);
            onUpdate();
            setShowLoanForm(false);
            alert('Empréstimo registrado com sucesso!');
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
            alert('Material devolvido com sucesso!');
        } catch (error) {
            alert('Erro ao processar devolução.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
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

                <button
                    onClick={openLoanForm}
                    className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={20} /> Novo Empréstimo
                </button>
            </div>

            {/* Loans Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs">
                            <tr>
                                <th className="p-4 whitespace-nowrap">Código</th>
                                <th className="p-4 whitespace-nowrap">Material</th>
                                <th className="p-4 whitespace-nowrap">Pessoa</th>
                                <th className="p-4 whitespace-nowrap">Data</th>
                                <th className="p-4 whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredLoans.map(loan => (
                                <tr
                                    key={loan.id}
                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={() => setViewingLoan(loan)}
                                >
                                    <td className="p-4 font-mono text-xs text-indigo-600 font-bold whitespace-nowrap">
                                        {loan.materialCode}
                                    </td>
                                    <td className="p-4 font-bold text-gray-800 whitespace-nowrap">
                                        {loan.materialName}
                                    </td>
                                    <td className="p-4 text-gray-600 whitespace-nowrap">
                                        {loan.personName}
                                    </td>
                                    <td className="p-4 text-gray-500 whitespace-nowrap">
                                        {new Date(loan.loanDate).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${loan.status === 'ACTIVE'
                                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                            : 'bg-green-100 text-green-800 border border-green-200 shadow-sm'
                                            }`}>
                                            {loan.status === 'RETURNED' && <CheckCircle size={12} />}
                                            {loan.status === 'ACTIVE' ? 'ATIVO' : 'DEVOLVIDO'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredLoans.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-400 italic">
                                        Nenhum empréstimo encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Loan Form Modal */}
            <Modal isOpen={showLoanForm} onClose={() => setShowLoanForm(false)} title="Novo Empréstimo de Material">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Person Selection */}
                    <div className="relative space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                            Quem está emprestando?
                        </label>

                        {selectedPerson ? (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-4">
                                <div className="bg-indigo-100 p-2.5 rounded-full text-indigo-700">
                                    <UserIcon size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-indigo-900 truncate">{selectedPerson.name}</p>
                                    <p className="text-xs text-indigo-700 truncate">
                                        {selectedPerson.matricula} • {selectedPerson.type}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPerson(null)}
                                    className="text-xs text-red-500 hover:text-red-700 font-bold uppercase underline"
                                >
                                    Alterar
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full border-2 border-gray-100 rounded-xl p-3 pl-10 text-sm outline-none focus:border-indigo-500 transition-all"
                                    placeholder="Busque por Nome ou Matrícula..."
                                    value={personSearch}
                                    onChange={e => setPersonSearch(e.target.value)}
                                />
                                <Search className="absolute left-3 top-3.5 text-gray-300" size={18} />

                                {filteredPeople.length > 0 && (
                                    <div className="absolute z-10 w-full mt-2 bg-white border rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-gray-50">
                                        {filteredPeople.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => { setSelectedPerson(p); setPersonSearch(''); }}
                                                className="p-4 hover:bg-indigo-50 cursor-pointer text-sm group transition-colors"
                                            >
                                                <div className="font-bold text-gray-800 group-hover:text-indigo-700">
                                                    {p.name}
                                                </div>
                                                <div className="text-xs text-gray-500">{p.matricula} • {p.type}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Material Selection */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                            Material
                        </label>
                        <select
                            required
                            value={selectedMaterial?.id || ''}
                            onChange={e => {
                                const mat = materials.find(m => m.id === e.target.value);
                                setSelectedMaterial(mat || null);
                            }}
                            className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 transition-all"
                        >
                            <option value="">Selecione um material...</option>
                            {materials.map(m => {
                                const isActive = loans.some(l => l.materialId === m.id && l.status === 'ACTIVE');
                                return (
                                    <option key={m.id} value={m.id} disabled={isActive}>
                                        {m.code} - {m.name} {isActive ? '(Em uso)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Observation */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                            Observação (Opcional)
                        </label>
                        <textarea
                            value={observation}
                            onChange={e => setObservation(e.target.value)}
                            className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 transition-all"
                            rows={3}
                            placeholder="Adicione uma observação se necessário..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={() => setShowLoanForm(false)}
                            className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                        >
                            <Hash size={18} /> Registrar Empréstimo
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Loan Details Modal */}
            <Modal isOpen={!!viewingLoan} onClose={() => setViewingLoan(null)} title="Detalhes do Empréstimo">
                {viewingLoan && (
                    <div className="space-y-6">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Hash size={20} className="text-indigo-600" />
                                <span className="text-sm font-bold text-indigo-700 uppercase">Código de Rastreamento</span>
                            </div>
                            <p className="text-2xl font-mono font-black text-indigo-900">{viewingLoan.materialCode}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="col-span-2">
                                <span className="block text-gray-500 text-xs uppercase font-bold tracking-wider">
                                    Material
                                </span>
                                <span className="font-bold text-xl text-gray-900 leading-tight">
                                    {viewingLoan.materialName}
                                </span>
                            </div>

                            <div>
                                <span className="block text-gray-500 text-xs uppercase font-bold tracking-wider">
                                    Pessoa
                                </span>
                                <p className="font-bold text-gray-800">{viewingLoan.personName}</p>
                                <p className="text-xs text-gray-500">{viewingLoan.personMatricula}</p>
                            </div>

                            <div>
                                <span className="block text-gray-500 text-xs uppercase font-bold tracking-wider">
                                    Status
                                </span>
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1 shadow-sm ${viewingLoan.status === 'ACTIVE'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-green-100 text-green-800'
                                    }`}>
                                    {viewingLoan.status === 'ACTIVE' ? 'ATIVO' : 'DEVOLVIDO'}
                                </span>
                            </div>

                            <div className="col-span-2 grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase font-bold tracking-wider">
                                        Data do Empréstimo
                                    </span>
                                    <p className="text-sm text-gray-800 font-medium flex items-center gap-2 mt-1">
                                        <Calendar size={16} className="text-gray-400" />
                                        {new Date(viewingLoan.loanDate).toLocaleString('pt-BR')}
                                    </p>
                                </div>

                                {viewingLoan.returnDate && (
                                    <div>
                                        <span className="block text-gray-500 text-xs uppercase font-bold tracking-wider">
                                            Data da Devolução
                                        </span>
                                        <p className="text-sm text-gray-800 font-medium flex items-center gap-2 mt-1">
                                            <Calendar size={16} className="text-gray-400" />
                                            {new Date(viewingLoan.returnDate).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {viewingLoan.observation && (
                                <div className="col-span-2">
                                    <span className="block text-gray-500 text-xs uppercase font-bold tracking-wider">
                                        Observação
                                    </span>
                                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mt-1 flex items-start gap-2">
                                        <FileText size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                        {viewingLoan.observation}
                                    </p>
                                </div>
                            )}

                            <div className="col-span-2">
                                <span className="block text-gray-500 text-xs uppercase font-bold tracking-wider">
                                    Emprestado por
                                </span>
                                <p className="text-sm text-gray-600 mt-1">{viewingLoan.loanedBy}</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button
                                onClick={() => setViewingLoan(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                            >
                                Fechar
                            </button>

                            {viewingLoan.status === 'ACTIVE' && (
                                <button
                                    onClick={() => handleReturn(viewingLoan)}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold flex items-center gap-2"
                                >
                                    <CornerUpRight size={18} /> Marcar como Devolvido
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
