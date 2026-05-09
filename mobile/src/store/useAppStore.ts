import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { builtinCategories } from '@/db/categories';
import { uid } from '@/lib/id';
import { today, monthKey, isInMonth } from '@/lib/dates';
import { applyRules } from '@/lib/rules';
import { nextDueDate } from '@/lib/recurring';
import { ClipboardHint } from '@/lib/clipboard';
import { hashPin, newSalt, verifyPin } from '@/lib/pin';
import { objectColors } from '@/theme/colors';
import {
  Booking,
  Category,
  Craftsman,
  DocumentEntry,
  FontScale,
  MeterReading,
  Property,
  Receipt,
  Rule,
  Settings,
  Template,
  Tenant,
} from '@/types';

interface AppState {
  hydrated: boolean;
  unlocked: boolean;
  currentMonth: string;
  properties: Property[];
  categories: Category[];
  bookings: Booking[];
  templates: Template[];
  rules: Rule[];
  tenants: Tenant[];
  craftsmen: Craftsman[];
  receipts: Receipt[];
  documents: DocumentEntry[];
  meterReadings: MeterReading[];
  settings: Settings;
  clipboardHint: ClipboardHint | null;

  setCurrentMonth: (m: string) => void;
  setClipboardHint: (h: ClipboardHint | null) => void;
  setUnlocked: (b: boolean) => void;

  // Settings
  setPin: (pin: string | null) => void;
  verifyAppPin: (pin: string) => boolean;
  setBiometric: (enabled: boolean) => void;
  setFontScale: (s: FontScale) => void;
  setHaptic: (b: boolean) => void;
  setSound: (b: boolean) => void;
  markOnboardingDone: () => void;

  // Properties
  addProperty: (input: Omit<Property, 'id' | 'createdAt' | 'color'> & { color?: string }) => Property;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  removeProperty: (id: string) => void;

  // Categories
  addCategory: (input: Omit<Category, 'id' | 'builtin'>) => Category;
  removeCategory: (id: string) => void;

  // Bookings
  addBooking: (input: Omit<Booking, 'id' | 'createdAt'>) => Booking;
  updateBooking: (id: string, patch: Partial<Booking>) => void;
  removeBooking: (id: string) => void;

  // Templates
  addTemplate: (input: Omit<Template, 'id' | 'createdAt'>) => Template;
  removeTemplate: (id: string) => void;
  bookFromTemplate: (id: string) => Booking | null;

  // Rules
  addRule: (input: Omit<Rule, 'id' | 'createdAt'>) => Rule;
  removeRule: (id: string) => void;

  // Tenants
  addTenant: (input: Omit<Tenant, 'id' | 'createdAt'>) => Tenant;
  updateTenant: (id: string, patch: Partial<Tenant>) => void;
  removeTenant: (id: string) => void;

  // Craftsmen
  addCraftsman: (input: Omit<Craftsman, 'id' | 'createdAt'>) => Craftsman;
  updateCraftsman: (id: string, patch: Partial<Craftsman>) => void;
  removeCraftsman: (id: string) => void;

  // Receipts
  addReceipt: (input: Omit<Receipt, 'id' | 'createdAt'>) => Receipt;
  updateReceipt: (id: string, patch: Partial<Receipt>) => void;
  removeReceipt: (id: string) => void;

  // Documents
  addDocument: (input: Omit<DocumentEntry, 'id' | 'createdAt'>) => DocumentEntry;
  removeDocument: (id: string) => void;

  // MeterReadings
  addMeterReading: (input: Omit<MeterReading, 'id' | 'createdAt'>) => MeterReading;
  removeMeterReading: (id: string) => void;

  runAutoBookings: () => number;
}

