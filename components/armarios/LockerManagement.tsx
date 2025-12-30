
import React, { useState, useMemo } from 'react';
import { Locker, LockerStatus } from '../../types-armarios';
import { Building2, Layers, Hash, Plus, AlertCircle } from 'lucide-react';

interface LockerManagementProps {
    onGenerate: (newLockers: Locker[]) => void;
    existingLockers: Locker[];
}

interface RegistrationRow {
    blockName: string;
    groupName: string;
    startNumber: number;
    endNumber: number;
}

const LockerManagement: React.FC<LockerManagementProps> = ({ onGenerate, existingLockers }) => {
    const [rows, setRows] = useState<RegistrationRow[]>([
        { blockName: '', groupName: '', startNumber: 1, endNumber: 40 }
    ]);

    const suggestBlocks = useMemo(() => {
        const blocks = new Set<string>();
        existingLockers.forEach(l => {
            if (l.location && l.location.includes(' - ')) {
                blocks.add(l.location.split(' - ')[0]);
            } else if (l.location) {
                blocks.add(l.location);
            }
        });
        return Array.from(blocks);
    }, [existingLockers]);

    const addRow = () => {
        const lastRow = rows[rows.length - 1];
        setRows([...rows, {
            blockName: lastRow.blockName,
            groupName: lastRow.groupName,
            startNumber: lastRow.endNumber + 1,
            endNumber: lastRow.endNumber + 40
        }]);
    };

    const removeRow = (index: number) => {
        if (rows.length > 1) {
            setRows(rows.filter((_, i) => i !== index));
        }
    };

    const updateRow = (index: number, field: keyof RegistrationRow, value: string | number) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [field]: value };
        setRows(newRows);
    };

    const handleGenerate = () => {
        const allNewLockers: Locker[] = [];

        for (const row of rows) {
            if (!row.blockName.trim() || !row.groupName.trim()) {
                alert('Por favor, preencha o Bloco e o Agrupamento em todas as linhas.');
                return;
            }

            if (row.startNumber > row.endNumber) {
                alert(`O número inicial não pode ser maior que o final (Bloco: ${row.blockName}).`);
                return;
            }

            const location = `${row.blockName} - ${row.groupName}`;

            for (let i = row.startNumber; i <= row.endNumber; i++) {
                const existing = existingLockers.find(l => l.number === i);

                if (existing) {
                    allNewLockers.push({
                        ...existing,
                        location: location
                    });
                } else {
                    allNewLockers.push({
                        number: i,
                        status: LockerStatus.AVAILABLE,
                        location: location,
                        loanHistory: [],
                        maintenanceHistory: []
                    });
                }
            }
        }

        const count = allNewLockers.length;
        if (confirm(`Deseja gerar/atualizar ${count} armários no total?`)) {
            onGenerate(allNewLockers);
            setRows([{ blockName: '', groupName: '', startNumber: 1, endNumber: 40 }]);
        }
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="bg-slate-800 p-8 text-white">
                    <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <Building2 className="text-green-400" /> Cadastro de Armários
                    </h3>
                    <p className="text-slate-400 text-sm mt-2 font-medium">Gere novos armários em lote ou atualize localizações existentes.</p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        {rows.map((row, index) => (
                            <div key={index} className="flex flex-wrap md:flex-nowrap items-end gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 transition-all hover:border-slate-200">
                                <div className="flex-1 min-w-[150px] space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Building2 size={10} /> Bloco
                                    </label>
                                    <input
                                        list="blocks-list"
                                        type="text"
                                        placeholder="Selecione ou digite..."
                                        value={row.blockName}
                                        onChange={(e) => updateRow(index, 'blockName', e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-800 transition-all"
                                    />
                                </div>

                                <div className="flex-1 min-w-[150px] space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Layers size={10} /> Agrupamento
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Parte 1"
                                        value={row.groupName}
                                        onChange={(e) => updateRow(index, 'groupName', e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-800 transition-all"
                                    />
                                </div>

                                <div className="w-24 space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Hash size={10} /> Inicial
                                    </label>
                                    <input
                                        type="number"
                                        value={row.startNumber}
                                        onChange={(e) => updateRow(index, 'startNumber', parseInt(e.target.value) || 0)}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-slate-800"
                                    />
                                </div>

                                <div className="w-24 space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Hash size={10} /> Final
                                    </label>
                                    <input
                                        type="number"
                                        value={row.endNumber}
                                        onChange={(e) => updateRow(index, 'endNumber', parseInt(e.target.value) || 0)}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-slate-800"
                                    />
                                </div>

                                {rows.length > 1 && (
                                    <button
                                        onClick={() => removeRow(index)}
                                        className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                        title="Remover linha"
                                    >
                                        <Plus size={20} className="rotate-45" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <datalist id="blocks-list">
                        {suggestBlocks.map(b => <option key={b} value={b} />)}
                    </datalist>

                    <div className="flex justify-center">
                        <button
                            onClick={addRow}
                            className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-all shadow-sm hover:shadow-md group"
                            title="Adicionar novo intervalo"
                        >
                            <Plus size={24} className="group-hover:scale-110 transition-transform" />
                        </button>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                        <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
                        <p className="text-blue-700 text-[11px] font-medium leading-relaxed">
                            <strong>Nota Importante:</strong> Se um armário dentro do intervalo já existir, apenas sua <strong>localização</strong> será atualizada. O status e o histórico de empréstimos serão preservados.
                        </p>
                    </div>

                    <button
                        onClick={handleGenerate}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-5 rounded-[1.5rem] shadow-xl transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                    >
                        <Plus size={18} /> Processar Todos os Armários
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LockerManagement;
