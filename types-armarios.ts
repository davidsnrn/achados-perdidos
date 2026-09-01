
export enum LockerStatus {
  AVAILABLE = 'Disponível',
  OCCUPIED = 'Ocupado',
  MAINTENANCE = 'Manutenção',
  SCHEDULED = 'Agendado'
}

export enum LockerScheduleStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface LockerSchedule {
  id: string;
  lockerNumber: string;
  lockerLocation: string;
  campusId?: string;
  setor_id?: string;
  studentName: string;
  registrationNumber: string;
  studentClass: string;
  scheduledBy: string;
  scheduledAt: string; // ISO timestamp
  observation?: string;
  status: LockerScheduleStatus;
  completedBy?: string;
  completedAt?: string; // ISO timestamp
}

export interface Student {
  registration: string;
  name: string;
  course: string;
  situation: string;
  email: string;
  phone?: string;
}

export interface LoanData {
  id: string; // Identificação
  lockerNumber: string; // Número do Armário
  physicalLocation: string; // Localização Física
  registrationNumber: string; // Matrícula
  studentName: string; // Nome do Aluno
  studentEmail?: string; // E-mail do Aluno
  studentPhone?: string; // Telefone do Aluno
  studentClass: string; // Turma do Aluno
  loanDate: string; // Data do Empréstimo
  loanTime?: string; // Hora do Empréstimo
  loanBy?: string; // Quem realizou o empréstimo
  returnDate?: string; // Data da Devolução
  returnTime?: string; // Hora da Devolução
  returnedBy?: string; // Quem realizou a devolução
  observation: string; // Observação
  campus_id?: string;
  setor_id?: string;
  loanType?: 'regular' | 'reserve_key';
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
  number: string;
  status: LockerStatus;
  currentLoan?: LoanData;
  maintenanceRecord?: MaintenanceData;
  loanHistory: LoanData[];
  maintenanceHistory: MaintenanceData[];
  location: string;
  campus_id?: string;
  setor_id?: string;
  activeScheduleId?: string; // Reference to pending LockerSchedule
}

export type ViewType = 'dashboard' | 'grid' | 'loan-form' | 'import' | 'search' | 'reports' | 'management' | 'export' | 'config' | 'schedules';
