export type BookingType = 'income' | 'expense';

export type Recurrence = 'none' | 'monthly' | 'yearly';

export interface Property {
  id: string;
  name: string;
  address?: string;
  description?: string;
  notes?: string;
  color: string;
  totalLivingArea?: number; // m² für NK-Abrechnung
  afa?: {
    acquisitionValue?: number;
    acquisitionDate?: string;
    ratePercent?: number;
  };
  createdAt: string;
}

export interface Category {
  id: string;
  label: string;
  emoji: string;
  builtin?: boolean;
  fixedCost?: boolean;
}

export interface Booking {
  id: string;
  type: BookingType;
  amount: number;
  date: string;
  propertyId: string | null;
  categoryId: string | null;
  counterparty?: string;
  note?: string;
  recurrence: Recurrence;
  autoBook?: boolean;
  templateId?: string;
  ruleId?: string;
  receiptId?: string;
  tagIds?: string[];
  splitId?: string;
  subscriptionId?: string;
  goalId?: string;
  loanId?: string;
  createdAt: string;
}

export interface Template {
  id: string;
  label: string;
  type: BookingType;
  amount: number;
  propertyId: string | null;
  categoryId: string | null;
  counterparty?: string;
  note?: string;
  recurrence: Recurrence;
  createdAt: string;
}

export type RuleConditionField = 'counterparty' | 'note' | 'amountMin' | 'amountMax';

export interface RuleCondition {
  field: RuleConditionField;
  value: string | number;
}

export interface RuleAction {
  setCategoryId?: string;
  setPropertyId?: string;
  setRecurrence?: Recurrence;
  addTagIds?: string[];
}

export interface Rule {
  id: string;
  label: string;
  conditions: RuleCondition[];
  actions: RuleAction;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  iban?: string;
  propertyId: string | null;
  unit?: string;
  rentCold?: number;
  rentWarm?: number;
  deposit?: number;
  depositPaid?: boolean;
  contractStart?: string;
  contractEnd?: string;
  livingArea?: number;
  personCount?: number;
  notes?: string;
  createdAt: string;
}

export type Trade =
  | 'Heizung'
  | 'Elektrik'
  | 'Sanitär'
  | 'Maler'
  | 'Schreiner'
  | 'Dach'
  | 'Garten'
  | 'Reinigung'
  | 'Schädlingsbekämpfung'
  | 'Schornsteinfeger'
  | 'Sonstiges';

export interface Craftsman {
  id: string;
  name: string;
  trade: Trade;
  phone?: string;
  email?: string;
  website?: string;
  hours?: string;
  notes?: string;
  createdAt: string;
}

export type ReceiptKind = 'image' | 'pdf' | 'document';

export interface ReceiptHint {
  amount?: number;
  date?: string;
  counterparty?: string;
  categoryId?: string;
  confidence: number;
  parsedFrom: 'filename' | 'text' | 'qr' | 'manual';
}

export interface Receipt {
  id: string;
  filename: string;
  kind: ReceiptKind;
  uri: string;
  size?: number;
  extractedText?: string;
  hint?: ReceiptHint;
  bookingId?: string;
  createdAt: string;
}

export type DocumentCategory =
  | 'Mietvertrag'
  | 'Versicherungspolice'
  | 'Grundbuchauszug'
  | 'Nebenkostenabrechnung'
  | 'Handwerker-Rechnung'
  | 'Sonstiges';

export interface DocumentEntry {
  id: string;
  filename: string;
  uri: string;
  category: DocumentCategory;
  propertyId?: string | null;
  tenantId?: string | null;
  expiresAt?: string;
  notes?: string;
  size?: number;
  createdAt: string;
}

export type MeterType = 'strom' | 'gas' | 'wasser' | 'heizung';

export interface MeterReading {
  id: string;
  propertyId: string;
  type: MeterType;
  value: number;
  date: string;
  unit?: string;
  photoUri?: string;
  notes?: string;
  createdAt: string;
}

export type FontScale = 'normal' | 'large' | 'xlarge';

export type ColorScheme = 'dark' | 'light' | 'system';
export type Locale = 'de' | 'en';

export interface Settings {
  pinHash?: string;
  biometricEnabled: boolean;
  fontScale: FontScale;
  hapticEnabled: boolean;
  soundEnabled: boolean;
  onboardingDone: boolean;
  notificationsEnabled: boolean;
  helpHintsEnabled: boolean;
  monthlyReportReminderEnabled: boolean;
  /** F-130 Auto-Lock: Inaktivität in Minuten (0 = aus). */
  autoLockMinutes: number;
  /** Phase 5: Theme. */
  colorScheme: ColorScheme;
  /** Phase 5: Sprache. */
  locale: Locale;
  /** Phase 7: Sprachdiktat-Datenschutz. */
  voicePrivacy?: 'on-device' | 'cloud';
}

/** F-131 Papierkorb-Eintrag — generisch. */
export interface TrashEntry {
  id: string;
  entityType:
    | 'booking'
    | 'tenant'
    | 'craftsman'
    | 'receipt'
    | 'document'
    | 'meterReading'
    | 'maintenance'
    | 'subscription'
    | 'contract'
    | 'goal'
    | 'tag';
  payload: unknown;
  deletedAt: string;
}

// === Phase 3: neue Entitäten ===

