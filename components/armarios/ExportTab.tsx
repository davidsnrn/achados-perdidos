import React, { useMemo, useState } from 'react';
import { Locker, LockerStatus } from '../../types-armarios';
import { Trash2, Download, FileSpreadsheet, Info, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { exportBorrowedLockersToExcel } from '../../utils/exportArmariosExcel';

interface ExportTabProps {
    lockers: Locker[];
    onClearAll: () => Promise<void>;
}

interface ExportEntry {
    lockerNumber: string;
    registration: string;
    studentName: string;
    studentClass: string;
    actionType: 'Empréstimo' | 'Devolução';
    actionDate: string;
}

const ExportTab: React.FC<ExportTabProps> = ({ lockers, onClearAll }) => {
    const [isClearing, setIsClearing] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    const borrowedLockersCount = useMemo(() => {
        return lockers.filter(l => l.status === LockerStatus.OCCUPIED || l.currentLoan).length;
    }, [lockers]);

    const handleExportExcel = async () => {
        setIsExportingExcel(true);
        try {
            await exportBorrowedLockersToExcel(lockers);
        } catch (e: any) {
            alert('Erro ao exportar planilha Excel: ' + (e.message || 'Erro desconhecido'));
        } finally {
            setIsExportingExcel(false);
        }
    };

    const exportData = useMemo(() => {
        const entries: ExportEntry[] = [];

        lockers.forEach(locker => {
            // Empréstimo Atual (Se existir)
            if (locker.currentLoan) {
                entries.push({
                    lockerNumber: locker.number,
                    registration: locker.currentLoan.registrationNumber,
                    studentName: locker.currentLoan.studentName,
                    studentClass: locker.currentLoan.studentClass,
                    actionType: 'Empréstimo',
                    actionDate: locker.currentLoan.loanDate
                });
            }

            // Histórico
            locker.loanHistory.forEach(loan => {
                // Registro do Empréstimo
                entries.push({
                    lockerNumber: locker.number,
                    registration: loan.registrationNumber,
                    studentName: loan.studentName,
                    studentClass: loan.studentClass,
                    actionType: 'Empréstimo',
                    actionDate: loan.loanDate
                });

                // Registro da Devolução (Se devolvido)
                if (loan.returnDate) {
                    entries.push({
                        lockerNumber: locker.number,
                        registration: loan.registrationNumber,
                        studentName: loan.studentName,
                        studentClass: loan.studentClass,
                        actionType: 'Devolução',
                        actionDate: loan.returnDate
                    });
                }
            });
        });

        // Ordenar por data (mais recente primeiro)
        return entries.sort((a, b) => {
            const [da, ma, ya] = a.actionDate.split('/');
            const [db, mb, yb] = b.actionDate.split('/');
            const dateA = new Date(parseInt(ya), parseInt(ma) - 1, parseInt(da)).getTime();
            const dateB = new Date(parseInt(yb), parseInt(mb) - 1, parseInt(db)).getTime();
            return dateB - dateA;
        });
    }, [lockers]);

    const handleDownloadCSV = () => {
        if (exportData.length === 0) return;

        // Cabeçalhos do CSV
        const headers = ["Número do Armário", "Matrícula", "Nome do Aluno", "Turma", "Tipo de Ação", "Data"];

        // Conteúdo formatado
        const csvRows = exportData.map(entry => [
            entry.lockerNumber,
            entry.registration,
            `"${entry.studentName.replace(/"/g, '""')}"`, // Escapar aspas em nomes
            `"${entry.studentClass.replace(/"/g, '""')}"`,
            entry.actionType,
            entry.actionDate
        ].join(';')); // Usamos ponto e vírgula para compatibilidade com Excel em PT-BR

        const csvContent = "\uFEFF" + [headers.join(';'), ...csvRows].join('\n'); // Adicionamos BOM para acentuação correta no Excel

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `historico_armarios_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Cartão Destaque: Exportação em Excel de Armários Emprestados */}
            <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-800 p-8 md:p-10 rounded-[2.5rem] shadow-2xl text-white border border-emerald-500/20 relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 opacity-10 text-emerald-300 pointer-events-none">
                    <FileSpreadsheet size={280} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-3 max-w-xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black uppercase tracking-widest">
                            <FileSpreadsheet size={14} /> Planilha Excel (.xlsx)
                        </div>
                        <h2 className="text-3xl font-black tracking-tight text-white">
                            Armários Emprestados
                        </h2>
                        <p className="text-emerald-100/80 text-sm font-medium leading-relaxed">
                            Exporte apenas a lista atual de armários que estão sob empréstimo contendo <strong>Número do Armário</strong>, <strong>Matrícula</strong>, <strong>Nome</strong> e <strong>E-mail</strong>.
                        </p>
                        <div className="flex items-center gap-3 pt-2">
                            <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 px-3.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <CheckCircle2 size={14} className="text-emerald-400" />
                                {borrowedLockersCount} armários emprestados no momento
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleExportExcel}
                        disabled={isExportingExcel || borrowedLockersCount === 0}
                        className="w-full md:w-auto flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-black px-8 py-5 rounded-[1.8rem] shadow-xl shadow-emerald-500/20 transition-all transform hover:scale-105 active:scale-95 uppercase text-xs tracking-widest shrink-0"
                    >
                        {isExportingExcel ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Exportando Excel...
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet size={20} />
                                Exportar Excel (.xlsx)
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Cartão de Histórico Geral e Limpeza de Banco */}
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Histórico Geral (CSV)</h2>
                        <p className="text-slate-500 font-medium">Extraia o histórico completo de movimentações (empréstimos e devoluções).</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            onClick={() => setShowConfirm(true)}
                            className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 px-6 py-4 rounded-3xl font-black hover:bg-red-100 transition-all uppercase text-xs tracking-widest"
                        >
                            <Trash2 size={18} />
                            Limpar Banco de Dados
                        </button>
                        <button
                            onClick={handleDownloadCSV}
                            disabled={exportData.length === 0}
                            className="flex items-center gap-3 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 text-white px-8 py-4 rounded-3xl font-black shadow-xl transition-all transform hover:scale-105 active:scale-95 uppercase text-sm tracking-widest"
                        >
                            <Download size={20} />
                            Baixar Histórico (CSV)
                        </button>
                    </div>
                </div>

                {/* Modal de Confirmação para Limpeza */}
                {showConfirm && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10 border border-slate-100 text-center space-y-6">
                            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
                                <AlertTriangle size={40} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-slate-800">Cuidado!</h3>
                                <p className="text-slate-500 font-medium">
                                    Esta ação irá apagar <strong>todos os empréstimos ativos e o histórico</strong> de todos os armários.
                                    Os armários em si continuarão cadastrados.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 pt-4">
                                <button
                                    onClick={async () => {
                                        setIsClearing(true);
                                        await onClearAll();
                                        setIsClearing(false);
                                        setShowConfirm(false);
                                    }}
                                    disabled={isClearing}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-red-100 transition-all flex justify-center items-center gap-3 uppercase text-xs tracking-widest"
                                >
                                    {isClearing ? <Loader2 className="animate-spin" size={20} /> : "Sim, apagar tudo"}
                                </button>
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-500 font-black py-5 rounded-[2rem] transition-all uppercase text-xs tracking-widest"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-blue-50 border-2 border-blue-100 rounded-3xl p-6 flex gap-4 items-start">
                    <Info className="text-blue-500 shrink-0 mt-1" size={24} />
                    <div className="space-y-1">
                        <p className="text-blue-900 font-black uppercase text-xs tracking-widest">Informações do Arquivo</p>
                        <p className="text-blue-700/80 text-sm font-medium leading-relaxed">
                            O arquivo de histórico contém <strong>{exportData.length} registros</strong> de empréstimos e devoluções.
                            Para exportar exclusivamente a relação atual de alunos com armários emprestados com o e-mail cadastrado, utilize o botão <strong>Exportar Excel (.xlsx)</strong> acima.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExportTab;
