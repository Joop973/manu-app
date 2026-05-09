export type BookingType = 'income' | 'expense';

export type Recurrence = 'none' | 'monthly' | 'yearly';

export interface Property {
  id: string;
  name: string;
  address?: string;
  description?: string;
  notes?: string;
  color: string;
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
  propertyId: string | null;
  unit?: string;
  rentCold?: number;
  rentWarm?: number;
  deposit?: number;
  depositPaid?: boolean;
  contractStart?: string;
  contractEnd?: string;
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

export interface Settings {
  pinHash?: string;
  biometricEnabled: boolean;
  fontScale: FontScale;
  hapticEnabled: boolean;
  soundEnabled: boolean;
  onboardingDone: boolean;
}
