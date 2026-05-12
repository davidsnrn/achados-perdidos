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

export interface Campus {
  id: string;
  name: string;
  slug: string;
  created_at?: string;
}

export interface User {
  id: string;
  matricula: string;
  name: string;
  password?: string;
  level: UserLevel;
  campus_id?: string;
  permissions?: {
    achados?: boolean;
    armarios?: boolean;
    livros?: boolean;
    nadaconsta?: boolean;
    pessoas?: boolean;
    usuarios?: boolean;
    materiais?: boolean;
    copias?: boolean;
    insumos?: boolean;
    notificacoes?: boolean;
    frequencia?: boolean;
  };
  logs?: string[];
  access_logs?: string[];
  moduleOrder?: string[];
}

export interface Person {
  matricula: string;
  name: string;
  type: PersonType;
  campus_id?: string;
}

export interface ItemHistory {
  date: string;
  action: string;
  user?: string; // Quem realizou a ação
}

export interface FoundItem {
  id: number; // Internal DB primary key
  campusItemId?: number; // Sequential ID per campus (displayed to user)
  description: string;
  detailedDescription?: string;
  locationFound: string;
  locationStored: string;
  dateFound: string; // ISO date
  dateRegistered: string; // ISO datetime
  status: ItemStatus;
  returnedTo?: string; // Person ID or Name
  returnedDate?: string; // Data de devolução OU descarte
  discardType?: 'Doado' | 'Descartado'; // Tipo de saída
  history?: ItemHistory[]; // Log de auditoria do objeto
  imageUrl?: string; // Base64 or URL
  campus_id?: string;
}

export interface LostReport {
  id: string;
  itemDescription: string;
  personMatricula?: string; // Link to Person by matricula
  personName: string; // Fallback or display name
  whatsapp: string;
  email?: string;
  status: ReportStatus;
  createdAt: string;
  history: { date: string; note: string; user?: string }[];
  campus_id?: string;
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
  campus_id?: string;
}

export interface BookLoan {
  id: string;
  personName: string;
  personMatricula: string;
  books: {
    id: string;
    title: string;
    code?: string;
    series?: string;
    status?: 'Ativo' | 'Devolvido';
    loanDate?: string;
    loanedBy?: string;
    returnDate?: string;
    returnedBy?: string;
    observation?: string;
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
  personType?: PersonType;
  campus_id?: string;
}

export interface CopyConfig {
  campus_id: string;
  start_day: number;
  end_day: number;
  created_at?: string;
  updated_at?: string;
}

export interface CopyRecord {
  id: string;
  campus_id: string;
  person_name: string;
  person_matricula: string;
  person_type?: PersonType; // For statistics and display
  sector: string;
  print_type: 'PROVA' | 'OUTRAS';
  quantity: number;
  date: string; // ISO
  operator_id: string;
  created_at?: string;
}

export interface Supply {
  id: string;
  campus_id: string;
  name: string;
  quantity: number;
  unit: string;
  created_at?: string;
  updated_at?: string;
  low_stock_threshold?: number;
  operator_id?: string;
}

export interface SupplyRestock {
  id: string;
  supply_id: string;
  campus_id: string;
  quantity_added: number;
  date: string;
  operator_id: string;
  note?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  created_at?: string;
}

export interface NotificationType {
  id: string;
  campus_id?: string;
  name: string;
  color: string;
  etep_threshold: number;
  subtypes?: string[];
  created_at?: string;
}

export interface StudentNotification {
  id: string;
  campus_id: string;
  date: string;
  time: string;
  student_matricula: string;
  student_name: string;
  period?: string;
  class_name?: string;
  notification_type_ids?: string[];
  selected_subtypes?: string[];
  justification?: string;
  teacher_referral: boolean;
  teacher_name?: string;
  operator_id: string;
  created_at?: string;
}

export interface SupplyRecord {
  id: string;
  campus_id: string;
  person_name?: string;
  person_matricula?: string;
  environment?: string;
  sector?: string;
  item_id: string;
  quantity: number;
  date: string; // ISO
  operator_id: string;
  cancelled_at?: string;
  cancelled_by?: string;
  created_at?: string;
}

export interface TeacherSchedule {
  id: string;
  campus_id: string;
  class_name: string;
  subject?: string;
  teacher_name: string;
  day_of_week: number; // 0-6 (0=Dom, 1=Seg...)
  period: number; // Primeiro período ou principal
  periods: number[]; // Lista de todos os períodos (ex: [5, 6] para 6M56)
  shorthand?: string; // String original (ex: 2M12)
  start_time: string;
  end_time: string;
  room?: string;
  created_at?: string;
}

export interface TeacherAttendance {
  id: string;
  campus_id: string;
  schedule_id: string;
  date: string; // ISO date
  status: 'PRESENTE' | 'SUBSTITUIDO' | 'VAGO';
  substitute_name?: string;
  observation?: string;
  operator_id: string;
  created_at?: string;
}
export interface TeacherClass {
  id?: string;
  campus_id: string;
  name: string;
  created_at?: string;
}
