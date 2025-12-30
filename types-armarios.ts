
export enum LockerStatus {
  AVAILABLE = 'Disponível',
  OCCUPIED = 'Ocupado',
  MAINTENANCE = 'Manutenção'
}

export interface Student {
  registration: string;
  name: string;
  course: string;
  situation: string;
  email: string;
}

export interface LoanData {
  id: string; // Identificação
  lockerNumber: number; // Número do Armário
  physicalLocation: string; // Localização Física
  registrationNumber: string; // Matrícula
  studentName: string; // Nome do Aluno
  studentClass: string; // Turma do Aluno
  loanDate: string; // Data do Empréstimo
  returnDate?: string; // Data da Devolução
  observation: string; // Observação
}

export interface MaintenanceData {
  problem: string; // Motivo da manutenção
  registeredAt: string; // Data de início
  registeredBy?: string; // Usuário responsável (Nome)
  solution?: string;
  resolvedAt?: string; // Data de fim
  resolvedBy?: string; // Usuário que finalizou
}

export interface Locker {
  number: number;
  status: LockerStatus;
  currentLoan?: LoanData;
  maintenanceRecord?: MaintenanceData;
  loanHistory: LoanData[];
  maintenanceHistory: MaintenanceData[];
  location: string;
}

export type ViewType = 'dashboard' | 'grid' | 'loan-form' | 'import' | 'search' | 'reports' | 'management' | 'export' | 'config';
