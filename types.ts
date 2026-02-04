export enum UserLevel {
  ADMIN = 'Administrador',
  ADVANCED = 'Avançado',
  STANDARD = 'Padrão'
}

export enum ItemStatus {
  AVAILABLE = 'Disponível',
  RETURNED = 'Devolvido',
  DISCARDED = 'Descartado/Doado'
}

export enum ReportStatus {
  OPEN = 'Aberto',
  FOUND = 'Encontrado',
  RESOLVED = 'Resolvido/Devolvido'
}

export enum PersonType {
  STUDENT = 'Aluno',
  SERVER = 'Servidor',
  EXTERNAL = 'Externo'
}

export interface User {
  id: string;
  matricula: string;
  name: string;
  password?: string; // In a real app, never store plain text
  level: UserLevel;
  permissions?: {
    achados?: boolean;
    armarios?: boolean;
    livros?: boolean;
    nadaconsta?: boolean;
    pessoas?: boolean;
    usuarios?: boolean;
    materiais?: boolean;
  };
  logs?: string[];
  moduleOrder?: string[];
}

export interface Person {
  id: string;
  matricula: string;
  name: string;
  type: PersonType;
}

export interface ItemHistory {
  date: string;
  action: string;
  user?: string; // Quem realizou a ação
}

export interface FoundItem {
  id: number; // Sequential ID
  description: string;
  detailedDescription?: string;
  locationFound: string;
  locationStored: string;
  dateFound: string; // ISO date
  dateRegistered: string; // ISO datetime
  status: ItemStatus;
  returnedTo?: string; // Person ID or Name
  returnedDate?: string; // Data de devolução OU descarte
  history?: ItemHistory[]; // Log de auditoria do objeto
  imageUrl?: string; // Base64 or URL
}

export interface LostReport {
  id: string;
  itemDescription: string;
  personId?: string; // Link to Person
  personName: string; // Fallback or display name
  whatsapp: string;
  email?: string;
  status: ReportStatus;
  createdAt: string;
  history: { date: string; note: string; user?: string }[];
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
}

export enum BookLoanStatus {
  ACTIVE = 'Ativo',
  RETURNED = 'Devolvido'
}

export interface Book {
  id: string;
  edition: string;
  code: string;
  area: string;
  title: string;
  series: string;
  publisher: string;
  quantity: string;
}

export interface BookLoan {
  id: string;
  personId: string;
  personName: string;
  personMatricula?: string;
  books: {
    id: string;
    title: string;
    code?: string;
    series?: string;
    status?: 'Ativo' | 'Devolvido';
    returnDate?: string;
    returnedBy?: string;
  }[];
  loanedBy: string;
  loanDate: string;
  status: BookLoanStatus;
  returnDate?: string;
  observation?: string;
  history?: {
    action: string;
    user: string;
    timestamp: string;
  }[];
}