import React, { useState, useMemo } from 'react';
import { Locker } from '../../types-armarios';
import { Search, Calendar, FileText, ArrowRight } from 'lucide-react';

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
    const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | 'week' | 'custom'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [studentFilter, setStudentFilter] = useState('');
    const [actionTypeFilter, setActionTypeFilter] = useState<'all' | 'Empréstimo' | 'Devolução'>('all');

    const reportData = useMemo(() => {
        const entries: ReportEntry[] = [];

        const getLocalDate = (dateStr: string) => {
            const [d, m, y] = dateStr.split('/');
            return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());

        lockers.forEach(locker => {
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

            locker.loanHistory.forEach(loan => {
                entries.push({
                    lockerNumber: locker.number,
                    registration: loan.registrationNumber,
                    studentName: loan.studentName,
                    studentClass: loan.studentClass,
                    actionType: 'Empréstimo',
                    actionDate: loan.loanDate
                });
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

        return entries.filter(entry => {
            const entryDate = getLocalDate(entry.actionDate);
            const isInvalidDate = isNaN(entryDate.getTime());

            if (dateFilterType !== 'all' && isInvalidDate) return false;

            if (dateFilterType === 'today') {
                if (entryDate.getTime() !== today.getTime()) return false;
            } else if (dateFilterType === 'week') {
                if (entryDate < startOfWeek) return false;
            } else if (dateFilterType === 'custom') {
                if (startDate) {
                    const [sy, sm, sd] = startDate.split('-');
                    const sDate = new Date(parseInt(sy), parseInt(sm) - 1, parseInt(sd));
                    if (isInvalidDate || entryDate < sDate) return false;
                }
                if (endDate) {
                    const [ey, em, ed] = endDate.split('-');
                    const eDate = new Date(parseInt(ey), parseInt(em) - 1, parseInt(ed));
                    if (isInvalidDate || entryDate > eDate) return false;
                }
            }

            if (actionTypeFilter !== 'all') {
                if (entry.actionType !== actionTypeFilter) return false;
            }

            if (studentFilter) {
                const searchGroups = studentFilter
                    .split(',')
                    .map(segment => ({
                        segment: segment.toLowerCase(),
                        words: segment
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase()
                            .trim()
                            .split(' ')
                            .filter(t => t.length > 0)
                    }))
                    .filter(group => group.words.length > 0);

                if (searchGroups.length > 0) {
                    const normalizedEntryStr = `${entry.registration} ${entry.studentName} ${entry.studentClass}`
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .toLowerCase();

                    const matches = searchGroups.some(group =>
                        group.words.every(word => {
                            if (word.startsWith('#')) {
                                const lockerNum = word.substring(1);
                                const isExact = group.segment.includes(`${word} `);
                                if (isExact) {
                                    return entry.lockerNumber.toString() === lockerNum;
                                }
                                return entry.lockerNumber.toString().includes(lockerNum);
                            }
                            return normalizedEntryStr.includes(word);
                        })
                    );
                    if (!matches) return false;
                }
            }
            return true;
        }).sort((a, b) => {
            const dateA = getLocalDate(a.actionDate).getTime();
            const dateB = getLocalDate(b.actionDate).getTime();

            if (isNaN(dateA)) return 1;
            if (isNaN(dateB)) return -1;

            return dateB - dateA;
        });
    }, [lockers, dateFilterType, startDate, endDate, studentFilter, actionTypeFilter]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row gap-4 items-end mb-8">
                    <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                            <Calendar size={12} /> Período
                        </label>
                        <div className="relative">
                            <select
                                value={dateFilterType}
                                onChange={(e) => setDateFilterType(e.target.value as any)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500 transition-all appearance-none"
                            >
                                <option value="all">Todo o histórico</option>
                                <option value="today">Hoje</option>
                                <option value="week">Esta semana</option>
                                <option value="custom">Data personalizada</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>

                    {dateFilterType === 'custom' && (
                        <>
                            <div className="flex-1 space-y-1 animate-slideInLeft">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                                    De
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                />
                            </div>
                            <div className="flex-1 space-y-1 animate-slideInLeft">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                                    Até
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                />
                            </div>
                        </>
                    )}

                    <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                            Ação
                        </label>
                        <div className="relative">
                            <select
                                value={actionTypeFilter}
                                onChange={(e) => setActionTypeFilter(e.target.value as any)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500 transition-all appearance-none"
                            >
                                <option value="all">Todos</option>
                                <option value="Empréstimo">Empréstimo</option>
                                <option value="Devolução">Devolução</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>

                    <div className="flex-[2] space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                            <Search size={12} /> Busca (Nome, Matrícula ou #Chave)
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
                        onClick={() => {
                            setDateFilterType('all');
                            setStartDate('');
                            setEndDate('');
                            setStudentFilter('');
                            setActionTypeFilter('all');
                        }}
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
