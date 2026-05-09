import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { builtinCategories } from '@/db/categories';
import { uid } from '@/lib/id';
import { today, monthKey, isInMonth } from '@/lib/dates';
import { applyRules } from '@/lib/rules';
import { nextDueDate } from '@/lib/recurring';
import { ClipboardHint } from '@/lib/clipboard';
import { objectColors } from '@/theme/colors';
import {
  Booking,
  Category,
  Property,
  Rule,
  Template,
} from '@/types';

interface AppState {
  hydrated: boolean;
  currentMonth: string;
  properties: Property[];
  categories: Category[];
  bookings: Booking[];
  templates: Template[];
  rules: Rule[];
  clipboardHint: ClipboardHint | null;

  setCurrentMonth: (monthIso: string) => void;
  setClipboardHint: (hint: ClipboardHint | null) => void;

  addProperty: (input: Omit<Property, 'id' | 'createdAt' | 'color'> & { color?: string }) => Property;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  removeProperty: (id: string) => void;

  addCategory: (input: Omit<Category, 'id' | 'builtin'>) => Category;
  removeCategory: (id: string) => void;

  addBooking: (input: Omit<Booking, 'id' | 'createdAt'>) => Booking;
  updateBooking: (id: string, patch: Partial<Booking>) => void;
  removeBooking: (id: string) => void;

  addTemplate: (input: Omit<Template, 'id' | 'createdAt'>) => Template;
  removeTemplate: (id: string) => void;
  bookFromTemplate: (templateId: string) => Booking | null;

  addRule: (input: Omit<Rule, 'id' | 'createdAt'>) => Rule;
  removeRule: (id: string) => void;

  runAutoBookings: () => number;
}

const initialState = {
  hydrated: false,
  currentMonth: monthKey(new Date()),
  properties: [] as Property[],
  categories: [...builtinCategories],
  bookings: [] as Booking[],
  templates: [] as Template[],
  rules: [] as Rule[],
  clipboardHint: null as ClipboardHint | null,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentMonth: (monthIso) => set({ currentMonth: monthIso }),
      setClipboardHint: (hint) => set({ clipboardHint: hint }),

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
        const rule: Rule = {
          ...input,
          id: uid('rul'),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ rules: [...s.rules, rule] }));
        return rule;
      },
      removeRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),

      runAutoBookings: () => {
        const todayIso = today();
        let created = 0;
        const { bookings } = get();
        const lastByTemplate = new Map<string, Booking>();
        for (const b of bookings) {
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
      name: 'manu-imperial-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentMonth: state.currentMonth,
        properties: state.properties,
        categories: state.categories,
        bookings: state.bookings,
        templates: state.templates,
        rules: state.rules,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
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