/** F-100 Tags / Multi-Labels — flexibler als Kategorien */
export interface Tag {
  id: string;
  label: string;
  color: string;
  createdAt: string;
}

/** F-101 Subscription Detector — vom Detector erkannt oder manuell angelegt */
export interface Subscription {
  id: string;
  name: string;
  amount: number;
  cadence: 'monthly' | 'yearly';
  dayOfMonth?: number;
  categoryId?: string | null;
  propertyId?: string | null;
  active: boolean;
  detectedAutomatically?: boolean;
  cancelledAt?: string;
  notes?: string;
  createdAt: string;
}

/** F-108 Vertrags-Tracker mit Kündigungsfrist */
export interface Contract {
  id: string;
  label: string;
  vendor?: string;
  category: 'Strom' | 'Gas' | 'Internet' | 'Telefon' | 'Versicherung' | 'Streaming' | 'Sonstiges';
  monthlyCost?: number;
  startDate?: string;
  noticePeriodDays?: number;
  earliestEndDate?: string;
  documentId?: string;
  notes?: string;
  createdAt: string;
}

/** F-109 Savings Goals */
export interface Goal {
  id: string;
  label: string;
  target: number;
  saved: number;
  deadline?: string;
  propertyId?: string | null;
  emoji?: string;
  notes?: string;
  createdAt: string;
}

/** F-112 Net Worth — Aktiva (Asset) und Passiva (Liability) */
export type AssetKind = 'cash' | 'property' | 'investment' | 'vehicle' | 'other';

export interface Asset {
  id: string;
  label: string;
  kind: AssetKind;
  value: number;
  propertyId?: string;
  notes?: string;
  history: { date: string; value: number }[];
  createdAt: string;
}

export type LiabilityKind = 'mortgage' | 'loan' | 'credit_card' | 'other';

export interface Liability {
  id: string;
  label: string;
  kind: LiabilityKind;
  balance: number;
  interestRate?: number;
  monthlyPayment?: number;
  propertyId?: string;
  notes?: string;
  history: { date: string; balance: number }[];
  createdAt: string;
}

/** F-113 Envelope Budgeting */
export interface Budget {
  id: string;
  categoryId: string;
  monthlyLimit: number;
  rolloverEnabled?: boolean;
  createdAt: string;
}

/** F-115 Investment Portfolio */
export type InvestmentKind = 'stock' | 'etf' | 'fund' | 'crypto' | 'other';

export interface Investment {
  id: string;
  symbol: string;
  name: string;
  kind: InvestmentKind;
  shares: number;
  buyPrice: number;
  currentPrice?: number;
  currency: string;
  notes?: string;
  history: { date: string; price: number }[];
  createdAt: string;
}

/** F-117 Debt-Payoff (separat von Liability für detaillierten Plan) */
export interface DebtPlan {
  id: string;
  liabilityId: string;
  monthlyPayment: number;
  startDate: string;
  notes?: string;
  createdAt: string;
}

/** F-118 Achievements / Streaks */
export interface AchievementState {
  unlocked: string[]; // IDs
  streak: number;
  lastActiveDate?: string;
  totalBookings: number;
}

/** F-120 Maintenance-Historie pro Objekt */
export interface MaintenanceLog {
  id: string;
  propertyId: string;
  date: string;
  craftsmanId?: string;
  description: string;
  cost?: number;
  bookingId?: string;
  photoUri?: string;
  createdAt: string;
}

/** F-122 Bill-Splitting */
export interface BillSplit {
  id: string;
  bookingId: string;
  totalAmount: number;
  paidByMe: number;
  participants: { name: string; share: number; settled: boolean }[];
  notes?: string;
  createdAt: string;
}

/** F-107 Lokale Notifications — Wiedervorlage */
export interface ScheduledReminder {
  id: string;
  notificationId?: string;
  label: string;
  date: string;
  kind: 'contract' | 'rent' | 'meter' | 'general' | 'monthlyReport';
  targetId?: string;
  done?: boolean;
  createdAt: string;
}

// === Phase 4 ===

/** F-044 Übergabeprotokoll — Räume mit Zustand, Mängeln, Fotos */
export interface HandoverRoom {
  name: string;
  condition: string;
  defects: string[];
  photoUris: string[];
  meterReadings?: { type: MeterType; value: number; unit?: string }[];
}

export interface HandoverProtocol {
  id: string;
  propertyId: string;
  tenantId?: string;
  kind: 'einzug' | 'auszug';
  date: string;
  rooms: HandoverRoom[];
  keys: { type: string; count: number }[];
  signatureUri?: string;
  pdfUri?: string;
  notes?: string;
  createdAt: string;
}

/** F-045 Manuelle Leerstands-Markierung */
export interface VacancyMark {
  id: string;
  propertyId: string;
  fromDate: string;
  toDate?: string;
  reason: 'planned' | 'unplanned';
  notes?: string;
  createdAt: string;
}

/** F-042 DATEV-Konten-Mapping pro Kategorie */
export interface DatevMapping {
  categoryId: string;
  account: string;
  accountName?: string;
}

/** F-041 AfA-Posten pro Property (für Anlage V) */
export interface AfaInfo {
  acquisitionValue?: number;
  acquisitionDate?: string;
  ratePercent?: number; // z.B. 2 oder 2.5
}
