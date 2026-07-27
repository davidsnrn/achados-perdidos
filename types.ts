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
  kiosk_code?: string;
  created_at?: string;
}

export interface Setor {
  id: string;
  campus_id: string;
  name: string;
  slug: string;
  kiosk_code?: string;
  created_at?: string;
}

export interface User {
  id: string;
  matricula: string;
  name: string;
  email?: string;
  password?: string;
  level: UserLevel;
  campus_id?: string;
  setor_id?: string;
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
  reset_token?: string;
  reset_token_expires?: string;
}

export interface Person {
  matricula: string;
  name: string;
  type: PersonType;
  campus_id?: string;
  setor_id?: string;
  email?: string;
  document?: string;
  document_type?: string;
  phone?: string;
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
  setor_id?: string;
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
  setor_id?: string;
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
  setor_id?: string;
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
  setor_id?: string;
}

export interface CopyConfig {
  campus_id: string;
  setor_id?: string;
  start_day: number;
  end_day: number;
  created_at?: string;
  updated_at?: string;
}

export interface CopyRecord {
  id: string;
  campus_id: string;
  setor_id?: string;
  person_name: string;
  person_matricula: string;
  person_type?: PersonType; // For statistics and display
  sector: string;
  print_type: 'PROVA' | 'OUTRAS';
  format: 'A4' | 'A3';
  color_mode: 'MONO' | 'POLI';
  quantity: number;
  date: string; // ISO
  operator_id: string;
  printer_id?: string; // Vínculo com impressora física (null = Controle de Cópias genérico)
  is_adjustment?: boolean; // true = registro de ajuste manual sem pessoa vinculada
  created_at?: string;
}

export interface Supply {
  id: string;
  campus_id: string;
  setor_id?: string;
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
  setor_id?: string;
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
  setor_id?: string;
  name: string;
  color: string;
  etep_threshold: number;
  subtypes?: string[];
  created_at?: string;
}

export interface StudentNotification {
  id: string;
  campus_id: string;
  setor_id?: string;
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
  operator_name?: string;
  operator_matricula?: string;
  updated_by?: string;
  updated_by_name?: string;
  updated_by_matricula?: string;
  updated_at?: string;
  deleted_at?: string;
  deleted_by?: string;
  deleted_by_name?: string;
  deleted_by_matricula?: string;
  deleted_justification?: string;
  out_of_hours?: boolean;
  mobile_use?: boolean;
  no_uniform?: boolean;
  no_sneakers?: boolean;
  created_at?: string;
}

export interface SupplyRecord {
  id: string;
  campus_id: string;
  setor_id?: string;
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
  setor_id?: string;
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
  id?: string;
  campus_id: string;
  setor_id?: string;
  schedule_id: string;
  period: number;
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
  setor_id?: string;
  name: string;
  room?: string;
  created_at?: string;
}

export interface TeacherPlannedAbsence {
  id?: string;
  campus_id: string;
  setor_id?: string;
  teacher_name: string;
  date: string;
  schedule_id: string;
  period: number;
  status: 'VAGO' | 'SUBSTITUIDO';
  substitute_name?: string;
  observation?: string;
  operator_id: string;
  created_at?: string;
}

export interface TeacherReposicao {
  id?: string;
  campus_id: string;
  setor_id?: string;
  attendance_id?: string;
  planned_absence_id?: string;
  schedule_id: string;
  date: string;
  period: number;
  teacher_name: string;
  class_name: string;
  subject: string;
  status: 'PENDENTE' | 'CONCLUIDO';
  makeup_date?: string;
  makeup_period?: number;
  observation?: string;
  operator_id: string;
  created_at?: string;
}

export interface RoomBooking {
  id?: string;
  campus_id: string;
  setor_id?: string;
  room_name: string;
  teacher_name?: string;
  event_title: string;
  booking_type: 'AULA' | 'EVENTO';
  start_date: string; // ISO date (YYYY-MM-DD)
  end_date: string; // ISO date (YYYY-MM-DD)
  recurrence_type: 'ALL_DAYS' | 'WEEKLY' | 'SPECIFIC_DAYS';
  recurrence_days?: number[]; // [0-6] (0=Dom, 1=Seg...)
  periods: number[]; // Lista de IDs das aulas
  observation?: string;
  operator_id: string;
  created_at?: string;
}


export interface PrinterRegistry {
  id?: string;
  campus_id: string;
  local_name: string;
  serial_number?: string;
  ip_address?: string;
  model?: string;
  supports_a4_mono: boolean;
  supports_a4_poli: boolean;
  supports_a3_mono: boolean;
  supports_a3_poli: boolean;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PrinterCounterRecord {
  id: string;
  campus_id: string;
  period: string;           // 'YYYY-MM'
  printer_id?: string;
  local_name: string;
  serial_number?: string;
  ip_address?: string;
  model?: string;
  format: 'A4' | 'A3';
  color_mode: 'MONO' | 'POLI';
  counter_prev: number;
  counter_curr: number;
  operator_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PrinterBillingConfig {
  id?: string;
  campus_id: string;
  // A4 Mono
  a4_mono_franchise: number;
  a4_mono_excess_franchise: number;   // teto de excedente permitido
  a4_mono_price_franchise: number;
  a4_mono_price_excess: number;
  // A4 Poli
  a4_poli_franchise: number;
  a4_poli_excess_franchise: number;
  a4_poli_price_franchise: number;
  a4_poli_price_excess: number;
  // A3 Mono
  a3_mono_franchise: number;
  a3_mono_excess_franchise: number;
  a3_mono_price_franchise: number;
  a3_mono_price_excess: number;
  // A3 Poli
  a3_poli_franchise: number;
  a3_poli_excess_franchise: number;
  a3_poli_price_franchise: number;
  a3_poli_price_excess: number;
  full_franchise_value?: boolean;  // true = cobra franquia cheia independente do consumo; default true
  created_at?: string;
  updated_at?: string;
}

