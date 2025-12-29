
import { LockerStatus, Locker, LoanData, MaintenanceData } from './types-armarios';

export const TOTAL_LOCKERS = 440;

export const IFRN_COLORS = {
  primary: '#2f9e41', // Verde IFRN
  secondary: '#d92d20', // Vermelho IFRN
  dark: '#1a1a1a',
};

export const MOCK_LOCATIONS = [
  'Bloco Principal - Corredor A',
  'Bloco Principal - Corredor B',
  'Bloco Principal - Piso Superior',
  'Bloco Anexo - Próximo ao Ginásio',
];

const MOCK_PROBLEMS = [
  'Dobradiça quebrada',
  'Fechadura emperrada',
  'Pintura descascando',
  'Prateleira interna solta',
  'Porta desalinhada'
];

const STUDENT_NAMES = ['Carlos Eduardo', 'Ana Beatriz', 'João Pedro', 'Mariana Silva', 'Lucas Oliveira', 'Beatriz Souza', 'Rafael Lima'];

export const generateInitialLockers = (): Locker[] => {
  return Array.from({ length: TOTAL_LOCKERS }, (_, i) => {
    const num = i + 1;
    const rand = Math.random();
    let status = LockerStatus.AVAILABLE;

    if (rand > 0.4 && rand < 0.85) status = LockerStatus.OCCUPIED;
    else if (rand >= 0.85) status = LockerStatus.MAINTENANCE;

    const location = num <= 200
      ? MOCK_LOCATIONS[Math.floor(Math.random() * 3)]
      : MOCK_LOCATIONS[3];

    // Gerar Histórico de Empréstimos
    const historyCount = Math.floor(Math.random() * 4);
    const loanHistory: LoanData[] = Array.from({ length: historyCount }, (_, hi) => ({
      id: `H${num}-${hi}`,
      lockerNumber: num,
      physicalLocation: location,
      registrationNumber: `2023${1000 + hi}`,
      studentName: STUDENT_NAMES[Math.floor(Math.random() * STUDENT_NAMES.length)],
      studentClass: 'INFO2V',
      loanDate: `2023-0${hi + 1}-01`,
      returnDate: `2023-0${hi + 1}-30`,
      observation: 'Devolvido sem avarias.'
    }));

    // Gerar Histórico de Manutenção
    const maintHistoryCount = Math.floor(Math.random() * 3);
    const maintenanceHistory: MaintenanceData[] = Array.from({ length: maintHistoryCount }, (_, mi) => ({
      problem: MOCK_PROBLEMS[Math.floor(Math.random() * MOCK_PROBLEMS.length)],
      registeredAt: `2023-0${mi + 1}-15`
    }));

    let mockLoan: LoanData | undefined = undefined;
    let maintenanceRecord: MaintenanceData | undefined = undefined;

    if (status === LockerStatus.OCCUPIED) {
      mockLoan = {
        id: Math.random().toString(36).substr(2, 5).toUpperCase(),
        lockerNumber: num,
        physicalLocation: location,
        registrationNumber: `2024${Math.floor(100000 + Math.random() * 900000)}`,
        studentName: STUDENT_NAMES[Math.floor(Math.random() * STUDENT_NAMES.length)],
        studentClass: 'INFO3M',
        loanDate: '2024-02-10',
        returnDate: '2024-12-15',
        observation: 'Uso regular.'
      };
    } else if (status === LockerStatus.MAINTENANCE) {
      maintenanceRecord = {
        problem: MOCK_PROBLEMS[Math.floor(Math.random() * MOCK_PROBLEMS.length)],
        registeredAt: new Date(Date.now() - 500000000).toISOString().split('T')[0]
      };
    }

    return {
      number: num,
      status: status,
      location: location,
      currentLoan: mockLoan,
      maintenanceRecord: maintenanceRecord,
      loanHistory,
      maintenanceHistory
    };
  });
};
