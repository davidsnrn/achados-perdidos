
import React, { useState, useMemo } from 'react';
import { Locker, LoanData } from '../../types-armarios';
import { Search, Calendar, FileText, Download } from 'lucide-react';

interface ReportsTabProps {
    lockers: Locker[];
}

interface ReportEntry {
    lockerNumber: number;
    registration: string;
    studentName: string;
    studentClass: string;
    actionType: 'Empréstimo' | 'Devolução';
    actionDate: string;
}

const ReportsTab: React.FC<ReportsTabProps> = ({ lockers }) => {
    const [dateFilter, setDateFilter] = useState('');
    const [studentFilter, setStudentFilter] = useState('');

    const reportData = useMemo(() => {
        const entries: ReportEntry[] = [];

        lockers.forEach(locker => {
            // Current Loans if it has no return date (active) or if it exists
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

            // Past history
            locker.loanHistory.forEach(loan => {
                // Loan action
                entries.push({
                    lockerNumber: locker.number,
                    registration: loan.registrationNumber,
                    studentName: loan.studentName,
                    studentClass: loan.studentClass,
                    actionType: 'Empréstimo',
                    actionDate: loan.loanDate
                });

                // Return action
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

        // Filtering
        return entries.filter(entry => {
            let match = true;
            if (dateFilter) {
                // Assume dateFilter is YYYY-MM-DD from input[type=date]
                // Assume actionDate is DD/MM/YYYY
                const [year, month, day] = dateFilter.split('-');
                const formattedFilterDate = `${day}/${month}/${year}`;
                if (entry.actionDate !== formattedFilterDate) match = false;
            }
            if (studentFilter) {
                const query = studentFilter.toLowerCase();
                if (!entry.studentName.toLowerCase().includes(query) && !entry.registration.toLowerCase().includes(query)) {
                    match = false;
                }
            }
            return match;
        }).sort((a, b) => {
            // Sort by date desc (naive DD/MM/YYYY sort)
            const partsA = a.actionDate.split('/');
            const partsB = b.actionDate.split('/');
            const dateA = new Date(parseInt(partsA[2]), parseInt(partsA[1]) - 1, parseInt(partsA[0])).getTime();
            const dateB = new Date(parseInt(partsB[2]), parseInt(partsB[1]) - 1, parseInt(partsB[0])).getTime();
            return dateB - dateA;
        });
    }, [lockers, dateFilter, studentFilter]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row gap-4 items-end mb-8">
                    <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                            <Calendar size={12} /> Data da Ação
                        </label>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                        />
                    </div>
                    <div className="flex-[2] space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                            <Search size={12} /> Aluno (Nome ou Matrícula)
                        </label>
                        <input
                            type="text"
                            placeholder="Digite para buscar..."
                            value={studentFilter}
                            onChange={(e) => setStudentFilter(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => { setDateFilter(''); setStudentFilter(''); }}
                        className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                    >
                        Limpar
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="py-4 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Armário</th>
                                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Matrícula</th>
                                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome do Aluno</th>
                                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Turma</th>
                                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tipo de Ação</th>
                                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.length > 0 ? (
                                reportData.map((entry, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-2 font-black text-slate-800">#{entry.lockerNumber}</td>
                                        <td className="py-4 px-4 text-sm font-medium text-slate-600">{entry.registration}</td>
                                        <td className="py-4 px-4 text-sm font-black text-slate-800 uppercase">{entry.studentName}</td>
                                        <td className="py-4 px-4 text-sm font-bold text-slate-500">{entry.studentClass}</td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${entry.actionType === 'Empréstimo' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                                                {entry.actionType}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-sm font-bold text-slate-500 text-right">{entry.actionDate}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-300">
                                            <FileText size={48} />
                                            <p className="font-black uppercase tracking-widest text-xs">Nenhum registro encontrado</p>
                                        </div>
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

export default ReportsTab;