const defaultSettings: Settings = {
  biometricEnabled: false,
  fontScale: 'normal',
  hapticEnabled: true,
  soundEnabled: true,
  onboardingDone: false,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      unlocked: false,
      currentMonth: monthKey(new Date()),
      properties: [],
      categories: [...builtinCategories],
      bookings: [],
      templates: [],
      rules: [],
      tenants: [],
      craftsmen: [],
      receipts: [],
      documents: [],
      meterReadings: [],
      settings: { ...defaultSettings },
      clipboardHint: null,

      setCurrentMonth: (m) => set({ currentMonth: m }),
      setClipboardHint: (h) => set({ clipboardHint: h }),
      setUnlocked: (b) => set({ unlocked: b }),

      setPin: (pin) => {
        if (pin === null) {
          set((s) => ({ settings: { ...s.settings, pinHash: undefined, biometricEnabled: false } }));
          return;
        }
        const salt = newSalt();
        const hash = hashPin(pin, salt);
        set((s) => ({ settings: { ...s.settings, pinHash: hash } }));
      },
      verifyAppPin: (pin) => {
        const stored = get().settings.pinHash;
        if (!stored) return true;
        return verifyPin(pin, stored);
      },
      setBiometric: (enabled) =>
        set((s) => ({ settings: { ...s.settings, biometricEnabled: enabled } })),
      setFontScale: (scale) => set((s) => ({ settings: { ...s.settings, fontScale: scale } })),
      setHaptic: (b) => set((s) => ({ settings: { ...s.settings, hapticEnabled: b } })),
      setSound: (b) => set((s) => ({ settings: { ...s.settings, soundEnabled: b } })),
      markOnboardingDone: () =>
        set((s) => ({ settings: { ...s.settings, onboardingDone: true } })),

      addProperty: (input) => {
        const usedColors = new Set(get().properties.map((p) => p.color));
        const fallback =
          input.color ?? objectColors.find((c) => !usedColors.has(c)) ?? objectColors[0];
        const property: Property = {
          ...input,
          color: fallback,
          id: uid('obj'),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ properties: [...s.properties, property] }));
        return property;
      },
      updateProperty: (id, patch) =>
        set((s) => ({
          properties: s.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removeProperty: (id) =>
        set((s) => ({
          properties: s.properties.filter((p) => p.id !== id),
          bookings: s.bookings.filter((b) => b.propertyId !== id),
          tenants: s.tenants.filter((t) => t.propertyId !== id),
          meterReadings: s.meterReadings.filter((r) => r.propertyId !== id),
        })),

      addCategory: (input) => {
        const cat: Category = { ...input, id: uid('cat') };
        set((s) => ({ categories: [...s.categories, cat] }));
        return cat;
      },
      removeCategory: (id) =>
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id || c.builtin) })),

      addBooking: (input) => {
        const withRules = applyRules(input, get().rules);
        const booking: Booking = {
          ...withRules,
          id: uid('bkg'),
          createdAt: new Date().toISOString(),
        } as Booking;
        set((s) => ({ bookings: [...s.bookings, booking] }));
        return booking;
      },
      updateBooking: (id, patch) =>
        set((s) => ({
          bookings: s.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),
      removeBooking: (id) =>
        set((s) => ({ bookings: s.bookings.filter((b) => b.id !== id) })),

      addTemplate: (input) => {
        const template: Template = {
          ...input,
          id: uid('tpl'),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ templates: [...s.templates, template] }));
        return template;
      },
      removeTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
      bookFromTemplate: (templateId) => {
        const tpl = get().templates.find((t) => t.id === templateId);
        if (!tpl) return null;
        return get().addBooking({
          type: tpl.type,
          amount: tpl.amount,
          date: today(),
          propertyId: tpl.propertyId,
          categoryId: tpl.categoryId,
          counterparty: tpl.counterparty,
          note: tpl.note,
          recurrence: tpl.recurrence,
          templateId: tpl.id,
        });
      },

      addRule: (input) => {
        const rule: Rule = { ...input, id: uid('rul'), createdAt: new Date().toISOString() };
        set((s) => ({ rules: [...s.rules, rule] }));
        return rule;
      },
      removeRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),

      addTenant: (input) => {
        const tenant: Tenant = { ...input, id: uid('tnt'), createdAt: new Date().toISOString() };
        set((s) => ({ tenants: [...s.tenants, tenant] }));
        return tenant;
      },
      updateTenant: (id, patch) =>
        set((s) => ({ tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTenant: (id) => set((s) => ({ tenants: s.tenants.filter((t) => t.id !== id) })),

      addCraftsman: (input) => {
        const c: Craftsman = { ...input, id: uid('crf'), createdAt: new Date().toISOString() };
        set((s) => ({ craftsmen: [...s.craftsmen, c] }));
        return c;
      },
      updateCraftsman: (id, patch) =>
        set((s) => ({
          craftsmen: s.craftsmen.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeCraftsman: (id) =>
        set((s) => ({ craftsmen: s.craftsmen.filter((c) => c.id !== id) })),

      addReceipt: (input) => {
        const r: Receipt = { ...input, id: uid('rcp'), createdAt: new Date().toISOString() };
        set((s) => ({ receipts: [...s.receipts, r] }));
        return r;
      },
      updateReceipt: (id, patch) =>
        set((s) => ({
          receipts: s.receipts.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeReceipt: (id) =>
        set((s) => ({ receipts: s.receipts.filter((r) => r.id !== id) })),

      addDocument: (input) => {
        const d: DocumentEntry = {
          ...input,
          id: uid('dcm'),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ documents: [...s.documents, d] }));
        return d;
      },
      removeDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      addMeterReading: (input) => {
        const r: MeterReading = {
          ...input,
          id: uid('mtr'),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ meterReadings: [...s.meterReadings, r] }));
        return r;
      },
      removeMeterReading: (id) =>
        set((s) => ({ meterReadings: s.meterReadings.filter((r) => r.id !== id) })),

      runAutoBookings: () => {
        const todayIso = today();
        let created = 0;
        const lastByTemplate = new Map<string, Booking>();
        for (const b of get().bookings) {
          if (!b.templateId) continue;
          const prev = lastByTemplate.get(b.templateId);
          if (!prev || b.date > prev.date) lastByTemplate.set(b.templateId, b);
        }
        for (const tpl of get().templates) {
          if (tpl.recurrence === 'none') continue;
          const last = lastByTemplate.get(tpl.id);
          if (!last) continue;
          const due = nextDueDate(last.date, tpl.recurrence);
          if (due && due <= todayIso) {
            get().addBooking({
              type: tpl.type,
              amount: tpl.amount,
              date: due,
              propertyId: tpl.propertyId,
              categoryId: tpl.categoryId,
              counterparty: tpl.counterparty,
              note: tpl.note,
              recurrence: tpl.recurrence,
              templateId: tpl.id,
              autoBook: true,
            });
            created += 1;
          }
        }
        return created;
      },
    }),
    {
      name: 'manu-imperial-store-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentMonth: state.currentMonth,
        properties: state.properties,
        categories: state.categories,
        bookings: state.bookings,
        templates: state.templates,
        rules: state.rules,
        tenants: state.tenants,
        craftsmen: state.craftsmen,
        receipts: state.receipts,
        documents: state.documents,
        meterReadings: state.meterReadings,
        settings: state.settings,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.hydrated = true;
        state.unlocked = !state.settings.pinHash;
      },
    },
  ),
);

export function selectPropertyMonthSummary(
  state: AppState,
  propertyId: string,
): { income: number; expense: number; balance: number } {
  let income = 0;
  let expense = 0;
  for (const b of state.bookings) {
    if (b.propertyId !== propertyId) continue;
    if (!isInMonth(b.date, state.currentMonth)) continue;
    if (b.type === 'income') income += b.amount;
    else expense += b.amount;
  }
  return { income, expense, balance: income - expense };
}
