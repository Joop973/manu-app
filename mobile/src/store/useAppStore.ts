import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { builtinCategories } from '@/db/categories';
import { ClipboardHint } from '@/lib/clipboard';
import { today, monthKey, isInMonth } from '@/lib/dates';
import { uid } from '@/lib/id';
import { hashPin, newSalt, verifyPin } from '@/lib/pin';
import { applyRules } from '@/lib/rules';
import { nextDueDate } from '@/lib/recurring';
import { evaluateAchievements, updateStreak } from '@/lib/achievements';
import { objectColors } from '@/theme/colors';
import {
  AchievementState,
  Asset,
  BillSplit,
  Booking,
  Budget,
  Category,
  ColorScheme,
  Contract,
  Craftsman,
  DatevMapping,
  DebtPlan,
  DocumentEntry,
  FontScale,
  Goal,
  HandoverProtocol,
  Investment,
  Liability,
  Locale,
  TrashEntry,
  MaintenanceLog,
  MeterReading,
  Property,
  Receipt,
  Rule,
  ScheduledReminder,
  Settings,
  Subscription,
  Tag,
  Template,
  Tenant,
  VacancyMark,
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
  // Phase 3
  tags: Tag[];
  subscriptions: Subscription[];
  contracts: Contract[];
  goals: Goal[];
  assets: Asset[];
  liabilities: Liability[];
  budgets: Budget[];
  investments: Investment[];
  debtPlans: DebtPlan[];
  maintenanceLogs: MaintenanceLog[];
  splits: BillSplit[];
  reminders: ScheduledReminder[];
  achievements: AchievementState;
  handovers: HandoverProtocol[];
  vacancies: VacancyMark[];
  datevMapping: DatevMapping[];
  // Phase 4 UI-State
  lastTab: string;
  scrollPositions: Record<string, number>;
  // Phase 5
  trash: TrashEntry[];

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
  setNotifications: (b: boolean) => void;
  setHelpHints: (b: boolean) => void;
  setMonthlyReportReminder: (b: boolean) => void;
  markOnboardingDone: () => void;
  resetOnboarding: () => void;
  setLastTab: (tab: string) => void;
  setScrollPosition: (key: string, y: number) => void;
  setColorScheme: (s: ColorScheme) => void;
  setLocale: (l: Locale) => void;
  setAutoLockMinutes: (m: number) => void;

  // Properties
  addProperty: (input: Omit<Property, 'id' | 'createdAt' | 'color'> & { color?: string }) => Property;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  removeProperty: (id: string) => void;

  // Categories
  addCategory: (input: Omit<Category, 'id' | 'builtin'>) => Category;
  removeCategory: (id: string) => void;

  // Bookings
  addBooking: (input: Omit<Booking, 'id' | 'createdAt'>) => Booking;
  addBookingsBulk: (rows: Booking[]) => void;
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

  // Meter
  addMeterReading: (input: Omit<MeterReading, 'id' | 'createdAt'>) => MeterReading;
  removeMeterReading: (id: string) => void;

  // Tags
  addTag: (input: Omit<Tag, 'id' | 'createdAt'>) => Tag;
  removeTag: (id: string) => void;

  // Subscriptions
  addSubscription: (input: Omit<Subscription, 'id' | 'createdAt'>) => Subscription;
  updateSubscription: (id: string, patch: Partial<Subscription>) => void;
  removeSubscription: (id: string) => void;

  // Contracts
  addContract: (input: Omit<Contract, 'id' | 'createdAt'>) => Contract;
  updateContract: (id: string, patch: Partial<Contract>) => void;
  removeContract: (id: string) => void;

  // Goals
  addGoal: (input: Omit<Goal, 'id' | 'createdAt' | 'saved'> & { saved?: number }) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  contributeToGoal: (id: string, amount: number) => void;
  removeGoal: (id: string) => void;

  // Net Worth
  addAsset: (input: Omit<Asset, 'id' | 'createdAt' | 'history'>) => Asset;
  updateAssetValue: (id: string, value: number) => void;
  removeAsset: (id: string) => void;
  addLiability: (input: Omit<Liability, 'id' | 'createdAt' | 'history'>) => Liability;
  updateLiabilityBalance: (id: string, balance: number) => void;
  removeLiability: (id: string) => void;

  // Budgets
  setBudget: (categoryId: string, monthlyLimit: number) => Budget;
  removeBudget: (id: string) => void;

  // Investments
  addInvestment: (input: Omit<Investment, 'id' | 'createdAt' | 'history'>) => Investment;
  updateInvestmentPrice: (id: string, price: number) => void;
  removeInvestment: (id: string) => void;

  // Debt plans
  addDebtPlan: (input: Omit<DebtPlan, 'id' | 'createdAt'>) => DebtPlan;
  removeDebtPlan: (id: string) => void;

  // Maintenance
  addMaintenance: (input: Omit<MaintenanceLog, 'id' | 'createdAt'>) => MaintenanceLog;
  removeMaintenance: (id: string) => void;

  // Splits
  addSplit: (input: Omit<BillSplit, 'id' | 'createdAt'>) => BillSplit;
  updateSplit: (id: string, patch: Partial<BillSplit>) => void;
  removeSplit: (id: string) => void;

  // Reminders
  addReminder: (input: Omit<ScheduledReminder, 'id' | 'createdAt'>) => ScheduledReminder;
  removeReminder: (id: string) => void;

  // Achievements
  refreshAchievements: () => string[];

  // Phase 4
  addHandover: (input: Omit<HandoverProtocol, 'id' | 'createdAt'>) => HandoverProtocol;
  updateHandover: (id: string, patch: Partial<HandoverProtocol>) => void;
  removeHandover: (id: string) => void;

  addVacancy: (input: Omit<VacancyMark, 'id' | 'createdAt'>) => VacancyMark;
  removeVacancy: (id: string) => void;

  setDatevMapping: (categoryId: string, account: string, accountName?: string) => void;
  removeDatevMapping: (categoryId: string) => void;

  // Phase 5: Papierkorb
  trashBooking: (id: string) => void;
  trashTenant: (id: string) => void;
  trashCraftsman: (id: string) => void;
  trashReceipt: (id: string) => void;
  trashDocument: (id: string) => void;
  trashMaintenance: (id: string) => void;
  trashSubscription: (id: string) => void;
  trashContract: (id: string) => void;
  trashGoal: (id: string) => void;
  trashTag: (id: string) => void;
  trashMeterReading: (id: string) => void;
  restoreFromTrash: (entryId: string) => void;
  emptyTrash: () => void;
  purgeOldTrash: () => number;

  // Phase 5: Bulk-Edit
  bulkUpdateBookings: (ids: string[], patch: Partial<Booking>) => void;
  bulkTrashBookings: (ids: string[]) => void;

  // Phase 5: Backup
  hydrateFromBackup: (data: Record<string, unknown>) => void;

  runAutoBookings: () => number;
}

