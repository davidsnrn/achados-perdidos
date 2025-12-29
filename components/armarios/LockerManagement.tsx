
import React, { useState } from 'react';
import { Locker, LockerStatus } from '../../types-armarios';
import { Building2, Layers, Hash, Plus, AlertCircle, Save } from 'lucide-react';

interface LockerManagementProps {
    onGenerate: (newLockers: Locker[]) => void;
    existingLockers: Locker[];
}

const LockerManagement: React.FC<LockerManagementProps> = ({ onGenerate, existingLockers }) => {
    const [blockName, setBlockName] = useState('');
    const [groupName, setGroupName] = useState('');
    const [startNumber, setStartNumber] = useState(1);
    const [endNumber, setEndNumber] = useState(40);

    const handleGenerate = () => {
        if (!blockName.trim() || !groupName.trim()) {
            alert('Por favor, preencha o Bloco e o Agrupamento.');
            return;
        }

        if (startNumber > endNumber) {
            alert('O número inicial não pode ser maior que o final.');
            return;
        }

        const newLockers: Locker[] = [];
        const location = `${blockName} - ${groupName}`;

        for (let i = startNumber; i <= endNumber; i++) {
            const existing = existingLockers.find(l => l.number === i);

            if (existing) {
                // Se já existe, mantemos o status e o histórico, mas atualizamos a localização
                newLockers.push({
                    ...existing,
                    location: location
                });
            } else {
                // Novo armário
                newLockers.push({
                    number: i,
                    status: LockerStatus.AVAILABLE,
                    location: location,
                    loanHistory: [],
                    maintenanceHistory: []
                });
            }
        }

        const count = newLockers.length;
        if (confirm(`Deseja gerar/atualizar ${count} armários no intervalo ${startNumber} a ${endNumber}?`)) {
            onGenerate(newLockers);
            setBlockName('');
            setGroupName('');
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="bg-slate-800 p-8 text-white">
                    <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <Building2 className="text-green-400" /> Cadastro de Armários
                    </h3>
                    <p className="text-slate-400 text-sm mt-2 font-medium">Gere novos armários em lote ou atualize localizações existentes.</p>
                </div>

                <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Building2 size={12} /> Bloco / Prédio
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: Bloco Principal"
                                value={blockName}
                                onChange={(e) => setBlockName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-800 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Layers size={12} /> Agrupamento / Parte
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: Parte 1"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-800 transition-all"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Hash size={12} /> Intervalo de Numeração
                        </h4>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Número Inicial</label>
                                <input
                                    type="number"
                                    value={startNumber}
                                    onChange={(e) => setStartNumber(parseInt(e.target.value) || 0)}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-slate-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Número Final</label>
                                <input
                                    type="number"
                                    value={endNumber}
                                    onChange={(e) => setEndNumber(parseInt(e.target.value) || 0)}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                        <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
                        <p className="text-blue-700 text-xs font-medium leading-relaxed">
                            <strong>Nota Importante:</strong> Se um armário dentro do intervalo já existir, apenas sua <strong>localização</strong> será atualizada. O status e o histórico de empréstimos serão preservados.
                        </p>
                    </div>

                    <button
                        onClick={handleGenerate}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-5 rounded-[1.5rem] shadow-xl transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                    >
                        <Plus size={18} /> Gerar Armários Automaticamente
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LockerManagement;