const defaultSettings: Settings = {
  biometricEnabled: false,
  fontScale: 'normal',
  hapticEnabled: true,
  soundEnabled: true,
  onboardingDone: false,
  notificationsEnabled: false,
  helpHintsEnabled: true,
  monthlyReportReminderEnabled: false,
  autoLockMinutes: 0,
  colorScheme: 'dark',
  locale: 'de',
};

const defaultAchievements: AchievementState = {
  unlocked: [],
  streak: 0,
  totalBookings: 0,
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
      tags: [],
      subscriptions: [],
      contracts: [],
      goals: [],
      assets: [],
      liabilities: [],
      budgets: [],
      investments: [],
      debtPlans: [],
      maintenanceLogs: [],
      splits: [],
      reminders: [],
      achievements: { ...defaultAchievements },
      handovers: [],
      vacancies: [],
      datevMapping: [],
      lastTab: 'index',
      scrollPositions: {},
      trash: [],
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
      setBiometric: (b) => set((s) => ({ settings: { ...s.settings, biometricEnabled: b } })),
      setFontScale: (scale) => set((s) => ({ settings: { ...s.settings, fontScale: scale } })),
      setHaptic: (b) => set((s) => ({ settings: { ...s.settings, hapticEnabled: b } })),
      setSound: (b) => set((s) => ({ settings: { ...s.settings, soundEnabled: b } })),
      setNotifications: (b) => set((s) => ({ settings: { ...s.settings, notificationsEnabled: b } })),
      setHelpHints: (b) => set((s) => ({ settings: { ...s.settings, helpHintsEnabled: b } })),
      setMonthlyReportReminder: (b) =>
        set((s) => ({ settings: { ...s.settings, monthlyReportReminderEnabled: b } })),
      markOnboardingDone: () => set((s) => ({ settings: { ...s.settings, onboardingDone: true } })),
      resetOnboarding: () => set((s) => ({ settings: { ...s.settings, onboardingDone: false } })),
      setLastTab: (tab) => set({ lastTab: tab }),
      setScrollPosition: (key, y) =>
        set((s) => ({ scrollPositions: { ...s.scrollPositions, [key]: y } })),
      setColorScheme: (scheme) => set((s) => ({ settings: { ...s.settings, colorScheme: scheme } })),
      setLocale: (locale) => set((s) => ({ settings: { ...s.settings, locale } })),
      setAutoLockMinutes: (m) => set((s) => ({ settings: { ...s.settings, autoLockMinutes: m } })),

      addProperty: (input) => {
        const used = new Set(get().properties.map((p) => p.color));
        const color = input.color ?? objectColors.find((c) => !used.has(c)) ?? objectColors[0];
        const property: Property = { ...input, color, id: uid('obj'), createdAt: new Date().toISOString() };
        set((s) => ({ properties: [...s.properties, property] }));
        get().refreshAchievements();
        return property;
      },
      updateProperty: (id, patch) =>
        set((s) => ({ properties: s.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removeProperty: (id) =>
        set((s) => ({
          properties: s.properties.filter((p) => p.id !== id),
          bookings: s.bookings.filter((b) => b.propertyId !== id),
          tenants: s.tenants.filter((t) => t.propertyId !== id),
          meterReadings: s.meterReadings.filter((r) => r.propertyId !== id),
          maintenanceLogs: s.maintenanceLogs.filter((m) => m.propertyId !== id),
        })),

      addCategory: (input) => {
        const cat: Category = { ...input, id: uid('cat') };
        set((s) => ({ categories: [...s.categories, cat] }));
        return cat;
      },
      removeCategory: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id || c.builtin) })),

      addBooking: (input) => {
        const withRules = applyRules(input, get().rules);
        const booking: Booking = {
          ...withRules,
          id: uid('bkg'),
          createdAt: new Date().toISOString(),
        } as Booking;
        set((s) => ({ bookings: [...s.bookings, booking] }));

        // Goal-Beitrag automatisch
        if (booking.goalId && booking.type === 'income') {
          set((s) => ({
            goals: s.goals.map((g) =>
              g.id === booking.goalId ? { ...g, saved: g.saved + booking.amount } : g,
            ),
          }));
        }

        // Streak + Achievements
        const todayIso = today();
        set((s) => ({
          achievements: updateStreak({
            state: s.achievements,
            today: todayIso,
            bookingDates: s.bookings.map((b) => b.date),
          }),
        }));
        get().refreshAchievements();
        return booking;
      },
      addBookingsBulk: (rows) => {
        const withRules = rows.map((r) => ({
          ...applyRules(r, get().rules),
          createdAt: r.createdAt ?? new Date().toISOString(),
        })) as Booking[];
        set((s) => ({ bookings: [...s.bookings, ...withRules] }));
        get().refreshAchievements();
      },
      updateBooking: (id, patch) =>
        set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      removeBooking: (id) =>
        set((s) => ({
          bookings: s.bookings.filter((b) => b.id !== id),
          splits: s.splits.filter((sp) => sp.bookingId !== id),
        })),

      addTemplate: (input) => {
        const template: Template = { ...input, id: uid('tpl'), createdAt: new Date().toISOString() };
        set((s) => ({ templates: [...s.templates, template] }));
        return template;
      },
      removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
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
        get().refreshAchievements();
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
        set((s) => ({ craftsmen: s.craftsmen.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeCraftsman: (id) => set((s) => ({ craftsmen: s.craftsmen.filter((c) => c.id !== id) })),

      addReceipt: (input) => {
        const r: Receipt = { ...input, id: uid('rcp'), createdAt: new Date().toISOString() };
        set((s) => ({ receipts: [...s.receipts, r] }));
        return r;
      },
      updateReceipt: (id, patch) =>
        set((s) => ({ receipts: s.receipts.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      removeReceipt: (id) => set((s) => ({ receipts: s.receipts.filter((r) => r.id !== id) })),

      addDocument: (input) => {
        const d: DocumentEntry = { ...input, id: uid('dcm'), createdAt: new Date().toISOString() };
        set((s) => ({ documents: [...s.documents, d] }));
        return d;
      },
      removeDocument: (id) => set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      addMeterReading: (input) => {
        const r: MeterReading = { ...input, id: uid('mtr'), createdAt: new Date().toISOString() };
        set((s) => ({ meterReadings: [...s.meterReadings, r] }));
        return r;
      },
      removeMeterReading: (id) =>
        set((s) => ({ meterReadings: s.meterReadings.filter((r) => r.id !== id) })),

      addTag: (input) => {
        const tag: Tag = { ...input, id: uid('tag'), createdAt: new Date().toISOString() };
        set((s) => ({ tags: [...s.tags, tag] }));
        return tag;
      },
      removeTag: (id) =>
        set((s) => ({
          tags: s.tags.filter((t) => t.id !== id),
          bookings: s.bookings.map((b) => ({ ...b, tagIds: b.tagIds?.filter((t) => t !== id) })),
        })),

      addSubscription: (input) => {
        const sub: Subscription = { ...input, id: uid('sub'), createdAt: new Date().toISOString() };
        set((s) => ({ subscriptions: [...s.subscriptions, sub] }));
        get().refreshAchievements();
        return sub;
      },
      updateSubscription: (id, patch) =>
        set((s) => ({
          subscriptions: s.subscriptions.map((sub) => (sub.id === id ? { ...sub, ...patch } : sub)),
        })),
      removeSubscription: (id) =>
        set((s) => ({ subscriptions: s.subscriptions.filter((s) => s.id !== id) })),

      addContract: (input) => {
        const c: Contract = { ...input, id: uid('ctr'), createdAt: new Date().toISOString() };
        set((s) => ({ contracts: [...s.contracts, c] }));
        return c;
      },
      updateContract: (id, patch) =>
        set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeContract: (id) =>
        set((s) => ({ contracts: s.contracts.filter((c) => c.id !== id) })),

      addGoal: (input) => {
        const goal: Goal = {
          ...input,
          saved: input.saved ?? 0,
          id: uid('gol'),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ goals: [...s.goals, goal] }));
        get().refreshAchievements();
        return goal;
      },
      updateGoal: (id, patch) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      contributeToGoal: (id, amount) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, saved: g.saved + amount } : g)),
        })),
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      addAsset: (input) => {
        const a: Asset = {
          ...input,
          id: uid('ast'),
          history: [{ date: today(), value: input.value }],
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ assets: [...s.assets, a] }));
        return a;
      },
      updateAssetValue: (id, value) =>
        set((s) => ({
          assets: s.assets.map((a) =>
            a.id === id
              ? { ...a, value, history: [...a.history, { date: today(), value }] }
              : a,
          ),
        })),
      removeAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),

      addLiability: (input) => {
        const l: Liability = {
          ...input,
          id: uid('lia'),
          history: [{ date: today(), balance: input.balance }],
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ liabilities: [...s.liabilities, l] }));
        return l;
      },
      updateLiabilityBalance: (id, balance) =>
        set((s) => ({
          liabilities: s.liabilities.map((l) =>
            l.id === id
              ? { ...l, balance, history: [...l.history, { date: today(), balance }] }
              : l,
          ),
        })),
      removeLiability: (id) => set((s) => ({ liabilities: s.liabilities.filter((l) => l.id !== id) })),

      setBudget: (categoryId, monthlyLimit) => {
        const existing = get().budgets.find((b) => b.categoryId === categoryId);
        if (existing) {
          set((s) => ({
            budgets: s.budgets.map((b) =>
              b.id === existing.id ? { ...b, monthlyLimit } : b,
            ),
          }));
          return { ...existing, monthlyLimit };
        }
        const b: Budget = {
          id: uid('bdg'),
          categoryId,
          monthlyLimit,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ budgets: [...s.budgets, b] }));
        return b;
      },
      removeBudget: (id) => set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) })),

      addInvestment: (input) => {
        const inv: Investment = {
          ...input,
          id: uid('inv'),
          history: [{ date: today(), price: input.currentPrice ?? input.buyPrice }],
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ investments: [...s.investments, inv] }));
        return inv;
      },
      updateInvestmentPrice: (id, price) =>
        set((s) => ({
          investments: s.investments.map((i) =>
            i.id === id
              ? { ...i, currentPrice: price, history: [...i.history, { date: today(), price }] }
              : i,
          ),
        })),
      removeInvestment: (id) =>
        set((s) => ({ investments: s.investments.filter((i) => i.id !== id) })),

      addDebtPlan: (input) => {
        const p: DebtPlan = { ...input, id: uid('dbt'), createdAt: new Date().toISOString() };
        set((s) => ({ debtPlans: [...s.debtPlans, p] }));
        return p;
      },
      removeDebtPlan: (id) => set((s) => ({ debtPlans: s.debtPlans.filter((p) => p.id !== id) })),

      addMaintenance: (input) => {
        const m: MaintenanceLog = { ...input, id: uid('mnt'), createdAt: new Date().toISOString() };
        set((s) => ({ maintenanceLogs: [...s.maintenanceLogs, m] }));
        return m;
      },
      removeMaintenance: (id) =>
        set((s) => ({ maintenanceLogs: s.maintenanceLogs.filter((m) => m.id !== id) })),

      addSplit: (input) => {
        const sp: BillSplit = { ...input, id: uid('spl'), createdAt: new Date().toISOString() };
        set((s) => ({ splits: [...s.splits, sp] }));
        return sp;
      },
      updateSplit: (id, patch) =>
        set((s) => ({ splits: s.splits.map((sp) => (sp.id === id ? { ...sp, ...patch } : sp)) })),
      removeSplit: (id) => set((s) => ({ splits: s.splits.filter((sp) => sp.id !== id) })),

      addReminder: (input) => {
        const r: ScheduledReminder = { ...input, id: uid('rem'), createdAt: new Date().toISOString() };
        set((s) => ({ reminders: [...s.reminders, r] }));
        return r;
      },
      removeReminder: (id) => set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),

      refreshAchievements: () => {
        const s = get();
        const result = evaluateAchievements({
          state: s.achievements,
          bookings: s.bookings,
          hasProperty: s.properties.length > 0,
          hasTenant: s.tenants.length > 0,
          goals: s.goals,
          subscriptions: s.subscriptions,
        });
        set({
          achievements: {
            ...s.achievements,
            unlocked: result.ids,
            totalBookings: s.bookings.length,
          },
        });
        return result.newlyUnlocked;
      },

      addHandover: (input) => {
        const h: HandoverProtocol = { ...input, id: uid('hov'), createdAt: new Date().toISOString() };
        set((s) => ({ handovers: [...s.handovers, h] }));
        return h;
      },
      updateHandover: (id, patch) =>
        set((s) => ({ handovers: s.handovers.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
      removeHandover: (id) => set((s) => ({ handovers: s.handovers.filter((h) => h.id !== id) })),

      addVacancy: (input) => {
        const v: VacancyMark = { ...input, id: uid('vac'), createdAt: new Date().toISOString() };
        set((s) => ({ vacancies: [...s.vacancies, v] }));
        return v;
      },
      removeVacancy: (id) => set((s) => ({ vacancies: s.vacancies.filter((v) => v.id !== id) })),

      setDatevMapping: (categoryId, account, accountName) =>
        set((s) => {
          const others = s.datevMapping.filter((m) => m.categoryId !== categoryId);
          return { datevMapping: [...others, { categoryId, account, accountName }] };
        }),
      removeDatevMapping: (categoryId) =>
        set((s) => ({ datevMapping: s.datevMapping.filter((m) => m.categoryId !== categoryId) })),

      // Phase 5: Soft-Delete in Papierkorb
      trashBooking: (id) =>
        set((s) => {
          const item = s.bookings.find((b) => b.id === id);
          if (!item) return s;
          return {
            bookings: s.bookings.filter((b) => b.id !== id),
            trash: [
              ...s.trash,
              { id: uid('trash'), entityType: 'booking', payload: item, deletedAt: new Date().toISOString() },
            ],
          };
        }),
      trashTenant: (id) =>
        set((s) => {
          const item = s.tenants.find((t) => t.id === id);
          if (!item) return s;
          return {
            tenants: s.tenants.filter((t) => t.id !== id),
            trash: [...s.trash, { id: uid('trash'), entityType: 'tenant', payload: item, deletedAt: new Date().toISOString() }],
          };
        }),
      trashCraftsman: (id) =>
        set((s) => {
          const item = s.craftsmen.find((c) => c.id === id);
          if (!item) return s;
          return {
            craftsmen: s.craftsmen.filter((c) => c.id !== id),
            trash: [...s.trash, { id: uid('trash'), entityType: 'craftsman', payload: item, deletedAt: new Date().toISOString() }],
          };
        }),
      trashReceipt: (id) =>
        set((s) => {
          const item = s.receipts.find((r) => r.id === id);
          if (!item) return s;
          return {
            receipts: s.receipts.filter((r) => r.id !== id),
            trash: [...s.trash, { id: uid('trash'), entityType: 'receipt', payload: item, deletedAt: new Date().toISOString() }],
          };
        }),
      trashDocument: (id) =>
        set((s) => {
          const item = s.documents.find((d) => d.id === id);
          if (!item) return s;
          return {
            documents: s.documents.filter((d) => d.id !== id),
            trash: [...s.trash, { id: uid('trash'), entityType: 'document', payload: item, deletedAt: new Date().toISOString() }],
          };
        }),
      trashMaintenance: (id) =>
        set((s) => {
          const item = s.maintenanceLogs.find((m) => m.id === id);
          if (!item) return s;
          return {
            maintenanceLogs: s.maintenanceLogs.filter((m) => m.id !== id),
            trash: [...s.trash, { id: uid('trash'), entityType: 'maintenance', payload: item, deletedAt: new Date().toISOString() }],
          };
        }),
      trashSubscription: (id) =>
        set((s) => {
          const item = s.subscriptions.find((sub) => sub.id === id);
          if (!item) return s;
          return {
            subscriptions: s.subscriptions.filter((sub) => sub.id !== id),
            trash: [...s.trash, { id: uid('trash'), entityType: 'subscription', payload: item, deletedAt: new Date().toISOString() }],
          };
        }),
      trashContract: (id) =>
        set((s) => {
          const item = s.contracts.find((c) => c.id === id);
          if (!item) return s;
          return {
            contracts: s.contracts.filter((c) => c.id !== id),
            trash: [...s.trash, { id: uid('trash'), entityType: 'contract', payload: item, deletedAt: new Date().toISOString() }],
          };
        }),
      trashGoal: (id) =>
        set((s) => {
          const item = s.goals.find((g) => g.id === id);
          if (!item) return s;
          return {
            goals: s.goals.filter((g) => g.id !== id),
            trash: [...s.trash, { id: uid('trash'), entityType: 'goal', payload: item, deletedAt: new Date().toISOString() }],
          };
        }),
      trashTag: (id) =>
        set((s) => {
          const item = s.tags.find((t) => t.id === id);
          if (!item) return s;
          return {
            tags: s.tags.filter((t) => t.id !== id),
            bookings: s.bookings.map((b) => ({ ...b, tagIds: b.tagIds?.filter((tid) => tid !== id) })),
            trash: [...s.trash, { id: uid('trash'), entityType: 'tag', payload: item, deletedAt: new Date().toISOString() }],
          };
        }),
      trashMeterReading: (id) =>
        set((s) => {
          const item = s.meterReadings.find((m) => m.id === id);
          if (!item) return s;
          return {
            meterReadings: s.meterReadings.filter((m) => m.id !== id),
            trash: [...s.trash, { id: uid('trash'), entityType: 'meterReading', payload: item, deletedAt: new Date().toISOString() }],
          };
        }),

      restoreFromTrash: (entryId) =>
        set((s) => {
          const entry = s.trash.find((t) => t.id === entryId);
          if (!entry) return s;
          const trash = s.trash.filter((t) => t.id !== entryId);
          switch (entry.entityType) {
            case 'booking':
              return { trash, bookings: [...s.bookings, entry.payload as Booking] };
            case 'tenant':
              return { trash, tenants: [...s.tenants, entry.payload as Tenant] };
            case 'craftsman':
              return { trash, craftsmen: [...s.craftsmen, entry.payload as Craftsman] };
            case 'receipt':
              return { trash, receipts: [...s.receipts, entry.payload as Receipt] };
            case 'document':
              return { trash, documents: [...s.documents, entry.payload as DocumentEntry] };
            case 'maintenance':
              return { trash, maintenanceLogs: [...s.maintenanceLogs, entry.payload as MaintenanceLog] };
            case 'subscription':
              return { trash, subscriptions: [...s.subscriptions, entry.payload as Subscription] };
            case 'contract':
              return { trash, contracts: [...s.contracts, entry.payload as Contract] };
            case 'goal':
              return { trash, goals: [...s.goals, entry.payload as Goal] };
            case 'tag':
              return { trash, tags: [...s.tags, entry.payload as Tag] };
            case 'meterReading':
              return { trash, meterReadings: [...s.meterReadings, entry.payload as MeterReading] };
          }
          return { trash };
        }),

      emptyTrash: () => set({ trash: [] }),

      purgeOldTrash: () => {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        let removed = 0;
        set((s) => ({
          trash: s.trash.filter((t) => {
            const keep = new Date(t.deletedAt).getTime() >= cutoff;
            if (!keep) removed += 1;
            return keep;
          }),
        }));
        return removed;
      },

      bulkUpdateBookings: (ids, patch) =>
        set((s) => ({
          bookings: s.bookings.map((b) => (ids.includes(b.id) ? { ...b, ...patch } : b)),
        })),

      bulkTrashBookings: (ids) =>
        set((s) => {
          const matched = s.bookings.filter((b) => ids.includes(b.id));
          return {
            bookings: s.bookings.filter((b) => !ids.includes(b.id)),
            trash: [
              ...s.trash,
              ...matched.map<TrashEntry>((b) => ({
                id: uid('trash'),
                entityType: 'booking',
                payload: b,
                deletedAt: new Date().toISOString(),
              })),
            ],
          };
        }),

      hydrateFromBackup: (data) =>
        set((state) => ({
          ...state,
          ...(data as Partial<typeof state>),
          hydrated: true,
          unlocked: state.unlocked,
        })),

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
      name: 'manu-imperial-store-v5',
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
        tags: state.tags,
        subscriptions: state.subscriptions,
        contracts: state.contracts,
        goals: state.goals,
        assets: state.assets,
        liabilities: state.liabilities,
        budgets: state.budgets,
        investments: state.investments,
        debtPlans: state.debtPlans,
        maintenanceLogs: state.maintenanceLogs,
        splits: state.splits,
        reminders: state.reminders,
        achievements: state.achievements,
        handovers: state.handovers,
        vacancies: state.vacancies,
        datevMapping: state.datevMapping,
        lastTab: state.lastTab,
        scrollPositions: state.scrollPositions,
        trash: state.trash,
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
